import { describe, expect, it } from 'vitest';
import { buildPath } from '../src/geometry/path';
import { eDigits, phiDigits, sqrt2Digits } from '../src/digits/constants';
import { decodeText, textDigits, TEXT_MAX_BYTES, textBytes } from '../src/digits/text';
import { readByte, writeByte } from '../src/digits/bytecode';
import { decodeImage, fitImageSize, IMAGE_HEADER_DIGITS, IMAGE_MAX_PIXELS, imageDigits, traversalOrder } from '../src/digits/image';
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

describe('octet ⇄ 3 chiffres', () => {
  it('permutation : 256 octets → 256 blocs distincts, et relecture exacte', () => {
    const blocks = new Set<string>();
    for (let b = 0; b < 256; b++) {
      const d = new Uint8Array(3);
      writeByte(d, 0, b);
      blocks.add(Array.from(d).join(''));
      expect(readByte(d, 0)).toBe(b);
    }
    expect(blocks.size).toBe(256);
  });
  it('un bloc qui ne correspond à aucun octet est détecté', () => {
    const invalid = [0, 0, 0].map(() => 0);
    let found = false;
    for (let v = 0; v < 1000 && !found; v++) {
      const d = [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10];
      if (readByte(d, 0) < 0) { found = true; invalid.splice(0, 3, ...d); }
    }
    expect(found).toBe(true);
  });
  it('répartition équilibrée : les 256 niveaux de gris donnent chaque chiffre à ±1,5 point de 10 %', () => {
    const d = new Uint8Array(256 * 3);
    for (let b = 0; b < 256; b++) writeByte(d, b * 3, b);
    for (const f of hist(d)) expect(Math.abs(f - 0.1)).toBeLessThan(0.015);
  });
});

describe('texte réversible', () => {
  const textes = [
    'Bonjour',
    'François Morellet',
    'é ç œ ß à ï ü',
    '日本語 · 中文 · 한국어',
    'Emojis 😀🎨π✨ et 👨‍👩‍👧',
    'a\nb\tc\r\n',
    'dezd dksdmwjc kdslncjwkl dn,wcl jkwchjdkm jksmw jckdmsnjdksmw cd,slc kdsmcdksm< nkmdsnck<lmdsncklmdsn<c mndsm',
    '',
  ];
  for (const t of textes) {
    it(`aller-retour exact : ${JSON.stringify(t).slice(0, 30)}`, () => {
      const d = textDigits(t);
      expect(d.length).toBe(textBytes(t) * 3);
      expect(decodeText(d)).toBe(t);
    });
  }
  it('déterministe, et un même caractère donne toujours les mêmes chiffres', () => {
    expect(str(textDigits('aba').slice(0, 3))).toBe(str(textDigits('aba').slice(6, 9)));
    expect(str(textDigits('aba').slice(0, 3))).not.toBe(str(textDigits('aba').slice(3, 6)));
  });
  it('aucun chiffre ne domine sur du texte', () => {
    const d = textDigits('François Morellet a créé les œuvres pi-piquant à partir des décimales de π. '.repeat(20));
    for (const f of hist(d)) expect(Math.abs(f - 0.1)).toBeLessThan(0.06);
  });
  it('limite : coupe à une frontière de caractère, le résultat reste décodable', () => {
    const long = 'é'.repeat(TEXT_MAX_BYTES); // 2 octets par caractère
    const d = textDigits(long);
    expect(d.length).toBeLessThanOrEqual(100_000);
    const back = decodeText(d);
    expect(long.startsWith(back)).toBe(true);
    expect(back.length).toBe(Math.floor(TEXT_MAX_BYTES / 2));
  });
  it('chiffres invalides : erreur explicite', () => {
    expect(() => decodeText([1, 2])).toThrow();
  });
});

describe('image réversible (gris 8 bits)', () => {
  const rgbaOfGray = (gray: number[]) => {
    const a = new Uint8ClampedArray(gray.length * 4);
    gray.forEach((g, i) => a.set([g, g, g, 255], i * 4));
    return a;
  };
  for (const t of ['rows', 'serpentine', 'spiral', 'hilbert'] as const) {
    it(`aller-retour exact, parcours « ${t} » (image 7×5, 35 niveaux dont 0 et 255)`, () => {
      const gray = Array.from({ length: 35 }, (_, i) => (i * 37 + 3) % 256);
      gray[0] = 0; gray[34] = 255;
      const d = imageDigits(rgbaOfGray(gray), 7, 5, t);
      expect(d.length).toBe(IMAGE_HEADER_DIGITS + 35 * 3);
      const back = decodeImage(d);
      expect([back.w, back.h]).toEqual([7, 5]);
      expect(Array.from(back.gray)).toEqual(gray);
    });
  }
  it('en-tête : largeur, hauteur et parcours en clair', () => {
    const d = imageDigits(rgbaOfGray([10, 20, 30, 40, 50, 60]), 3, 2, 'spiral');
    expect(str(d.slice(0, 9))).toBe('000300022');
  });
  it('une image uniformément sombre reste équilibrée en chiffres', () => {
    const gray = Array.from({ length: 4000 }, (_, i) => i % 60); // niveaux 0-59 seulement
    const d = imageDigits(rgbaOfGray(gray), 100, 40, 'rows');
    for (const f of hist(d.slice(IMAGE_HEADER_DIGITS))) expect(Math.abs(f - 0.1)).toBeLessThan(0.04);
  });
  it('transparence : composée sur du blanc', () => {
    const a = new Uint8ClampedArray([0, 0, 0, 0]); // pixel noir totalement transparent → blanc
    expect(decodeImage(imageDigits(a, 1, 1, 'rows')).gray[0]).toBe(255);
  });
  it('trop grande : refus explicite ; fitImageSize ramène dans les limites', () => {
    expect(() => imageDigits(new Uint8ClampedArray(4), 20_000, 1, 'rows')).toThrow();
    for (const [w, h] of [[4000, 3000], [30_000, 1], [1, 12_000], [180, 180]]) {
      const f = fitImageSize(w, h);
      expect(f.w * f.h).toBeLessThanOrEqual(IMAGE_MAX_PIXELS);
      expect(Math.max(f.w, f.h)).toBeLessThanOrEqual(9999);
      expect(f.w).toBeGreaterThanOrEqual(1);
    }
    expect(fitImageSize(180, 180)).toEqual({ w: 180, h: 180 });
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
