import type { World } from "./world";
import type { Side, UnitKind, WeaponType } from "./types";
import { WORLD, SPAWN, UNIT, WEAPON } from "./constants";

// The one place unit ids are minted. Returns the new unit's id.
export function spawnUnit(world: World, side: Side, kind: UnitKind, x: number, y: number): number {
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
    attackTargetId: null,
    morale: UNIT[kind].morale,
    state: "steady",
    lastCause: null,
    lastHitAt: -999,
  });
  return id;
}

// One band: an officer with a rank of pirates in front of him, facing the foe.
function spawnBand(world: World, side: Side, cx: number, cy: number) {
  const toward = side === "player" ? -1 : 1;
  spawnUnit(world, side, "officer", cx, cy);
  const half = (SPAWN.pirates - 1) / 2;
  for (let i = 0; i < SPAWN.pirates; i++) {
    const x = cx + (i - half) * SPAWN.spacing;
    spawnUnit(world, side, "pirate", x, cy + toward * SPAWN.rankOffset);
  }
}

// Throwaway two-band skirmish so there's something to see, command, and fight.
export function populateTestBattle(world: World) {
  spawnBand(world, "player", WORLD.width / 2, WORLD.height - SPAWN.edgeInset);
  spawnBand(world, "enemy", WORLD.width / 2, SPAWN.edgeInset);
}
