# Solution Architecture

**Layer:** HOW (implementation) · **Scope:** cross-cutting · **Authority:** human edits win.

*How the project is currently built. Tooling here is **swappable** — the WHAT it
serves lives under [`../spec/`](../spec/README.md) and stays stable when tools change.*

## What exists today
**Design spec + one throwaway prototype**, plus the **durable build** in `game/`.

- `docs/design-doc.md` — canonical game design (the WHAT; see [`../spec/`](../spec/README.md)).
- `docs/PROTOTYPE.md` — the naval prototype's brief (scope).
- `prototype/` — **naval** prototype. TS / Vite / canvas. Run: `cd prototype && npm run dev`.
- `game/` — **durable build** (land module first). TS / Vite / canvas, data-oriented. Run: `cd game && npm run dev`.
- `docs/knowledge/` — this knowledge base.

## Tech & conventions
- The prototype: **TypeScript on an HTML canvas**, self-contained (own
  `package.json`), **programmer-art only**, deliberately **disposable**.
- One constants file (every tunable number in one place).
- Sim logic is verified **headless** under Node (esbuild bundle); the DOM/canvas
  layer only runs in a browser. See [coding-rules.md](coding-rules.md).

## The durable build — `game/`
- **TypeScript + Vite on an HTML canvas** (same stack as the prototypes) — but built
  for **reuse / scale / performance**, not disposability.
- **Data-oriented:** entities are plain structs in flat arrays; behaviour lives in
  **pure systems** (functions over the world), never on the data. No OOP class graph,
  no ECS framework — generalise only once something repeats.
- Performance is spent where it bites — a spatial grid for neighbour queries, batched
  rendering — added when profiling / counts justify it, not up front.
- Fixed-timestep sim loop (`loop.ts`), rendering decoupled. Sim systems stay pure so
  they're headless-testable; the DOM/canvas layer only runs in a browser.
- **Verified with Vitest** — `npm test`. Pure systems are pinned by a real suite that
  is kept, not a throwaway smoke. Rules and rationale: [testing.md](testing.md).
- **`src/overworld/` is the world layer** — the ~50-port sea, its clock and its
  derived randomness. **Named `overworld` deliberately:** `src/world.ts` already
  exists and is the *raid layer's* battlefield, so a sibling `world/` directory
  would make imports ambiguous. Every world-layer file goes here; **do not create
  a `world/` directory and do not fold world state into `src/world.ts`.**
- **`src/worldview/` is the world layer's PRESENTATION, and the split is a rule rather than a filing
  preference** (added 2026-09-15). `town/guardrails.test.ts` **discovers** every file under
  `src/overworld/` and enforces the simulation's rules on it — including `[P-11]`, *never read a wall
  clock*. A render loop must read one. Keeping the view in its own directory is what lets **both**
  rules stay absolute instead of growing an exception list, and the boundary is asserted in two
  directions: a scan fails if any simulation file mentions `worldview`, and a second scan enforces
  `[P-5]`'s banned-`Math` list over `worldview/` — minus `performance.now`, deliberately. *Proven by
  experiment rather than by reading: `performance.now()` planted in `worldview/` leaves the whole
  suite green.* Presentation-side caches derived from world state (`[P-17c]`) live here, never on the
  `World` struct.
- **Two entry points.** `index.html` → the land raid; `town.html` → the standalone
  **town module** (`src/town/`), the living-town economy built as its own startup file
  and deliberately not wired into the raid yet (epic KAN-67).

## Deliberate non-choices
- **Durable stack = TypeScript + Vite** (decided 2026-08-17). The earlier C#/.NET +
  Godot durable build stays set aside — don't re-propose *that* engine/language.
- **No datastore chosen yet.** *What* to persist is a WHAT question for `../spec/`;
  *which* database is a HOW decision, deferred until the spec needs it.
  (See [`../decisions.md`](../decisions.md).)
- **No renderer chosen beyond the 2D canvas** (parked 2026-09-22). `game/` draws to an HTML
  canvas and that is all that is settled; WebGL2, WebGPU and staying on canvas are all still open,
  and nothing in `game/` may be shaped around any of them. **One fact belongs in that decision when
  it is made:** WebGL2 has no indirect draw and no compute shaders, so a GPU-written draw list — the
  technique behind the big wins in GPU-driven voxel rendering — is possible on WebGPU only. Written
  up, with what else changes when the GPU becomes the reader, in
  [performance.md §9](performance.md#9-the-gpu-is-a-different-computer).
- **NO MOD SYSTEM — and don't re-propose one** (decided 2026-09-10). Content lives in **data
  tables**; there is deliberately **no loader, no manifest format, no versioning, no load-order
  resolution, no merge semantics, no sandbox and no public API to keep stable.** Those are the price
  of a *second author*, and there is one consumer. The tables are most of what a mod system would
  need, so a loader can be added later on top of content that already lives in data — that is a small
  job, and building it first would be a road to nowhere. **Behaviour stays in code: no DSL, no
  scripting language, no rule engine** (`[HC-90]`–`[HC-92]`).

> The prototypes' opposite *control philosophies* (naval = group-command / captains
> interpret; land = direct RTS) are **design**, not architecture — they live in the
> spec, not here. See [`../spec/README.md`](../spec/README.md) and `design-doc.md`.
