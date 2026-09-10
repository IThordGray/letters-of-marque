// The grade the ledger derives — how hard a raider's target is, on the ladder
// `picket · garrison · fortress` ([HC-60], KAN-104).
//
// WHY THIS FILE EXISTS. `tierOf` was on the suite's deliberately-absent list, so the
// rename from `outpost | town | capital` had no net under it at all. These claims are that
// net, and they are written against what the spec ratifies rather than against the
// arithmetic: town-economy.md §1 ("the grade comes from population + security + patron")
// and [HC-59] ("the garrison is derived, never stored" — from population, size and purpose
// together, which is what lets a small hard place outfight a big soft one).
//
// [HC-59]'s full population × size × purpose model is NOT built yet — size class and
// purpose do not exist as fields. Nothing here anticipates them.

import { describe, it, expect } from "vitest";
import { derive, makeTown } from "./sim";
import { raise } from "./works";
import { mixedTown } from "./fixtures";
import type { Town, Derived } from "./types";
import type { GarrisonGrade } from "../types";

// Softest first — the ordering IS the claim, so grades are compared by position on it.
const LADDER: Derived["garrison"][] = ["picket", "garrison", "fortress"];
const rung = (t: Town): number => LADDER.indexOf(derive(t).garrison);

// Every gun a mixed-ground town's land will bear: two batteries on its bluff, a palisade
// round it, a barracks behind. Nothing else in the catalogue adds defence.
const armToTheTeeth = (t: Town): Town => {
  raise(t, "battery", 1650);
  raise(t, "battery", 1650);
  raise(t, "palisade", 1650);
  raise(t, "barracks", 1650);
  return t;
};

describe("the garrison grade", () => {
  it("is never stored, so it cannot drift from the guns that explain it", () => {
    // [HC-59], verbatim: the garrison is derived, never stored. A grade held on the
    // struct would be a value that could disagree with the works ledger under it.
    //
    // Guards the live name, not a dead one: this asserted `"tier"` until KAN-110
    // renamed the field, at which point it guarded a word that existed nowhere and
    // could never fail.
    const stored = Object.keys(makeTown({ name: "Test", seed: 1 }));
    expect(stored).not.toContain("garrison");
    expect(stored).not.toContain("tier");
    // ...and it really is on the derived side.
    expect(Object.keys(derive(mixedTown({ population: 300 })))).toContain("garrison");
  });

  it("does not make a fortress of a place just because it is full of guns", () => {
    // A heavily fortified presidio of ninety souls is a hard target — but it is still a
    // small place, and population is a real input to the garrison ([HC-59]).
    const presidio = armToTheTeeth(
      mixedTown({ population: 90, patron: { kind: "crown", name: "Spain", owns: true } }),
    );
    const bare = mixedTown({ population: 90 });

    expect(derive(presidio).security).toBeGreaterThan(derive(bare).security * 4); // it IS hard
    expect(derive(presidio).garrison).not.toBe("fortress"); // ...and still not a fortress
  });

  it("lets a hard little place outgrade a soft place twice its size", () => {
    // The pay-off [HC-54]/[HC-59] exist for: neither needs a special rule, and the small
    // place wins the comparison on guns alone.
    const presidio = armToTheTeeth(mixedTown({ population: 90 }));
    const sleepy = mixedTown({ population: 180 });

    expect(rung(presidio)).toBeGreaterThan(rung(sleepy));
  });

  it("weighs size as well as guns, so two of a kind are told apart by their people", () => {
    // The other half of the same rule: equally armed, the bigger place grades harder.
    // Without this the ladder would be a security readout wearing a second name.
    const small = armToTheTeeth(mixedTown({ population: 60 }));
    const large = armToTheTeeth(mixedTown({ population: 700 }));

    expect(rung(large)).toBeGreaterThan(rung(small));
  });

  it("never softens when a place raises another gun", () => {
    const town = mixedTown({ population: 300 });
    let before = rung(town);
    for (const kind of ["battery", "battery", "palisade", "barracks"] as const) {
      raise(town, kind, 1650);
      const after = rung(town);
      expect(after).toBeGreaterThanOrEqual(before);
      before = after;
    }
    expect(before).toBeGreaterThan(rung(mixedTown({ population: 300 }))); // and it did climb
  });

  it("never softens when a crown puts itself at a place's back", () => {
    const alone = armToTheTeeth(mixedTown({ population: 400 }));
    const backed = armToTheTeeth(
      mixedTown({ population: 400, patron: { kind: "crown", name: "Spain", owns: true } }),
    );

    expect(derive(backed).security).toBeGreaterThanOrEqual(derive(alone).security);
    expect(rung(backed)).toBeGreaterThanOrEqual(rung(alone));
  });

  it("grades a stripped, emptied place at the bottom of the ladder and not below it", () => {
    const ruined = mixedTown({ population: 1, wealth: 0 });
    expect(derive(ruined).garrison).toBe(LADDER[0]);
  });

  it("grades every place on this ladder and never on the size class", () => {
    // KAN-104's whole purpose. `settlement`/`town`/`city` belong to the size axis; if one
    // of them ever comes back out of here, the two axes have been welded together again.
    const spread = [
      mixedTown({ population: 1 }),
      mixedTown({ population: 300 }),
      armToTheTeeth(mixedTown({ population: 800 })),
    ];
    for (const t of spread) {
      expect(LADDER).toContain(derive(t).garrison);
      expect(["settlement", "city"]).not.toContain(derive(t).garrison);
    }
  });

  it("grades on the same three words the raid layer fights on", () => {
    // A compile-time claim as much as a runtime one: assigning each union to the other
    // fails `tsc` the moment either ladder drifts, which is how the three-way overlap
    // (world `settlement·town·city`, town `outpost·town·capital`, raid
    // `settlement·town·capital`) went unnoticed in the first place.
    const fromTheLedger: Derived["garrison"] = derive(mixedTown({ population: 300 })).garrison;
    const asTheRaidSeesIt: GarrisonGrade = fromTheLedger;
    const andBack: Derived["garrison"] = asTheRaidSeesIt;

    expect(andBack).toBe(fromTheLedger);
    expect(LADDER).toContain(asTheRaidSeesIt);
  });
});
