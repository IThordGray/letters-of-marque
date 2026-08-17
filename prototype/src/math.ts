// Small angle/vector helpers. Degrees everywhere. y is down.

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

// Direction in degrees from point (ax,ay) to (bx,by).
export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax) / DEG;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

// Turn `heading` toward `target` by at most `maxStep` degrees.
export function turnToward(heading: number, target: number, maxStep: number): number {
  const d = angleDiff(heading, target);
  if (Math.abs(d) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(heading + Math.sign(d) * maxStep);
}

// Sample a piecewise-linear curve given as sorted [x, y] control points.
export function sampleCurve(points: Array<[number, number]>, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      const t = (x - x0) / (x1 - x0);
      return lerp(y0, y1, t);
    }
  }
  return last[1];
}

// Unit vector components for a heading in degrees.
export function dir(deg: number): { x: number; y: number } {
  return { x: Math.cos(deg * DEG), y: Math.sin(deg * DEG) };
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
