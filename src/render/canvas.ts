import type { Viewport } from './viewport';

export interface DrawStyle {
  stroke: string;
  bg: string;
  strokeWidth: number; // en unités du monde
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
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, width, height);
  if (segments > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(MIN_SCREEN_WIDTH, style.strokeWidth * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0] * scale + tx, points[1] * scale + ty);
    for (let i = 1; i <= segments; i++) ctx.lineTo(points[i * 2] * scale + tx, points[i * 2 + 1] * scale + ty);
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

  render(points: Float64Array, segments: number, style: DrawStyle, vp: Viewport) {
    drawPath(
      this.ctx, points, segments, style,
      vp.scale * this.dpr, vp.tx * this.dpr, vp.ty * this.dpr,
      this.canvas.width, this.canvas.height,
    );
  }
}
