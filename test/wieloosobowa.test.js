/**
 * Testy `app/wieloosobowa.js` (M11/P2) — czyste schematy gry wieloosobowej:
 * kody, sąsiedztwo geohash5 (lobby), walidacje surowe R01–R18, maszynka tur,
 * wyniki, biała lista danych zdarzenia (PRYWATNOŚĆ: zero współrzędnych) i
 * agregacje rankingów (M12). Wartości referencyjne, nie „co wyszło".
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { geohash } from '../app/geo.js';
import {
  ALFABET_KODU, DLUGOSC_KODU, KODY_WIELOOSOBOWE, MAKS_GRACZY, SCHEMAT_GRY,
  SCHEMAT_LOBBY, SCHEMAT_RANKINGU, SCHEMAT_ZDARZENIA, TRYBY_GRY,
  agregujRanking, biezacyGraczTury, czyKompletna, filtrujLobby, generujKod,
  kategorieRankingu, kodPoprawny, normalizujKod, postepGracza, przeliczWyniki,
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
    { idGry: 'b', tryb: 'tury', geohash5: sasiad, miejsce: 'Obok', liczbaGraczy: 2 },
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
  const ok = walidujZdarzenieSurowe(JSON.stringify(zbudujZdarzenie({ kod: 'K2H7QM', graczId: 'g-2', typ: 'dojscie', stacjaId: 2, dane: { czasOdcinkaMs: 60000 } })));
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
    dane: { czasOdcinkaMs: 1000, lat: 52.123, lon: 20.746, szerokosc: 1, smieci: 'x', nested: { lat: 2 } },
  });
  assert.deepEqual(Object.keys(z.dane), ['czasOdcinkaMs'], 'współrzędne i śmieci zostają na telefonie (ADR 0019 pkt 3)');
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

test('biezacyGraczTury: uszkodzony stan to null, nie TypeError (telefon nie ufa mostowi)', () => {
  assert.equal(biezacyGraczTury(null), null);
  assert.equal(biezacyGraczTury({ ...graTury(), konfiguracja: null }), null);
  assert.equal(biezacyGraczTury({ ...graTury(), konfiguracja: {} }), null);
});

/* ------------------------------------------- maszynka tur i wyniki */

function graTury(zdarzenia = []) {
  return graWazna({
    tryb: TRYBY_GRY.tury, stan: 'trwa',
    gracze: [
      { id: 'g-1', pseudonim: 'Ala', dolaczyl: 't1' },
      { id: 'g-2', pseudonim: 'Bartek', dolaczyl: 't2' },
    ],
    zdarzenia,
  });
}
const odp = (graczId, stacjaId, nad = {}) => ({ kolejnosc: 1, graczId, typ: 'odpowiedz', stacjaId, dane: { poprawna: true, punktyRazem: 12, ...nad }, tSerwera: 't' });
const doj = (graczId, stacjaId, nad = {}) => ({ kolejnosc: 1, graczId, typ: 'dojscie', stacjaId, dane: { czasOdcinkaMs: 60000, ...nad }, tSerwera: 't' });

test('tury: kolejka stacja mod N jak hot-seat, rezygnacja zawęża aktywnych', () => {
  assert.equal(biezacyGraczTury(graTury()), 'g-1', 'stacja 1 → gracz 1');
  assert.equal(biezacyGraczTury(graTury([odp('g-1', 1)])), 'g-2', 'stacja 2 → gracz 2');
  assert.equal(biezacyGraczTury(graTury([odp('g-1', 1), odp('g-2', 2)])), 'g-1', 'stacja 3 → znowu gracz 1');
  assert.equal(biezacyGraczTury(graTury([odp('g-1', 1), odp('g-2', 2), odp('g-1', 3)])), null, 'wszystko zamknięte → brak tury');
  assert.equal(biezacyGraczTury(graTury([{ kolejnosc: 1, graczId: 'g-2', typ: 'rezygnacja', dane: {}, tSerwera: 't' }])), 'g-1', 'stacja 1 i tak należy do g-1');
  assert.equal(
    biezacyGraczTury(graTury([odp('g-1', 1), { kolejnosc: 2, graczId: 'g-2', typ: 'rezygnacja', dane: {}, tSerwera: 't' }])),
    'g-1',
    'rezygnacja NIE przesuwa kolejki: stacja 2 (g-2) pominięta, następna to 3 (znowu g-1)',
  );
  assert.equal(biezacyGraczTury(graWazna()), null, 'wyścig nie ma pojęcia tury');
});

test('tury: czyKompletna z rezygnacją — stacje rezygnującego są pomijane, nie blokują', () => {
  const rezygn = { kolejnosc: 2, graczId: 'g-2', typ: 'rezygnacja', dane: {}, tSerwera: 't' };
  assert.equal(czyKompletna(graTury([odp('g-1', 1), rezygn])), false, 'stacja 3 wciąż czeka na g-1');
  assert.equal(czyKompletna(graTury([odp('g-1', 1), rezygn, odp('g-1', 3)])), true, 'stacja 2 pominięta — gra domknięta');
  assert.equal(czyKompletna(graTury([rezygn, { kolejnosc: 3, graczId: 'g-1', typ: 'rezygnacja', dane: {}, tSerwera: 't' }])), true, 'wszyscy zrezygnowali = koniec');
});

test('czyKompletna: tury = N odpowiedzi; wyścig = każdy gracz N albo rezygnacja', () => {
  assert.equal(czyKompletna(graTury([odp('g-1', 1), odp('g-2', 2)])), false, 'tury: 2 z 3');
  assert.equal(czyKompletna(graTury([odp('g-1', 1), odp('g-2', 2), odp('g-1', 3)])), true, 'tury: 3 z 3');
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
  gra.zdarzenia = [doj('g-1', 1), odp('g-1', 1), doj('g-1', 2, { czasOdcinkaMs: 90000 }), odp('g-1', 2, { poprawna: false, punktyRazem: 0 })];
  const p = postepGracza(gra, 'g-1');
  assert.deepEqual({ ...p }, { stacjeZamkniete: 2, punkty: 12, poprawne: 1, bledne: 1, czasOdcinkowMs: 150000, zrezygnowal: false });
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
    { pseudonim: 'Ala', punkty: 10, poprawne: 1, bledne: 1, data: 'd2', tryb: 'tury', miejsce: 'Warszawa', geohash5: 'u3q8x', wiek: 'dorosli', tematy: ['przyroda'] },
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
