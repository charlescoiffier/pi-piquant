import { createCanvas } from '@napi-rs/canvas';
import { buildPath } from '../geometry/path';
import { getDigits } from '../digits';
import { framing, paintExport, type ExportInput } from '../render/export';
import { extendStyleFor, titleLinesFor } from '../render/scene';
import { makeFileBase } from '../ui/title';
import type { PngRequest } from './query';

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
