import type { App } from "./app";
import type { Unit } from "./types";
import { WORLD, COLOR, UNIT, FLASH } from "./constants";
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

  // the fallen first, dim, so the living draw over them
  for (const u of world.units) {
    if (u.hp > 0) continue;
    const p = worldToScreen(cam, u.x, u.y, w, h);
    ctx.fillStyle = COLOR.dead;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(UNIT[u.kind].size * cam.zoom * 0.8, 2), 0, Math.PI * 2);
    ctx.fill();
  }

  // the living — coloured discs, officers ringed, selection ringed white
  let standing = 0;
  for (const u of world.units) {
    if (u.hp <= 0) continue;
    standing++;
    const p = worldToScreen(cam, u.x, u.y, w, h);
    const rad = Math.max(UNIT[u.kind].size * cam.zoom, 2.5);
    ctx.fillStyle = unitColor(u);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
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
      ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // health bar above the figure
    const bw = Math.max(rad * 2, 9);
    const bx = p.x - bw / 2;
    const by = p.y - rad - 7;
    const frac = u.hp / u.maxHp;
    ctx.fillStyle = COLOR.hpBack;
    ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = frac > 0.5 ? COLOR.hpGood : frac > 0.25 ? COLOR.hpMid : COLOR.hpLow;
    ctx.fillRect(bx, by, bw * frac, 3);
  }

  // shot flashes (fade out over their ttl)
  ctx.lineWidth = 1;
  for (const f of world.flashes) {
    const a = worldToScreen(cam, f.ax, f.ay, w, h);
    const b = worldToScreen(cam, f.bx, f.by, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / FLASH.ttl));
    ctx.strokeStyle = COLOR.fire;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // move-order markers for the selection
  ctx.strokeStyle = COLOR.moveMarker;
  ctx.lineWidth = 1.5;
  for (const u of world.units) {
    if (u.hp <= 0 || !u.moveTarget || !app.selected.has(u.id)) continue;
    const p = worldToScreen(cam, u.moveTarget.x, u.moveTarget.y, w, h);
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y);
    ctx.lineTo(p.x + 5, p.y);
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x, p.y + 5);
    ctx.stroke();
  }

  // the marquee (only once it's an actual drag)
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

  // hud line, fixed to the screen
  const speed = app.paused ? "paused" : `×${app.timeScale}`;
  const outcome = world.over ? ` · ${world.outcome}` : "";
  ctx.fillStyle = COLOR.text;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(
    `Land · ${standing} standing · ${app.selected.size} selected · ${app.formation} · ${speed} · ${world.time.toFixed(1)}s${outcome}`,
    12,
    22,
  );
}
