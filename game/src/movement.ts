import type { World } from "./world";
import type { Unit } from "./types";
import { MOVE, WEAPON, SEPARATION, WORLD, COMBAT, TERRAIN } from "./constants";
import { dist } from "./math";
import { signal } from "./log";
import { desc } from "./naming";
import { terrainAt } from "./terrain";

function nearestEnemyWithin(world: World, u: Unit, range: number): Unit | null {
  let best: Unit | null = null;
  let bd = range;
  for (const o of world.units) {
    if (o.side === u.side || o.state === "down") continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

// Order of will: routers flee; a plain move is obeyed to the letter; otherwise a
// figure may engage — an explicit target, an aggressive stance's auto-acquire, or an
// attack-move — closing to firing range and facing the foe. Pure & deterministic.
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
    } else if (u.moveTarget && !u.attackMove) {
      // plain move — obey the order, ignore the enemy
      tx = u.moveTarget.x;
      ty = u.moveTarget.y;
      moving = true;
      clearOnArrive = true;
    } else {
      // may engage: an explicit target, then aggressive/attack-move auto-acquire
      let engage: Unit | null = null;
      if (u.attackTargetId != null) {
        const t = world.units.find((x) => x.id === u.attackTargetId);
        if (t && t.state !== "down" && t.side !== u.side) engage = t;
        else u.attackTargetId = null;
      }
      if (!engage && (u.attackMove || u.stance === "aggressive")) {
        engage = nearestEnemyWithin(world, u, COMBAT.acquireRange);
      }

      if (engage) {
        faceX = engage.x;
        faceY = engage.y;
        // shock troops (pistol & cutlass) close all the way to melee; others hold at firing range
        const engageDist = u.weapon === "pistol" ? COMBAT.meleeRange : WEAPON[u.weapon].rangeMax * MOVE.engageFraction;
        if (dist(u.x, u.y, engage.x, engage.y) > engageDist) {
          tx = engage.x;
          ty = engage.y;
          moving = true;
        }
      } else if (u.moveTarget) {
        // attack-moving with no enemy in reach → proceed to the rally point
        tx = u.moveTarget.x;
        ty = u.moveTarget.y;
        moving = true;
        clearOnArrive = true;
      }
    }

    if (moving) {
      const dx = tx - u.x;
      const dy = ty - u.y;
      const d = Math.hypot(dx, dy);
      if (d <= MOVE.arriveSlack) {
        if (clearOnArrive) {
          u.moveTarget = null;
          u.attackMove = false;
        }
      } else {
        u.facing = (Math.atan2(dy, dx) * 180) / Math.PI;
        const mult = u.state === "routing" ? MOVE.routSpeedMult : u.state === "wavering" ? MOVE.waverSpeedMult : 1;
        const choke = terrainAt(world, u.x, u.y) === "choke" ? TERRAIN.chokeSpeedMult : 1;
        const step = Math.min(MOVE.speed * mult * choke * dt, d);
        u.x += (dx / d) * step;
        u.y += (dy / d) * step;
      }
    } else if (faceX !== null && faceY !== null) {
      u.facing = (Math.atan2(faceY - u.y, faceX - u.x) * 180) / Math.PI; // stand and face the foe
    } else if (u.state !== "routing") {
      // idle — aim at the nearest enemy in weapon range so we can still fire
      const near = nearestEnemyWithin(world, u, WEAPON[u.weapon].rangeMax);
      if (near) u.facing = (Math.atan2(near.y - u.y, near.x - u.x) * 180) / Math.PI;
    }

    if (u.state === "routing" && (u.y > WORLD.height || u.y < 0)) {
      u.state = "down";
      signal(world, `${desc(u)} flee the field.`);
    }
  }
}

// Personal space: push overlapping figures apart. Deterministic; tuned below
// formation spacing so it only resolves real overlap.
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
