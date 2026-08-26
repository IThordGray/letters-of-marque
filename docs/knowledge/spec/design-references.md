# Design References

**Layer:** WHAT (tool-agnostic) · **Authority:** human edits win.

The team's standing design reference, so we don't re-derive the basics each time:
the **Cutthroats heritage**, **comparable-game mechanic patterns**, and **pirate-
flavour fit**. The `game-designer` agent leans on this and proposes additions; the
manager records them. The canonical design is still [`../../design-doc.md`](../../design-doc.md)
— this file is *reference and lineage*, not the spec.

> **On comparable games:** named here only as *research inputs*. We adapt good
> mechanics to pirate/privateer flavour; we never clone a title or anchor the game to
> one. (Borrow a formation-shaping *interaction* — don't import parade-ground drill.)

## Cutthroats: Terror on the High Seas (1999) — the lineage
Spiritual ancestor: an age-of-sail **privateer career** — build a reputation, take
ships and towns, run a crew and a base, weigh plunder against commerce.

> The user is the domain expert on this title. Entries marked **[confirm]** need their
> verification — this section is seeded conservatively rather than from unreliable
> recall, and must not be treated as fact until confirmed.

- Privateer/pirate **career arc** across a Caribbean-style map. **[confirm / enrich]**
- Ship-to-ship combat and **boarding**; crew as a managed resource. **[confirm / enrich]**
- Reputation / notoriety shaping how others react. **[confirm / enrich]**
- Land raids in the OG were **straight field fights** — no objective / extraction / alarm
  structure. **[confirmed]** Our raid *adds* that deliberately (objective + extraction +
  diegetic alarm) — a departure we chose, not inherited from the lineage.
- Towns were **lootable / razable at the building level**: you could loot **or** raze any
  building; churches & the governor's house yielded loot **and** gold; a building could be
  **set on fire by putting powder in it**. **[confirmed]** We keep the building-level
  interactivity (loot / raze / torch-by-powder) but fold the loot-vs-gold split into one
  legible **haul**, typed by building. The human's steer: the town must **feel part of the
  game, not just obstructions**.
- _(Add confirmed mechanics and feel here as we go.)_

## Rise of Piracy (2026, Early Access) — the closest living competitor
Solo-dev age-of-sail sandbox: *Mount & Blade* at sea, RTS fleet command, island
conquest by bombardment + landing party. EA since Feb 2026, ~78% positive of ~500
reviews, ~12-month EA plan. The nearest neighbour to what we are building — which
makes both its solved problems and its gaps unusually informative.

*Sources:* official Quick Start Guide (press-kit command list + "Tips & Tactics"),
Steam store page, top-rated Steam reviews, the dev's Steam Q&A thread, and a 43-min
Splattercat review (2026-08-25, `youtube.com/watch?v=7No0QOJWMyQ`).

### What it already solves — worth borrowing
- **Contextual right-click, shipped and legible.** Our ratified model, in the wild:
  RMB sea = move · RMB enemy = attack · RMB friendly = guard/follow · RMB shore =
  set invasion landing spot. **The cursor becomes a sword over a valid attack
  target** — the affordance that makes contextual command readable *before* the
  click. Our decision ratifies the resolution rule but not yet the feedback that
  tells the player which action they are about to get. Take this.
- **Modifier-as-verb instead of a menu:** Shift+RMB = board · Ctrl+RMB = bombard
  location · RMB-hold on a friendly = formation offset. *Tension with our spec:* we
  ratified "2+ valid actions → context menu". Modifiers are faster but hidden, menus
  discoverable but slower — likely both, menu for discovery and modifier as the
  expert bypass (same shape as our `A`-key rule).
- **Fleet will is the win condition, and it shipped.** Their own tips: *focus the
  enemy flagship; the fleet may surrender.* Fleets strike rather than sink —
  external confirmation of the one-spine thesis at squadron scale.
- **Capture beats kill, economically:** *boarding and capturing is more profitable
  than sinking — but riskier.* Second independent reference converging with
  Homeworld's salvage corvettes (KAN-21).
- **Blocked arcs make formation matter:** *arrange ships to bring all cannons to
  bear; allies blocking fire will delay shots.* Formation as a live tactical
  constraint rather than decoration — the actual reason to have formations.
- **Two currencies, distinct sinks.** Gold (ships, cargo, upgrades) vs Renown (crew
  quality and recruitment). Captured crew: **ransom → gold, release → renown** — a
  greed/mercy choice expressed purely as currency. Directly relevant to our ratified
  quarter / prisoner / loot verbs and the fame-infamy pillar.
- **Crewing a weapon as an order.** On land, RMB a cannon = 2+ pirates crew it;
  double-RMB drops it. Clean interaction for the raid layer — turning a town's own
  guns on the town.
- **Attack-move is the recommended raid order** — their tips push *Move Attack* over
  plain move or attack. Confirms pattern (B) under "Land command & formations".

### Where it fails — the anti-patterns to design against
- **You cannot read the enemy's will.** The loudest, most repeated complaint: no
  crew / sail / damage readout, so boarding is *"guess work"* and you cannot tell
  when a ship is about to strike. **Fatal for a will-based game, and the single
  biggest lesson for us** — if breaking WILL is the win condition, will must be
  *visible*. A morale spine the player cannot read plays as randomness.
- **Wind is absent from battle.** The reviewer narrates the exact moment it should
  have decided the fight — wanting to force the enemy into the wind — and finds
  nothing there. Live evidence for why our tack/irons commitment must not soften.
- **No station-keeping.** Fleet ships always close when engaging; no distance or
  offset order, so "hold off his quarter" is unsayable. Our group-order vocabulary
  needs it.
- **No battle camera follow** — constant manual repositioning (see KAN-26).
- **Land combat is a placeholder** — *"janky"*, *"zerg mob them after bombarding"*,
  numbers-only resolution. The reviewer never captured a port in ~4h of play.
  **The closest competitor's weakest layer is the one we conceive from first.**
- **Capacity derived from the cargo hold** — a sloop carries more troops than a Man
  O' War. Don't derive fighting strength from stowage.
- **Upgrades are numbers going up** — no equipment slots, no functional distinctness;
  players want ships that differ in *role*, not in stat total.
- **No enemy disengagement at map scale** — pursuers never give up, never fall
  behind, opponent strength is random. The will-spine is missing from the strategic
  layer, and its absence reads as an unfair sandbox.
- **The "dry sandbox" verdict.** The review's closing critique: solid bones, but no
  emergent narrative, no events at sea, no rivalries — **and unnamed, story-less
  officers**, which he explicitly wishes were named characters with their own arcs.
  *The most-wished-for missing feature in our nearest competitor is our central
  ratified pillar* (officers as connective tissue — the person, not the hull).


## Genre mechanic patterns
Catalogued per mechanic family as features reach them. Each: the pattern, where it
shines, where it drags, and the pirate-flavour verdict.

### Land command & formations
- **Drag-to-shape a formation** — drag out **width and facing** when issuing a move,
  so one gesture sets frontage and orientation. Reads as commanding a *body of men*,
  not a cloud of dots. *Pirate verdict:* good as an option, but keep it **loose** —
  privateer bands are ragged, not drilled ranks. (Currently we auto-slot into a wide
  oval; drag-to-shape would be the manual upgrade.)
- **Attack orders (genre patterns):** (A) *smart right-click context order* — one
  button, instantly legible, but ambiguous when an enemy sits on target ground, and it
  collides with formation-move-on-right-click; (B) *attack-move* (advance & engage on
  contact) — the order an advancing raid needs, but a hidden keybind; (C) *stances /
  postures* (guard / skirmish / fire-at-will) — the anti-babysitting layer, but keep
  the set tiny and **show** each unit's posture or it becomes hidden state; (D)
  *morale-first command* (Close Combat) — morale overrides orders (our thesis, and it
  shipped!), but borrow only **broken**-men-stop-obeying — **never** steady-men
  disobedience (that's the naval-interpretation layer, banned on land).
- **RATIFIED — contextual command (universal):** right-click resolves the valid
  actions — 1 → do it (ground = move, live enemy = attack); 2+ → a menu (surrendered
  enemy → kill / prisoner / loot; ship → attack / board / ram). Verb-key bypass: `A` +
  click = attack unit / attack-move ground. Land postures: *At 'em / Hold fast / Hold
  fire* + Halt; loose default. (See `../decisions.md`.)

### Morale / will
- _(To research: how games make a rout **read as a cause**, not a bug — visible fear,
  contagion, rally moments.)_

### Deploy & equip (pre-battle roster + loadout)
How comparable games compose + kit a party before battle — research inputs only.
- **Squad-slot cap + fast loadout (XCOM-like):** a hard slot cap makes every pick
  precious; quick, legible screen. *Drags:* a gate before *every* mission + re-shopping
  single-use consumables each run — the busywork our no-timer pillar forbids.
- **Party-from-roster + provisioning (Darkest-Dungeon-like):** draw a small party from a
  churning expendable roster, buy consumables for the run. *Good:* role-driven
  composition, loss stings but recovers. *Drags:* provisioning becomes guesswork / a
  restock chore if you can't read the coming fight.
- **Roster > field-cap + shared stash (Battle-Brothers-like):** more troops than you can
  field forces "who sits out"; gear-to-threat matching. *Reject:* daily **wages** upkeep
  (a timer) and heavy stash management.
- **Diegetic cap, no loadout screen (Mount-&-Blade / Pirates!-like):** party size capped
  by a leadership/renown stat; fight with who you travel with; troops are tiers. *Good:*
  no per-battle ritual, cap scales with progress. *Drags:* faceless troops, little
  loadout granularity.
- **RATIFIED — pirate verdict:** outfit a raid **once** ("load the boats"), not
  per-skirmish. **No artificial cap** (boats shuttle at night — unconvincing friction);
  landing more crew is a *benefit*, so the raid doesn't tax size — the cost is upstream
  (sustaining a big crew on voyage: provisioning + morale). Louder-by-size is soft/optional.
  **Per-unit ammo**, not a shared pool (layer/rotate musketeers; dry → cutlass).
  **Permadeath** (a future medic softens it). Pirates = **unnamed pool** equipped by
  group; officers = **named**, freely assigned to lead squads. (See `../decisions.md`.)

### Naval command & fleet
- _(To research at naval kickoff — **KAN-21**: how *Homeworld* solves group-command
  in a large open space with a fleet that persists across a career, and how much of
  it adapts. Candidates: fleet persistence, capture-over-kill (salvage → prize-taking),
  formations & slowest-ship speed, per-group stances, the sensors-manager zoom-out,
  subsystem targeting → masts/rudder/crew. Expected reject: mid-battle resource
  harvesting. Wind, tacking and the interpretation layer are ratified and out of
  scope for the spike.)_

### Camera & UI presentation
- **Zoom-driven view switch (KAN-26)** — _(to explore)_ isometric close in, flipping to a
  **top-down tactical** view past a zoom threshold: one control serving two jobs —
  read the *figures* up close, read the *shape of the engagement* far out, with no
  separate tactical-map mode to learn. Reference: **Masasa** **[confirm title]**.
  Overlaps the sensors-manager zoom-out in KAN-21 — look at them together.
- **Character-in-motion UI (KAN-27)** — _(to explore)_ how a *running figure* reads:
  animation weight, the furniture attached to it (selection ring, destination, path,
  state), camera relationship, movement feedback. Reference: **Hordeguard**
  **[confirm title]**. Open question first: *which* of those the human means. Key
  test — a solo-character UI often doesn't survive twenty men at once.

### Raid — objective + extraction
How comparable games do infiltrate → hit objective → get out, and the pressure that shapes
it. Research inputs only.
- **Evac zone (XCOM 2):** "get your people to this tile" — a clean, legible extraction that
  kills turtling. *Take* the evac zone; *reject* the literal turn-counter (the gamey
  countdown our no-timer pillar dislikes).
- **Staged diegetic alarm + exfil (Commandos / Shadow Tactics / Desperados III):** a guard
  shouts → suspicion → the level floods; the exfil-under-pressure arc *is* the genre. *Take*
  the staged alarm that reads as fiction; *reject* save-scum puzzle rigidity — our raid is a
  messy morale brawl, not a clockwork puzzle.
- **Grab-and-go + loud-vs-quiet (Payday / Monaco):** stay quiet and take your time, or go
  loud and escalation ramps; grab the loot, reach the van. Loud/quiet == our
  musket-vs-cutlass. *Reject* the hold-out-for-N-waves survival grind (that's attrition).
- **Lineage-adjacent (Pirates! land battle / M&B village raids):** fast readable morale-rout
  fight + "turn out the militia." The gap we fill: those have no objective, no extraction,
  no real asymmetry.
- **RATIFIED — pirate verdict:** objective + extraction (evac-zone), a staged diegetic
  **alarm** (Quiet→Roused→Alarm→Muster) driven by loud actions + escaping runners, **not a
  countdown**; reinforcement waves that push you **out** (never farmable); the garrison
  starts dug-in/dormant so advantage decays raider→defender over time. On-spine: the alarm
  feeds the **will** contest; the objective is taken by breaking local will, not by wiping.
  (See `../decisions.md`, 2026-08-25.)

### Reinforcement / alarm pressure
The raid clock must **read as a cause** (mirror `stepMorale` — deterministic, legible), be
raised by *tactical diegetic events* (gunfire volume, time ashore, seizing, and routed
defenders escaping off-map — the will-spine feeding the clock), and its muster must **close
the window** rather than invite farming. Loud-vs-quiet is where the deploy-screen weapon
loadout cashes out.

### Town / settlement raid layout
How comparable games build a settlement you break into — research inputs only.
- **Diorama stealth-tactics (Shadow Tactics / Desperados III / Commandos):** dense alleys,
  courtyards, rooftops, hand-placed guards, sightlines, high/low ground. *Take:* dispersed guards
  + patrols + sightline-blocking + high/low. *Reject:* vision-cone puzzle-lock + fail-on-detection
  — ours is a morale brawl, not a solvable lock.
- **RTS island defense (Bad North — the design-doc's visual reference):** ultra-readable top-down;
  buildings you defend *and* torch; chokepoints + high ground as the whole vocabulary; "flat maps
  are undefendable." *Take:* the readability bar, buildings-as-torchable, choke/high-ground as the
  primary terrain verbs. Our closest cousin.
- **Campaign-map town raid (Bannerlord / Pirates!):** the militia turns out; street barricades make
  chokes; a watchtower gives early warning. *Take:* reaction-force turnout, authored choke
  barricades, early-warning posts. *Reject:* the abstraction (a menu / open field with no real town
  — the gap we fill).
- **Urban destructible RTS (C&C / Urban Assault):** buildings as hard LOS + movement blockers;
  torch / breach as a verb. *Take:* buildings block LOS + movement (our late stories). *Reject:*
  real-time navmesh rebuild on destruction.
- **RATIFIED — pirate verdict:** a ragged **open Caribbean port** (open waterfront + landward
  palisade/gate + battery), plaza-centred, irregular streets, watchmen-not-army; buildings are
  **game objects** (loot / raze / torch-by-powder), not obstructions; **no fog-of-war, fire-LOS
  only**; a brawl, not a stealth puzzle. (See `../decisions.md`, 2026-08-25.)
- **Forward — a living town, not a grid of boxes** (human steer): grow the building vocabulary
  into a working economy — bakers, grocers, smiths, taverns, loggers, farms/plantations, more
  churches — and loosen the rigid grid toward organic irregularity. Each type is a distinct
  **loot / production source**, tying the town to the plunder layer and the *real* trade economy
  (Port-Royale depth). Layout is hand-authored for now; terrain-driven placement comes later. The
  current small colonial grid is a deliberate first pass, fine for the mechanics exercise.

### Garrison distribution / patrols
- **Sentries at posts** (first contact — spotting you is the rouse), **patrols on waypoint routes**
  (a town that reads as watched, not parked), the **objective guard** at the plaza, and a **reaction
  force** sortieing from the **barracks** at the alarm's origin. Same headcount as one band, spread
  in depth so will breaks in pieces (a sentry runs, a patrol wavers, the plaza guard holds). Ties to
  the alarm already built; achievable with placement + the existing sally-AI — **no new AI system**.
  Later refinement: a **local** rouse (nearby posts wake first) before a global one.

### Boarding · campaign / reputation · trade
- _(Seeded as those features arrive.)_

## Pirate-flavour fit — the taste test
For **ragged, morale-driven privateer bands** (individual-figure RTS on land,
group-command at sea):
- **Fits:** loose formations, initiative, fear & rout, bold gambles, personality
  (named officers), plunder incentives, asymmetric raids.
- **Jars:** rigid parade drill, perfectly uniform ranks, faceless interchangeable
  troops, spreadsheet micromanagement on a timer.
