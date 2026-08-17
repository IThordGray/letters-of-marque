import "./style.css";
import type { App } from "./app";
import { makeWorld } from "./world";
import { populateTestBattle } from "./spawn";
import { makeCamera } from "./camera";
import { render } from "./render";
import { installInput, updateCamera } from "./input";
import { installUI } from "./ui";
import { startLoop } from "./loop";
import { stepMovement, stepSeparation } from "./movement";
import { stepCombat } from "./combat";
import { signal } from "./log";
import { SIM } from "./constants";

const canvas = document.createElement("canvas");
canvas.id = "game";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

const world = makeWorld();
populateTestBattle(world);
signal(world, "The bands take the field.");

const app: App = {
  world,
  camera: makeCamera(window.innerWidth, window.innerHeight),
  selected: new Set(),
  drag: null,
  held: new Set(),
  formation: "tight",
  attackArmed: false,
  paused: false,
  timeScale: 1,
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
const ui = installUI(app);

startLoop({
  hz: SIM.hz,
  update: (dt) => {
    stepMovement(world, dt);
    stepCombat(world, dt);
    stepSeparation(world);
    world.time += dt;
  },
  frame: (realDt) => updateCamera(app, realDt),
  render: () => {
    render(ctx, app);
    ui.refresh();
  },
  speed: () => (app.paused ? 0 : app.timeScale),
});
