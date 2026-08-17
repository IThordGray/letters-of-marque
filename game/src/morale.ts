import type { World } from "./world";
import type { Unit, Cause, UnitState } from "./types";
import { MORALE } from "./constants";
import { signal } from "./log";
import { clamp, dist } from "./math";
import { desc, causePhrase } from "./naming";

// Apply a morale blow and remember its cause (for legible logs + the recovery
// cooldown). The single entry point combat calls when a figure is shot at / hit.
export function applyMorale(world: World, u: Unit, amount: number, cause: Cause) {
  u.morale = clamp(u.morale - amount, 0, MORALE.max);
  u.lastCause = cause;
  u.lastHitAt = world.time;
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
    if (u.state === "down") continue;
    const calm = world.time - u.lastHitAt > MORALE.contactCooldown && !enemyNear(world, u);
    if (calm) u.morale = clamp(u.morale + MORALE.rallyRate * dt, 0, MORALE.max);

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
  u.state = next;
  if (next === "wavering" && prev === "steady") signal(world, `${desc(u)} waver — ${causePhrase(u.lastCause)}.`);
  else if (next === "routing") signal(world, `${desc(u)} break and run — ${causePhrase(u.lastCause)}!`);
  else if (next === "wavering" && prev === "routing") signal(world, `${desc(u)} rally and turn back.`);
}
