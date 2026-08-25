import type { World } from "./world";
import type { Unit, Side } from "./types";
import { WEAPON, COMBAT, FLASH, MORALE, FLANK, TERRAIN, CUTLASS, RAID } from "./constants";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { clamp, dist, angleTo, angleDiff } from "./math";
import { applyMorale, contagion } from "./morale";
import { effMarks, effFerocity, presenceAura } from "./officers";
import { terrainAt } from "./terrain";
import { desc } from "./naming";

// Ranged fire and melee. Lethality is low, morale drains high, arc (front/flank/rear)
// matters more than the hit itself, and an officer's carry-over lifts his men while
// his presence blunts incoming blows. Pure and deterministic given the seeded rng.

type Arc = "front" | "flank" | "rear";

function alive(u: Unit): boolean {
  return u.state !== "down";
}
function foeSide(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}

// Segment (x0,y0)-(x1,y1) vs axis-aligned rect (Liang–Barsky clip): do they intersect?
function segIntersectsRect(x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - rx],
    [dx, rx + rw - x0],
    [-dy, y0 - ry],
    [dy, ry + rh - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false; // parallel to this edge and outside the slab
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

// A shot from (x0,y0) to (x1,y1) is blocked if it crosses any building. Fire LOS only —
// no fog-of-war; the player still sees the whole town, but can't shoot through walls.
export function losBlocked(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  for (const b of world.buildings) {
    if (segIntersectsRect(x0, y0, x1, y1, b.x, b.y, b.w, b.h)) return true;
  }
  return false;
}

function arcOf(target: Unit, fromX: number, fromY: number): Arc {
  const rel = Math.abs(angleDiff(target.facing, angleTo(target.x, target.y, fromX, fromY)));
  if (rel <= FLANK.frontHalfAngle) return "front";
  if (rel >= 180 - FLANK.rearHalfAngle) return "rear";
  return "flank";
}

// A morale blow scaled by arc (flanks/rears terrify) and blunted by an officer's
// presence (resilience).
function arcMorale(world: World, target: Unit, base: number, arc: Arc, frontCause: "fire" | "melee") {
  const mult = arc === "flank" ? FLANK.flankMoraleMult : arc === "rear" ? FLANK.rearMoraleMult : 1;
  const aura = presenceAura(world, target);
  const resist = aura ? 1 - aura.resilience : 1;
  const cause = arc === "flank" ? "flank" : arc === "rear" ? "rear" : frontCause;
  applyMorale(world, target, base * mult * resist, cause);
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
    const rangeMax = w.rangeMax + (terrainAt(world, u.x, u.y) === "highGround" ? TERRAIN.highGroundRangeBonus : 0);
    const bears = (e: Unit): boolean => {
      if (dist(u.x, u.y, e.x, e.y) > rangeMax) return false;
      if (Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y))) > COMBAT.fireArcHalfAngle) return false;
      return !losBlocked(world, u.x, u.y, e.x, e.y); // can't shoot through buildings
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
}

function fire(world: World, shooter: Unit, target: Unit) {
  const w = WEAPON[shooter.weapon];
  const onHigh = terrainAt(world, shooter.x, shooter.y) === "highGround";
  const inCover = terrainAt(world, target.x, target.y) === "cover";
  const rangeMax = w.rangeMax + (onHigh ? TERRAIN.highGroundRangeBonus : 0);
  const d = dist(shooter.x, shooter.y, target.x, target.y);
  const rangeScalar = clamp(Math.pow(1 - d / rangeMax, COMBAT.rangeFalloffPow), COMBAT.rangeFloor, 1);
  shooter.reload = w.reload;
  shooter.powder -= 1;
  world.raid.alarmHeat += RAID.alarm.perShot * w.loud; // gunfire wakes the town — loud weapons more so
  world.flashes.push({ ax: shooter.x, ay: shooter.y, bx: target.x, by: target.y, ttl: FLASH.ttl, kind: "fire" });

  // being shot at rattles a figure even on a miss
  applyMorale(world, target, MORALE.suppression, "fire");

  let p = w.accuracy * (effMarks(world, shooter) / 100) * rangeScalar;
  if (onHigh) p *= TERRAIN.highGroundHitBonus; // firing down from high ground lands better
  if (inCover) p *= TERRAIN.coverIncomingMult; // a target in cover is harder to hit
  if (nextFloat(world.rng) < clamp(p, 0, 0.95)) {
    target.hp -= 1;
    arcMorale(world, target, w.moraleShot, arcOf(target, shooter.x, shooter.y), "fire");
    if (target.hp <= 0) kill(world, target);
  }
}

// Melee is a shock + will contest decided by (carry-over) ferocity × the weapon's
// melee mult; a blow from the flank or rear both lands more easily and terrifies more.
function doMelee(world: World, a: Unit, foe: Unit) {
  a.meleeReload = COMBAT.meleeReload;
  const arc = arcOf(foe, a.x, a.y);
  const toHit = arc === "flank" ? FLANK.meleeToHitFlank : arc === "rear" ? FLANK.meleeToHitRear : 1;
  const aFero = effFerocity(world, a) * Math.max(WEAPON[a.weapon].meleeMult, CUTLASS.meleeMult);
  const p = clamp(0.32 + (aFero - effFerocity(world, foe)) / 300, 0.08, 0.9) * toHit;
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
  signal(world, u.kind === "officer" ? `${desc(u)} is cut down!` : `${desc(u)} falls.`);
  // a friend falling shakes the men around him — an officer's fall, far more
  contagion(world, u, u.kind === "officer" ? MORALE.perOfficerDown : MORALE.perDown);
}

// The raid outcome — win by breaking WILL, now graded and objective-aware — is decided in
// raid.ts (checkRaidOutcome), run each tick after morale.
