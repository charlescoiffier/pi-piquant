import { framing, paintExport, type ExportInput } from './export';

/** Formats essayés dans l'ordre : MP4 (lisible partout) quand le navigateur sait l'enregistrer, sinon WebM. */
const VIDEO_TYPES: { mime: string; ext: 'mp4' | 'webm' }[] = [
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

export function pickVideoType(isSupported: (mime: string) => boolean) {
  return VIDEO_TYPES.find((t) => isSupported(t.mime)) ?? null;
}

/** Le navigateur peut-il enregistrer un canvas en vidéo ? */
export function videoSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickVideoType((m) => MediaRecorder.isTypeSupported(m)) !== null
  );
}

export interface RecordOptions {
  /** Durée du tracé, en secondes (le tracé complet reste affiché `holdMs` de plus). */
  duration: number;
  /** Taille du grand côté de la vidéo, en pixels. */
  longSide?: number;
  fps?: number;
  holdMs?: number;
  /** Progression du tracé, de 0 à 1. */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

/**
 * Enregistre l'animation du tracé en vidéo : même rendu que l'export PNG (légende et prolongements compris),
 * sur un canvas hors écran dont le nombre de segments affichés croît linéairement pendant `duration` secondes,
 * indépendamment de la vitesse d'animation réglée à l'écran. L'enregistrement se fait en temps réel.
 */
export function recordVideo(inp: ExportInput, o: RecordOptions): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  const type = pickVideoType((m) => MediaRecorder.isTypeSupported(m));
  const n = inp.points.length / 2 - 1;
  if (!type) return Promise.reject(new Error('Enregistrement vidéo non pris en charge'));
  if (n <= 0) return Promise.reject(new Error('Rien à enregistrer'));

  const { duration, longSide = 1080, fps = 30, holdMs = 500, onProgress, signal } = o;
  const f = framing(inp);
  const k = longSide / Math.max(f.w, f.h);
  // dimensions paires : exigées par H.264
  const cw = Math.max(2, 2 * Math.round((f.w * k) / 2));
  const ch = Math.max(2, 2 * Math.round((f.h * k) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  paintExport(ctx, inp, f, k, cw, ch, 0);

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      stream.getTracks().forEach((t) => t.stop());
      if (error) reject(error);
    };
    recorder.onerror = () => finish(new Error('Erreur pendant l\'enregistrement'));
    recorder.onstop = () => {
      if (finished) return;
      finish();
      resolve({ blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext });
    };

    const t0 = performance.now();
    const total = duration * 1000;
    const tick = () => {
      if (finished) return;
      if (signal?.aborted) {
        finish(new DOMException('Enregistrement annulé', 'AbortError'));
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      const elapsed = performance.now() - t0;
      const progress = Math.min(1, elapsed / total);
      paintExport(ctx, inp, f, k, cw, ch, n * progress);
      onProgress?.(progress);
      if (elapsed >= total + holdMs) {
        recorder.stop();
        return;
      }
      schedule();
    };
    // onglet masqué : requestAnimationFrame est suspendu, on continue avec un minuteur (images plus rares) pour finir
    const schedule = () => (document.hidden ? void setTimeout(tick, 33) : void requestAnimationFrame(tick));
    recorder.start();
    schedule();
  });
}
