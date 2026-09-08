// The land — an irregular coast divided into contiguous regions.
//
// A TOWN IS WHAT MOST OF ITS GROUND IS FOR. Identity comes from proportion (how
// much of the ground is cane), the dominant region (what the place is for), and
// shape (which way it runs and what it touches).
//
// Dilution is caused by INDEPENDENT PER-TILE SAMPLING, not by tile count —
// twenty tiles rolled independently converge on the same average. Clustering
// breaks the independence: we draw four regions and paint them across two dozen
// hexes. Few draws, high variance, high resolution.
//
// See docs/knowledge/spec/town-economy.md §2.

import type { Region, TerrainKind, Produce, Suit, Bearing, Town } from "./types";
import type { Axial } from "./hex";
import type { Rng } from "../rng";
import { nextFloat } from "../rng";
import { CENTRE, disc, neighbours, key, southness, bearingOf, centroid, distance } from "./hex";
import { LAND } from "./constants";

// ---- What the ground is ----------------------------------------------------

export const isWater = (t: TerrainKind) => t === "reef" || t === "roadstead" || t === "openSea";
export const isDead = (t: TerrainKind) => t === "marsh" || t === "scrub" || t === "openSea";
// Ground the town can build houses on. Never mangrove, never water.
export const isBuildable = (t: TerrainKind) => !isWater(t) && t !== "marsh";

// The profile supplier: what each terrain CAN bear, best first. The roll decides
// this town's actual grades (below). THIS FUNCTION IS THE CLIMATE SEAM — later a
// climate(latitude, rainfall, elevation) model fills `bears` instead, and nothing
// downstream changes.
const TERRAIN_PRODUCE: Record<TerrainKind, Produce[]> = {
  timberedHills: ["timber", "stone"],
  caneFlats: ["cane", "cotton", "grain"],
  tilledGround: ["grain", "food", "cotton"],
  cottonGround: ["cotton", "grain"],
  rockyGround: ["stone"],
  saltPans: ["salt"],
  bluff: [], // a defensive gift, not a living
  reef: ["fish"],
  roadstead: [], // sited works only — a harbour is not a crop
  marsh: [],
  scrub: [],
  openSea: [],
};

// Which terrains a town can be built ON — a vocation is what the place is for.
const VOCATIONS: { terrain: TerrainKind; weight: number }[] = [
  { terrain: "caneFlats", weight: 3 },
  { terrain: "timberedHills", weight: 3 },
  { terrain: "tilledGround", weight: 3 },
  { terrain: "cottonGround", weight: 2 },
  { terrain: "rockyGround", weight: 1 },
  { terrain: "saltPans", weight: 1 },
];

// What plausibly lies alongside what.
const SUPPORTING: Partial<Record<TerrainKind, TerrainKind[]>> = {
  caneFlats: ["tilledGround", "timberedHills", "scrub"],
  timberedHills: ["rockyGround", "tilledGround", "bluff"],
  tilledGround: ["caneFlats", "cottonGround", "timberedHills"],
  cottonGround: ["tilledGround", "scrub", "saltPans"],
  rockyGround: ["timberedHills", "bluff", "scrub"],
  saltPans: ["marsh", "scrub", "tilledGround"],
};

const DEAD_LAND: TerrainKind[] = ["scrub", "scrub", "marsh", "bluff"];

// ---- Rolling the land ------------------------------------------------------

const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.floor(nextFloat(rng) * xs.length)];

function pickWeighted(rng: Rng, xs: { terrain: TerrainKind; weight: number }[]): TerrainKind {
  const total = xs.reduce((s, x) => s + x.weight, 0);
  let r = nextFloat(rng) * total;
  for (const x of xs) if ((r -= x.weight) <= 0) return x.terrain;
  return xs[xs.length - 1].terrain;
}

export interface Land {
  land: Axial[];
  water: Axial[];
  regions: Region[];
}

export function rollLand(rng: Rng): Land {
  const cells = disc(LAND.radius);
  // One random value per hex, drawn once, so the outline is organic but stable.
  const noise = new Map<string, number>(cells.map((c) => [key(c), nextFloat(rng)]));
  // Where the shore lies in each column, jittered — this is what makes the coast
  // a coast and not an arc.
  const shore = new Map<number, number>();
  for (let q = -LAND.radius; q <= LAND.radius; q++) {
    shore.set(q, LAND.coast + (nextFloat(rng) - 0.5) * LAND.coastJitter);
  }
  const dry = (h: Axial) => southness(h) <= (shore.get(h.q) ?? LAND.coast);

  // Grow the land greedily outward from the town: best-scoring frontier hex first.
  const land = new Set<string>([key(CENTRE)]);
  const frontier = new Map<string, Axial>();
  const consider = (h: Axial) => {
    if (!noise.has(key(h)) || land.has(key(h)) || !dry(h)) return;
    frontier.set(key(h), h);
  };
  neighbours(CENTRE).forEach(consider);
  const score = (h: Axial) => (noise.get(key(h)) ?? 0) - distance(h, CENTRE) * LAND.compactness;
  while (land.size < LAND.hexes && frontier.size) {
    let best: Axial | null = null;
    for (const h of frontier.values()) if (!best || score(h) > score(best)) best = h;
    frontier.delete(key(best!));
    land.add(key(best!));
    neighbours(best!).forEach(consider);
  }
  // Cleanup: a hex ringed by land is land, however the growth missed it.
  for (const c of cells) {
    if (land.has(key(c)) || !dry(c)) continue;
    if (neighbours(c).every((n) => land.has(key(n)))) land.add(key(c));
  }

  const landCells = cells.filter((c) => land.has(key(c)));
  const at = (h: Axial) => landCells.find((c) => c.q === h.q && c.r === h.r);

  // Only the water that touches the land is drawn at all — and only on the SEAWARD
  // side. Inland the map simply ends; it is never ringed with ocean.
  const waterSet = new Map<string, Axial>();
  for (const c of landCells) {
    for (const n of neighbours(c)) if (!land.has(key(n)) && !dry(n)) waterSet.set(key(n), n);
  }
  // A landing is guaranteed: at least one water hex south of the town itself.
  const southOfTown = neighbours(CENTRE).filter((n) => southness(n) > 0 && !land.has(key(n)));
  if (!southOfTown.length) {
    const s = { q: 0, r: 1 };
    land.delete(key(s));
    waterSet.set(key(s), s);
  }
  // A cay or two, detached from the shore. Cheap, and they make it a coast.
  const cays: Axial[] = [];
  for (let i = 0; i < LAND.cays && nextFloat(rng) < 0.6; i++) {
    const seaward = [...waterSet.values()].filter((w) => southness(w) > 0.5);
    if (!seaward.length) break;
    const from = pick(rng, seaward);
    const out = pick(rng, neighbours(from).filter((n) => !land.has(key(n)) && !waterSet.has(key(n))));
    if (out) { waterSet.set(key(out), out); cays.push(out); }
  }
  const water = [...waterSet.values()];

  // ---- Regions ----
  const assigned = new Map<string, number>();
  const regions: Region[] = [];
  let nextId = 1;

  // Grow a region of `terrain` from a seed, up to `budget` hexes, over unassigned
  // land only. Contiguity is guaranteed by construction.
  const grow = (terrain: TerrainKind, seed: Axial, budget: number): Region | null => {
    if (assigned.has(key(seed))) return null;
    const hexes: Axial[] = [];
    const queue = [seed];
    while (hexes.length < budget && queue.length) {
      const h = queue.shift()!;
      if (assigned.has(key(h)) || !land.has(key(h))) continue;
      assigned.set(key(h), nextId);
      hexes.push(at(h)!);
      const open = neighbours(h).filter((n) => land.has(key(n)) && !assigned.has(key(n)));
      // A little disorder, so regions are not perfect discs.
      if (open.length > 1 && nextFloat(rng) < 0.5) open.reverse();
      queue.push(...open);
    }
    if (!hexes.length) return null;
    const r = makeRegion(rng, nextId++, terrain, hexes);
    regions.push(r);
    return r;
  };

  const openLand = () => landCells.filter((c) => !assigned.has(key(c)));
  const budget = (lo: number, hi: number) => lo + Math.floor(nextFloat(rng) * (hi - lo + 1));

  // The dominant region: what the place is FOR. Roughly a third of the ground.
  const vocation = pickWeighted(rng, VOCATIONS);
  const seedPool = landCells.filter((c) => distance(c, CENTRE) >= 1);
  grow(vocation, pick(rng, seedPool.length ? seedPool : landCells), budget(LAND.dominant.lo, LAND.dominant.hi));

  // One or two supporting regions, seeded on what is left.
  const supports = SUPPORTING[vocation] ?? DEAD_LAND;
  for (let i = 0; i < 1 + (nextFloat(rng) < 0.6 ? 1 : 0); i++) {
    const open = openLand();
    if (!open.length) break;
    grow(pick(rng, supports), pick(rng, open), budget(LAND.support.lo, LAND.support.hi));
  }
  // ...and the rest is whatever the coast happens to offer, much of it worthless.
  let guard = 12;
  while (openLand().length && guard-- > 0) {
    const open = openLand();
    const kind = nextFloat(rng) < LAND.deadShare ? pick(rng, DEAD_LAND) : pickWeighted(rng, VOCATIONS);
    grow(kind, pick(rng, open), budget(LAND.minor.lo, LAND.minor.hi));
  }
  // Anything still loose joins whatever it touches, rather than becoming a sliver.
  for (const c of openLand()) {
    const host = neighbours(c).map((n) => assigned.get(key(n))).find((id) => id !== undefined);
    const r = host !== undefined ? regions.find((x) => x.id === host) : undefined;
    if (r) { r.hexes.push(c); assigned.set(key(c), r.id); }
  }
  mergeAdjacent(regions);

  // Water regions: the anchorage the town actually uses, banks worth fishing, and
  // open sea for the rest.
  const inshore = water.filter((w) => distance(w, CENTRE) <= 2 && !cays.some((c) => key(c) === key(w)));
  const harbour = inshore.length && nextFloat(rng) < LAND.harbourChance ? [pick(rng, inshore)] : [];
  if (harbour.length) regions.push(makeRegion(rng, nextId++, "roadstead", harbour));
  const banks = water.filter((w) => !harbour.some((h) => key(h) === key(w)) && nextFloat(rng) < LAND.reefShare);
  if (banks.length) regions.push(makeRegion(rng, nextId++, "reef", banks));
  const rest = water.filter(
    (w) => !harbour.some((h) => key(h) === key(w)) && !banks.some((b) => key(b) === key(w)),
  );
  if (rest.length) regions.push(makeRegion(rng, nextId++, "openSea", rest));
  // The sea lies south, whatever a centroid over a wrapping coastline would say.
  for (const r of regions) if (isWater(r.terrain)) r.bearing = bearingOf(seawardMost(r.hexes));

  return { land: landCells, water, regions };
}

const seawardMost = (hexes: Axial[]) => hexes.reduce((a, b) => (southness(b) > southness(a) ? b : a));

// Two touching stretches of the same ground are one region, not two. Without this
// the map reads as a quilt of slivers rather than a place with a shape.
function mergeAdjacent(regions: Region[]) {
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        if (regions[i].terrain !== regions[j].terrain) continue;
        const touches = regions[i].hexes.some((a) => neighbours(a).some((n) => regions[j].hexes.some((b) => key(b) === key(n))));
        if (!touches) continue;
        regions[i].hexes.push(...regions[j].hexes);
        regions[i].bearing = bearingOf(centroid(regions[i].hexes));
        regions.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
}

// A region's grades are ROLLED, not fixed per terrain: the terrain sets the
// shortlist and the odds, the roll sets THIS town's profile. That is what makes
// two cotton towns different without a separate `quality` axis.
function rollBears(rng: Rng, terrain: TerrainKind): Partial<Record<Produce, Suit>> {
  const shortlist = [...TERRAIN_PRODUCE[terrain]];
  const arable = terrain === "caneFlats" || terrain === "tilledGround" || terrain === "cottonGround";
  if (arable && shortlist.length > 1 && nextFloat(rng) < LAND.upsetChance) {
    [shortlist[0], shortlist[1]] = [shortlist[1], shortlist[0]];
  }
  const bears: Partial<Record<Produce, Suit>> = {};
  shortlist.forEach((p, i) => (bears[p] = i === 0 ? "ideal" : i === 1 ? "fair" : "poor"));
  return bears;
}

function makeRegion(rng: Rng, id: number, terrain: TerrainKind, hexes: Axial[]): Region {
  const nearest = Math.min(...hexes.map((h) => distance(h, CENTRE)));
  return {
    id,
    terrain,
    hexes,
    bears: rollBears(rng, terrain),
    // The best of it — why the boiling house stands where it does.
    sweetSpot: hexes.length > 2 && !isDead(terrain) ? pick(rng, hexes) : null,
    reach: nearest > LAND.atHandWithin ? "far" : "atHand",
    bearing: bearingOf(centroid(hexes)),
  };
}

// ---- Reading the land back -------------------------------------------------

export const regionOf = (town: Town, id: number) => town.regions.find((r) => r.id === id) ?? null;
export const liveRegions = (town: Town) => town.regions.filter((r) => !isDead(r.terrain));

// Ground still available to work: a region's area LESS whatever the town has
// built over. Growth eats its own cause.
export function capacityOf(town: Town, r: Region): number {
  const claimed = new Set(town.footprint.claimed.map(key));
  return r.hexes.filter((h) => !claimed.has(key(h))).length;
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
