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
  czyKoniec, dystansOdcinkaM, graczNaStacji, graczPytania, ktoOdpowiada, nowaRozgrywka,
  podglad, podsumowanie, pominStacje, pytaniaStacji, skierujDoStacji, stacjeDoWyboru, startOdcinka,
  wczytajStan, zapiszOdpowiedz, zakonczOdcinek,
} from '../app/rozgrywka.js';
import { domyslnaKonfiguracja } from '../app/konfig.js';
import { stacjeProste } from '../app/stacje.js';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const PACZKA_FIXTURE = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));

const START = { lat: 52.23178, lon: 21.01234 };
const ZIARNO = 'okolica:52.23178:21.01234:1000:5:2026-09-05';
const STACJE = stacjeProste({ srodek: START, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });

/** Paczka syntetyczna: 1 pytanie na stację, `poprawna` jawna w teście. */
function paczka(stacje = STACJE, pytaniaNaStacje = 1) {
  return {
    protokol: 'PYT/1.0',
    pytania: stacje.flatMap((s) => Array.from({ length: pytaniaNaStacje }, (_, k) => ({
      id: `s${s.id}p${k + 1}`,
      stacja: s.id,
      poprawna: s.id % 4,
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
  // Rotacja pytań (2026-09-12): każde pytanie ma JEDNEGO autora — gracz z kolejki
  // na pierwsze, następny w kolejce na drugie itd. (`graczPytania`).
  for (const pytanieId of pytaniaStacji(biezacy, stacjaId)) {
    const graczId = graczPytania(biezacy, stacjaId, pytanieId);
    const pytanie = { id: pytanieId, poprawna: stacjaId % 4 };
    const wybrana = wybrane ? wybrane({ stacjaId, graczId, pytanieId }) : pytanie.poprawna;
    const wynik = zapiszOdpowiedz(biezacy, { stacjaId, graczId, pytanie, wybrana, czasMs: koniecMs + 5000 });
    assert.deepEqual(wynik.usterki, [], `odpowiedź ${pytanieId}/${graczId}`);
    biezacy = wynik.stan;
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

test('zapiszOdpowiedz: 1 pkt za poprawną, zero śladu czasowego (rev2, Partia 2)', () => {
  const stan = przejdzStacje(nowa(), { stacjaId: 1, startMs: 0, koniecMs: 300_000 });
  const odpowiedz = stan.odpowiedzi[0];
  assert.equal(odpowiedz.poprawna, true);
  assert.equal(odpowiedz.punktyPodstawowe, 1);
  assert.equal(odpowiedz.punktyRazem, 1, 'rev2: każde pytanie daje 1 pkt, bez wagi i bez premii');
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
  const ok = { id: 's1p1', poprawna: 1 };

  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 99, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G01']);
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 42, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G02'], 'gracza 42 nie ma w rozgrywce');
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 2, pytanie: ok, wybrana: 1, czasMs: 1 }).usterki.map((u) => u.kod), ['G07'], 'gracz spoza kolejki w trybie „zespół"');
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's9p9', poprawna: 0 }, wybrana: 0, czasMs: 1 }).usterki.map((u) => u.kod), ['G05']);
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
  assert.deepEqual(zapiszOdpowiedz(poDojsciu, { stacjaId: 4, pytanie: { id: 's4p1', poprawna: 0 }, wybrana: 0, czasMs: 1 }).usterki.map((u) => u.kod), ['G05'], 'nie da się odpowiedzieć na pytanie, którego nie ma');
});

/* ---------------------------------------------------------- kolejka odpowiadania */

test('odpowiada zawsze gracz z kolejki (ADR 0022 — wybór trybu usunięty)', () => {
  assert.deepEqual(ktoOdpowiada(nowa(), 1), [1]);
  assert.deepEqual(ktoOdpowiada(nowa(), 2), [2]);
  assert.equal(graczNaStacji(nowa(), 5), 2, 'stacja 5 przy 3 graczach → gracz 2');
  assert.equal(graczPytania(nowa(), 5, 's5p1'), 2, 'pierwsze pytanie stacji ma autora z kolejki');
  const stan = nowa();
  const poDojsciu = zakonczOdcinek(startOdcinka(stan, { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const pytanie = { id: 's1p1', poprawna: 1 };
  const obcy = zapiszOdpowiedz(poDojsciu, { stacjaId: 1, graczId: 2, pytanie, wybrana: 1, czasMs: 1 });
  assert.deepEqual(obcy.usterki.map((u) => u.kod), ['G07'], 'obcy gracz odrzucony kodem G07');
});

test('pytaniaNaStacje = 2: stacja zamyka się po obu pytaniach — każde dla INNEGO gracza', () => {
  const stacje3 = STACJE.slice(0, 3);
  let stan = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 3 }), stacje: stacje3, paczka: paczka(stacje3, 2), srodek: START, czasMs: 0,
  });
  assert.deepEqual(pytaniaStacji(stan, 1), ['s1p1', 's1p2']);
  // Zgłoszenie właściciela 2026-09-12: bez rotacji oba pytania stacji szły do
  // gracza z kolejki (Gracz 1) — pytania mają iść „po jednym dla kolejnych graczy".
  assert.equal(graczPytania(stan, 1, 's1p1'), 1, 'pierwsze pytanie stacji: gracz z kolejki');
  assert.equal(graczPytania(stan, 1, 's1p2'), 2, 'drugie pytanie stacji: następny gracz w kolejce');
  stan = zakonczOdcinek(startOdcinka(stan, { czasMs: 0 }).stan, { czasMs: 300_000 }).stan;
  const a = zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's1p1', poprawna: 1 }, wybrana: 1, czasMs: 1 }).stan;
  assert.equal(a.faza, FAZY.pytanie, 'pierwsze pytanie nie zamyka stacji');
  assert.equal(a.odpowiedzi[0].gracz, 1, 'pierwsze pytanie zapisał gracz z kolejki');
  const b = zapiszOdpowiedz(a, { stacjaId: 1, pytanie: { id: 's1p2', poprawna: 2 }, wybrana: 0, czasMs: 2 }).stan;
  assert.equal(b.faza, FAZY.przygotowanie);
  assert.equal(b.odpowiedzi.length, 2);
  assert.deepEqual(b.odpowiedzi.map((o) => o.gracz), [1, 2], 'każde pytanie stacji ma innego autora');
});

test('rotacja pytań: drugie pytanie należy do następnego gracza, nie do właściciela stacji (m12-87)', () => {
  // Sedno zgłoszenia z terenu: dwóch graczy, 5 stacji, po 2 pytania. Gracz 1
  // dostawał OBA pytania pierwszej stacji. Reguła: pytanie k na stacji dostaje
  // gracz z kolejki przesunięty o k (cyklicznie po liście graczy).
  const stacje = STACJE.slice(0, 2);
  const gracze = [{ id: 1, imie: 'Ania' }, { id: 2, imie: 'Bartek' }];
  let stan = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 2, liczbaGraczy: 2 }),
    stacje, paczka: paczka(stacje, 2), srodek: START, czasMs: 0, gracze,
  });

  // Stacja 1 (kolejka: Ania): pytanie 1 → Ania, pytanie 2 → Bartek.
  assert.equal(graczNaStacji(stan, 1), 1, 'stacja 1 należy do gracza z kolejki');
  assert.deepEqual(ktoOdpowiada(stan, 1), [1, 2], 'na stacji odpowiadają obaj gracze — po jednym pytaniu');
  // Stacja 2 (kolejka: Bartek): pytanie 1 → Bartek, pytanie 2 → Ania (zawinięcie).
  assert.equal(graczNaStacji(stan, 2), 2);
  assert.deepEqual(ktoOdpowiada(stan, 2), [2, 1], 'na drugiej stacji kolejność autorów jest odwrotna');

  // Odpowiedź „nie swojego" gracza na pytanie jest odmawiana kodem G07.
  stan = zakonczOdcinek(startOdcinka(stan, { stacjaId: 1, czasMs: 0 }).stan, { stacjaId: 1, czasMs: 300_000 }).stan;
  const nieSwoje = zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 2, pytanie: { id: 's1p1', poprawna: 1 }, wybrana: 1, czasMs: 1 });
  assert.deepEqual(nieSwoje.usterki.map((u) => u.kod), ['G07'], 'pytanie 1 należy do gracza z kolejki, nie do Bartka');

  // Poprawny przebieg: Ania odpowiada na pytanie 1, Bartek na pytanie 2.
  const poAni = zapiszOdpowiedz(stan, { stacjaId: 1, graczId: 1, pytanie: { id: 's1p1', poprawna: 1 }, wybrana: 1, czasMs: 1 }).stan;
  assert.equal(poAni.faza, FAZY.pytanie, 'stacja czeka na drugie pytanie');
  const drugieAni = zapiszOdpowiedz(poAni, { stacjaId: 1, graczId: 1, pytanie: { id: 's1p2', poprawna: 2 }, wybrana: 0, czasMs: 2 });
  assert.deepEqual(drugieAni.usterki.map((u) => u.kod), ['G07'], 'Ania nie odpowiada na pytanie Bartka (ta sama stacja, drugie pytanie)');
  const poBartku = zapiszOdpowiedz(poAni, { stacjaId: 1, graczId: 2, pytanie: { id: 's1p2', poprawna: 2 }, wybrana: 2, czasMs: 3 }).stan;
  assert.equal(poBartku.faza, FAZY.przygotowanie, 'po drugim pytaniu stacja się zamyka');
  assert.equal(poBartku.biezacaStacja, 2, 'gra idzie do następnej stacji');
  assert.deepEqual(poBartku.odpowiedzi.map((o) => [o.pytanieId, o.gracz, o.poprawna]), [['s1p1', 1, true], ['s1p2', 2, true]]);

  // Jedno pytanie na stację — zachowanie jak dotąd (autor = gracz z kolejki).
  const jedno = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 2, liczbaGraczy: 2 }),
    stacje, paczka: paczka(stacje, 1), srodek: START, czasMs: 0, gracze,
  });
  assert.deepEqual(ktoOdpowiada(jedno, 1), [1], 'jedno pytanie = odpowiada gracz z kolejki');
  assert.equal(graczPytania(jedno, 2, 's2p1'), 2, 'stacja 2 należy do Bartka');
});

test('rotacja pytań: trzech graczy i trzy pytania na stacji — każdy po jednym, w kolejce', () => {
  const stacje = STACJE.slice(0, 1);
  const stan = nowaRozgrywka({
    konfig: konfig({ liczbaStacji: 1, liczbaGraczy: 3, pytaniaNaStacje: 3 }),
    stacje, paczka: paczka(stacje, 3), srodek: START, czasMs: 0,
    gracze: [{ id: 1, imie: 'Ania' }, { id: 2, imie: 'Bartek' }, { id: 3, imie: 'Celina' }],
  });
  assert.deepEqual(ktoOdpowiada(stan, 1), [1, 2, 3], 'cała trójka odpowiada po jednym pytaniu');
  assert.deepEqual(
    pytaniaStacji(stan, 1).map((pid) => graczPytania(stan, 1, pid)),
    [1, 2, 3],
    'pytania idą po kolei: gracz z kolejki, następny, następny',
  );
  // Stacja 2 (gdyby była) zaczyna od gracza 2 — rotacja jest funkcją kolejki.
  assert.equal(graczPytania(stan, 9, 's9p1'), null, 'nieznana stacja nie ma autora pytania');
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
  assert.equal(kody.length, 14); // +G14: stacja zamknięta/pominięta (ADR 0027 część B)
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
  assert.deepEqual(zapiszOdpowiedz(stan, { stacjaId: 1, pytanie: { id: 's1p1', poprawna: 1 }, wybrana: 1, czasMs: t }).usterki.map((u) => u.kod), ['G10']);

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

/* ---------- ADR 0027 część B: wolna kolejność stacji (skierujDoStacji) ------ */

test('wolna kolejność: gracz idzie do stacji w swojej kolejności, nie po kolei', () => {
  let stan = nowa();
  assert.equal(stan.biezacaStacja, 1, 'na starcie bieżąca jest pierwsza stacja');

  const wybrana = skierujDoStacji(stan, { stacjaId: 4, czasMs: 1000 });
  assert.deepEqual(wybrana.usterki, [], 'wybór stacji 4 jest poprawny');
  assert.equal(wybrana.stan.biezacaStacja, 4, 'bieżąca stacja idzie za wyborem');
  assert.equal(wybrana.stan.faza, FAZY.przygotowanie, 'po wyborze wracamy do przygotowania odcinka');
  assert.ok(wybrana.stan.dziennik.some((z) => z.typ === 'wybor-stacji' && z.stacja === 4), 'wybór trafia do dziennika');

  stan = przejdzStacje(wybrana.stan, { stacjaId: 4, startMs: 2000, koniecMs: 60_000 });
  // przejdzDalej ustawił najniższą niezamkniętą — wybór i tak jest wolny
  const druga = skierujDoStacji(stan, { stacjaId: 2, czasMs: 61_000 });
  assert.deepEqual(druga.usterki, []);
  stan = przejdzStacje(druga.stan, { stacjaId: 2, startMs: 62_000, koniecMs: 120_000 });

  assert.deepEqual(stacjeDoWyboru(stan), [1, 3, 5], 'zamknięte stacje znikają z wyboru');
});

test('wolna kolejność: domknięcie wszystkich stacji w dowolnej kolejności kończy grę', () => {
  let stan = nowa();
  let czas = 0;
  for (const stacjaId of [5, 3, 1, 4, 2]) {
    const wybrana = skierujDoStacji(stan, { stacjaId, czasMs: (czas += 1000) });
    assert.deepEqual(wybrana.usterki, [], `wybór ${stacjaId}`);
    stan = przejdzStacje(wybrana.stan, { stacjaId, startMs: czas, koniecMs: (czas += 60_000) });
  }
  assert.equal(czyKoniec(stan), true, 'gra się skończyła');
  const podsumowanieStanu = podsumowanie(stan);
  assert.equal(podsumowanieStanu.zaliczoneStacje, 5, 'wszystkie stacje zaliczone');
});

test('skierujDoStacji odmawia: obca stacja, zamknięta i gra po końcu', () => {
  let stan = nowa();
  assert.equal(skierujDoStacji(stan, { stacjaId: 99, czasMs: 10 }).usterki[0].kod, 'G01', 'nieznana stacja');

  stan = przejdzStacje(stan, { stacjaId: 1, startMs: 1000, koniecMs: 60_000 });
  assert.equal(skierujDoStacji(stan, { stacjaId: 1, czasMs: 61_000 }).usterki[0].kod, 'G14', 'zamkniętej stacji nie da się wybrać drugi raz');

  let czas = 70_000;
  for (const stacjaId of stacjeDoWyboru(stan)) {
    const wybrana = skierujDoStacji(stan, { stacjaId, czasMs: (czas += 1000) });
    stan = przejdzStacje(wybrana.stan, { stacjaId, startMs: czas, koniecMs: (czas += 60_000) });
  }
  assert.equal(czyKoniec(stan), true, 'wszystko zamknięte');
  assert.equal(skierujDoStacji(stan, { stacjaId: 1, czasMs: czas + 1000 }).usterki[0].kod, 'G10', 'po końcu gry wybór jest odrzucony');
});

test('stacjeDoWyboru: lista maleje, pominięta stacja też znika', () => {
  let stan = nowa();
  assert.deepEqual(stacjeDoWyboru(stan), [1, 2, 3, 4, 5], 'na starcie wszystkie');
  const poStarcie = startOdcinka(stan, { stacjaId: 2, czasMs: 1000 });
  assert.deepEqual(stacjeDoWyboru(poStarcie.stan), [1, 3, 4, 5], 'odcinek w drodze nie wraca na listę wyboru');
  const poPominieciu = pominStacje(poStarcie.stan, { stacjaId: 2, czasMs: 2000, powod: 'test' });
  assert.deepEqual(stacjeDoWyboru(poPominieciu.stan), [1, 3, 4, 5], 'pominięta stacja zostaje poza wyborem');
});
