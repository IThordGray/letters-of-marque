// The line a map cannot draw, claimed.
//
// The milestone's named failure mode is that "the fifty towns find their level
// and stop" (§8), and it is invisible on a map of the present: a plateau and a
// climb look identical in one frame. So the accumulator's job is to make time
// itself visible, and the property everything on the chart rests on is that its
// series only ever goes forwards.

import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR } from "../overworld/calendar";
import { TREND, makeTrend, recordTrend, spanOf, stillClimbing } from "./trend";

describe("a history only ever runs forwards", () => {
  it("keeps its days strictly increasing, whatever it is offered", () => {
    // A chart drawn from a series that can go backwards draws a scribble, and
    // the offers it gets are messy: four a year from the seasonal beat, and the
    // same day again whenever a world is reset onto the same canvas.
    const t = makeTrend(DAYS_PER_YEAR);
    const offers = [0, 90, 180, 270, 360, 360, 90, 720, 700, 1080];
    for (const day of offers) recordTrend(t, day, 100, 200, 30);
    for (let i = 1; i < t.day.length; i++) expect(t.day[i]).toBeGreaterThan(t.day[i - 1]);
  });

  it("never puts two samples closer together than the interval it was built with", () => {
    const t = makeTrend(DAYS_PER_YEAR);
    for (let d = 0; d <= DAYS_PER_YEAR * 20; d += 90) recordTrend(t, d, d, d * 2, 30);
    for (let i = 1; i < t.day.length; i++) {
      expect(t.day[i] - t.day[i - 1]).toBeGreaterThanOrEqual(DAYS_PER_YEAR);
    }
  });

  it("says whether it stored anything, so the chart redraws on the year and not on the frame", () => {
    const t = makeTrend(DAYS_PER_YEAR);
    expect(recordTrend(t, 0, 1, 1, 1)).toBe(true);
    expect(recordTrend(t, 90, 1, 1, 1)).toBe(false);
    expect(recordTrend(t, 360, 1, 1, 1)).toBe(true);
  });
});

describe("a century costs a hundred points, not thirty-six thousand", () => {
  it("is bounded by the length of the run and not by how it was watched", () => {
    // [HC-26] would be violated by a graph if watching slowly cost more memory
    // than watching quickly. The seasonal beat offers four samples a year at
    // every speed, and three of them are refused at every speed.
    const slow = makeTrend();
    const fast = makeTrend();
    for (let d = 0; d < DAYS_PER_YEAR * 100; d += 90) recordTrend(slow, d, d, d, 30);
    for (let d = 0; d < DAYS_PER_YEAR * 100; d += 90) recordTrend(fast, d, d, d, 30);
    expect(slow.day.length).toBe(100);
    expect(slow.day.length).toBe(fast.day.length);
    expect(TREND.everyDays).toBe(DAYS_PER_YEAR);
  });
});

describe("the chart is told what it has to fit", () => {
  it("finds the top of every series and the ends of the run", () => {
    const t = makeTrend(DAYS_PER_YEAR);
    recordTrend(t, 0, 3900, 8800, 400);
    recordTrend(t, 360, 6700, 70600, 1050);
    recordTrend(t, 720, 6100, 52000, 990);
    const s = spanOf(t);
    expect(s.day0).toBe(0);
    expect(s.day1).toBe(720);
    expect(s.people).toBe(6700);
    expect(s.coin).toBe(70600);
    expect(s.works).toBe(1050);
  });

  it("has an answer for a world that has not started yet", () => {
    expect(spanOf(makeTrend())).toEqual({ day0: 0, day1: 0, people: 0, coin: 0, works: 0 });
  });
});

describe("the reading that names the failure mode", () => {
  const build = (values: number[]): { t: ReturnType<typeof makeTrend>; v: number[] } => {
    const t = makeTrend(DAYS_PER_YEAR);
    values.forEach((v, i) => recordTrend(t, i * DAYS_PER_YEAR, v, v, v));
    return { t, v: t.people };
  };

  it("says a world that stopped has stopped", () => {
    // Fifty towns that found their level: all the growth in the first thirty
    // years and none in the last twenty. This is the shape the shipped world
    // actually has today — measured 3,913 souls in year 0, 6,694 by year 30, and
    // 6,671 in year 99 — and the line is the only place it shows.
    const climbThenFlat: number[] = [];
    for (let y = 0; y < 100; y++) climbThenFlat.push(y < 30 ? 3900 + y * 90 : 6600);
    expect(stillClimbing(build(climbThenFlat).t, build(climbThenFlat).v, 20)).toBeLessThan(0.15);
  });

  it("says a world that is still growing is still growing", () => {
    const steady: number[] = [];
    for (let y = 0; y < 100; y++) steady.push(1000 + y * 50);
    const b = build(steady);
    expect(stillClimbing(b.t, b.v, 20)).toBeGreaterThan(0.8);
  });

  it("reads the GROWTH and not the level, so a big world that is still growing says so", () => {
    // The distinguishing case, and it needs building rather than reasoning about:
    // a world of ten thousand souls that gained a hundred over the run is still
    // climbing, and a reading taken against the LEVEL rather than against the
    // growth would call it dead. Without this fixture the claims above cannot
    // tell the two denominators apart at all.
    const big: number[] = [];
    for (let y = 0; y < 100; y++) big.push(10000 + y);
    const b = build(big);
    expect(stillClimbing(b.t, b.v, 20)).toBeGreaterThan(0.8);
  });

  it("does not claim growth for a world that has been shrinking", () => {
    const falling: number[] = [];
    for (let y = 0; y < 100; y++) falling.push(6000 - y * 20);
    const b = build(falling);
    expect(stillClimbing(b.t, b.v, 20)).toBe(0);
  });

  it("has an answer before there is a run to read", () => {
    const t = makeTrend();
    expect(stillClimbing(t, t.people, 20)).toBe(0);
  });
});
