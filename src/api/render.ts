import { existsSync } from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { buildPath } from '../geometry/path';
import { getDigits } from '../digits';
import { framing, paintExport, type ExportInput } from '../render/export';
import { extendStyleFor, titleLinesFor } from '../render/scene';
import { makeFileBase } from '../ui/title';
import type { PngRequest } from './query';

// La légende se dessine en « Helvetica, Arial, sans-serif » (comme dans le navigateur). Un serveur Linux n'a pas ces polices
// et Skia retomberait sur une police à chasse fixe : Liberation Sans (métriques d'Arial, avec le « π ») est déclarée sous le nom Helvetica.
// Sur un poste qui a déjà Helvetica (macOS), rien à faire.
for (const path of ['/usr/share/fonts/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']) {
  if (existsSync(path) && !GlobalFonts.has('Helvetica')) GlobalFonts.registerFromPath(path, 'Helvetica');
}

/**
 * Même chaîne que le bouton « PNG » de l'application (chiffres → tracé → cadrage → paintExport), sur un canvas Node.
 * `fileBase` est le nom de fichier sans extension, comme à l'export.
 */
export async function renderPng({ params, size }: PngRequest): Promise<{ png: Buffer; fileBase: string }> {
  const digits = await getDigits(params, { image: null });
  const path = buildPath(digits, params);
  const inp: ExportInput = {
    points: path.points,
    bounds: path,
    style: params,
    extend: extendStyleFor(params),
    title: titleLinesFor(params, digits.length),
    fileBase: makeFileBase(params, digits.length),
  };
  const f = framing(inp);
  const k = size / Math.max(f.w, f.h);
  const cw = Math.max(1, Math.round(f.w * k));
  const ch = Math.max(1, Math.round(f.h * k));
  const canvas = createCanvas(cw, ch);
  paintExport(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, inp, f, k, cw, ch, inp.points.length / 2 - 1);
  return { png: await canvas.encode('png'), fileBase: inp.fileBase };
}
