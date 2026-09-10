// The trading engine, town side — WEALTH IS EARNED, NOT EMITTED.
//
// A town buys what it needs and sells what it has spare. Its wealth is the
// difference. This file is the town's half of that: what it made, what its own
// people take, what therefore reaches the quay in each direction, and what the
// shipping cost it. The other half — who it trades WITH, and at what price — is
// the world's, and arrives as an input ([HC-71], [HC-72]).
//
//   yield = SUM(sold x price x access) + grant - imports paid - upkeep
//
// [HC-76] ONE UNIVERSAL DRIVE, NO THRESHOLD. Every place produces and consumes
//         in all three classes and tries to cover its own. What differs between
//         a hamlet and a city is only WHICH need they fail to cover locally —
//         a hamlet feeds itself easily and cannot make its own tools; a city
//         cannot feed itself at all. There is no "big places import" rule.
// [HC-77] THE PYRAMID GATE. A place reaches for a tier only once the tier below
//         is secure — and mechanically that is not a modifier, it decides
//         whether a demand EXISTS. A place short of bread registers no demand
//         for materials or luxury, however rich. The gate lives in the clearing
//         (overworld/market.ts), because it can only be applied in tier order.
// [HC-85] `access` gates participation BOTH WAYS. No quay, no security and
//         nothing moves either direction — which is why raiding and trade are
//         the same mechanism seen from two sides.

import type { Town, Work, WorkKind } from "./types";
import { CATALOGUE } from "./works";
import { ACCESS, FOOD, TRADE, WEALTH, DEPENDENCY_BANDS } from "./constants";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---- The three classes, as a table ([HC-90], [HC-91]) ----------------------
//
// Ratified 2026-09-09: victuals (population) · materials (construction) ·
// luxury (the top). `rank` IS the tier order the clearing walks, so the pyramid
// is the table's own shape rather than a rule written beside it.

export const CLASSES = {
  victuals: { rank: 0, label: "victuals" },
  materials: { rank: 1, label: "materials" },
  luxury: { rank: 2, label: "luxury" },
} as const;

export type TradeClass = keyof typeof CLASSES;

export const CLASS_ORDER = (Object.keys(CLASSES) as TradeClass[]).sort(
  (a, b) => CLASSES[a].rank - CLASSES[b].rank,
);
export const CLASS_COUNT = CLASS_ORDER.length;

export const rankOf = (c: TradeClass): number => CLASSES[c].rank;

// ---- What the world hands the town ([HC-72]'s "cleared trade" row) ---------
//
// The ONE new stored thing on a Town, and it is stored for the same reason
// `grant` is: it is not derived from the ledger, it ARRIVES. The world writes
// `price` and `allotted` in the seasonal clear; settlement writes back what the
// coffers could actually pay for. Everything else about a town's commerce —
// what it made, what it wants, what reaches its quay — stays derived ([HC-14]).
//
// An UNCLEARED town is priced at par and buys nothing, which is exactly the town
// the module shipped with. That is a neutral element, not a trading partner:
// [HC-86] killed "the shipping" and nothing here replaces it.

export interface MarketState {
  price: number[]; // by class rank — the LOCAL price, from its neighbourhood ([HC-82])
  allotted: number[]; // what the clearing found for it to buy
  bought: number[]; // ...and what it could actually pay for
  paid: number; // the coin that cost, this season
}

// One factory, every field present, same order, same types ([P-26]).
export const makeMarket = (): MarketState => ({
  price: [1, 1, 1],
  allotted: [0, 0, 0],
  bought: [0, 0, 0],
  paid: 0,
});

// ---- Access ---------------------------------------------------------------
//
// A beach and a longboat will move some cargo; a quay and a garrison move all of
// it. [HC-85] gates both directions on this one number, which is why burning a
// warehouse is an economic act and a blockade is the same act from the sea.

const isQuay = (w: Work): boolean => CATALOGUE[w.kind].zone === "waterfront";

export function accessOf(working: Work[], security: number): number {
  let quays = 0;
  for (let i = 0; i < working.length; i++) if (isQuay(working[i])) quays++;
  return clamp(quays * ACCESS.perQuay + (security / 100) * ACCESS.securityWeight, 0, 1);
}

// ---- The flow balance ------------------------------------------------------
//
// A TOWN TRACKS A FLOW BALANCE, NEVER A STOCK (§3.5.3) — the ratified
// do-not-build item "an in-town goods inventory" survives verbatim. Nothing
// below is carried from one season to the next.

export interface Commerce {
  produced: number[]; // by class rank — what the ledger made this season
  consumed: number[]; // ...and what its own people take
  offer: number[]; // what reaches the quay outbound, already x access
  want: number[]; // ...and what it must find inbound, already x access
  bought: number[]; // what the last clearing delivered AND the coffers paid for
  price: number[]; // the local price it faces
  access: number;
  earned: number; // SUM(sold x price) — the first term of the equation
  dependency: number; // 0..1 — the share of its bread that is not off its own ground
  luxuryShort: number; // 0..1 — a need with teeth, and a MILD weight ([HC-79])
}

// What the ledger sends to the quay, by class. Victuals are counted in FOOD,
// because that column already exists and already means "mouths this feeds";
// materials and luxury are counted in a work's `trade`, which [HC-83]'s reframing
// makes literal — "what a work sends to the quay".
export function producedOf(working: Work[], food: number): number[] {
  const out = [food, 0, 0];
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    const cls = CATALOGUE[w.kind].exports;
    if (cls) out[CLASSES[cls].rank] += w.trade;
  }
  return out;
}

// A customs house fills no hold: it takes a cut of what crosses the quay. So a
// work with no cargo class earns on `access` and nothing else — which is still
// EARNED rather than emitted, because access is exactly what a raider burns and
// a blockade closes.
export function quaysideOf(working: Work[]): number {
  let out = 0;
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    if (CATALOGUE[w.kind].exports === null) out += w.trade;
  }
  return out;
}

// What the town's own people take off it before anything is spare. One rule for
// every place ([HC-76]): a town needs timber and stone and a little comfort in
// proportion to how much town there is, exactly as it needs bread.
export const consumedOf = (population: number): number[] => [
  population * FOOD.perHead,
  population * TRADE.materialsPerHead,
  population * TRADE.luxuryPerHead,
];

// The full commerce block, from the ledger plus whatever the last clearing left.
export function commerceOf(
  town: Town,
  working: Work[],
  food: number,
  security: number,
): Commerce {
  const access = accessOf(working, security);
  const produced = producedOf(working, food);
  const consumed = consumedOf(town.population);
  const m = town.market;

  const offer: number[] = [0, 0, 0];
  const want: number[] = [0, 0, 0];

  // The cargo classes first, because the victuals line is funded out of them.
  // SUM(sold x price x access): the offer is already through the quay, so
  // `access` appears once and only once — [P-47], one path to the number.
  let earned = quaysideOf(working) * access;
  for (let c = 1; c < CLASS_COUNT; c++) {
    const spare = produced[c] - consumed[c];
    offer[c] = spare > 0 ? spare * access : 0;
    want[c] = spare < 0 ? -spare * access : 0;
    earned += offer[c] * m.price[c];
  }

  // THE COIN CEILING, and the line that actually lifts the old ~450-soul cap
  // (§3.5.6). Population used to be bounded by the town's own fields, so a place
  // could never be SHORT of bread and therefore never asked for any: the cap was
  // self-enforcing and trade could not reach it. So a town asks for grain enough
  // to feed the people its EXPORTS can pay for —
  //
  //     pop ~= export revenue / (import price + upkeep/head)
  //
  // — which is why "the ceiling is set by the land's QUALITY, not its acreage".
  // It is funded out of cargo and the crown's grant and never out of its own
  // corn, so a farming town cannot bootstrap itself by selling corn to buy corn.
  const purse = (earned + town.grant) * TRADE.growthShare;
  const perSoul = m.price[0] * FOOD.perHead + WEALTH.upkeepPerHead;
  const funded = perSoul > 0 ? purse / perSoul : 0;
  // THE GREATER of the two, not the sum — and that is a design choice worth
  // stating, because the sum reads more natural and is wrong. Under a sum every
  // place on the map wants more grain than its own fields grow, NOBODY has corn
  // spare, and the victuals market clears empty every season (measured: 48
  // places, 0 sellers). A max leaves the ordinary town selling the gap between
  // its fields and its people, and lets a great port outbid its own acreage.
  const mouths = (town.population > funded ? town.population : funded) * FOOD.perHead;
  // Netted, so a place never sells its corn and buys corn back in the same breath.
  const spare = produced[0] - mouths;
  offer[0] = spare > 0 ? spare * access : 0;
  want[0] = spare < 0 ? -spare * access : 0;
  earned += offer[0] * m.price[0];

  return {
    produced,
    consumed,
    offer,
    want,
    bought: m.bought,
    price: m.price,
    access,
    earned,
    dependency: dependencyOf(produced[0], consumed[0]),
    luxuryShort: shortfallOf(produced[2] + m.bought[2], consumed[2]),
  };
}

// ---- Prices, and what a work would fetch -----------------------------------
//
// The LOCAL price this place faces, and the only way anyone learns one is by
// being here. §3.5.9's ratified ban is on the price TABLE — the arbitrage-
// enabling god view — not on prices existing, and [HC-82] makes the ban
// structural rather than a matter of restraint: each neighbourhood clears on its
// own ratio, so there is no global price to table in the first place.
//
// [HC-71] holds: the town reads the block the world handed it and never reaches
// out to ask a neighbour anything.
export const priceOf = (town: Town, cls: TradeClass): number => town.market.price[CLASSES[cls].rank];

// What a work of this kind would ACTUALLY FETCH here — `trade x price x access`,
// the second of §3.5.4's two edits to the auction. It replaces a flat constant,
// and that is the whole of what makes the governor's market term an argument
// about this place rather than a fact about the catalogue: the same sawpit is
// worth raising where timber is dear and not where it is cheap.
//
// A work with no cargo class fills no hold, so it fetches its own cut of the
// traffic and rides on `access` alone.
export function fetchOf(town: Town, kind: WorkKind, access: number): number {
  const def = CATALOGUE[kind];
  const price = def.exports ? town.market.price[CLASSES[def.exports].rank] : 1;
  return def.trade * price * access;
}

// ---- Dependency ------------------------------------------------------------
//
// §3.5.5: "dependency = imported victuals / total victuals", derived, zero
// stored state. Written here as the share of what the town NEEDS that did not
// come off its own ground — which is the same number whenever the shipping
// covers the gap, and when it does not, still counts the bread that failed to
// arrive rather than reading a starving town as self-sufficient. One number, one
// sentence, one reader ([P-47]).
//
// [HC-81] It is scored IDENTICALLY FOR EVERY PLACE, whatever its purpose.
//         Importing never silences the wish for a farm. What purpose changes is
//         what the governor may DO about it, never the scoring.
export const dependencyOf = (produced: number, consumed: number): number =>
  consumed <= 0 ? 0 : clamp(1 - produced / consumed, 0, 1);

const shortfallOf = (have: number, want: number): number =>
  want <= 0 ? 0 : clamp(1 - have / want, 0, 1);

// One word for the town card. No number without a sentence.
export function dependencyWord(dependency: number): string {
  for (const b of DEPENDENCY_BANDS) if (dependency >= b.at) return b.word;
  return DEPENDENCY_BANDS[DEPENDENCY_BANDS.length - 1].word;
}

// The clause the food need writes once it is rebased from hunger to dependency
// (§3.5.4, and the line that spec calls load-bearing).
export const DEPENDENCY_CLAUSE = "too much of their bread comes off a ship";

// ---- Settling --------------------------------------------------------------
//
// [HC-78] IMPORTS ARE PAID BEFORE CONSTRUCTION — bread before batteries. That
//         ordering is what produces the good failure state, "they spend all they
//         make on corn": the coin goes on the quay before the governor ever sees
//         it, and a town that cannot cover its bread never reaches its wall.
//
// Paid in tier order, which is the pyramid again: whatever is left after the
// corn buys the timber, and whatever is left after that buys the silk.

export function payImports(town: Town, purse: number): number {
  const m = town.market;
  let left = purse;
  let paid = 0;
  for (let c = 0; c < CLASS_COUNT; c++) {
    const price = m.price[c];
    const cost = m.allotted[c] * price;
    if (cost <= left) {
      m.bought[c] = m.allotted[c];
      left -= cost;
      paid += cost;
    } else {
      // Short of coin: it takes what it can pay for and goes without the rest.
      const afford = price > 0 ? left / price : 0;
      m.bought[c] = afford < m.allotted[c] ? afford : m.allotted[c];
      paid += m.bought[c] * price;
      left = 0;
    }
  }
  m.paid = paid;
  return paid;
}
