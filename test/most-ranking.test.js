/**
 * Most Drive: `GET ?akcja=ranking` (ADR 0019 aneks 2026-09-12f).
 *
 * Test WYKONUJE tekst `docs/setup/apps-script-repo-paczek.gs` (LESSONS L33) na
 * atrapie Drive — to jedyna droga, żeby sprawdzić kod, który w terenie biega
 * w Apps Script. Pilnujemy trzech rzeczy naraz:
 *
 *   1. KTO wchodzi do rankingu: tylko gracze z profilem na Drive (ADR 0021) —
 *      gracz dodany bez potwierdzenia nie ma profilu i wypada;
 *   2. CO wychodzi: same sumy (punkty, poprawne, pytania) — żadnych dat,
 *      miejsc ani geohashów per gra (ADR 0013/0019 pkt 3);
 *   3. ODPORNOŚĆ: uszkodzony plik gry/profilu nie psuje rankingu, a rezygnacja
 *      bez ani jednej odpowiedzi nie wchodzi do sum.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { uruchomMost } from './helpers/most.js';

/** Profil na Drive = „zarejestrowany gracz” (ADR 0021, akcja `profil-ustaw`). */
function zarejestruj(most, pseudonim, pin = '1234') {
  const wynik = most.ustawProfil({ pseudonim, pin });
  assert.equal(wynik.ok, true, `profil „${pseudonim}”: ${wynik.blad ?? 'ok'}`);
  return wynik;
}

/**
 * Gra hot-seat w kształcie, jaki wysyła telefon (`gra-hotseat`, ADR 0026 aneks):
 * zdarzenia dojście+odpowiedź na stację, konfiguracja bez paczki.
 */
function wyslijHotseat(most, { odcisk, gracze, stacje = 2, poprawne = {}, czas = '2026-09-01T10:00:00.000Z' }) {
  const zdarzenia = [];
  gracze.forEach((g) => {
    for (let stacja = 1; stacja <= stacje; stacja += 1) {
      zdarzenia.push({ schemat: 'RO-zdarzenie/1', graczId: g.id, typ: 'dojscie', stacjaId: stacja, dane: { czasOdcinkaMs: 60_000 } });
      const poprawna = (poprawne[g.id] ?? []).includes(stacja);
      zdarzenia.push({ schemat: 'RO-zdarzenie/1', graczId: g.id, typ: 'odpowiedz', stacjaId: stacja, dane: { poprawna, punktyRazem: poprawna ? 1 : 0, czasOdcinkaMs: 30_000 } });
    }
  });
  const wynik = most.przyjmijGreHotseat({
    schemat: 'RO-gra-hotseat/1',
    odcisk,
    tryb: 'hotseat',
    konfiguracja: { liczbaStacji: stacje, pytaniaNaStacje: 1, wiek: 'dorosli', tematy: ['historia'], miejsce: 'Podkowa Leśna', geohash5: 'u3qb8' },
    gracze,
    zdarzenia,
    wyslano: czas,
  });
  assert.equal(wynik.ok, true, `hot-seat „${odcisk}”: ${wynik.blad ?? 'ok'}`);
  return wynik;
}

test('ranking: sumuje wszystkie gry i tylko graczy z profilem na Drive', () => {
  const { most } = uruchomMost();
  zarejestruj(most, 'Ala');
  zarejestruj(most, 'Bartek');
  // „Celina” gra, ale NIE ma profilu (dodana, gdy Drive milczał) — wypada.

  wyslijHotseat(most, {
    odcisk: 'gra-1',
    gracze: [{ id: 'g-1', pseudonim: 'Ala' }, { id: 'g-2', pseudonim: 'Bartek' }, { id: 'g-3', pseudonim: 'Celina' }],
    poprawne: { 'g-1': [1, 2], 'g-2': [1], 'g-3': [1, 2] },
  });
  wyslijHotseat(most, {
    odcisk: 'gra-2',
    gracze: [{ id: 'g-1', pseudonim: 'Ala' }],
    poprawne: { 'g-1': [2] },
  });

  const ranking = most.rankingi();
  assert.equal(ranking.schemat, 'RO-ranking/2');
  const poPseudo = Object.fromEntries(ranking.gracze.map((g) => [g.pseudonim, g]));
  assert.deepEqual(Object.keys(poPseudo).sort(), ['Ala', 'Bartek'], 'tylko gracze z profilem (Celina bez profilu)');
  assert.deepEqual(poPseudo.Ala, { pseudonim: 'Ala', punkty: 3, poprawne: 3, pytania: 4 }, 'Ala: 2 gry, 3 poprawne z 4 pytań');
  assert.deepEqual(poPseudo.Bartek, { pseudonim: 'Bartek', punkty: 1, poprawne: 1, pytania: 2 }, 'Bartek: 1 gra');
});

test('ranking: pseudonim z profilu rządzi pisownią, a gracz spoza profili nie tworzy wiersza', () => {
  const { most } = uruchomMost();
  zarejestruj(most, 'Ala');
  // Ta sama osoba zapisana z innej wielkości liter trafia do TEGO SAMEGO wiersza
  // (id profilu normalizuje wielkość liter), a wyświetlamy pisownię z profilu.
  wyslijHotseat(most, {
    odcisk: 'gra-a',
    gracze: [{ id: 'g-1', pseudonim: 'ALA' }],
    poprawne: { 'g-1': [1] },
  });
  wyslijHotseat(most, {
    odcisk: 'gra-b',
    gracze: [{ id: 'g-1', pseudonim: 'ala' }, { id: 'g-2', pseudonim: 'Zenon' }],
    poprawne: { 'g-1': [1, 2], 'g-2': [1, 2] },
  });
  const ranking = most.rankingi();
  assert.equal(ranking.gracze.length, 1, 'jeden wiersz dla Ali, Zenon bez profilu wypada');
  assert.deepEqual(ranking.gracze[0], { pseudonim: 'Ala', punkty: 3, poprawne: 3, pytania: 4 });
});

test('ranking: odpowiedź nie zawiera niczego poza pseudonimem i licznikami (prywatność)', () => {
  const { most } = uruchomMost();
  zarejestruj(most, 'Ala');
  wyslijHotseat(most, { odcisk: 'gra-p', gracze: [{ id: 'g-1', pseudonim: 'Ala' }], poprawne: { 'g-1': [1] } });

  const tekst = JSON.stringify(most.rankingi());
  for (const pole of ['miejsce', 'geohash', 'Podkowa', 'lat', 'lon', 'u3qb8', 'utworzono', 'tryb', 'data']) {
    assert.equal(tekst.includes(pole), false, `ranking nie niesie „${pole}”`);
  }
  const wiersz = most.rankingi().gracze[0];
  assert.deepEqual(Object.keys(wiersz).sort(), ['poprawne', 'pseudonim', 'punkty', 'pytania']);
});

test('ranking: rezygnacja bez odpowiedzi nie wchodzi, uszkodzony plik nie psuje całości', () => {
  const { most, pliki } = uruchomMost();
  zarejestruj(most, 'Ala');
  zarejestruj(most, 'Bartek');

  // Gra wieloosobowa z rezygnacją: Bartek wychodzi bez ani jednej odpowiedzi,
  // Ala odpowiada — tylko Ala ma wynik do policzenia.
  const zalozona = most.zalozGre({
    tryb: 'trasa',
    organizator: { pseudonim: 'Ala' },
    // Konfiguracja i zestaw wieloosobowy mają własne wymagania (geohash8 hosta,
    // kontener TO-paczka/2 + metadane) — kształt jak w `most-gra-cycle.test.js`.
    konfiguracja: {
      liczbaStacji: 1, pytaniaNaStacje: 2, wiek: 'dorosli', tematy: ['historia'],
      miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', geohash8: 'u3qb8g0m',
    },
    zestaw: {
      stacje: [{ id: 1, opis: 'stacja 1', punkt: { lat: 52.23, lon: 21.01 }, pytania: [1, 2] }],
      kontener: { schemat: 'TO-paczka/2', stacje: [] },
      meta: { utworzono: '2026-09-07 12:00', autor: 'test' },
    },
  });
  assert.equal(zalozona.ok, true, `założenie gry: ${zalozona.blad ?? 'ok'}`);
  const dolaczony = most.dolaczDoGry({ kod: zalozona.gra.kod, pseudonim: 'Bartek' });
  assert.equal(dolaczony.ok, true, `dołączenie: ${dolaczony.blad ?? 'ok'}`);
  const start = most.startGryMulti({ kod: zalozona.gra.kod, organizatorId: zalozona.gra.gracze[0].id });
  assert.equal(start.ok, true, `start: ${start.blad ?? 'ok'}`);
  // Identyfikatory bierzemy z gry, nie z palca: organizator to Ala, dołączony
  // (zwrócony przez `dolaczDoGry`) to Bartek — zamiana miejsc dałaby w rankingu
  // wiersz tego, kto zrezygnował, a to jest właśnie pułapka tego testu.
  const ala = dolaczony.gra.gracze[0].id;
  const bartek = dolaczony.graczId;
  const zdarzenie = (graczId, typ, stacjaId, dane = {}) => ({ zdarzenie: { schemat: 'RO-zdarzenie/1', kod: zalozona.gra.kod, graczId, typ, stacjaId, dane } });
  const rezygnacja = most.przyjmijZdarzenie(zdarzenie(bartek, 'rezygnacja', null, { powod: 'test' }));
  assert.equal(rezygnacja.ok, true, `rezygnacja: ${rezygnacja.blad ?? 'ok'}`);
  assert.equal(most.przyjmijZdarzenie(zdarzenie(ala, 'dojscie', 1)).ok, true, 'dojście Ali');
  const ostatnia = most.przyjmijZdarzenie(zdarzenie(ala, 'odpowiedz', 1, { poprawna: true, punktyRazem: 2 }));
  assert.equal(ostatnia.ok, true, `odpowiedź Ali: ${ostatnia.blad ?? 'ok'}`);
  assert.equal(ostatnia.stan, 'zakonczona', 'rezygnacja g-1 + odpowiedź g-2 = gra kompletna (auto-koniec)');

  const ranking = most.rankingi();
  const poPseudo = Object.fromEntries(ranking.gracze.map((g) => [g.pseudonim, g]));
  assert.deepEqual(Object.keys(poPseudo), ['Ala'], 'Bartek zrezygnował bez odpowiedzi — nie ma wiersza');
  // Punkty to punkty GRY: 2 z odpowiedzi + 3 premii za 1. miejsce (ADR 0027
  // część B pkt 5) — ranking sumuje to, co gra naprawdę przyznała, a nie same
  // odpowiedzi. Hot-seat premii nie ma (gracze idą razem), dlatego w innych
  // testach tego pliku widać same punkty z odpowiedzi.
  assert.deepEqual(poPseudo.Ala, { pseudonim: 'Ala', punkty: 5, poprawne: 1, pytania: 1 });

  // Uszkodzony plik w katalogu gier zakończonych nie może wywrócić rankingu.
  const uszkodzony = [...pliki.values()].find((p) => p.nazwa.startsWith('gra-') && p.tresc.includes('"zakonczona"'));
  assert.ok(uszkodzony, 'gra trafiła do katalogu gier zakończonych');
  assert.equal([...uszkodzony.rodzice][0].nazwa, 'okolica-gry-zakonczone', 'ranking czyta katalog gier zakończonych');
  const kopia = uszkodzony.tresc;
  uszkodzony.tresc = '{to nie jest JSON';
  const odporny = most.rankingi();
  uszkodzony.tresc = kopia; // porządek dla kolejnych asercji
  assert.equal(odporny.schemat, 'RO-ranking/2', 'ranking odpowiedział mimo uszkodzonego pliku');
  assert.deepEqual(odporny.gracze, [], 'uszkodzona gra wypada po cichu — zero wyjątku dla telefonu');
});

test('ranking: doGet z akcją ranking odpowiada tekstem JSON w schemacie RO-ranking/2', () => {
  const { most } = uruchomMost();
  const odp = most.doGet({ parameter: { akcja: 'ranking' } });
  assert.equal(odp.tekst.includes('RO-ranking/2'), true, 'schemat w odpowiedzi');
  assert.deepEqual(JSON.parse(odp.tekst), { schemat: 'RO-ranking/2', gracze: [] }, 'pusty ranking to pusta lista, nie błąd');
});
