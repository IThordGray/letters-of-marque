// Letters of Marque — look spike.
//
// One scene, one question: does §5's art direction read as a real place when
// every object is a box and the only art is light? Throwaway. Nothing here is
// durable, nothing imports it, and no renderer is chosen by its existing.

import * as THREE from "three";
import { CAMERA, FRAME_UNITS, SKY, SUN } from "./constants";
import { buildTerrain } from "./terrain";
import { buildSea } from "./sea";
import { buildProps } from "./props";
import { buildSmoke } from "./smoke";
import { TOWN, groundAt } from "./place";

const DEG = Math.PI / 180;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY.fogColour, SKY.fogNear, SKY.fogFar);

const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, innerWidth / innerHeight, 2, 12000);

// ---- Sky: one inverted sphere, two colours, one draw ------------------------
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(SKY.top) },
        horizon: { value: new THREE.Color(SKY.horizon) },
      },
      vertexShader: `varying float vH;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vH = normalize(w.xyz).y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying float vH;
        void main() {
          gl_FragColor = vec4(mix(horizon, top, clamp(vH * 1.6, 0.0, 1.0)), 1.0);
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);
}

// ---- Light. §5.5: this is where the production value comes from ------------
const sun = new THREE.DirectionalLight(SUN.colour, SUN.intensity);
{
  const el = SUN.elevationDeg * DEG;
  const az = SUN.azimuthDeg * DEG;
  const d = 2600;
  sun.position.set(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d, Math.cos(el) * Math.sin(az) * d);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SUN.shadowMapSize, SUN.shadowMapSize);
  const c = sun.shadow.camera;
  const half = FRAME_UNITS * 0.62;
  c.left = -half;
  c.right = half;
  c.top = half;
  c.bottom = -half;
  c.near = 1;
  c.far = d * 2.4;
  c.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.4;
  scene.add(sun, sun.target);
}
scene.add(new THREE.HemisphereLight(SUN.skyColour, SUN.groundColour, SUN.ambientIntensity));

// ---- The place --------------------------------------------------------------
const terrain = buildTerrain();
scene.add(terrain);

const sea = buildSea();
scene.add(sea.floor, sea.mesh);

const props = buildProps();
scene.add(props.houses, props.roofs, props.walls, props.trees);

const smoke = buildSmoke(props.chimneys);
scene.add(smoke.mesh);

// ---- Camera rig (§5.3): free yaw, free zoom, pitch starts at ~62 deg -------
const target = new THREE.Vector3(TOWN.x, groundAt(TOWN.x, TOWN.z) + 20, TOWN.z);
// A view is nameable: #yaw=138&polar=34&dist=900. Comparing framings is the
// whole job of this spike, so it is worth five lines not to have to re-edit
// constants to look at one.
const hash = new URLSearchParams(location.hash.slice(1));
const num = (k: string, fallback: number) => (hash.has(k) ? Number(hash.get(k)) : fallback);
let yaw = num("yaw", CAMERA.yawStartDeg) * DEG;
let polar = num("polar", CAMERA.polarStartDeg) * DEG;
let radius: number = num("dist", CAMERA.distanceStart);

function placeCamera(): void {
  const s = Math.sin(polar);
  camera.position.set(
    target.x + radius * s * Math.cos(yaw),
    target.y + radius * Math.cos(polar),
    target.z + radius * s * Math.sin(yaw),
  );
  camera.lookAt(target);
}

{
  const el = renderer.domElement;
  let dragging = 0;
  let lastX = 0;
  let lastY = 0;
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("pointerdown", (e) => {
    dragging = e.button === 0 && !e.shiftKey ? 1 : 2;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointerup", (e) => {
    dragging = 0;
    el.releasePointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (dragging === 1) {
      yaw -= dx * 0.005;
      polar = Math.min(CAMERA.polarMaxDeg * DEG, Math.max(CAMERA.polarMinDeg * DEG, polar - dy * 0.004));
    } else {
      const k = radius * 0.0016;
      const right = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
      const fwd = new THREE.Vector3(-Math.cos(yaw), 0, -Math.sin(yaw));
      target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
    }
  });
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      radius = Math.min(CAMERA.distanceMax, Math.max(CAMERA.distanceMin, radius * Math.exp(e.deltaY * 0.0012)));
    },
    { passive: false },
  );
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Readout. [P-39]: no performance claim without a measurement -----------
const readout = document.getElementById("readout") as HTMLDivElement;
let ema = 16.7; // wall-clock interval between frames — vsync-capped
let cpuEma = 0; // work done inside the frame callback
let worst = 0;
let sinceReport = 0;
const counts =
  `${props.houses.count} houses · ${props.roofs.count} roofs · ` +
  `${props.walls.count} wall · ${props.trees.count} trees · ${smoke.mesh.count} puffs`;
const tris = terrain.geometry.getAttribute("position").count / 3;

let prev = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;

  sea.step(dt);
  smoke.step(dt, camera);
  placeCamera();
  renderer.render(scene, camera);

  const cpu = performance.now() - now;
  const interval = dt * 1000;
  ema += (interval - ema) * 0.08;
  cpuEma += (cpu - cpuEma) * 0.08;
  if (interval > worst) worst = interval;
  sinceReport += dt;
  if (sinceReport > 0.25) {
    sinceReport = 0;
    readout.textContent =
      `${ema.toFixed(2)} ms/frame (${(1000 / ema).toFixed(0)} fps, worst ${worst.toFixed(1)} ms) · ` +
      `${cpuEma.toFixed(2)} ms CPU in-frame\n` +
      `${renderer.info.render.calls} draw calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k triangles drawn\n` +
      `terrain ${(tris / 1000).toFixed(0)}k tris · ${counts}\n` +
      `drag = orbit · shift-drag / right-drag = pan · wheel = zoom`;
    worst = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
