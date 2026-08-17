import type { UnitKind, WeaponType } from "./types";

// ============================================================================
// LAND MODULE — durable build. Data-oriented: plain structs + pure systems.
// Units are paces; time is real seconds (with time controls). All values are
// starting guesses — tune fast (morale especially, alongside a playtest).
// ============================================================================

export const WORLD = { width: 2000, height: 1500 };

export const SIM = {
  hz: 60,
  get dt() {
    return 1 / SIM.hz;
  },
};

// ---- Harness (determinism / pause / speed / log) ---------------------------
export const SEED = 1337;
export const SPEEDS = [0.5, 1, 2, 4];
export const LOG = { display: 60 };

// ---- Figures ---------------------------------------------------------------
export const UNIT: Record<UnitKind, { size: number; hp: number; morale: number }> = {
  pirate: { size: 7, hp: 3, morale: 60 },
  officer: { size: 11, hp: 6, morale: 85 }, // officers start steadier
};

// ---- Weapons ---------------------------------------------------------------
// Accuracy is deliberately LOW and moraleShot HIGH: you win by breaking WILL, so
// fear must outpace lethality — figures should rout well before they're killed.
export const WEAPON: Record<
  WeaponType,
  { rangeMax: number; reload: number; accuracy: number; powder: number; moraleShot: number }
> = {
  musket: { rangeMax: 300, reload: 3, accuracy: 0.42, powder: 60, moraleShot: 8 },
  pistol: { rangeMax: 120, reload: 1.5, accuracy: 0.5, powder: 40, moraleShot: 7 },
  cannon: { rangeMax: 600, reload: 5, accuracy: 0.3, powder: 50, moraleShot: 15 }, // a terror weapon
};

export const COMBAT = {
  fireArcHalfAngle: 78, // a figure fires within this of its facing
  rangeFalloffPow: 1.25, // hit chance falls with distance to this power
  rangeFloor: 0.12, // minimum range scalar inside max range
};

export const FLASH = { ttl: 0.25 };

// ---- Morale — per figure, the real "health" --------------------------------
export const MORALE = {
  max: 100,
  steadyAbove: 55, // steady while morale is above this
  waverAbove: 25, // wavering above this; below → routing
  hysteresis: 5, // must climb this far back past a threshold to recover
  suppression: 2.6, // morale drained just by being shot at (hit or miss)
  rallyRate: 8, // morale/sec recovered out of contact
  contactCooldown: 3, // seconds after a blow before recovery starts
  enemyNearDist: 120, // an enemy this close counts as "in contact" (no recovery)
};

// ---- Test spawn ------------------------------------------------------------
export const SPAWN = {
  pirates: 8,
  spacing: 44,
  rankOffset: 55,
  edgeInset: 220,
};

// ---- Movement --------------------------------------------------------------
export const MOVE = {
  speed: 90, // paces/sec
  arriveSlack: 6,
  engageFraction: 0.6, // pursue until within this fraction of weapon range
  waverSpeedMult: 0.65, // the wavering move reluctantly
  routSpeedMult: 1.4, // routers run
};

// ---- Formation & personal space --------------------------------------------
export const FORMATION = { tightSpacing: 26, looseSpacing: 46, aspect: 2.4 };
export const SEPARATION = { radius: 14 };

// ---- Camera ----------------------------------------------------------------
export const CAMERA = { zoomMin: 0.15, zoomMax: 4, zoomStep: 1.15, panSpeed: 1100 };

// ---- Selection -------------------------------------------------------------
export const SELECT = { pickSlack: 6 };

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
  hpBack: "rgba(0, 0, 0, 0.55)",
  hpGood: "#6de07a",
  hpMid: "#e0d46d",
  hpLow: "#ff6b52",
  routing: "#8a8f95", // routers wash out to grey
  moraleGood: "#6de07a",
  moraleWaver: "#e0d46d",
  moraleRout: "#ff6b52",
};
