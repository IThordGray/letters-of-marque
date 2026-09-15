// The ledger — what it stores, what it refuses to store, and how it moves.
//
// Every claim here is warranted by [HC-70]: the world layer explicitly does NOT
// reopen the three stored numbers, the deliberate lag on prosperity, or the rule
// that nothing derived is kept. See spec/world-simulation.md §10.1.

import { describe, it, expect } from "vitest";
import { derive, stepSeason, stepSeasons, stepYears, makeTown, carryingCapacity, failureWord, takeWeather } from "./sim";
import { stepTownYears } from "./governor";
import { raise, CATALOGUE } from "./works";
import { mixedTown, bareTown } from "./fixtures";
import { WORKS } from "./constants";
import type { Town } from "./types";
import { CALENDAR, DAYS_PER_YEAR, yearOfDay } from "../overworld/calendar";

// The town keeps no clock (KAN-107), so a test that steps one plays the world and
// says which day it is. These fixtures stand on the world's first day.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;

describe("the ledger", () => {
  it("recomputes what it does not store", () => {
    const town = mixedTown({ population: 300, wealth: 4000 });
    stepYears(town, 5);

    const before = structuredClone(town);
    const first = derive(town);
    const second = derive(town);

    expect(second).toEqual(first); // asking twice does not change the answer
    expect(town).toEqual(before); // ...and asking at all does not change the town
  });

  it("changes its ledger today and its standing over seasons", () => {
    // The whole reason prosperity is stored rather than derived: the flow moves at
    // once, the verdict on the place does not.
    const town = mixedTown({ population: 300, wealth: 6000 });
    stepYears(town, 10);

    const earner = raise(town, "sawpit", 10 * DAYS_PER_YEAR)!;
    stepSeason(town, 10 * DAYS_PER_YEAR);
    const yieldWith = derive(town).yield;
    const prosperityWith = town.prosperity;

    earner.condition = "ruin";
    const yieldWithout = derive(town).yield;
    stepSeason(town, 10 * DAYS_PER_YEAR + SEASON);

    // The flow answers instantly...
    expect(yieldWithout).toBeLessThan(yieldWith);
    // ...while the standing has barely noticed.
    const moved = Math.abs(town.prosperity - prosperityWith);
    expect(moved).toBeLessThan(prosperityWith * 0.5);
  });

  it("settles toward a new verdict only after many seasons, never in one", () => {
    const town = bareTown({ population: 120, prosperity: 5 });
    const start = town.prosperity;
    stepSeason(town, DAY0);
    const afterOne = town.prosperity - start;
    stepYears(town, 15, DAY0 + SEASON);
    const afterMany = town.prosperity - start;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterMany).toBeGreaterThan(afterOne * 5); // it keeps going, slowly
  });

  it("builds nothing rather than going into debt", () => {
    // A town whose upkeep outruns its earnings empties its coffers and stops. It
    // does not borrow, and it does not die of arithmetic.
    const town = bareTown({ population: 400, wealth: 10 });
    stepYears(town, 20);
    expect(town.wealth).toBeGreaterThanOrEqual(0);
  });
});

// ---- The hamlet floor, and the one thing that gets under it ----------------
//
// THERE IS NO RAZE MECHANIC. It belongs to the raid layer and does not exist
// yet, so every "razed" state below is CONSTRUCTED BY HAND — the population set
// to nothing and the works list emptied — standing in for a hand that will one
// day do it. That is the only honest way to state §9's acceptance criterion
// before the verb that reaches it is built.
//
// Do NOT restate any of this as "population never falls below N". That was the
// shape of the bug ([HC-67] says the floor REQUIRES SURVIVORS) and a test of it
// would pin the bug rather than the rule.

// A town settled on its own ground, with the works its people raised themselves.
function settled(pop = 200): Town {
  const town = mixedTown({ population: pop, wealth: 0 });
  stepYears(town, 20);
  return town;
}

// What the raid layer will one day do to a place: nobody left, nothing standing.
function razed(town: Town, survivors: number): Town {
  town.population = survivors;
  town.works = [];
  return town;
}

describe("the hamlet floor requires survivors", () => {
  it("never brings back a place razed to nothing, across two more centuries", () => {
    // §9's acceptance criterion, verbatim: "a place razed to nothing never
    // recovers, across the remainder of the run."
    const town = razed(settled(), 0);
    town.wealth = 0;

    stepYears(town, 200);

    expect(town.population).toBe(0);
    expect(town.works).toHaveLength(0);
    expect(carryingCapacity(town)).toBe(0);
    expect(failureWord(town)).toBe("abandoned");
  });

  it("leaves a full treasury and a governor nothing to rebuild it with", () => {
    // The sharper form, because wealth is the one thing a raze might miss. A
    // governor with coin and a whole catalogue in front of him raises nothing:
    // there is nobody to man anything, and that is the only rule doing the work.
    const town = razed(settled(), 0);
    town.wealth = 50_000;

    stepTownYears(town, 200);

    expect(town.population).toBe(0);
    expect(town.works).toHaveLength(0);
    expect(failureWord(town)).toBe("abandoned");
  });

  it("crawls back from survivors, and the survivors are the whole of the difference", () => {
    // [HC-67] stated as a pair: the same raze, twice, differing only in whether
    // anybody walked away from it. Subsistence works cost no wealth and raise
    // themselves per head, so people are the input the floor is made of.
    const some = razed(settled(), 40);
    const none = razed(settled(), 0);
    stepYears(some, 40);
    stepYears(none, 40);

    expect(some.population).toBeGreaterThan(40); // past what survived it
    expect(some.works.some((w) => w.kind === "dwellings")).toBe(true);
    expect(derive(some).food).toBeGreaterThan(0);

    expect(none.population).toBe(0);
    expect(none.works).toHaveLength(0);
  });

  it("feeds nobody where there is nobody — nothing props the capacity up", () => {
    // The deleted constant, stated directly. `carryingCapacity` used to end
    // `Math.max(POP.floor, …)`, so an empty place was reported as feeding twelve
    // souls it did not have and the next season went and found them.
    const empty = razed(settled(), 0);
    expect(carryingCapacity(empty)).toBe(0);
  });
});

describe("only a deliberate hand empties a town", () => {
  // [HC-18]. The floor emerging from subsistence must still hold under every
  // ordinary decline, or deleting the constant traded one bug for a worse one.

  it("falls back onto its own ground when the shipping stops, and stands there", () => {
    // Decline with a cause and no hand on the town: it grew on bought bread and
    // then the corn simply stopped coming. [HC-87]'s fragile ceiling is what
    // makes it fall; the hamlet floor is what catches it. Stated against a twin
    // that never traded, so how far it had been carried is a relationship rather
    // than a number.
    const fed = mixedTown({ population: 200, wealth: 20_000 });
    const never = mixedTown({ population: 200, wealth: 20_000 });
    for (const t of [fed, never]) raise(t, "warehouse", DAY0); // somewhere to land it

    for (let i = 0; i < 200; i++) {
      fed.market.allotted[0] = 900;
      fed.market.price[0] = 0.15;
      stepSeason(fed, DAY0 + i * SEASON);
      stepSeason(never, DAY0 + i * SEASON);
    }
    const peak = fed.population;
    expect(peak).toBeGreaterThan(never.population); // the sea carried souls its ground could not

    fed.market.allotted[0] = 0; // ...and then it stopped
    stepSeasons(fed, 200, DAY0 + 200 * SEASON);
    const fallen = fed.population;
    stepSeasons(fed, 200, DAY0 + 400 * SEASON);

    expect(fallen).toBeLessThan(peak); // it really did fall
    expect(fed.population).toBeCloseTo(fallen, 1); // ...and then stood, rather than sliding on
    expect(fed.population).toBeGreaterThan(CATALOGUE.gardenPlots.hands / WORKS.labourShare);
    expect(derive(fed).food).toBeGreaterThan(0); // on bread it grew itself
  });

  it("keeps enough souls to work its own ground, which is what the floor now is", () => {
    // The floor is no longer a number: it is the fewest souls who can man the
    // cheapest food work. Spelled out from the catalogue rather than read back
    // from the sim, so a tune to either number moves the claim with it.
    const needed = CATALOGUE.gardenPlots.hands / WORKS.labourShare;
    const town = bareTown({ population: 300, wealth: 0 });
    stepYears(town, 120);
    expect(town.population).toBeGreaterThan(needed);
  });
});

describe("the three failure states are readings, never fields", () => {
  // Spec §9.5's table, one constructed ledger per row. [HC-66]: no place gains a
  // stored field for any of them.

  // The top row of the table: a place whose trades have not stopped.
  function withATrade(town: Town): Town {
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);
    expect(town.works.some((w) => w.kind === "sawpit" && w.condition === "working")).toBe(true);
    return town;
  }

  it("reads a place still working, with low standing and bare coffers, as poor", () => {
    const town = withATrade(mixedTown({ population: 200 }));
    town.wealth = 0;
    town.prosperity = 5;
    expect(failureWord(town)).toBe("poor");
  });

  it("calls neither a proud town with an empty purse nor a rich one in low spirits poor", () => {
    // §9.5 wants both halves — "wealth AND prosperity low". Either on its own is
    // an ordinary bad season, and a reading that fired on one would call half the
    // map poor for the rest of the run.
    const broke = withATrade(mixedTown({ population: 200 }));
    broke.wealth = 0;
    broke.prosperity = 70;

    const dispirited = withATrade(mixedTown({ population: 200 }));
    dispirited.wealth = 20_000;
    dispirited.prosperity = 5;

    expect(failureWord(broke)).toBe(null);
    expect(failureWord(dispirited)).toBe(null);
  });

  it("tells an idle trade from a rotted one, because only one of them needs help", () => {
    // The devolution ladder is the difference between the two middle rows of the
    // table. An idle work comes back the season the hands do — `allocateLabour`
    // revives it for nothing — and a decayed one does not, which is precisely
    // §9.5's "only with substantial outside help". So idleness alone is not ruin.
    const town = withATrade(mixedTown({ population: 200 }));
    const pit = town.works.find((w) => w.kind === "sawpit")!;

    pit.condition = "idle"; // the hands are elsewhere this season
    expect(failureWord(town)).not.toBe("ruined");

    pit.condition = "decayed"; // ...and now it has rotted past reviving
    expect(failureWord(town)).toBe("ruined");
  });

  it("reads a place with nothing but subsistence and the wreck of the rest as ruined", () => {
    const town = mixedTown({ population: 200, wealth: 8000 });
    stepTownYears(town, 30);
    expect(town.works.some((w) => CATALOGUE[w.kind].cls === "capital")).toBe(true);

    for (const w of town.works) if (CATALOGUE[w.kind].cls === "capital") w.condition = "ruin";

    expect(failureWord(town)).toBe("ruined");
    expect(town.population).toBeGreaterThan(1); // its people are still there
  });

  it("reads a place with no people and no works as abandoned", () => {
    expect(failureWord(razed(settled(), 0))).toBe("abandoned");
  });

  it("wants both halves of it — no people, AND no works", () => {
    // §9.5 says "no people and no works", and the conjunction is load-bearing in
    // both directions. Subsistence works never rot, so the huts outlive the
    // people: a place emptied of souls with its roofs still standing is a ruin
    // somebody could walk back into, and it reads as one.
    const emptied = settled();
    for (const w of emptied.works) if (CATALOGUE[w.kind].cls === "capital") w.condition = "ruin";
    raise(emptied, "sawpit", DAY0)!.condition = "ruin"; // a wreck to remember it by
    emptied.population = 0;
    expect(emptied.works.length).toBeGreaterThan(0);
    expect(failureWord(emptied)).toBe("ruined");

    // ...and the other way: everything burned, but people walked out of it.
    const survivors = razed(settled(), 40);
    expect(failureWord(survivors)).not.toBe("abandoned");
  });

  it("says nothing is wrong with a town that is merely small", () => {
    // The reading has to be able to return nothing, or it is a label rather than
    // a diagnosis — and a young hamlet that never rose is not a fallen one.
    const town = bareTown({ population: 120, wealth: 2000, prosperity: 45 });
    stepYears(town, 5);
    expect(failureWord(town)).toBe(null);
  });

  it("keeps none of them — change the ledger and the reading changes with it, unstepped", () => {
    // The sharp form of [HC-66]. Not one season is stepped between these three
    // answers, so there is nowhere a stored state could have been written: the
    // reading is of the ledger as it stands, this instant.
    const town = mixedTown({ population: 200, wealth: 8000 });
    stepTownYears(town, 30);

    const before = structuredClone(town);
    expect(failureWord(town)).toBe(null);
    expect(town).toEqual(before); // ...and asking did not change the town

    for (const w of town.works) if (CATALOGUE[w.kind].cls === "capital") w.condition = "ruin";
    expect(failureWord(town)).toBe("ruined");

    town.population = 0;
    town.works = [];
    expect(failureWord(town)).toBe("abandoned");
  });
});

describe("the weather has two output paths, and they must not be mixed", () => {
  // [HC-6], which is the whole design of this seam: DAMAGE is an event and lands
  // the day it happens; YIELD is a modifier that accumulates into the current
  // season's harvest and is spent ONCE, when the books are struck. A downpour
  // does not reach into a ledger that has not been struck yet.
  //
  // Nothing here knows a storm exists. `takeWeather` is handed four numbers, and
  // that is [HC-33] stated as a signature rather than as a rule to remember.

  const fair = { yieldLoss: 0, wealthLoss: 0, worksDropped: 0, worksDestroyed: 0 };

  it("takes the coin and the shed on the day, not at the season", () => {
    const town = mixedTown({ population: 400, wealth: 4000 });
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);
    const purse = town.wealth;
    const standing = town.works.filter((w) => w.condition === "working").length;

    takeWeather(town, DAY0 + 1, { ...fair, wealthLoss: 0.1, worksDropped: 1 }, 0);

    // TODAY. No season has turned and no phase has run.
    expect(town.wealth).toBeLessThan(purse);
    expect(town.works.filter((w) => w.condition === "working").length).toBe(standing - 1);
  });

  it("leaves the harvest alone until the books are struck", () => {
    // The MODIFIER half, and the sentence it is written from. A downpour on day
    // one of a season must not reach a ledger that is not struck until day
    // ninety — so what changes today is the account, and not the harvest.
    const town = mixedTown({ population: 400, wealth: 4000 });
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);
    const purse = town.wealth;

    takeWeather(town, DAY0 + 1, { ...fair, yieldLoss: 0.4 }, 0);

    expect(town.harvestLoss).toBeCloseTo(0.4, 12);
    expect(town.wealth).toBe(purse); // not a coin, and not a grade
    expect(town.works.every((w) => w.condition === "working")).toBe(true);
  });

  it("charges a spoiled harvest against the season that spoiled it, and once", () => {
    // The oracle is written out rather than read back: a harvest short by a
    // third earns a third less, so the season's gain is smaller. Two identical
    // towns, one rained on for ninety days, one not.
    const dry = mixedTown({ population: 400, wealth: 4000 });
    const wet = mixedTown({ population: 400, wealth: 4000 });
    for (const t of [dry, wet]) {
      raise(t, "sawpit", DAY0);
      raise(t, "caneField", DAY0);
      stepSeason(t, DAY0);
    }
    expect(wet.wealth).toBe(dry.wealth);

    for (let d = 1; d < 90; d++) takeWeather(wet, DAY0 + d, { ...fair, yieldLoss: 0.004 }, 0);
    const spoiled = wet.harvestLoss;
    expect(spoiled).toBeGreaterThan(0.3);

    // The books are struck. Food, cargo and the mouths the place can keep all
    // come off the same share.
    expect(derive(wet).food).toBeCloseTo(derive(dry).food * (1 - spoiled), 9);
    expect(carryingCapacity(wet)).toBeCloseTo(carryingCapacity(dry) * (1 - spoiled), 9);
    expect(derive(wet).commerce.produced[1]).toBeCloseTo(derive(dry).commerce.produced[1] * (1 - spoiled), 9);

    stepSeason(wet, DAY0 + SEASON);
    stepSeason(dry, DAY0 + SEASON);
    expect(wet.wealth).toBeLessThan(dry.wealth);
    expect(wet.population).toBeLessThan(dry.population);
  });

  it("closes the weather's account with the books, so no downpour is charged twice", () => {
    // "A modifier that carries across seasons is a bug." The season that resolves
    // spends the account and puts it back to nothing; the next ninety days start
    // from zero whatever fell in the last ninety.
    const town = mixedTown({ population: 400, wealth: 4000 });
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);

    takeWeather(town, DAY0 + 1, { ...fair, yieldLoss: 0.5 }, 0);
    expect(town.harvestLoss).toBe(0.5);

    stepSeason(town, DAY0 + SEASON);
    expect(town.harvestLoss).toBe(0);

    // ...and the season after the storm books a full harvest again.
    const clear = mixedTown({ population: town.population, wealth: town.wealth });
    raise(clear, "sawpit", DAY0);
    stepSeason(clear, DAY0);
    expect(derive(town).food).toBeCloseTo(derive(clear).food, 9);
  });

  it("never takes more than all of it, however long it rains", () => {
    const town = mixedTown({ population: 400, wealth: 4000 });
    stepSeason(town, DAY0);
    for (let d = 1; d < 90; d++) takeWeather(town, DAY0 + d, { ...fair, yieldLoss: 0.2 }, 0);
    expect(town.harvestLoss).toBe(1);
    expect(derive(town).food).toBe(0);
    expect(carryingCapacity(town)).toBe(0);
  });

  it("changes nothing at all on a fair day", () => {
    // The identity that lets the daily tick be composed without moving a single
    // existing result: a share of nothing is nothing, and a double times one is
    // the same double.
    const town = mixedTown({ population: 400, wealth: 4000 });
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);
    const before = structuredClone(town);
    takeWeather(town, DAY0 + 1, fair, 0.5);
    expect(town).toEqual(before);
  });
});

describe("determinism", () => {
  // [HC-11]: reproducible means the whole history, not the starting state. This
  // survives the world layer untouched — it says nothing about where land comes
  // from, only that the same start gives the same century.
  it("gives the same century from the same starting state", () => {
    const a = mixedTown({ population: 200, wealth: 3000 });
    const b = mixedTown({ population: 200, wealth: 3000 });

    stepTownYears(a, 200);
    stepTownYears(b, 200);

    expect(b).toEqual(a);
  });

  it("does not care whether the century is run in one go or in pieces", () => {
    // The town-scale form of "the same world fast-forwarded twice gives the same
    // history, at any speed" — and what will catch an accidental wall-clock read
    // when the speed control arrives.
    const whole = mixedTown({ population: 200, wealth: 3000 });
    const pieces = mixedTown({ population: 200, wealth: 3000 });

    stepTownYears(whole, 60);
    // The pieces have to be told where they resume — the town cannot be asked,
    // because it keeps no clock. That is the shape of the fix, and it makes this
    // claim stronger than it was: it now also says the handed-in day is what
    // drives the run, not some counter the town quietly kept between calls.
    for (let i = 0; i < 60; i++) stepTownYears(pieces, 1, i * DAYS_PER_YEAR);

    expect(pieces).toEqual(whole);
  });

  it("reads no clock of its own at all", () => {
    // A guard against wall-clock or Math.random creeping into the sim: two runs
    // separated in real time must be identical. The claim used to end "beyond the
    // season it counts", because the town counted one; it counts nothing now.
    const a = makeTown({ name: "A", seed: 7, population: 90 });
    const b = makeTown({ name: "B", seed: 7, population: 90 });
    stepYears(a, 30);
    stepYears(b, 30);
    expect(b.population).toBe(a.population);
    expect(b.prosperity).toBe(a.prosperity);
    expect(b.wealth).toBe(a.wealth);
  });
});

// ---- One clock, and everything on it ---------------------------------------
//
// [HC-9]: one clock, in world state, and no system carries its own. The town
// carried one until KAN-107 — `season`, "seasons elapsed since founding" — and
// the year it computed from it was reckoned from the town's OWN founding. Two
// places founded in different years therefore could not be compared at all: each
// believed year 1 was the year it was founded. Every claim below was impossible
// to write before the fix and is almost too easy to write after it, which is
// exactly what a fix of this shape should look like.

describe("a place keeps days since world epoch, and no clock of its own", () => {
  it("stores no field that counts seasons or years", () => {
    // The sharp form, and the one that would fail if anybody reintroduced a
    // private counter under a new name. Every time-bearing field on the struct —
    // the town's and its works' — is a DAY, and says so.
    const town = mixedTown({ population: 200, wealth: 3000 });
    stepYears(town, 20);

    const timeBearing = (o: object) =>
      Object.keys(o).filter((k) => /year|season|month|week|date|time|day|since|founded/i.test(k));

    expect(timeBearing(town)).toEqual(["foundedDay", "lastThreatDay"]);
    expect(town.works.length).toBeGreaterThan(0);
    for (const w of town.works) expect(timeBearing(w)).toEqual(["sinceDay", "idleSinceDay"]);
  });

  it("dates a work by the day it was handed, not by a season it counted", () => {
    const town = mixedTown({ population: 300, wealth: 9000 });
    const day = 37 * DAYS_PER_YEAR + 2 * SEASON;
    const pit = raise(town, "sawpit", day)!;
    expect(pit.sinceDay).toBe(day);
    expect(yearOfDay(pit.sinceDay)).toBe(yearOfDay(day));
  });
});

describe("two places founded in different years sit on one timeline", () => {
  // THE CLAIM THIS TICKET EXISTS FOR. Today every place is founded on day 0 and
  // the old reckoning agreed with this one by coincidence; the moment a place has
  // a history (KAN-99) or a date is printed on a map (KAN-100), it would not.

  it("dates the same season the same way in a young town and an old one", () => {
    // Founded eighty years apart, run through the SAME seasons. Under the old
    // reckoning the elder would have called this its 92nd year and the younger its
    // 12th, and both would have been talking about the same afternoon.
    const elder = mixedTown({ population: 200, wealth: 9000, foundedDay: -80 * DAYS_PER_YEAR });
    const younger = mixedTown({ population: 200, wealth: 9000, foundedDay: 0 });

    const from = 12 * DAYS_PER_YEAR;
    stepTownYears(elder, 5, from);
    stepTownYears(younger, 5, from);

    const raisedIn = (t: Town) => t.works.filter((w) => w.sinceDay >= from).map((w) => yearOfDay(w.sinceDay));
    expect(raisedIn(elder).length).toBeGreaterThan(0);
    expect(raisedIn(younger).length).toBeGreaterThan(0);
    for (const y of [...raisedIn(elder), ...raisedIn(younger)]) {
      expect(y).toBeGreaterThanOrEqual(yearOfDay(from));
      expect(y).toBeLessThan(yearOfDay(from) + 5);
    }
  });

  it("says which of two places' works is the elder, across the whole map", () => {
    // The comparison itself — a single `<` over two towns' ledgers, which is what
    // a chronicle, a world map date and a warm start all need. It could not be
    // written at all while each place counted from its own founding.
    const oldTown = mixedTown({ population: 200, wealth: 9000, foundedDay: -80 * DAYS_PER_YEAR });
    const newTown = mixedTown({ population: 200, wealth: 9000, foundedDay: 0 });

    const oldSawpit = raise(oldTown, "sawpit", -80 * DAYS_PER_YEAR)!; // cut the year it was founded
    const newSawpit = raise(newTown, "sawpit", 0)!; // ...and this one eighty years later

    expect(oldSawpit.sinceDay).toBeLessThan(newSawpit.sinceDay);
    expect(yearOfDay(newSawpit.sinceDay) - yearOfDay(oldSawpit.sinceDay)).toBe(80);
  });

  it("ages two places at their own ages while the world keeps one date", () => {
    // Both halves at once, which is the point of the split: HOW OLD a place is
    // belongs to the place, WHAT DAY IT IS belongs to the world, and the second
    // is not a function of the first.
    const elder = mixedTown({ foundedDay: -80 * DAYS_PER_YEAR });
    const younger = mixedTown({ foundedDay: -5 * DAYS_PER_YEAR });
    const today = 12 * DAYS_PER_YEAR;

    expect((today - elder.foundedDay) / DAYS_PER_YEAR).toBe(92);
    expect((today - younger.foundedDay) / DAYS_PER_YEAR).toBe(17);
    expect(elder.foundedDay).toBeLessThan(younger.foundedDay); // and the elder is elder
    // ...while the date is one date, and neither founding is in it. The oracle is
    // written out rather than read back: twelve years after the epoch is 1672.
    expect(yearOfDay(today)).toBe(CALENDAR.epochYear + 12);
  });
});
