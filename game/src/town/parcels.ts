// The land ring — what a town HAS, which is what decides what it can become.
//
// Read-only forever: an autobiography that explains the town, never an input
// device. The roll is deliberately BIASED — one dominant vocation, one or two
// supporting, the rest filler. A uniform roll makes every town mediocre at
// everything, which is the difference between "towns with slightly different
// numbers" and "towns you can describe in a sentence".

import type { Parcel, ParcelTerrain, ParcelQuality, Bearing } from "./types";
import type { Rng } from "../rng";
import { nextFloat } from "../rng";
import { LAND } from "./constants";

// The terrains a town can be BUILT ON — a vocation is what the place is for.
// `bluff` is never a vocation: it is a defensive gift, not a living.
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
};

const ALL: ParcelTerrain[] = ["timberedHills", "caneFlats", "provisionGrounds", "reef", "roadstead", "bluff"];
// ...the same list without the two water terrains, for when the coast is full.
const INLAND: ParcelTerrain[] = ["timberedHills", "caneFlats", "provisionGrounds", "bluff"];

// The sea lies SOUTH of every town — the same axis the raid map is built on
// (you land on the near/bottom edge and push inland). So water parcels take
// seaward bearings and everything else takes landward ones, which is what lets
// the placement pass put industry on the town edge facing its own land.
const SEAWARD: Bearing[] = ["S", "SE", "SW"];
const LANDWARD: Bearing[] = ["N", "NE", "NW", "E", "W"];
const isWater = (t: ParcelTerrain) => t === "reef" || t === "roadstead";

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

// Hand out bearings so no two parcels sit on top of each other. The invariant that
// matters is one-way: WATER MUST FACE THE SEA. Land takes the inland points by
// preference and only spills onto a spare seaward point once inland is full — a
// town can perfectly well have fields running down to the shore.
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

function shuffle<T>(rng: Rng, xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

// Roll a town's land. Deterministic: the same Rng state always gives the same ring.
export function rollParcels(rng: Rng): Parcel[] {
  const count = LAND.min + Math.floor(nextFloat(rng) * (LAND.max - LAND.min + 1));

  const vocation = pickWeighted(rng, VOCATIONS);
  const terrains: ParcelTerrain[] = [vocation];

  // A town has ONE coast, so it can hold no more water parcels than there are
  // seaward bearings. Once they are spoken for, the rest of the ring is inland.
  const roomForWater = () => terrains.filter(isWater).length < SEAWARD.length;
  const offer = () => (roomForWater() ? ALL : INLAND);

  // One or two supporting parcels drawn from what plausibly lies alongside.
  const supportCount = 1 + (nextFloat(rng) < LAND.secondSupportChance ? 1 : 0);
  for (let i = 0; i < supportCount; i++) {
    const from = SUPPORTING[vocation].filter((t) => !isWater(t) || roomForWater());
    terrains.push(pick(rng, from.length ? from : INLAND));
  }

  // ...and the rest is filler: whatever else the coast happens to offer.
  while (terrains.length < count) terrains.push(pick(rng, offer()));

  const bear = bearings(rng, terrains);
  return terrains.map((terrain, i) => ({
    terrain,
    // The vocation parcel is the rich one — that is what makes the town a town.
    quality: i === 0 ? "rich" : pickQuality(rng, i <= supportCount ? LAND.support : LAND.filler),
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

// A bluff is called nothing about the water: it can sit anywhere on the ring, and
// where the battery actually goes is the placement pass's business (KAN-76).
const LABEL: Record<ParcelTerrain, string> = {
  timberedHills: "timbered hills",
  caneFlats: "cane flats",
  provisionGrounds: "provision grounds",
  reef: "fishing banks",
  roadstead: "a sheltered anchorage",
  bluff: "a high bluff",
};

const QUALIFIER: Record<ParcelQuality, string> = { poor: "poor ", fair: "", rich: "fine " };

// Slot the quality adjective INSIDE the article, so we get "a fine sheltered
// anchorage" rather than "fine a sheltered anchorage".
function phrase(p: Parcel): string {
  const q = QUALIFIER[p.quality];
  const label = LABEL[p.terrain];
  if (label.startsWith("a ")) return q ? `a ${q}${label.slice(2)}` : label;
  return `${q}${label}`;
}

export const describeParcel = (p: Parcel) => `${phrase(p)} to the ${compass(p.bearing)}`;

// What the town is FOR, in a clause — the sentence that makes two towns different.
export function describeLand(parcels: Parcel[]): string {
  if (!parcels.length) return "no land worth the name";
  const seen = new Set<ParcelTerrain>();
  const parts: string[] = [];
  for (const p of parcels) {
    if (seen.has(p.terrain)) continue;
    seen.add(p.terrain);
    parts.push(phrase(p));
    if (parts.length === 3) break;
  }
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const COMPASS: Record<Bearing, string> = {
  N: "north", NE: "north-east", E: "east", SE: "south-east",
  S: "south", SW: "south-west", W: "west", NW: "north-west",
};
export const compass = (b: Bearing) => COMPASS[b];
