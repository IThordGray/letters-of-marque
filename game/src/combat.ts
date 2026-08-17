import type { World } from "./world";
import type { Unit, Side } from "./types";
import { WEAPON, COMBAT, FLASH, MORALE } from "./constants";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { clamp, dist, angleTo, angleDiff } from "./math";
import { applyMorale } from "./morale";
import { desc } from "./naming";

// Ranged fire. Lethality is low and morale drains high (see WEAPON) — figures rout
// before they die. Pure and deterministic given the world's seeded rng.

function alive(u: Unit): boolean {
  return u.state !== "down";
}
function foeSide(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}

export function stepCombat(world: World, dt: number) {
  for (let i = world.flashes.length - 1; i >= 0; i--) {
    world.flashes[i].ttl -= dt;
    if (world.flashes[i].ttl <= 0) world.flashes.splice(i, 1);
  }
  if (world.over) return;

  for (const u of world.units) {
    if (!alive(u) || u.state === "routing") continue; // routers flee, they don't fire
    u.reload -= dt;
    if (u.reload > 0 || u.powder <= 0) continue;

    const w = WEAPON[u.weapon];
    const bears = (e: Unit): boolean => {
      if (dist(u.x, u.y, e.x, e.y) > w.rangeMax) return false;
      return Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y))) <= COMBAT.fireArcHalfAngle;
    };

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

  // being shot at rattles a figure even on a miss — this is what breaks lines
  applyMorale(world, target, MORALE.suppression, "fire");

  if (nextFloat(world.rng) < w.accuracy * rangeScalar) {
    target.hp -= 1;
    applyMorale(world, target, w.moraleShot, "fire");
    if (target.hp <= 0) kill(world, target);
  }
}

function kill(world: World, u: Unit) {
  u.state = "down";
  u.hp = 0;
  signal(world, `${desc(u)} falls.`);
}

// Win by breaking WILL: a side is beaten once none of its figures are still
// fighting (all routing or down) — not by wiping them out.
function checkOutcome(world: World) {
  let pFight = 0;
  let eFight = 0;
  for (const u of world.units) {
    if (u.state !== "steady" && u.state !== "wavering") continue;
    if (u.side === "player") pFight++;
    else eFight++;
  }
  const pBroken = pFight === 0;
  const eBroken = eFight === 0;
  if (eBroken && !pBroken) end(world, "The enemy's will breaks — the field is yours.");
  else if (pBroken && !eBroken) end(world, "Your band breaks and scatters — the raid fails.");
  else if (pBroken && eBroken) end(world, "Both sides break — a bloody shambles.");
}

function end(world: World, outcome: string) {
  world.over = true;
  world.outcome = outcome;
  signal(world, outcome);
}
