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
export const UNIT: Record<UnitKind, { size: number; hp: number; morale: number; ferocity: number; marks: number }> = {
  pirate: { size: 7, hp: 3, morale: 60, ferocity: 42, marks: 38 },
  officer: { size: 11, hp: 6, morale: 85, ferocity: 70, marks: 72 }, // officers start steadier, fiercer, better shots
};

// ---- Weapons ---------------------------------------------------------------
// Accuracy is deliberately LOW and moraleShot HIGH: you win by breaking WILL, so
// fear must outpace lethality — figures should rout well before they're killed.
export const WEAPON: Record<
  WeaponType,
  { rangeMax: number; reload: number; accuracy: number; powder: number; moraleShot: number; meleeMult: number }
> = {
  // accuracy is now multiplied by the shooter's marks/100 (~0.38 for a pirate), so
  // these bases are higher — a pirate's net hit rate stays about what it was.
  musket: { rangeMax: 300, reload: 3, accuracy: 1.1, powder: 60, moraleShot: 8, meleeMult: 0.8 },
  pistol: { rangeMax: 120, reload: 1.5, accuracy: 1.3, powder: 40, moraleShot: 7, meleeMult: 1.5 }, // pistol & cutlass — shock troops
  cannon: { rangeMax: 600, reload: 5, accuracy: 0.8, powder: 50, moraleShot: 15, meleeMult: 0.15 }, // a terror weapon; crew fall back on the cutlass up close
};

// Every figure also carries a cutlass — a melee floor for any weapon when powder
// runs dry or the fight goes hand-to-hand (shock weapons like the pistol exceed it).
export const CUTLASS = { meleeMult: 1.1 };

export const COMBAT = {
  fireArcHalfAngle: 78, // a figure fires within this of its facing
  rangeFalloffPow: 1.25, // hit chance falls with distance to this power
  rangeFloor: 0.12, // minimum range scalar inside max range
  acquireRange: 340, // an aggressive figure auto-engages enemies within this
  meleeRange: 16, // at this range figures melee instead of shoot (kept > separation radius)
  meleeReload: 1.4, // seconds between melee blows
  meleeMoraleHit: 11, // close work terrifies — a big morale blow
};

// ---- Flanking — positioning attacks morale ---------------------------------
export const FLANK = {
  frontHalfAngle: 55, // within this of a figure's facing counts as a front hit
  rearHalfAngle: 45, // within this of directly-behind counts as a rear hit
  flankMoraleMult: 2.0, // a flank hit terrifies twice as much
  rearMoraleMult: 3.0, // from the rear, thrice
  meleeToHitFlank: 1.3, // and a blow from a bad angle lands more easily
  meleeToHitRear: 1.6,
};

// ---- Officers — the connective tissue --------------------------------------
export const CARRY = { fraction: 0.4 }; // a pirate is lifted this far toward his officer's skill
export const PRESENCE = {
  radius: 165, // a friendly officer within this steadies you
  floor: 42, // ...morale won't sink below this near him
  resilience: 0.25, // ...and incoming combat morale is cut by this
};
export const RALLY = {
  radius: 170,
  boost: 28, // morale restored to nearby friends
  cooldown: 22, // seconds between an officer's rallies
};

// ---- Terrain — where you fight matters -------------------------------------
export const TERRAIN = {
  coverIncomingMult: 0.6, // a figure in cover is harder to hit
  coverRallyBonus: 4, // ...and steadies faster there
  highGroundHitBonus: 1.2, // firing from high ground lands better
  highGroundRangeBonus: 50, // ...and reaches further
  highGroundFloor: 35, // ...and holds a mild morale floor
  chokeSpeedMult: 0.5, // a choke is slow going
};

// ---- Enemy AI --------------------------------------------------------------
export const AI = { decisionInterval: 1 }; // seconds between enemy AI re-decisions

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
  contagionRadius: 150, // a friend falling or breaking within this shakes you
  perDown: 14, // morale lost when a nearby friend falls
  perRout: 9, // ...and when a nearby friend breaks and runs
  perOfficerDown: 24, // ...and the shock when an officer is cut down
};

// ---- Test spawn ------------------------------------------------------------
export const SPAWN = {
  pirates: 8,
  spacing: 44,
  edgeInset: 220,
};

// ---- Deploy & equip — the roster the player draws from ---------------------
export const DEPLOY = {
  crewPool: 24, // unnamed pirates available to land
  officerRoster: 5, // named officers on the roster to choose among
  officerSpread: 0.2, // rolled officer stats vary this far around the base
  garrison: 14, // enemy defenders (grown for the asymmetric feel — see S5)
};

// ---- Raid scenario — objective / extraction / alarm ------------------------
export const RAID = {
  objectiveRadius: 24, // drawn half-size of the objective marker (paces)
  seizeRange: 46, // a player figure this close can work the objective
  seizeTime: 2.0, // seconds held on the objective to seize it
  rouseRange: 240, // a raider this close to a dug-in defender rouses the garrison
  // The alarm is a staged clock (Quiet→Roused→Alarm→Muster) driven by heat, not a timer.
  alarm: {
    perSec: 1.4, // heat/sec while roused — time ashore creeps the alarm up
    seizeSpike: 22, // heat added when the prize is seized (the theft is discovered)
    runnerSpike: 9, // heat added when a routed defender escapes off-map (raises the cry)
    roused: 1, // heat thresholds for the stages ↓
    full: 45,
    muster: 85,
  },
  musterPoint: { x: WORLD.width / 2, y: 40 }, // the town gate reinforcements pour from
  reinforce: { wave2: 6, wave3: 8 }, // wave sizes (pirates; +1 officer) at Alarm / Muster
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
  cover: "#2f5a34",
  highGround: "#5a5330",
  choke: "#4a4038",
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
  melee: "#ff8c3c",
  hpBack: "rgba(0, 0, 0, 0.55)",
  hpGood: "#6de07a",
  hpMid: "#e0d46d",
  hpLow: "#ff6b52",
  routing: "#8a8f95", // routers wash out to grey
  aura: "#7fd0ff", // officer presence ring
  inspect: "#ffd36b", // ring around the inspected figure
  moraleGood: "#6de07a",
  moraleWaver: "#e0d46d",
  moraleRout: "#ff6b52",
  stanceAggressive: "#ff9a3c",
  stanceHold: "#6fc6ff",
  stanceCease: "#9fb9c6",
  objective: "#ffcf4a", // the prize to seize
  objectiveRing: "#ffe08a", // seize-progress ring
  objectiveDone: "#6de07a", // seized
  extraction: "#5aa9c0", // the boats / extraction zone
};
