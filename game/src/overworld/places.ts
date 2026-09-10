// The places — ~50 ports on real coastlines, at real positions.
//
// [HC-54] A place is described by size x purpose x faction, and every
//         combination is legal. No combination is special-cased and no fourth
//         axis may be added.
// [HC-55] "Outpost" is a READING, not a class: (size = settlement,
//         purpose = military). It is not stored anywhere.
// [HC-62] The only emergent promotion is settlement -> town. CITY IS
//         AUTHORED-ONLY — designated here, at world creation, and no town ever
//         becomes one.
// [HC-51] The neutral set is FIXED AT GENERATION, so the neutral share of the
//         map can only shrink.
// [HC-65] A neutral place can never be promoted — it has no patron to charter
//         it — so no neutral place is designated a city either.
// [HC-24] Continuous positions in nautical miles. No grid.
//
// THE ORDER OF DECISION MATTERS, and it is geography first:
//
//   1. where the coasts are          (shape.ts — the map)
//   2. where a port can stand        (siting, below)
//   3. what the map gives it         (its zone, its shelter, its true bearing)
//   4. what it therefore became      (size, then faction, then purpose)
//   5. what it is called             (its holder's name pool)
//
// Step 4 reads step 3 and never the other way round. A good anchorage argues for
// a trade port; a frontier argues for a garrison; and a place with neighbours
// within a few days' sail is where a great port grew. Nothing is hand-placed and
// no axis is rolled in a vacuum.

import { CHANNEL, rollOf, seedFor } from "./chance";
import { CLIMATES, exposureOf, zoneAt, type Zone } from "./climate";
import {
  CROWN_IDS, FACTION_IDS, FACTIONS, NEUTRAL_IDS, governorFor, nameFor,
  type Nation, type PoolId,
} from "./factions";
import {
  WORLD_BOX, DAY_RUN_NM, RAYS, coastAlong, distanceNm, isLandAt, seawardAt, shelterAt,
  type WorldShape,
} from "./shape";

// ---- The axes, as tables ([HC-90], [HC-91]) --------------------------------

export const SIZES = {
  settlement: { name: "settlement", rank: 0, population: [40, 80], wealth: 120 },
  town: { name: "town", rank: 1, population: [75, 115], wealth: 340 },
  city: { name: "city", rank: 2, population: [115, 150], wealth: 900 },
} as const;
export type SizeId = keyof typeof SIZES;

export const PURPOSES = {
  civilian: { name: "civilian", base: 1.0 },
  trade: { name: "trade", base: 0.75 },
  military: { name: "military", base: 0.45 },
} as const;
export type PurposeId = keyof typeof PURPOSES;

// How the world is classed. Cities are designated, and there are exactly as many
// as there are crowns, because in the 1660s the great ports of this sea ARE the
// five crowns' seats ([HC-39] gives every crown a seat; [HC-62] says no town ever
// earns city). Towns are a SHARE of what is left, so a world whose coastlines
// carried fewer ports is not two thirds towns.
export const CLASSING = { townShare: 0.3 } as const;

export const SITING = {
  target: 50, // "a number worth honouring rather than exceeding"
  // No two ports share a beach. MEASURED against this world's own coastlines,
  // which is the only way to set it: at 70 nm every seed fills its fifty and the
  // nearest neighbour is half a day off; at 130 nm the coast only carries
  // twenty-seven ports at all. At 85 nm a seed fills 48-50 and the SHORTEST leg
  // out of a typical port is about two thirds of a day, which puts an ordinary
  // trade leg across a market neighbourhood squarely in §6's one-to-four days.
  minSpacingNm: 85,
  attempts: 14000,
  marchNm: 360, // how far a candidate looks for a coast
  // A port needs ground behind it and sea in front of it. Both are read off the
  // map, so a lagoon in the middle of an island is never chosen.
  minLandRays: 3,
  minSeaRays: 4,
  landLookNm: 12,
  seaLookNm: 26,
  openRunNm: 88, // ...and the water off it must actually go somewhere
  openRunSamples: 11,
  openRunShare: 0.7,
  // What counts as "has neighbours" when the generator decides which harbours
  // grew into great ports: a passage of about a day and a half.
  neighbourNm: DAY_RUN_NM * 1.5,
} as const;

const SLOT = { site: 4000, standing: 4700, purpose: 4900, crown: 6000, faction: 6100 } as const;

// ---- The struct ------------------------------------------------------------

export interface Place {
  id: number;
  name: string;
  governor: string;

  // Where it is, in nautical miles. Fixed forever ([HC-19]).
  x: number;
  y: number;

  // The TRUE coastal bearing, as a unit vector pointing seaward ([HC-73]). The
  // world holds the truth; a town's own maps are DRAWN in a frame rotated so
  // that this direction is down the page. Nothing else in the game may assume
  // the sea lies any particular way.
  sx: number;
  sy: number;

  zone: number; // index into world.zones — its climate, and immutable ([HC-27])
  // How enclosed the water off it is, 0..1. A map property, read once because
  // reading it costs thirty-two field samples and it can never change.
  shelter: number;

  // The three axes. Size can rise ([HC-61] never fall); purpose never changes
  // ([HC-56]); faction changes by invasion.
  size: SizeId;
  purpose: PurposeId;
  faction: number; // index into world.nations

  // [HC-10] / §10.4: the place's own stream, DERIVED from the world's. Two towns
  // can no longer be handed the same hand-picked number, and adding a
  // fifty-first place cannot shift the other fifty.
  seed: number;

  // The opening ledger, and deliberately a MODEST one. [HC-22] wants a warm
  // start that is internally consistent, and the mature ledgers a 1660s map
  // needs — a city already a city, with the works to feed itself — are KAN-99's.
  // A young place that grows is consistent; a large place with no works would
  // fall over in its first decade, which is precisely the bug [HC-22] names.
  population: number;
  wealth: number;
}

// ---- Siting ----------------------------------------------------------------

// Is there ground behind this point and open sea in front of it?
function standsOnACoast(s: WorldShape, x: number, y: number): boolean {
  let land = 0;
  let sea = 0;
  for (let i = 0; i < RAYS.length; i++) {
    const r = RAYS[i];
    if (isLandAt(s, x + r.dx * SITING.landLookNm, y + r.dy * SITING.landLookNm)) land++;
    if (!isLandAt(s, x + r.dx * SITING.seaLookNm, y + r.dy * SITING.seaLookNm)) sea++;
  }
  if (land < SITING.minLandRays || sea < SITING.minSeaRays) return false;

  // ...and the water off it goes somewhere. An inland lake looks like a coast
  // from a hundred yards and is not one.
  const out = seawardAt(s, x, y);
  let open = 0;
  for (let k = 1; k <= SITING.openRunSamples; k++) {
    const d = (SITING.openRunNm * k) / SITING.openRunSamples;
    if (!isLandAt(s, x + out.dx * d, y + out.dy * d)) open++;
  }
  return open >= SITING.openRunShare * SITING.openRunSamples;
}

// Where the ports are. Rejection sampling: roll a position and a direction, walk
// to the waterline, and keep it if nothing already stands within half a day.
//
// The acceptance test looks only at places ALREADY accepted, which is what makes
// the result stable under a change of target: asking for forty ports gives the
// same first forty as asking for fifty. That is [HC-10]'s promise holding in the
// one part of the generator that is not a pure per-place function.
//
// [P-14] is not violated by the rejected attempts: there is no list to remove
// them from — they do not exist until they are rolled — and this runs once per
// world, never once per tick ([P-2]).
export function sitePlaces(seed: number, s: WorldShape, target: number = SITING.target): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const minSq = SITING.minSpacingNm * SITING.minSpacingNm;
  for (let a = 0; a < SITING.attempts && out.length < target; a++) {
    const roll = (attr: number) => rollOf(seed, CHANNEL.worldgen, SLOT.site + a, attr);
    const fromX = roll(0) * WORLD_BOX.widthNm;
    const fromY = roll(1) * WORLD_BOX.heightNm;
    const ray = RAYS[Math.floor(roll(2) * RAYS.length)];
    const hit = coastAlong(s, fromX, fromY, ray.dx, ray.dy, SITING.marchNm);
    if (!hit) continue;
    if (!standsOnACoast(s, hit.x, hit.y)) continue;
    let clear = true;
    for (let i = 0; i < out.length; i++) {
      const dx = out[i].x - hit.x;
      const dy = out[i].y - hit.y;
      if (dx * dx + dy * dy < minSq) {
        clear = false;
        break;
      }
    }
    if (clear) out.push(hit);
  }
  return out;
}

// ---- Which harbours grew ---------------------------------------------------

// How much of a port this position was always going to be. Two map facts and a
// roll: a sheltered harbour, and neighbours close enough to trade with. The roll
// is a third of the argument, never the whole of it, so a great port is somewhere
// you can see the reason for.
function standingOf(seed: number, sites: { x: number; y: number }[], i: number, shelter: number): number {
  let near = 0;
  for (let j = 0; j < sites.length; j++) {
    if (j === i) continue;
    if (distanceNm(sites[i].x, sites[i].y, sites[j].x, sites[j].y) <= SITING.neighbourNm) near++;
  }
  const company = near / 6 > 1 ? 1 : near / 6;
  const luck = rollOf(seed, CHANNEL.worldgen, SLOT.standing + i, 0);
  return shelter * 0.4 + company * 0.35 + luck * 0.25;
}

// ---- Purpose ---------------------------------------------------------------

// What the place is FOR. Weighted by what the map gave it, then drawn.
//
// [HC-56] purpose never changes, so this is decided once and stands for two
// centuries. [HC-54] keeps it independent of size: a military city and a trade
// settlement both fall out of this without a special case.
function purposeOf(
  seed: number, id: number, shelter: number, exposure: number, fromSeat: number, crown: boolean,
): PurposeId {
  // A deep anchorage is an argument for a trade port; an open roadstead is not.
  const trade = PURPOSES.trade.base * (0.35 + shelter * 1.9);
  // A garrison is raised where the crown's reach runs out and the weather and
  // the enemy come in. A place with no crown raises no garrison for anyone.
  const frontier = fromSeat / (DAY_RUN_NM * 4) > 1 ? 1 : fromSeat / (DAY_RUN_NM * 4);
  const military = PURPOSES.military.base * (crown ? 0.3 + frontier * 1.6 + exposure * 0.4 : 0.25);
  const civilian = PURPOSES.civilian.base;

  const total = trade + military + civilian;
  let r = rollOf(seed, CHANNEL.worldgen, SLOT.purpose + id, 0) * total;
  if ((r -= trade) <= 0) return "trade";
  if ((r -= military) <= 0) return "military";
  return "civilian";
}

// ---- Building the fifty ----------------------------------------------------

// A stable total order for the standing ranking: score first, id second, so no
// tie is ever broken by which one the loop reached first ([P-10]).
const byStanding = (a: { score: number; id: number }, b: { score: number; id: number }) =>
  b.score - a.score || a.id - b.id;

export function makePlaces(seed: number, s: WorldShape, zones: Zone[], nations: Nation[]): Place[] {
  const sites = sitePlaces(seed, s);

  // 3. What the map gives each of them. All three are pure readings of the
  //    field at the position, so nothing here is a decision yet.
  const shelter = sites.map((p) => shelterAt(s, p.x, p.y));
  const seaward = sites.map((p) => seawardAt(s, p.x, p.y));
  const zone = sites.map((p) => zoneAt(zones, p.x, p.y));

  // 4a. SIZE. Designated, in one pass, from a total order — [HC-62]: cities are
  //     authored and no town ever becomes one.
  const ranked = sites.map((_, i) => ({ id: i, score: standingOf(seed, sites, i, shelter[i]) })).sort(byStanding);
  const size: SizeId[] = sites.map(() => "settlement");
  const cityCount = Math.min(CROWN_IDS.length, ranked.length);
  const townCount = Math.round((ranked.length - cityCount) * CLASSING.townShare);
  for (let k = 0; k < ranked.length; k++) {
    if (k < cityCount) size[ranked[k].id] = "city";
    else if (k < cityCount + townCount) size[ranked[k].id] = "town";
  }

  // 4b. FACTION. Every crown takes one city for its seat, and every other place
  //     falls to a crown by REACH — spheres of influence, not a painted map.
  //     Distance from every crown is what makes a place likely to be nobody's.
  const faction: number[] = sites.map(() => -1);
  const seats: { nation: number; x: number; y: number }[] = [];
  const crownOrder = shuffledCrowns(seed);
  for (let k = 0; k < cityCount; k++) {
    const placeId = ranked[k].id;
    const nation = FACTION_IDS.indexOf(crownOrder[k]);
    faction[placeId] = nation;
    nations[nation].seat = placeId;
    seats.push({ nation, x: sites[placeId].x, y: sites[placeId].y });
  }

  const fromSeat: number[] = sites.map(() => 0);
  for (let i = 0; i < sites.length; i++) {
    // How far the nearest crown is — which is `reach`, and the reason neglect of
    // far colonies is emergent rather than scripted ([HC-45]) — and how strongly
    // each crown pulls on this coast. Inverse square, so a crown's reach falls
    // away fast but never quite to nothing.
    let bestD = Infinity;
    const pull: number[] = [];
    for (let k = 0; k < seats.length; k++) {
      const d = distanceNm(sites[i].x, sites[i].y, seats[k].x, seats[k].y);
      if (d < bestD) bestD = d;
      pull.push(1 / (d * d + 1));
    }
    fromSeat[i] = bestD === Infinity ? 0 : bestD;
    if (faction[i] >= 0) continue; // a seat is already spoken for

    // Far from every crown, a place is likely to be nobody's — a haven, an
    // abbey, a free camp. The neutral set is fixed here and can only shrink.
    const roll = (attr: number) => rollOf(seed, CHANNEL.worldgen, SLOT.faction + i, attr);
    const remoteness = (bestD - DAY_RUN_NM) / (DAY_RUN_NM * 4);
    const chance = remoteness < 0 ? 0.03 : remoteness > 1 ? 0.5 : 0.03 + remoteness * 0.47;
    if (roll(0) < chance) {
      const kind = NEUTRAL_IDS[Math.floor(roll(1) * NEUTRAL_IDS.length)];
      faction[i] = FACTION_IDS.indexOf(kind);
      // [HC-65]: a neutral place has no patron, so it can never be chartered —
      // and it was never designated a city either. Demote a neutral city to a
      // town rather than leaving an unpromotable great port with no crown.
      if (size[i] === "city") size[i] = "town";
      continue;
    }
    // ...otherwise a crown takes it, weighted by reach rather than won outright
    // by whichever seat is nearest. Strict nearest-seat paints five clean blocks
    // and can leave a crown holding its own capital and nothing else (measured:
    // France, one port). Weighting by reach INTERLEAVES the coasts, which is both
    // the period truth — an English Jamaica beside a Spanish Cuba — and the
    // condition every war in §8 needs in order to have somewhere to happen.
    let total = 0;
    for (let k = 0; k < pull.length; k++) total += pull[k];
    let r = roll(2) * total;
    let taken = 0;
    for (let k = 0; k < pull.length; k++) {
      if ((r -= pull[k]) <= 0) {
        taken = k;
        break;
      }
    }
    faction[i] = seats[taken].nation;
  }

  // 4c. PURPOSE, and 5. the name — which needs the holder, because a Dutch port
  //     is named out of a Dutch pool.
  const used = new Set<string>();
  const places: Place[] = [];
  for (let i = 0; i < sites.length; i++) {
    const nation = nations[faction[i]];
    const pool = FACTIONS[nation.faction].pool as PoolId;
    const climate = CLIMATES[zones[zone[i]].climate];
    const exposure = exposureOf(climate, seaward[i].dx, seaward[i].dy);
    const purpose = purposeOf(seed, i, shelter[i], exposure, fromSeat[i], nation.crown);

    // A name of its own. Collisions are resolved by trying again, and the retry
    // looks only at names already taken — never at a later place's.
    let name = nameFor(seed, pool, i, 0);
    for (let attempt = 1; attempt < 24 && used.has(name); attempt++) name = nameFor(seed, pool, i, attempt);
    used.add(name);

    const def = SIZES[size[i]];
    const popRoll = rollOf(seed, CHANNEL.worldgen, SLOT.standing + i, 1);
    places.push({
      id: i,
      name,
      governor: governorFor(seed, pool, i),
      x: sites[i].x,
      y: sites[i].y,
      sx: seaward[i].dx,
      sy: seaward[i].dy,
      zone: zone[i],
      shelter: shelter[i],
      size: size[i],
      purpose,
      faction: faction[i],
      seed: seedFor(seed, CHANNEL.place, i),
      population: def.population[0] + popRoll * (def.population[1] - def.population[0]),
      wealth: def.wealth,
    });
  }
  return places;
}

// Which crown takes which of the great harbours. A derived permutation, so the
// same world always seats the same crowns in the same ports, and a different
// world does not.
function shuffledCrowns(seed: number): typeof CROWN_IDS {
  const pool = [...CROWN_IDS];
  const out: typeof CROWN_IDS = [];
  for (let i = 0; pool.length > 0; i++) {
    const r = rollOf(seed, CHANNEL.worldgen, SLOT.crown, i);
    out.push(pool.splice(Math.floor(r * pool.length), 1)[0]);
  }
  return out;
}

// ---- Reading a place back --------------------------------------------------

export const sizeRank = (p: Place): number => SIZES[p.size].rank;

// [HC-55]: "outpost" is a reading, not a class. Stated here once so nothing is
// tempted to store it.
export const isOutpost = (p: Place): boolean => p.size === "settlement" && p.purpose === "military";

// How far, and how long. Distance is the price of everything ([HC-24], §6).
export const legBetween = (a: Place, b: Place): number => distanceNm(a.x, a.y, b.x, b.y);
