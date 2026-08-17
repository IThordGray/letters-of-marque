import type { Unit } from "./types";

// The mutable state of one land battle. Data-oriented: the world owns flat
// collections that pure systems iterate — no behaviour lives on the data itself.

export interface World {
  time: number; // seconds of simulated time elapsed
  units: Unit[]; // array-of-structs — the spine every system walks
  nextId: number; // monotonic id source
}

export function makeWorld(): World {
  return { time: 0, units: [], nextId: 1 };
}
