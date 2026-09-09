/* Service Worker „Tajemnicza okolica" (M10/T2) — offline: skorupa aplikacji
 * + kafelki ostatniej okolicy. Classic script (nie moduł): rejestrowany z
 * `app/app.js`, zero zależności i zero analityki (ADR 0001, ADR 0013).
 *
 * Reguły:
 * - GET same-origin: SKORUPA (`index.html`, nawigacje) network-first z cache
 *   jako wyjściem awaryjnym, reszta (moduły z `?v=`, ikony) cache-first —
 *   aplikacja otwiera się i gra z lokalnej paczki bez sieci, a aktualizacja
 *   dociera bez ręcznego czyszczenia danych (zgłoszenie właściciela 2026-09-08);
 * - GET kafelków mapy dowolnego dostawcy (ścieżka `/z/x/y.png|jpg|webp`):
 *   cache-first z limitem MAKS_KAFELKI i ewikcją najstarszych wpisów —
 *   „ostatnia okolica" zostaje na telefonie;
 * - POST-y (most Drive, Overpass) i obce API bez wzorca kafelka: BEZ cache —
 *   świeżość danych i prywatność (ADR 0005/0013/0016).
 *
 * Wersjonowanie: WERSJA_SW ręcznie, ZAWSZE razem z cache-bust `?v=`
 * w index.html/app.js (pilnuje test/kontrakt.test.js). Stare cache'e usuwa
 * activate. */
'use strict';

const WERSJA_SW = 'm12-41';
const PREFIKS_CACHE = 'okolica';
const CACHE_SHELL = `${PREFIKS_CACHE}-shell-${WERSJA_SW}`;
const CACHE_KAFELKI = `${PREFIKS_CACHE}-kafelki-${WERSJA_SW}`;
/** Limit kafelków w cache (~10 okolic przy ~60 kafelkach/zoom). Test wstrzykuje mniejszy. */
const MAKS_KAFELKI = Number(self.__MAKS_KAFELKI_TEST__) || 600;
const PLIKI_SHELL = [
  './',
  './index.html',
  `./app/styles.css?v=${WERSJA_SW}`,
  './assets/manifest.json',
  './assets/ikony/ikona.svg',
  './assets/ikony/ikona-180.png',
  './assets/ikony/ikona-192.png',
  './assets/ikony/ikona-512.png',
  './assets/ikony/ikona-maskable-512.png',
];
/** Ścieżka kafelka rastrowego: /z/x/y(.@2x).png|jpg|webp — niezależnie od hosta. */
const WZOR_KAFELKA = /\/\d+\/\d+\/\d+(?:@\dx)?\.(?:png|jpe?g|webp)(?:[?#]|$)/i;

async function przytnij(cache, maks) {
  const klucze = await cache.keys();
  for (let i = 0; i < klucze.length - maks; i += 1) await cache.delete(klucze[i]);
}

/**
 * Skorupa MUSI być z sieci, kiedy sieć jest: to `index.html` niesie wersje
 * `?v=` wszystkich modułów. Cache-first na skorupie przybija użytkownika do
 * starej wersji — stary `index.html` wyciąga stare `?v=`, a te też siedzą
 * w cache, więc aktualizacja nie dociera bez ręcznego czyszczenia danych
 * (właściciel trafił na to dwa razy z rzędu, 2026-09-08). Offline wracamy
 * do cache, więc aplikacja nadal się otwiera.
 */
async function zSieciNajpierw(req, nazwa) {
  const cache = await caches.open(nazwa);
  try {
    const odp = await fetch(req);
    if (odp && odp.ok) cache.put(req, odp.clone());
    return odp;
  } catch (e) {
    const trafiony = await cache.match(req);
    if (trafiony) return trafiony;
    throw e;
  }
}

async function zCacheNajpierw(req, nazwa, maks) {
  const cache = await caches.open(nazwa);
  const trafiony = await cache.match(req);
  if (trafiony) return trafiony;
  const odp = await fetch(req);
  if (odp && (odp.ok || odp.type === 'opaque')) {
    // put() bez await: odpowiedź wraca do strony natychmiast
    cache.put(req, odp.clone()).then(() => (maks ? przytnij(cache, maks) : undefined));
  }
  return odp;
}

self.addEventListener('install', (zdarzenie) => {
  zdarzenie.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(PLIKI_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (zdarzenie) => {
  zdarzenie.waitUntil(
    caches.keys()
      .then((klucze) => Promise.all(
        klucze
          .filter((k) => k.startsWith(PREFIKS_CACHE) && k !== CACHE_SHELL && k !== CACHE_KAFELKI)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (zdarzenie) => {
  const req = zdarzenie.request;
  if (!req || req.method !== 'GET') return; // POST (Drive/Overpass) — nigdy cache
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin === self.location.origin) {
    // Skorupa z sieci (żeby aktualizacja docierała), reszta z cache — pliki
    // modułów mają `?v=` w adresie, więc i tak zmieniają URL przy każdej wersji.
    const czySkorupa = req.mode === 'navigate'
      || url.pathname.endsWith('/')
      || url.pathname.endsWith('/index.html');
    zdarzenie.respondWith(czySkorupa
      ? zSieciNajpierw(req, CACHE_SHELL)
      : zCacheNajpierw(req, CACHE_SHELL, 0));
    return;
  }
  if (WZOR_KAFELKA.test(url.pathname)) {
    zdarzenie.respondWith(zCacheNajpierw(req, CACHE_KAFELKI, MAKS_KAFELKI));
  }
  // reszta obcych GET (Overpass, Nominatim, most Drive): sieć jak stoi — bez cache
});
