// Everything that stands on the ground, as instanced draws.
//
// [P-62] — do not build an object tree for the renderer to walk. There is ONE
// InstancedMesh per distinct mesh type (house box, gable roof, wall segment,
// tree) and instance matrices are written into it. Forty buildings would run
// fine either way; this is here so the spike tells the truth about what three
// thousand would cost, which is the only reason to measure at all.

import * as THREE from "three";
import { TREES, SCALE, PLACE, FRAME_UNITS, EDGE_MARGIN } from "./constants";
import { BUILDINGS, WALL_TRACE, ROOF, WALLS, BODY_HEIGHT } from "./town";
import type { Building } from "./town";
import { TOWN, TOWN_BEARING, townToScene, groundAt, rawAt, jitter } from "./place";

const DEG = Math.PI / 180;

// A gable roof: ridge along local +x, footprint 1x1, rise 1. Non-indexed, so
// the four planes are flat-shaded without asking the material for anything.
function gableGeometry(): THREE.BufferGeometry {
  const a: [number, number, number] = [-0.5, 0, -0.5];
  const b: [number, number, number] = [0.5, 0, -0.5];
  const c: [number, number, number] = [0.5, 0, 0.5];
  const d: [number, number, number] = [-0.5, 0, 0.5];
  const r0: [number, number, number] = [-0.5, 1, 0];
  const r1: [number, number, number] = [0.5, 1, 0];
  const faces: [number, number, number][][] = [
    [a, r1, b], [a, r0, r1], // the slope facing -z
    [c, r0, d], [c, r1, r0], // the slope facing +z
    [a, d, r0], // the -x gable end
    [b, r1, c], // the +x gable end
  ];
  const pos = new Float32Array(faces.length * 9);
  let p = 0;
  for (const f of faces) for (const v of f) { pos[p++] = v[0]; pos[p++] = v[1]; pos[p++] = v[2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function instanced(geom: THREE.BufferGeometry, count: number, name: string): THREE.InstancedMesh {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, flatShading: true });
  const m = new THREE.InstancedMesh(geom, mat, count);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = name;
  m.count = 0; // filled as instances are written
  return m;
}

// Local (x, z) rotated about +Y by θ, matching three's rotation matrix.
function rot2(lx: number, lz: number, cos: number, sin: number): [number, number] {
  return [lx * cos + lz * sin, -lx * sin + lz * cos];
}

export interface TownMeshes {
  houses: THREE.InstancedMesh;
  roofs: THREE.InstancedMesh;
  walls: THREE.InstancedMesh;
  trees: THREE.InstancedMesh;
  chimneys: { x: number; y: number; z: number }[];
}

export function buildProps(): TownMeshes {
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0); // origin at the base, so a scale is a height
  const gable = gableGeometry();
  const cone = new THREE.ConeGeometry(1, 1, 6);
  cone.translate(0, 0.5, 0);

  const all = [...BUILDINGS, ...WALL_TRACE];
  const houses = instanced(box, BUILDINGS.length, "houses");
  const roofs = instanced(gable, BUILDINGS.length, "roofs");
  const walls = instanced(box, WALL_TRACE.length, "walls");
  const trees = instanced(cone, TREES.count, "trees");

  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  const chimneys: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < all.length; i++) {
    const b: Building = all[i];
    const theta = TOWN_BEARING + b.rot * DEG;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const { x, z } = townToScene(b.along, b.inland);

    // Sit the box on the LOWEST of its four corners so nothing floats on a
    // slope; the uphill side simply buries itself. A hillside port is the
    // right answer here anyway — this shore is a 20-degree hill.
    let base = Infinity;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const [ox, oz] = rot2((sx * b.w) / 2, (sz * b.d) / 2, cos, sin);
      const g = groundAt(x + ox, z + oz);
      if (g < base) base = g;
    }
    base -= 1.5;

    const body = (b.h ?? BODY_HEIGHT[b.kind]) * (b.ruin ? 0.6 : 1);
    const top = groundAt(x, z) + body;
    const heightUnits = Math.max(top - base, 3);

    m.makeRotationY(theta);
    m.scale(new THREE.Vector3(b.w, heightUnits, b.d));
    m.setPosition(x, base, z);

    const wall = colour.setHex(WALLS[b.kind]).clone();
    const tone = 0.93 + jitter(i, 17) * 0.14;
    wall.multiplyScalar(b.ruin ? tone * 0.62 : tone);
    if (b.ruin) wall.lerp(new THREE.Color(0x6f6a5c), 0.45);

    const target = b.kind === "wall" ? walls : houses;
    const slot = target.count;
    target.setMatrixAt(slot, m);
    target.setColorAt(slot, wall);
    target.count = slot + 1;

    if (b.flat || b.ruin) continue;

    const rise = b.d * 0.55;
    m.makeRotationY(theta);
    m.scale(new THREE.Vector3(b.w, rise, b.d));
    m.setPosition(x, top, z);
    const roofSlot = roofs.count;
    roofs.setMatrixAt(roofSlot, m);
    roofs.setColorAt(roofSlot, colour.setHex(ROOF[b.kind]).multiplyScalar(0.92 + jitter(i, 41) * 0.16));
    roofs.count = roofSlot + 1;

    if (b.kind === "dwelling" && chimneys.length < 40) {
      const [ox, oz] = rot2(b.w * 0.3, 0, cos, sin);
      chimneys.push({ x: x + ox, y: top + rise * 1.05, z: z + oz });
    }
  }

  scatterTrees(trees);

  for (const mesh of [houses, roofs, walls, trees]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  return { houses, roofs, walls, trees, chimneys };
}

function scatterTrees(trees: THREE.InstancedMesh): void {
  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  const scratch = new THREE.Vector3();
  // Stop short of the window's tapered border, or the wood ends in a straight line.
  const halfSpan = FRAME_UNITS * (0.5 - EDGE_MARGIN);
  const cellNm = PLACE.windowNm / SCALE.grid;

  let placed = 0;
  for (let n = 0; placed < TREES.count && n < TREES.count * 14; n++) {
    const x = (jitter(n, 3) * 2 - 1) * halfSpan;
    const z = (jitter(n, 91) * 2 - 1) * halfSpan;
    const h = rawAt(x, z);
    if (h < TREES.minHeight || h > TREES.maxHeight) continue;
    // Bare rock has no trees on it, and neither does a cliff face.
    const drop = Math.abs(h - rawAt(x + cellNm * SCALE.unitsPerNm, z));
    if (drop > 0.03) continue;
    const dx = x - TOWN.x;
    const dz = z - TOWN.z;
    if (dx * dx + dz * dz < TREES.clearTownUnits * TREES.clearTownUnits) continue;

    const r = TREES.radiusUnits[0] + jitter(n, 7) * (TREES.radiusUnits[1] - TREES.radiusUnits[0]);
    const th = TREES.heightUnits[0] + jitter(n, 13) * (TREES.heightUnits[1] - TREES.heightUnits[0]);
    m.makeRotationY(jitter(n, 29) * Math.PI * 2);
    m.scale(scratch.set(r, th, r));
    m.setPosition(x, groundAt(x, z) - 1, z);
    trees.setMatrixAt(placed, m);
    const c = TREES.colours[Math.floor(jitter(n, 53) * TREES.colours.length) % TREES.colours.length];
    trees.setColorAt(placed, colour.setHex(c).multiplyScalar(0.88 + jitter(n, 67) * 0.24));
    placed++;
  }
  trees.count = placed;
}
