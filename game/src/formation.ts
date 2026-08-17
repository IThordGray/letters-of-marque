import { FORMATION } from "./constants";

const GOLDEN = 137.508 * (Math.PI / 180); // golden angle, radians

// N slots evenly filling a wide ellipse centred on (cx, cy), via a sunflower
// (phyllotaxis) distribution scaled to the ellipse. `spacing` is roughly the gap
// between neighbours; the ellipse is FORMATION.aspect times wider than it is deep.
// Deterministic, and always returns exactly N slots.
export function formationSlots(n: number, cx: number, cy: number, spacing: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];
  const base = spacing * Math.sqrt(n / Math.PI); // gives area ≈ n · spacing²
  const rx = base * Math.sqrt(FORMATION.aspect);
  const ry = base / Math.sqrt(FORMATION.aspect);
  const slots: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n);
    const t = i * GOLDEN;
    slots.push({ x: cx + r * Math.cos(t) * rx, y: cy + r * Math.sin(t) * ry });
  }
  return slots;
}
