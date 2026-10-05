/** Décimales de constantes calculées en local avec des BigInt (précision entière). */

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(1) << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

const GUARD = 10;

/** Chiffres "1414213562…" (entier compris) de √2. */
export function sqrt2Digits(count: number): Uint8Array {
  const p = count + GUARD;
  const v = isqrt(2n * 10n ** BigInt(2 * p));
  return toDigits(v.toString(), count);
}

/** Chiffres "1618033988…" de φ = (1+√5)/2. */
export function phiDigits(count: number): Uint8Array {
  const p = count + GUARD;
  const s5 = isqrt(5n * 10n ** BigInt(2 * p));
  const v = (10n ** BigInt(p) + s5) / 2n;
  return toDigits(v.toString(), count);
}

/** Chiffres "2718281828…" de e, par série de Taylor en virgule fixe. */
export function eDigits(count: number): Uint8Array {
  const p = count + GUARD;
  const scale = 10n ** BigInt(p);
  let term = scale;
  let sum = scale;
  for (let k = 1n; term > 0n; k++) {
    term /= k;
    sum += term;
  }
  return toDigits(sum.toString(), count);
}

function toDigits(s: string, count: number): Uint8Array {
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = s.charCodeAt(i) - 48;
  return out;
}

/** arctan(1/x) en virgule fixe (échelle `scale`). */
function arctanInv(x: bigint, scale: bigint): bigint {
  const x2 = x * x;
  let term = scale / x;
  let sum = term;
  for (let k = 3n, sign = -1n; term > 0n; k += 2n, sign = -sign) {
    term /= x2;
    sum += sign * (term / k);
  }
  return sum;
}

/** Chiffres "3141592653…" de π (formule de Machin). */
export function piLocalDigits(count: number): Uint8Array {
  const p = count + GUARD;
  const scale = 10n ** BigInt(p);
  const pi = 16n * arctanInv(5n, scale) - 4n * arctanInv(239n, scale);
  return toDigits(pi.toString(), count);
}
