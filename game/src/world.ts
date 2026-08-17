// The mutable state of one land battle. Data-oriented: the world owns flat
// collections that pure systems iterate — no behaviour lives on the data itself.
// For the scaffold it holds only the clock; the entity store arrives in KAN-4.

export interface World {
  time: number; // seconds of simulated time elapsed
}

export function makeWorld(): World {
  return { time: 0 };
}
