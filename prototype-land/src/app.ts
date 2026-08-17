import type { GameState } from "./types";
import type { Camera } from "./camera";

// A left-drag selection box, in screen pixels.
export interface DragBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface App {
  state: GameState;
  camera: Camera;
  selected: Set<number>; // selected unit ids (player figures)
  drag: DragBox | null;
  paused: boolean;
  timeScale: number;
  running: boolean;
}
