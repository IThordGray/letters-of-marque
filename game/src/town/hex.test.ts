// Behaviour tests for the hex flower's geometry (KAN-79).
// Pure maths, so these are the one place exact values are legitimate — a hex
// grid's coordinates are a definition, not a tuning dial.

import { describe, it, expect } from "vitest";
import { axialOf, innerRing, outerRing, distance, toPixel, corners, CENTRE, BEARING_ORDER, isSeaward } from "./hex";

describe("the flower", () => {
  it("puts one hex at the centre for the town itself", () => {
    expect(distance(CENTRE, CENTRE)).toBe(0);
  });

  it("rings it with exactly six parcels, one per bearing", () => {
    const ring = innerRing();
    expect(ring.length).toBe(6);
    expect(BEARING_ORDER.length).toBe(6);
    for (const h of ring) expect(distance(h, CENTRE)).toBe(1);
  });

  it("surrounds that with twelve hinterland hexes", () => {
    const outer = outerRing();
    expect(outer.length).toBe(12);
    for (const h of outer) expect(distance(h, CENTRE)).toBe(2);
  });

  it("gives every hex in the flower its own coordinate", () => {
    const all = [CENTRE, ...innerRing(), ...outerRing()];
    expect(new Set(all.map((h) => `${h.q},${h.r}`)).size).toBe(19);
  });
});

describe("bearings are hex directions", () => {
  it("maps each of the six to a distinct neighbour", () => {
    const seen = new Set(BEARING_ORDER.map((b) => `${axialOf(b).q},${axialOf(b).r}`));
    expect(seen.size).toBe(6);
  });

  it("keeps north and south opposite, which is what preserves 'the sea lies south'", () => {
    // Summed rather than deep-equalled: negating an axial 0 gives -0, which
    // toEqual distinguishes from +0 and which means nothing on a hex grid.
    expect(axialOf("N").q + axialOf("S").q).toBe(0);
    expect(axialOf("N").r + axialOf("S").r).toBe(0);
  });

  it("puts north above south on the drawn map", () => {
    expect(toPixel(axialOf("N"), 10).y).toBeLessThan(toPixel(axialOf("S"), 10).y);
  });
});

describe("drawing", () => {
  it("spaces neighbours a hex apart", () => {
    const size = 20;
    for (const b of BEARING_ORDER) {
      const p = toPixel(axialOf(b), size);
      const d = Math.hypot(p.x, p.y);
      expect(d).toBeGreaterThan(size);      // never overlapping the centre
      expect(d).toBeLessThan(size * 2);     // never detached from it
    }
  });

  it("gives a hex six corners around its centre", () => {
    const c = corners({ x: 0, y: 0 }, 10);
    expect(c.length).toBe(6);
    for (const pt of c) expect(Math.hypot(pt.x, pt.y)).toBeCloseTo(10, 6);
  });

  it("calls the southern arc of the hinterland sea", () => {
    const outer = outerRing();
    expect(outer.some(isSeaward)).toBe(true);
    expect(outer.some((h) => !isSeaward(h))).toBe(true);
    // ...and it agrees with which way is down on the drawn map.
    for (const h of outer) if (isSeaward(h)) expect(toPixel(h, 10).y).toBeGreaterThan(0);
  });
});
