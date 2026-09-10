// What must be true of a town's ground, WHOEVER supplied it.
//
// These are claims about the `Land` STRUCT, not about the generator — which is
// the fixture rule (implementation/testing.md): pin behaviour against the struct,
// never against a producer that is scheduled to move. `rollLand` is scheduled to
// move; KAN-98 cuts a place's ground from the world map instead ([HC-19]). When
// it does, the only line in this file that changes is the one that fetches the
// SAMPLES — every claim below outlives it, because every claim below is a rule
// the world's cut has to satisfy too.
//
// KAN-98 DID IT, and the promise held: the SAMPLES line below is the only line
// in this file that changed. Every claim beneath it now stands against ground
// the world CUT rather than ground a town rolled, and every one of them is a
// rule the cut has to satisfy too — which is what the fixture rule is for.
//
// So: nothing here asserts a coast constant, a region budget, a cay count or a
// harbour chance. Those were the dead producer's dials. What is asserted is the
// partition ([HC-70] R1), contiguity, reproducibility ([HC-11]), and the one
// readability rule [HC-73] keeps alive — that open water lies in the southern arc
// of the town's own frame, which is a DRAWING convention and not a claim about
// where the sea really is.

import { describe, it, expect } from "vitest";
import type { Land } from "./land";
import { isWater, isDead } from "./land";
import { generateWorld } from "../overworld/worldgen";
import { groundAt } from "../overworld/ground";
import type { Axial } from "./hex";
import { CENTRE, key, neighbours, southness, toPixel, axialOf, bearingOf, BEARING_ORDER, disc } from "./hex";
import { foundTown } from "./sim";
import { reg } from "./fixtures";

// One world, and the ground under every place on it. The world seed is
// arbitrary and nothing below depends on its value — only on the same seed
// giving the same answer.
const WORLD = generateWorld(1660);
const SAMPLES: Land[] = WORLD.places.map((p) => groundAt(WORLD, p));

const hexesOf = (g: Land) => [...g.land, ...g.water];
const workable = (g: Land) => g.regions.filter((r) => !isWater(r.terrain));

// Walk a region by adjacency. If the walk reaches every hex, the region is one
// stretch of ground rather than two.
function isOneStretch(hexes: Axial[]): boolean {
  const all = new Set(hexes.map(key));
  const seen = new Set([key(hexes[0])]);
  const queue = [hexes[0]];
  while (queue.length) {
    const h = queue.shift()!;
    for (const n of neighbours(h)) {
      if (all.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); queue.push(n); }
    }
  }
  return seen.size === all.size;
}

const meanSouthness = (hexes: Axial[]) => hexes.reduce((t, h) => t + southness(h), 0) / hexes.length;

describe("a town's ground, however the world supplied it", () => {
  it("gives every hex to exactly one region — a hex given to timber is a hex not given to cane", () => {
    for (const g of SAMPLES) {
      const held = new Map<string, number>();
      for (const r of g.regions) for (const h of r.hexes) held.set(key(h), (held.get(key(h)) ?? 0) + 1);
      // Nothing is held twice: the land is a partition, not a menu (R1).
      for (const [k, times] of held) expect(times, `${k} is in ${times} regions`).toBe(1);
      // ...and nothing is left out, so capacity can never hide from the ledger.
      for (const h of hexesOf(g)) expect(held.has(key(h)), `${key(h)} is in no region`).toBe(true);
      // ...and no region claims ground the town does not have.
      const ground = new Set(hexesOf(g).map(key));
      for (const r of g.regions) for (const h of r.hexes) expect(ground.has(key(h))).toBe(true);
    }
  });

  it("makes every stretch of workable ground one region, not a scatter", () => {
    // Water is exempt and deliberately so: a cay is detached by design (§2.2),
    // and fishing banks are wherever the banks are. Ground a town WORKS has to
    // hold together, because area is capacity and reach is measured from the town.
    for (const g of SAMPLES) {
      for (const r of workable(g)) {
        expect(isOneStretch(r.hexes), `region ${r.id} (${r.terrain}) is in pieces`).toBe(true);
      }
    }
  });

  it("keeps the sea out of the fields — water regions hold water, workable regions hold land", () => {
    for (const g of SAMPLES) {
      const wet = new Set(g.water.map(key));
      for (const r of g.regions) {
        for (const h of r.hexes) {
          expect(wet.has(key(h)), `${key(h)} in ${r.terrain} region ${r.id}`).toBe(isWater(r.terrain));
        }
      }
    }
  });

  it("leaves dead ground bearing nothing at all", () => {
    for (const g of SAMPLES) {
      for (const r of g.regions) {
        if (!isDead(r.terrain)) continue;
        expect(Object.keys(r.bears), `${r.terrain} should bear nothing`).toHaveLength(0);
      }
    }
  });

  it("gives the same world the same ground twice over, so a history can be replayed", () => {
    // [HC-11]: reproducible means the whole history, and it starts here.
    for (const p of WORLD.places.slice(0, 8)) {
      expect(groundAt(WORLD, p)).toEqual(groundAt(WORLD, p));
    }
  });

  it("gives a different world different ground, from one number", () => {
    const elsewhere = generateWorld(1661);
    const here = groundAt(WORLD, WORLD.places[0]);
    const there = groundAt(elsewhere, elsewhere.places[0]);
    // Not merely different hexes: different COASTS. One number changed.
    expect(there.regions.map((r) => r.terrain)).not.toEqual(here.regions.map((r) => r.terrain));
  });
});

describe("the sea lies south — as a drawing convention, not a geographic claim", () => {
  // [HC-73]. The world holds a place's TRUE coastal bearing; these are claims
  // about the LOCAL frame the town's own maps are drawn in, whose south is
  // seaward by construction. A rotation into that frame preserves them exactly,
  // which is why the invariant survives the world deciding the real coast.

  it("gives every town a landing: open water touching the town, in the southern arc", () => {
    for (const g of SAMPLES) {
      const wet = new Set(g.water.map(key));
      const landing = neighbours(CENTRE).filter((n) => southness(n) > 0 && wet.has(key(n)));
      expect(landing.length, "nowhere to come ashore").toBeGreaterThan(0);
    }
  });

  it("puts the water seaward of the ground, however irregular the coast is", () => {
    // Not "every water hex is south of every land hex" — a bay may bite north and
    // a headland may jut south (§2.7). The relationship is between the two
    // centres of mass, and it is what makes the map read as a coast.
    for (const g of SAMPLES) {
      expect(meanSouthness(g.water)).toBeGreaterThan(meanSouthness(g.land));
    }
  });

  it("draws that seaward axis down the page, which is the whole of what the maps read", () => {
    // The quay is the southernmost claimed hex pushed to its shore (plan.ts), and
    // the hex map lays water along the bottom. Both read pixel y and nothing else.
    // So the convention holds iff seaward-ness and y agree, everywhere.
    const cells = disc(3);
    for (const a of cells) {
      for (const b of cells) {
        const bySea = Math.sign(southness(a) - southness(b));
        const byPage = Math.sign(toPixel(a, 12).y - toPixel(b, 12).y);
        expect(byPage, `${key(a)} vs ${key(b)}`).toBe(bySea);
      }
    }
  });
});

describe("founding a town", () => {
  const ground = (hexes: Axial[]): Land => ({
    land: [CENTRE, ...hexes],
    water: [{ q: 0, r: 1 }],
    regions: [reg(1, "tilledGround", hexes, { bears: { food: "ideal" } })],
  });

  it("stands the town on ground it is given, and invents no coast of its own", () => {
    const given = ground([{ q: 1, r: 0 }, { q: 1, r: -1 }]);
    const town = foundTown({ name: "Given", seed: 7 }, given);
    expect(town.land.map(key)).toEqual(given.land.map(key));
    expect(town.water.map(key)).toEqual(given.water.map(key));
    expect(town.regions).toEqual(given.regions);
  });

  it("puts two towns of the same seed on different ground, because the ground is not theirs to roll", () => {
    // The whole of KAN-103 in one assertion. Before it, `seed` decided the coast;
    // after it, the world does and `seed` is only the town's own stream.
    const here = foundTown({ name: "Here", seed: 7 }, ground([{ q: 1, r: 0 }]));
    const there = foundTown({ name: "There", seed: 7 }, ground([{ q: -1, r: 0 }, { q: 0, r: -1 }]));
    expect(there.land.map(key)).not.toEqual(here.land.map(key));
  });

  it("founds a town on bare ground without conjuring any", () => {
    const bare = foundTown({ name: "Bare", seed: 7 }, { land: [], water: [], regions: [] });
    expect(bare.land).toHaveLength(0);
    expect(bare.regions).toHaveLength(0);
  });
});

describe("the compass a region's bearing is read off", () => {
  it("names each of the six neighbours as its own bearing", () => {
    for (const b of BEARING_ORDER) expect(bearingOf(axialOf(b))).toBe(b);
  });

  it("reads the same bearing however far out the ground lies", () => {
    for (const b of BEARING_ORDER) {
      const d = axialOf(b);
      for (let k = 1; k <= 4; k++) expect(bearingOf({ q: d.q * k, r: d.r * k })).toBe(b);
    }
  });

  it("needs no normalising, because all six bearings lie the same distance from the town", () => {
    // This is why [P-5]'s banned `Math.hypot` could simply go: bearingOf divided
    // every candidate dot product by the same positive constant before taking a
    // maximum, and a common positive divisor cannot change which candidate wins.
    const lengths = BEARING_ORDER.map((b) => {
      const p = toPixel(axialOf(b), 1);
      return p.x * p.x + p.y * p.y;
    });
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0], 12);
  });
});
