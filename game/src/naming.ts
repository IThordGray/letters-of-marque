import type { Unit, Cause } from "./types";

// Human-readable descriptors for the signal log. Kept in one place so every system
// names figures and causes the same way.

export function desc(u: Unit): string {
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
