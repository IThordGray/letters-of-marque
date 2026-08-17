import type { ShipClass } from "./constants";

export type Faction = "player" | "enemy";

export type Formation = "line-ahead" | "line-abreast" | "loose";
export type Stance = "engage" | "standoff" | "breakoff";
export type TargetMode = "nearest" | "weakest" | "named" | "hold";
export type ShotType = "round" | "chain";
export type Cohesion = "formed" | "loose";

// A captain's current relationship to the group's orders. Deterministic and
// sticky — set by trait + situation, narrated on change (§14.1).
export type Mood = "obey" | "chase" | "refuse-recall" | "shy" | "unnerved";

export interface Captain {
  name: string;
  aggression: number; // -100..100
  obedience: number; // -100..100
  nerve: number; // -100..100
}

export interface Ship {
  id: number;
  shipName: string;
  captain: Captain;
  cls: ShipClass;
  faction: Faction;
  groupId: number;

  x: number;
  y: number;
  heading: number; // deg
  speed: number; // current yd/s

  maxHull: number;
  maxRigging: number;
  hull: number;
  rigging: number;

  portReload: number; // seconds until the port battery is loaded (0 = ready)
  stbdReload: number; // seconds until the starboard battery is loaded

  inIrons: number; // seconds remaining stuck in irons (0 = free)
  ironsFalloff: number; // which way to fall off when irons ends (+1 / -1)
  tackTarget: number | null; // heading being swung to during a committed tack

  struck: boolean;

  // Individual interpretation state (§14.1):
  mood: Mood; // what this captain is doing relative to orders right now
  chaseTargetId: number | null; // the quarry, while mood === "chase"

  wake: Array<{ x: number; y: number }>;
}

export interface Group {
  id: number;
  faction: Faction;
  name: string;
  shipIds: number[];
  commanderId: number;
  startingStrength: number;

  formation: Formation;
  stance: Stance;
  targetMode: TargetMode;
  namedTargetId: number | null;
  shot: ShotType;
  generalChase: boolean;
  moveTarget: { x: number; y: number } | null;

  cohesion: Cohesion;

  // Fixed enemy personality (ignored for player groups):
  aiKind?: "line" | "aggressive";
}

export interface Wind {
  t: number; // elapsed seconds, drives the drift noise
  toward: number; // direction wind blows toward, deg
  from: number; // toward + 180, deg — the "eye of the wind" direction
}

export interface Flash {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  rake: boolean;
  ttl: number;
}

export interface GameState {
  ships: Map<number, Ship>;
  groups: Group[];
  wind: Wind;
  flashes: Flash[];
  time: number; // elapsed sim seconds
  over: boolean;
  outcome: string;
}
