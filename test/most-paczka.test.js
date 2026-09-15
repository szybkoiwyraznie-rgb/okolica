/**
 * Most Drive: pełna droga paczki z repozytorium (M9b) — WYKONANIE skryptu.
 *
 * Dlaczego ten test istnieje: w `paczkaPrzezId` była literówka (`wZaakceptowanych`
 * zadeklarowane, `wZaakceptowane` czytane) — ReferenceError łapany przez `doGet`
 * zamieniał się w `{blad:"… is not defined"}`, a aplikacja mówiła tylko
 * „Plik publiczny ma inny schemat niż TO-zestaw/1" (Z07). Gracz nie miał jak
 * zgadnąć, że winny jest skrypt. Test wykonuje tekst `.gs` na atrapie Drive
 * i przechodzi całą drogę: przyjęcie (od 2026-09-11 od razu do zaakceptowanych,
 * bez sesji przeglądu) → indeks → pobranie → walidacja po stronie aplikacji.
 * Rozjazd którejkolwiek strony widać od razu.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walidujZestawPublicznySurowy, walidujIndeksSurowy, skrotPaczki } from '../app/zestawy.js';

import { uruchomMost, zestawPrzykladowy, tekstOdpowiedzi, idPoNazwie } from './helpers/most.js';

/* -------------------------------------------------------------------- testy */

test('most: paczka z repozytorium przechodzi całą drogę i aplikacja ją przyjmuje', () => {
  const { most, pliki } = uruchomMost();
  const zestaw = zestawPrzykladowy();

  // Decyzja właściciela 2026-09-11: koniec sesji przeglądu — paczka ląduje
  // w zaakceptowanych OD RAZU i jest w indeksie natychmiast.
  const przyjeta = most.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie: ${JSON.stringify(przyjeta)}`);
  assert.equal(przyjeta.status, 'zaakceptowana');

  const indeksPo = walidujIndeksSurowy(tekstOdpowiedzi(most.budujIndeks()));
  assert.equal(indeksPo.usterki.length, 0, 'indeks bez usterek');
  assert.equal(indeksPo.indeks.length, 1, 'po akceptacji paczka jest w indeksie');
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);
  assert.ok(idPliku, 'plik paczki leży w katalogu zaakceptowanych');
  const wpis = indeksPo.indeks[0];
  assert.equal(wpis.id, idPliku, 'wpis indeksu niesie id pliku Drive');
  assert.equal(wpis.geohash6, 'u3qb8g', 'kotwica geohash6 z meta (B19)');

  // Dokładnie to robi aplikacja po kliknięciu „Graj z tą paczką".
  const pobrane = walidujZestawPublicznySurowy(tekstOdpowiedzi(most.paczkaPrzezId(wpis.id)));
  assert.deepEqual(pobrane.usterki, [], 'pobrana paczka jest kompletna (regresja po literówce w paczkaPrzezId)');
  assert.equal(pobrane.zestaw.schemat, 'TO-zestaw/2');
  assert.deepEqual(pobrane.zestaw.paczka, zestaw.paczka, 'jawna paczka pytań dojechała bez zmian');
  assert.equal(pobrane.zestaw.stacje.length, 3);
});

test('most: paczka odrzucona ręcznie (poza katalogiem zaakceptowanych) dostaje jawny powód', () => {
  const { most, pliki } = uruchomMost();
  const przyjeta = most.przyjmijKandydata(zestawPrzykladowy({ stacje: 2 }));
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);
  // Tak wygląda odrzucenie od 2026-09-11: właściciel przeciąga plik do
  // katalogu odrzuconych na Drive (przenies robi dokładnie to).
  most.przenies(idPliku, 'okolica-paczki-odrzucone');

  const odpowiedz = most.paczkaPrzezId(idPliku);
  assert.equal(odpowiedz.blad, 'ta paczka nie jest zaakceptowana');

  // Gracz ma zobaczyć powód z mostu, a nie „inny schemat" (Z07 bez wyjaśnienia).
  const { zestaw, usterki } = walidujZestawPublicznySurowy(tekstOdpowiedzi(odpowiedz));
  assert.equal(zestaw, null);
  assert.equal(usterki[0].kod, 'Z11', 'kod mówi, że odmówił most');
  assert.match(usterki[0].komunikat, /nie jest zaakceptowana/, 'komunikat cytuje most');
});

test('most: żadna akcja nie odpowiada błędem wykonania skryptu', () => {
  const { most } = uruchomMost();
  // 'ranking' celowo poza listą: akcja usunięta z mostu (właściciel, 2026-09-11).
  const gety = ['indeks', 'paczka', 'gry', 'gra-stan', 'nieznana'];
  for (const akcja of gety) {
    const odp = most.doGet({ parameter: { akcja, id: 'BRAK', kod: 'BRAK', token: 'BRAK' } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doGet ${akcja}: ${odp.tekst}`);
  }
  const posty = ['gra-zaloz', 'gra-dolacz', 'gra-start', 'gra-zdarzenie', 'gra-zakoncz',
    'gra-hotseat', 'gra-opusc', 'profil-ustaw', 'profil-sprawdz', 'nieznana'];
  for (const akcja of posty) {
    const odp = most.doPost({ postData: { contents: JSON.stringify({ akcja }) } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doPost ${akcja}: ${odp.tekst}`);
  }
});

/**
 * Odcisk treści paczki istnieje w DWÓCH implementacjach: `app/zestawy.js`
 * (klucz rejestru lokalnego i mapowanie paczka → id pliku Drive) oraz
 * `docs/setup/apps-script-repo-paczek.gs` (wpis indeksu publicznego i rozjazd
 * nazw plików na Drive). ADR 0050 pkt 2: „obie strony liczą ten sam skrót”.
 * Bez tego testu literówka albo „poprawka” po jednej stronie przejdzie cicho,
 * a paczka rozdzieli się na dwie tożsamości (LESSONS L33: lustro mostu ma test
 * wykonujący, nie tylko opis). Paczka przykładowa niesie polskie znaki
 * (`Podkowa Leśna`, `Źródło`) — porównanie sprawdza też zgodność UTF-8.
 */
test('most: odcisk paczki z mostu jest TEN SAM, który liczy aplikacja (ADR 0050 pkt 2)', () => {
  const { most } = uruchomMost();
  const zestaw = zestawPrzykladowy();

  // Ta sama paczka, dwie implementacje FNV-1a 32 — wynik musi być identyczny.
  assert.equal(most.skrotPaczki(zestaw.paczka), skrotPaczki(zestaw.paczka),
    'lustro `skrotPaczki` w .gs liczy ten sam odcisk co app/zestawy.js');

  // I ta sama wartość musi dojechać do aplikacji w indeksie publicznym: wpis
  // niesie skrót, którym aplikacja kluczuje swoją pamięć paczek.
  const przyjeta = most.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie: ${JSON.stringify(przyjeta)}`);
  const indeks = walidujIndeksSurowy(tekstOdpowiedzi(most.budujIndeks()));
  assert.equal(indeks.usterki.length, 0, 'indeks bez usterek');
  assert.equal(indeks.indeks[0].skrot, skrotPaczki(zestaw.paczka),
    'skrót we wpisie indeksu = skrót, który aplikacja liczy dla tej samej paczki');
});
