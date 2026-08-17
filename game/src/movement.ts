import type { World } from "./world";
import { MOVE, WEAPON, SEPARATION } from "./constants";
import { dist } from "./math";

// Advance units toward their orders. An explicit move order takes priority; else a
// unit ordered to attack an out-of-range foe closes to firing range (basic pursuit)
// and faces it. Pure & deterministic; dead figures are skipped. (Full attack-move /
// stances are KAN-15.)
export function stepMovement(world: World, dt: number) {
  for (const u of world.units) {
    if (u.hp <= 0) continue;

    let tx = 0;
    let ty = 0;
    let moving = false;
    let clearOnArrive = false;
    let faceX: number | null = null;
    let faceY: number | null = null;

    if (u.moveTarget) {
      tx = u.moveTarget.x;
      ty = u.moveTarget.y;
      moving = true;
      clearOnArrive = true;
    } else if (u.attackTargetId != null) {
      const t = world.units.find((x) => x.id === u.attackTargetId);
      if (!t || t.hp <= 0 || t.side === u.side) {
        u.attackTargetId = null;
      } else {
        faceX = t.x;
        faceY = t.y;
        if (dist(u.x, u.y, t.x, t.y) > WEAPON[u.weapon].rangeMax * MOVE.engageFraction) {
          tx = t.x;
          ty = t.y;
          moving = true; // close in to open fire
        }
      }
    }

    if (moving) {
      const dx = tx - u.x;
      const dy = ty - u.y;
      const d = Math.hypot(dx, dy);
      if (d <= MOVE.arriveSlack) {
        if (clearOnArrive) u.moveTarget = null;
      } else {
        u.facing = (Math.atan2(dy, dx) * 180) / Math.PI;
        const stepDist = Math.min(MOVE.speed * dt, d);
        u.x += (dx / d) * stepDist;
        u.y += (dy / d) * stepDist;
      }
    } else if (faceX !== null && faceY !== null) {
      u.facing = (Math.atan2(faceY - u.y, faceX - u.x) * 180) / Math.PI; // stand and face the foe
    }
  }
}

// Personal space: push overlapping figures apart. Position-based soft resolve —
// deterministic, tuned below formation spacing so it only fixes real overlap. O(n²)
// for now; a spatial grid comes when counts justify it.
export function stepSeparation(world: World) {
  const us = world.units;
  const rad = SEPARATION.radius;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (b.hp <= 0) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d >= rad) continue;
      if (d < 0.001) {
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
