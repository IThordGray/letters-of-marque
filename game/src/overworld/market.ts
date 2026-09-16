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
// [HC-83] CLEARING IS SUMMATION, per neighbourhood, per class, in tier order.
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
import { CLASS_COUNT } from "../town/trade";
import { TRADE } from "../town/constants";
import { closeHarvest, derive, produceSeason, settleSeason, takeWeather } from "../town/sim";
import { governorTurn, type Season as TownSeason } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { DAYS_PER_YEAR } from "./calendar";
import { startsSeason, stepDay, type World } from "./clock";
import { stepDispatches } from "./dispatch";
import { bandAt, contactAt, feltAt, pickAt, readSky, skyOf, stepWeather, type Sky } from "./weather";
import { DAY_RUN_NM, distanceNm } from "./shape";
import type { Place } from "./places";

// ---- The neighbourhoods ----------------------------------------------------

export const MARKET = {
  // How far a market reaches. §6 puts an ordinary trade leg at one to four days;
  // two days' run is the middle of it, and at this world's port spacing it gives
  // a handful of neighbours rather than half the map.
  reachNm: DAY_RUN_NM * 2,
  // ...and a hard cap on the handful, which is what keeps the clearing LINEAR
  // rather than merely linear-at-fifty. Doubling the places on the same coasts
  // doubles the density; without this cap it would double the work per place too,
  // and the square law [HC-15] bans would come back through the side door.
  maxMembers: 8,
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
}

// One neighbourhood centred on each place: everything within reach, nearest
// first, capped. Membership is symmetric at the reach test and then trimmed by
// the cap, so a very crowded coast gives overlapping markets rather than one
// enormous one — which is [HC-82]'s "a small, fixed set of OVERLAPPING market
// neighbourhoods" exactly.
//
// [P-2]: this is O(N^2) and it runs ONCE, at world generation. Positions never
// move, so it is never recomputed.
export function makeMarkets(places: Place[]): Markets {
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
    for (let k = 0; k < near.length && members.length < MARKET.maxMembers; k++) members.push(near[k].id);
    members.sort((a, b) => a - b);
    for (let k = 0; k < members.length; k++) hoodsOf[members[k]]++;
    hoods.push({ id: i, members });
  }
  return { hoods, hoodsOf };
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

// ---- The sea lanes, and what a squadron does to them ------------------------
//
// [HC-86] "`access` reads real routes and blockades." This is the routes half,
//         and §11.6 is explicit that it is not an upgrade: it is the thing that
//         makes [HC-87] true of the WORLD rather than of one town.
//
// A ROUTE IS A SEA LANE BETWEEN TWO PLACES THAT SHARE A MARKET NEIGHBOURHOOD,
// and that is not a new fact about the world — it is [HC-82] read the other way
// round. The neighbourhoods are already built once at generation out of real
// distances, and positions never move ([P-2]: the O(N^2) pass runs once and the
// seasonal one is O(N x k)). If two places are near enough to clear a market
// together then there is water between them that ships actually use; if they
// are not, there is no lane to cut. Inventing a second notion of "who is
// reachable" would be [P-47] wearing a map: one definition, read twice.
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
// rather than an edge case: no shipping calls at a port nobody can reach in two
// days' run, so its customs house takes a cut of nothing. `describeMarkets`
// already counts such ports; this world has none, and a thinner one might.
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

// The price a ratio commands. `sqrt` is on [P-7]'s exactly-specified list, so
// this is bit-identical everywhere; `Math.pow` and `**` are banned ([P-5], [P-6]).
// The damping term is what stops a neighbourhood with a bushel on either side of
// the scale swinging to the ceiling.
export function priceFor(cls: number, sought: number, offered: number): number {
  const base = TRADE.basePrice[cls];
  const ratio = (sought + TRADE.thin) / (offered + TRADE.thin);
  const p = base * Math.sqrt(ratio);
  const lo = base * TRADE.priceFloor;
  const hi = base * TRADE.priceCeiling;
  return p < lo ? lo : p > hi ? hi : p;
}

// Clear one season across the whole map, all places at once.
//
// `towns` is indexed by place id and must already have PRODUCED (phase 1). On
// return, every town's `market` block holds the local price it faces and what
// the clearing found for it to buy; settlement (phase 3) decides what it can
// actually pay for.
export function clearSeason(m: Markets, places: Place[], towns: Town[], wars: Wars, routes: Routes): void {
  const n = towns.length;
  const nf = wars.count;

  // Phase 1's output, read once per place. Nothing below reads a Town again.
  const stalls: Stall[] = [];
  for (let i = 0; i < n; i++) {
    // THE WORLD HANDS THE LEDGER ITS REACH, here, before anything derives from
    // it ([HC-71]: the world drives the ledger and the ledger never reaches
    // out). It is written on the same beat as the price and the allotment
    // beside it, which is the beat the economy runs on ([P-50]), and it is
    // rewritten from the lane table every season rather than invalidated when a
    // blockade changes — fifty places times a handful of lanes is nothing, and
    // an active recompute cannot go stale the way a dirty flag can ([P-21]).
    towns[i].market.reach = reachOf(routes, i);
    const d = derive(towns[i]);
    const share = m.hoodsOf[i] > 0 ? 1 / m.hoodsOf[i] : 0;
    const offer = [0, 0, 0];
    const want = [0, 0, 0];
    for (let c = 0; c < CLASS_COUNT; c++) {
      offer[c] = d.commerce.offer[c] * share;
      want[c] = d.commerce.want[c] * share;
    }
    stalls.push({
      faction: places[i].faction,
      offer,
      want,
      purse: Math.max(0, towns[i].wealth + d.commerce.earned + towns[i].grant),
      secure: true,
    });
    const mk = towns[i].market;
    mk.allotted[0] = 0;
    mk.allotted[1] = 0;
    mk.allotted[2] = 0;
  }

  // Scratch, reused across every hood and class. [P-24]: nothing is allocated
  // inside the loops that matter.
  const offeredBy = new Float64Array(nf);
  const soughtBy = new Float64Array(nf);
  const supplyFor = new Float64Array(nf);
  const demandFor = new Float64Array(nf);
  const priceFor_ = new Float64Array(nf);
  const priceSum = new Float64Array(n * CLASS_COUNT);
  const priceWeight = new Float64Array(n * CLASS_COUNT);

  for (let c = 0; c < CLASS_COUNT; c++) {
    for (let h = 0; h < m.hoods.length; h++) {
      const members = m.hoods[h].members;

      offeredBy.fill(0);
      soughtBy.fill(0);
      // SUMMATION, and the members are walked in a FIXED ascending order — so
      // shuffling the array of places cannot change a single bit ([P-9]).
      for (let k = 0; k < members.length; k++) {
        const s = stalls[members[k]];
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
        const s = stalls[id];
        const f = s.faction;
        const slot = id * CLASS_COUNT + c;

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
          towns[id].market.allotted[c] += take;
          s.purse -= take * price;
          priceSum[slot] += price * take;
          priceWeight[slot] += take;
        }
      }
    }

    // The tier is done: who came out covered, and may therefore reach one rung
    // higher next pass ([HC-77]).
    for (let i = 0; i < n; i++) {
      const s = stalls[i];
      if (!s.secure) continue;
      const short = s.want[c] * m.hoodsOf[i] - towns[i].market.allotted[c];
      s.secure = short <= TRADE.secureSlack;
    }
  }

  // The LOCAL price a place faces — the quantity-weighted mean of the prices its
  // own neighbourhoods struck. [HC-82]: there is no global price to table, and
  // two ports far enough apart genuinely disagree.
  for (let i = 0; i < n; i++) {
    const mk = towns[i].market;
    for (let c = 0; c < CLASS_COUNT; c++) {
      const slot = i * CLASS_COUNT + c;
      mk.price[c] = priceWeight[slot] > 0 ? priceSum[slot] / priceWeight[slot] : TRADE.basePrice[c];
    }
  }
}

// ---- The seasonal tick -----------------------------------------------------
//
// §2.3's five phases, and the reason they exist: THE PHASES KEEP THE WORLD
// ORDER-INDEPENDENT. Phase 1 fixes what everyone has and wants, phase 2 moves
// goods, phase 3 books the result. No place may re-produce in response to a
// price it saw in phase 2 — it reacts next season, through its governor.

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
export function stepWorldSeason(
  world: World,
  towns: Town[],
  m: Markets,
  wars: Wars,
  routes: Routes,
): WorldSeason {
  const day = world.day;
  // 1 · PRODUCE
  for (let i = 0; i < towns.length; i++) produceSeason(towns[i], day);
  // 2 · CLEAR
  clearSeason(m, world.places, towns, wars, routes);
  // 3 · SETTLE
  for (let i = 0; i < towns.length; i++) settleSeason(towns[i]);
  // 4 · GOVERN
  const seasons: (TownSeason | null)[] = [];
  for (let i = 0; i < towns.length; i++) {
    const grew = stepFootprint(towns[i]);
    seasons.push({ day, built: governorTurn(towns[i], day), grew });
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

  // 3 · OBJECTS MOVE · 4 · INTERCEPTION RESOLVES
  //
  // Nothing sends a dispatch yet — nations acting is KAN-101 — so nothing is
  // ever due and this reads one bucket's length and touches nothing ([P-15]).
  // Crediting an arrival belongs with the crown that sent it and is deliberately
  // not invented here; what this ticket owes is that the PHASE runs on the right
  // day, in the right order, every day.
  stepDispatches(world);
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
      const s = stepWorldSeason(world, towns, m, wars, routes);
      if (onSeason) onSeason(s);
    }
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

