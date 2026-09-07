# Decisions Log

**Scope:** cross-cutting · **Authority:** human edits win · **Newest at top.**

Ratified decisions and their rationale — the manager's capture log. Game-mechanics
detail lives in `../design-doc.md`; this log records *what was decided and why* so
nobody relitigates it. Entry format: **date — decision.** Then *why*.

To add an entry: newest at top, keep it short, state the rationale. Human edits win.

---

### 2026-08-25 — The plunder layer: haul-vs-cost, destroy-by-fire, prisoners as a subsystem
How a raid becomes open-ended piracy (shaped with the game-designer; refined by the human).
The Strongbox spine (mark → seize/channel → carry → drop-if-carrier-falls → extract) *is* the
plunder mechanic — generalise it, don't rebuild it.
- **Haul = carriable loads, banked only at the boats.** Looting a building (a seize-style
  channel — costs *time*, so the alarm bites) spawns a plunder load; it counts only when a
  carrier reaches the beach. A laden figure **can't fire and moves slower** (one load each).
- **The ending is a ledger, not a flag** — *haul banked vs cost paid* (men, officers, time).
  The four grades (clean/pyrrhic/failed/disaster) keep their keys but derive from the ledger ×
  how the band left the field. Everyone reaching the boats = cast off & tally (the ratified
  extraction rule *is* the quit-while-ahead decision).
- **Destroy = one path (fire, for now).** Cutthroats had a single "destroy" — we torch by
  **spending powder** (ammo = incendiary; *loud* → alarm spike). Destroying a building **loses
  any value still inside it** AND **damages the town economy** (a razed lumberyard = less/no
  lumber — a hook into the parked economy KAN-54, stubbed now). No general fire-spread; the
  **powder magazine explodes** as a set-piece.
- **Prisoners — a subsystem, not just the gaol.** You may take prisoner **anyone whose will is
  broken and hasn't fled**. A broken figure **flees if escape looks safe, but gives up if it'd
  likely be shot** — a new **surrendered/yielded state** (broken-and-cornered), distinct from
  routing. **Gaol captives are likely to want to join** the crew; **townsfolk taken prisoner
  generally won't**. **Resolution is at the END of the battle — join / ransom / release —
  never mid-fight.** ransom → gold, +infamy; release → renown, +fame (currency **stubbed**
  until the strategic layer).
- **Loot value follows building role** — seed per-kind now (church/governor rich, warehouse
  bulky, magazine = powder, gaol = prisoners); re-sourced from KAN-54 later. Reference the
  economy, don't design it. Keep it legible, never a spreadsheet.
*Why:* the interesting decision is greed vs the clock (and vs mercy) — the will-spine breaks
who's in the way, plunder-vs-cost measures the raid, and the town becomes a place you *use*.

---

### 2026-08-25 — Town economy: logical, place-specific production & trade (parked epic)
Captured as an epic to build later — the economy ties into the **towns**, and production is
**logical and place-specific**, not uniform:
- Some buildings produce for **local consumption** → *not* tradable (a tavern baking its own bread).
- Some produce an **exportable / tradable resource** (a logger → timber); a town with that producer
  **sells it to visiting ships**.
- **Not every town has every building** — what a town produces and needs depends on what it has, so
  trade is specific to place; ships buy/sell accordingly.
Ties to: the `Building` entity (kinds → economic roles), the **real trade-economy pillar**
(*Port Royale* depth), the **plunder layer** (a building's loot value follows its economic role), and
the future **building-variety** expansion (bakers / grocers / smiths / loggers / farms). Keep it
*logical*, not a spreadsheet. Scope with the game-designer when picked up.

---

### 2026-08-25 — Garrison strength scales with settlement importance (a stats rule, not a mechanic)
A logical rule for setting unit-strength sliders until faction AI exists — purely reflected in
**unit stats (ferocity / marks / morale) and officer quality**, no new mechanics:
- **The player's pirates are generally stronger** — they live for fighting.
- **Small outpost garrisons (outskirts) are weaker** — little training, not on high alert, low experience.
- **Capital / headquarters cities are stronger** — highest discipline, better troops *and* better officers.
So an outnumbered raid on a sleepy outpost is winnable and a capital is genuinely hard — set logically by
**settlement tier**, not by faction-AI machinery. This is the precursor the later faction-identity AI
will replace with real behaviour; for now it just configures the strength sliders.

**Ratified specifics (2026-09-07):**
- **Tier drives both stats *and* size/composition.** A tier sets per-unit stat *bands* (absolute
  profiles, not multipliers) **and** the garrison's depth — plaza-guard size, sentry posts, patrol
  count, squad size, reinforcement-wave sizes. A sleepy outpost is *fewer, weaker* men; a capital is
  *more, better* men with a deeper muster.
- **Three tiers as discrete bands:** `outpost` (brittle — breaks early, poorly drilled, a middling
  sergeant, a thin watch) · `town` (≈ today's baseline) · `capital` (disciplined — steady, breaks
  *late*, fine officers, a deep garrison). Morale is the sharpest dial because the spine is *break
  the will*: an outpost's men sit barely above the steady line and crumble; a capital's sit well
  clear and hold.
- **Player crew baseline — seasoned, not veteran.** The landing party is a *notch* above the town
  rabble in skill (they know their way around a fight), and **notably steadier — they don't break
  easily** (morale set well clear of the steady threshold), but they are *not* invincible. Officers
  top out around **brigadier** quality — the rolled roster is already about right, so the player edge
  lives mostly in steadier *pirates*, not inflated officers.
- **The current playable town defends at `outpost` grade for now** — so the raid reads as winnable
  against a seasoned band (it played *brutal* before). Real per-town tier assignment comes with the
  strategic map. Concrete band numbers are starting guesses — **tune by playtest.**

---

### 2026-08-25 — The town raid ground: an open Caribbean port; buildings are game objects, not scenery
The raid happens *in* a town, not on an open field — playtest showed the field fight is a
slugfest that can't be balanced because the environment does nothing. Ratified shape (shaped
with the game-designer):
- **An open Caribbean port**, not a fortress: open waterfront + docks (where you land, and the
  extraction), a main street up through irregular lanes to a **plaza** with the strong-house (the
  objective sits *inside* it), warehouses, a gaol, a powder magazine, a **barracks** at the back the
  muster sorties from, a **battery** on the high ground, a **token landward palisade + gate**. A
  walled-fort assault is a later *scenario type*, not the default.
- **Buildings are first-class entities** (a `Building` with `kind` + reserved `state`/`loot`), not
  render decoration or terrain rects — so the town **feels part of the game, not just obstructions**
  (the human's explicit steer). You'll **loot / raze / torch** them (deferred plunder layer);
  churches & the governor's house are the rich targets; and — per Cutthroats — a building is **set
  alight by spending powder** on it (powder is ammo *and* incendiary). The loot-vs-gold split
  collapses into one legible **haul**, typed by building.
- **No fog-of-war / vision cones** (ratified by the human): the player keeps full top-down
  visibility; buildings block only **fire** (line-of-sight) and **movement**; the alarm stays
  diegetic-proximity. Keeps it a brawl, not a stealth puzzle.
- **Distributed garrison** replaces the single clustered band — sentries at posts, patrols on
  routes, the guard at the plaza, a reaction force sortieing from the barracks — *same headcount,
  spread in depth*, wired to the alarm already built (a sentry/patrol spotting you is the rouse; the
  waves are the muster).
- **Sequencing principle:** most of the town feel + tactical uplift needs **no pathfinding or LOS**
  — reuse cover/high/choke + placement first; the heavy tail is **movement-block (thin collision) →
  fire-LOS → full pathfinding**, sequenced last.
*Why:* geography is what makes the asymmetric raid balanceable and interesting (positioning bites; a
distributed garrison breaks in pieces, not as one bar); and an interactive town is the substrate the
open-ended plunder layer needs. Map grows to ~2400×2600 — every added pace town or approach, never
empty field.

---

### 2026-08-25 — Raids are open-ended plunder: cost vs reward, not a binary win/lose
Sharpening the raid frame (from the human). A raid is **piracy**, not a mission with one
win-flag: you're there to **take what you can and get out before it costs more than it's
worth**. The single Strongbox in the current slice is *scaffolding* on a reusable spine
(marker → seize → carry → extract) — the real raid offers a **spread of opportunities**
(loot warehouses/houses, take **prisoners** for ransom, seize a strongbox, spike guns, torch
a target), and the player chooses **how greedy to be** against the rising alarm. The outcome
is a **ledger — haul taken vs cost paid** (men lost, crew you still need to sail home),
*graded* not binary; sometimes there is no "objective" at all, just *"was it worth it?"*.
The will-spine stays the **tactical means** (break whoever's between you and the loot);
**plunder-vs-cost is the raid-level measure**. Each opportunity carries its own take and its
own **noise/risk** (torching is loud; a warehouse costs time on the clock). Fixed must-take
objectives (rescue, assassinate) become **one scenario *type*** on the same framework, not
the default.
*Why:* matches the Cutthroats heritage (the OG raids were open looting / prisoner-taking, not
designed objectives) and the "pirate, not an emperor" pillar; makes the core decision
economic (greed vs risk) — which the graded outcome + alarm clock already seed — and feeds
the havens layer (pillage / raze / occupy = depths of *taking* a place) and fame/infamy.

---

### 2026-08-25 — The land raid: objective + extraction + a diegetic alarm-clock
The land engagement is an **outnumbered objective raid**, not a symmetric fight to the
last. **Win = seize the objective and extract**; outcomes are **graded** — clean success ·
pyrrhic (got it out, lost people) · failed-but-survived (withdrew empty-handed, your people
live to raid again) · disaster (your will breaks / you're cut off). The **objective is the
point; breaking will is the means** — still the one spine, never attrition. A full local
rout still counts as a clean sweep, but you must be present to take the objective.
- **The clock is a staged, diegetic ALARM, never a countdown.** *Quiet → Roused → Alarm →
  General Muster*, surfaced in plain language, raised by *tactical events* — gunfire
  (muskets are loud), time ashore, seizing, and **routed defenders who escape off-map and
  raise the cry** (the will-spine feeding the clock). Reinforcements muster in waves, tuned
  to **push you out, never to be farmed**. Advantage decays raider → defender over time;
  that decay *is* the get-in-get-out arc.
- **No-timer pillar reconciled (ratified by the human).** §1.1 governs the *management
  meta-layer* — recurring decisions serviced on a schedule, gauges you audit. It does NOT
  govern real-time tactical tension inside a live fight (reload, morale drain, the wind at
  sea). The raid alarm is the second kind: a threat you feel and react to, reading as a
  *cause* (mirrors `stepMorale`), asking for no scheduled decision.
- **Extraction = the beach you landed on** (near edge). Success = the objective (its carrier)
  reaches it; how many of the band also get out is a *grade*, not a gate. Withdrawing is
  always available (just move to the boats) — no prompt, no nagging system.
- **Alarm is driven by ACTIONS, not headcount** — landing more crew stays a *benefit* (per
  the Deploy & Equip call), not a penalty.
*Why:* the raid is the origin engagement the whole land module serves; this gives it a
purpose (objective), a reason to leave (extraction), and rising pressure (alarm) — without
a management timer, all through the will-spine and the sim we already have. Shaped with the
game-designer. The objective/extraction/alarm structure is *our* design — the original
Cutthroats land raids were straight field fights (confirmed by the human).

---

### 2026-08-18 — Deploy & Equip: outfit a raid once (unnamed crew pool + named officers, per-unit ammo, permadeath)
How the player composes and kits a landing party before a raid — the front end that
replaces the fixed test spawn. Ratified shape (shaped with the game-designer):
- **No artificial cap.** A hard "boat capacity" limit was rejected as unnecessary
  friction — boats shuttle under cover of dark. Landing *more* crew is a genuine
  **benefit** (raw force in an outnumbered raid), so the raid must not tax party size.
  The real constraint sits **upstream, at the voyage/strategic layer**: sustaining a
  large crew — provisioning + keeping morale up across a voyage — is the hard part; a
  player who pulled that off has *earned* the option to land them in force. (A bigger
  party being *louder* — alarm/stealth — is at most a soft, optional factor, never
  load-bearing.)
- **Per-unit ammo, not a shared pool.** Each figure carries its own powder and can
  reload a few times; dry → falls back to the cutlass (KAN-30). Per-unit ammo makes
  *how you use, layer and rotate* your musketeers a real tactic.
- **Death is permanent.** A figure cut down is lost for good (no post-battle recovery).
  A future **medic** specialised unit will stave off fatalities — but until specialised
  units exist, down = dead.
- **Unnamed crew pool + named officers.** For now pirates are an **unnamed pool** you
  draw from and equip by group; **officers are named**, freely chosen and assigned to
  lead squads (their stats carry over to their men).
- **Framing:** outfitting is a one-time "load the boats" expedition decision — batched,
  diegetic — *not* a screen serviced before every skirmish (distinct from the naval
  standing-organisation rule).
*Why:* keeps the interesting choices (weapon mix, which officers to risk, how to spend
per-unit ammo) without the busywork Cutthroats was criticised for; composition pressure
is diegetic, never an arbitrary number.

---

### 2026-08-17 — Perks / fatigue / instrumentation (KAN-20) rejected as-is
The prototype's **perks + fatigue + instrumentation** approach is NOT being ported —
the human doesn't like how the prototype did it. KAN-20 is parked (`backlog`) pending
a fresh design; do not port it blindly. The rest of the land-combat epic (KAN-12–19)
shipped as a faithful port of the validated model.
*Why:* the texture layer deserves a rethink, not a port; the core will-spine is what's
validated and worth keeping faithful.

---

### 2026-08-17 — Contextual command (right-click resolves; menu only when ambiguous; verb-key bypass)
The universal command interaction across land, naval, and strategic:
- **Right-click resolves the valid actions** for (selection → target): 0 → nothing;
  **1 → do it immediately, no menu** (ground → move; live enemy → attack); **2+ → a
  context menu** (surrendered enemy → kill / take prisoner / loot; ship → attack /
  board / ram).
- **Explicit-verb bypass:** press a verb key then click — `A` + unit → attack it,
  `A` + ground → attack-move.
- **Same mechanic everywhere;** only the verb set changes with context. The
  "enemy has given up" verbs are the *payoff* of breaking will.
*Why:* one fast, legible interaction — no modes for the common case, full depth when
there's a real choice.

---

### 2026-08-17 — Land combat: faithful port of the proven will-spine sim
Durable land combat ports `prototype-land/src/sim.ts` (playtested fire / melee /
per-figure morale / flanking / rout / contagion / officer presence / rally; win =
enemy will broken, never annihilation) into `game/` as pure systems. Durable-build
changes: a **seeded PRNG** in world state (morale state machine stays deterministic;
lethality stochastic-but-replayable, headless-testable); neighbour / side queries
behind one helper so a spatial grid drops in later. Command = contextual right-click
(above) + **three postures** (*At 'em / Hold fast / Hold fire*) shown per-unit + a
Halt action; loose formation default. Delivered as a nine-story epic, **morale the
gate, taken slowly.** Borrow "broken men stop obeying"; never steady-men disobedience
(the naval-interpretation layer, banned on land).
*Why:* the fun is validated — the work is a faithful, durable, legible port, not a redesign.

---

### 2026-08-17 — Design informed by heritage + comparable games (game-designer)
Added a `game-designer` specialist: it knows the *Cutthroats* heritage and how
comparable games handle similar mechanics, and feeds pirate-flavoured options into
how features are built — so design draws on deeper game knowledge, not just the
literal request. Uncertain calls get verified with the human. Standing reference:
[spec/design-references.md](spec/design-references.md). We adapt genre patterns to
pirate/privateer flavour; we never clone another title.
*Why:* better mechanics come from knowing the lineage and the genre.

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
