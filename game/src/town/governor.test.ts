// The development plan — the five-term auction, and the rule that the
// explanation IS the score.
//
// [HC-70] keeps all of this out of the world layer's reach, and §8.6 goes
// further: the NATION auction is specified as the same pattern, and cites the
// governor's "fear outbids revenue" by name. So these claims are load-bearing
// twice over.

import { describe, it, expect } from "vitest";
import type { Town, Work } from "./types";
import {
  scoreWork, reasonFrom, wants, governorTurn, stepTownSeason, stepTownYears,
  focusWants, focusLock, describeFocus, permitsFocus, takesTheSeason,
  deepWants, AGENDA, FOCUS_AGENDA, FOCUS_TERMS, DEEP_TERMS, GIVEN_OVER, HOUSES_ON_IT, ROOM_FOR_MORE,
  NO_GROUND_LEFT,
  type Built, type Decision, type Focused, type Deepened, type TermKey,
} from "./governor";
import { CHOOSABLE, CATALOGUE, countOf, isFocusExpression, raise, depthOf } from "./works";
import { stepWorldSeason } from "../overworld/market";
import { derive, stepYears, stepSeason, summarise } from "./sim";
import { canBuild, dependencyWord, DEPENDENCY_CLAUSE } from "./trade";
import { bestBorne, capacityOf, isWater, liveRegions, regionOf } from "./land";
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

// ...and the wider narrowing: ANYTHING THE SEASON ACTUALLY RAISED AND PAID FOR.
// A work and a deepening are the two priced candidate types and they pass the
// same gates ([P-47]'s `startable`); a focus costs no coin and raises nothing.
// Since the three crops left the menu (§2.12.12), a claim about raising that
// could only see a `Built` would be blind to every sawpit in the world.
const raisedIn = (d: Decision | null): Work | null =>
  d === null ? null : d.kind === "work" ? d.work : d.kind === "deepening" ? d.work : null;

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
    // IT ASKS ABOUT ANYTHING RAISED, not only about a menu work. Since the three
    // crops left the menu (§2.12.12) the thing a governor raises on ground he has
    // given over is a DEEPENING, and both priced candidate types pass through the
    // same `startable` gate — so a claim about the labour gate that could only
    // see one of them would be watching the wrong half of its own rule.
    const town = mixedTown({ population: 3, wealth: 90000 });
    for (let i = 0; i < 8; i++) {
      expect(raisedIn(governorTurn(town, DAY0 + i * SEASON)), "nobody can work anything").toBeNull();
    }

    town.population = 600;
    let raised: Work | null = null;
    for (let i = 8; i < 24 && raised === null; i++) raised = raisedIn(governorTurn(town, DAY0 + i * SEASON));
    expect(raised).not.toBeNull();
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

  it("mends a shipway though every sawpit in the town is a ruin", () => {
    // THE OPPOSITE OF WHAT THIS CLAIM USED TO SAY, and the inversion is the
    // point. It read "will not mend a work whose supplier is gone" — mending
    // shipways with no sawpit buys a shed that idles the same season and rots
    // again — and that was true only while the dependency edge existed. The
    // edge is deleted with the chain (§2.12), so the shed does NOT idle, and a
    // governor who refused to mend it would be obeying a rule nothing enforces.
    const town = presidio({ population: 900, wealth: 90000 });
    const pit = raise(town, "sawpit", DAY0)!;
    const ways = raise(town, "shipway", DAY0)!;
    stepSeason(town, DAY0);
    pit.condition = "ruin"; // the planks stop for good, and it no longer matters
    ways.condition = "decayed";
    ways.idleSinceDay = DAY0;
    town.market.bought[1] = 200; // planks to be had, because a shipway is gated now

    const done = governorTurn(town, AFTER_ROTTING);
    expect(built(done)?.work).toBe(ways);
    expect(ways.condition).toBe("idle"); // one rung up; the hands take the last step
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
    // A THIRD CANDIDATE SINCE KAN-124, so the rule reads in two steps. The
    // direction this claim is about is unchanged: a free decision never takes a
    // tie from a thing that costs coin to do.
    expect(takesTheSeason(1.86, 0, 1.86)).toBe("work"); // the tie
    expect(takesTheSeason(2, 0, 1)).toBe("work");
    expect(takesTheSeason(1, 0, 2)).toBe("focus");
    expect(takesTheSeason(0, 1.86, 1.86)).toBe("deepening"); // ...and so does a deepening
  });

  it("...and a tie between two things raised goes to the NEW one", () => {
    // The second step of the direction, and it leans the safe way on [HC-75]:
    // the tie never goes to the candidate that makes a region deeper. A town
    // with no tavern at all wants a tavern more than a fourth sawpit.
    expect(takesTheSeason(1.5, 1.5, 0)).toBe("work");
    expect(takesTheSeason(1.4, 1.5, 0)).toBe("deepening");
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
    // place, whatever its purpose. The outpost still registers it and still
    // never acts on it — which is the whole of what purpose changes.
    //
    // WHERE THE WISH IS VISIBLE MOVED, AND THE RULE DID NOT. It used to be
    // published as a `provisionGround` want carrying `permitted: false`, and
    // provision grounds left the menu with the other two crops (§2.12.12). What
    // §11.3 actually asks for is that the place "registers high dependency and
    // its clause still reads 'too much of their bread comes off a ship'" — and
    // that is the town's OWN sentence, which every place writes whatever its
    // purpose. So the claim is now made where the sentence is.
    const town = outpost();
    town.works = town.works.filter((w) => w.kind !== "gardenPlots"); // its bread off a ship
    const d = derive(town);
    expect(d.needs.food).toBeGreaterThan(0); // scored identically — [HC-81]
    expect(summarise(town, SEASON)).toContain(dependencyWord(d.dependency));
    expect(dependencyWord(d.dependency)).not.toBe("self-feeding");

    // ...and a colony on the same ground hears the same want and MAY act: its
    // production focus on that food ground carries the very clause the outpost
    // is refused for. The pair is what makes this about purpose and not ground.
    const free = outpost({ archetype: "colony" });
    free.works = free.works.filter((w) => w.kind !== "gardenPlots");
    const wish = focusWants(free, derive(free), 99).find((w) => w.produce === "food");
    expect(wish).toBeDefined();
    expect(wish!.terms.some((t) => t.clause === DEPENDENCY_CLAUSE)).toBe(true);

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
  // one world is one sample.
  //
  // THE DENOMINATOR MOVED, AND IT IS A CORRECTION RATHER THAN A WEAKENING.
  // `liveRegions` means "not DEAD ground", and `isDead` names only marsh, scrub
  // and open sea — so a reef and a roadstead were in the count. Neither is
  // ground anybody decides anything about: a growth focus needs buildable land
  // and refuses water outright, so the only way a reef was ever "focused" was
  // through a PRODUCTION focus on its fish — which no work in the catalogue can
  // express, so it produced nothing, for ever. That was a real slice of the 260
  // focused-and-empty regions this story is about. Measured 2026-09-21: with
  // water excluded, EVERY live land region on four warm worlds is focused
  // (0 unfocused of 480), and no water region anywhere is.
  const SEEDS = [1, 2, 3];
  const landRegions = (town: Town) => liveRegions(town).filter((r) => !isWater(r.terrain));

  it("focuses most of every place's live regions", () => {
    for (const seed of SEEDS) {
      const warm = warmStart(seed);
      let places = 0;
      let most = 0;
      for (const town of warm.towns) {
        const live = landRegions(town);
        if (!live.length) continue;
        places++;
        const focused = live.filter((r) => r.focus !== null).length;
        if (focused * 2 > live.length) most++;
      }
      expect(places).toBeGreaterThan(40);
      expect(most / places, `seed ${seed}`).toBeGreaterThan(0.9);
    }
  });

  it("never gives water over to anything, because nobody works the sea", () => {
    // The companion the corrected denominator needs, and it is the sharper half:
    // excluding water from the count would be a dodge if water could still be
    // focused. A growth focus refuses water through `isBuildable`; a production
    // focus refuses it because nothing the catalogue can raise stands on fish or
    // on an anchorage. Both halves have to hold, or the count above is a lie.
    for (const seed of SEEDS) {
      const warm = warmStart(seed);
      for (const town of warm.towns) {
        for (const r of town.regions) {
          if (isWater(r.terrain)) expect(r.focus, `${town.name}: ${r.terrain}`).toBeNull();
        }
      }
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

// ---- The deepening — the third candidate type (§2.12.10) -------------------
//
// [HC-97] A DECISION ABOUT A REGION THAT ALREADY CARRIES WORKS IS SCORED FROM
// THAT REGION'S OWN GROUND — `potential x free capacity x local price` — NEVER
// FROM THE CATALOGUE'S FIGURES FOR A KIND.

// A timber town that has already decided what its hills are for and put one
// sawpit on them. THE REGION IS AN INSTANCE FROM THAT MOMENT: free area partly
// spent, a suit already bought, and its scaled trade figure standing on the
// ground. It needs a quay for the same reason the market-term fixture does —
// `access` is readiness times reach, and a town with no waterfront work at all
// has neither.
const timberTown = (init: Partial<Town> = {}): Town => {
  const town = townOf(
    [
      reg(0, "timberedHills", RING2.slice(0, 6), { bears: { timber: "ideal" }, focus: "production" }),
      reg(1, "roadstead", RING1.slice(0, 3)),
    ],
    {
      footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(3, 6)] },
      population: 300,
      wealth: 90000,
      governor: "Sarmiento",
      ...init,
    },
  );
  raise(town, "warehouse", DAY0);
  raise(town, "sawpit", DAY0); // the auction's one token work
  stepSeason(town, DAY0);
  return town;
};

const deepened = (d: Decision | null): Deepened | null => (d !== null && d.kind === "deepening" ? d : null);

// Run the place until the governor deepens something, or give up. A decision a
// season is scarce, so it takes a few.
function untilDeepened(town: Town, years: number): Deepened | null {
  for (let i = 1; i <= years * CALENDAR.seasonsPerYear; i++) {
    const done = deepened(stepTownSeason(town, DAY0 + i * SEASON).decided);
    if (done) return done;
  }
  return null;
}

describe("a governor can no longer choose to build a sawpit", () => {
  // §2.12.12, from the governor's end rather than the catalogue's. THE WORK
  // SURVIVES; THE MENU CHOICE DIES — so the question is not whether a sawpit
  // exists but whether anybody can pick one off a list, and the answer has to be
  // no on ground that bears all three crops at their best.

  it("publishes no crop in the wants-list, on ground that bears every one of them", () => {
    // `mixedTown` bears timber, cane and food, all ideal, with coin and hands to
    // spare — the case most likely to publish one if anything would.
    const town = mixedTown({ population: 900, wealth: 90000 });
    const published = wants(town, DAY0, CHOOSABLE.length).map((w) => w.kind);
    expect(published.length).toBeGreaterThan(0);
    for (const crop of ["sawpit", "caneField", "provisionGround"]) {
      expect(published, `${crop} is still on the menu`).not.toContain(crop);
    }
  });

  it("leaves every crop in the world standing on ground somebody gave over", () => {
    // The behavioural half, because a wants-list claim alone would miss an
    // auction that raised something it had not published. THE FIVE TERMS NEVER
    // READ A FOCUS AT ALL — `groundFor` hands back the best free ground for a
    // kind and asks nothing about what it is for — so a sawpit the auction
    // raised would sooner or later stand on ground nobody had decided about.
    // Not one in a whole world does.
    //
    // ONE SEED IS ENOUGH HERE and that is not the usual answer: this is an
    // INVARIANT over roughly a thousand standing works, not a statistic about
    // five places out of fifty, so a second world would only ask the same
    // question again.
    const warm = warmStart(1);
    let crops = 0;
    for (const t of warm.towns) {
      for (const w of t.works) {
        if (w.condition === "ruin" || !isFocusExpression(w.kind) || w.region === null) continue;
        crops++;
        expect(t.regions[w.region].focus, `${t.name}: ${w.kind}`).toBe("production");
      }
    }
    expect(crops, "no crop stands anywhere, so the claim is about an empty world").toBeGreaterThan(50);
  });
});

describe("a governor deepens ground he has already given over", () => {
  it("puts more sawpits into hills that already saw well, and says why", () => {
    // [HC-16]: a deepening publishes its reason like every other decision, and
    // the sentence is the brief's own — "the north hills already saw well, and
    // there is room for more".
    const town = timberTown();
    const done = untilDeepened(town, 40);

    expect(done).not.toBeNull();
    expect(done!.work.kind).toBe("sawpit");
    expect(regionOf(town, done!.region)!.terrain).toBe("timberedHills");
    expect(done!.sentence).toContain("Sarmiento");
    expect(done!.sentence).toContain("more sawpits"); // what he did
    expect(done!.sentence).toContain("the timbered hills"); // ...where
    expect(done!.sentence).toContain("to the "); // ...and which way it lies
    expect(done!.sentence).toContain(done!.want.reason); // ...and why
    expect(done!.sentence.endsWith(".")).toBe(true);

    expect(done!.want.reason).toContain("already bears timber well");
    expect(done!.want.reason).toContain(ROOM_FOR_MORE);
  });

  it("assembles that reason from its own top readings, exactly as the other two do", () => {
    // Clause MEMBERSHIP, never prose text — one rule with one implementation
    // across all three candidate types ([P-47]).
    const town = timberTown();
    for (const want of deepWants(town, derive(town), 99)) {
      for (const clause of want.terms.slice(0, 2).map((t) => t.clause)) {
        expect(want.reason).toContain(clause);
      }
      for (const term of want.terms) expect(term.clause.trim()).not.toBe("");
      const weights = want.terms.map((t) => t.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
      expect(want.terms.map((t) => t.key).sort()).toEqual([...DEEP_TERMS].sort());
    }
  });

  it("spends the season on it — he deepens OR he builds, never both", () => {
    const town = timberTown();
    let before = town.works.length;
    for (let i = 1; i <= 160; i++) {
      const season = stepTownSeason(town, DAY0 + i * SEASON);
      const raisedThisSeason = town.works.length - before;
      before = town.works.length;
      if (season.decided?.kind === "deepening") expect(raisedThisSeason).toBeLessThanOrEqual(1);
    }
  });

  it("pays for it out of the same purse a work comes from", () => {
    // A focus costs no coin; a deepening is not a focus. It raises a work and
    // the budget gate is the same gate.
    const town = timberTown();
    const purse = town.wealth;
    const done = untilDeepened(town, 40)!;
    expect(done.want.cost).toBe(CATALOGUE.sawpit.cost);
    expect(town.wealth).toBeLessThan(purse);
  });
});

describe("a deepening is scored from that region's own ground", () => {
  // [HC-97], and the two halves of it. The tempting shortcut is
  // `CATALOGUE[kind].trade`, which is the UNSCALED figure — the region already
  // holds the scaled one, and the two disagree the moment ground, reach or depth
  // differs from the default, which is always.

  it("reads the ground under it — the same catalogue, a worse hill, a quieter argument", () => {
    // The pair differs in exactly one thing: how well that stretch bears timber.
    // A score read off the catalogue could not tell them apart at all.
    const ideal = timberTown();
    const grudging = timberTown();
    grudging.regions[0].bears = { timber: "poor" };

    const only = (t: Town) => deepWants(t, derive(t), 99).find((w) => w.region === 0)!;
    expect(only(ideal).score).toBeGreaterThan(only(grudging).score);
    expect(only(ideal).terms.find((t) => t.key === "ground")!.clause).toContain("already bears timber well");
    expect(only(grudging).terms.find((t) => t.key === "ground")!.clause).toContain("grudges its timber");
  });

  it("reads how far out it lies — a stretch over the ridge argues more quietly", () => {
    // Reach is the region's OWN fact and the region holds it, so the reading
    // that stands in for what this ground pays has to carry it: ground over the
    // ridge yields a little less, and it yields a little less however many
    // works are standing on it. Written without this the claim survived
    // mutation, because no other fixture in the file puts a deepening on far
    // ground — which is exactly what an unpredicted survivor is for.
    const atHand = timberTown();
    const overTheRidge = timberTown();
    overTheRidge.regions[0].reach = "far";

    const only = (t: Town) => deepWants(t, derive(t), 99).find((w) => w.region === 0)!;
    expect(only(atHand).terms.find((t) => t.key === "ground")!.weight)
      .toBeGreaterThan(only(overTheRidge).terms.find((t) => t.key === "ground")!.weight);
    expect(only(atHand).score).toBeGreaterThan(only(overTheRidge).score);
  });

  it("reads the price HERE — the same hills are worth deepening where timber is dear", () => {
    // §3.5.4's rule applied to the third candidate type: the local price, and
    // there is no other price anywhere to read ([HC-82]). The catalogue's trade
    // figure is the same number in both towns.
    const dear = timberTown();
    const cheap = timberTown();
    dear.market.price[1] = TRADE.basePrice[1] * TRADE.priceCeiling;
    cheap.market.price[1] = TRADE.basePrice[1] * TRADE.priceFloor;

    const only = (t: Town) => deepWants(t, derive(t), 99).find((w) => w.region === 0)!;
    expect(only(dear).terms.find((t) => t.key === "market")!.weight)
      .toBeGreaterThan(only(cheap).terms.find((t) => t.key === "market")!.weight);
    expect(only(dear).score).toBeGreaterThan(only(cheap).score);
    expect(only(dear).terms.find((t) => t.key === "market")!.clause).toBe("timber fetches well here");
  });

  it("reads the room left, and SAYS SO when the ground is spent rather than falling silent", () => {
    // The readings MULTIPLY (§2.12.10), so a region with no room left is worth
    // NOTHING to deepen rather than merely less — which is what makes the area
    // cap bite in the scoring as well as in the ground. That half is unchanged.
    //
    // WHAT CHANGED IS THE SILENCE (KAN-134). This claim used to end "no candidate
    // at all, not a quiet one", which was the bug read as a feature: a want that
    // scored zero was dropped before it could write a clause, so a region given
    // over to production and then filled — by sawpits here, by the hamlet floor's
    // garden plots in the shipped world — read as focused and willing and
    // published nothing whatever. [HC-16] says a decision that comes to nothing
    // still needs a clause. The score is still zero and nothing is still raised.
    const town = timberTown();
    const roomy = deepWants(town, derive(town), 99).find((w) => w.region === 0)!;

    const packed = timberTown();
    for (let i = 0; i < 99; i++) if (!raise(packed, "sawpit", DAY0, packed.regions[0])) break;

    const spent = deepWants(packed, derive(packed), 99).find((w) => w.region === 0);
    expect(roomy.room).toBeGreaterThan(0);
    expect(roomy.terms.find((t) => t.key === "room")!.clause).toBe(ROOM_FOR_MORE);
    expect(spent, "a full region published nothing at all").toBeDefined();
    expect(spent!.room).toBe(0);
    expect(spent!.score).toBe(0);
    expect(spent!.terms.find((t) => t.key === "room")!.clause).toBe(NO_GROUND_LEFT);
  });

  it("says why a region given over to production has never had a thing raised on it", () => {
    // KAN-134, AND THE FAILURE IT CLOSES WAS SILENT. [HC-98] raises a
    // subsistence work on any ground the town holds, focused or not, so the
    // hamlet floor can cover a small region in garden plots long before its
    // governor has saved up for a farm. The region then read as focused, willing
    // and empty: no want was published, no clause was written, and nothing was
    // ever raised. Measured on four warm worlds, seventeen regions were in
    // exactly that state.
    const town = townOf(
      [reg(0, "tilledGround", RING1.slice(0, 3), { bears: { food: "ideal" }, focus: "production" })],
      { population: 400, wealth: 9000 },
    );
    // The hamlet floor takes the ground first, exactly as it does in the world.
    for (let i = 0; i < 3; i++) raise(town, "gardenPlots", DAY0);
    expect(depthOf(town, 0), "nothing anybody CHOSE stands there").toBe(0);
    expect(capacityOf(town, town.regions[0]), "and no ground is left on it").toBe(0);

    const want = deepWants(town, derive(town), 99).find((w) => w.region === 0);
    expect(want, "focused ground nobody published a word about").toBeDefined();
    expect(want!.terms.find((t) => t.key === "room")!.clause).toBe(NO_GROUND_LEFT);

    // ...AND THE REFUSAL COSTS THE TOWN NOTHING, WHICH IS THE PRECONDITION THE
    // FIX RESTS ON. Publishing a want nobody may act on is only safe because it
    // scores zero, sorts last, and loses every tie to the work — so no season is
    // ever handed to it and then given back as null. `deepenTurn` deliberately
    // adds no gate of its own on the strength of that (measured bit-identical on
    // four warm worlds), and this is the claim that goes red the day it stops
    // being true.
    const seasons = stepTownYears(town, 20, DAY0);
    expect(depthOf(town, 0), "a region with no ground left was deepened anyway").toBe(0);
    expect(
      seasons.filter((s) => s.decided !== null).length,
      "the refused region ate every season the town had",
    ).toBeGreaterThan(0);
  });

  it("never offers one on ground nobody decided anything about", () => {
    // [HC-94]: unfocused ground carries a token work and never becomes an
    // industry, so there is nothing to offer however good the hills are.
    const town = timberTown();
    town.regions[0].focus = null;
    expect(deepWants(town, derive(town), 99)).toEqual([]);
  });

  it("...AND STARTS ONE, which is the larger half of the story", () => {
    // THE CHANGE KAN-125 IS ACTUALLY ABOUT, and it inverts what this claim said
    // yesterday. KAN-124 refused a focused region with nothing standing on it —
    // "that is still a KIND-like question and it belongs to the five-term
    // auction" — and that was reasonable in isolation and wrong in sequence:
    // §2.12.12 takes the three crops OFF the menu, so the five-term auction has
    // nothing left to offer that stands on what the ground bears. Refusing here
    // as well would leave ground somebody gave over with no way to be worked at
    // all. Measured before the fix: 260 of 369 production-focused live regions
    // across four warm worlds were focused and EMPTY.
    const town = timberTown();
    town.works = town.works.filter((w) => w.kind !== "sawpit");
    expect(depthOf(town, 0)).toBe(0);

    const first = deepWants(town, derive(town), 99).find((w) => w.region === 0);
    expect(first, "ground given over has no way to get its first work").toBeDefined();
    expect(first!.kind).toBe("sawpit");
    expect(first!.depth).toBe(0); // nothing stands there yet, and it says so
    expect(first!.room).toBe(town.regions[0].hexes.length); // ...so all of it is free
  });

  it("still never offers one where the auction could legitimately have gone", () => {
    // The line the collapse did NOT move. A work that stands on NAMED ground —
    // a warehouse, a customs house, a shipway, a battery — is still chosen off
    // the menu and is never a deepening, because its ground is a roadstead or a
    // bluff and neither BEARS anything. So the two candidate types still never
    // contend for one hex, which is what keeps [HC-97]'s two scoring paths from
    // ever pricing the same decision.
    const town = timberTown();
    expect(deepWants(town, derive(town), 99).every((w) => w.kind === "sawpit")).toBe(true);
    expect(deepWants(town, derive(town), 99).some((w) => w.region === 1)).toBe(false); // the roadstead
  });

  it("...and a garden plot on the ground still counts for no depth at all", () => {
    // [HC-98]'s second edge, at the decision. A subsistence work is never
    // chosen, never priced and never gated, so it claims no purpose for its
    // ground. The deepening is offered — that is this story — but it must be
    // offered as the region's FIRST work, at depth zero, or a garden plot would
    // be quietly buying the rising-returns premium that belongs to a decision
    // somebody took.
    //
    // It needs FOOD ground, because a garden plot only stands where something
    // will grow — which is the whole reason the trap is live: that is exactly
    // the ground a governor most wants to be asked about.
    const town = townOf(
      [reg(0, "tilledGround", RING2.slice(0, 6), { bears: { food: "ideal" }, focus: "production" })],
      { footprint: { core: 2, claimed: [CENTRE, ...RING1.slice(0, 4)] }, population: 200, wealth: 90000 },
    );
    stepSeason(town, DAY0); // its people raise their own plots, as they always do

    const plots = town.works.filter((w) => w.kind === "gardenPlots" && w.region === 0);
    expect(plots.length).toBeGreaterThan(0);
    expect(depthOf(town, 0)).toBe(0); // ...and nobody CHOSE any of it

    const want = deepWants(town, derive(town), 99).find((w) => w.region === 0);
    expect(want).toBeDefined();
    expect(want!.depth).toBe(0); // the plots bought nothing
    expect(want!.kind).toBe("provisionGround");
  });
});

describe("the area cap terminates the deepening loop", () => {
  // [HC-75], and this is the claim the cap exists for. Unbounded rising returns
  // are an overshoot engine — more works, more yield, more growth, more works —
  // and capped at area the loop terminates on the FOUNDING ROLL rather than on a
  // constant.
  //
  // [HC-75]'S OWN ACCEPTANCE ALREADY EXISTS and is not restated here: "no place
  // oscillates with growing amplitude across two centuries" lives in
  // `overworld/market.test.ts`, measures population, and is the claim the world
  // layer is held to. Writing a second one beside it would be two sources for
  // one fact. What is added here is the half that test cannot see — the loop in
  // WORKS that this story creates, and the ground that stops it.
  //
  // IT IS LIVE, AND MEASURED SO. Fattening `premiumPerDepth` from 0.12 to 5.0
  // fails that acceptance outright (2026-09-20), so the premium is inside its
  // reach and the cap is what is holding it.

  const capitalWorks = (towns: Town[]): number => {
    let n = 0;
    for (const t of towns) {
      for (const w of t.works) if (w.condition !== "ruin" && CATALOGUE[w.kind].cls === "capital") n++;
    }
    return n;
  };

  it("stops multiplying works — the last half-century adds a fraction of the first", () => {
    // MEASURED 2026-09-20, three seeds over two hundred years: capital works
    // added per fifty-year block run 88–151, then 3–17, then 0–5, then 0–9. The
    // world fills its ground and stops, which is what "terminates" means.
    const warm = warmStart(7);
    const marks: number[] = [capitalWorks(warm.towns)];
    for (let block = 0; block < 4; block++) {
      for (let s = 0; s < 50 * CALENDAR.seasonsPerYear; s++) {
        stepWorldSeason(warm.world, warm.towns, warm.markets, warm.wars, warm.routes);
        warm.world.day += CALENDAR.daysPerSeason;
      }
      marks.push(capitalWorks(warm.towns));
    }
    const added = [1, 2, 3, 4].map((i) => marks[i] - marks[i - 1]);

    expect(added[0]).toBeGreaterThan(20); // the world really was still building
    expect(added[3]).toBeLessThan(added[0] / 4); // ...and by the end it has nearly stopped

    // A STABILITY CLAIM NEEDS A LIVENESS GUARD (testing.md): a world of nothing
    // also stops building. The threshold is written out — a capital work apiece
    // — rather than read back out of the sim.
    expect(marks[4]).toBeGreaterThan(warm.towns.length);
  }, 60000);

  it("never lets a region carry more works than its ground has hexes", () => {
    // The terminating condition itself, on every region of a world run forward:
    // the premium runs out of GROUND before it runs out of anything else,
    // because nothing will give it a hex to stand on. There is no second clamp
    // anywhere, and §2.12.5 refuses one.
    const warm = warmStart(7);
    for (let s = 0; s < 100 * CALENDAR.seasonsPerYear; s++) {
      stepWorldSeason(warm.world, warm.towns, warm.markets, warm.wars, warm.routes);
      warm.world.day += CALENDAR.daysPerSeason;
    }
    let deepest = 0;
    for (const t of warm.towns) {
      for (let i = 0; i < t.regions.length; i++) {
        const depth = depthOf(t, i);
        if (depth > deepest) deepest = depth;
        expect(depth).toBeLessThanOrEqual(t.regions[i].hexes.length);
      }
    }
    expect(deepest).toBeGreaterThan(1); // ...and the claim is not about an empty world
  }, 60000);
});
describe("after a warm start, ground that was given over has been worked", () => {
  // The story's own acceptance, measured rather than asserted, and across SEEDS
  // because one world is one sample. Measured 2026-09-21, four seeds: 198
  // production-focused live land regions, 107 of them carrying works and 78 of
  // those worked more than once; the deepest reaches 13 hexes of its own ground,
  // which is the founding roll's ceiling rather than the catalogue's.
  const SEEDS = [1, 2, 3];

  it("works the ground somebody decided on, and only that ground", () => {
    // AND THE SECOND HALF OF THIS CLAIM CHANGED SIDES. It used to read "and
    // leaves the REST at a token work", and asserted that unfocused regions did
    // carry one: §2.12.4 says "unfocused, a region's depth caps at a TOKEN
    // work — a hamlet takes what timber it needs off the ridge".
    //
    // THE TOKEN CAP SURVIVES AS A RULE AND HAS NO PRODUCER LEFT. §2.12.12 takes
    // every work that stands on what the ground bears off the menu, and those
    // were the only works the token cap could ever have bound — so an unfocused
    // region now carries NONE rather than one. `roomInRegion` still enforces the
    // cap on the `raise` path and `raise` is still the one door, so the rule is
    // intact and unreachable. Flagged to the spec rather than fixed here: it is
    // §2.12.4's clause to retire or to re-home, not this module's.
    for (const seed of SEEDS) {
      const warm = warmStart(seed);
      let industry = 0; // a focused region worked more than once
      let worked = 0; // ...and a focused region worked at all
      let unfocused = 0; // ground nobody decided about, carrying industry
      for (const t of warm.towns) {
        for (let i = 0; i < t.regions.length; i++) {
          const depth = depthOf(t, i);
          if (depth === 0) continue;
          if (t.regions[i].focus === "production") {
            worked++;
            if (depth > 1) industry++;
          } else {
            unfocused++;
          }
        }
      }
      expect(worked, `seed ${seed}`).toBeGreaterThan(0);
      expect(industry, `seed ${seed}`).toBeGreaterThan(0);
      expect(unfocused, `seed ${seed}`).toBe(0);
    }
  });

  it("never leaves focused ground empty because nobody looked at it", () => {
    // THE STORY'S ACCEPTANCE, AND IT IS THE MECHANISM RATHER THAN THE RATIO
    // (rewritten KAN-126). KAN-125's own words: "what remains is refused by
    // coin, hands or materials — never by nobody looking." That sentence is the
    // claim; the empty SHARE was only ever a proxy for it, and the proxy broke
    // the moment the denominator moved.
    //
    // WHY IT MOVED, MEASURED. KAN-126 made two more produces expressible, so
    // ground that could not legitimately be given over at all — a reef for its
    // fish, cotton flats for their cotton — became decidable overnight. Pooled
    // across these three seeds:
    //
    //                      focused   empty   worked
    //   before KAN-126        123      67       56
    //   after                 242     159       83
    //
    // The empty SHARE rose 54% -> 66% and the ground actually WORKED rose by
    // half, because the denominator nearly doubled with ground that had never
    // been a candidate before. A ratio whose denominator is what the story
    // changes cannot be the criterion — so the criterion below is that every one
    // of those 159 is a published want with a named refusal, and the measurement
    // that follows it is a direction rather than a bound.
    //
    // AND THE ONE EXEMPTION IT CARRIED IS GONE (KAN-134). This claim used to
    // excuse a focused region whose every hex was already spoken for, on the
    // grounds that "there is no hex left on it" is not the auction failing —
    // FIVE such regions across these three seeds, all of them filled by the
    // hamlet floor's garden plots. It was true that the auction had not failed
    // and false that nothing had: the region published no want, so nothing said
    // why, which is exactly what [HC-16] forbids. `capacityOf` now counts the
    // works standing on a region and the refusal goes out with the want, so the
    // claim is the unqualified one: EVERY focused region is looked at.
    let worked = 0;
    let unreachable = 0;
    for (const seed of SEEDS) {
      const warm = warmStart(seed);
      for (const t of warm.towns) {
        const d = derive(t);
        // The whole published list, not the head: `deepWants`' default limit is
        // three, and a claim about every focused region has to ask for every one.
        const published = new Set(deepWants(t, d, t.regions.length).map((w) => w.region));
        for (let i = 0; i < t.regions.length; i++) {
          const r = t.regions[i];
          if (r.focus !== "production") continue;
          if (depthOf(t, i) > 0) {
            worked++;
            continue;
          }
          // Empty, and the auction must be LOOKING at it. Its refusal is then
          // one of the five gates — coin, hands, materials, the patron's leave,
          // or the ground itself — and every one of them writes a clause.
          if (published.has(r.id)) continue;
          unreachable++;
        }
      }
    }
    expect(unreachable, "focused ground the deepening auction never offered").toBe(0);
    expect(worked, "no focused ground anywhere was worked at all").toBeGreaterThan(40);
  });

  it("gives the same world the same depths", () => {
    // [HC-11], across the seam that actually runs all three auctions.
    const read = (w: ReturnType<typeof warmStart>) =>
      w.towns.map((t) => t.regions.map((_, i) => depthOf(t, i)).join(","));
    expect(read(warmStart(SEEDS[0]))).toEqual(read(warmStart(SEEDS[0])));
  });
});
