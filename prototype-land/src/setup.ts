import type { GameState, Unit, Squad, Side, UnitKind, Terrain, Perks, Stance } from "./types";
import type { WeaponType } from "./constants";
import { UNIT, WEAPON, PERK } from "./constants";
import { clamp, randInt } from "./math";
import { makeSurnameDrawer, officerName } from "./names";

let nextId = 1;
let nextSquad = 1;
const drawSurname = makeSurnameDrawer();

function rollPerks(marks: number, ferocity: number, presence: number): Perks {
  return {
    deadEye: marks >= PERK.deadEyeMarks,
    cutthroat: ferocity >= PERK.cutthroatFero,
    ironWill: presence >= PERK.ironWillPres,
    oldSalt: presence >= PERK.oldSaltPres,
  };
}

function makeUnit(
  kind: UnitKind,
  side: Side,
  weapon: WeaponType,
  x: number,
  y: number,
  facing: number,
  squadId: number,
  name: string,
  moraleBase: number,
  stance: Stance,
): Unit {
  let marks: number;
  let ferocity: number;
  let presence: number;
  let nerve: number;
  let hp: number;
  if (kind === "officer") {
    const o = UNIT.officer;
    marks = randInt(o.marksLo, o.marksHi);
    ferocity = randInt(o.feroLo, o.feroHi);
    presence = randInt(o.presLo, o.presHi);
    nerve = randInt(o.nerveLo, o.nerveHi);
    hp = o.hp;
  } else {
    const p = UNIT.pirate;
    marks = clamp(p.marks + randInt(-8, 8), 5, 95);
    ferocity = clamp(p.ferocity + randInt(-8, 8), 5, 95);
    presence = 0;
    nerve = clamp(p.nerve + randInt(-8, 8), 5, 95);
    hp = p.hp;
  }
  const w = WEAPON[weapon];
  return {
    id: nextId++,
    name,
    side,
    kind,
    weapon,
    squadId,
    x,
    y,
    facing,
    hp,
    maxHp: hp,
    marks,
    ferocity,
    nerve,
    presence,
    perks: rollPerks(marks, ferocity, presence),
    morale: clamp(moraleBase + Math.round(nerve / 6), 0, 100),
    fatigue: 0,
    state: "steady",
    reload: Math.random() * 3,
    meleeReload: 0,
    powder: w.powder,
    stance,
    moveTarget: null,
    attackTargetId: null,
    inspiredUntil: 0,
    lastCause: null,
    lastCauseAt: 0,
    lastHitAt: 0,
    rallyUses: kind === "officer" ? 2 : 0,
    rallyReadyAt: 0,
  };
}

export function makeInitialState(): GameState {
  const units = new Map<number, Unit>();
  const squads: Squad[] = [];

  // Build one squad: an officer + equipped pirates, laid out in a short line.
  function squad(side: Side, weapons: WeaponType[], officerWeapon: WeaponType, cx: number, cy: number, facing: number, moraleBase: number) {
    const id = nextSquad++;
    const surname = drawSurname();
    const memberIds: number[] = [];
    // Player raiders start Aggressive; the garrison holds its ground (§ raid).
    const stance: Stance = side === "player" ? "aggressive" : "hold-ground";
    // officer at the centre-rear
    const off = makeUnit("officer", side, officerWeapon, cx, cy + (side === "player" ? 22 : -22), facing, id, officerName(surname), moraleBase + 14, stance);
    units.set(off.id, off);
    // pirates spread across the front
    const span = (weapons.length - 1) * 34;
    weapons.forEach((w, i) => {
      const px = cx - span / 2 + i * 34;
      const u = makeUnit("pirate", side, w, px, cy, facing, id, `${surname}'s ${w === "cannon" ? "gun" : "pirate"}`, moraleBase, stance);
      units.set(u.id, u);
      memberIds.push(u.id);
    });
    squads.push({ id, side, officerId: off.id, memberIds });
  }

  // Player: a pirate band — a shock squad and a fire squad. South, facing north.
  squad("player", ["pistol", "pistol", "musket"], "pistol", 360, 600, 270, 54);
  squad("player", ["musket", "musket", "cannon"], "musket", 640, 610, 270, 54);

  // Enemy: a town garrison — two holding lines of militia. North, facing south.
  // Brittle (lower morale) but numerous-ish; deliberately dumb.
  squad("enemy", ["musket", "musket", "musket", "musket"], "musket", 380, 160, 90, 40);
  squad("enemy", ["musket", "musket", "musket"], "musket", 660, 160, 90, 40);

  const terrain: Terrain[] = [
    { kind: "cover", x: 120, y: 300, w: 180, h: 170 },
    { kind: "highground", x: 430, y: 300, w: 170, h: 130 },
    { kind: "cover", x: 780, y: 320, w: 150, h: 150 },
    { kind: "choke", x: 470, y: 470, w: 90, h: 60 },
  ];

  return { units, squads, terrain, flashes: [], time: 0, over: false, outcome: "" };
}

export function squadOf(state: GameState, u: Unit): Squad | undefined {
  return state.squads.find((s) => s.id === u.squadId);
}
