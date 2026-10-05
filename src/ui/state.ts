export type Source = 'pi' | 'e' | 'phi' | 'sqrt2' | 'free' | 'text' | 'image';
export type Traversal = 'rows' | 'serpentine' | 'spiral' | 'hilbert';
export type Lang = 'fr' | 'en';

export interface Params {
  source: Source;
  count: number; // nombre de chiffres utilisés (décimales)
  segLen: number; // longueur d'un segment (unités de dessin)
  coef: number; // degrés par unité de chiffre
  firstDir: 1 | -1; // sens du premier angle (1 = horaire à l'écran)
  strokeWidth: number;
  stroke: string;
  bg: string;
  freeDigits: string;
  text: string;
  traversal: Traversal;
  showTitle: boolean; // titre à l'écran et dans les exports
  speed: number; // segments par seconde (animation)
  lang: Lang;
}

export const DEFAULTS: Params = {
  source: 'pi',
  count: 100,
  segLen: 10,
  coef: 10,
  firstDir: -1, // comme dans l'œuvre : le 2e segment s'écarte du 1er vers la droite
  strokeWidth: 0.5,
  stroke: '#111111',
  bg: '#ffffff',
  freeDigits: '1234567890',
  text: 'Morellet, fils monstrueux de Mondrian et Picabia, a développé depuis 1952 tout un programme de systèmes aussi rigoureux qu’absurdes, utilisant les figures les plus simples de la géométrie (droites, angles, plans…) avec les matériaux les plus divers (toiles, grillages, néons, acier, adhésifs, branches…) sur toutes sortes de supports (toiles, murs, statues, architectures, « paysages »…).',
  traversal: 'rows',
  showTitle: true,
  speed: 500,
  lang: 'fr',
};

export const MAX_COUNT = 100_000;

/** Seuls les nombres (π, e, φ, √2) ont un nombre de décimales à choisir ; chiffres libres, texte et image sont utilisés en entier. */
export const usesCount = (source: Source) => source === 'pi' || source === 'e' || source === 'phi' || source === 'sqrt2';

/** Vitesse d'animation (segments par seconde) et crans du curseur : suite 1-2-5, de 1 à 5000. */
export const MIN_SPEED = 1;
export const MAX_SPEED = 5000;
export const SPEED_STOPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/** Crans de la longueur de segment (1-100) et de l'épaisseur du trait (0,1-10), en suite 1-2-5. */
export const LENGTH_STOPS = [1, 2, 5, 10, 20, 50, 100];
export const WIDTH_STOPS = [0.1, 0.2, 0.5, 1, 2, 5, 10];

/** Paramètres sérialisables (tout sauf l'image, trop lourde pour une URL). */
export function encodeParams(p: Params): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/=+$/, '');
}

export function decodeParams(s: string): Params | null {
  try {
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    const obj = JSON.parse(decodeURIComponent(escape(atob(padded))));
    return sanitize(obj);
  } catch {
    return null;
  }
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  list.includes(v as T) ? (v as T) : d;
const color = (v: unknown, d: string) =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d;

export function sanitize(o: Partial<Params> | Record<string, unknown>): Params {
  const x = o as Record<string, unknown>;
  const d = DEFAULTS;
  return {
    source: oneOf(x.source, ['pi', 'e', 'phi', 'sqrt2', 'free', 'text', 'image'], d.source),
    count: Math.round(clamp(x.count, 1, MAX_COUNT, d.count)),
    segLen: clamp(x.segLen, 0.1, 1000, d.segLen),
    coef: clamp(x.coef, -360, 360, d.coef),
    firstDir: x.firstDir === 1 ? 1 : -1,
    strokeWidth: clamp(x.strokeWidth, 0.1, 50, d.strokeWidth),
    stroke: color(x.stroke, d.stroke),
    bg: color(x.bg, d.bg),
    freeDigits: typeof x.freeDigits === 'string' ? x.freeDigits.slice(0, MAX_COUNT) : d.freeDigits,
    text: typeof x.text === 'string' ? x.text.slice(0, 100_000) : d.text,
    traversal: oneOf(x.traversal, ['rows', 'serpentine', 'spiral', 'hilbert'], d.traversal),
    showTitle: x.showTitle !== false,
    speed: clamp(x.speed, MIN_SPEED, MAX_SPEED, d.speed),
    lang: oneOf(x.lang, ['fr', 'en'], d.lang),
  };
}
