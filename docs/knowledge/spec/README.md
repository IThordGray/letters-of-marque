# Spec — What the Game Should Do

**Layer:** WHAT (tool-agnostic) · **Authority:** human edits win.

This folder holds the **behaviour and requirements** of the game and its systems —
*what* things should do, independent of *how* any tool does it. It stays valid when
the implementation tooling changes.

## Canonical root
[`../../design-doc.md`](../../design-doc.md) (v0.17) is the master game spec. Finer or
derived specs live here as `spec/*.md` and must not contradict it.

## What belongs here
- Game rules and required behaviours (combat, morale / will, sailing, economy…).
- **Data requirements:** *what* must be persisted and why — a logical model — **not**
  which database or schema (that's implementation).
- **Algorithm behaviour:** what a routine must achieve and its guarantees (e.g.
  "pathfinding must avoid land and prefer wind-favourable headings"), **not** the code.
- **Acceptance criteria:** how we'd know a behaviour is correct.

## Start here

Two **one-page designs** carry the overview. Read whichever loop you are about to touch before
opening the detail spec beside it.

| | |
|---|---|
| [world-loop.md](world-loop.md) | The two clocks, the season's five phases, what drives what, and what is not built yet. |
| [town-loop.md](town-loop.md) | Four moving parts and one loop — the whole town engine on a page. |

The detail lives in [world-simulation.md](world-simulation.md) and
[town-economy.md](town-economy.md); each one-page design names which of their sections to open for
anything it deliberately leaves out.

## What does NOT belong here
- Languages, frameworks, databases, file formats, concrete code → [`../implementation/`](../implementation/solution-architecture.md).
- How we test or track work (tooling-agnostic process) → [`../process/`](../process/workflow.md).

> **Rule of thumb:** if swapping the underlying tool would force you to rewrite the
> text, it's implementation — put it in `../implementation/`, not here.
