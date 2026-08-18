import type { PartySpec, SquadSpec } from "./spawn";
import type { Roster } from "./roster";
import type { WeaponType } from "./types";
import { makeRoster } from "./roster";

// Weapon choices — matches the WEAPON table. Compact labels for the per-squad picker.
const WEAPONS: { value: WeaponType; label: string }[] = [
  { value: "musket", label: "Muskets" },
  { value: "pistol", label: "Pistol & cutlass" },
  { value: "cannon", label: "Cannon" },
];

interface DeployState {
  pirates: number;
  chosen: Set<string>; // officer ids to bring — each leads a squad
  weapons: Record<string, WeaponType>; // per-squad (per-officer) weapon
}

// Split the pirate pool evenly among the chosen officers (remainder to the first
// squads). No officers → one leaderless musket band.
function splitPirates(state: DeployState, roster: Roster): Map<string, number> {
  const chosen = roster.officers.filter((o) => state.chosen.has(o.id));
  const out = new Map<string, number>();
  if (chosen.length === 0) return out;
  const per = Math.floor(state.pirates / chosen.length);
  let rem = state.pirates % chosen.length;
  for (const o of chosen) {
    out.set(o.id, per + (rem > 0 ? 1 : 0));
    if (rem > 0) rem--;
  }
  return out;
}

function buildSpec(state: DeployState, roster: Roster): PartySpec {
  const chosen = roster.officers.filter((o) => state.chosen.has(o.id));
  if (chosen.length === 0) return { squads: [{ officer: null, pirates: state.pirates, weapon: "musket" }] };
  const split = splitPirates(state, roster);
  const squads: SquadSpec[] = chosen.map((officer) => ({
    officer,
    pirates: split.get(officer.id) ?? 0,
    weapon: state.weapons[officer.id] ?? "musket",
  }));
  return { squads };
}

// The pre-battle deploy screen — a one-time "load the boats" decision. Draw a band from
// the finite crew pool, split it among the named officers you bring, and arm each squad.
export function showDeployScreen(onConfirm: (spec: PartySpec) => void) {
  const roster = makeRoster();
  const state: DeployState = {
    pirates: Math.min(8, roster.poolSize),
    chosen: new Set<string>(roster.officers.length ? [roster.officers[0].id] : []),
    weapons: {},
  };
  for (const o of roster.officers) state.weapons[o.id] = "musket";

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
  sub.textContent = "Load the boats — draw your band, split it among your officers, and arm each squad.";
  card.append(title, sub);

  // --- party size (capped by the finite crew pool) ---
  const sizeGroup = group(card);
  const sizeLabel = label(sizeGroup);
  const stepper = document.createElement("div");
  stepper.className = "deploy-stepper";
  const dec = stepButton("−");
  const inc = stepButton("+");
  const count = document.createElement("span");
  count.className = "deploy-count";
  stepper.append(dec, count, inc);
  sizeGroup.append(stepper);

  // --- squads (one row per roster officer; bring it → it leads a squad + picks a weapon) ---
  const squadGroup = group(card);
  label(squadGroup).textContent = "Your squads — bring an officer to lead, then arm the squad";
  const squadList = document.createElement("div");
  squadList.className = "deploy-squads";
  squadGroup.append(squadList);

  interface Row {
    id: string;
    wrap: HTMLElement;
    countEl: HTMLElement;
    wepRow: HTMLElement;
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
    const countEl = document.createElement("span");
    countEl.className = "deploy-squad-count";
    head.append(left, countEl);
    head.onclick = () => {
      if (state.chosen.has(o.id)) state.chosen.delete(o.id);
      else state.chosen.add(o.id);
      paint();
    };

    const stats = document.createElement("div");
    stats.className = "deploy-squad-stats";
    stats.textContent = `fero ${o.ferocity} · marks ${o.marks} · morale ${o.morale}`;

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

    wrap.append(head, stats, wepRow);
    squadList.append(wrap);
    rows.push({ id: o.id, wrap, countEl, wepRow, wepButtons });
  }

  // --- launch ---
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
    count.textContent = String(state.pirates);
    sizeLabel.textContent = `Pirates ashore — ${state.pirates} of ${roster.poolSize} in the crew`;
    const split = splitPirates(state, roster);
    for (const r of rows) {
      const on = state.chosen.has(r.id);
      r.wrap.classList.toggle("selected", on);
      r.wepRow.classList.toggle("hidden", !on);
      r.countEl.textContent = on ? `${split.get(r.id) ?? 0} pirates` : "not landing";
      for (const { value, el } of r.wepButtons) el.classList.toggle("selected", value === state.weapons[r.id]);
    }
  }

  dec.onclick = () => {
    state.pirates = Math.max(1, state.pirates - 1);
    paint();
  };
  inc.onclick = () => {
    state.pirates = Math.min(roster.poolSize, state.pirates + 1);
    paint();
  };

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

function stepButton(text: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "deploy-step";
  b.textContent = text;
  return b;
}
