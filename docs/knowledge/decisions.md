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
- **A new good must name a port that could not otherwise exist.** Not a flavour we lack, not a
  period good we noticed. This is what holds the list at a dozen rather than letting goods accrete.
- Defence ladder is `picket · garrison · fortress`, independent of size class
  `settlement · town · city` (`[HC-60]`). A haven's purpose is `trade` — for now (`[HC-56]`).

**Do not build:** player building placement · worker or job assignment · per-building inspection
UI · walkers, service radii, desirability grids · a happiness meter · ~~an in-town goods inventory~~ (**superseded 2026-09-28** — the ratified
goods model is `demand = target − stock`, which requires a stock; what survives is the ban on a
PRICE TABLE to arbitrage and on surfacing more than ~5 numbers) ·
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
- **Art reference:** [`../art-reference/`](../art-reference/README.md) — exploration, **not ratified**.
  The human likes its world and colour scheme; nothing in it (detail level, sails, HUD) is decided.

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
- Faction colour: §5.2 puts it on the sails; the art reference keeps sails cream and puts it on
  flags. Undecided — parked for the audit.
- Detail level: §5.1 says low-poly with visible facets; the art reference is stylised
  semi-realism with textures. Undecided — parked for the audit.

## The world's settings (`spec/world-loop.md`)

- **The sea's size and population are asked for, not baked in.** The default 1,500 x 800 nm sea of
  50 ports is the calibration reference every measurement in the project stands on — changing it
  means re-measuring everything.
- **Four physical facts bound any request** and a world that breaks one is refused at generation: a
  day's run is 144 nm, **a market reaches 1,008 (a week's run)**, ports keep 85 apart, a crossing
  must fit 9,216. **Two more refusals are about the cast, not the physics:** more crowns than the
  table holds, and more crowns than there are ports to seat them.
- **Below about 1,000 nm across, trade geography stops existing** — one market holds the whole sea.
  The default 1,500 × 800 sits just above that, which is why a week and not a fortnight.
- **Crowns is a setting, 0–5, and zero is a real world** — unaffiliated towns, no seat, no grant,
  nothing dispatched. It sets the number of cities too, so a crownless sea has no great port.
  **The five crown identities stay in the cast list; what a crownless world has none of is seats,
  holdings and grants.** Filtering them out would silently re-index every place's faction.
- **The viewer remembers its settings in `localStorage["lom.world"]`**, written only once a world has
  built. The only persistence in the project, and deliberately not a save system.

## Trade & the sea (`spec/world-loop.md`, `spec/world-simulation.md` §11)

- **A sea lane is the sea; a trade partnership is a subset of it.** Any two ports are connected
  because a ship can sail between them — not owned, not closeable by interception. **A ship sails
  anywhere the schedule can hold; only buying and selling follows the partnership.** This is where
  every future *"can X reach Y"* question goes: an invasion force, a crown's coin and a player's hull
  follow the water.
- **A reach is not a rule about who trades — the PICK is.** Widening reach from two days to a week
  while still taking the nearest seven moved the mean partner 171 → 183 nm and put **nothing** beyond
  three days' sail. With a near-to-far spread over the same list: mean 474 nm, 61% of partnerships
  cross a climate band against 23%, and two ports on the same coast share 20% of their partners
  rather than 72%. **Any "widen the window" change whose selector is *take the first N* is a no-op.**
- **Neighbourhood membership is ASYMMETRIC and the clearing is safe under it** — a place puts
  `1/hoodsOf` of both its offer and its want into each market it belongs to, so its books balance
  whatever anyone else picked. Measured, not argued. **Do not "fix" the asymmetry.**

## The economy's next shape — ratified 2026-09-28, NOT YET BUILT

The direction below supersedes parts of `world-simulation.md` §11 and `town-economy.md`. Those files
still describe the three-class engine; **where they disagree with this section, this section wins**
and they are rewritten when it is built.

- **Goods all the way down.** Named goods with a price and a demand each, not three abstract classes.
  The classes survive only as the **tier** a good belongs to, which keeps the pyramid gate and
  *bread before batteries* working. Cutthroats' list is the starting point.
- **No production chains, and a goods list is where they creep back.** A good comes **off the ground**
  or **arrives by sea**. Nothing converts one good into another.
- **Three source kinds:** a hex the town holds · a property of the town (gunpowder in larger cities,
  needing no land) · only ever by sea. **Not every good has a hex.** Which is which is a table.
- **Towns are self-sufficient and can never starve.** A town holds a **target level** of each good,
  scaled to size; **demand is simply the gap.** Nothing is consumed for survival, and **falling short
  costs nothing** — rob a town of all its grain and it just wants grain again.
- **A small seasonal drain is load-bearing, not polish.** Production adds and nothing removes, so
  without it every warehouse fills, demand goes to zero and trade stops.
- **A building may serve two unrelated purposes.** A farm makes **grain** (a commodity) *and* supplies
  **growth** (what sets population); those never touch. A coffee plantation makes only a commodity.
  **Burn the farm and the town slowly shrinks; burn the coffee and it merely has nothing to sell.**
- **Population comes from an abstract growth input, never from food stock.** This retires
  `[HC-87]`'s trade-fed ceiling: a great port is no longer great because it is fed from the sea.
  A raid still shrinks a town, by the longer road — it takes coin and breaks the works that supply
  growth.

### Built 2026-09-28 — the market trades named goods

Eleven goods ship: **grain · fish · salt** (victuals) · **timber · stone · gunpowder** (materials) ·
**sugar · tobacco · cotton · cacao · rum** (luxury). Rum and gunpowder are properties of the town.
**Spice and ironware wait for the off-map inflow** — see the source rule below.

- **The gate reads the TIER while the clearing reads the GOODS**, and that is a ruling rather than a
  shortcut. Asked per good, a port whose neighbourhood happens to have no salt would be "short of
  victuals" for ever and would register **no demand for materials or luxury anywhere**, however much
  bread it had. A place with corn in its barns is fed.
- **Ship no good without a source — and a hex bearing it is not a source, a WORK is.** Stone, salt,
  tobacco and cacao each needed a catalogue row before the ground they sit on meant anything.
  **A source with no scarcity never trades:** every town over 200 souls makes more gunpowder than its
  own works want, so none ever changes hands and its price is par everywhere.
- **A town eats what it grows before it buys anything.** Netting each good against its own appetite
  was built and measured first: it has a town selling corn while buying fish, put **23% more cargo**
  across the world's beaches for no new production, and crossed *"a town gets by"* at the median.
  A tier in surplus ships the residual; a tier in deficit buys the gap.
- **Splitting a tier's demand across its goods dilutes what any one of them argues for.** A building's
  bill was wholly timber demand and is now half of it, so sawpits fell 96 → 66 and the timber
  covering's bound had to move. **General shape: every good added to a tier weakens the ones already
  in it, and any worldgen guarantee keyed to a single good gets weaker each time.**

**Known and accepted:** a day-0 world trades nothing until governors build — every place is fed by
the subsistence floor and nobody is short of what anybody has. Fish is capped at 66 a town by the
three-shack limit, so large ports are permanently short of it.

### Built 2026-09-29 — a town holds a warehouse

Stock per good carries across seasons; **demand is the gap to a target that scales with size**, and
falling short costs nothing at all. A hamlet wants three goods and no luxuries; a port of 185 wants
eleven and five.

- **The target and the drain are ONE number.** `target = appetite × storesSeasons`, `drain =
  1 / storesSeasons` — so a town at its target loses exactly the appetite it always had, and adding
  the warehouse rescaled no tier's flow. **Tuning either half alone starves the world or stops it
  buying.**
- **A fixture meant to SELL must be given stores.** A freshly built town has bare shelves and nothing
  spare however good its ground. Standing rule for every future test.
- **Stock is legitimately stored** — cacao in a town that grows none is the residue of past
  clearings and no function of the ledger could recompute it. This supersedes §3.5.3's *"a town
  tracks a flow balance, never a stock"* and `world-simulation.md` §202's note that nothing holds
  stock.

**GROWTH IS NOW BLOCKING, not a later topic.** Population reads only what a town's own works feed,
and the catalogue caps that at **186 souls** — four garden plots and three fishing shacks, the only
rows carrying a `food` column. Every large town in the world plateaus there. Three consequences,
all one cause:

- The largest port fell 495 → 185; dozens of ports sit within a soul of each other.
- **Gunpowder and rum have no producer anywhere** — towns make them above 200 souls and nothing
  reaches 200. Two of eleven goods are dead, which breaks *ship no good without a source*.
- **"A town gets by" is breached** — a decade's saving went 13 → 236 coin against a 180-coin work,
  because the great ports stopped buying a third to two thirds of their bread.

**Part of the fix is already ratified and simply not built:** the human's own sentence is that a farm
*"could boost the commodity, and count as food towards pop growth"*. Provision grounds and grain
fields today carry a commodity column and **zero** food.

### Built 2026-09-29 (second) — a cleared trade is a ship

The market names **who supplied whom**; one hull per trading pair carries everything that pair moved;
**the buyer is credited when it lands.** Interception is still empty — but there is now something to
rob, which there was not before.

- **A season spends what the PREVIOUS season delivered.** Clearing books nothing, hulls fill the quay
  over the following days, and settling ninety days later spends it. **Anyone reading the season's
  five phases will assume phase 2 feeds phase 3 on the same day. It no longer does.**
- **A cargo is at sea for up to a FORTNIGHT, not a week.** Reach bounds a port's distance from its
  market's *centre*, so two members can be twice that apart. **This is the number the interception
  work is written against.**
- **The 8-member cap is what makes naming a counterparty affordable** — the pairing costs
  `members²` per good per market, 8×8 rather than 48×48. **Widening `MARKET.maxMembers` now costs
  the square of the widening**, which it never used to.
- **The seller is paid when he ships, the buyer when it lands.** So a taken hull costs the buyer
  everything and the seller nothing. Deliberate for now; a decision when interception lands.
- **Measured:** ~300 sailings a season, peak ~226 hulls on clearing day, the sea empty on 81 of 90
  days. Warm start **+4–6%**. World cargo bought at a settling roughly doubled.

**Standing test rule, earned twice:** **read a season's trade while the season is still holding it.**
Settling zeroes the quay, so a claim that reads a town's trade block *after* `settleSeason` reads a
zero and passes against anything. Two existing claims were doing exactly that and were decoration.

## The layering — how the world is meant to stack

Each layer runs without the one above it, and adding a layer never rewrites the one below.

1. **The world.** A sea of a chosen size, coastlines, climate, weather. Watchable as nature alone.
2. **Towns, unaffiliated.** People settle where the ground suits them and sustain themselves.
3. **Town intelligence.** The governor decides: what to build, what to trade, whom with.
4. **Nations.** An identity over towns that **adds weight to the town's existing decision**, rather
   than deciding separately. **Same hook the player later uses to bribe or install a governor** — one
   decision mechanism, more terms in it. Crowns push coin, troops, governors and invasions along the
   sea, which reaches any port whether or not the two trade.

**Worldgen settings:** size and population exist; **year, season and number of crowns (0–5) do not
yet.**

## Deferred (not cancelled)

- Town menu and every player-facing tie-in · town card and chronicle depth · 20-year fast-forward.
- A pass over every terrain kind the generator paints and what each is for (rocky, salt and
  cotton ground are currently inert).
- Governor weights and placement tuning.
- A food work's margin is checked against prosperity but not against weather.
- Elliptical islands (isolated lobes render as smooth ovals) — no 3D island renderer exists.
- Tile levels / upgrades · grouping in-town works · plan extent keyed on town size.
- The three-ring ship model and interception (need a player).
- Nothing would catch a leak in the clearing: the conservation claim caps allotment by *want*, not by pooled supply, so a future change to the `1/hoodsOf` share would fail no test.
- **Nothing executes `worldview/main.ts` or `town/main.ts`.** No test may (DOM tests are banned) and `tsc` does not order module-level initialisers, so a change there can be type-clean and green across every claim and still throw before the page draws. It has done exactly that once.
- A `describe` body in `market.test.ts` runs a two-year warm start at *collection* time, so it is paid even by a filtered `-t` run.
- `sendCargo` returning `null` (a passage past the 64-day ring) would silently evaporate a matched cargo, crediting nobody. Unreachable inside a market — ~2,016 nm against a 9,216 nm horizon — but unguarded.
- The raid layer (`ai`, `combat`, `morale`, `movement`, `nav`, `patrol`, `raid`, `spawn`) has no test
  suite, and `guardrails.test.ts` does not scan it or `worldview/`.
