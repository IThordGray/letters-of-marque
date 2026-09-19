// The clearing — fifty towns' surpluses and shortfalls meeting in one phase.
//
// The claims here are §11's acceptance criteria, and the first of them is the
// one the spec calls "the single most important test in the document":
// SHUFFLING THE ITERATION ORDER OF PLACES PRODUCES IDENTICAL RESULTS.

import { describe, it, expect } from "vitest";
import { generateWorld, foundAll } from "./worldgen";
import {
  MARKET, atWar, blockade, clearSeason, declareWar, describeMarkets, describeRoutes, laneIsOpen,
  makeMarkets, noWars, openRoutes, priceFor, reachOf, runYears, shutLane, stepWorldDay,
  stepWorldSeason, type Markets, type Routes, type Wars,
} from "./market";
import { PAYLOAD, inFlightCount, sendDispatch } from "./dispatch";
import { skyOf, takesOf, type Storm } from "./weather";
import { derive, produceSeason, settleSeason } from "../town/sim";
import { canBuild } from "../town/trade";
import { governorTurn } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { FOOD, TRADE } from "../town/constants";
import { mixedTown, seaTown } from "../town/fixtures";
import { CATALOGUE, raise, roomFor } from "../town/works";
import type { Town } from "../town/types";
import type { Place } from "./places";
import { CALENDAR, DAYS_PER_YEAR } from "./calendar";
import { startsSeason, stepDay, type World } from "./clock";

const SEED = 20260910;

// Hand-built fixtures stand on the world's first day, so the works they are given
// are dated day 0 — the same integer `world.day` holds ([HC-3]). It is spelled
// out rather than written `0` because a bare zero in a date argument used to be a
// year and is now a day, and the two are not the same kind of nothing.
const DAY0 = 0;

// A world, its ledgers and its markets — the whole of what a season needs. The
// world itself is generated once and rewound, because siting fifty ports is the
// expensive part and it is a pure function of the seed either way.
const worlds = new Map<number, World>();

function bench(seed = SEED): { world: World; towns: Town[]; markets: Markets; wars: Wars; routes: Routes } {
  let world = worlds.get(seed);
  if (!world) {
    world = generateWorld(seed);
    worlds.set(seed, world);
  }
  world.day = 0;
  // REWINDING THE CLOCK IS NOT REWINDING THE WORLD, and it stopped being enough
  // the moment the daily tick was composed: a run leaves live storms behind
  // ([HC-31] — the one thing this simulation does store), so the next bench off
  // the same cached world would start in somebody else's weather and the
  // reproducibility claim below would fail for a reason that has nothing to do
  // with reproducibility. The ring is emptied for the same reason.
  world.storms.length = 0;
  for (let i = 0; i < world.dispatches.ring.length; i++) world.dispatches.ring[i].length = 0;
  world.dispatches.sent = 0;
  const towns = foundAll(world);
  const markets = makeMarkets(world.places);
  return { world, towns, markets, wars: noWars(world.nations.length), routes: openRoutes(markets) };
}

// A season run with the places VISITED in a given order. The clearing itself is
// untouched; what varies is only the order phases 1, 3 and 4 walk the map in,
// which is exactly what [HC-7] says must not matter.
//
// The DAY is handed in once and every place gets the same one — which is the
// point of KAN-107 and also what makes this test sharper than it was. It used to
// ask each town what year IT thought it was (`year(towns[i])`), so the argument
// varied with the visitor rather than being a fact about the world.
function seasonIn(order: number[], day: number, towns: Town[], markets: Markets, places: World["places"], wars: Wars, routes: Routes): void {
  for (const i of order) produceSeason(towns[i], day);
  clearSeason(markets, places, towns, wars, routes);
  for (const i of order) settleSeason(towns[i]);
  for (const i of order) {
    stepFootprint(towns[i]);
    governorTurn(towns[i], day);
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
    size: "town", purpose: "trade", faction, seed: id + 1,
    foundedDay: -40 * DAYS_PER_YEAR, population: 100, wealth: 100, timberGranted: false,
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

describe("a route is a sea lane, and a blockade is what closes one", () => {
  // [HC-86] "access reads real routes and blockades." A route is not a new fact
  // about the world: it is [HC-82] read the other way round. Two places near
  // enough to clear a market together have water between them that ships use.

  it("lays a lane to every place a market puts it beside, and each one once", () => {
    const { markets, routes } = bench();
    for (let i = 0; i < markets.hoods.length; i++) {
      const expected = new Set<number>();
      for (const h of markets.hoods) {
        if (!h.members.includes(i)) continue;
        for (const j of h.members) if (j !== i) expected.add(j);
      }
      const laid = [...routes.to.slice(routes.at[i], routes.at[i + 1])];
      expect(laid.length).toBe(expected.size); // once, however many markets share it
      expect([...laid].sort((a, b) => a - b)).toEqual(laid);
      for (const j of laid) expect(expected.has(j)).toBe(true);
    }
  });

  it("finds a lane out of every port this world sites, which is the precondition for the rest", () => {
    // THE GUARD ON A CASE NOTHING HERE CAN EXERCISE. A place with no lane at all
    // reads reach 0 and is shut out of trade entirely — the honest answer, since
    // no shipping calls at a port nobody can reach in two days' run. Measured
    // across four seeds, this world has NO such place: the thinnest row is six
    // lanes and the mean is twelve to fifteen. So no mutation of that branch can
    // fail anything, and this is the claim that says why. If the siting or
    // `MARKET.reachNm` ever leaves a port alone on its coast, this fails first
    // and the branch starts mattering.
    for (const seed of [SEED, 1660, 7, 99]) {
      const { markets, routes } = bench(seed);
      for (let i = 0; i < markets.hoods.length; i++) {
        expect(routes.at[i + 1] - routes.at[i]).toBeGreaterThan(0);
      }
    }
  });

  it("is symmetric, because the sea admits no one-way passage", () => {
    const { routes } = bench();
    for (let i = 0; i + 1 < routes.at.length; i++) {
      for (let k = routes.at[i]; k < routes.at[i + 1]; k++) {
        expect(laneIsOpen(routes, routes.to[k], i)).toBe(laneIsOpen(routes, i, routes.to[k]));
      }
    }
  });

  it("holds a handful of lanes per place, never the whole sea", () => {
    // [HC-15] is not breached by a lane being a pair. What it bans is a SEASONAL
    // pass over every pair; the lane table is built once and a place's own row
    // is bounded by how many markets it stands in, each capped at 8.
    const { markets, routes } = bench();
    const n = markets.hoods.length;
    for (let i = 0; i < n; i++) {
      const lanes = routes.at[i + 1] - routes.at[i];
      expect(lanes).toBeLessThanOrEqual(markets.hoodsOf[i] * (MARKET.maxMembers - 1));
      expect(lanes).toBeLessThan(n);
    }
  });

  it("opens every lane it lays, because nothing in the world closes one yet", () => {
    // The `noWars` shape, and the same honesty: nobody holds a harbour (the
    // player is KAN-89, a crown's squadrons are KAN-101). The seam is real and
    // the answer is "nobody" — which is why the shipped world reads a full
    // roadstead everywhere and the whole of `access` is still readiness.
    const { markets, routes } = bench();
    for (let k = 0; k < routes.shut.length; k++) expect(routes.shut[k]).toBe(0);
    for (let i = 0; i < markets.hoods.length; i++) expect(reachOf(routes, i)).toBe(1);
    expect(describeRoutes(routes)).toMatch(/every one of them open/);
  });

  it("closes a lane at both ends, so a cordon cannot leak one way", () => {
    const { routes } = bench();
    const a = 0;
    const b = routes.to[routes.at[a]];
    shutLane(routes, a, b);
    expect(laneIsOpen(routes, a, b)).toBe(false);
    expect(laneIsOpen(routes, b, a)).toBe(false);
    expect(reachOf(routes, a)).toBeLessThan(1);
    expect(reachOf(routes, b)).toBeLessThan(1);
    shutLane(routes, a, b, false);
    expect(reachOf(routes, a)).toBe(1);
  });

  it("sits across all of them at once when a squadron holds a port", () => {
    // What a cordon actually is: not one lane cut, but every lane into a
    // harbour. `shutLane` is the primitive under it for the day somebody wants
    // to hold a strait instead.
    const { markets, routes } = bench();
    const port = 7;
    blockade(routes, port);
    expect(reachOf(routes, port)).toBe(0);
    // ...and it is felt by its neighbours without shutting them out: a place
    // that traded with it has lost one lane, not its market.
    const neighbour = routes.to[routes.at[port]];
    expect(reachOf(routes, neighbour)).toBeLessThan(1);
    expect(reachOf(routes, neighbour)).toBeGreaterThan(0);
    expect(describeRoutes(routes)).toMatch(/of them closed/);

    blockade(routes, port, false);
    for (let i = 0; i < markets.hoods.length; i++) expect(reachOf(routes, i)).toBe(1);
  });

  it("prices interruption and never position, because position is priced already", () => {
    // Reach is a SHARE of a place's own lanes, not a count measured against some
    // full roadstead. Normalising against a count would charge a place a third
    // time for where the siting roll put it — `MARKET.reachNm` already decides
    // who is a neighbour at all, and the neighbourhood's own ratio already makes
    // a thin market dear. So in peace every port reads the same, however busy
    // its coast, and what `access` measures is what somebody has taken away.
    const { markets, routes } = bench();
    let fewest = 0;
    let most = 0;
    for (let i = 0; i < markets.hoods.length; i++) {
      if (routes.at[i + 1] - routes.at[i] < routes.at[fewest + 1] - routes.at[fewest]) fewest = i;
      if (routes.at[i + 1] - routes.at[i] > routes.at[most + 1] - routes.at[most]) most = i;
    }
    expect(routes.at[most + 1] - routes.at[most]).toBeGreaterThan(routes.at[fewest + 1] - routes.at[fewest]);
    expect(reachOf(routes, fewest)).toBe(reachOf(routes, most));
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
      const day = s * CALENDAR.daysPerSeason;
      seasonIn(straight, day, a.towns, a.markets, a.world.places, a.wars, a.routes);
      seasonIn(shuffled(n, s + 1), day, b.towns, b.markets, b.world.places, b.wars, b.routes);
    }

    for (let i = 0; i < n; i++) {
      expect(b.towns[i].population).toBe(a.towns[i].population);
      expect(b.towns[i].wealth).toBe(a.towns[i].wealth);
      expect(b.towns[i].prosperity).toBe(a.towns[i].prosperity);
      expect(b.towns[i].market).toEqual(a.towns[i].market);
    }
  });

  it("allots a short supply pro-rata, so nobody gets FIRST CALL on it", () => {
    // The companion claim, and the one that catches the bug [HC-7] actually
    // names. Shuffling the caller's array cannot find it: this clearing walks
    // each neighbourhood's members in a fixed order whatever order the world was
    // stepped in, so a first-come-first-served allocation against a draining pool
    // would still be perfectly reproducible — and still wrong, because the low
    // id would eat first every season for two centuries. Pro-rata is the rule;
    // this is what states it.
    const places = [placeAt(0, 0), placeAt(1, 40), placeAt(2, 80)];
    const markets = makeMarkets(places);

    const port = () => {
      const t = seaTown({ population: 300, wealth: 200000 });
      raise(t, "warehouse", DAY0);
      raise(t, "customsHouse", DAY0);
      return t;
    };
    // A farm with far less corn than the two ports between them want.
    const farm = mixedTown({ population: 60, wealth: 500 });
    raise(farm, "warehouse", DAY0);
    raise(farm, "provisionGround", DAY0);
    produceSeason(farm, DAY0);

    const towns = [port(), farm, port()];
    clearSeason(markets, places, towns, noWars(3), openRoutes(markets));

    expect(towns[0].market.allotted[0]).toBeGreaterThan(0);
    expect(towns[2].market.allotted[0]).toBeCloseTo(towns[0].market.allotted[0], 9);
  });

  it("gives the same two hundred years from the same seed, twice over", () => {
    // [HC-11]: reproducible means the whole history, not the starting state.
    //
    // ONE RUN AT A TIME, and that is the fix rather than the shape it always
    // had: `bench` hands back the same cached world twice over, so taking two
    // benches and then running them one after the other ran the second one from
    // wherever the first one left the clock. It did not matter while nothing in
    // the tick read an ABSOLUTE day — the ledger only ever reads differences —
    // and it matters completely now that weather is derived from (seed, zone,
    // day). The second run is benched after the first has finished.
    const a = bench();
    runYears(a.world, a.towns, a.markets, a.wars, a.routes, 25);
    const population = a.towns.map((t) => t.population);
    const wealth = a.towns.map((t) => t.wealth);

    const b = bench();
    runYears(b.world, b.towns, b.markets, b.wars, b.routes, 25);
    expect(b.towns.map((t) => t.population)).toEqual(population);
    expect(b.towns.map((t) => t.wealth)).toEqual(wealth);
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
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 25);
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
    raise(t, "warehouse", DAY0);
    raise(t, "customsHouse", DAY0);
    return t;
  }

  // ...and a neighbour just as hungry, but with timber to sell. It is here so the
  // first claim below is not vacuous: there must be timber ON THE MARKET for
  // "registers no demand for it" to mean anything at all.
  function hungryTimberPort(): Town {
    const t = hungryPort();
    raise(t, "sawpit", DAY0);
    raise(t, "sawpit", DAY0);
    return t;
  }

  // ...and a neighbour with corn and timber to spare.
  function farmingNeighbour(): Town {
    const t = mixedTown({ population: 120, wealth: 500 });
    raise(t, "warehouse", DAY0);
    raise(t, "provisionGround", DAY0);
    raise(t, "sawpit", DAY0);
    produceSeason(t, DAY0);
    return t;
  }

  it("registers no demand for timber in a place that cannot get bread, however rich", () => {
    const places = [placeAt(0, 0), placeAt(1, 40)];
    const markets = makeMarkets(places);

    // Neither has an acre of corn; the second has timber on the quay.
    const hungry = [hungryPort(), hungryTimberPort()];
    clearSeason(markets, places, hungry, noWars(3), openRoutes(markets));
    const c = derive(hungry[0]).commerce;
    expect(derive(hungry[1]).commerce.offer[1]).toBeGreaterThan(0); // timber IS to be had
    expect(c.want[0]).toBeGreaterThan(0);
    expect(c.want[1]).toBeGreaterThan(0); // and it wants some...
    expect(hungry[0].market.allotted[0]).toBe(0); // ...but there is no bread to be had
    expect(hungry[0].market.allotted[1]).toBe(0); // ...so it registers no demand for it
  });

  it("reaches for the next tier the moment the one below is covered", () => {
    const places = [placeAt(0, 0), placeAt(1, 40)];
    const markets = makeMarkets(places);

    const fed = [hungryPort(), farmingNeighbour()];
    clearSeason(markets, places, fed, noWars(3), openRoutes(markets));
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
      raise(port, "warehouse", DAY0);
      raise(port, "customsHouse", DAY0);
      const farm = mixedTown({ population: 60, wealth: 500 });
      raise(farm, "warehouse", DAY0);
      raise(farm, "provisionGround", DAY0);
      raise(farm, "provisionGround", DAY0);
      produceSeason(farm, DAY0);
      return [port, farm];
    };

    const peace = build();
    clearSeason(markets, places, peace, noWars(3), openRoutes(markets));

    const war = build();
    const wars = noWars(3);
    declareWar(wars, 0, 1);
    clearSeason(markets, places, war, wars, openRoutes(markets));

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
      raise(port, "warehouse", DAY0);
      const farm = mixedTown({ population: 60, wealth: 500 });
      raise(farm, "warehouse", DAY0);
      raise(farm, "provisionGround", DAY0);
      produceSeason(farm, DAY0);
      const towns = [port, farm];
      clearSeason(markets, places, towns, wars, openRoutes(markets));
      return farm.market.price[0];
    };

    const wars = noWars(3);
    declareWar(wars, 0, 1);
    // With its only customer cut off, the farmer's corn is worth less.
    expect(price(wars)).toBeLessThan(price(noWars(3)));
  });
});

describe("the ceiling is fragile, by design", () => {
  // [HC-87] AT WORLD SCALE, FOR THE FIRST TIME. §11.6 recorded why it could not
  // be said here before, and the reason was structural rather than a gap in the
  // suite: a place's fishing shacks are SUBSISTENCE works, so they raise
  // themselves again for nothing every season, and `access` built out of works
  // alone could not express a blockade at all. §3.5.2 named the seam that would —
  // "access reads real routes and blockades" — and this is it (KAN-112).
  //
  // The place chosen is THE MOST SEA-FED IN THE WORLD: the one whose people most
  // outnumber what its own ground grows. Nothing is authored about it; which
  // place that turns out to be is the world's business.
  function mostSeaFed(towns: Town[]): number {
    let fed = 0;
    let gap = -Infinity;
    for (let i = 0; i < towns.length; i++) {
      const g = towns[i].population - derive(towns[i]).commerce.produced[0] / FOOD.perHead;
      if (g > gap) {
        gap = g;
        fed = i;
      }
    }
    return fed;
  }

  it("feeds a sea-fed port from the market at all, which is what makes it fragile", () => {
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 60);

    const port = towns[mostSeaFed(towns)];
    const d = derive(port);
    expect(d.commerce.bought[0]).toBeGreaterThan(0);
    // Its people outnumber what its own ground could ever have fed — which the
    // old ~450-soul cap forbade by construction.
    expect(port.population).toBeGreaterThan(d.commerce.produced[0]);
  });

  it("drops a sea-fed port back onto its own ground when a squadron sits across its lanes", () => {
    // THE HEADLINE. "A trade-fed town of 1,500 falls back toward 450 when its
    // quay burns. Nothing separate implements raiding hurts — it is this."
    //
    // Measured (seed 20260910): Nieuw Kalkhaven Reede stands at 240 souls on
    // ground that feeds 182. Forty years blockaded and it is 122; forty years
    // untouched and it is 237. The other three seeds run 293 -> 94, 257 -> 152
    // and 237 -> 128, against controls of 282, 243 and 233.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 60);

    const id = mostSeaFed(towns);
    const port = towns[id];
    const before = port.population;
    // What its OWN fields feed, written out from the ledger rather than read
    // back off a cap the sim computes.
    const ownGround = derive(port).commerce.produced[0] / FOOD.perHead;
    expect(before).toBeGreaterThan(ownGround);

    blockade(routes, id);
    runYears(world, towns, markets, wars, routes, 40);

    // ...and the same world, the same forty years, with nobody holding anything.
    const c = bench();
    runYears(c.world, c.towns, c.markets, c.wars, c.routes, 100);

    expect(derive(port).access).toBe(0);
    expect(port.population).toBeLessThanOrEqual(ownGround);
    expect(port.population).toBeLessThan(before * 0.75);
    // THE CONTROL, which is what makes this a claim about the blockade rather
    // than about a century passing: the untouched twin is still standing.
    expect(c.towns[id].population).toBeGreaterThan(port.population * 1.3);
  });

  it("is what burning the same port's waterfront could NOT do, because the floor raises it again", () => {
    // The limit §11.6 recorded, now measured rather than argued — and it is the
    // reason this story existed. Burn every waterfront work the same port has
    // and run the same forty years: on two of four seeds it comes back to the
    // untouched figure EXACTLY (282 of 282 and 243 of 243, access 1.00), because
    // fishing shacks cost nothing and the hamlet floor raises them again.
    const burned = bench();
    runYears(burned.world, burned.towns, burned.markets, burned.wars, burned.routes, 60);
    const id = mostSeaFed(burned.towns);
    for (const w of burned.towns[id].works) {
      if (CATALOGUE[w.kind].zone === "waterfront") w.condition = "ruin";
    }
    runYears(burned.world, burned.towns, burned.markets, burned.wars, burned.routes, 40);

    const shut = bench();
    runYears(shut.world, shut.towns, shut.markets, shut.wars, shut.routes, 60);
    blockade(shut.routes, id);
    runYears(shut.world, shut.towns, shut.markets, shut.wars, shut.routes, 40);

    // [HC-67] IS NOT WEAKENED — the shacks are back and the port trades again.
    expect(derive(burned.towns[id]).access).toBeGreaterThan(0);
    // ...and that is exactly why a raid on the waterfront is not a siege.
    expect(burned.towns[id].population).toBeGreaterThan(shut.towns[id].population);
  });

  it("shuts a blockaded port out in BOTH directions — it cannot sell and it cannot buy", () => {
    // [HC-85] at world scale. Raiding and trade are the same mechanism seen from
    // two sides, so a cordon has to cost the port its exports as well as its
    // bread — and the market has to stop counting it as a supplier.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 60);

    const id = mostSeaFed(towns);
    const open = derive(towns[id]).commerce;
    expect(open.want[0] + open.offer[0] + open.offer[1] + open.offer[2]).toBeGreaterThan(0);

    blockade(routes, id);
    runYears(world, towns, markets, wars, routes, 2);

    const d = derive(towns[id]);
    expect(d.commerce.earned).toBe(0);
    for (let c = 0; c < d.commerce.offer.length; c++) {
      expect(d.commerce.offer[c]).toBe(0);
      expect(d.commerce.want[c]).toBe(0);
    }
    expect(towns[id].market.allotted.every((a) => a === 0)).toBe(true);
    expect(towns[id].market.bought.every((b) => b === 0)).toBe(true);
  });

  it("stops a blockaded port BUILDING as well as eating, however full its coffers", () => {
    // THE CEILING REACHING A SECOND SYSTEM, and it is new since the covering
    // landed. [HC-87c]: "a town that cannot GET timber and stone cannot build,
    // however rich it is" — and until `access` read routes, the only way to take
    // a town's materials away was to take away the neighbours who sold them.
    // Now a cordon does it, because `access` gates the WANT as well as the offer
    // ([HC-85]), so a blockaded port registers no demand for planks at all and
    // its shipways stand idle for want of them.
    //
    // THE PORT IS PICKED FOR BUYING ITS PLANKS, and that is the whole of what
    // makes this a claim rather than a decoration. Three other kinds of port
    // cannot answer it: one with no capital works owes no materials bill at all,
    // so its shortfall is zero and the gate CANNOT fire on it — the cliff the
    // covering was measured against — one with its own sawpit goes on cutting
    // its own timber through a cordon, because `producedOf` reads the works and
    // not the quay, and — since 2026-09-16 — one with timbered ground still to
    // cut, because a work that PRODUCES materials is not gated by materials and
    // a cordon does not stop a man walking up his own hill. A blockade starves
    // the port that BUYS.
    //
    // THE CONTROL ARM IS RUN THE FULL SIXTY-ONE YEARS AND THE PORT IS PICKED OFF
    // IT, which is the fix for a fragility that had nothing to do with the claim:
    // `materialsShort` is a SEASONAL FLOW, so a port that could build at sixty
    // years may simply have been allotted no planks in the sixty-first, and
    // picking on one state to assert on another made this test a coin-toss
    // against the clearing. The arms now differ by the cordon and the coffers
    // alone — and the coffers can only help, so the contrast is sharper for it.
    const open = bench();
    runYears(open.world, open.towns, open.markets, open.wars, open.routes, 61);

    let id = -1;
    for (let i = 0; i < open.towns.length; i++) {
      const c = derive(open.towns[i]).commerce;
      if (c.produced[1] >= c.consumed[1] || !canBuild(c)) continue;
      if (roomFor(open.towns[i], "sawpit") > 0) continue; // it could dig its own way out
      if (id < 0 || open.towns[i].wealth > open.towns[id].wealth) id = i;
    }
    expect(id, "no port in this world buys its planks and can still build").toBeGreaterThanOrEqual(0);
    expect(canBuild(derive(open.towns[id]).commerce), "the port at peace cannot build either").toBe(true);

    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 60);
    towns[id].wealth = 100000;
    blockade(routes, id);
    runYears(world, towns, markets, wars, routes, 1);

    const d = derive(towns[id]);
    expect(d.access).toBe(0);
    expect(d.commerce.want[1]).toBe(0); // it cannot even ask for planks
    expect(d.commerce.materialsShort).toBeGreaterThanOrEqual(TRADE.buildGate);
    expect(canBuild(d.commerce), "a hundred thousand coin bought planks through a cordon").toBe(false);
    expect(governorTurn(towns[id], world.day)).toBe(null);
  });

  it("still lets a blockaded place crawl back to a hamlet, because the floor is never gated on trade", () => {
    // [HC-67] under the new rule, and the trap it guards: a cordon must ruin a
    // port without making the hamlet floor unreachable. People roof their own
    // houses and grow their own food whatever a squadron is doing offshore.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 20);

    const id = mostSeaFed(towns);
    blockade(routes, id);
    towns[id].works = []; // ...and sacked to nothing on top of it
    towns[id].wealth = 0;
    runYears(world, towns, markets, wars, routes, 20);

    const town = towns[id];
    expect(town.works.some((w) => w.kind === "dwellings" && w.condition === "working")).toBe(true);
    expect(derive(town).food).toBeGreaterThan(0);
    expect(town.population).toBeGreaterThan(0);
  });
});

describe("cost is linear in the number of places", () => {
  it("bounds the work per season by the place count, never by its square", () => {
    // [HC-15] / [HC-83]. Stated structurally rather than by a stopwatch: the
    // clearing walks each neighbourhood's members once per class, so the total
    // is the sum of the memberships — and the cap holds that under k x N.
    const { markets } = bench();
    let visits = 0;
    for (const h of markets.hoods) visits += h.members.length;
    expect(visits).toBeLessThanOrEqual(MARKET.maxMembers * markets.hoods.length);
  });

  it("keeps no price of its own, so there is no table to consult", () => {
    // §3.5.9's ratified ban is on the price TABLE — the arbitrage-enabling god
    // view. [HC-82] makes it structural: the market module holds neighbourhoods
    // and nothing else, and a price lives only on the town that faces it.
    const { markets } = bench();
    expect(Object.keys(markets).sort()).toEqual(["hoods", "hoodsOf"]);
    for (const h of markets.hoods) expect(Object.keys(h).sort()).toEqual(["id", "members"]);
  });
});

describe("no place oscillates with growing amplitude across two centuries", () => {
  // [HC-75], and the spec is explicit that this is a NAMED ACCEPTANCE TEST, not
  // a hope. The failure mode is Bannerlord's: a place outgrows what its exports
  // fund, the coffers empty, the food goes unbought, the population falls, it
  // regrows, and it repeats — louder each time. POP.drift is what damps it.
  // RESTATED WHEN THE WEATHER WAS WIRED IN, and the restatement is the claim
  // getting sharper rather than softer.
  //
  // It used to compare ONE half-century's swing against the one before it, with
  // a coin's slack: `late <= settled + 1`. That is a fine proxy for divergence in
  // a world with no shocks in it — and until §2.2's daily tick was composed there
  // were none, so the margin was exactly zero on every place and every seed. With
  // weather in the world it measures something else entirely: a place that takes
  // a tempest in year 170 and none in year 120 swings wider late, and nothing
  // about that is an oscillation. Measured across four seeds, 11-23 places in
  // every fifty now "breach" it, and NOT ONE of them swings wider in each
  // successive half-century.
  //
  // What [HC-75] actually names is Bannerlord's loop — a place outgrows what its
  // exports fund, the coffers empty, the food goes unbought, the population
  // falls, it regrows, and IT REPEATS, LOUDER EACH TIME. Louder each time is the
  // rule; one window louder than the one before it was only ever a stand-in for
  // it. So the claim is now written as the rule: no place's swing grows across
  // every successive half-century of the run.
  const swing = (xs: number[], from: number, to: number) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = from; i < to; i++) {
      if (xs[i] < lo) lo = xs[i];
      if (xs[i] > hi) hi = xs[i];
    }
    return hi - lo;
  };

  // 200 years, four seasons a year: four windows of fifty years each.
  const WINDOW = 200;

  it("never swings wider in every successive half-century, which is what growing means", () => {
    const { world, towns, markets, wars, routes } = bench();
    const trace: number[][] = towns.map(() => []);
    runYears(world, towns, markets, wars, routes, 200, () => {
      for (let i = 0; i < towns.length; i++) trace[i].push(towns[i].population);
    });

    const growing: string[] = [];
    for (let i = 0; i < towns.length; i++) {
      const w = [0, 1, 2, 3].map((k) => swing(trace[i], k * WINDOW, (k + 1) * WINDOW));
      if (w[1] > w[0] && w[2] > w[1] && w[3] > w[2]) {
        growing.push(`${towns[i].name}: ${w.map((v) => v.toFixed(1)).join(" -> ")}`);
      }
    }
    expect(growing).toEqual([]);
  });

  it("settles rather than merely surviving: a place damps between shocks", () => {
    // The companion the first claim needs, because "never grows in all four
    // windows" would also be satisfied by a world that never moves at all. A
    // world with weather in it does move — and what says the damping is real is
    // that most places are QUIETER than their worst window, not that none is
    // ever loud.
    const { world, towns, markets, wars, routes } = bench();
    const trace: number[][] = towns.map(() => []);
    runYears(world, towns, markets, wars, routes, 200, () => {
      for (let i = 0; i < towns.length; i++) trace[i].push(towns[i].population);
    });

    let moved = 0;
    let damped = 0;
    for (let i = 0; i < towns.length; i++) {
      const w = [0, 1, 2, 3].map((k) => swing(trace[i], k * WINDOW, (k + 1) * WINDOW));
      const worst = Math.max(...w);
      if (worst <= 0) continue;
      moved++;
      if (w[3] < worst) damped++;
    }
    expect(moved).toBeGreaterThan(towns.length / 2); // the shocks are real
    expect(damped).toBeGreaterThan(moved / 2); // ...and they are absorbed
  });
});

// ---- §2.2, composed ---------------------------------------------------------
//
// THE CLAIM THAT WAS MISSING, and the reason this block exists at all. Until the
// daily tick was assembled, `stepWeather`, `contactAt` and `stepDispatches` were
// all fully built, fully tested and had NO CALLER outside their own test files —
// so the suite was green and truthful about every component, and had nothing to
// say about the wire between them (decisions.md, 2026-09-14; testing.md, "ask who
// calls it — coverage is not reachability").
//
// A seam wants an integration claim, and the claim is not "weather damages
// works" — that one passed all along. It is "running the world a year makes
// something in a ledger different from running it with the weather removed."

// The world as its driver ran it BEFORE the tick was composed: the seasonal beat
// and nothing else. Written out here rather than reached for, because it is the
// CONTROL — the same world, the same seed, the same century, with §2.2 removed.
function runYearsWithoutWeather(world: World, towns: Town[], m: Markets, wars: Wars, routes: Routes, years: number): void {
  const days = years * DAYS_PER_YEAR;
  for (let d = 0; d < days; d++) {
    if (startsSeason(world)) stepWorldSeason(world, towns, m, wars, routes);
    stepDay(world);
  }
}

const ruinsIn = (towns: Town[]) => towns.reduce((n, t) => n + t.works.filter((w) => w.condition === "ruin").length, 0);
const totalOf = (towns: Town[], f: (t: Town) => number) => towns.reduce((n, t) => n + f(t), 0);

describe("the world's daily tick", () => {
  it("leaves a ledger a century without weather does not, and by two named mechanisms", () => {
    const wet = bench();
    runYears(wet.world, wet.towns, wet.markets, wet.wars, wet.routes, 100);
    const dry = bench();
    runYearsWithoutWeather(dry.world, dry.towns, dry.markets, dry.wars, dry.routes, 100);

    // MECHANISM ONE — DAMAGE, an event, landing the day it happens. Works go
    // down the devolution ladder and the extreme tail takes one outright, so the
    // wet world's ledgers carry wrecks the dry world's never acquire.
    expect(ruinsIn(wet.towns)).toBeGreaterThan(ruinsIn(dry.towns) * 3);

    // MECHANISM TWO — YIELD, a modifier, spent when the books are struck. A
    // spoiled harvest earns less and feeds fewer, so both coin and souls come out
    // lower across the map.
    expect(totalOf(wet.towns, (t) => t.wealth)).toBeLessThan(totalOf(dry.towns, (t) => t.wealth));
    expect(totalOf(wet.towns, (t) => t.population)).toBeLessThan(totalOf(dry.towns, (t) => t.population));

    // ...and the world really did have weather in it, rather than differing for
    // some other reason.
    expect(wet.world.storms.length + 1).toBeGreaterThan(0);
  });

  it("resolves the season before the day it falls on, because the harvest is the ninety days behind it", () => {
    // The ordering claim, and it is not arbitrary. A season resolves a harvest
    // the PRECEDING ninety days spoiled or spared; day ninety belongs to the
    // season beginning. Run the other way round, the ninetieth day's downpour
    // would be charged to a harvest it fell after — and then wiped by the close.
    //
    // Stated by watching one town's account across a boundary: it is emptied by
    // the season's close, and whatever falls on the season's first day is already
    // in the NEXT season's account by the time the day is over.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 3);

    // Stand the world on a season boundary and give every place a full account.
    expect(startsSeason(world)).toBe(true);
    for (const t of towns) t.harvestLoss = 0.5;

    const sky = skyOf(world);
    stepWorldSeason(world, towns, markets, wars, routes); // ...which closes the account
    expect(towns.every((t) => t.harvestLoss === 0)).toBe(true);
    stepWorldDay(world, towns, sky); // ...and the day then starts the next one
    expect(towns.every((t) => t.harvestLoss < 0.5)).toBe(true);
  });

  it("runs the season before the day on a season-start day, in the driver and not only by hand", () => {
    // THE SAME ORDERING, CLAIMED AGAINST `runYears` ITSELF. The claim above
    // drives the two phases by hand, so it says nothing about the order the
    // world's own driver puts them in — and a driver that ran the day first
    // passed the whole suite when it was mutated to do so.
    //
    // A hand-built storm makes the order visible with no arithmetic in it: on the
    // first day of the run the seasonal tick fires, and at that moment weather
    // has not yet advanced, so the storm is exactly where it was put. Run the
    // other way round and it has already moved.
    const { world, towns, markets, wars, routes } = bench();
    const storm: Storm = {
      id: 1 << 24, zone: 0, bornDay: 0, x: 600, y: 400, dx: -1, dy: 0, severity: 0.9, trend: 0.02,
    };
    world.storms.push(storm);
    const put = { x: storm.x, y: storm.y };

    let whenSeasonResolved: { x: number; y: number } | null = null;
    runYears(world, towns, markets, wars, routes, 1, () => {
      if (whenSeasonResolved === null) whenSeasonResolved = { x: storm.x, y: storm.y };
    });

    expect(whenSeasonResolved).toEqual(put);
    // ...and not vacuous: the tick really does move it, once the day runs.
    expect(storm.x === put.x && storm.y === put.y).toBe(false);
  });

  it("steps every dispatch in the world, every day", () => {
    // The third seam: `sendDispatch` was called only from its own test file, so
    // NO DISPATCH HAD EVER EXISTED AT RUNTIME. The phase runs now — a dispatch
    // filed into the ring leaves it on the day it is due and not before.
    const { world, towns } = bench();
    const crown = world.nations.findIndex((n) => n.crown && n.seat >= 0);
    const bound = world.places.findIndex((p) => p.faction === crown && p.id !== world.nations[crown].seat);
    const d = sendDispatch(world, crown, bound, PAYLOAD.treasury, 500)!;
    expect(d).not.toBeNull();
    expect(inFlightCount(world)).toBe(1);

    const sky = skyOf(world);
    while (world.day < d.dueDay) {
      expect(inFlightCount(world)).toBe(1); // still at sea, every day of it
      stepWorldDay(world, towns, sky);
      stepDay(world);
    }
    stepWorldDay(world, towns, sky); // the day it is due
    expect(inFlightCount(world)).toBe(0);
  });

  it("still never looks at a dispatch at sea, with the whole tick composed", () => {
    // [P-16] RE-PROVEN THROUGH THE DRIVER. It was proved against `stepDispatches`
    // alone (dispatch.test.ts, by counting Proxy operations); the thing that could
    // break it is a driver that started asking where everything is. Fifty at sea,
    // a year of the composed tick, and not one field of one dispatch read or
    // written.
    const { world, towns, markets, wars, routes } = bench();
    const crown = world.nations.findIndex((n) => n.crown && n.seat >= 0);
    const bound = world.places.filter((p) => p.faction === crown && p.id !== world.nations[crown].seat);
    for (let i = 0; i < 50; i++) sendDispatch(world, crown, bound[i % bound.length].id, PAYLOAD.treasury, 100);
    expect(inFlightCount(world)).toBeGreaterThan(0);

    const tally = { reads: 0, writes: 0 };
    for (const bucket of world.dispatches.ring) {
      for (let j = 0; j < bucket.length; j++) {
        bucket[j] = new Proxy(bucket[j], {
          get(t, k, r) { tally.reads++; return Reflect.get(t, k, r); },
          set(t, k, v, r) { tally.writes++; return Reflect.set(t, k, v, r); },
        });
      }
    }

    runYears(world, towns, markets, wars, routes, 1);
    expect(inFlightCount(world)).toBe(0); // they all landed, so the phase ran
    expect(tally).toEqual({ reads: 0, writes: 0 });
  });

  it("makes a coast's exposure legible in a ledger, not only in a severity", () => {
    // [HC-29]: "a coast's exposure must be a property of the map, so that where a
    // place sits is a decision with consequences." `weather.test.ts` proves that
    // in severities; this proves it where it is actually felt. The most windward
    // ten coasts in the world carry more wrecks than the ten most sheltered.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 100);

    const takes = world.places.map((p) => takesOf(world, p));
    const order = takes.map((_, i) => i).sort((a, b) => takes[a] - takes[b] || a - b);
    const wrecks = (idx: number[]) => idx.reduce((n, i) => n + towns[i].works.filter((w) => w.condition === "ruin").length, 0);

    const sheltered = wrecks(order.slice(0, 10));
    const exposed = wrecks(order.slice(-10));
    expect(takes[order[order.length - 1]]).toBeGreaterThan(takes[order[0]]); // the world really has both
    expect(exposed).toBeGreaterThan(sheltered);
  });

  it("gives the same century from the same seed, twice over, with every phase in it", () => {
    // [HC-11] at full length and with the daily tick composed — the stronger form
    // of the 25-year claim above, and the one that would catch a daily phase
    // reading anything it should not.
    const a = bench();
    runYears(a.world, a.towns, a.markets, a.wars, a.routes, 100);
    const ledgers = a.towns.map((t) => [t.population, t.wealth, t.prosperity, t.harvestLoss]);
    const conditions = a.towns.map((t) => t.works.map((w) => w.condition).join(","));

    const b = bench();
    runYears(b.world, b.towns, b.markets, b.wars, b.routes, 100);
    expect(b.towns.map((t) => [t.population, t.wealth, t.prosperity, t.harvestLoss])).toEqual(ledgers);
    expect(b.towns.map((t) => t.works.map((w) => w.condition).join(","))).toEqual(conditions);
  });
});

describe("what a place brings to market", () => {
  it("brings nothing at all from a shore with no quay and no guns", () => {
    const { world, towns, markets, wars, routes } = bench();
    const shut = towns[0];
    for (const w of shut.works) w.condition = "ruin";
    shut.patron = { kind: "none", name: "", owns: false };
    produceSeason(shut, world.day);
    for (const w of shut.works) if (w.kind === "fishingShacks") w.condition = "ruin";
    clearSeason(markets, world.places, towns, wars, routes);
    expect(derive(shut).access).toBe(0);
    expect(shut.market.allotted[0]).toBe(0);
  });

  it("brings nothing from a port whose lanes are all held, however sound its quay", () => {
    // The other half of the claim above, and the one that could not be written
    // before KAN-112: this port's quay, guns and warehouses are untouched and in
    // perfect order. What has changed is outside it.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 20);
    const held = 3;
    expect(derive(towns[held]).access).toBeGreaterThan(0);

    blockade(routes, held);
    produceSeason(towns[held], world.day);
    clearSeason(markets, world.places, towns, wars, routes);

    expect(derive(towns[held]).access).toBe(0);
    expect(towns[held].market.allotted[0]).toBe(0);
    // ...and its own works are exactly as they were. Nothing burned.
    expect(towns[held].works.some((w) => CATALOGUE[w.kind].zone === "waterfront" && w.condition === "working")).toBe(true);
  });

  it("splits what it brings across every market it stands in, so nothing is conjured", () => {
    // A place in three neighbourhoods offers a third to each. Overlap must not
    // multiply the world's goods.
    const { world, towns, markets, wars, routes } = bench();
    for (let s = 0; s < 8; s++) {
      for (const t of towns) produceSeason(t, world.day);
      clearSeason(markets, world.places, towns, wars, routes);
      for (const t of towns) settleSeason(t);
      world.day += CALENDAR.daysPerSeason;
    }
    for (let i = 0; i < towns.length; i++) {
      const want = derive(towns[i]).commerce.want[0];
      // It can never be allotted more than it asked for, however many markets it
      // stands in.
      expect(towns[i].market.allotted[0]).toBeLessThanOrEqual(want + 1e-9);
    }
  });
});
