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

## 2. The land — regions, and what they will bear

*Rewritten 2026-09-08 (third). Supersedes the six-parcel ring. Authority:
[`../decisions.md`](../decisions.md), top entry.*

> **A town is what most of its ground is for.**

### 2.1 Why regions and not parcels

Dilution — every town coming out mediocre at everything — is caused by **independent per-tile
sampling**, not by tile count: twenty tiles rolled independently converge on the same average.
**Clustering breaks the independence.** Draw four regions, paint them across two dozen hexes: few
draws, high variance, high resolution. A richer picture from *fewer* decisions.

The rule that replaces "one hex = one parcel, never subdivided":

> **A hex must carry information no other hex carries, or belong to a region whose size and shape
> mean something.**

### 2.2 The shape of the land

- **~24 land hexes**, grown outward from the town site with a cleanup pass (fill single-hex holes,
  trim one-connected spurs), so the outline is **irregular — a coast, not a flower**.
- **Only water that touches land is drawn at all.** No wasted ring. The viewBox is computed from
  the actual bounds, so the map fills its panel whatever shape it came out.
- **1–3 detached offshore hexes** — a cay, a reef, an islet. Cheap, and they do a great deal for
  "this is a real stretch of coast". An offshore hex is permanently `far` (§2.6).
- **Guarantee: at least one water hex adjacent to the town's centre, in the southern arc.** That is
  the quay and the landing — see §2.7.

### 2.3 Regions

**The region is the unit.** 3–5 live regions plus 1–3 of dead ground, each a contiguous set of
hexes, grown from the existing biased roll and the existing `SUPPORTING` adjacency table.

Sizes come from a **budgeted, skewed** draw — never uniform:

| Role | Hexes |
|---|---|
| **Dominant** | 5–9 — roughly a third of the workable land |
| **Supporting** (1–2) | 3–5 |
| **Minor** (0–2) | 1–2 — a bluff, a salt pan, a cay |
| **Dead** | 2–6 across marsh · scrub · open water |

**Area is capacity.** Five timber hexes means room for five sawpits, and each stands on its own
named hex.

### 2.4 The four rules that protect identity (R1–R4)

> **R1 — the land is a partition, not a menu.** Every land hex belongs to exactly one region. A hex
> given to timber is a hex not given to cane. Identity is proportion, and **proportion is
> zero-sum** — this is what stops "a town has access to several resources" becoming "access to all
> of them".
>
> **R2 — one hex = one work's ground.** A hex is never a fraction of anything; it is a whole
> decision. (The direct successor to the struck rule, in a better place.)
>
> **R3 — the roll is biased in AREA, not only in kind.** *This is where dilution now lives.*
> Uniform region sizes rebuild the mush at a larger scale.
>
> **R4 — one label per region, never per hex.** A hex is a unit of area, not of announcement. This
> is the single biggest anti-quilt measure.

**Identity comes from three sources where it came from one:** **proportion** (new, and the
strongest) · the **dominant region** (what the place is *for*) · **shape and adjacency** (which the
raid map cashes in). The prose must speak in proportions or none of it is visible: not *"cane flats
to the south-east"* but *"cane over half the ground, a strip of provision land behind it, and
nothing else worth having."*

### 2.5 Suitability — terrain BIASES a crop, it does not DETERMINE it

*Ratified by the human:* **"A field might have a good bonus to cotton. You might plant barley on
it, which works — but cotton would have been ideal. I cannot plant cotton on bedrock."**

**The catalogue splits in two, and only one half is graded:**

| Half | Works | Gate |
|---|---|---|
| **Crops & extraction** | cotton walk · grain fields · cane field · provision grounds · sawpit · quarry · salt works · fishing shacks | **graded suitability** |
| **Sited works** | shipway · careenage · quay · warehouse · customs house · battery | **hard ground requirement** — you cannot half-build a harbour on a hill |

- **`region.bears: Partial<Record<Produce, Suit>>`**, where `Suit = ideal | fair | poor` and
  **absent = will not bear.** Keyed on what a work **produces**, not on its kind, so adding a work
  needs no new column.
- **Every grade owns a clause:** *ideal* — "this ground was made for cotton" · *fair* — "it will
  take barley well enough" · *poor* — "it grudges a crop; a third of what the cotton would pay" ·
  *absent* — **"you cannot plant cotton on bedrock."**
- **Suitability is ROLLED, not fixed per terrain.** The terrain sets the shortlist and the odds;
  the roll sets *this town's* profile. Tilled ground usually favours cotton, but sometimes this
  town's tilled ground favours grain instead.
- **`ParcelQuality` is STRUCK.** Area is *how much*; suitability is *how well, and for what*;
  quality was the second with the meaning removed. It could write no clause suitability cannot
  write better, and two dials for one feeling is a tuning trap.
- **Suitability sits on the REGION**, not the hex — per-hex ratings are the quilt R4 forbids, and
  they reopen "which hex gets the cotton walk?" as a solvable surface. **One exception: each region
  carries one "best of it" hex**, a single flagged sweet spot one grade better. One boolean, and it
  is why the boiling house stands where it does.
- **The partition survives because it is over GROUND, not produce.** Six tilled hexes are six hexes
  of tilled ground whichever crop stands on them. Adaptability changes what a region **earns**; it
  never changes how much ground a town **has**.

**The climate seam — named, and deliberately not designed.** `region.bears` is resolved **once at
founding by a profile supplier**, and nothing downstream ever asks where it came from. First slice:
a hand-authored terrain table plus a roll. Later: `climate(latitude, rainfall, elevation) × terrain`
fills the same field. **The seam is that single function**; no other code changes when climate
arrives.

### 2.6 Reach — ground that is a little out of the way

**`reach: 'at hand' | 'far'`**, derived: a region is `far` if it does not touch the town's claimed
hexes — over a ridge, across a creek, on a cay. Its works **cost more hands** (men must walk) and
are **dropped first when hands are short**, which the shipped labour sort already does for free. On
the raid map its works stand **away from the muster** — an isolated mill you can take unopposed, or
a cay you can stage from before you touch the town.

> *"There is fine timber over the ridge; nothing much has ever come out of it."*

A town whose best land is `far` never realises its promise, and that is a distinct kind of place.
*Deferred:* an access work (a causeway, a mule track) promoting `far` → `at hand`. An offshore cay
is permanently `far`.

### 2.7 The sea still lies south

The invariant is about **readability, not geography**, and it survives an irregular coast:

> **The open water always lies in the southern arc, and the raid map's landing edge is always the
> near edge. The coastline is irregular; which way it faces is not.**

A bay may bite north into the land; a headland may jut south; the shore may run diagonally.

### 2.8 Who may write to the land — three states

| State | When | What you may do |
|---|---|---|
| **Read-only** | a foreign town you have bought no one in | Nothing — and you cannot see the land at all until you have paid a clerk (§6). Prose only. |
| **Steerable** | your own governor, or a bought arrangement | Lean the town **thematically** — one focus, optionally one named production line (§5.8). Never a hex. |
| **Grantable** | a haven **you own** | Additionally: **grant a region** to a vocation its ground will bear (§7.6). |

**Still forbidden everywhere:** worker allocation · re-founding · choosing where a building stands ·
and the new line to defend — **the player never chooses which hex the town claims next.**

### 2.9 Acceptance tests for the land

1. In 20 rolled towns, the **dominant region holds at least a third of the workable land in at
   least 15**. *(Guards the uniform-region failure — the one that would silently rebuild the mush.)*
2. **No town's land bears more than five live terrain kinds.** *(Guards "access to everything".)*
3. Every land hex belongs to exactly one region; every region is contiguous. *(The partition.)*
4. Every town has at least one water hex adjacent to its centre, in the southern arc.
5. Two towns with the same terrain kinds but **different proportions produce different sentences**.
6. A town grown a century has claimed hexes, and the **sum of its regions' capacity has fallen**.
   *(Growth eats its own cause.)*
7. Same seed → same land. *(Reproducibility, required of every module.)*
8. **No drawn hex is neither land, town, nor coast-adjacent water.** *(No wasted ring.)*
9. A town asked for a crop its ground merely **grudges** raises it, earns visibly less, and says so
   in one clause on the wants-list — **no silent underperformance**.

### 2.10 A discipline rule that binds every consumer of this model

> **Never store a bearing as the spatial fact; derive it. Axial is the truth.**

`Bearing` survives as prose and a coarse index — the direction of a region's centroid — so the
growth ordering, the stage-3 skew and every sentence keep reading it. But the spatial truth is the
region's hex set and the work's own hex.

## 2.11 The footprint — the land is fixed, the town spreads over it

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
| `claimed` | the set of hexes the town has built over |

*Amended 2026-09-08 (third): the four-level `spill` ladder is **struck**. The town takes **whole
hexes**, which removes a concept rather than adding one, and makes "growth eats its own cause"
literal and countable — claim a cane hex and the cane region is one hex smaller, one cane field
idle. You can see which quarter the town ate.*

**The town is drawn as ONE CONTINUOUS SILHOUETTE**, never a cluster of outlined hexagons. That is
the surviving spirit of the struck lobe rule, and it is what keeps *no hex is ever visible in a
raid* honest at the finer grain.

> **Rejected: the tract model.** Grouping many small hexes into ~6 economic tracts buys no
> information (identical sub-hexes say what one hex says) and reopens an in-tract placement
> question the do-not-build list bans. Recorded so it is not re-proposed.

### The pressure, and the relief

Every work has a `zone`; everything not `beyondThePale` stands **inside** the town, and `dwellings`
already auto-raises one per 40 souls — so population drives the pressure through machinery that
exists. **Crowding = in-town works ÷ room.**

Relief runs in strict order, and step 1 before step 2 **is** "builds inwards-out". The tie-break
on which hex to take is **the candidate with the most already-claimed neighbours**, which produces
lobes far more reliably on a hex field than it did on six bearings:

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

### Claimed ground is permanent

Build over the cane and the cane is gone: a claimed hex leaves its region's capacity and any work
standing on it idles. Claiming is **binary** — every claim costs capacity the moment it happens,
which is the correct fiction and a legible event rather than a numeric bleed. Over a century a
town claims perhaps a quarter to a third of its workable ground. The one exception: a town that
reaches `Abandoned` and is later re-founded rolls its footprint back to nothing and keeps its
land.

**The footprint never retreats.** Collapse leaves derelict ground, then ruins.

### Walls shape growth; they do not stop it

The wall is the existing `palisade` work plus a **circuit frozen at the moment it was raised** —
the boundary edges of the claimed set as it then stood, **never re-extended as the town grows**.
That is Havana 1671–1740 and Getsemaní exactly, and it makes fidelity contracts 7 and 8
mechanically trivial: **a claimed hex outside the frozen circuit *is* the faubourg.**
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

### Scale, and why it may grow

~16 **choosable** works (*was ~12; widened 2026-09-08 for the new terrains*) + ~6 **automatic**
civic/defensive ones.

> **The catalogue may grow freely because THE LAND IS THE FILTER.** A town with cane, fields and a
> roadstead offers its governor a shortlist of five or six works whatever the catalogue's size, so
> the five-term auction never gets noisier.

**Two gates, not one** (§2.5): **crops and extraction** are gated by graded suitability — a work is
offered if its `produces` appears in `region.bears` at any grade. **Sited works** keep a hard ground
requirement. Mining and smithing stay **simplified** — a quarry region and a work that stands on
it, never an ore → bloomery → smithy chain. Commodity identity, prices and shipping belong wholly
to the trade epic.

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
2. **The land answers in three registers** *(amended 2026-09-08 — was a flat refusal)*:

   | Register | Clause | What the steer does |
   |---|---|---|
   | **Refuses** | *"there is no ground for cane here"* | flat no |
   | **Grudges** | *"they can grow it; it pays a third of what the cotton would"* | **lands, and is visibly a bad idea** |
   | **Bears** | *"the ground was made for it"* | pays |

   The middle register is the upgrade: a steer can now **land badly**, which is more interesting
   than a refusal and more legible than silent underperformance — and it satisfies the requirement
   that a steer must be able to **visibly lose**. **The grudge clause is published on the
   wants-list *before* the work is raised**, so there is never a silent bad bargain. And the land
   still refuses outright where it must: no bluff, no battery.
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
| 2 | **The contador / factor** | **A production line**, named, for a term. *"There'll be rum out of here by the time you're back."* **Gated at the refusal floor only** *(2026-09-08)*: buying grain on cotton ground succeeds and **pays badly** — the poor return is the discipline, not a second gate. Coin can never lift an absent entry, nor a sited work's hard ground requirement. |
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

**Stage 2 note (amended 2026-09-08 third):** the zone bands must be laid along the **actual claimed
silhouette**, not a circle. Contract 4 promised this once the footprint could grow; it is now due.

**Stage 3 — parcel bearings skew everything.** *(Sharper now: it keys on a region's **edge
adjacency** to the town rather than a coarse bearing. A region touching the town across two hexes
gives a wide industrial edge; one touching across a single hex gives a lane out to it.)*
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
| 4 | **Size.** *(amended twice, 2026-09-08)* The raid map's extent is a function of the **claimed hex set**: `core` sets the town's depth, and each claimed hex adds a quarter where that hex lies. Population is an input to the footprint, never to the map directly. **Guard: the map covers the claimed set plus one ring of adjacent land, never the whole county** — beyond that ring, growth raises *density*, not extent, or a century-old port becomes an unplayable march. |
| 5 | **Scar.** A ruin on the hex is a burnt shell on the ground. |
| 6 | **Skirts.** *(new)* A bearing with a suburb has buildings **outside the town proper on that edge** — approach cover, or a landing you can make among houses. A compact town has open glacis on every side. |
| 7 | **Trace.** The wall's frozen circuit is exactly the edges that carry a wall on the ground. **An unwalled edge is the way in.** A `ruin` wall draws as a broken line *through* the built-up area, not at its edge. |
| 8 | **Faubourg.** Because the circuit is frozen at the moment it was raised, **a claimed hex outside it simply IS the suburb** — the wall runs through the middle of the raid map with no extra machinery. |
| 9 | **Spread.** *(new, 2026-09-08 third)* A region's works stand **along its own ground**, not piled on a point: five sawpits in a line down the north woodline, one per hex. This is the human's work-visibility requirement at scale. |

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

*Amended 2026-09-08 (third): grants are **per REGION**, 3–6 of them, not per hex — which makes them
even more clearly a landlord's decision and less like placement. The shortlist a region offers is
graded: an absent produce is refused outright, a grudged one is offered with its clause attached.*

Each **region** may be **granted** to a vocation its ground will bear: *"the north hills —
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

### The land rework (2026-09-08, third) — four stories

**Board:** land generator = **KAN-84** · suitability = **KAN-85** · footprint on hexes =
**KAN-86** · the renderer = **KAN-87**. Dependency order is KAN-84 → 85 → 86 → 87, with the new
sections on **KAN-81** (per-region grants) and **KAN-72** (the three registers) landing after
KAN-85. These four **supersede parts of KAN-79 / 80 / 82 / 83**, which stay closed.

1. **The land generator.** Coast growth and cleanup; region seeding and growing from the existing
   biased roll and `SUPPORTING`; budgeted skewed sizes; area as capacity; derived bearings; the
   `reach` flag. Acceptance: §2.9.
2. **Suitability.** `region.bears`; the crops/sited split of the catalogue; `ParcelQuality` struck;
   the rolled profile; the sweet-spot hex; the three registers wired into the steer's clause.
3. **The footprint on hexes.** `claimed` replaces `spill`; the frozen wall circuit; the
   most-claimed-neighbours tie-break; capacity falling as the town eats its ground.
4. **The renderer.** Irregular map, computed viewBox, region union outlines with **one label at the
   centroid**, the town's single silhouette, the wall trace with its gaps, the sweet-spot glyph, a
   caption that speaks in proportions. Also fixes two live bugs: ghost labels bleeding across hex
   boundaries, and the centre label truncating — both from text sized for 40px hexes on a 26px map.

**What it costs:** a rewrite of the land roll (~100 lines), ~60% of the footprint module, most of
the renderer's layout, and ~15–25 test edits that are **nearly all count-pinning**. Striking
`quality` makes it **net negative lines**. The ledger, the five-term auction, `sim.ts` and every
design-claim test are untouched — and per the testing rules, **if a behaviour test breaks that is a
real regression and a stop-and-think, not a number to update.**

*Deferred tail:* access works promoting `far` → `at hand` · the cay as a careening site ·
monoculture consuming neighbouring regions (Barbados) · a goods/commodity model (trade epic) ·
neighbours and annexation of unclaimed hinterland · noise-field terrain if region-growing reads too
tessellated · roads · `stone → lime` as a third edge with wall grades.

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
