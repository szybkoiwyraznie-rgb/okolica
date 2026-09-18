/**
 * Most Drive: cache L2 sieci drogowej (teren 2026-09-16).
 *
 * Telefon nie zawsze pamięta okolicę (wyczyszczona pamięć, drugi telefon),
 * a Overpass nie musi wołać dwa razy o to samo: po świeżym pobraniu aplikacja
 * wysyła uproszczoną sieć na Drive (`siec-zapisz`), a przed łańcuchem pyta
 * o nią (`akcja=siec`). Testy idą przez `doPost`/`doGet`, jak telefon
 * (LESSONS L33/L73) — wpisy składa PRAWDZIWE `zlozWpisSieci` z aplikacji,
 * więc zgodność kształtów jest testowana, nie zakładana.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { POLITYKA, zlozWpisSieci } from '../app/sieci.js';
import { odlegloscM } from '../app/geo.js';
import { uruchomMost, idPoNazwie } from './helpers/most.js';

const SRODEK = { lat: 52.2297, lon: 21.0122 };
const DANE = {
  drogi: [{ id: 1, punkty: [{ lat: 52.23, lon: 21.01 }, { lat: 52.231, lon: 21.011 }], tags: { highway: 'residential' } }],
  budynki: [],
  wykluczeniaObszarowe: [],
  poi: [],
  bariery: [],
  obszary: [{ name: 'Śródmieście', adminLevel: 9 }],
};

// ADR 0059: trybu nie ma ani we wpisie, ani w parametrach odczytu —
// dane są uniewersalne, a `promienM` po złożeniu = bucket.
const wpis = ({ promienM = 2000, srodek = SRODEK, zapisanoMs = Date.now() } = {}) => (
  zlozWpisSieci({ dane: DANE, srodek, promienM, terazMs: zapisanoMs })
);

const zapisz = (m, w) => JSON.parse(m.doPost({ postData: { contents: JSON.stringify({ akcja: 'siec-zapisz', wpis: w }) } }).tekst);
const czytaj = (m, { lat, lon, promienM }) => JSON.parse(m.doGet({
  parameter: { akcja: 'siec', lat: String(lat), lon: String(lon), promienM: String(promienM) },
}).tekst);

test('most-sieci: haversine mostu zgadza się z app/geo.js na siatce', () => {
  const { most } = uruchomMost();
  let porownan = 0;
  for (let lat = 50; lat <= 54; lat += 1) {
    for (let lon = 19; lon <= 23; lon += 1) {
      const a = { lat, lon };
      const b = { lat: lat + 0.03, lon: lon + 0.05 };
      const roznica = Math.abs(most.odlegloscMSiec(a, b) - odlegloscM(a, b));
      assert.ok(roznica < 0.001, `rozjazd haversine dla ${JSON.stringify(a)}: ${roznica} m`);
      porownan += 1;
    }
  }
  assert.ok(porownan > 20, `siatka ma sens (porównań: ${porownan})`);
});

test('most-sieci: zapis i odczyt wpisu (round-trip przez doPost/doGet)', () => {
  const { most: m, pliki } = uruchomMost();
  const odp = zapisz(m, wpis());
  assert.equal(odp.ok, true, `odpowiedź mostu: ${JSON.stringify(odp)}`);
  // ADR 0059: nazwa = geohash-6 + bucket (R=2000 → bucket 5000)
  assert.match(odp.nazwa, /^siec-[0-9a-z]{6}-5000\.json$/);
  const id = idPoNazwie(pliki, odp.nazwa);
  assert.ok(id, 'plik powstał na Drive');
  assert.equal([...pliki.get(id).rodzice][0].nazwa, 'okolica-sieci-cache');

  const odczyt = czytaj(m, { ...SRODEK, promienM: 1000 });
  assert.equal(odczyt.ok, true, 'węższa gra czyta wpis z szerszego pobrania');
  assert.deepEqual(odczyt.wpis.dane, DANE);
  assert.equal(odczyt.wpis.promienM, 5000, 'promień wpisu = bucket');
  assert.equal(odczyt.wpis.tryb, undefined, 'trybu we wpisie nie ma (ADR 0059)');
});

test('most-sieci: upsert — drugi zapis z tej komórki nadpisuje plik, nie mnoży', () => {
  const { most: m, pliki } = uruchomMost();
  const teraz = Date.now();
  const pierwszy = zapisz(m, wpis({ zapisanoMs: teraz - 1000 }));
  const drugi = zapisz(m, wpis({ promienM: 300, zapisanoMs: teraz })); // R=300 → ten sam bucket 5000? nie — bucket 1000
  assert.equal(pierwszy.ok, true);
  assert.equal(drugi.ok, true);
  assert.match(drugi.nazwa, /^siec-[0-9a-z]{6}-1000\.json$/, 'R=300 → bucket 1000 — inny plik niż bucket 5000');
  assert.equal(pliki.size, 2, 'dwie gry z dwóch bucketów tej samej komórki = dwa pliki');
  const odczyt = czytaj(m, { ...SRODEK, promienM: 300 });
  assert.equal(odczyt.wpis.zapisanoMs, teraz, 'nowy bucket czyta się świeży');
  // a ten sam bucket drugi raz nadpisuje (upsert nazwą)
  const trzeci = zapisz(m, wpis({ promienM: 800, zapisanoMs: teraz + 1 }));
  assert.equal(trzeci.nazwa, drugi.nazwa, 'ten sam bucket = ta sama nazwa pliku');
  assert.equal(pliki.size, 2, 'upsert nie mnoży plików');
});

test('most-sieci: odrzuty zapisu — zły schemat, brak dróg, zły promień, przeterminowany, za duży', () => {
  const { most: m } = uruchomMost();
  const dzien = 86_400_000;
  assert.match(zapisz(m, { ...wpis(), schemat: 'sieci/0' }).blad, /schemat/, 'obcy schemat');
  assert.match(zapisz(m, { ...wpis(), schemat: 'sieci/1' }).blad, /schemat/, 'stary schemat trybowy sieci/1 (ADR 0058: bez migratora)');
  assert.match(zapisz(m, { ...wpis(), dane: { ...DANE, drogi: [] } }).blad, /bez dróg/, 'wpis bez dróg');
  assert.match(zapisz(m, { ...wpis(), promienM: 30000 }).blad, /promień/, 'ponad 25000 m nie ma konfigu');
  assert.match(zapisz(m, wpis({ zapisanoMs: Date.now() - 31 * dzien })).blad, /przeterminowany/, '31 dni — po TTL');
  assert.equal(zapisz(m, wpis({ zapisanoMs: Date.now() - 29 * dzien })).ok, true, '29 dni — w TTL');
  const gruby = wpis();
  gruby.dane = { ...DANE, drogi: [{ ...DANE.drogi[0], tags: { smiec: 'x'.repeat(7_000_000) } }] };
  assert.match(zapisz(m, gruby).blad, /za duży/, 'wpis ponad 6 MB nie wchodzi');
});

test('most-sieci: odczyt wybiera najświeższy pokrywający; bucket grubszy i daleki dryf nie wchodzą', () => {
  const { most: m } = uruchomMost();
  const dzien = 86_400_000;
  const teraz = Date.now();
  // różne buckety = różne nazwy plików (upsertu nie ma między bucketami)
  zapisz(m, wpis({ promienM: 3000, zapisanoMs: teraz - 10 * dzien })); // bucket 5000, stary
  zapisz(m, wpis({ promienM: 8000, zapisanoMs: teraz - dzien })); // bucket 10000, świeży
  const odczyt = czytaj(m, { ...SRODEK, promienM: 1000 });
  assert.equal(odczyt.ok, true);
  assert.equal(odczyt.wpis.promienM, 10000, 'z dwóch pokrywających wygrywa świeższy, nie szerszy');
  assert.equal(czytaj(m, { ...SRODEK, promienM: 15000 }).ok, false, 'grubszy bucket (25000) nie wchodzi');
  // ~17 km na północ: d + 1150 > 11500 + 1400 + 1 — poza dyskiem każdego wpisu
  assert.equal(czytaj(m, { lat: 52.3822, lon: 21.0122, promienM: 1000 }).ok, false, 'daleki dryf nie wchodzi');
});

test('most-sieci: mnożnik pokrycia to 1.15 jak w aplikacji (parytet POLITYKA; ADR 0059: +1400 m = przekątna komórki)', () => {
  const { most: m } = uruchomMost();
  assert.equal(POLITYKA.mnoznikPromienia, 1.15, 'kotwica: aplikacja liczy bucket×1.15');
  assert.equal(POLITYKA.tolerancjaKotwicyM, 1400, 'tolerancja = przekątna komórki geohash6 (ADR 0059)');
  zapisz(m, wpis({ promienM: 2000 })); // bucket 5000: dysk 5750 m
  // Granica: dryf + 1150 ≤ 5750 + 1400 + 1 → dryf ≤ 6001 m.
  assert.equal(czytaj(m, { lat: 52.2747, lon: 21.0122, promienM: 1000 }).ok, true, '~5 km wchodzi (przekątna komórki + margines bucketu)');
  assert.equal(czytaj(m, { lat: 52.29, lon: 21.0122, promienM: 1000 }).ok, false, '~6,7 km nie wchodzi (poza dyskiem wpisu)');
});

test('most-sieci: śmieć w katalogu nie psuje odczytu', () => {
  const { most: m, pliki } = uruchomMost();
  const odp = zapisz(m, wpis());
  assert.equal(odp.ok, true);
  pliki.get(idPoNazwie(pliki, odp.nazwa)).tresc = 'to nie jest JSON {';
  assert.equal(czytaj(m, { ...SRODEK, promienM: 1000 }).ok, false, 'zepsuty plik to brak wpisu, nie wyjątek');
  // a po ponownym zapisie (upsert) odczyt wraca
  assert.equal(zapisz(m, wpis()).ok, true);
  assert.equal(czytaj(m, { ...SRODEK, promienM: 1000 }).ok, true);
});

test('most-sieci: złe parametry odczytu dają jawną odmowę', () => {
  const { most: m } = uruchomMost();
  zapisz(m, wpis());
  for (const zle of [
    { ...SRODEK, promienM: 0 },
    { ...SRODEK, promienM: -5 },
    { lat: 999, lon: 21.0122, promienM: 1000 },
  ]) {
    const odczyt = czytaj(m, zle);
    assert.equal(odczyt.ok, false, `odmowa dla ${JSON.stringify(zle)}`);
    assert.match(odczyt.blad, /parametry/);
  }
});
