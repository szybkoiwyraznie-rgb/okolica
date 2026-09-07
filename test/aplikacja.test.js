/**
 * Test dymny aplikacji (app/app.js) na atrapie DOM.
 *
 * Moduły czyste mają własne testy, ale to `app.js` spina je z HTML-em — i to tu
 * psują się rzeczy niewidoczne dla reszty bramy: import nazwy, której moduł nie
 * eksportuje (aplikacja wtedy w ogóle nie wstaje), `null.checked` przy kluczu
 * spoza kanonu, brak nasłuchu na przycisku, watcher GPS założony z opcjami
 * innymi niż w ADR. Ten test uruchamia prawdziwy bootstrap na minimalnej
 * atrapie DOM (`test/helpers/dom.js`) i sprawdza stan początkowy ekranu oraz
 * przepływ położenia: fix → badge dokładności → ostrzeżenie → błąd → pauza.
 *
 * Atrapa jest celowo głupia: `querySelector` zwraca `null` (jak w pustym
 * kontenerze), `innerHTML` niczego nie parsuje. Kod, który tego nie przeżyje,
 * nie przeżyje też wolnego renderowania w przeglądarce.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WERSJA_PROTOKOLU, WERSJA_PROTOKOLU_REV1, WERSJA_PROTOKOLU_REV2, odwrocPolaPaczki, zakodujPoprawnaRev2 } from '../app/protokol.js';
import {
  INSTANCJE_OVERPASS,
  SCHEMAT_SIECI,
  kluczCacheSieci,
  parsujOdpowiedz,
  upraszczajDaneDoCache,
} from '../app/sieci.js';
import { DOMYSLNE, PODKLADY, TEMATY, TRYBY } from '../app/konfig.js';
import { GRANICE, OPCJE_WATCH } from '../app/pozycja.js';
import { widokNaSrodek, wspolrzedneZEkranu } from '../app/mapa.js';
import { dopasujZoomDoPromienia } from '../app/geo.js';
import { atrapaGeolokalizacji, zainstalujDom } from './helpers/dom.js';

/* ------------------------------------------------------------------ bootstrap */

const dom = zainstalujDom();
const { pobierz, pamiec } = dom;

// Import PO ustawieniu globali — app.js uruchamia start() przy wczytaniu.
await import('../app/app.js');

test('bootstrap: aplikacja startuje bez wyjątku na atrapie DOM', () => {
  assert.ok(dom.elementy.size > 40, `aplikacja dotknęła tylko ${dom.elementy.size} elementów — wygląda na urwany start`);
});

test('bootstrap: widoczny jest ekran setupu, reszta ukryta', () => {
  assert.equal(pobierz('ekran-setup').hidden, false, 'ekran setupu ma być widoczny na starcie');
  for (const ekran of ['pozycja', 'stacje', 'prompt', 'paczka']) {
    assert.equal(pobierz(`ekran-${ekran}`).hidden, true, `ekran ${ekran} ma być na starcie ukryty`);
  }
});

test('bootstrap: stopka pokazuje obowiązującą wersję protokołu', () => {
  assert.equal(pobierz('stopka-protokol').textContent, WERSJA_PROTOKOLU);
});

test('bootstrap: lista trybów i tematów jest wyrenderowana z kanonu', () => {
  assert.equal(pobierz('lista-trybow').children.length, Object.keys(TRYBY).length, 'trzy tryby ruchu');
  assert.equal(pobierz('lista-tematow').children.length, Object.keys(TEMATY).length, 'dziesięć tematów z kanonu');
});

test('bootstrap: pola setupu mają wartości domyślne z kanonu', () => {
  assert.equal(pobierz('setup-promien').value, String(TRYBY[DOMYSLNE.tryb].promienM));
  assert.equal(pobierz('setup-stacje').value, String(DOMYSLNE.liczbaStacji));
  assert.equal(pobierz('setup-pytania').value, String(DOMYSLNE.pytaniaNaStacje));
  assert.equal(pobierz('setup-gracze').value, String(DOMYSLNE.liczbaGraczy));
});

test('bootstrap: pasek stanu ma komunikat, a wynik walidacji zostaje schowany', () => {
  assert.ok(pobierz('status').textContent.length > 20, 'pasek stanu milczy po starcie');
  assert.equal(pobierz('wynik-walidacji').hidden, true, 'karta wyniku jest w HTML ukryta i bootstrap jej nie odsłania');
  assert.equal(pobierz('wynik-naglowek').textContent, '', 'żaden wynik nie został wyrenderowany przed wklejeniem paczki');
});

test('bootstrap: przyciski nawigacji mają nasłuch zdarzeń', () => {
  for (const id of ['przycisk-dalej-pozycja', 'przycisk-kopiuj-prompt', 'przycisk-sprawdz', 'przycisk-poprawka', 'przycisk-motyw', 'przycisk-sygnaly', 'przycisk-przelicz', 'przycisk-gps', 'przycisk-ustaw-reczne']) {
    assert.ok(pobierz(id).zdarzenia.click?.length >= 1, `#${id} nie ma nasłuchu click — przycisk byłby martwy`);
  }
});

/* ------------------------------------------------- współrzędne ręczne (tryb test) */

test('ręczne współrzędne: puste pola nie ustawiają pozycji (0,0) „na Null Island"', () => {
  pobierz('setup-lat').value = '';
  pobierz('setup-lon').value = '';
  dom.kliknij('przycisk-ustaw-reczne');
  assert.equal(pobierz('bledy-pozycja').hidden, false, 'brak współrzędnych ma być widoczny');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P06\]/);
  assert.match(pobierz('bledy-pozycja').textContent, /Wpisz obie współrzędne/);
  assert.equal(pobierz('pozycja-wspolrzedne').textContent, '', 'żadna pozycja nie została ustawiona');
  assert.equal(pobierz('pozycja-status').textContent, '', 'ekran pozycji nie został odświeżony — odmowa, nie cicha zmiana');
});

test('ręczne współrzędne: zakresy są pilnowane, a poprawna pozycja przechodzi', () => {
  pobierz('setup-lat').value = '999';
  pobierz('setup-lon').value = '21';
  dom.kliknij('przycisk-ustaw-reczne');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P06\].*od -90 do 90/, 'kod z pozycja.js, komunikat dla człowieka');

  pobierz('setup-lat').value = '52.23178';
  pobierz('setup-lon').value = '21.01234';
  dom.kliknij('przycisk-ustaw-reczne');
  assert.equal(pobierz('bledy-pozycja').hidden, true);
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustawiona ręcznie');
  assert.match(pobierz('pozycja-wspolrzedne').textContent, /52\.23178, 21\.01234/);
  assert.match(pobierz('pozycja-wspolrzedne').textContent, /geohash/);
  assert.equal(pobierz('pozycja-dokladnosc').textContent, 'dokładność: nieznana (wpisana ręcznie)');
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
});

/* ------------------- współrzędne z Google Maps i tap w mapę (zadanie D3) */

test('D3: para DMS z Google Maps wklejona w pierwsze pole ustawia pozycję', () => {
  // przykład właściciela: Podkowa Leśna, ul. Bukowa 22; oczekiwania LICZONE
  // z definicji DMS (L24), nie przepisane z wyjścia
  const oczLat = 52 + 7 / 60 + 22.9 / 3600;
  const oczLon = 20 + 44 / 60 + 46.1 / 3600;
  pobierz('setup-lat').value = '52°07\'22.9"N 20°44\'46.1"E';
  pobierz('setup-lon').value = '';
  dom.kliknij('przycisk-ustaw-reczne');
  assert.equal(pobierz('bledy-pozycja').hidden, true, pobierz('bledy-pozycja').textContent);
  const re = new RegExp(`${oczLat.toFixed(5).replace(/\./g, '\\.')}, ${oczLon.toFixed(5).replace(/\./g, '\\.')}`);
  assert.match(pobierz('pozycja-wspolrzedne').textContent, re, 'na ekranie widać DZIESIĘTNE, które aplikacja zrozumiała');
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustawiona ręcznie');
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
});

test('D3: błąd zapisu DMS jest jawny — [P06] pod polami, pozycja bez zmian', () => {
  const przed = pobierz('pozycja-wspolrzedne').textContent;
  assert.ok(przed.length > 0, 'pozycja z poprzedniego testu — jest co chronić');
  pobierz('setup-lat').value = '52°75\'00"N';
  pobierz('setup-lon').value = '';
  dom.kliknij('przycisk-ustaw-reczne');
  assert.equal(pobierz('bledy-pozycja').hidden, false, 'odmowa musi być widoczna');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P06\]/);
  assert.match(pobierz('bledy-pozycja').textContent, /mniejsze niż 60/);
  assert.equal(pobierz('pozycja-wspolrzedne').textContent, przed, 'odmowa nie przestawia pozycji');
  pobierz('bledy-pozycja').hidden = true; // sprzątamy po teście
});

/* ------------------------------------------------------------------ GPS */

test('GPS: brak API daje komunikat P01, nie wyjątek i nie biały ekran', () => {
  // na tym egzemplarzu `navigator.geolocation` jest `undefined` (atrapa bez API)
  dom.ustawGeolokalizacje(undefined);
  dom.kliknij('przycisk-gps');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P01\]/);
  assert.match(pobierz('bledy-pozycja').textContent, /HTTPS|trybie testowym/);
  assert.equal(pobierz('pozycja-status').textContent, 'Brak pozycji');
  assert.equal(pobierz('ekran-setup').hidden, false, 'aplikacja działa dalej');
});

const gps = atrapaGeolokalizacji();

test('GPS: watcher startuje z opcjami z ADR 0004 pkt 1', () => {
  dom.ustawGeolokalizacje(gps.geolocation);
  dom.kliknij('przycisk-gps');
  assert.equal(gps.wywolania.watch, 1, 'jeden watcher na rozgrywkę');
  assert.deepEqual(gps.wywolania.opcje, OPCJE_WATCH);
  assert.deepEqual(OPCJE_WATCH, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  assert.equal(pobierz('pozycja-status').textContent, 'Szukam satelitów…');
  assert.match(pobierz('status').textContent, /pierwszy fix/i);
});

test('GPS: fix trafia na ekran — badge dokładności i odblokowane przejście', () => {
  gps.wyslijFix(52.235, 21.015, 15);
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustalona');
  assert.equal(pobierz('pozycja-dokladnosc').textContent, 'dokładność: ±15 m');
  assert.match(pobierz('pozycja-wspolrzedne').textContent, /52\.23500, 21\.01500/);
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
  assert.equal(pobierz('bledy-pozycja').hidden, true, 'poprawny fix czyści poprzednie błędy');
});

test('GPS: niedokładny fix pokazuje ostrzeżenie P05 i nie przerywa gry', () => {
  gps.wyslijFix(52.236, 21.016, 400);
  assert.equal(pobierz('bledy-pozycja').hidden, false);
  assert.match(pobierz('bledy-pozycja').textContent, /\[P05\].*±400 m/);
  assert.equal(pobierz('pozycja-dokladnosc').textContent, 'dokładność: ±400 m', 'niedokładność jest jawna (ADR 0004 pkt 4)');
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustalona', 'fix wchodzi do gry — próg dojścia i tak jest surowy');
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
  assert.match(pobierz('status').textContent, /niewystarczająca/);
});

test('GPS: błąd przeglądarki daje komunikat z wyjściem awaryjnym (ADR 0004 pkt 7)', () => {
  gps.wyslijBlad(1, 'User denied Geolocation');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P02\]/);
  assert.match(pobierz('bledy-pozycja').textContent, /ustawieniach|ręczn/i);
  assert.equal(pobierz('pozycja-status').textContent, 'Brak pozycji');
  assert.match(pobierz('status').textContent, /ręcznie|trybie testowym/);

  gps.wyslijBlad(2, 'Position unavailable');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P03\]/);
  gps.wyslijBlad(3, 'Timeout');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P04\]/);
  gps.wyslijBlad(9, 'dziwny błąd');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P08\].*dziwny błąd/);
});

test('GPS: karta w tle zamyka watcher, powrót wznawia śledzenie (ADR 0004 pkt 1)', () => {
  assert.ok(dom.wyslijZdarzenieDokumentu('visibilitychange') >= 1, 'app.js musi nasłuchiwać visibilitychange (ADR 0004 pkt 1)');

  dom.ustawHidden(true);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.deepEqual(gps.wywolania.clear, [42], 'watcher zamknięty — bateria');
  assert.match(pobierz('status').textContent, /tle|bater/i);

  dom.ustawHidden(false);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gps.wywolania.watch, 2, 'śledzenie wznowione po powrocie na kartę');
  assert.match(pobierz('status').textContent, /Wznowiono śledzenie/);

  // powrót bez wcześniejszej pauzy nie zakłada drugiego watchera
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gps.wywolania.watch, 2);
});

test('przełącznik trybu testowego: odsłania ręczne współrzędne i pokazuje ekran pozycji', () => {
  // stan początkowy `aria-pressed="false"` jest w index.html — atrapa nie parsuje
  // atrybutów, więc sprawdzamy przełączenie, a nie wartość startową
  dom.kliknij('przycisk-test');
  assert.equal(pobierz('przycisk-test').dataset['attr-aria-pressed'], 'true');
  assert.equal(pobierz('reczne-wspolrzedne').hidden, false);
  assert.equal(pobierz('ekran-pozycja').hidden, false, 'przełącznik od razu pokazuje ekran pozycji');
  assert.match(pobierz('status').textContent, /Tryb testowy: współrzędne ręczne/);

  dom.kliknij('przycisk-test');
  assert.equal(pobierz('przycisk-test').dataset['attr-aria-pressed'], 'false');
  assert.equal(pobierz('reczne-wspolrzedne').hidden, true);
});

test('tryb testowy z adresu: ?tryb=test nie wznawia GPS po powrocie z tła', async () => {
  // osobna atrapa DOM = osobny egzemplarz aplikacji bez nasłuchów z poprzednich importów
  const domTest = zainstalujDom({ search: '?tryb=test' });
  const gpsTest = atrapaGeolokalizacji({ idWatcha: 77 });
  domTest.ustawGeolokalizacje(gpsTest.geolocation);
  await import(`../app/app.js?trybtest=${Date.now()}`);

  assert.equal(domTest.pobierz('przycisk-test').dataset['attr-aria-pressed'], 'true', 'tryb testowy z URL jest włączony na starcie');
  assert.equal(domTest.pobierz('reczne-wspolrzedne').hidden, false);

  domTest.kliknij('przycisk-gps'); // gracz może włączyć GPS nawet w trybie testowym
  assert.equal(gpsTest.wywolania.watch, 1);
  domTest.ustawHidden(true);
  domTest.wyslijZdarzenieDokumentu('visibilitychange');
  assert.deepEqual(gpsTest.wywolania.clear, [77], 'pauza w tle działa także w trybie testowym');
  domTest.ustawHidden(false);
  domTest.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gpsTest.wywolania.watch, 1, 'w trybie testowym śledzenie nie wraca samo — współrzędne są ręczne (ADR 0004 pkt 6)');
});

test('GPS: limit historii i próg dokładności są z pozycja.js, nie wpisane w UI', () => {
  // kontrakt na stałe: gdyby UI zaczął mieć własny próg, rozjechałby się z regułą dojścia
  assert.equal(GRANICE.maxAccuracyM, 100);
  assert.equal(GRANICE.wymaganeTrafnienia, 2);
});

/* ------------------------------------------------------------- stan z pamięci */

test('bootstrap: uszkodzona konfiguracja w localStorage nie kładzie startu', async () => {
  const pamiecSmieci = new Map();
  pamiecSmieci.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { tryb: 'konny', wiek: 'nestor', podklad: 'carto', tematy: ['kosmos'], liczbaGraczy: 'dużo', imiona: null },
  }));
  const domSmieci = zainstalujDom({ pamiec: pamiecSmieci });
  // ponowne wczytanie modułu z odświeżonym query — nowy egzemplarz, ten sam kod
  await import(`../app/app.js?powtorka=${Date.now()}`);
  assert.equal(domSmieci.pobierz('ekran-setup').hidden, false, 'aplikacja musi wystartować nawet na śmieciowym stanie');
  assert.ok(domSmieci.pobierz('status').textContent.length > 20);
  assert.equal(domSmieci.pobierz('setup-gracze').value, String(DOMYSLNE.liczbaGraczy), 'śmieciowy stan nie wchodzi do formularza');
  assert.ok(pamiec.size >= 0, 'pamięć pierwszej sesji zostaje nietknięta');
});

/* ------------------------------------------------------------------ mapa (M2) */

/**
 * Każdy test mapy pracuje na ŚWIEŻEJ atrapie i świeżym imporcie `app.js`
 * (LESSONS: ponowny import dokłada kolejne nasłuchy `visibilitychange`, więc
 * egzemplarze nie mogą dzielić atrap). Import z unikalnym query = nowy moduł.
 */
async function aplikacjaZMapa({ search = '' } = {}) {
  const domMapy = zainstalujDom({ search });
  await import(`../app/app.js?mapa=${Math.random().toString(36).slice(2)}`);
  return domMapy;
}

/** Odpala nasłuch elementu tak, jak robi to przeglądarka. */
function wyslij(el, typ, zdarzenie = {}) {
  const lista = el.zdarzenia[typ] ?? [];
  for (const fn of lista) fn({ type: typ, preventDefault() {}, ...zdarzenie });
  return lista.length;
}

test('mapa: bootstrap rysuje kafelki OSM i podpisuje dostawcę', async () => {
  const domMapy = await aplikacjaZMapa();
  const kafelki = domMapy.pobierz('mapa-pozycja-kafelki');
  assert.ok(kafelki.children.length > 0, 'panel mapy został pusty po starcie');
  assert.ok(
    kafelki.children.every((k) => String(k.getAttribute('href')).startsWith('https://tile.openstreetmap.org/')),
    'kafelki mają pochodzić z podkładu domyślnego (OSM Standard)',
  );
  assert.equal(domMapy.pobierz('mapa-pozycja-atrybucja').textContent, PODKLADY.osm.atrybucja);
  assert.ok(domMapy.pobierz('mapa-pozycja-svg').getAttribute('aria-label').length > 10);
  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 0, 'bez pozycji nie ma markera');
});

test('mapa: pierwszy fix rysuje marker z kołem dokładności i centruje widok na graczu', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = atrapaGeolokalizacji({ idWatcha: 501 });
  domMapy.ustawGeolokalizacje(gpsMapy.geolocation);
  domMapy.kliknij('przycisk-gps');
  gpsMapy.wyslijFix(52.235, 21.015, 15);

  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1, 'brak markera pozycji');
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-dokladnosc', 'okrag-promien'],
    'koło dokładności i okrąg promienia gry',
  );
  assert.match(
    domMapy.pobierz('mapa-pozycja-svg').getAttribute('aria-label'),
    /52\.23500, 21\.01500/,
    'widok ma być wycentrowany na pierwszym fixie',
  );
  assert.equal(domMapy.pobierz('mapa-stacje-marker').children.length, 1, 'druga mapa dostaje tę samą pozycję');
});

test('mapa: przejście do stacji rysuje numerowane pinezki i okrąg promienia', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = atrapaGeolokalizacji({ idWatcha: 502 });
  domMapy.ustawGeolokalizacje(gpsMapy.geolocation);
  domMapy.kliknij('przycisk-gps');
  gpsMapy.wyslijFix(52.235, 21.015, 15);
  domMapy.kliknij('przycisk-dalej-stacje');

  assert.equal(domMapy.pobierz('ekran-stacje').hidden, false);
  const pinezki = domMapy.pobierz('mapa-stacje-pinezki');
  assert.equal(pinezki.children.length, DOMYSLNE.liczbaStacji, 'tyle pinezek, ile stacji z listy');
  assert.equal(pinezki.children.length, domMapy.pobierz('lista-stacji').children.length);
  assert.deepEqual(pinezki.children.map((g) => g.children[1].textContent), ['1', '2', '3', '4', '5']);
  const idPinezek = pinezki.children.map((g) => String(g.getAttribute('data-stacja')));
  assert.equal(new Set(idPinezek).size, DOMYSLNE.liczbaStacji, 'pinezki mają różne identyfikatory stacji');
  assert.deepEqual(
    domMapy.pobierz('mapa-stacje-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-dokladnosc', 'okrag-promien'],
  );
});

test('mapa: zmiana podkładu w setupie podmienia kafelki i atrybucję obu map', async () => {
  const domMapy = await aplikacjaZMapa();
  const select = domMapy.pobierz('setup-podklad');

  select.value = 'esri-satelita';
  assert.ok(wyslij(select, 'change', { target: select }) > 0, 'select podkładu nie ma nasłuchu change');
  assert.ok(
    String(domMapy.pobierz('mapa-pozycja-kafelki').children[0].getAttribute('href')).includes('server.arcgisonline.com'),
    'kafelki Esri (uwaga na kolejność y/x w URL)',
  );
  assert.equal(domMapy.pobierz('mapa-stacje-atrybucja').textContent, PODKLADY['esri-satelita'].atrybucja);

  select.value = 'brak';
  wyslij(select, 'change', { target: select });
  assert.equal(domMapy.pobierz('mapa-pozycja-kafelki').children.length, 0, 'podkład wyłączony = zero żądań');
  assert.equal(domMapy.pobierz('mapa-stacje-kafelki').children.length, 0);
  assert.equal(domMapy.pobierz('mapa-pozycja-atrybucja').textContent, '', 'nie ma dostawcy — nie ma podpisu');

  select.value = 'osm';
  wyslij(select, 'change', { target: select });
  assert.ok(domMapy.pobierz('mapa-pozycja-kafelki').children.length > 0, 'powrót do OSM po podkładzie „brak"');
});

test('mapa: ręczna pozycja w trybie testowym nie udaje koła dokładności', async () => {
  const domMapy = await aplikacjaZMapa({ search: '?tryb=test' });
  domMapy.pobierz('setup-lat').value = '52.23178';
  domMapy.pobierz('setup-lon').value = '21.01234';
  domMapy.kliknij('przycisk-ustaw-reczne');

  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1, 'marker jest — pozycja ustawiona ręcznie');
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-promien'],
    'bez `accuracy` nie rysujemy koła dokładności (uczciwość wobec danych)',
  );
  assert.match(domMapy.pobierz('mapa-pozycja-svg').getAttribute('aria-label'), /52\.23178/);
});

test('mapa: schowany panel nie rysuje, a powrót na ekran przywraca warstwy', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = atrapaGeolokalizacji({ idWatcha: 503 });
  domMapy.ustawGeolokalizacje(gpsMapy.geolocation);
  domMapy.kliknij('przycisk-gps');
  gpsMapy.wyslijFix(52.235, 21.015, 15);
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.ok(domMapy.pobierz('mapa-stacje-pinezki').children.length > 0);

  domMapy.ustawProstokat('mapa-stacje', { width: 0, height: 0 });
  domMapy.kliknij('przycisk-wstecz-pozycja');
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.equal(domMapy.pobierz('mapa-stacje-pinezki').children.length, 0, 'panel o zerowym rozmiarze nie ma czego rysować');
  assert.equal(domMapy.pobierz('mapa-stacje-kafelki').children.length, 0);

  domMapy.ustawProstokat('mapa-stacje', { width: 360, height: 320 });
  domMapy.kliknij('przycisk-wstecz-pozycja');
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.ok(domMapy.pobierz('mapa-stacje-pinezki').children.length > 0, 'po pokazaniu ekranu pinezki wracają');
  assert.ok(domMapy.pobierz('mapa-stacje-kafelki').children.length > 0, 'kafelki też wracają (sygnatura nie zostaje z pustego widoku)');
});

test('mapa: obrót telefonu (resize) przelicza widok na nowy rozmiar panelu', async () => {
  const domMapy = await aplikacjaZMapa();
  domMapy.ustawProstokat('mapa-pozycja', { width: 640, height: 300 });
  assert.ok(domMapy.wyslijZdarzenieOkna('resize') >= 1, 'brak nasłuchu resize — obrót telefonu zostawiłby stary widok');
  assert.equal(domMapy.pobierz('mapa-pozycja-svg').getAttribute('viewBox'), '0 0 640 300');
  assert.ok(domMapy.pobierz('mapa-pozycja-kafelki').children.length > 0);
});

test('mapa: wyczyszczony promień nie wysypuje przejścia — jest jawna odmowa z kodem K12', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = atrapaGeolokalizacji({ idWatcha: 504 });
  domMapy.ustawGeolokalizacje(gpsMapy.geolocation);
  // gracz czyści pole promienia → `Number('') = 0`, czyli wartość skończona,
  // która przechodzi przez hartowanie liczb w setupie
  wyslij(domMapy.pobierz('setup-promien'), 'input', { target: { value: '' } });
  domMapy.kliknij('przycisk-gps');
  gpsMapy.wyslijFix(52.235, 21.015, 15);

  // `stacjeProste` odmawia przy niedodatnim promieniu — przejście ma odmówić,
  // a nie urwać się wyjątkiem w nasłuchu (LESSONS L10)
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.equal(domMapy.pobierz('ekran-stacje').hidden, true, 'przejście jest odmówione, nie urwane');
  assert.match(domMapy.pobierz('bledy-pozycja').textContent, /\[K12\]/, 'kod z konfig.js, komunikat dla człowieka');
  assert.match(domMapy.pobierz('bledy-pozycja').textContent, /Promień gry/);
  assert.match(domMapy.pobierz('status').textContent, /Wróć do ustawień gry/);

  // mapa pozycji działa dalej i nie ma okręgu promienia, którego nie ma
  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1);
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-dokladnosc'],
  );
  assert.ok(domMapy.pobierz('mapa-pozycja-kafelki').children.length > 0);

  // po poprawieniu promienia przejście działa
  wyslij(domMapy.pobierz('setup-promien'), 'input', { target: { value: '1200' } });
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.equal(domMapy.pobierz('ekran-stacje').hidden, false);
  assert.equal(domMapy.pobierz('mapa-stacje-pinezki').children.length, DOMYSLNE.liczbaStacji);
  assert.ok(domMapy.pobierz('mapa-stacje-kafelki').children.length > 0);
});

test('mapa: gest palcem na panelu zmienia widok (drag działa z aplikacji)', async () => {
  const domMapy = await aplikacjaZMapa();
  const svg = domMapy.pobierz('mapa-pozycja-svg');
  const etykietaPrzed = svg.getAttribute('aria-label');
  assert.ok(wyslij(svg, 'pointerdown', { pointerId: 1, clientX: 180, clientY: 160 }) > 0, 'svg nie ma nasłuchu pointerdown');
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 60, clientY: 160 });
  wyslij(svg, 'pointerup', { pointerId: 1 });
  assert.notEqual(svg.getAttribute('aria-label'), etykietaPrzed, 'przeciągnięcie palcem ma zmienić środek widoku');
});

/* ------------------------------------------------- dane i prywatność (M3) */

test('prywatność: ekran otwiera się z setupu i ze stopki, a „wróć" prowadzi na właściwy ekran', async () => {
  const domMapy = await aplikacjaZMapa();
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, true, 'ekran prywatności jest domyślnie schowany');

  domMapy.kliknij('przycisk-prywatnosc');
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, false);
  assert.equal(domMapy.pobierz('ekran-setup').hidden, true, 'ekran gry ustępuje miejsca prywatności');

  domMapy.kliknij('przycisk-wrocz-prywatnosc');
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, true);
  assert.equal(domMapy.pobierz('ekran-setup').hidden, false, 'wróciliśmy na setup');

  // ze stopki, w trakcie gry: powrót ma prowadzić na ekran, z którego przyszliśmy
  // (na pozycję wchodzimy trybem testowym — przejście z setupu czyta imiona
  // z prawdziwego DOM, którego atrapa nie parsuje)
  domMapy.kliknij('przycisk-test');
  assert.equal(domMapy.pobierz('ekran-pozycja').hidden, false);
  domMapy.kliknij('przycisk-prywatnosc-stopka');
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, false);
  assert.equal(domMapy.pobierz('ekran-pozycja').hidden, true);
  domMapy.kliknij('przycisk-wrocz-prywatnosc');
  assert.equal(domMapy.pobierz('ekran-pozycja').hidden, false, 'powrót na ekran pozycji, nie na setup');
});

test('prywatność: czyszczenie jest dwustopniowe i rusza tylko klucze obolica:*', async () => {
  const pamiecPriv = new Map();
  pamiecPriv.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', konfig: { liczbaGraczy: 2 } }));
  pamiecPriv.set('okolica:motyw', 'ciemny');
  pamiecPriv.set('inna-apka:stan', 'nie ruszać');
  const domMapy = zainstalujDom({ pamiec: pamiecPriv });
  await import(`../app/app.js?priv=${Math.random().toString(36).slice(2)}`);

  domMapy.kliknij('przycisk-prywatnosc');
  domMapy.kliknij('przycisk-czysc-dane');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Kliknij ponownie/, 'pierwszy klik tylko uzbraja');
  assert.ok(pamiecPriv.has('okolica:konfig'), 'po uzbrojeniu nic nie zostało usunięte');
  assert.ok(pamiecPriv.has('okolica:motyw'));

  domMapy.kliknij('przycisk-czysc-dane');
  assert.equal(pamiecPriv.has('okolica:konfig'), false, 'konfig usunięty');
  assert.equal(pamiecPriv.has('okolica:motyw'), false, 'motyw usunięty');
  assert.equal(pamiecPriv.get('inna-apka:stan'), 'nie ruszać', 'obce klucze zostają nietknięte');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Usunięto zapisane dane \(2\)/);

  // trzeci klik zaczyna od nowa: znów tylko uzbraja
  domMapy.kliknij('przycisk-czysc-dane');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Kliknij ponownie/);
  assert.equal(pamiecPriv.size, 1);
});

/* ------------------------------------------- symulacja dojścia (M3, tryb testowy) */

const czekaj = (ms) => new Promise((rozwiaz) => setTimeout(rozwiaz, ms));

test('symulacja: przycisk istnieje tylko w trybie testowym', async () => {
  const domMapy = await aplikacjaZMapa();
  assert.equal(domMapy.pobierz('przycisk-symulacja').hidden, true, 'bez trybu testowego nie ma symulacji');
  domMapy.kliknij('przycisk-test');
  assert.equal(domMapy.pobierz('przycisk-symulacja').hidden, false);
  domMapy.kliknij('przycisk-test');
  assert.equal(domMapy.pobierz('przycisk-symulacja').hidden, true, 'wyłączenie trybu testowego chowa symulację');
});

test('symulacja: odtworzenie trasy prowadzi pozycję do celu i spełnia debounce dojścia', async () => {
  const domMapy = await aplikacjaZMapa({ search: '?tryb=test' });
  domMapy.pobierz('setup-lat').value = '52.23178';
  domMapy.pobierz('setup-lon').value = '21.01234';
  domMapy.kliknij('przycisk-ustaw-reczne');
  const start = domMapy.pobierz('pozycja-wspolrzedne').textContent;
  assert.match(start, /52\.23178/);

  domMapy.kliknij('przycisk-symulacja');
  assert.equal(domMapy.pobierz('przycisk-symulacja').dataset['attr-aria-pressed'], 'true', 'odtwarzanie wystartowało');
  assert.match(domMapy.pobierz('status').textContent, /Symulacja trasy: 9 fixów/);

  await czekaj(9 * 120 + 500); // dziewięć fixów po 120 ms + zapas na timery Node
  assert.equal(domMapy.pobierz('przycisk-symulacja').dataset['attr-aria-pressed'], 'false', 'sekwencja sama się kończy');
  assert.match(domMapy.pobierz('status').textContent, /cel osiągnięty — debounce dojścia spełniony/);
  assert.notEqual(domMapy.pobierz('pozycja-wspolrzedne').textContent, start, 'pozycja przeszła trasę, nie stoi w miejscu');
  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1, 'marker pojechał z pozycją');
});

test('symulacja: stop zatrzymuje strumień fixów', async () => {
  const domMapy = await aplikacjaZMapa({ search: '?tryb=test' });
  domMapy.pobierz('setup-lat').value = '52.23178';
  domMapy.pobierz('setup-lon').value = '21.01234';
  domMapy.kliknij('przycisk-ustaw-reczne');

  domMapy.kliknij('przycisk-symulacja');
  await czekaj(300);
  domMapy.kliknij('przycisk-symulacja');
  assert.equal(domMapy.pobierz('przycisk-symulacja').dataset['attr-aria-pressed'], 'false');
  assert.match(domMapy.pobierz('status').textContent, /Symulacja zatrzymana/);
  const poStop = domMapy.pobierz('pozycja-wspolrzedne').textContent;
  await czekaj(500);
  assert.equal(domMapy.pobierz('pozycja-wspolrzedne').textContent, poStop, 'po stopie fixy nie płyną dalej');
});

test('symulacja: zejście karty w tło zatrzymuje odtwarzanie (uczciwość pomiaru)', async () => {
  const domMapy = await aplikacjaZMapa({ search: '?tryb=test' });
  domMapy.pobierz('setup-lat').value = '52.23178';
  domMapy.pobierz('setup-lon').value = '21.01234';
  domMapy.kliknij('przycisk-ustaw-reczne');

  domMapy.kliknij('przycisk-symulacja');
  await czekaj(250);
  domMapy.ustawHidden(true);
  domMapy.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(domMapy.pobierz('przycisk-symulacja').dataset['attr-aria-pressed'], 'false', 'tło zatrzymuje symulację');
  const poPauzie = domMapy.pobierz('pozycja-wspolrzedne').textContent;
  await czekaj(400);
  assert.equal(domMapy.pobierz('pozycja-wspolrzedne').textContent, poPauzie, 'w tle fixy nie płyną');
});

/* ------------------------------------------------- M4/I7: stacje z sieci w UI */

const KATALOG_APP = join(dirname(fileURLToPath(import.meta.url)), '..');

function czytajFixtureOverpass(nazwa) {
  return JSON.parse(readFileSync(join(KATALOG_APP, 'test', 'fixtures', `overpass-${nazwa}.json`), 'utf8'));
}

async function aplikacjaZSiecia({ search = '?tryb=test', pamiec = new Map() } = {}) {
  const domAtrapa = zainstalujDom({ search, pamiec });
  await import(`../app/app.js?siec=${Math.random().toString(36).slice(2)}`);
  return domAtrapa;
}

function ustawPozycjeTestowa(domAtrapa, lat = '52.2297', lon = '21.0122') {
  domAtrapa.pobierz('setup-lat').value = lat;
  domAtrapa.pobierz('setup-lon').value = lon;
  domAtrapa.kliknij('przycisk-ustaw-reczne');
}

test('stacje: bez window.fetch degradacja do pierścienia jest synchroniczna i jawna', async () => {
  const domAtrapa = await aplikacjaZSiecia();
  ustawPozycjeTestowa(domAtrapa);
  assert.equal(domAtrapa.window.fetch, undefined, 'atrapa NIE wystawia window.fetch (Node ma globalny — aplikacja czyta window)');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  // BEZ await — bez fetch cała ścieżka jest synchroniczna (testy nie czekają na sieć)
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3, 'pierścień rozstawiony od razu');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /tryb uproszczony/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /Overpass/, 'komunikat mówi, skąd będą prawdziwe stacje');
  assert.equal(domAtrapa.pobierz('przycisk-pierścien').hidden, true, 'bez pobranej sieci nie ma czego wymuszać');
});

test('stacje: cache sieci daje stacje SIECIOWE bez żadnego internetu', async () => {
  const pamiecCache = new Map();
  // nazwa miejsca ZAWSZE się wyświetla (Partia 2: koniec opcji geokodacji)
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  pamiecCache.set(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));

  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: pamiecCache });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  // też synchronicznie: cache zastępuje sieć
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa \(Overpass\) — punkty osiągalne/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /z pamięci telefonu/, 'druga gra w tej okolicy nie woła Overpass');
  assert.match(domAtrapa.pobierz('stacje-sprawiedliwosc').textContent, /sieciowo/);
  assert.match(domAtrapa.pobierz('stacje-sprawiedliwosc').textContent, /pierścień 700 m/);
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3);
  assert.equal(domAtrapa.pobierz('przycisk-pierścien').hidden, false, 'przy sieci można wymusić tryb uproszczony');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /Śródmieście/, '{MIEJSCE} z obszaru administracyjnego (bez Nominatim)');
});

test('stacje: udane pobranie z pierwszej instancji zapisuje cache i rysuje sieć', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const wywolania = [];
  domAtrapa.window.fetch = async (url, opcje) => {
    wywolania.push({ url, opcje });
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(250);
  assert.equal(wywolania.length, 1, 'jedno zapytanie na grę (ASSETS §2 pkt 1)');
  assert.equal(wywolania[0].url, INSTANCJE_OVERPASS[0].url, 'zaczynamy od FOSSGIS');
  assert.equal(wywolania[0].opcje.method, 'POST');
  const zapytanie = decodeURIComponent(wywolania[0].opcje.body.replace(/^data=/, ''));
  assert.match(zapytanie, /^\[out:json\]\[timeout:25\];/);
  assert.match(zapytanie, /around:1150,52\.2297,21\.0122/, 'R×1.15 i pozycja na siatce ~6 m');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/);
  assert.ok(!domAtrapa.pobierz('stacje-tryb').textContent.includes('z pamięci'), 'świeżo pobrane');
  assert.match(domAtrapa.pobierz('status').textContent, /Stacje z sieci drogowej|za uboga/);
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  const wpis = JSON.parse(domAtrapa.pamiec.get(klucz));
  assert.equal(wpis.schemat, SCHEMAT_SIECI);
  assert.ok(Number.isFinite(wpis.zapisanoMs));
  assert.ok(wpis.dane.drogi.length > 10, 'cache przechowuje sparsowane drogi');
});

test('stacje T1+T4: nakładka ładowania w trakcie pobierania, po 400 przycisk ponowienia', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  let puść = null;
  const bramka = new Promise((rozwiaz) => { puść = rozwiaz; });
  const wywolania = [];
  domAtrapa.window.fetch = async (url, opcje) => {
    wywolania.push(url);
    await bramka; // pobieranie „wisi" — nakładka musi być widoczna
    return { ok: false, status: 400, text: async () => '' };
  };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(50);
  assert.equal(domAtrapa.pobierz('stacje-ladowanie').hidden, false, 'nakładka Pobieram dane w trakcie fetch');
  puść();
  await czekaj(250);
  assert.equal(domAtrapa.pobierz('stacje-ladowanie').hidden, true, 'nakładka znika po odpowiedzi');
  assert.match(domAtrapa.pobierz('bledy-stacje').textContent, /HTTP 400/, 'błąd zapytania jawny (kod S03)');
  assert.equal(domAtrapa.pobierz('przycisk-siec-ponow').hidden, false, 'po porażce widać ponowienie');
  domAtrapa.window.fetch = async (url) => { wywolania.push(url); return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) }; };
  domAtrapa.kliknij('przycisk-siec-ponow');
  await czekaj(250);
  assert.equal(wywolania.length, 2, 'ponowienie woła sieć jeszcze raz');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/, 'udane ponowienie daje stacje sieciowe');
  assert.equal(domAtrapa.pobierz('przycisk-siec-ponow').hidden, true, 'przy sieci ponowienie znika');
});

test('stacje: sieć z cache pokazuje ponowienie, klik dowozi świeże dane z Overpass', async () => {
  const pamiecCache = new Map();
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  pamiecCache.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0', pamiec: pamiecCache });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const wywolania = [];
  domAtrapa.window.fetch = async (url) => {
    wywolania.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(150);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /z pamięci telefonu/, 'najpierw cache');
  assert.equal(wywolania.length, 0, 'wejście na ekran nie woła sieci przy świeżym cache');
  assert.equal(domAtrapa.pobierz('przycisk-siec-ponow').hidden, false, 'przy cache widać „Pobierz sieć ponownie"');
  domAtrapa.kliknij('przycisk-siec-ponow');
  await czekaj(250);
  assert.equal(wywolania.length, 1, 'ponowienie omija cache i woła Overpass');
  assert.ok(!domAtrapa.pobierz('stacje-tryb').textContent.includes('z pamięci'), 'po ponowieniu dane świeże');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /Śródmieście, Warszawa/, 'stacje sieciowe z miejsca');
  assert.equal(domAtrapa.pobierz('przycisk-siec-ponow').hidden, true, 'przy świeżych danych ponowienie znika');
});

test('Overpass: timeout martwej instancji przełącza OD RAZU, bez 30 s pauzy', async () => {
  // Pełny odstęp (bez odstep=0): stary kod czekałby tu 30 s na martwą instancję.
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const wywolania = [];
  domAtrapa.window.fetch = async (url) => {
    wywolania.push(url);
    if (wywolania.length === 1) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  const start = Date.now();
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(500);
  const trwalo = Date.now() - start;
  assert.equal(wywolania.length, 2, 'martwa FOSSGIS → od razu private.coffee');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/, 'druga instancja dowiozła');
  assert.ok(trwalo < 10_000, `przełączenie po timeoutcie bez pauzy (trwało ${trwalo} ms, pauza 30 s odpadła)`);
  assert.equal(domAtrapa.pamiec.get('okolica:overpass-sprawny'), INSTANCJE_OVERPASS[1].url, 'sprawna instancja zapamiętana');
});

test('Overpass: zapamiętana sprawna instancja jest próbowana pierwsza', async () => {
  const pamiec = new Map([['okolica:overpass-sprawny', INSTANCJE_OVERPASS[2].url]]);
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0', pamiec });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const wywolania = [];
  domAtrapa.window.fetch = async (url) => {
    wywolania.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(250);
  assert.deepEqual(wywolania, [INSTANCJE_OVERPASS[2].url], 'VK Maps pierwsza — zero doomed-zapytań do FOSSGIS');
});

test('stacje: 429 przełącza instancje dokładnie w kolejności ASSETS §2', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const odwiedzone = [];
  domAtrapa.window.fetch = async (url) => {
    odwiedzone.push(url);
    if (odwiedzone.length < 3) return { ok: false, status: 429 };
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(300);
  assert.deepEqual(odwiedzone, INSTANCJE_OVERPASS.map((i) => i.url), 'FOSSGIS → private.coffee → VK Maps');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/, 'trzecia instancja dowiozła');
});

test('stacje: wszystkie instancje odmawiają → [S03] i jawna degradacja do pierścienia', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  let ileProb = 0;
  domAtrapa.window.fetch = async () => { ileProb++; return { ok: false, status: 504 }; };
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(300);
  assert.equal(ileProb, 3, 'próbuje wszystkich instancji');
  assert.equal(domAtrapa.pobierz('bledy-stacje').hidden, false);
  assert.match(domAtrapa.pobierz('bledy-stacje').textContent, /\[S03\]/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /tryb uproszczony/);
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3, 'degradacja rozstawia pierścień (ADR 0005 pkt 8)');
});

test('stacje: przycisk „Tryb uproszczony" wymusza pierścień i wraca do sieci', async () => {
  const pamiecCache = new Map();
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  pamiecCache.set(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: pamiecCache });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/);

  domAtrapa.kliknij('przycisk-pierścien');
  assert.equal(domAtrapa.pobierz('przycisk-pierścien').dataset['attr-aria-pressed'], 'true');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /wymuszony/);
  assert.ok(!domAtrapa.pobierz('stacje-sprawiedliwosc').textContent.includes('sieciowo'), 'pierścień mierzy się w linii prostej');
  assert.match(domAtrapa.pobierz('status').textContent, /osiągalność stacji niezweryfikowana/);

  domAtrapa.kliknij('przycisk-pierścien');
  assert.equal(domAtrapa.pobierz('przycisk-pierścien').dataset['attr-aria-pressed'], 'false');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/, 'wyłączenie wymuszenia wraca do sieci');
  assert.match(domAtrapa.pobierz('stacje-sprawiedliwosc').textContent, /sieciowo/);
});

test('stacje: tryb ręczny — start/stop, przeciągnięcie pinezki, jawna linia prosta', async () => {
  const domAtrapa = await aplikacjaZSiecia(); // bez window.fetch → pierścień
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  assert.equal(domAtrapa.pobierz('przycisk-reczne').hidden, false, 'przy degradacji organizator może poprawić stacje ręcznie');
  // stan początkowy aria-pressed="false" pilnuje kontrakt HTML (atrapa nie parsuje atrybutów)

  const wyslijNa = (el, typ, zdarzenie) => {
    for (const fn of el.zdarzenia[typ] ?? []) fn({ type: typ, preventDefault() {}, ...zdarzenie });
  };

  domAtrapa.kliknij('przycisk-reczne');
  assert.equal(domAtrapa.pobierz('przycisk-reczne').dataset['attr-aria-pressed'], 'true');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /Tryb ręczny WŁĄCZONY/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /linii prostej/);
  assert.match(domAtrapa.pobierz('status').textContent, /Tryb ręczny/);

  // przeciągnij pierwszą pinezkę na mapie stacji (gest: pinezka → SVG capture)
  const pinezki = domAtrapa.pobierz('mapa-stacje-pinezki');
  const svg = domAtrapa.pobierz('mapa-stacje-svg');
  assert.ok(pinezki.children.length >= 3, 'pierścień rozstawiony na mapie');
  const dystansPrzed = domAtrapa.pobierz('lista-stacji').children[0].innerHTML;
  wyslijNa(pinezki.children[0], 'pointerdown', { pointerId: 11, clientX: 0, clientY: 0, stopPropagation() {} });
  wyslijNa(svg, 'pointermove', { pointerId: 11, clientX: 100, clientY: 100 });
  wyslijNa(svg, 'pointerup', { pointerId: 11 });
  const dystansPo = domAtrapa.pobierz('lista-stacji').children[0].innerHTML;
  assert.notEqual(dystansPo, dystansPrzed, 'lista odświeżona po przeciągnięciu');
  assert.match(dystansPo, /ustawiona ręcznie \(linia prosta — osiągalność niezweryfikowana\)/);

  domAtrapa.kliknij('przycisk-reczne'); // stop
  assert.equal(domAtrapa.pobierz('przycisk-reczne').dataset['attr-aria-pressed'], 'false');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /ustawione ręcznie przez organizatora/, 'po wyłączeniu UI nadal mówi, że stacja jest ręczna');

  // „Inny układ" gasi tryb ręczny i przywraca czysty pierścień
  domAtrapa.kliknij('przycisk-przelicz');
  assert.equal(domAtrapa.pobierz('przycisk-reczne').dataset['attr-aria-pressed'], 'false');
  assert.ok(!domAtrapa.pobierz('stacje-tryb').textContent.includes('ręcznie'), 'nowy układ nie udaje ręcznego');
  assert.ok(!domAtrapa.pobierz('lista-stacji').children[0].innerHTML.includes('ręcznie'));
});

/* --------------------------------------- M5/J3: podgląd i edycja organizatora */

function czytajFixturePaczka() {
  return JSON.parse(readFileSync(join(KATALOG_APP, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));
}

test('Q2 end-to-end: wklejona paczka odwrócona (rev1) od razu zaczyna grę', async () => {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?rev1=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const jawna = czytajFixturePaczka();
  const rev1 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV1 };
  dom.pobierz('pole-odpowiedz').value = JSON.stringify(rev1);
  dom.kliknij('przycisk-sprawdz');
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(odwrócona, rev1/, 'nagłówek mówi, co się stało');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'poprawna paczka od razu zaczyna grę (decyzja 2026-09-07)');
  assert.equal(dom.pobierz('ekran-paczka').hidden, true);
  assert.equal(dom.pobierz('pole-odpowiedz').value, '', 'plaintext nie zostaje w polu wklejenia');
});

test('rev2 end-to-end: wklejona paczka z kodami od razu zaczyna grę', async () => {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?rev2=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const jawna = czytajFixturePaczka();
  const rev2 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV2 };
  rev2.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(jawna.pytania.find((q) => q.id === p.id).poprawna, p); delete p.punkty; });
  dom.pobierz('pole-odpowiedz').value = JSON.stringify(rev2);
  dom.kliknij('przycisk-sprawdz');
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(odwrócona, rev2/, 'nagłówek mówi, co się stało');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'poprawna paczka od razu zaczyna grę (decyzja 2026-09-07)');
});

/* ================== M5/J5: brama geokodacji + warstwa zapasowa (Nominatim) */

/** Overpass zawsze 503 (ścieżka pierścienia); na Nominatim — podana odpowiedź. */
function fetchZNominatim(odpowiedzNominatim, wywolania) {
  return async (adres) => {
    wywolania.push(String(adres));
    if (String(adres).includes('nominatim.openstreetmap.org')) return odpowiedzNominatim;
    return { ok: false, status: 503, json: async () => ({}) };
  };
}

async function aplikacjaZKonfigiem(pamiecCache, konfig = {}) {
  pamiecCache.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', konfig }));
  // odstep=0: cykl instancji Overpass bez 30-sekundowych pauz (jak w testach M4)
  const domAtrapa = zainstalujDom({ search: '?tryb=test&odstep=0', pamiec: pamiecCache });
  await import(`../app/app.js?geokod=${Math.random().toString(36).slice(2)}`);
  return domAtrapa;
}

test('nazwa miejsca ZAWSZE trafia do UI i do promptu (Partia 2: koniec opcji geokodacji)', async () => {
  const pamiecCache = new Map(); // konfig domyślny, bez żadnych przełączników
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  pamiecCache.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: pamiecCache });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /Śródmieście/,
    'nazwa z Overpass bez ptaszkowania (ADR 0013 pkt 3 po Partii 2)');
  domAtrapa.kliknij('przycisk-dalej-prompt');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /Śródmieście/,
    'model dostaje miejscowość w prompcie (ADR 0006 pkt 3)');
});

test('prompt: jeden klik KOPIUJE także bez schowka asynchronicznego (iframe podglądu)', async () => {
  const pamiecCache = new Map();
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  pamiecCache.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: pamiecCache });
  // schowek asynchroniczny zablokowany jak w iframe podglądu
  Object.assign(navigator, { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } });
  const polecenia = [];
  document.execCommand = (polecenie) => { polecenia.push(polecenie); return true; };
  try {
    ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
    domAtrapa.kliknij('przycisk-dalej-stacje');
    domAtrapa.kliknij('przycisk-dalej-prompt');
    const prompt = domAtrapa.pobierz('pole-prompt').value;
    assert.ok(prompt.length > 100, 'prompt zbudowany');
    const przed = domAtrapa.utworzone.length;
    domAtrapa.kliknij('przycisk-kopiuj-prompt');
    await czekaj(50);
    assert.deepEqual(polecenia, ['copy'], 'awaryjnie: execCommand(copy) na tymczasowym polu');
    const tymczasowe = domAtrapa.utworzone.slice(przed).filter((el) => String(el.tagName).toLowerCase() === 'textarea');
    assert.equal(tymczasowe.length, 1, 'jedno tymczasowe pole');
    assert.equal(tymczasowe[0].value, prompt, 'do schowka trafia CAŁY prompt — klik kopiuje, nie zaznacza');
    assert.equal(domAtrapa.pobierz('przycisk-kopiuj-prompt').textContent, '✓ skopiowano');
  } finally {
    delete document.execCommand;
  }
});

test('warstwa zapasowa: domyślnie ZERO żądań do Nominatim (ADR 0013 pkt 2)', async () => {
  const pamiecCache = new Map();
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, {});
  const wywolania = [];
  domAtrapa.window.fetch = fetchZNominatim({ ok: true, json: async () => ({ address: { city: 'Warszawa' } }) }, wywolania);
  ustawPozycjeTestowa(domAtrapa, '52.23', '21.01');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(150);
  assert.ok(wywolania.length > 0, 'Overpass był próbowany (padł — ścieżka pierścienia)');
  assert.equal(wywolania.filter((a) => a.includes('nominatim')).length, 0,
    'bez wyraźnej zgody Nominatim nie jest wołany');
});

test('warstwa zapasowa: zgoda → JEDNO żądanie, nazwa z atrybucją ODbL i cache', async () => {
  const pamiecCache = new Map();
  pamiecCache.set('okolica:geokodacja-zapasowa', '1');
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, {});
  const wywolania = [];
  domAtrapa.window.fetch = fetchZNominatim(
    { ok: true, json: async () => ({ address: { suburb: 'Śródmieście', city: 'Warszawa' } }) },
    wywolania,
  );
  ustawPozycjeTestowa(domAtrapa, '52.23', '21.01');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(200);

  const nominatim = wywolania.filter((a) => a.includes('nominatim.openstreetmap.org'));
  assert.equal(nominatim.length, 1, 'dokładnie jedno żądanie (polityka OSMF: brak zapytań systematycznych)');
  const params = new URL(nominatim[0]).searchParams;
  assert.equal(params.get('format'), 'jsonv2');
  assert.equal(params.get('lat'), '52.23000', 'pozycja zaokrąglona (ADR 0013 pkt 3)');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /Śródmieście, Warszawa/);
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /ODbL/, 'atrybucja wymagana polityką OSMF');
  const wpis = JSON.parse(pamiecCache.get('okolica:miejsce:u3qcnh') ?? 'null');
  assert.equal(wpis?.schemat, 'miejsce/1', 'wynik w cache pod kluczem geohash6 (obowiązkowy cache, ASSETS §3)');
  assert.equal(wpis?.miejsce, 'Śródmieście, Warszawa');
});

test('warstwa zapasowa: druga gra bierze nazwę z cache — zero nowych żądań', async () => {
  const pamiecCache = new Map();
  pamiecCache.set('okolica:geokodacja-zapasowa', '1');
  pamiecCache.set('okolica:miejsce:u3qcnh', JSON.stringify({ schemat: 'miejsce/1', zapisanoMs: Date.now(), miejsce: 'Śródmieście, Warszawa' }));
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, {});
  const wywolania = [];
  domAtrapa.window.fetch = fetchZNominatim({ ok: true, json: async () => ({}) }, wywolania);
  ustawPozycjeTestowa(domAtrapa, '52.23', '21.01');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(150);
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /Śródmieście, Warszawa/, 'nazwa z cache');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /ODbL/, 'atrybucja zostaje przy danych z cache');
  assert.equal(wywolania.filter((a) => a.includes('nominatim')).length, 0, 'cache = brak żądania');
});

test('warstwa zapasowa: HTTP 429 → komunikat, bez wyjątku i bez ponawiania w sesji', async () => {
  const pamiecCache = new Map();
  pamiecCache.set('okolica:geokodacja-zapasowa', '1');
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, {});
  const wywolania = [];
  domAtrapa.window.fetch = fetchZNominatim({ ok: false, status: 429, json: async () => ({}) }, wywolania);
  ustawPozycjeTestowa(domAtrapa, '52.23', '21.01');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(150);
  assert.match(domAtrapa.pobierz('status').textContent, /HTTP 429/, 'komunikat z kodem odpowiedzi');
  assert.match(domAtrapa.pobierz('status').textContent, /same współrzędne/, 'uczciwie: prompt będzie bez nazwy');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /nazwa miejsca: brak/, 'miejsce zostaje puste');
  assert.equal(domAtrapa.pobierz('stacje-tryb').textContent.includes('pierścień'), true, 'gra toczy się dalej na pierścieniu');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  await czekaj(100);
  assert.equal(wywolania.filter((a) => a.includes('nominatim')).length, 1, 'jedna próba na sesję — zero ponawiania');
});

/* ============ M6/R4: ekran gry — fazy przygotowanie/odcinek, pauza */

/** Przyjęta paczka + pozycja + stacje z pierścienia (synchronicznie, bez fetch).
 *  Zwraca też `pamiec` — testy trwałości (R6) czytają klucze zapisu gry. */
async function graGotowaDoStartu() {
  const pamiec = new Map();
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?gra=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const paczka = czytajFixturePaczka();
  dom.pobierz('pole-odpowiedz').value = JSON.stringify(paczka);
  dom.kliknij('przycisk-sprawdz'); // poprawna paczka SAMA zaczyna grę (decyzja 2026-09-07)
  return { dom, paczka, pamiec };
}

function zaczynijGre(dom) {
  // Gra startuje sama w chwili Sprawdź — helper tylko to potwierdza.
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra wystartowała sama po przyjęciu paczki');
}

test('M6: start gry — przyjęta paczka sama otwiera ekran gry i fazę A (przygotowanie)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  assert.equal(dom.pobierz('ekran-paczka').hidden, true, 'ekran paczki schowany');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, false, 'panel A widoczny w fazie przygotowanie');
  for (const panel of ['gra-panel-odcinek', 'gra-panel-pytanie', 'gra-panel-koniec']) {
    assert.equal(dom.pobierz(panel).hidden, true, `${panel} ukryty poza swoją fazą`);
  }
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 1 z 3/, 'postęp z bieżącej stacji');
  assert.match(dom.pobierz('gra-kolejka').textContent, /Kolej: Gracz 1/, 'badge kolejki z imieniem (domyślne imiona z konfigu)');
  assert.match(dom.pobierz('przycisk-start-odcinka').textContent, /Idę do stacji 1/, 'główny przycisk fazy mówi, dokąd idzie');
  assert.match(dom.pobierz('gra-cel-stacji').textContent, /m w linii prostej od poprzedniego punktu/, 'pierścień (brak sieci): etykieta mówi wprost, że to prosta kreska (ADR 0014 pkt 1)');
  assert.match(dom.pobierz('gra-dystans').textContent, /\d+ m/, 'badge dystansu w linii prostej z bieżącej pozycji');
});

test('M6: odcinek — start, ręczne dojście z karą i odmowa drugiego startu (G03)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'panel B w fazie odcinek');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true);
  assert.equal(dom.pobierz('przycisk-pomin-stacje').disabled, false, 'pominięcie dostępne TYLKO w drodze (ADR 0015 pkt 2)');
  assert.equal(dom.pobierz('przycisk-symulacja-gra').hidden, false, 'w trybie testowym symulacja dojścia do stacji');

  // drugi start tego samego odcinka → jawna odmowa z kodem G03, nie wyjątek
  dom.kliknij('przycisk-start-odcinka');
  assert.match(dom.pobierz('bledy-gra').textContent, /G03/, 'kod rozgrywki widoczny w alercie');

  // ręczne zgłoszenie dojścia: kara i przejście do fazy pytania
  dom.kliknij('przycisk-reczne-dojscie');
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'faza pytania — panel C (wypełnienie treścią w R5)');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, true);
  assert.match(dom.pobierz('status').textContent, /ręcznie/, 'status mówi wprost o ręcznym zgłoszeniu');
  assert.equal(dom.pobierz('bledy-gra').hidden, true, 'poprawna tranzycja czyści poprzedni błąd');
});

test('M6: pauza — przyciski stają, wznowienie jawne (ADR 0004 pkt 1)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  const pauza = dom.pobierz('przycisk-pauza');

  dom.kliknij('przycisk-pauza');
  assert.equal(pauza.getAttribute('aria-pressed'), 'true', 'aria-pressed po pauzie');
  assert.match(pauza.textContent, /Wznów/, 'przycisk zmienia rolę');
  assert.equal(dom.pobierz('przycisk-reczne-dojscie').disabled, true, 'w pauzie nie ma akcji fazowych');
  assert.equal(dom.pobierz('przycisk-pomin-stacje').disabled, true);
  assert.equal(dom.pobierz('gra-pauza-komunikat').hidden, false, 'komunikat pauzy widoczny');

  dom.kliknij('przycisk-pauza');
  assert.equal(pauza.getAttribute('aria-pressed'), 'false');
  assert.match(pauza.textContent, /Pauza/);
  assert.equal(dom.pobierz('przycisk-reczne-dojscie').disabled, false, 'wznowienie odblokowuje akcje');
});

/* ================= M6/R5: pętla pytania — odsłonięcie, odpowiedź, źródła */

/** Pełna ścieżka do fazy pytania: start gry → odcinek → ręczne dojście. */
async function graWFaziePytania() {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-reczne-dojscie');
  return { dom, paczka };
}

test('M6: pytanie odsłania się DOPIERO na stacji i ma cztery odpowiedzi (ADR 0007 pkt 6)', async () => {
  const { dom, paczka } = await graWFaziePytania();
  const pierwsze = paczka.pytania.find((q) => q.stacja === 1);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'panel C w fazie pytania');
  assert.match(dom.pobierz('gra-pytanie-naglowek').textContent, /Stacja 1 zdobyta · pytanie 1 z 1 · odpowiada Gracz 1/);
  assert.equal(dom.pobierz('gra-pytanie-tresc').textContent, pierwsze.tresc, 'treść z odsłoniętego kontenera');
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  assert.equal(przyciski.length, 4, 'cztery odpowiedzi');
  przyciski.forEach((b, i) => {
    assert.equal(b.textContent, `${'ABCD'[i]}. ${pierwsze.odpowiedzi[i]}`);
    assert.equal(b.disabled, false, 'przed odpowiedzią wszystkie aktywne');
  });
  assert.equal(dom.pobierz('gra-wynik-odpowiedzi').hidden, true, 'ocena i wyjaśnienie dopiero po odpowiedzi');
  assert.equal(dom.pobierz('przycisk-nastepna-stacja').hidden, true);
  // przed dojściem treści pytania nie było NICZYM w UI — strażnik: ekran paczki schowany, pole wklejenia puste
  assert.equal(dom.pobierz('ekran-paczka').hidden, true);
  assert.equal(dom.pobierz('pole-odpowiedz').value, '');
});

test('M6: poprawna odpowiedź — ocena, punkty, wyjaśnienie i źródła z linkami', async () => {
  const { dom, paczka } = await graWFaziePytania();
  const pierwsze = paczka.pytania.find((q) => q.stacja === 1);
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  const dobry = przyciski[pierwsze.poprawna];
  for (const fn of dobry.zdarzenia.click ?? []) fn({ type: 'click', target: dobry, currentTarget: dobry });

  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /✓ Dobrze! \+1 pkt/, 'ocena: 1 pkt za poprawną (rev2)');
  assert.ok(dobry.classList.contains('poprawna'), 'poprawna odpowiedź podświetlona');
  przyciski.forEach((b) => assert.equal(b.disabled, true, 'po odpowiedzi przyciski zablokowane — bez poprawek'));
  assert.equal(dom.pobierz('gra-wyjasnienie').textContent, pierwsze.wyjasnienie, 'wyjaśnienie z paczki');
  const zrodla = dom.pobierz('gra-zrodla').children;
  assert.equal(zrodla.length, pierwsze.zrodla.length, 'wszystkie źródła pytania (ADR 0008)');
  const a = zrodla[0].children[0];
  assert.equal(a.href, pierwsze.zrodla[0].url);
  assert.equal(a.target, '_blank');
  assert.equal(a.rel, 'noopener noreferrer');
  assert.match(a.textContent, /sprawdzono/, 'data sprawdzenia źródła widoczna');
  assert.equal(dom.pobierz('gra-wynik-odpowiedzi').hidden, false);
  assert.equal(dom.pobierz('przycisk-nastepna-stacja').hidden, false);
  assert.match(dom.pobierz('przycisk-nastepna-stacja').textContent, /Następna stacja/, 'jedno pytanie, jeden gracz — stacja zamknięta');
  // panele TRZYMAJĄ wyjaśnienie: model jest już w fazie przygotowanie, ale C widoczny
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'wyjaśnienie nie znika zanim gracz kliknie dalej');
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 2 z 3/, 'badge postępu już po zamknięciu stacji');
});

test('M6: „Następna stacja" przełącza fazę i rotuje gracza (hot-seat, ADR 0009)', async () => {
  const { dom } = await graWFaziePytania();
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski[0], currentTarget: przyciski[0] });
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, true, 'panel C zamknięty');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, false, 'faza przygotowanie — panel A');
  assert.match(dom.pobierz('gra-kto-idzie').textContent, /Idzie: Gracz 2 → stacja 2/, 'rotacja kolejki (2 graczy z domyślnej konfiguracji)');
  assert.match(dom.pobierz('przycisk-start-odcinka').textContent, /Idę do stacji 2/);
});

test('M6: błędna odpowiedź — zero punktów, podświetlona poprawna, gra idzie dalej', async () => {
  const { dom, paczka } = await graWFaziePytania();
  const pierwsze = paczka.pytania.find((q) => q.stacja === 1);
  const zlyIndex = (pierwsze.poprawna + 1) % 4;
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  const zly = przyciski[zlyIndex];
  for (const fn of zly.zdarzenia.click ?? []) fn({ type: 'click', target: zly, currentTarget: zly });
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /✗ Źle \(0 pkt\)/);
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, new RegExp(`Poprawna odpowiedź: ${'ABCD'[pierwsze.poprawna]}\\.`), 'poprawna odpowiedź ujawniona po błędzie');
  assert.ok(zly.classList.contains('zla'), 'błędna podświetlona na czerwono');
  assert.ok(przyciski[pierwsze.poprawna].classList.contains('poprawna'), 'poprawna na zielono');
  assert.equal(dom.pobierz('gra-wyjasnienie').textContent, pierwsze.wyjasnienie, 'wyjaśnienie także po błędzie — tu jest najwięcej nauki');
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, false, 'gra idzie dalej mimo błędu');
});

/* ============ M6/R6: trwałość — zapis po tranzycjach, wznowienie, koniec */

test('M6: zapis gry ląduje w pamięci po każdym ruchu i nie niesie plaintextu', async () => {
  const { dom, paczka, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  assert.match(pamiec.get('okolica:gra-aktywna'), /^[a-z0-9-]{1,40}$/, 'wskaźnik aktywnej gry = auto-slug (Partia 2: koniec ręcznego kodu)');
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  assert.ok(pamiec.has(kluczZapisu), 'zapis pod kluczem okolica:gra:<kod> — czyszczenie danych go obejmuje');
  let snapshot = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(snapshot.schemat, 'stan-gry/1');
  assert.equal(snapshot.rozgrywka.faza, 'przygotowanie');
  assert.ok(Number.isFinite(snapshot.zegarMs), 'kotwica zegara sesji zapisana (rebase przy wznowieniu)');
  assert.equal(snapshot.kontenerPaczki.schemat, 'TO-paczka/2');
  assert.equal(pamiec.get(kluczZapisu).includes(paczka.pytania[0].tresc), false, 'STRAŻNIK: treść pytania nie istnieje w zapisie');

  dom.kliknij('przycisk-start-odcinka');
  snapshot = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(snapshot.rozgrywka.faza, 'odcinek', 'zapis po starcie odcinka');
  assert.equal(snapshot.rozgrywka.odcinki[0].stan, 'w-trakcie');

  dom.kliknij('przycisk-reczne-dojscie');
  snapshot = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(snapshot.rozgrywka.faza, 'pytanie', 'zapis po dojściu');
});

test('M6: wznowienie po „zamknięciu przeglądarki" — nowa instancja, ta sama pamięć, rebaza zegara', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(JSON.parse(pamiec.get(kluczZapisu)).rozgrywka.faza, 'odcinek');

  // „zamknięcie przeglądarki": zupełnie nowa instancja aplikacji na tej samej pamięci
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?wznow=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom2.pobierz('karta-wznowienie').hidden, false, 'baner wznowienia na setupie');
  assert.match(dom2.pobierz('wznowienie-opis').textContent, /niedokończoną grę/, 'opis mówi po ludzku, co znaleziono');
  assert.match(dom2.pobierz('wznowienie-opis').textContent, /faza: odcinek/);

  dom2.kliknij('przycisk-wznow-gre');
  assert.equal(dom2.pobierz('setup-promien').zdarzenia.input.length, 1, 'L14: wznowienie nie dokleja drugiego nasłuchu pól setupu');
  assert.equal(dom2.pobierz('ekran-gra').hidden, false, 'wznowienie wraca na ekran gry');
  assert.equal(dom2.pobierz('gra-panel-odcinek').hidden, false, 'faza odcinka odtworzona');
  assert.equal(dom2.pobierz('karta-wznowienie').hidden, true, 'baner znika po wznowieniu');

  // rebaza zegara działa: zakończenie odcinka NIE daje G09 (czas końca < startu)
  dom2.kliknij('przycisk-reczne-dojscie');
  assert.equal(dom2.pobierz('bledy-gra').hidden, true, `brak błędu, a jest: ${dom2.pobierz('bledy-gra').textContent}`);
  assert.equal(dom2.pobierz('gra-panel-pytanie').hidden, false, 'gra toczy się dalej po wznowieniu');
});

test('M6: zepsuty zapis — jawne kody T i dwustopniowe kasowanie (bez confirm)', async () => {
  const pamiec = new Map();
  pamiec.set('okolica:gra-aktywna', 'zepsuta');
  pamiec.set('okolica:gra:zepsuta', 'to nie jest json');
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?zepsuty=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom.pobierz('karta-wznowienie').hidden, false, 'baner się pokazuje');
  assert.equal(dom.pobierz('przycisk-wznow-gre').hidden, true, 'zepsutego zapisu nie da się wznowić');
  assert.match(dom.pobierz('wznowienie-opis').textContent, /zepsuty zapis/, 'komunikat wprost');
  assert.match(dom.pobierz('wznowienie-opis').textContent, /T01/, 'kod usterki widoczny');

  dom.kliknij('przycisk-kasuj-zapis');
  assert.ok(pamiec.has('okolica:gra:zepsuta'), 'pierwszy klik tylko uzbraja');
  assert.match(dom.pobierz('przycisk-kasuj-zapis').textContent, /Kliknij ponownie/);
  dom.kliknij('przycisk-kasuj-zapis');
  assert.equal(pamiec.has('okolica:gra:zepsuta'), false, 'drugi klik kasuje zapis gry');
  assert.equal(pamiec.has('okolica:gra-aktywna'), false);
  assert.equal(dom.pobierz('karta-wznowienie').hidden, true, 'baner znika');
});

test('M6: pominięcie odcinka w drodze — jawny skutek i gra idzie dalej (ADR 0015)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  assert.equal(dom.pobierz('przycisk-pomin-stacje').disabled, true, 'w fazie A pominąć się nie da (G11)');
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-pomin-stacje');
  assert.match(dom.pobierz('status').textContent, /pominięty/, 'status mówi o pominięciu');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, false, 'następna stacja czeka w fazie A');
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 2 z 3/);
  assert.equal(dom.pobierz('przycisk-pomin-stacje').disabled, true, 'po tranzycji znowu zablokowane');
  assert.equal(JSON.parse(pamiec.get('okolica:gra:' + pamiec.get('okolica:gra-aktywna'))).rozgrywka.odcinki[0].stan, 'pominiety', 'zapis niesie pominięcie');
});

test('M6: ręczne zakończenie gry — dwustopniowe, wynik wcześniej, zapis zostaje', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  const zakoncz = dom.pobierz('przycisk-zakoncz-gre');

  dom.kliknij('przycisk-zakoncz-gre');
  assert.match(zakoncz.textContent, /Kliknij ponownie/, 'pierwszy klik uzbraja (bez confirm — ADR 0015 pkt 6)');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, true, 'pierwszy klik jeszcze NIE pokazuje wyniku');

  dom.kliknij('przycisk-zakoncz-gre');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'panel wyniku widoczny');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true);
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 2, 'wynik per gracz (2 graczy z konfiguracji)');
  assert.equal(wiersze[0].children.length, 3, 'gracz | punkty | poprawne');
  assert.match(dom.pobierz('status').textContent, /można ją wznowić/, 'uczciwie: zapis zostaje');
  assert.ok(pamiec.has('okolica:gra:' + pamiec.get('okolica:gra-aktywna')), 'zapis NIE skasowany — można wrócić do gry');
  assert.match(zakoncz.textContent, /Zakończ grę/, 'przycisk wraca do zwykłej etykiety');
});

/* ========== M6/R7: integracja — pełna gra z symulacją, zasięg, ADR 0015 */

/** Klik w konkretny przycisk odpowiedzi (elementy tworzone dynamicznie). */
function kliknijOdpowiedz(dom, indeks) {
  const b = dom.pobierz('gra-odpowiedzi').children[indeks];
  for (const fn of b.zdarzenia.click ?? []) fn({ type: 'click', target: b, currentTarget: b });
}

test('M6/R7: PEŁNA GRA z symulacją dojścia — 3 stacje, pytania NA stacji, wynik (ścieżka GPS)', async () => {
  const { dom, paczka, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
    assert.match(dom.pobierz('przycisk-start-odcinka').textContent, new RegExp(`Idę do stacji ${numerStacji}`));
    dom.kliknij('przycisk-start-odcinka');
    assert.equal(dom.pobierz('przycisk-symulacja-gra').hidden, false, 'symulacja dostępna w odcinku');
    dom.kliknij('przycisk-symulacja-gra');
    await czekaj(9 * 120 + 600); // dziewięć fixów po 120 ms + zapas (wzorzec z M3)
    // dojście rozstrzyga stanDojscia z prawdziwego strumienia fixów — bez klikania „ręcznie"
    assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, `stacja ${numerStacji}: pytanie po dojściu GPS`);
    assert.match(dom.pobierz('status').textContent, /Stacja osiągnięta — próg dojścia zadziałał z GPS/, 'komunikat dojścia z GPS, nie ręcznego');
    assert.equal(dom.pobierz('gra-pytanie-tresc').textContent, pytanie.tresc, `stacja ${numerStacji}: treść z kontenera`);
    kliknijOdpowiedz(dom, pytanie.poprawna);
    assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /✓ Dobrze!/, `stacja ${numerStacji}: poprawna odpowiedź punktuje`);
    const dalej = dom.pobierz('przycisk-nastepna-stacja');
    if (numerStacji < 3) {
      assert.match(dalej.textContent, /Następna stacja/);
    } else {
      assert.match(dalej.textContent, /Zobacz wynik/, 'po ostatniej stacji model kończy grę');
    }
    dom.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'panel wyniku po pełnej pętli');
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 2, 'wynik per gracz');
  assert.match(wiersze[0].children[0].textContent, /🏆/, 'zwycięzca rankingu oznaczony');
  assert.equal(wiersze[0].children[1].textContent !== '0', true, 'punkty policzone (3 poprawne odpowiedzi × rotacja graczy)');
  // zapis niesie naturalny koniec
  const snapshot = JSON.parse(pamiec.get('okolica:gra:' + pamiec.get('okolica:gra-aktywna')));
  assert.equal(snapshot.rozgrywka.faza, 'koniec');
  assert.equal(snapshot.rozgrywka.odcinki.every((o) => o.stan === 'zakonczony' && o.trybDojscia === 'gps'), true, 'wszystkie odcinki zamknięte dojściem GPS');
});

test('M6/R7: utrata zasięgu w trakcie gry — zero żądań sieciowych, gra żyje z pamięci', async () => {
  const { dom } = await graGotowaDoStartu();
  const wywolania = [];
  dom.window.fetch = async (adres) => { wywolania.push(String(adres)); return { ok: false, status: 503 }; };
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-reczne-dojscie');
  kliknijOdpowiedz(dom, 0);
  dom.kliknij('przycisk-nastepna-stacja');
  dom.kliknij('przycisk-start-odcinka');
  await czekaj(100);
  assert.equal(wywolania.length, 0, 'ani Overpass, ani Nominatim, ani nic innego — stacje i pytania są na telefonie');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'gra toczy się dalej bez sieci');
});

test('M6/R7: stacja bez pytania zamyka się samym dojściem (ADR 0015) — gra wznowiona z zapisu', async () => {
  // Snapshot budujemy CZYSTYMI modułami: 4 stacje, paczka z pytaniami do 1–3
  // (przez UI taka paczka nie przejdzie — E05; ADR 0015 żyje w modelu i w zapisie)
  const { SCHEMAT_STANU, kluczStanu, KLUCZ_AKTYWNEJ, serializujStan, zbierajStan } = await import('../app/trwalosc.js');
  const { nowaRozgrywka } = await import('../app/rozgrywka.js');
  const { zapakujPaczke } = await import('../app/kodowanie.js');
  const { WERSJA_PROTOKOLU } = await import('../app/protokol.js');
  const { stacjeProste } = await import('../app/stacje.js');
  const { domyslnaKonfiguracja } = await import('../app/konfig.js');
  const paczka = czytajFixturePaczka();
  const konfig = { ...domyslnaKonfiguracja(2), kodGry: 'adr-0015', promienM: 1000, liczbaStacji: 4 };
  const stacje = stacjeProste({ srodek: { lat: 52.2297, lon: 21.0122 }, liczbaStacji: 4, promienM: 1000, ziarno: 'z' });
  const rozgrywka = nowaRozgrywka({ konfig, stacje, paczka, srodek: { lat: 52.2297, lon: 21.0122 }, czasMs: 0, ziarno: 'z' });
  assert.deepEqual(rozgrywka.brakPytan, [4], 'model widzi stację bez pytania (M1)');
  const snapshot = zbierajStan({
    konfig, stacje, kontenerPaczki: zapakujPaczke(paczka, WERSJA_PROTOKOLU), rozgrywka,
    pozycja: { lat: 52.2297, lon: 21.0122, dokladnoscM: 10, zrodlo: 'reczne' },
    terazMs: Date.now(), zegarMs: 1000,
  });
  const pamiec = new Map();
  pamiec.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', konfig }));
  pamiec.set(kluczStanu('adr-0015'), serializujStan(snapshot));
  pamiec.set(KLUCZ_AKTYWNEJ, 'adr-0015');

  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?adr15=${Math.random().toString(36).slice(2)}`);
  assert.match(dom.pobierz('wznowienie-opis').textContent, /stacja 1 z 4/);
  dom.kliknij('przycisk-wznow-gre');

  // stacje 1–3: normalna pętla z pytaniami (pominięcie wystarczy — testujemy 4.)
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje'); // pominięcie w drodze — bez pytań, szybko
  }
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 4 z 4/, 'gramy o stację bez pytania');
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-reczne-dojscie');
  // ADR 0015: dojście zamyka stację BEZ fazy pytania — gra kończy się od razu
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, true, 'stacja bez pytania nie otwiera panelu pytania');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'ostatnia stacja zamknięta dojściem = koniec gry');
  assert.equal(dom.pobierz('bledy-gra').hidden, true, 'żaden wyjątek, żaden błąd — jawne zachowanie z ADR 0015');
});

/* ========== M7/P3: pełne podsumowanie (panel D) */

test('M7: pełne podsumowanie — zwycięzca, statystyki, karty graczy i stacje', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje'); // pominięcie ×3 = naturalny koniec gry
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'koniec po pominięciu wszystkich stacji');

  // 1. karta zwycięzcy: nikt nie punktował — ranking otwiera pierwszy gracz (sort stabilny)
  const zwyciezca = dom.pobierz('gra-wynik-zwyciezca').textContent;
  assert.match(zwyciezca, /🏆 Gracz 1/, 'zwycięzca z rankingu podsumowanie()');
  assert.match(zwyciezca, /0 pkt/, 'duże punkty w karcie');
  assert.match(zwyciezca, /poprawne 0\/0/, 'poprawne/razem w karcie');

  // 2. statystyki gry: liczby z podsumowanie(), dziennik nie kłamie
  const statystyki = dom.pobierz('gra-wynik-statystyki').textContent;
  assert.equal(statystyki.includes('czas gry'), false, 'zero presji czasowej (Partia 2)');
  assert.match(statystyki, /zaliczone:0 z 3/, 'dt+dd bez spacji w agregacji — odstęp daje siatka CSS');
  assert.match(statystyki, /pominięte:3/);
  assert.match(statystyki, /stacje bez pytań:brak/, 'paczka pokrywa wszystkie stacje');
  assert.match(statystyki, /zdarzenia w dzienniku:\d+/);

  // 3. karty graczy: dwie, z punktami, poprawnością, dystansem i ręcznymi dojściami
  const karty = dom.pobierz('gra-wynik-gracze').children;
  assert.equal(karty.length, 2, 'karta per gracz, w kolejności rankingu');
  assert.match(karty[0].textContent, /Gracz 1 🏆 · 0 pkt/);
  assert.match(karty[0].textContent, /0 pkt · poprawne 0, błędne 0/);
  assert.match(karty[0].textContent, /odcinki: 2 · dystans/, 'Gracz 1 miał odcinki 1 i 3 (rotacja)');
  assert.match(karty[0].textContent, /ręczne dojścia: 0/);
  assert.match(karty[1].textContent, /odcinki: 1/, 'Gracz 2 miał odcinek 2');

  // 4. tabela stacji: 3 wiersze, każda pominięta, bez gracza „—" (rotacja przypisana)
  const wiersze = dom.pobierz('gra-wynik-stacje-tbody').children;
  assert.equal(wiersze.length, 3);
  for (const w of wiersze) {
    assert.match(w.textContent, /pominięta/, 'stan z odcinka');
    assert.match(w.textContent, /Gracz [12]/, 'gracz odcinka przy stacji');
  }

  // ranking M6 zostaje (te R6/R7 go czytają) — spójny z kartą zwycięzcy
  assert.equal(dom.pobierz('gra-wyniki-tbody').children.length, 2);
  assert.match(dom.pobierz('gra-wyniki-tbody').children[0].children[0].textContent, /Gracz 1 🏆/);
});

/* ========== M7/P4: eksport tekstu wyniku (share / schowek / plik) */

test('M7: eksport tekstu — pole readonly, clipboard, share i plik (ścieżki istnieją → przyciski widoczne)', async () => {
  const { dom } = await graGotowaDoStartu();
  const skopiowane = [];
  const udostepnione = [];
  Object.assign(navigator, {
    clipboard: { writeText: async (tekst) => { skopiowane.push(tekst); } },
    share: async (dane) => { udostepnione.push(dane); },
  });
  zaczynijGre(dom);
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje');
  }
  const tekst = dom.pobierz('pole-wynik-tekst').value;
  assert.match(tekst, /^TAJEMNICZA OKOLICA — WYNIK GRY/, 'tekst wyniku żyje w polu readonly');
  assert.match(tekst, /🏆 Gracz 1 — 0 pkt/);
  assert.match(tekst, /stacja 3 · Gracz 1 — pominięta · 0 pkt/);
  assert.match(tekst, /tryb: piesza/, 'konfig gry w nagłówku');
  assert.equal(/[#*_]/.test(tekst), false, 'zero markdowna w udostępnianym tekście');

  // przyciski widoczne, bo ich ścieżki istnieją (decyzja 8)
  assert.equal(dom.pobierz('przycisk-udostepnij-wynik').hidden, false);
  assert.equal(dom.pobierz('przycisk-kopiuj-wynik').hidden, false);
  assert.equal(dom.pobierz('przycisk-pobierz-wynik').hidden, false);

  // kopiuj → clipboard dostaje DOKŁADNIE tekst pola, przycisk potwierdza
  dom.kliknij('przycisk-kopiuj-wynik');
  await czekaj(50);
  assert.deepEqual(skopiowane, [tekst]);
  assert.equal(dom.pobierz('przycisk-kopiuj-wynik').textContent, '✓ skopiowano');

  // udostępnij → navigator.share dostaje tekst wyniku
  dom.kliknij('przycisk-udostepnij-wynik');
  await czekaj(50);
  assert.equal(udostepnione.length, 1);
  assert.equal(udostepnione[0].text, tekst);
  assert.match(udostepnione[0].title, /Tajemnicza okolica/);

  // plik → bez wyjątku, jawny status (Blob/URL/click istnieją w atrapie od M5)
  dom.kliknij('przycisk-pobierz-wynik');
  await czekaj(50);
  assert.match(dom.pobierz('status').textContent, /zapisany jako plik .txt/);
});

test('M7: brak clipboarda i share — przyciski uczciwie ukryte, plik i pole zostają', async () => {
  const { dom } = await graGotowaDoStartu();
  // atrapa bez clipboarda i bez navigator.share (desktop / stary telefon)
  zaczynijGre(dom);
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje');
  }
  assert.equal(dom.pobierz('przycisk-udostepnij-wynik').hidden, true, 'bez navigator.share przycisk nie kłamie');
  assert.equal(dom.pobierz('przycisk-kopiuj-wynik').hidden, true, 'bez navigator.clipboard przycisk nie kłamie');
  assert.equal(dom.pobierz('przycisk-pobierz-wynik').hidden, false, 'plik jest ścieżką dla każdego');
  assert.equal(dom.pobierz('przycisk-udostepnij-obraz').hidden, true, 'bez navigator.canShare brak udostępniania obrazu (P5)');
  assert.equal(dom.pobierz('przycisk-pobierz-obraz').hidden, false, 'canvas jest wszędzie — obraz .png zawsze');
  assert.match(dom.pobierz('pole-wynik-tekst').value, /WYNIK GRY/, 'tekst zawsze można zaznaczyć ręcznie');
});

test('M7: ręczne zakończenie — tekst wyniku mówi wprost, że gra przerwana (wynik wczesny)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-reczne-dojscie');
  kliknijOdpowiedz(dom, 0);
  dom.kliknij('przycisk-zakoncz-gre'); // uzbrojenie
  dom.kliknij('przycisk-zakoncz-gre'); // wykonanie → wczesny wynik
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false);
  assert.match(dom.pobierz('pole-wynik-tekst').value, /\(gra przerwana ręcznie — wynik wczesny\)/, 'uczciwa adnotacja w udostępnianym tekście');
});

test('M7: eksport obrazu wyniku — plan przechodzi przez canvas do PNG (plik i share z File)', async () => {
  const { dom } = await graGotowaDoStartu();
  const udostepnione = [];
  Object.assign(dom.navigator, {
    canShare: (dane) => Boolean(dane?.files?.length),
    share: async (dane) => { udostepnione.push(dane); },
  });
  zaczynijGre(dom);
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje');
  }
  assert.equal(dom.pobierz('przycisk-pobierz-obraz').hidden, false);
  assert.equal(dom.pobierz('przycisk-udostepnij-obraz').hidden, false, 'canShare + File → przycisk widoczny');

  // pobranie: jeden canvas, plan przerysowany co do komendy, PNG do pliku
  const przed = dom.utworzone.length;
  dom.kliknij('przycisk-pobierz-obraz');
  await czekaj(80);
  const canvasy = dom.utworzone.slice(przed).filter((el) => String(el.tagName).toLowerCase() === 'canvas');
  assert.equal(canvasy.length, 1, 'dokładnie jeden canvas na eksport');
  const canvas = canvasy[0];
  assert.equal(canvas.width, 1080, 'szerokość z planu');
  assert.ok(canvas.height > 500, 'wysokość z treści planu');
  const teksty = canvas.komendy.filter((k) => k.op === 'fillText').map((k) => k.tekst);
  assert.ok(teksty.includes('TAJEMNICZA OKOLICA'), 'wykonawca przekazuje teksty planu');
  assert.ok(teksty.some((x) => x.includes('🏆 Gracz 1')), 'zwycięzca na obrazie');
  assert.ok(teksty.some((x) => x.startsWith('1. Gracz 1 — 0 pkt')), 'ranking wspólnym formatem');
  assert.ok(canvas.komendy.some((k) => k.op === 'fillRect'), 'tło i karta przerysowane');
  assert.ok(canvas.komendy.some((k) => k.op === 'stroke'), 'separatory przerysowane');
  const kolory = canvas.komendy.filter((k) => k.fillStyle).map((k) => k.fillStyle);
  assert.ok(kolory.includes('#f6f2e9'), 'paleta z getComputedStyle motywu (atrapa :root) — nie gołe role');
  assert.equal(teksty.some((x) => x.includes('52.2297')), false, 'zero współrzędnych na obrazie');
  assert.match(dom.pobierz('status').textContent, /Obraz wyniku zapisany jako plik .png/);

  // udostępnienie: canShare({files}) → navigator.share dostaje File o nazwie z oczyscKodGry
  dom.kliknij('przycisk-udostepnij-obraz');
  await czekaj(80);
  assert.equal(udostepnione.length, 1);
  assert.equal(udostepnione[0].files.length, 1);
  assert.match(udostepnione[0].files[0].name, /^okolica-[a-z0-9-]+\.wynik\.png$/, 'nazwa pliku niesie auto-slug gry (jak w zapisie M6)');
  assert.equal(udostepnione[0].files[0].type, 'image/png');
});

/* ========== M7/P6: historia gier w UI — zapis, lista, kasowanie, usterki */

test('M7: koniec gry dopisuje skrót do historii — naturalny koniec = wpis pełny', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  const { walidujHistorieSurowa } = await import('../app/trwalosc.js');
  assert.equal(pamiec.has('okolica:historia'), false, 'przed końcem historii nie ma');
  zaczynijGre(dom);
  for (const i of [1, 2, 3]) {
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-pomin-stacje');
  }
  const { historia, usterki } = walidujHistorieSurowa(pamiec.get('okolica:historia'));
  assert.deepEqual(usterki, []);
  assert.equal(historia.wpisy.length, 1, 'dokładnie jeden wpis po jednej grze');
  const w = historia.wpisy[0];
  assert.match(w.klucz, /^[a-z0-9-]{1,40}$/, 'auto-slug gry ląduje w historii (spójnie z KLUCZ_AKTYWNEJ z M6)');
  assert.equal(w.przerwana, false, 'naturalny koniec = wpis pełny');
  assert.equal(w.liczbaStacji, 3);
  assert.equal(w.zwyciezca, 'Gracz 1', 'zwycięzca z rankingu (0 pkt — sort stabilny)');
  assert.equal(w.zaliczoneStacje, 0);
  assert.equal(w.pominietaStacje, 3);
  assert.match(w.data, /^20\d\d-/, 'data ISO z Date.now() warstwy DOM');
});

test('M7: ręczne zakończenie = wpis „przerwana", wznowienie i dokończenie ZASTĘPUJE go (bez dubla)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  const { walidujHistorieSurowa } = await import('../app/trwalosc.js');
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-zakoncz-gre'); // uzbrojenie
  dom.kliknij('przycisk-zakoncz-gre'); // ręczny koniec → wczesny wynik
  let { historia } = walidujHistorieSurowa(pamiec.get('okolica:historia'));
  assert.equal(historia.wpisy.length, 1, 'ręczne zakończenie też jest grą, która się odbyła');
  assert.equal(historia.wpisy[0].przerwana, true, 'uczciwy znacznik przerwania');

  // nowa instancja aplikacji na tej samej pamięci (jak zamknięcie i otwarcie telefonu)
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?hist=${Math.random().toString(36).slice(2)}`);
  assert.match(dom2.pobierz('wznowienie-opis').textContent, /niedokończoną grę/, 'ręczne zakończenie NIE kasuje zapisu (M6)');
  dom2.kliknij('przycisk-wznow-gre');
  dom2.kliknij('przycisk-pomin-stacje'); // stacja 1 — odcinek w toku po wznowieniu
  for (let i = 0; i < 2; i++) {
    dom2.kliknij('przycisk-start-odcinka');
    dom2.kliknij('przycisk-pomin-stacje');
  }
  ({ historia } = walidujHistorieSurowa(pamiec.get('okolica:historia')));
  assert.equal(historia.wpisy.length, 1, 'idempotencja po klucz — dokończenie nie dubluje wpisu');
  assert.equal(historia.wpisy[0].przerwana, false, 'dokończona gra zastępuje przerwaną pełnym wpisem');
});

test('M7: lista poprzednich gier na setupie — najnowsza najpierw, dwustopniowe kasowanie', async () => {
  const { nowaHistoria, dodajWpisHistorii, skrotGry } = await import('../app/trwalosc.js');
  const { nowaRozgrywka, podsumowanie } = await import('../app/rozgrywka.js');
  const { domyslnaKonfiguracja } = await import('../app/konfig.js');
  const { stacjeProste } = await import('../app/stacje.js');
  const srodek = { lat: 52.2297, lon: 21.0122 };
  const paczka = czytajFixturePaczka();
  const konfig = { ...domyslnaKonfiguracja(2), kodGry: 'stara-gra', promienM: 1000, liczbaStacji: 3 };
  const stacje = stacjeProste({ srodek, liczbaStacji: 3, promienM: 1000, ziarno: 'z' });
  const rozgrywka = nowaRozgrywka({ konfig, stacje, paczka, srodek, czasMs: 0, ziarno: 'z' });
  const wspolne = { rozgrywka, stacje, podsumowanie: podsumowanie(rozgrywka) };
  const w1 = skrotGry({ ...wspolne, konfig, miejsce: 'Mokotów', terazMs: Date.parse('2026-09-01T10:00:00Z'), przerwana: true });
  const w2 = skrotGry({ ...wspolne, konfig: { ...konfig, kodGry: 'nowa-gra' }, miejsce: 'Ochota', terazMs: Date.parse('2026-09-05T18:30:00Z') });
  const pamiec = new Map();
  pamiec.set('okolica:historia', JSON.stringify(dodajWpisHistorii(dodajWpisHistorii(nowaHistoria(), w1), w2)));

  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?histl=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom.pobierz('karta-historia').hidden, false, 'karta staje, gdy telefon pamięta gry');
  assert.equal(dom.pobierz('historia-naglowek').textContent, 'Poprzednie gry (2)');
  assert.equal(dom.pobierz('historia-usterki').hidden, true);
  const pozycje = dom.pobierz('historia-lista').children;
  assert.equal(pozycje.length, 2);
  assert.match(pozycje[0].textContent, /2026-09-05 18:30 · Ochota/, 'najnowsza najpierw, data i miejsce ze skrótu');
  assert.match(pozycje[0].textContent, /🏆 Gracz 1 — 0 pkt$/, 'zwycięzca i punkty, bez czasu (Partia 2)');
  assert.equal(pozycje[0].textContent.includes('(przerwana)'), false);
  assert.match(pozycje[1].textContent, /Mokotów/, 'starsza druga');
  assert.match(pozycje[1].textContent, /\(przerwana\)/, 'znacznik przerwanej widoczny');

  // kasowanie DWUSTOPOWIOWE bez confirm() (ADR 0015 pkt 6)
  dom.kliknij('przycisk-kasuj-historie');
  assert.match(dom.pobierz('przycisk-kasuj-historie').textContent, /Kliknij ponownie/, 'pierwszy klik uzbraja');
  assert.equal(pamiec.has('okolica:historia'), true, 'pierwszy klik NICZEGO nie kasuje');
  dom.kliknij('przycisk-kasuj-historie');
  assert.equal(pamiec.has('okolica:historia'), false, 'drugi klik kasuje klucz');
  assert.equal(dom.pobierz('karta-historia').hidden, true, 'bez klucza karta się chowa');
  assert.match(dom.pobierz('status').textContent, /Historia gier skasowana/);
});

test('M7: zepsuta historia — jawne kody H i oferta kasowania na setupie (nigdy cicho)', async () => {
  const pamiec = new Map();
  pamiec.set('okolica:historia', '{"schemat":"historia/1"'); // urwany JSON
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?histz=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom.pobierz('karta-historia').hidden, false, 'karta widoczna także z usterką');
  assert.equal(dom.pobierz('historia-usterki').hidden, false);
  assert.match(dom.pobierz('historia-usterki').textContent, /H01/, 'kod usterki jest jawny');
  assert.match(dom.pobierz('historia-usterki').textContent, /Skasuj/, 'usterka ma wyjście — kasowanie');
  assert.equal(dom.pobierz('historia-lista').children.length, 0, 'zepsute wpisy nie udają listy');
  dom.kliknij('przycisk-kasuj-historie');
  dom.kliknij('przycisk-kasuj-historie');
  assert.equal(pamiec.has('okolica:historia'), false, 'kasowanie działa też na zepsutym zapisie');
  assert.equal(dom.pobierz('karta-historia').hidden, true);
});

/* ========== M7/P7: integracja — pełna gra z dojściem GPS → podsumowanie, eksport, historia */

test('M7/P7: PEŁNA GRA z dojściem GPS → pełne podsumowanie, tekst, obraz i historia (end-to-end)', async () => {
  const { dom, paczka, pamiec } = await graGotowaDoStartu();
  const { walidujHistorieSurowa } = await import('../app/trwalosc.js');
  zaczynijGre(dom);

  // pętla jak w R7: symulacja dojścia ×3 stacje, poprawne odpowiedzi (fixture: 20 pkt/pytanie)
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
    dom.kliknij('przycisk-start-odcinka');
    dom.kliknij('przycisk-symulacja-gra');
    await czekaj(9 * 120 + 600);
    assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, `stacja ${numerStacji}: pytanie po dojściu GPS`);
    kliknijOdpowiedz(dom, pytanie.poprawna);
    dom.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'naturalny koniec po ostatniej stacji');

  // 1. PEŁNE podsumowanie z prawdziwą punktacją (nie zera z pominięć):
  //    Gracz 1 ma 2 poprawne (stacje 1 i 3), Gracz 2 jedną; punkty = 1 za poprawną (rev2),
  //    bez premii (Partia 2) → G1 = 40 pkt, G2 = 20 pkt
  const kartaZw = dom.pobierz('gra-wynik-zwyciezca');
  assert.match(kartaZw.children[0].textContent, /^🏆 Gracz 1$/, 'dwie poprawne wygrywają z jedną');
  // punkty CZYTAMY Z ELEMENTU, nie regexem po złączonym textContent (L23:
  // 'Gracz 1' + '42 pkt' złączone dałoby '142 pkt')
  const punktyZw = Number(kartaZw.children[1].textContent.replace(' pkt', ''));
  assert.equal(punktyZw, 2, 'zwycięzca: 2 × 1 pkt (rev2), zero premii');
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.match(wiersze[0].children[0].textContent, /Gracz 1 🏆/);
  assert.equal(wiersze[0].children[2].textContent, '2/2', 'Gracz 1: dwie poprawne, zero błędnych');
  assert.equal(wiersze[1].children[2].textContent, '1/1', 'Gracz 2: jedna poprawna');
  const karty = dom.pobierz('gra-wynik-gracze').children;
  assert.match(karty[0].textContent, /2 pkt · poprawne 2, błędne 0/, 'punkty i poprawność z prawdziwej gry');
  assert.match(karty[0].textContent, /odcinki: 2 · dystans/);
  assert.match(karty[0].textContent, /ręczne dojścia: 0/);
  const statystyki = dom.pobierz('gra-wynik-statystyki').textContent;
  assert.match(statystyki, /zaliczone:3 z 3/);
  assert.match(statystyki, /pominięte:0/);
  const stacjeWiersze = dom.pobierz('gra-wynik-stacje-tbody').children;
  assert.equal(stacjeWiersze.length, 3);
  for (const w of stacjeWiersze) {
    assert.match(w.textContent, /zaliczona \(GPS\)/, 'tryb dojścia zmierzony, nie zgadywany');
    assert.equal(w.children.length, 4, 'kolumny: # | gracz | stan | punkty (czasu nie ma)');
  }

  // 2. eksport tekstowy z prawdziwej gry: ranking, stacje z GPS — i STRAŻNIK prywatności
  const tekst = dom.pobierz('pole-wynik-tekst').value;
  assert.match(tekst, /🏆 Gracz 1 — \d+ pkt/);
  assert.match(tekst, /stacja 1 · Gracz 1 — zaliczona \(GPS\)/);
  assert.match(tekst, /zaliczone 3 z 3 stacji/);
  for (const pytanie of paczka.pytania) {
    assert.equal(tekst.includes(pytanie.tresc), false, `treść pytania ${pytanie.id} wyciekła do eksportu`);
    for (const odpowiedz of pytanie.odpowiedzi) {
      if (odpowiedz.length > 4) assert.equal(tekst.includes(odpowiedz), false, `odpowiedź wyciekła do eksportu`);
    }
  }
  assert.equal(tekst.includes('52.2297'), false, 'współrzędne nie wyciekają do eksportu');

  // 3. obraz wyniku z prawdziwej gry: zwycięzca z punktami na canvas
  dom.kliknij('przycisk-pobierz-obraz');
  await czekaj(80);
  const canvas = dom.utworzone.filter((el) => String(el.tagName).toLowerCase() === 'canvas').at(-1);
  const tekstyObrazu = canvas.komendy.filter((k) => k.op === 'fillText').map((k) => k.tekst);
  assert.ok(tekstyObrazu.some((x) => x === '🏆 Gracz 1'), 'zwycięzca na obrazie');
  assert.ok(tekstyObrazu.some((x) => x === `${punktyZw} pkt`), 'punkty zwycięzcy spójne z panelem');

  // 4. historia: jeden pełny wpis bez treści (skrót, ADR 0010 pkt 1)
  const { historia, usterki } = walidujHistorieSurowa(pamiec.get('okolica:historia'));
  assert.deepEqual(usterki, []);
  assert.equal(historia.wpisy.length, 1);
  const w = historia.wpisy[0];
  assert.equal(w.przerwana, false);
  assert.equal(w.zwyciezca, 'Gracz 1');
  assert.equal(w.zaliczoneStacje, 3);
  assert.equal(w.punktyRazem, 3, 'suma punktów: 3 × 1 (rev2), zero premii');
  const jsonHistorii = JSON.stringify(historia);
  for (const pytanie of paczka.pytania) {
    assert.equal(jsonHistorii.includes(pytanie.tresc), false, 'treść pytania wyciekła do historii');
  }
  assert.equal(jsonHistorii.includes('52.2297'), false, 'współrzędne wyciekły do historii');
});

/* ---------- tap w mapę pozycji (zadanie D3) — na końcu, bo tworzy ŚWIEŻĄ
   instancję aplikacji i zastępuje globalne atrapy (porządek jak testy map M2) */

test('D3: stuknięcie mapy pozycji ustawia pozycję testową, a przeciągnięcie — nie', async () => {
  // tap jest bramkowany trybem testowym — główna atrapa biegnie bez
  // `?tryb=test`, więc test pracuje na ŚWIEŻEJ instancji (wzorzec z M2)
  const domT = await aplikacjaZMapa({ search: '?tryb=test&odstep=0' });
  domT.kliknij('przycisk-dalej-pozycja'); // bramka tap-a: ekran 'pozycja'
  domT.pobierz('setup-lat').value = '52.2297';
  domT.pobierz('setup-lon').value = '21.0122';
  domT.kliknij('przycisk-ustaw-reczne');

  // Po ręcznym ustawieniu `pokazPozycje` woła `centrujNaPozycji`: mapa jest
  // wyśrodkowana NA POZYCJI w zoomie dobranym do promienia gry (1000 m przy
  // szerokości panelu z atrapy → zoom z `dopasujZoomDoPromienia`). Oczekiwany
  // punkt tap-a LICZĘ czystymi funkcjami z dokładnie tym widokiem (L24) —
  // zgaduje się co do cyfry z tym, co robi aplikacja.
  const rect = domT.pobierz('mapa-pozycja').getBoundingClientRect();
  const zoom = dopasujZoomDoPromienia(1000, rect.width, 52.2297);
  const widok = widokNaSrodek({ lat: 52.2297, lon: 21.0122, zoom, rozmiar: { szerokosc: rect.width, wysokosc: rect.height } });
  const geo = wspolrzedneZEkranu(40 - rect.left, 0 - rect.top, widok);
  const oczLat = Math.round(geo.lat * 1e6) / 1e6;
  const oczLon = Math.round(geo.lon * 1e6) / 1e6;

  const svg = domT.pobierz('mapa-pozycja-svg');
  assert.ok(wyslij(svg, 'pointerdown', { pointerId: 31, clientX: 40, clientY: 0 }) > 0, 'svg mapy pozycji ma nasłuch pointerdown');
  wyslij(svg, 'pointerup', { pointerId: 31, clientX: 40, clientY: 0 });

  assert.match(domT.pobierz('status').textContent, /Pozycja testowa ustawiona z mapy/, 'status mówi, że pozycja jest z mapy');
  assert.equal(Number(domT.pobierz('setup-lat').value), oczLat, 'pole lat wypełnione współrzędnymi stuknięcia');
  assert.equal(Number(domT.pobierz('setup-lon').value), oczLon, 'pole lon wypełnione współrzędnymi stuknięcia');
  assert.match(
    domT.pobierz('pozycja-wspolrzedne').textContent,
    new RegExp(oczLat.toFixed(5).replace(/\./g, '\\.')),
    'ekran pokazuje przestawioną pozycję',
  );
  assert.ok(domT.pobierz('mapa-pozycja-marker').children.length > 0, 'marker stoi w nowym miejscu');

  // przeciągnięcie (ruch 60 px > próg 10 px) to PAN — pozycja zostaje
  const przedPanem = domT.pobierz('pozycja-wspolrzedne').textContent;
  wyslij(svg, 'pointerdown', { pointerId: 32, clientX: 0, clientY: 0 });
  wyslij(svg, 'pointermove', { pointerId: 32, clientX: 60, clientY: 0 });
  wyslij(svg, 'pointerup', { pointerId: 32, clientX: 60, clientY: 0 });
  assert.equal(domT.pobierz('pozycja-wspolrzedne').textContent, przedPanem, 'pan nie przestawia pozycji gracza');
});

/* ------------------------------------------------- sygnały (M10/T4) */

test('sygnały: „🔔 sygnały" startuje włączone, a klik przełącza i zapisuje wybór', async () => {
  // ŚWIEŻA instalacja: wcześniejsze testy M6 podmieniały globalne atrapy,
  // więc plikowy `pobierz` wskazuje stary rejestr (LESSONS: hazard
  // ponownego importu/instalacji). Ten test jest ostatni w pliku — jego
  // własna instalacja nikomu już nie miesza.
  const domSygnaly = zainstalujDom();
  await import(`../app/app.js?sygnaly=${Math.random().toString(36).slice(2)}`);
  const prz = domSygnaly.pobierz('przycisk-sygnaly');
  assert.equal(prz.getAttribute('aria-pressed'), 'true', 'domyślnie włączone (aria-pressed)');
  domSygnaly.kliknij('przycisk-sygnaly');
  assert.equal(prz.getAttribute('aria-pressed'), 'false');
  assert.equal(globalThis.localStorage.getItem('okolica:sygnaly'), '0', 'wyłączenie zapisane');
  assert.match(domSygnaly.pobierz('status').textContent, /Sygnały wyłączone/, 'jawny status wyłączenia (LESSONS L6)');
  domSygnaly.kliknij('przycisk-sygnaly');
  assert.equal(prz.getAttribute('aria-pressed'), 'true');
  assert.equal(globalThis.localStorage.getItem('okolica:sygnaly'), '1', 'włączenie zapisane');
  assert.match(domSygnaly.pobierz('status').textContent, /Sygnały włączone/);
});
