// Deterministic PRNG (mulberry32). Its state lives in the world so battles are
// reproducible and headless-testable — same seed, same battle. The morale state
// machine stays deterministic regardless; only lethality draws from this.

export interface Rng {
  s: number;
}

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

// Next float in [0, 1). Mutates the state.
export function nextFloat(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) | 0;
  let t = Math.imul(rng.s ^ (rng.s >>> 15), 1 | rng.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
