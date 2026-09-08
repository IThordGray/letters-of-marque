// The hex flower a town's land is drawn on. Pure geometry — no game state, no
// DOM. The sim never imports this; only the renderer does.
//
// Draw 19, simulate 7: the CENTRE hex is the town itself (one centre hex = one
// raid map), the INNER ring of 6 are the parcels, and the OUTER 12 are hinterland
// — drawn so the map reads as country, carrying no data yet.

import type { Bearing } from "./types";

// Axial coordinates. Flat-top orientation, so the six neighbours are the six
// bearings and N/S survive (which is what keeps "the sea lies south" true).
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

// The hinterland: everything beyond the parcel ring, out to the drawn edge.
// Drawn so the map reads as country — there is a lot of land — and carrying no
// data yet beyond sea-or-shore.
export const HINTERLAND_RADIUS = 3;
export const outerRing = (): Axial[] =>
  Array.from({ length: HINTERLAND_RADIUS - 1 }, (_, i) => ring(i + 2)).flat();

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

// A hinterland hex is "sea" if it lies seaward — the sea is south, so anything in
// the southern arc of the outer ring is water. Enough to frame the coast.
export const isSeaward = (a: Axial) => a.r + a.q / 2 > 0.5;

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
