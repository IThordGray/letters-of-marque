import type { World } from "./world";
import type { Camera } from "./camera";

export type PanKey = "up" | "down" | "left" | "right";

// Shared mutable context handed to input, the camera, and the renderer. The one
// place the "current view + interaction" state lives, so no module has to thread
// it through every call.
export interface App {
  world: World;
  camera: Camera;
  held: Set<PanKey>; // camera pan keys currently down
  viewW: number; // viewport size, px
  viewH: number;
}
