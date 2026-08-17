# Decisions Log

**Scope:** cross-cutting · **Authority:** human edits win · **Newest at top.**

Ratified decisions and their rationale — the manager's capture log. Game-mechanics
detail lives in `../design-doc.md`; this log records *what was decided and why* so
nobody relitigates it. Entry format: **date — decision.** Then *why*.

To add an entry: newest at top, keep it short, state the rationale. Human edits win.

---

### 2026-08-17 — Durable build begins: TS/Vite, land first, data-oriented
Starting the durable game build in **TypeScript + Vite** (same stack as the
prototypes), beginning with the **land module** in a new `game/` project.
Architecture is **data-oriented** — plain-struct entities in flat arrays, systems as
pure functions; spend the performance budget where it bites (spatial grid for
neighbour queries, batched rendering), not on OOP class graphs or a full ECS
framework. Generalise / reuse only once something repeats.
*Why:* the throwaway prototypes validated the fun; land is the conception core, so
it goes first. Data-oriented beats naive OOP for scale and needs far less machinery
than ECS at skirmish counts, where the real costs are algorithmic (O(n²) scans) and
rendering — not the object model. The earlier C#/.NET + Godot durable build stays
set aside; TS/Vite is the durable stack now.

---

### 2026-08-17 — Knowledge base split WHAT vs HOW
Knowledge is organised so *what the game should do* (tool-agnostic — `spec/`, plus
`process/` for how we work) stays separate from *how it's built* (`implementation/`:
tooling, DB, frameworks, code). No file mixes the two.
*Why:* rules and requirements outlive tool choices; we may spec *what* to persist
before choosing a database, and swap tools later without rewriting the spec.

---

### 2026-08-17 — Adopted Jira ticket-per-commit workflow
Every feature/bug is a Jira ticket (epics split into stories); **one ticket = one
commit**; tickets carry a description; AI-created tickets get an
`ai` label. A `ticket-manager` agent owns the board.
*Why:* tight traceability between board, git history, and each change; keep AI- and
human-created tickets distinguishable. Full rules in [workflow.md](process/workflow.md).

---

### 2026-08-14 — Durable build set aside; prototypes only
The C#/.NET + Godot durable build was reverted. The project is now design-spec +
the two TS prototypes.
*Why:* validate the fun before committing durable engineering. Don't re-propose an
engine/language unless asked.

---

## Ratified design pillars (do NOT relitigate — detail in `design-doc.md`)
These are settled. Read the design doc before reopening any of them.

- **Officers are the connective tissue.** Rolled stats → perks; they buff the men
  they lead; they persist and travel land↔sea. The *person*, not the hull.
- **No timer-driven decisions; nothing to audit like a spreadsheet** (§1.1).
  Management is batched, in-port, optional to optimise, and **delegated** (trade
  routes by a captain, havens by a governor). Depth underneath; configure-and-
  delegate on top.
- **Golden thread — land-outward.** Land is the core of decision-making; officers
  carry skills outward to sea. Conception order land → sea → strategic (a lens,
  NOT a dev order, NOT licence for shallow layers). (§1.2)
- **One spine — break WILL, not attrition.** Runs unbroken: a flanked musketeer →
  a ship striking her colours → a town paying tribute → a nation deciding you're
  not worth the blood. Every combat/reputation system is a facet of this.
- **Naval:** command **GROUPS** (2–5 groups, 1–4 ships each); captains **interpret**
  orders deterministically & legibly (never a per-frame dice roll); group speed =
  slowest ship; orders are instant.
- **Land:** command **individual figures RTS-style** (stances: aggressive ·
  hold-ground · cease-fire); officers are advantage, not interference; **will is
  the win condition** (rout, not annihilation); positioning (flank/enfilade)
  attacks morale; collapse reads as a cause, not a bug.
- **Strategic (design only, not prototyped):** havens pillage/raze/**occupy**
  (loyalty-gated officer-governor; breadth breeds defection; friction-capped —
  pirate, not emperor); **real** trade economy (*Port Royale* depth) delivered by
  delegation; **fame/infamy** = the will-spine at map scale; campaign arc =
  **legacy & retirement** (§7.4), aging is the clock, legacy is the goal, no hard
  win-screen.
