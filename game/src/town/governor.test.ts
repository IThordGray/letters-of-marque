// The development plan — the five-term auction, and the rule that the
// explanation IS the score.
//
// [HC-70] keeps all of this out of the world layer's reach, and §8.6 goes
// further: the NATION auction is specified as the same pattern, and cites the
// governor's "fear outbids revenue" by name. So these claims are load-bearing
// twice over.

import { describe, it, expect } from "vitest";
import type { Town } from "./types";
import {
  scoreWork, reasonFrom, wants, governorTurn, stepTownSeason, stepTownYears,
  focusWants, focusLock, describeFocus, permitsFocus, takesTheSeason,
  AGENDA, FOCUS_AGENDA, FOCUS_TERMS, GIVEN_OVER, HOUSES_ON_IT,
  type Built, type Decision, type Focused, type TermKey,
} from "./governor";
import { CHOOSABLE, CATALOGUE, countOf, raise } from "./works";
import { derive, stepYears, stepSeason } from "./sim";
import { canBuild, DEPENDENCY_CLAUSE } from "./trade";
import { bestBorne, liveRegions, regionOf } from "./land";
import { CENTRE } from "./hex";
import { warmStart } from "../overworld/worldgen";
import { PLAN, DECAY, TRADE } from "./constants";
import { CALENDAR, DAYS_PER_YEAR } from "../overworld/calendar";
import { mixedTown, bareTown, townOf, reg, RING1, RING2 } from "./fixtures";

// The town keeps no clock (KAN-107): the world hands it the day, and here the
// test plays the world. These fixtures stand on the world's first day.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;

// A season's one decision is either a work raised or mended, or a stretch of
// ground given a purpose. The claims in this file are about the first kind, so
// they NARROW to it rather than assume it — a claim that read `.work` off
// whatever came back would quietly start asserting nothing the day a focus won
// the season.
const built = (d: Decision | null): Built | null => (d !== null && d.kind === "work" ? d : null);

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
    expect(built(governorTurn(broke, DAY0))).toBeNull(); // publishes the want, builds nothing
  });
});

describe("there is money and no men", () => {
  it("will not raise what nobody can work", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    const ranked = wants(town, DAY0, CHOOSABLE.length);

    expect(ranked.length).toBeGreaterThan(0); // he still says what he wants
    expect(ranked.every((w) => w.manned === false)).toBe(true);
    expect(built(governorTurn(town, DAY0))).toBeNull(); // ...and builds none of it
  });

  it("builds again once there are hands for it", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    expect(built(governorTurn(town, DAY0))).toBeNull();

    town.population = 600;
    expect(built(governorTurn(town, DAY0))).not.toBeNull();
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
    expect(built(done)!.want).toBeNull(); // a mend has no auction behind it
    expect(built(done)!.work).toBe(pit);
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

    expect(built(governorTurn(town, AFTER_ROTTING))).toBeNull();
    expect(pit.condition).toBe("decayed"); // still rotting...
    expect(town.wealth).toBe(before); // ...and not a coin spent on it
  });

  it("will not mend what he cannot pay for", () => {
    const { town, pit } = withRottedSawpit();
    town.wealth = 0; // hands enough, and nothing to pay them with

    expect(built(governorTurn(town, AFTER_ROTTING))).toBeNull();
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
    expect(built(done)?.work).not.toBe(ways);
    expect(ways.condition).toBe("decayed");
  });

  it("will not mend a work the town has built over", () => {
    // CLAIMED GROUND IS PERMANENT and the footprint never retreats, so a buried
    // work is not rotting — it is finished. Paying to mend it would be the §5.6
    // loop with a different shed in it.
    const { town, pit } = withRottedSawpit();
    town.footprint.claimed.push({ ...pit.hex! });

    const done = governorTurn(town, AFTER_ROTTING);
    expect(built(done)?.work).not.toBe(pit);
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

    expect(built(governorTurn(town, AFTER_ROTTING))).toBeNull();
    expect(wall.condition).toBe("decayed"); // full coffers, hands to spare, no planks

    town.market.bought[1] = 100; // a shipload of them
    expect(built(governorTurn(town, AFTER_ROTTING))?.work).toBe(wall);
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
    expect(built(governorTurn(town, AFTER_ROTTING))?.work).toBe(pit);
    expect(pit.condition).toBe("idle"); // one rung up, and the hands take the last step
  });

  it("buys a repair and not immunity — a mended work rots again if the hands go", () => {
    const { town, pit } = withRottedSawpit();
    expect(built(governorTurn(town, AFTER_ROTTING))!.work).toBe(pit);
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
    expect(built(done)!.want).toBeNull();
    expect(built(done)!.work).toBe(pit);
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
        const b = built(s.decided);
        if (b && b.want === null) mends++;
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
    expect(built(governorTurn(town, DAY0))).toBeNull(); // he raises nothing, and waits

    town.wealth = Math.min(...goodEnough.map((w) => w.cost));
    const raised = built(governorTurn(town, DAY0));
    expect(raised).not.toBeNull();
    expect(raised!.want).not.toBeNull(); // he raised something; there was nothing to mend
    expect(raised!.want!.score).toBeGreaterThanOrEqual(bar);
  });
});

describe("a season of a town", () => {
  it("reports what it did in its own words, or says nothing", () => {
    const town = mixedTown({ population: 500, wealth: 20000 });
    const season = stepTownSeason(town, DAY0);
    expect(season.day).toBe(DAY0); // it reports the day it was given, not one of its own
    const b = built(season.decided);
    if (b) {
      expect(b.sentence.length).toBeGreaterThan(0);
      // A raise says the auction's own two reasons; a mend has no auction behind
      // it and says its own.
      if (b.want) expect(b.sentence).toContain(b.want.reason);
      else expect(b.sentence).toContain("back in order");
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
    expect(seasonsB.map((s) => s.decided?.sentence ?? "")).toEqual(seasonsA.map((s) => s.decided?.sentence ?? ""));
    expect(b).toEqual(a);
  });
});

// ============================================================================
// THE REGION FOCUS — the four-term auction (KAN-123, spec §2.12.9)
// ============================================================================
//
// A region has a POTENTIAL given by its ground; a FOCUS decides what the town
// takes off it. The governor chooses and publishes his reason ([HC-1]: no engine
// system prompts the player; [HC-16]: every decision publishes its reason).

// A place whose ground says plainly what it is for: six hexes of hills made for
// timber, and a sliver of flats that grudge cane. Deliberately ASYMMETRIC IN
// BOTH AXES the land term reads — quality AND area — because a fixture whose two
// grounds differ in only one of them cannot tell "best suited" from "biggest".
//
// It is also given a core and claimed ground, which is what an eighty-year-old
// place looks like. A hand-built town that has never spread reads as desperate
// for houses — `crowding` is works over room, and room comes off the footprint —
// so on a bare fixture every claim about PRODUCTION would really be a claim
// about the growth term drowning it.
const twoGrounds = (init: Partial<Town> = {}): Town =>
  townOf(
    [
      reg(0, "timberedHills", RING2.slice(0, 6), { bears: { timber: "ideal" } }),
      reg(1, "caneFlats", RING1.slice(0, 2), { bears: { cane: "poor" } }),
    ],
    { footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(2, 6)] }, population: 300, wealth: 0, ...init },
  );

// ...and settled, so the subsistence works its people raise for themselves are
// standing. Everything below begins on the second season.
const settledTwoGrounds = (init: Partial<Town> = {}): Town => {
  const town = twoGrounds(init);
  stepSeason(town, DAY0);
  return town;
};

const focusOf = (d: Decision | null): Focused | null => (d !== null && d.kind === "focus" ? d : null);

describe("a governor decides what his ground is for", () => {
  it("gives a stretch of ground over to what its ground is best for", () => {
    const town = settledTwoGrounds({ governor: "Sarmiento" });
    const done = focusOf(governorTurn(town, SEASON));

    expect(done).not.toBeNull();
    expect(done!.focus).toBe("production");
    expect(regionOf(town, done!.region)!.terrain).toBe("timberedHills");
    // The decision is WRITTEN, not merely announced.
    expect(regionOf(town, done!.region)!.focus).toBe("production");
  });

  it("says why in a sentence a person can read", () => {
    const town = settledTwoGrounds({ governor: "Sarmiento" });
    const done = focusOf(governorTurn(town, SEASON))!;

    expect(done.sentence).toContain("Sarmiento");
    expect(done.sentence).toContain("the timbered hills"); // what ground
    expect(done.sentence).toContain("to the "); // ...and which way it lies
    expect(done.sentence).toContain("over to timber"); // ...and what it is now for
    expect(done.sentence).toContain(done.want.reason); // ...and why
    expect(done.sentence.endsWith(".")).toBe(true);
  });

  it("assembles that reason from its own top terms, exactly as a build does", () => {
    // Clause MEMBERSHIP, never prose text — the same discipline the five-term
    // auction is held to, and the reason "the explanation IS the score" is one
    // rule rather than two that happen to agree.
    const town = settledTwoGrounds();
    for (const want of focusWants(town, derive(town), 99)) {
      for (const clause of want.terms.slice(0, 2).map((t) => t.clause)) {
        expect(want.reason).toContain(clause);
      }
      for (const term of want.terms) expect(term.clause.trim()).not.toBe("");
      const weights = want.terms.map((t) => t.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    }
  });

  it("prefers the deeper stretch of the same ground — the ratio is AREA", () => {
    // [HC-94]: a focus buys CAPACITY, never a multiplier, so the focused-to-
    // unfocused ratio is the founding roll's own variance. THE TWO GROUNDS HERE
    // ARE IDENTICAL IN EVERY WAY BUT SIZE — same terrain, same produce, same
    // grade — because `twoGrounds` differs in quality as well, and a fixture
    // that varies both cannot tell "best suited" from "biggest".
    const town = townOf(
      [
        reg(0, "timberedHills", RING2.slice(0, 6), { bears: { timber: "ideal" } }),
        reg(1, "timberedHills", RING1.slice(0, 2), { bears: { timber: "ideal" } }),
      ],
      { footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(2, 6)] }, population: 300, wealth: 0 },
    );
    stepSeason(town, DAY0);

    const ranked = focusWants(town, derive(town), 99).filter((w) => w.focus === "production");
    expect(ranked[0].region).toBe(0);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    // ...and the clause says which of the land's two arguments is the louder.
    expect(ranked[0].terms.find((t) => t.key === "land")!.clause).toContain("depth in the timbered hills");
    expect(ranked[1].terms.find((t) => t.key === "land")!.clause).toContain("were made for it");
  });

  it("calls ground that bears bread as well as it bears cane BREAD ground", () => {
    // [P-10]: the tie-break between two produces of the same grade has a STATED
    // DIRECTION — bread first, then what builds, then what sells — which is the
    // same order `worthOf` ranks works by and the same order [HC-78] pays in.
    //
    // THE RECORD LISTS CANE FIRST ON PURPOSE. Reading `Object.keys(bears)`
    // instead would order the answer by however the world's cut happened to fill
    // the record in, and a fixture whose record already agreed with the rule
    // could not tell the two apart — found by mutation, which is the only thing
    // that would have told us.
    const town = townOf(
      [reg(0, "caneFlats", RING2.slice(0, 6), { bears: { cane: "ideal", food: "ideal" } })],
      { footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(0, 4)] }, population: 300, wealth: 0 },
    );
    stepSeason(town, DAY0);

    expect(Object.keys(town.regions[0].bears)[0]).toBe("cane"); // the fixture can tell them apart
    expect(bestBorne(town.regions[0])!.produce).toBe("food");

    const top = focusWants(town, derive(town), 99).find((w) => w.focus === "production")!;
    expect(top.produce).toBe("food");
    expect(describeFocus(town, top)).toContain("over to bread");
  });

  it("hands a tie to the spade — a thing raised over a thing decided", () => {
    expect(takesTheSeason(1.86, 1.86)).toBe("work"); // the tie
    expect(takesTheSeason(2, 1)).toBe("work");
    expect(takesTheSeason(1, 2)).toBe("focus");
  });

  it("...and that tie is structural, not a float coincidence", () => {
    // THE PRECONDITION THE DIRECTION EXISTS FOR, measured rather than assumed. A
    // tie between the two auctions happens because `AGENDA.colony.tavern` and
    // `FOCUS_AGENDA.colony.growth` are the same weight and the need term
    // saturates on both sides — so two candidates of different KINDS land on
    // exactly the same sum. If that ever stops being true this claim fails, and
    // whoever reads it will know the tie-break above stopped mattering.
    const town = mixedTown({ population: 350, wealth: 5000 });
    const d = derive(town);
    const works = wants(town, DAY0, CHOOSABLE.length, d);
    const focuses = focusWants(town, d, 99);
    const tied = works.filter((w) => focuses.some((f) => f.score === w.score));

    expect(tied.length).toBeGreaterThan(0);
    expect(AGENDA.colony.tavern).toBe(FOCUS_AGENDA.colony.growth);
  });

  it("argues in coin about THIS place — the same hills are worth more where timber is dear", () => {
    // §3.5.4: the market term is an argument about this place and not a fact
    // about the catalogue. The pair differs in exactly one number — the local
    // price of materials — and the ground under it is identical.
    //
    // IT NEEDS ITS OWN FIXTURE, and the reason is worth writing down: `access`
    // is readiness times reach, a hand-built town has no quay and no patron, so
    // its access is ZERO and the market term is silent for perfectly honest
    // reasons. A claim about it written on `twoGrounds` would have been a
    // decoration — found by mutation, which is the only thing that would have
    // told us.
    const timberPort = (init: Partial<Town> = {}): Town => {
      const town = townOf(
        [
          reg(0, "timberedHills", RING2.slice(0, 6), { bears: { timber: "ideal" } }),
          reg(1, "roadstead", RING1.slice(0, 3)),
        ],
        { footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(3, 6)] }, population: 300, wealth: 90000, ...init },
      );
      raise(town, "warehouse", DAY0); // a quay, so anything reaches the market at all
      stepSeason(town, DAY0);
      return town;
    };

    const dear = timberPort();
    const cheap = timberPort();
    dear.market.price[1] = TRADE.basePrice[1] * TRADE.priceCeiling;
    cheap.market.price[1] = TRADE.basePrice[1] * TRADE.priceFloor;
    expect(derive(dear).access).toBeGreaterThan(0);

    const hillsOf = (t: Town) =>
      focusWants(t, derive(t), 99).find((w) => w.focus === "production" && w.produce === "timber")!;
    const loud = hillsOf(dear);
    const quiet = hillsOf(cheap);

    expect(loud.terms.find((t) => t.key === "market")!.clause).toBe("timber fetches well here");
    expect(loud.terms.find((t) => t.key === "market")!.weight)
      .toBeGreaterThan(quiet.terms.find((t) => t.key === "market")!.weight);
    expect(loud.score).toBeGreaterThan(quiet.score);
  });

  it("costs no coin — a town with empty coffers still decides what its ground is for", () => {
    // §2.12.6, and §5.1.1's line: a focus is the one candidate the budget gate
    // never touches. Deciding is free; doing is not.
    const town = settledTwoGrounds({ wealth: 0 });
    const done = focusOf(governorTurn(town, SEASON));

    expect(done).not.toBeNull();
    expect(town.wealth).toBe(0); // ...and it did not go into debt to decide
  });

  it("spends the season on it — he decides OR he builds, never both", () => {
    const town = settledTwoGrounds({ wealth: 0 });
    const before = town.works.length;
    const done = governorTurn(town, SEASON);

    expect(done!.kind).toBe("focus");
    expect(town.works.length).toBe(before); // nothing was raised in the same breath
  });

  it("gives ground over to the town when there is nowhere left for people to sleep", () => {
    // §2.12.8's own worked example, and the other half of the rule: a town ringed
    // by ground worth something must choose, and the TOWN's want is what makes it
    // choose houses. The pair differs in exactly one respect — how much room the
    // footprint leaves — so nothing but the need term can explain the difference.
    const roomy = settledTwoGrounds();
    const packed = settledTwoGrounds({ footprint: { core: 0, claimed: [CENTRE] } });

    const topOf = (t: Town) => focusWants(t, derive(t), 99)[0];
    expect(topOf(roomy).focus).toBe("production");
    expect(topOf(packed).focus).toBe("growth");
    expect(topOf(packed).reason).toContain("nowhere left for people to sleep");
  });
});

describe("fear never argues for what ground is for", () => {
  // [HC-96]. Fear is a real and correct argument for A BATTERY ON A BLUFF — a
  // work, on a hex, answering a threat — and no land use makes a town safer. A
  // fifth term here would be defence claiming a fourth home.

  // A badly frightened place: burned this very day, no guns of its own, and a
  // bluff sitting there asking for a battery. THE FIXTURE HAS TO BE ABLE TO TELL
  // THE CASES APART, so it is one where fear is the LOUDEST voice in the room —
  // if the focus auction were going to hear it anywhere, it would be here.
  const frightened = (init: Partial<Town> = {}): Town => {
    const town = mixedTown({ population: 400, wealth: 9000, lastThreatDay: DAY0, ...init });
    stepSeason(town, DAY0);
    return town;
  };

  it("never mentions guns, however badly the town was burned", () => {
    const town = frightened();
    const ranked = focusWants(town, derive(town), 99);
    expect(ranked.length).toBeGreaterThan(0);

    for (const want of ranked) {
      expect(want.terms.some((t) => (t.key as TermKey) === "fear")).toBe(false);
      expect(want.reason).not.toContain("guns");
      expect(want.reason).not.toContain("burning");
      expect(want.reason).not.toContain("lies open");
    }
  });

  it("...while the same town's work auction still wants them", () => {
    // The other arm, and it is what stops the claim above being a decoration: a
    // fixture in which nothing anywhere argues from fear would prove nothing.
    const town = frightened();
    const battery = scoreWork(town, "battery", SEASON, derive(town)).find((t) => t.key === "fear");

    expect(battery).toBeDefined();
    expect(battery!.weight).toBeGreaterThan(0);
    expect(battery!.clause).toContain("burning");
  });

  it("weighs at most the four named terms, and never the same one twice", () => {
    const town = frightened();
    for (const want of focusWants(town, derive(town), 99)) {
      const keys = want.terms.map((t) => t.key);
      expect(keys.length).toBeLessThanOrEqual(FOCUS_TERMS.length);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(FOCUS_TERMS).toContain(k);
    }
    expect(FOCUS_TERMS).toEqual(["land", "need", "market", "agenda"]);
  });
});

describe("a focus is set once, and never taken back", () => {
  // [HC-95], as narrowed by the human 2026-09-19. The two halves lock for
  // different reasons and at different moments, and each locks at the instant
  // its own cost becomes real.

  it("never offers a production focus on the same ground again", () => {
    const town = settledTwoGrounds();
    const hills = regionOf(town, 0)!;
    hills.focus = "production";

    expect(focusLock(town, hills)).toBe(GIVEN_OVER);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === hills.id)).toBe(false);
  });

  it("lets him redirect ground marked for houses, while nothing stands on it", () => {
    const town = settledTwoGrounds({ governor: "Sarmiento" });
    const hills = regionOf(town, 0)!;
    hills.focus = "growth";

    expect(focusLock(town, hills)).toBeNull(); // nothing has happened yet
    const offered = focusWants(town, derive(town), 99).find((w) => w.region === hills.id);
    expect(offered).toBeDefined();
    expect(offered!.focus).toBe("production");
    expect(offered!.redirects).toBe(true);
    expect(describeFocus(town, offered!)).toContain("instead");
  });

  it("...and refuses once there are houses on it, and says why", () => {
    const town = settledTwoGrounds();
    const hills = regionOf(town, 0)!;
    hills.focus = "growth";
    town.footprint.claimed.push({ ...hills.hexes[0] }); // somebody built

    expect(focusLock(town, hills)).toBe(HOUSES_ON_IT);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === hills.id)).toBe(false);
  });

  it("decides a region twice at most, and the second time is always the redirection", () => {
    // world-simulation.md §10.7's acceptance reads "no focus is ever set twice
    // on the same region, across a two-hundred-year run" — and that sentence was
    // written BEFORE the human narrowed [HC-95] on 2026-09-19. The narrowing
    // allows exactly one second decision: growth over empty ground, redirected
    // before anyone built on it. So the claim is written to the narrowed rule,
    // which is stricter where it matters — a PRODUCTION focus is never revisited
    // at all, and nothing is ever decided a third time.
    //
    // The redirection happens of its own accord over two centuries, which is
    // worth knowing: it is not a path that only a hand-built fixture reaches.
    const town = mixedTown({ population: 350, wealth: 5000 });
    const decided: Focused[] = [];
    for (const s of stepTownYears(town, 200)) {
      const f = focusOf(s.decided);
      if (f) decided.push(f);
    }
    expect(decided.length).toBeGreaterThan(0);

    const last = new Map<number, Focused>();
    const times = new Map<number, number>();
    for (const f of decided) {
      const before = last.get(f.region);
      if (before) {
        expect(before.focus).toBe("growth"); // only growth is ever revisited
        expect(f.focus).toBe("production"); // ...and only ever into production
        expect(f.want.redirects).toBe(true); // ...and the sentence says so
      }
      last.set(f.region, f);
      times.set(f.region, (times.get(f.region) ?? 0) + 1);
    }
    expect(Math.max(...times.values())).toBeLessThanOrEqual(2);
  });
});

describe("a military purpose never sets a production focus on food ground", () => {
  // §5.1.2. The gate is the same rule it always was, re-keyed from a work kind
  // to the PRODUCE, so it now governs the focus as well as the work — and the
  // outpost cannot fulfil the wish by a side door either.

  // A presidio on ground that would feed it, if anyone would let it.
  const outpost = (init: Partial<Town> = {}): Town => {
    const town = townOf(
      [
        reg(0, "tilledGround", RING2.slice(0, 6), { bears: { food: "ideal" } }),
        reg(1, "scrub", RING1.slice(0, 3)),
      ],
      {
        archetype: "royalOutpost",
        footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(3, 6)] },
        population: 300,
        wealth: 90000,
        ...init,
      },
    );
    stepSeason(town, DAY0);
    return town;
  };

  it("refuses the focus outright", () => {
    const town = outpost();
    const food = regionOf(town, 0)!;

    expect(permitsFocus(town, food, "production")).toBe(false);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === food.id && w.focus === "production")).toBe(false);
  });

  it("...and a colony on the same ground takes it", () => {
    // The pair, so the claim is about the PURPOSE and not about the ground.
    const town = outpost({ archetype: "colony" });
    const food = regionOf(town, 0)!;

    expect(permitsFocus(town, food, "production")).toBe(true);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === food.id && w.focus === "production")).toBe(true);
  });

  it("keeps the wish visible and permanently unfulfilled", () => {
    // [HC-81] survives VERBATIM: dependency is scored identically for every
    // place, whatever its purpose. The outpost still says it and still never
    // acts on it — which is the whole of what purpose changes.
    const town = outpost();
    town.works = town.works.filter((w) => w.kind !== "gardenPlots"); // its bread off a ship
    const d = derive(town);
    expect(d.needs.food).toBeGreaterThan(0);

    const wish = wants(town, SEASON, CHOOSABLE.length, d).find((w) => w.kind === "provisionGround");
    expect(wish).toBeDefined();
    expect(wish!.permitted).toBe(false);
    expect(wish!.reason).toContain(DEPENDENCY_CLAUSE);

    stepTownYears(town, 100);
    expect(countOf(town, "provisionGround")).toBe(0);
    expect(town.regions.every((r) => !(r.terrain === "tilledGround" && r.focus === "production"))).toBe(true);
  });

  it("...and still keeps its garden plots", () => {
    // [HC-98]. Subsistence works stay outside the gate entirely, exactly as
    // today — this gate is only ever asked by `wants()`, which walks CHOOSABLE.
    const town = outpost();
    expect(countOf(town, "gardenPlots")).toBeGreaterThan(0);
  });
});

describe("a subsistence work is never gated on a focus", () => {
  // [HC-98]. Gate them and [HC-67]'s hamlet floor and [HC-18]'s "only a
  // deliberate hand empties a town" fail together, silently, as a number
  // drifting to zero across two hundred years.

  it("raises garden plots on ground nobody has decided anything about", () => {
    const town = bareTown({ population: 200, wealth: 0 });
    stepYears(town, 20); // the ledger's own upkeep, with no governor in it at all

    expect(town.regions.every((r) => r.focus === null)).toBe(true);
    expect(countOf(town, "gardenPlots")).toBeGreaterThan(0);
    expect(countOf(town, "dwellings")).toBeGreaterThan(0);
  });

  it("crawls back from being stripped, with no focus anywhere", () => {
    const town = bareTown({ population: 200, wealth: 0 });
    stepYears(town, 20);
    town.population = 20;
    town.works = []; // what a deliberate hand will one day do
    town.wealth = 0;

    stepYears(town, 60);

    expect(town.regions.every((r) => r.focus === null)).toBe(true);
    expect(countOf(town, "gardenPlots")).toBeGreaterThan(0);
    expect(town.population).toBeGreaterThan(20);
  });
});

describe("a region that already carries a chosen work is an instance, not a kind", () => {
  // [HC-97]. The four-term auction scores a region from the catalogue's figures
  // for what its ground bears, and that is only legitimate while the ground is
  // free. A region carrying a capital work has free area partly spent, a suit
  // already bought and a scaled trade figure standing on it — that is a
  // DEEPENING, scored from the region's own ground, and it is not this story's.

  it("drops out of the focus auction once a capital work stands on it", () => {
    const town = settledTwoGrounds({ wealth: 90000 });
    const hills = regionOf(town, 0)!;
    expect(focusWants(town, derive(town), 99).some((w) => w.region === hills.id)).toBe(true);

    raise(town, "sawpit", SEASON);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === hills.id)).toBe(false);
  });

  it("...but a garden plot does not take the question away", () => {
    // The other direction of the same rule, and it has to be written: a
    // subsistence work is never chosen, never priced and never gated, so it
    // claims no purpose for the ground it stands on. Counting it would leave a
    // median of ONE unfocused live region per place across the warm world, and
    // "most of its live regions" would be unreachable by construction.
    const town = bareTown({ population: 200, wealth: 0 });
    stepSeason(town, DAY0);
    const food = town.regions[0];

    expect(town.works.some((w) => w.kind === "gardenPlots" && w.region === 0)).toBe(true);
    expect(focusWants(town, derive(town), 99).some((w) => w.region === food.id)).toBe(true);
  });
});

describe("after a warm start, a place has decided what most of its ground is for", () => {
  // §2.12's acceptance, measured rather than asserted, and across SEEDS because
  // one world is one sample. Measured 2026-09-20: 48/49, 49/50, 50/50 and 49/50
  // places had focused most of their live regions, 73-78% of all live regions
  // focused, and the unfocused remainder tracks the regions that already carry a
  // capital work almost exactly — which is the deepening's half of the model,
  // and it is KAN-124's.
  const SEEDS = [1, 2, 3];

  it("focuses most of every place's live regions", () => {
    for (const seed of SEEDS) {
      const warm = warmStart(seed);
      let places = 0;
      let most = 0;
      for (const town of warm.towns) {
        const live = liveRegions(town);
        if (!live.length) continue;
        places++;
        const focused = live.filter((r) => r.focus !== null).length;
        if (focused * 2 > live.length) most++;
      }
      expect(places).toBeGreaterThan(40);
      expect(most / places, `seed ${seed}`).toBeGreaterThan(0.9);
    }
  });

  it("reaches for both — some ground to work, and some to live on", () => {
    // [HC-94]'s payoff: the ratio is AREA, so what a place decides its ground is
    // for falls out of the founding roll. A world that only ever chose one of
    // the two would mean the auction was deciding nothing.
    const warm = warmStart(SEEDS[0]);
    let production = 0;
    let growth = 0;
    for (const town of warm.towns) {
      for (const r of town.regions) {
        if (r.focus === "production") production++;
        else if (r.focus === "growth") growth++;
      }
    }
    expect(production).toBeGreaterThan(0);
    expect(growth).toBeGreaterThan(0);
  });

  it("gives the same world the same focuses", () => {
    // [HC-11], across the seam that actually runs the auction: the warm start
    // is the world driver, not this module's own harness.
    const a = warmStart(SEEDS[0]);
    const b = warmStart(SEEDS[0]);
    const read = (w: typeof a) => w.towns.map((t) => t.regions.map((r) => r.focus).join(","));
    expect(read(b)).toEqual(read(a));
  });
});
