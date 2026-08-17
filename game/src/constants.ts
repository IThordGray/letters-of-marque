import type { UnitKind, WeaponType } from "./types";

// ============================================================================
// LAND MODULE — durable build. Data-oriented: plain structs + pure systems.
// Units are paces; time is real seconds (with time controls). The world is a
// fixed field the camera navigates. All values are starting guesses — tune fast.
// ============================================================================

export const WORLD = { width: 2000, height: 1500 };

export const SIM = {
  hz: 60,
  get dt() {
    return 1 / SIM.hz;
  },
};

// ---- Harness (determinism / pause / speed / log) ---------------------------
export const SEED = 1337; // fixed default RNG seed — reproducible battles
export const SPEEDS = [0.5, 1, 2, 4]; // selectable sim-time multipliers (keys 1–4)
export const LOG = { display: 60 }; // signal-log lines shown in the panel

// ---- Figures ---------------------------------------------------------------
export const UNIT: Record<UnitKind, { size: number; hp: number }> = {
  pirate: { size: 7, hp: 3 }, // size = radius in paces
  officer: { size: 11, hp: 6 },
};

// ---- Weapons ---------------------------------------------------------------
// KAN-13 is attrition-only, so hit chance = accuracy × range-falloff (the marks
// stat and morale join in KAN-14, when accuracy drops and morale becomes the real
// "health"). Reloads are in real seconds; use the time controls to speed drills.
export const WEAPON: Record<WeaponType, { rangeMax: number; reload: number; accuracy: number; powder: number }> = {
  musket: { rangeMax: 300, reload: 4, accuracy: 0.6, powder: 20 },
  pistol: { rangeMax: 120, reload: 2, accuracy: 0.7, powder: 12 },
  cannon: { rangeMax: 600, reload: 6, accuracy: 0.4, powder: 30 },
};

export const COMBAT = {
  fireArcHalfAngle: 78, // a figure fires within this of its facing
  rangeFalloffPow: 1.25, // hit chance falls with distance to this power
  rangeFloor: 0.12, // minimum range scalar inside max range
};

export const FLASH = { ttl: 0.25 }; // seconds a shot line lingers on screen

// ---- Test spawn (throwaway: gives us something to see and fight) -----------
export const SPAWN = {
  pirates: 8, // pirates per band, plus one officer
  spacing: 44, // paces between figures in a rank
  rankOffset: 55, // pirates sit this far toward the foe from their officer
  edgeInset: 220, // how far each band deploys from its own edge
};

// ---- Movement --------------------------------------------------------------
export const MOVE = {
  speed: 90, // paces/sec (test value)
  arriveSlack: 6, // stop when this close to the target
};

// ---- Formation & personal space --------------------------------------------
export const FORMATION = {
  tightSpacing: 26,
  looseSpacing: 46,
  aspect: 2.4, // ellipse width : depth — wide, not high
};
export const SEPARATION = {
  radius: 14, // personal space; keep under a tight formation's closest gap
};

// ---- Camera ----------------------------------------------------------------
export const CAMERA = {
  zoomMin: 0.15,
  zoomMax: 4,
  zoomStep: 1.15,
  panSpeed: 1100, // screen px/sec for keyboard pan
};

// ---- Selection -------------------------------------------------------------
export const SELECT = {
  pickSlack: 6, // extra px around a figure that still counts as a click on it
};

export const COLOR = {
  background: "#08151b",
  field: "#20301c",
  fieldEdge: "#3a5330",
  text: "#9fb9c6",
  player: "#4ea3ff",
  playerOfficer: "#bfe0ff",
  enemy: "#ff6b52",
  enemyOfficer: "#ffc2b5",
  outline: "#0b1410",
  selection: "#ffffff",
  dragBox: "#9fe0ff",
  dragFill: "rgba(159, 224, 255, 0.12)",
  moveMarker: "#ffd36b",
  dead: "#4a5348",
  fire: "#ffd36b",
};
