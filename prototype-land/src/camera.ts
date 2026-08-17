import { WORLD } from "./constants";

// Locked north-up (no rotation — there's no wind axis to align to on land).
// Just fit the whole field on screen and convert world<->screen.
export interface Camera {
  scale: number; // px per pace
  cx: number; // canvas centre x, px
  cy: number; // canvas centre y, px
}

const CX = WORLD.width / 2;
const CY = WORLD.height / 2;

export function makeCamera(): Camera {
  return { scale: 1, cx: 0, cy: 0 };
}

export function resizeCamera(cam: Camera, w: number, h: number) {
  cam.cx = w / 2;
  cam.cy = h / 2;
  cam.scale = Math.min(w / WORLD.width, h / WORLD.height) * 0.96;
}

export function worldToScreen(cam: Camera, x: number, y: number): { x: number; y: number } {
  return { x: cam.cx + (x - CX) * cam.scale, y: cam.cy + (y - CY) * cam.scale };
}

export function screenToWorld(cam: Camera, px: number, py: number): { x: number; y: number } {
  return { x: CX + (px - cam.cx) / cam.scale, y: CY + (py - cam.cy) / cam.scale };
}
