import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

/** Commit court : variable du pipeline GitLab (l'image alpine n'a pas git), sinon git, sinon « dev ». */
function commit(): string {
  if (process.env.CI_COMMIT_SHORT_SHA) return process.env.CI_COMMIT_SHORT_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

// Chemins relatifs : l'application est servie dans un sous-dossier (GitLab Pages : /pi-piquant/)
export default defineConfig(({ command }) => ({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // serveur de développement : le code change sans commit, on n'affiche pas un commit trompeur
    __APP_COMMIT__: JSON.stringify(command === 'build' ? commit() : 'dev'),
    __APP_DATE__: JSON.stringify(new Date().toISOString()),
  },
}));
