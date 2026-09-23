// The island, straight out of the simulation's own generator.
//
// One BufferGeometry, non-indexed so every triangle owns its three vertices:
// that is what makes the facets crisp and lets a whole triangle take one band
// colour. No textures, no UVs — §5.1's "vertex colours, facets left visible".

import * as THREE from "three";
import { BANDS, CLIFF, EDGE_DEPTH, EDGE_MARGIN, PLACE, SCALE } from "./constants";
import { shape, jitter } from "./place";
import { heightAt } from "../../game/src/overworld/shape";

function bandColour(h: number, out: [number, number, number]): void {
  for (let i = 0; i < BANDS.length; i++) {
    if (h <= BANDS[i].upTo) {
      out[0] = BANDS[i].rgb[0];
      out[1] = BANDS[i].rgb[1];
      out[2] = BANDS[i].rgb[2];
      return;
    }
  }
}

export function buildTerrain(): THREE.Mesh {
  const g = SCALE.grid;
  const stepNm = PLACE.windowNm / g;
  const x0 = PLACE.centreNmX - PLACE.windowNm / 2;
  const y0 = PLACE.centreNmY - PLACE.windowNm / 2;

  // Sample once per lattice point; every triangle reads four of them.
  //
  // The window is a crop of a 1,500 x 800 nm sea, so a landmass that runs off
  // the edge would otherwise end in a straight cliff — which is exactly how it
  // looked before this taper existed. Over the outer tenth of the frame the
  // ground is walked down below sea level, so every island ends in water.
  const h = new Float32Array((g + 1) * (g + 1));
  const margin = g * EDGE_MARGIN;
  for (let j = 0; j <= g; j++) {
    for (let i = 0; i <= g; i++) {
      const edge = Math.min(i, j, g - i, g - j) / margin;
      const f = edge >= 1 ? 1 : edge <= 0 ? 0 : edge * edge * (3 - 2 * edge);
      const raw = heightAt(shape, x0 + i * stepNm, y0 + j * stepNm);
      h[j * (g + 1) + i] = raw * f + (f - 1) * EDGE_DEPTH;
    }
  }

  const tris = g * g * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const u = SCALE.unitsPerNm * stepNm; // scene units per cell
  const vy = SCALE.heightUnits;
  const half = (g * u) / 2;
  const rgb: [number, number, number] = [0, 0, 0];

  let p = 0;
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      const hA = h[j * (g + 1) + i];
      const hB = h[j * (g + 1) + i + 1];
      const hC = h[(j + 1) * (g + 1) + i + 1];
      const hD = h[(j + 1) * (g + 1) + i];
      const ax = i * u - half;
      const az = j * u - half;
      const bx = ax + u;
      const cz = az + u;

      // Steepness of the whole cell decides whether it reads as cliff.
      const lo = Math.min(hA, hB, hC, hD);
      const hi = Math.max(hA, hB, hC, hD);
      const cliff = hi - lo > CLIFF.dropPerCell && lo > CLIFF.aboveHeight;

      // A quiet per-cell value jitter keeps the bands from reading as contour
      // lines on smooth ground. 3% — enough to break the edge, not to notice.
      const tone = 0.97 + jitter(i, j) * 0.06;

      const tri = (
        p1x: number, p1y: number, p1z: number,
        p2x: number, p2y: number, p2z: number,
        p3x: number, p3y: number, p3z: number,
        mean: number,
      ) => {
        pos[p] = p1x; pos[p + 1] = p1y * vy; pos[p + 2] = p1z;
        pos[p + 3] = p2x; pos[p + 4] = p2y * vy; pos[p + 5] = p2z;
        pos[p + 6] = p3x; pos[p + 7] = p3y * vy; pos[p + 8] = p3z;
        if (cliff) {
          rgb[0] = CLIFF.rgb[0];
          rgb[1] = CLIFF.rgb[1];
          rgb[2] = CLIFF.rgb[2];
        } else {
          bandColour(mean, rgb);
        }
        for (let k = 0; k < 3; k++) {
          col[p + k * 3] = rgb[0] * tone;
          col[p + k * 3 + 1] = rgb[1] * tone;
          col[p + k * 3 + 2] = rgb[2] * tone;
        }
        p += 9;
      };

      // Wound counter-clockwise seen from above, so normals come out +Y.
      tri(ax, hA, az, ax, hD, cz, bx, hB, az, (hA + hD + hB) / 3);
      tri(bx, hB, az, ax, hD, cz, bx, hC, cz, (hB + hD + hC) / 3);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geom.computeVertexNormals(); // non-indexed, so these are true face normals
  geom.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}
