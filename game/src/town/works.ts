// The works ledger — the catalogue of what a town can have, and the systems that
// keep it honest (labour, dependencies, decay).
//
// A work is a ledger line with a place attached. Buildings are not simulated;
// works are. Parcel scarcity is the primary growth cap — cap and flavour are the
// same mechanism, so there are no arbitrary limits here beyond the land itself.

import type { Town, Work, WorkKind, WorkClass, Need, ParcelTerrain, ParcelQuality } from "./types";
import { WORKS, QUALITY_YIELD, DECAY } from "./constants";
import { bestOf } from "./parcels";

// Where a work sits when the ledger is projected onto a raid map (KAN-76).
export type Zone = "waterfront" | "lowerTown" | "plaza" | "backTown" | "outworks" | "beyondThePale";

export interface WorkDef {
  label: string; // how it reads in a sentence
  cls: WorkClass;
  cost: number; // wealth to raise; subsistence works are free
  needsParcel: ParcelTerrain | null; // the land it must have
  requires: WorkKind | null; // the dependency edges — exactly two in this slice
  food: number;
  trade: number;
  defence: number;
  hands: number;
  serves: Need | null;
  servesFor: number; // how many souls it satisfies
  max: number; // cap for works that need no parcel (parcel works are capped by land)
  zone: Zone;
  autoPer?: number; // subsistence only: raise one of these per N souls
}

// ---- The catalogue ---------------------------------------------------------
// Six subsistence/civic works that raise themselves, twelve capital works the
// governor chooses between. Two dependency edges only: timber -> shipways and
// sugar -> rum. One level deep, so "the shipways stand idle for want of planks"
// is a chain the player can feel without us simulating logistics.
export const CATALOGUE: Record<WorkKind, WorkDef> = {
  // --- subsistence: free, self-raising, and the reason a sacked town survives
  dwellings: { label: "dwellings", cls: "subsistence", cost: 0, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "shelter", servesFor: 40, max: 99, zone: "lowerTown", autoPer: 40 },
  gardenPlots: { label: "garden plots", cls: "subsistence", cost: 0, needsParcel: null, requires: null,
    food: 30, trade: 0, defence: 0, hands: 6, serves: "food", servesFor: 30, max: 4, zone: "beyondThePale", autoPer: 40 },
  fishingShacks: { label: "fishing shacks", cls: "subsistence", cost: 0, needsParcel: "reef", requires: null,
    food: 22, trade: 2, defence: 0, hands: 4, serves: "food", servesFor: 22, max: 3, zone: "waterfront", autoPer: 50 },
  well: { label: "a well", cls: "subsistence", cost: 0, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "order", servesFor: 30, max: 1, zone: "plaza" },
  chapel: { label: "a chapel", cls: "subsistence", cost: 0, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 1, serves: "worship", servesFor: 60, max: 1, zone: "lowerTown" },
  market: { label: "a market", cls: "subsistence", cost: 0, needsParcel: null, requires: null,
    food: 0, trade: 3, defence: 0, hands: 2, serves: null, servesFor: 0, max: 1, zone: "lowerTown" },

  // --- capital: the twelve the governor weighs against each other
  sawpit: { label: "sawpits", cls: "capital", cost: 260, needsParcel: "timberedHills", requires: null,
    food: 0, trade: 14, defence: 0, hands: 10, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  shipway: { label: "shipways", cls: "capital", cost: 900, needsParcel: "roadstead", requires: "sawpit",
    food: 0, trade: 34, defence: 0, hands: 20, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  caneField: { label: "cane fields", cls: "capital", cost: 220, needsParcel: "caneFlats", requires: null,
    food: 0, trade: 10, defence: 0, hands: 16, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  boilingHouse: { label: "a boiling house", cls: "capital", cost: 700, needsParcel: "caneFlats", requires: "caneField",
    food: 0, trade: 30, defence: 0, hands: 14, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  provisionGround: { label: "provision grounds", cls: "capital", cost: 180, needsParcel: "provisionGrounds", requires: null,
    food: 90, trade: 0, defence: 0, hands: 18, serves: "food", servesFor: 90, max: 9, zone: "beyondThePale" },
  warehouse: { label: "a warehouse", cls: "capital", cost: 320, needsParcel: "roadstead", requires: null,
    food: 0, trade: 12, defence: 0, hands: 6, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  customsHouse: { label: "a customs house", cls: "capital", cost: 480, needsParcel: "roadstead", requires: null,
    food: 0, trade: 16, defence: 0, hands: 6, serves: "order", servesFor: 60, max: 1, zone: "waterfront" },
  battery: { label: "a stone battery", cls: "capital", cost: 620, needsParcel: "bluff", requires: null,
    food: 0, trade: 0, defence: 9, hands: 12, serves: null, servesFor: 0, max: 9, zone: "outworks" },
  palisade: { label: "a palisade", cls: "capital", cost: 240, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 4, hands: 2, serves: null, servesFor: 0, max: 1, zone: "outworks" },
  barracks: { label: "a barracks", cls: "capital", cost: 420, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 5, hands: 10, serves: "order", servesFor: 80, max: 1, zone: "backTown" },
  tavern: { label: "a tavern", cls: "capital", cost: 200, needsParcel: null, requires: null,
    food: 0, trade: 4, defence: 0, hands: 4, serves: "drink", servesFor: 70, max: 2, zone: "lowerTown" },
  church: { label: "a church", cls: "capital", cost: 550, needsParcel: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 3, serves: "worship", servesFor: 200, max: 1, zone: "plaza" },
};

export const CHOOSABLE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "capital");
export const SUBSISTENCE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "subsistence");

// ---- Raising a work --------------------------------------------------------

const working = (t: Town, kind: WorkKind) => t.works.some((w) => w.kind === kind && w.condition === "working");
export const countOf = (t: Town, kind: WorkKind) => t.works.filter((w) => w.kind === kind && w.condition !== "ruin").length;

// How many of a kind the town could still raise. For a work that needs land, this
// is the number of matching parcels — PARCEL SCARCITY IS THE CAP.
export function roomFor(town: Town, kind: WorkKind): number {
  const def = CATALOGUE[kind];
  const ceiling = def.needsParcel
    ? town.parcels.filter((p) => p.terrain === def.needsParcel).length
    : def.max;
  return Math.max(0, Math.min(ceiling, def.max) - countOf(town, kind));
}

// Can it be raised at all? Land and supplier only — WEALTH IS THE BUDGET GATE and
// is checked separately by the governor, never mixed into whether a town wants it.
export function buildable(town: Town, kind: WorkKind): boolean {
  const def = CATALOGUE[kind];
  if (roomFor(town, kind) <= 0) return false;
  if (def.requires && !working(town, def.requires)) return false;
  return true;
}

// The index of the best unused parcel for this work, or null if it needs none.
export function parcelFor(town: Town, kind: WorkKind): number | null {
  const def = CATALOGUE[kind];
  if (!def.needsParcel) return null;
  const taken = new Set(town.works.filter((w) => w.kind === kind && w.condition !== "ruin").map((w) => w.parcel));
  const rank: Record<ParcelQuality, number> = { poor: 0, fair: 1, rich: 2 };
  let best: number | null = null;
  town.parcels.forEach((p, i) => {
    if (p.terrain !== def.needsParcel || taken.has(i)) return;
    if (best === null || rank[p.quality] > rank[town.parcels[best].quality]) best = i;
  });
  return best;
}

// Mint a work, scaled by the quality of the land it sits on. Good land is simply
// worth more — that is how a rich parcel becomes a rich town.
export function raise(town: Town, kind: WorkKind, year: number): Work | null {
  if (!buildable(town, kind)) return null;
  const def = CATALOGUE[kind];
  const parcel = parcelFor(town, kind);
  if (def.needsParcel && parcel === null) return null;
  const q = parcel !== null ? QUALITY_YIELD[town.parcels[parcel].quality] : 1;
  const work: Work = {
    id: town.nextWorkId++,
    kind,
    name: def.label,
    parcel,
    since: year,
    condition: "working",
    idleSince: null,
    food: def.food * q,
    trade: def.trade * q,
    defence: def.defence * q,
    hands: def.hands,
    serves: def.serves,
    servesFor: def.servesFor * q,
  };
  town.works.push(work);
  return work;
}

// ---- The ledger's own upkeep ----------------------------------------------
// Run every season, before anything reads the ledger.

export function stepWorks(town: Town, year: number): void {
  raiseSubsistence(town, year);
  allocateLabour(town);
  devolve(town);
}

// People house and feed themselves without being told to, and without spending a
// coin of the town's wealth. This IS the hamlet floor.
function raiseSubsistence(town: Town, year: number): void {
  for (const kind of SUBSISTENCE) {
    const def = CATALOGUE[kind];
    const want = def.autoPer
      ? Math.ceil(town.population / def.autoPer) // scales with the town
      : town.population >= (WORKS.subsistenceAt[kind] ?? 0)
        ? 1 // ...or simply appears once the place is big enough to warrant it
        : 0;
    while (countOf(town, kind) < want && roomFor(town, kind) > 0) raise(town, kind, year);
  }
}

// Hands are finite. A work nobody can man goes idle — the labour ceiling made
// visible rather than asserted ("there is money and no men").
function allocateLabour(town: Town): void {
  const live = town.works.filter((w) => w.condition === "working" || w.condition === "idle");
  // Feed the town first, then defend it, then earn — a governor's order of nature.
  const worth = (w: Work) => w.food * 3 + w.defence * 2 + w.trade;
  live.sort((a, b) => worth(b) - worth(a));

  let hands = town.population * WORKS.labourShare;
  for (const w of live) {
    const req = CATALOGUE[w.kind].requires;
    const supplied = !req || working(town, req); // "the shipways stand idle for want of planks"
    if (hands >= w.hands && supplied) {
      hands -= w.hands;
      if (w.condition === "idle") w.condition = "working";
      w.idleSince = null;
    } else if (w.condition === "working") {
      w.condition = "idle";
      w.idleSince = town.season;
    }
  }
}

// The devolution ladder: working -> idle -> decayed -> ruin, recoverable at each
// step. Subsistence works never rot — people keep their own roofs on.
function devolve(town: Town): void {
  for (const w of town.works) {
    if (CATALOGUE[w.kind].cls === "subsistence") continue;
    if (w.idleSince === null) continue;
    const idleFor = town.season - w.idleSince;
    if (w.condition === "idle" && idleFor >= DECAY.idleToDecayed) w.condition = "decayed";
    else if (w.condition === "decayed" && idleFor >= DECAY.decayedToRuin) w.condition = "ruin";
  }
  // Ruins are NOT swept from the ledger: the map projection needs them, so your
  // own arson still shows on the ground the next time you come ashore (spec §7).
}

// ---- Reading the ledger ----------------------------------------------------

// How badly each want goes unmet, 0 (satisfied) to 1 (nothing at all). A GOVERNOR
// INPUT — never a bar the player is expected to tend.
export function unmetNeeds(town: Town): Record<Need, number> {
  const out: Record<Need, number> = { food: 0, drink: 0, shelter: 0, worship: 0, order: 0 };
  const souls = Math.max(town.population, 1);
  for (const need of Object.keys(out) as Need[]) {
    const supply = town.works
      .filter((w) => w.condition === "working" && w.serves === need)
      .reduce((s, w) => s + w.servesFor, 0);
    out[need] = Math.max(0, Math.min(1, 1 - supply / souls));
  }
  return out;
}

// Is a downstream work standing idle for want of its supplier? This is the clause
// "the shipways want planks" — the market term's sharpest input.
export function starvedFor(town: Town, kind: WorkKind): boolean {
  return CHOOSABLE.some((k) => {
    const def = CATALOGUE[k];
    return def.requires === kind && roomFor(town, k) > 0;
  });
}

export const bestParcelQuality = (town: Town, kind: WorkKind): ParcelQuality | null => {
  const t = CATALOGUE[kind].needsParcel;
  return t ? (bestOf(town.parcels, t)?.quality ?? null) : null;
};
