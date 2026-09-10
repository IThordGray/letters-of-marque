// Derived randomness — the world's only source of chance.
//
// [HC-10] Randomness is DERIVED, never consumed in traversal order. Every roll
//         takes its value from a pure function of (world seed, what the roll is
//         for, the id of the thing it is for, when). It must never draw the next
//         number from a shared sequence, because then adding one place silently
//         changes every other place's history — and [HC-11] dies quietly rather
//         than loudly.
// [P-8]  A single sequential stream couples every consumer to every other
//        consumer's CALL ORDER. Hashed per-purpose streams are a pure function,
//        so they survive refactoring, reordering, staggering and LOD.
// [P-5]  Math.random is banned and unseedable anyway.
//
// Contrast with `../rng.ts`, which is a sequential mulberry32 stream and stays
// correct where it is used: a battle, or a founding roll, is ONE linear sequence
// whose order is part of the thing being generated. The world is not — fifty
// places resolve in an order that must not matter. Use `seedFor` to bridge:
// derive a seed here, hand it to `makeRng` there.
//
// Every operation below is exactly specified by ECMA-262 — `Math.imul`, `^`,
// `>>>`, `/` — so a roll is bit-identical on every engine and machine ([P-7]).

// ---- Channels ([HC-90]: data, and integers rather than strings per [P-38]) --
// One channel per *purpose*, so two systems rolling for the same thing on the
// same day cannot collide. Add a channel when a system needs one; never reuse.
export const CHANNEL = {
  land: 1, // a place's founding ground
  weather: 2, // ambient severity within a zone
  storm: 3, // whether an event forms, and where it tracks
  nation: 4, // a crown's tie-breaks
  worldgen: 5, // coastlines, positions, names
  place: 6, // a place's OWN stream — the seed it founds and rolls on
} as const;

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

// ---- The mixer ------------------------------------------------------------
// A 32-bit avalanche in the murmur3 family. Not cryptographic and not trying to
// be: it needs to be fast, exactly reproducible, and to scatter adjacent inputs
// so that (id 1, day 90) and (id 2, day 90) are unrelated.

function mix(h: number, v: number): number {
  h = Math.imul(h ^ (v >>> 0), 0x9e3779b1);
  return h ^ (h >>> 15);
}

function avalanche(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// ---- What callers use -----------------------------------------------------

// A uint32 hash of the four coordinates. The primitive everything else is built
// from, exposed because a seed and a roll want the same mixing.
export function hashOf(seed: number, channel: Channel, id: number, when: number): number {
  let h = seed >>> 0;
  h = mix(h, channel);
  h = mix(h, id);
  h = mix(h, when);
  return avalanche(h);
}

// A roll in [0, 1). 2^32 is exactly representable as a double, so the division
// is exact and the result is bit-identical everywhere.
export const rollOf = (seed: number, channel: Channel, id: number, when: number): number =>
  hashOf(seed, channel, id, when) / 4294967296;

// A seed for a SEQUENTIAL stream (`makeRng` in ../rng.ts), derived from the
// world's. This is the sanctioned bridge: a founding roll is one linear
// sequence, but which sequence it is must be a pure function of the world.
// `when` is omitted deliberately — a place's founding ground does not depend on
// what day anyone asked.
export const seedFor = (seed: number, channel: Channel, id: number): number =>
  hashOf(seed, channel, id, 0);
