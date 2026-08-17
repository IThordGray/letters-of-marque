// ============================================================================
// LAND PROTOTYPE — individual-figure RTS skirmish (Cutthroats model).
// You deploy, equip and command each pirate and officer. Officers roll stats →
// perks, and a fraction of their quality carries over to the pirates they lead.
// Paces / seconds (~4x compressed) / morale 0..100. Angles deg, 0=+x, y down.
// All starting guesses — tune fast after a playtest.
// ============================================================================

export const WORLD = { width: 1000, height: 750 };

export const SIM = {
  hz: 60,
  get dt() {
    return 1 / SIM.hz;
  },
};

// ---- Weapons (a pirate's loadout sets its role) ----------------------------
export type WeaponType = "musket" | "pistol" | "cannon";

export const WEAPON = {
  // Note: accuracy is deliberately low and moraleShot high — you win by breaking
  // WILL, so morale must outpace lethality (figures should rout before they die).
  musket: {
    label: "Musket",
    rangeMax: 150,
    reload: 18,
    accuracy: 0.42, // base hit scalar at point-blank, before marks/range
    meleeMult: 0.8,
    powder: 12,
    moveSpeed: 24,
    moraleShot: 8, // morale punch on a hit (large vs lethality)
  },
  pistol: {
    label: "Pistol & cutlass",
    rangeMax: 60,
    reload: 9,
    accuracy: 0.5,
    meleeMult: 1.5, // shock troops
    powder: 6,
    moveSpeed: 27,
    moraleShot: 7,
  },
  cannon: {
    label: "Cannon",
    rangeMax: 300, // outranges everything — a morale weapon
    reload: 24,
    accuracy: 0.3,
    meleeMult: 0.15, // helpless if closed on
    powder: 18,
    moveSpeed: 9, // ponderous
    moraleShot: 15, // terror weapon
  },
} as const;

// ---- Figures ---------------------------------------------------------------
export const UNIT = {
  // hp is generous so figures survive long enough for fear to accumulate and
  // break them before they're actually killed.
  pirate: { hp: 3, marks: 38, ferocity: 42, moraleBase: 52, nerve: 38, size: 6 },
  // officers roll their stats; these are the low ends of the roll
  officer: { hp: 6, marksLo: 48, marksHi: 92, feroLo: 48, feroHi: 92, presLo: 45, presHi: 90, nerveLo: 50, nerveHi: 88, size: 8 },
};

export const COMBAT = {
  fireArcHalfAngle: 78, // a figure fires within this of its facing
  acquireRange: 300, // an Aggressive figure auto-engages enemies within sight
  meleeRange: 13, // paces at which melee happens instead of shooting
  meleeReload: 1.4, // seconds between melee blows
  meleeMoraleHit: 11, // morale punch of a melee blow (close work terrifies)
  suppression: 2.6, // morale drained just by being shot at (hit or miss)
  rangeFalloffPow: 1.25, // hit chance falls off with distance to this power
  rangeFloor: 0.12, // minimum range-scalar inside max range
};

// ---- Carry-over: an officer imbues his squad with a fraction of his skill ---
export const CARRY = {
  fraction: 0.4, // squad stat = base + fraction × max(0, officer − base)
};

// ---- Officer presence: a proximity leadership aura -------------------------
export const PRESENCE = {
  radius: 165,
  floorBase: 28, // morale won't sink below this near an officer...
  floorPerPresence: 0.14, // ...+ this × officer presence
  ironWillFloorBonus: 12, // Iron Will perk
  resiliencePerPresence: 0.0022, // incoming morale damage × (1 - presence×this)
};

// ---- Perks (unlocked from officer stats; a few for the slice) --------------
export const PERK = {
  deadEyeMarks: 78, // +ranged accuracy (personal; partly imbued via marks)
  deadEyeMult: 1.25,
  cutthroatFero: 78, // +melee (personal)
  cutthroatMult: 1.3,
  ironWillPres: 78, // stronger morale floor aura
  oldSaltPres: 58, // rally can turn routers back
};

// ---- Morale — per man, with man-to-man contagion ---------------------------
export const MORALE = {
  max: 100,
  steadyAbove: 55,
  waverAbove: 25,
  hysteresis: 5,
  perDown: 14, // a friend falling within sight
  perRout: 9, // a friend breaking within sight
  contagionRadius: 150,
  rallyRate: 8, // /s recovered out of contact
  contactCooldown: 3,
  coverRallyBonus: 4,
};

export const FLANK = {
  frontHalfAngle: 55,
  rearHalfAngle: 45,
  flankMoraleMult: 2.0,
  rearMoraleMult: 3.0,
  meleeToHitFlank: 1.3, // small to-hit help in melee from a bad angle
  meleeToHitRear: 1.6,
};

export const MOVE = {
  turnRate: 200, // deg/s — figures pivot fast
  waverSpeedMult: 0.65,
  routSpeedMult: 1.3,
  arriveSlack: 5,
};

export const FATIGUE = {
  perPaceMoved: 0.02,
  recoverRate: 5,
  speedPenaltyAt100: 0.4,
  firePenaltyAt100: 0.35,
};

// ---- Officer rally (light active) ------------------------------------------
export const RALLY = {
  radius: 170,
  boost: 28,
  immunity: 5, // seconds of rout-immunity after a rally
  uses: 2, // per officer
  cooldown: 22,
};

export const TERRAIN = {
  coverIncomingMult: 0.6,
  highGroundRangeBonus: 25,
  highGroundHitBonus: 1.2,
  highGroundMoraleSteady: 2,
};

export const COLOR = {
  field: "#20301c",
  fieldLine: "#3a5330",
  cover: "#2f5a34",
  highGround: "#5a5330",
  choke: "#4a4038",
  player: "#4ea3ff",
  playerOfficer: "#bfe0ff",
  enemy: "#ff6b52",
  enemyOfficer: "#ffc2b5",
  routing: "#8a8f95",
  moraleSteady: "#6de07a",
  moraleWaver: "#e0d46d",
  moraleRout: "#ff6b52",
  hp: "#d7e3ea",
  barBack: "#000000",
  fire: "#ffd36b",
  flank: "#ff4bd8",
  melee: "#ff8c3c",
  selection: "#ffffff",
  dragBox: "#9fe0ff",
  aura: "#7fd0ff",
  facing: "#0b1410",
};

export const FLASH = { ttl: 0.3 };
