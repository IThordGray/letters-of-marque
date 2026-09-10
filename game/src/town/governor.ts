// The development plan — what the governor builds next, and why.
//
// A five-term auction over the twelve capital works. THE HARD RULE: no term
// without a clause. The one-line reason is assembled from the top two
// contributing terms, so the explanation IS the score rather than a
// rationalisation written afterwards.
//
// Wealth is NOT a term. The score decides what the town wants most; wealth
// decides what it can start now. Keeping those separate is what makes an
// investment slider mean something.

import type { Town, Work, WorkKind, Need, Archetype, Suit } from "./types";
import { CATALOGUE, CHOOSABLE, buildable, raise, groundFor, starvedFor } from "./works";
import { compass, LABEL } from "./land";
import { DEPENDENCY_CLAUSE, fetchOf } from "./trade";
import { derive, stepSeason, year } from "./sim";
import { PLAN, SEASONS_PER_YEAR } from "./constants";
import { stepFootprint, type Grew } from "./footprint";

export type TermKey = "land" | "need" | "market" | "fear" | "agenda";

export interface Term {
  key: TermKey;
  weight: number; // contribution to the score
  clause: string; // the plain-language reason this term gives
}

export interface Want {
  kind: WorkKind;
  label: string;
  score: number;
  terms: Term[]; // strongest first
  reason: string; // assembled from the top two
  where: string; // "to the west", or "" for a work that needs no land
  cost: number;
  affordable: boolean; // the coffers can pay for it today
  manned: boolean; // ...and there are spare hands to work it. "Money and no men."
}

// ---- The clauses each term can write ---------------------------------------

// THE LAND ANSWERS IN THREE REGISTERS (spec §5.8). It refuses outright, it
// grudges, or it bears — and the middle one is the upgrade: a steer can now land
// badly, which is more interesting than a refusal and more legible than silent
// underperformance. The grudge is said BEFORE the work is raised.
const SUIT_CLAUSE: Record<Suit, (ground: string) => string> = {
  ideal: (g) => `the ${g} were made for it`,
  fair: (g) => `the ${g} will take it well enough`,
  poor: (g) => `the ${g} grudge it — it would pay a fraction`,
};

// `food` no longer says "there is not enough to eat", and the change is the
// point (§3.5.4): the term rebased from HUNGER to DEPENDENCY, so it is heard from
// a town with full bellies whose bread is bought. This is the clause that keeps
// the wish for a farm alive in a place that imports ([HC-81]).
const NEED_CLAUSE: Record<Need, string> = {
  food: DEPENDENCY_CLAUSE,
  drink: "the men have nowhere to drink",
  shelter: "people are sleeping rough",
  worship: "there is nowhere to pray",
  order: "the place wants keeping in order",
};

// What a supplier is FOR, said from the downstream work's point of view.
const STARVED_CLAUSE: Partial<Record<WorkKind, string>> = {
  sawpit: "the shipways want planks",
  caneField: "the boiling house wants cane",
};

const AGENDA_CLAUSE: Record<Archetype, string> = {
  colony: "the Company wants a return on this place",
  royalOutpost: "the crown wants this place held",
  pirateHaven: "you want a haven that can keep itself",
};

// How much each patron cares about each work. This is where a royal outpost
// becomes hard-and-poor and a colony becomes rich-and-open — the archetypes are
// agendas, not stat blocks.
export const AGENDA: Record<Archetype, Partial<Record<WorkKind, number>>> = {
  colony: {
    sawpit: 0.8, caneField: 0.8, boilingHouse: 1.0, shipway: 0.7, warehouse: 0.9,
    customsHouse: 0.5, provisionGround: 0.6, church: 0.5, tavern: 0.4,
    battery: 0.15, palisade: 0.15, barracks: 0.2, // revenue first, defence last
  },
  royalOutpost: {
    battery: 1.0, barracks: 1.0, palisade: 0.8, customsHouse: 0.9, church: 0.6,
    provisionGround: 0.5, warehouse: 0.4, tavern: 0.3,
    sawpit: 0.3, caneField: 0.2, boilingHouse: 0.2, shipway: 0.3, // it need not earn
  },
  pirateHaven: {
    tavern: 1.0, shipway: 0.9, battery: 0.8, warehouse: 0.8, boilingHouse: 0.8,
    sawpit: 0.7, provisionGround: 0.6, palisade: 0.6, caneField: 0.5,
    barracks: 0.4, church: 0.2, customsHouse: 0.1, // no crown, no customs
  },
};

// ---- Scoring ---------------------------------------------------------------

export function scoreWork(town: Town, kind: WorkKind, derived = derive(town)): Term[] {
  const def = CATALOGUE[kind];
  const d = derived;
  const terms: Term[] = [];

  // 1. THE LAND CALLS FOR IT — and how loudly depends on how well it suits.
  const ground = groundFor(town, kind);
  if (ground) {
    const suit = ground.suit;
    terms.push({
      key: "land",
      weight: (suit ? PLAN.affinity[suit] : PLAN.affinity.fair) * PLAN.weights.land,
      clause: suit
        ? SUIT_CLAUSE[suit](LABEL[ground.region.terrain])
        : `there is ${LABEL[ground.region.terrain]} for it`,
    });
  }

  // 2. THE TOWN WANTS IT — an unmet want the work would answer.
  if (def.serves && d.needs[def.serves] > 0) {
    terms.push({
      key: "need",
      weight: d.needs[def.serves] * PLAN.weights.need,
      clause: NEED_CLAUSE[def.serves],
    });
  }

  // 3. THE MARKET WANTS IT — it earns WHAT IT WOULD ACTUALLY FETCH HERE, and
  //    more sharply, something downstream is waiting on it.
  //
  //    §3.5.4's second edit to the auction: `trade x priceOf x access` rather
  //    than a flat constant. It is what turns this term from a fact about the
  //    catalogue into an argument about this place — the same sawpit is worth
  //    raising where timber is dear and not where it is cheap, and a port whose
  //    quay has burned has no market argument for anything at all.
  const earns = fetchOf(town, kind, d.access) / PLAN.tradeScale;
  const starved = starvedFor(town, kind) ? PLAN.starvedBonus : 0;
  if (earns + starved > 0) {
    terms.push({
      key: "market",
      weight: (earns + starved) * PLAN.weights.market,
      clause: starved ? (STARVED_CLAUSE[kind] ?? "there is money in it") : "there is money in it",
    });
  }

  // 4. FEAR — the town is open, and more so if it was lately hurt.
  if (def.defence > 0) {
    const deficit = Math.max(0, 1 - d.security / PLAN.wantSecurity);
    const fresh = town.lastThreat !== null && town.season - town.lastThreat < PLAN.threatMemory;
    if (deficit > 0) {
      terms.push({
        key: "fear",
        weight: deficit * (fresh ? 2 : 1) * PLAN.weights.fear,
        clause: fresh ? "since the burning, the town wants guns" : "the town lies open",
      });
    }
  }

  // 5. THE PATRON'S AGENDA — whoever pays has an opinion about what for.
  const agenda = AGENDA[town.archetype][kind] ?? 0;
  if (agenda > 0) {
    terms.push({ key: "agenda", weight: agenda * PLAN.weights.agenda, clause: AGENDA_CLAUSE[town.archetype] });
  }

  return terms.sort((a, b) => b.weight - a.weight);
}

// The sentence IS the score: the top two contributors, in their own words.
export function reasonFrom(terms: Term[]): string {
  const top = terms.slice(0, 2).map((t) => t.clause);
  if (!top.length) return "there is nothing pressing";
  return top.length === 1 ? top[0] : `${top[0]} and ${top[1]}`;
}

function whereFor(town: Town, kind: WorkKind): string {
  const g = groundFor(town, kind);
  return g ? ` to the ${compass(g.region.bearing)}` : "";
}

// ---- The wants-list --------------------------------------------------------
// Published so the sim is INSPECTABLE WITHOUT BEING CONTROLLABLE. Raising the
// investment reorders and lengthens this list, which is the whole demo.
export function wants(town: Town, limit = 3): Want[] {
  const d = derive(town);
  const spare = Math.max(0, d.hands.available - d.hands.needed);
  const out: Want[] = [];
  for (const kind of CHOOSABLE) {
    if (!buildable(town, kind)) continue;
    const terms = scoreWork(town, kind, d);
    const score = terms.reduce((s, t) => s + t.weight, 0);
    if (score <= 0) continue;
    const def = CATALOGUE[kind];
    out.push({
      kind,
      label: def.label,
      score,
      terms,
      reason: reasonFrom(terms),
      where: whereFor(town, kind),
      cost: def.cost,
      affordable: town.wealth >= def.cost,
      manned: def.hands <= spare,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// ---- Building --------------------------------------------------------------

export interface Built {
  work: Work;
  want: Want;
  year: number;
  sentence: string;
}

// One decision per season. The governor builds the best thing he can afford —
// but he HOLDS OUT for something better rather than always buying the cheapest
// option, which is what lets money change what a town becomes and not merely how
// fast it gets there.
export function governorTurn(town: Town, year: number): Built | null {
  const ranked = wants(town, CHOOSABLE.length);

  // He will not raise what nobody can work. A town with money and no men simply
  // waits — and building anyway would just leave a shed to rot, which is exactly
  // the loop this guard exists to prevent.
  const achievable = ranked.filter((w) => w.manned);
  if (!achievable.length) return null;

  const best = achievable[0]; // what he actually wants
  const now = achievable.find((w) => w.affordable); // ...and what he could start today
  if (!now) return null; // saving up

  // He holds out for the better thing unless something nearly as good is to hand.
  if (now !== best && now.score < best.score * PLAN.settleFor) return null;

  const work = raise(town, now.kind, year);
  if (!work) return null;
  town.wealth -= now.cost;
  return { work, want: now, year, sentence: describeBuild(town, now) };
}

export function describeBuild(town: Town, want: Want): string {
  const who = town.governor?.trim() ? town.governor : "The governor";
  return `${who} sets ${want.label}${want.where} — ${want.reason}.`;
}

// ---- Running a town --------------------------------------------------------
// The season passes, THEN the governor spends what it earned. This orchestration
// lives here rather than in sim.ts so the dependency stays one-way (governor
// knows about the sim; the sim knows nothing about governors).

// What a season came to. Growth is never a prompt — the town does not tell you it
// has outgrown its wall (§1.1); this is only what a harness may report if asked.
export interface Season {
  year: number;
  built: Built | null;
  grew: Grew | null;
}

export function stepTownSeason(town: Town): Season {
  stepSeason(town);
  // The town spreads on its own, whatever the governor is minded to build. It is
  // pressure relieved, not a decision taken — so it is not part of the auction.
  const grew = stepFootprint(town);
  return { year: year(town), built: governorTurn(town, year(town)), grew };
}

export function stepTownYears(town: Town, years: number): Season[] {
  const out: Season[] = [];
  for (let i = 0; i < years * SEASONS_PER_YEAR; i++) {
    const s = stepTownSeason(town);
    if (s.built || s.grew) out.push(s);
  }
  return out;
}
