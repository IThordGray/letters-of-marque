import "./style.css";
import type { App } from "./app";
import type { PartySpec } from "./spawn";
import { makeWorld } from "./world";
import { populateBattle } from "./spawn";
import { makeCamera } from "./camera";
import { render } from "./render";
import { installInput, updateCamera } from "./input";
import { installUI } from "./ui";
import { startLoop } from "./loop";
import { stepMovement, stepSeparation } from "./movement";
import { stepCombat } from "./combat";
import { stepMorale } from "./morale";
import { stepRaid } from "./raid";
import { stepPatrol } from "./patrol";
import { stepAI } from "./ai";
import { signal } from "./log";
import { SIM } from "./constants";
import { makeRoster } from "./roster";

// Bootstrap a battle from the chosen landing party, then run the sim loop.
function startBattle(spec: PartySpec) {
  const canvas = document.createElement("canvas");
  canvas.id = "game";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  const world = makeWorld();
  populateBattle(world, spec);
  signal(world, "The landing party comes ashore.");

  const app: App = {
    world,
    camera: makeCamera(window.innerWidth, window.innerHeight),
    selected: new Set(),
    inspected: null,
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
      stepAI(world);
      stepPatrol(world);
      stepMovement(world, dt);
      stepCombat(world, dt);
      stepMorale(world, dt);
      stepRaid(world, dt);
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
}

// Deploy screen disabled for now (KAN-64) — start straight into a battle with a balanced
// preset crew. Re-enable by importing showDeployScreen from "./deploy" and calling
// showDeployScreen(startBattle) here instead.
const roster = makeRoster();
startBattle({
  squads: [
    { officer: roster.officers[0] ?? null, pirates: 6, weapon: "musket" }, // firing line
    { officer: roster.officers[1] ?? null, pirates: 5, weapon: "pistol" }, // pistol & cutlass — shock troops
    { officer: roster.officers[2] ?? null, pirates: 3, weapon: "musket" }, // a second musket squad
  ],
});
