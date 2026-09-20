// The works ledger — the catalogue of what a town can have, and the systems that
// keep it honest (labour, dependencies, decay).
//
// A work is a ledger line with a place attached. Buildings are not simulated;
// works are. Parcel scarcity is the primary growth cap — cap and flavour are the
// same mechanism, so there are no arbitrary limits here beyond the land itself.

import type { Town, Work, WorkKind, WorkClass, Need, TerrainKind, Produce, Suit, Region } from "./types";
import type { Axial } from "./hex";
import type { TradeClass } from "./trade";
import { key } from "./hex";
import { WORKS, SUIT_YIELD, DECAY } from "./constants";
import { isDead, SUIT_RANK, capacityOf } from "./land";

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
  // WHICH CLASS A WORK'S `trade` IS CARGO IN — the reframing [HC-83] asks for:
  // `trade` stopped being coin a work emitted and became "what it sends to the
  // quay", so it needs a name for what is in the barrel. `null` means the work
  // takes a cut of the traffic rather than filling a hold — a tavern, a customs
  // house, a market — and its earnings ride on `access` alone.
  exports: TradeClass | null;
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
    food: 0, trade: 0, exports: null, defence: 0, hands: 0, serves: "shelter", servesFor: 40, max: 99, zone: "lowerTown", autoPer: 40 },
  gardenPlots: { label: "garden plots", cls: "subsistence", cost: 0, produces: "food", needsGround: null, requires: null,
    food: 30, trade: 0, exports: null, defence: 0, hands: 6, serves: "food", servesFor: 30, max: 4, zone: "beyondThePale", autoPer: 40 },
  fishingShacks: { label: "fishing shacks", cls: "subsistence", cost: 0, produces: "fish", needsGround: null, requires: null,
    food: 22, trade: 2, exports: null, defence: 0, hands: 4, serves: "food", servesFor: 22, max: 3, zone: "waterfront", autoPer: 50 },
  well: { label: "a well", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, exports: null, defence: 0, hands: 0, serves: "order", servesFor: 30, max: 1, zone: "plaza" },
  chapel: { label: "a chapel", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, exports: null, defence: 0, hands: 1, serves: "worship", servesFor: 60, max: 1, zone: "lowerTown" },
  market: { label: "a market", cls: "subsistence", cost: 0, produces: null, needsGround: null, requires: null,
    food: 0, trade: 3, exports: null, defence: 0, hands: 2, serves: null, servesFor: 0, max: 1, zone: "lowerTown" },

  // --- capital: the twelve the governor weighs against each other
  sawpit: { label: "sawpits", cls: "capital", cost: 260, produces: "timber", needsGround: null, requires: null,
    food: 0, trade: 14, exports: "materials", defence: 0, hands: 10, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  shipway: { label: "shipways", cls: "capital", cost: 900, produces: null, needsGround: "roadstead", requires: "sawpit",
    food: 0, trade: 34, exports: "materials", defence: 0, hands: 20, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  caneField: { label: "cane fields", cls: "capital", cost: 220, produces: "cane", needsGround: null, requires: null,
    food: 0, trade: 10, exports: "luxury", defence: 0, hands: 16, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  boilingHouse: { label: "a boiling house", cls: "capital", cost: 700, produces: null, needsGround: null, requires: "caneField",
    food: 0, trade: 30, exports: "luxury", defence: 0, hands: 14, serves: null, servesFor: 0, max: 9, zone: "beyondThePale" },
  provisionGround: { label: "provision grounds", cls: "capital", cost: 180, produces: "food", needsGround: null, requires: null,
    food: 90, trade: 0, exports: null, defence: 0, hands: 18, serves: "food", servesFor: 90, max: 9, zone: "beyondThePale" },
  warehouse: { label: "a warehouse", cls: "capital", cost: 320, produces: null, needsGround: "roadstead", requires: null,
    food: 0, trade: 12, exports: null, defence: 0, hands: 6, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  customsHouse: { label: "a customs house", cls: "capital", cost: 480, produces: null, needsGround: "roadstead", requires: null,
    food: 0, trade: 16, exports: null, defence: 0, hands: 6, serves: "order", servesFor: 60, max: 1, zone: "waterfront" },
  battery: { label: "a stone battery", cls: "capital", cost: 620, produces: null, needsGround: "bluff", requires: null,
    food: 0, trade: 0, exports: null, defence: 9, hands: 12, serves: null, servesFor: 0, max: 9, zone: "outworks" },
  palisade: { label: "a palisade", cls: "capital", cost: 240, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, exports: null, defence: 4, hands: 2, serves: null, servesFor: 0, max: 1, zone: "outworks" },
  barracks: { label: "a barracks", cls: "capital", cost: 420, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, exports: null, defence: 5, hands: 10, serves: "order", servesFor: 80, max: 1, zone: "backTown" },
  tavern: { label: "a tavern", cls: "capital", cost: 200, produces: null, needsGround: null, requires: null,
    food: 0, trade: 4, exports: null, defence: 0, hands: 4, serves: "drink", servesFor: 70, max: 2, zone: "lowerTown" },
  church: { label: "a church", cls: "capital", cost: 550, produces: null, needsGround: null, requires: null,
    food: 0, trade: 0, exports: null, defence: 0, hands: 3, serves: "worship", servesFor: 200, max: 1, zone: "plaza" },
};

export const CHOOSABLE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "capital");
export const SUBSISTENCE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "subsistence");

// ---- Raising a work --------------------------------------------------------

const working = (t: Town, kind: WorkKind) => t.works.some((w) => w.kind === kind && w.condition === "working");
export const countOf = (t: Town, kind: WorkKind) => t.works.filter((w) => w.kind === kind && w.condition !== "ruin").length;

// The regions that could carry this work, best ground first. A CROP work is
// offered wherever the ground bears its produce at ANY grade — terrain biases,
// it does not determine. A SITED work needs its ground exactly.
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
export function takenHexes(town: Town): Set<string> {
  const taken = new Set(town.footprint.claimed.map(key));
  for (const w of town.works) if (w.hex && w.condition !== "ruin") taken.add(key(w.hex));
  return taken;
}

// ---- [HC-94] A focus buys CAPACITY, never a multiplier ---------------------
//
// TWO VERBS PUT A WORK ON A REGION, AND THE ONLY THING THAT DIFFERS BETWEEN THEM
// IS WHAT THE GROUND ALLOWS. That is the whole of §2.12.4 in code, and it is
// deliberately not two rules:
//
//   raise  — the five-term auction scores a KIND on FREE ground (§5.1), which is
//            only legitimate while the ground IS free. So it may put the FIRST
//            work on a region and no more: "there is timber over the ridge; they
//            take what they need of it", and it never becomes an industry.
//   deepen — ground somebody has GIVEN OVER to production may be worked to its
//            free area. The cap is not a separate number — it is the ground.
//
// So the focused-to-unfocused ratio is AREA, the founding roll's own variance,
// and NOTHING ANYWHERE MULTIPLIES A YIELD BECAUSE A FOCUS WAS SET. The second of
// §2.12.4's two objections is the one to hold on to: a work stores its scaled
// yields AT THE MOMENT IT IS RAISED, so a focus flipped later could not re-price
// what already stands — a dial true of new rows and false of old ones is worse
// than no dial.
export type Verb = "raise" | "deepen";

// The token cap, and it is a RULE rather than a dial — §2.12.4 states the number
// in words ("ONE capital work") and nothing downstream divides by it.
export const TOKEN_DEPTH = 1;

// [HC-93] A REGION'S DEPTH IS COUNTED, NEVER STORED. There is no development
// integer, no level, no tier: the filter below over ~20 ledger lines is the
// cheapest thing in the module and it is load-bearing, because a stored depth is
// exactly a derived quantity free to drift from the works that explain it
// ([HC-14]) — and it would have no lumber mill in it to see (§7).
//
// WHAT IS COUNTED IS A WORK SOMEBODY CHOSE FOR THIS GROUND: a capital work that
// stands on what the region BEARS. Two exclusions, each for its own reason:
//
//  * SUBSISTENCE WORKS ([HC-98], and its second edge found by KAN-123). A garden
//    plot raises itself on any ground the town holds, is never chosen, never
//    priced and never gated — so it claims no purpose for the ground under it.
//    Counted here, it would spend a region's token allowance before any governor
//    ever looked at it.
//  * SITED WORKS (§2.12.12). A quay, a battery and a customs house stand on named
//    ground rather than on what the ground bears; they survive the collapse
//    untouched and stay gated on ground, coin, hands and materials — never on
//    what a region is FOR. No land use makes a town safer.
export function depthOf(town: Town, index: number): number {
  let n = 0;
  for (let i = 0; i < town.works.length; i++) {
    const w = town.works[i];
    if (w.region !== index || w.condition === "ruin") continue;
    const def = CATALOGUE[w.kind];
    if (def.cls === "capital" && def.produces !== null) n++;
  }
  return n;
}

// How deep this region's ground may go, by this verb. `claimed` is the set
// `capacityOf` would build for itself, handed in by a caller asking about
// several regions ([P-18]) — and it is never consulted by `raise`, which is why
// the auction's own path allocates nothing new.
export function depthAllowed(town: Town, r: Region, verb: Verb, claimed?: Set<string>): number {
  if (verb === "raise") return TOKEN_DEPTH;
  return r.focus === "production" ? capacityOf(town, r, claimed) : 0;
}

// WHAT THIS REGION WILL STILL TAKE OF THIS WORK, by this verb. ONE FUNCTION
// ([P-47]): the score that says "there is room for more", the gate that refuses a
// deepening and the mint that puts the work on the ground all ask this, so they
// cannot drift apart.
export function roomInRegion(
  town: Town,
  r: Region,
  index: number,
  kind: WorkKind,
  verb: Verb,
  taken: Set<string>,
  claimed?: Set<string>,
): number {
  let free = 0;
  for (let i = 0; i < r.hexes.length; i++) if (!taken.has(key(r.hexes[i]))) free++;
  const def = CATALOGUE[kind];
  // Outside the capacity rule entirely: a subsistence work ([HC-98]) and a sited
  // work (§2.12.12) both stand on ground whose purpose is not in question.
  if (def.cls !== "capital" || def.produces === null) return verb === "raise" ? free : 0;
  const room = depthAllowed(town, r, verb, claimed) - depthOf(town, index);
  return free < room ? free : room < 0 ? 0 : room;
}

// How much ground is left for this work, as the AUCTION asks it. AREA IS
// CAPACITY — and the town eating its own land is what makes growth cost
// something. A deepening never comes through here: it names one region and asks
// `roomInRegion` about that one ([HC-97]).
export function roomFor(town: Town, kind: WorkKind): number {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return Math.max(0, def.max - countOf(town, kind)); // a civic work
  const taken = takenHexes(town);
  let free = 0;
  for (const { region } of regionsFor(town, kind)) {
    free += roomInRegion(town, region, town.regions.indexOf(region), kind, "raise", taken);
  }
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

export interface Ground {
  hex: Axial;
  region: Region;
  index: number; // the region's index on the town, which is what a Work stores
  suit: Suit | null;
}

// WHERE IN THIS REGION the work would stand: the sweet spot if it is still open
// — which is why the boiling house stands where it does — and otherwise the
// first ground free of the town and of anything already on it.
export function groundIn(r: Region, index: number, kind: WorkKind, taken: Set<string>): Ground | null {
  const def = CATALOGUE[kind];
  const free = r.hexes.filter((h) => !taken.has(key(h)));
  if (!free.length) return null;
  const sweet = r.sweetSpot && free.find((h) => key(h) === key(r.sweetSpot!));
  const suit = def.needsGround ? null : def.produces ? (r.bears[def.produces] ?? null) : null;
  return { hex: sweet ?? free[0], region: r, index, suit };
}

// The best free ground for this work, as the AUCTION asks it: the best-suited
// region that will still take one. Ground a work already stands on is not free
// ground and the auction may not have it — that region is an INSTANCE now, and
// deciding anything more about it is a deepening ([HC-97]).
export function groundFor(town: Town, kind: WorkKind): Ground | null {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return null;
  const taken = takenHexes(town);
  for (const { region } of regionsFor(town, kind)) {
    const index = town.regions.indexOf(region);
    if (roomInRegion(town, region, index, kind, "raise", taken) <= 0) continue;
    const ground = groundIn(region, index, kind, taken);
    if (ground) return ground;
  }
  return null;
}

// WHAT THE GROUND COSTS, scaled by the same `q` as what the ground gives.
//
// A SUBSISTENCE WORK'S HANDS SCALE WITH ITS YIELD (ratified 2026-09-15), and the
// bug it closes is stated most simply as an omission: `raise` already scaled the
// four numbers the ground GIVES — food, trade, defence, servesFor — and left the
// one number the ground COSTS flat. So a garden plot on `poor` ground fed 10.5
// mouths and still wanted six men, which is 10.91 souls at `labourShare`. A place
// with nothing but poor food ground therefore could not sustain the hands that
// worked its own food: each step down idled another plot and it cascaded, 163
// souls to nothing in about forty years by ordinary decline — [HC-18] violated,
// and live in a shipped world once the weather reached the ledger.
//
// The rule, in one sentence: A SUBSISTENCE WORK IS MANNED TO THE SIZE THE GROUND
// WILL REPAY, AND NEVER BEYOND ITS OWN SIZE. `min(q, 1)`, and the asymmetry is
// the whole of it:
//
// * BELOW 1 the ground can make the work not worth doing in full, and nobody digs
//   a field that eats more than it grows — that is what subsistence MEANS. Six men
//   on ground that repays a third of six men's bread is three men and a smaller
//   patch. So the mouths-per-soul-of-labour ratio, `food · labourShare / hands`,
//   comes out INDEPENDENT of the ground at or below the grade the catalogue is
//   written for: `food·q·λ / (hands·q) = food·λ / hands`.
// * ABOVE 1 it does NOT scale, because good ground does not take more men — it
//   repays the same men better. That is already what the yield half says, and it
//   is §2.5's ratified line read the right way round: terrain BIASES a crop, it
//   does not determine how many hands a plot has.
//
// THE ASYMMETRY IS ALSO THE SAFETY ARGUMENT, and it is worth stating as one:
// `min(q, 1) <= 1`, so this change can only ever ask FEWER men of a work than the
// shipped catalogue did — never more. **No place's manning threshold can rise**,
// so no place that stands today can be pushed under by this.
//
// That safety matters more than it looks, and it was MEASURED rather than
// reasoned: an unclamped `q` scaled hands UP on ideal ground (six men to 7.8), and
// three places across five seeds that stand today emptied instead — because a
// storm-battered place lives near the bottom of its margin, not at the top of it,
// and the margin on good ground is where almost every place actually lives.
//
// TWO THINGS DELIBERATELY NOT DONE HERE:
//
// * CAPITAL WORKS KEEP A FLAT HAND COST. The hamlet floor is made of subsistence
//   works and only of them ([HC-67]): they are free, self-raising, never rot, and
//   nobody ever DECIDES to have one, so a subsistence work that cannot pay its own
//   wages is a spiral with no brake. A capital work is a priced decision; one that
//   cannot pay for itself on bad ground is the correct disincentive and the
//   governor's problem (§5.6, "he will not raise what nobody can work"), and it
//   cannot empty a place — it rots to `ruin` and the subsistence floor catches the
//   town. Scaling it would also flatten the reason a governor prefers good ground
//   and would silently falsify the auction's `def.hands <= spare` preview, which
//   reads the CATALOGUE rather than the instance ([P-47]).
// * THE FAR-GROUND `Math.ceil` IS NOT APPLIED to a scaled cost. Rounding up can
//   only ever RAISE the cost, which is the one thing this function must not do — a
//   plot worth 2.41 men charged for 3 loses a quarter of its margin. Hands are
//   compared against `population · labourShare`, a float in a model whose
//   population is a float, so nothing wanted a whole number here except habit.
const handsOn = (def: WorkDef, q: number, far: boolean): number => {
  const walk = far ? WORKS.farHands : 1; // men must still walk to it
  if (def.cls !== "subsistence") return far ? Math.ceil(def.hands * walk) : def.hands;
  return def.hands * Math.min(q, 1) * walk;
};

// RISING RETURNS, AND THEY RISE WITH DEPTH (§2.12.5). The Nth work on a region
// is worth more than the first — a second sawpit shares a track, a pond and a
// crew; a fifth is a works, with yards. The curve's SHAPE is a tuning table
// ([HC-90]); what the spec fixes is that it rises, that it is minted at raise
// time, and that AREA IS ITS CEILING.
//
// THE CAP IS NOT IN HERE AND MUST NOT BE, and that is the point of `[HC-75]`.
// Unbounded rising returns are an overshoot engine — more works, more yield,
// more growth, more works — and "no place oscillates with growing amplitude
// across two hundred years" is a named acceptance test. The premium runs out of
// GROUND before it runs out of anything else, because `roomInRegion` will not
// give it a hex to stand on past the region's free area, so the loop terminates
// on the founding roll rather than on a constant. A second clamp here would be a
// separate number doing the same job, which §2.12.5 refuses outright.
export const depthPremium = (depth: number): number => 1 + depth * WORKS.premiumPerDepth;

// Mint a work on a named hex, scaled by how well that ground suits it. Ground
// that was made for a crop is worth more of it; ground that merely grudges it
// pays a fraction — which is adaptability with a visible price.
//
// `onRegion` IS THE DEEPENING'S OWN DOOR, and it is the only difference between
// the two verbs at the mint. Without it a work goes where the auction's best
// FREE ground is; with it, on the region a governor named and scored from that
// region's own ground ([HC-97]). Everything below — the scaling, the premium,
// the ledger line — is one path, so the two verbs can never mint differently.
export function raise(town: Town, kind: WorkKind, day: number, onRegion: Region | null = null): Work | null {
  const def = CATALOGUE[kind];
  if (countOf(town, kind) >= def.max) return null; // the catalogue's own limit
  if (def.requires && !working(town, def.requires)) return null;
  const taken = takenHexes(town);
  let ground: Ground | null;
  if (onRegion === null) {
    if (!buildable(town, kind)) return null;
    ground = groundFor(town, kind);
  } else {
    const index = town.regions.indexOf(onRegion);
    ground = roomInRegion(town, onRegion, index, kind, "deepen", taken) > 0
      ? groundIn(onRegion, index, kind, taken)
      : null;
    if (!ground) return null;
  }
  if ((def.produces || def.needsGround) && !ground) return null;
  let q = ground?.suit ? SUIT_YIELD[ground.suit] : 1;
  if (ground && ground.region.sweetSpot && ground.hex && key(ground.hex) === key(ground.region.sweetSpot)) {
    q *= WORKS.sweetSpotBonus; // the best of it
  }
  const far = ground?.region.reach === "far";
  if (far) q *= WORKS.farPenalty; // ground over the ridge yields a little less...
  // ...and a work that joins others of its own kind on the same ground is worth
  // more than the first was. It is minted HERE, into the new line, exactly as
  // suitability and reach are — and the works already standing are never
  // touched, so if the fifth burns, the YARDS are what the town lost.
  if (ground && def.cls === "capital" && def.produces !== null) q *= depthPremium(depthOf(town, ground.index));

  const work: Work = {
    id: town.nextWorkId++,
    // A wall goes up landward first: it freezes the town's boundary AS IT THEN
    // STANDS, and is never re-extended. A hex claimed later, outside it, is the
    // faubourg.
    circuit: kind === "palisade" ? town.footprint.claimed.map((h) => ({ ...h })) : undefined,
    kind,
    name: def.label,
    region: ground ? ground.index : null,
    hex: ground ? ground.hex : null,
    sinceDay: day,
    condition: "working",
    idleSinceDay: null,
    food: def.food * q,
    trade: def.trade * q,
    defence: def.defence * q,
    hands: handsOn(def, q, far),
    serves: def.serves,
    servesFor: def.servesFor * q,
  };
  town.works.push(work);
  return work;
}

// ---- The ledger's own upkeep ----------------------------------------------
// Run every season, before anything reads the ledger.

// THE DAY ARRIVES AS AN ARGUMENT and is never fetched. `stepWorks(town, year)`
// already had this shape before KAN-107 — all that changed is that the number it
// takes is now the world's own integer rather than a year read off a private
// counter, so the same argument now serves the chronicle AND the decay clock.
export function stepWorks(town: Town, day: number): void {
  raiseSubsistence(town, day);
  allocateLabour(town, day);
  devolve(town, day);
}

// People house and feed themselves without being told to, and without spending a
// coin of the town's wealth. This IS the hamlet floor.
function raiseSubsistence(town: Town, day: number): void {
  for (const kind of SUBSISTENCE) {
    const def = CATALOGUE[kind];
    const want = def.autoPer
      ? Math.ceil(town.population / def.autoPer) // scales with the town
      : town.population >= (WORKS.subsistenceAt[kind] ?? 0)
        ? 1 // ...or simply appears once the place is big enough to warrant it
        : 0;
    while (countOf(town, kind) < want && roomFor(town, kind) > 0) raise(town, kind, day);
  }
}

// Feed the town first, then defend it, then earn — a governor's order of nature.
// HOISTED OUT OF THE ALLOCATOR ([P-48]): the same order decides who gets the last
// hands and which rotting work gets mended first, so it is one function rather
// than two that happen to agree today ([P-47]).
export const worthOf = (w: Work): number => w.food * 3 + w.defence * 2 + w.trade;

// Everything except hands that stands between a work and working again: its
// supplier, and the ground under it. ALSO HOISTED OUT OF THE ALLOCATOR'S LOOP
// CONDITION ([P-48]) — a governor must read exactly this rule before he pays to
// mend anything, or he buys a shipway that has no sawpit, or a sawpit the town
// has built over, and buys it again every few years for ever (§5.6).
function workableNow(town: Town, w: Work): boolean {
  const req = CATALOGUE[w.kind].requires;
  if (req && !working(town, req)) return false; // "the shipways stand idle for want of planks"
  // Ground the town has built over carries nothing any more, and CLAIMED GROUND
  // IS PERMANENT — so this one is not a setback, it is the end of that work.
  if (w.hex && town.footprint.claimed.some((c) => key(c) === key(w.hex!))) return false;
  return true;
}

// Hands are finite. A work nobody can man goes idle — the labour ceiling made
// visible rather than asserted ("there is money and no men").
//
// `decayed` is deliberately absent from the set hands are allotted to, and it is
// not an oversight: a rotted work must be PUT BACK IN ORDER before anyone can
// work it, and that is a priced decision, so it belongs to the governor and not
// to the ledger's own upkeep. See `mendable` below.
function allocateLabour(town: Town, day: number): void {
  const live = town.works.filter((w) => w.condition === "working" || w.condition === "idle");
  // [P-10]: an explicit tie-break, and its direction is the ELDER WORK FIRST —
  // the sawpits that have stood since '54 keep their men before the ones cut
  // last spring. Without it, two works of equal worth are ordered by however the
  // ledger happens to be arranged.
  live.sort((a, b) => worthOf(b) - worthOf(a) || a.id - b.id);

  let hands = town.population * WORKS.labourShare;
  for (const w of live) {
    if (hands >= w.hands && workableNow(town, w)) {
      hands -= w.hands;
      if (w.condition === "idle") w.condition = "working";
      w.idleSinceDay = null;
    } else if (w.condition === "working") {
      w.condition = "idle";
      w.idleSinceDay = day;
    }
  }
}

// ---- Coming back UP the ladder ---------------------------------------------
//
// THE GRADES DIFFER IN WHAT COMING BACK COSTS, never in whether it is possible
// (spec §3: "each step is legible and each is reversible").
//
//   idle    -> working   the hands return. Free, instant, and the allocator above
//                        does it without anyone deciding anything.
//   decayed -> idle      ONE RUNG, and it costs COIN. A capital work "needs money
//                        or a patron" to be saved exactly as it did to be raised;
//                        the hands then decide the last step like any other idle
//                        work. Priced, so the decision is the governor's.
//   ruin    -> nothing   past saving is past saving.
//
// Until KAN-108 this was a comment and not a mechanism: `decayed` was in no set
// anyone allotted hands to, so its idle clock was never cleared and every decayed
// work was guaranteed to reach `ruin`. Four rungs, and only the first of the three
// below `working` could be climbed.

// What it costs to put a rotted work back in order. ONE PATH TO THE NUMBER
// ([P-47]): the gate that asks whether he can afford it and the charge that takes
// the coin are the same call, so they cannot drift apart.
export const repairCost = (kind: WorkKind): number => CATALOGUE[kind].cost * DECAY.repairShare;

// Is this work worth a governor's coin? Only if mending it would actually put it
// back to work: `ruin` never returns, and neither does a work whose supplier is
// gone or whose ground the town has built over. Wealth is NOT asked about here —
// it is the budget gate (§5.1) and it is asked separately, by the governor.
export const mendable = (town: Town, w: Work): boolean =>
  w.condition === "decayed" && workableNow(town, w);

// ---- The weather coming down the same ladder --------------------------------
//
// [HC-6] DAMAGE IS AN EVENT AND APPLIES THE DAY IT HAPPENS. It is the other half
// of the weather's two output paths, and the two must not be mixed: the yield a
// storm spoils waits for the season's books, the shed it knocks down does not.
//
// [HC-34] Damage moves works down the EXISTING ladder, one grade at a time, and
//         it never skips to ruin. So a drop stops at `decayed`: the only thing
//         that ever writes `ruin` from the weather is the extreme tail below,
//         which is capped at one work. Ordinary neglect still carries a decayed
//         work the last rung, on the clock `devolve` keeps.
// [HC-35] The extreme tail destroys exactly ONE work PER CONTACT, never a sweep.
//         Razing is deliberate and wholesale; the storm is random and singular —
//         a town can lose its quay to the sea, it cannot lose its town to it.
//
// KAN-108 made the ladder two-way, and that interaction is the point rather than
// a side effect: a work the weather knocks down is at worst `decayed`, so it has
// a repair path and a governor who can pay for it. A work the sea DESTROYS is a
// `ruin` and `mendable` refuses it. That is the whole difference between damage
// and destruction, stated in the two conditions rather than in prose.

// One rung down, and the idle clock restarts at the new grade — it has been idle
// since the storm, not since whenever it last wanted hands.
function dropOne(w: Work, day: number): void {
  w.condition = w.condition === "working" ? "idle" : "decayed";
  w.idleSinceDay = day;
}

// [HC-72]'s "damage events on named works" row. WHICH work is the one question
// the sampled severity cannot answer, so it is answered by a derived roll and a
// fixed walk: the sea takes what it finds, and then what stands next to it on
// the ledger. Works are appended and never spliced, so the ledger's order is id
// order — a total order with an explicit direction ([P-10]), and one that cannot
// depend on how the world walked its places.
//
// Ruins are skipped because there is nothing left to take, and a decayed work is
// skipped by a DROP for the same reason: the rung below it is `ruin`, and the
// weather does not write that except through the tail.
export function damageWorks(town: Town, dropped: number, destroyed: number, pick: number, day: number): void {
  const n = town.works.length;
  if (n === 0) return;
  let at = Math.floor(pick * n);
  if (at >= n) at = n - 1; // a roll is [0, 1), but never read past `length` ([P-31])
  // [HC-35], as a clamp rather than a trust — and in ONE place, so mutating it
  // actually sweeps. It was written twice at first, here and again in the loop
  // body, and a rule stated twice is a rule no test can break ([P-1]).
  let toDestroy = destroyed > 0 ? 1 : 0;
  let toDrop = dropped;
  for (let step = 0; step < n && (toDestroy > 0 || toDrop > 0); step++) {
    const w = town.works[(at + step) % n];
    if (w.condition === "ruin") continue;
    if (toDestroy > 0) {
      w.condition = "ruin";
      w.idleSinceDay = day;
      toDestroy--;
      continue;
    }
    if (w.condition === "decayed") continue;
    dropOne(w, day);
    toDrop--;
  }
}

// ---- What came off the ground this season ----------------------------------

// [HC-6]'s MODIFIER half, as ONE number with ONE definition ([P-47]). Everything
// that counts a season's harvest — the food a place grew, the cargo it sends to
// the quay, the mouths it can therefore feed — reads the share here, so none of
// them can be scaled while another is not.
//
// At `harvestLoss` of nothing this is exactly 1, and multiplying a double by 1 is
// exact, so a place no weather has touched books the identical harvest it booked
// before this existed.
export const harvestShare = (town: Town): number => 1 - town.harvestLoss;

// The devolution ladder going DOWN: working -> idle -> decayed -> ruin.
// Subsistence works never rot — people keep their own roofs on.
function devolve(town: Town, day: number): void {
  for (const w of town.works) {
    if (CATALOGUE[w.kind].cls === "subsistence") continue;
    if (w.idleSinceDay === null) continue;
    // Both dates are days since world epoch, so this subtraction is the same
    // subtraction anywhere in the world — which it was not while each town
    // counted seasons from its own founding (KAN-107).
    const idleFor = day - w.idleSinceDay;
    if (w.condition === "idle" && idleFor >= DECAY.idleToDecayed) w.condition = "decayed";
    else if (w.condition === "decayed" && idleFor >= DECAY.decayedToRuin) w.condition = "ruin";
  }
  // Ruins are NOT swept from the ledger: the map projection needs them, so your
  // own arson still shows on the ground the next time you come ashore (spec §7).
}

// ---- Reading the ledger ----------------------------------------------------

// How badly each want goes unmet, 0 (satisfied) to 1 (nothing at all). A GOVERNOR
// INPUT — never a bar the player is expected to tend.
//
// `food` IS THE EXCEPTION, and deliberately (§3.5.4, the line that spec calls
// load-bearing): it is rebased from HUNGER to DEPENDENCY. It scores the share of
// the town's bread that did not come off its own ground, so a town buying a third
// of its corn scores 0.33 WITH FULL BELLIES. That is why importing never silences
// the wish for a farm ([HC-81]) — and it is scored identically for every place,
// whatever its purpose; what purpose changes is what the governor may do about it.
export function unmetNeeds(town: Town, dependency = 0): Record<Need, number> {
  const out: Record<Need, number> = { food: 0, drink: 0, shelter: 0, worship: 0, order: 0 };
  const souls = Math.max(town.population, 1);
  for (const need of Object.keys(out) as Need[]) {
    if (need === "food") {
      out.food = dependency < 0 ? 0 : dependency > 1 ? 1 : dependency;
      continue;
    }
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
