/** Décimales embarquées (100 000 premiers chiffres de π, e, φ, √2), chargées à la demande. */
export type NumberKey = 'pi' | 'e' | 'phi' | 'sqrt2';

interface Table {
  count: number;
  pi: string;
  e: string;
  phi: string;
  sqrt2: string;
}

let table: Promise<Table | null> | undefined;

const load = () => (table ??= import('../data/digits.json').then((m) => m.default as Table).catch(() => null));

/** Renvoie null si le fichier est indisponible ou trop court : l'appelant se rabat sur l'API / le calcul local. */
export async function embeddedDigits(key: NumberKey, count: number): Promise<Uint8Array | null> {
  const t = await load();
  if (!t || count > t[key].length) return null;
  const s = t[key];
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = s.charCodeAt(i) - 48;
  return out;
}
