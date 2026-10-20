import { buildPath } from '../../src/geometry/path';
import { getDigits } from '../../src/digits';
import { framing } from '../../src/render/export';
import type { PngRequest } from '../../src/api/query';

/** Chemin et rapport largeur/hauteur calculés directement avec le code de l'application, pour les comparer à l'image de l'API. */
export async function exportParamsFor({ params }: PngRequest) {
  const digits = await getDigits(params, { image: null });
  const path = buildPath(digits, params);
  const f = framing({ points: path.points, bounds: path, style: params, title: null, fileBase: '' });
  return { points: path.points.length / 2, ratio: f.w / f.h };
}
