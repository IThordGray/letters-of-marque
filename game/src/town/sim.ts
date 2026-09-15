// The town sim — pure systems over the town struct. No DOM, no rendering: the
// same town in gives the same town out, so this runs headless.
//
// The beat is a SEASON (four per year). The town never prompts; it accumulates,
// and reports in prose when someone looks.
//
// THE TOWN KEEPS NO CLOCK. [HC-9] says there is one clock and it lives in world
// state; [HC-71] says the world drives the ledger and the ledger never reaches
// out. So every function below that needs to know when it is TAKES THE DAY AS AN
// ARGUMENT — the same integer `world.day` is, days since world epoch. Nothing
// here imports a `World`, reads `world.day`, or calls anything that takes one.
// The only thing it borrows from `overworld/` is the calendar, a leaf that
// imports nothing and is a definition table ([HC-90]).

import { CALENDAR, yearOfDay } from "../overworld/calendar";
import type { Town, Derived, Patron, WeatherDay } from "./types";
import type { Land } from "./land";
import { describeLand } from "./land";
import { damageWorks, harvestShare, stepWorks, unmetNeeds, CATALOGUE } from "./works";
import { makeFootprint } from "./footprint";
import { commerceOf, makeMarket, payImports, dependencyWord } from "./trade";
import { FOOD, POP, WEALTH, WORKS, PROSPERITY, SECURITY, PROSPERITY_BANDS, WEALTH_BANDS } from "./constants";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---- Derived quantities ----------------------------------------------------
// Recomputed from the ledger every time they're asked for. Nothing here is
// stored: a derived number can never drift away from the sentence explaining it.
export function derive(town: Town): Derived {
  const working = town.works.filter((w) => w.condition === "working");

  // [HC-6]: what the weather took off this season's harvest, applied where the
  // harvest is counted and nowhere else. `harvestShare` is the one definition of
  // it, and `commerceOf` reads the same one for the cargo half.
  const harvest = harvestShare(town);
  const food = sum(working, (w) => w.food) * harvest;
  const mouths = town.population * FOOD.perHead;
  const trade = sum(working, (w) => w.trade) * harvest;
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
//
// AND THERE IS NO FLOOR UNDER IT (KAN-106). This used to end
// `Math.max(POP.floor, …)`, which meant a place razed to nothing was feeding
// twelve souls it did not have — `Abandoned` could not be reached by anything,
// against [HC-67] and [HC-50]. The hamlet floor is real but it is EMERGENT: what
// people raise for themselves out of the catalogue, and nobody raises anything.
export function carryingCapacity(town: Town): number {
  // The SAME share `derive` scales the harvest by ([P-47]): a spoiled harvest
  // feeds fewer people, and it would be a quiet bug for the food a town sells to
  // fall while the mouths it can keep did not.
  const grown = sum(town.works.filter((w) => w.condition === "working"), (w) => w.food) * harvestShare(town);
  const foodCap = (grown + town.market.bought[0]) / FOOD.perHead;
  const { min, fullAt } = POP.prosperityPull;
  const pull = min + (1 - min) * clamp(town.prosperity / fullAt, 0, 1);
  return foodCap * pull;
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

// ---- The weather, as an input row ------------------------------------------
//
// [HC-72] rows five and six, and [HC-6] IS THE WHOLE DESIGN: weather has two
// output paths and they must not be mixed.
//
//   DAMAGE is an EVENT.    It lands today — a work drops a grade, or at the top
//                          of the spectrum one is destroyed — and so does the
//                          coin that went down with it ([HC-36]: "contents
//                          spoil" is a wealth loss, never a stockpile deduction,
//                          because there is no stockpile).
//   YIELD is a MODIFIER.   It is added to the season's account and spent once,
//                          when the books are struck. A downpour does not reach
//                          into a ledger that has not been struck yet.
//
// [HC-71]: the world drives the ledger and the ledger never reaches out. Nothing
// here knows what a storm is, where it was, or whether one existed — it is given
// four numbers and applies them ([HC-33], [P-17b]).
export function takeWeather(town: Town, day: number, w: WeatherDay, pick: number): void {
  // THE MODIFIER. Never more than all of it, clamped where it is written so
  // there is one meaning of the number and not two ([P-47]).
  const loss = town.harvestLoss + w.yieldLoss;
  town.harvestLoss = loss > 1 ? 1 : loss;

  // THE EVENT, both halves of it, today.
  town.wealth -= town.wealth * w.wealthLoss;
  if (w.worksDropped > 0 || w.worksDestroyed > 0) {
    damageWorks(town, w.worksDropped, w.worksDestroyed, pick, day);
  }
}

// The books are struck and the weather's account against THAT harvest is closed
// with them. The next ninety days start from nothing.
//
// It is one line and it is a function anyway, because the rule is "reset when the
// season resolves" and there are two drivers that resolve a season — the world's
// five phases and a lone town's two. One definition, two callers.
export function closeHarvest(town: Town): void {
  town.harvestLoss = 0;
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
export function produceSeason(town: Town, day: number): void {
  stepWorks(town, day);
}

// Phase 3 — SETTLE. Imports are paid FIRST out of what the season made ([HC-78]:
// bread before batteries), wealth is the remainder, prosperity lags toward its
// target, population drifts toward what the town can now feed.
//
// IT TAKES NO DAY, and that is the shape of the fix rather than an oversight. The
// only time-bearing line it ever had was `town.season++` — the private counter
// [HC-9] forbids — and settling coin, standing and souls needs no date at all.
// [P-17b]: a function that is not GIVEN the day cannot start reading one.
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
  //
  // No floor here either (KAN-106): a place with nothing to feed anybody has a
  // capacity of zero, and this line then drifts it toward zero and leaves it
  // there. Growth needs survivors because CAPACITY needs them — every food work
  // in the catalogue costs hands, and hands come only from souls.
  town.population = town.population + (carryingCapacity(town) - town.population) * POP.drift;
}

// One season, on a named day. `day` is the FIRST DAY OF THE SEASON — the day the
// world was standing on when `startsSeason` came back true.
export function stepSeason(town: Town, day: number): void {
  produceSeason(town, day);
  settleSeason(town);
  closeHarvest(town);
}

// Run a town on its own for a stretch of seasons, from a named starting day.
//
// THIS IS A DRIVER, NOT A CLOCK, and the difference is the whole of why `from` is
// a parameter rather than state. It advances a LOCAL counter and hands each
// season its day; it writes nothing back to the town, because the town has
// nowhere to keep it. A caller that wants two runs to join up passes the second
// one the day the first ended on — which is what the world does, and what
// `town.season` used to do invisibly and wrongly.
//
// The season is the town's beat ([HC-2]), so this is the primitive and `stepYears`
// is the convenience over it. Neither divides or multiplies a calendar of its own.
export function stepSeasons(town: Town, seasons: number, from = 0): void {
  for (let i = 0; i < seasons; i++) stepSeason(town, from + i * CALENDAR.daysPerSeason);
}

export function stepYears(town: Town, years: number, from = 0): void {
  stepSeasons(town, years * CALENDAR.seasonsPerYear, from);
}

// ---- Construction ----------------------------------------------------------
export function makeTown(init: Partial<Town> & { name: string; seed: number }): Town {
  return {
    id: 1,
    archetype: "colony",
    patron: { kind: "none", name: "", owns: false },
    foundedDay: 0,
    population: 80,
    wealth: WEALTH.start,
    prosperity: PROSPERITY.start,
    land: [],
    water: [],
    regions: [],
    works: [],
    footprint: makeFootprint(),
    governor: "",
    harvestLoss: 0,
    grant: 0,
    market: makeMarket(),
    nextWorkId: 1,
    lastThreatDay: null,
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
//
// `year(town)` USED TO LIVE HERE and it was the bug, stated in one line:
// `town.founded + floor(town.season / SEASONS_PER_YEAR)` — a year the town
// reckoned from its own founding, off a counter only it kept, divided by a second
// copy of the calendar. Two places founded in different years each believed year 1
// was their own (KAN-107). A year is now read off a DAY, by whoever is asking, out
// of the one calendar: `yearOfDay(day)`.

function band(v: number, bands: { at: number; word: string }[]): string {
  for (const b of bands) if (v >= b.at) return b.word;
  return bands[bands.length - 1].word;
}

export const prosperityWord = (town: Town) => band(town.prosperity, PROSPERITY_BANDS);
export const wealthWord = (town: Town) => band(town.wealth, WEALTH_BANDS);

// Low without a second number: the bottom two rungs of the same bands the town
// card already reads from — `struggling` or `on its knees`, `short of coin` or
// `the coffers are bare`. [P-47]: a quantity the ledger already words does not
// get a threshold of its own to drift from.
const bottomTwo = (v: number, bands: { at: number; word: string }[]) => v < bands[bands.length - 3].at;

// The three failure states (spec §9.5). [HC-66]: NONE OF THEM IS STORED — all
// three are readings of the ledger, answered when someone asks and never kept.
// A stored one could drift from the ledger that justifies it, and a sticky one
// would demote a place by the back door, which [HC-17] forbids.
//
// `null` is the ordinary case. A place is not obliged to be failing.
export type Failure = "poor" | "ruined" | "abandoned";

export function failureWord(town: Town): Failure | null {
  let standing = 0; // anything that is not yet a ruin
  let trades = 0; // capital works still working
  let wrecks = 0; // ...and capital works past reviving
  for (let i = 0; i < town.works.length; i++) {
    const w = town.works[i];
    if (w.condition !== "ruin") standing++;
    if (CATALOGUE[w.kind].cls !== "capital") continue;
    if (w.condition === "working") trades++;
    else if (w.condition !== "idle") wrecks++; // decayed or ruin
  }

  // ABANDONED — no people and no works, and it never comes back. [HC-67] is the
  // whole mechanism and it needs nothing of its own: subsistence raises
  // `ceil(population / autoPer)` of itself, which at nobody is nothing, and every
  // food work in the catalogue costs hands that only souls supply. Razing removes
  // the people, and with them the floor.
  if (town.population < 1 && standing === 0) return "abandoned";

  // RUINED — sitting on the hamlet floor: nothing but subsistence working, and the
  // wreck of what the place was still on the ground. "Only with substantial outside
  // help" is not a separate rule either — `allocateLabour` revives an IDLE work and
  // nothing in the ledger revives a decayed one.
  //
  // The wreck is what tells a fallen town from a young hamlet, and it is why a
  // place that never rose reads as neither: [HC-66] means the reading can only see
  // the ledger, so the ruins ARE the memory.
  if (trades === 0 && wrecks > 0) return "ruined";

  // POOR — the works still work; it is the coin and the standing that are low.
  if (bottomTwo(town.prosperity, PROSPERITY_BANDS) && bottomTwo(town.wealth, WEALTH_BANDS)) return "poor";

  return null;
}

// A one-line read of the place. The full town card and chronicle are KAN-75 —
// this is the minimum needed to see the sim working.
//
// It takes the DAY and turns it into a year here, at the one point that wants a
// year: prose. [P-47] — one number in, the reading derived from it. Handing this
// function a year instead would mean somebody upstream held both.
export function summarise(town: Town, day: number): string {
  const d = derive(town);
  const earners = town.works.filter((w) => w.condition === "working" && w.trade > 0 && CATALOGUE[w.kind].cls === "capital");
  const makes = earners.length
    ? `Works ${[...new Set(earners.map((w) => w.name))].join(", ")}`
    : "Makes nothing anyone would buy";
  const land = town.regions.length ? ` Set among ${describeLand(town)}.` : "";
  return (
    `${town.name}, ${yearOfDay(day)} — a town of ${Math.round(town.population)} souls, ${prosperityWord(town)}.` +
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
