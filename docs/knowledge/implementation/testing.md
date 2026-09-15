# Testing — the durable build (`game/`)

**Layer:** HOW (implementation) · **Scope:** `game/` only · **Authority:** human edits win.

*How durable code is verified. The prototypes are governed by
[coding-rules.md](coding-rules.md) instead — they get throwaway smokes and are meant to be
deleted. `game/` is durable and **the sim is the product**, so its behaviour is pinned.*

## The runner

**Vitest.** It is the Vite-native runner, so it shares the app's own module resolution — TypeScript
and extensionless imports work with no separate build step, no bundling dance, and no duplicated
config. One devDependency; nothing else was added.

```
npm test           # run once (what you run before a commit)
npm run test:watch # re-run on save while working on a system
```

`npm run build` runs `tsc` first, so **typecheck failures block the build**. Test files are
typechecked but never bundled into `dist/` — nothing imports them.

### A test timeout is a hang detector, not a performance budget

**Set deliberately 2026-09-15, after running on vitest's 5 s default by accident for the life of the
project** — nothing configured the runner at all until then.

Several claims here generate whole worlds, and a world is a height field of thirty-odd lobes under
two fbm stacks, so a claim that samples several seeds legitimately takes seconds. Run alone they pass
in about five; run across twenty-one parallel workers on a machine that is also doing something else
they take eleven. Observed on one unchanged tree: **seven failures on one run, one on the next, none
at all serially.**

**A suite that fails at random is a suite people stop reading**, which costs far more than the minute
it saves. And notice what the default was really doing: acting as a **second, implicit,
machine-dependent performance gate** beside the explicit `[P-39]` measurements this project already
takes on purpose. That is the `[P-47]` mistake — one quantity with two sources, one of them unstated
— and this source varies with whatever else the box is running.

- **Performance is policed by measurement**, in tests written to measure it, on the terms
  `performance.md` sets. Never by the runner's clock.
- The timeout only has to be long enough that **a genuine hang is still obvious**. 30 s.
- **Corollary:** if a test is slow enough to worry you, that is a `[P-39]` measurement waiting to be
  written, not a timeout waiting to be tightened.

## Where tests live

**Co-located** with the module they cover: `src/town/sim.ts` → `src/town/sim.test.ts`. A system and
its behaviour stay in the same folder, so a system that grows a second file grows a second test
file beside it. No separate `tests/` tree.

## What gets tested

**Pure systems only** — functions over the world/town struct, run headless. That is the whole point
of the data-oriented split in
[solution-architecture.md](solution-architecture.md): behaviour lives in pure functions, so
behaviour is testable without a browser.

**Not tested:** rendering, canvas, DOM, input handling, camera, the loop. If a bug can only be seen
by looking at the screen, it is found by playtesting, not by the suite.

## The two house rules

### 1. A test name is a design claim, not a function name

The suite should read like the design doc. If the claim cannot be said as a sentence about the
game, it probably should not be asserted at all.

```
✅  it("crawls back to a hamlet rather than dying")
✅  it("does not move when a work is razed, though yield collapses the same instant")
❌  it("stepSeason updates population correctly")
❌  it("returns 38")
```

This is the same discipline as the town spec's *no number without a sentence* — a test that cannot
be read aloud is testing the implementation, not the design.

### 2. Assert directions and relationships, never tuned constants

**Every number in a `constants.ts` is a starting guess meant to move after playtest.** A suite that
pins exact values punishes tuning, which is exactly backwards — it would make the code harder to
change in precisely the way this project needs to change it.

```
✅  expect(worked.population).toBeGreaterThan(bare.population * 2)
✅  expect(moved).toBeLessThan(gap * 0.5)
✅  expect(derive(t).tier).not.toBe("fortress")
❌  expect(t.population).toBe(38.04)
❌  expect(PROSPERITY.lag).toBe(0.12)
```

The question a test answers is *"is the rule still true?"* — never *"is the dial still where I left
it?"*. Tune freely; the suite should stay green unless a **rule** broke.

## Determinism

Sim systems are deterministic by construction — a seeded PRNG in world state
(`rng.ts`), no `Math.random`, no wall-clock reads. **Every module gets a reproducibility test:**
same seed and same steps produce the same result. It is one assertion and it catches an entire
class of bug that is otherwise miserable to chase.

## The town module was parked (2026-09-08) — **UNPARKED and the suite is back (2026-09-10)**

> **CLOSED.** The exit condition below was *"the suite comes back when the design locks."* The
> design locked on 2026-09-09, and the suite came back on 2026-09-10 (**KAN-102**, commit
> `0ff8352`): **47 tests** across `sim`, `works`, `governor` and `footprint`, plus hand-built
> fixtures. `--passWithNoTests` is **gone** from `game/package.json` — it was right while parked
> and a blindfold once not.
>
> The suite pins only behaviour the spec **ratifies** (`[HC-70]`), per the precedence rule below.
> Deliberately absent, because the spec replaces them: the land and coast generation, anything keyed
> off `archetype`, `tierOf`, the flat per-work `trade` term, the ~450 food ceiling,
> `prosperityTarget`'s `surplus/head` term, and the `food` need being rebased to dependency.
>
> **`tierOf` has since come OFF that list** (KAN-104): it carries 9 behavioural claims,
> warranted by `town-economy.md` §1 and `[HC-59]` rather than by its arithmetic, and no
> test pins a band value. `land.ts` also gained 15 claims about the *land struct* — not
> about the generator that is being replaced (KAN-103).
>
> **Consequence worth carrying: the two front tickets change code the suite deliberately does not
> cover.** `land.ts` (KAN-103) and `tierOf` (KAN-104) are both on that absent list, so **a green
> suite will not prove either change is safe.** "An equivalent town behaves identically" and
> "garrison behaviour is unchanged" have to be checked deliberately.
>
> The rest of this section is kept because it explains why the park was right at the time.
>
> **THE RULE THAT MAKES UNPARKING SAFE (ratified 2026-09-10).** The design that locked is
> [`../spec/world-simulation.md`](../spec/world-simulation.md), **not the module** — and the module
> predates it. So:
>
> **A test may pin only behaviour the spec RATIFIES — never merely behaviour that currently
> exists.** Where the code and the spec disagree, the spec is right and the code is wrong.
>
> Pinning code the spec is about to replace is the same mistake that caused the park in the first
> place, wearing different clothes: last time it was a design still being argued, this time it would
> be a design already superseded. `[HC-70]` is the warrant for what is safe — it names what the world
> layer explicitly does **not** reopen. If the safe set turns out small, write it and move on; the
> suite exists to protect the world simulation, not to delay it.
>
> **It is not small.** An audit against the spec (2026-09-10) found ~19 pinnable design claims and no
> refactor blocking any of them. **Unparking is purely additive** — see the two rules below.

### The fixture rule — pin against the struct, never against a producer

**Generalised from the town case, and it is a house rule now, not a KAN-102 detail.**

**Build test towns with `makeTown()` plus hand-written region objects. Never through
`foundTown()` / `rollLand()`.** The land generator is scheduled to be replaced by the world's cut
(`[HC-19]`, `[HC-73]`), so a fixture that goes through it inherits an expiry date; a fixture built
against the struct does not. This is what buys the safe list its immunity, and it generalises:
**pin behaviour against the struct, never against a producer that is scheduled to move.**

### The starting set, expanded by the audit

The four claims named further down still lead. The audit added five more, all safe under `[HC-70]`
and all cheap:

- **"wealth is the budget gate, not a term"** — the ranking `wants()` returns is identical for a rich
  and a broke town; only affordability differs. The cheapest test in the suite, and it guards a rule
  that is very easy to break by accident.
- **"fear outbids revenue after a burning"** — §8.6 cites this town behaviour by name as the model
  the *nation* auction must copy, so it is load-bearing twice over.
- **"the explanation IS the score"** — assert **clause membership**, never prose text.
- **"growth eats its own cause"** — claim the hex under a working sawpit and it idles, and the
  region's capacity falls with it.
- **"claiming is permanent"** — across a century of growth *and* decline, claimed ground never
  shrinks.

> **One trap, found by the audit — and it had already caught somebody.** Do **not** write the
> hamlet-floor test as *"population never falls below the floor"*. Until 2026-09-14 `sim.ts` applied
> that floor unconditionally, so the obvious test would have pinned the bug and made the eventual fix
> look like a regression.
>
> **It had in fact already happened, and sat green for days.** `worldgen.test.ts` asserted
> `population >= POP.floor` against a generator that applied that same floor two lines earlier — a
> tautology with no power to fail. KAN-106 deleted the constant and rewrote the assertion in terms of
> the two definitions it actually depends on (`gardenPlots.hands / WORKS.labourShare`), written out
> rather than read back.
>
> The correct claim is behavioural — **"a stripped town feeds and houses itself again"** — and the
> general rule is *Write the oracle out independently*, below: **an assertion that reads its own
> threshold out of the code under test asserts nothing.**
>
> Related, and **resolved 2026-09-15 by KAN-107**: elapsed time used to be expressible two ways, and
> the advice here was to prefer *seasons stepped* over `town.season` arithmetic. There is no longer a
> choice — `town.season` is deleted and every date a place keeps is **days since world epoch**, the
> same integer `world.day` is. Express elapsed time in days, and derive year and season from it.

The rest of this section is kept for the record — it explains why the park was right at the time.

### A second gap, which the park does NOT cover (recorded 2026-09-09)

**Every test file that has ever existed in `game/` was a town-module file** — all seven removed
together by `220cf15`. Verified against the full history: no other module has ever had one.

So **the raid layer — `ai`, `combat`, `morale`, `movement`, `nav`, `patrol`, `raid`, `spawn` — has
never had a suite and was never parked.** It sits outside the exit condition above, because there was
nothing to exit. That is a real gap and a different one: it is not what the world simulation stacks
on, so it does not gate the world milestone, and it should not be silently absorbed into the unpark
work as though the park had covered it.

Recorded here rather than fixed. **It wants its own decision** — the raid layer holds the ratified
will-spine, which is exactly the kind of rule the house style says to pin as a design claim.

**`game/src/town/` is exempt from everything below, temporarily**, by the human's explicit call:

> *"For the town, ignore the tests — until we've locked down what the town should do."*

The land model has been reshaped three times in two days (parcels → hex ring → regions), and each
reshape churned the suite harder than it churned the code. Pinning behaviour to a design still
being argued costs more than it catches.

**What this means in practice:** no new tests in `src/town/` while the model moves, and the
existing suite was removed rather than left red — a red suite teaches people to ignore red. Git has
it: `git show <commit>^:game/src/town/sim.test.ts` and friends.

**What it does NOT mean:** the convention is unchanged everywhere else, and this is not a licence
to ship the town module untested for good. **The suite comes back when the design locks**, and the
tests worth rewriting first are the design-claim ones that were already true and would still be
true — the hamlet floor, the shipways idle for want of planks, a governor who will not raise what
nobody can man, and a reproducibility test per module.

Verification while parked is by **headless inspection** — run the sim forward and read the output —
which is how every design problem in this module has actually been found.

### When a green suite cannot prove it — mutate and count

**Earned on KAN-103/104, 2026-09-10, and it is now the house answer.** Where a change
touches code the suite deliberately does not cover, a passing run proves nothing about
the change and nothing about the new tests either. So **break the thing you just
changed and count the failures.**

- Swapping two rungs of the garrison ladder's stat bands failed **5** claims; dropping
  the size term from the importance calculation failed **both halves** of the presidio
  rule. That proved 7 of 18 new claims non-vacuous.
- On the same day, `bearingOf`'s de-normalisation was verified by brute force rather
  than by argument — 5,067 real region centroids, a 17×17 integer block and a 145×145
  fractional grid, 0 disagreements — which was the right call, because the reasoning
  behind it was *almost* sound and needed evidence at the edge (see below).

It is cheaper than a review argument and it is repeatable. **A test that survives the
mutation of the thing it claims to test is worth keeping; one that does not is a
decoration.**

**A mutation that fails nothing can be evidence rather than a gap — if you predicted it.**
On KAN-111 the bearing tie-break has a second sort key that no mutation could disturb,
because only *adjacent* bearings ever tie for the win. That survivor confirmed the
measurement rather than indicting the test, and a companion claim guards the precondition:
if a non-adjacent tie ever appears, that claim fails and the second key starts mattering.
**A predicted survivor validates a precondition; only an unpredicted one indicts a test.**

### Write the oracle out independently

**A test that asks the code under test what the answer should be cannot catch a term added to it.**
Found on KAN-105: the reach test computed its expected passage by calling `passageDays` — the very
function it was testing — so a deliberately planted "neglect modifier" *inside* `passageDays` sailed
straight through the test that was named for it. It failed five other tests incidentally, which is
luck, not cover.

**Where a claim is about a formula, spell the formula out in the test.** `ceil(nm / DAY_RUN_NM)`
written by hand catches what `passageDays(nm)` cannot.

### Anchor fixtures off-origin, and asymmetrically

Also KAN-105, also found by mutation rather than by reading: a fixture whose crown seat sat at the
origin **could not tell "plotted from the seat" from "plotted from nowhere"**, because both are
`(0,0)`. A second fixture left a neutral faction seatless, so the guard that refuses a *neutral*
sender was never exercised — a different guard refused it first, and the test was a decoration.

**A fixture's coordinates should be deliberately off-origin and asymmetric**, for the same reason a
tie-break needs a stated direction: symmetry hides the difference between right and nearly-right.

### A fixture must be able to tell the cases apart

**Two unpredicted mutation survivors in one session, 2026-09-15, both fixed by building a fixture
rather than by arguing** — and both are the *off-origin fixture* rule one layer further down, in the
arithmetic.

- **A degenerate case a float field never produces must be CONSTRUCTED in exact binary.** A guard
  against a repeated vertex only fires where the height field is *exactly* zero at a lattice point,
  which a fractal field in double precision never is — so no mutation could break it. The fixture:
  a lobe of lift 1 and radius 16 centred at (72, 72), because `(8/16)² + (8/16)²` is exactly ½ and so
  `heightAt(64, 64)` is exactly 0.
- **A claim about coordinate arithmetic needs a divisor where the two forms actually differ.**
  `i * (W / cols)` and `(i / cols) * W` agree for most divisors, so a fixture whose step divides the
  box evenly **cannot tell exact from nearly-exact**. Eleven columns across a hundred miles overshoots
  by an ULP; that is the fixture.

The general rule: **before writing a claim, ask what input would distinguish the right answer from
the plausible one.** If no input in the fixture can, the claim is decoration however carefully it is
worded — and a mutation survivor is how you find out.

### Enumerate before you generalise

**The sibling rule, and it has now been earned twice on the same function.** Where a claim
is about *which cases exist* — which inputs tie, which values collide, which seeds break an
invariant — **enumerate them; do not derive them.**

- The argument for removing `Math.hypot` from `bearingOf` was that all six bearing vectors
  are the same length. Mathematically true, **not bit-identically true**, and exact ties were
  not covered by the argument at all.
- The brief for fixing that function's tie-break then named **two** tie families. Measurement
  found **six** — one on every boundary between adjacent bearings — including pairs involving
  N and S, which the ULP difference did *not* save.

Both times the reasoning was directionally right and incomplete at the edge, and both times
**ten lines of brute force settled it in about a minute**. Enumerating first would also have
produced the better fix straight away: one generalised rule rather than two special cases.

> **And a caution about confident reasoning, recorded because it nearly bit.** The
> argument for removing `Math.hypot` from `bearingOf` was that all six bearing vectors
> have the same length, so dividing every candidate by the same constant cannot change
> which one wins. Mathematically true. **Not bit-identically true:** N/S square to
> 2.9999999999999996 and the others to 3.0, so the divisor really did vary by an ULP,
> and exact ties were not covered by the argument at all. The conclusion held — but it
> held *empirically*, not by the reasoning given for it. **When a determinism argument
> rests on two floats being equal, check that they are.**

### Ask who calls it — coverage is not reachability

**Found 2026-09-14, on three systems at once.** `stepWeather`, `contactAt` and `sendDispatch` were
all fully built, fully tested and **had no caller outside their own test files**. The suite was green
and told the truth: every component worked. Nothing in it could notice that §2.2's daily tick had
never been assembled anywhere except inside `weather.test.ts`, that no storm had ever reached a
ledger, or that **no dispatch had ever existed at runtime.**

This is the harder sibling of *"a green suite proves nothing over code the suite deliberately
skips."* There, the gap is visible in what is absent from the suite. Here **there is no gap in the
suite at all** — both ends of every seam are covered — and the missing thing is the call between
them, which no unit test is even shaped to look for.

- **The check is one question, and it is cheap:** *who calls this, outside a test?* Run it over any
  system about to be declared finished. A function whose only callers are `*.test.ts` is a component,
  not a feature.
- **A seam wants an integration claim, and it belongs to whoever builds the second end.** The claim
  is not *"weather damages works"* (a unit claim, and it passed) but *"running the world a year makes
  something in a ledger different from running it with the weather removed."*
- **Corollary for briefs:** when a story's acceptance criteria are all expressible against one
  module, that is a signal the story delivers a component. Ask what would observe it from outside.

### Claim a reversible process in BOTH directions

**Found 2026-09-14, KAN-108.** `works.test.ts` covered the devolution ladder thoroughly — going
**down**. Nobody ever wrote a claim about a work coming back **up**, so when labour allocation
quietly excluded `decayed` from the set it allotted hands to, nothing failed. Every decayed work in
the game was guaranteed to reach `ruin`.

The false statement survived in **three places at once** — the type's *"decay comes in RECOVERABLE
grades"*, the function's *"recoverable at each step"*, and the spec's *"each step is reversible"* —
for the same reason in each case: **the comment was the only thing asserting that half.**

- **Where a name or a comment claims a process is reversible, recoverable, undoable, toggleable or
  symmetric, the suite needs a claim in EACH direction.** One direction tested and the other merely
  described is not coverage; it is a comment with a test standing next to it.
- The same goes for any pair the code names as opposites — open/close, claim/release, enter/exit,
  raise/demolish. **The expensive half is nearly always the return**, which is exactly why it is the
  half that gets written in prose and not in a claim.

## When a test is required

- **Every story with acceptance criteria** turns those criteria into tests — that is what "done"
  means. The town spec's §10 criteria are written to be transcribed almost directly.
- **Every bug fix** gets the failing case first.
- **A tuning pass needs no new tests** — if it does, rule 2 was broken somewhere.

## What not to do

- No snapshot tests of sim state — they pin constants by the back door and break on every tune.
- No mocks or test doubles. Pure functions over plain structs need neither; if something seems to
  need a mock, the system is not pure enough.
- No tests for the render/DOM layer.
- No coverage target. Coverage rewards testing trivia; the criteria above are the bar.
