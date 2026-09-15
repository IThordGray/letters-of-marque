# Board backlog — work done while the Jira connector was down

**Scope:** cross-cutting · **Authority:** human edits win · **TEMPORARY — delete this file once the
board is caught up.**

The Atlassian connector dropped its tools mid-session on **2026-09-14** and stayed down through
**2026-09-15**. `claude mcp list` reported the server healthy throughout; the tools were simply absent
from the session's registry, and a freshly spawned agent could not see them either. Work continued;
the board did not.

Every code commit below carries a `NO TICKET YET` line in its body naming what it needs. This file is
the same list in one place, so it survives a session restart.

---

## 1. Tickets to CLOSE, with their outcome

The house rule is **do not close a ticket you cannot record the outcome of** — so each of these needs
its findings written onto the ticket, not just a status change.

| Ticket | Commit | Outcome to record |
|---|---|---|
| **KAN-106** — the population floor is unconditional | `84555a3`, merged `5367cc5` | `POP.floor` deleted; the floor is emergent and is a **LABOUR** floor of 10.91 souls (`gardenPlots.hands / WORKS.labourShare`), not a food one. Found a **tautological test** that asserted population ≥ `POP.floor` against a generator applying that same floor two lines earlier. Surfaced the poor-ground spiral (see KAN-106b below). Follow-up comment fix in `ada6e06`. |
| **KAN-107** — the town owns a private clock | `f8a2971`, merged `37f3a42` | `Town.season` deleted; every date is days since world epoch. Calendar extracted to `overworld/calendar.ts`, a **leaf that imports nothing**, with a test asserting so. `SEASONS_PER_YEAR` deleted (`[P-47]`'s third instance in a week). Anticipated KAN-99's negative days and chose `Math.floor` over `Math.trunc`. **Recovered from an interrupted run** — the work was complete but uncommitted. |
| **KAN-108** — `decayed` works are a dead end | `ef49c32`, merged `811e0b5` | Ladder grades now differ in what coming back **costs**, not whether it is possible. A mend buys a rung and never a jump. Repair lives in the governor, not the works ledger, because `[HC-78]` pays imports before construction and `stepWorks` runs in phase 1. **The ticket's "sterilises their own ground" was overstated** — it is a four-year hold, not sterilisation; corrected on the spec. |
| **KAN-100** — the world map view | `b15bb2e`, merged `e6ac81b` | Built and **verified in a real browser** (1660→1760, no console error, sea box exact to the pixel). Coast baked into one `Path2D` in world coordinates; per-port felt-severity rings; five named rates plus a blocking century; a chronicle of changes of standing (247 lines/century) and a trend line that reads *"population found their level"*. Carries a test pinning that **nothing is promoted and nothing changes hands** — it should FAIL the day KAN-101 lands. |

---

## 2. Tickets to CREATE (work already done — say so in the description)

Per `workflow.md`: *if the work was already done before the ticket existed, say so in the description
rather than pretending otherwise.*

| Type | Summary | Commit | Parent |
|---|---|---|---|
| **Story** | The weather seam — compose §2.2's daily tick and wire weather to the ledger | `5d5c1e7`, merged `225c21e` | KAN-96 |
| **Story** | The coastline bake — contour the height field once into drawable geometry | `3bde4f8`, merged `ea7a0a3` | KAN-96 (part of KAN-100's view) |
| **Bug** | Storm maintenance was charged as a share of the treasury | `bb68bc9`, merged `6d2976b` | unparented or KAN-96 |
| **Bug** | Poor food ground cannot sustain the hands that work it (`[HC-18]` breach) | `509d6c2`, merged `ef25062` | unparented |
| **Task** | Nothing configured the test runner, so the suite ran on a 5 s default and flaked | `18aacdb` | **unparented** (cross-cutting infra) |

All get the `ai` label. Remember the two ADF quirks in `workflow.md`: a heading inside a blockquote is
**dropped silently**, and `labels`/`parent` go through `additional_fields` and are **not echoed back**
— re-read the issue to confirm they landed.

---

## 3. OPEN FINDINGS — recorded, not scheduled, and each wants a decision

None blocks anything. All are written up in `decisions.md` under 2026-09-15.

1. **Nothing bounds a treasury.** Weather's proportional drain was the only thing stopping wealth
   accumulating without limit, and it is gone. The map shows coin climbing unbounded across a century.
   **If the totals read wrong, the answer is a wealth sink, not a bigger storm.**
2. **`bandFloorShare` puts a sawtooth at every weather band boundary, in every column** — the bottom
   of a gale can cost less than the top of a blow. Pre-existing, affects yield as well as maintenance,
   never examined.
3. **`provisionGround` has a margin of 0.9625 on poor ground** and cannot pay its own wages there. The
   governor's problem by design and it cannot empty a place, but it is the only food work in the
   catalogue still under water anywhere.
4. **Weather costs ~30% of population and 40–50% of wealth over two centuries.** Correct per the
   spec's own sentences and now visible on the map — but worth a look now that it can be seen.

---

## 4. Still unbuilt in the epic

- **KAN-101** nations act — unlocks colour changes, promotions and war. The largest remaining piece,
  and the one KAN-100's failing-by-design test is waiting for.
- **KAN-99** warm start — inherits `[HC-22]`'s founding rule and KAN-107's negative-day constraint.
- **KAN-112** `access` reads real routes and blockades — what `[HC-87]` needs to be demonstrable at
  world scale.
