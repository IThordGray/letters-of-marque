// The calendar — one integer in, three readings out, and nothing stored.
//
// `clock.test.ts` covers the same arithmetic as the WORLD sees it. These claims
// are about the leaf underneath: the conversions a place uses, which have no
// world to read a day out of, and the property that makes it safe for the town to
// import at all.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALENDAR, DAYS_PER_YEAR,
  dayInSeason, seasonOfDay, startsSeasonOn, yearOfDay,
} from "./calendar";

describe("one integer is the whole of stored time", () => {
  // [HC-3]: a place stores days since world epoch, and year, season and
  // day-of-season are ALL derived from it. The point of the rule is that they
  // cannot drift apart — so the test is that the three readings put the integer
  // back together again, for any day at all.
  const roundTrip = (day: number) =>
    (yearOfDay(day) - CALENDAR.epochYear) * DAYS_PER_YEAR +
    seasonOfDay(day) * CALENDAR.daysPerSeason +
    dayInSeason(day);

  it("rebuilds the day it came from, on every day of three centuries", () => {
    for (let d = 0; d < DAYS_PER_YEAR * 300; d++) expect(roundTrip(d)).toBe(d);
  });

  it("rebuilds it before the world began, too — a place may predate the epoch", () => {
    // KAN-99 gives places a history, and a city founded eighty years before the
    // world's first day holds a NEGATIVE day. `Math.trunc` would round it toward
    // zero and put the day before the epoch in the epoch year; `Math.floor` and a
    // non-negative remainder are what make the reading right on both sides of 0.
    for (let d = -DAYS_PER_YEAR * 120; d < 0; d++) expect(roundTrip(d)).toBe(d);

    expect(yearOfDay(-1)).toBe(CALENDAR.epochYear - 1); // the last day of the year before
    expect(seasonOfDay(-1)).toBe(CALENDAR.seasonsPerYear - 1); // ...and its last season
    expect(dayInSeason(-1)).toBe(CALENDAR.daysPerSeason - 1); // ...and its last day
  });

  it("turns the year only when the seasons have run out", () => {
    expect(yearOfDay(DAYS_PER_YEAR - 1)).toBe(CALENDAR.epochYear);
    expect(yearOfDay(DAYS_PER_YEAR)).toBe(CALENDAR.epochYear + 1);
  });

  it("starts a season on the first day of one and on no other", () => {
    for (let d = 0; d < DAYS_PER_YEAR * 3; d++) {
      expect(startsSeasonOn(d)).toBe(d % CALENDAR.daysPerSeason === 0);
    }
  });

  it("gives the same answer however many times it is asked", () => {
    // Nothing here is stepped, cached or stored, so asking cannot change an answer.
    const before = [yearOfDay(4321), seasonOfDay(4321), dayInSeason(4321)];
    for (let i = 0; i < 5; i++) {
      expect([yearOfDay(4321), seasonOfDay(4321), dayInSeason(4321)]).toEqual(before);
    }
  });
});

describe("a date means the same thing whoever is reading it", () => {
  // The arithmetic half of the bug KAN-107 fixed. `town.founded + season / 4`
  // reckoned a year from each place's OWN founding, so "year 12" was a different
  // year in every town. Off one axis, a date is just a number and it means the
  // same thing everywhere — which is what the ledger claims in `town/sim.test.ts`
  // rest on.

  it("reads one day as one year, however far apart the two places started", () => {
    const oldTown = -80 * DAYS_PER_YEAR; // founded eighty years before the world began
    const newTown = 0; // ...and this one founded on its first day
    expect(yearOfDay(oldTown)).toBe(CALENDAR.epochYear - 80);
    expect(yearOfDay(newTown)).toBe(CALENDAR.epochYear);

    // Twelve years and one season after the epoch, in both of them. The old
    // reckoning would have called this the 92nd year in one town and the 12th in
    // the other; there is only one answer now, and neither founding is in it.
    const day = 12 * DAYS_PER_YEAR + CALENDAR.daysPerSeason;
    expect(yearOfDay(day)).toBe(CALENDAR.epochYear + 12);
    expect(seasonOfDay(day)).toBe(1);
    expect(day - oldTown).toBe(92 * DAYS_PER_YEAR + CALENDAR.daysPerSeason); // how old the place is
    expect(day - newTown).toBe(12 * DAYS_PER_YEAR + CALENDAR.daysPerSeason); // ...and the other
  });

  it("orders two places' dates against each other, which is what could not be done", () => {
    // A sawpit cut in the old town's ninetieth year against one cut in the young
    // town's first season. Both are days, so which is elder is a single `<`.
    const oldTownSawpit = -80 * DAYS_PER_YEAR + 90 * DAYS_PER_YEAR;
    const newTownSawpit = 0;
    expect(newTownSawpit).toBeLessThan(oldTownSawpit);
    expect(yearOfDay(oldTownSawpit)).toBe(CALENDAR.epochYear + 10);
    expect(yearOfDay(newTownSawpit)).toBe(CALENDAR.epochYear);
  });
});

describe("the calendar is a leaf", () => {
  it("imports nothing at all, so no module can close a cycle by reading it", () => {
    // This is the whole warrant for `town/constants.ts`, `town/sim.ts` and
    // `town/governor.ts` importing out of `overworld/`. `clock.ts` holds the
    // `World` and therefore pulls in `climate`, `dispatch`, `factions`, `places`,
    // `shape` and `weather`, several of which import from `town/`; a town that
    // imported `clock.ts` would close that loop. A file with no imports closes
    // none — and that is a property of the source, so it is checked in the source.
    const src = readFileSync(join(process.cwd(), "src/overworld/calendar.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(src).not.toMatch(/\bimport\b/);
    expect(src).not.toMatch(/\brequire\s*\(/);
  });
});
