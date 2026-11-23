# Performance rules

**Scope:** `game/` · **Read by:** every agent that writes or reviews code there · **Authority:** human edits win.

Code has to fight to be there. Cite rules by number in review. Numbers are stable — never reuse one.
Rendering rules: [rendering.md](rendering.md). Measurements and method: [performance-review.md](performance-review.md).
Sim-modelling rules (numbers, scales, statistics): [modelling.md](modelling.md).

## Do less

- `[P-1]` **Do less.** Remove work; never do the same work faster. Features too (`CLAUDE.md`, *Do less*).
- `[P-2]` Cost = complexity × tick rate. O(N²) over 50 is fine once a season, not once a day.
- `[P-3]` Legibility and determinism beat speed unless a profile says otherwise.
- `[P-14]` Never iterate to skip. Idle things leave the list; presence in the array is the flag.
- `[P-15]` Anything due on a known future tick goes in that tick's bucket. Never poll.
- `[P-16]` A known trajectory stores departure and arrival; position is derived when asked.
- `[P-17]` A pure function of (identity, time, seed) is computed on demand — never stored, never stepped.
- `[P-17a]` Rotate with a stored unit vector, never angles or trig.
- `[P-17b]` "Must not read X" is enforced by a function signature that is not given X.
- `[P-17c]` Bake only when the reader's rate makes deriving ruinous (a 60 Hz view). The bake belongs
  to the reader, is never world state, and is tested against the source field.
- `[P-18]` Compute an invariant once per scope, not once per use.
- `[P-19]` Coarsen detail only on sim-state criteria — never camera, attention or speed setting.
- `[P-20]` Stagger only by a pure function of (id, tick). Never stagger something whose cadence is a rule.
- `[P-21]` Prefer an active set to a dirty flag.
- `[P-71]` Remove by swap-with-last, in one bulk pass. Order is a cost; sort a copy where a rule needs it.
  Never read meaning from position.
- `[P-72]` Write functions that take arrays, not a per-entity `update()`.
- `[P-54]` Split an expensive stage off where most callers stop needing it. Computing a pure function
  twice is fine.
- `[P-74]` Abstractions are additions too. Start plain; add an extension point at the third variant
  or a stated recurring need, justified in one sentence: "adding the next X touches N files and can't
  break the others." Use the extension points the code already has; inline any that never got a
  second variant.
- `[P-75]` Listeners, timers and frame loops are removed when what they serve goes away.

## Determinism (not negotiable — `guardrails.test.ts` enforces the starred ones)

- `[P-4]` Plain `number`. No fixed-point.
- `[P-5]`★ Banned in sim code: `Math.` `sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh
  atanh exp expm1 log log1p log2 log10 cbrt hypot pow random`.
- `[P-6]`★ No `**`. Write `x * x`.
- `[P-7]` Safe: `abs ceil floor round trunc sign sqrt min max fround imul clz32`.
- `[P-8]` All randomness from the seeded PRNG, hashed on (seed, tick, entity id, channel). Never a
  shared sequential stream.
- `[P-9]` Fix iteration and summation order. Never reorder a float sum.
- `[P-10]` Every comparator is a total order with an id tie-break and a stated direction — seaward in
  a town's local frame.
- `[P-11]`★ Never read a clock in sim code (`Date.now`, `performance.now`, anything derived).
- `[P-12]` Never hash a `NaN` through a typed-array view.
- `[P-13]` Integers for coin, population and stock counts.
- `%` keeps the sign of the dividend: when a quantity can go negative for the first time, check every
  `%` and every `trunc` that takes it (`Math.floor` is right below zero).
- No threads or Web Workers in sim code.

## One source of truth

- `[P-47]` A derived value has one function, and every reader calls it. Before writing a loop that
  counts something, search for the function that already counts it.
- `[P-48]` No rule inside a loop condition — hoist it where every reader sees it. A loop's guard and
  body ask the same function, or the loop has a hard iteration bound.
- `[P-49]` A rate's name or type states its denominator; rename when the base changes. Read a derived
  field's arithmetic before building on it — a doc comment is not its specification.
- `[P-50]` A snapshot holds only what is drawn, copied at the source's beat — or reads live.
- `[P-51]` Count the things before writing a cull. A handful never needs one.
- A constant with a comment nearby explaining what really determines it is a bug: derive it.
- An input a system cannot receive beats a guard it must remember.
- Before calling code done: **who calls this outside a test?** Delete what nothing calls.

## Allocation

- `[P-22]` No object pools.
- `[P-23]` Allocate temporaries freely; bound what you retain.
- `[P-24]` A `new` in the daily tick is a design smell — usually `[P-14]` or `[P-18]` in disguise.
- `[P-25]` No escaping closures in hot loops.
- No memoising cheap pure functions.

## Shapes and arrays (hot paths)

- `[P-26]` One factory per object kind: every field present, same order, same types. Never add later.
- `[P-27]` Never `delete` a property; assign `undefined`.
- `[P-28]` Initialise float fields with a float.
- `[P-29]` Up to 4 shapes per call site is free. Don't contort code below that.
- `[P-30]` No holey arrays: `[]` + `push`, or `new Array(n).fill(0)` — never `new Array(n)` then writes.
- `[P-31]` Never read past `length`.
- `[P-32]` Indexed `for` in hot loops; anything that reads best elsewhere.
- `[P-33]` No `map/filter/reduce` chains inside a tick. Fuse into one loop.
- `[P-34]` No array destructuring or spread in hot loops. Object destructuring is fine.
- `[P-35]` Arrays of objects at current scale. Structure-of-arrays only for tile data or large fleets.
- `[P-36]` Typed arrays for fixed numeric buffers.
- `[P-37]` Integer handles in world state. No object-keyed `Map`/`Set` in hot paths.
- `[P-38]` No strings in the sim. Intern to ids.
- `[P-73]` No caller-supplied functions inside hot loops. Queue events; drain after the loop.
- `[P-59]` One tagged record shape, not a family of polymorphic classes.
- `[P-60]` Side tables only for rare fields in large populations, keyed by handle.
- `[P-61]` An enum of the real states, not a set of booleans.
- No `|0` or `>>>0` (use `Math.trunc`). No bit-twiddling as arithmetic. No linked lists.

## Gates

- `[P-76]` Never loosen a gate to get green: no lint disables, type escapes (`as any`, `@ts-ignore`),
  skipped tests or raised timeouts. If one is genuinely needed, a one-line comment says why.

## Measurement

- `[P-39]` No performance change lands without a before/after on the full run. Method in
  [performance-review.md](performance-review.md).
- `[P-45]` Cite rule numbers in review.
