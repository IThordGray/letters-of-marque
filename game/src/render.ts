import type { App } from "./app";
import type { Unit } from "./types";
import { WORLD, COLOR, UNIT, FLASH, PRESENCE, RAID } from "./constants";
import { worldToScreen } from "./camera";

function unitColor(u: Unit): string {
  if (u.state === "routing") return COLOR.routing; // routers wash out to grey
  if (u.side === "player") return u.kind === "officer" ? COLOR.playerOfficer : COLOR.player;
  return u.kind === "officer" ? COLOR.enemyOfficer : COLOR.enemy;
}
function moraleColor(u: Unit): string {
  return u.state === "routing" ? COLOR.moraleRout : u.state === "wavering" ? COLOR.moraleWaver : COLOR.moraleGood;
}

export function render(ctx: CanvasRenderingContext2D, app: App) {
  const { camera: cam, world, viewW: w, viewH: h } = app;

  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, w, h);

  const tl = worldToScreen(cam, 0, 0, w, h);
  const br = worldToScreen(cam, WORLD.width, WORLD.height, w, h);
  ctx.fillStyle = COLOR.field;
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.strokeStyle = COLOR.fieldEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

  // terrain features (translucent patches)
  for (const t of world.terrain) {
    const a = worldToScreen(cam, t.x, t.y, w, h);
    const b2 = worldToScreen(cam, t.x + t.w, t.y + t.h, w, h);
    ctx.fillStyle = t.kind === "cover" ? COLOR.cover : t.kind === "highGround" ? COLOR.highGround : COLOR.choke;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(a.x, a.y, b2.x - a.x, b2.y - a.y);
    ctx.globalAlpha = 1;
  }

  // the raid objective — a marked prize behind the defenders
  const obj = world.raid.objective;
  if (obj) {
    const c = worldToScreen(cam, obj.x, obj.y, w, h);
    const s = Math.max(RAID.objectiveRadius * cam.zoom, 6);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.PI / 4); // a diamond reads as "objective", not a terrain rect
    ctx.fillStyle = obj.seized ? COLOR.objectiveDone : COLOR.objective;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = COLOR.outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
    if (!obj.seized && obj.seizeProgress > 0) {
      ctx.strokeStyle = COLOR.objectiveRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, s + 6, -Math.PI / 2, -Math.PI / 2 + (obj.seizeProgress / RAID.seizeTime) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = COLOR.text;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(obj.seized ? "Strongbox — seized" : "Strongbox", c.x, c.y - s - 8);
    ctx.textAlign = "left";
  }

  // the fallen first, dim, so the living draw over them
  for (const u of world.units) {
    if (u.state !== "down") continue;
    const p = worldToScreen(cam, u.x, u.y, w, h);
    ctx.fillStyle = COLOR.dead;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(UNIT[u.kind].size * cam.zoom * 0.8, 2), 0, Math.PI * 2);
    ctx.fill();
  }

  // the living — discs (routers grey), officers ringed, selection ringed white,
  // with a thin hp bar and a morale bar (morale is the real "health")
  let standing = 0;
  for (const u of world.units) {
    if (u.state === "down") continue;
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
      if (u.state !== "routing") {
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = COLOR.aura;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PRESENCE.radius * cam.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (app.selected.has(u.id)) {
      ctx.strokeStyle = COLOR.selection;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (app.inspected === u.id) {
      ctx.strokeStyle = COLOR.inspect;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // bars above the figure: hp (thin) then morale (thicker, coloured by state)
    const bw = Math.max(rad * 2, 9);
    const bx = p.x - bw / 2;
    const byHp = p.y - rad - 10;
    ctx.fillStyle = COLOR.hpBack;
    ctx.fillRect(bx, byHp, bw, 2);
    const hpFrac = u.hp / u.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? COLOR.hpGood : hpFrac > 0.25 ? COLOR.hpMid : COLOR.hpLow;
    ctx.fillRect(bx, byHp, bw * hpFrac, 2);
    const byM = byHp + 3;
    ctx.fillStyle = COLOR.hpBack;
    ctx.fillRect(bx, byM, bw, 3);
    ctx.fillStyle = moraleColor(u);
    ctx.fillRect(bx, byM, bw * (u.morale / 100), 3);

    // stance pip below the figure (not while routing)
    if (u.state !== "routing") {
      ctx.fillStyle =
        u.stance === "aggressive" ? COLOR.stanceAggressive : u.stance === "holdGround" ? COLOR.stanceHold : COLOR.stanceCease;
      ctx.beginPath();
      ctx.arc(p.x, p.y + rad + 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // shot flashes (fade over their ttl)
  ctx.lineWidth = 1;
  for (const f of world.flashes) {
    const a = worldToScreen(cam, f.ax, f.ay, w, h);
    const b = worldToScreen(cam, f.bx, f.by, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / FLASH.ttl));
    ctx.strokeStyle = f.kind === "melee" ? COLOR.melee : COLOR.fire;
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
    if (u.state === "down" || !u.moveTarget || !app.selected.has(u.id)) continue;
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

  // hud line
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
