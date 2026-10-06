/**
 * Numéro de version affiché dans l'application : il vient du **dernier tag Git** « vX.Y.Z ».
 *
 *  - pipeline d'un tag (`CI_COMMIT_TAG`, ou `GITHUB_REF_NAME` d'un run de tag) : le tag lui-même ;
 *  - sinon `git describe --tags --long --match 'v[0-9]*'`, par exemple « v0.3.0-0-gb370633 » (sur le tag) ou
 *    « v0.3.0-4-gb370633 » (4 commits après), affichés « 0.3.0 » et « 0.3.0+4 » ;
 *  - aucun tag, ou git indisponible : `fallback` (le champ `version` de package.json).
 */
export function versionFromGit(describe: string | null, ciTag: string | undefined, fallback: string): string {
  if (ciTag && /^v\d/.test(ciTag)) return ciTag.slice(1);
  const m = describe ? /^v(\d.*)-(\d+)-g[0-9a-f]+$/.exec(describe.trim()) : null;
  if (!m) return fallback;
  return Number(m[2]) > 0 ? `${m[1]}+${m[2]}` : m[1];
}
