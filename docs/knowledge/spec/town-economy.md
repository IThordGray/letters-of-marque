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

**6–9 named parcels in a ring around the town site.** Not a grid; not a tag list. Each parcel:

| Property | Values |
|---|---|
| `terrain` | one of the kinds below |
| `quality` | `poor` · `fair` · `rich` |
| `bearing` | the compass direction it lies from the town |

**`bearing` is the load-bearing field.** It is what turns an economic fact into a place on the
raid map (§7). Without it a parcel is just a number.

### The six kinds (first slice)

| Parcel | Gives | Also |
|---|---|---|
| **Timbered hills** | timber | high ground |
| **Cane flats** | sugar → rum | labour-hungry, hot money |
| **Provision grounds** | food | the labour ceiling |
| **Reef & fishing banks** | food (small, cheap, always) | the subsistence floor |
| **Sheltered roadstead** | trade access | careenage, shipways, quay |
| **Bluff / headland** | — | the battery's home; commands the harbour |

*Deferred:* tobacco slopes · salt pans · quarry & lime · marsh/mangrove (a **defensive** asset —
no palisade needed on that side, slow going for a raider).

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

### The parcel map is READ-ONLY

An autobiography that explains the town, never an input device. No tile improvement, no worker
allocation, no re-founding. *Possibly* steerable later by a governor-directed nudge — not now,
and not without explicitly reopening the decision.

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

### Investing in a town you do NOT control

The `patron` field must support a **non-owner** patron so the model can express it. **No
player-facing verb in the first slice.** When it arrives it should come **through a conversation
with a governor**, not a menu.

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

## 11. First slice vs. deferred tail

### First slice — standalone module, own startup file, no player UI but the slider

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
