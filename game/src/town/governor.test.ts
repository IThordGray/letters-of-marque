// The development plan — the five-term auction, and the rule that the
// explanation IS the score.
//
// [HC-70] keeps all of this out of the world layer's reach, and §8.6 goes
// further: the NATION auction is specified as the same pattern, and cites the
// governor's "fear outbids revenue" by name. So these claims are load-bearing
// twice over.

import { describe, it, expect } from "vitest";
import type { Town } from "./types";
import { scoreWork, reasonFrom, wants, governorTurn, stepTownSeason, stepTownYears } from "./governor";
import { CHOOSABLE, CATALOGUE, raise } from "./works";
import { derive, stepYears, stepSeason } from "./sim";
import { canBuild } from "./trade";
import { PLAN, DECAY } from "./constants";
import { CALENDAR, DAYS_PER_YEAR } from "../overworld/calendar";
import { mixedTown, townOf, reg, RING1, RING2 } from "./fixtures";

// The town keeps no clock (KAN-107): the world hands it the day, and here the
// test plays the world. These fixtures stand on the world's first day.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;

// §5.6's own example — "a presidio of ninety souls". SPRAWL.royalOutpost never
// spills, so the town claims no new ground and no work of its is ever built over:
// what is under test below is the mend decision and nothing else.
const presidio = (init: Partial<Town> = {}): Town => mixedTown({ archetype: "royalOutpost", ...init });

// §3.5.3's own island: a roadstead, scrub, and not one timbered hill. It is the
// only ground on which the materials gate can still be stated since a work that
// PRODUCES materials stopped being gated by them (2026-09-16) — a place with
// hills digs its own pit and is never stone-poor for long.
const stonePoorIsland = (init: Partial<Town> = {}): Town =>
  townOf([reg(0, "roadstead", RING1.slice(0, 3)), reg(1, "scrub", RING2.slice(0, 6))], {
    archetype: "royalOutpost",
    ...init,
  });

// A presidio with one sawpit, already rotted down to `decayed`. Set directly
// rather than starved down the ladder, because what these claims are about is the
// decision to mend it, not the ladder that got it there (works.test.ts covers that).
// It spends the town's first season, so everything after it begins on the second.
const AFTER_ROTTING = DAY0 + SEASON;
function withRottedSawpit(init: Partial<Town> = {}) {
  const town = presidio({ population: 400, wealth: 9000, ...init });
  const pit = raise(town, "sawpit", DAY0)!;
  stepSeason(town, DAY0);
  pit.condition = "decayed";
  pit.idleSinceDay = DAY0;
  return { town, pit };
}

describe("the explanation is the score", () => {
  it("says the two things that actually decided it", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    const ranked = wants(town, DAY0, CHOOSABLE.length);
    expect(ranked.length).toBeGreaterThan(0);

    for (const want of ranked) {
      const top = want.terms.slice(0, 2).map((t) => t.clause);
      for (const clause of top) expect(want.reason).toContain(clause);
    }
  });

  it("never scores a work with a term that says nothing", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      for (const term of scoreWork(town, kind, DAY0)) {
        expect(term.clause.trim()).not.toBe("");
      }
    }
  });

  it("weighs at most the five named terms, and never twice", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      const keys = scoreWork(town, kind, DAY0).map((t) => t.key);
      expect(keys.length).toBeLessThanOrEqual(5);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("ranks its reasons strongest first", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      const weights = scoreWork(town, kind, DAY0).map((t) => t.weight);
      const sorted = [...weights].sort((a, b) => b - a);
      expect(weights).toEqual(sorted);
    }
  });

  it("admits when there is nothing pressing", () => {
    expect(reasonFrom([])).toBe("there is nothing pressing");
  });
});

describe("fear outbids revenue", () => {
  it("wants guns since the burning", () => {
    const calm = mixedTown({ population: 400, wealth: 9000 });
    const burned = mixedTown({ population: 400, wealth: 9000, lastThreatDay: DAY0 });

    const calmFear = scoreWork(calm, "battery", DAY0).find((t) => t.key === "fear")!;
    const burnedFear = scoreWork(burned, "battery", DAY0).find((t) => t.key === "fear")!;

    expect(burnedFear.weight).toBeGreaterThan(calmFear.weight);
    expect(burnedFear.clause).toContain("burning");
    expect(calmFear.clause).not.toContain("burning");
  });

  it("moves a defensive work up the list after a burning", () => {
    const calm = mixedTown({ population: 400, wealth: 9000 });
    const burned = mixedTown({ population: 400, wealth: 9000, lastThreatDay: DAY0 });

    const scoreOf = (t: ReturnType<typeof mixedTown>) =>
      wants(t, DAY0, CHOOSABLE.length).find((w) => w.kind === "battery")?.score ?? 0;

    expect(scoreOf(burned)).toBeGreaterThan(scoreOf(calm));
  });

  it("forgets a burning eventually", () => {
    const town = mixedTown({ population: 400, wealth: 9000, lastThreatDay: DAY0 });
    const fresh = scoreWork(town, "battery", DAY0).find((t) => t.key === "fear")!.weight;
    // Thirty years, and the governor is ASKED on the day thirty years later — the
    // forgetting is the difference between two days, not a counter the town kept.
    const later = 30 * DAYS_PER_YEAR;
    stepYears(town, 30); // long enough that it is no longer fresh
    const then = scoreWork(town, "battery", later).find((t) => t.key === "fear");
    if (then) expect(then.weight).toBeLessThan(fresh);
  });
});

describe("wealth is the budget gate, not a term", () => {
  it("wants the same things whether the coffers are full or bare", () => {
    // The cheapest test in the suite, and it guards a rule that is very easy to
    // break by accident: what a town WANTS must not depend on what it can pay for.
    const rich = mixedTown({ population: 400, wealth: 90000 });
    const broke = mixedTown({ population: 400, wealth: 0 });

    const kindsOf = (t: ReturnType<typeof mixedTown>) => wants(t, DAY0, CHOOSABLE.length).map((w) => w.kind);
    const scoresOf = (t: ReturnType<typeof mixedTown>) => wants(t, DAY0, CHOOSABLE.length).map((w) => w.score);

    expect(kindsOf(broke)).toEqual(kindsOf(rich));
    expect(scoresOf(broke)).toEqual(scoresOf(rich));
  });

  it("marks what it cannot pay for rather than hiding it", () => {
    const broke = mixedTown({ population: 400, wealth: 0 });
    const ranked = wants(broke, DAY0, CHOOSABLE.length);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((w) => w.affordable === false)).toBe(true);
    expect(governorTurn(broke, DAY0)).toBeNull(); // publishes the want, builds nothing
  });
});

describe("there is money and no men", () => {
  it("will not raise what nobody can work", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    const ranked = wants(town, DAY0, CHOOSABLE.length);

    expect(ranked.length).toBeGreaterThan(0); // he still says what he wants
    expect(ranked.every((w) => w.manned === false)).toBe(true);
    expect(governorTurn(town, DAY0)).toBeNull(); // ...and builds none of it
  });

  it("builds again once there are hands for it", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    expect(governorTurn(town, DAY0)).toBeNull();

    town.population = 600;
    expect(governorTurn(town, DAY0)).not.toBeNull();
  });
});

describe("he mends what he can still save", () => {
  // KAN-108. A decayed work is recoverable and recovery costs coin — the spec says
  // every grade is reversible, and a grade that came back for free would make the
  // ladder's middle rung mean nothing. Wealth stays the BUDGET GATE (§5.1): it is
  // asked whether he can start, never whether the town wants it.

  it("puts a rotted work back in order, and says so in its own words", () => {
    const { town, pit } = withRottedSawpit({ governor: "Sarmiento" });
    const done = governorTurn(town, AFTER_ROTTING);
    expect(done).not.toBeNull();
    expect(done!.want).toBeNull(); // a mend has no auction behind it
    expect(done!.work).toBe(pit);
    expect(done!.sentence).toContain("Sarmiento");
    expect(done!.sentence).toContain(pit.name);
    expect(done!.sentence).toContain("back in order");
  });

  it("pays a fraction of what raising the same work anew would cost", () => {
    // The oracle is spelled out rather than asked of `repairCost`, so a term
    // quietly added inside it cannot sail through the test named for it.
    const { town } = withRottedSawpit();
    const before = town.wealth;
    governorTurn(town, AFTER_ROTTING);
    const spent = before - town.wealth;
    expect(spent).toBe(CATALOGUE.sawpit.cost * DECAY.repairShare);
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThan(CATALOGUE.sawpit.cost);
  });

  it("will not mend what nobody can work — money and no men", () => {
    const { town, pit } = withRottedSawpit();
    const before = town.wealth;
    town.population = 3; // the coffers are full and the place is empty

    expect(governorTurn(town, AFTER_ROTTING)).toBeNull();
    expect(pit.condition).toBe("decayed"); // still rotting...
    expect(town.wealth).toBe(before); // ...and not a coin spent on it
  });

  it("will not mend what he cannot pay for", () => {
    const { town, pit } = withRottedSawpit();
    town.wealth = 0; // hands enough, and nothing to pay them with

    expect(governorTurn(town, AFTER_ROTTING)).toBeNull();
    expect(pit.condition).toBe("decayed");
    expect(town.wealth).toBe(0); // and it does not go into debt to try
  });

  it("will not mend a work whose supplier is gone", () => {
    // "The shipways want planks" cuts both ways: mending shipways that have no
    // sawpit buys a shed that idles the same season and rots again.
    const town = presidio({ population: 900, wealth: 90000 });
    const pit = raise(town, "sawpit", DAY0)!;
    const ways = raise(town, "shipway", DAY0)!;
    stepSeason(town, DAY0);
    pit.condition = "ruin"; // the planks stop for good
    ways.condition = "decayed";
    ways.idleSinceDay = DAY0;

    const done = governorTurn(town, AFTER_ROTTING);
    expect(done?.work).not.toBe(ways);
    expect(ways.condition).toBe("decayed");
  });

  it("will not mend a work the town has built over", () => {
    // CLAIMED GROUND IS PERMANENT and the footprint never retreats, so a buried
    // work is not rotting — it is finished. Paying to mend it would be the §5.6
    // loop with a different shed in it.
    const { town, pit } = withRottedSawpit();
    town.footprint.claimed.push({ ...pit.hex! });

    const done = governorTurn(town, AFTER_ROTTING);
    expect(done?.work).not.toBe(pit);
    expect(pit.condition).toBe("decayed");
  });

  it("cannot mend what there is no timber or stone to mend it with", () => {
    // §3.5.3, and the spec's own example of that gate is a REPAIR: "razing the
    // quay of a stone-poor island stops it rebuilding its wall." A mend is
    // construction and the same gate holds it.
    //
    // THE WORK IS A WALL AND THE GROUND IS STONE-POOR, and both halves changed
    // for the same reason (2026-09-16): a sawpit is exempt from the materials
    // bill because it PRODUCES materials, so neither a rotted sawpit nor a town
    // with timbered hills can state this claim any more. The claim underneath is
    // the one the spec wrote, word for word.
    const town = stonePoorIsland({ population: 400, wealth: 9000 });
    const wall = raise(town, "palisade", DAY0)!;
    stepSeason(town, DAY0);
    wall.condition = "decayed";
    wall.idleSinceDay = DAY0;
    raise(town, "tavern", AFTER_ROTTING); // something standing, to want timber and stone
    stepSeason(town, AFTER_ROTTING);

    expect(governorTurn(town, AFTER_ROTTING)).toBeNull();
    expect(wall.condition).toBe("decayed"); // full coffers, hands to spare, no planks

    town.market.bought[1] = 100; // a shipload of them
    expect(governorTurn(town, AFTER_ROTTING)?.work).toBe(wall);
  });

  it("mends the pit that would END the shortage, planks or no planks", () => {
    // THE OTHER DIRECTION OF THE SAME RULE, and it has to be written or the rule
    // would be true of raising and false of mending — which is the cliff again
    // with the sentence reversed, and worse: a decayed sawpit holds its own hex,
    // so `roomFor` drops and its kind falls out of the auction entirely (§5.1).
    // The place could then neither mend the pit nor dig another.
    const { town, pit } = withRottedSawpit();
    raise(town, "tavern", AFTER_ROTTING); // something standing, to want timber and stone
    stepSeason(town, AFTER_ROTTING);

    expect(canBuild(derive(town).commerce), "the fixture can get planks after all").toBe(false);
    expect(governorTurn(town, AFTER_ROTTING)?.work).toBe(pit);
    expect(pit.condition).toBe("idle"); // one rung up, and the hands take the last step
  });

  it("buys a repair and not immunity — a mended work rots again if the hands go", () => {
    const { town, pit } = withRottedSawpit();
    expect(governorTurn(town, AFTER_ROTTING)!.work).toBe(pit);
    expect(pit.condition).toBe("idle");

    // Long enough to rot again, counted out from the thresholds in days rather
    // than read back as a season count ([testing.md]: write the oracle out).
    const seasonsToDecay = DECAY.idleToDecayed / SEASON;
    for (let i = 1; i <= seasonsToDecay + 2; i++) {
      town.population = 3; // and the men walk away again
      stepSeason(town, AFTER_ROTTING + i * SEASON);
    }
    expect(pit.condition).toBe("decayed"); // the clock restarted; it did not stop
  });

  it("mends before he raises anything new", () => {
    // A governor who raised a fourth sawpit while the third rotted is a governor
    // nobody would keep — and mending takes the season's one decision, so the two
    // genuinely compete for what is scarce.
    const { town, pit } = withRottedSawpit({ wealth: 90000 });
    expect(wants(town, DAY0, CHOOSABLE.length).some((w) => w.affordable && w.manned)).toBe(true);

    const done = governorTurn(town, AFTER_ROTTING);
    expect(done!.want).toBeNull();
    expect(done!.work).toBe(pit);
  });

  it("does not spend sixty years of coin on a shed nobody can man", () => {
    // §5.6's playtest pathology in new clothes — mend, rot, mend, rot — and the
    // measurement that says it did not reappear. The labour gate closes this loop
    // exactly as it closes the original one it was written for.
    const run = (souls: number) => {
      const { town, pit } = withRottedSawpit();
      let mends = 0;
      for (let i = 0; i < 60 * CALENDAR.seasonsPerYear; i++) {
        town.population = souls; // a presidio that never grows...
        town.wealth = 90000; // ...and never wants for coin
        const s = stepTownSeason(town, AFTER_ROTTING + i * SEASON);
        if (s.built && s.built.want === null) mends++;
      }
      return { mends, condition: pit.condition };
    };

    const starved = run(6);
    expect(starved.mends).toBe(0); // sixty years, not one coin
    expect(starved.condition).toBe("ruin"); // it still rots all the way down

    const manned = run(400);
    expect(manned.mends).toBe(1); // saved once, and once is all it took
    expect(manned.condition).toBe("working");
  });
});

describe("holding out for the better thing", () => {
  it("waits rather than buying the cheapest thing to hand", () => {
    // He only settles for a lesser want he can afford if it is nearly as good.
    // A timber port with a roadstead: the sawpit scores far above everything else,
    // because the shipways are waiting on it — and the cheap wants sit well below.
    const town = townOf(
      [
        reg(0, "timberedHills", RING1, { bears: { timber: "ideal" } }),
        reg(1, "roadstead", RING2.slice(0, 4), { bears: { fish: "fair" } }),
      ],
      { population: 600, wealth: 9000 },
    );

    const ranked = wants(town, DAY0, CHOOSABLE.length).filter((w) => w.manned);
    const best = ranked[0];
    const bar = best.score * PLAN.settleFor;
    const goodEnough = ranked.filter((w) => w.score >= bar);
    const tooFar = ranked.filter((w) => w.score < bar);

    // A budget that pays for something he does not really want, and for nothing
    // he does. Chosen from the data so the claim cannot quietly stop being made.
    const budgets = tooFar.map((w) => w.cost).filter((c) => goodEnough.every((g) => g.cost > c));
    expect(budgets.length).toBeGreaterThan(0);
    const budget = Math.max(...budgets);

    town.wealth = budget;
    expect(governorTurn(town, DAY0)).toBeNull(); // he waits

    town.wealth = Math.min(...goodEnough.map((w) => w.cost));
    const built = governorTurn(town, DAY0);
    expect(built).not.toBeNull();
    expect(built!.want).not.toBeNull(); // he raised something; there was nothing to mend
    expect(built!.want!.score).toBeGreaterThanOrEqual(bar);
  });
});

describe("a season of a town", () => {
  it("reports what it did in its own words, or says nothing", () => {
    const town = mixedTown({ population: 500, wealth: 20000 });
    const season = stepTownSeason(town, DAY0);
    expect(season.day).toBe(DAY0); // it reports the day it was given, not one of its own
    if (season.built) {
      expect(season.built.sentence.length).toBeGreaterThan(0);
      // A raise says the auction's own two reasons; a mend has no auction behind
      // it and says its own.
      if (season.built.want) expect(season.built.sentence).toContain(season.built.want.reason);
      else expect(season.built.sentence).toContain("back in order");
    }
  });

  it("never prompts — a century passes whether anyone looks or not", () => {
    const town = mixedTown({ population: 300, wealth: 6000 });
    const pit = raise(town, "sawpit", DAY0)!;
    town.population = 3; // ...and nobody left to man it

    expect(() => stepYears(town, 100)).not.toThrow();

    // The second half of this claim used to read `town.season > 0`. The private
    // counter is gone, so the witness is the ledger: a sawpit nobody could work
    // is a ruin, which takes seven years of DAYS to become and cannot happen at
    // all unless the century really flowed through the town.
    expect(pit.condition).toBe("ruin");
  });
});

describe("reproducibility", () => {
  it("makes the same decisions from the same start and the same steps", () => {
    const a = mixedTown({ population: 350, wealth: 5000 });
    const b = mixedTown({ population: 350, wealth: 5000 });
    const seasonsA = stepTownYears(a, 150);
    const seasonsB = stepTownYears(b, 150);
    expect(seasonsB.map((s) => s.built?.sentence ?? "")).toEqual(seasonsA.map((s) => s.built?.sentence ?? ""));
    expect(b).toEqual(a);
  });
});
