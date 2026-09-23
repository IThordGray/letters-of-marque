# LETTERS OF MARQUE
### Design Document v0.18 — working title

A spiritual successor to *Cutthroats: Terror on the High Seas* (1999). Age-of-sail privateer campaign in a persistent Caribbean.

> **Setting note, ratified 2026-09-09 — the sea is invented every game.** The world is **procedurally
> generated**: ~50 places, new coastlines, place names drawn from per-nation pools, five real crowns.
> **Havana, Port Royal and Tortuga — and every other real port named anywhere in this document — are
> HERITAGE REFERENCES, not map content.** They say what we are building toward in feel; they are not
> places a player will visit. Read every such name below as flavour illustrating a mechanic. The
> *Caribbean* remains the register — period, powers, latitudes, weather — rather than the map.
> See `knowledge/decisions.md` (2026-09-09) for the world layer in full.

**Changes from v0.17** *(art direction — the sea changes, the chart moves up)*
- **Changed §5.1:** the working-height sea is no longer a chart. The human named *Sid Meier's Pirates!* and *Rise of Piracy* as the targets; both are sunlit, saturated and 3D, which settles the medium as **stylised 3D** and replaces parchment water with a **sunlit Caribbean — stylised, never simulated**.
- **Kept, and given a better home:** the cartographic look survives at **the zoom ceiling and the strategic map** (§5.4). The blend stops being a chart sharpening into a chart and becomes a place turning into a drawing of itself.
- **Recorded as a cost, not glossed:** the old direction separated the colour channels *structurally* — a desaturated sea could not compete with the wind arrow, range bands and arcs. A saturated sea gives that up, so §5.2 now buys it back deliberately with a **reserved value band** and a scrim rule. §8.2 risk 4 rises accordingly.
- **Unchanged:** ships (§5.1), faction-hue identity (§5.2), the camera rig (§5.3), where production value comes from (§5.5), and the MVP asset list (§5.6). **No game rules changed.**

**Changes from v0.16** *(reverted to design-spec + prototypes; a process note, not a design change)*
- **Withdrawn: the v0.16 "durable build begins" step.** Durable development has been set aside; the project is back to this design spec plus the two throwaway prototypes (naval, land) that validate the fun. **No game rules changed.**
- **Removed §8 Technology** — engine, language, and simulation-core architecture are decisions deferred out of the design spec, which is once again pure game design. Old **§9–12 renumber to §8–11**.

**Changes from v0.14** *(the campaign frame — the missing "why do I keep playing / what am I building toward")*
- **Added:** §7.4 **The campaign arc — legacy & retirement.** No hard win-screen; a *Sid Meier's Pirates!*-style soft, graded finish. **Aging is the clock** — the *pressure* the loop was missing (a finite career; the edge dulls late, easing you from raider toward stewardship) — and a multi-factor **legacy** is the *goal*: graded on havens held & developed, fame vs. infamy, wealth (yours **and** your crew's), rivals broken (especially officers who turned), your people's fates, and standing with the crowns. Resolves the vague-campaign-loop gap; sits on the golden thread (§1.2) and completes Pillar 6.

**Changes from v0.13** *(Cutthroats-parity pass — mechanics from the OG game we were missing)*
- **Added:** §7.2 **Fame & infamy** — reputation as a live axis, Pillar 5 at map scale (fame → enemies **surrender**; infamy → **pirate-hunters**, per-nation), and the **parley / ransom / tribute** non-combat verbs it unlocks (an **extort** option beside pillage / raze / occupy).
- **Added:** §7.3 a **real trade & plunder economy** (*Port Royale*-flavoured, but delegated not babysat) — living supply/demand markets, **standing trade routes run by a captain**, **production chains in your havens** (raw → rum / cloth / **ships**), fencing/smuggling, and a plunder-vs-commerce tension that makes commerce a third way to play. Tertiary in *conception* (§1.2), **not** in depth; kept off the §1.1 spreadsheet by delegation/automation.
- **Added:** §3.7 **Provisioning** (powder/shot/food as pre-voyage *outfitting* — a decision, not a timer, §1.1) and **whole-ship mutiny** (event-driven discontent; officers **incite or restrain** by temperament/loyalty, but an unhappy ship turns as one — crew and officers together).
- **Parked (§11):** "false colours" flag-disguise — fills the closing-the-distance gap but feels off as a mechanic.

**Changes from v0.12**
- **Added:** §7.1 **Havens & town control** — a thin slice of map impact. A won raid resolves to **pillage / raze / occupy** (§6); occupying installs an **officer as governor** (delegated, loyalty-gated, can go independent), and you **develop the haven** toward your own goals (fortify · plantation · lumberyard + shipways · tavern) as a few set-and-forget slots, not a city builder (§1.1). Governor choice is a **loyalty × competence** trade-off (management is just one competence; loyal = cheap & safe, talented = higher output but frequent payoffs). Defection is low-risk overall, and **a single prosperous haven is safe** — the betrayal pressure comes from **breadth**: holding several builds competition among your own holdings, which is the natural cap. The lumberyard is the §1.2 golden thread made concrete: a town taken on land becomes where your fleet is built.

**Changes from v0.11**
- **Added:** §1.2, a "golden thread" design lens — conceive the game **land-outward**. Land is the core of decision-making; **officers are the connective tissue** who lead ashore and carry their skills to sea. Order of *conception* is land → sea → strategic. Explicitly a thinking lens, **not** a development order and **not** a reason to make the sea or strategic layers shallow (gameplay will likely start at sea).

**Changes from v0.10**
- **Added:** §8.5, a hard playtest gate. No rendering, art, or engine work begins until the throwaway prototype has been tested with real players and passed.
- **Changed:** the permanent simulation core now comes *after* the throwaway prototype, not before — the rules will move based on what the playtest teaches.
- **Fixed:** stale "pre-battle setup" reference in the build order, left over from v0.2.

**Changes from v0.9**
- **Added:** §8 Technology — separated simulation core as the primary architectural decision, an engine recommendation, options considered and rejected, and a no-engine-required first prototype.
- **Renumbered:** old §8–11 are now §9–12.

**Changes from v0.8**
- **Changed:** the fixed camera height becomes a **floor**, not the only position. Zoom out is allowed; zoom in is not. The art budget is unaffected because the detail floor is set by the closest position, which is still locked.
- **Changed:** chart view is no longer a mode toggle — it's the far end of the zoom, blended into continuously (§5.4).

**Changes from v0.7**
- **Added:** §5 Presentation — low-poly ships on a cartographic sea, hue-for-identity colour rule, fixed-height RTS camera with free yaw, and chart view as the substitute for zooming out.
- **Locked:** camera height and pitch fixed, no dynamic zoom. Yaw free, with snap-to-wind.
- **Renumbered:** old §5–10 are now §6–11.

**Changes from v0.6**
- **Cut:** hidden ship stats and the survey mechanic. Stats are always fully visible — you are a fleet captain and you know your own ships. Buying becomes an economic decision, not an information gamble.
- **Benched:** officers with high Repair/sailmaking permanently improving a hull slightly (§10).

**Changes from v0.5**
- **Cut:** the condition/ageing/refit-decay mechanic entirely. Ship stats are rolled once and permanent; battle damage is temporary and fully repairable. Quality and age are flavour text only.

**Changes from v0.4**
- **Added:** §4, ships as equipment with a per-hull stat roll within class. Provenance shifts the curve.
- **Resolved:** ships earn narrative names and battle records (§4.4).
- **Renumbered:** old §4–9 are now §5–10.

**Changes from v0.3**
- **Locked:** group cap at 2–5.
- **Added:** collective skills resolve to the **best** officer on the strategic map and the **worst** in tactical battle (§2.3). The commander can guide in transit; in a fight he has his own job.
- **Added:** collective-skill XP flows to the officer setting the floor, making "train the weak or segregate the strong" a real decision (§2.3.3).
- **Cut:** ship familiarity. Ships are equipment, not characters. No "knows this hull" bonuses anywhere (§3.2).
- **Locked:** company transfer — in port, or at sea in calm weather, ~30 minutes. Friction is opportunity cost, not penalty.

**Earlier**
- v0.3: skill resolution by category; organisation moved into fleet management; General Chase added.
- v0.2: groups as the unit of tactical command; companies portable; signal latency cut (backlog, §10); officer management trimmed.

---

## 1. Pillars

1. **The wind is the enemy before the enemy is.** Positioning wins fights; guns only finish them.
2. **You command groups, not ships.** Tactical decisions are few and large, not many and small.
3. **A group moves as one and fights as individuals.** The single rule that governs how officer quality resolves.
4. **Your fleet is people, not units** — but lightly. Officers have character; they don't have an HR department.
5. **Morale breaks armies, not casualties.** On land and at sea, you win by breaking will.
6. **Loss is a state, not a screen.** Failure demotes you; it doesn't end you. (And its complement, §7.4: **age**, not failure, is what finally ends a career — cashing out the legacy you built.)

### 1.1 Constraint: no company simulator

A hard design rule, because this genre drifts toward spreadsheets by default:

> **No system may require a recurring decision on a timer.** Management happens in port, in batches, and is optional to optimize. Every officer's state must be legible as one line of plain text, never as a table of modifiers the player is expected to audit.

Practical consequences: no weekly loyalty tick, no per-officer upkeep, no morale accounting the player has to service. Officers ask for things; you say yes or no. That's the whole interaction surface.

### 1.2 Design lens: think land-outward

A **golden thread** for how we reason about the game — a lens, not a plan. Conceive it from the **land outward to the sea**, not sea inward to land.

- **Land is the origin of decision-making.** Raids ashore, pillaging a town, the fight for a fort — those choices are the core the rest of the game hangs off. Design each system by asking what it means for a man on the ground first.
- **Officers are the connective tissue.** They are units with real impact: rolled stats and perks, they lead forces ashore, and they **carry the relevant skills to sea**. The *person* — not the hull — is what persists and travels between layers. This is why officers, not ships, anchor the fantasy.
- **Order of conception: land primary → sea secondary → strategic / trading tertiary.** Where the design *thinking* starts, so the whole stays coherent around people and their choices.

**Explicitly not** a development order, and **not** licence to make the sea or strategic layers cheap or shallow — both are first-class, and gameplay will very likely *start* at sea (campaign onboarding, §9). The lens only keeps us honest about where the heart of the game is.

### Inherited from Cutthroats (do not break)
Ship-handling fidelity and wind modelling · broadside gunnery with shot selection · boarding and land raids as real tactical engagements · crew shares and plunder division as pressure · letters of marque and shifting allegiance.

---

## 2. Fleet Naval Combat

### 2.1 Organisation vs. tasking

The split that makes fleet-scale work. **Organisation is fleet management** — it happens in the world, at your leisure: in port, at anchor, on a long reach across open sea. There is no pre-battle screen and no per-engagement ritual. Your fleet is simply organised the way you last left it, the way a real squadron is.

**Tasking is tactics** — issued in battle, instantly, to groups.

| | **Organisation (fleet management)** | **Tasking (tactics)** |
|---|---|---|
| Decides | Group membership, group commander, doctrine, crew company assignments | Where groups go, what they engage, formation, shot type, break off, board |
| Where | In the world — port, at sea, any time you like | In battle |
| Changeable in battle? | **No** | Yes, freely and instantly |

Because organisation is a standing state rather than a prompt, the cost of getting it wrong is real without being a chore: you meet the enemy with the fleet you happened to be running. Reorganising takes world time (§3.2), so it's a thing you do between actions, not in response to one.

### 2.2 Groups

**1–4 ships per group.** The player fields up to `2 + floor(leadership / 33)` groups — **2 at the start, 5 at maximum. Locked.** That cap is the only place fleet size is limited; you can own twenty ships, you just can't task twenty things at once.

Each group has:

- **A commander** — the senior captain in it. Their relevant skill sets the group's execution quality. A group is only as good as who leads it, which is where officer quality actually cashes out.
- **A doctrine** — a standing behaviour the group pursues by default without being told. Set as part of organisation, fixed for the duration of any battle it enters:

| Doctrine | Behaviour |
|---|---|
| **Cut out the outliers** | Isolates and swarms ships separated from the enemy main body |
| **Line discipline** | Holds formation and range, trades broadsides, refuses to be drawn |
| **Wolfpack** | Closes hard, boards at opportunity, disregards formation |
| **Screen the flag** | Interposes between the player's ship and threats |
| **Prize-taking** | Disables rather than sinks, boards cripples, sails prizes clear |
| **Chase** | Runs down fleeing ships, pursues past the engagement |

- **A station** — opening position and heading relative to the fleet.

**In battle**, the player tasks groups: go here, engage that, form this, load that, break off. Instant, no latency. Tell a group to take the outliers and *the group takes the outliers* — that's the contract.

**Cohesion:** a group holds together while its commander is alive and the group is above 50% strength. Below either, it drops to **Loose** — ships act on individual captain initiative until the player re-tasks them or promotes a new commander (a single click, no penalty beyond the disorder already caused).

The player's own ship can join a group or operate independently.

### 2.3 How officer skill resolves inside a group

**Not averaged, and not a flat ceiling. Resolved by category.** Five rules, each a one-liner, each obvious from how a real squadron works:

| Category | Skills | Rule | Why |
|---|---|---|---|
| **Knowledge** | Navigation, pilotage, local charts | **Best in group** | Information is shared. One good navigator serves the whole squadron. |
| **Collective execution** | Seamanship, formation handling, tacking | **Worst in group** in battle · **Best in group** on the strategic map | In a fight the commander has his own deck to run. In transit he has time to guide. |
| **Individual execution** | Gunnery, Melee, Repair, Medicine | **Own value** | Performed on your own deck. Nothing to share, nothing to hold back. |
| **Command** | Leadership, Inspire | **Commander's value** | Flows downward from whoever leads the group. |
| **Temperament** | Aggression, Obedience, Nerve | **Own value** | Individual, always. This is the defection mechanism. |

Group **speed** needs no skill maths at all: it's the current speed of the slowest ship, on both layers. You cannot outrun physics with a good navigator — but a good navigator does route you well.

**Worked against the three-ship example:**

| Officer | Outcome |
|---|---|
| Great navigator, overly aggressive | His navigation lifts the whole group (best-in-group). His aggression is his own — he gets battle lust, chases, and leaves the group. Skill shared, temperament personal. |
| Great navigator, solid officer | His navigation also lifts the group. His superior ship-handling is *wasted* — the group moves at the slowest hull's pace, and he holds station because he's obedient. |
| Great gunner | Applies in full, immediately, with no group cost whatsoever. Gunnery is fired from his own deck. |

All three fall out of the rules rather than needing special cases.

**What this makes the player think about.** Grouping becomes a question of **matching floors, not maximising averages**:
- Don't put an excellent sailing master in a group with a slow hulk — you're paying for skill you can't use.
- One navigator is enough per group. A second is redundant. Spread them.
- Gunners are group-agnostic. Put them wherever the guns need to be.
- One aggressive captain is a cohesion liability no matter how skilled he is.

This is no harder to implement than averaging — `min`, `max`, `own`, `commander` — and it produces far better decisions. **Design goal: every officer should be excellent in some billet and a liability in another.** The aggressive navigator above is a poor line-of-battle subordinate and a superb independent raider.

*Fallback if playtest shows this reads as opaque:* flat averaging across the group per skill. Simpler to explain, much worse to think about. Not the first choice.

### 2.3.1 Strategic map vs. battle

Collective execution inverts between the two layers, and the reason is thematic rather than mechanical:

| | Collective skills use | Because |
|---|---|---|
| **Strategic map** (transit, routing, landfall) | **Best officer in group** | He is there to guide them. Small errors are made and corrected; over a week's sailing they wash out and the squadron still arrives. |
| **Tactical battle** | **Worst officer in group** | He has a focused job on his own deck and no attention to spare. Every error lands immediately and cannot be corrected. |

Consequence worth naming: **you only pay for a weak officer when it's hot.** Carrying someone below standard costs nothing in transit, which is what makes the training loop below actually playable — you can develop people without bleeding for it every day.

### 2.3.2 Collective skill XP goes to the floor

Because skills level with use, "worst in group" becomes a genuine strategic fork rather than just a penalty: **do I min-max my officers, or do I place them where their weaknesses get worked on?**

To make that fork real, collective-skill XP is weighted toward the officer who is being stretched:

- The officer **setting the group's floor** gains collective XP at full rate — he's the one operating at his limit.
- Officers **above the floor** gain at a heavily reduced rate. Holding station inside a formation you could easily beat teaches you nothing.

So the two strategies are both coherent and neither dominates:

| Strategy | Composition | Result |
|---|---|---|
| **Min-max** | Segregate by ability — strong with strong, weak with weak | Maximum immediate performance. Nobody develops. Your weak officers stay weak. |
| **Train** | One weak officer in a strong group | Group manoeuvre drops to his level in any battle. He improves fast. You've built a school at the cost of a squadron. |

Because transit doesn't punish you (§2.3.1), a training group is safe to run while cruising and dangerous to be caught with. That connects fleet organisation to campaign pacing directly — you reorganise for the quiet stretches and reorganise again before you go hunting.

### 2.3.3 Captain interpretation

Retained from v0.1 and still the mechanism that makes officers matter. A captain doesn't execute an order; they *interpret* it. Three temperament axes, −100 to +100:

- **Aggression** — closes past the ordered range and over-commits to chases, or hangs back and breaks off early.
- **Obedience** — follows orders literally even when suicidal, or substitutes their own judgement, sometimes correctly.
- **Nerve** — resistance to striking colours or fleeing when their own ship is being wrecked.

**Interpretation now resolves at two levels**, which is what makes grouping coherent:

- **Group level** — the *commander's* obedience decides whether the group as a whole does what it was told. High-obedience commander, the group complies.
- **Ship level** — individual captains can still fail within a complying group: over-chase and leave the formation, strike colours early, hold fire when told to close. The group does its job; the individual may not.

So a well-led group is reliable in aggregate and untidy in detail. That's the intended texture — you get what you asked for, but not cleanly, and the mess is legible as character rather than as bad pathfinding.

The player is told what happened in plain language ("*Aurora hauls out of the line to chase the sloop*"). **Correcting a misinterpretation — mid-battle intervention or a post-battle reprimand — is parked** (§10); it's fiddly and the system is worth testing without it first.

### 2.3.4 General Chase — releasing the constraint

The "worst in group" rule on collective execution means excess mobility sits idle. **General Chase** is the order that unlocks it: the group deliberately abandons formation and every ship performs to its own individual ceiling — its own speed, its own seamanship, its own captain's judgement.

Gains: fast ships run free, good sailing masters finally matter, stragglers get run down.
Costs: no mutual support, no concentrated fire, and temperament runs unchecked — aggressive captains will over-commit and you may not get them back this battle.

It's a real historical signal, it's one button, and it turns the formation constraint from a tax into a decision. Distinct from **Loose** (§2.2), which is the *involuntary* version — cohesion lost because the commander is dead or the group is shattered.

### 2.4 Sailing model

- **Points of sail** with per-hull polar curves: no-go zone ±45° off the wind, best speed on a broad reach, slowest close-hauled and dead downwind.
- **Weather gauge** dictates engagement range. Fighting from leeward heels your lee gun ports toward the water — a real gunnery penalty on one side.
- **Tacking** risks being caught in irons (chance scales inversely with topmen proficiency and sail damage). **Wearing** is safe, costs ground.
- **Wind shadow** behind large hulls and headlands. Wind shifts on a slow noise function; a good sailing master gives 60 s of warning.
- Currents and shoals on the tactical map; local knowledge or a bought chart reveals depth.

### 2.5 Gunnery

| Band | Distance | Accuracy | Notes |
|---|---|---|---|
| Extreme | 700–1200 yd | 5–10% | Wasteful; tests the range only |
| Long | 350–700 yd | 15–25% | Chain shot vs rigging viable |
| Close | 100–350 yd | 35–55% | The working band |
| Point blank | < 100 yd | 60–80% | Double shot, grape, hull-smashing |

```
reload_time = 180s - (proficiency × 0.9)     # 180s green → 90s elite
  × 1.15 per 25% understrength
  × 1.3  if wounded/exhausted
  × 0.85 if Master Gunner on that deck
```

**Shot:** round (structure) · chain (rigging) · grape (crew, morale) · double (point blank only, +5% burst risk per gun) · heated (fire risk, reputation cost).

**Raking** along the enemy's length: bow ×2.0, stern ×2.5, plus heavy morale damage. Earning a rake is the payoff for good positioning — where the sailing model cashes out.

**Damage tracks**, three, independent, all visible: **hull** (integrity → flooding) · **rigging** (masts, yards, sails → speed and turn) · **crew** (casualties by company, feeding §3).

**Criticals:** magazine · rudder shot away · mast down · gun burst · fire (pulls crew off the guns to fight it).

### 2.6 Boarding

Grapple under 30 yd at low relative speed. Resolves as a **compressed land engagement** (§6) on a deck map, 60–120 s, morale-based — reuses the land engine rather than duplicating it.

Boarding a fresh, high-morale crew should be a mistake. It's the finisher after grape and a rake, not an opening move. Prizes need a prize crew drawn from your own companies, which is a real cost under §3.2.

### 2.7 Time controls

Real-time with unlimited tactical pause. Speeds ×0.5 / ×1 / ×2 / ×4, auto-dropping to ×1 on: enemy entering close band, critical hit, grapple, a group losing cohesion, a ship striking colours.

---

## 3. Crew & Officers

Two tiers, different in kind. **Companies are portable assets you deploy.** **Officers are characters you keep.**

### 3.1 Crew companies

Crew is grouped into companies of 8–20: **gun crews** · **topmen** · **boarders** · **marines** · **damage gang**. Each tracks **strength**, **proficiency (0–100)**, **fatigue**, **morale**. Nothing else.

Understrength companies degrade sharply — a gun crew at 60% strength fires at about 45% rate, because the reload cycle needs specific hands.

### 3.2 Companies transfer between ships

Companies belong to *you*, not to a hull. Ships have **berths** by type:

| Ship | Gun crews | Topmen | Boarders | Marines | Damage gang |
|---|---|---|---|---|---|
| Sloop | 2 | 1 | 1 | — | — |
| Brig | 4 | 1 | 1 | 1 | 1 |
| Frigate | 6 | 2 | 2 | 1 | 1 |

This is the decision it opens up, and it's a good one: your best gun crew on a sloop is a raider that punches far above its rate — perfect for cutting out merchants and running. The same crew on a frigate is a line-of-battle asset. You can't have both in the same battle, and moving them takes time you may not have.

**Rules:**
- **In port:** transfer freely, no cost.
- **At sea:** requires calm seas and roughly 30 minutes with the boats out. **Locked — not port-only.** Not possible mid-battle.
- **Ships are equipment, not characters.** No familiarity, no "this crew knows this hull" bonus, no acclimatisation period, anywhere. A company performs at its proficiency the moment it comes aboard. Officers and companies are what you deploy; hulls are what you deploy them in. Hulls do, however, vary in quality — see §4.
- **Friction is opportunity cost, not penalty.** Reshuffling costs world time, and world time matters because the living world keeps moving — prizes sail, wars start, rivals grow. That's sufficient to stop pointless churn without punishing the player for using a system the game is built around.
- Oversized company in a small berth: surplus hands idle, no benefit, minor grumbling. Undersized in a large berth: the battery is understrength, per §3.1.
- Companies that survive enough action acquire **names** ("Ferrer's Battery"). Costs nothing to implement, and it's most of the emotional attachment.

### 3.3 XP: engagement-weighted, not action-counted

"The more you do it the better you get" invites farming fishing boats, so XP is awarded **per engagement, scaled by danger.**

```
E    = clamp(enemy_strength / own_strength, 0.25, 3.0)
pool = 100 × E                                # 25–300, hard cap 300
```

Split by **participation weight** — shots fired, casualties taken, boarding executed, time held under fire. Sitting out earns nothing.

```
gain = share × (1 - current/100)^1.5
```

| Current | Gain multiplier |
|---|---|
| 0 | 1.00 |
| 25 | 0.65 |
| 50 | 0.35 |
| 75 | 0.125 |
| 90 | 0.032 |
| 95 | 0.011 |

0→50 is a season. 75→90 is a career. 95+ needs repeated genuinely dangerous battles, which cannot be farmed.

### 3.4 Drill and the plateau

Drill at sea (costs powder, time, and morale) raises proficiency toward a **ceiling of 60** — about +3/week below 30, +0.8/week above 50, zero at 60.

**Above 60, only real combat counts.** The most important balancing rule in the whole progression system: veterans become irreplaceable, their deaths become losses, and new players still get a clean on-ramp to competent.

### 3.5 Casualties and dilution — the central tension

Casualties are permanent. Replacements: port recruitment (P ≈ 10–20), prisoners (P ≈ 30–50, loyalty cost), or transfers from your own companies.

```
P_new = (N×P + R×Pr) / (N + R)
```

Then weekly **seasoning** — veterans teach, but only while they dominate:
```
vet_fraction = N / (N + R)
drift = 0.6 × (P_ceiling - P_new) × vet_fraction²    per week
```
The squared term is the point: dilute past half and recovery nearly stops.

**Worked example — elite gun crew, 12 at P=82, loses 5:**

| Choice | New P | Combat effect | Recovery |
|---|---|---|---|
| Run at 7/12 | 82 | reload ×1.15–1.3, a gun unmanned | n/a |
| 5 green (P=15) | **54** | full rate, accuracy gutted | ~+1.6/wk, slowing |
| 5 from topmen (P=50) | **69** | both companies weakened | ~+2.6/wk |
| 5 prisoners (P=40) | **65** | loyalty −8, mutiny risk | ~+2.4/wk |

Four real answers, no dominant one. First thing I'd playtest.

### 3.6 Officers — deliberately thin

5–12 per fleet. Roles: Sailing Master · Master Gunner · Quartermaster · Bosun · Surgeon · Carpenter · Marine Sergeant · Navigator · plus a Captain per ship.

**Skills, 0–100**, raised by use: Gunnery · Seamanship · Navigation · Inspire · Medicine · Repair · Melee · Negotiation · Leadership. (*Signals cut with §2.3's latency system.*)

**Perks at two thresholds only — 45 and 80** — each a choice of two, so two Master Gunners with the same skills still play differently. Two thresholds rather than v0.1's three, to hold total career decisions down to roughly 20 across a full campaign. Example (Gunnery):

- *45:* **Dismasting Eye** (+35% chain effect) | **Hull Smasher** (+25% round at point blank)
- *80:* **The Long Shot** (+15% long-band accuracy) | **Rolling Broadside** (+30% hit rate, doubles cycle time)

Permanent, no respec. Officers should read as having had a career, not a build.

**Loyalty is event-driven, not simulated.** No weekly tick. It moves when something happens — a battle won or lost, plunder divided, a request granted or refused, being ordered into a hopeless fight. In port, an officer with a problem surfaces **one line of text**: *"Ferrer wants a ship of his own."* (Or, once havens exist, *"a town of his own"* — a governorship, §7.1.) You grant it or you don't. That is the entire management interface.

**Desertion is telegraphed, never a surprise:** two refused requests plus a defeat. Then the officer leaves — **with their ship, their companies, and their perks** — and enters the living world as a named rival who knows your habits and your usual ports. Your worst enemy should be someone you trained. Huntable, ransomable, eventually re-recruitable at a price.

**Acquisition:** taverns (skills partly hidden until observed) · promotion from within, where a company's proficiency seeds the new officer's skill · captured enemy officers · reputation-gated walk-ins.

### 3.7 Provisioning, discontent & mutiny

**Provisioning is a decision, not a timer (holds §1.1).** A ship sails on stores — **powder & shot, food & water, pay owed**. You **outfit before a voyage or a raid**, a stocking choice made in port, exactly like a landing party drawing muskets and ammunition (§6). Run low mid-cruise and your options narrow — you can't sustain long gunnery, the crew goes hungry, the grumbling starts. It's a *stock you spend and a plan you commit to*, never a meter to service.

**Discontent is event-driven, never a serviced bar (§1.1).** An unhappy ship is the sum of *events*, not a gauge: shares unpaid or split thin, defeats, being driven into hopeless fights, running out of food or pay, brutal discipline. Grievances surface as **plain-language warnings** — *"the men are muttering about the last split"* — telegraphed like officer desertion (§3.6), never a bolt from the blue.

**Mutiny is whole-ship.** Discontent isn't crew-only or officer-only — **an unhappy ship turns as one**. Officers modulate *when and whether*: by their temperament and loyalty (§3.6) an officer can **incite** a rising early (a wilful, disloyal one fanning it) or **hold it off** (a respected, iron-nerved one keeping the deck in hand) — the very stats that make officers matter in a fight decide who steadies the hands below or lights the fuse. Ignore the warnings and the ship rises: at best they maroon you or force your course; at worst they take the ship and turn on you — another named rival born of your own neglect (cf. §3.6, §7.1 governors).

---

## 4. Ships

### 4.1 Ships are equipment — but not identical equipment

A hull has no crew identity, no loyalty, no familiarity bonus (§3.2). What it *does* have is **its own stat roll**. Two sloops of the same class are not the same sloop.

**Stats are always fully visible** — in the fleet management view, in a shipyard, on a prize you have just taken. You are the captain of a fleet; narratively, you know your ships. There is no survey step, no hidden roll, no discovery mini-game.

**There is no condition mechanic.** Stats are rolled when the ship is generated and are **permanent** — they never improve, never degrade. Nothing ages, rots, wears, or needs its quality maintained. Battle damage (§2.5) is temporary and fully repairable, returning the ship to her rolled values. Build quality, timber, the yard's reputation, her age — all of that is **flavour text that explains the numbers**, never a system that tracks them.

Across a campaign the player might own ten sloops. Roughly two are exceptional, five unremarkable, three genuinely bad. **This is the entire source of attachment to hulls, and it's stronger than sentiment: you cannot buy a replacement for a good ship, you can only go looking for one.** Losing her is a permanent setback, not a purchase order.

### 4.2 What varies

Four axes, rolled independently within the class's baseline.

| Axis | Effect | Flavour cause |
|---|---|---|
| **Strength** | Punishment absorbed before flooding; resistance to criticals | Timber quality, framing, scantlings |
| **Sailing** | Speed retention, how close to the wind she'll lie | Hull lines, rig proportions |
| **Handling** | Turn rate, tack success, stiffness under press of sail | Balance, ballast, rudder |
| **Burden** | Berth and cargo capacity (small variance only) | Internal arrangement |

The flavour cause exists so the ship's description can tell a story — *"old, but built by a yard that knew its business"* — without a single line of simulation behind it.

### 4.3 Distribution

Roll each axis on a clipped normal: mean 100, sd 12, hard clamp to [70, 130]. No absurd outliers in either direction; a bad ship should be a liability, not a joke, and a good one a treasure, not a cheat.

Composite tiers, tuned to land near the 2 / 5 / 3 shape:

| Tier | Frequency |
|---|---|
| Exceptional | 10% |
| Good | 15% |
| Average | 45% |
| Poor | 20% |
| Wretched | 10% |

**Provenance shifts the curve**, so where you get a ship matters:

| Source | Mean | Spread |
|---|---|---|
| Naval dockyard build, or prize from a major navy | High | Tight |
| Reputable private yard (costs more) | Above average | Tight |
| Colonial or merchant yard | Average | Wide |
| Converted merchantman, pirate-built | Below average | Very wide |

Because stats are visible, provenance shapes **what's on the market and what it costs** rather than what you can find out. Naval-built hulls are rare and expensive; the converted-merchantman end of the market is cheap, mostly junk, and occasionally hiding something excellent in plain sight. The decision is economic — price against stats against class — not a gamble.

### 4.4 What this makes the player feel

- **Risk aversion with your best hull.** Take *Wanderer* into the fort assault, or send the mediocre brig and accept a worse outcome? The tension emerges for free and needs no supporting system.
- **Group composition gets harder.** Group speed is the slowest hull's speed (§2.3), so a wretched ship drags an exceptional one.
- **Ships earn names and records.** Reputations are worth having *because some ships are genuinely better*. Purely narrative, no mechanical stickiness, no conflict with portability.
- **Soft failure hurts correctly.** Losing everything (§7) costs you the hulls and keeps you the people — the right shape, because the hulls were the irreplaceable part.

---

## 5. Presentation

### 5.1 Direction: low-poly ships on a sunlit sea that resolves to a chart

**Ratified 2026-09-23, amending v0.11's cartographic sea.** The named targets are *Sid Meier's Pirates!* (2004) and *Rise of Piracy* (2026). Both are 3D, both are top-down tactical, and both are **sunlit and saturated rather than cartographic**. That settles the medium — stylised 3D — and changes exactly one thing about the old direction: **the sea at the working camera height.**

**Ships** are stylised low-poly — saturated, colourful, closer to *Sid Meier's Pirates!* in palette than to anything realistic, but with facets left visible. Vertex colours, no textures. *(Unchanged by the amendment.)*

**The sea at the working height is sunlit Caribbean** — saturated blue-green, one strong sun, foam at shorelines and wakes. **Stylised, never simulated.** Photoreal water — displacement, screen-space reflection, subsurface scattering — is the hard shader problem a small budget never wins, and it is not what either reference does. Two scrolling normal layers, a shoreline foam band and specular glints carry the whole read.

**The chart is not cut. It is where the world goes when you pull back** — parchment and ink tones, hand-drawn depth contours, stippled shoals, an engraved compass rose, faint rhumb lines. It owns **the zoom ceiling (§5.4) and the strategic map (§5.3)**, and nothing below them. This is a better home for it than "chart everywhere" was: the §5.4 blend used to be a chart sharpening into a chart, and is now a place becoming a drawing of itself, which is the reason to have a blend at all.

**What the amendment costs, recorded rather than glossed.** The old direction's lead argument was **structural channel separation** — a desaturated sea meant the wind arrow, range bands and arcs of fire could never compete with the scene, so the channels separated themselves instead of requiring discipline. **A saturated sea gives that up.** *Pirates!* never hit the problem because it carried almost no tactical annotation; this game carries a great deal. The discipline is now deliberate rather than structural (§5.2), and annotation that has to shout to be seen is a failure of the sea's value range, not of the annotation.

**Diorama framing** supports this: a contained water volume with visible edges, subtle vignette, slight depth-of-field at frame edges. The premise becomes *this is a model*, and models are supposed to be simplified — so low asset quality stops reading as compromise.

**References, and what each one is for:** ***Pirates!*** — palette, sunlight, toy scale, the cheerful register. ***Rise of Piracy*** — camera and framing; it is structurally this game (top-down fleet actions, RTS control, land assaults). ***Bad North*** — the asset economy: low-poly, tiny asset count, looks far more expensive than it is.

**What Rise of Piracy's weight is NOT evidence for.** It ships ~28 GB against a GTX 1650 floor. That is content volume — 1600–1900, 200+ commodities, destructible environments — not the look. The look here costs the §5.6 asset list and nothing more: three hulls, sail plans, damage variants, one sea material, one smoke system.

### 5.2 Colour rule

**Hue for identity, contrast for information.** Held strictly, because it is very hard to retrofit:

- **Faction gets hue** — sail and trim colour, plus a flag plane. Spanish red, English blue, French white. No realism constraint forcing everyone's canvas to be off-white, so faction ID at fixed camera distance is nearly free. Realistic naval games struggle badly with this at fleet scale.
- **Annotation gets contrast, not hue** — high-contrast, low-saturation line work for wind, range bands, arcs, group tethers. It must never compete on hue.
- **The sea reserves a value band for annotation.** This bullet carried itself while the sea was parchment; on a sunlit sea (§5.1) it has to be paid for. The water's rendered values stay off both ends of the range, leaving a near-white and a near-black that belong to annotation alone. Where a reading still fails — a wind arrow over sun glint — the fix is a thin dark scrim beneath the line work, **never** a hue shift, because hue is spoken for by faction identity.
- **Per-hull tint and small trim variation** individuates ships at almost no cost, reinforcing the attachment that per-hull stat variance (§4) exists to create. Your ten sloops should look like ten different sloops.

### 5.3 Camera: RTS rig with a locked floor

Not isometric, but RTS in feel and framing.

| Property | Setting |
|---|---|
| **Height** | **Locked floor, free ceiling.** The closest position is fixed; the player can zoom *out* from it, continuously, up to a cap. Zooming in past the floor is not possible. |
| **Zoom cap** | Whole engagement visible. Beyond that there's no information to gain. |
| **Pitch** | Lerps with height — ~60–65° at the floor, rising toward ~80° at the ceiling |
| **Yaw** | Free 360°, plus a **snap-to-wind** hotkey and auto-snap on wind shift by default |
| **Pan** | Keys, edge, and drag |

**Zoom out is free; zoom in is expensive.** This is the whole reason the asymmetry works. The art budget is set entirely by the *closest* the camera can get — that's the detail floor, one LOD, one texel density — and it stays locked. Pulling back only ever reveals less, which costs nothing to support. So the player gets the RTS zoom-out they expect, and none of the budget consequences of a free camera.

Snap hotkeys for both extremes: one key to the working floor, one to the overview ceiling.

**Free yaw is not a luxury — it's required by the core mechanic.** Wind direction is the primary axis of every naval decision. A locked orientation forces the player to mentally re-rotate the wind every engagement, taxing the exact thing the game is about. Players will spin the camera to put the wind at the top of the screen because that is how naval tacticians think.

**The floor should be locked before a single asset is made.** It determines the entire art budget — the detail floor, one LOD, one silhouette read, one texel density. Deciding it up front is the largest cost saving available and painful to impose later. Everything above it is free.

Still worth building regardless of zoom: a **minimap** and **off-screen indicators** for ships outside the frame, since the player will spend most of their time near the working floor rather than at the ceiling.

Per layer:

| Layer | Camera |
|---|---|
| Naval tactical | Fixed rig as above |
| Land combat | Same rig, same fixed height |
| Boarding | Fixed, higher pitch, near top-down — decks are cramped and need clarity, not drama |
| Strategic map | Locked north-up. Charts are north-up; fighting that convention gains nothing |

### 5.4 Chart view — the far end of the zoom

Chart view is not a separate mode. **It's what the world becomes as you pull back**, blended continuously as a function of camera height:

| As the camera rises | The world |
|---|---|
| At the floor | Low-poly ships on the sunlit sea, annotation present but restrained |
| Mid | Sun and saturation drain out of the water toward parchment, depth contours surface, annotation gains weight |
| At the ceiling | Ships cross-fade to flat inked tokens and silhouettes, sea is fully chart, annotation at full strength, whole engagement visible |

**This blend is now the whole job of the cartographic look**, and it is a better job than it had. The transition is not a stylistic break; it is a place turning into the drawing an admiral would have made of it — you pull back and the sea you were sailing becomes the chart you plan on. Mechanically it is still a lerp on a handful of shader parameters plus a mesh-to-token cross-fade past a threshold, so it is still cheap.

Two useful consequences: the overview is the natural home for group tasking, and **class identification at maximum zoom is handled by tokens rather than meshes**, which relaxes the silhouette constraint on the 3D assets (§5.6). Available live as well as paused, with auto-frame on tactical pause now possible again.

### 5.5 Where production value actually comes from

All code, not assets — which is the point at this budget:

- **Motion sells low-poly harder than geometry does.** A simple ship that heels into the wind, pitches over swell, and luffs her sails coming about reads better than a detailed one sliding flat across the surface. This is the single largest gap between "looks cheap" and "looks good."
- **One strong directional light, long shadows, no textures.** Long shadows from a low sun read excellently from a high camera and restore the heading and mass cues that flat shading loses.
- **Weather as a palette-and-lighting preset.** Squall: desaturate, raise fog, flatten contrast. Dusk action: warm rim light, cool shadow tint, long shadows. Enormous perceived variety from a handful of presets.
- **Smoke is the hero effect.** In an age-of-sail game gun smoke *is* the signature image, it's particles rather than assets, and drifting banks double as readable information about who has fired recently. Worth over-investing in.
- **Damage by mesh swap, never deformation.** Torn sail → jagged-edge variant. Broken mast → hide the top segment. Readable, cheap, no rigging.

### 5.6 Hard constraints on asset design

- **Ship classes must be identifiable by silhouette across the working zoom range.** Sloop, brig, and frigate need to read instantly, or fleet-scale tasking becomes guesswork. Less restrictive than it was — at the zoom ceiling identification passes to inked tokens (§5.4), so the 3D meshes only have to carry it from the floor to mid-zoom.
- **Exaggerate class footprint differences past realism.** Toy scale is correct, not a cheat — ships are the subject, so let them be large relative to islands and let the classes differ in size as well as shape.
- **Exaggerate the bow** so heading reads from above, and give every moving ship a wake trail as a directional cue. Flat shading loses the gradient that normally communicates facing, and heading is critical because broadside arcs depend on it.
- **MVP asset list:** 3 hull meshes + sail plans + damage variants, one chart-sea material, one smoke system, faction colour sets. That is close to the whole of it.

---

## 6. Land Combat — summary

Squad scale, 4–8 companies on real terrain. **Morale is the win condition** — you rout garrisons rather than annihilate them. Inspire actions, flanking, and artillery attack morale directly. Finite powder per engagement. Casualties permanent and felt in your ability to sail home. Fort assaults offer routes — bombardment, escalade, sap, bribery, night infiltration — each leaning on a different officer skill, so your roster determines which forts are practical targets. Shares its resolution engine with boarding (§2.6).

**Taking a settlement is a decision, not just a fight.** A won raid resolves to a map-level choice — **pillage · raze · occupy** — and occupying opens the haven game (§7.1).

---

## 7. Strategic Layer — hooks

Living world (nations war and reconcile on their own, ports change hands, rival captains rise and die without the player) · **Articles** (share splits and standing rules; shapes recruitment pool and reputation) · **Soft failure** (total loss → marooned, restart with a sloop, officers' loyalty and reputation intact — you keep the people and lose the irreplaceable hulls, per §4.4) · **Patronage** (competing crowns with conflicting obligations).

### 7.1 Havens & town control (thin slice)

You are a pirate — you should leave a mark on the map. A won land raid (§6) resolves to three verbs:

- **Pillage** — take gold and trade goods and sail on. Repeatable, but the town recovers and *resents* you (reputation, stiffer resistance next time). Low commitment.
- **Raze** — burn it. A bigger one-time haul, denies the port to a rival crown, and swings your terror-reputation — but it's gone; no future value. Scorched earth.
- **Occupy** — hold it. Costs a **garrison** left behind and an **officer installed as governor**. The long game, and the interesting one.

**Occupation is delegation, not micromanagement** (holds the line on §1.1 — no timer chores). The governor is no longer under your tactical control; he *runs the place*. What you get is gated by your **relationship with him** (loyalty, §3.6): a loyal governor holds the town, remits income, and answers your calls; a neglected or over-ambitious one skims, underperforms, and can eventually **declare independence or defect with the town** — a rival haven you built and now must retake. This is the depth that town control usually lacks: the benefit is real *because it can be lost*, and because it rides on a named person, not a menu.

**Choosing the governor is the decision — loyalty vs. competence.** Defection risk is *low* overall, so this isn't fear, it's fit. "Management" is only one competence; there can be others — defence, trade, seamanship to run the shipways, a hard name that keeps a town cowed:
- **The loyal caretaker** — devoted, **cheap and infrequent upkeep**, almost never turns. Steady but rarely gifted. Right for a quiet holding.
- **The talented operator** — develops the haven faster, earns more, defends it better — but the good ones know their worth, aren't always the loyal ones, and demand **frequent payoffs** to stay. Skimp and he walks, taking the town.
- **Prosperity is safe upside.** Developing a *single* haven as far as you like does **not** raise its governor's urge to betray — a rich, well-run town is a reward you can pour into freely, not a trap. "Ultimately he works for you" — but that still never means he *can't* leave.

**The betrayal pressure is breadth, not depth — and it is the natural cap.** Holding *several* havens is what breeds defection: you are building competition among your own holdings — rival power-centres, attention spread thin, ambitious governors who now have something to be top dog *of*. Each new town nudges the odds that one breaks away to carve out its own. So a couple of well-tended havens is a stronghold; an empire of them manufactures the rivals who'll take them. That is the cap — emergent from the fiction, not a hard number. You're a pirate captain, not an emperor (mirrors the fleet's group cap and §1.1's anti-spreadsheet rule).

**Develop the haven toward your own goals — a few set-and-forget slots, never a city builder.** Standing investments the governor carries out, each a passive benefit:
- **Fortify** — walls, guns, a safe harbour and careenage; hard for a crown to retake.
- **Plantation** — crops / trade goods → standing income.
- **Lumberyard + shipways** — **build and repair ships here.** This is the golden thread (§1.2) made literal: a town you took *on land* becomes where your *fleet* is born.
- **Tavern & articles** — a local pool of crew and the occasional officer.

**You have impact on the map.** Havens are yours to lose (soft failure, above): safe ports, production, and a projection of power the living world answers — crowns blockade or besiege them, rivals covet them. A thin slice, but a real one: **raid → hold → develop**, and the sea is fed by what you took ashore. (Also gives an ambitious officer something to *want* — "a town of his own", §3.6 — and a reason to turn on you if you deny or neglect him.)

### 7.2 Fame, infamy, and the will to fight

Reputation is a **live axis, not a flavour stat — it is Pillar 5 ("you win by breaking will") at map scale.** Two poles, earned by deeds:

- **Fame** — bold captures, honoured articles, mercy shown. A famous captain is *feared*: weak ships **strike without a fight** and towns **treat rather than resist**. Fame wins battles before they are fought — the same will-breaking that routs a company, now at the scale of a whole enemy deciding you are not worth the blood.
- **Infamy** — towns razed, quarter refused, flags betrayed. Infamy brings **pirate-hunters and navy squadrons**, closes friendly ports, and *hardens* resistance (they would sooner burn than yield to **you**).

Reputation is **per-nation** where it counts (the five crowns), so you can be a fêted privateer under one flag and a hunted devil under another — the raw material of patronage and shifting allegiance (§7).

**Parley, ransom, surrender — the non-combat verbs fame unlocks.** An encounter or a raid need not be a fight:
- **Demand surrender / tribute** — leaning on fame, order a ship to strike or a town to pay you off. The more fearsome the name, the more often it works, and no powder is spent.
- **Ransom** — captured officers, notables, or a taken town can be **ransomed** for coin or leverage instead of sunk or held; ransoming vs. executing swings fame/infamy.
- These extend the raid verbs (§6, §7.1): **extort** sits beside pillage / raze / occupy — take the payoff and the reputation, leave the town standing and afraid.

> **Open (§11) — "false colours."** Sailing under a false flag to close on prey fills a real gap (how a lone pirate gets into range of a wary target) but has always felt a little off as a mechanic. Parked. The "get close" gap may be better answered by speed, the weather gage, or fame itself (they let you near because they dare not provoke you) than by a flag toggle.

### 7.3 Trade & the plunder economy

A **real economic layer** — think *Port Royale* — not set dressing. It is the peaceful, wealth-building counterpart to plunder, and the thing your havens exist to power. Tertiary in the *order we conceive* the game (§1.2), never in how deep or satisfying it should be. What keeps it off the §1.1 spreadsheet is **delegation and automation**: you *configure routes and set goals*, your **captains and governors run them**, and the sim reports back in plain language. Decisions happen in batches, in port; you never service a tick.

- **Living markets.** Every Caribbean port runs supply & demand — prices swing with war, gluts, disasters, and your own buying and selling. Flood a market and the price falls; a besieged town pays anything for powder and grain.
- **Trade routes, not manual hauling.** Set a **standing route** — ports, goods, a ship or two, and **a captain to run it** (the officer connective tissue again). The convoy plies it automatically and remits profit; you get events, not a ledger to tend — *"the Havana sugar run is netting well… and it's drawing pirates."* Set-and-forget, tune only when you care.
- **Production chains in your havens (§7.1).** A haven grows raw goods (sugar, tobacco, cotton, timber) and **processes** them — sugar → rum, cotton → cloth, and, the golden thread made literal, timber → **ships**. The governor runs the chain. Your havens are the *source* of the economy, not just a place to fence.
- **Fencing & contraband.** Plunder is hot — sell it at a discount to a **fence** or a corrupt port, or **smuggle** past a blockade for a premium and a risk. Who will deal with you rides on fame/infamy (§7.2).
- **The core tension: plunder vs. commerce.** Raiding is fast coin and infamy, and it *poisons* trade with the nation you hit; commerce is slow, compounding wealth that needs peace, raises prosperity — and dangles fat, lightly-armed convoys of your *own* for rivals to take. Most careers mix the two; the map remembers which you lean on.

**Depth without the chore.** Genuine systems underneath (supply/demand, production chains, routes), but the *interaction surface* is configuration and delegation — the merchant's version of "organise your fleet, then let it sail" (§1.1, §2.1). This makes commerce a third way to play beside piracy and privateering, not a minigame bolted to them.

### 7.4 The campaign arc: legacy & retirement

Everything above is the *middle* of the game; this is its **shape and its ending** — the frame that turns the loop into a career with a point. There is **no hard "you win" screen.** Instead, a soft, graded finish in the mould of *Sid Meier's Pirates!*: you build a **legacy**, and one day you **retire** on it.

**Aging is the clock — the pressure, not a chore.** Your captain ages across a long campaign; a career is *finite*. Late on, the personal, hands-on edge dulls — you board and lead from the front less well — which eases you naturally from daring raids toward **stewardship**: governing your havens, running trade, sending others to do the cutting-out. It is a slow, ambient arc, never a serviced timer (§1.1). You may **retire when you choose** — bank the legacy — or push your luck until age forces your hand.

**The legacy — what you're remembered for — is the spine (§1) totalled up.** At retirement you're graded into a **station in life**, from a broke drunk in a Tortuga tavern to a pardoned lord, a governor-general, or a legend whose name still empties a merchantman's nerve. It scores:
- **Havens** — the constellation of towns you took, held, and developed. The land-outward heart of it; a few deep holdings outweigh a sprawl that defected (§7.1).
- **Fame vs. infamy** — *how* you're remembered: a feared-but-honoured privateer, or a bloody terror the histories curse (§7.2).
- **Wealth — yours and your crew's.** You retire rich *and* your people do (crew shares, §3) — Cutthroats' "retire wealthy", made to mean something.
- **Rivals broken** — named enemies put down, above all the officers who defected and turned (§3.6): part of your legacy is measured in the monsters of your own making that you hunted down.
- **Your people's fates** — where your officers ended: made governors, given their own commands, retired to your havens, or lost. The connective tissue (§1.2) has arcs too.
- **Standing with the crowns** — knighted privateer or hunted outlaw (§7 patronage).

**Why it matters to the whole design.** The aging clock supplies the **pressure** the loop lacked; the legacy supplies the **goal** — and both ride the golden thread: a career that opens with a lone sloop and is *judged*, at the last, on the havens, the people, and the name you built ashore. Pillar 6 is the floor (total loss maroons you but keeps your people and reputation); **age is the ceiling**, cashing the whole thing out. And because a bloody raider, an honourable privateer, a haven-building merchant-prince, and a lone wolf all grade differently, "what kind of pirate was I" becomes the replay hook.

---

## 8. Risks

### 8.1 Primary

1. **Group-based command may be less fun than direct control.** Still the primary risk. Prototype before anything else is built; failure mode is the player feeling like a spectator. Grouping reduces this risk versus v0.1 — fewer, larger, more meaningful decisions — but doesn't eliminate it.
2. **Two tactical engines** is significant scope. Boarding reusing the land engine is load-bearing.
3. **Diminishing returns may feel like nothing happens.** Needs frequent visible small wins: perk unlocks, company names, veteran flavour text.
### 8.2 Secondary

4. **Low-poly is a crowded visual space** and the default outcome looks like an asset store. Differentiation comes almost entirely from palette and lighting rather than geometry (§5.1–5.2), so both need deciding deliberately and early rather than discovered in month eight. **The 2026-09-23 amendment raises this risk rather than leaving it flat:** "low-poly ships on a living chart" was a look nobody owned, and it now applies only at the zoom ceiling. At the working height the game stands in the same crowded space as every other stylised naval game, carrying palette, lighting and motion (§5.5) alone.
5. **Arena size still needs tuning, though zoom-out has taken the pressure off.** With an overview ceiling the player can always read the whole engagement, so the knife edge from v0.8 is gone. What remains is making sure fleet manoeuvre has somewhere to happen without the working floor feeling claustrophobic. Tune during the step-3 prototype.
6. **Skill resolution may be invisible to the player.** The category rules are elegant but they run under the hood; if the player can't see *why* their group is slow, the rules do no work. Needs surfacing in the organisation UI — a plain line like *"This group sails at Wanderer's pace"* against the limiting ship.

*Retired: pre-battle setup becoming homework. Organisation moved into fleet management (§2.1), so there is no setup phase to bloat.*

---

## 9. MVP Vertical Slice

One island cluster · 3 ship classes (sloop, brig, frigate) · one boarding map · one fort assault · 6 officer roles · 4 company types · ~20 min campaign loop.

**Build order:**

| Step | Work | Gate |
|---|---|---|
| **−1** | Throwaway 2D playable prototype | Playtest — is order-based group command fun? |
| 1 | Sailing, wind, gunnery for a single ship | |
| 2 | One AI-captained consort + order tasking | |
| 3 | Groups, doctrine, commanders, fleet organisation | Re-test: does it hold at 5 groups? |
| 4 | Crew companies, transfer, dilution | |
| 5 | Officers, skills, perks, loyalty | |
| 6 | Ship stat rolls and acquisition | |
| 7 | Land combat engine + boarding | |
| 8 | Living world, articles, patronage | |

Nothing past step −1 is worth starting until the playtest question is answered. If commanding two groups of two isn't fun, five groups won't fix it and neither will the art.

---

## 10. Backlog / Parked

- **Signal latency** — orders taking time, degrading at night and in smoke, halyards shot away. Cut from v0.2. Worth revisiting as an A/B test against instant orders once the group system is proven; it would make flagship choice meaningful, at the cost of feeling like an obstruction.
- **Correcting interpretation** — mid-battle intervention to override a captain's substitution, and post-battle reprimand or commendation affecting future obedience. Parked as finicky; revisit once interpretation has been observed in playtest.
- **Seamless zoom from tactical into the strategic map.** Tempting — the chart aesthetic makes the transition almost trivial visually, and pulling back from a battle into the Caribbean would be a genuinely striking moment. Deferred because the strategic map is north-up locked and a different simulation tick, so the seam is systemic rather than visual. Revisit once both layers exist.
- **Close ship view.** A low, near-deck camera over the flagship for spectacle — heel, spray, the broadside going off. Cut for now because it sets a much higher asset detail floor and low-poly is weakest close up. The rule if it ever returns: it must never carry information the player needs.
- **Officers permanently improving a hull.** A Carpenter with high Repair, or a sailmaker, adding a small permanent increase to Strength / Sailing / Handling. Attractive for two reasons: it gives the Carpenter and Sailing Master a job on the strategic layer, which they currently lack now that the survey step is gone; and it makes a mediocre hull you're fond of salvageable. Two cautions for when we pick this up — it's the sole sanctioned exception to "stats are permanent" (§4.1), and any per-hull improvement track risks becoming an optimisation chore, so cap it low and make it slow.
- **Re-composing groups mid-battle** — currently forbidden by design. Test whether the restriction reads as principled or as arbitrary.

## 11. Open Questions

- ~~Group cap of 2–5?~~ **Locked at 2–5.**
- ~~Does a group commander's skill apply to the whole group, or only set a ceiling for it?~~ **Resolved in §2.3** — neither; resolution is by skill category.
- ~~Is "worst in group" too punishing?~~ **Kept as-is.** The punishment is the point: it turns composition into a train-or-segregate decision (§2.3.2). No commander-compensation knob.
- ~~Should Navigation-as-shared extend to the strategic map?~~ **Resolved in §2.3.1** — on the strategic map *all* collective skills use the best officer in the group.
- ~~Should ships have crew identity?~~ **No.** Ships are equipment (§3.2). Attachment lives in named officers and named companies, which travel with the player, rather than in hulls they will eventually sell.
- ~~Does a ship still accumulate *narrative* history?~~ **Yes (§4.4).** Quality variance gives reputations something real to attach to.
- ~~Should a hull's stats ever become fully known?~~ **Yes — always visible (§4.1).**
- How visible should temperament axes be before a captain has fought? Fully hidden is more dramatic and more frustrating.
- With collective XP going to the floor-setter, is there a degenerate strategy of parking one weak officer in a strong group permanently? Probably self-limiting, since the group is combat-crippled while he's there — but worth watching.
- **False colours (§7.2)?** Sailing under a false flag to close on prey fills the "how does a lone pirate get in range of a wary target" gap, but feels gamey as a toggle. Is a better answer speed, the weather gage, fame (they daren't provoke you), or a lighter disguise — or is the gap not worth filling? Parked.
- **Campaign length & aging pace (§7.4)?** How long is a full career, how fast does age dull the edge, and how freely can you retire early to bank a legacy vs. push your luck? Tuning — needs a campaign to feel it in.