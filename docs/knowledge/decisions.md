# Decisions

**Scope:** cross-cutting · **Authority:** human edits win.

The **current** ratified decisions — nothing superseded, no history. One line each; detail lives
in the spec file named. When a decision changes, **edit its line in place** — do not append a new
entry. Rationale for anything here is in git history (`git log -p docs/knowledge/decisions.md`,
or the dated log before commit *"decisions: current state only"*).

Precedence: **the human > the spec (`design-doc.md`, `spec/`) > the code.** Where code and spec
disagree, the code is wrong.

---

## Pillars (never relitigate — `design-doc.md` §1)

- **One spine: win by breaking WILL, not attrition** — musketeer → ship striking colours → town
  paying tribute → nation deciding you are not worth the blood.
- **Land-outward.** Land is the core of decision-making; officers carry skills to sea. A lens, not
  a dev order.
- **Officers are the connective tissue** — rolled stats, buff their men, travel land ↔ sea.
- **No timer-driven decisions, nothing to audit** (§1.1). Management is batched, in-port, optional,
  delegated. §1.1 bans recurring *decisions* on a timer — not durations (build time, repair time)
  and not real-time tension inside a fight (reload, alarm, morale).
- **Naval:** command groups (2–5 groups of 1–4 ships); captains interpret orders deterministically;
  group speed = slowest ship.
- **Land:** direct RTS control of individual figures; will is the win condition (rout, not
  annihilation). Never cross the naval interpretation layer into land.
- **Strategic:** havens pillage / raze / occupy; pirate, not emperor; real trade economy delivered
  by delegation; fame/infamy is the will-spine at map scale; campaign arc is legacy & retirement.
- **Sandbox, not city builder, not narrated story.** Period is flavour, never a veto.

## Current milestone — the antfarm (`world-simulation.md`)

- **Test:** the human can watch the world run for an hour and follow what happens without being
  told. **Watchable is the bar, not balanced.** "Not perfectly balanced" is permission to stop tuning.
- **Cause must be visible:** a consequence that cannot be traced to its cause has not happened.
- **The list is closed.** Remaining: *a town fails out loud rather than silently* · *damage is a
  degree, repair comes off the top, building takes time* · *nations act, and say why*. Anything
  found along the way is written under **Deferred**, never added.
- **Out of this milestone:** the player, port, raiding, officers, sailing model, continuous zoom
  to the town view. The world view is a developer instrument; player-UI limits do not apply to it.

## World (`world-simulation.md`)

- ~50 places, procedurally generated every game; five configured crowns; generator decides who
  holds what on day 0. Real ports (Havana, Port Royal, Tortuga) are heritage references, not map
  content.
- **Warm start:** generate around 1580, run the real sim forward to day 0, found places in waves so
  ages differ. No second way to build a town.
- One clock, one random stream, derived from one seed. **Reproducible means the whole history**, at
  any speed. Two beats: days (weather, travel), seasons (economies, governors, nations).
  360-day year, four 90-day seasons (`[HC-3]`).
- Every place runs the full ledger, always.
- **Neutral set fixed at generation and can only shrink.** Neutrals have no expansion agenda. A
  neutral gets no support dispatch but **can be invaded** — so a crown can come for the player's
  haven (`[HC-51a]`).
- **Ships, three rings:** near = real objects · middle = exist and hold a course · far = trade is a
  flow. **A ring is a rendering boundary, never a simulation boundary.** The four war-currencies
  (treasury, reinforcements, charter, invasion force) are permanent objects in every ring — the only
  goods physically shipped between AI towns.
- Charter is automatic at a threshold; intercepting it is the only way to stop a promotion.
  Cities are designated at world generation and never demoted; class is emergent below city.
- **Weather:** severity is a continuous, moving value read at the place and moment of contact.
  Common storms cheap, bad ones rare. A catastrophic storm can destroy a single work. Climate is
  fixed at generation.
- **access = reach × readiness.** "Who is near enough" has exactly one definition (the market
  neighbourhood).
- **Coin must be conserved in trade** (`[HC-47]`) — a seller earns what buyers paid. Cannot ship
  before the crowns' tax-up / grants-down circulation (with *nations act*), or every town dies.

## Towns (`town-economy.md`)

- **The ledger is the simulation; the map is a projection.** Three stored numbers (population,
  wealth, prosperity) plus a list of works; everything else derived. No walkers, no per-building
  worker sim. No number without a sentence about a place.
- **A town gets by.** Its own trade turns a very small profit, reinvested slowly. Fast growth is
  somebody's decision (a patron's money). No day-0 size target.
- **Tiles are a trade layer only.** A work standing on a tile produces **cargo and nothing else**.
  Every town's running (food, materials) is a flat, uniform base the ground never touches. A tile
  multiplies what a town already has; it does not grant access.
- Food that feeds a town comes from garden plots, fishing shacks and bought victuals. **A work that
  feeds a town must pay its own wages** (feeds more souls than it takes to man), and a test says so.
- **No materials build-gate.** Building is capped by coin, the menu's per-town limit and a region's
  free area.
- **Upkeep stays — it is taxes.** Saving is meant to be hard. **A town's purse is plunder:** a
  growing purse is a target ripening, not an inflation bug. Buying must not destroy coin.
- **Three import classes:** victuals · materials · luxury. Munitions cut. Luxury is trade cargo,
  not the default raid payout.
- **Region focus:** a region has a potential (its ground, unburnable); the governor chooses a
  **permanent** focus — production or growth. Goods survive; production chains do not (no
  timber → planks → shipway).
- A per-town limit may not stand in front of a per-region rule. A focus expression has no `max`.
- **Don't offer a decision whose only consequence is unimplementable.** "Best-borne produce" means
  the best the catalogue can express.
- **A free work may hold a capacity, never a wage.** The quayside cut is a share of real traffic.
- **Damage has a cause, never a clock.** No rot, no decay ladder. Idle = under-manned (free, instant
  both ways) · damaged = a degree, from a named event, mended with coin, automatically, off the top
  · destroyed = everything gone, ruin stays on the map. Repair time ∝ what is missing × the work's
  build time; construction takes time too. Constants deliberately unfixed.
- **Only a deliberate hand empties a town** (razed to nothing, by player or war). The hamlet floor
  requires survivors. *Ruined* is a description of a town on its floor, not a state.
- Storm maintenance is priced against the town's works, never its treasury. Subsistence hands scale
  `× min(suit, 1)`.
- **Governor:** five-term auction with a published wants-list; wealth is the budget gate, not a
  term. **No term without a clause** — the explanation is the score. Inspectable, not controllable.
- **Land:** regions, not parcels; the land is a partition; one hex = one work's ground; terrain
  biases (graded suitability), it does not determine; sited works keep hard ground requirements.
  What the land *is* is fixed at founding; how much is left is not.
- **The hex map is a zoning overview, not a scale map.** The ledger gives the scale, the plan gives
  the form. Works group per (region, kind) as one installation sized by count. Building a work
  must visibly change the ground.
- **Footprint:** a claimed hex set; absorbed ground is permanent; the footprint never retreats.
  Walls shape growth, never stop it; a wall is the frozen boundary at the moment it was raised.
  Growth eats its own cause. Never store a bearing; derive it.
- **Player surface is the town menu** (docks, trade, governor — deferred). No investment slider.
  Levers when it lands: one focus (guns **or** coin **or** hands), grant the ground (own haven
  only, once per hex, irreversible), bribery (buy a named man, lapses silently), paid-for view of
  a foreign town's land. **You may choose what land is FOR, never where a building STANDS.**
- Enslaved / bonded labour represented honestly and minimally; freeing them is a raid outcome;
  never a manageable resource or tradable commodity.
- Defence ladder is `picket · garrison · fortress`, independent of size class
  `settlement · town · city` (`[HC-60]`). A haven's purpose is `trade` — for now (`[HC-56]`).

**Do not build:** player building placement · worker or job assignment · per-building inspection
UI · walkers, service radii, desirability grids · a happiness meter · an in-town goods inventory ·
any scheduled prompt · an optimal layout to discover · a numbers-only town screen · more than ~5
surfaced numbers per town · a price table to arbitrage · a third dependency edge.

## Raid & land combat (`design-doc.md`, `spec/design-references.md`)

- Land combat is the ported, playtested will-spine sim (fire, melee, per-figure morale, flanking,
  rout, contagion, officer presence, rally). Seeded PRNG; deterministic morale.
- **Contextual command:** right-click resolves — one valid action runs, two or more open a menu;
  verb key + click bypasses. Same everywhere. Three postures (At 'em / Hold fast / Hold fire) + Halt.
- **A raid is open-ended plunder:** haul banked vs cost paid, graded outcome, no single win flag.
  Fixed objectives are one scenario type.
- **Alarm, never a countdown:** Quiet → Roused → Alarm → General Muster, raised by actions (not
  headcount). Extraction is the beach you landed on; withdrawing is always available.
- The raid ground is an open Caribbean port; buildings are game objects. No fog of war.
  Distributed garrison. Garrison strength follows the defence ladder; player crew seasoned, not
  veteran.
- **Plunder:** loot is carried loads banked at the boats; a laden figure can't fire. Destroy = fire,
  paid in powder, loses the contents and hurts the town. Loot takes wealth; raze removes the work.
  Prisoners: broken and cornered figures can yield; resolved at battle end (join / ransom / release).
- **Deploy & equip:** no party-size cap; per-unit ammo; permadeath; unnamed crew pool + named
  officers; outfitting is a one-time decision per expedition.
- Prototype perks/fatigue rejected as implemented. Earned thresholds still open; talents parked.

## Look (`design-doc.md` §5)

- **Stylised 3D, sunlit and saturated** (references: *Sid Meier's Pirates!*, *Rise of Piracy*).
  Lightweight and fast, not AAA. Sea stylised, never simulated.
- The cartographic chart owns the zoom ceiling and strategic map — **for now**, the human's words.
- Sun elevation ≥ ~25° over built-up scenes · no skybox · toy scale is a hard constraint · foam in
  terrain vertex colours · land-only shadows.
- **No renderer is chosen.** A ratified look is not permission to make assets.

## Build & tooling (`implementation/`)

- TypeScript + Vite; data-oriented (plain structs, flat arrays, pure systems). No engine, no ECS
  framework. Earlier C#/Godot build set aside — don't re-propose an engine unless asked.
- Throwaway prototypes stay throwaway; `game/` is durable and tested (Vitest — `testing.md`).
- **A test pins only behaviour the spec ratifies**, not behaviour that happens to exist.
- **Content lives in data; no mod machinery.** Behaviour stays in code. Generate type unions from
  the data. Nothing implemented yet.
- Knowledge base splits WHAT (`spec/`) from HOW (`implementation/`).

## Working rules

- **Report the criterion that fails; never tune until it passes.** A criterion that cannot be met
  is a question for the human.
- **When a target survives three attempts, question the target**, not the next lever.
- **When a story changes what a quantity is made of, keep the world aggregate roughly where it was
  and report the residual** — a mechanism change must not turn into a balance change.
- **A finding is not a scope extension.** It goes under Deferred, or nowhere.
- **When a story removes the only producer of something, check what still produces it.**

## Open — needs the human

- Whether a plain town with no harbour work can ever fund a building from its own trade (expected
  answer: crown grants, with *nations act*).
- §2.12.4's token cap for unfocused regions now has no producer: retire it or give it one.
- Walls were to ruin via the decay ladder, which no longer exists: how does an outgrown wall end?
- Whether a *developed* haven is harder to take than one merely held, and whether a crown can be
  made to give up short of beating it.
- The camera floor (§5.3): the look spike says close range reads as boxes.
- Whether a saturated sea leaves enough value range for tactical annotation (§5.2) — untested.

## Deferred (not cancelled)

- Town menu and every player-facing tie-in · town card and chronicle depth · 20-year fast-forward.
- A pass over every terrain kind the generator paints and what each is for (rocky, salt and
  cotton ground are currently inert).
- Governor weights and placement tuning.
- A food work's margin is checked against prosperity but not against weather.
- Elliptical islands (isolated lobes render as smooth ovals) — no 3D island renderer exists.
- Tile levels / upgrades · grouping in-town works · plan extent keyed on town size.
- The three-ring ship model and interception (need a player).
- The raid layer (`ai`, `combat`, `morale`, `movement`, `nav`, `patrol`, `raid`, `spawn`) has no test
  suite, and `guardrails.test.ts` does not scan it or `worldview/`.
