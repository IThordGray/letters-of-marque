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

import type { Town, Work, WorkKind, Need, Archetype, Suit, Derived } from "./types";
import { CATALOGUE, CHOOSABLE, buildable, raise, groundFor, starvedFor, mendable, repairCost, worthOf } from "./works";
import { compass, LABEL } from "./land";
import { DEPENDENCY_CLAUSE, canBuildKind, fetchOf } from "./trade";
import { derive, stepSeason } from "./sim";
import { CALENDAR } from "../overworld/calendar";
import { PLAN } from "./constants";
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
  // ...and there is timber and stone to raise it with (§3.5.3). A THIRD gate of
  // the same kind as the other two: it says nothing about what the town wants,
  // only about what it can start. A stone-poor island with full coffers and idle
  // hands still cannot rebuild its wall.
  //
  // IT IS PER-WORK AND NOT PER-TOWN, because a work that PRODUCES materials is
  // not gated by materials (ratified 2026-09-16): the same stone-poor island can
  // still dig a sawpit in its own hills. See `producesMaterials` in trade.ts for
  // the cliff that rule closes.
  supplied: boolean;
  // ...and it is a thing a place of this purpose would ever raise (§11.3). A
  // military settlement wishes for a farm, publishes the wish, and never builds
  // one — which is the whole of what purpose changes.
  permitted: boolean;
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

// WHAT A PLACE'S PURPOSE PUTS OUT OF REACH — §11.3, and the cheaper of the two
// readings of Q7. [HC-81] says dependency is scored IDENTICALLY for every place,
// whatever its purpose, so that "importing never silences the wish for a farm"
// survives verbatim. What purpose changes is what the governor may DO about it:
// a farm is simply not in a military settlement's vocabulary.
//
// So the wish stays VISIBLE — the wants-list publishes it, clause and all, and
// the town card still reads "too much of their bread comes off a ship" — and it
// is PERMANENTLY UNFULFILLED. That is the whole implementation: no per-purpose
// scoring anywhere, and one line of vocabulary here.
export const OUT_OF_VOCABULARY: Record<Archetype, Partial<Record<WorkKind, true>>> = {
  colony: {},
  royalOutpost: { provisionGround: true }, // it buys its bread with the crown's grant
  pirateHaven: {},
};

export const permits = (town: Town, kind: WorkKind): boolean =>
  OUT_OF_VOCABULARY[town.archetype][kind] !== true;

// ---- Scoring ---------------------------------------------------------------

// THE DAY IS AN ARGUMENT, not a lookup. The fear term asks how long ago the town
// was burned, and "how long ago" is the difference between two days since world
// epoch ([HC-3]) — handed in, never fetched ([HC-71]).
export function scoreWork(town: Town, kind: WorkKind, day: number, derived = derive(town)): Term[] {
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
    const fresh = town.lastThreatDay !== null && day - town.lastThreatDay < PLAN.threatMemory;
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
export function wants(town: Town, day: number, limit = 3, derived = derive(town)): Want[] {
  const d = derived;
  const spare = spareHands(d);
  const out: Want[] = [];
  for (const kind of CHOOSABLE) {
    if (!buildable(town, kind)) continue;
    const terms = scoreWork(town, kind, day, d);
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
      supplied: canBuildKind(d.commerce, kind),
      permitted: permits(town, kind),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// ---- Building --------------------------------------------------------------

export interface Built {
  work: Work;
  // `null` when he MENDED rather than raised. A repair has no auction behind it:
  // the town is not choosing what it wants, it is keeping what it already has.
  want: Want | null;
  // The DAY it happened, days since world epoch. Not a year: a year is a reading,
  // taken by whoever prints the sentence. A struct carrying both would be [P-47]
  // in miniature, and the two would eventually disagree.
  day: number;
  sentence: string;
}

// ---- Mending what is rotting (the devolution ladder, spec §3) ---------------
//
// A DECAYED WORK IS RECOVERABLE, AND RECOVERY COSTS COIN. The spec says every
// grade is reversible; a decayed work that came back for free the way an idle one
// does would leave the ladder's middle rung meaning nothing, and "each step is
// legible" would be a claim about nothing.
//
// WHY IT LIVES HERE AND NOT IN THE LEDGER'S OWN UPKEEP, which is the real reason
// `works.ts` cannot mend anything by itself:
//   - [HC-78] IMPORTS ARE PAID BEFORE CONSTRUCTION — bread before batteries.
//     `stepWorks` runs in phase 1 (PRODUCE) and the quay is not paid until phase 3
//     (SETTLE), so coin spent there would come out of the purse the town buys its
//     corn with. Every other priced decision — raising a work, densifying the core
//     — is taken after settlement, and mending is one of them.
//   - A capital work needs money or a patron to be SAVED for the same reason it
//     needed one to be RAISED. Subsistence works never rot because people keep
//     their own roofs on; nobody keeps a shipway's roof on for nothing.
//
// It takes the season's ONE decision, so mending genuinely competes with building
// for the thing that is actually scarce, and a governor never raises a fourth
// sawpit while the third rots.
const MEND_CLAUSE = "it was rotting, and mending costs less than raising anew";

// The spare hands a town has. ONE FUNCTION ([P-47]) so §5.6's labour gate is the
// same number whether he is raising a work or saving one.
const spareHands = (d: Derived): number => Math.max(0, d.hands.available - d.hands.needed);

// §5.6, applied to the same verb it was written for. The pathology it was written
// against — raise a shed, nobody mans it, it rots, the slot frees, raise it again —
// has an exact twin in mend/rot/mend, and the same gate closes both. A repair is
// only ever bought when the work would ACTUALLY GO BACK TO WORK: hands for it,
// its supplier standing, its ground not built over, timber and stone to be had.
//
// [P-14] note: this walks the ledger rather than a kept set of rotting works. An
// active set would need maintaining by `devolve`, by this function and by every
// future raid that damages a work, to save a property compare on ~20 works once a
// season. It has not earned that; the loop's first test is a single compare.
//
// THE SAME EXEMPTION APPLIES HERE, and it has to, or the rule would be true of
// one verb and false of the next: a sawpit that has rotted is still a work that
// produces materials, and a place that could dig a new one but not put the old
// one back in order would be the cliff again with the sentence reversed. The
// gate is therefore asked per work rather than once at the door.
function mendTurn(town: Town, d: Derived, day: number): Built | null {
  const spare = spareHands(d);

  let best: Work | null = null;
  let bestWorth = 0;
  for (const w of town.works) {
    if (!mendable(town, w)) continue;
    if (!canBuildKind(d.commerce, w.kind)) continue; // no timber, no stone, no repairs either
    if (w.hands > spare) continue; // "he will not mend what nobody can work"
    if (town.wealth < repairCost(w.kind)) continue; // ...nor what he cannot pay for
    const v = worthOf(w);
    // Food first, then guns, then coin — and the elder work on a tie ([P-10]).
    if (best === null || v > bestWorth || (v === bestWorth && w.id < best.id)) {
      best = w;
      bestWorth = v;
    }
  }
  if (best === null) return null;

  town.wealth -= repairCost(best.kind);
  // ONE RUNG UP, to the foot of the ladder. The hands take the last step next
  // season, through the allocator, which stays the only thing that ever writes
  // `working` — a governor buys the repair, he does not conjure the men.
  best.condition = "idle";
  // The idle clock restarts on the day the coin was spent, not on a season
  // counted from the town's own founding.
  best.idleSinceDay = day;
  return { work: best, want: null, day, sentence: describeMend(town, best) };
}

function describeMend(town: Town, w: Work): string {
  const who = town.governor?.trim() ? town.governor : "The governor";
  return `${who} puts ${w.name} back in order — ${MEND_CLAUSE}.`;
}

// One decision per season. The governor builds the best thing he can afford —
// but he HOLDS OUT for something better rather than always buying the cheapest
// option, which is what lets money change what a town becomes and not merely how
// fast it gets there.
export function governorTurn(town: Town, day: number): Built | null {
  // Derived once and handed on ([P-18]): the mend gate and the auction ask the
  // same town the same question, and asking twice is how the two answers start
  // disagreeing.
  const d = derive(town);

  // He puts his own house in order before he raises a new one. Mending is cheaper
  // than building, so this is not a generosity — it is what a governor who could
  // count would do, and it is what keeps the ladder's middle rung a rung.
  const mended = mendTurn(town, d, day);
  if (mended) return mended;

  const ranked = wants(town, day, CHOOSABLE.length, d);

  // He will not raise what nobody can work. A town with money and no men simply
  // waits — and building anyway would just leave a shed to rot, which is exactly
  // the loop this guard exists to prevent.
  //
  // Nor will he raise what there is nothing to raise it WITH. Timber and stone
  // gate construction outright (§3.5.3), which is what makes razing the quay of a
  // stone-poor island a lasting act rather than a season's inconvenience.
  const achievable = ranked.filter((w) => w.manned && w.supplied && w.permitted);
  if (!achievable.length) return null;

  const best = achievable[0]; // what he actually wants
  const now = achievable.find((w) => w.affordable); // ...and what he could start today
  if (!now) return null; // saving up

  // He holds out for the better thing unless something nearly as good is to hand.
  if (now !== best && now.score < best.score * PLAN.settleFor) return null;

  const work = raise(town, now.kind, day);
  if (!work) return null;
  town.wealth -= now.cost;
  return { work, want: now, day, sentence: describeBuild(town, now) };
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
  // The day the season began, days since world epoch. The harness turns it into a
  // year when it writes its journal line; nothing in the sim ever needs one.
  day: number;
  built: Built | null;
  grew: Grew | null;
}

export function stepTownSeason(town: Town, day: number): Season {
  stepSeason(town, day);
  // The town spreads on its own, whatever the governor is minded to build. It is
  // pressure relieved, not a decision taken — so it is not part of the auction.
  const grew = stepFootprint(town);
  return { day, built: governorTurn(town, day), grew };
}

// The same driver as `stepYears`, one layer up: a local day counter handed to
// each season and never written back to the town. See the note there for why the
// starting day is a parameter rather than state.
export function stepTownYears(town: Town, years: number, from = 0): Season[] {
  const out: Season[] = [];
  const seasons = years * CALENDAR.seasonsPerYear;
  for (let i = 0; i < seasons; i++) {
    const s = stepTownSeason(town, from + i * CALENDAR.daysPerSeason);
    if (s.built || s.grew) out.push(s);
  }
  return out;
}
