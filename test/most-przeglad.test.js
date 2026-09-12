/**
 * Przegląd całego mostu: KAŻDA funkcja z `.gs` zostaje wywołana choć raz, żeby
 * niezadeklarowany identyfikator nie przeżył do wdrożenia. Od 2026-09-11 most
 * nie ma sesji przeglądu paczek (decyzja właściciela) — poniżej strażnik,
 * że procedura naprawdę znikła, a nie tylko „nie jest wołana".
 *
 * LESSONS L33: literówka `wZaakceptowanych` zamiast `wZaakceptowane` dała graczom
 * Z07 na paczce, która leżała w katalogu zaakceptowanych — przeżyła, bo żaden
 * test nie wykonywał ścieżki, która tę zmienną czytała. Ten test wykonuje każdą
 * funkcję mostu i wyłapuje `X is not defined`.
 *
 * Test NIE ocenia poprawności wyników (od tego są `most-paczka` i
 * `most-gra-cycle`) — sprawdza tylko, że wywołanie nie pada na nieistniejącą
 * nazwie. Błędy typów z brakujących argumentów są spodziewane i pomijane.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uruchomMost, zestawPrzykladowy, idPoNazwie, tekstOdpowiedzi } from './helpers/most.js';

/**
 * Globalne nazwy środowiska Apps Script, których nie ma w Node. Atrapa
 * wstrzykuje usługi jako parametry fabryki, więc ta lista obejmuje tylko to,
 * czego Apps Script daje sam z siebie — dopisanie tu czegokolwiek wymaga
 * uzasadnienia, bo każde wejście osłabia przegląd.
 */
const WBUDOWANE_APPS_SCRIPT = new Set([]);

function przegladaj() {
  const { funkcje } = uruchomMost();
  const niezadeklarowane = [];
  for (const nazwa of funkcje) {
    // Świeża atrapa na funkcję: przegląd nie może zależeć od tego, co poprzednie
    // wywołanie zostawiło na dysku.
    const { most } = uruchomMost();
    for (const argument of [undefined, {}]) {
      try {
        most[nazwa](argument);
      } catch (blad) {
        const tekst = String((blad && blad.message) || blad);
        const trafienie = tekst.match(/(\w+) is not defined/);
        if (!trafienie) continue; // TypeError z brakujących pól argumentu — spodziewany
        if (WBUDOWANE_APPS_SCRIPT.has(trafienie[1])) continue;
        niezadeklarowane.push(`${nazwa}(): ${trafienie[1]}`);
      }
    }
  }
  return { funkcje, niezadeklarowane: [...new Set(niezadeklarowane)] };
}

test('most: każda funkcja .gs daje się wywołać bez niezadeklarowanej nazwy', () => {
  const { funkcje, niezadeklarowane } = przegladaj();

  // Przegląd ma sens tylko, jeśli objął cały plik — inaczej po cichu maleje.
  assert.ok(funkcje.length >= 40, `przegląd objął ${funkcje.length} funkcji (oczekiwałem ≥ 40)`);
  for (const nazwa of ['doGet', 'doPost', 'paczkaPrzezId', 'zalozGre', 'przyjmijGreHotseat']) {
    assert.equal(funkcje.includes(nazwa), true, `przegląd nie objął ${nazwa}`);
  }

  assert.deepEqual(
    niezadeklarowane,
    [],
    'te funkcje czytają nazwę, której w skrypcie nie ma (literówka?): ' + niezadeklarowane.join(', '),
  );
});

test('most: paczka ląduje w zaakceptowanych bez maila i bez strony przeglądu (decyzja właściciela 2026-09-11)', () => {
  const { most, pliki, wyslaneMaile } = uruchomMost();
  const przyjeta = most.przyjmijKandydata(zestawPrzykladowy());
  assert.equal(przyjeta.ok, true, `przyjęcie: ${JSON.stringify(przyjeta)}`);
  assert.equal(przyjeta.status, 'zaakceptowana', 'status mówi wprost: zaakceptowana od razu');

  // Plik leży w zaakceptowanych — z niego indeks i pobranie.
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);
  const rodzice = [...pliki.get(idPliku).rodzice].map((f) => f.nazwa);
  assert.ok(rodzice.includes('okolica-paczki-zaakceptowane'), `plik od razu w katalogu zaakceptowanych (rodzice: ${rodzice.join(', ')})`);

  // Żadnych maili — właściciel przegląda katalogi sam, gdy chce.
  assert.equal(wyslaneMaile.length, 0, 'właściciel NIE dostaje maila o paczce');

  // Strona przeglądu i akcje zatwierdzania zniknęły z mostu całkowicie.
  const odp = most.doGet({ parameter: { akcja: 'przeglad', token: 'cokolwiek', id: idPliku } });
  assert.match(JSON.parse(odp.tekst).blad, /nieznana akcja/, 'akcja=przeglad już nie istnieje');
  for (const fn of ['stronaPrzegladu', 'zatwierdz', 'odrzuc', 'powiadomWlasciciela', 'urlSerwisu', 'ustawienia']) {
    assert.equal(typeof most[fn], 'undefined', `funkcja ${fn} zniknęła z mostu`);
  }

  // Ręczne odrzucenie (przeciągnięcie na Drive) wyłącza paczkę z indeksu.
  most.przenies(idPliku, 'okolica-paczki-odrzucone');
  const poOdrzuceniu = JSON.parse(tekstOdpowiedzi(most.budujIndeks()));
  assert.equal(poOdrzuceniu.wpisy.length, 0, 'odrzucona ręcznie paczka znika z indeksu');
});

test('most: powtórna wysyłka odrzuconej ręcznie paczki nie tworzy nowego pliku', () => {
  const stan = uruchomMost();
  const przyjeta = stan.most.przyjmijKandydata(zestawPrzykladowy());
  stan.most.przenies(przyjeta.id, 'okolica-paczki-odrzucone');
  const druga = stan.most.przyjmijKandydata(zestawPrzykladowy());
  assert.equal(druga.ok, true, 'duplikat nie jest błędem');
  assert.equal(druga.status, 'juz-w-odrzuconych', 'odrzucenie właściciela obowiązuje dalej — nowy plik nie powstaje');
  assert.equal(druga.id, przyjeta.id, 'ten sam identyfikator pliku');
});
