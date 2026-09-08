// Behaviour tests for the founding roll on a hex ring (KAN-69, reframed by KAN-79).
// House style: names are design claims; assert directions and relationships,
// never tuned constants. See docs/knowledge/implementation/testing.md.

import { describe, it, expect } from "vitest";
import { makeRng } from "../rng";
import { rollParcels, vocationOf, describeLand, bestOf, has, isWater, isDead, deadCount } from "./parcels";
import { foundTown } from "./sim";
import { LAND } from "./constants";
import type { Parcel, ParcelTerrain } from "./types";

const roll = (seed: number) => rollParcels(makeRng(seed));
const seeds = Array.from({ length: 300 }, (_, i) => i + 1);
const SEAWARD = ["S", "SE", "SW"];

describe("a town's land is a hex ring", () => {
  it("is always exactly six parcels — one per hex, never subdivided", () => {
    for (const s of seeds) expect(roll(s).length).toBe(LAND.ring);
  });

  it("gives each parcel its own bearing, so no two sit on the same ground", () => {
    for (const s of seeds) {
      const bearings = roll(s).map((p) => p.bearing);
      expect(new Set(bearings).size).toBe(bearings.length);
    }
  });

  it("never uses a bearing a flat-top hex does not have", () => {
    const six = ["N", "NE", "SE", "S", "SW", "NW"];
    for (const s of seeds) for (const p of roll(s)) expect(six).toContain(p.bearing);
  });

  it("keeps the sea to the south — water is never inland", () => {
    // One-way rule: fields may run down to the shore, but a harbour is never inland.
    for (const s of seeds) {
      for (const p of roll(s)) if (isWater(p.terrain)) expect(SEAWARD).toContain(p.bearing);
    }
  });

  it("never gives a town more coast than it has shoreline", () => {
    for (const s of seeds) expect(roll(s).filter((p) => isWater(p.terrain)).length).toBeLessThanOrEqual(3);
  });
});

describe("the roll is biased, not uniform", () => {
  it("always gives the town one calling it is genuinely good at", () => {
    for (const s of seeds) expect(roll(s)[0].quality).toBe("rich");
  });

  it("never makes dead ground or a defensive bluff the reason the town exists", () => {
    for (const s of seeds) {
      const v = vocationOf(roll(s))!;
      expect(v).not.toBe("bluff");
      expect(isDead(v)).toBe(false);
    }
  });

  it("makes rich land scarce outside the town's calling", () => {
    let rich = 0, total = 0;
    for (const s of seeds) for (const p of roll(s).slice(1)) { total++; if (p.quality === "rich") rich++; }
    expect(rich / total).toBeLessThan(0.4);
  });

  it("gives different towns different callings", () => {
    expect(new Set(seeds.map((s) => vocationOf(roll(s)))).size).toBeGreaterThan(2);
  });

  it("lets a town lack something entirely — that is what makes it a place", () => {
    expect(seeds.some((s) => !has(roll(s), "roadstead"))).toBe(true);
  });
});

describe("dead ground is where the variety went", () => {
  // Fixing the count at six removed a source of variation; this replaced it.
  it("leaves some towns hemmed in by ground worth nothing", () => {
    expect(seeds.some((s) => deadCount(roll(s)) >= 2)).toBe(true);
  });

  it("still leaves some towns with room on every side", () => {
    expect(seeds.some((s) => deadCount(roll(s)) === 0)).toBe(true);
  });

  it("never lets dead ground carry a grade worth boasting about", () => {
    for (const s of seeds) for (const p of roll(s)) if (isDead(p.terrain)) expect(p.quality).toBe("poor");
  });

  it("says the ceiling out loud when a town is badly hemmed in", () => {
    const hemmed = seeds.map(roll).find((p) => deadCount(p) >= 3);
    expect(hemmed).toBeDefined();
    expect(describeLand(hemmed!)).toMatch(/poor ground on \d sides/);
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
    for (const s of seeds.slice(0, 40)) {
      const text = describeLand(roll(s));
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("leads with what the town is for", () => {
    const NOUN: Partial<Record<ParcelTerrain, string>> = {
      timberedHills: "timbered hills", caneFlats: "cane flats", provisionGrounds: "provision grounds",
      reef: "fishing banks", roadstead: "anchorage",
    };
    for (const s of seeds.slice(0, 40)) {
      const p = roll(s);
      expect(describeLand(p)).toContain(NOUN[vocationOf(p)!]);
    }
  });

  it("does not describe a town by ground that yields nothing", () => {
    for (const s of seeds.slice(0, 40)) {
      const text = describeLand(roll(s));
      const live = roll(s).filter((p) => !isDead(p.terrain));
      if (live.length) expect(text.startsWith("nothing but")).toBe(false);
    }
  });

  it("finds the best grade of a terrain the town holds", () => {
    const parcels: Parcel[] = [
      { terrain: "timberedHills", quality: "poor", bearing: "N" },
      { terrain: "timberedHills", quality: "rich", bearing: "NE" },
    ];
    expect(bestOf(parcels, "timberedHills")!.quality).toBe("rich");
    expect(bestOf(parcels, "caneFlats")).toBeNull();
  });
});
