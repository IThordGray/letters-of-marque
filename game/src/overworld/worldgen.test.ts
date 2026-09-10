// The generator, end to end — and the cheapest test of the whole thing.
//
// [HC-22] says it in as many words: "the cheapest test of the whole generator is
// run the fresh world for twenty years and check nothing falls over." That test
// is at the bottom of this file and it is the one that matters. Everything above
// it is the contract §6's table sets out.

import { describe, it, expect } from "vitest";
import { DAYS_PER_YEAR, yearOf } from "./clock";
import { inFlightCount } from "./dispatch";
import { describeWorld, foundAll, foundPlace, generateWorld } from "./worldgen";
import { FACTIONS } from "./factions";
import { SIZES } from "./places";
import { derive, stepSeason } from "../town/sim";
import { SEASONS_PER_YEAR, POP } from "../town/constants";

const SEED = 1660;
const WORLD = generateWorld(SEED);

describe("one seed, one world", () => {
  it("generates the same world twice over, down to the last hex of ground", () => {
    // [HC-11]. Not "the same starting state" — the same world, so the same two
    // hundred years follow from it.
    expect(generateWorld(SEED)).toEqual(WORLD);
  });

  it("generates a different world from a different number, and from nothing else", () => {
    const other = generateWorld(SEED + 1);
    expect(other.places.map((p) => p.name)).not.toEqual(WORLD.places.map((p) => p.name));
    expect(other.shape.lobes).not.toEqual(WORLD.shape.lobes);
  });

  it("generates a world and then stops", () => {
    // The ticket's own scope guard: no tick loop. The clock is at day zero and
    // the generator never touched it.
    expect(WORLD.day).toBe(0);
    expect(yearOf(WORLD)).toBe(1660);
  });

  it("writes everything §6 says it writes, and nothing it says it does not", () => {
    expect(WORLD.shape.lobes.length).toBeGreaterThan(0); // landmasses and coastlines
    expect(WORLD.zones.length).toBeGreaterThan(0); // climate zones
    expect(WORLD.places.length).toBeGreaterThan(0); // the ~50 positions
    expect(WORLD.nations.length).toBe(Object.keys(FACTIONS).length); // who holds what
    // ...and no heightmap, no tile grid, no stored weather, no place's land.
    // `dispatches` joined the list on KAN-105 and is the exception that proves
    // the rule: the four war-currencies are the sole carve-out from "the flow is
    // the truth" ([HC-13]), and they are cheap to store only because a passage is
    // a departure and an arrival rather than a position ([P-16]). The generator
    // still writes none — a fresh world sails nothing.
    expect(Object.keys(WORLD).sort())
      .toEqual(["day", "dispatches", "nations", "places", "seed", "shape", "zones"]);
    expect(inFlightCount(WORLD)).toBe(0);
  });

  it("can say what it made, in one sentence", () => {
    // [HC-16]'s discipline turned on the generator itself. A world that cannot
    // be described is one nobody can check.
    const said = describeWorld(WORLD);
    expect(said).toContain(String(WORLD.places.length));
    expect(said).toContain(String(WORLD.zones.length));
    expect(said).toContain("1660");
  });
});

describe("founding a place on what the world gave it", () => {
  it("hands a town its ground rather than letting it invent one", () => {
    const town = foundPlace(WORLD, WORLD.places[0]);
    expect(town.regions.length).toBeGreaterThan(0);
    expect(town.land.length).toBeGreaterThan(0);
    expect(town.name).toBe(WORLD.places[0].name);
  });

  it("takes a town's own seed from the world, so no two are hand-picked alike", () => {
    // §10.4, and the last hand-picked number in the harness.
    const towns = WORLD.places.slice(0, 12).map((p) => foundPlace(WORLD, p));
    const seeds = towns.map((t) => t.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    for (let i = 0; i < towns.length; i++) expect(towns[i].seed).toBe(WORLD.places[i].seed);
  });

  it("leaves a neutral place without a patron, and therefore without a safety net", () => {
    // [HC-52]: a neutral place runs the full ledger with no grant behind it. It
    // lives on exactly what comes over its beach.
    const neutral = WORLD.places.find((p) => !WORLD.nations[p.faction].crown);
    expect(neutral, "this world has no neutral place at all").toBeDefined();
    const town = foundPlace(WORLD, neutral!);
    expect(town.grant).toBe(0);
    expect(town.patron.kind).toBe("none");
  });

  it("puts a crown behind a crown's place", () => {
    const held = WORLD.places.find((p) => WORLD.nations[p.faction].crown)!;
    const town = foundPlace(WORLD, held);
    expect(town.patron.kind).toBe("crown");
    expect(town.patron.name).toBe(FACTIONS[WORLD.nations[held.faction].faction].name);
  });

  it("founds every place at a population its own ground can feed", () => {
    // [HC-22] as a founding rule rather than as a hope. The class says how big a
    // place may be; the ground says how big it can be; the smaller wins.
    for (const p of WORLD.places) {
      const town = foundPlace(WORLD, p);
      const d = derive(town);
      expect(town.population, `${p.name} was founded hungry`).toBeLessThanOrEqual(d.food + 0.5);
      expect(town.population, `${p.name} was founded empty`).toBeGreaterThanOrEqual(POP.floor);
      expect(town.population, `${p.name} exceeds its class`).toBeLessThanOrEqual(SIZES[p.size].population[1] + 0.001);
    }
  });

  it("leaves a warm start standing, not bare ground with people on it", () => {
    // Every place already has the works its people raised for themselves — which
    // is what makes day 0 a moment in a history rather than the beginning of one.
    for (const p of WORLD.places.slice(0, 20)) {
      const town = foundPlace(WORLD, p);
      expect(town.works.length, `${p.name} has no works at all`).toBeGreaterThan(0);
      expect(town.works.every((w) => w.condition !== "ruin")).toBe(true);
    }
  });
});

describe("the cheapest test of the whole generator", () => {
  // [HC-22], verbatim: "run the fresh world for twenty years and check nothing
  // falls over." No weather, no nations, no trade — none of those exist yet — so
  // anything that goes wrong here was put there by the generator.
  const YEARS = 20;
  const towns = foundAll(WORLD);
  const opening = towns.map((t) => t.population);
  for (const t of towns) {
    for (let i = 0; i < YEARS * SEASONS_PER_YEAR; i++) stepSeason(t);
  }

  it("leaves no place on the hamlet floor after twenty years", () => {
    for (let i = 0; i < towns.length; i++) {
      expect(towns[i].population, `${towns[i].name} collapsed`).toBeGreaterThan(POP.floor);
    }
  });

  it("leaves no place smaller than the generator wrote it", () => {
    // The sharp form of [HC-22]: a warm start the ordinary rules could not have
    // produced shows up as a place that immediately shrinks. Measured before the
    // founding rule above existed: a designated city of 144 fell to 108.
    for (let i = 0; i < towns.length; i++) {
      expect(towns[i].population, `${towns[i].name} shrank from its opening`).toBeGreaterThanOrEqual(opening[i] * 0.95);
    }
  });

  it("leaves every place feeding itself", () => {
    for (const t of towns) {
      const d = derive(t);
      expect(d.food, `${t.name} cannot feed its own mouths`).toBeGreaterThanOrEqual(d.mouths * 0.95);
    }
  });

  it("lets most of them grow, so the world is not merely surviving", () => {
    const grew = towns.filter((t, i) => t.population > opening[i] * 1.05).length;
    expect(grew).toBeGreaterThan(towns.length * 0.5);
  });

  it("does not grow them all to the same size, because their ground is not the same", () => {
    // If the generator's ground made no difference, twenty years would flatten
    // every place onto one number and the whole cut would be decoration.
    const sizes = towns.map((t) => t.population).sort((a, b) => a - b);
    expect(sizes[sizes.length - 1]).toBeGreaterThan(sizes[0] * 2);
  });

  it("runs the same twenty years twice over", () => {
    // [HC-11]: reproducible means the whole history, not the starting state.
    const again = foundAll(generateWorld(SEED));
    for (const t of again) {
      for (let i = 0; i < YEARS * SEASONS_PER_YEAR; i++) stepSeason(t);
    }
    expect(again.map((t) => t.population)).toEqual(towns.map((t) => t.population));
    expect(again.map((t) => t.works.length)).toEqual(towns.map((t) => t.works.length));
  });

  it("counts twenty years the same way the world's calendar does", () => {
    expect(YEARS * SEASONS_PER_YEAR).toBe((YEARS * DAYS_PER_YEAR) / 90);
  });
});
