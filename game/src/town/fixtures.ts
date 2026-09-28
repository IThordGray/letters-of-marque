// Test fixtures for the town module. NOT imported by the app — test-only.
//
// THE FIXTURE RULE (ratified 2026-09-10, see implementation/testing.md):
// build towns by hand, never through `foundTown()` / `rollLand()`. The land
// generator is being replaced by the world's cut ([HC-19], [HC-73]), so a fixture
// that went through it would inherit an expiry date. A fixture built against the
// struct does not — which is what buys the whole suite immunity from that rework.
//
// Generalised: pin behaviour against the struct, never against a producer that is
// scheduled to move.

import type { Town, Region, RegionFocus, TerrainKind, Produce, Suit } from "./types";
import type { Axial } from "./hex";
import { CENTRE, innerRing, ring } from "./hex";
import { makeTown } from "./sim";

export interface RegionOpts {
  bears?: Partial<Record<Produce, Suit>>;
  reach?: "atHand" | "far";
  sweetSpot?: Axial | null;
  focus?: RegionFocus;
}

export function reg(id: number, terrain: TerrainKind, hexes: Axial[], opts: RegionOpts = {}): Region {
  return {
    id,
    terrain,
    hexes,
    bears: opts.bears ?? {},
    sweetSpot: opts.sweetSpot ?? null,
    reach: opts.reach ?? "atHand",
    bearing: "N",
    // Unfocused by default, because that is what most ground is and a fixture
    // should look like the world rather than like the case under test.
    focus: opts.focus ?? null,
  };
}

// A town on hand-drawn ground. `land` is derived from the regions plus the centre,
// which is the one hex the footprint starts on.
export function townOf(regions: Region[], init: Partial<Town> = {}): Town {
  return makeTown({
    name: "Test",
    seed: 1,
    land: [CENTRE, ...regions.flatMap((r) => r.hexes)],
    water: [],
    regions,
    ...init,
  });
}

// The six hexes around the centre, clockwise, and the twelve beyond them.
export const RING1 = innerRing();
export const RING2 = ring(2);

// A mixed-ground town with somewhere to grow everything the catalogue offers:
// food and grain, timber, cane, a roadstead for waterfront works, a bluff for a
// battery, a reef for fish, and scrub to sprawl over.
export function mixedTown(init: Partial<Town> = {}): Town {
  return townOf(
    [
      reg(0, "tilledGround", RING1.slice(0, 2), { bears: { food: "ideal", grain: "fair" } }),
      reg(1, "timberedHills", RING1.slice(2, 4), { bears: { timber: "ideal" } }),
      reg(2, "caneFlats", RING1.slice(4, 6), { bears: { sugar: "ideal" } }),
      reg(3, "scrub", RING2.slice(0, 4)),
      reg(4, "roadstead", RING2.slice(4, 7), { bears: { fish: "fair" } }),
      reg(5, "bluff", RING2.slice(7, 9)),
      reg(6, "reef", RING2.slice(9, 12), { bears: { fish: "ideal" } }),
    ],
    init,
  );
}

// The barest viable place: ground that feeds itself and nothing else. Used for the
// hamlet floor, where the claim is about what appears without anyone paying.
export function bareTown(init: Partial<Town> = {}): Town {
  return townOf([reg(0, "tilledGround", RING1, { bears: { food: "ideal" } })], init);
}

// A place that CANNOT feed itself: timber to sell, a roadstead to sell it over,
// and not one acre that will bear food or one fathom that will bear fish. Its
// bread comes off a ship or it does not come — which is the whole subject of the
// trading engine, and impossible to state with ground that feeds itself.
export function seaTown(init: Partial<Town> = {}): Town {
  return townOf(
    [
      reg(0, "timberedHills", RING1.slice(0, 3), { bears: { timber: "ideal" } }),
      reg(1, "roadstead", RING1.slice(3, 6)),
      reg(2, "scrub", RING2.slice(0, 6)),
    ],
    init,
  );
}

// Two towns that differ in exactly one respect — the shape most of these claims
// need, because the house rule is to assert relationships, never constants.
export function pair<T extends Partial<Town>>(build: (init: Partial<Town>) => Town, a: T, b: T): [Town, Town] {
  return [build(a), build(b)];
}
