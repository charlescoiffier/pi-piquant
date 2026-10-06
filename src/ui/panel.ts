import { strings, type Dict } from './i18n';
import { isMobile, MOBILE_QUERY, nextSheet, type Sheet } from './layout';
import { COUNT_STOPS, DEFAULT_VIDEO_DURATION, INTENSITY_STOPS, LENGTH_STOPS, MAX_COUNT, usesCount, MAX_SPEED, MIN_SPEED, SPEED_STOPS, VIDEO_DURATION_STOPS, WIDTH_STOPS, type Params } from './state';

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
  exportVideo(duration: number): void;
  cancelVideo(): void;
  canRecord(): boolean;
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
  let collapsed = false; // bureau : fenêtre repliée ou non
  let sheet: Sheet = 'closed'; // mobile : la feuille démarre fermée (poignée seule), le dessin reste entièrement visible
  let playing = false;
  let canShowAll = false;
  let showAllBtn: HTMLButtonElement | null = null;
  let recording = false;
  // réglages d'export conservés quand le panneau est reconstruit
  let pngSizeValue: '2048' | '4096' | '8192' = '4096';
  let videoDuration = DEFAULT_VIDEO_DURATION;
  let status = '';
  let statusEl: El | null = null;

  // --- mobile : feuille à trois positions ---------------------------------
  // safe-area du bas (barre d'accueil des téléphones), mesurée via un élément invisible
  const probe = h('div', { style: 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)' });
  panel.append(probe);
  const safeBottom = () => parseFloat(getComputedStyle(probe).paddingBottom) || 0;

  /** Décalage vertical (px) de la feuille pour chaque position : 0 = entièrement visible. */
  function sheetOffsets() {
    const height = panel.offsetHeight;
    const grip = header.querySelector<HTMLElement>('.grip');
    const foot = body.querySelector<HTMLElement>('.foot');
    const safe = safeBottom();
    const closedVisible = (grip?.offsetHeight ?? 30) + safe; // poignée seule
    const halfVisible = foot ? foot.offsetTop + foot.offsetHeight + 8 + safe : closedVisible; // + titre, actions rapides, ligne d'état
    return { closed: height - closedVisible, half: height - halfVisible, full: 0 };
  }

  /** Place la feuille sur sa position (avec animation) ; sans effet sur bureau. */
  function applySheet() {
    if (!isMobile()) {
      panel.style.transform = '';
      panel.style.transition = '';
      body.style.overflowY = '';
      delete panel.dataset.sheet;
      return;
    }
    panel.style.transition = '';
    panel.style.transform = `translateY(${sheetOffsets()[sheet]}px)`;
    body.style.overflowY = sheet === 'full' ? 'auto' : 'hidden'; // le contenu ne défile que feuille ouverte
    panel.dataset.sheet = sheet;
    header.querySelector('.grip')?.setAttribute('aria-expanded', String(sheet !== 'closed'));
  }
  window.addEventListener('resize', applySheet); // la barre d'adresse des téléphones change la hauteur utile

  // --- glisser la fenêtre (bureau) ou la feuille (mobile) -----------------
  let drag: { dx: number; dy: number } | null = null;
  let gesture: { startY: number; t0: number; base: number } | null = null;
  const capture = (e: PointerEvent) => {
    try { header.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique : pas de capture */ }
  };
  header.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (isMobile()) {
      gesture = { startY: e.clientY, t0: performance.now(), base: sheetOffsets()[sheet] };
      panel.style.transition = 'none'; // la feuille suit le doigt sans retard
      capture(e);
      return;
    }
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    capture(e);
  });
  header.addEventListener('pointermove', (e) => {
    if (gesture) {
      const y = Math.min(sheetOffsets().closed, Math.max(0, gesture.base + e.clientY - gesture.startY));
      panel.style.transform = `translateY(${y}px)`;
      return;
    }
    if (!drag) return;
    const x = Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - 60);
    const y = Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 40);
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
  });
  header.addEventListener('pointerup', (e) => {
    drag = null;
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    // petit/grand glissement vers le haut ou le bas, ou simple toucher : voir nextSheet
    sheet = nextSheet(sheet, e.clientY - g.startY, performance.now() - g.t0, panel.offsetHeight);
    applySheet();
  });
  header.addEventListener('pointercancel', () => {
    drag = null;
    gesture = null;
    applySheet(); // geste interrompu : la feuille revient à sa position
  });
  // changement de disposition (rotation, redimensionnement) : position libre effacée, état remis à zéro
  window.matchMedia(MOBILE_QUERY).addEventListener('change', () => {
    panel.style.left = panel.style.top = panel.style.right = '';
    collapsed = false;
    sheet = 'closed';
    build();
  });

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

  /**
   * Champ numérique libre + curseur à crans.
   *  - `stops` : un cran par valeur de la liste (échelle logarithmique si les valeurs suivent une
   *    suite 1-2-5) ; le curseur se cale sur le cran le plus proche de la valeur saisie.
   *  - `every` : curseur linéaire au pas `step`, avec un repère tous les `every`.
   * Les repères sont dessinés sous la piste ; le champ accepte toute valeur de min à max.
   */
  type Notches = { min: number; max: number; step: number; stops?: number[]; every?: number };
  const notchedParts = (value: number, o: Notches, on: (v: number) => void) => {
    const { min, max, step, stops, every } = o;
    const nearest = (v: number) =>
      stops!.reduce((best, s, i) => (Math.abs(Math.log(s / v)) < Math.abs(Math.log(stops![best] / v)) ? i : best), 0);
    const toSlider = (v: number) => String(stops ? nearest(v) : v);
    const fromSlider = (raw: string) => (stops ? stops[Number(raw)] : Number(raw));
    const count = stops ? stops.length : Math.round((max - min) / every!) + 1;
    const clamp = (x: number) => Math.min(max, Math.max(min, x));
    const round = (x: number) => Math.round(x * 1000) / 1000;

    const n = h('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: String(round(value)) }) as HTMLInputElement;
    const r = h('input', {
      type: 'range',
      min: stops ? '0' : String(min),
      max: stops ? String(stops.length - 1) : String(max),
      step: stops ? '1' : String(Math.max(step, 1)),
      value: toSlider(value),
    }) as HTMLInputElement;
    const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' });
    for (let i = 0; i < count; i++) ticks.append(h('span'));
    r.addEventListener('input', () => {
      const v = fromSlider(r.value);
      n.value = String(round(v));
      on(v);
    });
    n.addEventListener('input', () => {
      const x = Number(n.value);
      if (n.value === '' || !Number.isFinite(x)) return;
      const v = clamp(x);
      r.value = toSlider(v);
      on(v);
    });
    // à la sortie du champ, afficher la valeur réellement appliquée (bornée à min..max)
    n.addEventListener('change', () => {
      n.value = String(round(clamp(Number(n.value) || min)));
    });
    return { input: n, track: h('div', { class: 'stops' }, r, ticks) };
  };
  /** Champ + curseur côte à côte sur une ligne. */
  const notched = (value: number, o: Notches, on: (v: number) => void) => {
    const { input, track } = notchedParts(value, o, on);
    return h('div', { class: 'num' }, input, track);
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
    const mobile = isMobile();
    if (mobile) {
      // en-tête = poignée (seule visible feuille fermée) + titre et langue ; pas de bouton de repli : on glisse ou on touche la poignée
      const grip = h('div', { class: 'grip', role: 'button', tabindex: '0', 'aria-label': t.settings });
      grip.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        sheet = nextSheet(sheet, 0, 0, panel.offsetHeight); // équivaut à un toucher
        applySheet();
      });
      header.append(grip, h('div', { class: 'sheet-title' }, title, h('span', { class: 'spacer' }), langBtn));
      panel.classList.remove('collapsed');
      // feuille mi-ouverte : les trois actions principales et la ligne d'état, juste sous le titre
      body.append(
        h('div', { class: 'row quick' },
          button(playing ? t.pause : t.play, () => a.togglePlay()),
          button(t.copyLink, () => a.copyLink()),
          button(t.png, () => a.exportPng(Number(pngSizeValue))),
        ),
        footer(),
      );
    } else {
      const fold = button(collapsed ? '+' : '–', () => {
        collapsed = !collapsed;
        build();
      }, 'ghost');
      fold.title = collapsed ? t.show : t.hide;
      header.append(title, h('span', { class: 'spacer' }), langBtn, fold);
      panel.classList.toggle('collapsed', collapsed);
      if (collapsed) return;
    }

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
      ...(!usesCount(p.source)
        ? [] // chiffres libres, texte et image : utilisés en entier (aucune troncature)
        : (() => {
            const c = notchedParts(p.count, { min: 1, max: MAX_COUNT, step: 1, stops: COUNT_STOPS }, (v) => a.set({ count: Math.round(v) }));
            c.track.classList.add('full');
            return [field(t.count, c.input), c.track];
          })()),
      field(t.segLen, notched(p.segLen, { min: 1, max: 100, step: 0.5, stops: LENGTH_STOPS }, (v) => a.set({ segLen: v }))),
      field(t.coef, notched(p.coef, { min: 0, max: 360, step: 0.1, every: 36 }, (v) => a.set({ coef: v }))),
      field(t.firstDir, toggle<'1' | '-1'>([['-1', t.ccw], ['1', t.cw]], String(p.firstDir) as '1' | '-1',
        (v) => a.set({ firstDir: v === '-1' ? -1 : 1 }))),
    ));

    const tt = h('input', { type: 'checkbox' }) as HTMLInputElement;
    tt.checked = p.showTitle;
    tt.addEventListener('change', () => a.set({ showTitle: tt.checked }));
    const ex = h('input', { type: 'checkbox' }) as HTMLInputElement;
    ex.checked = p.extend;
    ex.addEventListener('change', () => { a.set({ extend: ex.checked }); build(); });
    // Style
    const dark = p.bg.toLowerCase() === '#111111';
    body.append(section(t.section.style,
      h('div', { class: 'row' },
        field(t.stroke, color(p.stroke, (v) => a.set({ stroke: v }))),
        field(t.bg, color(p.bg, (v) => a.set({ bg: v }))),
      ),
      h('label', { class: 'check' }, tt, h('span', {}, t.showTitle)),
      h('label', { class: 'check' }, ex, h('span', {}, t.extend)),
      ...(p.extend ? [field(t.extendIntensity, notched(p.extendIntensity, { min: 5, max: 100, step: 1, stops: INTENSITY_STOPS }, (v) => a.set({ extendIntensity: v })))] : []),
      field(t.strokeWidth, notched(p.strokeWidth, { min: 0.1, max: 10, step: 0.1, stops: WIDTH_STOPS }, (v) => a.set({ strokeWidth: v }))),
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
      field(t.speed, notched(p.speed, { min: MIN_SPEED, max: MAX_SPEED, step: 1, stops: SPEED_STOPS }, (v) => a.set({ speed: v }))),
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
    const pngSize = select<'2048' | '4096' | '8192'>([['2048', '2048'], ['4096', '4096'], ['8192', '8192']], pngSizeValue, (v) => { pngSizeValue = v; });
    const videoBtn = button(recording ? t.cancel : t.video, () => (recording ? a.cancelVideo() : a.exportVideo(videoDuration)));
    if (!a.canRecord()) {
      videoBtn.disabled = true;
      videoBtn.title = t.videoUnsupported;
    }
    body.append(section(t.exportTitle,
      field(t.pngSize, pngSize),
      h('div', { class: 'row' },
        button(t.png, () => a.exportPng(Number(pngSize.value))),
        button(t.svg, () => a.exportSvg()),
        button(t.pdf, () => a.exportPdf()),
      ),
      field(t.videoDuration, notched(videoDuration, { min: 3, max: 60, step: 1, stops: VIDEO_DURATION_STOPS }, (v) => { videoDuration = v; })),
      h('div', { class: 'row' }, videoBtn),
      h('div', { class: 'row' },
        button(t.copyLink, () => a.copyLink()),
        button(t.saveJson, () => a.saveJson()),
        fileButton(t.loadJson, 'application/json,.json', (f) => a.loadJson(f)),
      ),
    ));

    if (!mobile) body.append(footer());
    else {
      applySheet();
      requestAnimationFrame(applySheet); // mesures définitives une fois la mise en page terminée
    }
  }

  /** Ligne du bas : messages d'état à gauche, bouton d'information à droite. */
  function footer() {
    statusEl = h('p', { class: 'status', role: 'status' }, status);
    const info = button('i', () => a.openInfo(), 'info');
    info.title = t.info.label;
    info.setAttribute('aria-label', t.info.label);
    return h('div', { class: 'foot' }, statusEl, info);
  }

  build();

  return {
    rebuild: build,
    setPlaying(v: boolean) {
      if (playing !== v) { playing = v; build(); }
    },
    setRecording(v: boolean) {
      if (recording !== v) { recording = v; build(); }
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
