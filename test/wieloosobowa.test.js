/**
 * Testy `app/wieloosobowa.js` (M11/P2) — czyste schematy gry wieloosobowej:
 * kody, sąsiedztwo geohash5 (lobby), walidacje surowe R01–R20, maszynka tur,
 * wyniki, biała lista danych zdarzenia (PRYWATNOŚĆ: zero współrzędnych) i
 * agregacje rankingów (M12). Wartości referencyjne, nie „co wyszło".
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { geohash } from '../app/geo.js';
import {
  ALFABET_KODU, DLUGOSC_KODU, KODY_WIELOOSOBOWE, MAKS_GRACZY, SCHEMAT_GRY,
  SCHEMAT_LOBBY, SCHEMAT_PROFILU, SCHEMAT_RANKINGU, SCHEMAT_ZDARZENIA, TRYBY_GRY,
  agregujRanking, czyKompletna, czyPinPoprawny, filtrujLobby, generujKod,
  kategorieRankingu, kodPoprawny, komunikatBleduProfilu, normalizujKod, normalizujPseudonim,
  postepGracza, premiaZaKolejnosc, przeliczWyniki,
  ramkaGeohash, sasiednieGeohash, walidujGreSurowa, walidujLobbySurowe,
  walidujRankingSurowy, walidujZdarzenieSurowe, zbudujZdarzenie,
} from '../app/wieloosobowa.js';

const PODKOWA = { lat: 52.12303, lon: 20.74614 }; // geohash5 u3qb8 (jak w reszcie testów)
const GH5 = geohash(PODKOWA.lat, PODKOWA.lon, 5);

function graWazna(nad = {}) {
  return {
    schemat: SCHEMAT_GRY,
    kod: 'K2H7QM',
    idGry: 'drive-id-1',
    tryb: 'wyscig',
    stan: 'lobby',
    utworzono: '2026-09-06T18:00:00.000Z',
    organizatorId: 'g-1',
    gracze: [{ id: 'g-1', pseudonim: 'Szybki', dolaczyl: '2026-09-06T18:00:00.000Z' }],
    konfiguracja: { liczbaStacji: 3, pytaniaNaStacje: 1, wiek: 'dorosli', tematy: ['historia'], promienM: 1000, miejsce: 'Podkowa Leśna', geohash5: GH5 },
    zestaw: {
      stacje: [
        { id: 1, lat: 52.1235, lon: 20.7455, opis: 'plac' },
        { id: 2, lat: 52.1245, lon: 20.7475, opis: 'park' },
        { id: 3, lat: 52.1255, lon: 20.7495, opis: 'skwer' },
      ],
      kontener: { schemat: 'TO-paczka/2', protokol: 'PYT/1.0', kodowanie: 'b64x1', skrot: 'ab12cd34', dane: 'e30' },
      meta: { miejsce: 'Podkowa Leśna', geohash5: GH5 },
    },
    zdarzenia: [],
    wyniki: {},
    ...nad,
  };
}

/* ------------------------------------------------------- kody gier */

test('kody: alfabet bez 0/O/1/I, generator trzyma się alfabetu i długości', () => {
  assert.equal(GH5, 'u3qb8', 'kotwica geohash5 Podkowy (spójność z resztą testów)');
  assert.ok(!/[0O1I]/.test(ALFABET_KODU), 'alfabet kodu bez mylących znaków');
  assert.equal(ALFABET_KODU.length, 32, '8 cyfr (2–9) + 24 litery');
  let seq = 0;
  const deterministyczny = () => { seq = (seq * 7 + 13) % 97; return seq / 97; };
  for (let i = 0; i < 50; i += 1) {
    const kod = generujKod(deterministyczny);
    assert.equal(kod.length, DLUGOSC_KODU);
    assert.ok([...kod].every((z) => ALFABET_KODU.includes(z)), `kod ${kod} w alfabecie`);
  }
});

test('kody: normalizacja i walidacja wpisanego kodu', () => {
  assert.equal(normalizujKod(' k2-h7qm '), 'K2H7QM', 'wielkie litery, bez myślników i spacji');
  assert.equal(kodPoprawny('k2-h7qm'), true);
  assert.equal(kodPoprawny('K2H7QM'), true);
  assert.equal(kodPoprawny('0O1I23'), false, 'znaki zakazane odrzucone jawnie');
  assert.equal(kodPoprawny('K2H7Q'), false, 'za krótki');
  assert.equal(kodPoprawny(''), false);
  assert.equal(kodPoprawny(null), false);
});

/* ------------------------------------- sąsiedztwo geohash5 (lobby okolicy) */

test('ramkaGeohash: dekoder zgodny z enkoderem geo.js (round-trip środka)', () => {
  const r = ramkaGeohash(GH5);
  assert.ok(r && r.latMin < r.latMax && r.lonMin < r.lonMax, 'ramka ma dodatnie rozmiary');
  const sLat = (r.latMin + r.latMax) / 2;
  const sLon = (r.lonMin + r.lonMax) / 2;
  assert.equal(geohash(sLat, sLon, 5), GH5, 'środek ramki koduje się z powrotem do tej samej komórki');
  assert.equal(ramkaGeohash('u3q!8'), null, 'śmieciowy znak → null, nie wyjątek');
});

test('sasiednieGeohash: 8 unikalnych komórek, bez własnej, symetryczne', () => {
  const sasiedzi = sasiednieGeohash(GH5);
  assert.equal(sasiedzi.length, 8, 'pełne sąsiedztwo w środku strefy');
  assert.equal(new Set(sasiedzi).size, 8, 'unikalni sąsiedzi');
  assert.ok(!sasiedzi.includes(GH5), 'własna komórka nie jest swoim sąsiadem');
  assert.ok(sasiedzi.every((s) => s.length === 5), 'ta sama precyzja');
  const moja = ramkaGeohash(GH5);
  for (const s of sasiedzi) {
    const r = ramkaGeohash(s);
    const styk = r.lonMin <= moja.lonMax + 1e-9 && r.lonMax >= moja.lonMin - 1e-9
      && r.latMin <= moja.latMax + 1e-9 && r.latMax >= moja.latMin - 1e-9;
    assert.ok(styk, `komórka ${s} styka się z ${GH5}`);
    assert.ok(sasiednieGeohash(s).includes(GH5), `symetria: ${GH5} jest sąsiadem ${s}`);
  }
});

test('filtrujLobby: gry z własnej komórki i sąsiednich; bez pozycji = pusto', () => {
  const sasiad = sasiednieGeohash(GH5)[0];
  const wpisy = [
    { idGry: 'a', tryb: 'wyscig', geohash5: GH5, miejsce: 'Tu', liczbaGraczy: 1 },
    { idGry: 'b', tryb: 'trasa', geohash5: sasiad, miejsce: 'Obok', liczbaGraczy: 2 },
    { idGry: 'c', tryb: 'wyscig', geohash5: 'v0gq0', miejsce: 'Daleko', liczbaGraczy: 1 },
  ];
  const blisko = filtrujLobby(wpisy, { geohash5: GH5 });
  assert.deepEqual(blisko.map((w) => w.idGry), ['a', 'b'], 'własna + sąsiednia komórka');
  assert.deepEqual(filtrujLobby(wpisy, {}), [], 'brak pozycji = brak lobby (jawne zero)');
  assert.deepEqual(filtrujLobby('śmieci', { geohash5: GH5 }), []);
});

/* ------------------------------------------------- walidacje surowe */

test('walidujGreSurowa: poprawna gra przechodzi bez usterek', () => {
  const { gra, usterki } = walidujGreSurowa(JSON.stringify(graWazna()));
  assert.deepEqual(usterki, []);
  assert.equal(gra.kod, 'K2H7QM');
});

test('walidujGreSurowa: każda kolumna stanu daje własny kod R01–R09', () => {
  const przypadki = [
    ['to-nie-json', 'R01'],
    [{ ...graWazna(), schemat: 'coś/9' }, 'R02'],
    [{ ...graWazna(), kod: 'BAD0O1' }, 'R03'],
    [{ ...graWazna(), tryb: 'maraton' }, 'R04'],
    [{ ...graWazna(), stan: 'w-trakcie' }, 'R05'],
    [{ ...graWazna(), gracze: [] }, 'R06'],
    [{ ...graWazna(), konfiguracja: { liczbaStacji: 3 } }, 'R07'],
    [{ ...graWazna(), zestaw: { stacje: [], kontener: null, meta: null } }, 'R08'],
    [{ ...graWazna(), zdarzenia: [{ typ: 'nie-typ' }] }, 'R09'],
  ];
  for (const [gra, kod] of przypadki) {
    const tekst = typeof gra === 'string' ? gra : JSON.stringify(gra);
    const wynik = walidujGreSurowa(tekst);
    assert.equal(wynik.gra, null, `${kod}: gra odrzucona`);
    assert.deepEqual(wynik.usterki.map((u) => u.kod), [kod], `przypadek ${kod}`);
    assert.ok(KODY_WIELOOSOBOWE[kod].length > 10, `${kod} ma komunikat po polsku`);
  }
});

test('walidujZdarzenieSurowe: typy, gracz, wskazanie gry, stacja (R10–R14)', () => {
  const ok = walidujZdarzenieSurowe(JSON.stringify(zbudujZdarzenie({ kod: 'K2H7QM', graczId: 'g-2', typ: 'dojscie', stacjaId: 2, dane: { trybDojscia: 'gps' } })));
  assert.deepEqual(ok.usterki, []);
  assert.equal(ok.zdarzenie.typ, 'dojscie');
  const rezygnacja = walidujZdarzenieSurowe(JSON.stringify(zbudujZdarzenie({ idGry: 'x', graczId: 'g-2', typ: 'rezygnacja', dane: { powod: 'deszcz' } })));
  assert.deepEqual(rezygnacja.usterki, [], 'rezygnacja nie wymaga stacji');
  const przypadki = [
    ['śmieci', 'R10'],
    [{ schemat: 'inne/1' }, 'R11'],
    [{ schemat: SCHEMAT_ZDARZENIA, kod: 'K2H7QM', graczId: 'g-1', typ: 'skok' }, 'R12'],
    [{ schemat: SCHEMAT_ZDARZENIA, kod: 'K2H7QM', typ: 'start' }, 'R13'],
    [{ schemat: SCHEMAT_ZDARZENIA, graczId: 'g-1', typ: 'start' }, 'R13'],
    [{ schemat: SCHEMAT_ZDARZENIA, kod: 'K2H7QM', graczId: 'g-1', typ: 'odpowiedz', stacjaId: 'trzecia' }, 'R14'],
  ];
  for (const [z, kod] of przypadki) {
    const tekst = typeof z === 'string' ? z : JSON.stringify(z);
    const wynik = walidujZdarzenieSurowe(tekst);
    assert.equal(wynik.zdarzenie, null);
    assert.deepEqual(wynik.usterki.map((u) => u.kod), [kod], `przypadek ${kod}`);
  }
});

test('PRYWATNOŚĆ: zbudujZdarzenie przepuszcza wyłącznie białą listę pól', () => {
  const z = zbudujZdarzenie({
    kod: 'K2H7QM', graczId: 'g-1', typ: 'dojscie', stacjaId: 1,
    dane: { trybDojscia: 'gps', lat: 52.123, lon: 20.746, szerokosc: 1, smieci: 'x', nested: { lat: 2 } },
  });
  assert.deepEqual(Object.keys(z.dane), ['trybDojscia'], 'współrzędne i śmieci zostają na telefonie (ADR 0019 pkt 3)');
  assert.ok(!JSON.stringify(z).includes('52.123'), 'całe zdarzenie bez współrzędnych');
  assert.throws(() => zbudujZdarzenie({ kod: 'X', graczId: 'g-1', typ: ' teleport ' }), TypeError, 'nieznany typ odrzucony');
  assert.throws(() => zbudujZdarzenie({ graczId: 'g-1', typ: 'start' }), TypeError, 'bez kodu/idGry odrzucone');
});

test('zbudujZdarzenie: tUrzadzenia to skończone ms albo brak pola (nigdy NaN/null)', () => {
  const z = zbudujZdarzenie({ kod: 'K2H7QM', graczId: 'g-1', typ: 'start', tUrzadzenia: 1_757_000_000_000 });
  assert.equal(z.tUrzadzenia, 1_757_000_000_000);
  const iso = zbudujZdarzenie({ kod: 'K2H7QM', graczId: 'g-1', typ: 'start', tUrzadzenia: new Date(1_757_000_000_000).toISOString() });
  assert.ok(!('tUrzadzenia' in iso), 'ISO-tekst pomijany (Number()=NaN serializował się do null)');
  const bez = zbudujZdarzenie({ kod: 'K2H7QM', graczId: 'g-1', typ: 'start' });
  assert.ok(!('tUrzadzenia' in bez), 'pole opcjonalne');
});

/* ----------------------------- maszynka Wspólnej Trasy i wyniki */

function graTrasy(zdarzenia = []) {
  return graWazna({
    tryb: TRYBY_GRY.trasa, stan: 'trwa',
    gracze: [
      { id: 'g-1', pseudonim: 'Ala', dolaczyl: 't1' },
      { id: 'g-2', pseudonim: 'Bartek', dolaczyl: 't2' },
    ],
    zdarzenia,
  });
}
const odp = (graczId, stacjaId, nad = {}) => ({ kolejnosc: 1, graczId, typ: 'odpowiedz', stacjaId, dane: { poprawna: true, punktyRazem: 12, ...nad }, tSerwera: 't' });
const doj = (graczId, stacjaId, nad = {}) => ({ kolejnosc: 1, graczId, typ: 'dojscie', stacjaId, dane: { trybDojscia: 'gps', ...nad }, tSerwera: 't' });

test('trasa: czyKompletna z rezygnacją — rezygnujący nie blokuje domknięcia', () => {
  const rezygn = { kolejnosc: 2, graczId: 'g-2', typ: 'rezygnacja', dane: {}, tSerwera: 't' };
  assert.equal(czyKompletna(graTrasy([odp('g-1', 1), rezygn])), false, 'g-1 ma jeszcze stacje 2 i 3');
  assert.equal(czyKompletna(graTrasy([odp('g-1', 1), rezygn, odp('g-1', 3)])), false, 'g-1 wciąż ma stację 2');
  assert.equal(czyKompletna(graTrasy([odp('g-1', 1), rezygn, odp('g-1', 2), odp('g-1', 3)])), true, 'g-1 domknął swoje — gra domknięta');
  assert.equal(czyKompletna(graTrasy([rezygn, { kolejnosc: 3, graczId: 'g-1', typ: 'rezygnacja', dane: {}, tSerwera: 't' }])), true, 'wszyscy zrezygnowali = koniec');
});

test('czyKompletna: trasa i wyścig = każdy gracz N stacji albo rezygnacja', () => {
  assert.equal(czyKompletna(graTrasy([odp('g-1', 1), odp('g-1', 2), odp('g-1', 3)])), false, 'trasa: g-2 jeszcze nie skończył');
  assert.equal(czyKompletna(graTrasy([odp('g-1', 1), odp('g-1', 2), odp('g-1', 3), odp('g-2', 1), odp('g-2', 2), odp('g-2', 3)])), true, 'trasa: obaj domknęli');
  const wyscig = graWazna({
    stan: 'trwa',
    gracze: [{ id: 'g-1', pseudonim: 'A', dolaczyl: 't' }, { id: 'g-2', pseudonim: 'B', dolaczyl: 't' }],
  });
  wyscig.zdarzenia = [odp('g-1', 1), odp('g-1', 2), odp('g-1', 3)];
  assert.equal(czyKompletna(wyscig), false, 'wyścig: tylko jeden gracz skończył');
  wyscig.zdarzenia.push(odp('g-2', 1), odp('g-2', 2), { kolejnosc: 9, graczId: 'g-2', typ: 'rezygnacja', dane: {}, tSerwera: 't' });
  assert.equal(czyKompletna(wyscig), true, 'rezygnacja domyka brakującego gracza');
});

test('wyniki: punkty, poprawne/błędne i czasy odcinków ze zdarzeń', () => {
  const gra = graWazna({ stan: 'trwa' });
  gra.zdarzenia = [doj('g-1', 1), odp('g-1', 1), doj('g-1', 2), odp('g-1', 2, { poprawna: false, punktyRazem: 0 })];
  const p = postepGracza(gra, 'g-1');
  assert.deepEqual({ ...p }, { stacjeZamkniete: 2, punkty: 12, poprawne: 1, bledne: 1, czasOdcinkowMs: 0, zrezygnowal: false });
  const wyniki = przeliczWyniki(gra);
  assert.equal(wyniki['g-1'].pseudonim, 'Szybki', 'wyniki niosą pseudonim (rankingi M12)');
  assert.equal(wyniki['g-1'].punkty, 12);
});

/* --------------------------------------------- lobby i rankingi (surowe) */

test('walidujLobbySurowe: wpis uszkodzony odpada z R16, obcy schemat z R15', () => {
  const dobre = { schemat: SCHEMAT_LOBBY, wpisy: [{ idGry: 'a', tryb: 'wyscig', geohash5: GH5, miejsce: 'Podkowa', liczbaGraczy: 2, stan: 'lobby' }] };
  const ok = walidujLobbySurowe(JSON.stringify(dobre));
  assert.deepEqual(ok.usterki, []);
  assert.equal(ok.wpisy.length, 1);
  const zSmieciem = walidujLobbySurowe(JSON.stringify({ ...dobre, wpisy: [...dobre.wpisy, { idGry: '', tryb: 'byleco' }] }));
  assert.equal(zSmieciem.wpisy.length, 1, 'śmieć odfiltrowany');
  assert.deepEqual(zSmieciem.usterki.map((u) => u.kod), ['R16']);
  assert.deepEqual(walidujLobbySurowe('{"schemat":"inne"}').usterki.map((u) => u.kod), ['R15']);
  assert.equal(MAKS_GRACZY, 8, 'limit graczy zgodny z mostem');
});

test('rankingi: agregacje ogólne i kategorie wiek/temat/lokalizacja (ADR 0019 pkt 5)', () => {
  const wiersze = [
    { pseudonim: 'Ala', punkty: 30, poprawne: 3, bledne: 0, data: 'd1', tryb: 'wyscig', miejsce: 'Podkowa Leśna', geohash5: GH5, wiek: 'dorosli', tematy: ['historia', 'architektura'] },
    { pseudonim: 'Ala', punkty: 10, poprawne: 1, bledne: 1, data: 'd2', tryb: 'trasa', miejsce: 'Warszawa', geohash5: 'u3q8x', wiek: 'dorosli', tematy: ['przyroda'] },
    { pseudonim: 'Bartek', punkty: 25, poprawne: 2, bledne: 1, data: 'd1', tryb: 'wyscig', miejsce: 'Podkowa Leśna', geohash5: GH5, wiek: '12-15', tematy: ['historia'] },
  ];
  const ogolny = agregujRanking(wiersze);
  assert.deepEqual(ogolny.map((s) => s.pseudonim), ['Ala', 'Bartek'], 'Ala 40 > Bartek 25');
  assert.equal(ogolny[0].punkty, 40);
  assert.equal(ogolny[0].gry, 2, 'historia gier zliczona');
  const dorosli = agregujRanking(wiersze, { wiek: 'dorosli' });
  assert.deepEqual(dorosli.map((s) => s.pseudonim), ['Ala'], 'kategoria wiekowa filtruje');
  const historia = agregujRanking(wiersze, { temat: 'historia' });
  assert.deepEqual(historia.map((s) => [s.pseudonim, s.punkty]), [['Ala', 30], ['Bartek', 25]], 'tematyczna: tylko gry z tematem');
  const podkowa = agregujRanking(wiersze, { geohash5: GH5 });
  assert.deepEqual(podkowa.map((s) => s.pseudonim), ['Ala', 'Bartek'], '„najlepsi w Podkowie Leśnej"');
  assert.equal(podkowa[0].punkty, 30, 'warszawska gra Ali nie wchodzi do Podkowy');
  const kat = kategorieRankingu(wiersze);
  assert.deepEqual(kat.wieki, ['12-15', 'dorosli']);
  assert.deepEqual(kat.tematy, ['architektura', 'historia', 'przyroda']);
  assert.equal(kat.lokalizacje.length, 2);
});

test('walidujRankingSurowy: R17 dla śmieci, R18 filtruje wiersze', () => {
  const wiersz = { pseudonim: 'Ala', punkty: 5, poprawne: 1, bledne: 0, geohash5: GH5, wiek: 'dorosli', tematy: ['historia'], miejsce: 'Podkowa', data: 'd', tryb: 'wyscig' };
  const ok = walidujRankingSurowy(JSON.stringify({ schemat: SCHEMAT_RANKINGU, wiersze: [wiersz] }));
  assert.deepEqual(ok.usterki, []);
  assert.equal(ok.wiersze.length, 1);
  const zepsuty = walidujRankingSurowy(JSON.stringify({ schemat: SCHEMAT_RANKINGU, wiersze: [wiersz, { pseudonim: '', punkty: 'dużo' }] }));
  assert.equal(zepsuty.wiersze.length, 1);
  assert.deepEqual(zepsuty.usterki.map((u) => u.kod), ['R18']);
  assert.deepEqual(walidujRankingSurowy('nie-json').usterki.map((u) => u.kod), ['R17']);
});

test('profil PIN (ADR 0021): normalizacja pseudonimu i reguła PIN-u', () => {
  assert.equal(SCHEMAT_PROFILU, 'RO-profil/1');
  assert.equal(normalizujPseudonim('  Ala   Kowalska  '), 'Ala Kowalska');
  assert.equal(normalizujPseudonim(null), '');
  assert.equal(normalizujPseudonim('x'.repeat(30)).length, 20);
  assert.ok(czyPinPoprawny('1234'));
  assert.ok(czyPinPoprawny('12345678'));
  assert.ok(!czyPinPoprawny('123'), 'za krótki');
  assert.ok(!czyPinPoprawny('123456789'), 'za długi');
  assert.ok(!czyPinPoprawny('12a4'), 'tylko cyfry');
  assert.ok(!czyPinPoprawny(''), 'pusty odrzucony');
});

test('profil PIN: kody R19/R20 z komunikatami dla gracza', () => {
  assert.ok(KODY_WIELOOSOBOWE.R19.includes('pseudonimu'));
  assert.ok(KODY_WIELOOSOBOWE.R20.includes('PIN'));
  assert.equal(komunikatBleduProfilu('R19'), KODY_WIELOOSOBOWE.R19);
  assert.equal(komunikatBleduProfilu('R20'), KODY_WIELOOSOBOWE.R20);
  assert.ok(komunikatBleduProfilu('R99').startsWith('Most odmówił:'));
});

/* -------------- ADR 0027 część B: premia za kolejność ukończenia ----------- */

/** Gra wyścigowa N graczy; `kolejnosc` zdarzeń rośnie jak w moście (sekwencyjnie). */
function graWyscig({ liczbaGraczy = 4, stan = 'trwa' } = {}) {
  const gra = graWazna({
    stan,
    gracze: Array.from({ length: liczbaGraczy }, (_, i) => ({
      id: `g-${i + 1}`, pseudonim: `Gracz ${i + 1}`, dolaczyl: `t${i}`,
    })),
    zdarzenia: [],
  });
  gra.__kolejnosc = 0;
  return gra;
}

/** Dokłada odpowiedź gracza z rosnącą `kolejnosc` (jak `przyjmijZdarzenie` w moście). */
function odpowiedz(gra, graczId, stacjaId, nad = {}) {
  gra.__kolejnosc += 1;
  gra.zdarzenia.push({
    kolejnosc: gra.__kolejnosc, graczId, typ: 'odpowiedz', stacjaId,
    dane: { poprawna: true, punktyRazem: 1, ...nad }, tSerwera: `t${gra.__kolejnosc}`,
  });
  return gra;
}

function zakonczWszystkieStacje(gra, graczId) {
  for (let st = 1; st <= gra.konfiguracja.liczbaStacji; st += 1) odpowiedz(gra, graczId, st);
  return gra;
}

test('premia za kolejność: pierwszy G−1, drugi G−2, …, ostatni 0 (ADR 0027 pkt 5)', () => {
  const gra = graWyscig({ liczbaGraczy: 4 });
  // kolejność kończenia: g-2, g-4, g-1, g-3 (g-3 kończy ostatni)
  for (const graczId of ['g-2', 'g-4', 'g-1', 'g-3']) zakonczWszystkieStacje(gra, graczId);
  assert.deepEqual(premiaZaKolejnosc(gra), { 'g-2': 3, 'g-4': 2, 'g-1': 1 }, '3/2/1, ostatni zero (klucza brak)');
});

test('premia bierze kolejność z `kolejnosc` mostu, nie z zegara urządzenia', () => {
  const gra = graWyscig({ liczbaGraczy: 2 });
  zakonczWszystkieStacje(gra, 'g-1');
  zakonczWszystkieStacje(gra, 'g-2');
  // zegary urządzeń kłamią w drugą stronę — kolejność i tak z mostu
  for (const z of gra.zdarzenia) z.tSerwera = z.graczId === 'g-1' ? '2099-01-01T00:00:00.000Z' : '2000-01-01T00:00:00.000Z';
  assert.deepEqual(premiaZaKolejnosc(gra), { 'g-1': 1 }, 'g-1 skończył pierwszy wg numerów zdarzeń');
});

test('premia nie wchodzi do punktów, dopóki gra się toczy (ADR 0027 pkt 5)', () => {
  const gra = graWyscig({ liczbaGraczy: 2, stan: 'trwa' });
  zakonczWszystkieStacje(gra, 'g-1');
  assert.equal(przeliczWyniki(gra)['g-1'].premia, 1, 'premia jest policzona…');
  assert.equal(przeliczWyniki(gra)['g-1'].punkty, 3, '…ale częściowy wynik jej nie zawiera (3 × 1 pkt)');

  gra.stan = 'zakonczona';
  assert.equal(przeliczWyniki(gra)['g-1'].punkty, 4, 'podsumowanie dodaje premię (3 + 1)');
  assert.equal(przeliczWyniki(gra)['g-2'].punkty, 0, 'gracz, który nie skończył, premii nie ma');
});

test('premia: rezygnacja i gra zakończona przez gospodarza', () => {
  const gra = graWyscig({ liczbaGraczy: 3, stan: 'zakonczona' });
  zakonczWszystkieStacje(gra, 'g-2');
  gra.zdarzenia.push({ kolejnosc: 99, graczId: 'g-3', typ: 'rezygnacja', dane: { powod: 'test' }, tSerwera: 't99' });
  // g-1 nie skończył — gospodarz zakończył grę
  const premia = premiaZaKolejnosc(gra);
  assert.deepEqual(premia, { 'g-2': 2 }, 'tylko g-2 skończył: premia 3 − 1 = 2; rezygnujący i niedokończony bez premii');
  assert.equal(przeliczWyniki(gra)['g-3'].zrezygnowal, true, 'rezygnacja widoczna w wynikach');
});

test('premia: jeden gracz i gra bez konfiguracji nie dają premii', () => {
  assert.deepEqual(premiaZaKolejnosc(graWyscig({ liczbaGraczy: 1 })), {}, 'solo: premia zawsze 0');
  assert.deepEqual(premiaZaKolejnosc(null), {}, 'brak gry = brak premii (odporność na pusty polling)');
  const bezKonfiguracji = graWyscig({ liczbaGraczy: 2 });
  bezKonfiguracji.konfiguracja = { liczbaStacji: 0 };
  assert.deepEqual(premiaZaKolejnosc(bezKonfiguracji), {}, 'bez liczby stacji nie da się orzec końca');
});
