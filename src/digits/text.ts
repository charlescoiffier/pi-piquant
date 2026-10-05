import type { TextMode } from '../ui/state';

/**
 * Texte → chiffres.
 * - hash    : SHA-256 en mode compteur + échantillonnage par rejet → distribution quasi parfaite.
 * - alpha   : a=1…z=26 modulo 10 (accents retirés, le reste ignoré) → fidèle mais biaisé.
 * - unicode : points de code écrits en base 10 → fidèle, biais léger.
 */
export async function textDigits(text: string, mode: TextMode, count: number): Promise<Uint8Array> {
  if (mode === 'hash') return hashDigits(text, count);
  const out: number[] = [];
  if (mode === 'alpha') {
    const clean = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const ch of clean) {
      const c = ch.charCodeAt(0);
      if (c >= 97 && c <= 122) out.push((c - 96) % 10);
      if (out.length >= count) break;
    }
  } else {
    for (const ch of text) {
      for (const d of String(ch.codePointAt(0))) out.push(d.charCodeAt(0) - 48);
      if (out.length >= count) break;
    }
  }
  return Uint8Array.from(out.slice(0, count));
}

async function hashDigits(text: string, count: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const base = enc.encode(text);
  const out = new Uint8Array(count);
  let n = 0;
  for (let counter = 0; n < count; counter++) {
    const buf = new Uint8Array(base.length + 4);
    buf.set(base);
    new DataView(buf.buffer).setUint32(base.length, counter);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    for (let i = 0; i < h.length && n < count; i++) {
      if (h[i] < 250) out[n++] = h[i] % 10; // rejet de 250-255 : pas de biais modulo
    }
  }
  return out;
}
