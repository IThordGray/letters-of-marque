// The trading engine, town side — WEALTH IS EARNED, NOT EMITTED.
//
// A town buys what it needs and sells what it has spare. Its wealth is the
// difference. This file is the town's half of that: what it made, what its own
// people take, what therefore reaches the quay in each direction, and what the
// shipping cost it. The other half — who it trades WITH, and at what price — is
// the world's, and arrives as an input ([HC-71], [HC-72]).
//
//   yield = SUM(sold x price x access) + the quay's cut of that traffic
//           + grant - imports paid - upkeep
//
// THE SECOND TERM USED TO BE A STANDING ALLOWANCE and is now a share of what
// actually crossed (KAN-132) — see `quaysideOf`. It is the only place in the
// ledger where coin appeared without a cargo behind it, which made it the
// largest breach of [HC-47] in the model.
//
// SINCE 2026-09-28 THE MARKET TRADES NAMED GOODS. The three classes survive as
// the TIER a good belongs to — see `GOODS` — so every rule below that speaks of
// a class is now a rule about a tier, and the only thing that changed under them
// is that a town's quay says GRAIN and TIMBER rather than "victuals" and
// "materials". Every tier total is the number it was.
//
// [HC-76] ONE UNIVERSAL DRIVE, NO THRESHOLD. Every place produces and consumes
//         in all three tiers and tries to cover its own. What differs between
//         a hamlet and a city is only WHICH need they fail to cover locally —
//         a hamlet feeds itself easily and cannot make its own tools; a city
//         cannot feed itself at all. There is no "big places import" rule.
// [HC-77] THE PYRAMID GATE. A place reaches for a tier only once the tier below
//         is secure — and mechanically that is not a modifier, it decides
//         whether a demand EXISTS. A place short of bread registers no demand
//         for materials or luxury, however rich. The gate lives in the clearing
//         (overworld/market.ts), because it can only be applied in tier order —
//         and it is asked of the TIER while the clearing itself reads goods.
// [HC-85] `access` gates participation BOTH WAYS. No quay, no security and
//         nothing moves either direction — which is why raiding and trade are
//         the same mechanism seen from two sides.

import type { Derived, Produce, Town, Work, WorkKind } from "./types";
import { CATALOGUE, harvestShare } from "./works";
import { ACCESS, FOOD, TRADE, WEALTH, DEPENDENCY_BANDS } from "./constants";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---- The three classes, as a table ([HC-90], [HC-91]) ----------------------
//
// Ratified 2026-09-09: victuals (population) · materials (construction) ·
// luxury (the top). `rank` IS the tier order the clearing walks, so the pyramid
// is the table's own shape rather than a rule written beside it.

export const CLASSES = {
  victuals: { rank: 0, label: "victuals" },
  materials: { rank: 1, label: "materials" },
  luxury: { rank: 2, label: "luxury" },
} as const;

export type TradeClass = keyof typeof CLASSES;

export const CLASS_ORDER = (Object.keys(CLASSES) as TradeClass[]).sort(
  (a, b) => CLASSES[a].rank - CLASSES[b].rank,
);
export const CLASS_COUNT = CLASS_ORDER.length;

export const rankOf = (c: TradeClass): number => CLASSES[c].rank;

// ---- THE GOODS, AND THE CLASS SURVIVES ONLY AS THEIR TIER ------------------
//
// Ratified 2026-09-28 ("the economy's next shape"). The market used to trade
// three abstract classes: a town's produce was looked up, converted to one of
// three buckets and its NAME THROWN AWAY AT THE QUAY. So timber and stone were
// the same thing, grain and fish were the same thing, and no port could be short
// of anything in particular. NAMED GOODS ARE WHAT MAKE ONE PORT DIFFERENT FROM
// ANOTHER, and the three classes survive only as the TIER a good belongs to,
// which is what keeps [HC-77]'s pyramid and bread-before-batteries working.
//
// EVERY GOOD HERE HAS A SOURCE, and that is a rule rather than a coincidence. A
// good nothing on the map produces has unsatisfiable demand for ever; spice and
// ironware are therefore NOT here and arrive with an off-map inflow, not before.
// Three source kinds, and there is no fourth:
//
//   A HEX       — a work standing on ground that bears the produce.
//   THE TOWN    — gunpowder and rum: larger places make them, no land needed.
//                 A TOWN MAKES RUM; IT NEVER MAKES RUM OUT OF SUGAR. Nothing in
//                 this file converts one good into another, ever — that is the
//                 production chain the human killed (§2.12).
//   THE SEA     — nothing yet.
//
// `appetite` IS WHAT SHARE OF ITS TIER'S APPETITE THIS GOOD IS, and the column
// exists because the obvious alternative is wrong out loud: splitting a tier's
// want EVENLY would make salt a third of the world's food demand and peg it at
// the price ceiling for ever — people do not eat salt by the bushel. The
// shares sum to 1 within each tier, which is what keeps every TIER total — and
// therefore population, dependency and the gate — exactly where it was.
//
// GUNPOWDER IS MATERIALS, NOT LUXURY: a town stocks it for its works rather than
// for comfort. That is a table entry and may move.
//
// `wantsFrom` IS THE SOULS AT WHICH A PLACE WANTS THIS GOOD AT ALL, and it is
// what makes a town's SIZE legible without a number on the screen: a hamlet
// wants bread and timber and nothing else, and a city wants five things a
// hamlet has never heard of. Under it the want is not small, it is ABSENT —
// which is the same shape as [HC-77]'s gate and for the same reason, that a
// want nobody has is not a faint want.
//
// THE LUXURIES ARE STAGGERED AND THE STAPLES ARE NOT. Bread, timber and stone
// stand at nothing: every place wants those from its first season, which is
// [HC-76] — one universal drive with no threshold — and the rungs below are a
// property of COMFORT rather than of need. The order is what a place reaches
// for as it grows: sugar first, then the rum a crew drinks, then tobacco, then
// cloth, and cacao last of all because chocolate is a city's habit.
//
// MEASURED AGAINST THE POPULATIONS THE WORLD ACTUALLY PRODUCES ([P-52]), NOT
// CHOSEN. Over the four house seeds at two hundred years the world runs
//
//     min 0 · a quarter under 37 · median 94 · three quarters under 155 · top 185
//
// so the rungs below put roughly the bottom third at NO comfort at all, the
// median town at sugar and rum, an ordinary port at four, and the largest at all
// five. Tune the world's sizes and this column has to be re-measured with them:
// it is a reading of that distribution, not a fact about goods. A rung above the
// largest port in the world is a good nobody ever wants, which is the failure
// this was calibrated to avoid.
export const GOODS = {
  grain: { tier: "victuals", appetite: 0.6, fromTown: false, wantsFrom: 0 },
  fish: { tier: "victuals", appetite: 0.3, fromTown: false, wantsFrom: 0 },
  salt: { tier: "victuals", appetite: 0.1, fromTown: false, wantsFrom: 0 },
  timber: { tier: "materials", appetite: 0.5, fromTown: false, wantsFrom: 0 },
  stone: { tier: "materials", appetite: 0.3, fromTown: false, wantsFrom: 0 },
  gunpowder: { tier: "materials", appetite: 0.2, fromTown: true, wantsFrom: 0 },
  sugar: { tier: "luxury", appetite: 0.3, fromTown: false, wantsFrom: 50 },
  tobacco: { tier: "luxury", appetite: 0.2, fromTown: false, wantsFrom: 110 },
  cotton: { tier: "luxury", appetite: 0.2, fromTown: false, wantsFrom: 140 },
  cacao: { tier: "luxury", appetite: 0.15, fromTown: false, wantsFrom: 170 },
  rum: { tier: "luxury", appetite: 0.15, fromTown: true, wantsFrom: 80 },
} as const satisfies Record<
  string,
  { tier: TradeClass; appetite: number; fromTown: boolean; wantsFrom: number }
>;

// [HC-91] again: the type comes FROM the table.
export type Good = keyof typeof GOODS;

// THE ORDER EVERY LOOP WALKS, and it is TIER ORDER — which is what lets the
// clearing implement [HC-77] and `payImports` implement [HC-78] by doing nothing
// but counting upwards. Sorted rather than trusted to the literal's own order,
// with the declaration index as the tie-break, so it is a total order ([P-10]).
const DECLARED = Object.keys(GOODS) as Good[];
export const GOOD_ORDER: Good[] = DECLARED.slice().sort(
  (a, b) =>
    CLASSES[GOODS[a].tier].rank - CLASSES[GOODS[b].tier].rank ||
    DECLARED.indexOf(a) - DECLARED.indexOf(b),
);
export const GOOD_COUNT = GOOD_ORDER.length;

// Good -> its index, for the handful of seams that arrive holding a name. The
// loops that matter never look at a string ([P-38]).
export const GOOD_AT = Object.fromEntries(GOOD_ORDER.map((g, i) => [g, i])) as Record<Good, number>;

// WHERE EACH TIER'S GOODS START — the goods of tier `r` are `TIER_AT[r] ..
// TIER_AT[r+1]`, a contiguous run because `GOOD_ORDER` is sorted by tier. A
// tier is therefore a pair of integers and never a list to search.
export const TIER_AT: number[] = (() => {
  const at = [0];
  for (let r = 0; r < CLASS_COUNT; r++) {
    at.push(at[r] + GOOD_ORDER.filter((g) => CLASSES[GOODS[g].tier].rank === r).length);
  }
  return at;
})();

// Hoisted once, because `consumedOf` and `commerceOf` read them per good per
// town per season and neither wants a string lookup in the loop ([P-18], [P-38]).
const APPETITE: number[] = GOOD_ORDER.map((g) => GOODS[g].appetite);
const WANTS_FROM: number[] = GOOD_ORDER.map((g) => GOODS[g].wantsFrom);
const FROM_TOWN: number[] = GOOD_ORDER.map((g, i) => (GOODS[g].fromTown ? i : -1)).filter((i) => i >= 0);
export const TIER_RANK: number[] = GOOD_ORDER.map((g) => CLASSES[GOODS[g].tier].rank);

// WHAT SURVIVES A SEASON IN THE STORES — the other face of `storesSeasons`, and
// the line that keeps the world trading for two centuries. Production adds every
// season and, without this, nothing removes: every warehouse fills to its target,
// every demand goes to zero, prices collapse and trade stops entirely. Hoisted
// because it is a constant of the model and not a per-town fact ([P-18]).
const STORES_KEPT = 1 - 1 / TRADE.storesSeasons;

// SUM A TIER'S GOODS. The gate reads tiers while the clearing reads goods, and
// this is the one function that crosses between them ([P-47]) — population,
// dependency, luxury hunger and [HC-77]'s gate all come through here.
export function tierTotal(values: readonly number[], cls: TradeClass): number {
  const r = CLASSES[cls].rank;
  let out = 0;
  for (let g = TIER_AT[r]; g < TIER_AT[r + 1]; g++) out += values[g];
  return out;
}

// WHAT A TOWN MAKES OUT OF BEING A TOWN — gunpowder and rum, and nothing else.
// A mill and a distillery want people and a works yard, not acres, so this is
// the one source that reads population and no ground at all. Below the
// threshold a place is huts and grows nothing of the sort.
//
// IT IS NOT SCALED BY THE HARVEST, deliberately: [HC-6]'s yield modifier is what
// a storm does to a CROP, and a hurricane does not spoil powder in a magazine.
export const townMadeOf = (population: number): number =>
  population > TRADE.townMadeFrom ? (population - TRADE.townMadeFrom) * TRADE.townMadePerHead : 0;

// ---- A CARGO'S GOOD COMES OFF THE GROUND (§2.12.13) ------------------------
//
// ONE TABLE, AND THE GROUND FILLS IT IN. A cargo's class used to be a
// hand-written column on the work — `WorkDef.exports` — which meant a town's
// place in [HC-77]'s pyramid was a property of WHICH BUILDINGS ITS GOVERNOR
// HAPPENED TO PICK. Keyed to the produce instead, it becomes a property of the
// coast the place was founded on, and two towns with the same works on
// different ground are two different towns on the world market. That is the
// whole of the change, and it makes the pyramid mean MORE rather than less.
//
// IT IS A TOTAL MAP NOW, not a partial one, and that closes a whole failure
// class rather than filling two holes. A produce with no row read as HAVING NO
// CARGO — the customs house's case — so a missing row would not throw, it would
// quietly pay a farm a harbourmaster's wage. Every produce ships a named good,
// so there is nothing left to forget.
//
// TWO ROWS ARE NOT THE IDENTITY, AND NEITHER IS A CONVERSION. `food` is a
// coast's fitness for provisions and ships as `grain` — cassava and wheat are
// both bread at the waterside — and the plant `cane` was renamed outright, so
// what grows and what ships finally agree.
const PRODUCE_GOOD: Record<Produce, Good> = {
  food: "grain",
  fish: "fish",
  grain: "grain",
  salt: "salt",
  timber: "timber",
  stone: "stone",
  sugar: "sugar",
  tobacco: "tobacco",
  cotton: "cotton",
  cacao: "cacao",
};

// WHICH CARGO A WORK'S OUTPUT IS — the one function everything else asks
// ([P-47]). Three readers with three different questions come through here:
// what a work sends to the quay (`producedOf`), whether it fills a hold at all
// (`quaysideOf`), and what it would fetch (`fetchOf`) — and a work that grows
// nothing has no cargo class, so it takes a cut of the traffic instead.
//
// THE `food > 0` FALLBACK IS GONE. It read "a work that feeds the town and ships
// nothing is carrying victuals", which was the old column's way of saying what
// the produce now says outright. Measured before deleting it: it changed no
// answer for any row in the catalogue, because every work with a food column
// also names a produce.
export const cargoOf = (kind: WorkKind): Good | null => {
  const p = CATALOGUE[kind].produces;
  return p === null ? null : PRODUCE_GOOD[p];
};

// ---- What the world hands the town ([HC-72]'s "cleared trade" row) ---------
//
// The ONE new stored thing on a Town, and it is stored for the same reason
// `grant` is: it is not derived from the ledger, it ARRIVES. The world writes
// `price` in the seasonal clear and `landed` on the day a ship ties up;
// settlement writes back what the coffers could actually pay for. Everything
// else about a town's commerce — what it made, what it wants, what reaches its
// quay — stays derived ([HC-14]).
//
// `landed` WAS `allotted`, AND THE RENAME IS THE WHOLE OF A DESIGN CHANGE
// ([P-49]: rename when the base moves). It used to hold what the clearing found
// for the town to buy — a promise, written and paid for on the same day. It now
// holds what has actually come over the quay since the last settling, put there
// by a ship that took days to cross: [HC-45] credited on ARRIVAL, [HC-46] a
// governor plans on what has arrived and never on what is promised. A season
// therefore SPENDS WHAT THE PREVIOUS SEASON'S DEALS DELIVERED, and that is not
// an accident of timing — it is the point, because a cargo that can be taken at
// sea has to be a cargo the buyer has not had yet.
//
// An UNCLEARED town is priced at par and buys nothing, which is exactly the town
// the module shipped with. That is a neutral element, not a trading partner:
// [HC-86] killed "the shipping" and nothing here replaces it.

export interface MarketState {
  price: number[]; // by good — the LOCAL price, from its neighbourhood ([HC-82])
  landed: number[]; // what has come over the quay and is not yet paid for
  bought: number[]; // ...and what it could actually pay for
  paid: number; // the coin that cost, this season
  // 0..1 — THE SHARE OF THIS PLACE'S SEA LANES THAT STILL CALL. It is written by
  // the world in the seasonal clear, exactly as `price` is, and
  // for exactly the same reason: no function of this ledger could recompute it
  // ([HC-14]). Which places are near enough to trade with is the world's fact
  // ([HC-82]), and whether a squadron is sitting across those lanes is the
  // world's fact too. The town multiplies and asks nothing ([HC-71]).
  //
  // PAR IS ONE, and par is what an uncleared town faces — the shipping calls as
  // usual, which is the town the module shipped with. A town that has never met
  // a world therefore reads exactly its own readiness, and a blockade is
  // something that can only ever arrive from outside.
  reach: number;
}

// One factory, every field present, same order, same types ([P-26]). [P-30]: the
// three rows are filled, never holed.
export const makeMarket = (): MarketState => ({
  price: new Array(GOOD_COUNT).fill(1),
  landed: new Array(GOOD_COUNT).fill(0),
  bought: new Array(GOOD_COUNT).fill(0),
  paid: 0,
  reach: 1,
});

// ---- Access ---------------------------------------------------------------
//
// A beach and a longboat will move some cargo; a quay and a garrison move all of
// it. [HC-85] gates both directions on this one number, which is why burning a
// warehouse is an economic act and a blockade is the same act from the sea.
//
// ACCESS IS REACH x READINESS, and until KAN-112 it was readiness alone.
//
//   READINESS is what the place has made of its own shore: quays, a strand, and
//             whether anyone dares call at it. It is bounded at 1 — a town can
//             be completely ready and no readier.
//   REACH     is how much of the shipping still calls, and it is a fact about
//             the SEA LANES rather than about the town ([HC-86]: "access reads
//             real routes and blockades"). The town cannot raise it, mend it or
//             rebuild it, which is the whole point: it is cuttable from outside.
//
// WHY THE PRODUCT, AND WHY BOTH HALVES SURVIVE. Readiness alone could not
// express a blockade, and that is the bug: the waterfront works that carried it
// are subsistence, so the hamlet floor raised them again for nothing every
// season and burning a quay was an inconvenience rather than a siege ([HC-87]'s
// fragile ceiling, which held at town scale and could not be stated at world
// scale). Reach alone would let a place with no quay at all trade freely
// because ships happen to pass, which contradicts [HC-85] in the ratified
// words: "no quay, no security -> nothing moves either way". A product is the
// only combination under which BOTH sentences are true, and it is what makes
// the number a CEILING: everything has to be in order for anything to move.
//
// [P-47] ONE PATH TO THE NUMBER. This is the only function that computes an
// access, `commerceOf` calls it once, and `derive` copies that one value onto
// `Derived.access` for the governor to read. There is no second preview of it
// anywhere, and the earnings equation still multiplies by it exactly once.
//
// [P-17b] It is handed `reach` as a NUMBER. There is no argument through which a
//         world, a route, a neighbour or a squadron could arrive, so this file
//         cannot start reading one.

const isWaterfront = (w: Work): boolean => CATALOGUE[w.kind].zone === "waterfront";

// What the place itself has ready, 0..1, before anything asks whether the
// shipping still calls. Deliberately NOT exported: it is a component of access
// and never a second answer to the question access answers ([P-47]).
//
// A BERTH IS A BERTH AND A STRAND IS CAPPED. Every working waterfront work is
// still worth the same `perQuay` — a quay is a quay whoever built it — but what
// the HAMLET FLOOR draws up on the sand is capped at `strandQuays` berths'
// worth. That is the whole of the KAN-112 readiness change, and it is aimed at
// exactly one thing: subsistence works raise themselves again for nothing every
// season ([HC-67]), so with three fishing shacks allowed by the catalogue the
// free floor alone reached the top of the scale and burning a town's waterfront
// cost it nothing beyond a season. Now it cannot: past two berths' worth,
// somebody has to build something that fire can take away for good.
function readinessOf(working: Work[], security: number): number {
  let quays = 0;
  let beached = 0;
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    if (!isWaterfront(w)) continue;
    if (CATALOGUE[w.kind].cls === "capital") quays++;
    else beached++;
  }
  const cap = ACCESS.strandQuays * ACCESS.perQuay;
  const strand = beached * ACCESS.perQuay;
  const shore = quays * ACCESS.perQuay + (strand > cap ? cap : strand);
  return clamp(shore + (security / 100) * ACCESS.securityWeight, 0, 1);
}

export function accessOf(working: Work[], security: number, reach: number): number {
  return readinessOf(working, security) * clamp(reach, 0, 1);
}

// ---- The season's flows, over a warehouse that carries -----------------------
//
// "A TOWN TRACKS A FLOW BALANCE, NEVER A STOCK" (§3.5.3) IS WITHDRAWN, ratified
// 2026-09-28. Everything a town made was sold or forgotten within ninety days,
// so a port's shelves said nothing about who it traded with and no place could
// be SHORT of anything for longer than a season. A town now holds a stock of
// each good that carries — `Town.stock`, written once a season by `stockSeason`
// — and every number in this block is still a FLOW over it: what was made, what
// crossed the quay, what was landed.

export interface Commerce {
  produced: number[]; // by good — what the ledger made this season
  consumed: number[]; // ...and what its own people take
  offer: number[]; // what reaches the quay outbound, already x access
  want: number[]; // ...and what it must find inbound, already x access
  bought: number[]; // what the last clearing delivered AND the coffers paid for
  price: number[]; // the local price it faces
  access: number;
  // The VALUE that crossed the quay this season, both ways, at cleared prices.
  // It is what the harbour takes its cut of, and it is on the block rather than
  // recomputed by each reader because the governor's estimate has to ask the
  // same question the ledger answered ([P-47]).
  traffic: number;
  earned: number; // SUM(sold x price) + the harbour's cut of the traffic
  dependency: number; // 0..1 — the share of its bread that is not off its own ground
  // THERE IS NO `materialsShort` HERE AND THE DELETION IS THE POINT (KAN-137).
  // It read "how far short of timber and stone this place is", and the one thing
  // that ever asked was the build gate — see the note where that gate used to
  // stand. With the gate gone it had no reader at all, and a derived field
  // nobody reads is pure liability ([P-1], [P-50]).
  luxuryShort: number; // 0..1 — a need with teeth, and a MILD weight ([HC-79])
}

// What the ledger sends to the quay, by class. A work's `trade` column is what it
// ships, whatever the cargo is — [HC-83]'s reframing read literally — and its
// CLASS comes off the produce (§2.12.13). The `food` column is now only ever the
// town's own subsistence bread, and it arrives already counted by `derive`.
//
// THE WEATHER BITES HERE, ONCE, ON EVERY COLUMN — and that moved into this loop
// with KAN-137. `commerceOf` used to scale ranks 1 and 2 by hand afterwards,
// because rank 0 arrived pre-scaled off `derive` and the other two did not; the
// standing hazard was that a VICTUALS figure in a `trade` column would then be
// cargo no storm could spoil, and the catalogue was forbidden one to keep it
// shut. KAN-137 moves provision grounds and grain fields into exactly that shape,
// so the rule is replaced by the arithmetic: every work's cargo is scaled here,
// whichever rank it lands in, and there is nothing left to forbid. One line
// instead of two, and one fewer thing to remember ([P-1], [P-47]).
// BOTH COLUMNS, ATTRIBUTED TO THE WORK'S OWN GOOD. The `food` column used to
// arrive as one pre-scaled LUMP and land at rank 0, which is precisely where the
// name was thrown away: a fishing shack's catch and a garden plot's provisions
// were the same anonymous victuals. They are fish and grain now. The TIER totals
// are untouched — the same figures, under their own names — so nothing that
// reads a tier moved, population included.
export function producedOf(working: Work[], harvest: number, population: number): number[] {
  const out = new Array<number>(GOOD_COUNT).fill(0);
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    const g = cargoOf(w.kind);
    if (g !== null) out[GOOD_AT[g]] += (w.food + w.trade) * harvest;
  }
  // ...and what the town makes out of being a town. No hex, no work, no chain.
  const made = townMadeOf(population);
  for (let k = 0; k < FROM_TOWN.length; k++) out[FROM_TOWN[k]] += made;
  return out;
}

// ---- What crosses the quay, and the cut the harbour takes of it ------------
//
// WHAT ACTUALLY MOVED THROUGH THIS PLACE THIS SEASON, at the price it cleared
// at: the cargo it shipped out and the cargo it landed. A FLOW — this season's
// offer and this season's landings, and nothing carried over. The warehouse
// behind it is a level and is never counted here: a full quay is busy and a full
// warehouse is not.
//
// BOTH DIRECTIONS, because [HC-85] gates both and a quay works both: a port that
// lands a thousand bushels of grain is a busy port whether or not it grew a
// thing. That is also what keeps the cut load-bearing for [HC-87]'s trade-fed
// ceiling — the sea-fed port whose income funds its own grain is precisely the
// place whose quay is busiest.
//
// `access` IS NOT HERE, AND ITS ABSENCE IS THE FIX ([P-47]). The offer is
// already through the quay — `commerceOf` multiplies it by `access` once and
// only once — and a landing arrived through the same gate. The old cut applied
// `access` a SECOND time, to a quantity that had never passed a quay at all.
// A blockade now reaches it the way it reaches everything else: reach falls,
// access falls, offer and want fall, and there is no traffic to take a cut of.
export function trafficOf(offer: number[], bought: number[], price: number[]): number {
  let out = 0;
  for (let g = 0; g < GOOD_COUNT; g++) out += (offer[g] + bought[g]) * price[g];
  return out;
}

// A customs house fills no hold: it takes A CUT OF WHAT CROSSES THE QUAY. Until
// KAN-132 the arithmetic did not say so — it paid the work its whole `trade`
// column x `access`, every season, whether or not a single bale crossed. No
// price, no market, no buyer, and `harvestShare` never reached it, so a storm
// could spoil a town's bread and leave its customs revenue untouched.
//
// MEASURED ON FOUR WARM WORLDS AT DAY 0, AND THE TWO FIGURES ARE THE WHOLE
// DIAGNOSIS. The cut paid a quayed place a median 27.00 a season against a
// median 16.16 of cargo actually crossing its quay — the cut was 1.67x the
// traffic it was supposedly a cut OF. And it was the SAME 27.00 for a hamlet
// that owned a customs house as for a port of fifteen hundred souls, because
// nothing in it could tell them apart.
//
// SO THE COLUMN IS A CAPACITY NOW, NOT A WAGE: what this harbour could take if
// it were working, earned in proportion to how much is actually passing. Three
// things follow with no rule of their own:
//
//   * A PLACE THAT CLEARS NOTHING EARNS NOTHING from its quay — the acceptance
//     criterion is the arithmetic rather than a gate ([P-1]).
//   * A STORM DENTS IT, because `harvestShare` is already inside the offer.
//   * A GREAT PORT OUT-EARNS A HAMLET holding the same customs house, which is
//     what a flat allowance could not express and what [P-55]'s two economies
//     were really a report about.
//
// "NO CARGO CLASS" MEANS "GROWS NOTHING", read off the produce (§2.12.13). A
// work that fills a hold is paid at the price its cargo fetched and must never
// be counted here as well, or the same bale is paid for twice.
export function quaysideOf(working: Work[], traffic: number): number {
  let column = 0;
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    if (cargoOf(w.kind) === null) column += w.trade;
  }
  return column * busynessOf(traffic);
}

// HOW HARD THE QUAY IS WORKING, 0..1 — one definition, so the ledger and the
// governor's estimate cannot drift ([P-47]): one asks what a harbour takes and
// the other what one more berth would take, and both are this line.
//
// THERE IS NO CLAMP, AND ITS ABSENCE IS THE DESIGN RATHER THAN AN OMISSION.
// `traffic / busyAt` with a ceiling at 1 was built and measured first, and it
// failed [P-52] in the plainest possible way: the quayed half's MEDIAN READING
// WAS THE CLAMP, 46-61% of them at exactly 1.00 across the whole usable range of
// `busyAt`, because a place only keeps a harbour work if its quay is busy. A
// ceiling half the quayed world already touches is the flat allowance again
// wearing a ratio. `t / (t + busyAt)` approaches one and never reaches it, so
// there is no ceiling to saturate and a busier port always earns more than a
// busy one: measured on the shipped world, the quayed median reads 0.78 and the
// quayless 0.39, with nothing at either end.
//
// AND IT IS BOUNDED, WHICH THE OBVIOUS FORM IS NOT. A cut written as a straight
// SHARE of traffic — `traffic x rate` — is a percentage return, and a percentage
// return on income that buys the grain that makes the income COMPOUNDS.
// Measured: it took the quayside cut from 39% of the world's trade income to
// 85-89% of it and doubled the largest port. A harbour can be busier; it cannot
// be more than fully employed.
export const busynessOf = (traffic: number): number => traffic / (traffic + TRADE.quayBusyAt);

// What the town's own take off it before anything is spare. ONE RULE FOR EVERY
// PLACE ([HC-76]) — a hamlet and a city obey the same three lines and fail at
// different heights.
//
// Note WHAT each class is keyed to, because the difference is the model and not
// a convenience. Bread and comforts are wanted by PEOPLE. Timber and stone are
// wanted by BUILDINGS — a place with nothing raised needs no stone to keep it
// standing, which is also what stops the whole map deadlocking on day one, when
// not one sawpit exists anywhere and a materials bill keyed to population would
// have made the first one unbuildable.
//
// Subsistence works are deliberately not counted: people roof their own houses
// out of whatever is to hand, and the hamlet floor must not be gated on trade or
// a sacked town could never crawl back.
//
// THE TIER STILL SETS THE SIZE OF THE APPETITE AND THE GOOD SETS ITS SHAPE. The
// three lines below are exactly the three that were here; what is new is that
// each is then spread over its tier's goods by the `appetite` column, so a town
// wants GRAIN and FISH and SALT rather than "victuals". The shares sum to one
// within a tier, so every tier total is the number it always was.
//
// ...EXCEPT WHERE THE PLACE IS TOO SMALL TO WANT THE GOOD AT ALL, which is the
// one thing `wantsFrom` changes here and the whole of how size became legible: a
// hamlet's luxury appetite is not a small number, it is nothing, and a great port
// wants five things it never wanted at two hundred souls. So a tier's total is
// the number it was only for a place big enough to want all of it — below that
// the tier is genuinely smaller, which is the point.
//
// IT IS STILL A FLOW — what leaves the stores in a season — and everything that
// reads it reads it as one: dependency asks what share of a season's bread came
// off a ship, and `luxuryShort` asks whether the comforts turned up. The LEVEL a
// town chases is this times `storesSeasons`, and it is built where the market
// needs it rather than here ([P-47]: one arithmetic, not two).
export const consumedOf = (population: number, capitalWorks: number): number[] => {
  const tier = [
    population * FOOD.perHead,
    capitalWorks * TRADE.materialsPerWork,
    population * TRADE.luxuryPerHead,
  ];
  const out = new Array<number>(GOOD_COUNT).fill(0);
  for (let g = 0; g < GOOD_COUNT; g++) {
    out[g] = population >= WANTS_FROM[g] ? tier[TIER_RANK[g]] * APPETITE[g] : 0;
  }
  return out;
};

export function capitalWorksOf(working: Work[]): number {
  let n = 0;
  for (let i = 0; i < working.length; i++) if (CATALOGUE[working[i].kind].cls === "capital") n++;
  return n;
}

// WHAT ONE TIER SENDS TO THE QUAY AND WHAT IT ASKS FOR, by good — and it is a
// function because all three tiers obey it and the victuals one is only
// different in what it counts as a target ([P-47], [P-72]).
//
// IT NETS A LEVEL AGAINST A LEVEL SINCE THE WAREHOUSE LANDED. It used to net
// what a town MADE this season against what its people would take this season,
// so a town could never be short of anything for longer than ninety days and its
// stores said nothing about who it traded with. Now `have` is the warehouse with
// this season's harvest already in it and `target` is the level the place
// chases, so DEMAND IS THE GAP — and the arithmetic below did not move at all,
// because a gap subtracts exactly the way a shortfall did.
//
// A TOWN EATS WHAT IT GROWS BEFORE IT BUYS ANYTHING, and that sentence is the
// whole of the arithmetic. The obvious reading — net each good against its own
// appetite and let the answers stand — has a town SELLING ITS CORN AND BUYING
// FISH IN THE SAME SEASON while its people are fed either way, which is not a
// trade, it is a rounding error with a quay attached. Measured, it put 23% more
// cargo across the world's beaches than master for no new production at all and
// crossed [KAN-131]'s ratified "a town cannot fund a capital work off its own
// trade in a decade" at the median. So:
//
//   A TIER IN SURPLUS offers what is left after its own shelves are covered,
//   SPLIT PRO RATA TO WHAT IT ACTUALLY HOLDS. A cane coast ships cane. This is
//   where one port stops looking like another.
//
//   A TIER IN DEFICIT buys the gap, SPLIT BY APPETITE ACROSS THE GOODS IT IS
//   SHORT OF. A hungry town takes whatever bread is on the quay in the
//   proportions its people eat — but it never asks for the one thing it has
//   plenty of, which is the other half of what makes two ports different: a
//   coast with a reef buys corn, and a coast with corn buys fish.
//
// EITHER WAY THE TIER'S OWN TOTAL IS UNTOUCHED: `SUM(want) - SUM(offer)` is
// exactly this tier's target less what it holds, which is the number [HC-77]'s
// gate and the dependency clause both read.
function tierToMarket(
  have: readonly number[],
  target: readonly number[],
  offer: number[],
  want: number[],
  tier: number,
  access: number,
  price: readonly number[],
): number {
  const from = TIER_AT[tier];
  const to = TIER_AT[tier + 1];
  let spare = 0;
  let short = 0;
  let asking = 0; // the appetite of the goods it is short of, for the split below
  for (let g = from; g < to; g++) {
    const d = have[g] - target[g];
    offer[g] = d > 0 ? d : 0;
    want[g] = 0;
    spare += offer[g];
    if (d < 0) {
      short -= d;
      asking += APPETITE[g];
    }
  }
  let cargo = 0;
  if (spare >= short) {
    const keep = spare > 0 ? (spare - short) / spare : 0;
    for (let g = from; g < to; g++) {
      offer[g] = offer[g] * keep * access;
      cargo += offer[g] * price[g];
    }
  } else {
    // `asking` cannot be zero here: a tier in deficit is short of something.
    const gap = asking > 0 ? ((short - spare) * access) / asking : 0;
    for (let g = from; g < to; g++) {
      if (have[g] < target[g]) want[g] = gap * APPETITE[g];
      offer[g] = 0;
    }
  }
  return cargo;
}

// The full commerce block, from the ledger plus whatever the last clearing left.
export function commerceOf(town: Town, working: Work[], security: number): Commerce {
  const access = accessOf(working, security, town.market.reach);
  // [HC-6]'s yield modifier reaching the CARGO, handed to the one loop that
  // counts cargo. `food` arrives already scaled — `derive` is the one place that
  // counts the town's own bread — and `producedOf` scales every column it fills
  // itself, so a storm cannot spoil a town's corn and leave its cane or its grain
  // untouched. One definition of the share ([P-47]); it is `harvestShare` here
  // and in `derive`.
  const produced = producedOf(working, harvestShare(town), town.population);
  const consumed = consumedOf(town.population, capitalWorksOf(working));
  const m = town.market;

  const offer = new Array<number>(GOOD_COUNT).fill(0);
  const want = new Array<number>(GOOD_COUNT).fill(0);

  // THE WAREHOUSE WITH THIS SEASON'S HARVEST ALREADY IN IT — what the quay has
  // to sell from and to fill from, which is what every line below nets against.
  // The stores are written back once, in `stockSeason`, at the end of settling;
  // nothing here touches them, so `derive()` stays a pure reading of the ledger
  // however many times a season asks for it.
  const have = new Array<number>(GOOD_COUNT).fill(0);
  // ...AND THE LEVEL IT CHASES. `consumed` is a season's take and this is the
  // larder behind it — one multiplication, so the two can never disagree about
  // what the town wants ([P-47]). The victuals row is overwritten below, once
  // the coin ceiling has had its say.
  const target = new Array<number>(GOOD_COUNT).fill(0);
  for (let g = 0; g < GOOD_COUNT; g++) {
    have[g] = town.stock[g] + produced[g];
    target[g] = consumed[g] * TRADE.storesSeasons;
  }

  // The cargo tiers first, because the victuals line is funded out of them.
  // SUM(sold x price x access): the offer is already through the quay, so
  // `access` appears once and only once — [P-47], one path to the number.
  let cargo = 0;
  for (let t = 1; t < CLASS_COUNT; t++) {
    cargo += tierToMarket(have, target, offer, want, t, access, m.price);
  }

  // THE COIN CEILING, and the line that actually lifts the old ~450-soul cap
  // (§3.5.6). Population used to be bounded by the town's own fields, so a place
  // could never be SHORT of bread and therefore never asked for any: the cap was
  // self-enforcing and trade could not reach it. So a town asks for grain enough
  // to feed the people its EXPORTS can pay for —
  //
  //     pop ~= export revenue / (import price + upkeep/head)
  //
  // — which is why "the ceiling is set by the land's QUALITY, not its acreage".
  // It is funded out of cargo and the crown's grant and never out of its own
  // corn, so a farming town cannot bootstrap itself by selling corn to buy corn.
  //
  // THE QUAY'S CUT IS IN IT TOO, AND IT IS STRUCK ON WHAT HAS ALREADY CROSSED
  // (KAN-132). `offer[0]` is still nothing on the line below — THIS line is what
  // decides how much corn there will be to ship — so what `trafficOf` can see
  // here is exactly the landings and the cargo, and the corn joins the traffic
  // further down, once it is real. The same question, asked twice, in the
  // season's own order ([P-47]: one definition, not one call).
  //
  // BOTH HALVES OF THAT ORDERING ARE LOAD-BEARING AND BOTH WERE MEASURED.
  // Funding the appetite out of cargo alone costs the world's largest port a
  // fifth of its people (1,465 -> 1,182 across four warm seeds) — the quayside
  // cut IS what funds a sea-fed port's grain, which is the property the ticket
  // warned was load-bearing for [HC-87]. And funding it out of the FULL traffic
  // is a circle: a place buying grain because it is about to buy grain, which
  // compounds the quayside cut to 85% of the world's trade income.
  const landed = trafficOf(offer, m.bought, m.price);
  const purse = (cargo + quaysideOf(working, landed) + town.grant) * TRADE.growthShare;
  // WHAT ONE SOUL'S DIET COSTS HERE — the appetite-weighted price of the whole
  // victuals tier, not the price of one column. A port where grain is dear and
  // fish is cheap feeds a soul for less than one where both are dear, which the
  // single class price could not say. At par it is the same number it was.
  let perSoul = WEALTH.upkeepPerHead;
  for (let g = TIER_AT[0]; g < TIER_AT[1]; g++) perSoul += m.price[g] * APPETITE[g] * FOOD.perHead;
  const funded = perSoul > 0 ? purse / perSoul : 0;
  // THE GREATER of the two, not the sum — and that is a design choice worth
  // stating, because the sum reads more natural and is wrong. Under a sum every
  // place on the map wants more grain than its own fields grow, NOBODY has corn
  // spare, and the victuals market clears empty every season (measured: 48
  // places, 0 sellers). A max leaves the ordinary town selling the gap between
  // its fields and its people, and lets a great port outbid its own acreage.
  const mouths = (town.population > funded ? town.population : funded) * FOOD.perHead;
  // The same rule as the two tiers above, against the stores the coin ceiling
  // just set rather than against the people alone — so a place never sells its
  // corn and buys corn back in the same breath, and a farming coast ships the
  // grain its ground actually bears.
  //
  // THE VICTUALS TARGET IS OVERWRITTEN AND NOT ADDED TO, and that is the price of
  // the coin ceiling: the larder the market sees is `mouths`, which the line
  // above may have lifted above what the people alone eat, while `consumed` has
  // to go on reporting the people — the dependency clause is about souls and not
  // about coin.
  for (let g = TIER_AT[0]; g < TIER_AT[1]; g++) target[g] = mouths * APPETITE[g] * TRADE.storesSeasons;
  cargo += tierToMarket(have, target, offer, want, 0, access, m.price);

  // ...and only now is the season's traffic known, so the harbour's cut comes
  // LAST rather than first. The order is the whole of KAN-132 in one line: a cut
  // of what crossed cannot be struck before anything has crossed.
  const traffic = trafficOf(offer, m.bought, m.price);

  return {
    produced,
    consumed,
    offer,
    want,
    bought: m.bought,
    price: m.price,
    access,
    traffic,
    earned: cargo + quaysideOf(working, traffic),
    // BOTH ARE STILL TIER QUESTIONS and both are asked of the goods ([P-47]).
    // "How much of its bread comes off a ship" is about bread, not about wheat:
    // a town that grows its grain and buys its salt is not sea-fed.
    dependency: dependencyOf(tierTotal(produced, "victuals"), tierTotal(consumed, "victuals")),
    luxuryShort: shortfallOf(
      tierTotal(produced, "luxury") + tierTotal(m.bought, "luxury"),
      tierTotal(consumed, "luxury"),
    ),
  };
}

// ---- The warehouse ---------------------------------------------------------
//
// THE SEASON'S STORES, STRUCK. What the town made goes in, what crossed the quay
// outward comes out, what it bought stays — and a share of the whole goes,
// because nothing else in the model removes anything and a warehouse that only
// fills is a warehouse that stops buying.
//
// THIS IS THE ONLY FUNCTION THAT WRITES `town.stock`, which is what lets
// `derive()` stay a pure reading however often it is asked ([P-47]). It is
// handed the commerce block the settlement actually booked, so the cargo the
// ledger was PAID for is the cargo that leaves the shelves — one arithmetic, not
// two that could drift.
//
// THE STORES CANNOT GO NEGATIVE AND THERE IS NO GUARD SAYING SO ([P-1]): a
// tier in surplus offers at most `have - target` and a tier in deficit offers
// nothing, so what is left after a sale is at least the target and never less
// than nothing. An input the arithmetic cannot produce beats a clamp somebody
// has to remember.
//
// AND IT CANNOT RUN AWAY EITHER, which is Done-when 3 as arithmetic rather than
// as a hope. Whatever a place produces, the stores settle where the drain
// balances the inflow — `stock -> (stock + in) x STORES_KEPT` has a fixed point
// at `in x STORES_KEPT / (1 - STORES_KEPT)` for any inflow at all — so no
// warehouse fills, no demand reaches zero, and the world is still trading in two
// hundred years.
export function stockSeason(town: Town, c: Commerce): void {
  const s = town.stock;
  for (let g = 0; g < GOOD_COUNT; g++) {
    s[g] = (s[g] + c.produced[g] - c.offer[g] + c.bought[g]) * STORES_KEPT;
  }
}

// THE MATERIALS BUILD-GATE IS GONE, AND THIS NOTE IS WHAT STANDS WHERE IT WAS
// (KAN-137, ratified 2026-09-23). It was `canBuild`, `canBuildKind`,
// `producesMaterials`, `NO_MATERIALS_CLAUSE`, `TRADE.buildGate` and
// `Commerce.materialsShort` — six declarations and a rule in two halves.
//
// THE HUMAN'S CORRECTION, and it dissolves the whole mechanism rather than
// re-aiming it: *"If we're saying hex tiles only boost what the town produces,
// the assumption is that they are already harvesting said resources. Claiming a
// forest tile doesn't mean only now do they get wood. It means their yield is
// bigger."*
//
// So a town is never short of the timber and stone its OWN building takes. The
// tiles are a multiplier on a baseline it always had, and the baseline is not
// modelled because it never leaves the town — what the tiles add is the surplus,
// and the surplus is cargo. A gate that asked "can this place get planks at all"
// was asking about the baseline, and the answer is always yes.
//
// WHAT WENT WITH IT, and neither is a loss:
//
//  * THE SAWPIT EXEMPTION — "you do not need planks to dig a sawpit" — existed
//    only to patch a cliff in the gate: the bill is `capitalWorks x
//    materialsPerWork`, so a place with no capital work was short of nothing,
//    got ONE free build, and fifty-two places across four seeds spent it on a
//    tavern and froze for two centuries. No gate, no cliff, no patch.
//  * THE REFUSAL CLAUSE, "there is no timber or stone to be had", which had no
//    consumer (KAN-136). It is closed by deletion rather than by wiring it up.
//
// MATERIALS ARE STILL A TRADE CLASS. A town still ships its timber and still
// buys timber, `consumedOf` still prices a building's standing bill, and the
// clearing is untouched. What is gone is the CONSTRAINT ON CONSTRUCTION. Three
// caps still bind a governor: coin, the menu's per-town `max`, and a region's
// free area.

// ---- Prices, and what a work would fetch -----------------------------------
//
// The LOCAL price this place faces, and the only way anyone learns one is by
// being here. §3.5.9's ratified ban is on the price TABLE — the arbitrage-
// enabling god view — not on prices existing, and [HC-82] makes the ban
// structural rather than a matter of restraint: each neighbourhood clears on its
// own ratio, so there is no global price to table in the first place.
//
// [HC-71] holds: the town reads the block the world handed it and never reaches
// out to ask a neighbour anything.
export const priceOf = (town: Town, good: Good): number => town.market.price[GOOD_AT[good]];

// HOW DEAR THIS CARGO IS HERE, against the dearest this market may ever make it
// — 0..1, and it is the "local price" a deepening is scored from ([HC-97]).
//
// THE DENOMINATOR IS [HC-82]'S OWN CEILING AND NOT A NEW NUMBER ([P-53]): the
// clearing already refuses to move a price past `basePrice x priceCeiling`, so
// this divides by a bound the model already enforces rather than by a constant
// that would price the same fact a second time. Measured on the warm world, it
// runs across its range with a median well short of the clamp ([P-52]).
export const dearnessOf = (town: Town, good: Good): number => {
  const i = GOOD_AT[good];
  return town.market.price[i] / (TRADE.basePrice[TIER_RANK[i]] * TRADE.priceCeiling);
};

// What a work of this kind would ACTUALLY FETCH here — `trade x price x access`,
// the second of §3.5.4's two edits to the auction. It replaces a flat constant,
// and that is the whole of what makes the governor's market term an argument
// about this place rather than a fact about the catalogue: the same sawpit is
// worth raising where timber is dear and not where it is cheap.
//
// A work with no cargo class fills no hold, so it fetches a CUT OF THE TRAFFIC —
// the same share the ledger pays it, asked of the same traffic ([P-47]). It used
// to fetch `trade x access`, which was the flat allowance previewed, and the day
// the ledger stopped paying that (KAN-132) the governor would have gone on
// bidding four hundred and eighty coin for a wage that no longer existed. That
// is precisely the shape [P-47] was earned on.
//
// SO A HARBOUR WORK NOW ARGUES FROM THE TRADE ALREADY PASSING THE PLACE, and
// `[HC-16]`'s clause under it — "there is money in it" — becomes true of this
// port rather than of the catalogue. A hamlet nothing calls at has no argument
// for a customs house, which is the right answer and was not previously
// sayable.
export function fetchOf(town: Town, kind: WorkKind, access: number, traffic: number): number {
  const cargo = cargoOf(kind);
  if (cargo === null) return CATALOGUE[kind].trade * busynessOf(traffic);
  return CATALOGUE[kind].trade * town.market.price[GOOD_AT[cargo]] * access;
}

// ---- The port seam (§3.5.7) ------------------------------------------------
//
// Exactly three things are exposed, so the town menu has something real to talk
// to: `derive(town).commerce`, a public pure `priceOf()`, and the two
// write-points below. The player's VERBS are KAN-89 and are deliberately not
// here — this is the shape they will be built against, and nothing more.
//
// [HC-88] THE PLAYER IS A SMALL FISH, AND THE NUDGE IS CAPPED. Uncapped, the
//         first thing anyone discovers is that they can buy out a town — an
//         exploit, and a betrayal of "the world runs without you".

export interface Deal {
  qty: number; // what actually changed hands
  price: number; // what it went at
  coin: number; // ...and what that came to
}

// How much of this class crosses the quay in a season. The nudge is measured
// against it, so a hundred barrels is a great deal in a hamlet and nothing at
// all in a great port — which is the right shape without any special case.
const flowOf = (town: Town, i: number, produced: number): number => {
  const f = produced + town.market.bought[i];
  return f > 1 ? f : 1;
};

function nudge(town: Town, i: number, by: number): void {
  const cap = TRADE.nudgeCap;
  const moved = by > cap ? cap : by < -cap ? -cap : by;
  const p = town.market.price[i] * (1 + moved);
  const base = TRADE.basePrice[TIER_RANK[i]];
  const lo = base * TRADE.priceFloor;
  const hi = base * TRADE.priceCeiling;
  town.market.price[i] = p < lo ? lo : p > hi ? hi : p;
}

// The player lands cargo here. The town pays for it, and its price softens.
export function sellTo(town: Town, good: Good, qty: number, d: Derived): Deal {
  const i = GOOD_AT[good];
  const price = town.market.price[i];
  const take = qty > 0 ? qty : 0;
  const coin = take * price;
  const paid = coin > town.wealth ? town.wealth : coin;
  const moved = price > 0 ? paid / price : 0;
  town.wealth -= paid;
  nudge(town, i, -moved / flowOf(town, i, d.commerce.produced[i]));
  return { qty: moved, price, coin: paid };
}

// ...and takes cargo away. The town is paid, and its price hardens.
export function buyFrom(town: Town, good: Good, qty: number, d: Derived): Deal {
  const i = GOOD_AT[good];
  const price = town.market.price[i];
  const take = qty > 0 ? qty : 0;
  town.wealth += take * price;
  nudge(town, i, take / flowOf(town, i, d.commerce.produced[i]));
  return { qty: take, price, coin: take * price };
}

// ---- Dependency ------------------------------------------------------------
//
// §3.5.5: "dependency = imported victuals / total victuals", derived, zero
// stored state. Written here as the share of what the town NEEDS that did not
// come off its own ground — which is the same number whenever the shipping
// covers the gap, and when it does not, still counts the bread that failed to
// arrive rather than reading a starving town as self-sufficient. One number, one
// sentence, one reader ([P-47]).
//
// [HC-81] It is scored IDENTICALLY FOR EVERY PLACE, whatever its purpose.
//         Importing never silences the wish for a farm. What purpose changes is
//         what the governor may DO about it, never the scoring.
export const dependencyOf = (produced: number, consumed: number): number =>
  consumed <= 0 ? 0 : clamp(1 - produced / consumed, 0, 1);

const shortfallOf = (have: number, want: number): number =>
  want <= 0 ? 0 : clamp(1 - have / want, 0, 1);

// One word for the town card. No number without a sentence.
export function dependencyWord(dependency: number): string {
  for (const b of DEPENDENCY_BANDS) if (dependency >= b.at) return b.word;
  return DEPENDENCY_BANDS[DEPENDENCY_BANDS.length - 1].word;
}

// The clause the food need writes once it is rebased from hunger to dependency
// (§3.5.4, and the line that spec calls load-bearing).
export const DEPENDENCY_CLAUSE = "too much of their bread comes off a ship";

// ---- Settling --------------------------------------------------------------
//
// [HC-78] IMPORTS ARE PAID BEFORE CONSTRUCTION — bread before batteries. That
//         ordering is what produces the good failure state, "they spend all they
//         make on corn": the coin goes on the quay before the governor ever sees
//         it, and a town that cannot cover its bread never reaches its wall.
//
// Paid in tier order, which is the pyramid again: whatever is left after the
// corn buys the timber, and whatever is left after that buys the silk. `GOOD_ORDER`
// IS tier order, so walking the goods upwards is the whole of [HC-78] — there is
// no second list of tiers to keep in step with this one.
//
// WHAT IT PAYS FOR IS WHAT IS ON THE QUAY, and that is the change [HC-46] asks
// for: goods that a ship landed during the last ninety days, not goods a
// clearing promised this morning. A ship taken at sea is a bill this town never
// receives and bread it never eats.
//
// IT PAYS AT TODAY'S LOCAL PRICE, not at the price the deal was struck at. The
// hull carries goods and not a contract — a season's lag in a neighbourhood's
// own ratio is a smaller lie than a second price table riding around on every
// ship ([HC-82]: there is no global price to arbitrage, and this does not build
// one).

export function payImports(town: Town, purse: number): number {
  const m = town.market;
  let left = purse;
  let paid = 0;
  for (let g = 0; g < GOOD_COUNT; g++) {
    const price = m.price[g];
    const cost = m.landed[g] * price;
    if (cost <= left) {
      m.bought[g] = m.landed[g];
      left -= cost;
      paid += cost;
    } else {
      // Short of coin: it takes what it can pay for and goes without the rest.
      const afford = price > 0 ? left / price : 0;
      m.bought[g] = afford < m.landed[g] ? afford : m.landed[g];
      paid += m.bought[g] * price;
      left = 0;
    }
    // THE QUAY IS CLEARED WHETHER OR NOT THE TOWN COULD PAY. What it could not
    // afford it goes without, exactly as it always did — the goods do not sit on
    // the stones waiting for a better season, or a port that fell short once
    // would go on landing the same shipment for ever.
    m.landed[g] = 0;
  }
  m.paid = paid;
  return paid;
}
