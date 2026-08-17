import type { WeaponType } from "./constants";

export type Side = "player" | "enemy";
export type UnitKind = "pirate" | "officer";
export type UnitState = "steady" | "wavering" | "routing" | "down";
export type Cause = "fire" | "flank" | "rear" | "melee" | "friend-down";

// RTS engagement stance — the unit's default behaviour when it has no explicit
// order (or once an order is finished).
export type Stance = "aggressive" | "hold-ground" | "cease-fire";

export interface Perks {
  deadEye: boolean; // +ranged accuracy
  cutthroat: boolean; // +melee
  ironWill: boolean; // stronger morale-floor aura
  oldSalt: boolean; // rally can turn routers back
}

export interface Unit {
  id: number;
  name: string;
  side: Side;
  kind: UnitKind;
  weapon: WeaponType;
  squadId: number;

  x: number;
  y: number;
  facing: number;

  hp: number;
  maxHp: number;

  // base stats (officers roll higher); effective stats add the officer's imbue
  marks: number;
  ferocity: number;
  nerve: number;
  presence: number; // officers only (0 for pirates)
  perks: Perks;

  morale: number;
  fatigue: number;
  state: UnitState;

  reload: number; // seconds until it can fire
  meleeReload: number; // seconds until next melee blow
  powder: number;

  stance: Stance;
  moveTarget: { x: number; y: number } | null;
  attackTargetId: number | null;

  inspiredUntil: number;
  lastCause: Cause | null;
  lastCauseAt: number;
  lastHitAt: number;

  // officers only
  rallyUses: number;
  rallyReadyAt: number;
}

export interface Squad {
  id: number;
  side: Side;
  officerId: number | null;
  memberIds: number[];
}

export type TerrainKind = "cover" | "highground" | "choke";
export interface Terrain {
  kind: TerrainKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Flash {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: "fire" | "flank" | "melee";
  ttl: number;
}

export interface GameState {
  units: Map<number, Unit>;
  squads: Squad[];
  terrain: Terrain[];
  flashes: Flash[];
  time: number;
  over: boolean;
  outcome: string;
}
