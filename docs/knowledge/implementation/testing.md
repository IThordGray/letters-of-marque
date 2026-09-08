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
✅  expect(derive(t).tier).not.toBe("capital")
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
