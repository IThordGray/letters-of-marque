// What is worth a line in the chronicle — the filter, and only the filter.
//
// [HC-0]  "Judge this milestone on whether a century of history reads as
//         plausible AND is caused by something you can name." A map of the
//         present cannot answer the second half: it shows what is true now and
//         says nothing about what happened. So the view keeps a feed.
// [HC-16] Every decision publishes its reason in plain language — and in a world
//         with no player, the stated reason is the ONLY way to tell a working
//         simulation from a plausible-looking one.
//
// THE PROBLEM THE FILTER EXISTS TO SOLVE IS VOLUME, and the arithmetic is stark.
// Fifty governors publish a reasoned sentence every season, which is 20,000
// sentences a century. Nobody reads 20,000 sentences; a feed that long is a feed
// nobody looks at, and [HC-16]'s promise is worthless if its output is noise.
//
// SO: **notable means a change of STANDING, not a piece of business.** A place's
// standing is what the map draws about it — who holds it, what class it is,
// whether its people are still there — plus the one loss that is not routine:
// a work taken outright by the sea. The governor's build is business. So is a
// work idling for want of hands, a price moving, a footprint growing, and a work
// rotting out after four years of neglect, which is the slow end of a ladder
// the governor could have mended at any point.
//
// Measured on seed 1660, one century, fifty places: **247 lines**, essentially
// all of them works lost to the sea. That is "a few hundred lines a century",
// which is a chronicle a person actually reads — against 20,000 for the builds
// and 1,021 if grade-drops were admitted too. Grade-drops are drawn ON THE MAP
// as a scar instead, which is where a recoverable rung belongs.
//
// THREE OF THE FIVE KINDS CANNOT HAPPEN YET, and they are here deliberately.
// Faction changes by invasion, class changes on a charter's arrival, and a
// treasury empties by being spent — all three are dispatches, and nothing sends
// one until KAN-101 (decisions.md, 2026-09-14). The seam costs five comparisons
// a day and it is how the day nations start acting will announce itself. Writing
// the filter now also fixes what "notable" means before there is a flood of
// events arguing for their own inclusion.
//
// Nothing here knows a name, a date format, or a sentence. It is integers in and
// integers out ([P-38]), which is what lets the whole of it be claimed without a
// world to build one from.

// A place's standing, as the feed watches it. Five integers, and every one is
// either stored on the world or an O(1) count — nothing here is derived
// ([HC-14], [P-2]: this is compared on the DAILY beat, the highest-rate loop
// there is).
export interface Standing {
  size: number; // the size class as a rank: 0 settlement, 1 town, 2 city
  faction: number; // index into world.nations
  ruined: number; // works at the bottom of the devolution ladder
  hale: number; // works still working
  people: number; // souls, to the nearest one
}

export type NotableKind =
  | "lost" // the sea took a work outright — [HC-35], one per contact
  | "promoted" // a charter arrived — [HC-8], [HC-62]
  | "taken" // the place changed hands — [HC-49]
  | "emptied" // nobody left — [HC-18], and only a deliberate hand does this
  | "broke"; // a crown's treasury ran out — [HC-40]

export interface Notable {
  day: number;
  kind: NotableKind;
  // A place id for the first four, a nation id for `broke`. The kind says which,
  // and the prose that reads it back lives with the world that holds the names.
  who: number;
  // How many, where the kind counts anything. One, almost always.
  n: number;
}

export const makeStanding = (): Standing => ({ size: 0, faction: 0, ruined: 0, hale: 0, people: 0 });

// Two readings of one place, one day apart. Appends what deserves a line.
//
// `byWeather` IS THE WHOLE OF HOW A LOSS IS TOLD FROM A ROT, and it is a fact
// about WHEN the reading was taken rather than a fact about the storm — which is
// what keeps it inside [HC-33]. Conditions change in exactly two places: the
// seasonal works ledger, and `takeWeather` on a day a place felt something above
// Fair. So a reading taken on a day the place felt weather can only have caught
// the sea; a reading taken at a season boundary can only have caught the ladder.
// Nothing here asks whether a storm existed, where it was, or how bad it was,
// and there is no argument through which it could ([P-17b]).
export function notablePlace(
  day: number,
  who: number,
  was: Standing,
  now: Standing,
  byWeather: boolean,
  out: Notable[],
): void {
  // [HC-61] promotion is one-way, so a class that moved at all moved up. Stated
  // as a comparison rather than an inequality anyway: if the day ever comes that
  // something demotes a place, this reports nothing rather than reporting a
  // promotion, and the missing line is a better bug than the wrong one.
  if (now.size > was.size) out.push({ day, kind: "promoted", who, n: now.size - was.size });
  if (now.faction !== was.faction) out.push({ day, kind: "taken", who, n: now.faction });
  if (byWeather && now.ruined > was.ruined) {
    out.push({ day, kind: "lost", who, n: now.ruined - was.ruined });
  }
  if (was.people > 0 && now.people <= 0) out.push({ day, kind: "emptied", who, n: 0 });
}

// A crown's purse, on the crossing and never on the state. [HC-40] makes an
// empty treasury the most load-bearing fact in the faction layer, and a crown
// that has been broke for thirty years is a condition rather than news — the
// same reason the town harness does not repeat "stalled" every season.
export function notableCrown(day: number, who: number, was: number, now: number, out: Notable[]): void {
  if (was > 0 && now <= 0) out.push({ day, kind: "broke", who, n: 0 });
}
