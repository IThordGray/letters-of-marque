import type { App, PanKey, DragBox } from "./app";
import type { Unit } from "./types";
import { panByScreen, zoomAt, clampCamera, worldToScreen, screenToWorld } from "./camera";
import { CAMERA, UNIT, SELECT } from "./constants";
import { dist } from "./math";

const PAN_KEYS: Record<string, PanKey> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
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

  // Middle-button drag pans; left button selects.
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
      // right-click orders the selection to move to the world point under the cursor
      const p = xy(e);
      const wpt = screenToWorld(app.camera, p.x, p.y, app.viewW, app.viewH);
      for (const u of app.world.units) {
        if (app.selected.has(u.id)) u.moveTarget = { x: wpt.x, y: wpt.y };
      }
      return;
    }
    if (e.button === 0) {
      const p = xy(e);
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
      // box-select every player figure whose centre falls in the marquee
      if (!e.shiftKey) app.selected.clear();
      for (const u of app.world.units) {
        if (u.side !== "player") continue;
        const p = worldToScreen(app.camera, u.x, u.y, app.viewW, app.viewH);
        if (inBox(p.x, p.y, box)) app.selected.add(u.id);
      }
    } else {
      // a click: pick the figure under the cursor
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
        app.selected.clear(); // clicked empty ground
      }
    }
  });

  // Wheel zooms toward the cursor.
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

function inBox(x: number, y: number, b: DragBox): boolean {
  return x >= Math.min(b.x0, b.x1) && x <= Math.max(b.x0, b.x1) && y >= Math.min(b.y0, b.y1) && y <= Math.max(b.y0, b.y1);
}

function pickUnit(app: App, sx: number, sy: number): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of app.world.units) {
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
