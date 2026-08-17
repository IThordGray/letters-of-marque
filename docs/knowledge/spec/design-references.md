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

### Boarding / raiding · campaign / reputation · trade
- _(Seeded as those features arrive.)_

## Pirate-flavour fit — the taste test
For **ragged, morale-driven privateer bands** (individual-figure RTS on land,
group-command at sea):
- **Fits:** loose formations, initiative, fear & rout, bold gambles, personality
  (named officers), plunder incentives, asymmetric raids.
- **Jars:** rigid parade drill, perfectly uniform ranks, faceless interchangeable
  troops, spreadsheet micromanagement on a timer.
