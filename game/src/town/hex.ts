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

// The twelve hinterland hexes — every cell at distance 2 from the centre.
export function outerRing(): Axial[] {
  const out: Axial[] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) {
      if (distance({ q, r }, CENTRE) === 2) out.push({ q, r });
    }
  }
  return out;
}

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
