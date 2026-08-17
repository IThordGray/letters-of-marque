import type { Wind } from "./types";
import { WORLD, CAMERA } from "./constants";
import { DEG, angleDiff, normalizeAngle } from "./math";

// Rotation-only camera (§4, §9). No pan, no zoom. The whole arena is always on
// screen: we fit the arena's DIAGONAL so nothing clips at any rotation angle.
export interface Camera {
  angle: number; // screen rotation, degrees
  scale: number; // pixels per yard
  cx: number; // canvas centre x, px
  cy: number; // canvas centre y, px
}

const ARENA_CX = WORLD.width / 2;
const ARENA_CY = WORLD.height / 2;

export function makeCamera(): Camera {
  return { angle: 0, scale: 1, cx: 0, cy: 0 };
}

export function resizeCamera(cam: Camera, w: number, h: number) {
  cam.cx = w / 2;
  cam.cy = h / 2;
  const diagonal = Math.hypot(WORLD.width, WORLD.height);
  cam.scale = Math.min(w, h) / (diagonal * CAMERA.arenaMargin);
}

export function worldToScreen(cam: Camera, x: number, y: number): { x: number; y: number } {
  const dx = x - ARENA_CX;
  const dy = y - ARENA_CY;
  const c = Math.cos(cam.angle * DEG);
  const s = Math.sin(cam.angle * DEG);
  return {
    x: cam.cx + cam.scale * (dx * c - dy * s),
    y: cam.cy + cam.scale * (dx * s + dy * c),
  };
}

export function screenToWorld(cam: Camera, px: number, py: number): { x: number; y: number } {
  const dx = (px - cam.cx) / cam.scale;
  const dy = (py - cam.cy) / cam.scale;
  const c = Math.cos(-cam.angle * DEG);
  const s = Math.sin(-cam.angle * DEG);
  return {
    x: ARENA_CX + (dx * c - dy * s),
    y: ARENA_CY + (dx * s + dy * c),
  };
}

// Apply the camera as a canvas transform so world drawing is 1:1 in yards.
export function applyWorldTransform(ctx: CanvasRenderingContext2D, cam: Camera) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cam.cx, cam.cy);
  ctx.rotate(cam.angle * DEG);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-ARENA_CX, -ARENA_CY);
}

// The wind arrow points "toward"; on screen that appears at (toward + angle).
// "Wind snapped to the top" means the arrow points up the screen (screen-up is
// -90° with y down).
export function windScreenAngle(cam: Camera, wind: Wind): number {
  return normalizeAngle(wind.toward + cam.angle);
}

export function isWindAligned(cam: Camera, wind: Wind): boolean {
  return Math.abs(angleDiff(-90, windScreenAngle(cam, wind))) <= CAMERA.windAlignTolerance;
}

export function snapWindToTop(cam: Camera, wind: Wind) {
  cam.angle = normalizeAngle(-90 - wind.toward);
}
