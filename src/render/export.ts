import type { Bounds } from './viewport';
import { drawPath, type DrawStyle } from './canvas';

export interface ExportInput {
  points: Float64Array;
  bounds: Bounds;
  style: DrawStyle;
  /** Légende imprimée sous le tracé (null = aucune). */
  title?: string | null;
  /** Nom de fichier sans extension. */
  fileBase: string;
}

const pad = (b: Bounds, style: DrawStyle) => Math.max(style.strokeWidth, (b.maxX - b.minX + b.maxY - b.minY) * 0.02);

function framing(inp: ExportInput) {
  const p = pad(inp.bounds, inp.style);
  const minX = inp.bounds.minX - p;
  const minY = inp.bounds.minY - p;
  const w = Math.max(inp.bounds.maxX - inp.bounds.minX + 2 * p, 1e-6);
  const drawH = Math.max(inp.bounds.maxY - inp.bounds.minY + 2 * p, 1e-6);
  // bandeau de légende sous le dessin (texte à 1,8 % du grand côté)
  const fontSize = inp.title ? Math.max(w, drawH) * 0.018 : 0;
  const band = fontSize * 3.2;
  return { minX, minY, w, h: drawH + band, drawH, fontSize, baseline: minY + drawH + fontSize * 2 };
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
  const ctx = canvas.getContext('2d')!;
  const n = inp.points.length / 2 - 1;
  drawPath(ctx, inp.points, n, inp.style, k, -f.minX * k, -f.minY * k, cw, ch);
  if (inp.title) {
    ctx.fillStyle = inp.style.stroke;
    ctx.font = `${f.fontSize * k}px Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(inp.title, (inp.bounds.minX - f.minX) * k, (f.baseline - f.minY) * k);
  }
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
    `<polyline fill="none" stroke="${inp.style.stroke}" stroke-width="${inp.style.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/>` +
    (inp.title
      ? `<text x="${r(inp.bounds.minX)}" y="${r(f.baseline)}" font-family="Helvetica, Arial, sans-serif" font-size="${r(f.fontSize)}" fill="${inp.style.stroke}">${esc(inp.title)}</text>`
      : '') +
    `</svg>`;
  download(new Blob([svg], { type: 'image/svg+xml' }), name);
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

  const n = inp.points.length / 2 - 1;
  const rel: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    rel.push([(inp.points[(i + 1) * 2] - inp.points[i * 2]) * k, (inp.points[(i + 1) * 2 + 1] - inp.points[i * 2 + 1]) * k]);
  }
  if (inp.title) {
    // Les polices PDF standard n'ont pas « π » : le titre est rendu en image haute résolution.
    const px = 64;
    const c = document.createElement('canvas');
    const cx = c.getContext('2d')!;
    cx.font = `${px}px Helvetica, Arial, sans-serif`;
    c.width = Math.ceil(cx.measureText(inp.title).width) + 8;
    c.height = Math.ceil(px * 1.4);
    cx.font = `${px}px Helvetica, Arial, sans-serif`;
    cx.fillStyle = inp.style.stroke;
    cx.fillText(inp.title, 4, px * 1.05);
    const s = (f.fontSize * k) / px; // mm par pixel du canvas
    doc.addImage(c.toDataURL('image/png'), 'PNG', inp.bounds.minX * k + ox - 4 * s, f.baseline * k + oy - px * 1.05 * s, c.width * s, c.height * s, undefined, 'FAST');
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
