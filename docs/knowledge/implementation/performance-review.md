# Performance review

**Read:** now and then — before a performance change, or when a run feels slow. Not on every task.
Update the baseline in place when you re-measure; no history.

## Baseline (Node 24 / V8 13.6, dev machine)

| | |
|---|---|
| One town, 200 years, ledger only | 5.6 ms |
| One town, 200 years, with the governor | 40.7 ms |
| 50 towns × 200 years (projected) | ~2.0 s |
| One auction (`wants()`) | 16.75 µs |
| Modelled daily tick, 73,000 days × 50 places | 11 ms |
| Warm start (`warmStart`) | ~810 ms |
| Headless century, world view | ~1.0 s |

**Reading:** tick mechanics are nearly free; the governor costs ~7× the ledger it advises. Cost is
work that did not need to happen, not loop shape or layout.

## Known candidates — check before starting one

- **The auction re-derives the taken-hex set per work kind** (`takenHexes` via `roomFor` /
  `groundFor` / `whereFor`). Partly hoisted since (default `taken` parameters in `governor.ts`) —
  measure whether it still shows in a profile before touching it. `[P-18]`.

## Method

- `[P-39]` Before/after on the **full run**, never a microbenchmark alone.
- `[P-40]` Trusted only with: warm-up · ≥ 7 runs, report the minimum · one variant per process ·
  inputs varied per pass · result consumed by a printed sink · sanity check against a hardware floor.
- `[P-41]` Prefer an assertion to a timing: `--allow-natives-syntax` (`%HasFastProperties`,
  `%HasHoleyElements`, `%HaveSameMap`, `%GetOptimizationStatus`), `--trace-deopt`.
- `[P-42]` Profile the whole tick with `node --cpu-prof`; optimise only what it names.
- `[P-43]` Profile allocation rate alongside elapsed time.
- Test timeouts are hang detectors, never a performance gate.

## Sources

Acton (CppCon 2014) · Kelley, *Practical Data-Oriented Design* · Barker, *Intro to DOD for Games* ·
Factorio FFF-148 / 204 / 421 · Fiedler, *Floating Point Determinism* · ECMA-262 §21.3.2 ·
v8.dev (elements kinds, fast properties, Orinoco) · Egorov, *microbenchmarks are experiments* ·
Varghese & Lauck, *timing wheels*.
