import type { App } from "./app";
import type { Group, Ship } from "./types";
import { screenToWorld, worldToScreen, isWindAligned, snapWindToTop } from "./camera";
import { SHIP_CLASS } from "./constants";
import {
  countIndividualAttempt,
  countCameraRotation,
  countOrderChange,
  markPaused,
  markResumed,
  signal,
} from "./instrumentation";
import { promoteCommander } from "./sim";
import { cycleFormation, cycleStance, cycleTarget, cycleShot, toggleChase } from "./ui";

function selectedGroup(app: App): Group | undefined {
  return app.state.groups.find((g) => g.id === app.selectedGroupId);
}

export function installInput(app: App, canvas: HTMLCanvasElement) {
  const heldRotate = new Set<string>();

  window.addEventListener("keydown", (e) => {
    // don't hijack browser/devtools combos
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        togglePause(app);
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
      case "KeyQ":
        heldRotate.add("KeyQ");
        app.rotateGestureActive = true;
        app.rotateDir = -1;
        return;
      case "KeyE":
        heldRotate.add("KeyE");
        app.rotateGestureActive = true;
        app.rotateDir = 1;
        return;
      case "KeyW": {
        snapWindToTop(app.camera, app.state.wind);
        countCameraRotation(true); // a snap always ends wind-aligned
        return;
      }
      case "Tab": {
        e.preventDefault();
        const players = app.state.groups.filter((g) => g.faction === "player");
        const i = players.findIndex((g) => g.id === app.selectedGroupId);
        app.selectedGroupId = players[(i + 1) % players.length].id;
        return;
      }
    }

    // order hotkeys act on the selected group
    const g = selectedGroup(app);
    if (!g) return;
    switch (e.code) {
      case "KeyF":
        cycleFormation(app, g);
        break;
      case "KeyS":
        cycleStance(app, g);
        break;
      case "KeyT":
        cycleTarget(app, g);
        break;
      case "KeyH":
        cycleShot(app, g);
        break;
      case "KeyG":
        toggleChase(app, g);
        break;
      case "KeyP":
        promoteCommander(app.state, g);
        break;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyQ" || e.code === "KeyE") {
      heldRotate.delete(e.code);
      if (heldRotate.size === 0) {
        // gesture finished — record it and whether it left us wind-aligned
        if (app.rotateGestureActive) countCameraRotation(isWindAligned(app.camera, app.state.wind));
        app.rotateGestureActive = false;
        app.rotateDir = 0;
      } else {
        app.rotateDir = heldRotate.has("KeyE") ? 1 : -1;
      }
    }
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (app.state.over) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const hit = pickShip(app, px, py);
    const g = selectedGroup(app);

    if (hit) {
      if (hit.faction === "player") {
        // THE key failure signal: the player is trying to command one ship.
        // It must fail — but the attempt has to be counted (§11).
        countIndividualAttempt();
        signal(app.state.time, `— You command squadrons, not ships. ${hit.shipName} answers only to ${hit.captain.name.split(" ").pop()}.`);
      } else if (g) {
        // Clicking an enemy names it as this group's target — a real order.
        g.targetMode = "named";
        g.namedTargetId = hit.id;
        countOrderChange(g.id);
        signal(app.state.time, `${g.name}: engage ${hit.shipName} by name.`);
      }
      return;
    }

    if (g) {
      const w = screenToWorld(app.camera, px, py);
      g.moveTarget = { x: w.x, y: w.y };
      countOrderChange(g.id);
      signal(app.state.time, `${g.name}: make for the marked position.`);
    }
  });
}

function togglePause(app: App) {
  app.paused = !app.paused;
  if (app.paused) markPaused(performance.now());
  else markResumed(performance.now());
}

// Nearest ship whose click falls within its (screen-space) hit radius, or null.
function pickShip(app: App, px: number, py: number): Ship | null {
  let bestShip: Ship | null = null;
  let bestD = Infinity;
  for (const s of app.state.ships.values()) {
    const sp = worldToScreen(app.camera, s.x, s.y);
    const d = Math.hypot(sp.x - px, sp.y - py);
    const r = SHIP_CLASS[s.cls].size * app.camera.scale + 12;
    if (d <= r && d < bestD) {
      bestD = d;
      bestShip = s;
    }
  }
  return bestShip;
}
