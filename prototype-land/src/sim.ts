import type { GameState, Unit, Side, Cause, UnitState } from "./types";
import {
  WEAPON,
  COMBAT,
  CARRY,
  PRESENCE,
  PERK,
  MORALE,
  FLANK,
  MOVE,
  FATIGUE,
  RALLY,
  TERRAIN,
  WORLD,
  FLASH,
} from "./constants";
import { DEG, clamp, angleDiff, angleTo, dist, turnToward } from "./math";
import { terrainAt } from "./terrain";
import { signal, countRout, countKill, countLost, countFlank, countRally } from "./instrumentation";

function opposite(s: Side): Side {
  return s === "player" ? "enemy" : "player";
}
function living(state: GameState, side: Side): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) if (u.side === side && u.state !== "down") out.push(u);
  return out;
}
function nearest(from: Unit, list: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  let bd = Infinity;
  for (const u of list) {
    const d = dist(from.x, from.y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
function nearestDist(from: Unit, list: Unit[]): number {
  let bd = Infinity;
  for (const u of list) bd = Math.min(bd, dist(from.x, from.y, u.x, u.y));
  return bd;
}

type Arc = "front" | "flank" | "rear";
function arcOf(target: Unit, fromX: number, fromY: number): Arc {
  const rel = Math.abs(angleDiff(target.facing, angleTo(target.x, target.y, fromX, fromY)));
  if (rel <= FLANK.frontHalfAngle) return "front";
  if (rel >= 180 - FLANK.rearHalfAngle) return "rear";
  return "flank";
}

function fatigueFireMult(u: Unit): number {
  return 1 - (u.fatigue / 100) * FATIGUE.firePenaltyAt100;
}
function fatigueSpeedMult(u: Unit): number {
  return 1 - (u.fatigue / 100) * FATIGUE.speedPenaltyAt100;
}

// The living officer of a unit's squad, if any (source of the carry-over).
function squadOfficer(state: GameState, u: Unit): Unit | undefined {
  const sq = state.squads.find((s) => s.id === u.squadId);
  if (!sq || sq.officerId == null) return undefined;
  const o = state.units.get(sq.officerId);
  return o && o.state !== "down" ? o : undefined;
}

// Carry-over: a pirate is lifted a fraction of the way toward his officer's skill.
function effMarks(state: GameState, u: Unit): number {
  if (u.kind === "officer") return u.marks;
  const o = squadOfficer(state, u);
  return o ? u.marks + CARRY.fraction * Math.max(0, o.marks - u.marks) : u.marks;
}
function effFerocity(state: GameState, u: Unit): number {
  if (u.kind === "officer") return u.ferocity;
  const o = squadOfficer(state, u);
  return o ? u.ferocity + CARRY.fraction * Math.max(0, o.ferocity - u.ferocity) : u.ferocity;
}

// Presence: a proximity leadership aura from the nearest friendly officer.
function presenceAura(state: GameState, u: Unit): { floor: number; resilience: number } | null {
  let best: Unit | undefined;
  let bd = PRESENCE.radius;
  for (const o of state.units.values()) {
    if (o.side !== u.side || o.kind !== "officer" || o.state === "down") continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d <= bd) {
      bd = d;
      best = o;
    }
  }
  if (!best) return null;
  const floor =
    PRESENCE.floorBase + best.presence * PRESENCE.floorPerPresence + (best.perks.ironWill ? PRESENCE.ironWillFloorBonus : 0);
  const resilience = clamp(best.presence * PRESENCE.resiliencePerPresence, 0, 0.45);
  return { floor, resilience };
}

function causePhrase(c: Cause | null): string {
  switch (c) {
    case "flank":
      return "taken in the flank";
    case "rear":
      return "hit from behind";
    case "melee":
      return "cut down at close quarters";
    case "friend-down":
      return "shaken by the men falling around them";
    case "fire":
    default:
      return "under withering fire";
  }
}

function addFlash(state: GameState, a: Unit, b: Unit, kind: "fire" | "flank" | "melee") {
  state.flashes.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, kind, ttl: FLASH.ttl });
}

function applyMoraleHit(state: GameState, target: Unit, base: number, arc: Arc): Cause {
  let mult = 1;
  let cause: Cause = "fire";
  if (arc === "flank") {
    mult = FLANK.flankMoraleMult;
    cause = "flank";
  } else if (arc === "rear") {
    mult = FLANK.rearMoraleMult;
    cause = "rear";
  }
  if (terrainAt(state, target.x, target.y).cover) mult *= TERRAIN.coverIncomingMult;
  const aura = presenceAura(state, target);
  if (aura) mult *= 1 - aura.resilience;
  target.morale = clamp(target.morale - base * mult, 0, MORALE.max);
  target.lastCause = cause;
  target.lastCauseAt = state.time;
  target.lastHitAt = state.time;
  return cause;
}

function contagion(state: GameState, source: Unit, amount: number) {
  for (const u of living(state, source.side)) {
    if (u.id === source.id) continue;
    if (dist(u.x, u.y, source.x, source.y) <= MORALE.contagionRadius) {
      u.morale = clamp(u.morale - amount, 0, MORALE.max);
      if (u.lastCause == null || state.time - u.lastCauseAt > 1) {
        u.lastCause = "friend-down";
        u.lastCauseAt = state.time;
      }
    }
  }
}

function killUnit(state: GameState, u: Unit, _bySide: Side) {
  u.state = "down";
  u.hp = 0;
  countKill(u.side); // killsCaused counts enemy figures the player cut down
  countLost(u.side);
  signal(state.time, u.kind === "officer" ? `${u.name} is cut down!` : `${u.name} falls.`);
  contagion(state, u, MORALE.perDown);
}

// ---------------------------------------------------------------------------
// combat
// ---------------------------------------------------------------------------

function doMelee(state: GameState, a: Unit, foe: Unit) {
  a.meleeReload = COMBAT.meleeReload;
  const arc = arcOf(foe, a.x, a.y);
  const toHit = arc === "flank" ? FLANK.meleeToHitFlank : arc === "rear" ? FLANK.meleeToHitRear : 1;
  const aFero =
    effFerocity(state, a) * WEAPON[a.weapon].meleeMult * (a.kind === "officer" && a.perks.cutthroat ? PERK.cutthroatMult : 1) * fatigueFireMult(a);
  const p = clamp(0.32 + (aFero - effFerocity(state, foe)) / 300, 0.08, 0.9) * toHit;
  addFlash(state, a, foe, arc === "front" ? "melee" : "flank");
  if (Math.random() < p) {
    foe.hp -= 1;
    applyMoraleHit(state, foe, COMBAT.meleeMoraleHit, arc);
    if (arc !== "front") {
      countFlank(a.side);
    }
    if (foe.hp <= 0) killUnit(state, foe, a.side);
  }
}

function doFire(state: GameState, shooter: Unit, target: Unit) {
  const w = WEAPON[shooter.weapon];
  const hi = terrainAt(state, shooter.x, shooter.y).highGround;
  const d = dist(shooter.x, shooter.y, target.x, target.y);
  const rangeMax = w.rangeMax + (hi ? TERRAIN.highGroundRangeBonus : 0);
  const rangeScalar = clamp(Math.pow(1 - d / rangeMax, COMBAT.rangeFalloffPow), COMBAT.rangeFloor, 1);
  let p = w.accuracy * (effMarks(state, shooter) / 100) * rangeScalar * fatigueFireMult(shooter);
  if (hi) p *= TERRAIN.highGroundHitBonus;
  if (shooter.kind === "officer" && shooter.perks.deadEye) p *= PERK.deadEyeMult;

  shooter.reload = w.reload;
  shooter.powder -= 1;

  // being shot at rattles a figure even on a miss
  applyMoraleHit(state, target, COMBAT.suppression, "front");

  const arc = arcOf(target, shooter.x, shooter.y);
  if (Math.random() < p) {
    target.hp -= 1;
    applyMoraleHit(state, target, w.moraleShot, arc);
    addFlash(state, shooter, target, arc === "front" ? "fire" : "flank");
    if (arc !== "front") {
      countFlank(shooter.side);
      signal(state.time, `${shooter.name} rake ${target.name} ${arc === "rear" ? "from behind" : "in the flank"}!`);
    }
    if (target.hp <= 0) killUnit(state, target, shooter.side);
  } else {
    addFlash(state, shooter, target, "fire");
  }
}

function stepCombat(state: GameState, dt: number) {
  for (const u of state.units.values()) {
    if (u.state === "down" || u.state === "routing") continue;
    u.reload -= dt;
    u.meleeReload -= dt;
    const foes = living(state, opposite(u.side));
    if (foes.length === 0) continue;

    // adjacent enemy → melee (self-defence, ignores hold-fire)
    const meleeFoe = foes.find((e) => dist(u.x, u.y, e.x, e.y) <= COMBAT.meleeRange);
    if (meleeFoe) {
      if (u.meleeReload <= 0) doMelee(state, u, meleeFoe);
      continue;
    }
    if (u.reload > 0 || u.powder <= 0) continue;

    // shoot the ordered target if it bears; else, unless ceasing fire, the
    // nearest that bears (opportunity fire).
    const w = WEAPON[u.weapon];
    const hi = terrainAt(state, u.x, u.y).highGround;
    const rangeMax = w.rangeMax + (hi ? TERRAIN.highGroundRangeBonus : 0);
    const bears = (e: Unit) =>
      dist(u.x, u.y, e.x, e.y) <= rangeMax && Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y))) <= COMBAT.fireArcHalfAngle;
    let target: Unit | undefined;
    if (u.attackTargetId != null) {
      const t = state.units.get(u.attackTargetId);
      if (t && t.state !== "down" && t.side !== u.side && bears(t)) target = t; // explicit order fires even on cease-fire
    }
    if (!target && u.stance !== "cease-fire") {
      let bd = Infinity;
      for (const e of foes) {
        if (!bears(e)) continue;
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          target = e;
        }
      }
    }
    if (target) doFire(state, u, target);
  }
}

// ---------------------------------------------------------------------------
// movement & orders
// ---------------------------------------------------------------------------

function engageDist(u: Unit): number {
  const w = WEAPON[u.weapon];
  if (u.weapon === "pistol") return COMBAT.meleeRange; // shock troops close in
  if (u.weapon === "cannon") return w.rangeMax * 0.85;
  return w.rangeMax * 0.8;
}

function ownEdgeY(side: Side): number {
  return side === "player" ? WORLD.height + 40 : -40;
}

function stepMove(state: GameState, dt: number) {
  for (const u of state.units.values()) {
    if (u.state === "down") continue;
    const foes = living(state, opposite(u.side));
    let tx = u.x;
    let ty = u.y;
    let faceFoe: Unit | undefined;
    let moving = true;

    if (u.state === "routing") {
      tx = u.x;
      ty = ownEdgeY(u.side);
    } else if (u.moveTarget) {
      // an explicit move order takes priority over the stance
      tx = u.moveTarget.x;
      ty = u.moveTarget.y;
      if (dist(u.x, u.y, tx, ty) < MOVE.arriveSlack) {
        u.moveTarget = null;
        moving = false;
      }
    } else {
      // no move order: pursue an explicit attack target, else the stance decides.
      let pursue: Unit | undefined;
      if (u.attackTargetId != null) {
        const t = state.units.get(u.attackTargetId);
        if (t && t.state !== "down" && t.side !== u.side) pursue = t;
        else u.attackTargetId = null;
      }
      if (!pursue && u.stance === "aggressive") {
        // auto-acquire the nearest enemy within sight and go for it
        const n = nearest(u, foes);
        if (n && dist(u.x, u.y, n.x, n.y) <= COMBAT.acquireRange) pursue = n;
      }
      // hold-ground / cease-fire never chase; they stand and (maybe) fire.
      if (pursue && dist(u.x, u.y, pursue.x, pursue.y) > engageDist(u)) {
        tx = pursue.x;
        ty = pursue.y;
      } else {
        faceFoe = pursue ?? nearest(u, foes);
        moving = false;
      }
    }

    const w = WEAPON[u.weapon];
    const stateMult = u.state === "wavering" ? MOVE.waverSpeedMult : u.state === "routing" ? MOVE.routSpeedMult : 1;
    const speed = w.moveSpeed * stateMult * fatigueSpeedMult(u);
    const d = dist(u.x, u.y, tx, ty);
    if (moving && d > 0.5) {
      const dir = angleTo(u.x, u.y, tx, ty);
      u.facing = turnToward(u.facing, dir, MOVE.turnRate * dt);
      const step = Math.min(speed * dt, d);
      u.x += Math.cos(dir * DEG) * step;
      u.y += Math.sin(dir * DEG) * step;
      u.fatigue = clamp(u.fatigue + step * FATIGUE.perPaceMoved, 0, 100);
    } else {
      if (faceFoe) u.facing = turnToward(u.facing, angleTo(u.x, u.y, faceFoe.x, faceFoe.y), MOVE.turnRate * dt);
      u.fatigue = clamp(u.fatigue - FATIGUE.recoverRate * dt, 0, 100);
    }

    if (u.state === "routing" && (u.y > WORLD.height || u.y < 0)) {
      u.state = "down";
      countLost(u.side);
      signal(state.time, `${u.name} flee the field.`);
    }
  }
}

// ---------------------------------------------------------------------------
// morale
// ---------------------------------------------------------------------------

function stateFromMorale(m: number, cur: UnitState, inspired: boolean): UnitState {
  const h = MORALE.hysteresis;
  let s = cur;
  if (cur === "steady") {
    if (m < MORALE.steadyAbove) s = "wavering";
  } else if (cur === "wavering") {
    if (m > MORALE.steadyAbove + h) s = "steady";
    else if (m < MORALE.waverAbove) s = "routing";
  } else if (cur === "routing") {
    if (m > MORALE.waverAbove + h) s = "wavering";
  }
  if (inspired && s === "routing") s = "wavering";
  return s;
}

function stepMorale(state: GameState, dt: number) {
  for (const u of state.units.values()) {
    if (u.state === "down") continue;
    const foes = living(state, opposite(u.side));
    const enemyNear = nearestDist(u, foes) < 120;
    const calm = state.time - u.lastHitAt > MORALE.contactCooldown && !enemyNear;
    const here = terrainAt(state, u.x, u.y);

    if (calm) {
      u.morale = clamp(u.morale + (MORALE.rallyRate + (here.cover ? MORALE.coverRallyBonus : 0)) * dt, 0, MORALE.max);
    }
    if (here.highGround && u.state !== "routing") u.morale = clamp(u.morale + TERRAIN.highGroundMoraleSteady * dt, 0, MORALE.max);

    // an officer's presence pulls nearby figures up toward a floor
    const aura = presenceAura(state, u);
    if (aura && u.morale < aura.floor) u.morale = clamp(u.morale + MORALE.rallyRate * dt, 0, aura.floor);

    const inspired = state.time < u.inspiredUntil;
    const next = stateFromMorale(u.morale, u.state, inspired);
    if (next !== u.state) transition(state, u, next);
  }
}

function transition(state: GameState, u: Unit, next: UnitState) {
  const prev = u.state;
  u.state = next;
  if (next === "wavering" && prev === "steady") {
    signal(state.time, `${u.name} waver — ${causePhrase(u.lastCause)}.`);
  } else if (next === "routing") {
    signal(state.time, `${u.name} break and run — ${causePhrase(u.lastCause)}!`);
    countRout(u.side);
    contagion(state, u, MORALE.perRout);
  } else if (next === "wavering" && prev === "routing") {
    signal(state.time, `${u.name} rally.`);
  }
}

// ---------------------------------------------------------------------------
// player action: rally
// ---------------------------------------------------------------------------

export function rally(state: GameState): boolean {
  let did = false;
  for (const o of living(state, "player")) {
    if (o.kind !== "officer" || o.rallyUses <= 0 || state.time < o.rallyReadyAt) continue;
    let n = 0;
    for (const u of living(state, "player")) {
      if (dist(u.x, u.y, o.x, o.y) > RALLY.radius) continue;
      u.morale = clamp(u.morale + RALLY.boost, 0, MORALE.max);
      u.inspiredUntil = state.time + RALLY.immunity;
      if (u.state === "routing" && o.perks.oldSalt) u.state = "wavering";
      n++;
    }
    o.rallyUses--;
    o.rallyReadyAt = state.time + RALLY.cooldown;
    countRally();
    signal(state.time, `${o.name} rallies ${n} — "Stand, you dogs!"`);
    did = true;
  }
  return did;
}

// ---------------------------------------------------------------------------
// outcome — win by breaking their will
// ---------------------------------------------------------------------------

function willBroken(list: Unit[]): boolean {
  return list.length === 0 || list.every((u) => u.state === "routing");
}

function checkOutcome(state: GameState) {
  const p = living(state, "player");
  const e = living(state, "enemy");
  const pb = willBroken(p);
  const eb = willBroken(e);
  if (eb && !pb) {
    state.over = true;
    state.outcome = "The garrison's will breaks — the town is yours to plunder.";
  } else if (pb && !eb) {
    state.over = true;
    state.outcome = "Your band breaks and scatters. The raid fails.";
  } else if (pb && eb) {
    state.over = true;
    state.outcome = "Both sides break — a shambles.";
  }
}

// ---------------------------------------------------------------------------
// one fixed step
// ---------------------------------------------------------------------------

export function stepSim(state: GameState, dt: number) {
  if (state.over) return;
  state.time += dt;
  for (let i = state.flashes.length - 1; i >= 0; i--) {
    state.flashes[i].ttl -= dt;
    if (state.flashes[i].ttl <= 0) state.flashes.splice(i, 1);
  }
  stepMove(state, dt);
  stepCombat(state, dt);
  stepMorale(state, dt);
  checkOutcome(state);
}
