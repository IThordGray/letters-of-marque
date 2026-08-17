import { WORLD, CAMERA } from "./constants";
import { clamp } from "./math";

// Maps world paces <-> screen pixels. (x, y) is the world point at the centre of
// the viewport; zoom is pixels-per-pace. A view control only — never touched by
// the sim, so the simulation stays deterministic regardless of what you're looking at.
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function makeCamera(vw: number, vh: number): Camera {
  const zoom = Math.min(vw / WORLD.width, vh / WORLD.height) * 0.92; // fit the field
  return { x: WORLD.width / 2, y: WORLD.height / 2, zoom };
}

export function worldToScreen(cam: Camera, wx: number, wy: number, vw: number, vh: number): { x: number; y: number } {
  return { x: vw / 2 + (wx - cam.x) * cam.zoom, y: vh / 2 + (wy - cam.y) * cam.zoom };
}

export function screenToWorld(cam: Camera, sx: number, sy: number, vw: number, vh: number): { x: number; y: number } {
  return { x: cam.x + (sx - vw / 2) / cam.zoom, y: cam.y + (sy - vh / 2) / cam.zoom };
}

// Pan by a screen-pixel delta (a drag): the world under the cursor tracks the hand.
export function panByScreen(cam: Camera, dxPx: number, dyPx: number) {
  cam.x -= dxPx / cam.zoom;
  cam.y -= dyPx / cam.zoom;
}

// Zoom by a factor, keeping the world point under (sx, sy) pinned to the cursor.
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number, vw: number, vh: number) {
  const before = screenToWorld(cam, sx, sy, vw, vh);
  cam.zoom = clamp(cam.zoom * factor, CAMERA.zoomMin, CAMERA.zoomMax);
  const after = screenToWorld(cam, sx, sy, vw, vh);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
}

// Keep the camera centre inside the field and the zoom within range.
export function clampCamera(cam: Camera) {
  cam.zoom = clamp(cam.zoom, CAMERA.zoomMin, CAMERA.zoomMax);
  cam.x = clamp(cam.x, 0, WORLD.width);
  cam.y = clamp(cam.y, 0, WORLD.height);
}
