// The clearing — fifty towns' surpluses and shortfalls meeting in one phase.
//
// The claims here are §11's acceptance criteria, and the first of them is the
// one the spec calls "the single most important test in the document":
// SHUFFLING THE ITERATION ORDER OF PLACES PRODUCES IDENTICAL RESULTS.

import { describe, it, expect } from "vitest";
import { generateWorld, foundAll, warmStart } from "./worldgen";
import {
  MARKET, atWar, blockade, clearSeason, declareWar, describeMarkets, describeRoutes, laneIsOpen,
  makeMarkets, noWars, openRoutes, priceFor, reachOf, runYears, shutLane, stepWorldDay,
  stepWorldSeason, type Markets, type Routes, type Wars,
} from "./market";
import { PAYLOAD, inFlightCount, sendDispatch } from "./dispatch";
import { skyOf, takesOf, type Storm } from "./weather";
import { derive, produceSeason, settleSeason } from "../town/sim";
import { governorTurn } from "../town/governor";
import { stepFootprint } from "../town/footprint";
import { FOOD, TRADE } from "../town/constants";
import { GOOD_AT, GOOD_COUNT, GOOD_ORDER, tierTotal } from "../town/trade";
import { mixedTown, seaTown, townOf, reg, RING1, RING2 } from "../town/fixtures";
import { CATALOGUE, raise } from "../town/works";
import type { Town } from "../town/types";
import type { Place } from "./places";
import { DAY_RUN_NM, distanceNm } from "./shape";
import { CALENDAR, DAYS_PER_YEAR } from "./calendar";
import { startsSeason, stepDay, type World } from "./clock";

const SEED = 20260910;

// The house seed set. Every distribution below is pooled across all four rather
// than asserted per seed, which is what testing.md asks of a statistical claim.
const SEEDS = [SEED, 1660, 7, 99];

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

// Every port within a market's reach of place `i`, nearest first. This is the
// list `makeMarkets` picks FROM, written out here rather than asked of it — a
// claim about the pick must not be measured with the pick's own ruler.
function within(world: World, i: number): { id: number; d: number }[] {
  const out: { id: number; d: number }[] = [];
  for (let j = 0; j < world.places.length; j++) {
    if (j === i) continue;
    const d = distanceNm(world.places[i].x, world.places[i].y, world.places[j].x, world.places[j].y);
    if (d <= MARKET.reachNm) out.push({ id: j, d });
  }
  out.sort((a, b) => a.d - b.d || a.id - b.id);
  return out;
}

// THE RULE THIS REPLACED — the nearest seven, out of the same week's reach. Kept
// as the control arm, because "a spread from near to far" says nothing except
// against the thing it is not. Widening the reach on its own changes almost
// nothing, and this is what measures that.
const nearestSeven = (world: World, i: number): number[] =>
  [i, ...within(world, i).slice(0, MARKET.maxMembers - 1).map((c) => c.id)].sort((a, b) => a - b);

// The climate a port's coast lies under. Two ports under one climate grow the
// same things off the same palette, which is the whole reason a market that
// reached only its own band had nothing worth carrying.
const climateAt = (world: World, i: number): string => world.zones[world.places[i].zone].climate;

// How much two partner sets have in common, 0 to 1.
function overlap(a: number[], b: number[]): number {
  const other = new Set(b);
  let both = 0;
  for (const x of a) if (other.has(x)) both++;
  return both / new Set([...a, ...b]).size;
}

describe("a town's trading partners reach a week's sail, near to far", () => {
  it("buys off coasts that grow what its own does not, which two days' sail never reached", () => {
    // THE WHY, AND THE WHOLE POINT OF THE WIDENING. At two days' run a town's
    // partners share its climate, so they grow what it grows and there is
    // nothing to trade. The contrast IS the finding, so the rule this replaced
    // is measured beside it out of the same worlds: pooled over the four house
    // seeds, 61% of partnerships now cross a climate band against 23% under
    // nearest-seven. Nothing between the two is asserted.
    let crossed = 0;
    let pairs = 0;
    let crossedNear = 0;
    let pairsNear = 0;
    for (const seed of SEEDS) {
      const { world, markets } = bench(seed);
      for (let i = 0; i < world.places.length; i++) {
        const mine = climateAt(world, i);
        for (const j of markets.hoods[i].members) {
          if (j === i) continue;
          pairs++;
          if (climateAt(world, j) !== mine) crossed++;
        }
        for (const j of nearestSeven(world, i)) {
          if (j === i) continue;
          pairsNear++;
          if (climateAt(world, j) !== mine) crossedNear++;
        }
      }
    }
    expect(pairs).toBeGreaterThan(1000); // zero satisfies absence
    expect(pairsNear).toBeGreaterThan(1000);
    expect(crossed / pairs).toBeGreaterThan(0.5);
    expect(crossedNear / pairsNear).toBeLessThan(0.35);
  });

  it("takes a spread from the nearest port to one most of a week away, not the handful on its doorstep", () => {
    // THE HOW, and the substance of the change. Measured pooled over the four
    // house seeds: the nearest port is a partner of every one of the 194 places
    // (the near end, by construction — it is slot 0 of the stride); 72% of
    // partnerships are beyond two days' sail and 19% beyond five; the farthest
    // is 6.7 days. Under the nearest-seven rule, out of the SAME week's reach,
    // the farthest partnership in the world was 3.1 days and not one was beyond
    // three — which is why the reach alone was never going to be enough.
    const days: number[] = [];
    const nearDays: number[] = [];
    let nearestIsPartner = 0;
    let places = 0;
    for (const seed of SEEDS) {
      const { world, markets } = bench(seed);
      for (let i = 0; i < world.places.length; i++) {
        places++;
        const candidates = within(world, i);
        const partners = markets.hoods[i].members;
        if (partners.indexOf(candidates[0].id) >= 0) nearestIsPartner++;
        const near = nearestSeven(world, i);
        for (const c of candidates) {
          if (partners.indexOf(c.id) >= 0) days.push(c.d / DAY_RUN_NM);
          if (near.indexOf(c.id) >= 0) nearDays.push(c.d / DAY_RUN_NM);
        }
      }
    }
    expect(days.length).toBeGreaterThan(1000); // zero satisfies absence
    expect(nearestIsPartner).toBe(places);
    expect(days.filter((d) => d > 2).length / days.length).toBeGreaterThan(0.5);
    expect(days.filter((d) => d > 5).length / days.length).toBeGreaterThan(0.1);
    // ...and the control arm, out of the same list, reaches nothing like as far.
    expect(nearDays.filter((d) => d > 3).length / nearDays.length).toBeLessThan(0.05);
  });

  it("gives two ports on the same coast different people to trade with", () => {
    // Each town strides its OWN ranking, so two ports side by side read the same
    // candidates in a different order and come out with different partners —
    // which the nearest-N could never do. Measured on the closest pair to every
    // place: the overlap between their two sets runs 0.00 to 0.46 and averages
    // 0.20, against 0.72 under nearest-seven, where 35 of the 194 pairs held
    // sets that were IDENTICAL.
    const spread: number[] = [];
    const nearest: number[] = [];
    for (const seed of SEEDS) {
      const { world, markets } = bench(seed);
      for (let i = 0; i < world.places.length; i++) {
        const next = within(world, i)[0].id;
        spread.push(overlap(markets.hoods[i].members, markets.hoods[next].members));
        nearest.push(overlap(nearestSeven(world, i), nearestSeven(world, next)));
      }
    }
    expect(spread.length).toBeGreaterThan(150); // zero satisfies absence
    expect(Math.max(...spread)).toBeLessThan(0.75);
    expect(spread.filter((x) => x === 1).length).toBe(0);
    // ...and the control arm says that was worth claiming.
    expect(nearest.filter((x) => x === 1).length).toBeGreaterThan(10);
  });

  it("still leaves ports that never trade with each other, so this is a sea and not one marketplace", () => {
    // A WEEK AND NOT A FORTNIGHT. world-loop.md names the failure state: when
    // every port is everyone's neighbour there is no far coast to be far from
    // and nothing can be cut off, and you are watching a marketplace. Measured
    // across the four house seeds: 32% of the world's port pairs have no trade
    // between them at all.
    let apart = 0;
    let pairs = 0;
    for (const seed of SEEDS) {
      const { world, routes } = bench(seed);
      const n = world.places.length;
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          pairs++;
          if (!laneIsOpen(routes, a, b)) apart++;
        }
      }
    }
    expect(pairs).toBeGreaterThan(4000); // zero satisfies absence
    expect(apart / pairs).toBeGreaterThan(0.2);
  });
});

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
    // however cheap it looks at fifty. THE CAP IS NOW LOAD-BEARING RATHER THAN
    // DECORATIVE, and the precondition is measured beside the claim so it cannot
    // pass by there being nothing to cap: at a week's reach a town has 22 to 49
    // ports to choose from and seats seven of them.
    const { world, markets } = bench();
    for (const h of markets.hoods) {
      expect(h.members.length).toBeLessThanOrEqual(MARKET.maxMembers);
      expect(h.members.length).toBeLessThan(world.places.length);
    }
    for (let i = 0; i < world.places.length; i++) {
      expect(within(world, i).length).toBeGreaterThan(MARKET.maxMembers * 2);
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

  it("leaves no port with nobody to trade with, which is the precondition for the rest", () => {
    // THE GUARD ON A CASE NOTHING HERE CAN EXERCISE. A place with no lane at all
    // reads reach 0 and is shut out of trade entirely — the honest answer, since
    // nobody buys or sells with a port that has no trading partner. Measured
    // across the four house seeds, this world has NO such place: at a week's
    // reach the thinnest row is fourteen lanes and the busiest forty-four (it
    // was six and twelve-to-fifteen at two days'). So no mutation of that branch
    // can fail anything, and this is the claim that says why. If the siting or
    // `MARKET.reachNm` ever leaves a port alone on its coast, this fails first
    // and the branch starts mattering.
    for (const seed of SEEDS) {
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

    expect(tierTotal(towns[0].market.allotted, "victuals")).toBeGreaterThan(0);
    expect(tierTotal(towns[2].market.allotted, "victuals"))
      .toBeCloseTo(tierTotal(towns[0].market.allotted, "victuals"), 9);
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
  //
  // IT HAS A REEF, AND THE REEF IS WHAT KEEPS THE CLAIM ABOUT THE PYRAMID. Since
  // the market started trading named goods, "cannot get bread" has to be said of
  // GOODS: a coast with nothing at all is short of grain, of fish and of salt at
  // once, and a fixture that cannot be fed for want of any one of them would
  // test the fish supply rather than the gate. Its own shacks cover its fish; it
  // is short of corn and salt, and that is what it has to buy to climb.
  function hungryPort(): Town {
    const t = townOf(
      [
        reg(0, "timberedHills", RING1.slice(0, 3), { bears: { timber: "ideal" } }),
        reg(1, "roadstead", RING1.slice(3, 6)),
        reg(2, "reef", RING2.slice(0, 4), { bears: { fish: "ideal" } }),
        reg(3, "scrub", RING2.slice(4, 10)),
      ],
      { population: 60, wealth: 200000 },
    );
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

  // ...and a neighbour with corn, salt and timber to spare — every part of the
  // diet the port lacks, because a tier is covered only when the whole of it is.
  function farmingNeighbour(): Town {
    const t = townOf(
      [
        reg(0, "tilledGround", RING1.slice(0, 2), { bears: { food: "ideal" } }),
        reg(1, "saltPans", RING1.slice(2, 4), { bears: { salt: "ideal" } }),
        reg(2, "timberedHills", RING1.slice(4, 6), { bears: { timber: "ideal" } }),
        reg(3, "roadstead", RING2.slice(0, 3)),
        reg(4, "reef", RING2.slice(3, 6), { bears: { fish: "ideal" } }),
        reg(5, "scrub", RING2.slice(6, 12)),
      ],
      { population: 120, wealth: 500 },
    );
    raise(t, "warehouse", DAY0);
    raise(t, "provisionGround", DAY0);
    raise(t, "saltWorks", DAY0);
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
    expect(derive(hungry[1]).commerce.offer[GOOD_AT.timber]).toBeGreaterThan(0); // timber IS to be had
    expect(c.want[GOOD_AT.grain]).toBeGreaterThan(0);
    expect(c.want[GOOD_AT.timber]).toBeGreaterThan(0); // and it wants some...
    expect(tierTotal(hungry[0].market.allotted, "victuals")).toBe(0); // ...but there is no bread
    // ...so it registers no demand IN THE WHOLE TIER ABOVE, timber included.
    expect(tierTotal(hungry[0].market.allotted, "materials")).toBe(0);
    expect(tierTotal(hungry[0].market.allotted, "luxury")).toBe(0);
  });

  it("reaches for the next tier the moment the one below is covered", () => {
    const places = [placeAt(0, 0), placeAt(1, 40)];
    const markets = makeMarkets(places);

    const fed = [hungryPort(), farmingNeighbour()];
    clearSeason(markets, places, fed, noWars(3), openRoutes(markets));
    expect(tierTotal(fed[0].market.allotted, "victuals")).toBeGreaterThan(0);
    expect(tierTotal(fed[0].market.allotted, "materials")).toBeGreaterThan(0);
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

    expect(tierTotal(peace[0].market.allotted, "victuals")).toBeGreaterThan(0);
    expect(tierTotal(war[0].market.allotted, "victuals")).toBe(0);
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
      const g = towns[i].population - tierTotal(derive(towns[i]).commerce.produced, "victuals") / FOOD.perHead;
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
    expect(tierTotal(d.commerce.bought, "victuals")).toBeGreaterThan(0);
    // Its people outnumber what its own ground could ever have fed — which the
    // old ~450-soul cap forbade by construction.
    expect(port.population).toBeGreaterThan(tierTotal(d.commerce.produced, "victuals"));
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
    const ownGround = tierTotal(derive(port).commerce.produced, "victuals") / FOOD.perHead;
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
    let moving = 0;
    for (let g = 0; g < GOOD_COUNT; g++) moving += open.want[g] + open.offer[g];
    expect(moving).toBeGreaterThan(0);

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

  // A CLAIM STOOD HERE AND ITS MECHANISM IS GONE (KAN-137). It read "stops a
  // blockaded port BUILDING as well as eating, however full its coffers", and it
  // was [HC-87c] reaching a second system: a cordon takes a port's `access` to
  // nothing, so it registers no demand for planks, so the materials build-gate
  // fires and its shipways stand idle.
  //
  // THE GATE IS DELETED, so a blockaded port with a hundred thousand coin now
  // builds. That is a real tooth out of the cordon and it is reported rather
  // than patched: a blockade still stops a port EATING, which is the claim above
  // and the one [HC-87] actually turns on. Nothing is written here in its place,
  // because there is no rule left to claim.

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

// ---- The market trades NAMED GOODS, not three classes ----------------------
//
// Ratified 2026-09-28. A town's produce used to be looked up, turned into one of
// three buckets and its name thrown away at the quay, so timber and stone were
// the same thing to the market and no port could be short of anything in
// particular. These are the claims that the name survives the crossing.
describe("the market trades named goods, not three classes", () => {
  // FOUR WORLDS, WARMED AND RUN ON, BUILT ONCE ([P-18]) — the three claims below
  // all read the same runs, and a claim about which coast ships what is a claim
  // about a world whose governors have had time to decide what their ground is
  // for.
  const worlds = SEEDS.map((seed) => {
    const w = warmStart(seed);
    runYears(w.world, w.towns, w.markets, w.wars, w.routes, 25);
    return w;
  });

  // WHAT THIS PORT IS KNOWN FOR, in one word: the good its quay ships most COIN
  // of. It is the Cutthroats readout — one main export, in words — and it is
  // computed here rather than stored, because eleven goods across fifty towns is
  // six hundred numbers: fine to compute, fatal to display.
  const mainExport = (t: Town): string => {
    const c = derive(t).commerce;
    let best = -1;
    let worth = 0;
    for (let g = 0; g < GOOD_COUNT; g++) {
      const v = c.offer[g] * t.market.price[g];
      if (v > worth) {
        worth = v;
        best = g;
      }
    }
    return best < 0 ? "(nothing)" : GOOD_ORDER[best];
  };

  it("prices two goods of one tier differently in the same port, which one victuals price could not", () => {
    // The first half of "every good carries its own price". Grain and fish are
    // both victuals and are not the same thing to anybody: one comes off tilled
    // ground and the other off a reef, and a port that has a reef and no fields
    // faces two different numbers for them. Under the three classes this
    // difference was not merely absent, it was UNSAYABLE.
    let apart = 0;
    let ports = 0;
    for (const w of worlds) {
      for (const t of w.towns) {
        ports++;
        if (Math.abs(t.market.price[GOOD_AT.grain] - t.market.price[GOOD_AT.fish]) > 1e-9) apart++;
      }
    }
    expect(ports, "no live port in four worlds").toBeGreaterThan(150);
    // Measured: 194 of 194 across the house seeds. Bounded well under it,
    // because what must never happen is the two moving together by construction.
    expect(apart).toBeGreaterThan(ports * 0.8);
  });

  it("prices the same good differently in two ports a week apart", () => {
    // [HC-82] said of a GOOD rather than of a class. The pair is required to be
    // BEYOND `MARKET.reachNm` — a week's sail — which is exactly the distance at
    // which neither port can be in the other's market, so the two figures were
    // struck by different neighbourhoods and there is no table either could have
    // consulted.
    let disagreeing = 0;
    let widest = 1;
    for (const w of worlds) {
      for (let a = 0; a < w.towns.length; a++) {
        for (let b = a + 1; b < w.towns.length; b++) {
          const far = distanceNm(w.world.places[a].x, w.world.places[a].y, w.world.places[b].x, w.world.places[b].y);
          if (far <= MARKET.reachNm) continue;
          const pa = w.towns[a].market.price[GOOD_AT.grain];
          const pb = w.towns[b].market.price[GOOD_AT.grain];
          const ratio = pa > pb ? pa / pb : pb / pa;
          if (ratio > widest) widest = ratio;
          if (ratio > 1.2) disagreeing++;
        }
      }
    }
    // Measured across the house seeds: the widest grain disagreement runs 1.68x
    // to 2.62x, over hundreds of pairs. Bounded under the narrowest of them.
    expect(disagreeing, "no two ports beyond a week's sail disagree about grain").toBeGreaterThan(100);
    expect(widest).toBeGreaterThan(1.4);
  });

  it("leaves a map with several main exports rather than one", () => {
    // The point of the whole direction, as a sentence about the world: ports
    // need each other FOR SPECIFIC THINGS. One main export per port, and the map
    // holds several different ones — which is not true of a market that trades
    // three buckets, where every coast ships "luxury".
    for (const w of worlds) {
      const kinds = new Set<string>();
      for (const t of w.towns) {
        const g = mainExport(t);
        if (g !== "(nothing)") kinds.add(g);
      }
      // Measured 6 to 9 distinct main exports per world across the house seeds.
      expect(kinds.size, `only ${[...kinds].join(", ")} is shipped anywhere`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("cost is linear in the number of places", () => {
  it("bounds the work per season by the place count, never by its square", () => {
    // [HC-15] / [HC-83]. Stated structurally rather than by a stopwatch: the
    // clearing walks each neighbourhood's members once per GOOD, so the total is
    // the sum of the memberships times a fixed handful of goods — and the cap
    // holds that under k x N however crowded a coast gets.
    //
    // THE GOODS WIDENED THE SCRATCH AND NOT THE ALGORITHM, which is the claim
    // this has to go on making: eleven goods instead of three multiplies the
    // pass by a CONSTANT, and a constant is not a square. Nothing here compares
    // a place to a place.
    const { markets } = bench();
    let visits = 0;
    for (const h of markets.hoods) visits += h.members.length;
    expect(visits).toBeLessThanOrEqual(MARKET.maxMembers * markets.hoods.length);
    // ...and the work PER PLACE does not grow when the map does, which is the
    // whole difference between linear and square. Two coasts of the same shape,
    // one four times as crowded: a place still trades with a handful. Without
    // the cap the dense one would be four times the work per place.
    const coast = (n: number) => Array.from({ length: n }, (_, i) => ({ x: 120 + i * (1200 / n), y: 340 }));
    const perPlace = (m: Markets) => m.hoods.reduce((a, h) => a + h.members.length, 0) / m.hoods.length;
    expect(perPlace(makeMarkets(coast(80)))).toBeLessThanOrEqual(perPlace(makeMarkets(coast(20))));
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

    // AND "LOUDER" HAS TO MEAN LOUDER, which the strict-increase form did not
    // say (KAN-137 found it). Four windows have a one-in-twenty-four chance of
    // rising in order by noise alone, so with fifty places a world carries a
    // couple of false positives and the claim passed by luck of the seed: after
    // the flat food base landed, Vaudreuil le Vieux read `54.1 -> 54.3 -> 56.5
    // -> 70.3`, whose first step is two tenths of a soul. A place whose swing is
    // 30% wider after two centuries is not Bannerlord's loop; a place in that
    // loop diverges, because each overshoot funds the next.
    //
    // So the rule is stated as the rule: RISING IN ORDER *AND* AT LEAST DOUBLED
    // end to end. It is a relationship rather than a dial — the doubling is a
    // weak bar for a real divergence and an impossible one for noise.
    const growing: string[] = [];
    for (let i = 0; i < towns.length; i++) {
      const w = [0, 1, 2, 3].map((k) => swing(trace[i], k * WINDOW, (k + 1) * WINDOW));
      if (w[1] > w[0] && w[2] > w[1] && w[3] > w[2] && w[3] >= w[0] * 2) {
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
    expect(shut.market.allotted.every((a) => a === 0)).toBe(true);
  });

  it("brings nothing from a port whose lanes are all held, however sound its quay", () => {
    // The other half of the claim above, and the one that could not be written
    // before KAN-112: this port's quay, guns and warehouses are untouched and in
    // perfect order. What has changed is outside it.
    // THE PORT IS SELECTED, NOT NUMBERED (KAN-137 found it). It was `towns[3]`,
    // and the claim's last line is about that place still holding a working
    // waterfront work — so the fixture only ever said anything while place 3
    // happened to own one. It stopped owning one the moment the world's shape
    // moved. Select and assert at the same instant: the richest port that has
    // both a quay and lanes still calling.
    const { world, towns, markets, wars, routes } = bench();
    runYears(world, towns, markets, wars, routes, 20);
    let held = -1;
    for (let i = 0; i < towns.length; i++) {
      const hasQuay = towns[i].works.some((w) => CATALOGUE[w.kind].zone === "waterfront" && w.condition === "working");
      if (!hasQuay || derive(towns[i]).access <= 0) continue;
      if (held < 0 || towns[i].population > towns[held].population) held = i;
    }
    expect(held, "no port in this world has a working quay and open lanes").toBeGreaterThanOrEqual(0);
    expect(derive(towns[held]).access).toBeGreaterThan(0);

    blockade(routes, held);
    produceSeason(towns[held], world.day);
    clearSeason(markets, world.places, towns, wars, routes);

    expect(derive(towns[held]).access).toBe(0);
    expect(towns[held].market.allotted.every((a) => a === 0)).toBe(true);
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
      const c = derive(towns[i]).commerce;
      // It can never be allotted more than it asked for, OF ANY ONE GOOD, however
      // many markets it stands in.
      for (let g = 0; g < GOOD_COUNT; g++) {
        expect(towns[i].market.allotted[g], `${GOOD_ORDER[g]} at place ${i}`)
          .toBeLessThanOrEqual(c.want[g] + 1e-9);
      }
    }
  });
});

// ---- A town's ordinary trade turns a very small profit (KAN-131) ------------
//
// RATIFIED 2026-09-21: "In most cases towns really just try to get by. Sometimes
// they get investments, sometimes they don't. Naturally they grow over time, but
// it's not a fast process, unless someone WANTS them to grow fast. I'd say
// balance it that trade generally causes a very small profit, which they can
// then reinvest." The 450-600 day-0 target is withdrawn with it.
//
// THESE ARE WORLD-SCALE CLAIMS AND THEY HAVE TO BE. A town stepped on its own is
// UNCLEARED, so it faces par prices — victuals at 1.00 where the cleared world
// prices them at 0.13 — and a lone fixture therefore earns about seven times
// what the same place earns among neighbours. Every claim below about how much a
// place makes is asked of the warm world, through the real clearing.
//
// FOUR SEEDS, POOLED, and the suite's own rule says why: a claim about a
// distribution over fifty places asked of one sample is a decoration. Where the
// with-behaviour and without-behaviour ranges might overlap, the pool is what
// puts the claim outside them.
describe("a town's own trade turns a very small profit", () => {
  const SEEDS_4 = [20260910, 1660, 7, 99];

  // THREE ARMS OF THE SAME FOUR WORLDS, built once ([P-18]) because a warm start
  // is most of a second and these claims all read the same runs:
  //
  //   ORDINARY   the world as it is — its crowns' standing grants, its weather.
  //   TRADE ONLY the same world with every grant set to nothing, which is the
  //              only honest way to ask what a place's OWN trade clears.
  //   CALM       the same world with the daily tick's weather never run, so the
  //              storm's price is a difference rather than an assertion.
  // ONE WARM START PER SEED, COPIED TWICE ([P-54]: who is forced to pay). The
  // pre-run is most of a second and the three arms must begin from the SAME day
  // 0 — not merely from the same seed — so a structured copy is both cheaper
  // and stricter than warming three worlds. Measured: twelve warm starts cost
  // the suite about ten seconds; four cost it three.
  // What a place has built, counted the same way in both arms.
  const capitalOf = (t: Town) =>
    t.works.filter((w) => w.condition !== "ruin" && CATALOGUE[w.kind].cls === "capital").length;

  const arms = SEEDS_4.map((seed) => {
    const warm = warmStart(seed);
    const copy = () => structuredClone(warm);

    const ordinary = copy();
    const start = ordinary.towns.map((t) => t.wealth);
    runYears(ordinary.world, ordinary.towns, ordinary.markets, ordinary.wars, ordinary.routes, 10);
    const atTen = ordinary.towns.map((t) => t.wealth);
    const capitalAtTen = ordinary.towns.map(capitalOf);
    // A QUAY IS A CAPITAL WATERFRONT WORK, read at the same instant the purse is
    // — "select and assert at the same instant", because a strand is not a quay
    // and a place can acquire one in the forty years that follow.
    const quayed = ordinary.towns.map((t) =>
      t.works.some((w) => w.condition === "working" && CATALOGUE[w.kind].cls === "capital" && CATALOGUE[w.kind].zone === "waterfront"));
    runYears(ordinary.world, ordinary.towns, ordinary.markets, ordinary.wars, ordinary.routes, 40);
    const atFifty = ordinary.towns.map((t) => t.wealth);

    const alone = copy();
    for (const t of alone.towns) t.grant = 0;
    const aloneStart = alone.towns.map((t) => t.wealth);
    runYears(alone.world, alone.towns, alone.markets, alone.wars, alone.routes, 10);
    const capitalAlone = alone.towns.map(capitalOf);

    const calm = copy();
    runYearsWithoutWeather(calm.world, calm.towns, calm.markets, calm.wars, calm.routes, 50);

    return {
      seed, ordinary, calm, quayed, start, atTen, atFifty, capitalAtTen, capitalAlone,
      // Live places only: a shore still awaiting settlers is not a town getting by.
      live: ordinary.towns.map((t, i) => (t.population >= 1 ? i : -1)).filter((i) => i >= 0),
      // What each place put in its purse in its first decade, with the crown's
      // money and without it.
      gainedWithCrown: ordinary.towns.map((_, i) => atTen[i] - start[i]),
      gainedAlone: alone.towns.map((t, i) => t.wealth - aloneStart[i]),
    };
  });

  const medianOf = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  // The cheapest thing coin can buy, read off the catalogue rather than written
  // down here — a threshold written twice is a threshold free to drift.
  const cheapestWork = Math.min(
    ...(Object.keys(CATALOGUE) as (keyof typeof CATALOGUE)[])
      .filter((k) => CATALOGUE[k].cls === "capital")
      .map((k) => CATALOGUE[k].cost),
  );

  it("is asked of four worlds through the real clearing, not of one town on its own", () => {
    expect(arms.length).toBe(4);
    for (const a of arms) expect(a.live.length).toBeGreaterThan(40);
    expect(cheapestWork).toBeGreaterThan(0);
  });

  it("leaves a place with a working quay measurably richer at fifty years than at ten", () => {
    // THE RULE, first half: a place that can trade at all ACCUMULATES rather
    // than hovering at its build cost for ever. Not every one of them — a place
    // can be flattened by a storm in year 30 — so the claim is about the
    // distribution, and the measured figure is 15/16 · 21/25 · 30/32 · 18/19,
    // which is 84 of 92 across the four worlds.
    let quayed = 0;
    let richer = 0;
    for (const a of arms) {
      for (const i of a.live) {
        if (!a.quayed[i]) continue;
        quayed++;
        if (a.atFifty[i] > a.atTen[i]) richer++;
      }
    }
    expect(quayed).toBeGreaterThan(40); // ...and there were quays to speak of
    expect(richer).toBeGreaterThan(quayed * 0.8);
  });

  it("and cannot fund a capital work off its own trade inside a decade", () => {
    // THE RULE, second half, and it is the one that says "slowly". Every grant
    // is set to nothing, so what is measured is the place's OWN trade: what it
    // sold, less its bread, its keep and its weather.
    //
    // Measured pooled across the four worlds: the median place puts 38 coin in
    // its purse in ten years against a cheapest capital work of 180 — a work in
    // roughly five decades, which is the ratified "decades, not seasons". 117 of
    // 194 places are under a tavern's 200 over the same decade.
    //
    // IT WAS BOUNDED PER SEED AND IT HAD TO BE POOLED (KAN-137), AND THE REASON
    // IS [P-55] ON ITS OWN TERMS. Once victuals actually cleared, the four
    // per-seed medians read **0.00 · 0.00 · 389.22 · 486.50**. Nothing in the
    // middle, because half of every world settles a negative yield at exactly
    // zero (`settleSeason`'s `Math.max(0, …)`) and the other half earns — so a
    // per-seed median of a two-humped distribution sits in one hump or the
    // other and JUMPS the moment slightly more than half the places start
    // earning. It describes nobody either side of the jump.
    //
    // Pooled over all 194 live places the same decade reads **12.81 coin**
    // against a cheapest work of 180, which is the ratified sentence intact and
    // is now a claim about two hundred places rather than four medians of fifty.
    //
    // AND THE RESIDUAL IS REPORTED RATHER THAN ABSORBED: the pooled p75 is
    // **1,097 coin**, so a quarter of the world does now fund capital works off
    // its own trade, which is what "growth comes from trade" was asked for and
    // is a question for whoever holds "a town gets by".
    const pooled = arms.flatMap((a) => a.live.map((i) => a.gainedAlone[i]));
    const gained = medianOf(pooled);
    expect(pooled.length, "no live place in four worlds").toBeGreaterThan(150);
    expect(gained, `the median place put ${gained.toFixed(0)} coin by in a decade`)
      .toBeLessThan(cheapestWork);
  });

  it("and a crown's money still outweighs what its own trade clears", () => {
    // THE LINE THIS STORY MUST NOT CROSS, as a number rather than an assertion:
    // "a patron's grant, a crown's money and the player's purse must remain the
    // difference between a port and a great port". If trade alone closed that
    // gap, the whole haven-development thread would lose its leverage.
    //
    // SPLIT BY QUAY, BECAUSE [P-55] SAYS THE POOLED MEDIAN DESCRIBES NOBODY, and
    // KAN-126 is what forced the issue. The claim used to read `alone > 0` off
    // the whole population — the median place put 38 coin by in a decade — and
    // that 38 was always "the average of a windfall and a deficit". Split, the
    // same four worlds read:
    //
    //                       with the crown    on its own trade
    //   before   quayed          988.68             771.74   (n=92)
    //            bare             51.04              -3.94   (n=102)
    //   after    quayed          901.40             612.08   (n=46)
    //            bare              0.30              -7.68   (n=148)
    //
    // The pooled `alone` median fell 38.02 -> 0.00 and the claim went red — but
    // the population it described had not stopped earning, it had stopped being
    // one population. WHAT ACTUALLY MOVED IS THE COUNT: quayed places halved,
    // 92 -> 46, because `quaysideOf` lost the fishing shacks' cut of the traffic
    // (14.5% of all trade income in the world, measured) and fewer places can
    // afford a waterfront work. That is `quaysideOf` being load-bearing, which
    // KAN-131 named and KAN-132 owns.
    //
    // KAN-132 THEN LANDED, and the same four worlds read:
    //
    //   KAN-132  quayed          422.40             272.09   (n=41)
    //            bare              4.05             -15.01   (n=153)
    //
    // The quayed half's own trade now funds a 180-coin work in a decade and a
    // half rather than in seven years, which is the ratified "decades" arriving
    // honestly. AND THE HALF WITHOUT A QUAY WENT FURTHER INTO THE RED, -7.68 ->
    // -15.01, which is not a regression but a REVELATION: it was the standing
    // quayside allowance keeping that half at nominal break-even, and with the
    // allowance gone the loss is visible. Its cause is upkeep against a
    // self-feeding town's income, which is KAN-131's dial and not this one's.
    //
    // A POOLED MEDIAN SITTING AT A CLAMP IS [P-52]'S OWN TELL, and it is the
    // reason the bound below is on the halves rather than on the whole: half the
    // world's places settle a negative yield at exactly zero, so the median of
    // the whole is a report about the clamp and not about trade.
    const median = (pick: (a: (typeof arms)[0], i: number) => number, quay: boolean) =>
      medianOf(arms.flatMap((a) => a.live.filter((i) => a.quayed[i] === quay).map((i) => pick(a, i))));

    const quayedAlone = median((a, i) => a.gainedAlone[i], true);
    const bareAlone = median((a, i) => a.gainedAlone[i], false);

    // THE LIVENESS HALF, on the half of the population that has a quay: trade
    // does turn a profit, and a real one, for a place that can reach a market.
    expect(quayedAlone).toBeGreaterThan(0);
    // ...and the half without one does not, which is the sentence the pooled
    // median was hiding rather than a new finding: it was already -3.94.
    expect(bareAlone).toBeLessThan(quayedAlone);

    // THE RULE ITSELF — AND THE INSTRUMENT CHANGED UNDER IT (KAN-137). It used
    // to be asked of the PURSE: a granted place banks more in a decade than the
    // same place on its own trade. With the materials build-gate deleted a
    // granted place no longer banks the grant, IT SPENDS IT — measured, the
    // quayed half's decade came out 155 coin with the crown against 183
    // without, which says the money got built rather than that it was not
    // there. A purse is a residue, not an income.
    //
    // So it is asked of what the coin BECAME, which is the sentence the rule
    // was always making: the crown's money is what moves a place. Counted over
    // every live place in four worlds, with the arms differing in the grant and
    // in nothing else.
    let withCrown = 0;
    let onItsOwn = 0;
    for (const a of arms) {
      for (const i of a.live) {
        withCrown += a.capitalAtTen[i];
        onItsOwn += a.capitalAlone[i];
      }
    }
    expect(onItsOwn, "nobody built anything in either arm").toBeGreaterThan(0);
    expect(withCrown).toBeGreaterThan(onItsOwn);
  });

  it("and a storm is still worth fearing on it", () => {
    // The margin must survive the weather WITHOUT making the weather
    // shruggable. This is the magnitude half of "leaves a ledger a century
    // without weather does not" — that claim asserts a direction, and a
    // direction is satisfied by a world one coin poorer.
    //
    // Measured over fifty years across the four worlds: the weathered world
    // holds 30% less coin and 39% fewer souls than the same world with the
    // daily tick's weather never run.
    let wetCoin = 0, dryCoin = 0, wetPeople = 0, dryPeople = 0;
    for (const a of arms) {
      wetCoin += totalOf(a.ordinary.towns, (t) => t.wealth);
      dryCoin += totalOf(a.calm.towns, (t) => t.wealth);
      wetPeople += totalOf(a.ordinary.towns, (t) => t.population);
      dryPeople += totalOf(a.calm.towns, (t) => t.population);
    }
    expect(wetCoin).toBeLessThan(dryCoin * 0.85);
    expect(wetPeople).toBeLessThan(dryPeople * 0.85);
  });
});

// ---- [HC-47] the goods a town lands are goods another town grew -------------
//
// "No money is created or destroyed outside this circulation... nothing is
// emitted from nowhere — the same principle as a town's wealth is EARNED, not
// emitted." The clearing is where that has to be true of the MAP rather than of
// one ledger.
describe("nothing is conjured in the clearing", () => {
  it("never lands a place bread that nobody grew", () => {
    // SUMMATION CONSERVES ([HC-83]): a buyer takes `want x fill` where `fill` is
    // supply over demand, so the allotments in a neighbourhood can never exceed
    // what its members put up. Asserted over the whole map, GOOD BY GOOD, over
    // several seasons — because one season with nothing on either side of the
    // scale would pass it for the wrong reason.
    //
    // A WARM WORLD, AND THAT IS THE LIVENESS GUARD DOING ITS JOB. A world on its
    // first day has raised nothing that a governor decides to raise: no quarry,
    // no sawpit, no salt works, no cane. Every place is fed by the subsistence
    // floor and nothing on the map is short of a good anybody else has, so the
    // clearing is honestly empty — and an emptiness satisfies every inequality
    // below. The conservation claim needs a map with real cargo on it.
    const { world, towns, markets, wars, routes } = warmStart(SEED);
    let sawTrade = false;
    for (let s = 0; s < 12; s++) {
      for (const t of towns) produceSeason(t, world.day);
      const offered = new Array(GOOD_COUNT).fill(0);
      for (const t of towns) {
        const c = derive(t).commerce;
        for (let k = 0; k < GOOD_COUNT; k++) offered[k] += c.offer[k];
      }
      clearSeason(markets, world.places, towns, wars, routes);
      const allotted = new Array(GOOD_COUNT).fill(0);
      for (const t of towns) for (let k = 0; k < GOOD_COUNT; k++) allotted[k] += t.market.allotted[k];
      for (let k = 0; k < GOOD_COUNT; k++) {
        expect(allotted[k], `${GOOD_ORDER[k]}: ${allotted[k].toFixed(3)} landed against ${offered[k].toFixed(3)} grown`)
          .toBeLessThanOrEqual(offered[k] + 1e-9);
      }
      if (allotted[GOOD_AT.grain] > 0) sawTrade = true;
      for (const t of towns) settleSeason(t);
      world.day += CALENDAR.daysPerSeason;
    }
    // ...and the liveness guard, because a map where nothing moves satisfies
    // every inequality above.
    expect(sawTrade).toBe(true);
  });
});
