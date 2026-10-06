import { strings } from './i18n';
import type { Lang } from './state';

export const REPO_URL = 'https://gitlab.com/charlescoiffier/pi-piquant';

export interface BuildInfo {
  version: string;
  commit: string; // « dev » hors build de production
  date: string; // ISO 8601
}

/** Informations du build courant (injectées par Vite). */
export const BUILD: BuildInfo = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev',
  date: typeof __APP_DATE__ === 'string' ? __APP_DATE__ : new Date(0).toISOString(),
};

export interface VersionPart {
  text: string;
  href?: string;
}

/** « Version 0.2.0 · commit 017e7dd · 6 oct. 2026 · Code source » en morceaux (le commit et le code source sont des liens). */
export function versionParts(lang: Lang, b: BuildInfo): VersionPart[] {
  const t = strings(lang).info;
  const date = new Date(b.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return [
    { text: `${t.version} ${b.version}` },
    b.commit === 'dev' ? { text: t.dev } : { text: `${t.commit} ${b.commit}`, href: `${REPO_URL}/-/commit/${b.commit}` },
    { text: date },
    { text: t.source, href: REPO_URL },
  ];
}

export const versionLine = (lang: Lang, b: BuildInfo) => versionParts(lang, b).map((p) => p.text).join(' · ');
