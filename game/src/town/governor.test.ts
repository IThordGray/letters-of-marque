// The development plan — the five-term auction, and the rule that the
// explanation IS the score.
//
// [HC-70] keeps all of this out of the world layer's reach, and §8.6 goes
// further: the NATION auction is specified as the same pattern, and cites the
// governor's "fear outbids revenue" by name. So these claims are load-bearing
// twice over.

import { describe, it, expect } from "vitest";
import { scoreWork, reasonFrom, wants, governorTurn, stepTownSeason } from "./governor";
import { CHOOSABLE } from "./works";
import { stepYears } from "./sim";
import { PLAN } from "./constants";
import { mixedTown, townOf, reg, RING1, RING2 } from "./fixtures";

describe("the explanation is the score", () => {
  it("says the two things that actually decided it", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    const ranked = wants(town, CHOOSABLE.length);
    expect(ranked.length).toBeGreaterThan(0);

    for (const want of ranked) {
      const top = want.terms.slice(0, 2).map((t) => t.clause);
      for (const clause of top) expect(want.reason).toContain(clause);
    }
  });

  it("never scores a work with a term that says nothing", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      for (const term of scoreWork(town, kind)) {
        expect(term.clause.trim()).not.toBe("");
      }
    }
  });

  it("weighs at most the five named terms, and never twice", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      const keys = scoreWork(town, kind).map((t) => t.key);
      expect(keys.length).toBeLessThanOrEqual(5);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("ranks its reasons strongest first", () => {
    const town = mixedTown({ population: 400, wealth: 9000 });
    for (const kind of CHOOSABLE) {
      const weights = scoreWork(town, kind).map((t) => t.weight);
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
    const burned = mixedTown({ population: 400, wealth: 9000, lastThreat: 0 });

    const calmFear = scoreWork(calm, "battery").find((t) => t.key === "fear")!;
    const burnedFear = scoreWork(burned, "battery").find((t) => t.key === "fear")!;

    expect(burnedFear.weight).toBeGreaterThan(calmFear.weight);
    expect(burnedFear.clause).toContain("burning");
    expect(calmFear.clause).not.toContain("burning");
  });

  it("moves a defensive work up the list after a burning", () => {
    const calm = mixedTown({ population: 400, wealth: 9000 });
    const burned = mixedTown({ population: 400, wealth: 9000, lastThreat: 0 });

    const scoreOf = (t: ReturnType<typeof mixedTown>) =>
      wants(t, CHOOSABLE.length).find((w) => w.kind === "battery")?.score ?? 0;

    expect(scoreOf(burned)).toBeGreaterThan(scoreOf(calm));
  });

  it("forgets a burning eventually", () => {
    const town = mixedTown({ population: 400, wealth: 9000, lastThreat: 0 });
    const fresh = scoreWork(town, "battery").find((t) => t.key === "fear")!.weight;
    stepYears(town, 30); // long enough that it is no longer fresh
    const later = scoreWork(town, "battery").find((t) => t.key === "fear");
    if (later) expect(later.weight).toBeLessThan(fresh);
  });
});

describe("wealth is the budget gate, not a term", () => {
  it("wants the same things whether the coffers are full or bare", () => {
    // The cheapest test in the suite, and it guards a rule that is very easy to
    // break by accident: what a town WANTS must not depend on what it can pay for.
    const rich = mixedTown({ population: 400, wealth: 90000 });
    const broke = mixedTown({ population: 400, wealth: 0 });

    const kindsOf = (t: ReturnType<typeof mixedTown>) => wants(t, CHOOSABLE.length).map((w) => w.kind);
    const scoresOf = (t: ReturnType<typeof mixedTown>) => wants(t, CHOOSABLE.length).map((w) => w.score);

    expect(kindsOf(broke)).toEqual(kindsOf(rich));
    expect(scoresOf(broke)).toEqual(scoresOf(rich));
  });

  it("marks what it cannot pay for rather than hiding it", () => {
    const broke = mixedTown({ population: 400, wealth: 0 });
    const ranked = wants(broke, CHOOSABLE.length);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((w) => w.affordable === false)).toBe(true);
    expect(governorTurn(broke, 1650)).toBeNull(); // publishes the want, builds nothing
  });
});

describe("there is money and no men", () => {
  it("will not raise what nobody can work", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    const ranked = wants(town, CHOOSABLE.length);

    expect(ranked.length).toBeGreaterThan(0); // he still says what he wants
    expect(ranked.every((w) => w.manned === false)).toBe(true);
    expect(governorTurn(town, 1650)).toBeNull(); // ...and builds none of it
  });

  it("builds again once there are hands for it", () => {
    const town = mixedTown({ population: 3, wealth: 90000 });
    expect(governorTurn(town, 1650)).toBeNull();

    town.population = 600;
    expect(governorTurn(town, 1650)).not.toBeNull();
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

    const ranked = wants(town, CHOOSABLE.length).filter((w) => w.manned);
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
    expect(governorTurn(town, 1650)).toBeNull(); // he waits

    town.wealth = Math.min(...goodEnough.map((w) => w.cost));
    const built = governorTurn(town, 1650);
    expect(built).not.toBeNull();
    expect(built!.want.score).toBeGreaterThanOrEqual(bar);
  });
});

describe("a season of a town", () => {
  it("reports what it did in its own words, or says nothing", () => {
    const town = mixedTown({ population: 500, wealth: 20000 });
    const season = stepTownSeason(town);
    if (season.built) {
      expect(season.built.sentence).toContain(season.built.want.reason);
      expect(season.built.sentence.length).toBeGreaterThan(0);
    }
  });

  it("never prompts — a century passes whether anyone looks or not", () => {
    const town = mixedTown({ population: 300, wealth: 6000 });
    expect(() => stepYears(town, 100)).not.toThrow();
    expect(town.season).toBeGreaterThan(0);
  });
});
