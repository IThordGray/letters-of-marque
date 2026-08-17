import type { World } from "./world";

// The signal log — the running, cause-naming account of the battle. It is what
// makes a rout read as "taken in the flank", not a bug. Lines are appended with
// the sim time; the UI shows the tail.

export interface LogLine {
  t: number; // sim time, seconds
  msg: string;
}

export function signal(world: World, msg: string) {
  world.log.push({ t: world.time, msg });
}
