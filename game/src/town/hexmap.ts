// The land map — the wants-list drawn on the ground.
//
// Nothing here is simulated. A region has NO OUTPUT; it has CAPACITY. What it
// contributes is exactly the sum of the works standing on it, read off the
// ledger. Any number computed here that is not that sum would be a second
// economy, which is forbidden.
//
// ONE LABEL PER REGION, NEVER PER HEX (spec §2.4, R4). A hex is a unit of area,
// not of announcement — that is the anti-quilt measure, and it is also why
// labels no longer bleed across hex boundaries.

import type { Town, Region, TerrainKind, Produce, Suit } from "./types";
import type { Axial } from "./hex";
import { toPixel, corners, key, centroid, bounds, sharedEdge, BEARING_ORDER, axialOf } from "./hex";
import { isDead, isWater, LABEL, SHORT, compass, describeLand, capacityOf, liveRegions } from "./land";
import { CATALOGUE, worksForRegion } from "./works";
import { describeFootprint, walledGround } from "./footprint";

const SIZE = 22;

const FILL: Record<TerrainKind, string> = {
  timberedHills: "#33502d",
  caneFlats: "#7d6b2b",
  tilledGround: "#6a6733",
  cottonGround: "#8a8158",
  rockyGround: "#5c554a",
  saltPans: "#8f8a76",
  bluff: "#4e4739",
  reef: "#245a63",
  roadstead: "#1e4666",
  marsh: "#39412f",
  scrub: "#4f4736",
  openSea: "#16344a",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hexPath = (c: { x: number; y: number }, size: number) =>
  corners(c, size).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

// The outline of a SET of hexes: every edge whose neighbour lies outside the set.
// This is what draws a region as one shape and the town as one silhouette rather
// than as a cluster of little hexagons.
function outline(cells: Axial[], size: number, inset = 0): string {
  const inSet = new Set(cells.map(key));
  const segs: string[] = [];
  for (const h of cells) {
    const c = toPixel(h, size);
    for (const b of BEARING_ORDER) {
      const n = { q: h.q + axialOf(b).q, r: h.r + axialOf(b).r };
      if (inSet.has(key(n))) continue;
      const [a, z] = sharedEdge(c, size - inset, b);
      segs.push(`M${a.x.toFixed(1)},${a.y.toFixed(1)}L${z.x.toFixed(1)},${z.y.toFixed(1)}`);
    }
  }
  return segs.join(" ");
}

// ---- What one region amounts to, as data -----------------------------------
// The load-bearing rule lives here: `earns` is summed from the works standing on
// this ground and computed nowhere else.

export interface RegionSummary {
  terrain: TerrainKind;
  dead: boolean;
  hexes: number;
  free: number;
  standing: string[];
  couldCarry: string[];
  bears: [Produce, Suit][];
  earns: { trade: number; food: number; defence: number };
  ruins: number;
  far: boolean;
}

export function regionSummary(town: Town, r: Region): RegionSummary {
  const idx = town.regions.indexOf(r);
  const here = town.works.filter((w) => w.region === idx);
  const live = here.filter((w) => w.condition === "working");
  const counts = new Map<string, number>();
  for (const w of here) counts.set(w.name, (counts.get(w.name) ?? 0) + 1);
  return {
    terrain: r.terrain,
    dead: isDead(r.terrain),
    hexes: r.hexes.length,
    free: capacityOf(town, r) - here.filter((w) => w.condition !== "ruin").length,
    standing: [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)),
    couldCarry: worksForRegion(town, r).map((k) => CATALOGUE[k].label),
    bears: Object.entries(r.bears) as [Produce, Suit][],
    earns: {
      trade: live.reduce((s, w) => s + w.trade, 0),
      food: live.reduce((s, w) => s + w.food, 0),
      defence: live.reduce((s, w) => s + w.defence, 0),
    },
    ruins: here.filter((w) => w.condition === "ruin").length,
    far: r.reach === "far",
  };
}

const SUIT_WORD: Record<Suit, string> = { ideal: "made for", fair: "takes, well enough,", poor: "grudges" };

// Grades and words on the face; numbers only here, and only with their sentence.
function hoverFor(town: Town, r: Region): string {
  const s = regionSummary(town, r);
  const lines = [
    `${LABEL[r.terrain]} to the ${compass(r.bearing)} — ${s.hexes} hex${s.hexes > 1 ? "es" : ""}${
      s.far ? ", out of the way of the town" : ""
    }.`,
  ];
  if (s.dead) {
    lines.push("Nothing will grow here, and nothing can be built on it.");
    if (r.terrain === "marsh") lines.push("Slow going for anyone coming that way.");
    return lines.join("\n");
  }
  if (s.bears.length) lines.push(s.bears.map(([p, g]) => `${SUIT_WORD[g]} ${p}`).join("; ") + ".");
  if (s.standing.length) {
    lines.push(s.standing.join(" · "));
    const e: string[] = [];
    if (s.earns.trade) e.push(`${Math.round(s.earns.trade)} coin a season`);
    if (s.earns.food) e.push(`feeds ${Math.round(s.earns.food)}`);
    if (s.earns.defence) e.push(`${Math.round(s.earns.defence)} toward the defence`);
    lines.push(e.length ? `Between them: ${e.join(", ")}.` : "Nothing is coming off it just now.");
  } else if (s.couldCarry.length) {
    lines.push(`It would carry ${s.couldCarry.join(" or ")}.`);
  }
  lines.push(s.free > 0 ? `Room here for ${s.free} more.` : "This ground is spoken for.");
  if (s.ruins) lines.push(`${s.ruins} burnt out.`);
  return lines.join("\n");
}

// ---- Drawing ---------------------------------------------------------------

function regionGroup(town: Town, r: Region): string {
  const at = toPixel(centroid(r.hexes), SIZE);
  const faces = r.hexes
    .map((h) => `<path d="${hexPath(toPixel(h, SIZE), SIZE)}" fill="${FILL[r.terrain]}" class="rg-face" />`)
    .join("");
  const sp = r.sweetSpot && !isDead(r.terrain) ? toPixel(r.sweetSpot, SIZE) : null;
  const sweet = sp ? `<circle class="rg-sweet" cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="2.6" />` : "";
  // Every work stands on its OWN hex — five mills in a line down the woodline,
  // never five piled on a point (fidelity contract 9).
  const idx = town.regions.indexOf(r);
  const marks = town.works
    .filter((w) => w.region === idx && w.hex)
    .map((w) => {
      const p = toPixel(w.hex!, SIZE);
      const cls = w.condition === "working" ? "wk" : w.condition === "ruin" ? "wk is-ruin" : "wk is-idle";
      return `<rect class="${cls}" x="${(p.x - 4).toFixed(1)}" y="${(p.y - 1.5).toFixed(1)}" width="8" height="5.5" />`;
    })
    .join("");
  const named = !isWater(r.terrain) || r.hexes.length > 2;
  return `<g class="rg ${isDead(r.terrain) ? "is-dead" : ""} ${isWater(r.terrain) ? "is-water" : ""}">
    <title>${esc(hoverFor(town, r))}</title>
    ${faces}
    <path d="${outline(r.hexes, SIZE)}" class="rg-edge" />
    ${sweet}${marks}
    ${named ? `<text class="rg-name" x="${at.x.toFixed(1)}" y="${(at.y + 3).toFixed(1)}">${esc(SHORT[r.terrain])}</text>` : ""}
  </g>`;
}

// The town, drawn as ONE CONTINUOUS SILHOUETTE — never a cluster of outlined
// hexagons, because no hex may ever be visible as a hex on the ground.
function townShape(town: Town): string {
  const claimed = town.footprint.claimed;
  const at = toPixel(centroid(claimed), SIZE);
  const faces = claimed.map((h) => `<path d="${hexPath(toPixel(h, SIZE), SIZE + 0.5)}" class="tw-fill" />`).join("");
  const walled = [...walledGround(town)].map((k) => {
    const [q, r] = k.split(",").map(Number);
    return { q, r };
  });
  const ruinedWall = town.works.some((w) => w.circuit && w.condition === "ruin");
  // Gaps in the trace are NORMAL — an unwalled edge is the way in.
  const wall = walled.length
    ? `<path d="${outline(walled, SIZE, 1.5)}" class="tw-wall ${ruinedWall ? "is-ruin" : ""}" />`
    : "";
  return `<g class="tw">
    <title>${esc(
      `${town.name} — ${Math.round(town.population)} souls.\n${describeFootprint(town)}\nThis is the ground you land on.`,
    )}</title>
    ${faces}
    <path d="${outline(claimed, SIZE)}" class="tw-edge" />
    ${wall}
    <text class="tw-name" x="${at.x.toFixed(1)}" y="${(at.y + 3).toFixed(1)}">${Math.round(town.population)}</text>
  </g>`;
}

export function renderHexMap(town: Town): string {
  const b = bounds([...town.land, ...town.water], SIZE);
  const water = town.regions.filter((r) => isWater(r.terrain));
  const land = town.regions.filter((r) => !isWater(r.terrain));
  return `<svg class="landmap" viewBox="${b.minX.toFixed(0)} ${b.minY.toFixed(0)} ${b.w.toFixed(0)} ${b.h.toFixed(0)}" role="img" aria-label="the land around ${esc(town.name)}">
    ${water.map((r) => regionGroup(town, r)).join("")}
    ${land.map((r) => regionGroup(town, r)).join("")}
    ${townShape(town)}
  </svg>`;
}

// The land in one line — the footprint, what the ground is for in proportions,
// and how you would come ashore.
export function landCaption(town: Town): string {
  const harbour = town.regions.filter((r) => r.terrain === "roadstead");
  const banks = town.regions.filter((r) => r.terrain === "reef");
  const approach = harbour.length
    ? `You would land at the anchorage to the ${harbour.map((r) => compass(r.bearing)).join(" or ")}.`
    : banks.length
      ? `No sheltered water; you would come in over the banks to the ${banks.map((r) => compass(r.bearing)).join(" and ")}.`
      : "There is no sheltered water here; a landing would be an open beach.";
  const marsh = town.regions.filter((r) => r.terrain === "marsh");
  const slow = marsh.length ? ` Slow going to the ${marsh.map((r) => compass(r.bearing)).join(" and ")}.` : "";
  return `${describeFootprint(town)} Set among ${describeLand(town)}. ${approach}${slow}`;
}

export const landRegions = (town: Town) => liveRegions(town);
