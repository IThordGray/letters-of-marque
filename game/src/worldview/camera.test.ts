// The camera's arithmetic, claimed.
//
// The house rule says rendering, canvas, DOM, input, camera and the loop are not
// tested — and what that rule protects against is a claim that needs a browser
// to make. A PROJECTION IS NOT ONE OF THOSE. So the camera was split: `draw.ts`
// holds the `ctx` calls and is genuinely untestable, and everything here is a
// pure function over numbers. If a claim below could not be written, that would
// be evidence the code was in the wrong layer.
//
// [HC-26] Moving the camera across the world changes nothing about world state,
//         and §6 lists that as an acceptance criterion by name. It is asserted
//         STRUCTURALLY rather than behaviourally — `coastline.test.ts` scans the
//         source and fails if any simulation file so much as mentions
//         `worldview` — because a structural claim cannot be got round by a new
//         call site, and a behavioural one can.

import { describe, expect, it } from "vitest";
import { WORLD_BOX } from "../overworld/shape";
import {
  ZOOM,
  clampTo,
  fitScale,
  fitTo,
  inBox,
  panBy,
  pickAt,
  toScreenX,
  toScreenY,
  toWorldX,
  toWorldY,
  visibleBox,
  zoomAbout,
  type Camera,
} from "./camera";

// Off-origin and asymmetric on purpose (testing.md): a camera centred on (0,0)
// with a square canvas cannot tell "projected from the centre" from "projected
// from nowhere", and cannot tell an x term from a y term.
const CAM: Camera = { x: 620, y: 331, scale: 0.73, w: 1180, h: 705 };

describe("a chart says where a place is, and can be asked the question backwards", () => {
  it("puts a position back where it started after a round trip through the page", () => {
    // The identity that everything else on this page rests on: a click has to
    // name the same sea a dot was drawn on.
    for (const p of [
      { x: 0, y: 0 },
      { x: WORLD_BOX.widthNm, y: WORLD_BOX.heightNm },
      { x: 137.25, y: 611.5 },
      { x: 1499.999, y: 0.001 },
      { x: -220, y: 940 }, // off the chart entirely — still has to round-trip
    ]) {
      const back = { x: toWorldX(CAM, toScreenX(CAM, p.x)), y: toWorldY(CAM, toScreenY(CAM, p.y)) };
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it("round-trips at every zoom the chart allows, not merely at the one it opens on", () => {
    const base = fitScale(CAM.w, CAM.h, WORLD_BOX.widthNm, WORLD_BOX.heightNm, 26);
    for (const mult of [1, 1.15, 2.3, 5, ZOOM.maxIn]) {
      const cam = { ...CAM, scale: base * mult };
      for (const px of [0, 17, 590.5, CAM.w]) {
        expect(toScreenX(cam, toWorldX(cam, px))).toBeCloseTo(px, 8);
      }
    }
  });

  it("separates the two axes: a camera moved north does not slide the chart east", () => {
    const moved: Camera = { ...CAM, y: CAM.y + 100 };
    expect(toScreenX(moved, 400)).toBe(toScreenX(CAM, 400));
    expect(toScreenY(moved, 400)).not.toBe(toScreenY(CAM, 400));
  });
});

describe("the whole sea fits on the page before anyone touches it", () => {
  it("shows both corners of the world with the margin it was asked for", () => {
    const pad = 26;
    const cam = fitTo(CAM.w, CAM.h, WORLD_BOX.widthNm, WORLD_BOX.heightNm, pad);
    expect(toScreenX(cam, 0)).toBeGreaterThanOrEqual(pad - 1e-9);
    expect(toScreenY(cam, 0)).toBeGreaterThanOrEqual(pad - 1e-9);
    expect(toScreenX(cam, WORLD_BOX.widthNm)).toBeLessThanOrEqual(cam.w - pad + 1e-9);
    expect(toScreenY(cam, WORLD_BOX.heightNm)).toBeLessThanOrEqual(cam.h - pad + 1e-9);
  });

  it("fits the axis that binds, and this sea is wider than it is tall", () => {
    // 1500 x 800 nm on a 16:9 canvas: width is the constraint, and the fit must
    // pick the SMALLER of the two ratios or half the sea falls off the page.
    const cam = fitTo(1180, 705, WORLD_BOX.widthNm, WORLD_BOX.heightNm, 26);
    expect(cam.scale).toBeCloseTo((1180 - 52) / WORLD_BOX.widthNm, 12);
  });
});

describe("zooming looks closer at one place rather than jumping to another", () => {
  it("leaves the sea under the cursor under the cursor", () => {
    // The invariant is the whole of what a zoom-about-a-point IS, and it is
    // derived rather than nudged, so it holds to the bit.
    for (const at of [
      { px: 0, py: 0 },
      { px: 311, py: 88 },
      { px: CAM.w, py: CAM.h },
    ]) {
      const under = { x: toWorldX(CAM, at.px), y: toWorldY(CAM, at.py) };
      for (const f of [ZOOM.step, 1 / ZOOM.step, 4, 0.25]) {
        const next = zoomAbout(CAM, at.px, at.py, f);
        expect(toWorldX(next, at.px)).toBeCloseTo(under.x, 9);
        expect(toWorldY(next, at.py)).toBeCloseTo(under.y, 9);
        expect(next.scale).toBeCloseTo(CAM.scale * f, 12);
      }
    }
  });

  it("does not quietly move the chart when the factor is one", () => {
    const same = zoomAbout(CAM, 400, 200, 1);
    expect(same.x).toBeCloseTo(CAM.x, 9);
    expect(same.y).toBeCloseTo(CAM.y, 9);
  });
});

describe("dragging the chart moves the sea with the hand, not against it", () => {
  it("moves a port right when the chart is dragged right", () => {
    const before = toScreenX(CAM, 700);
    const after = toScreenX(panBy(CAM, 120, 0), 700);
    expect(after - before).toBeCloseTo(120, 9);
  });

  it("moves it by the pixels dragged, whatever the zoom", () => {
    for (const scale of [0.2, 0.73, 4.1]) {
      const cam = { ...CAM, scale };
      expect(toScreenY(panBy(cam, 0, -47), 300) - toScreenY(cam, 300)).toBeCloseTo(-47, 9);
    }
  });
});

describe("the chart cannot be pushed off the edge of its own sea", () => {
  const min = fitScale(CAM.w, CAM.h, WORLD_BOX.widthNm, WORLD_BOX.heightNm, 26);

  it("refuses to zoom further out than the whole world", () => {
    const out = clampTo({ ...CAM, scale: min * 0.1 }, WORLD_BOX.widthNm, WORLD_BOX.heightNm, min);
    expect(out.scale).toBeCloseTo(min, 12);
  });

  it("refuses to zoom in past the resolution the coast was baked at", () => {
    const deep = clampTo({ ...CAM, scale: min * 400 }, WORLD_BOX.widthNm, WORLD_BOX.heightNm, min);
    expect(deep.scale).toBeCloseTo(min * ZOOM.maxIn, 12);
  });

  it("keeps water on every side of the page once there is water to keep", () => {
    const zoomed = clampTo({ ...CAM, x: -9000, y: 9000, scale: min * 4 }, WORLD_BOX.widthNm, WORLD_BOX.heightNm, min);
    expect(toWorldX(zoomed, 0)).toBeGreaterThanOrEqual(-1e-9);
    expect(toWorldX(zoomed, zoomed.w)).toBeLessThanOrEqual(WORLD_BOX.widthNm + 1e-9);
    expect(toWorldY(zoomed, 0)).toBeGreaterThanOrEqual(-1e-9);
    expect(toWorldY(zoomed, zoomed.h)).toBeLessThanOrEqual(WORLD_BOX.heightNm + 1e-9);
  });

  it("centres an axis that already fits rather than sliding along it", () => {
    // At the whole-world fit the sea is narrower than the canvas on one axis,
    // and there is no range left to clamp within — so it is centred, and a
    // dragged camera springs back rather than drifting.
    const fitted = clampTo({ ...CAM, x: 40, y: 40, scale: min }, WORLD_BOX.widthNm, WORLD_BOX.heightNm, min);
    expect(fitted.y).toBeCloseTo(WORLD_BOX.heightNm * 0.5, 9);
  });
});

describe("what is worth drawing is a question about the page, never about the world", () => {
  it("names the water the canvas is showing, with a margin for a mark half off it", () => {
    const b = visibleBox(CAM, 40);
    expect(b.x0).toBeCloseTo(toWorldX(CAM, 0) - 40, 9);
    expect(b.x1).toBeCloseTo(toWorldX(CAM, CAM.w) + 40, 9);
    expect(inBox(b, CAM.x, CAM.y)).toBe(true);
    expect(inBox(b, CAM.x - 4000, CAM.y)).toBe(false);
  });
});

describe("a click names the port that is under it", () => {
  // THE FIXTURE HAS TO BE ABLE TO TELL THE CASES APART, which is the whole
  // reason it is built at this scale rather than at a convenient one. The siting
  // rule puts ports 85 nm apart (`SITING.minSpacingNm`), and on a small window —
  // 0.37 px per nm — that is thirty-one pixels, which is LESS than two city
  // marks plus the slop a mouse is allowed. So overlapping marks are ordinary,
  // not exotic, and a fixture whose ports never overlap could not tell
  // "nearest wins" from "last one wins" at all.
  //
  // Off-origin and asymmetric: two neighbours on one coast and a third far off,
  // with three different mark sizes.
  const xs = new Float64Array([400, 485, 900]);
  const ys = new Float64Array([300, 300, 120]);
  const radii = new Float64Array([16, 16, 5]);
  const cam: Camera = { x: 700, y: 300, scale: 0.37, w: 900, h: 500 };

  it("picks nothing where there is nothing but sea", () => {
    expect(pickAt(cam, 10, 10, xs, ys, radii, 3)).toBe(-1);
  });

  it("picks the port the cursor is actually over", () => {
    expect(pickAt(cam, toScreenX(cam, 900), toScreenY(cam, 120), xs, ys, radii, 3)).toBe(2);
  });

  it("picks the nearer of two ports whose marks overlap, not the last one listed", () => {
    // A click in the gap between two neighbours, closer to the first. Both marks
    // cover it; only one of them is the one the eye would have picked.
    const gapPx = (485 - 400) * cam.scale; // ~31 px
    const px = toScreenX(cam, 400) + gapPx * 0.42;
    const py = toScreenY(cam, 300);
    expect(px - toScreenX(cam, 400)).toBeLessThan(radii[0] + ZOOM.pickSlopPx);
    expect(toScreenX(cam, 485) - px).toBeLessThan(radii[1] + ZOOM.pickSlopPx);
    expect(pickAt(cam, px, py, xs, ys, radii, 3)).toBe(0);
  });

  it("picks the other one from the other side of the same gap", () => {
    const gapPx = (485 - 400) * cam.scale;
    const px = toScreenX(cam, 400) + gapPx * 0.58;
    expect(pickAt(cam, px, toScreenY(cam, 300), xs, ys, radii, 3)).toBe(1);
  });

  it("allows for a mouse, but not for a mouse in the next county", () => {
    const px = toScreenX(cam, 900) + radii[2] + ZOOM.pickSlopPx - 1;
    expect(pickAt(cam, px, toScreenY(cam, 120), xs, ys, radii, 3)).toBe(2);
    const far = toScreenX(cam, 900) + radii[2] + ZOOM.pickSlopPx + 2;
    expect(pickAt(cam, far, toScreenY(cam, 120), xs, ys, radii, 3)).toBe(-1);
  });
});
