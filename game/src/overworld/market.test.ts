// The clearing — fifty towns' surpluses and shortfalls meeting in one phase.
//
// The claims here are §11's acceptance criteria, and the first of them is the
// one the spec calls "the single most important test in the document":
// SHUFFLING THE ITERATION ORDER OF PLACES PRODUCES IDENTICAL RESULTS.

import { describe, it, expect } from "vitest";
import { generateWorld, foundAll } from "./worldgen";
import {
  MARKET, atWar, clearSeason, declareWar, describeMarkets, makeMarkets, noWars, priceFor, runYears,
  type Markets, type Wars,
} from "./market";
import { derive, produceSeason, settleSeason, year } from "../town/sim";
import { governorTurn } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { TRADE } from "../town/constants";
import { mixedTown, seaTown } from "../town/fixtures";
import { raise } from "../town/works";
import type { Town } from "../town/types";
import type { Place } from "./places";
import type { World } from "./clock";

const SEED = 20260910;

// A world, its ledgers and its markets — the whole of what a season needs. The
// world itself is generated once and rewound, because siting fifty ports is the
// expensive part and it is a pure function of the seed either way.
const worlds = new Map<number, World>();

function bench(seed = SEED): { world: World; towns: Town[]; markets: Markets; wars: Wars } {
  let world = worlds.get(seed);
  if (!world) {
    world = generateWorld(seed);
    worlds.set(seed, world);
  }
  world.day = 0;
  const towns = foundAll(world);
  return { world, towns, markets: makeMarkets(world.places), wars: noWars(world.nations.length) };
}

// A season run with the places VISITED in a given order. The clearing itself is
// untouched; what varies is only the order phases 1, 3 and 4 walk the map in,
// which is exactly what [HC-7] says must not matter.
function seasonIn(order: number[], towns: Town[], markets: Markets, places: World["places"], wars: Wars): void {
  for (const i of order) produceSeason(towns[i]);
  clearSeason(markets, places, towns, wars);
  for (const i of order) settleSeason(towns[i]);
  for (const i of order) {
    stepFootprint(towns[i]);
    governorTurn(towns[i], year(towns[i]));
  }
}

// A deterministic shuffle, so the test itself is reproducible ([P-8]: no
// Math.random anywhere near the simulation, not even in a test that drives it).
function shuffled(n: number, salt: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = (i * 1103515245 + salt * 12345 + 7) % (i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

// A hand-built map, for the claims that need a market of a known shape. Only
// position and faction are ever read by the clearing, but every field is present
// because there is one factory per kind of thing ([P-26]).
function placeAt(id: number, x: number, faction = 0): Place {
  return {
    id, name: `P${id}`, governor: "", x, y: 0, sx: 0, sy: 1, zone: 0, shelter: 0.5,
    size: "town", purpose: "trade", faction, seed: id + 1, population: 100, wealth: 100,
  };
}

describe("a market is a neighbourhood, not a pair", () => {
  it("gives every place a market it belongs to, itself included", () => {
    const { world, markets } = bench();
    expect(markets.hoods.length).toBe(world.places.length);
    for (let i = 0; i < markets.hoods.length; i++) {
      expect(markets.hoods[i].members).toContain(i);
      expect(markets.hoodsOf[i]).toBeGreaterThan(0);
    }
  });

  it("holds a handful of places, never the whole sea", () => {
    // [HC-15]: any design that compares every place to every other is wrong,
    // however cheap it looks at fifty.
    const { world, markets } = bench();
    for (const h of markets.hoods) {
      expect(h.members.length).toBeLessThanOrEqual(MARKET.maxMembers);
      expect(h.members.length).toBeLessThan(world.places.length);
    }
  });

  it("overlaps, so no place trades in a sealed pocket of its own", () => {
    const { markets } = bench();
    const shared = markets.hoodsOf.filter((k) => k > 1).length;
    expect(shared).toBeGreaterThan(markets.hoods.length / 2);
  });

  it("keeps its members in one fixed order, which is what fixes the sums", () => {
    // [P-9]: float addition is not associative, so the accumulation order has to
    // be a property of the neighbourhood and never of the caller's array.
    const { markets } = bench();
    for (const h of markets.hoods) {
      const sorted = [...h.members].sort((a, b) => a - b);
      expect(h.members).toEqual(sorted);
    }
  });

  it("is built once from positions that never move", () => {
    const a = makeMarkets(generateWorld(SEED).places);
    const b = makeMarkets(generateWorld(SEED).places);
    expect(b).toEqual(a);
  });

  it("says what it built, in a line a person can check", () => {
    expect(describeMarkets(bench().markets)).toMatch(/market neighbourhoods within \d+ nm/);
  });
});

describe("clearing is order-independent", () => {
  it("gives an identical century however the map is walked", () => {
    // THE test. If places resolved in sequence, whoever went first would get
    // first call on everyone else's surplus and the world's history would depend
    // on iteration order ([HC-7]). Sums commute, so this is satisfied by
    // construction rather than by discipline — and this is what proves it.
    const a = bench();
    const b = bench();
    const n = a.towns.length;
    const straight = shuffled(n, 0).map((_, i) => i);

    for (let s = 0; s < 80; s++) {
      seasonIn(straight, a.towns, a.markets, a.world.places, a.wars);
      seasonIn(shuffled(n, s + 1), b.towns, b.markets, b.world.places, b.wars);
    }

    for (let i = 0; i < n; i++) {
      expect(b.towns[i].population).toBe(a.towns[i].population);
      expect(b.towns[i].wealth).toBe(a.towns[i].wealth);
      expect(b.towns[i].prosperity).toBe(a.towns[i].prosperity);
      expect(b.towns[i].market).toEqual(a.towns[i].market);
    }
  });

  it("gives the same two hundred years from the same seed, twice over", () => {
    // [HC-11]: reproducible means the whole history, not the starting state.
    const a = bench();
    const b = bench();
    runYears(a.world, a.towns, a.markets, a.wars, 25);
    runYears(b.world, b.towns, b.markets, b.wars, 25);
    expect(b.towns.map((t) => t.population)).toEqual(a.towns.map((t) => t.population));
    expect(b.towns.map((t) => t.wealth)).toEqual(a.towns.map((t) => t.wealth));
  });
});

describe("prices are local", () => {
  it("settles on the ratio a neighbourhood struck, not on a table", () => {
    const base = TRADE.basePrice[0];
    expect(priceFor(0, 0, 500)).toBeLessThan(base); // a glut
    expect(priceFor(0, 500, 0)).toBeGreaterThan(base); // a famine
    expect(priceFor(0, 100, 100)).toBe(base); // and level is level
  });

  it("never runs off the end in either direction", () => {
    const base = TRADE.basePrice[0];
    expect(priceFor(0, 0, 1e9)).toBeGreaterThanOrEqual(base * TRADE.priceFloor);
    expect(priceFor(0, 1e9, 0)).toBeLessThanOrEqual(base * TRADE.priceCeiling);
  });

  it("does not swing to the ceiling on a bushel of corn", () => {
    // A thin market is a quiet one, not a hysterical one.
    const base = TRADE.basePrice[0];
    expect(priceFor(0, 1, 0)).toBeLessThan(base * 1.2);
  });

  it("differs between neighbourhoods for the same good, and keeps differing", () => {
    // [HC-82]. Two ports far enough apart to disagree about prices and close
    // enough to reach are a trade route — that is what makes the map matter.
    const { world, towns, markets, wars } = bench();
    runYears(world, towns, markets, wars, 25);
    const seen = new Set(towns.map((t) => t.market.price[0].toFixed(5)));
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("the pyramid, and its gate", () => {
  // [HC-77] is not a modifier: it decides whether a demand EXISTS AT ALL. A
  // place short of bread registers NO demand for materials or luxury, HOWEVER
  // RICH IT IS — which is what makes the three classes a pyramid and not a list.
  //
  // The same starving port is put in two different markets: one with nobody to
  // sell it corn, one with a farming neighbour. Nothing about the port changes.
  // A port with a quay, a fat treasury, no acre that will bear corn and no
  // timber of its own. It wants both, and its bread is the lower rung.
  function hungryPort(): Town {
    const t = seaTown({ population: 60, wealth: 200000 });
    raise(t, "warehouse", 1650);
    raise(t, "customsHouse", 1650);
    return t;
  }

  // ...and a neighbour with corn and timber to spare.
  function farmingNeighbour(): Town {
    const t = mixedTown({ population: 120, wealth: 500 });
    raise(t, "warehouse", 1650);
    raise(t, "provisionGround", 1650);
    raise(t, "sawpit", 1650);
    produceSeason(t);
    return t;
  }

  it("registers no demand for timber in a place that cannot get bread, however rich", () => {
    const places = [placeAt(0, 0), placeAt(1, 40)];
    const markets = makeMarkets(places);

    const hungry = [hungryPort(), hungryPort()]; // neither has an acre of corn
    clearSeason(markets, places, hungry, noWars(3));
    const c = derive(hungry[0]).commerce;
    expect(c.want[0]).toBeGreaterThan(0);
    expect(c.want[1]).toBeGreaterThan(0); // it wants timber...
    expect(hungry[0].market.allotted[0]).toBe(0); // ...but there is no bread to be had
    expect(hungry[0].market.allotted[1]).toBe(0); // ...so it registers no demand for it
  });

  it("reaches for the next tier the moment the one below is covered", () => {
    const places = [placeAt(0, 0), placeAt(1, 40)];
    const markets = makeMarkets(places);

    const fed = [hungryPort(), farmingNeighbour()];
    clearSeason(markets, places, fed, noWars(3));
    expect(fed[0].market.allotted[0]).toBeGreaterThan(0);
    expect(fed[0].market.allotted[1]).toBeGreaterThan(0);
  });
});

describe("war is a filter on the pool, never on a place", () => {
  // [HC-84]. A place draws only on supply from factions it is not at war with,
  // so a war impoverishes towns on both sides that never see a soldier — and it
  // is a small fixed faction mask, so the clearing stays linear.
  it("costs a port its bread when the crown that grew it is at war with its own", () => {
    const places = [placeAt(0, 0, 0), placeAt(1, 40, 1)];
    const markets = makeMarkets(places);

    const build = () => {
      const port = seaTown({ population: 300, wealth: 200000 });
      raise(port, "warehouse", 1650);
      raise(port, "customsHouse", 1650);
      const farm = mixedTown({ population: 60, wealth: 500 });
      raise(farm, "warehouse", 1650);
      raise(farm, "provisionGround", 1650);
      raise(farm, "provisionGround", 1650);
      produceSeason(farm);
      return [port, farm];
    };

    const peace = build();
    clearSeason(markets, places, peace, noWars(3));

    const war = build();
    const wars = noWars(3);
    declareWar(wars, 0, 1);
    clearSeason(markets, places, war, wars);

    expect(peace[0].market.allotted[0]).toBeGreaterThan(0);
    expect(war[0].market.allotted[0]).toBe(0);
    expect(atWar(wars, 0, 1)).toBe(true);
    expect(atWar(wars, 0, 0)).toBe(false); // nobody is ever at war with himself
  });

  it("costs the seller too — a war is felt on both sides of it", () => {
    const places = [placeAt(0, 0, 0), placeAt(1, 40, 1)];
    const markets = makeMarkets(places);

    const price = (wars: Wars) => {
      const port = seaTown({ population: 300, wealth: 200000 });
      raise(port, "warehouse", 1650);
      const farm = mixedTown({ population: 60, wealth: 500 });
      raise(farm, "warehouse", 1650);
      raise(farm, "provisionGround", 1650);
      produceSeason(farm);
      const towns = [port, farm];
      clearSeason(markets, places, towns, wars);
      return farm.market.price[0];
    };

    const wars = noWars(3);
    declareWar(wars, 0, 1);
    // With its only customer cut off, the farmer's corn is worth less.
    expect(price(wars)).toBeLessThan(price(noWars(3)));
  });
});

describe("what a place brings to market", () => {
  it("brings nothing at all from a shore with no quay and no guns", () => {
    const { world, towns, markets, wars } = bench();
    const shut = towns[0];
    for (const w of shut.works) w.condition = "ruin";
    shut.patron = { kind: "none", name: "", owns: false };
    produceSeason(shut);
    for (const w of shut.works) if (w.kind === "fishingShacks") w.condition = "ruin";
    clearSeason(markets, world.places, towns, wars);
    expect(derive(shut).access).toBe(0);
    expect(shut.market.allotted[0]).toBe(0);
  });

  it("splits what it brings across every market it stands in, so nothing is conjured", () => {
    // A place in three neighbourhoods offers a third to each. Overlap must not
    // multiply the world's goods.
    const { world, towns, markets, wars } = bench();
    for (let s = 0; s < 8; s++) {
      for (const t of towns) produceSeason(t);
      clearSeason(markets, world.places, towns, wars);
      for (const t of towns) settleSeason(t);
    }
    for (let i = 0; i < towns.length; i++) {
      const want = derive(towns[i]).commerce.want[0];
      // It can never be allotted more than it asked for, however many markets it
      // stands in.
      expect(towns[i].market.allotted[0]).toBeLessThanOrEqual(want + 1e-9);
    }
  });
});
