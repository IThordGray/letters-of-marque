// The hex flower a town's land is drawn on. Pure geometry — no game state, no
// DOM. The sim never imports this; only the renderer does.
//
// Draw 19, simulate 7: the CENTRE hex is the town itself (one centre hex = one
// raid map), the INNER ring of 6 are the parcels, and the OUTER 12 are hinterland
// — drawn so the map reads as country, carrying no data yet.

import type { Bearing } from "./types";

// Axial coordinates. Flat-top orientation, so the six neighbours are the six
// bearings and N/S survive — which is what lets a town's local views be drawn
// with seaward down the page ([HC-73]).
export interface Axial {
  q: number;
  r: number;
}

export const BEARING_ORDER: Bearing[] = ["N", "NE", "SE", "S", "SW", "NW"];

const AXIAL: Record<Bearing, Axial> = {
  N: { q: 0, r: -1 },
  NE: { q: 1, r: -1 },
  SE: { q: 1, r: 0 },
  S: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  NW: { q: -1, r: 0 },
};

export const axialOf = (b: Bearing): Axial => AXIAL[b];

export const CENTRE: Axial = { q: 0, r: 0 };

// The six parcel hexes, in clockwise bearing order.
export const innerRing = (): Axial[] => BEARING_ORDER.map(axialOf);

// Every cell at exactly distance n from the centre.
export function ring(n: number): Axial[] {
  const out: Axial[] = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      if (distance({ q, r }, CENTRE) === n) out.push({ q, r });
    }
  }
  return out;
}

// Everything within n of the centre, centre included.
export const disc = (n: number): Axial[] =>
  [CENTRE, ...Array.from({ length: n }, (_, i) => ring(i + 1)).flat()];

export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

// Flat-top axial → pixel centre. `size` is the hex circumradius (centre to corner).
export function toPixel(a: Axial, size: number): { x: number; y: number } {
  return {
    x: size * 1.5 * a.q,
    y: size * Math.sqrt(3) * (a.r + a.q / 2),
  };
}

// The six corners of a flat-top hex, for drawing.
export function corners(centre: { x: number; y: number }, size: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return { x: centre.x + size * Math.cos(angle), y: centre.y + size * Math.sin(angle) };
  });
}

// The two corners a hex shares with its neighbour in direction `b` — the line a
// wall runs along when that bearing is enclosed.
export function sharedEdge(centre: { x: number; y: number }, size: number, b: Bearing): [{ x: number; y: number }, { x: number; y: number }] {
  const to = toPixel(axialOf(b), size);
  const theta = Math.atan2(to.y, to.x);
  const at = (a: number) => ({ x: centre.x + size * Math.cos(a), y: centre.y + size * Math.sin(a) });
  return [at(theta - Math.PI / 6), at(theta + Math.PI / 6)];
}

// A point between a ring hex and the town, where the built-up ground bites in.
export function towardCentre(from: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: from.x * (1 - t), y: from.y * (1 - t) };
}

// ---- Working with sets of hexes --------------------------------------------

export const key = (a: Axial) => `${a.q},${a.r}`;

export const neighbours = (a: Axial): Axial[] =>
  BEARING_ORDER.map((b) => ({ q: a.q + axialOf(b).q, r: a.r + axialOf(b).r }));

// How far seaward a hex lies IN THE TOWN'S OWN FRAME. This is a DRAWING axis, not
// a geographic claim: the world holds a place's true coastal bearing ([HC-19]),
// and every local view of it is drawn rotated so that seaward is down the page
// ([HC-73]). That is what keeps the hex map's water along the bottom and the raid
// map's landing on the near edge, whichever way the real coast faces. The
// coastline is irregular; which way the DRAWING faces is not (spec §2.7).
export const southness = (a: Axial) => a.r + a.q / 2;

// Seaward first, then easterly — the order a TIE between two bearings is settled
// in, and the whole of why it is seaward-first (KAN-111).
//
// Ground exactly between two bearings has to be called something, and it used to
// be called whichever of the two `BEARING_ORDER` happened to list first. That is
// an accident of an array, not a rule, and it read wrongly in the one case a
// player actually sees: a hex due east of the town on the local frame's axis (its
// seaward-ness exactly 0, e.g. q=2 r=-1) ties between NE and SE, and water
// straight out to the east was described in prose as lying "to the north-east".
//
// It resolves seaward because in a town's local frame south IS seaward ([HC-73])
// and what a bearing names is usually a coast or a stretch of water, so the
// seaward reading is the one that is true of a coastal town. `S` outranks its
// neighbours, `SE`/`SW` outrank `NE`/`NW`, and those outrank `N`.
//
// This ranking is a permutation of the six, so it is a strict total order and the
// answer no longer depends on the order the compass is walked in at all ([P-10]).
// It is (seaward-ness descending, then easterly) written out: the second key only
// separates NE from NW and SE from SW, which the measurement below says can never
// be tied for the win — it is here so the order is total rather than nearly so.
const SEAWARD_FIRST: Record<Bearing, number> = { S: 0, SE: 1, SW: 2, NE: 3, NW: 4, N: 5 };

// The compass direction of a hex from the town, for prose and the placement
// skew. DERIVED — never stored as the spatial fact (spec §2.10).
//
// No normalisation. All six bearing vectors are the same length and the hex's own
// length is constant within the call, so the old code divided every candidate by
// the same positive constant before taking a maximum — which cannot change which
// candidate wins. It bought nothing and cost the module its only banned call
// (`Math.hypot`, [P-5]). Verified identical over every region centroid of six
// hundred rolled towns, every integer hex within eight of the centre, and a
// twelfth-of-a-hex grid: no disagreement anywhere.
//
// WHICH HEXES TIE WAS MEASURED, NOT DERIVED, because the six vectors are the same
// length mathematically and NOT bit-identically — N and S square to
// 2.9999999999999996 and the other four to 3.0, which is the ULP that made the
// de-normalisation argument hold empirically rather than by algebra. Measured:
// exact ties occur on all six boundaries between ADJACENT bearings and nowhere
// else — 20 of the 216 integer hexes within eight of the centre, and 104 samples
// of a half- and third-hex centroid grid. Adjacent bearings always differ in
// seaward-ness, so seaward-first settles every tie that can actually happen.
export function bearingOf(a: Axial): Bearing {
  // The initial value is never read — the first candidate always beats -Infinity.
  // It is the seaward bearing so the declaration reads as no preference at all.
  let best: Bearing = "S";
  let bestDot = -Infinity;
  const p = toPixel(a, 1);
  for (const b of BEARING_ORDER) {
    const d = toPixel(axialOf(b), 1);
    const dot = p.x * d.x + p.y * d.y;
    if (dot > bestDot || (dot === bestDot && SEAWARD_FIRST[b] < SEAWARD_FIRST[best])) {
      bestDot = dot;
      best = b;
    }
  }
  return best;
}

// The centroid of a set of hexes, in axial space.
export function centroid(cells: Axial[]): Axial {
  if (!cells.length) return CENTRE;
  const q = cells.reduce((s, c) => s + c.q, 0) / cells.length;
  const r = cells.reduce((s, c) => s + c.r, 0) / cells.length;
  return { q, r };
}

// Pixel bounds of a set of hexes, so the map can size itself to the land it has
// rather than to a fixed ring.
export function bounds(cells: Axial[], size: number) {
  const pts = cells.map((c) => toPixel(c, size));
  const pad = size * 1.15;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}
