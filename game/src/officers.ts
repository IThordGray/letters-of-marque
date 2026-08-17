import type { World } from "./world";
import type { Unit } from "./types";
import { CARRY, PRESENCE, RALLY, MORALE } from "./constants";
import { clamp, dist } from "./math";
import { signal } from "./log";
import { desc } from "./naming";

// Officers are the connective tissue: their skill lifts the men they lead
// (carry-over), their presence steadies them (aura), and they can rally a break.

// The living officer of a figure's squad — the source of its carry-over.
export function squadOfficer(world: World, u: Unit): Unit | undefined {
  const o = world.units.find((x) => x.id === u.squadId);
  return o && o.kind === "officer" && o.state !== "down" ? o : undefined;
}

// Carry-over: a pirate is lifted a fraction of the way toward his officer's skill.
export function effMarks(world: World, u: Unit): number {
  if (u.kind === "officer") return u.marks;
  const o = squadOfficer(world, u);
  return o ? u.marks + CARRY.fraction * Math.max(0, o.marks - u.marks) : u.marks;
}
export function effFerocity(world: World, u: Unit): number {
  if (u.kind === "officer") return u.ferocity;
  const o = squadOfficer(world, u);
  return o ? u.ferocity + CARRY.fraction * Math.max(0, o.ferocity - u.ferocity) : u.ferocity;
}

// Presence: a proximity aura from any nearby friendly officer — a morale floor and
// some resistance to incoming morale blows.
export function presenceAura(world: World, u: Unit): { floor: number; resilience: number } | null {
  for (const o of world.units) {
    if (o.side !== u.side || o.kind !== "officer" || o.state === "down") continue;
    if (dist(u.x, u.y, o.x, o.y) <= PRESENCE.radius) return { floor: PRESENCE.floor, resilience: PRESENCE.resilience };
  }
  return null;
}

// Rally: every ready player officer restores morale to nearby friends and turns
// routers back to wavering. Fired by the R command.
export function rally(world: World) {
  for (const o of world.units) {
    if (o.side !== "player" || o.kind !== "officer" || o.state === "down") continue;
    if (world.time < o.rallyReadyAt) continue;
    let n = 0;
    for (const u of world.units) {
      if (u.side !== o.side || u.state === "down") continue;
      if (dist(u.x, u.y, o.x, o.y) > RALLY.radius) continue;
      u.morale = clamp(u.morale + RALLY.boost, 0, MORALE.max);
      if (u.state === "routing") u.state = "wavering";
      n++;
    }
    o.rallyReadyAt = world.time + RALLY.cooldown;
    if (n > 0) signal(world, `${desc(o)} rallies the men — "Stand, you dogs!"`);
  }
}
