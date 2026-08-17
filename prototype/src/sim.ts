import type { GameState, Ship, Group, Faction, Mood } from "./types";
import { SHIP_CLASS, SAIL, GUN, CAPTAIN, INTERP, GROUP, WORLD, WALL, WAKE, FLASH } from "./constants";
import {
  DEG,
  clamp,
  angleDiff,
  angleTo,
  dist,
  turnToward,
  normalizeAngle,
  randRange,
} from "./math";
import { stepWind, pointOfSailMultiplier, sailableHeading } from "./wind";
import { interp, signal } from "./instrumentation";
import { aggressionWord } from "./names";

// ---------------------------------------------------------------------------
// Small live-state helpers
// ---------------------------------------------------------------------------

function effMaxSpeed(s: Ship): number {
  const cls = SHIP_CLASS[s.cls];
  const rigFrac = s.maxRigging <= 0 ? 0 : clamp(s.rigging / s.maxRigging, 0, 1);
  return cls.maxSpeed * rigFrac;
}

function surnameOf(s: Ship): string {
  const parts = s.captain.name.split(" ");
  return parts[parts.length - 1];
}

function strength(s: Ship): number {
  return s.hull + s.rigging;
}

function liveOf(state: GameState, faction: Faction): Ship[] {
  const out: Ship[] = [];
  for (const s of state.ships.values()) if (s.faction === faction && !s.struck) out.push(s);
  return out;
}

function commanderOf(state: GameState, g: Group): Ship | undefined {
  const c = state.ships.get(g.commanderId);
  return c && !c.struck ? c : undefined;
}

// ---------------------------------------------------------------------------
// Interpretation (§14.1) — deterministic, trait-driven, sticky, narrated on
// transition. This is the mechanism the whole prototype exists to test: a group
// does what it is told, but individual captains, being who they are, may not.
// ---------------------------------------------------------------------------

function nearestEnemy(s: Ship, enemies: Ship[]): Ship | undefined {
  if (enemies.length === 0) return undefined;
  return enemies.reduce((a, b) => (dist(s.x, s.y, b.x, b.y) < dist(s.x, s.y, a.x, a.y) ? b : a));
}

// A beaten or fleeing enemy — the kind an aggressive captain can't resist.
function isQuarry(state: GameState, e: Ship): boolean {
  if (e.rigging <= e.maxRigging * INTERP.quarryRiggingFrac) return true;
  if (e.hull <= e.maxHull * INTERP.quarryHullFrac) return true;
  const eg = state.groups.find((gr) => gr.id === e.groupId);
  return !!eg && eg.stance === "breakoff";
}

function findQuarry(state: GameState, s: Ship, enemies: Ship[]): Ship | undefined {
  let best: Ship | undefined;
  let bestD = INTERP.chaseRange;
  for (const e of enemies) {
    const d = dist(s.x, s.y, e.x, e.y);
    if (d <= bestD && isQuarry(state, e)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

// Decide a captain's mood this step from fixed temperament + situation + order.
// Pure of randomness → stable. Only transitions are narrated.
function refreshMood(state: GameState, s: Ship, g: Group, cmd: Ship | undefined, enemies: Ship[]) {
  const prev = s.mood;
  const isCommander = cmd != null && s.id === cmd.id;
  let next: Mood = "obey";
  let chaseId: number | null = null;

  if (INTERP.enabled && enemies.length > 0) {
    const c = s.captain;
    const hullPct = (s.hull / s.maxHull) * 100;
    const strikePct = CAPTAIN.strikeBasePct - c.nerve / CAPTAIN.strikeNerveDivisor;
    const flinchPct = INTERP.flinchBasePct - c.nerve / INTERP.flinchNerveDivisor;

    // 1) Nerve failure — my own ship is being wrecked and I haven't the stomach
    //    (a stout captain's flinch point sits at his strike point, so he never does).
    if (hullPct <= flinchPct && hullPct > strikePct + 1) {
      next = "unnerved";
    }
    // 2) Chase — an aggressive subordinate runs down a beaten/fleeing enemy.
    else if (!isCommander && c.aggression > INTERP.chaseAggression) {
      if (prev === "chase" && s.chaseTargetId != null) {
        const t = state.ships.get(s.chaseTargetId); // hold the existing chase (hysteresis)
        if (t && !t.struck && dist(s.x, s.y, t.x, t.y) <= INTERP.chaseDropRange) {
          next = "chase";
          chaseId = t.id;
        }
      }
      if (next !== "chase") {
        const q = findQuarry(state, s, enemies);
        if (q) {
          next = "chase";
          chaseId = q.id;
        }
      }
    }
    // 3) Defiance — a wilful captain won't obey an order that cuts against him.
    else if (c.obedience < INTERP.defyObedience) {
      const near = nearestEnemy(s, enemies)!;
      const d = dist(s.x, s.y, near.x, near.y);
      if (g.stance === "breakoff" && c.aggression > INTERP.refuseRecallAggression) {
        const gate = prev === "refuse-recall" ? INTERP.engageDropNear : INTERP.engageNear;
        if (d <= gate) next = "refuse-recall"; // won't quit a fight within reach
      } else if (g.stance === "engage" && c.aggression < INTERP.shyAggression) {
        next = "shy"; // ordered to close, but hangs back
      }
    }
  }

  s.chaseTargetId = chaseId;
  if (next !== prev) {
    s.mood = next;
    narrateMood(state, s, prev, next, chaseId);
  }
}

function narrateMood(state: GameState, s: Ship, prev: Mood, next: Mood, chaseId: number | null) {
  const t = state.time;
  const name = s.shipName;
  const cap = surnameOf(s);
  switch (next) {
    case "chase": {
      const q = chaseId != null ? state.ships.get(chaseId) : undefined;
      const trait = aggressionWord(s.captain.aggression).toLowerCase();
      interp(t, "defection", `The ${trait} ${cap} hauls ${name} out of the line to run down ${q ? q.shipName : "the runner"}.`);
      break;
    }
    case "refuse-recall":
      interp(t, "disobey", `${cap} ignores the recall — ${name} will not quit the fight.`);
      break;
    case "shy":
      interp(t, "disobey", `${name} hangs back — ${cap} will not close as ordered.`);
      break;
    case "unnerved":
      interp(t, "unnerved", `${cap}'s nerve fails — ${name} sheers out of the action.`);
      break;
    case "obey":
      if (prev === "chase") interp(t, "rejoin", `${name} gives up the chase and works back to the squadron.`);
      else if (prev === "refuse-recall") interp(t, "comply-return", `${name} finally answers the recall.`);
      else if (prev === "shy") interp(t, "comply-return", `${name} closes up into the action.`);
      else if (prev === "unnerved") interp(t, "comply-return", `${name} steadies and returns to her station.`);
      break;
  }
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

function navTarget(from: Ship, g: Group, enemies: Ship[]): Ship | undefined {
  if (enemies.length === 0) return undefined;
  if (g.targetMode === "named" && g.namedTargetId != null) {
    const t = enemies.find((e) => e.id === g.namedTargetId);
    return t; // may be undefined if that ship has struck — captain then holds
  }
  if (g.targetMode === "weakest") {
    return enemies.reduce((a, b) => (strength(b) < strength(a) ? b : a));
  }
  // nearest (also the fallback for "hold" — it still positions, just won't fire)
  return enemies.reduce((a, b) =>
    dist(from.x, from.y, b.x, b.y) < dist(from.x, from.y, a.x, a.y) ? b : a,
  );
}

// ---------------------------------------------------------------------------
// Steering primitives
// ---------------------------------------------------------------------------

// Close to / hold at / open from a target, presenting a broadside when in band.
function combatSteer(s: Ship, tx: number, ty: number, range: number): number {
  const d = dist(s.x, s.y, tx, ty);
  const bearing = angleTo(s.x, s.y, tx, ty);
  if (d > range * 1.2) return bearing; // close the distance
  if (d < range * 0.8) return normalizeAngle(bearing + 180); // too close — open up
  // In the band: steer tangentially so the target sits abeam and guns bear.
  const t1 = normalizeAngle(bearing + 90);
  const t2 = normalizeAngle(bearing - 90);
  return Math.abs(angleDiff(s.heading, t1)) <= Math.abs(angleDiff(s.heading, t2)) ? t1 : t2;
}

function fleeHeading(s: Ship, enemies: Ship[], w: GameState["wind"]): number {
  if (enemies.length === 0) return s.heading;
  const near = enemies.reduce((a, b) =>
    dist(s.x, s.y, b.x, b.y) < dist(s.x, s.y, a.x, a.y) ? b : a,
  );
  const away = angleTo(near.x, near.y, s.x, s.y); // directly away from the nearest threat
  // Run on the heading that opens the range FASTEST: within a wide cone of
  // "away", maximise (point-of-sail speed × how much it still opens the gap).
  let best = away;
  let bestScore = -Infinity;
  for (let d = -70; d <= 70; d += 10) {
    const h = away + d;
    const score = pointOfSailMultiplier(h, w) * Math.cos(d * DEG);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return normalizeAngle(best);
}

function slotPosition(g: Group, cmd: Ship, idx: number): { x: number; y: number } {
  if (g.formation === "line-abreast") {
    const side = idx % 2 === 0 ? 1 : -1;
    const rank = Math.floor(idx / 2) + 1;
    const perp = (cmd.heading + 90 * side) * DEG;
    const d = GROUP.formationSpacing * rank;
    return { x: cmd.x + Math.cos(perp) * d, y: cmd.y + Math.sin(perp) * d };
  }
  // line-ahead (default): trail directly astern of the commander
  const back = (cmd.heading + 180) * DEG;
  const d = GROUP.formationSpacing * (idx + 1);
  return { x: cmd.x + Math.cos(back) * d, y: cmd.y + Math.sin(back) * d };
}

function orderedRangeFor(g: Group): number {
  return g.stance === "engage" ? GROUP.engageRange : GROUP.standoffRange;
}

// ---------------------------------------------------------------------------
// Intent — where a single ship wants to point and how fast, this step
// ---------------------------------------------------------------------------

interface Intent {
  heading: number;
  throttle: number;
  speedCap: number;
}

function computeIntent(
  state: GameState,
  g: Group,
  s: Ship,
  cmd: Ship | undefined,
  enemies: Ship[],
  slowestCap: number,
): Intent {
  const isCommander = cmd != null && s.id === cmd.id;
  const own = Infinity; // a ship acting on its own initiative runs at its own speed

  // --- individual interpretation overrides the group order (§14.1) ---------
  switch (s.mood) {
    case "unnerved":
      return { heading: fleeHeading(s, enemies, state.wind), throttle: 1, speedCap: own };
    case "chase": {
      const t = s.chaseTargetId != null ? state.ships.get(s.chaseTargetId) : undefined;
      if (t && !t.struck) return { heading: combatSteer(s, t.x, t.y, GROUP.engageRange), throttle: 1, speedCap: own };
      break;
    }
    case "refuse-recall": {
      const t = nearestEnemy(s, enemies);
      if (t) return { heading: combatSteer(s, t.x, t.y, GROUP.engageRange), throttle: 1, speedCap: own };
      break;
    }
    case "shy": {
      const t = nearestEnemy(s, enemies);
      if (t) return { heading: combatSteer(s, t.x, t.y, GROUP.standoffRange), throttle: 1, speedCap: slowestCap };
      break;
    }
  }

  // --- structural loose: cohesion lost / loose formation / chase / no commander
  const loose = g.cohesion === "loose" || g.formation === "loose" || g.generalChase || cmd == null;
  if (loose) {
    const cap = g.generalChase ? Infinity : slowestCap; // General Chase releases the speed bound
    const tgt = enemies.length ? navTarget(s, g, enemies) : undefined;
    if (tgt) return { heading: combatSteer(s, tgt.x, tgt.y, orderedRangeFor(g)), throttle: 1, speedCap: cap };
    if (g.moveTarget) return { heading: angleTo(s.x, s.y, g.moveTarget.x, g.moveTarget.y), throttle: 1, speedCap: cap };
    return { heading: s.heading, throttle: 1, speedCap: cap };
  }

  // --- obeying, in formation -----------------------------------------------
  if (isCommander) {
    if (g.stance === "breakoff") {
      return { heading: fleeHeading(s, enemies, state.wind), throttle: 1, speedCap: slowestCap };
    }
    if (g.moveTarget) {
      if (dist(s.x, s.y, g.moveTarget.x, g.moveTarget.y) < 40) g.moveTarget = null;
      else return { heading: angleTo(s.x, s.y, g.moveTarget.x, g.moveTarget.y), throttle: 1, speedCap: slowestCap };
    }
    const tgt = navTarget(s, g, enemies);
    if (tgt) return { heading: combatSteer(s, tgt.x, tgt.y, orderedRangeFor(g)), throttle: 1, speedCap: slowestCap };
    return { heading: s.heading, throttle: 1, speedCap: slowestCap };
  }

  // Member holding station relative to the commander.
  const members = g.shipIds
    .map((id) => state.ships.get(id)!)
    .filter((m) => m && !m.struck && m.id !== cmd!.id);
  const idx = members.findIndex((m) => m.id === s.id);
  const slot = slotPosition(g, cmd!, idx < 0 ? 0 : idx);
  const d = dist(s.x, s.y, slot.x, slot.y);
  if (d > GROUP.slotArriveSlack) {
    return { heading: angleTo(s.x, s.y, slot.x, slot.y), throttle: 1, speedCap: slowestCap };
  }
  // In position: match the commander's heading and hold the group's pace.
  return { heading: cmd!.heading, throttle: 1, speedCap: slowestCap };
}

// ---------------------------------------------------------------------------
// Sailing physics — the careful bit (§5). Polar curve, steerage-scaled turn,
// tacking with a chance of irons, wearing that always succeeds.
// ---------------------------------------------------------------------------

function recordWake(s: Ship) {
  const w = s.wake;
  const last = w[w.length - 1];
  if (!last || dist(last.x, last.y, s.x, s.y) >= WAKE.minSegment) {
    w.push({ x: s.x, y: s.y });
    if (w.length > WAKE.maxPoints) w.shift();
  }
}

function integrate(s: Ship, dt: number) {
  s.x = clamp(s.x + Math.cos(s.heading * DEG) * s.speed * dt, 0, WORLD.width);
  s.y = clamp(s.y + Math.sin(s.heading * DEG) * s.speed * dt, 0, WORLD.height);
}

// Speed chases its point-of-sail target, then the ship moves. Shared tail.
function applySpeedAndMove(s: Ship, intent: Intent, maxEff: number, dt: number, w: GameState["wind"]) {
  const mult = pointOfSailMultiplier(s.heading, w);
  const target = Math.min(maxEff * mult * intent.throttle, intent.speedCap);
  if (s.speed < target) s.speed = Math.min(target, s.speed + SAIL.accel * dt);
  else s.speed = Math.max(target, s.speed - SAIL.accel * dt);
  integrate(s, dt);
  recordWake(s);
}

// Blend a "push away from the edges" component into a desired heading so ships
// turn along the boundary instead of grinding into it (corners especially).
function avoidWalls(x: number, y: number, heading: number): number {
  const m = WALL.margin;
  let ax = 0;
  let ay = 0;
  if (x < m) ax += (m - x) / m; // near left edge → push right
  if (WORLD.width - x < m) ax -= (m - (WORLD.width - x)) / m; // near right → push left
  if (y < m) ay += (m - y) / m; // near top → push down
  if (WORLD.height - y < m) ay -= (m - (WORLD.height - y)) / m; // near bottom → push up
  if (ax === 0 && ay === 0) return heading;
  const dx = Math.cos(heading * DEG) + ax * WALL.strength;
  const dy = Math.sin(heading * DEG) + ay * WALL.strength;
  return Math.atan2(dy, dx) / DEG;
}

// Does the shortest turn from `heading` to `goal` sweep through the wind's eye?
function arcContainsEye(heading: number, goal: number, eye: number): boolean {
  const total = angleDiff(heading, goal); // signed shortest turn, (-180, 180]
  const toEye = angleDiff(heading, eye);
  if (Math.abs(toEye) < 0.5 || Math.abs(total - toEye) < 0.5) return true;
  return total >= 0 ? toEye > 0 && toEye < total : toEye < 0 && toEye > total;
}

function applySailing(state: GameState, s: Ship, intent: Intent, dt: number) {
  const cls = SHIP_CLASS[s.cls];
  const rigFrac = s.maxRigging <= 0 ? 0 : clamp(s.rigging / s.maxRigging, 0, 1);
  const maxEff = cls.maxSpeed * rigFrac;
  const fullTurn = cls.baseTurn * rigFrac; // turn rate while carrying way through a tack

  // --- caught in irons: stuck head-to-wind, no steering, speed bleeds off ---
  if (s.inIrons > 0) {
    s.inIrons -= dt;
    s.speed = Math.max(0, s.speed - SAIL.ironsDecay * dt);
    if (s.inIrons <= 0) {
      // Fall off onto a tack — bear away to ~60° off the wind on a chosen side.
      s.heading = normalizeAngle(state.wind.from + s.ironsFalloff * (SAIL.noGoHalfAngle + 15));
      signal(state.time, `${s.shipName} pays off and fills her sails again.`);
    }
    integrate(s, dt);
    recordWake(s);
    return;
  }

  // --- mid-tack: swing through the eye at full rate, carrying momentum ---
  if (s.tackTarget != null) {
    s.heading = turnToward(s.heading, s.tackTarget, fullTurn * dt);
    if (Math.abs(angleDiff(s.heading, s.tackTarget)) < 0.5) s.tackTarget = null;
    applySpeedAndMove(s, intent, maxEff, dt, state.wind);
    return;
  }

  // Steer clear of the arena edges, then resolve the no-go zone (beat if upwind).
  const steered = avoidWalls(s.x, s.y, intent.heading);
  const goal = sailableHeading(s.heading, steered, state.wind);

  // Reaching the goal means crossing the eye → a tack, which may miss stays.
  if (maxEff > 0 && arcContainsEye(s.heading, goal, state.wind.from)) {
    if (Math.random() < SAIL.tackIronsChance) {
      // Missed stays: caught in irons, stuck head-to-wind.
      s.inIrons = randRange(SAIL.ironsMin, SAIL.ironsMax);
      s.ironsFalloff = Math.random() < 0.5 ? 1 : -1;
      s.heading = state.wind.from;
      interp(state.time, "irons", `${s.shipName} misses stays and is caught in irons.`);
      integrate(s, dt);
      recordWake(s);
      return;
    }
    // Comes about cleanly — swing through under momentum over the next moment.
    s.tackTarget = goal;
    s.heading = turnToward(s.heading, goal, fullTurn * dt);
    if (Math.abs(angleDiff(s.heading, s.tackTarget)) < 0.5) s.tackTarget = null;
    applySpeedAndMove(s, intent, maxEff, dt, state.wind);
    return;
  }

  // Ordinary turn: steerage scales with speed (no steerage way when stopped).
  const steerage = maxEff > 0 ? clamp(s.speed / maxEff, 0, 1) : 0;
  s.heading = turnToward(s.heading, goal, fullTurn * steerage * dt);
  applySpeedAndMove(s, intent, maxEff, dt, state.wind);
}

// ---------------------------------------------------------------------------
// Gunnery (§7)
// ---------------------------------------------------------------------------

function bandHitChance(d: number): number {
  if (d > GUN.maxRange) return 0;
  for (const [lo, hi, chance] of GUN.bands) if (d >= lo && d < hi) return chance;
  return 0;
}

function isRake(firer: Ship, target: Ship): boolean {
  // Fire arriving within 30° of the target's bow OR stern axis rakes her.
  const incoming = angleTo(target.x, target.y, firer.x, firer.y);
  const bow = Math.abs(angleDiff(incoming, target.heading));
  const stern = Math.abs(angleDiff(incoming, target.heading + 180));
  return Math.min(bow, stern) <= GUN.rakeHalfAngle;
}

// Pick the best target within one battery's arc, honouring the Target channel.
function batteryTarget(firer: Ship, beam: number, g: Group, enemies: Ship[]): Ship | undefined {
  const inArc = enemies.filter((e) => {
    const d = dist(firer.x, firer.y, e.x, e.y);
    if (d > GUN.maxRange) return false;
    const bearing = angleTo(firer.x, firer.y, e.x, e.y);
    return Math.abs(angleDiff(bearing, beam)) <= GUN.arcHalfAngle;
  });
  if (inArc.length === 0) return undefined;
  if (g.targetMode === "named" && g.namedTargetId != null) {
    return inArc.find((e) => e.id === g.namedTargetId);
  }
  if (g.targetMode === "weakest") {
    return inArc.reduce((a, b) => (strength(b) < strength(a) ? b : a));
  }
  return inArc.reduce((a, b) =>
    dist(firer.x, firer.y, b.x, b.y) < dist(firer.x, firer.y, a.x, a.y) ? b : a,
  );
}

function fireBattery(state: GameState, firer: Ship, g: Group, target: Ship, sideLabel: string) {
  const d = dist(firer.x, firer.y, target.x, target.y);
  const chance = bandHitChance(d);
  const guns = SHIP_CLASS[firer.cls].gunsPerSide;
  let hits = 0;
  for (let i = 0; i < guns; i++) if (Math.random() < chance) hits++;

  const rake = isRake(firer, target);
  const per = (g.shot === "round" ? GUN.roundDamage : GUN.chainDamage) * (rake ? GUN.rakeMultiplier : 1);
  const dmg = hits * per;

  if (g.shot === "round") target.hull = Math.max(0, target.hull - dmg);
  else target.rigging = Math.max(0, target.rigging - dmg);

  state.flashes.push({ ax: firer.x, ay: firer.y, bx: target.x, by: target.y, rake, ttl: FLASH.ttl });

  if (rake && hits > 0) {
    const end = Math.abs(angleDiff(angleTo(target.x, target.y, firer.x, firer.y), target.heading)) <=
      GUN.rakeHalfAngle
        ? "bow"
        : "stern";
    interp(state.time, "rake", `${firer.shipName} rakes ${target.shipName} across the ${end} — ${hits} tell!`);
  } else if (hits > 0) {
    const what = g.shot === "round" ? "hull" : "rigging";
    signal(state.time, `${firer.shipName}'s ${sideLabel} battery hits ${target.shipName} (${hits} in the ${what}).`);
  }

  checkStrike(state, target);
}

function checkStrike(state: GameState, s: Ship) {
  if (s.struck) return;
  const hullPct = (s.hull / s.maxHull) * 100;
  const threshold = CAPTAIN.strikeBasePct - s.captain.nerve / CAPTAIN.strikeNerveDivisor;
  if (s.hull <= 0 || hullPct <= threshold) {
    s.struck = true;
    s.speed = 0;
    interp(state.time, "strike", `${surnameOf(s)} of ${s.shipName} strikes his colours.`);
  }
}

function stepGunnery(state: GameState, dt: number) {
  for (const s of state.ships.values()) {
    if (s.struck) continue;
    s.portReload = Math.max(0, s.portReload - dt);
    s.stbdReload = Math.max(0, s.stbdReload - dt);

    const g = state.groups.find((gr) => gr.id === s.groupId)!;
    if (g.targetMode === "hold") continue;

    const enemies = liveOf(state, s.faction === "player" ? "enemy" : "player");
    if (enemies.length === 0) continue;

    if (s.stbdReload <= 0) {
      const t = batteryTarget(s, s.heading + 90, g, enemies);
      if (t) {
        fireBattery(state, s, g, t, "starboard");
        s.stbdReload = GUN.reload;
      }
    }
    if (s.portReload <= 0) {
      const t = batteryTarget(s, s.heading - 90, g, enemies);
      if (t) {
        fireBattery(state, s, g, t, "port");
        s.portReload = GUN.reload;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cohesion + outcome
// ---------------------------------------------------------------------------

function updateCohesion(state: GameState, g: Group) {
  if (g.cohesion !== "formed") return;
  const cmd = commanderOf(state, g);
  const live = g.shipIds.map((id) => state.ships.get(id)).filter((s): s is Ship => !!s && !s.struck);
  if (!cmd || live.length < g.startingStrength * GROUP.cohesionStrengthFrac) {
    g.cohesion = "loose";
    if (g.faction === "player") {
      const why = !cmd ? "her commander struck" : "she is cut to pieces";
      interp(state.time, "cohesion-break", `${g.name} loses cohesion — ${why}. Ships act on their own.`);
    } else {
      interp(state.time, "cohesion-break", `${g.name} breaks up in disorder.`);
    }
  }
}

function checkOutcome(state: GameState) {
  const playerLeft = liveOf(state, "player").length;
  const enemyLeft = liveOf(state, "enemy").length;
  if (enemyLeft === 0 && playerLeft > 0) {
    state.over = true;
    state.outcome = "Victory — the enemy has struck.";
  } else if (playerLeft === 0) {
    state.over = true;
    state.outcome = enemyLeft === 0 ? "Mutual annihilation." : "Defeat — your squadrons have struck.";
  }
}

// ---------------------------------------------------------------------------
// One fixed simulation step
// ---------------------------------------------------------------------------

export function stepSim(state: GameState, dt: number) {
  if (state.over) return;

  stepWind(state.wind, dt);
  state.time += dt;

  for (let i = state.flashes.length - 1; i >= 0; i--) {
    state.flashes[i].ttl -= dt;
    if (state.flashes[i].ttl <= 0) state.flashes.splice(i, 1);
  }

  // Movement — resolve per group so we have the commander and speed cap to hand.
  for (const g of state.groups) {
    const gShips = g.shipIds.map((id) => state.ships.get(id)).filter((s): s is Ship => !!s && !s.struck);
    if (gShips.length === 0) continue;
    const cmd = commanderOf(state, g);
    const enemies = liveOf(state, g.faction === "player" ? "enemy" : "player");
    const slowestCap = gShips.reduce((m, s) => Math.min(m, effMaxSpeed(s)), Infinity);

    for (const s of gShips) {
      refreshMood(state, s, g, cmd, enemies);
      const intent = computeIntent(state, g, s, cmd, enemies, slowestCap);
      applySailing(state, s, intent, dt);
    }
  }

  // Gunnery uses the freshly-updated positions.
  stepGunnery(state, dt);

  for (const g of state.groups) updateCohesion(state, g);
  checkOutcome(state);
}

// ---------------------------------------------------------------------------
// Player actions invoked from input (kept here so all mutation lives together)
// ---------------------------------------------------------------------------

export function promoteCommander(state: GameState, g: Group): boolean {
  const live = g.shipIds.map((id) => state.ships.get(id)).filter((s): s is Ship => !!s && !s.struck);
  if (live.length === 0) return false;
  // Promote the toughest surviving ship (most hull) — a sensible default click.
  const next = live.reduce((a, b) => (b.hull > a.hull ? b : a));
  g.commanderId = next.id;
  g.cohesion = "formed";
  interp(state.time, "promote", `${surnameOf(next)} takes command of ${g.name} in ${next.shipName}.`);
  return true;
}
