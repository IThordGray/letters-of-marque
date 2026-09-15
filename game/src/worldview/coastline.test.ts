// The baked coastline — what must be true of a picture taken of a field.
//
// The bake is a LOSSY copy of `heightAt`, and every claim here is some form of
// one question: does the copy still say what the original says? So the oracles
// below are written out from the field itself rather than read back off the
// bake — a ray cast written here, a land area sampled here, a perpendicular
// distance computed here. An assertion that asks the bake what the answer should
// be could not catch a term added to it (testing.md, "write the oracle out
// independently").
//
// Nothing here pins a resolution, a tolerance or a vertex count: those are dials
// and they are meant to move. What is pinned is that the same seed draws the same
// coast, that the coast agrees with the field about where the land is, that an
// ambiguous cell is resolved by the world rather than by the order it was
// visited, and that nothing degenerate comes out.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WORLD_BOX, heightAt, isLandAt, makeShape, type WorldShape } from "../overworld/shape";
import { CHART, bakeCoast, type Coast, type CoastLine } from "./coastline";

const SEED = 1660;
const SHAPE = makeShape(SEED);

// ---- Oracles, written out --------------------------------------------------

// Even-odd ray casting along +x. Robust with vertices exactly on the ray because
// the `>` comparison is half-open, and no segment of a marching-squares contour
// can be collinear with a lattice row: a segment always joins two DIFFERENT
// edges of its cell, and only the north edge sits on the row.
function insideOutline(c: Coast, px: number, py: number): boolean {
  let crossings = 0;
  for (const l of c.lines) {
    const n = l.pts.length / 2;
    const last = l.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ay = l.pts[i * 2 + 1];
      const by = l.pts[j * 2 + 1];
      if ((ay > py) !== (by > py)) {
        const ax = l.pts[i * 2];
        const bx = l.pts[j * 2];
        if (ax + ((py - ay) / (by - ay)) * (bx - ax) > px) crossings++;
      }
    }
  }
  return (crossings & 1) === 1;
}

// The shoelace. Positive means the loop winds the way the bake claims an island
// winds; a lake inside an island winds the other way and subtracts itself.
function signedArea(pts: Float64Array): number {
  const n = pts.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
  }
  return a * 0.5;
}

// How much land the field itself says there is, counted by asking it.
function sampledLandArea(shape: WorldShape, n: number): number {
  let land = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (isLandAt(shape, ((i + 0.5) / n) * shape.widthNm, ((j + 0.5) / n) * shape.heightNm)) land++;
    }
  }
  return (land / (n * n)) * shape.widthNm * shape.heightNm;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
}

function distToOutline(c: Coast, px: number, py: number): number {
  let best = Infinity;
  for (const l of c.lines) {
    const n = l.pts.length / 2;
    const last = l.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const d = distToSegment(px, py, l.pts[i * 2], l.pts[i * 2 + 1], l.pts[j * 2], l.pts[j * 2 + 1]);
      if (d < best) best = d;
    }
  }
  return best;
}

function segmentsOf(c: Coast): number[] {
  const out: number[] = [];
  for (const l of c.lines) {
    const n = l.pts.length / 2;
    const last = l.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      out.push(l.pts[i * 2], l.pts[i * 2 + 1], l.pts[j * 2], l.pts[j * 2 + 1]);
    }
  }
  return out;
}

// Proper crossing only: shared endpoints and touching are not crossings, two
// segments passing through each other are.
function crossingPairs(seg: number[]): number {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  let n = 0;
  for (let a = 0; a < seg.length; a += 4) {
    for (let b = a + 4; b < seg.length; b += 4) {
      const o1 = side(seg[a], seg[a + 1], seg[a + 2], seg[a + 3], seg[b], seg[b + 1]);
      const o2 = side(seg[a], seg[a + 1], seg[a + 2], seg[a + 3], seg[b + 2], seg[b + 3]);
      const o3 = side(seg[b], seg[b + 1], seg[b + 2], seg[b + 3], seg[a], seg[a + 1]);
      const o4 = side(seg[b], seg[b + 1], seg[b + 2], seg[b + 3], seg[a + 2], seg[a + 3]);
      if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) n++;
    }
  }
  return n;
}

// ---- A world built by hand, so a claim can be made about one cell -----------
//
// Fixtures go through the struct, never through `makeShape` — the generator's
// tables are content and they are meant to move (testing.md's fixture rule). The
// crinkle is switched off so the only thing in the field is the lobes, and the
// margin with it so the box has a hard edge that land can reach.
function handShape(lobes: WorldShape["lobes"], widthNm = 100, heightNm = 100): WorldShape {
  return {
    widthNm,
    heightNm,
    marginNm: 0,
    lobes,
    coastField: 0,
    crinkle: 0,
    wave: 100,
    octaves: 1,
    fineField: 0,
    fineCrinkle: 0,
    fineWave: 100,
    fineOctaves: 1,
    seaLevel: 0.5,
  };
}

// Two round islands on the diagonal of the cell that spans (40,40)-(50,50), each
// reaching one corner of it and neither reaching the other two. That cell has
// land on one diagonal and water on the other: it is a SADDLE, and marching
// squares cannot tell from its corners whether the two islands touch.
const SADDLE_STEP = 10;
const TWO_ISLANDS = handShape([
  { x: 40, y: 40, rx: 6, ry: 6, lift: 1.5 },
  { x: 50, y: 50, rx: 6, ry: 6, lift: 1.5 },
]);
// ...and the same two islands with a bar of land between them. The bar is small
// enough to touch no edge of the cell, so EVERY CROSSING IS IDENTICAL in the two
// worlds and the only thing that differs is what is true in the middle.
const ISTHMUS = handShape([
  { x: 40, y: 40, rx: 6, ry: 6, lift: 1.5 },
  { x: 50, y: 50, rx: 6, ry: 6, lift: 1.5 },
  { x: 45, y: 45, rx: 4, ry: 4, lift: 1.5 },
]);

// Two islands astride opposite edges of the box, so each coast runs off the
// chart and neither can close. Baked at a step that does NOT divide the box —
// eleven columns across a hundred miles — because that is the case where a
// lattice built by accumulation lands a hair PAST the far edge (100.00000000000001)
// and one built from the fraction lands exactly on it.
const OFF_THE_CHART = handShape([
  { x: 0, y: 30, rx: 20, ry: 20, lift: 1.5 },
  { x: 100, y: 70, rx: 20, ry: 20, lift: 1.5 },
]);
const OFF_STEP = 9;

// One round island whose waterline passes exactly through four lattice points.
// A lobe of lift 1 at (72,72) with a 16 nm radius puts the field at EXACTLY zero
// at (64,64) and its three mirrors, because (8/16)^2 + (8/16)^2 is exactly a half
// in binary. A crossing pinned to a corner is found twice — once from the edge
// on each side of it — and the two vertices are identical.
const ON_THE_CORNER = handShape([{ x: 72, y: 72, rx: 16, ry: 16, lift: 1 }], 128, 128);
const CORNER_STEP = 8;

// ---- The claims ------------------------------------------------------------

describe("the coast a seed bakes", () => {
  it("draws the same coastline from the same seed, vertex for vertex", () => {
    // [HC-11] reaches the chart too: a world that draws differently on a second
    // machine is a world whose map lies about it. Deep equality, not a count.
    const a = bakeCoast(makeShape(SEED), 6);
    const b = bakeCoast(makeShape(SEED), 6);
    expect(b).toEqual(a);
  });

  it("draws a different coastline from a different number, and only from that", () => {
    const a = bakeCoast(makeShape(SEED), 6);
    const b = bakeCoast(makeShape(SEED + 1), 6);
    expect(b).not.toEqual(a);
  });

  it("finds more islands the finer it looks, because the field has them", () => {
    // The resolution trade, said as a direction rather than as a number: a coarse
    // bake loses cays, and if it did not, the finer bake would be paying for
    // nothing.
    const coarse = bakeCoast(SHAPE, 12);
    const fine = bakeCoast(SHAPE, 3);
    expect(fine.lines.length).toBeGreaterThan(coarse.lines.length);
  });
});

describe("the outline agrees with the field it was cut from", () => {
  it("agrees about the land at every point it looked at", () => {
    // THE CLAIM THE WHOLE MODULE STANDS ON, and the oracle is written out above:
    // cast a ray, count crossings, and compare the parity with what the field
    // says. Every lattice point, no tolerance, no sampling — the contour was
    // built from the signs at exactly these points, so anything but exact
    // agreement is a bug in the marching, not a limit of the picture.
    const c = bakeCoast(SHAPE, 8, 0);
    let disagree = 0;
    for (let j = 0; j <= c.rows; j++) {
      for (let i = 0; i <= c.cols; i++) {
        const x = (i / c.cols) * WORLD_BOX.widthNm;
        const y = (j / c.rows) * WORLD_BOX.heightNm;
        if (insideOutline(c, x, y) !== isLandAt(SHAPE, x, y)) disagree++;
      }
    }
    expect(disagree).toBe(0);
  });

  it("puts every vertex on the waterline rather than near it", () => {
    // A vertex is a linear guess at where a curved field crosses zero, so it is
    // not exactly zero — the claim has to be a relationship. The scale it is
    // measured against is the field's OWN median depth over the sea, sampled
    // here; a vertex stands in water a small fraction as deep as that.
    const c = bakeCoast(SHAPE, 4, 0);
    const depths: number[] = [];
    for (let j = 0; j < 90; j++) {
      for (let i = 0; i < 90; i++) {
        depths.push(Math.abs(heightAt(SHAPE, ((i + 0.5) / 90) * WORLD_BOX.widthNm, ((j + 0.5) / 90) * WORLD_BOX.heightNm)));
      }
    }
    depths.sort((a, b) => a - b);
    const median = depths[Math.floor(depths.length / 2)];

    let worst = 0;
    for (const l of c.lines) {
      for (let i = 0; i < l.pts.length; i += 2) {
        const h = Math.abs(heightAt(SHAPE, l.pts[i], l.pts[i + 1]));
        if (h > worst) worst = h;
      }
    }
    // Measured at 2 nm: worst 0.054 against a median of 0.36, so under a fifth.
    expect(worst).toBeLessThan(median * 0.25);
  });

  it("encloses the world's land, so its lakes are holes and not islands", () => {
    // The orientation claim and the nesting claim in one number. Summed signed
    // areas only come out equal to the land if every island winds one way, every
    // inland water the other, and every loop is where the field put it. Sampled
    // independently, at a resolution that has nothing to do with the bake's.
    const c = bakeCoast(SHAPE);
    let enclosed = 0;
    for (const l of c.lines) if (l.closed) enclosed += signedArea(l.pts);
    const sampled = sampledLandArea(SHAPE, 500);
    expect(enclosed).toBeGreaterThan(sampled * 0.99);
    expect(enclosed).toBeLessThan(sampled * 1.01);
  });

  it("still agrees about the land after the vertices are thinned", () => {
    // Simplification may move the coast, so agreement here cannot be exact — but
    // every disagreement must be a point the coast moved ACROSS, which means it
    // lies within the tolerance of the line. Anything further away is not a
    // rounding, it is a hole.
    const c = bakeCoast(SHAPE, 8, CHART.simplifyNm);
    const strayed: number[] = [];
    let tested = 0;
    for (let j = 0; j <= c.rows; j++) {
      for (let i = 0; i <= c.cols; i++) {
        const x = (i / c.cols) * WORLD_BOX.widthNm;
        const y = (j / c.rows) * WORLD_BOX.heightNm;
        tested++;
        if (insideOutline(c, x, y) !== isLandAt(SHAPE, x, y)) strayed.push(x, y);
      }
    }
    expect(strayed.length / 2).toBeLessThan(tested * 0.001);
    for (let k = 0; k < strayed.length; k += 2) {
      expect(distToOutline(c, strayed[k], strayed[k + 1])).toBeLessThanOrEqual(CHART.simplifyNm);
    }
  });

  it("never moves the coast further than the tolerance it was given", () => {
    // Douglas-Peucker's whole guarantee, and the reason it was chosen over a
    // vertex budget: what is bounded is the DISTANCE, in nautical miles.
    const raw = bakeCoast(SHAPE, 4, 0);
    const thin = bakeCoast(SHAPE, 4, CHART.simplifyNm);
    let worst = 0;
    for (let li = 0; li < raw.lines.length; li++) {
      const r = raw.lines[li];
      for (let i = 0; i < r.pts.length; i += 2) {
        const d = distToOutline(thin, r.pts[i], r.pts[i + 1]);
        if (d > worst) worst = d;
      }
    }
    expect(worst).toBeLessThanOrEqual(CHART.simplifyNm);
    // ...and it is worth having: most of the vertices say nothing.
    expect(thin.vertices).toBeLessThan(raw.vertices * 0.6);
  });
});

describe("an ambiguous cell is decided by the world, not by the order it was walked", () => {
  it("builds exactly one cell the corners cannot decide", () => {
    // The precondition. If this fails the two claims below are decorations,
    // because the fixture would no longer contain the case they are about.
    const c = bakeCoast(TWO_ISLANDS, SADDLE_STEP, 0);
    expect(c.samples).toBe((c.cols + 1) * (c.rows + 1) + 1);
    expect(bakeCoast(ISTHMUS, SADDLE_STEP, 0).samples).toBe(c.samples);
  });

  it("keeps two islands apart when the middle of the cell is water", () => {
    const c = bakeCoast(TWO_ISLANDS, SADDLE_STEP, 0);
    expect(isLandAt(TWO_ISLANDS, 45, 45)).toBe(false);
    expect(c.lines.length).toBe(2);
    for (const l of c.lines) expect(l.closed).toBe(true);
  });

  it("joins them into one shore when the middle of the cell is land", () => {
    // Same two islands, same cell, same crossings on all four edges — the only
    // difference in the world is a bar of land the lattice cannot see. The
    // contour follows the field anyway, because the field was asked.
    const c = bakeCoast(ISTHMUS, SADDLE_STEP, 0);
    expect(isLandAt(ISTHMUS, 45, 45)).toBe(true);
    expect(c.lines.length).toBe(1);
    expect(c.lines[0].closed).toBe(true);
  });

  it("leaves a coast that never crosses itself, whichever way it decides", () => {
    // The failure an inconsistent saddle produces is not a wrong island count, it
    // is a shore drawn through itself. Checked by brute force on a whole world
    // rather than argued.
    expect(crossingPairs(segmentsOf(bakeCoast(TWO_ISLANDS, SADDLE_STEP, 0)))).toBe(0);
    expect(crossingPairs(segmentsOf(bakeCoast(ISTHMUS, SADDLE_STEP, 0)))).toBe(0);
    for (const seed of [1660, 12345]) {
      expect(crossingPairs(segmentsOf(bakeCoast(makeShape(seed), 6, 0)))).toBe(0);
      expect(crossingPairs(segmentsOf(bakeCoast(makeShape(seed), 6, CHART.simplifyNm)))).toBe(0);
    }
  });
});

describe("what a baked line may not contain", () => {
  const every = (c: Coast, f: (l: CoastLine) => void) => c.lines.forEach(f);

  const noRepeats = (c: Coast) =>
    c.lines.forEach((l) => {
      const n = l.pts.length / 2;
      const last = l.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const j = (i + 1) % n;
        expect(l.pts[i * 2] !== l.pts[j * 2] || l.pts[i * 2 + 1] !== l.pts[j * 2 + 1]).toBe(true);
      }
    });

  it("carries no segment of no length, and no vertex written twice running", () => {
    // A repeated vertex is a stroke that draws nothing and a normal that is not a
    // direction. For a closed line the pair that wraps counts too, which is why
    // a closed line does not repeat its first vertex at the end.
    for (const eps of [0, CHART.simplifyNm]) noRepeats(bakeCoast(SHAPE, 4, eps));
  });

  it("writes a crossing pinned to a lattice corner once, not once per edge", () => {
    // The degenerate case the real sea never produces and a hand-built world can.
    // Where the field is EXACTLY zero at a lattice point, the two edges meeting
    // there both put their crossing on top of it, and the contour would carry the
    // same vertex twice running. Enumerated rather than hoped for — a fractal
    // field in double precision will not hit zero on its own in a century of
    // seeds, so if this case is not constructed it is not covered.
    expect(heightAt(ON_THE_CORNER, 64, 64)).toBe(0);
    expect(isLandAt(ON_THE_CORNER, 64, 64)).toBe(false);
    const c = bakeCoast(ON_THE_CORNER, CORNER_STEP, 0);
    expect(c.lines.length).toBe(1);
    noRepeats(c);
  });

  it("gives a closed loop three corners at least, and an open line two points", () => {
    for (const eps of [0, CHART.simplifyNm]) {
      const c = bakeCoast(SHAPE, 4, eps);
      every(c, (l) => {
        expect(l.pts.length % 2).toBe(0);
        expect(l.pts.length / 2).toBeGreaterThanOrEqual(l.closed ? 3 : 2);
      });
    }
  });

  it("closes every shore, because this world ends in ocean before the chart does", () => {
    // What "should have closed" means here. `shape.ts` tapers every lobe to
    // nothing across an 80 nm margin, so the whole rim of the box is water and no
    // coast can reach it: a line left open in THIS world would be a chain the
    // walk failed to follow round, not a coast running off the edge.
    for (const step of [8, 4, 2]) {
      const c = bakeCoast(SHAPE, step);
      expect(c.lines.filter((l) => !l.closed)).toEqual([]);
    }
  });

  it("leaves a coast that does run off the chart open, and ends it on the edge", () => {
    // ...and when a world DOES carry land to its boundary, the line cannot close,
    // so it must say so and it must stop exactly on the edge — not near it. A
    // renderer joins an open line's ends to the frame; a fraction of a mile short
    // would leave a gap in the fill.
    const c = bakeCoast(OFF_THE_CHART, OFF_STEP, 0);
    const open = c.lines.filter((l) => !l.closed);
    expect(open.length).toBe(2);
    expect(c.lines.length).toBe(2);
    // Exactly on the edge, to the last bit — and the far edge is the one that
    // catches a lattice whose columns were accumulated instead of taken from the
    // fraction, because eleven steps of a hundred-mile box overshoot by an ULP.
    const onEdge = (x: number, y: number) =>
      x === 0 || y === 0 || x === OFF_THE_CHART.widthNm || y === OFF_THE_CHART.heightNm;
    expect(open.some((l) => l.pts[0] === 0)).toBe(true);
    expect(open.some((l) => l.pts[0] === OFF_THE_CHART.widthNm)).toBe(true);
    for (const l of open) {
      const n = l.pts.length / 2;
      expect(onEdge(l.pts[0], l.pts[1])).toBe(true);
      expect(onEdge(l.pts[(n - 1) * 2], l.pts[(n - 1) * 2 + 1])).toBe(true);
      // ...and nothing in the middle of it is on the edge, or it should have
      // been two lines.
      for (let i = 1; i < n - 1; i++) expect(onEdge(l.pts[i * 2], l.pts[i * 2 + 1])).toBe(false);
    }
  });
});

describe("what the bake costs, and how often it is paid", () => {
  it("asks the field once for every lattice point, and again only where a cell is ambiguous", () => {
    // [P-41]: an assertion states a fact where a timing states a noisy number.
    // The cost model IS the claim — one evaluation per sample, plus one per
    // saddle — and the saddles are counted here by marching the same lattice
    // independently rather than by believing the bake's own tally.
    const step = 6;
    const c = bakeCoast(SHAPE, step, 0);
    const grid = (c.cols + 1) * (c.rows + 1);

    const h: number[] = [];
    for (let j = 0; j <= c.rows; j++) {
      for (let i = 0; i <= c.cols; i++) {
        h.push(heightAt(SHAPE, (i / c.cols) * WORLD_BOX.widthNm, (j / c.rows) * WORLD_BOX.heightNm));
      }
    }
    let saddles = 0;
    const nx = c.cols + 1;
    for (let j = 0; j < c.rows; j++) {
      for (let i = 0; i < c.cols; i++) {
        const code =
          (h[j * nx + i] > 0 ? 1 : 0) | (h[j * nx + i + 1] > 0 ? 2 : 0) |
          (h[(j + 1) * nx + i + 1] > 0 ? 4 : 0) | (h[(j + 1) * nx + i] > 0 ? 8 : 0);
        if (code === 5 || code === 10) saddles++;
      }
    }
    expect(c.samples).toBe(grid + saddles);
    // MEASURED: nine saddles in the whole sea at 2 nm. The ambiguity that could
    // have cost a second pass over the field costs a rounding error instead.
    expect(saddles).toBeLessThan(grid * 0.01);
  });

  it("pays four times as much when the resolution doubles, and nothing worse", () => {
    // [P-2]: the cost is the lattice, and the lattice is quadratic. Nothing in
    // the bake is quadratic in the coastline, which is the cost that would
    // actually hurt.
    const coarse = bakeCoast(SHAPE, 8, 0);
    const fine = bakeCoast(SHAPE, 4, 0);
    const ratio = fine.samples / coarse.samples;
    expect(ratio).toBeGreaterThan(3.9);
    expect(ratio).toBeLessThan(4.1);
  });

  it("hands over geometry that holds no field, so a frame asks the world nothing", () => {
    // The whole point of a bake ([P-2]: complexity x TICK RATE). If the shape
    // travelled out on the result, a renderer could read it sixty times a second
    // and the 300,000 evaluations would be back — as a frame cost this time.
    const c = bakeCoast(SHAPE, 12);
    const seen = new Set<unknown>();
    const scan = (v: unknown): void => {
      if (v === null || typeof v !== "object" || seen.has(v)) return;
      seen.add(v);
      expect(Object.prototype.hasOwnProperty.call(v, "lobes")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(v, "seaLevel")).toBe(false);
      for (const k of Object.keys(v)) scan((v as Record<string, unknown>)[k]);
    };
    scan(c);
    expect(c.vertices).toBeGreaterThan(0);
  });
});

// ---- The boundary the directory exists to draw -----------------------------
//
// `town/guardrails.test.ts` discovers and guards every file in `src/overworld`,
// and one of the things it forbids there is `performance.now` — [P-11], the
// simulation reads no clock. A render loop must read one. Those two facts can
// only both stay absolute if presentation code lives OUTSIDE the directories
// that scan says are simulation, which is why `worldview/` is a new directory
// and not a file under `overworld/`. It is outside that scan by construction:
// the scan's SIM_DIRS is ["overworld"] and its town roster is a list of
// filenames, so neither can reach here.
describe("the view may look at the world, and the world may not look back", () => {
  const SRC = join(process.cwd(), "src");
  const isSource = (f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts");
  const code = (rel: string): string =>
    readFileSync(join(SRC, rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

  const view = readdirSync(join(SRC, "worldview")).filter(isSource).map((f) => `worldview/${f}`);

  it("has something in it to guard, discovered rather than listed", () => {
    expect(view.length).toBeGreaterThan(0);
  });

  it("is a place the simulation cannot reach, so looking at the world changes nothing in it", () => {
    // [HC-26]/[HC-12] as a structural fact rather than as a habit: if no
    // simulation file can import the chart, no simulation decision can depend on
    // what has been drawn. [P-17b] — enforce a "must not read X" with code that
    // is not GIVEN X.
    const sim = [
      ...readdirSync(join(SRC, "overworld")).filter(isSource).map((f) => `overworld/${f}`),
      ...readdirSync(join(SRC, "town")).filter(isSource).map((f) => `town/${f}`),
    ];
    const readers = sim.filter((f) => /\bworldview\b/.test(code(f)));
    expect(readers).toEqual([]);
  });

  it("bakes with arithmetic that is the same on every machine", () => {
    // [P-5]. The chart is derived from the seed, so an implementation-approximated
    // call here is a world that draws differently on a different machine — the
    // same failure the simulation is guarded against, one layer up.
    //
    // `performance.now` is deliberately NOT on this list. The view may read a
    // clock; that permission is the entire reason this directory exists.
    const approximated = [
      "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
      "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
      "exp", "expm1", "log", "log1p", "log2", "log10",
      "cbrt", "hypot", "pow", "random",
    ];
    for (const rel of view) {
      const src = code(rel);
      const found = approximated.filter((fn) => new RegExp(`\\bMath\\.${fn}\\b`).test(src));
      if (/[^*/\s][ \t]*\*\*[ \t]*[^*/]/.test(src)) found.push("** operator");
      expect(found, rel).toEqual([]);
    }
  });
});
