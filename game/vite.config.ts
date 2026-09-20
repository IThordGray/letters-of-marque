import { defineConfig } from "vite";

// Three entry points: the land raid (index.html), the standalone town module
// (town.html), and the world map view (world.html). The town module is
// deliberately NOT wired into the raid — it is its own startup file until the
// placement pass proves the plan is placeable — and the world view is its own
// again, because [HC-21] keeps the step-buttons in the single-town harness and
// gives the world sim the running clock. Neither page knows the other exists.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: "index.html", town: "town.html", world: "world.html" },
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
  //
  // RAISED 30 s -> 120 s on 2026-09-20, and the reason is worth keeping because
  // it will happen again. `run.test.ts`'s "a century watched at any speed is the
  // same century" runs THREE centuries — a day at a time, in 173-day chunks, and
  // all at once — and compares them. That is [HC-11], and it is honestly slow
  // rather than wasteful. It measured 35 s the day the region focus landed and
  // went red at random; it was 30-odd before.
  //
  // THE PATTERN TO EXPECT: this test costs whatever a century costs, so it grows
  // every time the world learns to do something. It is the suite's long pole and
  // it will keep lengthening. When it next crosses the line, raise this again —
  // do NOT shorten the century, because the misaligned chunking across many
  // season boundaries is the whole of what the claim is testing.
  test: {
    testTimeout: 120_000,
  },
});
