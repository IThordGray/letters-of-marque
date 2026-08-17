// ============================================================================
// LAND MODULE — durable build. Data-oriented: plain structs + pure systems.
// Units are paces; time is seconds. The world is a fixed field the camera
// navigates. All values are starting guesses — tune fast.
// ============================================================================

export const WORLD = { width: 2000, height: 1500 };

export const SIM = {
  hz: 60,
  get dt() {
    return 1 / SIM.hz;
  },
};

// ---- Figures ---------------------------------------------------------------
export const UNIT = {
  pirate: { size: 7 }, // radius in paces
  officer: { size: 11 },
};

// ---- Test spawn (throwaway: gives us something to see and select) ----------
export const SPAWN = {
  pirates: 8, // pirates per band, plus one officer
  spacing: 44, // paces between figures in a rank
  rankOffset: 55, // pirates sit this far toward the foe from their officer
  edgeInset: 220, // how far each band deploys from its own edge
};

// ---- Camera ----------------------------------------------------------------
export const CAMERA = {
  zoomMin: 0.15, // px per pace
  zoomMax: 4,
  zoomStep: 1.15, // multiply per wheel notch
  panSpeed: 1100, // screen px/sec for keyboard pan
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
};
