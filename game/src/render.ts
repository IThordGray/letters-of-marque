import type { World } from "./world";
import { WORLD, COLOR } from "./constants";

// Placeholder view transform: fit the whole world on screen, centred. The real
// pan/zoom camera (KAN-5) replaces this — all drawing goes through one
// world->screen mapping so swapping it stays a one-file change.
function fitScale(w: number, h: number): number {
  return Math.min(w / WORLD.width, h / WORLD.height) * 0.92;
}

export function render(ctx: CanvasRenderingContext2D, world: World, w: number, h: number) {
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, w, h);

  const scale = fitScale(w, h);
  const ox = (w - WORLD.width * scale) / 2;
  const oy = (h - WORLD.height * scale) / 2;

  // the empty field and its edge
  ctx.fillStyle = COLOR.field;
  ctx.fillRect(ox, oy, WORLD.width * scale, WORLD.height * scale);
  ctx.strokeStyle = COLOR.fieldEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, WORLD.width * scale, WORLD.height * scale);

  // proof the fixed-timestep loop is ticking (goes away once there's real content)
  ctx.fillStyle = COLOR.text;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`Land module — empty world · sim ${world.time.toFixed(1)}s`, ox + 12, oy + 24);
}
