import type { World, RaidResult } from "./world";
import type { Unit, Building } from "./types";
import { RAID } from "./constants";
import { dist } from "./math";
import { nextFloat } from "./rng";
import { signal } from "./log";
import { desc } from "./naming";
import { applyMorale } from "./morale";
import { spawnReinforcementWave } from "./spawn";

// The raid scenario layer: plunder (loot buildings → carriable loads), the extraction zone
// (the boats), the alarm (the garrison rouses + musters), and the graded haul-vs-cost
// outcome. Pure and deterministic; run after movement/morale so it reads current state.
export function stepRaid(world: World, dt: number) {
  if (world.over) return;
  const A = RAID.alarm;

  // being spotted starts the clock; time ashore then creeps it up (gunfire/runners spike it)
  if (world.raid.alarm === 0 && raidersSpotted(world)) {
    world.raid.alarmHeat = Math.max(world.raid.alarmHeat, A.roused);
  }
  if (world.raid.alarm >= 1) world.raid.alarmHeat += A.perSec * dt;

  lootBuildings(world, dt);
  captureSurrendered(world);
  stepLoads(world);
  ageFires(world);
  advanceAlarm(world);
  checkRaidOutcome(world);
}

// Torch (a verb-key order): each selected raider adjacent to an intact/looted building,
// with powder to spare, sets it alight — spending powder (ammo = incendiary), destroying
// whatever's still inside, and raising a loud alarm. Fire razes it after a burn time.
export function torchOrder(world: World, ids: number[]) {
  for (const id of ids) {
    const u = world.units.find((x) => x.id === id);
    if (!u || u.side !== "player" || u.state === "down" || u.powder < RAID.torch.powderCost) continue;
    let target: Building | undefined;
    for (const b of world.buildings) {
      if (b.state !== "intact" && b.state !== "looted") continue;
      if (distToRect(u.x, u.y, b.x, b.y, b.w, b.h) <= RAID.lootRange) {
        target = b;
        break;
      }
    }
    if (target) {
      u.powder -= RAID.torch.powderCost;
      target.state = "burning";
      target.burnUntil = world.time + RAID.torch.burnTime;
      target.loot = 0; // whatever's inside is lost to the flames (and its trade to the town — KAN-54)
      world.raid.alarmHeat += RAID.alarm.torchSpike;
      signal(world, `The ${target.kind} is set ablaze!`);
    }
  }
}

// Fire runs its course: a burning building razes when its burn time is up — but the powder
// magazine's fire is a lit fuse: when it burns down, it detonates.
function ageFires(world: World) {
  for (const b of world.buildings) {
    if (b.state !== "burning" || b.burnUntil == null || world.time < b.burnUntil) continue;
    if (b.kind === "magazine") {
      explode(world, b);
    } else {
      b.state = "razed";
      signal(world, `The ${b.kind} burns to the ground.`);
    }
  }
}

// The magazine goes up: a town-waking bang, death to those on top of it, a morale shock to
// everyone near (both sides), and the neighbouring buildings razed with it.
function explode(world: World, mag: Building) {
  mag.state = "razed";
  mag.loot = 0;
  world.raid.alarmHeat += RAID.explosion.alarmSpike;
  signal(world, "The powder magazine goes up in a thunderclap!");
  const bx = mag.x + mag.w / 2;
  const by = mag.y + mag.h / 2;
  for (const u of world.units) {
    if (u.state === "down") continue;
    const d = dist(u.x, u.y, bx, by);
    if (d <= RAID.explosion.lethal) {
      u.state = "down";
      u.hp = 0;
      signal(world, `${desc(u)} is caught in the blast.`);
    } else if (d <= RAID.explosion.radius) {
      applyMorale(world, u, RAID.explosion.moraleHit, "fire");
    }
  }
  for (const b of world.buildings) {
    if (b.id === mag.id || b.state === "razed") continue;
    if (distToRect(bx, by, b.x, b.y, b.w, b.h) <= RAID.explosion.razeRadius) {
      b.state = "razed";
      b.loot = 0;
    }
  }
}

function distToRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): number {
  const dx = Math.max(rx - x, 0, x - (rx + rw));
  const dy = Math.max(ry - y, 0, y - (ry + rh));
  return Math.hypot(dx, dy);
}

// Buildings are plundered by holding a free-handed raider at them (a channel, like a
// seize) — it costs time, so the alarm bites. On completion the goods become a carriable
// load the looter picks up; it only counts once banked at the boats (stepLoads).
function lootBuildings(world: World, dt: number) {
  for (const b of world.buildings) {
    if (b.state !== "intact") continue;
    const isGaol = b.kind === "gaol";
    if (!isGaol && !b.loot) continue; // nothing worth taking (and not the gaol)
    let worker: Unit | undefined;
    for (const u of world.units) {
      if (u.side !== "player" || u.state === "down" || u.state === "routing") continue;
      if (world.raid.loads.some((l) => l.carrierId === u.id)) continue; // hands full already
      if (distToRect(u.x, u.y, b.x, b.y, b.w, b.h) <= RAID.lootRange) {
        worker = u;
        break;
      }
    }
    if (!worker) {
      b.lootProgress = 0;
      continue;
    }
    b.lootProgress = (b.lootProgress ?? 0) + dt;
    if (b.lootProgress < RAID.lootTime) continue;
    if (isGaol) {
      // break it open — freed captives become prisoner loads (likely to join), left for
      // a raider to escort out
      for (let k = 0; k < RAID.gaolPrisoners; k++) {
        world.raid.loads.push({
          id: world.nextId++,
          x: b.x + b.w / 2 + (k - (RAID.gaolPrisoners - 1) / 2) * 24,
          y: b.y + b.h + 22,
          value: 0,
          kind: "prisoner",
          carrierId: null,
          prisoner: true,
          join: RAID.prisonerJoin.gaol,
        });
      }
      signal(world, "The gaol is broken open — captives freed!");
    } else {
      const val = b.loot ?? 0;
      world.raid.loads.push({ id: world.nextId++, x: worker.x, y: worker.y, value: val, kind: b.kind, carrierId: worker.id });
      signal(world, `The ${b.kind} is plundered — ${val} to carry off.`);
    }
    b.state = "looted";
    b.loot = 0;
  }
}

// A yielded enemy adjacent to a free-handed raider is taken prisoner — off the field, and
// now a prisoner load that raider must escort out (townsfolk rarely want to join — S7).
function captureSurrendered(world: World) {
  for (const e of world.units) {
    if (e.side !== "enemy" || e.state !== "surrendered") continue;
    for (const u of world.units) {
      if (u.side !== "player" || u.state === "down" || u.state === "routing") continue;
      if (world.raid.loads.some((l) => l.carrierId === u.id)) continue; // hands full
      if (dist(u.x, u.y, e.x, e.y) <= RAID.capture.range) {
        e.state = "down"; // taken off the field
        world.raid.loads.push({ id: world.nextId++, x: u.x, y: u.y, value: 0, kind: "prisoner", carrierId: u.id, prisoner: true, join: RAID.prisonerJoin.town });
        signal(world, `${desc(e)} is taken prisoner.`);
        break;
      }
    }
  }
}

// Plunder loads: a carried load rides with its carrier and banks to the haul at the boats;
// a carrier who falls or breaks drops it, and any free raider reaching a dropped load takes
// it up. This is the strongbox spine (carry / drop / extract) generalised to N loads.
function stepLoads(world: World) {
  const ext = world.raid.extraction;
  for (let i = world.raid.loads.length - 1; i >= 0; i--) {
    const load = world.raid.loads[i];
    const carrier = load.carrierId != null ? world.units.find((u) => u.id === load.carrierId) : undefined;
    if (carrier && carrier.state !== "down" && carrier.state !== "routing") {
      load.x = carrier.x;
      load.y = carrier.y;
      if (ext && carrier.y >= ext.y) {
        if (load.prisoner) {
          world.raid.prisoners.push({ join: load.join ?? 0 });
          signal(world, "A prisoner is brought aboard.");
        } else {
          world.raid.haul += load.value;
          signal(world, `Plunder aboard — +${load.value} (haul ${world.raid.haul}).`);
        }
        world.raid.loads.splice(i, 1);
      }
      continue;
    }
    if (load.carrierId != null) {
      load.carrierId = null;
      signal(world, "The plunder is dropped!");
    }
    for (const u of world.units) {
      if (u.side !== "player" || u.state === "down" || u.state === "routing") continue;
      if (world.raid.loads.some((l) => l.carrierId === u.id)) continue;
      if (dist(u.x, u.y, load.x, load.y) <= RAID.pickupRange) {
        load.carrierId = u.id;
        break;
      }
    }
  }
}

// Plain-language stage transitions — the alarm reads as a *cause*, never a countdown.
const ALARM_MSG: Record<number, string> = {
  1: "The watch spots you — the garrison rouses and sallies out!",
  2: "A bell begins to ring — the town is alarmed!",
  3: "The garrison turns out in force — a general muster!",
};

function alarmStage(heat: number): number {
  const A = RAID.alarm;
  if (heat >= A.muster) return 3;
  if (heat >= A.full) return 2;
  if (heat >= A.roused) return 1;
  return 0;
}

// The alarm only ever rises — the town doesn't calm mid-raid. Step up one stage at a
// time (so a big spike still fires each stage's message + wave), and muster a
// reinforcement wave from the gate at Alarm and General Muster.
function advanceAlarm(world: World) {
  const stage = alarmStage(world.raid.alarmHeat);
  while (world.raid.alarm < stage) {
    world.raid.alarm++;
    signal(world, ALARM_MSG[world.raid.alarm]);
    if (world.raid.alarm === 2) spawnReinforcementWave(world, RAID.reinforce.wave2);
    else if (world.raid.alarm === 3) spawnReinforcementWave(world, RAID.reinforce.wave3);
  }
}

function fighting(u: Unit): boolean {
  return u.state === "steady" || u.state === "wavering";
}

// A dug-in defender rouses once any raider closes within rouseRange of them.
function raidersSpotted(world: World): boolean {
  for (const e of world.units) {
    if (e.side !== "enemy" || e.state === "down") continue;
    for (const p of world.units) {
      if (p.side !== "player" || p.state === "down") continue;
      if (dist(e.x, e.y, p.x, p.y) <= RAID.rouseRange) return true;
    }
  }
  return false;
}

// Graded outcome — a haul-vs-cost ledger, not a prize flag. The raid ends when the band's
// will breaks (disaster) or the last of the living reach the boats (cast off & tally): what
// you carried off, weighed against what it cost.
function checkRaidOutcome(world: World) {
  if (world.over) return;
  const ext = world.raid.extraction;
  const living = world.units.filter((u) => u.side === "player" && u.state !== "down");
  const atBoats = (u: Unit) => !!ext && u.state !== "routing" && u.y >= ext.y;

  let pFight = 0;
  for (const u of living) if (fighting(u) && !atBoats(u)) pFight++;
  const pDown = world.units.filter((u) => u.side === "player" && u.state === "down").length;
  const officersLost = world.units.filter((u) => u.side === "player" && u.kind === "officer" && u.state === "down").length;
  const total = world.units.filter((u) => u.side === "player").length;

  // the whole living band has reached the boats → cast off & tally
  if (living.length > 0 && living.every(atBoats)) {
    let grade: RaidResult;
    let msg: string;
    if (world.raid.haul <= 0) {
      grade = "failed";
      msg = "You pull back to the boats empty-handed — your people live to raid again.";
    } else if (officersLost > 0 || pDown > total * 0.34) {
      grade = "pyrrhic";
      msg = "The plunder's aboard, but you left men in the streets — a bloody morning's work.";
    } else {
      grade = "clean";
      msg = "The plunder's away and the band is clear — a clean raid.";
    }
    endRaid(world, grade, msg, pDown, officersLost);
    return;
  }

  // no one left willing to fight (and not a clean withdrawal) → the band broke
  if (pFight === 0) {
    endRaid(world, "disaster", "Your band breaks and scatters — the raid fails.", pDown, officersLost);
  }
}

function endRaid(world: World, result: RaidResult, message: string, pDown: number, officersLost: number) {
  world.over = true;
  world.raid.result = result;
  // resolve prisoners at battle's end: each rolls its join disposition (gaol captives are
  // eager, townsfolk seldom); the rest are ransomed. None join mid-fight. The ransom-vs-
  // release mercy choice is a strategic-layer decision — stubbed to ransom for now.
  let joined = 0;
  for (const p of world.raid.prisoners) if (nextFloat(world.rng) < p.join) joined++;
  world.raid.joined = joined;
  world.raid.ransomed = world.raid.prisoners.length - joined;
  const off = officersLost > 0 ? ` (incl. ${officersLost} officer${officersLost > 1 ? "s" : ""})` : "";
  let msg = `${message} Haul ${world.raid.haul}, ${pDown} lost${off}.`;
  if (world.raid.prisoners.length > 0) msg += ` Prisoners: ${joined} joined, ${world.raid.ransomed} for ransom.`;
  world.outcome = msg;
  signal(world, msg);
}
