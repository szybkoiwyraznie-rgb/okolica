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
import { TRYBY } from '../app/konfig.js';
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

const wpis = ({ promienM = 2000, tryb = 'piesza', srodek = SRODEK, zapisanoMs = Date.now() } = {}) => (
  zlozWpisSieci({ dane: DANE, srodek, promienM, tryb, terazMs: zapisanoMs })
);

const zapisz = (m, w) => JSON.parse(m.doPost({ postData: { contents: JSON.stringify({ akcja: 'siec-zapisz', wpis: w }) } }).tekst);
const czytaj = (m, { lat, lon, promienM, tryb }) => JSON.parse(m.doGet({
  parameter: { akcja: 'siec', lat: String(lat), lon: String(lon), promienM: String(promienM), tryb },
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
  assert.match(odp.nazwa, /^siec-[0-9a-z]{6}-2000-piesza-52\.229700-21\.012200\.json$/);
  const id = idPoNazwie(pliki, odp.nazwa);
  assert.ok(id, 'plik powstał na Drive');
  assert.equal([...pliki.get(id).rodzice][0].nazwa, 'okolica-sieci-cache');

  const odczyt = czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'piesza' });
  assert.equal(odczyt.ok, true, 'węższy setup czyta wpis z szerszego pobrania');
  assert.deepEqual(odczyt.wpis.dane, DANE);
  assert.equal(odczyt.wpis.promienM, 2000);
});

test('most-sieci: upsert — drugi zapis z tego miejsca nadpisuje plik, nie mnoży', () => {
  const { most: m, pliki } = uruchomMost();
  const teraz = Date.now();
  const pierwszy = zapisz(m, wpis({ zapisanoMs: teraz - 1000 }));
  const drugi = zapisz(m, wpis({ zapisanoMs: teraz }));
  assert.equal(pierwszy.ok, true);
  assert.equal(drugi.ok, true);
  assert.equal(drugi.nazwa, pierwszy.nazwa, 'ta sama nazwa pliku');
  assert.equal(pliki.size, 1, 'jeden plik po dwóch zapisach');
  const odczyt = czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'piesza' });
  assert.equal(odczyt.wpis.zapisanoMs, teraz, 'plik niesie treść drugiego zapisu');
});

test('most-sieci: odrzuty zapisu — zły schemat, brak dróg, obcy tryb, przeterminowany, za duży', () => {
  const { most: m } = uruchomMost();
  const dzien = 86_400_000;
  assert.match(zapisz(m, { ...wpis(), schemat: 'sieci/0' }).blad, /schemat/, 'obcy schemat');
  assert.match(zapisz(m, { ...wpis(), dane: { ...DANE, drogi: [] } }).blad, /bez dróg/, 'wpis bez dróg');
  assert.match(zapisz(m, { ...wpis(), tryb: 'kosmos' }).blad, /tryb/, 'obcy tryb');
  assert.match(zapisz(m, wpis({ zapisanoMs: Date.now() - 31 * dzien })).blad, /przeterminowany/, '31 dni — po TTL');
  assert.equal(zapisz(m, wpis({ zapisanoMs: Date.now() - 29 * dzien })).ok, true, '29 dni — w TTL');
  const gruby = wpis();
  gruby.dane = { ...DANE, drogi: [{ ...DANE.drogi[0], tags: { smiec: 'x'.repeat(7_000_000) } }] };
  assert.match(zapisz(m, gruby).blad, /za duży/, 'wpis ponad 6 MB nie wchodzi');
});

test('most-sieci: tryby aplikacji wchodzą wszystkie (parytet TRYBY)', () => {
  const { most: m } = uruchomMost();
  for (const tryb of Object.keys(TRYBY)) {
    assert.equal(zapisz(m, wpis({ tryb })).ok, true, `tryb ${tryb} zapisany`);
    assert.equal(czytaj(m, { ...SRODEK, promienM: 1000, tryb }).ok, true, `tryb ${tryb} odczytany`);
  }
});

test('most-sieci: odczyt wybiera najświeższy pokrywający; za szeroki setup i dryf nie wchodzą', () => {
  const { most: m } = uruchomMost();
  const dzien = 86_400_000;
  const teraz = Date.now();
  // ten sam środek, różne promienie i czasy — nazwy plików różne, więc nie robią upsertu
  zapisz(m, wpis({ promienM: 3000, zapisanoMs: teraz - 10 * dzien }));
  zapisz(m, wpis({ promienM: 2000, zapisanoMs: teraz - dzien }));
  const odczyt = czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'piesza' });
  assert.equal(odczyt.ok, true);
  assert.equal(odczyt.wpis.promienM, 2000, 'z dwóch pokrywających wygrywa świeższy, nie szerszy');
  assert.equal(czytaj(m, { ...SRODEK, promienM: 5000, tryb: 'piesza' }).ok, false, 'szerszy setup nie wchodzi');
  assert.equal(czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'rower' }).ok, false, 'obcy tryb nie czyta');
  // ~2 km na północ przy R=1000: 2000 + 1150 > 3450? nie — liczy się NAJLEPSZY wpis (R=3000):
  // 2000 + 1150 = 3150 ≤ 3450, więc wchodzi; dopiero ~3 km nie wchodzi do żadnego
  assert.equal(czytaj(m, { lat: 52.2597, lon: 21.0122, promienM: 1000, tryb: 'piesza' }).ok, false, 'daleki dryf nie wchodzi');
});

test('most-sieci: mnożnik pokrycia to 1.15 jak w aplikacji (parytet POLITYKA; aneks 2026-09-17: +200 m tolerancji)', () => {
  const { most: m } = uruchomMost();
  assert.equal(POLITYKA.mnoznikPromienia, 1.15, 'kotwica: aplikacja liczy R×1.15');
  assert.equal(POLITYKA.tolerancjaKotwicyM, 200, 'tolerancja ±200 m (teren 2026-09-17)');
  zapisz(m, wpis({ promienM: 2000 }));
  // Granica: dryf + 1150 ≤ 2300 + 200 + 1 → dryf ≤ 1351 m.
  assert.equal(czytaj(m, { lat: 52.2400, lon: 21.0122, promienM: 1000, tryb: 'piesza' }).ok, true, '~1150 m wchodzi');
  assert.equal(czytaj(m, { lat: 52.2420, lon: 21.0122, promienM: 1000, tryb: 'piesza' }).ok, false, '~1400 m nie wchodzi (poza tolerancją)');
});

test('most-sieci: śmieć w katalogu nie psuje odczytu', () => {
  const { most: m, pliki } = uruchomMost();
  const odp = zapisz(m, wpis());
  assert.equal(odp.ok, true);
  pliki.get(idPoNazwie(pliki, odp.nazwa)).tresc = 'to nie jest JSON {';
  assert.equal(czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'piesza' }).ok, false, 'zepsuty plik to brak wpisu, nie wyjątek');
  // a po ponownym zapisie (upsert) odczyt wraca
  assert.equal(zapisz(m, wpis()).ok, true);
  assert.equal(czytaj(m, { ...SRODEK, promienM: 1000, tryb: 'piesza' }).ok, true);
});

test('most-sieci: złe parametry odczytu dają jawną odmowę', () => {
  const { most: m } = uruchomMost();
  zapisz(m, wpis());
  for (const zle of [
    { ...SRODEK, promienM: 1000, tryb: 'kosmos' },
    { ...SRODEK, promienM: 0, tryb: 'piesza' },
    { ...SRODEK, promienM: -5, tryb: 'piesza' },
    { lat: 999, lon: 21.0122, promienM: 1000, tryb: 'piesza' },
  ]) {
    const odczyt = czytaj(m, zle);
    assert.equal(odczyt.ok, false, `odmowa dla ${JSON.stringify(zle)}`);
    assert.match(odczyt.blad, /parametry/);
  }
});
