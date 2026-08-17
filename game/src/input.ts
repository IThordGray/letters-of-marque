import type { App, PanKey, DragBox } from "./app";
import type { Unit } from "./types";
import { panByScreen, zoomAt, clampCamera, worldToScreen, screenToWorld } from "./camera";
import { CAMERA, UNIT, SELECT, FORMATION, SPEEDS } from "./constants";
import { formationSlots } from "./formation";
import { dist } from "./math";

// Panning is arrows / middle-drag / wheel; letter keys are reserved for commands.
const PAN_KEYS: Record<string, PanKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DRAG_THRESHOLD = 6; // px before a left-press becomes a box-select rather than a click

export function installInput(app: App, canvas: HTMLCanvasElement) {
  const xy = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      app.selected.clear();
      app.attackArmed = false;
      return;
    }
    if (e.code === "KeyA") {
      app.attackArmed = true; // next left-click = attack (unit) or attack-move (ground)
      return;
    }
    if (e.code === "KeyF") {
      app.formation = app.formation === "tight" ? "loose" : "tight";
      return;
    }
    if (e.code === "Space") {
      app.paused = !app.paused;
      e.preventDefault();
      return;
    }
    if (e.code === "Digit1") {
      app.timeScale = SPEEDS[0];
      return;
    }
    if (e.code === "Digit2") {
      app.timeScale = SPEEDS[1];
      return;
    }
    if (e.code === "Digit3") {
      app.timeScale = SPEEDS[2];
      return;
    }
    if (e.code === "Digit4") {
      app.timeScale = SPEEDS[3];
      return;
    }
    const k = PAN_KEYS[e.code];
    if (k) {
      app.held.add(k);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = PAN_KEYS[e.code];
    if (k) app.held.delete(k);
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  let panning = false;
  let panX = 0;
  let panY = 0;
  let selecting = false;
  let dragging = false;
  let downX = 0;
  let downY = 0;

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1) {
      panning = true;
      panX = e.clientX;
      panY = e.clientY;
      e.preventDefault();
      return;
    }
    if (e.button === 2) {
      // right-click: contextual — a live enemy under the cursor = attack it; else formation-move
      const p = xy(e);
      const hit = pickUnit(app, p.x, p.y);
      if (hit && hit.side === "enemy" && hit.hp > 0) orderAttack(app, hit.id);
      else orderFormationMove(app, screenToWorld(app.camera, p.x, p.y, app.viewW, app.viewH));
      return;
    }
    if (e.button === 0) {
      const p = xy(e);
      if (app.attackArmed) {
        // A-armed: click a live enemy to attack it, or ground to attack-move
        const hit = pickUnit(app, p.x, p.y);
        if (hit && hit.side === "enemy" && hit.hp > 0) orderAttack(app, hit.id);
        else orderFormationMove(app, screenToWorld(app.camera, p.x, p.y, app.viewW, app.viewH));
        app.attackArmed = false;
        return;
      }
      downX = p.x;
      downY = p.y;
      selecting = true;
      dragging = false;
      app.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (panning) {
      panByScreen(app.camera, e.clientX - panX, e.clientY - panY);
      panX = e.clientX;
      panY = e.clientY;
      clampCamera(app.camera);
    }
    if (selecting && app.drag) {
      const p = xy(e);
      app.drag.x1 = p.x;
      app.drag.y1 = p.y;
      if (Math.hypot(p.x - downX, p.y - downY) > DRAG_THRESHOLD) dragging = true;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 1) {
      panning = false;
      return;
    }
    if (e.button !== 0 || !selecting) return;
    const box = app.drag;
    app.drag = null;
    selecting = false;
    if (!box) return;

    if (dragging) {
      if (!e.shiftKey) app.selected.clear();
      for (const u of app.world.units) {
        if (u.side !== "player" || u.hp <= 0) continue;
        const p = worldToScreen(app.camera, u.x, u.y, app.viewW, app.viewH);
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

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? CAMERA.zoomStep : 1 / CAMERA.zoomStep;
      zoomAt(app.camera, factor, e.clientX - rect.left, e.clientY - rect.top, app.viewW, app.viewH);
      clampCamera(app.camera);
    },
    { passive: false },
  );
}

// Per-frame keyboard panning (variable dt). Screen-space speed so it feels the
// same at any zoom level.
export function updateCamera(app: App, realDt: number) {
  if (app.held.size === 0) return;
  const d = (CAMERA.panSpeed * realDt) / app.camera.zoom;
  if (app.held.has("up")) app.camera.y -= d;
  if (app.held.has("down")) app.camera.y += d;
  if (app.held.has("left")) app.camera.x -= d;
  if (app.held.has("right")) app.camera.x += d;
  clampCamera(app.camera);
}

// ---- order helpers (act on the living selection) ---------------------------
function living(app: App): Unit[] {
  return app.world.units.filter((u) => app.selected.has(u.id) && u.hp > 0);
}

function orderAttack(app: App, targetId: number) {
  for (const u of living(app)) {
    u.attackTargetId = targetId;
    u.moveTarget = null;
  }
}

function orderFormationMove(app: App, wpt: { x: number; y: number }) {
  const sel = living(app);
  if (sel.length === 0) return;
  const spacing = app.formation === "loose" ? FORMATION.looseSpacing : FORMATION.tightSpacing;
  const slots = formationSlots(sel.length, wpt.x, wpt.y, spacing);
  sel.sort((a, b) => a.x - b.x);
  slots.sort((a, b) => a.x - b.x);
  for (let i = 0; i < sel.length; i++) {
    sel[i].moveTarget = { x: slots[i].x, y: slots[i].y };
    sel[i].attackTargetId = null;
  }
}

function inBox(x: number, y: number, b: DragBox): boolean {
  return x >= Math.min(b.x0, b.x1) && x <= Math.max(b.x0, b.x1) && y >= Math.min(b.y0, b.y1) && y <= Math.max(b.y0, b.y1);
}

function pickUnit(app: App, sx: number, sy: number): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of app.world.units) {
    if (u.hp <= 0) continue;
    const p = worldToScreen(app.camera, u.x, u.y, app.viewW, app.viewH);
    const r = UNIT[u.kind].size * app.camera.zoom + SELECT.pickSlack;
    const d = dist(p.x, p.y, sx, sy);
    if (d <= r && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
