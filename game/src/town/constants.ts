// ============================================================================
// TOWN MODULE — every tunable number in one place.
// All values are starting guesses. The town sim is a SLOW loop (one tick per
// season, four per year) so these are tuned against decades, not minutes.
// ============================================================================

// The calendar is NOT redefined here. `SEASONS_PER_YEAR = 4` used to sit on this
// line and it was a second source of truth for `CALENDAR.seasonsPerYear` — the
// same class of bug as the deleted `POP.floor` (KAN-106) and the hardcoded
// garrison preview (KAN-109, [P-47]): a derived quantity previewed from a second
// number. There is one calendar, in `overworld/calendar.ts` — a leaf that imports
// nothing, so reading it from here closes no cycle — and the durations below are
// written IN TERMS OF IT rather than trusting two numbers to agree.
import { DAYS_PER_YEAR } from "../overworld/calendar";

// ---- The land --------------------------------------------------------------
// An irregular coast of regions. Dilution comes from INDEPENDENT PER-TILE
// SAMPLING, not tile count — so what matters here is that region SIZES are
// budgeted and skewed. Uniform sizes would rebuild the mush at a larger scale.
export const LAND = {
  radius: 4, // how far out the generator may consider ground
  hexes: 24, // target land hexes
  coast: 0.6, // how far south the shore reaches, before jitter
  coastJitter: 2.2, // ...and how much it wanders, which is what makes it a coast
  compactness: 0.55, // how strongly the land clings to the town rather than straggling
  cays: 2, // up to this many detached offshore hexes

  // Budgeted, skewed region sizes. THE DOMINANT MUST DOMINATE.
  dominant: { lo: 6, hi: 9 },
  support: { lo: 3, hi: 5 },
  minor: { lo: 3, hi: 6 }, // filler regions are stretches, not slivers
  deadShare: 0.55, // share of filler regions that are worth nothing

  upsetChance: 0.3, // odds this town's ground favours its second crop over its first
  atHandWithin: 2, // a region further out than this is `far`: costlier to man, first to idle
  harbourChance: 0.7, // not every town has sheltered water
  reefShare: 0.25, // ...and some of the coast is worth fishing
};

// ---- Works -----------------------------------------------------------------
// Ground that suits a crop is worth more of it. This replaces the struck
// `quality` axis: area is HOW MUCH, suitability is HOW WELL AND FOR WHAT.
export const SUIT_YIELD = { poor: 0.35, fair: 0.7, ideal: 1.3 };

export const WORKS = {
  // Share of souls who are working hands; the rest are children, old, idle. It is
  // half of every manning question in the module — a work is manned when
  // `population · labourShare` covers its `hands` — so it is also half of the
  // hamlet floor, which is a LABOUR floor and not a food one ([HC-67]).
  labourShare: 0.55,
  sweetSpotBonus: 1.25, // the best of the cane — why the boiling house stands there
  farPenalty: 0.85, // ground over the ridge yields a little less...
  farHands: 1.35, // ...and costs more men, because they must walk to it
  // RISING RETURNS: how much more the Nth work on a region is worth than the
  // first, PER WORK ALREADY STANDING THERE (§2.12.5). A second sawpit shares a
  // track, a pond and a crew; a fifth is a mill with yards. It is minted into
  // the new line at raise time and never re-prices what already stands.
  //
  // THE SHAPE IS A TUNING TABLE ([HC-90]) AND THE CEILING IS NOT IN IT. There is
  // deliberately no clamp here and no table length to run out of: depth cannot
  // exceed a region's free area, so the premium runs out of GROUND first and the
  // loop terminates on the founding roll rather than on a constant ([HC-75]).
  //
  // CALIBRATED AGAINST THE REAL CUT, not against a table ([P-52], as extended
  // 2026-09-20). Free hexes per region run 0–23 with a median of 6, so a median
  // region's ground is spent at six works and its last is worth 1.6x its first.
  //
  // THE PER-TOWN LIMIT THAT USED TO STAND IN FRONT OF THE GROUND IS GONE
  // (KAN-125). Measured after KAN-124, every depth-9 region on the warm world
  // stopped at `CATALOGUE[kind].max` rather than at its own free area — a
  // per-kind, per-town number binding a per-region rule. `max` is now `Infinity`
  // on a focus expression, so the ceiling is the founding roll's, exactly as
  // [HC-94] says, and the deepest ground a world cuts is what decides the
  // richest premium anyone ever mints.
  premiumPerDepth: 0.12,
  // THE LABEL LADDER'S THRESHOLD (§2.12.12) — the depth at which a region's
  // installation is RELABELLED rather than joined by another entry: sawpits
  // become a mill and its yards, cane fields gain their boiling house.
  //
  // A PLACEHOLDER, AND §2.12.15 SAYS SO — the real number waits on the
  // terrain-kind lockdown pass, with the quarry and salt's trade class. It is 5
  // rather than an arbitrary figure because §2.12.5 already wrote the sentence
  // this ladder illustrates: "a second sawpit on the same hills shares a track,
  // a pond and a crew; A FIFTH IS A WORKS."
  ladderAt: 5,
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

// The devolution ladder, IN DAYS IDLE. Decay is recoverable at every step until
// the last — a work rots, it does not vanish. Both thresholds are counted from
// the DAY the work went idle, so a work is DECAYED for the difference between
// them (four years) before it is past saving.
//
// Written as years rather than as 1080 and 2520, so the derivation stays visible
// and the number a person tunes is still the number of years a governor may
// neglect a shed. They were 12 and 28 SEASONS until KAN-107: the durations are
// unchanged to the day, only the unit the town counts them in.
export const DECAY = {
  idleToDecayed: 3 * DAYS_PER_YEAR, // three years untended
  decayedToRuin: 7 * DAYS_PER_YEAR, // ...and seven before it is past saving
  // What it costs to put a rotted work back in order, as a share of raising the
  // same work new. WELL UNDER 1, and that is the whole reason anyone mends
  // rather than rebuilds — it is also what keeps `decayed` a rung on a ladder
  // rather than a slower way of dying. Wealth stays the BUDGET GATE (§5.1): this
  // decides what a governor can start, never what the town wants.
  repairShare: 0.4,
};

// ---- Food & population -----------------------------------------------------
// THE HAMLET FLOOR is not a constant — it is the *subsistence works* in the
// catalogue (garden plots, dwellings, fishing shacks). They cost no wealth and
// raise themselves, so a sacked town always crawls back to a hamlet without
// anyone deciding to rebuild it. Burnable, like everything else in the ledger.
//
// AND IT IS NOT A NUMBER PER PLACE EITHER, since 2026-09-15: a subsistence work's
// `hands` are scaled by the same ground quality as its yield (`handsOn` in
// works.ts), so the floor a place sits on is its OWN ground's, and the ratio that
// decides whether it can man its food — `food · labourShare / hands` — is the
// same on every grade. What the catalogue has to supply is the MARGIN in that
// ratio, and the margin it must clear is derived below, at `prosperityPull`.
export const FOOD = {
  perHead: 1, // mouths: food one soul eats per season
};

// ---- Trade -----------------------------------------------------------------
// The three classes, and what a soul takes of each. ONE RULE FOR EVERY PLACE
// ([HC-76]) — a hamlet and a city obey the same line and fail at different
// heights. Victuals are counted in the `food` column; materials and luxury in
// the `trade` column, which [HC-83] makes literal ("what a work sends to the
// quay"), so a sawpit's 14 is fourteen units of materials.
export const TRADE = {
  // Timber and stone are wanted by BUILDINGS, not by people — a place with
  // nothing raised needs no stone to keep it standing. Subsistence works are not
  // counted: people roof their own houses, and the hamlet floor is never gated.
  materialsPerWork: 0.9,
  // How short of timber and stone a place must be before it CANNOT BUILD at all.
  // Not zero, and the difference matters: at zero the whole map deadlocks the
  // moment anyone raises a first capital work, because the standing bill appears
  // before any supply does and no sawpit can then be raised anywhere (measured:
  // 48 places, median works 20 -> 14, largest town 1,070 -> 327). §3.5.3's rule
  // is "cannot GET timber and stone", not "is a little short of them".
  buildGate: 0.75,
  luxuryPerHead: 0.02, // a little comfort at the top of the pyramid, wanted by people
  // Base prices, in coin per unit. Materials and luxury sit at par because the
  // catalogue's `trade` numbers are already value-weighted; victuals are cheap
  // and bulky, which is what makes a city fed from the sea expensive to keep.
  basePrice: [0.15, 1.0, 1.2],
  // How far a cleared ratio may move a price either way ([HC-82]: the ratio sets
  // the local price). A glut halves it, a famine trebles it, and nothing on the
  // map ever reads a price it did not sail to.
  priceFloor: 0.35,
  priceCeiling: 3.0,
  // Damping for a thin market: a neighbourhood with almost nothing on either
  // side of the scale must not swing to the ceiling on a bushel of corn.
  thin: 12,
  // What share of a season's export revenue a town will put into bread rather
  // than into works. It is the appetite, not the payment order — [HC-78] still
  // pays the quay before the governor sees a coin. A governor who spent every
  // penny on corn would never raise anything again.
  growthShare: 0.6,
  // [HC-88] THE PLAYER IS A SMALL FISH. However much he lands or lifts in one
  // deal, he may not move a local price by more than this share of it. Uncapped,
  // the first thing anyone discovers is that they can buy out a town.
  nudgeCap: 0.08,
  // How nearly a tier must be covered to count as SECURE and let a place reach
  // one rung higher ([HC-77]). Not zero, because a place a bushel short of its
  // own corn is not a place in famine.
  secureSlack: 1,
  // THE VALUE OF CARGO A SEASON AT WHICH A HARBOUR EARNS HALF ITS COLUMN — the
  // one number KAN-132 added, and the whole of what turns the quayside cut from
  // a standing allowance into a share of real traffic.
  //
  // WHAT THE COLUMN MEANS CHANGED, AND THIS IS WHERE IT SAYS SO. A work that
  // fills no hold used to be paid its `trade` column as a WAGE — `column x
  // access`, at no price and to no buyer, whether or not a bale crossed. The
  // column is now a CAPACITY, and `busynessOf` decides how much of it is
  // actually earned: `traffic / (traffic + quayBusyAt)`.
  //
  // MEASURED, NOT CHOSEN ([P-52]'s extension, [P-39]). Swept on four warm worlds
  // at day 0 with everything else held. At 1.5 the quayed half still clears
  // 22.66 a season and funds a 180-coin work in under eight years, which is the
  // thing the story exists to stop; at 6 the quayless half falls to -0.95 and
  // the largest port to 1,326. At 3 the quayed half clears 17.39 — a capital
  // work in ten years and a third — the largest port holds 1,464, and the
  // reading itself behaves: median 0.78 with a quay, 0.39 without, and nothing
  // at either end of the scale.
  //
  // It is a small number BECAUSE THE WORLD'S REAL TRADE IS SMALL: the median
  // quayed place clears 16 coin of cargo a season and the median place without a
  // quay clears 2. Three coin is a couple of boatloads, and a harbour that sees
  // that much is half employed.
  quayBusyAt: 3,
};

// A beach and a longboat move some cargo; a quay and a garrison move all of it.
// [HC-85] gates participation BOTH WAYS on this, so it is also the whole of why
// burning a warehouse is an economic act — and [HC-87]'s fragile ceiling.
//
// THIS IS ONLY HALF OF `access`, AND IT IS THE HALF THE PLACE OWNS. It is its
// READINESS to work cargo, and it is multiplied by the REACH of the sea lanes
// that still call ([HC-86], `overworld/market.ts`). Neither half is worth
// anything alone: a port whose lanes are all cut has nothing to load, and a
// beach nobody has built a quay on cannot load what does call.
//
// NO BASE TERM, and its absence is the rule rather than a tuning choice:
// [HC-85] says "no quay, no security -> nothing moves either way", so a place
// with neither must come out at exactly zero.
//
// A STRAND IS NOT A HARBOUR, AND THAT IS WHAT `strandQuays` SAYS. Fishing shacks
// are SUBSISTENCE works: they raise themselves again for nothing every season
// ([HC-67]), and the catalogue allows three — so the hamlet floor used to buy
// 0.9 of the scale free of charge and, with any garrison at all, HALF THE WORLD
// SAT AT EXACTLY FULL ACCESS ON A BEACH (measured: median access 1.00 across
// four seeds). That is why burning a quay was a season's inconvenience rather
// than a siege, and why [HC-87] could not be stated at world scale.
//
// So what the floor draws up on the sand is CAPPED: however many boats there
// are, a strand carries at most this many quays' worth, and past that somebody
// has to build something. It is written as a MULTIPLE OF `perQuay` rather than
// as a second rate, so there is one number for what a berth is worth and the cap
// is visibly two of them ([P-47]).
//
// NOTE THE SHAPE OF THE CHANGE, because it is the 2026-09-15 clamp rule again: a
// place with one or two shacks is untouched, and only the place already at the
// TOP of the free floor gives anything up. It can only ever ask less of the
// places that had the most for nothing, never more of the places that have least.
export const ACCESS = {
  perQuay: 0.3, // each working waterfront work — shacks, warehouse, customs, shipway
  strandQuays: 2, // ...but the boats on the sand are worth no more than this many berths
  securityWeight: 0.45, // ...and a place nobody dares call at moves nothing either
};

// The town card's one word for how much of its bread comes off a ship.
export const DEPENDENCY_BANDS: { at: number; word: string }[] = [
  { at: 0.66, word: "fed from the sea" },
  { at: 0.4, word: "leans on the shipping" },
  { at: 0.12, word: "mostly feeds itself" },
  { at: 0, word: "self-feeding" },
];

export const POP = {
  drift: 0.06, // share of the gap to carrying capacity closed per season — slow
  // `floor: 12` was here and is DELETED (KAN-106). It was a second number sitting on
  // top of the hamlet floor the catalogue already raises, and it overrode it: applied
  // unconditionally in `carryingCapacity` and again in `settleSeason`, it bounced a
  // place razed to nothing back to twelve souls the next season, so `Abandoned` could
  // not be reached by anything ([HC-67], [HC-50]). The floor REQUIRES SURVIVORS, and
  // it is not a constant — it is `raiseSubsistence` wanting `ceil(population/autoPer)`
  // of works that cost nothing, which at nobody wants nothing. Do not reintroduce a
  // population floor here. The line that used to follow — "if a place must not empty,
  // give it ground that feeds someone" — was the criterion that failed, and it is
  // answered as of 2026-09-15: a subsistence work's hands scale with its yield, so
  // EVERY grade of ground feeds the hands that work it and the generator is free to
  // make thin places again.
  // Carrying capacity is what the food can feed, held BELOW that ceiling when the
  // place is miserable: people drift away from a sinking town. A town that is
  // merely DOING WELL fills its land — contentment is not a cap. So the pull
  // reaches its ceiling at `fullAt` (a steady, unremarkable town) and only bites
  // below that. Growing PAST its own land is BOUGHT GRAIN, and as of KAN-91 the
  // capacity counts it: the ~450-soul ceiling is gone, and the four limits that
  // replace it are coin, access, ground for houses, and hands (§3.5.6).
  // 0.5 at prosperity 0, 1.0 from 55 up.
  //
  // `min` IS ALSO WHERE THE SUBSISTENCE MARGIN COMES FROM, and that is why no
  // second constant was added for it ([P-47]). A place with one food work settles
  // where capacity puts it — `food · pull` — and can man that work only if
  // `food · pull · labourShare >= hands`. So the ratio the catalogue must clear is
  //
  //     food · labourShare / hands  >=  1 / pull
  //
  // and the worst `pull` the model permits is `min`. At 0.5 that is a margin of
  // TWO: a subsistence food work must feed twice the souls its own hands need, and
  // a place may then lose half its people to a shock and still work its ground.
  // Garden plots clear it at 2.75 and fishing shacks at 3.03; over the ridge both
  // are divided by `WORKS.farHands` and clear it at 2.04 and 2.24. Tune `min`
  // upward and the margin required falls; tune it down and the catalogue has to
  // widen with it.
  prosperityPull: { min: 0.5, fullAt: 55 },
};

// ---- Wealth ----------------------------------------------------------------
//
// `upkeepPerHead` IS THE TERM THAT DECIDES WHETHER A TOWN'S TRADE IS PROFITABLE
// AT ALL, and until KAN-131 it had never been priced against what a soul earns.
//
// It is the one subtraction in `yield = earned + grant - imports - upkeep` that
// is charged PER SOUL, while everything on the income side is earned per unit
// shipped times `access`. So a town whose people are fed by its own ground
// gains the bill for nothing and gains no income with it, and `settleSeason`'s
// `Math.max(0, ...)` then forgives the shortfall every season — which is what a
// town "hovering at its build cost for ever" actually is: a purse pinned at
// exactly zero by a loss nobody is ever billed for.
//
// MEASURED ON THE WARM WORLD, FOUR SEEDS, TWO HUNDRED YEARS. At 0.06 the median
// place clears 0.80 coin a season on trade after its imports, its keep and its
// weather — and 82 of 193 places clear LESS THAN NOTHING. At 0.05 the median
// clears 2.60, which is a 200-coin capital work in nineteen years, and 71 places
// are still losing. The half of the world with no quay moves from a standing
// loss of 1.28 a season to roughly break even, which is the ratified sentence
// exactly: A TOWN GETS BY.
//
// WHY NOT LOWER. 0.045 was measured too and it overshoots: the median clears
// 6.14, a capital work every EIGHT years, which is the "building every few
// years unaided" the design calls too fat. The dial stops where "decades" does.
//
// WHAT IT DOES NOT DO, and the honest half of the number: a town that already
// has a quay is untouched by it (20.02 -> 21.17 a season), because its margin is
// not made of upkeep. See `TRADE.basePrice` for where that money comes from.
export const WEALTH = {
  upkeepPerHead: 0.05, // what a soul costs the town to keep in civic order
  start: 200,
};

// ---- Prosperity ------------------------------------------------------------
// Prosperity is stored ONLY because it must LAG. Torch a warehouse and yield
// falls this instant, but the town's standing should sag over seasons — without
// the lag it whipsaws and reads as a spreadsheet instead of a place.
// [HC-74] `surplus/head` is GONE from this table, and its removal is the point.
// A place fed from the sea has negative surplus BY DESIGN, so the moment imports
// existed every large town read as "on its knees". Dependency replaces it as a
// MILD negative — mild because [HC-79] warns that an appetite scored hard turns
// into a second prosperity meter, and every well-fed town then reads as
// miserable for want of silk.
export const PROSPERITY = {
  lag: 0.12, // share of the gap to target closed per season (~2 years to settle)
  base: 30, // a bare subsistence hamlet sits here: "getting by"
  dependencyWeight: 9, // ...and leaning on the shipping costs it a little standing
  luxuryWeight: 5, // going without comforts costs it a little more. MILD ([HC-79])
  perYieldHead: 55, // coin surplus per head
  securityWeight: 0.18, // a defended town is a confident one
  start: 30,
};

// ---- Security --------------------------------------------------------------
export const SECURITY = {
  perDefence: 4, // each point of defensive work
  patronBonus: 18, // a crown at your back
  // The garrison grade — how hard a raider's target is, on the ladder
  // `picket · garrison · fortress` ([HC-60], renamed 2026-09-10 from
  // outpost/town/capital, which shared two words with the size class). It weighs
  // guns AND size, because population is a real input to the garrison ([HC-59]):
  // a heavily fortified presidio of ninety souls is a hard target but it is still
  // a small place, so a battery alone must never read as a fortress. Derived here
  // so the hand-set GarrisonGrade in the land module can eventually be replaced by
  // it (spec §9, deferred — NOT wired up in KAN-104).
  securityShare: 0.6, // ...the rest is size
  fullSizePop: 800, // population that counts as full size — a normaliser, not a rung
  garrisonAt: 35, // importance at which a picket becomes a standing garrison
  fortressAt: 70, // ...and a garrison becomes a fortress
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
    market: 1.1, // "timber fetches well here"
    fear: 1.3, // "since the burning, the town wants guns"
    agenda: 0.9, // "the crown wants this place held"
  },
  affinity: { poor: 0.2, fair: 0.6, ideal: 1.0 }, // how strongly the ground argues for a work
  // FREE HEXES AT WHICH A REGION'S SIZE IS THE ARGUMENT — the focus auction's
  // one new number, and the only one it needed. [HC-94] says a focus buys
  // CAPACITY and never a multiplier, so "the focused-to-unfocused ratio is
  // AREA"; this is what turns that into a weight, and the founding roll's own
  // variance is then what decides which ground a town gives over. Nobody tuned
  // that; the land did.
  //
  // CALIBRATED BY MEASUREMENT, NOT BY §2.3's TABLE, and the difference matters.
  // It was written as 5 against LAND.dominant's 6-9, and [P-52] caught it: the
  // median came out AT THE CLAMP (55.8% of regions at 1.00), because the world's
  // cut is not the retired generator those numbers describe.
  //
  // RE-DERIVED 2026-09-22 (KAN-132), BECAUSE THE DISTRIBUTION MOVED UNDER IT.
  // KAN-131 set 9 against free hexes running 0-23 with a median of 6, quoting
  // "the median is 0.67 and 23% sit at the top". KAN-134 then stopped counting
  // ground a work already stands on, and the same quantity now runs 0-22 with a
  // MEDIAN OF 4 — so 9 no longer reads what it was chosen to read. The two
  // properties it was calibrated on can no longer both be had: at 6 the median
  // is 0.667 but 38.0% sit at the clamp, which is [P-52]'s own complaint coming
  // back; at 9 the clamp share is fine and the median has slid to 0.444.
  //
  // 8 IS WHERE BOTH READINGS ARE HONEST: the median sits at 0.500, in the middle
  // of the scale rather than at either end, and 24.4% touch the top — the same
  // 23% the number was calibrated to in the first place. Free hexes reading ZERO
  // are 8.6% and no denominator moves them, so 8 also puts the least of the
  // distribution at an end (33.0%, against 46.6% at 6 and 29.2% at 9 with a
  // worse median).
  //
  // AND IT BARELY BINDS, WHICH IS WORTH KNOWING BEFORE ANYONE SPENDS A STORY ON
  // IT. Measured across four warm worlds at day 0, 9 -> 8 moves the day-0 spread
  // 8/77/1465 -> 8/78/1464, four capital works out of 555, and two production
  // focuses out of 334. Sweeping it all the way to 6 costs the largest port
  // 1,465 -> 1,356 and adds fourteen works. The scale is right now; it is not a
  // lever.
  focusDeepAt: 8,
  // HOW LOUDLY A DEEPENING ARGUES against the season's other two candidates, and
  // it is ONE number because a deepening's score is ONE PRODUCT rather than a sum
  // of terms. §2.12.10 writes it as `potential x free capacity x local price`:
  // three readings each 0..1, so the product lives an order of magnitude below
  // the sums the other two auctions bid in and has to be put on the same footing
  // to compete for the season at all.
  //
  // MEASURED AGAINST THE REAL CUT, NOT REASONED ([P-52], [P-39]). On the warm
  // world across four seeds the product runs 0.02–0.56 with a median of 0.14,
  // while the work auction's winner sits at 0.34–3.18 with a median of 1.95. The
  // calibration rule is that THE TWO PRICED CANDIDATE TYPES BID IN THE SAME
  // RANGE — 1.95 / 0.14 is 12 — so a deepening competes with a work rather than
  // always losing to one or always beating one. Measured at 12: 113 deepenings
  // against 432 works over forty years of fifty places.
  //
  // Its three readings pass [P-52]'s own check, which is why this is a scale and
  // not a fudge: the room reading has a median of 0.56 with a quarter at the
  // clamp, and the price reading a median of 0.25 against a ceiling of 1.
  deepenVoice: 12,
  wantSecurity: 45, // the security a town would like to have before it relaxes
  tradeScale: 34, // normalises a work's earnings into roughly 0..1
  // A governor holds out for the better thing. He only settles for a lesser want
  // he can afford today if it scores at least this share of what he really wants —
  // which is what lets an investment slider "unlock a category" rather than just
  // speed things up.
  settleFor: 0.7,
  // How long a sacking stays fresh in the town's mind, in DAYS (it was 40
  // seasons, which is the same ten years).
  threatMemory: 10 * DAYS_PER_YEAR,
};

// ---- The footprint ---------------------------------------------------------
// Room is measured in WORKS, not acres: everything that is not `beyondThePale`
// stands inside the town. Calibrated to the population band the sim actually
// produces — NOT to the 900-soul port in the spec's prose, which needs bought
// grain from the deferred trade layer.
//
// MEASURED AGAINST THE WARM WORLD AND LEFT ALONE (KAN-99, 2026-09-16). The note
// that stood here asked to be re-tuned once trade landed; trade landed, the warm
// start ran eighty-odd years of `stepFootprint` over fifty places on four seeds,
// and the table came out of it honest:
//
//   day-0 core grade  0..4, median 2 ("close-built")
//   claimed hexes     1..11, median 1-2
//   crowding          0.50 .. 2.00, median 0.67-0.87
//   populations       11 .. 928 souls, median 47-96
//
// SO THE BAND IS WIDER THAN THE ~80-450 THIS WAS WRITTEN FOR, AT BOTH ENDS, and
// nothing wanted changing. The reason is worth keeping: what happens above the
// table is a STALL — `stepFootprint` finds nothing to densify and nowhere to
// spread — and a stall is the ground-for-houses cap doing its job (§3.5.6's
// third limit), not a number overflowing. Every place measured above crowding 1
// had already reached core 4 or run out of buildable land. Tuning `coreRoom`
// upward would loosen a cap that is meant to bite.
//
// What it cost: `densifyCost[2] = 900` holds the median town at "close-built"
// for want of coin, which is exactly the poor-town-sprawls/funded-town-holds
// trade-off the table was written to make.
export const FOOTPRINT = {
  coreRoom: [4, 6, 9, 13, 18], // scattered · settled · close-built · packed · stone-built
  roomPerClaim: 3, // ...plus this much for every hex the town has built over
  // What it costs to rise FROM each grade. Building closer is free; stone and
  // storeys are not — which is why a poor town sprawls and a funded one holds.
  densifyCost: [0, 0, 900, 2200, Infinity],
  crowdedAt: 0.95,
};

// Temperament, and it is the whole archetype read. A colony would rather spread
// than pay for stone; a presidio would rather pay; a haven spreads at once.
export const SPRAWL: Record<string, { willSpill: boolean; densifyFirstTo: number }> = {
  colony: { willSpill: true, densifyFirstTo: 2 },
  royalOutpost: { willSpill: false, densifyFirstTo: 4 }, // its boundary is the stipend, not the wall
  pirateHaven: { willSpill: true, densifyFirstTo: 1 },
};

// ---- The ground plan -------------------------------------------------------
// Projecting the ledger onto real earth. ROADS ARE LAID FIRST AND BUILDINGS HANG
// OFF THEM — that is what gives distinct streets rather than gaps left between
// blocks, and what stops the result reading as a grid.
export const PLAN_SPACE = {
  // Calibrated so the claimed set plus one ring reproduces the hand-authored
  // raid map scale (~2400 paces across) — the map that already plays.
  hexPaces: 800,
  hexFill: 0.8, // ...and how much of it counts as "in the town" for placement
  // A VISIBLE HIERARCHY is what lets the eye find the axis: the spine is plainly
  // the widest thing on the map, lanes narrower, tracks narrower still.
  widthByCore: [30, 34, 38, 42, 46],
  spineRank: 2.6,
  plazaRadius: [130, 155, 180, 205, 230], // an oversized VOID: nothing stands in it
  // How often a street offers a plot, by how closely the town is built. A
  // stone-built town packs its frontages; a scattered one straggles.
  frontageByCore: [200, 172, 148, 126, 108],
  lanesByCore: [2, 3, 4, 5, 5], // ...and how many streets it has struck
  crossLanes: 2, // so the plan is a network, not a comb
  frontageJitter: 22, // ...give or take, so no two plots are the same width
  setback: 34, // how far a building stands back from the carriageway
  // ~4 degrees. Beyond this the frontage line breaks, and the frontage line is
  // what reads as a street in the first place.
  rotJitter: 0.07,
  gapChance: 0.2, // a yard, an alley, a burnt plot: not every frontage is built
  hutsPerDwelling: 4, // one `dwellings` work draws as a cluster, one ledger line
  maxExtent: 4000, // paces. The map covers the town, never the county.
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
