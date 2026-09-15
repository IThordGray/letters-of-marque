// The works ledger — the hamlet floor, the devolution ladder, the two gates on
// what ground will bear, and the one dependency chain the player can feel.
//
// Warranted by [HC-70] (the world layer reopens none of it) and [HC-34] (damage
// moves works down THIS ladder, one grade at a time).

import { describe, it, expect } from "vitest";
import type { Town } from "./types";
import { derive, stepYears, stepSeason, stepSeasons } from "./sim";
import { raise, buildable, roomFor, unmetNeeds, starvedFor, countOf, mendable, repairCost, CATALOGUE } from "./works";
import { stepTownSeason } from "./governor";
import { DECAY } from "./constants";
import { CALENDAR } from "../overworld/calendar";
import { mixedTown, bareTown, townOf, reg, RING1 } from "./fixtures";

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
    expect(mended.built?.work).toBe(pit);
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
    const town = townOf([reg(0, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" } })], {
      population: 900,
      wealth: 90000,
    });
    const pit = raise(town, "sawpit", DAY0)!;
    expect(roomFor(town, "sawpit")).toBe(1);

    pit.condition = "decayed";
    expect(countOf(town, "sawpit")).toBe(1); // still on the books
    expect(roomFor(town, "sawpit")).toBe(1); // still standing on its hex

    pit.condition = "ruin";
    expect(countOf(town, "sawpit")).toBe(0); // off the books
    expect(roomFor(town, "sawpit")).toBe(2); // and the ground is free again
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

describe("the dependency chain", () => {
  it("stands the shipways idle for want of planks", () => {
    const town = mixedTown({ population: 600, wealth: 9000 });
    const pit = raise(town, "sawpit", DAY0)!;
    const ways = raise(town, "shipway", DAY0)!;
    stepSeason(town, DAY0);
    expect(ways.condition).toBe("working");

    pit.condition = "ruin"; // the planks stop
    stepSeason(town, DAY0 + SEASON);

    expect(ways.condition).toBe("idle");
  });

  it("says what the supplier is for, from the downstream work's point of view", () => {
    const town = mixedTown({ population: 600, wealth: 9000 });
    expect(starvedFor(town, "sawpit")).toBe(true); // there is room for shipways
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
    // AREA IS CAPACITY — the land is the cap, not an arbitrary number.
    const town = townOf([reg(0, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" } })], {
      population: 900,
      wealth: 90000,
    });
    const before = roomFor(town, "sawpit");
    expect(before).toBe(2);
    raise(town, "sawpit", DAY0);
    raise(town, "sawpit", DAY0);
    expect(roomFor(town, "sawpit")).toBe(0);
    expect(raise(town, "sawpit", DAY0)).toBeNull();
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
    const run = (reversed: boolean) => {
      const town = townOf([reg(0, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" } })], {
        population: 400,
        wealth: 9000,
      });
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
