// The world's shape — landmasses and coastlines, as data the simulation queries.
//
// [HC-19] The world map is the single source of geography. Nothing downstream
//         invents a coast; everything asks this module where the water is.
// [HC-24] No hex grid at world scale. Positions are continuous coordinates in
//         NAUTICAL MILES, x east and y south, and distances are real.
// [P-17]  The shape is stored as a few dozen lobes and a noise field — a
//         description of the world, not a picture of it. `heightAt` is a pure
//         function of (shape, position), so the coastline exists at every
//         resolution anyone asks for and occupies no memory at any of them.
//
// A lobe is an ellipse that lifts the sea floor. Land is where the lifted floor
// beats sea level after the coast field has crinkled it. Overlapping lobes union
// (by `max`, not by sum) so two islands touching do not bulge into a plateau
// between them; the crinkle hides the seam where they meet.
//
// Why lobes rather than pure noise: pure noise gives a world with no composition
// — an even spatter of islands, no mainland, no basin, nowhere that reads as
// "the sea". Lobes carry the composition (a continental shore to the south, a
// broken chain to the north-west, an island arc to the east) and the noise
// carries the irregularity. The composition is CONTENT and lives in the tables
// below ([HC-90]); the seed varies every number in it.

import { CHANNEL, rollOf } from "./chance";
import { fbm, fieldSeed } from "./noise";

// ---- The world's measure ([HC-90]: data) -----------------------------------
// §6: a Caribbean-register sea holding fifty ports is on the order of
// 1,500 x 800 nm, and at an average made-good of 4-8 knots a typical inter-port
// leg is one to four days. That is the whole reason distance is the game's main
// currency of cost, so the numbers that say what a day is worth live here.
export const WORLD_BOX = {
  widthNm: 1500,
  heightNm: 800,
  // Off the edge of the world there is only ocean. The lift tapers to nothing
  // across this margin, so no landmass is ever cut off square by the box.
  marginNm: 80,
} as const;

export const PASSAGE = {
  madeGoodKn: 6, // the middle of §6's 4-8 knots
  hoursPerDay: 24,
} as const;

// One day's run. Derived from the table rather than written twice.
export const DAY_RUN_NM = PASSAGE.madeGoodKn * PASSAGE.hoursPerDay;

// ---- The composition -------------------------------------------------------

// Fractions of the box, so the composition survives a change of scale. Each
// entry is a CHAIN of lobes marching along (dx, dy) from its landfall.
const MAINLANDS = [
  // The Main: a continental shore running the length of the southern edge.
  { fx: 0.30, fy: 0.96, dx: 1.0, dy: -0.05, lobes: [4, 6], rx: [200, 330], ry: [120, 210], lift: [1.2, 1.5], always: true },
  // The great islands, north-west — a broken coast rather than a continent.
  { fx: 0.06, fy: 0.30, dx: 0.95, dy: -0.14, lobes: [3, 5], rx: [100, 180], ry: [55, 105], lift: [1.05, 1.4], always: true },
  // An eastern shore. Some worlds are open to the ocean on that side.
  { fx: 0.97, fy: 0.22, dx: 0.10, dy: 1.0, lobes: [2, 4], rx: [95, 165], ry: [85, 155], lift: [1.0, 1.35], always: false },
] as const;

// The windward arc: small islands strung between two ends of the box. This is
// what gives the sea a windward side worth being exposed on ([HC-29]).
const ARC = {
  fromX: 0.90, fromY: 0.06, toX: 0.70, toY: 0.92,
  count: [6, 10], r: [24, 66], lift: [1.0, 1.4], wanderNm: 95,
} as const;

// ...and cays and lone islands anywhere at all.
const SCATTER = { count: [8, 14], r: [13, 42], lift: [0.95, 1.3] } as const;

// How the coast is crinkled, and it is crinkled TWICE.
//
// The coarse field carries the shape of the sea — great bays, gulfs, the run of
// a shore — from 280 nm down to about 9. But a fractal sum halves its weight
// every octave, so by the time it reaches a town's own scale it is contributing
// less than a hundredth and the local coast comes out straight. MEASURED: with
// the coarse field alone, sampling the whole sea every 2 nm found only 15% more
// waterlines than sampling it every 30 nm, which is another way of saying there
// was nothing there to find.
//
// That matters because of [HC-19]. A town's ground is cut from this same field
// at 1.8 nm a hex; if the field is smooth at that scale, every one of fifty
// towns gets the same straight beach and the cut is geography in name only. So
// the fine field is a SEPARATE term with its own amplitude — small enough not to
// dissolve the world into islets, large enough to put a headland and a cove on a
// coast that is fifteen miles long.
const CRINKLE = {
  seaLevel: 0.36,
  amount: 0.50, wave: 280, octaves: 6, field: 1,
  fineAmount: 0.40, fineWave: 12, fineOctaves: 3, fineField: 3,
} as const;

// ---- Sixteen directions, as a table ----------------------------------------
// [P-5] bans `cos` and `sin`, and §5 of performance.md names this as the one
// legitimate use of a lookup table: replacing a banned transcendental with a
// small exact one. Sixteen unit vectors, 22.5 degrees apart, a quarter of a
// kilobyte. Used to ask a position what lies around it.
const R1 = 0.9238795325112867;
const R2 = 0.3826834323650898;
const R3 = 0.7071067811865476;
export const RAYS: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: 1, dy: 0 }, { dx: R1, dy: R2 }, { dx: R3, dy: R3 }, { dx: R2, dy: R1 },
  { dx: 0, dy: 1 }, { dx: -R2, dy: R1 }, { dx: -R3, dy: R3 }, { dx: -R1, dy: R2 },
  { dx: -1, dy: 0 }, { dx: -R1, dy: -R2 }, { dx: -R3, dy: -R3 }, { dx: -R2, dy: -R1 },
  { dx: 0, dy: -1 }, { dx: R2, dy: -R1 }, { dx: R3, dy: -R3 }, { dx: R1, dy: -R2 },
];

// ---- The struct ------------------------------------------------------------

export interface Lobe {
  x: number;
  y: number;
  rx: number;
  ry: number;
  lift: number;
}

export interface WorldShape {
  widthNm: number;
  heightNm: number;
  marginNm: number;
  lobes: Lobe[];
  coastField: number; // the field that carries the shape of the sea
  crinkle: number;
  wave: number;
  octaves: number;
  fineField: number; // ...and the one that carries a town's own headlands
  fineCrinkle: number;
  fineWave: number;
  fineOctaves: number;
  seaLevel: number;
}

// One factory, every field present, same order, same types ([P-26]) — including
// the empty shape the bare clock carries before a world is generated onto it.
function shapeOf(lobes: Lobe[], coastField: number, fineField: number): WorldShape {
  return {
    widthNm: WORLD_BOX.widthNm,
    heightNm: WORLD_BOX.heightNm,
    marginNm: WORLD_BOX.marginNm,
    lobes,
    coastField,
    crinkle: CRINKLE.amount,
    wave: CRINKLE.wave,
    octaves: CRINKLE.octaves,
    fineField,
    fineCrinkle: CRINKLE.fineAmount,
    fineWave: CRINKLE.fineWave,
    fineOctaves: CRINKLE.fineOctaves,
    seaLevel: CRINKLE.seaLevel,
  };
}

export const emptyShape = (): WorldShape => shapeOf([], 0, 0);

// ---- Drawing the world -----------------------------------------------------
// Slot bases, so every roll's coordinates are its own. A lobe's numbers come
// from `(seed, worldgen, SLOT + index, attribute)` and from nothing else, which
// is why adding a thirty-third lobe cannot move the first thirty-two ([HC-10]).
const SLOT = { mainland: 1000, arc: 1400, scatter: 1800 } as const;

const span = (r: number, lo: number, hi: number) => lo + r * (hi - lo);
const step = (r: number, lo: number, hi: number) => lo + Math.floor(r * (hi - lo + 1));

export function makeShape(seed: number): WorldShape {
  const lobes: Lobe[] = [];
  const roll = (slot: number, attr: number) => rollOf(seed, CHANNEL.worldgen, slot, attr);
  const W = WORLD_BOX.widthNm;
  const H = WORLD_BOX.heightNm;

  // The chains. Each marches from its landfall along its own run, each lobe
  // jittered off the line so the coast is not a row of beads.
  for (let m = 0; m < MAINLANDS.length; m++) {
    const spec = MAINLANDS[m];
    const base = SLOT.mainland + m * 100;
    if (!spec.always && roll(base, 0) < 0.4) continue;
    const count = step(roll(base, 1), spec.lobes[0], spec.lobes[1]);
    let x = spec.fx * W;
    let y = spec.fy * H;
    for (let j = 0; j < count; j++) {
      const s = base + 1 + j;
      const rx = span(roll(s, 2), spec.rx[0], spec.rx[1]);
      const ry = span(roll(s, 3), spec.ry[0], spec.ry[1]);
      lobes.push({
        x: x + (roll(s, 4) - 0.5) * rx * 0.5,
        y: y + (roll(s, 5) - 0.5) * ry * 0.7,
        rx,
        ry,
        lift: span(roll(s, 6), spec.lift[0], spec.lift[1]),
      });
      // ...and on along the run, by rather less than a full radius so the chain
      // holds together where it means to.
      const advance = rx * span(roll(s, 7), 0.85, 1.25);
      x += spec.dx * advance;
      y += spec.dy * advance;
    }
  }

  // The windward arc — strung between two ends of the box, wandering as it goes.
  const arcCount = step(roll(SLOT.arc, 0), ARC.count[0], ARC.count[1]);
  for (let i = 0; i < arcCount; i++) {
    const s = SLOT.arc + 1 + i;
    const t = arcCount > 1 ? i / (arcCount - 1) : 0.5;
    const r = span(roll(s, 1), ARC.r[0], ARC.r[1]);
    lobes.push({
      x: span(t, ARC.fromX * W, ARC.toX * W) + (roll(s, 2) - 0.5) * ARC.wanderNm,
      y: span(t, ARC.fromY * H, ARC.toY * H) + (roll(s, 3) - 0.5) * ARC.wanderNm,
      rx: r,
      ry: r * span(roll(s, 4), 0.65, 1.35),
      lift: span(roll(s, 5), ARC.lift[0], ARC.lift[1]),
    });
  }

  // Cays and lone islands. Some will fetch up against a mainland and become a
  // headland; that is the point of a union rather than a list.
  const scatterCount = step(roll(SLOT.scatter, 0), SCATTER.count[0], SCATTER.count[1]);
  for (let i = 0; i < scatterCount; i++) {
    const s = SLOT.scatter + 1 + i;
    const r = span(roll(s, 1), SCATTER.r[0], SCATTER.r[1]);
    lobes.push({
      x: span(roll(s, 2), WORLD_BOX.marginNm, W - WORLD_BOX.marginNm),
      y: span(roll(s, 3), WORLD_BOX.marginNm, H - WORLD_BOX.marginNm),
      rx: r,
      ry: r * span(roll(s, 4), 0.6, 1.4),
      lift: span(roll(s, 5), SCATTER.lift[0], SCATTER.lift[1]),
    });
  }

  return shapeOf(lobes, fieldSeed(seed, CRINKLE.field), fieldSeed(seed, CRINKLE.fineField));
}

// ---- Asking the world where the water is -----------------------------------

// How the lift tapers away at the edge of the box, so the world ends in ocean
// rather than in a straight cliff.
function edgeFall(s: WorldShape, x: number, y: number): number {
  const m = s.marginNm;
  const f = (d: number) => (d >= m ? 1 : d <= 0 ? 0 : d / m);
  return f(x) * f(s.widthNm - x) * f(y) * f(s.heightNm - y);
}

// Height above sea level at a position. Positive is land, negative is water, and
// the magnitude just below zero is how shallow the water is — which is what
// makes fishing banks a property of the map rather than a roll.
//
// The loop over lobes is not a `[P-14]` violation: there is nothing to remove
// from the list, because every lobe is a live candidate for some query. It is a
// field evaluation over a few dozen ellipses, and it runs at generation and on
// demand, never once per place per day.
export function heightAt(s: WorldShape, x: number, y: number): number {
  let lift = 0;
  for (let i = 0; i < s.lobes.length; i++) {
    const l = s.lobes[i];
    const dx = (x - l.x) / l.rx;
    const dy = (y - l.y) / l.ry;
    const d2 = dx * dx + dy * dy;
    if (d2 >= 1) continue;
    const v = l.lift * (1 - d2);
    if (v > lift) lift = v;
  }
  const crinkled =
    lift +
    (fbm(s.coastField, x, y, s.wave, s.octaves) - 0.5) * s.crinkle +
    (fbm(s.fineField, x, y, s.fineWave, s.fineOctaves) - 0.5) * s.fineCrinkle;
  return crinkled * edgeFall(s, x, y) - s.seaLevel;
}

export const isLandAt = (s: WorldShape, x: number, y: number): boolean => heightAt(s, x, y) > 0;

// ---- Finding a coast -------------------------------------------------------

// Walk from a position along a direction until the field changes sign, then
// bisect onto the waterline. Returns null if the whole leg stayed on one side.
//
// Bisection rather than a Newton step on the gradient: the field is fractal, so
// its gradient is honest only at the scale you sample it at, and a Newton step
// on fine noise overshoots. Bisection cannot overshoot.
const MARCH = { stepNm: 12, bisections: 9 } as const;

export function coastAlong(
  s: WorldShape,
  x: number,
  y: number,
  dx: number,
  dy: number,
  maxNm: number,
): { x: number; y: number } | null {
  let t = 0;
  let hereLand = isLandAt(s, x, y);
  while (t < maxNm) {
    const next = Math.min(t + MARCH.stepNm, maxNm);
    const nx = x + dx * next;
    const ny = y + dy * next;
    if (isLandAt(s, nx, ny) !== hereLand) {
      // The waterline lies between `t` and `next`. Halve until it is pinned to
      // well under a hex.
      let lo = t;
      let hi = next;
      for (let i = 0; i < MARCH.bisections; i++) {
        const mid = (lo + hi) * 0.5;
        if (isLandAt(s, x + dx * mid, y + dy * mid) === hereLand) lo = mid;
        else hi = mid;
      }
      const at = (lo + hi) * 0.5;
      return { x: x + dx * at, y: y + dy * at };
    }
    t = next;
    if (t >= maxNm) break;
  }
  return null;
}

// ---- Reading a coast -------------------------------------------------------

const LOOK = { radii: [4, 10, 20], shelterNm: [7, 14], shelterFloor: 0.42, shelterSpan: 0.33 } as const;

// The TRUE coastal bearing at a position, as a unit vector pointing seaward
// ([HC-73]). Every local view of a place is drawn in a frame rotated so that
// this direction is down the page; the world keeps the truth.
//
// Read off the water itself rather than off the height gradient: what a sailor
// means by "seaward" is where the open water is, and on a crinkled coast the
// gradient at one point can face along a creek.
export function seawardAt(s: WorldShape, x: number, y: number): { dx: number; dy: number } {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < RAYS.length; i++) {
    const ray = RAYS[i];
    for (let k = 0; k < LOOK.radii.length; k++) {
      const d = LOOK.radii[k];
      if (!isLandAt(s, x + ray.dx * d, y + ray.dy * d)) {
        // Nearer water argues louder about which way the beach faces.
        const weight = 1 / d;
        sx += ray.dx * weight;
        sy += ray.dy * weight;
      }
    }
  }
  const len = Math.sqrt(sx * sx + sy * sy);
  // Land on every ray at every radius: an inland position, which the siting code
  // never hands us. South is as good an answer as any and keeps the caller from
  // having to handle a zero vector.
  if (len < 1e-9) return { dx: 0, dy: 1 };
  return { dx: sx / len, dy: sy / len };
}

// How enclosed the water off this position is, 0 (an open beach or an islet) to
// 1 (water almost ringed by land). A MAP PROPERTY, read off the same field as
// everything else — which is what lets a good anchorage argue for a trade port
// instead of a table deciding it.
export function shelterAt(s: WorldShape, x: number, y: number): number {
  let land = 0;
  for (let k = 0; k < LOOK.shelterNm.length; k++) {
    const d = LOOK.shelterNm[k];
    for (let i = 0; i < RAYS.length; i++) {
      const ray = RAYS[i];
      if (isLandAt(s, x + ray.dx * d, y + ray.dy * d)) land++;
    }
  }
  // A straight beach has land on rather less than half the compass at both
  // ranges; a bay head has it on most of it, and being nearly surrounded is the
  // best anchorage there is.
  const share = land / (RAYS.length * LOOK.shelterNm.length);
  const over = (share - LOOK.shelterFloor) / LOOK.shelterSpan;
  return over < 0 ? 0 : over > 1 ? 1 : over;
}

// Straight-line distance in nautical miles, and the same distance in days at the
// register's made-good. `[HC-24]`: real distances, no grid.
export function distanceNm(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export const daysToSail = (nm: number): number => nm / DAY_RUN_NM;
