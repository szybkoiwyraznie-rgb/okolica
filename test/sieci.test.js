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

/* ================================================== I3: polityka, zapytanie, parser */

import {
  INSTANCJE_OVERPASS,
  KODY_SIECI,
  POLITYKA,
  budujZapytanieOverpass,
  czyPrzelaczycInstancje,
  nazwaMiejsca,
  parsujOdpowiedz,
  pozycjaDoZapytania,
  usterka,
} from '../app/sieci.js';
import { TRYBY } from '../app/konfig.js';
import { ziarnoRozgrywki } from '../app/konfig.js';

test('instancje: łańcuch dokładnie jak ASSETS §2, w kolejności głównej', () => {
  assert.deepEqual(INSTANCJE_OVERPASS.map((i) => i.url), [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]);
  for (const i of INSTANCJE_OVERPASS) assert.match(i.url, /^https:\/\//);
});

test('polityka: stałe zgodne z ADR 0005 i ADR 0010 pkt 1', () => {
  assert.equal(POLITYKA.timeoutMs, 20_000);
  assert.equal(POLITYKA.odstepMs, 30_000);
  assert.equal(POLITYKA.mnoznikPromienia, 1.15);
  assert.equal(POLITYKA.maxRozmiarCacheBajtow, 2 * 1024 * 1024);
  assert.equal(POLITYKA.ttlCacheDni, 30);
});

test('polityka: przełączamy przy 406/429/5xx/timeout/błędzie sieci, nie przy 400', () => {
  assert.equal(czyPrzelaczycInstancje({ status: 429 }), true);
  assert.equal(czyPrzelaczycInstancje({ status: 504 }), true);
  assert.equal(czyPrzelaczycInstancje({ status: 500 }), true);
  assert.equal(czyPrzelaczycInstancje({ status: 406 }), true);
  assert.equal(czyPrzelaczycInstancje({ timeout: true }), true);
  assert.equal(czyPrzelaczycInstancje({ bladSieci: true }), true);
  assert.equal(czyPrzelaczycInstancje({ status: 200 }), false, 'sukces — nie przełączamy');
  assert.equal(czyPrzelaczycInstancje({ status: 400 }), false, 'błąd zapytania: następna instancja odpowie tak samo');
  assert.equal(czyPrzelaczycInstancje({}), false);
});

test('zapytanie: promień R×1.15, pozycja na siatce ~6 m (ADR 0013 pkt 3), out geom, is_in', () => {
  const q = budujZapytanieOverpass({ srodek: { lat: 52.22973, lon: 21.01224 }, promienM: 1000, tryb: 'piesza' });
  assert.match(q, /^\[out:json\]\[timeout:25\];/);
  assert.match(q, /around:1150,/, 'promień zapytania = 1000 × 1.15');
  assert.ok(q.includes('52.22975'), 'lat zaokrąglony do siatki (jak ziarno rozgrywki)');
  assert.ok(!q.includes('52.22973'), 'dokładna pozycja NIE opuszcza urządzenia w tej postaci');
  // ta sama siatka co ziarnoRozgrywki — spójność kluczy cache i ziarna
  const z = ziarnoRozgrywki({ lat: 52.22973, lon: 21.01224, promienM: 1000, liczbaStacji: 5, data: '2026-09-05' });
  assert.ok(z.includes(pozycjaDoZapytania({ lat: 52.22973, lon: 21.01224 }).lat.toFixed(5)));
  assert.match(q, /is_in\(52\.22975,21\.01225\)->\.obszary;/);
  assert.match(q, /area\(\.obszary\)\["boundary"="administrative"\];/);
  assert.match(q, /way\["building"\]/);
  assert.match(q, /way\["landuse"="railway"\]/);
  assert.match(q, /node\["barrier"\]/);
  assert.match(q, /node\["place"="square"\]/);
  assert.match(q, /^out geom;$/m);
});

test('zapytanie: klasy dróg z TRYBY — piesza bez secondary, samochód bez motorway i bez schodów', () => {
  const klasyZZapytania = (q) => q.match(/"highway"~"\^\(([^)]+)\)\$"/)[1].split('|');
  const qPiesza = budujZapytanieOverpass({ srodek: { lat: 52.23, lon: 21.01 }, promienM: 1000, tryb: 'piesza' });
  assert.deepEqual(klasyZZapytania(qPiesza), TRYBY.piesza.klasyDrog, 'regex klas = klasyDrog trybu, w kolejności');
  assert.ok(!qPiesza.includes('secondary'), 'piesza nie pobiera dróg klasy secondary');
  assert.ok(!qPiesza.includes('motorway'));

  const qAuto = budujZapytanieOverpass({ srodek: { lat: 52.23, lon: 21.01 }, promienM: 10000, tryb: 'samochodowa' });
  for (const klasa of TRYBY.samochodowa.wykluczoneKlasy) assert.ok(!qAuto.includes(klasa), `samochód nie pobiera ${klasa}`);
  assert.ok(qAuto.includes('primary') && qAuto.includes('secondary'));
  assert.match(qAuto, /around:11500,/);

  const qRower = budujZapytanieOverpass({ srodek: { lat: 52.23, lon: 21.01 }, promienM: 3000, tryb: 'rower' });
  assert.ok(!qRower.includes('steps'), 'rower nie jeździ po schodach');
  assert.ok(qRower.includes('cycleway'));
});

test('zapytanie: deterministyczne i waliduje wejście kodami S05/S06/S07', () => {
  const args = { srodek: { lat: 52.23, lon: 21.01 }, promienM: 1000, tryb: 'piesza' };
  assert.equal(budujZapytanieOverpass(args), budujZapytanieOverpass(args));
  assert.throws(() => budujZapytanieOverpass({ ...args, srodek: null }), (e) => e.kod === 'S05');
  assert.throws(() => budujZapytanieOverpass({ ...args, srodek: { lat: 999, lon: 0 } }), (e) => e.kod === 'S05');
  assert.throws(() => budujZapytanieOverpass({ ...args, promienM: 0 }), (e) => e.kod === 'S06');
  assert.throws(() => budujZapytanieOverpass({ ...args, promienM: NaN }), (e) => e.kod === 'S06');
  assert.throws(() => budujZapytanieOverpass({ ...args, tryb: 'lotnia' }), (e) => e.kod === 'S07');
});

test('usterka: Error z kodem, komunikatem z tabeli i powodem', () => {
  const e = usterka('S03', '429 z FOSSGIS');
  assert.ok(e instanceof Error);
  assert.equal(e.kod, 'S03');
  assert.equal(e.komunikat, KODY_SIECI.S03);
  assert.match(e.message, /^S03: /);
  assert.match(e.message, /429 z FOSSGIS/);
  assert.equal(usterka('S99').komunikat, 'Nieznana usterka warstwy sieci.', 'nieznany kod nie wykłada się');
});

test("parser: trzy fixture'y dają drogi, budynki, POI, bariery i obszary", () => {
  for (const nazwa of NAZWY) {
    const p = parsujOdpowiedz(czytajFixture(nazwa));
    assert.ok(p.drogi.length > 0, `${nazwa}: drogi`);
    assert.ok(p.obszary.length === 3, `${nazwa}: obszary`);
    const poziomy = p.obszary.map((o) => o.adminLevel);
    assert.deepEqual(poziomy, [...poziomy].sort((a, b) => a - b), 'posortowane od grubego do drobnego');
    for (const d of p.drogi) {
      assert.ok(d.punkty.length >= 2);
      assert.ok(d.tags.highway, 'droga bez highway nie powinna trafić do dróg');
    }
    for (const b of p.budynki) {
      assert.deepEqual(b.punkty[0], b.punkty.at(-1), 'poligon zamknięty');
      assert.ok(b.bbox.minLat <= b.bbox.maxLat && b.bbox.minLon <= b.bbox.maxLon);
    }
  }
  const c = parsujOdpowiedz(czytajFixture('centrum'));
  assert.ok(c.budynki.length >= 50);
  assert.ok(c.poi.length >= 8);
  assert.ok(c.bariery.length >= 1);
  assert.ok(c.wykluczeniaObszarowe.length >= 1, 'teren kolejowy');
  assert.equal(nazwaMiejsca(c), 'Śródmieście');
  assert.equal(nazwaMiejsca(parsujOdpowiedz(czytajFixture('przedmiescie'))), 'Wawer');
  assert.equal(nazwaMiejsca(parsujOdpowiedz(czytajFixture('las'))), 'Bielany');
  assert.equal(nazwaMiejsca({ obszary: [] }), null);
  const l = parsujOdpowiedz(czytajFixture('las'));
  assert.equal(l.budynki.length, 0, 'las bez budynków');
});

test('parser: POI-budynek (muzeum) jest wykluczeniem I kandydatem przy wejściu', () => {
  const c = parsujOdpowiedz(czytajFixture('centrum'));
  const muzeumPoi = c.poi.find((p) => p.tags.tourism === 'museum');
  const muzeumBudynek = c.budynki.find((b) => b.tags.tourism === 'museum');
  assert.ok(muzeumPoi && muzeumBudynek, 'muzeum w obu listach');
  assert.equal(muzeumPoi.rodzaj, 'way-budynek');
  const { punkt, bbox: ramka } = muzeumPoi;
  assert.ok(punkt.lat >= ramka.minLat && punkt.lat <= ramka.maxLat, 'środek masy w bbox');
  assert.ok(punkt.lon >= ramka.minLon && punkt.lon <= ramka.maxLon);
});

test('parser: toleruje braki — way bez geometrii (S08), elementy bez sensu (odrzucone)', () => {
  const surowe = czytajFixture('centrum');
  const zmutowane = structuredClone(surowe);
  const droga = zmutowane.elements.find((el) => el.type === 'way' && el.tags?.highway);
  delete droga.geometry;
  droga.nodes = [1, 2, 3]; // tylko refs-y — realny Overpass po `out body` bez `out geom`
  zmutowane.elements.push({ type: 'node', id: 999001, lat: 52.23, lon: 21.01 }); // bez tags
  zmutowane.elements.push({ type: 'area', id: 999002, tags: { boundary: 'administrative' } }); // bez name
  zmutowane.elements.push('śmieć');
  const p = parsujOdpowiedz(zmutowane);
  const oryg = parsujOdpowiedz(surowe);
  assert.equal(p.drogi.length, oryg.drogi.length - 1, 'way bez geometrii nie zasila dróg');
  assert.equal(p.usterki.length, 1);
  assert.equal(p.usterki[0].kod, 'S08');
  assert.equal(p.usterki[0].id, droga.id);
  assert.ok(p.odrzucone >= 3, 'śmieci policzone, nie wyjątek');
});

test('parser: garbage → S01, brak sieci → S02', () => {
  assert.throws(() => parsujOdpowiedz(null), (e) => e.kod === 'S01');
  assert.throws(() => parsujOdpowiedz({}), (e) => e.kod === 'S01');
  assert.throws(() => parsujOdpowiedz({ elements: 'nie-tablica' }), (e) => e.kod === 'S01');
  assert.throws(() => parsujOdpowiedz({ elements: [] }), (e) => e.kod === 'S02');
  assert.throws(
    () => parsujOdpowiedz({ elements: [{ type: 'node', id: 1, lat: 52, lon: 21, tags: { amenity: 'cafe' } }] }),
    (e) => e.kod === 'S02',
    'samo POI bez dróg to nie sieć',
  );
});
