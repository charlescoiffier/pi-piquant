/**
 * Décimales de π via https://api.pi.delivery (max 1000 chiffres par requête),
 * avec cache local par blocs (IndexedDB, repli mémoire).
 * L'indice 0 est le « 3 » initial : la suite est 3141592653…
 */
const CHUNK = 1000;
const ENDPOINT = 'https://api.pi.delivery/v1/pi';
const CONCURRENCY = 6;

const memory = new Map<number, string>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('pi-piquant', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('chunks');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(db: IDBDatabase, key: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const r = db.transaction('chunks').objectStore('chunks').get(key);
    r.onsuccess = () => resolve(r.result as string | undefined);
    r.onerror = () => resolve(undefined);
  });
}

function idbPut(db: IDBDatabase, key: number, value: string) {
  try {
    db.transaction('chunks', 'readwrite').objectStore('chunks').put(value, key);
  } catch {
    /* cache best effort */
  }
}

async function fetchChunk(index: number, signal?: AbortSignal): Promise<string> {
  const url = `${ENDPOINT}?start=${index * CHUNK}&numberOfDigits=${CHUNK}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`pi.delivery HTTP ${res.status}`);
      const json = (await res.json()) as { content?: string };
      if (!json.content || json.content.length !== CHUNK) throw new Error('Réponse pi.delivery invalide');
      return json.content;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export interface PiOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function piDigits(count: number, opts: PiOptions = {}): Promise<Uint8Array> {
  const total = Math.ceil(count / CHUNK);
  const db = await openDb();
  const chunks: string[] = new Array(total);
  const missing: number[] = [];

  for (let i = 0; i < total; i++) {
    const hit = memory.get(i) ?? (db ? await idbGet(db, i) : undefined);
    if (hit) {
      memory.set(i, hit);
      chunks[i] = hit;
    } else missing.push(i);
  }
  let done = total - missing.length;
  opts.onProgress?.(done, total);

  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const i = missing[next++];
      const c = await fetchChunk(i, opts.signal);
      memory.set(i, c);
      if (db) idbPut(db, i, c);
      chunks[i] = c;
      opts.onProgress?.(++done, total);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker));
  } finally {
    db?.close();
  }

  const s = chunks.join('');
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = s.charCodeAt(i) - 48;
  return out;
}
