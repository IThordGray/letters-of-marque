// The world generator — one seed in, one world out, and then it stops.
//
// The build order's first step: "generate a world against a seed" (ratified
// 2026-09-09). This file is that step and nothing more. There is NO TICK LOOP
// here: weather (KAN-90), nations acting (KAN-101), dispatches (KAN-105), the
// mature warm-start ledgers (KAN-99) and any view of it (KAN-100) are all
// somebody else's, and the generator's contract is the table in §6:
//
//   landmasses and coastlines · climate zones · the ~50 place positions ·
//   each place's size x purpose x faction at day 0 · each place's land, cut
//   from the map at its position · the opening ledger · which crown holds what ·
//   the neutral set
//
// [HC-11] Reproducible means the whole history, not the starting state. Every
//         number below is a pure function of the seed, so `generateWorld(n)`
//         twice over is the same world twice over, on any machine.

import type { Archetype, Town } from "../town/types";
import { carryingCapacity, foundTown } from "../town/sim";
import { stepWorks } from "../town/works";
import { POP } from "../town/constants";
import { makeWorld, yearOf, type World } from "./clock";
import { makeZones, CLIMATES } from "./climate";
import { FACTIONS, makeNations } from "./factions";
import { groundAt } from "./ground";
import { makePlaces, SIZES, type Place } from "./places";
import { makeShape } from "./shape";

// ---- Generating -----------------------------------------------------------

export function generateWorld(seed: number): World {
  const world = makeWorld(seed);
  world.shape = makeShape(world.seed);
  world.zones = makeZones(world.seed);
  world.nations = makeNations();
  // The places take the nations because seating a crown is part of deciding who
  // holds what: the five great harbours ARE the five seats ([HC-39]).
  world.places = makePlaces(world.seed, world.shape, world.zones, world.nations);
  return world;
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
      // The town's private season counter is a known contradiction against
      // [HC-9] and is KAN-107's to remove; until it goes, a place's own clock
      // starts on the world's current year rather than on the year a warm-start
      // city would really have been founded. KAN-99 gives places their history.
      founded: yearOf(world),
    },
    groundAt(world, place),
  );
  settleOpening(town, place.population);
  return town;
}

// [HC-22], and the whole of the generator's answer to it: A PLACE IS FOUNDED AT
// A POPULATION ITS OWN GROUND CAN FEED. Its class says how big it is ALLOWED to
// be at day 0; its land says how big it can actually be, and the smaller of the
// two wins.
//
// Without this the generator writes exactly the bug [HC-22] names. Measured: a
// designated city of 144 souls on thin ground fell to 108 within twenty years,
// because its own subsistence works only ever fed 114. Nothing had gone wrong in
// the simulation — the OPENING STATE was one the ordinary rules could not have
// produced, which is the definition of the fault.
//
// Two passes, because the two facts depend on each other: how many subsistence
// works appear depends on the population, and what the population can be depends
// on the works. It settles immediately — a hamlet's works are a step function of
// its size — and the works it leaves standing are themselves part of the warm
// start, which is why this reads as a place that has been there a while rather
// than as bare ground with people on it.
function settleOpening(town: Town, allowed: number): void {
  town.population = allowed;
  for (let pass = 0; pass < 3; pass++) {
    stepWorks(town, town.founded);
    const canFeed = carryingCapacity(town);
    town.population = Math.max(POP.floor, Math.min(allowed, canFeed));
  }
}

// Every place, founded. This is what a headless run of the world stands on, and
// it is deliberately a function rather than state: the world holds its places,
// not their ledgers.
export const foundAll = (world: World): Town[] => world.places.map((p) => foundPlace(world, p));

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
    `(${[...new Set(zones)].join(", ")}). ${neutral} of them answer to no crown.`
  );
}
