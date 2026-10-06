import type { Source } from './state';

/** Ce que déclenche un raccourci clavier (l'application des actions se fait dans main.ts). */
export type ShortcutAction =
  | { type: 'count'; delta: number } // ↑ ↓ : décimales (Maj : par 10)
  | { type: 'angle'; delta: number } // ← → : angle unitaire (Maj : par 10°)
  | { type: 'length'; dir: 1 | -1 } // Cmd/Ctrl + Opt/Alt + ↑ ↓ : longueur du segment (crans)
  | { type: 'width'; dir: 1 | -1 } // Cmd/Ctrl + Opt/Alt + ← → : épaisseur du trait (crans)
  | { type: 'source'; source: Source } // 1 à 4
  | { type: 'play' } // Espace
  | { type: 'restart' } // Début
  | { type: 'showAll' } // Fin
  | { type: 'speed'; dir: 1 | -1 } // < >
  | { type: 'zoom'; factor: number } // + −
  | { type: 'fit' } // 0
  | { type: 'flip' } // S : sens du premier angle
  | { type: 'dark' } // D
  | { type: 'extend' } // P : prolongements
  | { type: 'title' } // T
  | { type: 'copyLink' } // L
  | { type: 'png' } // E
  | { type: 'svg' } // Maj + E
  | { type: 'video' } // V
  | { type: 'hide' } // H
  | { type: 'info' } // ?
  | { type: 'escape' }; // Échap : annule l'enregistrement vidéo en cours

export interface KeyInfo {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export const ZOOM_STEP = 1.4; // même facteur que les boutons de la fenêtre

const NUMBER_SOURCES: Source[] = ['pi', 'e', 'phi', 'sqrt2'];

/**
 * Touche → action, ou null si la touche n'est pas un raccourci.
 *  - Les seules combinaisons avec modificateurs : Cmd/Ctrl + Opt/Alt + flèches (longueur du segment, épaisseur).
 *    Cmd/Ctrl seul ou Alt seul ne déclenchent jamais rien : on ne masque aucun raccourci du navigateur (Cmd+L, Cmd+R…).
 *  - Les chiffres se lisent avec `code` : sur un clavier AZERTY, 1 à 4 fonctionnent sans Maj.
 *  - Les signes (+ − < > ?) se lisent avec `key`, donc selon la disposition du clavier.
 */
export function shortcutFor(e: KeyInfo): ShortcutAction | null {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.altKey) {
    if (e.shiftKey) return null;
    switch (e.key) {
      case 'ArrowUp': return { type: 'length', dir: 1 };
      case 'ArrowDown': return { type: 'length', dir: -1 };
      case 'ArrowRight': return { type: 'width', dir: 1 };
      case 'ArrowLeft': return { type: 'width', dir: -1 };
    }
    return null;
  }
  if (mod || e.altKey) return null;
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowUp': return { type: 'count', delta: step };
    case 'ArrowDown': return { type: 'count', delta: -step };
    case 'ArrowRight': return { type: 'angle', delta: step };
    case 'ArrowLeft': return { type: 'angle', delta: -step };
    case ' ': return { type: 'play' };
    case 'Home': return { type: 'restart' };
    case 'End': return { type: 'showAll' };
    case '<': return { type: 'speed', dir: -1 };
    case '>': return { type: 'speed', dir: 1 };
    case '+': case '=': return { type: 'zoom', factor: ZOOM_STEP };
    case '-': case '_': return { type: 'zoom', factor: 1 / ZOOM_STEP };
    case '?': return { type: 'info' };
    case 'Escape': return { type: 'escape' };
  }
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (digit) {
    const n = Number(digit[1]);
    if (n === 0) return { type: 'fit' };
    return n <= NUMBER_SOURCES.length ? { type: 'source', source: NUMBER_SOURCES[n - 1] } : null;
  }
  switch (e.key.toLowerCase()) {
    case 's': return { type: 'flip' };
    case 'd': return { type: 'dark' };
    case 'p': return { type: 'extend' };
    case 't': return { type: 'title' };
    case 'l': return { type: 'copyLink' };
    case 'e': return e.shiftKey ? { type: 'svg' } : { type: 'png' };
    case 'v': return { type: 'video' };
    case 'h': return { type: 'hide' };
  }
  return null;
}

/**
 * Faut-il laisser la touche à l'élément ciblé ? Oui dans un champ de saisie ; et pour Espace dans un bouton ou un
 * lien, qu'il active nativement (sinon on lancerait l'animation en plus).
 */
export function ignoresShortcut(target: Element | null | undefined, key: string): boolean {
  if (target?.closest?.('input,textarea,select,[contenteditable="true"]')) return true;
  if (key === ' ') return !!target?.closest?.('button,a,[role="button"],[role="tab"]');
  return false;
}

/** Cran suivant (dir = 1) ou précédent (dir = −1) d'une liste croissante, à partir d'une valeur quelconque. */
export function stepStop(stops: readonly number[], value: number, dir: 1 | -1): number {
  if (dir === 1) return stops.find((s) => s > value + 1e-9) ?? stops[stops.length - 1];
  return [...stops].reverse().find((s) => s < value - 1e-9) ?? stops[0];
}
