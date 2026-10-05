import type { ImageMode, Traversal } from '../ui/state';

/** Nombre maximal de pixels analysés (≈ nombre maximal de chiffres). */
export const MAX_PIXELS = 100_000;

/**
 * Image → chiffres 0-9. Aucune conversion RGB directe : on travaille sur la
 * luminance (ou la teinte), puis on répartit en 10 classes.
 *  - quantile : 10 classes de même effectif (égalisation d'histogramme) → équilibré
 *  - fixed    : 10 paliers linéaires de luminance → fidèle, déséquilibré
 *  - hue      : 10 secteurs de teinte ; pixels achromatiques → classés par luminance
 */
export function imageDigits(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  mode: ImageMode,
  traversal: Traversal,
): Uint8Array {
  const n = w * h;
  const lum = new Float64Array(n);
  const hue = new Float64Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const r = rgba[i * 4] * a + 255 * (1 - a);
    const g = rgba[i * 4 + 1] * a + 255 * (1 - a);
    const b = rgba[i * 4 + 2] * a + 255 * (1 - a);
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (mode === 'hue') {
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const d = mx - mn;
      if (d > 20) {
        let hh: number;
        if (mx === r) hh = ((g - b) / d + 6) % 6;
        else if (mx === g) hh = (b - r) / d + 2;
        else hh = (r - g) / d + 4;
        hue[i] = hh * 60;
      }
    }
  }

  const px = new Uint8Array(n);
  if (mode === 'fixed') {
    for (let i = 0; i < n; i++) px[i] = Math.min(9, Math.floor(lum[i] / 25.6));
  } else if (mode === 'quantile') {
    quantize(lum, px, allIdx(n));
  } else {
    const chroma: number[] = [];
    const gray: number[] = [];
    for (let i = 0; i < n; i++) (hue[i] >= 0 ? chroma : gray).push(i);
    for (const i of chroma) px[i] = Math.min(9, Math.floor(hue[i] / 36));
    quantize(lum, px, gray);
  }

  const order = traversalOrder(w, h, traversal);
  const out = new Uint8Array(order.length);
  for (let k = 0; k < order.length; k++) out[k] = px[order[k]];
  return out;
}

const allIdx = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Classe les indices par valeur (ex æquo départagés par position) en 10 groupes égaux. */
function quantize(values: Float64Array, out: Uint8Array, idx: number[]) {
  const sorted = idx.slice().sort((a, b) => values[a] - values[b] || a - b);
  const m = sorted.length;
  for (let r = 0; r < m; r++) out[sorted[r]] = Math.min(9, Math.floor((r * 10) / m));
}

/** Liste des indices de pixels (y*w+x) dans l'ordre de parcours. */
export function traversalOrder(w: number, h: number, t: Traversal): number[] {
  const out: number[] = [];
  if (t === 'rows') {
    for (let i = 0; i < w * h; i++) out.push(i);
  } else if (t === 'serpentine') {
    for (let y = 0; y < h; y++)
      for (let k = 0; k < w; k++) out.push(y * w + (y % 2 === 0 ? k : w - 1 - k));
  } else if (t === 'spiral') {
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    while (top <= bottom && left <= right) {
      for (let x = left; x <= right; x++) out.push(top * w + x);
      for (let y = top + 1; y <= bottom; y++) out.push(y * w + right);
      if (top < bottom) for (let x = right - 1; x >= left; x--) out.push(bottom * w + x);
      if (left < right) for (let y = bottom - 1; y > top; y--) out.push(y * w + left);
      top++; bottom--; left++; right--;
    }
  } else {
    let side = 1;
    while (side < Math.max(w, h)) side *= 2;
    for (let d = 0; d < side * side; d++) {
      const [x, y] = hilbertD2xy(side, d);
      if (x < w && y < h) out.push(y * w + x);
    }
  }
  return out;
}

function hilbertD2xy(n: number, d: number): [number, number] {
  let x = 0, y = 0, t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2);
    const ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}
