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
- _(Add confirmed mechanics and feel here as we go.)_

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

### Boarding / raiding · campaign / reputation · trade
- _(Seeded as those features arrive.)_

## Pirate-flavour fit — the taste test
For **ragged, morale-driven privateer bands** (individual-figure RTS on land,
group-command at sea):
- **Fits:** loose formations, initiative, fear & rout, bold gambles, personality
  (named officers), plunder incentives, asymmetric raids.
- **Jars:** rigid parade drill, perfectly uniform ranks, faceless interchangeable
  troops, spreadsheet micromanagement on a timer.
