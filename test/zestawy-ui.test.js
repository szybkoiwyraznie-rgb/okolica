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
const KONFIG_TEST = JSON.stringify({
  schemat: 'konfig/1',
  konfig: {
    tryb: 'piesza', liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1,
    tematy: TEMATY_DOMYSLNE, wiek: 'dorosli', jezyk: 'polski', wspolpraca: 'zespol',
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

async function dojdzDoPozycji(dom) {
  dom.kliknij('przycisk-dalej-pozycja');
  dom.pobierz('setup-lat').value = String(POZYCJA.lat);
  dom.pobierz('setup-lon').value = String(POZYCJA.lon);
  dom.kliknij('przycisk-ustaw-reczne');
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
  // bez skonfigurowanego źródła Drive karta mówi wprost, że repozytorium nie podłączone
  await new Promise((r) => setTimeout(r, 20));
  assert.match(dom.pobierz('zestawy-status').textContent, /nie jest podłączone/);
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
  dom.pobierz('setup-lat').value = String(POZYCJA.lat);
  dom.pobierz('setup-lon').value = String(POZYCJA.lon);
  dom.kliknij('przycisk-ustaw-reczne');
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

test('zestawy UI: własny URL repozytorium wygrywa z domyślnym (switchability, ADR 0017 pkt 6)', async () => {
  const atrap = atrapaFetch({ indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [] }) });
  try {
    const pamiec = new Map([['okolica:repo-zestawow:url', 'https://przyklad.org/paczki/indeks.json'], ['okolica:konfig', KONFIG_TEST]]);
    const dom = await aplikacjaZZestawami({ pamiec });
    await dojdzDoPozycji(dom);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(atrap.wywolania.some((u) => u.startsWith('https://przyklad.org/paczki/indeks.json')), 'fetch poszedł do własnego źródła');
    assert.equal(dom.pobierz('pole-url-repo').value, 'https://przyklad.org/paczki/indeks.json', 'pole pokazuje aktywne źródło');
    assert.match(dom.pobierz('zestawy-status').textContent, /Repozytorium nie ma paczek/);
  } finally {
    atrap.przywroc();
  }
});
