// The works ledger — the catalogue of what a town can have, and the systems that
// keep it honest (labour, dependencies, decay).
//
// A work is a ledger line with a place attached. Buildings are not simulated;
// works are. Parcel scarcity is the primary growth cap — cap and flavour are the
// same mechanism, so there are no arbitrary limits here beyond the land itself.

import type { Town, Work, WorkKind, WorkClass, Need, TerrainKind, Produce, Suit, Region } from "./types";
import type { Axial } from "./hex";
import { key } from "./hex";
import { WORKS, SUIT_YIELD, DECAY } from "./constants";
import { isDead } from "./land";

// Where a work sits when the ledger is projected onto a raid map (KAN-76).
export type Zone = "waterfront" | "lowerTown" | "plaza" | "backTown" | "outworks" | "beyondThePale";

export interface WorkDef {
  label: string; // how it reads in a sentence
  cls: WorkClass;
  cost: number; // wealth to raise; subsistence works are free
  // TWO GATES, NOT ONE (spec §2.5). A crop or extraction work names what it
  // PRODUCES and is offered wherever the ground bears it, at any grade — terrain
  // biases, it does not determine. A SITED work names hard ground and gets no
  // gradient: you cannot half-build a harbour on a hill.
  produces: Produce | null;
  needsGround: TerrainKind | null;
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
  dwellings: { label: "dwellings", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "shelter", servesFor: 40, max: 99, zone: "lowerTown", autoPer: 40 },
  gardenPlots: { label: "garden plots", cls: "subsistence", cost: 0, produces: "food", needsGround: null, requires: null,
    food: 30, trade: 0, defence: 0, hands: 6, serves: "food", servesFor: 30, max: 4, zone: "beyondThePale", autoPer: 40 },
  fishingShacks: { label: "fishing shacks", cls: "subsistence", cost: 0, produces: "fish", needsGround: null, requires: null,
    food: 22, trade: 2, defence: 0, hands: 4, serves: "food", servesFor: 22, max: 3, zone: "waterfront", autoPer: 50 },
  well: { label: "a well", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "order", servesFor: 30, max: 1, zone: "plaza" },
  chapel: { label: "a chapel", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 1, serves: "worship", servesFor: 60, max: 1, zone: "lowerTown" },
  market: { label: "a market", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 3, defence: 0, hands: 2, serves: null, servesFor: 0, max: 1, zone: "lowerTown" },

  // --- capital: the twelve the governor weighs against each other
  sawpit: { label: "sawpits", cls: "capital", cost: 260, produces: "timber", needsGround: null, requires: null,
    food: 0, trade: 14, defence: 0, hands: 10, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  shipway: { label: "shipways", cls: "capital", cost: 900, produces: null, needsGround: "roadstead", requires: "sawpit",
    food: 0, trade: 34, defence: 0, hands: 20, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  caneField: { label: "cane fields", cls: "capital", cost: 220, produces: "cane", needsGround: null, requires: null,
    food: 0, trade: 10, defence: 0, hands: 16, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  boilingHouse: { label: "a boiling house", cls: "capital", cost: 700, produces: null, needsGround: null, requires: "caneField",
    food: 0, trade: 30, defence: 0, hands: 14, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  provisionGround: { label: "provision grounds", cls: "capital", cost: 180, produces: "food", needsGround: null, requires: null,
    food: 90, trade: 0, defence: 0, hands: 18, serves: "food", servesFor: 90, max: 9, zone: "beyondThePale" },
  warehouse: { label: "a warehouse", cls: "capital", cost: 320, produces: null, needsGround: "roadstead", requires: null,
    food: 0, trade: 12, defence: 0, hands: 6, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  customsHouse: { label: "a customs house", cls: "capital", cost: 480, produces: null, needsGround: "roadstead", requires: null,
    food: 0, trade: 16, defence: 0, hands: 6, serves: "order", servesFor: 60, max: 1, zone: "waterfront" },
  battery: { label: "a stone battery", cls: "capital", cost: 620, produces: null, needsGround: "bluff", requires: null,
    food: 0, trade: 0, defence: 9, hands: 12, serves: null, servesFor: 0, max: 9, zone: "outworks" },
  palisade: { label: "a palisade", cls: "capital", cost: 240, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 4, hands: 2, serves: null, servesFor: 0, max: 1, zone: "outworks" },
  barracks: { label: "a barracks", cls: "capital", cost: 420, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 5, hands: 10, serves: "order", servesFor: 80, max: 1, zone: "backTown" },
  tavern: { label: "a tavern", cls: "capital", cost: 200, produces: null, needsGround: null, requires: null,
    food: 0, trade: 4, defence: 0, hands: 4, serves: "drink", servesFor: 70, max: 2, zone: "lowerTown" },
  church: { label: "a church", cls: "capital", cost: 550, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, defence: 0, hands: 3, serves: "worship", servesFor: 200, max: 1, zone: "plaza" },
};

export const CHOOSABLE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "capital");
export const SUBSISTENCE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "subsistence");

// ---- Raising a work --------------------------------------------------------

const working = (t: Town, kind: WorkKind) => t.works.some((w) => w.kind === kind && w.condition === "working");
export const countOf = (t: Town, kind: WorkKind) => t.works.filter((w) => w.kind === kind && w.condition !== "ruin").length;

// The regions that could carry this work, best ground first. A CROP work is
// offered wherever the ground bears its produce at ANY grade — terrain biases,
// it does not determine. A SITED work needs its ground exactly.
const SUIT_RANK: Record<Suit, number> = { ideal: 3, fair: 2, poor: 1 };

export function regionsFor(town: Town, kind: WorkKind): { region: Region; suit: Suit | null }[] {
  const def = CATALOGUE[kind];
  const out: { region: Region; suit: Suit | null }[] = [];
  for (const r of town.regions) {
    if (isDead(r.terrain)) continue;
    if (def.needsGround) {
      if (r.terrain === def.needsGround) out.push({ region: r, suit: null });
    } else if (def.produces) {
      const suit = r.bears[def.produces];
      if (suit) out.push({ region: r, suit });
    }
  }
  return out.sort((a, b) => SUIT_RANK[b.suit ?? "fair"] - SUIT_RANK[a.suit ?? "fair"]);
}

// Ground already spoken for: built over by the town, or carrying a work.
function takenHexes(town: Town): Set<string> {
  const taken = new Set(town.footprint.claimed.map(key));
  for (const w of town.works) if (w.hex && w.condition !== "ruin") taken.add(key(w.hex));
  return taken;
}

// How much ground is left for this work. AREA IS CAPACITY — and the town eating
// its own land is what makes growth cost something.
export function roomFor(town: Town, kind: WorkKind): number {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return Math.max(0, def.max - countOf(town, kind)); // a civic work
  const taken = takenHexes(town);
  const free = regionsFor(town, kind).reduce(
    (n, { region }) => n + region.hexes.filter((h) => !taken.has(key(h))).length,
    0,
  );
  return Math.min(free, Math.max(0, def.max - countOf(town, kind)));
}

// Can it be raised at all? Ground and supplier only — WEALTH IS THE BUDGET GATE
// and is checked separately by the governor, never mixed into whether a town
// wants it.
export function buildable(town: Town, kind: WorkKind): boolean {
  const def = CATALOGUE[kind];
  if (roomFor(town, kind) <= 0) return false;
  if (def.requires && !working(town, def.requires)) return false;
  return true;
}

// The best free ground for this work: the best-suited region, and within it the
// sweet spot if it is still open — which is why the boiling house stands where
// it does.
export function groundFor(town: Town, kind: WorkKind): { hex: Axial; region: Region; suit: Suit | null } | null {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return null;
  const taken = takenHexes(town);
  for (const { region, suit } of regionsFor(town, kind)) {
    const free = region.hexes.filter((h) => !taken.has(key(h)));
    if (!free.length) continue;
    const sweet = region.sweetSpot && free.find((h) => key(h) === key(region.sweetSpot!));
    return { hex: sweet ?? free[0], region, suit };
  }
  return null;
}

// Mint a work on a named hex, scaled by how well that ground suits it. Ground
// that was made for a crop is worth more of it; ground that merely grudges it
// pays a fraction — which is adaptability with a visible price.
export function raise(town: Town, kind: WorkKind, year: number): Work | null {
  if (!buildable(town, kind)) return null;
  const def = CATALOGUE[kind];
  const ground = groundFor(town, kind);
  if ((def.produces || def.needsGround) && !ground) return null;
  let q = ground?.suit ? SUIT_YIELD[ground.suit] : 1;
  if (ground && ground.region.sweetSpot && ground.hex && key(ground.hex) === key(ground.region.sweetSpot)) {
    q *= WORKS.sweetSpotBonus; // the best of it
  }
  if (ground && ground.region.reach === "far") q *= WORKS.farPenalty; // men must walk

  const work: Work = {
    id: town.nextWorkId++,
    // A wall goes up landward first: it freezes the town's boundary AS IT THEN
    // STANDS, and is never re-extended. A hex claimed later, outside it, is the
    // faubourg.
    circuit: kind === "palisade" ? town.footprint.claimed.map((h) => ({ ...h })) : undefined,
    kind,
    name: def.label,
    region: ground ? town.regions.indexOf(ground.region) : null,
    hex: ground ? ground.hex : null,
    since: year,
    condition: "working",
    idleSince: null,
    food: def.food * q,
    trade: def.trade * q,
    defence: def.defence * q,
    hands: ground?.region.reach === "far" ? Math.ceil(def.hands * WORKS.farHands) : def.hands,
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
    // Ground the town has built over carries nothing any more.
    const buried = !!w.hex && town.footprint.claimed.some((c) => key(c) === key(w.hex!));
    if (hands >= w.hands && supplied && !buried) {
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
  return CHOOSABLE.some((k) => CATALOGUE[k].requires === kind && roomFor(town, k) > 0);
}

// How well the best available ground suits this work — the "land calls for it"
// term, and the clause that goes with it.
export const bestSuitFor = (town: Town, kind: WorkKind): Suit | null => groundFor(town, kind)?.suit ?? null;

// What a given region could carry — what an unworked stretch of ground is FOR.
export const worksForRegion = (town: Town, r: Region): WorkKind[] =>
  CHOOSABLE.filter((k) => regionsFor(town, k).some((x) => x.region.id === r.id));
