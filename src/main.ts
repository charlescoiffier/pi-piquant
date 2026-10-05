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
import { DEFAULTS, decodeParams, encodeParams, sanitize, type Params } from './ui/state';

const fromHash = () => {
  const m = location.hash.match(/#p=([^&]+)/);
  return m ? decodeParams(m[1]) : null;
};

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// Sans lien de partage : décimales au hasard (10-200) et angle unitaire entier au hasard (1-90°)
let params: Params = fromHash() ?? {
  ...DEFAULTS,
  count: randInt(10, 200),
  coef: randInt(1, 90),
  lang: navigator.language.startsWith('fr') ? 'fr' : 'en',
};
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
  // texte et image sont toujours convertis en entier : « count » ne les concerne pas
  JSON.stringify([p.source, p.source === 'text' || p.source === 'image' ? 0 : p.count, p.freeDigits, p.text, p.traversal]);
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
  panel.setStatus(params.source === 'pi' ? t.loading : '');
  try {
    const d = await getDigits(params, {
      image,
      signal: abort.signal,
      onProgress: (done, total) => {
        if (gen === generation && params.source === 'pi' && done < total) panel.setStatus(`${t.loading} ${done}/${total}`);
      },
    });
    if (gen !== generation) return;
    digits = d;
    shown = playing ? 0 : d.length;
    rebuildPath();
    panel.setStatus(contentStatus());
  } catch (e) {
    if (gen !== generation || (e as Error).name === 'AbortError') return;
    panel.setStatus(t.error + (e as Error).message);
  }
}

function update(patch: Partial<Params>) {
  const before = params;
  params = sanitize({ ...params, ...patch });
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
  bmp.close();
  window.clearTimeout(debounce);
  await reloadDigits();
  panel.rebuild();
}

// --- exports -------------------------------------------------------------
const exportInput = (): ExportInput => ({ points: path.points, bounds: path, style: params, title: titleLines(), fileBase: makeFileBase(params, digits.length) });
const shareUrl = () => `${location.origin}${location.pathname}#p=${encodeParams(params)}`;

const panel = createPanel(app, {
  get: () => params,
  set: update,
  togglePlay,
  showAll: () => { playing = false; shown = segments(); syncShowAll(); panel.setPlaying(false); draw(); },
  fit: fitView,
  zoom: (k) => viewport.zoomAt(stage.width / 2, stage.height / 2, k),
  loadImage: (f) => void loadImage(f),
  exportPng: (s) => void exportPng(exportInput(), s),
  exportSvg: () => exportSvg(exportInput()),
  exportPdf: () => void exportPdf(exportInput()),
  copyLink: async () => {
    history.replaceState(null, '', shareUrl());
    try {
      await navigator.clipboard.writeText(shareUrl());
      panel.setStatus(strings(params.lang).copied);
    } catch {
      panel.setStatus(shareUrl());
    }
  },
  saveJson: () => exportParams(JSON.stringify(params, null, 2), `${exportInput().fileBase}.json`),
  loadJson: async (f) => {
    try {
      const obj = JSON.parse(await f.text());
      params = sanitize(obj);
      panel.rebuild();
      await reloadDigits();
    } catch (e) {
      panel.setStatus(strings(params.lang).error + (e as Error).message);
    }
  },
  hasImage: () => image !== null,
  openInfo: () => info.open(),
});

const info = createInfo(app, () => params.lang);

addEventListener('keydown', (e) => {
  if (e.key === 'h' && !(e.target as HTMLElement).closest('input,textarea,select')) {
    document.querySelector('.panel')?.classList.toggle('hidden');
  }
});

void reloadDigits();
