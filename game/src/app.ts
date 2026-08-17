import type { World } from "./world";
import type { Camera } from "./camera";

export type PanKey = "up" | "down" | "left" | "right";

// A left-drag marquee, in screen pixels.
export interface DragBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Shared mutable context handed to input, the camera, and the renderer. The one
// place the "current view + interaction" state lives, so no module has to thread
// it through every call.
export interface App {
  world: World;
  camera: Camera;
  selected: Set<number>; // selected player unit ids
  drag: DragBox | null; // active left-drag box-select
  held: Set<PanKey>; // camera pan keys currently down
  viewW: number; // viewport size, px
  viewH: number;
}
