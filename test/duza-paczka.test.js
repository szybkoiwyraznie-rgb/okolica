/**
 * B21 — duża paczka: budżet promptu i odpowiedzi dla `stacje × gracze` pytań.
 *
 * Po ADR 0027 część A pytania mnożą się przez liczbę graczy: 5 stacji × 8 graczy
 * = 40 pytań. Niezmierzone było, czy prompt i odpowiedź mieszczą się w limitach.
 * Pomiar (2026-09-07, realistyczny fikstur rev2): prompt jest STAŁY (~1,4 tys.
 * tokenów — zmienia się tylko cyfra), a rośnie odpowiedź: 4 469 znaków / ~1 118
 * tokenów dla 5 pytań i 33 392 znaków / ~8 348 tokenów dla 40. Kontener
 * `TO-paczka/2` dla 40 pytań to ~36 kB, czyli 1,8% budżetu stanu i 2,4% rejestru
 * — pamięć nie jest wąskim gardłem, jest nim limit wyjścia modelu. Te testy
 * spinają pomiar, żeby stałe szacunku nie rozjechały się z rzeczywistością.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BAZA_ODPOWIEDZI_TOKENY, PROG_ODPOWIEDZI_TOKENY, TOKENY_NA_PYTANIE,
  odwrocPolaPaczki, parsujOdpowiedzModela, szacunekOdpowiedzi, walidujPaczke,
  zbudujPrompt, SZABLON_WERSJA,
} from '../app/protokol.js';
import { zapakujPaczke } from '../app/kodowanie.js';
import { BUDZET_STANU_BAJTY } from '../app/trwalosc.js';
import { BUDZET_ZESTAWOW_BAJTY } from '../app/zestawy.js';
import { liczTokeny } from '../tools/budzet-lektury.mjs';

import {
  OKOLICA_PACZKI as OKOLICA, TEMATY_PACZKI as TEMATY,
  konfigPaczki as konfig, paczkaPyr as paczka, stacjePaczki as stacje,
} from './helpers/paczki.js';

/** Odpowiedź modelu tak, jak ją wkleja właściciel: blok ```json z polami rev2. */
function odpowiedzModelu(liczbaStacji, naStacje) {
  const odwr = odwrocPolaPaczki(paczka(liczbaStacji, naStacje));
  return '```json\n' + JSON.stringify(odwr, null, 2) + '\n```';
}

test('B21: prompt NIE rośnie z liczbą pytań — 5 i 40 pytań to ten sam rozmiar', () => {
  const maly = zbudujPrompt({ konfig: konfig(1), okolica: OKOLICA, stacje: stacje(5) });
  const duzy = zbudujPrompt({ konfig: konfig(8), okolica: OKOLICA, stacje: stacje(5) });
  assert.deepEqual(maly.usterki, []);
  assert.deepEqual(duzy.usterki, []);
  assert.ok(Math.abs(duzy.prompt.length - maly.prompt.length) < 20,
    `prompt ma być stały: ${maly.prompt.length} vs ${duzy.prompt.length} znaków`);
  // Pomiar wzorcowy: ~1,4 tys. tokenów — pilnujemy, żeby szablon nie urósł.
  assert.ok(liczTokeny(duzy.prompt) < 1_800, `prompt: ${liczTokeny(duzy.prompt)} tokenów`);
  assert.match(duzy.prompt, /liczba pytań łącznie: 40/, 'prompt mówi modelowi o 40 pytaniach');
});

test('B21: odpowiedź na 40 pytań przechodzi przez parser i walidator bez usterek', () => {
  const tekst = odpowiedzModelu(5, 8);
  const { paczka: wczytana, blad } = parsujOdpowiedzModela(tekst);
  assert.equal(blad, null, `parser: ${JSON.stringify(blad)}`);
  assert.equal(wczytana.pytania.length, 40);

  const usterki = walidujPaczke(wczytana, {
    lat: OKOLICA.lat, lon: OKOLICA.lon, promienM: 1000, wiek: 'dorosli',
    tematy: TEMATY, jezyk: 'polski', liczbaStacji: 5, liczbaPytan: 40,
  });
  assert.deepEqual(usterki, [], 'walidacja E** bez usterek dla 40 pytań');
});

test('B21: kontener 40 pytań mieści się w budżetach pamięci z ogromnym zapasem', () => {
  const { paczka: wczytana } = parsujOdpowiedzModela(odpowiedzModelu(5, 8));
  const kontener = zapakujPaczke(wczytana, SZABLON_WERSJA);
  const bajty = new TextEncoder().encode(JSON.stringify(kontener)).length;
  assert.ok(bajty < 60_000, `kontener urósł: ${bajty} bajtów`);
  assert.ok(bajty < BUDZET_STANU_BAJTY * 0.05, `budżet stanu ${BUDZET_STANU_BAJTY}: ${bajty}`);
  assert.ok(bajty < BUDZET_ZESTAWOW_BAJTY * 0.05, `budżet rejestru ${BUDZET_ZESTAWOW_BAJTY}: ${bajty}`);
});

test('B21: szacunek odpowiedzi zgadza się z pomiarem (±20%) i ostrzega powyżej progu', () => {
  for (const [stacji, naStacje] of [[5, 1], [5, 8]]) {
    const tekst = odpowiedzModelu(stacji, naStacje);
    const szacunek = szacunekOdpowiedzi(stacji * naStacje);
    const znaki = new TextEncoder().encode(tekst).length;
    const tokeny = liczTokeny(tekst);
    assert.ok(Math.abs(szacunek.znaki - znaki) < znaki * 0.2,
      `znaki: szacunek ${szacunek.znaki}, pomiar ${znaki}`);
    assert.ok(Math.abs(szacunek.tokeny - tokeny) < tokeny * 0.2,
      `tokeny: szacunek ${szacunek.tokeny}, pomiar ${tokeny}`);
  }
  // 40 pytań to ~8,4 tys. tokenów — wyraźnie ponad limit wyjścia części modeli,
  // więc ekran promptu musi ostrzegać; 5 pytań (~1,1 tys.) nie.
  assert.ok(szacunekOdpowiedzi(40).tokeny > PROG_ODPOWIEDZI_TOKENY);
  assert.ok(szacunekOdpowiedzi(5).tokeny < PROG_ODPOWIEDZI_TOKENY);
  assert.ok(BAZA_ODPOWIEDZI_TOKENY + TOKENY_NA_PYTANIE * 20 > PROG_ODPOWIEDZI_TOKENY,
    'próg ostrzeżenia osiągalny w widełkach setupu (20 pytań)');
});
