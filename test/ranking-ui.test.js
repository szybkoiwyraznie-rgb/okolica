/**
 * Ranking w interfejsie (zgłoszenie właściciela 2026-09-12: „Mam nowy pomysł
 * na podstronę Ranking”, ADR 0039).
 *
 * Warstwa ma pokazywać DOKŁADNIE dwie tabele i nic więcej:
 *   1. „Ranking Punktowy Graczy” — suma punktów ze wszystkich rodzajów gier,
 *      max 5 pozycji,
 *   2. „Mistrzowie Zagadek” — proporcja odpowiedzi poprawnych do zadanych,
 *      próg 10 zadanych pytań, max 5 pozycji.
 *
 * Testy modułu pilnują reguł (sortowanie, remisy, próg, limit), a test na
 * atrapie DOM — tego, co widzi gracz: ikona pucharu otwiera warstwę, wiersze
 * trafiają do tabel, a każda awaria mostu ma JAWNY komunikat po polsku
 * (LESSONS L6: cisza w miejscu awarii wygląda jak „nikt nie grał”).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMIT_RANKINGU,
  MINIMUM_PYTAN_ODPOWIEDZI,
  formatujSkutecznosc,
  mistrzowieZagadek,
  rankingPunktowy,
  walidujRankingSurowy,
} from '../app/ranking.js';
import { zainstalujDom } from './helpers/dom.js';

/* ------------------------------------------------ reguły (moduł czysty) */

test('ranking punktowy: suma punktów malejąco i tylko 5 pozycji', () => {
  const gracze = Array.from({ length: 7 }, (_, i) => ({
    pseudonim: `Gracz ${i + 1}`, punkty: i * 3, poprawne: i, pytania: i + 2,
  }));
  const { wiersze, wszystkich } = rankingPunktowy({ gracze });
  assert.equal(wszystkich, 7, 'wszystkich liczymy PRZED ucięciem — to liczba graczy z wynikiem');
  assert.equal(wiersze.length, LIMIT_RANKINGU, 'tabela ma maksymalnie 5 pozycji');
  assert.deepEqual(wiersze.map((w) => w.pseudonim), ['Gracz 7', 'Gracz 6', 'Gracz 5', 'Gracz 4', 'Gracz 3']);
  assert.deepEqual(wiersze.map((w) => w.pozycja), [1, 2, 3, 4, 5]);
  assert.equal(wiersze[0].punkty, 18);
});

test('ranking punktowy: przy remisie decyduje pseudonim, żeby kolejność nie skakała', () => {
  const gracze = [
    { pseudonim: 'Zenon', punkty: 10, poprawne: 2, pytania: 4 },
    { pseudonim: 'Ala', punkty: 10, poprawne: 2, pytania: 4 },
    { pseudonim: 'Bartek', punkty: 12, poprawne: 3, pytania: 5 },
  ];
  const { wiersze } = rankingPunktowy({ gracze });
  assert.deepEqual(wiersze.map((w) => w.pseudonim), ['Bartek', 'Ala', 'Zenon']);
});

test('ranking punktowy: śmieci w wierszu nie wywracają tabeli', () => {
  const { wiersze } = rankingPunktowy({ gracze: [
    { pseudonim: '  Ala  ', punkty: '7', poprawne: '2', pytania: '3' },
    { pseudonim: '', punkty: 2, poprawne: 1, pytania: 1 },
    null, // wiersz, który w ogóle nie przyszedł — most ma luki, tabela nie może paść
  ] });
  assert.deepEqual(wiersze.map((w) => [w.pseudonim, w.punkty]), [
    ['Ala', 7],
    ['gracz bez pseudonimu', 2],
    ['gracz bez pseudonimu', 0],
  ], 'pseudonim przycięty, brakujące liczby to zera, brak wiersza nie wywraca tabeli');
});

test('mistrzowie zagadek: proporcja poprawnych do ZADANYCH, próg 10 odpowiedzi', () => {
  const gracze = [
    { pseudonim: 'Ala', punkty: 40, poprawne: 9, pytania: 10 },   // 90%
    { pseudonim: 'Bartek', punkty: 3, poprawne: 3, pytania: 3 },  // 100%, ale za mała próba
    { pseudonim: 'Celina', punkty: 30, poprawne: 24, pytania: 30 }, // 80%
  ];
  const { wiersze, kwalifikowani, prog } = mistrzowieZagadek({ gracze });
  assert.equal(prog, MINIMUM_PYTAN_ODPOWIEDZI);
  assert.equal(kwalifikowani, 2, 'Bartek ma tylko 3 zadane pytania — nie jest mistrzem');
  assert.deepEqual(wiersze.map((w) => w.pseudonim), ['Ala', 'Celina']);
  assert.deepEqual(wiersze.map((w) => w.procent), [90, 80]);
  assert.equal(formatujSkutecznosc(wiersze[0]), '9/10 · 90%');
});

test('mistrzowie zagadek: przy równej proporcji wyżej idzie większa próba', () => {
  const gracze = [
    { pseudonim: 'Ala', poprawne: 10, pytania: 10 },
    { pseudonim: 'Bartek', poprawne: 20, pytania: 20 },
    { pseudonim: 'Celina', poprawne: 15, pytania: 20 },
  ];
  const { wiersze } = mistrzowieZagadek({ gracze });
  assert.deepEqual(wiersze.map((w) => w.pseudonim), ['Bartek', 'Ala', 'Celina'],
    '100% z 20 pytań przed 100% z 10 — większa próba to mocniejszy wynik (Celina 75%)');
});

test('mistrzowie zagadek: limit 5 pozycji i liczenie kwalifikowanych przed ucięciem', () => {
  const gracze = Array.from({ length: 7 }, (_, i) => ({
    pseudonim: `Gracz ${i + 1}`, poprawne: 10 + i, pytania: 10 + i * 2,
  }));
  const { wiersze, kwalifikowani } = mistrzowieZagadek({ gracze });
  assert.equal(wiersze.length, LIMIT_RANKINGU);
  assert.equal(kwalifikowani, 7, 'kwalifikowanych liczymy przed ucięciem do 5');
  assert.deepEqual(wiersze.map((w) => w.pozycja), [1, 2, 3, 4, 5]);
});

test('walidacja odpowiedzi mostu: brak danych i obcy schemat mają jawne usterki', () => {
  assert.equal(walidujRankingSurowy('{"schemat":"RO-ranking/2","gracze":[]}').usterka, null);
  assert.match(walidujRankingSurowy('<html>403</html>').usterka, /JSON/, 'nieczytelna odpowiedź nazywa przyczynę');
  assert.match(walidujRankingSurowy('{"schemat":"RO-ranking/1","gracze":[]}').usterka, /RO-ranking\/2/,
    'stary schemat (surowe wiersze gier) jest jawnie odrzucany');
  assert.match(walidujRankingSurowy('{"schemat":"RO-ranking/2"}').usterka, /listy graczy/);
  // Najczęstszy stan „na teraz”: wdrożenie sprzed akcji `ranking` (ADR 0039).
  assert.equal(walidujRankingSurowy('{"blad":"nieznana akcja"}').usterka, 'most Drive odmówił: nieznana akcja',
    'odmowę mostu pokazujemy dosłownie — to nie nasz błąd');
});

/* --------------------------------------------------------- warstwa w UI */

/** Aplikacja na świeżej atrapie DOM z mostem, który ma odpowiedzieć `odpowiedz`. */
async function aplikacjaZRankingiem({ odpowiedz = null, url = 'https://most.invalid/exec' } = {}) {
  const pamiec = new Map();
  if (url) pamiec.set('okolica:multi:url-mostu', url);
  const dom = zainstalujDom({ pamiec });
  const zapytania = [];
  dom.window.fetch = async (adres) => {
    zapytania.push(String(adres));
    if (odpowiedz === null) return { ok: false, status: 503 };
    return { ok: true, status: 200, text: async () => odpowiedz };
  };
  await import(`../app/app.js?ranking=${Math.random().toString(36).slice(2)}`);
  return { ...dom, zapytania };
}

/** Czeka, aż warstwa dokończy pobieranie (jedna mikroseria + makroseria). */
function odczekaj() {
  return new Promise((rezultat) => setTimeout(rezultat, 0));
}

const danePrzykladowe = JSON.stringify({
  schemat: 'RO-ranking/2',
  gracze: [
    { pseudonim: 'Ala', punkty: 42, poprawne: 9, pytania: 10 },
    { pseudonim: 'Bartek', punkty: 12, poprawne: 3, pytania: 3 },
    { pseudonim: 'Celina', punkty: 30, poprawne: 24, pytania: 30 },
  ],
});

test('ranking UI: ikona pucharu otwiera warstwę, drugi klik zamyka (wzorzec F3)', async () => {
  const dom = await aplikacjaZRankingiem({ odpowiedz: danePrzykladowe });
  assert.equal(dom.pobierz('ekran-ranking').hidden, true, 'na starcie warstwa jest schowana');
  assert.equal(dom.pobierz('przycisk-ranking').getAttribute('aria-pressed'), 'false', 'ikona zgaszona');

  dom.kliknij('przycisk-ranking');
  await odczekaj();
  assert.equal(dom.pobierz('ekran-ranking').hidden, false, 'puchar otwiera warstwę');
  assert.equal(dom.pobierz('przycisk-ranking').getAttribute('aria-pressed'), 'true', 'ikona świeci nad otwartą warstwą');
  assert.equal(dom.pobierz('przycisk-ranking').getAttribute('aria-expanded'), 'true');
  assert.equal(dom.document.body.classList.contains('ranking-otwarte'), true, 'klasa na <body> wygasza resztę paneli');
  assert.deepEqual(dom.zapytania, ['https://most.invalid/exec?akcja=ranking'], 'pytamy most o akcję ranking');

  dom.kliknij('przycisk-ranking');
  assert.equal(dom.pobierz('ekran-ranking').hidden, true, 'drugi klik zamyka warstwę');
  assert.equal(dom.pobierz('przycisk-ranking').getAttribute('aria-pressed'), 'false', 'ikona gaśnie razem z warstwą');
  assert.equal(dom.document.body.classList.contains('ranking-otwarte'), false);

  dom.kliknij('przycisk-ranking'); // otwarcie drugi raz: dane są w STAN, ale most pytamy znowu (świeży ranking)
  await odczekaj();
  assert.equal(dom.zapytania.length, 2, 'każde otwarcie warstwy odświeża dane z Drive');
  dom.kliknij('przycisk-zamknij-ranking');
  assert.equal(dom.pobierz('ekran-ranking').hidden, true, '✕ zamyka warstwę');
});

test('ranking UI: dwie tabele — punkty ze wszystkich gier i mistrzowie z progiem 10 pytań', async () => {
  const dom = await aplikacjaZRankingiem({ odpowiedz: danePrzykladowe });
  dom.kliknij('przycisk-ranking');
  await odczekaj();

  const punktowe = dom.pobierz('ranking-punkty-wiersze').children;
  assert.equal(punktowe.length, 3, 'trzech graczy z profilem, każdy w jednym wierszu');
  assert.deepEqual(punktowe.map((tr) => tr.children.map((td) => td.textContent)),
    [['1', 'Ala', '42 pkt'], ['2', 'Celina', '30 pkt'], ['3', 'Bartek', '12 pkt']],
    'ranking punktowy: suma punktów, wszyscy gracze razem (hot-seat i wieloosobowe)');

  const mistrzowie = dom.pobierz('ranking-mistrzowie-wiersze').children;
  assert.deepEqual(mistrzowie.map((tr) => tr.children.map((td) => td.textContent)),
    [['1', 'Ala', '9/10 · 90%'], ['2', 'Celina', '24/30 · 80%']],
    'mistrzowie: proporcja poprawnych do zadanych; Bartek (3 pytania) jest poniżej progu');

  const stan = dom.pobierz('ranking-status').textContent;
  assert.match(stan, /Graczy z potwierdzonym profilem: 3/, 'status mówi, ilu graczy weszło do rankingu');
  assert.match(stan, /10/, 'status mówi, od ilu odpowiedzi liczą się mistrzowie');
  // Nagłówki tabel to dokładnie to, co obiecał właściciel: dwie tabele i nic więcej.
  const html = dom.html;
  const od = html.indexOf('id="ekran-ranking"');
  const sekcja = html.slice(od, html.indexOf('</section>', od));
  assert.ok(od > 0 && sekcja.length > 0, 'warstwa rankingu jest w HTML');
  assert.equal((sekcja.match(/class="tabela-wynikow"/g) ?? []).length, 2,
    'warstwa rankingu ma DOKŁADNIE dwie tabele (zgłoszenie właściciela: „dwie tabele i nic więcej”)');
  for (const obcy of ['ranking-zakladki', 'ranking-kategorie', 'ranking-moje-gry']) {
    assert.equal(html.includes(`id="${obcy}"`), false, `stary element #${obcy} nie wrócił do HTML`);
  }
});

test('ranking UI: pusty ranking mówi WPROST, że liczą się gracze z profilem', async () => {
  const dom = await aplikacjaZRankingiem({ odpowiedz: JSON.stringify({ schemat: 'RO-ranking/2', gracze: [] }) });
  dom.kliknij('przycisk-ranking');
  await odczekaj();
  assert.equal(dom.pobierz('ranking-punkty-wiersze').children.length, 0);
  assert.equal(dom.pobierz('ranking-mistrzowie-wiersze').children.length, 0);
  assert.match(dom.pobierz('ranking-status').textContent, /Ranking jest pusty — punkty zbiera gracz z potwierdzonym profilem/);
});

test('ranking UI: awaria mostu i śmieci w odpowiedzi mają JAWNE komunikaty (LESSONS L6)', async () => {
  const awaria = await aplikacjaZRankingiem({ odpowiedz: null });
  awaria.kliknij('przycisk-ranking');
  await odczekaj();
  assert.match(awaria.pobierz('ranking-status').textContent, /Nie udało się pobrać rankingu \(HTTP 503\)/,
    'HTTP 503 nazwany po ludzku, a nie „błąd”');

  const smieci = await aplikacjaZRankingiem({ odpowiedz: '<html>coś innego</html>' });
  smieci.kliknij('przycisk-ranking');
  await odczekaj();
  assert.match(smieci.pobierz('ranking-status').textContent, /Nie udało się odczytać rankingu \(.*JSON/,
    'nieczytelna odpowiedź mówi, że to nie JSON — nie udajemy pustego rankingu');

  const sprzedWdrozenia = await aplikacjaZRankingiem({ odpowiedz: '{"blad":"nieznana akcja"}' });
  sprzedWdrozenia.kliknij('przycisk-ranking');
  await odczekaj();
  assert.equal(sprzedWdrozenia.pobierz('ranking-status').textContent,
    'Nie udało się odczytać rankingu (most Drive odmówił: nieznana akcja) — spróbuj ponownie.',
    'starsze wdrożenie `.gs` mówi wprost, że nie zna akcji (wymagany redeploy, ADR 0039)');
});

test('ranking UI: bez nadpisania w pamięci mostem jest adres wpisany w kod (ADR 0020)', async () => {
  const dom = await aplikacjaZRankingiem({ url: '', odpowiedz: danePrzykladowe });
  dom.kliknij('przycisk-ranking');
  await odczekaj();
  assert.equal(dom.zapytania.length, 1, 'pytamy most o ranking');
  assert.match(dom.zapytania[0], /^https:\/\/script\.google\.com\/macros\/s\//,
    'adres bierze się ze stałej wdrożeniowej (ADR 0020) — gracz nie konfiguruje niczego');
  assert.match(dom.zapytania[0], /\?akcja=ranking$/);
});

test('ranking UI: Escape zamyka warstwę rankingu', async () => {
  const dom = await aplikacjaZRankingiem({ odpowiedz: danePrzykladowe });
  dom.kliknij('przycisk-ranking');
  await odczekaj();
  assert.equal(dom.pobierz('ekran-ranking').hidden, false);
  for (const fn of dom.zdarzeniaDokumentu.keydown ?? []) fn({ key: 'Escape' });
  assert.equal(dom.pobierz('ekran-ranking').hidden, true, 'Escape zamyka warstwę');
});
