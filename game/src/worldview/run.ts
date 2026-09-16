// The view's world — one seed in, a running century out, and a snapshot of it
// shaped for a renderer to read without asking the simulation anything.
//
// [P-2]  Judge cost as complexity x TICK RATE. This file is where that rule is
//        actually spent, and the whole design of it is one sentence: NOTHING
//        DERIVED IS COMPUTED PER FRAME. `derive()`, `summarise()` and `wants()`
//        run on the seasonal beat — and, for `wants()`, on the seasonal beat for
//        ONE place — while a frame reads stored numbers out of the arrays below.
//        `wants()` alone costs 16.75 microseconds and rebuilds thirty-six `Set`s
//        per call ([P-18], performance.md §7); fifty of those sixty times a
//        second would be fifty milliseconds a frame for a card showing one town.
// [P-17c] A derived quantity is BAKED when its READER'S tick rate makes deriving
//        ruinous, and the bake belongs to the reader. The snapshot is that bake:
//        it is not on the `World`, it is never saved, and the simulation cannot
//        see it ([HC-14], [HC-26]).
// [HC-11] Reproducible means the whole history, not the starting state. The same
//        seed fast-forwarded twice gives the same two hundred years, at any
//        speed. That property is the one a view can silently destroy, and the
//        way it is protected here is structural: the speed control decides ONLY
//        how many days `pump` is asked for, and `pump` hands them to `runDays`
//        one at a time. There is no other path into the world.
// [P-11] Nothing in this file reads a clock. It is in `worldview/` because it is
//        presentation, not because it needs the permission that directory grants.
//        The clock is read in `main.ts`, by the loop, and nowhere else.

import { DAYS_PER_YEAR, dayInSeason, seasonOfDay, yearOfDay } from "../overworld/calendar";
import { type World } from "../overworld/clock";
import { CLIMATES } from "../overworld/climate";
import { inFlight, type Dispatch } from "../overworld/dispatch";
import { FACTIONS } from "../overworld/factions";
import { runDays, type Markets, type Routes, type Wars, type WorldSeason } from "../overworld/market";
import { SIZES, type Place } from "../overworld/places";
import { bandAt, feltAt, type Sky } from "../overworld/weather";
import { warmStart } from "../overworld/worldgen";
import { derive, prosperityWord, summarise, wealthWord } from "../town/sim";
import { wants, type Want } from "../town/governor";
import type { Town } from "../town/types";
import { makeStanding, notableCrown, notablePlace, type Notable, type Standing } from "./notable";
import { makeTrend, recordTrend, type Trend } from "./trend";

export const FEED = {
  // A chronicle, not a log. At 247 lines a century the cap is four centuries of
  // watching, and it is trimmed in one batch rather than one line at a time so a
  // splice is never in the daily path ([P-24]).
  keep: 1200,
  trimTo: 900,
} as const;

export const SCAR = {
  // How long a place wears the mark of what the sea took. Long enough to be seen
  // at CENTURY (two years a second), short enough that the map is not a wall of
  // scars: a season.
  days: 90,
} as const;

// ---- What a frame is allowed to read ---------------------------------------
//
// One entry per place, written on the beats and read at the frame rate. Every
// field is either stored world state copied across or an O(1)/O(works) count —
// there is no `derive()` in here, by design.
export interface PlaceView {
  id: number;
  name: string;
  x: number;
  y: number;
  // The three axes, and [HC-69] is why all three are here: what a place IS must
  // be readable before you land. Shape draws purpose, colour draws faction, the
  // rim draws class, and the area draws the people.
  faction: number;
  purpose: string;
  sizeRank: number;
  sizeName: string;
  // Written on the seasonal beat — which is also the ONLY beat on which any of
  // them moves, so the map is never showing a stale number. Population and
  // prosperity settle in phase 3 and works are raised in phase 4; nothing in the
  // daily tick touches any of them.
  //
  // WEALTH IS DELIBERATELY NOT HERE, and its absence is the rule stated rather
  // than assumed: wealth falls on the DAY a place is hit ([HC-6] — damage is an
  // event and applies the day it happens), so a seasonal copy of it would be up
  // to ninety days out of date. The map does not draw it, so it does not need
  // one; the card reads it off the live ledger, once, when the card is built.
  // A snapshot field nobody draws is a second copy of a moving number waiting to
  // disagree with the first ([P-47], [P-1]).
  people: number;
  works: number;
  hale: number;
  ruined: number;
  // Written on the daily beat. [HC-32]: severity is sampled at the place and the
  // moment of contact, and the whole point of drawing it per place rather than
  // drawing the storm alone is that "two towns twenty miles apart may feel the
  // same event very differently."
  felt: number;
  band: number;
  // The rarer moment: the day this place actually lost something, and whether it
  // was a rung or a whole work. -1 for a place that never has.
  hurtDay: number;
  hurtKind: number; // 0 nothing · 1 a work dropped a grade · 2 a work taken
}

// The read-only card. [HC-1] forbids an engine prompting anyone and the human's
// brief for this milestone is NO PLAYER INTERACTION, so this is the whole of the
// view's reach into a place: prose and numbers, no verbs, nothing to press.
export interface Card {
  id: number;
  day: number;
  line: string; // summarise()
  governor: string;
  climate: string;
  holder: string;
  character: string;
  food: number;
  mouths: number;
  surplus: number;
  yield: number;
  security: number;
  garrison: string;
  handsNeeded: number;
  handsAvailable: number;
  dependency: number;
  // Read off the LIVE ledger at the moment the card was built, not out of the
  // map's snapshot: wealth moves on the day the weather hits and there is no
  // reason for a card to be a season behind a number nobody had to precompute.
  coin: number;
  standing: number;
  wealthWord: string;
  prosperityWord: string;
  wants: Want[];
}

export interface Run {
  seed: number;
  world: World;
  towns: Town[];
  markets: Markets;
  wars: Wars;
  routes: Routes;
  sky: Sky;

  places: PlaceView[];
  // Positions and mark radii, in the flat form a hit test wants ([P-36]: a typed
  // array cannot go holey and is never boxed). Rebuilt only when a radius could
  // have changed, which is the seasonal beat.
  xs: Float64Array;
  ys: Float64Array;

  // What the feed last saw. One object per place, allocated once ([P-26]).
  standing: Standing[];
  scratch: Standing;
  purse: Float64Array;

  trend: Trend;
  feed: Notable[];
  // Bumped whenever the feed or the trend gained something, so the DOM is
  // rebuilt on a change rather than on a frame.
  feedMark: number;
  trendMark: number;
  seasonMark: number;

  selected: number;
  card: Card | null;
}

// ---- Building one ----------------------------------------------------------

export function makeRun(seed: number): Run {
  // THE WARM START, and the whole of the view's relationship with it: the view
  // is handed a world that already has a past (KAN-99), and the day it opens on
  // is spring 1660 with century-old cities already on it.
  //
  // The wars and the routes come with it rather than being built again here.
  // Nations do not declare war yet (KAN-101) and nothing blockades anything yet,
  // so both are their honest empty cases — but they are the SAME empty cases the
  // pre-run used, not a second pair that happen to agree ([P-47]).
  const { world, towns, markets, wars, routes, sky } = warmStart(seed >>> 0);
  const n = world.places.length;
  const run: Run = {
    seed: seed >>> 0,
    world,
    towns,
    markets,
    wars,
    routes,
    sky,
    places: [],
    xs: new Float64Array(n),
    ys: new Float64Array(n),
    standing: [],
    scratch: makeStanding(),
    purse: new Float64Array(world.nations.length),
    trend: makeTrend(),
    feed: [],
    feedMark: 0,
    trendMark: 0,
    seasonMark: 0,
    selected: -1,
    card: null,
  };

  for (let i = 0; i < n; i++) {
    const p = world.places[i];
    run.places.push({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      faction: p.faction,
      purpose: p.purpose,
      sizeRank: SIZES[p.size].rank,
      sizeName: p.size,
      people: 0,
      works: 0,
      hale: 0,
      ruined: 0,
      felt: 0,
      band: 0,
      hurtDay: -1,
      hurtKind: 0,
    });
    run.xs[i] = p.x;
    run.ys[i] = p.y;
    run.standing.push(makeStanding());
  }
  for (let i = 0; i < world.nations.length; i++) run.purse[i] = world.nations[i].treasury;

  // The opening state, taken once so day 0 does not read as fifty catastrophes.
  takeLedgers(run);
  for (let i = 0; i < n; i++) readStanding(run, i, true, run.standing[i]);
  sampleSky(run);
  recordTrend(run.trend, world.day, totalPeople(run), totalCoin(run), totalWorks(run));
  return run;
}

// ---- Running it ------------------------------------------------------------

// Hand the world some days. THE ONLY WAY INTO THE WORLD, and the reason [HC-11]
// holds by construction rather than by promise: a speed setting decides how many
// days this is called with and nothing else. Whether they arrive one at a time
// from a frame at Watch, seventy-two at a time from a frame at Century, or
// thirty-six thousand at once from the button that runs a century without
// drawing, `runDays` sees the same sequence of whole days in the same order.
export function pump(run: Run, days: number): void {
  if (days <= 0) return;
  runDays(
    run.world,
    run.towns,
    run.markets,
    run.wars,
    run.routes,
    days,
    run.sky,
    (s) => takeSeason(run, s),
    () => takeDay(run),
  );
}

// A century, run the same way and simply not drawn. [HC-11]'s "identical at any
// speed" is not a promise here — it is the same function call.
export const century = (run: Run): void => pump(run, DAYS_PER_YEAR * 100);

// ---- The daily beat --------------------------------------------------------
//
// Called after the day has fully resolved and before the clock moves on, so
// `world.day` is the day being reported.
//
// [P-2] this is the highest-rate loop the view has, so what is in it had to
// fight. Fifty severity samples, five integer comparisons a place and eight for
// the crowns — and a walk of a place's works ONLY on a day that place felt
// something above Fair, which is 14% of place-days. That is [P-14] in the form
// available here: the list the expensive loop walks is the places that could
// have changed, and on most days it is empty.
//
// Measured: a headless century costs 962 ms without this and 1,081 ms with it.
function takeDay(run: Run): void {
  const day = run.world.day;
  sampleSky(run);

  const now = run.scratch;
  for (let i = 0; i < run.places.length; i++) {
    const was = run.standing[i];
    const byWeather = run.places[i].band > 0;
    readStanding(run, i, byWeather, now);
    notablePlace(day, i, was, now, byWeather, run.feed);
    // The scar. A loss outright outranks a rung, and both are read off the same
    // two counters the feed filter reads — there is no second path to the fact
    // ([P-47]).
    if (byWeather && now.ruined > was.ruined) {
      run.places[i].hurtDay = day;
      run.places[i].hurtKind = 2;
    } else if (byWeather && now.hale < was.hale) {
      run.places[i].hurtDay = day;
      run.places[i].hurtKind = 1;
    }
    copyStanding(now, was);
  }

  for (let i = 0; i < run.world.nations.length; i++) {
    const t = run.world.nations[i].treasury;
    notableCrown(day, i, run.purse[i], t, run.feed);
    run.purse[i] = t;
  }

  if (run.feed.length > FEED.keep) run.feed.splice(0, run.feed.length - FEED.trimTo);
  run.feedMark = run.feed.length;
}

// [HC-32] sampled at the place, on the day. Reads the SAME `feltAt` the daily
// tick just used, with the same hoisted `Sky` — one definition of what a place
// felt, two readers ([P-47]).
function sampleSky(run: Run): void {
  for (let i = 0; i < run.places.length; i++) {
    const felt = feltAt(run.world, run.world.places[i], run.sky);
    run.places[i].felt = felt;
    run.places[i].band = bandAt(felt);
  }
}

// ---- The seasonal beat -----------------------------------------------------
//
// Everything expensive lives here, because a season is 90 days and there are
// four a year: 400 of these across a century against 36,000 days and, at
// Century, 21,600 frames a century. [P-2] stated as a schedule.
function takeSeason(run: Run, s: WorldSeason): void {
  takeLedgers(run);
  // The works counters move at a season boundary for reasons that are NOT the
  // weather — the governor raised something, a work idled for want of hands, a
  // neglected one rotted out. Those are business, so the standing is refreshed
  // silently: `byWeather` is false and the filter admits nothing.
  const now = run.scratch;
  for (let i = 0; i < run.places.length; i++) {
    const was = run.standing[i];
    readStanding(run, i, true, now);
    notablePlace(s.day, i, was, now, false, run.feed);
    copyStanding(now, was);
  }
  if (recordTrend(run.trend, s.day, totalPeople(run), totalCoin(run), totalWorks(run))) {
    run.trendMark++;
  }
  run.feedMark = run.feed.length;
  run.seasonMark++;
  refreshCard(run);
}

// The stored three numbers plus a works tally, copied across. No `derive()`:
// population, wealth and prosperity are the three things a town actually stores,
// and the map draws exactly those.
function takeLedgers(run: Run): void {
  for (let i = 0; i < run.places.length; i++) {
    const t = run.towns[i];
    const v = run.places[i];
    v.people = t.population;
    v.works = t.works.length;
    v.faction = run.world.places[i].faction;
    v.sizeRank = SIZES[run.world.places[i].size].rank;
    v.sizeName = run.world.places[i].size;
  }
}

// One place's standing. `withWorks` is what makes the daily version cheap: on a
// day nothing could have touched this place's works, the counters are simply the
// ones already held.
function readStanding(run: Run, i: number, withWorks: boolean, out: Standing): void {
  const p = run.world.places[i];
  const t = run.towns[i];
  out.size = SIZES[p.size].rank;
  out.faction = p.faction;
  out.people = Math.round(t.population);
  if (!withWorks) {
    out.hale = run.standing[i].hale;
    out.ruined = run.standing[i].ruined;
    return;
  }
  let hale = 0;
  let ruined = 0;
  for (let k = 0; k < t.works.length; k++) {
    const c = t.works[k].condition;
    if (c === "working") hale++;
    else if (c === "ruin") ruined++;
  }
  out.hale = hale;
  out.ruined = ruined;
  run.places[i].hale = hale;
  run.places[i].ruined = ruined;
}

function copyStanding(from: Standing, to: Standing): void {
  to.size = from.size;
  to.faction = from.faction;
  to.ruined = from.ruined;
  to.hale = from.hale;
  to.people = from.people;
}

// ---- The world, totalled ---------------------------------------------------
//
// [P-9] float addition is not associative, so these are always walked in place
// order and the order is never "tidied". A trend line whose points depended on
// iteration order would be a graph of the loop rather than of the world.

export function totalPeople(run: Run): number {
  let sum = 0;
  for (let i = 0; i < run.towns.length; i++) sum += run.towns[i].population;
  return sum;
}

export function totalCoin(run: Run): number {
  let sum = 0;
  for (let i = 0; i < run.towns.length; i++) sum += run.towns[i].wealth;
  return sum;
}

export function totalWorks(run: Run): number {
  let sum = 0;
  for (let i = 0; i < run.towns.length; i++) sum += run.towns[i].works.length;
  return sum;
}

export function countByClass(run: Run): number[] {
  const out = [0, 0, 0];
  for (let i = 0; i < run.places.length; i++) out[run.places[i].sizeRank]++;
  return out;
}

// [P-16] an entity with a known trajectory has no present: a dispatch stores a
// departure and an arrival, and the view asks where it is. NOTHING SENDS ONE YET
// — nations acting is KAN-101 — so this returns an empty array for the whole of
// this milestone. It is drawn anyway, because the seam costs nothing and it is
// how the day nations start will announce itself on the chart.
export const dispatchesOf = (run: Run): Dispatch[] => inFlight(run.world);

// ---- The card --------------------------------------------------------------

export function select(run: Run, id: number): void {
  run.selected = id;
  refreshCard(run);
}

// [P-2], as literally as it can be stated: this is the only place `derive()`,
// `summarise()` and `wants()` are called at all, it runs on the seasonal beat and
// on a click, and it runs for ONE place. Forty-nine cards nobody is reading are
// forty-nine that do not have to be built ([P-1]).
function refreshCard(run: Run): void {
  const id = run.selected;
  if (id < 0 || id >= run.places.length) {
    run.card = null;
    return;
  }
  const t = run.towns[id];
  const p: Place = run.world.places[id];
  const day = run.world.day;
  const d = derive(t);
  const nation = run.world.nations[p.faction];
  const f = FACTIONS[nation.faction];
  run.card = {
    id,
    day,
    line: summarise(t, day),
    governor: p.governor,
    climate: CLIMATES[run.world.zones[p.zone].climate].name,
    holder: f.name,
    character: f.character,
    food: d.food,
    mouths: d.mouths,
    surplus: d.surplus,
    yield: d.yield,
    security: d.security,
    garrison: d.garrison,
    handsNeeded: d.hands.needed,
    handsAvailable: d.hands.available,
    dependency: d.dependency,
    coin: t.wealth,
    standing: t.prosperity,
    wealthWord: wealthWord(t),
    prosperityWord: prosperityWord(t),
    wants: wants(t, day, 3, d),
  };
}

// ---- Reading it back -------------------------------------------------------

const SEASON_NAMES = ["spring", "summer", "autumn", "winter"] as const;

export const seasonName = (day: number): string => SEASON_NAMES[seasonOfDay(day)];

export const dateOf = (day: number): string =>
  `${seasonName(day)} ${yearOfDay(day)}, day ${dayInSeason(day) + 1}`;

// The feed's prose. It lives HERE rather than in `notable.ts` for the same
// reason the sim never holds a string ([P-38]): the filter is integers, and the
// names belong to the world that holds them. [HC-16]'s discipline — if it cannot
// be said in a sentence, it probably is not worth reporting.
export function describeNotable(run: Run, e: Notable): string {
  const when = `${yearOfDay(e.day)}, ${seasonName(e.day)}`;
  if (e.kind === "broke") {
    return `${when} — ${FACTIONS[run.world.nations[e.who].faction].name} has spent the last of its treasury.`;
  }
  const p = run.world.places[e.who];
  switch (e.kind) {
    case "lost":
      return e.n > 1
        ? `${when} — ${p.name} lost ${e.n} works to the sea.`
        : `${when} — the sea took a work at ${p.name}.`;
    case "promoted":
      return `${when} — ${p.name} is chartered a ${p.size}.`;
    case "taken":
      return `${when} — ${p.name} has changed hands; it answers to ${
        FACTIONS[run.world.nations[p.faction].faction].name
      } now.`;
    case "emptied":
      return `${when} — ${p.name} stands empty.`;
  }
}
