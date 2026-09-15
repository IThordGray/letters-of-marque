// The speed control — how many days pass per real second, and nothing else.
//
// [HC-4]  The day is a fixed step. THE SPEED CONTROL CHANGES HOW MANY DAYS ARE
//         SIMULATED PER REAL SECOND, NEVER THE SIZE OF A DAY. No variable
//         delta-time anywhere in the core. This is what makes the speed control
//         honest rather than a lie.
// [HC-5]  The simulation never adapts to real time. If it cannot keep up at the
//         chosen speed it runs slower in wall-clock — it never coarsens, skips
//         or approximates to catch up.
// [HC-20] Pause is a first-class speed. A paused world is fully inspectable and
//         advances nothing.
// [HC-2]  There are exactly two beats: the day and the season.
//
// SO THE ONLY THING THIS FILE DOES IS TURN SECONDS INTO WHOLE DAYS. It never
// returns a fraction, it never returns a partial one to be finished later, and
// the remainder it carries is a remainder of REAL TIME rather than of a day —
// the difference matters, because a carried fraction of a day would be exactly
// the variable step [HC-4] forbids, and a carried fraction of a second is just
// the clock not having got there yet.
//
// [P-11] is why this module is in `worldview/`: somebody has to read a wall
// clock to know how much real time went past, and the simulation may not. The
// split is the directory. Note what stayed on the simulation's side of it,
// though — NOTHING HERE TOUCHES THE WORLD. `advance` is four numbers in and two
// out; it cannot step a day, only say how many are owed. That keeps the whole
// speed control testable, which matters because it is the one part of a view
// that can silently destroy [HC-11].

// ---- The rates ([HC-90]: definitions live in a table) ----------------------
//
// §5: "a small set of NAMED RATES rather than a continuous slider, because named
// rates are reproducible, describable in a bug report, and enough. The rates want
// to span *watch a storm cross a coast* to *watch a century pass*, and THE EXACT
// NUMBERS ARE TUNING."
//
// These are the numbers, and the reasoning behind each is the sentence beside it.
// The span is 360x from the slowest moving rate to the fastest, and the two ends
// are the two the spec named:
//
//   · A storm lives ten to twenty-five days and crosses a coast in a handful of
//     them, so WATCH puts its whole life at about a minute of looking.
//   · A century is 36,000 days, so CENTURY runs 1660 to 1760 in fifty seconds.
//
// Measured against the cost, because [HC-5] means a rate the machine cannot hold
// is a rate that quietly lies: a headless century of the composed daily tick and
// all five seasonal phases over fifty places costs **1.08 s** on this machine
// (Node 24 / V8 13.6, including this view's own per-day sampling). At CENTURY
// that is fifty seconds of wall clock for one second of work — about 2% of one
// core — so every rate here is comfortably inside its budget and none of them
// needs [HC-5]'s fallback. The fallback is still correct if a slower machine
// needs it: fewer days pass per second, and every one of them is a whole day.
export interface Rate {
  id: string;
  name: string;
  perSecond: number;
  blurb: string;
}

export const RATES: readonly Rate[] = [
  { id: "pause", name: "Pause", perSecond: 0, blurb: "nothing moves, and everything can be read" },
  { id: "watch", name: "Watch", perSecond: 2, blurb: "a storm's whole life in a minute of looking" },
  { id: "passage", name: "Passage", perSecond: 12, blurb: "a sea leg in a blink, a season in a week of seconds" },
  { id: "season", name: "Season", perSecond: 90, blurb: "a season a second, a year in four" },
  { id: "century", name: "Century", perSecond: 720, blurb: "two years a second — 1660 to 1760 in fifty" },
];

export const PACE = {
  // A LONG STALL IS NOT A LONG NIGHT. A hidden tab, a breakpoint or a garbage
  // collection can hand the next frame half a minute of real time, and at
  // CENTURY that would be sixty years in one step — a world that jumped because
  // somebody alt-tabbed. [HC-5] says the world runs slower in wall-clock rather
  // than catching up, and this is that rule as a number: real time beyond a
  // tenth of a second simply did not happen as far as the clock is concerned.
  //
  // It is also the only bound the frame needs. The fastest rate asks for at most
  // `720 x 0.1 = 72` days in one frame, which is under a quarter of the work a
  // single season costs, so there is no second budget and no deferral queue —
  // both would have been code that could never run ([P-1]).
  maxFrameSeconds: 0.1,
} as const;

// ---- The accumulator -------------------------------------------------------

export interface Step {
  // WHOLE DAYS, always. [HC-4] as a return type.
  days: number;
  // Real time the clock has been paid for but has not yet turned into a day,
  // expressed in days so it can simply be added to. Always in [0, 1).
  carry: number;
}

// How many days this frame owes, and what it carries into the next one.
//
// The whole of [HC-4] is `Math.floor`. The whole of "and never skips one" is
// that the remainder is kept rather than dropped: `days + carry` is EXACTLY what
// was asked for, to the bit — `total - Math.floor(total)` is exact for any
// total a frame can produce — so a hundred frames too slow to earn a day each
// still add up to the day they are owed between them.
export function advance(perSecond: number, carry: number, realSeconds: number): Step {
  const dt =
    realSeconds > PACE.maxFrameSeconds ? PACE.maxFrameSeconds : realSeconds > 0 ? realSeconds : 0;
  const total = carry + perSecond * dt;
  const days = Math.floor(total);
  return { days, carry: total - days };
}
