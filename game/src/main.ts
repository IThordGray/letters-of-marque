import "./style.css";
import { makeWorld } from "./world";
import { populateTestBattle } from "./spawn";
import { render } from "./render";
import { startLoop } from "./loop";
import { SIM } from "./constants";

const canvas = document.createElement("canvas");
canvas.id = "game";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

function resize() {
  canvas.width = window.innerWidth; // CSS px == backing px (fine for programmer art)
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const world = makeWorld();
populateTestBattle(world);

startLoop({
  hz: SIM.hz,
  update: (dt) => {
    world.time += dt; // no unit systems yet — movement / combat arrive later
  },
  render: () => render(ctx, world, canvas.width, canvas.height),
});
