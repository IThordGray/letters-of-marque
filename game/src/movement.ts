import type { World } from "./world";
import { MOVE, WEAPON, SEPARATION, WORLD } from "./constants";
import { dist } from "./math";
import { signal } from "./log";
import { desc } from "./naming";

// Advance units toward their orders. Routers flee their own edge and ignore orders;
// a wavering figure drags its feet; an explicit move takes priority; else a unit
// ordered to attack an out-of-range foe closes to firing range and faces it. Pure &
// deterministic; the down are skipped.
export function stepMovement(world: World, dt: number) {
  for (const u of world.units) {
    if (u.state === "down") continue;

    let tx = 0;
    let ty = 0;
    let moving = false;
    let clearOnArrive = false;
    let faceX: number | null = null;
    let faceY: number | null = null;

    if (u.state === "routing") {
      // break for your own edge, deaf to orders
      tx = u.x;
      ty = u.side === "player" ? WORLD.height + 60 : -60;
      moving = true;
    } else if (u.moveTarget) {
      tx = u.moveTarget.x;
      ty = u.moveTarget.y;
      moving = true;
      clearOnArrive = true;
    } else if (u.attackTargetId != null) {
      const t = world.units.find((x) => x.id === u.attackTargetId);
      if (!t || t.state === "down" || t.side === u.side) {
        u.attackTargetId = null;
      } else {
        faceX = t.x;
        faceY = t.y;
        if (dist(u.x, u.y, t.x, t.y) > WEAPON[u.weapon].rangeMax * MOVE.engageFraction) {
          tx = t.x;
          ty = t.y;
          moving = true;
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
        const mult = u.state === "routing" ? MOVE.routSpeedMult : u.state === "wavering" ? MOVE.waverSpeedMult : 1;
        const step = Math.min(MOVE.speed * mult * dt, d);
        u.x += (dx / d) * step;
        u.y += (dy / d) * step;
      }
    } else if (faceX !== null && faceY !== null) {
      u.facing = (Math.atan2(faceY - u.y, faceX - u.x) * 180) / Math.PI; // stand and face the foe
    }

    // fled off the field → gone
    if (u.state === "routing" && (u.y > WORLD.height || u.y < 0)) {
      u.state = "down";
      signal(world, `${desc(u)} flee the field.`);
    }
  }
}

// Personal space: push overlapping figures apart. Deterministic; tuned below
// formation spacing so it only resolves real overlap. O(n²) for now.
export function stepSeparation(world: World) {
  const us = world.units;
  const rad = SEPARATION.radius;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (a.state === "down") continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (b.state === "down") continue;
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
