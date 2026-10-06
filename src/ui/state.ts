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
  extend: boolean; // prolongements des segments en fines droites
  extendIntensity: number; // 5-100 % : mélange du trait avec le fond
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
  extend: false,
  extendIntensity: 30,
  stroke: '#111111',
  bg: '#ffffff',
  freeDigits: '1234567890',
  text: 'Morellet, fils monstrueux de Mondrian et Picabia, a développé depuis 1952 tout un programme de systèmes aussi rigoureux qu’absurdes, utilisant les figures les plus simples de la géométrie (droites, angles, plans…) avec les matériaux les plus divers (toiles, grillages, néons, acier, adhésifs, branches…) sur toutes sortes de supports (toiles, murs, statues, architectures, « paysages »…)',
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
/** Crans du nombre de décimales (1 à 100 000), en suite 1-2-5. */
export const COUNT_STOPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** Prolongements : nombre maximal de segments prolongés, et crans de l'intensité (en %). */
export const EXTEND_MAX_SEGMENTS = 5000;
export const INTENSITY_STOPS = [5, 10, 20, 30, 50, 70, 100];

/** Export vidéo : durée du tracé en secondes (crans) et valeur par défaut. */
export const VIDEO_DURATION_STOPS = [3, 5, 10, 20, 30, 60];
export const DEFAULT_VIDEO_DURATION = 10;

export const LENGTH_STOPS = [1, 2, 5, 10, 20, 50, 100];
export const WIDTH_STOPS = [0.1, 0.2, 0.5, 1, 2, 5, 10];

// --- lien de partage ------------------------------------------------------
// Format lisible, noms en français : #source=pi&decimales=100&angle=10&sens=horaire
// Les réglages du dessin sont tous écrits, valeurs par défaut comprises ; ni animation, ni langue, ni titre.

const SOURCE_NAMES: Record<Source, string> = {
  pi: 'pi', e: 'e', phi: 'phi', sqrt2: 'racine2', free: 'chiffres', text: 'texte', image: 'image',
};
const TRAVERSAL_NAMES: Record<Traversal, string> = {
  rows: 'lignes', serpentine: 'serpentin', spiral: 'spirale', hilbert: 'hilbert',
};
const invert = <T extends string>(m: Record<T, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, T>;
const SOURCE_BY_NAME = invert(SOURCE_NAMES);
const TRAVERSAL_BY_NAME = invert(TRAVERSAL_NAMES);

/** Mélange le trait et le fond : pct % de trait, le reste de fond (couleurs « #rrggbb »). */
export function mixColor(bg: string, stroke: string, pct: number): string {
  const a = Math.min(100, Math.max(0, pct)) / 100;
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(bg, i) * (1 - a) + ch(stroke, i) * a).toString(16).padStart(2, '0')).join('');
}

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const hex = (c: string) => c.replace('#', '').toLowerCase();

/**
 * Paramètres → fragment d'adresse (sans le « # »). Le lien décrit le dessin : source, décimales (nombres),
 * longueur du segment, angle unitaire, sens du premier angle, couleurs du trait et du fond, épaisseur,
 * prolongements (et leur intensité, s'ils sont activés), plus
 * ce qui est propre à la source (chiffres, texte, parcours de l'image) en fin de lien. Valeurs par défaut
 * comprises : le lien reste exact même si les valeurs par défaut changent un jour.
 * Hors lien : l'animation (vitesse) et les préférences d'affichage personnelles (langue, titre), de même que l'image.
 */
export function encodeParams(p: Params): string {
  const parts: [string, string][] = [['source', SOURCE_NAMES[p.source]]];
  if (usesCount(p.source)) parts.push(['decimales', String(p.count)]);
  parts.push(
    ['segment', num(p.segLen)],
    ['angle', num(p.coef)],
    ['sens', p.firstDir === 1 ? 'horaire' : 'anti-horaire'],
    ['trait', hex(p.stroke)],
    ['fond', hex(p.bg)],
    ['epaisseur', num(p.strokeWidth)],
    ['prolongements', p.extend ? 'oui' : 'non'],
  );
  if (p.extend) parts.push(['intensite', String(p.extendIntensity)]);
  if (p.source === 'free') parts.push(['chiffres', p.freeDigits]);
  if (p.source === 'text') parts.push(['texte', p.text]);
  if (p.source === 'image') parts.push(['parcours', TRAVERSAL_NAMES[p.traversal]]);
  return parts.map(([k, v]) => `${k}=${readableEscape(v)}`).join('&');
}

/**
 * Applique un lien sans toucher aux réglages qui n'en font pas partie : vitesse d'animation, langue et titre
 * restent ceux de l'utilisateur (un lien collé ne doit pas, par exemple, repasser l'interface en français).
 */
export function withPersonalSettings(link: Params, current: Params): Params {
  return { ...link, speed: current.speed, lang: current.lang, showTitle: current.showTitle };
}

/**
 * encodeURIComponent, mais les lettres accentuées, guillemets, emojis… restent lisibles dans le lien
 * (les navigateurs les acceptent), de même que , ; : / ? @. Espaces, « & », « = », « # », « % » et caractères de contrôle restent encodés,
 * ainsi que les espaces insécables et caractères invisibles, qu'on ne saurait pas distinguer à l'œil.
 */
function readableEscape(v: string): string {
  return encodeURIComponent(v)
    .replace(/%(2C|3B|3A|2F|3F|40)/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) // , ; : / ? @ sans danger dans un fragment
    .replace(/(?:%[89A-F][0-9A-F])+/g, (run) => {
    const text = decodeURIComponent(run);
    return /[\s\u200b-\u200f\u2028\u2029\u2060\ufeff]/.test(text) ? run : text;
  });
}

/**
 * Fragment d'adresse (sans le « # ») → paramètres, ou null si aucun réglage n'est reconnu
 * (l'application s'ouvre alors avec ses valeurs aléatoires). Clés inconnues ignorées ;
 * valeurs invalides ramenées aux valeurs par défaut ou aux bornes par `sanitize`.
 */
export function decodeParams(s: string): Params | null {
  const raw: Record<string, unknown> = {};
  let known = false;
  for (const pair of s.split('&')) {
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    const key = pair.slice(0, i);
    let val = pair.slice(i + 1);
    try { val = decodeURIComponent(val); } catch { /* « % » isolé saisi à la main : valeur conservée telle quelle */ }
    const number = () => Number(val.replace(',', '.'));
    switch (key) {
      case 'source': raw.source = SOURCE_BY_NAME[val]; break;
      case 'decimales': raw.count = number(); break;
      case 'angle': raw.coef = number(); break;
      case 'chiffres': raw.freeDigits = val; break;
      case 'texte': raw.text = val; break;
      case 'parcours': raw.traversal = TRAVERSAL_BY_NAME[val]; break;
      case 'segment': raw.segLen = number(); break;
      case 'sens': raw.firstDir = val === 'horaire' ? 1 : val === 'anti-horaire' || val === 'antihoraire' ? -1 : undefined; break;
      case 'epaisseur': raw.strokeWidth = number(); break;
      case 'prolongements': raw.extend = val === 'oui'; break;
      case 'intensite': raw.extendIntensity = number(); break;
      case 'trait': raw.stroke = hexColor(val); break;
      case 'fond': raw.bg = hexColor(val); break;
      default: continue; // clé inconnue
    }
    known = true;
  }
  return known ? sanitize(raw) : null;
}

/** « c33 » ou « cc3333 » (avec ou sans « # ») → « #cc3333 » ; undefined si invalide. */
function hexColor(v: string): string | undefined {
  const h = v.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) return '#' + h.split('').map((c) => c + c).join('').toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(h)) return '#' + h.toLowerCase();
  return undefined;
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
    extend: x.extend === true,
    extendIntensity: Math.round(clamp(x.extendIntensity, 5, 100, d.extendIntensity)),
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
