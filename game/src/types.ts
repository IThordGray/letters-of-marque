// Entity data for the land module. Plain data only — behaviour lives in systems
// (pure functions over the world), never on the struct. Fields join per slice, as
// the system that uses them lands. Morale/stat fields arrive with KAN-14.

export type Side = "player" | "enemy";
export type UnitKind = "pirate" | "officer";
export type WeaponType = "musket" | "pistol" | "cannon";

export interface Unit {
  id: number;
  side: Side;
  kind: UnitKind;
  x: number; // world position, paces
  y: number;
  facing: number; // degrees, 0 = +x, y down
  moveTarget: { x: number; y: number } | null; // active move order, world paces

  // combat (KAN-13, attrition only)
  hp: number;
  maxHp: number;
  weapon: WeaponType;
  powder: number; // shots remaining
  reload: number; // seconds until it can fire again
  attackTargetId: number | null; // ordered fire target
}
