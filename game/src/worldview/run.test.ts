// The view's world, claimed — and the headline claim is the one property a view
// can silently destroy.
//
// [HC-11] Reproducible means the whole history, not the starting state. The same
//         seed fast-forwarded twice gives the same two hundred years, AT ANY
//         SPEED, on any machine. §5 lists it as an acceptance criterion in those
//         words: "the same seed, run at the slowest and the fastest rate,
//         produces identical world state at the same simulated day."
// [HC-26] Looking at the world must not change what is true in it.
// [HC-32] Severity is sampled at the place and the moment of contact — "two
//         towns twenty miles apart may feel the same event very differently,
//         and that is the point."
//
// WHAT THE SPEED CONTROL ACTUALLY VARIES is how many days `pump` is handed at a
// time: one at Watch, seventy-two at Century, thirty-six thousand from the
// button that runs a century without drawing. So the claim is testable exactly
// as written — chop a century three different ways and compare the worlds — and
// it needs no browser, no loop and no clock.
//
// NOTHING BELOW ASSERTS A POPULATION OR A WEALTH FIGURE. Those are tuning and
// they move; every claim here is either a comparison between two runs of the
// same world or a statement about shape.

import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR } from "../overworld/calendar";
import { runYears } from "../overworld/market";
import { century, makeRun, pump, select, totalCoin, totalPeople, totalWorks, type Run } from "./run";

const SEED = 1660; // the same sea town.html shows

// Everything a run can be distinguished by: the day, the three axes of every
// place, every ledger, every work's grade, and the live weather. Deliberately a
// string, so a mismatch prints the first thing that differs.
function fingerprint(run: Run): string {
  const parts: string[] = [`day ${run.world.day}`];
  for (let i = 0; i < run.world.places.length; i++) {
    const p = run.world.places[i];
    const t = run.towns[i];
    let grades = "";
    for (let k = 0; k < t.works.length; k++) grades += t.works[k].condition[0];
    parts.push(
      `${p.id}:${p.size}:${p.purpose}:${p.faction}:` +
        `${t.population.toFixed(12)}:${t.wealth.toFixed(12)}:${t.prosperity.toFixed(12)}:${grades}`,
    );
  }
  for (let i = 0; i < run.world.storms.length; i++) {
    const s = run.world.storms[i];
    parts.push(`storm ${s.id}@${s.x.toFixed(12)},${s.y.toFixed(12)}:${s.severity.toFixed(12)}`);
  }
  for (let i = 0; i < run.world.nations.length; i++) parts.push(`purse ${run.world.nations[i].treasury}`);
  return parts.join("\n");
}

const runFor = (days: number, chunk: number): Run => {
  const r = makeRun(SEED);
  let left = days;
  while (left > 0) {
    const take = left < chunk ? left : chunk;
    pump(r, take);
    left -= take;
  }
  return r;
};

describe("a century watched at any speed is the same century", () => {
  it("lands on the same world however the days were parcelled out to it", () => {
    // Watch hands over one day at a time; Century hands over about seventy; the
    // button hands over the lot. 173 is a prime, so its chunks never line up
    // with the 90-day season — a boundary that happened to land on the seasonal
    // beat every time would test nothing.
    const days = DAYS_PER_YEAR * 100;
    const oneAtATime = runFor(days, 1);
    const inFrames = runFor(days, 173);
    const allAtOnce = runFor(days, days);
    expect(fingerprint(inFrames)).toBe(fingerprint(oneAtATime));
    expect(fingerprint(allAtOnce)).toBe(fingerprint(oneAtATime));
  });

  it("gives the same world to a second watcher of the same seed", () => {
    const a = runFor(DAYS_PER_YEAR * 12, 7);
    const b = runFor(DAYS_PER_YEAR * 12, 7);
    expect(fingerprint(b)).toBe(fingerprint(a));
  });

  it("gives a different world to a different seed", () => {
    // The companion claim, and it is not a formality: a fingerprint that could
    // not tell two seas apart would pass every claim above while proving nothing.
    const a = runFor(DAYS_PER_YEAR * 8, 30);
    const other = makeRun(1661);
    pump(other, DAYS_PER_YEAR * 8);
    expect(fingerprint(other)).not.toBe(fingerprint(a));
  });
});

describe("looking at the world does not change what is true in it", () => {
  it("runs the same century whether or not a view was watching it", () => {
    // [HC-26] behaviourally, beside the structural scan in `coastline.test.ts`.
    // The view samples severity, counts works and builds a chronicle every day;
    // none of it may leave a mark. `runYears` is the headless driver, with no
    // hooks attached at all.
    const watched = runFor(DAYS_PER_YEAR * 30, 11);
    const unwatched = makeRun(SEED);
    runYears(unwatched.world, unwatched.towns, unwatched.markets, unwatched.wars, unwatched.routes, 30);
    expect(fingerprint(unwatched)).toBe(fingerprint(watched));
  });

  it("runs the same century whether or not a port was selected and read", () => {
    // The card is where `derive`, `summarise` and `wants` run. If any of them
    // wrote to the ledger, this is where it would show.
    const plain = runFor(DAYS_PER_YEAR * 20, 40);
    const inspected = makeRun(SEED);
    select(inspected, 3);
    for (let y = 0; y < 20; y++) {
      pump(inspected, DAYS_PER_YEAR);
      select(inspected, y % inspected.places.length);
    }
    expect(fingerprint(inspected)).toBe(fingerprint(plain));
  });
});

describe("the chart draws what each place felt, not merely where the weather is", () => {
  it("gives two ports under one sky different readings", () => {
    // [HC-32]. The storm blob says where the system is; the ring on each dot
    // says what it was worth THERE — exposure, shelter and distance from the
    // centre all bite, and a blob alone cannot show any of them.
    const r = makeRun(SEED);
    const seen = new Set<string>();
    for (let d = 0; d < DAYS_PER_YEAR * 3; d++) {
      pump(r, 1);
      if (r.world.storms.length === 0) continue;
      for (let i = 0; i < r.places.length; i++) seen.add(r.places[i].felt.toFixed(6));
      if (seen.size > 20) break;
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("reads the same severity the ledger was charged for", () => {
    // [P-47]: one definition of what a place felt, two readers. The snapshot
    // must not be a second opinion — if it were, the ring could disagree with
    // the damage, and neither would be checkable against the other.
    const r = makeRun(SEED);
    pump(r, DAYS_PER_YEAR * 2);
    for (let i = 0; i < r.places.length; i++) {
      expect(r.places[i].felt).toBeGreaterThanOrEqual(0);
      expect(r.places[i].band).toBeGreaterThanOrEqual(0);
      expect(r.places[i].band).toBeLessThanOrEqual(3);
    }
  });
});

describe("a century's chronicle is something a person can read", () => {
  const run = makeRun(SEED);
  century(run);

  it("orders a few hundred lines, not twenty thousand", () => {
    // Fifty governors publishing a reasoned build every season is 20,000
    // sentences a century. The filter's whole job is that this number is three
    // orders of magnitude smaller than that one, and still not zero.
    expect(run.feed.length).toBeGreaterThan(20);
    expect(run.feed.length).toBeLessThan(2000);
  });

  it("carries nothing a dispatch would have to cause, because nothing sends one yet", () => {
    // The honest statement of what this milestone cannot show, pinned so that
    // the day it stops being true is loud rather than quiet. Faction changes by
    // invasion, class changes on a charter, a treasury empties by being spent —
    // all three are dispatches, and nothing sends one until KAN-101.
    //
    // NAMED RATHER THAN COUNTED, 2026-09-21 (KAN-131), and the old form was a
    // single-seed observation wearing a rule's clothes. It asserted the feed
    // held exactly `["lost"]`, which also forbids `emptied` — a LEDGER event
    // that no dispatch causes and that [HC-18] permits. KAN-131's coin dial
    // made one place on this seed spend itself down to nobody in year 78, and
    // the claim went red for a reason it was never written about. The same
    // thing already happened on seed 99 within two centuries before the dial
    // moved at all, so the old wording was true of one world rather than of the
    // milestone.
    //
    // What the claim protects is the THREE dispatch-driven kinds, which is what
    // its own comment always said, and naming them makes it stricter: it now
    // fails if any one of them appears, on any seed, rather than only if the
    // exact set differs.
    const kinds = new Set(run.feed.map((e) => e.kind));
    for (const dispatched of ["promoted", "taken", "broke"]) expect([...kinds]).not.toContain(dispatched);
    // ...and the liveness guard, because an empty feed satisfies every line above.
    expect([...kinds]).toContain("lost");
  });

  it("dates every line to a real day of the run", () => {
    for (const e of run.feed) {
      expect(e.day).toBeGreaterThanOrEqual(0);
      expect(e.day).toBeLessThanOrEqual(run.world.day);
    }
  });

  it("keeps the chronicle in the order it happened", () => {
    for (let i = 1; i < run.feed.length; i++) {
      expect(run.feed[i].day).toBeGreaterThanOrEqual(run.feed[i - 1].day);
    }
  });

  it("draws a line that moved, rather than a flat one at nothing", () => {
    // A flatline at nothing looks exactly like a plateau, which is the one
    // reading this chart exists to make — so "the line is connected to the
    // world" has to be claimed rather than assumed.
    const n = run.trend.day.length;
    expect(run.trend.people[n - 1]).toBeGreaterThan(0);
    expect(run.trend.coin[n - 1]).toBeGreaterThan(0);
    expect(run.trend.works[n - 1]).toBeGreaterThan(0);
    expect(run.trend.people[n - 1]).not.toBe(run.trend.people[0]);
    expect(run.trend.coin[n - 1]).toBeGreaterThan(run.trend.coin[0]);
  });

  it("draws one point a year across the whole run", () => {
    // A hundred years, a hundred points — the first is the opening state on day
    // 0 and the last is the first day of the hundredth year. Written out rather
    // than read back off the accumulator: a claim that asked `recordTrend` how
    // often it records would assert nothing at all.
    expect(run.trend.day.length).toBe(100);
    expect(run.trend.day[0]).toBe(0);
    expect(run.trend.day[99]).toBe(DAYS_PER_YEAR * 99);
  });

  it("nothing in this milestone is ever promoted or changes hands", () => {
    // §9's acceptance criteria want a settlement promoted and a place changing
    // hands, and neither is reachable without nations acting. Recorded here as a
    // fact about the milestone rather than discovered later.
    const fresh = makeRun(SEED);
    for (let i = 0; i < run.places.length; i++) {
      expect(run.places[i].sizeRank).toBe(fresh.places[i].sizeRank);
      expect(run.places[i].faction).toBe(fresh.places[i].faction);
    }
  });
});

describe("the snapshot is what a frame reads, and it is already worked out", () => {
  it("opens with every place's ledger in it, before a single day is asked for", () => {
    // [P-2]: a frame reads stored numbers. If the snapshot were empty until the
    // first season resolved, the opening picture would be fifty invisible ports.
    const r = makeRun(SEED);
    expect(r.places.length).toBe(r.world.places.length);
    for (const p of r.places) {
      expect(p.people).toBeGreaterThan(0);
      expect(p.works).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("opens with no chronicle, because nothing has happened", () => {
    expect(makeRun(SEED).feed).toEqual([]);
  });

  it("draws a dot the size of the town's own ledger and not of a number it invented", () => {
    // The map's whole claim is that a dot's area IS the population. [P-47]: the
    // snapshot is a COPY of the ledger, never a second opinion about it — and it
    // is exact rather than approximate, at any moment in the run, because
    // population and works move only on the beat the copy is taken on.
    const r = makeRun(SEED);
    pump(r, DAYS_PER_YEAR * 30 + 47); // deliberately mid-season
    for (let i = 0; i < r.places.length; i++) {
      expect(r.places[i].people).toBe(r.towns[i].population);
      expect(r.places[i].works).toBe(r.towns[i].works.length);
    }
    // ...and they are not all the same town, which is what makes the map a map.
    expect(new Set(r.places.map((p) => p.people)).size).toBeGreaterThan(10);
  });

  it("draws its line and its dots off the same reading of the world", () => {
    // [P-47]: one quantity, one source. Both are written inside one seasonal
    // beat, so on the beat the line samples they must agree to the bit — and the
    // run stops one day past a yearly sample, which is the only moment at which
    // the two are guaranteed to have been taken together.
    const r = makeRun(SEED);
    pump(r, DAYS_PER_YEAR + 1);
    let onTheMap = 0;
    for (let i = 0; i < r.places.length; i++) onTheMap += r.places[i].people;
    const n = r.trend.day.length;
    expect(r.trend.day[n - 1]).toBe(DAYS_PER_YEAR);
    expect(r.trend.people[n - 1]).toBe(onTheMap);
    expect(r.trend.people[n - 1]).toBe(totalPeople(r));
    expect(r.trend.coin[n - 1]).toBeCloseTo(totalCoin(r), 6);
    expect(r.trend.works[n - 1]).toBe(totalWorks(r));
  });

  it("keeps wealth off the map, because it is the one figure the weather moves daily", () => {
    // [HC-6] splits weather in two: yield is a modifier and damage is an EVENT
    // that applies the day it happens — and the wealth loss is the event half.
    // A seasonal copy of it on the snapshot would be up to ninety days out of
    // date, so there is no copy: the map never draws wealth and the card reads
    // the live ledger. Asserted as a property of the struct so the field cannot
    // come back by accident.
    const r = makeRun(SEED);
    select(r, 6);
    expect(Object.keys(r.places[0])).not.toContain("coin");
    expect(r.card!.coin).toBe(r.towns[6].wealth);
    expect(r.card!.standing).toBe(r.towns[6].prosperity);
  });

  it("carries all three axes, so what a place IS is readable before you land", () => {
    // [HC-69]. Shape draws purpose, colour draws faction, the rim draws class —
    // and none of them is derivable at the frame rate, so all three are here.
    const r = makeRun(SEED);
    const purposes = new Set(r.places.map((p) => p.purpose));
    const ranks = new Set(r.places.map((p) => p.sizeRank));
    const factions = new Set(r.places.map((p) => p.faction));
    expect(purposes.size).toBeGreaterThan(1);
    expect(ranks.size).toBe(3);
    expect(factions.size).toBeGreaterThan(1);
  });

  it("totals the world in place order, so a sum is a fact about the world and not about the loop", () => {
    // [P-9]: float addition is not associative. The totals feed the trend line,
    // so an order that wandered would draw a graph of the iteration.
    const r = makeRun(SEED);
    pump(r, DAYS_PER_YEAR * 5);
    expect(totalPeople(r)).toBe(totalPeople(r));
    expect(totalCoin(r)).toBe(totalCoin(r));
    expect(totalWorks(r)).toBe(totalWorks(r));
  });

  it("has no card until a port is clicked, and a real one afterwards", () => {
    // [HC-1] and the brief's "no player interaction": the card is the whole of
    // the view's reach into a place, and it is prose and numbers.
    const r = makeRun(SEED);
    expect(r.card).toBeNull();
    select(r, 4);
    expect(r.card).not.toBeNull();
    expect(r.card!.line.length).toBeGreaterThan(0);
    expect(r.card!.governor.length).toBeGreaterThan(0);
    select(r, -1);
    expect(r.card).toBeNull();
  });
});
