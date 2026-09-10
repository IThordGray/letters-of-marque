// The town sim — pure systems over the town struct. No DOM, no rendering: the
// same town in gives the same town out, so this runs headless.
//
// The beat is a SEASON (four per year). The town never prompts; it accumulates,
// and reports in prose when someone looks.

import type { Town, Derived, Patron } from "./types";
import type { Land } from "./land";
import { describeLand } from "./land";
import { stepWorks, unmetNeeds, CATALOGUE } from "./works";
import { makeFootprint } from "./footprint";
import { commerceOf, makeMarket, payImports, dependencyWord } from "./trade";
import { FOOD, POP, WEALTH, WORKS, PROSPERITY, SECURITY, SEASONS_PER_YEAR, PROSPERITY_BANDS, WEALTH_BANDS } from "./constants";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---- Derived quantities ----------------------------------------------------
// Recomputed from the ledger every time they're asked for. Nothing here is
// stored: a derived number can never drift away from the sentence explaining it.
export function derive(town: Town): Derived {
  const working = town.works.filter((w) => w.condition === "working");

  const food = sum(working, (w) => w.food);
  const mouths = town.population * FOOD.perHead;
  const trade = sum(working, (w) => w.trade);
  const upkeep = town.population * WEALTH.upkeepPerHead;
  const defence = sum(working, (w) => w.defence);

  const security = clamp(
    defence * SECURITY.perDefence + (town.patron.kind === "none" ? 0 : SECURITY.patronBonus),
    0,
    100,
  );

  // WEALTH IS EARNED, NOT EMITTED. `trade` stopped being coin a work produced
  // and became what it sends to the quay; the coin is what someone paid for it:
  //
  //     yield = SUM(sold x price x access) + grant - imports paid - upkeep
  //
  // [HC-78] puts `imports paid` inside the flow rather than beside it — bread
  // before batteries — so a town that spends all it makes on corn never reaches
  // the governor with anything to spend.
  const commerce = commerceOf(town, working, food, security);

  return {
    food,
    mouths,
    surplus: food - mouths,
    trade,
    upkeep,
    yield: commerce.earned + town.grant - town.market.paid - upkeep,
    security,
    hands: { needed: sum(working, (w) => w.hands), available: town.population * WORKS.labourShare },
    garrison: garrisonOf(town, security),
    needs: unmetNeeds(town, commerce.dependency),
    commerce,
    access: commerce.access,
    dependency: commerce.dependency,
  };
}

// How hard the garrison is — what a raider actually faces, graded
// `picket · garrison · fortress` ([HC-60], renamed 2026-09-10 from outpost/town/capital,
// which shared two words with the size class settlement → town → city and so read as a
// size axis it never was).
//
// Guns alone don't make a fortress — a heavily fortified presidio of ninety souls is a
// hard target, but it is still a small place. So importance weighs SIZE as well as
// SECURITY (town-economy.md §1: the grade comes from population + security + patron),
// and that is also what lets a hard little place outgrade a soft place twice its size,
// which is `[HC-59]`'s whole pay-off.
//
// [HC-59]'s full population × size × purpose model is NOT built here: size class and
// purpose do not exist as fields yet. This stays the value that should eventually replace
// the hand-set GarrisonGrade in the land module (spec §9, deferred — deliberately not
// wired up by KAN-104).
function garrisonOf(town: Town, security: number): Derived["garrison"] {
  const size = (Math.min(town.population, SECURITY.fullSizePop) / SECURITY.fullSizePop) * 100;
  const importance = security * SECURITY.securityShare + size * (1 - SECURITY.securityShare);
  return importance >= SECURITY.fortressAt ? "fortress" : importance >= SECURITY.garrisonAt ? "garrison" : "picket";
}

// What the town can feed, held below that ceiling when the place is miserable.
//
// THE ~450-SOUL CEILING IS GONE (§3.5.6). It used to be the town's own fields
// and nothing else, so no place could outgrow the ground it farmed. Bought bread
// counts here now, and the four limits that replace the old cap are all already
// in the model: COIN (a town that cannot pay does not eat), ACCESS (no quay, no
// grain), GROUND FOR HOUSES (the footprint) and HANDS (`labourShare`).
//
// [HC-87] The new ceiling is FRAGILE BY DESIGN, and that is not a side effect:
//         ceiling and raid consequence are the SAME MECHANISM. A trade-fed town
//         of 1,500 falls back toward 450 the season its quay burns, because the
//         bought half of this sum simply stops arriving.
export function carryingCapacity(town: Town): number {
  const grown = sum(town.works.filter((w) => w.condition === "working"), (w) => w.food);
  const foodCap = (grown + town.market.bought[0]) / FOOD.perHead;
  const { min, fullAt } = POP.prosperityPull;
  const pull = min + (1 - min) * clamp(town.prosperity / fullAt, 0, 1);
  return Math.max(POP.floor, foodCap * pull);
}

// Where prosperity is HEADING. The town only ever moves a fraction of the way
// there each season — see stepSeason.
//
// [HC-74] `surplus/head` used to be scored POSITIVELY here, and it had to go: a
//         place fed from the sea has negative surplus BY DESIGN, so every large
//         town would have read as "on its knees" the moment imports existed.
//         Dependency replaces it as a MILD negative, and luxury goes short for a
//         milder one still — [HC-79] warns that scoring an appetite hard turns
//         it into a second prosperity meter.
export function prosperityTarget(town: Town, d: Derived): number {
  const heads = Math.max(town.population, 1);
  return clamp(
    PROSPERITY.base -
      d.commerce.dependency * PROSPERITY.dependencyWeight -
      d.commerce.luxuryShort * PROSPERITY.luxuryWeight +
      (d.yield / heads) * PROSPERITY.perYieldHead +
      d.security * PROSPERITY.securityWeight,
    0,
    100,
  );
}

// ---- The season tick -------------------------------------------------------
//
// SPLIT IN TWO, and the split is [HC-7]'s. The world's seasonal tick has five
// phases and trade clears GLOBALLY between the first and the third: every place
// produces, then the whole map's surpluses and shortfalls meet at once, then
// every place settles from its post-trade position. A town stepped on its own
// runs both halves back to back and clears against nothing, which is the same
// town the module shipped with.

// Phase 1 — PRODUCE. Subsistence raises itself, hands are allotted, the untended
// rots. Nothing here reads another place, so the order places are visited in
// cannot matter.
export function produceSeason(town: Town): void {
  stepWorks(town, year(town));
}

// Phase 3 — SETTLE. Imports are paid FIRST out of what the season made ([HC-78]:
// bread before batteries), wealth is the remainder, prosperity lags toward its
// target, population drifts toward what the town can now feed.
export function settleSeason(town: Town): void {
  const before = derive(town);

  // The purse the quay is paid out of: coin on hand, plus what this season's
  // exports fetched, plus the crown's standing grant. What it cannot cover it
  // simply goes without — and going without bread is what makes the new ceiling
  // fragile rather than a bigger number.
  payImports(town, Math.max(0, town.wealth + before.commerce.earned + town.grant));

  const d = derive(town);

  // Yield piles up as wealth. It can't go below zero — a town with bare coffers
  // simply builds nothing; it does not go into debt and die.
  town.wealth = Math.max(0, town.wealth + d.yield);

  // Prosperity LAGS deliberately. This is the whole reason it is stored rather
  // than derived: the ledger changes today, the town's standing changes slowly.
  town.prosperity = clamp(town.prosperity + (prosperityTarget(town, d) - town.prosperity) * PROSPERITY.lag, 0, 100);

  // Population drifts toward what the town can feed and hold. Kept as a float so
  // the drift is smooth; only ever shown rounded. POP.drift is also what damps
  // the oscillation §3.5.8 warns about — [HC-75] makes that a test, not a hope.
  town.population = Math.max(POP.floor, town.population + (carryingCapacity(town) - town.population) * POP.drift);

  town.season++;
}

export function stepSeason(town: Town): void {
  produceSeason(town);
  settleSeason(town);
}

export function stepYears(town: Town, years: number): void {
  for (let i = 0; i < years * SEASONS_PER_YEAR; i++) stepSeason(town);
}

// ---- Construction ----------------------------------------------------------
export function makeTown(init: Partial<Town> & { name: string; seed: number }): Town {
  return {
    id: 1,
    archetype: "colony",
    patron: { kind: "none", name: "", owns: false },
    founded: 1640,
    season: 0,
    population: 80,
    wealth: WEALTH.start,
    prosperity: PROSPERITY.start,
    land: [],
    water: [],
    regions: [],
    works: [],
    footprint: makeFootprint(),
    governor: "",
    grant: 0,
    market: makeMarket(),
    nextWorkId: 1,
    lastThreat: null,
    ...init,
  };
}

// Found a town on ground the world GIVES it, then let it be what that ground
// allows. The town does not roll its own coast: [HC-19] makes the world map the
// single source of geography, so a place's land arrives as an argument like every
// other external input on [HC-72]'s closed list — and `ground` is that list's
// "its land" row, nothing more.
//
// Note what this costs the caller: the ground is no longer a function of
// `init.seed`. Two towns founded on the same seed can stand on quite different
// land, which is the whole point — the seed is the town's own stream, not a
// licence to invent geography.
export function foundTown(init: Partial<Town> & { name: string; seed: number }, ground: Land): Town {
  return makeTown({ ...init, land: ground.land, water: ground.water, regions: ground.regions });
}

// ---- Reading it back -------------------------------------------------------
export const year = (town: Town) => town.founded + Math.floor(town.season / SEASONS_PER_YEAR);

function band(v: number, bands: { at: number; word: string }[]): string {
  for (const b of bands) if (v >= b.at) return b.word;
  return bands[bands.length - 1].word;
}

export const prosperityWord = (town: Town) => band(town.prosperity, PROSPERITY_BANDS);
export const wealthWord = (town: Town) => band(town.wealth, WEALTH_BANDS);

// A one-line read of the place. The full town card and chronicle are KAN-75 —
// this is the minimum needed to see the sim working.
export function summarise(town: Town): string {
  const d = derive(town);
  const earners = town.works.filter((w) => w.condition === "working" && w.trade > 0 && CATALOGUE[w.kind].cls === "capital");
  const makes = earners.length
    ? `Works ${[...new Set(earners.map((w) => w.name))].join(", ")}`
    : "Makes nothing anyone would buy";
  const land = town.regions.length ? ` Set among ${describeLand(town)}.` : "";
  return (
    `${town.name}, ${year(town)} — a town of ${Math.round(town.population)} souls, ${prosperityWord(town)}.` +
    `${land} ${cap(wealthWord(town))}, ${dependencyWord(d.dependency)}. ${makes}. ` +
    `${article(d.garrison)} ${d.garrison} watch.`
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const article = (w: string) => ("aeiou".includes(w[0]) ? "An" : "A");

function sum<T>(xs: T[], f: (x: T) => number): number {
  let t = 0;
  for (const x of xs) t += f(x);
  return t;
}

export type { Town, Derived, Patron };
