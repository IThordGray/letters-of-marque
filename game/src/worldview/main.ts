// The world map view — the third entry point. `npm run dev`, then /world.html.
//
// KAN-100. The first thing in this project anyone has ever LOOKED at: everything
// else is proven headless, and this is the screen a person watches a century on
// to judge whether it reads as plausible. The ratified one-line picture of
// success is "fifty dots that grow, shrink and change colour, with storms
// crawling across them" — and two thirds of that sentence is honestly out of
// reach today, because colour is faction and class is a charter and both change
// only by a dispatch, and nothing sends one until KAN-101 (decisions.md,
// 2026-09-14). So: the dots grow and shrink, the storms crawl, and the two seams
// that will one day move are drawn and empty rather than hidden.
//
// [HC-21] The step-buttons stay in the single-town harness. `town.html` is
//         untouched; this page gets the running clock.
// [HC-1]  No engine system may ever prompt the player, and the human's brief for
//         this milestone is NO PLAYER INTERACTION. So the whole of the input
//         here is INSPECTION: pan, zoom, pause, speed, and click a port for a
//         read-only card. There is no verb on this page. Nothing changes a live
//         world; the seed box builds a different one from day 0, which is not
//         the same thing.
// [HC-20] Pause is a first-class speed and a paused world is fully inspectable.
// [P-11]  THE ONLY FILE IN THE PROJECT THAT READS A WALL CLOCK, and it may
//         because it is in `worldview/`. `guardrails.test.ts` discovers every
//         file under `overworld/` and forbids exactly this; keeping the loop out
//         of that directory is what lets both rules stay absolute instead of
//         growing an exception list.
// [P-2]   Nothing derived is computed per frame. `derive()`, `summarise()` and
//         `wants()` run on the seasonal beat, in `run.ts`, and for the selected
//         place only; the DOM is rebuilt when a mark changes, not when a frame
//         happens; the trend redraws once a simulated year. A frame reads stored
//         numbers and issues `ctx` calls.

import { CALENDAR } from "../overworld/calendar";
import { describeWorld } from "../overworld/worldgen";
import { FACTIONS, FACTION_IDS } from "../overworld/factions";
import { DEFAULT_WORLD, type WorldSettings } from "../overworld/shape";
import { describeStorm } from "../overworld/weather";
import { bakeCoast } from "./coastline";
import {
  ZOOM,
  clampTo,
  fitScale,
  fitTo,
  pickAt,
  panBy,
  zoomAbout,
  type Camera,
} from "./camera";
import { drawTrend, drawWorld, makeChart, radiusFor, type Chart } from "./draw";
import { RATES, advance } from "./pace";
import { FACTION_INK, TREND_INK } from "./palette";
import {
  century,
  countByClass,
  dateOf,
  describeNotable,
  makeRun,
  pump,
  select,
  totalCoin,
  totalPeople,
  type Run,
} from "./run";
import { spanOf, stillClimbing } from "./trend";

const FIT_PAD_PX = 26;

// ---- The page --------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const mapCanvas = $<HTMLCanvasElement>("map");
const trendCanvas = $<HTMLCanvasElement>("trend");
const ctx = mapCanvas.getContext("2d")!;
const trendCtx = trendCanvas.getContext("2d")!;

const elDate = $("date");
const elWorldLine = $("worldline");
const elWorldStat = $("worldstat");
const elWorldDesc = $("worlddesc");
const elRates = $("rates");
const elRateBlurb = $("rateblurb");
const elFeed = $<HTMLUListElement>("feed");
const elCard = $("card");
const elTrendKey = $("trendkey");
const elLegend = $("legend");
const elSeed = $<HTMLInputElement>("seed");

// ---- What sea to chart, and what the page remembers ------------------------
//
// THE WHOLE OF THE PERSISTENCE, and it is deliberately the smallest thing that
// survives a reload: the numbers in the boxes, in `localStorage`, written once a
// world has actually been built out of them. No presets, no schema, no version
// and nothing to migrate — anything missing or unreadable is answered with the
// default sea rather than argued with, because this is a testing site and a
// person who wants his world back can type six numbers.
//
// [HC-1]: NOT A VERB ON A LIVE WORLD. Every one of these builds a new world from
// day 0 down the same path the seed box already used; none of them reaches into
// a simulation that is running.
const STORE = "lom.world";

const elBoxes = {
  widthNm: $<HTMLInputElement>("widthNm"),
  heightNm: $<HTMLInputElement>("heightNm"),
  isles: $<HTMLInputElement>("isles"),
  towns: $<HTMLInputElement>("towns"),
  crowns: $<HTMLInputElement>("crowns"),
} as const;

// A box holds a whole number or it holds nothing worth reading.
function readBox(el: HTMLInputElement, fallback: number): number {
  const v = Number(el.value);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

// KEPT BESIDE ITS SIBLING, AND THAT IS THE FIX RATHER THAN A TIDY. This sat
// below the `let run = openWorld()` that starts the page, and a `const` is in
// the temporal dead zone until its own line runs — so opening the page threw
// "Cannot access 'readSeed' before initialization" before a pixel was drawn.
// It typechecks and the suite is green either way: `tsc` does not order
// module-level initialisers, and `testing.md` forbids DOM tests, so nothing
// executes this file. The two box-readers belong together.
const readSeed = (): number => readBox(elSeed, 1660);

const readSettings = (): WorldSettings => ({
  widthNm: readBox(elBoxes.widthNm, DEFAULT_WORLD.widthNm),
  heightNm: readBox(elBoxes.heightNm, DEFAULT_WORLD.heightNm),
  isles: readBox(elBoxes.isles, DEFAULT_WORLD.isles),
  towns: readBox(elBoxes.towns, DEFAULT_WORLD.towns),
  crowns: readBox(elBoxes.crowns, DEFAULT_WORLD.crowns),
});

// What was remembered, or nothing at all. A broken store is the same as no store.
function remembered(): Record<string, unknown> {
  try {
    const held: unknown = JSON.parse(localStorage.getItem(STORE) ?? "");
    return held !== null && typeof held === "object" ? (held as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Fill the boxes from it, falling back to the default sea field by field.
function fillBoxes(held: Record<string, unknown>): void {
  const put = (el: HTMLInputElement, key: string, fallback: number) => {
    const v = held[key];
    el.value = String(typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback);
  };
  put(elSeed, "seed", 1660);
  for (const key of Object.keys(elBoxes) as (keyof typeof elBoxes)[]) {
    put(elBoxes[key], key, DEFAULT_WORLD[key]);
  }
}

fillBoxes(remembered());

// ---- View state — and every bit of it lives HERE ---------------------------
//
// [HC-26] Looking must not change what is true. The camera, the selection and
// the speed are all in this file; not one of them is ever passed to a function
// in `overworld/`, and `camera.ts` is not even given a world to pass one to.
// The companion source scan in `coastline.test.ts` asserts the other direction.
let run: Run = openWorld();
let chart: Chart = makeChart(run.world, bakeCoast(run.world.shape));
// Deliberately NOT fitted here: the canvas has no size until the page has laid
// itself out, and a fit computed against a canvas of nothing is a scale of
// nothing. `resize()` runs before the first frame and does the first fit; after
// that it clamps instead, so a browser window dragged wider keeps the zoom the
// person chose rather than springing back to the whole sea.
let cam: Camera = { x: 0, y: 0, scale: 1, w: 1, h: 1 };
let fitted = false;
let rateIndex = 0; // Pause. A world you have not asked to run does not run.
let carry = 0;
let dpr = 1;
let drawnFeed = -1;
let drawnTrend = -1;
let drawnSeason = -1;

// The sea the boxes ask for — or the default one, if what they ask for is a
// world the physics will not build (`refuseTheImpossible`). The boxes are put
// back to the default too, so the page never shows numbers it is not drawing.
function openWorld(): Run {
  try {
    return makeRun(readSeed(), readSettings());
  } catch {
    fillBoxes({});
    return makeRun(readSeed(), readSettings());
  }
}

// ---- Layout ----------------------------------------------------------------

function resize(): void {
  dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const box = mapCanvas.getBoundingClientRect();
  const w = box.width > 0 ? box.width : 1;
  const h = box.height > 0 ? box.height : 1;
  mapCanvas.width = Math.round(w * dpr);
  mapCanvas.height = Math.round(h * dpr);
  cam = fitted
    ? clampTo({ ...cam, w, h }, run.world.shape.widthNm, run.world.shape.heightNm, minScale(w, h))
    : fitTo(w, h, run.world.shape.widthNm, run.world.shape.heightNm, FIT_PAD_PX);
  fitted = true;

  const tb = trendCanvas.getBoundingClientRect();
  trendCanvas.width = Math.round((tb.width > 0 ? tb.width : 1) * dpr);
  trendCanvas.height = Math.round((tb.height > 0 ? tb.height : 1) * dpr);
  drawnTrend = -1;
}

const minScale = (w: number, h: number): number =>
  fitScale(w, h, run.world.shape.widthNm, run.world.shape.heightNm, FIT_PAD_PX);

// ---- Time ------------------------------------------------------------------

function buildRates(): void {
  elRates.innerHTML = "";
  RATES.forEach((r, i) => {
    const b = document.createElement("button");
    b.textContent = r.perSecond > 0 ? `${r.name} · ${r.perSecond}/s` : r.name;
    b.addEventListener("click", () => setRate(i));
    elRates.appendChild(b);
  });
  setRate(rateIndex);
}

function setRate(i: number): void {
  rateIndex = i;
  // A speed change never touches the carry — it is a remainder of REAL time, not
  // of a day, so a day half paid for stays half paid for. [HC-4]: the size of a
  // day does not depend on the control.
  elRateBlurb.textContent = RATES[i].blurb;
  const kids = elRates.children;
  for (let k = 0; k < kids.length; k++) kids[k].className = k === i ? "on" : "";
}

// ---- The loop --------------------------------------------------------------
//
// The accumulator has the shape `loop.ts` uses for the raid — a real elapsed
// time, a carry, and a fixed step — with one difference that is the whole point:
// THE STEP IS A WHOLE DAY AND NEVER A FRACTION OF ONE. `advance` is a pure
// function and is claimed in `pace.test.ts`; this is the four lines that cannot
// be, because they read a clock and ask for a frame.
let last = performance.now();

function frame(now: number): void {
  const realSeconds = (now - last) / 1000;
  last = now;
  const step = advance(RATES[rateIndex].perSecond, carry, realSeconds);
  carry = step.carry;
  if (step.days > 0) pump(run, step.days);
  paint();
  requestAnimationFrame(frame);
}

// ---- Painting --------------------------------------------------------------

function paint(): void {
  drawWorld(ctx, cam, run, chart, dpr);
  elDate.textContent = dateOf(run.world.day);

  const worst = run.world.storms.length > 0 ? run.world.storms[0] : null;
  elWorldLine.textContent = worst
    ? `${run.world.storms.length} live${run.world.storms.length === 1 ? "" : " systems"}: ${describeStorm(run.world, worst)}`
    : "Fair across the whole sea today.";

  // THE DOM IS REBUILT ON A CHANGE, NEVER ON A FRAME. At Century the world runs
  // two years a second and the feed gains a line every few of them; at Pause it
  // gains none at all, and neither case should cost anything sixty times a
  // second ([P-2]).
  if (run.feedMark !== drawnFeed) {
    drawnFeed = run.feedMark;
    paintFeed();
  }
  if (run.trendMark !== drawnTrend) {
    drawnTrend = run.trendMark;
    paintTrend();
  }
  if (run.seasonMark !== drawnSeason) {
    drawnSeason = run.seasonMark;
    paintCard();
    paintWorldStat();
  }
}

function paintFeed(): void {
  // The last forty. The chronicle keeps more (`FEED.keep`), but a person reads
  // the bottom of it.
  const from = run.feed.length > 40 ? run.feed.length - 40 : 0;
  let html = "";
  for (let i = run.feed.length - 1; i >= from; i--) {
    const e = run.feed[i];
    html += `<li class="${e.kind}">${describeNotable(run, e)}</li>`;
  }
  elFeed.innerHTML = html || `<li class="dim">Nothing has happened yet. Let the clock run.</li>`;
}

function paintTrend(): void {
  const t = run.trend;
  drawTrend(
    trendCtx,
    trendCanvas.width / dpr,
    trendCanvas.height / dpr,
    dpr,
    t.day,
    [
      { values: t.people, ink: TREND_INK.people, width: 1.8 },
      { values: t.coin, ink: TREND_INK.coin, width: 1.1 },
    ],
    TREND_INK.grid,
  );
  const span = spanOf(t);
  if (t.day.length < 2) {
    elTrendKey.innerHTML = `<i style="color:${TREND_INK.people}">souls</i> · <i style="color:${TREND_INK.coin}">coin</i> — one sample a year`;
    return;
  }
  // The named failure mode, answered in a number so nobody has to squint at the
  // line: how much of the run's growth happened in its last twenty years.
  const climb = stillClimbing(t, t.people, 20);
  const verdict = climb < 0.15 ? "found their level" : climb < 0.6 ? "slowing" : "still climbing";
  elTrendKey.innerHTML =
    `<i style="color:${TREND_INK.people}">souls</i> to ${Math.round(span.people)} · ` +
    `<i style="color:${TREND_INK.coin}">coin</i> to ${Math.round(span.coin)} · ` +
    `<span class="dim">population ${verdict}</span>`;
}

function paintWorldStat(): void {
  const byClass = countByClass(run);
  elWorldStat.textContent =
    `${Math.round(totalPeople(run))} souls and ${Math.round(totalCoin(run))} coin across ` +
    `${byClass[2]} cities, ${byClass[1]} towns, ${byClass[0]} settlements.`;
}

function paintCard(): void {
  const c = run.card;
  if (!c) {
    elCard.innerHTML = `<p class="dim">Click a port. Pan by dragging, zoom with the wheel.</p>`;
    return;
  }
  const p = run.places[c.id];
  const n = (v: number, dp = 0) => v.toFixed(dp);
  const wants = c.wants
    .map((w) => `<li><b>${w.label}${w.where}</b> — ${w.reason}${w.affordable ? "" : ' <span class="dim">(saving)</span>'}</li>`)
    .join("");
  elCard.innerHTML =
    `<p class="accent"><span class="swatch" style="background:${FACTION_INK[FACTION_IDS[p.faction]]}"></span>` +
    `${p.name} <span class="dim">— ${p.sizeName} · ${p.purpose} · ${c.holder}</span></p>` +
    `<p class="line">${c.line}</p>` +
    `<table>` +
    `<tr><th>souls</th><td>${Math.round(p.people)}</td></tr>` +
    `<tr><th>wealth</th><td>${n(c.coin)} <span class="dim">${c.wealthWord}</span></td></tr>` +
    `<tr><th>prosperity</th><td>${n(c.standing, 1)} <span class="dim">${c.prosperityWord}</span></td></tr>` +
    `<tr><th>food / mouths</th><td>${n(c.food)} / ${n(c.mouths)}</td></tr>` +
    `<tr><th>yield</th><td>${n(c.yield, 1)} a season</td></tr>` +
    `<tr><th>garrison</th><td>${c.garrison} <span class="dim">(${n(c.security)})</span></td></tr>` +
    `<tr><th>works</th><td>${p.hale} working, ${p.works - p.hale} not</td></tr>` +
    `<tr><th>hands</th><td>${n(c.handsNeeded)} of ${n(c.handsAvailable)}</td></tr>` +
    `<tr><th>climate</th><td>${c.climate}</td></tr>` +
    `<tr><th>today</th><td>${p.band > 0 ? `${bandWord(p.band)} <span class="dim">(${n(p.felt, 2)})</span>` : "fair"}</td></tr>` +
    `<tr><th>governor</th><td>${c.governor}</td></tr>` +
    `</table>` +
    `<p class="dim" style="margin:6px 0 0">${c.holder} ${c.character}.</p>` +
    (wants ? `<ul>${wants}</ul>` : `<p class="dim">Nothing he can build here.</p>`);
}

const bandWord = (b: number): string => ["fair", "a blow", "a gale", "a tempest"][b];

// ---- The legend ------------------------------------------------------------

function buildLegend(): void {
  const sw = (ink: string) => `<span class="sw" style="background:${ink}"></span>`;
  const crowns = FACTION_IDS.filter((f) => FACTIONS[f].crown)
    .map((f) => `${sw(FACTION_INK[f])}${FACTIONS[f].name}`)
    .join(" ");
  const neutrals = FACTION_IDS.filter((f) => !FACTIONS[f].crown)
    .map((f) => `${sw(FACTION_INK[f])}${FACTIONS[f].name}`)
    .join(" ");
  elLegend.innerHTML =
    `<div>${crowns}</div><div>${neutrals}</div>` +
    `<div style="margin-top:4px"><b>●</b> civilian <b>◆</b> trade <b>■</b> military · ` +
    `rim = settlement/town/city · area = souls</div>` +
    `<div><b>ring</b> = what THIS port felt today · <b>dot</b> = what it lost</div>`;
}

// ---- Input — inspection only -----------------------------------------------

let dragging = false;
let dragX = 0;
let dragY = 0;
let dragged = 0;

mapCanvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  dragged = 0;
  dragX = e.clientX;
  dragY = e.clientY;
  mapCanvas.classList.add("dragging");
  // A pointer the browser no longer considers active — a synthetic event, a
  // touch already released — must not take the input layer down with it.
  try {
    mapCanvas.setPointerCapture(e.pointerId);
  } catch {
    /* capture is a convenience; the drag works without it */
  }
});

mapCanvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragX;
  const dy = e.clientY - dragY;
  dragX = e.clientX;
  dragY = e.clientY;
  dragged += (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
  cam = clampTo(panBy(cam, dx, dy), run.world.shape.widthNm, run.world.shape.heightNm, minScale(cam.w, cam.h));
});

mapCanvas.addEventListener("pointerup", (e) => {
  dragging = false;
  mapCanvas.classList.remove("dragging");
  if (dragged > 4) return; // a drag is not a click
  const box = mapCanvas.getBoundingClientRect();
  const hit = pickAt(
    cam,
    e.clientX - box.left,
    e.clientY - box.top,
    run.xs,
    run.ys,
    radii(),
    run.places.length,
  );
  select(run, hit);
  paintCard();
});

// The hit test wants a radius per mark, and the radius is the one the renderer
// used — so it is read off the same function ([P-47]). Rebuilt on a click and
// never on a frame.
let radiiBuf = new Float64Array(0);
function radii(): Float64Array {
  if (radiiBuf.length !== run.places.length) radiiBuf = new Float64Array(run.places.length);
  for (let i = 0; i < run.places.length; i++) radiiBuf[i] = radiusFor(run.places[i].people);
  return radiiBuf;
}

mapCanvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const box = mapCanvas.getBoundingClientRect();
    const factor = e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step;
    cam = clampTo(
      zoomAbout(cam, e.clientX - box.left, e.clientY - box.top, factor),
      run.world.shape.widthNm,
      run.world.shape.heightNm,
      minScale(cam.w, cam.h),
    );
  },
  { passive: false },
);

// Space pauses and un-pauses, and un-pausing RETURNS YOU TO THE SPEED YOU LEFT.
// [HC-20] makes pause a first-class speed, which means it is somewhere you go
// deliberately to read the world — and a pause that dropped you back at some
// other rate afterwards would make stopping to look cost something.
let lastRunningRate = 2;

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === " ") {
    e.preventDefault();
    if (rateIndex > 0) lastRunningRate = rateIndex;
    setRate(rateIndex === 0 ? lastRunningRate : 0);
    return;
  }
  const k = Number(e.key);
  if (Number.isInteger(k) && k >= 1 && k <= RATES.length) setRate(k - 1);
});

// ---- The century button ----------------------------------------------------
//
// [HC-11] "identical at any speed" HELD BY CONSTRUCTION RATHER THAN BY PROMISE:
// this is the same `pump` the frame loop calls, asked for 36,000 days instead of
// two, and not drawn while it works. There is no second code path, no fast mode
// and no approximation — which is the whole reason it is written this way rather
// than as a "fast-forward". It costs about a second.
$("century").addEventListener("click", () => {
  const was = rateIndex;
  setRate(0);
  century(run);
  paint();
  setRate(was);
});

// ---- A different sea -------------------------------------------------------
//
// NOT A RE-ROLL OF A LIVE WORLD. A seed builds a world from day 0 and this
// replaces the one on the page with it; there is no verb here that reaches into
// a running simulation, which is what [HC-1] and the brief's "no player
// interaction" require. No save, no load.
function chartNewSea(): void {
  setRate(0);
  carry = 0;
  const asked = readSettings();
  let built: Run;
  try {
    built = makeRun(readSeed(), asked);
  } catch (e) {
    // A world no sea could satisfy. `generateWorld` says what is wrong in a
    // sentence, so the page shows the sentence and keeps the world it has.
    elWorldDesc.textContent = e instanceof Error ? e.message : String(e);
    return;
  }
  run = built;
  // Remembered only now: a set of numbers is worth keeping once a world has
  // actually been built out of it.
  localStorage.setItem(STORE, JSON.stringify({ seed: run.seed, ...asked }));
  chart = makeChart(run.world, bakeCoast(run.world.shape));
  drawnFeed = -1;
  drawnTrend = -1;
  drawnSeason = -1;
  fitted = false;
  resize();
  elWorldDesc.textContent = describeWorld(run.world);
  paint();
  paintCard();
}

$("chart").addEventListener("click", chartNewSea);

// ---- Go --------------------------------------------------------------------

window.addEventListener("resize", () => {
  resize();
  paint();
});

resize();
buildRates();
buildLegend();
elWorldDesc.textContent = describeWorld(run.world);
paintWorldStat();
paintCard();
paintFeed();
paintTrend();
paint();
document.title = `Letters of Marque — the world, ${CALENDAR.epochYear}`;
requestAnimationFrame(frame);
