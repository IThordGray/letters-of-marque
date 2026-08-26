import type { World } from "./world";
import type { Unit, Cause, UnitState } from "./types";
import { MORALE, TERRAIN, RAID } from "./constants";
import { signal } from "./log";
import { clamp, dist } from "./math";
import { desc, causePhrase } from "./naming";
import { presenceAura } from "./officers";
import { terrainAt } from "./terrain";

// Apply a morale blow and remember its cause (for legible logs + the recovery
// cooldown). The single entry point combat calls when a figure is shot at / hit.
export function applyMorale(world: World, u: Unit, amount: number, cause: Cause) {
  u.morale = clamp(u.morale - amount, 0, MORALE.max);
  u.lastCause = cause;
  u.lastHitAt = world.time;
}

// A friend falling or breaking nearby shakes the men around them.
export function contagion(world: World, source: Unit, amount: number) {
  for (const u of world.units) {
    if (u.side !== source.side || u.state === "down" || u.id === source.id) continue;
    if (dist(u.x, u.y, source.x, source.y) <= MORALE.contagionRadius) {
      applyMorale(world, u, amount, "friend-down");
    }
  }
}

function enemyNear(world: World, u: Unit): boolean {
  for (const o of world.units) {
    if (o.side === u.side || o.state === "down") continue;
    if (dist(u.x, u.y, o.x, o.y) < MORALE.enemyNearDist) return true;
  }
  return false;
}

// Recover morale out of contact, then run the state machine. The transition is
// DETERMINISTIC given morale (legible, never a per-frame dice roll) — that is what
// makes a rout read as a cause, not a bug.
export function stepMorale(world: World, dt: number) {
  for (const u of world.units) {
    if (u.state === "down" || u.state === "surrendered") continue; // out of the fight — no recovery
    const terr = terrainAt(world, u.x, u.y);
    const calm = world.time - u.lastHitAt > MORALE.contactCooldown && !enemyNear(world, u);
    if (calm) {
      const rate = MORALE.rallyRate + (terr === "cover" ? TERRAIN.coverRallyBonus : 0);
      u.morale = clamp(u.morale + rate * dt, 0, MORALE.max);
    }

    // an officer's presence pulls nearby men up toward a morale floor
    const aura = presenceAura(world, u);
    if (aura && u.morale < aura.floor) u.morale = clamp(u.morale + MORALE.rallyRate * dt, 0, aura.floor);
    // high ground holds a mild morale floor of its own
    if (terr === "highGround" && u.morale < TERRAIN.highGroundFloor)
      u.morale = clamp(u.morale + MORALE.rallyRate * dt, 0, TERRAIN.highGroundFloor);

    const next = stateFromMorale(u.morale, u.state);
    if (next !== u.state) transition(world, u, next);
  }
}

function stateFromMorale(m: number, cur: UnitState): UnitState {
  const h = MORALE.hysteresis;
  if (cur === "steady") return m < MORALE.steadyAbove ? "wavering" : "steady";
  if (cur === "wavering") {
    if (m > MORALE.steadyAbove + h) return "steady";
    if (m < MORALE.waverAbove) return "routing";
    return "wavering";
  }
  if (cur === "routing") return m > MORALE.waverAbove + h ? "wavering" : "routing";
  return cur;
}

function transition(world: World, u: Unit, next: UnitState) {
  const prev = u.state;
  // a breaking defender hemmed in by raiders throws down his arms rather than run and be shot
  if (next === "routing" && u.side === "enemy" && cornered(world, u)) {
    u.state = "surrendered";
    signal(world, `${desc(u)} throws down his arms — he yields!`);
    contagion(world, u, MORALE.perRout);
    return;
  }
  u.state = next;
  if (next === "wavering" && prev === "steady") signal(world, `${desc(u)} waver — ${causePhrase(u.lastCause)}.`);
  else if (next === "routing") {
    signal(world, `${desc(u)} break and run — ${causePhrase(u.lastCause)}!`);
    contagion(world, u, MORALE.perRout);
  } else if (next === "wavering" && prev === "routing") signal(world, `${desc(u)} rally and turn back.`);
}

// Hemmed in? Count nearby live enemies-of-u; enough of them and a dash for the edge is
// suicide, so he gives up instead.
function cornered(world: World, u: Unit): boolean {
  let near = 0;
  for (const o of world.units) {
    if (o.side === u.side || o.state === "down" || o.state === "surrendered") continue;
    if (dist(u.x, u.y, o.x, o.y) <= RAID.surrender.range) near++;
  }
  return near >= RAID.surrender.minThreat;
}
