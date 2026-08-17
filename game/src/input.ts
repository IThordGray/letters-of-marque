import type { App, PanKey } from "./app";
import { panByScreen, zoomAt, clampCamera } from "./camera";
import { CAMERA } from "./constants";

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

export function installInput(app: App, canvas: HTMLCanvasElement) {
  window.addEventListener("keydown", (e) => {
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

  // Middle-button drag pans (left/right stay free for selection & commands).
  let panning = false;
  let panX = 0;
  let panY = 0;
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1) {
      panning = true;
      panX = e.clientX;
      panY = e.clientY;
      e.preventDefault();
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    panByScreen(app.camera, e.clientX - panX, e.clientY - panY);
    panX = e.clientX;
    panY = e.clientY;
    clampCamera(app.camera);
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 1) panning = false;
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
