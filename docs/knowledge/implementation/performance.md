# Performance — how code earns its place

**Layer:** HOW (implementation) · **Scope:** `game/` — the durable build · **Authority:** human edits win.

The standing instruction from the human, 2026-09-10, and the reason this file exists:

> *"This is TypeScript. A single threaded language. Everything needs to be super performant. If
> something is not needed, it shouldn't get instantiated. Every bit of code that runs needs to solve
> a problem at that particular time, and be released as soon as possible. **It needs to fight to be
> there.** … Everything needs to be as light as it can be."*

Researched from pre-abundance game development (8-bit through ~2000) and from how a 2026 JIT actually
behaves, then **measured against this project's own code**. Rules are numbered `[P-n]` and are meant
to be cited in review.

---

## §0. The one rule, and the budget

**`[P-1]` Do less. Everything below is a way of doing less; nothing below is a way of doing the same
work faster.** Factorio's whole optimisation philosophy compresses to those two words, and it is the
right lens here.

> **AND THE TEST IS ON FEATURES TOO, not only on code (2026-09-22).** This file's scope is `game/`,
> so `[P-1]` as written binds a line of code. The human extended it upward: *"Everything we do needs
> to serve a purpose, and even then we need to be critical about whether we REALLY need it."* The
> feature-level form — three questions a ticket must survive, and the default answer being **no** —
> lives in `CLAUDE.md` under *Do less*, because it is applied at triage rather than in review. **A
> ticket costs a hundred times what a line does, so the bar is higher, not lower.**

**`[P-2]` Judge cost as complexity × tick rate, never complexity alone.** An O(N²) pass over 50 towns
is 2,500 operations — trivial once a season, ruinous once a day. The two beats (`[HC-2]`) are the
axis every performance decision turns on.

### What the workload actually costs today

Measured on Node 24 / V8 13.6, this machine, on the shipped town module:

| | |
|---|---|
| One town, 200 years, ledger only | **5.6 ms** |
| One town, 200 years, with the governor | **40.7 ms** |
| Projected 50 towns × 200 years | **~2.0 s** |
| One auction (`wants()`) | **16.75 µs** |

And a modelled daily tick — 73,000 days × 50 places, a seeded draw and three multiply-accumulates
per sample — costs **11 ms for the whole two centuries** in plain objects and plain `for` loops.

**Read those two facts together, because they are the most important thing in this document.** The
tick *mechanics* are nearly free. The **governor costs seven times the ledger it advises**. The
expense is not loop shape, allocation style or data layout — it is **work that did not need to
happen**. That is where the effort goes.

**`[P-3]` Legibility and determinism outrank speed unless a profile says otherwise.** A two-second
fast-forward is not in trouble. This file exists to keep it that way as six more systems land, not to
justify contorting code today.

---

## §1. Determinism — correctness rules, not performance rules

`[HC-11]` requires the same seed to give the same two hundred years, at any speed, on any machine.
These rules are what make that true. **They are not negotiable and they are not trade-offs.**

**`[P-4]` Use plain `number`. Do NOT hand-roll fixed-point arithmetic.** `+ − * / %` on doubles are
*exactly specified* by ECMA-262 as IEEE-754 binary64 — one correctly-rounded result, no latitude — so
they are already bit-identical everywhere. Fixed point existed because the 386 had no FPU; measured
here it is **3.7× slower** than plain double arithmetic, and it adds an overflow-bug class for
nothing. *This reverses the classic pre-2000 doctrine, deliberately.*

**`[P-5]` These `Math` functions are BANNED in simulation code:** `sin cos tan asin acos atan atan2
sinh cosh tanh asinh acosh atanh exp expm1 log log1p log2 log10 cbrt hypot pow random`. ECMA-262
§21.3.2 calls them **implementation-approximated** — engines are *permitted* to differ, and do. This
is not theoretical: V8 changed `Math.tanh` in Chrome 148 to defer to the host libm, so the same call
now returns different values on Windows, macOS and Linux; `Math.pow` and `Math.tanh` results have
also changed between Node versions. **A save file would diverge on a Node upgrade.**

**`[P-6]` Never use the `**` operator.** `Number::exponentiate` is on the same approximated list.
Write `x * x`.

**`[P-7]` These are exactly specified and safe:** `abs ceil floor round trunc sign sqrt min max fround
imul clz32`.

**`[P-8]` All randomness comes from the project's seeded PRNG, keyed by a hash of `(world seed, tick,
entity id, channel)` — never a shared sequential stream.** A single global stream couples every
consumer to every other consumer's *call order*, so adding one new roll anywhere shifts every
subsequent roll in the world. Hashed per-purpose streams are a pure function, and therefore survive
refactoring, reordering, staggering and LOD — all of which we will want. `Math.random` is unseedable
and banned by `[P-5]`.

**`[P-9]` Float addition is not associative. Fix every iteration and accumulation order explicitly,
and never reorder a summation as a "tidy-up".** Order-sensitive phases sort by a total order with an
id tie-break first.

**`[P-10]` Every `sort` comparator must be a consistent total order with an explicit id tie-break.**
Sort stability is guaranteed since ES2019; an inconsistent comparator is not. **An explicit
tie-break needs a stated DIRECTION, not merely a total order** — and for anything in a town's
local frame the direction is **seaward** (`[HC-73]`), because south *is* seaward in every local
view and what a bearing names is usually a coast. *(Earned on KAN-111, where a tie resolved by
array order described water lying due east as "to the north-east".)*

**`[P-11]` Never read a clock.** `Date.now`, `performance.now`, and anything derived from them are
banned in simulation code. The simulation's only time is the tick (`[HC-4]`).

**`[P-12]` Never hash or checksum a `NaN` through a typed-array view** — the spec does not fix the
stored bit pattern.

**`[P-13]` Prefer exact integers for anything that must not drift** — coin, population, stock counts.
Integers are exact in a double up to 2⁵³ for free. This is a *modelling* decision that removes a
class of drift bugs; it is not a speed decision.

### Two structural rules that keep the derived/stored line honest

Not determinism rules, but they live here because both were found by chasing one.

**`[P-47]` A derived quantity must never be previewed, summarised or reported from a second
number.** One function answers both *"what happens"* and *"how much of it"*, and both readers
call it. Where the spec says **derived** (`[HC-59]`, `[HC-14]`), any second path to the same
value is a bug waiting for a rename. *(Earned on KAN-109: the deploy screen previewed 15
defenders from a hardcoded constant while the spawner fielded 9 — and because the preview took
no grade at all, it could not have been right for more than one of three.)*

> **A NEW TELL, and it is the cheapest one yet (2026-09-22, KAN-134): a local loop that reproduces a
> named function's body.** Not two constants, not two fields — a `for` or a `filter` inline in one
> file, counting the same thing a function next door already counts. `roomInRegion` walked a region's
> hexes to count the free ones while `capacityOf` counted them in `land.ts`, **and the two differed
> by exactly the works standing on the ground.** Three readers disagreed about how much room a region
> had, and one of them — the map summary — subtracted the works *by count* rather than *by hex*, so
> a work built over by the footprint was charged twice.
>
> **When you write a loop that counts, search for a function that already counts it.** The inline
> version always looks cheaper than the call, and it is, right up until somebody changes what the
> word means.

**`[P-48]` If a loop condition encodes a rule, the rule is in the wrong place.** The clamp on
how many sentry posts a grade could field lived inside the spawner's loop conditions, where no
other reader could see it — which is *why* `[P-47]` was violated. Hoist the limit to where both
sides can read it.

> **AND WHERE THE LOOP IS UNBOUNDED, THE SAME MISTAKE IS AN INFINITE LOOP (2026-09-22, KAN-134).**
> `raiseSubsistence` reads `while (countOf < want && roomFor > 0) raise(...)` — the **guard** asks
> one function whether there is room, and the **body** asks a different one where to put the hut. The
> day those two disagree, the guard says yes for ever and the body raises nothing. One mutation
> during KAN-134 made them disagree and **hung the entire suite.**
>
> **Note what that failure looks like, because it is not a red test: a synchronous spin cannot be
> timed out.** The runner's `testTimeout` is a hang detector for *async* work; a `while` that never
> yields takes the process with it, so the symptom is a suite that never finishes rather than one
> that fails. **Where a loop's guard and its body both ask "is there room", they must ask the same
> function** — and if that is not possible, the loop needs a hard iteration bound.

**`[P-49]` A rate must name its denominator, in the type.** `wealthLoss: number // a share of coin on
hand` was a wrong model wearing a label, and everything downstream reasoned about it correctly — from
the wrong premise. Renamed `maintenanceShare` when the base changed, because **a field whose name
states the wrong model will be reasoned about wrongly**, however good the comment beside it is. This
is the same rule that renamed `founded` → `foundedDay` (KAN-107): a name that asserts a unit or a
base is load-bearing, and a stale one is a lie the compiler cannot catch.

> **And its companion: "derived" is not one thing — ask what it is derived FROM.** `Derived.upkeep`
> reads as *"what the town costs itself to run"* and looks like the town's maintenance liability. It
> is `population × upkeepPerHead` and nothing else: it prices **souls, not fabric**. Two towns with
> the same population and wildly different works have identical `upkeep`. **A sentence in a doc
> comment is not a specification of a field's axis** — read the arithmetic before building on it.
> *(Found 2026-09-15: `upkeep` was the obvious base for a storm's maintenance bill and would have
> made "more works means a bigger bill" literally unwritable as a test.)*

**`[P-50]` A presentation snapshot holds exactly what the frame draws, and a copied field's BEAT must
match the beat of the thing it copies.** Copying a value onto a snapshot to avoid recomputing it is
right; copying it on the *wrong cadence* silently makes it a second, stale source of truth — `[P-47]`
wearing a performance costume.

The worked case (KAN-100): `PlaceView.coin` was written on the **seasonal** beat, but wealth moves
**daily** under `[HC-6]`'s event half — so the card could show a purse up to **ninety days** out of
date, and nothing drew the field anyway. Deleting it made the `[P-47]` claim exact rather than
approximate.

- **A snapshot field nobody draws is pure liability.** Ask what pixel it becomes.
- **Match the beat, or read live.** A quantity that moves daily is either sampled daily or read from
  the ledger at the moment it is shown. There is no third option that is honest.

**`[P-51]` A cull whose margin is wrong is worse than no cull, and six of anything never needed one.**
Culling by the visible box hid a live tempest the sidebar could describe in words — storms form up to
300 nm off their zone seat and stray 420 nm past the world box, so their centres are *routinely*
outside it. With a handful of objects the cull was pure risk for no saving (`[P-1]`), and clipping
the drawing to the sea is the honest answer. **Before writing a cull, count the things: a cull is a
correctness surface, and it only pays above the count where drawing them all is measurable.**



**`[P-52]` A clamped quantity whose MEDIAN is its clamp is a bug report.** `access` is a 0..1 ceiling
that decides how much of the world a place can reach, and on the shipped world **half of all places
sat at exactly 1.00** — because three fishing shacks, which the hamlet floor raises for nothing, bought
0.9 of the scale. The arithmetic was correct throughout. The *scale* had stopped meaning anything,
and that is why `[HC-87]`'s "fragile ceiling" could not be stated: **a ceiling every place already
touches is not fragile, it is furniture.**

- **The check is one line and costs nothing: print the median of any clamped derived quantity and see
  whether it is the clamp.** Do it when the quantity is written, not when something built on it fails.
- Saturation is the symptom; the cause is almost always **a free input reaching the top of a scale
  that was meant to be earned.** Ask what a place gets for nothing, and what fraction of the range
  that buys.
- The mirror case is worth the same glance: a clamped quantity whose median is *zero* has the same
  disease at the other end.

> **EXTENDED 2026-09-20: do the same for any constant you DIVIDE BY.** The rule above reads as being
> about a derived quantity, and the second instance was not — the quantity was fine and **the scale
> was wrong**. A depth term was written as `free hexes / focusDeepAt` with `focusDeepAt = 5`, taken
> from a constants table describing region sizes of 6–9. **The median came out at the clamp: 55.8% of
> regions read 1.00.** A ceiling that half the world already touches prices nothing, which is
> `[P-52]`'s own failure wearing a tuning knob.
>
> **The cause generalises and is worth stating: a denominator calibrated against a TABLE rather than
> against the DATA it will be handed.** The table in question described a generator that had since
> been deleted, so the constant was documentation of a world that no longer existed. Measured against
> the real cut, free hexes per region run **0–23 with a median of 6**, and the right denominator was
> 9. **Before dividing by a constant, measure the thing you are dividing** — and if the constant came
> from another file, check that file still describes something real.

**`[P-53]` Where two numbers price the same underlying fact, only ONE of them may be a normaliser.**
Reach was nearly built as `openLanes / fullAt` — a count against a constant, which reads perfectly
natural and would have charged every place a **third** time for where the siting roll put it:
`MARKET.reachNm` already decides who counts as a neighbour, and the clearing's own ratio already makes
a thin market dear.

> **The general form, and it is worth pausing on before writing any denominator: a SHARE (denominator
> = the thing's own total) prices INTERRUPTION; a COUNT (denominator = a constant) prices ENDOWMENT —
> and endowment is usually already priced somewhere else in the model.** So: before normalising a
> quantity against a constant, ask what else already prices the same thing. Getting this wrong does
> not produce a wrong number, it produces a number that is *right twice*, which is much harder to see.



**`[P-54]` Split a generator at the line where most callers stop needing it.** The warm start costs
**810 ms** — a real price for running a world eighty years before anyone sees it. Put inside
`generateWorld` it would have been charged to roughly forty map-only calls across the suite and cost
**+30 s**; kept as a separate `warmStart`, the same work costs the suite **+8 s** and `generateWorld`
stays at map price.

- **The question is not "how expensive is this?" but "who is forced to pay?"** An expensive stage that
  most callers do not need is not an expensive stage — it is a stage in the wrong function.
- The tell is a caller list where the majority want only the cheap prefix: a map without ledgers, a
  header without a body, a schema without data.
- **And a pure function may honestly be computed twice.** The land is cut once to ask what it bears
  and once to hand it to the town. `[P-17]`'s answer to *"store it instead?"* is still no, and `[P-2]`
  settles it: 17 ms once per world against nothing per tick.


**`[P-55]` A statistic whose median describes no member of the population is a bug report about the
statistic.** The median place's trade clears **0.80 coin a season**, which reads as "thin margin,
needs a nudge". Split by whether the place has a capital waterfront work, the same population reads:

| | places | median trade margin | a 180-coin work off trade alone |
|---|---|---|---|
| **with a quay** | 103 | **+20.02 / season** | two and a half years |
| **without one** | 90 | **−1.28 / season** | never |

**0.80 is the average of a windfall and a deficit, and no place in the world experiences it.** A dial
set against it necessarily sets the wrong thing: it must either drown the quayed half or leave the
quayless half still losing. This is `[P-52]`'s family — a number whose arithmetic is perfect and whose
*meaning* has gone — but the tell is different and worth naming separately:

- **`[P-52]`'s tell is saturation** (the median sits at the clamp). **`[P-55]`'s tell is the gap**: the
  distribution has two humps and the summary sits in the valley between them.
- **The check is one line and it goes next to the median: print the median of each half, split by the
  single most consequential thing a member can have or not have.** Here that was one building.
- **Any sentence of the form "the median town earns X" must name the split it survived**, or it is a
  claim about an average town that does not exist.


**`[P-56]` Before you move a free input, measure what share of the TOTAL it is paying for.** A
fishing shack is a hut the hamlet floor raises for nothing, on any ground, with no decision behind
it. It carried a `trade` column with no cargo class, which meant it was paid as a work that takes a
cut of the traffic — **a flat constant × access, at no price and to no buyer.** Two coin a season,
per hut, across every place in the world:

- **893.92 of the world's 6,169.86 a season — 14.5% of ALL trade income, and 27.8% of the quayside
  cut.** Retiring it cost the world **36% of its wealth and 20% of its population**, because quayside
  works feed back into what a place can afford to build.
- It was two. Nobody would have argued about it in review, and nobody did — it sat in the catalogue
  through every story that touched the catalogue.

This is **`[P-52]` at the income end.** `[P-52]` asks *what does a place get for nothing, and what
fraction of the RANGE does that buy?* The same question at the other end is *what fraction of the
TOTAL?* — and the answer is routinely an order of magnitude past the guess, because a small constant
paid to a thing that exists everywhere is not a small constant.

- **The tell is a per-unit number attached to something free, automatic or self-raising.** Count the
  units before you judge the number: two coin × every hut in the world is not two coin.
- **Isolate it before you ship anything else in the same commit.** Here the re-key and the two new
  works were measured separately, and the re-key *alone* — with no new works at all — accounted for
  the whole of the drop. Had they shipped as one measurement, the new crops would have taken the
  blame for a finding that had nothing to do with them.


---

## §2. Doing less — where the wins actually are

Ranked. `[P-14]` is worth more than everything in §3 and §4 combined.

**`[P-14]` Never iterate a collection in order to skip most of it. If a thing has nothing to do,
remove it from the list the loop walks.** Presence in the array *is* the flag. `for (t of towns) if
(!t.dirty) continue;` still pays the iteration, the load and often a mispredict — a branch is not a
skip. Factorio took idle roboports from 1 ms to 0.025 ms per tick — **40×** — purely by not visiting
them.

**`[P-15]` Anything that becomes true on a known future tick is filed into that tick's bucket, never
polled.** A ring of buckets indexed by day gives O(1) schedule and O(1) per-tick work.

**`[P-16]` An entity with a known trajectory has no present.** A dispatch travelling for eleven days
does not need eleven position updates: store departure and arrival, derive position when someone
asks. This is `[HC-44]`'s dispatch and `[HC-13]`'s far-ring traffic, and it is the single largest
saving available in the daily tick.

**`[P-17]` Anything that is a pure function of `(identity, time, seed)` is computed on demand, never
stepped and never stored.** This is exactly `[HC-30]` — ambient weather is derived per zone per day,
never stored per place. State that is stepped must be visited; state that is derived is visited only
when read.

> **The strongest instance of this in the codebase, built for KAN-98.** The world's geography is a
> **pure function, not a bitmap** — a few dozen elliptical lobes plus noise fields, answered at any
> resolution and storing nothing. **The world map and a town's own coast are literally the same
> geography read at 280 nm and at 1.8 nm.** That is what makes `[HC-19]` cheap rather than expensive:
> a saved world is a seed, a day, and a few hundred numbers.
>
> **Two traps it hit, both worth inheriting:**
> - **A fractal field is smooth at the small scale unless you make it otherwise.** Octave weights
>   halve, so by 15 nm a single fbm contributed under a hundredth and every town's shore came out
>   straight — `[HC-19]` would have been geography in name only. **Any field read at two very
>   different scales needs a separate term at the fine one.**
> - **Trimming a region to a radius returns a disc, not a coast.** The first cut put every town 2.2 nm
>   inland, so all three seaward neighbours were dry, the guaranteed-landing rule fired for *every
>   place in the world*, and 48 of 50 towns shared an identical shoreline — the rim of the trim.

**`[P-17b]` Where a rule says "must not read X", enforce it with a function that is not GIVEN X.**
The strongest form of `[HC-33]` turned out not to be a rule anyone remembers but a signature:
`effectOf(severity, roll)` takes two numbers, so it cannot see a storm, cannot ask whether one was
involved, and cannot ask whether it was building. **There is no argument through which the forbidden
fact could arrive.** Prefer this to a comment, a lint rule or a code review every time.

**`[P-17a]` A frame rotation needs no trigonometry.** Carrying a stored seaward unit vector
`(sx, sy)` onto local south is the matrix `[sy −sx; sx sy]` — two numbers, multiply and add, exact
under `[P-5]`. So `[HC-73]`'s town-local frame is not an approximation of the world; it is an **exact
rotation of it**. Reach for a stored unit vector before reaching for an angle, always: an angle costs
a banned function to use and a banned function to recover.

**`[P-17c]` A derived quantity is BAKED when its reader's tick rate — not its complexity — makes
deriving ruinous, and the bake then belongs to the READER, never to the world.** `[P-17]` says
compute on demand; `[P-2]` says complexity × tick rate. When those two pull against each other, the
tick rate decides.

The worked case is the coastline (2026-09-15). `heightAt` is the same field at every scale and the
simulation is right to derive it: it asks a few thousand times at generation and then hardly at all.
A view running at 60 Hz would ask **300,000 times a frame** to draw the same coast. Nothing about the
function changed; the reader did. So the contour is baked **once**, into the view, and:

- **It is not world state.** Not on the `World` struct, not saved, not readable by the simulation.
  `[HC-14]` and `[HC-26]` both hold — looking at the world still cannot change what is true in it.
- **The sim keeps deriving.** There is no second source of truth: the bake is a *rendering* of the
  field, and if it disagreed with the field that is a bug in the bake.
- **Test the bake against the field, never against itself.**

The trigger to watch for is a reader whose rate is *categorically* different from the writer's —
a frame loop reading something a generator wrote. That is the only shape where baking wins.

**`[P-18]` Compute an invariant once per scope, not once per use.** See §7 for the live example in
our own code: an auction that rebuilds the same `Set` thirty-six times.

**`[P-19]` Coarsen simulation detail only on criteria derived from simulation state — never on the
camera, the player's attention, or the speed setting.** This is `[HC-12]` and `[HC-26]` restated as a
performance rule: an LOD keyed on where someone is looking destroys bit-identity by construction.

**`[P-20]` Stagger updates only by a pure function of `(entity id, tick)`.** `id % 7 === tick % 7` is
fine and deterministic. Staggering by frame rate or wall-clock is not. And never stagger something
whose cadence is a *rule* rather than an arbitrary convenience.

**`[P-21]` Prefer an active-set to a dirty flag where both would work.** "Not in the list" is much
harder to get subtly wrong than "flag not set", and a missed invalidation in a deterministic
simulation is a silent corruption that compounds for two hundred years.

*The two rules below were added 2026-09-22 from three talks (Sources). The numbers quoted are theirs,
measured in C# and Zig; the rules are restated for this codebase, and marked wherever the reason
changes or the win disappears under V8. None of it has been measured on our own run yet — `[P-39]`
still applies before any of it is cited as a saving here.*

> **Why none of this is micro-optimisation.** Each change below is individually dismissible in a pull
> request. They are not individually additive. The cache is a **contested** resource, so the effects
> multiply: Barker's worked example takes the same loop through ten small, sensible changes and lands
> at **~40× faster**, no single step of which would survive review on its own merits. Traffic does not
> get linearly worse as cars join the road; it is fine, and then it is gridlock. Cache pressure
> behaves the same way, which is why these decisions are made continuously and cheaply rather than
> saved up for an optimisation pass that arrives too late to make them.

**`[P-71]` Remove by swapping the last element into the hole, and batch removals to the end of the
pass.** An ordered remove shuffles every element after the hole, so a pass that kills *k* of *n*
entities pays O(n·k) to preserve an ordering nobody asked for. Measured: hoisting the deletions out
of the walking loop into one bulk pass was **3×**, and replacing the ordered list with a swap-back
array a further **4×** — together the difference between a loop collapsing at 10× the entity count
and running *faster* than it had at the original count. **Order is a cost.** Pay it only where a rule
demands it, and where it does, sort a copy at the point of use.

> Safe under `[HC-*]`: a swap-back array's order is a pure function of the removal sequence, so it
> stays deterministic. But it is *arbitrary* — nothing may read meaning into a position, and no rule
> may depend on iteration order (`[P-37]`).

**`[P-57]` Write the function that takes many, not the function that takes one.** A per-entity
`update()` called once per entity per tick is the shape that makes almost every rule in this file
impossible to apply: you cannot hoist an invariant out of it, cannot keep what the loop touches
contiguous, cannot remove in bulk. One function over an array can do all three. **A good test when
adding any method: could this take an array instead?** If it could, it should.

---

## §3. Allocation — and the doctrine that reversed

**`[P-22]` Do NOT write object pools.** A short-lived object that does not escape is **scalar-replaced
by V8 and costs 0.83 ns** — measured; pooling the same object was **1.57× slower**. Worse, a pool is
long-lived, so its objects are promoted to old space where every major GC scans them forever and any
young object they reference adds remembered-set traffic. *This reverses near-universal pre-2000
doctrine, and the reversal is measured, not asserted.*

**`[P-23]` Allocate temporaries freely; be careful what you RETAIN.** Collection cost is proportional
to *survivors*, not allocations. 3 million non-escaping objects left the heap at 5 MB with zero
collections; 3 million *retained* objects cost 174 ms and 316 MB. The thing that causes major GC pain
is a growing live set — an unbounded cache, a retained world graph — not churn.

**`[P-24]` Keep allocation out of the daily tick anyway.** Not for GC cost, but because an allocation
in the fast path is nearly always a symptom of `[P-14]` or `[P-18]` — work that should not be
happening at all. Treat a `new` in a daily loop as a design smell to investigate, not a crime to
optimise.

**`[P-25]` Do not create escaping closures in hot loops** (~14 ns each, 17× a plain call). A closure
that stays local and gets inlined is ~2 ns and is fine.

---

## §4. Shapes, arrays, and the cliffs worth knowing

These are cheap to follow and protect against sharp, invisible edges.

**`[P-26]` Build every object of a kind in one factory, with every field present, in the same order,
with the same value type.** Never add a property later.

**`[P-27]` Never `delete` a property on a simulation object.** It moves the object to dictionary mode
**permanently** — measured **3.8× slower** property reads, forever. Assign `undefined` or a sentinel,
which is free.

**`[P-28]` Initialise a field that will hold a float with a float**, not `0` — a Smi→Double field
transition is a shape change.

**`[P-29]` Keep a hot call site to four object shapes or fewer.** The fifth tips it megamorphic:
**0.76 → 5.12 ns** on a property load, **1.21 → 7.67 ns** on a method call. Note the shape of this
rule — two, three and four shapes are *free*. **Do not contort code chasing monomorphism.**

**`[P-30]` Never let an array go holey.** Build with `[]` + `push`, or `new Array(n).fill(0)`.
**`new Array(n)` followed by indexed writes produces a holey array**, and holey is permanent — even
after you fill it. The direct cost is only ~1.2×; the reason for the rule is that it is invisible and
irreversible.

**`[P-31]` Never read past `length`.** `i <= a.length` measured **3.83×** slower — the read falls off
the end into a prototype-chain lookup and poisons the site.

**`[P-32]` In a hot loop, use an indexed `for`.** `for…of`, `forEach`, `map`, `filter` and `reduce`
carry **~10–20 ns per element** of iteration overhead — 12–25× an indexed loop on a trivial body.
**Outside hot loops, use whichever reads best**; where the body costs microseconds the overhead is
noise, and legibility wins. This is a hot/cold distinction, not a global ban.

**`[P-33]` Never chain `map().filter().reduce()` over a large array inside a tick** — measured 12×,
plus hundreds of megabytes of transient intermediates. Fuse into one loop.

**`[P-34]` Object destructuring is free. Array destructuring and rest/spread are not.** `const {x, y}
= o` compiles to property loads; `const [x, y] = a` and `f(...xs)` go through the iterator protocol
and cost **10.9×** and **7.4×**. Keep the second kind out of hot loops.

**`[P-35]` Use arrays-of-objects at current scale.** At 50 towns, AoS beat structure-of-arrays for the
entire 200-year run (11 ms vs 12 ms) — the whole working set is in L1 either way. SoA is ~10× at
200,000 records, so reach for it for **per-tile world data or large fleets**, never for towns. *The
C++ data-oriented instinct is wrong at this scale; adopt SoA when the entity count earns it.*

**`[P-36]` Use typed arrays for fixed-size numeric buffers — for the guarantees, not the speed.** They
cannot go holey, cannot box, are not GC-scanned, and can be byte-hashed for save-state and
determinism checks. A packed plain array is equally fast.

**`[P-37]` Prefer integer handles to object references in world state**, and never key a `Map` or
`Set` by object in a hot path. Handles serialise by copying arrays, give O(1) identity, and keep
iteration order from depending on discovery order.

**`[P-38]` No strings inside the simulation.** Intern to integer ids. String building in a per-tick
path is an allocation you will pay for 3.6 million times — and see §7, where it is already happening.

> The cautionary tale for `[P-38]`, worth knowing by name: *GTA Online* spent **70% of a seven-minute
> load** on one core parsing a 10 MB JSON config. It shipped fine — the file was small then, and it
> grew patch by patch. Strings fail late and all at once. **If a human is not going to read it, it is
> not a string.**

**`[P-58]` Never call a caller-supplied function from inside a hot loop.** An `onDeath` delegate, an
event handler, a subscriber list: its cost is bounded by nothing visible at the call site. It can
allocate, it can do I/O, it can evict L1 wholesale — you have handed away control of the loop's
performance characteristics. **In this codebase it is worse than that**: a caller-supplied function is
the easiest way for a forbidden read to arrive inside a deterministic loop, which makes the Observer
pattern a `[HC-*]` hazard as well as a performance one. Inline the behaviour, or push events into an
array and drain it after the loop. The strongest form is `[P-17b]` — a loop with no function-valued
parameter has no channel through which anything can arrive.

**`[P-59]` Prefer one encoded shape to a family of polymorphic ones.** One record layout: a
small-integer tag, the fields every variant shares, and one or two general-purpose slots whose
*meaning the tag defines*. Zig's compiler went from 54.0 bytes per IR node under polymorphism to 20.3
under encodings, and its AST nodes from 120 bytes to 15.6 — worth **39%** and **22%** of wall-clock in
those two stages. **In TypeScript the byte count is not the reason.** The reason is `[P-29]`: twenty
entity kinds as twenty classes is a guaranteed-megamorphic call site (0.76 → 5.12 ns on a property
load); twenty encodings of one shape stays monomorphic. Encodings are how twenty kinds fit inside the
four-shape budget.

**`[P-60]` Where a field is empty for most records, move it to a side table keyed by handle.** If 90%
of monsters carry nothing, the inventory field is 90% waste on every record and a load that every
loop pays for. **What changes for us is when it is worth it**: a `Map.get` costs tens of nanoseconds
against a property load's sub-nanosecond, so a side table pays only when the field is genuinely rare
*and* the population is large enough for the field itself to cost something. At 50 towns it never is
— see `[P-35]`. Key it by integer handle, never by object (`[P-37]`).

**`[P-61]` Encode the states that exist, not the booleans that imply them.** *n* booleans describe 2ⁿ
states and you almost never mean all of them; `dead && frenzied` is a bug waiting for QA to find it.
Replace the flags with an enum of the real states. **In TS this buys correctness, not bytes** — a
`boolean` field and a small-int field are the same single tagged slot — but it is the precondition
for `[P-59]`, and it composes with `[P-14]` into the strongest version of itself: once the states are
named, the state *is* which array the entity lives in, and the field disappears entirely. That is
Kelley's "store booleans out of band", and it is the same rule as `[P-14]` arrived at from the
opposite direction — three independent sources, one rule.

---

## §5. False economies — techniques that sound right and are not

Recorded explicitly, because each is something a well-meaning developer would otherwise "helpfully"
apply, and several are folklore repeated for a decade after they stopped being true.

| Technique | Verdict |
|---|---|
| **Time-slicing work across frames** | **Buys nothing on a fast-forward.** It is a *latency* technique — one 40 ms spike becomes eight 5 ms slices for the same or slightly more total work. Only relevant when the sim shares a frame with a UI at real-time speed. Not to be confused with `[P-20]` staggering, which genuinely reduces work. |
| **Fixed-point for speed** | Dead. See `[P-4]` — measured 3.7× *slower*. |
| **`\|0` / `>>>0` for cheap integer maths** | Slower unless every intermediate stays inside ~±2³⁰, and `\|0` is a **correctness trap**: it is ToInt32, so `(2**53+1)\|0 === 0` silently. Use `Math.trunc`. |
| **Bit twiddling as arithmetic** | `x >> 1` for `/2`, XOR swap, Duff's device, manual unrolling. Neutral at best, deoptimising at worst, and it costs readability for nothing measurable. |
| **Lookup tables** | Largely inverted — memory is now the slow thing, and a table that leaves cache loses to recomputation. Reliably worth it only at **one cache line or smaller**. The one legitimate use here: replacing a banned transcendental (`[P-5]`) with a small exact table. |
| **Linked lists** | The era's default and a modern anti-pattern; you cannot prefetch in JavaScript at all. Dense arrays with swap-remove. |
| **Memoising cheap pure functions** | The `Map` lookup, the key construction (often a string, i.e. an allocation) and the staleness risk usually cost more than the arithmetic saved. |
| **Threads / Web Workers in sim code** | Banned. Parallelism is the most effective way to destroy bit-identity, and Factorio's own attempt at threading a memory-bound system made throughput *worse*. |
| **Avoiding `try`/`catch`** | **Stale.** Optimised since V8 5.3 / Node 7; measured 1.03×. The canonical source for this advice — the Bluebird "optimization killers" wiki — now carries its own disclaimer saying it is historical. Also dead from that list: `for…of` deoptimising, generators, compound `let`/`const`, and the 128-case `switch` limit. |
| **Contorting code to reach one shape** | See `[P-29]` — up to four is free. |
| **Reordering fields largest-to-smallest to kill padding** | A real and large win in C/C++/Zig — and a **no-op in a plain JS object**, where every field is one tagged slot whatever TypeScript calls it, and there is no padding to reclaim. It becomes real again the instant the data is a `DataView`, an interleaved typed array or a GPU vertex buffer — see `[P-66]`. |
| **`class` → `struct`** | Measured at **−30%** in C#, because an array of classes is an array of pointers into the heap. No such lever exists in TypeScript. The equivalent move is a typed-array column, and `[P-35]`/`[P-36]` decide it by record count, not by instinct. |
| **Narrowing an enum to a byte** | Costs nothing and buys nothing on a plain object field. Buys 4× density in a `Uint8Array` column or a vertex attribute. Same advice, different data structure. |

---

## §6. Measurement

**`[P-39]` No performance change lands without a before/after measurement on the full-length run**, not
a microbenchmark. Cache and GC effects are amortised and appear somewhere other than where they were
caused.

**`[P-40]` A measurement is not trusted unless:** warm-up; at least seven repetitions reporting the
minimum; **one variant per process**; inputs varied per pass to defeat common-subexpression
elimination; the result consumed by a printed sink; and a sanity check against a hardware lower bound.
*Three of the benchmarks behind this document were wrong until they met that bar* — one reported a
loop running faster than the FP-add latency floor, which is physically impossible and meant the
compiler had deleted the work.

**`[P-41]` Prefer an assertion to a timing.** Under `--allow-natives-syntax`, `%HasFastProperties`,
`%HasHoleyElements`, `%HaveSameMap` and `%GetOptimizationStatus` state a fact; a benchmark states a
noisy number. `--trace-deopt` says what actually deoptimised and why.

**`[P-42]` Profile the whole tick with `node --cpu-prof`, and optimise only what the profile names.**

**`[P-43]` Profile allocation rate alongside elapsed time.** Allocation cost is billed later, to the
wrong function.

---

## §7. Two findings in our own code

Kept here because they are the clearest available illustrations of `[P-1]`, and because both were
found by applying this file to code that already shipped.

### The auction rebuilds an invariant thirty-six times per decision

`wants()` walks twelve work kinds. For each it calls `buildable` → `roomFor` → `takenHexes`, then
`scoreWork` → `groundFor` → `takenHexes`, then `whereFor` → `groundFor` → `takenHexes`. **Each
`takenHexes` allocates a fresh `Set` of every claimed and occupied hex; each `regionsFor` allocates an
array and sorts it.** None of it can change while the auction runs.

That is **≥36 Sets and ≥36 sorted arrays per town-season** — about 1.4 million of each across a
200-year, 50-town run — for a value that was already correct the first time. It is why the governor
costs seven times the ledger. **This is `[P-18]`, and it is a ticket, not a licence to refactor now.**

### `bearingOf` runs a banned function to no effect

[`hex.ts`](../../../game/src/town/hex.ts) `bearingOf()` calls `Math.hypot` — banned by `[P-5]` — twice
per iteration, and writes its result into stored state via the land generator. But it normalises every
candidate dot product by `len * dl`, where **all six bearing vectors have the same length and `len` is
constant within the call**. It divides every candidate by the same positive constant before taking the
maximum. **The division cannot change which bearing wins.**

So it costs time, introduces the only cross-engine determinism hazard in the module, and changes
nothing. It did not fight to be there. *(The land generator is being replaced by the world's cut,
`[HC-19]` — the point is that the replacement must not reintroduce it.)*

---

## §8. How this is enforced

A rule nobody checks is a wish.

- **`[P-44]` The determinism rules in §1 are enforced by a test that scans simulation source**, not by
  vigilance. Adding a banned call fails the suite.
- **`[P-45]` Cite the rule number in review.** "`[P-30]` — this goes holey" is a fact; "this feels
  slow" is not.
- **`[P-46]` Every agent working in `game/` is handed this file.** It is listed in the delegation
  protocol in `CLAUDE.md` for that reason.

---

## §9. The GPU is a different computer

**Not load-bearing yet.** Nothing in `game/` renders through a GPU today, and until something does,
this is a briefing rather than a rule set. It is recorded now because the choices that make these
techniques possible — WebGL2 or WebGPU, and whether the view owns buffers or objects — are made once,
early, and are expensive to revisit.

Everything above assumes one thread, one CPU and V8. A GPU inverts a good deal of it. The byte layout
you cannot control in a JS object is exactly what you control in a buffer, and the cost you are
hunting stops being cache misses and becomes **draw calls and bandwidth**.

**`[P-62]` Do not build an object for the renderer to walk. Write the buffers the GPU actually
reads.** The Planetsmith devlog's chain was: voxel data → vertices and indices → a `Mesh` object (plus
computed normals and bounds) → a `GameObject` → a draw. Two of those stages exist only because the
engine expects an object to exist; deleting them deleted the work, the memory, and two whole systems.
Our form of the same rule: the view owns typed-array columns and uploads them — no per-entity display
object, ever. `[P-17c]` is this rule from the other side; the bake belongs to the reader.

**`[P-63]` Reduce the number of tests before you make the test faster.** The most useful finding in
that video. Moving a per-chunk frustum test onto a compute shader — hundreds of thousands of bounds
tested in parallel, precisely what a GPU is for — bought **nothing**: 50 fps before, 50 after.
Grouping the *same* tests into an octree, so one rejection discards 32,768 chunks at once and a node
fully inside the frustum admits its whole subtree untested, took it to **170**. Same tests, same
hardware, 3.4×. This is `[P-1]` in graphics clothing, and it is the rule most likely to be forgotten
the moment a GPU is standing there waiting to be thrown work.

**`[P-64]` One buffer, many draws — and check what the API actually gives you before planning around
it.** The technique: allocate one large vertex buffer and one index buffer, suballocate each piece of
geometry into free space, keep a parallel args buffer of draw commands, and issue them all against one
binding so the GPU processes them as though it were a single mesh. Pieces are added and removed
without rebuilding anything. Fewer, larger passes beat many small ones, always.

> **PARKED — a question for whoever picks the renderer, not a decision now.** `game/` draws to a 2D
> canvas and no renderer beyond that has been chosen ([solution-architecture.md](solution-architecture.md),
> *Deliberate non-choices*). The fact to carry into that choice, and the only reason this paragraph
> exists: **WebGL2 has neither indirect draw nor compute shaders.** Its nearest equivalents are
> `drawElementsInstanced` and the `WEBGL_multi_draw` extension, both driven from JavaScript.
> **WebGPU has `drawIndexedIndirect` and compute shaders**, so a draw list written by the GPU itself
> is possible there and only there.
>
> Two more facts of the same kind, from Vercidium's chain. **WebGL2 has no shader storage buffers** —
> an ES 3.1 feature — so per-draw data too large for a uniform buffer goes in a data texture there,
> and `gl_DrawID` exists only under `WEBGL_multi_draw`. **What that actually costs is narrower than it
> looks.** Interior-face culling, greedy meshing, the 32-bit packed vertex, chunk-local coordinates,
> quad instancing, triangle strips and the six per-direction meshes are all plain WebGL2, and in that
> video they carried 50 fps to 6,500 before any indirect draw appeared; collapsing every chunk into a
> single draw call is the step that wants more, and it was measured at 6,500 → 12,000. Nor is the SSBO
> load-bearing for the *technique* — it was needed only because everything had already become one
> draw, and a per-direction uniform serves where the draws are still separate.
>
> So this is an input to the renderer decision, not an argument for one. **Unpark it when a renderer
> is on the table**; until then nothing in `game/` should be shaped around either answer.

**`[P-65]` An allocator's cost scales with its arena.** One mega-buffer removed the draw-call cost and
created a new one: finding free space among 20,000 suballocations, which was the source of the
residual frame spikes. Splitting it into fixed-capacity pages removed the spikes *and* the hard
ceiling, at the price of one extra draw call per page. Bigger is better for the GPU and worse for the
allocator — page until both are tolerable.

**`[P-66]` The vertex is the struct that has to shrink, and here the byte count is literally the
cost.** 48 bytes → 16, and the frame rate went from 25–40 fps to over 200 while draw distance went
from 40 chunks to 120. Every step has an analogue in any GPU buffer of ours:

| From | To | Move |
|---|---|---|
| normal, 12 B | 0 B | **derived in the shader** — `[P-17]` applied to vertex data |
| UV, 8 B | 1 B | index into a 256-entry lookup table |
| texture index, 4 B | 11 bits | asked what range was actually needed — 4 billion textures → 2,048 |
| colour, 4 B | 2 B | the same lookup-table trick; 32,768 tints is plenty |
| four small fields | 3 B | bit-packed together |
| position, `float32×3`, 12 B | `float16×3`, 6 B | 4 nm resolution → 0.5 mm; nobody can see the difference |

Two things to carry out of that table. **The lookup table wins here, which is the opposite of the §5
verdict — and both are right:** on the CPU a table competes with real work for cache and usually
loses; in a vertex buffer it competes with per-vertex *bandwidth*, and wins easily. Scope that rule to
the memory it lives in. And **nothing in the table is a trick** — every line is someone asking what
range a field actually needs. Four billion positions per axis and four billion texture indices were
unexamined defaults, not decisions. (`HALF_FLOAT` vertex attributes exist in WebGL2; WebGPU has
`float16x2` / `float16x4`.)

**`[P-67]` The cheapest triangle is the one never generated; the second cheapest is the one merged
into its neighbour.** Vercidium's chain starts before any rendering technique exists. A face between
two solid voxels cannot be seen from anywhere, so it is never emitted: **115 million triangles →
1.2 million**, about 96×, entirely at mesh-build time. Coplanar faces sharing a texture are then
merged into one stretched quad — greedy meshing — and the final count is **79,000**, four orders of
magnitude below where it began, with no visual difference at all. Every later trick in that video is
worth less than this one. `[P-1]`, applied to geometry.

**`[P-68]` Shrink the coordinate space before you shrink the number.** A vertex position fits in six
bits per axis not through a clever encoding but because the position is **chunk-local** — 0–31 inside
a 32-wide chunk, with the chunk's world origin supplied once per chunk instead of once per vertex.
Move to a local frame and the packing follows; try to pack a world coordinate and there is nothing to
pack. **We already own this move on the CPU side:** `[P-17a]`'s town-local frame is the same idea, and
it is worth holding as one rule rather than two tricks.

**`[P-69]` Instance the smallest repeating unit, not the biggest.** The Planetsmith devlog ruled
instancing out — chunks are all unique, so there is nothing to instance. True at that granularity and
false one level down: **every voxel face is the same quad.** Instancing a four-vertex quad and
supplying per-face data once, rather than storing it on six vertices, cut memory **6×** and made the
vertex shader run four times per face instead of six; a length field then lets one instance cover a
whole merged run. **Uniqueness at one granularity says nothing about uniqueness at another** — ask
that before concluding instancing does not apply.

**`[P-70]` Partition by the predicate instead of testing it — then collect the field it made
redundant.** Back-face culling is a per-triangle test the GPU runs every frame, *after* the vertex
shader has already run on triangles that will be thrown away. Splitting each chunk into six meshes by
face normal and submitting only those facing the camera turns the test into a **selection**:
back-facing triangles never reach the vertex shader. That is `[P-14]` and `[P-61]` in a third domain
— presence in the bucket is the flag, and this is now the third independent arrival at it.

> **And it pays twice, which is the part worth taking away.** Once a mesh's direction is implied by
> *which mesh it is*, the three bits that stored the direction per vertex are free — and those three
> bits bought the second axis of greedy meshing, which had been impossible for want of room: 14,000 →
> 177,000 fps. **Storing a value out of band does not only delete the field. It frees the space the
> field occupied for something that could not otherwise fit.** That is the compounding in `[P-71]`'s
> preamble made concrete: the wins are not a list, they unlock each other.

---

## Sources

The research behind this file, worth reading before proposing an exception:

- **Data-oriented design:** [Mike Acton, CppCon 2014](https://www.youtube.com/watch?v=rX0ItVEVjHc) · [Andrew Kelley, *A Practical Guide to Applying Data-Oriented Design*](https://youtu.be/IroPQ150F6c) — indexes over pointers, booleans out of band, struct-of-arrays, sparse data in side tables, encodings over polymorphism · [Nick Barker, *Intro to Data Oriented Design for Games*](https://youtu.be/WwkuAqObplU) — the restaurant analogy for the cache hierarchy, and a measured ~40× on one loop · [Richard Fabian, *Data-Oriented Design*](https://www.dataorienteddesign.com/dodbook.pdf) · [Nystrom, *Game Programming Patterns* — Data Locality](https://gameprogrammingpatterns.com/data-locality.html), [Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html)
- **Doing less, at scale:** [Factorio FFF-148 "do less"](https://www.factorio.com/blog/post/fff-148) · [FFF-421 Optimizations 2.0](https://www.factorio.com/blog/post/fff-421) · [FFF-204 prefetching](https://www.factorio.com/blog/post/fff-204) · [Dwarf Fortress optimisation](https://www.gamedeveloper.com/programming/how-tarn-adams-upgraded-and-optimized-dwarf-fortress-for-its-official-steam-release)
- **Determinism:** [Bettner & Terrano, "1500 Archers on a 28.8"](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond) · [Fiedler, Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/) · ECMA-262 §21.3.2 · [V8 `Math.tanh` divergence across OSes](https://scrapfly.dev/posts/browser-math-os-fingerprint/) · [Math keeps changing](https://macwright.com/2020/02/14/math-keeps-changing.html)
- **V8 reality:** [Elements kinds](https://v8.dev/blog/elements-kinds) · [Fast properties](https://v8.dev/blog/fast-properties) · [Trash talk: Orinoco GC](https://v8.dev/blog/trash-talk) · [Maglev](https://v8.dev/blog/maglev) · [Pointer compression](https://v8.dev/blog/pointer-compression) · [Shapes and Inline Caches](https://mathiasbynens.be/notes/shapes-ics) · [Egorov, What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html) · [Microbenchmarks are experiments](https://mrale.ph/blog/2024/11/27/microbenchmarks-are-experiments.html)
- **Stale advice, cited as stale:** [Bluebird "Optimization killers"](https://github.com/petkaantonov/bluebird/wiki/Optimization-killers) — now self-disclaimed
- **GPU-driven rendering (§9):** [*I Built a Custom GPU-Driven Rendering Pipeline (10x Faster)*, Planetsmith devlog](https://youtu.be/LzivS_KzffY) — indirect draw, octree culling, buffer paging, 48→16-byte vertex packing · [Vercidium, *I Optimised My Game Engine Up To 12000 FPS*](https://youtu.be/40JzyaOYJeY) — interior-face culling, greedy meshing, a 32-bit vertex, quad instancing, per-direction meshes; runnable C#/Silk.NET source at [vercidium-patreon/meshing](https://github.com/vercidium-patreon/meshing) (MIT)
- **Scheduling:** [Varghese & Lauck, Hashed and Hierarchical Timing Wheels](https://www.cs.columbia.edu/~nahum/w6998/papers/sosp87-timing-wheels.pdf)
- **Judgement:** [Abrash, "The Best Optimizer Is between Your Ears"](https://www.phatcode.net/res/224/files/html/ch01/01-01.html) · ["Assume Nothing"](https://www.phatcode.net/res/224/files/html/ch03/03-01.html) · [You (Probably) Shouldn't use a Lookup Table](https://specbranch.com/posts/lookup-tables/)
