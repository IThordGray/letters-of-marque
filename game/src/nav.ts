import type { World, NavGrid } from "./world";
import { WORLD } from "./constants";

// Pathfinding over a coarse grid: cells that a building occupies (plus a small margin so
// figures don't clip walls) are blocked; A* routes around them. Cheap and good enough at
// skirmish scale — paths are cached on the unit and only recomputed when the goal moves.

const CELL = 48;
const MARGIN = 12;

export function buildNavGrid(world: World): NavGrid {
  const cell = CELL;
  const cols = Math.ceil(WORLD.width / cell);
  const rows = Math.ceil(WORLD.height / cell);
  const blocked = new Uint8Array(cols * rows);
  for (const b of world.buildings) {
    const c0 = Math.max(0, Math.floor((b.x - MARGIN) / cell));
    const c1 = Math.min(cols - 1, Math.floor((b.x + b.w + MARGIN) / cell));
    const r0 = Math.max(0, Math.floor((b.y - MARGIN) / cell));
    const r1 = Math.min(rows - 1, Math.floor((b.y + b.h + MARGIN) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
    }
  }
  return { cols, rows, cell, blocked };
}

function walkable(g: NavGrid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.blocked[r * g.cols + c] === 0;
}

// If (c,r) is blocked, spiral out to the nearest walkable cell (a figure or target sitting
// against a wall lands in a blocked cell).
function nearestWalkable(g: NavGrid, c: number, r: number): [number, number] | null {
  if (walkable(g, c, r)) return [c, r];
  for (let rad = 1; rad < 16; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue; // ring only
        if (walkable(g, c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
  }
  return null;
}

// A* from (sx,sy) to (tx,ty). Returns cell-centre waypoints, or undefined if no path (the
// caller falls back to a straight line + wall-slide).
export function findPath(world: World, sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] | undefined {
  const g = world.navGrid;
  if (!g) return undefined;
  const s = nearestWalkable(g, Math.floor(sx / g.cell), Math.floor(sy / g.cell));
  const t = nearestWalkable(g, Math.floor(tx / g.cell), Math.floor(ty / g.cell));
  if (!s || !t) return undefined;
  const [sc, sr] = s;
  const [tc, tr] = t;
  if (sc === tc && sr === tr) return undefined;
  const start = sr * g.cols + sc;
  const goal = tr * g.cols + tc;

  const h = (i: number) => {
    const dc = Math.abs((i % g.cols) - tc);
    const dr = Math.abs(((i / g.cols) | 0) - tr);
    return dc + dr + (Math.SQRT2 - 2) * Math.min(dc, dr); // octile distance
  };

  const gScore = new Map<number, number>([[start, 0]]);
  const fScore = new Map<number, number>([[start, h(start)]]);
  const came = new Map<number, number>();
  const open: number[] = [start];
  const inOpen = new Set<number>([start]);
  let iter = 0;

  while (open.length) {
    if (++iter > 40000) break; // safety cap
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if ((fScore.get(open[i]) ?? Infinity) < (fScore.get(open[bi]) ?? Infinity)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    inOpen.delete(cur);
    if (cur === goal) return reconstruct(g, came, cur);
    const cc = cur % g.cols;
    const cr = (cur / g.cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (!walkable(g, nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (!walkable(g, cc + dc, cr) || !walkable(g, cc, cr + dr))) continue; // no corner cutting
        const ni = nr * g.cols + nc;
        const tentative = (gScore.get(cur) ?? Infinity) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (tentative < (gScore.get(ni) ?? Infinity)) {
          came.set(ni, cur);
          gScore.set(ni, tentative);
          fScore.set(ni, tentative + h(ni));
          if (!inOpen.has(ni)) {
            open.push(ni);
            inOpen.add(ni);
          }
        }
      }
    }
  }
  return undefined;
}

function reconstruct(g: NavGrid, came: Map<number, number>, cur: number): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let i: number | undefined = cur;
  while (i !== undefined) {
    path.push({ x: (i % g.cols) * g.cell + g.cell / 2, y: ((i / g.cols) | 0) * g.cell + g.cell / 2 });
    i = came.get(i);
  }
  return path.reverse();
}

// Keep paths this far off walls (> the movement collision margin) so figures round corners
// wide instead of pinning on the exact corner.
const CLEAR = 20;

function segIntersectsRect(x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - rx],
    [dx, rx + rw - x0],
    [-dy, y0 - ry],
    [dy, ry + rh - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

// Is the line (x0,y0)-(x1,y1) too close to a building to walk along? Buildings are inflated
// by CLEAR so string-pulling keeps a berth (unlike combat's exact fire LOS).
export function pathBlocked(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  for (const b of world.buildings) {
    if (segIntersectsRect(x0, y0, x1, y1, b.x - CLEAR, b.y - CLEAR, b.w + 2 * CLEAR, b.h + 2 * CLEAR)) return true;
  }
  return false;
}
