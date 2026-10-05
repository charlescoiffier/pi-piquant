export interface PathOptions {
  segLen: number;
  coef: number; // degrés par unité de chiffre
  firstDir: 1 | -1; // sens du premier angle (1 = horaire à l'écran, -1 = anti-horaire)
}

export interface PathResult {
  /** x0,y0,x1,y1,... : n+2 points (n+1 segments) pour n chiffres, aucun point pour 0 chiffre. */
  points: Float64Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Nombre de segments tracés pour n chiffres. */
export const segmentCount = (n: number) => (n > 0 ? n + 1 : 0);

/**
 * Le premier segment est toujours vertical (vers le haut). Chaque chiffre d
 * donne l'angle d'ouverture entre deux segments consécutifs : d × coef. Avec un
 * coefficient de 0°, le segment suivant est superposé au précédent. Comme chez
 * Morellet, le chiffre 0 vaut 10 (angle = 10 × coef).
 * Le sens de l'angle s'inverse à chaque sommet (le premier suit `firstDir`).
 */
export function buildPath(digits: ArrayLike<number>, o: PathOptions): PathResult {
  const n = digits.length;
  const segs = segmentCount(n);
  const points = new Float64Array(segs > 0 ? (segs + 1) * 2 : 2);
  const rad = Math.PI / 180;
  let x = 0;
  let y = 0;
  let heading = -Math.PI / 2;
  let sign = o.firstDir;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (let i = 0; i < segs; i++) {
    if (i > 0) {
      heading += Math.PI + sign * (digits[i - 1] || 10) * o.coef * rad;
      sign = sign === 1 ? -1 : 1;
    }
    x += o.segLen * Math.cos(heading);
    y += o.segLen * Math.sin(heading);
    points[(i + 1) * 2] = x;
    points[(i + 1) * 2 + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { points, minX, minY, maxX, maxY };
}
