// Behaviour tests for what the land map SAYS (KAN-80).
//
// Per testing.md the markup itself is not tested — but `hexSummary` is a pure
// function over the ledger, and it carries the load-bearing rule of this story:
// a hex has no output, it has capacity, and every figure shown on it is summed
// from the works standing there.

import { describe, it, expect } from "vitest";
import { makeTown, derive, stepSeason } from "./sim";
import { raise } from "./works";
import { hexSummary, landCaption } from "./hexmap";
import type { ParcelTerrain, Town, Bearing } from "./types";

const RING: Bearing[] = ["N", "NE", "SE", "S", "SW", "NW"];

function townOn(terrains: ParcelTerrain[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    population: 400,
    parcels: terrains.map((terrain, i) => ({ terrain, quality: "fair" as const, bearing: RING[i] })),
    ...init,
  });
}

describe("a hex has no output — it has capacity", () => {
  it("shows nothing coming off ground nothing stands on", () => {
    const t = townOn(["timberedHills"]);
    const s = hexSummary(t, 0);
    expect(s.worked).toBe(false);
    expect(s.earns).toEqual({ trade: 0, food: 0, defence: 0 });
  });

  it("reports exactly what the works standing on it report — never a figure of its own", () => {
    const t = townOn(["timberedHills", "timberedHills"]);
    raise(t, "sawpit", 1640);
    raise(t, "sawpit", 1640);
    const total = [0, 1].reduce((sum, i) => sum + hexSummary(t, i).earns.trade, 0);
    expect(total).toBeCloseTo(derive(t).trade, 6); // the map and the ledger agree, exactly
  });

  it("stops counting a work the moment it stops working", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    const earning = hexSummary(t, 0).earns.trade;
    stepSeason(t); // too few hands: it idles
    expect(earning).toBeGreaterThan(0);
    expect(hexSummary(t, 0).earns.trade).toBe(0);
  });
});

describe("capacity is ghosted until something stands on the ground", () => {
  it("says what an empty hex would carry", () => {
    const s = hexSummary(townOn(["timberedHills"]), 0);
    expect(s.couldCarry).toContain("sawpits");
    expect(s.standing).toEqual([]);
  });

  it("says what stands there once it does", () => {
    const t = townOn(["timberedHills"]);
    raise(t, "sawpit", 1640);
    const s = hexSummary(t, 0);
    expect(s.worked).toBe(true);
    expect(s.standing.join(" ")).toContain("sawpits");
  });

  it("tallies rather than repeating itself", () => {
    const t = townOn(["timberedHills", "timberedHills"]);
    raise(t, "sawpit", 1640);
    raise(t, "sawpit", 1640);
    // two hexes, one work each — the tally is per hex, so no "x2" here
    expect(hexSummary(t, 0).standing.length).toBe(1);
  });

  it("shows when the ground is spoken for", () => {
    const t = townOn(["timberedHills"]);
    expect(hexSummary(t, 0).room).toBe(true);
    raise(t, "sawpit", 1640);
    expect(hexSummary(t, 0).room).toBe(false);
  });
});

describe("dead ground reads as dead", () => {
  it("offers no capacity at all", () => {
    for (const terrain of ["marsh", "scrub", "openSea"] as ParcelTerrain[]) {
      const s = hexSummary(townOn([terrain]), 0);
      expect(s.dead).toBe(true);
      expect(s.couldCarry).toEqual([]);
      expect(s.room).toBe(false);
    }
  });
});

describe("scars stay on the map", () => {
  it("counts the burnt shells so your own arson shows next time", () => {
    const t = townOn(["timberedHills"], { population: 12 });
    raise(t, "sawpit", 1640);
    t.works[0].condition = "ruin";
    expect(hexSummary(t, 0).ruins).toBe(1);
  });
});

describe("the map tells you how you would come ashore", () => {
  it("names the sheltered water when there is some", () => {
    const t = townOn(["roadstead"]);
    t.parcels[0].bearing = "S";
    expect(landCaption(t)).toContain("south");
  });

  it("says so when there is none", () => {
    expect(landCaption(townOn(["timberedHills"]))).toContain("open beach");
  });

  it("warns about the marsh, because that is where a raider would struggle", () => {
    const t = townOn(["roadstead", "marsh"]);
    t.parcels[0].bearing = "S";
    t.parcels[1].bearing = "NW";
    expect(landCaption(t)).toContain("Slow going");
  });
});
