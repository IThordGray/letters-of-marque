// The clearing — where fifty towns' surpluses and shortfalls meet — and, at the
// foot of the file, THE WORLD'S DRIVER: §2.2's daily tick and §2.3's seasonal
// one, which is where every other system is actually called from.
//
// This is S7's engine and the last core system. The town knows what it made and
// what it lacks (../town/trade.ts); this file is the only thing that knows who
// it trades WITH, and it hands the answer back as an input ([HC-71]: the world
// drives the ledger, the ledger never reaches out).
//
// [HC-7]  TRADE CLEARS IN ONE GLOBAL PHASE, never town by town. If places
//         resolved in sequence, whoever went first would get first call on
//         everyone else's surplus and the world's history would depend on
//         iteration order.
// [HC-83] CLEARING IS SUMMATION, per neighbourhood, PER GOOD, in tier order —
//         it was per class until the market learned the goods' names, and the
//         shape did not move: the scratch rows widened from three to eleven.
//         Three properties fall out and none is bolted on: order independence
//         is automatic because sums commute; cost is LINEAR in the number of
//         places; and prices are genuinely local, because each neighbourhood
//         clears on its own ratio. There is no global price to table.
// [HC-82] A MARKET IS A NEIGHBOURHOOD, NOT A PAIR — computed once at world
//         generation from distance, because positions never move.
// [HC-15] Nothing pairwise. The neighbourhoods are built once, in O(N^2); the
//         clearing that runs every season is O(N x k) with k fixed ([P-2]:
//         complexity x TICK RATE, and these two tick at very different rates).
// [HC-84] War is a per-FACTION filter on the pool, never a per-place one.
// [HC-86] "The shipping" is dead. Every line below is written against real named
//         neighbours; there is no abstract partner anywhere in this file.

import type { Town } from "../town/types";
import { CLASS_COUNT, GOOD_COUNT, TIER_AT, TIER_RANK } from "../town/trade";
import { TRADE } from "../town/constants";
import { closeHarvest, derive, produceSeason, settleSeason, takeWeather } from "../town/sim";
import { governorTurn, type Season as TownSeason } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { CALENDAR, DAYS_PER_YEAR } from "./calendar";
import { dayOfSeason, startsSeason, stepDay, type World } from "./clock";
import { PAYLOAD, sendCargo, stepDispatches } from "./dispatch";
import { bandAt, contactAt, feltAt, pickAt, readSky, skyOf, stepWeather, type Sky } from "./weather";
import { DAY_RUN_NM, distanceNm } from "./shape";

// ---- The neighbourhoods ----------------------------------------------------

export const MARKET = {
  // HOW FAR A TOWN LOOKS FOR SOMEBODY TO TRADE WITH: A WEEK'S SAIL. It was two
  // days' run, and two days is inside a town's own climate — its neighbours grow
  // what it grows, so there was almost nothing to trade. A week crosses the
  // climate bands, which is the whole point: measured over the four house seeds,
  // the share of a town's partners in a different climate from its own goes from
  // 27% to 69%.
  //
  // A WEEK AND NOT A FORTNIGHT, deliberately. 1,008 nm against this sea's ~1,700
  // nm diagonal still rules pairs out, so there is a far coast to be far from and
  // distance is still the game's currency of cost. Widen it much further and
  // every port is everyone's neighbour, which world-loop.md names as the point
  // where you are watching a marketplace rather than a sea.
  reachNm: DAY_RUN_NM * 7,
  // ...and a hard cap on the handful, which is what keeps the clearing LINEAR
  // rather than merely linear-at-fifty. Doubling the places on the same coasts
  // doubles the density; without this cap it would double the work per place too,
  // and the square law [HC-15] bans would come back through the side door. It is
  // doing far more work than it was: a week's reach offers a town thirty-odd
  // candidates where two days offered it seven.
  maxMembers: 8,
  // WHICH DAY OF THE SEASON A MARKET HOLDS ITS FAIR. Market `h` meets on day
  // `h x fairStride mod 90`, every season, for ever — so a market still beats
  // ONCE A SEASON ([HC-2]: the season is the beat) and what the stride sets is
  // its PHASE, which is exactly what [P-20] sanctions: "stagger only by a pure
  // function of (id, tick); never stagger something whose cadence is a rule."
  //
  // SEVEN, BECAUSE IT SHARES NO FACTOR WITH NINETY. 90 is 2 x 3 x 3 x 5, so any
  // stride coprime with it walks every day of the season before repeating — the
  // first ninety markets in the world therefore fall on ninety DIFFERENT days
  // by construction, and this sea's fifty use fifty of them. A stride of
  // `90 / hoods` would spread them just as evenly and would move every market in
  // the world the day a fifty-first port was founded, which is precisely what
  // [HC-10] exists to forbid. This one is a function of the market's own id and
  // of nothing else.
  fairStride: 7,
} as const;

export interface Neighbourhood {
  id: number;
  // Place ids, ASCENDING. Fixed at generation and never rebuilt — which is also
  // what fixes the accumulation order, so [P-9]'s "float addition is not
  // associative" cannot leak the caller's iteration order into the sums.
  members: number[];
}

export interface Markets {
  hoods: Neighbourhood[];
  // How many neighbourhoods each place belongs to. A place splits its offer and
  // its want evenly across them, so goods are conserved exactly however much the
  // markets overlap.
  hoodsOf: number[];
  // WHICH MARKETS MEET ON WHICH DAY OF THE SEASON — ninety rows, hood ids
  // ascending within a row, built once and never rebuilt.
  //
  // IT IS A BUCKET AND NOT A TEST ([P-15], [P-14]). A market due on a known
  // future day goes in that day's row; the driver reads one row and is done,
  // and on the fifty-odd days a fair falls the row names exactly who is meeting.
  // The alternative — asking all fifty markets every day whether today is theirs
  // — is 18,000 questions a year to which the answer is almost always no.
  dueOn: number[][];
}

// One neighbourhood centred on each place: a CAPPED SPREAD OF THE PORTS WITHIN
// REACH, FROM THE NEAREST TO THE FARTHEST — which is [HC-82]'s "a small, fixed
// set of OVERLAPPING market neighbourhoods" exactly.
//
// WHY NOT THE NEAREST SEVEN, WHICH IS WHAT THIS WAS. Widening the reach on its
// own changes nothing at all: nearest-seven re-picks the same near coast out of
// the wider list, and the measurement says so — at a week's reach it left the
// mean partner 183 nm away against 171 nm at two days', and not one partner in
// the world beyond three days' sail. The reach is only the size of the list; the
// PICK is what decides whether a town trades with a different climate.
//
// A STRIDE AND NOT A ROLL, and that is the load-bearing choice. Slot k takes the
// port ranked `k/7` of the way down the town's own distance list, so one partner
// comes from each seventh of the range BY CONSTRUCTION — the nearest port is
// always in (slot 0) and so is one from the far seventh. A roll would have to be
// argued and re-measured every time the map moved; this cannot come out near by
// luck. It also keeps this function a pure function of positions with no seed in
// it, which the paragraph below depends on.
//
// AND IT TELLS NEIGHBOURING PORTS APART, which the nearest-N never could: each
// town strides its OWN ranking, so two ports on the same coast read the same
// candidates in different orders and end up with different partners. Measured on
// the closest pair to every port over four seeds, the overlap between their two
// partner sets (Jaccard) falls from 0.69 to 0.20.
//
// MEMBERSHIP IS NOT SYMMETRIC, and it never quite was — the cap already trimmed
// a crowded coast unevenly. The spread makes it ordinary rather than rare, so it
// is worth being explicit that NOTHING IN THE CLEARING NEEDS IT TO BE. A place
// does not offer INTO a neighbourhood and wait for one back: it is a member of
// `hoodsOf[i]` neighbourhoods and puts `1/hoodsOf[i]` of both its offer AND its
// want into each of them, so its books balance across the set it belongs to
// whatever anyone else picked. Every place is in its own neighbourhood, so
// `hoodsOf` is never zero and no place can be left with nobody to trade with.
//
// IT READS POSITIONS AND NOTHING ELSE, which is why the parameter is a list of
// points rather than a list of places. The generator needs the neighbourhoods
// BEFORE a place has a size, a crown, a name or a founding day — the timber
// covering in `worldgen.ts` is decided from them — and siting fixes positions
// first of all, so this can honestly be asked at that moment. A `Place[]`
// satisfies it structurally, so every existing call site is unchanged.
//
// [P-2]: this is O(N^2), and it is asked twice per world — once for the
// covering and once for the season that follows. That is the same trade the cut
// makes in `places.ts` and the same reason: it is a pure function of positions
// that never move, so the two answers cannot differ, and the alternative is a
// second copy of a derived fact living on the World, which [HC-14] and [P-47]
// both refuse. Fifty places is 2,500 distances, once, against nothing per tick.
export function makeMarkets(places: readonly { x: number; y: number }[]): Markets {
  const n = places.length;
  const hoods: Neighbourhood[] = [];
  const hoodsOf: number[] = [];
  for (let i = 0; i < n; i++) hoodsOf.push(0);

  const near: { id: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    near.length = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = distanceNm(places[i].x, places[i].y, places[j].x, places[j].y);
      if (d <= MARKET.reachNm) near.push({ id: j, d });
    }
    // Nearest first, id as the tie-break — a consistent total order with an
    // explicit direction ([P-10]).
    near.sort((a, b) => a.d - b.d || a.id - b.id);
    const members = [i];
    const slots = MARKET.maxMembers - 1;
    if (near.length <= slots) {
      // Fewer candidates than seats: a thin coast trades with everyone it can
      // reach, and there is no spread to take.
      for (let k = 0; k < near.length; k++) members.push(near[k].id);
    } else {
      // One from each seventh of the ranking. `near.length >= slots` makes the
      // step at least one, so the indices are strictly increasing and no port is
      // taken twice.
      for (let k = 0; k < slots; k++) members.push(near[Math.floor((k * near.length) / slots)].id);
    }
    members.sort((a, b) => a - b);
    for (let k = 0; k < members.length; k++) hoodsOf[members[k]]++;
    hoods.push({ id: i, members });
  }

  // ...and the calendar of fairs, laid out once. Filled in ascending hood order,
  // so a row's ids are ascending too and the day's clearing walks its markets in
  // a fixed order ([P-9], [P-10]).
  const dueOn: number[][] = [];
  for (let d = 0; d < CALENDAR.daysPerSeason; d++) dueOn.push([]);
  for (let h = 0; h < hoods.length; h++) dueOn[(h * MARKET.fairStride) % CALENDAR.daysPerSeason].push(h);

  return { hoods, hoodsOf, dueOn };
}

// A line a person can check the generator against ([HC-16] applied to itself).
export function describeMarkets(m: Markets): string {
  let total = 0;
  let alone = 0;
  for (let i = 0; i < m.hoods.length; i++) {
    total += m.hoods[i].members.length;
    if (m.hoods[i].members.length === 1) alone++;
  }
  const mean = m.hoods.length ? total / m.hoods.length : 0;
  return (
    `${m.hoods.length} market neighbourhoods within ${Math.round(MARKET.reachNm)} nm, ` +
    `${mean.toFixed(1)} places apiece` +
    (alone ? `, and ${alone} port${alone === 1 ? "" : "s"} with no neighbour at all` : "")
  );
}

// ---- The trade lanes, and what a squadron does to them ----------------------
//
// [HC-86] "`access` reads real routes and blockades." This is the routes half,
//         and §11.6 is explicit that it is not an upgrade: it is the thing that
//         makes [HC-87] true of the WORLD rather than of one town.
//
// A LANE IS A TRADE PARTNERSHIP — two places that share a market neighbourhood —
// and that is not a new fact about the world, it is [HC-82] read the other way
// round. The neighbourhoods are already built once at generation out of real
// distances, and positions never move ([P-2]: the O(N^2) pass runs once and the
// seasonal one is O(N x k)).
//
// WHAT A LANE IS NOT, AND THIS IS THE CORRECTION OF 2026-09-28: it is not the
// sea. The sea connects any two ports a ship can sail between, it is not owned,
// and nothing here decides where a hull may go — `sendCargo` asks the water and
// the schedule and never asks this table. What a lane says is only that these
// two BUY AND SELL with each other, which is the handful of ports out of the
// fifty that a blockade is worth mounting against.
//
// [HC-15] IS NOT BREACHED BY A LANE BEING A PAIR. What [HC-15] bans is a
// SEASONAL pass that compares every place to every other. `MARKET.maxMembers`
// caps a neighbourhood at 8, so a place holds a handful of lanes however
// crowded its coast, the whole lane table is built once, and reading a place's
// reach walks its own short list and nothing else.
//
// NOTHING IN THE SHIPPED SIM CUTS A LANE. `openRoutes` is the empty case and it
// is what the world is handed, exactly as `noWars` is: nations do not declare
// war yet (KAN-101) and no squadron blockades anything yet. The seam is here so
// that when one does, nothing in this file changes.

export interface Routes {
  // Compressed rows, because a place's lanes are a short fixed list and this is
  // read every season: the lanes of place `i` are `to[at[i] .. at[i+1])`,
  // ASCENDING, each place listed once however many neighbourhoods it shares.
  at: Int32Array;
  to: Int32Array;
  // Parallel to `to` — 1 if this lane is closed. A lane appears twice, once in
  // each end's row, and both entries always agree: the sea does not admit a
  // blockade that only works in one direction ([HC-85] gates BOTH ways).
  shut: Uint8Array;
}

// Every lane the neighbourhoods imply, all of them open. The `noWars` of routes.
export function openRoutes(m: Markets): Routes {
  const n = m.hoods.length;
  const near: Set<number>[] = [];
  for (let i = 0; i < n; i++) near.push(new Set<number>());
  for (let h = 0; h < m.hoods.length; h++) {
    const members = m.hoods[h].members;
    for (let a = 0; a < members.length; a++) {
      for (let b = 0; b < members.length; b++) {
        if (a !== b) near[members[a]].add(members[b]);
      }
    }
  }

  const at = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) at[i + 1] = at[i] + near[i].size;
  const to = new Int32Array(at[n]);
  for (let i = 0; i < n; i++) {
    const row = [...near[i]].sort((a, b) => a - b);
    for (let k = 0; k < row.length; k++) to[at[i] + k] = row[k];
  }
  return { at, to, shut: new Uint8Array(at[n]) };
}

// Find where a lane is recorded in one end's row, or -1. A row is a handful of
// entries and this is a setup verb, not a tick ([P-2]).
function slotOf(r: Routes, from: number, to: number): number {
  for (let k = r.at[from]; k < r.at[from + 1]; k++) if (r.to[k] === to) return k;
  return -1;
}

// Close one lane, or open it again. Both ends, always — see `shut`.
export function shutLane(r: Routes, a: number, b: number, on = true): void {
  const there = slotOf(r, a, b);
  const back = slotOf(r, b, a);
  if (there < 0 || back < 0) return;
  r.shut[there] = on ? 1 : 0;
  r.shut[back] = on ? 1 : 0;
}

// WHAT A SQUADRON OFF A PORT ACTUALLY DOES: it does not cut one lane, it sits
// across all of them. This is the verb the player and a crown both reach for,
// and `shutLane` is the primitive under it for the day somebody wants to hold a
// strait rather than a harbour.
export function blockade(r: Routes, place: number, on = true): void {
  for (let k = r.at[place]; k < r.at[place + 1]; k++) shutLane(r, place, r.to[k], on);
}

export const laneIsOpen = (r: Routes, a: number, b: number): boolean => {
  const k = slotOf(r, a, b);
  return k >= 0 && r.shut[k] === 0;
};

// HOW MUCH OF THE SHIPPING STILL CALLS — the share of this place's lanes that
// are open, 0..1, and the number the ledger multiplies its whole commerce by.
//
// A SHARE AND NOT A COUNT, deliberately. Normalising against some "full
// roadstead" would make reach a second price on POSITION, and position is
// already priced — twice: by `MARKET.reachNm`, which decides who is a neighbour
// at all, and by the neighbourhood's own clearing ratio, which is what makes a
// thin market dear and a crowded one cheap ([HC-83]). A place is not to be
// charged a third time for where the siting roll put it. What `access` prices is
// INTERRUPTION, which is why it reads 1 in peace everywhere and why [HC-87]'s
// ceiling is fragile rather than low.
//
// A place with no lane at all comes out at 0, and that is the honest reading
// rather than an edge case: nobody buys or sells with a port that has no trading
// partner, so its customs house takes a cut of nothing. Every place is in its own
// neighbourhood and takes a spread of whoever is within a week's sail, so this
// needs a port alone on an empty sea; `describeMarkets` counts them and this
// world has none.
export function reachOf(r: Routes, place: number): number {
  const from = r.at[place];
  const span = r.at[place + 1] - from;
  if (span <= 0) return 0;
  let open = 0;
  for (let k = from; k < from + span; k++) if (r.shut[k] === 0) open++;
  return open / span;
}

// A line a person can check a blockade against ([HC-16] applied to itself).
export function describeRoutes(r: Routes): string {
  const lanes = r.to.length / 2;
  let shut = 0;
  for (let k = 0; k < r.shut.length; k++) if (r.shut[k] === 1) shut++;
  return shut === 0
    ? `${lanes} sea lanes, every one of them open`
    : `${lanes} sea lanes, ${shut / 2} of them closed`;
}

// ---- War, as a filter on the pool ------------------------------------------
//
// [HC-84] A place draws only on supply from factions it is not at war with.
//         There are five crowns and the neutrals — a constant handful — so
//         eligibility is a small fixed mask and the clearing stays linear. This
//         is how a war is FELT in a town that never sees a soldier, and it is the
//         largest economic effect war has.
//
// Nations do not declare war yet (KAN-101). The seam is here so that when they
// do, nothing in this file changes: a `Wars` is handed in, or it is not.

export interface Wars {
  // atWar[a * n + b] — symmetric, and a faction is never at war with itself.
  at: Uint8Array;
  count: number;
}

export function noWars(factions: number): Wars {
  return { at: new Uint8Array(factions * factions), count: factions };
}

export function declareWar(w: Wars, a: number, b: number, on = true): void {
  if (a === b) return;
  w.at[a * w.count + b] = on ? 1 : 0;
  w.at[b * w.count + a] = on ? 1 : 0;
}

export const atWar = (w: Wars, a: number, b: number): boolean => w.at[a * w.count + b] === 1;

// ---- The clearing ----------------------------------------------------------
//
// Per neighbourhood, per class, IN TIER ORDER. Tier order is what implements
// [HC-77]: victuals clear first, and a place's demand for the next tier is
// registered only if the previous one came out satisfied.

// What each place brings to market this season. Built once, from the ledger, and
// thrown away when the season ends — a flow balance, never a stock (§3.5.3).
interface Stall {
  faction: number;
  offer: number[];
  want: number[];
  purse: number; // coin it may commit, which is what stops a pauper bidding
  secure: boolean; // did the tier below come out covered? ([HC-77]'s gate)
}

// The price a ratio commands, FOR ONE GOOD. `sqrt` is on [P-7]'s exactly-specified
// list, so this is bit-identical everywhere; `Math.pow` and `**` are banned
// ([P-5], [P-6]). The damping term is what stops a neighbourhood with a bushel on
// either side of the scale swinging to the ceiling.
//
// THE BASE IS THE GOOD'S TIER and there is no per-good row to look up. [HC-82]:
// what makes grain dear here and cheap a week away is this neighbourhood's own
// ratio, and there is no global list to arbitrage against.
export function priceFor(good: number, sought: number, offered: number): number {
  const base = TRADE.basePrice[TIER_RANK[good]];
  const ratio = (sought + TRADE.thin) / (offered + TRADE.thin);
  const p = base * Math.sqrt(ratio);
  const lo = base * TRADE.priceFloor;
  const hi = base * TRADE.priceCeiling;
  return p < lo ? lo : p > hi ? hi : p;
}

// Hold the markets that meet TODAY — and then SEND THE SHIPS, because the
// clearing is the only thing that knows who supplied whom.
//
// `hoods` is the list of neighbourhoods whose fair falls today, ascending. The
// whole map at once is simply the case where that list is every market, and the
// arithmetic below reduces to it exactly: a town's `1/hoodsOf` share is the same
// share whichever day it is spent on, and `mine` — how many of TODAY'S fairs the
// town stands in — is `hoodsOf` when they all meet at once.
//
// STAGGERED, BUT STILL SEASONAL ([HC-2]). A market meets once a season and no
// oftener; what differs is WHICH day of the ninety. There is no new beat here,
// no timer, and no state that counts down — the day a market meets is a fact of
// the market, laid into `dueOn` at generation.
//
// `towns` is indexed by place id and must already have PRODUCED (phase 1). On
// return, every town that came to market holds the local price it faced, and one
// cargo hull is at sea for every pair of ports that traded. Nothing is landed
// here and nothing is paid for here: the buyer is credited on the day the ship
// ties up ([HC-45]), and settlement pays for what is on its quay.
//
// WHY THE PAIRS COST NOTHING, AND WHY THAT IS NOT [HC-15] BEING BENT. `[HC-15]`
// bans a pass that compares every place to every other place. This one compares
// a place only to the other members of its own market, and `MARKET.maxMembers`
// caps that at eight however crowded the coast is — so matching a buyer to the
// sellers who supplied him is eight comparisons, not fifty, and the whole
// clearing stays LINEAR in the number of places exactly as [HC-83] promises.
// The cap is what makes naming a counterparty affordable at all; widen it and
// this is the line that pays for it.
export function clearMarkets(
  m: Markets,
  world: World,
  towns: Town[],
  wars: Wars,
  routes: Routes,
  hoods: readonly number[],
): void {
  if (hoods.length === 0) return;
  const places = world.places;
  const n = towns.length;
  const nf = wars.count;

  // WHO IS AT MARKET TODAY. A place takes a seat the first time one of today's
  // fairs names it; `mine` counts how many of them it stands in. That count is
  // the only thing the clearing needs to know about the markets NOT meeting
  // today, and it is what keeps a place's books the same books whether its
  // fairs fall together or ninety days apart.
  //
  // [P-1]: the work is the places actually trading today, not the fifty. On an
  // ordinary day that is one market and eight ports.
  const seatOf = new Int32Array(n).fill(-1);
  const seats: number[] = [];
  const mine: number[] = [];
  for (let k = 0; k < hoods.length; k++) {
    const members = m.hoods[hoods[k]].members;
    for (let j = 0; j < members.length; j++) {
      const id = members[j];
      if (seatOf[id] < 0) {
        seatOf[id] = seats.length;
        seats.push(id);
        mine.push(0);
      }
      mine[seatOf[id]]++;
    }
  }
  const ns = seats.length;

  // Phase 1's output, read once per market-goer. Nothing below reads a Town again.
  const stalls: Stall[] = [];
  for (let s = 0; s < ns; s++) {
    const i = seats[s];
    // THE WORLD HANDS THE LEDGER ITS REACH, here, before anything derives from
    // it ([HC-71]: the world drives the ledger and the ledger never reaches
    // out). It is written on the same beat as the price beside it, which is the
    // beat the economy runs on ([P-50]), and it is
    // rewritten from the lane table every season rather than invalidated when a
    // blockade changes — fifty places times a handful of lanes is nothing, and
    // an active recompute cannot go stale the way a dirty flag can ([P-21]).
    // Every place stands in its own market, so every place is still handed one
    // once a season, on its own fair day.
    towns[i].market.reach = reachOf(routes, i);
    const d = derive(towns[i]);
    const share = m.hoodsOf[i] > 0 ? 1 / m.hoodsOf[i] : 0;
    const offer = new Array<number>(GOOD_COUNT).fill(0);
    const want = new Array<number>(GOOD_COUNT).fill(0);
    for (let g = 0; g < GOOD_COUNT; g++) {
      offer[g] = d.commerce.offer[g] * share;
      want[g] = d.commerce.want[g] * share;
    }
    stalls.push({
      faction: places[i].faction,
      offer,
      want,
      // THE PURSE IS SHARED LIKE THE SACKS ARE, and it has to be for the same
      // reason. A town's coin was one heap spent down across markets that all
      // met in one instant; met on ninety different days, a heap rebuilt at each
      // fair would let the same coin be committed `hoodsOf` times over. So it
      // brings the share of its purse that matches the share of its offer, and
      // what it commits across a whole season is what it has.
      purse: Math.max(0, towns[i].wealth + d.commerce.earned + towns[i].grant) * share * mine[s],
      secure: true,
    });
  }

  // Scratch, reused across every hood and class. [P-24]: nothing is allocated
  // inside the loops that matter, and the rows are the size of the day's market
  // rather than of the world.
  const offeredBy = new Float64Array(nf);
  const soughtBy = new Float64Array(nf);
  const supplyFor = new Float64Array(nf);
  const demandFor = new Float64Array(nf);
  const priceFor_ = new Float64Array(nf);
  const priceSum = new Float64Array(ns * GOOD_COUNT);
  const priceWeight = new Float64Array(ns * GOOD_COUNT);
  // WHAT EACH PLACE WAS MATCHED WITH, and it is scratch rather than a field on
  // the Town because nothing outside this function has any business reading it:
  // a town is credited when a ship lands, never when a deal is struck ([HC-46] —
  // "he does not count unhatched chickens", enforced by there being nothing to
  // count). The one reader is [HC-77]'s tier gate at the foot of each tier.
  const matched = new Float64Array(ns * GOOD_COUNT);

  // WHO SUPPLIED WHOM. One row per selling-and-buying pair, holding everything
  // that pair moved this season, across every good and every neighbourhood the
  // two share — because the ship is per PAIR and not per good, and not per
  // market either.
  const pairAt = new Map<number, number>();
  const pairKey: number[] = [];
  const pairHold: number[][] = [];
  // `seller x n + buyer`, which is also the order the ships sail in — a total
  // order with no tie to break ([P-10]), so two runs of one seed put the same
  // hulls on the water in the same sequence.
  //
  // ONE CLOSURE PER SEASON, NOT PER ITERATION, and it does not escape ([P-25]).
  // A row is allocated the first time a pair trades and then only added to; the
  // whole season allocates a few hundred short rows, measured, against a
  // dense 48 x 48 x 11 table that would be a pairwise structure in everything
  // but name ([HC-15]).
  const holdFor = (seller: number, buyer: number): number[] => {
    const key = seller * n + buyer;
    const at = pairAt.get(key);
    if (at !== undefined) return pairHold[at];
    pairAt.set(key, pairKey.length);
    pairKey.push(key);
    const row = new Array<number>(GOOD_COUNT).fill(0);
    pairHold.push(row);
    return row;
  };

  // THE SHAPE DID NOT CHANGE WHEN THE GOODS ARRIVED, and that is the point of
  // [HC-83] rather than a happy accident: it was `for each class, for each
  // neighbourhood, sum by faction` and it is `for each GOOD` — the scratch rows
  // widened from three to eleven and the algorithm did not move. [HC-15] survives
  // because the work is still linear in places: goods and factions are fixed
  // handfuls and a neighbourhood is capped at eight.
  //
  // THE GOODS ARE WALKED IN TIER ORDER because `GOOD_ORDER` is sorted that way,
  // so the outer loop over tiers is what carries [HC-77] exactly as it always did.
  for (let t = 0; t < CLASS_COUNT; t++) {
    for (let c = TIER_AT[t]; c < TIER_AT[t + 1]; c++) {
      for (let h = 0; h < hoods.length; h++) {
        const members = m.hoods[hoods[h]].members;

        offeredBy.fill(0);
        soughtBy.fill(0);
        // SUMMATION, and the members are walked in a FIXED ascending order — so
        // shuffling the array of places cannot change a single bit ([P-9]).
        for (let k = 0; k < members.length; k++) {
          const s = stalls[seatOf[members[k]]];
          offeredBy[s.faction] += s.offer[c];
          // [HC-77]: a place short of the tier below registers NO demand here,
          // however rich it is. The gate decides whether the demand EXISTS.
          if (s.secure) soughtBy[s.faction] += s.want[c];
        }

        // [HC-84]. For each faction, the pool it can reach and the demand competing
        // for that pool are the same sum with the same mask — so one ratio per
        // faction is the whole of war's effect, and with no war every faction sees
        // the same number and this collapses to a single clearing.
        for (let f = 0; f < nf; f++) {
          let supply = 0;
          let demand = 0;
          for (let g = 0; g < nf; g++) {
            if (f !== g && wars.at[f * nf + g] === 1) continue;
            supply += offeredBy[g];
            demand += soughtBy[g];
          }
          supplyFor[f] = supply;
          demandFor[f] = demand;
          priceFor_[f] = priceFor(c, demand, supply);
        }

        for (let k = 0; k < members.length; k++) {
          const id = members[k];
          const s = stalls[seatOf[id]];
          const f = s.faction;
          const slot = seatOf[id] * GOOD_COUNT + c;

          // A SELLER is rationed by the price, not by a queue: a glut collapses what
          // his cargo fetches. A BUYER is rationed by the goods, because you cannot
          // eat bread that does not exist — the asymmetry §3.5.3 makes on purpose.
          const price = priceFor_[f];
          if (s.offer[c] > 0) {
            priceSum[slot] += price * s.offer[c];
            priceWeight[slot] += s.offer[c];
          }
          if (s.secure && s.want[c] > 0) {
            const fill = demandFor[f] > 0 ? Math.min(1, supplyFor[f] / demandFor[f]) : 0;
            // ...and he cannot bid what he has not got. Capping the bid at the
            // purse is what stops a broke town soaking up a neighbour's grain.
            const afford = price > 0 ? s.purse / price : 0;
            let take = s.want[c] * fill;
            if (take > afford) take = afford;
            matched[slot] += take;
            s.purse -= take * price;
            priceSum[slot] += price * take;
            priceWeight[slot] += take;

            // ...AND NOW NAME THE MEN HE BOUGHT IT FROM. The heap is split back
            // across the sellers who filled it, each in proportion to what he
            // put up — which is the only split that leaves the pro-rata rule
            // intact in both directions: a short supply rations every buyer
            // equally, and a thin seller supplies every buyer equally.
            //
            // IT CONSERVES BY CONSTRUCTION. `supplyFor[f]` is the sum of exactly
            // these sellers' offers, so the shares sum to `take` and no sack is
            // invented; and the same sellers' total across the buyers who see
            // the same pool cannot exceed what they put up, because those
            // buyers' takes cannot ([HC-83] is doing the work, not a guard).
            //
            // THE SELLERS ARE WALKED IN THE SAME FIXED ASCENDING ORDER the sums
            // above used ([P-9]), so the holds are accumulated identically on
            // every run of a seed.
            const supply = supplyFor[f];
            if (take > 0 && supply > 0) {
              for (let j = 0; j < members.length; j++) {
                const sid = members[j];
                const seller = stalls[seatOf[sid]];
                if (seller.offer[c] <= 0) continue;
                // [HC-84], read off exactly as the pool was summed: a buyer
                // draws only on factions he is not at war with.
                if (f !== seller.faction && wars.at[f * nf + seller.faction] === 1) continue;
                holdFor(sid, id)[c] += (take * seller.offer[c]) / supply;
              }
            }
          }
        }
      }
    }

    // The tier is done: who came out covered, and may therefore reach one rung
    // higher next pass ([HC-77]).
    //
    // THE GATE READS THE TIER WHILE THE CLEARING READS THE GOODS, and that is a
    // ruling and not a shortcut. Asked per GOOD it would be the trap the whole
    // direction exists to avoid: a port whose neighbourhood happens to have no
    // salt would be "short of victuals" for ever and would register NO demand
    // for materials or luxury, anywhere, however much bread it had. A place with
    // corn in its barns is fed. So the shortfall is the tier's NET position —
    // `want - offer` summed over its goods, which is exactly the tier's
    // consumption less its production, because a good is in one column or the
    // other and never both.
    //
    // AND IT IS ASKED OF THE WHOLE TOWN, not of the stall. `net` and `got` are
    // both a single fair's worth — one `1/hoodsOf` share of the town's need,
    // and what one fair (or `mine` of them) filled of it — so both are lifted to
    // the town's full season before the slack, an absolute tolerance on a full
    // tier, is compared against them. When every market meets at once `mine` is
    // `hoodsOf` and this is `net x hoodsOf - got` exactly, which is what it was.
    for (let s = 0; s < ns; s++) {
      const st = stalls[s];
      if (!st.secure) continue;
      let net = 0;
      let got = 0;
      for (let c = TIER_AT[t]; c < TIER_AT[t + 1]; c++) {
        net += st.want[c] - st.offer[c];
        got += matched[s * GOOD_COUNT + c];
      }
      st.secure = (net - got / mine[s]) * m.hoodsOf[seats[s]] <= TRADE.secureSlack;
    }
  }

  // The LOCAL price a place faces, PER GOOD — the quantity-weighted mean of the
  // prices today's fairs struck. [HC-82]: there is no global price to table, and
  // two ports a week apart genuinely disagree about the same good.
  //
  // ONLY THE PLACES THAT CAME TO MARKET. A port whose fair is forty days off is
  // still living with the price its last one struck, which is the truthful
  // reading of a world where markets meet on their own days: a price is what the
  // last fair said, and it is stale until the next one.
  for (let s = 0; s < ns; s++) {
    const mk = towns[seats[s]].market;
    for (let c = 0; c < GOOD_COUNT; c++) {
      const slot = s * GOOD_COUNT + c;
      mk.price[c] = priceWeight[slot] > 0 ? priceSum[slot] / priceWeight[slot] : TRADE.basePrice[TIER_RANK[c]];
    }
  }

  // ...AND EVERY CLEARED TRADE SAILS. One hull per pair, carrying everything
  // that pair moved, taking the passage the water between the two ports
  // implies ([P-16]: it stores a departure and an arrival and is never stepped).
  //
  // IN KEY ORDER, WHICH IS SELLER THEN BUYER. `Map` iterates in insertion order
  // and insertion order is the clearing's own walk, which is already fixed — but
  // the ids are what a reader can check, and sorting them makes the fleet a
  // function of the season rather than of the loop that built it ([P-10]).
  pairKey.sort((a, b) => a - b);
  for (let i = 0; i < pairKey.length; i++) {
    const key = pairKey[i];
    sendCargo(world, Math.trunc(key / n), key % n, pairHold[pairAt.get(key)!]);
  }
}

// ---- The seasonal tick -----------------------------------------------------
//
// §2.3's five phases, and the reason they exist: THE PHASES KEEP THE WORLD
// ORDER-INDEPENDENT. Phase 1 fixes what everyone has and wants, phase 2 moves
// goods, phase 3 books the result. No place may re-produce in response to a
// price it saw in phase 2 — it reacts next season, through its governor.
//
// PHASE 2 IS NOT IN THIS FUNCTION, AND THAT IS THE ONE STRUCTURAL CHANGE. A
// market still clears once a season — its cadence is a rule and is untouched
// ([HC-2]) — but it clears on ITS OWN day of the ninety, so the clearing is
// driven from the day loop off a bucket rather than from the season's opening
// instant. There is no reason a hundred coasts would agree a date, and a world
// where they did put two hundred and forty hulls to sea on one morning and left
// the water empty for the other eighty-two days.
//
// WHAT THE PHASE ORDER STILL MEANS, because that is the part worth getting
// right. A place PRODUCES on the season's first day, its markets meet through
// the ninety days that follow against exactly that harvest, and the SETTLING at
// the head of the next season pays for what those deals actually landed. The
// order is therefore unchanged as a PIPELINE — produce, clear, settle — and only
// the instants have spread out. What a town must never do is meet a market with
// a harvest its own settling has already banked into its stores, which is what
// puts the clearing AFTER settling within a day: every fair, including one that
// falls on the season's first day, reads the same freshly-struck shelf.
//
// PHASE 2 NO LONGER DELIVERS ANYTHING, AND PHASE 3 IS A SEASON BEHIND IT. A
// passage between two ports of one market is at most a fortnight — each is
// within a week's sail of the port their market is centred on, so the two of
// them can be twice that apart — and a season is ninety days. So the ships a
// clearing sends land inside the season that opened, and are paid for at the
// settling ninety days later. THE SEASON THAT SETTLES IS
// SPENDING WHAT THE PREVIOUS SEASON'S DEALS DELIVERED — which is [HC-46] in the
// only form that means anything ("a governor plans on what has arrived, never on
// what is promised"), and the whole reason taking a ship is not cosmetic.

export interface WorldSeason {
  // The day the season began. One number, and a year is read off it by whoever
  // wants to print one ([P-47]).
  day: number;
  seasons: (TownSeason | null)[];
}

// THE WORLD HANDS EVERY PLACE THE SAME DAY, once, at the top ([HC-71], [HC-72]'s
// first row). It used to ask each town what year IT thought it was — `year(t)`,
// off that town's private season counter — which is why fifty places founded on
// day 0 agreed only by coincidence (KAN-107). This got shorter, not longer.
export function stepWorldSeason(world: World, towns: Town[]): WorldSeason {
  const day = world.day;
  // 1 · PRODUCE
  for (let i = 0; i < towns.length; i++) produceSeason(towns[i], day);
  // 2 · CLEAR — on each market's own day, in the driver below ([P-17b]: this
  //     function is not handed the markets, so it cannot reach for one).
  // 3 · SETTLE
  for (let i = 0; i < towns.length; i++) settleSeason(towns[i]);
  // 4 · GOVERN
  const seasons: (TownSeason | null)[] = [];
  for (let i = 0; i < towns.length; i++) {
    const grew = stepFootprint(towns[i]);
    seasons.push({ day, decided: governorTurn(towns[i], day), grew });
    // ...and the books are struck, so the weather's account against THIS
    // harvest is closed with them ([HC-6]). It is closed here rather than in
    // phase 1 or 3 because every one of the four phases above has to read the
    // same harvest: a governor who advised on an unspoiled crop the settlement
    // before him had already been paid for would be reading two different
    // seasons at once.
    closeHarvest(towns[i]);
  }
  // 5 · RULE — nations acting is KAN-101 and is deliberately not here.
  return { day, seasons };
}

// ---- The daily tick --------------------------------------------------------
//
// §2.2's four phases, IN ORDER, every simulated day. They were specced, both
// ends of each were built and tested, and until now nothing assembled them
// anywhere except inside `weather.test.ts` — so no storm had ever reached a
// ledger and no dispatch had ever existed at runtime (decisions.md, 2026-09-14).
//
//   1. WEATHER ADVANCES       every live event moves along its track and its
//                             severity walks the spectrum; events form and
//                             dissipate per the climate's rules.
//   2. CONTACT RESOLVES       severity is sampled at each place, at its position,
//                             now — and [HC-6] splits what that is worth in two.
//   3. OBJECTS MOVE           and a dispatch does not, because it has no present
//                             ([P-16]): its course was settled the day it sailed.
//   4. INTERCEPTION RESOLVES  nothing in this milestone — there is no player to
//                             take anything — but the PHASE EXISTS, so that
//                             adding it later reorders nothing. Both 3 and 4 are
//                             `stepDispatches`, in that order, inside it.
//
// [P-2] is complexity x TICK RATE and this is the highest-rate loop in the game:
// it runs 360 times for every turn of the seasonal one. So the hoistable numbers
// are hoisted into `Sky` ([P-18]) and nothing is allocated here at all ([P-24]).
export function stepWorldDay(world: World, towns: Town[], sky: Sky): void {
  // 1 · WEATHER ADVANCES
  stepWeather(world);

  // 2 · CONTACT RESOLVES. The day's ambient, once per zone rather than once per
  // place, and then one sample per place — [HC-32]'s "at the place and the
  // moment of contact, and nowhere else".
  readSky(world, sky);
  for (let i = 0; i < towns.length; i++) {
    const p = world.places[i];
    // [P-14] IN ITS ONLY AVAILABLE FORM HERE. Every place has to be SAMPLED —
    // that is the work, and a place cannot be taken out of the list because its
    // weather is fair today and foul tomorrow. What is skipped is the effect,
    // which on most days is nothing at all: there is no object built, no roll
    // drawn and no ledger touched for an ordinary day's weather.
    if (bandAt(feltAt(world, p, sky)) === 0) continue;
    takeWeather(towns[i], world.day, contactAt(world, p, sky), pickAt(world, p));
  }

  // 3 · OBJECTS MOVE · 4 · INTERCEPTION RESOLVES · and then what survived lands.
  //
  // MOST DAYS THIS READS ONE BUCKET'S LENGTH AND STOPS ([P-15], [P-14]). The
  // clearing sends its whole fleet on the first day of a season and the passages
  // are short, so the sea empties quickly and stays empty. Measured on the house
  // seed: 226 hulls on the day the market cleared, 7 left on the eighth day,
  // none at all on the remaining eighty-two.
  //
  // A CARGO IS CREDITED HERE AND NOWHERE EARLIER ([HC-45]) — this is the only
  // line in the world that puts a good on a town's quay. What a crown sends is
  // still uncredited, because nothing sends one yet (KAN-101); the shape of the
  // loop is what both will share.
  const landed = stepDispatches(world);
  for (let i = 0; i < landed.length; i++) {
    const d = landed[i];
    if (d.payload !== PAYLOAD.cargo) continue;
    const quay = towns[d.to].market.landed;
    const hold = d.hold;
    for (let g = 0; g < hold.length; g++) quay[g] += hold[g];
  }
}

// Run the world forward, day by day, clearing on every seasonal boundary. The
// day is the atom ([HC-2], [HC-4]); the season is what the economy beats on.
//
// THE SEASONAL PHASES RUN BEFORE THE DAILY ONES ON A SEASON-START DAY, and the
// order is not arbitrary. The season resolves a harvest that the PRECEDING
// ninety days spoiled or spared; day 90 belongs to the season beginning, not to
// the one being closed. Run the other way round, every ninetieth day's downpour
// would be charged to a harvest it fell after — and `closeHarvest` would then
// wipe it before the season it actually belongs to could count it. So: strike the
// books, close the weather's account against them, and only then let the new
// day's weather begin filling the next one.
//
// SPLIT IN TWO SO THAT THE ORDER IS WRITTEN ONCE (KAN-100). A headless run wants
// years; a view wants however many days one frame of real time earned, which is
// never a round number and is usually one. Both are the same loop, and the loop
// is the one place the paragraph above is actually enforced — so the view calls
// `runDays` rather than keeping a second copy of the tick order that could drift
// away from this one ([P-47]).
//
// The two hooks are both READ-ONLY reporting seams and neither exists for the
// simulation's benefit: `onSeason` is what publishes [HC-16]'s reasons, and
// `onDay` fires after the day has fully resolved and BEFORE the clock moves on,
// so `world.day` is still the day being reported. Nothing they do can reach back
// into the tick — they are handed nothing to reach with.
export function runDays(
  world: World,
  towns: Town[],
  m: Markets,
  wars: Wars,
  routes: Routes,
  days: number,
  sky: Sky,
  onSeason?: (s: WorldSeason) => void,
  onDay?: () => void,
): void {
  for (let d = 0; d < days; d++) {
    if (startsSeason(world)) {
      const s = stepWorldSeason(world, towns);
      if (onSeason) onSeason(s);
    }
    // 2 · CLEAR — the markets whose fair falls on this day of the season, and on
    // most days that is an empty row and nothing at all ([P-15]: the bucket
    // names them, nothing is asked whether it is due). It sits after the season
    // so that a fair on the season's own first day reads the same freshly-struck
    // shelf every other fair reads.
    clearMarkets(m, world, towns, wars, routes, m.dueOn[dayOfSeason(world)]);
    stepWorldDay(world, towns, sky);
    if (onDay) onDay();
    stepDay(world);
  }
}

export function runYears(
  world: World,
  towns: Town[],
  m: Markets,
  wars: Wars,
  routes: Routes,
  years: number,
  onSeason?: (s: WorldSeason) => void,
): void {
  runDays(world, towns, m, wars, routes, years * DAYS_PER_YEAR, skyOf(world), onSeason);
}

