# Decisions Log

**Scope:** cross-cutting · **Authority:** human edits win · **Newest at top.**

Ratified decisions and their rationale — the manager's capture log. Game-mechanics
detail lives in `../design-doc.md`; this log records *what was decided and why* so
nobody relitigates it. Entry format: **date — decision.** Then *why*.

To add an entry: newest at top, keep it short, state the rationale. Human edits win.

---

### 2026-09-23 — The ground feeds nobody differently. Land is a TRADE fact.

> *"Remember that tiles only boost trade. We assume that towns are self-sufficient regardless what
> their land looks like."*

**RATIFIED: terrain suitability no longer scales FOOD. It continues to scale everything a town
sells.** Every town feeds the same base off the same works, wherever it was founded; the ground
decides what it can *trade*, and trade is what lifts it above the base.

**The manager described the failure wrongly and was corrected.** I said towns "overbuild" and starve
— repeating a subagent's phrasing without checking it. Nothing of the kind happens. **The real
mechanism is arithmetic:**

- `SUIT_YIELD` is `{ poor: 0.35, fair: 0.7, ideal: 1.3 }`, applied at raise time to **every** work
  including food works. A garden plot feeds **39** on ideal ground and **10.5** on poor.
- It needs **6 hands**, and a soul supplies `labourShare` 0.55 — so **10.9 souls to work it.**
- **On poor ground a farm feeds ten people and takes eleven to run it.** Population falls, hands
  fall, works idle, food falls further. It bottoms out at nobody.

**This had already been patched twice as a bug** — KAN-116 (*"poor food ground cannot sustain the
hands that work it"*, closed) and KAN-119 (*"`provisionGround` cannot pay its own wages on poor
ground"*, open). **Twice is a design question wearing a bug's clothes.** The ruling deletes the class.

---

**AND IT DOES NOT WEAKEN `[HC-87]` — IT COMPLETES IT.**

`[HC-87]` already reads *"a trade-fed town of 1,500 falls back toward 450 when its quay burns."*
**That sentence assumes a uniform base.** What is built makes it *"falls back to somewhere between
120 and 450 depending on its dirt, and sometimes through the floor to nothing"* — which is not a
fragile ceiling, it is an unreliable one.

**The raid keeps every tooth:**

- Burn the **quay** → trade stops → the town falls back to its base. `[HC-87]` exactly.
- Burn a **farm** → the base itself drops, because the base is the works and not a constant.
- Take the **purse** → it cannot rebuild either.

**What a raid can no longer do is erase a town by accident**, which was never a design goal — it was
a consequence of a multiplier nobody had checked against the labour cost.

`[HC-76]` is untouched: a hamlet still feeds itself easily and a city still cannot feed itself at
all. That difference is **scale against a fixed base**, which is what it always said.

**THE BUILD, extended by a second ruling the same day** — *"if all the hexes are grain fields, that
doesn't impact how big the town gets, just how much grain can be sold."* **KAN-137:**

1. **Suitability stops touching food.** `SUIT_YIELD`, `sweetSpotBonus` and `farPenalty` keep scaling
   a work's `trade` column and no longer scale `food` at all.
2. **A work that feeds the town must always pay its own wages**, and the suite walks the catalogue
   and says so: *the souls it feeds exceed the souls it takes to man it*, with headroom. **This is
   the line that makes the class of bug unrepeatable** — KAN-116 and KAN-119 were both instances of
   it, patched one row at a time.
3. **Farm works on terrain become cargo, not dinner.** `provisionGround` and `grainFields` move
   their output from `food` to `trade`, classed victuals. They grow food *for sale* and do not raise
   their own town's ceiling. **A column move, not a new mechanism** — both columns already exist and
   both are already read, and it makes *a farming town feeds the cities* literally true.
4. **So what feeds a town is flat and uniform everywhere:** garden plots and fishing shacks at their
   catalogue numbers, plus bought victuals. That is the base `[HC-87]` always assumed.
5. **AND THE SAME FOR MATERIALS, which the first brief missed.** The human sharpened the rule the
   same day — *"forest tiles don't add to the town's timber surplus (just boosts trade)… the hex
   tiles are just for trade boosting, not town running."* Checked: `commerceOf` computes
   `materialsShort` from **`produced + bought`**, so a sawpit on a town's own timbered hills directly
   offsets that town's materials shortage. **It is the food bug's exact shape one column along** —
   `carryingCapacity` reads `grown + bought`, this reads `produced + bought`. It becomes `bought`
   alone: a town buys its building materials like everyone else, and what its own pits cut goes to
   market.

> **THE GENERAL RULE, which is what all five changes are instances of: a work standing on a tile
> produces CARGO AND NOTHING ELSE.** It does not feed its own town and it does not stock its own
> town's materials. **Everything a town consumes, it buys.** The tile layer is a trade layer; the
> town's running is a flat, uniform floor underneath it that the ground never touches.

**What is NOT withdrawn:** the sawpit exemption from the materials build-gate — *"you do not need
planks to dig a sawpit"* — survives. That is a rule about the **gate**, not about supply, and it
closes a measured cliff where fifty-two places froze at one capital work, forty-eight of them having
spent their one free build on a tavern.

**Withdrawn with it:** *"the catalogue number is the crop; the suit is the ground"* (KAN-126, one day
old) no longer applies to food. Grain fields' 50 against provision grounds' 90 was derived from the
`1.3 / 0.7` split it stood on; both are re-derived as cargo figures.

---

### 2026-09-22 (fifth) — A rich town is a target. The coin is there to be looted.

**Three rulings from the human, and the third overturns a proposal of mine that was aimed at the
wrong term.**

> *"Coin leaving due to upkeep (taxes) and repair and building is fine. A town struggles to save to
> expand, but the richer it becomes, the juicier it becomes to get sacked. The coin is there to be
> looted, which myself or other pirates can do… I don't think 'buying food and materials' should
> diminish coin."*

**1. UPKEEP STAYS, and it is taxes.** I had proposed deleting it, because a town that feeds itself
off its own ground was being charged a per-head coin bill for existing and 78% of the map ran at a
small loss because of it. **Rejected, on a better argument than the one I made.** The drain is not a
bug to be removed — it is *what makes saving hard*, and a town that had to save is a town worth
robbing. Repair and building drain it for the same reason. **The struggle is the point.**

**2. A TOWN'S PURSE IS PLUNDER, and that is its second job.** This is the first statement on record
that the treasury exists for something other than building. It closes a question the economy work
kept circling — *"what is all this coin FOR?"* — and it changes how accumulation reads: **a purse
growing is not an inflation bug, it is a target ripening.** Pirates take it, and so do the crowns'
invasion fleets (the human's reference is *Sid Meier's Pirates*, whose fleets arrive periodically;
in our model the trigger is §8.2's auction, which is KAN-101's).

> **So `[HC-87]`'s fragile ceiling gains a sibling.** The ceiling makes a town's SIZE worth
> attacking; the purse makes its WEALTH worth attacking. Both are the same design move — the thing
> the simulation produces is the thing the player wants — and neither is a separate system.

**3. BUYING MUST NOT DESTROY COIN, and this is the real defect.** When a town buys grain its purse
falls, and **the seller's income is computed separately from its own offer rather than from what the
buyer handed over.** The buyer's coin is not routed anywhere. It stops existing, and the seller's
coin appears from nowhere.

**Measured, the two do not balance by 6.81 : 1** (KAN-132: 3,592,749 earned against 527,196 paid over
200 years × 4 seeds). This is `[HC-47]`'s breach stated exactly, and it is now a ratified design
requirement rather than a known compromise.

> **THE CONSEQUENCE THAT DECIDES THE SEQUENCING, and it must not be discovered late.** Making the
> payment conserve means **a seller earns what buyers actually paid** — about **a seventh** of what
> it earns today. KAN-131 measured the same thing from the other side: under sold-only accounting,
> world trade income falls to roughly a tenth of upkeep alone **and every town dies.**
>
> **So this cannot ship before the crowns' money.** §8.5's tax-up / grants-down loop is what puts
> coin back into circulation once trade stops emitting it. **It lands inside KAN-101, or not at
> all.**

---

### 2026-09-22 (fourth) — The cut was 1.67× the traffic it was a cut of, and the same for a hamlet as for a city

**KAN-132 landed. The quayside cut is now a share of what actually crossed the quay.**

**The diagnosis, and the second half is worse than the first.** A quayed place was paid a median
**27.00** a season from its quay while **16.16** of goods actually crossed it — the cut was
**1.67× its own subject.** And it was **the same 27.00 for a hamlet that owned a customs house as for
a port of fifteen hundred souls**, because nothing in the term could tell them apart: the largest
`trade` column any place assembles in two centuries is 27. **It was a constant wearing a variable's
name.**

**What it is now:** a share of `offer + bought`, valued at the price the cargo cleared at, **both
directions** — a port that lands a thousand bushels is a busy port whether or not it grew a thing,
and that is exactly the sea-fed port whose quay income funds its own grain (`[HC-87]`'s load-bearing
property). **`access` came OUT of the term**, because the offer is already multiplied by it once and
the old cut applied it a second time to a quantity that had never passed a quay.

**Measured independently by the manager, four warm seeds, day 0, split by quay (`[P-55]`):**

| | |
|---|---|
| with a quay | **n=43, +16.54 a season, 1 losing** |
| without one | **n=153, −0.23 a season, 82 losing** |
| population min / median / max | 8 / 85.6 / **1,464** |
| purse at nothing | 45 of 196 |

`[HC-47]`'s trade gap narrows **8.12 : 1 → 6.81 : 1** (16%); the rest is §8.5's circulation, which is
KAN-101's.

**Acceptance 3 and 4 are PARTLY met and the residual is reported rather than absorbed.** The top of
the spread is 1,464 against 1,500 (2.4% short) and the median is ~86 against "roughly 90". The
quayed half came out of its windfall exactly as intended — a capital work off its own trade went
**7.0 → 10.3 years.**

---

**THE FINDING THAT NEEDS A RULING, and it is not a bug.**

> **The half of the world without a quay never earned its keep, and the standing allowance was
> hiding it.** 153 of 196 places — **78% of the map** — now clear roughly nothing, and 82 of them
> clear less than nothing. On master before this story they sat at −0.16 a season *including* 1.80 of
> quayside allowance they had not earned. **Without it they were always at about −2.**

**No shape of this term can fix it**, and that is worth stating so nobody tries: any honest cut takes
proportionally **more** off the low-traffic half, because their traffic is smaller. Their deficit is
`upkeepPerHead` against a self-feeding town's income — a constant KAN-131 settled on measured
grounds, in a world that still contained the emission.

**It is a design question, not a tuning one:** should a plain town, with no harbour work, be able to
fund a building out of its own trade in any amount of time? The ratified answer *"a town gets by"*
says the purse is not where growth comes from — and **KAN-101's crown grants are the mechanism that
is supposed to move these places.** That is the reading this log records; the human's ruling goes
here when he gives it.

**A rule stated from the near-miss, worth keeping either way:** the `market` row is the fishing
shack's shape one row along — a free, self-raising work carrying a `trade` column, drawing **19% of
the old quayside cut**, decided by nobody. The new term defuses it (a market where nothing crosses
now earns nothing), so it needs no ticket. **But: a free work may hold a CAPACITY; it must never
hold a WAGE.**

---

### 2026-09-22 (third) — A raised work does not claim a hex

**The fact that made KAN-126's report read as self-contradictory, and nobody could derive it from the
names.** `footprint.claimed` is written **only** by `spread()` and by the founding centre hex. `raise()`
never touches it. A work holds its ground through `Work.hex` alone.

So both halves of the puzzle were true at once: `capacityOf` **did** subtract the footprint, and it
**was** blind to the works — because a raised work never entered the set it subtracted. **Nothing
about "subsistence" was special; a sawpit was equally invisible.** Measured on one seed: **129 of 217
regions carry a work on ground the town has not built over.**

**And the five stuck regions were not what the ticket said.** They were not *"a want published and
nothing raised"* — **they published nothing at all.** The room term read zero, the product scored
zero, and zero-scored candidates were dropped before they could write a clause. **Silence with no
want, rather than a want with no clause** — which is a worse bug and a different one.

Fixed (KAN-134) by making `capacityOf` *area less footprint less everything standing on it*, as the
one path to that number, and giving the refusal words: **"there is no ground left on it."** Seventeen
named refusals across four warm seeds where there had been silence.

**`[HC-16]` gained a shape worth copying:** the refusal is the same reading the score already took,
wearing its other sentence — one term, one number, two clauses. A second *term* for the refusal would
have put the cap in two places.

**What moved, isolated:** three of four warm seeds bit-identical. Seed 99 alone — wealth
42,488 → **39,241** (−7.7%), trade 715 → 701, population 5,371 → 5,349. **The whole of it is one
focus-expression work fewer standing** (49 → 48); no focus decision changed, one deepening did, and
eighty years compounded it. Day-0 spread 8 / 89 / 1,518, unchanged. **KAN-132 calibrates against
these numbers, not the earlier ones.**

**`[P-1]` earned a clean instance worth holding up as the standard.** A five-line defensive gate was
written, measured **bit-identical** across 200 places × 80 years × 4 seeds, and **deleted — with the
measurement left in the comment so nobody re-adds it.** That is exactly what *"it needs to fight to
be there"* asks for: not an argument that it was unnecessary, a measurement.

**One structural limit, recorded so nobody spends the hour on it (KAN-135).** `WORKS.subsistenceAt`
**cannot** be typed against `WorkKind`, because `works.ts` imports `WORKS` from `constants.ts` and
typing the table would close a cycle. **So `[HC-91]`'s guarantee stops at the constants file**, and
the only thing that can hold the line there is a test — which now exists.

---

### 2026-09-22 (second) — The antfarm test, and the list is closed

**THE MILESTONE NOW HAS A STATED TEST, in the human's own words:**

> *"I want to be able to watch the world like an antfarm. With the nations acting, I want to see
> things improving / degrading (due to nations acting on one another). Things don't have to be
> perfectly balanced, but I want to get to the point where I can just watch it."*

**Three things that sentence decides, and each one settles a question that has been open:**

1. **THE UNIT OF SUCCESS IS A WATCHED HOUR, not a passing suite.** The world is done when a person
   can sit in front of it and follow what is happening without being told. Every remaining story is
   judged against that, and a story that makes the numbers better while making the world duller has
   failed.
2. **CAUSE MUST BE VISIBLE, not merely present.** "Improving / degrading **due to** nations acting on
   one another" is a claim about legibility, not about simulation depth. A crown's decision that
   moves a number nobody can trace is not the feature. `[HC-16]`'s *"a decision that comes to nothing
   still needs a clause"* generalises here: **a consequence that cannot be traced to its cause has
   not happened, as far as the milestone is concerned.**
3. **"NOT PERFECTLY BALANCED" IS PERMISSION TO STOP TUNING.** Explicit, and it is the counterweight
   to the calibration spiral that produced the 450–600 target. Balance is not the bar. **Watchable
   is the bar.**

---

**THE LIST IS CLOSED AT SEVEN STORIES**, labelled `antfarm` on the board:

| | |
|---|---|
| **KAN-132** | the quayside cut becomes a share of real traffic — fixes the income side |
| **KAN-133** | a town fails out loud rather than silently |
| **KAN-124** | a focused region may be deepened — finishes the focus mechanic |
| **KAN-127 / 128 / 129** | damage is a degree · repair comes off the top · building takes time |
| **KAN-101** | nations act, and say why |

**Nothing is added to this list.** Anything found from here is **written down and deferred**, not
slotted in — and that rule is the whole point of writing this entry.

**The problem it solves, stated plainly so the cure is not mistaken for bureaucracy.** Every story in
this sequence found a real bug in the one beneath it: KAN-125 found the menu broken, which led to
KAN-131 finding towns losing money, which led to KAN-126 finding a free hut printing 14.5% of the
world's income, which points at KAN-132. **Not one of those was drift, and all four were worth
doing** — but a process that is *correct* at every step and *unbounded* in total still never ships.
The human's read of it was *"it feels like it's always just one more thing"*, and he was right.

> **A finding is not a reason to extend a milestone. It is a reason to write a ticket.** The
> discipline that made the findings real — measure, do not tune, report the criterion that fails —
> says nothing about when to stop, and that second step needs a person. He took it here, exactly as
> the 450–600 withdrawal said someone would have to.

**What is explicitly OUT, and none of it is cancelled — only deferred:** the town menu (KAN-89) and
every player-facing tie-in, the town card and chronicle depth (KAN-75), the 20-year fast-forward
(KAN-77), the terrain-kind lockdown (KAN-130), the governor-weight and placement work (KAN-73, 76,
81, 95), and the two recorded defects that are not in the path (KAN-118, 119, 134, 135 once landed).
**A world simulation runs without a player**, so the player-facing work is not a prerequisite for
judging one.

---

### 2026-09-22 — A free hut was drawing a harbourmaster's wage

**KAN-126 re-keyed a cargo's class from the building to the ground, and the dominant effect was not
the thing the story was for.**

`fishingShacks` — a hut the hamlet floor raises for nothing, on any ground, with no decision behind
it — carried a `trade` column with no cargo class. That meant it was paid as a work that takes a cut
of the traffic: **a flat constant × access, at no price and to no buyer.** Two coin a season.

**Measured: 893.92 of the world's 6,169.86 a season across four warm seeds — 14.5% of ALL trade
income in the world, and 27.8% of the quayside cut.** The re-key with *no new works at all* already
cost the world 39% of its trade income.

**It could not be folded into `food` instead.** `commerceOf` scales the weather's share into the
materials and luxury ranks by hand, because victuals arrive pre-scaled — so a victuals figure sitting
in a `trade` column would have been **fish no storm could spoil.** The 2 retires with the mechanism
that paid it, exactly as *"the shipways stand idle for want of planks"* did.

**What it cost, measured independently at day 0 across four seeds:**

| | before | after |
|---|---|---|
| towns holding no money at all | 11 of 196 | **39 of 196** |
| median purse | 460.4 | **149.5** |
| median population | 108.3 | 98.5 |
| largest port | 1,319 | **1,518** |
| inert bearing regions | 18.7% (cotton · rocky · salt) | **9.1% (rocky · salt)** |

**The human's call, made on these numbers: merge, and do KAN-132 next.** The reasoning is that the
income removed was never real, the ratified population shape survives — and the largest port reaches
`[HC-87]`'s trade-fed 1,500 for the first time — and **KAN-132 is the same disease four times larger**
(the quayside cut, 58% of world trade income), so it is the story that properly resets what a town
earns. Holding a correct fix so the numbers look nicer is the mistake the 450–600 target taught.

**So the world is knowingly poorer until KAN-132 lands.** That is a sequencing decision, recorded so
nobody reads the day-0 purse as a regression.

---

**The rules that came out of it.**

> **`[P-56]` Before you move a free input, measure what share of the TOTAL it is paying for.** A
> small constant paid to a thing that exists everywhere is not a small constant. Two coin was 14.5%
> of the world. This is `[P-52]` at the income end: that rule asks what a place gets for nothing and
> what fraction of the RANGE it buys; this one asks what fraction of the TOTAL.
>
> **And isolate it before shipping anything else in the same commit.** Here the re-key and the two
> new crops were measured separately, and the re-key alone accounted for the whole drop. Shipped as
> one measurement, the new crops would have taken the blame for a finding that had nothing to do
> with them.

Three testing rules also landed (`implementation/testing.md`): **assert an exclusion with the largest
member of the excluded set** — the shack claim passed against a mutation that counted every work in
the game, because zero is invisible on both sides; **a ratio whose denominator is what the story
changes cannot be the criterion**; and **a predicted survivor is a claim about the world, so its
precondition needs measuring too.**

**And `[P-55]` earned itself a second time in one day.** A pooled median decade gain fell 38.02 →
0.00 and a liveness claim went red. Split by quay it reads **771.74 → 612.08 with a quay** and
**−3.94 → −7.68 without.** The population had not stopped earning — it never was one population. **A
median sitting at a clamp is not a measurement; it is a report about the clamp.**

---

### 2026-09-21 (third) — The margin was never thin. It is two different worlds.

**KAN-131 set the dial the human asked for — `upkeepPerHead` 0.06 → 0.05 — and the diagnosis
underneath it is worth more than the number.**

**A soul's keep had never been priced against what a soul earns.** Upkeep is the only subtraction in
a town's season charged **per soul**, while every income term is earned per unit shipped × access. A
town fed by its own ground therefore gains the bill for nothing and gains no income with it. Measured
on four warm worlds over two hundred years: a soul earns a median **0.178** a season and cost
**0.06**. At 0.05 the median place clears 2.60 a season — a capital work in about nineteen years,
which is the ratified "decades". At 0.045 it clears 6.14, a work every eight years, which is the
"grows fast unaided" the human ruled out. **The dial stops where decades does.**

**But the real finding is that the world has two economies, and the median describes neither.**

| | places | trade margin | funds a 180-coin work |
|---|---|---|---|
| with a capital waterfront work | 103 | **+20.02 / season** | two and a half years |
| without one | 90 | **−1.28 / season** | never |

The cause is `quaysideOf`: a customs house pays out its whole trade column × access, **every season,
whether or not a single bale crossed the quay.** No price, no market, no buyer, and a storm does not
dent it. It is **58% of all trade income in the world and 93% of a quayed town's.** It cannot simply
be thinned — measured, halving it collapses the day-0 spread from 11/92/**1,233** souls to
8/71/**463**, because it is what funds a sea-fed port's grain. It is load-bearing for `[HC-87]`'s
trade-fed ceiling and it is the largest breach of `[HC-47]` in the model. **Making it a real share of
real traffic is its own story, not a tuning pass.** → **KAN-132**.

**`[HC-47]` is not implemented for trade, and the number is 10:1.** Over 200 years × 4 seeds the
world earns 5,107,883 in trade while buyers pay 517,179 — a seller is credited for his whole offer at
the cleared price while a buyer pays only for his allotment. Upkeep destroys 1,283,719 and storms
1,066,321. **Closing it needs §8.5's tax-up/grants-down circulation, which is KAN-101**; attempting
it now would kill every town, because sold-only income is a tenth of upkeep alone. Recorded so nobody
re-derives it as a bug.

---

**And the lesson that stops the next wrong story, which is the same one the 450–600 target taught.**

> **Median years-per-new-capital-work is 50 under EVERY dial swept** — upkeep 0.06→0.035, victuals
> 0.15→0.40, growth share 0.5→0.85 — while the median purse triples. 36% of places build nothing in
> two hundred years. **Whatever gates the middle of the band is not the purse.** A fifth story aimed
> at coin would repeat the mistake exactly: chasing a target whose cause lies elsewhere.

**A negative yield is forgiven every season, silently.** `settleSeason` clamps at zero, so 82 of 193
places sat at exactly nothing for two centuries with no chronicle line, no failure word and no test
able to see it. *"Hovering at its build cost for ever"* was this. **Where a clamp hides a recurring
loss, the loss needs a claim** — the suite now has one.

**A place can empty without a raid, and it already could.** One town overbuilds, loses its food works,
cannot buy bread at access 0.08 and drifts to nobody. It is `ruined`, not `abandoned` — works still
stand — so `[HC-50]` holds, but a comment in `notable.ts` asserts that only a deliberate hand empties
a place, and that comment is false. → **KAN-133**.

---

### 2026-09-21 (second) — A town gets by. Growing fast is somebody's decision.

**The 450–600 day-0 city target is withdrawn.** Four stories chased it — capacity, depth, the menu,
the materials guarantee — and the middle of the band never moved once. The cause was measured, twice,
and it is not capacity: **the median town holds 290 coin and the cheapest work costs 260.** It was
never short of room. It was broke.

**What replaces it is a statement about what a town is, in the human's own words:**

> *"In most cases towns really just try to get by. Sometimes they get investments, sometimes they
> don't. Naturally they grow over time, but it's not a fast process, unless someone WANTS them to
> grow fast. I'd say balance it that trade generally causes a very small profit, which they can then
> reinvest."*

**So the ratified shape is:** a town's own trade turns a **very small profit**, reinvested slowly.
A day-0 spread of roughly **20 to 1,200 souls with a median near 160** is correct, not a shortfall.
`[HC-87]`'s *"a trade-fed town of 1,500"* survives as the **top** of that spread, which the largest
port already reaches.

**The design argument, and it is the reason to prefer this to hitting the number:** if every town
could grow itself to 500, a patron's money would only buy a **faster version of what was coming
anyway**. If a town gets by and no more, **money is the difference between a port and a great port**
— which is the whole point of the grant, the steer, and developing a haven rather than merely
holding one. **The old target was quietly cancelling the player's leverage.**

---

**The lesson about the target itself, and it is the expensive one.**

The 450–600 figure was ratified on 2026-09-16 as an answer to *"how big is a day-0 city?"* — a
reasonable question with a reasonable answer. It then survived four stories of contrary evidence,
because each story could explain why *it* had not moved the band, and each explanation was true.

> **A number ratified as a TARGET outranks the measurements that disagree with it, until somebody
> withdraws it.** Every story reported honestly, nothing was tuned, and the band was still chased
> three times after the first measurement said the cause was elsewhere. **Report the criterion that
> fails** (2026-09-10) tells you not to tune — it does not tell you when to stop believing the
> criterion. That second step needs a person.
>
> **The cheap check: when a target has survived three attempts, the next question is whether it is
> the right target, not what to try next.**

**A second-order cost, worth naming.** The stories were not wasted — capacity, depth and the menu
collapse are all ratified and all shipped. But they were *sequenced* by a goal that turned out to be
wrong, and the sequencing is where the waste was: the materials guarantee and the tavern fix were
both chosen because they looked like the thing blocking 450 souls.


---
### 2026-09-21 — The crops leave the menu, and a decision nobody can act on should not be offered

KAN-125 took `sawpit`, `caneField` and `provisionGround` off the governor's list and taught a
deepening to *start* a region rather than only extend one. **Focused-but-empty live regions fell from
54.2% to 19.0%**, and every live land region is now focused on something. What remains is refused by
coin, hands or materials — never by nobody looking.

**`max` is settled, and the rule generalises: a PER-TOWN limit may not stand in front of a PER-REGION
rule.** `CATALOGUE[kind].max = 9` was capping the deepest regions instead of the ground doing it.
`[HC-94]` says the cap is **area**, so a second cap beside it is the second source for one fact that
`[P-47]` forbids. The dividing line is which question the number answers: *"how many taverns is too
many"* is about the **town**; *"how many sawpits"* is about the **hills**, and the hills already
answer it. A focus expression now has no `max`; a menu work keeps its per-town limit. The deepest
region reaches **13** works where it stopped dead at 9.

**A produce with no work in the catalogue must never be allowed to claim ground.** This was a real
and invisible bug: **a reef was being given over to its fish, for ever, producing nothing**, because
fish has no capital work — and the same for cotton, grain and salt ground. Those focuses were a large
slice of the 260 focused-and-empty regions, and no test could see them because a focus with no
consequence looks exactly like a focus waiting for coin.

> **The general form, and it is worth carrying: a decision whose only consequence is currently
> unimplementable should not be OFFERED.** Not offered-and-ignored, not offered-and-logged — not
> offered. It self-heals the day the consequence exists, and until then the ground goes to houses
> instead, with a clause that is true of it today: *"nothing else was ever coming off that ground."*

**"The region's best-borne produce" must mean "the best the catalogue can EXPRESS".** Tilled ground
bears grain best and food second; grain has no work. A purpose gate reading the raw best would pass
the focus (*"grain isn't forbidden"*) and the deepening would then raise **provision grounds** on it
— a farm in a place whose purpose forbids one. One function, three readers. It closes over the next
story by itself: the day `grainFields` exists, tilled ground's first answer becomes its real one.

**A rule that is safe only in PAIRS is worth recording, because simplifying half of it breaks
nothing visibly.** `[HC-94]`'s sited-work exemption has two readers — the depth count and the room
reading — and mutating **either alone is a no-op**, because the other still refuses. Only loosening
both shows the bug. Found by an unpredicted survivor, and now covered by a direct claim.

**Deleting a mechanism costs its sentences, and that is the honest price.** Three ratified clauses
died with the dependency edge: *"the shipways want planks"*, *"the boiling house wants cane"*, and
the mend rule that read them. §2.12.13 anticipated the first. All three are recorded here so nobody
goes looking for them later.

---

**TWO THINGS LEFT FOR THE HUMAN:**

**1. §2.12.4's token cap now has no producer.** *"Unfocused, a region's depth caps at a token work —
a hamlet takes what timber it needs off the ridge"* was only ever binding on works that stand on what
the ground bears, and every one of those has just left the menu. **An unfocused region now carries
none rather than one.** The rule is still enforced and is now unreachable. Either retire the clause
or give it a producer.

> **This is story 4's own amendment arriving one level down.** *When a story removes the only
> producer of something, check in the same breath what is left to produce it.* Written yesterday
> about the crops; true again today about the token work, and nobody spotted it until the code was
> built. **The lesson is that the check has to be mechanical, not attentive.**

**2. The city band has not moved for three stories running.** Floor up on three seeds of four, middle
flat: medians 145→157, 207→139, 156→144, 214→211 against a ratified 450–600. Combined with
2026-09-20's finding — median town wealth 290 against a 260-coin sawpit — **the evidence now points
firmly at the median town's PURSE rather than at its capacity, its menu or its ground.** If 450–600
is still wanted, the next lever is earnings or prices, not another way to build.


---
### 2026-09-19 (second) — Damage has a cause, never a clock; and the town remembers

**Ratified after the human rejected the decay ladder outright.** The town's works no longer degrade
from neglect. They are hurt by **events** — a storm, a raid, an invasion — and they are mended with
**money**.

**His words, and they are the specification:**

> *"I like that the town remembers. I like that if a pirate sets buildings alight, or if an invasion
> force hits an area, that viewing it later still shows the repair process. I also want storms to tie
> into this damage mechanic. A storm hits, afterwards we land, and everything that hasn't fully been
> repaired yet, shows it.*
>
> *I don't like the 'rot' part. If a town of 2000 had a booming industry, and got invaded, and pop is
> down to 500, it makes sense that production takes a hit, because they can't man everything.*
>
> *The supplier part seems a bit confusing. Again, this is not a city builder where production chains
> exist. When I spoke about the maintenance cost associated with things, it was monetary… having to
> repair something because of storm, invasion, raid just has an income impact until everything is
> restored."*

**THE MODEL:**

| | What it is | Reversible? |
|---|---|---|
| **Idle** | Under-manned. Not enough hands to work it. | **Free and instant**, both ways. Already built; needs no change. |
| **Damaged** | Hurt by a named event. Visible on the ground. | Mended with **coin**, over time. |
| **Destroyed** | Taken outright — a tempest's tail, or deliberate razing. | Never. And the ruin **stays on the map.** |

**Repair is automatic and comes OFF THE TOP.** The town mends itself; the governor never chooses
between a repair and a warehouse. The consequence is legible without surfacing a choice:

> ***"Sarmiento builds nothing this year; the town is still mending."***

**What this deletes** — all of it in the direction of *"not a city manager"*:
- **The whole decay clock.** `DECAY.idleToDecayed`, `decayedToRuin`, and the `idleSinceDay` each work
  carries. **No timers.**
- **Rot as a concept.** Nothing degrades from being poor, idle or unloved.
- **Supplier chains** (`requires`) — the edge that made a shipway need a sawpit.
- **Most of KAN-108's mend decision.** It was a per-building governor choice priced at a fraction of
  the raise cost; it becomes an automatic bill. Said plainly rather than pretended to survive.

**What it gets right that the shipped model does not.** *A raid stops costing you buildings and starts
costing you **years**.* You spend on repairs instead of on growing, and that is a far better answer to
*"why does being raided hurt"* than watching sawpits rot. It also **unifies three systems that are
currently separate** — storm damage, raid damage and invasion damage become one state with one repair
bill, where today weather has its own path into the works ladder and raiding has another.

**And the under-manning half already works exactly as described.** `allocateLabour` idles what cannot
be manned and un-idles it the moment hands return, free and instantly. A town of 2,000 cut to 500
loses production because the hands are gone, not because anything broke. **That part needs no change
at all** — it is only the rot sitting on top of it that goes.

---

### Work takes time — and that is NOT what §1.1 bans

**Ratified the same day, after the manager over-applied the timer ban.** His words:

> *"Here a timer is needed; construction isn't instant. It takes time. Repairing should therefore also
> take time. A fully destroyed building takes the same amount of time as building it from scratch. A
> building with half health takes half the time. I don't know what those numbers are yet. It ties into
> the zoning tile upgrade mechanism which we haven't really done too much with yet. So don't need to
> try and get the timer values perfect."*

**Three different things had been collapsed into the word "timer", and only the middle one was ever
rejected.** Worth separating permanently, because it will be collapsed again otherwise:

| | What it is | Verdict |
|---|---|---|
| **§1.1's ban** | *"No system may require a recurring DECISION on a timer"* — a chore the player must service: a weekly loyalty tick, per-officer upkeep, morale accounting to audit. | **Banned, and rightly.** |
| **The decay clock** | A work degrading because nobody tended it. | **Deleted** — because things should not rot from neglect. **Not because it was a timer.** |
| **Build and repair duration** | How long work takes. | **Required.** It demands no decision at all; it is a *consequence*, not a chore, and §1.1 does not reach it. |

**What this settles:**

- **Damage is a DEGREE, not a grade.** *"A building with half health"* is a proportion of the fabric
  missing, not a rung on a ladder. **`destroyed` is therefore just the endpoint — everything gone —
  and needs no rules of its own.**
- **Repair time is proportional to what is missing, and the constant of proportionality is the work's
  own build time.** Half gone, half the time. Wholly gone, the full build. **One rule covers both
  repair and construction; do not write two mechanisms where one does.**
- **Construction is not instant either**, which has a consequence for the governor's one-decision-a-
  season cadence: a build may span seasons, and what he does meanwhile is *"the town is still mending"*.

**The numbers are deliberately unfixed.** They tie into a zoning tile upgrade mechanism that does not
exist yet. **The shape is ratified; the constants are not**, and a placeholder that says so is better
than a false precision somebody later mistakes for a settled figure.

---

### The interaction with the region focus, which is the part worth noticing

The human chose a **permanent** production focus over a reversible one. **Deleting rot makes that
choice structurally necessary rather than merely preferred.**

The case for reversibility rested entirely on the works idling and *rotting* as the reversal cost —
free within three years, 40% within seven, full price after. **With no rot, lifting a focus costs
nothing and can be flipped back instantly**, which is precisely the *instant dial* the whole direction
exists to avoid. The two decisions hold each other up, and neither is safe to revisit alone.

---

### Deferred deliberately, at the human's request

**A lockdown of every terrain kind the map generator can paint**, and what each is for, before any
more per-terrain decisions are taken one at a time. Prompted by stone: the measured finding is that
**12–22% of every town's bearing ground is inert** — `cottonGround`, `saltPans` and `rockyGround`
that the generator paints, names, describes and draws, and which no work in the catalogue can touch.

**Rocky ground stays dead for now.** No quarry; stone does not become a second materials source, so
the 2026-09-16 neighbourhood guarantee is untouched. Noted as possible later uses: a defence bonus,
or ground that is only good for housing. Salt's trade class is deferred to the same pass.

---
### 2026-09-19 — A region has a potential; a focus decides what you get from it

**A design pivot on the town's production half, ratified after discussion.** Three stories of chasing
a day-0 city of 450–600 souls hit three successive ceilings, and the human's read of *why* turned out
to be the important half: the model is a brittle **chain**, and this is not that kind of game.

**His words, and they are the specification:**

> *"This is a sandbox age of pirates game. Not a city manager… I don't really want to get too much
> into production chains. It's not that type of game. However, I do still want towns to feel alive.*
>
> *So in terms of how the saw pit was thought about. It's not about timber, planks, boats chain. It's
> more that there's a forest tile (zone) at this area. Focussing on production (on this tile) unlocks
> that potential better… In terms of trade, it means more timber will be got from this town. If
> however you focus housing zones / 'growth' and this tile gets locked behind a growth 'upgrade', it
> means you lose the benefit of this town producing trees, and you will still be able to trade timber,
> but it's not nearly what it would have been. It does mean there are more people though."*

**THE SHAPE.** A region has a **potential** given by its ground. A **focus** is chosen per region —
production or growth. Focus production and the region yields more of what its ground bears. Focus
growth and the ground becomes housing: more people, and the production is largely spent.

**GOODS SURVIVE; CHAINS DO NOT.** Timber is still a real thing that moves on real ships. *Timber →
sawpit → planks → shipway* is what goes.

**Potential is the CAP; development is the CLAIM.** Potential is ground, and un-burnable. What stands
on a region is burnable, and burning it collapses production while the potential sits there waiting —
which is what keeps `[HC-87]` alive and what makes a place worth **occupying rather than razing**. It
also satisfies the heritage test: *the number carrying the town's size stays destructible at the
building level.*

**Who chooses:** the **governor**, publishing his reason (`[HC-1]` — no engine system prompts the
player). The **player** steers only where he owns the place, through the ratified *guns · coin · hands*
steer (§5.8), which a region focus becomes a fourth target of.

**Three of the four pieces already ship**, which is why this is smaller than it sounds:

- Regions already bear specific produce, already scaled by how well the ground suits it.
- **Claiming a hex for housing already idles the work standing on it** — §2.11's *"growth eats its own
  cause"* is the human's trade-off, already the model's spine.
- `FOOTPRINT.densifyCost` already ends in `Infinity` — his *"even that can only be done so far"*.

**What actually changes is that the choice is nobody's.** `stepFootprint` spills a town outward
automatically on a fixed relief order, so no town ever decides *"this is a timber town"* or *"this is
a big town"*. **Making that a direction rather than a side effect is the whole of the proposal.**
Second change: the catalogue's two dependency edges flatten, so a work becomes a development of a
region rather than a building with prerequisites.

---

**Three findings from the survey that shaped this, worth keeping:**

**1. Galactic Civilizations does not work the way the proposal's anchor assumed** — worth recording
because the title was the reference point. GalCiv III's planet "potential" is a **hard cap equal to
usable tile count**, fixed at generation, raised only by terraforming, and **claimed by the cities you
build on those tiles.** No floating cap, no overshoot collapse. (GalCiv IV replaced it with rising
growth thresholds modified by approval and pollution; the overshoot-strain is its *empire*-scale
administration mechanic.) **And the shape it really has — an authored ceiling from the ground, claimed
by what you build — is already what §2.3 ("area is capacity") and §2.11 say.** The model was already
there; what was missing was a name for the ceiling.

**2. The genre's only consensus is negative.** GalCiv, Civ VI, Victoria 3, Anno 1800, Port Royale and
Tropico disagree completely about what a capacity score is made of — authored tiles, a sum of built
things, no cap at all, per-building met needs, civic unlocks. They agree on exactly one thing:
**no game that wants the town to be a worthwhile target makes its capacity out of terrain alone.**

**3. The three ceilings were never a materials problem — they were a FIRST-MOVE problem, and it is
four constants agreeing badly.** `basePrice[0] = 0.15` prices victuals so that **selling food cannot
fund growth** (deliberate, and correct), so the only route above local subsistence is a capital
earner — **exactly one door**. `PLAN.weights.need = 1.5` is the auction's **largest** weight. `tavern`
is the **cheapest** capital work, has `needsGround: null` so it fits anywhere, and serves that heaviest
term — so it wins the first build essentially everywhere, **by construction**, and earns about nine
souls' worth of growth appetite. Then the flat materials bill locks the door behind it. Measured:
**48 of 52 frozen places had built a tavern**, and all 52 had built something that exports nothing.

**Two collisions the design must keep avoiding:**

- **`[HC-75]`** — *no place oscillates with growing amplitude across two hundred years* is a named
  acceptance test, and **overshoot → collapse → regrow IS that oscillation.** The die-off the human
  wants already exists and is caused by the cap *falling*; nothing in the model would deliberately
  overshoot, and it should stay that way.
- **A trade economy whose only consumer is the player is a shop, not an economy.** If growth stopped
  reading goods entirely, materials would lose their only consumer — growth is the reason trade matters
  *to a town*, which is the reason a blockade is a siege. The ratified shape avoids this because a
  region's yield is still a good, and a town still buys what its own ground will not give it.

---
### 2026-09-16 (third) — A warm start that RUNS needs no second way to build a town

KAN-99 is built. `warmStart(seed)` generates the cold map, winds the clock back to the earliest
founding, and runs the **real driver** forward to day 0 — founding places in waves as their dates come.
Weather, global clearing, fifty governors and the footprint all run for the whole pre-run.

**Why the method was worth the 810 ms.** `[HC-22]` asks for a ledger *"the ordinary rules could have
produced"*. A ledger the ordinary rules **did** produce satisfies it by construction, on all four axes
at once, and leaves nothing for `[P-47]` to catch. Population, works, wealth, footprint and dependency
all fall out for free — every one of which a solver would have had to get right separately.

**Day 0 now**: ages **20–96 years**, populations **19–810**, capital works median 1 (there were
**zero in the entire world** before), 4 places reading *fed from the sea* on the canonical seed, core
grades 0–4. `settleOpening` is deleted; `SIZES.population/wealth` are now explicitly **founding
parties and founding purses**, not target sizes.

**Five findings worth keeping past this story:**

- **Running a world forward flattens exactly ONE axis: age.** Ground, climate, market position,
  purpose and weather luck all vary by themselves. The human's objection was right and narrow, and
  **waves are the minimum intervention** — not a hybrid, since every place still runs the same rules,
  just from its own date.
- **Arithmetic that is only right on one side of zero is a bug waiting for its first negative input.**
  `calendar.ts` was corrected in advance (KAN-107) and read negative days correctly. **`dispatch.ts`
  was not**: `world.day % RING_DAYS` keeps the sign of the dividend, so the very first day of the
  pre-run indexed `ring[-1]` and threw. **The check, when a quantity is about to go negative for the
  first time: grep every `%` that takes it.** There were exactly two.
- **An input a system CANNOT RECEIVE beats a guard a system must REMEMBER.** An unfounded coast holds
  `awaitingSettlers` — no people, no ground, no works, no purse — so it is inert because it can
  receive nothing, not because four loops in the clearing check a date. **`market.ts` changed by zero
  lines.** `[P-17b]` applied to a struct rather than a signature.
- **Ask what a ranking can SEE.** `standingOf` decided which harbours became great ports from shelter,
  company and a roll — **three facts, none of which is about whether the ground will feed anybody.**
  Designation and outcome were driven by disjoint inputs, so class and size were uncorrelated on day 0
  and `[HC-69]`'s *"readable before you land"* was false in the dimension a player cares about most.
  It now reads the hinterland.
- **Where the expensive half of a generator lives is a design decision, not a detail.** Keeping the
  810 ms pre-run OUT of `generateWorld` is what let a 0.8 s cost land as **+8 s** on the suite rather
  than **+30 s**, because ~40 calls want the map and not the ledgers. **Split a generator at the line
  where most callers stop needing it.**

**The criterion that failed, reported rather than tuned — and it is worse than the band being wrong.**
The ratified day-0 city is 450–600 souls; the median came out at ~150. But measuring it directly
showed the real fault: **a designated city is frequently indistinguishable from a settlement.** Seed 99
designates a city of **45 souls in a world whose median place is 47.** That is `[HC-69]` broken, not a
dial being off.

**The cause is a cliff in the materials gate, and it is measured.** A place with *zero* capital works
consumes no materials, so its first build is free; a place with **one** is frozen for ever unless its
neighbourhood holds a sawpit. Only **7–12 of 50 places** produce timber or stone, and **11–32 places
sit frozen at exactly one capital work**, up to 13 of them holding over 1,000 coin they cannot spend.
More producers measurably means fewer frozen and bigger cities, so the chain holds.

**And the asymmetry underneath it:** `guaranteeVictuals` guarantees **every place bears food**, citing
`[HC-22]`. **Nothing guarantees timber, and timber has no substitute in the catalogue.**

**Ratified 2026-09-16: materials are guaranteed per MARKET NEIGHBOURHOOD, not per place** — every
place can *reach* timber; most must **buy** it. Chosen over giving materials a second source precisely
because it makes trade matter **more**: it turns a dead end into a trade route. With `access` now
reading routes, it should also mean **cutting a port's lanes stops it building as well as eating** —
`[HC-87]`'s fragile ceiling reaching a second system.

---
### 2026-09-16 (second) — The ceiling was never fragile, because half the world already touched it

KAN-112 landed and `[HC-87]` is statable at world scale for the first time. The story was framed as
*"`access` cannot express a blockade"*, which was true. **The finding underneath it was different and
larger: the scale had saturated.**

**`access` is now REACH × READINESS** — reach being the share of a place's sea lanes still calling,
readiness its own quays, strand and guns. A product, because it is the only combination under which
both ratified sentences survive: drop readiness and a quayless shore trades freely because ships
happen to pass (`[HC-85]` false); drop reach and a blockade stays inexpressible.

**A route turned out to be nothing new.** It is `[HC-82]`'s market neighbourhood read the other way
round: if two places are near enough to clear a market together, there is water between them that
ships use. Inventing a second notion of *"who is reachable"* would have been `[P-47]` wearing a map —
one definition, read twice. Worth stating as a rule for the next system that needs it (patrols,
dispatches, a player's course): **"who is near enough" has exactly one definition in this world.**

**The saturation, which is the part worth remembering.** Three fishing shacks — which the hamlet floor
raises for nothing — bought 0.9 of a 0..1 scale, so **the median access in the shipped world was
exactly 1.00.** Nothing was arithmetically wrong. But a ceiling every place already touches **is not
fragile, it is furniture**, and that, not the blockade gap, is why `[HC-87]` had no world-scale
demonstration. Now `[P-52]`: *a clamped quantity whose median is its clamp is a bug report*, and the
check is one line.

**`[HC-67]`'s scope is now precise**, and it generalises: the hamlet floor raises a place's **works**
for nothing; it does not raise a place's **standing in the world**. *Free to rebuild fabric, never
free to rebuild reach.* That single line is what makes raiding and blockade different acts with
different costs — and the measurement shows it: burning the most sea-fed port's entire waterfront
recovers to the untouched figure **exactly** on two of four seeds, while a cordon takes it from 293
souls to 94.

**A near miss, and the discipline that caught it.** The first honest-looking calibration of *"a beach
is not a quay"* cost **85% of world wealth** and left zero trade-fed ports on three of four seeds — an
economy rebalance smuggled inside a mechanism story, with `[HC-87a]` made unreachable as a side
effect. The rule that saved it, and it is new:

> **When a story changes what a quantity is MADE OF, calibrate so the world's aggregate stays roughly
> where it was, and report the residual.** The shipped figure cost −1.6% to −6.8% population and
> −1.3% to −7.7% wealth, reported rather than hidden.
>
> This is **distinct from** *"report the criterion that fails; never tune until it passes"* (2026-09-10),
> and the distinction matters: **that** rule governs a criterion the design cannot meet, where tuning
> would hide a design problem. **This** one governs a dial the change itself introduced, where *not*
> pinning it lets a mechanism story quietly become a balance story.

**Consequence for KAN-99, which is next:** opening ledgers are re-priced. A warm-started place with no
capital quay now opens at **0.68–0.87** access rather than 1.00. Whoever writes the warm start reads
`ACCESS` before authoring any opening population.

**And a pattern, now used twice, worth naming before it is invented a third time.** A world input that
nothing drives yet — `Wars`, now `Routes` — is: a struct handed in, an empty-case constructor, a
primitive verb, a convenience verb over it, a reader, and a describe-line, **with a test asserting the
empty case really is empty.** Both have no non-test callers, deliberately, and both say so in the file.

---
### 2026-09-16 — The warm start, decided: a world run forward, founded in waves

Four calls taken by the human today, after a scope pass on **KAN-99** found that most of its ticket
body predates this week's work.

**1. The warm start RUNS THE WORLD FORWARD, and places are founded in WAVES.** Generate a cold world
around 1580, run it forward with the real weather, trade and governor, and call the end day 0.

> **The human's objection, and it was the right one:** *"if we run the world forward, that will create
> equal warm start places… I do however want the world to have some variety."* Running forward does
> not make places equal — ground, climate exposure, market position, purpose and sheer weather luck
> all differ. **But it does make them the same AGE**, and that is a real flattening: no old outposts,
> no new settlements, every port eighty years old to the day.
>
> **The answer is staggered founding, not a hybrid.** Found places at different points *during* the
> pre-run and run each from its own founding date. At day 0 the sea holds century-old cities with deep
> works beside raw outposts still on their first garden plots. This keeps `[HC-22]` true **by
> construction**, needs no second way to build a town — which the ticket forbids and `[P-47]` names as
> a bug class — and uses machinery that already exists: `calendar.ts` was built and tested for
> **negative founding days** precisely because a warm start would need them. It is also the right
> period: a 1660s Caribbean was old Spanish cities beside brand-new English and French footholds.
>
> *Default for what makes a place old:* age correlates with crown, with derived jitter so it is not
> mechanical. Overrulable.

**2. A day-0 city is 450–600 souls, and MAY be fed from the sea.** `[HC-22]`'s founding rule is
restated: **a place is founded at a population it can SUSTAIN — from its ground or from its quay** —
and the twenty-year test is the arbiter. The old wording capped opening population at what a place's
own ground grows, which made a sea-fed day-0 city **impossible by construction** while another
ratified sentence demanded exactly that. Both were on the spec; neither resolved the other.

**3. KAN-112 lands BEFORE KAN-99**, and the reason is sharper than the ticket's. `access` is **not a
blockade switch — it is the coin ceiling.** It multiplies *both* directions of commerce, so it sets
`[HC-87a]`'s cargo-funded appetite, which is **the only mechanism by which a place can be larger than
its own ground will feed.** So the warm start cannot avoid assuming an access *value*; redefining
`access` re-prices every opening ledger. Calibrate once, against the final meaning.

**4. Day 0 fixes all four axes** — population, works, wealth **and** footprint. Largely free under
decision 1, since a world run forward grows its own.

**What the scope pass found, and these are facts rather than opinions:**

- **There is not one capital work anywhere in the world on day 0.** `settleOpening` calls `stepWorks`
  but never `governorTurn`, and *every* earner in the catalogue is capital-class. **That is why
  nothing is fed from the sea: the works half of KAN-99 IS the sea-fed half.**
- **`settleOpening` solves a steady state that no longer exists, structurally.** Its three-pass loop
  finds a *local* fixed point, but since the trade seam landed the fixed point is **coupled** across
  neighbours (`carryingCapacity` reads cleared trade, and clearing is global by `[HC-7]`) and
  **stochastic** (weather has a mean, not a steady state). General form: **a fixed-point solver
  written before a system was coupled stays green and stops being right.**
- **`[HC-22]`'s twenty-year test runs the wrong world.** It steps each town *alone* — no weather, no
  trade, no clearing. The spec calls it "the cheapest test of the whole generator", and it has never
  met the world the generator now feeds.
- **Three currently-green assertions forbid what KAN-99 exists to build**, including one capping a
  city at 150 souls. They pin pre-KAN-99 behaviour the spec has superseded, so they are **rewritten,
  not deleted** — that is the ratified-only rule, and the rewrite is part of the story.
- **There is no founding rule for WEALTH**, though `[HC-22]` demands one — `SIZES.wealth` is a flat
  120/340/900. Since maintenance was priced against standing works, a mature works list owes roughly
  **4% of its raise cost per year**, so a day-0 city as currently classed is under water.
- **`guaranteeVictuals` is a third mechanism holding world dependency down** — the generator
  guarantees every place bears food, citing `[HC-22]`. Worth knowing before anyone tries to make the
  world hungrier.

---
### 2026-09-15 (fifth) — The world has a face, and the line says it stopped

KAN-100 is built, and it is the first thing in this project a person can look at. Everything before it
was proved headless; `[HC-0]` says *done* is a century that reads as plausible and whose changes have
nameable causes, and no test had ever answered that.

**What it is.** A dark chart of the invented sea, 1500 × 800 nm. Fifty marks carrying all three
`[HC-69]` axes at once — shape for purpose, colour for crown, area for population, rim weight for
size class. Storms crawl across as a disc with a bright core and a track, clipped to the sea. **Each
port wears its OWN ring in the severity it felt**, which is the thing a storm blob cannot draw:
`[HC-32]`'s *"two towns twenty miles apart may feel the same event very differently"* is invisible
otherwise. Five named rates — Pause · Watch 2/s · Passage 12/s · Season 90/s · Century 720/s — plus a
blocking century that lands in about a second.

**Verified in a real browser**, not merely built: 1660 → 1760, no console error but a favicon 404,
the sea box measuring 1168 × 624 px for 1500 × 800 nm — the fit exact to the pixel.

**It answers the milestone's question, and the answer is legible.** The trend key reads
*"souls to 8800 · coin to 170718 · **population found their level**"* — which is §8's named failure
mode, stated by the view itself rather than left for someone to notice. Souls climb 3,913 → 6,694 by
1690 and sit at 6,671 in 1759; **coin climbs without bound**, which is the treasury problem recorded
in the (third) entry showing up on a chart.

**What it cannot show, and a test now says so.** `run.test.ts` pins that across a century **nothing
is promoted and nothing changes hands** — because both need dispatches, and nations do not act yet.
**That claim should FAIL the day KAN-101 lands**, which is the point of writing it: the ratified
success sentence is *"fifty dots that grow, shrink and change colour"*, and two thirds of it is
reachable today. The dots grow and shrink. Nothing changes colour.

**Three findings worth keeping:**
- **`[P-17c]` taken all the way**: the coast bakes into one `Path2D` in **world coordinates**, and the
  canvas transform does the projection. Panning and zooming then cost a matrix rather than 1,928
  vertices. The general shape for any baked geometry this project adds.
- **`[P-50]` and `[P-51]` are new** — a snapshot field's beat must match what it copies, and a cull
  with a wrong margin is worse than no cull. Both were real bugs in this view before they were rules.
- **The reachability check found three dead exports in code written the same hour.** *Who calls this,
  outside a test?* is worth running on your own work before committing, not only on inherited systems.

**Measured for the record** (seed 1660): headless century **0.96 s** bare, **1.08 s** with the view's
per-day sampling · 247 works destroyed per century · 774 grade drops · storms alive on **34%** of days,
mean 0.45, max 6 · all 35 baked coast lines closed, so land fills as polygons.

---
### 2026-09-15 (fourth) — The clamp is the rule: a fix that raises a threshold to lower one is a net loss

Both weather fixes landed. The subsistence one produced **the most transferable finding of the
week**, and it was found by measurement rather than by reasoning.

**The obvious form of the fix is wrong.** "Subsistence hands scale with yield" reads as
`hands = def.hands × q`, symmetric in both directions. Built that way it **fixed the one place that
dies and emptied three that stand** — across five seeds. The cause: unclamped, well-suited ground
asks **7.8 men where the catalogue writes 6**, so the *manning threshold rises on good ground* — and
**good ground is where nearly every place actually lives.**

**The shipped form is `hands = def.hands × min(q, 1) × walk`, and the clamp is the rule, not a
detail.** It makes the change **monotone**: it can only ever ask *fewer* men, so no place's threshold
can rise. Above 1 it does not scale, because good ground does not take more men — **it repays the
same men better**, which is exactly what the yield half already says and what §2.5 means by terrain
*biasing* a crop.

> **The general form, worth carrying well past this ticket: a storm-battered place lives near the
> BOTTOM of its margin, not the top of it. So any change that buys headroom at the bad end by
> spending it at the good end is a net loss, however symmetric it looks.** Check the sign of a
> proposed fix at *both* ends of its range before believing it.

**The margin needed no new constant.** A place mans its work while `food · pull · labourShare ≥
hands`, and the worst `pull` the model permits is `POP.prosperityPull.min = 0.5` — so the required
ratio is **2**, and a place may lose half its people to a shock and still work its ground. The
catalogue already cleared it (garden plots 2.75, fishing shacks 3.03; over the ridge 2.04 and 2.24).
**The breach was wider than recorded: far ground was under water at EVERY grade**, not only `poor`.

**`[HC-67]`'s 10.91 souls is no longer a world constant — the floor is now per place**, running 3.82
souls (poor, at hand) to 14.73 (well suited, over the ridge). Two test oracles still spell out the
old figure; they keep their teeth as strong bars but their comments were corrected, because 10.91 is
now neither the cheapest case nor the dearest.

**Measured end to end, which neither agent could do alone** (200 years, seeds 20260910 / 1660 / 7 / 99):

| | 20260910 | 1660 | 7 | 99 |
|---|---|---|---|---|
| population, no weather | 10,654 | 12,147 | 8,807 | 9,945 |
| population, before both fixes | 6,477 | 7,979 | 5,566 | 6,932 |
| **population, both fixes** | **7,326** | **8,834** | **5,841** | **6,742** |
| **wealth, both fixes** | **495k** | **419k** | **633k** | **474k** |
| **ruins, both fixes** | **499** | **550** | **584** | **612** |

**Weather now costs about 30% of population and 40–50% of wealth over two centuries**, and ruins land
near 11 per place per 200 years — inside §7's own *"roughly once a generation"*. Seed 99's population
came out slightly *below* the maintenance-only run, which is a real interaction rather than noise:
freed labour raises more works, more standing fabric draws bigger maintenance bills. Recorded, not
tuned.

**Two smaller findings kept:**
- **A stability claim needs a liveness guard.** *"It stands still rather than sliding on"* is also
  satisfied by a town of nobody, so every mutation that killed the place outright sailed straight
  through the claim named for stability. **Where a claim says something stopped moving, it must also
  say the thing is still there.** Now in `testing.md`.
- **`provisionGround` — the capital food work — has a margin of 0.9625 on poor ground** and cannot pay
  its own wages there. That is the governor's problem by design and cannot empty a place, but it is
  the only food work in the catalogue still under water anywhere. Recorded, not fixed.

---
### 2026-09-15 (third) — A tuning table that has never met a ledger is not tuned

The weather seam landed and storms reached towns for the first time. Over 200 years the world moved
hard: **population −39%, wealth −86%, ruins 35 → 470.** The seam itself was proved innocent — with
the ledger handed zeroes the run is **bit-identical** to before — so what moved was a `BANDS` table
written for KAN-90 that **had no consumer at all until yesterday.**

**The measurement that located it** (20 years × 50 places, seed 1660): a place sees **50.3
contact-days a year**, from **6.82 storms averaging 7.4 contact-days each** — 47.6 Blow-days, 2.26
Gale-days, 0.44 Tempest-days.

**Why the two columns came out differently is the whole lesson.**

| Column | Written as | Read as | Verdict |
|---|---|---|---|
| **Yield** | per day | per day | Fine. ~0.11 × ~3 gale-days ≈ the 0.30 §7.4 asks for. |
| **Wealth** | per **event** | per **day** | Charged ~7× too often, and against the wrong base. |

**Two ratified decisions, both the human's, both recorded on the spec:**

**1. Storm maintenance is priced against the town's WORKS, never its treasury.** A share of coin on
hand compounds to **~18.6% of all wealth per year** and is a proportional ceiling on wealth dressed
as a maintenance cost. It is also the wrong fiction: a broken gate costs what a broken gate costs,
and charging a share of the coffers means a rich town pays a thousand times more to mend the same
fence. Priced against standing works, what varies is *how much fence there is* — and the poor town
still feels it more, because the same bill is a larger share of a smaller purse.

**2. Subsistence hand costs scale with yield**, closing the `[HC-18]` breach that went live the same
day: with a shock source in the world, seed 20260911 dropped a place to **0.49 souls** by ordinary
decline. Chosen over "the generator must guarantee fair food ground" because it makes the rule true
**by construction** rather than by the generator's luck, and leaves world generation free to site
thin, marginal places.

**What it measured once built (2026-09-15), and two problems it uncovered.** The bill is priced
against `standingValue` — the standing works at what the catalogue charges to raise them. Over 200
years across four seeds wealth went **121k → 438k**, against an **851k** no-weather control. The
burden inverted as intended: the richest town now pays **0.17–0.36%** of its purse a year, a
near-broke one **38%** of what little it has; before, both paid 18.56% *by construction*.

- **Ruins went UP ~5–10%, and that is correct.** Towns can now afford to build, so there is more
  fabric standing for a storm to find. A measurement moving the "wrong" way is not automatically a
  regression.
- **`Derived.upkeep` was rejected as the base**, and the reason generalises — see `[P-49]`'s
  companion note. It reads as the town's maintenance liability and is `population × upkeepPerHead`:
  it prices souls, not fabric.
- **The common band dominates the coin under per-day charging.** Blows are **107× as frequent** as
  tempests, so they carry **74%** of all weather-driven coin loss even after tempests were made 33×
  dearer. Any future band tuning must reckon with frequency before severity.

**TWO OPEN PROBLEMS, recorded so they are not rediscovered:**

1. **Nothing bounds a treasury.** With the proportional drain gone, **weather was the only thing
   stopping wealth accumulating without limit**, and nothing else in the model does. If total wealth
   reads too high, the answer is a **wealth sink**, not a bigger storm. Wants a decision.
2. **`bandFloorShare` puts a sawtooth at every band boundary, in every column.** At 0.35, the
   *bottom* of a gale costs less than the *top* of a blow (0.0007 against 0.001). Monotonicity holds
   row-to-row but not across the boundary. **Pre-existing, affects yield as well as maintenance, and
   never examined.** Reported, not tuned.


**The general lesson, and it is the sharper cousin of this week's reachability rule.** *"Who calls
this, outside a test?"* finds unwired code. This finds something worse: **code that is wired, tested,
green — and whose numbers have never been exercised by anything.** `BANDS` had unit tests. Every one
passed. None of them could notice that the table's numbers were calibrated in units the caller did
not use.

- **A constants table is not tuned until something consumes it end to end.** Until then its numbers
  are a proposal, and calling them "tuning" flatters them.
- **Ask what UNIT a number was written in, and what unit its caller reads it in.** Per event vs per
  day is invisible in a unit test of either side and catastrophic across the seam — the yield column
  survived the same wiring untouched precisely because both ends agreed on "per day".
- **A rate applied to a stock compounds.** Any per-tick cost expressed as a share of an accumulating
  quantity is a growth ceiling in disguise; that is worth checking on sight, before measuring.

---
### 2026-09-15 (second) — The world gets an outline, and a place to draw it from

The first piece of the world map view. There was no coastline geometry anywhere in the project,
because the world's shape is a **pure field** — thirty-odd elliptical lobes under two fbm stacks,
answered at any resolution and storing nothing. Drawing a coast means contouring it.

**`worldview/` is a new top-level directory, and the reason is a rule.** `guardrails.test.ts`
discovers every file under `overworld/` and enforces the simulation's rules on it, `[P-11]` — *never
read a wall clock* — included. A render loop must read one. **Separate directories are what let both
rules stay absolute rather than growing an exception list**, and the boundary is asserted in both
directions by source scan. Proven by experiment: `performance.now()` planted in `worldview/` leaves
the whole suite green.

**`[P-17c]` is new and generalises the trade-off this ticket had to make.** `[P-17]` says a pure
function of `(identity, time, seed)` is computed on demand; `[P-2]` says complexity × **tick rate**.
The coast is the first case where those pull apart: the simulation is right to derive the field — it
asks a few thousand times at generation — and a 60 Hz view would ask **300,000 times a frame** for
the same picture. Nothing about the function changed; **the reader did.** So it is baked once, into
the view, never onto the `World`, and `[HC-26]` survives untouched: looking still cannot change what
is true.

**Three findings worth keeping past this ticket:**

- **A marching-squares saddle is a correctness question, and the field is the only honest arbiter.**
  The textbook corner-average agrees with the *interpolant* rather than with the world, and
  neighbouring cells that disagree give a shore that crosses itself. Asking the field at the cell
  centre costs one evaluation in **0.003%** of cells. Generalises to any contouring this project adds.
- **Bake resolution is settled by the THINNED vertex count, not the raw one.** Raw vertices grow with
  the lattice for ever; thinned vertices **stop** once the lattice is finer than the field's finest
  octave — 1,417 at 2 nm against 1,575 at 1 nm, for four times the work. The right resolution is the
  last one where simplification still finds new shape.
- **One resolution does not serve all zoom levels, and that was left undone deliberately.** At full
  extent 2 nm is about two pixels; at 8× it reads as a polygon. The answer is a finer bake of the
  *visible box*, not of the world — which is why the step is an argument and not a constant. Nothing
  speculative was built for it.

**And an honest caveat the agent raised against itself**, which is the reachability rule from the
day before working as intended: `bakeCoast` **has no caller outside its own test file.** It is a
component, not a feature, until the renderer lands. Expected for the first half of a view — but it
means the integration claim, *"the map draws a coast a human recognises"*, belongs to whoever builds
the second end and **cannot be inferred from a green suite.**

---
### 2026-09-15 — One clock, and a leaf to read it from

KAN-107 deleted `Town.season`. Every date a place keeps is now **days since world epoch** — the same
integer `world.day` is — and the world hands the day in rather than the ledger reaching for it
(`[HC-71]`). Two places founded in different years can be compared on one timeline, which could not
be done before and which KAN-99 and KAN-100 both need.

**The structural problem, and the pattern worth reusing.** The town needs the calendar; the calendar
lived in `clock.ts`; `clock.ts` owns the `World` and so pulls in `climate`, `dispatch`, `factions`,
`places`, `shape` and `weather`, several of which import from `town/`. Importing it from the town
would have closed a cycle. **The answer was a LEAF: `overworld/calendar.ts` imports nothing at all**,
holds the calendar table (`[HC-90]`) and the pure day→(year, season, day-of-season) conversions, and
both layers read it. A file with no imports can close no cycle.

**And the leaf-ness is asserted, not trusted.** A test reads the source and fails if the word
`import` appears in it. That is `[P-17b]` — *enforce a prohibition by signature, not discipline* —
extended from function signatures to module structure: **a property of the source is checked in the
source.** The general form is worth keeping: when a module's whole warrant is what it does *not*
depend on, that is a claim, and claims go in the suite.

**`[P-47]` now has a hat-trick in one week**, and the three are the same bug wearing three hats:

| Deleted | Was previewing | Ticket |
|---|---|---|
| `garrison: 14` | the watch a grade actually fields | KAN-109 |
| `POP.floor: 12` | the floor subsistence works already produce | KAN-106 |
| `SEASONS_PER_YEAR` | `CALENDAR.seasonsPerYear` | KAN-107 |

**In all three, prose in the same file already said the number was wrong** — and in all three it had
been sitting there for weeks. That is the cheap detection rule: **a constant with a comment nearby
explaining what really determines it is already a bug report.**

**A constraint KAN-99 inherits, found by anticipating it rather than by hitting it.** A place founded
before the world's epoch holds a **negative** day, which is exactly what a warm start will write.
`Math.trunc(-1 / 360)` is `-0`, so day −1 would read as the epoch year rather than the year before
it; `Math.floor` is right across the whole integer range. Both are exactly specified (`[P-7]`), so
determinism was never the question — **only one of them is correct**, and the difference is invisible
until a date goes below zero.

---
### 2026-09-14 (third) — A ladder rung that costs nothing is not a rung

KAN-108 found that the devolution ladder — `working → idle → decayed → ruin`, documented in three
separate files as recoverable at every grade — was **one-way below the first rung**. Labour
allocation only ever considered `working` and `idle` works, so a decayed work could never be
re-manned and **every one of them was guaranteed to reach `ruin`.**

**Ratified: the grades differ in what coming back COSTS, not in whether it is possible.**
`idle → working` costs hands and is free, taken by the ledger. `decayed → idle` costs one rung **and
coin** — a fraction of raising the work new — and is the governor's priced decision. `ruin` is
terminal. A mend buys a **rung, never a jump**, so labour allocation stays the only thing that ever
writes `working`, and a priced mend cannot bypass the labour ceiling.

*Why it had to cost something:* a free mend erases the difference between `idle` and `decayed` and
leaves a middle rung that means nothing. **A step that costs nothing is not "legible", which is what
the spec claims each step is.**

**Three findings worth more than the fix:**

**1. Where a priced decision may live is structural, not stylistic.** `[HC-78]` pays imports before
construction and the works ledger runs in **phase 1, PRODUCE** — before the quay is paid in phase 3.
So **nothing in phase 1 may spend coin**; it would come out of the purse the town buys its corn with.
The obvious contained fix — put the repair in the works ledger — was therefore *not available*, and
the reason is a ratified rule rather than a preference. **The ledger cannot mend anything by itself.**

**2. The auction's five terms score a KIND, not an INSTANCE**, which is a permanent limit on what can
ever be put into it. The land term reads the best *free* ground; the market term reads the catalogue.
A standing work has neither — its ground is under it, its trade already scaled by suit and reach. So
repair, upgrade and demolition cannot be scored by those terms without a second path to a value the
instance already holds (`[P-47]`). And the auction cannot always *see* the want: while a decayed work
holds its hex, its kind may drop out of the wants-list entirely — **the thing that creates the need
to mend is the thing that hides it from the auction.**

**3. §5.6's labour gate has a general form, and every future verb that spends coin on a work needs
it.** *raise → rot → raise* and *mend → rot → mend* are one pathology: **never buy a state change
unless the work would actually go back to work.** The sharpest case is a work the footprint has built
over — claimed ground is permanent, so paying to mend one is an unbounded leak *by construction*.
Measured: a presidio with ninety thousand coin and six souls made **0 mends in sixty years**; with
men, exactly **1**, and it stuck.

**A judgement call, confirmed rather than merely accepted.** Purpose's vocabulary gate is **not**
applied to a mend — a governor may mend a work his purpose would not let him raise. This is correct
and cannot misfire: `[HC-56]` says a place's purpose never changes and `[HC-49]` says an invasion
leaves the ledger intact, so a standing work was always raised under the place's own vocabulary.
A guard that cannot fire is `[P-1]`'s to refuse.

**The ticket's own description was overstated, and the record is corrected.** A decayed work does not
sterilise its ground; it holds one hex and one slot for four years and then ruins and gives both back.
Measured. *(Second time in two days a recorded bug's description was stronger than the bug —
worth noticing that a ticket written from reading code inherits the confidence of the reader.)*

---
### 2026-09-14 (second) — The hamlet floor is a labour floor, and poor ground cannot pay for itself

KAN-106 deleted `POP.floor` and let the floor emerge from subsistence works, which is what the
constant's own comment three lines above it had claimed all along. Two things came out of building
it, and the second needs a decision.

**1. "Survivors" has a number, and it is 10.91 souls.** Not a food threshold — a **labour** one:
`gardenPlots.hands / WORKS.labourShare`. A lone survivor raises a garden plot and then cannot man it,
so it idles, feeds nobody, and the place empties. Measured on ideal ground: openings of 1, 2, 4, 8,
10 and 10.5 all fall to **zero**; 11 and up recover to 27. Recorded on `[HC-67]`.

**2. A criterion that fails, and it is open.** On `poor` food ground one garden plot feeds **10.5
mouths** and costs **10.91 souls** of labour, so a town on nothing but poor ground **cannot sustain
the hands that work it**. Each step down idles another plot and it cascades: measured **163 → 0 in
about forty years**, by ordinary decline, with no hand laid on it — which is `[HC-18]` violated.
`fair` (21) and `ideal` (39) are both stable.

**It is latent, not live**, and worth being precise about why: the generator gives every place
several food regions plus fishing, and 387 places across 8 seeds ran two centuries with **0 emptied**,
the smallest at 40.6 souls. But 22 of 46 places in the sample seed have only *poor* as their best food
grade, and `ground.test.ts` only ever asserts that a place bears food at all — never at what grade.
**The deleted constant was hiding this, not preventing it.**

Two candidate fixes, neither taken, because this is a design call and not a tuning one:
- **Strengthen `[HC-22]`** so the ground generator must give every place at least *fair* food. Keeps
  the catalogue honest; makes the generator carry the guarantee.
- **Make subsistence hand costs scale with yield**, so a plot always feeds its own workers whatever
  the ground. Keeps the generator free; makes the rule true by construction rather than by supply.

*Why this is logged rather than fixed:* the ratified working principle is **report the criterion that
fails; never tune until it passes** (2026-09-10, fourth). This is its fifth instance, and the first
where the failing criterion was *invisible while a constant propped it up*. Which is the sharper
lesson: **a floor written as a constant does not enforce the rule it is named after — it conceals
whether the rule holds.**

**A third finding, recorded because nothing else says it.** Growth eats its own cause. A town fed fat
on bought bread builds over its own garden plots, so when the shipping stops it falls back to *less*
than the twin that never traded — 131.4 against 140.8, measured. That is `[HC-87]`'s fragile ceiling
being sharper than `[HC-87]` says: a raid does not merely remove the bought half, it finds a town that
has already demolished the grown half.

---
### 2026-09-14 — Three seams were specced, built on both sides, and never connected

Found by a scope pass on the world map view (KAN-100), and recorded because the pattern matters more
than the three instances: **a system can be fully built, fully tested, and have no caller.** Nothing
in the suite fails, because every piece genuinely works. The *wire* is what is missing, and a green
suite has nothing to say about a wire that was never drawn.

| Seam | Both ends exist | What connects them |
|---|---|---|
| §2.2's daily tick | `stepWeather`, `stepDispatches`, `stepDay` | Nothing. `runYears` (`overworld/market.ts`) steps days and clears seasons and calls neither. The four daily phases are assembled **only inside `weather.test.ts`**. |
| Weather → the ledger | `contactAt`/`feltAt` answer what a place felt; `[HC-6]` splits damage (an event) from yield (a modifier) | Nothing. `contactAt` has no caller outside its own test. `Town` has no field to accumulate a season's yield modifier into, and `produceSeason` takes no such argument. |
| Dispatches → the world | `sendDispatch`, `positionOf`, four payloads, `[P-16]` proven | Nothing. `sendDispatch` is called only from `dispatch.test.ts`. **No dispatch has ever existed at runtime.** |

**The consequence, as arithmetic rather than opinion.** The ratified one-line picture of success for
the world view is *"fifty dots that grow, shrink and change colour, with storms crawling across
them"* (2026-09-09). Colour is faction; faction changes only by invasion; an invasion is a dispatch;
no dispatch has ever been sent. Size class changes only on a charter's arrival (`[HC-8]`), and a
charter is also a dispatch. So built today, the dots grow and shrink and the storms crawl, and
**nothing ever changes colour or class across the whole century** — two thirds of that sentence is
unreachable until KAN-101.

**Decided 2026-09-14:** build the view **and** wire the weather seam — the daily tick composed, storms
reaching works and harvests — so that *"how the weather impacts areas"* is true when you look at it.
Nations acting stays out of this pass; frozen factions are accepted and named rather than discovered
later.

*Why this is worth a log entry.* The project already holds that **"a green suite proves nothing over
code the suite deliberately skips."** This is its sharper cousin, and it is worse, because here the
suite skips nothing and covers both ends of every seam. **Coverage of two components is not evidence
that anything calls either one.** The check that finds it is a reachability question, not a coverage
question: *who calls this, outside a test?* Worth running against any system declared finished.

---

### 2026-09-10 (fourth) — Report the criterion that fails; never tune until it passes

A working principle, recorded because it is now the single biggest source of spec improvement in the
project and it happened four times in three days without anyone naming it.

**The rule: when built work cannot satisfy a ratified criterion, it reports the failure and the
measurement. It does not adjust a number until the criterion passes.** A tuned pass hides a design
problem inside a constant, where it is invisible and will be rediscovered later by someone with less
context. A reported failure is a decision brought back to the people who can make it.

**Every one of these was a spec change that came from a build refusing to make the spec look right:**

| What was reported | What it changed |
|---|---|
| A per-**event** cap on storm destruction is unreachable without a code path that knows an event happened — which `[HC-33]` forbids. Measured residue: 25 of 457 pairs took two works, never three. | `[HC-35]` reworded to **per contact**, with the tension between the two constraints ratified rather than papered over. |
| Three spec lines disagreed about whether a neutral place can be invaded. | `[HC-51a]`, and a design fact about the player's haven that had never been stated. |
| A city written at 200 souls **measurably shrank to 108**, because the ledger settles at ~50–210 with no trade layer. | `[HC-22]` became a **founding rule** rather than a check, and KAN-99 inherited a named constraint instead of a surprise. |
| A shuffle **cannot** catch a first-come-first-served clearing — it would be perfectly reproducible and still wrong. | `[HC-7]`'s acceptance criterion was **weaker than the rule it protected**; pro-rata now has its own claim. |

Two more arrived the same way without changing a rule: `[HC-87]` is **not statable at world scale**
until `access` reads routes rather than works, and `[HC-14]`'s "three numbers" needed clarifying to
mean *no stored **derived** quantity* rather than *no fourth field*.

**Two corollaries worth keeping:**
- **Constraints that are each individually correct can still generate a broken world where they
  meet.** `[HC-22a]` and `[HC-22b]` are both interaction bugs, not rule bugs — a neutral city would
  have been an unpromotable great port, and strict nearest-seat assignment left France holding only
  its capital.
- **Say which statistic a criterion means.** Weather's rates are bimodal by design (exposure
  compounds with the zone's regime), so mean and median differ by 3× on rare events, and "a
  representative place" is not a number.

*Why:* the human's standing instruction has been *questions, not guesses* since the beginning. This
is the same instruction pointed at the build rather than at the brief — **a criterion that cannot be
met is a question, and tuning it is a guess.**

---

### 2026-09-10 (third) — A crown can come for your haven

Not a decision taken deliberately so much as one **discovered by building**, and it is a design fact
rather than an implementation detail, so it is recorded where design facts live.

Three spec lines disagreed, and the dispatch work (KAN-105) surfaced it: §8.7 says the neutral share
of the map *"can only shrink"* — which requires neutral places to be takeable; the §8 acceptance
criteria said *no neutral place ever receives a dispatch* — but an arriving invasion force **is** a
dispatch; and §8.6 makes invasions available *"between the belligerents"*, and a neutral is never at
war. Resolved as `[HC-51a]`:

> **A neutral place receives no dispatch of SUPPORT, but can receive an invasion.** No treasury, no
> reinforcements, no charter — a neutral has no patron and can never be chartered, which is what the
> criterion was actually protecting. But taking a neutral place is not a war action against another
> crown, and it is the only way *"can only shrink"* is anything but decorative.

**The consequence, stated plainly because it is about the player and not about dispatches: a
pirate haven is a neutral place, so a crown may come for yours.**

*Why this is right rather than merely consistent:* it is the threat that makes a haven worth
defending. A haven no crown can touch is a safe-deposit box, and the ratified design already says
holding ground should cost something — breadth breeds defection, friction-capped, *pirate not
emperor*. A crown that can eventually come for you is the same idea arriving from outside instead of
from within.

**What it obliges:** a haven's defences have to *matter*, so `[HC-59]`'s garrison model is now
load-bearing for player safety and not only for target selection. And the reputation layer needs to
decide what makes a crown come — being worth the blood is the whole spine.

**Open, and the human's call when it arrives:** whether a haven you have *developed* is harder to
take than one you merely hold, and whether there is any way to make a crown decide you are not worth
it short of beating them. Neither blocks anything today. Spec: `world-simulation.md` `[HC-51a]`.

---

### 2026-09-10 (second) — Content lives in data. We are not building a mod system.

Raised by the human, drawn to how Factorio ships its own expansions through its modding seam. He
explored it deliberately (*"I'm still just exploring the idea"*), then supplied the two facts that
settle it: **he is the only consumer**, and *"if I ever want to port this, I'd like to already have
played with the modding idea, instead of figuring it out then."*

**The decision: make content data-driven; do not build mod machinery.**

- **YES — definitions live in data tables.** The works catalogue, every number in `constants.ts`,
  terrain and produce and suitability, the crowns' identities and characters, climate zones, name
  pools and display prose. Later: ship classes, and building/character skins.
- **NO — no mod machinery.** No loader, no manifest format, no versioning, no load-order resolution,
  no merge semantics, no sandbox, and no public API to keep stable.
- **NO — behaviour stays in code.** The auction, the tick order, the trade clearing, the will-spine.

*Why:* **with one consumer this was never really about modding — it is about data-driven content, and
the economics are completely different.** Every cost Factorio actually paid is the price of a *second
author*: a staffed breaking-changes forum thread running since 2019, a ~600-line community porting
guide, load-order arms races (`zzz-fix-your-shit`), a Lua sandbox escape that reached RCE, and
*"even something as simple as renaming a sprite can break dozens of mods."* None of those is the
price of content living in a table. Strip the second author and most of the value survives at a
fraction of the cost.

**The argument that actually decided it — the port.** *Code does not port; data does.* A rewrite in
another language carries the balance, the industries, the terrain and the tuning across intact if
they are data files. As TypeScript object literals welded to union types, they are a rewrite. **The
content is the expensive-to-recreate, cheap-to-move part of a game — if it is allowed to be movable.**

**And it is not "no modding, ever" — it is modding minus the machinery.** The tables *are* most of
what a mod system needs. A loader added later, on top of content that already lives in data, is a
small contained job; a loader built first is a road to nowhere. Meanwhile **the human is already his
own first modder** — able to add an industry or retune the auction without touching simulation code,
which is the value he was reaching for. The mod system was never what would have given him that.

**Timing, and this is the operative half.** Rows for **nations, climate zones and ship classes cost
nothing**, because those systems do not exist yet — writing their definitions as tables is not extra
work, it is a choice made at the moment of writing, and **that window closes as each system lands.**
The works catalogue is the one piece of real work: it is already a complete prototype table, blocked
only by `WorkKind` being a closed TypeScript union.

**The one real cost, and how it is avoided.** Opening `WorkKind` would lose the compile-time
exhaustiveness that `Record<WorkKind, WorkDef>` currently enforces, plus autocomplete and
go-to-definition — a genuine daily tax for a solo developer. **Resolution: generate the union type
from the data at build time.** The data file is the source of truth; a build step emits the union.
Exhaustiveness, autocomplete and portability all survive, so the trade-off mostly is not one.

**Recorded against the temptation to go further:** behaviour-as-data means inventing a DSL, and DSL
creep is the universal failure mode — mcfunction has no loops so the community built them from
`/execute` chains and scoreboards; CK3 grew a `while` capped at 1000 iterations and text-substitution
macros; RimWorld's *patch* format grew conditionals and feature detection. **For one consumer who can
edit TypeScript directly, a DSL is a worse TypeScript.** Dwarf Fortress's model is the right one:
raws stayed declarative for content *instances*, and when real logic was finally needed (v52.01,
2025) Lua was added *alongside* rather than growing the token language.

**Two research findings kept because they outlive this decision:**
- **The clean way to describe the split is *types versus instances*.** Factorio's C++ engine owns the
  ~500 prototype *types* and all their update logic; the `base` mod supplies *instances*. **A mod can
  never add a type.**
- **Nobody designs this up front, including Wube.** *(Human's own correction, 2026-09-10: Quality
  ships as a mod and, as of experimental 2.1, can be disabled while Space Age stays enabled.)*
  Twelve years in and two years past Space Age, 2.1 is **still** doing separability work — Quality
  made independently disableable, the Recycler split out, a new `+` dependency modifier invented for
  it, the collision-layer cap raised 55→256. It arrived incrementally, pulled along by content that
  needed separating. That is the evidence for extracting a seam when something pulls on it, rather
  than in advance of a consumer.
- **Both halves are true at once**: the same 2.1 release that made Quality separable also added
  engine-side quality behaviour (quality multipliers on modules and rolling stock, locomotive speed
  and tank volume scaling with quality). The mod supplies the levels and their numbers; **the engine
  knows what quality means.** The `*_required` feature flags are the *declared* boundary between
  "data I supply" and "engine capability I need" — the transferable idea.

Spec: `world-simulation.md` `[HC-90]`–`[HC-92]`. **Nothing implemented; the human explicitly said not
to.**

---

### 2026-09-10 — The spec outranks the shipped module; three manager's calls ratified

**The precedence rule, and it is the important half of this entry.** Asked to unpark the town suite
first, the human raised the right objection:

> "I'm nervous of writing town tests as the existing module is not 100% aligning to what we
> discussed. What we discussed now via the spec should take precedence. We can add tests to the
> ratified behaviour in the town module. As long as the spec wins out, and as long as what we're
> initially building towards gets completed."

Three rules follow, and they govern every piece of work from here:

1. **`world-simulation.md` outranks the shipped code.** Where the town module and the spec disagree,
   **the spec is right and the code is wrong** — the module predates the world layer. This joins the
   existing precedence chain: human edits > the spec > a ticket > the code.
2. **A test may pin only behaviour the spec RATIFIES.** Not "behaviour that currently exists". This
   is what makes unparking safe rather than a repeat of the churn that caused the park: the failure
   mode last time was pinning a design still being argued, and pinning code the spec is about to
   replace is the same mistake wearing different clothes.
3. **The milestone still has to land.** Testing is in service of the world simulation, not a
   detour before it. If the safe-to-pin set turns out to be small, that is a *good* outcome — write
   those, and move on.

*Why:* the park's exit condition was "the design locks", and it has — but the design that locked is
the **spec**, not the module. Testing the module as it stands would pin the pre-spec design just as
the post-spec one arrives.

**And three manager's calls are now ratified**, so the spec no longer flags them as overrulable:

- **`[HC-3]` the 360-day year** — four seasons of exactly 90, no real calendar.
- **`[HC-60]` the defence ladder is `picket · garrison · fortress`** — clearing its collision with the
  *settlement → town → city* size class. The rename must land before either ladder is extended.
- **`[HC-56]` a pirate haven's purpose is `trade`** — its character comes from being a neutral
  *faction*, not from a fourth purpose. **Accepted "for now"; the human has reserved pirate havens for
  a later pass.** Build against `trade` and expect this one back.

**The audit that followed, and four contradictions it found.** The shipped town module was read
against the spec to separate what is safe to pin from what the spec replaces. Result: **`[HC-70]`
fences off most of the ledger, the auction, the works ladder and the footprint** — roughly nineteen
pinnable design claims, none blocked by a refactor. **Unparking is purely additive.** What the spec
replaces is concentrated in `land.ts` and in the `archetype` / `tier` / `yield` seams.

Four places where the **code contradicts a rule rather than merely lagging it.** These are
bugs-in-waiting, not pending work — all four verified in the code:

1. **`sim.ts:101` — the population floor is unconditional, so `Abandoned` is unreachable.**
   `Math.max(POP.floor, …)` applies every season with no condition, so a place razed to nothing
   repopulates to the floor on the next tick. `[HC-67]` is explicit that **the floor requires
   survivors** — that single condition is the whole mechanism by which abandonment sticks, and
   `[HC-18]`, `[HC-50]` and `[HC-66]` all stand on it. **Testing consequence:** the hamlet-floor test
   must claim *"a stripped town feeds and houses itself again"*, **never** *"population never falls
   below the floor"* — the obvious test would pin the bug.
2. **The town owns a private clock.** `town.season++` (`sim.ts:103`), and the devolution ladder is
   denominated in it (`works.ts:241,252` — `town.season − w.idleSince`). Against `[HC-9]` (*no system
   carries its own clock*) and `[HC-3]` (all stored time is one integer of days since world epoch).
   Two places founded in different years cannot currently be compared on one timeline.
3. **The ladder collision is THREE-way and reaches outside the town module.** `game/src/types.ts:13`
   — `SettlementTier = settlement | town | capital` — welds size and garrison hardness onto, in its
   own words, *"a single size axis"*, and its comment plans a militarised `outpost` as a future tier.
   That contradicts `[HC-54]` and `[HC-59]` (the axes are independent — which is the whole reason a
   military settlement can outfight a bigger town), `[HC-55]` (*outpost is a reading, not a class*)
   and `[HC-60]`. Note the three value sets overlap **differently**: world `settlement·town·city`,
   town `outpost·town·capital`, raid layer `settlement·town·capital`.
   **The rename has FIVE reader locations, not three** — `game/src/types.ts:13` (the type),
   `game/src/spawn.ts:157,264` (the default), `game/src/world.ts:80`, `game/src/town/sim.ts:53`
   (`tierOf`), and **`game/src/constants.ts:172`** (the `TIER` record of garrison stat bands, which
   is where the numbers actually live). And **the retired "militarised outpost as a future tier"
   plan is written down twice** — `types.ts:13` and `constants.ts:169-170` — so fixing only the type
   would leave the contradicted plan alive in the file that holds the bands. Ticket **KAN-104**
   (widened).
4. **`decayed` is a dead end that sterilises its ground.** `allocateLabour` admits only
   `working | idle` (`works.ts:224`) and revives only `idle` (`works.ts:237`), while a decayed work
   still holds its hex and its `max` slot until it rots to `ruin`. So a town whose battery decays can
   neither re-man it nor rebuild it until its own defences finish falling down. Against
   `town-economy.md` §3's *"recoverable grades … each is reversible"*, which `[HC-70]` has just
   re-ratified.

**Two consequences nobody had named:** `[HC-57]`/`[HC-58]` make the works **vocabulary** size-gated,
where today `CHOOSABLE` offers the same twelve works to every place — that belongs on the
archetype-retirement work, not to be discovered later. And **`chronicle[]` does not exist in shipped
code** though `town-economy.md` §1 persists it and §10.4 calls it the home for every `[HC-16]` reason;
the reasons currently live in the harness's DOM-side journal, which is not good enough for a rule
stated as a *testability* requirement.

**One thing the audit confirmed rather than found:** the sea-lies-south split is clean in code.
`southness` reaches the simulation only inside `rollLand`; every other consumer is presentation. So
`[HC-73]`'s *"generation dies, drawing convention lives"* costs `land.ts` and nothing else, exactly as
`[HC-73]` claims. (`hex.ts:74`'s `isSeaward` is dead code and can go with it.)

---

### 2026-09-09 (second) — Six ratified lines moved; abandonment finally gets a cause

Ratified by the human *after* the fourteen forks below were settled. He deliberately deferred these
six until his other answers were in — **"I didn't want to answer those and possibly contradict what
I've already answered"** — which was the right call: re-derived against the answers, one line closed
itself, two were decided outright, and only three still carried a real choice. He agreed every
proposal.

- **AMENDED — *"an outpost is barely worth blockading"*.** The funding independence stands: an
  outpost's coin still comes from the crown and it still never chases a market. **The blockade
  conclusion is struck.** Because an outpost now imports the majority of its needs and its crown
  support arrives as an interceptable shipment, it is **the most supply-fragile place on the map** —
  the exact inverse of the old line. The idea the line was protecting — *a target worth declining* —
  survives, relocated: **an outpost is a poor raid and an excellent interception.** Little to loot,
  but a lifeline you can cut. *Why:* this gives the interception game its natural first target
  instead of leaving it abstract.
- **HALF-OVERRULED — *"comforts and munitions are CUT"*.** **Luxury returns as a real class of traded
  good; munitions stay cut.** And it returns as a **third import class**, not an export-only
  flavour: a town with its victuals and materials covered then wants luxury, and goes short without
  it. The original cut reason (it duplicated prosperity) is answered by making the appetite **a need
  with teeth** rather than a second prosperity meter. **New rule ratified in the same breath:
  luxury is trade cargo, NOT the default plunder payout.**
  > "In Cutthroats we had trade, different resources. But on a raiding, there was always gold and
  > jewels. Luxury goods as trading is fine. Jewels as a standard raiding currency is what I pushed
  > back on."
- **STANDS UNTOUCHED — *"a sacked town always crawls back"*.** The hamlet floor is not switched off by
  anything. **"Ruined" is a *description* of a town sitting on that floor** — a hamlet living in the
  wreck of a town — not a new state and not a new stored field. Of the three failure states, *poor*
  recovers unaided, *ruined* recovers only with substantial outside help (from the nation, which
  treats it as a cost-vs-benefit call and generally leads with a show of force, or from the player),
  and *abandoned* does not recover. **Recovery must never be a grinding mechanic for the player.**
- **STRUCK — *"a re-founded town rolls its footprint back to nothing"*.** Abandonment is
  unrecoverable — *"abandoned, not really"* — so the clause described something that cannot happen.
  Spec §4's *patroned towns refound instead of abandoning* is a different rule and survives untouched.
- **RETIRED FOR TOWNS, KEPT FOR SHIPS — *"untouched towns run a cheap approximation"*.** At ~50 places
  every town runs the real ledger and every town's century is real; watching all fifty *is* the
  milestone. The principle was not rejected, it was **relocated** — it is now the three-ring ship
  model, where thousands of hulls make it earn its keep. Re-add for towns only if 50 proves slow.
- **SUPERSEDED — *"cities are placed by hand when the world is made"*.** Nothing is placed by a human
  hand: cities are **designated by the generator at world creation** and are never demoted.
  "Promotion is one-way" stands exactly as ratified. (Not a real contradiction: "authored" was
  contrasted with *emergent from growth*, never with *procedural*.)

**Two new rules his answers forced:**
- **A catastrophic storm CAN destroy a single work.** Rare, one at a time, only at the very top of
  the severity spectrum. **This overturns the manager's earlier default that storms never raze.**
  The player's verb stays distinct because **razing is deliberate and wholesale; the storm is random
  and singular.** A town can lose its quay to the sea.
- **Only a deliberate hand empties a town.** With the hamlet floor intact, decline alone can never
  empty a place — so `Abandoned` needed a cause or it was a state nothing could enter. It is now
  reachable **only** by being razed to nothing, by a player or by a war. **Abandonment is something
  done *to* a place, never something it drifts into.**

**And one documentation consequence:** the world is invented every game, so **Havana, Port Royal and
Tortuga survive as *heritage references* — what we build toward in feel — and are no longer map
content.**

*Why:* a ratified line should be struck deliberately, not drifted past. Each of the six was
resurfaced with what the new answers did to it and an explicit proposal, and each was consented to
rather than inferred.

---

### 2026-09-09 — The world layer: fifty generated ports, a warm start, and three rings

Fourteen forks put to the human and answered. This is the world the town engine will be driven
from. Read together with the amendments above.

**The world, and how it is made**
- **~50 places, procedurally generated, invented every game.** New coastlines, generated place names
  from per-nation pools, five real crowns. *"This is more of an open sandbox game, rather than a
  narrated story."*
- **Warm start.** The generator writes a believable 1660s map — cities already cities, a great port
  here, a hamlet there — and the simulation runs on from that day. Not a cold world watched from its
  origin.
- **The world decides a town's land.** A town's ground is cut from the world map at its position: its
  coast, its climate, and what it will bear.
  > **REFINED 2026-09-10 — the sea-lies-south invariant SURVIVES, as a drawing convention.** This
  > bullet first recorded the invariant as dying outright, and as the largest piece of rework the
  > world layer creates. That overstated it. `town-economy.md` §2.7 states the invariant's own
  > purpose: **"The invariant is about readability, not geography."** So both halves hold at once —
  > **the world holds a place's TRUE coastal bearing, and the town's local views are drawn in a
  > local frame whose south is seaward.** What dies is only code that *generates* a town's land
  > facing south independently of the world; what survives is the presentation rule that open water
  > lies in the southern arc and the raid map's landing edge is the near edge. A rotation into a
  > town-local frame preserves it exactly. Materially less rework, and a ratified readability rule
  > kept. Spec: `world-simulation.md` `[HC-73]`. Ticket **KAN-103** (re-briefed).
- **Nations are configured, not generated** — five crowns with fixed identities; the generator only
  decides who holds what on day one.
- **The neutral set is fixed at generation.** No new abbeys or havens found themselves over two
  centuries, so the neutral share of the map can only shrink as crowns take places. **Neutral
  factions stay neutral and have no expansionist agenda** — *"an abbey has no reason to try expand.
  A pirate haven is a place for drinking and whoring."* Neutral is still a faction, not an absence
  of one. **Your own haven is the standing exception** — its agenda is you.

**Time, determinism and fidelity**
- **The world owns one clock and one random stream.** A place's founding roll still takes a seed, but
  it is derived from the world seed, so the whole world is reproducible from one number.
- **"Reproducible" means the entire history**, not merely the starting state: the same seed
  fast-forwarded twice gives the same two hundred years, at any speed.
- **Two beats:** days for weather and travel; the season for economies, governors and nations.
- **Every one of the ~50 places runs at full fidelity, always** (see the retirement above).

**Ships — the three-ring model (the human's own design)**
> "Generic trade ships can stop existing and just fall back to the simulation. But a governor has
> real impact, so this might be a permanent ship. Reinforcements are important. … So perhaps 3
> rings? near = loaded, granular, reachable with direct action (can catch up if we go for it
> directly), loaded, trackable, permanent. On the side of the map, just simulated."

- **Near** — every ship a real object with a position and a course. **Middle** — ships exist and hold
  a course but are not drawn in detail; **a chase committed to will find its quarry there.** **Far**
  — ordinary trade is a flow between ports, with no objects at all.
- **The governing rule: the flow is the truth; ships are how the truth is drawn.**
- **A ring is a rendering and interaction boundary, NEVER a simulation boundary.** The flow resolves
  identically whether anyone is watching; a materialised ship is a *view* of it, never a second
  source of truth. Get this backwards and the same seed yields two histories, and the speed control
  becomes a lie.
- **The four war-currencies are permanent objects in all three rings** — treasury, reinforcements,
  charter, invasion force: findable, chaseable, takeable. There are only ever a dozen or so, so they
  cost nothing; the thousands of anonymous grain hoys are what dissolve. **This is the sole carve-out
  from the ratified ban on goods physically shipped between AI towns** — ordinary cargo stays a flow.
- Cost recorded honestly: **the middle ring is the expensive one**, because "trackable and permanent"
  means a course that survives being unwatched. Affordable at 50 ports; not at 500.
- **These are the four currencies by which a player tips a war:** towns raided or won and handed to a
  nation · treasury or reinforcements intercepted so support never lands · **a charter intercepted,
  which stops a town upgrading** · an invasion force intercepted, protecting a town from changing hands.

**Places and their economies**
- **Towns trade with named neighbours.** One town's surplus grain is another's imported bread; prices
  stay local; a burned quay is felt three bays over. **The specced abstract partner ("the shipping")
  is therefore dead weight** — trade will be written against real neighbours directly.
- **An outpost is a town with a narrowed purpose.** Same mechanics, same governor shaping its growth;
  **purpose decides which way that growth can go**, and a town has more latitude than an outpost.
  Militaristic is the only purpose in scope for now.
  > "An outpost still works on most of the same mechanics of a town. A governor still shapes the
  > direction of an outpost's growth. Its growth will always just be shaped by its purpose, whereas
  > towns have a bit more flexibility."

  Framed by the human against *Galactic Civilizations*: an outpost there is mining, cultural or
  militaristic and that purpose defines it; a planet with tiles is the analogue of a town. **This
  refines rather than replaces "every place tries to be as self-sufficient as it can":** the drive is
  universal; what a place counts as *its own job* is not.
- **Needs are a pyramid of shape, not of list.** Basic → refined → luxury, and a place reaches up only
  once the tier below is secure. No catalogue authored yet.
- **The three names are retired as a taxonomy.** `colony` / `royalOutpost` / `pirateHaven` were
  *"examples of how they fit into the world"*. What the field actually carries in code — the
  governor's build priorities and the sprawl temperament — **moves onto the axes** (purpose supplies
  priorities, funding supplies temperament). Note for the record: the field was **never** the funding
  model; funding is already separate.
- **An outpost buys its victuals with the crown's grant**, which the shipped equation already permits.
  Naming the replacement ceiling as the ratified rule requires: **the grant becomes the outpost's
  population ceiling.**
- **The charter is automatic.** A quiet threshold fires a visible event — charter granted, governor
  installed — with nothing between the threshold and the grant. **So intercepting the charter is the
  only thing that can stop a promotion.**

**Weather**
- **Severity is a moving point on one continuous spectrum**, read at the place and moment of contact,
  never off the event's name. An event forms, travels, and **gains or loses momentum as it goes**.
  **One event is not one consequence** — nothing is owed damage merely because a storm arrived.
- **Ordinary storms are common and cheap; bad ones are rare and memorable.** The human's own gradient:
  *loose shingles* — a little coin on maintenance and no real impact; *a downpour on the fields* — a
  surplus of 100 becomes 70; *a bad one* — the warehouse goes over and its contents spoil; and at the
  very top, a work destroyed outright.
- **Climate is written at world generation and does not change**; weather happens within its rules.

**The build order**
1. **Generate a world against a seed.**
2. **Run it with no player at all** — the only external forces are the world systems: how nations
   impact places, how weather impacts places. **Success looks like a world map:** fifty dots that
   grow, shrink and change colour, with storms crawling across them.
3. **Connect the overworld to the town view** — a continuous zoom down to the hex map and the ground
   plan, *both of which already exist and already ship*.

- **Sequence within that: world, then weather, then trade.** So the first cut of "how the towns
  interact" is *how they react to the same storms*; real named-neighbour trade lands third.
- **In scope for the sim milestone:** time and the speed control · the map as positions, distances
  and coastlines · weather · nations · places · the ledger · trade. **Out:** the port, raiding,
  officers, and **the sailing model** — with no player ship, wind need only move storms and make a
  sea route take time.
- **The world-sim view is a developer instrument**, so the ratified "at most ~5 surfaced values per
  town" and "no numbers-only town screen" rules — which govern the **player's** view — do not
  constrain it.

**Hygiene, recorded so the spec can be written without collisions**
- **`Region` is overloaded and gets renamed at the world scale.** The town's land groups keep the word
  (it is in shipped code); the world's climate divisions are **zones**, or the spec reads as "each cane
  flat gets its own climate". *Manager's call, taken because the world spec could not be written
  without a word and both the generator and weather were blocked on it — one word, overrule freely.*
  Spec: `world-simulation.md` `[HC-23]`.
  > **Refined 2026-09-10 — this half costs NO code.** The town keeps `Region`; the world generator
  > creates `zones` correctly from the start, so there is nothing to migrate. **The real work under
  > this heading is the other overload:** `tierOf`'s `outpost / town / capital` measures *garrison
  > hardness* and collides with the *settlement → town → city* size class in shipped code
  > (`[HC-60]`). That split is now the subject of **KAN-104**, which blocks the warm start rather
  > than the generator. Manager's proposed replacement ladder: **`picket · garrison · fortress`.**
- **Two ladders, renamed rather than merged.** `tierOf`'s `outpost/town/capital` is *how hard the
  garrison is*; settlement → town → city is *size class*. Same words, different jobs.
- **The metropolis question is UNPARKED and answered.** Class is emergent below city and designated at
  city, decided at world generation — so **`tierOf` is no longer blocked** by a parked question.
- **The town suite is PARKED, not missing — and its exit condition has just been met.** `game/` holds
  no test files, but that is not drift from the 2026-09-07 Vitest decision: on **2026-09-08 the human
  parked it deliberately** — *"For the town, ignore the tests — until we've locked down what the town
  should do"* — because the land model had been reshaped three times in two days and each reshape
  churned the suite harder than the code. The suite was **removed rather than left red**, and
  `--passWithNoTests` was added so a parked suite would not read as a failing one (`cd9b6e9`). All of
  that was correct and is recorded in `implementation/testing.md`.
  **What changes today: `testing.md` says "the suite comes back when the design locks." The design has
  now locked.** So the park is spent, and the tests worth writing first are the ones already named
  there — the hamlet floor, the shipways idle for want of planks, a governor who will not raise what
  nobody can man, and a reproducibility test per module. Do this **before** the world sim is stacked on
  the ledger, and note it gates a chain: tests → the sea-lies-south rework → the generator handing a
  town its land. Ticket **KAN-102**.
- **CORRECTION TO THE RECORD — there is no trading engine.** `priceOf`, `access` and `commerce` do not
  exist anywhere in `game/src/town/`. `derive()` still computes `yield = trade + grant − upkeep` with a
  flat per-work `trade`, and `surplus` is still discarded on a prosperity nudge. §3.5 is **spec only**;
  KAN-91–94 are unbuilt. Any document claiming the trade seam "held" was describing a design, not code.

*Why:* the human asked for the whole world to be settled before any of it was built, and for
questions rather than guesses — *"get a list of questions to me rather than try something and then
clear it up afterwards."* These are his answers, quoted verbatim wherever the wording carries the rule.

Spec: [spec/world-simulation.md](spec/world-simulation.md) — the tick order, the interaction model
and the hard constraints this entry becomes.
Tickets: **KAN-96** (epic, the world layer) → **KAN-97** clock · **KAN-98** generator · **KAN-105**
the dispatch · **KAN-99** warm start · **KAN-101** nations · **KAN-90** weather (reparented from
KAN-67) · **KAN-100** world map view. Unparented tasks: **KAN-102** unpark the town suite ·
**KAN-103** a town's land comes from the world map · **KAN-104** split the two overloaded ladders.
Re-briefed: **KAN-91–95**. Each story cites the spec and defers to it: **where a ticket and
`world-simulation.md` disagree, the spec wins.**

**The blocking graph** — recorded here because it otherwise exists only scattered across ticket
bodies:

```
KAN-97 (clock) ─────────────────────────────► everything
KAN-102 (tests) → KAN-103 (town land) → KAN-98 (generator)
KAN-97 + KAN-98 → KAN-105 (dispatch) → { KAN-99 (warm start), KAN-101 (nations) }
KAN-104 (ladders) → KAN-99
KAN-99 → KAN-100 (world map view)
```

Note what sits at the head of it: **three refactors of shipped, currently untested sim code.** That
is why `KAN-102` is first and not housekeeping.

**Not ticketed, deliberately:** the three-ring ship fidelity model (specced in §6; needs a player to
matter) · **interception itself** (§2.2 step 4 is a deliberate no-op in this milestone) · step 3 of
the build order, the continuous zoom from overworld to town. **The war-currency *object* IS in scope
and is KAN-105** — a manager's error corrected 2026-09-10: nations cannot fund or charter anything
without it, so the player-free simulation stands on it even though no one can intercept it yet.

---

### 2026-09-08 (fifth) — Towns trade: a town's wealth is EARNED, not emitted
Three ratified calls from the human in one message. Together they move the module's centre of
gravity: what makes a town live is its own trade, and the player is a visitor to it.

**1. Every town has an internal trading engine.**

> A town has trade. Grain is just one thing they buy. Basically they buy what they need. If they
> grow enough grain and export the surplus, they don't import it. Most settlements will try [to be]
> as self sufficient as possible, except for cities that [are] more metropolis. Again, we think
> about these things logically. Considering they generate wealth, this is done via trade. So each
> town has an underlying trading engine, that the player ties into when they come to port.

- **Wealth is EARNED, not emitted.** Today `yield = trade + grant - upkeep`, where `trade` is a flat
  number each work emits — a sawpit simply produces coin. Under this call a town's wealth is the
  result of **selling what it has spare and paying for what it lacks**.
- **The seam already exists and is currently thrown away.** `sim.ts` computes `surplus: food - mouths`
  every season and uses it only to nudge prosperity. **Surplus is never sold; deficit is never
  bought.** That discarded number is where the engine attaches.
- **Self-sufficiency is the default posture**, not an optimisation. A settlement tries to cover its
  own needs; only a **metropolis** leans on imports. This is a preference expressed in the
  governor's *need* term, not a hard rule.
- **This is expected to lift the ~450-soul ceiling honestly.** Population is capped at
  `foodCap = localFood / perHead`, so no town can outgrow the ground it farms — which is why towns
  claim only 1-3 of ~24 land hexes in a century. Bought food raises that cap. **Whatever replaces
  land as the binding limit must be named explicitly**: the point is to move the wall somewhere
  sensible, not to remove it.
- **KAN-54 is unparked and reordered.** It was "the trade layer, later". It is now **foundational** —
  the wealth model depends on it, and the town menu has nothing to trade against without it.

**Ordering consequence: the trading engine comes before any player-facing layer, always.**

**2. Growth outside the walls is accepted as it stands.**

> That's fine. if the outpost expand outside the walls, there is logic to it. Housing built outside,
> farming happening outside, etc.

- The frozen `circuit` and the faubourg behaviour are **ratified as sufficient**. A wall is raised
  once and never re-drawn; a claimed hex outside it is a suburb.
- **The open question about walls being broken down and re-raised at a larger circuit is CLOSED —
  do not build it.** What must be legible is that the overspill is *logical* (housing outside,
  farming outside), not that the wall moves.

**3. The investment slider is withdrawn; a town changes only through its own engine.**

> Ignore this slider. it was meant to test something, but we'll address that as part of Towns menu,
> where you can head to the docs, trade, visit the govenor, etc. For now let changes to the town
> happen only through the natural growth engine (population growth, internal trading engine, weather
> systems, all of which I know aren't built yet).

- **The three natural drivers are named:** population growth · the internal trading engine ·
  weather. Those, and nothing else, move a town for now.
- **The player's entire surface becomes the town menu** — the docks, trade, the governor. Levers
  designed against the slider are **parked there, not cancelled**: the steer (guns/coin/hands), a
  named production line, investing coin, the bribery ladder, granting ground in a haven you own.
- **KAN-72 is closed as superseded.** Its **archetypes survive**; its slider does not.
- This makes the "living world, not a management screen" pillar **stronger**. It used to be defended
  by keeping the dial small. It is now defended by there being **no dial at all**.

*Why:* a town whose wealth is emitted by its own buildings cannot be surprised, cannot fail, and can
never *need* anything — which is the deepest reason a century of simulation produced a flat line.
Trade gives a town appetites; weather gives it shocks; together they are what make a hundred years
of it worth watching. And moving the player's agency from a dial to a doorway keeps the world
running on its own terms.

**Three follow-up answers, same day.**

- **The heritage is CONFIRMED, and it is lineage rather than invention.** Asked whether
  *Cutthroats* had per-town goods prices you traded against, the human answered **"yes — that
  allows for trade."** Research had found only the *negative* heritage (town wealth was a number
  that responded to sacking) and had recorded the engine as our own addition. **The human is the
  domain expert on the original; his answer supersedes the gap.** §3.5 therefore **restores**
  something the original did. The tuning question becomes *"does this feel like Cutthroats?"*
  rather than *"is this defensible?"*. The **footprint remains genuinely our addition** — do not
  conflate the two.
- **TWO import classes, not four: victuals and materials.** **Comforts and munitions are CUT**
  because they duplicated **prosperity** and **security**, which already exist — two systems doing
  one job. If an appetite for cloth or powder ever needs a voice it **modulates the existing
  measure** instead of becoming a good.
  > **HALF-OVERRULED 2026-09-09 — THREE import classes: victuals · materials · LUXURY.** The human
  > restored luxury as a real traded good *and* as a need with teeth: a town with victuals and
  > materials covered then wants luxury and goes short without it. **Munitions stay cut.** The
  > duplication objection is answered by making the appetite a need rather than a second prosperity
  > meter. New rule in the same breath: **luxury is trade cargo, not the default plunder payout.** Materials are the one that earns its place: a town that
  cannot get timber and stone **cannot build however rich it is**, so razing the quay of a
  stone-poor island stops it rebuilding its wall.
- **The metropolis question is PARKED — the human reserved it.**
  > **UNPARKED AND ANSWERED 2026-09-09.** Class is **emergent below city, designated at city**, and
  > decided at world generation. **`tierOf` is no longer blocked** — but see the two-ladders note in
  > the 2026-09-09 entry: `tierOf`'s `outpost/town/capital` measures *garrison hardness*, not size
  > class, and gets renamed rather than extended.

  *Whether a town's CLASS
  (village → town → city → metropolis) emerges from growth or is authored when the world is
  made* was put to him and he declined to settle it here: **"this describes how the entire world
  works."** A recommendation of *emergent* is on file; **it is not ratified and must not be
  assumed.** `dependency` itself is unaffected — it measures one town's own balance and needs no
  world model — so **KAN-91 is not blocked**. But `tierOf`, which already derives a tier today,
  **is inside the scope of the parked question** and should not be extended until it is settled.

Spec: [spec/town-economy.md](spec/town-economy.md).
Tickets: **KAN-54** (unparked, foundational) · **KAN-89** (town menu, new) · **KAN-90** (weather,
new) · **KAN-72** (closed, superseded) · **KAN-77** and **KAN-81** (amended).

---

### 2026-09-08 (fourth) — The hex map is a zoning overview, not a scale map
A framing correction from the human, and it settles a tension the ground plan had been papering
over. Stated by him, and it governs everything downstream:

> **Ideally the hex map is a zoning planning overview, and not a scaled map. It represents the lay
> of the land, and represents how the town is constructed on it.**

- **A hex is not a measured acreage.** It says what that ground is *for* and roughly where it lies.
  The **ground plan is the actual place**; the relationship between them is **interpretation, not a
  scaled blow-up**. The 800-paces-per-hex constant is therefore a **layout guide** — it fixes
  relative arrangement, bearing and adjacency — and must never be read as "a hex is 800 paces of
  literal ground".
- **THE LEDGER GIVES THE SCALE; THE PLAN GIVES THE FORM.** The ledger says how much development
  stands on a piece of ground. The plan decides what that looks like. One timber work is a sawpit;
  three on one region are a mill and its yards, not three identical sheds. A `dwellings` work is a
  row of huts.
- **This GENERALISES the dwellings exception rather than adding to it.** The cluster was recorded
  as "the one sanctioned departure from one-work-one-building". Under this framing it is not a
  departure at all — it is the general rule, and dwellings were merely the first case where the
  old rule visibly failed. **Strike the exception; keep the behaviour.**
- **Consequence for the fidelity contracts, recorded honestly rather than glossed:**
  - **Contract 3 (Count) is softened.** It said *"sawpits ×3 means three sawpits on the ground —
    not 'some industry'"*. It now means: **three works' worth of timber industry, visibly greater
    than one work's worth, standing on that region's ground.** The count is legible as *scale*, not
    necessarily as a headcount of buildings.
  - **Contract 9 (Spread) is softened the same way.** Works of one kind on one region are **one
    installation whose size reflects how many** — not N buildings in a row. What must remain true
    is that **the place and the scale of an industry are both legible**: you can see that timber is
    worked, where, and how much.
  - **The human's original requirement still holds and is the test:** *"if a new lumber mill is
    built and I land there with my units, I want to see the lumber mill."* Building a second timber
    work must visibly change the ground — as a larger installation if not as a second building.
- **Implementation:** works are grouped by `(region, kind)`; the group draws as one installation at
  the centre of the ground it occupies, with area growing by the square root of the count so a big
  works reads as bigger without swallowing the map. A group with nothing working draws as a ruin.

**Deferred, explicitly — the human flagged it as vague and not to be taken verbatim:**
- **Tile levels / upgrades.** *"Tiles can be upgraded later — one lumber tile might represent
  different numbers or levels of a mill."* A work may later carry a **level** as well as a place,
  so a region can deepen without spreading. The grouping above is the seam that will express it:
  the plan already renders a group by its total, so a level is just another input to that total.
  **Do not build it until the shape is clearer.**
- **In-town works are not yet grouped.** The same rule should eventually apply to warehouses,
  taverns and the rest; today they still take one frontage each. Left alone because a town's
  buildings stand on streets and the case for merging them is weaker than for a mill and its yards.
- **Plan extent is still keyed on hex count × 800, capped at 4000 paces.** Under a zoning framing it
  should arguably key on how big the town actually *is* (population and core grade) rather than on
  how many hexes it holds. Flagged, not changed — the cap keeps it honest for now.

*Why:* the hex map was never meant to be a map of the ground, and treating it as one forced a
one-work-one-building rule that produced ninety souls living in two houses. Separating *how much*
(the ledger) from *what it looks like* (the plan) removes a special case, makes room for levels
later, and keeps the thing the human actually asked for: land you land on and recognise.
Spec: [spec/town-economy.md](spec/town-economy.md) §7 stage 4 and §7.5.

---

### 2026-09-08 (third) — The land takes a shape: regions, not parcels; suitability, not determinism
A correction round, prompted by the human looking at the rendered map. It supersedes parts of both
entries below it, and it is cheaper than it looks because the ledger never knew what a hex was.

**The correction, recorded honestly.** The 2026-09-08 (second) rejection of the "tract" model was
right about *identical sub-hexes under a fixed count* and **wrong as a general rule**. Dilution
comes from **independent per-tile sampling** — twenty tiles rolled independently converge on the
same average by the law of large numbers. That is dilution by *statistics*, not by tile count.
**Clustering breaks the independence:** draw four regions, paint them across 24 hexes. Few draws,
high variance, high resolution — a richer picture from *fewer* decisions. The general rule that
replaces the old one:

> **A hex must carry information no other hex carries, or belong to a region whose size and shape
> mean something.**

---

**The land**
- **~24 land hexes in a generated irregular coast**, grown outward from the town with a cleanup
  pass, **and only the water that touches land is drawn at all.** That single rule kills the wasted
  ring. Plus **1–3 detached offshore hexes** (a cay, a reef) — cheap, and they do enormous work for
  "this is a real stretch of coast".
- **The REGION is the parcel.** 3–5 live regions + 1–3 dead, contiguous, grown from the existing
  biased roll and the existing `SUPPORTING` adjacency table. Sizes come from a **budgeted, skewed**
  draw: **one dominant at roughly a third of the workable land**, one or two supporting, some
  minor. **Area is capacity** — five timber hexes means room for five sawpits, each on its own hex.
- **The four rules that now protect identity (R1–R4):**
  **R1 — the land is a partition, not a menu.** Every land hex belongs to exactly one region; a hex
  given to timber is a hex not given to cane. Identity is proportion, and **proportion is
  zero-sum** — this is what stops "access to several resources" becoming "access to all of them".
  **R2 — one hex = one work's ground.** The direct successor to the struck rule, in a better place.
  **R3 — the roll is biased in AREA, not only in kind.** *This is where dilution now lives.*
  **R4 — one label per region, never per hex.** A hex is a unit of area, not of announcement; this
  is the single biggest anti-quilt measure.
- **Identity now comes from three sources where it came from one:** **proportion** (the strongest,
  and entirely new) · the **dominant region** · **shape and adjacency** (which the raid map cashes
  in). Headline for the spec: **"A town is what most of its ground is for."**
- **Named failure mode:** if region sizes come out uniform we rebuild the mush at a larger scale.
  Guarded by an acceptance test — *in 20 rolled towns the dominant region holds at least a third of
  the workable land in at least 15.*
- **Inaccessible ground is one derived flag — `reach: 'at hand' | 'far'`** — a region that does not
  touch the town's claimed hexes. Its works **cost more hands and are dropped first when hands are
  short** (the shipped `allocateLabour` sort does this for free), and on the raid map they stand
  **away from the muster** — an isolated mill you can take unopposed. *"There is fine timber over
  the ridge; nothing much has ever come out of it."* An offshore cay is permanently `far`.

**Terrain BIASES; it does not DETERMINE** *(the human's call)*
> *"A field might have a good bonus to cotton. You might plant barley on it, which works — but
> cotton would have been ideal. That gives towns adaptability. But I cannot plant cotton on
> bedrock."*

- **The catalogue splits in two.** **Crops & extraction** (cotton walk, grain fields, cane field,
  provision grounds, sawpit, quarry, salt works, fishing shacks) take **graded suitability**.
  **Sited works** (shipway, careenage, quay, warehouse, customs house, battery) keep a **hard
  ground requirement** — you cannot half-build a harbour on a hill. Only ~8 works move.
- **`region.bears: Partial<Record<Produce, Suit>>`**, `Suit = ideal | fair | poor`, and **absent =
  will not bear.** Keyed on what a work **produces**, not on its kind, so adding a work needs no
  new column. `roomFor` is unchanged (region area); the yield scale is a one-line table swap.
- Every grade owns a clause: *ideal* — "this ground was made for cotton" · *fair* — "it will take
  barley well enough" · *poor* — "it grudges a crop; a third of what the cotton would pay" ·
  *absent* — **"you cannot plant cotton on bedrock"** (the human's own words are the rule).
- **`ParcelQuality` is STRUCK.** Suitability subsumes it: **area** is *how much*, **suitability** is
  *how well, and for what*, and `quality` was the second with the meaning taken out. It could write
  no clause suitability cannot write better, and two dials for one feeling is a tuning trap.
- **Suitability is ROLLED, not fixed per terrain** — the terrain sets the shortlist and the odds,
  the roll sets *this town's* profile. That absorbs the one job `quality` really had (distinguishing
  two towns with the same terrain) and does it with meaning attached.
- **The partition survives because it is over GROUND, not produce.** Six tilled hexes are six hexes
  of tilled ground whichever crop stands on them. Adaptability changes what a region **earns**; it
  never changes how much ground the town **has**. Zero-sum intact.
- **Suitability sits on the REGION** (per-hex ratings are the quilt and reopen a solvable surface),
  **with one "best of it" hex per region** — a single flagged sweet spot one grade better. One
  boolean, and it is why the boiling house stands where it does.
- **Climate seam, named and NOT designed:** `region.bears` is resolved **once at founding by a
  profile supplier**, and nothing downstream asks where it came from. First slice: a hand-authored
  terrain table plus a roll. Later: `climate(latitude, rainfall, elevation) × terrain` fills the
  same field. **The seam is that single function.**

**The town centre becomes a claimed hex set — and this REMOVES a concept**
- `footprint.spill: Record<Bearing, SpillLevel>` → **`footprint.claimed: Axial[]`**. `core` survives
  verbatim. The four-level spill ladder is struck.
- **"Growth eats its own cause" becomes literal and countable** — claim a cane hex and the cane
  region is one hex smaller, one cane field idle. You can see which quarter the town ate.
- The lobe tie-break improves: *prefer the candidate hex with the most already-claimed neighbours*,
  which produces lobes far more reliably on a hex field than on six bearings.
- **The wall becomes the FROZEN BOUNDARY of the claimed set at the moment it was raised, and is
  never re-extended as the town grows.** That is Havana 1671–1740 and Getsemaní exactly, and it
  makes fidelity contracts 7 (Trace) and 8 (Faubourg) mechanically trivial: **a claimed hex outside
  the frozen circuit *is* the faubourg.**
- **`Bearing` survives as prose and a coarse index, derived from a region's centroid.** New
  discipline rule: **never store a bearing as the spatial fact; derive it.** Axial is the truth.

**The steer's guard gains a middle register — and this is an upgrade**
| Register | Clause | Effect |
|---|---|---|
| **Refuses** | *"there is no ground for cane here"* | flat no — unchanged |
| **Grudges** | *"they can grow it; it pays a third of what the cotton would"* | the steer **lands, and is visibly a bad idea** |
| **Bears** | *"the ground was made for it"* | the steer pays |

A steer can now **land badly**, which is more interesting than a refusal and more legible than
silent underperformance — and it satisfies the ratified requirement that a steer must be able to
**visibly lose**. The grudge clause is published on the wants-list *before* the work is raised.
**Refusal survives in two distinct places:** the **hard gate** on sited works (where the
anti-"buy-anything" constraint really bites — the bribery ladder is gated on land that physically
is not there) and the **absent-entry floor** on crops. **The contador bribe is gated at the refusal
floor only** — buying grain on cotton ground succeeds and pays badly; *the poor return is the
discipline*.

**The human's two calls (2026-09-08):**
- **PERIOD IS FLAVOUR, NOT A CONSTRAINT.** *"A lot of these games run across several eras. I don't
  want to make a super historically correct game. Period is more the flavour."* **A standing steer
  beyond this feature:** historical research is **texture and inspiration, never a veto**. The
  game-designer should keep bringing it (it has repeatedly produced the best material in this
  design — Getsemaní, Havana's circuit, Port Royal unwalled), but must **not** rule a mechanic out
  on dates alone. Coffee and the later crops are therefore **in scope** if they earn their place on
  gameplay grounds. Where a date is interesting, note it; never gate on it.
- **THE RESOURCE LIST WAS ILLUSTRATIVE, NOT A SPEC.** *"Those resources don't have to be taken
  verbatim. It was more to show how the land can differ. Mining and smithing can be simplified. The
  entire trade layer will still need to be figured out later."* So: **do not triple the catalogue.**
  Add enough terrain and produce that towns visibly differ, keep mining/smithing **simplified**
  (a quarry or mine region and a work that stands on it — no ore→bloomery→smithy chain), and leave
  commodity identity, prices and shipping wholly to the trade epic. **Dependency edges stay at two.**

**Amendments — STRIKE:** *exactly 6 parcels* · *one hex = one parcel, never subdivided* (successor:
**one hex = one work's ground**) · *draw 37, simulate 7* (successor: **draw the land you have; no
hex is drawn that carries nothing**) · *the footprint's `spill` per bearing* · *`ParcelQuality`* ·
*the lobe-not-hexagon drawing rule* **in letter only** — held in spirit as **"the town is drawn as
one continuous silhouette, never a cluster of outlined hexagons"**.

**Amendments — CLARIFY:** *"parcels are immutable after founding"* → **"What the land IS is fixed at
founding. How much of it is left is not."** (terrain and suitability never change; extent only ever
shrinks, and only to the town) · *"parcel scarcity is the growth cap"* → **region area is the cap**,
and works and the town now **literally** compete for the same hexes · dead ground demoted from
primary variety source (it keeps its jobs and gains a fourth: **it makes the coast look real**, and
marsh/scrub become *regions* — the human's "more marsh options") · §7.6 **grants become
per-region** (*"the north woods — timber"*), 3–6 of them, which is even more clearly a landlord's
decision and less like placement.

**HELD:** *no hex is ever visible in a raid* (the risk goes **up** with smaller hexes) · the hex map
is **upstream** of the generator · **the sea lies south** (restated: the coastline is irregular,
which way it faces is not; guarantee at least one water hex adjacent to the town in the southern
arc) · flat-top hexes · **the biased founding roll**, extended to area · a region has **capacity,
never output** · **two dependency edges** · every do-not-build item — with the **new line to
defend: the player never chooses which hex the town claims next.**

**SCOPE:** the catalogue may grow (~12 → ~16), and it is safe because **the land is the filter** —
a town with cane, fields and a roadstead offers its governor a shortlist of five or six works
whatever the catalogue's size, so the five-term auction never gets noisier · **new guard: the raid
map covers the claimed set plus one ring of adjacent land, never the whole county** — beyond that,
growth raises *density*, not extent.

**Migration:** the **ledger, the auction and `sim.ts` are untouched** — they never knew what a hex
was, and that separation holding is why this is a reshape and not a restart. Reworked: `rollParcels`
→ a coast-and-region generator (~100 lines), ~60% of `footprint.ts`, most of the renderer's layout.
Struck code is **net negative lines** thanks to `quality` going. Expect **~15–25 test edits, nearly
all count-pinning** — and per the testing rules, if a *behaviour* test breaks that is a real
regression and a stop-and-think, not a number to update.

*Why:* one hex of "fields" is a poor way to say a town is surrounded by farmland, and the flower
read as a diagram rather than a place. Regions give proportion, shape and adjacency — three new
sources of identity — and suitability gives towns adaptability with a visible price. Together they
answer the human's requirement that *"if a new lumber mill is built and I land there, I want to see
the lumber mill"* at scale: five mills strung along a woodline, on ground that says why they are
there. Comparables (Manor Lords' rich-slot budget · Anno's per-island fertilities · Catan's fixed
tile budget · Total War's resources-gate-buildings) in
[spec/design-references.md](spec/design-references.md); the model in
[spec/town-economy.md](spec/town-economy.md) §2.

---

### 2026-09-08 (second) — The town footprint: the ring is fixed, the town spills over it
A town's built-up area becomes a growing thing, so a hamlet of forty and a port of nine hundred no
longer occupy identical ground (shaped with the game-designer; four calls answered by the human,
one of them an overrule). The load-bearing sentence:

> **The land a town works is fixed at founding. What grows is how much of it the town has built over.**

- **Two grains, separated.** *Economic* grain stays coarse — **six parcels, one per bearing,
  unchanged**. *Spatial* grain goes fine **on the footprint, not on the land**: a `core` density
  (`scattered · settled · close-built · packed · stone-built`) × a `spill` level per bearing
  (`clear · skirts · suburb · absorbed`). That is ~30 footprint states between hamlet and
  metropolis, at the cost of zero new simulated entities.
- **The tract model was considered and REJECTED.** Grouping many small hexes into ~6 economic
  tracts (the manager's proposal) buys **no information** — identical sub-hexes say what one hex
  says, for eight times the pixels — and **reopens an in-tract placement problem** the do-not-build
  list bans by name ("which sub-hex does the sawpit stand on?"). Answer it and there is adjacency to
  farm; refuse and the sub-hexes are decoration sold as resolution.
- **Encroachment draws as a LOBE biting into the inner edge of a ring hex** — never a sub-hex,
  never a hexagon. The hex is not divided; part of it is built over.
- **The footprint lives on the `Town`, not the `Parcel`** — the same precedent that let
  grant-the-ground coexist with "parcels are immutable after founding". That rule survives verbatim.
- **Pressure is room, measured in works.** Every work has a `zone`; everything not `beyondThePale`
  stands *inside* the town. `dwellings` already auto-raises one per 40 souls, so population drives
  the pressure through machinery that already exists. **Crowding = in-town works ÷ room.**
- **Relief in strict order — and step 1 before step 2 IS "builds inwards-out":**
  **densify** (free at low grades; costs wealth for stone and storeys) → **spill one step on the
  best unenclosed bearing** (free, but it eats that hex's capacity) → **spill OUTSIDE the wall**
  (a faubourg; free and undefended) → **nothing** (the `shelter` need goes unmet and prosperity
  sags — *"there is nowhere for this place to go"*).
- **The growth-preference order, each owning a clause:** dead **scrub** first (*"they have built
  out over the dry scrub"*) → **the water** → **its own industry's bearing** (the ratified stage-3
  skew) → **provision grounds / cane**, reluctantly (*"they have built over the northern fields"*)
  → **the bluff** last (a shanty on the hill) → **never marsh, never open sea**. So **dead ground
  now pays a third time**: the economic ceiling, the defensive gift, and now the release valve. A
  town with scrub to the north sprawls north for a century and keeps every good acre; a town ringed
  by rich cane must eat its cane to grow. The founding roll pays twice from one draw.
- **What stops it looking like a blob:** the preference order is strongly ordered (towns grow
  *lobes*, not rings) · dead ground and marsh break the symmetry · the wall holds one side rigid
  while the other sprawls. Adopt Frostpunk's radial *legibility*, reject its radial *uniformity*.
- **WALLS DO NOT STOP GROWTH. THEY SHAPE IT.** What stops growth is the ground and the archetype's
  purpose. A wall that hard-caps freezes a town forever; a wall that *deforms* growth yields
  suburbs outside the gate, an unfinished segment and an old trace through the middle of town —
  four different raids from one variable. The wall is the existing `palisade` work plus a
  `circuit: Bearing[]` recorded when raised; **built segment by segment, landward first, and an
  unfinished circuit is NORMAL**. **No build timers — expense is the pacing** (§1.1).
- **A wall is never demolished by decision.** Outgrown and unthreatened → unmaintained → idle →
  decayed → **ruin**, on the devolution ladder that already exists. A ruined trace running through
  built-up ground is a first-class raid feature.
- **The footprint never retreats.** Collapse leaves derelict ground, then ruins — free
  reinforcement of the golden-goose rule, and it is what gives sprawl teeth.
- **Four limits, and none of them is a number:** **food** (you cannot house more mouths than the
  land feeds) · **ground** (marsh and open sea refuse houses; a town ringed by mangrove can only
  densify) · **stone** (densifying above `close-built` costs wealth and has a ceiling grade) ·
  **purpose** (an outpost does not want to grow). Headline: **growth eats its own cause** — every
  quarter the town takes is capacity it loses.
- **Archetypes must read at a glance.** **Colony** sprawls eagerly and outgrows its wall. **Royal
  outpost** keeps *the same outline for a century and only darkens* — **its boundary is the
  stipend, not the wall** — and if the crown pulls the money it shrinks, rots its wall, and *only
  then* sprawls: a fishing village living in a ruined fort, generated by two existing systems
  shaking hands. **Pirate haven** sprawls raggedly, worst ground first, and never completes a
  circuit.
- **Zero new player verbs from the growth model itself.** The five-term auction handles walls
  unchanged; the town must **never** notify you that it has outgrown its wall.

**The human's four calls (2026-09-08):**
- **The footprint model, and draw 37 hexes** (radius 3 at ~26px, was 19 at 40px). The literal ask —
  "smaller tiles, more of them" — is honoured on the *drawing*, while the parcel ring stays six.
- **Absorbed ground is permanent** — build over the cane and the cane is gone. ~~The one exception:
  a town reaching the ratified `Abandoned` end-state and later re-founded rolls its footprint back
  to nothing and keeps its parcels.~~
  > **STRUCK 2026-09-09.** The human ruled abandonment unrecoverable — *"abandoned, not really"* —
  > so the exception described something that cannot happen. **Absorbed ground is permanent, full
  > stop.** Spec §4's *patroned towns refound instead of abandoning* is a different rule and stands.
- **OVERRULE — a haven owner MAY grant a hex "to the town".** The designer (and the manager)
  recommended refusing this as the thin end of zoning; the human ratified it. It is defensible on
  the same ground as every other grant: **you are still answering *what is this land for*, once,
  irreversibly, from a shortlist the terrain allows.** Zoning would be repaintable districts; a
  one-time irreversible grant has no solution space. **Guards:** haven-you-own only · one grant per
  hex, ever · irreversible without razing what stands · and **it directs where the town may spread,
  never where a building stands** — the sim still places every work.
- **Cutthroats heritage — CONFIRMED: bigger towns carried more wealth but did NOT expand.** So
  footprint growth is **our addition, not inherited**, and is logged as such (unlike town
  persistence, which was restoration).

**A hard requirement the human stated with this call — WORK VISIBILITY:**
> *"I do however want the town to physically grow. If a new lumber mill is built and I land there
> with my units, I want to see the lumber mill."*

**Every work in the ledger is a building on the ground.** This is fidelity contract 3 (Count)
promoted from a contract to a **requirement**: the projection may never abstract works into
"some industry". Build a sawpit in 1663 and the raid map of 1664 has a sawpit standing on that
bearing. This is the sharpest statement yet of *the ledger is the simulation, the map is a
projection* — and it is the reason the ledger stays at work granularity rather than collapsing
into a development number.

**Amendments to ratified text:**
- **"Draw 19, simulate 7" → "draw 37 (radius 3), simulate 7."** Drawing only; the simulated set is
  byte-identical.
- **"The centre hex IS the town; one centre hex = one raid map"** → **"The town's FOOTPRINT is the
  raid map. The footprint begins as the centre hex and grows over the ring."** One raid map per
  town survives; coextension with the centre hex does not.
- **Fidelity contract 4 (Size)** rewritten to key on the footprint rather than the centre glyph's
  density, and **three new contracts: 6 Skirts** (a suburb means buildings outside the town proper
  on that edge — approach cover) · **7 Trace** (the wall's `circuit` is exactly the bearings that
  carry a wall; an unenclosed bearing is the way in; a `ruin` wall draws *through* the built-up
  area) · **8 Faubourg** (a quarter outside the circuit puts the wall between core and suburb, so
  it runs through the middle of the map).
- **"Parcel scarcity IS the growth cap" EXTENDED** — parcel scarcity caps *works*, the ground caps
  *the town*, and the two compete for the same land.
- **Clarifying clause on "one hex = one parcel"** — *"a hex is one parcel; the town's built-up
  ground may lie over part of a parcel without dividing it into two."*
- **Scope guard:** do **not** add a third dependency edge for walls — wall grade upgrades the
  single wall work in place.

**Held verbatim:** exactly 6 parcels · parcels immutable after founding · **no hex is ever visible
in a raid** · no player building placement · ~5 surfaced numbers · no scheduled prompt · **no
worker or job assignment, ever** (the footprint biases what is *built*; `allocateLabour` stays
autonomous) · §1.1 · the four-stage grammar and its eight adjacency rules — **rule 7, "a full zone
grows outward", anticipated this whole feature and is now cashed in.**

**Known risk, recorded:** the footprint is gated on population being able to grow, and the shipped
food model caps a colony near **~450 souls** (bought grain is deliberately in the deferred trade
tail). Calibrate the room and spill thresholds to the band the sim *actually* produces, and re-tune
when the trade layer lands. **Do not pull grain-buying forward to make this work.**

*Why:* the strategic map has to predict the ground you fight on, and it currently predicts one
constant-sized ground for every town in the Caribbean. Making the footprint grow costs one struct
and one renderer, turns four existing systems (dead ground, the devolution ladder, the stipend, the
golden goose) into a hundred-year story, and hands the raid layer four genuinely different tactical
propositions from one variable. Comparables and the colonial Caribbean urban history that backs it
(Getsemaní, Havana's 1671–1740 circuit, Otrobanda, unwalled Port Royal) are in
[spec/design-references.md](spec/design-references.md); the model is in
[spec/town-economy.md](spec/town-economy.md) §2.5.

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
  > **SHARPENED 2026-09-09 — abandonment now has exactly one cause.** With the hamlet floor intact,
  > decline alone can never empty a place, so `Abandoned` was a state nothing could enter. It is
  > reachable **only by being razed to nothing**, by a player or by a war: **something done *to* a
  > place, never something it drifts into.** "Deliberate" is now literal. And *ruined* — the middle
  > failure state — is a **description of a town sitting on the hamlet floor**, not a state that
  > switches the floor off; no new stored field.
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
arbitrage · ~~full-fidelity simulation of untouched towns (they run a cheap approximation)~~.

> **RETIRED FOR TOWNS 2026-09-09 — kept for ships.** At ~50 places the approximation has no cost
> basis, and the world milestone *is* watching all fifty untouched towns run real centuries. Every
> place runs the real ledger. The principle was relocated rather than rejected: it is now the
> **three-ring ship model** (near = real objects · middle = exists and holds a course · far = trade
> is a flow), where thousands of hulls make it earn its keep. Re-add for towns only if 50 proves slow.
> **Every other item in this list stands.**

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
