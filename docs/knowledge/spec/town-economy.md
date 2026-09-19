# Town Economy — Living Towns

**Layer:** WHAT (tool-agnostic) · **Scope:** land / strategic · **Authority:** human edits win.

*What a town **is**, how it grows and ~~decays~~ **is hurt** on its own, and how its ledger becomes a
raid map. Ratified 2026-09-07 — see [`../decisions.md`](../decisions.md). Comparables and the
ADOPT/ADAPT/REJECT reasoning live in [`design-references.md`](design-references.md). This spec
must not contradict [`../../design-doc.md`](../../design-doc.md) §1.1, §7.1, §7.3.*

> **Two directions ratified 2026-09-19, and they are the largest change to this document since it was
> written.** **§2.12 — the region focus:** a region has a **potential** given by its ground, and a
> **focus** decides what the town takes off it. *Goods survive; production chains do not.*
> **§4 — damage has a cause, never a clock:** nothing degrades from neglect; works are hurt by named
> events and put back with coin and time. **The two hold each other up and neither is safe to revisit
> alone** (§2.12.6). Between them they supersede §3's devolution ladder and its two dependency edges,
> and they fold §7.6's *grant the ground* into the focus.

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

> **What 2026-09-19 changes in this table, and it is three lines.** **(1)** A **region** gains one
> field — `focus`: `production` · `growth` · `null` (§2.12). It is the only new stored thing in
> either of that day's two directions. **(2)** A **work** gains `standing` — the share of its fabric
> that is built — and **loses** the `idleSinceDay` it carried for the decay clock (§4.2). Net zero.
> **(3)** `grantedToTown` is **deleted** from the town: it was the region focus under another name
> (§2.12.8).
>
> **Nothing else on this table moves**, and in particular **no region gains a development number** —
> depth is counted, never stored (`[HC-93]`).

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

> **AMENDED 2026-09-19 — area is capacity *once a focus has been set*.** A region a town has decided
> nothing about carries one token work, however big it is; a region focused on production may be
> worked to its free area. So **the focused-to-unfocused ratio IS area**, and the skewed sizes
> budgeted above stop being only a matter of prose and the map and finally pay off in the economy
> (§2.12.4). Nothing about how the sizes are rolled changes.

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

**R4 governs LABELS, not ADDRESSING** *(clarified 2026-09-08 by the human, on seeing the map)*. A
region is a unit of **capacity and drawing**; the **hex remains the unit of ground, of the ledger,
and of inspection**. Three hexes of tilled land are three separate pieces of ground that happen to
be alike:

- **Every hex is independently inspectable** — its own hover, its own text, saying what stands on
  *that* hex and whether the town has built over it.
- **Capacity falls one hex at a time.** Build over one of three field hexes and production drops
  to two; the work standing there idles and the other two carry on. *"If growth is prioritised it
  should be able to expand into the fields as a last resort for housing — that reduces the overall
  production of this town's 3 tiles to 2."*
- **The merged outline and the single label are a visual grouping only.** They must never become
  the thing the player addresses, because that hides the very cost that makes growth matter.

Failing this is how a model that is correct underneath can still *look* coarse: the sim already
counted hexes; only the map had stopped saying so.

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

> **AMENDED 2026-09-19 — the third state collapses into the second.** *Grantable* and *Steerable*
> were two names for one verb: both answer *what is this piece of ground for*, once, irreversibly.
> **Grant-a-region becomes the REGION FOCUS** (§2.12), which is **thematic**, so it sits on the
> Steerable row where it always belonged. What survives of the distinction is the only part that was
> ever load-bearing: **the governor sets a focus everywhere; the owner sets one in his own haven,
> directly and for free.** The forbidden list above is untouched, including its last line — **a
> growth focus says which REGION the town may spread into, never which hex it takes next.**

### 2.9 Acceptance tests for the land

> **NARROWED 2026-09-10 (KAN-103), because the broad version is false.** Test 3 below asserts that
> **every** region is contiguous. That holds for **workable ground** and does **not** hold for water,
> by this spec's own design: cays are detached (§2.2) and banks lie where the banks lie. Measured on
> the shipped generator: **926 of 1,593 water regions are scattered.** So the claim to hold anything
> to is *"each workable region is one contiguous stretch"* — which is also the only version that is
> load-bearing, because **area is capacity** and capacity is about ground a town can work.
>
> Also recorded: tests 1–8 here were written against the **founding roll**, which `[HC-19]` replaces
> with the world's cut. **Do not transcribe them wholesale** — most of them test a producer that is
> being deleted. The surviving claims are about the *land struct* and are pinned in
> `game/src/town/land.test.ts`.

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

> **And a FOURTH time, 2026-09-19.** Scrub is the only ground a **growth focus** costs nothing to
> take (§2.12.7), because there was no production on it to spend. The clause says exactly why:
> *"nothing else was ever coming off that ground."* A town with dead ground to grow into can be
> **both** a big town and a timber town; a town ringed by cane has to choose which.

**It grows lobes, not rings**, because the order is strongly ordered, dead ground breaks the
symmetry, and a wall holds one side rigid while the other sprawls.

### Claimed ground is permanent

Build over the cane and the cane is gone: a claimed hex leaves its region's capacity and any work
standing on it idles. Claiming is **binary** — every claim costs capacity the moment it happens,
which is the correct fiction and a legible event rather than a numeric bleed. Over a century a
town claims perhaps a quarter to a third of its workable ground.

> **STRUCK 2026-09-09.** There was an exception here — *a town that reaches `Abandoned` and is later
> re-founded rolls its footprint back to nothing and keeps its land*. Abandonment is unrecoverable
> (*"abandoned, not really"*), so it described something that cannot happen. **Claiming is
> permanent, with no exception.** §4's *patroned towns refound instead of abandoning* is a
> different rule and is unaffected.

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

## 2.12 The region focus — potential, focus, claim, yield

*Ratified 2026-09-19. Authority: [`../decisions.md`](../decisions.md), **"A region has a potential; a
focus decides what you get from it"**. This section and §4 were ratified in the same sitting and
**neither is safe to revisit alone** — see §2.12.6.*

> **A region has a POTENTIAL given by its ground. A FOCUS decides what the town takes off it.**
> Focus production and the region yields more of what its ground bears. Focus growth and the ground
> becomes housing: more people, and the production is largely spent.

**GOODS SURVIVE; CHAINS DO NOT.** Timber is still a real thing that moves on real ships and fetches a
local price. What goes is *timber → sawpit → planks → shipway*. This is a **sandbox age-of-pirates
game, not a city manager**, and a brittle production chain is the shape of the other thing.

**What actually changes is that the choice is nobody's.** The footprint spills a town outward
automatically on a fixed relief order (§2.11), so no town has ever decided *"this is a timber town"*
or *"this is a big town"*. **Making that a direction rather than a side effect is the whole of this
section.**

### 2.12.1 Four nouns, and only one of them is new state

| Noun | What it is | Where it lives | Burnable? |
|---|---|---|---|
| **Potential** | What this ground will bear, and how well — `region.bears`. Set once at founding by the profile supplier (§2.5). | Already stored | **No. Un-burnable.** Ground is ground. |
| **Focus** | `production` · `growth` · `null`. **The one new field**, and it sits on the **region**. | New | No — but see §2.12.6: it is never taken back either. |
| **Claim** | The works standing on that region's hexes, and the hexes the town has built over. | Already stored | **Yes.** This is the half a raider can reach. |
| **Yield** | What comes off it this season. | **Derived every tick**, as today | — |

**Potential is the CAP; the claim is what has actually been taken up.** Burning the claim collapses
production while the potential sits there waiting, which is what keeps `[HC-87]`'s fragile ceiling
alive and what makes a place worth **occupying rather than razing**. It also satisfies the heritage
test: *the number carrying the town's size stays destructible at the building level.*

### 2.12.2 Depth is DERIVED — never a stored number

> **`[HC-93]` A region's DEPTH is how many works stand on its hexes. It is counted, never stored.**
> There is no development integer, no level, no tier on a region.

**Record the resolution explicitly, because the shortcut is obvious and someone will later believe it
was sanctioned.** Collapsing a region's works into a single *development* number would be smaller
code and it would break two ratified things at once:

- **`[HC-14]`** says store almost nothing and derive the rest — and its own test is *"could this have
  been recomputed?"* A development integer is exactly a derived quantity stored, free to drift away
  from the sentence that explains it.
- **§7's work-visibility requirement**, in the human's words: *"If a new lumber mill is built and I
  land there with my units, I want to see the lumber mill."* A development number has no lumber mill
  in it to see.

Counting the works keeps both true at once, at the cost of a filter over ~20 ledger lines once a
season. **That is the cheapest thing in this document and it is load-bearing.**

**Two readings of the same count, and they are deliberately different:**

| Reading | Counts | Because |
|---|---|---|
| **Yield depth** | works **whole and working** on the region | A mill that is not whole saws nothing (§4). |
| **Installation depth** — what the label and the projection read | works **standing**: working, idle, or **in hand** (§4) | You can see a mill with scaffolding on it, whether it is going up or being put right. A ruin is not standing. |

Both are derived. Neither is stored. §7 contracts 3 and 9 are what they are for.

### 2.12.3 Exactly two focuses, and the candidates that were rejected

**There are exactly two things a population can do with ground: work it, or live on it.** That is the
structural bound, in the same shape as §5.8's *"a fourth focus would need a fourth thing a work can
produce"* — not a taste call.

**Rejected, recorded so they are not re-proposed:**

| Candidate | Why not |
|---|---|
| **Defence** | Not something ground *yields*. Defence already has three homes — the `fear` term, the `guns` steer, and the defensive works themselves — and `[P-47]` forbids a fourth path to one value. A bluff's answer is **a battery, which is a town work**, not a land use. |
| **The port** | One legal target per town. A choice with one option is not a choice. |
| **Trade** | Has no ground to stand on. Trade is what happens to a yield after it reaches the quay. |
| **Fallow** | That is `null`, and `null` already means it. |
| **Extraction vs. agriculture** | **The produce already knows.** `region.bears` says timber or cane; a second axis saying "extract" would be the same fact twice. |

### 2.12.4 A focus buys CAPACITY, not a multiplier

> **`[HC-94]` A focus buys CAPACITY, never a multiplier.** Unfocused, a region's depth caps at a
> token work. Focused on production, its depth may reach its free area. **The focused-to-unfocused
> ratio is therefore AREA** — the founding roll's own variance — and nothing anywhere multiplies a
> yield because a focus was set.

**Why a flat multiplier is REJECTED, and it is two separate objections:**

1. **It is an instant dial.** *"Set focus, yields rise 40%"* is a number the player watches rather
   than a place he shapes, and it reads as a spreadsheet the moment it is surfaced (§1.1).
2. **It would silently fail.** Works **store their scaled yields at the moment they are raised** —
   that is how suitability, the sweet spot and `far` ground are already priced. A focus flipped later
   would not re-price the works already standing, so the dial would be a lie on every existing work
   and true only on new ones. A rule that is true of some rows and not others is worse than no rule.

**And the ratio being area is the payoff, not a side effect.** §2.3's budgeted, skewed region sizes —
a dominant of 5–9 hexes against a minor of 1–2 — have until now paid off only in prose and in the
map. **Focus is what finally makes them pay in the economy:** a town whose dominant region came out
at nine hexes can become a timber town in a way a town whose best came out at three never can, and
nobody tuned that.

**The token cap, for an unfocused region: ONE capital work.** A region nobody has decided anything
about still gets worked a little — a hamlet takes what timber it needs off the ridge — but it never
becomes an industry. The clause: *"there is timber over the ridge; they take what they need of it."*
Subsistence works are outside this entirely (§2.12.11).

### 2.12.5 Rising returns, capped at the region's own area

> **The Nth work on a region is worth more than the first — a mill and its yards, not a pit.**

A second sawpit on the same hills shares a track, a pond and a crew; a fifth is a works. So the
premium rises with depth, and it is **minted into the new work at the moment it is raised**, exactly
as suitability and reach already are. **The standing works are never re-priced** — same rule as
§2.12.4, for the same reason, and if the fifth burns, the *yards* are what the town lost.

**The cap is the region's area, and it is not a separate number.** Depth can never exceed free
hexes, so the premium runs out of ground before it runs out of anything else. **This is deliberate
and it is `[HC-75]`:** unbounded rising returns are an overshoot engine — more works, more yield,
more growth, more works — and *"no place oscillates with growing amplitude across two hundred
years"* is a named acceptance test, not a hope. **Capped at area, the loop terminates on the
founding roll.**

*The curve's shape is a tuning table, not a rule ([HC-90]) — what this spec fixes is that it rises,
that it is minted at raise time, and that area is its ceiling.*

### 2.12.6 A focus is set once, and never taken back

**A production focus is PERMANENT — ratified.** And the reason is **structural rather than a
preference**, which is the part worth writing down:

> The case for a reversible focus rested entirely on the works idling and **rotting** as the reversal
> cost. §4 deletes rot. **With nothing rotting, lifting a focus costs nothing and it can be flipped
> back the next season** — which is precisely the *instant dial* this whole direction exists to
> avoid. **The two directions hold each other up, and neither is safe to revisit alone.**

> **`[HC-95]` A region's focus is set once and never changed.** `null → production` and
> `null → growth` are the only transitions. There is no unfocus, no re-focus, no swap.

**A growth focus is covered by the same rule, and the manager's reasoning is recorded so it can be
overruled.** The human ratified permanence for *production*. Growth is made permanent too because:

- **Its effects already are.** Every hex a growth focus takes is **claimed**, and claiming is
  permanent with no exception (§2.11, struck 2026-09-09). Lifting the flag would not give one hex
  back, so a reversible growth focus would be a lever that reads as undoable and is not.
- **It inherits §7.6's ratified irreversibility.** Focus is the successor to *grant the ground*
  (§2.12.8), and a grant was *"one grant per hex, ever; irreversible without razing what stands"*.
  Keeping that word is the conservative reading.
- **It keeps "six decisions in the life of a town" true.** 3–5 live regions, one decision each, never
  revisited — squarely inside §1.1.

*Flagged as the manager's extension of a ratified line. Overrule freely — the cost of overruling is
one enum transition, not a redesign.*

**A focus costs no coin.** It is a landlord's decision, exactly as the grant it replaces was. What it
costs is **the season's one decision** and **the fact that it is forever**. That is the whole of the
scarcity, and there is deliberately no budget in it.

### 2.12.7 A growth focus needs no new mechanism at all

It acts entirely through machinery that already ships:

> **growth focus → `nextHex` takes that region's ground first → crowding falls → the `shelter` need
> is met → prosperity rises → `prosperityPull` rises → carrying capacity rises → more souls.**

And **its cost is already literal**: a claimed hex leaves its region's capacity and **idles the work
standing on it** (§2.11, *"growth eats its own cause"*). The human's trade-off was already the
model's spine; all that was missing was somebody choosing where it landed.

**Two smaller things fall out, and both are worth having:**

- **A growth focus aimed outside the wall's frozen circuit deliberately manufactures a FAUBOURG.**
  §2.11 froze the circuit at the moment the wall was raised, and §7 contract 8 says a claimed hex
  outside it *simply is* the suburb. So the owner of a haven can now **choose to build a town outside
  its own gate** — houses under the wall, approach cover for the next raider, a two-stage raid the
  generator gets for nothing. It needs no new machinery and it is a real decision with a real cost.
- **Dead ground now pays a FOURTH time.** It was the economic ceiling, the defensive gift, and the
  release valve (§2.11). Now it is **the only ground you can grow on for free** — a growth focus on
  scrub costs a town nothing at all, and the clause says exactly why:
  *"nothing else was ever coming off that ground."* A town with scrub to the north can be **both** a
  big town and a timber town; a town ringed by cane must choose.

### 2.12.8 Who chooses — and `Town.grantedToTown` is deleted

**§5.8's governing principle holds unchanged: the governor sets a focus everywhere; the owner sets it
in his own haven.** A focus is **thematic** — *what is this land for* — not spatial, so it sits on the
steerable side of §2.8's three states, not the grantable one.

- **The governor chooses, and publishes his reason** (`[HC-1]`: no engine system prompts the player;
  `[HC-16]`: every decision publishes its reason). *"Sarmiento gives the cane flats over to the
  town — there is nowhere left for people to sleep."*
- **The player steers only where he owns the ground**, through the ratified *guns · coin · hands*
  steer — and **the region focus takes §5.8's existing OPTIONAL NAMED PRODUCTION LINE slot. It is
  NOT a fourth arm.** The three-armed steer and its structural bound survive verbatim. What changes
  is only that the optional line stops being named by its output and starts being named by its
  ground: *"the cane"* becomes ***"the cane flats to the south-east."***

> **`Town.grantedToTown` is DELETED.** §7.6's *grant the ground* and the region focus are **one
> concept, discovered twice.** Both answer *what is this piece of ground for*, both are one-time and
> irreversible, both are the owner's to set and the governor's to publish. Keeping both would be
> `[P-47]` written into the struct: two fields for one fact, and a `nextHex` that has to consult
> them both. **Grant-to-the-town becomes `focus: "growth"`, and nothing else changes.**
> See §7.6 for the superseded text and what survives of it.

### 2.12.9 The focus auction is FOUR-termed

A focus is a decision, so it is scored and it writes its own clause — the same discipline as every
other decision in this module. But it is scored by **four** of the five terms, not five:

| Term | The clause it writes about a piece of ground |
|---|---|
| **The land calls for it** | *"the hills are timbered, and deeply"* |
| **The town wants it** | *"there is nowhere left for people to sleep"* |
| **The market wants it** | *"timber fetches well here"* |
| **The patron's agenda** | *"the Company wants a return on this place"* |

> **`[HC-96]` The focus auction is four-termed — land, need, market, agenda. `fear` is structurally
> absent, and it stays absent: FEAR NEVER ARGUES FOR WHAT GROUND IS FOR.**

**Say it as a rule so nobody adds it later.** Fear is a real and correct argument for *a battery on
the bluff* — a work, on a hex, that answers a threat. It is not an argument about what the cane flats
are **for**, because no land use makes a town safer; only guns do. A `fear` term in this auction
would be defence claiming a fourth home, which §2.12.3 already refused and `[P-47]` already forbids.

### 2.12.10 The live trap — a DEEPENING names an instance, not a kind

**This is the sharpest thing in the section and it is easy to get wrong.** KAN-108 established a
structural limit on the five-term auction and it is recorded at §5.1:

> **The five terms score a KIND, not an INSTANCE.** The land term reads the best *free* ground for a
> kind; the market term reads the catalogue's trade figure. A standing work has neither — its ground
> is underneath it, and its trade is already scaled by that ground's suit and reach.

**A region is kind-like, so the focus auction above transfers cleanly.** A region with no focus has
no works claiming it, its ground is free, and asking "what is this ground best for" is exactly the
question the land term already answers.

**A DEEPENING is not.** *"Put a fourth sawpit on the north hills"* names a region that **already
carries works** — free area partly spent, a suit already known, a premium already owed. That is an
instance.

> **`[HC-97]` A decision about a region that already carries works is scored from THAT REGION'S OWN
> GROUND — `potential × free capacity × local price` — never from the catalogue's figures for a
> kind.**

**Scoring a deepening from `CATALOGUE[kind].trade` would reopen exactly the second-path problem
`[P-47]` names and KAN-108 ended on:** the catalogue figure is the *unscaled* value, the region
already holds the scaled one, and the two would disagree the moment ground, reach or depth differed
from the default — which is always. Worse, KAN-108 found that the auction **cannot always see the
want at all**: while works hold a region's hexes, its free capacity falls and the kind can drop out
of the wants-list entirely.

**So a deepening sits BESIDE the eight capital works in the season's one decision, competing with
them, scored by its own rule** — which is precisely the shape KAN-108 prescribed for instance-level
verbs, now with a second occupant. The auction's candidate set is therefore **eight works and N
deepenings**, and the two candidate types never share a scoring path.

### 2.12.11 Never gate a subsistence work on focus

> **`[HC-98]` A subsistence work is never gated on focus, on depth, or on anything else a decision
> can withhold.** Garden plots, fishing shacks and dwellings raise themselves on any ground the town
> holds, focused or not.

**Because the hamlet floor and the focus would break together.** `[HC-67]` says the floor *requires
survivors* and nothing else: subsistence works cost no wealth, raise themselves, and are why a sacked
town crawls back. Gate them on a focus and a razed town whose governor is dead has no way to raise a
garden plot — the floor fails, `[HC-18]`'s *"only a deliberate hand empties a town"* fails with it,
and both fail silently, in a two-hundred-year run, as a number that drifts to zero.

### 2.12.12 What it does to the catalogue — twelve capital works resolve 3 / 1 / 8

| Fate | Works | What happens |
|---|---|---|
| **Become focus expressions** | `sawpit` · `caneField` · `provisionGround` | **The work survives; the MENU CHOICE dies.** They are no longer things a governor picks off a list — they are what a production focus on that ground *is*. A deepening raises the work the region's best-borne produce implies. |
| **Deleted, folded into depth** | `boilingHouse` | See the label ladder below. |
| **Survive untouched** | `shipway` · `warehouse` · `customsHouse` · `battery` · `palisade` · `barracks` · `tavern` · `church` | Still chosen, still scored by the five terms, still gated on ground, coin, hands and materials. |

> **The auction's candidate set of WORKS falls 12 → 8.** The deepenings are a second candidate type
> (§2.12.10) and are never counted among them.

**`shipway` is reclassified from chain-downstream to a HARBOUR WORK, and `requires: "sawpit"` is
deleted.** It is a sited work on a roadstead, in the same family as the warehouse and the customs
house: a town with sheltered water may build ships there. It no longer needs a sawpit standing first,
because **that was the chain, and the chain is what goes.**

**The label ladder — what replaces the boiling house.** At depth ≥ N the region's installation is
**relabelled** rather than joined by a new menu item:

> *"cane fields"* → *"cane fields and a boiling house"*
> *"sawpits"* → *"a mill and its yards"*

§7's contracts 3 and 9 already ratify that works of one kind on one region draw as **ONE
INSTALLATION SIZED BY COUNT**. **The label ladder is that rule's prose twin** — the same fact, said
in words instead of drawn — so it adds no machinery and no stored state. **The sweet-spot rule
survives untouched:** a region still carries one flagged best-of-it hex, and it is still *why the
boiling house stands where it does*. It is now why the boiling house is **named** where it does.

*The depth threshold N is DEFERRED — see §2.12.15.*

### 2.12.13 `exports` moves from the work to the PRODUCE

**One table, and the ground fills it in:**

| Class | Produce |
|---|---|
| **victuals** | `food` · `fish` · `grain` |
| **materials** | `timber` · `stone` |
| **luxury** | `cane` · `cotton` |

**This is what makes THE GROUND decide a town's export class**, which is `[HC-77]`'s pyramid meaning
*more* than it did rather than less: a town's place in the pyramid stops being a property of which
buildings its governor happened to pick and becomes a property of the coast it was founded on. Two
towns with the same works and different ground are now different towns on the world market.

**What is untouched.** `[HC-77]` (a place reaches for a tier only once the tier below is secure) and
`[HC-83]` (clearing is summation, per neighbourhood, per class, in tier order) are **unchanged** —
the gate governs **demand**, and demand is keyed to population and to capital-work count, neither of
which this touches. What changes is only **which class a town's offer lands in.**

**Three consequences to carry into implementation, because they are not obvious:**

- **A work with no produce has no cargo class**, and earns as a cut of the traffic riding on `access`
  alone — a warehouse, a customs house, a tavern, a market. **`shipway` joins them**, which is right
  for a harbour work and is a real change: its earnings now ride on access, and it is no longer
  exempt from the materials build-gate. *You do need planks to lay down a shipway.*
- **The columns are unchanged.** Victuals are counted in a work's `food` column and materials and
  luxury in its `trade` column, exactly as today. Only the *keying* moves.
- **The materials exemption re-keys to the produce**, and stays one fact with one source
  (2026-09-16, `[HC-87c]`'s amendment): *a work that produces materials is not gated by materials* is
  read as `produce ∈ {timber, stone}` rather than as `exports === "materials"`. Same rule, same
  single source, one indirection shorter.

> **A follow-up `[HC-87c]` needs, flagged rather than buried.** Its 2026-09-19 texture correction
> records that *"the shipways stand idle for want of planks"* is carried by **the dependency edge,
> not by the materials bill**. Deleting the edge deletes the sentence. The mechanism that replaces
> it is the market term arguing in coin — *"timber fetches well here"* — which §3.5.4 already
> ratified. **The sentence is not preserved; it is retired with its mechanism**, and that is the
> honest version.

### 2.12.14 The measured finding that justifies the whole direction

**Four of the world's eight produces have no work in the catalogue at all** — `grain`, `cotton`,
`stone`, `salt`. The generator paints, names, describes and draws their ground, and nothing a town
can build will touch it. Measured across every seed:

- **12–22% of every town's bearing regions are inert** — `cottonGround`, `saltPans`, `rockyGround`.
- **9–13% of its hexes.**

Meanwhile **§2.5 has named all eight works since it was written**: *cotton walk · grain fields · cane
field · provision grounds · sawpit · quarry · salt works · fishing shacks*.

> **The spec has been ahead of the catalogue since KAN-85.** The region focus is what closes the gap
> without widening the auction, because a focus expression is not a menu item: **`grainFields` and
> `cottonWalk` are added as focus expressions**, raised by a deepening on ground that bears them, and
> **the governor's list stays eight items long.** That is the structural argument for this direction
> over any alternative that adds works: it is the only one where the catalogue can grow and the
> choice cannot.

### 2.12.15 Deferred, deliberately, to the terrain-kind lockdown

The human has asked for **a lockdown pass over every terrain kind the map generator can paint, and
what each is for**, before any more per-terrain decisions are taken one at a time. Three questions
wait on it, and they are recorded here rather than left as holes:

1. **A quarry, and stone as a second materials source.** **Rocky ground stays dead for now**, so the
   2026-09-16 neighbourhood guarantee (*every market neighbourhood can reach timber*) is untouched.
   Noted as possible later uses: a defence bonus, or ground that is only good for housing.
2. **Salt's trade class.** Absent from §2.12.13's table on purpose.
3. **The depth threshold N for the label ladder** (§2.12.12).

### 2.12.16 Heritage — this is our addition, and the record says which half is not

**Do not invent lineage.** `design-references.md` records, confirmed by the human 2026-09-08, that
*Cutthroats* towns grew in **wealth but not in extent** — so **the original had no land-use decision
at all.** A region focus is **our addition, exactly like the town footprint, and not a restoration.**

**What IS lineage, and it sits inside this direction:** per-town goods prices you trade against,
confirmed by the human as part of the original — *"yes, that allows for trade."* **That is why
goods survive and chains do not.** The half of this that is inherited is the half about prices and
cargo; the half about what a town decides its ground is for is ours, and has to earn its place on its
own terms rather than on the original's.

---

## 3. Works — the ledger

A work has: `kind`, the `parcel` it draws on (if any), a **zone** and **bearing hint** for
placement, a footprint, `since` (the day it first stood whole), and its **standing** — the share of
its fabric that is built (§4).

> **AMENDED 2026-09-19.** The last item read *"and a condition on the devolution ladder"*. The
> devolution ladder is deleted; what replaces it is one number and a cause. See §4.

### Two classes, and the distinction is the anti-spiral floor

- **Subsistence works** — dwellings, fishing shacks, garden plots. **Cost no wealth.** People
  rebuild their own houses and food. This is why a sacked town always crawls back to a hamlet.
- **Capital works** — shipways, boiling house, stone battery, warehouse, customs house. Need
  **money or a patron**. These are what investment unlocks.

### Scale, and why it may grow

~16 **choosable** works (*was ~12; widened 2026-09-08 for the new terrains*) + ~6 **automatic**
civic/defensive ones.

> **AMENDED 2026-09-19 — the choosable set falls to EIGHT, and the catalogue is free to grow past
> it.** The region focus (§2.12.12) turns `sawpit`, `caneField` and `provisionGround` into focus
> expressions and deletes `boilingHouse`, leaving eight works a governor chooses between:
> `shipway` · `warehouse` · `customsHouse` · `battery` · `palisade` · `barracks` · `tavern` ·
> `church`. The works that left the menu **did not leave the ledger** — they are still buildings on
> the ground, still burnable, still counted.
>
> **The line below is now truer than when it was written.** *"The catalogue may grow freely because
> the land is the filter"* had to hold against a menu that grew with it. It no longer does:
> `grainFields` and `cottonWalk` arrive as focus expressions (§2.12.14) and **the governor's list
> does not lengthen by one item.** The filter is no longer only the land — it is the land *and* the
> fact that most of the catalogue is never offered as a choice at all.

> **The catalogue may grow freely because THE LAND IS THE FILTER.** A town with cane, fields and a
> roadstead offers its governor a shortlist of five or six works whatever the catalogue's size, so
> the five-term auction never gets noisier.

**Two gates, not one** (§2.5): **crops and extraction** are gated by graded suitability — a work is
offered if its `produces` appears in `region.bears` at any grade. **Sited works** keep a hard ground
requirement. Mining and smithing stay **simplified** — a quarry region and a work that stands on
it, never an ore → bloomery → smithy chain. Commodity identity, prices and shipping belong wholly
to the trade epic.

### Exactly two dependency edges in the first slice

> **STRUCK 2026-09-19 — both edges are deleted, and with them the concept.** Ratified with the
> region focus: ***"I don't really want to get too much into production chains. It's not that type
> of game."*** `sugar → rum` goes with the `boilingHouse` (§2.12.12) and `timber → shipways` goes
> with the shipway's reclassification as a harbour work. **A work is now a development of a region
> rather than a building with prerequisites.**
>
> **Kept below for the record.** Note what is *not* deleted along with it: **timber is still a real
> good that moves on real ships and fetches a local price.** Goods survive; chains do not.
>
> And the sentence it was written for is retired with its mechanism, honestly rather than quietly —
> see §2.12.13's note against `[HC-87c]`.

~~`sugar → rum` and `timber → shipways`. One level only. Burn the sawpit and *"the shipways stand
idle for want of planks."* That is a production chain the player can feel and we never have to
simulate.~~

### The devolution ladder — SUPERSEDED 2026-09-19

> **STRUCK, and the direction that struck it deletes more than it adds.** The human rejected the
> decay ladder outright: ***"I don't like the 'rot' part."*** Works no longer degrade from neglect at
> all. **Damage has a cause, never a clock** — see §4, which replaces this section entirely.
>
> **What goes with it, said plainly rather than pretended to survive:** the `decayed` grade · the
> whole decay clock (`idleToDecayed`, `decayedToRuin`, and the `idleSinceDay` each work carries) ·
> **rot as a concept** · and **most of KAN-108's mend decision**, which was a per-building governor
> choice priced at a fraction of the raise cost and becomes an **automatic bill** (`[HC-100]`).
>
> **What survives from KAN-108, and it is the best line in it:** *a mend buys a rung, never a jump —
> **labour allocation remains the only thing that ever writes `working`.*** §4 keeps that verbatim: a
> work that finishes mending comes back **whole but idle**, and the hands take the last step. That is
> still what stops a priced repair quietly bypassing the labour ceiling.
>
> **And the under-manning half was always right and is untouched.** `idle` is free and instant in
> both directions, and a town of 2,000 cut to 500 loses production because the hands are gone, not
> because anything broke.
>
> **The original text is kept below.**

~~Works decay in **recoverable grades** — `working → idle → decayed → ruin` — not straight to
death. Each step is legible and each is reversible.~~

> **Built and sharpened by KAN-108 (2026-09-14), because "reversible" was not true below the first
> rung.** The grades differ in **what coming back COSTS**, not in whether it is possible:
>
> | Step | What it costs | Who takes it |
> |---|---|---|
> | `idle → working` | **Hands.** Free — no coin, no decision. | The ledger, in labour allocation |
> | `decayed → idle` | **One rung, and coin** — a fraction of raising the work new (`DECAY.repairShare`) | The governor, as a priced decision |
> | `ruin` | — | Nobody. Terminal. |
>
> A mend buys a rung, never a jump: it returns a work to `idle`, and hands take the last step, so
> **labour allocation remains the only thing that ever writes `working`.** That is what stops a
> priced mend from quietly bypassing the labour ceiling.
>
> **Why coin at all.** A free mend would erase the difference between `idle` and `decayed` and leave
> a ladder whose middle rung meant nothing — and a step that costs nothing is not "legible", which
> is what this section claims each step is. Subsistence works never rot because people keep their
> own roofs on; nobody keeps a shipway's roof on for nothing.
>
> **And correct the record where a stronger claim is written:** a decayed work does **not** sterilise
> its ground. It holds one hex and one `max` slot for `decayedToRuin − idleToDecayed` — four years on
> today's numbers — then ruins and gives both back. Measured. It is a hold, not a sterilising.

---

## 3.5 The trading engine — wealth is EARNED, not emitted

*Ratified 2026-09-08. Rationale: [`../decisions.md`](../decisions.md), top entry — "Towns trade".
Tickets: **KAN-54** (epic) → KAN-91 · KAN-92 · KAN-93 · KAN-94.*

> **A town buys what it needs and sells what it has spare. Its wealth is the difference.**

**What this replaces.** `yield = trade + grant - upkeep`, where `trade` was a flat number each work
emitted — a sawpit simply produced coin. And `surplus: food - mouths` was computed every season and
spent on nothing but a prosperity nudge: **surplus was never sold, deficit was never bought.**

### 3.5.1 The equation

```
yield = SUM(sold x price x access) + grant - imports paid - upkeep
```

**Imports are paid BEFORE construction.** Bread before batteries — which produces the good failure
state: *"they spend all they make on corn."*

`trade` on a `WorkDef` is **reframed, not replaced**: it is what a work sends to the quay. Coin is
`trade x price x access`. The steer's three structural yield columns are untouched.

### 3.5.2 Who they trade with — "the shipping"

The partner is **the merchant traffic that calls at the roadstead**: not "the world", and not (yet)
named neighbours. Diegetic rather than abstract — it is a thing you can see, blockade, and *be*.

**Two seams let the named version arrive without a rewrite**, both copying the ratified
profile-supplier precedent of `region.bears`:

| Seam | First slice | Later, unchanged at every call site |
|---|---|---|
| `priceOf(town, produce)` | a flat table x a local modifier | reads a regional market of named towns |
| `access` (0..1) | derived from harbour works + security | reads real routes and blockades |

`access` multiplies **both** directions. No quay, no security → nothing moves either way.

### 3.5.3 Sells by produce, buys by need

**Asymmetric on purpose.** Exports are named `Produce`, because **identity lives on the export
side** — "a timber town". Imports are a short need list, because nobody cares *which* cloth a
colony buys, only that it buys its bread:

**THREE classes, as amended 2026-09-09:** **victuals** (population) · **materials** (construction) ·
**luxury** (the top of the pyramid). The first slice ships **victuals only**; materials follow, then
luxury.

> **AMENDED 2026-09-19 — a cargo's class is a property of the PRODUCE, not of the work that gets
> it.** One table: **victuals** = `food` · `fish` · `grain` · **materials** = `timber` · `stone` ·
> **luxury** = `cane` · `cotton`. See §2.12.13 for the table, its three non-obvious consequences, and
> why it makes `[HC-77]`'s pyramid mean *more* rather than less. **The three classes, the tier gate
> and the clearing are untouched** — only the keying moves.

> **AMENDED 2026-09-09 — luxury is restored; munitions stay cut.** The line below read *"comforts and
> munitions were CUT"*. The human restored the comforts half as **luxury**, and as a **need with
> teeth**: a town whose victuals and materials are covered then wants luxury and **goes short without
> it** — which is what makes the needs pyramid a pyramid rather than a list. The duplication
> objection is answered by making the appetite a *need* rather than a second prosperity meter.
> **Munitions remain cut** and still modulate **security**.
>
> **And a new rule the original decision never had: luxury is trade cargo, not the default plunder
> payout.** *"Luxury goods as trading is fine. Jewels as a standard raiding currency is what I pushed
> back on."* A raid does not pay out in jewels by default.

**Munitions were CUT.** They duplicated **security**, which already exists — two systems doing one
job is exactly the failure this avoids. If a town's appetite for powder ever needs a voice, it
**modulates the existing measure** rather than becoming a fourth good.

**Materials are the point of the second class:** a town that cannot get timber and stone **cannot
build**, however rich it is — so razing the quay of a stone-poor island stops it rebuilding its
wall. Its coffers may be full; it simply cannot get the stone.

**A town tracks a FLOW BALANCE, never a stock.** `derive()` gains a `commerce` block computed from
the ledger exactly as `food` and `trade` are today. The ratified do-not-build item *"an in-town
goods inventory"* survives verbatim.

### 3.5.4 Self-sufficiency — no new term, no threshold

Most settlements try to be as self-sufficient as possible; only a metropolis leans on the shipping.
That is **a preference, not a rule**, and it costs exactly two edits inside the existing five-term
auction:

1. **The food `need` term rebases from HUNGER to DEPENDENCY.** It scores *the share of the town's
   victuals that came off a ship*, not whether anyone is hungry. A town buying a third of its bread
   scores 0.33 **with full bellies**. Clause: *"too much of their bread comes off a ship."*
   **This is the load-bearing line — it is why importing never silences the wish for a farm.**
2. **The `market` term scores what a work would actually FETCH** — `trade x priceOf x access` —
   rather than a flat constant.

The fork is then honest arithmetic: **`need` argues for the farm, `market` argues for the cane.**
Self-sufficiency wins in a small town and loses in a big one, **with no threshold anywhere.**

### 3.5.5 Dependency — and the metropolis question, PARKED

**`dependency` stands and is not in question.** `dependency = imported victuals / total victuals`,
**derived, zero stored state**, banded into one word for the town card: *self-feeding · mostly
feeds itself · leans on the shipping ·* ***fed from the sea***. It writes its own clause, it is
what the `need` term reads (§3.5.4), and it is the most raid-relevant fact about a big town.

> **PARKED 2026-09-08 — do not decide this here.** *Whether a town's CLASS (village → town → city
> → metropolis) emerges from its own growth, or is authored when the world is made,* is **the
> human's call and he has explicitly reserved it**: *"this describes how the entire world works."*
> A recommendation of *emergent* is on file. **It is not ratified and must not be assumed.**
>
> **Nothing in the first slice depends on it.** `dependency` measures one town's own balance and
> needs no world model at all, so **KAN-91 is not blocked** — build against `dependency` and leave
> *town class* alone. Note that `tierOf` already derives a tier today; **that code is inside the
> scope of the parked question, not outside it**, and should not be extended until it is settled.

### 3.5.6 What replaces the ~450-soul ceiling

Population was capped at `foodCap = localFood / perHead`, so no town could outgrow the ground it
farmed — which is why towns claim only 1–3 of ~24 land hexes in a century. **Bought food lifts that
cap**, and four limits already in the model replace it:

1. **Coin.** `pop ~= export revenue / (import price + upkeep/head)`. **The ceiling is set by the
   land's QUALITY, not its acreage.**
2. **Access.** No quay, no security → nothing moves.
3. **Ground for houses** — the footprint (§2.11), now biting harder: claiming a provision hex
   raises the grain bill.
4. **Hands** — `labourShare`, unchanged.

> **The old ceiling was solid; the new one is FRAGILE.** A trade-fed town of 1,500 falls back
> toward 450 if you burn its quay. **Ceiling and raid consequence are the same mechanism.**

### 3.5.7 The port seam

Exactly three things are exposed, so the town menu has something real to talk to:
`derive(town).commerce` · a public pure `priceOf()` · and **two write-points**,
`sellTo()` / `buyFrom()`, each nudging the local price by `qty / seasonal flow`.

> **The player is a small fish. Cap the nudge.** Otherwise the first thing anyone discovers is that
> they can buy out a town — an exploit, and a betrayal of "the world runs without you".

### 3.5.8 Two calibration hazards, known in advance

- **A live bug this change triggers.** `prosperityTarget` scores `surplus/head` **positively**. A
  metropolis has negative surplus *by design*, so every large town will read as "on its knees" the
  moment imports exist. **Replace that term with `dependency` as a mild negative.**
- **The oscillation failure mode** (observed in Bannerlord): a town outgrows what its exports fund
  → coffers empty → food unbought → population falls → regrows → repeats. `POP.drift` should damp
  it; **watch for it explicitly in the long run.**

### 3.5.9 Never build

Per-good town stockpiles · elasticity curves · goods physically shipped between AI towns ·
**an omniscient cross-town price table**.

> **ONE CARVE-OUT, ratified 2026-09-09.** *Goods physically shipped between AI towns* still holds for
> **ordinary cargo** — inter-town trade resolves as **flows between named neighbours**, and the sails
> you see near you are a materialisation of those flows, never a second source of truth. The
> exception is the **four war-currencies** — treasury · reinforcements · **charter** · invasion force
> — which **are** permanent, interceptable objects wherever they are, because that is the whole of
> how a player tips a war. There are only ever a dozen or so in the world at a time. See the
> three-ring model in `decisions.md` (2026-09-09): **a ring is a rendering and interaction boundary,
> never a simulation boundary.**

**Guardrail clarified:** the ratified ban is on *the price **table*** — the arbitrage-enabling god
view — **not on prices existing**. You learn a price by going there, or by **bribing the
harbourmaster**, which gives rung 1 of the ratified bribery ladder a second thing to sell.

---

## 4. Damage — what a storm, a raid and an invasion all do

*Rewritten 2026-09-19, and it replaces §3's devolution ladder outright. Authority:
[`../decisions.md`](../decisions.md), **"Damage has a cause, never a clock; and the town remembers"**,
plus the human's correction on durations of the same date (§4.6). Ratified alongside §2.12, and
**neither is safe to revisit alone** (§2.12.6).*

> **`[HC-99]` DAMAGE HAS A CAUSE, NEVER A CLOCK.** Nothing in a town degrades from being poor, idle
> or unloved, and **no work carries a neglect clock.** Works are hurt by **named events** — a storm,
> a raid, an invasion — and they are put back with **coin and time**.

**`[HC-99]` is the one that makes the rest cheap**, and it is worth saying what it forbids: no
`idleSinceDay`, no threshold in days after which an unworked shed is worth less, no maintenance
condition that falls if the town is poor. **If a work is worse off than it was, some named thing did
it, and the chronicle can name it.** That is also what makes `[HC-18]` — *only a deliberate hand
empties a town* — stronger than it was: with rot deleted, **nothing decays to ruin at all**, so the
only routes to `Abandoned` are a player, a war (`[HC-50]`), and running out of people.

**The human's words, and they are the specification:**

> *"I like that the town remembers. I like that if a pirate sets buildings alight, or if an invasion
> force hits an area, that viewing it later still shows the repair process. I also want storms to
> tie into this damage mechanic…*
>
> *I don't like the 'rot' part. If a town of 2000 had a booming industry, and got invaded, and pop
> is down to 500, it makes sense that production takes a hit, because they can't man everything.*
>
> *The supplier part seems a bit confusing. Again, this is not a city builder where production
> chains exist. When I spoke about the maintenance cost associated with things, it was monetary…
> having to repair something because of storm, invasion, raid just has an income impact until
> everything is restored."*

### 4.1 Three states, and only one of them is new

| State | What it is | Reversible? |
|---|---|---|
| **Idle** | **Under-manned.** Not enough hands to work it. | **Free and instant, both ways.** Already built; needs no change at all. |
| **Damaged** | Hurt by a named event. **Visible on the ground.** | Put back with **coin and time**. |
| **Destroyed** | Taken outright — a tempest's tail, or deliberate razing. | **Never.** And the ruin **stays on the map.** |

**The under-manning half already works exactly as described and is not touched.** Labour allocation
idles what cannot be manned and un-idles it the moment hands return. A town of 2,000 cut to 500 loses
production because the hands are gone, not because anything broke. **It was only the rot sitting on
top of it that went.**

### 4.2 `standing` — one number, and it is a DEGREE, not a grade

> **A work's `standing` is the share of its fabric that is built: 0 to 1.** Whole is 1. A building
> with half its fabric gone stands at 0.5. **Destroyed is the endpoint of the same scale**, not a
> separate category with rules of its own.

*Ratified by the human 2026-09-19 in correction: **"A building with half health takes half the
time."*** Half health is a proportion of the fabric missing. It is not a rung on a ladder, and the
spec does not give it one — **discrete damage grades are rejected for the same reason
`ParcelQuality` was struck:** a second axis with the meaning taken out of it, and two dials for one
feeling is a tuning trap.

**A work that is not whole does not work.** It contributes nothing to the ledger until `standing`
reaches 1 — no food, no trade, no defence, no `serves`.

**Why not a proportional yield, which looks more natural:** a half-built sawpit obviously saws no
timber, so a half-mended one does not either — **the same rule, which is the whole point of writing
one mechanism instead of two.** It also keeps the yield arithmetic untouched: works already store
their scaled yields at the moment they are raised (suit, sweet spot, reach, depth premium), and a
second per-season scaler over the top of that is `[P-47]` waiting to happen. And it reads in one
sentence — *"the mill is down while they mend it"* — where a fraction reads as a spreadsheet (§1.1).

**Stored state is unchanged, not increased.** `standing` **replaces** the `idleSinceDay` each work
carried for the decay clock. One number out, one number in, and the new one passes `[HC-14]`'s own
test — *could this have been recomputed?* — with a flat no: a storm's bill is history, and nothing in
the ledger remembers the storm.

### 4.3 Construction and repair are ONE act

> **`[HC-101]` Raising a work and mending one are the same act: `standing` rising toward 1.**
> **Both are priced and timed by the share of fabric missing.** Half gone: half the coin and half the
> time. Wholly gone: the whole of both — a work destroyed and raised again costs exactly what it cost
> to raise the first time, because that is exactly what is being done.

*The human, ratifying it:* ***"A fully destroyed building takes the same amount of time as building
it from scratch. A building with half health takes half the time."***

**So construction is not instant either, and never was in fiction.** A work is **commissioned**, and
then it is **in hand** — standing rising, producing nothing, visible on the ground as scaffolding —
until it is whole.

**`in hand` is one state with two causes, and that is deliberate.** A work going up and a work being
put right are the same arithmetic; the only thing that distinguishes them is whether there was ever a
whole work there, and the ledger already knows that from `since` (the day it first stood whole, and
absent until it does). **The projection draws scaffolding on the one and scorching on the other off
that single bit.** No second field, no second mechanism.

**Four readings, and only `in hand` is new:**

| Reading | `standing` | Manned? | Produces |
|---|---|---|---|
| **working** | 1 | yes | everything it is worth |
| **idle** | 1 | no | nothing — free and instant both ways |
| **in hand** | 0 < s < 1 | — | nothing, and the ledger says why |
| **ruin** | 0, by damage | — | nothing, ever. Holds no ground; the scar stays on the map |

**A ruin is not a work.** It is struck from the working ledger, **its hex is freed**, and it stays on
the books only so the map can draw it (§7, contract 5 — *a ruin on the hex is a burnt shell on the
ground*). **Freeing the hex is what keeps `[HC-87]` alive**: the potential sits there waiting, and a
town that was burned can be a town again — which is the whole argument for occupying rather than
razing. Raising a new work on that ground is **a new work**, at full cost and full time. It is not
the old one returning, and the human's *never* survives exactly.

**Weather may knock back a work in hand**, and it needs no special case: the same subtraction from
the same number. *"They had the warehouse half up when the second blow came."*

### 4.4 What it costs — coin and time, and the two bind differently

The two constants of proportionality are **the work's own raise cost** and **the work's own build
time**. Both are catalogue columns, both scale by the missing share, and the second is new.

```
to put a work right:   coin = (1 − standing) × cost       time = (1 − standing) × buildTime
```

**Why the bill is priced against THE WORK and never against the coffers.** This is already ratified,
2026-09-15, and the reasoning transfers verbatim: a bill taken as a share of the purse means *a town
with a million pays a thousand times more to mend the same fence than a town with a thousand.*
Priced against the work, **the same storm sends the same bill to every town, and only the share of
the purse it takes differs** — which is the right way round, and is why a poor town still feels a
storm more sharply.

**Coin and time are two ceilings on one thing — the fabric restored this season — and they bind in
different places.** This is §5.6's two-gate shape a third and fourth time, and it reads the same way:

| Limit | The clause |
|---|---|
| **Coin** | *"the masons are idle for want of coin"* |
| **Time** | *"they have the money; the masons are still at it"* |

A rich town is limited by the calendar; a poor one by the purse. **Nothing needs to decide which** —
whichever is scarcer binds, and the town card says which.

### 4.5 Repair is automatic and comes off the top

> **`[HC-100]` Repair is automatic and comes off the top. The town mends itself, and the governor
> never chooses between a repair and a warehouse.**

**The consequence is legible without surfacing a choice**, which is the whole design:

> ***"Sarmiento builds nothing this year; the town is still mending."***

**Where it sits in the season: bread, then mending, then batteries.** `[HC-78]` pays imports before
construction; mending goes between them, in **phase 3 (SETTLE)** — after the quay is paid and before
the governor decides anything in phase 4. That placement is forced rather than chosen, and §5.6
already states the rule: **nothing in phase 1 may spend coin**, because it would come out of the
purse the town buys its corn with.

> **`[HC-78]` is EXTENDED, not superseded.** *Bread before batteries* becomes ***bread, then
> mending, then batteries***. The failure state it was written to produce — *"they spend all they
> make on corn"* — gains a sibling: *"they spend all they make putting the place back together."*

**Order of repair: `worthOf` — food first, then guns, then coin, and the elder work on a tie.** This
is the existing order, hoisted out of the labour allocator precisely so that one function decides who
gets the last hands *and* which hurt work is put right first. **Do not write a second order**
(`[P-47]`).

**No cap on the share of a season's yield that repair may take, and none is needed.** A town pays
what it can; whatever is left, the governor may spend. A small bill is settled in a season and he
still builds. A big one eats the purse and he builds nothing — **the sentence falls out of the
arithmetic rather than being tuned into it.**

### 4.6 A duration is not a decision — and this is where §1.1 was misread

> **`[HC-102]` A work in hand requires no decision from anyone while it stands unfinished.
> Commissioning is the decision; the duration is a consequence.**

**§1.1's ban is on a RECURRING DECISION on a timer** — *"no weekly loyalty tick, no per-officer
upkeep, no morale accounting the player has to service."* It bans a **chore**. A build that takes
three seasons asks nobody for anything in the second and third, so it is not what §1.1 forbids, and
saying otherwise would forbid the passage of time.

**And the decay clock the human deleted was not rejected for being a clock.** It was rejected because
things should not **degrade from neglect**. Those are three separate things and only the middle one
was ever refused. *Recorded here because the manager conflated them, and the human corrected it.*

**The world already has this pattern ratified.** `[HC-8]` — *a promotion is decided in phase 5 and
delivered later* — and `[HC-45]` — *a dispatch is credited on arrival, never on decision* — are the
same shape: **decided now, arrives later.** Construction joins them, and gains the same virtue:
**a thing in transit is a thing a raider can interrupt.**

**What the governor does meanwhile.** Three rules, and they are all about keeping the cadence he
already has:

1. **The season's ONE decision is to commission** a work. That is unchanged.
2. **ONE COMMISSIONED WORK IN HAND AT A TIME.** He does not start a second while the first is up. It
   is the same scarcity the one-decision-a-season rule already expresses, told honestly across a
   duration — and it is what stops a rich town starting six things at once and turning the
   wants-list into a build queue somebody would want to manage (§1.1).
3. **Mending is not commissioning, so the limit does not bind it.** A town mends everything it can
   pay for at once. A town the week after a hurricane is a town full of scaffolding, and it should
   look like one.

**The wants-list gains a head, not a change of shape.** It is still three deep, still inspectable,
still not controllable — its top line is now sometimes a thing already begun:

> *A warehouse on the quay — **in hand, half raised** · a battery on the bluff · a second tavern.*

**Balance consequence, flagged because it is real and not yet measured.** Build durations slow every
town's development, and `[HC-22]`'s warm start — the day-0 world founded by running forward — was
measured **without** them. **The city band (84–834 against a ratified 450–600) will move, and it will
move down.** This must be re-measured on the warm start before any conclusion is drawn from it, and
it may well want compensating elsewhere. Do not tune the durations to rescue the band without saying
so.

### 4.7 Two gates on a repair, inherited whole from §5.6

§5.6 states the general form: **never buy a state change unless the work would actually go back to
work.** With repair automatic rather than chosen, that rule stops being prudence and becomes
**necessary**, because nobody is left to exercise judgement:

1. **The ground must still be there.** A work whose hex the footprint has claimed can *never* work
   again — claimed ground is permanent — so paying to mend one is an **unbounded leak by
   construction**. **Resolution: a work whose ground the town builds over is DESTROYED, not
   mended.** The bill is written off, the ruin stands, and the leak is closed by construction rather
   than by a check anybody has to remember.
2. **There must be materials to be had.** Timber and stone gate repair exactly as they gate raising
   (§3.5.3, `[HC-87c]`). A town that cannot get them simply does not mend — the bill stands
   outstanding and says so: *"there is no timber to mend it with."* **And the 2026-09-16 exemption
   applies here too, or the rule would be true of one verb and false of the next:** a sawpit that
   has been burnt is still a work that produces materials.

**Hands are deliberately NOT a gate.** A mended work returns **whole and idle**, and hands take the
last step for free. That is KAN-108's surviving rule (§3) and it is what keeps **labour allocation
the only thing that ever writes `working`.**

### 4.8 What this deletes, and what it unifies

**Deleted, plainly:** the whole decay clock · `decayed` as a grade · **rot as a concept** · supplier
chains (§3) · and **most of KAN-108's mend decision**, which becomes an automatic bill.

**Unified — and this is the part that pays for the rewrite.** Storm damage, raid damage and invasion
damage are today **three separate paths**: weather has its own route into the works ladder and
raiding has another. They become **one state with one bill**:

| Cause | What it does | What is left of the old special case |
|---|---|---|
| **A storm** | Subtracts a share of fabric, sampled at the place and the moment of contact | Nothing. It is the general case now. |
| **A raid** | Subtracts a share — a torched work is heavily damaged; a razed one is destroyed | Loot is untouched: it takes wealth and leaves the work standing |
| **An invasion** | Subtracts a share over an area | Nothing. `[HC-49]` still transfers a place with its ledger intact |

**And the weather's existing `maintenanceShare` is the same idea at its smallest size** — a blow that
scuffs a town and costs it a little coin. **They are kept distinct for now, and the reason is
legibility rather than principle:** the maintenance bill is *unnamed wear* (coin, no work enters a
visible state) and damage is the *named* form (this work, this share, visible from the beach).
**Folding them entirely is available and would be cheaper — flagged for the human, not decided
here.** `[HC-36]` is untouched either way: *"contents spoil"* remains a one-off wealth loss and there
is still no stockpile to deduct from.

### 4.9 The point, in one line

> **A raid stops costing you buildings and starts costing you YEARS.**

You spend on repairs instead of on growing, and the years you lose are the years you would have used
to get bigger. **That is a far better answer to *"why does being raided hurt"* than watching sawpits
rot** — and it is the answer the human asked for: *"an income impact until everything is restored."*

### 4.10 The numbers are deliberately unfixed

**No build time in this spec is a ratified figure, and none should be quoted as one.** The human is
explicit:

> *"I don't know what those numbers are yet. It ties into the zoning tile upgrade mechanism which we
> haven't really done too much with yet. So don't need to try and get the timer values perfect."*

**What this document fixes is the SHAPE:** one act for construction and repair · both proportional to
the fabric missing · the work's own raise cost and build time as the constants · coin and time as two
ceilings on one thing. **What it leaves open:** every duration, the placeholder scale, and how build
time relates to the **zoning tile upgrade mechanism** that does not exist yet. Per `[HC-90]`, the
durations are a **table**; what is in this section is the **behaviour**, and only the behaviour is
being ratified.

**Placeholder, so the first story has something to run against and nobody mistakes it for a
decision:** *build time rises with raise cost* — a tavern is a season's work, a stone battery is
several years'. **Written as a derivation from `cost` rather than as a second hand-tuned column**, so
there is one number a person tunes until the zoning work says otherwise (`[P-47]`).

### 4.11 What raiding does — the actions

**Loot and raze must do different things**, or pillage-vs-raze is a flavour choice.

> **AMENDED 2026-09-19 — read the Recovery column against §4.3 above.** *"Torch / raze"* splits into
> two acts with two costs: **torching** a work takes a share of its fabric and it is put back with
> coin and time; **razing** it destroys it, and that never comes back — a new work on that ground is
> a new work. The *"since the burning"* bonus applies to the second, because there is a decision to
> bias: something must be raised anew. **The recovery times below are superseded** by *(1 −
> standing) × build time*, which is the same claim with a mechanism under it.

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
| **The market wants it** (export demand ~~/ an idle downstream work~~) | ~~*"the shipways want planks"*~~ → *"timber fetches well here"* |
| **Fear** (security deficit vs. recent threat) | *"since the burning, the town wants guns"* |
| **The patron's agenda** (crown / company / **you**) | *"the Governor of Cartagena wants a customs house here"* |

> **A structural limit on this auction, found by KAN-108 and worth knowing before the next ticket
> tries.** **The five terms score a KIND, not an INSTANCE.** The land term reads the best *free*
> ground for a kind; the market term reads the catalogue's trade figure. A standing work has neither
> — its ground is underneath it, and its trade is already scaled by that ground's suit and reach.
>
> So anything about a *specific standing work* — repair, upgrade, demolition — cannot be scored by
> these terms without opening a **second path to a value the instance already holds**, which is
> `[P-47]`. Worse, the auction cannot always see the want at all: while a decayed work holds its hex,
> `roomFor` is reduced and its kind may drop out of the wants-list entirely — **the thing that
> creates the need to mend is the thing that hides it from the auction.**
>
> Instance-level verbs therefore sit **beside** the auction, competing for the season's one decision,
> rather than inside it. ~~Mending is priced below raising, so a governor who can mend does so
> first.~~
>
> **AMENDED 2026-09-19, twice over, and the structural finding is worth MORE than it was.**
> **(1)** Mending is no longer a governor's decision at all — it is an automatic bill taken off the
> top (`[HC-100]`, §4.5), so the last sentence goes. **(2)** The slot it vacates beside the auction
> is immediately re-occupied: **a DEEPENING is the new instance-level verb**, it names a region that
> already carries works, and it must be scored from that region's own ground rather than from the
> catalogue (`[HC-97]`, §2.12.10). **KAN-108's finding outlived the decision it was made for**, which
> is the strongest possible argument that it is structural.

### 5.1.1 What the auction weighs after the region focus

*Added 2026-09-19. The five terms are unchanged; what changes is the set of things they are asked
about.*

**Two candidate types, and they never share a scoring path:**

| Candidate | How many | Scored by |
|---|---|---|
| **A capital work** | **eight** (§2.12.12) | The five terms, on the KIND, exactly as today |
| **A deepening of a focused region** | one per focused region with free ground | The region's own ground — `potential × free capacity × local price` (`[HC-97]`) |
| **A focus for an unfocused region** | one per unfocused region | The **four-termed** focus auction — land, need, market, agenda; **never `fear`** (`[HC-96]`, §2.12.9) |

**Wealth remains the budget gate and is still not a term.** A focus costs no coin at all (§2.12.6),
which means it is the one candidate the budget gate never touches — so a town with empty coffers can
still decide **what its ground is for**, and that is right: deciding is free, doing is not.

### 5.1.2 The purpose gate re-keys to the produce

`[HC-81]` survives **verbatim**: *dependency is scored identically for every place, whatever its
purpose*, and importing never silences the wish for a farm. What purpose changes is still only
**what the governor may do about it** (§11.3 of [world-simulation.md](world-simulation.md)).

**But the gate's key has to move.** It currently names a `WorkKind` — *a royal outpost never raises
`provisionGround`* — and after the collapse **there is no per-crop kind left to name**: provision
grounds are a focus expression, not a menu item.

> **Re-key the gate to the PRODUCE, and apply it to the FOCUS rather than to the work:**
> ***"A military purpose never sets a production focus on food ground."***

That is the same rule, one level up, and it is strictly better: the outpost still **publishes** the
wish (*"too much of their bread comes off a ship"*), still never fulfils it, and now cannot fulfil it
by a side door either. **And subsistence works stay outside it entirely** (`[HC-98]`) — the outpost
still keeps its garden plots, exactly as today.


### 5.2 The explanation IS the score

The one-line reason is **assembled from the top two contributing terms** — never written
separately, never a rationalisation after the fact:

> *The governor sets sawpits above the creek — the hills are timbered and ~~the shipways want
> planks~~ **timber fetches well here**.*
> *Sarmiento raises a stone battery on the bluff — since the burning, the town wants guns.*
> *Quartermaster Roche throws up a careenage in the cove — your ships need somewhere to heel, and there is money for it.*

*Amended 2026-09-19: the first example's second clause was carried by a dependency edge and the edges
are deleted (§3). **The form of the sentence is untouched** — top two terms, in their own words — and
the market term now argues in coin, which is what §3.5.4 ratified it to do. The focus auction writes
sentences of the same shape from four terms rather than five: **"Sarmiento gives the north hills over
to timber — the hills are timbered and it fetches well here."***

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

> **MOVED 2026-09-08 — this is no longer part of the town sim.** The human withdrew the investment
> slider and ruled that *"for now let changes to the town happen only through the natural growth
> engine"*. The steer is a **player** lever, so it moves to the town menu (**KAN-89**) and ships
> only when that exists. **The design below is not withdrawn** — one focus over a priority order,
> the three guards, and "the louder voice writes the clause" all remain the right answers. Only its
> home has changed. See [`../decisions.md`](../decisions.md), top entry.


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

> **AMENDED 2026-09-19 — the REGION FOCUS takes this slot. It is NOT a fourth arm.**
>
> The optional named line stops being named by its **output** and starts being named by its
> **ground**: *"the cane"* becomes ***"the cane flats to the south-east."*** What the player sets is
> a **focus on a named region** (§2.12) — one at a time, naming a second replaces the first, and the
> land still answers in the same three registers below.
>
> **The three-armed steer is untouched and its structural bound survives verbatim.** *Guns · coin ·
> hands* are the three yield columns on a work, and *"a fourth focus would need a fourth thing a
> work can produce"* is still the reason there are three. **A region focus is not a fourth arm
> because it is not an arm at all** — it answers a different question. The steer says *which way to
> lean this town*; a focus says *what this piece of ground is for.*
>
> **And it is still thematic, so §5.8's governing principle still decides who may set it:** the
> governor sets a focus everywhere, the owner sets one in his own haven, and the player never points
> at a hex in a town he does not own. **`Town.grantedToTown` is deleted** and the spatial steer of
> §7.6 becomes this — see §2.12.8.
>
> **The refusal register does more work than it used to.** *"There is no ground for cane here"* is
> now the answer to a focus as well as to a line, and it is answered by the same `bears` table.

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

> **The gate generalises, and any new verb that spends coin on a work needs it (KAN-108, 2026-09-14).**
> *raise → rot → raise* and *mend → rot → mend* are the same pathology wearing different clothes. The
> general form: **never buy a state change unless the work would actually go back to work.** Four
> conditions, and they are the allocator's own — hands spare, ~~supplier standing~~, materials in the
> market, and **ground not built over**.
>
> **AMENDED 2026-09-19.** *Supplier standing* is deleted with the dependency edges (§3). The general
> form is **untouched and matters more, not less** — with rot gone there is no *raise → rot → raise*
> loop left, but repair is now **automatic**, so nobody is left to exercise judgement and the two
> surviving conditions have to hold by construction. See §4.7 for how each is closed: **ground built
> over destroys the work rather than billing for it**, and materials gate a repair exactly as they
> gate a raising. Hands are deliberately not a gate, because a mended work comes back **idle** and
> the allocator takes the last step for free.
>
> The buried case is the sharpest, because claimed ground is permanent (§2.5): a work the footprint
> has claimed can *never* be worked again, so paying to mend one is an unbounded leak by construction,
> not merely a waste. Measured on a presidio with ninety thousand coin and six souls: **0 mends in
> sixty years** — the gates bite before the money does.

> **And a constraint on WHERE a priced decision may live, which is general and was not written down.**
> `[HC-78]` pays imports before construction, and the works ledger (`stepWorks`) runs in **phase 1,
> PRODUCE** — before the quay is paid in phase 3, SETTLE. So **nothing in phase 1 may spend coin**:
> it would come out of the purse the town buys its corn with, which is bread-before-batteries
> inverted. Every priced decision in this module therefore sits with the governor, after settlement.
> **The ledger cannot mend anything by itself, and that is structural rather than stylistic.**


### 5.7 Cadence

The beat is a **season** (4/year). **The town never prompts.** It reports in prose, in batches,
when you visit or when word reaches you.

---

## 6. Archetypes, funding, and the slider

> **AMENDED 2026-09-08 — the slider is WITHDRAWN; the archetypes stand.** The archetype table below
> is unchanged and is now **KAN-95**. "Funded by" is re-read under §3.5: a colony lives on **its own
> trade** plus a small charter grant, and a stipend's whole personality is that it is **independent
> of trade** — an outpost never chases a market, never becomes a metropolis, and ~~is barely worth
> blockading~~. Everything about the *slider* is superseded (**KAN-72**, closed).
>
> **AMENDED AGAIN 2026-09-09 — two changes, and the second inverts a conclusion.**
>
> **(1) "Archetype" is retired as a taxonomy.** The three names were *"examples of how they fit into
> the world"*, not a classification. A place is described by **size × purpose × faction**; what this
> table's rows actually carry in code moves onto those axes — **purpose supplies the governor's build
> priorities, funding supplies the sprawl temperament.** The table survives below as *worked examples
> of common combinations*, which is what the human always meant by it. Note for the record: the
> archetype field was **never** the funding model — funding is already separate.
>
> **(2) "Barely worth blockading" is STRUCK, and its idea relocated.** An outpost now **imports the
> majority of its needs** (its purpose is military, not industry) and its crown support arrives as an
> **interceptable shipment** rather than a number from nowhere. That makes it **the most
> supply-fragile place on the map** — the exact inverse. The funding independence stands: its coin
> still comes from the crown and it still never chases a market. What replaces the struck clause:
> **an outpost is a poor raid and an excellent interception** — little to loot, but a lifeline you can
> cut. *"A target worth declining"* survives, for the **raiding** verb only.
>
> Also ratified: **an outpost buys its victuals with the crown's grant**, which the §3.5 equation
> already permits — so, naming the replacement ceiling as the rules require, **the grant is the
> outpost's population ceiling.** And an outpost is otherwise **a town with a narrowed purpose**: same
> mechanics, same governor shaping its growth, but *"its growth will always just be shaped by its
> purpose, whereas towns have a bit more flexibility."*


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

### The investment slider — WITHDRAWN 2026-09-08

> **Struck by the human:** *"Ignore this slider. it was meant to test something, but we'll address
> that as part of Towns menu... For now let changes to the town happen only through the natural
> growth engine (population growth, internal trading engine, weather systems)."*
>
> **Kept below for the record only — do not build any of it.** Investing coin in a town moves to
> the town menu (**KAN-89**); the archetypes it was bundled with move to **KAN-95**. Divergence
> between towns must now come from **land, archetype and weather**, not from a funding dial.


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

**Stage 4 — ROADS FIRST, buildings hung off them** *(amended 2026-09-08; supersedes the jittered
block grid)*. Stages 1–3 now output a **street graph** — nodes, polyline edges, each with a rank
(`spine` / `lane` / `track`) and a width — and stage 4 places buildings by **frontage setback**
along it, rotated to face their street.

> **What reads as a street is not the void — it is the two facing frontage lines.** Two offset rows
> of aligned buildings read as a street even when it doglegs; irregular gaps between jittered
> blocks read as noise, because nothing tells the eye which gap is a thoroughfare.

- **Doglegs, never curves.** One or two angular kinks per street. Cheap, reads organic from above,
  and tactically meaningful where a smooth curve is inert — a dogleg breaks a firing lane.
- **The plaza is an authored VOID**, oversized and sized by `core`. Nothing stands in it. Void is
  what reads as *objective*.
- **One loop is mandatory** — a back-lane closing a circuit. A tree-shaped network makes the raid a
  corridor crawl the garrison holds at a single choke.
- **A visible width hierarchy.** The spine is plainly the widest thing on the map. Without it the
  eye cannot find the axis, and there is no approach to read.
- **Rotation jitter stays under ~4°.** Beyond that the frontage line breaks, and the frontage line
  is the whole illusion.
- **`core` grade drives street width and frontage pitch.** That is the entire density model, and it
  is how "past the one ring, growth raises density not extent" is implemented.
- **Adjacency rule 8 (foot-connectivity from the quay) is now true by construction** and needs no
  validator.
- **Calibration: ~800 paces per hex** — the claimed set plus one ring then reproduces the scale of
  the hand-authored raid map, which already plays. **Hard extent cap ~4000 paces.**
- **`beyondThePale` works are placed by the hex→paces transform**, not by a spreading rule: a work
  stands on its own hex, nudged townward, snapped to its region's track. Contracts 1, 3 and 9 all
  fall out of that one transform, and it has no spatial degrees of freedom — so it can never become
  a packing problem.
- **THE HEX MAP IS A ZONING OVERVIEW, NOT A SCALE MAP** *(ratified 2026-09-08, fourth)*. A hex is
  not a measured acreage; it says what that ground is for and roughly where it lies. So the plan
  **interprets** the ledger rather than scaling it: **the ledger gives the SCALE, the plan gives the
  FORM.** Works are grouped by `(region, kind)` and drawn as one installation sized by count — a
  `dwellings` work is a cluster of huts, three timber works on one region are a mill and its yards.
  *(This was first recorded as "the one sanctioned exception to work-to-building parity". It is not
  an exception — it is the general rule, and dwellings were simply the first case where one-for-one
  visibly failed. That wording is struck.)*
- **Deferred:** tile **levels**, so a region can deepen without spreading · grouping for in-town
  works, which still take one frontage each · keying the plan's extent on the town's size rather
  than on its hex count.

*Superseded first-pass text:*

**Stage 4 — filling (superseded).** First slice: **keep the block grid but jitter it** (offset blocks, varied
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

The ledger already splits this way: `sawpit`, `caneField`, ~~`boilingHouse`~~, `provisionGround` sit
`beyondThePale`; `shipway`, `warehouse`, `customsHouse` sit `waterfront`; `battery`/`palisade` sit
`outworks`; everything else is in the town. **Parcel-works are on the ring; civic works are in the
centre.** The split we need is already there.

*Amended 2026-09-19: `boilingHouse` is deleted and folded into the cane region's depth (§2.12.12), so
what stands beyond the pale on that ground is the **deepened cane installation** wearing the boiling
house in its label. **The split itself is untouched**, and `shipway` stays on the waterfront — it is
now there as a harbour work rather than as the end of a chain, which is where it always stood.*

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
| 3 | **Count.** *(softened 2026-09-08, fourth)* *"Sawpits ×3"* means **three works of timber industry on that ground, visibly greater than one** — the count is legible as SCALE, not necessarily as a headcount of buildings. Still never "some industry". |
| 4 | **Size.** *(amended twice, 2026-09-08)* The raid map's extent is a function of the **claimed hex set**: `core` sets the town's depth, and each claimed hex adds a quarter where that hex lies. Population is an input to the footprint, never to the map directly. **Guard: the map covers the claimed set plus one ring of adjacent land, never the whole county** — beyond that ring, growth raises *density*, not extent, or a century-old port becomes an unplayable march. |
| 5 | **Scar.** A ruin on the hex is a burnt shell on the ground. |
| 6 | **Skirts.** *(new)* A bearing with a suburb has buildings **outside the town proper on that edge** — approach cover, or a landing you can make among houses. A compact town has open glacis on every side. |
| 7 | **Trace.** The wall's frozen circuit is exactly the edges that carry a wall on the ground. **An unwalled edge is the way in.** A `ruin` wall draws as a broken line *through* the built-up area, not at its edge. |
| 8 | **Faubourg.** Because the circuit is frozen at the moment it was raised, **a claimed hex outside it simply IS the suburb** — the wall runs through the middle of the raid map with no extra machinery. |
| 9 | **Spread.** *(softened 2026-09-08, fourth)* A region's works stand **on its own ground**, never piled somewhere else — but works of one kind on one region are **ONE INSTALLATION sized by how many**, not N buildings in a row. What must stay legible is **the place and the scale of an industry**: that timber is worked, where, and how much. |

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

> **SUPERSEDED 2026-09-19 — this IS the region focus, and it is kept because every argument in it
> still holds.** §2.12 and this section answer the same question — *what is this piece of ground
> for* — and both answer it once, irreversibly, from a shortlist the terrain allows. Keeping two
> mechanisms for one concept would be `[P-47]` written into the struct, so **`Town.grantedToTown` is
> deleted and a grant becomes a `focus`.**
>
> **What carries over unchanged, and it is most of the section:** it is a landlord's decision and not
> an architect's · **no spatial degrees of freedom**, so there is nothing to pack and no adjacency to
> farm · it adds **choice without adding solution space** · it is **irreversible** · and *"six
> decisions in the life of a town"* is still the right count, because 3–5 live regions is where it
> lands.
>
> **What changes:** a grant named a **vocation** and a focus names one of **two** things (§2.12.3), so
> the shortlist is shorter and the decision is sharper. The *seventh grant — "to the town"* — is
> exactly `focus: "growth"`, and the human's argument for allowing it is unchanged and now applies to
> one of the two focuses rather than to a special case.
>
> **And it moves out of the "grantable" state into the "steerable" one** (§2.8), because a focus is
> thematic. The haven-you-own guard survives as **who may set it without going through a governor**,
> which is what it was always protecting.

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
  *Sharpened 2026-09-19: **what it writes is a share of `standing`**, which is the same thing the
  weather writes (§4.8). The raid layer needs no damage model of its own — torching subtracts a
  share, razing destroys, and looting takes wealth and leaves the work standing. **Three verbs, one
  number**, and the unification is the point.*
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

*Added 2026-09-19, for §2.12 and §4:*

8. **Every focus a governor sets prints a reason**, and **no region is ever focused twice**
   (`[HC-95]`, `[HC-16]`).
9. **No region stores a number that counting its works would give** (`[HC-93]`).
10. **Two towns on the same ground with different focuses read as different towns** — different
    depths, different export classes, different sentences.
11. **No work ever gets worse without a named cause in the chronicle** (`[HC-99]`). The sharpest test
    in §4, because a rot that crept back would look exactly like ordinary decline.
12. **A town that has been hurt and cannot pay builds nothing, and says which of coin and time is
    stopping it** (`[HC-101]`).
13. **A raided town is still visibly mending seasons later** — the human's *"viewing it later still
    shows the repair process"*, which is only testable because `standing` is a degree.
14. **A destroyed work never returns, and the ground it stood on is free for a new one.** Both
    halves, or `[HC-87]`'s fragile ceiling loses one of its two ends.

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

### The trade slice (2026-09-08, fifth) — the engine under everything

*Ratified with the "towns trade" call. See §3.5.* **KAN-54** unparked and reordered from "later" to
**foundational**, split into four stories: **KAN-91** victuals (the thin slice — one good, no new
stored state, and the line that lifts the 450 ceiling) · **KAN-92** prices + the market term ·
**KAN-93** import classes, materials gating construction · **KAN-94** the port seam. Alongside:
**KAN-90** weather (the shock the engine absorbs) · **KAN-95** archetypes (KAN-72's surviving half)
· **KAN-89** the town menu (every player lever, parked until the engine exists).

~~**Build order is not negotiable:** the engine, then weather, then the long run that proves both,
then — and only then — anything the player can touch.~~

> **REORDERED 2026-09-09 — the world came first.** The order is now **world → weather → trade**. Two
> things changed it: the human chose to build the world layer before the trade engine, and trade is
> now written against **real named neighbours** rather than the abstract "the shipping" partner, so
> there is no longer anything to gain by writing it first. The *last* clause survives untouched and
> is the part that mattered: **anything the player can touch comes last.** See
> [world-simulation.md](world-simulation.md) §0 and `../decisions.md` (2026-09-09).

### The region focus and the damage model (2026-09-19) — eight stories

*Proposed breakdown for §2.12 and §4. **The smallest sequence that gets from here to there without a
big-bang rewrite**, ordered so that nothing is deleted before the thing that replaces it exists.*

**Migration cost, measured, for sizing:** catalogue kind names appear **218 times across 23 files** —
`works.test.ts` 44, `trade.test.ts` 29, `sim.test.ts` 19, `governor.test.ts` 13, `market.test.ts` 10.
**That number is what the ordering below is designed around:** stories 1 and 2 touch none of it, and
the cost arrives in stories 3–5 where it can be paid deliberately.

> **Per the testing rules: a count that moves is a number that got pinned; a BEHAVIOUR test that
> breaks is a real regression and a stop-and-think, not a number to update.** Each story below says
> which kind to expect.

| # | Story | What moves | Tests |
|---|---|---|---|
| **1** | **A region can be given over to the town, and the footprint goes there first** | `Region` gains `focus`; `Town.grantedToTown` deleted; `nextHex` reads the growth focus instead of the grant set | **Zero move.** One added |
| **2** | **The governor sets a focus, and publishes his reason** | The four-term focus auction beside the five-term work auction; the purpose gate re-keys to the produce | Zero should move — first place one legitimately might |
| **3** | **A focused region may be deepened** | Capacity becomes focus-aware; the deepening candidate; rising returns minted at raise time | `works.test.ts`, `governor.test.ts` |
| **4** | **The chains are cut and the boiling house folds into depth** | `requires` deleted; `boilingHouse` deleted; `shipway` becomes a harbour work; the label ladder | `works.test.ts`, `sim.test.ts` |
| **5** | **A cargo's class comes off the ground** | `exports` re-keys to the produce; `grainFields` and `cottonWalk` arrive as focus expressions | `trade.test.ts`, `market.test.ts` |
| **6** | **Damage is a degree, and rot is deleted** | `standing` replaces the ladder; the decay clock, `devolve` and `idleSinceDay` go | `works.test.ts`, `sim.test.ts` |
| **7** | **Repair is automatic and comes off the top** | A phase-3 charge in `worthOf` order; the two gates; the mend decision retires | `governor.test.ts` |
| **8** | **Construction and repair take time** | Build durations; one commissioned work in hand; the wants-list gains a head | Broad, and a re-measure |

**1 — A region can be given over to the town, and the footprint goes there first.**
Add `focus: production | growth | null` to `Region`. Delete `Town.grantedToTown`. In `nextHex`,
`granted.has(r.id)` becomes `r.focus === "growth"`. **Ships nothing player-visible** — it is the
field arriving and the one existing consumer re-pointed at it.

> **VERIFIED: this moves zero of the 645 tests.** `grantedToTown` has **two references in the whole
> codebase**, both in production code (`types.ts`, `footprint.ts`) and **none in any test file** — so
> no test can observe the substitution. **Every `Region` in the entire suite is built by one
> test-fixture helper**; there are exactly **two** construction sites in the codebase, the world
> generator and that helper, and neither holds an assertion. The suite is run by `vitest run`, which
> transforms without typechecking, so the field's arrival cannot break a run; `npm run build` runs
> `tsc` and is covered by the same two sites.
>
> **One correction to the estimate:** it is **three line-edits in one function**, not one — the
> `granted` set is deleted and its two reads are replaced — for a net of **one line fewer.**

**2 — The governor sets a focus, and publishes his reason.**
The **four-term** focus auction (`[HC-96]`) beside the existing five-term one, as a second candidate
type for the season's one decision. A focus costs no coin and is set once (`[HC-95]`). The purpose
gate re-keys from `WorkKind` to the produce (§5.1.2), and `[HC-81]` survives verbatim. Still nothing
reads a focus except `nextHex` — **so this story is measurable without being consequential**, which
is exactly what you want of the one before the expensive ones. *Acceptance: after the warm start,
every place has focused most of its live regions and every focus has a reason a person can read.*

> **The first story where a behaviour test could legitimately move**, and the reason is worth
> anticipating: `governorTurn` now sometimes spends the season on a focus rather than a build, so
> long-run works counts in `sim.test.ts` may shift. **If one does, stop and read it** — that is the
> cadence changing, which is the thing this story is actually about.

**3 — A focused region may be deepened.**
Capacity becomes focus-aware: unfocused caps at a token work, focused reaches free area (`[HC-94]`).
The **deepening** arrives as the second instance-level candidate, scored `potential × free capacity ×
local price` and **never from the catalogue** (`[HC-97]`). Rising returns are **minted into the new
work at raise time**, capped by area. The three crop works leave the choosable set and become
reachable only through a deepening. **This is where the 218 names start to cost**, and it is the
first story with a real balance surface.

**4 — The chains are cut and the boiling house folds into depth.**
Delete `requires` from the work definition and both edges. Delete `boilingHouse` — its luxury is
carried by the deepened cane region raised in story 3, which is why this story follows that one.
`shipway` becomes a harbour work on a roadstead. The **label ladder** ships with a placeholder
threshold (§2.12.15). `starvedFor` and the *"the shipways want planks"* clause retire with their
mechanism (§2.12.13).

**5 — A cargo's class comes off the ground.**
`exports` re-keys from the work to the **produce**; `producesMaterials` re-keys with it and stays one
fact with one source. `grainFields` and `cottonWalk` arrive **as focus expressions, so the governor's
list does not lengthen** (§2.12.14). *Acceptance: inert bearing regions fall from 12–22% to the
deferred set — rocky ground and salt pans — and nothing else.*

**6 — Damage is a degree, and rot is deleted.**
`standing` replaces `condition`'s lower rungs; `in hand` replaces `decayed`. Delete the decay clock,
`devolve`, `idleSinceDay` and the repair-share price. Weather subtracts a **share** rather than a
grade (`[HC-34]` as amended); the tail still destroys exactly one work per contact (`[HC-35]`,
untouched). **No durations in this story** — a repair completes when it is paid — so the deletion
lands without the balance shock, and the shock arrives on its own in story 8.

**7 — Repair is automatic and comes off the top.**
A phase-3 charge between imports and the governor (`[HC-100]`, extending `[HC-78]`), in the existing
`worthOf` order. The two gates of §4.7: a work whose ground is claimed is **destroyed rather than
billed**, and materials gate a repair as they gate a raising. **KAN-108's mend decision retires
here**, which is what the governor tests will see.

**8 — Construction and repair take time.**
Build durations derived from `cost` as a single placeholder (§4.10). One commissioned work in hand at
a time; the wants-list gains a head that is sometimes already begun. **Re-measure the warm start**,
because `[HC-22]`'s day-0 world was measured without durations and **the city band will move down**.
This is the balance story and it is last deliberately.

**Two notes on the sequence.** The focus stories (1–5) and the damage stories (6–8) are **independent
in code** and may interleave freely; what is *not* free is shipping one direction and calling the
other reconsidered, because `[HC-95]`'s permanence is held up by `[HC-99]`'s deletion of rot
(§2.12.6). And **a ninth thing gates the tail rather than following it**: the **terrain-kind
lockdown pass** the human has asked for, which is what unblocks the quarry, salt's trade class and
the label ladder's threshold (§2.12.15).

### Withdrawn (2026-09-08, fifth)

The **investment slider** and everything keyed to it: category-unlocking thresholds, the
projected-outcome paragraph, and slider-driven divergence. **KAN-72 closed as superseded.** Walls
**do not** get re-drawn at a larger circuit — the human ratified the faubourg behaviour as
sufficient (*"if the outpost expand outside the walls, there is logic to it. Housing built outside,
farming happening outside"*), so that open question is closed rather than deferred.
