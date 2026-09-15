// What earns a line in the chronicle, claimed.
//
// [HC-0]  Done is "a century reads as plausible AND every change has a nameable
//         cause". The feed is the second half, and a filter that admitted
//         everything would fail it as surely as one that admitted nothing:
//         twenty thousand governor's sentences a century is noise, and noise
//         names nothing.
// [HC-16] Every decision publishes its reason in plain language.
//
// The claims are written so the filter's DEFINITION is what is pinned — what it
// admits and what it refuses — rather than the numbers behind any of it.

import { describe, expect, it } from "vitest";
import { makeStanding, notableCrown, notablePlace, type Notable, type Standing } from "./notable";

// A place going about its business: a town with a few works, one of them
// already at the bottom of the ladder, off-origin in every field so no two
// numbers can be confused for each other.
const steady = (): Standing => ({ size: 1, faction: 3, ruined: 2, hale: 9, people: 137 });

const after = (was: Standing, change: Partial<Standing>): Standing => ({ ...was, ...change });

const run = (was: Standing, now: Standing, byWeather: boolean): Notable[] => {
  const out: Notable[] = [];
  notablePlace(4211, 7, was, now, byWeather, out);
  return out;
};

describe("the sea taking a work is news", () => {
  it("reports a work lost on the day it was lost", () => {
    const was = steady();
    const out = run(was, after(was, { ruined: 3, hale: 8 }), true);
    expect(out.map((e) => e.kind)).toEqual(["lost"]);
    expect(out[0].day).toBe(4211);
    expect(out[0].who).toBe(7);
  });

  it("counts them, because a lingering storm can take a second the next day", () => {
    // [HC-35] as reworded: one per CONTACT, and a storm that lingers gets more
    // than one contact. The feed has to be able to say so.
    const was = steady();
    expect(run(was, after(was, { ruined: 4, hale: 7 }), true)[0].n).toBe(2);
  });
});

describe("a governor's routine business is not news", () => {
  it("says nothing when he raises a work", () => {
    // The claim the whole filter exists for. Fifty governors build every season;
    // twenty thousand sentences a century is a feed nobody reads.
    const was = steady();
    expect(run(was, after(was, { hale: 10 }), false)).toEqual([]);
  });

  it("says nothing when a work idles for want of hands", () => {
    const was = steady();
    expect(run(was, after(was, { hale: 8 }), false)).toEqual([]);
  });

  it("says nothing when a neglected work finally rots out", () => {
    // A work reaching `ruin` off the devolution ladder is the slow end of a
    // process the governor could have paid to mend at any point — business, not
    // an event. The SAME counters move as when the sea takes one; what tells
    // them apart is when the reading was taken, which is the only fact the
    // filter is given ([HC-33], [P-17b]).
    const was = steady();
    expect(run(was, after(was, { ruined: 3, hale: 9 }), false)).toEqual([]);
  });

  it("says nothing at all about a place merely growing or shrinking", () => {
    const was = steady();
    expect(run(was, after(was, { people: 210 }), true)).toEqual([]);
    expect(run(was, after(was, { people: 41 }), true)).toEqual([]);
  });

  it("says nothing when a place felt weather and lost nothing by it", () => {
    // [HC-33]: "nothing is owed damage merely because a storm arrived." A day
    // above Fair that cost the place nothing must leave the chronicle blank.
    const was = steady();
    expect(run(was, after(was, {}), true)).toEqual([]);
  });
});

describe("a change of standing is news", () => {
  it("reports a charter arriving", () => {
    const was = steady();
    expect(run(was, after(was, { size: 2 }), false).map((e) => e.kind)).toEqual(["promoted"]);
  });

  it("reports a place changing hands, and says whose it is now", () => {
    const was = steady();
    const out = run(was, after(was, { faction: 0 }), false);
    expect(out.map((e) => e.kind)).toEqual(["taken"]);
    expect(out[0].n).toBe(0);
  });

  it("reports a place standing empty", () => {
    // [HC-18]: only a deliberate hand empties a town, so this is a landmark
    // rather than a statistic — and it is exactly the kind of thing that must
    // not be lost in a wall of builds.
    const was = steady();
    expect(run(was, after(was, { people: 0 }), false).map((e) => e.kind)).toEqual(["emptied"]);
  });

  it("does not report a place that was already empty as emptying again", () => {
    const was = after(steady(), { people: 0 });
    expect(run(was, after(was, {}), false)).toEqual([]);
  });

  it("reports nothing rather than a promotion if something ever demotes a place", () => {
    // [HC-61] says nothing is ever demoted, so this cannot happen — and if the
    // day comes that it does, a missing line is a better bug than a wrong one.
    const was = after(steady(), { size: 2 });
    expect(run(was, after(was, { size: 0 }), false)).toEqual([]);
  });

  it("can report two things about one place on one day", () => {
    const was = steady();
    const out = run(was, after(was, { faction: 1, ruined: 3 }), true);
    expect(out.map((e) => e.kind).sort()).toEqual(["lost", "taken"]);
  });
});

describe("a crown running out of money is news once, not every season after", () => {
  it("reports the crossing", () => {
    // [HC-40]: a broke crown stops paying, and everything interesting follows
    // from that. It is the single most load-bearing fact in the faction layer.
    const out: Notable[] = [];
    notableCrown(900, 2, 140, 0, out);
    expect(out.map((e) => e.kind)).toEqual(["broke"]);
    expect(out[0].who).toBe(2);
  });

  it("stays quiet while it stays broke", () => {
    const out: Notable[] = [];
    for (let s = 0; s < 40; s++) notableCrown(900 + s * 90, 2, 0, 0, out);
    expect(out).toEqual([]);
  });

  it("stays quiet for a crown that is merely poor", () => {
    const out: Notable[] = [];
    notableCrown(900, 2, 9000, 12, out);
    expect(out).toEqual([]);
  });

  it("can report it again if the crown recovers and spends itself out a second time", () => {
    const out: Notable[] = [];
    notableCrown(900, 2, 140, 0, out);
    notableCrown(1800, 2, 0, 600, out);
    notableCrown(2700, 2, 600, 0, out);
    expect(out.map((e) => e.kind)).toEqual(["broke", "broke"]);
  });
});

describe("a fresh standing is a blank one", () => {
  it("starts every counter at nothing, so a place is never born reporting a loss", () => {
    const s = makeStanding();
    expect(s).toEqual({ size: 0, faction: 0, ruined: 0, hale: 0, people: 0 });
  });
});
