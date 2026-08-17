import type { App } from "./app";
import type { Unit } from "./types";
import { rally } from "./sim";
import { perkList } from "./names";
import { getSignals, onSignal, exportJson, getMetrics } from "./instrumentation";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function stanceLabel(st: Unit["stance"]): string {
  return st === "aggressive" ? "Aggressive" : st === "hold-ground" ? "Hold ground" : "Cease fire";
}

function playerUnits(app: App): Unit[] {
  return [...app.state.units.values()].filter((u) => u.side === "player" && u.state !== "down");
}
function selectedUnits(app: App): Unit[] {
  return playerUnits(app).filter((u) => app.selected.has(u.id));
}

export interface UI {
  refresh(): void;
}

export function installUI(app: App, hooks: { newBattle(): void }): UI {
  const root = el("div", "ui-root");
  document.body.appendChild(root);

  // top-left: orders + selection
  const col = el("div", "col");
  root.appendChild(col);
  col.appendChild(el("div", "title", "YOUR BAND"));

  const orders = el("div", "orders");
  const setStance = (st: Unit["stance"]) => {
    for (const u of selectedUnits(app)) u.stance = st;
  };
  const bAgg = orderBtn("Aggressive (Z)", () => setStance("aggressive"));
  const bHold = orderBtn("Hold ground (X)", () => setStance("hold-ground"));
  const bCease = orderBtn("Cease fire (C)", () => setStance("cease-fire"));
  const bRally = orderBtn("Rally (R)", () => rally(app.state));
  const bAll = orderBtn("Select all (E)", () => {
    app.selected.clear();
    for (const u of playerUnits(app)) app.selected.add(u.id);
  });
  const bStop = orderBtn("Stop (S)", () => {
    for (const u of selectedUnits(app)) {
      u.moveTarget = null;
      u.attackTargetId = null;
      u.stance = "hold-ground";
    }
  });
  bRally.classList.add("inspire");
  orders.append(bAgg, bHold, bCease, bRally, bAll, bStop);
  col.appendChild(orders);

  const sel = el("div", "selbox");
  col.appendChild(sel);

  col.appendChild(el("div", "hint", "Left-drag / click to select · right-click ground to move · right-click enemy to attack"));
  col.appendChild(el("div", "hint", "Stances — Z aggressive (chase & switch targets) · X hold ground (fight, don't move) · C cease fire · S stop"));
  col.appendChild(el("div", "hint", "Officers roll stats → perks and drill a fraction into their squad. Keep them alive and close."));

  // HUD
  const hud = el("div", "hud");
  root.appendChild(hud);
  const hStand = el("div", "hud-line");
  const hRally = el("div", "hud-line");
  const hTime = el("div", "hud-line");
  hud.append(hStand, hRally, hTime);

  // log
  const logWrap = el("div", "log");
  logWrap.append(el("div", "log-title", "FIELD DISPATCHES"));
  const logBody = el("div", "log-body");
  logWrap.appendChild(logBody);
  root.appendChild(logWrap);
  const renderLog = () => {
    logBody.replaceChildren();
    for (const l of getSignals()) {
      const row = el("div", "log-line");
      const ts = el("span", "log-t", `${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, "0")} `);
      row.append(ts, document.createTextNode(l.text));
      logBody.appendChild(row);
    }
    logBody.scrollTop = logBody.scrollHeight;
  };
  onSignal(renderLog);
  renderLog();

  // end overlay
  const over = el("div", "over hidden");
  const card = el("div", "over-card");
  const title = el("h1", "", "");
  const stats = el("pre", "over-stats", "");
  const dl = el("button", "btn primary", "Download session JSON");
  const nb = el("button", "btn", "New battle");
  dl.addEventListener("click", () => exportJson());
  nb.addEventListener("click", () => hooks.newBattle());
  card.append(title, stats, dl, nb);
  over.appendChild(card);
  root.appendChild(over);

  function refresh() {
    const s = selectedUnits(app);
    sel.replaceChildren();
    sel.appendChild(el("div", "selcount", `Selected: ${s.length}`));
    // shared stance (or "mixed"), and highlight the matching button
    const stances = new Set(s.map((u) => u.stance));
    const shared = stances.size === 1 ? [...stances][0] : null;
    if (s.length) sel.appendChild(el("div", "selstat", `Stance: ${shared ? stanceLabel(shared) : "mixed"}`));
    bAgg.classList.toggle("active", shared === "aggressive");
    bHold.classList.toggle("active", shared === "hold-ground");
    bCease.classList.toggle("active", shared === "cease-fire");
    for (const o of s.filter((u) => u.kind === "officer")) {
      const perks = perkList(o.perks);
      sel.appendChild(el("div", "selname", `${o.name} — ${o.weapon}`));
      sel.appendChild(
        el(
          "div",
          "selstat",
          `Marks ${o.marks} · Fero ${o.ferocity} · Presence ${o.presence}${perks.length ? " · " + perks.join(", ") : ""}`,
        ),
      );
    }

    const p = standing(app, "player");
    const e = standing(app, "enemy");
    hStand.textContent = `Your band: ${p.fighting} fighting / ${p.total} · Garrison: ${e.fighting} / ${e.total}`;
    const uses = playerUnits(app)
      .filter((u) => u.kind === "officer")
      .reduce((n, o) => n + o.rallyUses, 0);
    hRally.textContent = `Rally charges: ${uses}`;
    hTime.textContent = `${app.paused ? "‖ PAUSED" : "▶"}  ×${app.timeScale}  ·  ${fmt(app.state.time)}`;
    bRally.classList.toggle("ready", uses > 0);

    if (app.state.over) {
      over.classList.remove("hidden");
      title.textContent = app.state.outcome;
      stats.textContent = summary();
    }
  }

  return { refresh };
}

function standing(app: App, side: "player" | "enemy") {
  let fighting = 0;
  let total = 0;
  for (const u of app.state.units.values()) {
    if (u.side !== side || u.state === "down") continue;
    total++;
    if (u.state !== "routing") fighting++;
  }
  return { fighting, total };
}

function summary(): string {
  const m = getMetrics();
  return [
    `Duration: ${fmt(m.battleDurationMs / 1000)}`,
    `Broke their will (ROUT): ${m.routsCaused}   vs   cut down (KILL): ${m.killsCaused}`,
    `Flank/rear hits you landed: ${m.flanksLanded}`,
    `Orders given: ${m.commandsIssued}   ·   Rally uses: ${m.rallyUses}`,
    `Figures lost — yours: ${m.playerLost}, theirs: ${m.enemyLost}`,
  ].join("\n");
}

function fmt(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function orderBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", "order-btn", label);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
