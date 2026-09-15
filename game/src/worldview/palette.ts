// The world chart's ink — a colour table, in data.
//
// [HC-90] Every system's DEFINITIONS live in a data table; only its BEHAVIOUR
//         lives in code. A palette is definitions all the way down.
//
// WHY A TABLE AND NOT A STYLESHEET, which is the one thing about this file worth
// reading twice. The town harness draws with SVG strings and carries its palette
// in CSS classes, and that is the right answer for a page that re-renders when
// you press a button. This view runs continuously: `innerHTML` re-parsing a
// document sixty times a second is not a rendering strategy, so the world map is
// an HTML canvas — which is also what `solution-architecture.md` already says
// `game/` is. A canvas has no classes to hang colour off. So the colours come
// here instead, and the house's programmer art is matched rather than reinvented:
// every value below is either lifted straight out of `town.html` or mixed to sit
// beside one.
//
// The town's own ink, for reference — this file's parent palette:
//   #14120e page · #e8e0d0 text · #8c8272 dim · #c9a227 accent · #3a3226 border
//   #2b2519 ground · #16344a water · #a2603f ruin · #8b8271 idle

import { FACTION_IDS, type FactionId } from "../overworld/factions";

// ---- The page and the sea --------------------------------------------------

// ONLY WHAT THE CANVAS DRAWS WITH. The page's own chrome — panels, borders,
// inputs, the feed — is CSS in `world.html` and is deliberately not duplicated
// here: two tables holding the same colour is [P-47] waiting for one of them to
// be retuned on its own.
export const INK = {
  page: "#14120e",
  text: "#e8e0d0",
  dim: "#8c8272",
  accent: "#c9a227",

  // The chart itself. Sea is the town plan's water, darkened a shade so a dot
  // on it reads; land is the town plan's ground, verbatim.
  sea: "#122b3c",
  land: "#2b2519",
  coast: "#6a5c44",
  // A place's mark is outlined in the page colour so two overlapping ports stay
  // two ports.
  halo: "#14120e",
  select: "#e8e0d0",
} as const;

// ---- Who holds it ----------------------------------------------------------
//
// Eight hues, five crowns and three neutrals, and the split is visible before
// the names are: the crowns are saturated and the neutrals are muted, because
// [HC-51] makes "answers to nobody" the most consequential fact about a place
// after who does. Keyed off `FACTION_IDS` so a faction added to the table
// without a colour fails the type check rather than drawing in black.
export const FACTION_INK: Record<FactionId, string> = {
  spain: "#b5453a",
  england: "#c9a227",
  france: "#6d86c4",
  netherlands: "#d9822b",
  portugal: "#4e9e8f",
  brethren: "#9c6ab5",
  order: "#dcd3bb",
  maroons: "#8fae55",
};

export const factionInk = (nation: number): string => FACTION_INK[FACTION_IDS[nation]];

// ---- What the sky is doing -------------------------------------------------
//
// One entry per band of §7.4, in the table's own order, so `bandAt()`'s index
// indexes this directly. Fair is deliberately absent as a colour — an ordinary
// day draws no ring at all, which is what makes the other three worth looking at.
export const BAND_INK = ["", "#6f93a6", "#d6b25a", "#e0663c"] as const;

// The storm itself, which is drawn as weather over the sea rather than as an
// object on it: a cold wash with a brighter core, and an EDGE.
//
// The first pass had the wash at a tenth of an alpha and it was invisible
// against the climate tint — which mattered, because "storms crawling across
// them" is a third of the ratified one-line picture of success, and a storm
// nobody can see is a system that may as well not be running. The footprint now
// carries a faint stroke as well as a fill: the fall-off is smooth by design
// ([HC-32]), so without a line there is no edge for an eye to catch on.
export const STORM_INK = {
  rim: "rgba(150, 196, 222, 0.16)",
  rimEdge: "rgba(180, 214, 234, 0.35)",
  core: "rgba(206, 228, 240, 0.22)",
  eye: "#e8f2f8",
  track: "rgba(232, 242, 248, 0.7)",
} as const;

// A scar — the rarer moment a place actually lost something, as opposed to
// merely feeling weather. Both are the town harness's own ink for the same two
// states of a work.
export const HURT_INK = {
  grade: "#8b8271", // a work dropped a rung
  work: "#a2603f", // a work taken outright
} as const;

// The four war-currencies at sea. Nothing sends one yet (KAN-101), so this is
// drawn against a day that has not come — see `draw.ts`.
export const DISPATCH_INK = {
  wake: "rgba(232, 224, 208, 0.25)",
  hull: "#e8e0d0",
} as const;

// ---- The trend line --------------------------------------------------------

export const TREND_INK = {
  grid: "#2a251c",
  people: "#c9a227",
  coin: "#4e9e8f",
} as const;

// ---- The climate wash ------------------------------------------------------
//
// A BACKGROUND TINT AND NOTHING MORE. Zone boundaries are deliberately not drawn
// as lines: a boundary would be a second bake — contouring a Voronoi diagram —
// for a fact the wash already carries, and §6 only ever asked for climate to be
// visible, not delimited. The wash is baked once into a small offscreen image
// and blitted (see `draw.ts`), so a zone costs one `drawImage` a frame.
//
// Keyed by climate name rather than by id because the id is not exported as a
// list; the lookup falls back to a neutral wash, which is the right failure for
// a decoration.
export const CLIMATE_WASH: Record<string, string> = {
  "the Windward Coast": "#17394d",
  "the Leeward Sea": "#143446",
  "the Dry Cays": "#1c3b45",
  "the Hurricane Road": "#1a2f45",
  "the Main": "#123143",
  "the Northern Approaches": "#0f2a3c",
};

export const washFor = (climateName: string): string => CLIMATE_WASH[climateName] ?? INK.sea;
