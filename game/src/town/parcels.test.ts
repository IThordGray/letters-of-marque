// Behaviour tests for the founding roll (KAN-69).
// House style: names are design claims; assert directions and relationships,
// never tuned constants. See docs/knowledge/implementation/testing.md.

import { describe, it, expect } from "vitest";
import { makeRng } from "../rng";
import { rollParcels, vocationOf, describeLand, bestOf, has } from "./parcels";
import { foundTown } from "./sim";
import { LAND } from "./constants";
import type { Parcel } from "./types";

const roll = (seed: number) => rollParcels(makeRng(seed));
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

describe("a town's land", () => {
  it("is a ring of a handful of parcels, never a grid", () => {
    for (const s of seeds) {
      const p = roll(s);
      expect(p.length).toBeGreaterThanOrEqual(LAND.min);
      expect(p.length).toBeLessThanOrEqual(LAND.max);
    }
  });

  it("always gives the town one calling it is genuinely good at", () => {
    for (const s of seeds) {
      const p = roll(s);
      expect(p[0].quality).toBe("rich");
    }
  });

  it("never makes a defensive bluff the town's reason for existing", () => {
    for (const s of seeds) expect(vocationOf(roll(s))).not.toBe("bluff");
  });

  it("always puts water to seaward, so industry can be placed facing its own land", () => {
    // One-way rule: fields may run down to the shore, but the harbour is never inland.
    for (const s of seeds) {
      for (const p of roll(s)) {
        if (p.terrain !== "reef" && p.terrain !== "roadstead") continue;
        expect(["S", "SE", "SW"]).toContain(p.bearing);
      }
    }
  });

  it("never gives a town more coast than it has shoreline", () => {
    for (const s of seeds) {
      const water = roll(s).filter((p) => p.terrain === "reef" || p.terrain === "roadstead");
      expect(water.length).toBeLessThanOrEqual(3);
    }
  });

  it("does not stack two parcels on the same bearing", () => {
    for (const s of seeds) {
      const bearings = roll(s).map((p) => p.bearing);
      expect(new Set(bearings).size).toBe(bearings.length);
    }
  });
});

describe("the roll is biased, not uniform", () => {
  // The whole point: a uniform roll makes every town mediocre at everything.
  it("makes rich land scarce outside the town's calling", () => {
    let rich = 0;
    let total = 0;
    for (const s of seeds) {
      for (const p of roll(s).slice(1)) {
        total++;
        if (p.quality === "rich") rich++;
      }
    }
    expect(rich / total).toBeLessThan(0.4); // most land is ordinary
  });

  it("gives different towns different callings", () => {
    const callings = new Set(seeds.map((s) => vocationOf(roll(s))));
    expect(callings.size).toBeGreaterThan(2);
  });

  it("lets a town be genuinely poor in something it has none of", () => {
    // Some town, somewhere, has no harbour at all — that is what makes it a place.
    expect(seeds.some((s) => !has(roll(s), "roadstead"))).toBe(true);
  });
});

describe("the same seed always founds the same town", () => {
  it("rolls identical land twice", () => {
    expect(roll(4242)).toEqual(roll(4242));
  });

  it("gives a founded town its land from its own seed", () => {
    expect(foundTown({ name: "A", seed: 77 }).parcels).toEqual(foundTown({ name: "B", seed: 77 }).parcels);
  });

  it("gives different seeds different land", () => {
    expect(foundTown({ name: "A", seed: 1 }).parcels).not.toEqual(foundTown({ name: "B", seed: 2 }).parcels);
  });
});

describe("the land can be said in a sentence", () => {
  it("describes every town in a readable clause", () => {
    for (const s of seeds.slice(0, 20)) {
      const text = describeLand(roll(s));
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("leads with what the town is for", () => {
    const p = roll(11);
    expect(describeLand(p)).toContain(
      { timberedHills: "timbered hills", caneFlats: "cane flats", provisionGrounds: "provision grounds",
        reef: "fishing banks", roadstead: "anchorage", bluff: "bluff" }[vocationOf(p)!],
    );
  });

  it("finds the best grade of a terrain the town holds", () => {
    const parcels: Parcel[] = [
      { terrain: "timberedHills", quality: "poor", bearing: "N" },
      { terrain: "timberedHills", quality: "rich", bearing: "E" },
    ];
    expect(bestOf(parcels, "timberedHills")!.quality).toBe("rich");
    expect(bestOf(parcels, "caneFlats")).toBeNull();
  });
});
