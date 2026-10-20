import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError, parsePngRequest } from './query';
import { renderPng } from './render';

export interface ApiConfig {
  /** Clé attendue dans « Authorization: Bearer … ». Absente ou trop courte : l'API refuse tout (503). */
  apiKey?: string;
  /** Plus grand côté d'image accepté, en pixels (une image de 4096 px occupe ~64 Mo de mémoire). */
  maxSize: number;
  /** Nombre maximal de demandes en cours ou en attente avant de répondre 503 (les images sont produites une par une). */
  maxPending: number;
  log?: (line: string) => void;
}

export const MIN_KEY_LENGTH = 16;

const sha = (s: string) => createHash('sha256').update(s).digest();
const sameKey = (given: string, expected: string) => timingSafeEqual(sha(given), sha(expected));

function send(res: ServerResponse, status: number, body: string | Buffer, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const sendError = (res: ServerResponse, status: number, message: string, headers: Record<string, string> = {}) =>
  send(res, status, JSON.stringify({ error: message }), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

function authorized(req: IncomingMessage, key: string): boolean {
  const m = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '');
  return !!m && sameKey(m[1].trim(), key);
}

export function createApi(config: ApiConfig): Server {
  const log = config.log ?? (() => {});
  const keyOk = !!config.apiKey && config.apiKey.length >= MIN_KEY_LENGTH;
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;

  /** File d'attente à un seul traitement à la fois : le VPS n'a qu'un cœur, partagé avec les autres sites. */
  async function inQueue<T>(job: () => Promise<T>): Promise<T> {
    pending++;
    const run = tail.then(job);
    tail = run.catch(() => {});
    try {
      return await run;
    } finally {
      pending--;
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/health') {
      if (req.method !== 'GET') return sendError(res, 405, 'Méthode non autorisée.', { Allow: 'GET' });
      return send(res, 200, '{"status":"ok"}', { 'Content-Type': 'application/json' });
    }
    if (url.pathname !== '/api/png') return sendError(res, 404, 'Introuvable. Route disponible : GET /api/png.');
    if (req.method !== 'GET') return sendError(res, 405, 'Méthode non autorisée.', { Allow: 'GET' });
    if (!keyOk) return sendError(res, 503, 'API non configurée : aucune clé (API_KEY) définie sur le serveur.');
    if (!authorized(req, config.apiKey!)) {
      return sendError(res, 401, 'Clé absente ou invalide : envoyer « Authorization: Bearer <clé> ».', { 'WWW-Authenticate': 'Bearer' });
    }
    const request = parsePngRequest(url.searchParams, config.maxSize);
    if (pending >= config.maxPending) return sendError(res, 503, 'Serveur occupé, réessayer dans quelques secondes.', { 'Retry-After': '5' });
    const { png, fileBase } = await inQueue(() => renderPng(request));
    send(res, 200, png, {
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'Content-Disposition': `inline; filename="${fileBase}.png"`,
    });
  }

  return createServer((req, res) => {
    const t0 = Date.now();
    res.on('finish', () => log(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode} ${Date.now() - t0} ms`));
    handle(req, res).catch((e: unknown) => {
      if (res.headersSent) return res.destroy();
      if (e instanceof ApiError) return sendError(res, e.status, e.message);
      log(`erreur : ${e instanceof Error ? e.stack : String(e)}`);
      sendError(res, 500, 'Erreur interne.');
    });
  });
}
