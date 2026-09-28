// Climate — written once at generation, and never changed again.
//
// [HC-23] The world scale does NOT use the word "region". A town's land groups
//         are regions and that word is in shipped code; the world's climate
//         divisions are ZONES.
// [HC-27] Climate is immutable. No event, no century, no player action changes a
//         zone's climate. Anything that wants to vary is weather, not climate.
// [HC-28] Climate CONSTRAINS; position VARIES within the constraint. The zone
//         says what is possible on that ground — a dry zone never yields a cane
//         flat — and the place's position on the world map decides what is
//         actually there. This is how [HC-19] reaches a town's land without the
//         climate becoming per-town state.
// [HC-90] Every system's DEFINITIONS live in a data table; only its BEHAVIOUR
//         lives in code. So the four parts of every climate are a table.
// [HC-91] The table is the source of truth and the TypeScript type is generated
//         FROM it — `keyof typeof CLIMATES`, never a hand-written union. Add a
//         climate by adding a row; the type follows and every exhaustive switch
//         over it starts failing until it is handled.
//
// WHAT IS NOT HERE: weather. No ambient severity, no events, no tracks, no
// damage. That is KAN-90, and [HC-30] makes it a pure function of
// (world seed, zone, day) which needs nothing from this file but the rulebook
// below. What this file owns is the RULEBOOK every weather event will obey.

import type { Produce, TerrainKind } from "../town/types";
import type { Season } from "./calendar";
import { CHANNEL, rollOf } from "./chance";
import { DEFAULT_WORLD, type WorldSettings } from "./shape";

// ---- The four parts, as a table --------------------------------------------
//
// §7.1: a climate consists of exactly four things, and each has one job.
//
//  · SEASONAL BASELINE  the ordinary weather of each season — how wet, how
//                       settled. Gives the year a shape without any event.
//  · PREVAILING WIND    direction and typical strength, per season. Storm tracks
//                       run with it and a sea leg takes the time it takes.
//  · STORM REGIME       which seasons spawn events and how often. A dry coast
//                       can never get a season of rainstorms.
//  · SUITABILITY        what the ground in this zone will bear AT ALL. This is
//                       what the town's old suitability roll was standing in for.
//
// Wind is a unit-ish vector in world coordinates — x east, y south — pointing
// the way the wind BLOWS TO. The register is the 1660s Caribbean, so the
// standing answer is the easterly trades: (-1, 0), westward.

interface Baseline {
  wet: number; // 0 arid .. 1 sodden
  settled: number; // 0 boisterous .. 1 calm
}

interface Wind {
  dx: number;
  dy: number;
  knots: number;
}

interface Regime {
  seasons: readonly [boolean, boolean, boolean, boolean]; // spring · summer · autumn · winter
  perSeason: number; // expected events in a season that spawns them
  formsUpwindNm: number; // how far to windward of the zone they form
}

interface Ground {
  // The ground this zone's people keep for their own food. Guaranteed to be
  // somewhere on their ground ([HC-22]): a place was settled because something
  // there would feed it, so if the map gave a place nothing that bears victuals,
  // this is what its largest stretch turns out to be. Every zone answers
  // `tilledGround` today; the field exists so that a zone could answer otherwise.
  victuals: TerrainKind;
  // The ground this zone's people cut their planks out of — the SECOND
  // guarantee, and it is owed to a MARKET NEIGHBOURHOOD rather than to a place
  // (§11.4, [HC-82]). Nothing in the catalogue quarries stone, so timber is the
  // only source of materials in the world and a neighbourhood with none can
  // never build anything, for ever ([HC-87c]). `worldgen.ts` decides WHICH
  // coasts carry the stand; this says what a stand looks like in this climate.
  //
  // IT MUST BE SOMETHING THE ZONE'S OWN PALETTE GROWS, and a test holds that of
  // every row. [HC-28] is not traded away for planks any more than [HC-22] is:
  // the guarantee overrules the MAP — which stretch of country turned out to be
  // wooded — never the CLIMATE. Every zone answers `timberedHills` today; the
  // field exists so that a zone could answer otherwise, a logwood coast say, the
  // day somebody wants one.
  materials: TerrainKind;
  // Everything the ground in this zone can be. The gate [HC-28] describes.
  palette: readonly TerrainKind[];
  // How the zone shifts the moisture the ground is read at — a dry zone reads
  // its own rainfall field lower, so the same position bears different things in
  // a different climate.
  wetBias: number;
  // Produce this zone is known for. It is graded up where the terrain bears it.
  favours: readonly Produce[];
  // Where in the world this climate belongs, as a fraction of the box. Climate
  // must be geographically coherent — trade winds do not jump about — so a zone
  // takes the climate whose country it sits in.
  prefers: { fx: number; fy: number };
}

export interface Climate {
  name: string;
  baseline: readonly [Baseline, Baseline, Baseline, Baseline];
  wind: readonly [Wind, Wind, Wind, Wind];
  storms: Regime;
  ground: Ground;
}

const wet = (w: number, s: number): Baseline => ({ wet: w, settled: s });
const trades = (knots: number): Wind => ({ dx: -1, dy: 0, knots });

export const CLIMATES = {
  // The windward coast: the first land the trades and the storms reach.
  windward: {
    name: "the Windward Coast",
    baseline: [wet(0.55, 0.7), wet(0.75, 0.45), wet(0.8, 0.35), wet(0.45, 0.65)],
    wind: [trades(14), trades(12), { dx: -0.95, dy: -0.3, knots: 15 }, trades(16)],
    storms: { seasons: [false, true, true, false], perSeason: 1.6, formsUpwindNm: 420 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["timberedHills", "caneFlats", "tilledGround", "rockyGround", "bluff", "marsh", "scrub"],
      wetBias: 0.1,
      favours: ["sugar", "timber"],
      prefers: { fx: 0.9, fy: 0.35 },
    },
  },
  // Behind the islands: light airs, few storms, and the water a fleet lies in.
  leeward: {
    name: "the Leeward Sea",
    baseline: [wet(0.5, 0.85), wet(0.6, 0.7), wet(0.6, 0.6), wet(0.4, 0.8)],
    wind: [trades(9), trades(8), trades(10), { dx: -0.9, dy: 0.35, knots: 11 }],
    storms: { seasons: [false, true, true, false], perSeason: 0.5, formsUpwindNm: 300 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["timberedHills", "caneFlats", "tilledGround", "cottonGround", "rockyGround", "bluff", "scrub"],
      wetBias: 0.0,
      favours: ["sugar", "grain"],
      prefers: { fx: 0.45, fy: 0.42 },
    },
  },
  // Low, dry, and salt to the horizon — with one wooded ridge somewhere behind
  // the pans. `timberedHills` joined this palette on 2026-09-16 and it is the
  // only palette change the timber guarantee needed: it was the one climate on
  // the map that could not grow the only material anyone builds with, so a
  // market whose every port was a cay was frozen by construction. It wants high
  // AND wet ground, and a zone reading its rainfall a third of the scale lower
  // hardly ever has both — so a cay chain is still scrub and salt, and the ridge
  // is the exception the guarantee was going to have to invent anyway.
  dryCays: {
    name: "the Dry Cays",
    baseline: [wet(0.2, 0.8), wet(0.25, 0.7), wet(0.3, 0.6), wet(0.15, 0.75)],
    wind: [trades(13), trades(13), trades(14), trades(15)],
    storms: { seasons: [false, true, true, false], perSeason: 0.7, formsUpwindNm: 380 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["cottonGround", "saltPans", "rockyGround", "bluff", "scrub", "tilledGround", "timberedHills"],
      wetBias: -0.3,
      favours: ["salt", "cotton"],
      prefers: { fx: 0.62, fy: 0.62 },
    },
  },
  // The road every great storm walks down.
  stormRoad: {
    name: "the Hurricane Road",
    baseline: [wet(0.5, 0.65), wet(0.7, 0.35), wet(0.85, 0.2), wet(0.4, 0.6)],
    wind: [{ dx: -0.95, dy: -0.3, knots: 15 }, { dx: -0.9, dy: -0.45, knots: 14 }, { dx: -0.85, dy: -0.5, knots: 18 }, trades(16)],
    storms: { seasons: [false, true, true, false], perSeason: 2.6, formsUpwindNm: 500 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["timberedHills", "caneFlats", "tilledGround", "rockyGround", "bluff", "marsh", "scrub"],
      wetBias: 0.15,
      favours: ["timber", "sugar"],
      prefers: { fx: 0.78, fy: 0.15 },
    },
  },
  // The continental shore: hot, fertile, thunder rather than hurricanes.
  main: {
    name: "the Main",
    baseline: [wet(0.65, 0.6), wet(0.85, 0.4), wet(0.7, 0.5), wet(0.5, 0.7)],
    wind: [{ dx: -0.8, dy: -0.6, knots: 10 }, { dx: -0.7, dy: -0.7, knots: 9 }, trades(11), trades(12)],
    storms: { seasons: [true, true, false, false], perSeason: 1.0, formsUpwindNm: 260 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["timberedHills", "caneFlats", "tilledGround", "cottonGround", "bluff", "marsh", "scrub"],
      wetBias: 0.2,
      favours: ["sugar", "timber", "grain"],
      prefers: { fx: 0.4, fy: 0.9 },
    },
  },
  // The northern approaches: cooler, and its bad weather comes in winter.
  northern: {
    name: "the Northern Approaches",
    baseline: [wet(0.45, 0.6), wet(0.4, 0.75), wet(0.5, 0.55), wet(0.55, 0.35)],
    wind: [{ dx: -0.6, dy: 0.8, knots: 14 }, trades(10), { dx: -0.5, dy: 0.85, knots: 15 }, { dx: -0.4, dy: 0.9, knots: 19 }],
    storms: { seasons: [true, false, true, true], perSeason: 1.2, formsUpwindNm: 340 },
    ground: {
      victuals: "tilledGround",
      materials: "timberedHills",
      palette: ["timberedHills", "tilledGround", "cottonGround", "rockyGround", "bluff", "scrub"],
      wetBias: -0.05,
      favours: ["grain", "timber"],
      prefers: { fx: 0.15, fy: 0.1 },
    },
  },
} as const;

// [HC-91]: the type comes FROM the table.
export type ClimateId = keyof typeof CLIMATES;
export const CLIMATE_IDS = Object.keys(CLIMATES) as ClimateId[];

// ---- What the ground can bear, as a table ----------------------------------
// Moved here from `town/land.ts` when the town stopped rolling its own coast:
// what a kind of ground will bear is a fact about the world, not about a town.
// The zone's palette decides which of these terrains can occur at all; the
// terrain decides what comes off it; the position decides which terrain it is.
export const TERRAIN_BEARS: Record<TerrainKind, readonly Produce[]> = {
  // TOBACCO AND CACAO NEEDED NO NEW GROUND, which is the whole of what they
  // cost: cacao is a shade crop of the wet flats and tobacco is planted on
  // ground already cleared for something else, so each is an entry on terrain
  // the generator has always painted. Both sit behind what the ground is FOR, so
  // neither displaces a staple: cacao is the second thing a cane flat bears and
  // tobacco the second thing cotton ground bears, and on tilled ground — the
  // world's bread — it comes last of all.
  timberedHills: ["timber", "stone"],
  caneFlats: ["sugar", "cacao", "cotton", "grain"],
  tilledGround: ["grain", "food", "cotton", "tobacco"],
  cottonGround: ["cotton", "tobacco", "grain"],
  rockyGround: ["stone"],
  saltPans: ["salt"],
  bluff: [], // a defensive gift, not a living
  reef: ["fish"],
  roadstead: [], // sited works only — a harbour is not a crop
  marsh: [],
  scrub: [],
  openSea: [],
};

// ---- Zones -----------------------------------------------------------------
// §7.1: for fifty places on a ~1,500 x 800 nm sea, expect four to eight zones.

export interface Zone {
  id: number;
  climate: ClimateId;
  // The zone's seat on the map. A position belongs to the nearest one, so zones
  // are irregular and have no borders to store ([HC-14]).
  x: number;
  y: number;
}

const ZONES = { count: [5, 8] } as const;
const SLOT = { zone: 3000 } as const;

export function makeZones(seed: number, settings: WorldSettings = DEFAULT_WORLD): Zone[] {
  const roll = (id: number, attr: number) => rollOf(seed, CHANNEL.worldgen, id, attr);
  const count = ZONES.count[0] + Math.floor(roll(SLOT.zone, 0) * (ZONES.count[1] - ZONES.count[0] + 1));
  // A jittered two-row grid, so no zone is a sliver and none is the whole sea.
  const cols = Math.ceil(count / 2);
  const zones: Zone[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const id = SLOT.zone + 1 + i;
    const fx = (c + 0.5) / cols + (roll(id, 1) - 0.5) * 0.6 / cols;
    const fy = (r + 0.5) / 2 + (roll(id, 2) - 0.5) * 0.3;
    const x = fx * settings.widthNm;
    const y = fy * settings.heightNm;
    zones.push({ id: i, climate: climateFor(fx, fy, (c) => roll(id, 10 + c)), x, y });
  }
  return zones;
}

// The climate whose country this seat sits in, with a little latitude. Distance
// is measured in box fractions so the shape of the world does not tilt it, and
// the roll can shift a zone into a neighbouring climate but never across the sea.
function climateFor(fx: number, fy: number, roll: (climate: number) => number): ClimateId {
  let best: ClimateId = CLIMATE_IDS[0];
  let bestScore = Infinity;
  for (let i = 0; i < CLIMATE_IDS.length; i++) {
    const id = CLIMATE_IDS[i];
    const p = CLIMATES[id].ground.prefers;
    const dx = fx - p.fx;
    const dy = fy - p.fy;
    // The roll is a per-climate nudge, not a shuffle: it can move a zone into a
    // neighbouring climate but never across the sea, so geography still decides
    // and the seed only argues at the margin.
    const score = dx * dx + dy * dy + (roll(i) - 0.5) * 0.16;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

// Which zone a position lies in. Nearest seat wins; ties break on the lower id,
// so the answer never depends on iteration order ([P-10]).
export function zoneAt(zones: Zone[], x: number, y: number): number {
  let best = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const dx = x - zones[i].x;
    const dy = y - zones[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

export const climateOf = (zones: Zone[], zone: number): Climate => CLIMATES[zones[zone].climate];

// ---- Exposure --------------------------------------------------------------

// The direction storms in this zone travel: the mean prevailing wind over the
// seasons that spawn them ([HC-29] — tracks follow the wind, not the player).
// A pure reading of the table, so it is derived and never stored.
export function stormTrack(c: Climate): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (let s = 0; s < 4; s++) {
    if (!c.storms.seasons[s]) continue;
    dx += c.wind[s].dx;
    dy += c.wind[s].dy;
    n++;
  }
  if (n === 0) return { dx: c.wind[0].dx, dy: c.wind[0].dy };
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return { dx: -1, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

// How much weather a coast is owed, 0 (a lee shore in a quiet zone) to about 1.
//
// [HC-29]: "A coast's exposure must be a property of the map, so that where a
// place sits is a decision with consequences." Two map facts and nothing else —
// which way the coast faces (the place's true seaward bearing) and which way the
// storms run (the zone's regime). A coast facing into the oncoming weather takes
// it; a coast in the lee of its own island does not.
//
// Derived, never stored ([P-17]): it is a pure function of two immutable facts.
export function exposureOf(c: Climate, seawardX: number, seawardY: number): number {
  const track = stormTrack(c);
  // Seaward against the storm's travel: -1 means the coast looks straight into
  // it, +1 means the storm has to cross the island to reach it.
  const facing = -(seawardX * track.dx + seawardY * track.dy);
  const windward = (facing + 1) * 0.5; // 0 lee .. 1 windward
  const seasons = c.storms.seasons.reduce((n, on) => n + (on ? 1 : 0), 0);
  const intensity = (c.storms.perSeason * seasons) / 4;
  return windward * intensity;
}

// The zone's ordinary weather this season — the shape of the year with nothing
// happening. Weather EVENTS are KAN-90; this is the baseline they excurse from,
// and it is here because it is a reading of the table, not a system.
export const baselineOf = (c: Climate, season: Season): Baseline => c.baseline[season];
export const windOf = (c: Climate, season: Season): Wind => c.wind[season];
