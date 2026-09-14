// The ledger — what it stores, what it refuses to store, and how it moves.
//
// Every claim here is warranted by [HC-70]: the world layer explicitly does NOT
// reopen the three stored numbers, the deliberate lag on prosperity, or the rule
// that nothing derived is kept. See spec/world-simulation.md §10.1.

import { describe, it, expect } from "vitest";
import { derive, stepSeason, stepYears, makeTown, carryingCapacity, failureWord } from "./sim";
import { stepTownYears } from "./governor";
import { raise, CATALOGUE } from "./works";
import { mixedTown, bareTown } from "./fixtures";
import { WORKS } from "./constants";
import type { Town } from "./types";

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

    const earner = raise(town, "sawpit", 1650)!;
    stepSeason(town);
    const yieldWith = derive(town).yield;
    const prosperityWith = town.prosperity;

    earner.condition = "ruin";
    const yieldWithout = derive(town).yield;
    stepSeason(town);

    // The flow answers instantly...
    expect(yieldWithout).toBeLessThan(yieldWith);
    // ...while the standing has barely noticed.
    const moved = Math.abs(town.prosperity - prosperityWith);
    expect(moved).toBeLessThan(prosperityWith * 0.5);
  });

  it("settles toward a new verdict only after many seasons, never in one", () => {
    const town = bareTown({ population: 120, prosperity: 5 });
    const start = town.prosperity;
    stepSeason(town);
    const afterOne = town.prosperity - start;
    stepYears(town, 15);
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
    for (const t of [fed, never]) raise(t, "warehouse", 1650); // somewhere to land it

    for (let i = 0; i < 200; i++) {
      fed.market.allotted[0] = 900;
      fed.market.price[0] = 0.15;
      stepSeason(fed);
      stepSeason(never);
    }
    const peak = fed.population;
    expect(peak).toBeGreaterThan(never.population); // the sea carried souls its ground could not

    fed.market.allotted[0] = 0; // ...and then it stopped
    for (let i = 0; i < 200; i++) stepSeason(fed);
    const fallen = fed.population;
    for (let i = 0; i < 200; i++) stepSeason(fed);

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
    raise(town, "sawpit", 1650);
    stepSeason(town);
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
    raise(emptied, "sawpit", 1650)!.condition = "ruin"; // a wreck to remember it by
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
    for (let i = 0; i < 60; i++) stepTownYears(pieces, 1);

    expect(pieces).toEqual(whole);
  });

  it("reads no clock of its own beyond the season it counts", () => {
    // A guard against wall-clock or Math.random creeping into the sim: two runs
    // separated in real time must be identical.
    const a = makeTown({ name: "A", seed: 7, population: 90 });
    const b = makeTown({ name: "B", seed: 7, population: 90 });
    stepYears(a, 30);
    stepYears(b, 30);
    expect(b.population).toBe(a.population);
    expect(b.prosperity).toBe(a.prosperity);
    expect(b.wealth).toBe(a.wealth);
  });
});
