// Entity data for the land module. Plain data only — behaviour lives in systems
// (pure functions over the world), never on the struct.

export type Side = "player" | "enemy";
export type UnitKind = "pirate" | "officer";
export type WeaponType = "musket" | "pistol" | "cannon";
export type UnitState = "steady" | "wavering" | "routing" | "down";
export type Cause = "fire" | "melee" | "flank" | "rear" | "friend-down" | null;
export type Stance = "aggressive" | "holdGround" | "ceaseFire";

export interface Unit {
  id: number;
  side: Side;
  kind: UnitKind;
  name?: string; // named officers (from the deploy roster); rank-and-file pirates are unnamed
  x: number; // world position, paces
  y: number;
  facing: number; // degrees, 0 = +x, y down
  moveTarget: { x: number; y: number } | null;

  // combat
  hp: number;
  maxHp: number;
  weapon: WeaponType;
  powder: number;
  reload: number; // seconds until it can fire again
  meleeReload: number; // seconds until the next melee blow
  attackTargetId: number | null;
  ferocity: number; // melee prowess, 0..100
  marks: number; // marksmanship (accuracy stat), 0..100

  // morale (KAN-14) — the real "health": break it and they rout, before they die
  morale: number; // 0..100
  state: UnitState;
  lastCause: Cause; // why morale last fell (for legible logs)
  lastHitAt: number; // sim time of last morale blow (recovery cooldown)

  // command (KAN-15)
  stance: Stance;
  attackMove: boolean; // advancing to a point but engaging enemies met on the way

  // officers (KAN-18)
  squadId: number; // id of this figure's squad officer (an officer's own id for himself)
  rallyReadyAt: number; // sim time an officer may rally again

  // navigation (KAN-52) — a cached path around buildings, recomputed when the goal moves
  path?: { x: number; y: number }[];
  pathGoal?: { x: number; y: number };
}

export type TerrainKind = "cover" | "highGround" | "choke";
export interface Terrain {
  kind: TerrainKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BuildingKind =
  | "dwelling"
  | "warehouse"
  | "church"
  | "governor"
  | "gaol"
  | "magazine"
  | "barracks"
  | "fort"
  | "wall";
export type BuildingState = "intact" | "looted" | "burning" | "razed";

// A town structure: a footprint + a kind (what it is / will yield) + a state. The state
// and loot are reserved for the plunder layer (loot / raze / torch); blocking movement
// and fire come later (S5 / S6). For now buildings render and give the town its shape.
export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  state: BuildingState;
  loot?: number; // value still inside (0 once looted / destroyed)
  lootProgress?: number; // seconds worked so far while being looted
}
