// The dispatch — how a crown's intent reaches a place.
//
// A crown decides at its seat; a place is a thousand miles away; and between the
// two there is water. This module is that water.
//
// [HC-44] The four war-currencies are ONE object type with four payloads, never
//         four systems. Treasury, reinforcements, charter and invasion force all
//         sail in the same hull, so interception is written ONCE, against one
//         object — which is the whole reason all four verbs are affordable.
// [HC-45] A dispatch is credited on ARRIVAL, never on decision. The crown's
//         intent is not the place's income.
// [HC-46] A governor plans on what has ARRIVED, never on what is promised. He
//         does not count unhatched chickens — so this module deliberately offers
//         no way to ask what is coming.
// [HC-13] A dispatch is NOT a good. Ordinary cargo stays a flow between AI
//         towns; the four war-currencies are the sole carve-out and are real
//         objects in all three rings, because taking them is the whole of how a
//         player tips a war. There are only ever a dozen or so at a time.
// [HC-64] A charter is dispatched automatically on crossing the threshold and
//         never enters the auction. It is bookkeeping, not a decision.
// [HC-51] A neutral takes no strategic action and dispatches nothing, and
// [HC-52] a neutral place has no patron — so no grant, garrison or charter is
//         ever bound for one.
//
// REACH IS REAL, AND THERE IS EXACTLY ONE MECHANISM FOR IT. A dispatch leaves
// the crown's seat and crosses real water at the register's made-good, so a
// distant holding waits longer for everything and neglect of far colonies is
// EMERGENT rather than scripted. There is deliberately no distance penalty, no
// corruption term and no neglect modifier: travel time *is* the mechanism, and a
// second one would double-count the same idea and stop it being emergent.
//
// ---- Why nothing here has a position ---------------------------------------
//
// [P-16] An entity with a known trajectory has no PRESENT. A dispatch travelling
//        eleven days does not need eleven position updates: it stores the day it
//        sailed, the day it is due, and the two ends of its course. Where it is
//        today is a QUESTION (`positionOf`), not a fact to be maintained — so a
//        thousand dispatches in flight cost exactly what none do, until someone
//        looks at one.
// [P-15] Anything that becomes true on a known future tick is filed into that
//        tick's bucket, never polled. A dispatch is filed on the day it will
//        arrive and is not looked at again until that day comes: the daily tick
//        reads one bucket's length and, on the overwhelming majority of days,
//        touches no dispatch at all.
// [P-1]  Both of the above are the same two words. Do less.

import type { World } from "./clock";
import { daysToSail, distanceNm } from "./shape";

// ---- The four payloads ([HC-90] definitions as data, [HC-91] type from it) ---
//
// Integers rather than strings ([P-38], and the same shape as `CHANNEL` in
// chance.ts): the simulation stores the code, and the prose below belongs to
// whatever reads a chronicle.

export const PAYLOAD = {
  treasury: 0,
  reinforcements: 1,
  charter: 2,
  invasion: 3,
} as const;

export type PayloadId = (typeof PAYLOAD)[keyof typeof PAYLOAD];

interface PayloadSpec {
  readonly name: string;
  readonly carries: string;
  // §8.4's third column, and the reason interception means anything at all.
  readonly lost: string;
  // Does this come from a PATRON? [HC-52]: a neutral place has no patron, so no
  // grant, garrison or charter is ever bound for one. An invasion is not a gift,
  // and whether one may be aimed at a neutral is not settled by the spec — it is
  // left to whoever owns the decision, not decided quietly here.
  readonly fromPatron: boolean;
  // [HC-64]: a charter is the one payload no auction may weigh. Crossing the
  // threshold OBLIGES the crown; it never tempts it.
  readonly weighed: boolean;
}

// Indexed by the payload code, so a lookup is an array read and never a hash.
export const PAYLOADS: readonly PayloadSpec[] = [
  {
    name: "treasury", carries: "coin to a place", fromPatron: true, weighed: true,
    lost: "the grant is not credited; the place lives on its own trade",
  },
  {
    name: "reinforcements", carries: "garrison strength", fromPatron: true, weighed: true,
    lost: "the place stays as weak as it was",
  },
  {
    name: "charter", carries: "a promotion", fromPatron: true, weighed: false,
    lost: "the place stays a settlement",
  },
  {
    name: "invasion force", carries: "an attack on a place", fromPatron: false, weighed: true,
    lost: "the town does not change hands",
  },
];

// ---- Passage ---------------------------------------------------------------

// How long the water takes. Distance at the register's made-good, rounded up —
// a part of a day at sea is still a day, and the floor of one day is the rule
// that keeps [HC-45] meaningful: a dispatch NEVER arrives on the day it sails,
// so there is always a day on which it could have been taken.
export const passageDays = (nm: number): number => Math.max(1, Math.ceil(daysToSail(nm)));

// The schedule's horizon. The longest passage this sea can hold is corner to
// corner of the world box — about twelve days — so sixty-four is roughly five
// times the headroom anything real needs, and a much larger sea would still fit.
// A power of two keeps the modulo cheap and the ring is 64 empty arrays, built
// once per world.
export const RING_DAYS = 64;

// ---- The object ------------------------------------------------------------
//
// Every field readonly, and that is a design statement rather than a nicety:
// [P-16] says this thing has no present, so nothing about it may change between
// the day it sails and the day it lands. The compiler holds that line.

export interface Dispatch {
  readonly id: number;
  readonly payload: PayloadId;
  readonly from: number; // nation id — the crown that sent it
  readonly to: number; // place id — where it is bound
  // What the payload carries: coin, or garrison strength, or the strength of a
  // landing. A charter carries nothing — the promotion IS the payload.
  readonly amount: number;

  // The whole of its movement, as two integers ([P-16]).
  readonly sentDay: number;
  readonly dueDay: number;

  // The course, fixed the day it sailed. A crown can LOSE its seat while a
  // dispatch is at sea ([HC-49] transfers a place), so a passage that looked its
  // origin up in the world would silently re-plot itself mid-voyage. Carrying
  // its own ends makes `positionOf` a pure function of (dispatch, day).
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
}

// ---- What in flight looks like in world state -------------------------------

export interface Dispatches {
  // [P-15] A ring of buckets indexed by DUE day. Filing is O(1), and a day on
  // which nothing arrives costs one array-length read and touches no dispatch.
  // No aliasing is possible: everything in flight is due within the next
  // RING_DAYS days, because a passage shorter than the ring is the only kind
  // `sendDispatch` will accept.
  readonly ring: Dispatch[][];
  // How many have ever sailed, which is also the next id — dense, monotonic
  // integer handles ([P-37]).
  sent: number;
}

// [P-30]: built with `Array.from`, so no bucket is ever holey.
export const makeDispatches = (): Dispatches => ({
  ring: Array.from({ length: RING_DAYS }, (): Dispatch[] => []),
  sent: 0,
});

// Returned on the overwhelming majority of days, so the daily tick allocates
// nothing at all when nothing arrives ([P-24]). Frozen so a caller cannot make
// it a shared mutable.
const NOTHING: readonly Dispatch[] = Object.freeze([] as Dispatch[]);

// ---- Sending ---------------------------------------------------------------

// A crown sends. WHY it sends is not this module's business — the auction owns
// that — but WHO may send and who may receive is a property of the object, and
// enforcing it here means no future caller has to remember.
//
// Returns the dispatch, or `null` where the spec forbids it. Silence rather than
// a throw: an engine never prompts and never crashes the world ([HC-1]).
export function sendDispatch(
  world: World,
  from: number,
  to: number,
  payload: PayloadId,
  amount: number = 0,
): Dispatch | null {
  const crown = world.nations[from];
  const place = world.places[to];
  if (!crown || !place) return null;

  // [HC-51] A neutral takes no strategic action and dispatches nothing — and has
  // no seat to sail from in any case.
  if (!crown.crown || crown.seat < 0) return null;
  const seat = world.places[crown.seat];
  if (!seat) return null;

  // [HC-52] / [HC-65] A neutral place has no patron: no grant, no garrison, and
  // it can never be chartered.
  const holder = world.nations[place.faction];
  if (PAYLOADS[payload].fromPatron && (!holder || !holder.crown)) return null;

  const days = passageDays(distanceNm(seat.x, seat.y, place.x, place.y));
  // Unreachable in this world — the ring has five times the headroom the box's
  // diagonal needs — and refused rather than aliased if a larger sea ever
  // arrives, because a wrong arrival day is worse than no dispatch.
  if (days >= RING_DAYS) return null;

  const dispatch: Dispatch = {
    id: world.dispatches.sent,
    payload,
    from,
    to,
    amount,
    sentDay: world.day,
    dueDay: world.day + days,
    fromX: seat.x,
    fromY: seat.y,
    toX: place.x,
    toY: place.y,
  };
  world.dispatches.sent++;
  world.dispatches.ring[dispatch.dueDay % RING_DAYS].push(dispatch);
  return dispatch;
}

// ---- The daily beat --------------------------------------------------------

// §2.2 step 4. DELIBERATELY EMPTY in this milestone: there is no player, so
// nothing can take a dispatch. The phase exists so that adding it later does not
// reorder anything — interception resolves BEFORE what is due is credited, on
// the same day, which is what makes [HC-45] worth having.
//
// When it lands it is written once, against this one object type, and all four
// verbs get it at the same moment ([HC-44]).
export function interceptDispatches(_world: World): void {
  // Nothing yet, and nothing by accident.
}

// What has arrived today, and the ONLY way a dispatch leaves the world. A
// payload becomes real here and nowhere earlier ([HC-45]).
//
// The bucket is handed over whole and replaced, so the caller gets the live array
// rather than a copy and a quiet day allocates nothing.
export function arriveDispatches(world: World): readonly Dispatch[] {
  const slot = world.day % RING_DAYS;
  const bucket = world.dispatches.ring[slot];
  if (bucket.length === 0) return NOTHING;
  world.dispatches.ring[slot] = [];
  return bucket;
}

// One day of §2.2 for every dispatch in the world:
//
//   3. Objects move — and a dispatch does NOT, because it has no present. Its
//      course was settled the day it sailed ([P-16]).
//   4. Interception resolves — empty here.
//
// Whatever survived step 4 and is due has arrived; the caller credits it.
export function stepDispatches(world: World): readonly Dispatch[] {
  interceptDispatches(world);
  return arriveDispatches(world);
}

// ---- Reading one back ------------------------------------------------------

// How far along it is, 0 at the seat and 1 at the destination. Pure in
// (dispatch, day): asking costs a subtraction and asking twice costs two.
export function progressOf(dispatch: Dispatch, day: number): number {
  const span = dispatch.dueDay - dispatch.sentDay; // at least 1, by `passageDays`
  const gone = day - dispatch.sentDay;
  if (gone <= 0) return 0;
  if (gone >= span) return 1;
  return gone / span;
}

// Where it is on the day you ask — derived, never stored and never stepped.
// The course is the straight line between its two ends, which is the same
// straight line `legBetween` prices a trade leg by; the sea has no roads.
export function positionOf(dispatch: Dispatch, day: number): { x: number; y: number } {
  const t = progressOf(dispatch, day);
  return {
    x: dispatch.fromX + (dispatch.toX - dispatch.fromX) * t,
    y: dispatch.fromY + (dispatch.toY - dispatch.fromY) * t,
  };
}

// ---- Reading the whole lot back --------------------------------------------
//
// NOTE WHAT IS NOT HERE. There is no `inboundTo(place)`, and there never should
// be: [HC-46] says a governor plans on what has arrived and never on what is
// promised, and the surest way to keep that true is to give him no way to ask.

// How many are at sea. Walks the ring's lengths, so it touches no dispatch.
export function inFlightCount(world: World): number {
  let n = 0;
  for (let i = 0; i < RING_DAYS; i++) n += world.dispatches.ring[i].length;
  return n;
}

// Everything at sea, in id order — a total order with no tie to break ([P-10]),
// so the answer never depends on where in the ring a dispatch happened to land.
// For a view or a test; the daily tick has no use for it.
export function inFlight(world: World): Dispatch[] {
  const out: Dispatch[] = [];
  for (let i = 0; i < RING_DAYS; i++) {
    const bucket = world.dispatches.ring[i];
    for (let j = 0; j < bucket.length; j++) out.push(bucket[j]);
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}
