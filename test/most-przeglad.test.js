/**
 * Przegląd całego mostu: KAŻDA funkcja z `.gs` zostaje wywołana choć raz, żeby
 * niezadeklarowany identyfikator nie przeżył do wdrożenia.
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
import { uruchomMost, zestawPrzykladowy, idPoNazwie } from './helpers/most.js';

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
  for (const nazwa of ['doGet', 'doPost', 'paczkaPrzezId', 'zalozGre', 'przyjmijGreHotseat', 'rankingi']) {
    assert.equal(funkcje.includes(nazwa), true, `przegląd nie objął ${nazwa}`);
  }

  assert.deepEqual(
    niezadeklarowane,
    [],
    'te funkcje czytają nazwę, której w skrypcie nie ma (literówka?): ' + niezadeklarowane.join(', '),
  );
});

test('most: właściciel dostaje link, a strona przeglądu wymaga tokena i nie wykonuje HTML-a z danych paczki', () => {
  const { most, pliki, wlasnosci, wyslaneMaile } = uruchomMost();
  const zestaw = zestawPrzykladowy();
  // Opis stacji i miejsce pochodzą spoza aplikacji (model / OSM / czyjaś ręka).
  zestaw.stacje[0].opis = '<img src=x onerror="alert(1)">';
  zestaw.meta.miejsce = 'Podkowa <script>alert(2)</script>';

  const przyjeta = most.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie do przeglądu: ${JSON.stringify(przyjeta)}`);
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);

  // Powiadomienie: bez niego właściciel nie wie, że ma co przeglądać.
  assert.equal(wyslaneMaile.length, 1, 'właściciel dostaje jednego maila');
  assert.equal(wyslaneMaile[0].adres, wlasnosci.get('OWNER_EMAIL'), 'mail idzie na adres właściciela');
  const link = String(wyslaneMaile[0].tresc).match(/https?:\/\/\S+/);
  assert.ok(link, 'w mailu jest link do przeglądu');
  const token = new URL(link[0]).searchParams.get('token');
  assert.equal(token, wlasnosci.get('REVIEW_SECRET'), 'link niesie token przeglądu');

  // Bez tokena strona nie pokazuje nic — przegląd nie jest publiczny.
  const bezTokena = String(most.doGet({ parameter: { akcja: 'przeglad', id: idPliku } }).html);
  assert.match(bezTokena, /Brak ważnego tokena/, 'przegląd bez tokena jest odmówiony');
  const zlyToken = String(most.doGet({ parameter: { akcja: 'przeglad', token: 'cudzy', id: idPliku } }).html);
  assert.match(zlyToken, /Brak ważnego tokena/, 'cudzy token nie otwiera przeglądu');

  const html = String(most.doGet({ parameter: { akcja: 'przeglad', token, id: idPliku } }).html);
  assert.ok(html.length > 200, 'strona przeglądu jest wygenerowana');
  assert.ok(html.includes(idPliku), 'strona niesie id pliku — z niego właściciel klika akceptację');

  // LESSONS L34 po stronie mostu: dane paczki są tekstem, nie znacznikami.
  assert.equal(html.includes('<img src=x'), false, 'wstrzyknięty <img> nie może powstać na stronie');
  assert.equal(html.includes('<script>alert(2)'), false, 'wstrzyknięty <script> nie może powstać na stronie');
  assert.ok(html.includes('&lt;img'), 'znacznik jest pokazany jako tekst (ucieczka HTML)');
  assert.ok(html.includes('&lt;script&gt;'), 'miejsce z <script> jest pokazane jako tekst');
  assert.ok(html.includes('Pytanie 1?'), 'treść pytania jest widoczna do przeglądu');
});

/* ----- odporność linku przeglądu (zgłoszenie właściciela 2026-09-11) ----- */

test('most: link przeglądu bierze adres z właściwości URL_SERWISU i prostuje /dev z getUrl', () => {
  // Znana usterka Apps Script (raportowana od 2020): ScriptApp.getService()
  // .getUrl() zwraca bywa adres `/dev` albo adres STAREGO wdrożenia po dodaniu
  // nowej wersji. Oba otwierają się stroną Google „Nie udało się otworzyć
  // pliku. Sprawdź adres i spróbuj ponownie." zamiast stroną przeglądu.
  // Dlatego: właściwość skryptu URL_SERWISU wygrywa, a `/dev` jest prostowane.

  // A: właściwość wygrywa — nawet gdy getUrl() zwróciłby adres /dev.
  const a = uruchomMost({ urlSerwisu: 'https://most.invalid/stary/dev' });
  a.wlasnosci.set('URL_SERWISU', 'https://most.invalid/dobry/exec');
  assert.equal(a.most.przyjmijKandydata(zestawPrzykladowy()).ok, true);
  const linkA = String(a.wyslaneMaile[0].tresc).match(/https?:\/\/\S+/);
  assert.ok(linkA, 'mail z linkiem przeglądu został wysłany');
  assert.match(linkA[0], /^https:\/\/most\.invalid\/dobry\/exec\?akcja=przeglad/, 'link prowadzi pod adres z URL_SERWISU, nie z getUrl()');

  // B: bez właściwości adres `/dev` z getUrl() jest prostowany na `/exec`
  // (adresu dev nie otwiera nikt poza edytującym skrypt).
  const b = uruchomMost({ urlSerwisu: 'https://most.invalid/stary/dev' });
  assert.equal(b.most.przyjmijKandydata(zestawPrzykladowy()).ok, true);
  const linkB = String(b.wyslaneMaile[0].tresc).match(/https?:\/\/\S+/);
  assert.match(linkB[0], /^https:\/\/most\.invalid\/stary\/exec\?akcja=przeglad/, ' getUrl() z /dev nie trafia do maila');

  // C: bez właściwości i bez /dev adres przechodzi bez zmian (zachowanie z czasów sprawnych wdrożeń).
  const c = uruchomMost({ urlSerwisu: 'https://most.invalid/swiezyc/exec' });
  assert.equal(c.most.przyjmijKandydata(zestawPrzykladowy()).ok, true);
  const linkC = String(c.wyslaneMaile[0].tresc).match(/https?:\/\/\S+/);
  assert.match(linkC[0], /^https:\/\/most\.invalid\/swiezyc\/exec\?akcja=przeglad/, 'poprawny adres z getUrl() przechodzi bez zmian');
});

test('most: mail z przeglądem niesie awaryjną drogę — link do pliku na Dysku i ręczne folderowanie', () => {
  // Nawet gdy link serwisu padnie (zła wersja, zły adres), właściciel ma
  // w mailu drogę awaryjną: bezpośredni link do pliku i instrukcję ręcznego
  // przeniesienia między katalogami Drive (to robią przyciski przeglądu).
  const { most, wyslaneMaile, pliki } = uruchomMost();
  const przyjeta = most.przyjmijKandydata(zestawPrzykladowy());
  assert.equal(przyjeta.ok, true);
  const cialo = String(wyslaneMaile[0].tresc);
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);
  assert.ok(cialo.includes('https://drive.example.invalid/file/d/' + idPliku), 'mail prowadzi też bezpośrednio do pliku na Dysku');
  assert.ok(cialo.includes('okolica-paczki-do-przegladu'), 'mail nazywa folder przeglądu');
  assert.ok(cialo.includes('okolica-paczki-zaakceptowane'), 'mail mówi, dokąd przenieść plik przy akceptacji');
  assert.ok(cialo.includes('okolica-paczki-odrzucone'), 'mail mówi, dokąd przenieść plik przy odrzuceniu');
});
