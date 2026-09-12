/**
 * B21 — duża paczka: budżet promptu i odpowiedzi dla `stacje × gracze` pytań.
 *
 * Po ADR 0027 część A pytania mnożą się przez liczbę graczy: 5 stacji × 8 graczy
 * = 40 pytań. Niezmierzone było, czy prompt i odpowiedź mieszczą się w limitach.
 * Pomiar (2026-09-07, realistyczny fikstur rev2): prompt jest STAŁY (~1,4 tys.
 * tokenów — zmienia się tylko cyfra), a rośnie odpowiedź: 4 469 znaków / ~1 118
 * tokenów dla 5 pytań i 33 392 znaków / ~8 348 tokenów dla 40. Kontener
 * `TO-paczka/2` dla 40 pytań to ~36 kB, czyli 1,8% budżetu stanu i 2,4% rejestru
 * — pamięć nie jest wąskim gardłem, rośnie wyłącznie odpowiedź modelu. Te testy
 * spinają pomiar tam, gdzie da się go sprawdzić bez modelu: prompt NIE rośnie
 * z liczbą pytań, odpowiedź 40 pytań przechodzi przez parser i walidator, a
 * kontener mieści się w budżetach pamięci z zapasem. (`szacunekOdpowiedzi()`
 * i `#prompt-rozmiar` usunięte w m12-66 — liczby odpowiedzi zostają w
 * PROTOKOL §2.1 jako prawidło pomiaru, nie jako stała w kodzie).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  odwrocPolaPaczki, parsujOdpowiedzModela, walidujPaczke,
  zbudujPrompt, SZABLON_WERSJA,
} from '../app/protokol.js';
import { zapakujPaczke } from '../app/kodowanie.js';
import { BUDZET_STANU_BAJTY } from '../app/trwalosc.js';
import { BUDZET_ZESTAWOW_BAJTY } from '../app/zestawy.js';
import { liczTokeny } from '../tools/budzet-lektury.mjs';

const OKOLICA = { lat: 52.12303, lon: 20.74614, miejsce: 'Podkowa Leśna', promienM: 1000 };
const TEMATY = ['historia', 'architektura', 'przyroda'];

function stacje(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    lat: OKOLICA.lat + i * 0.002,
    lon: OKOLICA.lon + i * 0.002,
    opis: `Punkt przy ulicy Modrzewiowej ${i + 1}, przy skrzyżowaniu z Aleją Lipową`,
  }));
}

function konfig(graczy) {
  return {
    czasGryMin: 110, tryb: 'piesza', wiek: 'dorosli', jezyk: 'polski',
    tematy: TEMATY, liczbaStacji: 5, pytaniaNaStacje: graczy,
    liczbaGraczy: graczy, promienM: 1000,
  };
}

/** Realistyczna paczka rev2: unikalne treści, ~140 znaków pytania, jedno źródło. */
function paczka(liczbaStacji, naStacje) {
  const pytania = [];
  for (let s = 1; s <= liczbaStacji; s += 1) {
    for (let p = 1; p <= naStacje; p += 1) {
      pytania.push({
        id: `s${s}p${p}`,
        stacja: s,
        temat: TEMATY[(s + p) % 3],
        tresc: `Który rok określa powstanie obiektu numer ${s} przy ulicy Modrzewiowej w Podkowie Leśnej, według karty ${p} gminnej ewidencji zabytków?`,
        odpowiedzi: [`rok 19${20 + s} albo 19${21 + s}`, `rok 19${30 + p} albo 19${31 + p}`, 'rok 1948 albo 1949', 'rok 1961 albo 1962'],
        poprawna: 17 + s + p + ((s + p) % 4),
        wyjasnienie: `Obiekt numer ${s} wpisano do gminnej ewidencji zabytków w roku 19${20 + s}, a karta ${p} wiąże go z pierwszym planem regulacyjnym miasta-ogrodu, więc data wynika z dokumentu, nie z tradycji ustnej.`,
        zrodla: [{
          url: `https://www.podkowalesna.pl/zabytki/modrzewiowa-${s}-${p}`,
          tytul: 'Gminna ewidencja zabytków — karta obiektu',
          sprawdzono: '2026-09-07',
        }],
      });
    }
  }
  return {
    protokol: 'PYT/1.0-rev2',
    okolica: OKOLICA,
    wiek: 'dorosli',
    tematy: TEMATY,
    jezyk: 'polski',
    utworzono: '2026-09-07 12:00',
    pytania,
    uwagi: '',
  };
}

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

