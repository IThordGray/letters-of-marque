// The camera — and the whole of it is arithmetic, deliberately.
//
// [HC-26] Ring boundaries live in the simulation, not in the camera. Looking
//         somewhere must not change what exists there.
// [P-19]  Coarsen simulation detail only on criteria derived from simulation
//         state — never on the camera, the player's attention, or the speed
//         setting. An LOD keyed on where someone is looking destroys bit
//         identity by construction.
//
// THE STRUCTURAL FORM OF BOTH RULES, and the reason this file has no imports
// from `overworld/` at all: **nothing here is ever passed to the simulation, and
// nothing here is given a world to pass.** A `Camera` is five numbers over a
// canvas; the only thing it can do with a place is convert its position into a
// pixel. It cannot ask the world a question, so looking cannot change an answer.
// [P-17b] — enforce a "must not read X" with a signature that is not given X —
// applied to a module rather than to a function. The companion source scan in
// `coastline.test.ts` asserts the other direction: no simulation file may so
// much as mention `worldview`.
//
// It is also why the interesting half of a view can be tested at all. The house
// rule is that rendering, canvas, DOM, input, camera and the loop are not
// tested — and what that rule is really protecting against is a claim that needs
// a browser to make. A projection is not one of those. Everything below is a
// pure function over plain numbers, so the round trip, the zoom and the hit test
// are all claims, and the part that genuinely cannot be tested is reduced to
// `ctx` calls in `draw.ts`.
//
// [P-5]/[P-7] No trigonometry anywhere. A pan is a translation and a zoom is a
// scale; an axis-aligned chart needs no angle, and the `worldview/` source scan
// bans the approximated `Math` functions here exactly as it does in the sim.

export interface Camera {
  // The world point sitting at the centre of the canvas, in nautical miles.
  x: number;
  y: number;
  // Pixels per nautical mile. The only scale there is — the sea is measured in
  // nm and nothing downstream ever sees a cell or a tile ([HC-24]).
  scale: number;
  // The canvas, in CSS pixels.
  w: number;
  h: number;
}

export const ZOOM = {
  // How far in the chart may be pushed past the whole-world fit. The coast is
  // baked at 2 nm (`coastline.ts` CHART.stepNm), which at the fit scale is about
  // two pixels a vertex and at 10x is twenty — the point at which it starts to
  // read as a polygon rather than a coast, and therefore the honest limit until
  // somebody bakes the visible box finer.
  maxIn: 10,
  // ...and never further out than the whole sea, because there is nothing there.
  maxOut: 1,
  // One notch of the wheel.
  step: 1.15,
  // How far off a mark a click still counts, in pixels. A settlement's dot is
  // small and a mouse is not precise.
  pickSlopPx: 6,
} as const;

// ---- The projection --------------------------------------------------------
//
// Four one-liners, and they are exact inverses of each other by construction:
// each is the other's arithmetic read backwards, with no second constant and no
// rounding in between ([P-47] — one definition of where a place is on the page).

export const toScreenX = (c: Camera, xNm: number): number => (xNm - c.x) * c.scale + c.w * 0.5;
export const toScreenY = (c: Camera, yNm: number): number => (yNm - c.y) * c.scale + c.h * 0.5;
export const toWorldX = (c: Camera, px: number): number => (px - c.w * 0.5) / c.scale + c.x;
export const toWorldY = (c: Camera, py: number): number => (py - c.h * 0.5) / c.scale + c.y;

// ---- Fitting, panning, zooming ---------------------------------------------

// The scale at which the whole sea is on the page with a margin round it. This
// is also the zoom floor: there is no chart outside the chart.
export function fitScale(w: number, h: number, widthNm: number, heightNm: number, padPx: number): number {
  const usableW = w - padPx * 2;
  const usableH = h - padPx * 2;
  const sx = usableW > 0 && widthNm > 0 ? usableW / widthNm : 1;
  const sy = usableH > 0 && heightNm > 0 ? usableH / heightNm : 1;
  return sx < sy ? sx : sy;
}

export function fitTo(w: number, h: number, widthNm: number, heightNm: number, padPx: number): Camera {
  return { x: widthNm * 0.5, y: heightNm * 0.5, scale: fitScale(w, h, widthNm, heightNm, padPx), w, h };
}

// Dragging the chart right moves the sea right, which means the camera's centre
// moves LEFT. Stated as arithmetic rather than as a convention, because the sign
// of a drag is the single thing about a pan that is worth a test.
export const panBy = (c: Camera, dxPx: number, dyPx: number): Camera => ({
  x: c.x - dxPx / c.scale,
  y: c.y - dyPx / c.scale,
  scale: c.scale,
  w: c.w,
  h: c.h,
});

// Zoom about a pixel — the world point under the cursor stays under the cursor.
// Derived rather than nudged: solve `toWorldX(next, px) === toWorldX(c, px)` for
// the new centre and there is exactly one answer, so the invariant holds to the
// bit rather than to a tolerance anyone has to maintain.
export function zoomAbout(c: Camera, px: number, py: number, factor: number): Camera {
  const wx = toWorldX(c, px);
  const wy = toWorldY(c, py);
  const scale = c.scale * factor;
  return {
    x: wx - (px - c.w * 0.5) / scale,
    y: wy - (py - c.h * 0.5) / scale,
    scale,
    w: c.w,
    h: c.h,
  };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Keep the sea on the page: never further out than the fit, never so far over
// that the chart shows more edge than water. An axis whose whole extent already
// fits inside the canvas is centred rather than clamped, because there is no
// range left to slide along.
export function clampTo(c: Camera, widthNm: number, heightNm: number, minScale: number): Camera {
  const scale = clamp(c.scale, minScale, minScale * ZOOM.maxIn);
  const halfW = c.w / (2 * scale);
  const halfH = c.h / (2 * scale);
  return {
    x: halfW * 2 >= widthNm ? widthNm * 0.5 : clamp(c.x, halfW, widthNm - halfW),
    y: halfH * 2 >= heightNm ? heightNm * 0.5 : clamp(c.y, halfH, heightNm - halfH),
    scale,
    w: c.w,
    h: c.h,
  };
}

// ---- What is worth drawing -------------------------------------------------

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// The world rectangle the canvas is showing, in nautical miles, with a margin so
// a mark whose centre is just off-screen still draws its rim. This is a DRAWING
// cull and never a simulation one: [P-19] and [HC-12] both say the world resolves
// identically whether anyone is watching, and the only thing this may decide is
// whether a stroke is issued.
export function visibleBox(c: Camera, marginNm: number): Box {
  return {
    x0: toWorldX(c, 0) - marginNm,
    y0: toWorldY(c, 0) - marginNm,
    x1: toWorldX(c, c.w) + marginNm,
    y1: toWorldY(c, c.h) + marginNm,
  };
}

export const inBox = (b: Box, x: number, y: number): boolean => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

// ---- Picking ---------------------------------------------------------------

// Which mark a click landed on, or -1. Nearest wins where two overlap, which at
// this scale is common: the siting rule puts ports 85 nm apart and at the
// whole-world fit that is fifty pixels, so a city's mark and its neighbour's
// touch.
//
// Distances are compared SQUARED — no `Math.sqrt` in the loop, and `Math.hypot`
// is banned outright ([P-5]) — and the radius is per-mark, because a click that
// picked a hamlet over the city drawn on top of it would be a lie about what is
// on the page.
export function pickAt(
  c: Camera,
  px: number,
  py: number,
  xs: Float64Array,
  ys: Float64Array,
  radiiPx: Float64Array,
  n: number,
): number {
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const dx = toScreenX(c, xs[i]) - px;
    const dy = toScreenY(c, ys[i]) - py;
    const d2 = dx * dx + dy * dy;
    const r = radiiPx[i] + ZOOM.pickSlopPx;
    if (d2 <= r * r && d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}
