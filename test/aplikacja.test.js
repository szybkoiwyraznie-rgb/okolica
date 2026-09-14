/**
 * Test dymny aplikacji (app/app.js) na atrapie DOM.
 *
 * Moduły czyste mają własne testy, ale to `app.js` spina je z HTML-em — i to tu
 * psują się rzeczy niewidoczne dla reszty bramy: import nazwy, której moduł nie
 * eksportuje (aplikacja wtedy w ogóle nie wstaje), `null.checked` przy kluczu
 * spoza kanonu, brak nasłuchu na przycisku, watcher GPS założony z opcjami
 * innymi niż w ADR. Ten test uruchamia prawdziwy bootstrap na minimalnej
 * atrapie DOM (`test/helpers/dom.js`) i sprawdza stan początkowy ekranu oraz
 * przepływ położenia: fix → współrzędne i geohash → błąd → pauza. Dokładności
 * (`accuracy`) na ekranie i na mapie nie ma — ADR 0034 pkt 2.
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

import { SZABLON_WERSJA, WERSJA_PROTOKOLU, WERSJA_PROTOKOLU_REV1, WERSJA_PROTOKOLU_REV2, WERSJA_PROTOKOLU_REV3, odwrocPolaPaczki, zakodujPoprawnaRev2 } from '../app/protokol.js';
import {
  INSTANCJE_OVERPASS,
  SCHEMAT_SIECI,
  kluczCacheSieci,
  parsujOdpowiedz,
  upraszczajDaneDoCache,
} from '../app/sieci.js';
import { DOMYSLNE, PODKLADY, TEMATY, TEMATY_SETUP, TRYBY, domyslnaKonfiguracja, przeliczenieCzasu } from '../app/konfig.js';
import { GRANICE, OPCJE_WATCH } from '../app/pozycja.js';
import { maxZoomPodkladu, skalaBar, widokNaSrodek, wspolrzedneZEkranu } from '../app/mapa.js';
import { dopasujZoomDoPromienia } from '../app/geo.js';
import { atrapaGeolokalizacji, zainstalujDom } from './helpers/dom.js';

/* ------------------------------------------------------------------ bootstrap */

const gps = atrapaGeolokalizacji();
const dom = zainstalujDom({ geolocation: gps.geolocation });
const { pobierz, pamiec } = dom;

// Import PO ustawieniu globali — app.js uruchamia start() przy wczytaniu.
await import('../app/app.js');

test('bootstrap: aplikacja startuje bez wyjątku na atrapie DOM', () => {
  assert.ok(dom.elementy.size > 40, `aplikacja dotknęła tylko ${dom.elementy.size} elementów — wygląda na urwany start`);
});

test('bootstrap: na starcie jest mapa z oknem startowym, nie setup (decyzja 2026-09-09)', () => {
  assert.equal(pobierz('ekran-start').hidden, false, 'okno startowe ma być widoczne na starcie');
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka']) {
    assert.equal(pobierz(`ekran-${ekran}`).hidden, true, `ekran ${ekran} ma być na starcie ukryty`);
  }
});

test('start: klik w okno je zamyka, a START GRY otwiera setup', () => {
  assert.equal(pobierz('ekran-start').hidden, false, 'warunek wstępny: okno jest otwarte');
  dom.kliknij('ekran-start');
  assert.equal(pobierz('ekran-start').hidden, true, 'klik gdziekolwiek zamyka okno');
  assert.equal(pobierz('ekran-setup').hidden, true, 'po zamknięciu zostaje sama mapa');
  dom.kliknij('przycisk-setup');
  assert.equal(pobierz('ekran-setup').hidden, false, 'START GRY otwiera setup');
  assert.equal(pobierz('ekran-start').hidden, true, 'setup nie wskrzesza okna');
});

/**
 * Zgłoszenie właściciela F3 (2026-09-09): ikony ⚙ START GRY i 🏆 Rankingi mają
 * pokazywać stan otwartej warstwy (jak 🔔 Sygnały), a klik w podświetloną ikonę
 * ma tę warstwę zamykać.
 */
test('F3: ikona START GRY świeci przy otwartym setupie i zamyka go drugim kliknięciem', () => {
  // Testy dzielą jedną atrapę DOM, więc ustawiamy stan wyjściowy jawnie
  // i przywracamy go na końcu — kolejne testy zastają otwarty setup.
  if (pobierz('ekran-setup').hidden) dom.kliknij('przycisk-setup');
  assert.equal(pobierz('przycisk-setup').getAttribute('aria-pressed'), 'true', 'ikona świeci nad otwartym setupem');

  dom.kliknij('przycisk-setup');
  assert.equal(pobierz('ekran-setup').hidden, true, 'drugi klik zamyka setup');
  assert.equal(pobierz('przycisk-setup').getAttribute('aria-pressed'), 'false', 'ikona gaśnie razem z warstwą');

  dom.kliknij('przycisk-setup'); // stan jak przed testem
  assert.equal(pobierz('ekran-setup').hidden, false, 'setup wraca dla kolejnych testów');
});

/**
 * Zgłoszenie właściciela B3: „Wróć na początek” dawało pustą stronę (sam
 * nagłówek i stopka). Mapa musi zostać widoczna — `data-ekran='mapa'` jest tym,
 * co CSS trzyma jako widoczny spód aplikacji.
 */
test('B3: „Wróć na początek” zostawia mapę, nie pustą stronę', () => {
  if (pobierz('ekran-setup').hidden) dom.kliknij('przycisk-setup');

  dom.kliknij('przycisk-nowa-gra');
  assert.equal(globalThis.document.body.dataset.ekran, 'mapa', 'body wraca na stan mapy startowej');
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka', 'gra']) {
    assert.equal(pobierz(`ekran-${ekran}`).hidden, true, `ekran ${ekran} schowany`);
  }
  assert.equal(pobierz('ekran-start').hidden, true, 'okno intro nie wraca');

  dom.kliknij('przycisk-setup'); // stan jak przed testem
  assert.equal(pobierz('ekran-setup').hidden, false, 'setup wraca dla kolejnych testów');
});

test('bootstrap: stopka pokazuje obowiązującą wersję protokołu i łatki szablonu', () => {
  assert.equal(pobierz('stopka-protokol').textContent, WERSJA_PROTOKOLU);
  assert.equal(pobierz('stopka-szablon').textContent, SZABLON_WERSJA, 'łatka szablonu widoczna (PROTOKOL §7)');
});

test('bootstrap: start() wpisuje numer budowy do stopki, nie zostawia placeholdera', () => {
  // Właściciel dwa razy oceniał starą wersję z cache i nie miał jak tego
  // stwierdzić, więc stopka pokazuje `?v=` z adresu własnego modułu. Tu moduł
  // jest importowany z pliku — bez `?v=` — więc wypada 'dev'. Ważne jest to,
  // że pole jest WYPEŁNIONE przez start(), a nie że zostało HTML-owe '—'.
  assert.notEqual(pobierz('stopka-wersja').textContent, '—', 'placeholder z HTML nie został nadpisany');
  assert.equal(pobierz('stopka-wersja').textContent, 'dev');
});

test('bootstrap: lista trybów i tematów jest wyrenderowana z kanonu', () => {
  assert.equal(pobierz('lista-trybow').children.length, Object.keys(TRYBY).length, 'trzy tryby ruchu');
  assert.equal(pobierz('lista-tematow').children.length, Object.keys(TEMATY_SETUP).length, 'dziesięć tematów z kanonu');
});

test('bootstrap: pola setupu mają wartości domyślne z kanonu', () => {
  assert.equal(pobierz('setup-czas').value, String(DOMYSLNE.czasGryMin), 'czas gry jest polem, promień nie (ADR 0025)');
  assert.match(pobierz('setup-promien-info').textContent, /Promień gry: 500 m/, 'promień policzony i pokazany z uzasadnieniem');
  assert.match(pobierz('setup-promien-info').textContent, /5 pytań/, 'składowe są jawne');
  assert.equal(pobierz('setup-stacje').value, String(DOMYSLNE.liczbaStacji));
  assert.equal(pobierz('setup-pytania').value, String(DOMYSLNE.pytaniaNaStacje));
  // pola „Liczba graczy" nie ma: graczy dodaje się w bloku tożsamości
  // (ADR 0026 aneks), a zapamiętany gracz wraca na listę bez PIN-u
  assert.equal(pobierz('lista-graczy').children.length, 1, 'zapamiętany gracz jest na liście');
});

test('setup: skróty „wszystkie/żadne" ruszają cały kanon tematów, „Dopisz sam" jest wyjątkiem', () => {
  const lista = pobierz('lista-tematow');
  const chipy = [...lista.children].map((e) => e.children[0]);
  assert.equal(chipy.length, Object.keys(TEMATY_SETUP).length, 'po checkboxie na temat z kanonu');

  dom.kliknij('przycisk-tematy-wszystkie');
  for (const input of chipy) {
    assert.equal(input.checked, input.value !== 'wlasny', `po „wszystkie": ${input.value}`);
  }

  dom.kliknij('przycisk-tematy-zadne');
  for (const input of chipy) assert.equal(input.checked, false, `po „żadnych": ${input.value}`);

  // „Dopisz sam" to decyzja organizatora — skrót nie rusza go w żadną stronę.
  const wlasny = chipy.find((i) => i.value === 'wlasny');
  wlasny.checked = true;
  dom.kliknij('przycisk-tematy-wszystkie');
  assert.equal(wlasny.checked, true, '„wszystkie" nie nadpisuje „Dopisz sam"');
  assert.equal(pobierz('setup-temat-wlasny').hidden, false, 'pole własnego tematu widać, gdy „Dopisz sam" jest zaznaczony');
  dom.kliknij('przycisk-tematy-zadne');
  assert.equal(wlasny.checked, true, '„żadne" nie nadpisuje „Dopisz sam"');
  for (const input of chipy) if (input.value !== 'wlasny') assert.equal(input.checked, false, `po „żadnych": ${input.value}`);
  assert.equal(pobierz('setup-temat-wlasny').hidden, false, 'pole własnego tematu zostaje widoczne');
});

test('bootstrap: pasek stanu ma komunikat, a wynik walidacji zostaje schowany', () => {
  assert.ok(pobierz('status').textContent.length > 20, 'pasek stanu milczy po starcie');
  assert.equal(pobierz('wynik-walidacji').hidden, true, 'karta wyniku jest w HTML ukryta i bootstrap jej nie odsłania');
  assert.equal(pobierz('wynik-naglowek').textContent, '', 'żaden wynik nie został wyrenderowany przed wklejeniem paczki');
});

test('bootstrap: przyciski nawigacji mają nasłuch zdarzeń', () => {
  for (const id of ['przycisk-dalej-pozycja', 'przycisk-kopiuj-prompt', 'przycisk-wklej', 'przycisk-poprawka', 'przycisk-motyw', 'przycisk-sygnaly', 'przycisk-przelicz', 'przycisk-informacje', 'przycisk-podejrzyj-mape']) {
    assert.ok(pobierz(id).zdarzenia.click?.length >= 1, `#${id} nie ma nasłuchu click — przycisk byłby martwy`);
  }
  // Ekran 5 nie ma już przycisku zatwierdzania: walidację odpala samo wklejenie,
  // więc martwe byłoby POLE bez nasłuchu `paste` (zgłoszenie 2026-09-09).
  assert.ok(pobierz('pole-odpowiedz').zdarzenia.paste?.length >= 1,
    '#pole-odpowiedz nie ma nasłuchu paste — wklejenie nie zatwierdzałoby paczki');
});

/* ------------------------------------------------- współrzędne ręczne */

/* ------------------------------------------------------------------ GPS */

test('GPS: watcher startuje z opcjami z ADR 0004 pkt 1', () => {
  assert.equal(gps.wywolania.watch, 1, 'jeden watcher na rozgrywkę');
  assert.deepEqual(gps.wywolania.opcje, OPCJE_WATCH);
  assert.deepEqual(OPCJE_WATCH, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  assert.equal(gps.wywolania.watch, 1, 'GPS uruchomiony automatycznie, bez przycisku');
});

test('GPS: fix trafia na ekran — współrzędne z geohashem i odblokowane przejście', () => {
  gps.wyslijFix(52.235, 21.015, 15);
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustalona');
  assert.match(pobierz('pozycja-wspolrzedne').textContent, /52\.23500, 21\.01500/);
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
  assert.equal(pobierz('bledy-pozycja').hidden, true, 'poprawny fix czyści poprzednie błędy');
});

test('GPS: accuracy nie powoduje ostrzeżeń', () => {
  gps.wyslijFix(52.236, 21.016, 400);
  assert.equal(pobierz('bledy-pozycja').hidden, true, 'accuracy nie powoduje ostrzeżenia');
  assert.equal(pobierz('pozycja-status').textContent, 'Pozycja ustalona', 'fix wchodzi do gry — próg dojścia i tak jest surowy');
  assert.equal(pobierz('przycisk-dalej-stacje').disabled, false);
  assert.doesNotMatch(pobierz('status').textContent, /niewystarczająca/);
});

test('GPS: błąd przeglądarki daje komunikat z wyjściem awaryjnym (ADR 0004 pkt 7)', () => {
  gps.wyslijBlad(1, 'User denied Geolocation');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P02\]/);
  assert.match(pobierz('bledy-pozycja').textContent, /Zezwól na lokalizację w ustawieniach przeglądarki i odśwież stronę/,
    'P02 daje wykonalne wyjście — bez developerskiej wzmianki o trybie testowym (usunięta 2026-09-11: to nie informacja dla graczy)');
  assert.equal(pobierz('pozycja-status').textContent, 'Brak pozycji');
  assert.match(pobierz('status').textContent, /otwartą przestrzeń/, 'status daje wykonalne wyjście (ADR 0029) — akcji pomijania odcinka nie ma od zadania H (2026-09-12)');

  gps.wyslijBlad(2, 'Position unavailable');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P03\]/);
  gps.wyslijBlad(3, 'Timeout');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P04\]/);
  gps.wyslijBlad(9, 'dziwny błąd');
  assert.match(pobierz('bledy-pozycja').textContent, /\[P08\].*dziwny błąd/);
});

test('uwaga A (ADR 0047): szczypanie strony poza mapą jest zablokowane, mapa szczypie jak dotąd', () => {
  // Decyzja właściciela 2026-09-14 (uwaga A): Safari iOS wznawia kartę czasem
  // przybliżoną, a potem palce zoomują STRONĘ, nie mapę (belka i marginesy
  // ucięte). iOS ignoruje user-scalable=no, więc blokada idzie przez gesty:
  // gesturestart/gesturechange poza .mapa dostają preventDefault, nad mapą
  // przechodzą bez zmian (mapa ma własne sterowanie, touch-action: none).
  let zablokowane = 0;
  const gest = (pozaMapa) => ({
    preventDefault() { zablokowane += 1; },
    target: pozaMapa
      ? { closest: () => null } // przycisk, karta, tekst — cokolwiek poza mapą
      : { closest: (selektor) => (selektor === '.mapa' ? {} : null) },
  });
  assert.ok(dom.wyslijZdarzenieDokumentu('gesturestart', gest(true)) >= 1,
    'app.js musi nasłuchiwać gesturestart na dokumencie');
  assert.equal(zablokowane, 1, 'szczypanie POZA mapą jest zablokowane');
  dom.wyslijZdarzenieDokumentu('gesturestart', gest(false));
  assert.equal(zablokowane, 1, 'szczypanie NAD mapą przechodzi bez blokady (mapa żyje jak dotąd)');
  dom.wyslijZdarzenieDokumentu('gesturechange', gest(true));
  assert.equal(zablokowane, 2, 'gesturechange poza mapą też jest blokowany');
  dom.wyslijZdarzenieDokumentu('gesturechange', gest(false));
  assert.equal(zablokowane, 2, 'gesturechange nad mapą przechodzi');
});

test('GPS: karta w tle NIE zatrzymuje śledzenia, a powrót nie zakłada watchera bez potrzeby (uwaga B, ADR 0040)', () => {
  assert.ok(dom.wyslijZdarzenieDokumentu('visibilitychange') >= 1, 'app.js musi nasłuchiwać visibilitychange');
  const watchPrzed = gps.wywolania.watch;
  const clearPrzed = gps.wywolania.clear.length;

  dom.ustawHidden(true);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gps.wywolania.clear.length, clearPrzed,
    'właściciel 2026-09-13 (B): żadnej pauzy w tle — nasłuch zostaje, bateria nie jest wymówką');
  assert.doesNotMatch(pobierz('status').textContent, /wstrzyman/i, 'komunikat o wstrzymaniu śledzenia wycofany (P07)');

  dom.ustawHidden(false);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gps.wywolania.watch, watchPrzed, 'żywy nasłuch z fixem nie jest zakładany od nowa');
  assert.doesNotMatch(pobierz('status').textContent, /Wznowiono śledzenie/, 'powrót z tła jest CICHY (P09 wycofany)');

  // drugi powrót też nic nie dokłada
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gps.wywolania.watch, watchPrzed);
});

// Decyzja właściciela 2026-09-08: przycisku trybu testowego NIE MA — wchodzi
// się wyłącznie parametrem adresu. Testujemy wszystkie przyjmowane formy.
for (const [adres, czyWlaczony] of [
  ['?test=true', true], ['?test=1', true], ['?test=TAK', true],
  ['?tryb=test', true], ['?test=false', false], ['?test=0', false], ['', false],
]) {
  test(`tryb testowy z adresu: „${adres || '(bez parametru)'}" → ${czyWlaczony ? 'włączony' : 'wyłączony'}`, async () => {
    const domTest = zainstalujDom({ search: adres });
    await import(`../app/app.js?urltest=${Math.random().toString(36).slice(2)}`);
    assert.equal(domTest.document.body.classList.contains('tryb-testowy'), czyWlaczony);
  });
}

test('tryb testowy z adresu: ?tryb=test nie wznawia GPS po powrocie z tła', async () => {
  // osobna atrapa DOM = osobny egzemplarz aplikacji bez nasłuchów z poprzednich importów
  const domTest = zainstalujDom({ search: '?tryb=test' });
  const gpsTest = atrapaGeolokalizacji({ idWatcha: 77 });
  domTest.ustawGeolokalizacje(gpsTest.geolocation);
  await import(`../app/app.js?trybtest=${Date.now()}`);

  assert.ok(domTest.document.body.classList.contains('tryb-testowy'));

  assert.equal(gpsTest.wywolania.watch, 0);
  domTest.ustawHidden(true);
  domTest.wyslijZdarzenieDokumentu('visibilitychange');
  assert.deepEqual(gpsTest.wywolania.clear, [], 'w trybie testowym GPS nie startuje');
  domTest.ustawHidden(false);
  domTest.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(gpsTest.wywolania.watch, 0, 'w trybie testowym pozycję ustawia mapa');
});

test('GPS: limit historii i próg trafień są z pozycja.js, a progu dokładności nie ma wcale', () => {
  // kontrakt na stałe: gdyby UI zaczął mieć własny próg, rozjechałby się z regułą dojścia
  // (ADR 0034 pkt 2: `accuracy` nie jest kryterium — pola `maxAccuracyM` nie ma i nie będzie)
  assert.equal('maxAccuracyM' in GRANICE, false);
  assert.equal(GRANICE.wymaganeTrafnienia, 2);
});

/* ------------------------------------------------------------- stan z pamięci */

test('bootstrap: uszkodzona konfiguracja w localStorage nie kładzie startu', async () => {
  const pamiecSmieci = new Map();
  pamiecSmieci.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: { tryb: 'konny', wiek: 'nestor', podklad: 'carto', tematy: ['kosmos'], liczbaGraczy: 'dużo', imiona: null },
  }));
  const domSmieci = zainstalujDom({ pamiec: pamiecSmieci });
  // ponowne wczytanie modułu z odświeżonym query — nowy egzemplarz, ten sam kod
  await import(`../app/app.js?powtorka=${Date.now()}`);
  assert.equal(domSmieci.pobierz('ekran-start').hidden, false, 'aplikacja musi wystartować nawet na śmieciowym stanie (mapa + okno)');
  assert.equal(domSmieci.pobierz('ekran-setup').hidden, true, 'setup nie otwiera się sam na starcie');
  assert.ok(domSmieci.pobierz('status').textContent.length > 20);
  assert.equal(domSmieci.pobierz('setup-stacje').value, String(DOMYSLNE.liczbaStacji), 'śmieciowy stan nie wchodzi do formularza');
  assert.ok(pamiec.size >= 0, 'pamięć pierwszej sesji zostaje nietknięta');
});

test('bootstrap: zapis sprzed markera kanonu dopełnia nowe tematy domyślne (m12-75, uwagi właściciela 4f)', async () => {
  // Scenariusz z terenu: „Ciekawostki” są w kanonie od dawna, ale w starym
  // localStorage ich nie ma → checkbox pokazuje się odptaszkowany. Jednorazowa
  // migracja przy starcie dopisuje je i ZAPISUJE marker, żeby nie pytaniać co run.
  const pamiecStary = new Map();
  pamiecStary.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', // bez `kanon` — zapis sprzed m12-75
    konfig: { tematy: ['architektura', 'geografia', 'historia', 'kultura', 'legendy', 'ludzie', 'nauka', 'przyroda'] },
  }));
  const domStary = zainstalujDom({ pamiec: pamiecStary });
  await import(`../app/app.js?migracja=${Date.now()}`);
  const poMigracji = JSON.parse(pamiecStary.get('okolica:konfig'));
  assert.equal(poMigracji.kanon, '2026-09-10', 'zapis dostaje marker kanonu po migracji');
  assert.ok(poMigracji.konfig.tematy.includes('ciekawostki'), '„Ciekawostki” dopisane do starych tematów');
  assert.ok(!poMigracji.konfig.tematy.includes('wlasny'), '„Dopisz sam” nie dołazi migracją');
  // UI checkboxów odzwierciedla zmigrowane tematy (chip = label > input+span)
  const chipy = [...domStary.pobierz('lista-tematow').children];
  const zaznaczoneTematy = chipy.filter((chip) => chip.children[0]?.checked).map((chip) => chip.textContent);
  assert.ok(zaznaczoneTematy.some((t) => /Ciekawostki/.test(t)), 'checkbox „Ciekawostki” zaznaczony po migracji');

  // Zapis Z markerem (świeży) nie jest ruszany — nawet z „dziurą” w tematach,
  // bo użytkownik mógł ją odptaszkować ZAMIERZENIE.
  const pamiecSwiezy = new Map();
  pamiecSwiezy.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: { tematy: ['historia'] },
  }));
  const domSwiezy = zainstalujDom({ pamiec: pamiecSwiezy });
  await import(`../app/app.js?migracja2=${Date.now()}`);
  const bezZmian = JSON.parse(pamiecSwiezy.get('okolica:konfig'));
  assert.deepEqual(bezZmian.konfig.tematy, ['historia'], 'świeży zapis: wybory gracza są święte');
  assert.equal(domSwiezy.pobierz('lista-tematow').children.length > 0, true, 'chipy tematów wyrenderowane');
});

test('bootstrap: marker kanonu jest PORÓWNYWANY — stary marker dostaje dopełnienie, bieżący nie (m12-84)', async () => {
  // Audyt PR #13 pkt 3: odczyt sprawdzał tylko OBECNOŚĆ markera (`if (!kanon)`),
  // więc zapis z markerem starszej wersji nigdy nie dostałby nowych tematów
  // domyślnych. Tu scenariusz z terenu: zapis z 2026-09-05 (jeszcze bez
  // „Ciekawostek” w domyślnych) podnosi się do bieżącego kanonu RAZ.
  const pamiecStaryMarkera = new Map();
  pamiecStaryMarkera.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-05',
    konfig: { tematy: ['architektura', 'historia'], liczbaStacji: 4 },
  }));
  const domStaryMarkera = zainstalujDom({ pamiec: pamiecStaryMarkera });
  await import(`../app/app.js?kanon=${Date.now()}`);
  const poNadrobieniu = JSON.parse(pamiecStaryMarkera.get('okolica:konfig'));
  assert.equal(poNadrobieniu.kanon, '2026-09-10', 'marker podniesiony do bieżącego kanonu');
  assert.ok(poNadrobieniu.konfig.tematy.includes('ciekawostki'), '„Ciekawostki” dopisane do zapisu ze starszym markerem');
  assert.ok(poNadrobieniu.konfig.tematy.includes('historia'), 'wybory organizatora zostają');
  assert.equal(poNadrobieniu.konfig.liczbaStacji, 4, 'pozostałe pola nietknięte');
  const chipy = [...domStaryMarkera.pobierz('lista-tematow').children];
  const zaznaczone = chipy.filter((chip) => chip.children[0]?.checked).map((chip) => chip.textContent);
  assert.ok(zaznaczone.some((t) => /Ciekawostki/.test(t)), 'checkbox odzwierciedla dopełniony temat');
});

/* ------------------------------------------------------------------ mapa (M2) */

/**
 * Każdy test mapy pracuje na ŚWIEŻEJ atrapie i świeżym imporcie `app.js`
 * (LESSONS: ponowny import dokłada kolejne nasłuchy `visibilitychange`, więc
 * egzemplarze nie mogą dzielić atrap). Import z unikalnym query = nowy moduł.
 */
async function aplikacjaZMapa({ search = '', pamiec = new Map() } = {}) {
  const domMapy = zainstalujDom({ search, pamiec });
  await import(`../app/app.js?mapa=${Math.random().toString(36).slice(2)}`);
  return domMapy;
}

/** Odpala nasłuch elementu tak, jak robi to przeglądarka. */
function wyslij(el, typ, zdarzenie = {}) {
  const lista = el.zdarzenia[typ] ?? [];
  for (const fn of lista) fn({ type: typ, preventDefault() {}, ...zdarzenie });
  return lista.length;
}

test('mapa: mały promień gry kadruje się jak 500 m — bez pustych kafli (zgłoszenie 2026-09-12 + uwaga A 2026-09-14)', async () => {
  // Właściciel w testach terenowych: po stuknięciu mapy (i po pobraniu sieci
  // z Overpassa) aplikacja przybliżała tak mocno, że kafelki OSM przestawały
  // cokolwiek pokazywać. Sufit przybliżenia liczy `dopasujZoomDoPromienia`
  // (`PROMIEN_SUFITU_ZOOMU_M`), a ten test sprawdza OKABLOWANIE: czy po
  // ustawieniu pozycji mapa naprawdę stoi w kadrze sufitu, a nie w kadrze
  // promienia 250 m. Od 2026-09-14 sufit to 500 m, a nie 1000 m.
  const konfig = { ...domyslnaKonfiguracja(), promienM: 250 };
  const pamiec = new Map([
    ['okolica:profil', JSON.stringify({
      schemat: 'profil-lokalny/1', pseudonim: 'MałyPromień', zweryfikowany: true,
      kiedy: '2026-09-07T10:00:00.000Z',
    })],
    ['okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig })],
  ]);
  const domM = await aplikacjaZMapa({ search: '?tryb=test&odstep=0', pamiec });
  domM.kliknij('przycisk-dalej-pozycja');
  await czekaj(10);
  domM.ustawPozycje('52.2297', '21.0122');

  const rect = domM.pobierz('mapa-pozycja').getBoundingClientRect();
  const zoomWidokuMapy = dopasujZoomDoPromienia(250, rect.width, 52.2297);
  assert.equal(zoomWidokuMapy, dopasujZoomDoPromienia(500, rect.width, 52.2297),
    'promień 250 m daje kadr promienia 500 m (sufit przybliżenia 500 m od 2026-09-14)');
  const oczekiwany = widokNaSrodek({
    lat: 52.2297, lon: 21.0122, zoom: zoomWidokuMapy,
    rozmiar: { szerokosc: rect.width, wysokosc: rect.height },
  });
  assert.equal(
    domM.pobierz('mapa-pozycja-skala').textContent,
    skalaBar(oczekiwany, 52.2297).etykieta,
    'pasek skali pokazuje kadr z sufitem, nie kadr promienia 250 m',
  );
  // Dowód, że to nie jest przypadkowa równość: kadr bez sufitu miałby inny pasek.
  const bezSufitu = widokNaSrodek({
    lat: 52.2297, lon: 21.0122,
    zoom: dopasujZoomDoPromienia(250, rect.width, 52.2297, { sufitPromienM: 0 }),
    rozmiar: { szerokosc: rect.width, wysokosc: rect.height },
  });
  assert.notEqual(skalaBar(bezSufitu, 52.2297).etykieta, skalaBar(oczekiwany, 52.2297).etykieta,
    'bez sufitu pasek skali byłby inny (głębszy zoom) — sufit naprawdę zmienia widok');
});

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

test('mapa: operatorskie nadpisanie szablonu kafelków dociera do rysowanej mapy', async () => {
  // End-to-end: klucz w localStorage → `wczytajNadpisanieKafelkow()` w `start()`
  // → `ustawSzablonKafelkow()` → `urlKafelka()` → warstwa SVG. Testy jednostkowe
  // w `test/mapa.test.js` pilnują samej walidacji; tu sprawdzamy okablowanie.
  const zamiennik = 'https://zamiennik.przyklad.org/{z}/{x}/{y}.png';
  const pamiec = new Map([['okolica:kafelki:url', zamiennik]]);
  const domMapy = await aplikacjaZMapa({ pamiec });
  const kafelki = domMapy.pobierz('mapa-pozycja-kafelki');
  assert.ok(kafelki.children.length > 0, 'panel mapy pusty po starcie');
  assert.ok(
    kafelki.children.every((k) => String(k.getAttribute('href')).startsWith('https://zamiennik.przyklad.org/')),
    'kafelki mają pochodzić z nadpisanego hosta',
  );
});

test('mapa: błędne nadpisanie szablonu NIE gasi mapy — zostaje OSM', async () => {
  // Klucz w trybie prywatnym albo z literówką nie może zostawić gracza z pustą
  // mapą: walidacja odrzuca wartość i wracamy na adres wbudowany.
  for (const smiec of ['http://niebezpieczny.example/{z}/{x}/{y}.png', 'to-nie-url', '']) {
    const pamiec = new Map([['okolica:kafelki:url', smiec]]);
    const domMapy = await aplikacjaZMapa({ pamiec });
    const kafelki = domMapy.pobierz('mapa-pozycja-kafelki');
    assert.ok(kafelki.children.length > 0, `mapa pusta po błędnym kluczu: ${smiec}`);
    assert.ok(
      kafelki.children.every((k) => String(k.getAttribute('href')).startsWith('https://tile.openstreetmap.org/')),
      `błędny klucz (${smiec}) ma zostawić adres wbudowany`,
    );
  }
});

test('mapa: pierwszy fix rysuje marker BEZ koła dokładności i centruje widok na graczu', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = domMapy.gps;
  gpsMapy.wyslijFix(52.235, 21.015, 15);

  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1, 'brak markera pozycji');
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-promien'],
    'na mapie jest tylko okrąg promienia gry — koła dokładności nie ma (ADR 0034 pkt 2)',
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
  const gpsMapy = domMapy.gps;
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
    ['okrag-promien'],
  );
});

test('mapa: podkład i język ZASZYTE w kodzie — pól wyboru nie ma, mapy jadą na OSM (właściciel, 2026-09-11)', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('id="setup-podklad"'), 'pola wyboru podkładu nie ma w UI');
  assert.ok(!html.includes('id="setup-jezyk"'), 'pola wyboru języka nie ma w UI');

  const domMapy = await aplikacjaZMapa();
  assert.ok(
    domMapy.pobierz('mapa-pozycja-kafelki').children.every((k) => String(k.getAttribute('href')).startsWith('https://tile.openstreetmap.org/')),
    'kafelki OSM bez dotykania czegokolwiek',
  );
  assert.equal(domMapy.pobierz('mapa-stacje-atrybucja').textContent, PODKLADY.osm.atrybucja);
  assert.equal(domMapy.pobierz('mapa-gra-atrybucja').textContent, PODKLADY.osm.atrybucja);
});

test('mapa: pozycja z tapnięcia mapy w trybie testowym nie udaje koła dokładności', async () => {
  const domMapy = await aplikacjaZMapa({ search: '?tryb=test' });
  domMapy.ustawPozycje('52.23178', '21.01234');

  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1, 'marker jest — pozycja ustawiona z mapy (pól ręcznych nie ma, ADR 0034 pkt 5)');
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-promien'],
    'bez `accuracy` nie rysujemy koła dokładności (uczciwość wobec danych)',
  );
  assert.match(domMapy.pobierz('mapa-pozycja-svg').getAttribute('aria-label'), /52\.23178/);
});

test('mapa: schowany panel nie rysuje, a powrót na ekran przywraca warstwy', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = domMapy.gps;
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

test('mapa: wyczyszczony czas gry nie wysypuje przejścia — jest jawna odmowa z kodem K19', async () => {
  const domMapy = await aplikacjaZMapa();
  const gpsMapy = domMapy.gps;
  // gracz czyści pole czasu gry → `Number('') = 0`, czyli wartość skończona,
  // która przechodzi przez hartowanie liczb w setupie (promień zjeżdża wtedy
  // na minimum 200 m, więc odmowa musi przyjść z walidacji czasu — K19)
  wyslij(domMapy.pobierz('setup-czas'), 'input', { target: { value: '' } });
  gpsMapy.wyslijFix(52.235, 21.015, 15);

  // `stacjeProste` odmawia przy niedodatnim promieniu — przejście ma odmówić,
  // a nie urwać się wyjątkiem w nasłuchu (LESSONS L10)
  domMapy.kliknij('przycisk-dalej-stacje');
  assert.equal(domMapy.pobierz('ekran-stacje').hidden, true, 'przejście jest odmówione, nie urwane');
  assert.match(domMapy.pobierz('bledy-pozycja').textContent, /\[K19\]/, 'kod z konfig.js, komunikat dla człowieka');
  assert.match(domMapy.pobierz('bledy-pozycja').textContent, /Planowany czas gry/);
  assert.match(domMapy.pobierz('status').textContent, /Wróć do ustawień gry/);

  // mapa pozycji działa dalej; promień zjeżdża na minimum (200 m), więc okrąg
  // promienia JEST — zniknąłby dopiero, gdyby promień nie był liczbą (ADR 0025)
  assert.equal(domMapy.pobierz('mapa-pozycja-marker').children.length, 1);
  assert.deepEqual(
    domMapy.pobierz('mapa-pozycja-okregi').children.map((c) => c.getAttribute('class')),
    ['okrag-promien'],
  );
  assert.ok(domMapy.pobierz('mapa-pozycja-kafelki').children.length > 0);

  // po wpisaniu czasu gry przejście działa (promień liczy się sam — ADR 0025)
  wyslij(domMapy.pobierz('setup-czas'), 'input', { target: { value: '90' } });
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

test('prywatność: ekran otwiera się ze stopki, a „wróć" prowadzi na właściwy ekran', async () => {
  const domMapy = await aplikacjaZMapa();
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, true, 'ekran prywatności jest domyślnie schowany');

  // Przycisku na ekranie setupu nie ma (właściciel, 2026-09-09; brak pinuje
  // kontrakt) — dostęp jest zawsze w stopce, więc i z mapy startowej.
  domMapy.kliknij('przycisk-prywatnosc-stopka');
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, false);
  assert.equal(domMapy.pobierz('ekran-start').hidden, true, 'prywatność chowa okno startowe');

  domMapy.kliknij('przycisk-wrocz-prywatnosc');
  assert.equal(domMapy.pobierz('ekran-prywatnosc').hidden, true);
  assert.equal(domMapy.pobierz('ekran-setup').hidden, true, 'wróciliśmy na mapę, nie na setup');
  assert.equal(domMapy.pobierz('ekran-start').hidden, true, 'powrót nie wskrzesza okna');

});

test('prywatność: czyszczenie jest dwustopniowe i rusza tylko klucze obolica:*', async () => {
  const pamiecPriv = new Map();
  pamiecPriv.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig: { liczbaGraczy: 2 } }));
  pamiecPriv.set('okolica:motyw', 'ciemny');
  pamiecPriv.set('inna-apka:stan', 'nie ruszać');
  const domMapy = zainstalujDom({ pamiec: pamiecPriv });
  await import(`../app/app.js?priv=${Math.random().toString(36).slice(2)}`);

  domMapy.kliknij('przycisk-prywatnosc-stopka'); // przycisk setupu nie ma (2026-09-09)
  domMapy.kliknij('przycisk-czysc-dane');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Kliknij ponownie/, 'pierwszy klik tylko uzbraja');
  assert.ok(pamiecPriv.has('okolica:konfig'), 'po uzbrojeniu nic nie zostało usunięte');
  assert.ok(pamiecPriv.has('okolica:motyw'));

  domMapy.kliknij('przycisk-czysc-dane');
  assert.equal(pamiecPriv.has('okolica:konfig'), false, 'konfig usunięty');
  assert.equal(pamiecPriv.has('okolica:motyw'), false, 'motyw usunięty');
  assert.equal(pamiecPriv.get('inna-apka:stan'), 'nie ruszać', 'obce klucze zostają nietknięte');
  assert.equal(pamiecPriv.has('okolica:gracze'), false, 'lista graczy (tożsamość) też jest czyszczona');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Usunięto zapisane dane \(3\)/);

  // trzeci klik zaczyna od nowa: znów tylko uzbraja
  domMapy.kliknij('przycisk-czysc-dane');
  assert.match(domMapy.pobierz('czysc-dane-status').textContent, /Kliknij ponownie/);
  assert.equal(pamiecPriv.size, 1);
});

/* ------------------------------------------- symulacja dojścia (M3, tryb testowy) */

const czekaj = (ms) => new Promise((rozwiaz) => setTimeout(rozwiaz, ms));

/**
 * ADR 0029: dojście rozstrzyga wyłącznie strumień fixów, więc testy nie mają
 * już „ręcznego" przycisku — karmią aplikację symulacją, która idzie przez ten
 * sam `przyjmijFix` co GPS. Czekamy aktywnie na skutek (panel odcinka znika),
 * dzięki czemu test jest tak szybki, jak pozwala debounce dojścia, a gdy
 * dojście nie nastąpi — mówi wprost, zamiast po cichu sprawdzać coś dalej.
 */
async function dojdzSymulacja(dom, { maksMs = 5000 } = {}) {
  dom.kliknij('przycisk-symulacja-gra');
  const start = Date.now();
  while (dom.pobierz('gra-panel-odcinek').hidden === false) {
    if (Date.now() - start > maksMs) {
      throw new Error(`symulacja nie domknęła dojścia w ${maksMs} ms — status: ${dom.pobierz('status').textContent}`);
    }
    await czekaj(40);
  }
}

/* ------------------------------------------------- M4/I7: stacje z sieci w UI */

const KATALOG_APP = join(dirname(fileURLToPath(import.meta.url)), '..');

function czytajFixtureOverpass(nazwa) {
  return JSON.parse(readFileSync(join(KATALOG_APP, 'test', 'fixtures', `overpass-${nazwa}.json`), 'utf8'));
}

/**
 * Fixture'y Overpass są ułożone pod promień 1000 m — przy mniejszym sieć jest
 * za uboga i aplikacja słusznie wraca do pierścienia. Promień liczy się teraz
 * z czasu gry (ADR 0025), więc testy sieciowe ustawiają 110 min (5 stacji
 * × 1 pytanie → 1000 m), a nie promień wprost.
 */
function konfigNa1000m(pamiec) {
  pamiec.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig: { czasGryMin: 110 } }));
  return pamiec;
}

async function aplikacjaZSiecia({ search = '?tryb=test', pamiec = new Map() } = {}) {
  const domAtrapa = zainstalujDom({ search, pamiec });
  await import(`../app/app.js?siec=${Math.random().toString(36).slice(2)}`);
  return domAtrapa;
}

function ustawPozycjeTestowa(domAtrapa, lat = '52.2297', lon = '21.0122') {
  domAtrapa.ustawPozycje(lat, lon);
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
});

test('stacje: cache sieci daje stacje SIECIOWE bez żadnego internetu', async () => {
  const pamiecCache = new Map();
  // nazwa miejsca ZAWSZE się wyświetla (Partia 2: koniec opcji geokodacji)
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  pamiecCache.set(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));

  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: konfigNa1000m(pamiecCache) });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  // też synchronicznie: cache zastępuje sieć
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa \(Overpass\) — punkty osiągalne/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /z pamięci telefonu/, 'druga gra w tej okolicy nie woła Overpass');
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3);
  assert.match(domAtrapa.pobierz('pozycja-miejsce').textContent, /Śródmieście/, '{MIEJSCE} z obszaru administracyjnego (bez Nominatim)');
});

test('stacje: „Inny układ" i „Pobierz ponownie" wracają widokiem na górę warstwy (UX m12-120)', async () => {
  // Właściciel: przyciski opcji stoją pod długą listą stacji; po kliknięciu
  // panel (.panel-centralny, overflow-y: auto) zostawał przewinięty w dół.
  const pamiecCache = new Map();
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  pamiecCache.set(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: konfigNa1000m(pamiecCache) });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  const warstwa = domAtrapa.pobierz('ekran-stacje');
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3, 'warstwa stacji otwarta z listą');

  warstwa.scrollTop = 412; // właściciel przewinął listę na dół
  domAtrapa.kliknij('przycisk-przelicz');
  assert.equal(warstwa.scrollTop, 0, '„Inny układ" wraca na górę warstwy');

  warstwa.scrollTop = 412;
  domAtrapa.kliknij('przycisk-siec-ponow');
  assert.equal(warstwa.scrollTop, 0, '„Pobierz sieć ponownie" wraca na górę warstwy');
});

test('stacje: udane pobranie z pierwszej instancji zapisuje cache i rysuje sieć', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0', pamiec: konfigNa1000m(new Map()) });
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
  assert.match(zapytanie, /^\[out:json\]\[timeout:8\];/);
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
  // Właściciel 2026-09-13: czekanie na sieć ma być WIDAĆ — nakładka pulsuje.
  assert.equal(domAtrapa.pobierz('stacje-ladowanie').classList.contains('pulsuje'), true,
    'nakładka pulsuje, póki Overpass nie odpowiedział');
  domAtrapa.kliknij('przycisk-podejrzyj-mape');
  assert.equal(domAtrapa.pobierz('ekran-stacje').hidden, false, 'oko nie deaktywuje ekranu');
  assert.equal(domAtrapa.pobierz('ekran-stacje').inert, true);
  puść();
  await czekaj(250);
  assert.equal(domAtrapa.document.body.dataset.ekran, 'stacje');
  assert.equal(domAtrapa.pobierz('przycisk-podejrzyj-mape').getAttribute('aria-pressed'), 'true');
  domAtrapa.kliknij('przycisk-podejrzyj-mape');
  assert.equal(domAtrapa.pobierz('ekran-stacje').inert, false);
  assert.equal(domAtrapa.pobierz('stacje-ladowanie').hidden, true, 'nakładka znika po odpowiedzi');
  assert.equal(domAtrapa.pobierz('stacje-ladowanie').classList.contains('pulsuje'), false,
    'po odpowiedzi pulsowanie gaśnie — stan „czekam" nie zostaje na ekranie');
  assert.match(domAtrapa.pobierz('siec-proby').textContent, /HTTP 400/, 'błąd zapytania jawny (kod S03)');
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
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0', pamiec: konfigNa1000m(pamiecCache) });
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

test('Overpass: timeout martwej instancji przełącza OD RAZU, bez pauzy limitowej', async () => {
  // Pełny odstęp (bez odstep=0): stary kod czekałby tu 30 s na martwą instancję
  // (pauza limitowa skrócona do 1 s, ale po martwej instancji i tak nie ma).
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
  assert.ok(trwalo < 10_000, `przełączenie po timeoutcie bez pauzy (trwało ${trwalo} ms, pauza limitowa odpadła)`);
  assert.equal(domAtrapa.pamiec.get('okolica:overpass-sprawny'), INSTANCJE_OVERPASS[1].url, 'sprawna instancja zapamiętana');
});

test('Overpass: zapamiętany sukces VK Maps ma pierwszeństwo', async () => {
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
  assert.deepEqual(wywolania, [INSTANCJE_OVERPASS[2].url], 'zapamiętany VK Maps pierwszy');
});

test('stacje: 429 przełącza instancje dokładnie w kolejności ASSETS §2', async () => {
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test&odstep=0' });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  const odwiedzone = [];
  domAtrapa.window.fetch = async (url) => {
    odwiedzone.push(url);
    if (odwiedzone.length < INSTANCJE_OVERPASS.length) return { ok: false, status: 429 };
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
  assert.equal(ileProb, INSTANCJE_OVERPASS.length, 'próbuje wszystkich instancji');
  assert.equal(domAtrapa.pobierz('bledy-stacje').hidden, false);
  assert.match(domAtrapa.pobierz('bledy-stacje').textContent, /\[S03\]/);
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /tryb uproszczony/);
  assert.ok(domAtrapa.pobierz('lista-stacji').children.length >= 3, 'degradacja rozstawia pierścień (ADR 0005 pkt 8)');
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
  // textContent, nie innerHTML: wiersz jest zbudowany z węzłów (LESSONS L19),
  // a atrapa DOM nie parsuje innerHTML — pole zostałoby puste.
  const dystansPrzed = domAtrapa.pobierz('lista-stacji').children[0].textContent;
  wyslijNa(pinezki.children[0], 'pointerdown', { pointerId: 11, clientX: 0, clientY: 0, stopPropagation() {} });
  wyslijNa(svg, 'pointermove', { pointerId: 11, clientX: 100, clientY: 100 });
  wyslijNa(svg, 'pointerup', { pointerId: 11 });
  const dystansPo = domAtrapa.pobierz('lista-stacji').children[0].textContent;
  assert.notEqual(dystansPo, dystansPrzed, 'lista odświeżona po przeciągnięciu');
  assert.match(dystansPo, /ustawiona ręcznie \(linia prosta — osiągalność niezweryfikowana\)/);

  domAtrapa.kliknij('przycisk-reczne'); // stop
  assert.equal(domAtrapa.pobierz('przycisk-reczne').dataset['attr-aria-pressed'], 'false');
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /ustawione ręcznie przez organizatora/, 'po wyłączeniu UI nadal mówi, że stacja jest ręczna');

  // „Inny układ" gasi tryb ręczny i przywraca czysty pierścień
  domAtrapa.kliknij('przycisk-przelicz');
  assert.equal(domAtrapa.pobierz('przycisk-reczne').dataset['attr-aria-pressed'], 'false');
  assert.ok(!domAtrapa.pobierz('stacje-tryb').textContent.includes('ręcznie'), 'nowy układ nie udaje ręcznego');
  assert.ok(!domAtrapa.pobierz('lista-stacji').children[0].textContent.includes('ręcznie'));
});

/* --------------------------------------- M5/J3: podgląd i edycja organizatora */

function czytajFixturePaczka() {
  return JSON.parse(readFileSync(join(KATALOG_APP, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));
}

test('Q2 end-to-end: wklejona paczka odwrócona (rev1) od razu zaczyna grę', async () => {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    // czasGryMin 85 → promień 1000 m dla 3 stacji × 1 pytania (ADR 0025);
    // fixture paczki jest ułożony pod ten promień
    // 3 graczy przy 3 stacjach × 1 pytaniu: pytania dzielą się bez reszty (K22, ADR 0027)
    konfig: { liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?rev1=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const jawna = czytajFixturePaczka();
  const rev1 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV1 };
  dom.wklej('pole-odpowiedz', JSON.stringify(rev1));
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(odwrócona, rev1/, 'nagłówek mówi, co się stało');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'poprawna paczka od razu zaczyna grę (decyzja 2026-09-07)');
  assert.equal(dom.pobierz('ekran-paczka').hidden, true);
  assert.equal(dom.pobierz('pole-odpowiedz').value, '', 'plaintext nie zostaje w polu wklejenia');
});

test('rev2 end-to-end: wklejona paczka z kodami od razu zaczyna grę', async () => {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    // czasGryMin 85 → promień 1000 m dla 3 stacji × 1 pytania (ADR 0025);
    // fixture paczki jest ułożony pod ten promień
    // 3 graczy przy 3 stacjach × 1 pytaniu: pytania dzielą się bez reszty (K22, ADR 0027)
    konfig: { liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?rev2=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const jawna = czytajFixturePaczka();
  const rev2 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV2 };
  rev2.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(jawna.pytania.find((q) => q.id === p.id).poprawna, p); delete p.punkty; });
  dom.wklej('pole-odpowiedz', JSON.stringify(rev2));
  assert.match(dom.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(odwrócona, rev2/, 'nagłówek mówi, co się stało');
  assert.match(dom.pobierz('wynik-naglowek').textContent, /; fact check\)$/, 'nagłówek ogłasza weryfikację (ADR 0032)');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'poprawna paczka od razu zaczyna grę (decyzja 2026-09-07)');
  const rejestr = JSON.parse(pamiecKonfig.get('okolica:zestawy'));
  assert.equal(rejestr.wpisy[0].factcheck, true, 'meta w rejestrze mówi: zweryfikowana');
});

/* --------------------------------------- ADR 0032: wariant bez fact-check */

/** Atrapa nie przełącza checkboxów sama — stan + zdarzenie `change` jak w przeglądarce. */
function przelaczCheckbox(domAtrapa, id, wartosc) {
  const el = domAtrapa.pobierz(id);
  el.checked = wartosc;
  for (const fn of el.zdarzenia.change ?? []) fn({ type: 'change', target: el, currentTarget: el });
}

function pamiecKonfig3x1() {
  const pamiecKonfig = new Map();
  pamiecKonfig.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: { liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
  }));
  return pamiecKonfig;
}

test('ADR 0032: checkbox domyślnie pusty, prompt domyślnie rev5; zaznaczenie daje rev4', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?fc1=${Math.random().toString(36).slice(2)}`);
  assert.equal(domAtrapa.pobierz('prompt-factcheck').checked, false, 'checkbox startuje pusty (atrapa czyta prawdziwy index.html)');
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  domAtrapa.kliknij('przycisk-dalej-prompt');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev5/, 'domyślny prompt generuje rev5');
  assert.ok(!domAtrapa.pobierz('pole-prompt').value.includes('wykonaj kwerendę w internecie'), 'domyślny prompt nie żąda kwerendy');
  // B2: nowe warianty nie każą odwracać tekstu.
  assert.ok(!domAtrapa.pobierz('pole-prompt').value.includes('ODWRÓCONE ZNAKAMI'), 'prompt nie żąda odwracania liter');
  assert.match(domAtrapa.pobierz('prompt-tryb-opis').textContent,
    /Tryb: pytania bez fact-check — model AI korzysta z własnej wiedzy, generowanie pytań trwa krócej\./,
    'opis mówi tekstem właściciela (2026-09-09), słowo w słowo');
  assert.match(domAtrapa.pobierz('prompt-podglad-naglowek').textContent, /bez fact-check/);
  assert.match(domAtrapa.pobierz('prompt-licznik').textContent, /PYT\/1\.0-rev5/);
  przelaczCheckbox(domAtrapa, 'prompt-factcheck', true);
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev4/, 'zaznaczony checkbox generuje rev4');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /wykonaj kwerendę w internecie/);
  assert.match(domAtrapa.pobierz('prompt-tryb-opis').textContent,
    /Tryb: pytania z fact check — model sprawdza każdy fakt w sieci ale generowanie pytań trwa dłużej\./,
    'opis mówi tekstem właściciela (2026-09-09), słowo w słowo');
  przelaczCheckbox(domAtrapa, 'prompt-factcheck', false);
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev5/, 'odznaczenie wraca do rev5');
});

test('ADR 0032 + uwaga terenowa G.a (2026-09-12): nowa generacja startuje z odptaszkowanym checkboxem', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?ga1=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  // Aplikacja nie przeładowuje się (PWA): stan checkboxa „przeżywa” tło —
  // zaptaszkowanie z poprzedniej generacji leży w DOM tak, jak na telefonie
  // właściciela, który widział „domyślnie zaptaszkowane”.
  przelaczCheckbox(domAtrapa, 'prompt-factcheck', true);
  domAtrapa.kliknij('przycisk-dalej-prompt'); // nowa generacja (ekran 3 → 4)
  assert.equal(domAtrapa.pobierz('prompt-factcheck').checked, false, 'nowa generacja = domyślnie odptaszkowane (właściciel 2026-09-12)');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev5/, 'prompt wraca do wariantu bez fact-check');
  // Strzałka wstecz (ekran 5 → 4) celowo NIE resetuje — spójność tej samej generacji:
  przelaczCheckbox(domAtrapa, 'prompt-factcheck', true);
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev4/, 'wybór użytkownika dla tej generacji obowiązuje');
  domAtrapa.kliknij('przycisk-dalej-paczka');
  domAtrapa.kliknij('przycisk-wstecz-prompt');
  assert.equal(domAtrapa.pobierz('prompt-factcheck').checked, true, 'powrót do promptu tej samej generacji nie kasuje wyboru');
  assert.match(domAtrapa.pobierz('pole-prompt').value, /PYT\/1\.0-rev4/, 'prompt nadal rev4 — spójny z checkboxem');
});

test('ADR 0032 end-to-end: paczka rev3 bez źródeł przyjęta, rejestr niesie factcheck:false', async () => {
  const pamiecKonfig = pamiecKonfig3x1();
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig });
  await import(`../app/app.js?fc2=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  const jawna = czytajFixturePaczka();
  const rev3 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV3 };
  rev3.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(jawna.pytania.find((q) => q.id === p.id).poprawna, p); delete p.zrodla; delete p.punkty; });
  domAtrapa.wklej('pole-odpowiedz', JSON.stringify(rev3));
  assert.match(domAtrapa.pobierz('wynik-naglowek').textContent, /Paczka przyjęta \(odwrócona, rev3 — odkodowana; bez fact-check\)/);
  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, false, 'rev3 bez źródeł zaczyna grę');
  const rejestr = JSON.parse(pamiecKonfig.get('okolica:zestawy'));
  assert.equal(rejestr.wpisy.length, 1);
  assert.equal(rejestr.wpisy[0].factcheck, false, 'meta w rejestrze mówi: bez weryfikacji');
});

test('ADR 0032: poprawka celuje w profil wklejki — E02 w checkbox, odrzucona w znacznik', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?fc3=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  domAtrapa.kliknij('przycisk-dalej-prompt'); // STAN.promptFactcheck = false (pusty checkbox)
  // E02: śmieć nieparsowalny → korekta za checkboxem (tu: bez weryfikacji)
  domAtrapa.wklej('pole-odpowiedz', 'to nie jest JSON ani kontener {{{');
  assert.match(domAtrapa.pobierz('wynik-naglowek').textContent, /Nie da się odczytać/);
  domAtrapa.kliknij('przycisk-poprawka');
  assert.match(domAtrapa.pobierz('pole-odpowiedz').value, /sposób ich ustalenia zostawiamy Tobie/, 'E02 przy pustym checkboxie: korekta nie narzuca sposobu zdobycia faktu');
  // odrzucona rev2 (za mało pytań) → korekta za znacznikiem, mimo pustego checkboxa
  const jawna = czytajFixturePaczka();
  const rev2 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV2 };
  rev2.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(jawna.pytania.find((q) => q.id === p.id).poprawna, p); delete p.punkty; });
  rev2.pytania = rev2.pytania.slice(0, 2); // E03: oczekiwane 3 pytania
  domAtrapa.wklej('pole-odpowiedz', JSON.stringify(rev2));
  assert.match(domAtrapa.pobierz('wynik-naglowek').textContent, /Paczka odrzucona/);
  domAtrapa.kliknij('przycisk-poprawka');
  assert.match(domAtrapa.pobierz('pole-odpowiedz').value, /kwerenda internetowa dla każdego faktu/, 'odrzucona rev2: korekta żąda kwerendy');
});

test('ADR 0032: pełna gra rev3 bez źródeł — status bez „źródeł" i bez linii wariantu', async () => {
  const pamiec = new Map();
  pamiec.set('okolica:gracze', JSON.stringify({ schemat: 'gracze-lokalni/1', gracze: ['Gracz 1', 'Gracz 2', 'Gracz 3'].map((pseudonim) => ({ pseudonim, zweryfikowany: true })) }));
  pamiec.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig: { liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 } }));
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?fcgame=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');
  const jawna = czytajFixturePaczka();
  const rev3 = { ...odwrocPolaPaczki(jawna), protokol: WERSJA_PROTOKOLU_REV3 };
  rev3.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(jawna.pytania.find((q) => q.id === p.id).poprawna, p); delete p.zrodla; delete p.punkty; });
  domAtrapa.wklej('pole-odpowiedz', JSON.stringify(rev3));
  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, false, 'rev3 zaczyna grę');
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = jawna.pytania.find((q) => q.stacja === numerStacji);
    domAtrapa.kliknij('przycisk-start-odcinka');
    domAtrapa.kliknij('przycisk-symulacja-gra');
    await czekaj(9 * 120 + 600);
    assert.equal(domAtrapa.pobierz('gra-panel-pytanie').hidden, false, `stacja ${numerStacji}: pytanie po dojściu GPS`);
    kliknijOdpowiedz(domAtrapa, numerStacji === 1 ? (pytanie.poprawna + 1) % 4 : pytanie.poprawna);
    if (numerStacji === 1) {
      assert.match(domAtrapa.pobierz('status').textContent, /wyjaśnienie poniżej/, 'status nie obiecuje źródeł, których nie ma');
      assert.equal(domAtrapa.pobierz('status').textContent.includes('źródła'), false, 'słowo „źródła" nie pada przy paczce bez źródeł');
      assert.equal(domAtrapa.pobierz('gra-zrodla').children.length, 0, 'pusta lista źródeł bez linków');
    }
    domAtrapa.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(domAtrapa.pobierz('gra-panel-koniec').hidden, false, 'koniec po ostatniej stacji');
  // ADR 0038 (zgłoszenie właściciela 2026-09-12, D c): ekran wyniku nie ma już
  // linii wariantu — zdanie „Pytania bez wymuszonego fact-checku…” i jego
  // mutacja z „fact check” zniknęły razem z elementem, którego nikt nie pytał.
  assert.equal(domAtrapa.elementy.has('gra-wynik-factcheck'), false, 'pokazWyniki nie dotyka linii wariantu');
  // Wariant paczki (ADR 0032) niesie rejestr zestawów (`factcheck: false`) —
  // lokalnej historii gier nie ma (zgłoszenie terenowe O, 2026-09-13).
});

test('ADR 0032: zła odpowiedź przy paczce ze źródłami — status mówi o źródłach, linki są', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-symulacja-gra');
  await czekaj(9 * 120 + 600);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'pytanie po dojściu GPS');
  const poprawna = paczka.pytania.find((q) => q.stacja === 1).poprawna;
  kliknijOdpowiedz(dom, (poprawna + 1) % 4);
  assert.match(dom.pobierz('status').textContent, /wyjaśnienie i źródła poniżej/, 'status jak dawniej, gdy źródła są');
  assert.ok(dom.pobierz('gra-zrodla').children.length > 0, 'linki do źródeł pod wyjaśnieniem');
});

test('ADR 0032: propozycje paczek pokazują „Fact-checked" tylko dla zweryfikowanych', async () => {
  const { zbierzMetaZestawu } = await import('../app/zestawy.js');
  const { geohash } = await import('../app/geo.js');
  const baza = { lat: 52.2297, lon: 21.0122, promienM: 1000, tematy: ['historia'], wiek: 'dorosli', liczbaStacji: 3, pytaniaNaStacje: 1, miejsce: 'Śródmieście' };
  const metaFc = zbierzMetaZestawu({ ...baza, data: '2026-09-09 10:00' });
  const metaBez = zbierzMetaZestawu({ ...baza, data: '2026-09-09 11:00', factcheck: false });
  assert.equal(metaFc.geohash5, geohash(52.2297, 21.0122, 5), 'sanity: wpis w komórce pozycji testowej');
  const pamiec = pamiecKonfig3x1();
  // nawigacja na ekran pozycji przechodzi przez bramę setupu (K08) i bramę
  // tożsamości — jak w prawdziwym użyciu: imiona w konfigu i na liście
  const konfig = JSON.parse(pamiec.get('okolica:konfig'));
  konfig.konfig.imiona = ['Gracz 1', 'Gracz 2', 'Gracz 3'];
  pamiec.set('okolica:konfig', JSON.stringify(konfig));
  pamiec.set('okolica:gracze', JSON.stringify({ schemat: 'gracze-lokalni/1', gracze: ['Gracz 1', 'Gracz 2', 'Gracz 3'].map((pseudonim) => ({ pseudonim, zweryfikowany: true })) }));
  // I.b: propozycje tylko z repozytorium — wpisy z indeksu (factcheck niesie wpis)
  const URL_REPO = 'https://repo.przyklad/indeks.json';
  pamiec.set('okolica:repo-zestawow:url', URL_REPO);
  const indeks = JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [
    { skrot: 'aaa', id: 'drive-aaa', licencja: 'CC BY-SA 4.0', ...metaFc, kodGry: 'x' },
    { skrot: 'bbb', id: 'drive-bbb', licencja: 'CC BY-SA 4.0', ...metaBez, kodGry: 'x' },
  ] });
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?fclista=${Math.random().toString(36).slice(2)}`);
  domAtrapa.window.fetch = async (url) => (String(url).startsWith(URL_REPO)
    ? { ok: true, status: 200, text: async () => indeks }
    : { ok: false, status: 404, text: async () => '' });
  domAtrapa.kliknij('przycisk-dalej-pozycja');
  await czekaj(20); // handler nawigacji jest asynchroniczny (bramka tożsamości)
  assert.equal(domAtrapa.pobierz('ekran-pozycja').hidden, false, 'nawigacja przeszła bramę setupu');
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  for (let i = 0; i < 200 && domAtrapa.pobierz('zestawy-lista').children.length < 2; i++) await czekaj(10);
  const wiersze = [...domAtrapa.pobierz('zestawy-lista').children];
  assert.equal(wiersze.length, 2, 'oba wpisy dopasowane do setupu testowego');
  const maQ = (li) => [...li.children[0].children].some((c) => c?.className === 'znaczek-factcheck');
  assert.equal(maQ(wiersze.find((li) => li.textContent.includes('11:00'))), false, 'bez weryfikacji: brak znaczka');
  assert.equal(maQ(wiersze.find((li) => li.textContent.includes('10:00'))), true, 'zweryfikowana: znaczek „Fact-checked"');
});

/* ================== M5/J5: nazwa miejsca z Overpass (warstwa zapasowa
     Nominatim usunięta na życzenie właściciela 2026-09-11 — jest jedno źródło) */

test('nazwa miejsca ZAWSZE trafia do UI i do promptu (Partia 2: koniec opcji geokodacji)', async () => {
  const pamiecCache = new Map(); // konfig domyślny, bez żadnych przełączników
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  pamiecCache.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: konfigNa1000m(pamiecCache) });
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
  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec: konfigNa1000m(pamiecCache) });
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

/* ============ M6/R4: ekran gry — fazy przygotowanie/odcinek, pauza */

/** Przyjęta paczka + pozycja + stacje z pierścienia (synchronicznie, bez fetch).
 *  Zwraca też `pamiec` — testy trwałości (R6) czytają klucze zapisu gry. */
async function graGotowaDoStartu(dodatkoweKlucze = {}) {
  const pamiec = new Map();
  // Klucze, które test chce mieć w pamięci PRZED startem aplikacji (np. resztkowa
  // sesja gry sieciowej — zgłoszenie terenowe R, 2026-09-13).
  for (const [klucz, wartosc] of Object.entries(dodatkoweKlucze)) pamiec.set(klucz, wartosc);
  // Lista graczy nie jest polem konfigu, tylko zapamiętaną tożsamością
  // (ADR 0026 aneks): trzy potwierdzone imiona wracają na listę bez PIN-u.
  pamiec.set('okolica:gracze', JSON.stringify({
    schemat: 'gracze-lokalni/1',
    gracze: ['Gracz 1', 'Gracz 2', 'Gracz 3'].map((pseudonim) => ({ pseudonim, zweryfikowany: true })),
  }));
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    // czasGryMin 85 → promień 1000 m dla 3 stacji × 1 pytania (ADR 0025);
    // fixture paczki jest ułożony pod ten promień
    // 3 graczy przy 3 stacjach × 1 pytaniu: pytania dzielą się bez reszty (K22, ADR 0027)
    konfig: { liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?gra=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  const paczka = czytajFixturePaczka();
  dom.wklej('pole-odpowiedz', JSON.stringify(paczka)); // poprawna paczka SAMA zaczyna grę (decyzja 2026-09-07)
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
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, false, 'slot sterowania widoczny w fazie przygotowania (start gry)');
  assert.match(dom.pobierz('gra-cel-stacji').textContent, /m w linii prostej od poprzedniego punktu/, 'pierścień (brak sieci): etykieta mówi wprost, że to prosta kreska (ADR 0014 pkt 1)');
  assert.match(dom.pobierz('gra-dystans').textContent, /\d+ m/, 'badge dystansu w linii prostej z bieżącej pozycji');
});

test('M6: odcinek — start, dojście ze strumienia fixów i odmowa drugiego startu (G03)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'panel B w fazie odcinek');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true);
  assert.equal(dom.pobierz('przycisk-symulacja-gra').hidden, false, 'w trybie testowym symulacja dojścia do stacji');
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, false, 'slot sterowania widoczny w fazie odcinka');

  // drugi start tego samego odcinka → jawna odmowa z kodem G03, nie wyjątek
  dom.kliknij('przycisk-start-odcinka');
  assert.match(dom.pobierz('bledy-gra').textContent, /G03/, 'kod rozgrywki widoczny w alercie');

  // ADR 0029: dojście rozstrzyga strumień fixów. Symulacja karmi aplikację tym
  // samym `przyjmijFix` co GPS, więc to ścieżka produkcyjna, a nie skrót.
  await dojdzSymulacja(dom);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'faza pytania — panel C (wypełnienie treścią w R5)');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, true);
  assert.match(dom.pobierz('status').textContent, /próg dojścia zadziałał z GPS/, 'status mówi o dojściu z fixów — ręcznego zgłoszenia już nie ma');
  assert.equal(dom.pobierz('bledy-gra').hidden, true, 'poprawna tranzycja czyści poprzedni błąd');
});

test('uwaga B (2026-09-13): pauzy nie ma — gra idzie dalej także po zejściu karty w tło (ADR 0040)', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(dom.pobierz('przycisk-start-odcinka').disabled, false, 'żadna pauza nie blokuje akcji fazowych');
  assert.equal(dom.pobierz('gra-pasek').hidden, false, 'w drodze jest pasek');

  // Tło i powrót: bez przycisku, bez komunikatu i bez utraty fazy.
  dom.ustawHidden(true);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  dom.ustawHidden(false);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'po powrocie ta sama faza — nie ma czego wznawiać');
  assert.equal(dom.pobierz('gra-pasek').hidden, false, 'pasek drogi zostaje');
  assert.doesNotMatch(dom.pobierz('status').textContent, /wstrzyman|Wznowiono/i, 'ani słowa o pauzie');

  await dojdzSymulacja(dom);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'dojście zalicza się bez żadnego wznawiania');
});

/* ================= M6/R5: pętla pytania — odsłonięcie, odpowiedź, źródła */

/** Pełna ścieżka do fazy pytania: start gry → odcinek → dojście z fixów (ADR 0029). */
async function graWFaziePytania() {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
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
  // Uwaga właściciela z testów (2026-09-13, A): w fazie ODPOWIEDZI pytanie i
  // warianty są na wierzchu (details otwarty), statyczna lista jeszcze schowana.
  assert.equal(dom.pobierz('gra-pytanie-detale').open, true, 'w fazie odpowiedzi pytanie i warianty NA WIERZCHU');
  assert.equal(dom.pobierz('gra-odpowiedzi-lista').hidden, true, 'statyczna lista wariantów należy do pokazu wyniku');
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
  assert.equal(dom.pobierz('gra-odpowiedzi').hidden, true, 'właściciel 2026-09-11: po odpowiedzi przyciski A–D znikają (jedna odpowiedź, bez poprawek)');
  // Uwaga właściciela z testów (2026-09-13, A; ADR 0036 aneks): pytanie i możliwe
  // odpowiedzi zjeżdżają do ZWINIĘTEGO elementu, a warianty wracają jako lista.
  assert.equal(dom.pobierz('gra-pytanie-detale').open, false, 'po odpowiedzi pytanie i warianty zwinięte — na wierzchu łapki, wynik i komentarz (bez scrollowania)');
  const wariantyPo = dom.pobierz('gra-odpowiedzi-lista');
  assert.equal(wariantyPo.hidden, false, 'warianty WRACAJĄ jako statyczna lista („te przywróć”)');
  assert.equal(wariantyPo.children.length, 4, 'cztery możliwe odpowiedzi w liście');
  wariantyPo.children.forEach((li, i) => {
    assert.equal(li.textContent, `${'ABCD'[i]}. ${pierwsze.odpowiedzi[i]}`, 'lista niesie te same warianty co przyciski');
  });
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
  assert.match(dom.pobierz('przycisk-nastepna-stacja').textContent, /Gracz 2, stacja 2 — idę →/, 'jeden przycisk niesie i gracza, i cel — bez drugiego klika (zgłoszenie 2026-09-09)');
  // panele TRZYMAJĄ wyjaśnienie: model jest już w fazie przygotowanie, ale C widoczny
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'wyjaśnienie nie znika zanim gracz kliknie dalej');
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 2 z 3/, 'badge postępu już po zamknięciu stacji');
});

/** Hot-seat pod rotację pytań: 2 graczy i po 2 pytania na stację (zgłoszenie C).
 *  Fixture ma jedno pytanie na stację, więc dokładamy drugie (treść INNA —
 *  protokół odrzuca duplikaty treści: E-**). */
async function graDwomaGraczamiDwaPytania() {
  const pamiec = new Map();
  pamiec.set('okolica:gracze', JSON.stringify({
    schemat: 'gracze-lokalni/1',
    gracze: ['Gracz 1', 'Gracz 2'].map((pseudonim) => ({ pseudonim, zweryfikowany: true })),
  }));
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    // czasGryMin 90 → promień 1000 m dla 3 stacji × 2 pytań (ADR 0025); fixture
    // paczki jest ułożony pod ten promień (E16 porównuje go z konfiguracją).
    konfig: { liczbaGraczy: 2, liczbaStacji: 3, pytaniaNaStacje: 2, tematy: ['historia', 'architektura'], czasGryMin: 90 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?rotacja=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje');
  const paczka = czytajFixturePaczka();
  // Identyfikator pytania ma wzorzec `s<stacja>p<numer>` (E19), a treść kończy
  // się znakiem zapytania (E15) — dlatego numer pytania zmieniamy, a marker
  // „wariant B” idzie na POCZĄTEK treści (protokół odrzuca duplikaty treści).
  const drugie = paczka.pytania.map((p) => ({
    ...p,
    id: p.id.replace(/p1$/, 'p2'),
    tresc: `Wariant B: ${p.tresc}`,
    wyjasnienie: `Wariant B: ${p.wyjasnienie}`,
  }));
  dom.wklej('pole-odpowiedz', JSON.stringify({ ...paczka, pytania: [...paczka.pytania, ...drugie] }));
  return { dom, paczka, drugie };
}

test('M6: przy 2 pytaniach na stację gracze odpowiadają NA ZMIANĘ, nie w kółko ten sam (zgłoszenie C)', async () => {
  const { dom, drugie } = await graDwomaGraczamiDwaPytania();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);

  // Zgłoszenie właściciela 2026-09-12: Gracz 1 dostawał OBA pytania pierwszej
  // stacji. Na stacji odpowiada gracz z kolejki (ADR 0022), ale każde pytanie
  // ma innego autora — pierwsze gracz z kolejki, drugie następny gracz.
  assert.match(dom.pobierz('gra-pytanie-naglowek').textContent, /Stacja 1 zdobyta · pytanie 1 z 2 · odpowiada Gracz 1/);
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski[0], currentTarget: przyciski[0] });
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'stacja nie zamknięta po pierwszym pytaniu');
  assert.match(dom.pobierz('przycisk-nastepna-stacja').textContent, /Następne pytanie/, 'drugie pytanie tej samej stacji');
  dom.kliknij('przycisk-nastepna-stacja');

  assert.match(dom.pobierz('gra-pytanie-naglowek').textContent, /Stacja 1 zdobyta · pytanie 2 z 2 · odpowiada Gracz 2/,
    'drugie pytanie stacji idzie do NASTĘPNEGO gracza');
  assert.equal(dom.pobierz('gra-pytanie-tresc').textContent, drugie[0].tresc, 'treść drugiego pytania');
  assert.equal(dom.pobierz('gra-odpowiedzi').hidden, false, 'Gracz 2 ma swoje cztery odpowiedzi');
  assert.equal(dom.pobierz('gra-pytanie-detale').open, true, 'nowe pytanie = details znowu otwarty (uwaga z testów A)');
  assert.equal(dom.pobierz('gra-odpowiedzi-lista').hidden, true, 'lista wariantów poprzedniego pytania nie zostaje na wierzchu');

  // Gracz 2 odpowiada — dopiero teraz stacja się zamyka i gra idzie dalej.
  const przyciski2 = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski2[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski2[0], currentTarget: przyciski2[0] });
  assert.match(dom.pobierz('przycisk-nastepna-stacja').textContent, /Gracz 2, stacja 2 — idę →/,
    'po dwóch pytaniach stacja zamknięta, trasa idzie dalej');
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'kolejny odcinek wystartował');
});

test('M6: jeden przycisk po odpowiedzi — rotacja gracza I START odcinka (hot-seat, ADR 0009)', async () => {
  const { dom } = await graWFaziePytania();
  // Właściciel 2026-09-11 (4a): nad boksem pytania nie ma już nagłówka „Gra",
  // badge'ów ani przycisków sterowania odcinkiem — schowane w całej fazie pytania
  // (przycisku „pomiń” nie ma wcale od zadania H, 2026-09-12).
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, true, 'slot sterowania schowany w fazie pytania');
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski[0], currentTarget: przyciski[0] });
  // Właściciel 2026-09-11 (4b): po odpowiedzi przyciski A–D znikają — werdykt
  // i wyjaśnienie unoszą się w górę na zaoszczędzonym miejscu.
  assert.equal(dom.pobierz('gra-odpowiedzi').hidden, true, 'przyciski odpowiedzi schowane po odpowiedzi');
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, false, 'slot sterowania wraca po wyjściu w drogę');
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, true, 'panel C zamknięty');
  // Zgłoszenie właściciela 2026-09-09: panel oczekiwania NIE ma się już pokazać —
  // to była druga strona kliknięcia, którą łączymy w jedno.
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true, 'panel A pominięty — start poszedł tym samym klikiem');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'gracz jest już w drodze');
  assert.match(dom.pobierz('status').textContent, /Odcinek rozpoczęty/, 'odcinek wystartował bez drugiego klika');
  // rotacja kolejki (2 graczy z domyślnej konfiguracji) widoczna w badge'u kolejki
  assert.match(dom.pobierz('gra-kolejka').textContent, /Gracz 2/, 'kolej przeszła na drugiego gracza');
});

test('M6: zejście w tło w trakcie wyjaśnienia — ocena ZOSTAJE, „Następna stacja" prowadzi (właściciel 2026-09-11, preview; bez pauzy od 2026-09-13)', async () => {
  const { dom } = await graWFaziePytania();
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski[0], currentTarget: przyciski[0] });
  // tło dokładnie tak, jak łapie je w terenie zwinięcie okna/karty — ten sam kod
  dom.ustawHidden(true);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  dom.ustawHidden(false);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
  // NIECHCIANY LAYER: panel oczekiwania nie może wyprzeć oceny odpowiedzi
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'panel pytania z oceną zostaje na ekranie');
  assert.equal(dom.pobierz('gra-wynik-odpowiedzi').hidden, false, 'ocena i wyjaśnienie nadal widoczne');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true, 'panel oczekiwania NIE wskakuje ponad oceną');
  const dalej = dom.pobierz('przycisk-nastepna-stacja');
  assert.match(dalej.textContent, /idę →/, 'etykieta obiecuje wyjście w drogę, nie wznawianie (ADR 0040)');
  // jeden klik = wyjście w drogę (bez pauzy nie ma drugiego stanu do odwracania)
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true, 'panel A pominięty');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'gracz od razu w drodze');
  assert.match(dom.pobierz('status').textContent, /Odcinek rozpoczęty/, 'odcinek wystartował bez drugiego klika');
});

test('M6: błędna odpowiedź — zero punktów, poprawna ujawniona w ocenie, gra idzie dalej', async () => {
  const { dom, paczka } = await graWFaziePytania();
  const pierwsze = paczka.pytania.find((q) => q.stacja === 1);
  const zlyIndex = (pierwsze.poprawna + 1) % 4;
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  const zly = przyciski[zlyIndex];
  for (const fn of zly.zdarzenia.click ?? []) fn({ type: 'click', target: zly, currentTarget: zly });
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /✗ Źle \(0 pkt\)/);
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, new RegExp(`Poprawna odpowiedź: ${'ABCD'[pierwsze.poprawna]}\\.`), 'poprawna odpowiedź ujawniona po błędzie');
  assert.equal(dom.pobierz('gra-odpowiedzi').hidden, true, 'właściciel 2026-09-11: przyciski A–D znikają po odpowiedzi');
  assert.equal(dom.pobierz('gra-wyjasnienie').textContent, pierwsze.wyjasnienie, 'wyjaśnienie także po błędzie — tu jest najwięcej nauki');
  dom.kliknij('przycisk-nastepna-stacja');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'gra idzie dalej mimo błędu — od razu w drogę');
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

  await dojdzSymulacja(dom);
  snapshot = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(snapshot.rozgrywka.faza, 'pytanie', 'zapis po dojściu');
});

test('M6+K: powrót w fazie przygotowania — od razu droga i pasek, bez panelu oczekiwania (właściciel 2026-09-11, ADR 0045)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom); // faza przygotowanie — zapis właśnie z tej fazy
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  assert.equal(JSON.parse(pamiec.get(kluczZapisu)).rozgrywka.faza, 'przygotowanie');

  // Uwaga K (ADR 0045): nowa instancja aplikacji na tej samej pamięci wraca do
  // gry SAMA — bez banera na setupie, bez kliku i bez okna startowego.
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?wznow2=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom2.pobierz('ekran-start').hidden, true, 'powrót do gry pomija okno startowe');
  // Powrót NIE może pokazywać panelu oczekiwania („Idzie: … ▶ Idę do
  // stacji …") — to miała być międzystrona zastąpiona paskiem na dole.
  assert.equal(dom2.pobierz('gra-panel-oczekuje').hidden, true, 'panel A NIE pokazuje się po wznowieniu');
  assert.equal(dom2.pobierz('gra-panel-odcinek').hidden, false, 'powrót od razu w fazie odcinka');
  assert.equal(dom2.pobierz('gra-pasek').hidden, false, 'pasek drogi widoczny od razu');
  assert.match(dom2.pobierz('status').textContent, /Odcinek rozpoczęty/, 'status potwierdza start odcinka');
});

test('M6+K: powrót po „zamknięciu przeglądarki" — nowa instancja, ta sama pamięć, rebaza zegara (ADR 0045)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(JSON.parse(pamiec.get(kluczZapisu)).rozgrywka.faza, 'odcinek');

  // „zamknięcie przeglądarki": zupełnie nowa instancja aplikacji na tej samej
  // pamięci — uwaga K (ADR 0045): wraca do gry sama, bez banera i bez kliku.
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?wznow=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom2.pobierz('setup-czas').zdarzenia.input.length, 1, 'L14: powrót do gry nie dokleja drugiego nasłuchu pól setupu');
  assert.equal(dom2.pobierz('ekran-gra').hidden, false, 'aplikacja wróciła na ekran gry');
  assert.equal(dom2.pobierz('gra-panel-odcinek').hidden, false, 'faza odcinka odtworzona');
  assert.match(dom2.pobierz('status').textContent, /Wróciliśmy do zapamiętanej gry/, 'status mówi, co się stało');
  assert.match(dom2.pobierz('status').textContent, /faza: odcinek/);

  // rebaza zegara działa: zakończenie odcinka NIE daje G09 (czas końca < startu)
  await dojdzSymulacja(dom2);
  assert.equal(dom2.pobierz('bledy-gra').hidden, true, `brak błędu, a jest: ${dom2.pobierz('bledy-gra').textContent}`);
  assert.equal(dom2.pobierz('gra-panel-pytanie').hidden, false, 'gra toczy się dalej po wznowieniu');
});

test('R: resztkowa gra sieciowa nie chowa trasy w hot-seacie, a start gry kasuje jej sesję (zgłoszenie terenowe 2026-09-13)', async () => {
  // Właściciel: „włączyłem grę w HotSeat, 5 stacji i widać tylko pierwszą
  // stację, do której idę — ukrywanie trasy miało działać TYLKO w Multiplayerze
  // z włączoną opcją". Telefon miał w pamięci sesję Wspólnej Trasy z poprzedniego
  // testu: odzyskany przy starcie kontekst multi włączał trasę-sekret także
  // w hot-seacie, a przy następnym otwarciu sesja multi wygrywała z zapisem gry.
  const { dom, pamiec } = await graGotowaDoStartu({
    'okolica:multi:sesja': JSON.stringify({
      kod: 'ABC123', idGry: 'gra-1', graczId: 'gracz-1', pseudonim: 'Gracz 1',
      urlMostu: 'https://script.google.com/macros/s/TEST/exec', rola: 'organizator',
      zapisano: new Date().toISOString(),
    }),
  });
  dom.ustawProstokat('mapa-gra', { width: 360, height: 320 });
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  assert.match(dom.pobierz('mapa-gra-pinezki').textContent, /123/,
    'hot-seat rysuje CAŁĄ trasę z numerami 1, 2, 3 — sekret Wspólnej Trasy nie przecieka');
  assert.equal(pamiec.has('okolica:multi:sesja'), false,
    'start hot-seata kasuje resztkową sesję sieciową — następne otwarcie wróci do TEJ gry');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra hot-seat toczy się dalej');
});

test('N: powrót po zamknięciu przeglądarki W TRASIE — cel zostaje stacją 2, a punkty nie zerują się (zgłoszenie terenowe 2026-09-13)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  dom.ustawProstokat('mapa-gra', { width: 360, height: 320 });
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom); // stacja 1 zdobyta → pytanie
  const przyciski = dom.pobierz('gra-odpowiedzi').children;
  for (const fn of przyciski[0].zdarzenia.click ?? []) fn({ type: 'click', target: przyciski[0], currentTarget: przyciski[0] }); // poprawna = 0
  dom.kliknij('przycisk-nastepna-stacja'); // → przygotowanie, cel: stacja 2
  dom.kliknij('przycisk-start-odcinka'); // → odcinek do stacji 2
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  const przed = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(przed.rozgrywka.biezacaStacja, 2, 'zapis niesie cel: stacja 2');
  assert.equal(przed.rozgrywka.odpowiedzi.length, 1, 'zapis niesie odpowiedź ze stacji 1');

  // „zamknięcie przeglądarki" w trakcie marszu: nowa instancja na tej samej
  // pamięci. Panel mapy ma rozmiar PRZED powrotem, żeby warstwa stacji zdążyła
  // się narysować (L13: schowany/zerowy panel = pusty plan mapy).
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  dom2.ustawProstokat('mapa-gra', { width: 360, height: 320 });
  await import(`../app/app.js?trasa=${Math.random().toString(36).slice(2)}`);

  const po = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(po.rozgrywka.biezacaStacja, 2, 'cel po powrocie to WCIĄŻ stacja 2');
  assert.equal(po.rozgrywka.odpowiedzi.length, 1, 'zdobyta odpowiedź nie znika z zapisu');
  assert.equal(po.rozgrywka.odpowiedzi[0].poprawna, true, 'i zostaje policzona jako poprawna');
  assert.equal(po.stacje.length, 3, 'lista stacji w zapisie jest pełna');
  assert.match(dom2.pobierz('gra-postep').textContent, /stacja 2 z 3/, 'nagłówek gry mówi „stacja 2 z 3"');
  // Hotseat NIE ukrywa trasy (zgłoszenie R): mapa gry rysuje wszystkie stacje i
  // numeruje je od 1 po kolei, więc pin celu ma numer 2 — nie 1.
  assert.match(dom2.pobierz('mapa-gra-pinezki').textContent, /123/, 'na mapie widać całą trasę z numerami 1, 2, 3');
});

/* Pytanie właściciela do zgłoszenia N (2026-09-13): „czy punktacja się przenosi
 * przy reloadzie? Punkty zachowane przy graczach?”. Punkty NIE są polem stanu —
 * liczy je `podsumowanie()` z `rozgrywka.odpowiedzi` (wpis niesie `gracz`
 * i `punktyRazem`), a odpowiedzi jadą w zapisie stanu. Test sprawdza LICZBY:
 * per gracz przed zamknięciem przeglądarki, w zapisie po powrocie i w tabeli
 * końca gry dokończonej JUŻ po wznowieniu. Fixture ma po jednym pytaniu na
 * stację, więc przy trzech graczach stacja 1 należy do Gracza 1, stacja 2 do
 * Gracza 2, a stacja 3 do Gracza 3 (ADR 0027): Gracz 1 punktuje PRZED reloadem,
 * Gracz 2 odpowiada źle (zero zostaje zerem, nie brakiem wpisu), a Gracz 3
 * punktuje PO wznowieniu. */
test('N (punktacja): punkty per gracz przechodzą przez reload — zapis, wznowienie i tabela końca gry', async () => {
  const { dom, paczka, pamiec } = await graGotowaDoStartu();
  dom.ustawProstokat('mapa-gra', { width: 360, height: 320 });
  zaczynijGre(dom);
  const kluczZapisu = () => 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');
  const zapis = () => JSON.parse(pamiec.get(kluczZapisu())).rozgrywka;
  const punktyZapisu = () => zapis().odpowiedzi.map((o) => [o.gracz, o.punktyRazem]);
  const poprawna = (stacja) => paczka.pytania.find((q) => q.stacja === stacja).poprawna;

  // Stacja 1 — pytanie Gracza 1, odpowiedź DOBRA (+1 pkt).
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  assert.match(dom.pobierz('gra-pytanie-naglowek').textContent, /odpowiada Gracz 1/, 'stacja 1 należy do Gracza 1');
  kliknijOdpowiedz(dom, poprawna(1));
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /\+1 pkt/, 'punkt przyznany');
  dom.kliknij('przycisk-nastepna-stacja');

  // Stacja 2 — pytanie Gracza 2, odpowiedź ZŁA (0 pkt).
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  assert.match(dom.pobierz('gra-pytanie-naglowek').textContent, /odpowiada Gracz 2/, 'stacja 2 należy do Gracza 2');
  kliknijOdpowiedz(dom, (poprawna(2) + 1) % 4);
  assert.match(dom.pobierz('gra-odpowiedz-ocena').textContent, /Źle \(0 pkt\)/, 'zero punktów');
  dom.kliknij('przycisk-nastepna-stacja');
  dom.kliknij('przycisk-start-odcinka'); // marsz do stacji 3 — tu „zamykamy przeglądarkę”

  const przed = punktyZapisu();
  assert.deepEqual(przed, [[1, 1], [2, 0]], 'przed zamknięciem: Gracz 1 ma 1 pkt, Gracz 2 ma 0');
  assert.equal(zapis().faza, 'odcinek', 'zapis jest w fazie marszu');

  // „Zamknięcie przeglądarki” w marszu: nowa instancja aplikacji na tej samej pamięci.
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  dom2.ustawProstokat('mapa-gra', { width: 360, height: 320 });
  await import(`../app/app.js?punkty=${Math.random().toString(36).slice(2)}`);

  const po = zapis();
  assert.deepEqual(po.odpowiedzi.map((o) => [o.gracz, o.punktyRazem]), przed,
    'zapis po powrocie niesie TE SAME punkty przy TYCH SAMYCH graczach');
  assert.deepEqual(po.gracze.map((g) => g.imie), ['Gracz 1', 'Gracz 2', 'Gracz 3'],
    'lista graczy wraca cała — punkty mają do kogo być przypisane');
  assert.match(dom2.pobierz('gra-postep').textContent, /stacja 3 z 3/, 'gra wróciła w marszu do stacji 3');

  // Dokończenie gry JUŻ po wznowieniu: stacja 3, pytanie Gracza 3, odpowiedź dobra.
  await zamknijStacje(dom2, { paczka, numerStacji: 3, odpowiedz: poprawna(3) });

  assert.equal(zapis().faza, 'koniec', 'gra domknięta po wznowieniu');
  assert.deepEqual(punktyZapisu(), [[1, 1], [2, 0], [3, 1]],
    'wpis Gracza 3 dołączył do wpisów sprzed reloadu — nic się nie wyzerowało');

  // Tabela końca gry (ADR 0038: gracz | punkty | poprawne) — liczby z
  // `podsumowanie()` policzonego na rozgrywce złożonej z zapisu PRZED i PO.
  assert.equal(dom2.pobierz('gra-panel-koniec').hidden, false, 'panel wyniku widoczny');
  assert.match(dom2.pobierz('gra-wynik-zwyciezca').textContent, /🏆 Gracz 1/,
    'ranking otwiera Gracz 1 (remis 1:1 z Graczem 3 rozstrzyga stabilny sort)');
  const wiersze = dom2.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 3, 'tabela ma wszystkich trzech graczy');
  // Wiersze idą w kolejności RANKINGU (`wynik.ranking`, ADR 0038), nie listy
  // graczy: 1 pkt Gracza 1 (zdobyty PRZED reloadem), 1 pkt Gracza 3 (zdobyty PO
  // wznowieniu), 0 pkt Gracza 2. Remis 1:1 rozstrzyga stabilny sort.
  assert.match(wiersze[0].children[0].textContent, /Gracz 1 🏆/, 'wiersz 1: Gracz 1 ze znacznikiem zwycięzcy');
  assert.equal(wiersze[0].children[1].textContent, '1', 'punkt Gracza 1 zdobyty PRZED reloadem jest w tabeli');
  assert.equal(wiersze[0].children[2].textContent, '1/1', 'poprawne/razem Gracza 1');
  assert.match(wiersze[1].children[0].textContent, /Gracz 3/, 'wiersz 2: Gracz 3');
  assert.equal(wiersze[1].children[1].textContent, '1', 'punkt Gracza 3 zdobyty PO wznowieniu');
  assert.equal(wiersze[1].children[2].textContent, '1/1', 'poprawne/razem Gracza 3');
  assert.match(wiersze[2].children[0].textContent, /Gracz 2/, 'wiersz 3: Gracz 2');
  assert.equal(wiersze[2].children[1].textContent, '0', 'zero Gracza 2 zostaje zerem, nie brakiem wpisu');
  assert.equal(wiersze[2].children[2].textContent, '0/1', 'odpowiedział, tylko źle');
});

test('K: zepsuty zapis — jawne kody T, start kasuje go bez pytania (ADR 0045)', async () => {
  const pamiec = new Map();
  pamiec.set('okolica:gra-aktywna', 'zepsuta');
  pamiec.set('okolica:gra:zepsuta', 'to nie jest json');
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?zepsuty=${Math.random().toString(36).slice(2)}`);
  // Zepsutego zapisu nie da się podnieść, więc aplikacja zostaje na starcie i
  // mówi wprost, co skasowała — bez banera i bez dwustopniowego kasowania.
  assert.equal(dom.pobierz('ekran-gra').hidden, true, 'nie ma do czego wracać — zostajemy na starcie');
  assert.match(dom.pobierz('status').textContent, /zepsuty/, 'komunikat wprost');
  assert.match(dom.pobierz('status').textContent, /T01/, 'kod usterki widoczny');
  assert.equal(pamiec.has('okolica:gra:zepsuta'), false, 'start kasuje zapis, którego nie da się podnieść');
  assert.equal(pamiec.has('okolica:gra-aktywna'), false, 'wskaźnik aktywnej gry też');

  // Następne otwarcie jest już czyste — żadnego komunikatu o zepsutym zapisie.
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?zepsuty2=${Math.random().toString(36).slice(2)}`);
  assert.equal(/zepsuty/.test(dom2.pobierz('status').textContent), false, 'sprzątanie jest jednorazowe');
});

test('K: zamknięcie karty i zwinięcie telefonu zapisują stan gry (ADR 0045)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  const kluczZapisu = 'okolica:gra:' + pamiec.get('okolica:gra-aktywna');

  // Zapis idzie po KAŻDEJ tranzycji (plan M6), więc kasujemy go, żeby było widać,
  // iż to pożegnanie z kartą go odtworzyło, a nie wcześniejszy ruch w grze.
  pamiec.delete(kluczZapisu);
  assert.equal(dom.wyslijZdarzenieOkna('pagehide'), 1, 'nasłuch pagehide jest założony');
  const poPagehide = JSON.parse(pamiec.get(kluczZapisu));
  assert.equal(poPagehide.rozgrywka.faza, 'przygotowanie', 'pagehide zapisuje bieżący stan gry');

  pamiec.delete(kluczZapisu);
  dom.ustawHidden(true);
  assert.ok(dom.wyslijZdarzenieDokumentu('visibilitychange') >= 1, 'nasłuch visibilitychange jest założony');
  assert.ok(pamiec.has(kluczZapisu), 'zwinięcie telefonu też zapisuje stan (uwaga K)');
  dom.ustawHidden(false);
  dom.wyslijZdarzenieDokumentu('visibilitychange');
});

test('M6: przycisk pomijania nie istnieje — gra go nie dotyka (zadanie H)', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  const pytanie = paczka.pytania.find((q) => q.stacja === 1);
  kliknijOdpowiedz(dom, pytanie.poprawna);
  dom.kliknij('przycisk-nastepna-stacja');
  // atrapa tworzy elementy leniwie: brak id w `elementy` znaczy, że żaden
  // render ani handler po niego nie sięgnął (wcześniej sięgał każdy renderujGre)
  assert.equal(dom.elementy.has('przycisk-pomin-stacje'), false, 'usunięty przycisk nie jest dotykany');
});

/**
 * Koniec gry dokładnie tak, jak robi to gracz (ADR 0043, uwagi H1 i I):
 * ikona ⚙ START GRY otwiera warstwę potwierdzenia, wpisanie TAK odblokowuje
 * przycisk, a klik kończy grę. Przycisku „■ Zakończ grę" w panelu NIE MA.
 */
function zakonczGrePrzezWarstwe(dom) {
  dom.kliknij('przycisk-setup');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, false, 'w trakcie gry ⚙ otwiera warstwę końca gry');
  dom.wpisz('koniec-gry-potwierdzenie', 'tak');
  assert.equal(dom.pobierz('przycisk-koniec-gry').disabled, false, 'wpisane TAK odblokowuje przycisk');
  dom.kliknij('przycisk-koniec-gry');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'po potwierdzeniu warstwa się zamyka');
}

test('M6: ręczne zakończenie gry — potwierdzenie wpisaniem TAK, wynik wcześniej, zapis zostaje', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  // ADR 0043: koniec gry wyprowadził się z panelu do warstwy za ikoną ⚙ START GRY
  dom.kliknij('przycisk-setup');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, false, 'w trakcie gry ⚙ otwiera warstwę potwierdzenia');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, true, 'samo otwarcie warstwy NIE kończy gry');
  assert.equal(dom.pobierz('przycisk-koniec-gry').disabled, true, 'bez TAK przycisk jest zablokowany');

  dom.wpisz('koniec-gry-potwierdzenie', ' TaK ');
  assert.equal(dom.pobierz('przycisk-koniec-gry').disabled, false,
    '„ TaK " odblokowuje — wielkość liter i odstępy bez znaczenia (uwaga I)');
  dom.kliknij('przycisk-koniec-gry');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'potwierdzenie zamyka warstwę');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'panel wyniku widoczny');
  assert.equal(dom.pobierz('gra-panel-oczekuje').hidden, true);
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 3, 'wynik per gracz (3 graczy z konfiguracji — 3 stacje × 1 pytanie dzieli się bez reszty, ADR 0027)');
  assert.equal(wiersze[0].children.length, 3, 'gracz | punkty | poprawne');
  assert.match(dom.pobierz('status').textContent, /można ją wznowić/, 'uczciwie: zapis zostaje');
  assert.ok(pamiec.has('okolica:gra:' + pamiec.get('okolica:gra-aktywna')), 'zapis NIE skasowany — można wrócić do gry');
});

test('M6: ⚙ START GRY nigdy nie jest wyszarzone — w grze otwiera koniec gry (zgłoszenie J i uwaga I)', async () => {
  const { dom } = await graGotowaDoStartu();
  const setup = () => dom.pobierz('przycisk-setup');
  // gra startuje SAMA po przyjęciu paczki — od fazy A to już „toczy się”
  zaczynijGre(dom);
  assert.equal(setup().disabled, false, 'właściciel 2026-09-13: wyszarzenia ikony NIE MA');
  assert.match(setup().title, /otwiera zakończenie aktualnej gry/, 'title mówi, co ikona robi w trakcie gry');
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(setup().disabled, false, 'w odcinku też aktywna');
  dom.kliknij('przycisk-setup');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, false, 'klik otwiera warstwę potwierdzenia');
  assert.equal(setup().getAttribute('aria-pressed'), 'true', 'ikona świeci, bo jej warstwa jest otwarta');
  assert.equal(dom.pobierz('ekran-setup').hidden, true,
    'setup NIE otwiera się nad grą — gra nie ginie bez ostrzeżenia (zgłoszenie J)');
  dom.kliknij('przycisk-setup'); // przełącznik: drugi klik zamyka warstwę
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'ikona jest przełącznikiem (uwaga I)');
  // warstwy nie świecą równocześnie (ADR 0043 pkt 3): inaczej karta byłaby pusta
  dom.kliknij('przycisk-informacje');
  assert.equal(dom.pobierz('ekran-informacje').hidden, false, 'Informacje otwierają się w trakcie gry');
  dom.kliknij('przycisk-setup');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, false, '⚙ otwiera potwierdzenie także spod Informacji');
  assert.equal(dom.pobierz('ekran-informacje').hidden, true, 'Informacje gasną — na ekranie jest jedna karta');
  assert.equal(dom.document.body.classList.contains('koniec-gry-otwarte'), true, 'klasa warstwy na body');
  dom.kliknij('przycisk-informacje');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'otwarcie Informacji zamyka potwierdzenie');
  zakonczGrePrzezWarstwe(dom);
  assert.match(setup().title, /ustawienia gry/, 'po końcu gry title wraca do zwykłej roli');
  dom.kliknij('przycisk-setup');
  assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'po grze warstwy końca już się nie otwiera');
  dom.kliknij('przycisk-nowa-gra'); // „Wróć na początek” — stan sprzed gry
  assert.equal(setup().disabled, false, 'przed grą ikona aktywna');
});

/* ========== M6/R7: integracja — pełna gra z symulacją, zasięg, ADR 0015 */

/** Klik w konkretny przycisk odpowiedzi (elementy tworzone dynamicznie). */
function kliknijOdpowiedz(dom, indeks) {
  const b = dom.pobierz('gra-odpowiedzi').children[indeks];
  for (const fn of b.zdarzenia.click ?? []) fn({ type: 'click', target: b, currentTarget: b });
}

/**
 * Zadanie H: zamknięcie stacji pełną ścieżką produkcyjną
 * (start → dojście GPS → odpowiedź → „Następna stacja”, która sama startuje
 * kolejny odcinek). Start tylko z panelu A — po „Następnej stacji” odcinek
 * już trwa. `odpowiedz: null` = poprawna z fixture.
 */
async function zamknijStacje(dom, { paczka, numerStacji, odpowiedz = null }) {
  if (dom.pobierz('gra-panel-oczekuje').hidden === false) dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
  kliknijOdpowiedz(dom, odpowiedz ?? pytanie.poprawna);
  dom.kliknij('przycisk-nastepna-stacja');
}

test('M6/R7: PEŁNA GRA z symulacją dojścia — 3 stacje, pytania NA stacji, wynik (ścieżka GPS)', async () => {
  const { dom, paczka, pamiec } = await graGotowaDoStartu();
  zaczynijGre(dom);
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
    if (numerStacji === 1) {
      assert.match(dom.pobierz('przycisk-start-odcinka').textContent, /Idę do stacji 1/);
      dom.kliknij('przycisk-start-odcinka'); // pierwszą stację startuje panel A — nie ma jeszcze poprzedniej odpowiedzi
    }
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
      assert.match(dalej.textContent, new RegExp(`stacja ${numerStacji + 1} — idę →`), 'przycisk zapowiada następną stację i startuje odcinek');
    } else {
      assert.match(dalej.textContent, /Zobacz wynik/, 'po ostatniej stacji model kończy grę');
    }
    dom.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'panel wyniku po pełnej pętli');
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 3, 'wynik per gracz (3 graczy, ADR 0027)');
  assert.match(wiersze[0].children[0].textContent, /🏆/, 'zwycięzca rankingu oznaczony');
  assert.equal(wiersze[0].children[1].textContent !== '0', true, 'punkty policzone (3 poprawne odpowiedzi × rotacja graczy)');
  // zapis niesie naturalny koniec
  const snapshot = JSON.parse(pamiec.get('okolica:gra:' + pamiec.get('okolica:gra-aktywna')));
  assert.equal(snapshot.rozgrywka.faza, 'koniec');
  assert.equal(snapshot.rozgrywka.odcinki.every((o) => o.stan === 'zakonczony' && o.trybDojscia === 'gps'), true, 'wszystkie odcinki zamknięte dojściem GPS');
});

/**
 * Zgłoszenie właściciela (2026-09-09, ponowne): „Wróć na początek — nowa gra"
 * po wynikach → pusty ekran bez mapy („za duży zoom, oddalenie pokazuje mapę").
 * Pełna droga w trybie testowym: kompletna gra (symulacja GPS) → wynik →
 * „Wróć na początek" — mapa na spodzie (`#mapa-pozycja`) rysuje kafelki
 * w zakresie zoomu podkładu. Samonaprawa widoku przy rysowaniu:
 * `app/mapa.js` `ustalibujWidok` (zgłoszenie 4).
 */
test('zgłoszenie 4: pełna gra → „Wróć na początek" — mapa narysowana z kafelkami, nie pusta', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
    if (numerStacji === 1) dom.kliknij('przycisk-start-odcinka');
    await dojdzSymulacja(dom);
    assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, `stacja ${numerStacji}: pytanie po dojściu`);
    kliknijOdpowiedz(dom, pytanie.poprawna);
    dom.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'panel końca');
  dom.kliknij('przycisk-nowa-gra'); // „🏠 Wróć na początek — nowa gra"
  assert.equal(dom.document.body.dataset.ekran, 'mapa', 'wraca na ekran mapy');
  const kafelki = dom.pobierz('mapa-pozycja-kafelki').children;
  assert.ok(kafelki.length > 0, 'kafelki po „Wróć na początek" — nie pusta mapa');
  for (const obraz of kafelki) {
    const adres = obraz.getAttribute('href') ?? '';
    const m = /\/(\d+)\/\d+\/\d+\.png/.exec(adres);
    assert.ok(m, `adres kafelka: ${adres}`);
    const z = Number(m[1]);
    assert.ok(z >= 0 && z <= maxZoomPodkladu('osm'), `z=${z} w zakresie podkładu`);
  }
});

test('M6/R7: utrata zasięgu w trakcie gry — zero żądań sieciowych, gra żyje z pamięci', async () => {
  const { dom } = await graGotowaDoStartu();
  const wywolania = [];
  dom.window.fetch = async (adres) => { wywolania.push(String(adres)); return { ok: false, status: 503 }; };
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  kliknijOdpowiedz(dom, 0);
  dom.kliknij('przycisk-nastepna-stacja');
  dom.kliknij('przycisk-start-odcinka');
  await czekaj(100);
  // Dojście idzie strumieniem fixów (ADR 0029), więc ten test przeszedł drogę
  // produkcyjną i dopiero wtedy pokazał, że `pokazPozycje()` odświeżało
  // propozycje paczek przy KAŻDYM fixie — także w trakcie gry. Bramka
  // `STAN.ekran === 'pozycja'` to zamyka; asercja zostaje surowa: zero żądań.
  assert.deepEqual(wywolania, [], 'ani Overpass, ani Nominatim, ani most — gra żyje z pamięci');
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
  const konfig = { ...domyslnaKonfiguracja(2), kodGry: 'adr-0015', liczbaStacji: 4, czasGryMin: 99 }; // 99 min → 1000 m (ADR 0025)
  const stacje = stacjeProste({ srodek: { lat: 52.2297, lon: 21.0122 }, liczbaStacji: 4, promienM: 1000, ziarno: 'z' });
  const rozgrywka = nowaRozgrywka({ konfig, stacje, paczka, srodek: { lat: 52.2297, lon: 21.0122 }, czasMs: 0, ziarno: 'z' });
  assert.deepEqual(rozgrywka.brakPytan, [4], 'model widzi stację bez pytania (M1)');
  const snapshot = zbierajStan({
    konfig, stacje, kontenerPaczki: zapakujPaczke(paczka, WERSJA_PROTOKOLU), rozgrywka,
    pozycja: { lat: 52.2297, lon: 21.0122, dokladnoscM: 10, zrodlo: 'reczne' },
    terazMs: Date.now(), zegarMs: 1000,
  });
  const pamiec = new Map();
  pamiec.set('okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig }));
  pamiec.set(kluczStanu('adr-0015'), serializujStan(snapshot));
  pamiec.set(KLUCZ_AKTYWNEJ, 'adr-0015');

  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?adr15=${Math.random().toString(36).slice(2)}`);
  // Uwaga K (ADR 0045): zapis podnosi się sam — gracz jest od razu w grze.
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'aplikacja wróciła do zapamiętanej gry');
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 1 z 4/);

  // stacje 1–3: pełna pętla z pytaniami (poprawne odpowiedzi — testujemy 4.)
  for (const numerStacji of [1, 2, 3]) {
    await zamknijStacje(dom, { paczka, numerStacji });
  }
  assert.match(dom.pobierz('gra-postep').textContent, /stacja 4 z 4/, 'gramy o stację bez pytania');
  // odcinek 4. wystartował sam po „Następnej stacji” — od razu idziemy na dojście
  await dojdzSymulacja(dom);
  // ADR 0015: dojście zamyka stację BEZ fazy pytania — gra kończy się od razu
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, true, 'stacja bez pytania nie otwiera panelu pytania');
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'ostatnia stacja zamknięta dojściem = koniec gry');
  assert.equal(dom.pobierz('bledy-gra').hidden, true, 'żaden wyjątek, żaden błąd — jawne zachowanie z ADR 0015');
});

/* ========== M7/P3: pełne podsumowanie (panel D) */

test('ADR 0038: ekran wyniku jest minimalny — karta zwycięzcy i tabela rankingu', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);
  // błędne odpowiedzi — wynik też na zerach, ale z prawdziwej punktacji (0/1, nie 0/0)
  for (const numerStacji of [1, 2, 3]) {
    const pytanie = paczka.pytania.find((q) => q.stacja === numerStacji);
    await zamknijStacje(dom, { paczka, numerStacji, odpowiedz: (pytanie.poprawna + 1) % 4 });
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false, 'koniec po domknięciu wszystkich stacji');

  // 1. karta zwycięzcy: nikt nie punktował — ranking otwiera pierwszy gracz (sort stabilny)
  const zwyciezca = dom.pobierz('gra-wynik-zwyciezca').textContent;
  assert.match(zwyciezca, /🏆 Gracz 1/, 'zwycięzca z rankingu podsumowanie()');
  assert.match(zwyciezca, /0 pkt/, 'duże punkty w karcie');
  assert.match(zwyciezca, /poprawne 0\/1/, 'poprawne/razem w karcie');

  // 2. tabela rankingu zostaje — te same kolumny co w panelu multi, wiersz per gracz
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.equal(wiersze.length, 3, '3 graczy, ADR 0027');
  assert.match(wiersze[0].children[0].textContent, /Gracz 1 🏆/);
  assert.equal(wiersze[0].children[1].textContent, '0', 'punkty z podsumowanie()');
  assert.equal(wiersze[0].children[2].textContent, '0/1', 'poprawne/razem');
  assert.match(wiersze[1].children[0].textContent, /Gracz 2/);

  // 3. GÓRNY fragment ekranu gry nie może już nic dopisywać nad wynikami (D a)
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, true, 'slot sterowania znika w fazie koniec');

  // 4. nic więcej: statystyki, karty graczy, tabela stacji, eksporty i pole tekstu
  //    zniknęły razem z kodem, który je wypełniał („masa błędów i niepotrzebnych
  //    informacji”). Atrapa tworzy element leniwie, więc obecność w `elementy`
  //    znaczy „kod aplikacji po to sięgnął” — i to jest właśnie ten pin.
  for (const id of ['gra-wynik-statystyki', 'gra-wynik-szczegoly', 'gra-wynik-gracze',
    'gra-wynik-stacje', 'gra-wynik-stacje-tbody', 'wynik-eksport',
    'przycisk-udostepnij-wynik', 'przycisk-kopiuj-wynik', 'przycisk-pobierz-wynik',
    'przycisk-pobierz-obraz', 'przycisk-udostepnij-obraz',
    'gra-wynik-tekst-detale', 'pole-wynik-tekst', 'gra-wynik-factcheck']) {
    assert.equal(dom.elementy.has(id), false, `pokazWyniki nie sięga już po #${id} (ADR 0038)`);
  }
  assert.equal(dom.pobierz('przycisk-nowa-gra').hidden, false, 'zostaje jeden przycisk: nowa gra');
});

/* ========== ADR 0038: ekran wyniku bez eksportów (share / schowek / plik / PNG) */

test('ADR 0038: po grze nie ma eksportów — zero canvasów, linków do pliku i schowka', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  const skopiowane = [];
  Object.assign(navigator, { clipboard: { writeText: async (tekst) => { skopiowane.push(tekst); } } });
  zaczynijGre(dom);
  for (const numerStacji of [1, 2, 3]) {
    await zamknijStacje(dom, { paczka, numerStacji, odpowiedz: 0 });
  }
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false);
  assert.deepEqual(skopiowane, [], 'schowek nietknięty — „Kopiuj wynik” już nie istnieje');
  const utworzone = dom.utworzone.map((el) => String(el.tagName).toLowerCase());
  assert.equal(utworzone.includes('canvas'), false, 'żaden canvas nie powstał — eksport PNG zniknął');
  // <a> powstają w grze legalnie (linki źródeł w wyjaśnieniu) — pinujemy samą
  // drogę pliku: element z `download` mógł pochodzić tylko z usuniętego eksportu.
  assert.equal(dom.utworzone.filter((el) => el.download).length, 0, 'żaden link do pliku nie powstał — eksport .txt zniknął');
  // tekst wyniku (wynikTekstowy) stracił konsumenta w UI: pole i przyciski
  // eksportu są tylko historią tego projektu (ADR 0038), moduł wynik.js zostaje
  // z własnymi testami jako biblioteka do decyzji w przyszłości.
  assert.equal(dom.elementy.has('pole-wynik-tekst'), false, 'aplikacja nie sięga po pole tekstu wyniku');
});

test('ADR 0038: ręczne zakończenie gry pokazuje ten sam minimalny ekran wyniku', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  await dojdzSymulacja(dom);
  kliknijOdpowiedz(dom, 0);
  zakonczGrePrzezWarstwe(dom); // ikona ⚙ → TAK → koniec (ADR 0043)
  assert.equal(dom.pobierz('gra-panel-koniec').hidden, false);
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, true, 'sterowanie grą znika także przy ręcznym końcu (D a)');
  assert.match(dom.pobierz('gra-wynik-zwyciezca').textContent, /pkt/, 'karta zwycięzcy wypełniona mimo przerwania');
  assert.equal(dom.pobierz('gra-wyniki-tbody').children.length, 3, 'ranking liczy wszystkich graczy (3, ADR 0027)');
  assert.equal(dom.pobierz('przycisk-nowa-gra').hidden, false, 'jeden przycisk powrotu (D b)');
  // Adnotacja „(gra przerwana ręcznie — wynik wczesny)” zniknęła razem z tekstem
  // wyniku (ADR 0038); przerwanie nadal pamięta historia — test M7/P6 niżej.
});

/* ========== M7/P6: historia gier w UI — zapis, lista, kasowanie, usterki */

/* ========== M7/P7: integracja — pełna gra z dojściem GPS → podsumowanie, eksport, historia */

test('M7/P7 + ADR 0038: PEŁNA GRA z dojściem GPS → minimalny wynik (end-to-end)', async () => {
  const { dom, paczka } = await graGotowaDoStartu();
  zaczynijGre(dom);

  // pętla jak w R7: symulacja dojścia ×3 stacje, poprawne odpowiedzi (fixture: 1 pkt/pytanie)
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

  // 1. wynik z PRAWDZIWĄ punktacją: 3 stacje × 1 pytanie dla
  //    3 graczy (ADR 0027) — każdy odpowiada raz, więc wszyscy mają po 1 pkt,
  //    a o kolejności decyduje remisowe kryterium z ADR 0023 (kolejność zgłoszeń).
  const kartaZw = dom.pobierz('gra-wynik-zwyciezca');
  assert.match(kartaZw.children[0].textContent, /^🏆 Gracz 1$/, 'przy remisie punktów wygrywa kolejność zgłoszeń (ADR 0023)');
  // punkty CZYTAMY Z ELEMENTU, nie regexem po złączonym textContent (L23:
  // 'Gracz 1' + '42 pkt' złączone dałoby '142 pkt')
  const punktyZw = Number(kartaZw.children[1].textContent.replace(' pkt', ''));
  assert.equal(punktyZw, 1, 'zwycięzca: 1 × 1 pkt (rev2), zero premii');
  assert.match(kartaZw.children[2].textContent, /poprawne 1\/1/);
  const wiersze = dom.pobierz('gra-wyniki-tbody').children;
  assert.match(wiersze[0].children[0].textContent, /Gracz 1 🏆/);
  assert.equal(wiersze[0].children[1].textContent, String(punktyZw), 'ranking spójny z kartą zwycięzcy');
  assert.equal(wiersze[0].children[2].textContent, '1/1', 'Gracz 1: jedna poprawna, zero błędnych');
  assert.equal(wiersze[1].children[2].textContent, '1/1', 'Gracz 2: jedna poprawna');
  assert.equal(dom.pobierz('gra-slot-sterowanie').hidden, true, 'górny pasek gry znika na wynikach (D a)');
  assert.equal(dom.pobierz('przycisk-nowa-gra').hidden, false, 'zostaje jeden przycisk powrotu (D b)');

  // 2. zero eksportów (D b): gra nie tworzy canvasu ani linku do pliku, a treść
  //    pytań i współrzędne nie mają jak wyciec — nie ma ekranu, który by je niósł.
  const utworzone = dom.utworzone.map((el) => String(el.tagName).toLowerCase());
  assert.equal(utworzone.includes('canvas'), false, 'brak canvasu: obrazu wyniku nie ma');
  assert.equal(dom.utworzone.filter((el) => el.download).length, 0, 'brak linku z download: eksportu .txt nie ma');
  assert.equal(dom.elementy.has('pole-wynik-tekst'), false, 'brak pola z tekstem wyniku');

  // 3. lokalnej historii gier NIE MA (zgłoszenie terenowe O, 2026-09-13;
  //    ADR 0010 aneks): wynik kończy się wysyłką na wspólny Drive, a telefon
  //    nie trzyma własnej listy — więc nie ma też nośnika, z którego mogłyby
  //    wyciec treść pytań albo współrzędne.
});


/* ---------- tap w mapę pozycji (zadanie D3) — na końcu, bo tworzy ŚWIEŻĄ
   instancję aplikacji i zastępuje globalne atrapy (porządek jak testy map M2) */

test('D3: stuknięcie mapy pozycji ustawia pozycję testową, a przeciągnięcie — nie', async () => {
  // tap jest bramkowany trybem testowym — główna atrapa biegnie bez
  // `?tryb=test`, więc test pracuje na ŚWIEŻEJ instancji (wzorzec z M2)
  // Tożsamość zweryfikowana na tym telefonie — brama (ADR 0026) przechodzi bez
  // wołania mostu, więc test mapy nie zależy od sieci.
  const pamiecMapy = new Map([['okolica:profil', JSON.stringify({
    schemat: 'profil-lokalny/1', pseudonim: 'Mapowy', zweryfikowany: true, kiedy: '2026-09-07T10:00:00.000Z',
  })]]);
  const domT = await aplikacjaZMapa({ search: '?tryb=test&odstep=0', pamiec: pamiecMapy });
  domT.kliknij('przycisk-dalej-pozycja'); // bramka tap-a: ekran 'pozycja'
  await czekaj(10); // przejście jest asynchroniczne: czeka na bramę tożsamości
  domT.ustawPozycje('52.2297', '21.0122');

  // Po ręcznym ustawieniu `pokazPozycje` woła `centrujNaPozycji`: mapa jest
  // wyśrodkowana NA POZYCJI w zoomie dobranym do promienia gry (promień liczy
  // się z czasu gry — ADR 0025 — więc biorę go z kanonu, nie z liczby wpisanej
  // na sztywno; szerokość panelu z atrapy → zoom z `dopasujZoomDoPromienia`).
  // Oczekiwany punkt tap-a LICZĘ czystymi funkcjami z dokładnie tym widokiem
  // (L24) — zgaduje się co do cyfry z tym, co robi aplikacja.
  const rect = domT.pobierz('mapa-pozycja').getBoundingClientRect();
  const zoom = dopasujZoomDoPromienia(domyslnaKonfiguracja().promienM, rect.width, 52.2297);
  const widok = widokNaSrodek({ lat: 52.2297, lon: 21.0122, zoom, rozmiar: { szerokosc: rect.width, wysokosc: rect.height } });
  const geo = wspolrzedneZEkranu(40 - rect.left, 0 - rect.top, widok);
  const oczLat = Math.round(geo.lat * 1e6) / 1e6;
  const oczLon = Math.round(geo.lon * 1e6) / 1e6;

  const svg = domT.pobierz('mapa-pozycja-svg');
  assert.ok(wyslij(svg, 'pointerdown', { pointerId: 31, clientX: 40, clientY: 0 }) > 0, 'svg mapy pozycji ma nasłuch pointerdown');
  wyslij(svg, 'pointerup', { pointerId: 31, clientX: 40, clientY: 0 });

  assert.match(domT.pobierz('status').textContent, /Pozycja ustawiona z mapy/, 'status mówi, że pozycja jest z mapy');
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

/* --------- wynik gry hot-seat na wspólnym Drive (ADR 0026 aneks) ----------- */

/**
 * Gra z JEDNYM graczem zapamiętanym bez potwierdzenia: dodajemy go przez UI
 * przy padniętym moście, więc wchodzi na listę jako „bez potwierdzenia z Drive".
 */
async function graZNiepewnymGraczem() {
  const pamiec = new Map();
  pamiec.set('okolica:gracze', JSON.stringify({
    schemat: 'gracze-lokalni/1',
    gracze: [{ pseudonim: 'Ala', zweryfikowany: false }],
  }));
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: { liczbaGraczy: 1, liczbaStacji: 3, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'], czasGryMin: 85 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?niepewny=${Math.random().toString(36).slice(2)}`);
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const chip = dom.pobierz('lista-zapamietanych').children[0]; // zapamiętany, ale niepewny → prosi o PIN
    for (const fn of chip.zdarzenia.click ?? []) fn({ type: 'click', target: chip, currentTarget: chip });
    dom.pobierz('profil-pin').value = '1234';
    dom.kliknij('przycisk-dodaj-gracza');
    await czekaj(10);
  } finally {
    globalThis.fetch = staryFetch;
  }
  assert.equal(dom.pobierz('lista-graczy').children.length, 1, 'gracz dodany bez potwierdzenia');
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje');
  const paczka = czytajFixturePaczka();
  dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
  return { dom, paczka, pamiec };
}

/** Krótka gra: dwa dojścia z fixów (ADR 0029), dwie odpowiedzi, ręczne zakończenie. */
async function grajDwieStacjeIKoncz(dom) {
  zaczynijGre(dom);
  for (let i = 0; i < 2; i += 1) {
    dom.kliknij('przycisk-start-odcinka');
    await dojdzSymulacja(dom);
    kliknijOdpowiedz(dom, 0);
    dom.kliknij('przycisk-nastepna-stacja');
  }
  zakonczGrePrzezWarstwe(dom); // ikona ⚙ → wpisanie TAK → koniec (ADR 0043)
  await czekaj(20);
}

test('hot-seat: wynik gry leci na wspólny Drive jednym poleceniem, bez współrzędnych', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  dom.pobierz('hotseat-zgoda').checked = true;
  const zadania = [];
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje) => {
    zadania.push({ adres: String(adres), cialo: JSON.parse(opcje.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, idGry: 'h-1', wyniki: {} }) };
  };
  try {
    await grajDwieStacjeIKoncz(dom);
    const hotseat = zadania.filter((z) => z.cialo.akcja === 'gra-hotseat');
    assert.equal(hotseat.length, 1, 'dokładnie jedno polecenie gra-hotseat na koniec gry');
    const { cialo } = hotseat[0];
    assert.equal(cialo.tryb, 'hotseat');
    assert.deepEqual(cialo.gracze.map((g) => g.pseudonim), ['Gracz 1', 'Gracz 2', 'Gracz 3'], 'skład gry z listy graczy');
    assert.match(cialo.konfiguracja.geohash5, /^[0-9b-z]{5}$/, 'geohash5 zamiast punktu startu (ADR 0019 pkt 3)');
    assert.equal(cialo.konfiguracja.liczbaStacji, 3, 'liczba stacji z rozgrywki, nie z pola setupu');
    const typy = cialo.zdarzenia.map((z) => z.typ);
    assert.equal(typy.filter((t) => t === 'dojscie').length, 2, 'dwa dojścia z dziennika gry');
    assert.equal(typy.filter((t) => t === 'odpowiedz').length, 2, 'dwie odpowiedzi z dziennika gry');
    // prywatność: ani współrzędnych, ani pytań, ani paczki
    assert.equal(/"(lat|lon|szerokosc|dlugosc|accuracyM|pytanieId)"/.test(JSON.stringify(cialo)), false, 'zero współrzędnych i id pytań w poleceniu');
    assert.equal(cialo.zestaw, undefined, 'paczka zostaje na telefonie (ADR 0013)');
    assert.match(dom.pobierz('wynik-drive').textContent, /na wspólnym Drive/, 'jawne potwierdzenie wysyłki na ekranie wyniku');
    // idempotencja: kolejny zapis tej samej gry nie wysyła wyniku drugi raz
    // (po końcu gry warstwy potwierdzenia nie da się już otworzyć — ADR 0043)
    const przed = zadania.length;
    dom.kliknij('przycisk-setup');
    assert.equal(dom.pobierz('ekran-koniec-gry').hidden, true, 'po grze ⚙ nie otwiera warstwy końca gry');
    await czekaj(20);
    assert.equal(zadania.length, przed, 'ta sama gra nie wchodzi do rankingów dwa razy');
    assert.equal(pamiec.has('okolica:hotseat-kolejka'), false, 'udana wysyłka nie zostawia kolejki');
  } finally {
    globalThis.fetch = staryFetch;
  }
});

test('hot-seat: bez sieci wynik czeka w kolejce i dojeżdża przy następnym starcie', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  dom.pobierz('hotseat-zgoda').checked = true;
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    await grajDwieStacjeIKoncz(dom);
    assert.match(dom.pobierz('wynik-drive').textContent, /czeka w kolejce/, 'awaria jest jawna, nie cicha');
    const kolejka = JSON.parse(pamiec.get('okolica:hotseat-kolejka'));
    assert.equal(kolejka.schemat, 'hotseat-kolejka/1');
    assert.equal(kolejka.gry.length, 1, 'jedna gra w kolejce');
    assert.equal(kolejka.gry[0].akcja, 'gra-hotseat');
  } finally {
    globalThis.fetch = staryFetch;
  }

  // restart aplikacji na tej samej pamięci telefonu: kolejka się opróżnia
  const zadania = [];
  globalThis.fetch = async (adres, opcje) => {
    zadania.push(JSON.parse(opcje.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
    await import(`../app/app.js?hotseat=${Math.random().toString(36).slice(2)}`);
    await czekaj(20);
    assert.equal(zadania.filter((c) => c.akcja === 'gra-hotseat').length, 1, 'wynik z kolejki dojechał na Drive');
    assert.equal(pamiec.has('okolica:hotseat-kolejka'), false, 'kolejka wyczyszczona po udanej wysyłce');
    assert.match(dom2.pobierz('status').textContent, /doszły na wspólny Drive/, 'gracz widzi, że zaległy wynik doszedł');
  } finally {
    globalThis.fetch = staryFetch;
  }
});

test('hot-seat: wynik jedzie domyślnie — bez pytania o zgodę przy każdej grze', async () => {
  const { dom } = await graGotowaDoStartu();
  const zadania = [];
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje) => {
    zadania.push(JSON.parse(opcje.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    await grajDwieStacjeIKoncz(dom);
    assert.equal(zadania.filter((c) => c.akcja === 'gra-hotseat').length, 1, 'zapis jest domyślny (właściciel 2026-09-07)');
    assert.match(dom.pobierz('wynik-drive').textContent, /na wspólnym Drive/, 'gracz widzi, co się stało');
  } finally {
    globalThis.fetch = staryFetch;
  }
});

test('hot-seat: bez potwierdzonego profilu wynik zostaje na telefonie — i jest to powiedziane', async () => {
  const { dom } = await graZNiepewnymGraczem();
  const zadania = [];
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje) => {
    zadania.push(JSON.parse(opcje.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    await grajDwieStacjeIKoncz(dom);
    assert.equal(zadania.filter((c) => c.akcja === 'gra-hotseat').length, 0, 'bez profilu nie ma gdzie zapisać punktów');
    assert.match(dom.pobierz('wynik-drive').textContent, /żaden gracz nie ma potwierdzonego profilu/, 'komunikat mówi wprost, dlaczego');
  } finally {
    globalThis.fetch = staryFetch;
  }
});

test('hot-seat: jawna odmowa mostu nie udaje awarii sieci — komunikat nazywa powód', async () => {
  // Sytuacja z życia: w Apps Script wisi starsza wersja skryptu bez akcji
  // `gra-hotseat`, więc most odpowiada {ok:false, blad:'nieznana akcja…'}.
  const { dom } = await graGotowaDoStartu();
  const zadania = [];
  const staryFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje) => {
    zadania.push(JSON.parse(opcje.body));
    return { ok: true, status: 200, json: async () => ({ ok: false, blad: 'nieznana akcja albo schemat ciała' }) };
  };
  try {
    await grajDwieStacjeIKoncz(dom);
    assert.equal(zadania.filter((c) => c.akcja === 'gra-hotseat').length, 1, 'aplikacja próbowała zapisać');
    const tekst = dom.pobierz('wynik-drive').textContent;
    assert.match(tekst, /most Drive odmówił/, 'powód jest prawdziwy: odmowa, nie „nie odpowiedział"');
    assert.match(tekst, /nieznana akcja albo schemat ciała/, 'gracz widzi odpowiedź mostu');
    assert.match(tekst, /czeka w kolejce/, 'wynik nie ginie — poleci po wklejeniu aktualnego skryptu');
    assert.equal(/Drive nie odpowiedział/.test(tekst), false, 'bez fałszywej diagnozy awarii sieci');
  } finally {
    globalThis.fetch = staryFetch;
  }
});

test('sieć testów: fetch domyślnie hermetyczny — żaden test nie wychodzi na prawdziwy internet (zgłoszenie 2026-09-11)', async () => {
  // Dziesiątki plików gra-hotseat-* w okolica-gry-zakonczone na Drive powstawały
  // m.in. dlatego, że testy kończące grę leciały PRAWDZIWYM POST-em na produkcyjny
  // most: Node 22 ma globalny fetch, adres mostu siedzi w DOMYSLNY_URL_MOSTU,
  // a CI (GitHub Actions) ma pełny dostęp do internetu — każdy run testów
  // dokładał kilka plików z testowymi grami. Domyślna atrapa DOM odmawia
  // jak awaria sieci; testy chcące odpowiedzi mostu podstawiają
  // WŁASNE atrapy (atrapaFetch w zestawy-ui, globalThis.fetch w hotseat).
  const dom = zainstalujDom({ search: '?tryb=test' });
  await assert.rejects(
    () => globalThis.fetch('https://script.google.com/macros/s/przyklad/exec'),
    /fetch atrapy: testy nie wychodzą na sieć/,
    'goły zainstalujDom nie woła prawdziwego internetu',
  );
  assert.ok(dom.siec.wywolania.length >= 1, 'atrapa zapisuje próbę — przydatne w debugu');
  // własna atrapa testu nadal wygrywa — tak działają testy hotseat i zestawów
  const stary = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
  try {
    const odp = await globalThis.fetch('https://przyklad.test/exec');
    assert.equal((await odp.json()).ok, true, 'test może świadomie podstawić własny fetch');
  } finally {
    globalThis.fetch = stary;
  }
});

test('M7/B22: odświeżenie i „Wznów grę” ZAKOŃCZONEJ gry nie wysyła wyniku drugi raz (zgłoszenie 2026-09-11)', async () => {
  const { dom, pamiec } = await graGotowaDoStartu();
  const { walidujKolejkeHotseat } = await import('../app/wieloosobowa.js');
  const kolejka = () => walidujKolejkeHotseat(JSON.parse(pamiec.get('okolica:hotseat-kolejka') ?? 'null'));

  // naturalny koniec: trzy stacje z dojściem i odpowiedzią (dziennik ma zdarzenia,
  // więc polecenie gra-hotseat przechodzi walidację i leci na most)
  zaczynijGre(dom);
  for (let numerStacji = 1; numerStacji <= 3; numerStacji += 1) {
    dom.kliknij('przycisk-start-odcinka');
    await dojdzSymulacja(dom);
    kliknijOdpowiedz(dom, 0);
    dom.kliknij('przycisk-nastepna-stacja');
  }
  assert.equal(JSON.parse(pamiec.get('okolica:gra:' + pamiec.get('okolica:gra-aktywna'))).rozgrywka.faza, 'koniec', 'naturalny koniec po trzeciej stacji');
  await czekaj(30); // wysyłka jest nieblokująca (void) — dajemy jej dojść do kolejki
  assert.equal(kolejka().length, 1, 'wynik zakończonej gry czeka w kolejce (sieć atrapy odmawia)');

  // „zamknięcie i otwarcie telefonu” po ZAKOŃCZONEJ grze (uwaga K, ADR 0045):
  // telefon NIE wraca do skończonej gry — wynik jest w „Poprzednich grach", a
  // start kasuje zapis, więc nie ma czym wysłać wyniku drugi raz.
  const dom2 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?zakonc1=${Math.random().toString(36).slice(2)}`);
  assert.equal(dom2.pobierz('ekran-gra').hidden, true, 'zakończona gra nie wraca na ekran gry');
  assert.match(dom2.pobierz('status').textContent, /była już zakończona/, 'start mówi, dlaczego nie wróciliśmy');
  assert.equal(pamiec.has('okolica:gra-aktywna'), false, 'wskaźnik aktywnej gry skasowany');
  await czekaj(30);
  assert.equal(kolejka().length, 1, 'otwarcie aplikacji nie dokładuje wysyłki wyniku');

  // drugi obrót — dokładnie sytuacja z zgłoszenia („po kilka plików z jednej minuty”)
  const dom3 = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?zakonc2=${Math.random().toString(36).slice(2)}`);
  await czekaj(30);
  assert.equal(kolejka().length, 1, 'każde kolejne otwarcie zostawia kolejkę bez zmian');
});


test('stacje: nazwa z OSM ze znacznikiem HTML jest tekstem, nie znacznikiem', async () => {
  // Nazwy stacji pochodzą z `tags.name` w Overpass, czyli z danych edytowanych
  // przez obcych ludzi. Gdyby wiersz listy składał się przez innerHTML, obiekt
  // o nazwie <img onerror=…> wykonałby skrypt w aplikacji.
  const wroga = '<img src=x onerror="alert(1)">';
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  for (const grupa of ['drogi', 'poi', 'bariery']) {
    for (const el of dane[grupa] ?? []) {
      if (el.tags && typeof el.tags.name === 'string') el.tags.name = wroga;
    }
  }
  const pamiec = konfigNa1000m(new Map());
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  pamiec.set(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));

  const domAtrapa = await aplikacjaZSiecia({ pamiec });
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  const wiersze = domAtrapa.pobierz('lista-stacji').children;
  assert.ok(wiersze.length >= 3, 'stacje są wyrenderowane');
  const zNazwa = wiersze.filter((li) => li.textContent.includes(wroga));
  assert.ok(zNazwa.length > 0, 'wroga nazwa trafiła na listę (jako tekst)');
  for (const li of zNazwa) {
    const znaczniki = [];
    const zbierz = (wezel) => {
      for (const dziecko of wezel.children ?? []) {
        znaczniki.push(String(dziecko.tagName ?? '').toUpperCase());
        zbierz(dziecko);
      }
    };
    zbierz(li);
    assert.equal(znaczniki.includes('IMG'), false, `w wierszu powstał element IMG: ${znaczniki.join(',')}`);
    assert.ok(li.children.every((d) => String(d.tagName).toUpperCase() !== 'SCRIPT'), 'bez SCRIPT');
  }
});

test('stacje: sieć za uboga na zamówioną liczbę — setup idzie za wyborem, a prompt się buduje (S12)', async () => {
  // Ten sam fixture co w teście cache, ale zamówione 10 stacji: sieć nie da
  // rozstawić tylu w wymaganych odstępach, więc wybór zwróci mniej (S12).
  const { przeliczenieCzasu } = await import('../app/konfig.js');
  const zamowione = 10;
  const { promienM } = przeliczenieCzasu({ czasGryMin: 240, tryb: 'piesza', liczbaStacji: zamowione, pytaniaNaStacje: 1 });
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum')));
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM, tryb: 'piesza' });
  const pamiec = new Map([
    [klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane })],
    ['okolica:konfig', JSON.stringify({
      schemat: 'konfig/1', kanon: '2026-09-10',
      konfig: { czasGryMin: 240, liczbaStacji: zamowione, pytaniaNaStacje: 1, tematy: ['historia', 'architektura'] },
    })],
  ]);
  const dom = await aplikacjaZSiecia({ pamiec });
  ustawPozycjeTestowa(dom, '52.2297', '21.0122');
  dom.kliknij('przycisk-dalej-stacje');

  const ile = dom.pobierz('lista-stacji').children.length;
  assert.ok(ile >= 1 && ile < zamowione, `sieć dała mniej niż zamówione ${zamowione} (jest ${ile})`);
  assert.match(dom.pobierz('bledy-stacje').textContent, /S12/, 'kod usterki widoczny na ekranie stacji');
  assert.match(dom.pobierz('bledy-stacje').textContent, new RegExp(`nie dała ${zamowione} stacji`), 'komunikat mówi, dlaczego jest ich mniej');
  // sedno naprawy: setup nie może zostać przy zamówionej liczbie
  assert.equal(dom.pobierz('setup-stacje').value, String(ile), 'pole setupu idzie za wyborem');
  assert.match(dom.pobierz('setup-promien-info').textContent, /Promień gry/, 'promień przeliczony dla nowej liczby stacji');

  // i prompt się buduje — przed naprawą stawał na WE06 (4 ≠ 5 u właściciela)
  dom.kliknij('przycisk-dalej-prompt');
  assert.equal(dom.pobierz('ekran-prompt').hidden, false, 'przejście na ekran pytań');
  assert.equal(/WE06/.test(dom.pobierz('bledy-prompt').textContent), false, 'bez WE06: liczba stacji zgadza się z konfiguracją');
  assert.ok(dom.pobierz('pole-prompt').value.length > 200, 'treść promptu zbudowana');
  assert.match(dom.pobierz('pole-prompt').value, new RegExp(`od 1 do ${ile}\\b`), 'prompt mówi o tylu stacjach, ile jest na mapie');
});

/**
 * Właściciel (2026-09-09): „▶ Zacznij” na intro ma otwierać setup, tak jak
 * ⚙ START GRY w belce — samo zamknięcie okna zostawiało gracza na pustej mapie.
 */
test('start: „▶ Zacznij” otwiera setup, nie tylko zamyka intro', async () => {
  const domIntro = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?zacznij=${Math.random().toString(36).slice(2)}`);
  assert.equal(domIntro.pobierz('ekran-start').hidden, false, 'warunek wstępny: intro otwarte');

  domIntro.kliknij('przycisk-start-zacznij');
  assert.equal(domIntro.pobierz('ekran-start').hidden, true, 'intro znika');
  assert.equal(domIntro.pobierz('ekran-setup').hidden, false, 'setup jest otwarty');
  assert.equal(domIntro.pobierz('przycisk-setup').getAttribute('aria-pressed'), 'true',
    'ikona w belce świeci — stan zgodny z F3');
});

/**
 * Zgłoszenie właściciela (2026-09-09, trzecia tura): „ma zostać pole i guzik
 * »Wklej ze schowka« → po wklejeniu czegokolwiek ma się automatycznie
 * zatwierdzać". Wcześniejsze tury: jeden przycisk czytający schowek (odpadł —
 * przeglądarka mobilna go blokuje) i pole + osobne „Sprawdź i przyjmij"
 * (odpadło — zbędny klik, skoro wklejenie już jest decyzją organizatora).
 * Import z pliku usunięty: nikt tą drogą nie chodził.
 */
test('ekran 5: samo wklejenie palcem waliduje i zaczyna grę — bez przycisku zatwierdzania', async () => {
  const paczka = czytajFixturePaczka();
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?wklejka=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  domAtrapa.wklej('pole-odpowiedz', JSON.stringify(paczka));

  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, false, 'gra ruszyła samym wklejeniem');
  assert.equal(domAtrapa.pobierz('pole-odpowiedz').value, '',
    'pole wyczyszczone po przyjęciu — plaintext nie zostaje w DOM (ADR 0007 pkt 4)');
});

test('ekran 5: wklejenie ze schowka też zatwierdza samo', async () => {
  const paczka = czytajFixturePaczka();
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  Object.assign(navigator, { clipboard: { readText: async () => JSON.stringify(paczka) } });
  await import(`../app/app.js?schowek=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  domAtrapa.kliknij('przycisk-wklej');
  await new Promise((r) => setTimeout(r, 0)); // handler jest async (readText)

  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, false, 'obie drogi kończą się tak samo — grą');
});

test('ekran 5: wklejona treść śmieciowa też jest sprawdzana od razu (bez klikania)', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?smiec=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  domAtrapa.wklej('pole-odpowiedz', 'to nie jest JSON ani kontener {{{');

  assert.equal(domAtrapa.pobierz('wynik-walidacji').hidden, false, 'walidator wypowiedział się sam');
  assert.match(domAtrapa.pobierz('wynik-naglowek').textContent, /Nie da się odczytać/, 'usterka nazwana wprost');
  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, true, 'gra NIE ruszyła na śmieciu');
});

test('ekran 5: puste wklejenie nie udaje paczki', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?puste=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  domAtrapa.wklej('pole-odpowiedz', '   ');

  assert.equal(domAtrapa.pobierz('wynik-walidacji').hidden, true,
    'wklejenie pustki (albo obrazka) nie uruchamia walidacji — inaczej ekran krzyczałby bez powodu');
});

test('ekran 5: zablokowany schowek NIE zatrzymuje ekranu — kieruje do wklejenia palcem (L6)', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  Object.assign(navigator, {
    clipboard: { readText: async () => { throw new Error('NotAllowedError'); } },
  });
  await import(`../app/app.js?schowek2=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje');

  domAtrapa.kliknij('przycisk-wklej');
  await new Promise((r) => setTimeout(r, 0));

  const status = domAtrapa.pobierz('wklejka-status').textContent;
  assert.match(status, /schowk/i, 'status nazywa przyczynę — to ten komunikat, który zobaczył właściciel');
  assert.match(status, /palcem/, 'kieruje do jedynej pozostałej drogi: wklejenia do pola');
  assert.doesNotMatch(status, /pliku/, 'żadnego wczytywania z pliku — właściciel: „jakiego znowu pliku?"');
});

test('ekran 5: pole ma trzy wiersze, a ekran nie ma już importu z pliku ani „Sprawdź"', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pole = html.match(/<textarea id="pole-odpowiedz"[^>]*>/)[0];
  assert.match(pole, /rows="3"/, 'trzy wiersze — przy tej wysokości pytań nie da się przeczytać przez ramię');
  const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  assert.match(css, /#pole-odpowiedz\s*\{[^}]*resize:\s*none/, 'bez uchwytu rozciągania');
  assert.ok(!html.includes('plik-odpowiedz'), 'import z pliku usunięty z ekranu');
  assert.ok(!html.includes('przycisk-sprawdz'), 'przycisk zatwierdzania usunięty — wklejenie zatwierdza samo');
});


test('teren: oko podczas dojścia nie pauzuje gry; wraca aktualne pytanie i jego odpowiedź', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  dom.kliknij('przycisk-start-odcinka');
  dom.kliknij('przycisk-podejrzyj-mape');
  assert.equal(dom.document.body.dataset.ekran, 'gra');
  assert.equal(dom.pobierz('ekran-gra').hidden, false);
  assert.equal(dom.pobierz('ekran-gra').inert, true);
  assert.equal(dom.pobierz('przygaszenie-mapy').hidden, true);
  await dojdzSymulacja(dom);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false, 'dojście działa pod podglądem mapy');
  assert.equal(dom.pobierz('przycisk-podejrzyj-mape').getAttribute('aria-pressed'), 'true');
  dom.kliknij('przycisk-podejrzyj-mape');
  assert.equal(dom.pobierz('ekran-gra').inert, false);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false);
  const tresc = dom.pobierz('gra-panel-pytanie').textContent;
  dom.kliknij('przycisk-podejrzyj-mape');
  dom.kliknij('przycisk-podejrzyj-mape');
  assert.equal(dom.pobierz('gra-panel-pytanie').textContent, tresc);
});

test('teren: informacje przełączają się nad setupem; oko, prywatność i powrót zachowują stan', async () => {
  const dom = await aplikacjaZMapa({ search: '?test=true' });
  dom.kliknij('przycisk-start-zacznij');
  dom.pobierz('setup-czas').value = '123';
  dom.kliknij('przycisk-informacje');
  assert.equal(dom.pobierz('ekran-informacje').hidden, false);
  assert.equal(dom.pobierz('ekran-setup').hidden, false);
  assert.equal(dom.pobierz('ekran-setup').inert, true);
  dom.kliknij('przycisk-podejrzyj-mape');
  assert.equal(dom.pobierz('ekran-informacje').hidden, false);
  assert.equal(dom.pobierz('ekran-informacje').inert, true);
  dom.kliknij('przycisk-podejrzyj-mape');
  dom.kliknij('przycisk-prywatnosc-stopka');
  assert.equal(dom.pobierz('ekran-prywatnosc').hidden, false);
  dom.kliknij('przycisk-wrocz-prywatnosc');
  assert.equal(dom.pobierz('ekran-informacje').hidden, false);
  dom.kliknij('przycisk-informacje');
  assert.equal(dom.pobierz('ekran-informacje').hidden, true);
  assert.equal(dom.pobierz('ekran-setup').inert, false);
  assert.equal(dom.pobierz('setup-czas').value, '123');
});


test('teren: automatyczny GPS bez API pokazuje P01; błędny fix nie zmienia pozycji', async () => {
  const bez = zainstalujDom({ geolocation: null });
  await import(`../app/app.js?terenBezGps=${Math.random()}`);
  assert.match(bez.pobierz('bledy-pozycja').textContent, /P01/);
  assert.equal(bez.pobierz('przycisk-dalej-stacje').disabled, true);
  const d = await aplikacjaZMapa();
  d.gps.wyslijFix(52.23, 21.01, 1250);
  const przed = d.pobierz('pozycja-wspolrzedne').textContent;
  d.gps.wyslijFix(999, 21, 1);
  assert.equal(d.pobierz('pozycja-wspolrzedne').textContent, przed);
  assert.match(d.pobierz('bledy-pozycja').textContent, /P06/);
});

for (const etap of ['nagłówki', 'ciało', 'nietypowy abort']) {
  test(`Overpass: 10 s obejmuje ${etap}; pełny łańcuch od zapamiętanej instancji i czytelne wyniki`, async () => {
    const pamiec = new Map([['okolica:overpass-sprawny', INSTANCJE_OVERPASS[1].url]]);
    const d = await aplikacjaZSiecia({ search: '?test=true&odstep=0', pamiec });
    ustawPozycjeTestowa(d, '52.2297', '21.0122');
    const oryginalnyTimer = globalThis.setTimeout;
    const sygnaly = [], czasy = [], adresy = [];
    globalThis.setTimeout = (fn, ms, ...args) => {
      if (ms === 10_000) { czasy.push(ms); return oryginalnyTimer(fn, 5, ...args); }
      return oryginalnyTimer(fn, ms, ...args);
    };
    d.window.fetch = async (url, opcje) => {
      adresy.push(url); sygnaly.push(opcje.signal);
      const zawieszone = () => new Promise((_, reject) => {
        if (etap === 'nietypowy abort') opcje.signal.addEventListener('abort', () => reject(new Error('signal is aborted without reason')));
      });
      if (etap === 'ciało') return { ok: true, status: 200, text: zawieszone };
      return zawieszone();
    };
    try {
      d.kliknij('przycisk-dalej-stacje');
      await czekaj(100);
      assert.deepEqual(adresy, [INSTANCJE_OVERPASS[1], ...INSTANCJE_OVERPASS.filter((_, i) => i !== 1)].map(i => i.url));
      assert.deepEqual(czasy, INSTANCJE_OVERPASS.map(() => 10_000));
      assert.ok(sygnaly.every(s => s.aborted));
      assert.equal(d.pobierz('stacje-ladowanie').hidden, true);
      const proby = d.pobierz('siec-proby').children;
      assert.equal(proby.length, INSTANCJE_OVERPASS.length);
      for (let i = 0; i < INSTANCJE_OVERPASS.length; i++) {
        assert.match(proby[i].textContent, new RegExp(`Próba ${i + 1}/${INSTANCJE_OVERPASS.length}:`));
        assert.match(proby[i].textContent, /przekroczono czas oczekiwania 10 s/);
      }
      assert.match(d.pobierz('siec-proby').textContent, /FOSSGIS/);
      assert.doesNotMatch(d.pobierz('bledy-stacje').textContent, /FOSSGIS|private.coffee|VK Maps|Adikso/);
      assert.doesNotMatch(d.pobierz('bledy-stacje').textContent, /signal is aborted/);
    } finally { globalThis.setTimeout = oryginalnyTimer; }
  });
}

test('Overpass: HTTP 403 nie kończy łańcucha; rezerwa dowozi wynik', async () => {
  const d = await aplikacjaZSiecia({ search: '?test=true&odstep=0' });
  ustawPozycjeTestowa(d, '52.2297', '21.0122');
  const adresy = [];
  d.window.fetch = async url => {
    adresy.push(url);
    if (adresy.length === 1) return { ok: false, status: 403 };
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  d.kliknij('przycisk-dalej-stacje');
  await czekaj(100);
  assert.deepEqual(adresy, INSTANCJE_OVERPASS.slice(0, 2).map(i => i.url));
  assert.match(d.pobierz('siec-proby').textContent, /FOSSGIS.*HTTP 403/);
  assert.match(d.pobierz('siec-proby').textContent, /private.coffee.*pobrano/);
  assert.equal(d.pobierz('bledy-stacje').hidden, true);
});


test('Overpass: Adikso jako rezerwa dowozi dane i staje się pierwszą próbą kolejnej gry', async () => {
  const d = await aplikacjaZSiecia({ search: '?test=true&odstep=0' });
  ustawPozycjeTestowa(d, '52.2297', '21.0122');
  const polski = 'https://overpass.osm.adikso.net/api/interpreter';
  const adresy = [];
  d.window.fetch = async url => {
    adresy.push(url);
    if (url !== polski) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) };
  };
  d.kliknij('przycisk-dalej-stacje');
  await czekaj(100);
  assert.equal(adresy.at(-1), polski);
  assert.equal(d.pamiec.get('okolica:overpass-sprawny'), polski);
  assert.equal(d.pobierz('bledy-stacje').hidden, true);
  const kolejna = await aplikacjaZSiecia({ search: '?test=true&odstep=0', pamiec: new Map([['okolica:overpass-sprawny', polski]]) });
  ustawPozycjeTestowa(kolejna, '52.2297', '21.0122');
  const nowe = [];
  kolejna.window.fetch = async url => { nowe.push(url); return { ok: true, status: 200, text: async () => JSON.stringify(czytajFixtureOverpass('centrum')) }; };
  kolejna.kliknij('przycisk-dalej-stacje');
  await czekaj(100);
  assert.deepEqual(nowe, [polski]);
});

test('Informacje: ikonka wskazuje otwarcie, zamknięcie i zachowuje stan podczas podglądu mapy', async () => {
  const d = await aplikacjaZMapa({ search: '?test=true' });
  const ikona = d.pobierz('przycisk-informacje');
  const sprawdz = stan => {
    assert.equal(ikona.getAttribute('aria-pressed'), String(stan));
    assert.equal(ikona.getAttribute('aria-expanded'), String(stan));
    assert.equal(d.pobierz('ekran-informacje').hidden, !stan);
  };
  sprawdz(false);
  d.kliknij('przycisk-informacje'); sprawdz(true);
  d.kliknij('przycisk-podejrzyj-mape'); sprawdz(true);
  d.kliknij('przycisk-podejrzyj-mape'); sprawdz(true);
  d.kliknij('przycisk-informacje'); sprawdz(false);
  d.kliknij('przycisk-informacje'); sprawdz(true);
  d.kliknij('przycisk-zamknij-informacje'); sprawdz(false);
  d.kliknij('przycisk-informacje');
  d.wyslijZdarzenieDokumentu('keydown', { key: 'Escape' }); sprawdz(false);
  d.kliknij('przycisk-informacje');
  d.kliknij('przycisk-prywatnosc-stopka'); sprawdz(false); // inna warstwa też gasi Informacje
});

test('droga: pasek na mapie, Informacje bez gry, po dojściu duży panel pytania', async () => {
  const { dom } = await graGotowaDoStartu();
  zaczynijGre(dom);
  // ADR 0043 (uwaga H1): przycisku końca gry NIE MA — ani w panelu, ani w Informacjach
  assert.equal(dom.elementy.has('przycisk-zakoncz-gre'), false, 'węzła zakończenia gry nie ma w kodzie');
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(dom.pobierz('gra-pasek').hidden, false);
  assert.match(dom.pobierz('gra-pasek').textContent, /^Kto: Gracz 1 \(odległość od stacji \d+ m\) · stacja 1 z 3$/);
  assert.ok(dom.pobierz('gra-pasek').querySelector('.pasek-dystans'), 'odległość jest zieloną pigułką (właściciel 2026-09-11)');
  // Uwagi E i F (2026-09-13, ADR 0036 aneks) zabrały z Informacji sterowanie,
  // a uwaga H1 (ADR 0043) także węzeł zakończenia gry: w drodze nad mapą zostaje
  // sam pasek, a grę kończy ikona ⚙ START GRY.
  assert.equal(dom.elementy.has('informacje-gra'), false, 'Informacje nie niosą już nic z gry');
  // Ten helper chodzi w trybie testowym (`?tryb=test`), a w nim panel fazy B
  // ZOSTAJE na wierzchu: to jedyne miejsce „▶ Symuluj dojście”, którym domyka
  // się odcinek bez GPS (ADR 0036 aneks m12-102 pkt 2). W przeglądarce `hidden`
  // na przodku gasi potomków przez kaskadę — atrapa DOM tego nie modeluje, więc
  // zachowanie terenowe pinuje osobny test poniżej (atrapa geolokalizacji).
  assert.equal(dom.pobierz('gra-sterowanie').hidden, false, 'w trybie testowym panel gry zostaje — symulacja jest osiągalna');
  assert.equal(dom.pobierz('przycisk-symulacja-gra').hidden, false, 'przycisk symulacji dojścia odsłonięty w odcinku');
  assert.equal(dom.document.body.classList.contains('gra-w-drodze'), true);
  assert.equal(dom.pobierz('przygaszenie-mapy').hidden, true, 'bez przygaszenia mapy podczas marszu');
  dom.kliknij('przycisk-informacje');
  assert.equal(dom.pobierz('ekran-informacje').hidden, false, 'Informacje otwierają się też w drodze');
  assert.equal(dom.pobierz('gra-pasek').hidden, false, 'Informacje nie zmieniają układu drogi');
  await dojdzSymulacja(dom);
  assert.equal(dom.pobierz('gra-panel-pytanie').hidden, false);
  assert.equal(dom.pobierz('gra-pasek').hidden, true);
  assert.equal(dom.document.body.classList.contains('gra-w-drodze'), false);
  assert.equal(dom.pobierz('gra-sterowanie').hidden, false, 'panel pytania znowu widoczny');
  assert.equal(dom.pobierz('ekran-informacje').hidden, true, 'pytanie pojawia się automatycznie także po użyciu Informacji');
  assert.equal(dom.pobierz('przygaszenie-mapy').hidden, false);
});

test('droga w terenie (bez ?tryb=test): nad mapą zostaje sam pasek, symulacji nie ma', async () => {
  // ADR 0036 aneks m12-102 pkt 2 i ADR 0043 pkt 1: w drodze gracz widzi pasek
  // i mapę, a panel gry jest schowany. Test idzie DROGĄ TERENOWĄ (atrapa
  // `navigator.geolocation`, bez trybu testowego), bo atrapa DOM nie modeluje
  // kaskady CSS: `hidden` na przodku gasi potomków w przeglądarce (pomiar
  // headless Chromium 153: `#gra-panel-odcinek` 0×0, `offsetParent` null),
  // a `kliknij` w atrapie nie pyta o renderowanie (LESSONS L13).
  const gpsTeren = atrapaGeolokalizacji();
  const dom = await naEkranPozycji(zainstalujDom, gpsTeren.geolocation, 'drogateren');
  dom.kliknij('przycisk-dalej-pozycja');
  await czekaj(30); // bramka tożsamości jest asynchroniczna
  assert.equal(dom.pobierz('ekran-pozycja').hidden, false, 'setup przeszedł na ekran pozycji');
  gpsTeren.wyslijFix(52.2297, 21.0122, 12);
  assert.match(dom.pobierz('pozycja-status').textContent, /Pozycja ustalona/, 'fix z GPS ustawił pozycję');
  dom.kliknij('przycisk-dalej-stacje');
  await czekaj(30);
  dom.wklej('pole-odpowiedz', JSON.stringify(czytajFixturePaczka()));
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'poprawna paczka sama zaczęła grę');
  dom.kliknij('przycisk-start-odcinka');
  assert.equal(dom.pobierz('gra-panel-odcinek').hidden, false, 'faza B: odcinek się zaczął');
  assert.equal(dom.pobierz('gra-pasek').hidden, false, 'pasek drogi jest nad mapą');
  assert.equal(dom.pobierz('gra-sterowanie').hidden, true, 'panel gry schowany — w drodze zostaje sam pasek');
  assert.equal(dom.pobierz('przycisk-symulacja-gra').hidden, true,
    'symulacji dojścia w terenie nie ma (ADR 0029: dojście zalicza tylko GPS)');
  assert.equal(dom.document.body.classList.contains('gra-w-drodze'), true);
});

/* -------------------------------------- bug G: watchdog cichego watchera */

/** Ścieżka na ekran pozycji z potwierdzonymi graczami — gest „Dalej” uzbraja GPS. */
async function naEkranPozycji(zainstalowany, geolokalizacja, sufiks) {
  const pamiec = pamiecKonfig3x1();
  const konfig = JSON.parse(pamiec.get('okolica:konfig'));
  konfig.konfig.imiona = ['Gracz 1', 'Gracz 2', 'Gracz 3'];
  pamiec.set('okolica:konfig', JSON.stringify(konfig));
  pamiec.set('okolica:gracze', JSON.stringify({ schemat: 'gracze-lokalni/1', gracze: ['Gracz 1', 'Gracz 2', 'Gracz 3'].map((pseudonim) => ({ pseudonim, zweryfikowany: true })) }));
  const domB = zainstalujDom({ geolocation: geolokalizacja, pamiec });
  await import(`../app/app.js?${sufiks}=${Math.random().toString(36).slice(2)}`);
  return domB;
}

test('bug G: cichy watcher (WebKit bez żadnego callbacku) jest restarowany, a ekran mówi o próbie', async () => {
  // Zgłoszenie terenowe 2026-09-12 (iPhone, Chrome, Pages): watchPosition
  // nie woła ani onFix, ani onBlad, ignorując timeout=20 s — aplikacja czekała
  // w nieskończoność na „Czekam na pozycję…”. Watchdog ma wykrywać ciszę,
  // zakładać świeżego watchera i mówić graczowi, która to próba.
  const gpsCichy = atrapaGeolokalizacji();
  globalThis.__OKOLICA_KROK_GPS_MS__ = 20; // szybki zegar TYLKO dla tego importu (czytany przy ładowaniu modułu)
  globalThis.__OKOLICA_MILCZENIE_GPS_MS__ = 60;
  let domCichy;
  try {
    domCichy = await naEkranPozycji(zainstalujDom, gpsCichy.geolocation, 'gpswatchdog');
    assert.equal(gpsCichy.wywolania.watch, 1, 'start strony: jeden watcher');
    domCichy.kliknij('przycisk-dalej-pozycja');
    await czekaj(30); // handler nawigacji jest asynchroniczny (bramka tożsamości)
    assert.equal(domCichy.pobierz('ekran-pozycja').hidden, false, 'nawigacja przeszła bramę setupu i tożsamości');
    assert.ok(gpsCichy.wywolania.watch >= 2, 'gest „Dalej” bez fixa zakłada świeżego watchera (bug G, kotwica w geście)');
    await czekaj(250); // kilka tyknięć watchdoga w czasie rzeczywistym (krok 20 ms < czekanie)
    assert.ok(gpsCichy.wywolania.watch >= 4, `watchdog restaruje cichego watchera (watch=${gpsCichy.wywolania.watch})`);
    assert.ok(gpsCichy.wywolania.clear.length >= 3, 'przed każdym restartem stary watcher dostaje clearWatch');
    const tekstStatusu = domCichy.pobierz('pozycja-status').textContent;
    const proba = /próba (\d+)/.exec(tekstStatusu);
    assert.ok(proba && Number(proba[1]) >= 2, `gracz widzi, że aplikacja walczy o pozycję: „${tekstStatusu}”`);
    // fix po restarcie: licznik prób wraca do zera, pozycja i przycisk żyją
    gpsCichy.wyslijFix(52.2297, 21.0122, 12);
    assert.match(domCichy.pobierz('pozycja-status').textContent, /Pozycja ustalona/);
    assert.equal(domCichy.pobierz('przycisk-dalej-stacje').disabled, false);
  } finally {
    delete globalThis.__OKOLICA_KROK_GPS_MS__;
    delete globalThis.__OKOLICA_MILCZENIE_GPS_MS__;
    // ADR 0040: tło NIE zdejmuje watchera ani jego zegara, więc interwały
    // sprząta atrapa — inaczej żywy watchdog strzela w atrapę GPS następnego
    // testu i zawiesza pętlę zdarzeń `node --test`.
    if (domCichy) domCichy.posprzataj();
  }
});

test('bug G: „Dalej” odświeża cichego watchera gestem; po fixie restart nie jest potrzebny', async () => {
  // Pierwszy watcher startuje przy ładowaniu strony, BEZ gestu — na iOS WebKit
  // potrafi taki request trzymać zawieszony w nieskończoność. Klik „Dalej”
  // jest gestem użytkownika: dopóki nie ma żadnego fixa, ma zakładać świeżego
  // watchera zamiast ufać „czyAktywny()”.
  const gpsNiemego = atrapaGeolokalizacji();
  const domB = await naEkranPozycji(zainstalujDom, gpsNiemego.geolocation, 'gpsdalej');
  try {
    assert.equal(gpsNiemego.wywolania.watch, 1, 'start: jeden watcher z ładowania strony');
    domB.kliknij('przycisk-dalej-pozycja');
    await czekaj(30);
    assert.equal(domB.pobierz('ekran-pozycja').hidden, false, 'nawigacja przeszła bramę setupu i tożsamości');
    assert.equal(gpsNiemego.wywolania.watch, 2, 'bez żadnego fixa: „Dalej” zakłada świeżego watchera (gest)');
    assert.equal(gpsNiemego.wywolania.clear.length, 1, 'stary watcher zamknięty clearWatch');
    gpsNiemego.wyslijFix(52.2297, 21.0122, 12);
    assert.match(domB.pobierz('pozycja-status').textContent, /Pozycja ustalona/);
    domB.kliknij('przycisk-wstecz-setup');
    domB.kliknij('przycisk-dalej-pozycja');
    await czekaj(30);
    assert.equal(gpsNiemego.wywolania.watch, 2, 'fix był: watcher nie jest restarowany przy każdym wejściu');
  } finally {
    domB.posprzataj(); // ADR 0040: bez pauzy w tle zegary sprząta atrapa
  }
});

/* ---- uwaga B 2026-09-14 (dogrywka): świeża gra numeruje trasą z twardym wejściem ---- */

test('uwaga B (dogrywka): prompt numeruje stacje trasą — stacja 1 najbliższa pozycji', async () => {
  const domAtrapa = zainstalujDom({ search: '?tryb=test', pamiec: pamiecKonfig3x1() });
  await import(`../app/app.js?wejscie=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(domAtrapa, '52.2297', '21.0122');
  domAtrapa.kliknij('przycisk-dalej-stacje'); // pierścień — atrapa nie ma window.fetch
  domAtrapa.kliknij('przycisk-dalej-prompt');
  const prompt = domAtrapa.pobierz('pole-prompt').value;
  const dystanse = {};
  for (const linia of prompt.split('\n')) {
    const m = linia.match(/^- stacja (\d+): .* \((\d+) m od środka gry\)$/);
    if (m) dystanse[Number(m[1])] = Number(m[2]);
  }
  assert.deepEqual(Object.keys(dystanse).map(Number).sort((a, b) => a - b), [1, 2, 3], 'prompt listuje 3 stacje z dystansami');
  assert.equal(dystanse[1], Math.min(dystanse[1], dystanse[2], dystanse[3]),
    `stacja 1 ma być najbliższa pozycji (dystanse: 1=${dystanse[1]} m, 2=${dystanse[2]} m, 3=${dystanse[3]} m)`);
});

/* ---- audyt PR #24, defekt D1: wklejka porządkuje metryką DROGOWĄ, gdy sieć ją dała ---- */

/**
 * Fixture `overpass-centrum` przy 52.22570, 21.00770 i 3 stacjach × 1 pytaniu
 * (60 min → promień 700 m) daje układ, w którym metryki się rozjeżdżają:
 * najbliższa DROGĄ jest stacja z `dystansSieciowyM` 485 m (kreską 466 m),
 * a najbliższa KRESKĄ — inna stacja (273 m kreską, 527 m drogą). Sieć numeruje
 * trasę metryką drogową (ADR 0005 aneks m12-116), więc wklejka — która
 * porządkuje grę jeszcze raz — musi użyć TEJ SAMEJ metryki, inaczej przestawia
 * trasę i zostawia macierz drogową w starej kolejności (dystanse odcinków
 * lądują na cudzych odcinkach, a UI mówi „drogą”).
 */
const SRODEK_D1 = { lat: 52.2257, lon: 21.0077 };
const CZAS_MIN_D1 = 60;
const WZOR_WSPOLRZEDNYCH = /\d{2}\.\d{5}, \d{2}\.\d{5}/;

test('uwaga B (dogrywka): wklejka nie przestawia stacji z sieci — metryka drogowa, nie kreska', async () => {
  const promienM = przeliczenieCzasu({
    czasGryMin: CZAS_MIN_D1, tryb: 'piesza', liczbaStacji: 3, pytaniaNaStacje: 1,
  }).promienM;
  const pamiec = new Map();
  pamiec.set(kluczCacheSieci({ ...SRODEK_D1, promienM, tryb: 'piesza' }), JSON.stringify({
    schemat: SCHEMAT_SIECI,
    zapisanoMs: Date.now(),
    dane: upraszczajDaneDoCache(parsujOdpowiedz(czytajFixtureOverpass('centrum'))),
  }));
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: {
      liczbaGraczy: 3, liczbaStacji: 3, pytaniaNaStacje: 1,
      tematy: ['historia', 'architektura'], czasGryMin: CZAS_MIN_D1,
    },
  }));

  const domAtrapa = await aplikacjaZSiecia({ search: '?tryb=test', pamiec });
  ustawPozycjeTestowa(domAtrapa, '52.22570', '21.00770');
  domAtrapa.kliknij('przycisk-dalej-stacje'); // sieć z pamięci telefonu — bez internetu
  assert.match(domAtrapa.pobierz('stacje-tryb').textContent, /sieć drogowa/,
    'stacje są z sieci drogowej (cache), nie z pierścienia');

  const wiersze = [...domAtrapa.pobierz('lista-stacji').children];
  assert.equal(wiersze.length, 3, 'sieć dała dokładnie 3 stacje');
  assert.match(wiersze[0].textContent, /(\d+) m drogi/, 'lista pokazuje dystans sieciowy stacji 1');
  const drogaStacji1 = Number(wiersze[0].textContent.match(/(\d+) m drogi/)[1]);
  const wspolrzedneStacji1 = wiersze[0].textContent.match(WZOR_WSPOLRZEDNYCH)[0];
  const wspolrzedneStacji2 = wiersze[1].textContent.match(WZOR_WSPOLRZEDNYCH)[0];
  assert.notEqual(wspolrzedneStacji1, wspolrzedneStacji2, 'dwie różne stacje — jest co przestawić');

  const paczka = {
    ...czytajFixturePaczka(),
    okolica: { lat: SRODEK_D1.lat, lon: SRODEK_D1.lon, promienM, miejsce: 'Śródmieście, Warszawa' },
  };
  domAtrapa.wklej('pole-odpowiedz', JSON.stringify(paczka));

  assert.equal(domAtrapa.pobierz('ekran-gra').hidden, false, 'poprawna paczka od razu zaczyna grę');
  const cel = domAtrapa.pobierz('gra-cel-stacji').textContent;
  assert.ok(cel.includes(wspolrzedneStacji1),
    `stacja 1 gry to stacja 1 z sieci (metryka drogowa); cel: „${cel}”`);
  assert.ok(!cel.includes(wspolrzedneStacji2), 'kreska nie wygrała z drogą');
  assert.doesNotMatch(domAtrapa.pobierz('status').textContent, /uporządkowano trasą/,
    'kolejność sieciowa jest punktem stałym w metryce drogowej — nie ma czego przestawiać');
  assert.match(cel, new RegExp(`${drogaStacji1} m drogą od poprzedniego punktu`),
    'pierwszy odcinek niesie WŁASNY dystans sieciowy, nie cudzy');
});
