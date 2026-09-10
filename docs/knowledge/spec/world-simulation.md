# World Simulation — The Core Spec

**Layer:** WHAT (tool-agnostic) · **Authority:** human edits win · **Status:** COMPLETE for the core
(all seven world systems, 2026-09-09/10). The player's systems — the port, raiding, officers — are not here.

This is the spec for the **core of the simulation** — the systems that make a world run with no
player in it. It is derived from the world layer ratified in
[`../decisions.md`](../decisions.md) (2026-09-09) and must not contradict it or
[`../../design-doc.md`](../../design-doc.md).

Each system is specced to the same three questions, in this order:

1. **How it works** — the mechanism, with hard constraints.
2. **How it impacts the game** — what it changes for someone playing.
3. **Engine or mechanic** — and if a mechanic, how it plays out.

> **Hard constraints are marked `[HC-n]` and are the point of this document.** They exist so nothing
> downstream has to guess. A constraint may be overruled by the human, never quietly worked around.

---

## §0. Scope, and what "done" means

**In scope — the seven core systems.** Time · the map · climate & weather · factions · places · the
ledger · needs & trade. These are the world; between them they run a century without anyone
watching.

**Out of scope here** — the port, raiding, and officers. They are the player's systems and are
specced separately once the core runs.

**The milestone this serves** (ratified build order): generate a world from a seed → run it with no
player → connect the overworld to the town view. Sequence within that: **world, then weather, then
trade.**

**`[HC-0]` The core simulation contains no gameplay mechanics at all.** Every one of the seven is an
engine. This is worth stating because it defines *done*: the milestone is finished when the world
runs correctly and legibly — **not when anything is fun.** Fun is the port, the raid and the officer,
and none of them are in this document. Judge this milestone on whether a century of history reads as
plausible and is caused by something you can name.

---

## §1. Engine or mechanic — all ten systems, up front

Answering the third question for everything at once, because the answer shapes how much each section
needs to say.

| System | Engine or mechanic | Player-facing surface |
|---|---|---|
| **S1 Time** | Engine | One speed control. Nothing else. |
| **S2 The map** | Engine | Distance, felt as days and risk. |
| **S3 Climate & weather** | Engine | Read off the sky; countered by seamanship and season. Never managed. |
| **S4 Factions** | Engine that *generates* mechanics | Commissions, reputation, the war you can tip. |
| **S5 Places** | Engine (a taxonomy) | What a place *is*, legible before you land. |
| **S6 The ledger** | Engine | Nothing directly. Prices and prose are its shadow. |
| **S7 Needs & trade** | Engine, with a market as its surface | The market you buy and sell in. |
| S8 The port | **Mechanic** | The whole of your influence on a town. |
| S9 Raiding | **Mechanic** | Loot · raze · occupy · hand over. |
| S10 Officers | **Mechanic** over a small engine | The people you delegate to. |

**`[HC-1]` No engine system may ever prompt the player.** An engine's output is state and prose; if
a core system needs the player's attention to proceed, it has been designed wrong. (This is the
ratified anti-spreadsheet pillar, stated as an engine rule.)

---

## §2. The tick order

The spine. Everything else in this document assumes it.

### §2.1 Two beats, and only two

**`[HC-2]` There are exactly two beats: the DAY and the SEASON. No third beat may be added.** A day
is the atom of weather and travel; a season is the atom of economy, governors and nations. Anything
tempted to run "every week" or "every few days" rounds to one of these.

**`[HC-3]` The year is 360 days: four seasons of exactly 90.** *Ratified 2026-09-10.* No real
calendar, no leap years, no month. Nothing in the design needs a true date, and clean arithmetic makes every derived value
cheap. A place stores a single integer — **days since world epoch** — and year, season and
day-of-season are all derived from it.

**`[HC-4]` The day is a fixed step. The speed control changes how many days are simulated per real
second, never the size of a day.** No variable delta-time anywhere in the core. This is what makes
the speed control honest rather than a lie.

**`[HC-5]` The simulation never adapts to real time.** If it cannot keep up at the chosen speed it
runs slower in wall-clock — it never coarsens, skips or approximates to catch up. Adaptive fidelity
would make history depend on the machine it ran on.

### §2.2 The daily tick

In this order, every simulated day:

1. **Weather advances.** Each active system moves along its track and its severity moves along the
   spectrum — building or spending itself. Systems form and dissipate per the climate's rules.
2. **Contact resolves.** For every place and every materialised ship, severity is sampled *at its
   position, now*. Two different kinds of result, and they are handled differently — see `[HC-6]`.
3. **Objects move.** The four war-currencies advance along their courses, wherever they are. Ships
   in the near and middle rings advance.
4. **Interception resolves.** Nothing in this milestone (no player), but the phase exists so that
   adding it later does not reorder anything.

**`[HC-6]` Weather has two output paths and they must not be mixed.** *Damage* is an **event** and
applies the day it happens — a work drops a grade, or at the top of the spectrum is destroyed.
*Yield* is a **modifier** and accumulates into the current season's harvest, applied once when the
season resolves. A downpour does not reach into a ledger that has not been struck yet.

### §2.3 The seasonal tick

Every 90th day, in five phases. **The phases exist to keep the world order-independent** — see
`[HC-7]`.

| Phase | What happens | Order-dependent? |
|---|---|---|
| **1 · Produce** | Every place resolves its own works, takes its yield against climate and this season's accumulated weather modifier, and totals its needs against the pyramid. | No — each place is independent. |
| **2 · Clear** | Trade clears **globally, all places at once**: surpluses meet shortfalls, prices settle locally. | No, by construction. |
| **3 · Settle** | Every place settles from its post-trade position: imports paid first, wealth is the remainder, prosperity lags toward its target, population drifts toward carrying capacity. | No. |
| **4 · Govern** | Every governor decides what to build, and publishes his reasoning in plain language. | No. |
| **5 · Rule** | Every nation decides and publishes its reasoning: money down, taxes up, wars begun and ended, charters granted and dispatched, garrisons moved. | No — but nations act *on* the world phase 4 left. |

**`[HC-7]` Trade must clear in one global phase, never town-by-town.** If places resolved trade in
sequence, whoever went first would get first call on everyone else's surplus, and the world's history
would depend on iteration order. This also protects the ratified *nothing pairwise* rule: a global
clearing scales with the number of places, while every-town-against-every-town scales with its
square — and that, not the place count, is what would kill performance.

**`[HC-8]` A promotion is decided in phase 5 and delivered later.** Crossing the threshold does not
make a town a town. It causes a **charter to be dispatched**, which then travels and can be taken.
The place is promoted on arrival, not on qualification.

---

## §3. How the systems drive each other

The interaction model. Read a row as *"this system hands that system exactly this."*

| From | To | What passes across |
|---|---|---|
| **S1 Time** | everything | Two beats. **Nothing else in the game owns a clock.** |
| **S2 Map** | S3 | Coastlines and climate-zone geography, so a storm has somewhere to form, a track to run, and a coast to come ashore on. |
| **S2 Map** | S5 · S6 | A place's **position**, and from it **the land it holds** — coastal orientation and what that ground will bear. |
| **S2 Map** | S7 | **Distance between named neighbours**, which is what makes a trade route cost something and a price local. |
| **S2 Map** | S4 | Distance, so a navy takes a week to arrive and a crown's reach has a limit. |
| **S3 Weather** | S6 | A **seasonal yield modifier** per place, and occasional **damage events** on named works. Nothing else. |
| **S3 Weather** | S2 | **Wind** — strength and direction — which makes a sea leg take the time it takes. |
| **S4 Factions** | S5 | Who owns a place; whether it is at war; and **a charter**, dispatched. |
| **S4 Factions** | S6 | **The grant** — no longer a number from nowhere but the *arrival* of a shipment that may not arrive. |
| **S4 Factions** | S4 | War, peace, alliance — and the reason, stated. |
| **S5 Places** | S6 | **Size · purpose · faction**, which set what the governor may build and how the place sprawls. |
| **S5 Places** | S4 | Taxes, and a place worth defending or writing off. |
| **S6 Ledger** | S7 | **Surplus and shortfall** — what a place has spare and what it cannot cover locally. |
| **S6 Ledger** | S5 | Whether a threshold has been crossed, which is what phase 5 acts on. |
| **S6 Ledger** | everything visible | Population, wealth, prosperity, works — **the ledger is the simulation; the map is a projection of it.** |
| **S7 Trade** | S6 | Goods bought and sold, and **the wealth that is the difference**. Imports are paid before anything is built — bread before batteries. |
| **S7 Trade** | S2 | The **flows** that materialise as sails near the player. |

**The one loop worth naming.** S6 → S7 → S6 is a genuine cycle inside a single season, and `[HC-7]`'s
phase split is what keeps it from being circular: **phase 1 fixes what everyone has and wants, phase
2 moves goods, phase 3 books the result.** No place may re-produce in response to a price it saw in
phase 2. It reacts next season, through its governor, like everything else.

---

## §4. Invariants that cut across every system

**`[HC-9]` One clock, one random stream, both in world state.** No system carries its own.

**`[HC-10]` Randomness is DERIVED, never consumed in traversal order.** Every roll takes its seed
from a pure function of `(world seed, what this roll is for, the id of the thing it is for)`. It must
never draw the next number from a shared sequence, because then adding one place silently changes
every other place's history. This is the single most important engineering constraint in the
document, and the town module's existing per-place founding seed already has the right shape — it
only needs its seed derived from the world's.

**`[HC-11]` Reproducible means the whole history, not the starting state.** The same seed
fast-forwarded twice gives the same two hundred years, at any speed, on any machine.

**`[HC-12]` A ring is a rendering and interaction boundary, never a simulation boundary.** The world
resolves identically whether anyone is watching.

**`[HC-13]` The flow is the truth; ships are how the truth is drawn.** A materialised ship is a view
of a flow, never a second source of truth. The **four war-currencies are the sole exception** —
treasury, reinforcements, charter, invasion force are real objects in all three rings, because taking
them is the whole of how a player tips a war. There are only ever a dozen or so at a time.

**`[HC-14]` Store almost nothing.** Three numbers and a list of works per place; everything else is
derived on demand, every tick. This is what makes fifty places and a two-hundred-year fast-forward
possible at all.

**`[HC-15]` Nothing pairwise.** See `[HC-7]`. Any design that compares every place to every other
place is wrong, however cheap it looks at fifty.

**`[HC-16]` Every decision publishes its reason in plain language.** A governor's build, a nation's
war, a crown writing a place off. **A war you can read the cause of is worth more than a war that
merely happened** — and in a world with no player, the stated reason is the *only* way to tell a
working simulation from a plausible-looking one. This is a testability requirement, not a flourish.

**`[HC-17]` Promotion is one-way and no place is ever demoted.** Decline happens *inside* a class.
A failed town is a town that wasted its potential, never a settlement again.

**`[HC-18]` Only a deliberate hand empties a town.** The hamlet floor holds under every place, so
decline alone can never empty one. `Abandoned` is reachable only by being razed to nothing, by a
player or by a war.

**`[HC-90]` Every system's DEFINITIONS live in a data table; only its BEHAVIOUR lives in code.**
*Ratified 2026-09-10.* The engine owns the **types**; content supplies the **instances**. So the
climate's four parts, the crowns' identities and characters, ship classes, the works catalogue and
every tuning number are **tables**; the tick order, the auction, the trade clearing and the will-spine
are **code**. This costs nothing at the moment a system is written and is a rewrite afterwards — see
`decisions.md` (2026-09-10, second) for why the port argument decided it.

**`[HC-91]` A definition table is the source of truth; its TypeScript type is generated from it.**
Never the reverse. This is what keeps exhaustiveness checking and autocomplete while leaving the
content portable — a closed hand-written union would weld the content to this language.

**`[HC-92]` Behaviour is never expressed as data. No DSL, no scripting language, no rule engine.**
There is one consumer and he can edit TypeScript. Every surveyed system that put behaviour in data
grew a bad language by accretion; this one will not start.

**`[HC-19]` The world map is the single source of geography.** A town's local land is *derived* from
its position on it and never independently rolled. **Consequence: the shipped invariant that the sea
lies south of every town is void** — a town faces whatever way its coast faces.

---

## §5. S1 — Time

### How it works

A single integer, **days since world epoch**, is the whole of stored time. Year, season and
day-of-season derive from it (`[HC-3]`). The world epoch is day 0 = the first day of spring of the
generator's start year; the start year is a generation parameter, and the period register is the
1660s.

The **speed control** replaces the three step-buttons the town harness uses today. It selects how
many days advance per real second — a small set of named rates rather than a continuous slider,
because named rates are reproducible, describable in a bug report, and enough. The rates want to span
*watch a storm cross a coast* to *watch a century pass*, and the exact numbers are tuning.

**`[HC-20]` Pause is a first-class speed.** A paused world is fully inspectable and advances nothing.

**`[HC-21]` The step-buttons stay in the single-town harness.** They are how the town module is
tested today; the world sim gets the running clock. Do not break the harness to unify them.

### How it impacts the game

In this milestone, the speed control is the player's *entire* relationship with time — and it is what
makes the world feel indifferent rather than staged, because it keeps running whether or not anything
is happening to you. Later, time is the campaign's pressure: **aging is the clock** and legacy is the
goal (design-doc §7.4). Nothing about that changes this spec; it reads the same integer.

### Engine or mechanic

**Engine**, surfacing as exactly one control. There is no time *mechanic* — no turn to spend, no
action points, no cooldown. `[HC-4]` and `[HC-5]` are what keep it that way.

### Acceptance criteria

- The same seed, run at the slowest and the fastest rate, produces **identical** world state at the
  same simulated day.
- Pausing and resuming changes nothing about the resulting history.
- No system anywhere reads wall-clock time.

---

## §6. S2 — The map

### How it works

**One generated world per seed.** ~50 places on real coastlines, at real positions, with real
distances between them. The sea is **invented every game** — new coastlines, place names from
per-nation name pools, five real crowns — and no real port is on it (`design-doc.md` setting note).

**What the generator writes**, and this list is the generator's contract:

| Written at generation | Fixed thereafter? |
|---|---|
| Landmasses and coastlines | Yes |
| Climate zones (see §7 — **not** called regions, `[HC-23]`) | Yes — climate never changes |
| The ~50 place positions | Yes |
| Each place's **size · purpose · faction** at day 0 | No — size and faction can change; purpose is stable |
| Each place's **land**, cut from the map at its position | Yes — `[HC-19]` |
| Each place's opening ledger — population, wealth, prosperity, works | No, obviously |
| Which crown holds what | No |
| The neutral set — havens, abbeys, camps | **Yes.** Fixed at generation; the neutral share can only shrink |

**Warm start.** The generator writes *a believable 1660s map* — cities already cities, a great port
here, a hamlet there — and the simulation runs on from that day. It is not a cold world watched from
its origin.

**`[HC-22]` A warm start must be internally consistent, not merely plausible-looking.** A city
written at day 0 must hold a ledger that the ordinary rules could have produced and can sustain: its
works must feed its population, its wealth must service its upkeep. A generated state the simulation
would immediately collapse is a bug, and the cheapest test of the whole generator is **run the fresh
world for twenty years and check nothing falls over.**

**Distance and scale.** The world is measured in **nautical miles** and distances are real. A
Caribbean-register sea holding fifty ports is on the order of 1,500 × 800 nm; at an average made-good
of 4–8 knots a typical inter-port leg is **one to four days**. That is what gives the day beat
something to do, and it is why distance is the game's main currency of cost.

**`[HC-23]` The world scale does NOT use the word "region".** A town's land groups are regions and
that word is in shipped code. The world's climate divisions need their own name — **zones** in this
document — or the spec reads as *"each cane flat gets its own climate."*

**`[HC-24]` No hex grid at world scale.** Hexes are a town-level zoning device. The world is
continuous positions and real distances.

**The three rings**, defined by **reachability rather than radius**, which is what the human actually
described:

| Ring | Definition | What exists |
|---|---|---|
| **Near** | Can be seen and engaged this tick | Every ship a real object with position and course |
| **Middle** | **Could be intercepted if you set course now** | Ships exist and hold courses; not drawn in detail |
| **Far** | Unreachable by any plausible chase | Ordinary trade is a flow; no objects |

**`[HC-25]` Ring membership is computed from reachability, not from a raw distance cutoff.** Whether
a target is in the middle ring depends on relative speed and its course — a fast ship running toward
you is reachable from further off than a fast ship running away. Distance bands are an acceptable
cheap approximation of this; the *rule* is reachability, and the promise to keep is that **a chase
committed to finds its quarry.**

**`[HC-26]` Ring boundaries live in the simulation, not in the camera.** Looking somewhere must not
change what exists there. Combined with `[HC-12]`: rings decide what is *drawn and touchable*, never
what is *true*.

### How it impacts the game

Distance is the price of everything. A raid is priced in days away from a market; a rescue is priced
in whether you can get there; a trade route is worth running because the two ends are far enough
apart to disagree about prices and close enough to reach. **The map is what stops every decision from
being free.**

It is also what makes the world feel unaimed: a storm crosses a coast because that is where the coast
is, and hits four towns and not you.

### Engine or mechanic

**Engine** — but it is the engine that produces the strongest mechanic in the game, because *"how far
away is it"* is the question underneath every choice a player makes. The map itself offers no verbs.

### Acceptance criteria

- The same seed produces a byte-identical map, including names.
- A fresh warm-start world run for twenty years with no player shows no place collapsing for reasons
  the generator caused (`[HC-22]`).
- A town's local hex map and ground plan agree with the world map at its position — coastal bearing
  included — with no town assuming the sea lies south.
- Moving the camera across the world changes nothing about world state (`[HC-26]`).

---

## §7. S3 — Climate & weather

### How it works

Three layers, and keeping them apart is what makes the system both cheap and believable.

#### §7.1 Climate — written once, never changes

The world divides into a handful of **zones** (`[HC-23]` — not "regions"). For fifty places on a
~1,500 × 800 nm sea, expect **four to eight**. A zone's climate is fixed at generation and is the
rulebook every weather event obeys.

A climate consists of exactly four things:

| Part | What it fixes | Why it exists |
|---|---|---|
| **Seasonal baseline** | The ordinary weather of each of the four seasons — how wet, how settled | Gives the year a shape without any event happening |
| **Prevailing wind** | Direction and typical strength, per season | The input the sailing model will one day read |
| **Storm regime** | Which seasons spawn events, how often, where they form and which way they track | A dry coast can never get a season of rainstorms |
| **Suitability** | What the ground in this zone will bear *at all* | This is what the town's existing suitability roll was always a placeholder for |

**`[HC-27]` Climate is immutable.** No event, no century, no player action changes a zone's climate.
Anything that wants to vary is weather, not climate.

**`[HC-28]` Climate constrains; position varies within the constraint.** The zone says what is
*possible* on that ground — a dry zone never yields a cane flat. The place's position on the world
map decides what is *actually* there. This is how `[HC-19]` (the world map is the single source of
geography) reaches the town's land without the climate becoming per-town state.

**`[HC-29]` Storm tracks follow the prevailing wind, not the player.** Events form where the regime
says they form and run the way the wind runs — for the period register, that means systems forming
to windward and tracking away from it, so some coasts are lee shores and others are not. **A coast's
exposure must be a property of the map, so that where a place sits is a decision with consequences.**

#### §7.2 Ambient weather — a spectrum, and free

Every zone has a weather value **every single day**, fluctuating continuously. There is no
fair-or-storm switch: the zone is always somewhere on one spectrum, and **a storm is that spectrum at
its extreme**, not a separate kind of thing.

**`[HC-30]` Ambient weather is DERIVED, never stored.** It is a pure function of
`(world seed, zone, day)` — smooth day-to-day, seasonally biased by the climate's baseline. This
costs nothing, needs no state, and satisfies `[HC-10]` and `[HC-14]` outright. **Weather is never
stored per place**, which is what keeps the ratified three-numbers-per-place rule intact.

#### §7.3 Events — the only weather that costs anything

An event is a **local excursion far up the spectrum that travels**. Unlike ambient weather, it has a
life, and therefore it has state.

**`[HC-31]` A live event is stored world state — and it is the sole exception to `[HC-14]` in this
system.** It must be, because momentum is history: an event that is building is not the same as an
identical event that is spending itself, and no pure function of `(seed, day)` can know which. There
are only ever a handful alive at once, so the cost is trivial. **Its spawning is still derived** from
`(world seed, zone, day)`, so the same world always breeds the same storms.

An event carries: a position, a track, a **severity** (where it sits on the spectrum *now*), and a
**trend** — building or spending. It forms, moves along its track each day, and its severity walks up
or down the spectrum as it goes. It dissipates when severity falls back into the ambient range.

**`[HC-32]` Severity is sampled at the place and the moment of contact, and nowhere else.** The
severity felt at a position is the greater of the zone's ambient value and the contribution of any
event whose footprint covers that position, falling off from its centre. **Two towns twenty miles
apart may feel the same event very differently, and that is the point.**

**`[HC-33]` No code path may key an effect off "an event happened here".** Effects read the sampled
severity. This is the ratified *one event is not one consequence* rule stated as an engineering
constraint — it is what makes the same storm a wet week at sea and a ruinous landfall four days
later, or nothing at all because it arrived already spent. **Nothing is owed damage merely because a
storm arrived.**

#### §7.4 The bands — what severity actually does

Four bands, anchored on the human's own descriptions, which are the specification and not
illustrations of it. Numbers are tuning; the *sentences* are the rule.

| Band | What it reads as | Wealth | Yield | Works |
|---|---|---|---|---|
| **Fair** | Ordinary weather | — | — | — |
| **Blow** *(common — several a year)* | "Loose roof shingles, a broken gate or fence" | Small maintenance cost | May nick it | — |
| **Gale** *(regular — every year or two)* | "A downpour on the fields" — a surplus of 100 becomes 70 | — | **Real hit** | — |
| **Tempest** *(rare — memorable)* | "The warehouse falls over and its contents spoil" | One-off loss | Hit | **Works drop a grade** |
| *Tempest, extreme tail* *(generational)* | A work destroyed outright | | | **One work removed** |

**`[HC-34]` Damage moves works down the existing ladder** — `working → idle → decayed → ruin` — one
grade at a time. It never skips to ruin, and it never touches more works than the severity warrants.

**`[HC-35]` The extreme tail may destroy exactly ONE work, never a sweep.** This is what preserves
the distinction the human drew: **razing is deliberate and wholesale; the storm is random and
singular.** A town can lose its quay to the sea; it cannot lose its town to the sea.

**`[HC-36]` "Contents spoil" is a WEALTH loss, never a stockpile deduction.** There is no in-town
goods inventory — the ratified model is flows plus one wealth stock — so there is literally nothing
to spoil. A Tempest that takes the warehouse down expresses as **(a)** the work dropping a grade, so
its contribution to the ledger falls, and **(b)** a one-off wealth loss standing for what was lost.
This gets the fiction the human described without reintroducing a never-build.

#### §7.5 Wind

Per zone, per day: direction and strength, from the climate's prevailing wind modulated by the
ambient value, and distorted locally near a live event.

**`[HC-37]` In this milestone wind has exactly two jobs:** move events along their tracks, and give a
sea leg its duration. **No per-ship sailing model is in scope** — with no player ship, nothing else
needs it.

### How it impacts the game

Weather is what makes the world feel unaimed. A storm crosses a coast because that is where the coast
is; it takes your rigging while it is still building and flattens a town you have never visited four
days later, and neither event was about you. It is also the system that most cheaply makes a *place*
legible: timber fetches well in this port because a storm took its quay two seasons ago and it has
been buying its rebuilding materials ever since. **The price is the town's own condition, readable if
you look.**

For the sim milestone specifically, weather is the **only** source of shocks until trade lands
(build order: world → weather → trade). It is therefore what stops fifty towns growing to a ceiling
and flattening — which is the failure mode the milestone most needs to avoid.

### Engine or mechanic

**Engine.** And deliberately one the player can never touch:

**`[HC-38]` There is no weather management, ever.** No forecast screen, no barometer to buy, no
warning to purchase, no mitigation to build. The counterplay is **seamanship, a good sailing master,
and sailing in the right season** — all of which live in other systems.

> **Open, deferred to the sailing spec, not decided here.** Can a good sailing master read the
> *trend* — that this one is building rather than merely bad right now? That is the difference
> between weather as a dice roll and weather as something skill reads. It was raised and never
> answered, it needs a player to matter, and it is out of scope for a milestone with no player ship.
> **Do not implement either answer.**

### Acceptance criteria

All of these are checkable on a headless two-hundred-year run of a fresh world, which is exactly what
the milestone produces:

- **Determinism.** The same seed yields the same storms, on the same days, on the same tracks —
  including at different speed settings.
- **Climate holds.** No zone ever produces weather its regime forbids. A dry coast records no
  rainstorm season in two hundred years.
- **The spectrum is continuous.** Sampled severity across a zone over a year shows no gaps or
  clustering into discrete states — bands are a reading of the value, not the value itself.
- **One event, several outcomes.** At least one event in the run must be demonstrably harmless at one
  contact and damaging at another. If every event that touches anything damages it, `[HC-33]` is not
  really implemented.
- **Rates are plausible.** A representative coastal place sees several Blows a year, a Gale every
  year or two, a Tempest roughly once a decade, and a work destroyed roughly once a generation.
- **Exposure matters.** Places on exposed coasts take measurably more than sheltered ones over the
  run. If siting makes no difference, `[HC-29]` is not really implemented.
- **No place stores weather**, and no place's stored fields grow because weather exists.
- **Nothing is razed by a sweep.** Across the whole run, no single event ever destroys more than one
  work at one place.

---

## §8. S4 — Factions

### How it works

#### §8.1 What a nation is

**Five crowns, configured not generated** — fixed identities with fixed characters. The generator
decides only who holds what on day one. Plus **neutral factions**, which are a kind of faction and
not an absence of one (§8.7).

**`[HC-39]` A nation stores only three things: a treasury, its relations, and its seat.** Its
holdings are **derived** — every place already stores its own faction, so a nation's territory is a
query, never a duplicated list. Its character is configuration, not state. This is `[HC-14]` applied
one layer up.

**`[HC-40]` The treasury is a real stock and can be empty.** This is the single most load-bearing
rule in the faction layer. **A broke crown stops paying**, and everything interesting follows from
that — see §8.5.

#### §8.2 The auction — the governor's pattern, one layer up

**`[HC-41]` A nation decides by weighted auction with a stated reason, in exactly the same shape as
the town governor's.** Not a similar pattern — the same one. It is already built, already trusted,
and it is the reason the town sim is legible rather than opaque. Five terms:

| Term | The question it asks |
|---|---|
| **Revenue** | What will pay? Where is the tax base, and where is it growing? |
| **Threat** | What is exposed, and who is pressing me? |
| **Prestige** | How does this read among the crowns? |
| **Cost** | Can I afford it at all? *(The term that vetoes.)* |
| **Character** | The crown's standing bias — what this particular crown always wants. |

**`[HC-42]` Character is fixed per crown and never drifts.** A crown's *emphasis* moves as the world
moves, because the other four terms move; its nature does not. A crown that has been beaten into
poverty is still recognisably itself.

#### §8.3 One action a season, and a budget

**`[HC-43]` A nation takes exactly ONE strategic action per season, plus a budget allocation.** The
split matters: the strategic action is a **legible event** with a reason, and the budget is a
**continuous flow** that needs no narration.

Five crowns × four seasons = **twenty stated strategic decisions a year**. Over two centuries that
is a chronicle a person can actually read, which is the whole point — see `[HC-46]`. Allow a nation
several big actions per season and the history becomes noise.

The strategic action set: **declare war · make peace · offer or accept an alliance · dispatch an
invasion · write a place off · revive a ruined place · do nothing, and say why.**

**Granting a charter is deliberately NOT on that list.** Crossing the promotion threshold *obliges*
the crown rather than tempting it, so the charter is dispatched automatically in the same phase
without ever entering the auction — see `[HC-64]`. It is bookkeeping, not a decision.

**"Do nothing, and say why" is a first-class action.** A crown that holds still through a crisis is
making a decision, and the reason it publishes is often the most revealing line in the chronicle.

#### §8.4 The dispatch — one object, four payloads

**`[HC-44]` The four war-currencies are ONE object type with four payloads, never four systems.**

| Payload | Carries | If it never arrives |
|---|---|---|
| **Treasury** | Coin to a place | The grant is not credited; the place lives on its own trade |
| **Reinforcements** | Garrison strength | The place stays as weak as it was |
| **Charter** | A promotion | **The place stays a settlement** |
| **Invasion force** | An attack on a place | The town does not change hands |

Writing interception once, against one object, is what makes all four verbs affordable. It is also
why the ratified never-build on *goods physically shipped between AI towns* survives intact: **these
are not goods.** Ordinary cargo stays a flow (`[HC-13]`); a dispatch is a permanent object in all
three rings.

**`[HC-45]` A dispatch is credited on ARRIVAL, never on decision.** The crown's intent is not the
place's income. This is `[HC-8]` generalised, and it is what makes interception mean something.

**`[HC-46]` A governor plans on what has arrived, never on what is promised.** He does not count
unhatched chickens. This keeps the ledger honest, keeps a place's plans from collapsing when a
shipment is taken, and is more period-plausible than a colony budgeting against a crown's good
intentions.

**Reach is real.** A dispatch travels from the crown's **seat** at sailing speed, so a distant
holding waits longer for everything. **Neglect of far colonies is therefore emergent, not scripted**
— it falls out of `[HC-45]` plus distance, with no special rule.

#### §8.5 Money circulates — the engine of the whole world

Both directions, every season:

- **Up:** every place pays its crown a share of what it earns.
- **Down:** the crown dispatches grants, garrisons and navies out of its treasury.

**`[HC-47]` No money is created or destroyed outside this circulation.** A place's grant comes out of
a treasury that a place's tax put there. Nothing is emitted from nowhere — which is the same
principle as the ratified *a town's wealth is EARNED, not emitted*, applied to crowns.

This is where the ratified **city-by-proxy** idea stops being abstract and needs no machinery of its
own. A crown fighting a long war drains its treasury; a drained treasury dispatches nothing; places
that were living partly on grants fall back on their own trade; **its whole coast gets poorer, and its
greatest city with it.** That is the ratified consequence — *"you did cause that, just never with a
landing party"* — arriving as arithmetic rather than as a special case. **Do not build a separate
influence system for it.**

#### §8.6 War, and how it ends

War's effects, in order of how much they matter to the sim:

1. **Trade between belligerents stops.** For an economy of named neighbours this is the big one, and
   it is what makes a war felt in towns that never see a soldier.
2. **Invasions become available** between the belligerents.
3. **Treasuries drain**, which reaches every holding via §8.5.
4. **Threat rises**, so the auction shifts from revenue toward garrison — *fear outbids revenue*,
   exactly as it does in the town governor.

**`[HC-48]` A war ends when WILL breaks, not when a side is destroyed.** A crown makes peace because
the cost term has beaten the prestige term — *"a nation deciding you're not worth the blood."* This
is the ratified one-spine at map scale and it must be implemented as the same idea, not merely named
after it. **No attrition threshold, no unit count, no conquest condition.**

**`[HC-49]` An invasion transfers a place and leaves its ledger intact.** Works, population,
prosperity, chronicle and the governor's post all survive; only who it belongs to changes. A town
does not forget its history because a different flag flies.

**`[HC-50]` Razing by war is the rare exception, and it is the only way a place reaches `Abandoned`
without a player.** This is what gives `[HC-18]` its second cause. It must stay rare enough that an
abandoned town is a landmark rather than a statistic.

#### §8.7 Neutrals

**`[HC-51]` A neutral faction takes no strategic action and dispatches nothing.** No treasury, no
navy, no charters, no invasions, no expansion — *"an abbey has no reason to try expand."* The neutral
set is fixed at world generation, so **the neutral share of the map can only shrink.**

**`[HC-52]` Neutral places still run the full ledger, with an inward agenda.** They are not scenery.
What they lack is a patron: **no grant, and therefore no safety net** — a neutral place lives on
exactly what comes over its beach. The hamlet floor is all that stands under it.

**The player's own haven is the standing exception:** its agenda is *him*. Out of scope here, and
noted so nobody writes a rule that forbids it.

#### §8.8 Determinism

**`[HC-53]` Every tie in an auction breaks on a derived roll, never on iteration order.** Two crowns
weighing identical options must not be separated by which one the loop reached first. `[HC-10]`
applies: seed from `(world seed, "nation decision", crown id, day)`.

### How it impacts the game

Factions are what make the world's ceiling *move*. A town has a limit at any moment, but the limit
keeps shifting because wars start, crowns redirect money, and rivals rise — so **nothing settles long
enough to be solved.** Without this layer the fifty towns find their level and stop, which is the
milestone's central failure mode.

For a player, later: this is the only layer that reaches a city, the source of commissions and
reputation, and the thing the four interception verbs act on. **None of that is in this milestone** —
reputation per crown is a player interface and is specced with the port.

### Engine or mechanic

**An engine that generates mechanics.** In this milestone it is pure engine: crowns act on each other
and on places, and nobody watches. Everything player-facing that grows out of it — commissions,
reputation, tipping a war — is a *consequence* of this engine and is specced elsewhere.

`[HC-1]` applies with force here: **a crown never waits for the player, never offers him a choice,
and never explains itself to him.** It publishes its reason to the world, and the player may read it
or not.

### Acceptance criteria

On a headless two-hundred-year run of a fresh world:

- **Every strategic action carries a one-line reason that names its winning term.** An action whose
  reason cannot be printed is a bug, not a rough edge.
- **No treasury grows monotonically across the run.** Money must circulate; a crown that only
  accumulates is not spending, and `[HC-47]` is not really implemented.
- **Wars start and end.** None runs the whole two hundred years, and at least one ends by the cost
  term beating prestige — verifiable from the stated reason, per `[HC-48]`.
- **At least one place changes hands with no player involved**, and its ledger is intact afterward
  (`[HC-49]`).
- **A crown that loses a long war has measurably poorer places within a decade of losing it** — the
  city-by-proxy chain of §8.5, observed rather than asserted.
- **Distant holdings are measurably worse-funded than near ones**, with no rule saying so
  (`[HC-45]` plus reach).
- **No neutral place ever receives a dispatch, expands, or takes a strategic action.**
- **No nation stores a holdings list** (`[HC-39]`).
- **Determinism:** same seed, same wars, on the same days, at any speed.
- **Abandoned towns are landmarks, not statistics** — across the run, razing by war stays rare enough
  to count on one hand (`[HC-50]`).

---

## §9. S5 — Places

### How it works

#### §9.1 Three axes, fully independent

**`[HC-54]` A place is described by size × purpose × faction, and every combination is legal.** No
combination is special-cased and no fourth axis may be added. This independence is the whole value of
the model: it is what lets a small place outfight a big one, and it yields a military city and a trade
settlement for free rather than as separate designs.

| Axis | Values | Mutable? |
|---|---|---|
| **Size** | settlement · town · city | Yes, upward only — `[HC-57]` |
| **Purpose** | civilian · military · trade | **No** — `[HC-56]` |
| **Faction** | one of five crowns, or one of the neutrals | Yes, by invasion |

**`[HC-55]` "Outpost" is a READING, not a class.** It means *(size = settlement, purpose =
military)*. It is not a fourth size, not an archetype, and not a stored field. This is the ratified
line — *a military outpost is a small place with a military purpose* — stated so nothing reintroduces
it as a type.

**`[HC-56]` Purpose never changes.** A trade town does not become a military town. Purpose is what a
place *is*; if it drifted, the axes would describe nothing. *(A crown deliberately re-purposing a
place is a plausible later addition. **Deliberately not built** — do not add it as a side effect of
something else.)*

**Ratified 2026-09-10, with a reservation:** a **pirate haven's purpose is `trade`** — it lives on
what comes over the beach and sells it. Its character comes from its **faction** being neutral, not
from a fourth purpose, which keeps the axes closed. Raised in docket one as *"drinking and whoring is
a fourth purpose or a faction trait"*; the human accepted `trade` **"for now"** and reserved pirate
havens for a later pass. **Build against `trade`; expect this one to be revisited.**

#### §9.2 What each axis actually does

The axes must not be decorative. Each has exactly one job:

| Axis | Its one job |
|---|---|
| **Size** | Gates the **works vocabulary** — what kinds of work exist here at all — and sets the **garrison grade**. |
| **Purpose** | Sets the governor's **build priorities**, and defines what the place counts as **its own job** for dependency scoring. |
| **Faction** | Decides **who taxes it, who dispatches to it**, whether it is at war — and whether it has a patron at all. |

**`[HC-57]` Size is not a growth cap.** Parcel scarcity remains the ratified primary cap — *cap and
flavour are the same mechanism*. Size gates *vocabulary*, not scale: a settlement cannot raise a stone
battery because such a thing is not built in a settlement, not because a number stopped it.

**`[HC-58]` Flexibility scales with size.** This is how the human's answer is implemented: *"an
outpost's growth will always just be shaped by its purpose, whereas towns have a bit more
flexibility."* So purpose is a **hard constraint** at settlement scale, a **strong weight** at town
scale, and a **mild bias** at city scale. **A small place is what it is for; a large place can be
several things.** This is a derived reading of the two axes, never a fourth axis of its own.

**`[HC-59]` The garrison is derived, never stored** — from population, size and purpose together, with
military purpose multiplying. This is what makes `[HC-54]`'s independence pay off: **a military
settlement can outfight a civilian town twice its size**, and neither needs a special rule.

**`[HC-60]` The two ladders stay separate and the defence one is renamed `picket · garrison ·
fortress`.** *Ratified 2026-09-10.* Size class is *settlement → town → city*. The shipped
`outpost / town / capital` ladder measures **how hard the garrison is** and shared two words with the
size class by accident. **The collision must be gone before either ladder is extended.**

#### §9.3 The asymmetry that carries the fiction

> A settlement is not a small town. A settlement is **potential**. A town that fails does not become a
> settlement — it becomes a town that **wasted its potential**.

**`[HC-61]` Promotion is one-way and nothing is ever demoted.** Decline happens strictly *inside* a
class. If a failed town could quietly become a settlement again, both meanings would be lost — a
ruined town must read as a tragedy and a settlement as a promise.

**`[HC-62]` The only emergent promotion is settlement → town. City is authored-only.** Cities are
designated by the generator at world creation and no town ever becomes one. This is the ratified
*emergent below city, designated at city*.

#### §9.4 Promotion — a quiet threshold, a visible arrival

1. A place's ledger crosses a **sustained** threshold.
2. Its crown **dispatches a charter** — automatically, not as a choice.
3. The place becomes a town **when the charter arrives**, and a governor is installed.

**`[HC-63]` The threshold requires persistence, not a peak.** It must hold for several consecutive
seasons, so one good harvest never charters a village. Without this, promotion becomes noise and the
charter stops meaning anything.

**`[HC-64]` A charter dispatch is automatic and is NOT the crown's strategic action.** Crossing the
threshold *obliges* the crown; it never weighs it in the auction. This is the ratified *the charter is
automatic — nothing sits between the threshold and the grant*, and it is what makes **interception the
only thing that can stop a promotion.** (See §8.3, where "grant a charter" is therefore bookkeeping
rather than a choice.)

**`[HC-65]` A neutral place can never be promoted.** It has no patron, so there is no one to charter
it. The neutral share of the map only shrinks (`[HC-51]`), and a haven stays a haven however rich it
becomes. **This does not constrain developing a haven** — a haven grows by works, wealth and
fortification, none of which is size class.

#### §9.5 The three failure states

**`[HC-66]` No failure state is stored. All three are readings of the ledger.**

| Reading | What it is | Recovery |
|---|---|---|
| **Poor** | Works still working; wealth and prosperity low | **Unaided.** Ordinary recovery. |
| **Ruined** | Sitting on the hamlet floor — subsistence works only, the rest decayed or ruin | **Only with substantial outside help** |
| **Abandoned** | No people and no works | **Never** |

**`[HC-67]` The hamlet floor requires survivors.** Subsistence works cost no wealth, so any place with
people crawls back — which is why *ruined* recovers and why it needs no new field. **Razing to nothing
removes the people, and with them the floor.** That single condition is the whole mechanism by which
abandonment sticks, and it is why `[HC-18]` holds without a sticky flag: there is nobody left to raise
a hut.

**`[HC-68]` Reviving a ruined place is ONE decision, never a grind.** It resolves as a dispatch
arriving (`[HC-44]`) — a crown's cost-versus-benefit action, generally led by a show of force, or the
player's. It is never a repeated input, a slider, or a progress bar. This is the ratified *recovery
must never be a grinding mechanic for the player*, stated as a constraint on shape rather than on
difficulty.

#### §9.6 Legibility

**`[HC-69]` What a place is must be readable before you land.** Size, purpose and faction are all
visible from the sea or from a port's talk — because they are the whole basis on which a player
decides whether to approach at all. A place whose class can only be learned by landing has made the
decision for him.

### How it impacts the game

The axes are what make fifty places feel like fifty places rather than one place at fifty scales. And
the asymmetry in §9.3 is where the world gets its emotional grammar: **a settlement is a promise and a
ruined town is a tragedy**, and those two readings only survive because promotion is one-way.

For the player, the payoff is target selection. A military settlement is hard and poor; a trade city is
rich and unlandable; a civilian town is the raidable one. **The axes are the reason "which port" is a
real question** — and they are also why the ratified *an outpost is a poor raid and an excellent
interception* is true without anything saying so.

### Engine or mechanic

**Engine — a taxonomy.** It offers no verbs of its own; it decides what every other system sees when
it looks at a place. Its player-facing surface is entirely *information*: `[HC-69]` is the whole of it.

### Acceptance criteria

On a headless two-hundred-year run of a fresh world:

- **At least one settlement is promoted**, and its charter is observably dispatched, travels, and
  arrives before the promotion takes effect.
- **Nothing is ever demoted**, and **no town ever becomes a city** (`[HC-61]`, `[HC-62]`).
- **No place gains a stored field for a failure state** (`[HC-66]`).
- **A place razed to nothing never recovers**, across the remainder of the run (`[HC-67]`).
- **A ruined place recovers only after a dispatch arrived** — never on its own, never incrementally.
- **A military settlement out-garrisons a civilian town of at least twice its population**
  (`[HC-59]`).
- **No neutral place is ever promoted** (`[HC-65]`).
- **No place's purpose ever changes** (`[HC-56]`).
- **A one-season spike never promotes anything** (`[HC-63]`) — checkable by seeding a single freak
  harvest.

---

## §10. S6 — The ledger

**This is the one system that already exists.** [`town-economy.md`](town-economy.md) is its spec and
runs to a thousand lines; this section does not restate it. It answers one question only: **what
changes when the ledger stops being a standalone thing and starts being driven from outside?**

### How it works

#### §10.1 What does not change — and this is most of it

The ledger's core survives untouched, because it was built to be driven from outside:

> **A place stores three numbers — population, wealth, prosperity — plus a list of named works.
> Everything else is derived, every tick. The ledger is the simulation; the map is a projection of
> it.**

Also unchanged: prosperity stays *stored* because it must **lag**; the causal chain (land → works →
population → yield → wealth → prosperity); the governor's **five-term auction** and the rule that
**the explanation is the score**; the **hamlet floor**; the works **devolution ladder**; the
footprint; and the four-sentence player read. **`[HC-70]` None of these is reopened by the world
layer.** If a world-layer change appears to require touching one, the change is wrong.

#### §10.2 Inversion of control — the one architectural rule

**`[HC-71]` The world drives the ledger; the ledger never reaches out.** A place is a pure function
of its own state plus a closed set of inputs handed to it. It never queries the world, never asks its
neighbours anything, never looks up a nation. Everything it needs arrives as an argument.

This is what makes `[HC-7]` (global clearing), `[HC-11]` (reproducible history) and `[HC-15]`
(nothing pairwise) achievable at all. It is also already how the shipped module behaves — the
inversion is a constraint to *preserve*, not a refactor to perform.

#### §10.3 The closed list of external inputs

**`[HC-72]` A place accepts exactly these inputs from the world, and no others.** A closed list, so
nothing downstream has to guess:

| Input | From | When |
|---|---|---|
| **The day, and whether a season turns** | S1 | Every tick |
| **Its land** — coastal bearing, and what the ground bears | S2, at generation | Once |
| **A seasonal yield modifier** | S3, accumulated | Season, phase 1 |
| **Damage events** on named works | S3 | The day they happen |
| **Its faction, and whether that faction is at war** | S4 | On change |
| **An arriving dispatch** — coin, garrison, or charter | S4 | The day it lands |
| **Cleared trade** — what it sold, what it bought, at what prices | S7 | Season, phase 2 |

Anything a place seems to need that is not on this list is a design error somewhere else. **Adding a
row is a decision, not an implementation detail.**

#### §10.4 What the world layer changes, field by field

| Field | What happens to it |
|---|---|
| `archetype` | **Retired as a taxonomy.** Build priorities move to purpose, sprawl temperament to funding (`[HC-55]`, §9.2). |
| `parcels[]` / the land | **No longer rolled by the town.** Cut from the world map at its position (`[HC-19]`, `[HC-28]`). |
| `seed` | **Derived from the world seed**, not independent (`[HC-10]`). |
| `patron` / `investment` | Reframed: a standing commitment whose money **arrives as a dispatch** and is credited on arrival (`[HC-45]`, `[HC-46]`). |
| `tier` (`outpost/town/capital`) | **Renamed** — it measures garrison hardness, not size class (`[HC-60]`). Size class is a separate, stored axis. |
| `chronicle[]` | Unchanged in shape, and now the natural home for every stated reason `[HC-16]` produces. |
| `population`, `wealth`, `prosperity`, `works[]` | **Untouched.** |

#### §10.5 The sea-lies-south invariant survives — as a drawing convention

**A correction to an earlier reading, which had this dying outright.** `town-economy.md` §2.7 states
the invariant's purpose in its own words: **"The invariant is about readability, not geography."**

**`[HC-73]` The world holds a place's TRUE coastal bearing; the town's local views are drawn in a
local frame whose south is seaward.** So both things hold at once:

- **What dies:** any code that *generates* a town's land facing south independently of the world. The
  world decides the coast now (`[HC-19]`).
- **What survives:** the hex map's and ground plan's convention that **open water lies in the
  southern arc and the raid map's landing edge is the near edge.** That was always a presentation
  rule, and a rotation into a town-local frame preserves it exactly.

This is materially less rework than "the invariant dies" implied, and it keeps a readability rule that
was ratified for good reasons.

#### §10.6 Two hazards inherited, and now sharper

Both are already recorded in `town-economy.md` §3.5.8; the world layer makes them arrive sooner.

**`[HC-74]` `prosperityTarget` must stop scoring `surplus/head` positively.** A place fed from the
sea has negative surplus *by design*, so every large town reads as "on its knees" the moment imports
exist. Replace that term with **dependency as a mild negative**. Mild matters — see `[HC-79]`.

**`[HC-75]` Watch for the oscillation failure mode explicitly, over centuries.** A place outgrows what
its exports fund → coffers empty → food unbought → population falls → regrows → repeats. Population
drift should damp it, and a two-hundred-year run is the first thing that can actually prove it does.
**This is a named acceptance test, not a hope.**

### How it impacts the game

Nothing directly, and that is the point: the ledger has no player surface at all. Its output is
**prices and prose** — the market that tells you a storm took this town's quay two seasons ago, and
the four sentences that tell you what a place is. Everything a player ever learns about a town is a
shadow of these three numbers.

### Engine or mechanic

**Engine, and the purest one in the game** — pure functions over a plain struct, testable headless.
This is exactly the property the ratified Vitest decision exists to protect, and the reason the
parked suite has to come back before fifty of these run for two centuries.

### Acceptance criteria

- **No place ever reads world state directly** (`[HC-71]`) — enforceable by the shape of the call.
- **A place's whole season can be reproduced from its own state plus the seven inputs**, with nothing
  else consulted.
- **A large import-fed town does not read as failing** (`[HC-74]`).
- **No place oscillates with growing amplitude across two hundred years** (`[HC-75]`).
- **A town's local map agrees with its world position**, and still draws water to the south
  (`[HC-73]`).

---

## §11. S7 — Needs & trade

The last core system, and the one the whole build order ends on: **world → weather → trade.**

### How it works

#### §11.1 The one drive

> **Every place tries to be as self-sufficient as it can. Trade is what covers the gap when local
> supply cannot keep up.**

**`[HC-76]` One universal drive, with no threshold anywhere.** Not *"small places are independent,
big ones dependent"* — the same rule everywhere, and what differs between a hamlet and a city is only
**which needs they fail to cover locally.** A hamlet feeds itself easily and cannot make its own
tools; a city cannot feed itself at all and produces luxuries. Both are obeying one rule and failing
at different heights.

#### §11.2 The pyramid, and its gate

Three classes, ratified: **victuals** (population) · **materials** (construction) · **luxury** (the
top).

**`[HC-77]` A place reaches for a tier only once the tier below is secure. This gate is what makes it
a pyramid rather than a list.** Mechanically it is not a modifier — it decides whether a demand
*exists at all*: a place short of bread registers **no** demand for materials or luxury, however rich
it is.

**`[HC-78]` Imports are paid before construction — bread before batteries.** This is what produces
the good failure state: *"they spend all they make on corn."*

**`[HC-79]` Luxury is a need with teeth, not a second prosperity meter.** A place with victuals and
materials covered wants luxury and **goes short without it** — that is why it was restored. But its
weight on prosperity stays **mild**, or the original objection (it duplicates prosperity) comes back
and every well-fed town reads as miserable for want of silk.

**`[HC-80]` Luxury is trade cargo, never the default plunder payout.** A raid does not pay out in
jewels because jewels exist in the economy.

#### §11.3 Purpose and the wish for a farm

Q7's answer — *"an outpost's growth will always just be shaped by its purpose"* — is implemented at
the **governor**, not at the scoring.

**`[HC-81]` Dependency is scored identically for every place, whatever its purpose.** The ratified
load-bearing line survives verbatim: **importing never silences the wish for a farm.** An outpost
registers high dependency and its clause still reads *"too much of their bread comes off a ship."*

**What purpose changes is what the governor may do about it** (`[HC-58]`): a farm is simply not in a
military settlement's vocabulary, so **the wish stays visible and permanently unfulfilled.** That is
the cheaper of the two readings, it needs no per-purpose scoring, and it preserves more ratified text
than the alternative — which would have required rewriting the line §3.5.4 calls load-bearing.
*Flagged as the manager's reading of a free-text answer; overrule freely.*

Consequence already ratified: **an outpost buys its victuals with the crown's grant, so the grant is
its population ceiling.**

#### §11.4 Global clearing — how `[HC-7]` actually works

The design problem: clear trade among fifty places, every season, **order-independently** and
**without comparing every place to every other place** (`[HC-15]`).

**`[HC-82]` A market is a NEIGHBOURHOOD, not a pair.** Each place belongs to a small, fixed set of
overlapping market neighbourhoods, computed **once at world generation** from distance — positions
never move, so this is never recomputed. A neighbourhood holds a handful of places, not fifty.

**`[HC-83]` Clearing is summation, per neighbourhood, per class, in tier order.** For each
neighbourhood: total what is offered, total what is sought, allocate pro-rata, and let the ratio set
the local price. Tier order is what implements `[HC-77]` — victuals clear first, and a place's demand
for the next tier is registered only if the previous one came out satisfied.

Three properties fall out, none of them bolted on:

- **Order independence** is automatic, because sums commute. `[HC-7]` is satisfied by construction
  rather than by discipline.
- **Cost is linear** in the number of places. The square-law trap is avoided structurally.
- **Prices are genuinely local**, because each neighbourhood clears on its own ratio. **The ratified
  ban on an omniscient cross-town price table survives** — there is no global price to table. You
  learn a price by going there, or by bribing the harbourmaster.

**`[HC-84]` War is a per-faction filter on the pool, never a per-place one.** A place draws only on
supply from factions it is not at war with. There are five crowns and the neutrals — a constant
handful — so eligibility is a small fixed mask and clearing stays linear. **This is how a war is felt
in a town that never sees a soldier**, and it is the largest economic effect war has.

**`[HC-85]` `access` gates participation in both directions.** No quay, no security → nothing moves
either way. It is the multiplier a blockade and a burned quay both act on, which is why raiding and
trade are the same mechanism seen from two sides.

#### §11.5 "The shipping" is dead

**`[HC-86]` Trade is written against real named neighbours from the first line.** The specced abstract
partner existed only so the engine could be built before the world was; the world arrived first, so
the abstraction is now pure cost. `priceOf` reads a neighbourhood; `access` reads real routes and
blockades. **Do not build the placeholder.**

#### §11.6 The fragile ceiling

Bought food lifts the old food cap, and the replacement limits are already ratified: **coin ·
access · ground for houses · hands.**

**`[HC-87]` The new ceiling is FRAGILE by design, and ceiling and raid consequence are the same
mechanism.** A trade-fed town of 1,500 falls back toward 450 when its quay burns. Nothing separate
implements "raiding hurts" — it is this.

### How it impacts the game

This is where the world becomes legible. **A price is a town's own condition, readable if you look**
— timber fetches well here because a storm took the quay two seasons ago. It is also what makes the
map matter: two ports far enough apart to disagree about prices and close enough to reach are a trade
route, and that is a decision about distance.

And it is the system that turns a raid into an economic argument: take the coin and it cannot pay for
food; burn the quay and its exports rot on the beach; blockade it and nothing moves. **A rich city fed
from the sea can be starved without a single field burned.**

### Engine or mechanic

**Engine, with a market as its one player surface.** The engine is the clearing; the mechanic is
buying and selling at a local price, and it lives in the port (S8), not here. One rule survives from
the ratified port seam and belongs in this document because it is an engine constraint:

**`[HC-88]` The player's own trades nudge a local price, and the nudge is capped.** He is a small
fish. Uncapped, the first thing anyone discovers is that they can buy out a town — an exploit, and a
betrayal of *the world runs without you*.

### Acceptance criteria

On a headless two-hundred-year run:

- **A place short of victuals registers no demand for materials or luxury** (`[HC-77]`).
- **Clearing is order-independent** — shuffling the iteration order of places produces identical
  results. This is the single most important test in the document.
- **Prices differ between neighbourhoods** for the same good, persistently (`[HC-82]`).
- **Cost scales linearly** with place count — doubling the places roughly doubles the clearing time,
  never quadruples it.
- **A war measurably impoverishes towns on both sides that never saw fighting** (`[HC-84]`).
- **Burning a quay drops a trade-fed town back toward its local food cap** (`[HC-87]`).
- **An outpost's dependency reads high and its clause still asks for a farm** — and it never builds
  one (`[HC-81]`).
- **No omniscient price table exists anywhere in the running system.**

---

## §12. The core is specced

All seven core systems are now written. **What remains is not core:** S8 the port, S9 raiding, S10
officers — the player's systems, to be specced once this runs.

**Eighty-nine hard constraints.** The ones most likely to be broken by accident, and worth re-reading
before writing any code:

- **`[HC-10]`** randomness derived, never consumed in traversal order — silently rewrites history.
- **`[HC-7]` / `[HC-83]`** trade clears globally, by summation — order dependence is invisible until
  it isn't.
- **`[HC-12]` / `[HC-26]`** a ring is never a simulation boundary.
- **`[HC-33]`** effects read sampled severity, never "a storm happened here".
- **`[HC-48]`** a war ends when will breaks — the one spine, not a body count.
- **`[HC-71]`** the world drives the ledger; the ledger never reaches out.

**`[HC-89]` The milestone is done when a century reads as plausible and every change in it has a
nameable cause.** Not when it is fun. Fun is three systems that are not in this document.
