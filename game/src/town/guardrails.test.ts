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
//
// Factorio reached the same rule independently: it ships custom trigonometry
// "to ensure determinism across platforms", and a custom number formatter
// because %g prints 0.00001 differently on gcc than on MSVC.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

// Directories where EVERY file is simulation. Contents are discovered, not
// listed, so a new system cannot arrive unguarded.
const SIM_DIRS = ["overworld"];

// `src/town` is mixed — the ledger simulates, the plan draws. So it is listed
// rather than discovered, and the roster below must account for every file.
const TOWN_SIM = ["sim.ts", "works.ts", "governor.ts", "footprint.ts", "constants.ts", "types.ts", "land.ts"];
const TOWN_PRESENTATION = ["plan.ts", "planview.ts", "hexmap.ts", "main.ts"];

// `hex.ts` is mixed WITHIN ONE FILE, which is why it is on neither roster. The
// half the simulation reads — `southness`, `distance`, `toPixel`, `centroid`,
// `bearingOf` — is clean as of KAN-103. The other half is pen-and-ink
// (`corners`, `sharedEdge`) and uses trigonometry quite legitimately: nothing
// stored ever depends on it. If the simulation ever needs more of this file, the
// drawing helpers should move to their own module so the guard can cover it.
const HEX = "town/hex.ts";

// Known exceptions, each with a reason. This list must only ever SHRINK — the
// last test fails if a file here has become clean.
//
// NOTE ON REACH: the guard is source-level, not transitive. A file is guarded by
// its own text, so transitive contamination is tracked against the file that owns
// the offending call. A guard that chased imports would have to model the whole
// graph; naming the owner is enough to stop the list growing, which is the job.
//
// **The list is EMPTY, as of KAN-103.** Its one entry was `town/hex.ts`, for the
// `Math.hypot` that `bearingOf` used to normalise dot products by a constant that
// could not change which bearing wins. It bought nothing; it is gone, and with it
// the module's last cross-engine determinism hazard. Nothing goes back on this
// list without a decision.
const EXCEPTIONS: Record<string, string> = {};

// ECMA-262 §21.3.2: "The behaviour of the functions acos, acosh, asin, asinh,
// atan, atanh, atan2, cbrt, cos, cosh, exp, expm1, hypot, log, log1p, log2,
// log10, pow, random, sin, sinh, tan, and tanh is not precisely specified here."
const APPROXIMATED = [
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "exp", "expm1", "log", "log1p", "log2", "log10",
  "cbrt", "hypot", "pow", "random",
];

// Strip comments so a prose mention or a `/** */` block is not a violation.
const code = (rel: string): string =>
  readFileSync(join(SRC, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

function violations(rel: string): string[] {
  const src = code(rel);
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

const isSource = (f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts");

const discovered = SIM_DIRS.flatMap((dir) =>
  readdirSync(join(SRC, dir)).filter(isSource).map((f) => `${dir}/${f}`),
);
const guarded = [...discovered, ...TOWN_SIM.map((f) => `town/${f}`)].filter((f) => !(f in EXCEPTIONS));

describe("the simulation reads no clock and does no approximated maths", () => {
  for (const rel of guarded) {
    it(`${rel} stays bit-identical on every machine`, () => {
      expect(violations(rel)).toEqual([]);
    });
  }

  it("guards every file in a simulation directory, discovered rather than listed", () => {
    // The whole point of discovery: adding a file to src/overworld guards it
    // automatically. This asserts the discovery actually found something, so a
    // renamed directory fails loudly instead of guarding nothing in silence.
    expect(discovered.length).toBeGreaterThan(0);
    for (const rel of discovered) expect(rel).toMatch(/^overworld\/.+\.ts$/);
  });

  it("accounts for every file in the mixed town module", () => {
    const all = readdirSync(join(SRC, "town")).filter(isSource);
    const known = new Set([...TOWN_SIM, ...TOWN_PRESENTATION, "hex.ts", "fixtures.ts"]);
    for (const f of all) expect(known.has(f)).toBe(true);
  });
});

describe("the exception list only ever shrinks", () => {
  it("has nothing left on it, and nothing goes back on without a decision", () => {
    expect(Object.keys(EXCEPTIONS)).toEqual([]);
  });

  for (const [rel, why] of Object.entries(EXCEPTIONS)) {
    it(`${rel} is still excepted — ${why}`, () => {
      // When this fails, the file is clean: delete it from EXCEPTIONS. A
      // shrinking list is the point.
      expect(violations(rel).length).toBeGreaterThan(0);
    });
  }

  it("keeps the bearing a town's regions are read off free of approximated maths", () => {
    // The exception that went was `Math.hypot` in `bearingOf`, and `bearingOf`
    // writes into stored state through the land. `hex.ts` as a whole still draws
    // with trigonometry, so the file cannot be guarded wholesale — but the
    // function the simulation reads can be, and is.
    const src = code(HEX);
    const fn = src.slice(src.indexOf("export function bearingOf"));
    expect(fn.slice(0, fn.indexOf("\n}") + 2)).not.toMatch(/\bMath\.(hypot|pow|sin|cos|atan2|sqrt)\b/);
  });
});

// [HC-73]. The world holds a place's TRUE coastal bearing; a town's local views
// are DRAWN in a frame whose south is seaward. That split is the whole of what
// survived KAN-103, and it survives only while nothing in the simulation treats
// seaward-ness as a fact about the world.
describe("the sea lying south is a drawing convention, not a geographic claim", () => {
  // `land.ts` is the one exception and it is a dated one: it holds the temporary
  // provider that stands in for the world generator (KAN-98). When that dies,
  // this set is empty and no simulation file reads the seaward axis at all.
  const PROVISIONAL = ["land.ts"];

  for (const f of TOWN_SIM.filter((x) => !PROVISIONAL.includes(x))) {
    it(`${f} decides nothing by which way the sea lies`, () => {
      expect(code(`town/${f}`)).not.toMatch(/\bsouthness\b/);
    });
  }

  it("still has exactly one dated exception, which KAN-98 takes with it", () => {
    // Fails when `land.ts` stops rolling ground: shorten PROVISIONAL to nothing.
    for (const f of PROVISIONAL) expect(code(`town/${f}`)).toMatch(/\bsouthness\b/);
  });
});
