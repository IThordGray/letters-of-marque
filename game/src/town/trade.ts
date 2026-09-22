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

import type { Derived, Produce, Town, Work, WorkKind } from "./types";
import { CATALOGUE, harvestShare } from "./works";
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

// ---- A CARGO'S CLASS COMES OFF THE GROUND (§2.12.13) -----------------------
//
// ONE TABLE, AND THE GROUND FILLS IT IN. A cargo's class used to be a
// hand-written column on the work — `WorkDef.exports` — which meant a town's
// place in [HC-77]'s pyramid was a property of WHICH BUILDINGS ITS GOVERNOR
// HAPPENED TO PICK. Keyed to the produce instead, it becomes a property of the
// coast the place was founded on, and two towns with the same works on
// different ground are two different towns on the world market. That is the
// whole of the change, and it makes the pyramid mean MORE rather than less.
//
// WHAT IS NOT IN THIS TABLE, AND WHY EACH IS ABSENT:
//
//  * `salt` — DEFERRED ON PURPOSE to the terrain-kind lockdown (§2.12.15). It is
//    unreachable rather than missing: nothing in the catalogue produces salt, so
//    nothing is ever classified as salt. [HC-90]'s 2026-09-21 corollary is the
//    reason it is safe to ship without it — CONTENT CANNOT BLOCK A MECHANIC, and
//    the test to apply is whether the deferred work would change CODE here or
//    only rows. Only rows.
//  * `stone` IS here, and is the mirror of the same test: §2.12.13's table says
//    materials are timber AND stone, so the row is the spec's own. Nothing
//    quarries stone yet, so it is inert — and it must not LEAD the mechanic
//    either, which is why it arrives as one entry in a table and not as a work.
export const PRODUCE_CLASS: Partial<Record<Produce, TradeClass>> = {
  food: "victuals",
  fish: "victuals",
  grain: "victuals",
  timber: "materials",
  stone: "materials",
  cane: "luxury",
  cotton: "luxury",
};

// WHICH CARGO A WORK'S OUTPUT IS — the one function everything else asks
// ([P-47]). Three readers with three different questions come through here:
// what a work sends to the quay (`producedOf`), whether it fills a hold at all
// (`quaysideOf`), and what it would fetch (`fetchOf`) — and a work that grows
// nothing has no cargo class, so it earns its cut of the traffic on `access`.
//
// THE `food > 0` FALLBACK IS GONE. It read "a work that feeds the town and ships
// nothing is carrying victuals", which was the old column's way of saying what
// the produce now says outright. Measured before deleting it: it changed no
// answer for any row in the catalogue, because every work with a food column
// also names a produce.
export const cargoOf = (kind: WorkKind): TradeClass | null => {
  const p = CATALOGUE[kind].produces;
  return p === null ? null : (PRODUCE_CLASS[p] ?? null);
};

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
  // 0..1 — THE SHARE OF THIS PLACE'S SEA LANES THAT STILL CALL. It is written by
  // the world in the seasonal clear, exactly as `price` and `allotted` are, and
  // for exactly the same reason: no function of this ledger could recompute it
  // ([HC-14]). Which places are near enough to trade with is the world's fact
  // ([HC-82]), and whether a squadron is sitting across those lanes is the
  // world's fact too. The town multiplies and asks nothing ([HC-71]).
  //
  // PAR IS ONE, and par is what an uncleared town faces — the shipping calls as
  // usual, which is the town the module shipped with. A town that has never met
  // a world therefore reads exactly its own readiness, and a blockade is
  // something that can only ever arrive from outside.
  reach: number;
}

// One factory, every field present, same order, same types ([P-26]).
export const makeMarket = (): MarketState => ({
  price: [1, 1, 1],
  allotted: [0, 0, 0],
  bought: [0, 0, 0],
  paid: 0,
  reach: 1,
});

// ---- Access ---------------------------------------------------------------
//
// A beach and a longboat will move some cargo; a quay and a garrison move all of
// it. [HC-85] gates both directions on this one number, which is why burning a
// warehouse is an economic act and a blockade is the same act from the sea.
//
// ACCESS IS REACH x READINESS, and until KAN-112 it was readiness alone.
//
//   READINESS is what the place has made of its own shore: quays, a strand, and
//             whether anyone dares call at it. It is bounded at 1 — a town can
//             be completely ready and no readier.
//   REACH     is how much of the shipping still calls, and it is a fact about
//             the SEA LANES rather than about the town ([HC-86]: "access reads
//             real routes and blockades"). The town cannot raise it, mend it or
//             rebuild it, which is the whole point: it is cuttable from outside.
//
// WHY THE PRODUCT, AND WHY BOTH HALVES SURVIVE. Readiness alone could not
// express a blockade, and that is the bug: the waterfront works that carried it
// are subsistence, so the hamlet floor raised them again for nothing every
// season and burning a quay was an inconvenience rather than a siege ([HC-87]'s
// fragile ceiling, which held at town scale and could not be stated at world
// scale). Reach alone would let a place with no quay at all trade freely
// because ships happen to pass, which contradicts [HC-85] in the ratified
// words: "no quay, no security -> nothing moves either way". A product is the
// only combination under which BOTH sentences are true, and it is what makes
// the number a CEILING: everything has to be in order for anything to move.
//
// [P-47] ONE PATH TO THE NUMBER. This is the only function that computes an
// access, `commerceOf` calls it once, and `derive` copies that one value onto
// `Derived.access` for the governor to read. There is no second preview of it
// anywhere, and the earnings equation still multiplies by it exactly once.
//
// [P-17b] It is handed `reach` as a NUMBER. There is no argument through which a
//         world, a route, a neighbour or a squadron could arrive, so this file
//         cannot start reading one.

const isWaterfront = (w: Work): boolean => CATALOGUE[w.kind].zone === "waterfront";

// What the place itself has ready, 0..1, before anything asks whether the
// shipping still calls. Deliberately NOT exported: it is a component of access
// and never a second answer to the question access answers ([P-47]).
//
// A BERTH IS A BERTH AND A STRAND IS CAPPED. Every working waterfront work is
// still worth the same `perQuay` — a quay is a quay whoever built it — but what
// the HAMLET FLOOR draws up on the sand is capped at `strandQuays` berths'
// worth. That is the whole of the KAN-112 readiness change, and it is aimed at
// exactly one thing: subsistence works raise themselves again for nothing every
// season ([HC-67]), so with three fishing shacks allowed by the catalogue the
// free floor alone reached the top of the scale and burning a town's waterfront
// cost it nothing beyond a season. Now it cannot: past two berths' worth,
// somebody has to build something that fire can take away for good.
function readinessOf(working: Work[], security: number): number {
  let quays = 0;
  let beached = 0;
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    if (!isWaterfront(w)) continue;
    if (CATALOGUE[w.kind].cls === "capital") quays++;
    else beached++;
  }
  const cap = ACCESS.strandQuays * ACCESS.perQuay;
  const strand = beached * ACCESS.perQuay;
  const shore = quays * ACCESS.perQuay + (strand > cap ? cap : strand);
  return clamp(shore + (security / 100) * ACCESS.securityWeight, 0, 1);
}

export function accessOf(working: Work[], security: number, reach: number): number {
  return readinessOf(working, security) * clamp(reach, 0, 1);
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
  // 0..1 — how far short of timber and stone it is. A town that cannot get them
  // CANNOT BUILD, however full its coffers (§3.5.3), which is why razing the quay
  // of a stone-poor island stops it rebuilding its wall.
  materialsShort: number;
  luxuryShort: number; // 0..1 — a need with teeth, and a MILD weight ([HC-79])
}

// What the ledger sends to the quay, by class. Victuals are counted in FOOD,
// because that column already exists and already means "mouths this feeds";
// materials and luxury are counted in a work's `trade`, which [HC-83]'s reframing
// makes literal — "what a work sends to the quay".
//
// THE COLUMNS DID NOT MOVE WHEN THE KEYING DID (§2.12.13), and only `cargoOf`
// changed underneath this loop. But note what this line now MAKES POSSIBLE and
// what the catalogue therefore must not do: rank 0 can receive a `trade` figure
// for the first time, because a victuals produce is a thing a work can name.
// Rank 0's `food` argument arrives from `derive` ALREADY SCALED by the weather,
// and the two lines in `commerceOf` that scale ranks 1 and 2 cannot scale a
// contribution made here — so a victuals figure in a `trade` column would be
// cargo no storm could spoil. `works.test.ts` forbids one outright, which is
// cheaper than a third scaling line and cannot be forgotten.
export function producedOf(working: Work[], food: number): number[] {
  const out = [food, 0, 0];
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    const cls = cargoOf(w.kind);
    if (cls) out[CLASSES[cls].rank] += w.trade;
  }
  return out;
}

// A customs house fills no hold: it takes a cut of what crosses the quay. So a
// work with no cargo class earns on `access` and nothing else — which is still
// EARNED rather than emitted, because access is exactly what a raider burns and
// a blockade closes.
//
// "NO CARGO CLASS" NOW MEANS "GROWS NOTHING", which is the same sentence read
// off the produce. The arithmetic below is untouched and deliberately so — it is
// KAN-132's, not this story's.
export function quaysideOf(working: Work[]): number {
  let out = 0;
  for (let i = 0; i < working.length; i++) {
    const w = working[i];
    if (cargoOf(w.kind) === null) out += w.trade;
  }
  return out;
}

// What the town's own take off it before anything is spare. ONE RULE FOR EVERY
// PLACE ([HC-76]) — a hamlet and a city obey the same three lines and fail at
// different heights.
//
// Note WHAT each class is keyed to, because the difference is the model and not
// a convenience. Bread and comforts are wanted by PEOPLE. Timber and stone are
// wanted by BUILDINGS — a place with nothing raised needs no stone to keep it
// standing, which is also what stops the whole map deadlocking on day one, when
// not one sawpit exists anywhere and a materials bill keyed to population would
// have made the first one unbuildable.
//
// Subsistence works are deliberately not counted: people roof their own houses
// out of whatever is to hand, and the hamlet floor must not be gated on trade or
// a sacked town could never crawl back.
export const consumedOf = (population: number, capitalWorks: number): number[] => [
  population * FOOD.perHead,
  capitalWorks * TRADE.materialsPerWork,
  population * TRADE.luxuryPerHead,
];

export function capitalWorksOf(working: Work[]): number {
  let n = 0;
  for (let i = 0; i < working.length; i++) if (CATALOGUE[working[i].kind].cls === "capital") n++;
  return n;
}

// The full commerce block, from the ledger plus whatever the last clearing left.
export function commerceOf(
  town: Town,
  working: Work[],
  food: number,
  security: number,
): Commerce {
  const access = accessOf(working, security, town.market.reach);
  const produced = producedOf(working, food);
  // [HC-6]'s yield modifier reaching the CARGO. `food` arrives already scaled —
  // `derive` is the one place that counts it — but materials and luxury are read
  // straight off the works here, so the same share has to bite here too, or a
  // storm would spoil a town's bread and leave its cane untouched. One
  // definition of the share ([P-47]); it is `harvestShare` in both places.
  const harvest = harvestShare(town);
  produced[1] *= harvest;
  produced[2] *= harvest;
  const consumed = consumedOf(town.population, capitalWorksOf(working));
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
    materialsShort: shortfallOf(produced[1] + m.bought[1], consumed[1]),
    luxuryShort: shortfallOf(produced[2] + m.bought[2], consumed[2]),
  };
}

// Whether the town can get timber and stone at all. A hard gate, and
// deliberately: "a town that cannot get timber and stone CANNOT BUILD, however
// rich it is." Its coffers may be full; it simply cannot get the stone.
export const canBuild = (c: Commerce): boolean => c.materialsShort < TRADE.buildGate;

// A WORK THAT PRODUCES MATERIALS IS NOT GATED BY MATERIALS (ratified
// 2026-09-16). You do not need planks to dig a sawpit.
//
// THE CLIFF IT CLOSES, measured on four seeds at day 0. The standing bill is
// `capitalWorks x materialsPerWork` ([HC-87b]), so a place with NO capital work
// consumes nothing, is short of nothing, and its FIRST build is free — and every
// build after it is gated. Fifty-two places across those seeds sat frozen at
// exactly one capital work, and forty-eight of them had spent that one free
// build on a TAVERN: the auction puts "the men have nowhere to drink" above
// "there is money in it" in a small place, which is reasonable on its own terms,
// and the consequence was that the sawpit standing on its own timbered hills was
// out of reach FOR EVER. One such place held 3,398 coin and a tavern.
//
// THE EXEMPTION IS READ OFF THE CATALOGUE, NEVER OFF A LIST OF KINDS. The rule
// is "a work that produces materials is not gated by materials", and the
// catalogue already answers which those are. A second list beside it would be
// [P-47]: one fact with two sources, and the day somebody adds a quarry the
// list is the half that gets forgotten.
//
// RE-KEYED TO THE PRODUCE 2026-09-21 (§2.12.13, [HC-87c]'s own amendment): it
// reads the produce's class rather than `exports === "materials"`.
// SAME RULE, SAME SINGLE SOURCE, ONE INDIRECTION SHORTER — and it has one live
// consequence, which is the point of doing it here rather than later. A
// `shipway` produces nothing; it is a harbour work that takes its cut of the
// traffic. So it STOPS being exempt and must be supplied to be laid down.
// YOU DO NEED PLANKS TO LAY DOWN A SHIPWAY, which is the only half of the old
// `timber -> sawpit -> planks -> shipway` chain worth keeping, and the bill
// keeps it for nothing.
//
// [HC-87c] IS UNTOUCHED: the gate still fires at "cannot GET them" and never at
// "is a little short". What is exempted is one class of work from the materials
// BILL, not the gate from the world.
// ONE INDIRECTION SHORTER STILL (KAN-126). It spelled out `timber` and `stone`
// while `PRODUCE_CLASS` was also saying so, which is one fact with two sources —
// exactly what [P-47] forbids, and exactly the shape that leaves a quarry half
// classified the day one arrives. It asks the table now.
export const producesMaterials = (kind: WorkKind): boolean => cargoOf(kind) === "materials";

// The gate as a governor actually asks it: about THIS work, in THIS town.
export const canBuildKind = (c: Commerce, kind: WorkKind): boolean =>
  producesMaterials(kind) || canBuild(c);

// The clause that goes with the refusal, so [HC-16] holds even for a decision
// that comes to nothing.
export const NO_MATERIALS_CLAUSE = "there is no timber or stone to be had";

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

// HOW DEAR THIS CARGO IS HERE, against the dearest this market may ever make it
// — 0..1, and it is the "local price" a deepening is scored from ([HC-97]).
//
// THE DENOMINATOR IS [HC-82]'S OWN CEILING AND NOT A NEW NUMBER ([P-53]): the
// clearing already refuses to move a price past `basePrice x priceCeiling`, so
// this divides by a bound the model already enforces rather than by a constant
// that would price the same fact a second time. Measured on the warm world, it
// runs across its range with a median well short of the clamp ([P-52]).
export const dearnessOf = (town: Town, cls: TradeClass): number => {
  const rank = CLASSES[cls].rank;
  return town.market.price[rank] / (TRADE.basePrice[rank] * TRADE.priceCeiling);
};

// What a work of this kind would ACTUALLY FETCH here — `trade x price x access`,
// the second of §3.5.4's two edits to the auction. It replaces a flat constant,
// and that is the whole of what makes the governor's market term an argument
// about this place rather than a fact about the catalogue: the same sawpit is
// worth raising where timber is dear and not where it is cheap.
//
// A work with no cargo class fills no hold, so it fetches its own cut of the
// traffic and rides on `access` alone.
export function fetchOf(town: Town, kind: WorkKind, access: number): number {
  const cargo = cargoOf(kind);
  const price = cargo === null ? 1 : town.market.price[CLASSES[cargo].rank];
  return CATALOGUE[kind].trade * price * access;
}

// ---- The port seam (§3.5.7) ------------------------------------------------
//
// Exactly three things are exposed, so the town menu has something real to talk
// to: `derive(town).commerce`, a public pure `priceOf()`, and the two
// write-points below. The player's VERBS are KAN-89 and are deliberately not
// here — this is the shape they will be built against, and nothing more.
//
// [HC-88] THE PLAYER IS A SMALL FISH, AND THE NUDGE IS CAPPED. Uncapped, the
//         first thing anyone discovers is that they can buy out a town — an
//         exploit, and a betrayal of "the world runs without you".

export interface Deal {
  qty: number; // what actually changed hands
  price: number; // what it went at
  coin: number; // ...and what that came to
}

// How much of this class crosses the quay in a season. The nudge is measured
// against it, so a hundred barrels is a great deal in a hamlet and nothing at
// all in a great port — which is the right shape without any special case.
const flowOf = (town: Town, rank: number, produced: number): number => {
  const f = produced + town.market.bought[rank];
  return f > 1 ? f : 1;
};

function nudge(town: Town, rank: number, by: number): void {
  const cap = TRADE.nudgeCap;
  const moved = by > cap ? cap : by < -cap ? -cap : by;
  const p = town.market.price[rank] * (1 + moved);
  const base = TRADE.basePrice[rank];
  const lo = base * TRADE.priceFloor;
  const hi = base * TRADE.priceCeiling;
  town.market.price[rank] = p < lo ? lo : p > hi ? hi : p;
}

// The player lands cargo here. The town pays for it, and its price softens.
export function sellTo(town: Town, cls: TradeClass, qty: number, d: Derived): Deal {
  const rank = CLASSES[cls].rank;
  const price = town.market.price[rank];
  const take = qty > 0 ? qty : 0;
  const coin = take * price;
  const paid = coin > town.wealth ? town.wealth : coin;
  const moved = price > 0 ? paid / price : 0;
  town.wealth -= paid;
  nudge(town, rank, -moved / flowOf(town, rank, d.commerce.produced[rank]));
  return { qty: moved, price, coin: paid };
}

// ...and takes cargo away. The town is paid, and its price hardens.
export function buyFrom(town: Town, cls: TradeClass, qty: number, d: Derived): Deal {
  const rank = CLASSES[cls].rank;
  const price = town.market.price[rank];
  const take = qty > 0 ? qty : 0;
  town.wealth += take * price;
  nudge(town, rank, take / flowOf(town, rank, d.commerce.produced[rank]));
  return { qty: take, price, coin: take * price };
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
    // An allotment is for ONE season. Consumed here so a place that is never
    // cleared again cannot go on landing the same shipment for ever — the flow
    // balance holds no stock, and neither does this.
    m.allotted[c] = 0;
  }
  m.paid = paid;
  return paid;
}
