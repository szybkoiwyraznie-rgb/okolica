/**
 * test/mapa.test.js — mapa: matematyka widoku, kafelki i warstwa DOM.
 *
 * Część czysta działa bez DOM i bez sieci (w sandboxie kafelków i tak nie
 * pobierzemy — LESSONS L3), a część DOM używa atrapy z `helpers/dom.js`:
 * elementy są tworzone na żądanie, więc test mówi, jakie identyfikatory ma
 * mieć szkielet w `index.html` (spójność pilnuje `test/kontrakt.test.js`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  KROKI_SKALI_M,
  MARGINES_KAFELKOW,
  MAX_KAFELEK,
  PODDOMENY,
  PRZESTRZEN_SVG,
  KLUCZ_URL_KAFELKOW,
  SZABLONY_KAFELKOW,
  biezacySzablonKafelkow,
  ustawSzablonKafelkow,
  walidujSzablonKafelkow,
  ZOOM_MIN,
  etykietaWidoku,
  maxZoomPodkladu,
  metryNaJednostkeSwiata,
  planKafelkow,
  planMapy,
  promienWpikselach,
  promienWSwiecie,
  punktNaEkranie,
  przesunWidok,
  rozmiarPanelu,
  skalaBar,
  skalaZZoomu,
  srodekWidoku,
  ustalibujWidok,
  utworzMape,
  urlKafelka,
  widokNaSrodek,
  zmienSkale,
  zoomWidoku,
} from '../app/mapa.js';
import { PODKLADY } from '../app/konfig.js';
import { metryNaPiksel, punktyNaOkregu, wspolrzedneDoKafelka } from '../app/geo.js';
import { zainstalujDom } from './helpers/dom.js';

const WARSZAWA = { lat: 52.2297, lon: 21.0122 };
const PANEL = { szerokosc: 360, wysokosc: 320 };

/** Widok testowy o środku w Warszawie. */
function widok(zoom = 17, rozmiar = PANEL) {
  return widokNaSrodek({ ...WARSZAWA, zoom, rozmiar });
}

/** Stacje w pierścieniu (jak z `stacje.pierscienStacji`). */
function stacje(ile = 5, promienM = 300) {
  return punktyNaOkregu(WARSZAWA, promienM, ile).map((p, i) => ({
    id: `stacja-${i + 1}`,
    lat: p.lat,
    lon: p.lon,
    dystansM: Math.round(promienM),
  }));
}

/* ------------------------------------------------------------------ *
 * Widok: zoom ↔ skala, środek ↔ przesunięcie
 * ------------------------------------------------------------------ */

test('skalaZZoomu i zoomWidoku są odwrotnościami', () => {
  for (const z of [1, 5, 12, 17, 19]) {
    assert.ok(Math.abs(zoomWidoku({ x: 0, y: 0, skala: skalaZZoomu(z) }) - z) < 1e-9);
  }
  assert.ok(skalaZZoomu(1) > skalaZZoomu(0));
  assert.ok(skalaZZoomu(17) > skalaZZoomu(16));
});

test('skalaZZoomu odmawia przy nie-liczbie (NaN nie może wejść do widoku)', () => {
  assert.throws(() => skalaZZoomu(NaN), TypeError);
  assert.throws(() => skalaZZoomu('17'), TypeError);
  assert.throws(() => zoomWidoku({ x: 0, y: 0, skala: 0 }), TypeError);
  assert.throws(() => zoomWidoku(null), TypeError);
});

test('środek widoku wraca do punktu wyjścia (round-trip)', () => {
  const w = widok(17);
  const s = srodekWidoku(w, PANEL);
  assert.ok(Math.abs(s.lat - WARSZAWA.lat) < 1e-6);
  assert.ok(Math.abs(s.lon - WARSZAWA.lon) < 1e-6);
});

test('środek widoku ląduje dokładnie w środku panelu', () => {
  const w = widok(16);
  const ekran = punktNaEkranie(WARSZAWA.lat, WARSZAWA.lon, w);
  assert.equal(ekran.x, PANEL.szerokosc / 2);
  assert.equal(ekran.y, PANEL.wysokosc / 2);
});

test('ustalibujWidok: clamp zoomu zachowuje środek geograficzny, nie przesunięcie pikselowe', () => {
  for (const rozmiar of [PANEL, { szerokosc: 740, wysokosc: 360 }]) {
    for (const podklad of Object.keys(PODKLADY)) {
      for (const zoom of [0.5, 17, 25]) {
        const przed = widokNaSrodek({ ...WARSZAWA, zoom, rozmiar });
        const po = ustalibujWidok(przed, podklad, rozmiar);
        const srodek = srodekWidoku(po, rozmiar);
        assert.ok(Math.abs(srodek.lat - WARSZAWA.lat) < 1e-8, 'szerokość geograficzna bez zmian');
        assert.ok(Math.abs(srodek.lon - WARSZAWA.lon) < 1e-8, 'długość geograficzna bez zmian');
        const oczekiwanyZoom = Math.max(ZOOM_MIN, Math.min(zoom, maxZoomPodkladu(podklad)));
        assert.ok(Math.abs(zoomWidoku(po) - oczekiwanyZoom) < 1e-9);
        if (zoom === oczekiwanyZoom) assert.equal(po, przed, 'w zakresie ten sam obiekt');
      }
    }
  }
  const po = ustalibujWidok({ x: 42, y: 7, skala: Infinity }, 'osm', PANEL);
  assert.ok(Number.isFinite(po.x) && Number.isFinite(po.y) && Number.isFinite(po.skala));
  assert.ok(Math.abs(zoomWidoku(po) - maxZoomPodkladu('osm')) < 1e-9);
});

test('punkt na wschód od środka jest na prawo, na północ — wyżej', () => {
  const w = widok(16);
  const srodek = punktNaEkranie(WARSZAWA.lat, WARSZAWA.lon, w);
  const wschod = punktNaEkranie(WARSZAWA.lat, WARSZAWA.lon + 0.01, w);
  const polnoc = punktNaEkranie(WARSZAWA.lat + 0.01, WARSZAWA.lon, w);
  assert.ok(wschod.x > srodek.x);
  assert.equal(wschod.y, srodek.y);
  assert.ok(polnoc.y < srodek.y);
  assert.equal(polnoc.x, srodek.x);
});

test('przesunWidok przesuwa obraz o podaną liczbę pikseli', () => {
  const w = widok(17);
  const po = przesunWidok(w, 40, -25);
  assert.equal(po.skala, w.skala);
  assert.equal(po.x, w.x + 40);
  assert.equal(po.y, w.y - 25);
  // treść mapy jedzie z palcem: w prawo i w górę → widać kawałek na zachód
  // i na południe (oś y w Web Mercatorze rośnie na południe)
  const przed = srodekWidoku(w, PANEL);
  const poTemu = srodekWidoku(po, PANEL);
  assert.ok(poTemu.lon < przed.lon);
  assert.ok(poTemu.lat < przed.lat);
  assert.throws(() => przesunWidok(w, NaN, 0), TypeError);
});

test('zmienSkale zmienia zoom i trzyma punkt zaczepienia w miejscu', () => {
  const w = widok(16);
  const zaczep = { x: 90, y: 70 };
  const swiatPrzed = {
    x: (zaczep.x - w.x) / w.skala,
    y: (zaczep.y - w.y) / w.skala,
  };
  const po = zmienSkale(w, 2, { punkt: zaczep });
  assert.ok(Math.abs(zoomWidoku(po) - (zoomWidoku(w) + 1)) < 1e-9);
  const swiatPo = {
    x: (zaczep.x - po.x) / po.skala,
    y: (zaczep.y - po.y) / po.skala,
  };
  assert.ok(Math.abs(swiatPo.x - swiatPrzed.x) < 1e-6);
  assert.ok(Math.abs(swiatPo.y - swiatPrzed.y) < 1e-6);
});

test('zmienSkale nie wychodzi poza widełki zoomu (podkład nie dostaje żądania nieistniejących kafelków)', () => {
  const w = widok(19);
  assert.ok(zoomWidoku(zmienSkale(w, 8, { maxZoom: 19 })) <= 19 + 1e-9);
  const daleki = widok(3);
  assert.ok(zoomWidoku(zmienSkale(daleki, 0.001, { minZoom: ZOOM_MIN })) >= ZOOM_MIN - 1e-9);
  assert.ok(zoomWidoku(zmienSkale(w, 2, { maxZoom: 17 })) <= 17 + 1e-9);
  assert.throws(() => zmienSkale(w, 0), TypeError);
  assert.throws(() => zmienSkale(w, -1), TypeError);
});

test('widokNaSrodek odmawia przy śmieciach (spójne z hartowaniem z M1)', () => {
  assert.throws(() => widokNaSrodek({ lat: NaN, lon: 21, zoom: 16, rozmiar: PANEL }), TypeError);
  assert.throws(() => widokNaSrodek({ ...WARSZAWA, zoom: '16', rozmiar: PANEL }), TypeError);
  assert.throws(() => widokNaSrodek({ ...WARSZAWA, zoom: 16, rozmiar: { szerokosc: -1, wysokosc: 3 } }), TypeError);
  assert.throws(() => widokNaSrodek({ ...WARSZAWA, zoom: 16, rozmiar: null }), TypeError);
});

/* ------------------------------------------------------------------ *
 * Kafelki: adresy i siatka
 * ------------------------------------------------------------------ */

test('urlKafelka podstawia z/x/y po nazwach — OSM Standard dokładnie jak w ASSETS §1', () => {
  assert.equal(urlKafelka('osm', 17, 73184, 43157), 'https://tile.openstreetmap.org/17/73184/43157.png');
  assert.equal(SZABLONY_KAFELKOW.osm, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});

test('urlKafelka dla Esri zamienia kolejność na {z}/{y}/{x} (pułapka z ASSETS §1)', () => {
  assert.equal(
    urlKafelka('esri-satelita', 17, 3, 5),
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/5/3',
  );
  assert.notEqual(urlKafelka('esri-satelita', 17, 3, 5), urlKafelka('esri-satelita', 17, 5, 3));
});

test('rotacja poddomen OpenTopoMap jest deterministyczna: (x + y) % 3', () => {
  assert.equal(urlKafelka('opentopo', 3, 4, 5), 'https://a.tile.opentopomap.org/3/4/5.png');
  assert.equal(urlKafelka('opentopo', 3, 5, 5), 'https://b.tile.opentopomap.org/3/5/5.png');
  assert.equal(urlKafelka('opentopo', 3, 4, 5), urlKafelka('opentopo', 3, 4, 5));
  assert.deepEqual(PODDOMENY, ['a', 'b', 'c']);
  for (const x of [0, 1, 2, 7]) {
    const url = urlKafelka('opentopo', 5, x, 3);
    assert.ok(PODDOMENY.includes(url.split('//')[1][0]));
  }
});

test('podkład wyłączony („brak") nie daje żadnego URL-a', () => {
  assert.equal(urlKafelka('brak', 5, 1, 1), null);
  assert.equal(SZABLONY_KAFELKOW.brak, null);
});

test('urlKafelka odmawia przy nieznanym podkładzie i przy niecałkowitych indeksach', () => {
  assert.throws(() => urlKafelka('carto-voyager', 5, 1, 1), TypeError);
  assert.throws(() => urlKafelka('osm', 5.5, 1, 1), TypeError);
  assert.throws(() => urlKafelka('osm', 5, -1, 1), TypeError);
});

test('każdy szablon kafelków pokrywa się z podkładami z konfigu (bez sierot)', () => {
  assert.deepEqual(Object.keys(SZABLONY_KAFELKOW).sort(), Object.keys(PODKLADY).sort());
});

test('maxZoomPodkladu bierze się z PODKLADY i ogranicza siatkę', () => {
  assert.equal(maxZoomPodkladu('osm'), 19);
  assert.equal(maxZoomPodkladu('opentopo'), 17);
  assert.throws(() => maxZoomPodkladu('google'), TypeError);
  const plan = planKafelkow(widok(19), PANEL, 'opentopo');
  assert.ok(plan.z <= 17);
});

test('planKafelkow pokrywa widoczny zakres z marginesem i trzyma się limitu polityki OSM', () => {
  const plan = planKafelkow(widok(17), PANEL, 'osm');
  const n = 2 ** plan.z;
  const oczekiwanyRozmiar = 3600 / n;
  assert.equal(plan.rozmiarKafelkaSwiat, oczekiwanyRozmiar);
  assert.ok(plan.kafelki.length > 0);
  assert.ok(plan.kafelki.length <= MAX_KAFELEK);
  assert.equal(plan.przyciete, false);
  for (const k of plan.kafelki) {
    assert.equal(k.x, k.tx * oczekiwanyRozmiar);
    assert.equal(k.y, k.ty * oczekiwanyRozmiar);
    assert.equal(k.rozmiar, oczekiwanyRozmiar);
    assert.ok(k.url.startsWith('https://tile.openstreetmap.org/'));
  }
  // margines: kafelki wystają poza panel, żeby drag nie odsłaniał pustki
  const widoczneX = plan.kafelki.filter((k) => k.x * plan.rozmiarKafelkaSwiat !== undefined);
  assert.ok(widoczneX.length >= 4);
  assert.ok(MARGINES_KAFELKOW >= 1);
});

test('planKafelkow przycina przy ogromnym panelu i małym zoomie (ochrona przed hurtowym pobieraniem)', () => {
  // Zoom 6 (nie 3): przy z3 cały świat to 64 kafelki, więc plan nie miałby jak
  // przekroczyć sufitu i test sprawdzałby wyłącznie rozmiar świata.
  const panel = { szerokosc: 6000, wysokosc: 6000 };
  const plan = planKafelkow(widok(6, panel), panel, 'osm');
  assert.equal(plan.kafelki.length, MAX_KAFELEK);
  assert.equal(plan.przyciete, true);
});

/**
 * Zgłoszenie właściciela D1 (2026-09-09): na desktopie brakowało skrajnego
 * dolnego-prawego kafelka i kilku w najniższym rzędzie. Powodem był sufit 48
 * kafelków (Full HD potrzebuje ~54) plus przycinanie row-major, które przy
 * przekroczeniu limitu ucinało płaski dolny pas siatki.
 */
test('D1: plan dla okna Full HD jest kompletny — żadnego brakującego rzędu ani kolumny', () => {
  for (const panel of [
    { szerokosc: 1920, wysokosc: 900 },   // Full HD z paskiem przeglądarki
    { szerokosc: 1920, wysokosc: 1080 },  // pełny ekran
    { szerokosc: 2560, wysokosc: 1300 },  // QHD
  ]) {
    const plan = planKafelkow(widok(16, panel), panel, 'osm');
    assert.equal(plan.przyciete, false, `panel ${panel.szerokosc}×${panel.wysokosc} mieści się bez przycinania`);

    // Siatka musi być pełnym prostokątem: każdy rząd ma komplet kolumn.
    const rzedy = new Map();
    for (const k of plan.kafelki) {
      if (!rzedy.has(k.ty)) rzedy.set(k.ty, new Set());
      rzedy.get(k.ty).add(k.tx);
    }
    const szerokosciRzedow = [...rzedy.values()].map((s) => s.size);
    assert.equal(new Set(szerokosciRzedow).size, 1,
      `każdy rząd ma tyle samo kafelków (dostałem ${szerokosciRzedow.join(', ')})`);

    // Skrajny dolny-prawy kafelek istnieje.
    const maxTy = Math.max(...plan.kafelki.map((k) => k.ty));
    const maxTx = Math.max(...plan.kafelki.map((k) => k.tx));
    assert.ok(plan.kafelki.some((k) => k.ty === maxTy && k.tx === maxTx),
      'dolny-prawy kafelek jest w planie');
  }
});

test('D1: gdy przycinanie jest konieczne, znikają obrzeża — nie cały dolny pas', () => {
  const panel = { szerokosc: 8000, wysokosc: 8000 };
  const plan = planKafelkow(widok(7, panel), panel, 'osm');
  assert.equal(plan.przyciete, true, 'warunek wstępny: ten plan trzeba przyciąć');

  // Rozkład kafelków wokół środka planu musi być symetryczny — stary kod
  // zostawiał wyłącznie górne rzędy, więc środek ciężkości leciał do góry.
  const srodekTy = (Math.min(...plan.kafelki.map((k) => k.ty)) + Math.max(...plan.kafelki.map((k) => k.ty))) / 2;
  const powyzej = plan.kafelki.filter((k) => k.ty < srodekTy).length;
  const ponizej = plan.kafelki.filter((k) => k.ty > srodekTy).length;
  assert.ok(Math.abs(powyzej - ponizej) <= plan.kafelki.length * 0.15,
    `kafelki rozłożone symetrycznie w pionie (${powyzej} nad, ${ponizej} pod środkiem)`);
});

test('planKafelkow dla schowanego panelu i wyłączonego podkładu jest pusty', () => {
  assert.deepEqual(planKafelkow(widok(17), { szerokosc: 0, wysokosc: 0 }, 'osm').kafelki, []);
  assert.deepEqual(planKafelkow(widok(17), PANEL, 'brak').kafelki, []);
});

/* ------------------------------------------------------------------ *
 * Metry na ekranie i pasek skali
 * ------------------------------------------------------------------ */

test('metry na jednostkę świata i na piksel są spójne (r × skala = r w pikselach)', () => {
  const w = widok(17);
  const mjs = metryNaJednostkeSwiata(WARSZAWA.lat, w);
  const mpp = metryNaPiksel(WARSZAWA.lat, zoomWidoku(w));
  assert.ok(Math.abs(mjs - mpp * w.skala) < 1e-6);
  assert.ok(mjs > mpp); // jednostka świata jest większa niż piksel
  const rSwiat = promienWSwiecie(12, WARSZAWA.lat, w);
  const rPx = promienWpikselach(12, WARSZAWA.lat, w);
  assert.ok(Math.abs(rSwiat * w.skala - rPx) < 1e-9);
  assert.ok(Math.abs(rPx - 12 / mpp) < 1e-9);
});

test('koło dokładności ma tyle pikseli, ile wynika z m/px przy tym zoomie', () => {
  const w = widok(17);
  const mpp = metryNaPiksel(WARSZAWA.lat, 17);
  assert.ok(Math.abs(promienWpikselach(50, WARSZAWA.lat, w) - 50 / mpp) < 1e-6);
  // zoom bliżej → ten sam promień zajmuje więcej pikseli
  assert.ok(promienWpikselach(50, WARSZAWA.lat, widok(18)) > promienWpikselach(50, WARSZAWA.lat, w));
});

test('skalaBar wybiera „ładny" krok mieszczący się w pasku', () => {
  const bar = skalaBar(widok(17), WARSZAWA.lat);
  assert.ok(bar);
  assert.ok(KROKI_SKALI_M.includes(bar.metry));
  assert.equal(bar.etykieta, `${bar.metry} m`);
  assert.ok(bar.px <= 80 && bar.px >= 14);
});

test('skalaBar przechodzi na kilometry i znika przy widoku całej Ziemi', () => {
  const bar = skalaBar(widok(10), WARSZAWA.lat);
  assert.ok(bar.metry >= 1000);
  assert.equal(bar.etykieta, `${bar.metry / 1000} km`);
  assert.equal(skalaBar(widok(1), WARSZAWA.lat), null);
});

test('etykietaWidoku opisuje środek i powiększenie (dane, nie treść wymyślona w JS)', () => {
  const etykieta = etykietaWidoku(widok(17), PANEL);
  assert.ok(etykieta.includes('52.22970'));
  assert.ok(etykieta.includes('21.01220'));
  assert.ok(etykieta.includes('17'));
  assert.ok(etykieta.includes(PODKLADY.osm.etykieta));
});

/* ------------------------------------------------------------------ *
 * Plan rysowania
 * ------------------------------------------------------------------ */

test('planMapy bez pozycji: brak markera i brak okręgów, kafelki i atrybucja są', () => {
  const plan = planMapy({ widok: widok(17), rozmiar: PANEL, podklad: 'osm' });
  assert.equal(plan.marker, null);
  assert.deepEqual(plan.okregi, []);
  assert.equal(plan.pusty, false);
  assert.ok(plan.kafelki.length > 0);
  assert.equal(plan.atrybucja, PODKLADY.osm.atrybucja);
  assert.equal(plan.etykietaPodkladu, PODKLADY.osm.etykieta);
  assert.ok(Math.abs(plan.srodek.lat - WARSZAWA.lat) < 1e-6);
});

test('planMapy z pozycją: marker w środku panelu, koło dokładności i okrąg promienia', () => {
  const plan = planMapy({
    widok: widok(17),
    rozmiar: PANEL,
    pozycja: { ...WARSZAWA, accuracy: 12 },
    promienM: 700,
  });
  assert.equal(plan.marker.x, PANEL.szerokosc / 2);
  assert.equal(plan.marker.y, PANEL.wysokosc / 2);
  assert.equal(plan.marker.dokladnoscM, 12);
  assert.deepEqual(plan.okregi.map((o) => o.typ), ['dokladnosc', 'promien']);
  const [dokladnosc, promien] = plan.okregi;
  const mpp = metryNaPiksel(WARSZAWA.lat, 17);
  assert.ok(Math.abs(dokladnosc.r * plan.skala - 12 / mpp) < 1e-6);
  assert.ok(Math.abs(promien.r * plan.skala - 700 / mpp) < 1e-6);
});

test('planMapy bez dokładności w fixie nie rysuje koła dokładności (uczciwość wobec danych)', () => {
  const plan = planMapy({ widok: widok(17), rozmiar: PANEL, pozycja: { lat: 52.2, lon: 21.0 } });
  assert.deepEqual(plan.okregi.map((o) => o.typ), []);
  assert.equal(plan.marker.dokladnoscM, null);
});

test('planMapy numeruje pinezki od 1 i oznacza tylko aktywną stację', () => {
  const lista = stacje(5, 300);
  const plan = planMapy({
    widok: widok(15),
    rozmiar: PANEL,
    pozycja: { ...WARSZAWA, accuracy: 12 },
    stacje: lista,
    aktywnaStacja: 'stacja-3',
  });
  assert.equal(plan.pinezki.length, 5);
  assert.deepEqual(plan.pinezki.map((p) => p.numer), [1, 2, 3, 4, 5]);
  assert.deepEqual(plan.pinezki.map((p) => p.id), lista.map((s) => s.id));
  assert.deepEqual(plan.pinezki.filter((p) => p.aktywna).map((p) => p.id), ['stacja-3']);
  assert.deepEqual(plan.pinezki.map((p) => p.dystansM), lista.map((s) => s.dystansM));
  // pinezki pierścienia 300 m przy zoomie 15 są w okolicy panelu, nie w nieskończoności
  for (const p of plan.pinezki) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    const dx = p.x - PANEL.szerokosc / 2;
    const dy = p.y - PANEL.wysokosc / 2;
    assert.ok(Math.hypot(dx, dy) < 2000);
  }
});

test('planMapy dla schowanego panelu jest pusty (display:none → rozmiar 0)', () => {
  const plan = planMapy({
    widok: widok(17),
    rozmiar: { szerokosc: 0, wysokosc: 0 },
    pozycja: { ...WARSZAWA, accuracy: 12 },
    stacje: stacje(3),
  });
  assert.equal(plan.pusty, true);
  assert.deepEqual(plan.kafelki, []);
  assert.deepEqual(plan.pinezki, []);
  assert.equal(plan.marker, null);
  assert.equal(plan.pasekSkali, null);
  assert.equal(plan.etykietaWidoku, '');
});

test('planMapy odmawia przy nieznanym podkładzie i przy śmieciach w widoku', () => {
  assert.throws(() => planMapy({ widok: widok(17), rozmiar: PANEL, podklad: 'carto' }), TypeError);
  assert.throws(() => planMapy({ widok: { x: 0, y: 0, skala: NaN }, rozmiar: PANEL }), TypeError);
  assert.throws(() => planMapy({ widok: widok(17), rozmiar: PANEL, stacje: null }), TypeError);
});

test('planMapy dla podkładu „brak" nie ma kafelków, ale ma warstwy własne', () => {
  const plan = planMapy({
    widok: widok(17),
    rozmiar: PANEL,
    podklad: 'brak',
    pozycja: { ...WARSZAWA, accuracy: 12 },
    stacje: stacje(3),
    promienM: 500,
  });
  assert.deepEqual(plan.kafelki, []);
  assert.equal(plan.atrybucja, '');
  assert.equal(plan.pinezki.length, 3);
  assert.ok(plan.marker);
});

test('rozmiarPanelu czyta getBoundingClientRect i zwraca zera bez pomiaru', () => {
  const el = { getBoundingClientRect: () => ({ width: 360, height: 300, left: 10, top: 20 }) };
  assert.deepEqual(
    { ...rozmiarPanelu(el), szerokosc: 360, wysokosc: 300, lewa: 10, gorna: 20 },
    { szerokosc: 360, wysokosc: 300, lewa: 10, gorna: 20 },
  );
  assert.deepEqual(rozmiarPanelu(null), { szerokosc: 0, wysokosc: 0, lewa: 0, gorna: 0 });
  assert.deepEqual(rozmiarPanelu({}), { szerokosc: 0, wysokosc: 0, lewa: 0, gorna: 0 });
  assert.deepEqual(rozmiarPanelu({ getBoundingClientRect: () => ({ width: NaN, height: NaN }) }), {
    szerokosc: 0,
    wysokosc: 0,
    lewa: 0,
    gorna: 0,
  });
});

/* ------------------------------------------------------------------ *
 * Warstwa DOM (atrapa)
 * ------------------------------------------------------------------ */

const ID = 'mapa-pozycja';

/** Odpala nasłuch elementu tak, jak robi to przeglądarka. */
function wyslij(el, typ, zdarzenie) {
  const lista = el.zdarzenia[typ] ?? [];
  for (const fn of lista) fn({ type: typ, preventDefault() {}, ...zdarzenie });
  return lista.length;
}

test('utworzMape zwraca null, gdy panelu nie ma w DOM (aplikacja działa bez mapy)', () => {
  const mapa = utworzMape({ id: 'brak-takiej-mapy', doc: { getElementById: () => null } });
  assert.equal(mapa, null);
});

test('utworzMape buduje warstwy, atrybucję i opis widoku', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  assert.ok(mapa);
  const svg = dom.pobierz(`${ID}-svg`);
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  assert.ok(kafelki.children.length > 0);
  assert.equal(kafelki.children[0].przestrzenNazw, PRZESTRZEN_SVG);
  assert.equal(kafelki.children[0].tagName, 'IMAGE');
  assert.ok(kafelki.children[0].getAttribute('href').startsWith('https://tile.openstreetmap.org/'));
  assert.equal(dom.pobierz(`${ID}-atrybucja`).textContent, PODKLADY.osm.atrybucja);
  assert.ok(svg.getAttribute('aria-label').includes('52.22970'));
  assert.equal(svg.getAttribute('viewBox'), '0 0 360 320');
  assert.equal(mapa.plan().kafelki.length, kafelki.children.length);
  mapa.zniszcz();
});

test('warstwa kafelków dostaje jeden transform, a kafelki są w jednostkach świata', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  const plan = mapa.plan();
  assert.equal(kafelki.getAttribute('transform'), `translate(${plan.przesuniecie.x} ${plan.przesuniecie.y}) scale(${plan.skala})`);
  const k = kafelki.children[0];
  assert.equal(Number(k.getAttribute('x')), plan.kafelki[0].x);
  assert.equal(Number(k.getAttribute('width')), plan.kafelki[0].rozmiar);
  assert.ok(Number(k.getAttribute('width')) < 1); // jednostki świata, nie piksele
  mapa.zniszcz();
});

test('drag jednym palcem przesuwa widok i nie przebudowuje listy kafelków', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const svg = dom.pobierz(`${ID}-svg`);
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  const przed = mapa.widok();

  assert.ok(wyslij(svg, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 100 }) > 0);
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 230, clientY: 80 });
  const po = mapa.widok();
  assert.equal(po.x, przed.x + 30);
  assert.equal(po.y, przed.y - 20);
  assert.equal(po.skala, przed.skala);

  // ruch o piksel nie zmienia siatki kafelków → ta sama lista elementów:
  // bez migotania i bez ponownych żądań do dostawcy
  const obrazy = kafelki.children;
  const hrefy = obrazy.map((k) => k.getAttribute('href'));
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 231, clientY: 80 });
  assert.equal(kafelki.children, obrazy);
  assert.deepEqual(kafelki.children.map((k) => k.getAttribute('href')), hrefy);
  assert.equal(mapa.widok().x, po.x + 1);

  wyslij(svg, 'pointerup', { pointerId: 1 });
  const poPuszczeniu = mapa.widok();
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 500, clientY: 500 });
  assert.deepEqual(mapa.widok(), poPuszczeniu, 'po puszczeniu palca ruch nic nie zmienia');
  mapa.zniszcz();
});

test('pinch dwoma palcami przybliża, a zsuwanie oddala', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 15, doc: dom.document });
  const svg = dom.pobierz(`${ID}-svg`);
  const zoomPrzed = zoomWidoku(mapa.widok());

  wyslij(svg, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 160 });
  wyslij(svg, 'pointerdown', { pointerId: 2, clientX: 200, clientY: 160 });
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 60, clientY: 160 });
  wyslij(svg, 'pointermove', { pointerId: 2, clientX: 240, clientY: 160 });
  const zoomPo = zoomWidoku(mapa.widok());
  assert.ok(zoomPo > zoomPrzed + 0.5, `pinch ma przybliżać: ${zoomPrzed} → ${zoomPo}`);

  // zsuwanie palców
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 140, clientY: 160 });
  wyslij(svg, 'pointermove', { pointerId: 2, clientX: 160, clientY: 160 });
  assert.ok(zoomWidoku(mapa.widok()) < zoomPo);

  wyslij(svg, 'pointerup', { pointerId: 1 });
  wyslij(svg, 'pointerup', { pointerId: 2 });
  mapa.zniszcz();
});

test('pinch nie wychodzi poza maxZoom podkładu', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, podklad: 'opentopo', srodek: WARSZAWA, zoom: 16, doc: dom.document });
  const svg = dom.pobierz(`${ID}-svg`);
  wyslij(svg, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 160 });
  wyslij(svg, 'pointerdown', { pointerId: 2, clientX: 200, clientY: 160 });
  for (let i = 0; i < 12; i += 1) {
    wyslij(svg, 'pointermove', { pointerId: 1, clientX: 100 - i * 40, clientY: 160 });
    wyslij(svg, 'pointermove', { pointerId: 2, clientX: 200 + i * 40, clientY: 160 });
  }
  assert.ok(zoomWidoku(mapa.widok()) <= PODKLADY.opentopo.maxZoom + 1e-9);
  mapa.zniszcz();
});

test('przyciski ± i centrowanie są podpięte pod nasłuchy click z HTML', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  const zoomPrzed = zoomWidoku(mapa.widok());
  assert.ok(dom.pobierz(`${ID}-przybliz`).zdarzenia.click?.length > 0);
  assert.ok(dom.pobierz(`${ID}-oddal`).zdarzenia.click?.length > 0);
  assert.ok(dom.pobierz(`${ID}-centruj`).zdarzenia.click?.length > 0);

  wyslij(dom.pobierz(`${ID}-przybliz`), 'click', {});
  assert.ok(Math.abs(zoomWidoku(mapa.widok()) - (zoomPrzed + 1)) < 1e-9);
  wyslij(dom.pobierz(`${ID}-oddal`), 'click', {});
  wyslij(dom.pobierz(`${ID}-oddal`), 'click', {});
  assert.ok(Math.abs(zoomWidoku(mapa.widok()) - (zoomPrzed - 1)) < 1e-9);

  // centrowanie bez pozycji nic nie zmienia i nic nie psuje
  mapa.zaznaczStacje([]);
  mapa.odswiez();
  mapa.zniszcz();
});

test('centrowanie wraca do pozycji gracza po oddaleniu', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  mapa.pokazPozycje({ ...WARSZAWA, accuracy: 10 });
  wyslij(dom.pobierz(`${ID}-svg`), 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
  wyslij(dom.pobierz(`${ID}-svg`), 'pointermove', { pointerId: 1, clientX: 300, clientY: 250 });
  const poDragu = srodekWidoku(mapa.widok(), PANEL);
  assert.ok(Math.abs(poDragu.lat - WARSZAWA.lat) > 0.001);

  wyslij(dom.pobierz(`${ID}-centruj`), 'click', {});
  const poCentrowaniu = srodekWidoku(mapa.widok(), PANEL);
  assert.ok(Math.abs(poCentrowaniu.lat - WARSZAWA.lat) < 1e-6);
  assert.ok(Math.abs(poCentrowaniu.lon - WARSZAWA.lon) < 1e-6);
  mapa.zniszcz();
});

test('pokazPozycje rysuje marker i koło dokładności, a brak fixu je czyści', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const marker = dom.pobierz(`${ID}-marker`);
  const okregi = dom.pobierz(`${ID}-okregi`);
  assert.equal(marker.children.length, 0);

  mapa.pokazPozycje({ ...WARSZAWA, accuracy: 12 });
  assert.equal(marker.children.length, 1);
  assert.equal(marker.children[0].getAttribute('class'), 'marker');
  assert.equal(marker.children[0].children[0].tagName, 'CIRCLE');
  assert.equal(okregi.children.length, 1);
  assert.equal(okregi.children[0].getAttribute('class'), 'okrag-dokladnosc');
  assert.equal(okregi.children[0].getAttribute('vector-effect'), 'non-scaling-stroke');

  mapa.pokazPozycje(null);
  assert.equal(marker.children.length, 0);
  assert.equal(okregi.children.length, 0);
  mapa.zniszcz();
});

test('zaznaczStacje rysuje numerowane pinezki z identyfikatorem i klasą aktywnej', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 15, doc: dom.document });
  const pinezki = dom.pobierz(`${ID}-pinezki`);
  mapa.pokazPozycje({ ...WARSZAWA, accuracy: 12 });
  mapa.zaznaczStacje(stacje(5, 300), { promienM: 800, aktywna: 'stacja-2' });

  assert.equal(pinezki.children.length, 5);
  const numery = pinezki.children.map((g) => g.children[1].textContent);
  assert.deepEqual(numery, ['1', '2', '3', '4', '5']);
  assert.deepEqual(pinezki.children.map((g) => g.getAttribute('data-stacja')), [
    'stacja-1',
    'stacja-2',
    'stacja-3',
    'stacja-4',
    'stacja-5',
  ]);
  assert.equal(pinezki.children[1].getAttribute('class'), 'pinezka pinezka-aktywna');
  assert.equal(pinezki.children[0].getAttribute('class'), 'pinezka');

  // okrąg promienia gry dochodzi do warstwy w jednostkach świata
  const okregi = dom.pobierz(`${ID}-okregi`);
  assert.deepEqual(okregi.children.map((c) => c.getAttribute('class')), ['okrag-dokladnosc', 'okrag-promien']);
  assert.ok(Number(okregi.children[1].getAttribute('r')) > Number(okregi.children[0].getAttribute('r')));
  mapa.zniszcz();
});

test('ustawPodklad podmienia URL-e i atrybucję, a „brak" czyści kafelki', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 15, doc: dom.document });
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  const atrybucja = dom.pobierz(`${ID}-atrybucja`);

  mapa.ustawPodklad('esri-satelita');
  assert.ok(kafelki.children.length > 0);
  assert.ok(kafelki.children[0].getAttribute('href').includes('server.arcgisonline.com'));
  assert.equal(atrybucja.textContent, PODKLADY['esri-satelita'].atrybucja);

  mapa.ustawPodklad('brak');
  assert.equal(kafelki.children.length, 0);
  assert.equal(atrybucja.textContent, '');

  mapa.ustawPodklad('osm');
  assert.ok(kafelki.children.length > 0);
  assert.ok(kafelki.children[0].getAttribute('href').includes('tile.openstreetmap.org'));
  assert.equal(atrybucja.textContent, PODKLADY.osm.atrybucja);
  assert.throws(() => mapa.ustawPodklad('carto-dark'), TypeError);
  mapa.zniszcz();
});

test('schowany panel nie rysuje nic, a po pokazaniu kafelki wracają (sygnatura nie zostaje z widoku zerowego)', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  assert.ok(kafelki.children.length > 0);

  dom.ustawProstokat(ID, { width: 0, height: 0 });
  const planUkryty = mapa.odswiez();
  assert.equal(planUkryty.pusty, true);
  assert.equal(kafelki.children.length, 0);
  assert.equal(dom.pobierz(`${ID}-pinezki`).children.length, 0);

  dom.ustawProstokat(ID, { width: 360, height: 320 });
  const planWidoczny = mapa.odswiez();
  assert.equal(planWidoczny.pusty, false);
  assert.ok(kafelki.children.length > 0);
  mapa.zniszcz();
});

test('pasek skali trafia do pola opisu, a przy widoku świata znika', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const pole = dom.pobierz(`${ID}-skala`);
  assert.equal(pole.textContent, '50 m');
  mapa.ustawSrodek({ ...WARSZAWA, zoom: 1 });
  assert.equal(pole.textContent, '');
  mapa.zniszcz();
});

test('ustawSrodek przenosi widok i przelicza wszystko od nowa', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  mapa.ustawSrodek({ lat: 50.0614, lon: 19.9372, zoom: 15 }); // Kraków
  const s = srodekWidoku(mapa.widok(), PANEL);
  assert.ok(Math.abs(s.lat - 50.0614) < 1e-6);
  assert.ok(Math.abs(s.lon - 19.9372) < 1e-6);
  assert.ok(Math.abs(zoomWidoku(mapa.widok()) - 15) < 1e-9);
  assert.ok(dom.pobierz(`${ID}-svg`).getAttribute('aria-label').includes('50.06140'));
  mapa.zniszcz();
});

test('zniszcz zdejmuje nasłuchy i czyści warstwy (gest po zniszczeniu nic nie zmienia)', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  const svg = dom.pobierz(`${ID}-svg`);
  assert.ok((svg.zdarzenia.pointerdown ?? []).length === 1);
  assert.ok((svg.zdarzenia.wheel ?? []).length === 1);
  const widokPrzed = mapa.widok();

  mapa.zniszcz();
  assert.equal((svg.zdarzenia.pointerdown ?? []).length, 0);
  assert.equal((svg.zdarzenia.pointermove ?? []).length, 0);
  assert.equal((svg.zdarzenia.wheel ?? []).length, 0);
  assert.equal((dom.pobierz(`${ID}-przybliz`).zdarzenia.click ?? []).length, 0);
  assert.equal(dom.pobierz(`${ID}-kafelki`).children.length, 0);
  assert.equal(mapa.plan(), null);

  wyslij(svg, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  wyslij(svg, 'pointermove', { pointerId: 1, clientX: 100, clientY: 100 });
  assert.deepEqual(mapa.widok(), widokPrzed);
});

test('kółko myszy przybliża wokół kursora i nie przewija strony (passive: false)', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  const svg = dom.pobierz(`${ID}-svg`);
  const zoomPrzed = zoomWidoku(mapa.widok());
  let zablokowane = 0;
  wyslij(svg, 'wheel', { deltaY: -120, clientX: 100, clientY: 100, preventDefault: () => { zablokowane += 1; } });
  assert.equal(zablokowane, 1);
  assert.ok(zoomWidoku(mapa.widok()) > zoomPrzed);
  wyslij(svg, 'wheel', { deltaY: 120, clientX: 100, clientY: 100 });
  wyslij(svg, 'wheel', { deltaY: 120, clientX: 100, clientY: 100 });
  assert.ok(zoomWidoku(mapa.widok()) < zoomPrzed);
  mapa.zniszcz();
});

test('mapa nie woła geolokalizacji, sieci ani alertów (rysuje to, co dostała)', () => {
  const dom = zainstalujDom();
  const wywolania = [];
  dom.navigator.geolocation = { watchPosition: (...a) => { wywolania.push(a); return 1; }, clearWatch() {} };
  const fetchPrzed = globalThis.fetch;
  globalThis.fetch = (...a) => { wywolania.push(a); return Promise.resolve({ ok: true }); };
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  mapa.pokazPozycje({ ...WARSZAWA, accuracy: 12 });
  mapa.zaznaczStacje(stacje(3), { promienM: 500 });
  assert.equal(wywolania.length, 0, 'mapa nie woła ani geolokalizacji, ani sieci');
  globalThis.fetch = fetchPrzed;
  mapa.zniszcz();
});

test('plan kafelków zgadza się z tym, co wylądowało w DOM (jedno źródło prawdy)', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 16, doc: dom.document });
  const plan = mapa.plan();
  const kafelki = dom.pobierz(`${ID}-kafelki`);
  assert.equal(kafelki.children.length, plan.kafelki.length);
  plan.kafelki.forEach((k, i) => {
    assert.equal(kafelki.children[i].getAttribute('href'), k.url);
    assert.equal(Number(kafelki.children[i].getAttribute('x')), k.x);
    assert.equal(Number(kafelki.children[i].getAttribute('y')), k.y);
  });
  // kontrola krzyżowa z `geo.js`: kafelek środka widoku to ten, który wskazuje
  // niezależna funkcja `wspolrzedneDoKafelka` dla tego samego zoomu
  const oczekiwany = wspolrzedneDoKafelka(WARSZAWA.lat, WARSZAWA.lon, plan.z);
  const txSrodka = Math.floor(oczekiwany.x);
  const tySrodka = Math.floor(oczekiwany.y);
  assert.ok(plan.kafelki.some((k) => k.tx === txSrodka && k.ty === tySrodka));
  for (const k of plan.kafelki) {
    assert.equal(Number.isInteger(k.z), true);
    assert.equal(k.x / k.rozmiar, k.tx);
    assert.equal(k.y / k.rozmiar, k.ty);
  }
  mapa.zniszcz();
});

/* ------------------------------------------------- M4/I8: tryb ręczny (drag) */

import { wspolrzedneZEkranu } from '../app/mapa.js';

test('wspolrzedneZEkranu jest odwrotnością punktNaEkranie (round-trip)', () => {
  const widok = widokNaSrodek({ lat: 52.2297, lon: 21.0122, zoom: 17, rozmiar: { szerokosc: 360, wysokosc: 320 } });
  for (const [lat, lon] of [[52.2297, 21.0122], [52.235, 21.0], [52.22, 21.03], [51.1, 17.03]]) {
    const ekran = punktNaEkranie(lat, lon, widok);
    const geo = wspolrzedneZEkranu(ekran.x, ekran.y, widok);
    assert.ok(Math.abs(geo.lat - lat) < 1e-9 && Math.abs(geo.lon - lon) < 1e-9, `round-trip dla ${lat},${lon}`);
  }
  assert.throws(() => wspolrzedneZEkranu(NaN, 10, widok), TypeError);
  assert.throws(() => wspolrzedneZEkranu(10, 10, { x: 0 }), (e) => e instanceof TypeError);
});

test('tryb ręczny: przeciągnięcie pinezki przesuwa stację, woła callback i NIE przesuwa widoku', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 17, doc: dom.document });
  const stacje = [
    { id: 1, lat: 52.2320, lon: 21.0122, odlegloscM: 256, bearing: 0 },
    { id: 2, lat: 52.2280, lon: 21.0100, odlegloscM: 240, bearing: 200 },
  ];
  mapa.zaznaczStacje(stacje, { promienM: 600 });
  const pinezki = dom.pobierz(`${ID}-pinezki`);
  assert.equal(pinezki.children.length, 2);
  assert.equal(pinezki.children[0].zdarzenia.pointerdown, undefined, 'poza trybem ręcznym pinezki nie mają nasłuchu');

  const zmiany = [];
  mapa.ustawTrybReczny(true, (index, punkt) => zmiany.push([index, punkt]));
  assert.match(pinezki.children[0].getAttribute('class'), /pinezka-reczna/, 'pinezka w trybie ręcznym ma klasę drag');
  assert.ok(pinezki.children[0].zdarzenia.pointerdown.length > 0, 'nasłuch przeciągania założony');

  const widokPrzed = mapa.widok();
  const cel = { lat: 52.2335, lon: 21.0150 };
  const ekranCelu = punktNaEkranie(cel.lat, cel.lon, widokPrzed);
  // palec na pinezkę 2 (index 1)
  assert.ok(wyslij(pinezki.children[1], 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0, stopPropagation() {} }) > 0);
  // gest przejmuje SVG (pointer capture) — pan nie startuje
  wyslij(dom.pobierz(`${ID}-svg`), 'pointerdown', { pointerId: 7, clientX: 10, clientY: 10 });
  wyslij(dom.pobierz(`${ID}-svg`), 'pointermove', { pointerId: 7, clientX: ekranCelu.x, clientY: ekranCelu.y });
  assert.deepEqual(mapa.widok(), widokPrzed, 'widok ani drgnie podczas przeciągania pinezki');
  const planWTtrakcie = mapa.plan();
  const pinezkaWTtrakcie = planWTtrakcie.pinezki[1];
  assert.ok(Math.abs(pinezkaWTtrakcie.x - ekranCelu.x) < 0.01, 'pinezka jedzie z palcem');

  wyslij(dom.pobierz(`${ID}-svg`), 'pointerup', { pointerId: 7 });
  assert.equal(zmiany.length, 1, 'callback raz, po puszczeniu palca');
  assert.equal(zmiany[0][0], 1, 'index stacji w tablicy');
  const geo = zmiany[0][1];
  assert.ok(Math.abs(geo.lat - cel.lat) < 1e-5 && Math.abs(geo.lon - cel.lon) < 1e-5, `callback z celem: ${geo.lat},${geo.lon}`);
  assert.equal(mapa.plan().pinezki[0].id, 1, 'sąsiednia pinezka nietknięta');

  // puszczenie bez ruchu nie woła callbacku (palec drgnął przy kliknięciu)
  wyslij(pinezki.children[0], 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0, stopPropagation() {} });
  wyslij(dom.pobierz(`${ID}-svg`), 'pointerup', { pointerId: 8 });
  assert.equal(zmiany.length, 1, 'klik bez przeciągnięcia nic nie zmienia');

  mapa.ustawTrybReczny(false);
  assert.equal(pinezki.children[0].zdarzenia.pointerdown, undefined, 'po wyłączeniu nowe pinezki bez nasłuchu drag');
  mapa.zniszcz();
});

test('T2: środek zadany przy schowanym panelu ląduje na środku po pokazaniu (bez przesunięcia E+S)', () => {
  const dom = zainstalujDom();
  const mapa = utworzMape({ id: ID, srodek: WARSZAWA, zoom: 14, doc: dom.document });
  const PODKOWA = { lat: 52.12303, lon: 20.74614 };
  dom.ustawProstokat(ID, { width: 0, height: 0 }); // ekran stacji schowany
  mapa.ustawSrodek({ ...PODKOWA, zoom: 14 }); // pierwszy fix centruje WSZYSTKIE mapy
  dom.ustawProstokat(ID, { width: 360, height: 320 }); // wejście na ekran stacji
  mapa.odswiez();
  const srodek = srodekWidoku(mapa.widok(), { szerokosc: 360, wysokosc: 320 });
  assert.ok(Math.abs(srodek.lat - PODKOWA.lat) < 0.0001, `lat środka: ${srodek.lat}`);
  assert.ok(Math.abs(srodek.lon - PODKOWA.lon) < 0.0001, `lon środka: ${srodek.lon}`);
  mapa.zniszcz();
});

/* ------------------------------------------------------------------ *
 * Operatorskie nadpisanie szablonu kafelków (polityka kafelków OSM:
 * „avoid hard-coding the tile URL; allow switching without needing a
 * software update"). Serwer kafelków jest wolontariacki i bez SLA —
 * przełącznik musi istnieć bez wdrażania nowej wersji.
 * ------------------------------------------------------------------ */

test('walidujSzablonKafelkow: przyjmuje tylko https z {z}/{x}/{y}', () => {
  const dobry = 'https://tiles.przyklad.org/{z}/{x}/{y}.png';
  assert.equal(walidujSzablonKafelkow(dobry), dobry, 'poprawny https przechodzi');
  assert.equal(walidujSzablonKafelkow(`  ${dobry}  `), dobry, 'białe znaki przycinane');

  // Polityka OSM wprost zakazuje wariantu http:// — i słusznie, bo strona
  // idzie po https i mieszana treść i tak by nie przeszła.
  assert.equal(walidujSzablonKafelkow('http://tiles.przyklad.org/{z}/{x}/{y}.png'), null,
    'http odrzucony (polityka OSM: tylko https)');
  assert.equal(walidujSzablonKafelkow('https://tiles.przyklad.org/{z}/{x}.png'), null,
    'brak {y} odrzucony — jeden adres dla całej siatki');
  assert.equal(walidujSzablonKafelkow('https://tiles.przyklad.org/tile.png'), null,
    'brak wszystkich podstawień odrzucony');
  assert.equal(walidujSzablonKafelkow('to nie jest url'), null, 'śmieć odrzucony');
  assert.equal(walidujSzablonKafelkow(''), null, 'pusty odrzucony');
  assert.equal(walidujSzablonKafelkow(null), null, 'null odrzucony');
  assert.equal(walidujSzablonKafelkow(42), null, 'nie-napis odrzucony');
});

test('ustawSzablonKafelkow: nadpisanie działa dla osm i tylko dla osm', () => {
  const wbudowany = SZABLONY_KAFELKOW.osm;
  const zamiennik = 'https://zamiennik.przyklad.org/{z}/{x}/{y}.png';
  try {
    assert.equal(ustawSzablonKafelkow(zamiennik), zamiennik, 'setter zwraca przyjęty szablon');
    assert.equal(biezacySzablonKafelkow('osm'), zamiennik, 'bieżący szablon = nadpisanie');
    assert.equal(urlKafelka('osm', 19, 28861, 17402),
      'https://zamiennik.przyklad.org/19/28861/17402.png',
      'urlKafelka podstawia nadpisany szablon');

    // Pozostali dostawcy mają własne adresy i własne zasady licencjonowania —
    // nadpisanie OSM nie może ich po cichu przejąć.
    assert.equal(biezacySzablonKafelkow('opentopo'), SZABLONY_KAFELKOW.opentopo,
      'opentopo nietknięty');
    assert.equal(biezacySzablonKafelkow('brak'), null, '„brak" nadal wyłącza kafelki');
    assert.equal(urlKafelka('brak', 5, 1, 1), null, 'podkład wyłączony zostaje wyłączony');
  } finally {
    ustawSzablonKafelkow(null);
  }
  assert.equal(biezacySzablonKafelkow('osm'), wbudowany, 'null przywraca adres wbudowany');
  assert.equal(urlKafelka('osm', 19, 28861, 17402),
    'https://tile.openstreetmap.org/19/28861/17402.png', 'domyślne zachowanie wraca');
});

test('ustawSzablonKafelkow: błędna wartość NIE psuje mapy (zostaje adres wbudowany)', () => {
  const wbudowany = SZABLONY_KAFELKOW.osm;
  try {
    for (const smiec of ['http://x/{z}/{x}/{y}.png', 'ftp://x/{z}/{x}/{y}.png', '???', '', null, undefined, {}]) {
      assert.equal(ustawSzablonKafelkow(smiec), null, `odrzucone: ${String(smiec)}`);
      assert.equal(biezacySzablonKafelkow('osm'), wbudowany,
        `po odrzuceniu ${String(smiec)} działa adres wbudowany`);
    }
  } finally {
    ustawSzablonKafelkow(null);
  }
});

test('planMapy z nadpisanym szablonem rysuje kafelki z nowego adresu', () => {
  const zamiennik = 'https://zamiennik.przyklad.org/{z}/{x}/{y}.png';
  try {
    ustawSzablonKafelkow(zamiennik);
    const plan = planMapy({ widok: widok(17), rozmiar: PANEL, podklad: 'osm' });
    assert.ok(plan.kafelki.length > 0, 'kafelki są');
    assert.ok(plan.kafelki.every((k) => k.url.startsWith('https://zamiennik.przyklad.org/')),
      'każdy kafelek z nadpisanego hosta');
  } finally {
    ustawSzablonKafelkow(null);
  }
  const po = planMapy({ widok: widok(17), rozmiar: PANEL, podklad: 'osm' });
  assert.ok(po.kafelki.every((k) => k.url.startsWith('https://tile.openstreetmap.org/')),
    'po wyłączeniu nadpisania wraca OSM');
});

test('KLUCZ_URL_KAFELKOW: klucz operatorski w przestrzeni nazw aplikacji', () => {
  assert.equal(KLUCZ_URL_KAFELKOW, 'okolica:kafelki:url');
});
