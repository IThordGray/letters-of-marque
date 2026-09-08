// Entity data for the TOWN module — a settlement that grows, specialises and decays
// on its own. Plain data only; behaviour lives in pure systems (sim.ts), never on the
// struct. See docs/knowledge/spec/town-economy.md.
//
// The one rule everything follows: THE LEDGER IS THE SIMULATION, THE MAP IS A
// PROJECTION OF IT. A town is three stored numbers plus a list of named works.
// Buildings are not simulated — works are.

// How a town is funded, which decides its agenda and whether it has a floor to fall
// back on after a sacking. Fleshed out in KAN-72.
export type Archetype = "colony" | "royalOutpost" | "pirateHaven";

// Who pays. `owns: false` is the deliberate hook for funding a town you do NOT
// control — modelled now, no player-facing verb until it arrives via a governor
// conversation (ratified 2026-09-07).
export type PatronKind = "crown" | "company" | "player" | "none";
export interface Patron {
  kind: PatronKind;
  name: string;
  owns: boolean;
}

// ---- The land ring ---------------------------------------------------------
// EXACTLY SIX parcels around the town site, drawn as the inner ring of a hex
// flower (centre = the town itself, outer 12 = undrawn hinterland). One hex =
// one parcel, never subdivided — that is the anti-dilution rule.
export type ParcelTerrain =
  // productive land
  | "timberedHills"
  | "caneFlats"
  | "provisionGrounds"
  | "bluff"
  // productive water
  | "reef"
  | "roadstead"
  // DEAD GROUND — drawn, terrain-typed, yielding nothing. This is where the
  // variety went when the parcel count was fixed at six: a town with three dead
  // hexes has a VISIBLE ceiling ("poor ground on three sides") where a parcel
  // count was invisible. `marsh` pays twice — dead, and a defensive gift.
  | "marsh"
  | "scrub"
  | "openSea";
export type ParcelQuality = "poor" | "fair" | "rich";
// Six flat-top hex directions. Dropping E and W but KEEPING N and S is what
// preserves the ratified "the sea lies south" invariant — pointy-top hexes would
// have broken it.
export type Bearing = "N" | "NE" | "SE" | "S" | "SW" | "NW";

export interface Parcel {
  terrain: ParcelTerrain;
  quality: ParcelQuality;
  bearing: Bearing; // the load-bearing field: it turns an economic fact into a PLACE
}

// ---- The works ledger ------------------------------------------------------
// A work is a ledger line with a place attached: "a sawpit, above the creek,
// working since '54". Buildings are not simulated — works are.

// The five things a town's people want. Governor inputs only; NEVER a bar the
// player tends.
export type Need = "food" | "drink" | "shelter" | "worship" | "order";

// Subsistence works cost NO WEALTH and raise themselves — people build their own
// houses and grow their own food. This is the hamlet floor, and it is why a sacked
// town always crawls back. Capital works need money or a patron.
export type WorkClass = "subsistence" | "capital";

export type WorkKind =
  // subsistence / civic — these appear on their own as the town warrants
  | "dwellings"
  | "gardenPlots"
  | "fishingShacks"
  | "well"
  | "chapel"
  | "market"
  // capital — these are what the governor CHOOSES between
  | "sawpit"
  | "shipway"
  | "caneField"
  | "boilingHouse"
  | "provisionGround"
  | "warehouse"
  | "customsHouse"
  | "battery"
  | "palisade"
  | "barracks"
  | "tavern"
  | "church";

// The devolution ladder — decay comes in RECOVERABLE grades, never straight to
// death. A work with no hands or no supplier goes idle and can resume instantly;
// left that way it rots.
export type WorkCondition = "working" | "idle" | "decayed" | "ruin";

export interface Work {
  id: number;
  kind: WorkKind;
  name: string; // how it reads in a sentence — "the sawpits above the creek"
  parcel: number | null; // index into town.parcels, or null for a civic work
  since: number; // year it started working, for the chronicle
  condition: WorkCondition;
  idleSince: number | null; // season it stopped working, for the devolution ladder

  // What it contributes each season, already scaled by its parcel's quality.
  food: number; // mouths it can feed beyond its own hands
  trade: number; // coin of exportable value
  defence: number; // contribution to security
  hands: number; // population it needs to man
  serves: Need | null; // the want it answers
  servesFor: number; // ...for how many souls
}

// ---- The town --------------------------------------------------------------
export interface Town {
  id: number;
  name: string;
  seed: number; // fixes the founding roll and the map projection
  archetype: Archetype;
  patron: Patron;
  founded: number; // year

  season: number; // seasons elapsed since founding (4 per year)

  // The three stored variables. Everything else is DERIVED every tick so it can
  // never drift out of step with its own explanation.
  population: number; // souls — the hands that man works and the mouths that eat
  wealth: number; // coin on hand: what construction spends and what a raider steals
  prosperity: number; // 0..100 LAGGING condition — the slow verdict on the place

  parcels: Parcel[];
  works: Work[];
  governor: string; // who runs the place. KAN-73 gives him competence and temperament.

  grant: number; // standing coin per season from the patron (KAN-72 makes this archetypal)
  nextWorkId: number;

  // The season the town was last frightened — a raid, a bombardment. Feeds the
  // governor's FEAR term ("since the burning, the town wants guns"). KAN-74 sets it.
  lastThreat: number | null;
}

// ---- Derived, never stored -------------------------------------------------
// Recomputed from the ledger on demand. Storing these would let a number drift
// away from the sentence that explains it.
export interface Derived {
  food: number; // produced this season, including the subsistence floor
  mouths: number; // consumed this season
  surplus: number; // food - mouths
  trade: number; // exportable coin produced
  upkeep: number; // what the town costs itself to run
  yield: number; // trade + grant - upkeep: "how well the town is doing", as a FLOW
  security: number; // 0..100, from defensive works + patron
  hands: { needed: number; available: number }; // the labour ceiling
  tier: "outpost" | "town" | "capital"; // what a raider would face
  needs: Record<Need, number>; // 0..1 UNMET — a governor input, never a player gauge
}
