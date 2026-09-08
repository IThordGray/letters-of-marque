// Behaviour tests for the governor's plan (KAN-71).
// House style: names are design claims; assert directions, not tuned constants.

import { describe, it, expect } from "vitest";
import { makeTown, derive } from "./sim";
import { raise, CATALOGUE } from "./works";
import { wants, scoreWork, reasonFrom, governorTurn, stepTownYears } from "./governor";
import { PLAN } from "./constants";
import type { ParcelTerrain, Town, Bearing, Archetype } from "./types";

const RING: Bearing[] = ["N", "NE", "E", "W", "NW", "S", "SE", "SW"];

function townOn(terrains: ParcelTerrain[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    population: 300,
    parcels: terrains.map((terrain, i) => ({ terrain, quality: "fair" as const, bearing: RING[i] })),
    ...init,
  });
}

const weightOf = (t: Town, kind: Parameters<typeof scoreWork>[1], key: string) =>
  scoreWork(t, kind).find((x) => x.key === key)?.weight ?? 0;

describe("the explanation IS the score", () => {
  it("gives every want a reason in plain language", () => {
    const t = townOn(["timberedHills", "caneFlats", "bluff"]);
    const list = wants(t);
    expect(list.length).toBeGreaterThan(0);
    for (const w of list) {
      expect(w.reason.length).toBeGreaterThan(0);
      expect(w.reason).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("builds the reason from the two strongest terms, in their own words", () => {
    const t = townOn(["timberedHills"]);
    const terms = scoreWork(t, "sawpit");
    expect(terms.length).toBeGreaterThanOrEqual(2);
    expect(reasonFrom(terms)).toBe(`${terms[0].clause} and ${terms[1].clause}`);
  });

  it("orders the terms strongest first, so the sentence names what actually decided it", () => {
    const terms = scoreWork(townOn(["timberedHills"]), "sawpit");
    for (let i = 1; i < terms.length; i++) expect(terms[i - 1].weight).toBeGreaterThanOrEqual(terms[i].weight);
  });

  it("never offers a term it cannot write a clause for", () => {
    const t = townOn(["timberedHills", "caneFlats", "roadstead", "bluff", "provisionGrounds", "reef"]);
    for (const w of wants(t, 99)) for (const term of w.terms) expect(term.clause.trim().length).toBeGreaterThan(0);
  });
});

describe("wealth is the budget gate, not a scoring term", () => {
  it("does not change what a town wants when its coffers change", () => {
    const poor = townOn(["timberedHills"], { wealth: 0 });
    const rich = townOn(["timberedHills"], { wealth: 100000 });
    expect(wants(poor).map((w) => w.kind)).toEqual(wants(rich).map((w) => w.kind));
  });

  it("changes only whether he can start it today", () => {
    const poor = townOn(["timberedHills"], { wealth: 0 });
    const rich = townOn(["timberedHills"], { wealth: 100000 });
    expect(wants(poor)[0].affordable).toBe(false);
    expect(wants(rich)[0].affordable).toBe(true);
  });
});

describe("the five terms each argue for something", () => {
  it("the land argues loudest where the land is best", () => {
    const mk = (quality: "poor" | "rich") =>
      makeTown({ name: "T", seed: 1, population: 300, parcels: [{ terrain: "timberedHills", quality, bearing: "N" }] });
    expect(weightOf(mk("rich"), "sawpit", "land")).toBeGreaterThan(weightOf(mk("poor"), "sawpit", "land"));
  });

  it("an unmet want argues for the work that answers it", () => {
    const thirsty = townOn([], { population: 3000 });
    const served = townOn([], { population: 3000 });
    raise(served, "tavern", 1640);
    raise(served, "tavern", 1640);
    expect(weightOf(thirsty, "tavern", "need")).toBeGreaterThan(weightOf(served, "tavern", "need"));
  });

  it("a downstream work waiting on a supplier argues for the supplier", () => {
    const withShipyard = townOn(["timberedHills", "roadstead"]); // shipways could follow
    const noHarbour = townOn(["timberedHills"]); // nothing wants the planks
    expect(weightOf(withShipyard, "sawpit", "market")).toBeGreaterThan(weightOf(noHarbour, "sawpit", "market"));
  });

  it("fear argues for guns, and argues twice as hard after a burning", () => {
    const calm = townOn(["bluff"]);
    const burned = townOn(["bluff"]);
    burned.lastThreat = burned.season;
    expect(weightOf(burned, "battery", "fear")).toBeGreaterThan(weightOf(calm, "battery", "fear"));
  });

  it("says out loud that the town was lately burned", () => {
    const t = townOn(["bluff"]);
    t.lastThreat = t.season;
    expect(scoreWork(t, "battery").find((x) => x.key === "fear")!.clause).toContain("burning");
  });

  it("lets the patron's agenda differ by who is paying", () => {
    const colony = townOn(["bluff"], { archetype: "colony" });
    const outpost = townOn(["bluff"], { archetype: "royalOutpost" });
    expect(weightOf(outpost, "battery", "agenda")).toBeGreaterThan(weightOf(colony, "battery", "agenda"));
  });
});

describe("what he can actually start", () => {
  it("knows when a work is beyond the hands the town has", () => {
    const t = townOn(["timberedHills"], { population: 12, wealth: 100000 });
    expect(wants(t, 99).find((w) => w.kind === "sawpit")!.manned).toBe(false);
  });

  it("waits rather than raising a shed that would only rot — money and no men", () => {
    const t = townOn(["timberedHills"], { population: 12, wealth: 100000 });
    for (const k of ["barracks", "palisade", "tavern", "church"] as const) raise(t, k, 1640);
    expect(derive(t).hands.needed).toBeGreaterThan(derive(t).hands.available);
    expect(governorTurn(t, 1640)).toBeNull();
  });

  it("holds out for the better thing rather than buying the cheapest to hand", () => {
    // He wants a battery (expensive, and the town lies open) far more than a
    // tavern, so with only tavern money he waits.
    const t = townOn(["bluff"], { archetype: "royalOutpost", population: 300, wealth: CATALOGUE.tavern.cost });
    const list = wants(t, 99);
    const battery = list.find((w) => w.kind === "battery")!;
    const tavern = list.find((w) => w.kind === "tavern")!;
    expect(battery.score).toBeGreaterThan(tavern.score / PLAN.settleFor);
    expect(governorTurn(t, 1640)).toBeNull();
  });

  it("but takes the lesser thing when it is nearly as good", () => {
    const t = townOn(["bluff"], { archetype: "royalOutpost", population: 300, wealth: 100000 });
    expect(governorTurn(t, 1640)).not.toBeNull();
  });

  it("spends the coin when he builds", () => {
    const t = townOn(["timberedHills"], { wealth: 100000 });
    const before = t.wealth;
    const built = governorTurn(t, 1640)!;
    expect(t.wealth).toBe(before - built.want.cost);
  });
});

describe("the wants-list is published, not hidden", () => {
  it("shows three deep by default", () => {
    const t = townOn(["timberedHills", "caneFlats", "roadstead", "bluff"]);
    expect(wants(t).length).toBe(3);
  });

  it("only ever offers works the land and the suppliers allow", () => {
    const t = townOn(["roadstead"]); // no timber, so no shipways yet
    expect(wants(t, 99).map((w) => w.kind)).not.toContain("shipway");
    expect(wants(t, 99).map((w) => w.kind)).not.toContain("sawpit");
  });
});

describe("a town becomes what its patron wants of it", () => {
  const land: ParcelTerrain[] = ["timberedHills", "caneFlats", "roadstead", "bluff", "provisionGrounds"];
  const run = (archetype: Archetype) => {
    const t = townOn(land, { archetype, grant: 20, population: 200 });
    stepTownYears(t, 60);
    return t;
  };

  it("grows into a different place under a crown than under a company", () => {
    const colony = run("colony");
    const outpost = run("royalOutpost");
    const kinds = (t: Town) => t.works.filter((w) => CATALOGUE[w.kind].cls === "capital").map((w) => w.kind).sort();
    expect(kinds(colony)).not.toEqual(kinds(outpost));
  });

  it("leaves a colony softer than a presidio — revenue first, defence last", () => {
    expect(derive(run("colony")).security).toBeLessThan(derive(run("royalOutpost")).security);
  });

  it("actually develops over decades rather than settling into nothing", () => {
    const t = townOn(land, { archetype: "colony", grant: 20, population: 200 });
    const built = stepTownYears(t, 60);
    expect(built.length).toBeGreaterThan(2);
    expect(t.works.filter((w) => CATALOGUE[w.kind].cls === "capital").length).toBeGreaterThan(2);
  });
});
