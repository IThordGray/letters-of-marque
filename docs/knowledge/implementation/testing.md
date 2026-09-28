# Testing rules

**Scope:** `game/` (prototypes follow [coding-rules.md](coding-rules.md)) · **Read by:** every agent
that writes or reviews a test · **Authority:** human edits win.

## Setup

- Vitest. `npm test` before every commit; `npm run build` runs `tsc`, so type errors block it.
- Tests sit next to their module: `x.ts` → `x.test.ts`. Build fixtures with `makeTown()` and
  hand-written structs (`town/fixtures.ts`).
- Test pure sim systems only. No render, canvas, DOM, input, camera or loop tests — playtest those.
- The timeout (120 s, `vite.config.ts`) is a hang detector, never a performance gate. A synchronous
  infinite loop cannot be timed out at all — see `[P-48]`.
- No snapshots, no mocks or test doubles, no coverage target.

## The two house rules

1. **A test name is a design claim** — a sentence about the game (`"crawls back to a hamlet rather
   than dying"`), never about a function (`"stepSeason updates population"`).
2. **Assert directions and relationships, never tuned constants.** Constants are guesses meant to
   move; the suite stays green unless a rule broke.

## What must be tested

- Every brief's *Done when* becomes a test. Every bug fix starts with a failing case. A tuning pass
  needs no new tests — if it does, rule 2 broke.
- Every module has a same-seed reproducibility test.
- Pin only behaviour the spec ratifies — never merely what the code does now.
- A seam gets an integration claim ("running a year with weather changes a ledger vs without"),
  owned by whoever builds the second end. **Who calls this outside a test?** — a function only
  tests call is a component, not a feature.

## A claim must be able to fail

The pattern behind most of these: a test passes, but would also pass if the thing it names were broken.

- **Mutate and count.** When a change touches code, break it deliberately and count failures. A test
  that survives the mutation it claims to cover is decoration.
- A predicted survivor is acceptable only when its precondition is **measured**, not argued — then
  add a claim that fails the day the precondition stops holding.
- **Write the oracle out.** Never compute the expected value by calling the code under test or reading
  its own constant; spell the formula out.
- **Zero satisfies absence.** A claim of stability or absence ("stops", "never exceeds", "none")
  also asserts the subject is alive / non-empty.
- **Exclusions use the loudest member** — the one whose inclusion would move the number most, never a
  zero.
- **Name what you forbid.** "None of these three" names the three; no exact-set assertions.
- **Claim reversible things both ways.** Anything named reversible, recoverable or paired
  (open/close, claim/release) needs a claim in each direction.

## A fixture must tell the cases apart

- Ask what input separates the right answer from the plausible one, and put it in the fixture.
- Fixture coordinates are off-origin and asymmetric.
- Degenerate cases a float field never produces are constructed in exact binary; arithmetic claims
  use divisors where the forms actually differ.
- Build against the struct, never through a producer that is due to be replaced.
- **Enumerate, don't derive:** find which cases exist (ties, collisions) by brute force. When a
  determinism argument rests on two floats being equal, check that they are.

## Statistical claims

- Sample enough seeds / places that the with and without distributions do not overlap; write the
  measured ranges into the test.
- Bound a distribution pooled across seeds, not per seed.
- A fixture claims relationships; magnitudes (earns, spends, accumulates) come from a warm world.
- Select the subject and assert on it at the same instant. Know whether you assert on a flow
  (per-season, may be zero for ordinary reasons) or a level.
- A claim about an outside force closes the inside route first.
- Don't pin a ratio whose denominator the next change will move — bound the mechanism.
- Multi-arm comparisons: warm the world once, `structuredClone` each arm.
