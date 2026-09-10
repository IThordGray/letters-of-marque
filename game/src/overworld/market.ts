// The clearing — where fifty towns' surpluses and shortfalls meet.
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
import { derive, produceSeason, settleSeason, year } from "../town/sim";
import { governorTurn, type Season as TownSeason } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { DAYS_PER_YEAR, startsSeason, stepDay, yearOf, type World } from "./clock";
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
export function clearSeason(m: Markets, places: Place[], towns: Town[], wars: Wars): void {
  const n = towns.length;
  const nf = wars.count;

  // Phase 1's output, read once per place. Nothing below reads a Town again.
  const stalls: Stall[] = [];
  for (let i = 0; i < n; i++) {
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
  year: number;
  seasons: (TownSeason | null)[];
}

export function stepWorldSeason(world: World, towns: Town[], m: Markets, wars: Wars): WorldSeason {
  // 1 · PRODUCE
  for (let i = 0; i < towns.length; i++) produceSeason(towns[i]);
  // 2 · CLEAR
  clearSeason(m, world.places, towns, wars);
  // 3 · SETTLE
  for (let i = 0; i < towns.length; i++) settleSeason(towns[i]);
  // 4 · GOVERN
  const seasons: (TownSeason | null)[] = [];
  for (let i = 0; i < towns.length; i++) {
    const t = towns[i];
    const grew = stepFootprint(t);
    seasons.push({ year: year(t), built: governorTurn(t, year(t)), grew });
  }
  // 5 · RULE — nations acting is KAN-101 and is deliberately not here.
  return { year: yearOf(world), seasons };
}

// Run the world forward, day by day, clearing on every seasonal boundary. The
// day is the atom ([HC-2], [HC-4]); the season is what the economy beats on.
export function runYears(
  world: World,
  towns: Town[],
  m: Markets,
  wars: Wars,
  years: number,
  onSeason?: (s: WorldSeason) => void,
): void {
  const days = years * DAYS_PER_YEAR;
  for (let d = 0; d < days; d++) {
    if (startsSeason(world)) {
      const s = stepWorldSeason(world, towns, m, wars);
      if (onSeason) onSeason(s);
    }
    stepDay(world);
  }
}

