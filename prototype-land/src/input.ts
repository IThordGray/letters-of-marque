import type { App } from "./app";
import type { Unit } from "./types";
import { screenToWorld, worldToScreen } from "./camera";
import { UNIT } from "./constants";
import { countCommand } from "./instrumentation";
import { rally } from "./sim";

const DRAG_THRESHOLD = 6; // px before a click becomes a box-select

export function installInput(app: App, canvas: HTMLCanvasElement) {
  let downX = 0;
  let downY = 0;
  let dragging = false;

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case "Space":
        e.preventDefault();
        app.paused = !app.paused;
        return;
      case "Digit1":
        app.timeScale = 1;
        return;
      case "Digit2":
        app.timeScale = 2;
        return;
      case "Digit4":
        app.timeScale = 4;
        return;
      case "KeyE": // select every player figure
        selectAll(app);
        return;
      case "KeyZ": // stance: aggressive
        setStance(app, "aggressive");
        return;
      case "KeyX": // stance: hold ground
        setStance(app, "hold-ground");
        return;
      case "KeyC": // stance: cease fire
        setStance(app, "cease-fire");
        return;
      case "KeyS": // stop — halt where you are and hold ground
        for (const u of selectedUnits(app)) {
          u.moveTarget = null;
          u.attackTargetId = null;
          u.stance = "hold-ground";
        }
        return;
      case "KeyR":
        rally(app.state);
        return;
      case "Escape":
        app.selected.clear();
        return;
    }
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (app.state.over) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (e.button === 2) {
      commandTo(app, px, py); // right-click = move / attack
      return;
    }
    if (e.button === 0) {
      downX = px;
      downY = py;
      dragging = false;
      app.drag = { x0: px, y0: py, x1: px, y1: py };
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!app.drag) return;
    const rect = canvas.getBoundingClientRect();
    app.drag.x1 = e.clientX - rect.left;
    app.drag.y1 = e.clientY - rect.top;
    if (Math.hypot(app.drag.x1 - downX, app.drag.y1 - downY) > DRAG_THRESHOLD) dragging = true;
  });

  window.addEventListener("mouseup", (e) => {
    if (!app.drag || e.button !== 0) return;
    const box = app.drag;
    app.drag = null;
    if (dragging) {
      if (!e.shiftKey) app.selected.clear();
      for (const u of playerUnits(app)) {
        const p = worldToScreen(app.camera, u.x, u.y);
        if (inBox(p.x, p.y, box)) app.selected.add(u.id);
      }
    } else {
      const hit = pickUnit(app, box.x0, box.y0);
      if (hit && hit.side === "player") {
        if (e.shiftKey) {
          if (app.selected.has(hit.id)) app.selected.delete(hit.id);
          else app.selected.add(hit.id);
        } else {
          app.selected.clear();
          app.selected.add(hit.id);
        }
      } else if (!e.shiftKey) {
        app.selected.clear();
      }
    }
  });
}

function commandTo(app: App, px: number, py: number) {
  const sel = selectedUnits(app);
  if (sel.length === 0) return;
  const hit = pickUnit(app, px, py);
  if (hit && hit.side === "enemy") {
    for (const u of sel) {
      u.attackTargetId = hit.id;
      u.moveTarget = null;
    }
    countCommand();
  } else {
    const w = screenToWorld(app.camera, px, py);
    for (const u of sel) {
      u.moveTarget = { x: w.x, y: w.y };
      u.attackTargetId = null;
    }
    countCommand();
  }
}

function setStance(app: App, stance: Unit["stance"]) {
  for (const u of selectedUnits(app)) u.stance = stance;
}

function selectAll(app: App) {
  app.selected.clear();
  for (const u of playerUnits(app)) app.selected.add(u.id);
}

function playerUnits(app: App): Unit[] {
  return [...app.state.units.values()].filter((u) => u.side === "player" && u.state !== "down");
}
function selectedUnits(app: App): Unit[] {
  return playerUnits(app).filter((u) => app.selected.has(u.id));
}

function inBox(x: number, y: number, b: { x0: number; y0: number; x1: number; y1: number }): boolean {
  return x >= Math.min(b.x0, b.x1) && x <= Math.max(b.x0, b.x1) && y >= Math.min(b.y0, b.y1) && y <= Math.max(b.y0, b.y1);
}

function pickUnit(app: App, px: number, py: number): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of app.state.units.values()) {
    if (u.state === "down") continue;
    const p = worldToScreen(app.camera, u.x, u.y);
    const r = UNIT[u.kind].size * app.camera.scale + 8;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= r && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
