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

// ---- Harness (determinism / pause / speed / log) ---------------------------
export const SEED = 1337; // fixed default RNG seed — reproducible battles
export const SPEEDS = [0.5, 1, 2, 4]; // selectable sim-time multipliers (keys 1–4)
export const LOG = { display: 60 }; // signal-log lines shown in the panel

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

// ---- Movement --------------------------------------------------------------
export const MOVE = {
  speed: 90, // paces/sec (test value)
  arriveSlack: 6, // stop when this close to the target
};

// ---- Formation & personal space --------------------------------------------
export const FORMATION = {
  tightSpacing: 26, // paces between neighbours in a tight formation
  looseSpacing: 46, // ...and a loose one
  aspect: 2.4, // ellipse width : depth — wide, not high
};
export const SEPARATION = {
  // Personal space: below this centre-distance, figures push apart. Keep it under
  // a tight formation's closest gap (~0.6 × tightSpacing ≈ 16) so separation only
  // resolves real overlap and never loosens the formation. ~1 figure-diameter.
  radius: 14,
};

// ---- Camera ----------------------------------------------------------------
export const CAMERA = {
  zoomMin: 0.15, // px per pace
  zoomMax: 4,
  zoomStep: 1.15, // multiply per wheel notch
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
};
