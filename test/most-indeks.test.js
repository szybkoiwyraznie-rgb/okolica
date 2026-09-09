/**
 * Most Drive: indeks paczek i kotwica dopasowania okolicy (B19, ADR 0024 pkt 4).
 *
 * Skrypt `docs/setup/apps-script-repo-paczek.gs` działa poza tym repozytorium
 * (Google Apps Script, brak modułów ESM), ale jego koder geohash jest KOPIĄ
 * `geohash()` z `app/geo.js` — a kopia bez testu rozjeżdża się po cichu i wtedy
 * paczki znikają z ekranu 2. Dlatego testy poniżej wykonują CAŁY skrypt z atrapą
 * Drive (`test/helpers/most.js`) i porównują wyniki z implementacją aplikacji na
 * siatce współrzędnych. Zmiana którejkolwiek strony bez drugiej = czerwono.
 *
 * Wcześniej te testy wycinały z pliku sam koder — przechodziły nawet wtedy, gdy
 * reszta skryptu nie dawała się uruchomić (LESSONS L33).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { geohash } from '../app/geo.js';
import { dopasujZestawy, walidujIndeksSurowy } from '../app/zestawy.js';
import { uruchomMost, zestawPrzykladowy, idPoNazwie } from './helpers/most.js';

const { most } = uruchomMost();
const { geohashPunkt, kotwicaZestawu } = most;

test('koder geohash w moście Drive daje te same komórki co app/geo.js', () => {
  let porownan = 0;
  for (let lat = -85; lat <= 85; lat += 5) {
    for (let lon = -175; lon <= 175; lon += 7) {
      for (const precyzja of [5, 6]) {
        assert.equal(
          geohashPunkt(lat, lon, precyzja),
          geohash(lat, lon, precyzja),
          `rozjazd kodera dla (${lat}, ${lon}) przy precyzji ${precyzja}`,
        );
        porownan += 1;
      }
    }
  }
  assert.ok(porownan > 500, `siatka ma sens (porównań: ${porownan})`);

  // punkt z prawdziwego zgłoszenia właściciela (Podkowa Leśna, start ul. Bukowa 22)
  assert.equal(geohashPunkt(52.1141, 20.6622, 6), geohash(52.1141, 20.6622, 6));
  assert.equal(geohashPunkt(52.1141, 20.6622, 5), 'u3q8q', 'geohash5 startu w Podkowie (52.1141, 20.6622)');
});

test('koder mostu nie rzuca wyjątkiem na śmieciach — indeks nie może paść przez jeden wpis', () => {
  assert.equal(geohashPunkt(NaN, 20, 6), '', 'NaN → pusty geohash');
  assert.equal(geohashPunkt(200, 20, 6), '', 'szerokość poza zakresem → pusty geohash');
  assert.equal(geohashPunkt(undefined, undefined, 6), '', 'brak współrzędnych → pusty geohash');
});

test('kotwicaZestawu: nowa paczka ma kotwicę dokładną, stara — szacowaną ze stacji', () => {
  const dokladna = kotwicaZestawu({
    meta: { geohash5: 'u3q8w', geohash6: 'u3q8w0' },
    stacje: [{ lat: 52.9, lon: 20.9 }], // stacje NIE mogą przesłonić meta.geohash6
  });
  assert.deepEqual(dokladna, { geohash6: 'u3q8w0', szacowany: false });

  const stacje = [
    { lat: 52.1140, lon: 20.6620 },
    { lat: 52.1142, lon: 20.6624 },
    { lat: 52.1138, lon: 20.6626 },
  ];
  const srodek = {
    lat: stacje.reduce((a, s) => a + s.lat, 0) / stacje.length,
    lon: stacje.reduce((a, s) => a + s.lon, 0) / stacje.length,
  };
  const szacowana = kotwicaZestawu({ meta: { geohash5: 'u3q8w' }, stacje });
  assert.deepEqual(szacowana, { geohash6: geohash(srodek.lat, srodek.lon, 6), szacowany: true });
  assert.notEqual(szacowana.geohash6, undefined);

  // wpis bez stacji i bez geohash6 nie dostaje kotwicy — dopasowanie zostaje zgrubne
  assert.equal(kotwicaZestawu({ meta: { geohash5: 'u3q8w' }, stacje: [] }), null);
  assert.equal(kotwicaZestawu({ meta: { geohash5: 'u3q8w' } }), null);
  // stacje bez współrzędnych są pomijane, nie psują średniej
  assert.deepEqual(
    kotwicaZestawu({ meta: {}, stacje: [{ lat: 52.1, lon: 20.6 }, { lat: 'x' }, null] }),
    { geohash6: geohash(52.1, 20.6, 6), szacowany: true },
  );
});

test('most: indeks sam liczy kotwicę ze stacji, gdy paczka nie ma geohash6 (B19)', () => {
  const { most: mostSwiezy, pliki } = uruchomMost();
  const zestaw = zestawPrzykladowy({ bezKotwicy: true });
  assert.equal(zestaw.meta.geohash6, undefined, 'fixture bez kotwicy — jak paczka sprzed B19');

  const przyjeta = mostSwiezy.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie do przeglądu: ${JSON.stringify(przyjeta)}`);
  assert.equal(mostSwiezy.zatwierdz(idPoNazwie(pliki, przyjeta.nazwa)), 'zaakceptowano');

  const indeks = walidujIndeksSurowy(JSON.stringify(mostSwiezy.budujIndeks()));
  assert.deepEqual(indeks.usterki, [], 'indeks bez usterek');
  assert.equal(indeks.indeks.length, 1, 'zaakceptowana paczka jest w indeksie');

  const srednia = {
    lat: zestaw.stacje.reduce((a, s) => a + s.lat, 0) / zestaw.stacje.length,
    lon: zestaw.stacje.reduce((a, s) => a + s.lon, 0) / zestaw.stacje.length,
  };
  const wpis = indeks.indeks[0];
  assert.equal(wpis.geohash6, geohash(srednia.lat, srednia.lon, 6), 'kotwica oszacowana ze środka stacji');
  assert.equal(wpis.geohash6Szacowany, true, 'wpis mówi, że kotwica jest szacowana');
});

/* ---- Klient: jak tolerancja czyta kotwicę szacowaną (app/zestawy.js) ---- */

const START = { lat: 52.1141, lon: 20.6622 };
const STACJE = [
  { id: 's1', lat: 52.1130, lon: 20.6610 },
  { id: 's2', lat: 52.1152, lon: 20.6634 },
  { id: 's3', lat: 52.1124, lon: 20.6646 },
];
const SRODEK = {
  lat: STACJE.reduce((a, s) => a + s.lat, 0) / STACJE.length,
  lon: STACJE.reduce((a, s) => a + s.lon, 0) / STACJE.length,
};

const wpis = (nad) => ({
  skrot: 'podkowa',
  geohash5: geohash(START.lat, START.lon, 5),
  promienM: 1000,
  tematy: ['historia'],
  wiek: 'dorosli',
  liczbaStacji: 5,
  pytaniaNaStacje: 1,
  licencja: 'CC BY 4.0',
  data: '2026-09-07 10:00',
  ...nad,
});

const kryteria = (punkt) => ({
  geohash5: geohash(punkt.lat, punkt.lon, 5),
  lat: punkt.lat,
  lon: punkt.lon,
  promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia'], wiek: 'dorosli',
});

test('B19: stara paczka z kotwicą szacowaną dalej pasuje do tego samego startu', () => {
  const szacowany = wpis({
    geohash6: geohash(SRODEK.lat, SRODEK.lon, 6),
    geohash6Szacowany: true,
  });
  const trafione = dopasujZestawy([szacowany], kryteria(START));
  assert.deepEqual(trafione.map((w) => w.skrot), ['podkowa'], 'kotwica ze stacji nie gubi paczki właściciela');
});

test('B19: paczka 3 km dalej przestaje się pokazywać, gdy ma kotwicę geohash6', () => {
  const daleko = { lat: 52.1411, lon: 20.6622 }; // ~3,0 km na północ od startu paczki
  const kotwicaDaleko = geohash(daleko.lat, daleko.lon, 6);

  // przed B19: wpis legacy bez geohash6 — geohash5 jest tak gruby, że 3 km łapie
  const przedB19 = dopasujZestawy([wpis({})], kryteria(START));
  assert.deepEqual(przedB19.map((w) => w.skrot), ['podkowa'], 'test ma sens: bez geohash6 paczka 3 km dalej SIĘ pokazuje');

  // po B19: ten sam wpis z kotwicą szacowaną — nadmiarowe dopasowanie znika
  const poB19 = dopasujZestawy(
    [wpis({ geohash6: kotwicaDaleko, geohash6Szacowany: true })],
    kryteria(START),
  );
  assert.deepEqual(poB19, [], 'kotwica geohash6 + tolerancja (200 m + promienM) odrzuca 3 km');
});

test('B19: kotwica dokładna NIE dostaje poszerzenia o promień paczki', () => {
  const daleko = { lat: 52.1411, lon: 20.6622 };
  const dokladnaDaleko = wpis({ geohash6: geohash(daleko.lat, daleko.lon, 6), geohash6Szacowany: false });
  assert.deepEqual(dopasujZestawy([dokladnaDaleko], kryteria(START)), [], 'dokładna kotwica ma tylko 200 m');

  const bezZnacznika = wpis({ geohash6: geohash(daleko.lat, daleko.lon, 6) });
  assert.deepEqual(dopasujZestawy([bezZnacznika], kryteria(START)), [], 'brak znacznika = kotwica dokładna (domyślnie)');
});
