import type { Wind } from "./types";
import { WIND, POLAR, SAIL } from "./constants";
import { normalizeAngle, angleDiff, sampleCurve } from "./math";

export function makeWind(): Wind {
  const toward = normalizeAngle(WIND.baseToward);
  return { t: 0, toward, from: normalizeAngle(toward + 180) };
}

// Continuous smooth drift: base ± 40° driven by two out-of-phase sines so there
// are no discrete shift events (§5). No wind-strength variation.
export function stepWind(w: Wind, dt: number) {
  w.t += dt;
  const a = Math.sin((w.t / WIND.driftPeriodA) * Math.PI * 2);
  const b = Math.sin((w.t / WIND.driftPeriodB) * Math.PI * 2 + 1.7);
  const n = (1 - WIND.driftMixB) * a + WIND.driftMixB * b;
  w.toward = normalizeAngle(WIND.baseToward + WIND.driftAmplitude * n);
  w.from = normalizeAngle(w.toward + 180);
}

// Angle of a heading off the wind, 0..180. 0 = bow pointed straight into the
// wind (no-go), 180 = running dead downwind.
export function angleOffWind(heading: number, w: Wind): number {
  return Math.abs(angleDiff(heading, w.from));
}

// Signed heading relative to the eye of the wind, (-180, 180]. Used to detect
// crossing the eye (a tack) versus crossing downwind (a wear).
export function relToEye(heading: number, w: Wind): number {
  return angleDiff(w.from, heading);
}

export function pointOfSailMultiplier(heading: number, w: Wind): number {
  return sampleCurve(POLAR, angleOffWind(heading, w));
}

// A ship can't sail straight into the no-go zone. If its GOAL heading lies in
// there, resolve to a close-hauled beat on one tack; it holds that tack until
// the goal is clearly on the other side, which then forces a tack across the
// eye (§5). `currentHeading` provides the hysteresis so it doesn't flip-flop.
export function sailableHeading(currentHeading: number, goal: number, w: Wind): number {
  if (angleOffWind(goal, w) >= SAIL.noGoHalfAngle) return goal; // already sailable

  const goalRel = angleDiff(w.from, goal); // signed; small when goal is upwind
  const curRel = relToEye(currentHeading, w);
  let side = Math.sign(curRel) || 1; // keep the current tack by default
  if (Math.sign(goalRel) !== 0 && Math.sign(goalRel) !== side && Math.abs(goalRel) > SAIL.tackHysteresis) {
    side = Math.sign(goalRel); // goal is decisively on the other tack — come about
  }
  return normalizeAngle(w.from + side * SAIL.beatAngle);
}
