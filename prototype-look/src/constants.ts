// Every tunable number for the look spike, in one place.
//
// THROWAWAY. This directory exists to answer one question — does the §5 art
// direction read as a real place when everything is a box and the only art is
// light? — and will be deleted afterwards. Nothing here is durable, nothing
// here is imported by `game/`, and no renderer choice is implied by it.

// ---- The place -------------------------------------------------------------
// A pinned seed and a pinned window on the real world generator. Found by
// scanning `makeShape`/`heightAt` for a frame holding open sea, a channel, a
// shore gentle enough for a town, and a massif behind it.
export const PLACE = {
  seed: 5,
  centreNmX: 1174,
  centreNmY: 308,
  windowNm: 56,
  // The shore the town is founded on. Chosen by asking the generator itself:
  // `shelterAt` = 1.00 (water almost ringed by land — the best anchorage on
  // this coast) with 13.8 nm of open water on the seaward bearing, and the
  // gentlest buildable ground of any such spot in the window.
  townNmX: 1172.16,
  townNmY: 303.11,
} as const;

// ---- Scale -----------------------------------------------------------------
// Toy scale is the ratified direction (§5.6), not a cheat: a building here is
// ~0.35 nm on a side, which is absurd as geography and correct as a diorama.
// Vertical exaggeration is unavoidable — a real 100 km island with a 1 km peak
// is visually flat, so relief is lifted about 12x.
export const SCALE = {
  unitsPerNm: 26,
  heightUnits: 220, // scene units per unit of `heightAt`
  grid: 400, // terrain samples per side; 2 triangles per cell
} as const;

export const FRAME_UNITS = PLACE.windowNm * SCALE.unitsPerNm;

// The window is a crop, so its border is walked down under the sea rather than
// left as a straight cliff where a landmass runs off the edge.
export const EDGE_MARGIN = 0.1; // fraction of the window
export const EDGE_DEPTH = 0.35; // how far under, in generator height units

// ---- Light (§5.5: this is where the production value is) -------------------
export const SUN = {
  // MEASURED THE HARD WAY: at 16 deg the shadows run 3.5x the height of what
  // casts them, and a town at street spacing shadows ITSELF into one dark
  // mass — every building lands in its neighbour's shadow. 26 deg gives 2.05x,
  // which is still unmistakably long and leaves the streets lit.
  elevationDeg: 26,
  azimuthDeg: 73,
  colour: 0xfff0d2,
  intensity: 3.7,
  skyColour: 0x9fc0d8,
  groundColour: 0x6b6350,
  ambientIntensity: 0.78,
  shadowMapSize: 4096,
} as const;

export const SKY = {
  top: 0x3e78a8,
  horizon: 0xc9dbe4,
  fogNear: 1500,
  fogFar: 7000,
  fogColour: 0xbcd3de,
} as const;

// ---- Sea (§5.1: stylised, never simulated) ---------------------------------
export const SEA = {
  colour: 0x0f7a86,
  floorColour: 0x1c5f68,
  floorUnits: -32,
  emissive: 0x11616b,
  emissiveIntensity: 0.65,
  opacity: 0.84,
  roughness: 0.12,
  ripplePx: 256, // procedural normal map resolution
  rippleRepeat: 90,
  rippleStrength: 0.35,
  driftPerSec: 0.012,
} as const;

// ---- Terrain colour bands (§5.2: hue carries identity, no textures) --------
// Read against the raw `heightAt` value, not scene units. The foam band
// straddles the waterline deliberately, so surf follows every cove exactly and
// costs no geometry at all.
export const BANDS: readonly { readonly upTo: number; readonly rgb: readonly [number, number, number] }[] = [
  { upTo: -0.16, rgb: [0.06, 0.23, 0.29] }, // deep seabed
  { upTo: -0.07, rgb: [0.11, 0.38, 0.43] }, // seabed
  { upTo: -0.03, rgb: [0.38, 0.72, 0.66] }, // shoal
  { upTo: 0.012, rgb: [0.95, 0.97, 0.94] }, // surf
  { upTo: 0.038, rgb: [0.6, 0.5, 0.35] }, // wet sand
  { upTo: 0.075, rgb: [0.89, 0.81, 0.58] }, // dry sand
  { upTo: 0.16, rgb: [0.64, 0.66, 0.38] }, // scrub
  { upTo: 0.44, rgb: [0.36, 0.56, 0.26] }, // green
  { upTo: 0.78, rgb: [0.25, 0.4, 0.2] }, // deep green
  { upTo: 0.9, rgb: [0.33, 0.31, 0.26] }, // rock
  { upTo: 9, rgb: [0.4, 0.38, 0.34] }, // bare summit
];

// A triangle steeper than this (height change across one cell) is bare rock
// whatever band it falls in — cliffs, which flat shading otherwise loses.
export const CLIFF = { dropPerCell: 0.032, aboveHeight: 0.05, rgb: [0.42, 0.4, 0.34] as const } as const;

// ---- Trees ------------------------------------------------------------------
export const TREES = {
  count: 9000,
  minHeight: 0.06,
  maxHeight: 0.66,
  radiusUnits: [2.6, 4.4] as const,
  heightUnits: [6, 11] as const,
  clearTownUnits: 155, // no trees inside the town's footprint
  colours: [0x2f5d2c, 0x3a6b2f, 0x27512a, 0x46733a] as const,
} as const;

// ---- Smoke (§5.5: the hero effect) -----------------------------------------
export const SMOKE = {
  chimneys: 9,
  puffsPerChimney: 14,
  lifeSec: 7.5,
  // Drifts more than it rises, deliberately. At the ratified 60-65 deg camera
  // pitch a vertical column is foreshortened into a dot on the roof; a bank
  // laid downwind is what actually reads from above — which is also what §5.5
  // asks smoke to be.
  riseUnitsPerSec: 3.6,
  driftUnitsPerSec: [12.0, 5.0] as const,
  startSizeUnits: 7,
  endSizeUnits: 34,
  colour: 0xcdc7ba,
  maxAlpha: 0.62,
} as const;

// ---- Camera (§5.3) ----------------------------------------------------------
export const CAMERA = {
  // Pitch is measured from the horizon in §5.3; three measures polar from +Y.
  // 62 deg of pitch is 28 deg of polar.
  polarStartDeg: 32,
  polarMinDeg: 9,
  polarMaxDeg: 76,
  yawStartDeg: 150,
  distanceStart: 560,
  distanceMin: 90,
  distanceMax: 3200,
  fovDeg: 42,
} as const;
