import type { World } from "./world";
import type { Side, UnitKind, WeaponType } from "./types";
import { WORLD, SPAWN, UNIT, WEAPON } from "./constants";
import { formationSlots } from "./formation";

// The one place unit ids are minted. `weapon` overrides the kind's default kit
// (used by deploy-and-equip); omit it to keep the default — officer → pistol, else
// musket. Returns the new unit's id.
export function spawnUnit(
  world: World,
  side: Side,
  kind: UnitKind,
  x: number,
  y: number,
  squadId?: number,
  weapon?: WeaponType,
): number {
  const id = world.nextId++;
  const facing = side === "player" ? 270 : 90; // player faces up-field, enemy faces down
  const wep: WeaponType = weapon ?? (kind === "officer" ? "pistol" : "musket");
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
    weapon: wep,
    powder: WEAPON[wep].powder,
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

// One band: an officer and his pirates clustered into a bunch, facing the foe. The
// officer keeps his pistol & cutlass; the pirates carry `weapon` (default musket).
export function spawnBand(
  world: World,
  side: Side,
  cx: number,
  cy: number,
  pirates: number = SPAWN.pirates,
  weapon?: WeaponType,
): number {
  const n = pirates + 1;
  const slots = formationSlots(n, cx, cy, SPAWN.spacing);
  const officerId = spawnUnit(world, side, "officer", slots[0].x, slots[0].y); // officer near the centre
  for (let i = 1; i < n; i++) spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, officerId, weapon);
  return officerId;
}

// The player's landing party, chosen on the deploy screen: how many pirates and the
// weapon they carry. (A named-officer roster and per-squad kit come in later stories.)
export interface PartySpec {
  pirates: number;
  weapon: WeaponType;
}

// Static field features to fight over (throwaway test layout).
function seedTerrain(world: World) {
  world.terrain.push(
    { kind: "cover", x: WORLD.width / 2 - 300, y: WORLD.height / 2 - 50, w: 600, h: 100 },
    { kind: "highGround", x: WORLD.width / 2 - 720, y: WORLD.height / 2 - 130, w: 260, h: 220 },
    { kind: "choke", x: WORLD.width / 2 + 440, y: WORLD.height / 2 - 260, w: 150, h: 520 },
  );
}

// Build a battle: the player's chosen landing party vs a fixed test garrison.
export function populateBattle(world: World, party: PartySpec) {
  seedTerrain(world);
  spawnBand(world, "player", WORLD.width / 2, WORLD.height - SPAWN.edgeInset, party.pirates, party.weapon);
  spawnBand(world, "enemy", WORLD.width / 2, SPAWN.edgeInset); // fixed test garrison
}

// Default band-vs-band — kept for headless smokes and a no-deploy fallback.
export function populateTestBattle(world: World) {
  populateBattle(world, { pirates: SPAWN.pirates, weapon: "musket" });
}
