/**
 * Statyczny serwer podglądu (M12). Zastępuje `python3 -m http.server`, który
 * odpowiada w HTTP/1.0 bez `Connection: keep-alive` — proxy podglądu (Cloudflare)
 * potrafi zwrócić przy tym „Bad gateway”, mimo że serwer lokalnie działa.
 *
 * Poza tym: nagłówki bez cache (podgląd ma pokazywać bieżący plik, nie kopię
 * sprzed edycji) i poprawny Content-Type dla `.mjs`/`.webmanifest`, których
 * moduły ES i manifest PWA wymagają.
 *
 * Bez zależności npm (ADR 0001) — samo `node:http`.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const KATALOG = resolve(process.argv[2] ?? '.');
const PORT = Number(process.env.PORT ?? 8000);

const TYPY = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}));

/** Ścieżka z URL-a, przycięta do katalogu serwera (bez `../`). */
function sciezkaZadania(url) {
  const bezZapytania = decodeURIComponent(new URL(url, 'http://x').pathname);
  const wzgledna = normalize(bezZapytania).replace(/^(\.\.[/\\])+/, '');
  const pelna = join(KATALOG, wzgledna);
  if (!pelna.startsWith(KATALOG)) return null; // próba wyjścia poza katalog
  return pelna;
}

const serwer = createServer(async (zad, odp) => {
  try {
    let sciezka = sciezkaZadania(zad.url ?? '/');
    if (!sciezka) { odp.writeHead(403).end('403'); return; }

    let info = await stat(sciezka).catch(() => null);
    if (info?.isDirectory()) {
      sciezka = join(sciezka, 'index.html');
      info = await stat(sciezka).catch(() => null);
    }
    if (!info?.isFile()) { odp.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404'); return; }

    const dane = await readFile(sciezka);
    odp.writeHead(200, {
      'content-type': TYPY.get(extname(sciezka).toLowerCase()) ?? 'application/octet-stream',
      'content-length': dane.length,
      'cache-control': 'no-store', // podgląd zawsze świeży
    });
    odp.end(zad.method === 'HEAD' ? undefined : dane);
  } catch (blad) {
    odp.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(`500: ${blad.message}`);
  }
});

serwer.keepAliveTimeout = 65_000; // dłużej niż typowe 60 s proxy — proxy zamyka pierwsze
serwer.headersTimeout = 70_000;
serwer.requestTimeout = 0;

serwer.listen(PORT, '0.0.0.0', () => {
  console.log(`Podgląd: http://0.0.0.0:${PORT}  (katalog: ${KATALOG})`);
});
