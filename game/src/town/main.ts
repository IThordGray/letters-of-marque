// Standalone entry for the TOWN module — deliberately NOT wired into the raid.
// Run with `npm run dev`, then open /town.html.
//
// KAN-68 the entity and tick · KAN-69 the founding roll · KAN-70 the works ledger
// · KAN-71 the governor's plan · KAN-79/80 the hex land map. The prose town card
// and chronicle are KAN-75; the investment slider and the steer are KAN-72.

import type { Town } from "./types";
import { derive, summarise, prosperityWord, wealthWord } from "./sim";
import { generateWorld, foundPlace, describeWorld } from "../overworld/worldgen";
import type { Place } from "../overworld/places";
import { CALENDAR, yearOfDay } from "../overworld/calendar";
import { seasonOf, stepDay, yearOf } from "../overworld/clock";
import { stepTownSeason, wants } from "./governor";
import { renderHexMap, landCaption } from "./hexmap";
import { renderPlan } from "./planview";
import { planTown, describePlan } from "./plan";

// ONE WORLD SEED, AND NOTHING ELSE HAND-PICKED (KAN-98). The generator draws the
// coastlines, sites the ports, decides their size, purpose and faction, names
// them out of their holders' own pools, and cuts each one's ground from the map
// at its position ([HC-19]). Every number this harness used to carry — a town's
// name, its seed, its archetype, its patron, its governor, its grant — is now a
// reading of the world, and `town.seed` in particular is DERIVED from the world
// seed rather than hand-picked (§10.4).
//
// [HC-21] The step-buttons stay here. This is the single-town harness and it is
// how the ledger is tested; the world sim gets the running clock, elsewhere.
//
// THE DATE ON THIS PAGE IS THE WORLD'S, as of KAN-107. It used to be read off
// `towns[0]` — a year the first showcased town reckoned from its own founding,
// which meant the header could only ever be right about one of the three towns
// below it. The harness already holds a World, so it advances the real clock and
// prints it, and every town it steps is handed the same day. That is [HC-71] in
// the smallest possible form: the world drives, the ledger takes what it is given.
const WORLD_SEED = 1660;
const world = generateWorld(WORLD_SEED);

// Fifty cards would be a wall. Three, chosen to be unalike, are a test: the
// greatest port the world designated, a garrison on somebody's frontier, and a
// place that answers to no crown.
function showcase(): Place[] {
  const pick = (want: (p: Place) => boolean) => world.places.find(want);
  const chosen = [
    pick((p) => p.size === "city"),
    pick((p) => p.purpose === "military"),
    pick((p) => !world.nations[p.faction].crown),
  ].filter((p): p is Place => p !== undefined);
  const seen = new Set(chosen.map((p) => p.id));
  for (const p of world.places) {
    if (chosen.length >= 3) break;
    if (!seen.has(p.id)) chosen.push(p);
  }
  return chosen.slice(0, 3);
}

const seedTowns = (): Town[] => showcase().map((p) => foundPlace(world, p));

let towns = seedTowns();
let journal: string[][] = towns.map(() => []);

const app = document.getElementById("app")!;
const n = (v: number, dp = 0) => v.toFixed(dp);

function card(t: Town, i: number): string {
  const d = derive(t);
  const live = t.works.filter((w) => w.condition === "working");
  const sick = t.works.filter((w) => w.condition !== "working");

  const ledger = live.length
    ? tally(live.map((w) => w.name)).map((s) => `<li>${s}</li>`).join("")
    : "<li class='dim'>nothing but bare ground</li>";
  const rotting = sick.length
    ? `<p class="dim">Idle or rotting: ${tally(sick.map((w) => `${w.name} (${w.condition})`)).join(" · ")}</p>`
    : "";

  const list = wants(t, world.day).map((w) =>
    `<li><b>${w.label}${w.where}</b> — ${w.reason}
       <span class="dim">· ${w.cost} coin${w.affordable ? "" : " (saving)"}
       · ${w.terms.map((x) => `${x.key} ${x.weight.toFixed(2)}`).join(", ")}</span></li>`).join("");

  const log = journal[i].slice(-6).map((s) => `<li>${s}</li>`).join("");

  return `<section class="town">
    <h2>${t.name} <small>${t.archetype} · ${t.governor}</small></h2>
    <p class="line">${summarise(t, world.day)}</p>
    <div class="cols">
      <div>
        <table>
          <tr><th>population</th><td>${Math.round(t.population)} souls</td></tr>
          <tr><th>wealth</th><td>${n(t.wealth)} — ${wealthWord(t)}</td></tr>
          <tr><th>prosperity</th><td>${n(t.prosperity, 1)} — ${prosperityWord(t)}</td></tr>
          <tr><th class="sep">food / mouths</th><td class="sep">${n(d.food)} / ${n(d.mouths)}</td></tr>
          <tr><th>yield</th><td>${n(d.yield, 1)} per season</td></tr>
          <tr><th>security</th><td>${n(d.security)} → a ${d.garrison} watch</td></tr>
          <tr><th>hands</th><td>${n(d.hands.needed)} needed of ${n(d.hands.available)}</td></tr>
          <tr><th>wants</th><td>${unmet(d.needs)}</td></tr>
        </table>
        <h3>The land <span class="dim">(read-only — it explains the town)</span></h3>
        ${renderHexMap(t)}
        <p class="dim caption">${landCaption(t)}</p>
        <h3>The ground <span class="dim">(what you would land on)</span></h3>
        ${renderPlan(t)}
        <p class="dim caption">${describePlan(t, planTown(t))}</p>
      </div>
      <div>
        <h3>Works</h3><ul>${ledger}</ul>${rotting}
        <h3>What the governor wants next</h3><ul class="wants">${list || "<li class='dim'>nothing he can build here</li>"}</ul>
        <h3>What he has done</h3><ul class="log">${log || "<li class='dim'>nothing yet</li>"}</ul>
      </div>
    </div>
  </section>`;
}

// "sawpits ×2" rather than two identical lines.
function tally(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of names) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].map(([s, c]) => (c > 1 ? `${s} ×${c}` : s));
}

function unmet(needs: Record<string, number>): string {
  const bad = Object.entries(needs).filter(([, v]) => v > 0.25).map(([k]) => k);
  return bad.length ? bad.join(", ") : "<span class='dim'>all answered</span>";
}

function render() {
  app.innerHTML =
    `<p class="clock">Year <b>${yearOf(world)}</b> · season ${seasonOf(world) + 1} of ${CALENDAR.seasonsPerYear}</p>` +
    `<p class="dim caption">${describeWorld(world)}</p>` +
    towns.map(card).join("");
}

// Every button is a number of SEASONS, and each one is stepped the same way: the
// day the world is standing on goes to all three towns, then the world advances a
// season's worth of days. The days really are stepped one at a time ([HC-2]: the
// day is the atom), which costs 90 increments a season and buys the guarantee
// that this harness's clock is not a second arithmetic of its own.
function advance(seasons: number) {
  for (let s = 0; s < seasons; s++) {
    const day = world.day;
    towns.forEach((t, i) => {
      const season = stepTownSeason(t, day);
      const when = yearOfDay(season.day);
      if (season.built) journal[i].push(`${when} — ${season.built.sentence}`);
      // Stalling is a standing condition, not news — don't repeat it every season.
      if (season.grew && season.grew.kind !== "stalled") journal[i].push(`${when} — ${season.grew.sentence}`);
    });
    for (let d = 0; d < CALENDAR.daysPerSeason; d++) stepDay(world);
  }
  render();
}

document.getElementById("season")!.addEventListener("click", () => advance(1));
document.getElementById("year")!.addEventListener("click", () => advance(CALENDAR.seasonsPerYear));
document.getElementById("twenty")!.addEventListener("click", () => advance(20 * CALENDAR.seasonsPerYear));
document.getElementById("reset")!.addEventListener("click", () => {
  // Reset winds the world's clock back too, or the "new" towns would be founded
  // on whatever day the last run reached. A reset is not a simulation step.
  world.day = 0;
  towns = seedTowns();
  journal = towns.map(() => []);
  render();
});

render();
