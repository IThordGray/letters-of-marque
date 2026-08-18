import type { Unit, Terrain } from "./types";
import type { LogLine } from "./log";
import type { Rng } from "./rng";
import { makeRng } from "./rng";
import { SEED } from "./constants";

// A transient shot line drawn between shooter and target for FLASH.ttl seconds.
export interface Flash {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ttl: number;
  kind: "fire" | "melee";
}

// The mutable state of one land battle. Data-oriented: the world owns flat
// collections that pure systems iterate — no behaviour lives on the data itself.
export interface World {
  time: number; // seconds of simulated time elapsed
  units: Unit[]; // array-of-structs — the spine every system walks
  nextId: number; // monotonic id source
  rng: Rng; // seeded PRNG — battles are reproducible from the seed
  log: LogLine[]; // the signal log (see log.ts)
  flashes: Flash[]; // transient shot lines
  over: boolean; // battle decided
  outcome: string; // how it ended
  terrain: Terrain[]; // static field features (cover / high ground / chokes)
}

export function makeWorld(): World {
  return { time: 0, units: [], nextId: 1, rng: makeRng(SEED), log: [], flashes: [], over: false, outcome: "", terrain: [] };
}
