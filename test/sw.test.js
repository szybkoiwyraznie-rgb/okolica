/**
 * Testy `sw.js` (M10/T2) — Service Worker odpalany harnessem `new Function`
 * z atrapami `self`/`caches`/`fetch` (wzorzec: czysta logika testowalna bez
 * przeglądarki). Realna weryfikacja terenowa: checklista T7 (WORKFLOW §4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KOD_SW = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const ORIGIN = 'https://przyklad.github.io';
const SCOPE = `${ORIGIN}/okolica/`;

/** Czytelna odpowiedź CORS; opaque nie udostępnia ani typu, ani ciała. */
function domyslnaOdpowiedzObca() {
  return { ok: true, type: 'cors', status: 200, clone() { return this; } };
}

function atrapaOtoczenia({ maksKafelki, obcaOdpowiedz = domyslnaOdpowiedzObca, kod = KOD_SW, magazyny = new Map() } = {}) {
  const klucz = (req) => (typeof req === 'string' ? req : req.url);
  const cacheStub = (nazwa) => {
    if (!magazyny.has(nazwa)) magazyny.set(nazwa, { wpisy: new Map(), kolejnosc: [] });
    const m = magazyny.get(nazwa);
    return {
      async match(req) { return m.wpisy.get(klucz(req)); },
      async put(req, odp) { const k = klucz(req); if (!m.wpisy.has(k)) m.kolejnosc.push(k); m.wpisy.set(k, odp); },
      async keys() { return m.kolejnosc.filter((k) => m.wpisy.has(k)).map((k) => ({ url: k })); },
      async delete(req) { const k = klucz(req); m.wpisy.delete(k); m.kolejnosc = m.kolejnosc.filter((x) => x !== k); return true; },
      async addAll(lista) {
        for (const u of lista) {
          await this.put({ url: new URL(u, SCOPE).href }, { ok: true, type: 'basic', clone() { return this; } });
        }
      },
    };
  };
  const cachesStub = {
    async open(nazwa) { return cacheStub(nazwa); },
    async keys() { return [...magazyny.keys()]; },
    async delete(nazwa) { return magazyny.delete(nazwa); },
  };
  const nasluchy = {};
  const fetchWywolania = [];
  const selfStub = {
    location: { origin: ORIGIN, href: `${SCOPE}sw.js` },
    addEventListener: (typ, fn) => { nasluchy[typ] = fn; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  if (maksKafelki != null) selfStub.__MAKS_KAFELKI_TEST__ = maksKafelki;
  const fetchStub = async (req) => {
    const u = klucz(req);
    fetchWywolania.push(u);
    if (u.startsWith(ORIGIN)) {
      // same-origin: SW widzi status (basic)
      return { ok: true, type: 'basic', status: 200, clone() { return this; } };
    }
    return obcaOdpowiedz(u);
  };
  // eslint-disable-next-line no-new-func -- harness SW bez przeglądarki (M10/T2)
  new Function('self', 'caches', 'fetch', kod)(selfStub, cachesStub, fetchStub);
  const tick = () => new Promise((r) => setTimeout(r, 5));
  return { nasluchy, magazyny, fetchWywolania, tick };
}

function zdarzenieFetch(url, method = 'GET', mode = 'cors') {
  let odpowiedz = null;
  return {
    request: { method, url, mode },
    respondWith: (p) => { odpowiedz = p; },
    get odpowiedz() { return odpowiedz; },
  };
}

async function zdarzenieInstall(env) {
  const oczekujace = [];
  env.nasluchy.install({ waitUntil: (p) => oczekujace.push(p) });
  await Promise.all(oczekujace);
}

test('SW install: skorupa (index, style, manifest, ikony) ląduje w cache shell', async () => {
  const env = atrapaOtoczenia();
  await zdarzenieInstall(env);
  const shell = [...env.magazyny.keys()].find((k) => k.includes('shell'));
  assert.ok(shell, 'cache shell utworzony');
  const wpisy = [...env.magazyny.get(shell).wpisy.keys()];
  assert.equal(wpisy.length, 9, 'wszystkie pliki skorupy w precache');
  assert.ok(wpisy.some((u) => u.endsWith('/okolica/index.html')), 'index.html w skorupie');
  assert.ok(wpisy.some((u) => u.includes('styles.css?v=')), 'style z wersją cache-bust w skorupie');
});

test('SW activate: stare cache’e z przedrostkiem „okolica” usuwane, obce zostają', async () => {
  const env = atrapaOtoczenia();
  env.magazyny.set('okolica-shell-stara', { wpisy: new Map(), kolejnosc: [] });
  env.magazyny.set('okolica-kafelki-stara', { wpisy: new Map(), kolejnosc: [] });
  env.magazyny.set('inne-narzedzie', { wpisy: new Map(), kolejnosc: [] });
  await zdarzenieInstall(env);
  const oczekujace = [];
  env.nasluchy.activate({ waitUntil: (p) => oczekujace.push(p) });
  await Promise.all(oczekujace);
  const klucze = [...env.magazyny.keys()];
  assert.ok(!klucze.some((k) => k.includes('stara')), 'stare wersje cache usunięte');
  assert.ok(klucze.includes('inne-narzedzie'), 'obcy cache nietknięty');
});

test('SW fetch: same-origin cache-first — druga wizyta bez sieci', async () => {
  const env = atrapaOtoczenia();
  await zdarzenieInstall(env);
  const z1 = zdarzenieFetch(`${SCOPE}app/geo.js?v=m9b-1`);
  env.nasluchy.fetch(z1);
  assert.ok(z1.odpowiedz, 'same-origin GET obsłużony przez SW');
  await z1.odpowiedz;
  await env.tick();
  assert.equal(env.fetchWywolania.length, 1, 'pierwszy raz: sieć');
  const z2 = zdarzenieFetch(`${SCOPE}app/geo.js?v=m9b-1`);
  env.nasluchy.fetch(z2);
  const odp2 = await z2.odpowiedz;
  assert.ok(odp2, 'drugi raz: odpowiedź z cache');
  assert.equal(env.fetchWywolania.length, 1, 'drugi raz: BEZ sieci (cache-first)');
});

test('SW fetch: skorupa idzie z sieci, choć jest w cache — inaczej aktualizacja nie dociera', async () => {
  const env = atrapaOtoczenia();
  await zdarzenieInstall(env); // index.html ląduje w precache
  env.fetchWywolania.length = 0;

  // Właściciel dwa razy z rzędu widział starą wersję (2026-09-08): cache-first
  // na skorupie przybijał go do starego index.html, a ten wyciągał stare `?v=`.
  const z = zdarzenieFetch(`${SCOPE}index.html`, 'GET', 'navigate');
  env.nasluchy.fetch(z);
  await z.odpowiedz;
  assert.deepEqual(env.fetchWywolania, [`${SCOPE}index.html`],
    'skorupa jest pytana z sieci, choć siedzi w cache');
});

test('SW fetch: moduł z ?v= zostaje cache-first — wersjonowany adres i tak się zmienia', async () => {
  const env = atrapaOtoczenia();
  await zdarzenieInstall(env);
  env.fetchWywolania.length = 0;
  const z1 = zdarzenieFetch(`${SCOPE}app/geo.js?v=m12-33`);
  env.nasluchy.fetch(z1);
  await z1.odpowiedz;
  assert.equal(env.fetchWywolania.length, 1, 'pierwszy raz: sieć');
  const z2 = zdarzenieFetch(`${SCOPE}app/geo.js?v=m12-33`);
  env.nasluchy.fetch(z2);
  await z2.odpowiedz;
  assert.equal(env.fetchWywolania.length, 1, 'drugi raz bez sieci — cache-first dla plików z wersją');
});

test('SW fetch: kafelki dostawcy mapy trafiają do cache kafelków (CORS 200)', async () => {
  const env = atrapaOtoczenia();
  const z = zdarzenieFetch('https://tile.openstreetmap.org/19/28861/17402.png');
  env.nasluchy.fetch(z);
  assert.ok(z.odpowiedz, 'kafelki obsługuje SW');
  await z.odpowiedz;
  await env.tick();
  const kafelki = [...env.magazyny.keys()].find((k) => k.includes('kafelki'));
  assert.ok(kafelki, 'cache kafelków utworzony');
  assert.equal(env.magazyny.get(kafelki).wpisy.size, 1, 'czytelna odpowiedź 200 zapisana');
});

test('SW fetch: opaque nie udostępnia ciała — dobry obraz i błąd nie trafiają do cache', async () => {
  const opaque = { ok: false, type: 'opaque', status: 0, clone() { return this; }, blob: async () => new Blob([]) };
  const env = atrapaOtoczenia({ obcaOdpowiedz: () => opaque });
  for (let i = 0; i < 2; i++) {
    const z = zdarzenieFetch('https://tile.openstreetmap.org/19/28861/17402.png', 'GET', 'no-cors');
    env.nasluchy.fetch(z);
    assert.equal(await z.odpowiedz, opaque, 'odpowiedź nadal wraca do przeglądarki');
    await env.tick();
  }
  const cache = [...env.magazyny.values()][0];
  assert.equal(cache.wpisy.size, 0);
  assert.equal(env.fetchWywolania.length, 2);
});

test('SW fetch: czytelny błąd CORS nie jest cache-owany', async () => {
  for (const status of [404, 503]) {
    const odp = { ok: false, type: 'cors', status, clone() { return this; } };
    const env = atrapaOtoczenia({ obcaOdpowiedz: () => odp });
    const z = zdarzenieFetch('https://tile.openstreetmap.org/19/28861/17402.png');
    env.nasluchy.fetch(z);
    assert.equal(await z.odpowiedz, odp);
    await env.tick();
    assert.equal([...env.magazyny.values()][0].wpisy.size, 0);
  }
});

test('SW fetch: ewikcja najstarszych kafelków powyżej limitu', async () => {
  const env = atrapaOtoczenia({ maksKafelki: 3 });
  for (const i of [1, 2, 3, 4, 5]) {
    const z = zdarzenieFetch(`https://tile.example.org/14/${8000 + i}/${5000 + i}.png`);
    env.nasluchy.fetch(z);
    await z.odpowiedz;
    await env.tick();
  }
  const kafelki = [...env.magazyny.keys()].find((k) => k.includes('kafelki'));
  const wpisy = [...env.magazyny.get(kafelki).wpisy.keys()];
  assert.equal(wpisy.length, 3, 'limit 3 trzymany');
  assert.ok(!wpisy.some((u) => u.includes('/8001/')), 'najstarszy kafelki wyrzucony');
  assert.ok(wpisy.some((u) => u.includes('/8005/')), 'najnowszy został');
});

test('SW activate: cache kafelków przeżywa bump wersji (polityka kafelków OSM)', async () => {
  // Polityka kafelków OSM blokuje za „powtarzające się pobrania tych samych
  // kafelków z powodu niewłaściwego cache'owania" (osm.wiki/Blocked → General
  // block, *No caching*). WERSJA_SW rośnie przy każdej zmianie app/*.js
  // (LESSONS L29), więc cache kafelków nazwany od wersji wyrzucałby cały zbiór
  // przy każdym wdrożeniu i wymuszał ponowne pobranie widoku z serwera
  // dostawcy. Ten test symuluje dwa kolejne wdrożenia na tym samym magazynie.
  const KAFEL = 'https://tile.openstreetmap.org/19/28861/17402.png';

  const przed = atrapaOtoczenia();
  await zdarzenieInstall(przed);
  const z1 = zdarzenieFetch(KAFEL);
  przed.nasluchy.fetch(z1);
  await z1.odpowiedz;
  await przed.tick();
  const nazwa = [...przed.magazyny.keys()].find((k) => k.includes('kafelki'));
  assert.equal(nazwa, 'okolica-kafelki', 'cache kafelków bez wersji w nazwie');
  assert.equal(przed.fetchWywolania.length, 1, 'kafel pobrany raz');

  // „Wdrożenie": ten sam magazyn, nowa WERSJA_SW w kodzie SW.
  const poBumpie = atrapaOtoczenia({
    magazyny: przed.magazyny,
    kod: KOD_SW.replace("const WERSJA_SW = 'm12-80';", "const WERSJA_SW = 'm13-00';"),
  });
  assert.notEqual(KOD_SW.replace("const WERSJA_SW = 'm12-80';", "const WERSJA_SW = 'm13-00';"), KOD_SW,
    'test naprawdę podmienił wersję — inaczej nic nie dowodzi');
  await zdarzenieInstall(poBumpie);
  await poBumpie.nasluchy.activate({ waitUntil: (p) => p });

  assert.ok(poBumpie.magazyny.has(nazwa), 'activate NIE usunął cache kafelków');
  assert.equal(poBumpie.magazyny.get(nazwa).wpisy.size, 1, 'kafel przetrwał wdrożenie');

  const z2 = zdarzenieFetch(KAFEL);
  poBumpie.nasluchy.fetch(z2);
  await z2.odpowiedz;
  await poBumpie.tick();
  assert.equal(poBumpie.fetchWywolania.length, 0, 'po wdrożeniu kafel z cache — zero żądań do dostawcy');
});

test('SW activate: stary cache kafelków z wersją w nazwie jest sprzątany', async () => {
  // Migracja: wersje sprzed zmiany nazywały cache `okolica-kafelki-m12-80`.
  // Mają zniknąć raz na zawsze, żeby nie trzymać martwych kopii.
  const env = atrapaOtoczenia();
  env.magazyny.set('okolica-kafelki-m12-80', { wpisy: new Map([['x', {}]]), kolejnosc: ['x'] });
  await zdarzenieInstall(env);
  await env.nasluchy.activate({ waitUntil: (p) => p });
  assert.equal(env.magazyny.has('okolica-kafelki-m12-80'), false, 'stary wersjonowany cache usunięty');
});

test('SW fetch: POST i obce API (Overpass/Drive) BEZ obsługi — sieć i świeżość', () => {
  const env = atrapaOtoczenia();
  const post = zdarzenieFetch('https://most.przyklad/exec', 'POST');
  env.nasluchy.fetch(post);
  assert.equal(post.odpowiedz, null, 'POST nigdy przez cache (most Drive, Overpass)');
  const api = zdarzenieFetch('https://overpass-api.de/api/interpreter?data=x');
  env.nasluchy.fetch(api);
  assert.equal(api.odpowiedz, null, 'obce GET bez wzorca kafelka — bez cache');
});
