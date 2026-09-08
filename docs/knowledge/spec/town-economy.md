# Town Economy — Living Towns

**Layer:** WHAT (tool-agnostic) · **Scope:** land / strategic · **Authority:** human edits win.

*What a town **is**, how it grows and decays on its own, and how its ledger becomes a raid map.
Ratified 2026-09-07 — see [`../decisions.md`](../decisions.md). Comparables and the
ADOPT/ADAPT/REJECT reasoning live in [`design-references.md`](design-references.md). This spec
must not contradict [`../../design-doc.md`](../../design-doc.md) §1.1, §7.1, §7.3.*

---

## 0. The one rule everything follows

> **The ledger is the simulation. The map is a projection of it.**

A town is simulated at **province-abstraction** resolution: three stored numbers plus a list of
named **works**. **Buildings are not simulated — works are.** A work is a ledger line with a
place attached: *a sawpit, above the creek, working since '54*.

The raid map is a **pure function** of `(town seed, parcels, works ledger, damage state)`. It is
generated on demand, never stored, and always reproduces the same town from the same inputs.

Two consequences that make the whole feature cheap:
- The player never places anything, so **placement can be a grammar rather than a solved puzzle**.
- Every work still has a **burnable building**, so the plunder layer keeps its teeth.

**Two discipline rules, load-bearing:**
1. **No number without a sentence about a place.** If a tracked value cannot be said as a
   sentence, it is not tracked.
2. **No term without a clause.** If a scoring term cannot write its own plain-language reason,
   it may not be added.

---

## 1. The town entity — what must persist

| Field | Meaning |
|---|---|
| `id`, `name` | Identity. |
| `archetype` | `colony` · `royalOutpost` · `pirateHaven` (first slice). |
| `patron` | Who funds it — a crown, a company, the player, or none. May be a **non-owner** (the hook for investing in towns you don't control; no player verb yet). |
| `founded` | Year, for the chronicle. |
| `seed` | Fixes the founding roll and the map projection. |
| `parcels[]` | The land ring — see §2. **Immutable after founding.** |
| `population` | Souls. The hands that man works and the mouths that consume. |
| `wealth` | Coin and goods **on hand, now**. What construction spends and what a raider steals. |
| `prosperity` | 0–100 **lagging condition** — the smoothed verdict on the place. |
| `works[]` | The ledger — see §3. |
| `governor` | The post-holder, or none. An installed officer carries his own weights (§5.3). |
| `investment` | Standing coin-per-season commitment from the patron (§6). |
| `chronicle[]` | One clause per notable event, **including the player's raids**. |
| `labour` | Population composition, incl. bonded labour where the archetype has it (§8). |

### Derived every tick, never stored

Storing these would let them drift out of step with their explanation.

| Derived | From |
|---|---|
| **Yield** | works production − population consumption + trade margin. "How well the town is doing" as a *flow*. |
| **Security** | defensive works (battery, palisade, barracks, watchtower) + patron support. **Eventually replaces the hand-set `SettlementTier`.** |
| **Needs** | ~5 unmet-need scores — food, drink, shelter, worship, order. Governor inputs only; **never a bar the player tends**. |
| **Tier** | `outpost` / `town` / `capital`, from population + security + patron. |

### Why prosperity is stored when it is nearly derivable

Prosperity is *almost* a function of yield-per-head. It is stored anyway because **it must lag.**
Torch a warehouse and yield falls this instant; prosperity — and so migration, patron confidence,
and the world's opinion — should sag over *seasons*. Without the lag the town whipsaws and reads
as a spreadsheet rather than a place.

### The causal chain, in plain language

> The land decides what the town *could* be. **Works** turn land into goods; each needs a parcel
> of the right kind and hands to man it. **Population** supplies the hands and eats the food.
> **Yield** is what's made minus what's eaten, plus the margin on what ships out. Yield piles up
> as **wealth**. The governor spends wealth on the next work — and a raider steals it.
> **Prosperity** is the slow verdict on all of it: high, and people come and the governor grows
> ambitious; low, and they drift away and he builds nothing but sheds.

### What the player reads — four sentences, no audited numbers

> **San Bartolomé** — a timber town of 640 souls, thriving.
> Coffers heavy. Cuts planks and burns lime; buys corn and cloth.
> A stone battery on the bluff, forty men under a fair sergeant.
> *Founded on salt in '41 · burned by the Dutch in '58 · rebuilt on timber.*

---

## 2. Parcels — the land gives a town its identity

**Exactly 6 parcels in a hex ring around the town site** *(amended 2026-09-08 — was 6–9)*. Not a
grid; not a tag list. Each parcel:

| Property | Values |
|---|---|
| `terrain` | one of the kinds below |
| `quality` | `poor` · `fair` · `rich` |
| `bearing` | one of six flat-top hex directions: **N · NE · SE · S · SW · NW** |

**`bearing` is the load-bearing field.** It is what turns an economic fact into a place on the
raid map (§7). Without it a parcel is just a number.

### The hex ring — draw 19, simulate 7

The land is shown as a hex flower, and **one hex = one parcel, never subdivided**. That rule is
the anti-dilution guarantee: the old objection to a Civ grid ("many tiles average out") is a
property of *grain*, not of hexes.

| Ring | What it is |
|---|---|
| **Centre (1)** | **The town itself** — the built-up area. Load-bearing: one centre hex = one raid map (§7.5). |
| **Inner (6)** | **The parcel ring.** Each hex is one `Parcel`. This is the whole simulated economy. |
| **Outer (12)** | **Hinterland** — drawn, `sea \| land` only, no data. It makes the map read as *country* and holds the deferred tail (roads, neighbours, annexation). |

**Flat-top hexes, deliberately:** their six directions drop E and W but **keep N and S**, so the
ratified "the sea lies south" invariant survives. Pointy-top would have broken it.

### Dead hexes are where the variety went

Fixing the count at 6 removes a source of variation, and it is replaced by a better one:
**`marsh` · `scrub` · `openSea` are drawn, terrain-typed, and yield nothing.** A town with three
dead hexes has a **visible** ceiling — *"poor ground on three sides"* — where a parcel count was
invisible. `marsh` pays twice: economically dead, and a defensive gift (no palisade needed that
side, slow going for a raider).

### The six kinds (first slice)

| Parcel | Gives | Also |
|---|---|---|
| **Timbered hills** | timber | high ground |
| **Cane flats** | sugar → rum | labour-hungry, hot money |
| **Provision grounds** | food | the labour ceiling |
| **Reef & fishing banks** | food (small, cheap, always) | the subsistence floor |
| **Sheltered roadstead** | trade access | careenage, shipways, quay |
| **Bluff / headland** | — | the battery's home; commands the harbour |

Plus the three **dead** kinds above — `marsh` (pulled forward 2026-09-08), `scrub`, `openSea`.

*Deferred:* tobacco slopes · salt pans · quarry & lime.

### The founding roll is BIASED, not uniform

Draw **one dominant vocation parcel at `rich`**, one or two supporting, the rest filler or `poor`.
Uniform random produces towns that are all mediocre at everything — the difference between "towns
with slightly different numbers" and "towns you can describe in a sentence".

**Acceptance:** three towns rolled from these rules must each be describable in one distinguishing
sentence, e.g.
- *Cane and rum on the flats, no harbour to speak of* — fat, soft, huge haul, thin militia.
- *Timber and shipways under a bluff battery, poor land, feeds itself off the reef* — poor, hard,
  and you'd rather **take** the shipways than burn them.
- *Salt and fish, three hundred souls, a crown battery and nothing worth stealing* — a hard,
  worthless target. **Some towns should not be worth raiding.**

### Parcel scarcity IS the growth cap

Once the timbered hills carry their sawpits, more lumber money buys no more lumber. **Cap and
flavour are the same mechanism** — no arbitrary limits are needed.

### Who may write to the land — three states

*Amended 2026-09-08. The original rule reserved the right to reopen this ("possibly steerable
later… not without explicitly reopening the decision"); it is hereby reopened.*

| State | When | What you may do |
|---|---|---|
| **Read-only** | a foreign town you have bought no one in | Nothing — and you cannot even *see* the ring until you have paid a clerk (§6). Prose only. |
| **Steerable** | your own governor, or a bought arrangement | Lean the town **thematically** — one focus, and optionally one named production line (§5.8). Never a hex. |
| **Grantable** | a haven **you own** | Additionally: **grant the ground** — say what a hex is *for*, once (§7.6). |

**Still forbidden everywhere:** tile improvement, worker allocation, re-founding, and choosing
where a building stands. **You may choose what a piece of land is FOR; never where a building
STANDS.**

## 2.5 The footprint — the ring is fixed, the town spills over it

*Added 2026-09-08.*

> **The land a town works is fixed at founding. What grows is how much of it the town has built
> over.**

A hamlet of forty and a port of nine hundred must not occupy identical ground. The **economic**
grain stays coarse — six parcels, unchanged — while the **spatial** grain goes fine on the
**footprint**, which lives on the `Town`, never on the `Parcel` (so "parcels are immutable after
founding" survives verbatim).

| Field | Values |
|---|---|
| `core` | `scattered · settled · close-built · packed · stone-built` |
| `spill` (per bearing) | `clear · skirts · suburb · absorbed` |

~30 footprint states, and **no new simulated entities**. Encroachment draws as a **lobe biting
into the inner edge of a ring hex** — never a sub-hex, never a hexagon. *A hex is one parcel; the
town's built-up ground may lie over part of a parcel without dividing it into two.*

> **Rejected: the tract model.** Grouping many small hexes into ~6 economic tracts buys no
> information (identical sub-hexes say what one hex says) and reopens an in-tract placement
> question the do-not-build list bans. Recorded so it is not re-proposed.

### The pressure, and the relief

Every work has a `zone`; everything not `beyondThePale` stands **inside** the town, and `dwellings`
already auto-raises one per 40 souls — so population drives the pressure through machinery that
exists. **Crowding = in-town works ÷ room.**

Relief runs in strict order, and step 1 before step 2 **is** "builds inwards-out":

| # | Relief | Cost | The clause |
|---|---|---|---|
| 1 | **Densify** — the core rises a grade | free at low grades; **wealth** for stone and storeys | *"they build close now, and in stone"* |
| 2 | **Spill** one step on the best unenclosed bearing | free, but **it eats that hex's capacity** | *"the town has spread up toward the sawpits"* |
| 3 | **Spill outside the wall** — a faubourg | free, and **undefended** | *"there are houses outside the gate now"* |
| 4 | **Nothing** | the `shelter` need goes unmet, prosperity sags | *"there is nowhere for this place to go"* |

### Which way it grows

Dead **scrub** first · **the water** · **its own industry's bearing** · **provision grounds / cane**
reluctantly · **the bluff** last · **never marsh, never open sea**.

**Dead ground now pays a third time** — the economic ceiling, the defensive gift, and now the
release valve. A town with scrub to the north sprawls north for a century and keeps every good
acre; a town ringed by rich cane must eat its cane to grow.

**It grows lobes, not rings**, because the order is strongly ordered, dead ground breaks the
symmetry, and a wall holds one side rigid while the other sprawls.

### Absorbed ground is permanent

Build over the cane and the cane is gone: an `absorbed` bearing is removed from `roomFor` and its
works idle. **`skirts` and `suburb` are drawn and read but not simulated** — only `absorbed`
touches the ledger, which keeps the change a legible event rather than a numeric bleed. The one
exception: a town that reaches `Abandoned` and is later re-founded rolls its footprint back to
nothing and keeps its parcels.

**The footprint never retreats.** Collapse leaves derelict ground, then ruins.

### Walls shape growth; they do not stop it

The wall is the existing `palisade` work plus a `circuit: Bearing[]` recorded when raised.
**Built segment by segment, landward first — an unfinished circuit is normal**, not exceptional.
**No build timers; expense is the pacing** (§1.1). Nobody new decides: the five-term auction
already produces this from `fear` + the patron's agenda.

**A wall is never demolished by decision.** Outgrown and unthreatened, it goes unmaintained → idle
→ decayed → **ruin** on the existing ladder, and a ruined trace running through built-up ground is
a first-class raid feature.

### The four limits — none of them a number

**Food** (you cannot house more mouths than the land feeds) · **ground** (marsh and open sea refuse
houses) · **stone** (densifying above `close-built` costs wealth and has a ceiling) · **purpose**
(an outpost does not want to grow).

> **Growth eats its own cause.** Every quarter the town takes is capacity it loses.

### It must read at a glance

| | Colony | Royal outpost | Pirate haven |
|---|---|---|---|
| Sprawl | **eager** | **refuses** — its boundary is the *stipend*, not the wall | **ragged**, worst ground first |
| Wall | rarely, late, outgrown | **always, first, stone, maintained** | palisade and battery; never a circuit |
| At a century | a fat irregular lobe with an old wall stub inside it | **the same outline as year 25, only darker** | a big untidy smear, no circuit |

An outpost whose stipend is pulled shrinks, rots its wall, and *only then* sprawls — a fishing
village living in a ruined fort.

**Known risk:** the footprint is gated on population being able to grow, and the current food model
caps a colony near **~450 souls**. Calibrate thresholds to that band; **do not** pull grain-buying
forward from the trade tail to make this work.

---

## 3. Works — the ledger

A work has: `kind`, the `parcel` it draws on (if any), a **zone** and **bearing hint** for
placement, a footprint, `since` (year), and a condition on the devolution ladder.

### Two classes, and the distinction is the anti-spiral floor

- **Subsistence works** — dwellings, fishing shacks, garden plots. **Cost no wealth.** People
  rebuild their own houses and food. This is why a sacked town always crawls back to a hamlet.
- **Capital works** — shipways, boiling house, stone battery, warehouse, customs house. Need
  **money or a patron**. These are what investment unlocks.

### Scale

~12 **choosable** works (what the governor picks between) + ~6 **automatic** civic/defensive ones.

### Exactly two dependency edges in the first slice

`sugar → rum` and `timber → shipways`. One level only. Burn the sawpit and *"the shipways stand
idle for want of planks."* That is a production chain the player can feel and we never have to
simulate.

### The devolution ladder

Works decay in **recoverable grades** — `working → idle → decayed → ruin` — not straight to
death. Each step is legible and each is reversible.

---

## 4. Damage — what raiding actually does

**Loot and raze must do different things**, or pillage-vs-raze is a flavour choice.

| Raid action | Effect | Recovery |
|---|---|---|
| **Loot** a building | Takes a slice of **wealth**. The **work survives**. | Fast — 2–6 seasons of yield |
| **Torch / raze** a work | **Removes the ledger line.** Yield falls permanently until rebuilt; the work re-enters the wants-list with a *"since the burning"* bonus. | Years — or never, if the wealth to rebuild is gone |
| **Raze dwellings** | Population loss + bounded flight | Slow; some refugees drift back |
| **Raze battery / barracks / palisade** | Security down → **garrison tier down → the next raid is easier**; trade confidence falls | Only if the patron pays |
| **Break the town's will** (extort / tribute) | Prosperity hit, **no works lost**, a fear/resentment mark | Fast |

### The golden goose — the decision this feature exists to create

Raid the same town twice and it is visibly **poorer *and* easier** — until it is worthless.
Occupy it instead and it grows **richer and harder** for someone else to take.
**Pillage / raze / occupy stops being a menu and becomes an economic argument.**

### Four floors against the death spiral

1. **The hamlet floor** — subsistence works cost no wealth (§3).
2. **The patron backstop** — archetypes with a crown behind them get relief after a sacking. The
   funding model and the anti-spiral are deliberately the *same system*.
3. **Bounded flight** — population outflow capped per event; a share of refugees return once quiet.
4. **Ruin is reachable but only deliberately** — prosperity 0 + no patron + N seasons →
   **Abandoned**, rare and memorable. Patroned towns trigger a **refounding** instead, so raze
   keeps its teeth without the map bleeding out by accident.

---

## 5. The development plan — what the governor does

### 5.1 The five-term auction

Every choosable work is scored by exactly five named terms. **Wealth is not a term** — it is the
budget gate. The score decides *what the town wants most*; wealth decides *what it can start now*.

| Term | The clause it writes |
|---|---|
| **The land calls for it** (parcel affinity) | *"the hills are timbered"* |
| **The town wants it** (unmet need) | *"the men have nowhere to drink"* |
| **The market wants it** (export demand / an idle downstream work) | *"the shipways want planks"* |
| **Fear** (security deficit vs. recent threat) | *"since the burning, the town wants guns"* |
| **The patron's agenda** (crown / company / **you**) | *"the Governor of Cartagena wants a customs house here"* |

### 5.2 The explanation IS the score

The one-line reason is **assembled from the top two contributing terms** — never written
separately, never a rationalisation after the fact:

> *The governor sets sawpits above the creek — the hills are timbered and the shipways want planks.*
> *Sarmiento raises a stone battery on the bluff — since the burning, the town wants guns.*
> *Quartermaster Roche throws up a careenage in the cove — your ships need somewhere to heel, and there is money for it.*

### 5.3 The wants-list contract — inspectable, not controllable

The town publishes **what the governor wants next, three deep, with reasons**:

> *A rum still on the flats · a battery on the bluff · a second warehouse on the quay.*

Raising investment visibly **reorders and lengthens** this list. **This is the standalone
module's demo.**

### 5.4 Governors vs. officers plan differently

A **governor** is a post: he weights town needs and revenue. An **officer you install** brings his
competence and temperament as weight modifiers:

- **Sailing Master** → harbour works (careenage, ropewalk, shipways)
- **Master Gunner** → battery and magazine
- **Quartermaster** → warehouses and the market
- **Ambitious / greedy** → the fattest export work, and **underbuilds defence**
- **Loyal caretaker** → slow, cheap, safe things

**The development plan is therefore characterisation.** *"Roche is building himself a fine
warehouse and no guns at all"* tells you who Roche is **before** he betrays you — §7.1's
loyalty-vs-competence trade-off made visible instead of asserted.

### 5.5 §7.1's four slots are the agenda term, not a build queue

*Fortify · plantation · lumberyard+shipways · tavern* are the **patron's-agenda weight** for a
haven you own. You set a standing goal; the governor plans within it. The ratified rule and this
system are the same rule.

*Amended 2026-09-08:* those four are superseded as the player-facing form by **one focus** (§5.8).
They survive as *examples of what each focus produces in a haven* — which is what they were always
good at. "A few set-and-forget slots, never a city builder" is unchanged and, with one focus,
**more** true.

### 5.8 The steer — one focus, and optionally one line

**Governing principle: thematic steer everywhere; spatial steer only where you own the ground.**

A town is leaned **one way at a time** — ***guns*** or ***coin*** or ***hands*** *(ratified by the
human 2026-09-08; a priority order and three sliders were both considered and rejected as more
surface for less clarity)*. The focus is *which way*; the **investment slider (§6) is *how much***.
Those two standing commitments are the entire management surface for a town.

| Focus | Biases works with | Gets you | Costs you |
|---|---|---|---|
| **Guns** | `defence > 0` | a **harder** town — security → tier → a deeper garrison | pure sink, no yield, eats hands |
| **Coin** | `trade > 0` | a **richer** town — wealth piles up, a fatter haul | nothing defends it |
| **Hands** | `food > 0` or `serves ≠ null` | a **bigger** town — more souls, more labour, a bigger raid map | eats the labour industry wants; a fat soft target |

**Why exactly these three:** they are the three yield columns on a work (`defence` · `trade` ·
`food`/`serves`). A work's `hands` is its **cost**, not a fourth lever. That is a structural bound,
not a taste call — a fourth focus would need a fourth thing a work can produce.

**Optionally, one named production line** — *the cane · the timber · the wharf · the fields* —
named by its **output**, never by a building, one at a time. Naming a second replaces the first.
**The land refuses what it cannot bear**: ask a town with no cane flats for rum and you get
*"there is no ground for cane here."*

**It renders as a spatial growth front for free.** Every work sits on a parcel with a bearing, so
leaning toward guns puts the battery on the NW bluff and leaning toward coin marches sawpits up
the northern creek. The player never points at a hex in a town he does not own, yet the town
visibly grows a direction.

**Where it lives:** inside the **existing agenda term** — `AGENDA[archetype]` is the base and the
steer is a second voice in the same term. **Still five terms**, and the louder voice writes the
clause:
- *"you have asked for guns above all"*
- *"the Company wants a return on this place"* — the owner outvoting you, which is legible failure
- *"the contador has been paid to see rum out of here"* (§6)

**Three guards keep a steer from becoming a command:**
1. **You bias a category** — never a work, never a hex.
2. **The land still refuses.** No bluff, no battery: you get a palisade and a barracks, which is a
   *worse* defence. The same lever in two towns gives two different towns.
3. **The steer can be outvoted.** Agenda weight is 0.9 of ~5; a fresh sacking doubles `fear` and
   puts guns up whatever you asked for. A steer that can visibly lose is not a command.

...and the labour gate (§5.6) still bites on top: *"you want shipways; there is money and no men."*

### 5.6 He will not raise what nobody can work

**The labour ceiling gates the plan, not just production.** A work the town has no spare hands
for is *wanted* but not *started* — the governor waits. Without this the sim runs a visible
pathology: he raises a shed, nobody mans it, it rots down the devolution ladder, the slot frees,
and he raises it again — forever. (Found by playtest, 2026-09-07: a presidio of ninety souls
built six taverns in sixty years.)

So a want carries two separate gates, and they read differently:
- **affordable** — the coffers can pay for it today. *"saving."*
- **manned** — there are hands spare to work it. *"there is money and no men."*

Both are surfaced on the published wants-list, so the reason a town is *not* building is as
legible as the reason it is.

### 5.7 Cadence

The beat is a **season** (4/year). **The town never prompts.** It reports in prose, in batches,
when you visit or when word reaches you.

---

## 6. Archetypes, funding, and the slider

| Archetype | Funded by | Agenda | Raid character |
|---|---|---|---|
| **Colony** | its own yield + a small charter grant | revenue first, comfort second, **defence last** | the raidable one; defends at `outpost` grade |
| **Royal outpost** | a **fixed crown stipend**, largely independent of yield | fortification, magazine, barracks, customs | **hard to crack, poor to loot** — a target worth declining |
| **Pirate haven** | **your investment** + its own (initially tiny) yield | yours | no charter, no stipend, **no crown relief** |

**The outpost's strategic hook:** the stipend **rises** when the crown is at war or the place is
threatened and **lapses** when the crown is broke or distracted — so an outpost withers. And
**sack it enough and the crown decides it isn't worth the blood and pulls the stipend**: the
will-spine at map scale, expressed through the economy, at almost no cost.

**What makes a haven worth taking:** it turns plunder into **compounding capital** (elsewhere gold
is a stock you spend; here it becomes works that pay forever) · it **fences** what nobody else
will buy · it **builds and careens your ships** (§1.2's golden thread, literal) · it **recruits**,
and grows from **people you bring** (joined prisoners, ex-crew, deserters) · and it is **a thing
you can lose**.

*Deferred archetypes:* **free port / smuggler's town** (the town you *shouldn't* raid, because you
lose your market) · **company factory** (monoculture, big warehouse, tiny population, hired guns).

### The investment slider

**Coin per season, set as a STANDING COMMITMENT** — set once, changed when *you* choose. The town
must **never** prompt you to revisit it. Effects, in order of interest:

1. **It unlocks the shelf.** Low investment → the governor can only afford sheds and fishing
   shacks. Crossing a cost threshold puts a whole *category* in reach (a stone battery, a shipway,
   a boiling house). **The slider changes what kind of town this becomes**, not just how fast.
2. **It changes the plan's shape** — expensive works sit on *different parcels*, so the town grows
   in a different direction, literally.
3. **It hits a labour ceiling.** Money cannot build what there aren't hands for; past that point
   extra coin buys imported labour at a worse rate. A visible, diegetic soft cap:
   *"there is money and no men."*
4. **The read-out is a paragraph, not a curve:** *"at 200/season this becomes a fishing village
   with a battery; at 2000/season, a shipbuilding haven of 900 souls in twenty years."*

### Investing in — and buying — a town you do NOT control

*Shaped 2026-09-08. The rule "**through a conversation with a governor, not a menu**" stands
verbatim; what follows is the shape that conversation takes. Only the **model** ships in the first
slice — the ladder waits for a conversation layer, fame, and officer relationships.*

**You buy a named man, not an outcome.** That is the whole design, and it is what stops this
becoming a universal "buy anything" button.

| Rung | Who | What the coin reaches |
|---|---|---|
| 1 | **A clerk / harbourmaster** | **Information.** The town's ledger, its wants-list, its true garrison — **and the right to see its hex map at all** (ratified: an unbought town shows prose only). |
| 2 | **The contador / factor** | **A production line**, named, for a term. *"There'll be rum out of here by the time you're back."* |
| 3 | **The alcalde / captain of the watch** | **Neglect — the guns focus run DOWNWARD.** The battery goes unmaintained; the watch is thin on a night you name. *You break a town before you land on it.* |
| 4 | **The governor himself** | A **licence** (trade here, careen here) or **standing patronage** (you as a declared non-owner patron — the `owns: false` hook). **Relationship only; coin alone is refused, insultingly.** |

**Coin buys breadth; relationship buys depth.** You can buy a clerk in every port; only a few men
will ever owe you a favour. That is the honest form of "it still plays off the relationship the
governor has with you."

**Two diegetic clocks, no calendar.** An arrangement lapses on the **official's tenure** — men
rotate, die, get promoted — and **suspicion** climbs per town with use. **One standing arrangement
per town**; a second replaces the first.

**It lapses SILENTLY.** You find out when you next look, or when word reaches you (§5.7). **Never a
notification** — a bribe with an expiry wants to become a scheduled prompt, and §1.1 forbids
exactly that category.

**What can go wrong is more than losing the money:** he takes the coin and does nothing (you learn
seasons later — so *his character matters*) · he is **discovered**, your standing with that crown
falls, the town's `order` need spikes, **and the governor raises the guard on his own** — a failed
bribe makes the target *harder* · later: he informs on you, or a rival quietly outbids you.

**Five things that stop it being "buy anything":** you buy a person, and no official sells above
his station — **the ladder is the gate** · **the land still refuses** (parcel gate sits above the
coin gate) · one arrangement per town · coin is the gate but **relationship is the ceiling** ·
suspicion climbs and eventually shuts the town.

### Your own governor, by contrast

| | Your haven | A foreign town |
|---|---|---|
| **How** | You set the focus directly; he is your officer. | One rung, one term, one named man, at risk. |
| **Cost** | Free | Coin + suspicion + standing |
| **Friction** | **Loyalty.** An ambitious governor under-serves a focus he disagrees with, and §7.1's defection pressure is the real bill. He talks back — *"you want guns; I'd rather have the warehouse"* — which is characterisation, not a gate. | Discovery, tenure, being cheated |
| **Spatial steer** | **Yes** — grant the ground (§7.6) | **Never** |

**In one line: ownership is the difference between giving an order and buying a favour.**

---

## 7. Projecting the ledger onto a raid map

The hand-authored `seedTown` layout already encodes the grammar: **sea → beach → quay + warehouses
→ main street → grid of blocks → plaza (church / governor / battery) → barracks → landward wall +
gate.** That axis is the invariant; the generator's job is to reproduce it, varied.

**A four-stage grammar with fixed roles — NOT a general procedural city generator.** L-system and
Voronoi road generators produce plausible cities and *unreadable tactical maps*. Readability is
worth more than authenticity here.

**Stage 1 — the spine (authored, never generated).** Water edge → quay → main street inland →
plaza → landward approach. Every port reads the same way at a glance. This is the readability
guarantee.

**Stage 2 — zones as bands along the spine.** Each work kind has an ordered zone affinity, so
placement is a lookup, not a solve.

| Band | Holds |
|---|---|
| **Waterfront** | quay, warehouses, customs house, careenage, shipways |
| **Lower town** | dwellings, market, tavern, chandler, cooperage |
| **Plaza** | church, governor's / strong-house, gaol, well |
| **Back town** | barracks, magazine, workshops, dwellings |
| **Outworks** | battery on high ground, palisade + gate landward, watchtower |
| **Beyond the pale** | the productive parcels themselves — sawpits, cane fields, boiling house, salt pans, provision grounds |

**Stage 3 — parcel bearings skew everything.**
- **Industry sits on the town edge facing its parcel** — sawpits on the timber side, the boiling
  house on the cane side. Between the town and its land, which is how real towns work and reads
  instantly.
- **The town elongates toward its industry** — a timber town stretches up the creek; a cane town
  sprawls along the flats.
- **Terrain shapes defence** — a bluff gives the battery its home; a marsh landward means no
  palisade there and slow going; a reef constrains the approach, so the boats land in one place.

**Stage 4 — filling.** First slice: **keep the block grid but jitter it** (offset blocks, varied
sizes, a slight dogleg in the main street). Tail: lane subdivision. **Lock the plan format now** —
a list of `{kind, zone, bearing-hint, footprint}` — so either filler can consume it.

### Eight ordering / adjacency rules

1. **The spine is sacred.** The quay-to-plaza street is never blocked and is always the widest gap.
2. **Rank toward the plaza.** Biggest and richest front the plaza; dwellings fill outward; shacks
   at the fringe. *Free consequence: the raid gets a richer-and-harder gradient the deeper you push.*
3. **Dangerous things sit away from people.** The magazine at the edge or on a spur, never on the
   plaza — historically true, and it gives the ratified explosion set-piece room to breathe.
4. **Defence looks outward.** Battery on the highest ground with a sea arc; **barracks between the
   plaza and the landward gate**, so the muster comes *down* at you.
5. **Trade looks at the water.** Warehouses and customs flank the quay; nothing valuable is stored
   uphill from its own dock.
6. **What stinks or burns goes outside** — sawpits, boiling houses, lime kilns, tanneries, on
   their parcel's bearing.
7. **A full zone grows outward.** A prosperous town is literally a bigger raid map — the world's
   difficulty curve generates itself.
8. **Validate foot-connectivity from the quay.** The raid needs it.

### Determinism and ruins

The map is a **pure function** of `(seed, parcels, works, damage)`. Two payoffs: any town's map can
be previewed from the strategic layer, and **razed works regenerate as ruins, not empty grass** —
so the next raid is visibly a burnt town, and **your own arson gives you cover next time**.

---

### 7.5 The land map ↔ the raid map

*Added 2026-09-08. The four-stage grammar above is unchanged; this says how it meets the hexes.*

> **The centre hex IS the town. The four-stage grammar is what happens inside it. The ring hexes
> are the land, and they become the raid map's edges.**

The ledger already splits this way: `sawpit`, `caneField`, `boilingHouse`, `provisionGround` sit
`beyondThePale`; `shipway`, `warehouse`, `customsHouse` sit `waterfront`; `battery`/`palisade` sit
`outworks`; everything else is in the town. **Parcel-works are on the ring; civic works are in the
centre.** The split we need is already there.

**Two rules, both absolute:**
1. **No hex is ever visible in a raid.** Hexes are units of land tenure, not blocks. (This is
   Endless Legend's failure inverted — its districts *are* hexes on the world map, so its cities
   read as hex quilts. Ours never draws one on the ground.)
2. **The hex map is UPSTREAM of the generator, never downstream.** Every raid-map fact must be
   inferable from the hex map; no hex may be inferred from the raid map.

**The generator gains nothing new.** The hex ring supplies exactly three inputs it already takes:
which bearings are water (→ where the waterfront is and how wide), which bearing each work's
parcel is on (→ the stage-3 skew), and which ground is impassable or slow (→ palisade gaps and
approach cost).

**The five fidelity contracts** — write these as acceptance tests:

| # | Contract |
|---|---|
| 1 | **Bearing.** Timbered hills to the north on the map → sawpits at the north edge on the ground, and the ground rises that way. |
| 2 | **Sea-arc.** Which ring hexes are water decides which edge you land on and how wide the waterfront is. |
| 3 | **Count.** *"Sawpits ×3"* on the hex means **three sawpits** on the ground — not "some industry". **Promoted to a REQUIREMENT, 2026-09-08 — see below.** |
| 4 | **Size.** *(amended 2026-09-08)* The raid map's extent is a function of the **footprint**: `core` sets the town's depth, and each spilled bearing adds a quarter **on that bearing's edge**. Population is an input to the footprint, never to the map directly. |
| 5 | **Scar.** A ruin on the hex is a burnt shell on the ground. |
| 6 | **Skirts.** *(new)* A bearing with a suburb has buildings **outside the town proper on that edge** — approach cover, or a landing you can make among houses. A compact town has open glacis on every side. |
| 7 | **Trace.** *(new)* The wall's `circuit` is exactly the bearings that carry a wall on the ground. **An unenclosed bearing has no wall — that is the way in.** A `ruin` wall draws as a broken line *through* the built-up area, not at its edge. |
| 8 | **Faubourg.** *(new)* A quarter grown outside the circuit puts the wall **between the core and the suburb**, so it runs through the middle of the raid map. |

### Work visibility — a requirement, not a contract

**Ratified by the human, 2026-09-08:**

> *"I do however want the town to physically grow. If a new lumber mill is built and I land there
> with my units, I want to see the lumber mill."*

**Every work in the ledger is a building on the ground.** The projection may never abstract works
into "some industry": raise a sawpit in 1663 and the raid map of 1664 has a sawpit standing on that
bearing. This is the sharpest form of *the ledger is the simulation, the map is a projection* — and
it is the reason the ledger stays at **work** granularity instead of collapsing into a development
number.

**Four tactical propositions from one variable:** a compact walled presidio (open ground on every
approach, one gate, a killing zone) · an outgrown walled port (suburbs give cover to the wall, and
a segment they never finished) · a sprawling unwalled colony (no chokepoint anywhere; the
*distance* is the defence) · an old trace through the middle (take the faubourg free, then face the
gate — a two-stage raid the generator gets for nothing).

**The test that matters:** *a player can name the town's approach from the hex map before he
lands.* — "Marsh to the west, so no palisade that side and slow going; bluff north-east with the
battery on it; land on the south beach." If he can say that from the map and find it true on the
ground, the projection works.

### 7.6 Grant the ground — the one placement verb

*Ratified by the human 2026-09-08. **Haven you own only.***

> **You don't place buildings. You choose what a piece of ground is *for* — once per hex.**

Each of the 6 ring hexes may be **granted** to a vocation the land can bear: *"the north hills —
timber." "The bluff — the guns." "The cove — careenage and shipways."* Ungranted hexes the governor
uses as he sees fit. Historically exact: colonial governors issued land patents.

- **Six decisions in the life of a town**, not a recurring one. Inside §1.1.
- **It is not placement.** You pick a purpose for land — a landlord's decision, not an architect's.
  The governor still chooses the works, still writes his reasons, still refuses for want of hands.
- **It cannot be solved into an optimal layout.** A grant has **no spatial degrees of freedom**:
  the hex is where the hex is, terrain decides the shortlist, there is nothing to pack and no
  adjacency to farm. It adds **choice** without adding **solution space** — which is why the
  do-not-build item it amends stays safe.
- **A grant is irreversible without burning what stands on it.** That is what separates shaping a
  place from fiddling with a menu.
- **Grants live on the `Town`, not the `Parcel`** — so "parcels are immutable after founding"
  survives verbatim.

**A seventh grant: "to the town."** *(Ratified by the human 2026-09-08, overruling both the
game-designer and the manager, who recommended refusing it as the thin end of zoning.)* In a haven
you own you may grant a hex **to the town** — opening that ground for the footprint to spread into
(§2.5). It is defensible on the same ground as every other grant: **you are still answering *what
is this land for*, once, irreversibly, from a shortlist the terrain allows.** Zoning would be
repaintable districts; a one-time irreversible grant has no solution space.

**Guards, which are what keep it safe:** haven-you-own only · one grant per hex, ever ·
irreversible without razing what stands · never on marsh or open sea · and **it directs where the
town may spread, never where a building stands** — the sim still places every work, and
`allocateLabour` stays wholly autonomous.

*Deferred:* one or two **"the captain's own"** works — a careenage, a strong-house, a gallows, a
chapel to nobody. Not economic; they are the haven's **face**, they change the raid map's centre
visibly, and they swing fame/infamy or the crew pool. They only pay off once fame exists.

## 8. Population composition — enslaved and bonded labour

**Ratified 2026-09-07 (the human's explicit call): represented, honestly and minimally.**

- A plantation town's population line **says plainly what it is**.
- **Freeing them is a raid outcome with a fame consequence** — squarely in the pirate lineage.
- **Never** a manageable resource. **Never** a tradable commodity in any UI. **Never** a number
  the player optimises.

---

## 9. Extension points into shipped code

Spec-level requirements on the existing land module — *what* must connect, not how:

- **`BuildingKind` gains the new work kinds.** Extend, don't replace.
- **`Building` gains a back-reference to its work**, so raid damage writes to the ledger.
- **`LOOT[kind]` stops being a constant table** and becomes **the town's wealth apportioned across
  its works** — closing the KAN-54 hook end to end.
- **`SettlementTier` becomes derived** from population + security works + patron, replacing the
  hand-set value. *Touches the ratified garrison-tier decision — deferred, flagged.*

---

## 10. Acceptance criteria

1. Three towns generated from the same rules can each be **described in one distinguishing
   sentence**.
2. **Every governor decision prints a legible one-line reason**, assembled from its top two
   scoring terms.
3. A sacked town **recovers to a hamlet without a patron**, and **to its former self with one**.
4. **The same seed always produces the same map.**
5. **Razed works appear as ruins** on the next projection.
6. No town **ever prompts** the player for anything.
7. At most **five surfaced values** per town; everything else is prose.

---

## 11. Slices

### Shipped (KAN-68 → KAN-71)

The entity and season tick · the biased founding roll · the works ledger (12 choosable + 6
subsistence, two dependency edges, the devolution ladder, labour allocation) · the five-term
auction with clause assembly, the published wants-list and the affordable/manned gates.

### The land-map slice (2026-09-08) — four stories, all inside the standalone module

**Board:** hex frame = **KAN-79** · land map = **KAN-80** · grant the ground = **KAN-81** · the
steer = folded into **KAN-72** (not its own ticket — the ratified text ships it with the investment
slider as one standing-commitment panel, and one ticket = one commit). So this list numbers four
stories but the board carries three new keys.

1. **The hex frame (migration).** Six flat-top bearings; parcels roll onto a 7-hex flower;
   `marsh` / `scrub` / `openSea` as drawn-but-dead hexes; the outer 12 as undifferentiated
   hinterland. Retune the growth ceilings, since `roomFor()` now sees fewer parcels.
2. **The land map (render).** The flower: terrain, grade, works standing on it, room left, ruins.
   Capacity **ghosted** on an unworked hex, **solid** once worked. **Replaces** the parcel bullet
   list in the town card — net-zero UI. Numbers on hover only, always with their sentence.
3. **The steer.** One focus (guns / coin / hands) + an optional named line, folded into the agenda
   term with its own clause; the wants-list visibly reorders and the map leans. **Ships together
   with the investment slider (KAN-72)** as one standing-commitment panel — *how much* and *which
   way*.
4. **Grant the ground.** Haven only; 6 one-time grants; irreversible without razing; a granted hex
   biases `parcelFor()` and the agenda term.

No raid wiring, no new economy, one new renderer.

### The footprint slice (2026-09-08, second) — two stories

**Board:** footprint sim = **KAN-82** · footprint render = **KAN-83**.

1. **The footprint (sim).** The `footprint` struct on `Town`; room per core grade and per quarter;
   the crowding measure; the four-step relief order; the growth-preference order with its clauses;
   `absorbed` removing a parcel from `roomFor` and idling its works; the wall as a blocking
   `circuit` on the `palisade` work; the faubourg. One new pure module, one new call site.
2. **The footprint (render).** The centre glyph driven by `core` rather than population;
   encroachment lobes on the inner edge of ring hexes; the wall trace as arcs on enclosed bearings,
   broken where the circuit is unfinished; one caption sentence. Draw radius 3 (37 hexes at ~26px).
   Renderer only.

*Deferred tail:* wall **grades** (palisade → stone → bastions) and circuit **extension** to enclose
a faubourg · neglect-rot of an outgrown wall · densification costing wealth at the high grades ·
outlying quarters on the far ring (Otrobanda) · the raid-map contracts actually honoured (blocked
on the generator existing) · footprint as a `SettlementTier` input · raising the population ceiling
(blocked on the trade epic) · quarter names by nation (*arrabal* / *the liberties* / *extramuros*).

### Migration — what changes, what survives

**Survives untouched:** the whole ledger and sim — `works.ts` (`CATALOGUE`, `raise`, `roomFor`,
`buildable`, `stepWorks`, `allocateLabour`, `devolve`, `unmetNeeds`, `starvedFor`), `sim.ts`
entirely, and `governor.ts`'s five terms, `reasonFrom`, `wants()` and `governorTurn()` with the
`settleFor` hold-out and both gates. Determinism and the seed model are unaffected.

**Changes:** `Bearing` drops `E`/`W` · `ParcelTerrain` gains the three dead kinds · `Town` gains
`focus`, `line`, `grants` (haven only) and `interests` (the bribery hook) · `parcels.ts`
`SEAWARD`/`LANDWARD` become 3/3 and `bearings()` becomes a straight six-way assignment (simpler
than today) · `LAND.min/max` → 6 · `governor.ts`'s agenda term becomes a two-voice blend (~6 lines)
· **new, small and pure:** a `Bearing → axial hex coord` function and a hex renderer, neither
touching the sim.

**Expect `parcels.test.ts` ring-size assertions to move.** Per the testing rules, direction-and-
relationship assertions should survive the retune untouched — if a test breaks on a *count*, that
is rule 2 telling us a constant got pinned.

### The original first slice — for the record

Three stored variables + derived yield/security/needs · the works ledger (~12 choosable, ~6
automatic, two dependency edges) · 6 parcel kinds with the biased founding roll · 3 archetypes ·
the 5-term scorer with clause-assembled output and a published 3-deep wants-list ·
officer-vs-governor weight modifiers (3–4 archetypes is enough) · season tick + a 20-year
fast-forward · the investment slider with a projected-outcome paragraph · **a "sack it" button**
(the decay half is the half that's easy to get wrong — not optional) · town card + chronicle in
prose · **a schematic placement pass** reusing the spine/bands/bearings grammar (a plan that
can't be placed is a plan that's wrong).

### Deferred tail

Lane subdivision / irregular streets · ruins-as-cover · connectivity validation · **wiring the
generated map into the live raid** · free port + company factory archetypes · tobacco / salt /
quarry / marsh parcels · the trade layer proper · **neighbour prosperity diffusion** (cheap; a
burned town drags its whole coast down — could be pulled forward) · resentment / fame–infamy
coupling · the crown's "not worth the blood" stipend withdrawal · investment vs. crew shares ·
derived `SettlementTier`; `LOOT` sourced from town wealth · the devolution ladder in detail ·
migration into your haven from joined prisoners and ex-crew · cheap off-screen approximation for
untouched towns.
