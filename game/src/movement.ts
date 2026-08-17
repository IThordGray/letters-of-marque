import type { World } from "./world";
import { MOVE, SEPARATION } from "./constants";

// Advance every unit that has a move order toward its target, turning to face
// travel and stopping on arrival. A pure system — deterministic given dt, so it's
// headless-testable and never depends on the camera or the frame rate.
export function stepMovement(world: World, dt: number) {
  for (const u of world.units) {
    if (!u.moveTarget) continue;
    const dx = u.moveTarget.x - u.x;
    const dy = u.moveTarget.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= MOVE.arriveSlack) {
      u.moveTarget = null;
      continue;
    }
    u.facing = (Math.atan2(dy, dx) * 180) / Math.PI;
    const stepDist = Math.min(MOVE.speed * dt, d);
    u.x += (dx / d) * stepDist;
    u.y += (dy / d) * stepDist;
  }
}

// Personal space: push overlapping figures apart. Position-based soft resolve —
// deterministic, and tuned (SEPARATION.radius < formation spacing) so it only
// fixes real overlap and never fights a formation. O(n²) for now; a spatial grid
// comes when counts justify it.
export function stepSeparation(world: World) {
  const us = world.units;
  const rad = SEPARATION.radius;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d >= rad) continue;
      if (d < 0.001) {
        // exactly coincident — nudge apart deterministically
        a.x += 0.5;
        b.x -= 0.5;
        continue;
      }
      const push = (rad - d) * 0.5;
      const ux = dx / d;
      const uy = dy / d;
      a.x += ux * push;
      a.y += uy * push;
      b.x -= ux * push;
      b.y -= uy * push;
    }
  }
}
