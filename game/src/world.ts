import type { Unit, Terrain, Building } from "./types";
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

// The raid scenario layer: the objective to seize, the extraction zone (the boats), and
// the graded outcome (and, from later stories, the alarm state).
export type RaidResult = "clean" | "pyrrhic" | "failed" | "disaster";

export interface RaidState {
  objective: { x: number; y: number; seized: boolean; seizeProgress: number } | null;
  extraction: { y: number } | null; // a band along the near edge — the boats you landed from
  alarm: number; // 0..3 stage: Quiet / Roused / Alarm / General Muster (derived from alarmHeat, only rises)
  alarmHeat: number; // accumulator that drives the alarm stage (time ashore + seizing + escaping runners)
  carrierId: number | null; // the figure carrying the seized prize (null = it's on the ground)
  result: RaidResult | null; // set once the raid ends
}

// A patrol: a small band walking a fixed waypoint route while the town is dormant. Once
// the alarm is raised the AI takes them over (they stop patrolling and converge).
export interface Patrol {
  members: number[]; // unit ids
  route: { x: number; y: number }[];
  idx: number; // waypoint currently heading to
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
  buildings: Building[]; // the town — structures with a kind + state (loot/raze/torch later)
  patrols: Patrol[]; // enemy patrols walking routes while dormant
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
    buildings: [],
    patrols: [],
    aiNextAt: 0,
    raid: { objective: null, extraction: null, alarm: 0, alarmHeat: 0, carrierId: null, result: null },
  };
}
