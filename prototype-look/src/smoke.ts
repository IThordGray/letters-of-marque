// Chimney smoke. §5.5 calls smoke the hero effect and says to over-invest in
// it; this is the cheap end of that — billboarded quads on ONE InstancedMesh,
// matrices rewritten per frame, one draw call however many puffs there are.

import * as THREE from "three";
import { SMOKE } from "./constants";
import { jitter } from "./place";

function puffTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - mid) / mid;
      const dy = (y - mid) / mid;
      const r = Math.sqrt(dx * dx + dy * dy);
      const soft = Math.max(0, 1 - r);
      const a = soft * (0.78 + 0.22 * jitter(x, y));
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface Smoke {
  mesh: THREE.InstancedMesh;
  step(dt: number, camera: THREE.Camera): void;
}

export function buildSmoke(chimneys: { x: number; y: number; z: number }[]): Smoke {
  const sources = chimneys.slice(0, SMOKE.chimneys);
  const count = sources.length * SMOKE.puffsPerChimney;

  const alpha = new Float32Array(count);
  const mat = new THREE.MeshBasicMaterial({
    color: SMOKE.colour,
    map: puffTexture(48),
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  // Per-instance opacity: three has no built-in for it, and eight lines of
  // shader injection is cheaper than any of the alternatives.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float aAlpha;\nvarying float vAlpha;\n" +
      shader.vertexShader.replace("void main() {", "void main() {\n\tvAlpha = aAlpha;");
    shader.fragmentShader =
      "varying float vAlpha;\n" +
      shader.fragmentShader.replace(
        "#include <alphamap_fragment>",
        "#include <alphamap_fragment>\n\tdiffuseColor.a *= vAlpha;",
      );
  };

  const geom = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  geom.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(alpha, 1));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.name = "smoke";

  // Ages are staggered so the column is already going when the scene opens.
  const age = new Float32Array(count);
  for (let i = 0; i < count; i++) age[i] = jitter(i, 5) * SMOKE.lifeSec;

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();

  return {
    mesh,
    step(dt: number, camera: THREE.Camera) {
      for (let i = 0; i < count; i++) {
        age[i] += dt;
        if (age[i] > SMOKE.lifeSec) age[i] -= SMOKE.lifeSec;
        const t = age[i] / SMOKE.lifeSec;
        const src = sources[(i / SMOKE.puffsPerChimney) | 0];
        const wobble = (jitter(i, 23) - 0.5) * 14 * t;
        pos.set(
          src.x + SMOKE.driftUnitsPerSec[0] * age[i] + wobble,
          src.y + SMOKE.riseUnitsPerSec * age[i],
          src.z + SMOKE.driftUnitsPerSec[1] * age[i] + wobble * 0.5,
        );
        const s = SMOKE.startSizeUnits + (SMOKE.endSizeUnits - SMOKE.startSizeUnits) * t;
        scale.set(s, s, s);
        m.compose(pos, camera.quaternion, scale);
        mesh.setMatrixAt(i, m);
        alpha[i] = SMOKE.maxAlpha * (1 - t) * Math.min(1, t * 7);
      }
      mesh.instanceMatrix.needsUpdate = true;
      (geom.getAttribute("aAlpha") as THREE.InstancedBufferAttribute).needsUpdate = true;
    },
  };
}
