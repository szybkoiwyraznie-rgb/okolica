/**
 * Pełny cykl gry wieloosobowej WYKONANY na tekście `docs/setup/apps-script-repo-paczek.gs`
 * (LESSONS L33): założenie → dołączenie → start → zdarzenia → auto-koniec →
 * rankingi + profile. To są ścieżki, których aplikacja nie ma jak sprawdzić
 * sama, a jedna literówka w nazwie stałej kosztowała nas Z07 w paczkach.
 *
 * Przy okazji test pilnuje prywatności: współrzędne wysłane w `dane` zdarzenia
 * MUSZĄ zostać wycięte po stronie mostu (ADR 0013/0019 pkt 3).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uruchomMost } from './helpers/most.js';

function konfiguracja() {
  return {
    liczbaStacji: 2,
    pytaniaNaStacje: 2,
    wiek: 'wiek-12',
    tematy: ['nawigacja'],
    miejsce: 'Warszawa, Śródmieście',
    geohash5: 'u3qcd',
  };
}

function zestaw() {
  return {
    stacje: [
      { id: 1, opis: 'stacja 1', punkt: { lat: 52.23, lon: 21.01 }, pytania: [1, 2] },
      { id: 2, opis: 'stacja 2', punkt: { lat: 52.24, lon: 21.02 }, pytania: [3, 4] },
    ],
    kontener: { schemat: 'TO-paczka/2', stacje: [] },
    meta: { utworzono: '2026-09-07 12:00', autor: 'test' },
  };
}

function zdarzenie(kod, graczId, typ, stacjaId, dane = {}) {
  return { schemat: 'RO-zdarzenie/1', kod, graczId, typ, stacjaId, dane };
}

/** Zakłada grę na 2 graczy, dołącza drugiego i startuje — zwraca { most, kod }. */
function graDwuosobowa() {
  const { most, pliki } = uruchomMost();
  const zalozona = most.zalozGre({ tryb: 'tury', organizator: { pseudonim: 'Ania' }, konfiguracja: konfiguracja(), zestaw: zestaw() });
  assert.equal(zalozona.ok, true, `założenie: ${zalozona.blad}`);
  const dolaczony = most.dolaczDoGry({ kod: zalozona.gra.kod, pseudonim: 'Bartek' });
  assert.equal(dolaczony.ok, true, `dołączenie: ${dolaczony.blad}`);
  assert.equal(dolaczony.gra.gracze.length, 2, 'dwóch graczy w lobby');
  const start = most.startGryMulti({ kod: zalozona.gra.kod, organizatorId: 'g-1' });
  assert.equal(start.ok, true, `start: ${start.blad}`);
  assert.equal(start.gra.stan, 'trwa', 'gra się toczy');
  return { most, pliki, kod: zalozona.gra.kod, idGry: zalozona.gra.idGry };
}

test('most: cykl gry tury — dojście, odpowiedź, auto-koniec i rankingi', () => {
  const { most, kod } = graDwuosobowa();

  // Tura 1 należy do organizatora (g-1).
  const dojscie = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'dojscie', 1) });
  assert.equal(dojscie.ok, true, `dojście: ${dojscie.blad}`);
  assert.equal(dojscie.stan, 'trwa', 'gra trwa po dojściu');

  // Tury pilnuje most, nie aplikacja: gracz 2 nie może wejść w cudzą kolej.
  const zaWczesnie = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'dojscie', 1) });
  assert.equal(zaWczesnie.ok, false, 'most odrzuca zdarzenie z cudzej tury');
  assert.match(zaWczesnie.blad, /tura gracza g-1/, 'komunikat nazywa gracza, którego jest tura');

  const odpowiedz = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'odpowiedz', 1, { punkty: [1, 1] }) });
  assert.equal(odpowiedz.ok, true, `odpowiedź: ${odpowiedz.blad}`);

  // Stacja 1 jest domknięta, ale gra trwa: stacja 2 należy do g-2.
  assert.equal(odpowiedz.stan, 'trwa', 'gra trwa, póki są stacje bez odpowiedzi');

  // g-1 nie może zagrać za g-2 — kolejka należy do właściciela stacji.
  const cudzaStacja = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'dojscie', 2) });
  assert.equal(cudzaStacja.ok, false, 'most odrzuca dojście do cudzej stacji');
  assert.match(cudzaStacja.blad, /tura gracza g-2/, `powód jest jawny: ${cudzaStacja.blad}`);

  // Tura 2: g-2 domyka swoją stację i gra kończy się sama.
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'dojscie', 2) }).ok, true, 'dojście g-2');
  const koniec = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'odpowiedz', 2, { punkty: [1, 0] }) });
  assert.equal(koniec.ok, true, `ostatnia odpowiedź: ${koniec.blad}`);
  assert.equal(koniec.stan, 'zakonczona', 'gra zamknęła się sama, gdy domknięto wszystkie stacje');
  assert.deepEqual(Object.keys(koniec.wyniki).sort(), ['g-1', 'g-2'], 'wyniki dla obu graczy');

  // Stan gry z GET i lista lobby są spójne z tym, co zwróciło zdarzenie.
  const stan = most.stanGry(kod);
  assert.equal(stan.gra ? stan.gra.stan : stan.stan, 'zakonczona', 'stanGry widzi zakończenie');
  const lobby = most.listaGier();
  assert.equal(lobby.wpisy.length, 0, 'zakończona gra znika z lobby');

  const ranking = most.rankingi();
  const pseudonimy = ranking.wiersze.map((w) => w.pseudonim).sort();
  assert.deepEqual(pseudonimy, ['Ania', 'Bartek'], 'ranking widzi obu graczy z zakończonej gry');
  assert.ok(ranking.wiersze.every((w) => typeof w.punkty === 'number'), 'punkty są liczbami');
});

test('most: współrzędne w zdarzeniu są wycinane po stronie serwera', () => {
  const { most, pliki, kod, idGry } = graDwuosobowa();
  const zTrasa = most.przyjmijZdarzenie({
    zdarzenie: zdarzenie(kod, 'g-1', 'dojscie', 1, {
      lat: 52.2297, lon: 21.0122, szerokosc: 52.2297, dlugosc: 21.0122,
      latitude: 52.2297, longitude: 21.0122, trasa: 'rynek → muzeum',
    }),
  });
  assert.equal(zTrasa.ok, true, `zdarzenie z próbą przemytu: ${zTrasa.blad}`);

  // Czytamy PLIK gry z atrapy Drive — nie to, co zwrócił most.
  const gra = JSON.parse(pliki.get(idGry).tresc);
  const zapisane = gra.zdarzenia.filter((e) => e.typ === 'dojscie')[0];
  for (const pole of ['lat', 'lon', 'szerokosc', 'dlugosc', 'latitude', 'longitude']) {
    assert.equal(pole in zapisane.dane, false, `pole ${pole} nie ma prawa zostać na Drive`);
  }
  assert.equal(zapisane.dane.trasa, 'rynek → muzeum', 'inne pola zdarzenia zostają');
});

test('most: profil gracza to pseudonim + PIN, a nie wolny wpis', () => {
  const { most } = uruchomMost();
  // Pseudonim jest przycięty i trimowany — profil wisi pod nim, nie pod id urządzenia.
  const zapisany = most.ustawProfil({ pseudonim: '  Kasia  ', pin: '1234' });
  assert.equal(zapisany.ok, true, `zapis profilu: ${zapisany.blad}`);
  assert.equal(zapisany.nowy, true, 'pierwszy zapis zakłada profil');
  assert.equal(zapisany.pseudonim, 'Kasia', 'pseudonim wraca bez spacji');

  assert.equal(most.sprawdzProfil({ pseudonim: 'Kasia', pin: '1234' }).ok, true, 'weryfikacja z dobrym PIN-em');
  assert.equal(most.sprawdzProfil({ pseudonim: 'Kasia', pin: '9999' }).blad, 'R20', 'zły PIN to R20');
  assert.equal(most.sprawdzProfil({ pseudonim: 'Nikt' , pin: '1234' }).blad, 'R19', 'brak profilu to R19');
  assert.equal(most.ustawProfil({ pseudonim: 'Kasia', pin: '01' }).blad, 'R20', 'PIN krótszy niż 4 cyfry jest odrzucony');

  // Zajęcie cudzego pseudonimu innym PIN-em nie nadpisuje profilu.
  const przejecie = most.ustawProfil({ pseudonim: 'Kasia', pin: '5678' });
  assert.equal(przejecie.blad, 'R20', 'cudzy pseudonim z innym PIN-em nie przechodzi');
  assert.equal(most.ustawProfil({ pseudonim: 'Kasia', pin: '1234' }).nowy, false, 'ten sam PIN nie zakłada drugiego profilu');
});
