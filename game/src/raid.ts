import type { World, RaidResult } from "./world";
import type { Unit } from "./types";
import { RAID } from "./constants";
import { dist } from "./math";
import { signal } from "./log";

// The raid scenario layer: the objective (seize it), the extraction zone (the boats), and
// the graded outcome. "Win by breaking WILL" is preserved — only now it's shaped into an
// objective raid: take the prize and get it to the boats; you lose when your own will
// breaks. Pure and deterministic; run after movement/morale so it reads current state.
export function stepRaid(world: World, dt: number) {
  if (world.over) return;

  const obj = world.raid.objective;
  if (obj && !obj.seized) {
    let onIt = false;
    for (const u of world.units) {
      if (u.side !== "player" || u.state === "down" || u.state === "routing") continue;
      if (dist(u.x, u.y, obj.x, obj.y) <= RAID.seizeRange) {
        onIt = true;
        break;
      }
    }
    if (onIt) {
      obj.seizeProgress += dt;
      if (obj.seizeProgress >= RAID.seizeTime) {
        obj.seized = true;
        signal(world, "The strongbox is seized — now get it to the boats!");
      }
    } else {
      obj.seizeProgress = 0; // slip off it and the work is lost
    }
  }

  checkRaidOutcome(world);
}

function fighting(u: Unit): boolean {
  return u.state === "steady" || u.state === "wavering";
}

// Graded outcome. The objective is the point and breaking will is the means: you win by
// getting the seized prize to the boats (or clearing the field once you hold it); you can
// withdraw empty-handed and survive; you lose when your band's own will breaks.
function checkRaidOutcome(world: World) {
  if (world.over) return;
  const obj = world.raid.objective;
  const ext = world.raid.extraction;
  const seized = !!obj?.seized;

  const living = world.units.filter((u) => u.side === "player" && u.state !== "down");
  const atBoats = (u: Unit) => !!ext && u.state !== "routing" && u.y >= ext.y;

  let eFight = 0;
  for (const u of world.units) if (u.side === "enemy" && fighting(u)) eFight++;
  let pFight = 0;
  for (const u of living) if (fighting(u) && !atBoats(u)) pFight++;
  const pDown = world.units.filter((u) => u.side === "player" && u.state === "down").length;

  // success — the prize is seized and either aboard, or the field is clear to carry it out
  if (seized && (living.some(atBoats) || eFight === 0)) {
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
  if (obj && !seized && living.length > 0 && living.every(atBoats)) {
    endRaid(world, "failed", "You pull back to the boats empty-handed — your people live to raid again.");
    return;
  }

  // disaster — no one left willing to fight (and the prize isn't away)
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
