import type { App } from "./app";
import type { Group, Ship, Formation, Stance, TargetMode } from "./types";
import { isWindAligned, windScreenAngle } from "./camera";
import { temperamentLine } from "./names";
import { promoteCommander } from "./sim";
import {
  countOrderChange,
  countGeneralChase,
  getSignals,
  onSignal,
  exportJson,
  getMetrics,
  signal,
} from "./instrumentation";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const FORMATIONS: Formation[] = ["line-ahead", "line-abreast", "loose"];
const STANCES: Stance[] = ["engage", "standoff", "breakoff"];
const TARGETS: TargetMode[] = ["nearest", "weakest", "named", "hold"];

function formationLabel(f: Formation) {
  return f === "line-ahead" ? "Line ahead" : f === "line-abreast" ? "Line abreast" : "Loose";
}
function stanceLabel(s: Stance) {
  return s === "engage" ? "Engage close" : s === "standoff" ? "Stand off & batter" : "Break off";
}
function targetLabel(app: App, g: Group) {
  if (g.targetMode === "nearest") return "Nearest";
  if (g.targetMode === "weakest") return "Weakest";
  if (g.targetMode === "hold") return "Hold fire";
  const t = g.namedTargetId != null ? app.state.ships.get(g.namedTargetId) : undefined;
  return `Named: ${t ? t.shipName : "—"}`;
}

interface GroupRefs {
  panel: HTMLElement;
  cohesion: HTMLElement;
  formation: HTMLButtonElement;
  stance: HTMLButtonElement;
  target: HTMLButtonElement;
  shot: HTMLButtonElement;
  chase: HTMLButtonElement;
  rows: Map<number, { root: HTMLElement; hull: HTMLElement; rig: HTMLElement; status: HTMLElement }>;
}

export interface UI {
  refresh(): void;
}

export function installUI(app: App, hooks: { newBattle(): void }): UI {
  const root = el("div", "ui-root");
  document.body.appendChild(root);

  // ---- left: player group panels ----
  const left = el("div", "panel-col");
  root.appendChild(left);
  const groupRefs = new Map<number, GroupRefs>();

  for (const g of app.state.groups.filter((x) => x.faction === "player")) {
    left.appendChild(buildGroupPanel(app, g, groupRefs));
  }

  const hint = el(
    "div",
    "hint",
    "Click a panel to select · click open water to send it there · click a ship = (blocked) individual order",
  );
  left.appendChild(hint);
  const keyhint = el(
    "div",
    "hint",
    "Keys: Space pause · 1/2/4 speed · Q/E rotate · W snap wind · F/S/T/H orders · G chase · P promote · Tab switch group",
  );
  left.appendChild(keyhint);

  // ---- top-right HUD ----
  const hud = el("div", "hud");
  root.appendChild(hud);
  const windEl = el("div", "hud-line");
  const timeEl = el("div", "hud-line");
  const clockEl = el("div", "hud-line");
  const enemyEl = el("div", "hud-line");
  hud.append(windEl, timeEl, clockEl, enemyEl);

  // ---- signal log ----
  const logWrap = el("div", "log");
  const logTitle = el("div", "log-title", "SIGNAL LOG");
  const logBody = el("div", "log-body");
  logWrap.append(logTitle, logBody);
  root.appendChild(logWrap);

  function renderLog() {
    logBody.replaceChildren();
    for (const line of getSignals()) {
      const row = el("div", "log-line");
      const t = el("span", "log-t", `${Math.floor(line.t / 60)}:${String(Math.floor(line.t % 60)).padStart(2, "0")} `);
      row.append(t, document.createTextNode(line.text));
      logBody.appendChild(row);
    }
    logBody.scrollTop = logBody.scrollHeight;
  }
  onSignal(renderLog);
  renderLog();

  // ---- battle-end overlay ----
  const over = el("div", "over hidden");
  const overCard = el("div", "over-card");
  const overTitle = el("h1", "", "");
  const overStats = el("pre", "over-stats", "");
  const dlBtn = el("button", "btn primary", "Download session JSON");
  const newBtn = el("button", "btn", "New battle");
  dlBtn.addEventListener("click", () => exportJson());
  newBtn.addEventListener("click", () => hooks.newBattle());
  overCard.append(overTitle, overStats, dlBtn, newBtn);
  over.appendChild(overCard);
  root.appendChild(over);

  // ---------- refresh (called every frame) ----------
  function refresh() {
    for (const g of app.state.groups) {
      if (g.faction !== "player") continue;
      const r = groupRefs.get(g.id)!;
      r.panel.classList.toggle("selected", g.id === app.selectedGroupId);
      const live = g.shipIds.filter((id) => !app.state.ships.get(id)?.struck).length;
      r.cohesion.textContent = `${g.cohesion === "formed" ? "Formed" : "LOOSE"} · ${live}/${g.startingStrength} · cmdr ${cmdName(app, g)}`;
      r.cohesion.classList.toggle("warn", g.cohesion !== "formed");
      r.formation.textContent = `Formation: ${formationLabel(g.formation)}`;
      r.stance.textContent = `Stance: ${stanceLabel(g.stance)}`;
      r.target.textContent = `Target: ${targetLabel(app, g)}`;
      r.shot.textContent = `Shot: ${g.shot === "round" ? "Round" : "Chain"}`;
      r.chase.textContent = g.generalChase ? "General Chase: ON" : "General Chase";
      r.chase.classList.toggle("active", g.generalChase);
      for (const id of g.shipIds) updateRow(r.rows.get(id)!, app.state.ships.get(id)!);
    }

    const wind = app.state.wind;
    const aligned = isWindAligned(app.camera, wind);
    windEl.textContent = `Wind: ${Math.round(wind.toward)}° → screen ${Math.round(windScreenAngle(app.camera, wind))}°  ${aligned ? "✓ aligned" : ""}`;
    windEl.classList.toggle("ok", aligned);
    timeEl.textContent = `${app.paused ? "‖ PAUSED" : "▶"}  speed ×${app.timeScale}`;
    clockEl.textContent = `Battle ${fmtTime(app.state.time)}`;
    const enemyGroups = app.state.groups.filter((x) => x.faction === "enemy");
    enemyEl.textContent =
      "Enemy: " +
      enemyGroups
        .map((eg) => `${eg.name} ${eg.shipIds.filter((id) => !app.state.ships.get(id)?.struck).length}/${eg.startingStrength}`)
        .join("  ·  ");

    if (app.state.over) {
      over.classList.remove("hidden");
      overTitle.textContent = app.state.outcome;
      overStats.textContent = summarize();
    }
  }

  return { refresh };
}

function summarize(): string {
  const m = getMetrics();
  const lines = [
    `Duration: ${fmtTime(m.battleDurationMs / 1000)}`,
    `Individual-ship order attempts (key signal): ${m.individualSelectAttempts}`,
    `Camera rotations: ${m.cameraRotations} (${m.cameraRotationsWindAligned} ended wind-aligned)`,
    `Pauses: ${m.pauseCount}, total paused ${(m.totalPausedMs / 1000).toFixed(1)}s`,
    `Order changes: ${JSON.stringify(m.orderChangesByGroup)}`,
    `General Chase uses: ${m.generalChaseUses}`,
    `Interpretation events: ${JSON.stringify(m.interpretationEvents)}`,
  ];
  return lines.join("\n");
}

function cmdName(app: App, g: Group): string {
  const c = app.state.ships.get(g.commanderId);
  return c ? (c.captain.name.split(" ").pop() ?? "—") : "—";
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildGroupPanel(app: App, g: Group, refs: Map<number, GroupRefs>): HTMLElement {
  const panel = el("div", "panel");
  panel.addEventListener("click", () => {
    app.selectedGroupId = g.id;
  });

  const head = el("div", "panel-head");
  head.append(el("span", "panel-name", g.name));
  const cohesion = el("span", "cohesion", "");
  head.append(cohesion);
  panel.appendChild(head);

  const shipList = el("div", "ship-list");
  const rows = new Map<number, { root: HTMLElement; hull: HTMLElement; rig: HTMLElement; status: HTMLElement }>();
  for (const id of g.shipIds) {
    const s = app.state.ships.get(id)!;
    const row = el("div", "ship-row");
    const name = el("div", "ship-name", `${s.shipName} · ${s.cls === "sloop" ? "Sloop" : "Frigate"}`);
    const capt = el("div", "ship-capt", `${s.captain.name} — ${temperamentLine(s.captain)}`);
    const bars = el("div", "ship-bars");
    const hullB = el("div", "bar hull");
    const hullFill = el("div", "fill");
    hullB.appendChild(hullFill);
    const rigB = el("div", "bar rig");
    const rigFill = el("div", "fill");
    rigB.appendChild(rigFill);
    bars.append(hullB, rigB);
    const status = el("div", "ship-status", "");
    row.append(name, capt, bars, status);
    shipList.appendChild(row);
    rows.set(id, { root: row, hull: hullFill, rig: rigFill, status });
  }
  panel.appendChild(shipList);

  // order channel buttons — same actions the keyboard hotkeys call
  const orders = el("div", "orders");
  const formation = orderBtn("", () => cycleFormation(app, g));
  const stance = orderBtn("", () => cycleStance(app, g));
  const target = orderBtn("", () => cycleTarget(app, g));
  const shot = orderBtn("", () => cycleShot(app, g));
  orders.append(formation, stance, target, shot);
  panel.appendChild(orders);

  const extra = el("div", "orders");
  const chase = orderBtn("", () => toggleChase(app, g));
  const promote = orderBtn("Promote commander", () => {
    if (promoteCommander(app.state, g)) {
      /* logged inside */
    }
  });
  extra.append(chase, promote);
  panel.appendChild(extra);

  refs.set(g.id, { panel, cohesion, formation, stance, target, shot, chase, rows });
  return panel;
}

function orderBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", "order-btn", label);
  b.addEventListener("click", (e) => {
    e.stopPropagation(); // don't also re-select the group
    onClick();
  });
  return b;
}

function updateRow(
  refs: { root: HTMLElement; hull: HTMLElement; rig: HTMLElement; status: HTMLElement },
  s: Ship,
) {
  refs.hull.style.width = `${Math.max(0, (s.hull / s.maxHull) * 100)}%`;
  refs.rig.style.width = `${Math.max(0, (s.rigging / s.maxRigging) * 100)}%`;
  let st = "";
  if (s.struck) st = "struck";
  else if (s.inIrons > 0) st = "in irons";
  else if (s.mood === "chase") st = "chasing";
  else if (s.mood === "refuse-recall") st = "ignoring the recall";
  else if (s.mood === "shy") st = "holding back";
  else if (s.mood === "unnerved") st = "nerve failing";
  refs.status.textContent = st;
  refs.root.classList.toggle("struck", s.struck);
}

// ---- order actions shared with keyboard hotkeys ----

export function cycleFormation(app: App, g: Group) {
  g.formation = FORMATIONS[(FORMATIONS.indexOf(g.formation) + 1) % FORMATIONS.length];
  countOrderChange(g.id);
  signal(app.state.time, `${g.name}: form ${formationLabel(g.formation)}.`);
}
export function cycleStance(app: App, g: Group) {
  g.stance = STANCES[(STANCES.indexOf(g.stance) + 1) % STANCES.length];
  countOrderChange(g.id);
  signal(app.state.time, `${g.name}: ${stanceLabel(g.stance)}.`);
}
export function cycleTarget(app: App, g: Group) {
  const next = TARGETS[(TARGETS.indexOf(g.targetMode) + 1) % TARGETS.length];
  g.targetMode = next;
  if (next === "named") {
    // pick the nearest enemy to the commander as the named quarry
    const cmd = app.state.ships.get(g.commanderId);
    const enemies = [...app.state.ships.values()].filter((s) => s.faction !== g.faction && !s.struck);
    if (cmd && enemies.length) {
      const nearest = enemies.reduce((a, b) =>
        Math.hypot(b.x - cmd.x, b.y - cmd.y) < Math.hypot(a.x - cmd.x, a.y - cmd.y) ? b : a,
      );
      g.namedTargetId = nearest.id;
    } else {
      g.namedTargetId = null;
    }
  }
  countOrderChange(g.id);
  signal(app.state.time, `${g.name}: target ${targetLabel(app, g)}.`);
}
export function cycleShot(app: App, g: Group) {
  g.shot = g.shot === "round" ? "chain" : "round";
  countOrderChange(g.id);
  signal(app.state.time, `${g.name}: load ${g.shot}.`);
}
export function toggleChase(app: App, g: Group) {
  g.generalChase = !g.generalChase;
  if (g.generalChase) countGeneralChase();
  signal(app.state.time, `${g.name}: ${g.generalChase ? "GENERAL CHASE — every ship for herself!" : "recall — reform on the commander."}`);
}
