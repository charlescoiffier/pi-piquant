import { strings } from './i18n';
import type { Lang } from './state';

const SITE = 'https://francoismorellet.com/';

/** Seconde modale : présentation de l'œuvre de François Morellet et du principe repris par l'application. */
export function createInfo(host: HTMLElement, getLang: () => Lang) {
  const overlay = document.createElement('div');
  overlay.className = 'info-overlay';
  overlay.setAttribute('data-ui', '');
  overlay.hidden = true;
  host.append(overlay);

  const close = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('wheel', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  function open() {
    const t = strings(getLang()).info;
    const dlg = document.createElement('div');
    dlg.className = 'info-dialog';
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.setAttribute('aria-label', t.label);

    const h = document.createElement('h2');
    h.textContent = t.title;
    const paras = [t.p1, t.p2, t.p3].map((txt) => {
      const p = document.createElement('p');
      p.textContent = txt;
      return p;
    });
    const link = document.createElement('a');
    link.href = SITE;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${t.link} →`;
    const linkP = document.createElement('p');
    linkP.append(link);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t.close;
    btn.addEventListener('click', close);
    const actions = document.createElement('div');
    actions.className = 'right';
    actions.append(btn);

    dlg.append(h, ...paras, linkP, actions);
    overlay.replaceChildren(dlg);
    overlay.hidden = false;
    btn.focus();
  }

  return { open, close };
}
