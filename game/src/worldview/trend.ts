// The one line a map of the present cannot draw.
//
// THE NAMED FAILURE MODE OF THIS WHOLE MILESTONE is that "the fifty towns find
// their level and stop" — §8's own words for why the faction layer exists at
// all. It is the one thing a map is structurally incapable of showing, because a
// map shows a moment and a plateau is a shape in time. Fifty dots that have
// found their level look exactly like fifty dots that are still climbing.
//
// So the view keeps a history, and it is deliberately the cheapest possible one:
// four numbers a year. A century is a hundred samples, a run of two centuries is
// two hundred, and the array is bounded by the length of the RUN rather than by
// the frame rate or the speed setting — which is the property that matters,
// because otherwise watching slowly would cost more memory than watching
// quickly, and [HC-26] would be violated by a graph.
//
// [P-2] complexity x tick rate: this is sampled on the seasonal beat and records
// on one season in four. Four hundred calls a century, of which a hundred store
// anything.
// [HC-14] Nothing here is on the World, saved, or readable by the simulation. It
// is a presentation-side cache of numbers the world already published ([P-17c]),
// and it dies with the view that built it.

export const TREND = {
  // One sample a year. A season would be four times the points for a line that
  // looks identical at a hundred pixels tall, and a day would be 36,000.
  everyDays: 360,
} as const;

export interface Trend {
  everyDays: number;
  // Strictly increasing, and that is the invariant everything else here rests
  // on: a chart drawn from a series that can go backwards draws a scribble.
  day: number[];
  people: number[]; // souls, the whole world over
  coin: number[]; // wealth on hand, the whole world over
  works: number[]; // works standing, of any grade
}

export const makeTrend = (everyDays: number = TREND.everyDays): Trend => ({
  everyDays,
  day: [],
  people: [],
  coin: [],
  works: [],
});

// Record a sample, if enough of the world has gone past since the last one.
//
// THE GUARD IS WHAT MAKES THE SERIES MONOTONE, and it guards in the one direction
// that can actually go wrong: a caller on the seasonal beat offers four samples a
// year and three of them are refused. A day at or before the last one recorded is
// also refused, so replaying a day — which a reset does, and which a second
// world on the same canvas would — cannot put a point behind its neighbour.
//
// Returns whether it stored anything, so the chart can redraw on the year rather
// than on the frame.
export function recordTrend(t: Trend, day: number, people: number, coin: number, works: number): boolean {
  const n = t.day.length;
  if (n > 0 && day < t.day[n - 1] + t.everyDays) return false;
  t.day.push(day);
  t.people.push(people);
  t.coin.push(coin);
  t.works.push(works);
  return true;
}

// What the chart has to fit into its box. One pass, three maxima, and the floor
// is zero on purpose: a population line that starts its axis at the first sample
// makes every wobble look like a collapse.
export interface Span {
  day0: number;
  day1: number;
  people: number;
  coin: number;
  works: number;
}

export function spanOf(t: Trend): Span {
  const n = t.day.length;
  const span: Span = { day0: n > 0 ? t.day[0] : 0, day1: n > 0 ? t.day[n - 1] : 0, people: 0, coin: 0, works: 0 };
  for (let i = 0; i < n; i++) {
    if (t.people[i] > span.people) span.people = t.people[i];
    if (t.coin[i] > span.coin) span.coin = t.coin[i];
    if (t.works[i] > span.works) span.works = t.works[i];
  }
  return span;
}

// Has it levelled off? The question the line exists to answer, answered in a
// number so a person does not have to squint: the growth of the last `overYears`
// against the growth of the whole run, as a share.
//
// Zero means it stopped; one means it is still climbing as fast as it ever did.
// It is deliberately a READING and never a threshold — nothing in the simulation
// reads it, nothing branches on it, and it is on the page beside the line rather
// than instead of it.
export function stillClimbing(t: Trend, series: number[], overSamples: number): number {
  const n = t.day.length;
  if (n < 2 || overSamples < 1) return 0;
  const from = n - 1 - overSamples < 0 ? 0 : n - 1 - overSamples;
  const wholeRun = series[n - 1] - series[0];
  if (wholeRun <= 0) return 0;
  const recent = series[n - 1] - series[from];
  const share = (recent / wholeRun) * ((n - 1) / (n - 1 - from));
  return share < 0 ? 0 : share;
}
