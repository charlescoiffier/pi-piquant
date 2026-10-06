import { strings } from './i18n';
import type { Lang } from './state';
import { BUILD, versionParts } from './version';

const SITE = 'https://francoismorellet.com/';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

const link = (href: string, text: string) => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/** « Cmd / Ctrl + V » → une touche <kbd> par élément, séparateurs en texte. */
function keys(spec: string): Node[] {
  return spec.split(/( \+ | \/ )/).map((part) => (/^ [+/] $/.test(part) ? document.createTextNode(part) : el('kbd', {}, part)));
}

/**
 * Modale d'information à deux onglets :
 *  - « François Morellet » : l'artiste, la série pi-piquant, le principe repris par l'application, lien vers son site ;
 *  - « L'application » : les raccourcis clavier et la version.
 */
export function createInfo(host: HTMLElement, getLang: () => Lang) {
  const overlay = el('div', { class: 'info-overlay', 'data-ui': '' });
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

  function open(tab: 'morellet' | 'app' = 'morellet') {
    const t = strings(getLang()).info;

    // --- onglet 1 : François Morellet
    const morellet = [
      el('h2', {}, t.title),
      el('p', {}, t.p1),
      el('p', {}, t.p2),
      el('p', {}, t.app), // le principe repris par l'application
      el('p', {}, link(SITE, `${t.link} →`)),
    ];

    // --- onglet 2 : l'application (principe, raccourcis clavier, version)
    const shortcuts = t.shortcutGroups.flatMap((g) => {
      const list = el('dl', { class: 'shortcuts' });
      for (const s of g.items) list.append(el('dt', {}, ...keys(s.keys)), el('dd', {}, s.text));
      return [el('h4', {}, g.title), list];
    });
    const version = el('p', { class: 'version' });
    versionParts(getLang(), BUILD).forEach((part, i) => {
      if (i) version.append(' · ');
      version.append(part.href ? link(part.href, part.text) : part.text);
    });
    const app = [el('h3', {}, t.shortcutsTitle), el('p', { class: 'hint' }, t.shortcutsNote), ...shortcuts, version];

    // --- onglets (ARIA : tablist / tab / tabpanel, flèches gauche-droite, Début, Fin)
    const defs = [
      { id: 'morellet', label: t.tabMorellet, content: morellet },
      { id: 'app', label: t.tabApp, content: app },
    ];
    const tabs = defs.map((d) => el('button', { type: 'button', role: 'tab', id: `info-tab-${d.id}`, 'aria-controls': `info-panel-${d.id}` }, d.label));
    // la fenêtre a une hauteur fixe : un seul panneau est affiché, et il défile seul si nécessaire
    const panels = defs.map((d) => el('div', { class: 'info-panel', role: 'tabpanel', id: `info-panel-${d.id}`, 'aria-labelledby': `info-tab-${d.id}` }, ...d.content));
    const select = (i: number, focus = false) => {
      tabs.forEach((tab, k) => {
        tab.setAttribute('aria-selected', String(k === i));
        tab.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
    const tablist = el('div', { class: 'info-tabs', role: 'tablist', 'aria-label': t.label }, ...tabs);
    tablist.addEventListener('keydown', (e) => {
      const cur = tabs.findIndex((x) => x.getAttribute('aria-selected') === 'true');
      const next = { ArrowRight: (cur + 1) % tabs.length, ArrowLeft: (cur - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(next, true);
    });

    const closeBtn = el('button', { type: 'button' }, t.close);
    closeBtn.addEventListener('click', close);

    const dlg = el('div', { class: 'info-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.label },
      tablist,
      el('div', { class: 'info-panels' }, ...panels),
      el('div', { class: 'right' }, closeBtn),
    );
    overlay.replaceChildren(dlg);
    overlay.hidden = false;
    select(tab === 'app' ? 1 : 0, true);
  }

  return { open, close };
}
