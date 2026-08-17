// ============================================================================
// ALL TUNABLE VALUES LIVE HERE.
// The prototype spec (PROTOTYPE.md §6) requires that every number a playtest
// might want to change is in one file and changeable in seconds. Keep it so.
// Angles are DEGREES. Convention: 0 = +x (east), clockwise positive (y is down).
// Distances are YARDS. Speeds are yards/second. Time is seconds.
// ============================================================================

export const WORLD = {
  width: 1400,
  height: 1000,
};

// Ships steer away from the arena edges instead of grinding into them.
export const WALL = {
  margin: 170, // start turning away within this many yards of an edge
  strength: 2.4, // how hard the edge pushes vs. the ship's intended heading
};

export const SIM = {
  hz: 60, // fixed timestep
  get dt() {
    return 1 / SIM.hz;
  },
};

// ---- Wind ------------------------------------------------------------------
export const WIND = {
  // "toward" = the direction the wind blows toward, in degrees.
  baseToward: 200,
  driftAmplitude: 40, // base ± 40°
  driftPeriodA: 45, // seconds — the slow primary drift
  driftPeriodB: 17, // seconds — a smaller secondary wobble for organic feel
  driftMixB: 0.3, // weight of the secondary wobble (primary gets 1 - this)
};

// Points of sail. Piecewise-linear curve of (angleOffWind -> speed multiplier).
// angleOffWind: 0 = bow dead into the wind (no-go), 180 = dead downwind.
// Anchored at band centres and lerped between, per §5.
export const POLAR: Array<[number, number]> = [
  [0, 0.0],
  [45, 0.0], // edge of the no-go zone
  [57.5, 0.55], // close-hauled
  [90, 0.85], // beam reach
  [130, 1.0], // broad reach — fastest
  [165, 0.7], // running
  [180, 0.7],
];

export const SAIL = {
  noGoHalfAngle: 45, // |angle off wind| below this = no-go zone
  beatAngle: 52, // the angle off the wind a ship beats at when it must go upwind
  tackHysteresis: 14, // deg — don't flip tacks until the goal is clearly on the other side
  // Everyone can sail; a missed tack is an occasional hiccup, not a breakdown.
  // (Playtest 2026-07-27: reduced from the spec's untuned 0.35 / 8–15 s.)
  tackIronsChance: 0.12, // chance of being caught in irons when crossing the eye
  ironsMin: 5, // seconds stuck in irons
  ironsMax: 10,
  accel: 8, // yd/s^2 — how fast speed chases its target (crude)
  ironsDecay: 6, // yd/s^2 — speed bleed while in irons
};

// ---- Ships -----------------------------------------------------------------
export type ShipClass = "sloop" | "frigate";

export const SHIP_CLASS = {
  sloop: {
    maxSpeed: 16,
    baseTurn: 18, // deg/s at full speed
    hull: 60,
    rigging: 40,
    gunsPerSide: 6,
    size: 14, // triangle length in yards (visual only)
  },
  frigate: {
    maxSpeed: 12,
    baseTurn: 11,
    hull: 140,
    rigging: 70,
    gunsPerSide: 14,
    size: 22,
  },
} as const;

// ---- Gunnery ---------------------------------------------------------------
export const GUN = {
  arcHalfAngle: 60, // ±60° from the beam (perpendicular) fires
  reload: 25, // seconds per side, tracked independently
  roundDamage: 3, // hull damage per hit (round shot)
  chainDamage: 3, // rigging damage per hit (chain shot)
  rakeMultiplier: 2, // ×2 damage when raking
  rakeHalfAngle: 30, // within 30° of target bow/stern axis = a rake
  maxRange: 1200,
  // Range bands: [minRange, maxRange, hitChancePerGun]
  bands: [
    [700, 1200, 0.08], // extreme
    [350, 700, 0.2], // long
    [100, 350, 0.45], // close
    [0, 100, 0.7], // point blank
  ] as Array<[number, number, number]>,
};

// ---- Captains --------------------------------------------------------------
export const CAPTAIN = {
  strikeBasePct: 25, // strike_threshold = 25% hull - nerve/8
  strikeNerveDivisor: 8,
};

// ---- Interpretation — the design under test (§14.1) ------------------------
// Trait-driven and DETERMINISTIC: a captain's behaviour is a stable function of
// their (fixed) temperament + the situation + the current order. No per-frame
// dice, so no flicker. Deviations commit and hold (hysteresis) and are narrated
// only on transition, so they read as CHARACTER, not chaos. Every deviation
// maps to a trait the player was shown, so "why did that happen?" is answerable.
// Discipline is lethal: ignore a signal in action and you're shot. So officers
// OBEY almost always — temperament only nudges a few extreme characters, and
// only in the fitting situation. These thresholds are deliberately strict so
// deviations are a handful of character moments per battle, never "nobody
// listens." (Not a punishment mechanic; the deterrent is the low rate itself,
// reinforced emergently — a ship that breaks formation gets isolated and mauled.)
export const INTERP = {
  enabled: true, // master switch (off = everyone obeys perfectly)

  // Chase — only a markedly aggressive captain breaks off to run down a cripple.
  chaseAggression: 60, // aggression above this gives chase
  chaseRange: 420, // an eligible quarry must be within this to trigger it
  chaseDropRange: 720, // ...and the chase is given up past this (hysteresis)
  quarryRiggingFrac: 0.4, // "crippled" = rigging below this fraction of max...
  quarryHullFrac: 0.5, // ...or hull below this fraction (a fleeing group also counts)

  // Defiance — refusing a direct signal in action is near-mutiny, so it takes
  // BOTH a wilful captain and a strong temperamental reason.
  defyObedience: -50, // obedience below this may defy a conflicting order
  refuseRecallAggression: 25, // ...and aggression above this refuses a Break-off
  shyAggression: -25, // ...or aggression below this won't close on an Engage
  engageNear: 380, // "there is a fight here" distance for refusing a recall
  engageDropNear: 620, // ...refusal holds until the nearest enemy is past this

  // Nerve — a shaken captain sheers off before he'd strike. Mostly a survival
  // reflex (own ship being wrecked); nerve only shifts when, and not by much.
  flinchBasePct: 35, // hull% at which a nerve-0 captain loses his nerve
  flinchNerveDivisor: 5, // smaller swing than before: faint-hearted ~55%, iron-nerved ~15%
};

// ---- Group behaviour / stances --------------------------------------------
export const GROUP = {
  formationSpacing: 70, // yards between ships in formation
  slotArriveSlack: 25, // within this many yards of slot = "in position"
  // Ordered ranges the stances aim for (before captain aggression modifies them):
  engageRange: 160, // "Engage close"
  standoffRange: 520, // "Stand off and batter"
  cohesionStrengthFrac: 0.5, // group goes Loose below this fraction of starting strength
};

// ---- Camera ----------------------------------------------------------------
export const CAMERA = {
  rotateSpeed: 90, // deg/s while Q/E held
  windAlignTolerance: 10, // deg — how close to up counts as "wind-aligned"
  arenaMargin: 1.08, // fit the arena diagonal with this much slack so nothing clips
};

// ---- Visuals (programmer art only) ----------------------------------------
export const COLOR = {
  water: "#0f2833",
  arenaBorder: "#2a4a58",
  windArrow: "#7fd7ff",
  player: "#4ea3ff",
  playerCommander: "#a9d4ff",
  enemy: "#ff6b52",
  enemyCommander: "#ffb199",
  struck: "#6b7076",
  hull: "#6de07a",
  rigging: "#e0d46d",
  barBack: "#000000",
  tether: "#3d6b7a",
  fire: "#ffd36b",
  rake: "#ff4bd8",
  wake: "#bfe6f2",
  selection: "#ffffff",
};

export const WAKE = {
  maxPoints: 24,
  minSegment: 6, // yards between recorded wake points
};

export const FLASH = {
  ttl: 0.35, // seconds a firing flash stays on screen
};
