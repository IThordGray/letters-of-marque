import type { App, PanKey, DragBox } from "./app";
import type { Unit, Stance } from "./types";
import { panByScreen, zoomAt, clampCamera, worldToScreen, screenToWorld } from "./camera";
import { CAMERA, UNIT, SELECT, FORMATION, SPEEDS } from "./constants";
import { formationSlots } from "./formation";
import { rally } from "./officers";
import { torchOrder } from "./raid";
import { dist } from "./math";

// Panning is arrows / middle-drag / wheel; letter keys are commands.
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

  // right-click-a-building context menu (Loot / Torch)
  let buildMenu: HTMLElement | null = null;
  const closeBuildMenu = () => {
    if (buildMenu) {
      buildMenu.remove();
      buildMenu = null;
    }
  };
  const showBuildMenu = (px: number, py: number, buildingId: number, actions: ("loot" | "torch")[]) => {
    closeBuildMenu();
    const m = document.createElement("div");
    m.className = "ctx-menu";
    // Styled inline (not just via .ctx-menu) so a created-in-JS overlay never depends on the
    // stylesheet having loaded/refreshed — the menu is positioned and visible regardless.
    Object.assign(m.style, {
      position: "fixed",
      left: `${px}px`,
      top: `${py}px`,
      zIndex: "30",
      display: "flex",
      flexDirection: "column",
      minWidth: "96px",
      background: "rgba(10, 26, 34, 0.96)",
      border: "1px solid #35617a",
      borderRadius: "6px",
      overflow: "hidden",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
    } as Partial<CSSStyleDeclaration>);
    for (const a of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-item";
      btn.textContent = a === "loot" ? "Loot" : "Torch";
      Object.assign(btn.style, {
        padding: "8px 14px",
        textAlign: "left",
        fontSize: "13px",
        color: "#e8f4fb",
        background: "none",
        border: "none",
        cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);
      btn.onmouseenter = () => (btn.style.background = "rgba(23, 65, 86, 0.5)");
      btn.onmouseleave = () => (btn.style.background = "none");
      btn.onclick = (ev) => {
        ev.stopPropagation();
        orderBuild(app, buildingId, a);
        closeBuildMenu();
      };
      m.append(btn);
    }
    document.body.append(m);
    buildMenu = m;
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      closeBuildMenu();
      app.selected.clear();
      app.inspected = null;
      app.attackArmed = false;
      return;
    }
    if (e.code === "KeyA") {
      app.attackArmed = true; // next left-click = attack (unit) or attack-move (ground)
      return;
    }
    if (e.code === "KeyZ") return setStance(app, "aggressive"); // "At 'em"
    if (e.code === "KeyX") return setStance(app, "holdGround"); // "Hold fast"
    if (e.code === "KeyC") return setStance(app, "ceaseFire"); // "Hold fire"
    if (e.code === "KeyS") return halt(app); // stop and hold
    if (e.code === "KeyR") return rally(app.world); // officers rally the men
    if (e.code === "KeyT") return torch(app); // set the nearest building alight (spends powder)
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
    if (buildMenu) {
      closeBuildMenu(); // a click anywhere on the field dismisses the menu
      return;
    }
    if (e.button === 1) {
      panning = true;
      panX = e.clientX;
      panY = e.clientY;
      e.preventDefault();
      return;
    }
    if (e.button === 2) {
      // right-click: contextual — live enemy = attack; a building = loot/torch (menu if both
      // apply); else formation-move
      const p = xy(e);
      const hit = pickUnit(app, p.x, p.y);
      if (hit && hit.side === "enemy" && hit.state !== "down") {
        orderAttack(app, hit.id);
        return;
      }
      const bld = buildingAt(app, p.x, p.y);
      if (bld && living(app).length > 0) {
        const actions: ("loot" | "torch")[] = [];
        if (bld.state === "intact" && (!!bld.loot || bld.kind === "gaol")) actions.push("loot");
        if (bld.state === "intact" || bld.state === "looted") actions.push("torch");
        if (actions.length >= 2) {
          showBuildMenu(e.clientX, e.clientY, bld.id, actions);
          return;
        }
        if (actions.length === 1) {
          orderBuild(app, bld.id, actions[0]);
          return;
        }
      }
      orderFormationMove(app, screenToWorld(app.camera, p.x, p.y, app.viewW, app.viewH), false);
      return;
    }
    if (e.button === 0) {
      const p = xy(e);
      if (app.attackArmed) {
        // A-armed: enemy = attack it; ground = attack-move
        const hit = pickUnit(app, p.x, p.y);
        if (hit && hit.side === "enemy" && hit.state !== "down") orderAttack(app, hit.id);
        else orderFormationMove(app, screenToWorld(app.camera, p.x, p.y, app.viewW, app.viewH), true);
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
        if (u.side !== "player" || u.state === "down") continue;
        const p = worldToScreen(app.camera, u.x, u.y, app.viewW, app.viewH);
        if (inBox(p.x, p.y, box)) app.selected.add(u.id);
      }
      app.inspected = null; // box-select → the HUD follows the selection
    } else {
      const hit = pickUnit(app, box.x0, box.y0);
      app.inspected = hit ? hit.id : null; // click anything to inspect it; empty ground clears it
      if (hit && hit.side === "player") {
        if (e.shiftKey) {
          if (app.selected.has(hit.id)) app.selected.delete(hit.id);
          else app.selected.add(hit.id);
        } else {
          app.selected.clear();
          app.selected.add(hit.id);
        }
      } else if (!hit && !e.shiftKey) {
        app.selected.clear();
      }
      // clicking an enemy inspects only — the player selection is left intact
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

// Per-frame keyboard panning (variable dt).
export function updateCamera(app: App, realDt: number) {
  if (app.held.size === 0) return;
  const d = (CAMERA.panSpeed * realDt) / app.camera.zoom;
  if (app.held.has("up")) app.camera.y -= d;
  if (app.held.has("down")) app.camera.y += d;
  if (app.held.has("left")) app.camera.x -= d;
  if (app.held.has("right")) app.camera.x += d;
  clampCamera(app.camera);
}

// ---- orders (act on the living selection) ----------------------------------
function living(app: App): Unit[] {
  return app.world.units.filter((u) => app.selected.has(u.id) && u.state !== "down");
}

function orderAttack(app: App, targetId: number) {
  for (const u of living(app)) {
    u.attackTargetId = targetId;
    u.moveTarget = null;
    u.attackMove = false;
    u.buildTargetId = undefined;
    u.buildAction = undefined;
  }
}

// The building under the cursor (topmost by array order), or null.
function buildingAt(app: App, sx: number, sy: number) {
  const w = screenToWorld(app.camera, sx, sy, app.viewW, app.viewH);
  for (const b of app.world.buildings) {
    if (w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h) return b;
  }
  return null;
}

// Order the selection to loot or torch a building — they'll move up to it and work it.
function orderBuild(app: App, buildingId: number, action: "loot" | "torch") {
  for (const u of living(app)) {
    u.buildTargetId = buildingId;
    u.buildAction = action;
    u.moveTarget = null;
    u.attackTargetId = null;
    u.attackMove = false;
    u.path = undefined;
  }
}

function orderFormationMove(app: App, wpt: { x: number; y: number }, attackMove: boolean) {
  const sel = living(app);
  if (sel.length === 0) return;
  const spacing = app.formation === "loose" ? FORMATION.looseSpacing : FORMATION.tightSpacing;
  const slots = formationSlots(sel.length, wpt.x, wpt.y, spacing);
  sel.sort((a, b) => a.x - b.x);
  slots.sort((a, b) => a.x - b.x);
  for (let i = 0; i < sel.length; i++) {
    sel[i].moveTarget = { x: slots[i].x, y: slots[i].y };
    sel[i].attackTargetId = null;
    sel[i].attackMove = attackMove;
    sel[i].buildTargetId = undefined;
    sel[i].buildAction = undefined;
  }
}

function setStance(app: App, stance: Stance) {
  for (const u of living(app)) u.stance = stance;
}

function torch(app: App) {
  torchOrder(
    app.world,
    living(app).map((u) => u.id),
  );
}

function halt(app: App) {
  for (const u of living(app)) {
    u.moveTarget = null;
    u.attackTargetId = null;
    u.attackMove = false;
    u.buildTargetId = undefined;
    u.buildAction = undefined;
    u.stance = "holdGround";
  }
}

function inBox(x: number, y: number, b: DragBox): boolean {
  return x >= Math.min(b.x0, b.x1) && x <= Math.max(b.x0, b.x1) && y >= Math.min(b.y0, b.y1) && y <= Math.max(b.y0, b.y1);
}

function pickUnit(app: App, sx: number, sy: number): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of app.world.units) {
    if (u.state === "down") continue;
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
