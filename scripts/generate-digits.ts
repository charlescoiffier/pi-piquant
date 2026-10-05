/**
 * Génère src/data/digits.json : les 100 000 premiers chiffres de π, e, φ et √2
 * (le chiffre entier initial compris : "3141…", "2718…", "1618…", "1414…").
 * Usage : npm run generate:digits   (ajouter --verify pour recouper π avec pi.delivery)
 */
import { writeFileSync } from 'node:fs';
import { eDigits, phiDigits, piLocalDigits, sqrt2Digits } from '../src/digits/constants';

const N = 100_000;
const s = (d: Uint8Array) => Array.from(d).join('');

const out = {
  count: N,
  pi: s(piLocalDigits(N)),
  e: s(eDigits(N)),
  phi: s(phiDigits(N)),
  sqrt2: s(sqrt2Digits(N)),
};

if (process.argv.includes('--verify')) {
  for (const start of [0, 1000, 50_000, 99_000]) {
    const r = await fetch(`https://api.pi.delivery/v1/pi?start=${start}&numberOfDigits=1000`);
    const { content } = (await r.json()) as { content: string };
    if (content !== out.pi.slice(start, start + 1000)) throw new Error(`π diffère de pi.delivery à ${start}`);
    console.log(`π OK vs pi.delivery @${start}`);
  }
}

writeFileSync(new URL('../src/data/digits.json', import.meta.url), JSON.stringify(out));
console.log('digits.json écrit', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 12) : v])));
