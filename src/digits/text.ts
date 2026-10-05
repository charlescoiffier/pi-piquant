import { DIGITS_PER_BYTE, readByte, writeByte } from './bytecode';
import { MAX_COUNT } from '../ui/state';

/** Nombre maximal d'octets UTF-8 d'un texte (chaque octet donne 3 chiffres). */
export const TEXT_MAX_BYTES = Math.floor(MAX_COUNT / DIGITS_PER_BYTE);

const encoder = new TextEncoder();

/** Taille du texte en octets UTF-8. */
export const textBytes = (text: string) => encoder.encode(text).length;

/**
 * Texte → chiffres, sans perte : le texte est codé en UTF-8 (tout caractère, tout alphabet,
 * emojis compris) et chaque octet devient 3 chiffres (voir bytecode.ts).
 * Au-delà de TEXT_MAX_BYTES, le texte est coupé à une frontière de caractère (jamais au milieu).
 */
export function textDigits(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const b = encoder.encode(ch);
    if (bytes.length + b.length > TEXT_MAX_BYTES) break;
    for (const x of b) bytes.push(x);
  }
  const out = new Uint8Array(bytes.length * DIGITS_PER_BYTE);
  bytes.forEach((b, i) => writeByte(out, i * DIGITS_PER_BYTE, b));
  return out;
}

/** Opération inverse : retrouve le texte à partir des chiffres (lève une erreur si invalides). */
export function decodeText(digits: ArrayLike<number>): string {
  if (digits.length % DIGITS_PER_BYTE !== 0) throw new Error('Longueur de chiffres invalide');
  const bytes = new Uint8Array(digits.length / DIGITS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const b = readByte(digits, i * DIGITS_PER_BYTE);
    if (b < 0) throw new Error(`Bloc invalide à la position ${i * DIGITS_PER_BYTE}`);
    bytes[i] = b;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
