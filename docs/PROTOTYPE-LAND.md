# PROTOTYPE-LAND.md — the working spec for the land-battle prototype

**Status: DRAFT for review (2026-07-27).** A plan, not yet built. Sibling to
`PROTOTYPE.md` (the naval prototype) and grounded in design doc §6 (Land
Combat), §2.6 (Boarding reuses this engine), §1 (Pillars), and §3.1 (companies).

This is a **second throwaway prototype**, run to the same rules as the first:
disposable code, programmer art, browser-based, optimised for how fast a rule
can change after a playtest.

---

## 1. The one question

> **Does commanding a pirate band — each figure directly — to break the enemy's *will* rather than grind them down, make an engaging, legible skirmish?**

Two design bets are on trial together (per your scoping call):

- **Command — deliberately MORE RTS than the fleet** *(direction, 2026-07-27).* At sea, command is *indirect*: captains interpret orders and that mediation is the whole point. On land, keep the **RTS feel** — you select companies and they do what you tell them, responsively. **Officers and companies are a STAT benefit, not a control mechanic** — an elite company shoots straighter, holds longer, and hits harder; it does not second-guess your orders. So do **not** port the naval interpretation/temperament-disobedience layer here. (Morale-driven *routing* still overrides orders — but that's a will outcome every RTS has, not order-interpretation.)
- **Morale as the win condition** — you win by breaking will, not by annihilation (Pillar 5, §6). Position and shock are how you attack it.

The failure modes being hunted:
1. **Attrition wins.** Players line up and trade fire; morale is ignorable. If so, the whole thesis is dead.
2. **Collapse reads as random.** A company routs and the player can't say *why*. (The exact lesson from the naval prototype — a rout must read as "I got flanked," not a dice roll.)
3. **The player feels like a spectator** — same failure as the fleet: orders set once, then watch.

---

## 2. Scope

> **Note (2026-07-27):** the POC uses a roughly **symmetric** field battle as a
> convenient testbed for the morale + command mechanics. The *real* land
> engagement is an **asymmetric raid** — a small pirate force against a larger
> town garrison, against the odds and a clock (see §16). Don't tune the POC
> toward a fair fight.

### In
Squad scale on one top-down map · 4–8 **companies** per side · morale as the core system (waver → rout → break) · command by orders to companies (move, hold, volley, charge, fall back, form up) · ranged fire with finite powder · melee/charge resolved by shock and will, not HP · **flanking & enfilade as the maneuver payoff** (the land analogue of raking) · terrain that matters (cover, high ground, chokes) · a commander with an Inspire/rally action · a signal log making collapse legible · tactical pause and time controls · session instrumentation.

### Out
No campaign, economy, or persistence. No XP, perks, loyalty. No fort-assault *routes* (bombardment / sap / escalade / bribery — strategic choices, not this fight). No boarding-specific mechanics (grapple, prize crews) — but the engine is built so a deck fight is just a small fast map (§2.6). No terrain authoring or destructibility. No art direction, no sound.

### Explicitly deferred
- **Fort assault.** The headline land set-piece, but it's a *scenario* on top of a working morale/command engine. Prove the engine on an open field first; a fort line is the natural second scenario.
- **Boarding.** Same engine, smaller/faster map. Keep it in mind while building; don't build it yet.

---

## 3. Non-negotiables

The design under test. Don't simplify them away:

1. **The player commands individual pirates and officers, RTS-style** *(decided 2026-07-27 — deliberately the OPPOSITE of the fleet's "command groups, not units").* Each pirate and officer is a token you select, move, and fire; deployment is granular (equip each pirate, attach officers). Orders are direct, never filtered through interpretation. **Officer quality is a stat layer** (accuracy, morale, melee shock, a leadership aura), not a control mechanic. Full Cutthroats-style skirmish control.
2. **Will is the win condition.** A side loses when it is *broken* (routed), not when it is wiped out. Casualties feed morale; they are not the objective.
3. **Positioning attacks morale.** Flank, rear, enfilade, and high ground hit will directly and hard. Maneuver must beat standing and trading.
4. **Collapse must be legible in the signal log.** Every morale break names a cause. Without it, routs read as bugs — same rule as naval interpretation.
5. **Orders are instant.** No command latency (consistent with the fleet).

---

## 4. Stack and shape

TypeScript + Vite + HTML canvas 2D, no framework. Disposable. Built in
`prototype-land/`. Single screen, whole battlefield visible; camera locked
north-up (no wind axis to align to on land). Reuses the naval prototype's
patterns where they transfer (fixed-timestep sim, signal log, instrumentation,
DOM UI) but the control scheme is different — see §7.

---

## 5. World and scale

- Units are **paces**. Map ~**1000 × 750**, one open field with terrain features, fixed.
- Time compressed ~4× like the fleet; target battle length **3–6 minutes**.
- Fixed-timestep sim (60 Hz), rendering decoupled.
- **The atom is a single figure** — a pirate or an officer, one token each (~8–16 a side). Each tracks **hp**, **marksmanship / ferocity / nerve** (officers also **presence**), **morale** (0–100), **fatigue**, a **weapon loadout**, position and facing.
- **Weapon loadouts** set the role: **musket** (ranged line) · **pistol & cutlass** (short-range shock; closes to melee) · **cannon** (long-range terror weapon, ponderous, helpless in melee).
- **Officers** are stronger figures with **rolled stats → perks** that partly **carry over** to the pirates they lead (see §7.1). *All values are starting guesses, in one constants file.*

---

## 6. Morale — the core system

Morale is **per figure**, with man-to-man contagion — you watch a line crumble
one figure at a time. Each figure holds a morale value and a state:

| Morale | State | Behaviour |
|---|---|---|
| > 55 | **Steady** | Fights and obeys normally |
| 25–55 | **Wavering** | Slowed, shaken |
| < 25 | **Routing** | Flees toward its own edge, ignores orders |
| off-map / hp 0 | **Down** | Out of the fight (fled or cut down) |

**Morale drains from:** being shot at (even a miss suppresses) · **being hit in the flank or rear (×2 / ×3)** · melee · **a friend falling or breaking nearby (contagion)** · fatigue.

**Morale recovers from:** being out of contact · standing in cover · an **officer's presence** nearby (a steadying aura, see §7.1) · an officer's **rally**.

A side is **broken** (loss) when every one of its figures is routing or down. Win by breaking their will — you rarely have to cut them all down.

---

## 7. Command — a real-time-strategy control scheme

**This is the confirmed model (2026-07-27) and the preferred one.** Land plays as
a Cutthroats-style RTS skirmish, the deliberate opposite of the fleet's
interpreted command: you select and direct each figure, and they obey at once.

**Selection & orders (standard RTS):**
- **Left-drag** a box or **left-click** a figure to select (shift adds); `E` selects your whole band.
- **Right-click ground** → move there. **Right-click an enemy** → attack it (move into range, fire / close to melee).
- An explicit order temporarily **overrides the stance**, then the figure reverts to it.

**Stances** — each figure's standing behaviour when it has no active order, the AI that keeps it sensible without babysitting:

| Stance | Key | Behaviour |
|---|---|---|
| **Aggressive** | `Z` | Auto-acquires and **pursues** the nearest enemy within sight (~300 paces); when a target falls it **switches to the next** and fights on |
| **Hold ground** | `X` | Fires at anything in range/arc but **never chases** — holds its spot |
| **Cease fire** | `C` | Won't fire on its own (an explicit attack order still fires); still defends in melee |
| **Stop** | `S` | Halt where you are and hold ground |

Player raiders default to **Aggressive**; the town garrison holds ground (stands and volleys, so flanking still pays). Firing/melee is otherwise automatic — you command *movement and posture*, the figures handle the trigger.

- **The commander/officers** are mostly a **passive leadership stat** — a morale-steadying **presence aura** — with one light active, **Rally** (`R`, limited uses / cooldown) to arrest a rout.

### 7.1 Officers & pirates are a stat layer (not a control mechanic)
Quality shows up as numbers you exploit, not as orders being reinterpreted:
- **Pirate:** marksmanship (accuracy), ferocity (melee), nerve (morale resilience), hp — plus the weapon loadout. A small per-figure roll varies it.
- **Officer (built):** rolls higher stats — **Marksmanship / Ferocity / Presence / Nerve** — that unlock **perks** (*Dead-eye*, *Cutthroat*, *Iron Will*, *Old Salt*). An officer is a stronger fighter **and** drills his squad: pirates gain a **fraction (~0.4) of the gap toward his combat skill** (carry-over), and his **presence** steadies everyone nearby. Kill the officer and his men lose both the edge and the steadying.
- This is the deliberate divergence from the fleet, where officer temperament is a *control* mechanic. On land it is **advantage, not interference.**

---

## 8. Combat

**Ranged.** Muskets fire in bands with falloff; **finite powder** per company (≈10–15 volleys) so you can't trade forever. Volley (coordinated, big morale punch) vs fire-at-will (steady attrition). The light gun outranges muskets and is a morale weapon.

| Band | Range (paces) | Hit chance | Notes |
|---|---|---|---|
| Point-blank | < 30 | high | Precedes a charge |
| Effective | 30–90 | moderate | The working band |
| Long | 90–160 | low | Harassment; morale pressure only |

**Melee / charge.** Resolved as a **shock + will contest**, not an HP swap: attacker's shock (charge momentum, numbers, proficiency) + any **flank/rear bonus** vs defender's morale + proficiency. The loser's morale craters (often straight to routing). A fresh, steady company should beat a charge from the front; the same company hit in the flank or already wavering should break. This is the payoff that makes maneuver matter (§3.3).

**Fatigue** rises with movement (especially charging) and lowers fire and melee — so charges are committing, not free.

---

## 9. Terrain

Simple shapes with clear rules: **cover** (reduces incoming fire and morale loss), **high ground** (range/accuracy edge + a morale steadier), **chokepoints & obstacles** (channel movement, protect flanks), **concealment** (breaks line of sight). Terrain exists to make *where* you fight a decision.

---

## 10. Presentation — deliberately crude

Tokens (rectangles/chevrons) for companies, coloured by side, with a **facing arrow**, a **morale bar**, and a strength count. Muzzle-flash lines for volleys; a shove/clash marker for melee. Terrain as flat colour fills. **Signal log** is first-class:

```
The rabble on the left waver — the gun has found them.
Marines take the redcoats in the flank; the line buckles.
Ferrer's boarders rout — their sergeant is down.
The enemy centre breaks. The field is yours.
```

Tactical pause · `1`/`2`/`4` time · click a company to select · order hotkeys.

---

## 11. The opposition

Deliberately dumb, like the fleet's. One or two fixed behaviours — a **holding line** (stands, volleys, receives charges) and an **aggressive rush** (advances and charges). No clever AI; it exists to give the player a will to break.

---

## 12. Instrumentation — required

Measure whether maneuver or attrition is winning:
- **Routs vs. kills** — how battles actually end (the core thesis check).
- **Flanks/enfilades achieved** — is the player maneuvering?
- **Order changes per company** — set-and-forget check.
- **Inspire/rally uses** — is the valve understood and wanted?
- **Units left idle / uncommanded** — a spectator check for individual control (are pirates just standing while others die?). *(Replaces the naval "single-soldier micro attempt" metric, which is meaningless now that individual command is the intended model — §17.)*
- Battle length, outcome, powder spent, casualties.
JSON export at battle end.

---

## 13. Build order (runnable increments)

1. Map + one company moving on orders, with facing.
2. **Morale model on one company** — the careful step; drain/recover sources, waver→rout→break, visible bar + log.
3. Two companies + ranged fire (bands, reload, powder) feeding morale.
4. Melee/charge as a shock+will contest (morale-decisive).
5. Terrain: cover / high ground / chokes.
6. **Flank & enfilade morale bonus** — the maneuver payoff.
7. Command layer: 4–8 companies/side, order channels, cohesion, force-broken check.
8. Commander + Inspire/rally + officer-casualty shock.
9. Dumb enemy (holding line / rushing).
10. Instrumentation + JSON export.
11. *(Stretch)* boarding-deck scenario on the same engine.

**Step 2 is the one to take slowly** — if morale collapse doesn't read as legible and earned, every later result is invalid (exactly as step 2 was for the sailing model).

---

## 14. Gate criteria

**Pass** — players maneuver to break the enemy's will (flank, shock, rally), routs read as consequences of position rather than dice, and it feels like commanding a line rather than watching one.

**Fail** — players line up and trade fire because attrition works (morale ignorable), or collapse reads as arbitrary, or they keep trying to micro individual soldiers.

**If it fails, the fix is a design change.** Testers: wargamers/board-gamers, 5–8, several rounds.

---

## 15. Modern improvements over *Cutthroats*

*Cutthroats*' land raids were thin. The successor's land layer earns its place by:
1. **Will, not attrition, as the win condition** — shorter, dramatic fights that reward maneuver over grinding.
2. **Company-scale RTS, not soldier micro** — the company is the atom (shared with the fleet), but control is *direct and responsive* (unlike the fleet's interpreted command), and officer/company quality is a stat advantage rather than a control layer. Cohesion and rout still emerge rather than being babysat.
3. **Maneuver as the skill** — flank / enfilade / high ground attack morale directly; the map is a lever, not a backdrop.
4. **Legible collapse** — a running "why" log so a rout is never a coin flip (the biggest lesson carried from the sea prototype).
5. **One engine, two theatres** — the same code runs an open-field squad battle and a cramped boarding deck; scenarios differ by map and clock, not by codebase (§2.6).
6. **Resource pressure** — finite powder and rising fatigue force you to *commit* to a decision instead of trading volleys indefinitely.

---

## 16. Planned, not prototyped yet

Recorded so they aren't lost; not needed to answer the one question.

- **The real engagement is an asymmetric raid, not a fair field battle** *(design note, 2026-07-27).* A few pirates pillaging a town are structurally **outnumbered** — so attrition is never the path; the *only* way to win is to break a larger, brittle defence's will fast, take the objective (plunder / burn / free a captive), and withdraw. Shape: **few elite, high-shock attackers** vs **many poor, fragile-morale defenders** (militia/rabble, maybe a steady garrison core), with buildings/walls as cover and chokes, an **objective** rather than annihilation, and a **clock** — reinforcements muster over time, so the odds worsen the longer you linger. This *reinforces* the morale thesis rather than complicating it; it also means we should NOT balance toward a symmetric rout-vs-kill ratio. Degree of asymmetry is TBD. Natural next scenario after the field-battle testbed.
- **Fort assault with asymmetric approach routes** (bombardment / escalade / sap / bribery / night infiltration), each leaning on a different officer skill (§6).
- **Boarding specifics** — grapple conditions, prize crews, the 60–120 s deck clock (§2.6).
- **Company XP / veterancy** carrying between land and sea (design §3.3–3.5).

---

## 17. Unit model — Cutthroats individual figures + officer carry-over (CONFIRMED & BUILT, 2026-07-27)

The confirmed, preferred model, leaning hard on *Cutthroats* land battles plus improvements. This is what §5 and §7 now describe; it replaced the earlier company-block build.

**Deploy & equip.** Squads = **pirates** + a **weapon loadout** (musket / pistol & cutlass / cannon) + optionally one **officer**.
- *Built:* squads are pre-formed at battle start, mixed by loadout.
- *Not built yet:* an interactive **deployment step** to build/equip your band pre-battle (land would have one — a deliberate divergence from the fleet's no-pre-battle-screen rule, §2.1). Also deferred: more loadouts (grenades, blades).

**Officers = stronger pirates + random stats → perks (the improvement).** Rolled stats (à la design §4 rolls / §3.6 skills+perks) across the combat jobs and leadership:
- **Marksmanship** → ranged accuracy / reload · **Ferocity** → melee shock · **Presence** → squad morale & cohesion · **Nerve** → the officer's own resolve.
- Thresholds unlock **perks** (design §3.6): e.g. *Dead-eye* (+accuracy), *Powder Monkey* (+reload), *Cutthroat* (+melee), *Iron Will* (squad morale floor), *Old Salt* (rallies routers). An officer is also simply a **stronger fighter** than a pirate (the Cutthroats elite unit).

**Carry-over — the novel bit.** Leading a squad **imbues** the pirates with a *fraction* of the officer's quality:
- **combat skill carries partially:** squad accuracy/melee = pirate base + `carry × officer skill` (start ≈ 0.4). A crack shot's squad shoots better because he drilled them.
- **leadership perks are squad-wide auras** (morale floor, rally, cohesion).
- **personal perks stay on the officer** (his own kills). He raises the squad's ceiling; he is not a unit to micromanage.
- This concretises design §2.3 (skill lifts the group; command flows from the leader), with a Cutthroats twist: on land, combat skill *does* partially transfer to the men — unlike the sea, where individual gunnery was own-deck only.

**Built & verified (headless + boots):**
- **Individual figures are the atom** (~8–16 a side), full Cutthroats granularity — select/move/fire each token (§7).
- **RTS stances** (aggressive / hold-ground / cease-fire / stop) — the unit AI that keeps figures sensible without micromanagement (§7).
- **Per-man morale with contagion**; flanking (×2) and rear (×3) hits; officers steady via a **presence aura**.
- **Officer carry-over:** combat-skill imbue to the officer's squad; presence aura by proximity; his death removes both.
- Win by breaking will (all enemy routing/down).

**Tuning to revisit later (all one-liners in `constants.ts`; user is content with the direction):** morale must keep outpacing lethality so figures rout before they die; battles run a touch fast under max aggression; lingering figures can stalemate; KILL still slightly leads ROUT under a charge-everything test. The interactive deployment step and richer perks/loadouts are the main un-built pieces.
