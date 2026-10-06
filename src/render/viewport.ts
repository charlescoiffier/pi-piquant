export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Transformation monde → écran : sx = x * scale + tx. */
export class Viewport {
  scale = 1;
  tx = 0;
  ty = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;

  constructor(private el: HTMLElement, private onChange: () => void) {
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.style.touchAction = 'none';
  }

  /** Cadre `b` dans une zone w×h avec une marge en pixels, hors des bandes `top` et `bottom` réservées (feuille mobile…). */
  fit(b: Bounds, w: number, h: number, margin = 48, inset: { top: number; bottom: number } = { top: 0, bottom: 0 }) {
    const bw = Math.max(b.maxX - b.minX, 1e-6);
    const bh = Math.max(b.maxY - b.minY, 1e-6);
    const free = Math.max(1, h - inset.top - inset.bottom);
    this.scale = Math.min((w - 2 * margin) / bw, (free - 2 * margin) / bh);
    if (!Number.isFinite(this.scale) || this.scale <= 0) this.scale = 1;
    this.tx = (w - bw * this.scale) / 2 - b.minX * this.scale;
    this.ty = inset.top + (free - bh * this.scale) / 2 - b.minY * this.scale;
    this.onChange();
  }

  zoomAt(cx: number, cy: number, factor: number) {
    const k = Math.min(Math.max(factor, 0.01), 100);
    this.tx = cx - (cx - this.tx) * k;
    this.ty = cy - (cy - this.ty) * k;
    this.scale *= k;
    this.onChange();
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };

  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return;
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPinch = this.pinchDistance();
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (this.pointers.size === 1) {
      this.tx += cur.x - prev.x;
      this.ty += cur.y - prev.y;
      this.pointers.set(e.pointerId, cur);
      this.onChange();
    } else {
      this.pointers.set(e.pointerId, cur);
      const d = this.pinchDistance();
      if (this.lastPinch > 0 && d > 0) {
        const pts = [...this.pointers.values()];
        const r = this.el.getBoundingClientRect();
        const cx = (pts[0].x + pts[1].x) / 2 - r.left;
        const cy = (pts[0].y + pts[1].y) / 2 - r.top;
        this.zoomAt(cx, cy, d / this.lastPinch);
      }
      this.lastPinch = d;
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.lastPinch = this.pinchDistance();
  };

  private pinchDistance(): number {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
