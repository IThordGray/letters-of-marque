# The World Loop — one page

**Layer:** WHAT · **Scope:** world · **Authority:** human edits win.

Fifty invented ports and one clock, running without a player. **This page is the shape.** The rules
are in [world-simulation.md](world-simulation.md); the inside of a town is [town-loop.md](town-loop.md).

---

## Two clocks, and only two

```
   EVERY DAY                            EVERY 90 DAYS  (a season)
   ─────────                            ─────────────────────────
   1  weather advances                  1  PRODUCE   each town, alone
   2  contact resolves  ──► a town      2  CLEAR     the market, all at once
   3  objects move                      3  SETTLE    each town, alone
   4  interception resolves             4  GOVERN    each town, alone
                                        5  RULE      the crowns
```

**The day is weather and things in transit. Nothing else.** On an ordinary day no object is built,
no roll is drawn and no ledger is touched — a place is sampled, found fair, and skipped.

**The season is the only beat on which a town acts.** One decision per town per season, never two.

---

## The season, in order — and the order is load-bearing

| | who acts | what happens |
|---|---|---|
| **1 PRODUCE** | each town alone | free works appear as the town grows · hands are assigned · unmanned works go idle |
| **2 CLEAR** | **the market** | every town's surplus meets every town's shortage **at once**. Prices settle. Who gets what is decided here. |
| **3 SETTLE** | each town alone | **buy food first, always** · bank the remainder · standing drifts · population drifts |
| **4 GOVERN** | each town alone | the town may claim one more patch of ground · the governor makes **one** decision · the season's books close |
| **5 RULE** | the crowns | **not built** |

**Step 2 is the only moment a place sees another place.** A town never queries a neighbour: it reads
the block the market handed it and acts alone. That isolation is deliberate and is what keeps the
world parallel and deterministic.

---

## What drives what

```
            TIME ──────────────── drives everything below ────────────────┐
                                                                          │
   MAP ──► distance ──► routes ──► ACCESS ─────────────────┐              │
                            ▲                              │              │
                            │ cut by                       ▼              ▼
   WEATHER ─┬──► spoils a harvest ────────────────────► THE LEDGER ──► NEEDS & TRADE
            ├──► breaks a building                          ▲            │
            └──► sends a repair bill                        │            │
                                                     what a town ◄───────┘
   FACTIONS ──► tax · grant · war · invade ──►            makes and eats   prices,
      (NOT BUILT)                                                          who gets what
```

**Access is the hinge.** It is a place's own quays and guns multiplied by the share of its sea lanes
still calling. **Cut it and the place is cut off both ways** — it cannot sell and it cannot buy.
Everything a raid or a blockade does, it does through this number.

---

## How big may a world be

**The sea's size and population are settings** — `generateWorld(seed, { widthNm, heightNm, isles, towns })`.
The default is the 1,500 × 800 nm sea of 50 ports that every measurement in this project is
calibrated against; **leave it alone unless you are re-calibrating everything.**

**Four physical facts bound what you may ask for.** They are not knobs, and a request that breaks one
is **refused at generation** rather than quietly producing a broken world.

| | | why it binds |
|---|---|---|
| a day's run | **144 nm** | 6 knots for 24 hours — everything below derives from it |
| a market reaches | **1,008 nm** | a week's run — far enough to cross a climate band, so partners grow what you do not |
| ports keep apart | **85 nm** | so a sea of W × H holds at most `W·H / (0.866 · 85²)` ports — 191 for the default, of which real coastline carries 50 |
| a crossing must fit | **9,216 nm** | the arrival ring is 64 days deep |

> **And there is a floor on usefulness, below the floor on legality. A sea narrower than about
> 1,000 nm is entirely inside one market** — every town is everyone's neighbour, no town is far from
> anything, and nothing can be cut off. **You are then watching a marketplace, not a sea.** The
> default sea is 1,500 × 800, so a third of its port pairs still have no trade between them, which is
> the point of a week rather than a fortnight.

---

## What is not built

- **The crowns do nothing.** Step 5 is empty, so nothing in the world has intent except a town's
  governor. **This is the gap between "a simulation" and "a world".**
- **Nobody takes the coin — but there is now cargo to take.** Every cleared trade sails: the market
  names who supplied whom, one hull per trading pair carries everything that pair moved, and **the
  buyer is credited only when it lands.** Roughly 300 sailings a season; the sea fills on the day the
  market clears and is empty again within the fortnight. **Interception is still deliberately empty**,
  so nothing can be robbed yet — but the thing to rob exists.
- **Damage has no degrees.** A building is whole or gone; nothing mends.
- **Nobody takes the coin.** No raids, no invasion fleets.

---

## Too complex for this page — each has its own document

| | where |
|---|---|
| the market clearing — how prices settle and who gets served | [world-simulation.md](world-simulation.md) §11 |
| weather — how a storm forms, travels and lands | [world-simulation.md](world-simulation.md) §7 |
| the crowns — budgets, wars, dispatches, taxes | [world-simulation.md](world-simulation.md) §8 |
| the map — coastlines, climate, where places are put | [world-simulation.md](world-simulation.md) §6 |
| **the inside of a town** | **[town-loop.md](town-loop.md)** |
