import type { App } from "./app";
import type { Unit } from "./types";
import { WORLD, COLOR, UNIT } from "./constants";
import { worldToScreen } from "./camera";

function unitColor(u: Unit): string {
  if (u.side === "player") return u.kind === "officer" ? COLOR.playerOfficer : COLOR.player;
  return u.kind === "officer" ? COLOR.enemyOfficer : COLOR.enemy;
}

export function render(ctx: CanvasRenderingContext2D, app: App) {
  const { camera: cam, world, viewW: w, viewH: h } = app;

  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, w, h);

  // the field, drawn through the camera
  const tl = worldToScreen(cam, 0, 0, w, h);
  const br = worldToScreen(cam, WORLD.width, WORLD.height, w, h);
  ctx.fillStyle = COLOR.field;
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.strokeStyle = COLOR.fieldEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

  // the figures — coloured discs, officers ringed
  for (const u of world.units) {
    const p = worldToScreen(cam, u.x, u.y, w, h);
    const r = Math.max(UNIT[u.kind].size * cam.zoom, 2.5);
    ctx.fillStyle = unitColor(u);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (u.kind === "officer") {
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // hud line, fixed to the screen (the field scrolls under it)
  ctx.fillStyle = COLOR.text;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`Land module · ${world.units.length} figures · sim ${world.time.toFixed(1)}s`, 12, 22);
}
