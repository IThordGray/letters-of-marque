import type { GameState } from "./types";

export interface TerrainAt {
  cover: boolean;
  highGround: boolean;
  choke: boolean;
}

function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function terrainAt(state: GameState, x: number, y: number): TerrainAt {
  const at: TerrainAt = { cover: false, highGround: false, choke: false };
  for (const t of state.terrain) {
    if (!inRect(x, y, t)) continue;
    if (t.kind === "cover") at.cover = true;
    else if (t.kind === "highground") at.highGround = true;
    else if (t.kind === "choke") at.choke = true;
  }
  return at;
}
