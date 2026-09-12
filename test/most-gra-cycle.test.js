/**
 * Pełny cykl gry wieloosobowej WYKONANY na tekście `docs/setup/apps-script-repo-paczek.gs`
 * (LESSONS L33): założenie → dołączenie → start → zdarzenia → auto-koniec →
 * historia gier + profile. To są ścieżki, których aplikacja nie ma jak sprawdzić
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
    geohash8: 'u3qcdr0m', // m12-74: pozycja hosta (~40 m) — miara zasięgu ~50 m
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
  const zalozona = most.zalozGre({ tryb: 'trasa', organizator: { pseudonim: 'Ania' }, konfiguracja: konfiguracja(), zestaw: zestaw() });
  assert.equal(zalozona.ok, true, `założenie: ${zalozona.blad}`);
  const dolaczony = most.dolaczDoGry({ kod: zalozona.gra.kod, pseudonim: 'Bartek' });
  assert.equal(dolaczony.ok, true, `dołączenie: ${dolaczony.blad}`);
  assert.equal(dolaczony.gra.gracze.length, 2, 'dwóch graczy w lobby');
  const start = most.startGryMulti({ kod: zalozona.gra.kod, organizatorId: 'g-1' });
  assert.equal(start.ok, true, `start: ${start.blad}`);
  assert.equal(start.gra.stan, 'trwa', 'gra się toczy');
  return { most, pliki, kod: zalozona.gra.kod, idGry: zalozona.gra.idGry };
}

test('most: cykl gry Wspólna Trasa — dojście, odpowiedź, auto-koniec i historia gry', () => {
  const { most, kod } = graDwuosobowa();

  // Wspólna Trasa (właściciel, 2026-09-11): obaj gracze przechodzą TE SAME
  // stacje, każdy we własnym tempie. Most pilnuje KOLEJNOŚCI ZDARZEŃ (R08):
  // odpowiedź tylko po dojściu, a jedną stację zamyka się najwyżej raz.
  const dojscie = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'dojscie', 1) });
  assert.equal(dojscie.ok, true, `dojście: ${dojscie.blad}`);
  assert.equal(dojscie.stan, 'trwa', 'gra trwa po dojściu');

  // Odpowiedź bez dojścia (g-2 jeszcze nie doszedł na stację 1) — odmowa.
  const bezDojscia = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'odpowiedz', 1, { punkty: [1, 1] }) });
  assert.equal(bezDojscia.ok, false, 'most odrzuca odpowiedź bez dojścia');
  assert.match(bezDojscia.blad, /odpowiedź bez dojścia/, 'powód jest jawny');

  const odpowiedz = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'odpowiedz', 1, { punkty: [1, 1] }) });
  assert.equal(odpowiedz.ok, true, `odpowiedź: ${odpowiedz.blad}`);

  // Stacja 1 domknięta przez g-1, ale w Wspólnej Trasie g-2 też ją przechodzi.
  assert.equal(odpowiedz.stan, 'trwa', 'gra trwa, póki ktoś ma otwarte stacje');

  // Powtórna odpowiedź na tę samą stację — odmowa (jedna stacja = jeden zapis).
  const duplikat = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'odpowiedz', 1, { punkty: [1, 1] }) });
  assert.equal(duplikat.ok, false, 'most odrzuca powtórną odpowiedź na tę samą stację');
  assert.match(duplikat.blad, /już przez Ciebie odpowiedziana/, `powód jest jawny: ${duplikat.blad}`);

  // Nikt na nikogo nie czeka: g-2 idzie swoimi stacjami równolegle z g-1.
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'dojscie', 1) }).ok, true, 'dojście g-2 na stację 1');
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'odpowiedz', 1, { punkty: [1, 0] }) }).ok, true, 'g-2 zamyka stację 1');
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'dojscie', 2) }).ok, true, 'dojście g-1 na stację 2');
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-1', 'odpowiedz', 2, { punkty: [1, 1] }) }).ok, true, 'g-1 zamyka stację 2');
  assert.equal(most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'dojscie', 2) }).ok, true, 'dojście g-2 na stację 2');
  const koniec = most.przyjmijZdarzenie({ zdarzenie: zdarzenie(kod, 'g-2', 'odpowiedz', 2, { punkty: [1, 0] }) });
  assert.equal(koniec.ok, true, `ostatnia odpowiedź: ${koniec.blad}`);
  assert.equal(koniec.stan, 'zakonczona', 'gra zamknęła się sama, gdy każdy domknął wszystkie stacje');
  assert.deepEqual(Object.keys(koniec.wyniki).sort(), ['g-1', 'g-2'], 'wyniki dla obu graczy');

  // Stan gry z GET i lista lobby są spójne z tym, co zwróciło zdarzenie.
  const stan = most.stanGry(kod);
  assert.equal(stan.gra ? stan.gra.stan : stan.stan, 'zakonczona', 'stanGry widzi zakończenie');
  const lobby = most.listaGier();
  assert.equal(lobby.wpisy.length, 0, 'zakończona gra znika z lobby');

  // Historia gry to sam zapis na Drive (rankingi usunięte — właściciel
  // 2026-09-11): sprawdzamy wynik graczy w zapisie, nie osobny GET.
  const graZapisana = stan.gra ?? stan;
  const pseudonimy = Object.values(graZapisana.wyniki).map((w) => w.pseudonim).sort();
  assert.deepEqual(pseudonimy, ['Ania', 'Bartek'], 'zapis gry ma wynik obu graczy');
  assert.ok(Object.values(graZapisana.wyniki).every((w) => typeof w.punkty === 'number'), 'punkty są liczbami');
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

function konfiguracjaHotseat() {
  return { miejsce: 'Warszawa, Śródmieście', geohash5: 'u3qcd', wiek: 'wiek-12', tematy: ['nawigacja'], liczbaStacji: 2, pytaniaNaStacje: 2 };
}

function zdarzenieHotseat(graczId, typ, stacjaId, dane = {}) {
  return { schemat: 'RO-zdarzenie/1', graczId, typ, stacjaId, dane };
}

test('most: gra hot-seat wchodzi na Drive bez paczki i bez współrzędnych', () => {
  const { most, pliki } = uruchomMost();
  const wynik = most.przyjmijGreHotseat({
    tryb: 'hotseat',
    konfiguracja: konfiguracjaHotseat(),
    gracze: [{ id: 'a1', pseudonim: 'Ania' }, { id: 'b2', pseudonim: 'Bartek' }],
    zdarzenia: [
      zdarzenieHotseat('a1', 'dojscie', 1, { lat: 52.2297, lon: 21.0122, trasa: 'rynek → muzeum' }),
      zdarzenieHotseat('a1', 'odpowiedz', 1, { punkty: [1, 1] }),
      zdarzenieHotseat('b2', 'dojscie', 2, { szerokosc: 52.23, dlugosc: 21.02 }),
      zdarzenieHotseat('b2', 'odpowiedz', 2, { punkty: [0, 1] }),
    ],
  });
  assert.equal(wynik.ok, true, `wysyłka hot-seat: ${wynik.blad}`);
  assert.deepEqual(Object.keys(wynik.wyniki).sort(), ['a1', 'b2'], 'wyniki dla obu graczy');

  const gra = JSON.parse(pliki.get(wynik.idGry).tresc);
  assert.equal(gra.tryb, 'hotseat', 'tryb zapisany');
  assert.equal(gra.stan, 'zakonczona', 'hot-seat wchodzi jako gra zakończona');
  assert.equal(gra.kod, null, 'hot-seat nie ma kodu lobby');
  assert.equal(gra.zestaw, null, 'paczka i pytania zostają na telefonie (ADR 0013)');
  for (const z of gra.zdarzenia) {
    for (const pole of ['lat', 'lon', 'szerokosc', 'dlugosc', 'latitude', 'longitude']) {
      assert.equal(pole in z.dane, false, `pole ${pole} nie ma prawa zostać na Drive`);
    }
  }
  assert.equal(gra.zdarzenia[0].dane.trasa, 'rynek → muzeum', 'inne pola zdarzenia zostają');

  const pseudonimy = Object.values(gra.wyniki).map((w) => w.pseudonim).sort();
  assert.deepEqual(pseudonimy, ['Ania', 'Bartek'], 'gra hot-seat ma wynik obu graczy w historii');
});

test('most: hot-seat odrzuca zdarzenia spoza listy graczy i spoza zakresu stacji', () => {
  const { most } = uruchomMost();
  const baza = {
    tryb: 'hotseat',
    konfiguracja: konfiguracjaHotseat(),
    gracze: [{ id: 'a1', pseudonim: 'Ania' }],
  };
  const obcy = most.przyjmijGreHotseat({ ...baza, zdarzenia: [zdarzenieHotseat('x9', 'dojscie', 1)] });
  assert.equal(obcy.ok, false, 'gracz spoza listy jest odrzucony');
  assert.match(obcy.blad, /gracza spoza listy/, `powód jest jawny: ${obcy.blad}`);

  const pozaZakresem = most.przyjmijGreHotseat({ ...baza, zdarzenia: [zdarzenieHotseat('a1', 'dojscie', 7)] });
  assert.match(pozaZakresem.blad, /stacjaId poza zakresem/, `powód jest jawny: ${pozaZakresem.blad}`);

  const zlyTyp = most.przyjmijGreHotseat({ ...baza, zdarzenia: [zdarzenieHotseat('a1', 'rezygnacja', 1)] });
  assert.match(zlyTyp.blad, /tylko dojścia i odpowiedzi/, `powód jest jawny: ${zlyTyp.blad}`);

  const bezPseudonimu = most.przyjmijGreHotseat({ ...baza, gracze: [{ id: 'a1', pseudonim: '  ' }], zdarzenia: [] });
  assert.match(bezPseudonimu.blad, /nie ma pseudonimu/, `powód jest jawny: ${bezPseudonimu.blad}`);
});

test('most: lobby wygasa — stara otwarta gra idzie do archiwum i znika z listy', () => {
  const { most, pliki } = uruchomMost();
  const zalozona = most.zalozGre({ tryb: 'wyscig', organizator: { pseudonim: 'Ania' }, konfiguracja: konfiguracja(), zestaw: zestaw() });
  assert.equal(zalozona.ok, true, `założenie: ${zalozona.blad}`);
  const idGry = zalozona.gra.idGry;
  assert.equal(most.listaGier().wpisy.length, 1, 'świeża gra jest w lobby');

  // Starzymy wpis na dysku — atrapa trzyma surowy rekord, więc to ta sama operacja,
  // którą zrobiłby czas.
  const rekord = pliki.get(idGry);
  const stare = JSON.parse(rekord.tresc);
  stare.utworzono = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
  rekord.tresc = JSON.stringify(stare);

  most.archiwizujPrzeterminowane();

  const poArchiwizacji = JSON.parse(pliki.get(idGry).tresc);
  assert.equal(poArchiwizacji.stan, 'archiwum', 'przeterminowana gra jest archiwizowana');
  assert.equal(most.listaGier().wpisy.length, 0, 'archiwum nie zaśmieca lobby');
});
