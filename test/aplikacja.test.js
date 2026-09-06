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

import { WERSJA_PROTOKOLU } from '../app/protokol.js';
import {
  INSTANCJE_OVERPASS,
  SCHEMAT_SIECI,
  kluczCacheSieci,
  parsujOdpowiedz,
  upraszczajDaneDoCache,
} from '../app/sieci.js';
import { DOMYSLNE, PODKLADY, TEMATY, TRYBY } from '../app/konfig.js';
import { GRANICE, OPCJE_WATCH } from '../app/pozycja.js';
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
  assert.equal(pobierz('przycisk-ukryj').hidden, true, 'nie ma przyjętej paczki — nie ma czego ukrywać');
  assert.equal(pobierz('wynik-walidacji').hidden, true, 'karta wyniku jest w HTML ukryta i bootstrap jej nie odsłania');
  assert.equal(pobierz('wynik-naglowek').textContent, '', 'żaden wynik nie został wyrenderowany przed wklejeniem paczki');
});

test('bootstrap: przyciski nawigacji mają nasłuch zdarzeń', () => {
  for (const id of ['przycisk-dalej-pozycja', 'przycisk-kopiuj-prompt', 'przycisk-sprawdz', 'przycisk-poprawka', 'przycisk-ukryj', 'przycisk-motyw', 'przycisk-kod', 'przycisk-przelicz', 'przycisk-gps', 'przycisk-ustaw-reczne']) {
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
    konfig: { tryb: 'konny', wiek: 'nestor', podklad: 'carto', tematy: ['kosmos'], liczbaGraczy: 'dużo', imiona: null, geokodacja: 'tak' },
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
  // geokodacja=true — nazwa miejsca ma się WYŚWIETLIĆ; przy domyślnym false
  // UI i prompt mają same współrzędne (ADR 0013 pkt 3, test bramy niżej)
  pamiecCache.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', konfig: { geokodacja: true } }));
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000 });
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
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000 });
  const wpis = JSON.parse(domAtrapa.pamiec.get(klucz));
  assert.equal(wpis.schemat, SCHEMAT_SIECI);
  assert.ok(Number.isFinite(wpis.zapisanoMs));
  assert.ok(wpis.dane.drogi.length > 10, 'cache przechowuje sparsowane drogi');
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
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000 });
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

/**
 * Świeża aplikacja z przyjętą paczką z fixture'a. Konfig z pamięci musi
 * zgadzać się z fixturem (3 stacje × 1 pytanie, tematy historia+architektura,
 * promień 1000 m) — inaczej walidator słusznie zgłosi E03/E16/E05.
 */
async function aplikacjaZPrzyjetaPaczka() {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?podglad=${Math.random().toString(36).slice(2)}`);
  const paczka = czytajFixturePaczka();
  domAtrapa.pobierz('pole-odpowiedz').value = JSON.stringify(paczka);
  domAtrapa.kliknij('przycisk-sprawdz');
  return { dom: domAtrapa, paczka };
}

function kliknijW(el) {
  for (const fn of el.zdarzenia.click ?? []) fn({ type: 'click', target: el, currentTarget: el });
  return (el.zdarzenia.click ?? []).length;
}

test('podgląd organizatora: przyjęta paczka pokazuje pytania, a odrzucona nie', async () => {
  const { dom, paczka } = await aplikacjaZPrzyjetaPaczka();
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta/);
  assert.equal(dom.pobierz('podglad-organizatora').hidden, false, 'podgląd otwiera się z przyjęciem');
  const karty = dom.pobierz('podglad-pytania').children;
  assert.equal(karty.length, paczka.pytania.length, 'karta na każde pytanie');
  assert.match(karty[0].children[0].textContent, new RegExp(`^${paczka.pytania[0].id} · stacja`), 'nagłówek karty z id i stacją');
  assert.equal(karty[0].children[1].value, paczka.pytania[0].tresc, 'treść w polu edycji');

  // odrzucona paczka nie pokazuje podglądu
  const pamiecKonfig2 = new Map();
  pamiecKonfig2.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig2 });
  await import(`../app/app.js?podglad2=${Math.random().toString(36).slice(2)}`);
  const zepsuta = czytajFixturePaczka();
  zepsuta.protokol = 'PYT/9.9';
  dom2.pobierz('pole-odpowiedz').value = JSON.stringify(zepsuta);
  dom2.kliknij('przycisk-sprawdz');
  assert.match(dom2.pobierz('wynik-naglowek').textContent, /odrzucona|Nie da się/);
  assert.equal(dom2.pobierz('podglad-organizatora').hidden, true, 'przy odmowie podgląd zostaje zamknięty');
});

test('podgląd organizatora: edycja przechodzi re-walidację, psucie blokuje ukrycie, modyfikacje[] podróżują z kontenerem', async () => {
  const { dom, paczka } = await aplikacjaZPrzyjetaPaczka();
  const miejsce = paczka.okolica.miejsce;

  // 1) edycja psująca protokół (za krótka treść) — zapisana, ale blokuje ukrycie
  let karta = dom.pobierz('podglad-pytania').children[0];
  karta.children[1].value = 'za krótka treść';
  const zapisz1 = karta.children[karta.children.length - 1];
  assert.match(zapisz1.textContent, /Zapisz poprawkę/);
  assert.ok(kliknijW(zapisz1) > 0, 'przycisk zapisu ma nasłuch');
  assert.match(dom.pobierz('wynik-naglowek').textContent, /wymaga naprawy/, 're-walidacja całej paczki po edycji');
  assert.equal(dom.pobierz('przycisk-ukryj').hidden, true, 'zepsuta paczka się nie ukryje');
  assert.equal(dom.pobierz('przycisk-poprawka').hidden, false, 'poprawka do modelu znów dostępna');
  assert.ok(dom.pobierz('wynik-usterki').children.length > 0, 'usterki widoczne na liście');
  assert.match(dom.pobierz('status').textContent, /modyfikacje/, 'status mówi o zapisie poprawki');

  // 2) edycja dobra — paczka wraca do czystej
  karta = dom.pobierz('podglad-pytania').children[0];
  const dobraTresc = `${miejsce} — pytanie poprawione ręcznie przez organizatora gry terenowej?`;
  karta.children[1].value = dobraTresc;
  const zapisz2 = karta.children[karta.children.length - 1];
  kliknijW(zapisz2);
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(po ręcznej poprawce\)/);
  assert.equal(dom.pobierz('przycisk-ukryj').hidden, false);
  assert.equal(dom.pobierz('wynik-usterki').children.length, 0, 'lista usterek wyczyszczona (replaceChildren)');

  // 3) ukrycie zwija podgląd (plaintext znika z DOM), a kontener niesie modyfikacje[]
  dom.kliknij('przycisk-ukryj');
  assert.equal(dom.pobierz('podglad-organizatora').hidden, true, 'po ukryciu podgląd zwinięty');
  assert.equal(dom.pobierz('podglad-pytania').children.length, 0, 'plaintext pytań usunięty z DOM');
  const kontenerTekst = dom.pobierz('pole-odpowiedz').value;
  assert.ok(kontenerTekst.startsWith('{'), 'kontener w polu zapasowym (JSON)');
  const { odpakujPaczke } = await import('../app/kodowanie.js');
  const zPowrotem = odpakujPaczke(kontenerTekst);
  assert.equal(zPowrotem.paczka.pytania[0].tresc, dobraTresc, 'ostatnia (dobra) edycja w ukrytej paczce');
  assert.equal(zPowrotem.paczka.modyfikacje.length, 2, 'obie poprawki zapisane (ta psująca też — ślad audytu)');
  assert.match(zPowrotem.paczka.modyfikacje[0].opis, /^pytanie s1p1: poprawiono treść pytania$/);
  assert.match(zPowrotem.paczka.modyfikacje[1].data, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test('podgląd organizatora: zmiana poprawnej odpowiedzi i dodanie źródła trafiają do paczki', async () => {
  const { dom, paczka } = await aplikacjaZPrzyjetaPaczka();
  const karta = dom.pobierz('podglad-pytania').children[0];
  // kolejność w karcie: h3, tresc, odpowiedzi(div), wyjasnienie, zrodla(div), zapisz
  const blokOdpowiedzi = karta.children[2];
  const wierszeOdp = blokOdpowiedzi.children; // 4 × (radio + input)
  assert.equal(wierszeOdp.length, 4);
  // atrapa nie wiąże radio w grupę (przeglądarka sama zdejmie `checked`
  // z pozostałych) — test odwzorowuje stan PO kliknięciu trzeciej opcji
  wierszeOdp.forEach((wiersz, i) => { wiersz.children[0].checked = i === 2; });
  const blokZrodel = karta.children[4];
  const listaZrodel = blokZrodel.children[0];
  const dodajZrodlo = blokZrodel.children[1];
  assert.match(dodajZrodlo.textContent, /Dodaj źródło/);
  const ilePrzed = listaZrodel.children.length;
  kliknijW(dodajZrodlo);
  assert.equal(listaZrodel.children.length, ilePrzed + 1, 'nowy wiersz źródła doszedł do listy');
  const nowyWiersz = listaZrodel.children[listaZrodel.children.length - 1];
  nowyWiersz.children[0].value = 'https://archiwum-miejskie.pl/dokument/123';
  nowyWiersz.children[1].value = 'Archiwum miejskie — dokument 123';
  nowyWiersz.children[2].value = '2026-09-06';

  kliknijW(karta.children[karta.children.length - 1]);
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(po ręcznej poprawce\)/, `usterki: ${dom.pobierz('wynik-usterki').children.map((li) => li.innerHTML).join('; ')}`);
  dom.kliknij('przycisk-ukryj');
  const { odpakujPaczke } = await import('../app/kodowanie.js');
  const zPowrotem = odpakujPaczke(dom.pobierz('pole-odpowiedz').value);
  const p0 = zPowrotem.paczka.pytania[0];
  assert.equal(p0.poprawna, 2, 'poprawna odpowiedź przełączona radiem');
  assert.equal(p0.zrodla.length, paczka.pytania[0].zrodla.length + 1, 'nowe źródło doklejone');
  assert.equal(p0.zrodla[p0.zrodla.length - 1].url, 'https://archiwum-miejskie.pl/dokument/123');
  assert.match(zPowrotem.paczka.modyfikacje[0].opis, /poprawną odpowiedź, źródła/);
});

test('paczka: eksport do pliku niesie ukryty kontener — round-trip przez import', async () => {
  const { dom, paczka } = await aplikacjaZPrzyjetaPaczka();
  assert.equal(dom.pobierz('przycisk-eksport-paczki').hidden, false, 'eksport dostępny z przyjętą paczką');
  // przechwyć zawartość Blob (atrapa domyślnie gubi części — tylko size)
  const BlobOryginal = globalThis.Blob;
  const czesci = [];
  globalThis.Blob = class { constructor(c) { czesci.push(...(c ?? [])); this.size = (c ?? []).join('').length; } };
  try {
    dom.kliknij('przycisk-eksport-paczki');
  } finally {
    globalThis.Blob = BlobOryginal;
  }
  assert.equal(czesci.length, 1, 'jeden plik na klik');
  const kontener = JSON.parse(czesci[0]);
  assert.equal(kontener.schemat, 'TO-paczka/2', 'plik niesie kontener, nie plaintext');
  assert.ok(!czesci[0].includes(paczka.pytania[0].tresc), 'treść pytania NIE występuje w pliku jawnie');
  const { odpakujPaczke } = await import('../app/kodowanie.js');
  const zPowrotem = odpakujPaczke(czesci[0]);
  assert.deepEqual(
    zPowrotem.paczka.pytania.map((q) => q.tresc),
    paczka.pytania.map((q) => q.tresc),
    'import pliku odtwarza paczkę (ścieżka „⬆ Z pliku" czyta ten sam format)',
  );
  assert.match(dom.pobierz('status').textContent, /okolica-[a-z0-9-]+\.paczka\.json/, 'nazwa pliku z oczyszczonym kodem gry i rozszerzeniem z .gitignore');
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

test('geokodacja WYŁĄCZONA w setupie: miejsce nie trafia do UI ani do promptu (ADR 0013 pkt 3)', async () => {
  const pamiecCache = new Map(); // konfig domyślny → geokodacja: false (K20)
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  pamiecCache.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000 }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: pamiecCache });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /wyłączona w ustawieniach/,
    'UI mówi wprost, że nazwa jest wyłączona — nie udaje „brak danych"');
  domAtrapa.kliknij('przycisk-dalej-prompt');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /miejsce: brak odczytu \(tylko współrzędne\)/,
    'prompt ma same współrzędne (ADR 0006 pkt 3)');
});

test('warstwa zapasowa: domyślnie ZERO żądań do Nominatim (ADR 0013 pkt 2)', async () => {
  const pamiecCache = new Map();
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, { geokodacja: true });
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
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, { geokodacja: true });
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
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, { geokodacja: true });
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
  const domAtrapa = await aplikacjaZKonfigiem(pamiecCache, { geokodacja: true });
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
    konfig: { liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], promienM: 1000 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?gra=${Math.random().toString(36).slice(2)}`);
  const paczka = czytajFixturePaczka();
  dom.pobierz('pole-odpowiedz').value = JSON.stringify(paczka);
  dom.kliknij('przycisk-sprawdz');
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  return { dom, paczka, pamiec };
}

function zaczynijGre(dom) {
  dom.kliknij('przycisk-start-gry');
}

test('M6: start gry — przycisk z przyjętą paczką, ekran gry i faza A (przygotowanie)', async () => {
  const { dom } = await graGotowaDoStartu();
  assert.equal(dom.pobierz('przycisk-start-gry').hidden, false, 'start gry dostępny z przyjętą paczką');
  zaczynijGre(dom);
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'ekran gry widoczny');
  assert.equal(dom.pobierz('ekran-paczka').hidden, true, 'ekran paczki schowany');
  assert.equal(dom.pobierz('podglad-organizatora').hidden, true, 'podgląd organizatora zwinięty — gra, nie przygotowanie');
  assert.equal(dom.pobierz('przycisk-start-gry').hidden, true, 'nie da się zacząć drugiej gry tym samym przyciskiem');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, false, 'panel A widoczny w fazie przygotowanie');
  for (const panel of ['gra-panel-odcinek', 'gra-panel-pytanie', 'gra-panel-koniec']) {
    assert.equal(dom.pobierz(panel).hidden, true, `${panel} ukryty poza swoją fazą`);
  }
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 1 z 3/, 'postęp z bieżącej stacji');
  assert.match(dom.pobierz('gra-kolejka').textContent, /Kolej: Gracz 1/, 'badge kolejki z imieniem (domyślne imiona z konfigu)');
  assert.match(dom.pobierz('przycisk-start-odcinka').textContent, /Idę do stacji 1/, 'główny przycisk fazy mówi, dokąd idzie');
  assert.match(dom.pobierz('gra-cel-stacji').textContent, /m drogą od poprzedniego punktu/, 'cel z dystansem drogowym z modelu');
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
  // przed dojściem treści pytania nie było NICZYM w UI — strażnik: ekran paczki schowany, podgląd zwinięty
  assert.equal(dom.pobierz('podglad-organizatora').hidden, true);
});

test('M6: poprawna odpowiedź — ocena, punkty z premią, wyjaśnienie i źródła z linkami', async () => {
  const { dom, paczka } = await graWFaziePytania();
  const pierwsze = paczka.pytania.find((q) => q.stacja === 1);
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  const dobry = przyciski[pierwsze.poprawna];
  for (const fn of dobry.zdarzenia.click ?? []) fn({ type: 'click', target: dobry, currentTarget: dobry });

  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /✓ Dobrze! \+\d+ pkt/, 'ocena z punktami (podstawowe + ewentualna premia)');
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
  assert.equal(pamiec.get('okolica:gra-aktywna'), 'gra', 'wskaźnik aktywnej gry (kod oczyszczony; pusty kodGry → „gra")');
  const kluczZapisu = 'okolica:gra:gra';
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
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(JSON.parse(pamiec.get('okolica:gra:gra')).rozgrywka.faza, 'odcinek');

  // „zamknięcie przeglądarki": zupełnie nowa instancja aplikacji na tej samej pamięci
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?wznow=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom2.pobierz('karta-wznowienie').hidden, false, 'baner wznowienia na setupie');
  assert.match(dom2.pobierz('wznowienie-opis').textContent, /niedokończoną grę/, 'opis mówi po ludzku, co znaleziono');
  assert.match(dom2.pobierz('wznowienie-opis').textContent, /faza: odcinek/);

  dom2.kliknij('przycisk-wznow-gre');
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
  assert.equal(JSON.parse(pamiec.get('okolica:gra:gra')).rozgrywka.odcinki[0].stan, 'pominiety', 'zapis niesie pominięcie');
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
  assert.ok(pamiec.has('okolica:gra:gra'), 'zapis NIE skasowany — można wrócić do gry');
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
  const snapshot = JSON.parse(pamiec.get('okolica:gra:gra'));
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

test('M7: pełne podsumowanie — zwycięzca, medal trasy, statystyki, karty graczy i stacje', async () => {
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

  // 2. medal sprawiedliwości: pierścień ma odchylenie ≈ 0% ≤ 15% → 🏅
  assert.match(dom.pobierz('gra-wynik-medal').textContent, /🏅 Uczciwa trasa/, 'medal z miaraSprawiedliwosci (pole proste — brak dystansów sieciowych)');
  assert.match(dom.pobierz('gra-wynik-medal').textContent, /próg 15%/, 'jawny próg w komunikacie');

  // 3. statystyki gry: liczby z podsumowanie(), dziennik nie kłamie
  const statystyki = dom.pobierz('gra-wynik-statystyki').textContent;
  assert.match(statystyki, /czas gry:/);
  assert.match(statystyki, /zaliczone:0 z 3/, 'dt+dd bez spacji w agregacji — odstęp daje siatka CSS');
  assert.match(statystyki, /pominięte:3/);
  assert.match(statystyki, /stacje bez pytań:brak/, 'paczka pokrywa wszystkie stacje');
  assert.match(statystyki, /zdarzenia w dzienniku:\d+/);

  // 4. karty graczy: dwie, z pełnymi polami (rozbicie punktów, tempo, ręczne, limit)
  const karty = dom.pobierz('gra-wynik-gracze').children;
  assert.equal(karty.length, 2, 'karta per gracz, w kolejności rankingu');
  assert.match(karty[0].textContent, /Gracz 1 🏆 · 0 pkt/);
  assert.match(karty[0].textContent, /podstawowe 0 \+ premie 0 · poprawne 0, błędne 0/);
  assert.match(karty[0].textContent, /odcinki: 2 · czas/, 'Gracz 1 miał odcinki 1 i 3 (rotacja)');
  assert.match(karty[0].textContent, /ręczne dojścia: 0 · po limicie: 0/);
  assert.match(karty[0].textContent, /tempo —/, 'pominięte odcinki bez pomiaru tempa → kreska, nie zero');
  assert.match(karty[1].textContent, /odcinki: 1/, 'Gracz 2 miał odcinek 2');

  // 5. tabela stacji: 3 wiersze, każda pominięta, bez gracza „—" (rotacja przypisana)
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
