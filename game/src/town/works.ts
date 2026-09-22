// The works ledger — the catalogue of what a town can have, and the systems that
// keep it honest (labour, decay).
//
// A work is a ledger line with a place attached. Buildings are not simulated;
// works are. Parcel scarcity is the primary growth cap — cap and flavour are the
// same mechanism, so there are no arbitrary limits here beyond the land itself.
//
// GOODS SURVIVE; CHAINS DO NOT (§2.12, ratified 2026-09-19). Timber is still a
// real thing that moves on real ships and fetches a local price; what went is
// `timber -> sawpit -> planks -> shipway`. This is a sandbox age-of-pirates
// game, not a city manager, and a brittle production chain is the shape of the
// other thing.

import type { Town, Work, WorkClass, Need, TerrainKind, Produce, Suit, Region } from "./types";
import type { Axial } from "./hex";
import { key } from "./hex";
import { WORKS, SUIT_YIELD, DECAY } from "./constants";
import { isDead, SUIT_RANK, capacityOf, takenHexes } from "./land";

// `takenHexes` lived here until KAN-134 and now lives beside `capacityOf`, which
// has to subtract exactly that set. It is re-exported so every reader that asks
// the works ledger what ground is spoken for still asks it here.
export { takenHexes };

// Where a work sits when the ledger is projected onto a raid map (KAN-76).
export type Zone = "waterfront" | "lowerTown" | "plaza" | "backTown" | "outworks" | "beyondThePale";

export interface WorkDef {
  label: string; // how it reads in a sentence
  cls: WorkClass;
  cost: number; // wealth to raise; subsistence works are free
  // TWO GATES, NOT ONE (spec §2.5). A crop or extraction work names what it
  // PRODUCES and is offered wherever the ground bears it, at any grade — terrain
  // biases, it does not determine. A SITED work names hard ground and gets no
  // gradient: you cannot half-build a harbour on a hill.
  produces: Produce | null;
  needsGround: TerrainKind | null;
  // WHAT THE WORK SENDS TO THE QUAY, AND IN WHICH COLUMN. Victuals are counted
  // in `food` and materials and luxury in `trade` (§2.12.13) — the columns did
  // not move when the keying did.
  //
  // THERE IS NO `exports` COLUMN ANY MORE. It named the class a work's cargo
  // was, which made a town's place in [HC-77]'s pyramid a property of which
  // buildings its governor picked. A cargo's class comes off the GROUND now:
  // `produces` says what comes out of the earth and `trade.ts`'s `PRODUCE_CLASS`
  // says what class that is, so there is one source for it and the catalogue is
  // no longer one of them.
  food: number;
  trade: number;
  defence: number;
  hands: number;
  serves: Need | null;
  servesFor: number; // how many souls it satisfies
  // THE MENU'S OWN PER-TOWN LIMIT — how many of this one a town may ever hold.
  // It answers a question only a MENU can ask ("how many taverns is too many?"),
  // and it is `Infinity` on a focus expression, which is not a dodge but the
  // resolution of KAN-125's tuning question. See `FOCUS_EXPRESSIONS`.
  max: number;
  zone: Zone;
  autoPer?: number; // subsistence only: raise one of these per N souls
}

// ---- The catalogue ---------------------------------------------------------
// Six subsistence/civic works that raise themselves and THIRTEEN capital works —
// EIGHT the governor chooses between, and FIVE that are what a production
// focus on a stretch of ground IS (§2.12.12). No dependency edges: `requires`
// was deleted with the chain it expressed.
//
// THE CATALOGUE GREW BY TWO AND THE MENU DID NOT MOVE (KAN-126, §2.12.14). That
// is the structural argument for the whole direction and it is worth being able
// to point at: `CHOOSABLE` reads the catalogue's own columns, so `grainFields`
// and `cottonWalk` land in `FOCUS_EXPRESSIONS` for free and the governor still
// weighs eight things against each other. IT IS THE ONE THING TO CHECK IF
// ANYBODY ADDS A SIXTH.
//
// ---- [HC-91] THE TABLE IS THE SOURCE OF TRUTH AND THE TYPE COMES OFF IT -----
//
// `WorkKind` was a hand-written union in `types.ts` until KAN-135, and this
// table was typed AGAINST it — which ran the relationship backwards. Adding a
// work meant editing two files, and the compiler only helped in one of the two
// directions: a row with no union member was an error, a union member with no
// row was silent until something read it. The type is now generated from the
// table's own keys, so there is ONE declaration site and it is the catalogue.
//
// THE TWO BINDINGS BELOW ARE ONE OBJECT, NOT TWO TABLES, and each earns its
// keep:
//
//  * `ROWS` is the literal, so `satisfies` checks every value against `WorkDef`
//    — including the EXCESS-PROPERTY check that catches a misspelt column
//    (`autoPre: 40`), which an assignment of an already-typed object would let
//    through. `Record<string, ...>` is what keeps the keys open; narrowing it
//    would be the hand-written union again, one indirection along.
//  * `CATALOGUE` is that same object under the type every reader already had.
//    `Record<WorkKind, WorkDef>` is the mapped type that says EVERY KIND HAS A
//    ROW — now true by construction rather than by anybody remembering — and
//    deriving the keys without pinning the values would have quietly dropped
//    half of what that annotation was buying.
//
// It is declared HERE and re-exported from `types.ts`, which is why every
// existing `import type { WorkKind } from "./types"` still reads the same. It
// cannot be declared there: this file imports that one, so `keyof typeof
// CATALOGUE` written in `types.ts` would close a cycle.
const ROWS = {
  // --- subsistence / civic: free, self-raising, and the reason a sacked town
  //     survives. They appear on their own as the town warrants them.
  dwellings: { label: "dwellings", cls: "subsistence", cost: 0, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "shelter", servesFor: 40, max: 99, zone: "lowerTown", autoPer: 40 },
  gardenPlots: { label: "garden plots", cls: "subsistence", cost: 0, produces: "food", needsGround: null,
    food: 30, trade: 0, defence: 0, hands: 6, serves: "food", servesFor: 30, max: 4, zone: "beyondThePale", autoPer: 40 },
  // A FISHING SHACK'S CATCH MOVED COLUMNS WITH THE KEYING, and this is the one
  // row in the catalogue where §2.12.13 forced a number to move (KAN-126).
  //
  // It carried `food: 22, trade: 2`. Under the old keying its `exports` was
  // `null`, so those two were paid as a CUT OF THE TRAFFIC — a customs house's
  // wage, at no price and to no buyer, for a hut the hamlet floor draws up on
  // the sand for nothing. Fish is victuals. The two RETIRE WITH THE MECHANISM
  // THAT PAID THEM, exactly as "the shipways stand idle for want of planks"
  // retired with the dependency edge (§2.12.13), and they are not folded into
  // `food` instead: the food column is what the catch FEEDS, `servesFor: 22`
  // has always agreed with it, and nothing ever said a shack fed twenty-four.
  //
  // WHAT IT COST, MEASURED, BECAUSE IT IS NOT NOISE. KAN-131 put `quaysideOf`
  // at 58% of all trade income in the world and warned that anything crossing
  // that line moves a lever out of proportion to its size. These two were
  // 893.92 of the world's 6,169.86 a season across four warm worlds — 14.5% of
  // ALL trade income, paid to the one work nobody ever decides to have.
  //
  // AND LEAVING THE 2 IN `trade` WOULD HAVE BEEN A LIVE BUG rather than a
  // leftover. `commerceOf` scales the harvest into the materials and luxury
  // columns by hand because the victuals column arrives already scaled — so a
  // victuals `trade` figure is the one number a storm could not touch. A storm
  // would have spoiled a town's bread and left its FISH untouched. The column
  // rule prevents it by construction, which is why it is a rule and not a note.
  fishingShacks: { label: "fishing shacks", cls: "subsistence", cost: 0, produces: "fish", needsGround: null,
    food: 22, trade: 0, defence: 0, hands: 4, serves: "food", servesFor: 22, max: 3, zone: "waterfront", autoPer: 50 },
  well: { label: "a well", cls: "subsistence", cost: 0, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 0, hands: 0, serves: "order", servesFor: 30, max: 1, zone: "plaza" },
  chapel: { label: "a chapel", cls: "subsistence", cost: 0, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 0, hands: 1, serves: "worship", servesFor: 60, max: 1, zone: "lowerTown" },
  // A MARKET IS THE LAST FREE WORK WITH A `trade` COLUMN, and after KAN-126
  // retired the fishing shack's it was the largest one left: measured at day 0
  // across four warm worlds, the stalls a place raises for nothing at sixty
  // souls drew 274.89 of the world's 1,475.84 quayside cut — 19% of it, paid to
  // a work nobody decides to have. It is NOT the shack's bug a second time, and
  // the difference is the whole of KAN-132: since the cut became a share of what
  // crosses, a market in a hamlet where nothing crosses earns nothing, and the 3
  // is what it may take of the trade that does pass. A free work may hold a
  // capacity; what it must never hold is a wage.
  market: { label: "a market", cls: "subsistence", cost: 0, produces: null, needsGround: null,
    food: 0, trade: 3, defence: 0, hands: 2, serves: null, servesFor: 0, max: 1, zone: "lowerTown" },

  // --- THE FIVE FOCUS EXPRESSIONS: what a production focus on this ground IS.
  //     `max: Infinity` is KAN-125's tuning answer, and the argument is in
  //     `FOCUS_EXPRESSIONS` below.
  sawpit: { label: "sawpits", cls: "capital", cost: 260, produces: "timber", needsGround: null,
    food: 0, trade: 14, defence: 0, hands: 10, serves: null, servesFor: 0, max: Infinity, zone: "beyondThePale" },
  caneField: { label: "cane fields", cls: "capital", cost: 220, produces: "cane", needsGround: null,
    food: 0, trade: 10, defence: 0, hands: 16, serves: null, servesFor: 0, max: Infinity, zone: "beyondThePale" },
  provisionGround: { label: "provision grounds", cls: "capital", cost: 180, produces: "food", needsGround: null,
    food: 90, trade: 0, defence: 0, hands: 18, serves: "food", servesFor: 90, max: Infinity, zone: "beyondThePale" },
  //
  //     GRAIN FIELDS ARE A `food` WORK AND COTTON WALKS ARE A `trade` ONE,
  //     because §2.12.13 moved the KEYING and not the columns: victuals are
  //     counted in `food`, materials and luxury in `trade`.
  //
  //     WHY GRAIN FIELDS FEED LESS PER ACRE THAN PROVISION GROUNDS, which is the
  //     tuning question the spec leaves open and the one number here anybody
  //     will want an argument for. It is true of the crops and it is what the
  //     measurement wanted, in that order:
  //
  //     * PROVISION GROUNDS OUT-FEED GRAIN ACRE FOR ACRE. Cassava, plantain and
  //       yam keep far more mouths off the same ground than wheat or maize, and
  //       that is why the Caribbean grew provisions and imported flour. What
  //       grain has over them is that it KEEPS and it SHIPS.
  //     * AND THE GROUND PAYS THE DIFFERENCE BACK, which is the point of the
  //       whole story. A grain field only ever stands where the ground is MADE
  //       for grain, so it is minted at `SUIT_YIELD.ideal` (1.3); provision
  //       grounds stood on tilled ground that merely tolerated food, at `fair`
  //       (0.7). `50 x 1.3 = 65` against `90 x 0.7 = 63` — the same bread off
  //       the same acre, arrived at from the other end. THE CATALOGUE NUMBER IS
  //       THE CROP; THE SUIT IS THE GROUND.
  //
  //     Measured on four warm worlds: with grain at the clone's 90 the day-0
  //     population spread ran 8 / 80 / 2,331 souls, which puts [HC-87]'s
  //     trade-fed 1,500 in the MIDDLE of a band it is supposed to top. At 50 it
  //     runs 8 / 89 / 1,518 against a ratified 10 / 90 / 1,200, and the 1,500 is
  //     reached by the largest port on one seed of four — the top of the band,
  //     which is where [HC-87] puts it.
  grainFields: { label: "grain fields", cls: "capital", cost: 180, produces: "grain", needsGround: null,
    food: 50, trade: 0, defence: 0, hands: 18, serves: "food", servesFor: 50, max: Infinity, zone: "beyondThePale" },
  //     COTTON IS THE LESSER OF THE TWO LUXURIES AND THE HARDER WORK. Sugar was
  //     king; cotton pays less per acre and wants nearly as many hands to pick
  //     it, so it costs more per unit shipped than cane does (29 against 22) and
  //     fetches less. It is still the only thing cotton ground has ever been
  //     able to become.
  cottonWalk: { label: "cotton walks", cls: "capital", cost: 200, produces: "cotton", needsGround: null,
    food: 0, trade: 7, defence: 0, hands: 14, serves: null, servesFor: 0, max: Infinity, zone: "beyondThePale" },

  // --- THE EIGHT THE GOVERNOR WEIGHS AGAINST EACH OTHER. Every one of them
  //     stands on NAMED ground or on none at all, never on what the ground
  //     bears — which is why none of them is ever gated on what a region is FOR.
  //
  //     THERE IS NO `boilingHouse` HERE. It was deleted and folded into DEPTH —
  //     a deepened cane region carries its luxury, and the label ladder at the
  //     foot of this file is what says so.
  //
  //     `shipway` IS A HARBOUR WORK NOW, in the family of the warehouse and the
  //     customs house: a town with sheltered water may build ships there, and it
  //     no longer needs a sawpit standing first, because that was the chain.
  //     Two live consequences, both deliberate: it has no produce, so it has no
  //     cargo class and earns its cut of the traffic on `access` alone
  //     (§2.12.13); and it therefore LOSES the materials exemption, so you do
  //     need planks to lay down a shipway. That is the better fiction anyway,
  //     and it is the only half of the old chain worth keeping.
  shipway: { label: "shipways", cls: "capital", cost: 900, produces: null, needsGround: "roadstead",
    food: 0, trade: 34, defence: 0, hands: 20, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  warehouse: { label: "a warehouse", cls: "capital", cost: 320, produces: null, needsGround: "roadstead",
    food: 0, trade: 12, defence: 0, hands: 6, serves: null, servesFor: 0, max: 9, zone: "waterfront" },
  customsHouse: { label: "a customs house", cls: "capital", cost: 480, produces: null, needsGround: "roadstead",
    food: 0, trade: 16, defence: 0, hands: 6, serves: "order", servesFor: 60, max: 1, zone: "waterfront" },
  battery: { label: "a stone battery", cls: "capital", cost: 620, produces: null, needsGround: "bluff",
    food: 0, trade: 0, defence: 9, hands: 12, serves: null, servesFor: 0, max: 9, zone: "outworks" },
  palisade: { label: "a palisade", cls: "capital", cost: 240, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 4, hands: 2, serves: null, servesFor: 0, max: 1, zone: "outworks" },
  barracks: { label: "a barracks", cls: "capital", cost: 420, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 5, hands: 10, serves: "order", servesFor: 80, max: 1, zone: "backTown" },
  tavern: { label: "a tavern", cls: "capital", cost: 200, produces: null, needsGround: null,
    food: 0, trade: 4, defence: 0, hands: 4, serves: "drink", servesFor: 70, max: 2, zone: "lowerTown" },
  church: { label: "a church", cls: "capital", cost: 550, produces: null, needsGround: null,
    food: 0, trade: 0, defence: 0, hands: 3, serves: "worship", servesFor: 200, max: 1, zone: "plaza" },
} satisfies Record<string, WorkDef>;

// [HC-91], and this line is the whole of KAN-135: the type is GENERATED from the
// table, never written beside it.
export type WorkKind = keyof typeof ROWS;

// The same object, under the type it has always had. See the note above the
// table for why both bindings are here and what each one checks.
export const CATALOGUE: Record<WorkKind, WorkDef> = ROWS;

// ---- Who is on the menu, and who is the ground itself (§2.12.12) -----------
//
// A FOCUS EXPRESSION IS A CAPITAL WORK THAT STANDS ON WHAT THE GROUND BEARS,
// and that sentence is the whole definition — read off the catalogue's own
// columns rather than listed beside it ([P-47]), because `produces` already
// answers it and a second list would be the half that gets forgotten the day
// somebody adds a quarry.
//
// THE WORK SURVIVES; THE MENU CHOICE DIES. Sawpits, cane fields and provision
// grounds are still raised, still priced, still gated on coin, hands and
// materials, and still rot. What they are no longer is a thing a governor picks
// off a list: they are what a production focus on that ground IS, and a
// DEEPENING raises the work the region's best-borne produce implies.
export const isFocusExpression = (kind: WorkKind): boolean =>
  CATALOGUE[kind].cls === "capital" && CATALOGUE[kind].produces !== null;

export const CAPITAL = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "capital");
export const SUBSISTENCE = (Object.keys(CATALOGUE) as WorkKind[]).filter((k) => CATALOGUE[k].cls === "subsistence");

// WHAT THE AUCTION MAY OFFER — eight, down from twelve, and the count is the
// point: the catalogue can now grow without the choice growing with it.
export const CHOOSABLE = CAPITAL.filter((k) => !isFocusExpression(k));

// ...and the three it may not. Their cap is the region's own area and NOTHING
// ELSE — `max` is `Infinity` on every one of them, which is KAN-125's answer to
// a question the ticket asked out loud:
//
//   `CATALOGUE[kind].max = 9` is a PER-KIND, PER-TOWN number, and after KAN-124
//   every depth-9 region on the warm world hit it rather than running out of
//   hexes. So a per-town limit was standing in front of a per-region rule.
//   [HC-94] says the cap is AREA — the founding roll's own variance — and a
//   second cap beside it is a second source for one fact, which [P-47] forbids
//   and which §2.12.5 already refused in the same words for the depth premium.
//   A menu item legitimately has a per-town limit, because "how many taverns is
//   too many" is a question about the TOWN. "How many sawpits" is a question
//   about the HILLS, and the hills already answer it.
export const FOCUS_EXPRESSIONS = CAPITAL.filter(isFocusExpression);

// ---- Raising a work --------------------------------------------------------

export const countOf = (t: Town, kind: WorkKind) => t.works.filter((w) => w.kind === kind && w.condition !== "ruin").length;

// The regions that could carry this work, best ground first. A CROP work is
// offered wherever the ground bears its produce at ANY grade — terrain biases,
// it does not determine. A SITED work needs its ground exactly.
export function regionsFor(town: Town, kind: WorkKind): { region: Region; suit: Suit | null }[] {
  const def = CATALOGUE[kind];
  const out: { region: Region; suit: Suit | null }[] = [];
  for (const r of town.regions) {
    if (isDead(r.terrain)) continue;
    if (def.needsGround) {
      if (r.terrain === def.needsGround) out.push({ region: r, suit: null });
    } else if (def.produces) {
      const suit = r.bears[def.produces];
      if (suit) out.push({ region: r, suit });
    }
  }
  return out.sort((a, b) => SUIT_RANK[b.suit ?? "fair"] - SUIT_RANK[a.suit ?? "fair"]);
}

// ---- [HC-94] A focus buys CAPACITY, never a multiplier ---------------------
//
// TWO VERBS PUT A WORK ON A REGION, AND THE ONLY THING THAT DIFFERS BETWEEN THEM
// IS WHAT THE GROUND ALLOWS. That is the whole of §2.12.4 in code, and it is
// deliberately not two rules:
//
//   raise  — the five-term auction scores a KIND on FREE ground (§5.1), which is
//            only legitimate while the ground IS free. So it may put the FIRST
//            work on a region and no more: "there is timber over the ridge; they
//            take what they need of it", and it never becomes an industry.
//   deepen — ground somebody has GIVEN OVER to production may be worked to its
//            free area. The cap is not a separate number — it is the ground.
//
// AND SINCE KAN-125 THE DEEPENING IS ALSO WHAT STARTS A REGION, which is the
// half of story 4 that nobody had written down. The three works that stand on
// what the ground bears left the menu (§2.12.12), so the auction has nothing
// left to offer that the token cap could bind — measured before the change, 260
// of 369 production-focused regions on four warm worlds were FOCUSED AND EMPTY,
// because the auction's ranking and `def.max` never reached them. Ground given
// over now gets its first work from the focus that named it, which is the only
// arrangement in which the two halves of this story are safe to ship together.
//
// THE TOKEN CAP IS WITHDRAWN (human, 2026-09-21, to be revisited).
// §2.12.4 used to ratify "unfocused, a region's depth caps at a token work" — a
// hamlet taking what timber it needs off a ridge nobody had declared a timber
// region. KAN-125 took every work that stands on what the ground bears off the
// governor's menu, so the only producer the rule ever had was gone and the cap
// was enforced but unreachable.
//
// The ruling: GROUND DOES NOTHING UNTIL SOMEBODY DECIDES ABOUT IT. That is the
// cleaner story, it sharpens what a focus means, and a town's slow accumulation
// is now supposed to come from TRADE rather than from odds and ends of
// undecided land (the 450-600 target was withdrawn the same day).
//
// What a town still gets off undecided ground is its subsistence — garden plots,
// fishing shacks, houses — which were never gated on any of this ([HC-98]).
//
// So the focused-to-unfocused ratio is AREA, the founding roll's own variance,
// and NOTHING ANYWHERE MULTIPLIES A YIELD BECAUSE A FOCUS WAS SET. The second of
// §2.12.4's two objections is the one to hold on to: a work stores its scaled
// yields AT THE MOMENT IT IS RAISED, so a focus flipped later could not re-price
// what already stands — a dial true of new rows and false of old ones is worse
// than no dial.
export type Verb = "raise" | "deepen";

// The token allowance. KEPT DELIBERATELY after the rule above was withdrawn,
// and the reason is worth reading before anyone deletes it.
//
// The withdrawal changed the SPEC and not the behaviour, because the behaviour
// already matched: `wants()` walks `CHOOSABLE`, which excludes every focus
// expression, so no governor has been able to reach this path since KAN-125.
// What still comes through it is `raise(town, kind, day)` called DIRECTLY —
// which in this repo means test fixtures putting a first sawpit on the ground
// to set a scene up.
//
// So this constant's only remaining consumer is the suite. That is a smell and
// it is flagged for the revisit rather than tidied now: making the fixtures go
// through a focus and a deepening is a test refactor, not this decision.

// [HC-93] A REGION'S DEPTH IS COUNTED, NEVER STORED. There is no development
// integer, no level, no tier: the filter below over ~20 ledger lines is the
// cheapest thing in the module and it is load-bearing, because a stored depth is
// exactly a derived quantity free to drift from the works that explain it
// ([HC-14]) — and it would have no lumber mill in it to see (§7).
//
// WHAT IS COUNTED IS A WORK SOMEBODY CHOSE FOR THIS GROUND: a capital work that
// stands on what the region BEARS. Two exclusions, each for its own reason:
//
//  * SUBSISTENCE WORKS ([HC-98], and its second edge found by KAN-123). A garden
//    plot raises itself on any ground the town holds, is never chosen, never
//    priced and never gated — so it claims no purpose for the ground under it.
//    Counted here, it would spend a region's token allowance before any governor
//    ever looked at it.
//  * SITED WORKS (§2.12.12). A quay, a battery and a customs house stand on named
//    ground rather than on what the ground bears; they survive the collapse
//    untouched and stay gated on ground, coin, hands and materials — never on
//    what a region is FOR. No land use makes a town safer.
export function depthOf(town: Town, index: number): number {
  let n = 0;
  for (let i = 0; i < town.works.length; i++) {
    const w = town.works[i];
    if (w.region !== index || w.condition === "ruin") continue;
    if (isFocusExpression(w.kind)) n++;
  }
  return n;
}

// HOW MANY MORE OF THIS WORK THE GROUND WILL TAKE, by this verb. `free` is the
// region's own capacity, already net of the footprint and of everything standing
// on it, so it is passed in rather than asked for again ([P-47], [P-18]).
//
// IT ANSWERS "HOW MANY MORE" AND NOT "HOW DEEP", and the difference is KAN-134's.
// It used to return a cap on DEPTH and leave the caller to subtract what already
// stood there — which was only correct while `capacityOf` was blind to the works.
// Now that capacity counts them, subtracting the depth as well would charge the
// same sawpits twice.
//
//   raise  — the token allowance, less what already stands: a hamlet takes what
//            timber it needs off the ridge and it never becomes an industry.
//   deepen — ground somebody GAVE OVER may be worked to its free capacity. The
//            cap is not a separate number; it is the ground.
function moreAllowed(town: Town, r: Region, index: number, verb: Verb, free: number): number {
  if (verb === "raise") return TOKEN_DEPTH - depthOf(town, index);
  return r.focus === "production" ? free : 0;
}

const TOKEN_DEPTH = 1;

// WHAT THIS REGION WILL STILL TAKE OF THIS WORK, by this verb. ONE FUNCTION
// ([P-47]): the score that says "there is room for more", the gate that refuses a
// deepening and the mint that puts the work on the ground all ask this, so they
// cannot drift apart.
export function roomInRegion(
  town: Town,
  r: Region,
  index: number,
  kind: WorkKind,
  verb: Verb,
  taken: Set<string>,
): number {
  // ONE PATH TO THE FREE GROUND ([P-47]). This used to count the free hexes with
  // a loop of its own while `capacityOf` counted them a different way, and the
  // two answers differed by exactly the works standing on the region — which is
  // the whole of KAN-134.
  const free = capacityOf(town, r, taken);
  // Outside the capacity rule entirely: a subsistence work ([HC-98]) and a sited
  // work (§2.12.12) both stand on ground whose purpose is not in question. THE
  // FILTER IS "A CAPITAL WORK STANDING ON WHAT THE GROUND BEARS" AND NOT "ANY
  // CAPITAL WORK ON THE REGION" — written the loose way, a roadstead would carry
  // a warehouse OR a customs house OR a shipway, because all three would be
  // spending one region's token allowance between them.
  if (!isFocusExpression(kind)) return verb === "raise" ? free : 0;
  const room = moreAllowed(town, r, index, verb, free);
  return free < room ? free : room < 0 ? 0 : room;
}

// How much ground is left for this work, as the AUCTION asks it. AREA IS
// CAPACITY — and the town eating its own land is what makes growth cost
// something. A deepening never comes through here: it names one region and asks
// `roomInRegion` about that one ([HC-97]).
export function roomFor(town: Town, kind: WorkKind): number {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return Math.max(0, def.max - countOf(town, kind)); // a civic work
  const taken = takenHexes(town);
  let free = 0;
  for (const { region } of regionsFor(town, kind)) {
    free += roomInRegion(town, region, town.regions.indexOf(region), kind, "raise", taken);
  }
  return Math.min(free, Math.max(0, def.max - countOf(town, kind)));
}

// Can it be raised at all? GROUND, AND NOTHING ELSE NOW — wealth is the budget
// gate and is checked separately by the governor, never mixed into whether a
// town wants it, and the supplier gate went with the chain it expressed.
export const buildable = (town: Town, kind: WorkKind): boolean => roomFor(town, kind) > 0;

export interface Ground {
  hex: Axial;
  region: Region;
  index: number; // the region's index on the town, which is what a Work stores
  suit: Suit | null;
}

// WHERE IN THIS REGION the work would stand: the sweet spot if it is still open
// — which is why the boiling house stands where it does — and otherwise the
// first ground free of the town and of anything already on it.
export function groundIn(r: Region, index: number, kind: WorkKind, taken: Set<string>): Ground | null {
  const def = CATALOGUE[kind];
  const free = r.hexes.filter((h) => !taken.has(key(h)));
  if (!free.length) return null;
  const sweet = r.sweetSpot && free.find((h) => key(h) === key(r.sweetSpot!));
  const suit = def.needsGround ? null : def.produces ? (r.bears[def.produces] ?? null) : null;
  return { hex: sweet ?? free[0], region: r, index, suit };
}

// The best free ground for this work, as the AUCTION asks it: the best-suited
// region that will still take one. Ground a work already stands on is not free
// ground and the auction may not have it — that region is an INSTANCE now, and
// deciding anything more about it is a deepening ([HC-97]).
export function groundFor(town: Town, kind: WorkKind): Ground | null {
  const def = CATALOGUE[kind];
  if (!def.produces && !def.needsGround) return null;
  const taken = takenHexes(town);
  for (const { region } of regionsFor(town, kind)) {
    const index = town.regions.indexOf(region);
    if (roomInRegion(town, region, index, kind, "raise", taken) <= 0) continue;
    const ground = groundIn(region, index, kind, taken);
    if (ground) return ground;
  }
  return null;
}

// WHAT THE GROUND COSTS, scaled by the same `q` as what the ground gives.
//
// A SUBSISTENCE WORK'S HANDS SCALE WITH ITS YIELD (ratified 2026-09-15), and the
// bug it closes is stated most simply as an omission: `raise` already scaled the
// four numbers the ground GIVES — food, trade, defence, servesFor — and left the
// one number the ground COSTS flat. So a garden plot on `poor` ground fed 10.5
// mouths and still wanted six men, which is 10.91 souls at `labourShare`. A place
// with nothing but poor food ground therefore could not sustain the hands that
// worked its own food: each step down idled another plot and it cascaded, 163
// souls to nothing in about forty years by ordinary decline — [HC-18] violated,
// and live in a shipped world once the weather reached the ledger.
//
// The rule, in one sentence: A SUBSISTENCE WORK IS MANNED TO THE SIZE THE GROUND
// WILL REPAY, AND NEVER BEYOND ITS OWN SIZE. `min(q, 1)`, and the asymmetry is
// the whole of it:
//
// * BELOW 1 the ground can make the work not worth doing in full, and nobody digs
//   a field that eats more than it grows — that is what subsistence MEANS. Six men
//   on ground that repays a third of six men's bread is three men and a smaller
//   patch. So the mouths-per-soul-of-labour ratio, `food · labourShare / hands`,
//   comes out INDEPENDENT of the ground at or below the grade the catalogue is
//   written for: `food·q·λ / (hands·q) = food·λ / hands`.
// * ABOVE 1 it does NOT scale, because good ground does not take more men — it
//   repays the same men better. That is already what the yield half says, and it
//   is §2.5's ratified line read the right way round: terrain BIASES a crop, it
//   does not determine how many hands a plot has.
//
// THE ASYMMETRY IS ALSO THE SAFETY ARGUMENT, and it is worth stating as one:
// `min(q, 1) <= 1`, so this change can only ever ask FEWER men of a work than the
// shipped catalogue did — never more. **No place's manning threshold can rise**,
// so no place that stands today can be pushed under by this.
//
// That safety matters more than it looks, and it was MEASURED rather than
// reasoned: an unclamped `q` scaled hands UP on ideal ground (six men to 7.8), and
// three places across five seeds that stand today emptied instead — because a
// storm-battered place lives near the bottom of its margin, not at the top of it,
// and the margin on good ground is where almost every place actually lives.
//
// TWO THINGS DELIBERATELY NOT DONE HERE:
//
// * CAPITAL WORKS KEEP A FLAT HAND COST. The hamlet floor is made of subsistence
//   works and only of them ([HC-67]): they are free, self-raising, never rot, and
//   nobody ever DECIDES to have one, so a subsistence work that cannot pay its own
//   wages is a spiral with no brake. A capital work is a priced decision; one that
//   cannot pay for itself on bad ground is the correct disincentive and the
//   governor's problem (§5.6, "he will not raise what nobody can work"), and it
//   cannot empty a place — it rots to `ruin` and the subsistence floor catches the
//   town. Scaling it would also flatten the reason a governor prefers good ground
//   and would silently falsify the auction's `def.hands <= spare` preview, which
//   reads the CATALOGUE rather than the instance ([P-47]).
// * THE FAR-GROUND `Math.ceil` IS NOT APPLIED to a scaled cost. Rounding up can
//   only ever RAISE the cost, which is the one thing this function must not do — a
//   plot worth 2.41 men charged for 3 loses a quarter of its margin. Hands are
//   compared against `population · labourShare`, a float in a model whose
//   population is a float, so nothing wanted a whole number here except habit.
const handsOn = (def: WorkDef, q: number, far: boolean): number => {
  const walk = far ? WORKS.farHands : 1; // men must still walk to it
  if (def.cls !== "subsistence") return far ? Math.ceil(def.hands * walk) : def.hands;
  return def.hands * Math.min(q, 1) * walk;
};

// RISING RETURNS, AND THEY RISE WITH DEPTH (§2.12.5). The Nth work on a region
// is worth more than the first — a second sawpit shares a track, a pond and a
// crew; a fifth is a works, with yards. The curve's SHAPE is a tuning table
// ([HC-90]); what the spec fixes is that it rises, that it is minted at raise
// time, and that AREA IS ITS CEILING.
//
// THE CAP IS NOT IN HERE AND MUST NOT BE, and that is the point of `[HC-75]`.
// Unbounded rising returns are an overshoot engine — more works, more yield,
// more growth, more works — and "no place oscillates with growing amplitude
// across two hundred years" is a named acceptance test. The premium runs out of
// GROUND before it runs out of anything else, because `roomInRegion` will not
// give it a hex to stand on past the region's free area, so the loop terminates
// on the founding roll rather than on a constant. A second clamp here would be a
// separate number doing the same job, which §2.12.5 refuses outright.
export const depthPremium = (depth: number): number => 1 + depth * WORKS.premiumPerDepth;

// Mint a work on a named hex, scaled by how well that ground suits it. Ground
// that was made for a crop is worth more of it; ground that merely grudges it
// pays a fraction — which is adaptability with a visible price.
//
// `onRegion` IS THE DEEPENING'S OWN DOOR, and it is the only difference between
// the two verbs at the mint. Without it a work goes where the auction's best
// FREE ground is; with it, on the region a governor named and scored from that
// region's own ground ([HC-97]). Everything below — the scaling, the premium,
// the ledger line — is one path, so the two verbs can never mint differently.
export function raise(town: Town, kind: WorkKind, day: number, onRegion: Region | null = null): Work | null {
  const def = CATALOGUE[kind];
  // The MENU's own limit, and it is `Infinity` on a focus expression, whose cap
  // is the region's area and nothing else ([HC-94]).
  if (countOf(town, kind) >= def.max) return null;
  const taken = takenHexes(town);
  let ground: Ground | null;
  if (onRegion === null) {
    if (!buildable(town, kind)) return null;
    ground = groundFor(town, kind);
  } else {
    const index = town.regions.indexOf(onRegion);
    ground = roomInRegion(town, onRegion, index, kind, "deepen", taken) > 0
      ? groundIn(onRegion, index, kind, taken)
      : null;
    if (!ground) return null;
  }
  if ((def.produces || def.needsGround) && !ground) return null;
  let q = ground?.suit ? SUIT_YIELD[ground.suit] : 1;
  if (ground && ground.region.sweetSpot && ground.hex && key(ground.hex) === key(ground.region.sweetSpot)) {
    q *= WORKS.sweetSpotBonus; // the best of it
  }
  const far = ground?.region.reach === "far";
  if (far) q *= WORKS.farPenalty; // ground over the ridge yields a little less...
  // ...and a work that joins others of its own kind on the same ground is worth
  // more than the first was. It is minted HERE, into the new line, exactly as
  // suitability and reach are — and the works already standing are never
  // touched, so if the fifth burns, the YARDS are what the town lost.
  if (ground && def.cls === "capital" && def.produces !== null) q *= depthPremium(depthOf(town, ground.index));

  const work: Work = {
    id: town.nextWorkId++,
    // A wall goes up landward first: it freezes the town's boundary AS IT THEN
    // STANDS, and is never re-extended. A hex claimed later, outside it, is the
    // faubourg.
    circuit: kind === "palisade" ? town.footprint.claimed.map((h) => ({ ...h })) : undefined,
    kind,
    name: def.label,
    region: ground ? ground.index : null,
    hex: ground ? ground.hex : null,
    sinceDay: day,
    condition: "working",
    idleSinceDay: null,
    food: def.food * q,
    trade: def.trade * q,
    defence: def.defence * q,
    hands: handsOn(def, q, far),
    serves: def.serves,
    servesFor: def.servesFor * q,
  };
  town.works.push(work);
  return work;
}

// ---- The ledger's own upkeep ----------------------------------------------
// Run every season, before anything reads the ledger.

// THE DAY ARRIVES AS AN ARGUMENT and is never fetched. `stepWorks(town, year)`
// already had this shape before KAN-107 — all that changed is that the number it
// takes is now the world's own integer rather than a year read off a private
// counter, so the same argument now serves the chronicle AND the decay clock.
export function stepWorks(town: Town, day: number): void {
  raiseSubsistence(town, day);
  allocateLabour(town, day);
  devolve(town, day);
}

// People house and feed themselves without being told to, and without spending a
// coin of the town's wealth. This IS the hamlet floor.
function raiseSubsistence(town: Town, day: number): void {
  for (const kind of SUBSISTENCE) {
    const def = CATALOGUE[kind];
    const want = def.autoPer
      ? Math.ceil(town.population / def.autoPer) // scales with the town
      : town.population >= (WORKS.subsistenceAt[kind] ?? 0)
        ? 1 // ...or simply appears once the place is big enough to warrant it
        : 0;
    while (countOf(town, kind) < want && roomFor(town, kind) > 0) raise(town, kind, day);
  }
}

// Feed the town first, then defend it, then earn — a governor's order of nature.
// HOISTED OUT OF THE ALLOCATOR ([P-48]): the same order decides who gets the last
// hands and which rotting work gets mended first, so it is one function rather
// than two that happen to agree today ([P-47]).
export const worthOf = (w: Work): number => w.food * 3 + w.defence * 2 + w.trade;

// Everything except hands that stands between a work and working again — which
// is now ONE THING, the ground under it. ALSO HOISTED OUT OF THE ALLOCATOR'S
// LOOP CONDITION ([P-48]) — a governor must read exactly this rule before he
// pays to mend anything, or he buys back a sawpit the town has built over, and
// buys it again every few years for ever (§5.6).
//
// THE SUPPLIER TEST IS GONE WITH THE EDGE IT READ. It said "the shipways stand
// idle for want of planks", and §2.12.13 is explicit that deleting the edge
// deletes the sentence: it is RETIRED WITH ITS MECHANISM rather than preserved,
// and what argues in its place is the market term arguing in coin — "timber
// fetches well here" — which §3.5.4 already ratified. Saying so here is the
// honest version; a survivor faked out of a different mechanism would not be.
function workableNow(town: Town, w: Work): boolean {
  // Ground the town has built over carries nothing any more, and CLAIMED GROUND
  // IS PERMANENT — so this one is not a setback, it is the end of that work.
  return !(w.hex && town.footprint.claimed.some((c) => key(c) === key(w.hex!)));
}

// Hands are finite. A work nobody can man goes idle — the labour ceiling made
// visible rather than asserted ("there is money and no men").
//
// `decayed` is deliberately absent from the set hands are allotted to, and it is
// not an oversight: a rotted work must be PUT BACK IN ORDER before anyone can
// work it, and that is a priced decision, so it belongs to the governor and not
// to the ledger's own upkeep. See `mendable` below.
function allocateLabour(town: Town, day: number): void {
  const live = town.works.filter((w) => w.condition === "working" || w.condition === "idle");
  // [P-10]: an explicit tie-break, and its direction is the ELDER WORK FIRST —
  // the sawpits that have stood since '54 keep their men before the ones cut
  // last spring. Without it, two works of equal worth are ordered by however the
  // ledger happens to be arranged.
  live.sort((a, b) => worthOf(b) - worthOf(a) || a.id - b.id);

  let hands = town.population * WORKS.labourShare;
  for (const w of live) {
    if (hands >= w.hands && workableNow(town, w)) {
      hands -= w.hands;
      if (w.condition === "idle") w.condition = "working";
      w.idleSinceDay = null;
    } else if (w.condition === "working") {
      w.condition = "idle";
      w.idleSinceDay = day;
    }
  }
}

// ---- Coming back UP the ladder ---------------------------------------------
//
// THE GRADES DIFFER IN WHAT COMING BACK COSTS, never in whether it is possible
// (spec §3: "each step is legible and each is reversible").
//
//   idle    -> working   the hands return. Free, instant, and the allocator above
//                        does it without anyone deciding anything.
//   decayed -> idle      ONE RUNG, and it costs COIN. A capital work "needs money
//                        or a patron" to be saved exactly as it did to be raised;
//                        the hands then decide the last step like any other idle
//                        work. Priced, so the decision is the governor's.
//   ruin    -> nothing   past saving is past saving.
//
// Until KAN-108 this was a comment and not a mechanism: `decayed` was in no set
// anyone allotted hands to, so its idle clock was never cleared and every decayed
// work was guaranteed to reach `ruin`. Four rungs, and only the first of the three
// below `working` could be climbed.

// What it costs to put a rotted work back in order. ONE PATH TO THE NUMBER
// ([P-47]): the gate that asks whether he can afford it and the charge that takes
// the coin are the same call, so they cannot drift apart.
export const repairCost = (kind: WorkKind): number => CATALOGUE[kind].cost * DECAY.repairShare;

// Is this work worth a governor's coin? Only if mending it would actually put it
// back to work: `ruin` never returns, and neither does a work whose supplier is
// gone or whose ground the town has built over. Wealth is NOT asked about here —
// it is the budget gate (§5.1) and it is asked separately, by the governor.
export const mendable = (town: Town, w: Work): boolean =>
  w.condition === "decayed" && workableNow(town, w);

// ---- The weather coming down the same ladder --------------------------------
//
// [HC-6] DAMAGE IS AN EVENT AND APPLIES THE DAY IT HAPPENS. It is the other half
// of the weather's two output paths, and the two must not be mixed: the yield a
// storm spoils waits for the season's books, the shed it knocks down does not.
//
// [HC-34] Damage moves works down the EXISTING ladder, one grade at a time, and
//         it never skips to ruin. So a drop stops at `decayed`: the only thing
//         that ever writes `ruin` from the weather is the extreme tail below,
//         which is capped at one work. Ordinary neglect still carries a decayed
//         work the last rung, on the clock `devolve` keeps.
// [HC-35] The extreme tail destroys exactly ONE work PER CONTACT, never a sweep.
//         Razing is deliberate and wholesale; the storm is random and singular —
//         a town can lose its quay to the sea, it cannot lose its town to it.
//
// KAN-108 made the ladder two-way, and that interaction is the point rather than
// a side effect: a work the weather knocks down is at worst `decayed`, so it has
// a repair path and a governor who can pay for it. A work the sea DESTROYS is a
// `ruin` and `mendable` refuses it. That is the whole difference between damage
// and destruction, stated in the two conditions rather than in prose.

// One rung down, and the idle clock restarts at the new grade — it has been idle
// since the storm, not since whenever it last wanted hands.
function dropOne(w: Work, day: number): void {
  w.condition = w.condition === "working" ? "idle" : "decayed";
  w.idleSinceDay = day;
}

// [HC-72]'s "damage events on named works" row. WHICH work is the one question
// the sampled severity cannot answer, so it is answered by a derived roll and a
// fixed walk: the sea takes what it finds, and then what stands next to it on
// the ledger. Works are appended and never spliced, so the ledger's order is id
// order — a total order with an explicit direction ([P-10]), and one that cannot
// depend on how the world walked its places.
//
// Ruins are skipped because there is nothing left to take, and a decayed work is
// skipped by a DROP for the same reason: the rung below it is `ruin`, and the
// weather does not write that except through the tail.
export function damageWorks(town: Town, dropped: number, destroyed: number, pick: number, day: number): void {
  const n = town.works.length;
  if (n === 0) return;
  let at = Math.floor(pick * n);
  if (at >= n) at = n - 1; // a roll is [0, 1), but never read past `length` ([P-31])
  // [HC-35], as a clamp rather than a trust — and in ONE place, so mutating it
  // actually sweeps. It was written twice at first, here and again in the loop
  // body, and a rule stated twice is a rule no test can break ([P-1]).
  let toDestroy = destroyed > 0 ? 1 : 0;
  let toDrop = dropped;
  for (let step = 0; step < n && (toDestroy > 0 || toDrop > 0); step++) {
    const w = town.works[(at + step) % n];
    if (w.condition === "ruin") continue;
    if (toDestroy > 0) {
      w.condition = "ruin";
      w.idleSinceDay = day;
      toDestroy--;
      continue;
    }
    if (w.condition === "decayed") continue;
    dropOne(w, day);
    toDrop--;
  }
}

// ---- What came off the ground this season ----------------------------------

// [HC-6]'s MODIFIER half, as ONE number with ONE definition ([P-47]). Everything
// that counts a season's harvest — the food a place grew, the cargo it sends to
// the quay, the mouths it can therefore feed — reads the share here, so none of
// them can be scaled while another is not.
//
// At `harvestLoss` of nothing this is exactly 1, and multiplying a double by 1 is
// exact, so a place no weather has touched books the identical harvest it booked
// before this existed.
export const harvestShare = (town: Town): number => 1 - town.harvestLoss;

// The devolution ladder going DOWN: working -> idle -> decayed -> ruin.
// Subsistence works never rot — people keep their own roofs on.
function devolve(town: Town, day: number): void {
  for (const w of town.works) {
    if (CATALOGUE[w.kind].cls === "subsistence") continue;
    if (w.idleSinceDay === null) continue;
    // Both dates are days since world epoch, so this subtraction is the same
    // subtraction anywhere in the world — which it was not while each town
    // counted seasons from its own founding (KAN-107).
    const idleFor = day - w.idleSinceDay;
    if (w.condition === "idle" && idleFor >= DECAY.idleToDecayed) w.condition = "decayed";
    else if (w.condition === "decayed" && idleFor >= DECAY.decayedToRuin) w.condition = "ruin";
  }
  // Ruins are NOT swept from the ledger: the map projection needs them, so your
  // own arson still shows on the ground the next time you come ashore (spec §7).
}

// ---- Reading the ledger ----------------------------------------------------

// How badly each want goes unmet, 0 (satisfied) to 1 (nothing at all). A GOVERNOR
// INPUT — never a bar the player is expected to tend.
//
// `food` IS THE EXCEPTION, and deliberately (§3.5.4, the line that spec calls
// load-bearing): it is rebased from HUNGER to DEPENDENCY. It scores the share of
// the town's bread that did not come off its own ground, so a town buying a third
// of its corn scores 0.33 WITH FULL BELLIES. That is why importing never silences
// the wish for a farm ([HC-81]) — and it is scored identically for every place,
// whatever its purpose; what purpose changes is what the governor may do about it.
export function unmetNeeds(town: Town, dependency = 0): Record<Need, number> {
  const out: Record<Need, number> = { food: 0, drink: 0, shelter: 0, worship: 0, order: 0 };
  const souls = Math.max(town.population, 1);
  for (const need of Object.keys(out) as Need[]) {
    if (need === "food") {
      out.food = dependency < 0 ? 0 : dependency > 1 ? 1 : dependency;
      continue;
    }
    const supply = town.works
      .filter((w) => w.condition === "working" && w.serves === need)
      .reduce((s, w) => s + w.servesFor, 0);
    out[need] = Math.max(0, Math.min(1, 1 - supply / souls));
  }
  return out;
}

// How well the best available ground suits this work — the "land calls for it"
// term, and the clause that goes with it.
export const bestSuitFor = (town: Town, kind: WorkKind): Suit | null => groundFor(town, kind)?.suit ?? null;

// What a given region could carry — what an unworked stretch of ground is FOR.
// It walks EVERY capital work rather than the menu, and that is the question
// being asked: what this ground could bear does not depend on what a governor
// is currently allowed to pick off a list.
export const worksForRegion = (town: Town, r: Region): WorkKind[] =>
  CAPITAL.filter((k) => regionsFor(town, k).some((x) => x.region.id === r.id));

// ---- The label ladder (§2.12.12) -------------------------------------------
//
// WHAT REPLACED THE BOILING HOUSE. It was deleted as a menu item and folded into
// DEPTH: past a threshold, a region's installation is RELABELLED rather than
// joined by a new entry.
//
//     "cane fields"  ->  "cane fields and a boiling house"
//     "sawpits"      ->  "a mill and its yards"
//
// §7's contracts 3 and 9 already ratify that works of one kind on one region
// draw as ONE INSTALLATION SIZED BY COUNT. The ladder is that rule's prose twin
// — the same fact, said in words instead of drawn — so IT ADDS NO MACHINERY AND
// NO STORED STATE: it is a pure function of the kind and the number standing,
// and the number standing is counted at the moment somebody asks ([HC-93]).
//
// THE SWEET-SPOT RULE IS UNTOUCHED. A region still carries one flagged best-of-it
// hex, and it is still why the boiling house STANDS where it does. It is now
// also why it is NAMED where it does.
//
// PROVISION GROUNDS HAVE NO SECOND RUNG, and that is deliberate rather than an
// omission: §2.12.12 ratifies exactly two, and inventing a third would be
// designing rather than building. A kind with no rung simply keeps its name at
// any depth, which is what the ladder does everywhere below the threshold.
const LADDER: Partial<Record<WorkKind, string>> = {
  sawpit: "a mill and its yards",
  caneField: "cane fields and a boiling house",
};

// HOW THE INSTALLATION READS, in one function ([P-47]) — the name and how much
// of it there is are one sentence, and the ladder is the top of that sentence.
// Below the threshold the count says how much ("sawpits x3"); at it, the WORDS
// say how much, and a count beside them would be the same fact twice.
export function installationLabel(kind: WorkKind, standing: number): string {
  const deep = standing >= WORKS.ladderAt ? LADDER[kind] : undefined;
  if (deep) return deep;
  const name = CATALOGUE[kind].label;
  return standing > 1 ? `${name} ×${standing}` : name;
}
