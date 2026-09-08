// The land ring — what a town HAS, which is what decides what it can become.
//
// EXACTLY SIX parcels on a flat-top hex ring. One hex = one parcel, never
// subdivided: that is the rule that stops a tile map diluting every town into
// mediocrity. The roll is deliberately BIASED — one dominant vocation, one or two
// supporting, the rest filler (some of it dead ground).
//
// Read-only in a foreign town; steerable thematically where you have a say; and
// grantable only in a haven you own (KAN-81).

import type { Parcel, ParcelTerrain, ParcelQuality, Bearing } from "./types";
import type { Rng } from "../rng";
import { nextFloat } from "../rng";
import { LAND } from "./constants";

// The terrains a town can be BUILT ON — a vocation is what the place is for.
// `bluff` is never a vocation: it is a defensive gift, not a living. Nor is dead
// ground, obviously.
const VOCATIONS: { terrain: ParcelTerrain; weight: number }[] = [
  { terrain: "timberedHills", weight: 3 },
  { terrain: "caneFlats", weight: 3 },
  { terrain: "provisionGrounds", weight: 2 },
  { terrain: "roadstead", weight: 2 },
  { terrain: "reef", weight: 1 }, // a fishing town is poor by nature — rarer as a calling
];

// What tends to lie next to what. A cane town wants provision grounds to feed the
// hands; a timber town wants a roadstead to ship the planks out.
const SUPPORTING: Record<ParcelTerrain, ParcelTerrain[]> = {
  timberedHills: ["roadstead", "provisionGrounds", "bluff"],
  caneFlats: ["provisionGrounds", "roadstead", "reef"],
  provisionGrounds: ["timberedHills", "caneFlats", "reef"],
  roadstead: ["bluff", "provisionGrounds", "timberedHills"],
  reef: ["provisionGrounds", "roadstead", "bluff"],
  bluff: ["roadstead", "timberedHills"],
  marsh: ["provisionGrounds", "reef"],
  scrub: ["provisionGrounds", "timberedHills"],
  openSea: ["reef", "roadstead"],
};

// Filler is what the rest of the coast happens to offer — and a fair share of it
// is worth nothing. Dead ground is the whole source of variety now that the count
// is fixed at six.
const FILLER_LAND: { terrain: ParcelTerrain; weight: number }[] = [
  { terrain: "timberedHills", weight: 3 },
  { terrain: "caneFlats", weight: 3 },
  { terrain: "provisionGrounds", weight: 3 },
  { terrain: "bluff", weight: 2 },
  { terrain: "scrub", weight: 4 }, // dead
  { terrain: "marsh", weight: 3 }, // dead, but slows a raider
];
const FILLER_ANY: { terrain: ParcelTerrain; weight: number }[] = [
  ...FILLER_LAND,
  { terrain: "reef", weight: 2 },
  { terrain: "roadstead", weight: 1 },
  { terrain: "openSea", weight: 4 }, // dead
];

// The sea lies SOUTH of every town — the same axis the raid map is built on (you
// land on the near edge and push inland). Flat-top hexes give exactly three
// seaward and three landward directions.
const SEAWARD: Bearing[] = ["S", "SE", "SW"];
const LANDWARD: Bearing[] = ["N", "NE", "NW"];

export const isWater = (t: ParcelTerrain) => t === "reef" || t === "roadstead" || t === "openSea";
// Dead ground: drawn and named, but it yields nothing and carries no work.
export const isDead = (t: ParcelTerrain) => t === "marsh" || t === "scrub" || t === "openSea";

const pick = <T>(rng: Rng, xs: T[]): T => xs[Math.floor(nextFloat(rng) * xs.length)];

function pickWeighted(rng: Rng, xs: { terrain: ParcelTerrain; weight: number }[]): ParcelTerrain {
  const total = xs.reduce((s, x) => s + x.weight, 0);
  let r = nextFloat(rng) * total;
  for (const x of xs) if ((r -= x.weight) <= 0) return x.terrain;
  return xs[xs.length - 1].terrain;
}

function pickQuality(rng: Rng, table: { poor: number; fair: number; rich: number }): ParcelQuality {
  const r = nextFloat(rng);
  if (r < table.rich) return "rich";
  if (r < table.rich + table.fair) return "fair";
  return "poor";
}

function shuffle<T>(rng: Rng, xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

// One-way rule: WATER MUST FACE THE SEA. Land takes the inland points by
// preference and spills onto a spare seaward point once inland is full — fields
// may run down to the shore, but a harbour is never inland.
function bearings(rng: Rng, terrains: ParcelTerrain[]): Bearing[] {
  const sea = [...SEAWARD];
  const land = [...LANDWARD];
  shuffle(rng, sea);
  shuffle(rng, land);
  const out: Bearing[] = new Array(terrains.length);
  terrains.forEach((t, i) => {
    if (isWater(t)) out[i] = sea.shift()!;
  });
  terrains.forEach((t, i) => {
    if (!isWater(t)) out[i] = (land.shift() ?? sea.shift())!;
  });
  return out;
}

// Roll a town's land. Deterministic: the same Rng state always gives the same ring.
export function rollParcels(rng: Rng): Parcel[] {
  const vocation = pickWeighted(rng, VOCATIONS);
  const terrains: ParcelTerrain[] = [vocation];

  // A town has ONE coast, so it can hold no more water hexes than there are
  // seaward bearings.
  const roomForWater = () => terrains.filter(isWater).length < SEAWARD.length;

  // One or two supporting parcels drawn from what plausibly lies alongside.
  const supportCount = 1 + (nextFloat(rng) < LAND.secondSupportChance ? 1 : 0);
  for (let i = 0; i < supportCount; i++) {
    const from = SUPPORTING[vocation].filter((t) => !isWater(t) || roomForWater());
    terrains.push(from.length ? pick(rng, from) : pickWeighted(rng, FILLER_LAND));
  }

  // ...and the rest is filler, dead ground included.
  while (terrains.length < LAND.ring) {
    terrains.push(pickWeighted(rng, roomForWater() ? FILLER_ANY : FILLER_LAND));
  }

  const bear = bearings(rng, terrains);
  return terrains.map((terrain, i) => ({
    terrain,
    // The vocation parcel is the rich one — that is what makes the town a town.
    // Dead ground has no grade worth speaking of.
    quality: isDead(terrain) ? "poor" : i === 0 ? "rich" : pickQuality(rng, i <= supportCount ? LAND.support : LAND.filler),
    bearing: bear[i],
  }));
}

// ---- Reading the land back -------------------------------------------------

export const vocationOf = (parcels: Parcel[]): ParcelTerrain | null => parcels[0]?.terrain ?? null;

export function has(parcels: Parcel[], terrain: ParcelTerrain): boolean {
  return parcels.some((p) => p.terrain === terrain);
}

// The best grade of a given terrain the town holds, or null if it has none.
export function bestOf(parcels: Parcel[], terrain: ParcelTerrain): Parcel | null {
  const rank = { poor: 0, fair: 1, rich: 2 };
  let best: Parcel | null = null;
  for (const p of parcels) {
    if (p.terrain !== terrain) continue;
    if (!best || rank[p.quality] > rank[best.quality]) best = p;
  }
  return best;
}

// How much of the ring is worth nothing — the town's visible ceiling.
export const deadCount = (parcels: Parcel[]) => parcels.filter((p) => isDead(p.terrain)).length;

const LABEL: Record<ParcelTerrain, string> = {
  timberedHills: "timbered hills",
  caneFlats: "cane flats",
  provisionGrounds: "provision grounds",
  reef: "fishing banks",
  roadstead: "a sheltered anchorage",
  bluff: "a high bluff",
  marsh: "mangrove marsh",
  scrub: "dry scrub",
  openSea: "open water",
};

const QUALIFIER: Record<ParcelQuality, string> = { poor: "poor ", fair: "", rich: "fine " };

// Slot the quality adjective INSIDE the article, so we get "a fine sheltered
// anchorage" rather than "fine a sheltered anchorage". Dead ground takes no
// qualifier at all — there is no such thing as fine marsh.
function phrase(p: Parcel): string {
  const label = LABEL[p.terrain];
  if (isDead(p.terrain)) return label;
  const q = QUALIFIER[p.quality];
  if (label.startsWith("a ")) return q ? `a ${q}${label.slice(2)}` : label;
  return `${q}${label}`;
}

export const describeParcel = (p: Parcel) => `${phrase(p)} to the ${compass(p.bearing)}`;

// What the town is FOR, in a clause — the sentence that makes two towns different.
export function describeLand(parcels: Parcel[]): string {
  const live = parcels.filter((p) => !isDead(p.terrain));
  if (!live.length) return "nothing but dead ground";
  const seen = new Set<ParcelTerrain>();
  const parts: string[] = [];
  for (const p of live) {
    if (seen.has(p.terrain)) continue;
    seen.add(p.terrain);
    parts.push(phrase(p));
    if (parts.length === 3) break;
  }
  const land = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const dead = deadCount(parcels);
  // The ceiling, said out loud — the whole point of drawing dead ground.
  return dead >= 3 ? `${land}, and poor ground on ${dead} sides` : land;
}

const COMPASS: Record<Bearing, string> = {
  N: "north", NE: "north-east", SE: "south-east", S: "south", SW: "south-west", NW: "north-west",
};
export const compass = (b: Bearing) => COMPASS[b];
