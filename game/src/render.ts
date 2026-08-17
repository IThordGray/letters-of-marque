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

  // the figures — coloured discs, officers ringed, selection ringed in white
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
    if (app.selected.has(u.id)) {
      ctx.strokeStyle = COLOR.selection;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // move-order markers — a small cross at each selected figure's target
  ctx.strokeStyle = COLOR.moveMarker;
  ctx.lineWidth = 1.5;
  for (const u of world.units) {
    if (!u.moveTarget || !app.selected.has(u.id)) continue;
    const p = worldToScreen(cam, u.moveTarget.x, u.moveTarget.y, w, h);
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y);
    ctx.lineTo(p.x + 5, p.y);
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x, p.y + 5);
    ctx.stroke();
  }

  // the marquee (only once it's an actual drag, not a click)
  if (app.drag) {
    const b = app.drag;
    if (Math.abs(b.x1 - b.x0) > 2 || Math.abs(b.y1 - b.y0) > 2) {
      const x = Math.min(b.x0, b.x1);
      const y = Math.min(b.y0, b.y1);
      const bw = Math.abs(b.x1 - b.x0);
      const bh = Math.abs(b.y1 - b.y0);
      ctx.fillStyle = COLOR.dragFill;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = COLOR.dragBox;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, bw, bh);
    }
  }

  // hud line, fixed to the screen (the field scrolls under it)
  ctx.fillStyle = COLOR.text;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(
    `Land module · ${world.units.length} figures · ${app.selected.size} selected · sim ${world.time.toFixed(1)}s`,
    12,
    22,
  );
}
