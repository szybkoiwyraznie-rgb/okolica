/**
 * Testy przepływu M9/R3: karta propozycji paczek na ekranie pozycja i start
 * gry z gotową paczką (kryterium M9: druga gra bez modelu). Świeża atrapa DOM
 * i świeży import `app.js` na test (LESSONS: egzemplarze nie dzielą atrap).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { zainstalujDom } from './helpers/dom.js';
import { zapakujPaczke } from '../app/kodowanie.js';
import { KLUCZ_REJESTRU, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY, kluczZestawu } from '../app/zestawy.js';
import { DOMYSLNY_URL_MOSTU } from '../app/most.js';
import { geohash } from '../app/geo.js';

const POZYCJA = { lat: 52.12303, lon: 20.74614 }; // Podkowa Leśna (geohash5 u33dc)
const GEOHASH5 = 'u3qb8'; // policzone z geo.js dla (52.12303, 20.74614)

const paczkaMinimalna = () => ({
  protokol: 'PYT/1.0',
  okolica: { lat: POZYCJA.lat, lon: POZYCJA.lon, promienM: 1000, miejsce: 'Podkowa Leśna' },
  wiek: 'dorosli',
  tematy: ['historia'],
  jezyk: 'polski',
  utworzono: '2026-09-06 10:00',
  pytania: [{
    id: 's1p1', stacja: 1, temat: 'historia', tresc: 'Co powstało pierwsze?',
    odpowiedzi: ['kościół', 'szkoła', 'park', 'stacja'], poprawna: 0,
    wyjasnienie: 'Kościół poprzedza pozostałe obiekty.',
    zrodla: [{ url: 'https://przyklad.org/haslo', tytul: 'Hasło', sprawdzono: '2026-09-06' }],
    punkty: 10,
  }],
  uwagi: '',
});

// domyślny kanon setupu (DOMYSLNE.tematy) — dopasowanie porównuje ZBIÓR tematów
const TEMATY_DOMYSLNE = ['historia', 'przyroda', 'architektura'];

const metaWpisu = () => ({
  miejsce: 'Podkowa Leśna', geohash5: GEOHASH5, promienM: 1000,
  tematy: TEMATY_DOMYSLNE, wiek: 'dorosli', liczbaStacji: 3, pytaniaNaStacje: 1,
});

/** Setup z 2 stacjami i 1 pytaniem — tyle niesie wpis testowy (kryteria właściciela). */
// czasGryMin 85 → promień 1000 m dla 3 stacji × 1 pytania (ADR 0025): wpisy
// testowe mają promienM 1000, a dopasowanie wymaga promienia paczki ≤ setupu.
const KONFIG_TEST = JSON.stringify({
  schemat: 'konfig/1', kanon: '2026-09-10',
  konfig: {
    tryb: 'piesza', liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1, czasGryMin: 85,
    tematy: TEMATY_DOMYSLNE, wiek: 'dorosli', jezyk: 'polski',
    karaRecznaS: 60, podklad: 'osm', promienM: 1000, kodGry: 'test',
  },
});

function wpisPelny(kontener) {
  return {
    schemat: SCHEMAT_LOKALNY,
    stacje: [{ id: 1, lat: 52.1235, lon: 20.7455 }, { id: 2, lat: 52.1245, lon: 20.7475 }, { id: 3, lat: 52.1255, lon: 20.7495 }],
    kontener,
    ...metaWpisu(),
    data: '2026-09-06 09:00',
    kodGry: 'pierwsza',
  };
}

function pamiecZZestawem(kontener) {
  const pelny = wpisPelny(kontener);
  return new Map([
    ['okolica:konfig', KONFIG_TEST],
    [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [{ skrot: kontener.skrot, bajty: 900, ...metaWpisu(), data: '2026-09-06 09:00', kodGry: 'pierwsza' }] })],
    [kluczZestawu(kontener.skrot), JSON.stringify(pelny)],
  ]);
}

async function aplikacjaZZestawami({ pamiec = new Map(), search = '?tryb=test&odstep=0' } = {}) {
  const dom = zainstalujDom({ search, pamiec });
  await import(`../app/app.js?zestawy=${Math.random().toString(36).slice(2)}`);
  return dom;
}

function kliknijPierwszyPrzyciskZestawu(dom) {
  const lista = dom.pobierz('zestawy-lista');
  assert.ok(lista.children.length > 0, 'lista propozycji jest pusta');
  const przycisk = lista.children[0].children.find((el) => el.className === 'przycisk');
  const nasluchy = przycisk.zdarzenia.click ?? [];
  assert.equal(nasluchy.length, 1, 'wiersz propozycji ma dokładnie jeden nasłuch click');
  nasluchy[0]({ type: 'click', preventDefault() {} });
  return przycisk;
}

async function dojdzDoPozycji(dom, lat = POZYCJA.lat, lon = POZYCJA.lon) {
  dom.kliknij('przycisk-dalej-pozycja');
  dom.ustawPozycje(String(lat), String(lon));
}

test('zestawy UI: karta propozycji pokazuje paczkę z tego telefonu po ustawieniu pozycji', async () => {
  const kontener = zapakujPaczke(paczkaMinimalna(), 'PYT/1.0');
  const dom = await aplikacjaZZestawami({ pamiec: pamiecZZestawem(kontener) });
  assert.equal(dom.pobierz('zestawy-karta').hidden, true, 'przed pozycją karta nie straszy');
  await dojdzDoPozycji(dom);
  assert.equal(dom.pobierz('zestawy-karta').hidden, false, 'po pozycji karta jest widoczna');
  const lista = dom.pobierz('zestawy-lista');
  assert.equal(lista.children.length, 1, 'jedno dopasowanie: geohash5+promień+tematy+wiek');
  assert.match(lista.children[0].children[0].textContent, /z tego telefonu: Podkowa Leśna/);
  // adres Drive jest w kodzie (ADR 0020); tu bez fetch próba pada — karta mówi wprost,
  // że repozytorium jest niedostępne, a paczka z telefonu i tak działa
  await new Promise((r) => setTimeout(r, 20));
  assert.match(dom.pobierz('zestawy-status').textContent, /Repozytorium niedostępne/);
});

test('zestawy UI: druga gra w tej samej okolicy startuje bez modelu i bez Overpassa', async () => {
  const kontener = zapakujPaczke(paczkaMinimalna(), 'PYT/1.0');
  const pamiec = pamiecZZestawem(kontener);
  const dom = await aplikacjaZZestawami({ pamiec });
  await dojdzDoPozycji(dom);
  kliknijPierwszyPrzyciskZestawu(dom);
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra wystartowała z gotowej paczki');
  assert.match(dom.pobierz('status').textContent, /bez modelu i bez Overpassa/);
  assert.match(dom.pobierz('status').textContent, /3 stacji/);
  const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
  assert.equal(rejestr.wpisy.length, 1, 'start gry odświeżył wpis (ta sama paczka, nie duplikat)');
});

test('zestawy UI: nieczytelny wpis jest usuwany jawnie, nie cicho (LESSONS L6)', async () => {
  const kontener = zapakujPaczke(paczkaMinimalna(), 'PYT/1.0');
  const pamiec = pamiecZZestawem(kontener);
  pamiec.set(kluczZestawu(kontener.skrot), '{urwany json');
  const dom = await aplikacjaZZestawami({ pamiec });
  await dojdzDoPozycji(dom);
  assert.equal(dom.pobierz('zestawy-lista').children.length, 1, 'wpis w rejestrze jeszcze widoczny');
  kliknijPierwszyPrzyciskZestawu(dom);
  assert.match(dom.pobierz('status').textContent, /nieczytelna/);
  const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
  assert.deepEqual(rejestr.wpisy, [], 'rejestr po sprzątaniu jest pusty');
  assert.equal(pamiec.has(kluczZestawu(kontener.skrot)), false, 'klucz wpisu usunięty z pamięci');
});

test('zestawy UI: brak pozycji albo wyczyszczony promień chowają kartę', async () => {
  const dom = await aplikacjaZZestawami({});
  assert.equal(dom.pobierz('zestawy-karta').hidden, true, 'bez pozycji nie ma propozycji');
  dom.kliknij('przycisk-dalej-pozycja');
  dom.ustawPozycje(String(POZYCJA.lat), String(POZYCJA.lon));
  // Nasłuch `przycisk-dalej-pozycja` jest asynchroniczny, więc przejście na ekran
  // pozycji domyka się mikrozadaniem. Karta propozycji odświeża się tylko TAM
  // (a nie przy każdym fixie, także w grze), więc asercja musi poczekać.
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(dom.pobierz('zestawy-karta').hidden, false, 'poprawna konfiguracja odsłania kartę');
});

/* ---------------- M9/R6: repozytorium publiczne przez fetch (atrapa) ---------------- */

const indeksZPropozycja = () => ({
  schemat: 'TO-indeks/1',
  wpisy: [{
    skrot: 'feedbeef', plik: 'podkowa.zestaw.json', miejsce: 'Podkowa Leśna',
    geohash5: GEOHASH5, promienM: 1000, tematy: ['historia'], wiek: 'dorosli',
    liczbaStacji: 3, pytaniaNaStacje: 1,
    licencja: 'CC BY-SA 4.0', przegladZrodel: '2026-09-06 właściciel', data: '2026-09-06 19:30',
  }],
});

const plikZRepo = () => {
  const meta = {
    miejsce: 'Podkowa Leśna', geohash5: GEOHASH5, promienM: 1000,
    tematy: ['historia'], wiek: 'dorosli', jezyk: 'polski', data: '2026-09-06 19:30',
    liczbaStacji: 3, pytaniaNaStacje: 1,
    autor: 'kurator', licencja: 'CC BY-SA 4.0', przegladZrodel: '2026-09-06 właściciel',
  };
  return {
    schemat: 'TO-zestaw/1',
    protokol: 'PYT/1.0',
    meta,
    stacje: [{ lat: 52.1235, lon: 20.7455, opis: 'plac' }, { lat: 52.1245, lon: 20.7475, opis: 'park' }, { lat: 52.1255, lon: 20.7495, opis: 'skwer' }],
    kontener: zapakujPaczke(paczkaMinimalna(), 'PYT/1.0'),
  };
};

/**
 * app.js czyta `window.fetch` (LESSONS L18), więc atrapa podstawiona na
 * globalThis musi trafić też do okna atrapy DOM — po utworzeniu dom.
 */
function podlaczFetch(dom) {
  dom.window.fetch = globalThis.fetch;
}

function atrapaFetch(odpowiedzi) {
  const wywolania = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url) => {
    wywolania.push(String(url));
    const klucz = String(url).includes('indeks.json') ? 'indeks' : 'plik';
    const tekst = odpowiedzi[klucz];
    if (tekst == null) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => tekst };
  };
  return { wywolania, przywroc: () => { globalThis.fetch = pierwotny; } };
}

test('zestawy UI: indeks repozytorium dokłada propozycję, a kliknięcie gra bez modelu', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify(indeksZPropozycja()), plik: JSON.stringify(plikZRepo()) });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    const lista = dom.pobierz('zestawy-lista');
    assert.equal(lista.children.length, 1, 'propozycja z repozytorium widoczna na karcie');
    assert.match(lista.children[0].children[0].textContent, /3 stacji × 1 pytań/);
    assert.match(lista.children[0].children[0].textContent, /repozytorium: Podkowa Leśna/);
    assert.match(dom.pobierz('zestawy-status').textContent, /Repozytorium ma paczki/);
    kliknijPierwszyPrzyciskZestawu(dom);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra z paczki repozytorium wystartowała');
    assert.match(dom.pobierz('status').textContent, /bez modelu i bez Overpassa/);
    assert.match(dom.pobierz('status').textContent, /repozytorium/);
    assert.ok(atrap.wywolania.some((u) => u.includes('https://repo.przyklad/indeks.json')), 'fetch poszedł do skonfigurowanego źródła');
  } finally {
    atrap.przywroc();
  }
});

test('zestawy UI: adres nadpisany w pamięci telefonu wygrywa ze stałą z kodu (ADR 0020)', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [] }) });
  try {
    const pamiec = new Map([['okolica:repo-zestawow:url', 'https://przyklad.org/paczki/indeks.json'], ['okolica:konfig', KONFIG_TEST]]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(atrap.wywolania.some((u) => u.startsWith('https://przyklad.org/paczki/indeks.json')), 'fetch poszedł do nadpisanego źródła');
    assert.match(dom.pobierz('most-stan-repo').textContent, /nadpisany/, 'stan mostu mówi wprost, że adres jest nadpisany na tym telefonie');
    assert.match(dom.pobierz('zestawy-status').textContent, /Repozytorium jest puste/, 'pusty indeks = jawny komunikat, nie „brak paczek dla okolicy"');
  } finally {
    atrap.przywroc();
  }
});

/* -------- M9b/D2+D3: wysyłka na Drive po przyjęciu paczki (decyzja właściciela) -------- */

import { readFileSync as czytajPlik } from 'node:fs';

const KONFIG_WYSYLKA = JSON.stringify({
  schemat: 'konfig/1', kanon: '2026-09-10',
  konfig: { liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
});

function atrapaPost() {
  const posty = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url, opcje = {}) => {
    // Liczy się TYLKO wysyłka na most (text/plain); POST-y Overpass (urlencoded)
    // dostają 404 jak przed L18 — wtedy window.fetch nie istniało i pobierzSiec
    // degradowal się po cichu, a goły fetch łapał tylko wysyłkę.
    if (opcje.method === 'POST' && String(opcje.headers?.['Content-Type'] ?? '').startsWith('text/plain')) {
      posty.push({ url: String(url), opcje });
      return { ok: true, status: 200, json: async () => ({ ok: true, status: 'zaakceptowana' }), text: async () => '' };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  return { posty, przywroc: () => { globalThis.fetch = pierwotny; } };
}

// środek fixture paczka-ok.json — walidator pilnuje zgodności okolicy z pozycją
const POZYCJA_FIXTURE = { lat: 52.23178, lon: 21.01234 };

async function dojdzDoWklejenia(dom, pozycja = POZYCJA) {
  dom.kliknij('przycisk-dalej-pozycja');
  dom.ustawPozycje(String(pozycja.lat), String(pozycja.lon));
  dom.kliknij('przycisk-dalej-stacje');
  // Gdy test podstawia window.fetch, stacje liczą się ASYNCHRONICZNIE (pobranie
  // sieci w tle) — czekamy, aż STAN.stacje powstaną (pierścień po 404), zanim
  // ruszymy dalej; bez fetch wszystko jest synchroniczne i czekanie jest puste.
  await new Promise((r) => setTimeout(r, 30));
  dom.kliknij('przycisk-dalej-prompt');
  dom.kliknij('przycisk-dalej-paczka');
  assert.equal(dom.pobierz('ekran-paczka').hidden, false, 'ekran wklejania widoczny');
}

test('wysyłka Drive: przyjęcie paczki wysyła TO-zestaw/1 POST-em text/plain', async () => {
  const atrap = atrapaPost();
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_WYSYLKA], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoWklejenia(dom, POZYCJA_FIXTURE);
    const paczka = JSON.parse(czytajPlik(new URL('../test/fixtures/paczka-ok.json', import.meta.url)), 'utf8');
    dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.posty.length, 1, 'dokładnie jedna wysyłka po przyjęciu');
    const { url, opcje } = atrap.posty[0];
    assert.equal(url, 'https://most.przyklad/exec');
    assert.equal(opcje.method, 'POST');
    assert.equal(opcje.headers['Content-Type'], 'text/plain;charset=utf-8', 'bez preflightu CORS');
    const cialo = JSON.parse(opcje.body);
    assert.equal(cialo.schemat, 'TO-zestaw/1');
    assert.equal(cialo.stacje.length, 3, 'stacje z bieżącej sesji');
    assert.equal(cialo.meta.liczbaStacji, 3);
    assert.equal(cialo.meta.pytaniaNaStacje, 1);
    assert.match(cialo.meta.przegladZrodel, /oczekuje przeglądu — jakość rozstrzygają łapki/, 'kandydat wychodzi ze znacznikiem (bez sesji przeglądu właściciela, 2026-09-11)');
    assert.equal(cialo.kontener.schemat, 'TO-paczka/2');
    assert.match(dom.pobierz('status').textContent, /WYSŁANA na Drive/);
  } finally {
    atrap.przywroc();
  }
});

test('wysyłka Drive: adres z kodu — przyjęcie paczki wysyła bez wpisu w pamięci (ADR 0020)', async () => {
  const atrap = atrapaPost();
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_WYSYLKA]]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoWklejenia(dom, POZYCJA_FIXTURE);
    const paczka = JSON.parse(czytajPlik(new URL('../test/fixtures/paczka-ok.json', import.meta.url)), 'utf8');
    dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.posty.length, 1, 'przyjęcie paczki wysyła na adres z kodu');
    assert.equal(atrap.posty[0].url, DOMYSLNY_URL_MOSTU, 'cel wysyłki to stała wdrożeniowa');
    assert.equal(JSON.parse(atrap.posty[0].opcje.body).schemat, 'TO-zestaw/1');
    assert.match(dom.pobierz('status').textContent, /WYSŁANA na Drive/);
  } finally {
    atrap.przywroc();
  }
});

/* -------- M9b/D4: most Drive jako repozytorium (indeks z `id`, próba połączenia) -------- */

function atrapaFetchDrive({ indeks, plik }) {
  const wywolania = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url) => {
    wywolania.push(String(url));
    const tekst = String(url).includes('akcja=paczka') ? plik : indeks;
    if (tekst == null) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => tekst };
  };
  return { wywolania, przywroc: () => { globalThis.fetch = pierwotny; } };
}

function wpisDrive() {
  // ten sam wpis co w R6, ale ze wskazaniem Drive: `id` zamiast `plik`
  const { plik: _plik, ...meta } = indeksZPropozycja().wpisy[0];
  return { ...meta, id: 'drive-id-001' };
}

const INDEKS_DRIVE = () => JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [wpisDrive()] });

test('Drive: wpis z `id` na karcie, a kliknięcie pobiera paczkę przez ?akcja=paczka&id=…', async () => {
  const atrap = atrapaFetchDrive({ indeks: INDEKS_DRIVE(), plik: JSON.stringify(plikZRepo()) });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(dom.pobierz('zestawy-lista').children.length, 1, 'propozycja z Drive widoczna');
    kliknijPierwszyPrzyciskZestawu(dom);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(
      atrap.wywolania.includes('https://most.przyklad/exec?akcja=paczka&id=drive-id-001'),
      `adres pobrania paczki: ${atrap.wywolania.join(' ; ')}`,
    );
    assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra z paczki Drive wystartowała');
    assert.match(dom.pobierz('status').textContent, /repozytorium/);
  } finally {
    atrap.przywroc();
  }
});

/* -------- faktyczne tematy pytań + limit listy + sort po ocenach (właściciel 2026-09-11) -------- */

// setup węższy niż zapisany wpis: paczka ma pytania TYLKO z historii, ale stary
// wpis niosł listę dopuszczalnych [historia, przyroda, architektura] — dopasowanie
// odrzucało paczkę, choć pytań z „obcych" tematów w niej nie ma.
test('zestawy UI: stare wpisy z szeroką listą tematów dopasowują się po faktycznej zawartości pytań', async () => {
  const kontener = zapakujPaczke(paczkaMinimalna(), 'PYT/1.0');
  const KONFIG_WASKI = JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: {
      tryb: 'piesza', liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1, czasGryMin: 85,
      tematy: ['historia'], wiek: 'dorosli', jezyk: 'polski',
      karaRecznaS: 60, podklad: 'osm', promienM: 1000, kodGry: 'test',
    },
  });
  const pelny = wpisPelny(kontener);
  const pamiec = new Map([
    ['okolica:konfig', KONFIG_WASKI],
    [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [{ skrot: kontener.skrot, bajty: 900, ...metaWpisu(), data: '2026-09-06 09:00', kodGry: 'pierwsza' }] })],
    [kluczZestawu(kontener.skrot), JSON.stringify(pelny)],
  ]);
  const dom = await aplikacjaZZestawami({ pamiec });
  await dojdzDoPozycji(dom);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(dom.pobierz('zestawy-lista').children.length, 1, 'paczka pasuje: pytania decydują, nie lista dopuszczalna');
  const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
  assert.deepEqual(rejestr.wpisy[0].tematy, ['historia'], 'wpis rejestru przeszedł na faktyczne tematy');
  assert.deepEqual(JSON.parse(pamiec.get(kluczZestawu(kontener.skrot))).tematy, ['historia'], 'pełny wpis też niesie faktyczne tematy');
});

test('zestawy UI: lista pokazuje 3 najlepsze paczki, resztę po „Zobacz więcej paczek"', async () => {
  const paczkaN = (i) => { const p = paczkaMinimalna(); p.pytania[0].id = `s1p${i}`; p.pytania[0].tresc = `Pytanie numer ${i} z tej okolicy?`; return p; };
  const kontenery = [1, 2, 3, 4, 5].map((i) => zapakujPaczke(paczkaN(i), 'PYT/1.0'));
  const wpisy = kontenery.map((k, i) => ({ skrot: k.skrot, bajty: 900, ...metaWpisu(), data: `2026-09-0${i + 1} 09:00`, kodGry: 'gra' }));
  const pamiec = new Map([
    ['okolica:konfig', KONFIG_TEST],
    [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy })],
    ...kontenery.map((k) => [kluczZestawu(k.skrot), JSON.stringify(wpisPelny(k))]),
  ]);
  const dom = await aplikacjaZZestawami({ pamiec });
  await dojdzDoPozycji(dom);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(dom.pobierz('zestawy-lista').children.length, 3, 'bez rozwinięcia widać trzy paczki');
  const wiecej = dom.pobierz('przycisk-zestawy-wiecej');
  assert.equal(wiecej.hidden, false, 'przycisk „Zobacz więcej paczek" jest widoczny');
  assert.equal(wiecej.textContent, 'Zobacz więcej paczek');
  dom.kliknij('przycisk-zestawy-wiecej');
  assert.equal(dom.pobierz('zestawy-lista').children.length, 5, 'rozwinięcie pokazuje wszystkie paczki');
  assert.equal(dom.pobierz('przycisk-zestawy-wiecej').textContent, 'Zobacz mniej paczek');
  dom.kliknij('przycisk-zestawy-wiecej');
  assert.equal(dom.pobierz('zestawy-lista').children.length, 3, 'zwinięcie wraca do trzech');
  assert.equal(dom.pobierz('przycisk-zestawy-wiecej').textContent, 'Zobacz więcej paczek');
});

test('zestawy UI: paczki z największą liczbą ocen pozytywnych są pierwsze (właściciel 2026-09-11)', async () => {
  const wpisOceniony = (plus, minus, data) => ({
    ...wpisDrive(), id: `drive-${plus}`, data,
    oceny: { glosow: plus + minus, plus, minus, uzytaWGrach: 1 },
  });
  const indeks = { schemat: 'TO-indeks/1', wpisy: [wpisOceniony(7, 2, '2026-09-04 10:00'), wpisOceniony(2, 3, '2026-09-05 10:00')] };
  const atrap = atrapaFetchDrive({ indeks: JSON.stringify(indeks), plik: JSON.stringify(plikZRepo()) });
  try {
    const kontener = zapakujPaczke(paczkaMinimalna(), 'PYT/1.0');
    const pamiec = new Map([
      ['okolica:konfig', KONFIG_TEST],
      ['okolica:repo-zestawow:url', 'https://most.przyklad/exec'],
      [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [{ skrot: kontener.skrot, bajty: 900, ...metaWpisu(), data: '2026-09-06 09:00', kodGry: 'gra' }] })],
      [kluczZestawu(kontener.skrot), JSON.stringify(wpisPelny(kontener))],
    ]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    const wiersze = dom.pobierz('zestawy-lista').children;
    assert.equal(wiersze.length, 3, 'trzy pasujące paczki: dwie z repo, jedna z telefonu');
    assert.match(wiersze[0].children[0].textContent, /repozytorium/, 'pierwsza paczka pochodzi z repozytorium');
    assert.ok(/78% 👍/.test(wiersze[0].textContent), 'pierwsza paczka ma 7 ocen pozytywnych na 9 głosów (78% 👍)');
    assert.ok(/40% 👍/.test(wiersze[1].textContent), 'druga paczka ma 2 oceny pozytywne na 5 głosów (40% 👍)');
    assert.match(wiersze[2].children[0].textContent, /z tego telefonu/, 'paczka bez ocen jest ostatnia mimo najnowszej daty');
    assert.equal(dom.pobierz('przycisk-zestawy-wiecej').hidden, true, 'przy trzech paczkach przycisk „więcej" jest schowany');
  } finally {
    atrap.przywroc();
  }
});

/* -------- propozycje paczek: raz po wejściu, potem dopiero po 250 m (właściciel 2026-09-11) -------- */

test('zestawy UI: fixy GPS co 3 metry NIE odświeżają propozycji — dopiero 250 m zmienia', async () => {
  const atrap = atrapaFetchDrive({ indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [] }), plik: null });
  try {
    const dom = await aplikacjaZZestawami({ pamiec: new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]) });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom); // pierwsze wejście na ekran + fix → jedno sprawdzenie
    await new Promise((r) => setTimeout(r, 30));
    const poWejsciu = atrap.wywolania.length;
    assert.ok(poWejsciu >= 1, 'przy wejściu na ekran paczki są sprawdzane');

    // GPS dryfuje o 3 metry — kroki poniżej progu 250 m mają być CICHE
    await dom.ustawPozycje(String(POZYCJA.lat + 0.00001), String(POZYCJA.lon));
    await dom.ustawPozycje(String(POZYCJA.lat + 0.00002), String(POZYCJA.lon - 0.00001));
    await dom.ustawPozycje(String(POZYCJA.lat - 0.00002), String(POZYCJA.lon + 0.00002));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.wywolania.length, poWejsciu, 'trzy fixy po ~3 m: zero dodatkowych zapytań o indeks');

    // przejście 250 m (≈0.00225° szerokości) — teraz sprawdzamy ponownie
    await dom.ustawPozycje(String(POZYCJA.lat + 0.00225), String(POZYCJA.lon));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.wywolania.length, poWejsciu + 1, 'fix ≥ 250 m od ostatniego sprawdzenia: dokładnie jedno nowe zapytanie');
  } finally {
    atrap.przywroc();
  }
});
