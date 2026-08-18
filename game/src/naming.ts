import type { Unit, Cause } from "./types";
import type { Rng } from "./rng";
import { nextFloat } from "./rng";

// Human-readable descriptors for the signal log, plus the officer name pool. Kept in
// one place so every system names figures and causes the same way.

const OFFICER_NAMES = [
  "Bloody Tom",
  "One-Eyed Jack",
  "Mad Meg",
  "Silas Crane",
  "Gallows Kate",
  "Black Ned",
  "Salty Pete",
  "Ruth the Knife",
  "Long Dupree",
  "Cutlass Sal",
  "Ezra Vane",
  "Hound Bellamy",
];

// Pick `count` distinct officer names using the given rng (deterministic per seed).
export function pickOfficerNames(rng: Rng, count: number): string[] {
  const pool = [...OFFICER_NAMES];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const j = Math.floor(nextFloat(rng) * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

export function desc(u: Unit): string {
  if (u.name) return u.side === "player" ? u.name : `Enemy ${u.name}`;
  return `${u.side === "player" ? "Our" : "Enemy"} ${u.kind}`;
}

export function causePhrase(c: Cause): string {
  switch (c) {
    case "flank":
      return "taken in the flank";
    case "rear":
      return "hit from behind";
    case "melee":
      return "cut down at close quarters";
    case "friend-down":
      return "shaken by the men falling around them";
    case "fire":
      return "under withering fire";
    default:
      return "under fire";
  }
}
