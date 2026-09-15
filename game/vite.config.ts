import { defineConfig } from "vite";

// Two entry points: the land raid (index.html) and the standalone town module
// (town.html). The town module is deliberately NOT wired into the raid — it is
// its own startup file until the placement pass proves the plan is placeable.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: "index.html", town: "town.html" },
    },
  },

  // ---- The test runner ------------------------------------------------------
  //
  // A TEST TIMEOUT IS A HANG DETECTOR, NOT A PERFORMANCE BUDGET. Vitest's default
  // is 5 s, and the suite had been running on it by accident rather than by
  // choice — nothing here configured the runner at all until 2026-09-15.
  //
  // That default was quietly wrong for this suite. Several claims generate whole
  // worlds, and a world is a height field of thirty-odd lobes under two fbm
  // stacks; a claim that samples several seeds legitimately takes seconds. Run
  // alone they pass in about five; run across twenty-one parallel workers on a
  // machine that is also doing something else they take eleven, and the suite
  // goes red for a reason that has nothing to do with the code. Observed: seven
  // failures on one run of an unchanged tree, one on the next, none serially.
  //
  // A suite that fails at random is a suite people stop reading, which costs far
  // more than the minute it saves. And note what the default was actually doing:
  // acting as a SECOND, implicit, machine-dependent performance gate beside the
  // explicit [P-39] measurements the project already takes deliberately. That is
  // the [P-47] mistake — a quantity with two sources, one of them unstated —
  // and this one varies with what else the box happens to be running.
  //
  // So: performance is policed by measurement, in the tests written to measure
  // it. This number only has to be long enough that a HANG is still obvious.
  test: {
    testTimeout: 30_000,
  },
});
