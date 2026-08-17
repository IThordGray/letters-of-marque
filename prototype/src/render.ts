import type { App } from "./app";
import type { Ship, Group } from "./types";
import { WORLD, COLOR, SHIP_CLASS, GUN, FLASH } from "./constants";
import { DEG, clamp } from "./math";
import { applyWorldTransform, worldToScreen } from "./camera";

const ARENA_CX = WORLD.width / 2;
const ARENA_CY = WORLD.height / 2;

export function render(ctx: CanvasRenderingContext2D, app: App, w: number, h: number) {
  const { camera, state } = app;

  // --- water (screen space) ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLOR.water;
  ctx.fillRect(0, 0, w, h);

  // --- world space ---
  applyWorldTransform(ctx, camera);
  const lw = 1 / camera.scale;

  drawArena(ctx, lw);
  drawWindArrow(ctx, app, lw);

  const selected = state.groups.find((g) => g.id === app.selectedGroupId);
  if (selected?.moveTarget) drawMoveMarker(ctx, selected.moveTarget.x, selected.moveTarget.y, lw);

  for (const g of state.groups) drawTethers(ctx, app, g, lw);
  for (const s of state.ships.values()) drawWake(ctx, s);
  drawFlashes(ctx, app, lw);
  for (const s of state.ships.values()) drawShip(ctx, s, lw);

  // --- overlays in screen space (upright, crisp) ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const selShips = selected ? new Set(selected.shipIds) : new Set<number>();
  for (const s of state.ships.values()) drawOverlay(ctx, app, s, selShips.has(s.id));
}

function drawArena(ctx: CanvasRenderingContext2D, lw: number) {
  ctx.strokeStyle = COLOR.arenaBorder;
  ctx.lineWidth = lw * 2;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
}

function drawWindArrow(ctx: CanvasRenderingContext2D, app: App, lw: number) {
  const a = app.state.wind.toward * DEG;
  const len = 480;
  const hx = ARENA_CX + (Math.cos(a) * len) / 2;
  const hy = ARENA_CY + (Math.sin(a) * len) / 2;
  const tx = ARENA_CX - (Math.cos(a) * len) / 2;
  const ty = ARENA_CY - (Math.sin(a) * len) / 2;
  ctx.strokeStyle = COLOR.windArrow;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = lw * 8;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  // arrowhead
  const head = 48;
  ctx.lineTo(hx - Math.cos(a - 0.4) * head, hy - Math.sin(a - 0.4) * head);
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - Math.cos(a + 0.4) * head, hy - Math.sin(a + 0.4) * head);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawMoveMarker(ctx: CanvasRenderingContext2D, x: number, y: number, lw: number) {
  ctx.strokeStyle = COLOR.selection;
  ctx.lineWidth = lw * 1.5;
  ctx.globalAlpha = 0.8;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawTethers(ctx: CanvasRenderingContext2D, app: App, g: Group, lw: number) {
  if (g.cohesion !== "formed" || g.generalChase || g.formation === "loose") return;
  const cmd = app.state.ships.get(g.commanderId);
  if (!cmd || cmd.struck) return;
  ctx.strokeStyle = COLOR.tether;
  ctx.lineWidth = lw;
  ctx.globalAlpha = 0.6;
  for (const id of g.shipIds) {
    if (id === cmd.id) continue;
    const s = app.state.ships.get(id);
    if (!s || s.struck) continue;
    ctx.beginPath();
    ctx.moveTo(cmd.x, cmd.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawWake(ctx: CanvasRenderingContext2D, s: Ship) {
  if (s.wake.length < 2) return;
  ctx.strokeStyle = COLOR.wake;
  for (let i = 1; i < s.wake.length; i++) {
    const a = s.wake[i - 1];
    const b = s.wake[i];
    ctx.globalAlpha = (i / s.wake.length) * 0.35;
    ctx.lineWidth = (i / s.wake.length) * 3 + 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFlashes(ctx: CanvasRenderingContext2D, app: App, lw: number) {
  for (const f of app.state.flashes) {
    ctx.strokeStyle = f.rake ? COLOR.rake : COLOR.fire;
    ctx.globalAlpha = clamp(f.ttl / FLASH.ttl, 0, 1);
    ctx.lineWidth = lw * (f.rake ? 3 : 1.5);
    ctx.beginPath();
    ctx.moveTo(f.ax, f.ay);
    ctx.lineTo(f.bx, f.by);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx: CanvasRenderingContext2D, s: Ship, lw: number) {
  const cls = SHIP_CLASS[s.cls];
  const len = cls.size;
  const wid = cls.size * 0.5;
  let fill: string;
  if (s.struck) fill = COLOR.struck;
  else fill = s.faction === "player" ? COLOR.player : COLOR.enemy;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.heading * DEG);
  ctx.beginPath();
  ctx.moveTo(len, 0); // exaggerated bow
  ctx.lineTo(-len * 0.55, -wid);
  ctx.lineTo(-len * 0.35, 0);
  ctx.lineTo(-len * 0.55, wid);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.globalAlpha = s.struck ? 0.5 : 1;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = "#00000066";
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Screen-space, upright overlay: bars, labels, selection, commander mark.
function drawOverlay(ctx: CanvasRenderingContext2D, app: App, s: Ship, selected: boolean) {
  const p = worldToScreen(app.camera, s.x, s.y);
  const isCommander = app.state.groups.some((g) => g.commanderId === s.id && !s.struck);

  if (selected && !s.struck) {
    ctx.strokeStyle = COLOR.selection;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // hull + rigging bars
  const bw = 34;
  const bx = p.x - bw / 2;
  let by = p.y - 30;
  const hullFrac = clamp(s.hull / s.maxHull, 0, 1);
  const rigFrac = clamp(s.rigging / s.maxRigging, 0, 1);
  drawBar(ctx, bx, by, bw, 4, hullFrac, COLOR.hull);
  by += 5;
  drawBar(ctx, bx, by, bw, 4, rigFrac, COLOR.rigging);

  // label: surname + class initial (+ commander mark)
  const surname = s.captain.name.split(" ").pop() ?? s.shipName;
  const initial = s.cls === "sloop" ? "s" : "F";
  const label = `${isCommander ? "★ " : ""}${surname} (${initial})`;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = s.struck ? "#9aa0a6" : "#e8f4fb";
  ctx.globalAlpha = s.struck ? 0.7 : 1;
  ctx.fillText(label, p.x, by + 16);
  ctx.globalAlpha = 1;

  if (s.inIrons > 0) {
    ctx.fillStyle = "#ffd36b";
    ctx.fillText("in irons", p.x, by + 28);
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
) {
  ctx.fillStyle = COLOR.barBack;
  ctx.globalAlpha = 0.65;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * frac, h);
}

// exported so the UI can show the same range bands if wanted later
export const RANGE_BANDS = GUN.bands;
