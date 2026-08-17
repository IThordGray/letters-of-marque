import type { App, DragBox } from "./app";
import type { Unit, Terrain } from "./types";
import { WORLD, COLOR, UNIT, PRESENCE, FLASH } from "./constants";
import { DEG, clamp } from "./math";
import { worldToScreen } from "./camera";

export function render(ctx: CanvasRenderingContext2D, app: App, w: number, h: number) {
  const { camera, state } = app;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a130b";
  ctx.fillRect(0, 0, w, h);

  const tl = worldToScreen(camera, 0, 0);
  const br = worldToScreen(camera, WORLD.width, WORLD.height);
  ctx.fillStyle = COLOR.field;
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.strokeStyle = COLOR.fieldLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

  for (const t of state.terrain) drawTerrain(ctx, app, t);
  for (const u of state.units.values()) if (u.kind === "officer" && u.state !== "down") drawAura(ctx, app, u);
  for (const f of state.flashes) drawFlash(ctx, app, f);
  for (const u of state.units.values()) drawUnit(ctx, app, u);
  for (const u of state.units.values()) drawLabel(ctx, app, u);
  if (app.drag) drawDrag(ctx, app.drag);
}

function drawTerrain(ctx: CanvasRenderingContext2D, app: App, t: Terrain) {
  const a = worldToScreen(app.camera, t.x, t.y);
  const b = worldToScreen(app.camera, t.x + t.w, t.y + t.h);
  ctx.fillStyle = t.kind === "cover" ? COLOR.cover : t.kind === "highground" ? COLOR.highGround : COLOR.choke;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#cfe0c0";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(t.kind === "cover" ? "cover" : t.kind === "highground" ? "high ground" : "broken", a.x + 4, a.y + 3);
}

function drawAura(ctx: CanvasRenderingContext2D, app: App, o: Unit) {
  const p = worldToScreen(app.camera, o.x, o.y);
  ctx.strokeStyle = COLOR.aura;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PRESENCE.radius * app.camera.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFlash(ctx: CanvasRenderingContext2D, app: App, f: App["state"]["flashes"][number]) {
  const a = worldToScreen(app.camera, f.ax, f.ay);
  const b = worldToScreen(app.camera, f.bx, f.by);
  ctx.strokeStyle = f.kind === "flank" ? COLOR.flank : f.kind === "melee" ? COLOR.melee : COLOR.fire;
  ctx.globalAlpha = clamp(f.ttl / FLASH.ttl, 0, 1);
  ctx.lineWidth = f.kind === "fire" ? 1.2 : 2.2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function unitColor(u: Unit): string {
  if (u.state === "routing" || u.state === "down") return COLOR.routing;
  if (u.kind === "officer") return u.side === "player" ? COLOR.playerOfficer : COLOR.enemyOfficer;
  return u.side === "player" ? COLOR.player : COLOR.enemy;
}

function drawUnit(ctx: CanvasRenderingContext2D, app: App, u: Unit) {
  if (u.state === "down") return;
  const p = worldToScreen(app.camera, u.x, u.y);
  const r = UNIT[u.kind].size * app.camera.scale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(u.facing * DEG);
  ctx.fillStyle = unitColor(u);
  if (u.kind === "officer") {
    // diamond
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r);
    ctx.closePath();
    ctx.fill();
  } else {
    // small triangle pointing along facing
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, -r * 0.8);
    ctx.lineTo(-r * 0.8, r * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  // facing tick
  ctx.strokeStyle = COLOR.facing;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(r + 4, 0);
  ctx.stroke();
  ctx.restore();

  if (app.selected.has(u.id)) {
    ctx.strokeStyle = COLOR.selection;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, app: App, u: Unit) {
  if (u.state === "down") return;
  const p = worldToScreen(app.camera, u.x, u.y);
  const r = UNIT[u.kind].size * app.camera.scale;
  const bw = 22;
  const by = p.y - r - 9;
  // morale bar (colour by state)
  const col = u.state === "steady" ? COLOR.moraleSteady : u.state === "wavering" ? COLOR.moraleWaver : COLOR.moraleRout;
  ctx.fillStyle = COLOR.barBack;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(p.x - bw / 2 - 1, by - 1, bw + 2, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.fillRect(p.x - bw / 2, by, bw * clamp(u.morale / 100, 0, 1), 3);
  // hp pips
  for (let i = 0; i < u.maxHp; i++) {
    ctx.fillStyle = i < u.hp ? COLOR.hp : "#00000088";
    ctx.fillRect(p.x - bw / 2 + i * 5, by - 5, 3, 3);
  }
  // officer names only (pirates would clutter)
  if (u.kind === "officer") {
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = u.side === "player" ? "#dbeeff" : "#ffdcd4";
    ctx.fillText(u.name, p.x, by - 7);
  }
}

function drawDrag(ctx: CanvasRenderingContext2D, d: DragBox) {
  const x = Math.min(d.x0, d.x1);
  const y = Math.min(d.y0, d.y1);
  ctx.strokeStyle = COLOR.dragBox;
  ctx.fillStyle = COLOR.dragBox;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
  ctx.globalAlpha = 1;
}
