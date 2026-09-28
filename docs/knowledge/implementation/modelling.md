# Modelling rules

**Scope:** sim numbers — economy, scales, rates, statistics · **Read by:** anyone shaping or changing
a sim quantity, and any builder whose brief touches one · **Authority:** human edits win.

- `[P-52]` Print the median of any clamped quantity when you write it. At the clamp (or at zero) is a
  bug. Before dividing by a constant, measure what you divide — against the data, not a table.
- `[P-53]` Only one normaliser per underlying fact. A share (own total) prices interruption; a count
  against a constant prices endowment — usually already priced elsewhere.
- `[P-55]` Report a median split by the most consequential have / have-not. "The median town earns
  X" must name the split it survived.
- `[P-56]` Before changing a free input, measure its share of the total. Measure it in isolation from
  anything else in the same commit.
- `[P-57]` Income proportional to something it buys is a feedback loop: bound it asymptotically,
  `x · t / (t + k)`. If saturation comes from self-selection, use a reading with no ceiling.
- `[P-58]` Never size anything against a residual (spare hands, headroom, free ground). Size against
  what the world demonstrably staffs.
- A rate applied to a stock compounds. Any per-tick cost as a share of an accumulating quantity is a
  growth ceiling in disguise.
- Ask what unit a number was written in and what unit its caller reads it in (per event vs per day).
- A constants table is not tuned until something consumes it end to end.
- Check a proposed fix's sign at both ends of its range. Buying headroom at the bad end by spending
  it at the good end is a net loss.
- When a change alters what a quantity is made of, keep the world aggregate roughly where it was and
  report the residual.
- Report the criterion that fails; never tune until it passes.
