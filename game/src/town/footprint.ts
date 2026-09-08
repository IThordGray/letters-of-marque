// The town's built-up ground, and how it grows over a century.
//
// THE LAND A TOWN WORKS IS FIXED AT FOUNDING. What grows is how much of it the
// town has built over. Pure systems over the Town struct — no DOM, no randomness.
//
// The order of relief IS "builds inwards-out": densify first, spill second,
// outside the wall third, and nothing fourth.

import type { Town, Bearing, Footprint, CoreGrade, SpillLevel, ParcelTerrain } from "./types";
import { CATALOGUE } from "./works";
import { FOOTPRINT, SPRAWL } from "./constants";
import { BEARING_ORDER } from "./hex";

export const CORE_WORD = ["scattered", "settled", "close-built", "packed", "stone-built"] as const;
export const SPILL_WORD = ["clear", "skirts", "a suburb", "absorbed"] as const;

export function makeFootprint(): Footprint {
  const spill = {} as Record<Bearing, SpillLevel>;
  for (const b of BEARING_ORDER) spill[b] = 0;
  return { core: 0, spill };
}

// ---- Room, and running out of it -------------------------------------------

// Everything that is not `beyondThePale` stands INSIDE the town. dwellings already
// auto-raise one per forty souls, so population drives the pressure through
// machinery that already exists.
export const inTownWorks = (town: Town) =>
  town.works.filter((w) => w.condition !== "ruin" && CATALOGUE[w.kind].zone !== "beyondThePale").length;

export function room(town: Town): number {
  let r = FOOTPRINT.coreRoom[town.footprint.core];
  for (const b of BEARING_ORDER) r += FOOTPRINT.quarterRoom[town.footprint.spill[b]];
  return r;
}

export const crowding = (town: Town) => inTownWorks(town) / Math.max(1, room(town));

// ---- Where it may spread ---------------------------------------------------

// A town builds over worthless ground first and its own living last. It will
// never build on mangrove or water.
const SPILL_ORDER: ParcelTerrain[] = ["scrub", "bluff", "timberedHills", "provisionGrounds", "caneFlats"];
const canBuildOn = (t: ParcelTerrain) => SPILL_ORDER.includes(t);

// The bearings a standing wall actually encloses. Spilling onto one of these means
// going OUTSIDE the gate — a faubourg.
export function enclosedBearings(town: Town): Set<Bearing> {
  const out = new Set<Bearing>();
  for (const w of town.works) {
    if (w.condition === "ruin" || !w.circuit) continue;
    for (const b of w.circuit) out.add(b);
  }
  return out;
}

// Which way the town grows next. Ordered by what it can afford to lose, and
// tie-broken by EXTENDING AN EXISTING QUARTER — which is what makes a town grow
// lobes rather than a uniform ring.
export function nextBearing(town: Town, outsideWall: boolean): Bearing | null {
  const enclosed = enclosedBearings(town);
  const granted = new Set(town.grantedToTown ?? []);
  let best: { b: Bearing; rank: number; spill: number } | null = null;

  town.parcels.forEach((p) => {
    if (!canBuildOn(p.terrain)) return; // never marsh, never open water
    const level = town.footprint.spill[p.bearing];
    if (level >= 3) return; // already taken entirely
    if (enclosed.has(p.bearing) !== outsideWall) return;
    // A haven owner may open ground to the town; that ground goes first of all.
    const rank = granted.has(p.bearing) ? -1 : SPILL_ORDER.indexOf(p.terrain);
    if (!best || rank < best.rank || (rank === best.rank && level > best.spill)) {
      best = { b: p.bearing, rank, spill: level };
    }
  });
  return best ? (best as { b: Bearing }).b : null;
}

// ---- The season's growth ---------------------------------------------------

export interface Grew {
  kind: "densified" | "spilled" | "faubourg" | "stalled";
  bearing?: Bearing;
  sentence: string;
}

const terrainAt = (town: Town, b: Bearing) => town.parcels.find((p) => p.bearing === b)?.terrain;

const SPILL_CLAUSE: Partial<Record<ParcelTerrain, string>> = {
  scrub: "out over the dry scrub",
  bluff: "up onto the bluff",
  timberedHills: "up toward the timber",
  provisionGrounds: "over the fields",
  caneFlats: "over the cane",
};

export function stepFootprint(town: Town): Grew | null {
  if (crowding(town) < FOOTPRINT.crowdedAt) return null;

  const f = town.footprint;
  const temper = SPRAWL[town.archetype];
  const costToRise = (g: CoreGrade) => FOOTPRINT.densifyCost[g] ?? Infinity;

  // 1. DENSIFY. Building closer costs nothing at first; stone and storeys cost
  //    money, which is why a poor town sprawls and a funded one does not.
  if (f.core < 4 && costToRise(f.core) === 0) return densify(town);

  // 2. SPILL. A town that would rather spread than pay for stone does so here —
  //    that single line is what makes a colony sprawl and a presidio hold.
  if (temper.willSpill && f.core >= temper.densifyFirstTo) {
    const grew = spill(town, false) ?? spill(town, true);
    if (grew) return grew;
  }

  // 3. ...otherwise pay for the stone if the coffers allow.
  if (f.core < 4 && town.wealth >= costToRise(f.core)) {
    town.wealth -= costToRise(f.core);
    return densify(town);
  }

  // 4. A last try at spilling, for a town that could not afford to build upward.
  if (temper.willSpill) {
    const grew = spill(town, false) ?? spill(town, true);
    if (grew) return grew;
  }

  return { kind: "stalled", sentence: "There is nowhere for this place to go." };
}

function densify(town: Town): Grew {
  town.footprint.core = (town.footprint.core + 1) as CoreGrade;
  const word = CORE_WORD[town.footprint.core];
  return {
    kind: "densified",
    sentence:
      town.footprint.core >= 3
        ? `They build close now, and in stone — ${town.name} is ${word}.`
        : `${town.name} builds closer; it is ${word} now.`,
  };
}

function spill(town: Town, outsideWall: boolean): Grew | null {
  const b = nextBearing(town, outsideWall);
  if (!b) return null;
  const level = (town.footprint.spill[b] + 1) as SpillLevel;
  town.footprint.spill[b] = level;
  const where = SPILL_CLAUSE[terrainAt(town, b)!] ?? "outward";
  if (outsideWall) {
    return { kind: "faubourg", bearing: b, sentence: `There are houses outside the gate now, ${where}.` };
  }
  const how = level === 3 ? "has taken the ground entirely" : level === 2 ? "has spread" : "is creeping";
  return { kind: "spilled", bearing: b, sentence: `The town ${how} ${where}.` };
}

// ---- Reading it back -------------------------------------------------------

// Ground the town has built over entirely — its works are gone and no more can be
// raised there. This is the one place the footprint writes into the ledger.
export const isAbsorbed = (town: Town, b: Bearing) => town.footprint.spill[b] >= 3;

export function describeFootprint(town: Town): string {
  const f = town.footprint;
  const quarters = BEARING_ORDER.filter((b) => f.spill[b] > 0);
  if (!quarters.length) return `A ${CORE_WORD[f.core]} town on its own ground.`;
  const enclosed = enclosedBearings(town);
  const out = quarters.filter((b) => enclosed.has(b));
  const parts = [`A ${CORE_WORD[f.core]} town, spread onto ${quarters.length} side${quarters.length > 1 ? "s" : ""}`];
  if (out.length) parts.push(`with houses outside the gate`);
  return parts.join(", ") + ".";
}
