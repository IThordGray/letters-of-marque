// Derived randomness — the property that makes [HC-11] survive refactoring.
//
// The test that matters most is "adding a place cannot change another place's
// history". That is the whole reason the world does not use a sequential stream,
// and it is the failure mode [HC-10] exists to prevent — one that would be
// silent, and would corrupt every subsequent tick.

import { describe, it, expect } from "vitest";
import { CHANNEL, hashOf, rollOf, seedFor } from "./chance";
import { makeRng, nextFloat } from "../rng";

const SEED = 0x5eed;

describe("a roll is a pure function of its coordinates", () => {
  it("gives the same answer for the same seed, purpose, thing and day — always", () => {
    const once = rollOf(SEED, CHANNEL.weather, 7, 1234);
    for (let i = 0; i < 100; i++) {
      expect(rollOf(SEED, CHANNEL.weather, 7, 1234)).toBe(once);
    }
  });

  it("does not care what was rolled before it", () => {
    const bare = rollOf(SEED, CHANNEL.weather, 7, 1234);
    for (let i = 0; i < 500; i++) rollOf(SEED, CHANNEL.storm, i, i * 3);
    expect(rollOf(SEED, CHANNEL.weather, 7, 1234)).toBe(bare);
  });

  it("keeps every roll inside the unit range", () => {
    for (let id = 0; id < 200; id++) {
      for (let day = 0; day < 20; day++) {
        const r = rollOf(SEED, CHANNEL.weather, id, day);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
      }
    }
  });
});

describe("adding a place cannot change another place's history", () => {
  it("leaves every existing roll untouched when a new thing joins the world", () => {
    // THE claim. With a sequential stream, introducing a fifty-first place would
    // shift every roll drawn after it and rewrite two centuries of history
    // silently. With derived rolls it cannot.
    const day = 900;
    const before = new Map<number, number>();
    for (let id = 1; id <= 50; id++) before.set(id, rollOf(SEED, CHANNEL.weather, id, day));

    const after = new Map<number, number>();
    for (let id = 1; id <= 51; id++) after.set(id, rollOf(SEED, CHANNEL.weather, id, day));

    for (const [id, was] of before) expect(after.get(id)).toBe(was);
  });

  it("does not care in what order the things are visited", () => {
    // [HC-7] and [P-9]: iteration order must not be able to change an outcome.
    const day = 42;
    const ids = [3, 1, 4, 1, 5, 9, 2, 6];
    const forwards = ids.map((id) => rollOf(SEED, CHANNEL.nation, id, day));
    const backwards = [...ids].reverse().map((id) => rollOf(SEED, CHANNEL.nation, id, day));
    expect(backwards).toEqual([...forwards].reverse());
  });

  it("demonstrates the sequential stream it exists to avoid", () => {
    // Kept as the counter-example, so the reason for the rule is testable rather
    // than folklore. Two consumers of one shared stream: insert a draw for a new
    // thing, and the OLD thing's value changes.
    const withoutNewcomer = (() => {
      const rng = makeRng(SEED);
      nextFloat(rng); // place 1
      return nextFloat(rng); // place 2 — the value we care about
    })();
    const withNewcomer = (() => {
      const rng = makeRng(SEED);
      nextFloat(rng); // place 1
      nextFloat(rng); // a new place slips in
      return nextFloat(rng); // place 2 — same place, different answer
    })();
    expect(withNewcomer).not.toBe(withoutNewcomer);
  });
});

describe("purposes do not collide", () => {
  it("rolls differently for different purposes on the same day for the same thing", () => {
    const channels = Object.values(CHANNEL);
    const rolls = channels.map((c) => rollOf(SEED, c, 12, 300));
    expect(new Set(rolls).size).toBe(channels.length);
  });

  it("scatters neighbouring things so adjacent places are unrelated", () => {
    // Adjacent ids on the same day must not produce adjacent values, or a whole
    // coast would get the same weather.
    const a = rollOf(SEED, CHANNEL.weather, 1, 500);
    const b = rollOf(SEED, CHANNEL.weather, 2, 500);
    const c = rollOf(SEED, CHANNEL.weather, 3, 500);
    expect(Math.abs(a - b)).toBeGreaterThan(0.001);
    expect(Math.abs(b - c)).toBeGreaterThan(0.001);
  });

  it("scatters consecutive days so a place's weather is not a ramp", () => {
    const deltas: number[] = [];
    for (let day = 0; day < 60; day++) {
      deltas.push(rollOf(SEED, CHANNEL.weather, 9, day + 1) - rollOf(SEED, CHANNEL.weather, 9, day));
    }
    const rising = deltas.filter((d) => d > 0).length;
    expect(rising).toBeGreaterThan(10); // not monotonic in either direction
    expect(rising).toBeLessThan(50);
  });

  it("spreads across the range rather than clustering", () => {
    // Not a statistical test — a smoke test that the mixer avalanches at all.
    const buckets = new Array(10).fill(0);
    for (let id = 0; id < 5000; id++) {
      buckets[Math.trunc(rollOf(SEED, CHANNEL.worldgen, id, 0) * 10)]++;
    }
    for (const n of buckets) expect(n).toBeGreaterThan(5000 / 10 * 0.6);
  });
});

describe("bridging to a sequential stream", () => {
  it("derives a founding seed from the world, so a place's ground is the world's doing", () => {
    // A founding roll IS one linear sequence — which sequence it is must be a
    // pure function of the world ([HC-10]).
    const a = seedFor(SEED, CHANNEL.land, 17);
    expect(seedFor(SEED, CHANNEL.land, 17)).toBe(a);
    expect(seedFor(SEED, CHANNEL.land, 18)).not.toBe(a);
    expect(seedFor(SEED + 1, CHANNEL.land, 17)).not.toBe(a);
  });

  it("hands out a whole 32-bit seed, so makeRng gets a usable spread", () => {
    for (let id = 0; id < 50; id++) {
      const s = seedFor(SEED, CHANNEL.land, id);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("changes the whole world when the world seed changes", () => {
    const one = rollOf(1, CHANNEL.weather, 5, 5);
    const two = rollOf(2, CHANNEL.weather, 5, 5);
    expect(two).not.toBe(one);
  });

  it("returns a whole number from the hash, never a float", () => {
    const h = hashOf(SEED, CHANNEL.storm, 3, 3);
    expect(Number.isInteger(h)).toBe(true);
  });
});
