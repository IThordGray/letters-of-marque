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
- Towns had **persistent size and wealth that changed when you sacked them** — a raid left a mark
  on the town for the rest of the campaign; towns did not reset. **[confirmed 2026-09-07]** This
  matters more than it looks: we had already inherited the *interaction* (loot / raze / fire a
  specific building) **without** ever inheriting its *consequence*. The living-town economy
  (`town-economy.md`) is therefore **restoring a lineage feature, not inventing one** — and
  *Pirates!* reached much the same feeling with about three numbers, which is the argument for
  keeping our first slice small.
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
- **CASHED IN (2026-09-07) — the four-stage placement grammar.** "Forward — a living town" is now
  spec'd in [`town-economy.md`](town-economy.md) §7. A generated port is **not** a general
  procedural city (L-system / Voronoi road generators make plausible cities and *unreadable
  tactical maps* — readability beats authenticity here). Instead: **(1) an authored spine** —
  water → quay → main street → plaza → landward approach, invariant in every port, which *is* the
  readability guarantee; **(2) zone bands** along it (waterfront · lower town · plaza · back town ·
  outworks · beyond the pale), so placement is a lookup rather than a solve; **(3) parcel bearings
  skew it** — industry sits on the town edge *facing the land that justifies it*, and the town
  elongates toward its industry, so a timber town stretches up the creek and a cane town sprawls
  along the flats; **(4) jittered grid fill** now, lane subdivision later — with the plan format
  (`{kind, zone, bearing-hint, footprint}`) locked so either filler consumes it.
  Eight rules keep it readable: the spine is sacred · rank toward the plaza (which hands the raid a
  richer-and-harder gradient for free) · dangerous things away from people (the magazine gets room
  for its set-piece) · defence looks outward (barracks between plaza and gate, so the muster comes
  *down* at you) · trade looks at the water · what stinks or burns goes outside · a full zone grows
  outward (so the difficulty curve generates itself) · validate foot-connectivity from the quay.
  The map is a **pure function of (seed, parcels, works, damage)**, so **razed works come back as
  ruins, not empty grass** — your own arson becomes your cover next time.

### Garrison distribution / patrols
- **Sentries at posts** (first contact — spotting you is the rouse), **patrols on waypoint routes**
  (a town that reads as watched, not parked), the **objective guard** at the plaza, and a **reaction
  force** sortieing from the **barracks** at the alarm's origin. Same headcount as one band, spread
  in depth so will breaks in pieces (a sentry runs, a patrol wavers, the plaza guard holds). Ties to
  the alarm already built; achievable with placement + the existing sally-AI — **no new AI system**.
  Later refinement: a **local** rouse (nearby posts wake first) before a global one.

### Boarding · campaign / reputation · trade
- _(Seeded as those features arrive.)_

### Character progression / skill growth
How comparable games develop people over a career. Research inputs only.

- **Use-based, classless growth (Kenshi):** no levels, no XP pool, no classes; **just
  over 30 skills in seven groups**, each rising only from doing that thing; **NPCs
  level by the same rules as the player**. *Shines:* identity emerges from history,
  not a build screen; zero UI; perfect causality. *Drags:* needs ~30 skills and a
  20-strong squad before characters actually diverge — with a handful of stats
  everyone converges on "good at his job"; and a bare rising number gives no
  *moment*. **ADAPT** — take "you become what you do" as the **routing rule** for XP
  (shots → marks, blows → ferocity, held-under-pressure → nerve); keep thresholds as
  the moment.
- **Difficulty-scaled learning — Kenshi's "Stronger Opponent Logic":** +0.1× XP per
  level you are *below* your opponent (max ×6.0 at 50 below); −0.04× per level above
  (floor ×0.1 at 22.5 above), compared on the *skill actually in play*; then
  multiplied by **(1 − level/101)²**; plus ~+0.1× per enemy outnumbering you (cap
  ~×1.67 at 1v8). *Shines:* kills weak-target grinding outright — ambition becomes
  the training programme. *Drags:* per-swing granularity invites rigged opponents
  (disarm the target and its skill-in-play drops). **ADOPT — already ours.**
  `design-doc.md` §3.3 (`E = clamp(enemy/own, 0.25, 3.0)`; `gain = share ×
  (1-current/100)^1.5`) is the **same two-term shape, independently derived**.
  Kenshi is convergent validation of a decade-tuned curve; the only difference is the
  unit of award — ours is per-*engagement* and therefore unriggable.
- **Toughness from beatings (Kenshi):** damage resistance / wound degeneration / KO
  point (~−65% at 0 → +65% at 100), trained by damage taken relative to current
  Toughness, with the largest single award for **getting back up out of "playing
  dead"** — the get-up is the payday, not the beating. *Shines:* superb fiction —
  veterans are men who broke and came back; defeat becomes progress. *Drags:* it is
  an **attrition** stat, so over a campaign it converts a will game into an HP game;
  and paying for damage *taken* is the documented cause of Kenshi's torture-rig
  metagame. **ADAPT — take the shape, invert the substance:** adversity raises
  resilience of **will**, never of meat.
- **Permanent limb loss + prosthetics (Kenshi):** seven body parts; severance below
  −100% causes instant blood loss plus bleeding that will not stop until bandaged or
  a limb is plugged into the gap; four prosthetic tiers per limb with real penalties
  (the best arm costs stealth; the cheap one costs thievery; nearly all penalise
  swimming); upkeep via repair kits and repair beds; a share of all damage taken
  becomes permanent max-HP loss. *Shines:* the largest generator of unwritten
  character in the game. *Drags:* it is a **maintenance system** (§1.1 forbids the
  category), and because prosthetics carry *bonuses*, players amputate squadmates
  deliberately — the fiction inverts. **ADAPT, heavily trimmed** — a one-time,
  zero-upkeep scar; always a downgrade plus a characterful edge; named officers only;
  no prosthetic economy.
- **Knockout-and-recovery as the default outcome (Kenshi):** vital parts below 0% →
  unconscious, below the KO point → recovery coma; the real killers are blood loss,
  festering wounds, and *who picks you up* (robbed / enslaved / eaten). *Shines:*
  defeat becomes a branch, not a reload. *Drags:* it is exactly what makes deliberate
  self-harm training safe, and therefore optimal. **REJECT for the band** — our
  ratified permadeath is the counterweight that keeps adversity-progression
  exploit-proof. The two rules hold each other up; softening one breaks the other.
- **Flat squad, no officer tier (Kenshi):** every recruit mechanically equal, nothing
  multiplies anything. **REJECT the flatness** — our two-tier model is ratified, and
  the carry-over / presence aura / rally in `game/src/officers.ts` is precisely the
  multiplier Kenshi lacks. **ADOPT two portable habits:** (a) **NPCs grow by the same
  rules** — enemy officers and defected rivals develop between raids, near-zero cost,
  and it fills the "no rivalries" gap flagged in the Rise of Piracy entry above;
  (b) the officer screen shows **what he did**, not only what he is good at.
- **Encumbrance / athletics as trainable body stats (Kenshi):** hauling while heavily
  encumbered trains Strength; running trains Athletics. **REJECT** — generates
  lap-running busywork on the attrition axis. Our laden-raider rule (can't fire, moves
  slower) is already a *tactical* cost; don't turn it into a training track.
- **The Kenshi anti-pattern, in one line:** *it pays for inputs, so players manufacture
  inputs.* Its community optimum is a rigged sparring victim and deliberate
  enslavement. Any growth rule we adopt must pay for **outcomes achieved under
  pressure**, and must be **guessable from the fiction** — Kenshi's real optimum
  ("keep Melee Defence low so it doesn't suppress Attack gains") is invisible in-game.

### Town economy & settlement simulation
How comparable games make a settlement grow, specialise and decay on its own. Research inputs
only — the ratified model is in [`town-economy.md`](town-economy.md) and `../decisions.md`
(2026-09-07). The governing question was *how much simulation buys a living town without
becoming a city builder*, since the player never places a building.

- **Tile-ring city identity (Civilization):** a ring of typed tiles with yields decides what a
  city is good at; **hand-tuned start biases** guarantee signature terrain. *Shines:* identity is
  *geographic* and self-explaining; the biased founding roll is what defeats random mush.
  *Drags:* 20+ tiles makes every city mediocre at everything, and the tile ring is an optimisation
  surface that demands a map UI. **ADAPT** — take terrain-decides-identity and **especially the
  biased founding roll**; reject workable-tile allocation and the food/prod/gold triple. Ours:
  6–9 parcels, one good each, **read-only**.
- **Province slots + faction agenda (Total War):** settlements have N slots unlocked by level; the
  AI fills them by **faction agenda + province specialisation**; growth is a number. *Shines:*
  precisely "development is a chosen *list of works*, not a placed city"; agenda-driven picks are
  legible; slot scarcity forces identity. *Drags:* slots are **placeless** — buildings exist
  nowhere — and player-filled chains become a min-max puzzle. **ADOPT the core** (works ledger +
  budget gate + agenda-weighted autonomous choice); **ADAPT** by giving every work a *place*;
  **REJECT** the player filling slots.
- **County development + assigned steward (Crusader Kings 3):** development 0–100, raised by
  buildings, innovations, a **steward assigned to "develop county"**, and **diffusion from
  developed neighbours**. *Shines:* the cheapest possible model; "assign a character to improve a
  place" *is* our governor; neighbour diffusion creates rich and poor coasts for free. *Drags:* a
  bare number produces no place — **you cannot burn a development point**, which is fatal for a
  building-level plunder layer. **ADAPT** — keep the character-improves-a-place shape, resolve
  "development" into **named works**, and **adopt neighbour diffusion outright** later (a burned
  town dragging its whole coast down is a superb regional consequence for the raze verb).
- **Living markets + build-in-a-town-you-don't-own (Port Royale — the design-doc's named depth
  target, §7.3):** town build slots for production; population grows with jobs + housing; caps
  unlocked by churches; **you can build businesses in towns you don't control**. *Shines:* towns
  visibly differ by what they make; place-specific production; investing in *someone else's* town
  is a real verb. *Drags:* documented player complaint that satisfaction and population growth are
  opaque and fiddly; in-town placement is a chore. **ADAPT** — take **invest-in-a-town-you-don't-
  own** (the canonical fiction for our slider; modelled now, **verb deferred** to a governor
  conversation) and place-specific production; **REJECT** satisfaction management, the housing-cap
  ladder, and player placement.
- **Needs chains (Anno):** residents tier up when needs are met, unlocking new needs and
  workforce. *Shines:* a crisp causal chain, and **unmet need is a perfect reason-string** for an
  autonomous governor. *Drags:* the full chain is a logistics puzzle, the tier ladder a treadmill,
  and consumption bookkeeping is spreadsheet-shaped. **ADAPT** — unmet need as **one scoring term
  and one clause**, ~5 needs, never a bar the player tends.
- **Walkers, desirability, housing evolution (Caesar III / Pharaoh):** walkers from service
  buildings service houses within a short radius of a random path; **desirability** radiates and
  decays with distance; houses **evolve and devolve**. *Shines:* the **devolution ladder** is the
  model for graceful decay — a town reverts a grade at a time rather than dying — and "nasty
  things repel, fine things attract" is an adjacency rule for free. *Drags:* walkers exist to make
  *placement* the game, which we have forbidden, and they cost pathing. **REJECT the walkers**;
  **ADOPT the devolution ladder** (working → idle → decayed → ruin, recoverable at each step);
  **ADAPT desirability into a static nuisance score** in the map generator.
- **Regional specialisation by scarce development points (Manor Lords):** **per-region**
  development points earned on tier-up, spent across Farming / Commerce / Industry / Forestry
  *explicitly to force specialisation*; **regional wealth** kept distinct from the player's purse.
  *Shines:* scarcity-forces-specialisation is our identity requirement already solved, and the
  wealth split is exactly ours. *Drags:* it is a player-spent point pool (i.e. a build screen), and
  the tier ladder is a treadmill. **ADAPT** — scarce per-town capacity as the specialisation
  mechanism, and **town wealth ≠ your gold**; the *governor* spends it, never you.
- **Autonomous citizens + budget levers (Tropico):** the economy runs itself; the player sets
  budgets, wages and edicts. *Shines:* proof that a settlement sim is enjoyable when you **steer
  rather than place** — the single-lever model our investment slider is. *Drags:* per-building
  budget sliders are exactly the audited spreadsheet §1.1 forbids, and it still has placement.
  **ADAPT one slider per haven; REJECT per-building budgets.**
- **Self-organising labour (Banished / Ostriv):** villagers allocate themselves to jobs; the player
  places, the sim staffs. *Shines:* the allocation half is exactly right — you never assign a man
  to a job. *Drags:* both are placement games at heart, and **Banished's unfloored food spiral** is
  precisely our death-spiral failure mode. **ADOPT autonomous labour allocation; REJECT the
  unfloored spiral** — hence our hamlet floor + patron backstop.
- **Population as strata (Songs of Syx):** large-scale population modelled as strata with needs.
  *Shines:* proves population can be a *number with texture* rather than tracked individuals.
  *Drags:* a deep management game whose texture demands constant player servicing. **REJECT as a
  model** — one habit retained: population as a few strata rather than souls, which is also how
  the ratified bonded-labour representation is carried honestly without becoming a resource.
- **Off-screen world-gen history (Dwarf Fortress):** cheap per-site rules run over centuries
  produce populations, resources and histories for places you never visit. *Shines:* enormous
  emergent texture at almost no cost; sites you never visit still have a past. *Drags:* nearly
  illegible without a wiki — the fidelity is invisible. **ADAPT** — run the cheap loop off-screen
  over decades and surface its output as a **short readable town chronicle** ("founded on salt in
  '41 · burned by the Dutch in '58 · rebuilt on timber"). **The chronicle is the payoff.**
- **Towns with a size and wealth you can knock down (Sid Meier's Pirates! — lineage-adjacent):**
  towns grow over the campaign and shrink when sacked. *Shines:* got roughly 80% of the feeling
  this whole feature is chasing with about **three numbers**. *Drags:* far too thin to support
  production chains, occupation, or a generated raid map. **ADOPT as the calibration point** — if
  our version is not more interesting than Pirates!' three numbers, we over-built.
- **The town-sim anti-pattern, in one line:** *every one of these games makes placement the game.*
  We removed placement, so we must not import the machinery that existed to serve it — walkers,
  service radii, desirability grids, job assignment, goods inventories. What survives the removal
  is the ledger, the agenda, and the reason-string.

## Pirate-flavour fit — the taste test
For **ragged, morale-driven privateer bands** (individual-figure RTS on land,
group-command at sea):
- **Fits:** loose formations, initiative, fear & rout, bold gambles, personality
  (named officers), plunder incentives, asymmetric raids.
- **Jars:** rigid parade drill, perfectly uniform ranks, faceless interchangeable
  troops, spreadsheet micromanagement on a timer; progression on the **attrition
  axis**; maintenance systems bolted to characters; training regimes that reward
  deliberate self-harm.
