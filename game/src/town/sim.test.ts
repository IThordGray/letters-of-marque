// The ledger — what it stores, what it refuses to store, and how it moves.
//
// Every claim here is warranted by [HC-70]: the world layer explicitly does NOT
// reopen the three stored numbers, the deliberate lag on prosperity, or the rule
// that nothing derived is kept. See spec/world-simulation.md §10.1.

import { describe, it, expect } from "vitest";
import { derive, stepSeason, stepYears, makeTown } from "./sim";
import { stepTownYears } from "./governor";
import { raise } from "./works";
import { mixedTown, bareTown } from "./fixtures";

describe("the ledger", () => {
  it("recomputes what it does not store", () => {
    const town = mixedTown({ population: 300, wealth: 4000 });
    stepYears(town, 5);

    const before = structuredClone(town);
    const first = derive(town);
    const second = derive(town);

    expect(second).toEqual(first); // asking twice does not change the answer
    expect(town).toEqual(before); // ...and asking at all does not change the town
  });

  it("changes its ledger today and its standing over seasons", () => {
    // The whole reason prosperity is stored rather than derived: the flow moves at
    // once, the verdict on the place does not.
    const town = mixedTown({ population: 300, wealth: 6000 });
    stepYears(town, 10);

    const earner = raise(town, "sawpit", 1650)!;
    stepSeason(town);
    const yieldWith = derive(town).yield;
    const prosperityWith = town.prosperity;

    earner.condition = "ruin";
    const yieldWithout = derive(town).yield;
    stepSeason(town);

    // The flow answers instantly...
    expect(yieldWithout).toBeLessThan(yieldWith);
    // ...while the standing has barely noticed.
    const moved = Math.abs(town.prosperity - prosperityWith);
    expect(moved).toBeLessThan(prosperityWith * 0.5);
  });

  it("settles toward a new verdict only after many seasons, never in one", () => {
    const town = bareTown({ population: 120, prosperity: 5 });
    const start = town.prosperity;
    stepSeason(town);
    const afterOne = town.prosperity - start;
    stepYears(town, 15);
    const afterMany = town.prosperity - start;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterMany).toBeGreaterThan(afterOne * 5); // it keeps going, slowly
  });

  it("builds nothing rather than going into debt", () => {
    // A town whose upkeep outruns its earnings empties its coffers and stops. It
    // does not borrow, and it does not die of arithmetic.
    const town = bareTown({ population: 400, wealth: 10 });
    stepYears(town, 20);
    expect(town.wealth).toBeGreaterThanOrEqual(0);
  });
});

describe("determinism", () => {
  // [HC-11]: reproducible means the whole history, not the starting state. This
  // survives the world layer untouched — it says nothing about where land comes
  // from, only that the same start gives the same century.
  it("gives the same century from the same starting state", () => {
    const a = mixedTown({ population: 200, wealth: 3000 });
    const b = mixedTown({ population: 200, wealth: 3000 });

    stepTownYears(a, 200);
    stepTownYears(b, 200);

    expect(b).toEqual(a);
  });

  it("does not care whether the century is run in one go or in pieces", () => {
    // The town-scale form of "the same world fast-forwarded twice gives the same
    // history, at any speed" — and what will catch an accidental wall-clock read
    // when the speed control arrives.
    const whole = mixedTown({ population: 200, wealth: 3000 });
    const pieces = mixedTown({ population: 200, wealth: 3000 });

    stepTownYears(whole, 60);
    for (let i = 0; i < 60; i++) stepTownYears(pieces, 1);

    expect(pieces).toEqual(whole);
  });

  it("reads no clock of its own beyond the season it counts", () => {
    // A guard against wall-clock or Math.random creeping into the sim: two runs
    // separated in real time must be identical.
    const a = makeTown({ name: "A", seed: 7, population: 90 });
    const b = makeTown({ name: "B", seed: 7, population: 90 });
    stepYears(a, 30);
    stepYears(b, 30);
    expect(b.population).toBe(a.population);
    expect(b.prosperity).toBe(a.prosperity);
    expect(b.wealth).toBe(a.wealth);
  });
});
