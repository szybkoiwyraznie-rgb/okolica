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
  SCHEMAT_KONTENERA, SZABLON_PROMPTU, SZABLON_PROMPTU_BEZ_WERYFIKACJI, TOKENY_MIEJSCA, WERSJA_PROTOKOLU,
  WERSJA_PROTOKOLU_REV1, WERSJA_PROTOKOLU_REV2, WERSJA_PROTOKOLU_REV3,
  czyPaczkaOdwrocona, czyWariantFactcheck, czyZakotwiczone, normalizujTekst, normalizujTematyPaczki, numerPytaniaZId,
  odkodujPaczkeRev1, odkodujPaczkeRev2,
  odkodujPoprawnaRev2, zakodujPoprawnaRev2,
  odwrocPolaPaczki, odwrocTekst, parsujOdpowiedzModela, podsumowaniePaczki,
  poprawkaDlaModelu, rdzenTokena, tokenyWlasne, walidujPaczke, zbudujPrompt,
} from '../app/protokol.js';
import { domyslnaKonfiguracja, liczbaPytan } from '../app/konfig.js';
import { przesunPunkt } from '../app/geo.js';
import { odpakujPaczke, zapakujPaczke } from '../app/kodowanie.js';

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
    'SCHEMAT ODPOWIEDZI (PYT/1.0-rev4)',
    'WYMAGANIA DODATKOWE:',
    '"poprawna": ZAKODOWANY numer',
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

/* -------------------------------- Q2: wariant odwrócony PYT/1.0-rev1 (PROTOKOL §3.4) */

test('rev1: odwrocTekst działa po punktach kodowych (ogonki i emoji przeżywają)', () => {
  assert.equal(odwrocTekst('Kot'), 'toK');
  assert.equal(odwrocTekst('zażółć gęślą jaźń'), 'ńźaj ąlśęg ćłóżaz');
  assert.equal(odwrocTekst('A🏅B'), 'B🏅A', 'emoji to jeden punkt kodowy, nie para surrogate');
  assert.equal(odwrocTekst(odwrocTekst('Grabowice 1342?')), 'Grabowice 1342?', 'symetria');
});

test('rev1: round-trip — odwrocPolaPaczki ×2 wraca do oryginału, struktura nietknięta', () => {
  const raz = odwrocPolaPaczki(OK);
  assert.equal(raz.protokol, OK.protokol, 'marker nietknięty — odwraca tylko pola tekstowe');
  assert.equal(raz.pytania[0].tresc, odwrocTekst(OK.pytania[0].tresc));
  assert.deepEqual(raz.pytania[0].odpowiedzi, OK.pytania[0].odpowiedzi.map(odwrocTekst));
  assert.equal(raz.pytania[0].wyjasnienie, odwrocTekst(OK.pytania[0].wyjasnienie));
  assert.equal(raz.pytania[0].zrodla[0].tytul, odwrocTekst(OK.pytania[0].zrodla[0].tytul));
  assert.equal(raz.uwagi, odwrocTekst(OK.uwagi));
  // struktura nietknięta
  assert.equal(raz.pytania[0].id, OK.pytania[0].id);
  assert.equal(raz.pytania[0].poprawna, OK.pytania[0].poprawna);
  assert.equal(raz.pytania[0].punkty, OK.pytania[0].punkty);
  assert.equal(raz.pytania[0].zrodla[0].url, OK.pytania[0].zrodla[0].url);
  assert.deepEqual(odwrocPolaPaczki(raz), OK, 'dwukrotne odwrócenie = oryginał');
  assert.deepEqual(OK.protokol, 'PYT/1.0', 'fixture nie zmutowany');
});

test('rev1: paczka odwrócona przechodzi walidację jak jawna (E01 akceptuje marker)', () => {
  const rev1 = { ...odwrocPolaPaczki(OK), protokol: WERSJA_PROTOKOLU_REV1 };
  assert.equal(czyPaczkaOdwrocona(rev1), true);
  assert.equal(czyPaczkaOdwrocona(OK), false);
  assert.deepEqual(walidujPaczke(rev1, oczekiwane()), [], 'reguły tekstowe działają na odkodowanej treści');
  // a BEZ dekodera ta sama paczka by poległa: '?' jest na początku, nie na końcu
  assert.ok(!rev1.pytania[0].tresc.trim().endsWith('?'), 'sanity: odwrócona treść kończy się początkiem zdania');
});

test('rev1: odkodujPaczkeRev1 normalizuje marker, jawną przepuszcza bez zmian', () => {
  const rev1 = { ...odwrocPolaPaczki(OK), protokol: WERSJA_PROTOKOLU_REV1 };
  const robocza = odkodujPaczkeRev1(rev1);
  assert.equal(robocza.wariantWejsciowy, WERSJA_PROTOKOLU_REV1, 'dekoder stawia nośnik wariantu (ADR 0032 §3)');
  const { wariantWejsciowy, ...bezWariantu } = robocza;
  assert.ok(wariantWejsciowy, 'pole istnieje');
  assert.deepEqual(bezWariantu, OK, 'odkodowana = jawny oryginał z markerem PYT/1.0');
  assert.equal(odkodujPaczkeRev1(OK), OK, 'jawna paczka wraca tą samą referencją (zero kopiowania)');
});

/* ---------------- rev2: poprawna słownie od końca, koniec punktów (PROTOKOL §3.4) */

test('rev2: kod pozycyjny — indeks + stacja + numer pytania + 17, w obie strony', () => {
  assert.equal(numerPytaniaZId('s2p1'), 1);
  assert.equal(numerPytaniaZId('s12p10'), 10);
  assert.equal(numerPytaniaZId('pyt1'), null);
  assert.equal(zakodujPoprawnaRev2(2, { id: 's2p1', stacja: 2 }), 22, 'przykład z szablonu: 2 + 2 + 1 + 17');
  assert.equal(odkodujPoprawnaRev2(22, { id: 's2p1', stacja: 2 }), 2);
  assert.equal(odkodujPoprawnaRev2(20, { id: 's1p1', stacja: 1 }), 1);
  assert.equal(odkodujPoprawnaRev2(99, { id: 's1p1', stacja: 1 }), null, 'spoza zakresu indeksów');
  for (let i = 0; i <= 3; i++) {
    assert.equal(odkodujPoprawnaRev2(i, { id: 's1p1', stacja: 1 }), null, `goły indeks ${i} nigdy nie jest kodem (+10 rozłącza zakresy)`);
  }
  assert.equal(odkodujPoprawnaRev2(5, { id: 'pyt1', stacja: 2 }), null, 'bez id nie dekodujemy');
  assert.equal(odkodujPoprawnaRev2('awd', { id: 's2p1', stacja: 2 }), null, 'słowa nie wracają');
  assert.equal(zakodujPoprawnaRev2(9, { id: 's1p1', stacja: 1 }), null);
  // ten sam indeks w różnych pytaniach daje różne kody (niepowtarzalność)
  assert.notEqual(zakodujPoprawnaRev2(1, { id: 's1p1', stacja: 1 }), zakodujPoprawnaRev2(1, { id: 's1p2', stacja: 1 }));
});

test('rev2: paczka z kodami przechodzi, kod ląduje indeksem w roboczej', () => {
  const rev2 = { ...odwrocPolaPaczki(OK), protokol: WERSJA_PROTOKOLU_REV2 };
  rev2.pytania.forEach((p) => { p.poprawna = zakodujPoprawnaRev2(OK.pytania.find((q) => q.id === p.id).poprawna, p); });
  assert.equal(czyPaczkaOdwrocona(rev2), true);
  assert.deepEqual(walidujPaczke(rev2, oczekiwane()), [], 'rev2 waliduje się jak jawna');
  const robocza = odkodujPaczkeRev2(rev2);
  assert.equal(robocza.protokol, WERSJA_PROTOKOLU);
  assert.deepEqual(robocza.pytania.map((p) => p.poprawna), OK.pytania.map((p) => p.poprawna));
  assert.equal(odkodujPaczkeRev2(OK), OK, 'jawna wraca referencją');
});

test('rev2: obcy kod to E06 z regułą i przykładem, jawny indeks nie przechodzi', () => {
  const koduj = (paczka) => paczka.pytania.forEach((p) => {
    p.poprawna = zakodujPoprawnaRev2(OK.pytania.find((q) => q.id === p.id).poprawna, p);
  });
  const obca = { ...odwrocPolaPaczki(OK), protokol: WERSJA_PROTOKOLU_REV2 };
  koduj(obca);
  obca.pytania[0].poprawna = 99;
  const usterki = walidujPaczke(obca, oczekiwane());
  assert.ok(usterki.some((u) => u.kod === 'E06' && /indeks \+ stacja \+ numer pytania \+ 17/.test(u.komunikat)
    && /2 \+ 2 \+ 1 \+ 17 = 22/.test(u.komunikat)), 'E06 uczy reguły z przykładem');
  // jawny indeks 0–3 jako „kod" dekoduje się poza zakres (albo w inny indeks) —
  // model musi liczyć, nie przepisywać
  const jawnaJakoKod = { ...odwrocPolaPaczki(OK), protokol: WERSJA_PROTOKOLU_REV2 };
  assert.ok(kody(jawnaJakoKod).includes('E06'), 'gołe indeksy w rev2 nie przechodzą po cichu');
});

/**
 * B2 (decyzja właściciela 2026-09-09): odwracanie liter USUNIĘTE — modele
 * przekręcały wyrazy. Zostaje wyłącznie kod pozycyjny poprawnej odpowiedzi.
 */
test('rev4: szablon koduje poprawną, ale NIE każe odwracać tekstu (reguła 8)', () => {
  for (const fraza of [
    '"PYT/1.0-rev4"',
    'ZAKODOWANY numer poprawnej odpowiedzi',
    '2 + 2 + 1 + 17 = 22',
    'zapisz NORMALNIE',
  ]) {
    assert.ok(SZABLON_PROMPTU.includes(fraza), `w szablonie brakuje: ${fraza}`);
  }
  for (const zakazana of ['ODWRÓCONE ZNAKAMI', 'ODCZYTAJ każde odwrócone pole od końca', 'toK']) {
    assert.ok(!SZABLON_PROMPTU.includes(zakazana), `szablon nie może już żądać odwracania: ${zakazana}`);
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

/** Paczka wejściowa rev2/rev3: odwrócona + kody pozycyjne jak od modelu. */
function paczkaOdwrocona(marker, bezZrodel = false) {
  const paczka = { ...odwrocPolaPaczki(OK), protokol: marker };
  paczka.pytania.forEach((p) => {
    p.poprawna = zakodujPoprawnaRev2(OK.pytania.find((q) => q.id === p.id).poprawna, p);
    if (bezZrodel) delete p.zrodla;
  });
  return paczka;
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
    'Nigdy nie zmyślaj adresu',
    '"PYT/1.0-rev5"',
    'SCHEMAT ODPOWIEDZI (PYT/1.0-rev5)',
    'ZAKODOWANY numer poprawnej odpowiedzi',
    'zapisz NORMALNIE',
  ]) {
    assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes(fraza), `w szablonie §2.2 brakuje: ${fraza}`);
  }

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
  // B2: odwracanie liter usunięte także z wariantu bez fact-check.
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('ODWRÓCONE ZNAKAMI'),
    'szablon §2.2 nie żąda już odwracania');
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('wykonaj kwerendę w internecie'),
    'twarda kwerenda z §2 nie przecieka do §2.2');
  for (const token of ['{LAT}', '{LON}', '{MIEJSCE}', '{PROMIEN_M}', '{TRYB}', '{LISTA_STACJI}', '{LICZBA_GRACZY}', '{WIEK}', '{OPIS_TRUDNOSCI}', '{TEMATY}', '{TEMATY_JSON}', '{LICZBA_PYTAN}', '{JEZYK}', '{DATA}', '{DATA_KROTKA}', '{LICZBA_STACJI}']) {
    assert.ok(SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes(token), `brak placeholdera ${token} w §2.2`);
  }
  assert.ok(!SZABLON_PROMPTU_BEZ_WERYFIKACJI.includes('```'), 'szablon nie może zawierać ogrodzenia z odwrotnych apostrofów');
});

test('zbudujPrompt: domyślnie bez weryfikacji (rev5), fact-check na życzenie (rev4)', () => {
  const domyslny = zbudujPrompt(wejscieBudowy());
  assert.deepEqual(domyslny.usterki, []);
  assert.ok(domyslny.prompt.includes('PYT/1.0-rev5'), 'domyślny prompt generuje rev5');
  assert.ok(!domyslny.prompt.includes('wykonaj kwerendę w internecie'), 'domyślny prompt nie żąda kwerendy');
  const jawnyBez = zbudujPrompt(wejscieBudowy({ factcheck: false }));
  assert.equal(jawnyBez.prompt, domyslny.prompt, 'jawne factcheck:false = domyślne');
  const fc = zbudujPrompt(wejscieBudowy({ factcheck: true }));
  assert.deepEqual(fc.usterki, []);
  assert.ok(fc.prompt.includes('PYT/1.0-rev4'), 'prompt z fact-check generuje rev4');
  assert.ok(fc.prompt.includes('wykonaj kwerendę w internecie'), 'prompt z fact-check żąda kwerendy');
});

test('rev3: paczka bez źródeł przechodzi, dekoder stawia wariantWejsciowy', () => {
  const rev3 = paczkaOdwrocona(WERSJA_PROTOKOLU_REV3, true);
  assert.equal(czyPaczkaOdwrocona(rev3), true);
  assert.deepEqual(walidujPaczke(rev3, oczekiwane()), [], 'rev3 bez źródeł waliduje się czysto (E09 zgaszona)');
  const robocza = odkodujPaczkeRev2(rev3);
  assert.equal(robocza.protokol, WERSJA_PROTOKOLU);
  assert.equal(robocza.wariantWejsciowy, WERSJA_PROTOKOLU_REV3);
  assert.deepEqual(robocza.pytania.map((p) => p.poprawna), OK.pytania.map((p) => p.poprawna));
  assert.equal(czyWariantFactcheck(robocza), false);
});

test('rev3: podane źródła sprawdzane kształtem (E10/E11), nie obecnością', () => {
  const rev3 = paczkaOdwrocona(WERSJA_PROTOKOLU_REV3);
  rev3.pytania[0].zrodla = [{ url: 'https://przyklad.org/haslo', tytul: odwrocTekst('Tytuł źródła'), sprawdzono: '2026-09-05' }];
  const usterki = walidujPaczke(rev3, oczekiwane());
  const e10 = usterki.find((u) => u.kod === 'E10');
  assert.ok(e10, 'przykładowy adres w rev3 też jest usterką');
  assert.match(e10.komunikat, /opcjonalne/, 'E10 w rev3 podpowiada usunięcie, nie kwerendę');
  assert.ok(!usterki.some((u) => u.kod === 'E09'), 'brak E09 mimo uszkodzonego źródła');
});

test('rev2: brak źródeł to E09 jak dawniej, E10 przypomina o kwerendzie', () => {
  assert.ok(kody(paczkaOdwrocona(WERSJA_PROTOKOLU_REV2, true)).includes('E09'), 'bramka E09 nie zgasiła rev2');
  const rev2 = paczkaOdwrocona(WERSJA_PROTOKOLU_REV2);
  rev2.pytania[1].zrodla = [{ url: 'https://przyklad.org/haslo', tytul: odwrocTekst('Tytuł źródła'), sprawdzono: '2026-09-05' }];
  const e10 = walidujPaczke(rev2, oczekiwane()).find((u) => u.kod === 'E10');
  assert.ok(e10, 'przykładowy adres w rev2 jest usterką');
  assert.match(e10.komunikat, /z kwerendy/, 'E10 w rev2 przypomina o kwerendzie');
});

test('rev3: round-trip przez kontener zachowuje wariant i waliduje się czysto', () => {
  const rev3 = paczkaOdwrocona(WERSJA_PROTOKOLU_REV3, true);
  assert.deepEqual(walidujPaczke(rev3, oczekiwane()), []);
  const robocza = normalizujTematyPaczki(odkodujPaczkeRev2(rev3));
  const kontener = zapakujPaczke(robocza, WERSJA_PROTOKOLU);
  const { paczka, blad } = odpakujPaczke(kontener);
  assert.equal(blad, null);
  assert.equal(czyWariantFactcheck(paczka), false, 'wariant przeżył ukrycie (pole w środku kontenera)');
  assert.deepEqual(walidujPaczke(paczka, oczekiwane()), [], 're-wklejenie ukrytej paczki rev3 nie budzi E09');
});

test('rev3: dekoder jest autorytetem wariantu — dopisane wariantWejsciowy nie gasi E09 w rev2', () => {
  const rev2 = paczkaOdwrocona(WERSJA_PROTOKOLU_REV2, true);
  rev2.wariantWejsciowy = WERSJA_PROTOKOLU_REV3;
  assert.ok(kody(rev2).includes('E09'), 'znacznik rev2 wygrywa z dopisanym polem');
});

test('poprawkaDlaModelu: wariantowa — domyślnie fact-check, bez weryfikacji bez kwerendy', () => {
  const usterki = [{ kod: 'E03', pole: 'pytania', komunikat: 'za mało pytań' }];
  const fc = poprawkaDlaModelu(usterki, { liczbaPytan: 3 });
  assert.ok(fc.includes('kwerenda internetowa dla każdego faktu'), 'domyślna korekta jak dziś');
  assert.ok(poprawkaDlaModelu(usterki).includes('kwerenda internetowa dla każdego faktu'), 'stara sygnatura działa');
  const bez = poprawkaDlaModelu(usterki, { liczbaPytan: 3, factcheck: false });
  assert.ok(bez.includes('sposób ich ustalenia zostawiamy Tobie'),
    'korekta bez weryfikacji nie narzuca sposobu zdobycia faktu (zgłoszenie 2026-09-09)');
  assert.ok(!bez.includes('bez kwerendy w internecie'), 'i nie zakazuje kwerendy');
  assert.ok(bez.includes('źródła opcjonalne'), 'korekta bez weryfikacji mówi o opcjonalnych źródłach');
  assert.ok(!bez.includes('kwerenda internetowa dla każdego faktu'), 'twarda kwerenda nie przecieka');
  assert.ok(bez.includes('[E03]') && bez.includes('PYT/1.0'), 'nagłówek i lista usterek wspólne');
});

test('czyWariantFactcheck: marker i pole wejściowe, brak obu = zweryfikowana', () => {
  assert.equal(czyWariantFactcheck({ protokol: 'PYT/1.0-rev3' }), false);
  assert.equal(czyWariantFactcheck({ protokol: 'PYT/1.0', wariantWejsciowy: 'PYT/1.0-rev3' }), false);
  assert.equal(czyWariantFactcheck({ protokol: 'PYT/1.0' }), true);
  assert.equal(czyWariantFactcheck({ protokol: 'PYT/1.0-rev2' }), true);
  assert.equal(czyWariantFactcheck({ protokol: 'PYT/1.0-rev1' }), true);
  assert.equal(czyWariantFactcheck(null), true, 'nieznana paczka traktowana jak zweryfikowana');
});

test('walidujPaczke: E01 zna cztery markery', () => {
  const e01 = walidujPaczke(klonyPaczki((p) => { p.protokol = 'PYT/2.0'; }), oczekiwane()).find((u) => u.kod === 'E01');
  assert.ok(e01, 'obcy marker dalej odrzucany');
  assert.ok(e01.komunikat.includes('PYT/1.0-rev3'), 'komunikat wymienia rev3');
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
  assert.equal(s.punktyRazem, 3, 'rev2: razem = liczba pytań (1 pkt za pytanie)');
  assert.match(s.uwagi, /FIXTURE TESTOWY/);
  assert.deepEqual(podsumowaniePaczki(null), { liczbaPytan: 0, stacje: [], tematy: [], liczbaZrodel: 0, punktyRazem: 0, uwagi: '' });
});

test('stałe protokołu: wersja i schemat kontenera', () => {
  assert.equal(WERSJA_PROTOKOLU, 'PYT/1.0');
  assert.equal(SCHEMAT_KONTENERA, 'TO-paczka/2', 'kontener po decyzji z ADR 0007 (obfuskacja bez klucza)');
});

/* ---- B2 (2026-09-09): koniec odwracania liter, zostaje kod poprawnej ---- */

/** Paczka rev4/rev5: tekst NORMALNY, zakodowana tylko `poprawna`. */
function paczkaBezOdwracania(marker, bezZrodel = false) {
  const paczka = structuredClone(OK);
  paczka.protokol = marker;
  paczka.pytania.forEach((p) => {
    p.poprawna = zakodujPoprawnaRev2(OK.pytania.find((q) => q.id === p.id).poprawna, p);
    if (bezZrodel) delete p.zrodla;
  });
  return paczka;
}

test('B2: rev4 waliduje się bez odwracania, a dekoder odzyskuje indeks poprawnej', () => {
  const rev4 = paczkaBezOdwracania('PYT/1.0-rev4');
  assert.equal(czyPaczkaOdwrocona(rev4), false, 'rev4 nie jest wariantem odwróconym');
  assert.deepEqual(walidujPaczke(rev4, oczekiwane()), [], 'rev4 przechodzi walidację');

  const robocza = odkodujPaczkeRev2(rev4);
  assert.equal(robocza.protokol, 'PYT/1.0', 'marker znormalizowany');
  assert.equal(robocza.wariantWejsciowy, 'PYT/1.0-rev4', 'wariant wejściowy zapamiętany');
  for (const pyt of robocza.pytania) {
    const wzorzec = OK.pytania.find((q) => q.id === pyt.id);
    assert.equal(pyt.tresc, wzorzec.tresc, 'treść czytelna bez odwracania');
    assert.equal(pyt.poprawna, wzorzec.poprawna, 'kod poprawnej rozkodowany do indeksu');
  }
  assert.equal(czyWariantFactcheck(robocza), true, 'rev4 to wariant z fact-check');
});

test('B2: rev5 to rev4 bez wymogu źródeł (ADR 0032 zachowane)', () => {
  const rev5 = paczkaBezOdwracania('PYT/1.0-rev5', true);
  assert.deepEqual(walidujPaczke(rev5, oczekiwane()), [], 'rev5 bez źródeł waliduje się czysto');
  assert.equal(czyWariantFactcheck(odkodujPaczkeRev2(rev5)), false, 'rev5 to wariant bez fact-check');

  // Ten sam brak źródeł w rev4 musi być błędem — profile się nie zlały.
  const rev4bezZrodel = paczkaBezOdwracania('PYT/1.0-rev4', true);
  const usterki = walidujPaczke(rev4bezZrodel, oczekiwane());
  assert.ok(usterki.some((u) => u.kod === 'E09'), 'rev4 nadal wymaga źródeł (E09)');
});

test('B2: stare paczki rev2/rev3 (odwrócone) dają się odczytać — leżą na Drive', () => {
  for (const marker of ['PYT/1.0-rev2', 'PYT/1.0-rev3']) {
    const stara = paczkaOdwrocona(marker, marker === 'PYT/1.0-rev3');
    assert.equal(czyPaczkaOdwrocona(stara), true, `${marker} to wariant odwrócony`);
    assert.deepEqual(walidujPaczke(stara, oczekiwane()), [], `${marker} nadal się waliduje`);
    const robocza = odkodujPaczkeRev2(stara);
    assert.equal(robocza.pytania[0].tresc, OK.pytania[0].tresc, `${marker}: tekst odwrócony z powrotem`);
    assert.equal(robocza.pytania[0].poprawna, OK.pytania[0].poprawna, `${marker}: kod rozkodowany`);
  }
});
