// The town's built-up ground, and how it grows over a century.
//
// THE LAND A TOWN WORKS IS FIXED AT FOUNDING. What grows is how much of it the
// town has built over — a set of CLAIMED HEXES, which makes "growth eats its own
// cause" literal and countable: claim a cane hex and the cane is one hex smaller.
//
// The order of relief IS "builds inwards-out": densify first, spread second,
// outside the wall third, and nothing fourth.

import type { Town, Region, TerrainKind, CoreGrade } from "./types";
import type { Axial } from "./hex";
import { key, neighbours, distance, CENTRE } from "./hex";
import { isBuildable, LABEL, capacityOf } from "./land";
import { CATALOGUE } from "./works";
import { FOOTPRINT, SPRAWL } from "./constants";

export const CORE_WORD = ["scattered", "settled", "close-built", "packed", "stone-built"] as const;

export const makeFootprint = () => ({ core: 0 as CoreGrade, claimed: [{ ...CENTRE }] as Axial[] });

export const isClaimed = (town: Town, h: Axial) => town.footprint.claimed.some((c) => key(c) === key(h));

// ---- Room, and running out of it -------------------------------------------

// Everything that is not `beyondThePale` stands INSIDE the town. Dwellings
// already auto-raise one per forty souls, so population drives the pressure
// through machinery that already exists.
export const inTownWorks = (town: Town) =>
  town.works.filter((w) => w.condition !== "ruin" && CATALOGUE[w.kind].zone !== "beyondThePale").length;

export const room = (town: Town) =>
  FOOTPRINT.coreRoom[town.footprint.core] + (town.footprint.claimed.length - 1) * FOOTPRINT.roomPerClaim;

export const crowding = (town: Town) => inTownWorks(town) / Math.max(1, room(town));

// ---- Where it may spread ---------------------------------------------------

// A town builds over worthless ground first and its own living last. Order is by
// what it can afford to lose.
const SPREAD_ORDER: TerrainKind[] = [
  "scrub", "bluff", "rockyGround", "timberedHills", "tilledGround", "cottonGround", "caneFlats", "saltPans",
];

// The wall's frozen circuit — the boundary it enclosed WHEN IT WAS RAISED, never
// re-extended. So a hex claimed later, outside it, simply IS the faubourg.
export function walledGround(town: Town): Set<string> {
  const out = new Set<string>();
  for (const w of town.works) {
    if (w.condition === "ruin" || !w.circuit) continue;
    for (const h of w.circuit) out.add(key(h));
  }
  return out;
}

const regionAt = (town: Town, h: Axial): Region | null =>
  town.regions.find((r) => r.hexes.some((x) => key(x) === key(h))) ?? null;

// Which hex the town takes next. Ordered by what it can afford to lose, and
// tie-broken by THE MOST ALREADY-CLAIMED NEIGHBOURS — which is what makes a town
// grow lobes rather than a uniform ring.
export function nextHex(town: Town, outsideWall: boolean): Axial | null {
  const walled = walledGround(town);
  const granted = new Set(town.grantedToTown ?? []);
  let best: { h: Axial; rank: number; touching: number } | null = null;

  for (const h of town.land) {
    if (isClaimed(town, h)) continue;
    const r = regionAt(town, h);
    if (!r || !isBuildable(r.terrain)) continue; // never mangrove, never water
    // Must touch the town: a town grows outward from itself, not in patches.
    const touching = neighbours(h).filter((n) => isClaimed(town, n)).length;
    if (!touching) continue;
    // Inside the old wall or outside it — the caller decides which pass this is.
    if (walled.size > 0 && walled.has(key(h)) === outsideWall) continue;
    // A haven owner may open ground to the town; that ground goes first of all.
    const rank = granted.has(r.id) ? -1 : SPREAD_ORDER.indexOf(r.terrain);
    if (rank < 0 && !granted.has(r.id)) continue;
    if (!best || rank < best.rank || (rank === best.rank && touching > best.touching)) {
      best = { h, rank, touching };
    }
  }
  return best ? (best as { h: Axial }).h : null;
}

// ---- The season's growth ---------------------------------------------------

export interface Grew {
  kind: "densified" | "spread" | "faubourg" | "stalled";
  hex?: Axial;
  sentence: string;
}

export function stepFootprint(town: Town): Grew | null {
  if (crowding(town) < FOOTPRINT.crowdedAt) return null;

  const f = town.footprint;
  const temper = SPRAWL[town.archetype];
  const cost = (g: CoreGrade) => FOOTPRINT.densifyCost[g] ?? Infinity;

  // 1. DENSIFY. Building closer costs nothing at first; stone and storeys cost
  //    money, which is why a poor town spreads and a funded one does not.
  if (f.core < 4 && cost(f.core) === 0) return densify(town);

  // 2. SPREAD — and this single line is what makes a colony sprawl and a
  //    presidio hold its outline for a century.
  if (temper.willSpill && f.core >= temper.densifyFirstTo) {
    const grew = spread(town, false) ?? spread(town, true);
    if (grew) return grew;
  }

  // 3. ...otherwise pay for the stone, if the coffers allow.
  if (f.core < 4 && town.wealth >= cost(f.core)) {
    town.wealth -= cost(f.core);
    return densify(town);
  }

  // 4. A last try, for a town that could not afford to build upward.
  if (temper.willSpill) {
    const grew = spread(town, false) ?? spread(town, true);
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

function spread(town: Town, outsideWall: boolean): Grew | null {
  const h = nextHex(town, outsideWall);
  if (!h) return null;
  town.footprint.claimed.push(h);
  const r = regionAt(town, h);
  const over = r ? LABEL[r.terrain] : "the open ground";
  const gone = r && capacityOf(town, r) === 0 ? " Nothing more will come off that ground." : "";
  return outsideWall
    ? { kind: "faubourg", hex: h, sentence: `There are houses outside the gate now, out over ${over}.${gone}` }
    : { kind: "spread", hex: h, sentence: `The town has spread out over ${over}.${gone}` };
}

// ---- Reading it back -------------------------------------------------------

export function describeFootprint(town: Town): string {
  const f = town.footprint;
  const quarters = f.claimed.length - 1;
  if (quarters <= 0) return `A ${CORE_WORD[f.core]} town on its own ground.`;
  const walled = walledGround(town);
  const outside = f.claimed.filter((h) => walled.size > 0 && !walled.has(key(h)) && distance(h, CENTRE) > 0).length;
  const base = `A ${CORE_WORD[f.core]} town, spread over ${quarters} more hex${quarters > 1 ? "es" : ""}`;
  return outside > 0 ? `${base}, with houses outside the gate.` : `${base}.`;
}
