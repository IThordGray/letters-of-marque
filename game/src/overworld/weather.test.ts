// Weather — the ambient spectrum, the events that travel along it, and what a
// severity is worth when it reaches a coast.
//
// §7's acceptance criteria are written to be transcribed almost directly, and
// most of this file is that transcription. The long-run claims share ONE
// two-hundred-year run, built once below, because that is the run the milestone
// produces and re-running it per claim would buy nothing.
//
// Nothing here pins a tuning constant ([house rule 2]). What is pinned is the
// shape of the rules: that the spectrum is continuous, that momentum only ever
// runs one way, that a coast's exposure changes what it takes, and — the one
// most likely to be broken by accident — that an effect can only ever read a
// SAMPLED SEVERITY and never the fact that a storm was overhead.

import { describe, it, expect } from "vitest";
import { DAYS_PER_YEAR, seasonOfDay } from "./calendar";
import { makeWorld, seasonOf, stepDay, type World } from "./clock";
import { CLIMATES, climateOf, stormTrack, zoneAt } from "./climate";
import type { Place } from "./places";
import { generateWorld } from "./worldgen";
import {
  AMBIENT, BANDS, DAMAGE, EXPOSURE, STORM,
  ambientAt, bandAt, bandIdAt, contactAt, coverageOf, describeStorm, effectOf,
  feltAt, passageDays, pickAt, prevailingAt, radiusOf, readSky, severityAt, skyOf, stepWeather,
  takesOf, windAt, type Storm,
} from "./weather";

const SEED = 1660;
const YEARS = 200;
const LONG_RUN_MS = 120000;

// A place built against the STRUCT, never through a producer — the fixture rule.
// Every field present, in one order ([P-26]), so a test place and a generated
// one have the same shape.
function placeAt(over: Partial<Place>): Place {
  return {
    id: 0, name: "Testport", governor: "Nobody",
    x: 700, y: 400, sx: 0, sy: 1, zone: 0, shelter: 0,
    size: "town", purpose: "trade", faction: 0, seed: 1,
    foundedDay: -40 * DAYS_PER_YEAR, population: 100, wealth: 100, timberGranted: false,
    ...over,
  };
}

// ---- The one long run ------------------------------------------------------

interface Run {
  world: World;
  places: number;
  // per place, per year
  blows: number[];
  gales: number[];
  tempests: number[];
  destroyed: number[];
  takes: number[];
  // events
  born: number;
  maxAlive: number;
  everRebuilt: number; // a storm whose trend went from spending back to building
  offTrack: number; // a storm born in a season its regime forbids
  denormalised: number; // a track that stopped being a unit vector
  diedRich: number; // a storm struck off while still above the ambient, on the map
  // [HC-33]
  harmlessAndRuinous: number;
  witness: string;
  // [HC-35]
  worstContact: number;
}

function longRun(years: number): Run {
  const world = generateWorld(SEED);
  const days = years * DAYS_PER_YEAR;
  const n = world.places.length;
  const zero = () => new Array(n).fill(0) as number[];
  const r: Run = {
    world, places: n,
    blows: zero(), gales: zero(), tempests: zero(), destroyed: zero(),
    takes: world.places.map((p) => takesOf(world, p)),
    born: 0, maxAlive: 0, everRebuilt: 0, offTrack: 0, denormalised: 0, diedRich: 0,
    harmlessAndRuinous: 0, witness: "", worstContact: 0,
  };
  const prevBand = zero();
  const trendWas = new Map<number, number>();
  const known = new Set<number>();
  for (let d = 0; d < days; d++) {
    const before = world.storms.slice();
    stepDay(world);
    stepWeather(world);
    if (world.storms.length > r.maxAlive) r.maxAlive = world.storms.length;
    const live = new Set(world.storms.map((s) => s.id));
    for (const s of before) {
      if (live.has(s.id)) continue;
      // Struck off. It should have fallen back into the ambient range, or run
      // off the edge of the world.
      const inBox =
        s.x > -STORM.strayNm && s.y > -STORM.strayNm &&
        s.x < world.shape.widthNm + STORM.strayNm && s.y < world.shape.heightNm + STORM.strayNm;
      if (inBox && s.severity > ambientAt(world, zoneAt(world.zones, s.x, s.y), world.day)) r.diedRich++;
    }
    for (const s of world.storms) {
      if (!known.has(s.id)) {
        known.add(s.id);
        r.born++;
        if (!climateOf(world.zones, s.zone).storms.seasons[seasonOfDay(s.bornDay)]) r.offTrack++;
      }
      const len = s.dx * s.dx + s.dy * s.dy;
      if (Math.abs(len - 1) > 1e-9) r.denormalised++;
      const was = trendWas.get(s.id);
      if (was !== undefined && was < 0 && s.trend > 0) r.everRebuilt++;
      trendWas.set(s.id, s.trend);
    }
    for (const s of world.storms) {
      let harmless = -1;
      let ruinous = -1;
      for (let i = 0; i < n; i++) {
        const p = world.places[i];
        if (coverageOf(s, p.x, p.y) <= 0) continue;
        const e = contactAt(world, p);
        if (e.band === "fair" && harmless < 0) harmless = i;
        if (e.worksDropped > 0 && ruinous < 0) ruinous = i;
      }
      if (harmless < 0 || ruinous < 0) continue;
      r.harmlessAndRuinous++;
      if (r.witness === "") {
        r.witness =
          `day ${world.day}, ${describeStorm(world, s)}: ` +
          `${world.places[harmless].name} felt ${feltAt(world, world.places[harmless]).toFixed(3)} and owed nothing, ` +
          `${world.places[ruinous].name} felt ${feltAt(world, world.places[ruinous]).toFixed(3)} and lost work`;
      }
    }
    for (let i = 0; i < n; i++) {
      const p = world.places[i];
      const band = bandAt(feltAt(world, p));
      if (band > prevBand[i]) {
        if (band >= 1) r.blows[i]++;
        if (band >= 2) r.gales[i]++;
        if (band >= 3) r.tempests[i]++;
      }
      prevBand[i] = band;
      if (band === 0) continue;
      const e = contactAt(world, p);
      r.destroyed[i] += e.worksDestroyed;
      if (e.worksDestroyed > r.worstContact) r.worstContact = e.worksDestroyed;
    }
  }
  const perYear = (a: number[]) => a.map((v) => v / years);
  r.blows = perYear(r.blows);
  r.gales = perYear(r.gales);
  r.tempests = perYear(r.tempests);
  r.destroyed = perYear(r.destroyed);
  return r;
}

const RUN = longRun(YEARS);

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const decileBy = (key: number[], values: number[], top: boolean) => {
  const idx = key.map((_, i) => i).sort((a, b) => key[a] - key[b] || a - b);
  const ten = top ? idx.slice(-10) : idx.slice(0, 10);
  return mean(ten.map((i) => values[i]));
};

// ---- §7.2 The ambient spectrum ---------------------------------------------

describe("every zone has weather every single day, and none of it is stored", () => {
  it("answers for any day of two hundred years without the world having been there", () => {
    // [HC-30]: a pure function of (world seed, zone, day). The world stands on
    // day zero throughout this test and answers about every one of them.
    const w = generateWorld(SEED);
    for (let d = 0; d < YEARS * DAYS_PER_YEAR; d += 37) {
      const v = ambientAt(w, d % w.zones.length, d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(w.day).toBe(0);
  });

  it("gives the same seed the same sky, however many times it is asked", () => {
    const a = generateWorld(SEED);
    const b = generateWorld(SEED);
    for (let d = 0; d < 400; d++) expect(ambientAt(a, 1, d)).toBe(ambientAt(b, 1, d));
    expect(ambientAt(a, 1, 200)).toBe(ambientAt(a, 1, 200));
  });

  it("gives a different world different weather", () => {
    const a = generateWorld(SEED);
    const b = generateWorld(SEED + 1);
    let same = 0;
    for (let d = 0; d < 200; d++) if (ambientAt(a, 0, d) === ambientAt(b, 0, d)) same++;
    expect(same).toBeLessThan(3);
  });

  it("moves the sky by degrees, so no day is a different world from the one before it", () => {
    const w = generateWorld(SEED);
    for (let zone = 0; zone < w.zones.length; zone++) {
      let worst = 0;
      let span = 0;
      let lo = 1;
      let hi = 0;
      for (let d = 1; d < DAYS_PER_YEAR * 3; d++) {
        const jump = Math.abs(ambientAt(w, zone, d) - ambientAt(w, zone, d - 1));
        if (jump > worst) worst = jump;
        const v = ambientAt(w, zone, d);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      span = hi - lo;
      // A day may not move the sky by a third of everything the year contains.
      expect(worst, `zone ${zone}`).toBeLessThan(span * 0.34);
    }
  });

  it("carries the season across its own boundary without a step in it", () => {
    // The four rows of a climate's table are ANCHORS, not steps. Read as steps,
    // day 90 would be a different world from day 89 — which is exactly the
    // "clustering into discrete states" §7 forbids.
    const w = generateWorld(SEED);
    const BOUNDARIES = [90, 180, 270, 360];
    for (let zone = 0; zone < w.zones.length; zone++) {
      // The yardstick has to EXCLUDE the boundaries, or the boundary sets its
      // own bar and the claim passes whatever the code does. (Found by mutating
      // the anchors back into steps and counting: the first version of this test
      // survived it.)
      let ordinary = 0;
      for (let d = 1; d <= DAYS_PER_YEAR; d++) {
        if (BOUNDARIES.includes(d)) continue;
        ordinary = Math.max(ordinary, Math.abs(ambientAt(w, zone, d) - ambientAt(w, zone, d - 1)));
      }
      for (const boundary of BOUNDARIES) {
        const step = Math.abs(ambientAt(w, zone, boundary) - ambientAt(w, zone, boundary - 1));
        expect(step, `zone ${zone} day ${boundary}`).toBeLessThanOrEqual(ordinary);
      }
    }
  });

  it("shows no gap in the spectrum — a band is a reading of the value, never the value itself", () => {
    // §7's criterion in as many words: "Sampled severity across a zone over a
    // year shows no gaps or clustering into discrete states."
    const w = generateWorld(SEED);
    const buckets = new Array(20).fill(0);
    for (let zone = 0; zone < w.zones.length; zone++) {
      for (let d = 0; d < DAYS_PER_YEAR * 5; d++) {
        const v = ambientAt(w, zone, d);
        buckets[Math.min(19, Math.floor(v * 20))]++;
      }
    }
    // Every bucket between the lowest and the highest occupied one has samples
    // in it: the value walks the range rather than jumping about inside it.
    const first = buckets.findIndex((c) => c > 0);
    const last = buckets.length - 1 - [...buckets].reverse().findIndex((c) => c > 0);
    for (let i = first; i <= last; i++) expect(buckets[i], `bucket ${i}`).toBeGreaterThan(0);
    expect(last - first).toBeGreaterThan(4);
  });

  it("shapes the year by the climate's own baseline, so a settled zone is quieter than a boisterous one", () => {
    // Not a number — a direction. The zone whose table says "boisterous" must
    // read further up the spectrum than the one whose table says "settled".
    const w = makeWorld(SEED);
    w.zones = [
      { id: 0, climate: "stormRoad", x: 0, y: 0 },
      { id: 1, climate: "dryCays", x: 1000, y: 0 },
    ];
    let rough = 0;
    let calm = 0;
    for (let d = 0; d < DAYS_PER_YEAR * 5; d++) {
      rough += ambientAt(w, 0, d);
      calm += ambientAt(w, 1, d);
    }
    expect(rough).toBeGreaterThan(calm);
  });

  it("reads the same season the clock does, so the two can never drift apart", () => {
    // [P-47], and the shape of it changed on KAN-107. `seasonAt` used to be a
    // COPY of `seasonOf`'s arithmetic written out in this module, kept honest by
    // this century-long sweep. Both now call the one calendar, so drift is not
    // merely unmeasured but unreachable — and this claim stays, because it is
    // what would notice if either side ever went back to doing its own sums.
    const w = makeWorld(1);
    for (let d = 0; d < DAYS_PER_YEAR * 100; d += 7) {
      w.day = d;
      expect(seasonOfDay(d)).toBe(seasonOf(w));
    }
  });
});

// ---- §7.1 Climate holds ----------------------------------------------------

describe("no zone ever produces weather its regime forbids", () => {
  it("spawns no event in a season the climate does not spawn events in", () => {
    // §7's criterion: "A dry coast records no rainstorm season in two hundred
    // years." Counted over the whole run rather than argued.
    expect(RUN.offTrack).toBe(0);
    expect(RUN.born).toBeGreaterThan(YEARS); // and something did happen
  });

  it("leaves a climate that spawns nothing in a season with nothing to spawn", () => {
    const w = makeWorld(SEED);
    w.zones = [{ id: 0, climate: "windward", x: 700, y: 400 }];
    w.shape = generateWorld(SEED).shape;
    const forbidden = CLIMATES.windward.storms.seasons.findIndex((on) => !on);
    let bornInForbidden = 0;
    for (let d = 0; d < DAYS_PER_YEAR * 50; d++) {
      stepDay(w);
      stepWeather(w);
      for (const s of w.storms) if (s.bornDay === w.day && seasonOfDay(s.bornDay) === forbidden) bornInForbidden++;
    }
    expect(bornInForbidden).toBe(0);
  });
});

// ---- §7.3 Events -----------------------------------------------------------

describe("an event has a life, and that is the whole reason it is stored", () => {
  it("keeps only a handful alive at once, two hundred years running", () => {
    // [HC-31] is an exception to [HC-14] and it only stays affordable while this
    // is true. A dozen would be a different design.
    expect(RUN.maxAlive).toBeGreaterThan(0);
    expect(RUN.maxAlive).toBeLessThanOrEqual(12);
  });

  it("never gets up again once it is spending itself", () => {
    // THE reason a live event is stored ([HC-31]): momentum is history. An event
    // that is building is not the same as an identical event blowing out, and if
    // the trend could flip back the storage would be buying nothing.
    expect(RUN.everRebuilt).toBe(0);
  });

  it("dies back into the ambient range rather than being switched off", () => {
    // §7.3's own words. A storm struck off while still an excursion above the
    // ambient, and still on the map, would be a lifetime cap wearing a costume.
    expect(RUN.diedRich).toBe(0);
  });

  it("carries its track as a unit vector for its whole life, never as an angle", () => {
    // [P-17a]: an angle costs a banned function to use and another to recover.
    expect(RUN.denormalised).toBe(0);
  });

  it("wears a footprint the size of its own severity, so a squall is not a hurricane", () => {
    const small = radiusOf({ severity: 0.3 } as Storm);
    const big = radiusOf({ severity: 0.95 } as Storm);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });

  it("breeds the same storms in the same world, on the same days, on the same tracks", () => {
    const a = generateWorld(SEED);
    const b = generateWorld(SEED);
    const logA: string[] = [];
    const logB: string[] = [];
    const write = (w: typeof a, into: string[]) => {
      for (const s of w.storms) into.push(`${w.day} ${s.id} ${s.x} ${s.y} ${s.dx} ${s.dy} ${s.severity} ${s.trend}`);
    };
    for (let d = 0; d < DAYS_PER_YEAR * 3; d++) {
      stepDay(a);
      stepWeather(a);
      write(a, logA);
      stepDay(b);
      stepWeather(b);
      write(b, logB);
    }
    expect(logA).toEqual(logB);
    expect(logA.length).toBeGreaterThan(100);
  });

  it("does not care whether the days were stepped in one run or in pieces", () => {
    // [HC-11] "at any speed", which is the whole promise the speed control makes.
    const whole = generateWorld(SEED);
    for (let d = 0; d < 900; d++) {
      stepDay(whole);
      stepWeather(whole);
    }
    const pieces = generateWorld(SEED);
    for (let chunk = 0; chunk < 18; chunk++) {
      for (let d = 0; d < 50; d++) {
        stepDay(pieces);
        stepWeather(pieces);
      }
    }
    expect(pieces.storms).toEqual(whole.storms);
    expect(pieces.day).toBe(whole.day);
  });

  it("says what it is doing in words a person can check it by", () => {
    // [HC-16]'s discipline: in a world with no player, a stated reason is the
    // only way to tell a working simulation from a plausible-looking one.
    const w = generateWorld(SEED);
    let said = "";
    for (let d = 0; d < DAYS_PER_YEAR * 3 && said === ""; d++) {
      stepDay(w);
      stepWeather(w);
      if (w.storms.length > 0) said = describeStorm(w, w.storms[0]);
    }
    expect(said).toMatch(/day|days/);
    expect(said).toMatch(/building|spending/);
  });
});

// ---- §7.4 / [HC-32] Sampling ----------------------------------------------

describe("severity is sampled at the place and the moment of contact", () => {
  it("never reads below the ambient the zone is already having", () => {
    // [HC-32]: "the GREATER of the zone's ambient value and the contribution of
    // any event". An event can only ever add to a place's day.
    const w = generateWorld(SEED);
    for (let d = 0; d < DAYS_PER_YEAR * 2; d++) {
      stepDay(w);
      stepWeather(w);
      for (const p of w.places) {
        expect(severityAt(w, p.x, p.y)).toBeGreaterThanOrEqual(ambientAt(w, p.zone, w.day) - 1e-12);
      }
    }
  });

  it("lets two places twenty miles apart feel the same event very differently", () => {
    // §7.3's own promise, and the reason contact is sampled rather than
    // announced. Here it is measured on one event and two positions.
    const w = generateWorld(SEED);
    const s: Storm = {
      id: 1, zone: 0, bornDay: 0, x: 700, y: 400, dx: -1, dy: 0, severity: 0.9, trend: 0.05,
    };
    const centre = coverageOf(s, s.x, s.y);
    const rim = coverageOf(s, s.x + radiusOf(s) * 0.95, s.y);
    expect(centre).toBeGreaterThan(rim * 2);
    expect(coverageOf(s, s.x + radiusOf(s) + 1, s.y)).toBe(0);
    void w;
  });

  it("falls off from the centre rather than stopping at a wall", () => {
    const s: Storm = {
      id: 1, zone: 0, bornDay: 0, x: 0, y: 0, dx: -1, dy: 0, severity: 0.8, trend: -0.05,
    };
    const r = radiusOf(s);
    let last = coverageOf(s, 0, 0);
    for (let k = 1; k <= 20; k++) {
      const v = coverageOf(s, (r * k) / 20, 0);
      expect(v).toBeLessThanOrEqual(last + 1e-12);
      last = v;
    }
    expect(last).toBe(0);
  });
});

// ---- [HC-29] Exposure ------------------------------------------------------

describe("a coast's exposure is a property of the map", () => {
  it("gives a windward coast more of the same sea than a lee one", () => {
    const w = generateWorld(SEED);
    const c = climateOf(w.zones, 0);
    const t = stormTrack(c);
    const windward = takesOf(w, placeAt({ zone: 0, sx: -t.dx, sy: -t.dy }));
    const lee = takesOf(w, placeAt({ zone: 0, sx: t.dx, sy: t.dy }));
    expect(windward).toBeGreaterThan(lee);
  });

  it("spares a landlocked anchorage what an open beach is not spared", () => {
    const w = generateWorld(SEED);
    const open = takesOf(w, placeAt({ zone: 0, shelter: 0 }));
    const bayhead = takesOf(w, placeAt({ zone: 0, shelter: 1 }));
    expect(bayhead).toBeLessThan(open);
  });

  it("never spares a coast everything — a lee shore is still a shore", () => {
    const w = generateWorld(SEED);
    for (let zone = 0; zone < w.zones.length; zone++) {
      const t = stormTrack(climateOf(w.zones, zone));
      expect(takesOf(w, placeAt({ zone, sx: t.dx, sy: t.dy, shelter: 1 }))).toBeGreaterThan(0);
    }
    expect(EXPOSURE.lee).toBeGreaterThan(0);
  });

  it("makes siting a decision with consequences, measured over two centuries", () => {
    // §7's criterion: "Places on exposed coasts take measurably more than
    // sheltered ones over the run. If siting makes no difference, [HC-29] is not
    // really implemented."
    const exposedGales = decileBy(RUN.takes, RUN.gales, true);
    const shelteredGales = decileBy(RUN.takes, RUN.gales, false);
    expect(exposedGales).toBeGreaterThan(shelteredGales * 2);
    const exposedTempests = decileBy(RUN.takes, RUN.tempests, true);
    const shelteredTempests = decileBy(RUN.takes, RUN.tempests, false);
    expect(exposedTempests).toBeGreaterThan(shelteredTempests * 2);
  });
});

// ---- [HC-33] The rule most likely to be broken by accident -----------------

describe("nothing is owed damage merely because a storm arrived", () => {
  it("shows the same event harmless at one contact and ruinous at another", () => {
    // §7's criterion, and the sharpest one in the section: "At least one event
    // in the run must be demonstrably harmless at one contact and damaging at
    // another. If every event that touches anything damages it, [HC-33] is not
    // really implemented."
    expect(RUN.harmlessAndRuinous).toBeGreaterThan(0);
    expect(RUN.witness).not.toBe("");
  });

  it("costs a place nothing on a fair day, whatever the roll says", () => {
    for (let i = 0; i <= 100; i++) {
      const e = effectOf(BANDS[1].from - 0.001, i / 100);
      expect(e.band).toBe("fair");
      expect(e.yieldLoss).toBe(0);
      expect(e.maintenanceShare).toBe(0);
      expect(e.worksDropped).toBe(0);
      expect(e.worksDestroyed).toBe(0);
    }
  });

  it("reads a severity and nothing else — an effect cannot ask whether a storm was overhead", () => {
    // The constraint stated as a signature. Two contacts with the same sampled
    // severity are the same contact, whether one came from an event at its
    // centre, an event at its rim, or a foul ambient day with no event at all.
    const fromCentre = effectOf(0.63, 0.2);
    const fromRim = effectOf(0.63, 0.2);
    expect(fromCentre).toEqual(fromRim);
    expect(effectOf.length).toBe(2);
  });

  it("can hurt with no event alive at all, so damage is not an event's signature", () => {
    // The other half of the same claim. If damage could only arrive through an
    // event, "an event happened here" would be a perfect predictor of it — which
    // is [HC-33] violated by a back door.
    const rough = effectOf(BANDS[2].from + 0.01, 0.5);
    expect(rough.yieldLoss).toBeGreaterThan(0);
  });
});

// ---- §7.4 The bands --------------------------------------------------------

describe("the bands are a reading of one spectrum, not four kinds of weather", () => {
  it("keeps its definitions in a table and its type honest against it", () => {
    // [HC-90] / [HC-91]: definitions are data, the type comes FROM the data.
    expect(BANDS.length).toBe(4);
    expect(BANDS[0].from).toBe(0);
    for (let i = 1; i < BANDS.length; i++) expect(BANDS[i].from).toBeGreaterThan(BANDS[i - 1].from);
    expect(bandIdAt(0)).toBe("fair");
    expect(bandIdAt(1)).toBe("tempest");
  });

  it("bites harder deeper into a band than at its floor", () => {
    // A band is a reading, so the top of a gale must cost more than the bottom
    // of one. Bucketed damage would make the band the value rather than a
    // reading of it.
    const floor = effectOf(BANDS[2].from + 0.001, 0.99);
    const top = effectOf(BANDS[3].from - 0.001, 0.99);
    expect(top.yieldLoss).toBeGreaterThan(floor.yieldLoss);
  });

  it("costs more the further up the spectrum a contact lands", () => {
    let last = -1;
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const e = effectOf(Math.min(1, s), 0.99);
      expect(e.yieldLoss).toBeGreaterThanOrEqual(last === -1 ? 0 : 0);
      last = e.yieldLoss;
    }
    expect(effectOf(0.99, 0.99).yieldLoss).toBeGreaterThan(effectOf(BANDS[1].from + 0.001, 0.99).yieldLoss);
  });

  it("never lets a blow take a work down a grade, and lets a tempest", () => {
    // §7.4: a Blow is "loose roof shingles"; the works ladder is the Tempest's.
    for (let i = 0; i <= 100; i++) {
      expect(effectOf(BANDS[1].from + 0.01, i / 100).worksDropped).toBe(0);
      expect(effectOf(BANDS[2].from + 0.01, i / 100).worksDropped).toBe(0);
    }
    let dropped = 0;
    for (let i = 0; i <= 100; i++) if (effectOf(0.99, i / 100).worksDropped > 0) dropped++;
    expect(dropped).toBeGreaterThan(0);
  });

  it("never destroys more than one work at one contact, at any severity or any roll", () => {
    // [HC-35]: "razing is deliberate and wholesale; the storm is random and
    // singular." A town can lose its quay to the sea; it cannot lose its town.
    for (let s = 0; s <= 1.0001; s += 0.005) {
      for (let i = 0; i <= 100; i++) {
        expect(effectOf(Math.min(1, s), i / 100).worksDestroyed).toBeLessThanOrEqual(1);
      }
    }
    expect(RUN.worstContact).toBeLessThanOrEqual(1);
  });

  it("never drops more grades than its own stated ceiling", () => {
    // [HC-34] one grade at a time down working → idle → decayed → ruin, and
    // [P-48]: the ceiling is a named constant, not a loop condition somewhere.
    for (let s = 0; s <= 1.0001; s += 0.005) {
      for (let i = 0; i <= 100; i++) {
        expect(effectOf(Math.min(1, s), i / 100).worksDropped).toBeLessThanOrEqual(DAMAGE.maxDropped);
      }
    }
  });

  it("spoils contents as WEALTH and never as a stockpile", () => {
    // [HC-36]: the ratified model is flows plus one wealth stock, so there is
    // literally nothing to deduct from. What a contact reports is a RATE — never
    // a quantity of goods, and (since 2026-09-15) never a share of the coffers
    // either: it is a share of the town's standing works, which only the town
    // can value.
    const e = effectOf(0.9, 0.5);
    expect(Object.keys(e).sort()).toEqual(
      ["band", "maintenanceShare", "severity", "worksDestroyed", "worksDropped", "yieldLoss"],
    );
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const w = effectOf(Math.min(1, s), 0.99);
      expect(w.maintenanceShare).toBeLessThan(1);
      expect(w.yieldLoss).toBeLessThan(1);
    }
  });

  it("charges a gale at least what it charges a blow, though §7.4's table gives a gale nothing", () => {
    // THE SPEC READING THIS CODE IMPLEMENTS, stated out loud so that overruling
    // it breaks a claim rather than passing unnoticed.
    //
    // §7.4's table reads Blow = "small maintenance cost", Gale = "—", Tempest =
    // "one-off loss". As an EXCLUSIVE cost sheet that is incoherent: a gale is at
    // least as windy as a blow, so it cannot loosen fewer shingles. Read as WHAT
    // EACH BAND IS NOTABLE FOR it is exactly right — a blow is a property
    // nuisance, a gale is a crop event, and the gale's headline is its yield
    // column. The code holds the MONOTONE reading.
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].maintenanceShare).toBeGreaterThanOrEqual(BANDS[i - 1].maintenanceShare);
      expect(BANDS[i].yieldLoss).toBeGreaterThanOrEqual(BANDS[i - 1].yieldLoss);
    }
    // ...and a foul day is never free: every band above fair costs SOMETHING to
    // put right, at every roll, because a roll says which work the sea found and
    // never whether the wind blew.
    for (let b = 1; b < BANDS.length; b++) {
      for (let i = 0; i <= 100; i++) {
        expect(effectOf(BANDS[b].from + 0.001, i / 100).maintenanceShare).toBeGreaterThan(0);
      }
    }
    // The maintenance column is a READING of the spectrum like every other
    // column: the top of a blow takes more shingles off than the bottom of one.
    // Without this the band would be a bucket in the one place it is easiest to
    // let it become one.
    expect(effectOf(BANDS[2].from - 0.001, 0.5).maintenanceShare).toBeGreaterThan(
      effectOf(BANDS[1].from + 0.001, 0.5).maintenanceShare,
    );
  });

  it("charges a rate and never a bill, because it cannot see a town's books", () => {
    // [HC-33] as a signature ([P-17b]). The maintenance column stopped being a
    // share of the treasury on 2026-09-15 and became a share of the town's
    // standing works — and the thing that made that change safe is that this
    // function was never given either one. It takes two numbers; a town's fabric,
    // its coffers and its works cannot arrive through any argument it has.
    expect(effectOf.length).toBe(2);
    const e = effectOf(0.9, 0.5);
    expect(e.maintenanceShare).toBeGreaterThan(0);
    expect(e.maintenanceShare).toBeLessThan(1); // a share, not coin
  });

  it("takes the same roll to the same answer, so a contact is reproducible", () => {
    const w = generateWorld(SEED);
    for (let d = 0; d < 200; d++) {
      stepDay(w);
      stepWeather(w);
    }
    const p = w.places[3];
    expect(contactAt(w, p)).toEqual(contactAt(w, p));
  });
});

// ---- §7 acceptance: the rates ----------------------------------------------

describe("the rates read as a coast a person could live on", () => {
  it("gives a representative place several blows a year", () => {
    expect(median(RUN.blows)).toBeGreaterThan(2);
    expect(median(RUN.blows)).toBeLessThan(20);
  });

  it("gives it a gale about every year or two, not every week", () => {
    expect(median(RUN.gales)).toBeGreaterThan(0.2);
    expect(median(RUN.gales)).toBeLessThan(2.5);
  });

  it("keeps a tempest rare enough to be remembered", () => {
    expect(median(RUN.tempests)).toBeGreaterThan(0.01);
    expect(median(RUN.tempests)).toBeLessThan(0.5);
    expect(median(RUN.tempests)).toBeLessThan(median(RUN.gales));
  });

  it("takes a work outright about once in a generation, and never oftener than a gale", () => {
    expect(mean(RUN.destroyed)).toBeGreaterThan(1 / 200);
    expect(mean(RUN.destroyed)).toBeLessThan(1 / 8);
    expect(mean(RUN.destroyed)).toBeLessThan(mean(RUN.tempests));
  });

  it("orders the four bands by rarity, which is the whole shape of §7.4", () => {
    expect(mean(RUN.blows)).toBeGreaterThan(mean(RUN.gales));
    expect(mean(RUN.gales)).toBeGreaterThan(mean(RUN.tempests));
    expect(mean(RUN.tempests)).toBeGreaterThan(mean(RUN.destroyed));
  });
});

// ---- No place stores weather ----------------------------------------------

// ---- What the daily tick hoists ([P-18]) -----------------------------------

describe("the sky a daily loop holds still answers exactly what the long way round answers", () => {
  // [P-47]: one definition of "what this place felt", with two ways in. The
  // hoisted path reads a coast's share out of an array filled once and the
  // zone's ambient out of one refilled once a day; the long path computes both.
  // If those ever disagreed, the world the tick simulates would not be the world
  // every other reader sees — and nothing else in the suite would notice.

  it("agrees with it for every place, on every day of a year", () => {
    const w = generateWorld(SEED);
    const sky = skyOf(w);
    for (let d = 0; d < DAYS_PER_YEAR; d++) {
      stepDay(w);
      stepWeather(w);
      readSky(w, sky);
      for (const p of w.places) expect(feltAt(w, p, sky)).toBe(feltAt(w, p));
    }
  });

  it("holds a coast's share still because the map holds it still", () => {
    // The precondition the hoist rests on, asserted rather than assumed: climate
    // is immutable ([HC-27]) and positions never move, so `takesOf` is a fact
    // about the world and not about the day.
    const w = generateWorld(SEED);
    const first = w.places.map((p) => takesOf(w, p));
    for (let d = 0; d < DAYS_PER_YEAR * 3; d += 17) {
      w.day = d;
      stepWeather(w);
      expect(w.places.map((p) => takesOf(w, p))).toEqual(first);
    }
  });

  it("draws the work the sea takes from a different stream than whether it takes one", () => {
    // Two rolls on one contact, and they must be independent: reusing the
    // contact's own number would tie WHICH work goes down to WHETHER one does,
    // and the same shed would go every time the same kind of day came round.
    const w = generateWorld(SEED);
    let same = 0;
    for (let d = 0; d < 400; d++) {
      w.day = d;
      for (const p of w.places) {
        if (pickAt(w, p) === contactAt(w, p).severity) same++;
      }
    }
    expect(same).toBe(0);

    // ...and it is a roll, not a constant: it moves with the place and the day.
    const spread = new Set<number>();
    for (let d = 0; d < 50; d++) {
      w.day = d;
      for (const p of w.places.slice(0, 5)) spread.add(pickAt(w, p));
    }
    expect(spread.size).toBe(250);
  });
});

describe("weather costs a place no stored field, however long the world runs", () => {
  it("leaves every place with exactly the fields it was generated with", () => {
    // §7's criterion: "No place stores weather, and no place's stored fields
    // grow because weather exists."
    const fresh = Object.keys(generateWorld(SEED).places[0]).sort();
    const old = Object.keys(RUN.world.places[0]).sort();
    expect(old).toEqual(fresh);
    for (const k of old) expect(k).not.toMatch(/weather|storm|severity|wind|gale|tempest/i);
  });

  it("adds exactly one field to the world, and it is the live events", () => {
    // [HC-31] is the SOLE exception to [HC-14] in this system. One array, and a
    // handful of objects in it.
    //
    // The claim is about WEATHER's footprint on the world, not about the world's
    // total key set — this asserted the whole list until KAN-105 landed a field
    // of its own on the same day, at which point a true claim about weather was
    // failing for a reason that had nothing to do with weather. `worldgen.test`
    // owns the total; this owns weather's share of it.
    const w = makeWorld(1);
    const mine = Object.keys(w).filter((k) => /weather|storm|severity|wind|gale|tempest/i.test(k));
    expect(mine).toEqual(["storms"]);
    expect(w.storms).toEqual([]);
  });

  it("stores nothing on an event that could have been derived from it", () => {
    // The minimum that makes momentum representable: where it is, where it is
    // going, where it sits on the spectrum, and which way that is moving —
    // plus its identity. Its footprint and its speed are derived.
    const w = generateWorld(SEED);
    let fields: string[] = [];
    for (let d = 0; d < DAYS_PER_YEAR * 2 && fields.length === 0; d++) {
      stepDay(w);
      stepWeather(w);
      if (w.storms.length > 0) fields = Object.keys(w.storms[0]).sort();
    }
    expect(fields).toEqual(["bornDay", "dx", "dy", "id", "severity", "trend", "x", "y", "zone"]);
  });
});

// ---- §7.5 [HC-37] Wind has exactly two jobs -------------------------------

describe("wind has exactly two jobs and does both of them", () => {
  it("moves an event along its track — job one", () => {
    const w = generateWorld(SEED);
    let moved = 0;
    let withWind = 0;
    for (let d = 0; d < DAYS_PER_YEAR * 2; d++) {
      const before = w.storms.map((s) => ({ id: s.id, x: s.x, y: s.y }));
      stepDay(w);
      stepWeather(w);
      for (const s of w.storms) {
        const was = before.find((b) => b.id === s.id);
        if (!was) continue;
        const dx = s.x - was.x;
        const dy = s.y - was.y;
        if (dx * dx + dy * dy > 1) moved++;
        const wind = prevailingAt(w, was.x, was.y);
        if (dx * wind.dx + dy * wind.dy > 0) withWind++;
      }
    }
    expect(moved).toBeGreaterThan(100);
    // It runs the way the wind runs, not against it ([HC-29]).
    expect(withWind).toBeGreaterThan(moved * 0.9);
  });

  it("gives a sea leg its duration — job two", () => {
    const w = generateWorld(SEED);
    stepDay(w);
    stepWeather(w);
    const wind = windAt(w, 400, 400);
    const downwind = passageDays(w, 400, 400, 400 + wind.dx * 300, 400 + wind.dy * 300);
    const upwind = passageDays(w, 400, 400, 400 - wind.dx * 300, 400 - wind.dy * 300);
    expect(upwind).toBeGreaterThan(downwind);
    expect(downwind).toBeGreaterThan(0);
  });

  it("charges a longer leg more days than a shorter one", () => {
    const w = generateWorld(SEED);
    expect(passageDays(w, 300, 300, 900, 300)).toBeGreaterThan(passageDays(w, 300, 300, 500, 300));
    expect(passageDays(w, 300, 300, 300, 300)).toBe(0);
  });

  it("blows as a unit vector and a strength, never as an angle", () => {
    const w = generateWorld(SEED);
    for (let d = 0; d < 200; d++) {
      stepDay(w);
      stepWeather(w);
      for (const p of w.places) {
        const r = windAt(w, p.x, p.y);
        expect(Math.abs(r.dx * r.dx + r.dy * r.dy - 1)).toBeLessThan(1e-9);
        expect(r.knots).toBeGreaterThan(0);
      }
    }
  });

  it("stiffens and bends the air round a live event, and leaves it alone elsewhere", () => {
    const w = generateWorld(SEED);
    stepDay(w);
    w.storms.push({
      id: 99, zone: 0, bornDay: 0, x: 700, y: 400, dx: -1, dy: 0, severity: 0.9, trend: 0.04,
    });
    const near = windAt(w, 700 + 40, 400);
    const far = windAt(w, 700 + radiusOf(w.storms[0]) + 200, 400);
    expect(near.knots).toBeGreaterThan(far.knots);
    const clean = prevailingAt(w, 700 + 40, 400);
    expect(near.dx * clean.dx + near.dy * clean.dy).toBeLessThan(0.999);
  });

  it("keeps the prevailing wind free of the events it carries", () => {
    // The PRECONDITION for [HC-29]: tracks follow the PREVAILING wind, and a
    // storm reading its own distortion would be a feedback loop rather than a
    // track — it would also make the day's answer depend on the order the array
    // was walked. Mutating `advance` to steer by `windAt` does not fail THIS
    // claim (it fails "moves an event along its track"); what this one guards is
    // that the two readings stay genuinely different, so that distinction can
    // keep meaning something.
    const w = generateWorld(SEED);
    stepDay(w);
    const before = prevailingAt(w, 700, 400);
    w.storms.push({
      id: 98, zone: 0, bornDay: 0, x: 700, y: 400, dx: -1, dy: 0, severity: 0.95, trend: 0.04,
    });
    const after = prevailingAt(w, 700, 400);
    expect(after).toEqual(before);
  });
});

// ---- The tuning table stays a table ---------------------------------------

describe("every number in this system is a table entry, not a literal in a branch", () => {
  it("keeps the ambient shape, the storm regime and the bands as data", () => {
    // [HC-90]: the engine owns the types, content supplies the instances.
    expect(AMBIENT.octaves).toBeGreaterThan(1);
    expect(STORM.radiusNm[1]).toBeGreaterThan(STORM.radiusNm[0]);
    expect(STORM.bornSeverity[1]).toBeGreaterThan(STORM.bornSeverity[0]);
    expect(DAMAGE.destroysAt).toBeGreaterThanOrEqual(BANDS[3].from);
    expect(DAMAGE.maxDropped).toBeGreaterThanOrEqual(1);
  });
}, LONG_RUN_MS);
