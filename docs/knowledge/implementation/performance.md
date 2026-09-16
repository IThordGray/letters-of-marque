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

**`[P-48]` If a loop condition encodes a rule, the rule is in the wrong place.** The clamp on
how many sentry posts a grade could field lived inside the spawner's loop conditions, where no
other reader could see it — which is *why* `[P-47]` was violated. Hoist the limit to where both
sides can read it.

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

## Sources

The research behind this file, worth reading before proposing an exception:

- **Data-oriented design:** [Mike Acton, CppCon 2014](https://www.youtube.com/watch?v=rX0ItVEVjHc) · [Richard Fabian, *Data-Oriented Design*](https://www.dataorienteddesign.com/dodbook.pdf) · [Nystrom, *Game Programming Patterns* — Data Locality](https://gameprogrammingpatterns.com/data-locality.html), [Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html)
- **Doing less, at scale:** [Factorio FFF-148 "do less"](https://www.factorio.com/blog/post/fff-148) · [FFF-421 Optimizations 2.0](https://www.factorio.com/blog/post/fff-421) · [FFF-204 prefetching](https://www.factorio.com/blog/post/fff-204) · [Dwarf Fortress optimisation](https://www.gamedeveloper.com/programming/how-tarn-adams-upgraded-and-optimized-dwarf-fortress-for-its-official-steam-release)
- **Determinism:** [Bettner & Terrano, "1500 Archers on a 28.8"](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond) · [Fiedler, Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/) · ECMA-262 §21.3.2 · [V8 `Math.tanh` divergence across OSes](https://scrapfly.dev/posts/browser-math-os-fingerprint/) · [Math keeps changing](https://macwright.com/2020/02/14/math-keeps-changing.html)
- **V8 reality:** [Elements kinds](https://v8.dev/blog/elements-kinds) · [Fast properties](https://v8.dev/blog/fast-properties) · [Trash talk: Orinoco GC](https://v8.dev/blog/trash-talk) · [Maglev](https://v8.dev/blog/maglev) · [Pointer compression](https://v8.dev/blog/pointer-compression) · [Shapes and Inline Caches](https://mathiasbynens.be/notes/shapes-ics) · [Egorov, What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html) · [Microbenchmarks are experiments](https://mrale.ph/blog/2024/11/27/microbenchmarks-are-experiments.html)
- **Stale advice, cited as stale:** [Bluebird "Optimization killers"](https://github.com/petkaantonov/bluebird/wiki/Optimization-killers) — now self-disclaimed
- **Scheduling:** [Varghese & Lauck, Hashed and Hierarchical Timing Wheels](https://www.cs.columbia.edu/~nahum/w6998/papers/sosp87-timing-wheels.pdf)
- **Judgement:** [Abrash, "The Best Optimizer Is between Your Ears"](https://www.phatcode.net/res/224/files/html/ch01/01-01.html) · ["Assume Nothing"](https://www.phatcode.net/res/224/files/html/ch03/03-01.html) · [You (Probably) Shouldn't use a Lookup Table](https://specbranch.com/posts/lookup-tables/)
