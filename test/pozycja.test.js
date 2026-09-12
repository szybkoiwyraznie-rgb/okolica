/**
 * Testy warstwy pozycji (app/pozycja.js).
 *
 * Reguły dojścia działają na **fixture'ach fixów**, nie na atrapach
 * `navigator.geolocation` (ADR 0004, konsekwencje): `test/fixtures/trasa-odbicie.json`
 * ma sekwencję z odbiciem sygnału, a `sekwencjaSymulowana()` daje trasę
 * odtwarzalną co do milisekundy. Jedyna atrapa w tym pliku to obiekt z
 * `watchPosition` / `clearWatch` — właśnie po to `geolocation` jest parametrem
 * `watchPozycja()`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BLEDY_API, GRANICE, KODY_POZYCJI, OPCJE_WATCH, PROFILE_GPS, PROG_BATERII_M, STANY_FIXA, ZEGAR_MILCZENIA_MS, ZRODLA_FIXA, profilBaterii,
  bladGeolokalizacji, czyMilczy, dodajFix, fixSymulowany, fixZPozycji, komunikatMilczenia, komunikatPauzy, komunikatWznowienia,
  ocenFix, punktNaTrasie, sekwencjaSymulowana, sprawdzTrase, stanDojscia,
  trasaProsta, watchPozycja,
} from '../app/pozycja.js';
import { odlegloscM } from '../app/geo.js';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const TRASA_ODBICIE = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'trasa-odbicie.json'), 'utf8'));
const STACJA = TRASA_ODBICIE.stacja;
const START = { lat: 52.23178, lon: 21.01234 };

/** Fix z fixture'a na rekord modułu. */
const fixZFixturea = (fix) => ({ lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy, czasMs: fix.t, zrodlo: ZRODLA_FIXA.gps });

/** Historia po pierwszych `ile` fixach z fixture'a (przez `dodajFix`, jak w aplikacji). */
function historiaZFixturea(ile) {
  let historia = [];
  for (const fix of TRASA_ODBICIE.fixy.slice(0, ile)) historia = dodajFix(historia, fixZFixturea(fix));
  return historia;
}

/** Atrapa `navigator.geolocation` — zapisuje wywołania i daje ręczne sterowanie. */
function atrapaGeolokalizacji() {
  const wywolania = { watch: [], clear: [], opcje: null };
  let ostatniOk = null;
  let ostatniBlad = null;
  return {
    wywolania,
    geolocation: {
      watchPosition(ok, blad, opcje) {
        wywolania.watch.push({ ok, blad });
        wywolania.opcje = opcje;
        ostatniOk = ok;
        ostatniBlad = blad;
        return 42; // identyfikator watcha
      },
      clearWatch(id) {
        wywolania.clear.push(id);
      },
    },
    /** Uruchamia callback sukcesu przeglądarki. */
    wyslijPozycje(pozycja) { ostatniOk(pozycja); },
    /** Uruchamia callback błędu przeglądarki. */
    wyslijBlad(blad) { ostatniBlad(blad); },
  };
}

function pozycjaPrzegladarki(lat, lon, accuracy, timestamp = 1000) {
  return { coords: { latitude: lat, longitude: lon, accuracy }, timestamp };
}

/* ------------------------------------------------------------------- fix i filtr */

test('fixZPozycji: spłaszcza obiekt przeglądarki i nie zmyśla czasu', () => {
  const fix = fixZPozycji(pozycjaPrzegladarki(52.23, 21.01, 15), 12_345);
  assert.deepEqual(fix, { lat: 52.23, lon: 21.01, accuracy: 15, czasMs: 12345, zrodlo: 'gps' });
  assert.equal(fix.czasMs, 12_345, 'czas jest parametrem — moduł nie czyta zegara systemowego');
});

test('fixZPozycji: przyjmuje już płaski fix i toleruje brak accuracy', () => {
  assert.deepEqual(fixZPozycji({ lat: 52.2, lon: 21.0 }, 5), { lat: 52.2, lon: 21.0, accuracy: null, czasMs: 5, zrodlo: 'gps' });
  const reczny = fixZPozycji(pozycjaPrzegladarki(52.2, 21.0, 8), 7, ZRODLA_FIXA.reczne);
  assert.equal(reczny.zrodlo, 'reczne', 'źródło fixa trafia do dziennika (ADR 0004 pkt 5)');
  assert.ok(Number.isNaN(fixZPozycji(pozycjaPrzegladarki('abc', 21.0, 8), 7).lat), 'śmieci na wejściu wychodzą jako NaN — ocenFix je odrzuci');
});

test('ocenFix: ignoruje accuracy, odrzuca tylko niepoprawne współrzędne', () => {
  for (const accuracy of [null, 0, 12, 300, 1250]) {
    assert.deepEqual(ocenFix({ lat: 52.23, lon: 21.01, accuracy }), {
      stan: 'ok', akceptowany: true, kod: null, komunikat: '', progM: 50,
    });
  }
  for (const fix of [null, { lat: 91, lon: 21 }, { lat: NaN, lon: 21 }]) {
    assert.equal(ocenFix(fix).akceptowany, false);
    assert.equal(ocenFix(fix).kod, 'P06');
  }
});

test('dodajFix: nie mutuje historii, odrzuca śmieci i trzyma limit', () => {
  const historia = [{ lat: 52.23, lon: 21.01, accuracy: 10, czasMs: 0 }];
  const kopia = [...historia];
  const po = dodajFix(historia, { lat: 52.231, lon: 21.011, accuracy: 12, czasMs: 1000 });
  assert.deepEqual(historia, kopia, 'argument nie może być zmieniony (stan jest niezmiennikowy)');
  assert.equal(po.length, 2);
  assert.equal(po[1].czasMs, 1000);

  const zSmieciem = dodajFix(po, { lat: 91, lon: 21.011, accuracy: 12, czasMs: 2000 });
  assert.equal(zSmieciem.length, 2, 'niepoprawny fix nie wchodzi do historii');

  let dluga = [];
  for (let i = 0; i < 60; i++) dluga = dodajFix(dluga, { lat: 52.23 + i * 0.0001, lon: 21.01, accuracy: 10, czasMs: i });
  assert.equal(dluga.length, GRANICE.historiaFixow);
  assert.equal(dluga.at(-1).czasMs, 59, 'przycięcie zostawia NAJNOWSZE fixy');

  assert.equal(dodajFix(null, { lat: 52.23, lon: 21.01, accuracy: 10 }).length, 1, 'brak historii = pusta historia');
});

/* ------------------------------------------------------------- kryterium dojścia */

test('stanDojscia: pusta historia nie zapala stacji i nie rzuca wyjątkiem', () => {
  const s = stanDojscia([], STACJA);
  assert.equal(s.dotarl, false);
  assert.equal(s.trafienia, 0);
  assert.equal(s.wymagane, GRANICE.wymaganeTrafnienia);
  assert.equal(s.dystansM, null);
  assert.match(s.komunikat, /pierwszy pomiar/);
  assert.equal(stanDojscia(null, STACJA).dotarl, false);
});

test('stanDojscia: dystans bez diagnoz dokładności', () => {
  const blisko = stanDojscia(historiaZFixturea(6), STACJA);
  assert.equal(blisko.dotarl, true, 'dwa kolejne fixy wystarczają');
  assert.match(blisko.komunikat, /Jesteś na miejscu/);
  const daleko = stanDojscia(historiaZFixturea(2), STACJA);
  assert.equal(daleko.dotarl, false);
  assert.equal(daleko.komunikat, '80 m do stacji.');
});

test('stanDojscia: zepsuta stacja albo zepsuta historia nie wywracają gry', () => {
  const s = stanDojscia(historiaZFixturea(6), { id: 9, lat: 999, lon: 21 });
  assert.equal(s.dotarl, false);
  assert.equal(s.kod, 'P06');
  assert.match(s.komunikat, /współrzędnych stacji/);

  const zeSmieciem = stanDojscia([{ lat: 91, lon: 21, accuracy: 5 }, { lat: NaN, lon: NaN }], STACJA);
  assert.equal(zeSmieciem.dotarl, false);
  assert.equal(zeSmieciem.dystansM, null, 'po odrzuceniu śmieci nie ma czego mierzyć');
});

test('stanDojscia: wymóg liczby trafień jest parametrem, nie stałą w środku', () => {
  assert.equal(stanDojscia(historiaZFixturea(3), STACJA, { wymaganeTrafnienia: 1 }).dotarl, true, 'jedno trafienie wystarczy przy wymaganeTrafnienia=1');
  assert.equal(stanDojscia(historiaZFixturea(6), STACJA, { wymaganeTrafnienia: 3 }).dotarl, false, 'przy trzech trafieniach dwa nie wystarczają');
});

/* ------------------------------------------------------------------ błędy GPS */

test('bladGeolokalizacji: kody przeglądarki na komunikaty z wyjściem awaryjnym', () => {
  assert.deepEqual(BLEDY_API, { 1: 'P02', 2: 'P03', 3: 'P04' }, 'kanon z ADR 0004 pkt 7 / specyfikacji Geolocation');
  for (const [code, kod] of Object.entries(BLEDY_API)) {
    const b = bladGeolokalizacji({ code: Number(code), message: 'coś tam' });
    assert.equal(b.kod, kod);
    assert.equal(b.trybAwaryjny, 'reczny');
    assert.ok(b.komunikat.length > 40, `${kod}: komunikat ma wyjaśniać, nie straszyć`);
    // ADR 0029: ręcznego zgłoszenia nie ma, więc wyjściem awaryjnym jest
    // otwarta przestrzeń, tryb testowy albo zgoda przeglądarki — nie przycisk.
    assert.match(b.komunikat, /ustawieniach|otwart|HTTPS|tryb testowy|Zawsze zezwalaj/i, `${kod}: musi proponować wykonalne wyjście`);
  }
  const nieznany = bladGeolokalizacji({ code: 9, message: 'weird internal failure' });
  assert.equal(nieznany.kod, 'P08');
  assert.match(nieznany.komunikat, /weird internal failure/, 'surowy komunikat przeglądarki zostaje pokazany');
  assert.equal(bladGeolokalizacji(undefined).kod, 'P08');
  assert.equal(bladGeolokalizacji(undefined).komunikat.includes('{'), false);
});

test('KODY_POZYCJI: pełne zdania gotowe do UI, osobny przedrostek od kodów rozgrywki', () => {
  const kody = Object.entries(KODY_POZYCJI);
  assert.equal(kody.length, 9, 'P01–P04, P06–P10 (P05 wycofany — numer nie wraca do puli)');
  for (const [kod, tekst] of kody) {
    assert.match(kod, /^P\d{2}$/, `kod ${kod}`);
    assert.ok(tekst.length >= 40, `${kod}: za krótki — „${tekst}"`);
    assert.ok(tekst.endsWith('.'), `${kod}: musi kończyć się kropką`);
    assert.equal(tekst, tekst.trim());
  }
  const pauza = komunikatPauzy();
  assert.equal(pauza.kod, 'P07');
  assert.match(pauza.komunikat, /tle|bater/i, 'pauza w tle ma być wyjaśniona (ADR 0004 pkt 1)');
  const wznowienie = komunikatWznowienia();
  assert.equal(wznowienie.kod, 'P09');
  assert.match(wznowienie.komunikat, /Wznowiono śledzenie/, 'ADR 0004 pkt 1 wymaga komunikatu „wznowiono śledzenie"');
});

/* --------------------------------------------------------------- tryb testowy */

test('trasaProsta: punkty od startu do celu, walidacja wejścia', () => {
  const trasa = trasaProsta({ start: START, cel: STACJA, czasMs: 600_000, accuracyM: 12, przystanki: 3 });
  assert.equal(trasa.punkty.length, 5, 'start + 3 przystanki + cel');
  assert.deepEqual(trasa.punkty[0], { lat: START.lat, lon: START.lon });
  assert.deepEqual(trasa.punkty.at(-1), { lat: STACJA.lat, lon: STACJA.lon }, 'ostatni punkt dokładnie w celu');
  assert.equal(trasa.zrodlo, ZRODLA_FIXA.symulacja);
  assert.deepEqual(sprawdzTrase(trasa).usterki, []);

  assert.throws(() => trasaProsta({ start: { lat: 999, lon: 1 }, cel: STACJA }), TypeError);
  assert.throws(() => trasaProsta({ start: START, cel: STACJA, czasMs: 0 }), TypeError);
  assert.deepEqual(sprawdzTrase({ punkty: [{ lat: 52, lon: 21 }], czasMs: 1000 }).usterki.length, 1);
  assert.deepEqual(sprawdzTrase(null).usterki.length, 1);
  assert.deepEqual(sprawdzTrase({ punkty: [{ lat: 52, lon: 21 }, { lat: 91, lon: 21 }], czasMs: 1000 }).usterki.map((u) => u.kod), ['P06']);
  assert.match(sprawdzTrase({ punkty: [{ lat: 52, lon: 21 }], czasMs: 0 }).usterki[0].komunikat, /co najmniej dwóch punktów/);
});

test('punktNaTrasie: t=0 to start, t≥czasMs to cel, środek w połowie drogi', () => {
  const trasa = trasaProsta({ start: START, cel: STACJA, czasMs: 600_000, przystanki: 2 });
  const calosc = odlegloscM(START, STACJA);

  assert.ok(odlegloscM(punktNaTrasie(trasa, 0), START) < 0.01, 'start trasy');
  assert.ok(odlegloscM(punktNaTrasie(trasa, 600_000), STACJA) < 0.01, 'cel po czasie trasy');
  assert.ok(odlegloscM(punktNaTrasie(trasa, 5 * 600_000), STACJA) < 0.01, 'czas poza trasą jest ograniczany do celu');

  const srodek = punktNaTrasie(trasa, 300_000);
  assert.ok(Math.abs(odlegloscM(START, srodek) - calosc / 2) < 2, `połowa drogi: ${Math.round(odlegloscM(START, srodek))} z ${Math.round(calosc)}`);

  const dystanse = [0, 0.25, 0.5, 0.75, 1].map((u) => odlegloscM(punktNaTrasie(trasa, u * 600_000), STACJA));
  for (let i = 1; i < dystanse.length; i++) {
    assert.ok(dystanse[i] <= dystanse[i - 1] + 0.01, `trasa ma się zbliżać, nie oddalać: ${dystanse.map((d) => Math.round(d))}`);
  }
  assert.throws(() => punktNaTrasie({ punkty: [{ lat: 52, lon: 21 }], czasMs: 100 }, 0), TypeError);
});

test('fixSymulowany: deterministyczny, z rozrzutem i zmienną dokładnością', () => {
  const trasa = trasaProsta({ start: START, cel: STACJA, czasMs: 480_000, accuracyM: 12, szumM: 6 });
  const a = fixSymulowany(trasa, 123_456);
  const b = fixSymulowany(trasa, 123_456);
  assert.deepEqual(a, b, 'ten sam czas = ten sam fix (brak `Math.random`)');
  const c = fixSymulowany(trasa, 60_000); // wywołanie „pomiędzy" nie może zmienić wyniku
  assert.deepEqual(fixSymulowany(trasa, 123_456), a, 'stan wewnętrzny: ' + JSON.stringify(c));

  assert.equal(a.zrodlo, ZRODLA_FIXA.symulacja);
  assert.equal(a.czasMs, 123_456);
  assert.ok(a.accuracy >= 12 * 0.8 - 0.01 && a.accuracy <= 12 * 1.2 + 0.01, `dokładność ${a.accuracy} m wokół 12 m`);
  assert.ok(odlegloscM(a, punktNaTrasie(trasa, 123_456)) <= 6.5, 'rozrzut mieści się w szumM');

  const koniec = fixSymulowany(trasa, 480_000);
  assert.ok(odlegloscM(koniec, STACJA) <= 6.5, `ostatni fix przy celu: ${Math.round(odlegloscM(koniec, STACJA))} m`);

  assert.throws(() => fixSymulowany({ punkty: [], czasMs: 1 }, 0), TypeError);
});

test('sekwencjaSymulowana: częstotliwość, postój i dojście na końcu', () => {
  const trasa = trasaProsta({ start: START, cel: STACJA, czasMs: 120_000, accuracyM: 10, przystanki: 1 });
  const sekwencja = sekwencjaSymulowana(trasa, { coMs: 30_000, postoj: 2 });
  assert.deepEqual(sekwencja.map((f) => f.czasMs), [0, 30_000, 60_000, 90_000, 120_000, 150_000, 180_000]);
  assert.equal(sekwencja.length, 5 + 2, 'fixy na trasie + postój przy stacji');

  let historia = [];
  for (const fix of sekwencja) historia = dodajFix(historia, fix);
  const s = stanDojscia(historia, STACJA);
  assert.equal(s.dotarl, true, 'symulacja kończy się dojściem — kryterium ADR 0004 pkt 6');
  assert.ok(s.trafienia >= GRANICE.wymaganeTrafnienia);

  const bezPostoju = sekwencjaSymulowana(trasa, { coMs: 30_000, postoj: 0 });
  assert.equal(bezPostoju.at(-1).czasMs, 120_000);
  let h2 = [];
  for (const fix of bezPostoju) h2 = dodajFix(h2, fix);
  assert.equal(stanDojscia(h2, STACJA).trafienia, 1, 'bez postoju debounce nie ma drugiego trafienia — dlatego postój jest domyślny');

  assert.throws(() => sekwencjaSymulowana(trasa, { coMs: 0 }), TypeError);
  assert.throws(() => sekwencjaSymulowana(trasa, { postoj: -1 }), TypeError);
  assert.throws(() => sekwencjaSymulowana(null, {}), TypeError);
});

/* ------------------------------------------------------------------ osłona API */

test('watchPozycja: opcje z ADR 0004 pkt 1 i spłaszczony fix w callbacku', () => {
  const atrapa = atrapaGeolokalizacji();
  const fixy = [];
  const bledy = [];
  const sterowanie = watchPozycja({
    geolocation: atrapa.geolocation,
    onFix: (fix, ocena) => fixy.push({ fix, ocena }),
    onBlad: (b) => bledy.push(b),
    zegar: () => 555,
  });

  assert.deepEqual(atrapa.wywolania.opcje, OPCJE_WATCH);
  assert.deepEqual(OPCJE_WATCH, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  assert.equal(sterowanie.czyAktywny(), true);

  atrapa.wyslijPozycje(pozycjaPrzegladarki(52.23, 21.01, 15));
  assert.equal(fixy.length, 1);
  assert.deepEqual(fixy[0].fix, { lat: 52.23, lon: 21.01, accuracy: 15, czasMs: 555, zrodlo: 'gps' });
  assert.equal(fixy[0].ocena.stan, STANY_FIXA.ok);
  assert.deepEqual(bledy, []);

  atrapa.wyslijPozycje(pozycjaPrzegladarki(52.23, 21.01, 400));
  assert.equal(fixy[1].ocena.stan, STANY_FIXA.ok, 'accuracy ignorowane');

  atrapa.wyslijBlad({ code: 1, message: 'User denied Geolocation' });
  assert.equal(bledy.length, 1);
  assert.equal(bledy[0].kod, 'P02');
});

test('watchPozycja: zamknij() wyłącza watchera i głuszy późniejsze fixy', () => {
  const atrapa = atrapaGeolokalizacji();
  const fixy = [];
  const sterowanie = watchPozycja({ geolocation: atrapa.geolocation, onFix: (f) => fixy.push(f) });
  sterowanie.zamknij();
  assert.deepEqual(atrapa.wywolania.clear, [42], 'clearWatch z identyfikatorem watcha');
  assert.equal(sterowanie.czyAktywny(), false);
  atrapa.wyslijPozycje(pozycjaPrzegladarki(52.23, 21.01, 15));
  atrapa.wyslijBlad({ code: 2, message: 'x' });
  assert.deepEqual(fixy, [], 'po zamknięciu nic nie wchodzi do gry');
  sterowanie.zamknij(); // drugie zamknięcie nie może rzucać
  assert.deepEqual(atrapa.wywolania.clear, [42]);
});

test('watchPozycja: brak API to jawny komunikat, nie wyjątek (ADR 0004 pkt 7)', () => {
  for (const geolocation of [undefined, null, {}, { watchPosition: 'nie funkcja' }]) {
    const bledy = [];
    const sterowanie = watchPozycja({ geolocation, onFix: () => {}, onBlad: (b) => bledy.push(b) });
    assert.equal(bledy.length, 1, JSON.stringify(geolocation));
    assert.equal(bledy[0].kod, 'P01');
    assert.equal(bledy[0].trybAwaryjny, 'test');
    assert.match(bledy[0].komunikat, /HTTPS|trybie testowym/);
    assert.equal(sterowanie.czyAktywny(), false);
    sterowanie.zamknij(); // nie rzuca
  }
  assert.throws(() => watchPozycja({ geolocation: atrapaGeolokalizacji().geolocation }), TypeError, 'onFix jest wymagany');
});

test('watchPozycja: własne opcje nadpisują domyślne (oszczędność baterii)', () => {
  const atrapa = atrapaGeolokalizacji();
  watchPozycja({ geolocation: atrapa.geolocation, onFix: () => {}, opcje: { maximumAge: 30_000, enableHighAccuracy: false } });
  assert.deepEqual(atrapa.wywolania.opcje, { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 });
});

/* ------------------------------------------------------- pozycja ↔ rozgrywka */

test('integracja: dojście z fixture’a kończy odcinek w rozgrywce', async () => {
  const { nowaRozgrywka, zakonczOdcinek, startOdcinka, TRYBY_DOJSCIA } = await import('../app/rozgrywka.js');
  const { domyslnaKonfiguracja } = await import('../app/konfig.js');
  const stan = nowaRozgrywka({
    konfig: { ...domyslnaKonfiguracja(1), liczbaStacji: 1, kodGry: 'TEST01' },
    stacje: [STACJA],
    paczka: { pytania: [{ id: 's1p1', stacja: 1, poprawna: 0, punkty: 20 }] },
    srodek: START,
    czasMs: 0,
  });
  const wTrakcie = startOdcinka(stan, { czasMs: 0 }).stan;

  // gracz idzie: fixy z fixture’a aż do zapalenia stacji
  let historia = [];
  let czasDojscia = null;
  let ostatni = null;
  for (const fix of TRASA_ODBICIE.fixy) {
    historia = dodajFix(historia, fixZFixturea(fix));
    ostatni = fixZFixturea(fix);
    if (stanDojscia(historia, STACJA).dotarl) { czasDojscia = fix.t; break; }
  }
  assert.equal(czasDojscia, 25_000, 'drugie kolejne trafienie po odbiciu poza 50 m');

  const { stan: po, usterki } = zakonczOdcinek(wTrakcie, { czasMs: czasDojscia, trybDojscia: TRYBY_DOJSCIA.gps, fix: ostatni });
  assert.deepEqual(usterki, []);
  assert.equal(po.odcinki[0].koniecMs, 25_000, 'znacznik dojścia zapisany (czasu odcinka nie liczymy od Partii 2)');
  assert.equal(po.odcinki[0].accuracyM, 10);
  assert.ok(po.odcinki[0].odlegloscKoncowaM <= 50, `odległość końcowa ${po.odcinki[0].odlegloscKoncowaM} m mieści się w progu`);
});

/* ------------------------------------------------- bateria (M10/T3) */

test('bateria: profile GPS — oszczędny bez wysokiej dokładności i z rzadszym odświeżaniem', () => {
  assert.equal(PROFILE_GPS.oszczedny.enableHighAccuracy, false, 'w trasie GPS bez high-accuracy');
  assert.ok(PROFILE_GPS.oszczedny.maximumAge > PROFILE_GPS.dokladny.maximumAge, 'rzadsze odświeżanie w trasie');
  assert.deepEqual(PROFILE_GPS.dokladny, OPCJE_WATCH, 'profil dokładny = dotychczasowe opcje (ADR 0004)');
  assert.ok(Object.isFrozen(PROFILE_GPS) && Object.isFrozen(PROFILE_GPS.oszczedny));
});

test('bateria: histereza profilu — oszczędny >250 m, powrót do dokładnego <150 m', () => {
  assert.equal(profilBaterii({ poprzedni: 'dokladny', dystansM: 300 }), 'oszczedny', 'daleko = oszczędzanie');
  assert.equal(profilBaterii({ poprzedni: 'oszczedny', dystansM: 200 }), 'oszczedny', 'histereza: 200 m nie wraca jeszcze do dokładnego');
  assert.equal(profilBaterii({ poprzedni: 'oszczedny', dystansM: 149 }), 'dokladny', 'przy stacji pełna dokładność');
  assert.equal(profilBaterii({ poprzedni: 'dokladny', dystansM: 250 }), 'dokladny', 'próg „powyżej" jest ostry');
  assert.equal(profilBaterii({ poprzedni: 'dokladny', dystansM: 100 }), 'dokladny');
});

test('bateria: brak dystansu (null/NaN) NIE zmienia profilu; domyślny profil dokładny', () => {
  assert.equal(profilBaterii({ poprzedni: 'oszczedny', dystansM: null }), 'oszczedny');
  assert.equal(profilBaterii({ poprzedni: 'dokladny', dystansM: NaN }), 'dokladny');
  assert.equal(profilBaterii({ poprzedni: 'dokladny' }), 'dokladny');
  assert.equal(profilBaterii({}), 'dokladny', 'start: profil dokładny');
  assert.equal(PROG_BATERII_M.oszczednyPowyzej, 250);
  assert.equal(PROG_BATERII_M.dokladnyPonizej, 150);
});

/* ---------------------------------------------- bug G: cichy watcher GPS */

test('czyMilczy: brak znaku albo cisza dłuższa niż limit to milczenie (bug G)', () => {
  assert.equal(czyMilczy({ ostatniZnakMs: null, terazMs: 0 }), true, 'nigdy żadnego znaku = milczy');
  assert.equal(czyMilczy({ ostatniZnakMs: undefined, terazMs: 10_000 }), true, 'brak danych = milczy, nie „świeży”');
  assert.equal(czyMilczy({ ostatniZnakMs: NaN, terazMs: 10_000 }), true, 'NaN = brak danych (L10)');
  assert.equal(czyMilczy({ ostatniZnakMs: 0, terazMs: ZEGAR_MILCZENIA_MS }), true, 'równo limit = milczy');
  assert.equal(czyMilczy({ ostatniZnakMs: 0, terazMs: ZEGAR_MILCZENIA_MS - 1 }), false, 'poniżej limitu = jeszcze żyje');
  assert.equal(czyMilczy({ ostatniZnakMs: 500, terazMs: 400 }), false, 'znak „z przyszłości” (zegar wstecz) nie jest milczeniem');
  assert.equal(czyMilczy({ ostatniZnakMs: 0, terazMs: 9_999, limitMs: 9_999 }), true, 'limit nadpisywalny (testy/profil)');
});

test('P10: komunikat milczenia mówi co robi aplikacja i co zrobić, gdy nie pomoże (bug G)', () => {
  assert.equal(typeof KODY_POZYCJI.P10, 'string', 'kod P10 istnieje (P05 wycofany i nie wraca)');
  const tekst = komunikatMilczenia({ sekundy: 15, proba: 2 });
  assert.match(tekst, /\b15 s\b/, 'sekundy wypełnione');
  assert.match(tekst, /próba 2/, 'numer próby wypełniony');
  assert.doesNotMatch(tekst, /\{\w+\}/, 'placeholdery nie zostają w treści');
  assert.match(KODY_POZYCJI.P10, /odśwież stronę/, 'wyjście awaryjne w treści (ADR 0011 pkt 8: komunikat mówi co zrobić)');
});
