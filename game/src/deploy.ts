import type { PartySpec } from "./spawn";
import type { WeaponType } from "./types";

// The three ways a band goes ashore — matches the WEAPON table, phrased as a choice.
const WEAPONS: { value: WeaponType; label: string; blurb: string }[] = [
  { value: "musket", label: "Muskets", blurb: "stand off and break them with fire" },
  { value: "pistol", label: "Pistol & cutlass", blurb: "shock troops — close fast and terrify" },
  { value: "cannon", label: "Cannon", blurb: "a terror weapon; falls to the cutlass up close" },
];

const DEFAULT: PartySpec = { pirates: 8, weapon: "musket" };
const MIN_PIRATES = 1;
const MAX_PIRATES = 20;

// The pre-battle deploy screen — a one-time "load the boats" decision, not a per-battle
// ritual. Pick the band's size and weapon, then land it. Calls `onConfirm` with the
// chosen spec and removes itself; the battle takes over from there.
export function showDeployScreen(onConfirm: (spec: PartySpec) => void) {
  const spec: PartySpec = { ...DEFAULT };

  const root = document.createElement("div");
  root.className = "deploy-root";
  const card = document.createElement("div");
  card.className = "deploy-card";

  const title = document.createElement("h1");
  title.className = "deploy-title";
  title.textContent = "Outfit the landing party";
  const sub = document.createElement("p");
  sub.className = "deploy-sub";
  sub.textContent = "Load the boats for the raid — choose your band, then put them ashore.";
  card.append(title, sub);

  // --- party size ---
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "deploy-group";
  const sizeLabel = document.createElement("div");
  sizeLabel.className = "deploy-label";
  const stepper = document.createElement("div");
  stepper.className = "deploy-stepper";
  const dec = stepButton("−");
  const inc = stepButton("+");
  const count = document.createElement("span");
  count.className = "deploy-count";
  stepper.append(dec, count, inc);
  sizeGroup.append(sizeLabel, stepper);

  const renderSize = () => {
    count.textContent = String(spec.pirates);
    sizeLabel.textContent = `Pirates ashore — ${spec.pirates}, plus 1 officer to lead them`;
  };
  dec.onclick = () => {
    spec.pirates = Math.max(MIN_PIRATES, spec.pirates - 1);
    renderSize();
  };
  inc.onclick = () => {
    spec.pirates = Math.min(MAX_PIRATES, spec.pirates + 1);
    renderSize();
  };
  renderSize();

  // --- weapon ---
  const wepGroup = document.createElement("div");
  wepGroup.className = "deploy-group";
  const wepLabel = document.createElement("div");
  wepLabel.className = "deploy-label";
  wepLabel.textContent = "Arm the band with";
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
      spec.weapon = w.value;
      paintWeapons();
    };
    wepButtons.push({ value: w.value, el: b });
    wepRow.append(b);
  }
  const paintWeapons = () => {
    for (const { value, el } of wepButtons) el.classList.toggle("selected", value === spec.weapon);
  };
  paintWeapons();
  wepGroup.append(wepLabel, wepRow);

  // --- launch ---
  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "deploy-launch";
  launch.textContent = "Land the party";
  launch.onclick = () => {
    root.remove();
    onConfirm({ ...spec });
  };

  card.append(sizeGroup, wepGroup, launch);
  root.append(card);
  document.body.appendChild(root);
}

function stepButton(text: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "deploy-step";
  b.textContent = text;
  return b;
}
