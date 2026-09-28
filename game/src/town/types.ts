import type { Axial } from "./hex";
import type { Commerce, MarketState } from "./trade";

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

// ---- The land --------------------------------------------------------------
// A town's ground is an IRREGULAR COAST of ~24 hexes, divided into a handful of
// contiguous REGIONS. The region is the unit; a hex is a unit of area, never of
// announcement. See docs/knowledge/spec/town-economy.md §2.
//
// Identity is PROPORTION, and proportion is zero-sum: a hex given to timber is a
// hex not given to cane. That is what stops "a town has access to several
// resources" becoming "access to all of them".

export type TerrainKind =
  // productive land
  | "timberedHills"
  | "caneFlats"
  | "tilledGround"
  | "cottonGround"
  | "rockyGround"
  | "saltPans"
  | "bluff"
  // productive water
  | "reef"
  | "roadstead"
  // DEAD GROUND — drawn and named, yielding nothing. It is the town's release
  // valve as well as its ceiling: a town sprawls over its scrub and keeps every
  // good acre. `marsh` pays twice — dead, and slow going for a raider.
  | "marsh"
  | "scrub"
  | "openSea";

// What comes off the ground. Suitability is keyed on PRODUCE, not on work kind,
// so adding a work needs no new column.
//
// PRODUCE IS WHAT GROWS; A GOOD IS WHAT SHIPS (`trade.ts`'s `GOODS`). The two
// vocabularies are nearly the same list and deliberately not one: `cane` was
// renamed `sugar` because the quay names the cargo rather than the plant, and
// `food` — a coast's fitness for provisions — ships as `grain`, because cassava
// and wheat are both bread at the waterside. Nothing here converts anything
// into anything: the mapping is a NAME, not a chain.
export type Produce =
  | "sugar" | "grain" | "cotton" | "food" | "timber" | "stone" | "salt" | "fish"
  | "tobacco" | "cacao";

// Terrain BIASES a crop; it does not determine it. Absent from `bears` = will not
// bear at all: "you cannot plant cotton on bedrock."
export type Suit = "ideal" | "fair" | "poor";

// Six flat-top hex directions. Kept as PROSE and a coarse index only — derived
// from a region's centroid. Discipline rule: never store a bearing as the spatial
// fact; axial is the truth (spec §2.10).
export type Bearing = "N" | "NE" | "SE" | "S" | "SW" | "NW";

// What a stretch of ground has been given over to — spec §2.12, `[HC-94]`–`[HC-96]`.
// `null` is the default and stays the majority: a focus is a decision a governor
// takes a handful of times in a town's whole life, not a setting every region
// carries an opinion about.
export type RegionFocus = "production" | "growth" | null;

export interface Region {
  id: number;
  terrain: TerrainKind;
  hexes: Axial[]; // contiguous. AREA IS CAPACITY.
  // What this ground will bear, and how well. Filled ONCE at founding by the
  // profile supplier — the seam a climate system later replaces (spec §2.5).
  bears: Partial<Record<Produce, Suit>>;
  sweetSpot: Axial | null; // the best of it, one grade better — why the boiling house stands there
  reach: "atHand" | "far"; // `far` if it does not touch the town: costlier to man, first to idle
  bearing: Bearing; // derived from the centroid — for prose and the placement skew

  // WHAT THIS GROUND IS FOR ([HC-95], spec §2.12). The one piece of new state the
  // region focus needs: everything else it reads is already here — `bears` is the
  // POTENTIAL and is ground, the works standing on `hexes` are the CLAIM and burn.
  //
  // `null` is the default and the majority. There are exactly two focuses because
  // there are exactly two things a population can do with a piece of ground: work
  // it, or live on it. Defence is not one — no land use makes a town safer; a
  // bluff's answer is a battery, which is a work on a hex ([HC-96]).
  //
  // A PRODUCTION focus is set once and never changed. A GROWTH focus may be
  // redirected while the region is still empty and locks the moment ground is
  // claimed under it — it inherits that permanence from claiming rather than
  // asserting its own ("there are houses on it now").
  focus: RegionFocus;
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

// [HC-91] A DEFINITION TABLE IS THE SOURCE OF TRUTH; ITS TYPESCRIPT TYPE IS
// GENERATED FROM IT, NEVER THE REVERSE.
//
// `WorkKind` was a hand-written union here until KAN-135, and `works.ts` typed
// its catalogue against it — the relationship the wrong way round. It is now
// `keyof typeof` the catalogue's own rows, DECLARED BESIDE THE TABLE IT NAMES,
// and re-exported here so that every `import type { WorkKind } from "./types"`
// in the module still reads exactly the same.
//
// IT CANNOT BE DECLARED HERE, and that is why the arrow points this way:
// `works.ts` imports this file, so writing `keyof typeof CATALOGUE` in it would
// close a cycle. A type-only re-export closes nothing — `verbatimModuleSyntax`
// erases `import type` and `export type` outright, so none of this survives
// into the bundle. `Commerce` and `MarketState` arrive from `trade.ts` the same
// way, for the same reason.
//
// What the union used to explain in comments lives beside the rows it explains:
// the six subsistence works that appear as the town warrants them, the five
// that are what a production focus on a stretch of ground IS (§2.12.12), and
// the eight the governor weighs against each other.
import type { WorkKind } from "./works";
export type { WorkKind };

// The devolution ladder — decay comes in RECOVERABLE grades, never straight to
// death, and THE GRADES DIFFER IN WHAT COMING BACK COSTS. A work with no hands or
// no supplier goes `idle` and resumes the season they return, free. Left that way
// it `decayed`s, and a decayed work comes back one rung for COIN — a governor's
// decision, priced at a fraction of raising it new. `ruin` is terminal.
export type WorkCondition = "working" | "idle" | "decayed" | "ruin";

export interface Work {
  id: number;
  kind: WorkKind;
  name: string; // how it reads in a sentence — "the sawpits above the creek"
  region: number | null; // index into town.regions, or null for a civic work
  hex: Axial | null; // the ground it actually stands on — five mills in a line, not five on a point
  // BOTH OF THESE ARE DAYS SINCE WORLD EPOCH — the same integer `world.day` is
  // ([HC-3], [HC-9]). They used to be a year and a season off the town's own
  // private counter, which meant no two places could be compared (KAN-107). The
  // `Day` suffix is not decoration: a bare `since` that once held a year is
  // exactly the sort of name a future reader would do year arithmetic on.
  sinceDay: number; // the day it started working, for the chronicle
  condition: WorkCondition;
  idleSinceDay: number | null; // the day it stopped working, for the devolution ladder

  // What it contributes each season, already scaled by its parcel's quality.
  food: number; // mouths it can feed beyond its own hands
  trade: number; // coin of exportable value
  defence: number; // contribution to security
  hands: number; // population it needs to man
  serves: Need | null; // the want it answers
  servesFor: number; // ...for how many souls

  // Defensive works only: the boundary of the claimed set FROZEN at the moment
  // this wall was raised, and never re-extended as the town grows. So a hex
  // claimed later, outside it, simply IS the faubourg. An unwalled edge is the
  // way in — an unfinished circuit is normal.
  circuit?: Axial[];
}

// ---- The footprint ---------------------------------------------------------
// The land a town works is fixed at founding; what grows is HOW MUCH OF IT THE
// TOWN HAS BUILT OVER. This lives on the Town, never on the Parcel, so "parcels
// are immutable after founding" survives verbatim.

// How closely the built-up core is packed. Rising a grade is "building inwards".
export type CoreGrade = 0 | 1 | 2 | 3 | 4; // scattered · settled · close-built · packed · stone-built

export interface Footprint {
  core: CoreGrade;
  claimed: Axial[]; // the hexes the town has built over. Binary: claiming costs capacity at once.
}

// ---- The town --------------------------------------------------------------
export interface Town {
  id: number;
  name: string;
  seed: number; // fixes the founding roll and the map projection
  archetype: Archetype;
  patron: Patron;
  // Days since world epoch, like every other date a place keeps. THERE IS NO
  // SECOND CLOCK HERE and there must never be one again: [HC-9] says there is
  // one clock and it lives in world state, and `town.season` — "seasons elapsed
  // since founding" — was this module ignoring it. Two places founded in
  // different years could not be compared on one timeline, because each thought
  // year 1 was the year IT was founded. The world hands the day in; the town
  // never reaches for it ([HC-71]).
  foundedDay: number;

  // The three stored variables. Everything else is DERIVED every tick so it can
  // never drift out of step with its own explanation.
  population: number; // souls — the hands that man works and the mouths that eat
  wealth: number; // coin on hand: what construction spends and what a raider steals
  prosperity: number; // 0..100 LAGGING condition — the slow verdict on the place

  land: Axial[]; // every hex of the town's ground, an irregular coast
  water: Axial[]; // only the water that touches it — no wasted ring
  regions: Region[];
  works: Work[];
  footprint: Footprint; // the built-up ground — see §2.5
  // `grantedToTown` stood here and is DELETED (KAN-122). It was a haven-only list
  // of region ids the owner had opened for the town to spread into — and that is
  // the same concept as `Region.focus === "growth"`, arrived at from the other
  // end. Two ways to say one thing is [P-47], so the region keeps the fact and
  // the town no longer carries a second copy of it. Do not reintroduce it: the
  // difference between a governor opening ground and an owner doing so is WHO
  // SETS THE FOCUS, never a separate field (spec §2.12.8).
  governor: string; // who runs the place. KAN-73 gives him competence and temperament.

  // WHAT THE WEATHER HAS TAKEN OFF THIS SEASON'S HARVEST, as a share of it —
  // [HC-72]'s "a seasonal yield modifier, accumulated" row, and the MODIFIER half
  // of [HC-6]. It is stored for exactly the reason `grant` is: it does not come
  // off the ledger, it ARRIVES, and no function of the ledger could recompute it
  // ([HC-14]'s test is "could this have been recomputed?" — a spent storm's
  // momentum is history and nothing here remembers it).
  //
  // It accumulates a day at a time and is spent ONCE, when the season's books are
  // struck; `closeHarvest` then puts it back to nothing. A downpour does not
  // reach into a ledger that has not been struck yet, and a modifier that carried
  // into the next ninety days would be a downpour charged twice.
  harvestLoss: number;
  grant: number; // standing coin per season from the patron (KAN-72 makes this archetypal)
  // WHAT THE SHIPPING BROUGHT — [HC-72]'s "cleared trade" row, written by the
  // world in the seasonal clear and by settlement afterwards. Stored for the
  // same reason `grant` is: it does not come off the ledger, it ARRIVES. It is
  // not a goods inventory and holds no stock — see trade.ts.
  market: MarketState;
  nextWorkId: number;

  // The DAY the town was last frightened — a raid, a bombardment. Feeds the
  // governor's FEAR term ("since the burning, the town wants guns"). KAN-74 sets it.
  lastThreatDay: number | null;
}

// ---- What the world hands in ------------------------------------------------

// A day's weather at this place, in the TOWN'S OWN VOCABULARY. It is [HC-72]'s
// two weather rows — the yield modifier and the damage events — and it is
// written here rather than imported so that [HC-71] survives as a property of
// the code: the ledger accepts weather without knowing that a world, a zone or a
// storm exists. The overworld's `Weather` satisfies this structurally, so the
// compiler checks the match at the one call site that joins the two ends, and
// neither module has to import the other.
//
// Note what is NOT on it: a severity, a band, a storm, a position. [HC-33] says
// no code path may key an effect off "an event happened here", and the surest
// form of that rule is a type through which the fact cannot arrive ([P-17b]).
export interface WeatherDay {
  yieldLoss: number; // a share of the season's harvest, accumulated ([HC-6])
  // A SHARE OF WHAT THE TOWN'S STANDING WORKS COST TO RAISE, billed in coin
  // today — never a share of the coffers. It was `wealthLoss: a share of coin on
  // hand` until 2026-09-15, and the name was the bug wearing a label: a town with
  // a million paid a thousand times more to mend the same fence than a town with
  // a thousand, so "a small maintenance cost" was really a proportional ceiling
  // on wealth. Priced against the WORKS, the same storm sends the same bill to
  // both, and only the share of the purse it takes differs ([HC-36] unchanged:
  // still a wealth loss, still no stockpile to deduct from).
  maintenanceShare: number;
  worksDropped: number; // grades down the ladder, today ([HC-34])
  worksDestroyed: number; // zero or one, never a sweep ([HC-35])
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
  // How hard the garrison is — what a raider would face. The same ladder as the raid
  // layer's `GarrisonGrade` ([HC-60], renamed 2026-09-10 from outpost/town/capital):
  // it grades HARDNESS and deliberately shares no word with the size class
  // settlement → town → city. The two unions are kept separate structs, not one import,
  // because the world drives the ledger and never the other way ([HC-71]); a test pins
  // that they stay the same three words.
  garrison: "picket" | "garrison" | "fortress";
  needs: Record<Need, number>; // 0..1 UNMET — a governor input, never a player gauge
  // What it sells, what it buys, and the difference — the trading engine's whole
  // surface on the ledger (§3.5.3: "derive() gains a commerce block computed
  // from the ledger exactly as food and trade are today").
  commerce: Commerce;
  // 0..1 — what reaches the quay, both ways ([HC-85]). REACH x READINESS since
  // KAN-112: how much of the shipping still calls, times what this place has
  // made of its own shore. One is the world's fact and the other is the town's,
  // and neither is worth anything without the other.
  access: number;
  dependency: number; // 0..1 — how much of its bread is not off its own ground
}
