// The land map — the wants-list drawn on the ground.
//
// Nothing here is simulated. A hex has NO OUTPUT; it has CAPACITY. What a hex
// contributes is exactly the sum of the works standing on it, read straight off
// the ledger. Any number computed in this file that is not that sum would be a
// second economy, which is forbidden.
//
// Grades and words on the face; numbers only on hover, and only with their
// sentence (do-not-build: no numbers-only town screen).

import type { Town, Parcel, ParcelTerrain } from "./types";
import { CATALOGUE, worksForTerrain, roomFor } from "./works";
import { isDead, compass, describeParcel } from "./parcels";
import { axialOf, outerRing, toPixel, corners, CENTRE, isSeaward, sharedEdge, towardCentre, type Axial } from "./hex";
import { CORE_WORD, enclosedBearings, describeFootprint } from "./footprint";

// Smaller hexes, more of them — the same room on screen, visibly more country
// around the town (ratified 2026-09-08).
const SIZE = 26;

// Terrain colours. Muted, era-ish, and dead ground is visibly drained.
const FILL: Record<ParcelTerrain, string> = {
  timberedHills: "#35502f",
  caneFlats: "#7a6a2c",
  provisionGrounds: "#5f6330",
  reef: "#245a63",
  roadstead: "#1e4666",
  bluff: "#5f5647",
  marsh: "#39412f",
  scrub: "#4d4636",
  openSea: "#16344a",
};

// Short face labels — the map is read at a glance, not studied.
const FACE: Record<ParcelTerrain, string> = {
  timberedHills: "timber",
  caneFlats: "cane",
  provisionGrounds: "fields",
  reef: "banks",
  roadstead: "anchorage",
  bluff: "bluff",
  marsh: "marsh",
  scrub: "scrub",
  openSea: "open sea",
};

const GRADE = { poor: "·", fair: "··", rich: "···" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function hexPath(centre: { x: number; y: number }, size: number): string {
  return corners(centre, size).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
}

// "sawpits ×2" rather than two identical lines.
function tally(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
}

// What one hex amounts to, as plain data. THE LOAD-BEARING RULE LIVES HERE: the
// `earns` figures are summed from the works standing on this hex and computed
// nowhere else. A hex has no output of its own — it has capacity.
export interface HexSummary {
  terrain: ParcelTerrain;
  dead: boolean;
  worked: boolean;
  standing: string[]; // what is on it now, tallied
  couldCarry: string[]; // ...or what it would carry if nothing is
  earns: { trade: number; food: number; defence: number };
  ruins: number;
  room: boolean;
}

export function hexSummary(town: Town, index: number): HexSummary {
  const p = town.parcels[index];
  const here = town.works.filter((w) => w.parcel === index);
  const live = here.filter((w) => w.condition === "working");
  const dead = isDead(p.terrain);
  return {
    terrain: p.terrain,
    dead,
    worked: live.length > 0,
    standing: tally(here.map((w) => `${w.name} (${w.condition})`)),
    couldCarry: dead ? [] : worksForTerrain(p.terrain).map((k) => CATALOGUE[k].label),
    earns: {
      trade: live.reduce((s, w) => s + w.trade, 0),
      food: live.reduce((s, w) => s + w.food, 0),
      defence: live.reduce((s, w) => s + w.defence, 0),
    },
    ruins: here.filter((w) => w.condition === "ruin").length,
    room: !dead && worksForTerrain(p.terrain).some((k) => roomFor(town, k) > 0),
  };
}

// The hover text: the hex said as sentences, with its numbers attached to them.
function hoverFor(town: Town, p: Parcel, index: number): string {
  const s = hexSummary(town, index);
  const lines = [describeParcel(p)];

  if (s.dead) {
    lines.push("Nothing will grow here, and nothing can be built on it.");
    if (p.terrain === "marsh") lines.push("Slow going for anyone coming that way.");
    return lines.join("\n");
  }

  if (!s.standing.length) {
    lines.push(
      s.couldCarry.length ? `It would carry ${s.couldCarry.join(" or ")}.` : "Nothing in the catalogue wants this ground.",
    );
  } else {
    lines.push(s.standing.join(" · "));
    const earns: string[] = [];
    if (s.earns.trade) earns.push(`${Math.round(s.earns.trade)} coin a season`);
    if (s.earns.food) earns.push(`feeds ${Math.round(s.earns.food)}`);
    if (s.earns.defence) earns.push(`${Math.round(s.earns.defence)} toward the town's defence`);
    lines.push(earns.length ? `Between them: ${earns.join(", ")}.` : "Nothing is coming off it just now.");
  }
  lines.push(s.room ? "There is room here for more." : "This ground is spoken for.");
  return lines.join("\n");
}

function parcelHex(town: Town, p: Parcel, index: number): string {
  const c = toPixel(axialOf(p.bearing), SIZE);
  const here = town.works.filter((w) => w.parcel === index);
  const live = here.filter((w) => w.condition === "working");
  const ruins = here.filter((w) => w.condition === "ruin").length;
  const dead = isDead(p.terrain);
  const worked = live.length > 0;

  // Capacity is GHOSTED until something stands on it, then it goes solid. That
  // is what "a developed tile adds its bonus" means here.
  const body = dead
    ? `<text class="hx-dead" x="${c.x}" y="${c.y + 5}">—</text>`
    : worked
      ? `<text class="hx-work" x="${c.x}" y="${c.y + 5}">${esc(tally(live.map((w) => w.name)).join(" "))}</text>`
      : `<text class="hx-ghost" x="${c.x}" y="${c.y + 5}">${esc(
          worksForTerrain(p.terrain).map((k) => CATALOGUE[k].label)[0] ?? "—",
        )}</text>`;

  return `<g class="hx ${worked ? "is-worked" : ""} ${dead ? "is-dead" : ""}">
    <title>${esc(hoverFor(town, p, index))}</title>
    <path d="${hexPath(c, SIZE - 1.5)}" fill="${FILL[p.terrain]}" class="hx-face" />
    ${lobe(town, p, c)}
    <text class="hx-name" x="${c.x}" y="${c.y - 11}">${esc(FACE[p.terrain])}</text>
    ${dead ? "" : `<text class="hx-grade" x="${c.x}" y="${c.y - 1}">${GRADE[p.quality]}</text>`}
    ${body}
    ${ruins ? `<text class="hx-ruin" x="${c.x}" y="${c.y + 16}">burnt ×${ruins}</text>` : ""}
  </g>`;
}

// The town's built-up ground biting into the INNER EDGE of a hex. Never a
// sub-hex and never a hexagon: the hex is not divided, part of it is built over.
function lobe(town: Town, p: Parcel, c: { x: number; y: number }): string {
  const level = town.footprint.spill[p.bearing];
  if (!level) return "";
  // Taken entirely — the ground is the town now, and its works are gone with it.
  if (level >= 3) return `<path d="${hexPath(c, SIZE - 1.5)}" class="hx-absorbed" />`;
  const at = towardCentre(c, level === 1 ? 0.44 : 0.3);
  const r = (level === 1 ? 0.34 : 0.54) * SIZE;
  return `<circle class="hx-lobe" cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${r.toFixed(1)}" />`;
}

// The wall runs along the edges its circuit encloses. GAPS ARE NORMAL — an
// unenclosed bearing is the way in.
function wallTrace(town: Town): string {
  const c = toPixel(CENTRE, SIZE);
  const ruined = town.works.some((w) => w.circuit && w.condition === "ruin");
  return [...enclosedBearings(town)]
    .map((b) => {
      const [a, z] = sharedEdge(c, SIZE - 1.5, b);
      return `<line class="hx-wall${ruined ? " is-ruin" : ""}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${z.x.toFixed(1)}" y2="${z.y.toFixed(1)}" />`;
    })
    .join("");
}

function centreHex(town: Town): string {
  const c = toPixel(CENTRE, SIZE);
  const souls = Math.round(town.population);
  // Driven by the CORE GRADE, not population: how closely a town is built is what
  // the raid map's depth keys on (fidelity contract 4).
  const grade = town.footprint.core;
  return `<g class="hx hx-town">
    <title>${esc(
      `${town.name} — ${souls} souls, ${CORE_WORD[grade]}.` +
        `\n${describeFootprint(town)}` +
        `\nThe built-up town: this is the ground you land on.`,
    )}</title>
    <path d="${hexPath(c, SIZE - 1.5)}" fill="#2b2519" class="hx-face" />
    <path d="${hexPath(c, (SIZE - 4) * (0.4 + 0.14 * grade))}" fill="#4a4029" class="hx-core" />
    <text class="hx-name" x="${c.x}" y="${c.y - 8}">${esc(CORE_WORD[grade])}</text>
    <text class="hx-work" x="${c.x}" y="${c.y + 8}">${souls}</text>
  </g>`;
}

// The hinterland: drawn so the map reads as country — there is a lot of land —
// and carrying no data yet (roads, neighbours and annexation are the tail).
function hinterland(): string {
  return outerRing()
    .map((h: Axial) => {
      const c = toPixel(h, SIZE);
      const sea = isSeaward(h);
      return `<path d="${hexPath(c, SIZE - 1.5)}" class="hx-far" fill="${sea ? "#12283a" : "#23231b"}" />`;
    })
    .join("");
}

export function renderHexMap(town: Town): string {
  return `<svg class="landmap" viewBox="-160 -160 320 320" role="img" aria-label="the land around ${esc(town.name)}">
    ${hinterland()}
    ${centreHex(town)}
    ${town.parcels.map((p, i) => parcelHex(town, p, i)).join("")}
    ${wallTrace(town)}
  </svg>`;
}

// The land, said as one line — used above the map so the picture always has a
// sentence next to it.
export function landCaption(town: Town): string {
  const seaward = town.parcels.filter((p) => p.bearing === "S" || p.bearing === "SE" || p.bearing === "SW");
  const water = seaward.filter((p) => !isDead(p.terrain) && (p.terrain === "reef" || p.terrain === "roadstead"));
  const approach = water.length
    ? `You would land ${water.map((p) => `to the ${compass(p.bearing)}`).join(" or ")}.`
    : "There is no sheltered water here; a landing would be an open beach.";
  const marsh = town.parcels.filter((p) => p.terrain === "marsh");
  const slow = marsh.length ? ` Slow going ${marsh.map((p) => `to the ${compass(p.bearing)}`).join(" and ")}.` : "";
  return `${describeFootprint(town)} ${approach}${slow}`;
}
