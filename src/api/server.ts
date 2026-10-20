import { createApi, MIN_KEY_LENGTH } from './app';

// Point d'entrée du conteneur « api » : API_KEY (secret), PORT (8081), MAX_SIZE (4096), MAX_PENDING (4).
const env = process.env;
const apiKey = env.API_KEY;
const port = Number(env.PORT ?? 8081);
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

if (!apiKey || apiKey.length < MIN_KEY_LENGTH) {
  log(`ATTENTION : API_KEY absente ou de moins de ${MIN_KEY_LENGTH} caractères, l'API répondra 503 à toute demande d'image.`);
}

const server = createApi({ apiKey, maxSize: Number(env.MAX_SIZE ?? 4096), maxPending: Number(env.MAX_PENDING ?? 4), log });
server.listen(port, '0.0.0.0', () => log(`API π-piquant à l'écoute sur le port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => process.exit(0)));
