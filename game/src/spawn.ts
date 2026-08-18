import type { World } from "./world";
import type { Side, UnitKind, WeaponType } from "./types";
import { WORLD, SPAWN, UNIT, WEAPON } from "./constants";
import { formationSlots } from "./formation";

// The one place unit ids are minted. Returns the new unit's id.
export function spawnUnit(world: World, side: Side, kind: UnitKind, x: number, y: number, squadId?: number): number {
  const id = world.nextId++;
  const facing = side === "player" ? 270 : 90; // player faces up-field, enemy faces down
  const weapon: WeaponType = kind === "officer" ? "pistol" : "musket";
  world.units.push({
    id,
    side,
    kind,
    x,
    y,
    facing,
    moveTarget: null,
    hp: UNIT[kind].hp,
    maxHp: UNIT[kind].hp,
    weapon,
    powder: WEAPON[weapon].powder,
    reload: 0,
    meleeReload: 0,
    attackTargetId: null,
    ferocity: UNIT[kind].ferocity,
    marks: UNIT[kind].marks,
    morale: UNIT[kind].morale,
    state: "steady",
    lastCause: null,
    lastHitAt: -999,
    stance: "aggressive",
    attackMove: false,
    squadId: kind === "officer" ? id : (squadId ?? id),
    rallyReadyAt: 0,
  });
  return id;
}

// One band: an officer and his pirates clustered into a bunch, facing the foe.
function spawnBand(world: World, side: Side, cx: number, cy: number) {
  const n = SPAWN.pirates + 1;
  const slots = formationSlots(n, cx, cy, SPAWN.spacing);
  const officerId = spawnUnit(world, side, "officer", slots[0].x, slots[0].y); // officer near the centre
  for (let i = 1; i < n; i++) spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, officerId);
}

// Throwaway two-band skirmish so there's something to see, command, and fight.
export function populateTestBattle(world: World) {
  // a few field features between the bands to fight over (throwaway test layout)
  world.terrain.push(
    { kind: "cover", x: WORLD.width / 2 - 300, y: WORLD.height / 2 - 50, w: 600, h: 100 },
    { kind: "highGround", x: WORLD.width / 2 - 720, y: WORLD.height / 2 - 130, w: 260, h: 220 },
    { kind: "choke", x: WORLD.width / 2 + 440, y: WORLD.height / 2 - 260, w: 150, h: 520 },
  );
  spawnBand(world, "player", WORLD.width / 2, WORLD.height - SPAWN.edgeInset);
  spawnBand(world, "enemy", WORLD.width / 2, SPAWN.edgeInset);
}
