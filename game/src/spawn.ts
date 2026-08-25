import type { World } from "./world";
import type { Side, UnitKind, WeaponType, Stance } from "./types";
import type { OfficerProfile } from "./roster";
import { WORLD, SPAWN, UNIT, WEAPON, DEPLOY, RAID } from "./constants";
import { formationSlots } from "./formation";
import { makeRoster } from "./roster";
import { signal } from "./log";

// Optional overrides for a spawned figure. Omitted fields fall back to the kind's
// defaults (officer → pistol & base stats, pirate → musket & base stats).
interface SpawnOpts {
  squadId?: number;
  weapon?: WeaponType;
  name?: string;
  ferocity?: number;
  marks?: number;
  morale?: number;
  stance?: Stance;
}

// The one place unit ids are minted. Returns the new unit's id.
export function spawnUnit(world: World, side: Side, kind: UnitKind, x: number, y: number, opts: SpawnOpts = {}): number {
  const id = world.nextId++;
  const facing = side === "player" ? 270 : 90; // player faces up-field, enemy faces down
  const wep: WeaponType = opts.weapon ?? (kind === "officer" ? "pistol" : "musket");
  world.units.push({
    id,
    side,
    kind,
    name: opts.name,
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
    ferocity: opts.ferocity ?? UNIT[kind].ferocity,
    marks: opts.marks ?? UNIT[kind].marks,
    morale: opts.morale ?? UNIT[kind].morale,
    state: "steady",
    lastCause: null,
    lastHitAt: -999,
    stance: opts.stance ?? "aggressive",
    attackMove: false,
    squadId: kind === "officer" ? id : (opts.squadId ?? id),
    rallyReadyAt: 0,
  });
  return id;
}

// One squad the player composed: a (named, rolled-stat) officer leading a share of
// pirates, all carrying one weapon. `officer: null` is a leaderless band of pirates.
export interface SquadSpec {
  officer: OfficerProfile | null;
  pirates: number;
  weapon: WeaponType;
}

// The whole landing party — one or more squads.
export interface PartySpec {
  squads: SquadSpec[];
}

// Spawn one squad clustered around (cx, cy): the officer near the centre keeps his
// pistol & cutlass and his rolled stats; the pirates carry the squad's weapon and
// point at their officer for carry-over / presence / rally.
function spawnSquad(world: World, side: Side, cx: number, cy: number, sq: SquadSpec) {
  const total = sq.pirates + (sq.officer ? 1 : 0);
  if (total <= 0) return;
  const slots = formationSlots(total, cx, cy, SPAWN.spacing);
  let i = 0;
  let officerId: number | undefined;
  if (sq.officer) {
    officerId = spawnUnit(world, side, "officer", slots[0].x, slots[0].y, {
      name: sq.officer.name,
      ferocity: sq.officer.ferocity,
      marks: sq.officer.marks,
      morale: sq.officer.morale,
    });
    i = 1;
  }
  for (; i < slots.length; i++) {
    spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, { squadId: officerId, weapon: sq.weapon });
  }
}

// The player's party, its squads spread along the near edge facing the foe.
function spawnPlayerParty(world: World, party: PartySpec) {
  const squads = party.squads.filter((s) => s.pirates > 0 || s.officer);
  const n = squads.length;
  const cy = WORLD.height - SPAWN.edgeInset;
  const spread = Math.min(WORLD.width * 0.6, Math.max(n, 1) * 340);
  const x0 = WORLD.width / 2 - spread / 2;
  squads.forEach((sq, idx) => {
    const cx = n <= 1 ? WORLD.width / 2 : x0 + (spread * idx) / (n - 1);
    spawnSquad(world, "player", cx, cy, sq);
  });
}

// A plain officer-led band (no roster / no rolled stats) — used for the enemy.
function spawnPlainBand(
  world: World,
  side: Side,
  cx: number,
  cy: number,
  pirates: number,
  weapon?: WeaponType,
  stance?: Stance,
) {
  const slots = formationSlots(pirates + 1, cx, cy, SPAWN.spacing);
  const officerId = spawnUnit(world, side, "officer", slots[0].x, slots[0].y, { stance });
  for (let i = 1; i <= pirates; i++) {
    spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, { squadId: officerId, weapon, stance });
  }
}

// The fixed test garrison — dug in on the rise in front of the prize, holding their
// ground (firing from their posts) until the raid rouses them.
function spawnEnemyGarrison(world: World) {
  spawnPlainBand(world, "enemy", WORLD.width / 2, 250, DEPLOY.garrison, "musket", "holdGround");
}

// The garrison's strength (defenders + their officer) — surfaced so the deploy screen
// can preview what the raid faces, straight from the same source it spawns from.
export function enemyGarrisonSize(): number {
  return DEPLOY.garrison + 1;
}

// A reinforcement wave that musters from the town gate when the alarm climbs. Spawns
// aggressive (they come to hunt, not to hold); the AI directs them from there.
export function spawnReinforcementWave(world: World, pirates: number) {
  spawnPlainBand(world, "enemy", RAID.musterPoint.x, RAID.musterPoint.y, pirates, "musket", "aggressive");
  signal(world, "Fresh defenders pour in from the town!");
}

// The raid ground: the prize sits on a defended rise (high ground for the garrison),
// with cover on the raider's approach and a choke on one flank.
function seedTerrain(world: World) {
  world.terrain.push(
    { kind: "highGround", x: WORLD.width / 2 - 220, y: 40, w: 440, h: 250 }, // the defended rise — the prize is on it
    { kind: "cover", x: WORLD.width / 2 - 360, y: WORLD.height / 2 - 30, w: 720, h: 90 }, // cover on the approach
    { kind: "choke", x: WORLD.width / 2 + 360, y: 300, w: 150, h: 460 }, // a flank choke
  );
}

// Build a battle: the player's composed landing party vs the fixed garrison, with the
// raid objective set behind the defenders (you must drive through them to reach it).
export function populateBattle(world: World, party: PartySpec) {
  seedTerrain(world);
  spawnPlayerParty(world, party);
  spawnEnemyGarrison(world);
  world.raid.objective = { x: WORLD.width / 2, y: 150, seized: false, seizeProgress: 0 };
  world.raid.extraction = { y: WORLD.height - 100 }; // the beach — behind where the party lands
}

// Default party vs garrison — kept for headless smokes and a no-deploy fallback.
export function populateTestBattle(world: World) {
  const roster = makeRoster();
  populateBattle(world, { squads: [{ officer: roster.officers[0] ?? null, pirates: SPAWN.pirates, weapon: "musket" }] });
}
