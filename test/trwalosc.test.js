/**
 * Testy `app/trwalosc.js` (M6/R2 + M7/P2): snapshot stanu gry, walidacja
 * z kodami T, klucze, budżet, STRAŻNIK plaintextu — zapis nie może zawierać
 * treści pytań — oraz historia gier: skróty `historia-gra/1`, idempotencja
 * po kluczu, limit wpisów i atomowa walidacja z kodami H.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUDZET_STANU_BAJTY,
  KLUCZ_AKTYWNEJ,
  KLUCZ_HISTORII,
  KODY_TRWALOSCI,
  LIMIT_HISTORII,
  SCHEMAT_HISTORII,
  SCHEMAT_STANU,
  SCHEMAT_WPISU_HISTORII,
  dodajWpisHistorii,
  kluczStanu,
  nowaHistoria,
  oczyscKodGry,
  serializujStan,
  skrotGry,
  walidujHistorieSurowa,
  walidujStanSurowy,
  zbierajStan,
} from '../app/trwalosc.js';
import { WERSJA_PROTOKOLU } from '../app/protokol.js';
import { SCHEMAT_KONTENERA, zapakujPaczke } from '../app/kodowanie.js';
import { FAZY, SCHEMAT_ROZGRYWKI, nowaRozgrywka, podsumowanie } from '../app/rozgrywka.js';
import { geohash } from '../app/geo.js';
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
  const snapshot = zbierajStan({ ...czesci, pozycja: { lat: SRODEK.lat, lon: SRODEK.lon, dokladnoscM: 12, zrodlo: 'gps' }, terazMs: 1_757_000_000_000, zegarMs: 12_345 });
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
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000, zegarMs: 12_345 });
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
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000, zegarMs: 12_345 });
  const { stan, usterki } = walidujStanSurowy(serializujStan(snapshot));
  assert.deepEqual(usterki, []);
  assert.deepEqual(stan, snapshot);
});

test('trwałość: zbierajStan odmawia jawnie (TypeError) na brakach i śmieciach', () => {
  const czesci = snapshotReferencyjny();
  const terazZ = { terazMs: 1, zegarMs: 1 };
  assert.throws(() => zbierajStan({ ...czesci, terazMs: 1 }), TypeError, 'brak zegarMs = odmowa (kotwica rebazy jest obowiązkowa)');
  assert.throws(() => zbierajStan({ ...czesci, ...terazZ, konfig: null }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...terazZ, stacje: [] }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...terazZ, kontenerPaczki: PACZKA }), TypeError, 'PLAINTEXT paczki musi być odrzucony — przyjmujemy tylko kontener');
  assert.throws(() => zbierajStan({ ...czesci, ...terazZ, rozgrywka: { schemat: 'rozgrywka/1' } }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, terazMs: NaN }), TypeError);
  assert.throws(() => zbierajStan({ ...czesci, ...terazZ, pozycja: { lat: 'x', lon: 1 } }), TypeError);
  assert.throws(() => zbierajStan(), TypeError);
});

test('trwałość: walidujStanSurowy — każdy rodzaj uszkodzenia ma własny kod T', () => {
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1_757_000_000_000, zegarMs: 12_345 });
  const baza = JSON.parse(serializujStan(snapshot));

  const przypadki = [
    ['nie JSON', 'nie-json{', ['T01']],
    ['pusty tekst', '', ['T01']],
    ['tablica zamiast obiektu', '[1,2]', ['T01']],
    ['obcy schemat', { ...baza, schemat: 'stan-gry/99' }, ['T02']],
    ['stara wersja protokołu', { ...baza, wersjaProtokolu: 'PYT/0.9' }, ['T03']],
    ['zepsuty czas zapisu', { ...baza, zapisanoMs: 'wczoraj' }, ['T08']],
    ['zepsuty zegar sesji', { ...baza, zegarMs: null }, ['T08']],
    ['zepsuty konfig', { ...baza, konfig: { tryb: 42 } }, ['T06']],
    ['zepsute stacje', { ...baza, stacje: [{ id: 1 }] }, ['T09']],
    ['zepsuty kontener', { ...baza, kontenerPaczki: { schemat: SCHEMAT_KONTENERA, dane: '' } }, ['T05']],
    ['zepsuta rozgrywka', { ...baza, rozgrywka: { ...baza.rozgrywka, faza: 'kosmos' } }, ['T04']],
    ['zepsuta pozycja', { ...baza, pozycja: { lat: 'tu', lon: 'tam' } }, ['T10']],
    ['pusty ekran', { ...baza, ekran: '' }, ['T11']],
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
  const snapshot = zbierajStan({ ...snapshotReferencyjny(), terazMs: 1, zegarMs: 1 });
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

/* ======== M7/P2: historia gier — skrót, prywatność, idempotencja, kody H ======== */

test('historia: skrotGry — pełny skrót (historia-gra/1) BEZ treści pytań i BEZ współrzędnych', () => {
  const { konfig, stacje, rozgrywka } = snapshotReferencyjny();
  const skrot = skrotGry({
    rozgrywka, konfig, stacje,
    podsumowanie: podsumowanie(rozgrywka),
    miejsce: '  Warszawa Śródmieście  ',
    terazMs: 1_757_000_000_000,
  });
  assert.equal(skrot.schemat, SCHEMAT_WPISU_HISTORII);
  assert.equal(skrot.klucz, 'waw-srodmiescie', 'klucz = oczyszczony kod gry (idempotencja wpisu)');
  assert.equal(skrot.data, new Date(1_757_000_000_000).toISOString());
  assert.equal(skrot.miejsce, 'Warszawa Śródmieście', 'nazwa miejsca przycięta i bez białych znaków');
  assert.equal(skrot.geohash6, geohash(SRODEK.lat, SRODEK.lon, 6), 'geohash6 środka — ten sam rząd co klucz cache sieci');
  assert.equal(skrot.tryb, konfig.tryb);
  assert.deepEqual(skrot.tematy, konfig.tematy);
  assert.equal(skrot.liczbaGraczy, 2);
  assert.equal(skrot.liczbaStacji, 3);
  assert.equal(skrot.zwyciezca, rozgrywka.gracze[0].imie, 'gra bez odpowiedzi: ranking otwiera pierwszy gracz (sort stabilny)');
  assert.equal(skrot.przerwana, false);
  assert.equal(Number.isFinite(skrot.punktyRazem) && Number.isFinite(skrot.czasGryS), true, 'liczby z podsumowania()');

  // PRYWATNOŚĆ (ADR 0010 pkt 1, ADR 0013): skrót, nie treść — ani pytań, ani współrzędnych
  const tekst = JSON.stringify(skrot);
  assert.equal(tekst.includes('52.2297'), false, 'szerokość środka wyciekła do historii');
  assert.equal(tekst.includes('21.0122'), false, 'długość środka wyciekła do historii');
  assert.equal(Object.keys(skrot).includes('lat') || Object.keys(skrot).includes('lon'), false, 'pole współrzędnych w wpisie');
  for (const pytanie of PACZKA.pytania) {
    assert.equal(tekst.includes(pytanie.tresc), false, `treść pytania ${pytanie.id} wyciekła do historii`);
  }

  // ręczne zakończenie: znacznik przerwanej gry; brak miejsca → null (nie pusty string)
  const przerwany = skrotGry({ rozgrywka, konfig, stacje, podsumowanie: podsumowanie(rozgrywka), terazMs: 1_757_000_000_000, przerwana: true });
  assert.equal(przerwany.przerwana, true);
  assert.equal(przerwany.miejsce, null);
});

test('historia: skrotGry odmawia niekompletnych danych (TypeError — jak zbierajStan)', () => {
  const { konfig, stacje, rozgrywka } = snapshotReferencyjny();
  const pod = podsumowanie(rozgrywka);
  assert.throws(() => skrotGry({ rozgrywka, konfig, stacje, terazMs: 1 }), TypeError, 'brak podsumowania');
  assert.throws(() => skrotGry({ rozgrywka, konfig, stacje, podsumowanie: pod }), TypeError, 'brak terazMs');
  assert.throws(() => skrotGry({ rozgrywka, konfig, stacje, podsumowanie: pod, terazMs: 1, miejsce: 42 }), TypeError, 'miejsce nie-string');
  assert.throws(() => skrotGry({ rozgrywka: null, konfig, stacje, podsumowanie: pod, terazMs: 1 }), TypeError, 'brak rozgrywki');
});

test('historia: dodajWpisHistorii — zastępuje po klucz, dokłada na koniec, limit 50, niezmiennikowo', () => {
  const { konfig, stacje, rozgrywka } = snapshotReferencyjny();
  const pod = podsumowanie(rozgrywka);
  const T1 = Date.parse('2026-09-01T10:00:00Z');
  const wpis = (kodGry, terazMs) => skrotGry({ rozgrywka, konfig: { ...konfig, kodGry }, stacje, podsumowanie: pod, terazMs });

  let historia = nowaHistoria();
  assert.deepEqual(historia, { schemat: SCHEMAT_HISTORII, wpisy: [] }, 'punkt startu');

  historia = dodajWpisHistorii(historia, wpis('gra-a', T1));
  const kopia = structuredClone(historia);
  historia = dodajWpisHistorii(historia, wpis('gra-a', T1 + 86_400_000)); // ten sam klucz = ta sama gra
  assert.equal(historia.wpisy.length, 1, 'dokończona przerwana gra ZASTĘPUJE wpis — bez dubla');
  assert.equal(historia.wpisy[0].data, new Date(T1 + 86_400_000).toISOString());
  assert.equal(kopia.wpisy.length, 1, 'historia wejściowa nietknięta…');
  assert.equal(kopia.wpisy[0].data, new Date(T1).toISOString(), '…i jej wpis też — zero mutacji in-place');

  for (let i = 0; i <= 50; i++) historia = dodajWpisHistorii(historia, wpis(`g${i}`, T1 + i * 3_600_000));
  assert.equal(historia.wpisy.length, LIMIT_HISTORII, 'jawny limit: najstarsze wpisy wypadają');
  assert.equal(historia.wpisy.at(-1).klucz, 'g50', 'najnowszy na końcu');
  assert.equal(historia.wpisy[0].klucz, 'g1', '„gra-a" i „g0" wypadły jako najstarsze');
});

test('historia: walidujHistorieSurowa — round-trip 1:1 i kody H01–H04 (atomowa)', () => {
  const { konfig, stacje, rozgrywka } = snapshotReferencyjny();
  const wpis = skrotGry({ rozgrywka, konfig, stacje, podsumowanie: podsumowanie(rozgrywka), terazMs: 1_757_000_000_000 });
  const historia = dodajWpisHistorii(nowaHistoria(), wpis);
  const tekst = JSON.stringify(historia);

  const ok = walidujHistorieSurowa(tekst);
  assert.deepEqual(ok.usterki, []);
  assert.deepEqual(ok.historia, historia, 'round-trip odtwarza historię 1:1');
  assert.equal(KLUCZ_HISTORII, 'okolica:historia', 'przedrostek okolica: — dwustopniowe kasowanie danych łapie historię');

  const zle = [
    [null, 'H01'],
    ['', 'H01'],
    ['{', 'H01'],
    ['[]', 'H01'],
    [JSON.stringify({ schemat: 'historia/2', wpisy: [] }), 'H02'],
    [JSON.stringify({ schemat: SCHEMAT_HISTORII }), 'H03'],
    [JSON.stringify({ schemat: SCHEMAT_HISTORII, wpisy: Array.from({ length: LIMIT_HISTORII + 1 }, () => wpis) }), 'H03'],
    [JSON.stringify({ schemat: SCHEMAT_HISTORII, wpisy: [{ ...wpis, klucz: 42 }] }), 'H04'],
    [JSON.stringify({ schemat: SCHEMAT_HISTORII, wpisy: [wpis, { schemat: SCHEMAT_WPISU_HISTORII }] }), 'H04'],
  ];
  for (const [surowe, kod] of zle) {
    const wynik = walidujHistorieSurowa(surowe);
    assert.equal(wynik.historia, null, `atomowa odmowa przy ${kod}`);
    assert.deepEqual(wynik.usterki.map((u) => u.kod), [kod]);
    assert.match(wynik.usterki[0].komunikat, /\S/, 'komunikat, nie goły kod');
    assert.ok(KODY_TRWALOSCI[kod], `${kod} jest w rejestrze`);
  }
});
