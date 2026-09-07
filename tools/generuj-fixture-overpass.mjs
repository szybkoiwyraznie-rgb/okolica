/**
 * generuj-fixture-overpass.mjs — deterministyczny generator fixture'ów Overpass
 * dla kamienia M4 (ADR 0005 pkt 2: testy na fixture'ach, bo sandbox nie ma
 * dostępu do Overpass).
 *
 * Format: odpowiedź Overpass API `[out:json]` po `out geom` — way'e niosą
 * `geometry[]` (bez osobnych szkiletów node), POI i bariery to node'y z
 * `lat`/`lon`, obszary administracyjne to elementy `area`. Fixture zawiera
 * WYŁĄCZNIE to, co realnie zwraca nasze zapytanie (ADR 0005 pkt 1): drogi,
 * POI, budynki (poligony wykluczeń), ograniczenia dostępu, bariery, obszary.
 *
 * Trzy scenariusze z ROADMAP M4:
 * - `overpass-centrum.json`     — gęsta siatka ulic, budynki w kwartałach,
 *                                 deptak, park, muzeum, prywatna alejka,
 *                                 `foot=no`, tunel, teren kolejowy, plac;
 * - `overpass-przedmiescie.json`— jedna główna ulica, ślepe zaułki, domy,
 *                                 prywatny dojazd, sklep, track polny;
 * - `overpass-las.json`         — drogi leśne i ścieżki, szczyt, drzewa,
 *                                 parking leśny, ZERO budynków.
 *
 * Użycie: `node tools/generuj-fixture-overpass.mjs` (albo `npm run fixture`).
 * Testy (`test/sieci.test.js`) sprawdzają, że pliki w repo są dokładnie tym,
 * co zwraca `generujFixtures()` — jak `synchronizuj-szablon --check`.
 *
 * Czysty moduł: bez sieci, bez DOM, bez `Math.random()` (mulberry32 z ziarnem).
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ rng */

/** Mulberry32 — ten sam algorytm co `konfig.rngZZiarna`, ale bez importu
 * z `app/` (narzędzie jest samowystarczalne, jak `synchronizuj-szablon`). */
function rngZZiarna(ziarno) {
  let a = 0;
  for (let i = 0; i < ziarno.length; i++) {
    a = Math.imul(a ^ ziarno.charCodeAt(i), 2654435761);
    a = (a << 13) | (a >>> 19);
  }
  a >>>= 0;
  return function losuj() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- geometria */

const M_NA_STOPIEN_LAT = 111320;

/** Przesunięcie o metry w osiach (dx na wschód, dy na północ) → {lat, lon}. */
function odsun(punkt, dxM, dyM) {
  const lat = punkt.lat + dyM / M_NA_STOPIEN_LAT;
  const lon = punkt.lon + dxM / (M_NA_STOPIEN_LAT * Math.cos((punkt.lat * Math.PI) / 180) || 1);
  return { lat, lon };
}

/** Overpass zwraca pełną precyzję; fixture tniemy do 6 miejsc (~0,11 m) —
 * mniejszy plik bez straty sensu. */
function okraglij(p) {
  return { lat: Number(p.lat.toFixed(6)), lon: Number(p.lon.toFixed(6)) };
}

/** Łańcuch punktów z deterministycznym rozrzutem ±`szumM` (naturalny wygląd). */
function lamana(punkty, losuj, szumM = 3) {
  return punkty.map((p, i) => {
    if (i === 0 || i === punkty.length - 1) return okraglij(p); // końce stabilne
    return okraglij(odsun(p, (losuj() - 0.5) * 2 * szumM, (losuj() - 0.5) * 2 * szumM));
  });
}

/** Zamknięty prostokąt (poligon budynku/parku/terenu) z narożnika i wymiarów. */
function prostokat(naroznik, szerokoscM, wysokoscM) {
  const a = naroznik;
  const b = odsun(a, szerokoscM, 0);
  const c = odsun(b, 0, wysokoscM);
  const d = odsun(a, 0, wysokoscM);
  return [a, b, c, d, { lat: a.lat, lon: a.lon }].map(okraglij); // zamknięty
}

/* ------------------------------------------------------- liczniki id */

function liczniki(bazaWay, bazaNode) {
  let way = bazaWay;
  let node = bazaNode;
  return {
    way: () => ++way,
    node: () => ++node,
  };
}

const NAGLOWEK = (scenariusz) => ({
  version: 0.6,
  generator: `Overpass API 0.7.62 — FIXTURE SYNTETYCZNY wygenerowany przez tools/generuj-fixture-overpass.mjs (scenariusz: ${scenariusz}); dane wymyślone, nie pochodzą z OpenStreetMap`,
  osm3s: {
    timestamp_osm_base: '2026-09-05T00:00:00Z',
    copyright: 'Fixture syntetyczny — brak danych OSM. Format zgodny z odpowiedzią Overpass API (out geom).',
  },
  elements: [],
});

function dodajWay(fixture, id, geometry, tags) {
  fixture.elements.push({ type: 'way', id, geometry: geometry.map(okraglij), tags });
}

function dodajNode(fixture, id, p, tags) {
  fixture.elements.push({ type: 'node', id, lat: okraglij(p).lat, lon: okraglij(p).lon, tags });
}

function dodajObszary(fixture, idBaza, para) {
  // para: [{ admin_level, name }] — od grubego do drobnego
  para.forEach((o, i) => {
    fixture.elements.push({
      type: 'area',
      id: idBaza + i,
      tags: { boundary: 'administrative', admin_level: o.admin_level, name: o.name, wikidata: `Q${1000 + i}` },
    });
  });
}

/* --------------------------------------------------------- scenariusz 1 */

/** Centrum: siatka 9×9 ulic co 75 m (rozpiętość ~600 m), budynki w kwartałach. */
function generujCentrum() {
  const fixture = NAGLOWEK('centrum');
  const losuj = rngZZiarna('okolica-fixture-centrum-v1');
  const id = liczniki(1000, 200000);
  const SRODEK = { lat: 52.2297, lon: 21.0122 };
  const N = 9; // wierzchołków w rzędzie/kolumnie
  const KROK_M = 75;

  // współdzielone wierzchołki siatki (way'e MUSZĄ mieć identyczne końce)
  const siatka = [];
  for (let i = 0; i < N; i++) {
    const rzad = [];
    for (let j = 0; j < N; j++) {
      const dx = (j - (N - 1) / 2) * KROK_M;
      const dy = (i - (N - 1) / 2) * KROK_M;
      const szum = i === 0 || i === N - 1 || j === 0 || j === N - 1 ? 0 : 3;
      rzad.push(okraglij(odsun(SRODEK, dx + (losuj() - 0.5) * 2 * szum, dy + (losuj() - 0.5) * 2 * szum)));
    }
    siatka.push(rzad);
  }

  // ulice poziome: co trzecia tertiary, górna w tunelu, dolna foot=no
  for (let i = 0; i < N; i++) {
    const tags = { highway: i % 3 === 1 ? 'tertiary' : 'residential', name: `Ulica Poprzeczna ${i + 1}`, lit: i % 2 };
    if (i === 0) { tags.tunnel = 'yes'; tags.name = 'Przejazd Tunelowy'; }
    if (i === N - 1) { tags.highway = 'primary'; tags.foot = 'no'; tags.name = 'Aleja Główna'; }
    dodajWay(fixture, id.way(), siatka[i], tags);
  }
  // ulice pionowe: środkowa to deptak
  for (let j = 0; j < N; j++) {
    const geometria = siatka.map((rzad) => rzad[j]);
    const tags = j === (N - 1) / 2
      ? { highway: 'pedestrian', name: 'Deptak Śródmiejski' }
      : { highway: 'residential', name: `Ulica Podłużna ${j + 1}` };
    dodajWay(fixture, id.way(), geometria, tags);
  }

  // łączniki piesze: footway po przekątnej kwartału, schody, przejście przez kwartał
  dodajWay(fixture, id.way(), [siatka[1][1], siatka[2][2]], { highway: 'footway', name: 'Przekątna Piesza' });
  dodajWay(fixture, id.way(), [siatka[5][6], siatka[6][7]], { highway: 'steps', name: 'Schodki do Parku' });
  dodajWay(fixture, id.way(), [siatka[3][5], siatka[3][6]], { highway: 'footway' });
  dodajWay(fixture, id.way(), [siatka[6][2], siatka[7][2], siatka[7][3]], { highway: 'path' });
  // alejka serwisowa z ruchem rowerowym
  dodajWay(fixture, id.way(), [siatka[2][7], siatka[4][7]], { highway: 'service', name: 'Alejka Serwisowa' });
  // droga rowerowa wzdłuż wschodniej krawędzi
  dodajWay(fixture, id.way(), [siatka[1][8], siatka[4][8], siatka[7][8]], { highway: 'cycleway', name: 'Droga Rowerowa Wschodnia' });

  // PRYWATNA alejka — ślepy dojazd na wschód od skrajnej drogi rowerowej,
  // daleko od węzłów siatki (nie dubluje publicznej ulicy!); kandydaci nie
  // mają prawa na nią trafić, choć wlot z publicznej ścieżki zostaje
  dodajWay(fixture, id.way(), [siatka[4][8], okraglij(odsun(siatka[4][8], 60, 10))], {
    highway: 'service', access: 'private', name: 'Dojazd Prywatny',
  });

  // budynki w ~60% kwartałów (poligony wykluczeń)
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      if (losuj() < 0.4) continue;
      if (i === 6 && j === 5) continue; // kwartał parku
      if (i === 5 && j === 2) continue; // kwartał muzeum
      const narożnik = odsun(siatka[i][j], 18, 18);
      dodajWay(fixture, id.way(), prostokat(narożnik, 24, 14), {
        building: losuj() < 0.5 ? 'apartments' : 'yes',
        'building:levels': String(2 + Math.floor(losuj() * 4)),
      });
      if (losuj() < 0.3) {
        dodajWay(fixture, id.way(), prostokat(odsun(siatka[i][j], 18, 42), 20, 12), { building: 'yes' });
      }
    }
  }
  // muzeum: budynek (wykluczenie) JEDNOCZEŚNIE POI — stacja ma stanąć PRZED nim
  dodajWay(fixture, id.way(), prostokat(odsun(siatka[5][2], 15, 15), 38, 24), {
    building: 'yes', tourism: 'museum', name: 'Muzeum Okolicy',
  });
  // park (kandydat obszarowy, nie wykluczenie)
  dodajWay(fixture, id.way(), prostokat(odsun(siatka[6][5], 12, 12), 48, 40), {
    leisure: 'park', name: 'Park Kieszonkowy',
  });
  // teren kolejowy przy północnej krawędzi — strefa wykluczeń
  dodajWay(fixture, id.way(), prostokatKolejowy(siatka), { landuse: 'railway', name: 'Tory Techniczne' });

  // place, POI i bariery jako node'y
  dodajNode(fixture, id.node(), siatka[4][4], { place: 'square', name: 'Plac Centralny' });
  dodajNode(fixture, id.node(), odsun(siatka[3][3], 10, -10), { amenity: 'cafe', name: 'Kawa za Rogiem', cuisine: 'coffee_shop' });
  dodajNode(fixture, id.node(), odsun(siatka[6][3], -12, 10), { amenity: 'parking', name: 'Parking Podziemny', parking: 'underground' });
  dodajNode(fixture, id.node(), siatka[4][1], { highway: 'bus_stop', name: 'Przystanek Poprzeczna', public_transport: 'platform' });
  dodajNode(fixture, id.node(), odsun(siatka[2][6], 8, 8), { tourism: 'information', information: 'map' });
  dodajNode(fixture, id.node(), odsun(siatka[7][5], -6, 0), { historic: 'monument', name: 'Kamień Pamiątkowy' });
  dodajNode(fixture, id.node(), odsun(siatka[1][1], 12, 12), { barrier: 'gate' });
  dodajNode(fixture, id.node(), odsun(siatka[5][5], -5, 5), { amenity: 'restaurant', name: 'Restauracja Ratuszowa' });

  dodajObszary(fixture, 3600010000, [
    { admin_level: '4', name: 'województwo mazowieckie' },
    { admin_level: '6', name: 'Warszawa' },
    { admin_level: '9', name: 'Śródmieście' },
  ]);
  return fixture;
}

/** Pas terenu kolejowego nad górną krawędzią siatki. */
function prostokatKolejowy(siatka) {
  const gora = siatka[0];
  const a = odsun(gora[0], 0, 25);
  const b = odsun(gora[gora.length - 1], 0, 25);
  const c = odsun(b, 0, 60);
  const d = odsun(a, 0, 60);
  return [a, b, c, d, { lat: a.lat, lon: a.lon }].map(okraglij);
}

/* --------------------------------------------------------- scenariusz 2 */

/** Przedmieście: główna ulica N–S (~1400 m), ślepe zaułki, domy, prywatny dojazd. */
function generujPrzedmiescie() {
  const fixture = NAGLOWEK('przedmieście');
  const losuj = rngZZiarna('okolica-fixture-przedmiescie-v1');
  const id = liczniki(5000, 500000);
  const SRODEK = { lat: 52.1893, lon: 21.1635 };

  // główna ulica: 15 wierzchołków co 100 m z rozrzutem
  const glowna = [];
  for (let k = -7; k <= 7; k++) {
    glowna.push(okraglij(odsun(SRODEK, (losuj() - 0.5) * 6, k * 100)));
  }
  dodajWay(fixture, id.way(), glowna, { highway: 'residential', name: 'Ulica Główna', lit: 'yes', maxspeed: '30' });

  // zaułki: pięć na wschód (w tym długa prostopadła — kąt ~90°), trzy na
  // zachód (w tym długa na dy=0 — kąt ~270°). Bez nich przedmieście jest
  // geometrycznie LINIOWE (kąty 0/180) i separacja kątowa ADR 0005 pkt 5
  // nie miałaby z czego wybierać — tak wygląda prawdziwe skrzyżowanie osi.
  const zaułkiWschod = [-450, -150, 0, 150, 450];
  const zaułkiZachod = [-300, 0, 300];
  const indeksGlowej = (dy) => Math.round(dy / 100) + 7;
  zaułkiWschod.forEach((dy, n) => {
    const start = glowna[indeksGlowej(dy)];
    const dlugosc = dy === 0 ? 600 : 200 + Math.round(losuj() * 50);
    const z = lamana([start, odsun(start, dlugosc * 0.7, 15), odsun(start, dlugosc, 40 - n * 20)], losuj, 2);
    dodajWay(fixture, id.way(), z, { highway: 'residential', name: dy === 0 ? 'Ulica Wschodnia' : `Ulica Ślepa ${n + 1}` });
    // domy przy zaułku: dwa-trzy małe budynki po północnej stronie
    for (let h = 0; h < 2 + (n % 2); h++) {
      const przy = odsun(start, 40 + h * 70, 18);
      dodajWay(fixture, id.way(), prostokat(przy, 11, 9), { building: 'house', 'building:levels': '1' });
    }
  });
  zaułkiZachod.forEach((dy, n) => {
    const start = glowna[indeksGlowej(dy)];
    const z = dy === 0
      ? lamana([start, odsun(start, -300, 10), odsun(start, -600, -10)], losuj, 2)
      : lamana([start, odsun(start, -140, -10), odsun(start, -190, 10)], losuj, 2);
    dodajWay(fixture, id.way(), z, { highway: 'residential', name: dy === 0 ? 'Ulica Zachodnia' : `Ulica Zachodnia ${n + 1}` });
    dodajWay(fixture, id.way(), prostokat(odsun(start, -60, 16), 10, 8), { building: 'house' });
    if (n === 1) dodajWay(fixture, id.way(), prostokat(odsun(start, -320, -34), 12, 9), { building: 'garage' });
  });

  // droga polna (track) na północny wschód
  const trackStart = glowna[indeksGlowej(500)];
  dodajWay(fixture, id.way(), lamana([
    trackStart,
    odsun(trackStart, 180, 120),
    odsun(trackStart, 320, 260),
    odsun(trackStart, 300, 420),
  ], losuj, 8), { highway: 'track', name: 'Droga Polna', surface: 'unpaved', tracktype: 'grade3' });

  // PRYWATNY dojazd do posesji — długi, kusi odległością, musi być wykluczony
  const prywatnyStart = glowna[indeksGlowej(-600)];
  dodajWay(fixture, id.way(), lamana([
    prywatnyStart,
    odsun(prywatnyStart, -150, 20),
    odsun(prywatnyStart, -300, 0),
  ], losuj, 2), { highway: 'service', access: 'private', service: 'driveway', name: 'Dojazd do Posesji' });

  // POI
  dodajNode(fixture, id.node(), odsun(glowna[indeksGlowej(-150)], 25, -20), {
    shop: 'convenience', name: 'Sklep u Kowalskich', opening_hours: 'Mo-Sa 06:00-20:00',
  });
  dodajNode(fixture, id.node(), odsun(glowna[indeksGlowej(-150)], 35, -35), { amenity: 'parking', parking: 'surface' });
  dodajNode(fixture, id.node(), odsun(glowna[indeksGlowej(300)], 6, 0), {
    highway: 'bus_stop', name: 'Przystanek Główna-Szkoła', public_transport: 'platform',
  });
  dodajNode(fixture, id.node(), odsun(glowna[indeksGlowej(150)], -20, 15), {
    amenity: 'school', name: 'Szkoła Podstawowa nr 42',
  });
  dodajWay(fixture, id.way(), prostokat(odsun(glowna[indeksGlowej(150)], -70, 40), 45, 30), {
    building: 'school', amenity: 'school', name: 'Szkoła Podstawowa nr 42',
  });
  dodajNode(fixture, id.node(), odsun(trackStart, 30, 15), { barrier: 'bollard' });
  dodajNode(fixture, id.node(), odsun(glowna[indeksGlowej(-450)], 10, -12), { natural: 'tree', leaf_type: 'broadleaved' });

  dodajObszary(fixture, 3600050000, [
    { admin_level: '4', name: 'województwo mazowieckie' },
    { admin_level: '8', name: 'Warszawa' },
    { admin_level: '9', name: 'Wawer' },
  ]);
  return fixture;
}

/* --------------------------------------------------------- scenariusz 3 */

/** Las: drogi leśne (track), ścieżki (path), szczyt, drzewa, parking — zero budynków. */
function generujLas() {
  const fixture = NAGLOWEK('las');
  const losuj = rngZZiarna('okolica-fixture-las-v1');
  const id = liczniki(9000, 900000);
  const SRODEK = { lat: 52.3124, lon: 21.0437 };

  // główna droga leśna E–W (~2000 m)
  const główna = [];
  for (let k = -10; k <= 10; k++) {
    główna.push(okraglij(odsun(SRODEK, k * 100, (losuj() - 0.5) * 14)));
  }
  dodajWay(fixture, id.way(), główna, { highway: 'track', name: 'Droga Leśna Główna', surface: 'ground', tracktype: 'grade2' });

  // przecznica N–S — skrzyżowanie z główną przez WSPÓŁDZIELONY wierzchołek
  // (główna[12] = x≈200); prawdziwy OSM tak właśnie łączy way'e na węzłach,
  // a graf budujGraf spina po identycznych współrzędnych
  const skrzyzowanie = główna[12];
  const przecznica = [];
  for (let k = -8; k <= 6; k++) {
    przecznica.push(k === 0 ? skrzyzowanie : okraglij(odsun(skrzyzowanie, (losuj() - 0.5) * 10, k * 100)));
  }
  dodajWay(fixture, id.way(), przecznica, { highway: 'track', name: 'Przecinka Północna', tracktype: 'grade3' });

  // ścieżka przyrodnicza: pętla wokół osi 240 m na północ od główna[6]
  // (x≈-400), domknięta DOKŁADNIE w główna[6] — pętla ma połączenie z siecią
  const osPętli = odsun(główna[6], 0, 240);
  const petla = [];
  for (let k = 0; k <= 8; k++) {
    if (k === 0 || k === 8) { petla.push(główna[6]); continue; } // wspólny wierzchołek
    const kat = -Math.PI / 2 + (k / 8) * 2 * Math.PI;
    petla.push(okraglij(odsun(osPętli, Math.cos(kat) * 300 + (losuj() - 0.5) * 20, Math.sin(kat) * 240 + (losuj() - 0.5) * 20)));
  }
  dodajWay(fixture, id.way(), petla, { highway: 'path', name: 'Ścieżka Przyrodnicza', sac_scale: 'hiking' });

  // łącznik od głównej (współdzielony wierzchołek główna[10] = x≈0) na NE
  dodajWay(fixture, id.way(), lamana([
    główna[10],
    odsun(główna[10], 100, 150),
    odsun(główna[10], 200, 300),
  ], losuj, 5), { highway: 'footway', name: 'Łącznik Mokradłowy' });

  // drugi łącznik: od zachodniego krańca głównej (główna[0]) ku pętli
  dodajWay(fixture, id.way(), lamana([
    główna[0],
    odsun(główna[0], 150, 90),
    odsun(główna[0], 300, 190),
  ], losuj, 6), { highway: 'path' });

  // POI leśne — zero budynków, tylko natura i infrastruktura lekka
  dodajNode(fixture, id.node(), odsun(SRODEK, -500, 420), { natural: 'peak', name: 'Wydma Zachodnia', ele: '126' });
  dodajNode(fixture, id.node(), odsun(SRODEK, 300, -220), { natural: 'tree', name: 'Dąb Bartek', leaf_type: 'broadleaved' });
  dodajNode(fixture, id.node(), odsun(SRODEK, -120, -60), { natural: 'tree', leaf_type: 'needleleaved' });
  dodajNode(fixture, id.node(), odsun(SRODEK, 60, 25), { amenity: 'parking', name: 'Parking Leśny', parking: 'surface', fee: 'no' });
  dodajNode(fixture, id.node(), odsun(SRODEK, -240, 60), { leisure: 'picnic_site', name: 'Polana Piknikowa' });
  dodajNode(fixture, id.node(), odsun(SRODEK, 620, 10), { barrier: 'gate', access: 'yes' });
  dodajNode(fixture, id.node(), odsun(SRODEK, -400, 200), { tourism: 'viewpoint', name: 'Punkt Widokowy na Wydmę' });
  dodajNode(fixture, id.node(), odsun(SRODEK, 200, -800), { historic: 'wayside_shrine', name: 'Kapliczka Leśna' });

  // kontekst obszarowy: las (nie jest wykluczeniem — to POJAWIA się w danych,
  // ale kandydatów i tak szukamy na way'ach)
  dodajWay(fixture, id.way(), prostokat(odsun(SRODEK, -1100, -900), 2300, 1900), {
    landuse: 'forest', name: 'Las Okoliczny', leaf_type: 'mixed',
  });

  dodajObszary(fixture, 3600090000, [
    { admin_level: '4', name: 'województwo mazowieckie' },
    { admin_level: '8', name: 'Warszawa' },
    { admin_level: '9', name: 'Bielany' },
  ]);
  return fixture;
}

/* ---------------------------------------------------------------- eksport */

/** Zwraca trzy fixture'y jako obiekty JSON — testy porównują je z plikami. */
export function generujFixtures() {
  return {
    centrum: generujCentrum(),
    przedmiescie: generujPrzedmiescie(),
    las: generujLas(),
  };
}

/** Zapisuje fixture'y do `test/fixtures/` (LF, 2 spacje, bez BOM). */
export function zapiszFixtures(katalogDocelowy) {
  const fixtures = generujFixtures();
  const sciezki = {};
  for (const [nazwa, dane] of Object.entries(fixtures)) {
    const sciezka = join(katalogDocelowy, `overpass-${nazwa}.json`);
    writeFileSync(sciezka, `${JSON.stringify(dane, null, 2)}\n`, 'utf8');
    sciezki[nazwa] = sciezka;
  }
  return sciezki;
}

const czyUruchomiony = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (czyUruchomiony) {
  const katalog = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
  const sciezki = zapiszFixtures(katalog);
  for (const [nazwa, sciezka] of Object.entries(sciezki)) {
    const rozmiar = JSON.stringify(generujFixtures()[nazwa]).length;
    console.log(`OK: ${sciezka} (${rozmiar} znaków JSON)`);
  }
}
