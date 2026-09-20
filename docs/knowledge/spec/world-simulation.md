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
applies the day it happens — ~~a work drops a grade~~ **a work loses a share of its fabric**, or at
the top of the spectrum is destroyed. *Yield* is a **modifier** and accumulates into the current
season's harvest, applied once when the season resolves. A downpour does not reach into a ledger that
has not been struck yet.

> **AMENDED 2026-09-19 — the rule survives; only what the damage path WRITES has changed.** The two
> paths, their separation and the reason for it are all untouched. With the devolution ladder
> deleted (§10.8), damage no longer moves a work down a grade — **it subtracts a share of `standing`,
> a continuous degree**, and the work is put back with coin and time. The tail still destroys, capped
> by `[HC-35]`. **Everything `[HC-6]` was protecting is protected by the same sentence.**

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

> **What this forbids, stated exactly, because "three numbers" was being read too literally.** The
> rule bans **storing a DERIVED quantity** — anything recomputable from the ledger, which could then
> drift away from the sentence that explains it. It does **not** ban a place holding state that
> *arrives from outside*: `grant` was always stored, and so is the cleared-trade block (price,
> allotted, bought, paid), because both are `[HC-72]` input rows rather than ledger derivations.
> Neither holds *stock*, so the ban on an in-town goods inventory survives untouched. The test to
> apply is **"could this have been recomputed?"** — not "how many fields are there?".
>
> **Applied to the two 2026-09-19 directions, which is the best worked example this rule has had.**
> A region's **`focus`** passes: it is a decision that was taken, and no function of the ledger could
> recover it. A work's **`standing`** passes: an event did it, and nothing in the ledger remembers
> the storm — and it *replaces* the `idleSinceDay` the decay clock needed, so the field count does
> not even rise. A region's **depth fails outright** and is therefore counted, never stored
> (`[HC-93]`): it is exactly a derived quantity, free to drift away from the works that explain it.
> **Three fields, one rule, three different answers** — which is what a good test looks like.

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

> **Sharpened by KAN-98, which built it: `[HC-22]` is a FOUNDING RULE, not a check.** The rule that
> makes it hold is *"a place is founded at a population its own ground can feed"* — the class caps
> it, the land decides it, and the smaller wins. Its failure mode is not a crash; it is a **silent
> decline in the first twenty years**, which every other test passes straight through.
>
> **And the honest limit, measured rather than argued.** The shipped ledger settles at **~50–210
> souls** with no trade layer, so a "city" written at 200 souls **measurably shrank to 108**.
> Day-0 places are therefore designated correctly by class but are **young in the ledger**, and a
> 1660s map with cities *already cities* is not reachable until **KAN-99's works and `[HC-87]`'s
> trade-fed ceiling** exist. That is a constraint on KAN-99, not a defect in the generator — and the
> ~80–450 figure in the town's constants is optimistic at day 0.

> **RESTATED 2026-09-16, because the old wording made a ratified outcome impossible.** The founding
> rule as written — *a place is founded at a population its own GROUND can feed* — caps every opening
> population at what its fields grow. A city fed partly from the sea has less food than mouths **by
> design** (`[HC-74]`), so a sea-fed day-0 city could not exist, while §6's *"cities already cities"*
> demanded one. Both sentences were ratified and neither resolved the other.
>
> **The rule is now: a place is founded at a population it can SUSTAIN — from its ground or from its
> quay** — and `[HC-22]`'s twenty-year test is the arbiter, not the founding arithmetic. A day-0 city
> is **450–600 souls** and may read as *fed from the sea*.
>
> **And the twenty-year test itself has to change, because it runs the wrong world.** It steps each
> town alone — no weather, no trade, no clearing — so the cheapest test of the whole generator has
> never met the world the generator now feeds. It must run through the real driver.

**`[HC-22a]` A neutral place must never be DESIGNATED a city.** `[HC-51]` gives neutrals no patron
and `[HC-65]` says a neutral place can never be chartered — so designating one a city at generation
would start the world with an unpromotable great port that the size class cannot explain. *(Found by
KAN-98, where the two constraints only interact at generation time.)*

**`[HC-22b]` Cities and crown seats are ONE decision.** In this period the great ports of this sea
*are* the five crowns' seats, which satisfies `[HC-39]` and `[HC-62]` together and is why there are
exactly five. **And a crown's holdings must interleave with its rivals', never sit in a block** —
strict nearest-seat assignment is degenerate (it left France holding its capital and nothing else),
while reach-weighted assignment gives each crown 5–12 holdings. That interleaving is the
precondition for §8's wars having anything to fight over.

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

> **The WEALTH column is priced against the town's WORKS, not against its treasury. Ratified
> 2026-09-15**, after the seam was wired and the table met a ledger for the first time.
>
> **What was wrong, measured.** The cost was charged as a share of coin on hand. Over 20 years × 50
> places (seed 1660) a place sees **50.3 contact-days a year**, from **6.82 storms averaging 7.4
> contact-days each** — 47.6 of those days are Blows, 2.26 Gales, 0.44 Tempests. At a share of the
> treasury that compounds to **~18.6% of all wealth per year, for ever**: a proportional ceiling on
> wealth wearing the costume of a maintenance cost, and it alone took wealth from 851k to 121k over
> two centuries.
>
> **And it was the wrong fiction.** A broken gate costs what a broken gate costs. Charging a share of
> the coffers means a town with a million pays a thousand times more to mend the same fence than a
> town with a thousand. Priced against the standing works, what varies is **how much fence there is**
> — and a poor town still feels a storm more sharply, because the same bill is a larger share of a
> smaller purse, which is the right way round.
>
> **One reading of the table above, flagged rather than buried.** It gives a Gale **no** wealth cost
> while giving a Blow a *"small maintenance cost"*. Read as an exclusive cost sheet that is
> incoherent — a Gale is at least as windy as a Blow. Read as *what each band is NOTABLE for* it
> makes sense: a Blow is a property nuisance, a Gale is a crop event. The **monotone reading is
> implemented** — a Gale's maintenance cost is at least a Blow's. Overrule it here if that is wrong.
>
> **The yield column needed no such change**, and it is worth saying why the two came out
> differently: ~0.11 per gale-day across roughly three gale-days in a gale works out near the 0.30
> this table asks for. The yield numbers were written per-day and read per-day; the wealth numbers
> were written per-event and read per-day.


**`[HC-34]` Damage moves works down the existing ladder** — `working → idle → decayed → ruin` — one
grade at a time. It never skips to ruin, and it never touches more works than the severity warrants.

> **SUPERSEDED 2026-09-19 — there is no ladder to move down.** The devolution ladder is deleted
> (§10.8, `[HC-99]`). **What replaces it, and it is the same promise in a better shape:**
>
> > **`[HC-34]` Damage subtracts a SHARE OF A WORK'S FABRIC, proportional to the sampled severity,
> > and it never takes more works than that severity warrants.**
>
> **Both halves of the old rule survive, and one of them is now true by construction rather than by
> a check.** *"It never skips to ruin"* used to need a guard — a drop had to be stopped at `decayed`
> so that only the tail could write `ruin`. **A continuous share cannot skip**: a severity that takes
> a fifth of a warehouse takes a fifth of it, and only the tail writes zero. *"Never more works than
> the severity warrants"* is unchanged and still needs its rate.
>
> **And `[HC-33]` is untouched and still wins where it always did:** effects read the sampled
> severity and nothing else. The share subtracted is a function of that number, and no code path may
> know that a storm happened here.

**`[HC-35]` The extreme tail may destroy exactly ONE work PER CONTACT, never a sweep.** This is what
preserves the distinction the human drew: **razing is deliberate and wholesale; the storm is random
and singular.** A town can lose its quay to the sea; it cannot lose its town to the sea.

> **`[HC-35]` SURVIVES VERBATIM, and it matters more now.** With damage continuous, *destroyed* is
> the one thing that is still categorical — the endpoint of the scale, and the only outcome that
> never comes back. The cap that keeps a storm from taking a town is therefore **the whole of the
> difference between weather and a razing**, where it used to share that job with a ladder.

> **Reworded 2026-09-10 from "per event" to "per contact", because the two readings are not both
> reachable.** KAN-90 built this and reported the tension rather than tuning it away.
>
> Per **contact**, the cap is absolute and provable — an exhaustive sweep shows at most one work
> destroyed for every (severity, roll) pair. Per **event** it is not reachable, because a storm that
> lingers gets more than one contact: measured, **25 of 457 destroying (event, place) pairs took two
> works on consecutive days** of the same storm. Never three.
>
> **The only structural fix would be a code path that knows "this event already took a work here" —
> which is exactly what `[HC-33]` forbids.** So the two constraints are in genuine tension, and
> `[HC-33]` wins: effects read sampled severity and nothing else. Lowering the rate to suppress the
> doubles does not work either, because the double rate is proportional to the destroy rate — you
> suppress the whole effect along with it.
>
> **The intent survives intact.** Two works over two days is not "losing your town to the sea": in
> the same 200-year run the single most destructive storm in the world took nine works across its
> entire life and an entire coast. The rule was protecting against a sweep, and there is no sweep.

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
- **Nothing is razed by a sweep.** No single *contact* ever destroys more than one work (`[HC-35]`,
  as reworded). A lingering event may take a second on a later day; it must never take a third, and
  no event may ever level a place.

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

**`[HC-51a]` A neutral place receives no dispatch of SUPPORT, but can receive an invasion.**
*Resolved 2026-09-10, after KAN-105 found the contradiction while building the dispatch.* Three
lines disagreed: §8.7 says the neutral share "can only shrink" (which requires neutral places to be
takeable), the acceptance criteria said *no neutral place ever receives a dispatch* (an arriving
invasion force **is** a dispatch received), and §8.6 makes invasions available "between the
belligerents" (a neutral is never at war). The coherent reading, and the one that keeps all three
rules doing their jobs:

- **Support cannot arrive** — no treasury, no reinforcements, no charter. A neutral has no patron
  (`[HC-52]`) and can never be chartered (`[HC-65]`), so there is nobody to send them. This is what
  the acceptance criterion was actually protecting.
- **An invasion can.** Taking a neutral place is not a war action against another crown, so it needs
  no belligerency — which is precisely *how* the neutral share shrinks, and the only way `[HC-51]`
  is anything but decorative.

**Consequence, named rather than discovered later: this puts the player's own haven in reach of a
crown.** A haven is a neutral place, so a crown may come for it. That is a feature — it is the
threat that makes a haven worth defending — but it means a haven's defences have to matter, and
`[HC-59]`'s garrison model is what will decide whether they do.

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
- **No neutral place ever receives a dispatch OF SUPPORT, expands, or takes a strategic action.**
  *(Narrowed 2026-09-10 — the unqualified version contradicted `[HC-51]`; see `[HC-51a]`.)*
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
| **Ruined** | Sitting on the hamlet floor — subsistence works only, the rest ~~decayed or ruin~~ **hurt or destroyed** | **Only with substantial outside help** |
| **Abandoned** | No people and no works | **Never** |

> **REWORDED 2026-09-19, because the word it used no longer exists.** `decayed` is deleted with the
> devolution ladder (§10.8). *Ruined* still requires **the wreck** — the thing that tells a fallen
> town from a young hamlet that never had more — and the wreck is now **works standing hurt and
> unmended, and ruins on the ground.**
>
> **`[HC-66]` is untouched and is arguably better served.** It stores no failure state, and *"the
> ruins are the memory"* is now literally true: a ruin is permanent, and a work still showing its
> damage seasons later is exactly the human's *"viewing it later still shows the repair process."*
> **What is stored is a work's `standing` — a fact about a building, not a reading about a place**,
> and `[HC-66]` has only ever forbidden the second.
>
> **And the recovery column still works, for the same reason it did before:** `idle` revives for
> free and a hurt work does not. What changed is that the second one is now put right by a **bill**
> instead of by a decision.

> **Two clarifications the implementation needed (KAN-106), because the table as written was not
> quite implementable.** *Abandoned* requires **both** halves of its clause: subsistence works never
> rot, so the huts outlive the people and *"no people"* alone is not it. *Ruined* requires the
> **wreck** — "the rest decayed or ruin" presupposes there was a rest, and it is the only thing that
> tells a fallen town from a young hamlet that never had more. That distinction is load-bearing
> precisely because `[HC-66]` stores nothing: **the ruins are the memory.** An *idle* work is
> deliberately not a wreck — the devolution ladder already encodes this table's recovery column,
> since idle revives for free and decayed does not.

**`[HC-67]` The hamlet floor requires survivors.** Subsistence works cost no wealth, so any place with
people crawls back — which is why *ruined* recovers and why it needs no new field. **Razing to nothing
removes the people, and with them the floor.** That single condition is the whole mechanism by which
abandonment sticks, and it is why `[HC-18]` holds without a sticky flag: there is nobody left to raise
a hut.

> **Sharpened by KAN-106, which built it: the floor is a LABOUR floor, not a food floor.**
> "Survivors" has a number, and the number is **10.91 souls** — `gardenPlots.hands /
> WORKS.labourShare`. A lone survivor does *raise* a garden plot; he cannot **man** it. Below the
> threshold the cheapest food work in the catalogue stands idle, feeds nobody, and the place empties
> on its own. Measured on ideal ground: openings of 1, 2, 4, 8, 10 and 10.5 souls all fall to **zero**;
> 11 and up recover to 27. The mechanism `[HC-67]` describes was already implemented — a constant
> floor of 12 was sitting on top of it, overriding it, and is now deleted.
>
> **And a criterion that fails, reported rather than tuned.** On `poor` food ground one garden plot
> feeds **10.5 mouths** and takes **10.91 souls** to man. A town with nothing but poor food ground
> therefore **cannot sustain the hands that work it**: each step down idles another plot and the
> place spirals to nothing by ordinary decline, which is `[HC-18]` violated. Measured: **163 → 0 in
> about forty years** with no hand laid on it. `fair` (21 mouths) and `ideal` (39) are both stable.
>
> **Latent, not live.** The generator gives every place several food regions plus fishing; 387 places
> across 8 seeds ran 200 years with **0 emptied** and the smallest at 40.6 souls. The old constant
> was *hiding* this, not preventing it. Two candidate fixes, neither taken — see `decisions.md`
> (2026-09-14, second).

> **DECIDED 2026-09-15, and it went live before it was decided.** Wiring the weather seam gave the
> world a shock source, and the latent spiral became a real one: on seed 20260911 a place of 44 falls
> to **0.49 souls**, where the smallest place in the same world without weather is 48.2. `[HC-18]` is
> breached in a shipped world, by decline alone.
>
> **The ratified fix is the second of the two candidates: subsistence hand costs scale with yield, so
> a subsistence food work always feeds at least the hands that work it, on any ground.** Poor ground
> then means a **small surplus** rather than a death sentence.
>
> *Why this one and not "the generator must give every place at least fair food ground":* it makes
> the rule true **by construction** rather than by the generator's good luck, and it leaves world
> generation free to site thin, marginal places — which are worth having. Fifty ports that are all
> comfortably viable is a duller sea.


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
**the explanation is the score**; the **hamlet floor**; ~~the works **devolution ladder**~~; the
footprint; and the four-sentence player read. **`[HC-70]` None of these is reopened by the world
layer.** If a world-layer change appears to require touching one, the change is wrong.

> **AMENDED 2026-09-19 — the devolution ladder is struck from this list, and `[HC-70]` is not what
> struck it.** The ladder was deleted by **the human**, ratifying *"damage has a cause, never a
> clock"* (§10.8). `[HC-70]` says the **world layer** may not reopen these; it has never bound the
> human or the design, and this is the distinction worth keeping sharp — a rule that stops an
> engineer reaching sideways is not a rule that freezes a design.
>
> **Everything else on the list survives**, including the five-term auction, which gains a second
> candidate type rather than a sixth term (§10.7).

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

> **Two 2026-09-19 notes against this, one in each direction.** **(1)** The region focus adds
> **rising returns** on a deepened region, which is an overshoot engine if it is unbounded — so it is
> **capped at the region's area**, and the loop then terminates on the founding roll rather than on a
> constant (`[HC-94]`, town-economy §2.12.5). **(2)** Deleting rot removes a *second*, quieter
> oscillator that was already in the model: poor → neglect → decay → smaller → poorer. Nothing
> degrades from being poor any more (`[HC-99]`).

#### §10.7 The region focus — six constraints

*Added 2026-09-19. The design lives in [`town-economy.md`](town-economy.md) §2.12; what is recorded
here is the constraint set, because this document is where the `[HC-n]` register lives.*

> **A region has a POTENTIAL given by its ground. A FOCUS decides what the town takes off it** —
> `production` or `growth`. **Goods survive; production chains do not.**

**`[HC-93]` A region's DEPTH is how many works stand on its hexes. It is counted, never stored.**
No development integer, no level, no tier on a region. Storing it would break `[HC-14]` (a derived
quantity stored is a quantity free to drift from its explanation) and the ratified work-visibility
requirement (*"I want to see the lumber mill"*) at the same time.

**`[HC-94]` A focus buys CAPACITY, never a multiplier.** Unfocused, a region carries a token work;
focused on production, it may be worked to its free area. **The focused-to-unfocused ratio is
therefore AREA** — the founding roll's own variance. A flat multiplier is rejected twice over: it is
an instant dial, and works store their scaled yields at raise time, so a later flip would silently
fail to re-price everything already standing.

**`[HC-95]` A PRODUCTION focus is set once and never changed. A GROWTH focus locks the moment ground
is actually claimed under it.** *Narrowed by the human 2026-09-19, from an earlier reading that locked
both on being set.*

**Production is structural, not a preference:** the case for reversibility rested entirely on idle
works *rotting* as the reversal cost, and `[HC-99]` deletes rot — so a reversible production focus
would cost nothing to lift and flip back, which is the instant dial the whole direction exists to
avoid. **`[HC-95]` and `[HC-99]` hold each other up and neither is safe to revisit alone.**

**Growth needs no rule of its own, and that is why it is narrower.** It inherits its permanence from
one the model already has: **claiming is permanent, with no exception.** So a growth focus over empty
ground may be redirected — nothing has happened yet — and becomes irrevocable the moment the first
hex is built on, because *that hex* is. The clause writes itself: **"there are houses on it now."**
No new state, no threshold, and the lock lands when something visibly changed rather than when a
governor merely made up his mind.

**`[HC-96]` The focus auction is four-termed — land, need, market, agenda. `fear` is structurally
absent.** **Fear never argues for what ground is FOR.** It is a correct argument for a battery on a
bluff — a work, on a hex, answering a threat — and no land use makes a town safer. A fifth term here
would be defence claiming a fourth home, which `[P-47]` forbids.

**`[HC-97]` A decision about a region that already carries works is scored from THAT REGION'S OWN
GROUND** — `potential × free capacity × local price` — **never from the catalogue's figures for a
kind.** This is KAN-108's kind-versus-instance finding, which **outlived the decision it was made
for**: the mend decision it constrained is gone, and a *deepening* immediately took its place beside
the auction.

**`[HC-98]` A subsistence work is never gated on focus, on depth, or on anything a decision can
withhold.** Gate them and `[HC-67]`'s hamlet floor and `[HC-18]`'s *only a deliberate hand empties a
town* fail together, silently, as a number drifting to zero in a two-hundred-year run.

> **A SECOND EDGE, found by building it (KAN-123) — a subsistence work must not make a region an
> INSTANCE either.** `[HC-97]` says a region that already carries works is scored from its own
> ground rather than from the catalogue, and the natural way to write that filter is *"has any work
> standing on it"*. **Written literally, that is silently wrong**: a garden plot raises itself on
> any ground, so it would take the question of what that ground is FOR permanently away from the
> governor. Measured: it leaves a **median of one unfocused live region per place** — 75 of 213
> across 49 places — which makes §2.12's own acceptance unreachable by construction.
>
> **The rule is *a region carrying a work somebody CHOSE*.** A subsistence work is never chosen,
> never priced and never gated, so it claims no purpose for its ground. The same sentence that keeps
> the hamlet floor alive keeps the focus auction reachable, and both fail the same way — quietly,
> and only in a long run.

#### §10.8 Damage has a cause, never a clock — four constraints

*Added 2026-09-19. The design lives in [`town-economy.md`](town-economy.md) §4, which replaces that
document's devolution ladder outright.*

**`[HC-99]` Damage has a cause, never a clock.** Nothing degrades from being poor, idle or unloved,
and **no work carries a neglect clock**. Works are hurt by **named events** — a storm, a raid, an
invasion — and put back with coin and time. **If a work is worse off than it was, some named thing
did it, and the chronicle can name it.**

**`[HC-100]` Repair is automatic and comes off the top.** The governor never chooses between a repair
and a warehouse. The consequence stays legible without a choice being surfaced: *"Sarmiento builds
nothing this year; the town is still mending."* It sits in **phase 3 (SETTLE)**, after imports and
before the governor decides anything — which **extends `[HC-78]`** from *bread before batteries* to
***bread, then mending, then batteries.***

**`[HC-101]` Raising a work and mending one are the same act, priced and timed by the share of fabric
missing.** Half gone: half the coin and half the time. Wholly gone: the whole of both. A work's
`standing` is a **degree** (0 to 1), not a grade on a ladder; **destroyed is the endpoint of that
scale**, and a work that is not whole does not work. **Every duration is deliberately unfixed** — the
human has tied them to a zoning tile upgrade mechanism that does not exist yet, and per `[HC-90]`
they are a table while this is the behaviour.

**`[HC-102]` A work in hand requires no decision from anyone while it stands unfinished.
Commissioning is the decision; the duration is a consequence.** `design-doc.md` §1.1 bans a
**recurring decision** on a timer — a chore the player services — not the passage of time. **This is
the same shape the world already ratified** in `[HC-8]` (a promotion is decided in phase 5 and
delivered later) and `[HC-45]` (a dispatch is credited on arrival), and it earns the same virtue: a
thing in progress is a thing that can be interrupted.

> **Recorded because it was got wrong once.** Three things were conflated: §1.1's ban on recurring
> *decisions*, the decay clock the human deleted (rejected for making things **degrade from
> neglect**, not for being a clock), and how long work takes (fine, normal, and now required). Only
> the middle one was ever refused.

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

*Added 2026-09-19, for §10.7 and §10.8:*

- **No region stores a number that counting its works would give** (`[HC-93]`). Checkable by the
  shape of the struct, which is the cheapest kind of test there is.
- **Two towns on identical ground with different focuses produce different export classes** — and
  **two towns with the same focus on differently-sized dominant regions produce different depths**
  (`[HC-94]`: the ratio is area).
- **A PRODUCTION focus is never revisited. A region is decided at most twice, and the second decision
  is always the redirection of an unbuilt growth focus** (`[HC-95]`), across a two-hundred-year run.

  > **CORRECTED 2026-09-20, and it was FALSE as written.** This bullet used to read *"no focus is
  > ever set twice on the same region"* — which predates the 2026-09-19 narrowing, and the narrowing
  > legitimises exactly one second decision. **The old wording was not merely stale, it was
  > unachievable:** KAN-123 wrote its test to it first, and the test **failed on an ordinary
  > two-hundred-year run**, because redirecting an unbuilt growth focus happens unprompted in normal
  > play. The replacement is stricter where it matters — production terminal, never a third decision,
  > and the second always a redirection.
- **No place's works get worse without a named cause in its chronicle** (`[HC-99]`). This is the
  single most important test in §10.8 — a rot that crept back in would look exactly like ordinary
  decline until somebody read a chronicle.
- **A place that has been hurt and cannot pay builds nothing, and says which** — the coin limit and
  the time limit write different clauses (`[HC-101]`).
- **A destroyed work never returns**, and its ground is free for a new one (`[HC-87]`: the potential
  is un-burnable, the claim is not).
- **The warm start is RE-MEASURED with build durations in it** before any conclusion is drawn from
  the city band, which was measured without them (`[HC-22]`).

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

> **EXTENDED 2026-09-19, not superseded: bread, then MENDING, then batteries.** Repair is automatic
> and comes off the top (`[HC-100]`), and it sits between the two — after the quay is paid, before
> the governor decides anything. The good failure state gains a sibling: ***"they spend all they
> make putting the place back together."*** The ordering argument is the original one, unchanged:
> nothing may spend coin before the town has bought its corn.

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

**`[HC-87a]` A place's growth appetite is the GREATER of what its own fields feed and what its
cargo revenue can buy bread for — never the sum.** *(Measured on KAN-91.)* Under a sum, every place
on the map wants more grain than it grows, nobody has corn spare, and **the victuals market clears
empty every season: 48 places, 0 sellers.** The max is also §3.5.6's literal formula.

**`[HC-87b]` Materials are wanted by BUILDINGS; victuals and luxury are wanted by PEOPLE.** A place
with nothing raised needs no stone to keep it standing. Keyed to population instead, the standing
bill exists before any supply does and **the whole map deadlocks on day one.**

**`[HC-87c]` The materials build-gate fires at "cannot GET them", never at "is a little short".**
Measured at zero tolerance: the world loses a third of its works and two thirds of its largest town.

> **AMENDED 2026-09-16, built 2026-09-19: a work that PRODUCES materials is not gated by materials.**
> You do not need planks to dig a sawpit. The exemption is derived from the catalogue's own
> `exports: "materials"`, never from a list of kinds.
>
> **The cliff this fixed was at the FIRST capital work, not the second, and the shape of it
> generalises: a bill keyed to what a place has BUILT is zero for a place that has built nothing —
> so its first purchase is free and its second is the real gate.** Worth checking anywhere else a
> charge counts standing works. Measured: **48 of 52 frozen places had spent that one free build on
> a tavern** — the cheapest capital work, buildable on any ground, serving the auction's heaviest
> term — and all 52 had built something that exports nothing. Frozen places fell 52 → 33.
>
> **And a texture correction, because this section's own example is true for a different reason than
> it implies.** *"The shipways stand idle for want of planks"* is carried by the **dependency edge**
> — `shipway requires sawpit` — and not by the materials bill at all. A shipway is only raisable once
> the place is already cutting its own timber, so the bill could never bind on it. Measured:
> **there is not one shipway anywhere in the world at day 0, on any of four seeds.** The sentence
> survives; its mechanism is the requirement, not the gate.
>
> **This did NOT move the city band** (84–834 against a ratified 450–600), and `[HC-69]` got slightly
> worse, because the world's median place rose faster than its cities did. That confirms the next
> ceiling rather than removing it: freeing the first build buys a place its earner, and `[HC-87a]`'s
> cargo-funded appetite then binds.
>
> **FOLLOW-UP 2026-09-19, and it retires this block's own example.** The texture correction above
> records that *"the shipways stand idle for want of planks"* is carried by the **dependency edge**
> and not by the materials bill. **The dependency edges are deleted** with the region focus, and the
> shipway is reclassified as a harbour work — so **the sentence is retired with its mechanism**
> rather than quietly kept. What replaces it is the market term arguing in coin, which §3.5.4 already
> ratified: *"timber fetches well here."*
>
> **`[HC-87c]` itself is untouched** — the gate still fires at *"cannot GET them"* and never at *"is
> a little short"*. **The 2026-09-16 exemption is untouched and re-keys**: *a work that produces
> materials is not gated by materials* now reads off the **produce** (`timber`, `stone`) rather than
> off a work's `exports` column, which is the same single source one indirection shorter
> (town-economy §2.12.13). **One live consequence to expect:** a `shipway` has no produce, so it
> stops being exempt and must be supplied to be laid down. *You do need planks to lay down a
> shipway* — which is the only half of the old chain worth keeping, and the bill keeps it for free.
>
> **And the first-build cliff this block found is worth re-checking after the focus lands**, because
> the shape it generalised — *a bill keyed to what a place has BUILT is zero for a place that has
> built nothing* — is exactly the shape a **focus-gated depth** also has. Measure it; do not assume
> it either way.

#### §11.6 The fragile ceiling

Bought food lifts the old food cap, and the replacement limits are already ratified: **coin ·
access · ground for houses · hands.**

**`[HC-87]` The new ceiling is FRAGILE by design, and ceiling and raid consequence are the same
mechanism.** A trade-fed town of 1,500 falls back toward 450 when its quay burns. Nothing separate
implements "raiding hurts" — it is this.

> **CLOSED 2026-09-16 by KAN-112 — `[HC-87]` is now statable at world scale, and it is measured.**
> *(The paragraph below is kept because it records why it took a story to get here.)*
>
> **`access` is REACH × READINESS.** *Reach* is the share of a place's sea lanes still calling —
> cuttable from outside. *Readiness* is its own quays, its strand and its guns. A **product** is the
> only combination under which both ratified sentences hold: drop readiness and a quayless shore
> trades freely because ships pass, which makes `[HC-85]` false; drop reach and a blockade stays
> inexpressible.
>
> **The demonstration**, on the most sea-fed port each world produced, run 60 years then 40 more:
>
> | seed | at 60y | its own ground feeds | untouched at 100y | waterfront BURNED | **BLOCKADED** |
> |---|---|---|---|---|---|
> | 20260910 | 240 | 182 | 237 | 162 | **122** |
> | 1660 | 293 | 126 | 282 | **282** | **94** |
> | 7 | 257 | 182 | 243 | **243** | **152** |
> | 99 | 237 | 182 | 233 | 175 | **128** |
>
> Under the cordon: access 0.00, offer 0, want 0, earned 0, bought 0 — `[HC-85]` both ways.
> **And the contrast IS the finding:** burning the same port's entire waterfront instead recovers to
> the untouched figure *exactly* on two of four seeds, because the hamlet floor raises the shacks
> again for nothing. Burning is a season's inconvenience; a cordon is a siege. Both are now tests.
>
> **The bug underneath was SATURATION, not arithmetic.** Three free fishing shacks bought 0.9 of the
> scale, so **half the world sat at exactly 1.00 access** — median 1.00 across four seeds. A ceiling
> every place already touches cannot be fragile. The strand is now capped at two berths: however many
> boats are drawn up on the same sand, past that somebody has to build something fire can take away
> for good.
>
> **`[HC-67]`'s scope, made precise by this story and worth carrying:** the hamlet floor raises a
> place's **works** for nothing. It does not, and must not, raise a place's **standing in the world**.
> Free to rebuild fabric, never free to rebuild reach — that line is what makes raiding and blockade
> different acts with different costs.

> **Holds at town scale; NOT yet statable at world scale, and the reason is structural.** KAN-91
> built it and reported the limit rather than claiming the criterion. A sea-fed town of 640 does fall
> below 130 when its quay stops — but **`access` built from works alone cannot express a blockade**,
> because the waterfront works that carry it are *subsistence*: they raise themselves again, free,
> every season (the hamlet floor, `[HC-67]`, working exactly as ratified). Burning them is a season's
> inconvenience, not a siege.
>
> So §3.5.2's *"`access` reads real routes and blockades"* is **not an upgrade — it is the thing that
> makes `[HC-87]` true of the world** rather than of one town. Until it lands, the fragile ceiling is
> a proven mechanism with no world-scale demonstration.

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
- **And pro-rata allocation needs its OWN claim, because the shuffle cannot catch it.** *(Added
  2026-09-10 by KAN-91, which found the gap.)* A first-come-first-served clearing that walks a fixed
  member order is **perfectly reproducible and still wrong** — the lowest id would eat first for two
  centuries and the shuffle would never notice. `[HC-7]`'s stated rationale (history depending on
  iteration order) is **narrower than the rule it protects**: what is actually required is that
  nobody gets served ahead of anybody, not merely that the answer is stable.
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

> **`[HC-93]`–`[HC-102]` were added 2026-09-19** — six for the region focus (§10.7) and four for the
> damage model (§10.8). The count in the line above dates from `[HC-89]` and is kept rather than
> re-arithmetised on every entry; **the register is the numbers, not the total.**

- **`[HC-10]`** randomness derived, never consumed in traversal order — silently rewrites history.
- **`[HC-7]` / `[HC-83]`** trade clears globally, by summation — order dependence is invisible until
  it isn't.
- **`[HC-12]` / `[HC-26]`** a ring is never a simulation boundary.
- **`[HC-33]`** effects read sampled severity, never "a storm happened here".
- **`[HC-48]`** a war ends when will breaks — the one spine, not a body count.
- **`[HC-71]`** the world drives the ledger; the ledger never reaches out.
- **`[HC-93]`** depth is counted, never stored — the development integer is the obvious shortcut and
  it silently breaks *"I want to see the lumber mill"*.
- **`[HC-97]`** a standing region is an instance — scoring it from the catalogue is the second path
  `[P-47]` forbids, and it looks correct right up until the ground is anything but default.

**`[HC-89]` The milestone is done when a century reads as plausible and every change in it has a
nameable cause.** Not when it is fun. Fun is three systems that are not in this document.
