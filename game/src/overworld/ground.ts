// A place's land, CUT FROM THE WORLD MAP at its position.
//
// [HC-19] The world map is the single source of geography. A town's local land
//         is derived from its position on it and never independently rolled.
//         This file is what makes that true; `rollLand` is what it replaced.
// [HC-28] Climate constrains; position varies within the constraint. The zone's
//         palette says what the ground here CAN be — a dry zone never yields a
//         cane flat — and the world's own elevation and rainfall fields at this
//         position say what it IS.
// [HC-73] The world holds a place's TRUE coastal bearing; a town's local views
//         are drawn in a frame whose south is seaward. THIS FILE IS THE ONLY
//         PLACE THE TWO FRAMES MEET, and the rotation below is the whole of the
//         translation. Everything downstream may keep drawing water to the
//         south, and no town assumes the sea really lies that way.
// [HC-72] A place accepts exactly the inputs the world hands it. "Its land" is
//         one row of that closed list, delivered once, at founding.
//
// THE ROTATION, because it is the load-bearing trick and it needs no trigonometry.
// Let s = (sx, sy) be the place's seaward unit vector in world coordinates. The
// rotation that carries s onto local "down the page" (0, 1) is
//
//     M = [ sy  -sx ]                and its inverse, local -> world, is
//         [ sx   sy ]                M^T = [ sy  sx ; -sx  sy ]
//
// because M.s = (sy.sx - sx.sy, sx.sx + sy.sy) = (0, 1) exactly. Both matrices
// are built from two stored numbers by multiplication and addition alone, so
// [P-5]'s ban on `sin` and `cos` costs nothing at all here.

import type { Land } from "../town/land";
import type { Produce, Region, Suit, TerrainKind } from "../town/types";
import type { Axial } from "../town/hex";
import { CENTRE, bearingOf, centroid, disc, distance, key, neighbours, southness, toPixel } from "../town/hex";
import { LAND } from "../town/constants";
import { makeRng, nextFloat, type Rng } from "../rng";
import { CHANNEL, seedFor } from "./chance";
import { CLIMATES, TERRAIN_BEARS, type Climate, type Zone } from "./climate";
import { fbm, fieldSeed } from "./noise";
import { heightAt, type WorldShape } from "./shape";

// WHAT THE CUT ACTUALLY NEEDS, and it is deliberately less than a World and less
// than a Place. `World` and `Place` both satisfy these structurally, so every
// existing call site is unchanged — but the generator can now ask what the ground
// behind a beach will bear BEFORE it has decided what sort of place stands there,
// which is what `standingOf` needs in order to see a hinterland ([HC-19]: one
// geography, asked at whatever moment somebody needs an answer).
//
// [P-17b] again: there is no argument through which a size class, a faction or a
// ledger could arrive here, so the cut cannot start reading one.
export interface Fields {
  seed: number;
  shape: WorldShape;
  zones: Zone[];
}

export interface Site {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  zone: number;
  // WHETHER THE GENERATOR PUT A STAND OF TIMBER BEHIND THIS BEACH. It is not a
  // reading of the map and it is not a property of this coast alone: it is
  // decided for a whole MARKET NEIGHBOURHOOD at once, in `worldgen.ts`, because
  // what has to be true is that every market can REACH timber — not that every
  // port grows its own (§11.4, and the human's call of 2026-09-16).
  //
  // FALSE DOES NOT MEAN "BEARS NO TIMBER". Most coasts that bear timber bear it
  // because the map says so and were never granted anything; the flag says only
  // that the generator undertook to make sure. [P-17b] again — a boolean is the
  // whole of what arrives here, so the cut cannot start reading a neighbourhood,
  // a market or a ledger.
  timberGranted: boolean;
}

// ---- The scale of a town's own ground --------------------------------------
// A hex is a bit under two nautical miles across, so the ~24 hexes of a town's
// land are the dozen miles of coast and hinterland its people actually work.
// That is also why the coast field carries octaves down to eight miles: at this
// scale a headland has to be a headland.
export const CUT = {
  hexNm: 1.8, // centre to centre
  // How far back from its own waterline the town itself stands, and it wants to
  // be well UNDER one hex. MEASURED, and it was a real bug: at 2.2 nm the centre
  // was more than a hex inland, so all three seaward neighbours came out dry, the
  // guaranteed landing fired for every place in the world, and what every town
  // got was not a coast but a DISC — twenty-three land hexes with the wet rim of
  // the trim around them, the same shoreline in all fifty. The waterline has to
  // fall INSIDE the cut for the cut to be geography.
  inlandNm: 0.7,
  // Coastal ground is overwhelmingly low — the height field's median on land is
  // a fourteenth of its maximum — so height is read on a square root. Without
  // it every town reads as flat and the whole palette collapses onto one
  // terrain, which is exactly what the first cut did.
  // Calibrated against the field's OWN distribution rather than against its
  // range: on land the height field runs 0.014 at its tenth percentile to 0.20
  // at its ninetieth, so a naive divide would leave nine towns in ten reading
  // "flat" and one reading "mountain".
  highFullAt: 0.30,
  highFloor: 0.16,
  bankDepth: 0.13, // water shallower than this is a fishing bank
  wetField: 2, // the rainfall field's index — its own avalanche of the world seed
  // Rainfall has to vary ACROSS A TOWN, not across the sea, or the ground is one
  // colour again: four octaves from thirty miles reach seven, and a town is
  // fifteen across.
  wetWaveNm: 30,
  wetOctaves: 4,
  wetSpread: 2.0, // value noise clusters around its middle; this opens it out
  fitTolerance: 1.6, // how sharply a terrain refuses ground that is not its own
  upsetChance: 0.3, // odds this ground favours its second crop over its first
  minRoadsteadWalls: 3, // land neighbours before a water hex counts as sheltered
  bluffSightHexes: 2, // how far inland ground can still be said to stand over the sea
} as const;

// What each kind of ground is, said as two numbers: how high it lies and how wet
// it is. The terrain at a hex is whichever of the zone's palette fits the world's
// own fields best — which is why terrain comes in stretches rather than a
// spatter, and why the same palette gives a different island a different shape.
const FIT: Partial<Record<TerrainKind, { high: number; wet: number; weight: number }>> = {
  timberedHills: { high: 0.78, wet: 0.62, weight: 1.0 },
  rockyGround: { high: 0.95, wet: 0.18, weight: 0.8 },
  // A bluff is dry ground standing OVER the water, not standing in it: a coast
  // is by definition near sea level, so requiring a bluff to touch the water
  // made bluffs geographically impossible and left fifty towns unable to raise a
  // battery between them. What it wants is high, dry ground WITHIN SIGHT of the
  // sea — which is what "a battery on the bluff above the harbour" means.
  bluff: { high: 0.60, wet: 0.28, weight: 1.0 },
  caneFlats: { high: 0.14, wet: 0.86, weight: 1.1 },
  tilledGround: { high: 0.36, wet: 0.58, weight: 1.0 },
  cottonGround: { high: 0.30, wet: 0.34, weight: 1.0 },
  saltPans: { high: 0.04, wet: 0.08, weight: 0.75 },
  marsh: { high: 0.05, wet: 0.97, weight: 0.7 },
  scrub: { high: 0.46, wet: 0.14, weight: 0.9 },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- The cut ---------------------------------------------------------------

interface Frame {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  size: number; // hex circumradius, in nautical miles
}

// Local axial -> world position. `toPixel` gives the local frame's plane; the
// transpose above carries it back out into the world.
function worldOf(f: Frame, h: Axial): { x: number; y: number } {
  const p = toPixel(h, f.size);
  return {
    x: f.ox + f.sy * p.x + f.sx * p.y,
    y: f.oy - f.sx * p.x + f.sy * p.y,
  };
}

// The ground a place stands on. Everything geographic here is READ off the world
// field; the small stream is used only for the things the map has no opinion
// about — which crop a stretch of tilled ground favours, and where the best of it
// lies.
export function groundAt(world: Fields, place: Site): Land {
  const s = world.shape;
  const climate = CLIMATES[world.zones[place.zone].climate];
  const rng = makeRng(seedFor(world.seed, CHANNEL.land, place.id));
  const wetSeed = fieldSeed(world.seed, CUT.wetField);

  const f: Frame = {
    // The town stands back from its own waterline, so the centre hex is dry
    // ground and the water is one hex seaward — which is where a landing is.
    ox: place.x - place.sx * CUT.inlandNm,
    oy: place.y - place.sy * CUT.inlandNm,
    sx: place.sx,
    sy: place.sy,
    size: CUT.hexNm / Math.sqrt(3),
  };

  const cells = disc(LAND.radius);
  const at = new Map<string, { x: number; y: number; h: number }>();
  for (let i = 0; i < cells.length; i++) {
    const w = worldOf(f, cells[i]);
    at.set(key(cells[i]), { x: w.x, y: w.y, h: heightAt(s, w.x, w.y) });
  }

  // ---- Which of it is dry -------------------------------------------------
  // The town itself always stands on dry ground: a port is sited on the shore,
  // and which side of a hex boundary the waterline fell is not a fact about the
  // world worth honouring.
  const dry = new Set<string>();
  for (const [k, p] of at) if (p.h > 0) dry.add(k);
  dry.add(key(CENTRE));

  // The town works what it can reach. Nearest first, so the ground it keeps is
  // the ground it could walk to; ties break on the coordinates, never on Map
  // order ([P-10]).
  const landCells = cells
    .filter((c) => dry.has(key(c)))
    .sort((a, b) => distance(a, CENTRE) - distance(b, CENTRE) || a.q - b.q || a.r - b.r)
    .slice(0, LAND.hexes);
  const land = new Set(landCells.map(key));

  // A landing is guaranteed: somewhere seaward of the town to come ashore, or
  // there is no quay to draw and no raid to run. Where the coast left none, one
  // hex is given back to the sea — and it must leave the land BEFORE the land is
  // read, or it ends up in two regions and the partition breaks.
  const LANDING = { q: 0, r: 1 };
  const hasLanding = neighbours(CENTRE).some((n) => southness(n) > 0 && !dry.has(key(n)));
  const forced = hasLanding ? null : key(LANDING);
  if (forced) land.delete(forced);
  const kept = landCells.filter((c) => land.has(key(c)));
  const cellAt = new Map<string, Axial>(kept.map((c) => [key(c), c]));

  // ---- ...and which of it is water ----------------------------------------
  // Only the water that touches the land is drawn at all, and only water: dry
  // ground the town could not reach is simply not on its map. INLAND THE MAP
  // ENDS; it is never ringed with ocean, and it is never ringed with sea that is
  // really a hillside — which is what happens if the trim above is allowed to
  // turn ground into water by leaving it out.
  const waterCells: Axial[] = [];
  const water = new Set<string>();
  for (const c of cells) {
    if (land.has(key(c))) continue;
    if (dry.has(key(c)) && key(c) !== forced) continue;
    if (!neighbours(c).some((n) => land.has(key(n)))) continue;
    water.add(key(c));
    waterCells.push(c);
  }

  // ---- What the ground is -------------------------------------------------
  const palette = climate.ground.palette.filter((t) => FIT[t]);
  const terrain = new Map<string, TerrainKind>();
  for (const c of kept) {
    const p = at.get(key(c))!;
    const high = clamp01((Math.sqrt(clamp01(p.h / CUT.highFullAt)) - CUT.highFloor) / (1 - CUT.highFloor));
    const raw = fbm(wetSeed, p.x, p.y, CUT.wetWaveNm, CUT.wetOctaves);
    const rain = clamp01((raw - 0.5) * CUT.wetSpread + 0.5 + climate.ground.wetBias);
    const overlooksSea = waterCells.some((w) => distance(c, w) <= CUT.bluffSightHexes);
    terrain.set(key(c), bestFit(palette, high, rain, overlooksSea));
  }

  // ---- Water: the anchorage, the banks, and the rest -----------------------
  // All three are map facts. A roadstead is water with land around it; a bank is
  // water the bottom nearly reaches. Neither is rolled.
  let roadstead: string | null = null;
  let walls = CUT.minRoadsteadWalls - 1;
  for (const c of waterCells) {
    if (distance(c, CENTRE) > 2) continue;
    const n = neighbours(c).filter((x) => land.has(key(x))).length;
    if (n > walls) {
      walls = n;
      roadstead = key(c);
    }
  }
  const waterKind = (c: Axial): TerrainKind => {
    if (key(c) === roadstead) return "roadstead";
    const p = at.get(key(c));
    return p && p.h > -CUT.bankDepth ? "reef" : "openSea";
  };

  // ---- Regions -------------------------------------------------------------
  // Land is flooded by terrain, so every workable region is one stretch of ground
  // by construction. Water is grouped by kind and not by contiguity: a bank is
  // wherever the bank is, and a cay is detached on purpose.
  let nextId = 1;
  const regions: Region[] = [];
  const seen = new Set<string>();
  for (const c of kept) {
    if (seen.has(key(c))) continue;
    const kind = terrain.get(key(c))!;
    const hexes: Axial[] = [];
    const queue = [c];
    seen.add(key(c));
    while (queue.length) {
      const h = queue.shift()!;
      hexes.push(h);
      for (const n of neighbours(h)) {
        if (seen.has(key(n)) || !land.has(key(n)) || terrain.get(key(n)) !== kind) continue;
        seen.add(key(n));
        queue.push(cellAt.get(key(n))!);
      }
    }
    regions.push(makeRegion(rng, nextId++, kind, hexes, climate));
  }

  absorbSlivers(regions);
  guaranteeVictuals(rng, regions, climate);
  // SECOND, AND NEVER FIRST. The stand of timber is cut out of ground the place
  // does not eat off, so the bread has to be settled before the planks are.
  guaranteeMaterials(rng, regions, climate, place.timberGranted);

  for (const kind of ["roadstead", "reef", "openSea"] as const) {
    const hexes = waterCells.filter((c) => waterKind(c) === kind);
    if (hexes.length) regions.push(makeRegion(rng, nextId++, kind, hexes, climate));
  }
  // A water region's bearing is read off the water furthest from the town, not
  // its centroid: a bay that wraps the headland would otherwise be reported
  // inland.
  for (const r of regions) {
    if (r.terrain === "reef" || r.terrain === "roadstead" || r.terrain === "openSea") {
      r.bearing = bearingOf(r.hexes.reduce((a, b) => (southness(b) > southness(a) ? b : a)));
    }
  }

  return { land: kept, water: waterCells, regions };
}

// How nearly this ground is what a terrain wants. Squared, so a terrain argues
// hard for the ground it is made for and barely at all for anything else — a
// flat response makes whichever terrain sits in the middle of both axes win
// everywhere, which is what turned the first cut into fifty identical fields.
function nearness(d: number): number {
  const t = 1 - Math.abs(d) * CUT.fitTolerance;
  return t > 0 ? t * t : 0.0001;
}

// Whichever of the zone's ground fits the world's fields best here. A total order
// with a name tie-break, so the answer never depends on the palette's order.
function bestFit(palette: readonly TerrainKind[], high: number, wet: number, overlooksSea: boolean): TerrainKind {
  let best: TerrainKind = palette[0];
  let bestScore = -Infinity;
  for (let i = 0; i < palette.length; i++) {
    const t = palette[i];
    // A bluff is a cliff over water. Out of sight of it, it is only a hill.
    if (t === "bluff" && !overlooksSea) continue;
    const fit = FIT[t]!;
    const score = fit.weight * nearness(high - fit.high) * nearness(wet - fit.wet);
    if (score > bestScore || (score === bestScore && t < best)) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

// A single hex of its own kind is a curiosity, not a stretch of country. It joins
// whichever of its neighbours has the most ground — which is what keeps a town's
// land readable as three or four places rather than as a quilt.
function absorbSlivers(regions: Region[]): void {
  for (let pass = 0; pass < 2; pass++) {
    const slivers = regions.filter((r) => r.hexes.length === 1);
    if (!slivers.length) return;
    let moved = false;
    for (const sliver of slivers) {
      const host = regions
        .filter((r) => r !== sliver && r.hexes.length > 1)
        .filter((r) => r.hexes.some((h) => neighbours(h).some((n) => key(n) === key(sliver.hexes[0]))))
        .sort((a, b) => b.hexes.length - a.hexes.length || a.id - b.id)[0];
      if (!host) continue;
      host.hexes.push(sliver.hexes[0]);
      regions.splice(regions.indexOf(sliver), 1);
      moved = true;
    }
    if (!moved) return;
  }
}

// [HC-22]: a warm start must be internally consistent. A place was settled
// because something there would feed it, so if the map gave it nothing that
// bears victuals, its largest stretch of ground is what its people till. That is
// the zone's own answer to the question, and it is the only place in this file
// where the generator overrules the map — deliberately, and stated.
function guaranteeVictuals(rng: Rng, regions: Region[], climate: Climate): void {
  const feeds = (r: Region) => r.bears.food !== undefined;
  if (regions.some(feeds)) return;
  const best = [...regions].sort((a, b) => b.hexes.length - a.hexes.length || a.id - b.id)[0];
  if (!best) return;
  best.terrain = climate.ground.victuals;
  best.bears = rollBears(rng, best.terrain, climate);
}

// THE SECOND GUARANTEE, and it is owed to a MARKET, not to a place.
//
// [HC-87c] a town that cannot GET timber and stone cannot build, however full
// its coffers — "the shipways stand idle for want of planks". Nothing in the
// catalogue quarries stone, so a sawpit is the only source of materials anywhere
// in the world, and a place can buy planks only from a port it shares a market
// neighbourhood with ([HC-82], [HC-83]: a flow balance holds no stock, so
// materials never make two hops). A neighbourhood with no timber in it is
// therefore not short of planks — it is frozen, for two centuries, at whatever
// it had raised before the bill appeared.
//
// So the generator undertakes that EVERY MARKET NEIGHBOURHOOD CAN REACH TIMBER,
// and deliberately no more than that: most places must still BUY their materials
// off a neighbour, which is the difference between a trade route and fifty
// self-sufficient ports. `worldgen.ts` solves the covering; this cuts the stand.
//
// WHAT IT TAKES, AND WHAT IT WILL NOT TAKE. The largest stretch of ground the
// place does not eat off, biggest first with an id tie-break ([P-10]). Ground
// that bears FOOD is never taken, at any size: `guaranteeVictuals` has just run
// and [HC-22] is not traded away for planks. A coast with nothing to spare is
// left alone and the covering falls to another port in the market.
function guaranteeMaterials(rng: Rng, regions: Region[], climate: Climate, granted: boolean): void {
  if (!granted) return;
  // Most granted coasts turn out to grow their own — the covering grants only
  // where the map gave none, and this makes the undertaking idempotent rather
  // than making it a conversion.
  if (regions.some((r) => r.bears.timber !== undefined)) return;
  const spare = regions
    .filter((r) => r.bears.food === undefined)
    .sort((a, b) => b.hexes.length - a.hexes.length || a.id - b.id)[0];
  if (!spare) return;
  spare.terrain = climate.ground.materials;
  spare.bears = rollBears(rng, spare.terrain, climate);
}

// ---- A region --------------------------------------------------------------

const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(nextFloat(rng) * xs.length)];

const isDeadGround = (t: TerrainKind) => TERRAIN_BEARS[t].length === 0;

function makeRegion(rng: Rng, id: number, terrain: TerrainKind, hexes: Axial[], climate: Climate): Region {
  const nearest = Math.min(...hexes.map((h) => distance(h, CENTRE)));
  return {
    id,
    terrain,
    hexes,
    bears: rollBears(rng, terrain, climate),
    // Ground arrives unspoken for. A focus is a DECISION a governor takes, never
    // something the map hands down ([HC-95]) — the generator says what the ground
    // WILL BEAR, and what it is FOR is the town's to settle.
    focus: null,
    // The best of it — why the boiling house stands where it does.
    sweetSpot: hexes.length > 2 && !isDeadGround(terrain) ? pick(rng, hexes) : null,
    reach: nearest > LAND.atHandWithin ? "far" : "atHand",
    bearing: bearingOf(centroid(hexes)),
  };
}

// What this ground will bear, and how well. The TERRAIN sets the shortlist, the
// ZONE promotes what it is known for ([HC-28] — a windward coast's cane is
// better than a dry cay's), and a small roll decides this town's own profile,
// which is what makes two cotton towns different without a `quality` axis.
function rollBears(rng: Rng, terrain: TerrainKind, climate: Climate): Partial<Record<Produce, Suit>> {
  const shortlist = [...TERRAIN_BEARS[terrain]];
  // The zone's own crop comes forward, if this ground bears it at all.
  for (const p of climate.ground.favours) {
    const i = shortlist.indexOf(p);
    if (i > 0) {
      shortlist.splice(i, 1);
      shortlist.unshift(p);
    }
  }
  if (shortlist.length > 1 && nextFloat(rng) < CUT.upsetChance) {
    const swap = shortlist[0];
    shortlist[0] = shortlist[1];
    shortlist[1] = swap;
  }
  const bears: Partial<Record<Produce, Suit>> = {};
  for (let i = 0; i < shortlist.length; i++) {
    bears[shortlist[i]] = i === 0 ? "ideal" : i === 1 ? "fair" : "poor";
  }
  return bears;
}
