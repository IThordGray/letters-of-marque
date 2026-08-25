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

// The raid scenario layer: the objective to seize (and, from later stories, the
// extraction zone and alarm state). Null objective = a plain battle with no raid.
export interface RaidState {
  objective: { x: number; y: number; seized: boolean; seizeProgress: number } | null;
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
  aiNextAt: number; // sim time of the enemy AI's next decision
  raid: RaidState; // the raid scenario (objective, extraction, alarm)
}

export function makeWorld(): World {
  return {
    time: 0,
    units: [],
    nextId: 1,
    rng: makeRng(SEED),
    log: [],
    flashes: [],
    over: false,
    outcome: "",
    terrain: [],
    aiNextAt: 0,
    raid: { objective: null },
  };
}
