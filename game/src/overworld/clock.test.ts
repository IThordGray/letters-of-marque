// The world clock — one integer, and everything else read off it.

import { describe, it, expect } from "vitest";
import {
  CALENDAR, DAYS_PER_YEAR, makeWorld, stepDay,
  yearOf, seasonOf, dayOfSeason, startsSeason,
} from "./clock";

const runDays = (n: number, seed = 1) => {
  const w = makeWorld(seed);
  for (let i = 0; i < n; i++) stepDay(w);
  return w;
};

describe("the calendar", () => {
  it("keeps a year of four equal seasons, so no reading needs a special case", () => {
    expect(DAYS_PER_YEAR).toBe(CALENDAR.daysPerSeason * CALENDAR.seasonsPerYear);
    expect(DAYS_PER_YEAR % CALENDAR.daysPerSeason).toBe(0);
  });

  it("begins on a season boundary, in the spring of its epoch year", () => {
    const w = makeWorld(1);
    expect(w.day).toBe(0);
    expect(startsSeason(w)).toBe(true);
    expect(seasonOf(w)).toBe(0);
    expect(yearOf(w)).toBe(CALENDAR.epochYear);
  });

  it("turns the season exactly once every ninety days, and not a day sooner", () => {
    const w = makeWorld(1);
    let turns = 0;
    for (let i = 0; i < DAYS_PER_YEAR; i++) {
      stepDay(w);
      if (startsSeason(w)) turns++;
    }
    expect(turns).toBe(CALENDAR.seasonsPerYear);
  });

  it("does not turn the season in the middle of one", () => {
    for (let d = 1; d < CALENDAR.daysPerSeason; d++) {
      expect(startsSeason(runDays(d))).toBe(false);
    }
  });

  it("walks the seasons in order and comes back round", () => {
    const seen: number[] = [];
    const w = makeWorld(1);
    seen.push(seasonOf(w));
    for (let i = 0; i < DAYS_PER_YEAR; i++) {
      stepDay(w);
      if (startsSeason(w)) seen.push(seasonOf(w));
    }
    expect(seen).toEqual([0, 1, 2, 3, 0]);
  });

  it("turns the year only when the seasons have run out", () => {
    expect(yearOf(runDays(DAYS_PER_YEAR - 1))).toBe(CALENDAR.epochYear);
    expect(yearOf(runDays(DAYS_PER_YEAR))).toBe(CALENDAR.epochYear + 1);
  });

  it("still reads correctly two centuries out", () => {
    const w = runDays(DAYS_PER_YEAR * 200);
    expect(yearOf(w)).toBe(CALENDAR.epochYear + 200);
    expect(seasonOf(w)).toBe(0);
    expect(dayOfSeason(w)).toBe(0);
  });
});

describe("stored time", () => {
  it("stores one integer of time and derives the rest, so no two readings can disagree", () => {
    // The world grew onto the clock (KAN-98) rather than beside it — [HC-9] says
    // there is ONE clock and it lives in world state, so the struct that holds
    // the clock holds the world. What must stay true is not that the struct is
    // small but that its TIME is one integer: `day`, and nothing else.
    const w = runDays(1234);
    expect(Number.isInteger(w.day)).toBe(true);
    const timeBearing = Object.keys(w).filter((k) => /year|season|month|week|date|time|day/i.test(k));
    expect(timeBearing).toEqual(["day"]);

    // The three readings must reconstruct the day they came from.
    const elapsed =
      (yearOf(w) - CALENDAR.epochYear) * DAYS_PER_YEAR +
      seasonOf(w) * CALENDAR.daysPerSeason +
      dayOfSeason(w);
    expect(elapsed).toBe(w.day);
  });

  it("gives the same answer however many times it is asked", () => {
    const w = runDays(777);
    const before = { y: yearOf(w), s: seasonOf(w), d: dayOfSeason(w), day: w.day };
    yearOf(w); seasonOf(w); dayOfSeason(w); startsSeason(w);
    expect({ y: yearOf(w), s: seasonOf(w), d: dayOfSeason(w), day: w.day }).toEqual(before);
  });

  it("advances one day at a time and nothing else", () => {
    const w = makeWorld(42);
    const seed = w.seed;
    stepDay(w);
    expect(w.day).toBe(1);
    expect(w.seed).toBe(seed); // the seed is fixed for the world's life
  });

  it("does not care whether the days are stepped in one run or in pieces", () => {
    // The town-scale form of "at any speed" ([HC-11]): the clock must not know
    // how the caller chose to advance it.
    const whole = runDays(500);
    const pieces = makeWorld(1);
    for (let chunk = 0; chunk < 10; chunk++) for (let i = 0; i < 50; i++) stepDay(pieces);
    expect(pieces).toEqual(whole);
  });
});
