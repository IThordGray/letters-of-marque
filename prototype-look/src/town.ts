// The town, hand-written as a fixture.
//
// DELIBERATELY NOT WIRED to `game/src/town/` or to the town ledger. This is a
// picture of a town, laid out by hand so that it *looks* like one: buildings
// snap to a street bearing, density falls off from the plaza, the church and
// the governor's stand in the middle, huts and fences trail off at the edge.
//
// Coordinates are town-local scene units: +along runs the waterfront, +inland
// runs away from the water. `place.ts` rotates the whole thing onto the true
// seaward bearing the generator reports for this shore.
//
// Two details carry more than their cost, and both are already in the design:
// FOUR RUINS (a box with its roof taken off) and an UNFINISHED WALL TRACE that
// stops in mid-air. Together they are what makes a town look like it has been
// standing a while rather than being placed this morning.

export type Kind =
  | "dwelling"
  | "warehouse"
  | "church"
  | "governor"
  | "fort"
  | "gaol"
  | "barracks"
  | "magazine"
  | "wall";

export interface Building {
  kind: Kind;
  along: number;
  inland: number;
  w: number; // along the ridge of the roof
  d: number; // across it
  rot: number; // degrees off the street bearing
  h?: number; // override the kind's default body height
  ruin?: boolean; // roof gone, walls part-fallen
  flat?: boolean; // no gable — a battery, a magazine, a wall
}

// Roof colours are the game's own vocabulary, from `game/src/render.ts`.
export const ROOF: Record<Kind, number> = {
  dwelling: 0x7a5236,
  warehouse: 0x8a6a3a,
  church: 0x707480,
  governor: 0x707480,
  fort: 0x707480,
  gaol: 0x463d34,
  barracks: 0x463d34,
  magazine: 0x7c3b31,
  wall: 0x5a4632,
};

// Walls are plaster, stone or timber depending on who paid for them.
export const WALLS: Record<Kind, number> = {
  dwelling: 0xe4d3b4,
  warehouse: 0xb29168,
  church: 0xd8d0be,
  governor: 0xe1d8c2,
  fort: 0x9a958a,
  gaol: 0xa89f8e,
  barracks: 0xb2a48b,
  magazine: 0xbfb399,
  wall: 0x8c8270,
};

export const BODY_HEIGHT: Record<Kind, number> = {
  dwelling: 9,
  warehouse: 11,
  church: 15,
  governor: 13,
  fort: 11,
  gaol: 9,
  barracks: 10,
  magazine: 9,
  wall: 7,
};

export const BUILDINGS: readonly Building[] = [
  // -- the waterfront: goods sheds, the gaol, and the battery on the point ---
  { kind: "fort", along: -96, inland: 14, w: 22, d: 18, rot: -6, flat: true },
  { kind: "warehouse", along: -76, inland: 12, w: 18, d: 11, rot: 1 },
  { kind: "warehouse", along: -54, inland: 11, w: 16, d: 10, rot: -2 },
  { kind: "warehouse", along: -33, inland: 12, w: 17, d: 10, rot: 0 },
  { kind: "warehouse", along: -11, inland: 10, w: 15, d: 10, rot: 2 },
  { kind: "warehouse", along: 10, inland: 12, w: 16, d: 11, rot: -1 },
  { kind: "warehouse", along: 31, inland: 11, w: 14, d: 10, rot: 1 },
  { kind: "gaol", along: 52, inland: 13, w: 11, d: 9, rot: 0 },
  { kind: "dwelling", along: 70, inland: 12, w: 10, d: 8, rot: -3 },
  { kind: "dwelling", along: 85, inland: 14, w: 9, d: 8, rot: 2, ruin: true },

  // -- the second street ----------------------------------------------------
  { kind: "dwelling", along: -80, inland: 31, w: 10, d: 8, rot: 2 },
  { kind: "dwelling", along: -66, inland: 33, w: 9, d: 8, rot: -1 },
  { kind: "dwelling", along: -53, inland: 31, w: 10, d: 8, rot: 0 },
  { kind: "dwelling", along: -40, inland: 33, w: 9, d: 8, rot: 3 },
  { kind: "warehouse", along: -22, inland: 32, w: 14, d: 10, rot: -1 },
  { kind: "dwelling", along: -5, inland: 31, w: 10, d: 8, rot: 1 },
  { kind: "dwelling", along: 9, inland: 33, w: 9, d: 8, rot: -2 },
  { kind: "dwelling", along: 23, inland: 31, w: 10, d: 8, rot: 0 },
  { kind: "dwelling", along: 38, inland: 33, w: 9, d: 8, rot: 2 },
  { kind: "dwelling", along: 54, inland: 31, w: 10, d: 8, rot: -1 },
  { kind: "dwelling", along: 69, inland: 33, w: 9, d: 8, rot: 1, ruin: true },

  // -- the plaza: church, tower, governor's, market store -------------------
  { kind: "church", along: -14, inland: 56, w: 17, d: 12, rot: 0 },
  { kind: "church", along: -25, inland: 56, w: 7, d: 7, rot: 0, h: 30, flat: true },
  { kind: "governor", along: 17, inland: 58, w: 17, d: 13, rot: -2 },
  { kind: "warehouse", along: 0, inland: 78, w: 14, d: 10, rot: 90 },
  { kind: "dwelling", along: -36, inland: 57, w: 10, d: 8, rot: 90 },
  { kind: "dwelling", along: -36, inland: 71, w: 10, d: 8, rot: 88 },
  { kind: "dwelling", along: 39, inland: 56, w: 10, d: 8, rot: 91 },
  { kind: "dwelling", along: 39, inland: 70, w: 10, d: 8, rot: 90 },
  { kind: "dwelling", along: 58, inland: 55, w: 9, d: 8, rot: -1 },
  { kind: "dwelling", along: 72, inland: 58, w: 9, d: 8, rot: 2 },

  // -- the garrison quarter, uphill and behind ------------------------------
  { kind: "barracks", along: -62, inland: 60, w: 18, d: 10, rot: 1 },
  { kind: "magazine", along: -62, inland: 78, w: 9, d: 9, rot: 0, flat: true },

  // -- the outskirts: huts, thinning out, two of them abandoned -------------
  { kind: "dwelling", along: -84, inland: 86, w: 8, d: 7, rot: 6 },
  { kind: "dwelling", along: -70, inland: 94, w: 7, d: 6, rot: -4 },
  { kind: "dwelling", along: -50, inland: 88, w: 8, d: 7, rot: 3, ruin: true },
  { kind: "dwelling", along: -30, inland: 97, w: 7, d: 6, rot: -6 },
  { kind: "dwelling", along: -8, inland: 92, w: 8, d: 7, rot: 2 },
  { kind: "dwelling", along: 14, inland: 99, w: 7, d: 6, rot: 5 },
  { kind: "dwelling", along: 33, inland: 90, w: 8, d: 7, rot: -3 },
  { kind: "dwelling", along: 54, inland: 96, w: 7, d: 6, rot: 4, ruin: true },
  { kind: "dwelling", along: 74, inland: 88, w: 8, d: 7, rot: -2 },
];

// The landward wall. Begun at the battery end, carried round the back of the
// town, then ABANDONED: a gap where the money ran out, two more sections
// beyond it, and then nothing at all.
export const WALL_TRACE: readonly Building[] = [
  { kind: "wall", along: -104, inland: 50, w: 22, d: 4, rot: 78, flat: true },
  { kind: "wall", along: -101, inland: 72, w: 22, d: 4, rot: 74, flat: true },
  { kind: "wall", along: -96, inland: 93, w: 22, d: 4, rot: 62, flat: true },
  { kind: "wall", along: -84, inland: 111, w: 22, d: 4, rot: 40, flat: true },
  { kind: "wall", along: -65, inland: 121, w: 22, d: 4, rot: 18, flat: true },
  { kind: "wall", along: -43, inland: 126, w: 22, d: 4, rot: 8, flat: true },
  { kind: "wall", along: -21, inland: 128, w: 22, d: 4, rot: 4, flat: true },
  { kind: "wall", along: 1, inland: 129, w: 22, d: 4, rot: -3, flat: true },
  // ---- the gap: never built ----
  { kind: "wall", along: 47, inland: 123, w: 22, d: 4, rot: -14, flat: true },
  { kind: "wall", along: 67, inland: 115, w: 15, d: 4, rot: -26, flat: true, h: 4 },
];
