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

import { WERSJA_PROTOKOLU } from '../app/protokol.js';
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
