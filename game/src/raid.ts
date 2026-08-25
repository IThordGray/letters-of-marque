import type { World, RaidResult } from "./world";
import type { Unit } from "./types";
import { RAID } from "./constants";
import { dist } from "./math";
import { signal } from "./log";
import { desc } from "./naming";

// The raid scenario layer: the objective (seize it, then carry it), the extraction zone
// (the boats), the alarm (the garrison rouses), and the graded outcome. "Win by breaking
// WILL" is preserved — shaped into an objective raid: take the prize and get it to the
// boats; you lose when your own will breaks. Pure and deterministic; run after
// movement/morale so it reads current positions and states.
export function stepRaid(world: World, dt: number) {
  if (world.over) return;
  const A = RAID.alarm;

  // being spotted starts the clock; time ashore then creeps it up (runners/seizing spike it)
  if (world.raid.alarm === 0 && raidersSpotted(world)) {
    world.raid.alarmHeat = Math.max(world.raid.alarmHeat, A.roused);
  }
  if (world.raid.alarm >= 1) world.raid.alarmHeat += A.perSec * dt;

  const obj = world.raid.objective;

  // a carried prize rides with its carrier; a fallen or broken carrier drops it where he stands
  if (obj && obj.seized && world.raid.carrierId != null) {
    const carrier = world.units.find((u) => u.id === world.raid.carrierId);
    if (!carrier || carrier.state === "down" || carrier.state === "routing") {
      obj.seized = false;
      obj.seizeProgress = 0;
      world.raid.carrierId = null;
      signal(world, "The strongbox is dropped — take it up again!");
    } else {
      obj.x = carrier.x;
      obj.y = carrier.y;
    }
  }

  // seize / re-take the prize when it's on the ground
  if (obj && !obj.seized) {
    let holder: Unit | undefined;
    let best = RAID.seizeRange;
    for (const u of world.units) {
      if (u.side !== "player" || u.state === "down" || u.state === "routing") continue;
      const d = dist(u.x, u.y, obj.x, obj.y);
      if (d <= best) {
        best = d;
        holder = u;
      }
    }
    if (holder) {
      obj.seizeProgress += dt;
      if (obj.seizeProgress >= RAID.seizeTime) {
        obj.seized = true;
        world.raid.carrierId = holder.id;
        world.raid.alarmHeat += A.seizeSpike; // the theft spikes the alarm
        signal(world, `${desc(holder)} takes the strongbox — get it to the boats!`);
      }
    } else {
      obj.seizeProgress = 0; // slip off it and the work is lost
    }
  }

  advanceAlarm(world);
  checkRaidOutcome(world);
}

// Plain-language stage transitions — the alarm reads as a *cause*, never a countdown.
const ALARM_MSG: Record<number, string> = {
  1: "The watch spots you — the garrison rouses and sallies out!",
  2: "A bell begins to ring — the town is alarmed!",
  3: "The garrison turns out in force — a general muster!",
};

function alarmStage(heat: number): number {
  const A = RAID.alarm;
  if (heat >= A.muster) return 3;
  if (heat >= A.full) return 2;
  if (heat >= A.roused) return 1;
  return 0;
}

// The alarm only ever rises — the town doesn't calm mid-raid. Log each new stage.
function advanceAlarm(world: World) {
  const stage = alarmStage(world.raid.alarmHeat);
  if (stage > world.raid.alarm) {
    world.raid.alarm = stage;
    signal(world, ALARM_MSG[stage]);
  }
}

function fighting(u: Unit): boolean {
  return u.state === "steady" || u.state === "wavering";
}

// A dug-in defender rouses once any raider closes within rouseRange of them.
function raidersSpotted(world: World): boolean {
  for (const e of world.units) {
    if (e.side !== "enemy" || e.state === "down") continue;
    for (const p of world.units) {
      if (p.side !== "player" || p.state === "down") continue;
      if (dist(e.x, e.y, p.x, p.y) <= RAID.rouseRange) return true;
    }
  }
  return false;
}

// Graded outcome. The objective is the point and breaking will is the means: you win by
// getting the carried prize to the boats (or clearing the field while you hold it); you
// can withdraw empty-handed and survive; you lose when your band's own will breaks.
function checkRaidOutcome(world: World) {
  if (world.over) return;
  const ext = world.raid.extraction;

  const living = world.units.filter((u) => u.side === "player" && u.state !== "down");
  const atBoats = (u: Unit) => !!ext && u.state !== "routing" && u.y >= ext.y;

  let eFight = 0;
  for (const u of world.units) if (u.side === "enemy" && fighting(u)) eFight++;
  let pFight = 0;
  for (const u of living) if (fighting(u) && !atBoats(u)) pFight++;
  const pDown = world.units.filter((u) => u.side === "player" && u.state === "down").length;

  const carrier = world.raid.carrierId != null ? world.units.find((u) => u.id === world.raid.carrierId) : undefined;
  const held = !!carrier && carrier.state !== "down";

  // success — the carrier gets the prize to the boats, or the field is cleared while held
  if (held && (atBoats(carrier!) || eFight === 0)) {
    const grade: RaidResult = pDown === 0 ? "clean" : "pyrrhic";
    endRaid(
      world,
      grade,
      grade === "clean"
        ? "The prize is away and the band is clear — a clean raid."
        : "The prize is away, but you left men in the streets — a bloody success.",
    );
    return;
  }

  // failed but survived — empty-handed, but the whole living band has pulled back to the boats
  if (!held && living.length > 0 && living.every(atBoats)) {
    endRaid(world, "failed", "You pull back to the boats empty-handed — your people live to raid again.");
    return;
  }

  // disaster — no one left willing to fight and the prize isn't away
  if (pFight === 0) {
    endRaid(world, "disaster", "Your band breaks and scatters — the raid fails.");
  }
}

function endRaid(world: World, result: RaidResult, message: string) {
  world.over = true;
  world.raid.result = result;
  world.outcome = message;
  signal(world, message);
}
