// The world generator — one seed in, one world out — and then the warm start,
// which runs that world forward until it has a past.
//
// THE TWO HALVES ARE DELIBERATELY SEPARATE, and the split is the answer to §6's
// table rather than a convenience. `generateWorld` writes the MAP:
//
//   landmasses and coastlines · climate zones · the ~50 place positions ·
//   each place's size x purpose x faction at day 0 · each place's land, cut
//   from the map at its position · which crown holds what · the neutral set ·
//   and, since KAN-99, the DAY EACH PLACE WAS FOUNDED
//
// None of that is a ledger, none of it costs a tick, and every test that only
// wants a map pays only for a map. `warmStart` writes the LEDGERS, and it writes
// them the only way [HC-22] can be satisfied without a second way to build a
// town: by running the ordinary rules.
//
// [HC-11] Reproducible means the whole history, not the starting state. Every
//         number below is a pure function of the seed, so `generateWorld(n)`
//         twice over is the same world twice over, on any machine — and
//         `warmStart(n)` twice over is the same eighty years twice over.

import type { Archetype, Town } from "../town/types";
import { foundTown } from "../town/sim";
import { stepWorks } from "../town/works";
import { makeWorld, yearOf, type World } from "./clock";
import { yearOfDay } from "./calendar";
import { makeZones, CLIMATES } from "./climate";
import { RING_DAYS, passageDays } from "./dispatch";
import { FACTIONS, makeNations } from "./factions";
import { groundAt } from "./ground";
import { makeMarkets, noWars, openRoutes, runDays, type Markets, type Routes, type Wars } from "./market";
import { makePlaces, SITING, SIZES, type Place } from "./places";
import type { Land } from "../town/land";
import { DEFAULT_WORLD, distanceNm, makeShape, type WorldSettings } from "./shape";
import { skyOf, type Sky } from "./weather";

// ---- Generating -----------------------------------------------------------
//
// THE SETTINGS ARE AN ARGUMENT WITH A DEFAULT AND NOTHING ELSE. `generateWorld(seed)`
// is the sea every number in this project was measured on; `generateWorld(seed, {...})`
// is another one. There is no settings file and no preset — see `WorldSettings`.

export function generateWorld(seed: number, settings: WorldSettings = DEFAULT_WORLD): World {
  refuseTheImpossible(settings);
  const world = makeWorld(seed);
  world.shape = makeShape(world.seed, settings);
  world.zones = makeZones(world.seed, settings);
  world.nations = makeNations();
  // The places take the nations because seating a crown is part of deciding who
  // holds what: the five great harbours ARE the five seats ([HC-39]).
  const sited = makePlaces(world.seed, world.shape, world.zones, world.nations, settings.towns);
  world.places = sited.places;
  // ...and then the one decision no single coast can make for itself, read off
  // the same cut the classing was decided on.
  grantTimber(world, sited.land);
  return world;
}

// ---- A world the physics will not build ------------------------------------
//
// A SETTING IS A REQUEST, AND TWO REQUESTS CANNOT BE HONOURED AT ALL. Both are
// arithmetic against a physical fact, both are answered before a single lobe is
// drawn, and both say what is wrong in the sentence rather than leaving a broken
// world for a test forty files away to trip over. THIS IS THE ONE THING IN THE
// PROJECT THAT THROWS, and it does not cross [HC-1], which is about the PLAYER:
// no engine may ever need his attention to proceed. Nobody is playing yet —
// there is no world, only a request for one that no sea could satisfy, and the
// caller is the programmer who wrote the numbers.
//
// The most ports a sea can hold, if the coast ran wherever it was needed: ports
// keep `minSpacingNm` between them, so each one owns a hexagon of that width and
// the densest possible packing is the sea's area divided by it. A REAL coastline
// carries far fewer — this sea's own carries a quarter of its 191 — so passing
// this is not a promise that the siting will fill the order, only that it is not
// arithmetically hopeless.
const mostPorts = (w: WorldSettings): number =>
  Math.floor((w.widthNm * w.heightNm) / (SITING.minSpacingNm * SITING.minSpacingNm * Math.sqrt(3) * 0.5));

function refuseTheImpossible(w: WorldSettings): void {
  const most = mostPorts(w);
  if (w.towns > most) {
    throw new Error(
      `a sea of ${w.widthNm} by ${w.heightNm} nm holds at most ${most} ports ` +
        `${SITING.minSpacingNm} nm apart, and ${w.towns} were asked for`,
    );
  }
  // ...and the other end: every passage in the world is filed in a ring of
  // `RING_DAYS` buckets, so a crossing that takes longer than the ring is a
  // dispatch posted into a slot nobody opens. The longest any sea can ask for is
  // its own diagonal.
  const days = passageDays(distanceNm(0, 0, w.widthNm, w.heightNm));
  if (days >= RING_DAYS) {
    throw new Error(
      `a sea of ${w.widthNm} by ${w.heightNm} nm is ${days} days corner to corner, ` +
        `and a passage must arrive within ${RING_DAYS}`,
    );
  }
}

// ---- Every market can reach timber -----------------------------------------
//
// RATIFIED 2026-09-16: materials are guaranteed at the MARKET NEIGHBOURHOOD,
// never per place. Every place must be able to REACH timber; most must BUY it.
//
// WHY THE WORLD OWES ANYTHING AT ALL. `guaranteeVictuals` has undertaken since
// KAN-98 that every place bears food, citing [HC-22] — and nothing undertook
// anything about timber, which has no substitute: `sawpit` is the only work in
// the catalogue that produces materials (a shipway produces nothing and is now
// gated by planks like anything else),
// and nothing quarries stone at all. So materials come from one plant, and they
// come across a market ([HC-83] clears per neighbourhood, and a flow balance
// holds no stock, so planks never make two hops). Measured on master: 5 to 22 of
// a world's fifty neighbourhoods held no timber anywhere, and a place inside one
// froze at its FIRST capital work for two centuries — [HC-87c]'s build gate
// firing correctly against a world that had nowhere to buy from.
//
// WHY A COVERING AND NOT A LOOP. Neighbourhoods OVERLAP ([HC-82]), so a place
// sits in several and one stand of timber can answer for all of them. Granting
// one per hood would put timber behind half the coasts on the map, and a world
// where everybody grows their own planks has no plank trade in it — which is the
// outcome the human rejected when he chose this over giving materials a second
// source. So: take the coast that answers the most markets still wanting one,
// grant it, and ask again. Fewest stands, most markets fed.
//
// WHAT IT NEVER OVERRULES. [HC-28]: the stand is whatever the zone's own table
// calls a stand, and a test holds that every zone's answer is on its own palette
// — the guarantee argues with the map, never with the climate. [HC-22]: the
// stand is cut out of ground that bears no food, so a coast that is all fields
// has nothing to spare and the covering passes it over and rescues its market
// through a neighbour instead.
//
// [P-1]: IT CUTS NOTHING. The ground it reads is the cut `makePlaces` already
// made to class the fifty, handed straight on — a third pass over fifty towns'
// ground to learn fifty booleans measured 34 ms and did not fight to be there.
// The neighbourhoods ARE asked a second time ([P-2]: 2,500 distances, once per
// world) because positions never move, so the two answers cannot differ and the
// alternative is a derived fact stored on the World ([HC-14], [P-47]).
export function grantTimber(world: World, land: Land[]): void {
  const places = world.places;
  const n = places.length;
  const markets = makeMarkets(places);

  // What the map gave, and what a coast could spare if asked. Ground that bears
  // food is never eligible to carry a stand — [HC-22] is not traded for planks —
  // so a place with nothing but fields cannot be granted and the covering passes
  // it over.
  const bears: boolean[] = [];
  const canSpare: boolean[] = [];
  for (let i = 0; i < n; i++) {
    let timber = false;
    let spare = false;
    for (const r of land[i].regions) {
      if (r.bears.timber !== undefined) timber = true;
      if (r.bears.food === undefined && !isWater(r.terrain)) spare = true;
    }
    bears.push(timber);
    canSpare.push(spare);
  }

  // The markets that cannot reach a plank today.
  const wanting = new Set<number>();
  for (const h of markets.hoods) {
    if (!h.members.some((id) => bears[id])) wanting.add(h.id);
  }

  while (wanting.size > 0) {
    let best = -1;
    let bestAnswers = 0;
    for (let i = 0; i < n; i++) {
      if (bears[i] || !canSpare[i]) continue;
      let answers = 0;
      for (const h of markets.hoods) {
        if (wanting.has(h.id) && h.members.indexOf(i) >= 0) answers++;
      }
      // A total order with an explicit direction ([P-10]): the most markets
      // answered, and the lower id on a tie — so which coast is planted is never
      // decided by which one the loop reached first.
      if (answers > bestAnswers) {
        best = i;
        bestAnswers = answers;
      }
    }
    // Nothing left that can carry a stand. The markets still wanting one are
    // reported rather than papered over — `describeWorld` says so, and a test
    // holds that this world has none.
    if (best < 0) break;
    places[best].timberGranted = true;
    bears[best] = true;
    for (const h of markets.hoods) {
      if (h.members.indexOf(best) >= 0) wanting.delete(h.id);
    }
  }
}

const isWater = (t: string): boolean => t === "openSea" || t === "reef" || t === "roadstead";

// How many of the fifty bear timber, and how many markets still cannot reach
// any — the sentence a person checks the covering against ([HC-16] applied to
// the generator). The second number should always read none.
export function describeTimber(world: World): string {
  const markets = makeMarkets(world.places);
  const bears = world.places.map((p) => groundAt(world, p).regions.some((r) => r.bears.timber !== undefined));
  const n = bears.filter(Boolean).length;
  const granted = world.places.filter((p) => p.timberGranted).length;
  const dry = markets.hoods.filter((h) => !h.members.some((id) => bears[id])).length;
  return (
    `${n} of ${world.places.length} coasts bear timber (${granted} of them because the covering said so); ` +
    `the rest must buy their planks. ` +
    (dry === 0 ? "Every market can reach a sawpit." : `${dry} markets cannot reach one.`)
  );
}

// ---- Founding a place on the ground the world gives it ---------------------
//
// [HC-71] The world drives the ledger; the ledger never reaches out. So this is
//         a one-way funnel: the world assembles everything a place needs and
//         hands it over. `foundTown` accepts ground and asks nothing.
// [HC-19] / §10.4: the land is CUT here, and `town.seed` is DERIVED here. Both
//         were the two things a town used to invent for itself.

// What the crown puts in per season, pending the dispatch object. THE HONEST
// LABEL: [HC-45] says a dispatch is credited on ARRIVAL and [HC-46] says a
// governor plans only on what has arrived, so a standing per-season figure is a
// STAND-IN for a shipment that can be intercepted. KAN-105 replaces it, and
// when it does this table dies. A neutral place has no patron at all ([HC-52])
// and therefore no safety net: it lives on exactly what comes over its beach.
const STANDING_GRANT = { civilian: 4, trade: 3, military: 14 } as const;

// The shipped governor still reads `archetype` for its agenda and its sprawl
// temperament. §10.4 RETIRES that field — priorities move to purpose, sprawl to
// funding — but retiring it is not this ticket. So this is the bridge, written
// in one place so there is one thing to delete: purpose and faction decide the
// agenda, exactly as §9.2 says they should.
function archetypeOf(world: World, place: Place): Archetype {
  if (!world.nations[place.faction].crown) return "pirateHaven";
  return place.purpose === "military" ? "royalOutpost" : "colony";
}

// A place, on the day its settlers landed. THE ONLY WAY A TOWN IS EVER BUILT —
// the warm start calls this and nothing else, which is what keeps [HC-22] true
// by construction and keeps `[P-47]` from acquiring a second path to a ledger.
export function foundPlace(world: World, place: Place): Town {
  const nation = world.nations[place.faction];
  const faction = FACTIONS[nation.faction];
  const town = foundTown(
    {
      name: place.name,
      // §10.4: derived from the world seed, not independent ([HC-10]).
      seed: place.seed,
      archetype: archetypeOf(world, place),
      patron: nation.crown
        ? { kind: "crown", name: faction.name, owns: true }
        : { kind: "none", name: "", owns: false },
      governor: place.governor,
      grant: nation.crown ? STANDING_GRANT[place.purpose] : 0,
      population: place.population,
      wealth: place.wealth,
      // THE DAY IT WAS FOUNDED, AND IT IS NEGATIVE. Every place on this map was
      // founded before the epoch — the waves are in `places.ts` — so this is the
      // first thing in the project ever to write a day below zero, which
      // `calendar.ts` was built and tested for (KAN-107, KAN-99).
      foundedDay: place.foundedDay,
    },
    groundAt(world, place),
  );
  // The settlers put up their own huts and break their own ground on the day
  // they land. This is the ledger's own `stepWorks` and the hamlet floor doing
  // exactly what they do every season afterwards ([HC-67]) — NOT a second way to
  // build a town, and not a solver. What replaced `settleOpening` is the
  // pre-run: there is nothing here that decides how big the place ought to be.
  stepWorks(town, town.foundedDay);
  return town;
}

// A coast where the settlers have not landed yet. It is on the map, it belongs
// to somebody, and there is nothing there.
//
// WHY IT IS A TOWN AT ALL: the clearing indexes towns by place id ([HC-82]'s
// neighbourhoods hold ids, and `reachOf` reads a place's own row), so the array
// has to stay parallel to `world.places` from the first day of the pre-run. It
// holds nobody, no ground, no works, no patron and no purse — so it produces
// nothing, offers nothing, wants nothing and bids nothing, and the clearing
// needs no rule about it. THAT is the reason it is built this way rather than
// guarded for in four places ([P-17b]: the fact cannot arrive, so nothing has to
// remember to check for it).
function awaitingSettlers(place: Place): Town {
  return foundTown(
    {
      name: place.name,
      seed: place.seed,
      governor: place.governor,
      foundedDay: place.foundedDay,
      population: 0,
      wealth: 0,
      prosperity: 0,
      grant: 0,
    },
    { land: [], water: [], regions: [] },
  );
}

// Every place, AS THE WORLD STANDS TODAY: founded where its day has come, an
// empty coast where it has not. This is what a headless run of the world stands
// on, and it is deliberately a function rather than state: the world holds its
// places, not their ledgers.
export const foundAll = (world: World): Town[] =>
  world.places.map((p) => (world.day >= p.foundedDay ? foundPlace(world, p) : awaitingSettlers(p)));

// ---- The warm start --------------------------------------------------------
//
// §6: "The generator writes a believable 1660s map — cities already cities, a
// great port here, a hamlet there — and the simulation runs on from that day. It
// is not a cold world watched from its origin."
//
// RATIFIED 2026-09-16, and this is the whole of the method: GENERATE A COLD
// WORLD, FOUND ITS PLACES IN WAVES, RUN IT FORWARD WITH THE REAL WEATHER, TRADE
// AND GOVERNOR, AND CALL THE END DAY 0.
//
// WHY THIS AND NOT A SOLVER. [HC-22] asks for a day-0 ledger "the ordinary rules
// COULD HAVE PRODUCED and can sustain". A world that was produced by the
// ordinary rules satisfies that by construction, and — the part that matters
// more — it needs no second way to build a town, which is the bug class [P-47]
// names and which the ticket forbids outright. Everything day 0 holds, on all
// four axes, is the ledger's own: population, works, wealth AND footprint.
//
// WHY WAVES. Running forward alone would make every place the same AGE, and that
// is the one axis on which it genuinely flattens the world — no old cities, no
// raw outposts, every port eighty years old to the day. So each place is founded
// at its own point during the pre-run and runs from there. It is also the right
// period: a 1660s Caribbean was old Spanish cities beside brand-new English and
// French footholds.
//
// WHAT IT COSTS, honestly ([P-39]). The pre-run is the real cost of the method
// and it is not small: roughly two and a half thousand town-years of the full
// seasonal tick, which is most of a second. That is why it is NOT inside
// `generateWorld`: a test that wants a coastline should not buy a century of
// history, and the suite generates worlds constantly.

export interface WarmWorld {
  world: World;
  towns: Town[]; // indexed by place id, every one of them founded and run
  markets: Markets;
  wars: Wars;
  routes: Routes;
  sky: Sky;
}

// The distinct founding days, earliest first. A wave is however many places
// share a day; there are usually a few dozen waves across the pre-run, and the
// list is built once ([P-2] — this is generation, not a tick).
function wavesOf(places: Place[]): number[] {
  const days: number[] = [];
  for (let i = 0; i < places.length; i++) {
    if (days.indexOf(places[i].foundedDay) < 0) days.push(places[i].foundedDay);
  }
  return days.sort((a, b) => a - b);
}

export function warmStart(seed: number): WarmWorld {
  const world = generateWorld(seed);
  const markets = makeMarkets(world.places);
  const wars = noWars(world.nations.length);
  const routes = openRoutes(markets);
  // Built ONCE and carried across every leg of the pre-run ([P-18]): it is
  // per-zone and per-place scratch that the daily tick refills, and a second one
  // would be the same numbers computed again.
  const sky = skyOf(world);

  const waves = wavesOf(world.places);
  // The clock winds back to the first landing. Everything from here is the
  // ordinary driver — the same `runDays` the view calls, so there is exactly one
  // copy of the tick order in the project ([P-47]).
  world.day = waves.length > 0 ? waves[0] : 0;
  const towns = foundAll(world);

  for (let k = 1; k < waves.length; k++) {
    runDays(world, towns, markets, wars, routes, waves[k] - world.day, sky);
    // ...and the next party comes ashore. They join the season that begins on
    // the day they land, because a founding day is snapped to a season boundary.
    for (let i = 0; i < world.places.length; i++) {
      if (world.places[i].foundedDay === waves[k]) towns[i] = foundPlace(world, world.places[i]);
    }
  }
  runDays(world, towns, markets, wars, routes, 0 - world.day, sky);

  return { world, towns, markets, wars, routes, sky };
}

// ---- Reading a world back --------------------------------------------------

// A line a person can check the generator against. [HC-16]'s discipline applied
// to the generator itself: if it cannot be said, it probably is not right.
export function describeWorld(world: World): string {
  const byClass = (Object.keys(SIZES) as (keyof typeof SIZES)[])
    .map((s) => `${world.places.filter((p) => p.size === s).length} ${s === "city" ? "cities" : s + "s"}`)
    .join(", ");
  const zones = world.zones.map((z) => CLIMATES[z.climate].name);
  const neutral = world.places.filter((p) => !world.nations[p.faction].crown).length;
  return (
    `A sea of ${world.shape.widthNm} by ${world.shape.heightNm} nautical miles in ${yearOf(world)}: ` +
    `${world.places.length} places — ${byClass} — across ${world.zones.length} zones ` +
    `(${[...new Set(zones)].join(", ")}). ${neutral} of them answer to no crown. ${describeFoundings(world)} ` +
    describeTimber(world)
  );
}

// The warm start's own sentence, and the one a person checks the WAVES against:
// a map on which every port was founded in the same decade is a map that has
// flattened the one axis running the world forward cannot vary by itself.
function describeFoundings(world: World): string {
  if (world.places.length === 0) return "Nobody has landed anywhere.";
  let oldest = world.places[0].foundedDay;
  let newest = world.places[0].foundedDay;
  for (let i = 1; i < world.places.length; i++) {
    const d = world.places[i].foundedDay;
    if (d < oldest) oldest = d;
    if (d > newest) newest = d;
  }
  return `The eldest was founded in ${yearOfDay(oldest)} and the youngest in ${yearOfDay(newest)}.`;
}
