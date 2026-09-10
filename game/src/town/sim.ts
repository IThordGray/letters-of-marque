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

  return {
    food,
    mouths,
    surplus: food - mouths,
    trade,
    upkeep,
    yield: trade + town.grant - upkeep,
    security,
    hands: { needed: sum(working, (w) => w.hands), available: town.population * WORKS.labourShare },
    tier: tierOf(town, security),
    needs: unmetNeeds(town),
  };
}

// What a raider actually faces. Guns alone don't make a capital — a heavily
// fortified presidio of ninety souls is a hard target, but it is still an
// outpost. So importance weighs SIZE as well as SECURITY (spec §1). This is the
// value that should eventually replace the hand-set SettlementTier in the land
// module (spec §9, deferred).
function tierOf(town: Town, security: number): Derived["tier"] {
  const size = (Math.min(town.population, SECURITY.capitalPop) / SECURITY.capitalPop) * 100;
  const importance = security * SECURITY.securityShare + size * (1 - SECURITY.securityShare);
  return importance >= SECURITY.capitalAt ? "capital" : importance >= SECURITY.townAt ? "town" : "outpost";
}

// What the land can feed, held below that ceiling when the place is miserable.
// The food comes entirely from works — including the free subsistence ones, which
// is what stops a sacked town from dying.
export function carryingCapacity(town: Town): number {
  const foodCap = sum(town.works.filter((w) => w.condition === "working"), (w) => w.food) / FOOD.perHead;
  const { min, fullAt } = POP.prosperityPull;
  const pull = min + (1 - min) * clamp(town.prosperity / fullAt, 0, 1);
  return Math.max(POP.floor, foodCap * pull);
}

// Where prosperity is HEADING. The town only ever moves a fraction of the way
// there each season — see stepSeason.
export function prosperityTarget(town: Town, d: Derived): number {
  const heads = Math.max(town.population, 1);
  return clamp(
    PROSPERITY.base +
      (d.surplus / heads) * PROSPERITY.perSurplusHead +
      (d.yield / heads) * PROSPERITY.perYieldHead +
      d.security * PROSPERITY.securityWeight,
    0,
    100,
  );
}

// ---- The season tick -------------------------------------------------------
export function stepSeason(town: Town): void {
  // The ledger first: subsistence raises itself, hands are allotted, the untended
  // rots. Everything below reads the ledger as it stands after that.
  stepWorks(town, year(town));

  const d = derive(town);

  // Yield piles up as wealth. It can't go below zero — a town with bare coffers
  // simply builds nothing; it does not go into debt and die.
  town.wealth = Math.max(0, town.wealth + d.yield);

  // Prosperity LAGS deliberately. This is the whole reason it is stored rather
  // than derived: the ledger changes today, the town's standing changes slowly.
  town.prosperity = clamp(town.prosperity + (prosperityTarget(town, d) - town.prosperity) * PROSPERITY.lag, 0, 100);

  // Population drifts toward what the town can feed and hold. Kept as a float so
  // the drift is smooth; only ever shown rounded.
  town.population = Math.max(POP.floor, town.population + (carryingCapacity(town) - town.population) * POP.drift);

  town.season++;
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
    `${land} ${cap(wealthWord(town))}. ${makes}. ` +
    `${article(d.tier)} ${d.tier} watch.`
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
