import type { World } from "./world";
import { MOVE } from "./constants";

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
