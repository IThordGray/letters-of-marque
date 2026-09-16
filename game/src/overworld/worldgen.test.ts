// The generator, end to end — the map, the waves it founds in, and the eighty-odd
// years that stand between a cold world and day 0.
//
// [HC-22] says it in as many words: "the cheapest test of the whole generator is
// run the fresh world for twenty years and check nothing falls over." That test
// is at the bottom of this file and it is the one that matters.
//
// IT NOW RUNS THE RIGHT WORLD, and until KAN-99 it did not. It stepped each town
// ALONE — no weather, no trade, no clearing — so the cheapest test of the whole
// generator had never met the world the generator actually feeds. It goes through
// `runYears` now, which is the same driver the view calls, with storms landing on
// works and fifty markets clearing every season.
//
// AND IT IS TESTING A DIFFERENT GENERATOR. The warm start does not SOLVE a day-0
// ledger, it RUNS one: a cold world is founded in waves across the eighty-odd
// years before the epoch and driven forward to spring 1660. So every claim below
// about what day 0 holds is a claim about what the ordinary rules produced, which
// is [HC-22] satisfied by construction rather than by arithmetic.

import { describe, it, expect } from "vitest";
import { CALENDAR, DAYS_PER_YEAR, dayInSeason, startsSeasonOn, yearOfDay } from "./calendar";
import { yearOf } from "./clock";
import { inFlightCount } from "./dispatch";
import { FACTIONS } from "./factions";
import { makeMarkets, runYears } from "./market";
import { FOUNDING, SIZES, hinterlandAt, type Place } from "./places";
import { groundAt } from "./ground";
import { describeTimber, describeWorld, foundAll, foundPlace, generateWorld, warmStart } from "./worldgen";
import { derive, failureWord } from "../town/sim";
import { dependencyWord } from "../town/trade";
import { CATALOGUE } from "../town/works";
import { WORKS } from "../town/constants";

// THE HAMLET FLOOR IS NO LONGER A NUMBER (KAN-106). `POP.floor` was deleted for
// being a second number laid over the floor the catalogue already raises, so the
// threshold is spelled out here from what a garden plot costs and what a soul
// supplies. Below it the plot goes idle, the place feeds nobody, and it empties
// — so this is the line [HC-18] is really about, and it moves if either number
// is tuned.
//
// CORRECTED 2026-09-15: this is no longer one number for the whole world.
// Subsistence hands now scale with the ground — `def.hands * min(q, 1) * walk` —
// so a garden plot's threshold runs 3.82 souls (poor, at hand) to 14.73 (well
// suited, over the ridge), with the figure below being the well-suited plot
// close to home. It is therefore NEITHER the cheapest nor the dearest case, and
// the old comment calling it "the cheapest food work" described a quantity that
// no longer exists. The claim still has teeth — it is a deliberately strong bar
// that every generated place clears — but read it as one representative
// threshold, not as the floor.
const SOULS_TO_WORK_THE_GROUND = CATALOGUE.gardenPlots.hands / WORKS.labourShare;

const SEED = 1660;
const WORLD = generateWorld(SEED);

// ONE WARM WORLD, BUILT ONCE AND READ BY EVERY CLAIM THAT IS NOT ABOUT RUNNING
// IT ON. The pre-run is the real cost of the method (§6, and the measurement in
// `worldgen.ts`), so a file that built one per claim would be paying for a
// century a dozen times over to ask a dozen questions of the same day.
const WARM = warmStart(SEED);
const DAY0 = WARM.towns.map((t) => derive(t));

const holderOf = (p: Place) => WARM.world.nations[p.faction].faction;
const ageYears = (p: Place) => -p.foundedDay / DAYS_PER_YEAR;

// The oldest founding any holder's band permits, written out from the table
// rather than read back off a constant beside it. Nothing may be founded before
// this, because the pre-run starts at the first wave and a place founded earlier
// would never be run at all.
const OLDEST_BAND = Object.values(FOUNDING.years).reduce((a, b) => (b[0] > a ? b[0] : a), 0);

describe("one seed, one map", () => {
  it("generates the same map twice over, down to the last hex of ground", () => {
    // [HC-11]. Not "the same starting state" — the same world, so the same two
    // hundred years follow from it.
    expect(generateWorld(SEED)).toEqual(WORLD);
  });

  it("generates a different world from a different number, and from nothing else", () => {
    const other = generateWorld(SEED + 1);
    expect(other.places.map((p) => p.name)).not.toEqual(WORLD.places.map((p) => p.name));
    expect(other.shape.lobes).not.toEqual(WORLD.shape.lobes);
  });

  it("draws the map and then stops, without running a single day of it", () => {
    // The split KAN-99 kept rather than closed: `generateWorld` writes §6's
    // table and nothing else, so a claim that only wants a coastline does not
    // buy a century of history. The clock is at day zero and untouched.
    expect(WORLD.day).toBe(0);
    expect(yearOf(WORLD)).toBe(CALENDAR.epochYear);
    expect(WORLD.storms).toEqual([]);
    expect(inFlightCount(WORLD)).toBe(0);
  });

  it("writes everything §6 says it writes, and nothing it says it does not", () => {
    expect(WORLD.shape.lobes.length).toBeGreaterThan(0); // landmasses and coastlines
    expect(WORLD.zones.length).toBeGreaterThan(0); // climate zones
    expect(WORLD.places.length).toBeGreaterThan(0); // the ~50 positions
    expect(WORLD.nations.length).toBe(Object.keys(FACTIONS).length); // who holds what
    // ...and no heightmap, no tile grid, no place's land, and no AMBIENT weather.
    // Two fields joined this list on the same day and they are the only two
    // exceptions there will be: `dispatches`, the four war-currencies at sea
    // ([HC-13], cheap only because [P-16] makes a passage a departure and an
    // arrival), and `storms`, the live events that [HC-31] makes the one
    // sanctioned exception to [HC-14] because momentum is history.
    // The generator writes neither — a fresh world sails nothing and is calm.
    expect(Object.keys(WORLD).sort())
      .toEqual(["day", "dispatches", "nations", "places", "seed", "shape", "storms", "zones"]);
  });

  it("can say what it made, in one sentence", () => {
    // [HC-16]'s discipline turned on the generator itself. A world that cannot
    // be described is one nobody can check — and since KAN-99 the sentence has
    // to carry the waves too, because a map where every port was founded in the
    // same decade is a map that has flattened its one un-varying axis.
    const said = describeWorld(WORLD);
    expect(said).toContain(String(WORLD.places.length));
    expect(said).toContain(String(WORLD.zones.length));
    expect(said).toContain(String(CALENDAR.epochYear));
    expect(said).toMatch(/eldest was founded in \d{4} and the youngest in \d{4}/);
  });
});

describe("the places were founded in waves, and every date is before the world began", () => {
  it("dates every place before the epoch, which nothing in this project had ever written", () => {
    // The whole premise of the warm start: day 0 is the END of a history, so a
    // place's founding day is NEGATIVE. `calendar.ts` was built and tested for
    // this and nothing had ever exercised it — `Math.floor` rather than
    // `Math.trunc`, so day −1 is the last day of 1659 and not the first of 1660.
    for (const p of WORLD.places) {
      expect(p.foundedDay, p.name).toBeLessThan(0);
      expect(yearOfDay(p.foundedDay), p.name).toBeLessThan(CALENDAR.epochYear);
      expect(ageYears(p), p.name).toBeLessThanOrEqual(OLDEST_BAND);
    }
  });

  it("founds them on a season boundary, because the sim has two beats and only two", () => {
    // [HC-2]. A place founded between the beats would sit out its first harvest
    // for no reason anyone could name, and its age would not be a whole number
    // of the only period the ledger counts in.
    //
    // ASKED OF THE CALENDAR RATHER THAN OF THE REMAINDER, and the difference is
    // not stylistic: `-34560 % 90` is `-0`, because JavaScript's remainder keeps
    // the sign of its left operand. `startsSeasonOn` is the one thing the driver
    // asks before it runs a seasonal tick, so it is also the only definition of
    // "a season begins here" that matters ([P-47]) — and it is the function that
    // does the sign correction.
    for (const p of WORLD.places) {
      expect(startsSeasonOn(p.foundedDay), p.name).toBe(true);
      expect(dayInSeason(p.foundedDay), p.name).toBe(0);
    }
  });

  it("does not land the whole sea in one decade", () => {
    // The human's own requirement, and the reason waves exist at all: running a
    // world forward makes every place the same AGE unless something stops it.
    // So the spread is the claim, not the mean.
    const ages = WORLD.places.map(ageYears);
    const oldest = Math.max(...ages);
    const youngest = Math.min(...ages);
    expect(oldest - youngest).toBeGreaterThan(40);
    expect(new Set(WORLD.places.map((p) => p.foundedDay)).size).toBeGreaterThan(10);
  });

  it("puts the Iberian crowns on this sea before the northern ones", () => {
    // Age correlates with crown, which is the period truth and the ratified
    // default: old Spanish cities beside brand-new English and French footholds.
    // The bands OVERLAP, so this is a claim about the two groups and never about
    // any one pair of ports.
    const mean = (ids: string[]) => {
      const xs = WORLD.places.filter((p) => ids.includes(holderOf(p))).map(ageYears);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean(["spain", "portugal"])).toBeGreaterThan(mean(["england", "france", "netherlands"]) + 10);
  });

  it("makes a crown's seat the eldest thing it holds", () => {
    // The first foothold is where the crown planted itself and everything else
    // followed from it — which is also what makes [HC-62]'s authored cities read
    // as cities on day 0: they are designated AND they have had the longest to
    // become one. One decision showing up twice, not two decisions.
    for (const n of WARM.world.nations) {
      if (!n.crown || n.seat < 0) continue;
      const seat = WORLD.places[n.seat];
      for (const p of WORLD.places) {
        if (p.faction !== n.id) continue;
        expect(p.foundedDay, `${p.name} predates its own crown's seat`).toBeGreaterThanOrEqual(seat.foundedDay);
      }
    }
  });

  it("lets no place on the sea predate a crown's seat", () => {
    // The corollary, and it is what keeps the eldest thing on the map a great
    // port rather than a fishing village that happened to roll well.
    const seats = WARM.world.nations.filter((n) => n.crown && n.seat >= 0).map((n) => WORLD.places[n.seat]);
    const eldestSeat = Math.min(...seats.map((p) => p.foundedDay));
    for (const p of WORLD.places) expect(p.foundedDay, p.name).toBeGreaterThanOrEqual(eldestSeat);
  });

  it("keeps every founding inside the band its holder's crown permits", () => {
    // The roll must not escape its band in either direction, and the band must
    // be the HOLDER'S — a Dutch port founded out of Spain's band would read as
    // the period truth while being nothing of the kind. Both halves written out
    // from the table rather than read back off the function under test.
    for (const p of WORLD.places) {
      const [oldest, newest] = FOUNDING.years[holderOf(p)];
      expect(ageYears(p), `${p.name} predates its holder's band`).toBeLessThanOrEqual(oldest);
      expect(ageYears(p), `${p.name} postdates its holder's band`).toBeGreaterThan(newest - 0.25);
    }
  });
});

describe("founding a place on what the world gave it", () => {
  it("hands a town its ground rather than letting it invent one", () => {
    const town = foundPlace(WORLD, WORLD.places[0]);
    expect(town.regions.length).toBeGreaterThan(0);
    expect(town.land.length).toBeGreaterThan(0);
    expect(town.name).toBe(WORLD.places[0].name);
  });

  it("takes a town's own seed from the world, so no two are hand-picked alike", () => {
    // §10.4, and the last hand-picked number in the harness.
    const towns = WORLD.places.slice(0, 12).map((p) => foundPlace(WORLD, p));
    const seeds = towns.map((t) => t.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    for (let i = 0; i < towns.length; i++) expect(towns[i].seed).toBe(WORLD.places[i].seed);
  });

  it("leaves a neutral place without a patron, and therefore without a safety net", () => {
    // [HC-52]: a neutral place runs the full ledger with no grant behind it. It
    // lives on exactly what comes over its beach.
    const neutral = WORLD.places.find((p) => !WORLD.nations[p.faction].crown);
    expect(neutral, "this world has no neutral place at all").toBeDefined();
    const town = foundPlace(WORLD, neutral!);
    expect(town.grant).toBe(0);
    expect(town.patron.kind).toBe("none");
  });

  it("puts a crown behind a crown's place", () => {
    const held = WORLD.places.find((p) => WORLD.nations[p.faction].crown)!;
    const town = foundPlace(WORLD, held);
    expect(town.patron.kind).toBe("crown");
    expect(town.patron.name).toBe(FACTIONS[WORLD.nations[held.faction].faction].name);
  });

  it("founds every place on ITS OWN day, and dates its first huts to that day", () => {
    // The generator's half of KAN-107, now with the number that was always
    // meant to be there. It used to write `founded: yearOf(world)` — a YEAR into
    // a field the town did season arithmetic on; then the world's own day, which
    // was 0 for every place at once; and now the day the party actually landed.
    for (const p of WORLD.places.slice(0, 12)) {
      const town = foundPlace(WORLD, p);
      expect(town.foundedDay).toBe(p.foundedDay);
      expect(town.foundedDay).toBeLessThan(0);
      for (const w of town.works) expect(w.sinceDay).toBe(p.foundedDay);
    }
  });

  it("lands a party big enough to work its own ground, and nothing larger", () => {
    // REWRITTEN FROM "founds every place at a population its own ground can
    // feed" (KAN-99). That assertion was [HC-22]'s founding rule in its old
    // wording — `population <= food` — and the spec restated the rule on
    // 2026-09-16 precisely because it made a sea-fed city impossible by
    // construction while §6 demanded one. It is now a claim about the FOUNDING
    // PARTY rather than about the ledger: what the generator writes is how many
    // people came ashore, and what happens next is the pre-run's business.
    //
    // The floor is the one [HC-67] sets and it is spelled out above rather than
    // read off the sim: a party too small to man a garden plot feeds nobody and
    // the place empties on its own.
    for (const p of WORLD.places) {
      expect(p.population, `${p.name} landed too few to work its own ground`)
        .toBeGreaterThan(SOULS_TO_WORK_THE_GROUND);
      expect(p.population, `${p.name} landed more than its class ever sends`)
        .toBeLessThanOrEqual(SIZES[p.size].population[1] + 1e-9);
    }
  });

  it("raises the settlers' own huts the day they land, and not one thing more", () => {
    // What replaced `settleOpening`. The old founder ran a three-pass fixed-point
    // solver over `stepWorks` and `carryingCapacity` to find a steady state the
    // world no longer HAS — since trade landed the fixed point is coupled across
    // neighbours and stochastic in the weather — and it produced a town with no
    // capital work in it. The founder now does exactly what the hamlet floor
    // does every season ([HC-67]) and leaves the rest to the pre-run.
    const town = foundPlace(WORLD, WORLD.places[0]);
    expect(town.works.length).toBeGreaterThan(0);
    for (const w of town.works) {
      expect(CATALOGUE[w.kind].cls, `${w.kind} is not something settlers raise for themselves`)
        .toBe("subsistence");
    }
  });
});

describe("day 0 holds a world with a past", () => {
  it("runs the same eighty-odd years twice over, ledger for ledger", () => {
    // [HC-11] over the warm start itself. The pre-run is weather, trade, fifty
    // governors and a footprint, so if anything in it had drifted this is where
    // it would show.
    const again = warmStart(SEED);
    expect(again.towns.map((t) => t.population)).toEqual(WARM.towns.map((t) => t.population));
    expect(again.towns.map((t) => t.wealth)).toEqual(WARM.towns.map((t) => t.wealth));
    expect(again.towns.map((t) => t.works.length)).toEqual(WARM.towns.map((t) => t.works.length));
    expect(again.towns.map((t) => t.footprint.claimed.length)).toEqual(
      WARM.towns.map((t) => t.footprint.claimed.length),
    );
    expect(again.world.day).toBe(0);
  });

  it("ends on the first day of the epoch, with every place ashore", () => {
    expect(WARM.world.day).toBe(0);
    expect(WARM.towns.length).toBe(WARM.world.places.length);
    for (let i = 0; i < WARM.towns.length; i++) {
      expect(WARM.towns[i].regions.length, WARM.world.places[i].name).toBeGreaterThan(0);
      expect(WARM.towns[i].population, WARM.world.places[i].name).toBeGreaterThan(0);
    }
  });

  it("holds a visible spread of sizes, not fifty places at one number", () => {
    // The human's requirement, second half. Ground, market position, purpose,
    // age and sheer weather luck all differ, and the spread is what says so.
    const pops = WARM.towns.map((t) => t.population).sort((a, b) => a - b);
    expect(pops[pops.length - 1]).toBeGreaterThan(pops[0] * 8);
    expect(pops[Math.floor(pops.length * 0.75)]).toBeGreaterThan(pops[Math.floor(pops.length * 0.25)] * 2);
  });

  it("is no longer capped by the class that designated it", () => {
    // REWRITTEN FROM "exceeds its class" (KAN-99), which asserted
    // `population <= SIZES[size].population[1]` — 150 souls for a city. That was
    // a tautology about the generator's own roll AND a bar across everything
    // this story exists to build: §6 asks for "cities already cities" and the
    // human ratified a day-0 city at 450–600 souls. The class band is what a
    // founding party is, and day 0 is eighty years later.
    const biggest = Math.max(...WARM.towns.map((t) => t.population));
    const largestParty = Math.max(...Object.values(SIZES).map((s) => s.population[1]));
    expect(biggest).toBeGreaterThan(largestParty * 4);
  });

  it("has capital works standing on it, which it never did before", () => {
    // The works half of the story, and the scope pass's sharpest finding: with
    // `settleOpening` there was not ONE capital work anywhere in the world on
    // day 0, because it called `stepWorks` and never `governorTurn` and every
    // earner in the catalogue is capital-class. That is why nothing was ever fed
    // from the sea — a place with no earner has nothing to buy bread with.
    const capital = WARM.towns.map(
      (t) => t.works.filter((w) => CATALOGUE[w.kind].cls === "capital" && w.condition !== "ruin").length,
    );
    expect(capital.reduce((a, b) => a + b, 0)).toBeGreaterThan(WARM.towns.length);
    expect(capital.filter((n) => n > 0).length).toBeGreaterThan(WARM.towns.length * 0.5);
  });

  it("does not leave every place feeding itself, and the ones that do not are fed from the quay", () => {
    // REWRITTEN FROM "leaves every place feeding itself" (KAN-99), which
    // asserted `food >= mouths * 0.95` for every place in the world. A sea-fed
    // place has less food than mouths BY DESIGN ([HC-74]), so that assertion
    // forbade [HC-87a]'s cargo-funded appetite outright — the only mechanism by
    // which a place can ever be larger than its own ground will feed.
    //
    // Measured across four seeds at day 0: 4 / 0 / 0 / 1 places read "fed from
    // the sea". The SEED-INDEPENDENT half of the claim is the second one.
    const sea = WARM.towns.filter((_, i) => dependencyWord(DAY0[i].dependency) === "fed from the sea");
    expect(sea.length, "no place on this sea buys the greater part of its bread").toBeGreaterThan(0);
    for (const t of sea) {
      const d = derive(t);
      expect(d.food).toBeLessThan(d.mouths); // its own ground does not cover it...
      expect(t.population).toBeGreaterThan(SOULS_TO_WORK_THE_GROUND); // ...and it is standing anyway
      expect(d.access).toBeGreaterThan(0); // ...on a quay that works
    }
    const leaning = WARM.towns.filter((_, i) => DAY0[i].dependency > 0).length;
    expect(leaning, "not one place on the sea is larger than its own ground feeds").toBeGreaterThan(0);
  });

  it("founds a purse and then makes the place earn one", () => {
    // The founding rule for WEALTH, which [HC-22] demands and the generator did
    // not have: a class lands with a purse and everything after it is earned.
    // So day-0 wealth is nothing like the founding table — it spans orders of
    // magnitude, and the arbiter that it can service its upkeep is the
    // twenty-year gate below, not an arithmetic check here.
    const purses = Object.values(SIZES).map((s) => s.wealth);
    const coin = WARM.towns.map((t) => t.wealth).sort((a, b) => a - b);
    expect(coin[coin.length - 1]).toBeGreaterThan(Math.max(...purses) * 8);
    expect(new Set(WARM.towns.map((t) => t.wealth)).size).toBeGreaterThan(WARM.towns.length * 0.8);
  });

  it("has built over its own ground, rather than sitting on the hex it landed on", () => {
    // The fourth axis. The footprint is grown by `stepFootprint` across the
    // pre-run like everything else, so day 0 holds close-built ports with
    // quarters outside the original ground beside places still on one hex —
    // and "growth eats its own cause" has had eighty years to bite.
    const cores = WARM.towns.map((t) => t.footprint.core);
    const claimed = WARM.towns.map((t) => t.footprint.claimed.length);
    expect(new Set(cores).size).toBeGreaterThan(1);
    expect(Math.max(...cores)).toBeGreaterThan(0);
    expect(Math.max(...claimed)).toBeGreaterThan(1);
  });

  it("holds a spread of ages beside its spread of sizes", () => {
    // Both halves of the variety claim, together, because either alone is the
    // failure mode the other one hides: fifty ports the same age, or fifty ports
    // the same size.
    const ages = WARM.world.places.map(ageYears);
    expect(new Set(ages.map((a) => Math.round(a / 10))).size).toBeGreaterThan(3);
    const youngest = WARM.world.places.reduce((a, b) => (a.foundedDay > b.foundedDay ? a : b));
    const eldest = WARM.world.places.reduce((a, b) => (a.foundedDay < b.foundedDay ? a : b));
    expect(ageYears(eldest) - ageYears(youngest)).toBeGreaterThan(40);
    // ...and the eldest has had eighty years of works the youngest has not.
    expect(WARM.towns[eldest.id].works.length).toBeGreaterThan(WARM.towns[youngest.id].works.length);
  });
});

// ---- Every market can reach timber, and most places must buy it -------------
//
// RATIFIED 2026-09-16. Timber has no substitute: `sawpit` is the only work in
// the catalogue that produces materials, `shipway` requires a working sawpit,
// and NOTHING QUARRIES STONE — so a market neighbourhood with no timbered ground
// in it can never build anything, ever, which is [HC-87c]'s build gate firing
// correctly against a world with nowhere to buy from. Measured on master: 5, 8,
// 14 and 22 of a world's fifty neighbourhoods held no timber at all.
//
// THE GUARANTEE IS OWED TO THE MARKET AND NOT TO THE PLACE, which is the whole
// of the design: every place must be able to REACH timber; most must BUY it.
// A world where everybody grows his own planks has no plank trade in it, and
// that is the outcome the human rejected when he chose this over giving
// materials a second source.
//
// ONE SEED CANNOT SAY THIS. A claim about a covering over fifty places, asserted
// on one world, is a decoration — so every claim below is enumerated across a
// spread of seeds, and the count of seeds is asserted so a thinned list fails
// loudly rather than silently.
describe("every market can reach timber, and most places must buy it", () => {
  const SEEDS = [1660, 20260910, 7, 99, 1, 2, 42, 777];
  const worlds = SEEDS.map((s) => generateWorld(s));

  // What the ground bears, and what it WOULD have borne had the covering never
  // spoken — written out from the cut rather than read back off the flag, so a
  // grant that quietly did nothing cannot pass for one that worked.
  const bearsTimber = (w: typeof worlds[0], p: Place, granted = p.timberGranted) =>
    groundAt(w, { ...p, timberGranted: granted }).regions.some((r) => r.bears.timber !== undefined);

  it("is asked of a spread of worlds, not of one", () => {
    expect(worlds.length).toBeGreaterThan(4);
    for (const w of worlds) expect(w.places.length).toBeGreaterThan(40);
  });

  it("leaves no market on the map unable to reach a plank", () => {
    // THE CLAIM THE STORY EXISTS FOR.
    for (const w of worlds) {
      const bears = w.places.map((p) => bearsTimber(w, p));
      for (const h of makeMarkets(w.places).hoods) {
        expect(h.members.some((id) => bears[id]), `a market off ${w.places[h.id].name} cannot reach timber`)
          .toBe(true);
      }
    }
  });

  it("still leaves most of the world buying its planks rather than growing them", () => {
    // The other half, and the half that distinguishes this fix from the one the
    // human turned down. If every coast grew timber there would be no trade in
    // it — so a minority bear it, and the generator's own hand is smaller again
    // than what the map gave for nothing.
    for (const w of worlds) {
      const bears = w.places.filter((p) => bearsTimber(w, p)).length;
      const granted = w.places.filter((p) => p.timberGranted).length;
      expect(bears, "half the world grows its own planks").toBeLessThan(w.places.length / 2);
      expect(granted, "the generator planted more forest than the map did").toBeLessThan(bears - granted);
    }
  });

  it("plants no stand that was not needed, and none that another stand makes needless", () => {
    // [P-1] applied to a covering: the neighbourhoods OVERLAP ([HC-82]), so one
    // stand answers for several markets and granting one per market would put
    // timber behind half the coasts on the map. Every grant must therefore be
    // LOAD-BEARING, and the strong form of that is what is asserted — take any
    // one stand away and some market goes dark.
    //
    // THE WEAK FORM IS NOT ENOUGH, and a mutation proved it: "every grant
    // rescues a market the MAP left bare" survives a covering that walks the
    // places in order and takes the first that answers anything, because two
    // such grants can land in the same market and each of them still rescues a
    // market the map left bare. The strong form measures the stands against each
    // other, which is exactly what minimality means. Measured across 40 seeds:
    // 1 to 4 stands a world, not one of them redundant.
    for (const w of worlds) {
      const natural = w.places.map((p) => bearsTimber(w, p, false));
      const timber = w.places.map((p) => bearsTimber(w, p));
      const hoods = makeMarkets(w.places).hoods;
      for (const p of w.places) {
        if (!p.timberGranted) continue;
        expect(natural[p.id], `${p.name} was granted timber it already had`).toBe(false);
        const sole = hoods.some(
          (h) => h.members.indexOf(p.id) >= 0 && !h.members.some((id) => id !== p.id && timber[id]),
        );
        expect(sole, `${p.name}'s stand answers no market that another does not`).toBe(true);
      }
    }
  });

  it("can say what it did, in one sentence", () => {
    // [HC-16] turned on the covering. The second half of the sentence is the
    // one worth reading: it says whether any market was left without.
    for (const w of worlds) {
      expect(describeTimber(w)).toContain("Every market can reach a sawpit.");
    }
    expect(describeWorld(WORLD)).toContain("must buy their planks");
  });

  it("grants the same stands to the same seed, twice over", () => {
    // [HC-11]. The covering is a greedy solve over fifty places and it must be a
    // pure function of the seed, tie-breaks included.
    expect(generateWorld(SEED).places.map((p) => p.timberGranted))
      .toEqual(WORLD.places.map((p) => p.timberGranted));
  });

  it("does not change what a coast will FEED by giving it something to cut", () => {
    // THE INVARIANT THAT LICENSES THE ORDERING, and it is why the covering can be
    // solved after the classing rather than in the middle of it. `standingOf`
    // reads `hinterlandAt` to decide which harbours grew into great ports, and
    // `makePlaces` has to take that reading before the covering has spoken. It is
    // safe because the stand is cut out of ground that bears NO food and
    // `hinterlandOf` counts food and acreage and nothing else — so the two cuts
    // cannot disagree about the one number the classing actually reads.
    for (const p of WORLD.places) {
      const bare = hinterlandAt(WORLD, { ...p, timberGranted: false });
      const wooded = hinterlandAt(WORLD, { ...p, timberGranted: true });
      expect(wooded, `${p.name}'s hinterland moved when it was given a stand`).toBe(bare);
    }
  });
});

describe("the cheapest test of the whole generator, on the real driver", () => {
  // [HC-22], verbatim: "run the fresh world for twenty years and check nothing
  // falls over." THROUGH `runYears`, with the weather landing on works and fifty
  // markets clearing every season — the world the generator actually feeds.
  const YEARS = 20;
  const gate = warmStart(SEED);
  const opening = gate.towns.map((t) => t.population);
  const openWorks = gate.towns.map((t) => t.works.filter((w) => w.condition !== "ruin").length);
  runYears(gate.world, gate.towns, gate.markets, gate.wars, gate.routes, YEARS);
  const after = gate.towns.map((t) => derive(t));

  it("leaves every place able to work its own ground after twenty years", () => {
    // [HC-18] as the generator's problem rather than the ledger's: decline alone
    // may never empty a place, and the only thing standing between a place and
    // nothing is whether it can still man a garden plot.
    for (let i = 0; i < gate.towns.length; i++) {
      expect(gate.towns[i].population, `${gate.towns[i].name} collapsed`).toBeGreaterThan(SOULS_TO_WORK_THE_GROUND);
    }
  });

  it("leaves nothing abandoned and nothing bare of works", () => {
    for (const t of gate.towns) {
      expect(failureWord(t), `${t.name} was abandoned`).not.toBe("abandoned");
      expect(t.works.filter((w) => w.condition !== "ruin").length, `${t.name} has nothing standing`)
        .toBeGreaterThan(0);
    }
  });

  it("leaves the sea no smaller than it found it", () => {
    // REWRITTEN FROM "leaves no place smaller than the generator wrote it"
    // (KAN-99). That claim was right about a SOLVED opening — a ledger the
    // ordinary rules could not have produced shows up as a place that
    // immediately shrinks — and it is unwritable about a RUN one: day 0 is a
    // moment in a weather-beaten history, so individual places are going up and
    // down on the day it is taken. Measured over these twenty years, the worst
    // single place falls by a third while the sea as a whole grows.
    //
    // So the claim moves to the aggregate, where the generator's fault would
    // actually show: a warm start the rules could not sustain drains the whole
    // map, not one port of it.
    const before = opening.reduce((a, b) => a + b, 0);
    const now = gate.towns.reduce((a, t) => a + t.population, 0);
    expect(now).toBeGreaterThanOrEqual(before * 0.98);
    const standing = gate.towns.reduce((a, t) => a + t.works.filter((w) => w.condition !== "ruin").length, 0);
    expect(standing).toBeGreaterThanOrEqual(openWorks.reduce((a, b) => a + b, 0) * 0.9);
  });

  it("leaves no designated city starving or bankrupt of its own works", () => {
    // [HC-22]'s own words for the sharp end of it: "a city written at day 0 must
    // hold a ledger the ordinary rules could have produced and can sustain — its
    // works must feed its population, its wealth must service its upkeep."
    // FED, not self-feeding: a city may buy the greater part of its bread, and
    // the test of whether it can is that it is still standing twenty years on.
    for (let i = 0; i < gate.world.places.length; i++) {
      if (gate.world.places[i].size !== "city") continue;
      const t = gate.towns[i];
      const d = after[i];
      expect(d.food + t.market.bought[0], `${t.name} cannot cover its own mouths`)
        .toBeGreaterThan(d.mouths * 0.5);
      expect(t.population, `${t.name} collapsed`).toBeGreaterThan(opening[i] * 0.6);
      expect(failureWord(t), `${t.name} fell to the hamlet floor`).not.toBe("abandoned");
    }
  });

  it("lets the sea go on changing, so twenty quiet years are not twenty still ones", () => {
    // The liveness guard beside the stability claim above: "nothing fell over"
    // is also satisfied by a world in which nothing happened at all.
    const moved = gate.towns.filter((t, i) => Math.abs(t.population - opening[i]) > 1).length;
    expect(moved).toBeGreaterThan(gate.towns.length * 0.4);
  });

  it("runs the same twenty years twice over", () => {
    // [HC-11]: reproducible means the whole history, not the starting state.
    const again = warmStart(SEED);
    runYears(again.world, again.towns, again.markets, again.wars, again.routes, YEARS);
    expect(again.towns.map((t) => t.population)).toEqual(gate.towns.map((t) => t.population));
    expect(again.towns.map((t) => t.works.length)).toEqual(gate.towns.map((t) => t.works.length));
  });

  // §9's acceptance criteria, and which of them a world without nations can
  // answer. THE ONES THAT CANNOT BE REACHED HERE, named rather than left out:
  //
  //   * "at least one settlement is promoted, and its charter is observably
  //     dispatched, travels and arrives" — a charter is a dispatch and nothing
  //     sends one until KAN-101.
  //   * "a ruined place recovers only after a dispatch arrived" — the same.
  //   * "a place razed to nothing never recovers" — nothing razes anything yet.
  //
  // `run.test.ts` already pins the first of those from the other side: across a
  // century, nothing is promoted and nothing changes hands, and THAT CLAIM
  // SHOULD FAIL the day KAN-101 lands.

  it("promotes nothing and demotes nothing across twenty years", () => {
    // [HC-61] / [HC-62]: promotion is one-way, nothing is ever demoted, and no
    // town ever becomes a city. Size is a stored axis and only a charter's
    // arrival may write it, so twenty years of ledger must not move one.
    const fresh = generateWorld(SEED);
    for (let i = 0; i < gate.world.places.length; i++) {
      expect(gate.world.places[i].size, gate.world.places[i].name).toBe(fresh.places[i].size);
    }
  });

  it("never changes a place's purpose", () => {
    // [HC-56]: purpose is what a place IS. If it drifted, the axes would
    // describe nothing.
    const fresh = generateWorld(SEED);
    for (let i = 0; i < gate.world.places.length; i++) {
      expect(gate.world.places[i].purpose, gate.world.places[i].name).toBe(fresh.places[i].purpose);
    }
  });

  it("gives no place a stored field for a failure state", () => {
    // [HC-66]: all three failure states are readings of the ledger. A world run
    // twenty years must not have grown one — and the reading must still answer.
    for (const t of gate.towns) {
      const keys = Object.keys(t);
      for (const forbidden of ["poor", "ruined", "abandoned", "failure", "failed"]) {
        expect(keys, `${forbidden} must not be stored`).not.toContain(forbidden);
      }
      expect([null, "poor", "ruined", "abandoned"]).toContain(failureWord(t));
    }
  });
});

describe("a coast the settlers have not reached is not a town", () => {
  it("founds only what the day has come for, and leaves the rest empty", () => {
    // How the waves are actually run: the towns array is parallel to the places
    // from the first day of the pre-run, because the clearing indexes it by
    // place id. A slot whose day has not come holds nobody, no ground and no
    // patron — so it produces nothing, offers nothing, wants nothing and bids
    // nothing, and the clearing needs no rule about it ([P-17b]).
    const world = generateWorld(SEED);
    const eldest = Math.min(...world.places.map((p) => p.foundedDay));
    world.day = eldest;
    const towns = foundAll(world);
    const ashore = towns.filter((t) => t.population > 0);
    expect(ashore.length).toBeGreaterThan(0);
    expect(ashore.length).toBeLessThan(towns.length);
    for (let i = 0; i < towns.length; i++) {
      if (world.places[i].foundedDay <= eldest) continue;
      const t = towns[i];
      const d = derive(t);
      expect(t.population, `${t.name} has people before it was founded`).toBe(0);
      expect(t.works.length, `${t.name} has works before it was founded`).toBe(0);
      expect(t.grant, `${t.name} is drawing a grant before it was founded`).toBe(0);
      expect(d.access, `${t.name} is trading before it was founded`).toBe(0);
      expect(d.commerce.offer.reduce((a, b) => a + b, 0)).toBe(0);
      expect(d.commerce.want.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});
