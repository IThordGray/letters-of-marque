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
// This replaces the town module's private `season` counter, which was a bug
// against [HC-9]: two places founded in different years could not be compared on
// one timeline (KAN-107).

import type { Zone } from "./climate";
import type { Nation } from "./factions";
import type { Place } from "./places";
import { emptyShape, type WorldShape } from "./shape";

// ---- The calendar, as data ([HC-90]) --------------------------------------
// No real calendar, no leap years, no months. Nothing in the design needs a true
// date, and clean arithmetic makes every derived reading cheap.
export const CALENDAR = {
  daysPerSeason: 90,
  seasonsPerYear: 4,
  epochYear: 1660, // the world begins in the spring of this year
} as const;

export const DAYS_PER_YEAR = CALENDAR.daysPerSeason * CALENDAR.seasonsPerYear;

// Spring · summer · autumn · winter. Index order, not names — the sim never reads
// a string ([P-38]); prose belongs to the presentation layer.
export type Season = 0 | 1 | 2 | 3;

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
}

// One factory, every field present, same order, same types ([P-26]) — so the
// bare clock and a fully generated world have the same shape and no property is
// ever added to one later. `makeWorld` is the CLOCK; `generateWorld` in
// `worldgen.ts` is the world, and it fills these four in.
export function makeWorld(seed: number): World {
  return { seed: seed >>> 0, day: 0, shape: emptyShape(), zones: [], nations: [], places: [] };
}

// ---- Derived readings -----------------------------------------------------
// Math.trunc rather than `| 0`: exactly specified ([P-7]) and correct across the
// whole double range, where `| 0` is ToInt32 and wraps silently past 2^31.

export const yearOf = (w: World): number =>
  CALENDAR.epochYear + Math.trunc(w.day / DAYS_PER_YEAR);

export const seasonOf = (w: World): Season =>
  Math.trunc((w.day % DAYS_PER_YEAR) / CALENDAR.daysPerSeason) as Season;

export const dayOfSeason = (w: World): number => w.day % CALENDAR.daysPerSeason;

// True on the first day of a season — which includes day 0, because the world
// begins on a boundary. This is the seasonal beat's only trigger: the tick loop
// steps a day, then asks.
export const startsSeason = (w: World): boolean => dayOfSeason(w) === 0;

// ---- The beat -------------------------------------------------------------

// One day. The atom of the simulation; nothing smaller exists ([HC-2]).
export function stepDay(w: World): void {
  w.day++;
}
