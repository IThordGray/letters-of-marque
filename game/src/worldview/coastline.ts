// The world's coastline, baked once into geometry a renderer can stroke.
//
// [P-17]  "Anything that is a pure function of (identity, time, seed) is computed
//         on demand, never stepped and never stored" — and performance.md names
//         this very field as the strongest instance of it in the codebase. So why
//         is this file a bake at all? Because [P-2] judges cost as complexity x
//         TICK RATE, and drawing has a tick rate of sixty a second. `heightAt` is
//         a few dozen ellipses under two fbm stacks; asking it where the coast is
//         costs ~300,000 evaluations over a 1,500 x 800 nm sea at 2 nm. Once, at
//         generation, that is nothing. Sixty times a second it is the whole frame.
//         The field stays the source of truth; this is a PICTURE of it, taken once.
// [HC-14] Store almost nothing — and nothing here is stored. The result is not on
//         the World struct, is never saved, and the simulation cannot read it: it
//         is derived from (seed, shape) and thrown away with the view that made it.
// [HC-26] Ring boundaries live in the simulation, not in the camera. The same rule
//         binds here: looking at the world must not change what is true in it.
//         That is why this module lives in `worldview/` and not in `overworld/` —
//         the view layer may read a wall clock for its render loop, the simulation
//         may not ([P-11]), and keeping them in separate directories is what lets
//         both rules stay absolute instead of growing exceptions.
// [HC-24] No hex grid at world scale. The lattice below is a SAMPLING grid thrown
//         over the field for one pass and discarded; the output is continuous
//         positions in nautical miles, and nothing downstream ever sees a cell.
// [HC-19] Neither the world's extent nor its waterline is invented here. The box
//         is `shape.widthNm` / `shape.heightNm`, and the threshold is the sign of
//         `heightAt`, which is where `shape.seaLevel` already lives — this file
//         holds no sea level of its own, by design.
//
// MARCHING SQUARES, and the reason the ambiguity matters. Each cell of the
// lattice has four corners, each land or sea, so sixteen cases; fourteen of them
// name one or two line segments without argument. The two that do not are the
// SADDLES — two land corners diagonally opposite two sea corners — where the
// contour either pinches through the middle (an isthmus) or does not (two islands
// nearly touching). Resolved by guessing, two neighbouring cells can disagree and
// the coastline crosses itself. Resolved by the average of the four corners it
// agrees with the bilinear interpolant rather than with the world. So it is
// resolved by ASKING THE FIELD AT THE CELL CENTRE — one extra evaluation, in a
// cell that is under a percent of cells, so the whole ambiguity costs under a
// percent of the bake and the contour says what the field says even where the
// lattice is blind.
//
// [P-5]/[P-7] Determinism is not optional in a bake: a world that looks different
// on a different machine is a world whose chart lies. Everything below is
// `+ - * /` and `Math.floor` / `Math.round` / `Math.max` — exactly specified by
// ECMA-262 — and the lattice is walked in one fixed order, so the same seed bakes
// the same vertices bit for bit ([P-9]).

import { heightAt, type WorldShape } from "../overworld/shape";

// ---- The knobs, and what they cost ([HC-90]: data) -------------------------
//
// MEASURED on Node 24 / V8 13.6, this machine, over the whole 1,500 x 800 nm
// sea, to [P-40]: warm-up, seven passes, a different seed each pass so the
// compiler cannot fold the work away, ONE STEP PER PROCESS, minimum reported.
//
//   step        samples     bake    raw verts   thinned   shores
//   8 nm         19,094    16 ms          854       599       15
//   4 nm         75,587    62 ms        1,832     1,029       27
//   3 nm        134,278   107 ms        2,522     1,268       31
//   2 nm        301,158   248 ms        3,838     1,417       35
//   1.5 nm      534,537   454 ms        5,124     1,547       39
//   1 nm      1,202,301   995 ms        7,742     1,575       41
//
// Cost is exactly the lattice: 0.82 microseconds a sample at every resolution,
// which for a field of thirty-odd ellipses under thirty-six hash lookups is
// about what the hardware owes.
//
// 2 nm IS THE PICK, AND THE LAST COLUMN BUT ONE IS WHY. Raw vertices grow the way
// the lattice does — nine times as many from 8 nm to 1 nm — but THINNED vertices
// stop: 1,417 at 2 nm against 1,575 at 1 nm. Four times the bake buys eleven per
// cent more shape, because everything else the finer lattice finds lies within a
// third of a mile of the line that already described it. Below 2 nm the field has
// almost nothing left to say: its fine crinkle is 12 nm over three octaves, so it
// bottoms out on a 3 nm lattice, and 2 nm is the last step that is still sampling
// something rather than interpolating it. Going the other way, 4 nm halves the
// cost and loses eight of the thirty-five shores 2 nm finds. And a quarter of a
// second sits invisibly inside a world generation that already builds fifty towns.
//
// ONE RESOLUTION DOES NOT SERVE EVERY ZOOM, and that is left for later on purpose.
// At full-world zoom on a 1600 px canvas a nautical mile is about a pixel, so 2 nm
// vertices land two pixels apart and the coast reads as a curve. At 8x they are
// seventeen pixels apart and it reads as a polygon. The answer when that day comes
// is a finer bake of the VISIBLE BOX, not a finer bake of the world — which is why
// the resolution is an argument and not a constant. Nothing here is built for it
// yet; guessing at the shape of that API before there is a camera to fit it to
// would be code that had not fought to be there.
export const CHART = {
  stepNm: 2,
  // Douglas-Peucker tolerance. MEASURED at 2 nm: drops 63% of the vertices and
  // moves the coast by at most 0.3499 nm — the bound is the tolerance itself,
  // which is the guarantee the algorithm was chosen for. A fifth of a cell, a
  // third of a pixel at full-world zoom, and 0.006% of the enclosed land area.
  simplifyNm: 0.35,
} as const;

// ---- What comes out --------------------------------------------------------

export interface CoastLine {
  // x, y interleaved, in nautical miles. A closed line does NOT repeat its first
  // vertex at the end — `closed` says so, and a repeated vertex is a zero-length
  // segment waiting to be drawn.
  readonly pts: Float64Array;
  readonly closed: boolean;
}

export interface Coast {
  readonly cols: number;
  readonly rows: number;
  readonly stepNm: number;
  readonly simplifyNm: number;
  readonly lines: CoastLine[];
  readonly vertices: number;
  // What the bake paid, so the claim about its cost can be checked rather than
  // asserted ([P-41]: prefer an assertion to a timing).
  readonly samples: number;
}

// ---- The bake --------------------------------------------------------------

export function bakeCoast(
  shape: WorldShape,
  stepNm: number = CHART.stepNm,
  simplifyNm: number = CHART.simplifyNm,
): Coast {
  const cols = Math.max(1, Math.round(shape.widthNm / stepNm));
  const rows = Math.max(1, Math.round(shape.heightNm / stepNm));
  const nx = cols + 1; // samples across
  const ny = rows + 1; // samples down

  // Sample coordinates taken from the fraction rather than by accumulation, so
  // the last column lands EXACTLY on the box edge ([P-9]: no drift — and an open
  // line's endpoint has to be on the boundary to the last bit before anyone can
  // say that it is). Computed once per column, never per sample ([P-18]).
  const xs = new Float64Array(nx);
  for (let i = 0; i < nx; i++) xs[i] = (i / cols) * shape.widthNm;
  const ys = new Float64Array(ny);
  for (let j = 0; j < ny; j++) ys[j] = (j / rows) * shape.heightNm;

  // ---- 1. The field, once. -------------------------------------------------
  const h = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const row = j * nx;
    const y = ys[j];
    for (let i = 0; i < nx; i++) h[row + i] = heightAt(shape, xs[i], y);
  }
  let samples = nx * ny;

  // ---- 2. Every crossing is an EDGE OF THE LATTICE, named by an integer. ----
  //
  // This is what makes the assembly exact: a crossing is never matched to another
  // crossing by comparing two floats. Two neighbouring cells share an edge, so
  // they share its id, and a contour is chained by integer identity. The position
  // is computed once, when the chain is walked.
  const HN = cols * ny; // horizontal edges: (i,j) -> (i+1,j)
  const VN = nx * rows; // vertical edges:   (i,j) -> (i,j+1)
  const next = new Int32Array(HN + VN).fill(-1);
  const isEnd = new Uint8Array(HN + VN);

  // ---- 3. March. -----------------------------------------------------------
  //
  // Corners a=top-left, b=top-right, c=bottom-right, d=bottom-left; the case code
  // is 1/2/4/8 for each of them being land. Walking the cell boundary CLOCKWISE
  // (a->b->c->d->a), a land-to-sea crossing starts a segment and a sea-to-land
  // crossing ends one. That one rule generates the whole table, orients every
  // segment with LAND ON ITS RIGHT, and makes every island in the world wind the
  // same way.
  for (let j = 0; j < rows; j++) {
    const top = j * nx;
    const bot = top + nx;
    for (let i = 0; i < cols; i++) {
      const ha = h[top + i];
      const hb = h[top + i + 1];
      const hc = h[bot + i + 1];
      const hd = h[bot + i];
      const code =
        (ha > 0 ? 1 : 0) | (hb > 0 ? 2 : 0) | (hc > 0 ? 4 : 0) | (hd > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const eN = j * cols + i;
      const eS = (j + 1) * cols + i;
      const eW = HN + j * nx + i;
      const eE = HN + j * nx + i + 1;

      switch (code) {
        case 1: link(next, isEnd, eN, eW); break;
        case 2: link(next, isEnd, eE, eN); break;
        case 3: link(next, isEnd, eE, eW); break;
        case 4: link(next, isEnd, eS, eE); break;
        case 6: link(next, isEnd, eS, eN); break;
        case 7: link(next, isEnd, eS, eW); break;
        case 8: link(next, isEnd, eW, eS); break;
        case 9: link(next, isEnd, eN, eS); break;
        case 11: link(next, isEnd, eE, eS); break;
        case 12: link(next, isEnd, eW, eE); break;
        case 13: link(next, isEnd, eN, eE); break;
        case 14: link(next, isEnd, eW, eN); break;
        // The two saddles. Ask the field whether the middle of this cell is land;
        // it is the only honest arbiter there is.
        case 5: {
          samples++;
          if (heightAt(shape, (xs[i] + xs[i + 1]) * 0.5, (ys[j] + ys[j + 1]) * 0.5) > 0) {
            link(next, isEnd, eN, eE);
            link(next, isEnd, eS, eW);
          } else {
            link(next, isEnd, eN, eW);
            link(next, isEnd, eS, eE);
          }
          break;
        }
        case 10: {
          samples++;
          if (heightAt(shape, (xs[i] + xs[i + 1]) * 0.5, (ys[j] + ys[j + 1]) * 0.5) > 0) {
            link(next, isEnd, eE, eS);
            link(next, isEnd, eW, eN);
          } else {
            link(next, isEnd, eE, eN);
            link(next, isEnd, eW, eS);
          }
          break;
        }
      }
    }
  }

  // ---- 4. Chain the segments into lines. -----------------------------------
  //
  // Each interior crossing is the START of exactly one segment and the END of
  // exactly one other — the orientation guarantees it — so a contour is a chain
  // with no choices in it. A crossing on the lattice's own boundary belongs to
  // one cell only, so it is a start with nothing before it or an end with nothing
  // after it. Those, and only those, are the ends of an OPEN line, and an open
  // line is a coast that runs off the edge of the chart.
  const visited = new Uint8Array(HN + VN);
  const lines: CoastLine[] = [];
  const g: Lattice = { xs, ys, cols, nx, HN, h };

  // Open lines first, in edge order; then whatever is left, which is closed.
  for (let e = 0; e < next.length; e++) {
    if (next[e] !== -1 && isEnd[e] === 0 && visited[e] === 0) {
      lines.push(makeLine(walk(g, next, visited, e), false, simplifyNm));
    }
  }
  for (let e = 0; e < next.length; e++) {
    if (next[e] !== -1 && visited[e] === 0) {
      lines.push(makeLine(walk(g, next, visited, e), true, simplifyNm));
    }
  }

  let vertices = 0;
  for (let i = 0; i < lines.length; i++) vertices += lines[i].pts.length / 2;

  return { cols, rows, stepNm, simplifyNm, lines, vertices, samples };
}

// ---- The pieces ------------------------------------------------------------

function link(next: Int32Array, isEnd: Uint8Array, from: number, to: number): void {
  next[from] = to;
  isEnd[to] = 1;
}

interface Lattice {
  xs: Float64Array;
  ys: Float64Array;
  cols: number;
  nx: number;
  HN: number;
  h: Float64Array;
}

// Follow one chain of segments and turn it into vertices. An edge's crossing is
// found by linear interpolation between the two heights that straddle zero — and
// they always straddle, which is why the edge has a crossing at all, so the
// divide is safe. Linear rather than bisected: a bisection would be a second,
// finer opinion about a coast the lattice has already decided the shape of, and
// two opinions in one picture is how a contour stops matching its own field.
function walk(g: Lattice, next: Int32Array, visited: Uint8Array, start: number): number[] {
  const out: number[] = [];
  let cur = start;
  while (cur !== -1 && visited[cur] === 0) {
    visited[cur] = 1;
    let x: number;
    let y: number;
    if (cur < g.HN) {
      const j = Math.floor(cur / g.cols);
      const i = cur - j * g.cols;
      const s = j * g.nx + i;
      const h0 = g.h[s];
      const t = h0 / (h0 - g.h[s + 1]);
      x = g.xs[i] + (g.xs[i + 1] - g.xs[i]) * t;
      y = g.ys[j];
    } else {
      const v = cur - g.HN;
      const j = Math.floor(v / g.nx);
      const i = v - j * g.nx;
      const s = j * g.nx + i;
      const h0 = g.h[s];
      const t = h0 / (h0 - g.h[s + g.nx]);
      x = g.xs[i];
      y = g.ys[j] + (g.ys[j + 1] - g.ys[j]) * t;
    }
    // A crossing pinned exactly to a lattice corner can be reached twice, from
    // the edge on either side of it. Two identical vertices are a zero-length
    // segment — a stroke that draws nothing and a normal that is not a direction
    // — so they never leave this loop.
    const n = out.length;
    if (n === 0 || out[n - 2] !== x || out[n - 1] !== y) out.push(x, y);
    cur = next[cur];
  }
  return out;
}

function makeLine(raw: number[], closed: boolean, simplifyNm: number): CoastLine {
  let pts = raw;
  // A closed line that walked back onto its own first vertex says so with
  // `closed`, not with a repeat.
  if (closed && pts.length >= 4) {
    const n = pts.length;
    if (pts[0] === pts[n - 2] && pts[1] === pts[n - 1]) pts = pts.slice(0, n - 2);
  }
  if (simplifyNm > 0) pts = simplify(pts, closed, simplifyNm);
  return { pts: Float64Array.from(pts), closed };
}

// ---- Douglas-Peucker -------------------------------------------------------
//
// A raw marching-squares contour carries a vertex on every cell edge it crosses,
// and on a coast running straight across the lattice most of them sit on a line
// saying nothing. Douglas-Peucker rather than a vertex-count target or a
// chord-length filter because it is the only one of the three whose guarantee is
// about the SHAPE: no dropped vertex is further than `eps` from the line that
// replaces it, so the tolerance is a statement about how far the coast may move,
// in nautical miles, which is the quantity that has to be small.
//
// Distances are compared squared, so there is no `Math.sqrt` in the hot part and
// no `Math.hypot` anywhere — `hypot` is banned outright by [P-5].
function simplify(pts: number[], closed: boolean, eps: number): number[] {
  const n = pts.length / 2;
  if (n < 3) return pts;

  // A closed loop has no endpoints to anchor on, so it is cut at its first vertex
  // and at the vertex furthest from it — the two a loop is least likely to want
  // to lose — and simplified as two open chains.
  let ex = pts;
  let far = 0;
  if (closed) {
    ex = pts.slice();
    ex.push(pts[0], pts[1]);
    let best = -1;
    for (let i = 1; i < n; i++) {
      const dx = pts[i * 2] - pts[0];
      const dy = pts[i * 2 + 1] - pts[1];
      const d2 = dx * dx + dy * dy;
      if (d2 > best) {
        best = d2;
        far = i;
      }
    }
  }

  const m = ex.length / 2;
  const keep = new Uint8Array(m);
  keep[0] = 1;
  keep[m - 1] = 1;
  const eps2 = eps * eps;
  if (closed) {
    keep[far] = 1;
    prune(ex, keep, 0, far, eps2);
    prune(ex, keep, far, m - 1, eps2);
  } else {
    prune(ex, keep, 0, m - 1, eps2);
  }

  const out: number[] = [];
  const last = closed ? m - 1 : m; // the repeated closing vertex is not output
  for (let i = 0; i < last; i++) {
    if (keep[i] === 1) out.push(ex[i * 2], ex[i * 2 + 1]);
  }
  // A cay small enough to simplify away is still a cay. A loop that cannot keep
  // three corners keeps all of them instead: a two-vertex "loop" is a line drawn
  // out and back again, which is worse than the vertices it saved.
  if (closed && out.length < 6) return pts;
  return out;
}

// Explicit stack rather than recursion: the contour round a continental shore
// runs to tens of thousands of vertices and the worst case for this split is
// linear depth.
function prune(pts: number[], keep: Uint8Array, lo: number, hi: number, eps2: number): void {
  const stack: number[] = [lo, hi];
  while (stack.length > 0) {
    const b = stack.pop() as number;
    const a = stack.pop() as number;
    if (b - a < 2) continue;
    const ax = pts[a * 2];
    const ay = pts[a * 2 + 1];
    const dx = pts[b * 2] - ax;
    const dy = pts[b * 2 + 1] - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2] - ax;
      const py = pts[i * 2 + 1] - ay;
      let d2: number;
      if (len2 === 0) {
        d2 = px * px + py * py;
      } else {
        const cross = dx * py - dy * px;
        d2 = (cross * cross) / len2;
      }
      if (d2 > worst) {
        worst = d2;
        at = i;
      }
    }
    if (worst > eps2 && at > 0) {
      keep[at] = 1;
      stack.push(a, at, at, b);
    }
  }
}
