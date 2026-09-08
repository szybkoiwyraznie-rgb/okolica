/**
 * B21 — generowanie pytań partiami (PROTOKOL §2.2, ADR 0031).
 *
 * Pomiar z 2026-09-07 pokazał, że wąskim gardłem jest WYJŚCIE modelu: ~210
 * tokenów na pytanie, więc 40 pytań to ~8 350 tokenów i model z limitem 4 tys.
 * urywa JSON w połowie. Te testy pilnują całego łańcucha: planu partii
 * (pakowanie CAŁYMI stacjami), promptu części z GLOBALNYMI numerami stacji,
 * walidacji części wobec jej własnego zakresu stacji, scalania i ponownej
 * walidacji całości wobec setupu. Bez globalnej numeracji identyfikatory
 * `s<stacja>p<n>` zderzyłyby się po scaleniu — stąd test pełnego obiegu.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROG_ODPOWIEDZI_TOKENY,
  odkodujPaczkeRev2,
  odwrocPolaPaczki,
  opisListyStacji,
  planPartii,
  pytaniaWBudzecie,
  scalPartie,
  szacunekOdpowiedzi,
  walidujPaczke,
  zbudujPrompt,
} from '../app/protokol.js';
import {
  OKOLICA_PACZKI, TEMATY_PACZKI, konfigPaczki, paczkaPyr, stacjePaczki,
} from './helpers/paczki.js';

const TERAZ = new Date('2026-09-07T12:00:00');

/** `oczekiwane` takie, jakie składa `app/app.js` — z zakresem stacji części. */
function oczekiwane({ liczbaStacji = 5, liczbaPytan, stacjeNumery, stacje = stacjePaczki(5) } = {}) {
  return {
    liczbaStacji,
    liczbaPytan,
    stacjeNumery,
    wiek: 'dorosli',
    tematy: TEMATY_PACZKI,
    promienM: OKOLICA_PACZKI.promienM,
    lat: OKOLICA_PACZKI.lat,
    lon: OKOLICA_PACZKI.lon,
    jezyk: 'polski',
    stacje,
    teraz: TERAZ,
  };
}

/**
 * Odpowiedź modelu dla części: rev2 z odwróconym tekstem, tak jak wkleja ją
 * właściciel (PROTOKOL §3.4). `walidujPaczke` odkodowuje ją wewnętrznie.
 */
function odpowiedzCzesci(ileStacji, naStacje, odStacji, uwagi = '') {
  return odwrocPolaPaczki(paczkaPyr(ileStacji, naStacje, { odStacji, uwagi }));
}

/** To, co `app/app.js` odkłada do `STAN.partie.zebrane` — już odkodowane. */
function przyjetaCzesc(ileStacji, naStacje, odStacji, uwagi = '') {
  return odkodujPaczkeRev2(odpowiedzCzesci(ileStacji, naStacje, odStacji, uwagi));
}

/* ------------------------------------------------------------ plan partii */

test('B21: plan partii pakuje CAŁYMI stacjami i mieści się w budżecie odpowiedzi', () => {
  // Przypadek z pomiaru: 5 stacji × 8 graczy = 40 pytań (~8 350 tokenów) —
  // jedno zlecenie byłoby ucięte, więc dzielimy.
  const plan = planPartii({ liczbaStacji: 5, pytaniaNaStacje: 8 });
  assert.deepEqual(plan.usterki, []);
  assert.equal(plan.razemPytan, 40, 'plan zna łączną liczbę pytań');
  assert.ok(plan.partie.length > 1, 'duży setup dzieli się na części');

  // Partie są rozłączne, pokrywają wszystkie stacje i zachowują kolejność.
  const stacje = plan.partie.flatMap((p) => p.stacje);
  assert.deepEqual(stacje, [1, 2, 3, 4, 5], 'każda stacja w dokładnie jednej części, bez zmiany kolejności');
  for (const czesc of plan.partie) {
    assert.equal(czesc.ile, plan.partie.length, 'każda część wie, ile ich jest');
    assert.equal(czesc.liczbaPytan, czesc.stacje.length * 8, 'pytania na część = stacje × pytania na stację');
    assert.ok(czesc.tokeny <= PROG_ODPOWIEDZI_TOKENY, `część ${czesc.numer} mieści się w budżecie (${czesc.tokeny} ≤ ${PROG_ODPOWIEDZI_TOKENY})`);
    assert.ok(czesc.stacje.every((s) => Number.isInteger(s)), 'numery stacji są liczbami całkowitymi');
  }
  assert.deepEqual(plan.ostrzezenia, [], 'bez ostrzeżeń, gdy stacja mieści się w budżecie');
});

test('B21: mały setup idzie jednym zleceniem — dzielenie nie jest domyślne', () => {
  const plan = planPartii({ liczbaStacji: 5, pytaniaNaStacje: 1 });
  assert.equal(plan.partie.length, 1, 'pięć pytań mieści się w jednym zleceniu');
  assert.deepEqual(plan.partie[0].stacje, [1, 2, 3, 4, 5]);
  assert.equal(plan.partie[0].ile, 1, 'jedna część nie udaje podziału');
  assert.ok(plan.partie[0].tokeny <= PROG_ODPOWIEDZI_TOKENY);
});

test('B21: stacja większa niż budżet idzie sama i dostaje jawne ostrzeżenie', () => {
  const plan = planPartii({ liczbaStacji: 3, pytaniaNaStacje: 24 });
  assert.equal(plan.partie.length, 3, 'stacji nie dzielimy — każda idzie osobno');
  for (const czesc of plan.partie) assert.equal(czesc.stacje.length, 1);
  assert.equal(plan.ostrzezenia.length, 1, 'ostrzeżenie, że odpowiedź i tak może zostać urwana');
  assert.match(plan.ostrzezenia[0], /zmniejsz liczbę pytań na stację/, 'ostrzeżenie mówi, co zrobić');
});

test('B21: błędne wejście planu to kody WE08/WE09, nie pusty plan po cichu', () => {
  const a = planPartii({ liczbaStacji: 0, pytaniaNaStacje: 1 });
  assert.deepEqual(a.partie, []);
  assert.equal(a.usterki[0].kod, 'WE08');
  const b = planPartii({ liczbaStacji: 3, pytaniaNaStacje: 1.5 });
  assert.equal(b.usterki[0].kod, 'WE09', 'pytania na stację muszą być całkowite');
  const c = planPartii({ liczbaStacji: 3, pytaniaNaStacje: 1 });
  assert.deepEqual(c.usterki, [], 'poprawne wejście bez usterek');
});

test('B21: budżet partii liczy się ze stałych pomiaru, a próg da się zawęzić', () => {
  assert.equal(pytaniaWBudzecie(), Math.floor((PROG_ODPOWIEDZI_TOKENY - szacunekOdpowiedzi(0).tokeny) / (szacunekOdpowiedzi(1).tokeny - szacunekOdpowiedzi(0).tokeny)));
  assert.equal(planPartii({ liczbaStacji: 4, pytaniaNaStacje: 3, progTokeny: 1000 }).partie.length, 4, 'ciaśniejszy budżet = więcej części');
  assert.equal(planPartii({ liczbaStacji: 4, pytaniaNaStacje: 3, progTokeny: NaN }).partie.length, 1, 'śmieciowy próg wraca do domyślnego, nie do zera');
});

/* ------------------------------------------------------- prompt części */

test('B21: prompt części ma GLOBALNE numery stacji i mówi, że to wycinek', () => {
  const konfig = konfigPaczki(8, 5);
  const plan = planPartii({ liczbaStacji: 5, pytaniaNaStacje: 8 });
  const druga = plan.partie[1];
  const { prompt, usterki } = zbudujPrompt({ konfig, okolica: OKOLICA_PACZKI, stacje: stacjePaczki(5), partia: druga, teraz: TERAZ });
  assert.deepEqual(usterki, []);

  assert.match(prompt, new RegExp(`- liczba pytań łącznie: ${druga.liczbaPytan}\\b`), 'prompt pyta tylko o pytania tej części');
  assert.match(prompt, new RegExp(`- liczba stacji w tym zleceniu: ${druga.stacje.length}\\b`));
  assert.match(prompt, new RegExp(`część ${druga.numer} z ${druga.ile} tej samej paczki`), 'model wie, że to wycinek większej paczki');
  assert.match(prompt, /WYŁĄCZNIE do stacji z listy powyżej/, 'zakaz wychodzenia poza listę');
  assert.match(prompt, /nie numeruj stacji od nowa/, 'zakaz ponownej numeracji — inaczej id zderzą się po scaleniu');

  // Lista stacji pokazuje tylko tę część, ale z prawdziwymi numerami.
  for (const n of druga.stacje) assert.match(prompt, new RegExp(`- stacja ${n}:`), `stacja ${n} jest na liście`);
  for (const n of plan.partie[0].stacje) assert.ok(!prompt.includes(`- stacja ${n}:`), `stacja ${n} z innej części nie wyciekła do promptu`);
});

test('B21: bez partii prompt mówi „cała paczka" i obejmuje wszystkie stacje', () => {
  const { prompt, usterki } = zbudujPrompt({ konfig: konfigPaczki(1, 5), okolica: OKOLICA_PACZKI, stacje: stacjePaczki(5), teraz: TERAZ });
  assert.deepEqual(usterki, []);
  assert.match(prompt, /cała paczka — wszystkie stacje z listy powyżej/);
  assert.match(prompt, /- liczba pytań łącznie: 5\b/);
  assert.match(prompt, /- stacja 5:/, 'wszystkie stacje na liście');
});

test('B21: partia wskazująca nieistniejące stacje to WE10, nie pusty prompt', () => {
  const { prompt, usterki } = zbudujPrompt({
    konfig: konfigPaczki(1, 5), okolica: OKOLICA_PACZKI, stacje: stacjePaczki(5),
    partia: { numer: 1, ile: 2, stacje: [8, 9], liczbaPytan: 2 }, teraz: TERAZ,
  });
  assert.equal(prompt, null);
  assert.equal(usterki[0].kod, 'WE10');
});

test('B21: opisListyStacji bez `numery` numeruje od 1 — stare wywołania bez zmian', () => {
  const stacje = stacjePaczki(3);
  assert.match(opisListyStacji(stacje, OKOLICA_PACZKI), /^- stacja 1:/);
  assert.match(opisListyStacji(stacje.slice(1), OKOLICA_PACZKI, [2, 3]), /^- stacja 2:/);
});

/* ------------------------------------------------------ walidacja części */

test('B21: walidacja części sprawdza JEJ zakres stacji, nie 1..N całej paczki', () => {
  const czesc = odpowiedzCzesci(2, 8, 3); // stacje 3 i 4
  const usterki = walidujPaczke(czesc, oczekiwane({ liczbaPytan: 16, stacjeNumery: [3, 4] }));
  assert.deepEqual(usterki, [], `część jest poprawna, a są usterki: ${usterki.map((u) => u.kod).join(',')}`);

  // Pytanie spoza zakresu części to E04 z nazwaniem oczekiwanego zakresu.
  const zObca = odpowiedzCzesci(2, 8, 3);
  zObca.pytania.push({ ...zObca.pytania[0], id: 's5p1', stacja: 5 });
  const obca = walidujPaczke(zObca, oczekiwane({ liczbaPytan: 17, stacjeNumery: [3, 4] }));
  assert.ok(obca.some((u) => u.kod === 'E04'), 'stacja spoza części to E04');
  assert.match(obca.find((u) => u.kod === 'E04').komunikat, /nie należy do tej części/, 'komunikat mówi, jaki zakres był oczekiwany');

  // Brak pytania dla stacji z zakresu części to E05 — nawet gdy inne stacje są.
  const bezCzwartej = odpowiedzCzesci(1, 8, 3);
  const brak = walidujPaczke(bezCzwartej, oczekiwane({ liczbaPytan: 8, stacjeNumery: [3, 4] }));
  assert.ok(brak.some((u) => u.kod === 'E05' && /Stacja 4/.test(u.komunikat)), 'stacja 4 bez pytania to E05');
});

test('B21: cała paczka bez `stacjeNumery` waliduje się po staremu (1..N)', () => {
  const cala = odpowiedzCzesci(5, 1, 1);
  assert.deepEqual(walidujPaczke(cala, oczekiwane({ liczbaPytan: 5 })), []);
  const dziura = odkodujPaczkeRev2(odpowiedzCzesci(5, 1, 1));
  dziura.pytania = dziura.pytania.filter((p) => p.stacja !== 3);
  dziura.pytania[0].stacja = 3;
  const usterki = walidujPaczke(dziura, oczekiwane({ liczbaPytan: 4 }));
  assert.ok(usterki.length > 0, 'paczka z dziurą nie przechodzi');
});

/* ------------------------------------------------------------- scalanie */

test('B21: scalenie części daje jedną paczkę zgodną z setupem', () => {
  const konfig = konfigPaczki(8, 5);
  const plan = planPartii({ liczbaStacji: 5, pytaniaNaStacje: 8 });
  const czesci = plan.partie.map((p) => przyjetaCzesc(p.stacje.length, 8, p.stacje[0], p.numer === 2 ? 'Nie udało się potwierdzić daty jednego obiektu.' : ''));

  const { paczka, usterki } = scalPartie(czesci);
  assert.deepEqual(usterki, []);
  assert.equal(paczka.pytania.length, 40, 'wszystkie pytania z części');
  assert.deepEqual([...new Set(paczka.pytania.map((p) => p.id))].length, 40, 'identyfikatory unikalne w całej paczce');
  assert.match(paczka.uwagi, /Nie udało się potwierdzić daty/, 'uwagi z części nie giną przy scalaniu');

  // Dopiero złożona paczka jest sprawdzana wobec SETUPU (pełny zakres stacji).
  const koncowe = walidujPaczke(paczka, oczekiwane({ liczbaPytan: konfig.liczbaStacji * konfig.pytaniaNaStacje }));
  assert.deepEqual(koncowe, [], `złożona paczka przechodzi pełną walidację, a są usterki: ${koncowe.map((u) => `${u.kod}:${u.komunikat}`).join(' | ')}`);
});

test('B21: powtórzone id między częściami to E19, a pusta lista to E21', () => {
  const a = przyjetaCzesc(2, 1, 1);
  const b = przyjetaCzesc(2, 1, 1); // ten sam zakres — model wynumerował od nowa
  const { paczka, usterki } = scalPartie([a, b]);
  assert.equal(paczka, null);
  assert.ok(usterki.every((u) => u.kod === 'E19'), 'kolizja identyfikatorów to E19');
  assert.match(usterki[0].komunikat, /pierwszy raz w części 1/, 'komunikat wskazuje, gdzie id było wcześniej');

  const pusta = scalPartie([]);
  assert.equal(pusta.paczka, null);
  assert.equal(pusta.usterki[0].kod, 'E21');
  assert.equal(scalPartie(null).usterki[0].kod, 'E21', 'śmieciowe wejście nie rzuca wyjątku');
});

/* ------------------------------------------------------- pełny obieg */

test('B21: pełny obieg — plan, prompty części, walidacja każdej, scalenie, pełna walidacja', () => {
  const konfig = konfigPaczki(8, 5);
  const stacje = stacjePaczki(5);
  const plan = planPartii({ liczbaStacji: konfig.liczbaStacji, pytaniaNaStacje: konfig.pytaniaNaStacje });
  assert.ok(plan.partie.length >= 2, 'setup z pomiaru dzieli się na części');

  const zebrane = [];
  for (const czesc of plan.partie) {
    const { prompt, usterki } = zbudujPrompt({ konfig, okolica: OKOLICA_PACZKI, stacje, partia: czesc, teraz: TERAZ });
    assert.deepEqual(usterki, [], `prompt części ${czesc.numer} bez usterek`);
    assert.ok(prompt.length > 1000, `prompt części ${czesc.numer} zbudowany`);

    // „Odpowiedź modelu" dla tej części — numery stacji globalne, jak w promptcie.
    const odpowiedz = odpowiedzCzesci(czesc.stacje.length, konfig.pytaniaNaStacje, czesc.stacje[0]);
    const usterkiCzesci = walidujPaczke(odpowiedz, oczekiwane({ liczbaPytan: czesc.liczbaPytan, stacjeNumery: czesc.stacje, stacje }));
    assert.deepEqual(usterkiCzesci, [], `część ${czesc.numer} przechodzi walidację: ${usterkiCzesci.map((u) => `${u.kod}:${u.komunikat}`).join(' | ')}`);
    zebrane.push(odkodujPaczkeRev2(odpowiedz)); // tak robi app.js po przyjęciu
  }

  const { paczka, usterki } = scalPartie(zebrane);
  assert.deepEqual(usterki, []);
  const cala = walidujPaczke(paczka, oczekiwane({ liczbaPytan: konfig.liczbaStacji * konfig.pytaniaNaStacje, stacje }));
  assert.deepEqual(cala, [], `złożona paczka jest zgodna z setupem: ${cala.map((u) => `${u.kod}:${u.komunikat}`).join(' | ')}`);
  assert.equal(paczka.pytania.length, 40);
});
