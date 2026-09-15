// Climate — the rulebook weather will obey, and the constraint a town's ground
// is cut inside.
//
// Nothing here asserts a wind strength, a storm rate or a rainfall number. What
// is asserted is that every climate is COMPLETE (a table with a missing part is
// a system with a hole in it), that a zone is a place on the map rather than a
// label, that climate cannot change, and that exposure is a property of the map.

import { describe, it, expect } from "vitest";
import type { Climate } from "./climate";
import {
  CLIMATES, CLIMATE_IDS, TERRAIN_BEARS, baselineOf, climateOf,
  exposureOf, makeZones, stormTrack, windOf, zoneAt,
} from "./climate";
import { WORLD_BOX } from "./shape";
import type { Season } from "./calendar";
import { makeWorld } from "./clock";

const SEED = 1660;
const ZONES = makeZones(SEED);
const SEASONS: Season[] = [0, 1, 2, 3];

describe("a climate is a complete rulebook or it is a hole in the system", () => {
  it("names all four parts, for all four seasons, for every climate", () => {
    // §7.1: a climate consists of exactly four things. A row missing one of them
    // would fail silently at the point some other system read it.
    for (const id of CLIMATE_IDS) {
      const c = CLIMATES[id];
      expect(c.name.length, id).toBeGreaterThan(0);
      for (const s of SEASONS) {
        expect(baselineOf(c, s).wet, `${id} season ${s}`).toBeGreaterThanOrEqual(0);
        expect(baselineOf(c, s).wet).toBeLessThanOrEqual(1);
        expect(baselineOf(c, s).settled).toBeGreaterThanOrEqual(0);
        expect(baselineOf(c, s).settled).toBeLessThanOrEqual(1);
        expect(windOf(c, s).knots, `${id} season ${s}`).toBeGreaterThan(0);
      }
      expect(c.storms.seasons).toHaveLength(4);
      expect(c.ground.palette.length, id).toBeGreaterThan(1);
    }
  });

  it("gives every climate a season it does not spawn storms in", () => {
    // A storm regime that fires all year is a weather system with no calendar,
    // and §7.1's whole point is that the regime gives the year a shape.
    for (const id of CLIMATE_IDS) {
      expect(CLIMATES[id].storms.seasons.includes(false), id).toBe(true);
      expect(CLIMATES[id].storms.seasons.includes(true), id).toBe(true);
    }
  });

  it("lets no climate promise ground it forbids, and none forbid the ground its people eat off", () => {
    // [HC-28] one way: the palette is the gate, so a dry zone can never yield a
    // cane flat because a cane flat is not in its palette.
    // [HC-22] the other way: a place was settled because something there would
    // feed it, so the ground the generator falls back on must be on the palette
    // AND must actually bear victuals.
    for (const id of CLIMATE_IDS) {
      const g = CLIMATES[id].ground;
      expect(g.palette, id).toContain(g.victuals);
      expect(TERRAIN_BEARS[g.victuals], id).toContain("food");
      for (const t of g.palette) expect(TERRAIN_BEARS[t], `${id}/${t}`).toBeDefined();
    }
  });

  it("keeps its type honest against its own table, so a new climate cannot be half-added", () => {
    // [HC-91]: the table is the source of truth and the type comes from it.
    expect(CLIMATE_IDS.length).toBe(Object.keys(CLIMATES).length);
    expect(CLIMATE_IDS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("a zone is a place on the map, not a label", () => {
  it("divides the sea into a handful of zones — four to eight, not fifty", () => {
    // §7.1: for fifty places on this sea, expect four to eight. The reason is
    // [HC-23]: a zone is not a region, and "each cane flat gets its own climate"
    // is exactly the reading the word was changed to avoid.
    for (const seed of [1660, 7, 99991, 40]) {
      const zones = makeZones(seed);
      expect(zones.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(zones.length, `seed ${seed}`).toBeLessThanOrEqual(8);
    }
  });

  it("puts every position in exactly one zone, and in the nearest one", () => {
    for (let i = 0; i < 200; i++) {
      const x = ((i % 20) / 19) * WORLD_BOX.widthNm;
      const y = (Math.floor(i / 20) / 9) * WORLD_BOX.heightNm;
      const z = zoneAt(ZONES, x, y);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThan(ZONES.length);
      const mine = (ZONES[z].x - x) * (ZONES[z].x - x) + (ZONES[z].y - y) * (ZONES[z].y - y);
      for (const other of ZONES) {
        const d2 = (other.x - x) * (other.x - x) + (other.y - y) * (other.y - y);
        expect(mine).toBeLessThanOrEqual(d2);
      }
    }
  });

  it("never changes, however long the world runs", () => {
    // [HC-27] climate is immutable. The proof is structural rather than
    // behavioural: nothing that reads a zone takes a day at all, so there is no
    // argument a century could arrive through.
    const young = makeWorld(SEED);
    young.zones = makeZones(SEED);
    const old = makeWorld(SEED);
    old.zones = makeZones(SEED);
    old.day = 360 * 200;
    for (let i = 0; i < 60; i++) {
      const x = (i / 59) * WORLD_BOX.widthNm;
      const y = ((i * 7) % 60) / 59 * WORLD_BOX.heightNm;
      expect(zoneAt(old.zones, x, y)).toBe(zoneAt(young.zones, x, y));
      expect(climateOf(old.zones, zoneAt(old.zones, x, y)).name).toBe(
        climateOf(young.zones, zoneAt(young.zones, x, y)).name,
      );
    }
  });

  it("gives the same seed the same zones, seat for seat", () => {
    expect(makeZones(SEED)).toEqual(ZONES);
    expect(makeZones(SEED + 1)).not.toEqual(ZONES);
  });
});

describe("exposure is a property of the map", () => {
  it("runs storms with the wind of the seasons that spawn them, not against it", () => {
    // [HC-29]: storm tracks follow the prevailing wind, not the player.
    for (const id of CLIMATE_IDS) {
      const c = CLIMATES[id];
      const track = stormTrack(c);
      expect(track.dx * track.dx + track.dy * track.dy, id).toBeCloseTo(1, 9);
      for (const s of SEASONS) {
        if (!c.storms.seasons[s]) continue;
        const w = windOf(c, s);
        // The same general direction, never the opposite one.
        expect(track.dx * w.dx + track.dy * w.dy, `${id} season ${s}`).toBeGreaterThan(0);
      }
    }
  });

  it("owes a windward coast more weather than a lee one in the very same zone", () => {
    // [HC-29]'s whole reason for existing: "where a place sits is a decision
    // with consequences." Two coasts, one climate, opposite bearings.
    for (const id of CLIMATE_IDS) {
      const c = CLIMATES[id];
      const t = stormTrack(c);
      const windward = exposureOf(c, -t.dx, -t.dy); // looking into the weather
      const lee = exposureOf(c, t.dx, t.dy); // its own island between it and the weather
      expect(windward, id).toBeGreaterThan(lee);
    }
  });

  it("owes a quiet zone's windward coast less than a stormy one's", () => {
    const stormy = CLIMATES.stormRoad;
    const quiet = CLIMATES.leeward;
    const facing = (c: Climate) => {
      const t = stormTrack(c);
      return exposureOf(c, -t.dx, -t.dy);
    };
    expect(facing(stormy)).toBeGreaterThan(facing(quiet));
  });

  it("is read off two immutable facts and nothing else, so it needs no storage", () => {
    // [P-17]: a pure function of (bearing, climate) is derived, never stored.
    const c = CLIMATES.windward;
    const once = exposureOf(c, 0.6, -0.8);
    for (let i = 0; i < 20; i++) expect(exposureOf(c, 0.6, -0.8)).toBe(once);
  });
});
