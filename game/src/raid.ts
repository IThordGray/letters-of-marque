import type { World } from "./world";
import { RAID } from "./constants";
import { dist } from "./math";
import { signal } from "./log";

// The raid scenario layer. For now: the objective — a player figure that holds station
// on it for RAID.seizeTime seizes it. Extraction and the graded outcome arrive in S2;
// the alarm in S5. Pure and deterministic; run after movement/morale so it reads
// current positions and states.
export function stepRaid(world: World, dt: number) {
  if (world.over) return;
  const obj = world.raid.objective;
  if (!obj || obj.seized) return;

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
