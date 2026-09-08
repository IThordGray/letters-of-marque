// The ground plan — the ledger projected onto real earth.
//
// THE LEDGER IS THE SIMULATION; THIS IS THE PROJECTION. Nothing here decides
// anything: it reads the claimed hexes, the regions and the works, and lays out
// the streets and buildings they imply. Same seed, same town.
//
// THE HEX MAP IS A ZONING OVERVIEW, NOT A SCALE MAP. A hex is not a measured
// acreage; it says what that ground is for and roughly where it lies. So this
// file INTERPRETS the ledger rather than scaling it: the ledger says how much
// development stands on a piece of ground, and the plan decides what that looks
// like. One timber work is a sawpit; three in one region are a mill and its
// yards, not three identical sheds. A dwellings work is a row of huts.
//
// ROADS ARE LAID FIRST AND BUILDINGS HANG OFF THEM. That is what gives distinct
// streets rather than gaps left between blocks, and it is what stops the result
// reading as a grid.
//
// NO HEX IS EVER VISIBLE HERE. Hexes are units of land tenure; this is a place.

import type { Town, Work, Region } from "./types";
import type { Axial } from "./hex";
import { toPixel, key, centroid, neighbours } from "./hex";
import { makeRng, nextFloat, type Rng } from "../rng";
import { CATALOGUE, type Zone } from "./works";
import { isWater, isDead, LABEL } from "./land";
import { walledGround } from "./footprint";
import { PLAN_SPACE } from "./constants";

export interface Vec {
  x: number;
  y: number;
}
export interface Road {
  pts: Vec[];
  width: number;
  kind: "main" | "lane" | "track";
}
export interface PlanBuilding {
  label: string;
  zone: Zone | "dwelling";
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number; // radians — buildings front the street they stand on
  state: "working" | "idle" | "ruin";
}
export interface FieldPatch {
  label: string;
  at: Vec;
  r: number;
  terrain: string;
  ruin: boolean;
}
export interface Plan {
  view: { x: number; y: number; w: number; h: number };
  water: Vec[]; // the shoreline, as a filled polygon along the south
  roads: Road[];
  buildings: PlanBuilding[];
  fields: FieldPatch[];
  wall: Vec[][];
  plaza: Vec;
  quay: Vec;
}

const H = PLAN_SPACE.hexPaces;
const jitter = (rng: Rng, n: number) => (nextFloat(rng) - 0.5) * 2 * n;
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Vec) => Math.hypot(a.x, a.y) || 1;
const norm = (a: Vec): Vec => ({ x: a.x / len(a), y: a.y / len(a) });
const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const at = (h: Axial): Vec => toPixel(h, H);

// ---- The built-up ground ---------------------------------------------------

// A point is "in the town" if it lies within a hex the town has claimed. Tested
// against hex centres rather than a polygon: cheaper, and close enough.
const inTown = (town: Town, p: Vec) =>
  town.footprint.claimed.some((h) => dist(at(h), p) < H * PLAN_SPACE.hexFill);

// HOW CLOSE THE TOWN IS BUILT comes from the core grade, not from its area. A
// stone-built presidio on one hex is packed tight; a scattered hamlet on three
// is thin. This is what makes the footprint`s density mean something on the
// ground rather than only on the hex map.
const frontageFor = (town: Town) => PLAN_SPACE.frontageByCore[town.footprint.core];

// ---- Roads, laid first -----------------------------------------------------

// DOGLEGS, NEVER CURVES. One or two angular kinks buy most of the organic feel
// for a fraction of the cost — and unlike a smooth curve, a dogleg is tactically
// meaningful, because it breaks a firing lane down the street.
function wander(rng: Rng, a: Vec, b: Vec, kinks: number, drift: number): Vec[] {
  const side = perp(norm(sub(b, a)));
  const pts: Vec[] = [a];
  const n = Math.max(1, kinks - 1);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const mid = add(a, scale(sub(b, a), t));
    const bow = Math.sin(t * Math.PI); // no kink at the junctions themselves
    pts.push(add(mid, scale(side, jitter(rng, drift) * bow)));
  }
  pts.push(b);
  return pts;
}

function pointAlong(road: Vec[], t: number): { p: Vec; dir: Vec } {
  const total = road.slice(1).reduce((s, p, i) => s + dist(road[i], p), 0);
  let want = total * t;
  for (let i = 1; i < road.length; i++) {
    const seg = dist(road[i - 1], road[i]);
    if (want <= seg) {
      const d = norm(sub(road[i], road[i - 1]));
      return { p: add(road[i - 1], scale(d, want)), dir: d };
    }
    want -= seg;
  }
  const d = norm(sub(road[road.length - 1], road[road.length - 2]));
  return { p: road[road.length - 1], dir: d };
}

// ---- Building slots along a street -----------------------------------------

interface Slot {
  p: Vec;
  rot: number;
  toQuay: number;
  toPlaza: number;
  edge: number; // how far out of the middle of town it lies
}

// Walk a street and offer a frontage every so often on both sides, set back from
// the carriageway. This is what puts a road BETWEEN the buildings rather than
// leaving one by accident.
function slotsAlong(rng: Rng, road: Road, town: Town, plaza: Vec, quay: Vec): Slot[] {
  const out: Slot[] = [];
  const total = road.pts.slice(1).reduce((s, p, i) => s + dist(road.pts[i], p), 0);
  const step = frontageFor(town) + jitter(rng, 8);
  for (let d = step * 0.5; d < total - step * 0.3; d += step + jitter(rng, PLAN_SPACE.frontageJitter)) {
    const { p, dir } = pointAlong(road.pts, d / total);
    for (const side of [1, -1]) {
      if (nextFloat(rng) < PLAN_SPACE.gapChance) continue; // a yard, a gap, a burnt plot
      const off = road.width / 2 + PLAN_SPACE.setback + jitter(rng, 8);
      const q = add(p, scale(perp(dir), off * side));
      if (!inTown(town, q)) continue;
      if (dist(q, plaza) < plazaRadius(town)) continue; // nothing stands in the plaza
      out.push({
        p: q,
        rot: Math.atan2(dir.y, dir.x) + jitter(rng, PLAN_SPACE.rotJitter),
        toQuay: dist(q, quay),
        toPlaza: dist(q, plaza),
        edge: dist(q, plaza),
      });
    }
  }
  return out;
}

// The plaza is an authored void, sized by how closely the town is built. Nothing
// may stand in it: VOID IS WHAT READS AS OBJECTIVE, and it is why the
// hand-authored Laws-of-the-Indies plan reads at a glance.
export const plazaRadius = (town: Town) => PLAN_SPACE.plazaRadius[town.footprint.core];

// ---- Which building goes where ---------------------------------------------

// The ratified zone bands, expressed as a preference over slots.
function slotScore(zone: Zone, s: Slot, span: number): number {
  switch (zone) {
    case "waterfront":
      return -s.toQuay;
    case "plaza":
      return -s.toPlaza;
    case "lowerTown":
      return -Math.abs(s.toPlaza - span * 0.45);
    case "backTown":
      return s.toQuay;
    case "outworks":
      return s.edge;
    default:
      return -s.toPlaza;
  }
}

const FOOTPRINT_SIZE: Partial<Record<string, { w: number; h: number }>> = {
  church: { w: 190, h: 120 },
  customsHouse: { w: 150, h: 100 },
  warehouse: { w: 175, h: 105 },
  shipway: { w: 200, h: 110 },
  barracks: { w: 165, h: 100 },
  battery: { w: 140, h: 140 },
  tavern: { w: 120, h: 88 },
  market: { w: 150, h: 100 },
  chapel: { w: 105, h: 75 },
  well: { w: 50, h: 50 },
  dwellings: { w: 100, h: 78 },
};
const sizeOf = (kind: string) => FOOTPRINT_SIZE[kind] ?? { w: 120, h: 88 };

// ---- The projection --------------------------------------------------------

export function planTown(town: Town): Plan {
  const rng = makeRng(town.seed * 7919 + 13);
  const claimed = town.footprint.claimed;
  const centre = at(centroid(claimed));

  // The quay: the seaward edge of the built-up ground. The sea is south, so it
  // is the southernmost claimed hex, pushed to its shore.
  const southMost = claimed.reduce((a, b) => (at(b).y > at(a).y ? b : a));
  const quay: Vec = { x: at(southMost).x + jitter(rng, 40), y: at(southMost).y + H * 0.55 };
  // The plaza sits inland of the quay, off-centre so the town is never symmetric.
  const plaza: Vec = { x: centre.x + jitter(rng, 60), y: centre.y - H * 0.15 };

  // 1. THE SPINE — quay to plaza, doglegged. Never straight, never blocked.
  const wide = PLAN_SPACE.widthByCore[town.footprint.core];
  const main: Road = { pts: wander(rng, quay, plaza, 3, 90), width: wide * PLAN_SPACE.spineRank, kind: "main" };
  const roads: Road[] = [main];

  // 2. LANES radiating inland off the spine. A town on a single hex still needs
  //    streets, so these are struck by BEARING rather than per claimed hex.
  // Lanes must stay INSIDE the built-up ground, or their frontages are rejected
  // and the town comes out half-empty.
  const builtRadius = Math.max(...claimed.map((h) => dist(at(h), plaza))) + H * PLAN_SPACE.hexFill * 0.9;
  const lanes = PLAN_SPACE.lanesByCore[town.footprint.core] + claimed.length - 1;
  for (let i = 0; i < lanes; i++) {
    // Fan them across the landward half, never straight out of the plaza.
    const a = -Math.PI + (Math.PI * (i + 0.5)) / lanes + jitter(rng, 0.22);
    const from = pointAlong(main.pts, 0.2 + nextFloat(rng) * 0.75).p;
    const room = builtRadius - dist(from, plaza);
    const target = add(from, { x: Math.cos(a) * room, y: Math.sin(a) * room });
    roads.push({ pts: wander(rng, from, target, 2, 60), width: wide, kind: "lane" });
  }
  // A cross lane or two, so the plan is a network and not a comb.
  for (let i = 0; i < PLAN_SPACE.crossLanes && roads.length > 2; i++) {
    const a = roads[1 + Math.floor(nextFloat(rng) * (roads.length - 1))];
    const b = roads[1 + Math.floor(nextFloat(rng) * (roads.length - 1))];
    if (a === b) continue;
    roads.push({
      pts: wander(rng, pointAlong(a.pts, 0.55).p, pointAlong(b.pts, 0.6).p, 2, 45),
      width: wide * 0.8,
      kind: "track",
    });
  }
  // 3. A shore road along the water, which is what makes a waterfront read as one.
  const seaward = claimed.filter((h) => at(h).y >= centre.y - 1).map(at);
  if (seaward.length > 1) {
    const west = seaward.reduce((a, b) => (b.x < a.x ? b : a));
    const east = seaward.reduce((a, b) => (b.x > a.x ? b : a));
    roads.push({
      pts: wander(rng, { x: west.x - 60, y: west.y + H * 0.4 }, { x: east.x + 60, y: east.y + H * 0.4 }, 4, 45),
      width: wide,
      kind: "lane",
    });
  }

  // 4. FRONTAGES along every street, then hand them out.
  const span = Math.max(...claimed.map((h) => dist(at(h), plaza)), H);
  const slots = roads.flatMap((r) => slotsAlong(rng, r, town, plaza, quay));
  const taken = new Set<number>();
  const buildings: PlanBuilding[] = [];

  const place = (label: string, zone: Zone | "dwelling", kind: string, state: PlanBuilding["state"]) => {
    let best = -1;
    let bestScore = -Infinity;
    slots.forEach((s, i) => {
      if (taken.has(i)) return;
      // Nothing may stand within a building's width of another.
      const sz = sizeOf(kind);
      if (buildings.some((b) => dist(b, s.p) < (sz.w + b.w) * 0.42)) return;
      const sc = slotScore(zone === "dwelling" ? "lowerTown" : zone, s, span);
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    });
    if (best < 0) return false;
    taken.add(best);
    const s = slots[best];
    const sz = sizeOf(kind);
    buildings.push({ label, zone, x: s.p.x, y: s.p.y, w: sz.w, h: sz.h, rot: s.rot, state });
    return true;
  };

  // 5. EVERY WORK IS A BUILDING ON THE GROUND — the ratified requirement. Works
  //    that stand in the town take a frontage; works out on the land do not.
  const inTownWorks = town.works.filter((w) => CATALOGUE[w.kind].zone !== "beyondThePale");
  const order = ["plaza", "waterfront", "outworks", "backTown", "lowerTown"] as Zone[];
  for (const zone of order) {
    for (const w of inTownWorks.filter((x) => CATALOGUE[x.kind].zone === zone)) {
      place(w.name, zone, w.kind, w.condition === "working" ? "working" : w.condition === "ruin" ? "ruin" : "idle");
    }
  }
  // ...and the rest of the town is houses, as many as the frontages allow.
  // A `dwellings` work draws as a CLUSTER of huts sharing one ledger line —
  // ninety souls in two houses looks wrong, and the ledger should stay coarse.
  // This is the one sanctioned departure from one-work-one-building.
  const houses = town.works.filter((w) => w.kind === "dwellings").length;
  for (let i = 0; i < houses * PLAN_SPACE.hutsPerDwelling; i++) {
    if (!place("dwellings", "dwelling", "dwellings", "working")) break;
  }

  // 6. THE WORKS OUT ON THE LAND. A work stands on ITS OWN HEX, nudged toward the
  //    town — so five sawpits on a five-hex timber strip land five hex widths
  //    apart, strung along the spur that runs up the woodline. Contracts 1, 3 and
  //    9 all fall out of that one transform: no search, no packing.
  const fields: FieldPatch[] = [];
  const worked = new Set<number>();
  // Works of one kind on one region are ONE INSTALLATION, sized by how many
  // there are — not N identical sheds. The ledger says how much timber is worked
  // here; the plan says whether that reads as a sawpit or as a mill and its
  // yards. Its position is the centre of the ground it occupies.
  const groups = new Map<string, Work[]>();
  for (const w of town.works) {
    if (CATALOGUE[w.kind].zone !== "beyondThePale" || !w.hex || w.region === null) continue;
    worked.add(w.region);
    const g = w.region + ":" + w.kind;
    groups.set(g, [...(groups.get(g) ?? []), w]);
  }
  for (const [, ws] of groups) {
    const live = ws.filter((w) => w.condition !== "ruin");
    const hexes = ws.map((w) => at(w.hex!));
    const mid = {
      x: hexes.reduce((n, h) => n + h.x, 0) / hexes.length,
      y: hexes.reduce((n, h) => n + h.y, 0) / hexes.length,
    };
    const townward = scale(norm(sub(plaza, mid)), H * 0.14);
    const n = Math.max(1, live.length);
    fields.push({
      // "sawpits" already reads as a plural; the count says how much of it.
      label: n > 1 ? ws[0].name + " \u00d7" + n : ws[0].name,
      at: add(add(mid, townward), { x: jitter(rng, H * 0.07), y: jitter(rng, H * 0.07) }),
      // One work is a shed; several are a works. Area grows with the square root,
      // so a big installation reads as bigger without swallowing the map.
      r: H * 0.2 * Math.sqrt(n) * (live.length ? 1 : 0.7),
      terrain: town.regions[ws[0].region!]?.terrain ?? "scrub",
      ruin: live.length === 0,
    });
  }
  // A track out to each worked region — the road the timber comes down.
  for (const idx of worked) {
    const reg = town.regions[idx];
    if (!reg) continue;
    const ordered = [...reg.hexes].sort((a, b) => dist(at(a), plaza) - dist(at(b), plaza));
    roads.push({
      pts: [plaza, ...ordered.slice(0, 4).map((h) => add(at(h), { x: jitter(rng, 60), y: jitter(rng, 60) }))],
      width: wide * 0.55,
      kind: "track",
    });
  }

  // 7. THE WALL, along its frozen circuit — with the gaps it never closed.
  const walled = [...walledGround(town)].map((k) => {
    const [q, r] = k.split(",").map(Number);
    return { q, r };
  });
  const wall = wallSegments(rng, walled, claimed);

  // 8. The shore, and the view. The map covers the claimed ground and one ring —
  //    never the whole county, or a century-old port is an unplayable march.
  // The map covers the claimed ground and ONE RING of what adjoins it — never
  // the whole county, or a century-old port becomes an unplayable march.
  const near = new Map<string, Axial>();
  for (const h of claimed) {
    near.set(key(h), h);
    for (const n of neighbours(h)) near.set(key(n), n);
  }
  const pts = [...near.values()].map(at);
  const pad = H * 0.35;
  let minX = Math.min(...pts.map((p) => p.x)) - pad;
  let maxX = Math.max(...pts.map((p) => p.x)) + pad;
  let minY = Math.min(...pts.map((p) => p.y)) - pad;
  let maxY = Math.max(...pts.map((p) => p.y)) + pad;
  // ...and a hard cap on top, cropped toward the town. Past this, growth must
  // read as DENSITY rather than extent, or a century-old port becomes a march.
  const cap = PLAN_SPACE.maxExtent;
  if (maxX - minX > cap) {
    minX = Math.max(minX, centre.x - cap / 2);
    maxX = Math.min(maxX, centre.x + cap / 2);
  }
  if (maxY - minY > cap) {
    minY = Math.max(minY, plaza.y - cap * 0.42);
    maxY = Math.min(maxY, plaza.y + cap * 0.58); // more room seaward: that is the approach
  }
  const shoreY = quay.y + H * 0.28;
  const water: Vec[] = [
    { x: minX, y: maxY },
    { x: minX, y: shoreY + jitter(rng, 30) },
    ...wander(rng, { x: minX, y: shoreY }, { x: maxX, y: shoreY }, 5, 55).slice(1, -1),
    { x: maxX, y: shoreY + jitter(rng, 30) },
    { x: maxX, y: maxY },
  ];

  return {
    view: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    water,
    roads,
    buildings,
    fields,
    wall,
    plaza,
    quay,
  };
}

// The wall runs along the outer edge of the ground it enclosed — and stops where
// the circuit never reached. A gap is not a bug; it is the way in.
function wallSegments(rng: Rng, walled: Axial[], claimed: Axial[]): Vec[][] {
  if (!walled.length) return [];
  const inSet = new Set(walled.map(key));
  void claimed;
  const segs: Vec[][] = [];
  for (const h of walled) {
    const c = at(h);
    for (const d of [
      { q: 0, r: -1 },
      { q: 1, r: -1 },
      { q: -1, r: 0 },
    ]) {
      const n = { q: h.q + d.q, r: h.r + d.r };
      if (inSet.has(key(n))) continue;
      const mid = add(c, scale(sub(at(n), c), 0.5));
      const side = perp(norm(sub(at(n), c)));
      segs.push([add(mid, scale(side, H * 0.42)), add(mid, scale(side, -H * 0.42))].map((p) => add(p, { x: jitter(rng, 12), y: jitter(rng, 12) })));
    }
  }
  return segs;
}

export const describePlan = (town: Town, plan: Plan) =>
  `${plan.buildings.length} buildings on ${plan.roads.length} streets, and ${plan.fields.length} works out on the land — ${
    town.regions.filter((r) => !isDead(r.terrain) && !isWater(r.terrain)).map((r) => LABEL[r.terrain])[0] ?? "bare ground"
  } beyond.`;

export type { Region, Work };
