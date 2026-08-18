import type { PartySpec, SquadSpec } from "./spawn";
import type { OfficerProfile, Roster } from "./roster";
import type { WeaponType } from "./types";
import { makeRoster } from "./roster";
import { enemyGarrisonSize } from "./spawn";
import { UNIT, CARRY, PRESENCE } from "./constants";

// Weapon choices — matches the WEAPON table. Compact labels for the per-squad picker.
const WEAPONS: { value: WeaponType; label: string }[] = [
  { value: "musket", label: "Muskets" },
  { value: "pistol", label: "Pistol & cutlass" },
  { value: "cannon", label: "Cannon" },
];

interface DeployState {
  chosen: Set<string>; // officer ids brought — each leads a squad
  counts: Record<string, number>; // pirates allocated to each squad, from the shared pool
  weapons: Record<string, WeaponType>; // per-squad weapon
}

// The carry-over an officer gives his squad, phrased plainly. Mirrors officers.ts:
// a pirate is lifted CARRY.fraction of the way toward the officer's skill.
function carryLine(o: OfficerProfile): string {
  const pm = UNIT.pirate.marks;
  const pf = UNIT.pirate.ferocity;
  const lm = Math.round(pm + CARRY.fraction * Math.max(0, o.marks - pm));
  const lf = Math.round(pf + CARRY.fraction * Math.max(0, o.ferocity - pf));
  return `lifts the squad — marks ${pm}→${lm}, fero ${pf}→${lf} · steadies within ${PRESENCE.radius}p`;
}

function buildSpec(state: DeployState, roster: Roster): PartySpec {
  const chosen = roster.officers.filter((o) => state.chosen.has(o.id));
  if (chosen.length === 0) return { squads: [{ officer: null, pirates: 6, weapon: "musket" }] };
  const squads: SquadSpec[] = chosen.map((officer) => ({
    officer,
    pirates: state.counts[officer.id] ?? 0,
    weapon: state.weapons[officer.id] ?? "musket",
  }));
  return { squads };
}

// The pre-battle deploy screen — a one-time "load the boats" decision. Bring officers,
// hand each a share of the finite crew, and arm each squad. No cap beyond the crew you
// actually have.
export function showDeployScreen(onConfirm: (spec: PartySpec) => void) {
  const roster = makeRoster();
  const state: DeployState = { chosen: new Set<string>(), counts: {}, weapons: {} };
  for (const o of roster.officers) {
    state.counts[o.id] = 0;
    state.weapons[o.id] = "musket";
  }
  if (roster.officers.length) {
    const first = roster.officers[0];
    state.chosen.add(first.id);
    state.counts[first.id] = Math.min(6, roster.poolSize);
  }

  const used = () => [...state.chosen].reduce((s, id) => s + (state.counts[id] ?? 0), 0);
  const remaining = () => roster.poolSize - used();

  const root = document.createElement("div");
  root.className = "deploy-root";
  const card = document.createElement("div");
  card.className = "deploy-card";
  root.append(card);

  const title = document.createElement("h1");
  title.className = "deploy-title";
  title.textContent = "Outfit the landing party";
  const sub = document.createElement("p");
  sub.className = "deploy-sub";
  sub.textContent = "Load the boats — bring your officers, hand each a share of the crew, and arm the squad.";
  card.append(title, sub);

  // --- the garrison you face (informs the choice — this is an asymmetric raid) ---
  const garrison = document.createElement("div");
  garrison.className = "deploy-garrison";
  garrison.textContent = `The garrison holds ~${enemyGarrisonSize()} defenders, dug in. You'll be outnumbered — break their will, don't try to outlast them.`;
  card.append(garrison);

  // --- crew readout (allocation is per-squad; this tracks the shared pool) ---
  const crew = document.createElement("div");
  crew.className = "deploy-crew-readout";
  card.append(crew);

  // --- squads (one card per roster officer) ---
  const squadGroup = group(card);
  label(squadGroup).textContent = "Your squads — bring an officer, allocate crew, arm them";
  const squadList = document.createElement("div");
  squadList.className = "deploy-squads";
  squadGroup.append(squadList);

  interface Row {
    o: OfficerProfile;
    wrap: HTMLElement;
    headCount: HTMLElement;
    body: HTMLElement;
    allocCount: HTMLElement;
    minus: HTMLButtonElement;
    plus: HTMLButtonElement;
    wepButtons: { value: WeaponType; el: HTMLButtonElement }[];
  }
  const rows: Row[] = [];

  for (const o of roster.officers) {
    const wrap = document.createElement("div");
    wrap.className = "deploy-squad";

    const head = document.createElement("button");
    head.type = "button";
    head.className = "deploy-squad-head";
    const left = document.createElement("span");
    left.className = "deploy-squad-left";
    const check = document.createElement("span");
    check.className = "deploy-check";
    const name = document.createElement("span");
    name.className = "deploy-squad-name";
    name.textContent = o.name;
    left.append(check, name);
    const headCount = document.createElement("span");
    headCount.className = "deploy-squad-count";
    head.append(left, headCount);
    head.onclick = () => {
      if (state.chosen.has(o.id)) state.chosen.delete(o.id);
      else {
        state.chosen.add(o.id);
        if (state.counts[o.id] === 0) state.counts[o.id] = Math.min(4, remaining());
      }
      paint();
    };

    const stats = document.createElement("div");
    stats.className = "deploy-squad-stats";
    stats.textContent = `fero ${o.ferocity} · marks ${o.marks} · morale ${o.morale}`;

    // expanded body (visible when brought)
    const body = document.createElement("div");
    body.className = "deploy-squad-body";

    const carry = document.createElement("div");
    carry.className = "deploy-carry";
    carry.textContent = carryLine(o);

    const alloc = document.createElement("div");
    alloc.className = "deploy-alloc";
    const allocLabel = document.createElement("span");
    allocLabel.className = "deploy-alloc-label";
    allocLabel.textContent = "Crew";
    const minus = allocButton("−");
    const plus = allocButton("+");
    const allocCount = document.createElement("span");
    allocCount.className = "deploy-alloc-count";
    minus.onclick = () => {
      state.counts[o.id] = Math.max(0, (state.counts[o.id] ?? 0) - 1);
      paint();
    };
    plus.onclick = () => {
      if (remaining() > 0) state.counts[o.id] = (state.counts[o.id] ?? 0) + 1;
      paint();
    };
    alloc.append(allocLabel, minus, allocCount, plus);

    const wepRow = document.createElement("div");
    wepRow.className = "deploy-squad-weapons";
    const wepButtons: { value: WeaponType; el: HTMLButtonElement }[] = [];
    for (const w of WEAPONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "deploy-wep";
      b.textContent = w.label;
      b.onclick = () => {
        state.weapons[o.id] = w.value;
        paint();
      };
      wepButtons.push({ value: w.value, el: b });
      wepRow.append(b);
    }

    body.append(carry, alloc, wepRow);
    wrap.append(head, stats, body);
    squadList.append(wrap);
    rows.push({ o, wrap, headCount, body, allocCount, minus, plus, wepButtons });
  }

  // --- party summary + launch ---
  const summary = document.createElement("div");
  summary.className = "deploy-summary";
  card.append(summary);

  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "deploy-launch";
  launch.textContent = "Land the party";
  launch.onclick = () => {
    root.remove();
    onConfirm(buildSpec(state, roster));
  };
  card.append(launch);

  function paint() {
    const left = remaining();
    crew.textContent = `Crew ashore — ${used()} of ${roster.poolSize} · ${left} still in the boats`;
    for (const r of rows) {
      const on = state.chosen.has(r.o.id);
      const n = state.counts[r.o.id] ?? 0;
      r.wrap.classList.toggle("selected", on);
      r.body.classList.toggle("hidden", !on);
      r.headCount.textContent = on ? `${n} pirates` : "not landing";
      r.allocCount.textContent = String(n);
      r.minus.disabled = n <= 0;
      r.plus.disabled = left <= 0;
      for (const { value, el } of r.wepButtons) el.classList.toggle("selected", value === state.weapons[r.o.id]);
    }
    const officers = state.chosen.size;
    const p = used();
    const yours = officers + p;
    const g = enemyGarrisonSize();
    const ready = officers >= 1 && p >= 1;
    summary.textContent = ready
      ? `Your raid — ${p} pirates under ${officers} officer${officers === 1 ? "" : "s"} in ${officers} squad${officers === 1 ? "" : "s"} · ${yours} ashore vs ~${g} defenders${yours < g ? " — outnumbered" : ""}`
      : "Bring at least one officer and some crew to launch the raid.";
    summary.classList.toggle("warn", !ready);
    launch.disabled = !ready;
  }

  paint();
  document.body.appendChild(root);
}

function group(parent: HTMLElement): HTMLElement {
  const g = document.createElement("div");
  g.className = "deploy-group";
  parent.append(g);
  return g;
}

function label(parent: HTMLElement): HTMLElement {
  const l = document.createElement("div");
  l.className = "deploy-label";
  parent.append(l);
  return l;
}

function allocButton(text: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "deploy-alloc-step";
  b.textContent = text;
  return b;
}
