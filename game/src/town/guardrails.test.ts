// Determinism guardrails — enforced by reading the source, not by remembering.
//
// [HC-11] requires the same seed to give the same two hundred years, at any speed,
// on any machine. implementation/performance.md §1 lists what makes that true;
// [P-44] says those rules are enforced by a test rather than by vigilance.
//
// This scans simulation source for the calls that would silently break it. The
// banned Math functions are "implementation-approximated" in ECMA-262 §21.3.2 —
// engines are PERMITTED to differ and do. V8 changed Math.tanh in Chrome 148 to
// defer to the host libm, so the same call now returns different values on
// Windows, macOS and Linux. A save file would diverge on a Node upgrade.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HERE = join(process.cwd(), "src", "town");

// Files that ARE the simulation: pure systems over the town struct, whose output
// must be bit-identical everywhere. Add a file here the moment it becomes one.
//
// NOTE ON REACH: this guard is SOURCE-LEVEL, not transitive. `land.ts` is listed
// here and is clean by its own text, but it calls `bearingOf` in `hex.ts`, which
// is not. Transitive contamination is tracked against the file that owns the
// offending call — see EXCEPTIONS below. A guard that chased imports would have
// to model the whole graph; a guard that names the owner is enough to stop the
// list growing, which is what it is for.
const GUARDED = ["sim.ts", "works.ts", "governor.ts", "footprint.ts", "constants.ts", "types.ts", "land.ts"];

// Files deliberately NOT guarded, and why. Presentation may use whatever maths it
// likes — a pixel is not simulation state.
const PRESENTATION = ["plan.ts", "planview.ts", "hexmap.ts", "main.ts"];

// Known exceptions, each with a reason and an owner. This list must only ever
// shrink. See the test at the bottom, which fails if a file is cleaned but not
// promoted into GUARDED.
const EXCEPTIONS: Record<string, string> = {
  // bearingOf() calls Math.hypot twice per iteration to normalise dot products by
  // a constant that cannot change which bearing wins — a banned function doing
  // nothing. Goes with the land rework ([HC-19], [HC-73]); the replacement must
  // not reintroduce it.
  "hex.ts": "Math.hypot in bearingOf — pointless normalisation, dies with the land rework",
};

// ECMA-262 §21.3.2: "The behaviour of the functions acos, acosh, asin, asinh,
// atan, atanh, atan2, cbrt, cos, cosh, exp, expm1, hypot, log, log1p, log2,
// log10, pow, random, sin, sinh, tan, and tanh is not precisely specified here."
const APPROXIMATED = [
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "exp", "expm1", "log", "log1p", "log2", "log10",
  "cbrt", "hypot", "pow", "random",
];

// Strip comments so a `/** ... */` block or a prose mention is not a violation.
function code(file: string): string {
  const raw = readFileSync(join(HERE, file), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function violations(file: string): string[] {
  const src = code(file);
  const found: string[] = [];

  for (const fn of APPROXIMATED) {
    if (new RegExp(`\\bMath\\.${fn}\\b`).test(src)) found.push(`Math.${fn}`);
  }
  // Number::exponentiate is implementation-approximated too. Write x * x.
  if (/[^*/\s][ \t]*\*\*[ \t]*[^*/]/.test(src)) found.push("** operator");
  if (/\bDate\.now\b/.test(src)) found.push("Date.now");
  if (/\bperformance\.now\b/.test(src)) found.push("performance.now");

  return found;
}

describe("the simulation reads no clock and does no approximated maths", () => {
  for (const file of GUARDED) {
    it(`${file} stays bit-identical on every machine`, () => {
      expect(violations(file)).toEqual([]);
    });
  }

  it("names every file it is guarding, so a new system cannot slip in unguarded", () => {
    // If a simulation file is added and not listed, this is where it is noticed.
    const known = new Set([...GUARDED, ...PRESENTATION, ...Object.keys(EXCEPTIONS), "hex.ts"]);
    const all = ["sim.ts", "works.ts", "governor.ts", "footprint.ts", "constants.ts",
      "types.ts", "land.ts", "hex.ts", "hexmap.ts", "plan.ts", "planview.ts", "main.ts"];
    for (const f of all) expect(known.has(f)).toBe(true);
  });
});

describe("the exception list only ever shrinks", () => {
  for (const [file, why] of Object.entries(EXCEPTIONS)) {
    it(`${file} is still excepted — ${why}`, () => {
      // When this fails, the file is clean: delete it from EXCEPTIONS and add it
      // to GUARDED. A shrinking list is the point.
      expect(violations(file).length).toBeGreaterThan(0);
    });
  }
});
