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
import { zapakujPaczke } from '../app/kodowanie.js';
import { walidujZestawPublicznySurowy, walidujIndeksSurowy } from '../app/zestawy.js';

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
  assert.equal(pobrane.zestaw.schemat, 'TO-zestaw/1');
  assert.deepEqual(pobrane.zestaw.kontener, zestaw.kontener, 'kontener pytań dojechał bez zmian');
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
  const gety = ['indeks', 'paczka', 'gry', 'gra-stan', 'ranking', 'nieznana'];
  for (const akcja of gety) {
    const odp = most.doGet({ parameter: { akcja, id: 'BRAK', kod: 'BRAK', token: 'BRAK' } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doGet ${akcja}: ${odp.tekst}`);
  }
  const posty = ['gra-zaloz', 'gra-dolacz', 'gra-start', 'gra-zdarzenie', 'gra-zakoncz',
    'gra-hotseat', 'profil-ustaw', 'profil-sprawdz', 'nieznana'];
  for (const akcja of posty) {
    const odp = most.doPost({ postData: { contents: JSON.stringify({ akcja }) } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doPost ${akcja}: ${odp.tekst}`);
  }
});

/** Id pliku po nazwie — tak właściciel dostaje je w linku z e-maila. */
