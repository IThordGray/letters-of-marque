// The fifty places — where they are, what they are, and who they answer to.
//
// Nothing here pins a spacing constant, a city count, a neutral share or a name.
// What is pinned is that a port stands where a port could stand, that the three
// axes are three axes, that a city is designated and a neutral is not, and that
// the whole thing survives being asked for a different number of ports.

import { describe, it, expect } from "vitest";
import { CROWN_IDS, FACTIONS, FACTION_IDS, NAME_POOLS, holdingsOf, makeNations } from "./factions";
import { hinterlandAt, isOutpost, legBetween, makePlaces, sitePlaces, sizeRank, SIZES, type Place } from "./places";
import { makeShape, DAY_RUN_NM, RAYS, isLandAt, distanceNm } from "./shape";
import { makeZones } from "./climate";
import { generateWorld } from "./worldgen";

const SEED = 1660;
const WORLD = generateWorld(SEED);
const PLACES = WORLD.places;

const nationOf = (p: Place) => WORLD.nations[p.faction];
const crowns = PLACES.filter((p) => nationOf(p).crown);
const neutrals = PLACES.filter((p) => !nationOf(p).crown);

describe("where the ports are", () => {
  it("puts about fifty ports on the sea, and lets the coastline say how many", () => {
    // "A number worth honouring rather than exceeding." The coastline is the
    // constraint, so the claim is a band rather than an equality — and the upper
    // bound is the one that matters, because the performance budget assumes it.
    for (const seed of [1660, 7, 99991, 40]) {
      const n = generateWorld(seed).places.length;
      expect(n, `seed ${seed}`).toBeLessThanOrEqual(50);
      expect(n, `seed ${seed}`).toBeGreaterThan(40);
    }
  });

  it("stands every one of them on a coast — ground behind it, open sea in front", () => {
    for (const p of PLACES) {
      let land = 0;
      let sea = 0;
      for (const ray of RAYS) {
        if (isLandAt(WORLD.shape, p.x + ray.dx * 12, p.y + ray.dy * 12)) land++;
        if (!isLandAt(WORLD.shape, p.x + ray.dx * 26, p.y + ray.dy * 26)) sea++;
      }
      expect(land, `${p.name} has no hinterland`).toBeGreaterThan(0);
      expect(sea, `${p.name} has no sea`).toBeGreaterThan(0);
    }
  });

  it("lets no two ports share a beach", () => {
    for (let i = 0; i < PLACES.length; i++) {
      for (let j = i + 1; j < PLACES.length; j++) {
        expect(legBetween(PLACES[i], PLACES[j]), `${PLACES[i].name} / ${PLACES[j].name}`).toBeGreaterThan(30);
      }
    }
  });

  it("gives every port a neighbour inside a passage of a few days", () => {
    // §6: a typical inter-port leg is one to four days. A port with nothing
    // inside four days has nobody to trade with and nothing to be raided from.
    for (const p of PLACES) {
      const nearest = Math.min(...PLACES.filter((q) => q !== p).map((q) => legBetween(p, q)));
      expect(nearest / DAY_RUN_NM, `${p.name} is alone`).toBeLessThan(4);
    }
  });

  it("keeps the same ports when asked for fewer of them", () => {
    // [HC-10] in the one part of the generator that is not a pure per-place
    // function. Siting accepts a candidate on the strength of what has ALREADY
    // been accepted, never of what comes later — so a smaller world is a prefix
    // of a larger one, and a fifty-first port cannot move the fifty.
    const shape = makeShape(SEED);
    const fifty = sitePlaces(SEED, shape, 50);
    const forty = sitePlaces(SEED, shape, 40);
    expect(forty).toEqual(fifty.slice(0, forty.length));
  });

  it("gives the same seed the same world, port for port and name for name", () => {
    expect(generateWorld(SEED).places).toEqual(PLACES);
  });
});

describe("the three axes", () => {
  it("designates the cities, one to each crown, and seats that crown there", () => {
    // [HC-62] city is authored-only. [HC-39] every crown has a seat. In the
    // 1660s the great ports of this sea are those seats, which is why the two
    // facts are one decision.
    const cities = PLACES.filter((p) => p.size === "city");
    expect(cities).toHaveLength(CROWN_IDS.length);
    for (const crown of CROWN_IDS) {
      const nation = WORLD.nations[FACTION_IDS.indexOf(crown)];
      expect(nation.seat, `${crown} has no seat`).toBeGreaterThanOrEqual(0);
      const seat = PLACES[nation.seat];
      expect(seat.size, `${crown}'s seat is not a city`).toBe("city");
      expect(seat.faction, `${crown} does not hold its own seat`).toBe(nation.id);
    }
  });

  it("designates its great ports where the ground behind them will feed a city", () => {
    // KAN-99, and the term `standingOf` was missing. A harbour is what lets a
    // port TRADE; a hinterland is what lets it be LARGE — and "which harbours
    // grew into great ports" was being decided by shelter, company and a roll,
    // none of which has anything to say about whether the ground will feed
    // anybody. Measured before the term existed: the five designated cities of
    // this sea came out at 83 to 290 souls on day 0 while its largest place, a
    // settlement, stood at 910.
    //
    // FOUR SEAS, NOT ONE, and that is what makes this a claim rather than a
    // coincidence. The roll is still a sixth of the argument and a lucky
    // headland may still be designated over a fertile one, so on any single sea
    // the cities can come out barely above the middle. Measured across eight
    // seeds, the designated cities' ground runs **1.57 to 3.31** times the
    // median coast's; with the term taken out of the score it runs **1.12 to
    // 2.03**, and two of these four seas fall through the bar below. That
    // overlap is exactly why one sea cannot tell the cases apart.
    for (const seed of [1660, 20260910, 7, 99]) {
      const world = seed === SEED ? WORLD : generateWorld(seed);
      const score = world.places.map((p) => hinterlandAt(world, p));
      const sorted = [...score].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const cities = world.places.filter((p) => p.size === "city");
      const mean = cities.reduce((a, p) => a + score[p.id], 0) / cities.length;
      expect(mean, `seed ${seed} designated its cities on ordinary ground`)
        .toBeGreaterThan(median * 1.5);
    }
  });

  it("designates no neutral city, because nothing neutral can ever be chartered", () => {
    // [HC-65] plus [HC-51]: a neutral place has no patron, so an unpromotable
    // great port would be a dead end the size class could never explain.
    for (const p of neutrals) expect(p.size, p.name).not.toBe("city");
  });

  it("keeps size and purpose independent, so a small place can outfight a big one", () => {
    // [HC-54]: every combination is legal and none is special-cased. The
    // observable form of that is that neither axis predicts the other.
    const seen = new Set(PLACES.map((p) => `${p.size}/${p.purpose}`));
    expect(seen.size).toBeGreaterThan(3);
    const purposesBySize = new Map<string, Set<string>>();
    for (const p of PLACES) {
      if (!purposesBySize.has(p.size)) purposesBySize.set(p.size, new Set());
      purposesBySize.get(p.size)!.add(p.purpose);
    }
    // At least one size class carries more than one purpose — otherwise size IS
    // purpose and the model has collapsed to one axis.
    expect([...purposesBySize.values()].some((s) => s.size > 1)).toBe(true);
  });

  it("stores no fourth axis, and no reading dressed as one", () => {
    // [HC-55]: "outpost" is a reading, not a class. So it had better not be a
    // field, and neither should a failure state ([HC-66]) or a garrison grade.
    const fields = Object.keys(PLACES[0]);
    for (const forbidden of ["outpost", "tier", "archetype", "garrison", "poor", "ruined", "abandoned"]) {
      expect(fields, `${forbidden} must not be stored`).not.toContain(forbidden);
    }
    // ...and it reads correctly when derived.
    for (const p of PLACES) {
      expect(isOutpost(p)).toBe(p.size === "settlement" && p.purpose === "military");
    }
  });

  it("orders the size class settlement below town below city", () => {
    // [HC-60] / [HC-61]: this is the SIZE ladder, and it is the one promotion
    // ever climbs. It shares no word with the garrison's hardness ladder.
    expect(SIZES.settlement.rank).toBeLessThan(SIZES.town.rank);
    expect(SIZES.town.rank).toBeLessThan(SIZES.city.rank);
    const city = PLACES.find((p) => p.size === "city")!;
    const settlement = PLACES.find((p) => p.size === "settlement")!;
    expect(sizeRank(city)).toBeGreaterThan(sizeRank(settlement));
  });

  it("lands a bigger party for a bigger class, and then stops having an opinion", () => {
    // WHAT THIS MEANS CHANGED WITH KAN-99, and the old wording — "class says how
    // big a place is ALLOWED to be on day 0" — is exactly what the warm start
    // retired. `SIZES.population` is now the FOUNDING PARTY: how many people a
    // crown's seat, a town or a fishing village landed with. Day 0 is eighty-odd
    // years later and the class has no say in it at all; `worldgen.test.ts`
    // holds the other end of that.
    for (const p of PLACES) {
      const def = SIZES[p.size];
      expect(p.population, p.name).toBeLessThanOrEqual(def.population[1]);
      expect(p.population, p.name).toBeGreaterThanOrEqual(def.population[0]);
    }
    expect(SIZES.settlement.population[1]).toBeLessThan(SIZES.town.population[1]);
    expect(SIZES.town.population[1]).toBeLessThan(SIZES.city.population[1]);
  });
});

describe("who holds what", () => {
  it("gives every place exactly one faction, and every faction is on the cast list", () => {
    for (const p of PLACES) {
      expect(p.faction).toBeGreaterThanOrEqual(0);
      expect(p.faction).toBeLessThan(WORLD.nations.length);
      expect(FACTIONS[nationOf(p).faction]).toBeDefined();
    }
  });

  it("leaves the crowns holding most of the sea and the neutrals a corner of it", () => {
    // [HC-51]: the neutral set is fixed at generation and can only shrink. It is
    // a minority at the start or it has nowhere to shrink from.
    expect(neutrals.length).toBeGreaterThan(0);
    expect(neutrals.length).toBeLessThan(crowns.length);
  });

  it("gives no crown its capital and nothing else", () => {
    // Not a tuning claim — a playability one. §8's wars, taxes and dispatches
    // all need a crown to have somewhere to send them, and strict nearest-seat
    // assignment measurably produced a crown holding one port.
    for (const crown of CROWN_IDS) {
      const nation = WORLD.nations[FACTION_IDS.indexOf(crown)];
      expect(holdingsOf(PLACES, nation.id).length, `${crown} holds only its seat`).toBeGreaterThan(1);
    }
  });

  it("stores no holdings list anywhere, because holdings are a query", () => {
    // [HC-39]: a nation stores a treasury, its relations and its seat. Its
    // territory is derived from the places, never duplicated.
    for (const n of WORLD.nations) {
      expect(Object.keys(n).sort()).toEqual(["crown", "faction", "id", "seat", "treasury"]);
    }
  });

  it("leaves a neutral faction with no treasury and no seat to dispatch from", () => {
    // [HC-51]: no treasury, no navy, no charters, no invasions, no expansion.
    for (const n of WORLD.nations.filter((x) => !x.crown)) {
      expect(n.treasury, n.faction).toBe(0);
      expect(n.seat, n.faction).toBe(-1);
    }
  });
});

describe("what the places are called", () => {
  it("gives every place a name of its own", () => {
    const names = PLACES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n.trim().length).toBeGreaterThan(2);
  });

  it("names a place out of its holder's own pool, so a Dutch port sounds Dutch", () => {
    for (const p of PLACES) {
      const pool = NAME_POOLS[FACTIONS[nationOf(p).faction].pool];
      const fromPool = pool.roots.some((root) => p.name.includes(root));
      expect(fromPool, `${p.name} is not out of its own pool`).toBe(true);
    }
  });

  it("puts somebody in charge, out of the same pool", () => {
    for (const p of PLACES) {
      const pool = NAME_POOLS[FACTIONS[nationOf(p).faction].pool];
      expect(pool.family.some((f) => p.governor.includes(f)), `${p.governor} of ${p.name}`).toBe(true);
    }
  });
});

describe("a place's own stream", () => {
  it("derives every place's seed from the world's, so no two are hand-picked alike", () => {
    // §10.4 and [HC-10]. Before this, `town.seed` was a number typed into the
    // harness and two towns could be founded on the same one.
    const seeds = PLACES.map((p) => p.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("changes every place's stream when the world's seed changes", () => {
    const other = generateWorld(SEED + 1);
    expect(other.places[0].seed).not.toBe(PLACES[0].seed);
  });
});

describe("the true coastal bearing", () => {
  it("gives every place a unit bearing, and does not point them all the same way", () => {
    // [HC-73]: the world holds the truth. If every place faced the same way the
    // rotation into a town-local frame would be doing nothing, and the shipped
    // sea-lies-south assumption would still be a geographic claim.
    for (const p of PLACES) {
      expect(p.sx * p.sx + p.sy * p.sy, p.name).toBeCloseTo(1, 9);
    }
    const north = PLACES.filter((p) => p.sy < -0.4).length;
    const south = PLACES.filter((p) => p.sy > 0.4).length;
    expect(north).toBeGreaterThan(0);
    expect(south).toBeGreaterThan(0);
  });

  it("puts each place in the zone its own position falls in", () => {
    const zones = makeZones(SEED);
    for (const p of PLACES) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < zones.length; i++) {
        const d = distanceNm(p.x, p.y, zones[i].x, zones[i].y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      expect(p.zone, p.name).toBe(best);
    }
  });
});

describe("generating the places at all", () => {
  it("seats the crowns without a nation carrying a place of its own", () => {
    // The generator writes seats onto the nations, which is the only place the
    // two structs touch. Asking twice must not seat anybody twice.
    const nations = makeNations();
    const shape = makeShape(SEED);
    const zones = makeZones(SEED);
    const once = makePlaces(SEED, shape, zones, nations).places;
    const twice = makePlaces(SEED, shape, zones, makeNations()).places;
    expect(twice).toEqual(once);
  });
});
