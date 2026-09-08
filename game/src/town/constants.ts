// ============================================================================
// TOWN MODULE — every tunable number in one place.
// All values are starting guesses. The town sim is a SLOW loop (one tick per
// season, four per year) so these are tuned against decades, not minutes.
// ============================================================================

export const SEASONS_PER_YEAR = 4;

// ---- The land ring ---------------------------------------------------------
// The founding roll is BIASED on purpose: one dominant vocation at `rich`, one or
// two supporting, the rest filler. Rolling uniformly makes every town mediocre at
// everything — the quality tables below are what keep towns distinguishable.
export const LAND = {
  ring: 6, // one hex = one parcel; six flat-top directions, so six parcels
  secondSupportChance: 0.5,
  support: { rich: 0.25, fair: 0.5, poor: 0.25 },
  filler: { rich: 0.05, fair: 0.35, poor: 0.6 },
};

// ---- Works -----------------------------------------------------------------
// Good land is simply worth more — this is how a rich parcel becomes a rich town.
export const QUALITY_YIELD = { poor: 0.6, fair: 1, rich: 1.5 };

export const WORKS = {
  labourShare: 0.55, // share of souls who are working hands (the rest are children, old, idle)
  // Population at which each self-raising subsistence work appears. Absent = 0.
  subsistenceAt: {
    dwellings: 0,
    gardenPlots: 0,
    fishingShacks: 20,
    well: 30,
    chapel: 40,
    market: 60,
  } as Partial<Record<string, number>>,
};

// The devolution ladder, in seasons idle. Decay is recoverable at every step
// until the last — a work rots, it does not vanish.
export const DECAY = {
  idleToDecayed: 12, // three years untended
  decayedToRuin: 28, // ...and seven before it is past saving
};

// ---- Food & population -----------------------------------------------------
// THE HAMLET FLOOR is not a constant — it is the *subsistence works* in the
// catalogue (garden plots, dwellings, fishing shacks). They cost no wealth and
// raise themselves, so a sacked town always crawls back to a hamlet without
// anyone deciding to rebuild it. Burnable, like everything else in the ledger.
export const FOOD = {
  perHead: 1, // mouths: food one soul eats per season
};

export const POP = {
  drift: 0.06, // share of the gap to carrying capacity closed per season — slow
  floor: 12, // a town never quite empties; Abandoned is a deliberate end-state (KAN-74)
  // Carrying capacity is what the food can feed, held BELOW that ceiling when the
  // place is miserable: people drift away from a sinking town. A town that is
  // merely DOING WELL fills its land — contentment is not a cap. So the pull
  // reaches its ceiling at `fullAt` (a steady, unremarkable town) and only bites
  // below that. Growing PAST your own land needs bought grain, which belongs to
  // the trade half (KAN-54) and is deliberately not here yet.
  prosperityPull: { min: 0.5, fullAt: 55 }, // 0.5 at prosperity 0, 1.0 from 55 up
};

// ---- Wealth ----------------------------------------------------------------
export const WEALTH = {
  upkeepPerHead: 0.06, // what a soul costs the town to keep in civic order
  start: 200,
};

// ---- Prosperity ------------------------------------------------------------
// Prosperity is stored ONLY because it must LAG. Torch a warehouse and yield
// falls this instant, but the town's standing should sag over seasons — without
// the lag it whipsaws and reads as a spreadsheet instead of a place.
export const PROSPERITY = {
  lag: 0.12, // share of the gap to target closed per season (~2 years to settle)
  base: 22, // a bare subsistence hamlet sits here: "getting by"
  perSurplusHead: 26, // how much food surplus per head lifts it
  perYieldHead: 55, // ...and coin surplus per head
  securityWeight: 0.18, // a defended town is a confident one
  start: 30,
};

// ---- Security --------------------------------------------------------------
export const SECURITY = {
  perDefence: 4, // each point of defensive work
  patronBonus: 18, // a crown at your back
  // What a raider actually faces. Importance weighs guns AND size: a heavily
  // fortified presidio of ninety souls is a hard target but still an outpost, so
  // a battery alone must never read as a capital. Derived here so the hand-set
  // SettlementTier in the land module can eventually be replaced by it
  // (spec §9, deferred — it touches the ratified garrison-tier decision).
  securityShare: 0.6, // ...the rest is size
  capitalPop: 800, // population that counts as a full-size settlement
  townAt: 35,
  capitalAt: 70,
};

// ---- The governor's plan ---------------------------------------------------
// Five named terms, each of which OWNS A CLAUSE. Wealth is deliberately absent:
// the score decides what the town WANTS, wealth decides what it can START.
// Rule: no term without a clause. The sentence is assembled from the top two
// contributors, so the explanation IS the score, not a rationalisation of it.
export const PLAN = {
  weights: {
    land: 1.0, // "the hills are timbered"
    need: 1.5, // "the men have nowhere to drink"
    market: 1.1, // "the shipways want planks"
    fear: 1.3, // "since the burning, the town wants guns"
    agenda: 0.9, // "the crown wants this place held"
  },
  affinity: { poor: 0.25, fair: 0.6, rich: 1.0 }, // how much good land argues for a work
  wantSecurity: 45, // the security a town would like to have before it relaxes
  starvedBonus: 1.0, // a downstream work standing idle for want of this one
  tradeScale: 34, // normalises a work's earnings into roughly 0..1
  // A governor holds out for the better thing. He only settles for a lesser want
  // he can afford today if it scores at least this share of what he really wants —
  // which is what lets an investment slider "unlock a category" rather than just
  // speed things up.
  settleFor: 0.7,
  threatMemory: 40, // seasons a sacking stays fresh in the town's mind
};

// ---- Reading it back -------------------------------------------------------
// The bands that turn a number into a word. No number without a sentence.
export const PROSPERITY_BANDS: { at: number; word: string }[] = [
  { at: 80, word: "thriving" },
  { at: 60, word: "prosperous" },
  { at: 40, word: "steady" },
  { at: 22, word: "getting by" },
  { at: 8, word: "struggling" },
  { at: 0, word: "on its knees" },
];

export const WEALTH_BANDS: { at: number; word: string }[] = [
  { at: 4000, word: "coffers heavy" },
  { at: 1200, word: "comfortable" },
  { at: 300, word: "getting by" },
  { at: 60, word: "short of coin" },
  { at: 0, word: "the coffers are bare" },
];
