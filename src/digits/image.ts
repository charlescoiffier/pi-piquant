import { MAX_COUNT, type Traversal } from '../ui/state';
import { DIGITS_PER_BYTE, readByte, writeByte } from './bytecode';

const TRAVERSALS: Traversal[] = ['rows', 'serpentine', 'spiral', 'hilbert'];
const SIDE_DIGITS = 4; // largeur et hauteur chacune sur 4 chiffres
export const IMAGE_HEADER_DIGITS = 2 * SIDE_DIGITS + 1; // largeur, hauteur, parcours
const MAX_SIDE = 10 ** SIDE_DIGITS - 1;

/** Nombre maximal de pixels d'une image (3 chiffres par pixel, après l'en-tête). */
export const IMAGE_MAX_PIXELS = Math.floor((MAX_COUNT - IMAGE_HEADER_DIGITS) / DIGITS_PER_BYTE);

/** Dimensions réduites (proportions conservées) pour tenir dans IMAGE_MAX_PIXELS et MAX_SIDE. */
export function fitImageSize(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, Math.sqrt(IMAGE_MAX_PIXELS / (w * h)), MAX_SIDE / w, MAX_SIDE / h);
  let nw = Math.max(1, Math.floor(w * k));
  let nh = Math.max(1, Math.floor(h * k));
  while (nw * nh > IMAGE_MAX_PIXELS) { nw > nh ? nw-- : nh--; }
  return { w: nw, h: nh };
}

/**
 * Image → chiffres, sans perte (en niveaux de gris 8 bits).
 *   en-tête : largeur (4 chiffres), hauteur (4 chiffres), parcours (1 chiffre : 0 lignes,
 *             1 serpentin, 2 spirale, 3 Hilbert)
 *   puis, pour chaque pixel dans l'ordre du parcours : niveau de gris 0-255 → 3 chiffres (bytecode.ts)
 * Le gris est la luminance (Rec. 709) ; les pixels transparents sont composés sur du blanc.
 * Pas de conversion RGB : une seule valeur par pixel.
 */
export function imageDigits(rgba: Uint8ClampedArray, w: number, h: number, traversal: Traversal): Uint8Array {
  if (w < 1 || h < 1 || w > MAX_SIDE || h > MAX_SIDE || w * h > IMAGE_MAX_PIXELS) {
    throw new Error(`Image trop grande (${w}×${h}) : réduire à ${IMAGE_MAX_PIXELS} pixels au plus`);
  }
  const order = traversalOrder(w, h, traversal);
  const out = new Uint8Array(IMAGE_HEADER_DIGITS + order.length * DIGITS_PER_BYTE);
  writeNumber(out, 0, w, SIDE_DIGITS);
  writeNumber(out, SIDE_DIGITS, h, SIDE_DIGITS);
  out[2 * SIDE_DIGITS] = TRAVERSALS.indexOf(traversal);
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    const a = rgba[i * 4 + 3] / 255;
    const r = rgba[i * 4] * a + 255 * (1 - a);
    const g = rgba[i * 4 + 1] * a + 255 * (1 - a);
    const b = rgba[i * 4 + 2] * a + 255 * (1 - a);
    const gray = Math.min(255, Math.max(0, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
    writeByte(out, IMAGE_HEADER_DIGITS + k * DIGITS_PER_BYTE, gray);
  }
  return out;
}

/** Opération inverse : retrouve les dimensions et les niveaux de gris (en ordre ligne par ligne). */
export function decodeImage(digits: ArrayLike<number>): { w: number; h: number; gray: Uint8Array } {
  if (digits.length < IMAGE_HEADER_DIGITS) throw new Error('En-tête manquant');
  const w = readNumber(digits, 0, SIDE_DIGITS);
  const h = readNumber(digits, SIDE_DIGITS, SIDE_DIGITS);
  const traversal = TRAVERSALS[digits[2 * SIDE_DIGITS]];
  if (!traversal || w < 1 || h < 1) throw new Error('En-tête invalide');
  if (digits.length !== IMAGE_HEADER_DIGITS + w * h * DIGITS_PER_BYTE) throw new Error('Longueur de chiffres invalide');
  const order = traversalOrder(w, h, traversal);
  const gray = new Uint8Array(w * h);
  for (let k = 0; k < order.length; k++) {
    const b = readByte(digits, IMAGE_HEADER_DIGITS + k * DIGITS_PER_BYTE);
    if (b < 0) throw new Error(`Bloc invalide au pixel ${k}`);
    gray[order[k]] = b;
  }
  return { w, h, gray };
}

function writeNumber(out: Uint8Array, at: number, n: number, width: number) {
  for (let i = width - 1; i >= 0; i--) { out[at + i] = n % 10; n = Math.floor(n / 10); }
}
function readNumber(d: ArrayLike<number>, at: number, width: number) {
  let n = 0;
  for (let i = 0; i < width; i++) n = n * 10 + d[at + i];
  return n;
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
