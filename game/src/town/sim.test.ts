// Behaviour tests for the town sim (KAN-68, reworked onto the real ledger in KAN-70).
//
// House style — see docs/knowledge/implementation/testing.md:
//  - Each name reads as a DESIGN CLAIM, not a function name.
//  - Assert DIRECTIONS AND RELATIONSHIPS, never tuned constants.

import { describe, it, expect } from "vitest";
import { makeTown, stepSeason, stepYears, derive, prosperityTarget, carryingCapacity } from "./sim";
import { raise } from "./works";
import type { ParcelTerrain, Town, Bearing } from "./types";

const RING: Bearing[] = ["N", "NE", "E", "W", "NW", "S", "SE", "SW"];

// A town on land we choose, so a test says what it means. Quality is fair unless
// stated, so nothing here depends on the founding roll.
function townOn(terrains: ParcelTerrain[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    parcels: terrains.map((terrain, i) => ({ terrain, quality: "fair" as const, bearing: RING[i] })),
    ...init,
  });
}

const bare = () => townOn([]);

// A town with the land, the works AND the hands to actually earn a living. The
// population matters: a town too small to man its sawpits earns nothing from them.
function earner(init: Partial<Town> = {}) {
  const t = townOn(["timberedHills", "provisionGrounds", "provisionGrounds"], { population: 300, ...init });
  raise(t, "sawpit", 1640);
  raise(t, "provisionGround", 1640);
  raise(t, "provisionGround", 1640);
  return t;
}

const conditionOf = (t: Town, kind: string) => t.works.find((w) => w.kind === kind)?.condition;

describe("the hamlet floor", () => {
  it("keeps a town with no capital works, no patron and no coin alive indefinitely", () => {
    const t = bare();
    stepYears(t, 60);
    expect(t.population).toBeGreaterThan(15);
  });

  it("raises its own roofs and gardens without anyone deciding to", () => {
    const t = bare();
    stepSeason(t);
    expect(t.works.some((w) => w.kind === "dwellings")).toBe(true);
    expect(t.works.some((w) => w.kind === "gardenPlots")).toBe(true);
  });

  it("costs the town nothing — subsistence is free by definition", () => {
    const t = bare();
    const before = t.wealth;
    stepSeason(t);
    expect(t.wealth).toBeGreaterThanOrEqual(before - derive(t).upkeep - 0.001);
  });

  it("never lets the coffers go negative — a poor town builds nothing, it does not die", () => {
    const t = bare();
    stepYears(t, 60);
    expect(t.wealth).toBeGreaterThanOrEqual(0);
  });
});

describe("prosperity lags — the reason it is stored rather than derived", () => {
  it("does not move when a work is razed, though yield collapses the same instant", () => {
    const t = earner();
    stepYears(t, 40);
    const settled = t.prosperity;
    expect(conditionOf(t, "sawpit")).toBe("working"); // the claim is meaningless otherwise

    t.works = t.works.filter((w) => w.kind !== "sawpit"); // raze the earner
    const targetAfter = prosperityTarget(t, derive(t));
    expect(targetAfter).toBeLessThan(settled); // it is heading down

    stepSeason(t);
    const moved = settled - t.prosperity;
    expect(moved).toBeLessThan((settled - targetAfter) * 0.5); // ...but has barely shifted
  });

  it("gets there in the end", () => {
    const t = earner();
    stepYears(t, 40);
    t.works = t.works.filter((w) => w.kind !== "sawpit");
    stepYears(t, 25);
    expect(t.prosperity).toBeCloseTo(prosperityTarget(t, derive(t)), 0);
  });
});

describe("works are what make a town", () => {
  it("grow the population beyond what bare subsistence supports", () => {
    const poor = bare();
    const rich = earner();
    stepYears(poor, 40);
    stepYears(rich, 40);
    expect(rich.population).toBeGreaterThan(poor.population);
  });

  it("compound into wealth", () => {
    const poor = bare();
    const rich = earner();
    stepYears(poor, 40);
    stepYears(rich, 40);
    expect(rich.wealth).toBeGreaterThan(poor.wealth);
  });

  it("make better land worth more than poor land", () => {
    const mk = (quality: "poor" | "rich") => {
      const t = makeTown({ name: "T", seed: 1, parcels: [{ terrain: "timberedHills", quality, bearing: "N" }] });
      raise(t, "sawpit", 1640);
      return t;
    };
    expect(derive(mk("rich")).trade).toBeGreaterThan(derive(mk("poor")).trade);
  });
});

describe("a sacked town", () => {
  it("loses most of its people", () => {
    const t = earner();
    stepYears(t, 40);
    const peak = t.population;
    t.works = [];
    t.wealth = 0;
    stepYears(t, 30);
    expect(t.population).toBeLessThan(peak * 0.75);
  });

  it("crawls back to a hamlet rather than dying", () => {
    const t = earner();
    stepYears(t, 40);
    t.works = [];
    t.wealth = 0;
    stepYears(t, 30);
    expect(t.population).toBeGreaterThan(15);
    expect(t.works.some((w) => w.kind === "gardenPlots")).toBe(true);
  });
});

describe("what a raider faces", () => {
  const crown = { kind: "crown" as const, name: "Spain", owns: true };

  it("reads as an outpost when the town is small and unwalled", () => {
    expect(derive(townOn([], { patron: crown })).tier).toBe("outpost");
  });

  it("stiffens when guns go up", () => {
    const t = townOn(["bluff"], { patron: crown });
    const before = derive(t).security;
    raise(t, "battery", 1640);
    expect(derive(t).security).toBeGreaterThan(before);
  });

  it("is still not a capital, however well gunned, if it is a village", () => {
    const t = townOn(["bluff", "bluff"], { population: 90, patron: crown });
    raise(t, "battery", 1640);
    raise(t, "battery", 1640);
    expect(derive(t).tier).not.toBe("capital");
  });

  it("is a capital when it is both big and well gunned", () => {
    const t = townOn(["bluff", "bluff"], { population: 900, patron: crown });
    raise(t, "battery", 1640);
    raise(t, "battery", 1640);
    expect(derive(t).tier).toBe("capital");
  });
});

describe("the sim is reproducible", () => {
  it("gives the same town from the same start and the same number of seasons", () => {
    const a = earner();
    const b = earner();
    stepYears(a, 25);
    stepYears(b, 25);
    expect([a.population, a.wealth, a.prosperity]).toEqual([b.population, b.wealth, b.prosperity]);
  });
});

describe("nothing derived is ever stored", () => {
  it("recomputes the same derived values without stepping the sim", () => {
    const t = earner();
    stepYears(t, 10);
    expect(derive(t)).toEqual(derive(t));
  });

  it("keeps carrying capacity a function of the ledger, not a stored number", () => {
    const t = earner();
    stepYears(t, 10);
    const before = carryingCapacity(t);
    t.works = t.works.filter((w) => w.kind !== "provisionGround");
    expect(carryingCapacity(t)).toBeLessThan(before);
  });
});
