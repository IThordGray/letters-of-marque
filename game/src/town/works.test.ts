// The works ledger — the hamlet floor, the devolution ladder, the two gates on
// what ground will bear, and the collapse of the catalogue to three and eight.
//
// Warranted by [HC-70] (the world layer reopens none of it) and [HC-34] (damage
// moves works down THIS ladder, one grade at a time).

import { describe, it, expect } from "vitest";
import type { Town, Work, Suit, RegionFocus, WorkKind } from "./types";
import type { Axial } from "./hex";
import { derive, stepYears, stepSeason, stepSeasons } from "./sim";
import {
  raise, buildable, roomInRegion, takenHexes, depthOf, unmetNeeds, countOf,
  damageWorks, mendable, repairCost, installationLabel, CATALOGUE, SUBSISTENCE,
  CAPITAL, CHOOSABLE, FOCUS_EXPRESSIONS, isFocusExpression,
} from "./works";
import { capacityOf } from "./land";
import { cargoOf, PRODUCE_CLASS } from "./trade";
import { stepTownSeason, type Decision, type Built } from "./governor";
import { DECAY, POP, SUIT_YIELD, WORKS } from "./constants";
import { CALENDAR } from "../overworld/calendar";
import { mixedTown, bareTown, townOf, reg, RING1, RING2 } from "./fixtures";

// A season's one decision may be a work or a region focus, so a claim about a
// MEND narrows to the work half rather than reading `.work` off whatever came
// back (see governor.test.ts for the same helper and the same reason).
const built = (d: Decision | null): Built | null => (d !== null && d.kind === "work" ? d : null);

// The town keeps no clock (KAN-107): the world hands it the day, and here the
// test plays the world. These fixtures stand on the world's first day.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;

// The devolution thresholds are DAYS. How many seasons it takes to cross one is
// written out here rather than read back out of the ladder — the oracle rule.
const SEASONS_TO_DECAY = DECAY.idleToDecayed / SEASON;
const SEASONS_TO_RUIN = DECAY.decayedToRuin / SEASON;

// A presidio. It is §5.6's own example — "a presidio of ninety souls" — and it is
// the right fixture for a claim about the LADDER, because SPRAWL.royalOutpost
// never spills: the town claims no new ground, so no work of its is ever built
// over and nothing but decay is under test.
const presidio = (init: Partial<Town> = {}): Town => mixedTown({ archetype: "royalOutpost", ...init });

describe("the hamlet floor", () => {
  it("crawls back to a hamlet rather than dying", () => {
    // NOTE: the claim is behavioural, deliberately. Do NOT write this as
    // "population never falls below the floor". There is no floor CONSTANT any
    // more — KAN-106 deleted it, because a constant floor does not enforce
    // [HC-67], it conceals whether [HC-67] holds. The floor that remains is
    // emergent and is a LABOUR one: gardenPlots.hands / WORKS.labourShare, or
    // 10.91 souls, below which the cheapest food work cannot be manned at all.
    // Asserting that number here would assert the catalogue back at itself.
    const town = mixedTown({ population: 200, wealth: 5000 });
    stepYears(town, 20);

    town.works = []; // sacked to nothing
    town.wealth = 0; // and penniless

    stepYears(town, 10);

    expect(town.works.some((w) => w.kind === "dwellings")).toBe(true);
    expect(derive(town).food).toBeGreaterThan(0);
  });

  it("raises its own roofs and food without spending a coin", () => {
    const town = bareTown({ population: 160, wealth: 0 });
    stepYears(town, 5);

    const raised = town.works.filter((w) => CATALOGUE[w.kind].cls === "subsistence");
    expect(raised.length).toBeGreaterThan(0);
    expect(raised.every((w) => CATALOGUE[w.kind].cost === 0)).toBe(true);
    expect(town.wealth).toBe(0); // nothing was ever spent to get them
  });

  it("keeps its own roofs on however long it is untended", () => {
    // Subsistence works never rot; that is the floor's whole mechanism.
    const town = bareTown({ population: 2, wealth: 0 });
    stepYears(town, 60);
    const homes = town.works.filter((w) => w.kind === "dwellings");
    expect(homes.length).toBeGreaterThan(0);
    expect(homes.every((w) => w.condition !== "ruin")).toBe(true);
  });
});

// ---- A work that feeds the town pays its own wages, wherever it stands -------
//
// KAN-137, ratified 2026-09-23: *"Anything in town that keeps the town running is
// straight numbers, not good or poor... and it should always be the case that
// manning it is less than the upkeep. So no case where it takes 11 people to work
// but only feeds 10."*
//
// THIS CLAIM WALKS THE WHOLE CATALOGUE AND THAT IS THE POINT OF IT. The same bug
// has been patched twice one row at a time — KAN-116 ("poor food ground cannot
// sustain the hands that work it") and KAN-119 ("provisionGround cannot pay its
// own wages on poor ground") — and twice is a design question wearing a bug's
// clothes. A claim that asks every row of the catalogue, on every grade of ground
// there is, is what makes the CLASS of bug unrepeatable rather than the instance.
//
// One work on one hex of a named grade, so a claim can be made about the WORK
// rather than about a town. The hex is deliberately off-origin and off-axis
// (testing.md, "anchor fixtures off-origin, and asymmetrically") — at the centre,
// "plotted from the seat" and "plotted from nowhere" are the same coordinates.
const FOOD_WORKS = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].food > 0);

function onGround(kind: WorkKind, suit: Suit, reach: "atHand" | "far", sweet: boolean): Work {
  const hex = RING1.slice(3, 4);
  const produce = CATALOGUE[kind].produces!;
  const town = townOf(
    [
      reg(0, produce === "fish" ? "reef" : "tilledGround", hex, {
        bears: { [produce]: suit },
        reach,
        sweetSpot: sweet ? hex[0] : null,
      }),
    ],
    { population: 500, wealth: 90000 }, // souls and coin enough that nothing here is about either
  );
  return raise(town, kind, DAY0)!;
}

// Every case the ground can be in: three grades, at hand and over the ridge, on
// ordinary ground and on the region's one sweet spot. ENUMERATE, DO NOT
// GENERALISE (testing.md) — the claim is about which cases exist, and the case
// that used to fail is one of twelve rather than the one anybody would pick.
function everyGround(): { where: string; work: Work; kind: WorkKind; reach: "atHand" | "far" }[] {
  const out: { where: string; work: Work; kind: WorkKind; reach: "atHand" | "far" }[] = [];
  for (const kind of FOOD_WORKS) {
    for (const suit of Object.keys(SUIT_YIELD) as Suit[]) {
      for (const reach of ["atHand", "far"] as const) {
        for (const sweet of [false, true]) {
          out.push({ where: `${kind} on ${suit}/${reach}${sweet ? "/sweet" : ""}`, work: onGround(kind, suit, reach, sweet), kind, reach });
        }
      }
    }
  }
  return out;
}

describe("every work that feeds the town pays its own wages", () => {
  it("names the works that feed a town, and they are the free ones", () => {
    // THE PRECONDITION THE CLAIMS BELOW REST ON, measured rather than argued
    // (testing.md: a predicted survivor is a claim about the world, and the
    // claim needs measuring too). KAN-137 moved provision grounds and grain
    // fields into the `trade` column, so the set the catalogue walk finds is now
    // exactly the hamlet floor's own two. If a capital work ever grows a `food`
    // column again this goes red, and so does every claim below it.
    expect([...FOOD_WORKS].sort()).toEqual(["fishingShacks", "gardenPlots"]);
    expect(FOOD_WORKS.every((k) => CATALOGUE[k].cls === "subsistence")).toBe(true);
  });

  it("feeds more souls than it takes to man it, on every grade of ground there is", () => {
    // THE ORACLE IS WRITTEN OUT, never asked of the code (testing.md): the souls
    // a work needs are its hands divided by the share of a population that works,
    // and that division is spelled here rather than read back from the module.
    const under: string[] = [];
    for (const { where, work } of everyGround()) {
      const souls = work.hands / WORKS.labourShare;
      if (work.food <= souls) under.push(`${where}: feeds ${work.food}, wants ${souls} souls`);
    }
    expect(under).toEqual([]);
  });

  it("feeds enough more of them to hold at the lowest standing a place can sink to", () => {
    // WHY A BARE SURPLUS IS NOT ENOUGH, derived rather than guessed. A place with
    // one food work settles where its carrying capacity puts it — `food x pull`,
    // and `pull` is what prosperity does to the ceiling — so it can man that work
    // only while
    //
    //     food x pull x labourShare  >=  hands
    //
    // i.e. while `food x labourShare / hands >= 1 / pull`. The worst `pull` the
    // model permits is `POP.prosperityPull.min`, so at 0.5 the margin a work must
    // clear is TWO: it must feed twice the souls its own hands need, and a place
    // may then lose half its people to a shock and still work its ground. Exactly
    // break-even would wobble across the line on any weather at all.
    const need = 1 / POP.prosperityPull.min;
    const thin: string[] = [];
    for (const { where, work } of everyGround()) {
      const margin = (work.food * WORKS.labourShare) / work.hands;
      if (margin < need) thin.push(`${where}: margin ${margin.toFixed(3)}, wants ${need}`);
    }
    expect(thin).toEqual([]);
  });

  it("feeds the same mouths on ground that grudges the crop as on ground made for it", () => {
    // THE RULING ITSELF (KAN-137): "we assume that towns are self-sufficient
    // regardless what their land looks like." The ground decides what a town
    // SELLS; it has nothing to say about what it eats. A mutation that puts the
    // suitability multiplier back on the `food` column fails here on the first
    // row it reaches.
    //
    // IT ASSERTS THE CATALOGUE FIGURE, NOT MERELY EQUALITY BETWEEN GRADES, and
    // the difference matters: a scaling that multiplied every grade by the same
    // constant would satisfy "poor equals ideal" and still be a ground term.
    for (const { where, work, kind } of everyGround()) {
      expect(work.food, where).toBe(CATALOGUE[kind].food);
    }
  });

  it("asks exactly the men the catalogue writes it for, and only the walk costs more", () => {
    // THE OTHER HALF OF "STRAIGHT NUMBERS, NOT GOOD OR POOR": if the ground
    // cannot change what a work returns, it must not change what it costs
    // either. A subsistence work's hands used to be scaled by `min(q, 1)` to
    // hold the mouths-per-hand ratio constant while `food` moved with the dirt;
    // with `food` flat that clamp would make POOR GROUND CHEAPER TO WORK THAN
    // GOOD, which is the rule upside down. It is deleted, and this says so.
    for (const { where, work, kind, reach } of everyGround()) {
      const walk = reach === "far" ? WORKS.farHands : 1;
      expect(work.hands, where).toBeCloseTo(CATALOGUE[kind].hands * walk, 10);
    }
  });

  it("still costs more men over the ridge than the same plot at hand", () => {
    // The far cost is a separate design statement — men must walk to it — and
    // nothing in the ruling touches it. What DID change is the other half of
    // this claim: the plot over the ridge no longer feeds fewer mouths, because
    // the far penalty is a ground term and ground terms stop at `food`.
    const near = onGround("gardenPlots", "fair", "atHand", false);
    const far = onGround("gardenPlots", "fair", "far", false);
    expect(far.hands).toBeGreaterThan(near.hands);
    expect(far.food).toBe(near.food);
  });

  it("still ships more off ground made for the crop, which is the whole of what the dirt decides", () => {
    // THE LIVE HALF OF THE MULTIPLIER, asserted on the largest cargo column in
    // the catalogue rather than on a convenient one (testing.md: assert with the
    // member whose presence would be loudest). Delete the suitability scaling
    // altogether and this goes red — which is what stops the claim above being
    // satisfied by a mutation that simply stops scaling anything at all.
    const hills = (suit: Suit) =>
      townOf([reg(0, "timberedHills", RING1.slice(2, 3), { bears: { timber: suit } })], { population: 900, wealth: 9000 });
    const poor = raise(hills("poor"), "sawpit", DAY0)!;
    const ideal = raise(hills("ideal"), "sawpit", DAY0)!;

    expect(poor.trade).toBeLessThan(ideal.trade);
    expect(poor.hands).toBe(ideal.hands); // ...and it costs the same men either way
  });

  it("grows the same bread on any acre and sells more of it off the best", () => {
    // THE TWO HALVES TOGETHER, on the row the ruling was written about. A
    // provision ground is a TILE work now: it feeds nobody, its whole output is
    // cargo, and the cargo is the half the ground scales.
    const ground = (suit: Suit) =>
      townOf([reg(0, "tilledGround", RING1.slice(2, 3), { bears: { food: suit } })], { population: 900, wealth: 9000 });
    const poor = raise(ground("poor"), "provisionGround", DAY0)!;
    const ideal = raise(ground("ideal"), "provisionGround", DAY0)!;

    expect(poor.food).toBe(0); // a farm on a tile is not dinner
    expect(ideal.food).toBe(0);
    expect(poor.trade).toBeLessThan(ideal.trade);
    expect(poor.hands).toBe(CATALOGUE.provisionGround.hands);
    expect(ideal.hands).toBe(CATALOGUE.provisionGround.hands);
  });
});

// ---- A place with nothing but poor ground -----------------------------------
//
// [HC-18]: only a deliberate hand empties a town, so decline alone can never
// empty one. The case is CONSTRUCTED rather than hunted for in a seed, because a
// claim that depends on a generator containing an example expires with the
// generator.
const onlyPoor = (init: Partial<Town> = {}) =>
  townOf([reg(0, "tilledGround", RING1, { bears: { food: "poor" } }), reg(1, "scrub", RING2)], init);
const onlyFair = (init: Partial<Town> = {}) =>
  townOf([reg(0, "tilledGround", RING1, { bears: { food: "fair" } }), reg(1, "scrub", RING2)], init);

describe("a town on nothing but poor ground", () => {
  it("still stands after two centuries, rather than emptying by ordinary decline", () => {
    const town = onlyPoor({ population: 163, wealth: 0 });
    stepYears(town, 200, DAY0);

    expect(town.population).toBeGreaterThan(0);
    expect(derive(town).food).toBeGreaterThan(0);
    expect(town.works.some((w) => w.kind === "gardenPlots" && w.condition === "working")).toBe(true);
  });

  it("stands STILL at a living size, rather than sliding on a century later", () => {
    // The sharper form, and the one the old bug would have failed on its own
    // terms: it did not merely end small, it never stopped falling.
    //
    // "AT A LIVING SIZE" IS LOAD-BEARING, and it was put there by a mutation
    // survivor rather than by foresight (testing.md). Without it the claim is
    // decoration: a town of nobody also stands perfectly still, so every mutation
    // that killed the place outright sailed straight through. The size it must
    // stand at is written out from the catalogue and the grade — the souls one
    // plot on poor ground needs — and never read back from the module.
    const needed = CATALOGUE.gardenPlots.hands / WORKS.labourShare;
    const town = onlyPoor({ population: 163, wealth: 0 });
    stepYears(town, 100, DAY0);
    const settled = town.population;
    stepYears(town, 100, DAY0 + 100 * CALENDAR.seasonsPerYear * SEASON);

    expect(settled).toBeGreaterThan(needed);
    expect(town.population).toBeCloseTo(settled, 1);
  });

  it("grows a small surplus off ground that grudges it, which is the whole difference", () => {
    // Poor ground is meant to mean a thin living, not a death sentence.
    const town = onlyPoor({ population: 163, wealth: 0 });
    stepYears(town, 200, DAY0);
    expect(derive(town).surplus).toBeGreaterThan(0);
  });

  it("settles at exactly the size the same town settles at on ground made for the crop", () => {
    // THE RULING AS A BEHAVIOUR RATHER THAN AS A COLUMN (KAN-137): "if all the
    // hexes are grain fields, that doesn't impact how big the town gets." This
    // claim used to say the opposite — that a poor-ground town settles a quarter
    // smaller — and that was the ground deciding what a town ate.
    //
    // THE LIVENESS HALF IS LOAD-BEARING (testing.md): two towns of nobody also
    // settle at the same size, so the claim says the size is a living one, and
    // says it from the catalogue rather than reading it back.
    const poor = onlyPoor({ population: 163, wealth: 0 });
    const fair = onlyFair({ population: 163, wealth: 0 });
    stepYears(poor, 200, DAY0);
    stepYears(fair, 200, DAY0);

    expect(poor.population).toBeGreaterThan(CATALOGUE.gardenPlots.hands / WORKS.labourShare);
    expect(poor.population).toBeCloseTo(fair.population, 6);
  });

  it("never comes back once it is razed to nothing, however kind the scaling", () => {
    // [HC-67] and KAN-106, claimed in the file that changed. The floor REQUIRES
    // SURVIVORS: `raiseSubsistence` wants `ceil(population / autoPer)` of works
    // that cost nothing, and at nobody that is nothing. Cheapening the hands a
    // plot costs must not turn a place with no people into a place with one.
    const town = onlyPoor({ population: 163, wealth: 0 });
    stepYears(town, 50, DAY0);
    expect(town.works.length).toBeGreaterThan(0);

    town.works = []; // razed to nothing, and nobody left to raise a hut
    town.population = 0;
    stepYears(town, 200, DAY0 + 50 * CALENDAR.seasonsPerYear * SEASON);

    expect(town.works).toEqual([]);
    expect(town.population).toBe(0);
  });
});

describe("the devolution ladder", () => {
  it("rots by grades and never straight to ruin", () => {
    // A work nobody can man goes idle, and only then decays. Elapsed time is the
    // difference between two days handed in, which is all it ever should have
    // been — the town's private season counter is gone (KAN-107).
    const town = mixedTown({ population: 400, wealth: 4000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    expect(pit.condition).toBe("working");

    town.population = 4; // the hands walk away
    const seen: string[] = [];
    for (let i = 1; i <= 40; i++) {
      stepSeason(town, DAY0 + i * SEASON);
      if (seen[seen.length - 1] !== pit.condition) seen.push(pit.condition);
    }

    // Whatever the tuning, the order is the rule.
    expect(seen).toEqual(["idle", "decayed", "ruin"]);
  });

  it("is idle for a while before it is decayed", () => {
    const town = mixedTown({ population: 400, wealth: 4000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    town.population = 4;
    stepSeason(town, DAY0 + SEASON);
    expect(pit.condition).toBe("idle"); // one season of neglect is not decay
  });

  it("comes straight back the season the hands return", () => {
    const town = mixedTown({ population: 400, wealth: 4000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    town.population = 4;
    stepSeason(town, DAY0 + SEASON);
    expect(pit.condition).toBe("idle");

    town.population = 400;
    stepSeason(town, DAY0 + 2 * SEASON);
    expect(pit.condition).toBe("working");
  });
});

describe("coming back up the ladder", () => {
  // KAN-108. The ladder was DOCUMENTED as recoverable at every grade and was not:
  // hands were only ever allotted to `working` and `idle`, so a decayed work was
  // in no set anyone looked at, its idle clock was never cleared, and every one of
  // them was guaranteed to reach `ruin`. Three rungs below working and one
  // direction past the first.
  //
  // The suite above covers the ladder going DOWN and nobody had written a claim
  // about it coming back up, which is exactly why a false comment survived. These
  // are that claim.

  it("puts a rotted work back to work when someone pays for it", () => {
    const town = presidio({ population: 400, wealth: 9000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    expect(pit.condition).toBe("working");

    town.population = 4; // the hands walk away, and it rots two rungs
    stepSeasons(town, SEASONS_TO_DECAY + 1, DAY0 + SEASON);
    const rotted = DAY0 + (SEASONS_TO_DECAY + 2) * SEASON;
    expect(pit.condition).toBe("decayed");

    // They come back, and so does the coin.
    town.population = 400;
    town.wealth = 9000;
    const mended = stepTownSeason(town, rotted);
    expect(built(mended.decided)?.work).toBe(pit);
    expect(pit.condition).toBe("idle"); // the coin buys ONE RUNG, not the men

    stepTownSeason(town, rotted + SEASON);
    expect(pit.condition).toBe("working"); // ...and the hands take the last step
  });

  it("costs coin to mend, and less coin than raising the same work anew", () => {
    // A step that costs nothing is not a step: mending for free would erase the
    // difference between `idle` and `decayed` and leave the ladder's middle rung
    // meaning nothing. Cheaper than building is the whole reason anyone mends.
    for (const kind of ["sawpit", "warehouse", "battery"] as const) {
      expect(repairCost(kind)).toBeGreaterThan(0);
      expect(repairCost(kind)).toBeLessThan(CATALOGUE[kind].cost);
    }
  });

  it("is past saving once it is a ruin, however rich the town and however long it waits", () => {
    const town = presidio({ population: 600, wealth: 9000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    pit.condition = "ruin";
    pit.idleSinceDay = DAY0;

    expect(mendable(town, pit)).toBe(false);
    for (let i = 1; i <= 60 * CALENDAR.seasonsPerYear; i++) {
      town.wealth = 90000; // never short of coin for a single season of it
      town.population = 600;
      stepTownSeason(town, DAY0 + i * SEASON);
    }
    expect(pit.condition).toBe("ruin");
  });

  it("holds its ground and its place in the ledger while it rots, and gives both back when it ruins", () => {
    // Pinning the REAL behaviour, because it is easy to state wrongly. A decayed
    // work does NOT sterilise its ground: it holds one hex and one slot against
    // `def.max`, and a ruin holds neither.
    //
    // ASKED OF THE DEEPENING'S ROOM SINCE KAN-124, and the change is the rule
    // rather than the claim. `roomFor` is the AUCTION's question and the auction
    // may only ever put the FIRST work on a region ([HC-94]), so on unfocused
    // ground it answers 0 whatever the hex under the rotting pit is doing. Where
    // area is still the cap is on ground given over to production, so that is
    // the ground this claim is now made on.
    const town = townOf(
      [reg(0, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" }, focus: "production" })],
      { population: 900, wealth: 90000 },
    );
    const room = () => roomInRegion(town, town.regions[0], 0, "sawpit", "deepen", takenHexes(town));
    const pit = raise(town, "sawpit", DAY0)!;
    expect(room()).toBe(1);

    pit.condition = "decayed";
    expect(countOf(town, "sawpit")).toBe(1); // still on the books
    expect(room()).toBe(1); // still standing on its hex

    pit.condition = "ruin";
    expect(countOf(town, "sawpit")).toBe(0); // off the books
    expect(room()).toBe(2); // and the ground is free again
  });

  it("holds that ground for the whole of its decay — a hold, not a sterilising", () => {
    // The oracle is written out rather than asked of the code ([testing.md]): the
    // gap between the two thresholds IS how long the ground is held, so this
    // moves when the ladder is tuned and breaks when the ladder is rewired.
    const town = presidio({ population: 400, wealth: 4000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);

    town.population = 4;
    let decayedOn = -1;
    let ruinedOn = -1;
    for (let i = 1; i <= 2 * SEASONS_TO_RUIN; i++) {
      const day = DAY0 + i * SEASON;
      stepSeason(town, day);
      if (decayedOn < 0 && pit.condition === "decayed") decayedOn = day;
      if (ruinedOn < 0 && pit.condition === "ruin") ruinedOn = day;
    }
    expect(decayedOn).toBeGreaterThan(0);
    expect(ruinedOn).toBeGreaterThan(decayedOn);
    // Both dates are days now, so the gap IS the difference between the two
    // thresholds — no conversion, and nothing to get wrong in one.
    expect(ruinedOn - decayedOn).toBe(DECAY.decayedToRuin - DECAY.idleToDecayed);
  });
});

describe("the weather coming down the same ladder", () => {
  // [HC-34] / [HC-35]. Damage is the EVENT half of [HC-6] and lands the day it
  // happens; it uses the ladder that was already there rather than a second one
  // of its own. Nothing here knows what a storm is: `damageWorks` is handed a
  // count, a count and a roll, which is [HC-33] as a signature ([P-17b]).

  // A place with plenty on its ledger to hit, so a claim about WHICH work is hit
  // is not really a claim about there being only one.
  const stocked = (): Town => {
    const town = presidio({ population: 900, wealth: 40000 });
    for (const kind of ["sawpit", "warehouse", "caneField", "battery", "tavern"] as const) {
      raise(town, kind, DAY0);
    }
    stepSeason(town, DAY0);
    return town;
  };

  const countBy = (town: Town, c: Work["condition"]) => town.works.filter((w) => w.condition === c).length;

  it("takes a work down one grade at a time, and never straight to ruin", () => {
    // The ladder is `working -> idle -> decayed -> ruin`. A drop walks it; only
    // the extreme tail writes the bottom rung, and it is counted separately.
    const town = stocked();
    const working = countBy(town, "working");
    damageWorks(town, 1, 0, 0.5, DAY0 + 1);
    expect(countBy(town, "working")).toBe(working - 1);
    expect(countBy(town, "idle")).toBe(1);
    expect(countBy(town, "ruin")).toBe(0);

    // ...and a second blow on the same work takes it one further, not two.
    const knocked = town.works.find((w) => w.condition === "idle")!;
    damageWorks(town, 1, 0, 0.5, DAY0 + 2);
    expect(knocked.condition).toBe("decayed");
    expect(countBy(town, "ruin")).toBe(0);
  });

  it("stops a drop at decayed, because the rung below it is the one the storm may not write", () => {
    // [HC-34]: "it never skips to ruin". A decayed work is skipped by a DROP
    // altogether — there is nothing the weather can do to it short of the tail —
    // and the drop moves on to whatever stands next to it on the ledger.
    const town = stocked();
    for (const w of town.works) {
      w.condition = "decayed";
      w.idleSinceDay = DAY0;
    }
    damageWorks(town, 2, 0, 0.0, DAY0 + 1);
    expect(countBy(town, "ruin")).toBe(0);
    expect(countBy(town, "decayed")).toBe(town.works.length);
  });

  it("destroys exactly one work per contact, however hard it blows", () => {
    // [HC-35], and it is the rule that keeps razing and weather different kinds
    // of thing: razing is deliberate and wholesale, the storm is random and
    // singular. A town can lose its quay to the sea; it cannot lose its town.
    for (const pick of [0, 0.17, 0.4, 0.61, 0.83, 0.99]) {
      const town = stocked();
      damageWorks(town, 2, 5, pick, DAY0 + 1); // five asked for, one taken
      expect(countBy(town, "ruin")).toBe(1);
    }
  });

  it("takes what it finds, and a different work when it finds a different one", () => {
    // The victim is a derived roll, not a rule about worth: the sea does not pick
    // out the most valuable shed. Two different rolls on the same ledger must be
    // able to land on two different works, or the roll is decoration.
    const hit = new Set<number>();
    for (const pick of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      const town = stocked();
      damageWorks(town, 1, 0, pick, DAY0 + 1);
      hit.add(town.works.find((w) => w.condition === "idle")!.id);
    }
    expect(hit.size).toBeGreaterThan(2);
  });

  it("leaves a ruin alone, because there is nothing left in it to take", () => {
    const town = stocked();
    for (const w of town.works) {
      w.condition = "ruin";
      w.idleSinceDay = DAY0;
    }
    damageWorks(town, 2, 1, 0.5, DAY0 + 1);
    expect(countBy(town, "ruin")).toBe(town.works.length);
  });

  it("does nothing at all to a place with nothing on its ledger", () => {
    const town = presidio({ population: 0, wealth: 0 });
    expect(() => damageWorks(town, 2, 1, 0.999, DAY0)).not.toThrow();
    expect(town.works).toEqual([]);
  });

  // THE KAN-108 INTERACTION, and it is the reason that ticket lands in this one.
  // The ladder was made two-way yesterday; a storm-damaged work therefore has a
  // repair path and a governor who can pay for it. A DESTROYED one does not, and
  // that difference is the whole distinction between damage and destruction.
  it("leaves a storm-damaged work mendable, and a destroyed one past saving", () => {
    const town = stocked();
    const pit = town.works.find((w) => w.kind === "sawpit")!;
    const yard = town.works.find((w) => w.kind === "warehouse")!;

    // Knocked twice: `working -> idle -> decayed`, which is the rung a mend buys
    // its way off.
    pit.condition = "decayed";
    pit.idleSinceDay = DAY0;
    expect(mendable(town, pit)).toBe(true);

    yard.condition = "ruin";
    yard.idleSinceDay = DAY0;
    expect(mendable(town, yard)).toBe(false);
  });

  it("puts a storm-damaged work back to work when the governor pays for it", () => {
    // End to end through the ladder both ways: the sea knocks it down, the coin
    // buys one rung, the hands take the last step.
    const town = presidio({ population: 400, wealth: 40000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    expect(pit.condition).toBe("working");

    // Two contacts, both starting at the head of the ledger — which is the
    // sawpit, because it was raised before anything else stood here.
    expect(town.works[0]).toBe(pit);
    damageWorks(town, 1, 0, 0, DAY0 + 1);
    damageWorks(town, 1, 0, 0, DAY0 + 2);
    expect(pit.condition).toBe("decayed");
    expect(mendable(town, pit)).toBe(true);

    const mended = stepTownSeason(town, DAY0 + SEASON);
    expect(built(mended.decided)?.work).toBe(pit);
    expect(pit.condition).toBe("idle");
    stepTownSeason(town, DAY0 + 2 * SEASON);
    expect(pit.condition).toBe("working");
  });

  it("gives the same world the same damage, whatever order the places were walked", () => {
    // [HC-10]: the roll is derived, so nothing about it depends on who went
    // first. Two identical ledgers, the same numbers in, the same wreck out.
    const a = stocked();
    const b = stocked();
    for (const pick of [0.11, 0.62, 0.34]) {
      damageWorks(a, 2, 1, pick, DAY0 + 1);
      damageWorks(b, 2, 1, pick, DAY0 + 1);
    }
    expect(b.works.map((w) => w.condition)).toEqual(a.works.map((w) => w.condition));
  });
});

describe("the chains are cut — goods survive, chains do not", () => {
  // The four 2026-09-19 decisions, and §2.12's opening line. `timber -> sawpit
  // -> planks -> shipway` is what went; timber is still a real thing that moves
  // on real ships and fetches a local price. A `shipway` is now a HARBOUR WORK
  // on a roadstead, in the family of the warehouse and the customs house.
  //
  // THE OLD CLAIM HERE WAS "stands the shipways idle for want of planks", AND IT
  // IS RETIRED RATHER THAN REWRITTEN. Deleting the edge deletes the sentence: the
  // mechanism that carried it is gone, what argues in its place is the market
  // term arguing in coin, and a survivor faked out of a different mechanism
  // would be worse than an honest deletion. What replaces it below is the
  // OPPOSITE claim — a shipway needs no sawpit at all.

  it("lays down a shipway with not one sawpit in the town", () => {
    const town = mixedTown({ population: 600, wealth: 9000 });
    expect(town.works.some((w) => w.kind === "sawpit")).toBe(false);
    const ways = raise(town, "shipway", DAY0);
    expect(ways).not.toBeNull();
    stepSeason(town, DAY0);
    expect(ways!.condition).toBe("working");
  });

  it("keeps the shipways working after every sawpit in the town is a ruin", () => {
    // The going-down half of the same claim, because the old rule bit HERE — a
    // work whose supplier died went idle in the allocator, every season, for
    // ever. Claim a reversible process in both directions, and a deleted one in
    // both directions too.
    const town = mixedTown({ population: 600, wealth: 9000 });
    const pit = raise(town, "sawpit", DAY0)!;
    const ways = raise(town, "shipway", DAY0)!;
    stepSeason(town, DAY0);
    expect(ways.condition).toBe("working");

    pit.condition = "ruin"; // the planks stop, and it no longer matters
    stepSeason(town, DAY0 + SEASON);

    expect(ways.condition).toBe("working");
  });

  it("carries no supplier edge anywhere in the catalogue", () => {
    // The structural half: `requires` is DELETED from the work definition, so
    // there is no field for a third edge to arrive in. Checkable by the shape of
    // the struct, which is the cheapest kind of test there is.
    for (const kind of CAPITAL.concat(SUBSISTENCE)) {
      expect(Object.keys(CATALOGUE[kind]), `${kind} still carries a supplier`).not.toContain("requires");
    }
  });
});

describe("the catalogue may grow and the menu may not", () => {
  // §2.12.12. THE WORK SURVIVES; THE MENU CHOICE DIES. A focus expression is
  // still raised, priced, gated and rotted like any other capital work — what it
  // is not is a thing a governor picks off a list.
  //
  // RENAMED FROM "twelve capital works resolve three and eight" (KAN-126), and
  // the rename is the point rather than housekeeping: the old name pinned the
  // arithmetic of one moment, and the very next story added two works. The claim
  // that outlives the counts is the one §2.12.14 calls the structural argument
  // for this whole direction — THE CATALOGUE CAN GROW AND THE CHOICE CANNOT.

  it("offers the governor eight works and no crop among them", () => {
    // THE ORACLE IS WRITTEN OUT rather than read back off the catalogue, because
    // a list derived from the code under test would agree with whatever the code
    // happened to say.
    expect(CHOOSABLE.slice().sort()).toEqual(
      ["barracks", "battery", "church", "customsHouse", "palisade", "shipway", "tavern", "warehouse"],
    );
    // FIVE NOW, and the two newcomers are KAN-126's: `grainFields` and
    // `cottonWalk` arrived as focus expressions (§2.12.14) so that the ground
    // the world paints could finally be worked without the menu lengthening.
    expect(FOCUS_EXPRESSIONS.slice().sort()).toEqual(
      ["caneField", "cottonWalk", "grainFields", "provisionGround", "sawpit"],
    );
    expect(CAPITAL.length).toBe(13); // eleven before KAN-126; the boiling house is still gone
  });

  it("let the catalogue grow by two without lengthening the governor's list by one", () => {
    // THE STRUCTURAL CLAIM, and it should not rest on anybody's reading of the
    // code. §2.12.14: "that is the structural argument for this direction over
    // any alternative that adds works — it is the only one where the catalogue
    // can grow and the choice cannot."
    //
    // It holds because `CHOOSABLE` is DERIVED from the catalogue's own columns
    // rather than listed beside it: a capital work that names a produce is what
    // a focus on that ground IS, so it can never reach the menu. The claim is
    // therefore about the mechanism and not about today's arithmetic — the two
    // works that landed are counted, and the menu is asserted not to have moved.
    expect(CAPITAL.length - CHOOSABLE.length).toBe(FOCUS_EXPRESSIONS.length);
    expect(CHOOSABLE.length).toBe(8);
    for (const kind of CHOOSABLE) {
      expect(CATALOGUE[kind].produces, `${kind} grows something and is still on the menu`).toBeNull();
    }
  });

  it("gives every produce a work can make a cargo class, so nothing is quaysided by accident", () => {
    // §2.12.13, and the failure it guards is silent rather than loud. A work
    // whose produce has no row in `PRODUCE_CLASS` reads as having NO CARGO CLASS
    // — which is the customs house's case, "a cut of the traffic on access
    // alone" — so a missing row would not throw, it would quietly pay a farm a
    // harbourmaster's wage. Salt has no row ON PURPOSE (§2.12.15) and this claim
    // is what keeps that safe: nothing in the catalogue produces salt, so the
    // missing row is unreachable rather than a hole, and the day a salt works
    // arrives this goes red instead of the world going strange.
    for (const kind of CAPITAL.concat(SUBSISTENCE)) {
      const p = CATALOGUE[kind].produces;
      if (p === null) continue;
      expect(cargoOf(kind), `${kind} produces ${p} and has no cargo class`).not.toBeNull();
    }
    expect(PRODUCE_CLASS.salt, "salt has a class, and §2.12.15 defers it").toBeUndefined();
  });

  it("makes every work that grows something put a figure in the column its class names", () => {
    // §2.12.13, both directions, AND THE RULE THAT DECIDES THE COLUMN CHANGED
    // UNDER IT (KAN-137). It used to be the cargo CLASS — victuals in `food`,
    // materials and luxury in `trade`. It is now the work's CLASS: a free
    // subsistence work feeds the town and writes `food`; a capital work stands
    // on a tile, ships everything it makes and writes `trade`, whatever it
    // grows. A work that names a produce and leaves its column at nothing is a
    // farm that grows nothing, and it would be silent.
    //
    // THIS IS THE STORY'S OWN NAMED HAZARD, and it earned a claim by surviving a
    // mutation. §2.12.12's `expressionFor` stops at the first produce the
    // catalogue can express, so the day `grainFields` exists TILLED GROUND STOPS
    // RAISING PROVISION GROUNDS AND STARTS RAISING GRAIN — and if grain fields
    // shipped nothing, every town founded on tilled ground would quietly lose
    // its crop. Setting `grainFields.food` to zero broke ONE claim in the whole
    // suite, and an incidental one, because the hamlet floor's garden plots kept
    // every place standing while it shrank. A place that shrinks quietly is
    // exactly what a suite cannot see.
    for (const kind of CAPITAL.concat(SUBSISTENCE)) {
      if (cargoOf(kind) === null) continue;
      const def = CATALOGUE[kind];
      const column = def.cls === "subsistence" ? def.food : def.trade;
      expect(column, `${kind} grows ${def.produces} and ships none of it`).toBeGreaterThan(0);
    }
  });

  it("gives no capital work a food column at all, because a tile feeds nobody", () => {
    // KAN-137, and the rule stated where it cannot be forgotten: *"The tiles are
    // separate from the town's running. Fields don't add to their running stores
    // — just boosts trade."* Everything a town eats comes off the two free huts
    // the hamlet floor raises, or off a ship.
    //
    // IT IS THE SHARPER SIBLING OF THE CLAIM ABOVE. That one says a work ships
    // what it grows; this one says WHERE, and between them there is no column
    // left for a governor's farm to feed its own town out of.
    for (const kind of CAPITAL) {
      expect(CATALOGUE[kind].food, `${kind} feeds the town off its own tile`).toBe(0);
    }
  });

  it("spoils a victuals cargo with the same storm that spoils a timber one", () => {
    // WHAT REPLACED "a victuals work never carries a trade column" (§2.12.13's
    // second consequence), and the replacement is arithmetic rather than a rule.
    // `commerceOf` used to scale ranks 1 and 2 by the harvest AFTER the fact,
    // because rank 0 arrived pre-scaled off `derive` — so a victuals figure in a
    // `trade` column would have been cargo no storm could touch, and the
    // catalogue was forbidden one. KAN-137 puts grain and provisions in exactly
    // that column, so the scaling moved INTO `producedOf` where every rank gets
    // it once, and the claim is now that the storm reaches all three.
    //
    // ASSERTED WITH THE LOUDEST MEMBER (testing.md): a grain field at 50 on
    // ideal ground, beside a sawpit, so a mutation that scaled only the old two
    // ranks fails on the victuals rank and nowhere else.
    const town = mixedTown({ population: 600, wealth: 30000 });
    town.regions[0].focus = "production";
    raise(town, "grainFields", DAY0, town.regions[0]);
    raise(town, "sawpit", DAY0);
    stepSeason(town, DAY0);

    const fair = derive(town).commerce.produced;
    town.harvestLoss = 0.5;
    const spoiled = derive(town).commerce.produced;

    expect(fair[0]).toBeGreaterThan(0);
    expect(fair[1]).toBeGreaterThan(0);
    expect(spoiled[0]).toBeLessThan(fair[0]); // the grain
    expect(spoiled[1]).toBeLessThan(fair[1]); // ...and the timber beside it
  });

  it("has no boiling house left to build", () => {
    // Deleted, folded into DEPTH. Its luxury is carried by the deepened cane
    // region, and the label ladder is what says so.
    expect(Object.keys(CATALOGUE)).not.toContain("boilingHouse");
  });

  it("names no work the catalogue has not got a row for", () => {
    // [HC-91], KAN-135. `WorkKind` is `keyof typeof` the catalogue's own rows
    // now, so a kind with no row is UNWRITABLE — the compiler makes that claim,
    // and no runner can see a claim the compiler makes. (What it looks like when
    // it bites: renaming one row's key puts the old spelling out of the union
    // and `tsc` names every line that still uses it.)
    //
    // WHAT A TEST CAN STILL SEE IS THE ONE TABLE THE TYPE DOES NOT REACH.
    // `WORKS.subsistenceAt` is keyed `Partial<Record<string, number>>`, because
    // `constants.ts` deliberately imports nothing from the module it tunes — so
    // a stale or misspelt kind in it is invisible to the compiler AND silent at
    // runtime: `raiseSubsistence` reads `?? 0` and draws the hut up in a village
    // of nobody.
    for (const kind of Object.keys(WORKS.subsistenceAt)) {
      expect(Object.keys(CATALOGUE), `${kind} has a threshold and no catalogue row`).toContain(kind);
    }
    // ...and the same table read the other way, which is the liveness guard the
    // loop above needs: an EMPTY table satisfies it. A self-raising work with
    // neither a threshold nor an `autoPer` appears in a town of nobody, which is
    // the hamlet floor raising works for souls that are not there.
    for (const kind of SUBSISTENCE) {
      if (CATALOGUE[kind].autoPer) continue;
      expect(WORKS.subsistenceAt[kind], `${kind} raises itself at no named size`).toBeGreaterThan(0);
    }
  });

  it("knows a focus expression by the ground it stands on, never by a list", () => {
    // [P-47]: the catalogue's own `produces` column already answers "does this
    // work stand on what the ground bears", and a second list beside it would be
    // the half that gets forgotten the day somebody adds a quarry.
    for (const kind of CAPITAL) {
      expect(isFocusExpression(kind), `${kind} answered the wrong way`).toBe(CATALOGUE[kind].produces !== null);
    }
  });

  it("caps a focus expression by the ground and a menu work by the town", () => {
    // KAN-125'S TUNING ANSWER. `max` is a PER-KIND, PER-TOWN limit, and after
    // KAN-124 every depth-9 region on the warm world hit it rather than running
    // out of hexes — a per-town number standing in front of a per-region rule.
    // [HC-94] says the cap is AREA, so a second cap beside it is [P-47]'s second
    // source for one fact.
    for (const kind of FOCUS_EXPRESSIONS) expect(CATALOGUE[kind].max).toBe(Infinity);
    for (const kind of CHOOSABLE) expect(CATALOGUE[kind].max).toBeLessThan(Infinity);
  });

  it("lets one roadstead carry a warehouse and a customs house and a shipway", () => {
    // [HC-94]'S CAPACITY RULE EXEMPTS SITED WORKS, and the loose wording is the
    // trap: written as "any capital work on the region", a roadstead would carry
    // a warehouse OR a customs house OR a shipway, because all three would be
    // spending one region's token allowance between them. The filter is A
    // CAPITAL WORK STANDING ON WHAT THE GROUND BEARS — and a roadstead bears
    // nothing at all, so none of the three is ever what that ground is FOR.
    const town = townOf(
      [reg(0, "roadstead", RING1.slice(0, 4)), reg(1, "scrub", RING2.slice(0, 6))],
      { population: 900, wealth: 900000 },
    );
    expect(raise(town, "warehouse", DAY0), "the warehouse").not.toBeNull();
    expect(raise(town, "customsHouse", DAY0), "the customs house").not.toBeNull();
    expect(raise(town, "shipway", DAY0), "the shipway").not.toBeNull();
    expect(town.works.filter((w) => w.region === 0).length).toBe(3);
    expect(depthOf(town, 0)).toBe(0); // ...and the ground's purpose is still an open question
    expect(town.regions[0].focus).toBeNull(); // nobody had to decide anything to get a quay
  });

  it("works a region past nine of one kind, which the catalogue used to forbid", () => {
    // The rule seen from the outside, on ground big enough to show it: the
    // ground is what stops him rather than the number nine. The oracle is the
    // region's own free area, written out rather than read back.
    const town = townOf(
      [reg(0, "timberedHills", RING1.concat(RING2.slice(0, 6)), { bears: { timber: "ideal" }, focus: "production" })],
      { population: 4000, wealth: 400000 },
    );
    const area = capacityOf(town, town.regions[0]);
    expect(area).toBeGreaterThan(9);
    let n = 0;
    while (raise(town, "sawpit", DAY0, town.regions[0]) !== null) n++;
    expect(n).toBe(area);
  });
});

describe("the label ladder", () => {
  // §2.12.12, and §7's contracts 3 and 9 said in words instead of drawn: works of
  // one kind on one region are ONE INSTALLATION SIZED BY COUNT. The ladder is
  // that rule's prose twin, so it adds no machinery and NO STORED STATE.

  it("names sawpits sawpits until they are a mill and its yards", () => {
    expect(installationLabel("sawpit", 1)).toBe("sawpits");
    expect(installationLabel("sawpit", WORKS.ladderAt - 1)).toContain("sawpits");
    expect(installationLabel("sawpit", WORKS.ladderAt)).toBe("a mill and its yards");
    expect(installationLabel("sawpit", WORKS.ladderAt + 4)).toBe("a mill and its yards");
  });

  it("gives the deepened cane its boiling house, which is where the boiling house went", () => {
    expect(installationLabel("caneField", 1)).toBe("cane fields");
    expect(installationLabel("caneField", WORKS.ladderAt)).toBe("cane fields and a boiling house");
  });

  it("says how much of it there is below the threshold, in numbers", () => {
    // Below the rung the COUNT says how much; at it, the WORDS do, and a count
    // beside them would be the same fact twice.
    expect(installationLabel("sawpit", 3)).toBe("sawpits ×3");
    expect(installationLabel("warehouse", 2)).toBe("a warehouse ×2");
  });

  it("leaves a kind with no rung counting, rather than inventing it a name", () => {
    // §2.12.12 ratifies exactly two rungs — the sawpits and the cane. A third
    // would be designing rather than building, and the threshold itself is
    // deferred (§2.12.15). A kind with no rung keeps its own name however deep
    // the ground goes, and goes on saying how much of it there is in numbers.
    expect(installationLabel("provisionGround", 8)).toBe("provision grounds ×8");
    expect(installationLabel("battery", 8)).toBe("a stone battery ×8");
  });

  it("stores nothing — the same ground reads deeper and nothing was written down", () => {
    // THE CLAIM THAT MATTERS ([HC-93]): the ladder is a reading, taken when
    // somebody asks. Raise works one at a time and the label climbs; nothing on
    // the town or on any work ever holds it, and every ledger line keeps the name
    // it was minted with.
    const town = townOf(
      [reg(0, "timberedHills", RING1.concat(RING2.slice(0, 6)), { bears: { timber: "ideal" }, focus: "production" })],
      { population: 4000, wealth: 400000 },
    );
    const seen: string[] = [];
    for (let i = 0; i < WORKS.ladderAt; i++) {
      raise(town, "sawpit", DAY0, town.regions[0]);
      seen.push(installationLabel("sawpit", depthOf(town, 0)));
    }
    expect(seen[0]).toBe("sawpits");
    expect(seen[seen.length - 1]).toBe("a mill and its yards");
    for (const w of town.works) expect(w.name).toBe(CATALOGUE[w.kind].label);
    expect(JSON.stringify(town)).not.toContain("mill and its yards");
  });
});

describe("the two gates on the ground", () => {
  it("will not plant cotton on bedrock", () => {
    const town = townOf([reg(0, "rockyGround", RING1, { bears: { stone: "ideal" } })], {
      population: 300,
      wealth: 9000,
    });
    expect(buildable(town, "caneField")).toBe(false); // nothing here bears cane
  });

  it("plants barley where cotton would have been ideal, and pays for it", () => {
    // Terrain BIASES a crop; it does not determine it. Ground that grudges a work
    // still takes it — visibly worse, which is adaptability with a price.
    const ideal = townOf([reg(0, "caneFlats", RING1, { bears: { cane: "ideal" } })], {
      population: 300,
      wealth: 9000,
    });
    const grudging = townOf([reg(0, "caneFlats", RING1, { bears: { cane: "poor" } })], {
      population: 300,
      wealth: 9000,
    });

    expect(buildable(grudging, "caneField")).toBe(true); // offered, not refused
    const good = raise(ideal, "caneField", DAY0)!;
    const poor = raise(grudging, "caneField", DAY0)!;
    expect(poor.trade).toBeLessThan(good.trade);
  });

  it("refuses a sited work outright without its exact ground", () => {
    // You cannot half-build a harbour on a hill: a sited work gets no gradient.
    const inland = townOf([reg(0, "timberedHills", RING1, { bears: { timber: "ideal" } })], {
      population: 300,
      wealth: 9000,
    });
    expect(buildable(inland, "warehouse")).toBe(false);

    const coastal = mixedTown({ population: 300, wealth: 9000 });
    expect(buildable(coastal, "warehouse")).toBe(true);
  });

  it("runs out of ground before it runs out of ambition", () => {
    // AREA IS CAPACITY — the land is the cap, not an arbitrary number. Since
    // KAN-124 the area is what a PRODUCTION FOCUS buys ([HC-94]): the ground
    // below has been given over, so it may be worked to its free area and then
    // it is spent. Nothing but the hexes decides where that is.
    const town = townOf(
      [reg(0, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" }, focus: "production" })],
      { population: 900, wealth: 90000 },
    );
    const hills = town.regions[0];
    const room = () => roomInRegion(town, hills, 0, "sawpit", "deepen", takenHexes(town));
    expect(room()).toBe(2);

    raise(town, "sawpit", DAY0); // the auction's one token work...
    raise(town, "sawpit", DAY0, hills); // ...and the deepening fills the rest
    expect(room()).toBe(0);
    expect(raise(town, "sawpit", DAY0, hills)).toBeNull();
    expect(countOf(town, "sawpit")).toBe(2);
  });
});

describe("ground out of the town's way", () => {
  it("costs more men and yields less than the same work at hand", () => {
    const near = townOf([reg(0, "timberedHills", RING1, { bears: { timber: "ideal" }, reach: "atHand" })], {
      population: 300,
      wealth: 9000,
    });
    const far = townOf([reg(0, "timberedHills", RING1, { bears: { timber: "ideal" }, reach: "far" })], {
      population: 300,
      wealth: 9000,
    });

    const atHand = raise(near, "sawpit", DAY0)!;
    const overTheRidge = raise(far, "sawpit", DAY0)!;

    expect(overTheRidge.hands).toBeGreaterThan(atHand.hands);
    expect(overTheRidge.trade).toBeLessThan(atHand.trade);
  });

  it("gives the last hands to the elder of two equal works, whichever way the ledger is written", () => {
    // [P-10]: two sawpits on the same ground are worth exactly the same, so
    // without an explicit tie-break which of them keeps its men is decided by
    // however the ledger happens to be arranged. The stated direction is the
    // ELDER WORK FIRST.
    // TWO REGIONS OF IDENTICAL GROUND SINCE KAN-124, and the fixture had to
    // move: rising returns mean two sawpits on the SAME ground are no longer
    // worth the same (§2.12.5), so the tie this claim is about would not have
    // been a tie any more. One work on each of two identical stretches is worth
    // exactly the same again — both are the first thing on their own hill.
    const run = (reversed: boolean) => {
      const town = townOf(
        [
          reg(0, "timberedHills", RING1.slice(0, 1), { bears: { timber: "ideal" } }),
          reg(1, "timberedHills", RING1.slice(1, 2), { bears: { timber: "ideal" } }),
        ],
        { population: 400, wealth: 9000 },
      );
      const elder = raise(town, "sawpit", DAY0)!;
      const younger = raise(town, "sawpit", DAY0)!;
      if (reversed) town.works.reverse();
      town.population = 22; // hands enough for one of them, and not for two
      stepSeason(town, DAY0);
      return { elder: elder.condition, younger: younger.condition };
    };

    expect(run(true)).toEqual(run(false));
    expect(run(false).elder).toBe("working");
    expect(run(false).younger).toBe("idle");
  });

  it("is the first to go idle when hands are short", () => {
    const town = townOf(
      [
        reg(0, "timberedHills", RING1.slice(0, 3), { bears: { timber: "ideal" }, reach: "atHand" }),
        reg(1, "caneFlats", RING1.slice(3, 6), { bears: { cane: "ideal" }, reach: "far" }),
      ],
      { population: 400, wealth: 9000 },
    );
    const atHand = raise(town, "sawpit", DAY0)!;
    const overTheRidge = raise(town, "caneField", DAY0)!;
    stepSeason(town, DAY0);

    town.population = 30; // barely anyone left
    stepSeason(town, DAY0 + SEASON);

    expect(overTheRidge.condition).toBe("idle");
    expect(atHand.condition).toBe("working");
  });
});

describe("what the town wants", () => {
  it("stops arguing for a want once something answers it", () => {
    // Stays off `food` deliberately — that need is being rebased from hunger to
    // dependency by the trading engine (§3.5.4, [HC-81]).
    const town = mixedTown({ population: 50, wealth: 9000 });
    expect(unmetNeeds(town).drink).toBe(1);

    raise(town, "tavern", DAY0);
    stepSeason(town, DAY0);

    expect(unmetNeeds(town).drink).toBe(0); // a tavern serving more souls than there are
  });

  it("never reports a want as more than wholly unmet", () => {
    const town = mixedTown({ population: 1, wealth: 0 });
    const needs = unmetNeeds(town);
    for (const v of Object.values(needs)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("reproducibility", () => {
  // testing.md: "Every module gets a reproducibility test: same seed and same
  // steps produce the same result." Not box-ticking — this is what catches a
  // hidden clock read, a Set/Map iteration dependency, or an accumulation whose
  // order changed under a refactor ([P-9]).
  it("gives the same ledger from the same start and the same steps", () => {
    const a = mixedTown({ population: 350, wealth: 5000 });
    const b = mixedTown({ population: 350, wealth: 5000 });
    for (let i = 0; i < 200; i++) { stepSeason(a, DAY0 + i * SEASON); stepSeason(b, DAY0 + i * SEASON); }
    expect(b).toEqual(a);
  });

  it("does not depend on the order the works were entered in the ledger", () => {
    const build = (reversed: boolean) => {
      const t = mixedTown({ population: 600, wealth: 20000 });
      raise(t, "sawpit", DAY0);
      raise(t, "caneField", DAY0);
      raise(t, "tavern", DAY0);
      if (reversed) t.works.reverse();
      stepSeasons(t, 40, DAY0);
      return t.works.map((w) => `${w.kind}:${w.condition}`).sort();
    };
    expect(build(true)).toEqual(build(false));
  });
});

// ---- [HC-94] A focus buys CAPACITY, never a multiplier ----------------------
//
// §2.12.4. Unfocused ground carries a TOKEN work — "there is timber over the
// ridge; they take what they need of it" — and never becomes an industry. Ground
// somebody gave over to production may be worked to its free area, so the
// focused-to-unfocused ratio is AREA: the founding roll's own variance, which
// nobody tuned.

// Ground of a named size, and whatever purpose somebody has put on it. The two
// axes this rule turns on are FOCUS and AREA, so the fixture varies exactly
// those two and nothing else.
const hillsOf = (hexes: Axial[], focus: RegionFocus): Town =>
  townOf([reg(0, "timberedHills", hexes, { bears: { timber: "ideal" }, focus })], {
    population: 900, // souls enough that nothing here is about manning
    wealth: 900000, // ...nor about coin: this is the GROUND's answer
  });

// Work the ground for all it is worth: the auction's one token work, and then
// the deepening door until the region refuses. The loop is bounded, because a
// test that hangs is worse than a test that fails.
function worked(town: Town): number {
  raise(town, "sawpit", DAY0);
  for (let i = 0; i < 99; i++) if (!raise(town, "sawpit", DAY0, town.regions[0])) break;
  return countOf(town, "sawpit");
}

describe("a focus buys capacity, and the ratio is area", () => {
  it("grows an industry on ground given over, and takes a token work off ground nobody decided", () => {
    // THE RULE, in one claim. The two towns differ in exactly one respect —
    // whether anybody ever said what the hills were for — so nothing but the
    // focus can explain the difference between them.
    const decided = hillsOf(RING2.slice(0, 6), "production");
    const nobodys = hillsOf(RING2.slice(0, 6), null);

    expect(worked(decided)).toBeGreaterThan(1); // an industry
    expect(worked(nobodys)).toBe(1); // ...and a hamlet taking what it needs
  });

  it("stops at the region's own free area, and that is the whole of the cap", () => {
    // [HC-75]'s terminating condition, stated on the ground rather than in the
    // premium. The oracle is written out — the region's unclaimed hexes — rather
    // than read back out of `roomInRegion` (testing.md, "write the oracle out").
    const town = hillsOf(RING2.slice(0, 6), "production");
    const area = capacityOf(town, town.regions[0]);
    expect(worked(town)).toBe(area);
    expect(depthOf(town, 0)).toBe(area);
    expect(raise(town, "sawpit", DAY0, town.regions[0])).toBeNull();
  });

  it("reaches a different depth on a bigger stretch of the same ground", () => {
    // world-simulation.md §10.7's acceptance, verbatim: two towns with the SAME
    // focus on differently-sized regions produce different depths — and the
    // difference is the area. Same terrain, same grade, same purse.
    const small = hillsOf(RING1.slice(0, 3), "production");
    const large = hillsOf(RING2.slice(0, 9), "production");

    // THE ORACLE IS READ BEFORE THE GROUND IS WORKED, and since KAN-134 it has
    // to be: capacity counts the works standing on a region, so asking it after
    // the sawpits are in gives zero on both towns and the claim asserts 0 === 0.
    // The area it means is the area a governor had to spend.
    const room = capacityOf(large, large.regions[0]) - capacityOf(small, small.regions[0]);

    const shallow = worked(small);
    const deep = worked(large);
    expect(deep).toBeGreaterThan(shallow);
    expect(deep - shallow).toBe(room);
  });

  it("keeps a region's depth OUT of the struct — it is counted, never stored", () => {
    // [HC-93], and it is the cheapest kind of test there is: the shape of the
    // struct. A development integer would break [HC-14] (a derived quantity
    // stored is free to drift from its explanation) and §7's work-visibility
    // requirement at the same time — a number has no lumber mill in it to see.
    const town = hillsOf(RING2.slice(0, 6), "production");
    worked(town);
    expect(depthOf(town, 0)).toBeGreaterThan(1);
    expect(Object.keys(town.regions[0]).sort()).toEqual(
      ["bearing", "bears", "focus", "hexes", "id", "reach", "sweetSpot", "terrain"],
    );
  });
});

describe("rising returns, minted at raise time", () => {
  // §2.12.5. The Nth work on a region is worth more than the first — a second
  // sawpit shares a track, a pond and a crew; a fifth is a works.

  it("makes the fifth sawpit worth more than the first", () => {
    const town = hillsOf(RING2.slice(0, 9), "production");
    worked(town);
    const pits = town.works.filter((w) => w.kind === "sawpit");
    expect(pits.length).toBeGreaterThanOrEqual(5);
    expect(pits[4].trade).toBeGreaterThan(pits[0].trade);
    // ...and it rises all the way up rather than stepping once.
    for (let i = 1; i < pits.length; i++) expect(pits[i].trade).toBeGreaterThan(pits[i - 1].trade);
  });

  it("never re-prices a work that is already standing", () => {
    // The whole reason §2.12.4 refuses a multiplier: a work STORES its scaled
    // yields at the moment it is raised, so a dial applied later would be true of
    // new rows and false of old ones. Nothing that happens afterwards — more
    // works beside it, the ground filling up — may touch what already stands.
    const town = hillsOf(RING2.slice(0, 9), "production");
    raise(town, "sawpit", DAY0);
    const first = town.works.find((w) => w.kind === "sawpit")!;
    const was = { food: first.food, trade: first.trade, hands: first.hands, servesFor: first.servesFor };

    for (let i = 0; i < 99; i++) if (!raise(town, "sawpit", DAY0, town.regions[0])) break;

    expect(countOf(town, "sawpit")).toBeGreaterThan(4);
    expect({ food: first.food, trade: first.trade, hands: first.hands, servesFor: first.servesFor }).toEqual(was);
  });

  it("buys yield and not men — a deeper pit is worth more, and wants the same crew", () => {
    // Capital works keep a FLAT hand cost on purpose (see `handsOn`): scaling it
    // would silently falsify the auction's `def.hands <= spare` preview, which
    // reads the CATALOGUE rather than the instance ([P-47]).
    const town = hillsOf(RING2.slice(0, 9), "production");
    worked(town);
    const pits = town.works.filter((w) => w.kind === "sawpit");
    expect(new Set(pits.map((w) => w.hands)).size).toBe(1);
  });

  it("leaves the first work on a region worth exactly what it was before any of this", () => {
    // The premium at depth 0 is exactly 1, and multiplying a double by 1 is
    // exact — so a region nobody has deepened books the identical work it booked
    // before rising returns existed. The oracle is the catalogue times the
    // ground's own scaling, written out here rather than asked of `raise`.
    const town = hillsOf(RING1.slice(0, 3), null);
    const pit = raise(town, "sawpit", DAY0)!;
    expect(pit.trade).toBe(CATALOGUE.sawpit.trade * SUIT_YIELD.ideal);
  });
});

describe("a subsistence work is outside the capacity rule entirely", () => {
  // [HC-98], and its second edge found by KAN-123: a subsistence work is never
  // gated on focus or depth, AND it never makes a region an instance either. A
  // garden plot is never chosen, never priced and never gated, so it claims no
  // purpose for the ground under it.

  it("raises garden plots on ground already worked to its cap", () => {
    const town = hillsOf(RING2.slice(0, 6), "production");
    worked(town);
    expect(raise(town, "sawpit", DAY0, town.regions[0])).toBeNull(); // the ground is spent

    const before = countOf(town, "dwellings");
    stepYears(town, 2);
    expect(countOf(town, "dwellings")).toBeGreaterThanOrEqual(before);
    expect(town.works.some((w) => CATALOGUE[w.kind].cls === "subsistence")).toBe(true);
  });

  it("never spends a region's token work", () => {
    // The second edge, at the ledger. Written literally as "has any work standing
    // on it", the instance filter takes the question of what that ground is FOR
    // permanently away from the governor — measured on the warm world at a median
    // of ONE unfocused live region per place.
    const town = townOf([reg(0, "tilledGround", RING1, { bears: { food: "ideal" } })], {
      population: 200,
      wealth: 90000,
    });
    stepYears(town, 2);
    expect(countOf(town, "gardenPlots")).toBeGreaterThan(0);
    expect(depthOf(town, 0)).toBe(0); // nobody has decided anything about it yet
    expect(raise(town, "provisionGround", DAY0)).not.toBeNull(); // ...so the token work is still there to take
  });
});
