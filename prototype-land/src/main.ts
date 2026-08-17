import "./style.css";
import type { App } from "./app";
import { makeInitialState } from "./setup";
import { makeCamera, resizeCamera } from "./camera";
import { stepSim } from "./sim";
import { render } from "./render";
import { installUI } from "./ui";
import { installInput } from "./input";
import { finalize } from "./instrumentation";
import { SIM } from "./constants";

const canvas = document.createElement("canvas");
canvas.id = "field";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

const app: App = {
  state: makeInitialState(),
  camera: makeCamera(),
  selected: new Set<number>(),
  drag: null,
  paused: false,
  timeScale: 1,
  running: true,
};

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  resizeCamera(app.camera, w, h);
}
window.addEventListener("resize", resize);
resize();

const ui = installUI(app, { newBattle: () => location.reload() });
installInput(app, canvas);

const STEP = SIM.dt;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  const realDt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (!app.paused && !app.state.over) {
    acc += realDt * app.timeScale;
    let steps = 0;
    while (acc >= STEP && steps < 600) {
      stepSim(app.state, STEP);
      acc -= STEP;
      steps++;
    }
  } else {
    acc = 0;
  }

  if (app.state.over && app.running) {
    app.running = false;
    finalize(app.state.outcome, app.state.time * 1000);
  }

  render(ctx, app, canvas.width, canvas.height);
  ui.refresh();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
