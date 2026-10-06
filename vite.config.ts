import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { versionFromGit } from './scripts/version';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

const git = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null; // pas de git, ou pas de dépôt, ou pas de tag
  }
};

/** Numéro de version : dernier tag Git « vX.Y.Z » (package.json en secours). Voir scripts/version.ts. */
const ciTag = process.env.CI_COMMIT_TAG ?? (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined);
const version = versionFromGit(git('describe', '--tags', '--long', '--match', 'v[0-9]*'), ciTag, pkg.version);

/** Commit court : variable CI_COMMIT_SHORT_SHA si elle est définie, sinon git, sinon « dev ». */
const commit = () => process.env.CI_COMMIT_SHORT_SHA || git('rev-parse', '--short', 'HEAD') || 'dev';

// Chemins relatifs : l'application est servie dans un sous-dossier (GitHub Pages : /pi-piquant/)
export default defineConfig(({ command }) => ({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // serveur de développement : le code change sans commit, on n'affiche pas un commit trompeur
    __APP_COMMIT__: JSON.stringify(command === 'build' ? commit() : 'dev'),
    __APP_DATE__: JSON.stringify(new Date().toISOString()),
  },
}));
