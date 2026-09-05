/**
 * sieci.test.js — testy warstwy sieci drogowej (kamień M4, ADR 0005).
 *
 * Na razie (I2) pilnują KONTRAKTU FIXTURE'ÓW Overpass: formatu odpowiedzi
 * `out geom`, determinizmu generatora i cech trzech scenariuszy (centrum /
 * przedmieście / las). Testy modułu `app/sieci.js` dołączą w krokach I3–I5.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generujFixtures } from '../tools/generuj-fixture-overpass.mjs';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAZWY = ['centrum', 'przedmiescie', 'las'];

function czytajFixture(nazwa) {
  return JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', `overpass-${nazwa}.json`), 'utf8'));
}

function czySkończone(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/* ------------------------------------------------- determinizm generatora */

test('fixture: generator jest deterministyczny — dwa uruchomienia dają identyczne dane', () => {
  const a = generujFixtures();
  const b = generujFixtures();
  assert.deepEqual(a, b);
});

test('fixture: pliki w repo to dokładnie to, co zwraca generator (jak szablon promptu)', () => {
  const wygenerowane = generujFixtures();
  for (const nazwa of NAZWY) {
    assert.deepEqual(czytajFixture(nazwa), wygenerowane[nazwa], `overpass-${nazwa}.json rozjechał się z generatorem`);
  }
});

/* ------------------------------------------------------------ format pliku */

for (const nazwa of NAZWY) {
  test(`fixture ${nazwa}: format odpowiedzi Overpass (out geom)`, () => {
    const dane = czytajFixture(nazwa);
    assert.equal(dane.version, 0.6);
    assert.match(dane.generator, /generuj-fixture-overpass\.mjs/, 'pochodzenie fixture jest jawne');
    assert.match(dane.generator, /FIXTURE SYNTETYCZNY/, 'fixture nie udaje prawdziwych danych OSM');
    assert.ok(Array.isArray(dane.elements) && dane.elements.length > 0);

    const id = new Set();
    for (const el of dane.elements) {
      assert.ok(!id.has(el.id), `duplikat id ${el.id}`);
      id.add(el.id);
      assert.ok(['way', 'node', 'area'].includes(el.type), `nieoczekiwany typ ${el.type}`);
      assert.ok(el.tags && typeof el.tags === 'object', 'element bez tags — nasz parser nie miałby czego czytać');

      if (el.type === 'way') {
        assert.ok(Array.isArray(el.geometry) && el.geometry.length >= 2, 'way musi mieć geometrię (out geom)');
        for (const p of el.geometry) assert.ok(czySkończone(p), 'way ze współrzędnymi bez sensu');
      }
      if (el.type === 'node') assert.ok(czySkończone(el), 'node bez poprawnych lat/lon');
      if (el.type === 'area') {
        assert.equal(el.tags.boundary, 'administrative');
        assert.ok(el.tags.name, 'obszar administracyjny bez nazwy — {MIEJSCE} by oszalało');
        assert.ok(Number.isFinite(Number(el.tags.admin_level)));
      }
    }
  });

  test(`fixture ${nazwa}: poligony budynków są zamknięte, a rozpiętość rozsądna`, () => {
    const dane = czytajFixture(nazwa);
    const lat = [];
    const lon = [];
    for (const el of dane.elements) {
      // obszary administracyjne nie mają geometrii w odpowiedzi (tylko tags)
      const punkty = el.type === 'way' ? el.geometry : el.type === 'node' ? [el] : [];
      for (const p of punkty) { lat.push(p.lat); lon.push(p.lon); }
      if (el.type === 'way' && el.tags.building) {
        const g = el.geometry;
        assert.deepEqual(g[0], g[g.length - 1], 'poligon budynku musi być zamknięty (pierwszy = ostatni)');
      }
    }
    assert.ok(Math.max(...lat) - Math.min(...lat) < 0.06, 'fixture rozlał się poza okolicę (~6 km)');
    assert.ok(Math.max(...lon) - Math.min(...lon) < 0.06, 'fixture rozlał się poza okolicę (~6 km)');
  });

  test(`fixture ${nazwa}: trzy obszary administracyjne od grubego do drobnego`, () => {
    const dane = czytajFixture(nazwa);
    const obszary = dane.elements.filter((el) => el.type === 'area');
    assert.equal(obszary.length, 3);
    const poziomy = obszary.map((o) => Number(o.tags.admin_level));
    assert.deepEqual(poziomy, [...poziomy].sort((a, b) => a - b), 'od grubego do drobnego');
    assert.equal(poziomy.at(-1), 9, 'najdrobniejszy poziom to dzielnica/gmina — źródło {MIEJSCE}');
  });
}

/* ------------------------------------------------------- cechy scenariuszy */

function wayeZTagiem(dane, klucz, wartosc) {
  return dane.elements.filter((el) => el.type === 'way' && el.tags?.[klucz] === wartosc);
}

function nodyZTagiem(dane, klucz, wartosc) {
  return dane.elements.filter((el) => el.type === 'node' && el.tags?.[klucz] === wartosc);
}

test('fixture centrum: gęsta siatka z wszystkim, co wykluczamy', () => {
  const dane = czytajFixture('centrum');
  assert.ok(wayeZTagiem(dane, 'highway', 'residential').length >= 10, 'siatka ulic mieszkalnych');
  assert.ok(wayeZTagiem(dane, 'highway', 'pedestrian').length >= 1, 'deptak');
  assert.ok(wayeZTagiem(dane, 'highway', 'footway').length >= 2, 'chodniki/łączniki');
  assert.ok(wayeZTagiem(dane, 'highway', 'steps').length >= 1, 'schody (wykluczenie roweru)');
  assert.ok(wayeZTagiem(dane, 'access', 'private').length >= 1, 'prywatna alejka');
  assert.ok(wayeZTagiem(dane, 'foot', 'no').length >= 1, 'droga bez ruchu pieszego');
  assert.ok(wayeZTagiem(dane, 'tunnel', 'yes').length >= 1, 'tunel');
  assert.ok(wayeZTagiem(dane, 'landuse', 'railway').length >= 1, 'teren kolejowy');
  assert.ok(dane.elements.filter((el) => el.type === 'way' && el.tags?.building).length >= 20, 'dużo poligonów wykluczeń');
  assert.equal(nodyZTagiem(dane, 'place', 'square').length, 1, 'plac jako node');
  assert.ok(wayeZTagiem(dane, 'leisure', 'park').length >= 1, 'park (kandydat obszarowy)');
  const muzeum = wayeZTagiem(dane, 'tourism', 'museum');
  assert.equal(muzeum.length, 1);
  assert.ok(muzeum[0].tags.building, 'muzeum jest budynkiem — stacja ma stanąć PRZED nim, nie w środku');
  assert.ok(nodyZTagiem(dane, 'barrier', 'gate').length >= 1, 'brama');
});

test('fixture przedmieście: rzadka sieć, ślepe zaułki, prywatny dojazd', () => {
  const dane = czytajFixture('przedmiescie');
  assert.equal(wayeZTagiem(dane, 'highway', 'residential').length, 8, 'główna + siedem zaułków');
  assert.ok(wayeZTagiem(dane, 'highway', 'track').length >= 1, 'droga polna');
  const prywatne = wayeZTagiem(dane, 'access', 'private');
  assert.ok(prywatne.length >= 1, 'długi prywatny dojazd (kusi odległością, musi odpaść)');
  assert.equal(prywatne[0].tags.service, 'driveway');
  assert.ok(dane.elements.filter((el) => el.type === 'way' && el.tags?.building).length >= 10, 'domy przy zaułkach');
  assert.ok(nodyZTagiem(dane, 'shop', 'convenience').length >= 1, 'sklep');
  assert.ok(nodyZTagiem(dane, 'highway', 'bus_stop').length >= 1, 'przystanek');
  assert.equal(wayeZTagiem(dane, 'tunnel', 'yes').length, 0, 'na przedmieściu nie ma tunelu');
});

test('fixture las: drogi leśne i ścieżki, ZERO budynków', () => {
  const dane = czytajFixture('las');
  assert.equal(dane.elements.filter((el) => el.type === 'way' && el.tags?.building).length, 0, 'w lesie nie ma budynków');
  assert.ok(wayeZTagiem(dane, 'highway', 'track').length >= 2, 'drogi leśne');
  assert.ok(wayeZTagiem(dane, 'highway', 'path').length >= 2, 'ścieżki (pętla + łącznik)');
  assert.equal(nodyZTagiem(dane, 'natural', 'peak').length, 1, 'szczyt/wydma');
  assert.ok(nodyZTagiem(dane, 'natural', 'tree').length >= 2, 'pomniki przyrody');
  assert.equal(nodyZTagiem(dane, 'amenity', 'parking').length, 1, 'parking leśny');
  assert.ok(nodyZTagiem(dane, 'historic', 'wayside_shrine').length >= 1, 'kapliczka');
  assert.ok(wayeZTagiem(dane, 'landuse', 'forest').length >= 1, 'kontekst: obszar lasu');
});
