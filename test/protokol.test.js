/**
 * Testy protokołu PYT (app/protokol.js): budowa promptu, parsowanie odpowiedzi
 * modelu i walidacja paczki z kodami usterek E01–E20.
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
  SCHEMAT_KONTENERA, SZABLON_PROMPTU, TOKENY_MIEJSCA, WERSJA_PROTOKOLU,
  czyZakotwiczone, normalizujTekst, normalizujTematyPaczki, parsujOdpowiedzModela, podsumowaniePaczki,
  poprawkaDlaModelu, rdzenTokena, tokenyWlasne, walidujPaczke, zbudujPrompt,
  zastosujEdycjePaczki, EDYTOWALNE_POLA,
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
    'Nie opieraj się na pamięci modelu',
    '"zrodla"',
    'Nie wymyślaj nazw, dat, liczb, cytatów',
    'WYŁĄCZNIE jako jeden blok kodu json',
    'OKOLICA GRY:',
    'STACJE (kolejność = kolejność w grze',
    'GRACZE I TRUDNOŚĆ:',
    'SCHEMAT ODPOWIEDZI (PYT/1.0)',
    'WYMAGANIA DODATKOWE:',
    '"poprawna": indeks poprawnej odpowiedzi',
  ]) {
    assert.ok(SZABLON_PROMPTU.includes(fraza), `w szablonie brakuje: ${fraza}`);
  }
  // wszystkie placeholdery z protokołu §2.1 muszą być w szablonie
  for (const token of ['{LAT}', '{LON}', '{MIEJSCE}', '{PROMIEN_M}', '{TRYB}', '{LISTA_STACJI}', '{LICZBA_GRACZY}', '{WIEK}', '{OPIS_TRUDNOSCI}', '{TEMATY}', '{TEMATY_JSON}', '{LICZBA_PYTAN}', '{JEZYK}', '{DATA}', '{DATA_KROTKA}', '{LICZBA_STACJI}']) {
    assert.ok(SZABLON_PROMPTU.includes(token), `brak placeholdera ${token}`);
  }
  assert.ok(!SZABLON_PROMPTU.includes('```'), 'szablon nie może zawierać ogrodzenia z odwrotnych apostrofów');
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
  assert.equal(zOgrodzeniem.paczka.protokol, WERSJA_PROTOKOLU);

  const bezJezyka = parsujOdpowiedzModela(`\`\`\`\n${JSON.stringify(OK)}\n\`\`\``);
  assert.equal(bezJezyka.blad, null);
  assert.equal(bezJezyka.paczka.pytania.length, 3);

  const surowy = parsujOdpowiedzModela(JSON.stringify(OK));
  assert.equal(surowy.blad, null);

  const zSzumem = parsujOdpowiedzModela(`Wstęp.\n${JSON.stringify(OK)}\nPodsumowanie.`);
  assert.equal(zSzumem.blad, null);
  assert.equal(zSzumem.paczka.protokol, WERSJA_PROTOKOLU);
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

test('walidujPaczke: E01 — zła albo brakująca wersja protokołu', () => {
  assert.ok(kody(klonyPaczki((p) => { p.protokol = 'PYT/2.0'; })).includes('E01'));
  assert.ok(kody(klonyPaczki((p) => { delete p.protokol; })).includes('E01'));
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
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].poprawna = 4; })).includes('E06'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].poprawna = -1; })).includes('E06'));
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

test('walidujPaczke: E12/E13/E14 — temat, duplikaty i zakotwiczenie w okolicy', () => {
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].temat = 'kosmos'; })).includes('E12'));
  assert.ok(kody(klonyPaczki((p) => { p.tematy = ['historia', 'kosmos']; })).includes('E12'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[1].tresc = p.pytania[0].tresc; })).includes('E13'));
  assert.ok(kody(klonyPaczki((p) => {
    p.pytania[0].tresc = 'W którym roku wybuchła druga wojna światowa?';
    p.pytania[0].wyjasnienie = 'Druga wojna światowa wybuchła 1 września 1939 roku i była największym konfliktem w dziejach ludzkości.';
  })).includes('E14'));
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

test('walidujPaczke: E18/E19/E20 — punkty, identyfikatory i wyjaśnienia', () => {
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].punkty = 5; })).includes('E18'));
  assert.ok(kody(klonyPaczki((p) => { p.pytania[0].punkty = 15; })).includes('E18'), 'dla dorosłych protokół przewiduje 20 pkt');
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

/* ------------------------------------------------- heurystyka zakotwiczenia */

test('czyZakotwiczone: odmiana nazwy miejsca jest rozpoznawana (rdzeń 5 znaków)', () => {
  const pytanie = { tresc: 'Przy jakiej ulicy stoi kamienica w warszawskim Śródmieściu?', wyjasnienie: 'Kamienica przy ulicy Zgoda w Warszawie powstała w 1912 roku jako dom dochodowy.' };
  assert.equal(czyZakotwiczone(pytanie, { miejsce: 'Warszawa, Śródmieście, Polska' }), true);
});

test('czyZakotwiczone: rdzeń trafia w początek wyrazu, nie w jego środek', () => {
  // „kościół" → rdzeń „kości": musi łapać „kościoła", ale nie „ludzkości".
  assert.equal(czyZakotwiczone({ tresc: 'Kiedy konsekrowano kościół św. Anny?', wyjasnienie: 'Konsekracja kościoła nastąpiła w 1782 roku.' }, { miejsce: 'Grabowice, Polska' }), true);
  assert.equal(
    czyZakotwiczone(
      { tresc: 'W którym roku wybuchła druga wojna światowa?', wyjasnienie: 'Była największym konfliktem w dziejach ludzkości i objęła całą Europę.' },
      { miejsce: 'Stare Miasto, woj. mazowieckie, Polska' },
    ),
    false,
    '„woj." nie może łapać „wojna", a „ludzkości" nie może uchodzić za „kościół"',
  );
});

test('tokenyWlasne: odrzuca wyrazy pospolite nazw administracyjnych i krótkie skróty', () => {
  const tokeny = tokenyWlasne({ miejsce: 'Grabowice, Stare Miasto, woj. mazowieckie, Polska' }, []);
  assert.ok(tokeny.includes('grabowice'));
  assert.ok(tokeny.includes('mazowieckie'), 'nazwa regionu jest kotwicą');
  assert.ok(!tokeny.includes('stare') && !tokeny.includes('miasto'), '„Stare Miasto" to nie nazwa własna');
  assert.ok(!tokeny.includes('woj'), 'skrót 3-literowy daje fałszywe trafienia');
  assert.ok(!tokeny.includes('polska'), '„Polska" jest wszędzie — nie kotwiczy niczego');
});

test('czyZakotwiczone: słowo lokalne + nazwa własna przechodzi, pytanie ogólne nie', () => {
  assert.equal(czyZakotwiczone({ tresc: 'Który most w Grabowicach zbudowano jako pierwszy?', wyjasnienie: 'Most nad stawem miejskim w Grabowicach oddano do użytku w 1901 roku.' }, { miejsce: 'Grabowice, Polska' }), true);
  assert.equal(czyZakotwiczone({ tresc: 'W którym roku wybuchła druga wojna światowa?', wyjasnienie: 'Druga wojna światowa wybuchła 1 września 1939 roku i była największym konfliktem w dziejach.' }, { miejsce: 'Grabowice, Polska' }), false);
  assert.equal(czyZakotwiczone({ tresc: '', wyjasnienie: '' }, { miejsce: 'Grabowice' }), false);
});

test('tokenyWlasne: odrzuca słowa pospolite i tokeny lokalne, zostawia nazwy', () => {
  const t = tokenyWlasne({ miejsce: 'Warszawa, Śródmieście, woj. mazowieckie, Polska' }, [{ opis: 'park Skaryszewski' }]);
  assert.ok(t.includes('warszawa'));
  assert.ok(t.includes('skaryszewski'));
  assert.ok(!t.includes('park'), 'słowo lokalne z TOKENY_MIEJSCA nie jest nazwą własną');
});

test('rdzenTokena i normalizujTekst: stabilna normalizacja do porównań', () => {
  assert.equal(rdzenTokena('Warszawa'), 'warsz');
  assert.equal(rdzenTokena('Ratusz'), 'ratus');
  assert.equal(rdzenTokena('most'), 'most');
  assert.equal(rdzenTokena(''), '');
  assert.equal(normalizujTekst('  Kościół św. Anny!  '), 'kościół św anny');
  assert.equal(normalizujTekst(null), '');
  assert.ok(TOKENY_MIEJSCA.includes('kościół') && TOKENY_MIEJSCA.includes('park'));
});

/* ------------------------------------------------------- poprawka i wynik */

test('poprawkaDlaModelu: wymienia kody usterek i przypomina zasady twarde', () => {
  const usterki = walidujPaczke(klonyPaczki((p) => { p.pytania[0].zrodla = []; p.pytania[1].temat = 'kosmos'; }), oczekiwane());
  assert.ok(usterki.length >= 2);
  const tekst = poprawkaDlaModelu(usterki, { liczbaPytan: liczbaPytan(konfiguracja()) });
  assert.ok(tekst.includes('[E09]') && tekst.includes('[E12]'));
  assert.ok(tekst.includes('PYT/1.0'));
  assert.ok(tekst.includes('kwerenda internetowa'));
  assert.ok(tekst.includes('wymagana liczba pytań: 3'));
});

test('podsumowaniePaczki: liczby dla ekranu organizatora', () => {
  const s = podsumowaniePaczki(OK);
  assert.equal(s.liczbaPytan, 3);
  assert.deepEqual(s.stacje, [1, 2, 3]);
  assert.deepEqual(s.tematy, ['architektura', 'historia']);
  assert.equal(s.liczbaZrodel, 3);
  assert.equal(s.punktyRazem, 60);
  assert.match(s.uwagi, /FIXTURE TESTOWY/);
  assert.deepEqual(podsumowaniePaczki(null), { liczbaPytan: 0, stacje: [], tematy: [], liczbaZrodel: 0, punktyRazem: 0, uwagi: '' });
});

test('stałe protokołu: wersja i schemat kontenera', () => {
  assert.equal(WERSJA_PROTOKOLU, 'PYT/1.0');
  assert.equal(SCHEMAT_KONTENERA, 'TO-paczka/2', 'kontener po decyzji z ADR 0007 (obfuskacja bez klucza)');
});

/* ------------------------------------- M5/J2: ręczna edycja paczki (ADR 0006 pkt 8) */

const TERAZ_MS = Date.UTC(2026, 8, 6, 10, 30);

function swiezaPaczka() {
  return JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));
}

test('edycja: poprawna treść i odpowiedź tworzą nową paczkę z modyfikacje[]', () => {
  const przed = swiezaPaczka();
  const id = przed.pytania[0].id;
  const nowaTresc = `${przed.okolica.miejsce} — pytanie poprawione ręcznie przez organizatora?`;
  const wynik = zastosujEdycjePaczki(przed, [
    { pytanieId: id, zmiany: { tresc: `  ${nowaTresc}  `, poprawna: 2 } },
  ], { terazMs: TERAZ_MS });

  assert.deepEqual(wynik.usterki, []);
  assert.equal(wynik.paczka.pytania[0].tresc, nowaTresc, 'treść zmieniona i przycięta');
  assert.equal(wynik.paczka.pytania[0].poprawna, 2);
  assert.equal(wynik.paczka.pytania.length, przed.pytania.length);
  assert.equal(wynik.modyfikacje.length, 1);
  assert.match(wynik.paczka.modyfikacje[0].data, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'data w formacie utworzono (PROTOKOL §3.1)');
  assert.equal(wynik.paczka.modyfikacje[0].opis, `pytanie ${id}: poprawiono treść pytania, poprawną odpowiedź`);

  // wejście nietknięte (niezmiennikowość jak w rozgrywka.js)
  assert.deepEqual(przed, swiezaPaczka(), 'oryginalna paczka bez mutacji');
  assert.notEqual(wynik.paczka, przed);

  // po edycji paczka wciąż przechodzi walidator protokołu
  const usterki = walidujPaczke(wynik.paczka, {});
  assert.deepEqual(usterki.map((u) => u.kod), [], `re-walidacja czysta, jest: ${JSON.stringify(usterki)}`);
});

test('edycja: modyfikacje[] dokleja się do istniejącej listy, a data jest deterministyczna', () => {
  const paczka = swiezaPaczka();
  paczka.modyfikacje = [{ data: '2026-09-01 09:00', opis: 'pytanie s1p1: poprawiono treść pytania' }];
  const id = paczka.pytania[0].id;
  const a = zastosujEdycjePaczki(paczka, [{ pytanieId: id, zmiany: { tresc: `${paczka.okolica.miejsce} — druga poprawka organizatora?` } }], { terazMs: TERAZ_MS });
  const b = zastosujEdycjePaczki(paczka, [{ pytanieId: id, zmiany: { tresc: `${paczka.okolica.miejsce} — druga poprawka organizatora?` } }], { terazMs: TERAZ_MS });
  assert.equal(a.paczka.modyfikacje.length, 2, 'stary wpis zostaje, nowy dochodzi');
  assert.equal(a.paczka.modyfikacje[0].opis, 'pytanie s1p1: poprawiono treść pytania');
  assert.deepEqual(a.paczka.modyfikacje[1], b.paczka.modyfikacje[1], 'ten sam zegar = ten sam wpis');
});

test('edycja: każda odmowa ma kod z kanonu E i atomowość — jedna zła edycja kasuje wszystkie', () => {
  const paczka = swiezaPaczka();
  const id = paczka.pytania[0].id;
  const dobre = { pytanieId: id, zmiany: { tresc: `${paczka.okolica.miejsce} — poprawna treść zastępcza?` } };

  const przypadki = [
    [[{ pytanieId: 's9p9', zmiany: { tresc: 'x?' } }], 'E19', /nie ma pytania/],
    [[{ pytanieId: id, zmiany: { temat: 'przyroda' } }], 'E15', /nie wolno edytować/],
    [[{ pytanieId: id, zmiany: { punkty: 20 } }], 'E15', /nie wolno edytować/],
    [[{ pytanieId: id, zmiany: { tresc: '   ' } }], 'E15', /nie może być pusta/],
    [[{ pytanieId: id, zmiany: { poprawna: 4 } }], 'E06', /poza zakresem/],
    [[{ pytanieId: id, zmiany: { poprawna: 1.5 } }], 'E06', /poza zakresem/],
    [[{ pytanieId: id, zmiany: { odpowiedzi: ['a', 'b', 'c'] } }], 'E07', /dokładnie 4/],
    [[{ pytanieId: id, zmiany: { odpowiedzi: ['a', '', 'c', 'd'] } }], 'E07', /dokładnie 4/],
    [[{ pytanieId: id, zmiany: { zrodla: [] } }], 'E09', /niepusta lista/],
    [[{ pytanieId: id, zmiany: { zrodla: [{ url: 'https://x.pl' }] } }], 'E09', /niepusta lista/],
    [[{ pytanieId: id, zmiany: { wyjasnienie: '' } }], 'E20', /nie może być puste/],
  ];
  for (const [edycje, kod, wzor] of przypadki) {
    const wynik = zastosujEdycjePaczki(paczka, edycje, { terazMs: TERAZ_MS });
    assert.equal(wynik.paczka, null, `odmowa dla ${kod}: paczka null`);
    assert.equal(wynik.usterki.length, 1);
    assert.equal(wynik.usterki[0].kod, kod);
    assert.match(wynik.usterki[0].komunikat, wzor);
  }

  // atomowość: dobra + zła edycja razem → NIC nie zostaje zastosowane
  const mieszany = zastosujEdycjePaczki(paczka, [dobre, { pytanieId: id, zmiany: { poprawna: 9 } }], { terazMs: TERAZ_MS });
  assert.equal(mieszany.paczka, null);
  assert.equal(mieszany.usterki.length, 1);
  assert.deepEqual(paczka, swiezaPaczka(), 'paczka wejściowa nietknięta także przy odmowie');
});

test('edycja: błędy strukturalne argumentów to TypeError, nie cichy null', () => {
  const paczka = swiezaPaczka();
  const id = paczka.pytania[0].id;
  assert.throws(() => zastosujEdycjePaczki(null, []), TypeError);
  assert.throws(() => zastosujEdycjePaczki(paczka, 'nie-lista'), TypeError);
  assert.throws(() => zastosujEdycjePaczki(paczka, [{ pytanieId: 12, zmiany: {} }]), TypeError);
  assert.throws(() => zastosujEdycjePaczki(paczka, [{ pytanieId: id, zmiany: [] }]), TypeError);
  assert.throws(() => zastosujEdycjePaczki(paczka, [null]), TypeError);
  assert.deepEqual(EDYTOWALNE_POLA, ['tresc', 'odpowiedzi', 'poprawna', 'wyjasnienie', 'zrodla']);
});

test('edycja: pełne odpowiedzi i źródła przechodzą, a paczka z edycją ukrywa się i wraca z modyfikacje[]', async () => {
  const { zapakujPaczke, odpakujPaczke } = await import('../app/kodowanie.js');
  const paczka = swiezaPaczka();
  const id = paczka.pytania[0].id;
  const wynik = zastosujEdycjePaczki(paczka, [{
    pytanieId: id,
    zmiany: {
      tresc: `${paczka.okolica.miejsce} — pytanie z kompletem nowych odpowiedzi?`,
      odpowiedzi: ['nowa pierwsza', 'nowa druga', 'nowa trzecia', 'nowa czwarta'],
      poprawna: 3,
      wyjasnienie: 'Organizator poprawił odpowiedzi po kwerendzie własnej: nowa czwarta jest potwierdzona źródłem z tablicy przy stacji.',
      zrodla: [{ url: 'https://muzeum-okolice.example.invalid/…' , tytul: 'Tablica przy stacji', sprawdzono: '2026-09-06' }],
    },
  }], { terazMs: TERAZ_MS });
  // uwaga: example.invalid jest domeną zarezerwowaną — walidator paczki ją odrzuci (E10),
  // ale zastosujEdycjePaczki sprawdza tylko kształt; to walidujPaczke jest kanonem treści
  assert.equal(wynik.paczka.pytania[0].zrodla[0].tytul, 'Tablica przy stacji');
  const kontener = zapakujPaczke(wynik.paczka, WERSJA_PROTOKOLU);
  const zPowrotem = odpakujPaczke(JSON.stringify(kontener));
  assert.equal(zPowrotem.paczka.pytania[0].tresc, wynik.paczka.pytania[0].tresc, 'edycja przeżywa rundę przez kontener');
  assert.deepEqual(zPowrotem.paczka.modyfikacje, wynik.paczka.modyfikacje, 'modyfikacje[] podróżuje z paczką (PROTOKOL §3.1)');
});
