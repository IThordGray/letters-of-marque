# Knowledge Base

The team's **single source of truth**. The manager (`../../CLAUDE.md`) and every agent
in `.claude/agents/` read from here. Lives in the repo so it travels with the code.

## The core split — WHAT vs HOW
Knowledge about **what the game should do** is kept separate from **how it's built**.

- **WHAT** — [`spec/`](spec/README.md): tool-agnostic and durable. Rules, behaviour,
  what data must persist, what an algorithm must achieve. Barely changes when tooling does.
- **How we work** — [`process/`](process/workflow.md): testing, ticketing. Also
  tool-agnostic; kept apart from both spec and implementation.
- **HOW** — [`implementation/`](implementation/solution-architecture.md): swappable.
  Language, DB, frameworks, coding rules, concrete code.

> **Rule of thumb:** if swapping the underlying tool would force a rewrite, it's HOW.
> **Never mix WHAT and HOW in one file.**

## Governance — two rules
1. **Human edits are authoritative.** If a human edits a knowledge file, that text
   wins — the manager may append or *propose*, never silently override.
2. **Capture durable knowledge.** Decisions/facts that outlive the conversation go in
   the right file below; ephemera do not.

## Layout
| Path | Layer | Holds |
|------|-------|-------|
| [`../design-doc.md`](../design-doc.md) **(v0.17, CANONICAL)** | WHAT | THE game design — master spec. |
| [`../PROTOTYPE.md`](../PROTOTYPE.md) · [`../PROTOTYPE-LAND.md`](../PROTOTYPE-LAND.md) | WHAT | Prototype scope / briefs (naval · land). |
| [spec/](spec/README.md) | WHAT | Behaviour, rules, requirements, data-to-persist, algorithm specs. |
| [spec/design-references.md](spec/design-references.md) | WHAT | Cutthroats heritage, comparable-game mechanic patterns, pirate-flavour fit. |
| [spec/world-simulation.md](spec/world-simulation.md) | WHAT | **The core simulation** — tick order, how the seven world systems drive each other, and the cross-cutting hard constraints. Start here for anything world-scale. |
| [spec/town-economy.md](spec/town-economy.md) | WHAT | Living towns — the works ledger, parcels, the governor's plan, archetypes, map projection. |
| [process/workflow.md](process/workflow.md) | process | Tickets & commits (Jira, 1 ticket = 1 commit, `ai` label). |
| [implementation/solution-architecture.md](implementation/solution-architecture.md) | HOW | Stack, repo layout, run commands, non-choices. |
| [implementation/coding-rules.md](implementation/coding-rules.md) | HOW | How **prototype** code is written & verified. |
| [implementation/testing.md](implementation/testing.md) | HOW | How the **durable build** (`game/`) is tested — Vitest, and the two house rules. |
| [decisions.md](decisions.md) | cross-cutting | Ratified decisions & rationale (note each entry's layer). |

## Relationship to memory
The user-level `memory/` (outside the repo) is the manager's private cross-session
recall. This knowledge base is the *team's* shareable truth; where they overlap, the
knowledge base is canonical.
