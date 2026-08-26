import type { World } from "./world";
import type { Unit } from "./types";
import { MOVE, WEAPON, SEPARATION, WORLD, COMBAT, TERRAIN, RAID } from "./constants";
import { dist } from "./math";
import { signal } from "./log";
import { desc } from "./naming";
import { terrainAt } from "./terrain";
import { findPath, pathBlocked } from "./nav";

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
    if (u.state === "down" || u.state === "surrendered") continue; // the fallen and the yielded don't move

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
    } else if (u.buildTargetId != null) {
      // a loot/torch order: close on the building, then stand at it and work (raid.ts)
      const b = world.buildings.find((x) => x.id === u.buildTargetId);
      const stillValid =
        b && (u.buildAction === "torch" ? b.state === "intact" || b.state === "looted" : b.state === "intact" && (!!b.loot || b.kind === "gaol"));
      if (!b || !stillValid) {
        u.buildTargetId = undefined;
        u.buildAction = undefined;
      } else if (distToRect(u.x, u.y, b.x, b.y, b.w, b.h) > RAID.lootRange - 6) {
        tx = b.x + b.w / 2;
        ty = b.y + b.h / 2;
        moving = true;
      } else {
        faceX = b.x + b.w / 2;
        faceY = b.y + b.h / 2;
      }
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
        // shock troops (pistol & cutlass), and anyone out of powder, close to the cutlass; others hold at firing range
        const engageDist =
          u.weapon === "pistol" || u.powder <= 0 ? COMBAT.meleeRange : WEAPON[u.weapon].rangeMax * MOVE.engageFraction;
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
      const distToGoal = Math.hypot(tx - u.x, ty - u.y);
      if (distToGoal <= MOVE.arriveSlack) {
        if (clearOnArrive) {
          u.moveTarget = null;
          u.attackMove = false;
        }
        u.path = undefined;
      } else {
        // steer toward the goal directly if the line is clear, else along a path around buildings
        const nav = navTarget(world, u, tx, ty);
        const dx = nav.x - u.x;
        const dy = nav.y - u.y;
        const d = Math.hypot(dx, dy) || 1;
        u.facing = (Math.atan2(dy, dx) * 180) / Math.PI;
        const mult = u.state === "routing" ? MOVE.routSpeedMult : u.state === "wavering" ? MOVE.waverSpeedMult : 1;
        const choke = terrainAt(world, u.x, u.y) === "choke" ? TERRAIN.chokeSpeedMult : 1;
        const carry = world.raid.loads.some((l) => l.carrierId === u.id) ? MOVE.carryMult : 1;
        const step = Math.min(MOVE.speed * mult * choke * carry * dt, d);
        const px = u.x;
        const py = u.y;
        u.x += (dx / d) * step;
        u.y += (dy / d) * step;
        slideOutOfBuildings(world, u, px, py);
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
      if (u.side === "enemy") {
        world.raid.alarmHeat += RAID.alarm.runnerSpike; // a defender who gets away raises the cry
        signal(world, `${desc(u)} escapes and raises the cry!`);
      } else {
        signal(world, `${desc(u)} flee the field.`);
      }
    }
  }
}

// Distance from a point to a rectangle (0 if inside) — for "how close to the building".
function distToRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): number {
  const dx = Math.max(rx - x, 0, x - (rx + rw));
  const dy = Math.max(ry - y, 0, y - (ry + rh));
  return Math.hypot(dx, dy);
}

// Is (x, y) inside any building footprint (expanded by a small margin so figures stop
// just shy of the wall)?
function inBuilding(world: World, x: number, y: number): boolean {
  const m = SEPARATION.radius * 0.5;
  for (const b of world.buildings) {
    if (x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m) return true;
  }
  return false;
}

// Wall-slide: if a step lands inside a building, keep whichever axis is still clear (slide
// along the wall); if neither is, stay put. Thin and local — no pathfinding (that's S7),
// so a figure whose target sits directly behind a building will stall at the wall.
function slideOutOfBuildings(world: World, u: Unit, px: number, py: number) {
  if (!inBuilding(world, u.x, u.y)) return;
  if (!inBuilding(world, u.x, py)) {
    u.y = py; // vertical wall — slide along it in x
    return;
  }
  if (!inBuilding(world, px, u.y)) {
    u.x = px; // horizontal wall — slide along it in y
    return;
  }
  u.x = px;
  u.y = py;
}

// The immediate point to steer toward: the goal itself if the straight line is clear,
// else the next waypoint of a cached A* path around the buildings. String-pulled (drop
// waypoints we can already see past) so the path reads smooth, not grid-jagged.
function navTarget(world: World, u: Unit, tx: number, ty: number): { x: number; y: number } {
  if (!pathBlocked(world, u.x, u.y, tx, ty)) {
    u.path = undefined;
    u.pathGoal = undefined;
    return { x: tx, y: ty };
  }
  const goalMoved = !u.pathGoal || Math.hypot(u.pathGoal.x - tx, u.pathGoal.y - ty) > 48;
  if (!u.path || u.path.length === 0 || goalMoved) {
    u.path = findPath(world, u.x, u.y, tx, ty);
    u.pathGoal = { x: tx, y: ty };
  }
  if (!u.path || u.path.length === 0) return { x: tx, y: ty }; // no path — head straight; wall-slide copes
  while (u.path.length > 1 && !pathBlocked(world, u.x, u.y, u.path[1].x, u.path[1].y)) u.path.shift();
  const wp = u.path[0];
  if (Math.hypot(wp.x - u.x, wp.y - u.y) < 30 && u.path.length > 1) u.path.shift();
  return u.path[0];
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
