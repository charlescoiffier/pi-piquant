import './style.css';
import { buildPath, segmentCount, type PathResult } from './geometry/path';
import { getDigits, type ImageSource } from './digits';
import { fitImageSize } from './digits/image';
import { TEXT_MAX_BYTES, textBytes } from './digits/text';
import { Stage } from './render/canvas';
import { Viewport } from './render/viewport';
import { exportParams, exportPdf, exportPng, exportSvg, type ExportInput } from './render/export';
import { createPanel } from './ui/panel';
import { strings } from './ui/i18n';
import { createInfo } from './ui/info';
import { makeFileBase, makeSubtitle, makeTitle } from './ui/title';
import { DEFAULTS, decodeParams, encodeParams, sanitize, usesCount, withPersonalSettings, type Params } from './ui/state';

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

function draw() {
  updateCaption();
  stage.render(path.points, Math.min(shown, segments()), params, viewport);
}

function fitView() {
  if (stage.width === 0) return;
  viewport.fit(path, stage.width, stage.height);
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

/** Message d'état propre au texte et à l'image (troncature, réduction), vide sinon. */
function contentStatus(): string {
  const t = strings(params.lang);
  if (params.source === 'text' && textBytes(params.text) > TEXT_MAX_BYTES) return t.textTruncated.replace('{n}', TEXT_MAX_BYTES.toLocaleString(params.lang));
  if (params.source === 'image' && image) return t.imageSize.replace('{w}', String(image.w)).replace('{h}', String(image.h));
  return '';
}

async function reloadDigits() {
  const gen = ++generation;
  abort?.abort();
  abort = new AbortController();
  const t = strings(params.lang);
  setStatus(params.source === 'pi' ? t.loading : '');
  try {
    const d = await getDigits(params, {
      image,
      signal: abort.signal,
      onProgress: (done, total) => {
        if (gen === generation && params.source === 'pi' && done < total) setStatus(`${t.loading} ${done}/${total}`);
      },
    });
    if (gen !== generation) return;
    digits = d;
    shown = playing ? 0 : d.length;
    rebuildPath();
    setStatus(contentStatus());
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
/** Confirmation éphémère (téléchargement, copie…) : revient à l'état courant au bout de 4 s. */
function flash(msg: string) {
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
const exportInput = (): ExportInput => ({ points: path.points, bounds: path, style: params, title: titleLines(), fileBase: makeFileBase(params, digits.length) });
const shareUrl = () => `${location.origin}${location.pathname}#${encodeParams(params)}`;

const panel = createPanel(app, {
  get: () => params,
  set: update,
  togglePlay,
  showAll: () => { playing = false; shown = segments(); syncShowAll(); panel.setPlaying(false); draw(); },
  fit: fitView,
  zoom: (k) => viewport.zoomAt(stage.width / 2, stage.height / 2, k),
  loadImage: (f) => void loadImage(f),
  exportPng: (s) => void exportPng(exportInput(), s).then(() => downloaded('PNG'), failed),
  exportSvg: () => { try { exportSvg(exportInput()); downloaded('SVG'); } catch (e) { failed(e); } },
  exportPdf: () => void exportPdf(exportInput()).then(() => downloaded('PDF'), failed),
  copyLink: async () => {
    history.replaceState(null, '', shareUrl());
    try {
      await navigator.clipboard.writeText(shareUrl());
      flash(strings(params.lang).copied);
    } catch {
      setStatus(strings(params.lang).copyFailed);
    }
  },
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

addEventListener('keydown', (e) => {
  if (e.key === 'h' && !(e.target as HTMLElement).closest('input,textarea,select')) {
    document.querySelector('.panel')?.classList.toggle('hidden');
  }
});

void reloadDigits();
