/** Rectangle dans le repère du dessin. */
export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Droite infinie passant par (px, py) et dirigée par (dx, dy), découpée par un rectangle
 * (méthode de Liang-Barsky) : renvoie [x1, y1, x2, y2], ou null si elle ne le traverse pas.
 */
export function clipLine(px: number, py: number, dx: number, dy: number, r: Rect): [number, number, number, number] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const clip = (p: number, d: number, lo: number, hi: number): boolean => {
    if (d === 0) return p >= lo && p <= hi; // parallèle à ce bord : entièrement dedans ou dehors
    let a = (lo - p) / d;
    let b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    return t0 <= t1;
  };
  if (!clip(px, dx, r.minX, r.maxX) || !clip(py, dy, r.minY, r.maxY)) return null;
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null; // direction nulle
  return [px + t0 * dx, py + t0 * dy, px + t1 * dx, py + t1 * dy];
}

/**
 * Prolongements des `count` premiers segments du tracé (points = x,y,x,y,…) : chaque segment est
 * prolongé en droite, puis découpé par `rect`. Renvoie x1,y1,x2,y2 pour chaque droite visible.
 */
export function extendedLines(points: Float64Array, count: number, rect: Rect): Float64Array {
  const n = Math.max(0, Math.min(Math.floor(count), points.length / 2 - 1));
  const out = new Float64Array(n * 4);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    const c = clipLine(x, y, points[i * 2 + 2] - x, points[i * 2 + 3] - y, rect);
    if (!c) continue;
    out[k++] = c[0];
    out[k++] = c[1];
    out[k++] = c[2];
    out[k++] = c[3];
  }
  return out.subarray(0, k);
}
