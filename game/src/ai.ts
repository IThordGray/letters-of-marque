import type { World } from "./world";
import { AI } from "./constants";

// Baseline enemy AI: every so often, order each fighting enemy to attack-move toward
// the player's centre of mass. Movement's attack-move logic does the rest — advance,
// then auto-engage anything met on the way. Deliberately simple; faction-flavoured
// tactics are a later story (see KAN-28).
export function stepAI(world: World) {
  if (world.over || world.time < world.aiNextAt) return;
  world.aiNextAt = world.time + AI.decisionInterval;

  // the player's living centre of mass
  let px = 0;
  let py = 0;
  let n = 0;
  for (const u of world.units) {
    if (u.side === "player" && u.state !== "down") {
      px += u.x;
      py += u.y;
      n++;
    }
  }
  if (n === 0) return;
  px /= n;
  py /= n;

  for (const e of world.units) {
    if (e.side !== "enemy" || e.state === "down" || e.state === "routing") continue;
    e.moveTarget = { x: px, y: py };
    e.attackMove = true;
    e.attackTargetId = null;
  }
}
