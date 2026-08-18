import { UNIT, DEPLOY, SEED } from "./constants";
import { makeRng, nextFloat } from "./rng";
import type { Rng } from "./rng";
import { pickOfficerNames } from "./naming";

// A named officer available on the deploy roster. Rolled stats give each a distinct
// character, so *which* officers you risk ashore is a real choice.
export interface OfficerProfile {
  id: string;
  name: string;
  ferocity: number;
  marks: number;
  morale: number;
}

// What the player draws from at deploy time: a finite pool of unnamed pirates and a
// handful of named officers.
export interface Roster {
  poolSize: number;
  officers: OfficerProfile[];
}

function roll(rng: Rng, base: number, spread: number): number {
  return Math.round(base * (1 + (nextFloat(rng) * 2 - 1) * spread));
}

// A deterministic roster: same seed → same pool + officers (reproducible, testable).
// Uses a stream decoupled from the world's battle rng.
export function makeRoster(): Roster {
  const rng = makeRng((SEED ^ 0x9e3779b9) >>> 0);
  const names = pickOfficerNames(rng, DEPLOY.officerRoster);
  const officers: OfficerProfile[] = names.map((name, i) => ({
    id: `off${i + 1}`,
    name,
    ferocity: roll(rng, UNIT.officer.ferocity, DEPLOY.officerSpread),
    marks: roll(rng, UNIT.officer.marks, DEPLOY.officerSpread),
    morale: roll(rng, UNIT.officer.morale, DEPLOY.officerSpread * 0.6),
  }));
  return { poolSize: DEPLOY.crewPool, officers };
}
