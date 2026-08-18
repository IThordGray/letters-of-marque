import type { App } from "./app";
import type { Unit } from "./types";
import { LOG } from "./constants";

const STATE_LABEL: Record<string, string> = {
  steady: "Steady",
  wavering: "Wavering",
  routing: "Routing",
  down: "Down",
};
const STANCE_LABEL: Record<string, string> = {
  aggressive: "At 'em",
  holdGround: "Hold fast",
  ceaseFire: "Hold fire",
};
const WEAPON_LABEL: Record<string, string> = {
  musket: "Musket",
  pistol: "Pistol & cutlass",
  cannon: "Cannon",
};

// A thin DOM overlay: a selection / inspection detail panel (top-left) and the
// signal log (bottom-right). This layer is where richer combat UI can grow later.
export function installUI(app: App): { refresh: () => void } {
  const root = document.createElement("div");
  root.className = "ui-root";
  const panel = document.createElement("div");
  panel.className = "panel hidden";
  const log = document.createElement("div");
  log.className = "log";
  root.append(panel, log);
  document.body.appendChild(root);

  let lastLen = -1;
  return {
    refresh() {
      // signal log — rebuilt only when it changes
      const lines = app.world.log;
      if (lines.length !== lastLen) {
        lastLen = lines.length;
        log.replaceChildren();
        for (const l of lines.slice(-LOG.display)) {
          const line = document.createElement("div");
          line.className = "log-line";
          const t = document.createElement("span");
          t.className = "log-t";
          t.textContent = `${l.t.toFixed(1)}s`;
          line.append(t, ` ${l.msg}`);
          log.appendChild(line);
        }
        log.scrollTop = log.scrollHeight;
      }
      // detail panel — the inspected figure, else the selection
      updatePanel(app, panel);
    },
  };
}

function focusUnit(app: App): Unit | null {
  if (app.inspected != null) {
    const u = app.world.units.find((x) => x.id === app.inspected);
    if (u && u.state !== "down") return u;
  }
  if (app.selected.size === 1) {
    const id = app.selected.values().next().value as number;
    const u = app.world.units.find((x) => x.id === id);
    if (u && u.state !== "down") return u;
  }
  return null;
}

function updatePanel(app: App, panel: HTMLElement) {
  const u = focusUnit(app);
  if (u) {
    panel.className = `panel ${u.side}`;
    panel.replaceChildren(
      row("panel-head", `${u.side === "player" ? "Ally" : "Enemy"} · ${u.kind === "officer" ? (u.name ?? "Officer") : "Pirate"}`),
      row("panel-line", `${STATE_LABEL[u.state]} · morale ${Math.round(u.morale)}`),
      row("panel-line", `HP ${u.hp}/${u.maxHp} · ${WEAPON_LABEL[u.weapon]}`),
      row("panel-line", `${STANCE_LABEL[u.stance]} · fero ${u.ferocity} · marks ${u.marks}`),
    );
  } else if (app.selected.size > 1) {
    panel.className = "panel player";
    panel.replaceChildren(row("panel-head", `${app.selected.size} figures selected`));
  } else {
    panel.className = "panel hidden";
    panel.replaceChildren();
  }
}

function row(cls: string, text: string): HTMLElement {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  return d;
}
