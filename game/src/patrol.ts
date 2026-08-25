import type { World } from "./world";

// Patrols walk their waypoint route while the town is dormant (alarm 0). Once the alarm is
// raised the AI takes them over — they stop patrolling and converge on the raiders. Pure
// and deterministic; run before movement so the walk orders take effect this tick.
export function stepPatrol(world: World) {
  if (world.over || world.raid.alarm > 0) return;
  for (const p of world.patrols) {
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const id of p.members) {
      const u = world.units.find((x) => x.id === id);
      if (u && u.state !== "down") {
        cx += u.x;
        cy += u.y;
        n++;
      }
    }
    if (n === 0) continue;
    cx /= n;
    cy /= n;
    const wp = p.route[p.idx];
    if (Math.hypot(wp.x - cx, wp.y - cy) < 40) p.idx = (p.idx + 1) % p.route.length;
    const target = p.route[p.idx];
    for (const id of p.members) {
      const u = world.units.find((x) => x.id === id);
      if (u && u.state !== "down") {
        u.moveTarget = { x: target.x, y: target.y };
        u.attackMove = false;
      }
    }
  }
}
