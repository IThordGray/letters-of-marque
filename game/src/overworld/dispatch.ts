// The dispatch — how a crown's intent, and a town's cargo, reach a place.
//
// A crown decides at its seat; a place is a thousand miles away; and between the
// two there is water. This module is that water — and since KAN-140 it is also
// the water between two TOWNS: a fifth payload on the same hull, sent by a
// place rather than a crown (`sendCargo`), and nothing else different at all.
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
// [HC-13] The flow is the truth; SHIPS ARE HOW THE TRUTH IS DRAWN. A cargo hull
//         carries exactly what the clearing already decided moved, between
//         exactly the two ports it decided — a view of a flow, never a second
//         source of truth. Nothing here may invent a sack.
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

// ---- The payloads ([HC-90] definitions as data, [HC-91] type from it) -------
//
// Integers rather than strings ([P-38], and the same shape as `CHANNEL` in
// chance.ts): the simulation stores the code, and the prose below belongs to
// whatever reads a chronicle.

export const PAYLOAD = {
  treasury: 0,
  reinforcements: 1,
  charter: 2,
  invasion: 3,
  // A town's own cargo, bound for another town. THE FIRST PAYLOAD NO CROWN
  // SENDS — see `sendCargo` for why that is not the breach of [HC-13] it looks
  // like.
  cargo: 4,
} as const;

export type PayloadId = (typeof PAYLOAD)[keyof typeof PAYLOAD];

// The four a CROWN sends. `sendDispatch` takes this and not `PayloadId`, so a
// crown cannot be handed a town's cargo by mistake: an input a system cannot
// receive beats a guard it must remember ([P-17b]).
export type WarPayloadId = Exclude<PayloadId, typeof PAYLOAD.cargo>;

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
  {
    name: "cargo", carries: "goods from one town to another", fromPatron: false,
    // No crown auction ever sees it, so there is nothing here to weigh.
    weighed: false,
    lost: "the goods never reach the quay, and the town that sent them is out of them",
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

// Which bucket a day falls in. ONE DEFINITION, because filing and collecting have
// to agree or a dispatch is posted into a slot nobody ever opens ([P-47]).
//
// THE `% n + n` DANCE IS NOT DECORATION: JavaScript's remainder keeps the sign of
// its left operand, so `-1 % 64` is `-1` and `ring[-1]` is `undefined`. Nothing
// had ever handed this function a negative day until KAN-99's warm start ran the
// world forward from eighty-odd years before the epoch — at which point the very
// first day of the pre-run read a bucket that does not exist and threw. It is the
// same correction `calendar.ts` carries for the same reason, and the same class
// of bug: arithmetic that is only right on one side of zero.
const bucketOf = (day: number): number => ((day % RING_DAYS) + RING_DAYS) % RING_DAYS;

// ---- The object ------------------------------------------------------------
//
// Every field readonly, and that is a design statement rather than a nicety:
// [P-16] says this thing has no present, so nothing about it may change between
// the day it sails and the day it lands. The compiler holds that line.

export interface Dispatch {
  readonly id: number;
  readonly payload: PayloadId;
  // WHO SENT IT, IN TWO FIELDS THAT EACH MEAN ONE THING. A crown's dispatch has
  // `from` and no `fromPlace`; a town's cargo has `fromPlace` and no `from`.
  // Exactly one of them is ever >= 0, so a reader tells the two apart by looking
  // rather than by knowing — which one widening `from` to "a nation or a place,
  // depending" would have cost.
  readonly from: number; // nation id — the crown that sent it, or -1
  readonly fromPlace: number; // place id — the town that sent it, or -1
  readonly to: number; // place id — where it is bound
  // What the payload carries: coin, or garrison strength, or the strength of a
  // landing. A charter carries nothing — the promotion IS the payload.
  readonly amount: number;
  // THE HOLD — how much of each good is aboard, indexed by `GOOD_ORDER`
  // (town/trade.ts). Empty for the four war-currencies, which carry no goods at
  // all.
  //
  // A MIXED HOLD AND NOT ONE SHIP PER GOOD, and the reason is arithmetic rather
  // than flavour. The clearing settles one season's trade between a handful of
  // ports; per good that is thousands of hulls a season and a million across a
  // warm start, and per SELLER-AND-BUYER PAIR it is a few hundred. One hull
  // carries everything that pair moved, which is also what a merchantman
  // actually did.
  readonly hold: readonly number[];

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
  // either sender will accept.
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

// A war-currency's hold. One frozen empty row shared by every crown's dispatch,
// so `hold` is present on every object of the kind ([P-26]) and costs nothing to
// be there ([P-23]: allocate freely, retain little).
const NO_HOLD: readonly number[] = Object.freeze([] as number[]);

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
  payload: WarPayloadId,
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

  return file(world, {
    id: world.dispatches.sent,
    payload,
    from,
    fromPlace: -1,
    to,
    amount,
    hold: NO_HOLD,
    sentDay: world.day,
    dueDay: world.day + days,
    fromX: seat.x,
    fromY: seat.y,
    toX: place.x,
    toY: place.y,
  });
}

// A TOWN SENDS, to another town, carrying goods. The same hull, the same ring
// and the same arrival — [HC-44]'s "one object, several payloads, never several
// systems" is why this is a fifth payload and not a second kind of moving thing.
//
// WHY THIS IS NOT THE BREACH OF [HC-13] IT LOOKS LIKE, and the answer is now the
// second half of the rule rather than the first. "The flow is the truth; SHIPS
// ARE HOW THE TRUTH IS DRAWN" — the clearing in market.ts decides every sack
// that moves, and this hull carries exactly what it decided, to exactly the port
// it decided. It is a view of a flow, not a second source of truth: nothing here
// invents cargo, and no ship is ever sent that the clearing did not match.
//
// WHAT CHANGED, STATED PLAINLY, because §8.4's own note warned it would: an
// arriving cargo is now CREDITED (market.ts's daily tick), where before it
// landed and changed nothing. That is the day the note names — a buyer's
// imports become real on the quay rather than at the moment the deal was
// struck, which is [HC-45] and [HC-46] applied to trade instead of to a crown.
//
// THE SEA IS NOT A TRADE RELATIONSHIP, which is the whole of what this asks and
// does not ask (2026-09-28). It used to require an open TRADE LANE between the
// two ports — the market's own table — and that was a rule about trade sitting
// in the wrong place: any two ports are connected because a ship can sail
// between them, a lane is not owned, and taking a ship does not stop the water
// working. An invasion force or a crown's coin follows the sea to a port it has
// never traded with, and `sendDispatch` beside this one always did. So the only
// question left is the one the water actually asks: does the passage fit the
// schedule.
//
// WHAT THIS IS NOT. A blockade is untouched and still bites — it shuts a port's
// TRADE lanes, which is what `access` reads and what starves a place ([HC-85]).
// What it no longer does is forbid a hull from crossing open water, because
// stopping a hull is interception's job and interception is a phase in the daily
// tick, not a line in a constructor.
//
// THE CALLER HANDS OVER THE HOLD AND DOES NOT KEEP IT. The row is taken by
// reference rather than copied, because the clearing builds one per pair and has
// no further use for it; `Dispatch` types it `readonly` so nothing downstream
// can write through the alias ([P-16]: the object has no present, so nothing
// about it may change between the day it sails and the day it lands).
//
// It refuses rather than throwing, like its crown-side twin ([HC-1]).
export function sendCargo(
  world: World,
  from: number,
  to: number,
  hold: readonly number[],
): Dispatch | null {
  const quay = world.places[from];
  const place = world.places[to];
  if (!quay || !place) return null;

  // WHAT IS ABOARD, ALL TOLD — summed once, here, so `amount` and `hold` cannot
  // disagree about the same ship ([P-47]). It is the number a reader wants
  // before it wants the manifest, and the same field the four war-currencies
  // carry their payload in.
  let amount = 0;
  for (let g = 0; g < hold.length; g++) amount += hold[g];

  const days = passageDays(distanceNm(quay.x, quay.y, place.x, place.y));
  // Longer than the schedule can hold, and now the ONLY refusal: a wrong arrival
  // day is worse than no ship, and the ring would silently alias one round onto
  // a day that has already passed. The 64-day horizon is five times this sea's
  // corner-to-corner passage, so nothing in this world meets it.
  if (days >= RING_DAYS) return null;

  return file(world, {
    id: world.dispatches.sent,
    payload: PAYLOAD.cargo,
    from: -1,
    fromPlace: from,
    to,
    amount,
    hold,
    sentDay: world.day,
    dueDay: world.day + days,
    fromX: quay.x,
    fromY: quay.y,
    toX: place.x,
    toY: place.y,
  });
}

// File it into the day it is due ([P-15]) and hand it back. Both senders build
// the literal themselves, in one field order ([P-26]); this is only the part
// that must not be written twice, because filing and the id counter have to
// agree with `arriveDispatches` or a ship is posted into a slot nobody opens.
function file(world: World, dispatch: Dispatch): Dispatch {
  world.dispatches.sent++;
  world.dispatches.ring[bucketOf(dispatch.dueDay)].push(dispatch);
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
  const slot = bucketOf(world.day);
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
