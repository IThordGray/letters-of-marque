// The compass a town's ground is named off — `bearingOf` and the rule it settles
// ties by (KAN-111).
//
// WHY THIS FILE EXISTS. `bearingOf` picks the best of six flat-top bearings by
// dot product, and ground lying exactly between two of them ties. The tie used to
// fall to whichever bearing `BEARING_ORDER` listed first, which is an accident of
// an array rather than a rule, and it read wrongly in the one case a player sees:
// water straight out to the east of the town was described in prose as lying "to
// the north-east". `[P-10]` wants an explicit tie-break; `[HC-73]` says which way
// it should point, because in a town's local frame south IS seaward and what a
// bearing names is usually a coast.
//
// The tie-break is therefore SEAWARD-FIRST, and these are claims about that rule —
// never about which of the six a particular hex happens to score highest on.
//
// Two disciplines from `implementation/testing.md` are load-bearing here. The
// reference below re-derives the rule from `southness` rather than reading the
// module's own ranking table, so it is a check and not an echo. And every sweep
// asserts it actually found the case it is about: a tie test that met no ties
// would be a decoration.

import { describe, it, expect } from "vitest";
import type { Axial } from "./hex";
import type { Bearing } from "./types";
import { BEARING_ORDER, axialOf, toPixel, southness, distance, bearingOf, CENTRE } from "./hex";

// How well a hex points along a bearing — the quantity `bearingOf` maximises,
// spelled out here so the tests can see the ties rather than infer them.
const alignment = (a: Axial, b: Bearing): number => {
  const p = toPixel(a, 1);
  const d = toPixel(axialOf(b), 1);
  return p.x * d.x + p.y * d.y;
};

// Every bearing that scores the exact maximum for this hex. More than one means a
// tie, and a tie is what the rule under test exists to settle.
const contenders = (a: Axial): Bearing[] => {
  let max = -Infinity;
  for (const b of BEARING_ORDER) {
    const s = alignment(a, b);
    if (s > max) max = s;
  }
  return BEARING_ORDER.filter((b) => alignment(a, b) === max);
};

// The rule, re-derived: best alignment wins, and a tie goes to the more seaward
// candidate. `order` is the sequence the compass is walked in — the answer must
// not depend on it, which is the half of `[P-10]` the old code failed.
const bySeawardRule = (a: Axial, order: Bearing[]): Bearing => {
  let best = order[0];
  for (const b of order) {
    const s = alignment(a, b);
    const bs = alignment(a, best);
    if (s > bs || (s === bs && southness(axialOf(b)) > southness(axialOf(best)))) best = b;
  }
  return best;
};

const WIDDERSHINS = [...BEARING_ORDER].reverse();

// Whole hexes out to the edge of the drawn flower, plus sixth-of-a-hex points —
// because `land.ts` reads bearings off region CENTROIDS, which land between hexes.
const wholeHexes: Axial[] = [];
for (let q = -8; q <= 8; q++) {
  for (let r = -8; r <= 8; r++) {
    const a = { q, r };
    if (distance(a, CENTRE) >= 1 && distance(a, CENTRE) <= 8) wholeHexes.push(a);
  }
}

const centroids: Axial[] = [];
for (let qi = -36; qi <= 36; qi++) {
  for (let ri = -36; ri <= 36; ri++) {
    if (qi === 0 && ri === 0) continue;
    centroids.push({ q: qi / 6, r: ri / 6 });
  }
}

const everywhere = [...wholeHexes, ...centroids];
const tied = everywhere.filter((a) => contenders(a).length > 1);

describe("the compass ground is named off", () => {
  it("calls water lying due east of the town seaward, not landward", () => {
    // The observed bug, and the reason the tie-break points the way it does. A hex
    // due east on the local frame's axis is exactly as north-east as it is
    // south-east; a coastal town's east-lying water reads as south-east.
    expect(southness({ q: 2, r: -1 })).toBe(0);
    expect(contenders({ q: 2, r: -1 })).toEqual(["NE", "SE"]);
    expect(bearingOf({ q: 2, r: -1 })).toBe("SE");
  });

  it("says the same of the west side, and says it however far out the water lies", () => {
    // The mirror of the same tie, at every distance — so a far anchorage is never
    // described differently from a near one on the same line out of the town.
    for (let k = 1; k <= 4; k++) {
      expect(bearingOf({ q: 2 * k, r: -k })).toBe("SE");
      expect(bearingOf({ q: -2 * k, r: k })).toBe("SW");
    }
  });

  it("settles every tie it can actually meet toward the sea", () => {
    // The general rule, asserted as a relationship rather than as six answers: of
    // the bearings that score alike, the one named is the one lying most seaward.
    expect(tied.length).toBeGreaterThan(0);
    for (const a of tied) {
      const won = bearingOf(a);
      const rivals = contenders(a);
      expect(rivals).toContain(won);
      for (const b of rivals) {
        if (b !== won) expect(southness(axialOf(won))).toBeGreaterThan(southness(axialOf(b)));
      }
    }
  });

  it("never meets a tie the sea cannot settle", () => {
    // The precondition that makes seaward-first a complete answer: only ADJACENT
    // bearings ever tie for the win, and no two adjacent bearings lie equally
    // seaward. If this ever fails, the tie-break needs its second key in earnest.
    for (const a of tied) {
      const seawardness = contenders(a).map((b) => southness(axialOf(b)));
      expect(new Set(seawardness).size).toBe(seawardness.length);
    }
  });

  it("lets no tie-break overrule ground that clearly points one way", () => {
    // The tie-break must be a tie-break. Where one bearing scores strictly best,
    // it is the one named, seaward or not — which is what keeps the six neighbours
    // naming themselves and keeps landward ground landward.
    const clear = everywhere.filter((a) => contenders(a).length === 1);
    expect(clear.length).toBeGreaterThan(tied.length);
    for (const a of clear) expect(bearingOf(a)).toBe(contenders(a)[0]);
  });

  it("answers even the town's own hex by the rule, degenerate though the question is", () => {
    // The centre lies in no direction from itself, so all six score alike — the
    // widest possible tie. There is no right answer here, only a consistent one,
    // and consistency means the rule reaches it rather than the array order.
    expect(contenders(CENTRE)).toEqual(BEARING_ORDER);
    expect(bearingOf(CENTRE)).toBe("S");
  });

  it("gives the same answer whichever way round the compass is walked", () => {
    // The half of [P-10] the old code failed: with no tie-break, reversing the
    // walk flips every tied hex to the other bearing. With one, it cannot.
    for (const a of everywhere) {
      const answer = bearingOf(a);
      expect(answer).toBe(bySeawardRule(a, BEARING_ORDER));
      expect(answer).toBe(bySeawardRule(a, WIDDERSHINS));
    }
  });
});
