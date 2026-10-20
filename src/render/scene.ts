import type { ExtendStyle } from './canvas';
import { EXTEND_MAX_SEGMENTS, mixColor, type Params } from '../ui/state';
import { makeSubtitle, makeTitle } from '../ui/title';

/** Prolongements des segments : couleur mélangée au fond, épaisseur du quart de celle du trait (undefined = aucun). */
export function extendStyleFor(p: Params): ExtendStyle | undefined {
  if (!p.extend) return undefined;
  return { count: EXTEND_MAX_SEGMENTS, color: mixColor(p.bg, p.stroke, p.extendIntensity), width: p.strokeWidth / 4 };
}

/** Légende sur deux lignes (null = masquée ou rien à tracer). Commune à l'écran, aux exports et à l'API. */
export const titleLinesFor = (p: Params, digitCount: number): string[] | null =>
  p.showTitle && digitCount ? [makeTitle(p, digitCount), makeSubtitle(p.lang)] : null;
