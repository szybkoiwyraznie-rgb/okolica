/**
 * Testy geodezji i projekcji (app/geo.js) — czyste funkcje, bez DOM i sieci.
 * Wartość referencyjna geohash: klasyczny przykład z Wikipedii (57.64911,
 * 10.40744) → "u4pruydqqvj" — potwierdza poprawność implementacji.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bearingStopnie, czyDotarl, czyWspolrzedneOk, dopasujZoomDoPromienia, formatujWspolrzedne,
  geohash, metryNaPiksel, odlegloscM, odwroc, ogranicz, przesunPunkt, projektuj,
  progDojsciaM, punktyNaOkregu, siatkaKafelkow, wspolrzedneDoKafelka,
} from '../app/geo.js';

const WARSZAWA = { lat: 52.2297, lon: 21.0122 };
const KRAKOW = { lat: 50.0647, lon: 19.945 };

test('odlegloscM: Warszawa–Kraków to ~252 km w linii prostej', () => {
  const d = odlegloscM(WARSZAWA, KRAKOW);
  assert.ok(d > 250000 && d < 254000, `otrzymano ${d}`);
  assert.equal(odlegloscM(WARSZAWA, WARSZAWA), 0);
});

test('odlegloscM: symetria i rzut dla błądnych współrzędnych', () => {
  assert.ok(Math.abs(odlegloscM(WARSZAWA, KRAKOW) - odlegloscM(KRAKOW, WARSZAWA)) < 1e-6);
  assert.throws(() => odlegloscM({ lat: 999, lon: 0 }, WARSZAWA), TypeError);
  assert.throws(() => odlegloscM(WARSZAWA, null), TypeError);
});

test('czyWspolrzedneOk: granice i wartości absurdalne', () => {
  assert.ok(czyWspolrzedneOk(90, 180));
  assert.ok(czyWspolrzedneOk(-90, -180));
  assert.ok(!czyWspolrzedneOk(90.1, 0));
  assert.ok(!czyWspolrzedneOk(0, 180.5));
  assert.ok(!czyWspolrzedneOk(NaN, 21));
  assert.ok(!czyWspolrzedneOk(undefined, undefined));
});

test('bearingStopnie: północ 0°, wschód ~90°, południe ~180°', () => {
  assert.ok(Math.abs(bearingStopnie(WARSZAWA, { lat: 53, lon: 21.0122 })) < 0.5);
  const wschod = bearingStopnie(WARSZAWA, { lat: 52.2297, lon: 22 });
  assert.ok(wschod > 88 && wschod < 92, `otrzymano ${wschod}`);
  const poludnie = bearingStopnie(WARSZAWA, KRAKOW);
  assert.ok(poludnie > 190 && poludnie < 210, `otrzymano ${poludnie}`);
});

test('przesunPunkt: 1 km na wschód i z powrotem daje 1 km', () => {
  const p = przesunPunkt(WARSZAWA, 90, 1000);
  assert.ok(Math.abs(odlegloscM(WARSZAWA, p) - 1000) < 1);
  assert.ok(p.lon > WARSZAWA.lon);
  assert.ok(Math.abs(p.lat - WARSZAWA.lat) < 0.001);
});

test('punktyNaOkregu: n punktów w zadanej odległości i z rozstrzałem kątów', () => {
  const punkty = punktyNaOkregu(WARSZAWA, 500, 4);
  assert.equal(punkty.length, 4);
  for (const p of punkty) assert.ok(Math.abs(odlegloscM(WARSZAWA, p) - 500) < 1);
  const katy = punkty.map((p) => bearingStopnie(WARSZAWA, p));
  assert.ok(Math.abs(katy[0] - 0) < 0.5, `pierwszy punkt na północy, jest ${katy[0]}`);
  assert.ok(Math.abs(katy[1] - 90) < 0.5);
  assert.throws(() => punktyNaOkregu(WARSZAWA, 500, 0), TypeError);
});

test('projektuj/odwroc: pełne przejście w obie strony', () => {
  const { x, y } = projektuj(WARSZAWA.lat, WARSZAWA.lon);
  assert.ok(x > 0 && x < 3600 && y > 0 && y < 3600);
  const { lat, lon } = odwroc(x, y);
  assert.ok(Math.abs(lat - WARSZAWA.lat) < 1e-9);
  assert.ok(Math.abs(lon - WARSZAWA.lon) < 1e-9);
});

test('projektuj: równik i południk zerowy trafiają w środek świata', () => {
  const s = projektuj(0, 0);
  assert.ok(Math.abs(s.x - 1800) < 1e-6);
  assert.ok(Math.abs(s.y - 1800) < 1e-6);
});

test('metryNaPiksel: maleje z zoomem i z szerokością geograficzną', () => {
  assert.ok(Math.abs(metryNaPiksel(0, 0) - 156543.03) < 1);
  assert.ok(metryNaPiksel(52, 17) < metryNaPiksel(52, 16));
  assert.ok(metryNaPiksel(60, 10) < metryNaPiksel(0, 10));
});

test('dopasujZoomDoPromienia: 1 km/360 px → z14, 3 km → z12, 10 km → z10', () => {
  assert.equal(dopasujZoomDoPromienia(1000, 360, 52.23), 14);
  assert.equal(dopasujZoomDoPromienia(3000, 360, 52.23), 12);
  assert.equal(dopasujZoomDoPromienia(10000, 360, 52.23), 10);
  // większy ekran = głębszy zoom przy tym samym promieniu
  assert.ok(dopasujZoomDoPromienia(1000, 900, 52.23) > dopasujZoomDoPromienia(1000, 360, 52.23));
  assert.throws(() => dopasujZoomDoPromienia(0, 360, 52), TypeError);
});

test('wspolrzedneDoKafelka: kafelek 0/0/0 obejmuje cały świat', () => {
  assert.deepEqual(wspolrzedneDoKafelka(0, 0, 0), { x: 0.5, y: 0.5 });
  const k = wspolrzedneDoKafelka(WARSZAWA.lat, WARSZAWA.lon, 10);
  assert.ok(k.x > 571 && k.x < 572, `x=${k.x}`);
  assert.ok(k.y > 335 && k.y < 340, `y=${k.y}`);
});

test('siatkaKafelkow: indeksy w zakresie i zoom z skali widoku', () => {
  const s = siatkaKafelkow({ widok: { x: 0, y: 0, skala: 1 }, rozmiar: { szerokosc: 360, wysokosc: 640 }, maxZoom: 19 });
  assert.equal(s.z, 4, 'z = round(log2(skala × 3600 / 256))');
  assert.ok(s.tx0 >= 0 && s.tx1 < 2 ** s.z);
  assert.ok(s.ty0 >= 0 && s.ty1 < 2 ** s.z);
  const gleboko = siatkaKafelkow({ widok: { x: -1e6, y: -1e6, skala: 1e6 }, rozmiar: { szerokosc: 360, wysokosc: 640 }, maxZoom: 19 });
  assert.ok(gleboko.z <= 19);
});

test('geohash: wartość referencyjna z Wikipedii i stabilność prefiksów', () => {
  assert.equal(geohash(57.64911, 10.40744, 11), 'u4pruydqqvj');
  const warszawa6 = geohash(WARSZAWA.lat, WARSZAWA.lon, 6);
  assert.equal(warszawa6.length, 6);
  assert.equal(geohash(WARSZAWA.lat, WARSZAWA.lon, 5), warszawa6.slice(0, 5));
  // punkt 100 m dalej zwykle ma ten sam geohash-5 (4,9 × 4,9 km)
  const bliski = przesunPunkt(WARSZAWA, 45, 100);
  assert.equal(geohash(bliski.lat, bliski.lon, 5), geohash(WARSZAWA.lat, WARSZAWA.lon, 5));
  assert.throws(() => geohash(0, 0, 13), TypeError);
  assert.throws(() => geohash(999, 0, 5), TypeError);
});

test('progDojsciaM: podłoga 25 m, sufit 100 m, mnożnik 1,2 (ADR 0004 pkt 2)', () => {
  assert.equal(progDojsciaM(5), 25);
  assert.equal(progDojsciaM(10), 25);
  assert.equal(progDojsciaM(50), 60);
  assert.equal(progDojsciaM(200), 100);
  assert.equal(progDojsciaM(undefined), 100);
  assert.equal(progDojsciaM(50, { min: 10, max: 500, mnoznik: 2 }), 100);
});

test('czyDotarl: wymaga dwóch kolejnych trafień w progu', () => {
  const stacja = przesunPunkt(WARSZAWA, 0, 100); // 100 m na północ
  const blisko = przesunPunkt(WARSZAWA, 0, 90);
  const daleko = przesunPunkt(WARSZAWA, 0, 10);
  const fix = (p, accuracy = 20) => ({ lat: p.lat, lon: p.lon, accuracy });

  assert.equal(czyDotarl([fix(blisko)], stacja).dotarl, false, 'jeden fix to za mało');
  assert.equal(czyDotarl([fix(blisko), fix(blisko)], stacja).dotarl, true);
  assert.equal(czyDotarl([fix(daleko), fix(blisko)], stacja).dotarl, false, 'przerwana seria');
  assert.equal(czyDotarl([fix(daleko)], stacja).dotarl, false);
  assert.equal(czyDotarl([], stacja).dotarl, false);

  const wynik = czyDotarl([fix(blisko), fix(blisko)], stacja);
  assert.equal(wynik.progM, 25);
  assert.ok(Math.abs(wynik.dystansM - 10) < 2);
});

test('czyDotarl: duża niedokładność rozszerza próg do 1,2 × accuracy', () => {
  const stacja = WARSZAWA;
  const fix = przesunPunkt(WARSZAWA, 90, 55); // ~55 m od stacji
  assert.equal(czyDotarl([{ lat: fix.lat, lon: fix.lon, accuracy: 20 }, { lat: fix.lat, lon: fix.lon, accuracy: 20 }], stacja).dotarl, false);
  assert.equal(czyDotarl([{ lat: fix.lat, lon: fix.lon, accuracy: 60 }, { lat: fix.lat, lon: fix.lon, accuracy: 60 }], stacja).dotarl, true);
});

test('formatujWspolrzedne i ogranicz: format do promptu i zaciski', () => {
  assert.equal(formatujWspolrzedne(52.22967123, 21.01223456), '52.22967, 21.01223');
  assert.equal(formatujWspolrzedne(52.22967123, 21.01223456, 3), '52.230, 21.012');
  assert.equal(ogranicz(5, 1, 3), 3);
  assert.equal(ogranicz(-5, 1, 3), 1);
  assert.equal(ogranicz(2, 1, 3), 2);
});
