/**
 * Testy ukrywania paczki (app/kodowanie.js). ADR 0007 po decyzji właściciela:
 * obfuskacja bez klucza — „nieczytelne na pierwszy rzut oka przy kopiowaniu,
 * a nie zabezpieczone przed odszyfrowaniem". Testy pilnują więc trzech rzeczy:
 * round-tripu, NIECZYTELNOŚCI (w blobie nie widać treści) i wykrywania
 * uszkodzenia przy kopiowaniu. Nie udają, że to kryptografia.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KODOWANIE, SCHEMAT_KONTENERA, blobPaczki, odpakujPaczke, skrotFnv1a, zapakujPaczke,
} from '../app/kodowanie.js';
import { WERSJA_PROTOKOLU } from '../app/protokol.js';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const PACZKA = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));

test('kontener: schemat, wersja protokołu i nazwa kodowania', () => {
  assert.equal(SCHEMAT_KONTENERA, 'TO-paczka/2');
  assert.equal(KODOWANIE, 'b64x1');
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  assert.deepEqual(Object.keys(k).sort(), ['dane', 'kodowanie', 'protokol', 'schemat', 'skrot']);
  assert.equal(k.schemat, SCHEMAT_KONTENERA);
  assert.equal(k.protokol, WERSJA_PROTOKOLU);
  assert.equal(k.kodowanie, KODOWANIE);
  assert.match(k.skrot, /^[0-9a-f]{8}$/, 'suma kontrolna FNV-1a: 8 znaków hex');
  assert.ok(k.dane.length > 100);
  // bez pól po szyfrowaniu, którego już nie ma (ADR 0007 przed decyzją)
  assert.equal(k.sol, undefined);
  assert.equal(k.iv, undefined);
  assert.equal(k.iteracje, undefined);
});

test('round-trip: ukryj → odczytaj → identyczna paczka (z polskimi znakami)', () => {
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  const { paczka, blad, zrodlo } = odpakujPaczke(k);
  assert.equal(blad, null);
  assert.equal(zrodlo, 'kontener');
  assert.deepEqual(paczka, PACZKA);
  assert.equal(paczka.pytania[0].tresc, PACZKA.pytania[0].tresc, 'ą, ę, ś, ż muszą przetrwać UTF-8');
});

test('determinizm: ta sama paczka daje ten sam blob (bez IV, bez soli)', () => {
  assert.equal(zapakujPaczke(PACZKA, WERSJA_PROTOKOLU).dane, zapakujPaczke(PACZKA, WERSJA_PROTOKOLU).dane);
  assert.equal(blobPaczki(PACZKA, WERSJA_PROTOKOLU), zapakujPaczke(PACZKA, WERSJA_PROTOKOLU).dane);
});

test('nieczytelność: w ukrytej paczce nie widać treści pytań', () => {
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  const jakoTekst = JSON.stringify(k);
  for (const fragment of ['Grabowice', 'rynek', 'historia', 'pytania', 'odpowiedzi', '1342', 'wikipedia']) {
    assert.ok(!jakoTekst.includes(fragment), `w kontenerze widać „${fragment}" — ukrycie nie działa`);
  }
  assert.ok(!jakoTekst.includes('{\\"'), 'kontener nie może zawierać jawnego JSON-a paczki');
  // sam blob też: bez znaków typowych dla base64 z jawnego JSON-a
  assert.ok(!k.dane.includes('eyJ'), 'blob nie może zaczynać się od base64 znaku „{"');
});

test('tolerancja wklejenia: kontener jako tekst, sam blob i jawny JSON', () => {
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  assert.deepEqual(odpakujPaczke(JSON.stringify(k)).paczka, PACZKA);
  assert.deepEqual(odpakujPaczke(`  ${k.dane}  `).paczka, PACZKA, 'sam blob base64url');
  assert.deepEqual(odpakujPaczke(JSON.stringify(PACZKA)).paczka, PACZKA, 'jawny JSON od modelu');
  assert.equal(odpakujPaczke(PACZKA).zrodlo, 'json');
});

test('uszkodzenie przy kopiowaniu: urwany blob i zmieniony bajt są odrzucane', () => {
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  const urwany = odpakujPaczke({ ...k, dane: k.dane.slice(0, Math.floor(k.dane.length * 0.9)) });
  assert.equal(urwany.paczka, null);
  assert.match(urwany.blad, /urwana|uszkodzona|JSON|base64/i);

  const bajty = [...k.dane];
  bajty[40] = bajty[40] === 'A' ? 'B' : 'A';
  const zmieniony = odpakujPaczke({ ...k, dane: bajty.join('') });
  assert.equal(zmieniony.paczka, null, 'zmiana jednego znaku musi być wykryta przez sumę kontrolną');
  assert.match(zmieniony.blad, /Suma kontrolna/);
});

test('odmowa przy nieznanym schemacie, kodowaniu i śmieciach', () => {
  const k = zapakujPaczke(PACZKA, WERSJA_PROTOKOLU);
  assert.match(odpakujPaczke({ ...k, schemat: 'TO-paczka/1' }).blad, /Nieznany schemat/);
  assert.match(odpakujPaczke({ ...k, kodowanie: 'aes-gcm' }).blad, /Nieobsługiwane kodowanie/);
  assert.equal(odpakujPaczke('').paczka, null);
  assert.equal(odpakujPaczke(null).paczka, null);
  assert.match(odpakujPaczke('to nie jest paczka').blad, /JSON|kontener|base64/i);
  assert.match(odpakujPaczke({ schemat: SCHEMAT_KONTENERA, kodowanie: KODOWANIE, dane: '!!!' }).blad, /base64/);
});

test('walidator przyjmuje paczkę odczytaną z kontenera tak samo jak jawną', async () => {
  const { walidujPaczke } = await import('../app/protokol.js');
  const { przesunPunkt } = await import('../app/geo.js');
  const srodek = { lat: PACZKA.okolica.lat, lon: PACZKA.okolica.lon };
  const stacje = [1, 2, 3].map((i) => ({ id: i, ...przesunPunkt(srodek, 700, i * 120), opis: i === 1 ? 'rynek w Grabowicach' : '' }));
  const oczekiwane = {
    liczbaStacji: 3, liczbaPytan: 3, wiek: 'dorosli', tematy: ['historia', 'architektura'],
    promienM: 1000, lat: srodek.lat, lon: srodek.lon, jezyk: 'polski', stacje,
    teraz: new Date('2026-09-05T23:59:00'),
  };
  const { paczka } = odpakujPaczke(zapakujPaczke(PACZKA, WERSJA_PROTOKOLU));
  assert.deepEqual(walidujPaczke(paczka, oczekiwane), []);
});

test('skrotFnv1a: znane wartości referencyjne i czułość na zmianę', () => {
  const enc = (s) => new TextEncoder().encode(s);
  assert.equal(skrotFnv1a(enc('')), '811c9dc5', 'FNV-1a offset basis');
  assert.equal(skrotFnv1a(enc('a')), 'e40c292c', 'FNV-1a("a") — wartość z literatury');
  assert.equal(skrotFnv1a(enc('foobar')), 'bf9cf968', 'FNV-1a("foobar") — wartość z literatury');
  assert.notEqual(skrotFnv1a(enc('paczka A')), skrotFnv1a(enc('paczka B')));
});

test('graniczne przypadki: pusta paczka, duży tekst, znaki spoza BMP', () => {
  for (const dane of [{ a: 1 }, { t: 'x'.repeat(200000) }, { emoji: '🏳️‍🌈 🎯', cien: 'ąęśćżźóń' }]) {
    const k = zapakujPaczke(dane, WERSJA_PROTOKOLU);
    assert.deepEqual(odpakujPaczke(k).paczka, dane);
  }
  assert.throws(() => zapakujPaczke(null, WERSJA_PROTOKOLU), TypeError);
  assert.throws(() => zapakujPaczke({ a: 1 }, ''), TypeError, 'wersja protokołu jest wymagana');
});
