import type { Bounds } from './viewport';
import { drawPath, type DrawStyle, type ExtendStyle } from './canvas';
import { extendedLines } from '../geometry/extend';

export interface ExportInput {
  points: Float64Array;
  bounds: Bounds;
  style: DrawStyle;
  /** Prolongements des segments (undefined = aucun). */
  extend?: ExtendStyle;
  /** Lignes de légende imprimées sous le tracé (null = aucune). */
  title?: string[] | null;
  /** Nom de fichier sans extension. */
  fileBase: string;
}

const pad = (b: Bounds, style: DrawStyle) => Math.max(style.strokeWidth, (b.maxX - b.minX + b.maxY - b.minY) * 0.02);

export function framing(inp: ExportInput) {
  const p = pad(inp.bounds, inp.style);
  const minX = inp.bounds.minX - p;
  const minY = inp.bounds.minY - p;
  const w = Math.max(inp.bounds.maxX - inp.bounds.minX + 2 * p, 1e-6);
  const drawH = Math.max(inp.bounds.maxY - inp.bounds.minY + 2 * p, 1e-6);
  // bandeau de légende sous le dessin : 1re ligne à 1,8 % du grand côté, les suivantes à 85 %
  const lines = inp.title?.length ?? 0;
  const fontSize = lines ? Math.max(w, drawH) * 0.018 : 0;
  const gap = fontSize * 1.4;
  const band = lines ? fontSize * 3.1 + gap * (lines - 1) : 0;
  const baselines = Array.from({ length: lines }, (_, i) => minY + drawH + fontSize * 1.9 + gap * i);
  const sizes = Array.from({ length: lines }, (_, i) => (i === 0 ? fontSize : fontSize * 0.85));
  return { minX, minY, w, h: drawH + band, drawH, fontSize, gap, baselines, sizes };
}

export type Framing = ReturnType<typeof framing>;

/** Zone du dessin sans le bandeau de légende, dans le repère du dessin. */
const drawingRect = (f: Framing) => ({ minX: f.minX, minY: f.minY, maxX: f.minX + f.w, maxY: f.minY + f.drawH });

/** Télécharge un fichier généré dans le navigateur. */
export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * Dessine l'œuvre exportée (fond, prolongements, `segments` segments du tracé, légende) sur un canvas
 * de cw × ch pixels, à l'échelle `k` (pixels par unité du dessin). Commun au PNG et à la vidéo.
 */
export function paintExport(ctx: CanvasRenderingContext2D, inp: ExportInput, f: Framing, k: number, cw: number, ch: number, segments: number) {
  drawPath(ctx, inp.points, segments, inp.style, k, -f.minX * k, -f.minY * k, cw, ch, { extend: inp.extend, drawHeight: f.drawH * k });
  inp.title?.forEach((line, i) => {
    ctx.fillStyle = inp.style.stroke;
    ctx.font = `${f.sizes[i] * k}px Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(line, (inp.bounds.minX - f.minX) * k, (f.baselines[i] - f.minY) * k);
  });
}

/** PNG dont le grand côté fait `longSide` pixels. */
export async function exportPng(inp: ExportInput, longSide: number, name = `${inp.fileBase}.png`) {
  const f = framing(inp);
  const k = longSide / Math.max(f.w, f.h);
  const cw = Math.max(1, Math.round(f.w * k));
  const ch = Math.max(1, Math.round(f.h * k));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  paintExport(canvas.getContext('2d')!, inp, f, k, cw, ch, inp.points.length / 2 - 1);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (blob) download(blob, name);
}

export function exportSvg(inp: ExportInput, name = `${inp.fileBase}.svg`) {
  const f = framing(inp);
  const n = inp.points.length / 2;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) pts.push(`${r(inp.points[i * 2])},${r(inp.points[i * 2 + 1])}`);
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(f.minX)} ${r(f.minY)} ${r(f.w)} ${r(f.h)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
    `<rect x="${r(f.minX)}" y="${r(f.minY)}" width="${r(f.w)}" height="${r(f.h)}" fill="${inp.style.bg}"/>` +
    svgExtension(inp, f) +
    `<polyline fill="none" stroke="${inp.style.stroke}" stroke-width="${inp.style.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/>` +
    (inp.title ?? [])
      .map((line, i) => `<text x="${r(inp.bounds.minX)}" y="${r(f.baselines[i])}" font-family="Helvetica, Arial, sans-serif" font-size="${r(f.sizes[i])}" fill="${inp.style.stroke}">${esc(line)}</text>`)
      .join('') +
    `</svg>`;
  download(new Blob([svg], { type: 'image/svg+xml' }), name);
}

/** Prolongements en un seul <path>, découpés par la zone du dessin (la légende n'est pas traversée). */
function svgExtension(inp: ExportInput, f: Framing): string {
  if (!inp.extend) return '';
  const lines = extendedLines(inp.points, inp.extend.count, drawingRect(f));
  if (!lines.length) return '';
  const d: string[] = [];
  for (let i = 0; i < lines.length; i += 4) d.push(`M${r(lines[i])} ${r(lines[i + 1])}L${r(lines[i + 2])} ${r(lines[i + 3])}`);
  return `<path fill="none" stroke="${inp.extend.color}" stroke-width="${r(inp.extend.width)}" d="${d.join('')}"/>`;
}

const r = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** PDF vectoriel A4, orientation déduite du cadrage, marge de 10 mm. */
export async function exportPdf(inp: ExportInput, name = `${inp.fileBase}.pdf`) {
  const { jsPDF } = await import('jspdf');
  const f = framing(inp);
  const landscape = f.w >= f.h;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 10;
  const k = Math.min((pw - 2 * m) / f.w, (ph - 2 * m) / f.h);
  const ox = (pw - f.w * k) / 2 - f.minX * k;
  const oy = (ph - f.h * k) / 2 - f.minY * k;

  const [br, bg, bb] = hex(inp.style.bg);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pw, ph, 'F');
  const [sr, sg, sb] = hex(inp.style.stroke);
  doc.setDrawColor(sr, sg, sb);
  doc.setLineWidth(Math.max(0.05, inp.style.strokeWidth * k));
  doc.setLineJoin('round');
  doc.setLineCap('round');

  if (inp.extend) {
    const lines = extendedLines(inp.points, inp.extend.count, drawingRect(f));
    const [er, eg, eb] = hex(inp.extend.color);
    doc.setDrawColor(er, eg, eb);
    doc.setLineWidth(Math.max(0.05, inp.extend.width * k));
    for (let i = 0; i < lines.length; i += 4) {
      doc.line(lines[i] * k + ox, lines[i + 1] * k + oy, lines[i + 2] * k + ox, lines[i + 3] * k + oy);
    }
    doc.setDrawColor(sr, sg, sb);
    doc.setLineWidth(Math.max(0.05, inp.style.strokeWidth * k));
  }

  const n = inp.points.length / 2 - 1;
  const rel: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    rel.push([(inp.points[(i + 1) * 2] - inp.points[i * 2]) * k, (inp.points[(i + 1) * 2 + 1] - inp.points[i * 2 + 1]) * k]);
  }
  if (inp.title?.length) {
    // Les polices PDF standard n'ont pas « π » : la légende est rendue en image haute résolution.
    const px = 64; // taille de la 1re ligne en pixels du canvas
    const font = (i: number) => `${f.sizes[i] / f.fontSize * px}px Helvetica, Arial, sans-serif`;
    const y0 = px * 1.05;
    const c = document.createElement('canvas');
    const cx = c.getContext('2d')!;
    let widest = 0;
    inp.title.forEach((line, i) => { cx.font = font(i); widest = Math.max(widest, cx.measureText(line).width); });
    c.width = Math.ceil(widest) + 8;
    c.height = Math.ceil(y0 + px * 1.4 * (inp.title.length - 1) + px * 0.35);
    inp.title.forEach((line, i) => {
      cx.font = font(i);
      cx.fillStyle = inp.style.stroke;
      cx.fillText(line, 4, y0 + px * 1.4 * i);
    });
    const s = (f.fontSize * k) / px; // mm par pixel du canvas
    doc.addImage(c.toDataURL('image/png'), 'PNG', inp.bounds.minX * k + ox - 4 * s, f.baselines[0] * k + oy - y0 * s, c.width * s, c.height * s, undefined, 'FAST');
  }
  if (rel.length) doc.lines(rel, inp.points[0] * k + ox, inp.points[1] * k + oy, [1, 1], 'S', false);
  download(doc.output('blob'), name);
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function exportParams(json: string, name: string) {
  download(new Blob([json], { type: 'application/json' }), name);
}
