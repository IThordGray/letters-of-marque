// The bridge between the real world generator and this spike's scene space.
//
// `game/src/overworld/shape.ts` is READ and never written. The spike imports
// `makeShape`, `heightAt` and `seawardAt` and derives everything else from
// them, so the island on screen is the island the simulation believes in.

import { makeShape, heightAt, seawardAt } from "../../game/src/overworld/shape";
import { PLACE, SCALE } from "./constants";

export const shape = makeShape(PLACE.seed);

// World nautical miles -> scene units, with the window's centre at the origin.
export const nmToX = (nmX: number): number => (nmX - PLACE.centreNmX) * SCALE.unitsPerNm;
export const nmToZ = (nmY: number): number => (nmY - PLACE.centreNmY) * SCALE.unitsPerNm;
export const xToNm = (x: number): number => x / SCALE.unitsPerNm + PLACE.centreNmX;
export const zToNm = (z: number): number => z / SCALE.unitsPerNm + PLACE.centreNmY;

// Raw generator height at a scene position, and the same in scene units.
export const rawAt = (x: number, z: number): number => heightAt(shape, xToNm(x), zToNm(z));
export const groundAt = (x: number, z: number): number => rawAt(x, z) * SCALE.heightUnits;

// The town's anchor and its frame. The waterfront faces the true seaward
// bearing the generator reports, so the street grid is laid against the real
// coast rather than against the window's axes.
const seaward = seawardAt(shape, PLACE.townNmX, PLACE.townNmY);

export const TOWN = {
  x: nmToX(PLACE.townNmX),
  z: nmToZ(PLACE.townNmY),
  // Local +x runs along the shore, local +z runs inland.
  alongX: -seaward.dy,
  alongZ: seaward.dx,
  inlandX: -seaward.dx,
  inlandZ: -seaward.dy,
} as const;

// The bearing of the shore street, in radians about +Y, for rotating boxes.
// A three.js Y-rotation of θ sends local +x to (cos θ, 0, -sin θ), so this is
// the angle that puts local +x on `along` and local +z on `inland`.
export const TOWN_BEARING = Math.atan2(-TOWN.alongZ, TOWN.alongX);

// This shore climbs about 1 unit in 3, so the town is compressed uphill: the
// streets terrace instead of marching off up the mountain.
const INLAND_SQUEEZE = 0.68;
// ...and stood off the waterline, or the front row of sheds paddles.
const INLAND_OFFSET = 16;

// Town-local (along, inland) -> scene (x, z).
export function townToScene(along: number, inland: number): { x: number; z: number } {
  const up = inland * INLAND_SQUEEZE + INLAND_OFFSET;
  return {
    x: TOWN.x + TOWN.alongX * along + TOWN.inlandX * up,
    z: TOWN.z + TOWN.alongZ * along + TOWN.inlandZ * up,
  };
}

// A stable per-thing jitter in [0, 1). Not the simulation's `chance.ts` — this
// is presentation noise and nothing downstream depends on its value.
//
// It has to avalanche properly all the same: the first version of this mixed
// its two inputs too weakly, and 9,000 trees drawn from `jitter(n, saltA)` and
// `jitter(n, saltB)` came out in dead straight rows across the island, because
// the two coordinates stayed correlated with n.
export function jitter(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ 0x2f6e2b1, 0x9e3779b1);
  h = Math.imul(h ^ ((b | 0) + 0x165667b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
