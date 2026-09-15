// The chart, on a canvas. This is the part the house rule says is not tested —
// "rendering, canvas, DOM, input, camera and the loop are NOT tested" — so it
// has been squeezed until there is nothing left in it but `ctx` calls. Every
// decision worth a claim happens somewhere else: the projection in `camera.ts`,
// the snapshot in `run.ts`, the geometry in `coastline.ts`. If something here
// looks like it wants a test, it is in the wrong file.
//
// WHY CANVAS AND NOT SVG, since the town module is SVG-as-strings. The town's
// page redraws when you press a button; this one runs continuously. Handing
// `innerHTML` a fresh document sixty times a second is not a rendering strategy
// — the parse alone costs more than the whole frame budget — and
// `solution-architecture.md` already says `game/` is TypeScript on a canvas. The
// consequence is accepted rather than worked around: a canvas has no classes, so
// the palette is a data table (`palette.ts`, [HC-90]) instead of a stylesheet.
//
// [P-17c] THE COAST IS BAKED ONCE AND NEVER RE-SAMPLED. `bakeCoast` gives
//        vertices in nautical miles; those go into ONE `Path2D`, built once, in
//        world coordinates. A frame sets the transform and fills it. There is no
//        per-frame geometry at all: no re-contouring, no re-projection, no
//        vertex loop. That is the entire reason `coastline.ts` exists.
// [P-19] Nothing here coarsens anything on the camera. The cull below decides
//        whether a STROKE is issued and never what is true — [HC-12], the world
//        resolves identically whether anyone is watching.
// [P-5]  No approximated maths. The `worldview/` source scan enforces the same
//        banned list here as the simulation's does there, minus `performance.now`
//        — so there is no trigonometry in this file, and none is needed: a chart
//        is axis-aligned, a dot is `arc`, and a heading is a stored unit vector
//        ([P-17a]).

import { radiusOf, type Storm } from "../overworld/weather";
import { positionOf, type Dispatch } from "../overworld/dispatch";
import { CLIMATES, zoneAt } from "../overworld/climate";
import type { World } from "../overworld/clock";
import { inBox, toScreenX, toScreenY, visibleBox, type Camera } from "./camera";
import type { Coast } from "./coastline";
import { BAND_INK, DISPATCH_INK, HURT_INK, INK, STORM_INK, factionInk, washFor } from "./palette";
import { SCAR, dispatchesOf, type PlaceView, type Run } from "./run";

// ---- What a place looks like -----------------------------------------------

export const MARK = {
  // A dot's AREA reads population, so its radius goes as the square root — which
  // is the only honest way to draw a quantity as a blob, and `sqrt` is on [P-7]'s
  // exactly-specified list where `pow` is banned.
  minPx: 2.6,
  perSqrtSoul: 0.42,
  maxPx: 16,
  // The class rim: a settlement wears none, a town a thin one, a city a heavy
  // one. [HC-69] wants class legible from the sea, and a rim reads at a glance
  // where a third colour would not.
  rimPx: [0, 1.2, 2.4],
  // The felt-severity ring sits outside the mark, so it never hides it.
  ringGapPx: 3,
  ringWidthPx: 2.2,
  // The scar, when the sea actually took something.
  scarPx: 3.2,
  labelAtScale: 0.55, // px per nm — below this, names would be a grey smear
} as const;

export const radiusFor = (people: number): number => {
  const r = MARK.minPx + Math.sqrt(people > 0 ? people : 0) * MARK.perSqrtSoul;
  return r > MARK.maxPx ? MARK.maxPx : r;
};

// ---- The coast, baked into one path ----------------------------------------
//
// Built from the bake exactly once. Coordinates stay in nautical miles and the
// canvas transform does the projection, so panning and zooming cost a matrix
// rather than 1,928 vertices.
export interface Chart {
  land: Path2D;
  wash: HTMLCanvasElement | null;
}

export function makeChart(world: World, coast: Coast): Chart {
  const land = new Path2D();
  for (let i = 0; i < coast.lines.length; i++) {
    const pts = coast.lines[i].pts;
    if (pts.length < 4) continue;
    land.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) land.lineTo(pts[k], pts[k + 1]);
    if (coast.lines[i].closed) land.closePath();
  }
  return { land, wash: makeWash(world) };
}

// The climate wash — a BACKGROUND TINT, and never a boundary ([HC-23]'s zones
// are Voronoi over a handful of seats, so a boundary would mean contouring a
// second field for a fact the tint already carries). Baked into a small image at
// startup: 180 x 96 cells against eight seats is fifteen thousand distance
// tests, paid once, and a frame then costs one `drawImage`.
//
// It is also the only thing on the page that says the sea has a geography of its
// own — [HC-29], a coast's exposure is a property of the map.
const WASH = { cols: 180, rows: 96 } as const;

function makeWash(world: World): HTMLCanvasElement | null {
  if (world.zones.length === 0) return null;
  const c = document.createElement("canvas");
  c.width = WASH.cols;
  c.height = WASH.rows;
  const g = c.getContext("2d");
  if (!g) return null;
  for (let j = 0; j < WASH.rows; j++) {
    const y = ((j + 0.5) / WASH.rows) * world.shape.heightNm;
    for (let i = 0; i < WASH.cols; i++) {
      const x = ((i + 0.5) / WASH.cols) * world.shape.widthNm;
      g.fillStyle = washFor(CLIMATES[world.zones[zoneAt(world.zones, x, y)].climate].name);
      g.fillRect(i, j, 1, 1);
    }
  }
  return c;
}

// ---- One frame -------------------------------------------------------------

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  run: Run,
  chart: Chart,
  dpr: number,
): void {
  const world = run.world;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK.page;
  ctx.fillRect(0, 0, cam.w, cam.h);

  // The world-space transform: one matrix, and everything below is drawn in
  // nautical miles. `tx` is what `toScreenX` says, written as a matrix.
  const s = cam.scale * dpr;
  ctx.setTransform(s, 0, 0, s, (cam.w * 0.5 - cam.x * cam.scale) * dpr, (cam.h * 0.5 - cam.y * cam.scale) * dpr);

  // Sea, then the climate wash over it, then land.
  ctx.fillStyle = INK.sea;
  ctx.fillRect(0, 0, world.shape.widthNm, world.shape.heightNm);
  if (chart.wash) {
    ctx.globalAlpha = 0.85;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(chart.wash, 0, 0, world.shape.widthNm, world.shape.heightNm);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = INK.land;
  ctx.fill(chart.land, "evenodd");
  ctx.strokeStyle = INK.coast;
  ctx.lineWidth = 1 / cam.scale;
  ctx.stroke(chart.land);

  // WEATHER IS CLIPPED TO THE SEA, and the reason is worth stating because it
  // looks like a cosmetic choice and is not. Events form up to 300 nm off their
  // zone's seat and stray 420 nm past the box before they are somebody else's
  // ([HC-31], `STORM.formJitterNm` / `strayNm`), so a live system's CENTRE is
  // regularly outside the world — which is true of the world and not a thing a
  // chart of this sea has anywhere to put. Clipped, the same storm reads as
  // weather coming in off the edge, which is what it is. Nothing is culled and
  // nothing about the event changes: [HC-12], the world resolves identically
  // whether anyone is watching, and this decides only where ink goes.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, world.shape.widthNm, world.shape.heightNm);
  ctx.clip();
  drawStorms(ctx, run, cam);
  ctx.restore();

  // Back to screen space for everything that has a size in pixels rather than in
  // miles — a dot that grew when you zoomed in would be drawing the camera.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawDispatches(ctx, cam, run);
  drawPlaces(ctx, cam, run);
}

// ---- Storms ----------------------------------------------------------------
//
// Drawn in world space, because a storm's footprint is a real distance: `STORM`
// puts it between 90 and 260 nm and `radiusOf` derives it from severity, so a
// squall really is small and a hurricane really does cover four ports.
function drawStorms(ctx: CanvasRenderingContext2D, run: Run, cam: Camera): void {
  const storms = run.world.storms;
  if (storms.length === 0) return;
  // NOT CULLED, deliberately. There are only ever a handful of live events
  // ([HC-31]); a storm's footprint reaches 260 nm, so its centre is regularly
  // off the page while its edge is very much on it; and the canvas clips for
  // free. A cull here would be four comparisons buying nothing and getting the
  // margin wrong — which is exactly what it did on the first pass, where the
  // sidebar could describe a tempest the chart would not draw ([P-1]).
  for (let i = 0; i < storms.length; i++) {
    const st: Storm = storms[i];
    const r = radiusOf(st);
    ctx.beginPath();
    ctx.arc(st.x, st.y, r, 0, TAU);
    ctx.fillStyle = STORM_INK.rim;
    ctx.fill();
    // The footprint's edge. [HC-32] makes the fall-off smooth on purpose, and a
    // smooth wash over a climate tint has no edge for an eye to catch on.
    ctx.strokeStyle = STORM_INK.rimEdge;
    ctx.lineWidth = 1.5 / cam.scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(st.x, st.y, r * 0.55, 0, TAU);
    ctx.fillStyle = STORM_INK.core;
    ctx.fill();
    // The track, as a stored unit vector and never an angle ([P-17a]). A day's
    // run of it, so which way it is going is visible without animation.
    ctx.beginPath();
    ctx.moveTo(st.x, st.y);
    ctx.lineTo(st.x + st.dx * r * 0.9, st.y + st.dy * r * 0.9);
    ctx.strokeStyle = STORM_INK.track;
    ctx.lineWidth = 2.5 / cam.scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(st.x, st.y, 4 / cam.scale, 0, TAU);
    ctx.fillStyle = STORM_INK.eye;
    ctx.fill();
  }
}

const TAU = 6.283185307179586;

// ---- The four war-currencies -----------------------------------------------
//
// [P-16]: a dispatch has no present. Its whole movement is a departure and an
// arrival, and `positionOf` derives where it is from the day — nothing is stored
// and nothing is stepped.
//
// NOTHING SENDS ONE YET. Nations acting is KAN-101, so this loop runs zero times
// for the whole of this milestone, every day of it. It is here because the seam
// costs nothing and because it is how the day nations start acting will announce
// itself on the chart: the first sail to cross this sea will simply appear.
function drawDispatches(ctx: CanvasRenderingContext2D, cam: Camera, run: Run): void {
  // One definition of "what is at sea", and it is the simulation's ([P-47]).
  const flying: Dispatch[] = dispatchesOf(run);
  if (flying.length === 0) return;
  const day = run.world.day;
  for (let i = 0; i < flying.length; i++) {
    const d = flying[i];
    const at = positionOf(d, day);
    ctx.beginPath();
    ctx.moveTo(toScreenX(cam, d.fromX), toScreenY(cam, d.fromY));
    ctx.lineTo(toScreenX(cam, d.toX), toScreenY(cam, d.toY));
    ctx.strokeStyle = DISPATCH_INK.wake;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(toScreenX(cam, at.x), toScreenY(cam, at.y), 3, 0, TAU);
    ctx.fillStyle = DISPATCH_INK.hull;
    ctx.fill();
  }
}

// ---- The fifty -------------------------------------------------------------
//
// Three axes and a quantity on one mark ([HC-69]): SHAPE is purpose, COLOUR is
// faction, the RIM is size class, and the AREA is the people. Then two things
// about the weather that a storm blob cannot say on its own — what this
// particular place FELT, and whether it actually lost anything.
function drawPlaces(ctx: CanvasRenderingContext2D, cam: Camera, run: Run): void {
  const box = visibleBox(cam, 40);
  const labels = cam.scale >= MARK.labelAtScale;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < run.places.length; i++) {
    const p = run.places[i];
    if (!inBox(box, p.x, p.y)) continue;
    const px = toScreenX(cam, p.x);
    const py = toScreenY(cam, p.y);
    const r = radiusFor(p.people);

    // What this place felt today, as a ring of its own. [HC-32] is the whole
    // reason it is drawn per place: the storm blob says where the weather is,
    // and this says what it is worth HERE — two towns twenty miles apart under
    // one storm wear different rings, which is the point.
    if (p.band > 0) {
      ctx.beginPath();
      ctx.arc(px, py, r + MARK.ringGapPx, 0, TAU);
      ctx.strokeStyle = BAND_INK[p.band];
      ctx.lineWidth = MARK.ringWidthPx * (0.6 + p.band * 0.35);
      ctx.stroke();
    }

    ctx.strokeStyle = INK.halo;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = factionInk(p.faction);
    markPath(ctx, p, px, py, r);
    ctx.fill();
    ctx.stroke();

    const rim = MARK.rimPx[p.sizeRank];
    if (rim > 0) {
      ctx.strokeStyle = INK.text;
      ctx.lineWidth = rim;
      markPath(ctx, p, px, py, r + rim);
      ctx.stroke();
    }

    if (run.selected === p.id) {
      ctx.beginPath();
      ctx.arc(px, py, r + MARK.ringGapPx + 5, 0, TAU);
      ctx.strokeStyle = INK.select;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // The scar: a work dropped a rung, or was taken outright. It fades over a
    // season rather than blinking, so a century at Century speed reads as a
    // coast being worn down rather than as a string of flashes.
    const age = run.world.day - p.hurtDay;
    if (p.hurtDay >= 0 && age <= SCAR.days) {
      ctx.globalAlpha = 1 - age / SCAR.days;
      ctx.beginPath();
      ctx.arc(px + r + 2, py - r - 2, MARK.scarPx, 0, TAU);
      ctx.fillStyle = p.hurtKind === 2 ? HURT_INK.work : HURT_INK.grade;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (labels && p.sizeRank > 0) {
      ctx.font = `${p.sizeRank === 2 ? 12 : 10}px ui-monospace, Consolas, monospace`;
      ctx.fillStyle = p.sizeRank === 2 ? INK.accent : INK.dim;
      ctx.fillText(p.name, px, py + r + 10);
    }
  }
}

// Purpose, as a shape. Civilian is a disc, trade a diamond, military a square —
// three silhouettes a person can tell apart at four pixels, which colour alone
// cannot do when colour is already carrying the faction.
function markPath(ctx: CanvasRenderingContext2D, p: PlaceView, px: number, py: number, r: number): void {
  ctx.beginPath();
  if (p.purpose === "military") {
    ctx.rect(px - r, py - r, r * 2, r * 2);
  } else if (p.purpose === "trade") {
    const d = r * 1.3;
    ctx.moveTo(px, py - d);
    ctx.lineTo(px + d, py);
    ctx.lineTo(px, py + d);
    ctx.lineTo(px - d, py);
    ctx.closePath();
  } else {
    ctx.arc(px, py, r, 0, TAU);
  }
}

// ---- The trend line --------------------------------------------------------
//
// Redrawn when a sample lands — once a simulated year — and not on the frame.
export function drawTrend(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  days: number[],
  series: { values: number[]; ink: string; width: number }[],
  grid: string,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padL = 6;
  const padR = 6;
  const padT = 8;
  const padB = 8;
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const y = padT + ((h - padT - padB) * k) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }
  const n = days.length;
  if (n < 2) return;
  const d0 = days[0];
  const d1 = days[n - 1];
  const spanDays = d1 - d0 > 0 ? d1 - d0 : 1;

  for (let s = 0; s < series.length; s++) {
    const v = series[s].values;
    let top = 0;
    for (let i = 0; i < n; i++) if (v[i] > top) top = v[i];
    if (top <= 0) continue;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padL + ((days[i] - d0) / spanDays) * (w - padL - padR);
      const y = h - padB - (v[i] / top) * (h - padT - padB);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = series[s].ink;
    ctx.lineWidth = series[s].width;
    ctx.stroke();
  }
}
