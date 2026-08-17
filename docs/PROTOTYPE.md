# PROTOTYPE.md — the working spec

**This file, not `design-doc.md`, is the brief.** The design doc is reference material for a full game; roughly 85% of it is out of scope here. If something is in the design doc but not in this file, it is not being built.

---

## 0. Revision log — playtest-driven changes

Newest first. These override the original text of the sections they touch.

**2026-07-27 (interpretation rebuilt — supersedes the freeze below)**
- **Interpretation is back, redesigned to read as character — §14.1 is now built.** It is **deterministic**: a captain's behaviour is a stable function of fixed temperament + situation + current order, so there is no flicker. Four legible deviations, each tied to a trait the player was shown — **chase** (an aggressive subordinate runs down a cripple), **refuse-recall** (a wilful + aggressive captain won't answer a Break-off), **shy** (a wilful + timid captain won't close on Engage), **unnerved** (a low-nerve captain sheers off before he'd ever strike). Deviations commit and hold (hysteresis) and are narrated only on transition. Verified headless: **≤2–3 mood changes per ship per battle** (vs the old 20 s coin-flip), and all four fire. Tuning in `constants.ts → INTERP`.
- This **restores non-negotiable §3.2**; the freeze below was the interim step. The obedience→**mutiny** escalation is still future work.
- **Temperament only nudges — deviations are rare (tuned).** Shipboard discipline is lethal (ignore a signal in action and you're shot), so officers obey almost always; thresholds are set strict enough that only genuinely extreme captains deviate, in the fitting situation — a few character moments per battle, not "nobody listens." No punishment mechanic; the deterrent is the low rate itself (and emergent: a ship that breaks formation gets isolated and mauled).

**2026-07-27 (after concept playtests)**
- **Captains now follow orders.** The temperament-driven *disobedience* — the obedience compliance roll, aggression chase-defection, and aggression closing shorter than ordered — is switched **off**. Officer stats are still rolled and shown; **nerve still governs striking colours.** The order-bending behaviours are reserved for a future **crew-morale / mutiny** mechanic. Toggles live in `prototype/src/constants.ts → RULES`. See revised §3.2 and §8.
- **Consequence:** the "mistakes read as character" pillar is on hold, so the live risk is now the *spectator / set-and-forget* failure. This raises the bar on the tactical layer — see the new **§14**.
- **Irons made rare.** Missed-tack chance 0.35 → **0.12**, duration 8–15 s → **5–10 s**. Everyone can sail; a fumbled tack is a hiccup, not a breakdown (§5).
- **Ships steer off the arena edges** within ~170 yd instead of grinding into them or cornering during a retreat.
- **Break off opens the range** — a retreating group runs on the fastest heading that still increases separation, not straight bow-away into a slow point of sail.
- **Targeting is per enemy ship** (click an enemy = Named target). There is no whole-group target yet.

---

## 1. The one question

> **Is commanding groups of ships through orders — rather than controlling ships directly — actually engaging?**

Everything in this prototype exists to answer that. Anything that doesn't serve it is cut, including things that would make the prototype more fun in other ways.

The failure mode being hunted: **the player feels like a spectator.**

---

## 2. Scope

### In
Wind and points of sail · tacking and being caught in irons · 2 player groups of 2–3 ships · group speed bounded by the slowest ship · order tasking across four channels · named captains with temperament who interpret orders · a signal log making interpretation legible · General Chase · abstracted broadside gunnery with hull and rigging damage · raking · tactical pause and time controls · camera rotation with snap-to-wind · session instrumentation.

### Out
No campaign, economy, ports, or living world. No named officers, skills, XP, perks, or loyalty. No crew companies, casualties, or morale. No ship stat variance. No boarding or land combat. No prizes. No art direction — no chart aesthetic, no low-poly, no shaders. No sound.

### Explicitly deferred: the player's own ship
In the full design the player directly helms one ship *and* commands groups. **The prototype has no directly-controlled ship.** Reason: if the player always has a ship to fly, that masks whether group command carries the experience on its own. Pure group command is the sharper test.

If playtest results are ambiguous — testers engaged but flat — adding a player-helmed ship is the first thing to try.

---

## 3. Non-negotiables

These are the design under test. Do not simplify them away, even though each has an obvious "cleaner" alternative:

1. **The player never commands individual ships.** Orders go to groups. There is no unit-select-and-move.
2. **Captains interpret orders; they don't execute them.** A group does roughly what it was told; individual ships within it may not. — **RESTORED 2026-07-27** via a legible, *deterministic* redesign (§0; §14.1): four trait-driven deviations (chase / refuse-recall / shy / unnerved), sticky and narrated on transition, so the mess reads as character rather than the flicker the first attempt produced. (Briefly frozen mid-day as an interim step.) The obedience→mutiny escalation remains future work.
3. **Group speed is the slowest ship's speed.** Excess speed in a fast ship is wasted unless General Chase is called.
4. **Orders are instant.** No signal latency, no transmission delay.
5. **Interpretation must be visible in the signal log.** Without it, character reads as bugs. This is not polish; it is the mechanism.

---

## 4. Stack and shape

TypeScript, Vite, HTML canvas 2D. No framework, no engine, no physics library.

Single screen. Whole arena visible at all times — **no panning, no zooming.** Camera rotation only (see §9). This isolates the "do they rotate to align with wind" signal cleanly.

**This code is disposable.** No abstraction layers, no design patterns, no extensibility. Plain functions and plain objects. Optimise for how fast a rule can be changed after a playtest, nothing else.

---

## 5. World and scale

- Units are **yards**. Arena is **1400 × 1000 yards**, fixed, open water, no land.
- Time is compressed roughly 4× versus reality so the speeds below already include it. Target battle length: **4–8 minutes**.
- Fixed timestep simulation (60 Hz), rendering decoupled.

### Wind
- One global direction, degrees. One constant speed (no wind strength variation).
- Direction drifts continuously: `base ± 40°` driven by smooth noise on a slow period (~45 s). No discrete shift events.
- Always displayed as a large, unmissable arrow.

### Points of sail
Speed multiplier by angle off the wind (0° = dead into wind), lerped between bands:

| Angle | Multiplier | |
|---|---|---|
| 0–45° | 0.0 | No-go zone |
| 45–70° | 0.55 | Close-hauled |
| 70–110° | 0.85 | Beam reach |
| 110–150° | **1.0** | Broad reach — fastest |
| 150–180° | 0.70 | Running |

### Turning
- `turn_rate = base_turn × (current_speed / max_speed)` — no steerage way when stopped. This matters; don't shortcut it.
- **Tacking** (crossing the no-go zone): **12% chance of being caught in irons** *(revised 2026-07-27 from 35%)*. In irons = speed decays to near zero, no steering, for **5–10 s** before falling off onto a random tack. Everyone can sail; this is a hiccup, not a ship-killer.
- **Wearing** (turning away through downwind) always succeeds but costs ground and time.

---

## 6. Ships

Two classes, because a speed mismatch inside a group is required to test non-negotiable #3.

| | Max speed (yd/s) | Turn (°/s) | Hull | Rigging | Guns per side |
|---|---|---|---|---|---|
| **Sloop** | 16 | 18 | 60 | 40 | 6 |
| **Frigate** | 12 | 11 | 140 | 70 | 14 |

- **Rigging damage** scales max speed and turn rate linearly. At 0 rigging the ship is an immobile hulk.
- **Hull** at 0 → strikes colours, removed from play.
- All values above are **starting guesses to be tuned in playtest.** Keep them in one constants file so they can be changed in seconds.

---

## 7. Gunnery

Broadside only. Firing arc is **±60° from perpendicular** on each side — nothing fires fore or aft.

| Band | Range | Hit chance per gun |
|---|---|---|
| Extreme | 700–1200 yd | 8% |
| Long | 350–700 yd | 20% |
| Close | 100–350 yd | 45% |
| Point blank | < 100 yd | 70% |

- **Reload:** 25 s per side, tracked independently per side.
- **Shot types (two only):** *round* → 3 hull damage per hit · *chain* → 3 rigging damage per hit. Grape is cut, since crew and morale aren't modelled.
- **Raking:** firing within 30° of the target's bow or stern axis deals **×2 damage**. This is the reward for positioning and the reason the sailing model matters — make sure it's noticeable and make sure the log announces it.

---

## 8. Captains, groups, and orders

### Captains
Every ship has a **named captain** — use real-sounding period names, not "Captain 1". The playtest's strongest pass signal is a tester getting annoyed at a specific captain by name, and that can't happen without names.

Three axes, each −100 to +100, rolled at setup and shown to the player as descriptive text rather than numbers:

- **Aggression** — closes shorter than ordered, chases beyond the group. Low: holds off, breaks early.
- **Obedience** — complies literally, or substitutes its own judgement.
- **Nerve** — how long they fight before striking colours.

> **Status (revised 2026-07-27):** the order-bending behaviours below are **frozen** so the tactical layer can be tested cleanly. `p_comply` (obedience), `chase_defection`, and the `preferred_range` aggression modifier are **OFF**; **`strike_threshold` (nerve) stays ON.** Officer stats are still rolled and shown to the player. These return with a future crew-morale / mutiny mechanic — the formulas below are kept as the reference for that. Toggles live in `constants.ts → RULES`.

Concrete behaviour (reference; see status note above):

```
p_comply = 0.75 + obedience/400        # -100 → 50%, 0 → 75%, +100 → 100%
```
Rolled when an order is issued, and **re-rolled every 20 s while that order stands** so drift happens over time, not just at issue.

```
preferred_range   = ordered_range × (1 - aggression/150)
chase_defection   = if aggression > 40 and an enemy is fleeing within 400 yd,
                    a per-second chance to leave formation and pursue
strike_threshold  = 25% hull - nerve/8    # high nerve fights longer
```

### Groups
- 2 player groups, 2–3 ships each. **Standing organisation, not a pre-battle screen** — aligning with design doc §2.1, which retires pre-battle setup ("there is no setup phase"). The prototype simply starts with the groups pre-formed and mixed by class. *(Corrects the stale "trivial setup step" wording, 2026-07-27.)*
- Each group has a **commander** (a designated ship). **The commander's obedience gates whether the group as a whole complies**; individual ships roll separately for their own behaviour within a complying group.
- **Group speed = slowest current member's speed.**
- **Cohesion breaks** — group drops to Loose (individual initiative) if the commander strikes or the group falls below 50% strength. Player can promote a new commander with one click.

### Order channels
Each group holds one setting per channel, changeable instantly at any time:

| Channel | Options |
|---|---|
| Formation | Line ahead · Line abreast · Loose |
| Stance | Engage close · Stand off and batter · Break off |
| Target | Nearest · Weakest · Named ship · Hold fire |
| Shot | Round · Chain |

Plus **move-to-position** (click a point) and **General Chase**.

### General Chase
Releases the formation constraint: every ship moves at its own max speed with its own judgement, and temperament runs unchecked. Gains speed and pursuit, loses mutual support and control. One button.

---

## 9. Presentation — deliberately crude

Triangles and lines. Nothing else. Any time spent on visuals is time stolen from the actual question.

- Ships are **triangles**, sized by class, coloured by faction. Bow exaggerated so heading reads instantly.
- **Wake**: a short fading trail behind each ship.
- **Group tethers**: thin lines from commander to members.
- **Firing**: a brief straight flash from firer toward target. Different colour for a rake.
- **Wind**: large persistent arrow.
- Hull and rigging as two small bars per ship.

### Camera
Rotation only — `Q`/`E` to rotate, `W` to snap the wind to the top of the screen. No pan, no zoom. Log every rotation and whether it ended wind-aligned (§11).

### Signal log
A scrolling text panel, and one of the most important elements in the build. Plain-language lines for every interpretation event:

```
Aurora hauls out of the line to chase the sloop.
Kestrel holds at long range — Ross will not close.
Wanderer rakes Sirena across the stern.
Ross strikes his colours.
```

### Controls
`Space` pause · `1`/`2`/`4` time multiplier · hotkeys for order channels · click a group panel to select it.

---

## 10. The opposition

Deliberately dumb. Two enemy groups using the same group system with fixed behaviour — one on line-discipline (holds formation, trades broadsides at range), one aggressive (closes hard, chases). **Do not build clever AI.** The enemy exists to give the player something to command against.

---

## 11. Instrumentation — required, not optional

The playtest is a measurement, not a conversation. Log to memory and offer a JSON download at battle end:

| Metric | Why |
|---|---|
| Attempts to select or order an individual ship inside a group | **The key failure signal.** Repeated attempts mean the command model isn't satisfying the player |
| Camera rotations, and whether wind-aligned afterward | Validates free rotation as a requirement rather than a nicety |
| Pause count and total paused duration | Proxy for decision density |
| Order changes per group per battle | Set-and-forget means the tactical layer is too thin |
| General Chase uses | Is the formation-release valve understood and wanted? |
| Battle duration and outcome | Pacing |
| Interpretation events, by type | How often does character actually surface? |

Also expose the "select an individual ship" affordance *just enough to detect the attempt* — it must fail, but the click needs to be counted. Blocking it silently loses the most valuable signal in the build.

---

## 12. Build order

Each step must be runnable and visibly working before the next begins.

1. Canvas, arena bounds, wind arrow with drifting direction, rotating camera
2. **One ship that sails correctly** — polar curve, turn rate scaling with speed, tacking, irons
3. A second ship following a simple move order
4. Grouping: 2 ships, formation keeping, group speed = slowest
5. Order channels + UI panels + signal log
6. Gunnery: arcs, range bands, reload, hull and rigging damage, striking
7. Raking
8. Captain temperament, obedience rolls, chase defection, interpretation logging
9. General Chase
10. Enemy groups
11. Pause and time controls
12. Instrumentation and JSON export

**Step 2 is the one to take slowly.** Everything else sits on top of it, and if the ship doesn't feel like it's genuinely sailing, every later result is invalid.

---

## 13. Gate criteria

**Pass** — testers feel like a commander rather than a spectator, and the fleet's mistakes read as character rather than as broken AI.

**Fail** — persistent attempts to micromanage individual ships, or misinterpretation being read as a bug.

**If it fails, the fix is a design change.** Not better art, not more order options, not a smarter enemy.

> **Revision note (2026-07-27):** with interpretation frozen (§0), the "misinterpretation read as a bug" fail mode isn't in play — but neither are the two strongest *pass* signals (a tester explaining a group's odd move; cursing a captain by name), which **require** interpretation (design doc §8.5). The live risk is now spectator / set-and-forget. The concept playtest's "it read as chaos" was the fail signal firing; per design doc §8.5 the fix is to make interpretation **legible**, not to remove it. See §14.

Testers should be wargamers or board gamers — people practised at reading abstract tokens as meaningful things. Naive testers reliably report "boring" when they mean "nothing to look at," which produces a false negative on the only decision this prototype exists to make. 5–8 testers, several rounds, iterate between rounds.

---

## 14. What to prototype next — measured against the gate (design doc §8.5)

The gate lists the behaviours a passing prototype must produce. Mapped to what the build can currently detect:

| Gate signal (design doc §8.5) | Needs | Status |
|---|---|---|
| Keep clicking individual ships to micromanage — **FAIL** | select affordance + counter | ✅ built & counted |
| Rotate camera to put wind at top, unprompted | free rotation + log | ✅ built & counted |
| Use tactical pause frequently and deliberately | pause + metric | ✅ built & counted |
| Set groups once, never re-task — **FAIL (thin tasking)** | order-change metric | ✅ counted — but see §14.2 |
| **Explain, unprompted, *why* a group did something odd — PASS** | interpretation ON + signal log | ❌ interpretation frozen (§0) |
| **Name/curse a specific captain, unprompted — strongest PASS** | interpretation ON + named captains | ❌ interpretation frozen (§0) |

Two gate signals — including the single strongest — are currently **undetectable** because interpretation is off. That sets the priority order.

### 14.1 Priority 1 — interpretation that reads as *character*, not chaos
Design doc §8.4 is explicit: without temperament "you're testing a much duller version." The concept playtest that made us freeze it was the **fail signal firing** ("read as a bug"), and §8.5's prescription for that is a *design change* → make it **legible**, not delete it. The prototyping work:

- **Stable dispositions, not a 20 s coin-flip.** Re-rolling compliance every 20 s makes a captain flicker obey/disobey — that reads as random, i.e. a bug. Temperament should be a steady trait; deviations occasional and sustained.
- **Every deviation has a visible cause + the named, shown trait.** *"The reckless Ross hauls out of the line to chase the cripple"* — cause (fleeing cripple) + a trait the player was already shown (reckless) + name. The literal pass test is *"can the player explain why?"*
- **Fewer, bigger moments.** One memorable defection beats constant low-level disobedience.
- **Recoverable.** Player can re-task or promote — the mess is a problem to solve, not noise.

Keep it off for a short "does the tactical skeleton work" checkpoint if useful, but the real gate needs it back, retuned this way. **This is priority 1.**

### 14.2 Priority 2 — a reason to re-task (anti set-and-forget)
Pillar 2 ("few, large decisions") only works if decisions recur. Both player groups currently just fight the nearest enemy, so the second group adds nothing a bigger single group wouldn't, and orders can be set once and left. Prototype a situation that forces ongoing tasking:
- **Two groups in complementary roles** — hammer-and-anvil: one Stand off to fix the enemy while the other works round to rake. Tests the literal claim ("you command groups").
- **A one-line battle objective** beyond annihilation (e.g. *"cripple the enemy flag and break contact"*), turning set-and-forget into "am I achieving it?". One battle's goal, not a campaign — and design §2.1 forbids a pre-battle *screen*, not an in-battle objective.

### 14.3 Priority 3 — make the wind the player's skill (Pillar 1)
*"The wind is the enemy before the enemy is."* Right now groups auto-circle at range, so the positioning that Pillar 1 says wins fights is done by the AI, not the player. Prototype letting the player's move orders own the manoeuvring — seizing the weather gage, crossing the T, setting up the rake — with the rake payoff prominent enough to feel like the point. The **lee-gunport penalty** (design §2.4) is the natural next tooth if the weather gage needs to bite harder.

## 15. Planned mechanics — spec only, not prototyped yet
Recorded so they aren't lost; **not** needed to answer the one question, so not built now.
- **Accuracy vs. target speed / aspect.** Hit chance falls against fast and fine-angled targets, so **speed becomes a defence** and sloops stop being cannon-fodder — a fast ship kept moving is genuinely hard to hit. Belongs in design doc §2.5 (gunnery); folds into the per-gun hit roll. *(Requested 2026-07-27.)*
- **Lee-gunport penalty** (design §2.4) — fighting from leeward disables/weakens one broadside; makes the weather gage matter mechanically.
