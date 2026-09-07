/**
 * Most Drive: wyniki gry wieloosobowej (ADR 0027 część B).
 *
 * `przeliczWyniki` istnieje w dwóch miejscach — w moście (`gra.wyniki`, które
 * dostają wszyscy gracze) i w aplikacji (`app/wieloosobowa.js`, podgląd na żywo).
 * Rozjazd oznaczałby, że telefon pokazuje inny wynik niż Drive, więc test
 * WYKONUJE tekst funkcji ze skryptu i porównuje z implementacją aplikacji na
 * tych samych grach. Premia za kolejność (pierwszy G−1, …, ostatni 0) musi
 * wychodzić identycznie po obu stronach.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { przeliczWyniki as przeliczWynikiKlient, premiaZaKolejnosc as premiaKlient } from '../app/wieloosobowa.js';

const ROOT = join(import.meta.dirname, '..');
const GS = readFileSync(join(ROOT, 'docs/setup/apps-script-repo-paczek.gs'), 'utf8');

/** Wycina ze skryptu `premiaZaKolejnosc` + `przeliczWyniki` i zwraca je jako funkcje. */
function wynikiMostu() {
  const start = GS.indexOf('/**\n * Premia za kolejność ukończenia');
  const koniec = GS.indexOf('/** POST gra-zdarzenie:', start);
  assert.ok(start >= 0 && koniec > start, 'skrypt mostu ma premię i przeliczWyniki obok siebie');
  // eslint-disable-next-line no-new-func — celowo: wykonujemy tekst skryptu, nie jego kopię
  return new Function(`${GS.slice(start, koniec)}; return { premiaZaKolejnosc, przeliczWyniki };`)();
}

const { premiaZaKolejnosc: premiaMost, przeliczWyniki: przeliczWynikiMost } = wynikiMostu();

/** Gra wyścigowa; `odpowiedz` nadaje rosnącą `kolejnosc` tak jak `przyjmijZdarzenie`. */
function graWyscig({ liczbaGraczy = 4, stan = 'zakonczona', liczbaStacji = 3 } = {}) {
  return {
    schemat: 'RO-gra/1',
    kod: 'K2H7QM',
    tryb: 'wyscig',
    stan,
    organizatorId: 'g-1',
    gracze: Array.from({ length: liczbaGraczy }, (_, i) => ({ id: `g-${i + 1}`, pseudonim: `Gracz ${i + 1}`, dolaczyl: `t${i}` })),
    konfiguracja: { liczbaStacji, pytaniaNaStacje: liczbaGraczy, wiek: 'dorosli', tematy: ['historia'], promienM: 1000, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8' },
    zdarzenia: [],
  };
}

let licznik = 0;
function odpowiedz(gra, graczId, stacjaId, { poprawna = true } = {}) {
  licznik += 1;
  gra.zdarzenia.push({
    kolejnosc: licznik, graczId, typ: 'odpowiedz', stacjaId,
    dane: { poprawna, punktyRazem: poprawna ? 1 : 0, czasOdcinkaMs: 60_000 }, tSerwera: `t${licznik}`,
  });
  return gra;
}

function dojście(gra, graczId, stacjaId) {
  licznik += 1;
  gra.zdarzenia.push({ kolejnosc: licznik, graczId, typ: 'dojscie', stacjaId, dane: { czasOdcinkaMs: 45_000 }, tSerwera: `t${licznik}` });
  return gra;
}

function zakonczWszystkie(gra, graczId) {
  for (let st = 1; st <= gra.konfiguracja.liczbaStacji; st += 1) {
    dojście(gra, graczId, st);
    odpowiedz(gra, graczId, st);
  }
  return gra;
}

function rezygnacja(gra, graczId) {
  licznik += 1;
  gra.zdarzenia.push({ kolejnosc: licznik, graczId, typ: 'rezygnacja', dane: { powod: 'test' }, tSerwera: `t${licznik}` });
  return gra;
}

test('premia w moście = premia w aplikacji (kopia pilnowana testem)', () => {
  const scenariusze = [
    ['czterech kończy w kolejności g-2, g-4, g-1, g-3', (g) => ['g-2', 'g-4', 'g-1', 'g-3'].forEach((id) => zakonczWszystkie(g, id))],
    ['dwóch kończy, trzeci rezygnuje', (g) => { zakonczWszystkie(g, 'g-3'); zakonczWszystkie(g, 'g-1'); rezygnacja(g, 'g-2'); }],
    ['gospodarz kończy przy jednym skończonym', (g) => { zakonczWszystkie(g, 'g-2'); odpowiedz(g, 'g-1', 1); }],
    ['nikt nie skończył', (g) => { odpowiedz(g, 'g-1', 1); odpowiedz(g, 'g-2', 2); }],
    ['jeden gracz (solo)', (g) => zakonczWszystkie(g, 'g-1')],
  ];
  for (const [opis, buduj] of scenariusze) {
    licznik = 0;
    const gra = graWyscig({ liczbaGraczy: opis.includes('solo') ? 1 : 4 });
    buduj(gra);
    assert.deepEqual(
      premiaMost(gra),
      premiaKlient(gra),
      `premia się rozjeżdża dla scenariusza: ${opis}`,
    );
  }
});

test('wyniki mostu = wyniki aplikacji: punkty z premią, poprawne, odcinki, rezygnacje', () => {
  licznik = 0;
  const gra = graWyscig({ liczbaGraczy: 3, stan: 'trwa' });
  zakonczWszystkie(gra, 'g-2'); // 1. miejsce → premia 2
  odpowiedz(gra, 'g-1', 1, { poprawna: false });
  dojście(gra, 'g-1', 2);
  rezygnacja(gra, 'g-3');

  // gra się toczy: premia policzona, ale poza punktami — po obu stronach tak samo
  assert.deepEqual(przeliczWynikiMost(gra), przeliczWynikiKlient(gra), 'wyniki w trakcie gry');
  assert.equal(przeliczWynikiMost(gra)['g-2'].premia, 2, 'premia pierwszego = G−1 = 2');
  assert.equal(przeliczWynikiMost(gra)['g-2'].punkty, 3, 'w trakcie gry punkty bez premii');

  gra.stan = 'zakonczona';
  assert.deepEqual(przeliczWynikiMost(gra), przeliczWynikiKlient(gra), 'wyniki końcowe');
  assert.equal(przeliczWynikiMost(gra)['g-2'].punkty, 5, 'podsumowanie: 3 pkt + premia 2');
  assert.equal(przeliczWynikiMost(gra)['g-1'].punkty, 0, 'błędna odpowiedź = 0 pkt, brak premii');
  assert.equal(przeliczWynikiMost(gra)['g-1'].bledne, 1);
  assert.equal(przeliczWynikiMost(gra)['g-1'].czasOdcinkowMs, 45_000, 'czas odcinka z dojścia');
  assert.equal(przeliczWynikiMost(gra)['g-3'].zrezygnowal, true);
  assert.equal(przeliczWynikiMost(gra)['g-3'].premia, 0, 'rezygnujący bez premii');
});

test('most ustawia stan PRZED policzeniem wyników — inaczej premia nie wchodzi do punktów', () => {
  const cialo = GS.slice(GS.indexOf('function przyjmijZdarzenie')); // ostatnia funkcja skryptu
  const stanIdx = cialo.indexOf("gra.stan = 'zakonczona'");
  const wynikiIdx = cialo.indexOf('gra.wyniki = przeliczWyniki(gra)');
  assert.ok(stanIdx >= 0 && wynikiIdx > stanIdx, 'w przyjmijZdarzenie stan idzie przed wynikami');
});
