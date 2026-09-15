// The speed control, claimed — and it is the one part of a view that can
// silently destroy [HC-11], which is why it is a pure function with a test file
// rather than four lines inside the loop.
//
// [HC-4]  The day is a fixed step. The speed control changes HOW MANY DAYS are
//         simulated per real second, never the size of a day.
// [HC-5]  The simulation never adapts to real time.
// [HC-20] Pause is a first-class speed and advances nothing.

import { describe, expect, it } from "vitest";
import { PACE, RATES, advance } from "./pace";

describe("the speed control changes how many days pass, never how long one is", () => {
  it("hands out whole days and nothing else", () => {
    // [HC-4] as a type. A fraction of a day reaching the world would be the
    // variable delta-time the spec bans outright.
    for (const rate of [0, 2, 12, 90, 720, 7]) {
      for (const dt of [1 / 240, 1 / 60, 0.017, 0.0331, 0.099, 5]) {
        const step = advance(rate, 0.37, dt);
        expect(Number.isInteger(step.days)).toBe(true);
        expect(step.days).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("loses nothing between one frame and the next", () => {
    // The whole of "never skips one": what the clock asked for comes back as
    // days plus carry, exactly — `total - floor(total)` is an exact subtraction,
    // so this is equality and not a tolerance.
    for (const rate of [2, 12, 90, 720]) {
      for (const carry of [0, 0.5, 0.999999]) {
        const dt = 1 / 61;
        const step = advance(rate, carry, dt);
        expect(step.days + step.carry).toBe(carry + rate * dt);
      }
    }
  });

  it("never carries a whole day forward as though it were a fraction", () => {
    for (const rate of [2, 90, 720]) {
      for (const dt of [0.001, 1 / 60, 0.1, 30]) {
        const step = advance(rate, 0.75, dt);
        expect(step.carry).toBeGreaterThanOrEqual(0);
        expect(step.carry).toBeLessThan(1);
      }
    }
  });

  it("adds up to the year it owes, however the frames fell", () => {
    // Sixty frames of a sixtieth of a second at ninety days a second is one
    // season, to the day, and the days arrive 1, 2, 1, 2 rather than 1.5 each.
    let carry = 0;
    let total = 0;
    for (let f = 0; f < 60; f++) {
      const step = advance(90, carry, 1 / 60);
      carry = step.carry;
      total += step.days;
      expect(Number.isInteger(step.days)).toBe(true);
    }
    expect(total).toBe(90);
  });

  it("gives the same century whether it is watched slowly or quickly", () => {
    // The accumulator's half of [HC-11]: the same elapsed real time at the same
    // rate yields the same day count regardless of how it was chopped into
    // frames. (The world's half — that the same days give the same world — is
    // claimed in `run.test.ts`.)
    const tally = (frames: number, dt: number) => {
      let carry = 0;
      let days = 0;
      for (let i = 0; i < frames; i++) {
        const step = advance(720, carry, dt);
        carry = step.carry;
        days += step.days;
      }
      return days;
    };
    expect(tally(1000, 0.05)).toBe(tally(500, 0.1));
  });
});

describe("a paused world advances nothing and can be read at leisure", () => {
  it("hands out no days however long it is left alone", () => {
    // [HC-20]. Pause is a rate of zero rather than a flag somewhere else, which
    // is what makes it a first-class speed rather than a special case.
    expect(RATES[0].perSecond).toBe(0);
    for (const dt of [1 / 60, 1, 600]) expect(advance(0, 0.9, dt).days).toBe(0);
  });

  it("does not spend the fraction it was already owed", () => {
    // Pausing mid-day and resuming must not lose the part-second already paid
    // for, or every pause would cost the world a slice of a day.
    expect(advance(0, 0.9, 5).carry).toBe(0.9);
  });
});

describe("a world that cannot keep up runs slower, and never in bigger steps", () => {
  it("does not turn a long stall into a long night", () => {
    // [HC-5]. A hidden tab or a breakpoint hands the next frame half a minute of
    // real time; at the fastest rate that would be sixty years in one step. The
    // clamp is what makes the world run slower in wall-clock instead.
    const stalled = advance(720, 0, 30);
    expect(stalled.days).toBe(720 * PACE.maxFrameSeconds);
    expect(stalled.days).toBeLessThan(90);
  });

  it("treats a clock that went backwards as no time at all", () => {
    expect(advance(720, 0.25, -4).days).toBe(0);
    expect(advance(720, 0.25, -4).carry).toBe(0.25);
  });

  it("keeps every offered rate inside what one frame can be asked for", () => {
    // Why there is no second budget and no deferral queue: the stall clamp
    // already bounds the demand, and a cap that could never fire would be code
    // that had not fought to be there ([P-1]). The most any rate in the table can
    // ask for in one frame is a fraction of a single season's work.
    for (const r of RATES) {
      const most = advance(r.perSecond, 0.999, 1000).days;
      expect(most).toBeLessThanOrEqual(r.perSecond * PACE.maxFrameSeconds + 1);
      expect(most).toBeLessThan(90);
    }
  });
});

describe("the rates are named, span what the spec asked them to, and are reproducible", () => {
  it("runs from a storm crossing a coast to a century passing", () => {
    // §5: "the rates want to span watch a storm cross a coast to watch a century
    // pass, and the exact numbers are tuning." A storm lives ten to twenty-five
    // days; the slowest moving rate puts that at a minute of looking. A century
    // is 36,000 days; the fastest puts it under two minutes.
    const slowest = RATES[1].perSecond;
    const fastest = RATES[RATES.length - 1].perSecond;
    expect(25 / slowest).toBeGreaterThan(5); // a storm is watchable
    expect(36000 / fastest).toBeLessThan(120); // a century is sittable-through
  });

  it("is a small set of named rates rather than a slider", () => {
    expect(RATES.length).toBeLessThanOrEqual(6);
    for (const r of RATES) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.blurb.length).toBeGreaterThan(0);
    }
  });

  it("orders them so that the control reads as a throttle", () => {
    for (let i = 1; i < RATES.length; i++) {
      expect(RATES[i].perSecond).toBeGreaterThan(RATES[i - 1].perSecond);
    }
  });
});
