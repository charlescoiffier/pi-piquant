/** Seuil de largeur en dessous duquel la fenêtre de réglages devient une feuille en bas de l'écran (identique dans style.css). */
export const MOBILE_QUERY = '(max-width: 640px)';
export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
