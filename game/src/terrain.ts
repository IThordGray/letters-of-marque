import type { World } from "./world";
import type { TerrainKind } from "./types";

// The terrain kind at a world point, or null on open ground. Regions are simple
// axis-aligned rectangles; first match wins.
export function terrainAt(world: World, x: number, y: number): TerrainKind | null {
  for (const t of world.terrain) {
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t.kind;
  }
  return null;
}
