import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ApiError, parsePngRequest } from '../src/api/query';
import { createApi } from '../src/api/app';
import { renderPng } from '../src/api/render';
import { DEFAULTS } from '../src/ui/state';
import { exportParamsFor } from './helpers/api';

const q = (s: string, max = 4096) => parsePngRequest(new URLSearchParams(s), max);
const fails = (s: string, status = 400, max = 4096) => {
  try { q(s, max); } catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).status).toBe(status); return (e as ApiError).message; }
  throw new Error(`« ${s} » aurait dû être refusé`);
};

describe('API : lecture des paramètres', () => {
  it('sans paramètre : valeurs par défaut de l’application, 2048 px', () => {
    const r = q('');
    expect(r.size).toBe(2048);
    expect(r.params).toEqual(DEFAULTS);
  });

  it('mêmes noms que le lien de partage', () => {
    const r = q('source=racine2&decimales=250&segment=5&angle=17,5&sens=horaire&trait=c33&fond=%23000000&epaisseur=1&prolongements=oui&intensite=40&titre=non&langue=en&taille=1000');
    expect(r.size).toBe(1000);
    expect(r.params).toMatchObject({
      source: 'sqrt2', count: 250, segLen: 5, coef: 17.5, firstDir: 1, stroke: '#cc3333', bg: '#000000',
      strokeWidth: 1, extend: true, extendIntensity: 40, showTitle: false, lang: 'en',
    });
  });

  it('chiffres et texte', () => {
    expect(q('source=chiffres&chiffres=3141592').params).toMatchObject({ source: 'free', freeDigits: '3141592' });
    expect(q('source=texte&texte=Morellet%20%26%20co').params).toMatchObject({ source: 'text', text: 'Morellet & co' });
  });

  it('la taille par défaut respecte le maximum configuré', () => expect(q('', 1024).size).toBe(1024));

  it.each([
    ['source=image', 'source'],
    ['source=lune', 'source'],
    ['decimales=0', 'decimales'],
    ['decimales=100001', 'decimales'],
    ['decimales=12.5', 'decimales'],
    ['decimales=abc', 'decimales'],
    ['angle=400', 'angle'],
    ['segment=0', 'segment'],
    ['epaisseur=-1', 'epaisseur'],
    ['sens=gauche', 'sens'],
    ['trait=rouge', 'trait'],
    ['fond=12345', 'fond'],
    ['prolongements=peut-etre', 'prolongements'],
    ['intensite=1', 'intensite'],
    ['langue=de', 'langue'],
    ['taille=10', 'taille'],
    ['taille=5000', 'taille'],
    ['source=chiffres', 'chiffres'],
    ['source=chiffres&chiffres=abc', 'chiffres'],
    ['source=texte', 'texte'],
    ['source=texte&texte=', 'texte'],
    ['inconnu=1', 'inconnu'],
    ['angle=10&angle=20', 'angle'],
  ])('refuse %s avec un message qui nomme le paramètre', (query, name) => {
    expect(fails(query)).toContain(name);
  });

  it('refuse un texte trop long', () => expect(fails(`source=texte&texte=${'a'.repeat(33_334)}`)).toContain('texte'));
});

describe('API : image', () => {
  it('produit un PNG de la taille demandée, légende comprise', async () => {
    const { png, fileBase } = await renderPng(q('decimales=100&angle=10&taille=500'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const img = await loadImage(png);
    expect(Math.max(img.width, img.height)).toBe(500);
    expect(fileBase).toBe('pi-piquant_10deg_100dec');
  });

  it('la légende ajoute un bandeau sous le dessin', async () => {
    const avec = await loadImage((await renderPng(q('decimales=100&angle=10&taille=500'))).png);
    const sans = await loadImage((await renderPng(q('decimales=100&angle=10&taille=500&titre=non'))).png);
    expect(avec.height / avec.width).toBeGreaterThan(sans.height / sans.width);
  });

  it('les couleurs demandées sont appliquées (fond rouge, trait blanc)', async () => {
    const { png } = await renderPng(q('decimales=50&angle=30&taille=300&titre=non&fond=ff0000&trait=ffffff&epaisseur=3'));
    const img = await loadImage(png);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    expect([data[0], data[1], data[2]]).toEqual([255, 0, 0]); // coin : fond
    let blancs = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 200) blancs++;
    expect(blancs).toBeGreaterThan(50); // le tracé est bien là
  });

  it('même géométrie que l’application : mêmes paramètres, même cadrage', async () => {
    const { points, ratio } = await exportParamsFor(q('decimales=30&angle=24&titre=non'));
    expect(points).toBe(31 + 1); // n + 1 segments, soit n + 2 points
    const img = await loadImage((await renderPng(q('decimales=30&angle=24&titre=non&taille=400'))).png);
    expect(img.width / img.height).toBeCloseTo(ratio, 1);
  });
});

describe('API : serveur', () => {
  const KEY = 'une-cle-de-test-assez-longue';
  let server: Server;
  let base: string;
  const call = (path: string, headers: Record<string, string> = {}, method = 'GET') => fetch(base + path, { method, headers });
  const auth = { Authorization: `Bearer ${KEY}` };

  beforeAll(async () => {
    server = createApi({ apiKey: KEY, maxSize: 1000, maxPending: 4 });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('renvoie un PNG avec la bonne clé', async () => {
    const r = await call('/api/png?decimales=60&angle=12&taille=300', auth);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('content-disposition')).toContain('pi-piquant_12deg_60dec.png');
    const body = Buffer.from(await r.arrayBuffer());
    expect(body.subarray(1, 4).toString()).toBe('PNG');
  });

  it('401 sans clé ou avec une mauvaise clé, avant même de lire les paramètres', async () => {
    for (const headers of [{}, { Authorization: 'Bearer autre-chose' }, { Authorization: KEY }] as Record<string, string>[]) {
      const r = await call('/api/png?decimales=nimporte', headers);
      expect(r.status).toBe(401);
      expect(r.headers.get('www-authenticate')).toBe('Bearer');
    }
  });

  it('400 avec un message JSON pour un paramètre invalide', async () => {
    const r = await call('/api/png?angle=999', auth);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain('angle');
  });

  it('400 au-delà de la taille maximale configurée', async () => {
    expect((await call('/api/png?taille=2000', auth)).status).toBe(400);
  });

  it('404, 405 et état de santé sans clé', async () => {
    expect((await call('/api/autre', auth)).status).toBe(404);
    expect((await call('/api/png', auth, 'POST')).status).toBe(405);
    const h = await call('/api/health');
    expect(h.status).toBe(200);
    expect(await h.json()).toEqual({ status: 'ok' });
  });

  it('plusieurs demandes simultanées sont toutes servies', async () => {
    const rs = await Promise.all([1, 2, 3].map((n) => call(`/api/png?decimales=${n * 20}&taille=200`, auth)));
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it('503 si la file est pleine', async () => {
    const small = createApi({ apiKey: KEY, maxSize: 1000, maxPending: 1 });
    await new Promise<void>((r) => small.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(small.address() as AddressInfo).port}/api/png?decimales=20000&taille=1000`;
    const rs = await Promise.all([1, 2, 3].map(() => fetch(url, { headers: auth })));
    expect(rs.some((r) => r.status === 503 && r.headers.get('retry-after') === '5')).toBe(true);
    await Promise.all(rs.map((r) => r.arrayBuffer()));
    await new Promise<void>((r) => small.close(() => r()));
  });

  it('503 si aucune clé n’est configurée (jamais ouvert par défaut)', async () => {
    for (const apiKey of [undefined, 'courte']) {
      const open = createApi({ apiKey, maxSize: 1000, maxPending: 1 });
      await new Promise<void>((r) => open.listen(0, '127.0.0.1', r));
      const r = await fetch(`http://127.0.0.1:${(open.address() as AddressInfo).port}/api/png`, { headers: auth });
      expect(r.status).toBe(503);
      await new Promise<void>((res) => open.close(() => res()));
    }
  });
});
