// The trading engine, town side — a town sells what it has spare, buys what it
// lacks, and its wealth is the difference.
//
// Every claim here is warranted by world-simulation.md §11 or town-economy.md
// §3.5, never by what the code happens to do. Fixtures are built against the
// STRUCT (testing.md's fixture rule): a hand-written `market` block is exactly
// how the world hands a place its cleared trade ([HC-72]), so nothing here
// depends on the clearing, and the clearing is pinned separately.

import { describe, it, expect } from "vitest";
import { derive, stepSeason, stepYears, carryingCapacity, prosperityTarget } from "./sim";
import { raise } from "./works";
import { accessOf, dependencyOf, dependencyWord, DEPENDENCY_CLAUSE } from "./trade";
import { TRADE } from "./constants";
import { governorTurn, scoreWork, wants } from "./governor";
import { mixedTown, bareTown, seaTown, townOf, reg, RING1, RING2 } from "./fixtures";
import type { Town } from "./types";

// A place with a quay, so it can trade at all — access gates both directions and
// a town with neither quay nor guns is deliberately shut out ([HC-85]).
function open(town: Town): Town {
  raise(town, "warehouse", 1650);
  stepSeason(town);
  return town;
}

// The world's half of the season, done by hand: the clearing found this much for
// the place to buy, at this price.
function clearedWith(town: Town, cls: number, allotted: number, price = 1): Town {
  town.market.allotted[cls] = allotted;
  town.market.price[cls] = price;
  return town;
}

describe("wealth is earned, not emitted", () => {
  it("earns more from the same sawpit where its timber fetches more", () => {
    // The whole of the change: `trade` stopped being coin a work produced and
    // became what it sends to the quay. Price is what someone paid for it, so
    // the same work in the same town is worth what the market says it is worth.
    const rich = open(seaTown({ population: 300, wealth: 2000 }));
    const poor = open(seaTown({ population: 300, wealth: 2000 }));
    raise(rich, "sawpit", 1650);
    raise(poor, "sawpit", 1650);
    stepSeason(rich);
    stepSeason(poor);

    rich.market.price[1] = 2;
    poor.market.price[1] = 0.1;

    expect(derive(rich).commerce.earned).toBeGreaterThan(derive(poor).commerce.earned);
  });

  it("moves nothing at all over a shore with no quay and no guns", () => {
    // [HC-85], and it is stated as an equality rather than a direction because
    // the rule is an absolute: no quay, no security, nothing moves either way.
    const town = bareTown({ population: 160 });
    stepYears(town, 5);
    const d = derive(town);
    expect(d.access).toBe(0);
    expect(d.commerce.offer[0]).toBe(0);
    expect(d.commerce.want[0]).toBe(0);
    expect(d.commerce.earned).toBe(0);
  });

  it("moves less in BOTH directions when the quay burns", () => {
    // The same number gates exports and imports, which is why raiding and trade
    // are one mechanism seen from two sides.
    const town = open(mixedTown({ population: 400, wealth: 3000 }));
    raise(town, "sawpit", 1650);
    stepSeason(town);
    const before = derive(town);

    for (const w of town.works) if (w.kind === "warehouse" || w.kind === "fishingShacks") w.condition = "ruin";
    const after = derive(town);

    expect(after.access).toBeLessThan(before.access);
    expect(after.commerce.offer[1]).toBeLessThan(before.commerce.offer[1]);
    expect(after.commerce.earned).toBeLessThan(before.commerce.earned);
  });

  it("counts a quay's own cut as earned, not emitted", () => {
    // A customs house fills no hold; it takes a share of what crosses the beach.
    // So it earns on access and dies with it.
    const working = [{ kind: "customsHouse", trade: 16 } as never];
    expect(accessOf(working, 0)).toBeGreaterThan(0);
    expect(accessOf([], 0)).toBe(0);
  });
});

describe("the coin ceiling", () => {
  it("lets a town outgrow the ground it farms, which the old cap forbade", () => {
    // §3.5.6: bought bread lifts the ~450-soul ceiling, and what replaces it is
    // coin, access, ground for houses and hands.
    const fed = open(mixedTown({ population: 200, wealth: 2000 }));
    const own = carryingCapacity(fed);
    fed.market.bought[0] = own * 0.5;
    expect(carryingCapacity(fed)).toBeGreaterThan(own);
  });

  it("asks for grain enough to feed the people its cargo can pay for", () => {
    // "pop ~= export revenue / (import price + upkeep/head)" — the ceiling is set
    // by the land's QUALITY, not its acreage. A town with sawpits asks for more
    // bread than the same town without them, at the same population.
    const build = (cargo: boolean) => {
      // A place that grows nothing it can eat, so the whole of its bread is the
      // claim. Same quay, same souls; the only difference is timber to sell.
      const t = seaTown({ population: 60, wealth: 6000 });
      raise(t, "warehouse", 1650);
      raise(t, "customsHouse", 1650);
      if (cargo) {
        raise(t, "sawpit", 1650);
        raise(t, "sawpit", 1650);
      }
      t.market.price[0] = TRADE.basePrice[0];
      return derive(t).commerce.want[0];
    };
    expect(build(true)).toBeGreaterThan(build(false));
  });

  it("cannot bootstrap itself by selling corn to buy corn", () => {
    // The appetite is funded out of CARGO and the crown's grant. A town that
    // grows nothing but food therefore stays the size of its own fields.
    const town = open(bareTown({ population: 100, wealth: 500 }));
    raise(town, "provisionGround", 1650);
    stepSeason(town);
    const d = derive(town);
    expect(d.commerce.want[0]).toBe(0);
  });
});

describe("bread before batteries", () => {
  it("pays the quay before the governor ever sees the coin", () => {
    // [HC-78]. The import is inside the flow, not beside it, so a town that
    // spends all it makes on corn never reaches its wall.
    const town = open(mixedTown({ population: 300, wealth: 1000 }));
    clearedWith(town, 0, 400, 1);
    const wealthBefore = town.wealth;
    stepSeason(town);
    expect(town.market.paid).toBeGreaterThan(0);
    expect(town.wealth).toBeLessThan(wealthBefore);
  });

  it("goes without rather than into debt when the corn costs more than it has", () => {
    const town = open(mixedTown({ population: 300, wealth: 40 }));
    clearedWith(town, 0, 5000, 1);
    stepSeason(town);
    expect(town.wealth).toBeGreaterThanOrEqual(0);
    expect(town.market.bought[0]).toBeLessThan(5000);
  });

  it("buys its bread before its timber when it can afford only one", () => {
    // Tier order is the pyramid again: whatever is left after the corn buys the
    // timber, and whatever is left after that buys the silk.
    const town = open(mixedTown({ population: 300, wealth: 0 }));
    town.market.allotted[0] = 100;
    town.market.allotted[1] = 100;
    town.market.price[0] = 1;
    town.market.price[1] = 1;
    stepSeason(town);
    expect(town.market.bought[0]).toBeGreaterThan(town.market.bought[1]);
  });
});

describe("the market term scores what a work would FETCH", () => {
  it("wants the sawpit more where timber is dear than where it is cheap", () => {
    // §3.5.4's second edit to the auction: `trade x priceOf x access` in place of
    // a flat constant. It is what turns the term from a fact about the catalogue
    // into an argument about this place.
    const build = (price: number) => {
      const t = open(mixedTown({ population: 300, wealth: 5000 }));
      t.market.price[1] = price;
      return scoreWork(t, "sawpit").find((x) => x.key === "market")!.weight;
    };
    expect(build(2)).toBeGreaterThan(build(0.3));
  });

  it("gives a port whose quay has burned no market argument at all", () => {
    // [HC-85] again, now inside the auction: there is no money in it if nothing
    // can leave. The other four terms still speak.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    for (const w of town.works) if (w.kind === "warehouse" || w.kind === "fishingShacks") w.condition = "ruin";
    town.patron = { kind: "none", name: "", owns: false };
    const terms = scoreWork(town, "warehouse");
    expect(derive(town).access).toBe(0);
    expect(terms.find((t) => t.key === "market")).toBeUndefined();
    expect(terms.length).toBeGreaterThan(0);
  });

  it("still says there is money in it, in the same words", () => {
    // The clause is the term's own, and the rule is that no term arrives without
    // one. Rewriting the arithmetic must not cost the sentence.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    const market = scoreWork(town, "warehouse").find((t) => t.key === "market");
    expect(market!.clause).toBe("there is money in it");
  });

  it("argues for the cane where sugar pays and for the farm where the bread is bought", () => {
    // "The fork is then honest arithmetic: `need` argues for the farm, `market`
    // argues for the cane. Self-sufficiency wins in a small town and loses in a
    // big one, WITH NO THRESHOLD ANYWHERE."
    const town = open(mixedTown({ population: 400, wealth: 5000 }));
    for (const w of town.works) if (w.kind === "gardenPlots") w.condition = "ruin";
    stepSeason(town);

    town.market.price[2] = 4; // sugar is dear
    const cane = scoreWork(town, "caneField").find((t) => t.key === "market")!.weight;
    const farm = scoreWork(town, "provisionGround").find((t) => t.key === "need")!.weight;
    expect(cane).toBeGreaterThan(0);
    expect(farm).toBeGreaterThan(0); // both are heard; neither is switched off
  });

  it("weighs a work with no cargo class on access alone", () => {
    // A customs house fills no hold, so no price moves it — only whether the
    // traffic can reach the quay at all.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    const before = scoreWork(town, "customsHouse").find((t) => t.key === "market")!.weight;
    town.market.price[0] = 9;
    town.market.price[1] = 9;
    town.market.price[2] = 9;
    const after = scoreWork(town, "customsHouse").find((t) => t.key === "market")!.weight;
    expect(after).toBe(before);
  });
});

describe("dependency", () => {
  it("counts the share of a town's bread that is not off its own ground", () => {
    expect(dependencyOf(100, 100)).toBe(0);
    expect(dependencyOf(66, 100)).toBeCloseTo(0.34, 6);
    expect(dependencyOf(0, 100)).toBe(1);
    expect(dependencyOf(200, 100)).toBe(0); // a surplus is not a negative dependency
  });

  it("is scored identically for every place, whatever the place is for", () => {
    // [HC-81], and the ratified load-bearing line: importing never silences the
    // wish for a farm. A military settlement and a colony on identical ground
    // read identically — what purpose changes is what the governor may DO.
    const build = (archetype: Town["archetype"]) => {
      const t = open(mixedTown({ population: 300, wealth: 2000, archetype }));
      stepSeason(t);
      return derive(t).dependency;
    };
    expect(build("royalOutpost")).toBe(build("colony"));
    expect(build("pirateHaven")).toBe(build("colony"));
  });

  it("still asks for a farm though the bread is bought", () => {
    // The food term rebased from hunger to dependency (§3.5.4). A town buying a
    // third of its corn scores a third WITH FULL BELLIES, and says so.
    const town = open(townOf([reg(0, "roadstead", RING2.slice(0, 3), { bears: { fish: "fair" } })], {
      population: 300,
      wealth: 3000,
    }));
    stepSeason(town);
    const d = derive(town);
    expect(d.dependency).toBeGreaterThan(0.5);
    expect(d.needs.food).toBe(d.dependency);
    expect(dependencyWord(d.dependency)).toBe("fed from the sea");
  });

  it("says it in the governor's own words", () => {
    const town = open(townOf([reg(0, "roadstead", RING2.slice(0, 3), { bears: { fish: "fair" } })], {
      population: 400,
      wealth: 3000,
    }));
    stepSeason(town);
    const terms = scoreWork(town, "provisionGround");
    const need = terms.find((t) => t.key === "need");
    expect(need).toBeDefined();
    expect(need!.clause).toBe(DEPENDENCY_CLAUSE);
  });

  it("gives a self-feeding town no wish for a farm at all", () => {
    const town = open(bareTown({ population: 60, wealth: 500 }));
    stepYears(town, 4);
    expect(derive(town).dependency).toBe(0);
    expect(dependencyWord(0)).toBe("self-feeding");
  });
});

describe("materials gate construction", () => {
  // §3.5.3, and it is what makes the second class worth having: a town that
  // cannot get timber and stone CANNOT BUILD, however rich it is. Razing the
  // quay of a stone-poor island stops it rebuilding its wall. Its coffers may be
  // full; it simply cannot get the stone.
  function stonePoor(): Town {
    const t = seaTown({ population: 200, wealth: 200000 });
    raise(t, "warehouse", 1650);
    raise(t, "customsHouse", 1650);
    stepSeason(t);
    return t;
  }

  it("stops a town with full coffers and idle hands raising anything at all", () => {
    const town = stonePoor();
    expect(town.wealth).toBeGreaterThan(100000);
    expect(wants(town, 12).every((w) => !w.supplied)).toBe(true);
    expect(governorTurn(town, 1700)).toBeNull();
  });

  it("lets it build again the season the timber arrives", () => {
    const town = stonePoor();
    const before = town.works.length;
    town.market.bought[1] = 100; // a shipload of planks
    expect(wants(town, 12).some((w) => w.supplied)).toBe(true);
    governorTurn(town, 1700);
    expect(town.works.length).toBeGreaterThan(before);
  });

  it("never gates the hamlet floor — people roof their own houses", () => {
    // The floor must survive a total blockade or a sacked town could not crawl
    // back, which is the one thing the whole ledger is built to guarantee.
    const town = seaTown({ population: 200, wealth: 0 });
    stepYears(town, 6);
    expect(town.works.some((w) => w.kind === "dwellings")).toBe(true);
  });

  it("says nothing about what the town WANTS, only about what it can start", () => {
    // The same shape as the affordable and manned gates: wealth is not a term,
    // and neither is this. The ranking must be identical either way.
    const poor = stonePoor();
    const supplied = stonePoor();
    supplied.market.bought[1] = 100;
    expect(wants(supplied, 12).map((w) => w.kind)).toEqual(wants(poor, 12).map((w) => w.kind));
  });
});

describe("luxury is a need with teeth", () => {
  it("goes short without it, and says so as a number rather than a shrug", () => {
    const town = open(mixedTown({ population: 300, wealth: 3000 }));
    stepSeason(town);
    expect(derive(town).commerce.luxuryShort).toBe(1); // no cane, no sugar, no silk
  });

  it("is answered by cargo, and only by cargo", () => {
    // [HC-80]: luxury is TRADE CARGO, never the default plunder payout. The only
    // way a place gets any is to grow it or to buy it.
    const grown = open(mixedTown({ population: 300, wealth: 9000 }));
    raise(grown, "caneField", 1650);
    raise(grown, "boilingHouse", 1650);
    stepSeason(grown);
    expect(derive(grown).commerce.produced[2]).toBeGreaterThan(0);

    const bought = open(mixedTown({ population: 300, wealth: 9000 }));
    stepSeason(bought);
    bought.market.bought[2] = 100;
    expect(derive(bought).commerce.luxuryShort).toBe(0);
  });

  it("costs a town its comfort, and nothing like its life ([HC-79])", () => {
    // MILD, or the original objection comes back and every well-fed town reads as
    // miserable for want of silk.
    const without = open(mixedTown({ population: 300, wealth: 3000 }));
    const with_ = open(mixedTown({ population: 300, wealth: 3000 }));
    stepSeason(without);
    stepSeason(with_);
    with_.market.bought[2] = 100;

    const dw = derive(without);
    const dh = derive(with_);
    const gap = prosperityTarget(with_, dh) - prosperityTarget(without, dw);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(10);
  });
});

describe("a town fed from the sea is not a town on its knees", () => {
  it("does not read as failing merely because it imports", () => {
    // [HC-74]. `prosperityTarget` used to score surplus/head POSITIVELY, and a
    // place fed from the sea has negative surplus by design — so every large
    // town read as "on its knees" the moment imports existed. Dependency
    // replaces it as a MILD negative.
    const fed = open(mixedTown({ population: 300, wealth: 4000 }));
    const own = open(mixedTown({ population: 300, wealth: 4000 }));
    raise(fed, "sawpit", 1650);
    raise(own, "sawpit", 1650);
    stepSeason(fed);
    stepSeason(own);
    // The fed town's fields are taken away and the shipping makes up the whole
    // difference: same souls, same coin, bread off a ship.
    for (const w of fed.works) if (w.kind === "gardenPlots") w.condition = "ruin";
    clearedWith(fed, 0, 400, 0.25);
    fed.market.bought[0] = 400;

    const df = derive(fed);
    const dm = derive(own);
    expect(df.dependency).toBeGreaterThan(0.5);
    const gap = prosperityTarget(own, dm) - prosperityTarget(fed, df);
    expect(gap).toBeGreaterThan(0); // it costs it something...
    expect(gap).toBeLessThan(20); // ...but nothing like a collapse. MILD ([HC-79]).
  });
});

describe("reproducibility", () => {
  it("gives the same commerce from the same start and the same steps", () => {
    const a = open(mixedTown({ population: 250, wealth: 4000 }));
    const b = open(mixedTown({ population: 250, wealth: 4000 }));
    for (let i = 0; i < 200; i++) {
      clearedWith(a, 0, 20, 0.3);
      clearedWith(b, 0, 20, 0.3);
      stepSeason(a);
      stepSeason(b);
    }
    expect(b).toEqual(a);
  });

  it("does not care what order the works were entered in", () => {
    const build = (reversed: boolean) => {
      const t = open(mixedTown({ population: 500, wealth: 20000 }));
      raise(t, "sawpit", 1650);
      raise(t, "caneField", 1650);
      if (reversed) t.works.reverse();
      stepSeason(t);
      return derive(t).commerce.earned;
    };
    expect(build(true)).toBeCloseTo(build(false), 9);
  });
});

// RING1 is used by the fixtures above through `bareTown`/`mixedTown`; naming it
// here keeps the import honest.
export const _ring = RING1.length;
