// The land — an irregular coast divided into contiguous regions.
//
// A TOWN IS WHAT MOST OF ITS GROUND IS FOR. Identity comes from proportion (how
// much of the ground is cane), the dominant region (what the place is for), and
// shape (which way it runs and what it touches).
//
// See docs/knowledge/spec/town-economy.md §2.
//
// WHAT DIED HERE, and when (KAN-103 inverted it, KAN-98 executed it). A town no
// longer rolls its own coast, and as of KAN-98 it no longer has a stand-in that
// does either. [HC-19] makes the world map the single source of geography, so a
// place's ground is CUT from the map at its position by
// `overworld/ground.ts` and handed to `foundTown` — one row of the closed list
// of external inputs a place accepts, [HC-72]. Gone with the generator:
// `rollLand`, `provisionalGround`, the terrain-produce table (now the world's,
// in `overworld/climate.ts`), the vocation and support tables, and every mention
// of `southness` in the simulation.
//
// WHAT SURVIVED, and why it is not a contradiction. The hex map and the ground
// plan still draw water to the south. That is a DRAWING convention, not a
// geographic claim ([HC-73]): the world holds a place's true coastal bearing,
// and the cut rotates the world into a town-local frame whose south is seaward.
// A rotation preserves the readability rule exactly, whichever way the real
// coast faces — which is why the reading half of this file outlived the rolling
// half.

import type { Region, TerrainKind, Produce, Suit, Bearing, Town } from "./types";
import type { Axial } from "./hex";
import { key } from "./hex";

// ---- What the ground is ----------------------------------------------------

export const isWater = (t: TerrainKind) => t === "reef" || t === "roadstead" || t === "openSea";
export const isDead = (t: TerrainKind) => t === "marsh" || t === "scrub" || t === "openSea";
// Ground the town can build houses on. Never mangrove, never water.
export const isBuildable = (t: TerrainKind) => !isWater(t) && t !== "marsh";

// ---- The struct the world hands over ---------------------------------------
// Everything a place is given about its ground, and the whole of it. The town
// stores it and never asks the world anything else ([HC-71]).
export interface Land {
  land: Axial[];
  water: Axial[];
  regions: Region[];
}

// ---- Reading the land back -------------------------------------------------

export const regionOf = (town: Town, id: number) => town.regions.find((r) => r.id === id) ?? null;
export const liveRegions = (town: Town) => town.regions.filter((r) => !isDead(r.terrain));

// The hexes the town has built over, as a key set. HOISTED so a caller with
// several regions to ask about builds it ONCE ([P-18]) — the focus auction asks
// about every region in the town in one breath, and the claimed set cannot
// change while it does.
//
// IT IS NOT THE SAME QUESTION AS `takenHexes` AND MUST NOT BE FOLDED INTO IT.
// Exactly one rule reads it: a growth focus locks the moment ground is CLAIMED
// under it, because that hex is the cost becoming real ("there are houses on it
// now"). A work standing on the ground is not that, and never was.
export const claimedKeys = (town: Town): Set<string> => new Set(town.footprint.claimed.map(key));

// Ground already spoken for: built over by the town, or carrying a work.
//
// IT MOVED HERE FROM `works.ts` UNDER KAN-134, and the move is what makes the
// next function honest rather than a tidy: `capacityOf` has to subtract exactly
// this set, `land.ts` is the lower layer, and a work's hex is a fact about the
// ground it stands on. `works.ts` re-exports it, so every existing reader is
// unchanged.
export function takenHexes(town: Town): Set<string> {
  const taken = new Set(town.footprint.claimed.map(key));
  for (const w of town.works) if (w.hex && w.condition !== "ruin") taken.add(key(w.hex));
  return taken;
}

// Ground still available to work: a region's area LESS EVERYTHING ALREADY
// SPOKEN FOR — the ground the town has built over, and the ground something is
// already standing on. Growth eats its own cause, and so does building.
//
// IT COUNTED ONLY THE FOOTPRINT UNTIL KAN-134, and the works standing on a
// region were invisible to it. That is not a rounding error: `[HC-98]` raises
// subsistence works on any ground the town holds, so the hamlet floor can fill
// a three-hex region with garden plots before its governor has saved up for a
// farm — and the region went on reading as three hexes of free ground.
// Measured across four warm worlds, seventeen regions were given over to
// production and then had no hex left to put a work on, and NOTHING WAS EVER
// SAID: the deepening's own room reading was zero, so the candidate scored zero
// and was dropped before it could write a clause.
//
// ONE PATH TO THE NUMBER ([P-47]), and there are now three readers of it that
// used to disagree: the focus auction's "how much of it is still free", the
// deepening's room reading, and the map's region summary — which subtracted the
// works itself, by hand, on the other side of the module.
//
// [P-18]: the optional second argument is the same set this function would have
// built for itself, handed in by a caller asking about more than one region. It
// is never a different rule, only a cheaper way to ask the same one.
//
// [P-32]: an indexed count rather than `filter().length`, which is what it was.
// Three readers ask this per region per season now instead of one, and there is
// no reason for the answer to a question about a number to arrive in an array.
export function capacityOf(town: Town, r: Region, taken = takenHexes(town)): number {
  let free = 0;
  for (let i = 0; i < r.hexes.length; i++) if (!taken.has(key(r.hexes[i]))) free++;
  return free;
}

// WHAT A STRETCH OF GROUND IS BEST FOR — the question a region focus asks, and
// the only reading of `bears` that answers it.
//
// [P-10] THE TIE-BREAK NEEDS A STATED DIRECTION, and this one is the module's
// own: BREAD FIRST, THEN WHAT BUILDS, THEN WHAT SELLS. It is the same order
// `worthOf` ranks works by and the same order [HC-78] pays in — so ground that
// bears food as well as it bears cane is food ground, and a town whose best
// acre could go either way feeds itself with it. Reading `Object.keys(r.bears)`
// instead would have ordered it by however the world's cut happened to fill the
// record in, which is a producer's order and not a rule.
export const PRODUCE_ORDER: Produce[] = ["food", "fish", "grain", "timber", "stone", "cane", "cotton", "salt"];

// How good a grade is, as a number. ONE TABLE ([P-47]) — `regionsFor` ranks the
// ground a work may stand on by it, and `bestBorne` ranks what a region bears by
// it, and those are the same question asked from two ends.
export const SUIT_RANK: Record<Suit, number> = { ideal: 3, fair: 2, poor: 1 };

export function bestBorne(r: Region): { produce: Produce; suit: Suit } | null {
  let best: { produce: Produce; suit: Suit } | null = null;
  for (let i = 0; i < PRODUCE_ORDER.length; i++) {
    const p = PRODUCE_ORDER[i];
    const s = r.bears[p];
    if (!s) continue;
    if (!best || SUIT_RANK[s] > SUIT_RANK[best.suit]) best = { produce: p, suit: s };
  }
  return best;
}

// EVERYTHING THIS GROUND BEARS, best first — `bestBorne` with its tail kept, and
// deliberately the SAME two orderings so the head of this list is always that
// function's answer ([P-47]: one rule, and the shorter question is the longer
// one's first element).
//
// It exists because a produce the catalogue cannot express implies no work, and
// a region whose best answer is `grain` still has a second answer. Four of the
// world's eight produces have no work at all (§2.12.14), so ignoring the tail
// would leave a large slice of focused ground unable to be worked at all.
export function bornePreference(r: Region): { produce: Produce; suit: Suit }[] {
  const out: { produce: Produce; suit: Suit }[] = [];
  for (let i = 0; i < PRODUCE_ORDER.length; i++) {
    const p = PRODUCE_ORDER[i];
    const s = r.bears[p];
    if (s) out.push({ produce: p, suit: s });
  }
  // [P-10]: an explicit total order — grade first, then PRODUCE_ORDER's own
  // stated direction, bread then what builds then what sells. The tie-break is
  // written out rather than left to the sort's stability, because the head of
  // this list has to BE `bestBorne`'s answer and that is a rule, not a habit.
  return out.sort(
    (a, b) => SUIT_RANK[b.suit] - SUIT_RANK[a.suit] || PRODUCE_ORDER.indexOf(a.produce) - PRODUCE_ORDER.indexOf(b.produce),
  );
}

export const dominantOf = (town: Town): Region | null =>
  liveRegions(town).reduce<Region | null>((best, r) => (!best || r.hexes.length > best.hexes.length ? r : best), null);

// Does this ground bear that produce, and how well?
export const suitFor = (r: Region, p: Produce): Suit | null => r.bears[p] ?? null;

export const LABEL: Record<TerrainKind, string> = {
  timberedHills: "timbered hills",
  caneFlats: "cane flats",
  tilledGround: "tilled ground",
  cottonGround: "cotton ground",
  rockyGround: "rocky ground",
  saltPans: "salt pans",
  bluff: "a high bluff",
  reef: "fishing banks",
  roadstead: "a sheltered anchorage",
  marsh: "mangrove marsh",
  scrub: "dry scrub",
  openSea: "open water",
};

export const SHORT: Record<TerrainKind, string> = {
  timberedHills: "timber", caneFlats: "cane", tilledGround: "tilled", cottonGround: "cotton",
  rockyGround: "rock", saltPans: "salt", bluff: "bluff", reef: "banks", roadstead: "anchorage",
  marsh: "marsh", scrub: "scrub", openSea: "sea",
};

const COMPASS: Record<Bearing, string> = {
  N: "north", NE: "north-east", SE: "south-east", S: "south", SW: "south-west", NW: "north-west",
};
export const compass = (b: Bearing) => COMPASS[b];

// How much of the workable ground this region is — the proportion that IS the
// town's identity.
function share(town: Town, r: Region): number {
  const workable = liveRegions(town).reduce((s, x) => s + x.hexes.length, 0);
  return workable ? r.hexes.length / workable : 0;
}

// Proportion is the whole point, so it has to be said well: the dominant region
// leads the sentence, the rest are measured against it.
const leadWord = (f: number) => (f >= 0.5 ? "mostly" : f >= 0.33 ? "largely" : "some");
const shareWord = (f: number) => (f >= 0.33 ? "a good stretch" : f >= 0.18 ? "a fair stretch" : "a strip");

// The land said in proportions, which is the only way proportion is visible.
export function describeLand(town: Town): string {
  const seen = new Set<TerrainKind>();
  const live = liveRegions(town)
    .filter((r) => !isWater(r.terrain) && Object.keys(r.bears).length > 0) // a bluff is not a living
    .sort((a, b) => b.hexes.length - a.hexes.length)
    .filter((r) => (seen.has(r.terrain) ? false : (seen.add(r.terrain), true)));
  if (!live.length) return "nothing but dead ground and salt water";
  const parts = live.slice(0, 3).map((r, i) =>
    i === 0
      ? `${leadWord(share(town, r))} ${LABEL[r.terrain]}`
      : `${shareWord(share(town, r))} of ${LABEL[r.terrain]}`,
  );
  const dead = town.regions.filter((r) => isDead(r.terrain) && !isWater(r.terrain));
  const deadHexes = dead.reduce((s, r) => s + r.hexes.length, 0);
  const tail = deadHexes >= 4 ? `, and ${deadHexes} hexes of ground worth nothing` : "";
  return parts.join(", ") + tail;
}

export function describeRegion(r: Region): string {
  const size = r.hexes.length;
  const where = `to the ${compass(r.bearing)}`;
  const far = r.reach === "far" ? ", and out of the town's way" : "";
  const bears = Object.entries(r.bears) as [Produce, Suit][];
  const what = bears.length
    ? bears.map(([p, s]) => (s === "ideal" ? `made for ${p}` : s === "fair" ? `takes ${p} well enough` : `grudges ${p}`)).join("; ")
    : "nothing will come off it";
  return `${LABEL[r.terrain]} ${where}, ${size} hex${size > 1 ? "es" : ""}${far} — ${what}.`;
}
