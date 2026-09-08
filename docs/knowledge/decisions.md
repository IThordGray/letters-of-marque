# Decisions Log

**Scope:** cross-cutting · **Authority:** human edits win · **Newest at top.**

Ratified decisions and their rationale — the manager's capture log. Game-mechanics
detail lives in `../design-doc.md`; this log records *what was decided and why* so
nobody relitigates it. Entry format: **date — decision.** Then *why*.

To add an entry: newest at top, keep it short, state the rationale. Human edits win.

---

### 2026-09-08 — The land map: the hex ring is the wants-list drawn on the ground
A hex-tile view of a town's land, a way to lean a town's development, and the first real
placement verb — in your own haven only (shaped with the game-designer; four calls answered by
the human). The whole evolution hangs on one sentence:

> **The hex map is the wants-list drawn on the ground.**

Nothing new is simulated. `wants()` already returns `{label, reason, where}` with `where` a
bearing; the hex map is that list with `where` made literal. **One new renderer, no second
economy.**

- **One hex = one parcel. The map RENDERS the ring at the same grain; it never subdivides it.**
  This is the anti-dilution guarantee. It also settles the earlier objection to a Civ grid, which
  was **half right**: "many tiles average out" is real but is a property of *grain*, not hexes —
  our biased founding roll already defeats it. The other half conflated *a map* with a **writable**
  map. Civ VI district adjacency is a solved puzzle *because you place districts*; Victoria 3 has a
  far richer state map, no placement, and its map is a readout. **A map the player cannot write to
  is a diagram.**
- **Draw 19, simulate 7.** The **centre hex is the town itself** (load-bearing: one centre hex =
  one raid map). The **inner ring of 6 is the parcel ring**, unchanged in meaning. The **outer 12
  are hinterland** — drawn, no data beyond `sea | land`, there to make the map read as *country*
  and to hold the deferred tail (roads, neighbours, annexation, where reinforcements come from).
- **A hex has no output. It has CAPACITY.** Output belongs to works: a hex's contribution is
  exactly the sum of the works standing on it, computed nowhere else. Any number written on a hex
  that is not that sum is the second economy, and is forbidden.
- **Bearings 8 → 6, and parcels fix at exactly 6.** Flat-top hexes give N · NE · SE · S · SW · NW —
  dropping E and W while **keeping N and S, so the ratified "the sea lies south" invariant
  survives** (pointy-top would have broken it). The variety the old 6–9 count supplied now comes
  from **dead hexes** — `marsh`, `scrub`, `openSea`: drawn, terrain-typed, yielding nothing. This is
  an upgrade, not a compromise: a town with three dead hexes has a **visible** ceiling ("poor ground
  on three sides") where a parcel count was invisible. `marsh` pays twice — economically dead,
  defensively a gift (no palisade that side, slow going for a raider).
- **Governing principle: thematic steer everywhere; spatial steer only where you own the ground.**
  Leaning a town is a *thematic* choice (guns / coin / hands) that **renders as a spatial growth
  front for free**, because every work already sits on a parcel with a bearing. The player never
  points at a hex in a town he does not own, yet the town visibly grows a direction.
- **The lever set is guns · coin · hands, because they are the three yield columns on a `WorkDef`**
  (`trade` · `food`/`serves` · `defence`). `hands` on a work is the **cost**, not a lever; a fourth
  lever would require inventing a fourth thing a work can produce. That is a structural bound, not
  a taste call.
- **Production focus names a PRODUCTION LINE by its output** — *the cane · the timber · the wharf ·
  the fields* — never a building, one at a time. **The land refuses what it cannot bear** ("there is
  no ground for cane here"), which is what keeps focus from degenerating into a build menu.
- **Steer and bribery live INSIDE the existing agenda term. Still five terms**; the louder voice
  writes the clause (*"you have asked for guns above all"* · *"the Company wants a return on this
  place"* — an owner outvoting you is legible failure — · *"the contador has been paid to see rum
  out of here"*). Three guards keep a steer from being a command: you bias a **category**, never a
  work or a hex; **the land still refuses**; and the steer **can be outvoted** (a fresh sacking puts
  guns up whatever you asked for). The labour gate still bites on top.
- **Bribery: you buy a NAMED MAN, not an outcome.** Four rungs — **clerk/harbourmaster**
  (information) · **contador/factor** (a production line, for a term) · **alcalde/captain of the
  watch** (the guns lever run **downward**) · **the governor himself** (licence or standing
  patronage — **relationship only; coin alone is refused, insultingly**). It lapses on the
  **official's tenure** (men rotate, die, are promoted) and **suspicion** climbs per town; **one
  standing arrangement per town**. *Coin buys breadth; relationship buys depth.* **Arrangements
  lapse SILENTLY** — discovered on inspection or when word reaches you, **never a notification**
  (a bribe with an expiry wants to become a scheduled prompt, and §1.1 forbids exactly that).
  It can go wrong in ways beyond losing the coin: he takes it and does nothing; he is discovered
  (standing falls, the `order` need spikes, **and the governor raises the guard on his own — a
  failed bribe makes the target harder**); later, he informs on you, or a rival outbids you.
- **Hexes → the ground: the CENTRE HEX IS THE TOWN**, and the ratified four-stage grammar is what
  happens inside it; the ring hexes become the raid map's **edges**. **No hex is ever visible in a
  raid** — hexes are units of land tenure, not blocks (Endless Legend's hex-quilt cities, inverted).
  **The hex map is UPSTREAM of the generator, never downstream:** every raid-map fact must be
  inferable from the hex map, and no hex may be inferred from the ground. The generator gains
  nothing new — it already takes which bearings are water, which bearing each work sits on, and
  which ground is slow. **Five fidelity contracts:** bearing · sea-arc · **count** (*"sawpits ×3"*
  means three sawpits on the ground) · size · scar. The acceptance test: **a player can name the
  town's approach from the hex map before he lands**, and find it true.

**The human's four calls (2026-09-08):**
- **ONE FOCUS, not three levers.** A town is leaned one way at a time — *guns* **or** *coin* **or**
  *hands* — not an ordered list and not three sliders. (The designer proposed a priority order; the
  human chose the sharper form. Simplest to read, simplest to explain, and it cannot be gamed by
  maxing.) The **investment slider (how much) stays separate and unchanged**; the focus is *which
  way*. So the whole management surface for a town is **two standing commitments**, plus an optional
  named production line.
- **GRANT THE GROUND is ratified.** In a haven you own, each of the 6 ring hexes may be granted
  **once** to a vocation the land can bear ("the north hills — timber"); **irreversible without
  razing what stands on it**. The governor still chooses the actual works, still writes his reasons,
  still refuses for want of hands. Grants live on the `Town`, not the `Parcel`, so **"parcels are
  immutable after founding" survives verbatim**.
- **The guns lever RUNS DOWNWARD.** You may pay an alcalde for neglect — the battery unmaintained,
  the watch thin on a night you name. This wires the economy straight into the raid layer and is
  squarely on the will-spine: **you break a town before you land on it.**
- **Seeing a foreign town's land is PAID FOR.** An unbought town shows prose only; buying the clerk
  reveals its hex map and ledger. Kills omniscience about another crown's colony and makes the UI
  itself a reward rather than a given. *(The standalone harness needs a dev toggle so the map stays
  demoable before a conversation layer exists.)*

**Amendments to ratified text — write these explicitly:**
- Parcels **6–9 → exactly 6**, on a flat-top hex ring, plus a 12-hex hinterland ring; variety from
  **dead hexes**, not from count.
- `Bearing` **8 → 6** (N · NE · SE · S · SW · NW). The sea-is-south invariant survives.
- **The read-only parcel map is HEREBY REOPENED**, per the clause that reserved it ("possibly
  steerable later… not without explicitly reopening the decision"). Three states: **read-only**
  (foreign, unbought) · **steerable** (a bought arrangement, or your own governor) · **grantable**
  (a haven you own).
- **"Model the hook, don't ship the verb"** for investing in a town you don't control → the verb's
  shape is now designed; the **model** ships and the four-rung ladder is deferred until there is a
  conversation layer, fame, and officer relationships. **"Through a conversation with a governor,
  not a menu" STANDS VERBATIM.**
- §7.1's **four development slots → one focus** (guns/coin/hands) + an optional named line. The four
  survive as *examples of what each focus produces in a haven*. The sentence "a few set-and-forget
  slots, never a city builder" is unchanged and, with one focus, **more** true.
- Do-not-build **"an optimal layout to discover"** → narrowed. New test: **you may choose what a
  piece of land is FOR; you may never choose where a building STANDS.** The plan-archetype
  prohibition is **kept verbatim**. Safe because a grant has no spatial degrees of freedom — the hex
  is where the hex is, terrain decides the shortlist, there is nothing to pack and no adjacency to
  farm. It adds **choice** without adding **solution space**.
- Do-not-build **"~5 surfaced values per town"** → **"~5 surfaced NUMBERS per town; the land and the
  ledger are DRAWN, not counted."** Hexes show grades and words on the face; a number appears only
  on hover, and only with its sentence.
- **`marsh`/`mangrove` pulled forward** from the deferred parcel list — the hex map needs dead
  ground, and marsh does defensive work too.

**Explicitly HELD, unamended:** no player building placement (a grant is not placement) · **no
worker or job assignment, ever** — the levers bias what is *built*; `allocateLabour` stays fully
autonomous, and this is the Civ trap · no scheduled prompt · no numbers-only town screen · §1.1 ·
the four-stage placement grammar and its eight adjacency rules (extended, not changed) · the
five-term auction and "no term without a clause" · the derived-`SettlementTier` deferral.

*Why:* the land is the town's character sheet, so the player should be able to *see* it — and a map
he cannot write to costs nothing in optimisation pressure while paying for itself in legibility.
Victoria 3 is the closest living model to ours and its documented failure is **opacity** (players
cannot tell why autonomous investors built what they built); our "no term without a clause" rule is
precisely that fix and is our biggest edge over the nearest existing thing. Full spec:
[spec/town-economy.md](spec/town-economy.md); comparables in
[spec/design-references.md](spec/design-references.md).

---

### 2026-09-07 — The durable build gets a real test suite (Vitest); prototypes keep throwaway smokes
`coding-rules.md` was scoped to the **prototypes** only, so `game/` had no testing convention —
a gap found while building KAN-68. Settled: the durable build's **pure systems are pinned by a
kept suite**, because in `game/` the sim *is* the product.
- **Vitest**, because it is Vite-native — it shares the app's own module resolution, so TS and
  extensionless imports work with no bundling step and no duplicated config. One devDependency.
  `npm test` / `npm run test:watch`. Tests sit **co-located** (`sim.ts` → `sim.test.ts`).
- **Pure systems only.** Never rendering, canvas, DOM, input, camera or the loop. A bug you can
  only see on screen is found by playtesting, not by the suite.
- **Rule 1 — a test name is a design claim, not a function name.** The suite should read like the
  design doc (*"crawls back to a hamlet rather than dying"*, not *"stepSeason updates population"*).
  Same discipline as the town spec's *no number without a sentence*: a test you can't read aloud is
  testing the implementation, not the design.
- **Rule 2 — assert directions and relationships, NEVER tuned constants.** Every number in a
  `constants.ts` is an explicit starting guess meant to move after playtest; a suite that pins exact
  values would punish tuning, which is backwards for this project. A test answers *"is the rule
  still true?"*, never *"is the dial still where I left it?"*.
- **Every module gets a reproducibility test** (same seed + same steps → same result): one
  assertion, and it catches a whole class of otherwise-miserable bugs.
- **No snapshots, no mocks, no coverage target.** Snapshots pin constants by the back door; pure
  functions over plain structs need no doubles; coverage rewards testing trivia.
- Acceptance criteria are the bar — **every story's criteria become tests**; every bug fix gets its
  failing case first; a pure tuning pass should need no new tests (if it does, rule 2 broke).
*Why:* the prototypes are disposable and optimise for how fast a rule can change; `game/` is kept,
and its data-oriented split (pure systems over plain structs) exists precisely so behaviour is
testable without a browser — that only pays off if the tests are kept too. Full rules:
[implementation/testing.md](implementation/testing.md).

---

### 2026-09-07 — Living towns: the ledger is the simulation, the map is a projection
The parked town-economy epic (KAN-54) wakes up and widens — a town becomes an **entity with a
life of its own** that the player acts upon but never operates (shaped with the game-designer;
the four open calls answered by the human). **Board: epic KAN-67, first-slice stories
KAN-68 → KAN-77.** KAN-54 is **not** superseded — it keeps the **trade half** (routes, living
prices, ships buying and selling against what a town makes and needs) and is **blocked by
ordering**, not merely parked: the ledger must exist before prices can move against it. Its
**production half** (economic roles, local-consumption vs exportable, not every town has every
building) is absorbed by KAN-70. The load-bearing split:
- **The ledger is the simulation; the raid map is a projection of it.** A town simulates at
  *province-abstraction* resolution — three stored numbers plus a list of named **works**
  (*a sawpit, above the creek, working since '54*). **Buildings are not simulated; works are.**
  The raid map is a deterministic function of `(town seed + parcels + works ledger + damage)`.
  **No walkers, no in-town logistics, no per-building worker sim.** Rejected: a bare CK-style
  development *number* — you cannot burn a development point, and our plunder layer is
  building-level.
- **Three stored variables — population · wealth · prosperity.** Population = souls (the hands
  that man works and the mouths that eat). Wealth = coin on hand (what construction spends and
  what you steal). Prosperity = a lagging 0–100 **condition**. **Yield, security and needs are
  derived every tick, never stored.** Prosperity is stored for exactly one reason: **it must
  lag** — torch a warehouse and yield drops this instant, but the town's standing should sag
  over *seasons*, or it whipsaws and reads as a spreadsheet instead of a place.
  **Rule: no number without a sentence about a place.**
- **Loot and raze do different things** (or pillage-vs-raze is only flavour). Loot takes
  **wealth**; the work survives; recovery is seasons. Raze **removes the ledger line**; recovery
  is years, or never. Razing *defence* works lowers the garrison tier. So **raiding the same town
  twice makes it poorer *and* easier** — until it is worthless; occupying it compounds instead.
  **Pillage / raze / occupy becomes an economic argument, not a menu.** This is the ratified
  plunder hook ("a razed lumberyard = less/no lumber") finally paying off.
- **Four floors against the death spiral:** the **hamlet floor** (subsistence works — dwellings,
  fishing shacks, garden plots — cost no wealth, so a sacked town always crawls back), the
  **patron backstop**, **bounded flight** (population outflow capped per event, some refugees
  return), and **Abandoned** as a rare, *deliberate* end-state (patroned towns re-found instead,
  so the map never bleeds out by accident).
- **Identity comes from a read-only parcel ring** — 6–9 parcels `{terrain, quality, bearing}`,
  drawn on a **biased founding roll** (one dominant vocation + one or two supporting, never
  uniform random — uniform makes every town mediocre at everything). **Parcel scarcity is the
  primary growth cap: cap and flavour are the same mechanism**, so no arbitrary limits are
  needed. The **bearing** is the load-bearing field — it turns an economic fact into a *place*
  (industry sits on the town edge facing its parcel; the town elongates toward its industry).
- **The governor's plan is a five-term auction with a published three-deep wants-list.** The
  terms: *the land calls for it · the town wants it · the market wants it · fear · the patron's
  agenda*. **Wealth is the budget gate, not a scoring term** (the score decides what the town
  *wants*; wealth decides what it can *start*). **Rule: no term without a clause** — the
  one-line reason is assembled from the top two contributing terms, so **the explanation *is*
  the score**, not a rationalisation of it. The sim is **inspectable without being controllable**.
- **§7.1's four development slots are the patron's-agenda weight for a haven you own — not a
  build queue.** You set a standing goal; the governor plans within it. Same ratified rule,
  said twice.
- **The development plan is characterisation.** An officer-governor's competence and temperament
  shift the weights — a Master Gunner raises batteries; *"Roche is building himself a fine
  warehouse and no guns at all"* tells you who he is **before** he betrays you. §7.1's
  loyalty-vs-competence trade-off made *visible* instead of asserted, at no cost.
- **Three archetypes:** **colony** (self-funded off its own yield + a small charter grant;
  revenue first, defence last — which is *why* it is the raidable one) · **royal outpost** (a
  fixed crown stipend, economically stunted because it needn't earn → **hard to crack, poor to
  loot**, a target worth declining; the stipend rises under threat and lapses when the crown is
  broke — and **sack it enough and the crown decides it isn't worth the blood and pulls the
  money: the will-spine at map scale**) · **pirate haven** (your investment, no charter, no
  stipend, **no crown relief** — high ceiling, no safety net; it turns plunder into compounding
  capital, fences what nobody else will buy, builds and careens your ships, and recruits).
- **The investment slider is a standing commitment**, never a serviced dial — and its chief
  effect is that it **unlocks whole categories of work** (sheds and fishing shacks vs a stone
  battery or a shipway), so it changes **what the town becomes**, not merely how fast. It is
  bounded by a diegetic labour ceiling (*"there is money and no men"*). **Flagged, not bent:**
  this is the one place the feature touches §1.1 — the town must **never** prompt you to revisit
  it. If playtest demands more agency, the pillar-safe upgrade is the §7.1 standing goal acting
  as agenda weight, **not** a build veto.
- **The town chronicle** — one clause appended per notable event, *including your raids*
  (*"founded on salt in '41 · burned by the Dutch in '58 · rebuilt on timber"*) — is the
  legibility device and the emotional payoff.

**The human's four calls (2026-09-07):**
- **The parcel map is read-only for now** — an autobiography that *explains* the town, never an
  input device. *Possibly* steerable later (a governor-directed nudge, e.g. "work the cane before
  the timber"); until that is explicitly reopened, the no-city-builder guardrail holds absolutely.
- **Investing in a town you don't control: model the hook, don't ship the verb.** The funding
  model must support a non-owner patron; **no player-facing verb in the first slice.** When it
  does arrive it should come **through a conversation with a governor**, not a menu.
- **Enslaved / bonded labour is represented — honestly and minimally.** A plantation town's
  population line says plainly what it is, and **freeing them is a raid outcome with a fame
  consequence** (squarely in the pirate lineage). **Never** a manageable resource; **never** a
  tradable commodity in any UI. Decided explicitly rather than allowed to arrive by default.
- **Cutthroats heritage — CONFIRMED: OG towns had persistent size/wealth and changed when
  sacked.** So town persistence is **inherited, not invented**. The gap we are closing is that we
  had inherited the *interaction* (burn a specific building) without ever inheriting its
  *consequence*.

**Do NOT build** — the anti-city-builder guardrail, in full: player building placement (no build
menu, no ghost cursor, no zoning) · worker or job assignment, ever · a per-building inspection UI
· walkers, service radii, or a desirability grid · a happiness meter to service · an in-town goods
inventory (flows + one wealth stock; the raid haul is the sole spec'd exception) · any scheduled
prompt · an optimal layout to discover — including smuggled back in as "choose the town's plan" ·
a numbers-only town screen · more than ~5 surfaced values per town (population, wealth,
prosperity, security, works; everything else is prose) · a commodity price table for the player to
arbitrage · full-fidelity simulation of untouched towns (they run a cheap approximation).

*Why:* this is the consequence the plunder layer was stubbed against and the substrate §7.3's
trade layer plugs into — and it makes the pirate verbs **economic**: a town you can impoverish, a
town worth declining, a town worth holding. Simulating a *ledger* and projecting a *map* buys a
living world at province-sim cost while keeping every building burnable, and — since the player
never places anything — placement can stay a cheap grammar rather than a solved puzzle. Full
spec: [spec/town-economy.md](spec/town-economy.md); comparables (Civ · Total War · CK3 · Port
Royale · Anno · Caesar · Manor Lords · Tropico · Banished · Dwarf Fortress · Pirates!) in
[spec/design-references.md](spec/design-references.md).

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

### 2026-09-07 — Garrison size is population-derived; a "settlement" is not an "outpost" (framing, not a sim)
Refines the tier headcounts so they read *remotely logical*, not arbitrary — grounded in a town's
population. This is a **framing to think with**, ahead of the real economy/population model (KAN-54,
which another agent is building) — so **don't simulate it here**; just let the placeholder numbers
respect it.
- **Headcount ≈ population × men × combatant-fraction.** A town of ~2,000 → ~50% men (~1,000) → only a
  small combatant fraction (most hands are in **industry**), so on the order of ~100–200 potential
  fighting men — and *not* all under arms at once.
- **Combatant-fraction rises with militarisation, so size is not one axis.** An **industrial town** has
  a *low* fraction off a *big* population; a **military outpost** has a *high* fraction off a *small*
  one (it exists to garrison) — punchy for its size; a **civilian settlement** is small population *and*
  low fraction → very few defenders. A true "outpost" therefore breaks the simple size ordering.
- **Rename:** the weakest tier is a **`settlement`** (small, civilian, a thin militia), *not* an
  `outpost` (which is specifically military). Tiers for now: **`settlement` < `town` < `capital`** on a
  single size/importance axis; a militarised **`outpost`** is a distinct *future* tier, added once the
  population model can carry the two axes.
- **On-map counts are an abstracted, compressed slice** — an RTS can't field 200 sprites, so the
  *standing watch* maps to the initial garrison and the *mustering militia* to the alarm reinforcement
  waves. Relative sizes follow the population logic; absolute numbers stay small for readability.
  Precise calculations wait for KAN-54.

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

*Clarified 2026-09-07 (human):* the **implementation** was rejected, not the idea of
thresholds. The prototype's perks were flags on a dice roll (`deadEye: marks >= 78`) —
unearned and invisible. **Earned** thresholds remain open. The human's whole stated
position on levelling so far is *"the more you practice, the better you get"*; nothing
beyond that is decided. Separately, their current leaning is toward **talents** — innate
traits rather than earned perks ("always had a good sense of direction" → navigation
bonus) — which is **parked and explicitly not to be designed around yet**. Steer
captured on KAN-20.

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
