// Weather — the world's only source of shocks, and very nearly the cheapest
// thing in it.
//
// Three layers, and keeping them apart is what makes the system both cheap and
// believable (§7):
//
//   · CLIMATE  written once, never changes. It is `climate.ts`, not this file.
//   · AMBIENT  a value every zone has every day. DERIVED, never stored.
//   · EVENTS   a local excursion far up the spectrum that TRAVELS. The only
//              weather that costs anything, and the only weather with state.
//
// [HC-30] Ambient weather is DERIVED, never stored — a pure function of
//         (world seed, zone, day), smooth day to day and seasonally biased by
//         the climate's baseline. Weather is never stored per place, which is
//         what keeps the three-numbers-per-place rule intact.
// [HC-31] A live event IS stored world state, and it is the SOLE exception to
//         [HC-14] in this system. It must be, because momentum is history: an
//         event that is building is not the same as an identical event that is
//         spending itself, and no pure function of (seed, day) can know which.
//         Its SPAWNING is still derived, so the same world breeds the same
//         storms.
// [HC-32] Severity is sampled at the place and the moment of contact, and
//         nowhere else. Two towns twenty miles apart may feel the same event
//         very differently, and that is the point.
// [HC-33] No code path may key an effect off "an event happened here". Effects
//         read the SAMPLED SEVERITY. See `effectOf` below, where the constraint
//         is stated as a function signature rather than as a rule to remember.
// [HC-29] Storm tracks follow the prevailing wind, not the player — so a coast's
//         exposure is a property of the map.
// [HC-37] In this milestone wind has exactly TWO jobs: move events along their
//         tracks (`stepWeather`) and give a sea leg its duration
//         (`passageDays`). No per-ship sailing model is in scope.
//
// [P-17]  Everything except the live events is a pure function of
//         (identity, time, seed) and is therefore computed on demand.
// [P-17a] There is not one angle in this file. A track, a course and a wind are
//         all stored as UNIT VECTORS, so "which way is it going" and "how much
//         of this wind is behind me" are a multiply and an add — and no banned
//         function ([P-5]) is needed either to use a bearing or to recover one.
//
// WHAT IS NOT HERE, deliberately: the town ledger. §7.4's bands say what a
// severity is WORTH, and this file computes that — but applying it to a place is
// a [HC-72] row, and [HC-6] splits it in two: damage is an EVENT and lands the
// day it happens, yield is a MODIFIER that accumulates into the season. Nothing
// here touches a town; `market.ts`'s daily tick is the wire, and the ledger
// takes the two rows in its own vocabulary (`takeWeather`).

import { CALENDAR, DAYS_PER_YEAR, seasonOfDay, type Season } from "./calendar";
import type { World } from "./clock";
import { CHANNEL, rollOf, seedFor } from "./chance";
import { baselineOf, climateOf, exposureOf, stormTrack, windOf, zoneAt, type Climate } from "./climate";
import { fbm } from "./noise";
import type { Place } from "./places";
import { PASSAGE, WORLD_BOX, distanceNm, isLandAt } from "./shape";

// ---- Small exact helpers ---------------------------------------------------
// Every one of these is `+ - * /` and `Math.floor`/`Math.sqrt`, all exactly
// specified by ECMA-262 ([P-7]).

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
// Smoothstep: zero slope at both ends, so nothing this shapes has a corner in it.
const smooth = (t: number): number => t * t * (3 - 2 * t);

// ---- The year, without a step in it ----------------------------------------
//
// The four rows of a climate's table describe four seasons, but the spectrum
// must be CONTINUOUS — §7's acceptance criteria say sampled severity over a year
// shows "no gaps or clustering into discrete states". Read the rows as steps and
// every zone's weather would jump on day 90, which is exactly a gap.
//
// So a season's row describes its MID-POINT, and any day between two mid-points
// reads a blend of the two rows either side. Spring's anchor is day 45; day 0 is
// half a season before it and reads three parts winter to one part spring.

const anchorPhase = (day: number): number => {
  const t = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  return t / CALENDAR.daysPerSeason - 0.5; // -0.5 .. 3.5, zero at spring's mid-point
};
const anchorFrom = (u: number): Season => ((((Math.floor(u) % 4) + 4) % 4) as Season);
const anchorNext = (s: Season): Season => (((s + 1) % 4) as Season);
const anchorMix = (u: number): number => smooth(u - Math.floor(u));

// ---- §7.2 Ambient — a spectrum, and free -----------------------------------
//
// There is no fair-or-storm switch: the zone is always somewhere on ONE
// spectrum, and a storm is that spectrum at its extreme rather than a separate
// kind of thing.

export const AMBIENT = {
  base: 0.1, // the floor: a settled, arid season with nothing happening
  fromWet: 0.08, // how far a sodden season lifts the middle of the spectrum
  fromRough: 0.12, // and how far a boisterous one lifts it
  swing: 0.26, // the day-to-day swing at its widest
  swingFloor: 0.14, // and the swing even the calmest season keeps
  waveDays: 11, // the weather field's lattice, in days
  octaves: 3, // 11, 5.5 and 2.75 days — weather at three cadences at once
} as const;

// A zone's own weather field. One avalanche of the world seed per zone, computed
// per call rather than per sample because a sample is three hashes anyway and a
// cache would be the memoising false economy performance.md warns about.
const fieldOf = (seed: number, zone: number): number => seedFor(seed, CHANNEL.weather, zone);

// The zone's weather on a day, on the 0..1 spectrum. [HC-30]: a pure function of
// (world seed, zone, day), stored nowhere, valid for any day past or future.
export function ambientAt(w: World, zone: number, day: number): number {
  const c = climateOf(w.zones, zone);
  const u = anchorPhase(day);
  const a = anchorFrom(u);
  const b = anchorNext(a);
  const f = anchorMix(u);
  const wet = lerp(baselineOf(c, a).wet, baselineOf(c, b).wet, f);
  const settled = lerp(baselineOf(c, a).settled, baselineOf(c, b).settled, f);
  // The season decides where the middle of the spectrum sits and how far the
  // days wander from it. A boisterous season is not merely wetter on average —
  // it is a season whose days disagree with each other.
  const centre = AMBIENT.base + AMBIENT.fromWet * wet + AMBIENT.fromRough * (1 - settled);
  const swing = AMBIENT.swingFloor + AMBIENT.swing * (1 - settled);
  const n = fbm(fieldOf(w.seed, zone), day, 0, AMBIENT.waveDays, AMBIENT.octaves);
  return clamp01(centre + (n - 0.5) * 2 * swing);
}

// ---- §7.5 Wind — and it has exactly two jobs ([HC-37]) ---------------------

export interface WindReading {
  dx: number; // a unit vector, pointing the way the wind BLOWS TO
  dy: number;
  knots: number;
}

export const WIND = {
  calm: 0.8, // the table's knots on the quietest day of a season
  fromAmbient: 0.8, // and how much a foul one adds
  swirl: 2.2, // how hard a live event bends the air around itself
  addedKnots: 55, // and how much it adds at its centre
} as const;

// The wind the CLIMATE says blows here today: the season's prevailing wind,
// blended across the anchors so it never snaps round on day 90, and stronger on
// a foul day than a fair one. No event is in this reading — [HC-29] says tracks
// follow the PREVAILING wind, and a storm that steered itself by its own
// distortion would be a feedback loop rather than a track.
export function prevailingAt(w: World, x: number, y: number): WindReading {
  const zone = zoneAt(w.zones, x, y);
  const c = climateOf(w.zones, zone);
  const u = anchorPhase(w.day);
  const a = anchorFrom(u);
  const b = anchorNext(a);
  const f = anchorMix(u);
  const wa = windOf(c, a);
  const wb = windOf(c, b);
  let dx = lerp(wa.dx, wb.dx, f);
  let dy = lerp(wa.dy, wb.dy, f);
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1e-9) {
    dx /= len;
    dy /= len;
  } else {
    dx = -1;
    dy = 0;
  }
  const knots = lerp(wa.knots, wb.knots, f) * (WIND.calm + WIND.fromAmbient * ambientAt(w, zone, w.day));
  return { dx, dy, knots };
}

// The wind a SAIL feels here today: the prevailing wind, bent and stiffened by
// any live event whose footprint covers the position. §7.5's "distorted locally
// near a live event", and the input to job two.
export function windAt(w: World, x: number, y: number): WindReading {
  const base = prevailingAt(w, x, y);
  let dx = base.dx;
  let dy = base.dy;
  let knots = base.knots;
  for (let i = 0; i < w.storms.length; i++) {
    const s = w.storms[i];
    const share = coverageOf(s, x, y);
    if (share <= 0) continue;
    const rx = x - s.x;
    const ry = y - s.y;
    const len = Math.sqrt(rx * rx + ry * ry);
    knots += share * s.severity * WIND.addedKnots;
    if (len < 1e-9) continue; // the eye: no radius, so no direction to run round
    // The air runs ROUND the centre. The perpendicular of the radial vector is
    // two negations and a swap ([P-17a]) — a rotation with no angle in it.
    const wgt = share * s.severity * WIND.swirl;
    dx += (-ry / len) * wgt;
    dy += (rx / len) * wgt;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1e-9) {
    dx /= len;
    dy /= len;
  }
  return { dx, dy, knots };
}

export const SAIL = {
  beat: 0.5, // made good dead to windward, as a share of the still-air ruler
  run: 1.4, // and with it dead astern
  airFloor: 0.55, // what a ship makes good in light airs
  fullKnots: 14, // the wind at which she is making her best
  foul: 0.4, // how much of her speed the worst weather costs her
  floorSpeed: 0.15, // she never quite stops, and a division never blows up
} as const;

// [HC-37] JOB TWO: a sea leg takes the time it takes. `daysToSail` in `shape.ts`
// is the still-air ruler — this is the same leg with the weather in it, and it
// is deliberately the whole of the sailing model this milestone has.
export function passageDays(w: World, ax: number, ay: number, bx: number, by: number): number {
  const nm = distanceNm(ax, ay, bx, by);
  if (nm <= 0) return 0;
  const cx = (bx - ax) / nm;
  const cy = (by - ay) / nm;
  // Both ends, because a leg is not a point. The course and the wind are both
  // unit vectors, so "how much of this is behind me" is one dot product.
  const a = windAt(w, ax, ay);
  const b = windAt(w, bx, by);
  const behind = (a.dx * cx + a.dy * cy + b.dx * cx + b.dy * cy) * 0.5; // -1 dead beat .. +1 running
  const knots = (a.knots + b.knots) * 0.5;
  const point = lerp(SAIL.beat, SAIL.run, (behind + 1) * 0.5);
  const air = SAIL.airFloor + (1 - SAIL.airFloor) * Math.min(1, knots / SAIL.fullKnots);
  const foul = 1 - SAIL.foul * Math.max(severityAt(w, ax, ay), severityAt(w, bx, by));
  const made = Math.max(SAIL.floorSpeed, PASSAGE.madeGoodKn * point * air * foul);
  return nm / (made * PASSAGE.hoursPerDay);
}

// ---- §7.3 Events — the only weather that costs anything --------------------
//
// [HC-31]: the sole stored state in this system, and every field below earns its
// place. Position and track say where it is and where it is going; severity says
// where it sits on the spectrum NOW; TREND is the momentum that no pure function
// could recover — whether this is a storm getting up or a storm blowing out.
// Identity is the other three: an event needs its own roll stream ([HC-10]), the
// zone whose regime bred it, and the day it formed, which is the whole of the
// history a chronicle ever wants.
//
// Everything else about an event is DERIVED: its footprint from its severity,
// its speed from the wind it is carried on.

export interface Storm {
  id: number;
  zone: number;
  bornDay: number;
  x: number;
  y: number;
  dx: number; // the track, as a unit vector — never an angle ([P-17a])
  dy: number;
  severity: number;
  trend: number; // per-day change: positive is building, negative is spending
}

export const STORM = {
  bornSeverity: [0.45, 0.62], // where on the spectrum an event starts
  bornTrend: [0.03, 0.07], // and how fast it gets up, per day
  spendRate: 0.85, // it blows out a little faster than it got up
  landSpend: 2.6, // and much faster once it is over land
  turnBase: 0.025, // the daily chance of topping out...
  turnBySeverity: 0.16, // ...which climbs steeply as it nears the top
  driftShare: 0.45, // it travels at this share of the wind that carries it
  steer: 0.14, // how much of the local wind its track takes per day
  wander: 0.07, // and the daily wobble on top of that
  formWobble: 0.3, // how far off the zone's track it is born pointing
  formJitterNm: 300, // and how far off the zone's seat it is born
  radiusNm: [90, 260], // its footprint, from a squall to a hurricane
  core: 0.55, // the inner share of that radius that feels the full weight
  strayNm: 420, // how far outside the world before it is somebody else's
} as const;

// Two disjoint id spaces on `CHANNEL.storm`, so a zone's spawn stream and a live
// event's own stream can never draw the same number on the same day.
const SLOT = { spawn: 0, storm: 1 << 20 } as const;
const ZONE_STRIDE = 16; // §7.1 puts four to eight zones on this sea; sixteen is room
const ATTRS = 8; // roll slots per zone per day, and per event per day

// A storm's identity: the day and the zone that bred it, which is unique because
// a zone breeds at most one event a day. Derived rather than counted, so it does
// not depend on how many storms have existed ([HC-10]).
const stormId = (zone: number, day: number): number => SLOT.storm + day * ZONE_STRIDE + zone;

// The footprint, derived from severity: a squall is small and a hurricane is not.
export const radiusOf = (s: Storm): number =>
  lerp(STORM.radiusNm[0], STORM.radiusNm[1], clamp01(s.severity));

// How much of this event is felt at a position, 0 outside the footprint to 1 at
// the centre. [HC-32]: "falling off from its centre" — and the fall-off is why
// two towns twenty miles apart feel the same event very differently.
export function coverageOf(s: Storm, x: number, y: number): number {
  const r = radiusOf(s);
  const dx = x - s.x;
  const dy = y - s.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  const f = 1 - Math.sqrt(d2) / r; // 0 at the rim, 1 at the centre
  const t = f / STORM.core;
  return t >= 1 ? 1 : smooth(t);
}

// ---- Forming ---------------------------------------------------------------

// [HC-31]: spawning is DERIVED from (world seed, zone, day), so the same world
// always breeds the same storms — and adding a fifty-first place, or a sixth
// nation, cannot shift a single one of them.
function formsIn(w: World, zone: number, day: number): Storm | null {
  const c = climateOf(w.zones, zone);
  // [HC-27] / "climate holds": the regime is a hard per-season fact and is NOT
  // blended. A dry coast records no rainstorm season in two hundred years
  // because there is no day on which the question is even asked.
  if (!c.storms.seasons[seasonOfDay(day)]) return null;
  const roll = (attr: number) => rollOf(w.seed, CHANNEL.storm, SLOT.spawn + zone * ATTRS + attr, day);
  if (roll(0) >= c.storms.perSeason / CALENDAR.daysPerSeason) return null;

  // [HC-29]: events form to WINDWARD of the zone and run the way the wind runs.
  // The zone's seat is where its weather belongs; the track says which way is
  // upwind of it, and `formsUpwindNm` says how far.
  const track = stormTrack(c);
  const px = -track.dy;
  const py = track.dx;
  const along = c.storms.formsUpwindNm * lerp(0.75, 1.25, roll(1));
  const across = (roll(2) - 0.5) * 2 * STORM.formJitterNm;
  const z = w.zones[zone];
  const wobble = (roll(3) - 0.5) * 2 * STORM.formWobble;
  let dx = track.dx + px * wobble;
  let dy = track.dy + py * wobble;
  const len = Math.sqrt(dx * dx + dy * dy);
  dx /= len;
  dy /= len;
  // One factory, every field present, in one order ([P-26]).
  return {
    id: stormId(zone, day),
    zone,
    bornDay: day,
    x: z.x - track.dx * along + px * across,
    y: z.y - track.dy * along + py * across,
    dx,
    dy,
    severity: lerp(STORM.bornSeverity[0], STORM.bornSeverity[1], roll(4)),
    trend: lerp(STORM.bornTrend[0], STORM.bornTrend[1], roll(5)),
  };
}

// ---- Living ----------------------------------------------------------------

// One day of one event: it moves along its track, and its severity walks up or
// down the spectrum as it goes.
function advance(w: World, s: Storm): void {
  const roll = (attr: number) => rollOf(w.seed, CHANNEL.storm, s.id, w.day * ATTRS + attr);

  // [HC-37] JOB ONE. The wind carries it, and the track bends toward the local
  // wind only a little a day — that lag IS the momentum, and it is why a storm
  // born on one coast's regime can still be running when it reaches another.
  const wind = prevailingAt(w, s.x, s.y);
  let dx = s.dx + (wind.dx - s.dx) * STORM.steer;
  let dy = s.dy + (wind.dy - s.dy) * STORM.steer;
  const wobble = (roll(0) - 0.5) * 2 * STORM.wander;
  dx += -s.dy * wobble;
  dy += s.dx * wobble;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1e-9) {
    s.dx = dx / len;
    s.dy = dy / len;
  }
  const run = wind.knots * PASSAGE.hoursPerDay * STORM.driftShare;
  s.x += s.dx * run;
  s.y += s.dy * run;

  // The severity walk. A storm that is building tops out either because it made
  // landfall — nothing feeds a storm over dry ground — or because it simply did,
  // and the higher it has climbed the likelier that is on any given day. Once it
  // is spending itself it never gets up again: that is what makes the trend
  // HISTORY rather than a per-day roll ([HC-31]).
  const aground = isLandAt(w.shape, s.x, s.y);
  if (s.trend > 0 && (aground || roll(1) < STORM.turnBase + STORM.turnBySeverity * s.severity)) {
    s.trend = -s.trend * STORM.spendRate;
  }
  s.severity = clamp01(s.severity + s.trend * (aground && s.trend < 0 ? STORM.landSpend : 1));
}

// An event is over when its severity falls back into the ambient range — §7.3's
// own words — or when it has run off the edge of the world.
function alive(w: World, s: Storm): boolean {
  if (
    s.x < -STORM.strayNm ||
    s.y < -STORM.strayNm ||
    s.x > WORLD_BOX.widthNm + STORM.strayNm ||
    s.y > WORLD_BOX.heightNm + STORM.strayNm
  ) {
    return false;
  }
  return s.severity > ambientAt(w, zoneAt(w.zones, s.x, s.y), w.day);
}

// §2.2 phase 1, and the whole of weather's daily work: "Each active system moves
// along its track and its severity moves along the spectrum — building or
// spending itself. Systems form and dissipate per the climate's rules."
//
// THE INVARIANT IS `w.day`, NOT A CALL ORDER: whatever else a driver does, the
// world's day must already BE the day being simulated when this runs. `runYears`
// holds that by simulating day `d` with `world.day === d` and stepping the clock
// at the foot of the loop, so the whole tick — seasonal and daily — agrees on
// which day it is standing on.
export function stepWeather(w: World): void {
  for (let i = 0; i < w.storms.length; i++) advance(w, w.storms[i]);
  // Struck off in place: no allocation in the daily tick ([P-24]) and the
  // survivors keep their order, so the array never records how it was walked.
  let keep = 0;
  for (let i = 0; i < w.storms.length; i++) {
    const s = w.storms[i];
    if (!alive(w, s)) continue;
    w.storms[keep] = s;
    keep++;
  }
  w.storms.length = keep;
  for (let zone = 0; zone < w.zones.length; zone++) {
    const born = formsIn(w, zone, w.day);
    if (born !== null) w.storms.push(born);
  }
}

// ---- §2.2 phase 2 — contact ------------------------------------------------

// [HC-32]: "the greater of the zone's ambient value and the contribution of any
// event whose footprint covers that position". The severity of the SEA at a
// position — what a ship in the open feels, and the raw number a coast then
// takes its own share of.
// The ambient half arrives as an argument, because the daily tick reads it once
// per ZONE and not once per place ([P-18]) — see `Sky` below. There is still one
// definition of "the greater of the two"; this is it.
export function severityWith(w: World, x: number, y: number, ambient: number): number {
  let worst = ambient;
  for (let i = 0; i < w.storms.length; i++) {
    const s = w.storms[i];
    const v = s.severity * coverageOf(s, x, y);
    if (v > worst) worst = v;
  }
  return worst;
}

export const severityAt = (w: World, x: number, y: number): number =>
  severityWith(w, x, y, ambientAt(w, zoneAt(w.zones, x, y), w.day));

export const EXPOSURE = {
  lee: 0.65, // what a coast in the lee of its own island still takes
  shelterRelief: 0.25, // and what a landlocked anchorage is spared on top of that
} as const;

// How much of the sea's weather this coast actually takes — a property of the
// MAP and of nothing else, which is [HC-29]'s reason for existing: "where a
// place sits is a decision with consequences."
//
// `exposureOf` is the single source of that fact ([P-47]); it answers in units
// that bundle the zone's storm regime in with the coast's bearing, so this reads
// it TWICE and divides — the regime cancels and what is left is the pure
// question, how windward is this coast against the most exposed coast its own
// zone has. Shelter is the second, smaller relief: a bay head is spared what an
// open beach is not.
export function takesOf(w: World, p: Place): number {
  const c = climateOf(w.zones, p.zone);
  const t = stormTrack(c);
  const most = exposureOf(c, -t.dx, -t.dy);
  const windward = most > 1e-9 ? clamp01(exposureOf(c, p.sx, p.sy) / most) : 1;
  return (EXPOSURE.lee + (1 - EXPOSURE.lee) * windward) * (1 - EXPOSURE.shelterRelief * p.shelter);
}

// ---- What the daily tick may hoist, and nothing else ([P-18]) --------------
//
// [P-2] is complexity x TICK RATE, and §2.2 phase 2 is the highest-rate loop in
// the game: fifty places, every one of seventy-three thousand days. Two of the
// numbers it reads per place per day do not vary per place per day at all:
//
//   · `takes` — how much of the sea's weather a coast is owed. A pure function
//     of the place's bearing and its zone's regime, and climate is IMMUTABLE
//     ([HC-27]) while positions never move. It is therefore fixed FOR THE RUN,
//     and `takesOf` runs `stormTrack` three times and two reductions to say so.
//   · `ambient` — the zone's own weather today. Per ZONE per day, and there are
//     four to eight zones against fifty places, so computing it per place pays
//     the same fbm six times over.
//
// This is [P-18] (an invariant computed once per scope) and NOT the memoising
// §5 calls a false economy: there is no key, no lookup and no staleness — the
// scope is the run for one array and the day for the other, and both are
// refilled from the same pure functions everything else reads. It is also why
// this is a scratch the DRIVER owns rather than world state: nothing here is
// stored ([HC-30]), it is only held still for the length of a loop.
export interface Sky {
  takes: Float64Array; // per place, in place order — fixed for the whole run
  ambient: Float64Array; // per zone — refilled once a day
}

// [P-30]: a typed array cannot go holey, and [P-36] says reach for one where the
// buffer is fixed-size and numeric. Built once, before the first day.
export function skyOf(w: World): Sky {
  const takes = new Float64Array(w.places.length);
  for (let i = 0; i < w.places.length; i++) takes[i] = takesOf(w, w.places[i]);
  return { takes, ambient: new Float64Array(w.zones.length) };
}

// The day's ambient, once per zone. Call it on the day being simulated, before
// anything reads a contact.
export function readSky(w: World, sky: Sky): void {
  for (let z = 0; z < w.zones.length; z++) sky.ambient[z] = ambientAt(w, z, w.day);
}

// The severity felt AT A PLACE, on the day the world is standing on. This is the
// sampling [HC-32] describes and the only number an effect is ever allowed to
// read.
//
// ONE DEFINITION, two ways in ([P-47]). Handed a `Sky` it reads the two hoisted
// numbers; handed none it computes them, which is what every reader outside the
// daily loop wants. A place's stored `zone` IS `zoneAt(p.x, p.y)` — the
// generator writes it from that call and a claim in `places.test.ts` holds it
// there — so the two paths cannot disagree.
export function feltAt(w: World, p: Place, sky: Sky | null = null): number {
  const ambient = sky === null ? ambientAt(w, zoneAt(w.zones, p.x, p.y), w.day) : sky.ambient[p.zone];
  const takes = sky === null ? takesOf(w, p) : sky.takes[p.id];
  return severityWith(w, p.x, p.y, ambient) * takes;
}

// ---- §7.4 The bands — what severity actually does --------------------------
//
// [HC-90]: the DEFINITIONS are a table, only the BEHAVIOUR is code. The numbers
// below are tuning; the sentences beside them are the specification.
// [HC-91]: `BandId` comes FROM the table, never the other way round.

// THE MAINTENANCE COLUMN IS PRICED AGAINST WHAT A TOWN HAS TO MAINTAIN, not
// against what is in its coffers (ratified 2026-09-15). It used to be a share of
// the treasury, which made the same broken fence cost a thousand times more in a
// rich town than in a poor one and turned §7.4's "small maintenance cost" into a
// proportional ceiling on wealth — measured at roughly a fifth of every treasury
// in the world, every year, for ever. A fence costs what a fence costs; what
// varies between two towns is HOW MUCH FENCE THERE IS.
//
// So `maintenanceShare` is a share of the STANDING WORKS' RAISING COST — the
// town's fabric, valued in the coin that raised it. This file still hands out a
// RATE and nothing else: the town turns it into coin out of its own books, which
// is what keeps [HC-33] a signature rather than a rule ([P-17b]).
//
// THE ARITHMETIC BEHIND EACH ROW, derived from §7.4's sentences and written out
// so the next person can disagree with the reasoning rather than with a number.
// Every band is the same product:
//
//     rate = (how much of the fabric the day's weather finds)
//          x (what putting that right costs, as a share of raising it)
//
//   blow     a tenth of it — a gate here, a fence there — and a hundredth of
//            raising each: nails, a plank, half a day. 0.10 x 0.01 = 0.001
//   gale     a fifth: the same shingles, off more roofs, because it is windier.
//            0.20 x 0.01 = 0.002
//   tempest  a third, and a tenth of raising each: a wall down, a roof off, and
//            what was in store lost with it. 0.33 x 0.10 = 0.033
//
// [HC-36] survives the change unaltered — "contents spoil" is still a WEALTH
// loss and still never a stockpile deduction, because there is still no stock.
// What moved is only what the loss is a share OF.
//
// A GALE IS GIVEN A MAINTENANCE COST, AND §7.4'S TABLE SAYS `—`. Read as an
// exclusive cost sheet that table is incoherent: a gale is at least as windy as
// a blow, so it cannot loosen fewer shingles. Read as WHAT EACH BAND IS NOTABLE
// FOR it is exactly right — a blow is a property nuisance, a gale is a crop
// event — and that is the reading here. The rule the code holds is MONOTONE:
// further up the spectrum never costs less, in any column. Flagged rather than
// hidden; the human may overrule it.
export const BANDS = [
  // Ordinary weather. Costs nothing, and most days are this.
  { id: "fair", from: 0, maintenanceShare: 0, yieldLoss: 0, drops: 0 },
  // "Loose roof shingles, a broken gate or fence." Common — several a year.
  { id: "blow", from: 0.24, maintenanceShare: 0.001, yieldLoss: 0.02, drops: 0 },
  // "A downpour on the fields" — a surplus of 100 becomes 70. Every year or two.
  { id: "gale", from: 0.4, maintenanceShare: 0.002, yieldLoss: 0.11, drops: 0 },
  // "The warehouse falls over and its contents spoil." Rare, and memorable.
  { id: "tempest", from: 0.52, maintenanceShare: 0.033, yieldLoss: 0.2, drops: 1 },
] as const;

export type BandId = (typeof BANDS)[number]["id"];

export const DAMAGE = {
  // The extreme tail: generational, and it takes exactly ONE work ([HC-35]).
  destroysAt: 0.56,
  destroyChance: 0.16,
  // A grade is not owed either. Severity says how likely, the roll says whether.
  dropChance: 0.7,
  secondGradeAt: 0.58, // deep in the band, a second work goes down a grade too
  maxDropped: 2, // the ceiling, hoisted out of any loop condition ([P-48])
  bandFloorShare: 0.35, // what the bottom of a band bites, against its top
} as const;

// The band a severity reads as, as an index into BANDS. A reading of a
// continuous value, never a bucket the value falls into.
export function bandAt(severity: number): number {
  let band = 0;
  for (let i = 1; i < BANDS.length; i++) {
    if (severity >= BANDS[i].from) band = i;
  }
  return band;
}

export const bandIdAt = (severity: number): BandId => BANDS[bandAt(severity)].id;

// How deep into its own band a severity sits, 0 at the floor and 1 at the next
// band's. This is what stops a band being a bucket: the top of a gale hurts
// nearly three times what the bottom of one does.
function depthInto(severity: number, band: number): number {
  const from = BANDS[band].from;
  const to = band + 1 < BANDS.length ? BANDS[band + 1].from : 1;
  return to > from ? clamp01((severity - from) / (to - from)) : 1;
}

// What a day's weather is worth at one contact.
export interface Weather {
  severity: number;
  band: BandId;
  // A share of the season's yield, LOST. [HC-6]: a modifier, accumulated into
  // the season's harvest and applied once when the season resolves — a downpour
  // does not reach into a ledger that has not been struck yet.
  yieldLoss: number;
  // The day's maintenance bill, as A SHARE OF WHAT THE TOWN'S STANDING WORKS
  // COST TO RAISE — its fabric — and NOT as a share of coin on hand. It is paid
  // in wealth once, on the day, because [HC-36] says "contents spoil" is a wealth
  // loss and never a stockpile deduction; what it is a share OF is the town's
  // works, so the same storm sends the same bill to a rich town and a poor one.
  // This file cannot value a town's works and must not learn to: it emits the
  // rate, the ledger does the multiplying ([HC-33], [P-17b]).
  maintenanceShare: number;
  // Grades down the existing ladder — working → idle → decayed → ruin — one at a
  // time, never skipping to ruin ([HC-34]).
  worksDropped: number;
  // Zero or one. Never a sweep: razing is deliberate and wholesale, the storm is
  // random and singular ([HC-35]).
  worksDestroyed: number;
}

// [HC-33] STATED AS A SIGNATURE, which is the only way a rule like this survives
// contact with a codebase.
//
// This function cannot see a storm. It cannot ask whether one was involved, how
// close it came, or whether it was building. All it is given is the severity
// that was sampled at the place at the moment of contact ([HC-32]) and one
// derived roll for what the spectrum leaves to chance. So "nothing is owed
// damage merely because a storm arrived" is not a discipline anyone has to
// remember — there is no argument through which the fact could arrive. The same
// event is a wet week at sea and a ruinous landfall four days later, or nothing
// at all because it came already spent, and that falls out of the severity alone.
export function effectOf(severity: number, roll: number): Weather {
  const band = bandAt(severity);
  const row = BANDS[band];
  const bite = DAMAGE.bandFloorShare + (1 - DAMAGE.bandFloorShare) * depthInto(severity, band);
  let dropped = 0;
  if (row.drops > 0 && roll < DAMAGE.dropChance * bite) {
    dropped = severity >= DAMAGE.secondGradeAt ? DAMAGE.maxDropped : row.drops;
  }
  return {
    severity,
    band: row.id,
    // A Blow "may nick it" and a Gale is a real hit: the same shape, read at two
    // heights on one spectrum.
    yieldLoss: row.yieldLoss * bite,
    maintenanceShare: row.maintenanceShare * bite,
    worksDropped: dropped,
    worksDestroyed: severity >= DAMAGE.destroysAt && roll < DAMAGE.destroyChance ? 1 : 0,
  };
}

// The contact §2.2 phase 2 resolves for one place on one day. The roll is
// derived from (world seed, place, day) like everything else ([HC-10]), so the
// same world does the same damage however the places are walked.
//
// [P-14]: most days are Fair and warrant nothing at all. A daily loop should ask
// `bandAt(feltAt(...)) > 0` and only call this when the answer is yes.
const CONTACT_SLOT = 1 << 16; // disjoint from the ambient field's ids on this channel
const PICK_SLOT = 1 << 17; // ...and disjoint from the contact's own roll

export const contactAt = (w: World, p: Place, sky: Sky | null = null): Weather =>
  effectOf(feltAt(w, p, sky), rollOf(w.seed, CHANNEL.weather, CONTACT_SLOT + p.id, w.day));

// A SECOND derived roll on the same contact, for the one thing the sampled
// severity cannot answer: which work the sea found. It is deliberately not the
// contact's own roll — reusing that number would tie *which* work is taken to
// *whether* one is, and a storm that always took the same shed on the same kind
// of day is not random and singular ([HC-35]).
//
// It is not an input to `effectOf` and never can be: that signature is [HC-33]
// stated as a type, and a roll for choosing among works says nothing about
// whether a storm was overhead.
export const pickAt = (w: World, p: Place): number =>
  rollOf(w.seed, CHANNEL.weather, PICK_SLOT + p.id, w.day);

// ---- Reading it back -------------------------------------------------------

// [HC-16]'s discipline applied to weather: a line a person can check the system
// against. Prose belongs to the presentation layer, but a system that cannot say
// what it is doing cannot be verified by reading a headless run either.
export function describeStorm(w: World, s: Storm): string {
  const c: Climate = climateOf(w.zones, s.zone);
  const age = w.day - s.bornDay;
  return (
    `a ${bandIdAt(s.severity)} off ${c.name}, ${age} ${age === 1 ? "day" : "days"} old, ` +
    `${s.trend > 0 ? "building" : "spending itself"}, ` +
    `${Math.round(radiusOf(s))} nm across the worst of it`
  );
}
