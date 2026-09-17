/**
 * Testy przepływu M9/R3: karta propozycji paczek na ekranie pozycja i start
 * gry z gotową paczką (kryterium M9: druga gra bez modelu). Świeża atrapa DOM
 * i świeży import `app.js` na test (LESSONS: egzemplarze nie dzielą atrap).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { zainstalujDom } from './helpers/dom.js';
import { KLUCZ_REJESTRU, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY, kluczZestawu, skrotPaczki } from '../app/zestawy.js';
import { DOMYSLNY_URL_MOSTU } from '../app/most.js';
import { geohash } from '../app/geo.js';

const POZYCJA = { lat: 52.12303, lon: 20.74614 }; // Podkowa Leśna (geohash5 u33dc)
const GEOHASH5 = 'u3qb8'; // policzone z geo.js dla (52.12303, 20.74614)

const paczkaMinimalna = () => ({
  protokol: 'PYT/1.1',
  okolica: { lat: POZYCJA.lat, lon: POZYCJA.lon, promienM: 1000, miejsce: 'Podkowa Leśna' },
  wiek: 'dorosli',
  tematy: ['historia'],
  jezyk: 'polski',
  utworzono: '2026-09-06 10:00',
  pytania: [{
    id: 's1p1', stacja: 1, temat: 'historia', tresc: 'Co powstało pierwsze?',
    odpowiedzi: ['kościół', 'szkoła', 'park', 'stacja'], poprawna: 1,
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

function wpisPelny(paczka) {
  return {
    schemat: SCHEMAT_LOKALNY,
    stacje: [{ id: 1, lat: 52.1235, lon: 20.7455 }, { id: 2, lat: 52.1245, lon: 20.7475 }, { id: 3, lat: 52.1255, lon: 20.7495 }],
    paczka,
    ...metaWpisu(),
    data: '2026-09-06 09:00',
    kodGry: 'pierwsza',
  };
}

function pamiecZZestawem(paczka) {
  const skrot = skrotPaczki(paczka);
  const pelny = wpisPelny(paczka);
  return new Map([
    ['okolica:konfig', KONFIG_TEST],
    [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [{ skrot, bajty: 900, ...metaWpisu(), data: '2026-09-06 09:00', kodGry: 'pierwsza' }] })],
    [kluczZestawu(skrot), JSON.stringify(pelny)],
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

/* -------- uwaga C1 (2026-09-17, ADR 0053): model AI nad wklejką i w paczce --------
 * Dwa z tych testów stoją PIERWSZE w pliku świadomie. Atrapa DOM jest globalna
 * (`globalThis.document` = ostatnio zainstalowany dom), a aplikacje
 * z poprzednich testów potrafią jeszcze dopisywać po bieżącym dokumencie
 * (praca w tle po przyjęciu paczki: status, kopia lokalna, preload paczek).
 * Uruchomione na końcu pliku łapały cudze renderowanie listy propozycji.
 * Trzeci — ten, który PRZYJMUJE paczkę (start gry) — stoi dalej, w sąsiedztwie
 * pozostałych testów wysyłki na Drive: przyjęcie paczki zostawia pracę w tle,
 * więc kolejność ma znaczenie.
 */

test('uwaga C1 (ADR 0053): znaczek modelu przy propozycji paczki — i tylko wtedy, gdy wpis go niesie', async () => {
  // Znaczek bierze się z `meta.model` wpisu indeksu (most robi Object.assign
  // z meta paczki). Wpis bez `model` nie dostaje znaczka: ekran wyboru nie
  // zgaduje modelu, a stare paczki wyglądają jak dotąd.
  const zModelem = atrapaFetchDrive({
    indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [{ ...wpisDrive(), model: 'chatgpt' }] }),
    plik: JSON.stringify(plikZRepo()),
  });
  const znaczekWWierszu = (dom) => [...dom.pobierz('zestawy-lista').children[0].children[0].children]
    .find((c) => c?.className === 'znaczek-modelu') ?? null;
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length === 1, 'propozycja z Drive');
    const znaczek = znaczekWWierszu(dom);
    assert.ok(znaczek, 'wpis z `model` pokazuje znaczek modelu przy propozycji');
    assert.equal(znaczek.getAttribute('aria-label'), 'Model: ChatGPT', 'znaczek nazywa model (ikona bez tekstu)');
    assert.equal(znaczek.className, 'znaczek-modelu');
    assert.equal(String(znaczek.children[0].tagName).toLowerCase(), 'img', 'znaczek to ikona z pliku właściciela (ADR 0053 aneks)');
    assert.ok(String(znaczek.children[0].src ?? '').startsWith('assets/ikony-modela/'), 'znaczek ładuje plik z assets/ (względna ścieżka)');
  } finally {
    zModelem.przywroc();
  }

  const bezModelu = atrapaFetchDrive({
    indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [wpisDrive()] }),
    plik: JSON.stringify(plikZRepo()),
  });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length === 1, 'propozycja z Drive');
    assert.equal(znaczekWWierszu(dom), null, 'wpis bez `model` nie dostaje znaczka (stare paczki bez zmian)');
  } finally {
    bezModelu.przywroc();
  }
});

/** Dotknięcie elementu atrapy (jeden nasłuch `click`, jak w przeglądarce). */
function dotknij(el) {
  const nasluchy = el.zdarzenia.click ?? [];
  assert.equal(nasluchy.length, 1, `element ${el.className} ma dokładnie jeden nasłuch click`);
  nasluchy[0]({ type: 'click', preventDefault() {} });
}

test('uwaga C1 (ADR 0053): cztery okrągłe ikony modeli nad wklejką — wybór opcjonalny, klikanie przełącza', async () => {
  // Właściciel (teren, 2026-09-17): nad polem wklejenia rząd czterech ikon —
  // Meta.ai, ChatGPT, Gemini, Claude. Domyślnie ŻADEN nie jest zaznaczony,
  // dotknięcie zaznacza, drugie odznacza, dotknięcie innego przełącza, a wybór
  // jest opcjonalny (nic nie blokuje wklejenia bez decyzji).
  const dom = await aplikacjaZZestawami();
  const pojemnik = dom.pobierz('wklejka-modele');
  assert.equal(pojemnik.children.length, 4, 'cztery modele nad wklejką');
  assert.deepEqual(pojemnik.children.map((b) => b.dataset.model), ['meta-ai', 'chatgpt', 'gemini', 'claude'],
    'klucze modeli są stabilne (nie nazwy handlowe)');
  const stan = () => pojemnik.children.map((b) => b.getAttribute('aria-pressed'));
  assert.deepEqual(stan(), ['false', 'false', 'false', 'false'], 'domyślnie nic nie jest wybrane');
  assert.deepEqual(pojemnik.children.map((b) => b.getAttribute('aria-label')),
    ['Model: Meta.ai', 'Model: ChatGPT', 'Model: Gemini', 'Model: Claude'],
    'każda ikona ma etykietę dla czytnika ekranu (ikona bez tekstu)');
  assert.ok(pojemnik.children.every((b) => b.children.length === 1 && String(b.children[0].tagName).toLowerCase() === 'img'),
    'każda ikona to img z pliku (ADR 0053 aneks 2026-09-17)');
  assert.ok(pojemnik.children.every((b) => String(b.children[0].src ?? '').startsWith('assets/ikony-modela/') && !/^https?:/.test(String(b.children[0].src ?? ''))),
    'ścieżki ikon względne z repo — zero CDN (ADR 0001 pkt 1, ADR 0002)');

  dotknij(pojemnik.children[2]); // Gemini
  assert.deepEqual(stan(), ['false', 'false', 'true', 'false'], 'dotknięcie zaznacza model');
  dotknij(pojemnik.children[2]);
  assert.deepEqual(stan(), ['false', 'false', 'false', 'false'], 'drugie dotknięcie odznacza — wybór zostaje pusty');
  dotknij(pojemnik.children[1]);
  dotknij(pojemnik.children[3]);
  assert.deepEqual(stan(), ['false', 'false', 'false', 'true'], 'dotknięcie innego PRZEŁĄCZA wybór (zawsze najwyżej jeden)');
});

test('I.b: paczka z telefonu NIE jest pokazywana — propozycje tylko z repozytorium', async () => {
  const paczka = paczkaMinimalna();
  const dom = await aplikacjaZZestawami({ pamiec: pamiecZZestawem(paczka) });
  assert.equal(dom.pobierz('zestawy-karta').hidden, true, 'przed pozycją karta nie straszy');
  await dojdzDoPozycji(dom);
  assert.equal(dom.pobierz('zestawy-karta').hidden, false, 'po pozycji karta jest widoczna');
  assert.equal(dom.pobierz('zestawy-lista').children.length, 0, 'rejestr telefonu nie wchodzi na listę (I.b)');
  // adres Drive jest w kodzie (ADR 0020); tu bez fetch próba pada — karta mówi wprost,
  // że repozytorium jest niedostępne
  await new Promise((r) => setTimeout(r, 20));
  assert.match(dom.pobierz('zestawy-status').textContent, /Repozytorium niedostępne/);
});

test('zestawy UI: druga gra w tej samej okolicy startuje bez modelu i bez Overpassa', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify(indeksZPropozycja()), plik: JSON.stringify(plikZRepo()) });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'propozycja z repozytorium');
    kliknijPierwszyPrzyciskZestawu(dom);
    await czekajNa(dom, () => dom.pobierz('ekran-gra').hidden === false, 'gra z paczki');
    assert.match(dom.pobierz('status').textContent, /bez modelu i bez Overpassa/);
    assert.match(dom.pobierz('status').textContent, /3 stacji/);
    const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
    assert.equal(rejestr.wpisy.length, 1, 'start gry zapisał cichą kopię lokalną (cache, nie propozycja)');
  } finally {
    atrap.przywroc();
  }
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
    schemat: 'TO-zestaw/2',
    protokol: 'PYT/1.1',
    meta,
    stacje: [{ lat: 52.1235, lon: 20.7455, opis: 'plac' }, { lat: 52.1245, lon: 20.7475, opis: 'park' }, { lat: 52.1255, lon: 20.7495, opis: 'skwer' }],
    paczka: paczkaMinimalna(),
  };
};

/**
 * app.js czyta `window.fetch` (LESSONS L18), więc atrapa podstawiona na
 * globalThis musi trafić też do okna atrapy DOM — po utworzeniu dom.
 */
function podlaczFetch(dom) {
  dom.window.fetch = globalThis.fetch;
}

/** Czeka na warunek w atrapie (żądania mostu są asynchroniczne). */
async function czekajNa(dom, warunek, opis, maksMs = 5000) {
  const start = Date.now();
  while (!warunek()) {
    if (Date.now() - start > maksMs) {
      throw new Error(`${opis} nie nastąpiło w ${maksMs} ms — status: ${dom.pobierz('zestawy-status').textContent}`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
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
    // Zgłoszenie terenowe P (2026-09-13): nazwa paczki zaczyna się od miejsca,
    // bez przedrostka „🌍 repozytorium:" (wszystkie paczki na karcie są z repo).
    assert.match(lista.children[0].children[0].textContent, /^Podkowa Leśna ·/, 'nazwa od miejsca');
    assert.doesNotMatch(lista.children[0].children[0].textContent, /repozytorium:/, 'przedrostek źródła zniknął');
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

/* -------- awarie mostu: prawdziwy powód zamiast jednego „niedostępne” (2026-09-12) -------- */

/** Atrapa fetch dla awarii: `kroki` to kolejne odpowiedzi (funkcje albo wyjątki). */
function atrapaFetchKroki(kroki) {
  const wywolania = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const krok = kroki[Math.min(wywolania.length, kroki.length - 1)];
    wywolania.push(String(url));
    return krok();
  };
  return { wywolania, przywroc: () => { globalThis.fetch = pierwotny; } };
}

const odpowiedzTekst = (tekst) => async () => ({ ok: true, status: 200, text: async () => tekst });
const odpowiedzHttp = (status) => async () => ({ ok: false, status, text: async () => '' });
const bladSieci = () => async () => { throw new TypeError('Failed to fetch'); };

test('zestawy UI: pierwsze żądanie nie doszło — druga próba pokazuje paczki (zimny start mostu)', async () => {
  // Zgłoszenie właściciela 2026-09-12: panel mówił „Repozytorium niedostępne”,
  // choć paczki na Drive są. Najczęstszą przyczyną jest zimny start web app po
  // wdrożeniu — jedno ponowienie ma to leczyć, a nie ukrywać.
  globalThis.__OKOLICA_PONOWNA_PROBA_MS__ = 10; // przed importem app.js (stała modułu)
  const atrap = atrapaFetchKroki([bladSieci(), odpowiedzTekst(JSON.stringify(indeksZPropozycja()))]);
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => /Repozytorium ma paczki/.test(dom.pobierz('zestawy-status').textContent), 'lista po powtórce');
    // Wstępne pobieranie (właściciel 2026-09-13) dokłada żądanie PLIKU paczki, więc
    // powtórkę liczymy wśród żądań indeksu — tam należy ten pin.
    assert.equal(atrap.wywolania.filter((u) => u.includes('indeks.json')).length, 2,
      'dokładnie jedna powtórka żądania indeksu');
    assert.equal(dom.pobierz('zestawy-lista').children.length, 1, 'paczka z repozytorium na liście');
    assert.equal(dom.pobierz('most-stan-repo').classList.contains('bledy'), false,
      'udana próba nie zostawia ostrzeżenia w stanie mostu');
  } finally {
    atrap.przywroc();
    delete globalThis.__OKOLICA_PONOWNA_PROBA_MS__;
  }
});

test('zestawy UI: HTTP 403 z mostu — komunikat nazywa przyczynę i nie udaje pustego repo', async () => {
  const atrap = atrapaFetchKroki([odpowiedzHttp(403)]);
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => /Repozytorium niedostępne/.test(dom.pobierz('zestawy-status').textContent), 'komunikat awarii');
    const tekst = dom.pobierz('zestawy-status').textContent;
    assert.match(tekst, /HTTP 403/, 'przyczyna wprost (403 = wdrożenie bez dostępu „Każdy”)');
    assert.match(tekst, /repo\.przyklad/, 'w komunikacie jest host, do którego pytaliśmy — diagnostyka bez zgadywania');
    assert.ok(!/Repozytorium jest puste|nie ma paczek/.test(tekst), 'awaria nie udaje pustego repozytorium');
    assert.ok(dom.pobierz('most-stan-repo').textContent.includes('Ostatnia próba nie doszła'),
      'stan mostu mówi prawdę po nieudanej próbie („podłączony” to nie to samo co działające połączenie)');
    assert.ok(dom.pobierz('most-stan-repo').classList.contains('bledy'), 'awaria jest widoczna, nie szara');
  } finally {
    atrap.przywroc();
  }
});

test('zestawy UI: most odpowiedział nieczytelnie (HTML) — to nie jest „puste repo”', async () => {
  const atrap = atrapaFetchKroki([odpowiedzTekst('<html><body>Zaloguj się do konta Google</body></html>')]);
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => /nieczytelna odpowiedź/.test(dom.pobierz('zestawy-status').textContent), 'komunikat o nieczytelnej odpowiedzi');
    const tekst = dom.pobierz('zestawy-status').textContent;
    assert.match(tekst, /Repozytorium niedostępne \(nieczytelna odpowiedź/, 'odpowiedź bez sensu = awaria, nie „pusto”');
    assert.match(tekst, /Z01/, 'kod usterki mówi, CZEGO nie zrozumieliśmy (to nie jest JSON)');
    assert.ok(!/Repozytorium jest puste/.test(tekst), 'nieczytelna odpowiedź nie udaje pustego repozytorium');
    assert.match(dom.pobierz('most-stan-repo').textContent, /Z01 — To nie jest poprawny JSON/,
      'stan mostu niesie PEŁNY opis usterki — z nim da się coś zrobić bez zgadywania');
    assert.equal(atrap.wywolania.length, 1, 'odpowiedź nieczytelna = nie ma czego powtarzać (to nie sieć)');
  } finally {
    atrap.przywroc();
  }
});

test('zestawy UI: pobranie paczki z repozytorium bez sieci mówi, CO się nie udało', async () => {
  const atrap = atrapaFetchKroki([
    odpowiedzTekst(JSON.stringify(indeksZPropozycja())), // indeks się udaje
    bladSieci(),                                        // plik paczki już nie
  ]);
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'propozycja z repozytorium');
    kliknijPierwszyPrzyciskZestawu(dom);
    await czekajNa(dom, () => /Nie udało się pobrać paczki/.test(dom.pobierz('status').textContent), 'status po nieudanym pobraniu');
    assert.match(dom.pobierz('status').textContent, /brak połączenia/, 'status nazywa przyczynę (LESSONS L6)');
  } finally {
    atrap.przywroc();
  }
});

test('zestawy UI: wysypka NASZEGO czytania odpowiedzi nie udaje awarii mostu (m12-86)', async () => {
  // Zgłoszenie właściciela 2026-09-12: „most na pewno działa (gra, paczka z AI),
  // to musiał być problem ze sprawdzaniem paczek”. Poprzedni kod łapał jednym
  // `.catch(() => …)` CAŁY łańcuch — także wyjątek we własnym renderze na
  // poprawnej odpowiedzi — i meldował „Repozytorium niedostępne”. Ten test
  // wymusza taką wysypkę i pilnuje, że komunikat mówi prawdę o obu stronach.
  const wywolania = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url) => {
    wywolania.push(String(url));
    // Odpowiedź z opóźnieniem: między synchronicznym renderem lokalnych paczek
    // (przy wejściu na pozycję) a przyjęciem indeksu mamy czas podmienić jedną
    // metodę atrapy DOM i wymusić wysypkę NASZEGO kodu na POPRAWNEJ odpowiedzi.
    await new Promise((r) => setTimeout(r, 40));
    return { ok: true, status: 200, text: async () => JSON.stringify(indeksZPropozycja()) };
  };
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    dom.pobierz('zestawy-lista').replaceChildren = () => { throw new Error('atrapa: wybuch w renderze listy'); };
    await czekajNa(dom, () => /błąd aplikacji/.test(dom.pobierz('zestawy-status').textContent), 'komunikat o naszym błędzie');
    const tekst = dom.pobierz('zestawy-status').textContent;
    assert.match(tekst, /Repozytorium odpowiedziało/, 'mówimy wprost, że most ODPOWIEDZIAŁ');
    assert.match(tekst, /atrapa: wybuch w renderze listy/, 'komunikat niesie nasz konkretny błąd, nie ogólnik');
    assert.ok(!/Repozytorium niedostępne/.test(tekst), 'nasz błąd nie udaje awarii mostu');
    assert.ok(!/nieczytelna odpowiedź/.test(tekst), 'nasz błąd nie udaje też nieczytelnej odpowiedzi mostu');
    assert.equal(wywolania.length, 1, 'naszego błędu nie „leczymy” powtórką żądania');
    assert.equal(dom.pobierz('most-stan-repo').classList.contains('bledy'), false,
      'skoro most odpowiedział, stan mostu nie jest czerwony');
  } finally {
    globalThis.fetch = pierwotny;
  }
});

test('zestawy UI: awaria mówi, KTÓRE wdrożenie pytaliśmy (diagnostyka kilku wdrożeń)', async () => {
  // Właściciel wdraża kolejne wersje web app; przy „Edit deployment” adres
  // zostaje, przy „New deployment” — zmienia się. Gdy paczki się nie pokazują,
  // pierwsze pytanie brzmi: czy aplikacja pyta o TO wdrożenie? Dlatego komunikat
  // pokazuje prefiks identyfikatora (ADR 0020: adres nie jest sekretem).
  const url = 'https://script.google.com/macros/s/AKfycbxlScMHr8bR1DSq7cPPr9914A1ur3J9bBRpHNEKV3YFmCcYr37dAN6jpq2zVWuwECGu/exec';
  const atrap = atrapaFetchKroki([odpowiedzHttp(404)]);
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', url]]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => /Repozytorium niedostępne/.test(dom.pobierz('zestawy-status').textContent), 'komunikat awarii');
    assert.match(dom.pobierz('zestawy-status').textContent, /script\.google\.com\/s\/AKfycbxlSc…\/exec/,
      'w komunikacie jest rozpoznawalny adres wdrożenia, nie tylko host');
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

function atrapaPost({ odpowiedz = { ok: true, status: 'zaakceptowana' } } = {}) {
  const posty = [];
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url, opcje = {}) => {
    // Liczy się TYLKO wysyłka na most (text/plain); POST-y Overpass (urlencoded)
    // dostają 404 jak przed L18 — wtedy window.fetch nie istniało i pobierzSiec
    // degradowal się po cichu, a goły fetch łapał tylko wysyłkę.
    if (opcje.method === 'POST' && String(opcje.headers?.['Content-Type'] ?? '').startsWith('text/plain')) {
      posty.push({ url: String(url), opcje });
      return { ok: true, status: 200, json: async () => odpowiedz, text: async () => '' };
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

test('wysyłka Drive: przyjęcie paczki wysyła TO-zestaw/2 POST-em text/plain', async () => {
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
    assert.equal(cialo.schemat, 'TO-zestaw/2');
    assert.equal(cialo.stacje.length, 3, 'stacje z bieżącej sesji');
    assert.equal(cialo.meta.liczbaStacji, 3);
    assert.equal(cialo.meta.pytaniaNaStacje, 1);
    assert.match(cialo.meta.przegladZrodel, /oczekuje przeglądu — jakość rozstrzygają łapki/, 'kandydat wychodzi ze znacznikiem (bez sesji przeglądu właściciela, 2026-09-11)');
    assert.equal(cialo.paczka.pytania.length, 3, 'ciało POST niesie jawną paczkę pytań (ADR 0050)');
    assert.match(dom.pobierz('status').textContent, /Paczka przyjęta i wysłana na Drive:/);
    assert.doesNotMatch(dom.pobierz('status').textContent, /nieznana/,
      'most bez pola `nazwa` (stara wersja skryptu) nie wpycha w UI zdania o „nieznanym" pliku');
    assert.equal(typeof cialo.meta.ulica, 'string', 'meta kandydata niesie `ulica` (ADR 0048) — nazwę pliku robi most');
  } finally {
    atrap.przywroc();
  }
});

test('wysyłka Drive: potwierdzenie cytuje nazwę pliku zwróconą przez most (ADR 0048)', async () => {
  const nazwa = 'Podkowa-Leśna_ul-Bukowa_2026-09-15_0941_3pyt_wiek-12_600m_Q.zestaw.json';
  const atrap = atrapaPost({ odpowiedz: { ok: true, status: 'zaakceptowana', nazwa, id: 'ID9' } });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_WYSYLKA], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoWklejenia(dom, POZYCJA_FIXTURE);
    const paczka = JSON.parse(czytajPlik(new URL('../test/fixtures/paczka-ok.json', import.meta.url)), 'utf8');
    dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
    await new Promise((r) => setTimeout(r, 30));
    // Aplikacja NIE liczy nazwy po swojemu — cytuje tę z mostu: jedno źródło
    // prawdy, czyli rozjazd widać, zamiast go ukryć (LESSONS L58).
    const wyjety = nazwa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(dom.pobierz('status').textContent, new RegExp(`wysłana na Drive jako „${wyjety}"`),
      `status: ${dom.pobierz('status').textContent}`);
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
    assert.equal(JSON.parse(atrap.posty[0].opcje.body).schemat, 'TO-zestaw/2');
    assert.match(dom.pobierz('status').textContent, /Paczka przyjęta i wysłana na Drive:/);
  } finally {
    atrap.przywroc();
  }
});

test('uwaga C1 (ADR 0053): wybrany model jedzie z paczką na Drive, brak wyboru nic nie dopisuje', async () => {
  const atrap = atrapaPost();
  const paczka = JSON.parse(czytajPlik(new URL('../test/fixtures/paczka-ok.json', import.meta.url)), 'utf8');
  const metaZPostu = (i) => JSON.parse(atrap.posty[i].opcje.body).meta;
  try {
    // 1. Bez wyboru: paczka leci jak dotąd, bez pola `model` (brak danych,
    //    nie „nieznany model” — żadnej atrapy w pliku ani w indeksie).
    const pamiec1 = new Map([['okolica:konfig', KONFIG_WYSYLKA], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom1 = await aplikacjaZZestawami({ pamiec: pamiec1 });
    podlaczFetch(dom1);
    await dojdzDoWklejenia(dom1, POZYCJA_FIXTURE);
    dom1.wklej('pole-odpowiedz', JSON.stringify(paczka));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.posty.length, 1, 'paczka bez wyboru też jedzie na Drive');
    assert.equal('model' in metaZPostu(0), false, 'bez wyboru pola `model` w meta NIE MA');

    // 2. Z wyborem: dotknięcie ikony przed wklejeniem znaczy model w paczce.
    const pamiec2 = new Map([['okolica:konfig', KONFIG_WYSYLKA], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom2 = await aplikacjaZZestawami({ pamiec: pamiec2 });
    podlaczFetch(dom2);
    await dojdzDoWklejenia(dom2, POZYCJA_FIXTURE);
    dotknij(dom2.pobierz('wklejka-modele').children[1]); // ChatGPT
    dom2.wklej('pole-odpowiedz', JSON.stringify(paczka));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(atrap.posty.length, 2, 'druga paczka też jedzie na Drive');
    assert.equal(metaZPostu(1).model, 'chatgpt', 'wybór modelu zapisuje się z paczką (ADR 0053 pkt 2)');
    assert.equal(metaZPostu(1).liczbaStacji, 3, 'reszta meta bez zmian');
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
test('zestawy: start aplikacji ujednolica tematy lokalnych wpisów do faktycznej zawartości pytań', async () => {
  // I.b: dopasowanie lokalne nie ma już UI (lista tylko z repo), ale migracja
  // startowa działa dalej — ten test pilnuje samego ujednolicenia, bez pozycji.
  const paczka = paczkaMinimalna();
  const skrot = skrotPaczki(paczka);
  const pelny = wpisPelny(paczka);
  const pamiec = new Map([
    ['okolica:konfig', KONFIG_TEST],
    [KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [{ skrot, bajty: 900, ...metaWpisu(), data: '2026-09-06 09:00', kodGry: 'pierwsza' }] })],
    [kluczZestawu(skrot), JSON.stringify(pelny)],
  ]);
  await aplikacjaZZestawami({ pamiec }); // sam start: migracja bez wchodzenia na pozycję
  const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
  assert.deepEqual(rejestr.wpisy[0].tematy, ['historia'], 'wpis rejestru przeszedł na faktyczne tematy');
  assert.deepEqual(JSON.parse(pamiec.get(kluczZestawu(skrot))).tematy, ['historia'], 'pełny wpis też niesie faktyczne tematy');
});

test('zestawy UI: lista pokazuje 3 najlepsze paczki, resztę po „Zobacz więcej paczek"', async () => {
  const wpisy = [1, 2, 3, 4, 5].map((i) => ({ ...indeksZPropozycja().wpisy[0], skrot: `feedbe0${i}`, plik: `podkowa-${i}.zestaw.json`, data: `2026-09-0${i} 09:00` }));
  const atrap = atrapaFetch({ indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy }), plik: null });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length === 3, 'trzy najlepsze paczki');
    const wiecej = dom.pobierz('przycisk-zestawy-wiecej');
    assert.equal(wiecej.hidden, false, 'przycisk „Zobacz więcej paczek" jest widoczny');
    assert.equal(wiecej.textContent, 'Zobacz więcej paczek');
    dom.kliknij('przycisk-zestawy-wiecej');
    assert.equal(dom.pobierz('zestawy-lista').children.length, 5, 'rozwinięcie pokazuje wszystkie paczki');
    assert.equal(dom.pobierz('przycisk-zestawy-wiecej').textContent, 'Zobacz mniej paczek');
    dom.kliknij('przycisk-zestawy-wiecej');
    assert.equal(dom.pobierz('zestawy-lista').children.length, 3, 'zwinięcie wraca do trzech');
    assert.equal(dom.pobierz('przycisk-zestawy-wiecej').textContent, 'Zobacz więcej paczek');
  } finally {
    atrap.przywroc();
  }
});

test('zestawy UI: paczki z największą liczbą ocen pozytywnych są pierwsze (właściciel 2026-09-11)', async () => {
  const wpisOceniony = (plus, minus, data) => ({
    ...wpisDrive(), id: `drive-${plus}`, data,
    oceny: { glosow: plus + minus, plus, minus, uzytaWGrach: 1 },
  });
  const indeks = { schemat: 'TO-indeks/1', wpisy: [wpisOceniony(7, 2, '2026-09-04 10:00'), wpisOceniony(2, 3, '2026-09-05 10:00')] };
  const atrap = atrapaFetchDrive({ indeks: JSON.stringify(indeks), plik: JSON.stringify(plikZRepo()) });
  try {
    const pamiec = new Map([
      ['okolica:konfig', KONFIG_TEST],
      ['okolica:repo-zestawow:url', 'https://most.przyklad/exec'],
    ]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    const wiersze = dom.pobierz('zestawy-lista').children;
    assert.equal(wiersze.length, 2, 'dwie pasujące paczki z repo (I.b: telefon nie wchodzi na listę)');
    // Zgłoszenie terenowe P (2026-09-13): wiersz zaczyna się OD MIEJSCA —
    // przedrostka „🌍 repozytorium:" nie ma (źródło paczek na tej karcie jest
    // jedno, a I.b pilnuje `wiersze.length`: kopie z telefonu nie wchodzą).
    assert.match(wiersze[0].children[0].textContent, /^Podkowa Leśna ·/, 'nazwa pierwszej paczki zaczyna się od miejsca');
    assert.ok(/78% 👍/.test(wiersze[0].textContent), 'pierwsza paczka ma 7 ocen pozytywnych na 9 głosów (78% 👍)');
    assert.ok(/40% 👍/.test(wiersze[1].textContent), 'druga paczka ma 2 oceny pozytywne na 5 głosów (40% 👍)');
    assert.equal(dom.pobierz('przycisk-zestawy-wiecej').hidden, true, 'przy dwóch paczkach przycisk „więcej" jest schowany');
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

/* -------- właściciel 2026-09-13: paczka schodzi w tle, a czekanie jest widoczne -------- */

const URL_INDEKSU_TEST = 'https://repo.przyklad/indeks.json';
const PLIK_PACZKI_TEST = 'podkowa.zestaw.json';
const pamiecZRepo = () => new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', URL_INDEKSU_TEST]]);

test('wstępne pobieranie: widoczna paczka schodzi z repozytorium, zanim gracz kliknie', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify(indeksZPropozycja()), plik: JSON.stringify(plikZRepo()) });
  try {
    const dom = await aplikacjaZZestawami({ pamiec: pamiecZRepo() });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'lista propozycji');
    await czekajNa(dom, () => atrap.wywolania.some((u) => u.includes(PLIK_PACZKI_TEST)),
      'plik paczki pobrany w tle, bez kliku');
    kliknijPierwszyPrzyciskZestawu(dom);
    await czekajNa(dom, () => dom.pobierz('ekran-gra').hidden === false, 'gra z paczki');
    assert.equal(atrap.wywolania.filter((u) => u.includes(PLIK_PACZKI_TEST)).length, 1,
      'klik NIE dokłada drugiego pobrania — bierze to samo, już rozpoczęte');
  } finally {
    atrap.przywroc();
  }
});

test('wstępne pobieranie sięga tylko po paczki WIDOCZNE na liście i nie zgłasza mostowi użycia', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify(indeksZPropozycja()), plik: JSON.stringify(plikZRepo()) });
  try {
    const dom = await aplikacjaZZestawami({ pamiec: pamiecZRepo() });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'lista propozycji');
    await czekajNa(dom, () => atrap.wywolania.some((u) => u.includes(PLIK_PACZKI_TEST)), 'paczka w tle');
    // Oceny i licznik „użyta w X grach" idą do mostu dopiero przy prawdziwym kliku (ADR 0028).
    assert.equal(atrap.wywolania.filter((u) => /akcja=(ocena|uzyj|zuzycie)/.test(u)).length, 0,
      'wstępne pobranie niczego nie zgłasza mostowi');
  } finally {
    atrap.przywroc();
  }
});

test('sygnał czekania: przycisk mówi „Ładuję paczkę…", status pulsuje i nie przyjmuje drugiego kliku', async () => {
  // Pobranie PLIKU wisi na naszej bramie — możemy zmierzyć stan ekranu w trakcie.
  const wywolania = [];
  let oddajPlik = null;
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url) => {
    wywolania.push(String(url));
    if (String(url).includes(PLIK_PACZKI_TEST)) await new Promise((r) => { oddajPlik = r; });
    const tekst = String(url).includes('indeks.json') ? JSON.stringify(indeksZPropozycja()) : JSON.stringify(plikZRepo());
    return { ok: true, status: 200, text: async () => tekst };
  };
  try {
    const dom = await aplikacjaZZestawami({ pamiec: pamiecZRepo() });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'lista propozycji');
    await czekajNa(dom, () => wywolania.some((u) => u.includes(PLIK_PACZKI_TEST)), 'paczka wisi na bramie');
    assert.equal(dom.pobierz('zestawy-status').classList.contains('pulsuje'), false,
      'po odpowiedzi repozytorium sygnał czekania na karcie gasi się');
    const przycisk = kliknijPierwszyPrzyciskZestawu(dom);
    assert.equal(przycisk.textContent, '⏳ Ładuję paczkę…', 'przycisk mówi, co się dzieje (brzmienie z uwagi B1, 2026-09-14)');
    assert.equal(przycisk.disabled, true, 'drugiego kliku nie przyjmuje (podwójne pobranie i podwójne „użycie")');
    assert.equal(przycisk.classList.contains('pulsuje'), true, 'przycisk pulsuje w trakcie pobierania');
    assert.match(dom.pobierz('status').textContent, /Pobieram paczkę z repozytorium/, 'status nazywa pobieranie');
    assert.equal(dom.pobierz('status').classList.contains('pulsuje'), true, 'status pulsuje, gdy aplikacja czeka na sieć');
    oddajPlik();
    await czekajNa(dom, () => dom.pobierz('ekran-gra').hidden === false, 'gra po pobraniu paczki');
    assert.equal(dom.pobierz('status').classList.contains('pulsuje'), false,
      'po starcie gry pulsowanie gaśnie — stan „czekam" nie zostaje na ekranie');
    assert.equal(wywolania.filter((u) => u.includes(PLIK_PACZKI_TEST)).length, 1,
      'klik dołączył do wiszącego pobrania zamiast zaczynać nowe');
  } finally {
    globalThis.fetch = pierwotny;
  }
});

/* -------- uwaga B 2026-09-14 (dogrywka): paczka w papierowej kolejności startuje trasą -------- */

// POZYCJA = (52.12303, 20.74614): bliski ~68 m, środkowy ~188 m, daleki ~340 m.
const ST_BLISKI = { lat: 52.1235, lon: 20.7455, opis: 'bliski' };
const ST_SRODEK = { lat: 52.1245, lon: 20.7475, opis: 'środek' };
const ST_DALEKI = { lat: 52.1255, lon: 20.7495, opis: 'daleki' };

const paczkaTrojka = () => ({
  ...paczkaMinimalna(),
  pytania: [1, 2, 3].map((n) => ({
    id: `s${n}p1`, stacja: n, temat: 'historia', tresc: `Pytanie stacji ${n}?`,
    odpowiedzi: ['pierwsza', 'druga', 'trzecia', 'czwarta'], poprawna: ((n - 1) % 4) + 1,
    wyjasnienie: 'Bo tak mówią źródła.',
    zrodla: [{ url: 'https://przyklad.org/haslo', tytul: 'Hasło', sprawdzono: '2026-09-06' }],
    punkty: 10,
  })),
});

/** Paczka „sprzed poprawki": stacje od dalekiej, pytania przypięte do numerów autora. */
const plikZRepoWspak = () => {
  const plik = plikZRepo();
  plik.stacje = [ST_DALEKI, ST_SRODEK, ST_BLISKI];
  plik.paczka = paczkaTrojka();
  return plik;
};

test('uwaga B (dogrywka): gra z paczki wspak startuje trasą od pozycji, pytania idą za numerami', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify(indeksZPropozycja()), plik: JSON.stringify(plikZRepoWspak()) });
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_TEST], ['okolica:repo-zestawow:url', 'https://repo.przyklad/indeks.json']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoPozycji(dom);
    await czekajNa(dom, () => dom.pobierz('zestawy-lista').children.length > 0, 'propozycja z repozytorium');
    kliknijPierwszyPrzyciskZestawu(dom);
    await czekajNa(dom, () => dom.pobierz('ekran-gra').hidden === false, 'gra z paczki');
    assert.match(dom.pobierz('status').textContent, /bez modelu i bez Overpassa/);
    assert.match(dom.pobierz('status').textContent, /uporządkowano trasą/, 'gra mówi wprost, że przestawiła stacje');
    // Cicha kopia lokalna niesie grę JUŻ uporządkowaną: stacje i pytania.
    const rejestr = JSON.parse(pamiec.get(KLUCZ_REJESTRU));
    const zapis = JSON.parse(pamiec.get(kluczZestawu(rejestr.wpisy[0].skrot)));
    assert.deepEqual(zapis.stacje.map((s) => s.opis), ['bliski', 'środek', 'daleki'], 'stacja 1 to fizycznie najbliższa pozycji');
    assert.deepEqual(zapis.stacje.map((s) => s.id), [1, 2, 3]);
    const paczka = zapis.paczka;
    assert.equal(paczka.pytania.find((p) => p.id === 's3p1').stacja, 1, 'pytanie bliskiej stacji wisi na numerze 1');
    assert.equal(paczka.pytania.find((p) => p.id === 's1p1').stacja, 3, 'pytanie dalekiej stacji wisi na numerze 3');
    assert.equal(paczka.pytania.find((p) => p.id === 's3p1').poprawna, 3, 'numer poprawnej nietknięty — sprawdzanie działa');
    assert.equal(paczka.pytania.find((p) => p.id === 's3p1').tresc, 'Pytanie stacji 3?', 'treść pytania nietknięta');
  } finally {
    atrap.przywroc();
  }
});

/* -------- uwaga C2: wskaźnik czekania na ekranie wklejki (test OSTATNI w pliku) --------
 * Kolejność ma znaczenie: ten test zostawia aplikację z dokończoną pracą w tle
 * (przyjęcie paczki → kopia lokalna → preload paczek), a atrapa DOM jest
 * GLOBALNA — resztki piszące po dokumencie trafiłyby w następny test (tak
 * złapał to test C1 o znaczku modelu: pusta lista propozycji). Dlatego C2 stoi
 * na końcu: dowodzimy jego zachowania, a nie kolejności sąsiadów.
 */

test('uwaga C2 (2026-09-17): wklejka przyjęta → pulsujące „Łączę z siecią…” aż most odpowie', async () => {
  // Właściciel z telefonu: po wklejeniu odpowiedzi ekran milczał kilka sekund
  // (zapis paczki na Drive), więc wyglądał na zamrożony — „nie wiadomo co się
  // dzieje”. Wskaźnik czekania pokazuje się NATYCHMIAST po przyjęciu wklejki
  // i gaśnie dopiero wtedy, gdy most odpowie.
  const posty = [];
  let puść = null;
  const bramka = new Promise((rozwiaz) => { puść = rozwiaz; });
  const pierwotny = globalThis.fetch;
  globalThis.fetch = async (url, opcje = {}) => {
    if (opcje.method === 'POST' && String(opcje.headers?.['Content-Type'] ?? '').startsWith('text/plain')) {
      posty.push(String(url));
      await bramka; // most „wisi” — wskaźnik musi być widoczny przez cały czas
      return { ok: true, status: 200, json: async () => ({ ok: true, status: 'zaakceptowana' }), text: async () => '' };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  try {
    const pamiec = new Map([['okolica:konfig', KONFIG_WYSYLKA], ['okolica:repo-zestawow:url', 'https://most.przyklad/exec']]);
    const dom = await aplikacjaZZestawami({ pamiec });
    podlaczFetch(dom);
    await dojdzDoWklejenia(dom, POZYCJA_FIXTURE);
    const paczka = JSON.parse(czytajPlik(new URL('../test/fixtures/paczka-ok.json', import.meta.url)), 'utf8');
    dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
    assert.equal(posty.length, 1, 'paczka już leci na most');
    assert.match(dom.pobierz('wklejka-status').textContent, /Łączę z siecią/,
      'wskaźnik czekania pokazuje się NATYCHMIAST po przyjęciu wklejki');
    assert.equal(dom.pobierz('wklejka-status').classList.contains('pulsuje'), true,
      'wskaźnik pulsuje — czekanie na sieć ma być WIDAĆ (wzorzec ADR 0011)');
    puść();
    await new Promise((rozwiaz) => setTimeout(rozwiaz, 30));
    assert.equal(dom.pobierz('wklejka-status').classList.contains('pulsuje'), false,
      'po odpowiedzi mostu pulsowanie gaśnie');
    assert.equal(dom.pobierz('wklejka-status').textContent, '',
      'stan „czekam” nie zostaje na ekranie po zakończonej pracy');
    // Zanim `finally` odda `fetch` światu, pozwalamy aplikacji dosuszyć pracę
    // w tle (status, kopia lokalna, kolejne kroki). Bez tego resztki piszą po
    // BIEŻĄCYM dokumencie atrapy, a trafiają już w dokument następnego testu —
    // tak złapał to test C1 o znaczku modelu (pusta lista propozycji).
    await new Promise((rozwiaz) => setTimeout(rozwiaz, 100));
  } finally {
    globalThis.fetch = pierwotny;
  }
});
