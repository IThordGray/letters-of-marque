// The trading engine, town side — a town sells what it has spare, buys what it
// lacks, and its wealth is the difference.
//
// Every claim here is warranted by world-simulation.md §11 or town-economy.md
// §3.5, never by what the code happens to do. Fixtures are built against the
// STRUCT (testing.md's fixture rule): a hand-written `market` block is exactly
// how the world hands a place its cleared trade ([HC-72]), so nothing here
// depends on the clearing, and the clearing is pinned separately.

import { describe, it, expect } from "vitest";
import { derive, settleSeason, stepSeason, stepSeasons, stepYears, takeWeather, carryingCapacity, prosperityTarget } from "./sim";
import { CAPITAL, CATALOGUE, raise } from "./works";
import { accessOf, buyFrom, cargoOf, dependencyOf, dependencyWord, fetchOf, priceOf, producesMaterials, quaysideOf, sellTo, DEPENDENCY_CLAUSE } from "./trade";
import { TRADE, WEALTH, WORKS } from "./constants";
import { deepWants, focusWants, governorTurn, permitsFocus, scoreWork, wants, type Built, type Decision, type Deepened } from "./governor";
import { mixedTown, bareTown, seaTown, townOf, reg, RING1, RING2 } from "./fixtures";
import type { Town } from "./types";
import { CALENDAR } from "../overworld/calendar";

// THE WORLD HANDS THE TOWN THE DAY (KAN-107), so a test that steps a town has to
// play the world and say which day it is. These fixtures stand on the world's
// first day; `open()` below spends that first season raising a quay, so anything
// after it begins on the second.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;
const AFTER_OPENING = DAY0 + SEASON;

// A season's one decision may be a work or a region focus, and every claim below
// is about the work half — "he cannot build" is not "the season came to
// nothing", and after the focus auction landed beside the work auction those
// stopped being the same sentence.
const built = (d: Decision | null): Built | null => (d !== null && d.kind === "work" ? d : null);
const deepened = (d: Decision | null): Deepened | null => (d !== null && d.kind === "deepening" ? d : null);

// The shipping calling as usual — what an uncleared town faces, and what the
// world writes when no squadron is holding anything. Spelled out rather than
// written `1` because a bare one here is a whole half of `access`.
const FULL_REACH = 1;

// A place with a quay, so it can trade at all — access gates both directions and
// a town with neither quay nor guns is deliberately shut out ([HC-85]).
function open(town: Town): Town {
  raise(town, "warehouse", DAY0);
  stepSeason(town, DAY0);
  return town;
}

// The world's half of the season, done by hand: the clearing found this much for
// the place to buy, at this price.
function clearedWith(town: Town, cls: number, allotted: number, price = 1): Town {
  town.market.allotted[cls] = allotted;
  town.market.price[cls] = price;
  return town;
}

// ...and the other half of what the world hands in: how much of the shipping
// still calls. A squadron across every lane is `0`; nothing holding anything is
// `FULL_REACH`. The world writes this in the clearing (`overworld/market.ts`);
// written by hand here for the same reason the price is — a town-scale claim
// must not depend on the clearing, which is pinned separately.
function reaching(town: Town, reach: number): Town {
  town.market.reach = reach;
  return town;
}

describe("access is reach times readiness", () => {
  // KAN-112. `access` used to be built entirely out of the place's own works and
  // its own security, which is why a blockade could not be expressed at all: the
  // waterfront works that carried it are SUBSISTENCE, so the hamlet floor raised
  // them again for nothing every season ([HC-67] doing exactly its job) and
  // burning a quay was a season's inconvenience rather than a siege. §11.6 says
  // in as many words that this is not an upgrade — it is the thing that makes
  // [HC-87] true of the world rather than of one town.

  it("moves nothing when the shipping stops calling, however sound the quay", () => {
    // The blockade, at town scale. Nothing about the place has changed: same
    // warehouse, same customs house, same guns.
    const town = open(seaTown({ population: 300, wealth: 5000 }));
    raise(town, "customsHouse", DAY0);
    raise(town, "sawpit", DAY0);
    stepSeason(town, AFTER_OPENING);
    const before = derive(town);
    expect(before.access).toBeGreaterThan(0);

    reaching(town, 0);
    const after = derive(town);
    expect(after.access).toBe(0);
    expect(after.commerce.offer[1]).toBe(0);
    expect(after.commerce.want[0]).toBe(0);
    expect(after.commerce.earned).toBe(0);
  });

  it("moves nothing over a shore with no quay and no guns, though every lane is open", () => {
    // ...and the other half of the product. [HC-85] in its ratified words — "no
    // quay, no security -> nothing moves either way" — survives the change, so
    // routes reaching a place are never on their own enough to trade.
    const town = bareTown({ population: 160 });
    stepYears(town, 5);
    reaching(town, FULL_REACH);
    expect(derive(town).access).toBe(0);
  });

  it("needs both halves, and neither one of them twice", () => {
    // A product, and the arithmetic is written out rather than read back off the
    // code under test: half the lanes open halves what the same quay can move.
    const build = (reach: number) => {
      const t = open(seaTown({ population: 300, wealth: 5000 }));
      raise(t, "customsHouse", DAY0);
      stepSeason(t, AFTER_OPENING);
      return derive(reaching(t, reach)).access;
    };
    expect(build(0.5)).toBeCloseTo(build(1) * 0.5, 12);
    expect(build(0.25)).toBeCloseTo(build(1) * 0.25, 12);
  });

  it("gates a shut port in BOTH directions — it cannot sell and it cannot buy", () => {
    // [HC-85], and the whole reason raiding and trade are one mechanism seen
    // from two sides. A town with corn to sell and timber to buy does neither.
    const town = open(mixedTown({ population: 400, wealth: 8000 }));
    raise(town, "caneField", DAY0);
    stepSeason(town, AFTER_OPENING);
    const before = derive(town);
    expect(before.commerce.offer[2] + before.commerce.want[1]).toBeGreaterThan(0);

    reaching(town, 0);
    const after = derive(town);
    for (let c = 0; c < after.commerce.offer.length; c++) {
      expect(after.commerce.offer[c]).toBe(0);
      expect(after.commerce.want[c]).toBe(0);
    }
  });
});

describe("the hamlet floor opens a beach; it cannot build a port", () => {
  // The bug [HC-87]'s note on the spec names: the waterfront works that carried
  // access are subsistence, so three fishing shacks bought nine tenths of the
  // scale for nothing and, with any garrison at all, HALF THE WORLD SAT AT FULL
  // ACCESS ON A STRAND (measured: median access 1.00 across four seeds).

  // Waterfront works, as a bare list — the arithmetic stated directly rather
  // than through a fixture that could be raising something else as well.
  const beached = (n: number, ...also: string[]): never[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push("fishingShacks");
    return [...out, ...also].map((kind) => ({ kind, trade: 0 })) as never[];
  };

  it("counts a second boat on the sand and not a third, because a strand is not a harbour", () => {
    // The cap, in the one place it can be said without ambiguity. It is stated
    // as a relationship and never as a value: `strandQuays` is a starting guess
    // like every other number in `constants.ts`, and what must not move is the
    // SHAPE — the strand stops, and a berth somebody paid for does not.
    const one = accessOf(beached(1), 0, FULL_REACH);
    const two = accessOf(beached(2), 0, FULL_REACH);
    const three = accessOf(beached(3), 0, FULL_REACH);
    expect(two).toBeGreaterThan(one);
    expect(three).toBe(two); // ...and there it stops
    expect(accessOf(beached(3, "warehouse"), 0, FULL_REACH)).toBeGreaterThan(three);
  });

  // A place with a crown at its back, a wall, a reef to fish and no quay anyone
  // paid for: the hamlet floor and nothing else on the waterfront. Before
  // KAN-112 this fixture read access 1.00 — full, on a beach, for nothing.
  function strand(): Town {
    const t = mixedTown({ population: 300, wealth: 400 });
    t.patron = { kind: "crown", name: "the crown", owns: true };
    raise(t, "palisade", DAY0);
    stepYears(t, 6, DAY0);
    return t;
  }

  it("cannot reach full access on boats the floor drew up for nothing", () => {
    const t = strand();
    expect(t.works.some((w) => w.kind === "fishingShacks" && w.condition === "working")).toBe(true);
    expect(
      t.works.every((w) => CATALOGUE[w.kind].zone !== "waterfront" || CATALOGUE[w.kind].cls === "subsistence"),
    ).toBe(true);
    const d = derive(t);
    expect(d.access).toBeGreaterThan(0); // a beach still moves some cargo
    expect(d.access).toBeLessThan(1); // ...and never all of it
  });

  it("is what a quay is FOR: building one moves what the strand could not", () => {
    // The pair, differing in exactly one respect. Somebody has to pay for the
    // difference, which is the whole of the rule.
    const beach = strand();
    const ported = strand();
    raise(ported, "warehouse", DAY0);
    raise(ported, "customsHouse", DAY0);
    stepSeason(ported, DAY0);
    expect(derive(ported).access).toBeGreaterThan(derive(beach).access);
  });

  it("does not come back to full access when the floor raises the shacks again", () => {
    // THE CLAIM THE STORY EXISTS FOR, at town scale. Burn the whole waterfront;
    // the floor raises it again for nothing, exactly as [HC-67] says it must —
    // and the place is not a port again, because a strand never was one.
    const t = strand();
    const before = derive(t).access;

    for (const w of t.works) if (CATALOGUE[w.kind].zone === "waterfront") w.condition = "ruin";
    expect(derive(t).access).toBeLessThan(before);

    stepSeasons(t, 4, DAY0);

    // [HC-67] IS NOT WEAKENED: the shacks are back, free, and they move cargo.
    expect(t.works.some((w) => w.kind === "fishingShacks" && w.condition === "working")).toBe(true);
    expect(derive(t).access).toBeGreaterThan(0);
    // ...and a free rebuild still cannot buy the top of the scale.
    expect(derive(t).access).toBeLessThan(1);
  });
});

describe("wealth is earned, not emitted", () => {
  it("earns more from the same sawpit where its timber fetches more", () => {
    // The whole of the change: `trade` stopped being coin a work produced and
    // became what it sends to the quay. Price is what someone paid for it, so
    // the same work in the same town is worth what the market says it is worth.
    const rich = open(seaTown({ population: 300, wealth: 2000 }));
    const poor = open(seaTown({ population: 300, wealth: 2000 }));
    raise(rich, "sawpit", DAY0);
    raise(poor, "sawpit", DAY0);
    stepSeason(rich, AFTER_OPENING);
    stepSeason(poor, AFTER_OPENING);

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
    raise(town, "sawpit", DAY0);
    stepSeason(town, AFTER_OPENING);
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
    expect(accessOf(working, 0, FULL_REACH)).toBeGreaterThan(0);
    expect(accessOf([], 0, FULL_REACH)).toBe(0);
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
      raise(t, "warehouse", DAY0);
      raise(t, "customsHouse", DAY0);
      if (cargo) {
        raise(t, "sawpit", DAY0);
        raise(t, "sawpit", DAY0);
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
    raise(town, "provisionGround", DAY0);
    stepSeason(town, AFTER_OPENING);
    const d = derive(town);
    expect(d.commerce.want[0]).toBe(0);
  });
});

describe("the ceiling is fragile, and the raid consequence IS the ceiling", () => {
  // [HC-87]: nothing separate implements "raiding hurts" — this is it. A
  // trade-fed town falls back toward what its own ground grows the moment its
  // quay stops working, because the bought half of the sum simply stops
  // arriving. Stated on a place whose only waterfront works are CAPITAL ones, so
  // the quay stays shut: subsistence works raise themselves again for nothing,
  // which is the hamlet floor doing its job and not a hole in the rule.
  function seaFed(): Town {
    const t = seaTown({ population: 60, wealth: 500000 });
    raise(t, "warehouse", DAY0);
    raise(t, "customsHouse", DAY0);
    raise(t, "sawpit", DAY0);
    stepSeason(t, DAY0);
    return t;
  }

  // A season's worth of grain landed on the quay, as the world would hand it in —
  // and the day with it. Returns the day the next season would begin on, so a
  // caller that keeps running the town does not silently restart its clock.
  const fedFor = (town: Town, seasons: number, from = AFTER_OPENING): number => {
    for (let i = 0; i < seasons; i++) {
      clearedWith(town, 0, 1600, TRADE.basePrice[0]);
      stepSeason(town, from + i * SEASON);
    }
    return from + seasons * SEASON;
  };

  it("carries far more souls on bought bread than its own ground could feed", () => {
    const town = seaFed();
    fedFor(town, 200);
    expect(derive(town).commerce.produced[0]).toBe(0); // not one acre of its own
    expect(town.population).toBeGreaterThan(450); // and far past the old cap
  });

  it("falls back toward the hamlet floor when the quay stops", () => {
    const town = seaFed();
    const quayStops = fedFor(town, 200);
    const before = town.population;

    for (const w of town.works) if (CATALOGUE[w.kind].zone === "waterfront") w.condition = "ruin";
    stepSeasons(town, 200, quayStops); // nothing comes over the beach

    expect(derive(town).access).toBe(0);
    expect(derive(town).commerce.want[0]).toBe(0); // it cannot even ask
    expect(town.population).toBeLessThan(before * 0.2);
  });
});

describe("bread before batteries", () => {
  it("pays the quay before the governor ever sees the coin", () => {
    // [HC-78]. The import is inside the flow, not beside it, so a town that
    // spends all it makes on corn never reaches its wall.
    const town = open(mixedTown({ population: 300, wealth: 1000 }));
    clearedWith(town, 0, 400, 1);
    const wealthBefore = town.wealth;
    stepSeason(town, AFTER_OPENING);
    expect(town.market.paid).toBeGreaterThan(0);
    expect(town.wealth).toBeLessThan(wealthBefore);
  });

  it("goes without rather than into debt when the corn costs more than it has", () => {
    const town = open(mixedTown({ population: 300, wealth: 40 }));
    clearedWith(town, 0, 5000, 1);
    stepSeason(town, AFTER_OPENING);
    expect(town.wealth).toBeGreaterThanOrEqual(0);
    expect(town.market.bought[0]).toBeLessThan(5000);
  });

  it("buys its bread before its timber when it can afford only one", () => {
    // Tier order is the pyramid again: whatever is left after the corn buys the
    // timber, and whatever is left after that buys the silk.
    //
    // THE PURSE IS THE TOWN'S OWN COIN, and it has to be, since KAN-132: a place
    // with nothing crossing its quay earns nothing from it, so a fixture with an
    // empty purse and no cargo now has nothing to pay with and the claim would
    // pass for the wrong reason — nothing bought on EITHER tier. It used to be
    // funded by the standing quayside allowance, which is exactly the coin from
    // nowhere the story removed.
    const town = open(mixedTown({ population: 300, wealth: 120 }));
    town.market.allotted[0] = 100;
    town.market.allotted[1] = 100;
    town.market.price[0] = 1;
    town.market.price[1] = 1;
    stepSeason(town, AFTER_OPENING);
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
      return scoreWork(t, "sawpit", AFTER_OPENING).find((x) => x.key === "market")!.weight;
    };
    expect(build(2)).toBeGreaterThan(build(0.3));
  });

  it("gives a port whose quay has burned no market argument at all", () => {
    // [HC-85] again, now inside the auction: there is no money in it if nothing
    // can leave. The other four terms still speak.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    for (const w of town.works) if (w.kind === "warehouse" || w.kind === "fishingShacks") w.condition = "ruin";
    town.patron = { kind: "none", name: "", owns: false };
    const terms = scoreWork(town, "warehouse", AFTER_OPENING);
    expect(derive(town).access).toBe(0);
    expect(terms.find((t) => t.key === "market")).toBeUndefined();
    expect(terms.length).toBeGreaterThan(0);
  });

  it("still says there is money in it, in the same words", () => {
    // The clause is the term's own, and the rule is that no term arrives without
    // one. Rewriting the arithmetic must not cost the sentence.
    //
    // THE PLACE HAS TO HAVE TRADE IN IT NOW (KAN-132): a warehouse argues from a
    // cut of what crosses the quay, so a town with nothing crossing has no
    // market argument for one — which is the right answer and not a lost clause.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    raise(town, "sawpit", DAY0);
    stepSeason(town, AFTER_OPENING);
    const market = scoreWork(town, "warehouse", AFTER_OPENING).find((t) => t.key === "market");
    expect(market!.clause).toBe("there is money in it");
  });

  it("argues for the cane where sugar pays and for the farm where the bread is bought", () => {
    // "The fork is then honest arithmetic: `need` argues for the farm, `market`
    // argues for the cane. Self-sufficiency wins in a small town and loses in a
    // big one, WITH NO THRESHOLD ANYWHERE."
    const town = open(mixedTown({ population: 400, wealth: 5000 }));
    for (const w of town.works) if (w.kind === "gardenPlots") w.condition = "ruin";
    stepSeason(town, AFTER_OPENING);

    town.market.price[2] = 4; // sugar is dear
    const cane = scoreWork(town, "caneField", AFTER_OPENING).find((t) => t.key === "market")!.weight;
    const farm = scoreWork(town, "provisionGround", AFTER_OPENING).find((t) => t.key === "need")!.weight;
    expect(cane).toBeGreaterThan(0);
    expect(farm).toBeGreaterThan(0); // both are heard; neither is switched off
  });

  it("weighs a work with no cargo class on how busy the quay is", () => {
    // A customs house fills no hold, so no cargo's price prices IT — what it is
    // worth is a cut of whatever crosses, and the governor has to argue from the
    // same number the ledger will pay him on ([P-47]).
    //
    // THIS CLAIM IS THE REVERSE OF THE ONE IT REPLACES, and the reversal is the
    // story. It used to read "on access alone", and it was true: the term was
    // `trade x access`, so a hamlet that had raised a customs house and a port
    // of fifteen hundred bid identically for the next one.
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    const marketWeight = (t: Town) => scoreWork(t, "customsHouse", AFTER_OPENING).find((x) => x.key === "market")?.weight ?? 0;
    // Nothing crosses this quay, so there is no argument for another berth.
    expect(derive(town).commerce.traffic).toBe(0);
    expect(marketWeight(town)).toBe(0);
    // Land a cargo on it and there is.
    town.market.bought[0] = 200;
    town.market.price[0] = 0.5;
    const busier = marketWeight(town);
    expect(busier).toBeGreaterThan(0);
    // ...and the busier it gets the more it is worth, which a standing allowance
    // could never say.
    town.market.bought[0] = 800;
    expect(marketWeight(town)).toBeGreaterThan(busier);
  });
});

describe("a cargo's class comes off the ground", () => {
  // §2.12.13. The class a cargo lands in used to be a hand-written column on the
  // WORK — so a town's place in [HC-77]'s pyramid was a property of which
  // buildings its governor happened to pick. Keyed to the PRODUCE, it becomes a
  // property of the coast the place was founded on.

  it("puts two towns with the same works on different ground in different markets", () => {
    // THE CLAIM THE WHOLE STORY EXISTS FOR, said as a sentence about two towns:
    // "two towns with the same works and different ground are now different
    // towns on the world market." One work, one kind of ground apiece, and the
    // cargo comes out in two different columns.
    //
    // THE ORACLE IS THE SPEC'S OWN TABLE, written out here rather than read off
    // `PRODUCE_CLASS`: victuals = food · fish · grain, materials = timber ·
    // stone, luxury = cane · cotton.
    const on = (terrain: "caneFlats" | "cottonGround" | "timberedHills", bears: Parameters<typeof reg>[3]) =>
      townOf([reg(0, terrain, RING1.slice(0, 5), bears)], { population: 200, wealth: 9000 });
    const canes = on("caneFlats", { bears: { cane: "ideal" } });
    const cotton = on("cottonGround", { bears: { cotton: "ideal" } });
    const hills = on("timberedHills", { bears: { timber: "ideal" } });

    expect(cargoOf("caneField")).toBe("luxury");
    expect(cargoOf("cottonWalk")).toBe("luxury");
    expect(cargoOf("sawpit")).toBe("materials");
    expect(cargoOf("grainFields")).toBe("victuals");
    expect(cargoOf("provisionGround")).toBe("victuals");
    expect(cargoOf("fishingShacks")).toBe("victuals");

    // ...and the ledger agrees with the table, which is the half a comment
    // cannot assert. Same catalogue, same population, different coast.
    raise(canes, "caneField", DAY0);
    raise(cotton, "cottonWalk", DAY0);
    raise(hills, "sawpit", DAY0);
    const luxuryOf = (t: Town) => derive(t).commerce.produced[2];
    const materialsOf = (t: Town) => derive(t).commerce.produced[1];
    expect(luxuryOf(canes)).toBeGreaterThan(0);
    expect(luxuryOf(cotton)).toBeGreaterThan(0);
    expect(materialsOf(cotton)).toBe(0);
    expect(materialsOf(hills)).toBeGreaterThan(0);
    expect(luxuryOf(hills)).toBe(0);
  });

  it("gives a work that grows nothing no cargo class, and it earns a cut of the traffic", () => {
    // §2.12.13's FIRST CONSEQUENCE, and the list is the spec's: a warehouse, a
    // customs house, a tavern, a market — and the shipway, which joined them
    // when it became a harbour work.
    for (const kind of ["warehouse", "customsHouse", "tavern", "market", "shipway"] as const) {
      expect(cargoOf(kind), `${kind} fills a hold`).toBeNull();
    }
    const town = open(mixedTown({ population: 300, wealth: 5000 }));
    // No price anywhere moves what it fetches, because there is nothing in the
    // barrel to price — it is priced on how busy the quay is. The oracle is
    // SPELLED OUT rather than fetched (testing.md: write the oracle out
    // independently), which is what would catch a term added to `busynessOf`.
    const traffic = 9;
    expect(fetchOf(town, "customsHouse", 0.5, traffic)).toBeCloseTo(
      (CATALOGUE.customsHouse.trade * traffic) / (traffic + TRADE.quayBusyAt),
      9,
    );
    // ...and `access` is NOT in it, which is KAN-132's half of the same line:
    // the traffic has already been through the quay once ([P-47]).
    expect(fetchOf(town, "customsHouse", 0.1, traffic)).toBe(fetchOf(town, "customsHouse", 1, traffic));
  });

  it("keeps a work that fills a hold out of the cut of the traffic altogether", () => {
    // §2.12.13's first consequence from the other side, and it is the claim that
    // has teeth where the fishing-shack one below does not: `quaysideOf` sums
    // the `trade` of works with NO CARGO CLASS, so a sawpit's timber and a cane
    // field's sugar must be invisible to it however large their columns are.
    // They are sold at a price, to a buyer, and counting them here would pay for
    // the same cargo twice.
    //
    // WRITTEN WITH WORKS THAT HAVE A NON-ZERO `trade`, deliberately. The shack
    // claim below cannot catch a `quaysideOf` that counts everything, because a
    // shack's column is zero and zero is invisible either way — found by
    // mutation, which is the only way that kind of hole is ever found.
    const town = open(mixedTown({ population: 300, wealth: 9000 }));
    const TRAFFIC = 20; // the same quay, asked the same question, both times
    const bare = quaysideOf(town.works.filter((w) => w.condition === "working"), TRAFFIC);
    raise(town, "sawpit", DAY0);
    raise(town, "caneField", DAY0);
    stepSeason(town, AFTER_OPENING);
    const working = town.works.filter((w) => w.condition === "working");
    expect(working.some((w) => w.kind === "sawpit" && w.trade > 0)).toBe(true);
    expect(working.some((w) => w.kind === "caneField" && w.trade > 0)).toBe(true);
    expect(quaysideOf(working, TRAFFIC)).toBe(bare);
  });

  it("sends a fishing shack's catch to market as victuals, not as a cut of the traffic", () => {
    // THE ONE BEHAVIOUR THE RE-KEY MOVED IN THE SHIPPED CATALOGUE, and it is
    // written as a claim because KAN-131 measured `quaysideOf` at 58% of all
    // trade income in the world — so anything crossing that line moves a lever
    // out of proportion to its size.
    //
    // A shack used to carry `trade: 2` with `exports: null`, which paid it a cut
    // of the traffic: a customs house's wage, to a hut the hamlet floor draws up
    // on the sand for nothing. Fish is victuals. The two retired with the
    // mechanism that paid them, exactly as "the shipways want planks" did.
    const town = mixedTown({ population: 300, wealth: 5000 });
    stepSeason(town, DAY0);
    const working = () => town.works.filter((w) => w.condition === "working");
    const shacks = working().filter((w) => w.kind === "fishingShacks");
    expect(shacks.length, "the hamlet floor drew no boats up at all").toBeGreaterThan(0);

    // The shack contributes nothing to the cut of the traffic...
    const TRAFFIC = 20;
    const withShacks = quaysideOf(working(), TRAFFIC);
    const withoutShacks = quaysideOf(working().filter((w) => w.kind !== "fishingShacks"), TRAFFIC);
    expect(withShacks).toBe(withoutShacks);
    // ...and the LIVENESS half, or the claim above is also satisfied by a town
    // where nothing takes a cut of anything: a customs house still does.
    raise(town, "customsHouse", DAY0);
    stepSeason(town, DAY0 + SEASON);
    expect(quaysideOf(working(), TRAFFIC)).toBeGreaterThan(withShacks);
  });
});

// ---- KAN-132: the cut is a share of what actually crossed -------------------
//
// The ratified sentence is [HC-47] — "no money is created or destroyed outside
// this circulation... nothing is emitted from nowhere" — and this was the largest
// breach of it in the model. `quaysideOf` paid a work its whole `trade` column
// times `access` every season, at no price and to no buyer, whether or not a
// single bale crossed. Measured at day 0 on four warm worlds: a quayed place drew
// a median 27.00 a season against a median 16.16 of cargo actually crossing its
// quay, and the SAME 27.00 went to a hamlet and to a port of fifteen hundred.
//
// THE MUTATION EVERY CLAIM BELOW IS WRITTEN AGAINST is the restoration of that
// allowance — `quaysideOf` returning its column and ignoring its traffic.
describe("the quayside cut is a share of what crossed the quay", () => {
  // A port with a customs house on it, and timber to put over it.
  const port = () => {
    const town = open(seaTown({ population: 200, wealth: 6000 }));
    raise(town, "customsHouse", DAY0);
    raise(town, "sawpit", DAY0);
    stepSeason(town, AFTER_OPENING);
    return town;
  };
  const cut = (town: Town) =>
    quaysideOf(town.works.filter((w) => w.condition === "working"), derive(town).commerce.traffic);

  it("pays a quay nothing at all in a season when nothing crosses it", () => {
    // ACCEPTANCE 2, and the sentence the old code's own comment made while its
    // arithmetic did not: "a cut of what crosses the quay". A cordon is the
    // cleanest way to make nothing cross — [HC-85] gates both directions — and
    // the place is otherwise untouched: same customs house, same timber, same
    // guns. Under the flat allowance it went on drawing its column.
    const shut = reaching(port(), 0);
    expect(derive(shut).commerce.traffic).toBe(0);
    expect(cut(shut)).toBe(0);
    // LIVENESS, because zero satisfies almost any claim phrased as an absence:
    // the same place with its lanes open is paid, and paid something real.
    const calling = reaching(port(), FULL_REACH);
    expect(derive(calling).commerce.traffic).toBeGreaterThan(0);
    expect(cut(calling)).toBeGreaterThan(0);
  });

  it("pays a busy quay more than a quiet one holding the very same works", () => {
    // THE HEART OF IT, and the thing a standing allowance could not say. Two
    // ports with an identical waterfront differ only in how much cargo there is
    // to work — four sawpits on the same hills against one. It paid them
    // the same coin to the penny, which is why a hamlet with a customs house and
    // a great port were indistinguishable on this line.
    const build = (pits: number) => {
      const hills = reg(0, "timberedHills", RING1, { bears: { timber: "ideal" }, focus: "production" });
      const t = open(townOf([hills, reg(1, "roadstead", RING2.slice(0, 3))], { population: 300, wealth: 9000 }));
      raise(t, "customsHouse", DAY0);
      // Same ground, same hills, different number of pits on them — so the only
      // thing that differs is how much timber there is to put over the quay.
      for (let i = 0; i < pits; i++) raise(t, "sawpit", DAY0, hills);
      stepSeason(t, AFTER_OPENING);
      return t;
    };
    const busy = build(4);
    const quiet = build(1);
    // The waterfront is the same on both, which is what makes this a claim about
    // traffic rather than about buildings.
    const column = (t: Town) => t.works
      .filter((w) => w.condition === "working" && cargoOf(w.kind) === null)
      .reduce((n, w) => n + w.trade, 0);
    expect(column(busy)).toBe(column(quiet));
    expect(derive(busy).commerce.access).toBeCloseTo(derive(quiet).commerce.access, 9);
    // ...and the cut follows the cargo rather than the buildings.
    expect(derive(busy).commerce.traffic).toBeGreaterThan(derive(quiet).commerce.traffic);
    expect(cut(busy)).toBeGreaterThan(cut(quiet));
  });

  it("is dented by the storm that spoiled the cargo it would have taken a cut of", () => {
    // [HC-6]'s yield modifier reaching the quay, which it never did: the cut was
    // the one number in the ledger a storm could not touch. It needs no line of
    // its own — `harvestShare` is already inside the offer, and the offer is the
    // traffic.
    const fair = port();
    const foul = port();
    takeWeather(foul, DAY0, { yieldLoss: 0.8, maintenanceShare: 0, worksDropped: 0, worksDestroyed: 0 }, 0);
    expect(cut(foul)).toBeLessThan(cut(fair));
    expect(cut(foul)).toBeGreaterThan(0); // spoiled, not stopped
  });

  it("takes its cut at the price the cargo cleared at, not by the bale", () => {
    // THE OTHER HALF OF ACCEPTANCE 1 — "goods that actually moved, AT THE PRICE
    // THEY CLEARED AT" — and it needed a claim of its own: a `trafficOf` that
    // counted bales and ignored prices was caught by nothing else in the suite.
    // Two ports ship the identical timber; one of them is where timber is dear.
    const cheap = port();
    const dear = port();
    dear.market.price[1] = cheap.market.price[1] * 3;
    expect(derive(cheap).commerce.offer[1]).toBeCloseTo(derive(dear).commerce.offer[1], 9);
    expect(cut(dear)).toBeGreaterThan(cut(cheap));
  });

  it("counts what the place landed as well as what it shipped", () => {
    // BOTH DIRECTIONS, because [HC-85] gates both and a quay works both: a port
    // that lands a thousand bushels is a busy port whether or not it grew a
    // thing. It is also what keeps the cut load-bearing for [HC-87]'s trade-fed
    // ceiling — the sea-fed port whose own quay funds its grain.
    const landing = port();
    const empty = cut(landing);
    landing.market.bought[0] = 400;
    landing.market.price[0] = 0.2;
    expect(cut(landing)).toBeGreaterThan(empty);
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
      stepSeason(t, AFTER_OPENING);
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
    stepSeason(town, AFTER_OPENING);
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
    stepSeason(town, AFTER_OPENING);
    const terms = scoreWork(town, "provisionGround", AFTER_OPENING);
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
  //
  // WITH ONE EXEMPTION, RATIFIED 2026-09-16: a work that PRODUCES materials is
  // not gated by materials. You do not need planks to dig a sawpit — and without
  // that line the gate had a cliff at the FIRST capital work rather than the
  // second, because a place with none owes no materials bill and its first build
  // is free. Fifty-two places across four seeds sat frozen at exactly one capital
  // work and forty-eight had spent that one free build on a tavern; one of them
  // held 3,398 coin and could never dig the pit on its own timbered hills.
  //
  // `seaTown` is the fixture for both halves BECAUSE it has timbered hills and a
  // roadstead and nothing else: the one work it may raise is the one the
  // exemption is about.
  function stonePoor(): Town {
    const t = seaTown({ population: 200, wealth: 200000 });
    raise(t, "warehouse", DAY0);
    raise(t, "customsHouse", DAY0);
    stepSeason(t, DAY0);
    return t;
  }

  it("stops a town with full coffers and idle hands raising anything at all off the menu", () => {
    // THE MENU HAS NOTHING EXEMPT LEFT ON IT. The pit left the governor's list
    // with the other two crops (§2.12.12), and a `shipway` produces nothing, so
    // when the exemption re-keyed to the PRODUCE it stopped covering one —
    // which is the ticket's own sentence: you do need planks to lay down a
    // shipway. Every want a stone-poor place publishes is therefore refused.
    const town = stonePoor();
    expect(town.wealth).toBeGreaterThan(100000);
    const published = wants(town, AFTER_OPENING, 12);
    expect(published.length).toBeGreaterThan(0); // it still says what it wants
    for (const w of published) {
      expect(w.supplied, `${w.kind} answered the wrong way to a town that can get no planks`).toBe(false);
    }
  });

  it("digs the pit with no timber or stone to be had, and still cannot raise a warehouse", () => {
    // THE RULE ITSELF, in one sentence: timbered hills, coin, hands and not a
    // plank to be had — and the work that would END the shortage is the one work
    // he may start. The warehouse beside it is the control: same town, same
    // season, same purse, gated.
    //
    // THE VERB CHANGED AND THE RULE DID NOT. The pit arrives as a DEEPENING now
    // — that is the only verb left that raises one — so the exemption is read
    // off the deepening's own `supplied` flag rather than off a want's. Both
    // call `canBuildKind`, which is the single source ([P-47]).
    const town = stonePoor();
    town.regions[0].focus = "production"; // somebody gave the hills over
    const d = derive(town);
    expect(d.commerce.materialsShort).toBeGreaterThanOrEqual(TRADE.buildGate); // it can get none
    expect(d.commerce.bought[1]).toBe(0);
    expect(d.hands.available - d.hands.needed).toBeGreaterThan(CATALOGUE.sawpit.hands); // and hands to spare

    const pit = deepWants(town, d, 12).find((w) => w.kind === "sawpit");
    const store = wants(town, AFTER_OPENING, 12, d).find((w) => w.kind === "warehouse");
    expect(pit, "the hills bear timber and no pit was published").toBeDefined();
    expect(store, "the roadstead takes a warehouse and none was published").toBeDefined();
    expect(pit!.supplied).toBe(true);
    expect(store!.supplied).toBe(false);

    // ...and he does dig it, though it takes him a season or two to get round to
    // it: the season's one decision may go on deciding what other ground is for
    // before it goes on digging.
    let dug: string | undefined;
    for (let i = 0; i < 12 && dug === undefined; i++) {
      dug = deepened(governorTurn(town, AFTER_OPENING + i * SEASON))?.work.kind;
    }
    expect(dug).toBe("sawpit");
  });

  it("exempts exactly the works that produce timber or stone, and no others", () => {
    // THE DERIVATION ITSELF, guarded — and it needs guarding because the world
    // cannot guard it. RE-KEYED 2026-09-21 (§2.12.13): the rule reads `produces
    // ∈ {timber, stone}` rather than `exports === "materials"`. Same rule, same
    // single source, one indirection shorter — and one live consequence, which
    // is why this claim exists: the shipway used to be exempt and is not any
    // more.
    //
    // IT WALKS EVERY CAPITAL WORK, not the menu, because the one work the rule
    // is about is no longer ON the menu — a loop over `CHOOSABLE` would have
    // gone green by asking nothing.
    const PRODUCES_MATERIALS = ["sawpit"]; // the oracle, written out
    for (const kind of CAPITAL) {
      expect(producesMaterials(kind), `${kind} answered the wrong way`)
        .toBe(PRODUCES_MATERIALS.includes(kind));
    }
    expect(producesMaterials("shipway")).toBe(false); // said out loud, because it moved
  });

  it("you do need planks to lay down a shipway, and that is the change", () => {
    // THE LIVE CONSEQUENCE of re-keying the exemption to the produce, stated
    // behaviourally rather than as a property of a function. A shipway used to
    // be exempt because it exported materials; it produces none, and a harbour
    // work that takes its cut of the traffic is not a plank mill. It is the only
    // half of the old `timber -> sawpit -> planks -> shipway` chain worth
    // keeping, and the materials bill keeps it for nothing.
    const town = stonePoor();
    const shut = wants(town, AFTER_OPENING, 12).find((w) => w.kind === "shipway");
    expect(shut, "the roadstead takes a shipway and none was published").toBeDefined();
    expect(shut!.supplied).toBe(false);

    town.market.bought[1] = 400; // a shipload of planks
    expect(wants(town, AFTER_OPENING, 12).find((w) => w.kind === "shipway")!.supplied).toBe(true);
  });

  it("still cannot dig a pit where there are no hills to dig it in", () => {
    // The exemption is about the materials BILL, never about the ground. A place
    // with no timber is refused by `buildable` before the gate is ever asked, and
    // it must stay refused — otherwise the rule would have quietly handed every
    // stone-poor island a sawpit out of nowhere.
    const town = townOf([reg(0, "roadstead", RING1.slice(0, 3)), reg(1, "scrub", RING2.slice(0, 6))], {
      population: 200,
      wealth: 200000,
    });
    raise(town, "warehouse", DAY0);
    stepSeason(town, DAY0);
    expect(derive(town).commerce.materialsShort).toBeGreaterThanOrEqual(TRADE.buildGate);
    expect(raise(town, "sawpit", AFTER_OPENING)).toBeNull();
    expect(wants(town, AFTER_OPENING, 12).some((w) => w.kind === "sawpit")).toBe(false);
    expect(built(governorTurn(town, AFTER_OPENING))).toBeNull();
  });

  it("lets it build again the season the timber arrives", () => {
    // The gate lifting, asserted on a work the gate actually HOLDS — a warehouse,
    // not the exempt pit, or the claim would be true before the shipload landed.
    const town = stonePoor();
    const before = town.works.length;
    expect(wants(town, AFTER_OPENING, 12).find((w) => w.kind === "warehouse")!.supplied).toBe(false);
    town.market.bought[1] = 100; // a shipload of planks
    expect(wants(town, AFTER_OPENING, 12).find((w) => w.kind === "warehouse")!.supplied).toBe(true);
    // A SEASON IS ONE DECISION AND THERE ARE THREE KINDS OF IT, so "he builds
    // again" is a claim about the seasons after the shipload and not about the
    // very next one — some of them go on deciding what ground is for, which
    // costs no coin and raises nothing. Give him a few years and he builds.
    for (let i = 0; i < 12 && town.works.length === before; i++) governorTurn(town, AFTER_OPENING + i * SEASON);
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
    //
    // THE PLANKS ARE LANDED AND WORTH NOTHING AT THE QUAY, and that is the whole
    // of why a price of zero is written here. Since KAN-132 a LANDING IS TRAFFIC
    // and traffic is what a harbour work's market term argues from, so a
    // shipload landed at par changes the ranking for an entirely honest reason —
    // the quay got busier — and the claim would then be measuring that instead
    // of the gate. At nothing a bale the cargo still counts against the
    // shortfall, which is quantities, and moves no term.
    const poor = stonePoor();
    const supplied = stonePoor();
    poor.market.price[1] = 0;
    supplied.market.price[1] = 0;
    supplied.market.bought[1] = 100;
    expect(wants(supplied, AFTER_OPENING, 12).some((w) => w.supplied)).toBe(true);
    expect(wants(poor, AFTER_OPENING, 12).some((w) => w.supplied)).toBe(false);
    expect(wants(supplied, AFTER_OPENING, 12).map((w) => w.kind)).toEqual(wants(poor, AFTER_OPENING, 12).map((w) => w.kind));
  });
});

describe("luxury is a need with teeth", () => {
  it("goes short without it, and says so as a number rather than a shrug", () => {
    const town = open(mixedTown({ population: 300, wealth: 3000 }));
    stepSeason(town, AFTER_OPENING);
    expect(derive(town).commerce.luxuryShort).toBe(1); // no cane, no sugar, no silk
  });

  it("is answered by cargo, and only by cargo", () => {
    // [HC-80]: luxury is TRADE CARGO, never the default plunder payout. The only
    // way a place gets any is to grow it or to buy it.
    const grown = open(mixedTown({ population: 300, wealth: 9000 }));
    raise(grown, "caneField", DAY0);
    stepSeason(grown, AFTER_OPENING);
    expect(derive(grown).commerce.produced[2]).toBeGreaterThan(0);

    const bought = open(mixedTown({ population: 300, wealth: 9000 }));
    stepSeason(bought, AFTER_OPENING);
    bought.market.bought[2] = 100;
    expect(derive(bought).commerce.luxuryShort).toBe(0);
  });

  it("costs a town its comfort, and nothing like its life ([HC-79])", () => {
    // MILD, or the original objection comes back and every well-fed town reads as
    // miserable for want of silk.
    const without = open(mixedTown({ population: 300, wealth: 3000 }));
    const with_ = open(mixedTown({ population: 300, wealth: 3000 }));
    stepSeason(without, AFTER_OPENING);
    stepSeason(with_, AFTER_OPENING);
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
    raise(fed, "sawpit", DAY0);
    raise(own, "sawpit", DAY0);
    stepSeason(fed, AFTER_OPENING);
    stepSeason(own, AFTER_OPENING);
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

describe("the port seam", () => {
  // §3.5.7 exposes exactly three things: `derive(town).commerce`, a public pure
  // `priceOf()`, and two write-points. The player's VERBS are KAN-89; this is the
  // shape they will be built against.
  const opened = () => {
    const t = open(mixedTown({ population: 300, wealth: 5000 }));
    stepSeason(t, AFTER_OPENING);
    return t;
  };

  it("answers what a good costs here, and only here", () => {
    const town = opened();
    town.market.price[0] = 0.4;
    expect(priceOf(town, "victuals")).toBe(0.4);
    expect(priceOf(town, "materials")).not.toBe(0.4);
  });

  it("softens a price when cargo is landed and hardens it when cargo is lifted", () => {
    const landed = opened();
    const lifted = opened();
    const before = landed.market.price[1];
    sellTo(landed, "materials", 20, derive(landed));
    buyFrom(lifted, "materials", 20, derive(lifted));
    expect(landed.market.price[1]).toBeLessThan(before);
    expect(lifted.market.price[1]).toBeGreaterThan(before);
  });

  it("will not let one man buy out a town, however much he lands", () => {
    // [HC-88]. He is a small fish, and the cap is what keeps him one — otherwise
    // the first thing anyone discovers is the exploit.
    const town = opened();
    const before = town.market.price[1];
    buyFrom(town, "materials", 1e9, derive(town));
    expect(town.market.price[1]).toBeLessThanOrEqual(before * (1 + TRADE.nudgeCap));
  });

  it("moves a hamlet's price further than a great port's for the same cargo", () => {
    // The nudge is measured against the season's flow, so scale does the work and
    // no rule has to name a size.
    const small = opened();
    const great = opened();
    raise(great, "sawpit", DAY0);
    raise(great, "sawpit", DAY0);
    stepSeason(great, AFTER_OPENING);
    const a = small.market.price[1];
    const b = great.market.price[1];
    buyFrom(small, "materials", 1, derive(small));
    buyFrom(great, "materials", 1, derive(great));
    expect(small.market.price[1] / a).toBeGreaterThan(great.market.price[1] / b);
  });

  it("pays the town for what it lifts, and takes its coin for what it lands", () => {
    const town = opened();
    const before = town.wealth;
    buyFrom(town, "materials", 10, derive(town));
    expect(town.wealth).toBeGreaterThan(before);
    const mid = town.wealth;
    sellTo(town, "materials", 10, derive(town));
    expect(town.wealth).toBeLessThan(mid);
  });

  it("never spends coin the town has not got", () => {
    const town = open(mixedTown({ population: 300, wealth: 0 }));
    town.wealth = 0; // bare coffers at the moment the boat comes alongside
    const deal = sellTo(town, "materials", 1e6, derive(town));
    expect(town.wealth).toBe(0);
    expect(deal.coin).toBe(0);
  });
});

describe("what a purpose puts out of reach", () => {
  // §11.3. Dependency is scored identically for every place ([HC-81]); what a
  // purpose changes is what the governor may DO about it.
  // A garrison on thin ground: one grudging acre that WOULD bear a crop, a
  // roadstead, a stand of timber. It could raise a farm; the whole point is that
  // it never will.
  const onThatGround = (archetype: Town["archetype"]) => {
    const t = townOf(
      [
        reg(0, "roadstead", RING1.slice(0, 3)),
        reg(1, "timberedHills", RING1.slice(3, 5), { bears: { timber: "fair" } }),
        reg(2, "tilledGround", RING2.slice(0, 5), { bears: { food: "poor" } }),
        reg(3, "scrub", RING2.slice(5, 11)),
      ],
      { population: 200, wealth: 100000, archetype, grant: 40 },
    );
    raise(t, "warehouse", DAY0);
    stepSeason(t, DAY0);
    t.market.bought[0] = 400; // the crown's grant buys its bread
    t.market.bought[1] = 400;
    return t;
  };

  const outpost = () => onThatGround("royalOutpost");

  // A century of seasons, fed the same way throughout.
  const live = (t: Town, seasons: number) => {
    for (let i = 0; i < seasons; i++) {
      t.market.allotted[0] = 400;
      t.market.allotted[1] = 400;
      t.market.price[0] = TRADE.basePrice[0];
      t.market.price[1] = TRADE.basePrice[1];
      const day = AFTER_OPENING + i * SEASON;
      stepSeason(t, day);
      governorTurn(t, day);
    }
  };

  it("still asks for a farm, in the same words, and is heard", () => {
    // [HC-81] VERBATIM, and the place the wish is heard MOVED with the work.
    // Provision grounds left the menu (§2.12.12), so the want that used to carry
    // this clause is gone; the same clause is now the FOCUS auction's need term
    // on food ground — one level up, and governing both verbs at once. The
    // colony is the fixture because the outpost is refused the candidate
    // outright, which is the next claim and not this one.
    const t = onThatGround("colony");
    expect(derive(t).dependency).toBeGreaterThan(0.7);
    const wish = focusWants(t, derive(t), 99).find((w) => w.produce === "food");
    expect(wish).toBeDefined();
    expect(wish!.terms.some((x) => x.clause === DEPENDENCY_CLAUSE)).toBe(true);
  });

  it("and never builds one, though a colony on the same ground does", () => {
    // Paired deliberately. "The outpost has no farm" on its own is satisfied by
    // any town that never wanted one; the claim only means something beside a
    // place that WOULD have built it from the identical brief.
    //
    // THE GATE RE-KEYED FROM THE WORK TO THE PRODUCE (§5.1.2) and now reads one
    // level up — "a military purpose never sets a production focus on FOOD
    // GROUND" — so the outpost cannot reach a farm by the side door either.
    const garrison = outpost();
    const colony = onThatGround("colony");
    expect(permitsFocus(garrison, garrison.regions[2], "production")).toBe(false);
    expect(permitsFocus(colony, colony.regions[2], "production")).toBe(true);

    live(garrison, 400);
    live(colony, 400);

    expect(colony.works.some((w) => w.kind === "provisionGround")).toBe(true);
    expect(garrison.works.some((w) => w.kind === "provisionGround")).toBe(false);
    expect(garrison.works.length).toBeGreaterThan(3); // it built plenty of other things
  });

  it("puts nothing out of a colony's reach", () => {
    const t = open(mixedTown({ population: 300, wealth: 9000 }));
    expect(wants(t, AFTER_OPENING, 12).every((w) => w.permitted)).toBe(true);
  });
});

describe("reproducibility", () => {
  it("gives the same commerce from the same start and the same steps", () => {
    const a = open(mixedTown({ population: 250, wealth: 4000 }));
    const b = open(mixedTown({ population: 250, wealth: 4000 }));
    for (let i = 0; i < 200; i++) {
      clearedWith(a, 0, 20, 0.3);
      clearedWith(b, 0, 20, 0.3);
      stepSeason(a, AFTER_OPENING + i * SEASON);
      stepSeason(b, AFTER_OPENING + i * SEASON);
    }
    expect(b).toEqual(a);
  });

  it("does not care what order the works were entered in", () => {
    const build = (reversed: boolean) => {
      const t = open(mixedTown({ population: 500, wealth: 20000 }));
      raise(t, "sawpit", DAY0);
      raise(t, "caneField", DAY0);
      if (reversed) t.works.reverse();
      stepSeason(t, AFTER_OPENING);
      return derive(t).commerce.earned;
    };
    expect(build(true)).toBeCloseTo(build(false), 9);
  });
});

// ---- Wealth is EARNED, not emitted ([HC-47]) -------------------------------
//
// The world layer states it of crowns — "no money is created or destroyed
// outside this circulation... nothing is emitted from nowhere" — and §3.5 states
// the same principle of a town. These are the town half: what may put a coin in
// a purse, and what happens when nothing does.
//
// The MAP half — that nobody lands bread nobody grew — is claimed in
// `overworld/market.test.ts`, because it can only be said of a clearing.
describe("wealth is earned, not emitted", () => {
  it("gives a place that sells nothing and is sent nothing nothing at all", () => {
    // NO QUAY AND NO GUNS, so `access` is zero and [HC-85] shuts it out both
    // ways; no patron, so nothing arrives. There is then no term left that
    // could raise this purse, and the claim is that there is no OTHER term
    // either — a margin that appeared here would be emitted by definition.
    const town = bareTown({ population: 160, wealth: 500, grant: 0 });
    stepYears(town, 5);
    expect(derive(town).access).toBe(0);
    expect(derive(town).commerce.earned).toBe(0);

    const opening = town.wealth;
    const after5y = 5 * CALENDAR.seasonsPerYear * SEASON;
    let high = town.wealth;
    for (let i = 0; i < 400; i++) {
      stepSeason(town, after5y + i * SEASON);
      if (town.wealth > high) high = town.wealth;
    }
    expect(high).toBeLessThanOrEqual(opening);
    expect(town.wealth).toBe(0);

    // THE LIVENESS GUARD, and this claim needs one badly: "the purse never rose"
    // is also true of a town of nobody. The floor is written out from the two
    // definitions it depends on rather than read back off the sim — a garden
    // plot's hands against the share of souls who are hands.
    expect(town.population).toBeGreaterThan(CATALOGUE.gardenPlots.hands / WORKS.labourShare);
    expect(derive(town).food).toBeGreaterThan(0);
  });

  it("owes nothing either — a purse stops at nothing rather than going below it", () => {
    // The other side of the same line. A place whose people cost more than its
    // trade clears does not run up a debt and die of it; it simply has nothing.
    // That is what "hovering at its build cost for ever" actually is, and it is
    // deliberate — but it must never become a negative number, because a
    // negative purse would be a coin destroyed twice.
    const town = bareTown({ population: 300, wealth: 40, grant: 0 });
    for (let i = 0; i < 40; i++) {
      stepSeason(town, i * SEASON);
      expect(town.wealth).toBeGreaterThanOrEqual(0);
    }
    expect(derive(town).upkeep).toBeGreaterThan(derive(town).commerce.earned);
    expect(town.wealth).toBe(0);
  });

  it("adds exactly what it sold and what its patron sent, less its bread and its keep", () => {
    // THE WHOLE OF WHAT MAY TOUCH A PURSE IN A SEASON, written out by hand
    // rather than read back off `Derived.yield` — a claim that asked the code
    // what the answer should be could not catch a term ADDED to it, which is
    // exactly the mistake this rule exists for. Any new source of coin fails
    // this line, and that is the point: it is [HC-47]'s guard at town scale.
    //
    // THE PLACE LANDS THE SAME CARGO IT LANDED LAST SEASON, which is a steady
    // port rather than a contrivance — and since KAN-132 it has to be said out
    // loud, because THE QUAY'S CUT IS STRUCK ON WHAT LANDED. A season that lands
    // more than the one before it earns more on its quay, so `earned` read
    // before the corn is paid for is honestly a different number from `earned`
    // read after, and an oracle taken at the first instant would be measuring
    // the difference rather than the equation.
    const town = open(mixedTown({ population: 200, wealth: 1000, grant: 5 }));
    raise(town, "sawpit", DAY0);
    clearedWith(town, 0, 30, 0.2);
    town.market.bought[0] = 30;

    const purseBefore = town.wealth;
    const souls = town.population; // ...before the drift at the foot of the season
    const grant = town.grant;
    const sold = derive(town).commerce.earned;

    settleSeason(town);

    const expected = Math.max(0, purseBefore + sold + grant - town.market.paid - souls * WEALTH.upkeepPerHead);
    expect(town.wealth).toBeCloseTo(expected, 6);
    // ...and the arithmetic was not trivially satisfied by every term being nil.
    expect(sold).toBeGreaterThan(0);
    expect(town.market.paid).toBeGreaterThan(0);
  });
});

// ---- A storm is still worth fearing (KAN-131) ------------------------------
describe("what the sea takes is not earned back", () => {
  it("leaves a battered town poorer for the rest of the century", () => {
    // The margin this story calibrates must not turn a storm into an
    // inconvenience. Two identical towns, one of which meets a week of foul
    // weather: the coin the maintenance bill took is coin the town's own trade
    // never makes up. Measured: the week costs 192 coin, and forty years later
    // the battered town is still 125 behind — two thirds of it, with no
    // recovery at all in the interval.
    const build = () => open(mixedTown({ population: 160, wealth: 0, grant: 0 }));
    const calm = build();
    const hit = build();
    stepSeasons(calm, 40, SEASON);
    stepSeasons(hit, 40, SEASON);
    expect(hit.wealth).toBe(calm.wealth); // ...identical to the coin before the sky opens

    const before = hit.wealth;
    for (let d = 0; d < 6; d++) {
      takeWeather(hit, SEASON * 41 + d, { yieldLoss: 0.25, maintenanceShare: 0.1, worksDropped: 1, worksDestroyed: 1 }, 0.5);
    }
    const took = before - hit.wealth;
    expect(took).toBeGreaterThan(0);

    stepSeasons(calm, 160, SEASON * 41);
    stepSeasons(hit, 160, SEASON * 41);
    expect(hit.wealth).toBeLessThan(calm.wealth);
    expect(calm.wealth - hit.wealth).toBeGreaterThan(took * 0.4);
    // ...and it is still a living town rather than a smoking hole, which is what
    // makes "poorer" the claim rather than "dead".
    expect(hit.population).toBeGreaterThan(0);
  });
});

// RING1 is used by the fixtures above through `bareTown`/`mixedTown`; naming it
// here keeps the import honest.
export const _ring = RING1.length;
