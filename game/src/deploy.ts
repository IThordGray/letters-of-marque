import type { PartySpec, SquadSpec } from "./spawn";
import type { OfficerProfile, Roster } from "./roster";
import type { WeaponType } from "./types";
import { makeRoster } from "./roster";

// The three ways a band goes ashore — matches the WEAPON table, phrased as a choice.
const WEAPONS: { value: WeaponType; label: string; blurb: string }[] = [
  { value: "musket", label: "Muskets", blurb: "stand off and break them with fire" },
  { value: "pistol", label: "Pistol & cutlass", blurb: "shock troops — close fast and terrify" },
  { value: "cannon", label: "Cannon", blurb: "a terror weapon; falls to the cutlass up close" },
];

interface DeployState {
  pirates: number;
  weapon: WeaponType;
  chosen: Set<string>; // ids of officers to bring
}

// Split the pirates evenly among the chosen officers into squads (remainder to the
// first squads); no officers → one leaderless band.
function buildSpec(state: DeployState, roster: Roster): PartySpec {
  const chosen = roster.officers.filter((o) => state.chosen.has(o.id));
  if (chosen.length === 0) return { squads: [{ officer: null, pirates: state.pirates, weapon: state.weapon }] };
  const per = Math.floor(state.pirates / chosen.length);
  let rem = state.pirates % chosen.length;
  const squads: SquadSpec[] = chosen.map((officer) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem--;
    return { officer, pirates: per + extra, weapon: state.weapon };
  });
  return { squads };
}

// The pre-battle deploy screen — a one-time "load the boats" decision, not a per-battle
// ritual. Draw a band from the finite crew pool, pick which named officers lead it, arm
// it, then land it. Calls `onConfirm` with the composed party and removes itself.
export function showDeployScreen(onConfirm: (spec: PartySpec) => void) {
  const roster = makeRoster();
  const state: DeployState = {
    pirates: Math.min(8, roster.poolSize),
    weapon: "musket",
    chosen: new Set<string>(roster.officers.length ? [roster.officers[0].id] : []),
  };

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
  sub.textContent = "Load the boats for the raid — draw your band and its officers, arm them, then put them ashore.";
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
  const renderSize = () => {
    count.textContent = String(state.pirates);
    sizeLabel.textContent = `Pirates ashore — ${state.pirates} of ${roster.poolSize} in the crew`;
  };
  dec.onclick = () => {
    state.pirates = Math.max(1, state.pirates - 1);
    renderSize();
  };
  inc.onclick = () => {
    state.pirates = Math.min(roster.poolSize, state.pirates + 1);
    renderSize();
  };
  renderSize();

  // --- weapon (party-wide for now; per-squad comes later) ---
  const wepGroup = group(card);
  label(wepGroup).textContent = "Arm the band with";
  const wepRow = document.createElement("div");
  wepRow.className = "deploy-weapons";
  const wepButtons: { value: WeaponType; el: HTMLButtonElement }[] = [];
  for (const w of WEAPONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deploy-weapon";
    const name = document.createElement("span");
    name.className = "deploy-weapon-name";
    name.textContent = w.label;
    const blurb = document.createElement("span");
    blurb.className = "deploy-weapon-blurb";
    blurb.textContent = w.blurb;
    b.append(name, blurb);
    b.onclick = () => {
      state.weapon = w.value;
      paintWeapons();
    };
    wepButtons.push({ value: w.value, el: b });
    wepRow.append(b);
  }
  const paintWeapons = () => {
    for (const { value, el } of wepButtons) el.classList.toggle("selected", value === state.weapon);
  };
  paintWeapons();
  wepGroup.append(wepRow);

  // --- officers to bring (each leads a squad) ---
  const offGroup = group(card);
  label(offGroup).textContent = "Officers to bring — each leads a squad";
  const offList = document.createElement("div");
  offList.className = "deploy-officers";
  const offRows: { o: OfficerProfile; el: HTMLButtonElement }[] = [];
  for (const o of roster.officers) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deploy-officer";
    const name = document.createElement("span");
    name.className = "deploy-officer-name";
    name.textContent = o.name;
    const stats = document.createElement("span");
    stats.className = "deploy-officer-stats";
    stats.textContent = `fero ${o.ferocity} · marks ${o.marks} · morale ${o.morale}`;
    b.append(name, stats);
    b.onclick = () => {
      if (state.chosen.has(o.id)) state.chosen.delete(o.id);
      else state.chosen.add(o.id);
      paintOfficers();
    };
    offRows.push({ o, el: b });
    offList.append(b);
  }
  const paintOfficers = () => {
    for (const { o, el } of offRows) el.classList.toggle("selected", state.chosen.has(o.id));
  };
  paintOfficers();
  offGroup.append(offList);

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
