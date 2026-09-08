// Behaviour tests for the works ledger (KAN-70).
// House style: names are design claims; assert directions, not tuned constants.

import { describe, it, expect } from "vitest";
import { makeTown, stepYears, stepSeason, derive } from "./sim";
import { raise, buildable, roomFor, CATALOGUE, CHOOSABLE, SUBSISTENCE, countOf, starvedFor } from "./works";
import { DECAY } from "./constants";
import type { ParcelTerrain, Town, Bearing } from "./types";

const RING: Bearing[] = ["N", "NE", "SE", "S", "SW", "NW"];

function townOn(terrains: ParcelTerrain[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    parcels: terrains.map((terrain, i) => ({ terrain, quality: "fair" as const, bearing: RING[i] })),
    ...init,
  });
}

describe("the catalogue", () => {
  it("offers a dozen works the governor can choose between", () => {
    expect(CHOOSABLE.length).toBe(12);
  });

  it("keeps subsistence free, so the floor costs a town nothing", () => {
    for (const k of SUBSISTENCE) expect(CATALOGUE[k].cost).toBe(0);
  });

  it("makes every capital work cost something — that is what the budget gates", () => {
    for (const k of CHOOSABLE) expect(CATALOGUE[k].cost).toBeGreaterThan(0);
  });

  it("has exactly two dependency edges, one level deep", () => {
    const edges = (Object.keys(CATALOGUE) as (keyof typeof CATALOGUE)[]).filter((k) => CATALOGUE[k].requires);
    expect(edges.length).toBe(2);
    // ...and nothing requires something that itself requires something.
    for (const k of edges) expect(CATALOGUE[CATALOGUE[k].requires!].requires).toBeNull();
  });
});

describe("the land is the cap on what a town can become", () => {
  it("will not raise a work on land the town does not have", () => {
    expect(buildable(townOn([]), "sawpit")).toBe(false);
    expect(buildable(townOn(["timberedHills"]), "sawpit")).toBe(true);
  });

  it("allows one work per parcel that can carry it, and no more", () => {
    const t = townOn(["timberedHills", "timberedHills"]);
    expect(roomFor(t, "sawpit")).toBe(2);
    raise(t, "sawpit", 1640);
    raise(t, "sawpit", 1640);
    expect(roomFor(t, "sawpit")).toBe(0);
    expect(raise(t, "sawpit", 1640)).toBeNull();
  });

  it("puts the first work of a kind on the best land available", () => {
    const t = makeTown({
      name: "T", seed: 1,
      parcels: [
        { terrain: "timberedHills", quality: "poor", bearing: "N" },
        { terrain: "timberedHills", quality: "rich", bearing: "NE" },
      ],
    });
    const w = raise(t, "sawpit", 1640)!;
    expect(t.parcels[w.parcel!].quality).toBe("rich");
  });

  it("means more lumber money buys no more lumber once the hills are full", () => {
    const t = townOn(["timberedHills"], { wealth: 1_000_000 });
    raise(t, "sawpit", 1640);
    expect(buildable(t, "sawpit")).toBe(false);
  });
});

describe("the two dependency edges", () => {
  it("will not raise shipways before there are planks to build with", () => {
    const t = townOn(["roadstead", "timberedHills"]);
    expect(buildable(t, "shipway")).toBe(false);
    raise(t, "sawpit", 1640);
    expect(buildable(t, "shipway")).toBe(true);
  });

  it("will not boil rum before there is cane to boil", () => {
    const t = townOn(["caneFlats", "caneFlats"]);
    expect(buildable(t, "boilingHouse")).toBe(false);
    raise(t, "caneField", 1640);
    expect(buildable(t, "boilingHouse")).toBe(true);
  });

  it("leaves the shipways idle for want of planks when the sawpits burn", () => {
    const t = townOn(["roadstead", "timberedHills"], { population: 400 });
    raise(t, "sawpit", 1640);
    raise(t, "shipway", 1640);
    stepSeason(t);
    expect(t.works.find((w) => w.kind === "shipway")!.condition).toBe("working");

    t.works = t.works.filter((w) => w.kind !== "sawpit");
    stepSeason(t);
    expect(t.works.find((w) => w.kind === "shipway")!.condition).toBe("idle");
  });

  it("knows a downstream work is waiting on a supplier the town lacks", () => {
    const t = townOn(["roadstead", "timberedHills"]);
    expect(starvedFor(t, "sawpit")).toBe(true); // the shipways want planks
  });
});

describe("hands are finite", () => {
  it("idles a work the town has nobody to man", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    stepSeason(t);
    expect(t.works.find((w) => w.kind === "sawpit")!.condition).toBe("idle");
  });

  it("works it again once there are enough people", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    stepSeason(t);
    t.population = 400;
    stepSeason(t);
    expect(t.works.find((w) => w.kind === "sawpit")!.condition).toBe("working");
  });

  it("feeds the town before it earns from it", () => {
    // Too few hands for both: the provision grounds are manned, the sawpits are not.
    const t = townOn(["timberedHills", "provisionGrounds"], { population: 60 });
    raise(t, "sawpit", 1640);
    raise(t, "provisionGround", 1640);
    stepSeason(t);
    const cond = (k: string) => t.works.find((w) => w.kind === k)!.condition;
    expect(cond("provisionGround")).toBe("working");
    expect(cond("sawpit")).toBe("idle");
  });
});

describe("the devolution ladder", () => {
  it("lets an untended work rot by recoverable grades rather than vanishing", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    const w = () => t.works.find((x) => x.kind === "sawpit")!;

    stepSeason(t);
    expect(w().condition).toBe("idle");
    for (let i = 0; i < DECAY.idleToDecayed; i++) stepSeason(t);
    expect(w().condition).toBe("decayed");
    for (let i = 0; i < DECAY.decayedToRuin; i++) stepSeason(t);
    expect(w().condition).toBe("ruin");
  });

  it("leaves ruins in the ledger, so your arson still shows on the ground", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    stepYears(t, 20);
    expect(t.works.some((w) => w.kind === "sawpit" && w.condition === "ruin")).toBe(true);
  });

  it("never rots what people maintain for themselves", () => {
    const t = townOn([], { population: 200 });
    stepYears(t, 40);
    for (const w of t.works) if (CATALOGUE[w.kind].cls === "subsistence") expect(w.condition).not.toBe("ruin");
  });
});

describe("what the town wants", () => {
  it("counts a want unmet when nothing serves it", () => {
    expect(derive(townOn([])).needs.drink).toBe(1);
  });

  it("counts it met once something does", () => {
    const t = townOn([], { population: 40 });
    stepSeason(t); // let the subsistence chapel go up
    raise(t, "tavern", 1640);
    expect(derive(t).needs.drink).toBeLessThan(1);
  });

  it("lets a want go unmet again as the town outgrows what serves it", () => {
    const t = townOn([], { population: 40 });
    raise(t, "tavern", 1640);
    const small = derive(t).needs.drink;
    t.population = 4000;
    expect(derive(t).needs.drink).toBeGreaterThan(small);
  });

  it("houses its own people as it grows", () => {
    const t = townOn([], { population: 200 });
    stepSeason(t);
    expect(countOf(t, "dwellings")).toBeGreaterThan(1);
    expect(derive(t).needs.shelter).toBeLessThan(0.5);
  });
});
