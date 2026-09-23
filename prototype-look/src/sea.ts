// The sea. §5.1 is explicit: stylised, NEVER simulated. No displacement, no
// screen-space reflection, no subsurface anything. One plane at height zero, a
// saturated blue-green, one scrolling procedural normal layer for glints, and
// enough transparency that the shoal band painted into the terrain shows
// through as turquoise shallows.
//
// The shoreline foam is not here at all — it is a colour band in the terrain
// (`constants.ts`, BANDS), so surf follows every cove exactly and costs zero
// geometry and zero shader work.

import * as THREE from "three";
import { SEA, FRAME_UNITS } from "./constants";
import { jitter } from "./place";

// A small value-noise height field turned into a normal map on the CPU once.
function rippleTexture(size: number): THREE.DataTexture {
  const height = new Float32Array(size * size);
  const lattice = (ix: number, iy: number) => jitter(ix & 1023, iy & 1023);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let amp = 1;
      let norm = 0;
      for (let o = 0; o < 3; o++) {
        const cells = 4 << o;
        const u = (x / size) * cells;
        const v = (y / size) * cells;
        const ix = Math.floor(u);
        const iy = Math.floor(v);
        const fx = smooth(u - ix);
        const fy = smooth(v - iy);
        // Wrap the lattice so the tile repeats without a seam.
        const w = (i: number) => ((i % cells) + cells) % cells;
        const a = lattice(w(ix) + o * 97, w(iy) + o * 61);
        const b = lattice(w(ix + 1) + o * 97, w(iy) + o * 61);
        const c = lattice(w(ix) + o * 97, w(iy + 1) + o * 61);
        const d = lattice(w(ix + 1) + o * 97, w(iy + 1) + o * 61);
        sum += (a + (b - a) * fx + (c + (d - c) * fx - (a + (b - a) * fx)) * fy) * amp;
        norm += amp;
        amp *= 0.5;
      }
      height[y * size + x] = sum / norm;
    }
  }

  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * SEA.rippleStrength * size * 0.02;
      const dy = (at(x, y + 1) - at(x, y - 1)) * SEA.rippleStrength * size * 0.02;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(SEA.rippleRepeat, SEA.rippleRepeat);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export interface Sea {
  mesh: THREE.Mesh;
  floor: THREE.Mesh;
  step(dt: number): void;
}

export function buildSea(): Sea {
  const ripple = rippleTexture(SEA.ripplePx);
  const mat = new THREE.MeshStandardMaterial({
    color: SEA.colour,
    // A low sun puts N.L at 0.28 on a flat plane, which drains the colour the
    // direction is built on. The sea keeps a little light of its own — the
    // stylised half of "stylised, never simulated".
    emissive: new THREE.Color(SEA.emissive),
    emissiveIntensity: SEA.emissiveIntensity,
    roughness: SEA.roughness,
    metalness: 0.02,
    transparent: true,
    opacity: SEA.opacity,
    normalMap: ripple,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
  // Big enough to run past the window and out to the fog.
  const geom = new THREE.PlaneGeometry(FRAME_UNITS * 3, FRAME_UNITS * 3, 1, 1);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, mat);
  // NOT receiving shadows, and the reason is worth keeping: the sea runs out
  // past the shadow camera's box, and everything outside that box reads as
  // shadowed — a hard-edged grey quadrilateral lying on the water. Covering
  // the whole sea with the shadow frustum would spend the map's resolution on
  // water. Shadows belong to the land here.
  mesh.receiveShadow = false;
  mesh.name = "sea";
  mesh.renderOrder = 1;

  // An opaque floor under the open water. Without it the terrain tile's own
  // seabed shows through the translucent surface as a hard-edged darker
  // rectangle wherever the tile happens to end — the crop leaking into the
  // picture. The floor sits just below the depth the shallows stop reading at,
  // so shoal colour still shows near the shore and everything deeper is one
  // flat blue-green.
  const floorGeom = new THREE.PlaneGeometry(FRAME_UNITS * 3, FRAME_UNITS * 3, 1, 1);
  floorGeom.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    floorGeom,
    new THREE.MeshBasicMaterial({ color: SEA.floorColour, fog: true }),
  );
  floor.position.y = SEA.floorUnits;
  floor.name = "seafloor";

  let t = 0;
  return {
    mesh,
    floor,
    step(dt: number) {
      t += dt;
      ripple.offset.set(t * SEA.driftPerSec, t * SEA.driftPerSec * 0.6);
    },
  };
}
