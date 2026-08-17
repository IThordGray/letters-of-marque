import type { GameState, Ship, Group, Faction } from "./types";
import type { ShipClass } from "./constants";
import { SHIP_CLASS } from "./constants";
import { makeWind } from "./wind";
import { makeCaptain, makeSurnameDrawer, makeShipNameDrawer } from "./names";

let nextId = 1;

function makeShip(
  cls: ShipClass,
  faction: Faction,
  groupId: number,
  x: number,
  y: number,
  heading: number,
  shipName: string,
  drawSurname: () => string,
): Ship {
  const c = SHIP_CLASS[cls];
  return {
    id: nextId++,
    shipName,
    captain: makeCaptain(drawSurname),
    cls,
    faction,
    groupId,
    x,
    y,
    heading,
    speed: 0,
    maxHull: c.hull,
    maxRigging: c.rigging,
    hull: c.hull,
    rigging: c.rigging,
    portReload: 0,
    stbdReload: 0,
    inIrons: 0,
    ironsFalloff: 1,
    tackTarget: null,
    struck: false,
    mood: "obey",
    chaseTargetId: null,
    wake: [],
  };
}

// Group templates: [classes, x, y, heading]. Classes are mixed on purpose so
// every group has a slow ship and a fast one (non-negotiable #3).
export function makeInitialState(): GameState {
  const ships = new Map<number, Ship>();
  const groups: Group[] = [];
  const drawName = makeShipNameDrawer();
  const drawSurname = makeSurnameDrawer();

  function addGroup(
    id: number,
    faction: Faction,
    name: string,
    classes: ShipClass[],
    baseX: number,
    baseY: number,
    heading: number,
    extras: Partial<Group>,
  ) {
    const shipIds: number[] = [];
    classes.forEach((cls, i) => {
      // Stagger positions along a short line so they don't spawn overlapping.
      const s = makeShip(cls, faction, id, baseX + i * 55 * (faction === "player" ? -1 : 1), baseY + i * 55, heading, drawName(), drawSurname);
      ships.set(s.id, s);
      shipIds.push(s.id);
    });
    groups.push({
      id,
      faction,
      name,
      shipIds,
      commanderId: shipIds[0],
      startingStrength: shipIds.length,
      formation: "line-ahead",
      stance: "standoff",
      targetMode: "nearest",
      namedTargetId: null,
      shot: "round",
      generalChase: false,
      moveTarget: null,
      cohesion: "formed",
      ...extras,
    });
  }

  // Player: west side, heading south onto a beam reach so nobody starts in irons.
  addGroup(0, "player", "Alpha", ["frigate", "sloop"], 300, 320, 90, {});
  addGroup(1, "player", "Bravo", ["frigate", "sloop", "sloop"], 300, 640, 90, {});

  // Enemy: east side. "Line" holds and batters; "Chase" closes hard.
  addGroup(2, "enemy", "Rochefort Line", ["frigate", "frigate"], 1100, 340, 270, {
    aiKind: "line",
    stance: "standoff",
    formation: "line-ahead",
  });
  addGroup(3, "enemy", "Chasse-Marée", ["sloop", "sloop", "frigate"], 1100, 660, 270, {
    aiKind: "aggressive",
    stance: "engage",
    formation: "loose",
    generalChase: true,
  });

  return {
    ships,
    groups,
    wind: makeWind(),
    flashes: [],
    time: 0,
    over: false,
    outcome: "",
  };
}

export function getShip(state: GameState, id: number | null): Ship | undefined {
  return id == null ? undefined : state.ships.get(id);
}

export function groupShips(state: GameState, g: Group): Ship[] {
  const out: Ship[] = [];
  for (const id of g.shipIds) {
    const s = state.ships.get(id);
    if (s) out.push(s);
  }
  return out;
}

export function liveGroupShips(state: GameState, g: Group): Ship[] {
  return groupShips(state, g).filter((s) => !s.struck);
}
