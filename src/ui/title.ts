import type { Lang, Params } from './state';

const NAMES: Record<Params['source'], Record<Lang, string>> = {
  pi: { fr: 'π', en: 'π' },
  e: { fr: 'e', en: 'e' },
  phi: { fr: 'φ', en: 'φ' },
  sqrt2: { fr: '√2', en: '√2' },
  free: { fr: 'chiffres', en: 'digits' },
  text: { fr: 'texte', en: 'text' },
  image: { fr: 'image', en: 'image' },
};

/** « π-piquant • 1 = 10° • 1 000 décimales » (le nombre de chiffres réellement tracés). */
export function makeTitle(p: Params, digitCount: number): string {
  const fmt = (n: number) => n.toLocaleString(p.lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 4 });
  const numeric = ['pi', 'e', 'phi', 'sqrt2'].includes(p.source);
  const unit = numeric ? (p.lang === 'fr' ? 'décimales' : 'decimals') : p.lang === 'fr' ? 'chiffres' : 'digits';
  return `${NAMES[p.source][p.lang]}-piquant • 1 = ${fmt(p.coef)}° • ${fmt(digitCount)} ${unit}`;
}

/** Seconde ligne de la légende. */
export const makeSubtitle = (lang: Lang) => (lang === 'fr' ? 'd’après François Morellet' : 'after François Morellet');

const SLUGS: Record<Params['source'], string> = {
  pi: 'pi', e: 'e', phi: 'phi', sqrt2: 'sqrt2', free: 'chiffres', text: 'texte', image: 'image',
};

/** Nom de fichier sans extension : pi-piquant_10deg_500dec */
export function makeFileBase(p: Params, digitCount: number): string {
  const deg = String(Math.round(p.coef * 1000) / 1000);
  return `${SLUGS[p.source]}-piquant_${deg}deg_${digitCount}dec`;
}
