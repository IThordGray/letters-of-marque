// The world clock — the only clock in the game.
//
// [HC-9] One clock, in world state. No system carries its own.
// [HC-2] Exactly two beats: the DAY and the SEASON. No third may be added.
// [HC-3] The year is 360 days, four seasons of exactly 90. Ratified 2026-09-10.
// [HC-4] The day is a fixed step; a speed control changes how many days pass per
//        real second, never the size of a day.
// [P-11] Never read a wall clock. The simulation's only time is the tick.
//
// The whole of stored time is ONE INTEGER — days since the world's epoch. Year,
// season and day-of-season are derived from it every time they are asked for
// ([HC-14] store almost nothing), so none of them can drift away from the others.
//
// The town module's private `season` counter was the second clock this rule
// forbids, and it is GONE as of KAN-107: a place now stores days since world
// epoch like everything else, so two places founded in different years finally
// sit on one timeline. The arithmetic itself lives in `calendar.ts`, a leaf that
// imports nothing — everything below is a one-liner over it, and this file adds
// only the World to read the day out of.

import { dayInSeason, seasonOfDay, startsSeasonOn, yearOfDay, type Season } from "./calendar";
import type { Zone } from "./climate";
import { makeDispatches, type Dispatches } from "./dispatch";
import type { Nation } from "./factions";
import type { Place } from "./places";
import { emptyShape, type WorldShape } from "./shape";
import type { Storm } from "./weather";

// ---- The world ------------------------------------------------------------
//
// The clock came first and the world grew onto it, which is the right way round:
// [HC-9] says there is ONE clock and it lives in world state, so the struct that
// holds the clock is the struct that holds the world. There is no second one.
//
// Note what is here and what is not. The world stores its own DESCRIPTION —
// the lobes and fields its coastlines are read off, its climate zones, its
// fifty places and its factions. It does NOT store a heightmap, a tile grid, a
// weather value, or any place's land: all of those are pure functions of
// (seed, position) or of (seed, zone, day), and [P-17] and [HC-14] say a pure
// function is computed on demand and never stored. A saved world is a seed, a
// day, and the few hundred numbers below.

export interface World {
  // Fixes every derived roll in the world's history ([HC-10]).
  readonly seed: number;
  // Days since the epoch. The only stored time there is.
  day: number;
  // The world's shape — landmasses and coastlines, as data the sim queries
  // ([HC-19]). Fixed at generation.
  shape: WorldShape;
  // Climate zones, and climate never changes ([HC-27]). Not "regions" ([HC-23]).
  zones: Zone[];
  // Five crowns and the neutrals, and who sits where ([HC-39], [HC-51]).
  nations: Nation[];
  // ~50 ports on real coasts, at real positions ([HC-24]).
  places: Place[];
  // TWO exceptions to everything the comment above says, and only two. Both
  // arrived on the same day from different workstreams, which is a fair sign
  // that the list is closed rather than merely short.
  //
  // The four war-currencies at sea ([HC-13], [HC-44]) — the sole carve-out from
  // "the flow is the truth", and the only moving things the world stores. They
  // are cheap to store precisely because [P-16] lets a passage be a departure
  // and an arrival rather than a position that has to be kept up to date.
  dispatches: Dispatches;
  // The live weather events ([HC-31]). Ambient weather is a pure function of
  // (seed, zone, day) and is stored nowhere; an EVENT has to be stored, because
  // momentum is history — an event that is building is not the same as an
  // identical event spending itself, and no pure function of (seed, day) can
  // know which. Its spawning is still derived, so the same world breeds the same
  // storms. There are only ever a handful alive at once.
  storms: Storm[];
}

// One factory, every field present, same order, same types ([P-26]) — so the
// bare clock and a fully generated world have the same shape and no property is
// ever added to one later. `makeWorld` is the CLOCK; `generateWorld` in
// `worldgen.ts` is the world, and it fills these four in.
export function makeWorld(seed: number): World {
  return {
    seed: seed >>> 0, day: 0, shape: emptyShape(),
    zones: [], nations: [], places: [], dispatches: makeDispatches(), storms: [],
  };
}

// ---- Derived readings -----------------------------------------------------
// One line each, because the world's only contribution to a date is the integer
// it keeps. The arithmetic is `calendar.ts`'s and is shared verbatim with every
// place that stores a day — which is what makes "no two readings can disagree"
// a property of the code rather than a thing a test has to keep watching ([P-47]).

export const yearOf = (w: World): number => yearOfDay(w.day);

export const seasonOf = (w: World): Season => seasonOfDay(w.day);

export const dayOfSeason = (w: World): number => dayInSeason(w.day);

// True on the first day of a season — which includes day 0, because the world
// begins on a boundary. This is the seasonal beat's only trigger: the tick loop
// steps a day, then asks.
export const startsSeason = (w: World): boolean => startsSeasonOn(w.day);

// ---- The beat -------------------------------------------------------------

// One day. The atom of the simulation; nothing smaller exists ([HC-2]).
export function stepDay(w: World): void {
  w.day++;
}
