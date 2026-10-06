import './style.css';
import { buildPath, segmentCount, type PathResult } from './geometry/path';
import { getDigits, type ImageSource } from './digits';
import { fitImageSize } from './digits/image';
import { TEXT_MAX_BYTES, textBytes } from './digits/text';
import { Stage, type ExtendStyle } from './render/canvas';
import { Viewport } from './render/viewport';
import { download, exportParams, exportPdf, exportPng, exportSvg, type ExportInput } from './render/export';
import { recordVideo, videoSupported } from './render/video';
import { createPanel } from './ui/panel';
import { strings } from './ui/i18n';
import { createInfo } from './ui/info';
import { isMobile } from './ui/layout';
import { makeFileBase, makeSubtitle, makeTitle } from './ui/title';
import { DEFAULTS, EXTEND_MAX_SEGMENTS, LENGTH_STOPS, MAX_COUNT, SPEED_STOPS, WIDTH_STOPS, darkPatch, decodeParams, encodeParams, mixColor, sanitize, usesCount, withPersonalSettings, type Params } from './ui/state';
import { ignoresShortcut, shortcutFor, stepStop, type ShortcutAction } from './ui/shortcuts';

const fromHash = () => {
  const fragment = location.hash.slice(1);
  return fragment ? decodeParams(fragment) : null;
};

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// Préférences personnelles (hors lien) : la langue suit le navigateur
const start: Params = { ...DEFAULTS, lang: navigator.language.startsWith('fr') ? 'fr' : 'en' };
// Sans lien de partage : décimales au hasard (10-200) et angle unitaire entier au hasard (1-90°)
const linked = fromHash();
let params: Params = linked
  ? withPersonalSettings(linked, start)
  : { ...start, count: randInt(10, 200), coef: randInt(1, 90) };
if (!linked) resetShareUrl(); // fragment illisible (ancien lien…) : on ne le laisse pas dans la barre d'adresse
let digits: Uint8Array = new Uint8Array(0);
let path: PathResult = buildPath(digits, params);
let image: ImageSource | null = null;
let shown = 0; // segments affichés
let playing = false;
let lastTs = 0;
let generation = 0;
let abort: AbortController | null = null;
let debounce: number | undefined;

const app = document.getElementById('app')!;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const segments = () => segmentCount(digits.length);

const stage = new Stage(canvas, () => { fitView(); });
const viewport = new Viewport(app, () => draw());

const caption = document.createElement('div');
caption.className = 'caption';
app.append(caption);
const titleLines = () => (params.showTitle && digits.length ? [makeTitle(params, digits.length), makeSubtitle(params.lang)] : null);
function updateCaption() {
  const lines = titleLines();
  const text = lines ? lines.join('\n') : '';
  if (caption.textContent !== text) {
    caption.textContent = text;
    document.title = lines ? lines[0] : 'π-piquant';
  }
}

function syncShowAll() {
  panel.setCanShowAll(playing || shown < segments());
}

/** Prolongements des segments : trait mélangé au fond (jamais de transparence), quatre fois plus fin que le trait. */
function extendStyle(): ExtendStyle | undefined {
  if (!params.extend) return undefined;
  return { count: EXTEND_MAX_SEGMENTS, color: mixColor(params.bg, params.stroke, params.extendIntensity), width: params.strokeWidth / 4 };
}

function draw() {
  updateCaption();
  stage.render(path.points, Math.min(shown, segments()), params, viewport, extendStyle());
}

function fitView() {
  if (stage.width === 0) return;
  // mobile : le dessin reste au-dessus de la poignée de la feuille fermée et sous la légende (en haut à gauche)
  if (isMobile()) viewport.fit(path, stage.width, stage.height, 20, { top: 48, bottom: 72 });
  else viewport.fit(path, stage.width, stage.height);
}

// --- chiffres ------------------------------------------------------------
const digitKey = (p: Params) =>
  // chiffres libres, texte et image sont utilisés en entier : « count » ne les concerne pas
  JSON.stringify([p.source, usesCount(p.source) ? p.count : 0, p.freeDigits, p.text, p.traversal]);
const pathKey = (p: Params) => JSON.stringify([p.segLen, p.coef, p.firstDir]);

function rebuildPath(refit = true) {
  path = buildPath(digits, params);
  if (!playing) shown = segments();
  else shown = Math.min(shown, segments());
  syncShowAll();
  if (refit) fitView();
  else draw();
}

/** Message d'état propre au contenu (texte tronqué, image réduite, prolongements limités), vide sinon. */
function contentStatus(): string {
  const t = strings(params.lang);
  const notes: string[] = [];
  if (params.source === 'text' && textBytes(params.text) > TEXT_MAX_BYTES) notes.push(t.textTruncated.replace('{n}', TEXT_MAX_BYTES.toLocaleString(params.lang)));
  if (params.source === 'image' && image) notes.push(t.imageSize.replace('{w}', String(image.w)).replace('{h}', String(image.h)));
  if (params.extend && segments() > EXTEND_MAX_SEGMENTS) notes.push(t.extendLimited.replace('{n}', EXTEND_MAX_SEGMENTS.toLocaleString(params.lang)));
  return notes.join(' · ');
}

async function reloadDigits() {
  const gen = ++generation;
  abort?.abort();
  abort = new AbortController();
  const t = strings(params.lang);
  if (!flashing()) setStatus(params.source === 'pi' ? t.loading : '');
  try {
    const d = await getDigits(params, {
      image,
      signal: abort.signal,
      onProgress: (done, total) => {
        if (gen === generation && params.source === 'pi' && done < total && !flashing()) setStatus(`${t.loading} ${done}/${total}`);
      },
    });
    if (gen !== generation) return;
    digits = d;
    shown = playing ? 0 : d.length;
    rebuildPath();
    if (!flashing()) setStatus(contentStatus());
  } catch (e) {
    if (gen !== generation || (e as Error).name === 'AbortError') return;
    setStatus(t.error + (e as Error).message);
  }
}

// --- barre du bas : messages d'état ------------------------------------
let statusToken = 0;
function setStatus(msg: string) {
  statusToken++;
  panel.setStatus(msg);
}
/** Une confirmation éphémère est affichée : un chargement de chiffres qui se termine ne l'efface pas. */
let flashUntil = 0;
const flashing = () => Date.now() < flashUntil;

/** Confirmation éphémère (téléchargement, copie, raccourci…) : revient à l'état courant au bout de 4 s. */
function flash(msg: string) {
  flashUntil = Date.now() + 4000;
  setStatus(msg);
  const token = statusToken;
  window.setTimeout(() => { if (token === statusToken) panel.setStatus(contentStatus()); }, 4000);
}
const downloaded = (format: string) => flash(strings(params.lang).downloaded.replace('{f}', format));
const failed = (e: unknown) => setStatus(strings(params.lang).error + (e as Error).message);

/** Le lien complet (#source=…) ne décrit plus l'état dès qu'un paramètre change : retour à l'adresse courte. */
function resetShareUrl() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

function update(patch: Partial<Params>) {
  const before = params;
  params = sanitize({ ...params, ...patch });
  if (JSON.stringify(before) !== JSON.stringify(params)) resetShareUrl();
  if (digitKey(before) !== digitKey(params)) {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(reloadDigits, 250);
  } else if (pathKey(before) !== pathKey(params)) {
    rebuildPath();
  } else {
    draw();
  }
  if (before.extend !== params.extend) panel.setStatus(contentStatus());
}

// --- animation -----------------------------------------------------------
function frame(ts: number) {
  if (!playing) return;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;
  shown = Math.min(segments(), shown + params.speed * dt);
  draw();
  if (shown >= segments()) {
    playing = false;
    syncShowAll(); panel.setPlaying(false);
    return;
  }
  requestAnimationFrame(frame);
}

function togglePlay() {
  if (playing) {
    playing = false;
    syncShowAll(); panel.setPlaying(false);
    return;
  }
  if (shown >= segments()) shown = 0;
  playing = true;
  lastTs = 0;
  syncShowAll(); panel.setPlaying(true);
  requestAnimationFrame(frame);
}

// --- image ---------------------------------------------------------------
async function loadImage(file: File) {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitImageSize(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  image = { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
  resetShareUrl();
  bmp.close();
  window.clearTimeout(debounce);
  await reloadDigits();
  panel.rebuild();
}

// --- exports -------------------------------------------------------------
const exportInput = (): ExportInput => ({ points: path.points, bounds: path, style: params, extend: extendStyle(), title: titleLines(), fileBase: makeFileBase(params, digits.length) });
// --- actions partagées par les boutons et les raccourcis clavier ----------
function showAll() {
  playing = false;
  shown = segments();
  syncShowAll();
  panel.setPlaying(false);
  draw();
}

/** Efface le tracé et revient au premier segment (l'animation est arrêtée). */
function restart() {
  playing = false;
  shown = 0;
  syncShowAll();
  panel.setPlaying(false);
  draw();
}

async function copyLink() {
  history.replaceState(null, '', shareUrl());
  try {
    await navigator.clipboard.writeText(shareUrl());
    flash(strings(params.lang).copied);
  } catch {
    setStatus(strings(params.lang).copyFailed);
  }
}

const exportPngAt = (size: number) => void exportPng(exportInput(), size).then(() => downloaded('PNG'), failed);
const exportSvgNow = () => {
  try { exportSvg(exportInput()); downloaded('SVG'); } catch (e) { failed(e); }
};

let recorder: AbortController | null = null;

/** Enregistre l'animation en vidéo (durée choisie, indépendante de la vitesse affichée) puis la télécharge. */
async function exportVideo(duration: number) {
  if (recorder) return;
  const t = strings(params.lang);
  const input = exportInput(); // instantané : modifier les réglages pendant l'enregistrement ne le perturbe pas
  recorder = new AbortController();
  panel.setRecording(true);
  setStatus(t.recording.replace('{p}', '0'));
  try {
    const { blob, ext } = await recordVideo(input, {
      duration,
      signal: recorder.signal,
      onProgress: (p) => panel.setStatus(t.recording.replace('{p}', String(Math.round(p * 100)))),
    });
    download(blob, `${input.fileBase}.${ext}`);
    downloaded(ext === 'mp4' ? 'MP4' : 'WebM');
  } catch (e) {
    if ((e as Error).name === 'AbortError') flash(t.recordingCancelled);
    else failed(e);
  } finally {
    recorder = null;
    panel.setRecording(false);
  }
}

const shareUrl = () => `${location.origin}${location.pathname}#${encodeParams(params)}`;

const panel = createPanel(app, {
  get: () => params,
  set: update,
  togglePlay,
  showAll,
  fit: fitView,
  zoom: (k) => viewport.zoomAt(stage.width / 2, stage.height / 2, k),
  loadImage: (f) => void loadImage(f),
  exportPng: exportPngAt,
  exportSvg: exportSvgNow,
  exportPdf: () => void exportPdf(exportInput()).then(() => downloaded('PDF'), failed),
  exportVideo: (d) => void exportVideo(d),
  cancelVideo: () => recorder?.abort(),
  canRecord: videoSupported,
  copyLink,
  saveJson: () => { exportParams(JSON.stringify(params, null, 2), `${exportInput().fileBase}.json`); downloaded('JSON'); },
  loadJson: async (f) => {
    try {
      const obj = JSON.parse(await f.text());
      params = sanitize(obj);
      resetShareUrl();
      panel.rebuild();
      await reloadDigits();
      flash(strings(params.lang).jsonLoaded);
    } catch (e) {
      setStatus(strings(params.lang).error + (e as Error).message);
    }
  },
  hasImage: () => image !== null,
  openInfo: () => info.open(),
});

const info = createInfo(app, () => params.lang);

/** Applique les réglages d'un lien (collé dans l'adresse ou dans la page) ; vitesse, langue et titre sont conservés. */
async function applyLink(p: Params) {
  params = withPersonalSettings(p, params);
  panel.rebuild();
  await reloadDigits();
}

// Coller un lien dans la barre d'adresse de la page déjà ouverte ne change que le fragment : la page ne se recharge pas.
addEventListener('hashchange', () => {
  const p = fromHash();
  if (p) void applyLink(p);
});

// Coller un lien (Cmd/Ctrl+V) dans la page, hors d'un champ de saisie
addEventListener('paste', (e) => {
  if ((e.target as Element | null)?.closest?.('input,textarea,select,[contenteditable]')) return;
  const text = e.clipboardData?.getData('text/plain').trim() ?? '';
  const p = decodeParams(text.includes('#') ? text.slice(text.indexOf('#') + 1) : text);
  if (!p) return;
  e.preventDefault();
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeParams(p)}`);
  void applyLink(p).then(() => flash(strings(params.lang).linkApplied));
});

/**
 * Applique un raccourci clavier. Renvoie false s'il ne s'applique pas (la touche garde alors son effet normal).
 * Après chaque réglage, la fenêtre est reconstruite pour afficher la nouvelle valeur, et un message la rappelle
 * dans la barre du bas (utile quand la fenêtre est masquée ou repliée).
 */
function runShortcut(a: ShortcutAction): boolean {
  const t = strings(params.lang);
  const num = (v: number) => v.toLocaleString(params.lang);
  const set = (patch: Partial<Params>, label?: string, value?: string) => {
    update(patch);
    panel.rebuild();
    if (label) flash(`${label} : ${value}`);
  };
  switch (a.type) {
    case 'count': {
      if (!usesCount(params.source)) return false; // les autres sources sont utilisées en entier
      const v = Math.min(MAX_COUNT, Math.max(1, params.count + a.delta));
      set({ count: v }, t.count, num(v));
      return true;
    }
    case 'angle': {
      const v = Math.min(360, Math.max(0, Math.round((params.coef + a.delta) * 10) / 10));
      set({ coef: v }, t.coef, `${num(v)}°`);
      return true;
    }
    case 'length': {
      const v = stepStop(LENGTH_STOPS, params.segLen, a.dir);
      set({ segLen: v }, t.segLen, num(v));
      return true;
    }
    case 'width': {
      const v = stepStop(WIDTH_STOPS, params.strokeWidth, a.dir);
      set({ strokeWidth: v }, t.strokeWidth, num(v));
      return true;
    }
    case 'speed': {
      const v = stepStop(SPEED_STOPS, params.speed, a.dir);
      set({ speed: v }, t.speed, num(v));
      return true;
    }
    case 'source':
      set({ source: a.source }, t.source, t[a.source]);
      return true;
    case 'flip': {
      const dir = params.firstDir === 1 ? -1 : 1;
      set({ firstDir: dir }, t.firstDir, dir === 1 ? t.cw : t.ccw);
      return true;
    }
    case 'dark': set(darkPatch(params)); return true;
    case 'extend': set({ extend: !params.extend }); return true;
    case 'title': set({ showTitle: !params.showTitle }); return true;
    case 'play':
      if (!digits.length) return false;
      togglePlay();
      return true;
    case 'restart': restart(); return true;
    case 'showAll': showAll(); return true;
    case 'zoom': viewport.zoomAt(stage.width / 2, stage.height / 2, a.factor); return true;
    case 'fit': fitView(); return true;
    case 'copyLink': void copyLink(); return true;
    case 'png': exportPngAt(panel.pngSize()); return true;
    case 'svg': exportSvgNow(); return true;
    case 'video':
      if (!videoSupported()) flash(t.videoUnsupported);
      else void exportVideo(panel.videoDuration());
      return true;
    case 'hide': document.querySelector('.panel')?.classList.toggle('hidden'); return true;
    case 'info': info.open('app'); return true; // directement sur l'onglet des raccourcis
    case 'escape':
      if (!recorder) return false;
      recorder.abort();
      return true;
  }
}

/** Gestes répétables en maintenant la touche (flèches, zoom) ; les autres raccourcis ne se déclenchent qu'une fois. */
const REPEATABLE = new Set<ShortcutAction['type']>(['count', 'angle', 'length', 'width', 'speed', 'zoom']);

addEventListener('keydown', (e) => {
  if (e.defaultPrevented || document.querySelector('.info-overlay:not([hidden])')) return; // modale ouverte : ses propres touches
  const action = shortcutFor(e);
  if (!action || ignoresShortcut(e.target as Element | null, e.key)) return;
  if (e.repeat && !REPEATABLE.has(action.type)) return;
  if (runShortcut(action)) e.preventDefault();
});

void reloadDigits();
