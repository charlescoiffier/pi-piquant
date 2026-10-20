import { TEXT_MAX_BYTES, textBytes } from '../digits/text';
import { DEFAULTS, MAX_COUNT, type Params, type Source } from '../ui/state';

/** Erreur de requête : message destiné à l'appelant, avec le code HTTP à renvoyer. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface PngRequest {
  params: Params;
  /** Grand côté de l'image, en pixels. */
  size: number;
}

const DEFAULT_SIZE = 2048;
const MIN_SIZE = 64;

// Mêmes noms que le lien de partage (src/ui/state.ts), plus trois paramètres propres à l'API : taille, titre, langue.
const SOURCES: Record<string, Source> = { pi: 'pi', e: 'e', phi: 'phi', racine2: 'sqrt2', chiffres: 'free', texte: 'text' };
const KEYS = new Set([
  'source', 'decimales', 'segment', 'angle', 'sens', 'trait', 'fond', 'epaisseur', 'prolongements', 'intensite',
  'chiffres', 'texte', 'titre', 'langue', 'taille',
]);

/**
 * Paramètres d'adresse → réglages du dessin. Contrairement au lien de partage (qui corrige en silence), l'API refuse
 * toute valeur invalide avec un message clair : un script doit savoir qu'il a mal appelé. Valeurs absentes = valeurs par défaut.
 */
export function parsePngRequest(query: URLSearchParams, maxSize: number): PngRequest {
  const seen = new Set<string>();
  for (const key of query.keys()) {
    if (!KEYS.has(key)) throw new ApiError(400, `Paramètre inconnu : « ${key} ». Paramètres acceptés : ${[...KEYS].join(', ')}.`);
    if (seen.has(key)) throw new ApiError(400, `Paramètre « ${key} » répété.`);
    seen.add(key);
  }
  const get = (k: string) => query.get(k) ?? undefined;

  const number = (k: string, lo: number, hi: number, d: number, integer = false) => {
    const raw = get(k);
    if (raw === undefined) return d;
    const n = raw.trim() === '' ? NaN : Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n < lo || n > hi || (integer && !Number.isInteger(n))) {
      throw new ApiError(400, `« ${k} » doit être ${integer ? 'un entier' : 'un nombre'} entre ${lo} et ${hi} (reçu : « ${raw} »).`);
    }
    return n;
  };
  const choice = <T>(k: string, allowed: Record<string, T>, d: T): T => {
    const raw = get(k);
    if (raw === undefined) return d;
    if (!Object.hasOwn(allowed, raw)) throw new ApiError(400, `« ${k} » doit valoir ${Object.keys(allowed).join(', ')} (reçu : « ${raw} »).`);
    return allowed[raw];
  };
  const yesNo = (k: string, d: boolean) => choice(k, { oui: true, non: false }, d);
  const color = (k: string, d: string) => {
    const raw = get(k);
    if (raw === undefined) return d;
    const h = raw.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) return '#' + h.split('').map((c) => c + c).join('').toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(h)) return '#' + h.toLowerCase();
    throw new ApiError(400, `« ${k} » doit être une couleur hexadécimale de 3 ou 6 chiffres, par exemple 111111 (reçu : « ${raw} »).`);
  };

  const source = choice('source', SOURCES, DEFAULTS.source);
  const params: Params = {
    ...DEFAULTS,
    source,
    count: number('decimales', 1, MAX_COUNT, DEFAULTS.count, true),
    segLen: number('segment', 0.1, 1000, DEFAULTS.segLen),
    coef: number('angle', -360, 360, DEFAULTS.coef),
    firstDir: choice('sens', { horaire: 1 as const, 'anti-horaire': -1 as const }, DEFAULTS.firstDir),
    strokeWidth: number('epaisseur', 0.1, 50, DEFAULTS.strokeWidth),
    stroke: color('trait', DEFAULTS.stroke),
    bg: color('fond', DEFAULTS.bg),
    extend: yesNo('prolongements', DEFAULTS.extend),
    extendIntensity: number('intensite', 5, 100, DEFAULTS.extendIntensity, true),
    showTitle: yesNo('titre', DEFAULTS.showTitle),
    lang: choice('langue', { fr: 'fr' as const, en: 'en' as const }, DEFAULTS.lang),
  };

  if (source === 'free') {
    const digits = get('chiffres');
    if (digits === undefined || !/[0-9]/.test(digits)) throw new ApiError(400, 'La source « chiffres » demande le paramètre « chiffres » (au moins un chiffre).');
    if (digits.length > MAX_COUNT) throw new ApiError(400, `« chiffres » est limité à ${MAX_COUNT} caractères.`);
    params.freeDigits = digits;
  }
  if (source === 'text') {
    const text = get('texte');
    if (!text) throw new ApiError(400, 'La source « texte » demande le paramètre « texte » (non vide).');
    if (textBytes(text) > TEXT_MAX_BYTES) throw new ApiError(400, `« texte » est limité à ${TEXT_MAX_BYTES} octets UTF-8.`);
    params.text = text;
  }

  return { params, size: number('taille', MIN_SIZE, maxSize, Math.min(DEFAULT_SIZE, maxSize), true) };
}
