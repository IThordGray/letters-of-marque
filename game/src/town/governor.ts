// The development plan — what the governor builds next, what he decides his
// ground is FOR, and why he says he did either.
//
// THREE CANDIDATE TYPES, ONE DECISION A SEASON (spec §5.1.1). A five-term
// auction over the capital works; a FOUR-term auction over the town's unfocused
// regions; and a DEEPENING of ground already given over, scored from three
// readings of that region's own ground and from nothing in the catalogue
// ([HC-97]). NO TWO OF THEM SHARE A SCORING PATH, and all three compete for the
// same scarce thing: the season. THE HARD RULE holds across all of them: no term
// without a clause. The one-line reason is assembled from the top two
// contributing terms, so the explanation IS the score rather than a
// rationalisation written afterwards.
//
// Wealth is NOT a term. The score decides what the town wants most; wealth
// decides what it can start now. Keeping those separate is what makes an
// investment slider mean something — and a FOCUS COSTS NO COIN AT ALL
// (§2.12.6), so it is the one candidate the budget gate never touches. A town
// with empty coffers can still decide what its ground is for: deciding is free,
// doing is not.

import type { Town, Work, WorkKind, Need, Archetype, Suit, Derived, Region, Produce } from "./types";
import { key } from "./hex";
import {
  CATALOGUE, CHOOSABLE, FOCUS_EXPRESSIONS, buildable, raise, groundFor, mendable, repairCost, worthOf,
  depthOf, roomInRegion, takenHexes,
} from "./works";
import { compass, LABEL, bornePreference, capacityOf, claimedKeys, isBuildable, regionOf } from "./land";
import { DEPENDENCY_CLAUSE, canBuildKind, fetchOf, cargoOf, dearnessOf } from "./trade";
import { derive, stepSeason } from "./sim";
import { CALENDAR } from "../overworld/calendar";
import { PLAN, FOOTPRINT, WORKS } from "./constants";
import { stepFootprint, crowding, type Grew } from "./footprint";

export type TermKey = "land" | "need" | "market" | "fear" | "agenda";

// [HC-96] THE FOCUS AUCTION IS FOUR-TERMED — land, need, market, agenda — AND
// `fear` IS STRUCTURALLY ABSENT. It stays absent, and this type is how:
// `scoreFocus` returns `FocusTerm[]`, so a `fear` term cannot be pushed onto it
// without the compiler saying no. That is [P-17b]'s shape — there is no argument
// through which the forbidden fact could arrive — and it is deliberately
// stronger than a comment, because the thing being guarded against is somebody
// later reading the five-term auction and "finishing" this one.
//
// WHY, and it is structural rather than a taste call. FEAR NEVER ARGUES FOR WHAT
// GROUND IS FOR. It is a real and correct argument for A BATTERY ON A BLUFF — a
// work, on a hex, answering a threat — and it is already heard there, in
// `scoreWork`. No land use makes a town safer, so a `fear` term here would be
// defence claiming a FOURTH home beside the term, the steer and the defensive
// works themselves, which §2.12.3 refused and [P-47] forbids.
export const FOCUS_TERMS = ["land", "need", "market", "agenda"] as const;
export type FocusTermKey = (typeof FOCUS_TERMS)[number];

export interface Term {
  key: TermKey;
  weight: number; // contribution to the score
  clause: string; // the plain-language reason this term gives
}

// The same shape, narrowed at the key. A `FocusTerm` IS a `Term`, so the two
// auctions share `reasonFrom` and the "explanation is the score" rule is one
// rule with one implementation ([P-47]).
export interface FocusTerm extends Term {
  key: FocusTermKey;
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

// RETIRED WITH ITS MECHANISM, and recorded rather than quietly dropped. There
// used to be a `STARVED_CLAUSE` here — "the shipways want planks", "the boiling
// house wants cane" — and a `PLAN.starvedBonus` that sharpened the market term
// whenever something downstream stood waiting. Both were the DEPENDENCY EDGE
// talking, and §2.12.13 is explicit: deleting the edge deletes the sentence.
// What argues in its place is the market term arguing in COIN — "timber fetches
// well here" (§3.5.4) — and the honest version is to say the sentence is gone
// rather than to fake a survivor out of a different mechanism.

const AGENDA_CLAUSE: Record<Archetype, string> = {
  colony: "the Company wants a return on this place",
  royalOutpost: "the crown wants this place held",
  pirateHaven: "you want a haven that can keep itself",
};

// How much each patron cares about each work ON THE MENU. This is where a royal
// outpost becomes hard-and-poor and a colony becomes rich-and-open — the
// archetypes are agendas, not stat blocks.
//
// THE THREE FOCUS EXPRESSIONS LEFT THIS TABLE WITH THE MENU (§2.12.12), and
// their rows are DELETED rather than left standing: this table is only ever read
// by `scoreWork`, which walks `CHOOSABLE`, so a `sawpit: 0.8` here would be a
// number nothing reads — dead data that reads as a live opinion. A patron's
// opinion about what ground is FOR has its own table, `FOCUS_AGENDA`, and a
// deepening is scored from the region's own ground and from nothing else
// ([HC-97]) — so the agenda speaks about ground exactly once.
export const AGENDA: Record<Archetype, Partial<Record<WorkKind, number>>> = {
  colony: {
    shipway: 0.7, warehouse: 0.9, customsHouse: 0.5, church: 0.5, tavern: 0.4,
    battery: 0.15, palisade: 0.15, barracks: 0.2, // revenue first, defence last
  },
  royalOutpost: {
    battery: 1.0, barracks: 1.0, palisade: 0.8, customsHouse: 0.9, church: 0.6,
    warehouse: 0.4, tavern: 0.3, shipway: 0.3, // it need not earn
  },
  pirateHaven: {
    tavern: 1.0, shipway: 0.9, battery: 0.8, warehouse: 0.8,
    palisade: 0.6, barracks: 0.4, church: 0.2, customsHouse: 0.1, // no crown, no customs
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
//
// IT IS KEYED TO THE PRODUCE, NOT TO A WORK KIND (§5.1.2, re-keyed 2026-09-19).
// The table used to name `provisionGround`, and the collapse takes the per-crop
// menu item away: provision grounds become what a production focus on food
// ground IS, so there would shortly be no kind left to name. Keyed to the
// produce, the SAME rule reads one level up and governs both verbs at once —
//
//     "A military purpose never sets a production focus on food ground."
//
// — so the outpost can no longer fulfil the wish by a side door either. The
// rule, the source and the sentence are unchanged; only the key moved.
//
// [HC-98] AND SUBSISTENCE WORKS STAY OUTSIDE IT ENTIRELY. The outpost keeps its
// garden plots, exactly as today, and that is structural rather than lucky: this
// gate is only ever asked by `wants()`, which walks `CHOOSABLE`, and a
// subsistence work is not in that list. Nothing on the path that raises a garden
// plot can reach this table.
export const OUT_OF_VOCABULARY: Record<Archetype, Partial<Record<Produce, true>>> = {
  colony: {},
  royalOutpost: { food: true }, // it buys its bread with the crown's grant
  pirateHaven: {},
};

// The gate as the WORK auction asks it. A work that grows nothing has no produce
// and is never out of vocabulary — a purpose bans a use of the ground, not a
// building.
export const permits = (town: Town, kind: WorkKind): boolean => {
  const p = CATALOGUE[kind].produces;
  return p === null || OUT_OF_VOCABULARY[town.archetype][p] !== true;
};

// ...and as the FOCUS auction asks it. A production focus is FOR the work a
// deepening on that ground would raise (§2.12.12 — "a deepening raises the work
// the region's best-borne produce implies"), so THAT is the produce the gate is
// asked about, and it is asked through the same `expressionFor` the deepening
// itself uses ([P-47]). A growth focus is never gated: houses are in every
// place's vocabulary.
export const permitsFocus = (town: Town, r: Region, focus: "production" | "growth"): boolean => {
  if (focus === "growth") return true;
  const e = expressionFor(r);
  return e === null || OUT_OF_VOCABULARY[town.archetype][e.produce] !== true;
};

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

  // 3. THE MARKET WANTS IT — it earns WHAT IT WOULD ACTUALLY FETCH HERE.
  //
  //    §3.5.4's second edit to the auction: `trade x priceOf x access` rather
  //    than a flat constant. It is what turns this term from a fact about the
  //    catalogue into an argument about this place — the same warehouse is worth
  //    raising where the traffic is thick and not where it is thin, and a port
  //    whose quay has burned has no market argument for anything at all.
  //
  //    IT IS THE WHOLE OF THE TERM NOW. The `starved` half — a bonus and a
  //    sharper clause when something downstream stood idle for want of this —
  //    was the dependency edge talking, and it retired with the edge.
  const earns = fetchOf(town, kind, d.access) / PLAN.tradeScale;
  if (earns > 0) {
    terms.push({ key: "market", weight: earns * PLAN.weights.market, clause: "there is money in it" });
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
//
// IT TAKES A CLAUSE AND NOTHING ELSE, so all THREE candidate types share one
// implementation ([P-47]) although they are scored by three different rules. A
// deepening's readings multiply rather than sum and it has its own term keys;
// none of that reaches this function, and it should not.
export function reasonFrom(terms: { clause: string }[]): string {
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

// ---- The focus auction (§2.12.9) -------------------------------------------
//
// A REGION HAS A POTENTIAL GIVEN BY ITS GROUND; A FOCUS DECIDES WHAT THE TOWN
// TAKES OFF IT. Production, and the region yields more of what its ground bears.
// Growth, and the ground becomes housing: more people, and the production is
// largely spent. There are exactly two because there are exactly two things a
// population can do with a piece of ground — work it, or live on it.
//
// A FOCUS COSTS NO COIN (§2.12.6). What it costs is the season's one decision
// and the fact that it is forever, and there is deliberately no budget in it.

export const FOCUS_KINDS = ["production", "growth"] as const;
export type FocusKind = (typeof FOCUS_KINDS)[number];

// How much each patron cares about what his ground BECOMES. It is the twin of
// `AGENDA` and deliberately not a second reading of it: whether a place should
// earn or should grow is an opinion in its own right, and no amount of wanting a
// customs house recovers it.
export const FOCUS_AGENDA: Record<Archetype, Record<FocusKind, number>> = {
  colony: { production: 0.9, growth: 0.4 }, // the Company wants a return
  royalOutpost: { production: 0.3, growth: 0.2 }, // it need not earn, and it need not swell
  pirateHaven: { production: 0.6, growth: 0.8 }, // a haven wants hands, and somewhere to put them
};

// The capital work a produce implies — read OFF THE CATALOGUE rather than listed
// beside it ([P-47]), because the catalogue already answers "which work grows
// cane". Built once at module load, never per call ([P-18]).
//
// IT WALKS THE FOCUS EXPRESSIONS AND NOT THE MENU, and after §2.12.12 those are
// the same three works it always found: a produce implies the work that stands
// on ground bearing it, which is exactly what a focus expression is.
//
// FOUR OF THE WORLD'S EIGHT PRODUCES STILL HAVE NO WORK AT ALL — `grain`,
// `cotton`, `stone`, `salt`. That is §2.12.14's measured finding seen from
// inside the code, and closing it is story 5's business (`grainFields` and
// `cottonWalk` arrive as focus expressions, so the menu does not lengthen).
const WORK_FOR_PRODUCE: Partial<Record<Produce, WorkKind>> = (() => {
  const out: Partial<Record<Produce, WorkKind>> = {};
  for (const k of FOCUS_EXPRESSIONS) {
    const p = CATALOGUE[k].produces;
    if (p && out[p] === undefined) out[p] = k;
  }
  return out;
})();

// WHAT A DEEPENING ON THIS GROUND WOULD ACTUALLY RAISE, and the reason it is one
// function ([P-47]): three different readers ask it — the purpose gate, the
// focus auction's market term and the deepening itself — and if any two of them
// disagreed the governor could give ground over for one reason and then work it
// for another. A royal outpost that read `bestBorne` alone would be the live
// case: tilled ground bears GRAIN best and FOOD second, grain has no work, so
// the gate would pass the focus ("grain is not on his forbidden list") and the
// deepening would then raise provision grounds on it — a farm in a place whose
// whole purpose forbids one.
//
// SO IT IS "THE BEST-BORNE PRODUCE THE CATALOGUE CAN EXPRESS", not simply the
// best-borne. §2.12.12's sentence is "a deepening raises the work the region's
// best-borne produce implies", and a produce that implies no work implies
// nothing — the ground's next-best answer is then the ground's answer. It
// closes over story 5 by itself: the day `grainFields` exists, grain is
// expressible and tilled ground's first answer becomes its real one.
export function expressionFor(r: Region): { kind: WorkKind; produce: Produce; suit: Suit } | null {
  const ranked = bornePreference(r);
  for (let i = 0; i < ranked.length; i++) {
    const kind = WORK_FOR_PRODUCE[ranked[i].produce];
    if (kind !== undefined) return { kind, produce: ranked[i].produce, suit: ranked[i].suit };
  }
  return null;
}

// WHAT A PRODUCE IS CALLED IN A SENTENCE, and one table for both places that
// need one ([P-47]). `food` is the ledger's COLUMN name and nobody gives ground
// over to "food" — the module's own voice has said "too much of their bread
// comes off a ship" since §3.5.4, so bread it is, in the clause and in the
// sentence alike. Everything else is already the word a person would use.
const PRODUCE_WORD: Record<Produce, string> = {
  food: "bread",
  fish: "fish",
  grain: "grain",
  timber: "timber",
  stone: "stone",
  cane: "cane",
  cotton: "cotton",
  salt: "salt",
};

// The land's argument for HOUSES: §2.12.7's own words. Dead ground now pays a
// fourth time — it is the only ground a town can grow on for nothing.
const NOTHING_OFF_IT = "nothing else was ever coming off that ground";

// The town's argument for houses. It is the focus's OWN sentence and not
// `NEED_CLAUSE.shelter`, and the difference is the point: "people are sleeping
// rough" is a complaint about DWELLINGS, which raise themselves for free; this
// is a complaint about GROUND, which does not.
const NOWHERE_TO_SLEEP = "there is nowhere left for people to sleep";

// Why a focus can no longer be changed. [HC-16] holds even for a decision that
// comes to nothing, and both of these are said in the ground's own terms.
export const HOUSES_ON_IT = "there are houses on it now";
export const GIVEN_OVER = "it is given over, and that is not taken back";

// WHAT A GOVERNOR MAY NO LONGER DECIDE ABOUT THIS GROUND, and why — or `null`
// while it is still a question. ONE FUNCTION ([P-47]): the filter that refuses a
// candidate and the sentence that says why are the same call, so no governor can
// ever be refused for a reason nobody can read.
//
// [HC-95], AS NARROWED BY THE HUMAN 2026-09-19, AND THE TWO HALVES LOCK FOR
// DIFFERENT REASONS:
//
//  * A PRODUCTION focus is set once and never changed, full stop. That is
//    structural rather than a preference: the case for reversing one rested
//    entirely on its works idling and ROTTING as the reversal cost, and [HC-99]
//    deletes rot — so a reversible production focus would cost nothing to lift
//    and could be flipped back the next season, which is exactly the instant
//    dial this whole direction exists to avoid.
//  * A GROWTH focus needs no rule of its own, and that is why it is narrower. It
//    INHERITS its permanence from one the model already has — claiming is
//    permanent, with no exception — so it may be redirected while nothing has
//    happened on the ground and locks the moment the first hex is built on,
//    because THAT HEX is. No new state and no threshold: the condition is a
//    question the footprint already answers.
//
// Each rule locks at the instant its own cost becomes real, and neither needed
// inventing.
//
// [P-18]: the claimed set is handed in by a caller asking about several regions,
// exactly as `capacityOf` takes it. It matters more here than it looks — this
// runs every season of every town FOR EVER, long after the last focus is set,
// and `isClaimed` builds two strings per hex-against-claim comparison.
export function focusLock(town: Town, r: Region, claimed = claimedKeys(town)): string | null {
  if (r.focus === "production") return GIVEN_OVER;
  if (r.focus === "growth") return r.hexes.some((h) => claimed.has(key(h))) ? HOUSES_ON_IT : null;
  return null;
}

export interface FocusWant {
  region: number; // the region's ID, not its index — a handle, never a reference ([P-37])
  focus: FocusKind;
  produce: Produce | null; // what a production focus would be FOR; `null` for growth
  label: string; // "the timbered hills"
  where: string; // " to the north"
  score: number;
  terms: FocusTerm[]; // strongest first
  reason: string; // assembled from the top two, exactly as a work's is
  // He had marked this ground for houses and has changed his mind, which [HC-95]
  // allows only while nothing has been built on it. The sentence says so.
  redirects: boolean;
}

// Does this region still carry a work somebody CHOSE? A region that does is an
// INSTANCE and not a kind — free area partly spent, a suit already bought, a
// premium already owed, and its scaled trade figure standing on the ground — so
// scoring it from the catalogue would be the second path [P-47] names and
// KAN-108 ended on ([HC-97]). Such a region is a DEEPENING, and a deepening is
// scored from that region's own ground, beside this auction rather than in it.
//
// SUBSISTENCE WORKS DELIBERATELY DO NOT COUNT, and that is [HC-98] read from the
// other end: a garden plot is never chosen, never priced and never gated, so it
// claims no purpose for the ground it stands on. Measured on the warm world, the
// difference is not a nicety — counting them leaves a MEDIAN OF ONE unfocused
// live region per town (75 of 213 across 49 places), which is not "most of its
// live regions" under any reading.
const carriesChosenWork = (town: Town, index: number): boolean => {
  for (let i = 0; i < town.works.length; i++) {
    const w = town.works[i];
    if (w.region === index && w.condition !== "ruin" && CATALOGUE[w.kind].cls === "capital") return true;
  }
  return false;
};

// HOW BADLY THE TOWN NEEDS GROUND TO PUT PEOPLE ON, 0..1. Two things say it and
// they are one want: the shelter need, which only bites where dwellings cannot
// be raised at all, and CROWDING, which is the footprint's own measure of a town
// with no room left in it. The greater of the two, because it is the same
// complaint arriving by two roads — and ONE clause, because [HC-16] asks for a
// sentence and not an audit.
const growthPressure = (town: Town, d: Derived): number => {
  const packed = crowding(town) / FOOTPRINT.crowdedAt;
  const pressure = packed > 1 ? 1 : packed;
  return d.needs.shelter > pressure ? d.needs.shelter : pressure;
};

// FOUR TERMS, AND THE FIFTH IS NOT MISSING — it was never invited ([HC-96]).
export function scoreFocus(
  town: Town,
  r: Region,
  focus: FocusKind,
  derived = derive(town),
  claimed = claimedKeys(town),
): FocusTerm[] {
  const d = derived;
  const terms: FocusTerm[] = [];
  // WHAT THE TOWN WOULD ACTUALLY TAKE OFF IT, not simply what the ground bears
  // best. The two differ wherever a region's finest produce has no work — tilled
  // ground bears grain best and food second — and scoring the focus from one
  // while the deepening raises the other is the disagreement `expressionFor`
  // exists to prevent (§2.12.12). It is the same call all three readers make.
  const best = expressionFor(r);
  // AREA IS THE RATIO ([HC-94]). A focus buys CAPACITY, never a multiplier, so
  // the land's voice is how well the ground bears TIMES how much of it is still
  // free. §2.3's budgeted, skewed region sizes have until now paid off only in
  // prose; this is where they start paying in the economy.
  const free = capacityOf(town, r, claimed);
  const depth = free >= PLAN.focusDeepAt ? 1 : free / PLAN.focusDeepAt;

  if (focus === "production") {
    // 1. THE LAND CALLS FOR IT — and the clause says whichever of the two
    //    arguments is the louder: the ground was made for it, or there is a
    //    great deal of it.
    if (best) {
      terms.push({
        key: "land",
        weight: PLAN.affinity[best.suit] * depth * PLAN.weights.land,
        clause: depth >= 0.5 ? `there is depth in the ${LABEL[r.terrain]}` : SUIT_CLAUSE[best.suit](LABEL[r.terrain]),
      });
    }

    // 2. THE TOWN WANTS IT. On food ground the want is [HC-81]'s and is scored
    //    IDENTICALLY for every place, whatever its purpose — a royal outpost
    //    hears it at full volume and may not act on it, which is the whole of
    //    what purpose changes (§5.1.2).
    if (best && best.produce === "food" && d.needs.food > 0) {
      terms.push({ key: "need", weight: d.needs.food * PLAN.weights.need, clause: DEPENDENCY_CLAUSE });
    }

    // 3. THE MARKET WANTS IT, and it argues IN COIN about THIS place (§3.5.4) —
    //    the same ground is worth giving over where timber is dear and not where
    //    it is cheap, and a port whose quay has burned has no market argument for
    //    anything at all.
    if (best) {
      const earns = fetchOf(town, best.kind, d.access) / PLAN.tradeScale;
      if (earns > 0) {
        terms.push({ key: "market", weight: earns * PLAN.weights.market, clause: `${PRODUCE_WORD[best.produce]} fetches well here` });
      }
    }
  } else {
    // 1. THE LAND CALLS FOR IT — and for houses the land argues by having
    //    nothing else to give. A town with scrub to the north can be BOTH a big
    //    town and a timber town; a town ringed by cane must choose.
    const spare = 1 - (best ? PLAN.affinity[best.suit] : 0);
    if (spare > 0) terms.push({ key: "land", weight: spare * depth * PLAN.weights.land, clause: NOTHING_OFF_IT });

    // 2. THE TOWN WANTS IT.
    const pressure = growthPressure(town, d);
    if (pressure > 0) terms.push({ key: "need", weight: pressure * PLAN.weights.need, clause: NOWHERE_TO_SLEEP });

    // 3. THE MARKET HAS NOTHING TO SAY ABOUT HOUSES. Trade has no ground to
    //    stand on (§2.12.3) and a hex of dwellings fills no hold. The term is
    //    ABSENT rather than zero: a term that says nothing is not a term.
  }

  // 4. THE PATRON'S AGENDA — whoever pays has an opinion about what the ground
  //    is for, and it is the only term that speaks for both focuses.
  const agenda = FOCUS_AGENDA[town.archetype][focus];
  if (agenda > 0) {
    terms.push({ key: "agenda", weight: agenda * PLAN.weights.agenda, clause: AGENDA_CLAUSE[town.archetype] });
  }

  // [P-10]: a total order with an explicit tie-break, and its direction is the
  // order the terms are NAMED in — land, need, market, agenda — so two terms of
  // equal weight always write their clauses the same way round.
  return terms.sort((a, b) => b.weight - a.weight || FOCUS_TERMS.indexOf(a.key) - FOCUS_TERMS.indexOf(b.key));
}

// WHICH GROUND IS STILL A QUESTION, and the three conditions are three different
// rules:
//
//  * IT MUST BE A CHANGE. `focusLock` has already refused everything permanent;
//    what is left is unfocused ground (either focus) and an unbuilt growth focus
//    (production, which is the redirection [HC-95] allows).
//  * PRODUCTION NEEDS GROUND THE TOWN CAN ACTUALLY WORK. Dead ground gives
//    nothing to focus on, and "the Company wants a return on this place" is not
//    on its own a reason to give scrub over to industry. IT ASKS
//    `expressionFor` RATHER THAN `bestBorne`, and the difference is the whole of
//    KAN-125's acceptance: ground that bears only cotton, grain, stone or salt
//    has no work in the catalogue yet (§2.12.14), so giving it over to
//    production would buy a decision nothing could ever act on — a region
//    focused and permanently empty, which is precisely what this story exists
//    to end. It re-opens by itself when story 5 gives those produces works.
//  * HOUSES NEED GROUND THAT WILL TAKE THEM. A growth focus acts entirely
//    through `nextHex` (§2.12.7), which never claims water or mangrove, so a
//    growth focus on either would be a decision with no consequence at all.
const offers = (town: Town, r: Region, index: number, focus: FocusKind): boolean => {
  if (r.focus === focus) return false;
  if (carriesChosenWork(town, index)) return false;
  return focus === "production" ? expressionFor(r) !== null : isBuildable(r.terrain);
};

// "the cane flats", but "a high bluff" brought its own article.
const theGround = (r: Region): string =>
  LABEL[r.terrain].startsWith("a ") ? LABEL[r.terrain] : `the ${LABEL[r.terrain]}`;

// The focus wants-list, published for the same reason the work one is: the sim
// is INSPECTABLE WITHOUT BEING CONTROLLABLE.
export function focusWants(town: Town, derived = derive(town), limit = 3): FocusWant[] {
  const d = derived;
  // [P-18]: the claimed set cannot change while the auction runs, so it is built
  // once and handed to every region rather than rebuilt per candidate.
  const claimed = claimedKeys(town);
  const out: FocusWant[] = [];
  for (let i = 0; i < town.regions.length; i++) {
    const r = town.regions[i];
    if (focusLock(town, r, claimed) !== null) continue; // set once, and never taken back
    for (let f = 0; f < FOCUS_KINDS.length; f++) {
      const focus = FOCUS_KINDS[f];
      if (!offers(town, r, i, focus)) continue;
      if (!permitsFocus(town, r, focus)) continue;
      const terms = scoreFocus(town, r, focus, d, claimed);
      const score = terms.reduce((s, t) => s + t.weight, 0);
      if (score <= 0) continue;
      const best = focus === "production" ? expressionFor(r) : null;
      out.push({
        region: r.id,
        focus,
        produce: best ? best.produce : null,
        label: theGround(r),
        where: ` to the ${compass(r.bearing)}`,
        score,
        terms,
        reason: reasonFrom(terms),
        redirects: r.focus === "growth",
      });
    }
  }
  // [P-10]: a total order with a stated direction all the way down — the loudest
  // argument, then the elder ground, then WORK IT BEFORE YOU LIVE ON IT, which
  // is the same order `worthOf` ranks works by and the same order [HC-78] pays
  // the bills in.
  out.sort(
    (a, b) =>
      b.score - a.score ||
      a.region - b.region ||
      FOCUS_KINDS.indexOf(a.focus) - FOCUS_KINDS.indexOf(b.focus),
  );
  return out.slice(0, limit);
}

export function describeFocus(town: Town, want: FocusWant): string {
  const who = town.governor?.trim() ? town.governor : "The governor";
  const over = want.produce === null ? "the town" : PRODUCE_WORD[want.produce];
  const instead = want.redirects ? " instead" : "";
  return `${who} gives ${want.label}${want.where} over to ${over}${instead} — ${want.reason}.`;
}

// ---- The deepening (§2.12.10) ----------------------------------------------
//
// THE THIRD CANDIDATE TYPE, and it exists because of the sharpest thing in §2.12.
//
// [HC-97] A DECISION ABOUT A REGION THAT ALREADY CARRIES WORKS IS SCORED FROM
// THAT REGION'S OWN GROUND — `potential x free capacity x local price` — NEVER
// FROM THE CATALOGUE'S FIGURES FOR A KIND. The five terms score a KIND: the land
// term reads the best FREE ground and the market term reads `CATALOGUE[kind].
// trade`, which is the UNSCALED figure. A region already holds the scaled one —
// its suit is bought, its reach is priced into what stands there, its premium is
// owed — so the two disagree the moment ground, reach or depth differs from the
// default, WHICH IS ALWAYS. That is the second path [P-47] names and KAN-108
// ended on, and nothing below reads a `trade` figure out of the catalogue.
//
// AND THE SECOND HALF OF THE TRAP, also KAN-108's: THE AUCTION CANNOT ALWAYS SEE
// THE WANT. While works hold a region's hexes its free capacity falls, and since
// the auction may only ever put the FIRST work on a region ([HC-94]) the kind
// drops out of the wants-list ENTIRELY the moment one stands there — so the very
// thing that creates the need to deepen is the thing that hides it. A deepening
// therefore has to be its own candidate with its own scoring path, and can never
// be a work that happens to be re-offered.

export const DEEP_TERMS = ["ground", "room", "market"] as const;
export type DeepTermKey = (typeof DEEP_TERMS)[number];

// The same shape as a `Term` and a different key set, for the same reason
// `FocusTerm` narrows rather than widens: a `fear` or a `need` cannot be pushed
// onto this list without the compiler saying no ([P-17b]).
export interface DeepTerm {
  key: DeepTermKey;
  weight: number; // 0..1 — a FACTOR here, because the readings multiply
  clause: string;
}

export interface DeepWant {
  region: number; // the region's ID, not its index — a handle ([P-37])
  kind: WorkKind; // the work the region's best-borne produce implies (§2.12.12)
  produce: Produce;
  label: string; // "the timbered hills"
  where: string; // " to the north"
  score: number;
  terms: DeepTerm[]; // strongest factor first
  reason: string; // assembled from the top two, exactly as the other two are
  depth: number; // what already stands there — COUNTED, never stored ([HC-93])
  room: number; // ...and how much of its own ground is left
  cost: number;
  affordable: boolean;
  manned: boolean;
  supplied: boolean;
  permitted: boolean;
}

// WHAT THE GROUND HAS ALREADY SHOWN IT WILL BEAR, said in its own terms. It is
// the past tense on purpose: this is ground with works on it, and the governor
// is arguing from what they have done rather than from what a catalogue says a
// sawpit is worth.
// IT SAYS "THAT GROUND" RATHER THAN NAMING THE TERRAIN, and that is grammar
// rather than style: the sentence around it has already said which stretch, and
// the labels are a mix of plurals and mass nouns — "the timbered hills already
// bear" and "the tilled ground already bear" cannot both be written with one
// verb. A singular subject agrees with every one of them, and a table of
// plurals to fix it would be a table earning nothing.
const PROVED_CLAUSE: Record<Suit, (produce: string) => string> = {
  ideal: (p) => `that ground already bears ${p} well`,
  fair: (p) => `that ground bears ${p} well enough`,
  poor: (p) => `that ground grudges its ${p}, but bears it`,
};

// The other half of the brief's own sentence — "the north hills already saw
// well, AND THERE IS ROOM FOR MORE". It is one clause however much room there
// is, because [HC-16] asks for a sentence and not an audit.
export const ROOM_FOR_MORE = "there is room for more";

// THE THREE READINGS MULTIPLY, AND THAT IS NOT A STYLISTIC CHOICE. §2.12.10
// writes the score as a PRODUCT, and the product is what makes the area cap bite
// in the scoring as well as in the ground: a region with no room left is worth
// NOTHING to deepen, not merely less, and no amount of dear timber recovers it.
// A sum would let a full region keep arguing for ever, which is the overshoot
// engine [HC-75] exists to watch for, wearing an auction's clothes.
export function scoreDeepening(
  town: Town,
  r: Region,
  index: number,
  kind: WorkKind,
  produce: Produce,
  suit: Suit,
  taken: Set<string>,
  claimed: Set<string>,
): DeepTerm[] {
  // 1. POTENTIAL — what THIS ground bears and how well, plus the one other fact
  //    the region itself holds about what it pays: ground over the ridge yields
  //    a little less, and it yields a little less however many works stand on it.
  const potential = PLAN.affinity[suit] * (r.reach === "far" ? WORKS.farPenalty : 1);

  // 2. FREE CAPACITY — how much of its own ground is left. This is the term the
  //    cap lives in, and it is not a separate number: it is the hexes.
  const room = roomInRegion(town, r, index, kind, "deepen", taken, claimed);
  const capacity = room >= PLAN.focusDeepAt ? 1 : room / PLAN.focusDeepAt;

  // 3. LOCAL PRICE — what this place would get for it, and nowhere else's price
  //    exists to be read ([HC-82]). Note what is NOT here: the catalogue's trade
  //    figure for a sawpit. The region is an instance and the figure is a kind's.
  const cargo = cargoOf(kind);
  const price = cargo === null ? 0 : dearnessOf(town, cargo);

  const word = PRODUCE_WORD[produce];
  const terms: DeepTerm[] = [
    { key: "ground", weight: potential, clause: PROVED_CLAUSE[suit](word) },
    { key: "room", weight: capacity, clause: ROOM_FOR_MORE },
    { key: "market", weight: price, clause: `${word} fetches well here` },
  ];
  // [P-10]: a total order with an explicit tie-break, and its direction is the
  // order the readings are NAMED in — ground, room, market.
  return terms.sort((a, b) => b.weight - a.weight || DEEP_TERMS.indexOf(a.key) - DEEP_TERMS.indexOf(b.key));
}

// The product, put on the same footing as the two auctions it competes with.
export function deepScore(terms: DeepTerm[]): number {
  let out = PLAN.deepenVoice;
  for (let i = 0; i < terms.length; i++) out *= terms[i].weight;
  return out;
}

// The deepening wants-list, published for the same reason the other two are: the
// sim is INSPECTABLE WITHOUT BEING CONTROLLABLE (§5.3).
export function deepWants(town: Town, derived = derive(town), limit = 3): DeepWant[] {
  const d = derived;
  // [P-18]: neither set can change while the auction runs, so both are built
  // once and handed to every region rather than rebuilt per candidate.
  const taken = takenHexes(town);
  const claimed = claimedKeys(town);
  const spare = spareHands(d);
  const out: DeepWant[] = [];
  for (let i = 0; i < town.regions.length; i++) {
    const r = town.regions[i];
    // ONLY GROUND SOMEBODY GAVE OVER. [HC-94]: unfocused ground carries a token
    // work and never becomes an industry, so there is nothing here to offer —
    // and ground marked for HOUSES is being spent, not worked.
    if (r.focus !== "production") continue;
    // ...AND AT ANY DEPTH, INCLUDING NONE. THIS IS THE LARGER HALF OF KAN-125.
    //
    // KAN-124 refused a region with nothing standing on it — "a region with
    // nothing on it is still a kind-like question and belongs to the five-term
    // auction, which reads its best FREE ground quite legitimately" — and that
    // was reasonable in isolation and WRONG IN SEQUENCE. §2.12.12 takes the
    // three crops off the menu, so the five-term auction has nothing left to
    // offer that could stand on what the ground bears, and focused ground with
    // no work on it had no way to get a first one at all. Measured before the
    // change: 260 of 369 production-focused live regions across four warm worlds
    // were focused and EMPTY.
    //
    // So a deepening now STARTS a region as well as extending one, and the two
    // changes ship together or not at all. The general lesson, recorded in
    // §11's story 4: WHEN A STORY REMOVES THE ONLY PRODUCER OF SOMETHING, CHECK
    // IN THE SAME BREATH WHAT IS LEFT TO PRODUCE IT.
    //
    // NOTHING ELSE ABOUT THE CANDIDATE CHANGES. It is still scored from that
    // region's own ground and never from the catalogue ([HC-97]): at depth 0 the
    // potential is the ground's suit, the room reading is its whole free area,
    // and the premium `raise` mints is `depthPremium(0)` — exactly 1, which is
    // what the first work on any ground has always been worth.
    const depth = depthOf(town, i);
    // What this ground would actually bear a work of, which is the same call the
    // focus auction made when it gave the ground over ([P-47]).
    const best = expressionFor(r);
    if (!best) continue;
    const kind = best.kind;
    // NO PER-TOWN LIMIT IS ASKED ABOUT HERE, and its absence is a decision
    // rather than an omission: `CATALOGUE[kind].max` is `Infinity` on a focus
    // expression, because the cap on ground given over is the region's own area
    // ([HC-94]) and a second cap beside it would be [P-47]'s second source. What
    // refuses a full region is the room reading, below, which is zero — and zero
    // times anything is zero.
    const room = roomInRegion(town, r, i, kind, "deepen", taken, claimed);
    const terms = scoreDeepening(town, r, i, kind, best.produce, best.suit, taken, claimed);
    const score = deepScore(terms);
    // THE GROUND BEING SPENT IS NOT A SEPARATE GATE, and deliberately not: a
    // full region's capacity reading is zero, and zero times anything is zero,
    // so the product refuses it here. An `if (room <= 0) continue` above this
    // line said the same thing twice — it survived mutation for exactly that
    // reason, and a rule stated twice is a rule no test can break ([P-1]).
    if (score <= 0) continue;
    const def = CATALOGUE[kind];
    out.push({
      region: r.id,
      kind,
      produce: best.produce,
      label: theGround(r),
      where: ` to the ${compass(r.bearing)}`,
      score,
      terms,
      reason: reasonFrom(terms),
      depth,
      room,
      cost: def.cost,
      affordable: town.wealth >= def.cost,
      manned: def.hands <= spare,
      supplied: canBuildKind(d.commerce, kind),
      permitted: permits(town, kind),
    });
  }
  // [P-10]: the loudest argument, then the elder ground.
  out.sort((a, b) => b.score - a.score || a.region - b.region);
  return out.slice(0, limit);
}

export function describeDeepening(town: Town, want: DeepWant): string {
  const who = town.governor?.trim() ? town.governor : "The governor";
  return `${who} sets more ${CATALOGUE[want.kind].label} in ${want.label}${want.where} — ${want.reason}.`;
}

// ---- Building --------------------------------------------------------------

export interface Built {
  kind: "work";
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

// What he decided instead, when what the season bought was a DIRECTION rather
// than a building. It carries no work, because none was raised and none will be
// this season — which is the honest shape of a decision that costs no coin.
export interface Focused {
  kind: "focus";
  region: number; // the region's ID
  focus: FocusKind;
  want: FocusWant;
  day: number;
  sentence: string;
}

// ...and what he decided when the season bought MORE OF WHAT HE ALREADY HAS. It
// carries a work like a `Built` does and a region like a `Focused` does, because
// a deepening is exactly the thing between them: a work raised on ground whose
// purpose was settled seasons ago (§2.12.10).
export interface Deepened {
  kind: "deepening";
  work: Work;
  region: number; // the region's ID
  want: DeepWant;
  day: number;
  sentence: string;
}

// THE SEASON'S ONE DECISION, whichever kind it turned out to be (§5.1.1). THREE
// candidate types that never share a scoring path, competing for the one thing
// that is actually scarce.
// `kind` is the discriminant and the only one: a reader asks `d.kind === "work"`
// and the compiler narrows. No `isBuilt`/`isFocused` helpers, because nothing
// outside a test would have called them.
export type Decision = Built | Focused | Deepened;

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
  return { kind: "work", work: best, want: null, day, sentence: describeMend(town, best) };
}

function describeMend(town: Town, w: Work): string {
  const who = town.governor?.trim() ? town.governor : "The governor";
  return `${who} puts ${w.name} back in order — ${MEND_CLAUSE}.`;
}

// WHAT HE WOULD ACTUALLY START THIS SEASON, once every gate has had its say —
// or nothing, and the nothing has three different causes.
//
// ONE FUNCTION FOR BOTH THINGS A GOVERNOR CAN START ([P-47]). The two candidate
// types are SCORED by rules that share no line; the GATES they then pass are the
// same four gates and "he holds out for the better thing" is the same rule, so
// writing it twice would be two copies free to drift. What arrives here is
// already ranked by its own auction, and this function cannot see which.
//
// He will not raise what nobody can work. A town with money and no men simply
// waits — building anyway would leave a shed to rot, which is the loop this
// guard exists to prevent. Nor will he raise what there is nothing to raise it
// WITH: timber and stone gate construction outright (§3.5.3), which is what
// makes razing the quay of a stone-poor island a lasting act.
interface Startable {
  score: number;
  affordable: boolean;
  manned: boolean;
  supplied: boolean;
  permitted: boolean;
}

function startable<T extends Startable>(ranked: T[]): T | null {
  const achievable = ranked.filter((w) => w.manned && w.supplied && w.permitted);
  if (!achievable.length) return null;

  const best = achievable[0]; // what he actually wants
  const now = achievable.find((w) => w.affordable); // ...and what he could start today
  if (!now) return null; // saving up

  // He holds out for the better thing unless something nearly as good is to hand.
  if (now !== best && now.score < best.score * PLAN.settleFor) return null;
  return now;
}

const workTurn = (town: Town, day: number, d: Derived): Want | null =>
  startable(wants(town, day, CHOOSABLE.length, d));

const deepenTurn = (town: Town, d: Derived): DeepWant | null =>
  startable(deepWants(town, d, town.regions.length));

// WHICH CANDIDATE TAKES THE SEASON when both auctions have something to say.
// HOISTED OUT OF `governorTurn`'S CONDITION ([P-48]): it is a rule, not a
// comparison, and a rule inside a loop condition is a rule no other reader can
// see and no test can reach.
//
// AND IT IS REACHED IN ORDINARY PLAY, which is why it earns a name. A tie here
// is not a float coincidence: `AGENDA.colony.tavern` and
// `FOCUS_AGENDA.colony.growth` are the same weight, and the need term saturates
// for both a town with no tavern and a town with nowhere to put people — so two
// candidates of different KINDS land on exactly the same sum. Measured on a
// mixed town's first season: four tied pairs.
//
// [P-10]'S STATED DIRECTION, AND IT IS NOW TWO STEPS RATHER THAN ONE:
//
//   A THING RAISED OVER A THING DECIDED. A focus is free; if it could take the
//   season on a tie it would take every tie for ever, and a rule that settles
//   nothing is not a tie-break.
//
//   A NEW THING OVER MORE OF AN OLD ONE. Both a work and a deepening are things
//   raised and paid for, so the tie between THEM needs its own direction: a town
//   with no tavern at all wants a tavern more than it wants a fourth sawpit. It
//   also leans the safe way on [HC-75] — the tie never goes to the candidate
//   that makes the region deeper.
//
// An absent candidate arrives as 0, which every real score is above.
export const takesTheSeason = (work: number, deepening: number, focus: number): "work" | "deepening" | "focus" =>
  work >= deepening && work >= focus ? "work" : deepening >= focus ? "deepening" : "focus";

// One decision per season. The governor builds the best thing he can afford —
// but he HOLDS OUT for something better rather than always buying the cheapest
// option, which is what lets money change what a town becomes and not merely how
// fast it gets there.
//
// AND SOME SEASONS HE BUILDS NOTHING AND DECIDES SOMETHING INSTEAD. A focus and
// a work are the two candidate types of §5.1.1: scored by different rules, never
// sharing a path, and competing for the one thing that is scarce. A focus costs
// no coin, so the budget gate never touches it — which is why a town with empty
// coffers can still decide what its ground is for.
export function governorTurn(town: Town, day: number): Decision | null {
  // Derived once and handed on ([P-18]): the mend gate and both auctions ask the
  // same town the same question, and asking twice is how the answers start
  // disagreeing.
  const d = derive(town);

  // He puts his own house in order before he raises a new one. Mending is cheaper
  // than building, so this is not a generosity — it is what a governor who could
  // count would do, and it is what keeps the ladder's middle rung a rung.
  const mended = mendTurn(town, d, day);
  if (mended) return mended;

  const focus = focusWants(town, d, 1)[0] ?? null;
  const work = workTurn(town, day, d);
  const deep = deepenTurn(town, d);
  if (work === null && deep === null && focus === null) return null;

  const takes = takesTheSeason(work?.score ?? 0, deep?.score ?? 0, focus?.score ?? 0);

  if (work !== null && takes === "work") {
    const raised = raise(town, work.kind, day);
    if (!raised) return null;
    town.wealth -= work.cost;
    return { kind: "work", work: raised, want: work, day, sentence: describeBuild(town, work) };
  }

  if (deep !== null && takes !== "focus") {
    const r = regionOf(town, deep.region);
    if (!r) return null;
    // THE SAME MINT AS EVERY OTHER WORK, through the one door a deepening has:
    // `raise` is handed the region the governor named rather than left to find
    // the best FREE ground for the kind. The rising-returns premium is minted
    // inside it, into the new line only ([HC-97], §2.12.5).
    const raised = raise(town, deep.kind, day, r);
    if (!raised) return null;
    town.wealth -= deep.cost;
    return { kind: "deepening", work: raised, region: r.id, want: deep, day, sentence: describeDeepening(town, deep) };
  }

  if (focus !== null) {
    const r = regionOf(town, focus.region);
    if (!r) return null;
    // The one write. Nothing is spent, nothing is raised, and nothing but
    // `nextHex` and this auction will read it — which is exactly the shape a
    // decision about what ground is FOR should have.
    r.focus = focus.focus;
    return { kind: "focus", region: r.id, focus: focus.focus, want: focus, day, sentence: describeFocus(town, focus) };
  }

  return null;
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
  // WHAT THE SEASON'S ONE DECISION CAME TO — a work raised, a work mended, a
  // stretch of ground given a purpose, or ground already given over worked
  // deeper. It was `built: Built | null` until the focus auction landed beside
  // the work auction; one field rather than three, because they are one decision
  // and a season can only hold one of them.
  decided: Decision | null;
  grew: Grew | null;
}

export function stepTownSeason(town: Town, day: number): Season {
  stepSeason(town, day);
  // The town spreads on its own, whatever the governor is minded to build. It is
  // pressure relieved, not a decision taken — so it is not part of the auction.
  const grew = stepFootprint(town);
  return { day, decided: governorTurn(town, day), grew };
}

// The same driver as `stepYears`, one layer up: a local day counter handed to
// each season and never written back to the town. See the note there for why the
// starting day is a parameter rather than state.
export function stepTownYears(town: Town, years: number, from = 0): Season[] {
  const out: Season[] = [];
  const seasons = years * CALENDAR.seasonsPerYear;
  for (let i = 0; i < seasons; i++) {
    const s = stepTownSeason(town, from + i * CALENDAR.daysPerSeason);
    if (s.decided || s.grew) out.push(s);
  }
  return out;
}
