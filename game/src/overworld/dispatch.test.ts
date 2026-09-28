// The dispatch — one object, four payloads, and a passage that is the whole of
// a crown's reach.

import { describe, it, expect } from "vitest";
import * as DISPATCH from "./dispatch";
import {
  PAYLOAD, PAYLOADS, RING_DAYS, arriveDispatches, inFlight, inFlightCount,
  interceptDispatches, passageDays, positionOf, progressOf, sendCargo, sendDispatch,
  stepDispatches, type Dispatch, type WarPayloadId,
} from "./dispatch";
import { makeWorld, stepDay, type World } from "./clock";
import { makeNations } from "./factions";
import { laneIsOpen, makeMarkets, openRoutes, type Routes } from "./market";
import type { Place } from "./places";
import { DAY_RUN_NM, WORLD_BOX, distanceNm } from "./shape";
import { generateWorld } from "./worldgen";

// ---- Fixtures --------------------------------------------------------------
//
// THE FIXTURE RULE: built against the struct, never through `sitePlaces` or
// `generateWorld`. A world hand-laid on a straight line lets a passage be
// stated in days rather than inferred, and it cannot expire when the generator
// moves. The one test below that does want a real world says so.

// The one real world this file uses, for the two claims that are about the sea
// rather than about the object. Generated once ([P-1]).
const REAL = generateWorld(1660);

const CROWN = 0; // Spain — a crown, and given a seat
const OTHER_CROWN = 1; // England
const NEUTRAL = 5; // the Brethren of the Coast — no crown, no seat, no patron

const ALL_PAYLOADS: WarPayloadId[] = [
  PAYLOAD.treasury, PAYLOAD.reinforcements, PAYLOAD.charter, PAYLOAD.invasion,
];

// The four above plus the one a town sends. Kept apart from them because every
// claim below about a CROWN is a claim about the four, and a town's cargo is
// not one of them.
const EVERY_PAYLOAD = [...ALL_PAYLOADS, PAYLOAD.cargo];

const VICTUALS = 0; // a trade class code (`CLASSES`), and the cargo below

const placeAt = (id: number, x: number, y: number, faction: number): Place => ({
  id, name: `Place ${id}`, governor: "Someone",
  x, y, sx: 0, sy: 1, zone: 0, shelter: 0.5,
  size: "settlement", purpose: "trade", faction,
  seed: 1, foundedDay: -14400, population: 60, wealth: 120, timberGranted: false,
});

// The seat sits well away from the origin deliberately: a fixture anchored at
// (0, 0) cannot tell a course that was plotted from the crown's seat from one
// that was plotted from nowhere. (Found by mutation, not by inspection.)
const SEAT = { x: 300, y: 200 };

// A sea with the crown's seat at SEAT and one place per leg due east of it, each
// leg given in DAYS so a passage reads as what it is. Place ids are 1-based;
// place 0 is the seat. Due east keeps a leg an exact multiple of a day's run,
// so a passage is the number written rather than a rounding of it.
function seaOf(legDays: number[], holder: number = CROWN): World {
  const world = makeWorld(1660);
  world.nations = makeNations();
  world.places = [placeAt(0, SEAT.x, SEAT.y, CROWN)];
  for (let i = 0; i < legDays.length; i++) {
    world.places.push(placeAt(i + 1, SEAT.x + legDays[i] * DAY_RUN_NM, SEAT.y, holder));
  }
  world.nations[CROWN].seat = 0;
  world.nations[OTHER_CROWN].seat = 0;
  // A neutral has no seat of its own ([HC-39]); it is given one here so that the
  // test which says it may not dispatch is refused for being a NEUTRAL and not
  // merely for being seatless.
  world.nations[NEUTRAL].seat = 0;
  return world;
}

// Step the world forward, collecting what landed on which day. The only caller
// of the daily beat in this file, so every test agrees on what a day is.
function sail(world: World, days: number): { day: number; landed: readonly Dispatch[] }[] {
  const log: { day: number; landed: readonly Dispatch[] }[] = [];
  for (let i = 0; i < days; i++) {
    stepDay(world);
    const landed = stepDispatches(world);
    if (landed.length > 0) log.push({ day: world.day, landed });
  }
  return log;
}

// ---- One object, four payloads ---------------------------------------------

describe("one object carries all four war-currencies", () => {
  it("puts treasury, reinforcements, a charter and an invasion in the same hull", () => {
    // [HC-44]: never four systems. The point is not that four things exist but
    // that they are the SAME thing, so interception is written once against one
    // object and all four verbs get it at the same moment.
    const world = seaOf([2, 2, 2, 2]);
    const sent = ALL_PAYLOADS.map((p, i) => sendDispatch(world, CROWN, i + 1, p, 100));
    for (const d of sent) expect(d).not.toBeNull();
    const shapes = sent.map((d) => Object.keys(d!).sort().join(","));
    expect(new Set(shapes).size).toBe(1);
  });

  it("names what is lost when each of them fails to arrive", () => {
    // §8.4's third column. A payload with no stated consequence is a payload
    // interception cannot mean anything for.
    expect(PAYLOADS.length).toBe(EVERY_PAYLOAD.length);
    for (const spec of PAYLOADS) expect(spec.lost.length).toBeGreaterThan(0);
  });

  it("keeps the codes the simulation stores and the table it reads in step", () => {
    const codes = Object.values(PAYLOAD);
    expect(codes).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(PAYLOADS.map((p) => p.name)).size).toBe(PAYLOADS.length);
    expect(PAYLOADS[PAYLOAD.charter].name).toBe("charter");
  });

  it("makes the charter the one payload no auction may weigh", () => {
    // [HC-64]: crossing the threshold OBLIGES the crown rather than tempting it,
    // so a charter is dispatched automatically and never enters the auction.
    expect(ALL_PAYLOADS.filter((p) => !PAYLOADS[p].weighed).map((p) => PAYLOADS[p].name))
      .toEqual(["charter"]);
  });
});

// ---- Reach ------------------------------------------------------------------

describe("reach is real, and the water is the whole of it", () => {
  it("sails from the crown's seat, and carries both ends of the course with it", () => {
    // §8.4: "a dispatch travels from the crown's SEAT at sailing speed, so a
    // distant holding waits longer for everything." The seat is where reach is
    // measured from, and the dispatch keeps its own copy of both ends so the
    // answer cannot change under it mid-voyage.
    const world = seaOf([5]);
    const seat = world.places[0];
    const bound = world.places[1];
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 100)!;
    expect({ x: d.fromX, y: d.fromY }).toEqual({ x: seat.x, y: seat.y });
    expect({ x: d.toX, y: d.toY }).toEqual({ x: bound.x, y: bound.y });
    expect(d.from).toBe(CROWN);
    expect(d.to).toBe(bound.id);
  });

  it("makes a distant holding wait longer for everything than a near one", () => {
    const world = seaOf([1, 4, 10]);
    const near = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 100)!;
    const middle = sendDispatch(world, CROWN, 2, PAYLOAD.treasury, 100)!;
    const far = sendDispatch(world, CROWN, 3, PAYLOAD.treasury, 100)!;
    expect(middle.dueDay).toBeGreaterThan(near.dueDay);
    expect(far.dueDay).toBeGreaterThan(middle.dueDay);
  });

  it("takes exactly as long as the water it crosses, and not one day more", () => {
    // The guard against a "helpful" second mechanism. Neglect of far colonies is
    // EMERGENT — it falls out of arrival-on-landing plus distance — so a distance
    // penalty, a corruption term or a neglect modifier would double-count the one
    // idea that is doing the work. Enumerated over a real world rather than
    // argued: every crown, every holding it could send to, every payload.
    //
    // The expected passage is written out here rather than taken from
    // `passageDays`, deliberately: a test that asks the code under test what the
    // answer should be cannot catch a term added to it. (Found by mutation.)
    const water = (a: Place, b: Place): number =>
      Math.max(1, Math.ceil(distanceNm(a.x, a.y, b.x, b.y) / DAY_RUN_NM));

    let checked = 0;
    for (const nation of REAL.nations) {
      if (!nation.crown) continue;
      const seat = REAL.places[nation.seat];
      for (const place of REAL.places) {
        if (!REAL.nations[place.faction].crown) continue;
        for (const payload of ALL_PAYLOADS) {
          const d = sendDispatch(REAL, nation.id, place.id, payload, 1)!;
          expect(d.dueDay - d.sentDay).toBe(water(seat, place));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("charges the same passage whatever the hull is carrying", () => {
    // One object, one rule. A charter does not sail faster than coin.
    const world = seaOf([7]);
    const due = ALL_PAYLOADS.map((p) => sendDispatch(world, CROWN, 1, p, 50)!.dueDay);
    expect(new Set(due).size).toBe(1);
  });

  it("never arrives on the day it sails, however short the crossing", () => {
    // A grant to the crown's own seat still takes a day. Without the floor there
    // would be no day on which a dispatch could be taken, and crediting on
    // arrival would be indistinguishable from crediting on the decision.
    const world = seaOf([0]);
    const home = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 100)!;
    expect(home.dueDay).toBe(home.sentDay + 1);
    expect(passageDays(0)).toBe(1);
  });

  it("keeps every passage this sea can hold well inside the schedule's horizon", () => {
    // The ring's headroom, measured rather than assumed: the longest crossing
    // possible is corner to corner of the world box.
    const corner = distanceNm(0, 0, WORLD_BOX.widthNm, WORLD_BOX.heightNm);
    expect(passageDays(corner)).toBeLessThan(RING_DAYS);
    for (const nation of REAL.nations) {
      if (!nation.crown) continue;
      const seat = REAL.places[nation.seat];
      for (const place of REAL.places) {
        const legDays = passageDays(distanceNm(seat.x, seat.y, place.x, place.y));
        expect(legDays).toBeLessThan(RING_DAYS);
      }
    }
  });
});

// ---- Arrival ----------------------------------------------------------------

describe("a dispatch is credited on arrival, never on decision", () => {
  it("gives a place nothing on the day its crown decides to send", () => {
    // [HC-45]: the crown's intent is not the place's income.
    const world = seaOf([3]);
    sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 500);
    expect(stepDispatches(world)).toHaveLength(0);
    expect(inFlightCount(world)).toBe(1);
  });

  it("lands on exactly one day, and it is the day it was due", () => {
    const world = seaOf([6]);
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 500)!;
    const log = sail(world, 40);
    expect(log).toHaveLength(1);
    expect(log[0].day).toBe(d.dueDay);
    expect(log[0].landed[0].id).toBe(d.id);
  });

  it("hands over not one coin of what it carries before the day it lands", () => {
    const world = seaOf([9]);
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 500)!;
    let credited = 0;
    for (let i = 0; i < 30; i++) {
      stepDay(world);
      for (const landed of stepDispatches(world)) credited += landed.amount;
      if (world.day < d.dueDay) expect(credited).toBe(0);
    }
    expect(credited).toBe(500);
  });

  it("leaves the world only by arriving", () => {
    const world = seaOf([5]);
    sendDispatch(world, CROWN, 1, PAYLOAD.charter, 0);
    expect(inFlightCount(world)).toBe(1);
    sail(world, 4);
    expect(inFlightCount(world)).toBe(1);
    sail(world, 1);
    expect(inFlightCount(world)).toBe(0);
  });

  it("publishes no manifest of what is promised, so nobody can plan on it", () => {
    // [HC-46]: a governor plans on what has ARRIVED, never on what is promised —
    // and the surest way to keep that true is to give him no way to ask. This
    // fails the moment somebody adds the obvious convenience.
    const asking = Object.keys(DISPATCH).filter((k) => /inbound|expected|promised|pending|due/i.test(k));
    expect(asking).toEqual([]);
  });

  it("does not care whether the days are stepped in one run or in pieces", () => {
    // [HC-11] at this module's scale: arrival is a property of the day, not of
    // how the caller chose to reach it.
    const whole = seaOf([8]);
    sendDispatch(whole, CROWN, 1, PAYLOAD.reinforcements, 40);
    const pieces = seaOf([8]);
    sendDispatch(pieces, CROWN, 1, PAYLOAD.reinforcements, 40);
    const a = sail(whole, 20).map((e) => e.day);
    const b: number[] = [];
    for (let chunk = 0; chunk < 4; chunk++) for (const e of sail(pieces, 5)) b.push(e.day);
    expect(b).toEqual(a);
    expect(pieces.dispatches).toEqual(whole.dispatches);
  });
});

// ---- The interception phase --------------------------------------------------

describe("the interception phase exists, and takes nothing", () => {
  it("resolves before arrival every day, and changes nothing in this milestone", () => {
    // §2.2 step 4 is a deliberate no-op with no player in the world. It exists so
    // that adding it later does not reorder anything.
    const withPhase = seaOf([4, 7]);
    sendDispatch(withPhase, CROWN, 1, PAYLOAD.treasury, 100);
    sendDispatch(withPhase, CROWN, 2, PAYLOAD.invasion, 200);
    const without = seaOf([4, 7]);
    sendDispatch(without, CROWN, 1, PAYLOAD.treasury, 100);
    sendDispatch(without, CROWN, 2, PAYLOAD.invasion, 200);

    for (let i = 0; i < 12; i++) {
      stepDay(withPhase);
      stepDay(without);
      expect(stepDispatches(withPhase)).toEqual(arriveDispatches(without));
    }
    expect(withPhase.dispatches).toEqual(without.dispatches);
  });

  it("takes nothing when it is run on its own", () => {
    const world = seaOf([4]);
    sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 100);
    const before = inFlight(world);
    interceptDispatches(world);
    interceptDispatches(world);
    expect(inFlight(world)).toEqual(before);
  });
});

// ---- Who may send, and who may receive ---------------------------------------

describe("a crown dispatches and a neutral does not", () => {
  it("sends nothing from a faction that has no crown", () => {
    // [HC-51]: a neutral takes no strategic action and dispatches nothing.
    const world = seaOf([3]);
    for (const payload of ALL_PAYLOADS) {
      expect(sendDispatch(world, NEUTRAL, 1, payload, 100)).toBeNull();
    }
    expect(inFlightCount(world)).toBe(0);
  });

  it("sends nothing from a crown that has lost its seat", () => {
    const world = seaOf([3]);
    world.nations[CROWN].seat = -1;
    expect(sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 100)).toBeNull();
  });

  it("sends no grant, no garrison and no charter to a place with no patron", () => {
    // [HC-52]: what a neutral lacks is a patron, so there is no grant and no
    // safety net; [HC-65]: it can never be chartered either. Whether an INVASION
    // may be aimed at one is not settled by the spec and is deliberately not
    // decided here.
    const world = seaOf([3], NEUTRAL);
    for (const payload of [PAYLOAD.treasury, PAYLOAD.reinforcements, PAYLOAD.charter]) {
      expect(sendDispatch(world, CROWN, 1, payload, 100)).toBeNull();
    }
    expect(inFlightCount(world)).toBe(0);
  });

  it("sends nothing to a place that is not on the map", () => {
    const world = seaOf([3]);
    expect(sendDispatch(world, CROWN, 99, PAYLOAD.treasury, 100)).toBeNull();
    expect(sendDispatch(world, 99, 1, PAYLOAD.treasury, 100)).toBeNull();
  });
});

// ---- A town sends, to another town --------------------------------------------
//
// [HC-44] asked once more, of a fifth payload: the same hull, the same ring, the
// same arrival. NOTHING IN THE WORLD SENDS ONE — the tests below do, and that is
// the whole of this milestone.

const QUAY = 1; // the town doing the sending
const BOUND = 2; // the town it is bound for

// Two towns on one coast, and the market's own partner table beside them — so a
// claim can ask whether the two actually TRADE, which is a different question
// from whether a ship can sail between them. `makeMarkets` partners places
// within a week's run, so how far apart they are put is the whole of it.
function coastOf(apartDays: number): { world: World; routes: Routes } {
  const world = seaOf([1, 1 + apartDays]);
  // Off the shared latitude, so a course has to answer both axes.
  world.places[BOUND].y = SEAT.y - 60;
  return { world, routes: openRoutes(makeMarkets(world.places)) };
}

describe("a town sends a ship to another town", () => {
  it("carries a named cargo the real distance, and credits it on arrival, never on departure", () => {
    const { world } = coastOf(1.5);
    const quay = world.places[QUAY];
    const bound = world.places[BOUND];
    const d = sendCargo(world, QUAY, BOUND, VICTUALS, 40)!;

    // A TOWN sent it, and a reader can see that without knowing a payload code:
    // `from` is a crown and `fromPlace` is a town, and only ever one of them.
    expect(d.fromPlace).toBe(QUAY);
    expect(d.from).toBe(-1);
    expect(d.to).toBe(BOUND);
    expect(d.cargo).toBe(VICTUALS);
    expect(d.amount).toBe(40);

    // The passage the water between them implies. The formula is written out
    // rather than asked of `passageDays`, so a term added to it fails here; and
    // the fixture is pinned at two days so the claim below has a day in the
    // middle on which it could be false.
    const water = Math.max(1, Math.ceil(distanceNm(quay.x, quay.y, bound.x, bound.y) / DAY_RUN_NM));
    expect(water).toBe(2);
    expect(d.dueDay).toBe(d.sentDay + water);

    // [HC-45] through a town's hull: not one sack before the day it lands.
    let delivered = 0;
    const landedOn: number[] = [];
    for (let i = 0; i < 6; i++) {
      stepDay(world);
      for (const landed of stepDispatches(world)) {
        delivered += landed.amount;
        landedOn.push(world.day);
      }
      if (world.day < d.dueDay) expect(delivered).toBe(0);
    }
    expect(landedOn).toEqual([d.dueDay]);
    expect(delivered).toBe(40);
  });

  it("is on the map the whole voyage, moving between the two towns", () => {
    // What the chart draws is `inFlight` plus `positionOf` and the four course
    // ends (worldview/draw.ts), so a town's ship is drawn the same way a crown's
    // is exactly as far as it is the same object with the same fields.
    const { world } = coastOf(1.5);
    const quay = world.places[QUAY];
    const bound = world.places[BOUND];
    const d = sendCargo(world, QUAY, BOUND, VICTUALS, 40)!;
    const crowns = sendDispatch(world, CROWN, BOUND, PAYLOAD.treasury, 100)!;
    expect(Object.keys(d).sort()).toEqual(Object.keys(crowns).sort());

    const track = [positionOf(d, world.day)];
    for (let i = 0; i < 2; i++) {
      // At sea, and therefore on the chart, on every day of the passage.
      expect(inFlight(world).map((f) => f.id)).toContain(d.id);
      stepDay(world);
      track.push(positionOf(d, world.day));
      stepDispatches(world);
    }
    expect(inFlight(world).map((f) => f.id)).not.toContain(d.id); // landed, and gone

    // It starts at the sending town, ends at the receiving one, and is somewhere
    // between the two on every day in the middle — on both axes.
    expect(track[0]).toEqual({ x: quay.x, y: quay.y });
    expect(track[track.length - 1]).toEqual({ x: bound.x, y: bound.y });
    expect(track.length).toBe(3);
    for (let i = 1; i < track.length; i++) {
      expect(track[i].x).toBeGreaterThan(track[i - 1].x);
      expect(track[i].y).toBeLessThan(track[i - 1].y);
    }
  });

  it("sails between two ports whether or not they trade, because the sea is not a trade relationship", () => {
    // THE CORRECTION OF 2026-09-28. A ship used to be refused unless the market
    // had partnered the two ports — a rule about TRADE sitting in the wrong
    // place. Any two ports are connected because a ship can sail between them;
    // an invasion force or a crown's coin follows the sea to a port it has never
    // traded with, and `sendDispatch` beside this one always did.

    // A pair the market DID partner: they sail, as they always could.
    const near = coastOf(1.5);
    expect(laneIsOpen(near.routes, QUAY, BOUND)).toBe(true);
    expect(sendCargo(near.world, QUAY, BOUND, VICTUALS, 40)).not.toBeNull();

    // A pair the market did NOT — eight days apart, beyond the week a market
    // reaches. The lane assertion is what makes this fail the day somebody puts
    // the check back: without it the claim would pass on a pair that trades.
    const strangers = coastOf(8);
    expect(laneIsOpen(strangers.routes, QUAY, BOUND)).toBe(false);
    const d = sendCargo(strangers.world, QUAY, BOUND, VICTUALS, 40)!;
    expect(d).not.toBeNull();
    expect(inFlightCount(strangers.world)).toBe(1);

    // ...and it is a real passage rather than a token one: the water between two
    // strangers is the water the chart shows, written out rather than asked of
    // `passageDays` so a term added to that fails here.
    const quay = strangers.world.places[QUAY];
    const bound = strangers.world.places[BOUND];
    const water = Math.max(1, Math.ceil(distanceNm(quay.x, quay.y, bound.x, bound.y) / DAY_RUN_NM));
    expect(water).toBe(9);
    expect(d.dueDay).toBe(d.sentDay + water);
  });

  it("refuses only a passage longer than the schedule can hold, and returns nothing", () => {
    // THE ONE REFUSAL LEFT, and it is about the water and not about trade: the
    // ring would silently alias a voyage of more than 64 days onto a day that
    // has already gone, and a wrong arrival day is worse than no ship.
    const { world } = coastOf(8);
    world.places[BOUND].x = world.places[QUAY].x + (RING_DAYS + 1) * DAY_RUN_NM;
    const quay = world.places[QUAY];
    const bound = world.places[BOUND];
    expect(passageDays(distanceNm(quay.x, quay.y, bound.x, bound.y)))
      .toBeGreaterThanOrEqual(RING_DAYS);
    expect(sendCargo(world, QUAY, BOUND, VICTUALS, 40)).toBeNull();
    expect(inFlightCount(world)).toBe(0);

    // ...and it was the length that refused it: bring the same town inside the
    // horizon and the same ship sails.
    bound.x = quay.x + 3 * DAY_RUN_NM;
    expect(sendCargo(world, QUAY, BOUND, VICTUALS, 40)).not.toBeNull();
    expect(inFlightCount(world)).toBe(1);
  });
});

// ---- [P-16] — an entity with a known trajectory has no present ----------------

// Counts every field of a dispatch the simulation reads or writes while it is at
// sea. A dispatch is swapped for a proxy of itself after it sails, so nothing
// downstream can touch it unobserved.
interface Tally { reads: number; writes: number }

function watchAllAtSea(world: World, tally: Tally): void {
  for (let i = 0; i < RING_DAYS; i++) {
    const bucket = world.dispatches.ring[i];
    for (let j = 0; j < bucket.length; j++) {
      bucket[j] = new Proxy(bucket[j], {
        get(t, k, r) { tally.reads++; return Reflect.get(t, k, r); },
        set(t, k, v, r) { tally.writes++; return Reflect.set(t, k, v, r); },
      });
    }
  }
}

// Sail `atSea` dispatches for a passage of `legDays`, and report what the daily
// beat cost. The harvest reads only the returned array's LENGTH, so every count
// below belongs to the simulation and none to the test.
function passageCost(legDays: number, atSea: number): Tally {
  const world = seaOf(new Array(atSea).fill(legDays) as number[]);
  for (let i = 0; i < atSea; i++) sendDispatch(world, CROWN, i + 1, PAYLOAD.treasury, 100);
  const tally: Tally = { reads: 0, writes: 0 };
  watchAllAtSea(world, tally);
  let landed = 0;
  for (let i = 0; i < legDays; i++) {
    stepDay(world);
    landed += stepDispatches(world).length;
  }
  expect(landed).toBe(atSea); // the passage really did complete
  return tally;
}

describe("a dispatch at sea has no present", () => {
  it("is not looked at once between the day it sails and the day it lands", () => {
    // [P-16]. A dispatch travelling eleven days does not need eleven position
    // updates: it stores a departure and an arrival, and where it is today is a
    // question rather than a fact to maintain. An implementation that stepped a
    // position would have counted two writes and at least one read PER DAY here.
    const one = passageCost(1, 1);
    expect(one).toEqual({ reads: 0, writes: 0 });
  });

  it("costs sixty days at sea exactly what it costs one", () => {
    // The claim the rule is actually making: cost does not scale with the days
    // spent in transit. Sixty times the passage, identical cost.
    expect(passageCost(60, 1)).toEqual(passageCost(1, 1));
  });

  it("costs a fleet of them at sea exactly what it costs one", () => {
    // [P-15]. Filed into the day it will arrive, never polled — so a quiet day
    // reads one bucket's length and touches no dispatch whatever is in flight.
    expect(passageCost(40, 50)).toEqual(passageCost(40, 1));
  });

  it("answers where it is without ever having been told", () => {
    const world = seaOf([10]);
    const seat = world.places[0];
    const bound = world.places[1];
    bound.y = SEAT.y + 800; // a real diagonal, so both axes are answered
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.invasion, 300)!;
    expect(progressOf(d, d.sentDay)).toBe(0);
    expect(progressOf(d, d.dueDay)).toBe(1);
    expect(positionOf(d, d.sentDay)).toEqual({ x: seat.x, y: seat.y });
    expect(positionOf(d, d.dueDay)).toEqual({ x: bound.x, y: bound.y });
    expect(positionOf(d, (d.sentDay + d.dueDay) / 2))
      .toEqual({ x: (seat.x + bound.x) / 2, y: (seat.y + bound.y) / 2 });

    // ...and it works its way there, never backwards.
    let last = -1;
    for (let day = d.sentDay; day <= d.dueDay; day++) {
      const here = progressOf(d, day);
      expect(here).toBeGreaterThan(last);
      last = here;
    }
  });

  it("gives the same answer however often it is asked, and changes nothing by being asked", () => {
    const world = seaOf([10]);
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.treasury, 300)!;
    sail(world, 4);
    const before = structuredClone(world.dispatches);
    const first = positionOf(d, world.day);
    for (let i = 0; i < 20; i++) positionOf(d, world.day);
    expect(positionOf(d, world.day)).toEqual(first);
    expect(world.dispatches).toEqual(before);
  });

  it("runs the course it sailed even after its crown loses the seat it sailed from", () => {
    // A place changes hands ([HC-49]) and a seat can move with it. A passage
    // already begun is not re-plotted: the dispatch carries its own ends, which
    // is what makes its position a pure function of itself and the day.
    const world = seaOf([6, 6]);
    world.places[2].x = -900; // a new capital, somewhere else entirely
    const sailedFrom = { x: world.places[0].x, y: world.places[0].y };
    const d = sendDispatch(world, CROWN, 1, PAYLOAD.reinforcements, 60)!;
    sail(world, 3);
    const midway = positionOf(d, world.day);

    world.nations[CROWN].seat = 2; // the old seat is lost and the crown moves
    world.places[0].faction = OTHER_CROWN;

    expect(positionOf(d, world.day)).toEqual(midway);
    expect(positionOf(d, d.sentDay)).toEqual(sailedFrom);
    expect(sail(world, 3)[0].landed[0].id).toBe(d.id);
  });
});

// ---- Determinism -------------------------------------------------------------

describe("the same seed gives the same passages", () => {
  it("sails, arrives and empties identically on a second run", () => {
    const run = (): { at: number[]; left: Dispatch[] } => {
      const world = seaOf([2, 5, 9, 12]);
      const at: number[] = [];
      for (let i = 0; i < 10; i++) {
        stepDay(world);
        for (const payload of ALL_PAYLOADS) {
          if (world.day % 3 === 0) sendDispatch(world, CROWN, (payload % 4) + 1, payload, 10);
        }
        for (const landed of stepDispatches(world)) at.push(landed.id);
      }
      return { at, left: inFlight(world) };
    };
    expect(run()).toEqual(run());
  });

  it("lists what is at sea in one order, whatever order the ring holds it in", () => {
    const world = seaOf([11, 2, 7, 4]);
    for (let i = 0; i < 4; i++) sendDispatch(world, CROWN, i + 1, PAYLOAD.treasury, 10);
    expect(inFlight(world).map((d) => d.id)).toEqual([0, 1, 2, 3]);
    expect(inFlightCount(world)).toBe(4);
  });
});
