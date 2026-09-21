// The cut — a place's ground, taken from the world map at its position.
//
// `town/land.test.ts` already pins what must be true of the LAND STRUCT whoever
// supplied it: the partition, contiguity, reproducibility, and the drawing
// convention that water lies south. This file pins the other half — the
// RELATIONSHIP between the ground a town holds and the world it was cut from,
// which is the whole of [HC-19] and the reason the stand-in had to die.

import { describe, it, expect } from "vitest";
import { CUT, groundAt } from "./ground";
import { CLIMATES } from "./climate";
import { heightAt } from "./shape";
import { generateWorld } from "./worldgen";
import { CENTRE, key, neighbours, toPixel, distance } from "../town/hex";
import type { Axial } from "../town/hex";
import { isWater } from "../town/land";
import type { Place } from "./places";

const WORLD = generateWorld(1660);
const CUTS = WORLD.places.map((p) => ({ place: p, ground: groundAt(WORLD, p) }));

// The same world-to-local rotation the cut uses, so a test can ask the map what
// it thinks is at a hex.
function worldOf(p: Place, h: Axial) {
  const size = CUT.hexNm / Math.sqrt(3);
  const px = toPixel(h, size);
  return {
    x: p.x - p.sx * CUT.inlandNm + p.sy * px.x + p.sx * px.y,
    y: p.y - p.sy * CUT.inlandNm - p.sx * px.x + p.sy * px.y,
  };
}

const LANDING = { q: 0, r: 1 };

describe("a town's ground is the ground the world has at its position", () => {
  it("puts land where the map has land and water where the map has water", () => {
    // THE [HC-19] CLAIM. Every hex is checked against the world field at the hex
    // centre. Exactly two hexes may disagree, and both are sitings rather than
    // geography: the town itself stands on dry ground, and a port has somewhere
    // to come ashore.
    for (const { place, ground } of CUTS) {
      for (const h of ground.land) {
        if (key(h) === key(CENTRE)) continue;
        const w = worldOf(place, h);
        expect(heightAt(WORLD.shape, w.x, w.y), `${place.name} ${key(h)} is sea on the map`).toBeGreaterThan(0);
      }
      for (const h of ground.water) {
        if (key(h) === key(LANDING)) continue;
        const w = worldOf(place, h);
        expect(heightAt(WORLD.shape, w.x, w.y), `${place.name} ${key(h)} is dry on the map`).toBeLessThanOrEqual(0);
      }
    }
  });

  it("moves a town's ground when the town moves, because the ground is not the town's", () => {
    // Before the cut, `seed` decided a coast and two places on the same seed had
    // the same land wherever they stood. Now position decides, and nothing else.
    const seen = new Set(CUTS.map(({ ground }) => ground.regions.map((r) => `${r.terrain}:${r.hexes.length}`).join("|")));
    expect(seen.size).toBeGreaterThan(CUTS.length / 2);
  });

  it("draws the water seaward whichever way the real coast faces", () => {
    // [HC-73]. The world holds the true bearing; the cut rotates into a frame
    // whose south is seaward. So places facing OPPOSITE ways in the world must
    // both come out with their water to the south of their land — which is the
    // proof that the rotation is doing the work and not an assumption.
    const facing = (sign: number) => CUTS.filter(({ place }) => Math.sign(place.sy) === sign);
    const southward = facing(1);
    const northward = facing(-1);
    expect(southward.length).toBeGreaterThan(0);
    expect(northward.length).toBeGreaterThan(0);
    const meanSouthness = (hs: Axial[]) => hs.reduce((t, h) => t + h.r + h.q / 2, 0) / hs.length;
    for (const { place, ground } of [...southward, ...northward]) {
      expect(meanSouthness(ground.water), place.name).toBeGreaterThan(meanSouthness(ground.land));
    }
  });

  it("cuts a coast, not a disc", () => {
    // THE CLAIM THAT CAUGHT THE WORST BUG IN THIS FILE'S HISTORY, and the reason
    // it is worth keeping. Twice the cut produced a shoreline that was identical
    // in every town — first because the town's centre stood more than a hex
    // inland, so the waterline never fell inside the cut at all and what came out
    // was a disc of land with the wet rim of the trim around it; then because the
    // coast field had no detail left at fifteen miles and the shore came out
    // straight. Both passed every other claim in this file.
    //
    // The measure is the shoreline's RANGE: for each column of the local map, how
    // far seaward the first water hex lies. A dead straight coast gives 0.5,
    // which is the hex grid's own parity and nothing more. A coast with a
    // headland and a cove in it gives more.
    const shorelines: string[] = [];
    for (const { ground } of CUTS) {
      const byColumn = new Map<number, number[]>();
      for (const h of ground.water) {
        if (!byColumn.has(h.q)) byColumn.set(h.q, []);
        byColumn.get(h.q)!.push(h.r + h.q / 2);
      }
      shorelines.push(
        [...byColumn.keys()].sort((a, b) => a - b).map((q) => Math.min(...byColumn.get(q)!)).join(","),
      );
    }
    // Fifty coasts, fifty shapes. When the cut was a disc, forty-eight of them
    // read `1.5,2,1.5,1,1.5,2,1.5` — the rim of the trim, identical everywhere.
    expect(new Set(shorelines).size, "towns share a shoreline").toBeGreaterThan(shorelines.length * 0.7);
  });

  it("keeps the guaranteed landing an exception rather than the way every town gets its water", () => {
    // The other half of the same bug, and the sharper half. The cut promises
    // every port somewhere to come ashore, and where the coast leaves none it
    // gives one hex back to the sea. That is a correction, and a correction that
    // fires for EVERY PLACE IN THE WORLD is not a correction — it means the
    // waterline never fell inside the cut and the map stopped deciding anything.
    // Measured when it was broken: fifty places, fifty forced landings.
    let forced = 0;
    for (const { place, ground } of CUTS) {
      const isLanding = ground.water.some((h) => key(h) === key(LANDING));
      if (!isLanding) continue;
      const w = worldOf(place, LANDING);
      if (heightAt(WORLD.shape, w.x, w.y) > 0) forced++; // dry on the map, wet on the cut
    }
    expect(forced, "the map is not deciding where the water is").toBeLessThan(CUTS.length * 0.25);
  });

  it("cuts a town's ground at the scale a town works, not the scale a chart shows", () => {
    // The town's whole land is a dozen sea miles of coast and hinterland — which
    // is what makes the coast field's fine octaves load-bearing rather than
    // decorative, and what keeps two neighbouring ports from being cut from the
    // same ground.
    const span = CUT.hexNm * 8;
    expect(span).toBeGreaterThan(4);
    expect(span).toBeLessThan(40);
    for (let i = 0; i < CUTS.length; i++) {
      for (let j = i + 1; j < CUTS.length; j++) {
        const a = CUTS[i].place;
        const b = CUTS[j].place;
        const apart = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
        expect(apart, `${a.name} and ${b.name} overlap`).toBeGreaterThan(span);
      }
    }
  });
});

describe("the climate constrains the ground; the position varies it", () => {
  it("never gives a place ground its zone forbids", () => {
    // [HC-28] said as the test it deserves: a dry zone never yields a cane flat,
    // because a cane flat is not on its palette and the cut may only choose from
    // the palette. Water is the world's, not the zone's.
    for (const { place, ground } of CUTS) {
      const palette = CLIMATES[WORLD.zones[place.zone].climate].ground.palette;
      for (const r of ground.regions) {
        if (isWater(r.terrain)) continue;
        expect(palette, `${place.name} has ${r.terrain}, which its zone forbids`).toContain(r.terrain);
      }
    }
  });

  it("varies the ground within one zone, so the climate is a constraint and not a stamp", () => {
    // The other half of [HC-28]. If the zone decided the ground outright, every
    // place in a zone would have identical land and position would mean nothing.
    const byZone = new Map<number, Set<string>>();
    for (const { place, ground } of CUTS) {
      if (!byZone.has(place.zone)) byZone.set(place.zone, new Set());
      const shape = ground.regions.filter((r) => !isWater(r.terrain)).map((r) => r.terrain).sort().join(",");
      byZone.get(place.zone)!.add(shape);
    }
    const crowded = [...byZone.values()].filter((s) => s.size > 0);
    expect(crowded.some((s) => s.size > 1)).toBe(true);
  });

  it("grades a zone's own crop up where the ground bears it", () => {
    // The zone's `favours` is the suitability half of §7.1's fourth part: two
    // cane flats in different climates are not the same cane flat.
    let promoted = 0;
    for (const { place, ground } of CUTS) {
      const favours = CLIMATES[WORLD.zones[place.zone].climate].ground.favours;
      for (const r of ground.regions) {
        for (const p of favours) if (r.bears[p] === "ideal") promoted++;
      }
    }
    expect(promoted).toBeGreaterThan(0);
  });
});

describe("what the map owes every place", () => {
  it("gives every place ground that can feed it", () => {
    // [HC-22]: a place was settled because something there would feed it. Without
    // this a town with no food-bearing ground can raise neither garden plots nor
    // provision grounds, and falls to the hamlet floor for a reason the
    // generator caused.
    for (const { place, ground } of CUTS) {
      expect(ground.regions.some((r) => r.bears.food !== undefined), `${place.name} cannot feed itself`).toBe(true);
    }
  });

  it("gives every place somewhere to come ashore", () => {
    for (const { place, ground } of CUTS) {
      const wet = new Set(ground.water.map(key));
      const landing = neighbours(CENTRE).filter((n) => n.r + n.q / 2 > 0 && wet.has(key(n)));
      expect(landing.length, `${place.name} has nowhere to land`).toBeGreaterThan(0);
    }
  });

  it("makes a bluff a place that stands over water, never one in the middle of the country", () => {
    for (const { place, ground } of CUTS) {
      const water = ground.water;
      for (const r of ground.regions) {
        if (r.terrain !== "bluff") continue;
        for (const h of r.hexes) {
          const insight = water.some((w) => distance(h, w) <= CUT.bluffSightHexes);
          expect(insight, `${place.name}: a bluff out of sight of the sea`).toBe(true);
        }
      }
    }
  });

  it("makes fishing banks where the bottom nearly reaches, not wherever a roll fell", () => {
    // The banks are a map fact like everything else: shallow water. A roadstead
    // is the exception and is chosen for shelter, not depth.
    for (const { place, ground } of CUTS) {
      for (const r of ground.regions) {
        if (r.terrain !== "reef") continue;
        for (const h of r.hexes) {
          const w = worldOf(place, h);
          expect(heightAt(WORLD.shape, w.x, w.y), `${place.name} banks in deep water`).toBeGreaterThan(-CUT.bankDepth);
        }
      }
    }
  });

  it("puts an anchorage where the land wraps the water, and nowhere else", () => {
    for (const { place, ground } of CUTS) {
      const land = new Set(ground.land.map(key));
      const road = ground.regions.find((r) => r.terrain === "roadstead");
      if (!road) continue;
      for (const h of road.hexes) {
        const walls = neighbours(h).filter((n) => land.has(key(n))).length;
        expect(walls, `${place.name}'s anchorage is open water`).toBeGreaterThanOrEqual(CUT.minRoadsteadWalls);
      }
    }
  });
});

// ---- The second guarantee --------------------------------------------------
//
// `guaranteeVictuals` has undertaken since KAN-98 that every place bears food.
// Nothing undertook anything about TIMBER, and timber has no substitute: the
// sawpit is the only work in the catalogue that produces materials, and nothing
// quarries stone at all. So a market
// neighbourhood with no timber in it can never build anything ([HC-87c]) — which
// is why the guarantee exists, and why it is owed to the MARKET and not to the
// place. `worldgen.test.ts` holds the covering; this file holds the cut.
describe("a stand of timber, where the map left a market none", () => {
  const withGrant = (p: Place) => groundAt(WORLD, { ...p, timberGranted: true });
  const without = (p: Place) => groundAt(WORLD, { ...p, timberGranted: false });
  const timbered = (g: { regions: { bears: { timber?: unknown } }[] }) =>
    g.regions.some((r) => r.bears.timber !== undefined);

  // A coast the map left bare, and one it did not. Both are found rather than
  // authored, and the claims below are worth nothing without both.
  const bare = WORLD.places.filter((p) => !timbered(without(p)));
  const wooded = WORLD.places.filter((p) => timbered(without(p)));
  // ...and the third kind, which is the reason the first claim is conditional: a
  // place whose every stretch of country bears food has nothing to spare, and
  // the guarantee will not take its bread. The covering passes such a coast over
  // and rescues its market through a neighbour instead.
  const spared = (p: Place) => without(p).regions.some((r) => r.bears.food === undefined && !isWater(r.terrain));

  it("finds the world all three kinds of coast to ask about", () => {
    // The precondition the claims below stand on. A fixture that could not tell
    // a bare coast from a wooded one would make either of them a decoration —
    // and one with no coast that has nothing to spare could not tell the
    // conditional claim from the unconditional one.
    expect(bare.length).toBeGreaterThan(0);
    expect(wooded.length).toBeGreaterThan(0);
    expect(WORLD.places.filter((p) => !spared(p)).length).toBeGreaterThan(0);
  });

  it("gives a bare coast timber to cut, wherever it has ground to spare", () => {
    for (const p of bare) {
      if (!spared(p)) continue;
      expect(timbered(withGrant(p)), `${p.name} was granted a stand and has none`).toBe(true);
    }
  });

  it("plants a stand only where one was ASKED FOR, and never off its own bat", () => {
    // THE LIVENESS GUARD UNDER EVERY CLAIM IN THIS BLOCK, and it was written
    // because a mutation walked through the lot of them. Ignore the flag and
    // plant a stand on every coast, and `withGrant` and `without` become the
    // same cut — so every claim that compares the two passes by being
    // tautological, and the partition above quietly empties instead of failing.
    //
    // So this counts. It asserts that the world holds coasts the guarantee
    // CHANGES, which is the thing a flag ignored in either direction destroys.
    let changed = 0;
    for (const p of WORLD.places) {
      if (!spared(p)) continue;
      const asked = timbered(withGrant(p));
      const unasked = timbered(without(p));
      if (!unasked) {
        expect(asked, `${p.name} refused a stand it was asked for`).toBe(true);
        changed++;
      }
    }
    expect(changed, "no coast on this map is any different for being granted a stand")
      .toBeGreaterThan(0);
  });

  it("refuses a coast that is all fields, rather than taking the fields", () => {
    // The other half of the same rule, and the half that keeps [HC-22] whole.
    for (const p of WORLD.places) {
      if (spared(p)) continue;
      expect(withGrant(p), `${p.name} was ploughed under for planks`).toEqual(without(p));
    }
  });

  it("changes nothing at all on a coast the map already wooded", () => {
    // The undertaking is "make sure this market can reach timber", not "convert
    // a region" — so on ground that already bears it, it is a no-op down to the
    // last hex, and the covering may grant freely without disturbing anything.
    for (const p of wooded) {
      expect(withGrant(p), `${p.name} was disturbed by a grant it did not need`).toEqual(without(p));
    }
  });

  it("never takes the stand out of the town's own bread", () => {
    // [HC-22] IS NOT TRADED FOR PLANKS. `guaranteeVictuals` runs first and the
    // stand is cut from ground that bears no food at all, so what a place can
    // feed itself is the same either way — at every grade, not merely in total.
    for (const p of WORLD.places) {
      const fed = (g: ReturnType<typeof without>) =>
        g.regions
          .filter((r) => r.bears.food !== undefined)
          .map((r) => `${r.id}:${r.terrain}:${r.bears.food}:${r.hexes.length}`)
          .sort();
      expect(fed(withGrant(p)), `${p.name} sold its fields for timber`).toEqual(fed(without(p)));
    }
  });

  it("cuts the stand out of the largest ground the place has to spare", () => {
    // [P-10]: biggest first, id as the tie-break, so which stretch of country
    // becomes the timbered hills never depends on the order a loop reached it.
    for (const p of bare) {
      const before = without(p);
      const after = withGrant(p);
      const moved: number[] = [];
      for (let i = 0; i < before.regions.length; i++) {
        if (after.regions[i].terrain !== before.regions[i].terrain) moved.push(i);
      }
      if (!moved.length) continue; // nothing to spare; the covering passes it over
      expect(moved.length, `${p.name} lost more than one stretch of country`).toBe(1);
      const spare = before.regions.filter((r) => r.bears.food === undefined && !isWater(r.terrain));
      const largest = Math.max(...spare.map((r) => r.hexes.length));
      expect(before.regions[moved[0]].hexes.length, `${p.name} cut its stand out of the wrong ground`)
        .toBe(largest);
    }
  });
});

describe("cutting the same ground twice", () => {
  it("gives the same answer, so a history can be replayed", () => {
    for (const { place, ground } of CUTS.slice(0, 10)) {
      expect(groundAt(WORLD, place)).toEqual(ground);
    }
  });

  it("takes its small rolls from the world's stream, never from a fresh one", () => {
    // [HC-10]: what the map has no opinion about — which crop this stretch
    // favours, where the best of it lies — still comes from a seed derived from
    // the world's, through the sanctioned bridge.
    const other = generateWorld(1661);
    const here = groundAt(WORLD, WORLD.places[0]);
    const there = groundAt(other, other.places[0]);
    expect(there).not.toEqual(here);
  });
});
