# Coding Rules — Prototypes

**Scope:** naval + land prototypes · **Authority:** human edits win.

These govern `prototype/` and `prototype-land/`. The design doc is the long game;
prototype code is a thin, **disposable** slice — optimise for how fast a rule can
change after a playtest.

> **Not the durable build.** `game/` is governed by
> [solution-architecture.md](solution-architecture.md) (how it's structured) and
> [testing.md](testing.md) (how it's verified). Durable code is *kept*, so its
> behaviour is pinned by a real suite rather than a throwaway smoke.

- **Disposable.** No abstraction layers, patterns, or extensibility hooks. Plain
  functions and plain objects.
- **One constants file per prototype** — every tunable number in one place.
- **Programmer art only.** Coloured shapes and lines; never spend effort on visuals.
- **Small runnable increments.** One working feature beats three half-features.
- **Verify sim logic headless.** Bundle a throwaway smoke test via esbuild and run
  it under Node before claiming behaviour works; the DOM/canvas layer only runs in
  a browser. *(Prototypes only — `game/` keeps its tests: see [testing.md](testing.md).)*
- **Scope = the brief.** `docs/PROTOTYPE.md` (naval) and `docs/PROTOTYPE-LAND.md`
  (land) define what to build. If a brief is ambiguous, **ask before implementing**.
