/**
 * Testy protokołu PYT (app/protokol.js): budowa promptu, parsowanie odpowiedzi
 * modelu i walidacja paczki z kodami usterek E02–E20 (E01 wycofany 2026-09-15e).
 *
 * Fixture `test/fixtures/paczka-ok.json` jest SYNTETYCZNY: miejsce, fakty i
 * adresy źródeł są zmyślone, żeby test nie powtarzał niezweryfikowanych twierdzeń
 * (ADR 0008 dotyczy paczek prawdziwych i referencyjnych, nie fixture'ów).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SZABLON_PROMPTU, SZABLON_PROMPTU_BEZ_WERYFIKACJI, WERSJA_PROTOKOLU,
  normalizujTekst, normalizujTematyPaczki, parsujOdpowiedzModela, podsumowaniePaczki,
  walidujPaczke, zbudujPrompt,
} from '../app/protokol.js';
import { domyslnaKonfiguracja, liczbaPytan } from '../app/konfig.js';
import { przesunPunkt } from '../app/geo.js';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const OK = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));

const SRODEK = { lat: OK.okolica.lat, lon: OK.okolica.lon };
const STACJE = [1, 2, 3].map((i) => {
  const p = przesunPunkt(SRODEK, i * 120, 700);
  return { id: i, lat: p.lat, lon: p.lon, opis: i === 1 ? 'rynek w Grabowicach' : '' };
});
const TERAZ = new Date('2026-09-05T23:59:00');

function oczekiwane(nadpisanie = {}) {
  return {
    liczbaStacji: 3,
    liczbaPytan: 3,
    wiek: 'dorosli',
    tematy: ['historia', 'architektura'],
    promienM: 1000,
    lat: SRODEK.lat,
    lon: SRODEK.lon,
    jezyk: 'polski',
    stacje: STACJE,
    teraz: TERAZ,
    ...nadpisanie,
  };
}

function konfiguracja(nadpisanie = {}) {
  return {
    ...domyslnaKonfiguracja(2),
    liczbaStacji: 3,
    pytaniaNaStacje: 1,
    tematy: ['historia', 'architektura'],
    wiek: 'dorosli',
    promienM: 1000,
    ...nadpisanie,
  };
}

function klonyPaczki(modyfikacja) {
  const kopia = JSON.parse(JSON.stringify(OK));
  modyfikacja(kopia);
  return kopia;
}

function kody(paczka, oczek = oczekiwane()) {
  return walidujPaczke(paczka, oczek).map((u) => u.kod);
}

/* --------------------------------------------------------------- szablon */

test('szablon promptu jest wczytany z dokumentu i zawiera klauzule twarde', () => {
  assert.ok(SZABLON_PROMPTU.length > 2000, `szablon ma ${SZABLON_PROMPTU.length} znaków — wygląda na niekompletny`);
  for (const fraza of [
    'Jesteś autorem pytań do terenowej gry quizowej',
    'ZASADY TWARDE',
    'wykonaj kwerendę w internecie',
    'oprzyj ten fakt na wyniku kwerendy',
    '"zrodla"',
    'Nazwy, daty, liczby, cytaty, autorów i adresy podawaj dokładnie w postaci potwierdzonej źródłem',
    'Cała odpowiedź to jeden blok kodu json',
    'OKOLICA GRY:',
    'STACJE (kolejność = kolejność w grze',
    'GRACZE I TRUDNOŚĆ:',
    'SCHEMAT ODPOWIEDZI — dokładnie te pola',
    'WYMAGANIA DODATKOWE:',
    '"poprawna": numer poprawnej odpowiedzi',
  ]) {
    assert.ok(SZABLON_PROMPTU.includes(fraza), `w szablonie brakuje: ${fraza}`);
  }
  // wszystkie placeholdery z protokołu §2.1 muszą być w szablonie
  for (const token of ['{LAT}', '{LON}', '{MIEJSCE}', '{PROMIEN_M}', '{TRYB}', '{LISTA_STACJI}', '{LICZBA_GRACZY}', '{WIEK}', '{OPIS_TRUDNOSCI}', '{TEMATY}', '{TEMATY_JSON}', '{LICZBA_PYTAN}', '{JEZYK}', '{DATA}', '{DATA_KROTKA}', '{LICZBA_STACJI}']) {
    assert.ok(SZABLON_PROMPTU.includes(token), `brak placeholdera ${token}`);
  }
  assert.ok(!SZABLON_PROMPTU.includes('```'), 'szablon nie może zawierać ogrodzenia z odwrotnych apostrofów');
});

test('zbudujPrompt: temat własny wstawia tekst organizatora do listy dziedzin', () => {
  const { prompt, usterki } = zbudujPrompt({
    konfig: konfiguracja({ tematy: ['historia', 'wlasny'], tematWlasny: 'kinematografia' }),
    okolica: { ...SRODEK, promienM: 1000, miejsce: OK.okolica.miejsce },
    stacje: STACJE,
    teraz: TERAZ,
  });
  assert.deepEqual(usterki, []);
  assert.ok(prompt.includes('wlasny (kinematografia)'), 'dziedzina własna w opisie dla modelu');
  assert.ok(prompt.includes('"wlasny"'), 'klucz wlasny na liście JSON');
});

test('zbudujPrompt: podstawia wszystkie placeholdery i nie zostawia dziur', () => {
  const { prompt, usterki } = zbudujPrompt({
    konfig: konfiguracja(),
    okolica: { ...SRODEK, promienM: 1000, miejsce: OK.okolica.miejsce },
    stacje: STACJE,
    teraz: TERAZ,
  });
  assert.deepEqual(usterki, []);
  assert.ok(prompt);
  assert.ok(!/\{[A-Z_]+\}/.test(prompt), 'został niepodstawiony placeholder');
  assert.ok(prompt.includes('52.23178, 21.01234'));
  assert.ok(prompt.includes('Grabowice, Stare Miasto, woj. mazowieckie, Polska'));
  assert.ok(prompt.includes('- stacja 1: ') && prompt.includes('- stacja 3: '));
  assert.ok(prompt.includes('m od środka gry'), 'linie stacji mają dystans od środka');
  assert.ok(prompt.includes('Bez ograniczeń długości i słownictwa'), 'opis trudności dla dorosłych');
  assert.ok(prompt.includes('historia (dzieje miejsca'), 'temat z opisem z kanonu');
  assert.ok(prompt.includes('"historia", "architektura"'), 'lista tematów w schemacie JSON');
  assert.ok(prompt.includes('liczba pytań łącznie: 3'));
  assert.ok(prompt.includes('liczba graczy: 2'));
  assert.ok(prompt.includes('2026-09-05 23:59') && prompt.includes('"2026-09-05"'));
});

test('zbudujPrompt: brak miejsca daje jawny komunikat, nie pustą lukę', () => {
  const { prompt } = zbudujPrompt({
    konfig: konfiguracja(),
    okolica: { ...SRODEK, promienM: 1000, miejsce: '' },
    stacje: STACJE,
    teraz: TERAZ,
  });
  assert.ok(prompt.includes('brak odczytu (tylko współrzędne)'));
});

test('zbudujPrompt: odmawia bez pozycji, bez stacji i przy rozjeździe liczb', () => {
  const bezPozycji = zbudujPrompt({ konfig: konfiguracja(), okolica: { lat: null, lon: null }, stacje: STACJE });
  assert.equal(bezPozycji.prompt, null);
  assert.ok(bezPozycji.usterki.some((u) => u.kod === 'WE02'));

  const bezStacji = zbudujPrompt({ konfig: konfiguracja(), okolica: { ...SRODEK, promienM: 1000, miejsce: 'x' }, stacje: [] });
  assert.equal(bezStacji.prompt, null);
  assert.ok(bezStacji.usterki.some((u) => u.kod === 'WE03'));

  const rozjazd = zbudujPrompt({ konfig: konfiguracja({ liczbaStacji: 5 }), okolica: { ...SRODEK, promienM: 1000, miejsce: 'x' }, stacje: STACJE });
  assert.equal(rozjazd.prompt, null);
  assert.ok(rozjazd.usterki.some((u) => u.kod === 'WE06'));
});

/* ------------------------------------------------------------- parsowanie */

test('parsujOdpowiedzModela: przyjmuje blok json, blok bez języka i surowy JSON', () => {
  const zOgrodzeniem = parsujOdpowiedzModela(`Oto paczka:\n\`\`\`json\n${JSON.stringify(OK)}\n\`\`\`\nMam nadzieję, że się przyda.`);
  assert.equal(zOgrodzeniem.blad, null);
  assert.equal(zOgrodzeniem.paczka.pytania.length, 3, 'paczka przyszła w całości');

  const bezJezyka = parsujOdpowiedzModela(`\`\`\`\n${JSON.stringify(OK)}\n\`\`\``);
  assert.equal(bezJezyka.blad, null);
  assert.equal(bezJezyka.paczka.pytania.length, 3);

  const surowy = parsujOdpowiedzModela(JSON.stringify(OK));
  assert.equal(surowy.blad, null);

  const zSzumem = parsujOdpowiedzModela(`Wstęp.\n${JSON.stringify(OK)}\nPodsumowanie.`);
  assert.equal(zSzumem.blad, null);
  assert.equal(zSzumem.paczka.pytania.length, 3);
});

test('parsujOdpowiedzModela: dwa bloki, śmieci i puste pole dają E02', () => {
  const dwaBloki = parsujOdpowiedzModela(`\`\`\`json\n{}\n\`\`\`\n\`\`\`json\n{}\n\`\`\``);
  assert.equal(dwaBloki.paczka, null);
  assert.equal(dwaBloki.blad.kod, 'E02');
  assert.match(dwaBloki.blad.komunikat, /2 bloki/);

  assert.equal(parsujOdpowiedzModela('to nie jest JSON').blad.kod, 'E02');
  assert.equal(parsujOdpowiedzModela('').blad.kod, 'E02');
  assert.equal(parsujOdpowiedzModela(null).blad.kod, 'E02');
});

/* -------------------------------------------------------------- walidacja */

test('walidujPaczke: fixture OK przechodzi bez usterek', () => {
  assert.deepEqual(walidujPaczke(OK, oczekiwane()), []);
});

test('walidujPaczke: paczka bez markera protokołu przechodzi, a dopisany marker jest ignorowany (ADR 0050)', () => {
  // Błąd, który to wywołał: model NIE pisze już markera („to tylko obciążenie
  // dla AI”), więc brak pola `protokol` nie jest usterką. Stary nawyk modelu
  // albo paczka sprzed zmiany — pole jest po prostu ignorowane.
  const bezMarkera = structuredClone(OK);
  delete bezMarkera.protokol;
  assert.deepEqual(kody(bezMarkera), [], 'brak `protokol` nie budzi żadnej usterki');
  const zMarkerem = structuredClone(OK);
  zMarkerem.protokol = 'PYT/1.0-rev4';
  assert.deepEqual(kody(zMarkerem), [], 'dopisany marker jest ignorowany, nie odrzuca paczki');
  zMarkerem.protokol = 'PYT/2.0';
  assert.deepEqual(kody(zMarkerem), [], 'obcy marker też jest ignorowany — liczy się zawartość, nie etykieta');
  assert.ok(!kody(bezMarkera).includes('E01'), 'E01 wycofany (ADR 0050)');
});

test('szablon §2: numer odpowiedzi 1..4, zero markerów i kodowania', () => {
  for (const fraza of [
    '"poprawna": numer poprawnej odpowiedzi',
    '"poprawna": 2',
    'SCHEMAT ODPOWIEDZI — dokładnie te pola',
  ]) {
    assert.ok(SZABLON_PROMPTU.includes(fraza), `w szablonie brakuje: ${fraza}`);
  }
  // ADR 0050: model nie pisze markera protokołu ani nie liczy żadnego kodu.
  assert.ok(!SZABLON_PROMPTU.includes('protokol'), 'szablon §2 nie wspomina pola `protokol`');
  assert.ok(!SZABLON_PROMPTU.includes('rev4') && !SZABLON_PROMPTU.includes('rev5'), 'markerów wariantów nie ma');
  assert.ok(!SZABLON_PROMPTU.includes('ZAKODOWANY'));
  // Właściciel 2026-09-15 (b): prompt mówi, CO model ma robić — o indeksie
  // 0..3 nie ma w nim ani słowa, a pole `poprawna` opisuje jedna linia.
  assert.ok(!SZABLON_PROMPTU.includes('indeks'), 'szablon §2 nie wspomina indeksu');
  assert.ok(SZABLON_PROMPTU.includes('- "poprawna": numer poprawnej odpowiedzi.'),
    'szablon §2 opisuje `poprawna` jednym zdaniem: numer poprawnej odpowiedzi');
  assert.ok(!SZABLON_PROMPTU.includes('bez kodowania'), 'żadnej negacji o kodowaniu');
  assert.ok(!SZABLON_PROMPTU.includes('2 + 2 + 1 + 17'), 'przykładu kodu pozycyjnego nie ma');
  // Uwagi terenowe G.b (właściciel, 2026-09-12): zdanie „zapisz NORMALNIE… niczego
  // nie odwracaj ani nie szyfruj. Ukryty jest wyłącznie numer…” usunięte z zasady 8
  // — samo jego pisanie mogło modelowi zasugerować, że cokolwiek trzeba zakodować.
  for (const zakazana of [
    'ODWRÓCONE ZNAKAMI',
    'ODCZYTAJ każde odwrócone pole od końca',
    'toK',
    'zapisz NORMALNIE',
    'niczego nie odwracaj ani nie szyfruj',
    'Ukryty jest wyłącznie numer',
  ]) {
    assert.ok(!SZABLON_PROMPTU.includes(zakazana), `szablon §2 nie może zawierać: ${zakazana}`);
  }
});

/* ------ rev3 / ADR 0032: wariant bez fact-check (domyślny) ------ */

function wejscieBudowy(nadpisanie = {}) {
  return {
    konfig: konfiguracja(),
    okolica: { ...SRODEK, promienM: 1000, miejsce: OK.okolica.miejsce },
    stacje: STACJE,
    teraz: TERAZ,
    ...nadpisanie,
  };
}

test('ADR 0032: szablon bez weryfikacji NICZEGO nie narzuca o źródłach faktów', () => {
  // Właściciel 2026-09-09: „W prompcie wprost zakazujesz szukania źródeł
  // w internecie i nakazujesz używania pamięci treningowej. Po co? Po prostu
  // nie wymuszaj niczego. (…) Może nie ma nic w pamięci treningowej i wyszuka,
  // a nie że zakazujesz."
  assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.length > 2000, `szablon §2.2 ma ${SZABLON_PROMPTU_BEZ_WERYFIKACJI.length} znaków — wygląda na niekompletny`);
  for (const fraza of [
    'Podawaj wyłącznie fakty, których jesteś pewien',
    'Sposób ich ustalenia zostawiamy Tobie',
    'OPCJONALNE',
    'przy braku pewności zostaw pole puste',
    'SCHEMAT ODPOWIEDZI — dokładnie te pola',
    '"poprawna": numer poprawnej odpowiedzi',
  ]) {
    assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes(fraza), `w szablonie §2.2 brakuje: ${fraza}`);
  }
  // G.b (2026-09-12): jak w §2 — żadnego zdania o zapisie „NORMALNIE”/zakazie
  // kodowania (szablon nofc.3).
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('zapisz NORMALNIE'), 'szablon §2.2 bez zdania „zapisz NORMALNIE” (G.b)');
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('niczego nie odwracaj ani nie szyfruj'), 'szablon §2.2 bez zakazu odwracania/szyfrowania (G.b)');

  // SEDNO zgłoszenia: żadnego zakazu ani nakazu co do sposobu zdobycia faktu.
  for (const zakaz of [
    'NIE wykonuj kwerendy',
    'NIE wymaga sprawdzania faktów w internecie',
    'WYŁĄCZNIE z własnej wiedzy',
    'pamięci treningowej',
    'bez kwerendy w internecie',
  ]) {
    assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes(zakaz),
      `szablon §2.2 nadal wymusza sposób zdobycia faktu: „${zakaz}"`);
  }
  // B2 + ADR 0050: ani odwracania, ani markera protokołu w wariancie bez fact-check.
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('ODWRÓCONE ZNAKAMI'),
    'szablon §2.2 nie żąda już odwracania');
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('protokol'),
    'szablon §2.2 nie wspomina pola `protokol` (ADR 0050)');
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('wykonaj kwerendę w internecie'),
    'twarda kwerenda z §2 nie przecieka do §2.2');
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('indeks'), 'szablon §2.2 nie wspomina indeksu');
  assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('- "poprawna": numer poprawnej odpowiedzi.'),
    'szablon §2.2 opisuje `poprawna` jednym zdaniem: numer poprawnej odpowiedzi');
  for (const token of ['{LAT}', '{LON}', '{MIEJSCE}', '{PROMIEN_M}', '{TRYB}', '{LISTA_STACJI}', '{LICZBA_GRACZY}', '{WIEK}', '{OPIS_TRUDNOSCI}', '{TEMATY}', '{TEMATY_JSON}', '{LICZBA_PYTAN}', '{JEZYK}', '{DATA}', '{DATA_KROTKA}', '{LICZBA_STACJI}']) {
    assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes(token), `brak placeholdera ${token} w §2.2`);
  }
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('```'), 'szablon nie może zawierać ogrodzenia z odwrotnych apostrofów');
});

test('zbudujPrompt: domyślnie bez weryfikacji (§2.2), fact-check na życzenie (§2), bez markerów', () => {
  const domyslny = zbudujPrompt(wejscieBudowy());
  assert.deepEqual(domyslny.usterki, []);
  assert.ok(!domyslny.prompt.includes('wykonaj kwerendę w internecie'), 'domyślny prompt nie żąda kwerendy');
  assert.ok(domyslny.prompt.includes('numer poprawnej odpowiedzi'), 'domyślny prompt uczy podawać numer odpowiedzi');
  const jawnyBez = zbudujPrompt(wejscieBudowy({ factcheck: false }));
  assert.equal(jawnyBez.prompt, domyslny.prompt, 'jawne factcheck:false = domyślne');
  const fc = zbudujPrompt(wejscieBudowy({ factcheck: true }));
  assert.deepEqual(fc.usterki, []);
  assert.ok(fc.prompt.includes('wykonaj kwerendę w internecie'), 'prompt z fact-check żąda kwerendy');
  for (const prompt of [domyslny.prompt, fc.prompt]) {
    assert.ok(!prompt.includes('PYT/1.0-rev') && !prompt.includes('"protokol"'),
      'żaden prompt nie każe modelowi pisać markera protokołu (ADR 0050)');
  }
});

test('E09: źródła wymagane przy fact-checku, opcjonalne bez niego — decyduje aplikacja, nie marker', () => {
  // ADR 0032 + ADR 0050: profil źródeł wynika z ptaszka w setupie. Ten sam brak
  // źródeł jest usterką przy `factcheck: true` i jest w porządku przy
  // `factcheck: false` — model nie zgłasza niczego w JSON-ie.
  const bezZrodel = structuredClone(OK);
  for (const pyt of bezZrodel.pytania) delete pyt.zrodla;
  assert.ok(kody(bezZrodel).includes('E09'), 'domyślnie (fact-check) brak źródeł to E09');
  assert.deepEqual(kody(bezZrodel, oczekiwane({ factcheck: false })), [], 'bez fact-checku brak źródeł przechodzi');

  // Kształt podanego źródła sprawdzany jest zawsze; komunikat E10 mówi, co zrobić.
  const przyklad = structuredClone(OK);
  przyklad.pytania[0].zrodla = [{ url: 'https://przyklad.org/haslo', tytul: 'Tytuł źródła', sprawdzono: '2026-09-05' }];
  const e10 = walidujPaczke(przyklad, oczekiwane({ factcheck: false })).find((u) => u.kod === 'E10');
  assert.ok(e10, 'przykładowy adres to usterka także bez fact-checku');
  assert.match(e10.komunikat, /opcjonalne/, 'bez fact-checku E10 podpowiada usunięcie, nie kwerendę');
  const e10fc = walidujPaczke(przyklad, oczekiwane()).find((u) => u.kod === 'E10');
  assert.match(e10fc.komunikat, /z kwerendy/, 'z fact-checkiem E10 przypomina o kwerendzie');
});

test('walidujPaczke: E03 — liczba pytań niezgodna z setupem', () => {
  assert.ok(kody(OK, oczekiwane({ liczbaPytan: 5 })).includes('E03'));
});

test('walidujPaczke: E04/E05 — stacja poza zakresem i stacja bez pytania', () => {
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].stacja = 9; })).includes('E04'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].stacja = 0; })).includes('E04'));
  // wszystkie pytania na jednej stacji → dwie stacje puste (E05) + nierówny rozkład
  const u = kody(klonyPaczki((p) => { p.pytania.forEach((q) => { q.stacja = 1; }); }));
  assert.ok(u.includes('E05'));
});

test('walidujPaczke: E06/E07/E08 — odpowiedzi', () => {
  // ADR 0050: `poprawna` to NUMER odpowiedzi 1..4. Zero i piątka to usterki,
  // a czwórka jest pełnoprawną odpowiedzią (w numeracji 0..3 była błędem —
  // to właśnie ta różnica oceniała trzecią odpowiedź jako czwartą).
  assert.deepEqual(kody(klonyPaczki((p) => { p.pytania[0].poprawna = 4; })), [], 'czwarta odpowiedź jest poprawna');
  assert.deepEqual(kody(klonyPaczki((p) => { p.pytania[0].poprawna = 1; })), [], 'pierwsza odpowiedź jest poprawna');
  for (const zla of [0, -1, 5, 3.5]) {
    assert.ok(kody(klonyPaczki((p) => { p.pytania[0].poprawna = zla; })).includes('E06'), `${zla} to nie numer 1..4`);
  }
  const e06 = walidujPaczke(klonyPaczki((p) => { p.pytania[0].poprawna = 0; }), oczekiwane()).find((u) => u.kod === 'E06');
  assert.match(e06.komunikat, /Numer poprawnej odpowiedzi/, 'komunikat mówi wprost: to numer, nie indeks');
  assert.match(e06.komunikat, /1\.\.4/, 'komunikat podaje zakres 1..4');
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].odpowiedzi.pop(); })).includes('E07'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].odpowiedzi.push('piąta'); })).includes('E07'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].odpowiedzi[1] = ''; })).includes('E07'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].odpowiedzi[1] = p.pytania[0].odpowiedzi[0].toUpperCase(); })).includes('E08'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].odpowiedzi[1] = 'wszystkie powyższe'; })).includes('E15'));
});

test('walidujPaczke: E09/E10/E11 — źródła są wymagane i muszą być prawdziwe', () => {
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla = []; })).includes('E09'));
  assert.ok(kody(klonyPaczki((p) => { delete p.pytania[0].zrodla; })).includes('E09'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].url = 'wikipedia'; })).includes('E10'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].url = 'https://example.com/haslo'; })).includes('E10'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].url = 'https://cos.przyklad.org/x'; })).includes('E10'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].url = 'https://fakt.invalid/x'; })).includes('E10'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].tytul = ''; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].sprawdzono = '05.09.2026'; })).includes('E11'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].zrodla[0].sprawdzono = '2026-09-09'; })).includes('E11'));
});

test('walidujPaczke: E12/E13 — temat spoza kanonu i duplikat treści', () => {
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].temat = 'kosmos'; })).includes('E12'));
  assert.ok(kody(klonyPaczki((p) => { p.tematy = ['historia', 'kosmos']; })).includes('E12'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[1].tresc = p.pytania[0].tresc; })).includes('E13'));
});

test('walidujPaczke: stare klucze tematów (sprzed 2026-09-07) są aliasami, nie E12', () => {
  const stara = klonyPaczki((p) => {
    p.tematy = ['historia', 'nauka-i-technika'];
    p.pytania[0].temat = 'nauka-i-technika';
  });
  assert.ok(!kody(stara, oczekiwane({ tematy: ['historia', 'nauka'] })).includes('E12'), 'alias na liście i w pytaniu przyjęty');
  assert.ok(!kody(stara, oczekiwane({ tematy: ['historia', 'nauka'] })).includes('E16'), 'E16 porównuje po normalizacji');
  const znorm = normalizujTematyPaczki(stara);
  assert.deepEqual(znorm.tematy, ['historia', 'nauka']);
  assert.equal(znorm.pytania[0].temat, 'nauka');
});

test('walidujPaczke: E16/E17 — spójność z konfiguracją gry i zakres współrzędnych', () => {
  assert.ok(kody(klonyPaczki((p) => { p.okolica.promienM = 5000; })).includes('E16'));
  assert.ok(kody(klonyPaczki((p) => { p.okolica.lat = 51.0; })).includes('E16'));
  assert.ok(kody(klonyPaczki((p) => { p.wiek = '12'; })).includes('E16'));
  assert.ok(kody(klonyPaczki((p) => { p.jezyk = 'angielski'; })).includes('E16'));
  assert.ok(kody(klonyPaczki((p) => { p.tematy = ['historia']; })).includes('E16'));
  assert.ok(kody(klonyPaczki((p) => { p.okolica.lat = 999; })).includes('E17'));
});

test('walidujPaczke: E19/E20 — identyfikatory i wyjaśnienia (E18 wycofany w rev2)', () => {
  assert.ok(!kody(klonyPaczki((p) => { p.pytania[0].punkty = 5; })).includes('E18'), 'pole punkty ignorowane');
  assert.deepEqual(kody(klonyPaczki((p) => { for (const q of p.pytania) delete q.punkty; })), [], 'schemat bez punktów przechodzi czysto');
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].id = 'pyt1'; })).includes('E19'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[1].id = p.pytania[0].id; })).includes('E19'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].wyjasnienie = 'Bo tak.'; })).includes('E20'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].wyjasnienie = p.pytania[0].tresc; })).includes('E20'));
});

test('walidujPaczke: E15 — pola wymagane i brzegowe wartości treści', () => {
  assert.ok(kody(klonyPaczki((p) => { delete p.uwagi; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { p.okolica.miejsce = ''; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].tresc = 'Krótkie?'; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].tresc = `${'Bardzo długie pytanie bez znaku zapytania '.repeat(5)}`; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].tresc = `${'x'.repeat(401)}?`; })).includes('E15'));
  assert.ok(kody(klonyPaczki((p) => { delete p.pytania; })).includes('E15'));
  assert.ok(kody(null).includes('E15'));
  assert.ok(kody([]).includes('E15'));
});

test('walidujPaczke: E11 — data utworzenia w przyszłości', () => {
  const u = walidujPaczke(klonyPaczki((p) => { p.utworzono = '2026-09-06 10:00'; }), oczekiwane()).map((x) => x.kod);
  assert.ok(u.includes('E11'));
  assert.ok(kody(klonyPaczki((p) => { p.utworzono = '5 września 2026'; })).includes('E11'));
});

/* ------------------------- zakotwiczenie: prośba w prompcie, nie bramka E14 */

/**
 * Zgłoszenie właściciela 2026-09-09: „przy niektórych kategoriach (szczególnie
 * tych custom) nigdy nie będzie nawiązania do miejsca i będą pytania z wiedzy
 * ogólnej. To jak najbardziej dopuszczalne i pożądane. Ten test i błąd jest bez
 * sensu." Heurystyka `E14` została usunięta — te testy pilnują, żeby nie
 * wróciła tylnymi drzwiami.
 */
test('walidujPaczke: pytanie z wiedzy ogólnej PRZECHODZI — E14 nie istnieje', () => {
  const ogolna = klonyPaczki((p) => {
    p.pytania[0].tresc = 'W którym roku wybuchła druga wojna światowa?';
    p.pytania[0].wyjasnienie = 'Druga wojna światowa wybuchła 1 września 1939 roku i była największym konfliktem w dziejach ludzkości.';
    p.pytania[1].tresc = 'Kto napisał „Pana Tadeusza"?';
    p.pytania[1].wyjasnienie = 'Adam Mickiewicz ukończył poemat w Paryżu w 1834 roku, na emigracji po powstaniu listopadowym.';
  });
  const usterki = kody(ogolna);
  assert.ok(!usterki.includes('E14'), 'kod E14 nie jest już przydzielany');
  assert.deepEqual(usterki, [], 'paczka z pytaniami ogólnymi przechodzi walidację czysto');
});

test('protokół: kod E14 jest wycofany w kodzie i w dokumentacji', () => {
  const zrodlo = readFileSync(new URL('../app/protokol.js', import.meta.url), 'utf8');
  assert.ok(!/dodaj\('E14'/.test(zrodlo), 'walidator nie zgłasza E14');
  for (const symbol of ['czyZakotwiczone', 'tokenyWlasne', 'TOKENY_MIEJSCA', 'SLOWA_POSPOLITE', 'WYRAZY_POSPOLITE_MIEJSCA', 'SKROTY_Z_KROPKA']) {
    assert.ok(!new RegExp(`export (const|function) ${symbol}\\b`).test(zrodlo), `${symbol} usunięty razem z heurystyką`);
  }
  const protokol = readFileSync(new URL('../docs/PROTOKOL.md', import.meta.url), 'utf8');
  assert.match(protokol, /\| `E14` \| wycofany/, 'tabela kodów mówi wprost, że E14 jest wycofany');
});

test('prompt: zakotwiczenie zostaje PROŚBĄ — oba warianty dopuszczają pytanie ogólne', () => {
  for (const [nazwa, szablon] of [['rev4', SZABLON_PROMPTU], ['rev5', SZABLON_PROMPTU_BEZ_WERYFIKACJI]]) {
    assert.ok(!szablon.includes('Czyste pytania ogólne bez kotwicy są zakazane'),
      `${nazwa}: zakaz pytań ogólnych zniknął z zasady 4`);
    assert.match(szablon, /wiedzy ogólnej jest w porządku/,
      `${nazwa}: prompt wprost dopuszcza pytanie ogólne, gdy temat nie ma lokalnego zaczepienia`);
    assert.match(szablon, /Kotwicz pytanie możliwie blisko okolicy/,
      `${nazwa}: prośba o kotwicę zostaje — to nadal gra terenowa`);
  }
});

test('podsumowaniePaczki: liczby dla ekranu organizatora', () => {
  const s = podsumowaniePaczki(OK);
  assert.equal(s.liczbaPytan, 3);
  assert.deepEqual(s.stacje, [1, 2, 3]);
  assert.deepEqual(s.tematy, ['architektura', 'historia']);
  assert.equal(s.liczbaZrodel, 3);
  assert.equal(s.punktyRazem, 3, 'rev2: razem = liczba pytań (1 pkt za pytanie)');
  assert.match(s.uwagi, /FIXTURE TESTOWY/);
  assert.deepEqual(podsumowaniePaczki(null), { liczbaPytan: 0, stacje: [], tematy: [], liczbaZrodel: 0, punktyRazem: 0, uwagi: '' });
});

test('stałe protokołu: wersja PYT/1.1', () => {
  assert.equal(WERSJA_PROTOKOLU, 'PYT/1.1', 'wersja po zmianie numeracji na 1..4 (ADR 0050)');
});

/* --------- ADR 0050: jedna postać paczki, numer odpowiedzi 1..4, bez ukrywania --------- */

test('ADR 0050: paczka ma jedną postać — żadnych markerów, kodów ani odwracania', () => {
  // Paczka z fixture jest w postaci, którą pisze model: bez `protokol`,
  // z numerem poprawnej odpowiedzi i jawnym tekstem.
  assert.equal('protokol' in OK, false, 'fixture nie ma markera (model go nie pisze)');
  assert.deepEqual(walidujPaczke(structuredClone(OK), oczekiwane()), [], 'jedna postać przechodzi walidację');
  for (const pyt of OK.pytania) {
    assert.ok(Number.isInteger(pyt.poprawna) && pyt.poprawna >= 1 && pyt.poprawna <= 4,
      `numer poprawnej odpowiedzi w zakresie 1..4 (jest ${pyt.poprawna})`);
  }
});

test('ADR 0050: paczka jedzie jawnym JSON-em — pytania widać bez żadnego narzędzia', () => {
  // Tak paczka leży w pamięci telefonu i na Drive: czysty JSON (właściciel
  // 2026-09-15: „żadne ukrywanie nie jest potrzebne"). Ten test pilnuje, że
  // nikt nie przywróci kodowania po cichu — ani w zapisie, ani w odczycie.
  const zPieczatka = { ...structuredClone(OK), factcheck: true };
  const tekst = JSON.stringify(zPieczatka);
  assert.ok(tekst.includes(OK.pytania[0].tresc), 'treść pytania jest czytelna w zapisie');
  assert.ok(tekst.includes(OK.pytania[0].odpowiedzi[0]), 'odpowiedzi też');
  const paczka = JSON.parse(tekst);
  assert.deepEqual(paczka.pytania.map((p) => p.poprawna), OK.pytania.map((p) => p.poprawna),
    'zapis i odczyt nie ruszają numeru poprawnej odpowiedzi');
  assert.equal(paczka.factcheck, true, 'pieczątka fact-checku (nadana przez aplikację) przeżywa zapis');
  assert.deepEqual(walidujPaczke(paczka, oczekiwane()), [], 'odczytana paczka waliduje się czysto');
});

test('ADR 0050: paczka bez źródeł z pieczątką „bez fact-checku” nie budzi E09 po zapisie i odczycie', () => {
  const bezZrodel = { ...structuredClone(OK), factcheck: false };
  for (const pyt of bezZrodel.pytania) delete pyt.zrodla;
  assert.deepEqual(walidujPaczke(bezZrodel, oczekiwane({ factcheck: false })), []);
  const paczka = JSON.parse(JSON.stringify(bezZrodel)); // tak wraca z pamięci telefonu
  assert.equal(paczka.factcheck, false, 'pieczątka przeżyła zapis');
  assert.deepEqual(walidujPaczke(paczka, oczekiwane({ factcheck: paczka.factcheck })), [],
    're-wklejenie paczki bez fact-checku nie budzi E09');
});
