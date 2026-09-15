// The calendar — the one definition of time, and a LEAF: it imports nothing.
//
// [HC-3]  The year is 360 days: four seasons of exactly 90. A place stores a
//         single integer — DAYS SINCE WORLD EPOCH — and year, season and
//         day-of-season are all derived from it.
// [HC-9]  One clock, in world state. No system carries its own.
// [HC-90] Every system's DEFINITIONS live in a data table; only its BEHAVIOUR
//         lives in code. The calendar is a table.
//
// WHY THIS IS A FILE AND NOT THREE LINES OF `clock.ts`, which is the only thing
// about it worth reading twice. `clock.ts` owns the `World` struct, so it imports
// `climate`, `dispatch`, `factions`, `places`, `shape` and `weather` — and several
// of those import from `town/`. The town has to be able to say how long a work has
// been rotting and to put a year on a sentence, and it must never hold a World
// ([HC-71]: the world drives the ledger; the ledger never reaches out). Importing
// `clock.ts` from `town/` would close that cycle. A leaf that imports nothing
// closes none, and the calendar is written down exactly once (KAN-107).
//
// Everything here is a PURE FUNCTION OF ONE INTEGER. Nothing is stored, nothing
// is stepped, and there is no second number anywhere for a reading to drift away
// from ([P-47]).

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

// ---- Days in, readings out -------------------------------------------------
//
// `Math.floor` and `Math.trunc` agree on every day at or after the epoch, and
// FLOOR IS THE ONE THAT IS ALSO RIGHT BEFORE IT. A place founded before the world
// starts holds a negative day — which is exactly what KAN-99's warm start will
// write — and `Math.trunc(-1 / 360)` is `-0`, so day −1 would read as the epoch
// year rather than the one before it. Both are exactly specified ([P-7]); only
// one of them is correct for every integer a place can store.
//
// The `% n + n` dance is the same rule for the remainder: `-1 % 90` is `-89` in
// JavaScript, and the day-of-season of the day before the epoch is the 89th.

export const yearOfDay = (day: number): number =>
  CALENDAR.epochYear + Math.floor(day / DAYS_PER_YEAR);

export const seasonOfDay = (day: number): Season =>
  Math.floor((((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR) / CALENDAR.daysPerSeason) as Season;

export const dayInSeason = (day: number): number =>
  ((day % CALENDAR.daysPerSeason) + CALENDAR.daysPerSeason) % CALENDAR.daysPerSeason;

// True on the first day of a season — which includes day 0, because the world
// begins on a boundary. This is the seasonal beat's only trigger.
export const startsSeasonOn = (day: number): boolean => dayInSeason(day) === 0;
