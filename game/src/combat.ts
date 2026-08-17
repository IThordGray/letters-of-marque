import type { World } from "./world";
import type { Unit, Side } from "./types";
import { WEAPON, COMBAT, FLASH } from "./constants";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { clamp, dist, angleTo, angleDiff } from "./math";

// Ranged fire only — attrition (morale, the real "health", arrives in KAN-14).
// Pure and deterministic given the world's seeded rng: same seed → same battle.

function alive(u: Unit): boolean {
  return u.hp > 0;
}
function foeSide(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}
function desc(u: Unit): string {
  return `${u.side === "player" ? "Our" : "Enemy"} ${u.kind}`;
}

export function stepCombat(world: World, dt: number) {
  // age shot flashes
  for (let i = world.flashes.length - 1; i >= 0; i--) {
    world.flashes[i].ttl -= dt;
    if (world.flashes[i].ttl <= 0) world.flashes.splice(i, 1);
  }
  if (world.over) return;

  for (const u of world.units) {
    if (!alive(u)) continue;
    u.reload -= dt;
    if (u.reload > 0 || u.powder <= 0) continue;

    const w = WEAPON[u.weapon];
    const bears = (e: Unit): boolean => {
      if (dist(u.x, u.y, e.x, e.y) > w.rangeMax) return false;
      return Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y))) <= COMBAT.fireArcHalfAngle;
    };

    // fire the ordered target if it still bears; else opportunity-fire the nearest that does
    let target: Unit | undefined;
    if (u.attackTargetId != null) {
      const t = world.units.find((x) => x.id === u.attackTargetId);
      if (t && alive(t) && t.side !== u.side && bears(t)) target = t;
      else if (!t || !alive(t)) u.attackTargetId = null;
    }
    if (!target) {
      let bd = Infinity;
      for (const e of world.units) {
        if (e.side !== foeSide(u.side) || !alive(e) || !bears(e)) continue;
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          target = e;
        }
      }
    }
    if (target) fire(world, u, target);
  }

  checkOutcome(world);
}

function fire(world: World, shooter: Unit, target: Unit) {
  const w = WEAPON[shooter.weapon];
  const d = dist(shooter.x, shooter.y, target.x, target.y);
  const rangeScalar = clamp(Math.pow(1 - d / w.rangeMax, COMBAT.rangeFalloffPow), COMBAT.rangeFloor, 1);
  shooter.reload = w.reload;
  shooter.powder -= 1;
  world.flashes.push({ ax: shooter.x, ay: shooter.y, bx: target.x, by: target.y, ttl: FLASH.ttl });
  if (nextFloat(world.rng) < w.accuracy * rangeScalar) {
    target.hp -= 1;
    if (target.hp <= 0) signal(world, `${desc(target)} falls.`);
  }
}

function checkOutcome(world: World) {
  let p = 0;
  let e = 0;
  for (const u of world.units) {
    if (u.hp <= 0) continue;
    if (u.side === "player") p++;
    else e++;
  }
  if (p > 0 && e === 0) end(world, "The enemy is cut down — the field is yours.");
  else if (e > 0 && p === 0) end(world, "Your band is wiped out.");
  else if (p === 0 && e === 0) end(world, "Mutual slaughter — none left standing.");
}

function end(world: World, outcome: string) {
  world.over = true;
  world.outcome = outcome;
  signal(world, outcome);
}
