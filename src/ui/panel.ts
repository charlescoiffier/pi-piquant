import { strings, type Dict } from './i18n';
import { MAX_COUNT, type Params } from './state';

export interface PanelActions {
  get(): Params;
  set(patch: Partial<Params>): void;
  togglePlay(): void;
  showAll(): void;
  fit(): void;
  zoom(factor: number): void;
  loadImage(file: File): void;
  exportPng(size: number): void;
  exportSvg(): void;
  exportPdf(): void;
  copyLink(): void;
  saveJson(): void;
  loadJson(file: File): void;
  hasImage(): boolean;
  openInfo(): void;
}

type El = HTMLElement;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (El | string)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
};

export function createPanel(host: El, a: PanelActions) {
  const panel = h('div', { class: 'panel', 'data-ui': '' });
  const header = h('div', { class: 'panel-head' });
  const body = h('div', { class: 'panel-body' });
  panel.append(header, body);
  host.append(panel);
  panel.addEventListener('wheel', (e) => e.stopPropagation());

  let t: Dict = strings(a.get().lang);
  let collapsed = false;
  let playing = false;
  let canShowAll = false;
  let showAllBtn: HTMLButtonElement | null = null;
  let status = '';
  let statusEl: El | null = null;

  // --- glisser la fenêtre -------------------------------------------------
  let drag: { dx: number; dy: number } | null = null;
  header.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    header.setPointerCapture(e.pointerId);
  });
  header.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - 60);
    const y = Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 40);
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
  });
  header.addEventListener('pointerup', () => (drag = null));

  // --- briques de formulaire ---------------------------------------------
  const field = (label: string, input: El) => h('label', { class: 'field' }, h('span', {}, label), input);

  const select = <T extends string>(opts: [T, string][], value: T, on: (v: T) => void) => {
    const s = h('select');
    for (const [v, l] of opts) {
      const o = h('option', { value: v }, l);
      if (v === value) o.setAttribute('selected', '');
      s.append(o);
    }
    s.addEventListener('change', () => on(s.value as T));
    return s;
  };

  const num = (value: number, min: number, max: number, step: number, on: (v: number) => void, slider = true) => {
    const wrap = h('div', { class: slider ? 'num' : 'num solo' });
    const n = h('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement;
    const r = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement;
    const push = (v: string, src: HTMLInputElement, other: HTMLInputElement) => {
      const x = Number(v);
      if (!Number.isFinite(x) || v === '') return;
      other.value = String(x);
      on(Math.min(max, Math.max(min, x)));
      void src;
    };
    n.addEventListener('input', () => push(n.value, n, r));
    r.addEventListener('input', () => push(r.value, r, n));
    wrap.append(n);
    if (slider) wrap.append(r);
    return wrap;
  };

  /** Interrupteur à deux positions (la position active est en bleu). */
  const toggle = <T extends string>(opts: [T, string][], value: T, on: (v: T) => void) => {
    const w = h('div', { class: 'seg', role: 'group' });
    for (const [v, l] of opts) {
      const b = h('button', { type: 'button', 'aria-pressed': String(v === value) }, l);
      b.addEventListener('click', () => {
        on(v);
        for (const x of w.children) x.setAttribute('aria-pressed', String(x === b));
      });
      w.append(b);
    }
    return w;
  };

  const color = (value: string, on: (v: string) => void) => {
    const c = h('input', { type: 'color', value }) as HTMLInputElement;
    c.addEventListener('input', () => on(c.value));
    return c;
  };

  const button = (label: string, on: () => void, cls = '') => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', on);
    return b;
  };

  const section = (title: string, ...kids: El[]) =>
    h('section', {}, h('h3', {}, title), ...kids);

  const fileButton = (label: string, accept: string, on: (f: File) => void) => {
    const input = h('input', { type: 'file', accept, hidden: '' }) as HTMLInputElement;
    input.addEventListener('change', () => {
      if (input.files?.[0]) on(input.files[0]);
      input.value = '';
    });
    const b = button(label, () => input.click());
    const w = h('span', {}, b, input);
    return w;
  };

  // --- construction ------------------------------------------------------
  function build() {
    const p = a.get();
    t = strings(p.lang);
    header.replaceChildren();
    body.replaceChildren();

    const title = h('span', { class: 'title' }, t.title);
    const langBtn = button(p.lang === 'fr' ? 'EN' : 'FR', () => {
      a.set({ lang: p.lang === 'fr' ? 'en' : 'fr' });
      build();
    }, 'ghost');
    const fold = button(collapsed ? '+' : '–', () => {
      collapsed = !collapsed;
      build();
    }, 'ghost');
    fold.title = collapsed ? t.show : t.hide;
    header.append(title, h('span', { class: 'spacer' }), langBtn, fold);
    panel.classList.toggle('collapsed', collapsed);
    if (collapsed) return;

    // Source
    const src = select<Params['source']>(
      [['pi', t.pi], ['e', t.e], ['phi', t.phi], ['sqrt2', t.sqrt2], ['free', t.free], ['text', t.text], ['image', t.image]],
      p.source,
      (v) => { a.set({ source: v }); build(); },
    );
    const srcKids: El[] = [field(t.source, src)];
    if (p.source === 'free') {
      const ta = h('textarea', { rows: '2' }) as HTMLTextAreaElement;
      ta.value = p.freeDigits;
      ta.addEventListener('input', () => a.set({ freeDigits: ta.value }));
      srcKids.push(field(t.freeDigits, ta));
    } else if (p.source === 'text') {
      const ta = h('textarea', { rows: '3' }) as HTMLTextAreaElement;
      ta.value = p.text;
      ta.addEventListener('input', () => a.set({ text: ta.value }));
      srcKids.push(field(t.textLabel, ta), h('p', { class: 'hint' }, t.textHint));
    } else if (p.source === 'image') {
      srcKids.push(
        h('div', { class: 'right' }, fileButton(t.imageFile, 'image/*', (f) => a.loadImage(f))),
        field(t.traversal, select<Params['traversal']>(
          [['rows', t.rows], ['serpentine', t.serpentine], ['spiral', t.spiral], ['hilbert', t.hilbert]],
          p.traversal, (v) => a.set({ traversal: v }))),
      );
      srcKids.push(h('p', { class: 'hint' }, a.hasImage() ? t.imageHint : t.noImage));
    }
    body.append(section(t.section.source, ...srcKids));

    // Tracé
    body.append(section(t.section.trace,
      ...(p.source === 'text' || p.source === 'image'
        ? [] // texte et image : toujours converti en entier (aucune troncature)
        : [field(t.count, num(p.count, 1, MAX_COUNT, 1, (v) => a.set({ count: Math.round(v) }), false))]),
      field(t.segLen, num(p.segLen, 1, 100, 0.5, (v) => a.set({ segLen: v }))),
      field(t.coef, num(p.coef, 0, 360, 0.1, (v) => a.set({ coef: v }))),
      field(t.firstDir, toggle<'1' | '-1'>([['-1', t.ccw], ['1', t.cw]], String(p.firstDir) as '1' | '-1',
        (v) => a.set({ firstDir: v === '-1' ? -1 : 1 }))),
    ));

    const tt = h('input', { type: 'checkbox' }) as HTMLInputElement;
    tt.checked = p.showTitle;
    tt.addEventListener('change', () => a.set({ showTitle: tt.checked }));
    // Style
    const dark = p.bg.toLowerCase() === '#111111';
    body.append(section(t.section.style,
      h('div', { class: 'row' },
        field(t.stroke, color(p.stroke, (v) => a.set({ stroke: v }))),
        field(t.bg, color(p.bg, (v) => a.set({ bg: v }))),
      ),
      h('label', { class: 'check' }, tt, h('span', {}, t.showTitle)),
      field(t.strokeWidth, num(p.strokeWidth, 0.1, 10, 0.1, (v) => a.set({ strokeWidth: v }))),
      button(dark ? t.light : t.dark, () => {
        a.set(dark ? { bg: '#ffffff', stroke: '#111111' } : { bg: '#111111', stroke: '#f2f2f2' });
        build();
      }),
    ));

    // Animation
    body.append(section(t.section.anim,
      h('div', { class: 'row' },
        button(playing ? t.pause : t.play, () => { a.togglePlay(); }),
        (() => {
          const b = button(t.showAll, () => a.showAll()) as HTMLButtonElement;
          b.disabled = !canShowAll; // actif pendant l'animation ou en pause, tant que le tracé est incomplet
          showAllBtn = b;
          return b;
        })(),
      ),
      field(t.speed, num(p.speed, 10, 5000, 10, (v) => a.set({ speed: v }))),
    ));

    // Vue
    body.append(section(t.section.view,
      h('div', { class: 'row' },
        button(t.zoomOut, () => a.zoom(1 / 1.4)),
        button(t.zoomIn, () => a.zoom(1.4)),
        button(t.fit, () => a.fit()),
      ),
    ));

    // Export
    const pngSize = select<'2048' | '4096' | '8192'>([['2048', '2048'], ['4096', '4096'], ['8192', '8192']], '4096', () => {});
    body.append(section(t.exportTitle,
      field(t.pngSize, pngSize),
      h('div', { class: 'row' },
        button(t.png, () => a.exportPng(Number(pngSize.value))),
        button(t.svg, () => a.exportSvg()),
        button(t.pdf, () => a.exportPdf()),
      ),
      h('div', { class: 'row' },
        button(t.copyLink, () => a.copyLink()),
        button(t.saveJson, () => a.saveJson()),
        fileButton(t.loadJson, 'application/json,.json', (f) => a.loadJson(f)),
      ),
    ));

    statusEl = h('p', { class: 'status', role: 'status' }, status);
    const info = button('i', () => a.openInfo(), 'info');
    info.title = t.info.label;
    info.setAttribute('aria-label', t.info.label);
    body.append(h('div', { class: 'foot' }, statusEl, info));
  }

  build();

  return {
    rebuild: build,
    setPlaying(v: boolean) {
      if (playing !== v) { playing = v; build(); }
    },
    setCanShowAll(v: boolean) {
      canShowAll = v;
      if (showAllBtn) showAllBtn.disabled = !v;
    },
    setStatus(msg: string) {
      status = msg;
      if (statusEl) statusEl.textContent = msg;
    },
  };
}
