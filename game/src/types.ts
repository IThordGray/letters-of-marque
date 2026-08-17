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

  // morale (KAN-14) — the real "health": break it and they rout, before they die
  morale: number; // 0..100
  state: UnitState;
  lastCause: Cause; // why morale last fell (for legible logs)
  lastHitAt: number; // sim time of last morale blow (recovery cooldown)

  // command (KAN-15)
  stance: Stance;
  attackMove: boolean; // advancing to a point but engaging enemies met on the way
}
