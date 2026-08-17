// Small angle/vector helpers. Degrees everywhere. y is down. Units are paces.

export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Shortest signed difference b - a, wrapped to (-180, 180].
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function normalizeAngle(a: number): number {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax) / DEG;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

// Turn `heading` toward `target` by at most `maxStep` degrees.
export function turnToward(heading: number, target: number, maxStep: number): number {
  const d = angleDiff(heading, target);
  if (Math.abs(d) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(heading + Math.sign(d) * maxStep);
}

export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function randInt(lo: number, hi: number): number {
  return Math.floor(randRange(lo, hi + 1));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
