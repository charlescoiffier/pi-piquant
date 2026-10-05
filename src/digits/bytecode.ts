/**
 * Un octet (0-255) ⇄ un bloc de 3 chiffres décimaux.
 *
 *   bloc = (octet × 79 + 217) mod 1000          (écrit sur 3 chiffres, ex. 042)
 *   octet = ((bloc − 217) × 79⁻¹) mod 1000      (valide s'il est < 256)
 *
 * 79 est premier avec 1000 : la formule est une permutation de 0..999, donc réversible.
 * Écrire l'octet tel quel (097 pour « a ») serait réversible mais très déséquilibré
 * (les premiers chiffres seraient presque toujours 0, 1 ou 2) ; le mélange répartit les
 * chiffres 0-9 de façon quasi uniforme, pour du texte comme pour des niveaux de gris.
 * Les constantes (79, 217) ont été choisies par recherche exhaustive : équilibre maximal sur tous
 * les octets, l'ASCII, les accents et les images sombres/claires, puis sur un texte français
 * (écart max. 1,2 point à 10 %), vérifié sur un texte anglais écarté de la recherche (1,8 point).
 */
const K = 79;
const OFFSET = 217;

const K_INV = (() => {
  for (let i = 1; i < 1000; i++) if ((i * K) % 1000 === 1) return i;
  throw new Error('79 doit être inversible modulo 1000');
})();

export const DIGITS_PER_BYTE = 3;

/** Écrit l'octet `b` (0-255) dans `out` à partir de `at` : 3 chiffres. */
export function writeByte(out: Uint8Array, at: number, b: number) {
  const v = (b * K + OFFSET) % 1000;
  out[at] = Math.floor(v / 100);
  out[at + 1] = Math.floor(v / 10) % 10;
  out[at + 2] = v % 10;
}

/** Relit l'octet codé en `digits[at..at+2]`, ou -1 si le bloc ne correspond à aucun octet. */
export function readByte(digits: ArrayLike<number>, at: number): number {
  const v = digits[at] * 100 + digits[at + 1] * 10 + digits[at + 2];
  const b = (((v - OFFSET + 1000) % 1000) * K_INV) % 1000;
  return b < 256 ? b : -1;
}
