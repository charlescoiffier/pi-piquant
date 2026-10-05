import type { Params } from '../ui/state';
import { piDigits } from './pi';
import { eDigits, phiDigits, sqrt2Digits } from './constants';
import { freeDigits } from './free';
import { textDigits } from './text';
import { imageDigits, MAX_PIXELS } from './image';
import { embeddedDigits } from './embedded';

export interface ImageSource {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
}

export interface Context {
  image: ImageSource | null;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Point d'entrée unique : paramètres → suite de chiffres 0-9. */
export async function getDigits(p: Params, ctx: Context): Promise<Uint8Array> {
  switch (p.source) {
    case 'pi':
    case 'e':
    case 'phi':
    case 'sqrt2': {
      // 1) fichier embarqué (instantané, hors ligne) ; 2) repli : API (π) ou calcul local
      const emb = await embeddedDigits(p.source, p.count);
      if (emb) return emb;
      if (p.source === 'pi') return piDigits(p.count, { signal: ctx.signal, onProgress: ctx.onProgress });
      return { e: eDigits, phi: phiDigits, sqrt2: sqrt2Digits }[p.source](p.count);
    }
    case 'free':
      return freeDigits(p.freeDigits, p.count);
    case 'text':
      return textDigits(p.text, p.textMode, p.count);
    case 'image': {
      if (!ctx.image) return new Uint8Array(0);
      const d = imageDigits(ctx.image.rgba, ctx.image.w, ctx.image.h, p.imageMode, p.traversal);
      return d.length > p.count ? d.slice(0, p.count) : d;
    }
  }
}

export { MAX_PIXELS };
