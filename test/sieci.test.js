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
  assert.equal(wayeZTagiem(dane, 'highway', 'residential').length, 9, 'główna + osiem zaułków');
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

/* ============================================ I4: graf, Dijkstra, snapowanie */

import {
  BUDZET_GRAFU,
  budujGraf,
  czyDrogaDostepna,
  dijkstra,
  sciezkaDo,
  snapujPunkt,
} from '../app/sieci.js';
import { odlegloscM, przesunPunkt } from '../app/geo.js';

/** Minimalna sieć z ręki: punkty co `ileM` metrów wzdłuż azymutu ze startu. */
function droga(start, azymut, punktyCoM, ile, tags) {
  const pkt = [start];
  for (let i = 1; i < ile; i++) pkt.push(przesunPunkt(start, azymut, punktyCoM * i));
  return { id: ile * 1000 + Math.round(azymut), punkty: pkt, tags };
}

const SRODEK_TEST = { lat: 52.23, lon: 21.01 };

test('dostępność: klasy trybu + wykluczenia wspólne (ADR 0005 pkt 3)', () => {
  const d = (tags) => ({ tags });
  assert.equal(czyDrogaDostepna(d({ highway: 'residential' }), 'piesza'), true);
  assert.equal(czyDrogaDostepna(d({ highway: 'primary' }), 'piesza'), false, 'primary nie dla pieszego');
  assert.equal(czyDrogaDostepna(d({ highway: 'steps' }), 'piesza'), true);
  assert.equal(czyDrogaDostepna(d({ highway: 'steps' }), 'rower'), false, 'schody nie dla roweru');
  assert.equal(czyDrogaDostepna(d({ highway: 'primary' }), 'samochodowa'), true);
  assert.equal(czyDrogaDostepna(d({ highway: 'motorway' }), 'samochodowa'), false, 'autostrada nigdy');
  assert.equal(czyDrogaDostepna(d({ highway: 'residential', access: 'private' }), 'piesza'), false);
  assert.equal(czyDrogaDostepna(d({ highway: 'residential', access: 'no' }), 'samochodowa'), false);
  assert.equal(czyDrogaDostepna(d({ highway: 'residential', tunnel: 'yes' }), 'piesza'), false);
  assert.equal(czyDrogaDostepna(d({ highway: 'primary', foot: 'no' }), 'piesza'), false);
  assert.equal(czyDrogaDostepna(d({ highway: 'primary', foot: 'no' }), 'samochodowa'), true, 'samochód nie patrzy na foot');
  assert.equal(czyDrogaDostepna(d({}), 'piesza'), false, 'bez highway — nie droga');
  assert.throws(() => czyDrogaDostepna(d({ highway: 'path' }), 'lotnia'), (e) => e.kod === 'S07');
});

test('graf: interpolacja co ≤50 m, krawędzie symetryczne, wagi w metrach', () => {
  const siec = { drogi: [droga(SRODEK_TEST, 90, 120, 3, { highway: 'residential' })] };
  const g = budujGraf(siec, { tryb: 'piesza' });
  // dwa segmenty po 120 m → każdy dzielony na ceil(120/50)=3 części
  assert.equal(g.wezly.length, 1 + 3 + 3, 'start + 3 węzły na segment (2 wewnętrzne + koniec) × 2 segmenty... dokładnie: 7');
  assert.equal(g.krokM, 50);
  for (let i = 0; i < g.sasiedztwo.length; i++) {
    for (const k of g.sasiedztwo[i]) {
      assert.ok(g.sasiedztwo[k.do].some((odwrotna) => odwrotna.do === i), 'krawędź dwukierunkowa');
      assert.ok(Math.abs(k.metry - 40) < 1, `podział 120 m na 3 części daje ~40 m (jest ${k.metry})`);
    }
  }
  const suma = g.sasiedztwo.reduce((a, s) => a + s.length, 0) / 2;
  assert.equal(g.liczniki.krawedzi, suma);
});

test('graf: droga prywatna i tunel nie wchodzą do sieci, licznik to pokazuje', () => {
  const siec = {
    drogi: [
      droga(SRODEK_TEST, 0, 60, 4, { highway: 'residential' }),
      droga(przesunPunkt(SRODEK_TEST, 90, 100), 0, 60, 4, { highway: 'residential', access: 'private' }),
      droga(przesunPunkt(SRODEK_TEST, 90, 200), 0, 60, 4, { highway: 'residential', tunnel: 'yes' }),
    ],
  };
  const g = budujGraf(siec, { tryb: 'piesza' });
  assert.equal(g.liczniki.drogDostepnych, 1);
  assert.equal(g.liczniki.drogNiedostepnych, 2);
  // węzły tylko z jednej drogi: 4 punkty → segmenty 60 m → po 2 części = 7 węzłów
  assert.equal(g.wezly.length, 7);
});

test('graf: zero dostępnych dróg → S09 (las dla samochodu, offline dla pieszego)', () => {
  const las = parsujOdpowiedz(czytajFixture('las'));
  assert.throws(() => budujGraf(las, { tryb: 'samochodowa' }), (e) => e.kod === 'S09', 'w lesie są tylko track/path — samochód nie wjedzie');
  assert.throws(() => budujGraf({ drogi: [] }, { tryb: 'piesza' }), (e) => e.kod === 'S09');
  const pieszo = budujGraf(las, { tryb: 'piesza' });
  assert.ok(pieszo.wezly.length > 100, 'las pieszo ma gęstą sieć interpolowaną');
});

test('graf: budżet węzłów — gigantyczna droga dostaje większy krok interpolacji', () => {
  const gigant = { drogi: [droga(SRODEK_TEST, 90, 5000, 201, { highway: 'track' })] }; // 1000 km!
  const g = budujGraf(gigant, { tryb: 'piesza' });
  assert.ok(g.wezly.length <= BUDZET_GRAFU.maxWezlow + 400, `węzłów ${g.wezly.length} — budżet przekroczony`);
  assert.ok(g.krokM > BUDZET_GRAFU.krokM, 'krok urósł powyżej 50 m');
  assert.ok(g.krokM <= BUDZET_GRAFU.maxKrokM, 'krok nie przekracza maksimum');
});

test('graf: deterministyczny — dwa budowania identyczne', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const a = budujGraf(dane, { tryb: 'piesza' });
  const b = budujGraf(dane, { tryb: 'piesza' });
  assert.deepEqual(a.wezly, b.wezly);
  assert.deepEqual(a.sasiedztwo, b.sasiedztwo);
  assert.deepEqual(a.liczniki, b.liczniki);
});

test("graf centrum: interpolacja działa, a klasy dróg zależą od trybu", () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const g = budujGraf(dane, { tryb: 'piesza' });
  // siatka 9×9 co 75 m: wierzchołki + interpolowane (segment 75 m → 2 części)
  assert.ok(g.wezly.length >= 81 + 100, `węzłów ${g.wezly.length} — interpolacja działa`);
  // środek siatki: deptak (pion) jest dla pieszego, ale ulica pozioma to
  // `tertiary` — ADR 0005 pkt 3 NIE puszcza pieszego wzdłuż tertiary,
  // więc skrzyżowanie ma dla niego stopień 2 (tylko deptak)
  const srodek = snapujPunkt(g, { lat: 52.2297, lon: 21.0122 }, { maxM: 30 });
  assert.ok(srodek !== null);
  assert.equal(g.sasiedztwo[srodek].length, 2, 'pieszy: deptak tak, tertiary nie');
  // rower jeździ po tertiary — to samo skrzyżowanie spina cztery ulice
  const gRower = budujGraf(dane, { tryb: 'rower' });
  const srodekR = snapujPunkt(gRower, { lat: 52.2297, lon: 21.0122 }, { maxM: 30 });
  assert.equal(gRower.sasiedztwo[srodekR].length, 4, 'rower: pełne skrzyżowanie');
  // różnica klas nie jest „większa/mniejsza", tylko INNA: pieszy ma schody
  // i chodniki, rower ma tertiary i nie wjeżdża na steps
  const klasyPiesza = new Set(g.wezly.length ? dane.drogi.filter((d) => czyDrogaDostepna(d, 'piesza')).map((d) => d.tags.highway) : []);
  const klasyRower = new Set(dane.drogi.filter((d) => czyDrogaDostepna(d, 'rower')).map((d) => d.tags.highway));
  assert.ok(klasyPiesza.has('steps') && !klasyRower.has('steps'), 'schody tylko dla pieszego');
  assert.ok(!klasyPiesza.has('tertiary') && klasyRower.has('tertiary'), 'tertiary tylko dla roweru (i samochodu)');
});

test('dijkstra: dystanse sieciowe, ścieżka i nieosiągalne wyspy', () => {
  // litera T: pion 0→300 m, poziom od szczytu w lewo/prawo po 200 m
  const pion = droga(SRODEK_TEST, 0, 100, 4, { highway: 'residential' });
  const szczyt = pion.punkty[3];
  const poziomL = droga(szczyt, 270, 100, 3, { highway: 'residential' });
  const poziomP = droga(szczyt, 90, 100, 3, { highway: 'residential' });
  const wyspa = droga(przesunPunkt(SRODEK_TEST, 45, 900), 90, 100, 3, { highway: 'residential' });
  const g = budujGraf({ drogi: [pion, poziomL, poziomP, wyspa] }, { tryb: 'piesza' });

  const start = snapujPunkt(g, SRODEK_TEST, { maxM: 5 });
  assert.equal(start, 0, 'pierwszy węzeł to start drogi');
  const wynik = dijkstra(g, start);

  const koniecL = snapujPunkt(g, poziomL.punkty[2], { maxM: 5 });
  const koniecP = snapujPunkt(g, poziomP.punkty[2], { maxM: 5 });
  const koniecWyspy = snapujPunkt(g, wyspa.punkty[2], { maxM: 5 });
  assert.ok(Math.abs(wynik.dystanse[koniecL] - 500) < 2, `300 m pionu + 200 m poziomu ≈ 500 (jest ${wynik.dystanse[koniecL]})`);
  assert.ok(Math.abs(wynik.dystanse[koniecP] - 500) < 2);
  assert.equal(wynik.dystanse[koniecWyspy], Infinity, 'wyspa bez połączenia jest nieosiągalna');
  assert.equal(sciezkaDo(wynik, koniecWyspy), null);

  const sciezka = sciezkaDo(wynik, koniecL);
  assert.ok(Array.isArray(sciezka));
  assert.equal(sciezka[0], start);
  assert.equal(sciezka.at(-1), koniecL);
  // suma wag wzdłuż ścieżki == dystans
  let suma = 0;
  for (let i = 1; i < sciezka.length; i++) {
    suma += g.sasiedztwo[sciezka[i - 1]].find((k) => k.do === sciezka[i]).metry;
  }
  assert.ok(Math.abs(suma - wynik.dystanse[koniecL]) < 0.001, 'ścieżka sumuje się do dystansu');
  assert.throws(() => dijkstra(g, 99999), (e) => e.kod === 'S10');
});

test('dijkstra: dystans sieciowy ≥ prosta linia i rośnie, gdy rzeka bez mostu', () => {
  // dwie równoległe drogi 300 m apart, połączone TYLKO na zachodnim końcu
  const poludnie = droga(SRODEK_TEST, 90, 100, 7, { highway: 'residential' });
  const startPoludnie = przesunPunkt(SRODEK_TEST, 180, 300);
  const polnoc = droga(startPoludnie, 90, 100, 7, { highway: 'residential' });
  const lacznik = droga(SRODEK_TEST, 180, 300, 2, { highway: 'footway' });
  const g = budujGraf({ drogi: [poludnie, polnoc, lacznik] }, { tryb: 'piesza' });
  const wynik = dijkstra(g, snapujPunkt(g, SRODEK_TEST, { maxM: 5 }));
  const celProsty = snapujPunkt(g, polnoc.punkty[6], { maxM: 5 });
  const wProstej = odlegloscM(SRODEK_TEST, polnoc.punkty[6]);
  assert.ok(wynik.dystanse[celProsty] >= wProstej - 1, 'sieciowy nigdy krótszy niż w linii prostej');
  assert.ok(Math.abs(wynik.dystanse[celProsty] - 900) < 5, '300 m na południe + 600 m na wschód = 900 m sieciowo');
  assert.ok(wynik.dystanse[celProsty] > wProstej + 150, `okrążenie wyraźnie dłuższe niż prosta (${Math.round(wynik.dystanse[celProsty])} vs ${Math.round(wProstej)})`);
});

test('snap: najbliższy węzeł w zasięgu, null poza zasięgiem i na pusty graf', () => {
  const g = budujGraf({ drogi: [droga(SRODEK_TEST, 90, 100, 4, { highway: 'residential' })] }, { tryb: 'piesza' });
  assert.equal(snapujPunkt(g, SRODEK_TEST), 0);
  const obok = przesunPunkt(przesunPunkt(SRODEK_TEST, 90, 150), 0, 20); // 20 m od drogi
  const idx = snapujPunkt(g, obok, { maxM: 50 });
  assert.ok(idx !== null);
  assert.ok(odlegloscM(g.wezly[idx], obok) <= 25, 'snap do węzła interpolowanego ≤ pół segmentu + 20 m');
  assert.equal(snapujPunkt(g, przesunPunkt(SRODEK_TEST, 0, 400), { maxM: 100 }), null, 'za daleko');
  assert.equal(snapujPunkt({ wezly: [], sasiedztwo: [] }, SRODEK_TEST), null);
  assert.equal(snapujPunkt(g, { lat: NaN, lon: 1 }), null);
});

/* ====================================== I5: kandydaci i filtry dostępności */

import { kandydaciNaStacje, punktWPolygonie } from '../app/sieci.js';

function dystansM(a, b) {
  return odlegloscM(a, b);
}

test('polygon: ray casting z prefiltrem bbox (wklęsły L też działa)', () => {
  const kwadrat = {
    punkty: [
      { lat: 52.0, lon: 21.0 }, { lat: 52.0, lon: 21.001 },
      { lat: 52.001, lon: 21.001 }, { lat: 52.001, lon: 21.0 }, { lat: 52.0, lon: 21.0 },
    ],
  };
  assert.equal(punktWPolygonie({ lat: 52.0005, lon: 21.0005 }, kwadrat), true);
  assert.equal(punktWPolygonie({ lat: 52.002, lon: 21.0005 }, kwadrat), false, 'na północ od bbox');
  assert.equal(punktWPolygonie({ lat: 51.9995, lon: 21.0005 }, kwadrat), false);
  // L: kwadrat 2×2 minus ćwiartka prawy-górny
  const literaL = {
    punkty: [
      { lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 0, lon: 2 }, { lat: 1, lon: 2 },
      { lat: 1, lon: 1 }, { lat: 2, lon: 1 }, { lat: 2, lon: 0 }, { lat: 0, lon: 0 },
    ].map((p) => ({ lat: 52 + p.lat * 0.001, lon: 21 + p.lon * 0.001 })),
  };
  assert.equal(punktWPolygonie({ lat: 52.0005, lon: 21.0005 }, literaL), true, 'dolna belka L');
  assert.equal(punktWPolygonie({ lat: 52.0015, lon: 21.0015 }, literaL), false, 'wycięta ćwiartka — w bbox, poza poligonem');
  assert.equal(punktWPolygonie({ lat: 52.0015, lon: 21.0005 }, literaL), true, 'pionowa belka L');
});

test('kandydaci centrum (piesza): dużo, żadnego w budynku ani na terenie kolejowym', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci, liczniki } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  assert.ok(kandydaci.length > 150, `kandydatów ${kandydaci.length} — siatka + interpolacja + POI`);
  for (const k of kandydaci) {
    for (const budynek of dane.budynki) {
      assert.equal(punktWPolygonie(k, budynek), false, `kandydat ${k.nazwa ?? k.wezel} siedzi w budynku`);
    }
    for (const strefa of dane.wykluczeniaObszarowe) {
      assert.equal(punktWPolygonie(k, strefa), false, 'kandydat na terenie kolejowym');
    }
  }
  // muzeum: kandydat „przy wejściu" — węzeł sieci PRZED bryłą, nie w środku
  const muzeum = kandydaci.find((k) => k.poi?.tags?.tourism === 'museum');
  assert.ok(muzeum, 'muzeum jest kandydatem');
  assert.equal(muzeum.typ, 'poi');
  assert.equal(muzeum.nazwa, 'Muzeum Okolicy');
  const brylaMuzeum = dane.budynki.find((b) => b.tags.tourism === 'museum');
  assert.equal(punktWPolygonie(muzeum, brylaMuzeum), false, 'stacja przy muzeum nie stoi w muzeum');
  assert.ok(dystansM(muzeum, brylaMuzeum.punkty[0]) < 60, 'i jest blisko wejścia (≤ 60 m od narożnika)');
  // prywatna alejka nie istnieje w grafie — w jej głębi nie ma kandydatów
  // (wlot z publicznej ulicy zostaje: to normalny węzeł sieci)
  const prywatna = dane.drogi.find((d) => d.tags.access === 'private');
  const glebiaAlejki = prywatna.punkty[1];
  assert.ok(!kandydaci.some((k) => dystansM(k, glebiaAlejki) < 25), 'ślepy prywatny dojazd bez kandydatów');
  assert.ok(kandydaci.some((k) => dystansM(k, prywatna.punkty[0]) < 5), 'wlot z publicznej ścieżki zostaje kandydatem');
  assert.equal(liczniki.poiBezSieci, 0, 'w centrum każde POI ma sieć w zasięgu 80 m');
});

test('kandydaci centrum: deterministyczni i kompletowi (typy, nazwy)', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const a = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  const b = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  assert.deepEqual(a, b);
  assert.ok(a.kandydaci.some((k) => k.typ === 'poi' && k.nazwa === 'Kawa za Rogiem'), 'kawiarnia kandydatem');
  assert.ok(a.kandydaci.some((k) => k.typ === 'poi' && k.poi?.tags.place === 'square'), 'plac kandydatem');
  assert.ok(a.kandydaci.some((k) => k.typ === 'siec'), 'zwykłe węzły sieci też');
});

test('kandydaci przedmieście: domy wykluczone, prywatny dojazd nie kusi', () => {
  const dane = parsujOdpowiedz(czytajFixture('przedmiescie'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  assert.ok(kandydaci.length > 50);
  for (const k of kandydaci) {
    for (const dom of dane.budynki) {
      assert.equal(punktWPolygonie(k, dom), false, `kandydat w domu ${dom.tags.name ?? dom.id}`);
    }
  }
  // prywatny dojazd: kandydaci wolno tylko przy samym wlocie z ulicy Głównej
  const prywatna = dane.drogi.find((d) => d.tags.access === 'private');
  const wlot = prywatna.punkty[0];
  for (const k of kandydaci) {
    for (let i = 1; i < prywatna.punkty.length; i++) {
      assert.ok(dystansM(k, prywatna.punkty[i]) > 15, 'żaden kandydat nie stoi w głębi prywatnego dojazdu');
    }
  }
  assert.ok(kandydaci.some((k) => dystansM(k, wlot) < 5), 'wlot z publicznej ulicy zostaje kandydatem');
  assert.ok(kandydaci.some((k) => k.nazwa === 'Sklep u Kowalskich'), 'sklep kandydatem');
});

test('kandydaci las (piesza): parking i polana przy sieci, odległe POI przepadają z licznikiem', () => {
  const dane = parsujOdpowiedz(czytajFixture('las'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci, liczniki } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  assert.ok(kandydaci.some((k) => k.nazwa === 'Parking Leśny'), 'parking leśny');
  assert.ok(kandydaci.some((k) => k.nazwa === 'Polana Piknikowa'), 'polana piknikowa');
  assert.equal(dane.budynki.length, 0, 'w lesie zero budynków — filtry brył nie mają roboty');
  assert.ok(liczniki.poiBezSieci >= 2, `punkt widokowy i szczyt są daleko od ścieżek (poiBezSieci=${liczniki.poiBezSieci})`);
});

test('kandydaci samochód: TYLKO POI (parking/obiekt z dojazdem), nigdy punkt na jezdni', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'samochodowa' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'samochodowa' });
  assert.ok(kandydaci.length >= 4, `POI z dojazdem: ${kandydaci.length}`);
  for (const k of kandydaci) {
    assert.equal(k.typ, 'poi', 'samochód nie staje byle gdzie przy ulicy');
    for (const budynek of dane.budynki) assert.equal(punktWPolygonie(k, budynek), false);
  }
  assert.ok(kandydaci.some((k) => k.poi?.tags.amenity === 'parking'), 'parking jest kandydatem');
});

test('kandydaci: strażnicy — S07 nieznany tryb, S09 pusty graf, S11 rozjazd trybów', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  assert.throws(() => kandydaciNaStacje(dane, graf, { tryb: 'lotnia' }), (e) => e.kod === 'S07');
  assert.throws(() => kandydaciNaStacje(dane, { wezly: [], sasiedztwo: [] }, { tryb: 'piesza' }), (e) => e.kod === 'S09');
  assert.throws(() => kandydaciNaStacje(dane, graf, { tryb: 'rower' }), (e) => e.kod === 'S11');
});

test('kandydaci: POI bez sieci w zasięgu i brama prywatna — przypadki brzegowe z ręki', () => {
  const start = { lat: 52.23, lon: 21.01 };
  const droga = { id: 1, punkty: [przesunPunkt(start, 270, 150), start, przesunPunkt(start, 90, 150)], tags: { highway: 'residential' } };
  const dalekiePoi = { id: 11, punkt: przesunPunkt(start, 0, 500), tags: { amenity: 'cafe', name: 'Kawa za Lasem' }, rodzaj: 'node' };
  const bliskiePoi = { id: 12, punkt: przesunPunkt(start, 90, 150), tags: { amenity: 'cafe', name: 'Kawa na Końcu' }, rodzaj: 'node' };
  const graf = budujGraf({ drogi: [droga] }, { tryb: 'piesza' });
  const wynik = kandydaciNaStacje(
    { drogi: [droga], budynki: [], wykluczeniaObszarowe: [], poi: [dalekiePoi, bliskiePoi], bariery: [], obszary: [] },
    graf,
    { tryb: 'piesza' },
  );
  assert.equal(wynik.liczniki.poiBezSieci, 1, 'kawiarnia 500 m od drogi odpada');
  assert.ok(wynik.kandydaci.some((k) => k.nazwa === 'Kawa na Końcu'), 'bliskie POI zostaje');

  // brama z access=private blokuje węzeł, przy którym stoi
  const brama = { id: 21, punkt: start, tags: { barrier: 'gate', access: 'private' } };
  const zBrama = kandydaciNaStacje(
    { drogi: [droga], budynki: [], wykluczeniaObszarowe: [], poi: [], bariery: [brama], obszary: [] },
    graf,
    { tryb: 'piesza' },
  );
  assert.equal(zBrama.liczniki.wykluczonychBariera >= 1, true, 'węzeł przy bramie wykluczony');
  assert.ok(!zBrama.kandydaci.some((k) => dystansM(k, start) < 1), 'przy samej bramie nikt nie stoi');
  assert.ok(zBrama.kandydaci.length > 2, 'reszta drogi zostaje');
});

/* ============================ I6: wybór stacji (pierścień, separacje, pass) */

import { PIERSCIEN_WYBORU, miaraSprawiedliwosci, wybierzStacje } from '../app/stacje.js';

const SCENARIUSZE = [
  { nazwa: 'centrum', srodek: { lat: 52.2297, lon: 21.0122 }, R: 600, N: 5 },
  { nazwa: 'przedmiescie', srodek: { lat: 52.1893, lon: 21.1635 }, R: 1000, N: 4 },
  { nazwa: 'las', srodek: { lat: 52.3124, lon: 21.0437 }, R: 1500, N: 4 },
];

function pelnyWybor(scenariusz, ziarno = 'ziarno-testowe') {
  const dane = parsujOdpowiedz(czytajFixture(scenariusz.nazwa));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  const wynik = wybierzStacje({
    graf,
    kandydaci,
    srodek: scenariusz.srodek,
    konfig: { liczbaStacji: scenariusz.N, promienM: scenariusz.R },
    ziarno,
  });
  return { dane, graf, kandydaci, wynik };
}

for (const scenariusz of SCENARIUSZE) {
  test(`wybór ${scenariusz.nazwa}: N stacji z sieci, sprawiedliwość ≤ 15% (kryterium ROADMAP M4)`, () => {
    const { dane, wynik } = pelnyWybor(scenariusz);
    const { stacje, macierz, sprawiedliwosc, usterki } = wynik;
    assert.deepEqual(usterki, [], 'komplet stacji bez usterek');
    assert.equal(stacje.length, scenariusz.N);
    assert.ok(sprawiedliwosc.udzialOdchylenia <= 0.15,
      `udział odchylenia ${(sprawiedliwosc.udzialOdchylenia * 100).toFixed(1)}% > 15% (d: ${stacje.map((s) => s.dystansSieciowyM)})`);

    for (const s of stacje) {
      assert.equal(s.zrodlo, 'siec');
      assert.ok(Number.isFinite(s.dystansSieciowyM) && s.dystansSieciowyM > 0);
      assert.ok(Number.isFinite(s.odlegloscM) && Number.isFinite(s.bearing));
      assert.equal(s.id >= 1, true);
      // KRYTERIUM: żadna stacja w budynku ani na terenie prywatnym/kolejowym
      for (const budynek of dane.budynki) assert.equal(punktWPolygonie(s, budynek), false, `stacja ${s.id} w budynku`);
      for (const strefa of dane.wykluczeniaObszarowe) assert.equal(punktWPolygonie(s, strefa), false, `stacja ${s.id} na terenie kolejowym`);
      for (const droga of dane.drogi) {
        if (droga.tags.access === 'private' || droga.tags.access === 'no') {
          for (let i = 1; i < droga.punkty.length; i++) {
            assert.ok(odlegloscM(s, droga.punkty[i]) > 15, `stacja ${s.id} w głębi prywatnej drogi`);
          }
        }
      }
      // ścieżka sugerowana: od startu do stacji
      assert.ok(s.sciezkaPunkty.length >= 2, 'ścieżka ma co najmniej dwa punkty');
      assert.ok(odlegloscM(s.sciezkaPunkty.at(-1), s) < 2, 'ścieżka kończy się w stacji');
      assert.ok(odlegloscM(s.sciezkaPunkty[0], scenariusz.srodek) < 160, 'ścieżka zaczyna się przy pozycji startowej');
    }

    // separacje: kątowa ≥ 0.7×360/N i sieciowa ≥ 0.5r, para ≥ 0.3r (ADR 0005 pkt 5)
    const r = scenariusz.R * PIERSCIEN_WYBORU.udzial;
    const katMin = PIERSCIEN_WYBORU.separacjaKatowaUdzial * (360 / scenariusz.N);
    for (let i = 0; i < stacje.length; i++) {
      for (let j = i + 1; j < stacje.length; j++) {
        let dk = Math.abs(stacje[i].kat - stacje[j].kat) % 360;
        if (dk > 180) dk = 360 - dk;
        assert.ok(dk >= katMin - 0.5, `separacja kątowa ${dk.toFixed(1)}° < ${katMin.toFixed(1)}° (${stacje[i].id}↔${stacje[j].id})`);
        const dsiec = macierz[i][j];
        assert.ok(dsiec === null || dsiec >= PIERSCIEN_WYBORU.separacjaSieciowaUdzial * r - 1,
          `separacja sieciowa ${dsiec} < ${(PIERSCIEN_WYBORU.separacjaSieciowaUdzial * r).toFixed(0)} m`);
        assert.ok(dsiec === null || dsiec >= PIERSCIEN_WYBORU.karaParaUdzial * r - 1,
          `para ${stacje[i].id}↔${stacje[j].id} bliżej niż ${(PIERSCIEN_WYBORU.karaParaUdzial * r).toFixed(0)} m po passie`);
      }
    }

    // macierz: symetryczna, zero na przekątnej, sieciowo ≥ prosta linia
    for (let i = 0; i < macierz.length; i++) {
      assert.equal(macierz[i][i], 0);
      for (let j = 0; j < macierz.length; j++) {
        assert.equal(macierz[i][j], macierz[j][i], 'macierz symetryczna');
        if (macierz[i][j] !== null) {
          assert.ok(macierz[i][j] >= odlegloscM(stacje[i], stacje[j]) - 2, 'sieciowy nie krótszy niż w linii prostej');
        }
      }
    }
  });
}

test('wybór: determinizm pod ziarnem — to samo ziarno ten sam układ, inne ziarno inny', () => {
  const a = pelnyWybor(SCENARIUSZE[0], 'ziarno-A');
  const a2 = pelnyWybor(SCENARIUSZE[0], 'ziarno-A');
  const b = pelnyWybor(SCENARIUSZE[0], 'ziarno-B-inne');
  assert.deepEqual(a.wynik.stacje, a2.wynik.stacje, 'identyczne ziarno → identyczny układ');
  assert.deepEqual(a.wynik.macierz, a2.wynik.macierz);
  const kluczeA = a.wynik.stacje.map((s) => `${s.lat},${s.lon}`).join('|');
  const kluczeB = b.wynik.stacje.map((s) => `${s.lat},${s.lon}`).join('|');
  assert.notEqual(kluczeA, kluczeB, 'inne ziarno → inny układ (szum ziarna ±2% r)');
});

test('wybór: za uboga sieć → mniej stacji z usterką S12, nie rzut', () => {
  const dane = parsujOdpowiedz(czytajFixture('las'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  const wynik = wybierzStacje({
    graf, kandydaci,
    srodek: { lat: 52.3124, lon: 21.0437 },
    konfig: { liczbaStacji: 8, promienM: 400 }, // ciasny pierścień, dużo stacji
    ziarno: 's12',
  });
  assert.ok(wynik.stacje.length >= 1 && wynik.stacje.length < 8, `częściowy wynik: ${wynik.stacje.length}`);
  assert.equal(wynik.usterki[0].kod, 'S12');
});

test('wybór: start daleko od sieci → S13; garbage → TypeError/S09/S12', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'piesza' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
  const konfig = { liczbaStacji: 5, promienM: 600 };
  assert.throws(
    () => wybierzStacje({ graf, kandydaci, srodek: { lat: 52.9, lon: 21.9 }, konfig, ziarno: 1 }),
    (e) => e.kod === 'S13',
  );
  assert.throws(() => wybierzStacje({ graf: { wezly: [] }, kandydaci, srodek: { lat: 52.23, lon: 21.01 }, konfig, ziarno: 1 }), (e) => e.kod === 'S09');
  assert.throws(() => wybierzStacje({ graf, kandydaci: [], srodek: { lat: 52.23, lon: 21.01 }, konfig, ziarno: 1 }), (e) => e.kod === 'S12');
  assert.throws(() => wybierzStacje({ graf, kandydaci, srodek: { lat: 52.23, lon: 21.01 }, konfig: { liczbaStacji: 0, promienM: 600 }, ziarno: 1 }), TypeError);
  assert.throws(() => wybierzStacje({ graf, kandydaci, srodek: { lat: 52.23, lon: 21.01 }, konfig: { liczbaStacji: 5, promienM: -1 }, ziarno: 1 }), TypeError);
  assert.throws(() => wybierzStacje({ graf, kandydaci, srodek: null, konfig, ziarno: 1 }), TypeError);
});

test('wybór samochodem: stacje to wyłącznie POI (parkingi i obiekty z dojazdem)', () => {
  const dane = parsujOdpowiedz(czytajFixture('centrum'));
  const graf = budujGraf(dane, { tryb: 'samochodowa' });
  const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'samochodowa' });
  const wynik = wybierzStacje({
    graf, kandydaci,
    srodek: { lat: 52.2297, lon: 21.0122 },
    konfig: { liczbaStacji: 3, promienM: 600 },
    ziarno: 'auto-1',
  });
  assert.ok(wynik.stacje.length >= 2);
  for (const s of wynik.stacje) {
    assert.equal(s.typKandydata, 'poi', 'samochód staje przy obiekcie, nie na jezdni');
    for (const budynek of dane.budynki) assert.equal(punktWPolygonie(s, budynek), false);
  }
});

test('miaraSprawiedliwosci: parametr pola — domyślne odlegloscM, sieciowe na żądanie', () => {
  const stacje = [
    { odlegloscM: 100, dystansSieciowyM: 400 },
    { odlegloscM: 200, dystansSieciowyM: 400 },
    { odlegloscM: 300, dystansSieciowyM: 800 },
  ];
  const prosta = miaraSprawiedliwosci(stacje);
  assert.equal(prosta.sredniaM, 200, 'domyślnie linia prosta (dotychczasowe testy bez zmian)');
  const sieciowa = miaraSprawiedliwosci(stacje, { pole: 'dystansSieciowyM' });
  assert.equal(sieciowa.sredniaM, 533, 'średnia z dystansów sieciowych');
  assert.equal(sieciowa.odchylenieM, 189, 'odchylenie liczone z pola sieciowego, nie z prostej');
  assert.notEqual(sieciowa.udzialOdchylenia, prosta.udzialOdchylenia, 'inna miara dla innego pola');
});

/* ================================= I7: cache sieci — czyste pomocniki */

import {
  SCHEMAT_SIECI,
  kluczCacheSieci,
  przycijCacheSieci,
  upraszczajDaneDoCache,
  wczytajDaneZCache,
} from '../app/sieci.js';

test('cache: klucz to geohash-6 + promień + tryb (ADR 0010 pkt 1)', () => {
  const klucz = kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'piesza' });
  assert.match(klucz, /^okolica:sieci:[0-9bcdefghjkmnpqrstuvwxyz]{6}-1000-piesza$/, 'geohash-6 (base32 bez a,i,l,o)');
  assert.equal(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000.4, tryb: 'piesza' }), klucz, 'promień zaokrąglony');
  assert.notEqual(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM: 1000, tryb: 'samochodowa' }), klucz, 'ten sam obszar innym trybem to OSOBNY wpis (inne klasy dróg)');
  assert.throws(() => kluczCacheSieci({ lat: 999, lon: 1, promienM: 100 }), (e) => e.kod === 'S05');
  assert.throws(() => kluczCacheSieci({ lat: 52, lon: 21, promienM: 0 }), (e) => e.kod === 'S06');
  assert.throws(() => kluczCacheSieci({ lat: 52, lon: 21, promienM: 100 }), (e) => e.kod === 'S07', 'tryb wymagany');
  assert.throws(() => kluczCacheSieci({ lat: 52, lon: 21, promienM: 100, tryb: 'kosmos' }), (e) => e.kod === 'S07');
});

test('cache: runda w obie strony — uproszczone dane dają IDENTYCZNY wybór stacji', () => {
  const dzien = 86_400_000;
  const teraz = Date.UTC(2026, 8, 5);
  const oryginal = parsujOdpowiedz(czytajFixture('centrum'));
  const uproszczone = upraszczajDaneDoCache(oryginal);
  const wpis = { schemat: SCHEMAT_SIECI, zapisanoMs: teraz - 5 * dzien, dane: uproszczone };
  const zCache = wczytajDaneZCache(wpis, { terazMs: teraz });
  assert.ok(zCache, 'świeży wpis (5 dni) przechodzi TTL 30 dni');

  const srodek = { lat: 52.2297, lon: 21.0122 };
  const konfig = { liczbaStacji: 5, promienM: 600 };
  const wybor = (dane) => {
    const graf = budujGraf(dane, { tryb: 'piesza' });
    const { kandydaci } = kandydaciNaStacje(dane, graf, { tryb: 'piesza' });
    return wybierzStacje({ graf, kandydaci, srodek, konfig, ziarno: 'cache-runda' });
  };
  assert.deepEqual(wybor(zCache).stacje, wybor(oryginal).stacje, 'cache nie zmienia wyniku wyboru');
});

test('cache: TTL 30 dni, przyszłość, schemat i puste drogi — wszystko jawne', () => {
  const dzien = 86_400_000;
  const teraz = Date.UTC(2026, 8, 5);
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(czytajFixture('las')));
  const wpis = (zapisanoMs, nadpisz = {}) => ({ schemat: SCHEMAT_SIECI, zapisanoMs, dane, ...nadpisz });
  assert.ok(wczytajDaneZCache(wpis(teraz - 29 * dzien), { terazMs: teraz }), '29 dni — świeży');
  assert.equal(wczytajDaneZCache(wpis(teraz - 31 * dzien), { terazMs: teraz }), null, '31 dni — po TTL');
  assert.equal(wczytajDaneZCache(wpis(teraz + 5 * dzien), { terazMs: teraz }), null, "wpis z przyszłości (przesunięty zegar) — podejrzany");
  assert.ok(wczytajDaneZCache(wpis(teraz + 0.5 * dzien), { terazMs: teraz }), 'przesunięty zegar do 1 dnia tolerowany');
  assert.equal(wczytajDaneZCache(wpis(teraz, { schemat: 'sieci/0' }), { terazMs: teraz }), null, 'nieznany schemat = null (UI pokaże komunikat, nie ciche odrzucenie)');
  assert.equal(wczytajDaneZCache(wpis(teraz, { dane: { ...dane, drogi: [] } }), { terazMs: teraz }), null, 'wpis bez dróg jest bezużyteczny');
  assert.equal(wczytajDaneZCache(null, { terazMs: teraz }), null);
  assert.equal(wczytajDaneZCache(wpis(NaN), { terazMs: teraz }), null);
});

test('cache: LRU — ponad 2 MB najstarsze wpisy wypadają', () => {
  const mb = 1024 * 1024;
  const wpisy = [
    { klucz: 'okolica:sieci:aaa-1000', rozmiarBajtow: 0.8 * mb, zapisanoMs: 100 },
    { klucz: 'okolica:sieci:bbb-1000', rozmiarBajtow: 0.7 * mb, zapisanoMs: 300 },
    { klucz: 'okolica:sieci:ccc-1000', rozmiarBajtow: 0.4 * mb, zapisanoMs: 200 },
  ];
  assert.deepEqual(przycijCacheSieci(wpisy), [], '1.9 MB mieści się w limicie 2 MB');
  wpisy.push({ klucz: 'okolica:sieci:ddd-1000', rozmiarBajtow: 0.9 * mb, zapisanoMs: 400 });
  // 2.8 MB > 2 MB: wypada najstarszy (aaa, zapisanoMs=100) → zostaje 2.0 MB
  assert.deepEqual(przycijCacheSieci(wpisy), ['okolica:sieci:aaa-1000']);
  wpisy.push({ klucz: 'okolica:sieci:eee-1000', rozmiarBajtow: 0.9 * mb, zapisanoMs: 500 });
  // 2.9 MB: aaa już nie ma — wypadają ccc (200), potem bbb (300), aż zostanie 1.8 MB
  assert.deepEqual(przycijCacheSieci(wpisy.filter((w) => w.klucz !== 'okolica:sieci:aaa-1000')),
    ['okolica:sieci:ccc-1000', 'okolica:sieci:bbb-1000']);
  assert.deepEqual(przycijCacheSieci([]), []);
});

/* ================================= M5/J5: geokodacja zapasowa (Nominatim) */

import {
  DOMYSLNY_ENDPOINT_GEOKODACJI,
  budujUrlGeokodacji,
  miejsceZOdpowiedziNominatim,
} from '../app/sieci.js';

test('geokodacja: URL niesie politykę ASSETS §3 (format, zoom, język, zaokrąglenie)', () => {
  const url = budujUrlGeokodacji({ lat: 52.229678, lon: 21.012345 });
  assert.ok(url.startsWith(`${DOMYSLNY_ENDPOINT_GEOKODACJI}?`));
  const params = new URL(url).searchParams;
  assert.equal(params.get('format'), 'jsonv2');
  assert.equal(params.get('lat'), '52.22968', 'współrzędna zaokrąglona do 5 miejsc (ADR 0013 pkt 3)');
  assert.equal(params.get('lon'), '21.01234'); // toFixed(5) z reprezentacji binarnej — policzone, nie zgadnięte
  assert.equal(params.get('zoom'), '14');
  assert.equal(params.get('accept-language'), 'pl');
  assert.equal(params.get('addressdetails'), '1');
  assert.ok(!url.includes('52.229678'), 'pełna precyzja pozycji nie opuszcza urządzenia');

  const wlasny = budujUrlGeokodacji({ lat: 52.23, lon: 21.01, endpoint: 'https://geokodownik.przykladowy/reverse' });
  assert.ok(wlasny.startsWith('https://geokodownik.przykladowy/reverse?'), 'endpoint przełączalny bez aktualizacji (polityka OSMF)');
  assert.throws(() => budujUrlGeokodacji({ lat: 999, lon: 0 }), (e) => e.kod === 'S05');
  assert.throws(() => budujUrlGeokodacji({ lat: 52, lon: 21, endpoint: 'http://bez-szyfrowania/' }), TypeError);
  assert.throws(() => budujUrlGeokodacji({ lat: 52, lon: 21, endpoint: 42 }), TypeError);
});

test('geokodacja: nazwa miejsca z jsonv2 — dzielnica i miasto, śmieci → null', () => {
  assert.equal(
    miejsceZOdpowiedziNominatim({ address: { suburb: 'Śródmieście', city: 'Warszawa', state: 'Mazowieckie', country: 'Polska' } }),
    'Śródmieście, Warszawa',
  );
  assert.equal(
    miejsceZOdpowiedziNominatim({ address: { city_district: 'Praga-Północ', town: 'Warszawa' } }),
    'Praga-Północ, Warszawa',
  );
  assert.equal(miejsceZOdpowiedziNominatim({ address: { village: 'Zalesie Górne' } }), 'Zalesie Górne', 'samo miasto/gmina też jest nazwą miejsca');
  assert.equal(miejsceZOdpowiedziNominatim({ address: { country: 'Polska' } }), null, 'sam kraj to za mało na „miejsce"');
  assert.equal(miejsceZOdpowiedziNominatim({ address: {} }), null);
  assert.equal(miejsceZOdpowiedziNominatim({}), null);
  assert.equal(miejsceZOdpowiedziNominatim(null), null);
  assert.equal(miejsceZOdpowiedziNominatim('nie-obiekt'), null);
});
