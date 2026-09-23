// The built-up ground — growth that eats its own cause, claiming that never
// retreats, and a wall frozen where it was raised.
//
// [HC-70] keeps the footprint out of the world layer's reach. The claims here are
// scoped to `nextHex` rather than `stepFootprint` where the spread TEMPERAMENT is
// involved: that gate reads `archetype`, which is retired as a taxonomy ([HC-55])
// and must not be pinned.

import { describe, it, expect } from "vitest";
import { nextHex, walledGround, isClaimed, describeFootprint } from "./footprint";
import { raise, roomInRegion, takenHexes } from "./works";
import { capacityOf } from "./land";
import { stepSeason, stepYears } from "./sim";
import { stepTownYears } from "./governor";
import { key } from "./hex";
import { mixedTown, townOf, reg, RING1, RING2 } from "./fixtures";
import { CALENDAR, DAYS_PER_YEAR } from "../overworld/calendar";

// The town keeps no clock (KAN-107): the world hands it the day, and here the
// test plays the world. These fixtures stand on the world's first day.
const DAY0 = 0;
const SEASON = CALENDAR.daysPerSeason;

describe("growth eats its own cause", () => {
  it("stops the ground producing the moment the town builds over it", () => {
    const town = mixedTown({ population: 500, wealth: 9000 });
    const pit = raise(town, "sawpit", DAY0)!;
    stepSeason(town, DAY0);
    expect(pit.condition).toBe("working");

    town.footprint.claimed.push({ ...pit.hex! }); // the town spreads over it
    stepSeason(town, DAY0 + SEASON);

    expect(pit.condition).toBe("idle"); // ground the town built over carries nothing
  });

  it("costs the region its capacity, and the town its room to grow", () => {
    // The ground is GIVEN OVER since KAN-124, and that is what makes the second
    // half sayable at all: a focus buys capacity ([HC-94]), so area is the cap
    // only where somebody bought it. On unfocused ground the answer would be a
    // token work either way and the claim would assert nothing.
    const town = townOf(
      [reg(0, "timberedHills", RING1, { bears: { timber: "ideal" }, focus: "production" })],
      { population: 500, wealth: 9000 },
    );
    const region = town.regions[0];
    const room = () => roomInRegion(town, region, 0, "sawpit", "deepen", takenHexes(town));
    const capacityBefore = capacityOf(town, region);
    const roomBefore = room();

    town.footprint.claimed.push({ ...region.hexes[0] });

    expect(capacityOf(town, region)).toBe(capacityBefore - 1);
    expect(room()).toBe(roomBefore - 1);
  });

  it("costs it that capacity for a work standing on it too, and for a hex only once", () => {
    // KAN-134. Capacity read the FOOTPRINT and nothing else, so a region could
    // report every hex free while something stood on every one of them — which
    // is not an edge case: [HC-98] raises subsistence works on any ground the
    // town holds, and seventeen regions across four warm worlds were given over
    // to production with no hex left to put a work on.
    //
    // THE GARDEN PLOT IS THE SUBJECT AND IT HAS TO BE. The works that filled
    // those regions in the shipped world are subsistence works — free,
    // self-raising, never chosen and deliberately absent from `depthOf` — so a
    // rule that counted only the works somebody decided on would leave the bug
    // exactly where it was and pass a claim written about a sawpit.
    const town = townOf(
      [reg(0, "tilledGround", RING1, { bears: { food: "ideal", timber: "fair" }, focus: "production" })],
      { population: 500, wealth: 9000 },
    );
    const region = town.regions[0];
    const before = capacityOf(town, region);

    const plot = raise(town, "gardenPlots", DAY0)!;
    expect(capacityOf(town, region), "a garden plot stands on ground").toBe(before - 1);

    raise(town, "sawpit", DAY0);
    expect(capacityOf(town, region), "and so does a sawpit").toBe(before - 2);

    // ONE HEX, COUNTED ONCE. The old arithmetic subtracted the footprint and the
    // works separately — the map summary still did — so a work on ground the
    // town had also built over was charged twice. Measured on four warm worlds
    // before the fix: two regions read a hex short for exactly this reason.
    town.footprint.claimed.push({ ...plot.hex! });
    expect(capacityOf(town, region), "a built-over work is one hex, not two").toBe(before - 2);
  });
});

describe("claimed ground is permanent", () => {
  it("never gives ground back, through growth or decline", () => {
    const town = mixedTown({ population: 400, wealth: 20000 });
    let high = town.footprint.claimed.length;

    for (let i = 0; i < 100; i++) {
      stepTownYears(town, 1, i * DAYS_PER_YEAR);
      expect(town.footprint.claimed.length).toBeGreaterThanOrEqual(high);
      high = town.footprint.claimed.length;
    }

    town.works = []; // ruin it utterly
    town.wealth = 0;
    stepYears(town, 50, 100 * DAYS_PER_YEAR);

    expect(town.footprint.claimed.length).toBeGreaterThanOrEqual(high);
  });

  it("claims a hex once, and only once", () => {
    const town = mixedTown({ population: 400, wealth: 20000 });
    stepTownYears(town, 80);
    const seen = town.footprint.claimed.map(key);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("which way a town grows", () => {
  it("builds over its worthless ground before its own living", () => {
    // Scoped to nextHex: the decision of WHERE, not the temperament of WHETHER.
    const town = townOf(
      [
        reg(0, "scrub", RING1.slice(0, 3)),
        reg(1, "caneFlats", RING1.slice(3, 6), { bears: { cane: "ideal" } }),
      ],
      { population: 300, wealth: 9000 },
    );

    const taken = nextHex(town, false)!;
    const region = town.regions.find((r) => r.hexes.some((h) => key(h) === key(taken)))!;
    expect(region.terrain).toBe("scrub");
  });

  it("never builds on water, and never on marsh", () => {
    const town = townOf(
      [
        reg(0, "marsh", RING1.slice(0, 3)),
        reg(1, "roadstead", RING1.slice(3, 6), { bears: { fish: "ideal" } }),
      ],
      { population: 300, wealth: 9000 },
    );
    expect(nextHex(town, false)).toBeNull(); // there is nowhere it may go
  });

  it("grows outward from itself rather than in patches", () => {
    // A hex must touch the town to be taken.
    const town = townOf([reg(0, "scrub", RING2)], { population: 300, wealth: 9000 });
    expect(nextHex(town, false)).toBeNull(); // ring 2 touches nothing claimed yet
  });
});

describe("the wall is frozen where it was raised", () => {
  it("never re-extends its circuit as the town grows", () => {
    const town = mixedTown({ population: 500, wealth: 20000 });
    const wall = raise(town, "palisade", DAY0)!;
    const circuitAtRaising = wall.circuit!.length;

    stepTownYears(town, 60);

    expect(wall.circuit!.length).toBe(circuitAtRaising);
  });

  it("leaves anything claimed afterwards outside the gate", () => {
    // THE GOVERNOR MAY HAVE RAISED IT HIMSELF in those ten years, and since
    // KAN-137 he usually does — the materials gate that used to hold half his
    // wants is gone. `max` is 1, so `raise` hands back null rather than a second
    // wall, and the fixture takes whichever one is standing.
    const town = mixedTown({ population: 500, wealth: 20000 });
    stepTownYears(town, 10);
    const wall = raise(town, "palisade", 10 * DAYS_PER_YEAR) ?? town.works.find((w) => w.kind === "palisade")!;
    expect(wall, "no wall stands and none could be raised").toBeDefined();
    const walled = walledGround(town);

    // Force the town onto ground it had not taken when the wall went up.
    const outside = town.land.find((h) => !isClaimed(town, h) && !walled.has(key(h)));
    if (!outside) return;
    town.footprint.claimed.push({ ...outside });

    expect(walledGround(town).has(key(outside))).toBe(false);
    expect(wall.circuit!.some((h) => key(h) === key(outside))).toBe(false);
    expect(describeFootprint(town)).toContain("outside the gate");
  });
});

describe("reproducibility", () => {
  it("claims the same ground from the same start and the same steps", () => {
    const a = mixedTown({ population: 400, wealth: 20000 });
    const b = mixedTown({ population: 400, wealth: 20000 });
    stepTownYears(a, 150);
    stepTownYears(b, 150);
    expect(b.footprint).toEqual(a.footprint);
  });
});

// A region GIVEN OVER TO GROWTH is built on first, whatever the ground is worth
// (KAN-122, spec §2.12.7). This is the one behaviour story 1 ships, and it had no
// claim at all before: `grantedToTown` — the haven-only list this replaces — was
// referenced in exactly two places, both production code, and asserted nowhere.
// That is why swapping it out moved none of the 645 tests, and why the swap is
// the right moment to write the claim that was missing.
describe("ground given over to growth", () => {
  // Scrub is FIRST in the spread order and cane flats are near LAST — a town eats
  // what it can afford to lose. So a fixture that offers both is one where the
  // wrong answer and the right answer are different hexes, which is the only kind
  // of fixture that can tell them apart.
  const bothGrounds = (focus: "growth" | null) =>
    townOf(
      [
        reg(0, "scrub", RING1.slice(0, 3)),
        reg(1, "caneFlats", RING1.slice(3, 6), { bears: { cane: "ideal" }, focus }),
      ],
      { population: 300, wealth: 3000 },
    );

  it("is taken before ground the town would rather lose", () => {
    const town = bothGrounds("growth");
    const next = nextHex(town, false)!;
    expect(next, "found nowhere to grow at all").toBeTruthy();

    const taken = town.regions.find((r) => r.hexes.some((h) => key(h) === key(next)))!;
    expect(taken.terrain).toBe("caneFlats"); // the cane goes, because the town chose it
  });

  it("and without the focus the town eats the scrub instead", () => {
    // The same fixture with the focus lifted. If this picked cane too, the claim
    // above would be passing on the spread order rather than on the focus.
    const town = bothGrounds(null);
    const next = nextHex(town, false)!;
    const taken = town.regions.find((r) => r.hexes.some((h) => key(h) === key(next)))!;
    expect(taken.terrain).toBe("scrub");
  });
});
