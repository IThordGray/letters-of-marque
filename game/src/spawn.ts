import type { World } from "./world";
import type { Side, UnitKind, WeaponType, Stance, BuildingKind, SettlementTier } from "./types";
import type { OfficerProfile } from "./roster";
import { WORLD, SPAWN, UNIT, WEAPON, DEPLOY, RAID, LOOT, TIER, PLAYER_CREW } from "./constants";

// A figure's three combat stats — the shape a settlement tier's bands come in.
type Stats = { morale: number; ferocity: number; marks: number };
import { formationSlots } from "./formation";
import { makeRoster } from "./roster";
import { signal } from "./log";
import { buildNavGrid } from "./nav";

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
    // player pirates land at the seasoned crew baseline (steadier than the rabble); enemy
    // pirates raised this way take their tier band instead
    const troop = side === "player" ? PLAYER_CREW.pirate : undefined;
    spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, { squadId: officerId, weapon: sq.weapon, ...troop });
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

// A plain officer-led band (no roster / no rolled stats) — used for the enemy. `troop` /
// `officer` set the men's and their leader's stats (from a settlement tier); omitted → the
// UNIT defaults.
function spawnPlainBand(
  world: World,
  side: Side,
  cx: number,
  cy: number,
  pirates: number,
  weapon?: WeaponType,
  stance?: Stance,
  troop?: Stats,
  officer?: Stats,
) {
  const slots = formationSlots(pirates + 1, cx, cy, SPAWN.spacing);
  const officerId = spawnUnit(world, side, "officer", slots[0].x, slots[0].y, { stance, ...officer });
  for (let i = 1; i <= pirates; i++) {
    spawnUnit(world, side, "pirate", slots[i].x, slots[i].y, { squadId: officerId, weapon, stance, ...troop });
  }
}

// A sentry post — a pair holding a forward corner (no officer); first to spot raiders.
function spawnPost(world: World, x: number, y: number, n: number, troop?: Stats) {
  const slots = formationSlots(n, x, y, SPAWN.spacing);
  for (let i = 0; i < n; i++) {
    spawnUnit(world, "enemy", "pirate", slots[i].x, slots[i].y, { weapon: "musket", stance: "holdGround", ...troop });
  }
}

// A patrol — a small band that walks a fixed street route while the town is dormant.
function spawnPatrol(world: World, route: { x: number; y: number }[], n: number, troop?: Stats) {
  const slots = formationSlots(n, route[0].x, route[0].y, SPAWN.spacing);
  const members: number[] = [];
  for (let i = 0; i < n; i++) {
    members.push(
      spawnUnit(world, "enemy", "pirate", slots[i].x, slots[i].y, { weapon: "musket", stance: "holdGround", ...troop }),
    );
  }
  world.patrols.push({ members, route, idx: 1 });
}

// The garrison, distributed like a town's watch rather than one blob: the main guard holds
// the plaza (the prize), sentries hold the seaward approach, and patrols walk the cross-
// streets. Both its strength (stat bands) and its depth (headcounts) scale with the town's
// settlement tier — a sleepy outpost is a thin, brittle watch; a capital, a deep one.
function spawnEnemyGarrison(world: World, tier: SettlementTier) {
  const t = TIER[tier];
  spawnPlainBand(world, "enemy", 1200, 700, t.watch.plazaGuard, "musket", "holdGround", t.troop, t.officer);
  const posts = [
    { x: 1050, y: 1680 }, // seaward approach, west
    { x: 1350, y: 1680 }, // seaward approach, east
  ];
  for (let i = 0; i < t.watch.sentryPosts && i < posts.length; i++) {
    spawnPost(world, posts[i].x, posts[i].y, 2, t.troop);
  }
  const routes = [
    [{ x: 780, y: 1050 }, { x: 1620, y: 1050 }], // upper cross-street
    [{ x: 1620, y: 1330 }, { x: 780, y: 1330 }], // lower cross-street
    [{ x: 780, y: 1610 }, { x: 1620, y: 1610 }], // quay approach (capitals only)
  ];
  for (let i = 0; i < t.watch.patrols && i < routes.length; i++) {
    spawnPatrol(world, routes[i], t.watch.patrolSize, t.troop);
  }
}

// The garrison's strength (defenders + their officer) — surfaced so the deploy screen
// can preview what the raid faces, straight from the same source it spawns from.
export function enemyGarrisonSize(): number {
  return DEPLOY.garrison + 1;
}

// A reinforcement wave that musters from the town gate when the alarm climbs. Spawns
// aggressive (they come to hunt, not to hold), at the defended town's tier strength; the AI
// directs them from there.
export function spawnReinforcementWave(world: World, pirates: number) {
  const t = TIER[world.tier];
  spawnPlainBand(world, "enemy", RAID.musterPoint.x, RAID.musterPoint.y, pirates, "musket", "aggressive", t.troop, t.officer);
  signal(world, "Fresh defenders pour in from the town!");
}

// Terrain read off the town layout: the battery & church sit on high ground, the landward
// gate is a choke, and every other building gives cover along its walls. terrainAt is
// first-match, so high ground + choke are pushed before the cover aprons (they win where
// they overlap).
function deriveTerrain(world: World) {
  const t = world.terrain;
  for (const b of world.buildings) {
    if (b.kind === "fort" || b.kind === "church") {
      t.push({ kind: "highGround", x: b.x - 40, y: b.y - 40, w: b.w + 80, h: b.h + 80 });
    }
  }
  const walls = world.buildings.filter((wl) => wl.kind === "wall").sort((a, c) => a.x - c.x);
  if (walls.length === 2) {
    const gx0 = walls[0].x + walls[0].w;
    t.push({ kind: "choke", x: gx0, y: walls[0].y - 30, w: walls[1].x - gx0, h: 150 }); // the gate
  }
  for (const b of world.buildings) {
    if (b.kind === "wall" || b.kind === "fort" || b.kind === "church") continue;
    t.push({ kind: "cover", x: b.x - 14, y: b.y - 14, w: b.w + 28, h: b.h + 28 }); // fight from the walls
  }
}

// The town — a small 16th-century Spanish-colonial port laid out on the "Laws of the
// Indies" pattern: a central plaza with the church (the prize lives inside it) and the
// governor's house fronting it and the battery on the rise; a rectilinear grid of blocks
// down the main street from the plaza to the quay; warehouses on the water; the barracks
// by the landward gate. Buildings sit in aligned blocks (streets = the gaps between them);
// they only render for now (no collision yet).
function seedTown(world: World) {
  let id = 1;
  const b = (kind: BuildingKind, x: number, y: number, w: number, h: number) =>
    world.buildings.push({ id: id++, kind, x, y, w, h, state: "intact", loot: LOOT[kind] });

  // landward wall with a central gate (the head of the main street); barracks + a
  // guardhouse just inside it
  b("wall", 700, 190, 420, 30);
  b("wall", 1280, 190, 420, 30);
  b("barracks", 740, 250, 200, 100);
  b("dwelling", 1340, 250, 180, 100);

  // the plaza — the church closes its head (prize inside), the governor's house to the
  // west, the battery on the rise to the east
  b("church", 1080, 320, 240, 150);
  b("governor", 760, 470, 180, 200);
  b("fort", 1460, 460, 200, 200);

  // town blocks lining the main street — a grid, with the gaol and powder magazine among
  // the dwellings
  b("dwelling", 700, 840, 195, 150);
  b("dwelling", 915, 840, 195, 150);
  b("gaol", 1290, 840, 200, 150);
  b("dwelling", 1505, 840, 195, 150);

  b("dwelling", 700, 1120, 195, 150);
  b("magazine", 915, 1120, 170, 150);
  b("dwelling", 1290, 1120, 195, 150);
  b("dwelling", 1505, 1120, 195, 150);

  b("dwelling", 700, 1400, 195, 150);
  b("dwelling", 915, 1400, 195, 150);
  b("dwelling", 1290, 1400, 195, 150);
  b("dwelling", 1505, 1400, 195, 150);

  // the quay — warehouses flank the street's mouth to the water, a customs house between
  b("warehouse", 700, 1780, 320, 180);
  b("warehouse", 1380, 1780, 320, 180);
  b("dwelling", 1085, 1810, 200, 140);
}

// Build a battle: the player's composed landing party vs the town's garrison, whose strength
// and depth follow the settlement `tier`. The current playable town defends at `outpost`
// grade so the raid reads as winnable against a seasoned band (tune by playtest).
export function populateBattle(world: World, party: PartySpec, tier: SettlementTier = "outpost") {
  world.tier = tier;
  seedTown(world);
  deriveTerrain(world);
  world.navGrid = buildNavGrid(world);
  spawnPlayerParty(world, party);
  spawnEnemyGarrison(world, tier);
  world.raid.extraction = { y: WORLD.height - 100 }; // the beach — behind where the party lands
  // the church keeps its rich seeded loot (LOOT.church) — it *is* the strong-house / big haul
}

// Default party vs garrison — kept for headless smokes and a no-deploy fallback.
export function populateTestBattle(world: World) {
  const roster = makeRoster();
  populateBattle(world, { squads: [{ officer: roster.officers[0] ?? null, pirates: SPAWN.pirates, weapon: "musket" }] });
}
