// Standalone entry for the TOWN module — deliberately NOT wired into the raid.
// Run with `npm run dev`, then open /town.html.
//
// KAN-68 the entity and tick · KAN-69 the founding roll · KAN-70 the works ledger
// · KAN-71 the governor's plan. The prose town card and chronicle are KAN-75; the
// investment slider is KAN-72.

import type { Town } from "./types";
import { foundTown, derive, summarise, year, prosperityWord, wealthWord } from "./sim";
import { stepTownSeason, stepTownYears, wants } from "./governor";
import { describeParcel } from "./parcels";
import { SEASONS_PER_YEAR } from "./constants";

// Three towns on three different patrons' money. The land is whatever their seed
// rolled — nothing here is hand-placed.
function seedTowns(): Town[] {
  return [
    foundTown({ name: "San Bartolomé", seed: 2, archetype: "colony", governor: "Don Alonso Sarmiento",
      patron: { kind: "crown", name: "Spain", owns: true }, grant: 6, population: 90 }),
    foundTown({ name: "Puerto Seco", seed: 5, archetype: "royalOutpost", governor: "Capitán Reyes",
      patron: { kind: "crown", name: "Spain", owns: true }, grant: 22, population: 90 }),
    foundTown({ name: "Gallows Bay", seed: 1, archetype: "pirateHaven", governor: "Quartermaster Roche",
      patron: { kind: "player", name: "you", owns: true }, grant: 0, population: 90 }),
  ];
}

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

  const list = wants(t).map((w) =>
    `<li><b>${w.label}${w.where}</b> — ${w.reason}
       <span class="dim">· ${w.cost} coin${w.affordable ? "" : " (saving)"}
       · ${w.terms.map((x) => `${x.key} ${x.weight.toFixed(2)}`).join(", ")}</span></li>`).join("");

  const log = journal[i].slice(-6).map((s) => `<li>${s}</li>`).join("");

  return `<section class="town">
    <h2>${t.name} <small>${t.archetype} · ${t.governor}</small></h2>
    <p class="line">${summarise(t)}</p>
    <div class="cols">
      <div>
        <table>
          <tr><th>population</th><td>${Math.round(t.population)} souls</td></tr>
          <tr><th>wealth</th><td>${n(t.wealth)} — ${wealthWord(t)}</td></tr>
          <tr><th>prosperity</th><td>${n(t.prosperity, 1)} — ${prosperityWord(t)}</td></tr>
          <tr><th class="sep">food / mouths</th><td class="sep">${n(d.food)} / ${n(d.mouths)}</td></tr>
          <tr><th>yield</th><td>${n(d.yield, 1)} per season</td></tr>
          <tr><th>security</th><td>${n(d.security)} → a ${d.tier} watch</td></tr>
          <tr><th>hands</th><td>${n(d.hands.needed)} needed of ${n(d.hands.available)}</td></tr>
          <tr><th>wants</th><td>${unmet(d.needs)}</td></tr>
        </table>
        <h3>The land <span class="dim">(read-only — it explains the town)</span></h3>
        <ul class="dim">${t.parcels.map((p) => `<li>${describeParcel(p)}</li>`).join("")}</ul>
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
  const t0 = towns[0];
  app.innerHTML =
    `<p class="clock">Year <b>${year(t0)}</b> · season ${(t0.season % SEASONS_PER_YEAR) + 1} of ${SEASONS_PER_YEAR}</p>` +
    towns.map(card).join("");
}

function advance(seasons: number) {
  towns.forEach((t, i) => {
    if (seasons === 1) {
      const b = stepTownSeason(t);
      if (b) journal[i].push(`${b.year} — ${b.sentence}`);
    } else {
      for (const b of stepTownYears(t, seasons / SEASONS_PER_YEAR)) journal[i].push(`${b.year} — ${b.sentence}`);
    }
  });
  render();
}

document.getElementById("season")!.addEventListener("click", () => advance(1));
document.getElementById("year")!.addEventListener("click", () => advance(SEASONS_PER_YEAR));
document.getElementById("twenty")!.addEventListener("click", () => advance(20 * SEASONS_PER_YEAR));
document.getElementById("reset")!.addEventListener("click", () => {
  towns = seedTowns();
  journal = towns.map(() => []);
  render();
});

render();
