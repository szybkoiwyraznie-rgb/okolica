/**
 * Testy modelu rozgrywki (app/rozgrywka.js).
 *
 * Wszystko na wstrzykniętym zegarze (`czasMs` z parametru, nie `Date.now()`),
 * więc przebieg gry jest odtwarzalny co do milisekundy. Sprawdzane są reguły
 * z ADR 0009 (kolejka) oraz zasada z ADR 0007 pkt 6: treść pytań nie wchodzi
 * do stanu gry. Punktacja: dotarcie + poprawna odpowiedź, bez czasu
 * (Partia 2: ADR 0014 wycofany — premia, kara, limit i tempo usunięte).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FAZY, KODY_ROZGRYWKI, SCHEMAT_ROZGRYWKI, STANY_ODCINKA, TRYBY_DOJSCIA,
  czyKoniec, dystansOdcinkaM, graczNaStacji, ktoOdpowiada, nowaRozgrywka,
  podglad, podsumowanie, pominStacje, pytaniaStacji, startOdcinka,
  wczytajStan, zapiszOdpowiedz, zakonczOdcinek,
} from '../app/rozgrywka.js';
import { domyslnaKonfiguracja } from '../app/konfig.js';
import { stacjeProste } from '../app/stacje.js';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const PACZKA_FIXTURE = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));

const START = { lat: 52.23178, lon: 21.01234 };
const ZIARNO = 'okolica:52.23178:21.01234:1000:5:2026-09-05';
const STACJE = stacjeProste({ srodek: START, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });

/** Paczka syntetyczna: 1 pytanie na stację, `poprawna` i `punkty` jawne w teście. */
function paczka(stacje = STACJE, pytaniaNaStacje = 1) {
  return {
    protokol: 'PYT/1.0',
    pytania: stacje.flatMap((s) => Array.from({ length: pytaniaNaStacje }, (_, k) => ({
      id: `s${s.id}p${k + 1}`,
      stacja: s.id,
      poprawna: s.id % 4,
      punkty: 20,
    }))),
  };
}

function konfig(nadpisanie = {}) {
  return {
    ...domyslnaKonfiguracja(3),
    liczbaStacji: 5,
    kodGry: 'K7M2QP',
    ...nadpisanie,
  };
}

function nowa(nadpisanieKonfig = {}, args = {}) {
  return nowaRozgrywka({ konfig: konfig(nadpisanieKonfig), stacje: STACJE, paczka: paczka(), srodek: START, ziarno: ZIARNO, czasMs: 0, ...args });
}

/** Pełny odcinek: start → dojście → odpowiedzi wszystkich, którzy mają odpowiedzieć. */
function przejdzStacje(stan, { stacjaId = stan.biezacaStacja, startMs, koniecMs, trybDojscia = TRYBY_DOJSCIA.gps, fix = null, wybrane = null } = {}) {
  const poStarcie = startOdcinka(stan, { stacjaId, czasMs: startMs });
  assert.deepEqual(poStarcie.usterki, [], `start odcinka ${stacjaId}`);
  const poDojsciu = zakonczOdcinek(poStarcie.stan, { stacjaId, czasMs: koniecMs, trybDojscia, fix });
  assert.deepEqual(poDojsciu.usterki, [], `dojście ${stacjaId}`);
  let biezacy = poDojsciu.stan;
  for (const graczId of ktoOdpowiada(biezacy, stacjaId)) {
    for (const pytanieId of pytaniaStacji(biezacy, stacjaId)) {
      const pytanie = { id: pytanieId, poprawna: stacjaId % 4, punkty: 20 };
      const wybrana = wybrane ? wybrane({ stacjaId, graczId, pytanieId }) : pytanie.poprawna;
      const wynik = zapiszOdpowiedz(biezacy, { stacjaId, graczId, pytanie, wybrana, czasMs: koniecMs + 5000 });
      assert.deepEqual(wynik.usterki, [], `odpowiedź ${pytanieId}/${graczId}`);
      biezacy = wynik.stan;
    }
  }
  return biezacy;
}

/** Gra do końca: 5 stacji, 3 graczy, stałe czasy — potrzebna kilku testom. */
function zakonczGre() {
  let stan = nowa();
  const czasy = [300_000, 260_000, 340_000, 280_000, 320_000];
  let t = 0;
  for (let i = 0; i < 5; i++) {
    stan = przejdzStacje(stan, { stacjaId: STACJE[i].id, startMs: t, koniecMs: t + czasy[i] });
    t += czasy[i] + 20_000;
  }
  return stan;
}

/* ------------------------------------------------------------------- struktura */

test('nowaRozgrywka: schemat, faza, kolejka cykliczna i odcinek na stację', () => {
  const stan = nowa();
  assert.equal(stan.schemat, SCHEMAT_ROZGRYWKI);
  assert.equal(stan.faza, FAZY.przygotowanie);
  assert.equal(stan.biezacaStacja, STACJE[0].id);
  assert.equal(stan.odcinki.length, 5);
  assert.deepEqual(stan.gracze.map((g) => g.id), [1, 2, 3]);
  assert.deepEqual(stan.gracze.map((g) => g.imie), ['Gracz 1', 'Gracz 2', 'Gracz 3']);
  // ADR 0009 pkt 2: gracz = stacja mod N (5 stacji, 3 graczy)
  assert.deepEqual(stan.odcinki.map((o) => o.gracz), [1, 2, 3, 1, 2]);
  assert.deepEqual(stan.odcinki.map((o) => o.stan), Array(5).fill(STANY_ODCINKA.oczekuje));
  assert.equal(stan.kodGry, 'K7M2QP');
  assert.deepEqual(stan.dziennik[0].typ, 'start');
  assert.equal(stan.dziennik[0].stacji, 5);
});

test('nowaRozgrywka: imiona z konfiguracji i własna lista graczy', () => {
  const zImionami = nowaRozgrywka({
    konfig: konfig({ imiona: ['Ada', 'Bartek', 'Celina'] }),
    stacje: STACJE, paczka: paczka(), srodek: START, czasMs: 0,
  });
  assert.deepEqual(zImionami.gracze.map((g) => g.imie), ['Ada', 'Bartek', 'Celina']);

  const wlasna = nowaRozgrywka({
    konfig: konfig(), stacje: STACJE, paczka: paczka(), srodek: START, czasMs: 0,
    gracze: [{ id: 7, imie: 'Zespół A' }],
  });
  assert.deepEqual(wlasna.odcinki.map((o) => o.gracz), [7, 7, 7, 7, 7], 'jeden gracz idzie do wszystkich stacji');
});

test('nowaRozgrywka: treść pytań NIE wchodzi do stanu (ADR 0007 pkt 6)', () => {
  const stan = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 3 }),
    stacje: STACJE.slice(0, 3),
    paczka: PACZKA_FIXTURE, // prawdziwe treści z fixture: „Grabowice", „1342", wyjaśnienia
    srodek: START,
    czasMs: 0,
  });
  assert.deepEqual(stan.pytania, [
    { stacja: 1, pytanieId: 's1p1' },
    { stacja: 2, pytanieId: 's2p1' },
    { stacja: 3, pytanieId: 's3p1' },
  ], 'z paczki bierzemy tylko przypisanie stacja → identyfikator pytania');
  const calyStan = JSON.stringify(stan);
  // fragmenty wyłącznie z treści paczki (nie z nazw pól stanu)
  for (const fragment of ['Grabowice', 'rynek', '1342', '1527', 'Siemowit', 'archiwum', 'wikipedia', 'temat']) {
    assert.ok(!calyStan.includes(fragment), `stan gry zawiera „${fragment}" — treść pytań nie ma prawa tu trafić`);
  }
});

test('nowaRozgrywka: odrzuca bezsensowne argumenty', () => {
  assert.throws(() => nowaRozgrywka({ konfig: null, stacje: STACJE, paczka: paczka(), srodek: START }), TypeError);
  assert.throws(() => nowaRozgrywka({ konfig: konfig(), stacje: [], paczka: paczka(), srodek: START }), TypeError);
  assert.throws(() => nowaRozgrywka({ konfig: konfig(), stacje: STACJE, paczka: { pytania: [] }, srodek: START }), TypeError);
  assert.throws(() => nowaRozgrywka({ konfig: konfig(), stacje: STACJE, paczka: paczka(), srodek: { lat: 'x', lon: 1 } }), TypeError);
  assert.throws(() => nowaRozgrywka({ konfig: konfig(), stacje: STACJE, paczka: paczka(), srodek: START, czasMs: 'teraz' }), TypeError);
});

/* ------------------------------------------------------------------- odcinki */

test('startOdcinka: jawna akcja, faza i dystans odcinka', () => {
  const stan = nowa();
  const { stan: po, usterki } = startOdcinka(stan, { czasMs: 1000 });
  assert.deepEqual(usterki, []);
  assert.equal(po.faza, FAZY.odcinek);
  assert.equal(po.odcinki[0].stan, STANY_ODCINKA.wTrakcie);
  assert.equal(po.odcinki[0].startMs, 1000);
  assert.ok(po.odcinki[0].dystansM > 500 && po.odcinki[0].dystansM < 1000, `dystans ${po.odcinki[0].dystansM} m`);
  assert.equal(po.dziennik.at(-1).typ, 'start-odcinka');
});

test('startOdcinka: odmowa przy obcej stacji, ponownym starcie i po końcu gry', () => {
  const stan = nowa();
  assert.deepEqual(startOdcinka(stan, { stacjaId: 99, czasMs: 0 }).usterki.map((u) => u.kod), ['G01']);
  const poStarcie = startOdcinka(stan, { czasMs: 0 }).stan;
  assert.deepEqual(startOdcinka(poStarcie, { czasMs: 10 }).usterki.map((u) => u.kod), ['G03']);
  assert.ok(KODY_ROZGRYWKI.G03.length > 10, 'komunikat musi być pełnym zdaniem dla UI');
});

test('zakonczOdcinek: znaczniki kolejności, dokładność i odległość końcowa', () => {
  const stan = startOdcinka(nowa(), { czasMs: 10_000 }).stan;
  const stacja = STACJE[0];
  const fix = { lat: stacja.lat + 0.00005, lon: stacja.lon, accuracy: 12 };
  const { stan: po, usterki } = zakonczOdcinek(stan, { czasMs: 400_000, fix });
  assert.deepEqual(usterki, []);
  assert.equal(po.odcinki[0].startMs, 10_000);
  assert.equal(po.odcinki[0].koniecMs, 400_000);
  assert.equal(po.odcinki[0].czasS, undefined, 'odcinek nie niesie czasu (Partia 2)');
  assert.equal(po.odcinki[0].accuracyM, 12);
  assert.equal(po.odcinki[0].trybDojscia, 'gps');
  assert.ok(po.odcinki[0].odlegloscKoncowaM < 20, `odległość końcowa ${po.odcinki[0].odlegloscKoncowaM} m`);
  assert.equal(po.faza, FAZY.pytanie);
});

test('zakonczOdcinek: ręczne zgłoszenie bez kary (Partia 2: tryb pełnoprawny, ADR 0004 pkt 5)', () => {
  const start = startOdcinka(nowa(), { czasMs: 0 }).stan;
  const { stan: po } = zakonczOdcinek(start, { czasMs: 300_000, trybDojscia: TRYBY_DOJSCIA.reczne });
  assert.equal(po.odcinki[0].trybDojscia, TRYBY_DOJSCIA.reczne);
  assert.equal(po.odcinki[0].karaS, undefined, 'kara czasowa usunięta');
  assert.equal(po.dziennik.at(-1).typ, 'dojscie');
  assert.equal(po.dziennik.at(-1).trybDojscia, TRYBY_DOJSCIA.reczne);
});

test('zakonczOdcinek: odmowa przed startem, po zakończeniu i przy ujemnym czasie', () => {
  const stan = nowa();
  assert.deepEqual(zakonczOdcinek(stan, { czasMs: 1000 }).usterki.map((u) => u.kod), ['G04']);
  const po = zakonczOdcinek(startOdcinka(stan, { czasMs: 0 }).stan, { czasMs: 1000 }).stan;
  assert.deepEqual(zakonczOdcinek(po, { czasMs: 2000 }).usterki.map((u) => u.kod), ['G03']);
  const wTrakcie = startOdcinka(stan, { czasMs: 5000 }).stan;
  assert.deepEqual(zakonczOdcinek(wTrakcie, { czasMs: 4000 }).usterki.map((u) => u.kod), ['G09']);
  assert.throws(() => zakonczOdcinek(wTrakcie, { czasMs: 6000, trybDojscia: 'teleportacja' }), TypeError);
});

/* ------------------------------------------------------------------ punktacja */

test('zapiszOdpowiedz: punkty za poprawną, zero śladu czasowego (Partia 2)', () => {
  const stan = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  const odpowiedz = stan.odpowiedzi[0];
  assert.equal(odpowiedz.poprawna, true);
  assert.equal(odpowiedz.punktyPodstawowe, 20);
  assert.equal(odpowiedz.punktyRazem, 20, 'punkty = baza, bez premii');
  assert.deepEqual(Object.keys(odpowiedz).sort(), ['gracz', 'poprawna', 'punktyPodstawowe', 'punktyRazem', 'pytanieId', 'stacja', 'wybrana']);
  assert.equal(stan.dziennik.at(-1).typ, 'odpowiedz');
});

test('zapiszOdpowiedz: błędna odpowiedź daje zero punktów', () => {
  const stan = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 120_000, wybrane: ({ pytanieId }) => (Number(pytanieId.slice(1, 2)) % 4) + 1 > 3 ? 0 : ((STACJE[0].id % 4) + 1) % 4 });
  const odpowiedz = stan.odpowiedzi[0];
  assert.equal(odpowiedz.poprawna, false);
  assert.equal(odpowiedz.punktyPodstawowe, 0);
  assert.equal(odpowiedz.punktyRazem, 0);
});

test('zapiszOdpowiedz: kody usterek G01/G02/G05/G06/G07/G08/G10', () => {
  const stan = zakonczOdcinek(startOdcinka(nowa(), { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const ok = { id: 's1p1', poprawna: 1, punkty: 20 };

  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 99, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G01']);
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 42, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G02'], 'gracza 42 nie ma w rozgrywce');
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 2, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G07'], 'gracz spoza kolejki w trybie „zespół"');
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's9p9', poprawna: 0, punkty: 20 }, wybrana: 0, czasMs: 1 }).usterki.map((u) => u.kod), ['G05']);
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: ok, wybrana: 7, czasMs: 1 }).usterki.map((u) => u.kod), ['G08']);

  const po = zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: ok, wybrana: 1, czasMs: 1 }).stan;
  assert.deepEqual(zapiszOdpowiedz(po, { stacjaId: 1, graczId: 1, pytanie: ok, wybrana: 1, czasMs: 2 }).usterki.map((u) => u.kod), ['G06']);
  assert.equal(po.faza, FAZY.przygotowanie, 'po zamknięciu stacji gra idzie dalej');
  assert.throws(() => zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: null, wybrana: 1, czasMs: 1 }), TypeError);
});

/* --------------------------------------------------- paczka bez pełnego pokrycia */

test('brakPytan: paczka na 3 stacje przy grze na 5 — jawne ostrzeżenie, nie cichy brak', () => {
  const stan = nowa({}, { paczka: paczka(STACJE.slice(0, 3)) });
  assert.deepEqual(stan.brakPytan, [4, 5]);
  const ostrzezenie = stan.dziennik.find((z) => z.typ === 'ostrzezenie');
  assert.equal(ostrzezenie.kod, 'BRAK-PYTAN');
  assert.deepEqual(ostrzezenie.stacje, [4, 5]);
  assert.match(ostrzezenie.komunikat, /nie ma pytań do stacji: 4, 5/);
  assert.match(ostrzezenie.komunikat, /protokół §3\.2/, 'komunikat ma mówić, co zrobić');
  assert.equal(podglad(stan).pytan, 1);
  assert.deepEqual(podsumowanie(stan).stacjeBezPytan, [4, 5]);
});

test('brakPytan: pełne pokrycie = brak ostrzeżenia w dzienniku', () => {
  const stan = nowa();
  assert.deepEqual(stan.brakPytan, []);
  assert.deepEqual(stan.dziennik.filter((z) => z.typ === 'ostrzezenie'), []);
});

test('stacja bez pytania: dojście zamyka ją bez punktów i gra idzie dalej', () => {
  // paczka pokrywa stacje 1–3, gramy na 5: stacje 4 i 5 nie mają pytania
  let stan = nowa({}, { paczka: paczka(STACJE.slice(0, 3)) });
  const czasy = [300_000, 280_000, 320_000];
  let t = 0;
  for (let i = 0; i < 3; i++) {
    stan = przejdzStacje(stan, { stacjaId: i + 1, startMs: t, koniecMs: t + czasy[i] });
    t += czasy[i] + 20_000;
  }
  assert.equal(stan.biezacaStacja, 4);
  assert.equal(podglad(stan).pytan, 0, 'do stacji 4 paczka nie ma pytania');
  assert.equal(podglad(stan).pytanie, null);

  const poDojsciu = zakonczOdcinek(startOdcinka(stan, { stacjaId: 4, czasMs: 1_000_000 }).stan, { stacjaId: 4, czasMs: 1_300_000 }).stan;
  assert.equal(poDojsciu.odcinki[3].stan, STANY_ODCINKA.zakonczony);
  assert.equal(poDojsciu.biezacaStacja, 5, 'stacja bez pytania zamyka się samym dojściem');
  assert.equal(poDojsciu.odpowiedzi.length, 3, 'odpowiedzi tylko z stacji 1–3');
  assert.deepEqual(podsumowanie(poDojsciu).stacjeBezPytan, [4, 5]);
  assert.deepEqual(zapiszOdpowiedz(poDojsciu, { stacjaId: 4, pytanie: { id: 's4p1', poprawna: 0, punkty: 20 }, wybrana: 0, czasMs: 1 }).usterki.map((u) => u.kod), ['G05'], 'nie da się odpowiedzieć na pytanie, którego nie ma');
});

/* ---------------------------------------------------------- kolejka odpowiadania */

test('odpowiada zawsze gracz z kolejki (ADR 0022 — wybór trybu usunięty)', () => {
  assert.deepEqual(ktoOdpowiada(nowa(), 1), [1]);
  assert.deepEqual(ktoOdpowiada(nowa(), 2), [2]);
  assert.equal(graczNaStacji(nowa(), 5), 2, 'stacja 5 przy 3 graczach → gracz 2');
  const stan = nowa();
  const poDojsciu = zakonczOdcinek(startOdcinka(stan, { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const pytanie = { id: 's1p1', poprawna: 1, punkty: 20 };
  const obcy = zapiszOdpowiedz(poDojsciu, { stacjaId: 1, graczId: 2, pytanie, wybrana: 1, czasMs: 1 });
  assert.deepEqual(obcy.usterki.map((u) => u.kod), ['G07'], 'obcy gracz odrzucony kodem G07');
});

test('pytaniaNaStacje = 2: stacja zamyka się po obu pytaniach', () => {
  const stacje3 = STACJE.slice(0, 3);
  let stan = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 3 }), stacje: stacje3, paczka: paczka(stacje3, 2), srodek: START, czasMs: 0,
  });
  assert.deepEqual(pytaniaStacji(stan, 1), ['s1p1', 's1p2']);
  stan = zakonczOdcinek(startOdcinka(stan, { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const a = zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's1p1', poprawna: 1, punkty: 15 }, wybrana: 1, czasMs: 1 }).stan;
  assert.equal(a.faza, FAZY.pytanie, 'pierwsze pytanie nie zamyka stacji');
  const b = zapiszOdpowiedz(a, { stacjaId: 1, pytanie: { id: 's1p2', poprawna: 2, punkty: 15 }, wybrana: 0, czasMs: 2 }).stan;
  assert.equal(b.faza, FAZY.przygotowanie);
  assert.equal(b.odpowiedzi.length, 2);
});

/* ----------------------------------------------------------------- pomijanie */

test('pominStacje: tylko w trakcie odcinka, bez punktów, z wpisem w dzienniku', () => {
  const stan = nowa();
  assert.deepEqual(pominStacje(stan, { stacjaId: 1, czasMs: 0 }).usterki.map((u) => u.kod), ['G11'], 'nie można pominąć odcinka, który się nie zaczął');
  const wTrakcie = startOdcinka(stan, { czasMs: 0 }).stan;
  const { stan: po, usterki } = pominStacje(wTrakcie, { stacjaId: 1, czasMs: 60_000, powod: 'remont mostu' });
  assert.deepEqual(usterki, []);
  assert.equal(po.odcinki[0].stan, STANY_ODCINKA.pominiety);
  assert.equal(po.biezacaStacja, 2);
  assert.equal(po.odpowiedzi.length, 0);
  assert.equal(po.dziennik.at(-1).typ, 'pominiecie');
  assert.equal(po.dziennik.at(-1).powod, 'remont mostu');
  assert.deepEqual(pominStacje(po, { stacjaId: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G03']);
});

test('pominStacje: po dojściu do stacji pominąć się nie da (G13)', () => {
  const poDojsciu = zakonczOdcinek(startOdcinka(nowa(), { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const { stan: po, usterki } = pominStacje(poDojsciu, { stacjaId: 1, czasMs: 301_000 });
  assert.deepEqual(usterki.map((u) => u.kod), ['G13']);
  assert.equal(po.odcinki[0].stan, STANY_ODCINKA.zakonczony, 'odmowa nie zmienia stanu');
  assert.match(usterki[0].komunikat, /Odpowiedz na pytanie/, 'komunikat mówi, co zrobić zamiast tego');
});

test('ostatnia stacja bez pytania: dojście kończy grę, nie zostawia pustego ekranu', () => {
  let stan = nowa({}, { paczka: paczka(STACJE.slice(0, 4)) }); // stacja 5 bez pytania
  const czasy = [300_000, 280_000, 320_000, 260_000];
  let t = 0;
  for (let i = 0; i < 4; i++) {
    stan = przejdzStacje(stan, { stacjaId: i + 1, startMs: t, koniecMs: t + czasy[i] });
    t += czasy[i] + 20_000;
  }
  assert.equal(stan.biezacaStacja, 5);
  const { stan: po } = zakonczOdcinek(startOdcinka(stan, { stacjaId: 5, czasMs: t }).stan, { stacjaId: 5, czasMs: t + 200_000 });
  assert.equal(po.faza, FAZY.koniec, 'dojście do stacji bez pytania zamyka grę');
  assert.equal(czyKoniec(po), true);
  assert.equal(po.biezacaStacja, null);
  assert.equal(podsumowanie(po).zaliczoneStacje, 5);
  assert.deepEqual(podsumowanie(po).stacjeBezPytan, [5]);
  assert.equal(po.odpowiedzi.length, 4);
});

test('KODY_ROZGRYWKI: każdy komunikat jest pełnym zdaniem gotowym do UI', () => {
  const kody = Object.entries(KODY_ROZGRYWKI);
  assert.equal(kody.length, 13);
  for (const [kod, komunikat] of kody) {
    assert.match(kod, /^G\d{2}$/, `kod ${kod}`);
    assert.ok(komunikat.length >= 25, `${kod}: komunikat za krótki — „${komunikat}"`);
    assert.ok(komunikat.endsWith('.'), `${kod}: komunikat musi kończyć się kropką`);
    assert.ok(komunikat === komunikat.trim(), `${kod}: bez białych znaków na końcach`);
  }
});

/* ------------------------------------------------------------- pełna gra */

test('pełna gra 3 graczy × 5 stacji: od startu do podsumowania', () => {
  let stan = nowa();
  const czasy = [300_000, 260_000, 340_000, 280_000, 320_000]; // ms na odcinek
  let t = 0;
  for (let i = 0; i < 5; i++) {
    stan = przejdzStacje(stan, { stacjaId: STACJE[i].id, startMs: t, koniecMs: t + czasy[i] });
    t += czasy[i] + 20_000;
  }
  assert.equal(czyKoniec(stan), true);
  assert.equal(stan.faza, FAZY.koniec);
  assert.equal(stan.biezacaStacja, null);
  assert.equal(stan.odpowiedzi.length, 5);
  assert.equal(stan.dziennik.at(-1).typ, 'koniec');
  assert.deepEqual(startOdcinka(stan, { stacjaId: 1, czasMs: t }).usterki.map((u) => u.kod), ['G10'], 'po końcu gry nie ma nowych odcinków');
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's1p1', poprawna: 1, punkty: 20 }, wybrana: 1, czasMs: t }).usterki.map((u) => u.kod), ['G10']);

  const s = podsumowanie(stan);
  assert.equal(s.zaliczoneStacje, 5);
  assert.equal(s.pominietaStacje, 0);
  assert.equal(s.czasGryS, undefined, 'podsumowanie bez czasu gry (Partia 2)');
  assert.equal(s.gracze.length, 3);
  assert.equal(s.punktyRazem, s.gracze.reduce((suma, g) => suma + g.punkty, 0));
  assert.deepEqual(s.ranking.slice().sort((a, b) => a - b), [1, 2, 3]);
  assert.ok(s.gracze.every((g) => Number.isFinite(g.punkty)));
  // gracz 1 idzie do stacji 1 i 4, gracz 2 do 2 i 5, gracz 3 do 3
  assert.deepEqual(s.gracze.map((g) => g.odcinki), [2, 2, 1]);
  assert.ok(s.zwyciezca >= 1 && s.zwyciezca <= 3);
  assert.equal(s.stacje.length, 5);
  assert.equal(s.zdarzen, stan.dziennik.length);
});

test('pełna gra z błędnymi odpowiedziami i ręcznym dojściem: punkty i tryb dojścia widoczne', () => {
  let stan = nowa();
  stan = przejdzStacje(stan, { stacjaId: 1, startMs: 0, koniecMs: 200_000, wybrane: () => 0 }); // poprawna = 1, więc 0 to błąd
  stan = przejdzStacje(stan, { stacjaId: 2, startMs: 300_000, koniecMs: 700_000, trybDojscia: TRYBY_DOJSCIA.reczne });
  const s = podsumowanie(stan);
  const gracz1 = s.gracze.find((g) => g.id === 1);
  const gracz2 = s.gracze.find((g) => g.id === 2);
  assert.equal(gracz1.poprawne, 0);
  assert.equal(gracz1.bledne, 1);
  assert.equal(gracz1.punkty, 0);
  assert.equal(gracz2.reczneDojscia, 1);
  assert.equal(stan.odcinki[1].trybDojscia, TRYBY_DOJSCIA.reczne);
});

test('podsumowanie: gra w trakcie i gra z pominiętą stacją', () => {
  const wTrakcie = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  const s1 = podsumowanie(wTrakcie);
  assert.equal(s1.faza, FAZY.przygotowanie);
  assert.equal(s1.zaliczoneStacje, 1);

  const zPominieta = pominStacje(startOdcinka(wTrakcie, { stacjaId: 2, czasMs: 400_000 }).stan, { stacjaId: 2, czasMs: 500_000 }).stan;
  const s2 = podsumowanie(zPominieta);
  assert.equal(s2.pominietaStacje, 1);
  assert.equal(s2.zaliczoneStacje, 1);
  assert.equal(s2.stacje[1].stan, STANY_ODCINKA.pominiety);
  // podgląd i podsumowanie muszą pokazywać te same liczby
  const p2 = podglad(zPominieta);
  assert.equal(p2.zaliczoneStacje, s2.zaliczoneStacje);
  assert.equal(p2.pominietaStacje, s2.pominietaStacje);
  assert.equal(p2.pozostaloStacje, 3);
});

test('podglad: dane dla cienkiej warstwy UI', () => {
  const stan = nowa();
  const p = podglad(stan);
  assert.equal(p.faza, FAZY.przygotowanie);
  assert.equal(p.stacja.id, 1);
  assert.deepEqual(p.gracz, { id: 1, imie: 'Gracz 1' });
  assert.deepEqual(p.odpowiadaja, [1]);
  assert.equal(p.pytanie, 's1p1');
  assert.equal(p.pytan, 1);
  assert.equal(p.zaliczoneStacje, 0);
  assert.equal(p.pozostaloStacje, 5);
  assert.ok(p.dystansM > 0);
  const dalej = podglad(przejdzStacje(stan, { stacjaId: 1, startMs: 0, koniecMs: 300_000 }));
  assert.equal(dalej.stacja.id, 2);
  assert.equal(dalej.zaliczoneStacje, 1);
  assert.equal(dalej.pozostaloStacje, 4);
  assert.equal(dalej.gracz.id, 2);
  assert.equal(dalej.pytanie, 's2p1');
});

test('podglad po końcu gry: brak bieżącej stacji, gracza i pytania', () => {
  const koncowy = zakonczGre();
  const p = podglad(koncowy);
  assert.equal(p.faza, FAZY.koniec);
  assert.equal(p.stacja, null);
  assert.equal(p.gracz, null);
  assert.deepEqual(p.odpowiadaja, []);
  assert.equal(p.pytanie, null);
  assert.equal(p.zaliczoneStacje, 5);
  assert.equal(p.pozostaloStacje, 0);
});

/* -------------------------------------------------- niezmiennikowość i trwałość */

test('funkcje nie mutują stanu wejściowego (UI trzyma referencje)', () => {
  const stan = nowa();
  const przed = JSON.stringify(stan);
  startOdcinka(stan, { czasMs: 1000 });
  assert.equal(JSON.stringify(stan), przed, 'startOdcinka zmienił argument');
  const poStarcie = startOdcinka(stan, { czasMs: 1000 }).stan;
  const przedKoncem = JSON.stringify(poStarcie);
  zakonczOdcinek(poStarcie, { czasMs: 2000 });
  assert.equal(JSON.stringify(poStarcie), przedKoncem, 'zakonczOdcinek zmienił argument');
});

test('wczytajStan: round-trip przez JSON, odmowa przy obcym schemacie i uszkodzeniu', () => {
  const stan = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  const { stan: wczytany, usterki } = wczytajStan(JSON.stringify(stan));
  assert.deepEqual(usterki, []);
  assert.deepEqual(wczytany, stan, 'stan musi przetrwać serializację bez zmian');

  assert.deepEqual(wczytajStan({ ...stan, schemat: 'rozgrywka/0' }).usterki.map((u) => u.kod), ['G12']);
  assert.match(wczytajStan({ ...stan, schemat: 'rozgrywka/0' }).usterki[0].komunikat, /migracja/);
  assert.deepEqual(wczytajStan(null).usterki.map((u) => u.kod), ['G12']);
  assert.deepEqual(wczytajStan('to nie json').usterki.map((u) => u.kod), ['G12']);
  assert.deepEqual(wczytajStan({ ...stan, odcinki: 'nie lista' }).usterki.map((u) => u.kod), ['G12']);
  assert.deepEqual(wczytajStan({ ...stan, faza: 'kosmos' }).usterki.map((u) => u.kod), ['G12']);
  assert.deepEqual(wczytajStan({ ...stan, brakPytan: 'nie lista' }).usterki.map((u) => u.kod), ['G12']);
});

test('determinizm: te same wejścia i ten sam zegar dają identyczny stan', () => {
  const a = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  const b = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  assert.deepEqual(a, b);
});

test('dystansOdcinkaM: pierwszy odcinek od startu, kolejne od poprzedniej stacji', async () => {
  const stan = nowa();
  const d1 = dystansOdcinkaM(stan, 1);
  const d2 = dystansOdcinkaM(stan, 2);
  assert.ok(d1 > 600 && d1 < 900, `pierwszy odcinek ${d1} m — pierścień 0,65–0,85 R`);
  assert.ok(d2 > 100 && d2 < 2000, `drugi odcinek ${d2} m — od stacji 1, nie od startu`);
  const { odlegloscM } = await import('../app/geo.js');
  assert.equal(d1, Math.round(odlegloscM(START, STACJE[0])), 'pierwszy odcinek: start gry → stacja 1');
  assert.equal(d2, Math.round(odlegloscM(STACJE[0], STACJE[1])), 'drugi odcinek: stacja 1 → stacja 2');
  assert.equal(dystansOdcinkaM(stan, 99), 0);
});

test('nowaRozgrywka: dystanse sieciowe z parametru, fallback do prostej na nullach', () => {
  const stan = nowa({}, { dystanseOdcinkowM: [812, 410, null, 700, 555] });
  assert.deepEqual(stan.odcinki.map((o) => o.dystansM).slice(0, 2), [812, 410]);
  assert.deepEqual(stan.odcinki.map((o) => o.dystansM).slice(3), [700, 555]);
  assert.ok(stan.odcinki[2].dystansM > 0, 'null = fallback do linii prostej');
  assert.deepEqual(stan.odcinki.map((o) => o.dystansSieciowy), [true, true, false, true, true]);
  const pod = podglad(stan);
  assert.equal(pod.dystansM, 812, 'podgląd niesie dystans odcinka (sieciowy)');
  assert.equal(pod.dystansSieciowy, true, 'podgląd mówi, skąd jest dystans');
  // bez parametru: jak dotąd (prosta kreska, flaga false) — zestawy, multi, stare zapisy
  const prosta = nowa();
  assert.ok(prosta.odcinki.every((o) => o.dystansSieciowy === false));
  assert.equal(podglad(prosta).dystansSieciowy, false);
  assert.throws(() => nowa({}, { dystanseOdcinkowM: [1, 2] }), /długości/, 'zła długość to fail-fast, nie ciche przesunięcie');
});
