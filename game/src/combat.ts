import type { World } from "./world";
import type { Unit, Side } from "./types";
import { WEAPON, COMBAT, FLASH, MORALE, FLANK } from "./constants";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { clamp, dist, angleTo, angleDiff } from "./math";
import { applyMorale, contagion } from "./morale";
import { desc } from "./naming";

// Ranged fire and melee. Lethality is low, morale drains high, and where a blow
// lands (front / flank / rear) matters more than that it lands — positioning is
// how you break a line. Pure and deterministic given the world's seeded rng.

type Arc = "front" | "flank" | "rear";

function alive(u: Unit): boolean {
  return u.state !== "down";
}
function foeSide(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}

// Which arc of the target a blow comes from, by the target's facing.
function arcOf(target: Unit, fromX: number, fromY: number): Arc {
  const rel = Math.abs(angleDiff(target.facing, angleTo(target.x, target.y, fromX, fromY)));
  if (rel <= FLANK.frontHalfAngle) return "front";
  if (rel >= 180 - FLANK.rearHalfAngle) return "rear";
  return "flank";
}

// A morale blow scaled by the arc it lands from — flanks and rears terrify.
function arcMorale(world: World, target: Unit, base: number, arc: Arc, frontCause: "fire" | "melee") {
  const mult = arc === "flank" ? FLANK.flankMoraleMult : arc === "rear" ? FLANK.rearMoraleMult : 1;
  const cause = arc === "flank" ? "flank" : arc === "rear" ? "rear" : frontCause;
  applyMorale(world, target, base * mult, cause);
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

  // being shot at rattles a figure even on a miss
  applyMorale(world, target, MORALE.suppression, "fire");

  if (nextFloat(world.rng) < w.accuracy * rangeScalar) {
    target.hp -= 1;
    arcMorale(world, target, w.moraleShot, arcOf(target, shooter.x, shooter.y), "fire");
    if (target.hp <= 0) kill(world, target);
  }
}

// Melee is a shock + will contest decided by ferocity (× the weapon's melee mult);
// a blow from the flank or rear both lands more easily and terrifies far more.
function doMelee(world: World, a: Unit, foe: Unit) {
  a.meleeReload = COMBAT.meleeReload;
  const arc = arcOf(foe, a.x, a.y);
  const toHit = arc === "flank" ? FLANK.meleeToHitFlank : arc === "rear" ? FLANK.meleeToHitRear : 1;
  const aFero = a.ferocity * WEAPON[a.weapon].meleeMult;
  const p = clamp(0.32 + (aFero - foe.ferocity) / 300, 0.08, 0.9) * toHit;
  world.flashes.push({ ax: a.x, ay: a.y, bx: foe.x, by: foe.y, ttl: FLASH.ttl, kind: "melee" });
  if (nextFloat(world.rng) < p) {
    foe.hp -= 1;
    arcMorale(world, foe, COMBAT.meleeMoraleHit, arc, "melee");
    if (foe.hp <= 0) kill(world, foe);
  }
}

function kill(world: World, u: Unit) {
  u.state = "down";
  u.hp = 0;
  signal(world, `${desc(u)} falls.`);
  contagion(world, u, MORALE.perDown); // a friend falling shakes the men around him
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
