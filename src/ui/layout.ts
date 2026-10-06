/** Seuil de largeur en dessous duquel la fenêtre de réglages devient une feuille en bas de l'écran (identique dans style.css). */
export const MOBILE_QUERY = '(max-width: 640px)';
export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

/** Positions de la feuille de réglages sur mobile : poignée seule, mi-ouverte (actions rapides), ouverte. */
export type Sheet = 'closed' | 'half' | 'full';

/** Glissement « petit » (en pixels) : au-delà, la feuille change de position ; en dessous, c'est un simple toucher. */
const SHEET_SMALL = 28;
const TAP_MAX_MOVE = 6; // pixels
const TAP_MAX_TIME = 500; // ms

/**
 * Position suivante de la feuille après un geste sur sa poignée.
 * `dy` : déplacement vertical en pixels (positif = vers le bas), `dt` : durée en ms, `height` : hauteur de la feuille.
 *  - toucher : fermée → mi-ouverte → ouverte ; ouverte → mi-ouverte
 *  - fermée : petit glissement vers le haut → mi-ouverte, grand → ouverte
 *  - mi-ouverte : petit glissement vers le haut → ouverte, vers le bas → fermée
 *  - ouverte : petit glissement vers le bas → mi-ouverte, grand → fermée
 * Seule la distance compte : « petit » = au moins SHEET_SMALL, « grand » = au moins 30 % de la hauteur (150 px minimum).
 */
export function nextSheet(from: Sheet, dy: number, dt: number, height: number): Sheet {
  const large = Math.max(150, height * 0.3);
  if (Math.abs(dy) < TAP_MAX_MOVE && dt < TAP_MAX_TIME) return from === 'closed' ? 'half' : from === 'half' ? 'full' : 'half';
  const up = -dy;
  if (from === 'closed') return up > large ? 'full' : up > SHEET_SMALL ? 'half' : 'closed';
  if (from === 'half') return up > SHEET_SMALL ? 'full' : dy > SHEET_SMALL ? 'closed' : 'half';
  return dy > large ? 'closed' : dy > SHEET_SMALL ? 'half' : 'full';
}
