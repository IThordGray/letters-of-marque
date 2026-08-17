import type { GameState } from "./types";
import type { Camera } from "./camera";

// The whole mutable app state, one plain object passed to render/ui/input.
export interface App {
  state: GameState;
  camera: Camera;
  selectedGroupId: number; // which player group the order hotkeys/UI act on
  paused: boolean;
  timeScale: number; // 1 | 2 | 4
  rotateDir: number; // -1 (Q) / 0 / +1 (E) while held
  rotateGestureActive: boolean; // a Q/E hold is in progress (for rotation counting)
  running: boolean; // false once the battle-end screen is up
}
