// The garrison ladder — `picket · garrison · fortress` ([HC-60], KAN-104).
//
// WHY THIS FILE EXISTS. The ladder used to read `settlement | town | capital` and so
// shared two words with the SIZE class (`settlement → town → city`) by accident, welding
// two axes that [HC-54] says are independent. The rename split them. Nothing in the suite
// covered any of it — the bands in `constants.ts` are read by key, so a mis-mapped rung
// (picket's numbers filed under `fortress`) would have been silent. These claims are the
// net under that.
//
// What is asserted here is the SHAPE of the ladder — that it grades hardness, that each
// rung is harder than the one below, and that a raid is set against the softest rung by
// default. Never a band's value: every number in `constants.ts` is a starting guess.

import { describe, it, expect } from "vitest";
import { GARRISON } from "./constants";
import { makeWorld } from "./world";
import { populateBattle, enemyGarrisonSize, DEFAULT_GRADE } from "./spawn";
import type { GarrisonGrade } from "./types";
import type { PartySpec } from "./spawn";

// Softest first. The order is the design claim; the numbers behind it are not.
const LADDER: GarrisonGrade[] = ["picket", "garrison", "fortress"];

// The ladder this one used to collide with ([HC-60]). Kept as plain strings on purpose:
// the size class is not a type in this module and must never become one here.
const SIZE_CLASS = ["settlement", "town", "city"];

const party: PartySpec = { squads: [{ officer: null, pirates: 4, weapon: "musket" }] };

// Every defender the grade puts on the field, standing watch or walking a street.
const watchmen = (g: GarrisonGrade): number => {
  const w = GARRISON[g].watch;
  return w.plazaGuard + w.sentryPosts * 2 + w.patrols * w.patrolSize;
};

const rungs = (): [GarrisonGrade, GarrisonGrade][] => [
  [LADDER[0], LADDER[1]],
  [LADDER[1], LADDER[2]],
];

describe("the garrison ladder", () => {
  it("grades how hard a place is, and borrows no word from how big it is", () => {
    // The whole point of KAN-104. If a rung ever reads `town` again, the two axes have
    // been welded back together and a wiring mistake between them becomes invisible.
    expect([...Object.keys(GARRISON)].sort()).toEqual([...LADDER].sort());
    for (const grade of Object.keys(GARRISON)) expect(SIZE_CLASS).not.toContain(grade);
  });

  it("puts harder men on every rung above the one below", () => {
    // The spine is break-the-will, so morale is the rung's sharpest edge — the men, and
    // the officer who steadies them, both stiffen as the ladder climbs.
    for (const [soft, hard] of rungs()) {
      expect(GARRISON[hard].troop.morale).toBeGreaterThan(GARRISON[soft].troop.morale);
      expect(GARRISON[hard].troop.ferocity).toBeGreaterThan(GARRISON[soft].troop.ferocity);
      expect(GARRISON[hard].troop.marks).toBeGreaterThan(GARRISON[soft].troop.marks);
      expect(GARRISON[hard].officer.morale).toBeGreaterThan(GARRISON[soft].officer.morale);
    }
  });

  it("puts more men on every rung above the one below", () => {
    for (const [soft, hard] of rungs()) {
      expect(watchmen(hard)).toBeGreaterThan(watchmen(soft));
    }
  });

  it("musters a deeper answer to the alarm the harder the place is", () => {
    for (const [soft, hard] of rungs()) {
      const s = GARRISON[soft].reinforce;
      const h = GARRISON[hard].reinforce;
      expect(h.wave2 + h.wave3).toBeGreaterThan(s.wave2 + s.wave3);
    }
  });

  it("leaves the softest rung with nothing in reserve after the first cry", () => {
    // A picket is a thin militia watch: it can rouse once and then it is spent. That is
    // what makes it a raid worth taking, and it is the bottom of the ladder in the one
    // way a raider feels — nobody else comes.
    expect(GARRISON[LADDER[0]].reinforce.wave3).toBe(0);
    for (const g of LADDER.slice(1)) expect(GARRISON[g].reinforce.wave3).toBeGreaterThan(0);
  });
});

describe("a raid on a graded town", () => {
  it("is set against the softest rung unless the caller says otherwise", () => {
    // The playable town is meant to read as winnable against a seasoned band.
    const world = makeWorld();
    populateBattle(world, party);
    expect(world.garrison).toBe(LADDER[0]);
  });

  it("starts every world somewhere on this ladder and nowhere else", () => {
    expect(LADDER).toContain(makeWorld().garrison);
  });

  it("fields a deeper watch against a fortress than against a picket", () => {
    // This is the claim that actually catches a mis-mapped rung: it reads the bands
    // through the spawner, the way the raid does, rather than by key.
    const soft = makeWorld();
    populateBattle(soft, party, "picket");
    const hard = makeWorld();
    populateBattle(hard, party, "fortress");

    const defenders = (w: typeof soft) => w.units.filter((u) => u.side === "enemy").length;
    expect(defenders(hard)).toBeGreaterThan(defenders(soft));
    expect(hard.patrols.length).toBeGreaterThan(soft.patrols.length);
  });

  it("lands the same landing party whatever it is raiding", () => {
    // The grade describes the defence and nothing else — it must not leak into the
    // player's own crew.
    const soft = makeWorld();
    populateBattle(soft, party, "picket");
    const hard = makeWorld();
    populateBattle(hard, party, "fortress");

    const raiders = (w: typeof soft) => w.units.filter((u) => u.side === "player").length;
    expect(raiders(hard)).toBe(raiders(soft));
  });
});

// KAN-109. The deploy screen is the one place the player is told what he is walking into,
// and the decision it asks for — how many men to land — is only meaningful if the number is
// true. It previewed a hardcoded 15 against a picket that fields 9, and it could not have
// been right for more than one rung because it never saw the grade at all ([HC-59]: the
// garrison is a reading of the place, not a fixed number).
//
// These assert the RELATIONSHIP — preview equals field — not any headcount. Every number in
// `constants.ts` is a starting guess; that the screen tells the truth is not.
describe("the garrison the deploy screen previews", () => {
  const defenders = (w: ReturnType<typeof makeWorld>) => w.units.filter((u) => u.side === "enemy").length;

  const fielded = (grade: GarrisonGrade): number => {
    const world = makeWorld();
    populateBattle(world, party, grade);
    return defenders(world);
  };

  it("promises exactly the men the raid then puts on the field, on every rung of the ladder", () => {
    // The whole bug. One rung agreeing by luck is not the claim — all three are.
    for (const grade of LADDER) expect(enemyGarrisonSize(grade)).toBe(fielded(grade));
  });

  it("counts the officer who leads the plaza guard, because the raiders have to break him too", () => {
    // The garrison is a led band plus unled posts and patrols, so the preview is not just
    // the sum of the watch counts — it is one more than that.
    for (const grade of LADDER) expect(enemyGarrisonSize(grade)).toBeGreaterThan(watchmen(grade));
  });

  it("previews a harder place as a heavier butcher's bill", () => {
    for (const [soft, hard] of rungs()) {
      expect(enemyGarrisonSize(hard)).toBeGreaterThan(enemyGarrisonSize(soft));
    }
  });

  it("previews the grade a raid is actually set against when nobody names one", () => {
    // The screen and the battle must not hold two opinions about which town this is: the
    // default the spawner uses is the default the screen reads.
    const world = makeWorld();
    populateBattle(world, party);
    expect(world.garrison).toBe(DEFAULT_GRADE);
    expect(enemyGarrisonSize(DEFAULT_GRADE)).toBe(defenders(world));
  });
});
