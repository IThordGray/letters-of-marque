import type { Captain } from "./types";
import { clamp, pick, randInt } from "./math";

// Real-sounding period names. A named captain the tester can get annoyed at is
// the strongest pass signal in the build (§8), so this matters more than it looks.

const SURNAMES = [
  "Ross",
  "Blackwood",
  "Hargreave",
  "Pellew",
  "Coville",
  "Ashby",
  "Merrick",
  "Danforth",
  "Whitlock",
  "Carrow",
  "Sackville",
  "Fenwick",
  "Loveless",
  "Trelawny",
  "Ganton",
  "Marsh",
  "Ridley",
  "Ledbury",
  "Havelock",
  "Prowse",
];

const RANK = ["Capt.", "Cdr.", "Lt."];

const SHIP_NAMES = [
  "Aurora",
  "Kestrel",
  "Wanderer",
  "Sirena",
  "Tempest",
  "Vanguard",
  "Reliant",
  "Sparrowhawk",
  "Indefatigable",
  "Resolute",
  "Firebrand",
  "Nightingale",
  "Vigilant",
  "Corsair",
  "Amethyst",
  "Thunderer",
];

// Draw without replacement so no two ships share a name in one battle.
export function makeDrawer<T>(pool: readonly T[]): () => T {
  const bag = [...pool];
  return () => {
    if (bag.length === 0) bag.push(...pool);
    const i = Math.floor(Math.random() * bag.length);
    return bag.splice(i, 1)[0];
  };
}

export function makeShipNameDrawer() {
  return makeDrawer(SHIP_NAMES);
}

export function makeCaptain(drawSurname: () => string): Captain {
  return {
    name: `${pick(RANK)} ${drawSurname()}`,
    aggression: randInt(-100, 100),
    obedience: randInt(-100, 100),
    nerve: randInt(-100, 100),
  };
}

export function makeSurnameDrawer() {
  return makeDrawer(SURNAMES);
}

// -- Descriptive temperament text (players see words, never numbers) ---------

function band(v: number, lo: string, midLow: string, mid: string, midHigh: string, hi: string): string {
  if (v > 55) return hi;
  if (v > 20) return midHigh;
  if (v >= -20) return mid;
  if (v >= -55) return midLow;
  return lo;
}

export function aggressionWord(v: number): string {
  return band(v, "Timid", "Cautious", "Steady", "Aggressive", "Reckless");
}

export function obedienceWord(v: number): string {
  return band(v, "Mutinous", "Wilful", "Dependable", "Compliant", "By-the-book");
}

export function nerveWord(v: number): string {
  return band(v, "Faint-hearted", "Skittish", "Level-headed", "Stout", "Iron-nerved");
}

export function temperamentLine(c: Captain): string {
  return `${aggressionWord(c.aggression)} · ${obedienceWord(c.obedience)} · ${nerveWord(c.nerve)}`;
}

// Short lowercase fragment for signal-log colour, e.g. "the reckless Ross".
export function shortTrait(c: Captain): string {
  const v = clamp(c.aggression, -100, 100);
  return aggressionWord(v).toLowerCase();
}
