/**
 * Testy `app/trwalosc.js` (M6/R2): snapshot stanu gry, walidacja z kodami T,
 * klucze, budżet i STRAŻNIK plaintextu — zapis nie może zawierać treści pytań.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUDZET_STANU_BAJTY,
  KLUCZ_AKTYWNEJ,
  KODY_TRWALOSCI,
  SCHEMAT_STANU,
  kluczStanu,
  oczyscKodGry,
  serializujStan,
  walidujStanSurowy,
  zbierajStan,
} from '../app/trwalosc.js';
import { WERSJA_PROTOKOLU } from '../app/protokol.js';
import { SCHEMAT_KONTENERA, zapakujPaczke } from '../app/kodowanie.js';
import { FAZY, SCHEMAT_ROZGRYWKI, nowaRozgrywka } from '../app/rozgrywka.js';
import { domyslnaKonfiguracja } from '../app/konfig.js';
import { stacjeProste } from '../app/stacje.js';

const KATALOG = join(import.meta.dirname, '..');
const PACZKA = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));
const SRODEK = { lat: 52.2297, lon: 21.0122 };

/** Kompletny, prawdziwy snapshot z części pochodzących z innych modułów. */
function snapshotReferencyjny(terazMs = 1_757_000_000_000) {
  const konfig = { ...domyslnaKonfiguracja(2), kodGry: 'waw-srodmiescie', promienM: 1000, liczbaStacji: 3 };
  const stacje = stacjeProste({ srodek: SRODEK, liczbaStacji: 3, promienM: 1000, ziarno: 'ziarno-testu' });
  const kontenerPaczki = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  const rozgrywka = nowaRozgrywka({ konfig, stacje, paczka: PACZKA, srodek: SRODEK, czasMs: terazMs, ziarno: 'ziarno-testu' });
  return { konfig, stacje, kontenerPaczki, rozgrywka };
}

test('trwałość: snapshot stan-gry/1 jest kompletny i niesie referencje, nie treści', () => {
  const czesci = snapshotReferencyjny();
  const snapshot = zbierajStan({ ...czesci, pozycja: { lat: SRODEK.lat, lon: SRODEK.lon, dokladnoscM: 12, zrodlo: 'gps' }, terazMs: 1_757_000_000_000 });
  assert.equal(snapshot.schemat, SCHEMAT_STANU);
  assert.equal(snapshot.wersjaProtokolu, WERSJA_PROTOKOLU);
  assert.equal(snapshot.zapisanoMs, 1_757_000_000_000);
  assert.equal(snapshot.ekran, 'gra', 'domyślny ekran snapshotu');
  assert.equal(snapshot.rozgrywka.schemat, SCHEMAT_ROZGRYWKI);
  assert.equal(snapshot.rozgrywka.faza, FAZY.przygotowanie);
  assert.equal(snapshot.kontenerPaczki.schemat, SCHEMAT_KONTENERA);
  assert.deepEqual(Object.keys(snapshot.pozycja).sort(), ['dokladnoscM', 'lat', 'lon', 'zrodlo'], 'pozycja zwężona do pól potrzebnych do wznowienia');
});

test('trwałość: STRAŻNIK — w zapisie nie ma ani słowa z plaintextu paczki (ADR 0007 pkt 4)', () => {
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000 });
  const tekst = serializujStan(snapshot);
  for (const pytanie of PACZKA.pytania) {
    assert.equal(tekst.includes(pytanie.tresc), false, `treść pytania ${pytanie.id} wyciekła do zapisu`);
    assert.equal(tekst.includes(pytanie.wyjasnienie), false, `wyjaśnienie ${pytanie.id} wyciekło do zapisu`);
    for (const odpowiedz of pytanie.odpowiedzi) {
      if (odpowiedz.length > 4) assert.equal(tekst.includes(odpowiedz), false, `odpowiedź „${odpowiedz}" wyciekła do zapisu`);
    }
  }
  assert.ok(tekst.includes(SCHEMAT_KONTENERA), 'zapis niesie kontener, nie paczkę');
});

test('trwałość: round-trip serializacja → walidacja odtwarza snapshot 1:1', () => {
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000 });
  const { stan, usterki } = walidujStanSurowy(serializujStan(snapshot));
  assert.deepEqual(usterki, []);
  assert.deepEqual(stan, snapshot);
});

test('trwałość: zbierajStan odmawia jawnie (TypeError) na brakach i śmieciach', () => {
  const czesci = snapshotReferencyjny();
  const teraz = { terazMs: 1 };
  assert.throws(() => zbierajStan({ ...czesci, ...teraz, konfig: null }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...teraz, stacje: [] }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...teraz, kontenerPaczki: PACZKA }), TypeError, 'PLAINTEXT paczki musi być odrzucony — przyjmujemy tylko kontener');
  assert.throws(() => zbierajStan({ ...czesci, ...teraz, rozgrywka: { schemat: 'rozgrywka/1' } }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, terazMs: NaN }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...teraz, pozycja: { lat: 'x', lon: 1 } }), TypeError);
  assert.throws(() => zbierajStan(), TypeError);
});

test('trwałość: walidujStanSurowy — każdy rodzaj uszkodzenia ma własny kod T', () => {
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000 });
  const baza = JSON.parse(serializujStan(snapshot));

  const przypadki = [
    ['nie JSON', 'nie-json{', ['T01']],
    ['pusty tekst', '', ['T01']],
    ['tablica zamiast obiektu', '[1,2]', ['T01']],
    ['obcy schemat', { ...baza, schemat: 'stan-gry/99' }, ['T02']],
    ['stara wersja protokołu', { ...baza, wersjaProtokolu: 'PYT/0.9' }, ['T03']],
    ['zepsuty czas zapisu', { ...baza, zapisanoMs: 'wczoraj' }, ['T08']],
    ['zepsuty konfig', { ...baza, konfig: { tryb: 42 } }, ['T06']],
    ['zepsute stacje', { ...baza, stacje: [{ id: 1 }] }, ['T09']],
    ['zepsuty kontener', { ...baza, kontenerPaczki: { schemat: SCHEMAT_KONTENERA, dane: '' } }, ['T05']],
    ['zepsuta rozgrywka', { ...baza, rozgrywka: { ...baza.rozgrywka, faza: 'kosmos' } }, ['T04']],
    ['zepsuta pozycja', { ...baza, pozycja: { lat: 'tu', lon: 'tam' } }, ['T10']],
    ['kilka usterek naraz', { ...baza, zapisanoMs: null, pozycja: 'śmieci' }, ['T08', 'T10']],
  ];
  for (const [opis, surowe, kody] of przypadki) {
    const tekst = typeof surowe === 'string' ? surowe : JSON.stringify(surowe);
    const { stan, usterki } = walidujStanSurowy(tekst);
    assert.equal(stan, null, `${opis}: stan musi być null (atomowość jak w walidujPaczke)`);
    assert.deepEqual(usterki.map((u) => u.kod), kody, opis);
    for (const u of usterki) assert.ok(u.komunikat.length > 10, `${opis}: komunikat dla człowieka`);
  }

  // pozycja null jest POPRAWNA (gra wznowiona bez fixa — start z konfiguracji)
  const bezPozycji = walidujStanSurowy(JSON.stringify({ ...baza, pozycja: null }));
  assert.deepEqual(bezPozycji.usterki, []);
  assert.ok(bezPozycji.stan);
});

test('trwałość: budżet 2 MB — walidacja i serializacja odmawiają z kodem T07', () => {
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1 });
  const rozdety = { ...snapshot, dziennikRozgrywki: 'x'.repeat(BUDZET_STANU_BAJTY) };
  assert.throws(() => serializujStan(rozdety), (e) => e.kod === 'T07');
  const { stan, usterki } = walidujStanSurowy(JSON.stringify(rozdety));
  assert.equal(stan, null);
  assert.deepEqual(usterki.map((u) => u.kod), ['T07']);
  assert.ok(KODY_TRWALOSCI.T07.includes('2 MB'), 'komunikat mówi o budżecie');
});

test('trwałość: klucze — oczyscKodGry jak nazwa pliku z J4, wszystkie pod okolica:*', () => {
  assert.equal(oczyscKodGry('WAW-Śródmieście!'), 'waw-rdmiecie', 'polskie znaki wypadają (policzone, nie zgadnięte — L21)');
  assert.equal(oczyscKodGry('Moja Gra 2026'), 'mojagra2026');
  assert.equal(oczyscKodGry('   '), 'gra', 'pusty kod → bezpieczny fallback');
  assert.equal(oczyscKodGry(null), 'gra');
  assert.equal(oczyscKodGry('a'.repeat(40)).length, 24, 'maksymalnie 24 znaki');
  assert.equal(kluczStanu('Moja Gra 2026'), 'okolica:gra:mojagra2026');
  assert.equal(kluczStanu('WAW-Śródmieście!'), 'okolica:gra:waw-rdmiecie', 'jak w nazwiePlikuPaczki z J4');
  assert.equal(KLUCZ_AKTYWNEJ, 'okolica:gra-aktywna');
  for (const klucz of [kluczStanu('x'), KLUCZ_AKTYWNEJ]) {
    assert.ok(klucz.startsWith('okolica:'), `${klucz}: czyszczenie danych z ekranu prywatności musi go obejmować`);
  }
});
