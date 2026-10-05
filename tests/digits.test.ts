import { describe, expect, it } from 'vitest';
import { buildPath } from '../src/geometry/path';
import { eDigits, phiDigits, sqrt2Digits } from '../src/digits/constants';
import { textDigits } from '../src/digits/text';
import { imageDigits, traversalOrder } from '../src/digits/image';
import { freeDigits } from '../src/digits/free';
import { embeddedDigits } from '../src/digits/embedded';
import { makeFileBase, makeSubtitle, makeTitle } from '../src/ui/title';
import { decodeParams, DEFAULTS, encodeParams } from '../src/ui/state';

const str = (d: Uint8Array) => Array.from(d).join('');
const hist = (d: Uint8Array) => {
  const h = new Array(10).fill(0);
  for (const x of d) h[x]++;
  return h.map((c) => c / d.length);
};

describe('constantes', () => {
  it('e', () => expect(str(eDigits(20))).toBe('27182818284590452353'));
  it('phi', () => expect(str(phiDigits(20))).toBe('16180339887498948482'));
  it('sqrt2', () => expect(str(sqrt2Digits(20))).toBe('14142135623730950488'));
});

describe('données embarquées', () => {
  it('100 000 chiffres pour chaque nombre, cohérents avec le calcul local', async () => {
    for (const [k, f] of [['e', eDigits], ['phi', phiDigits], ['sqrt2', sqrt2Digits]] as const) {
      const d = (await embeddedDigits(k, 100_000))!;
      expect(d.length).toBe(100_000);
      expect(str(d.slice(0, 500))).toBe(str(f(500)));
    }
    expect(str((await embeddedDigits('pi', 100_000))!.slice(0, 10))).toBe('3141592653');
  });
});

describe('géométrie', () => {
  const o = { segLen: 1, coef: 10, firstDir: -1 as const };
  const heading = (pts: Float64Array, k: number) =>
    (Math.atan2(pts[(k + 1) * 2 + 1] - pts[k * 2 + 1], pts[(k + 1) * 2] - pts[k * 2]) * 180) / Math.PI;
  it('premier segment toujours vertical (vers le haut), n chiffres → n+1 segments', () => {
    const p = buildPath([3, 1, 4], o);
    expect(p.points.length / 2 - 1).toBe(4);
    expect(p.points[2]).toBeCloseTo(0);
    expect(p.points[3]).toBeCloseTo(-1);
  });
  it('angle 0 : le segment suivant est superposé au précédent', () => {
    const p = buildPath([3, 7], { ...o, coef: 0 });
    expect(Array.from(p.points).map((v) => Math.round(v) + 0)).toEqual([0, 0, 0, -1, 0, 0, 0, -1]);
  });
  it('l\'angle entre deux segments vaut chiffre × coefficient', () => {
    const p = buildPath([3], o);
    // vecteur retour du 1er segment (0,1) vs 2e segment : 30°
    const dx = p.points[4] - p.points[2];
    const dy = p.points[5] - p.points[3];
    expect((Math.acos(dy / Math.hypot(dx, dy)) * 180) / Math.PI).toBeCloseTo(30);
  });
  it('reproduit l\'œuvre (1 = 10°, π = 3,1415…) : caps 60°, −110°, 30°', () => {
    const p = buildPath([3, 1, 4, 1, 5, 9], o);
    expect(heading(p.points, 1)).toBeCloseTo(60);
    expect(heading(p.points, 2)).toBeCloseTo(-110);
    expect(heading(p.points, 3)).toBeCloseTo(30);
  });
  it('le chiffre 0 vaut 10', () => {
    const a = buildPath([0, 2], o);
    const b = buildPath([10, 2], o);
    expect(Array.from(a.points)).toEqual(Array.from(b.points));
  });
  it('sens du premier angle inversé = image miroir', () => {
    const a = buildPath([3], o);
    const b = buildPath([3], { ...o, firstDir: 1 });
    expect(a.points[4]).toBeCloseTo(-b.points[4]);
  });
});

describe('titre', () => {
  it('π-piquant • 1 = 10° • 1 000 décimales + nom de fichier', () => {
    const t = makeTitle({ ...DEFAULTS, coef: 10, lang: 'fr' }, 1000);
    expect(t.replace(/\s/g, ' ')).toBe('π-piquant • 1 = 10° • 1 000 décimales');
    expect(makeSubtitle('fr')).toBe('d’après François Morellet');
    expect(makeSubtitle('en')).toBe('after François Morellet');
    expect(makeFileBase({ ...DEFAULTS, coef: 10 }, 500)).toBe('pi-piquant_10deg_500dec');
  });
});

describe('texte', () => {
  it('hash : distribution quasi uniforme et déterministe', async () => {
    const d = await textDigits('Morellet', 'hash', 20000);
    for (const f of hist(d)) expect(Math.abs(f - 0.1)).toBeLessThan(0.012);
    expect(str(await textDigits('Morellet', 'hash', 50))).toBe(str(d.slice(0, 50)));
  });
  it('alpha', async () => expect(str(await textDigits('Aé b!', 'alpha', 10))).toBe('152'));
  it('unicode', async () => expect(str(await textDigits('A', 'unicode', 10))).toBe('65'));
});

describe('image', () => {
  const mk = (n: number, f: (i: number) => [number, number, number]) => {
    const a = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = f(i);
      a.set([r, g, b, 255], i * 4);
    }
    return a;
  };
  it('quantiles : 10 % par chiffre même sur une image très sombre', () => {
    const n = 10000;
    const rgba = mk(n, (i) => { const v = i % 40; return [v, v, v]; });
    const d = imageDigits(rgba, 100, 100, 'quantile', 'rows');
    for (const f of hist(d)) expect(f).toBeCloseTo(0.1, 2);
  });
  it('paliers fixes : image sombre déséquilibrée (comportement documenté)', () => {
    const rgba = mk(100, () => [10, 10, 10]);
    expect(hist(imageDigits(rgba, 10, 10, 'fixed', 'rows'))[0]).toBe(1);
  });
  it('teinte : rouge vif → 0, vert → 3 (120°/36)', () => {
    const rgba = mk(2, (i) => (i === 0 ? [255, 0, 0] : [0, 255, 0]));
    expect(str(imageDigits(rgba, 2, 1, 'hue', 'rows'))).toBe('03');
  });
  it('parcours : permutations complètes', () => {
    for (const t of ['rows', 'serpentine', 'spiral', 'hilbert'] as const) {
      const o = traversalOrder(7, 5, t);
      expect(o.length).toBe(35);
      expect(new Set(o).size).toBe(35);
    }
  });
});

describe('divers', () => {
  it('saisie libre', () => expect(str(freeDigits('3,14 abc 15', 99))).toBe('31415'));
  it('paramètres ↔ lien', () => expect(decodeParams(encodeParams(DEFAULTS))).toEqual(DEFAULTS));
});
