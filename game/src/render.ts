import type { World } from "./world";
import type { Unit } from "./types";
import { WORLD, COLOR, UNIT } from "./constants";

// Placeholder view: fit the whole world on screen, centred. The pan/zoom camera
// (KAN-5) replaces this — all drawing goes through this one mapping, so the swap
// stays a one-file change.
interface View {
  scale: number;
  ox: number;
  oy: number;
}
function fitView(w: number, h: number): View {
  const scale = Math.min(w / WORLD.width, h / WORLD.height) * 0.92;
  return { scale, ox: (w - WORLD.width * scale) / 2, oy: (h - WORLD.height * scale) / 2 };
}

function unitColor(u: Unit): string {
  if (u.side === "player") return u.kind === "officer" ? COLOR.playerOfficer : COLOR.player;
  return u.kind === "officer" ? COLOR.enemyOfficer : COLOR.enemy;
}

export function render(ctx: CanvasRenderingContext2D, world: World, w: number, h: number) {
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, w, h);

  const view = fitView(w, h);

  // the field and its edge
  ctx.fillStyle = COLOR.field;
  ctx.fillRect(view.ox, view.oy, WORLD.width * view.scale, WORLD.height * view.scale);
  ctx.strokeStyle = COLOR.fieldEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(view.ox, view.oy, WORLD.width * view.scale, WORLD.height * view.scale);

  // the figures — coloured discs, officers ringed
  for (const u of world.units) {
    const sx = view.ox + u.x * view.scale;
    const sy = view.oy + u.y * view.scale;
    const r = Math.max(UNIT[u.kind].size * view.scale, 2.5);
    ctx.fillStyle = unitColor(u);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    if (u.kind === "officer") {
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // hud line (proof of life; goes away once there's real UI)
  ctx.fillStyle = COLOR.text;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`Land module · ${world.units.length} figures · sim ${world.time.toFixed(1)}s`, view.ox + 12, view.oy + 24);
}
