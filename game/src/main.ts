import "./style.css";
import type { App } from "./app";
import { makeWorld } from "./world";
import { populateTestBattle } from "./spawn";
import { stepMovement } from "./movement";
import { makeCamera } from "./camera";
import { render } from "./render";
import { installInput, updateCamera } from "./input";
import { startLoop } from "./loop";
import { SIM } from "./constants";

const canvas = document.createElement("canvas");
canvas.id = "game";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

const world = makeWorld();
populateTestBattle(world);

const app: App = {
  world,
  camera: makeCamera(window.innerWidth, window.innerHeight),
  selected: new Set(),
  drag: null,
  held: new Set(),
  viewW: window.innerWidth,
  viewH: window.innerHeight,
};

function resize() {
  canvas.width = window.innerWidth; // CSS px == backing px (fine for programmer art)
  canvas.height = window.innerHeight;
  app.viewW = canvas.width;
  app.viewH = canvas.height;
}
window.addEventListener("resize", resize);
resize();

installInput(app, canvas);

startLoop({
  hz: SIM.hz,
  update: (dt) => {
    stepMovement(world, dt);
    world.time += dt;
  },
  frame: (realDt) => updateCamera(app, realDt),
  render: () => render(ctx, app),
});
