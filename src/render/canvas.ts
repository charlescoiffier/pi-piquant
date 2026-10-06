import { extendedLines } from '../geometry/extend';
import type { Viewport } from './viewport';

export interface DrawStyle {
  stroke: string;
  bg: string;
  strokeWidth: number; // en unités du monde
}

/** Prolongements des segments en fines droites : couleur déjà mélangée au fond, épaisseur en unités du monde. */
export interface ExtendStyle {
  count: number; // nombre maximal de segments prolongés
  color: string;
  width: number;
}

export interface DrawOptions {
  extend?: ExtendStyle;
  /** Hauteur (en pixels du contexte) de la zone du dessin, si une légende occupe le bas du canvas. */
  drawHeight?: number;
}

const MIN_SCREEN_WIDTH = 0.4;

/**
 * Dessine `segments` segments du tracé (points = x,y,x,y,…) sur un contexte 2D.
 * `scale/tx/ty` sont exprimés en pixels du contexte (déjà multipliés par le dpr si besoin).
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Float64Array,
  segments: number,
  style: DrawStyle,
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
  opts: DrawOptions = {},
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, width, height);
  if (opts.extend && segments > 0) {
    // zone visible exprimée dans le repère du dessin
    const rect = { minX: -tx / scale, minY: -ty / scale, maxX: (width - tx) / scale, maxY: ((opts.drawHeight ?? height) - ty) / scale };
    const lines = extendedLines(points, Math.min(opts.extend.count, segments), rect);
    ctx.strokeStyle = opts.extend.color;
    ctx.lineWidth = Math.max(MIN_SCREEN_WIDTH, opts.extend.width * scale);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let i = 0; i < lines.length; i += 4) {
      ctx.moveTo(lines[i] * scale + tx, lines[i + 1] * scale + ty);
      ctx.lineTo(lines[i + 2] * scale + tx, lines[i + 3] * scale + ty);
    }
    ctx.stroke();
  }
  if (segments > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(MIN_SCREEN_WIDTH, style.strokeWidth * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0] * scale + tx, points[1] * scale + ty);
    const whole = Math.floor(segments);
    for (let i = 1; i <= whole; i++) ctx.lineTo(points[i * 2] * scale + tx, points[i * 2 + 1] * scale + ty);
    // segment en cours de tracé (animation, vidéo) : on le fait pousser au lieu de le faire apparaître d'un coup
    const frac = segments - whole;
    if (frac > 0 && whole * 2 + 3 < points.length) {
      const x = points[whole * 2] + (points[whole * 2 + 2] - points[whole * 2]) * frac;
      const y = points[whole * 2 + 1] + (points[whole * 2 + 3] - points[whole * 2 + 1]) * frac;
      ctx.lineTo(x * scale + tx, y * scale + ty);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Canvas plein écran qui gère le redimensionnement et le dpr. */
export class Stage {
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  width = 0;
  height = 0;

  constructor(readonly canvas: HTMLCanvasElement, private onResize: () => void) {
    this.ctx = canvas.getContext('2d')!;
    this.measure();
    new ResizeObserver(() => {
      this.measure();
      this.onResize();
    }).observe(canvas);
  }

  private measure() {
    this.dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  render(points: Float64Array, segments: number, style: DrawStyle, vp: Viewport, extend?: ExtendStyle) {
    drawPath(
      this.ctx, points, segments, style,
      vp.scale * this.dpr, vp.tx * this.dpr, vp.ty * this.dpr,
      this.canvas.width, this.canvas.height,
      { extend },
    );
  }
}
