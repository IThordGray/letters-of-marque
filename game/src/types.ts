// Entity data for the land module. Plain data only — behaviour lives in systems
// (pure functions over the world), never on the struct. Minimal for the
// foundation; combat / morale / stat fields join when their systems arrive.

export type Side = "player" | "enemy";
export type UnitKind = "pirate" | "officer";

export interface Unit {
  id: number;
  side: Side;
  kind: UnitKind;
  x: number; // world position, paces
  y: number;
  facing: number; // degrees, 0 = +x, y down
  moveTarget: { x: number; y: number } | null; // active move order, world paces
}
