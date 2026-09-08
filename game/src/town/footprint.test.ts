// Behaviour tests for the town's built-up ground (KAN-82).
// House style: names are design claims; assert directions, not tuned constants.

import { describe, it, expect } from "vitest";
import { makeTown, derive } from "./sim";
import { raise, roomFor } from "./works";
import { stepTownYears } from "./governor";
import { stepFootprint, crowding, room, inTownWorks, enclosedBearings, makeFootprint, isAbsorbed } from "./footprint";
import type { ParcelTerrain, Town, Bearing, Archetype } from "./types";

const RING: Bearing[] = ["N", "NE", "SE", "S", "SW", "NW"];

function townOn(terrains: ParcelTerrain[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    population: 400,
    parcels: terrains.map((terrain, i) => ({ terrain, quality: "fair" as const, bearing: RING[i] })),
    ...init,
  });
}
// Crowd a town by giving it more in-town works than its core has room for.
function crowd(t: Town, n = 12) {
  for (let i = 0; i < n; i++) raise(t, "dwellings", 1640);
  return t;
}
const quarters = (t: Town) => RING.filter((b) => t.footprint.spill[b] > 0);

describe("a town begins on its own ground", () => {
  it("starts scattered, with nothing spread anywhere", () => {
    const f = makeFootprint();
    expect(f.core).toBe(0);
    expect(RING.every((b) => f.spill[b] === 0)).toBe(true);
  });

  it("does not grow while it still has room", () => {
    const t = townOn(["scrub"]);
    expect(crowding(t)).toBeLessThan(1);
    expect(stepFootprint(t)).toBeNull();
  });
});

describe("it builds inwards before it builds outwards", () => {
  it("packs closer first, before taking any new ground", () => {
    const t = crowd(townOn(["scrub"]));
    const grew = stepFootprint(t)!;
    expect(grew.kind).toBe("densified");
    expect(quarters(t)).toEqual([]);
  });

  it("only spreads once building closer is no longer free", () => {
    const t = crowd(townOn(["scrub"]), 20);
    for (let i = 0; i < 12; i++) stepFootprint(t);
    expect(t.footprint.core).toBeGreaterThan(0);
    expect(quarters(t).length).toBeGreaterThan(0);
  });

  it("makes room when it grows, either way", () => {
    const t = crowd(townOn(["scrub"]), 20);
    const before = room(t);
    stepFootprint(t);
    expect(room(t)).toBeGreaterThan(before);
  });
});

describe("it takes the worthless ground first", () => {
  it("builds over dry scrub before it touches its own fields", () => {
    const t = crowd(townOn(["provisionGrounds", "scrub"]), 20);
    const scrubBearing = t.parcels.find((p) => p.terrain === "scrub")!.bearing;
    const fieldBearing = t.parcels.find((p) => p.terrain === "provisionGrounds")!.bearing;
    // Step only until the town first takes ground: the claim is about ORDER, and
    // given long enough it will eventually eat the fields too.
    let grew = stepFootprint(t);
    while (grew && grew.kind === "densified") grew = stepFootprint(t);
    expect(grew!.bearing).toBe(scrubBearing);
    expect(t.footprint.spill[fieldBearing]).toBe(0);
  });

  it("never builds on mangrove or open water", () => {
    const t = crowd(townOn(["marsh", "openSea"]), 30);
    for (let i = 0; i < 30; i++) stepFootprint(t);
    for (const p of t.parcels) expect(t.footprint.spill[p.bearing]).toBe(0);
  });

  it("says there is nowhere to go when the ground refuses it", () => {
    const t = crowd(townOn(["marsh", "openSea"]), 30);
    let last = null;
    for (let i = 0; i < 30; i++) last = stepFootprint(t);
    expect(last!.kind).toBe("stalled");
    expect(last!.sentence).toContain("nowhere");
  });

  it("grows a lobe rather than a ring — it extends a quarter before opening a new one", () => {
    const t = crowd(townOn(["scrub", "scrub", "scrub"]), 24);
    for (let i = 0; i < 10; i++) stepFootprint(t);
    const levels = quarters(t).map((b) => t.footprint.spill[b]).sort((a, b) => b - a);
    if (levels.length > 1) expect(levels[0]).toBeGreaterThan(levels[levels.length - 1]);
  });
});

describe("growth eats its own cause", () => {
  it("takes ground entirely if it grows long enough", () => {
    const t = crowd(townOn(["scrub"]), 40);
    for (let i = 0; i < 40; i++) stepFootprint(t);
    expect(isAbsorbed(t, t.parcels[0].bearing)).toBe(true);
  });

  it("stops a built-over parcel carrying any more works", () => {
    const t = townOn(["timberedHills"]);
    expect(roomFor(t, "sawpit")).toBe(1);
    t.footprint.spill[t.parcels[0].bearing] = 3;
    expect(roomFor(t, "sawpit")).toBe(0);
  });

  it("idles the works already standing on ground the town built over", () => {
    const t = townOn(["timberedHills"], { population: 400 });
    raise(t, "sawpit", 1640);
    stepTownYears(t, 1);
    expect(derive(t).trade).toBeGreaterThan(0);
    t.footprint.spill[t.parcels[0].bearing] = 3;
    stepTownYears(t, 1);
    expect(t.works.find((w) => w.kind === "sawpit")!.condition).not.toBe("working");
  });
});

describe("the wall shapes growth rather than stopping it", () => {
  it("encloses the landward side and leaves the sea open — an unfinished circuit is normal", () => {
    const t = townOn(["scrub"]);
    raise(t, "palisade", 1640);
    const enclosed = enclosedBearings(t);
    expect(enclosed.size).toBeGreaterThan(0);
    expect([...enclosed].every((b) => b === "N" || b === "NE" || b === "NW")).toBe(true);
    expect(enclosed.has("S")).toBe(false);
  });

  it("puts houses outside the gate when the only ground left is walled", () => {
    // scrub lies landward, so once the palisade is up any spread is a faubourg.
    const t = makeTown({
      name: "T", seed: 1, population: 400,
      parcels: [{ terrain: "scrub", quality: "poor", bearing: "N" }],
    });
    raise(t, "palisade", 1640);
    crowd(t, 24);
    let faubourg = false;
    for (let i = 0; i < 20; i++) if (stepFootprint(t)?.kind === "faubourg") faubourg = true;
    expect(faubourg).toBe(true);
  });
});

describe("a century tells three different stories", () => {
  const run = (archetype: Archetype, grant: number) => {
    const t = townOn(["scrub", "provisionGrounds", "timberedHills", "bluff"], {
      archetype, grant, population: 200,
    });
    stepTownYears(t, 100);
    return t;
  };

  it("leaves a presidio the same shape it started — its boundary is the stipend, not the wall", () => {
    expect(quarters(run("royalOutpost", 40))).toEqual([]);
  });

  it("...and packs it tighter instead", () => {
    expect(run("royalOutpost", 40).footprint.core).toBeGreaterThan(1);
  });

  it("lets a colony spread onto ground a presidio never touches", () => {
    expect(quarters(run("colony", 14)).length).toBeGreaterThan(quarters(run("royalOutpost", 40)).length);
  });

  it("never lets the footprint retreat, however the town fares", () => {
    const t = run("colony", 14);
    const before = quarters(t).length;
    t.population = 12; // the town collapses
    stepTownYears(t, 20);
    expect(quarters(t).length).toBeGreaterThanOrEqual(before);
  });
});

describe("the footprint is the town, not the land", () => {
  it("never alters a parcel", () => {
    const t = crowd(townOn(["scrub", "caneFlats"]), 30);
    const before = JSON.stringify(t.parcels);
    for (let i = 0; i < 30; i++) stepFootprint(t);
    expect(JSON.stringify(t.parcels)).toBe(before);
  });

  it("counts only what stands inside the town as pressure", () => {
    const t = townOn(["timberedHills"]);
    const before = inTownWorks(t);
    raise(t, "sawpit", 1640); // beyondThePale — out among the trees
    expect(inTownWorks(t)).toBe(before);
  });
});
