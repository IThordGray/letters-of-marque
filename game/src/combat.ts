import type { World } from "./world";
import type { Unit, Side } from "./types";
import { WEAPON, COMBAT, FLASH, MORALE } from "./constants";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { clamp, dist, angleTo, angleDiff } from "./math";
import { applyMorale } from "./morale";
import { desc } from "./naming";

// Ranged fire and melee. Lethality is low and morale drains high — figures rout
// before they die. Pure and deterministic given the world's seeded rng.

function alive(u: Unit): boolean {
  return u.state !== "down";
}
function foeSide(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}
function meleeFoe(world: World, u: Unit): Unit | undefined {
  let best: Unit | undefined;
  let bd = COMBAT.meleeRange;
  for (const e of world.units) {
    if (e.side === u.side || !alive(e)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d <= bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function stepCombat(world: World, dt: number) {
  for (let i = world.flashes.length - 1; i >= 0; i--) {
    world.flashes[i].ttl -= dt;
    if (world.flashes[i].ttl <= 0) world.flashes.splice(i, 1);
  }
  if (world.over) return;

  for (const u of world.units) {
    if (!alive(u) || u.state === "routing") continue;
    u.reload -= dt;
    u.meleeReload -= dt;

    // an adjacent enemy → melee (self-defence: ignores cease-fire and powder)
    const foe = meleeFoe(world, u);
    if (foe) {
      if (u.meleeReload <= 0) doMelee(world, u, foe);
      continue;
    }

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
    if (!target && u.stance !== "ceaseFire") {
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
  world.flashes.push({ ax: shooter.x, ay: shooter.y, bx: target.x, by: target.y, ttl: FLASH.ttl, kind: "fire" });

  // being shot at rattles a figure even on a miss — this is what breaks lines
  applyMorale(world, target, MORALE.suppression, "fire");

  if (nextFloat(world.rng) < w.accuracy * rangeScalar) {
    target.hp -= 1;
    applyMorale(world, target, w.moraleShot, "fire");
    if (target.hp <= 0) kill(world, target);
  }
}

// Melee is a shock + will contest decided by ferocity (× the weapon's melee mult),
// not a straight hp swap: a blow craters morale far more than it wounds. This is how
// pistol-and-cutlass shock troops win — by terror at close quarters.
function doMelee(world: World, a: Unit, foe: Unit) {
  a.meleeReload = COMBAT.meleeReload;
  const aFero = a.ferocity * WEAPON[a.weapon].meleeMult;
  const p = clamp(0.32 + (aFero - foe.ferocity) / 300, 0.08, 0.9);
  world.flashes.push({ ax: a.x, ay: a.y, bx: foe.x, by: foe.y, ttl: FLASH.ttl, kind: "melee" });
  if (nextFloat(world.rng) < p) {
    foe.hp -= 1;
    applyMorale(world, foe, COMBAT.meleeMoraleHit, "melee");
    if (foe.hp <= 0) kill(world, foe);
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
