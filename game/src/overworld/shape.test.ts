// The world's shape — what must be true of a sea nobody drew by hand.
//
// These are claims about the FIELD, not about the tables that feed it. Nothing
// below pins a lobe count, a sea level or a crinkle amplitude: those are dials
// and they are meant to move (testing.md rule 2). What is pinned is that the
// field is a pure function, that it makes a world rather than a spatter, that it
// has detail at both the scales the game reads it at, and that it ends in ocean.

import { describe, it, expect } from "vitest";
import {
  DAY_RUN_NM, RAYS, WORLD_BOX, coastAlong, daysToSail, distanceNm,
  heightAt, isLandAt, makeShape, seawardAt, shelterAt,
} from "./shape";

const SEED = 1660;
const SHAPE = makeShape(SEED);

// A coarse sweep of the whole box, used by several claims.
const sweep = (shape = SHAPE, cols = 120, rows = 64) => {
  const pts: { x: number; y: number; land: boolean }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * WORLD_BOX.widthNm;
      const y = ((r + 0.5) / rows) * WORLD_BOX.heightNm;
      pts.push({ x, y, land: isLandAt(shape, x, y) });
    }
  }
  return pts;
};

describe("the sea a seed draws", () => {
  it("answers the same at every point on it, however often it is asked", () => {
    // [HC-11] starts here: if the field is not a pure function, nothing above it
    // can be reproducible.
    const again = makeShape(SEED);
    for (const p of sweep(SHAPE, 40, 24)) {
      expect(heightAt(again, p.x, p.y)).toBe(heightAt(SHAPE, p.x, p.y));
    }
  });

  it("draws a different sea from a different number, and only from that", () => {
    const other = makeShape(SEED + 1);
    const here = sweep(SHAPE, 40, 24).map((p) => p.land);
    const there = sweep(other, 40, 24).map((p) => p.land);
    expect(there).not.toEqual(here);
  });

  it("makes a sea with land in it, rather than a spatter or a continent", () => {
    // The composition claim, and the only one worth making about proportion: a
    // world that is nearly all water has nowhere to sail to, and one that is
    // nearly all land is not a sea.
    for (const seed of [1660, 7, 99991, 40, 12345]) {
      const pts = sweep(makeShape(seed));
      const share = pts.filter((p) => p.land).length / pts.length;
      expect(share, `seed ${seed}`).toBeGreaterThan(0.1);
      expect(share, `seed ${seed}`).toBeLessThan(0.5);
    }
  });

  it("ends in ocean, so nothing runs off the edge of the chart", () => {
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      const x = f * WORLD_BOX.widthNm;
      const y = f * WORLD_BOX.heightNm;
      expect(isLandAt(SHAPE, x, -5)).toBe(false);
      expect(isLandAt(SHAPE, x, WORLD_BOX.heightNm + 5)).toBe(false);
      expect(isLandAt(SHAPE, -5, y)).toBe(false);
      expect(isLandAt(SHAPE, WORLD_BOX.widthNm + 5, y)).toBe(false);
    }
  });

  it("has a coast at the scale a town works at, and not only at the scale a chart shows", () => {
    // THE CLAIM THAT MAKES [HC-19] WORTH ANYTHING. A town's own ground is cut
    // from this same field at two nautical miles a hex. If the coastline were
    // smooth below fifty miles, every town's shore would be a straight line and
    // the cut would be a fiction dressed as geography. So: walking a transect
    // and counting waterlines must find MORE of them the finer you look.
    const crossings = (step: number) => {
      let n = 0;
      for (let line = 1; line <= 24; line++) {
        const y = (line / 25) * WORLD_BOX.heightNm;
        let was = isLandAt(SHAPE, 0, y);
        for (let x = step; x <= WORLD_BOX.widthNm; x += step) {
          const now = isLandAt(SHAPE, x, y);
          if (now !== was) n++;
          was = now;
        }
      }
      return n;
    };
    // Counted over the whole sea rather than one transect: any single line may
    // cross a straight stretch, and the claim is about the coastline, not about
    // a line of latitude.
    expect(crossings(2)).toBeGreaterThan(crossings(30) * 1.2);
  });
});

describe("finding a coast", () => {
  it("lands on the waterline itself, not near it", () => {
    let found = 0;
    for (let i = 0; i < RAYS.length; i++) {
      const hit = coastAlong(SHAPE, WORLD_BOX.widthNm * 0.5, WORLD_BOX.heightNm * 0.5, RAYS[i].dx, RAYS[i].dy, 700);
      if (!hit) continue;
      found++;
      // Within a fifth of a nautical mile the field changes sign, which is what
      // "this is the coast" means.
      const h = heightAt(SHAPE, hit.x, hit.y);
      expect(Math.abs(h)).toBeLessThan(0.05);
    }
    expect(found).toBeGreaterThan(0);
  });

  it("says so honestly when a leg never reaches one", () => {
    // Straight up out of the top of the world: there is nothing there.
    expect(coastAlong(SHAPE, WORLD_BOX.widthNm * 0.5, 20, 0, -1, 200)).toBeNull();
  });
});

describe("reading a coast", () => {
  const coast = () => {
    // A real coast point, found the way the siting code finds one.
    for (let i = 0; i < RAYS.length; i++) {
      const hit = coastAlong(SHAPE, WORLD_BOX.widthNm * 0.45, WORLD_BOX.heightNm * 0.5, RAYS[i].dx, RAYS[i].dy, 700);
      if (hit) return hit;
    }
    throw new Error("no coast in this world, which would be a different bug");
  };

  it("points seaward at the sea, and inland at the land", () => {
    // [HC-73]'s foundation: the world holds the TRUE coastal bearing, so it had
    // better be true. Ten miles the way it points is water; ten miles the other
    // way is not.
    const p = coast();
    const s = seawardAt(SHAPE, p.x, p.y);
    expect(isLandAt(SHAPE, p.x + s.dx * 10, p.y + s.dy * 10)).toBe(false);
    expect(isLandAt(SHAPE, p.x - s.dx * 10, p.y - s.dy * 10)).toBe(true);
  });

  it("gives a bearing of unit length, so a rotation built from it is a rotation", () => {
    // The cut builds its world-to-local rotation straight out of these two
    // numbers. If they are not a unit vector the matrix is not orthogonal and a
    // town's ground comes out sheared.
    const p = coast();
    const s = seawardAt(SHAPE, p.x, p.y);
    expect(s.dx * s.dx + s.dy * s.dy).toBeCloseTo(1, 12);
  });

  it("reads shelter as land around the water, so open ocean is no anchorage at all", () => {
    expect(shelterAt(SHAPE, WORLD_BOX.widthNm * 0.5, WORLD_BOX.heightNm * 0.5)).toBe(0);
    const p = coast();
    // ...and a coast is at least somewhere, even if it is not a bay.
    expect(shelterAt(SHAPE, p.x, p.y)).toBeGreaterThanOrEqual(0);
    expect(shelterAt(SHAPE, p.x, p.y)).toBeLessThanOrEqual(1);
  });
});

describe("distance, which is the price of everything", () => {
  it("measures in nautical miles and converts to days at one made-good", () => {
    expect(distanceNm(0, 0, 3, 4)).toBe(5);
    expect(daysToSail(DAY_RUN_NM)).toBe(1);
    expect(daysToSail(DAY_RUN_NM * 4)).toBe(4);
  });

  it("holds a sea that a typical passage crosses in days rather than weeks", () => {
    // §6's scale, said as a relationship: the whole world is a passage of a few
    // days, not a season.
    const across = distanceNm(0, 0, WORLD_BOX.widthNm, WORLD_BOX.heightNm);
    expect(daysToSail(across)).toBeGreaterThan(4);
    expect(daysToSail(across)).toBeLessThan(21);
  });
});
