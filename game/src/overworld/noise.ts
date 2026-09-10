// Value noise — the world's shape as arithmetic rather than as a stored bitmap.
//
// [P-17] Anything that is a pure function of (identity, time, seed) is computed
//        on demand, never stepped and never stored. The world's geography is the
//        purest case there is: it is a pure function of (seed, position), so
//        there is no heightmap, no tile array and no grid anywhere in this
//        module. You ask the field a question at a position and it answers.
// [HC-14] Store almost nothing. A 1,500 x 800 nm sea at even one sample per
//        nautical mile would be 1.2 million cells; at the two-mile resolution a
//        town's own coast needs, far more. None of it exists.
// [P-5]  Every operation here is `+ - * / Math.floor` and the audited mixer in
//        `chance.ts`. No transcendental, no gradient table of angles, so the same
//        seed draws the same coastline on every engine and machine ([HC-11]).
//
// Value noise rather than gradient (Perlin) noise, deliberately: gradient noise
// wants a table of unit vectors, and the classic way to build one is `cos`/`sin`.
// Value noise wants nothing but a hash, and at six octaves the difference is not
// visible in a coastline.

import { CHANNEL, hashOf } from "./chance";

// A field's own seed. Two fields drawn from one world must not correlate — the
// coast and the rainfall are not the same fact — so each gets its own avalanche
// of the world seed. Computed once per field and never per sample ([P-18]).
export const fieldSeed = (seed: number, field: number): number =>
  hashOf(seed, CHANNEL.worldgen, field, 0x9e37);

// The lattice value in [0, 1). 2^32 is exactly representable as a double, so the
// division is exact ([P-7]).
const at = (fs: number, ix: number, iy: number): number =>
  hashOf(fs, CHANNEL.worldgen, ix, iy) / 4294967296;

// Smoothstep. Gives the field a continuous first derivative, which is what stops
// the lattice showing through as a diamond quilt.
const smooth = (t: number) => t * t * (3 - 2 * t);

// One octave, bilinearly interpolated. `wave` is the lattice spacing in the same
// units as `x` and `y` — nautical miles, everywhere in this project.
export function noiseAt(fs: number, x: number, y: number, wave: number): number {
  const u = x / wave;
  const v = y / wave;
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = smooth(u - ix);
  const fy = smooth(v - iy);
  const a = at(fs, ix, iy);
  const b = at(fs, ix + 1, iy);
  const c = at(fs, ix, iy + 1);
  const d = at(fs, ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

// A fractal sum: `octaves` doublings of frequency, each half the weight of the
// last, normalised back to roughly 0..1 and centred near 0.5.
//
// THE POINT OF THE OCTAVES, and it is a design property rather than a technique:
// one field answers at every scale it is asked about. The world map reads it at
// two hundred miles and gets bays; a town's own coast reads the same field at two
// miles and gets headlands. A place's local shore is therefore not a second,
// smaller invention — it is the same geography, closer up ([HC-19]).
//
// Each octave takes its own lattice (`fs + i`), because octaves sharing one
// lattice line up at its corners and the sum grows a visible grain.
export function fbm(fs: number, x: number, y: number, wave: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let w = wave;
  for (let i = 0; i < octaves; i++) {
    sum += noiseAt(fs + i, x, y, w) * amp;
    norm += amp;
    amp *= 0.5;
    w *= 0.5;
  }
  return sum / norm;
}
