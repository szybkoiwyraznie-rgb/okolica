/**
 * Testy geodezji i projekcji (app/geo.js) — czyste funkcje, bez DOM i sieci.
 * Wartość referencyjna geohash: klasyczny przykład z Wikipedii (57.64911,
 * 10.40744) → "u4pruydqqvj" — potwierdza poprawność implementacji.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bearingStopnie, czyDotarl, czyWspolrzedneOk, dopasujZoomDoPromienia, formatujWspolrzedne,
  geohash, KOMUNIKATY_WSPOLRZEDNYCH, metryNaPiksel, odlegloscM, odwroc, ogranicz,
  parsujWspolrzedne, przesunPunkt, projektuj,
  progDojsciaM, punktyNaOkregu, ramkaGeohash, odlegloscDoKomorkiM, sasiednieGeohash,
  siatkaKafelkow, wspolrzedneDoKafelka,
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

test('progDojsciaM: stałe 25 m niezależnie od dokładności (ADR 0004 pkt 2 po aneksie)', () => {
  // Decyzja właściciela 2026-09-09: „Większy próg zaliczenia niż 25m nie ma
  // sensu (…) nie powinniśmy zezwalać na zaliczenie ze 100m. To zupełnie inne
  // miejsce." Dokładność fixu nie rozluźnia już progu — słaby sygnał daje
  // ostrzeżenie P05 i przycisk „jestem na miejscu", nie cichą taryfę ulgową.
  for (const accuracy of [3, 5, 10, 20, 50, 100, 200, 1000]) {
    assert.equal(progDojsciaM(accuracy), 25, `accuracy ${accuracy} m nie zmienia progu`);
  }
  assert.equal(progDojsciaM(undefined), 25, 'brak dokładności też daje 25 m');
  assert.equal(progDojsciaM(null), 25);
  assert.equal(progDojsciaM(0), 25, 'zero i wartości bez sensu nie rozszerzają progu');
  assert.equal(progDojsciaM(-5), 25);
  assert.equal(progDojsciaM(50, { prog: 40 }), 40, 'próg zostaje parametrem (przyszłe polityki)');
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

test('czyDotarl: duża niedokładność NIE rozszerza progu (regresja 2026-09-09)', () => {
  const stacja = WARSZAWA;
  const fix = przesunPunkt(WARSZAWA, 90, 55); // ~55 m od stacji — poza progiem 25 m
  const para = (accuracy) => [
    { lat: fix.lat, lon: fix.lon, accuracy },
    { lat: fix.lat, lon: fix.lon, accuracy },
  ];
  assert.equal(czyDotarl(para(20), stacja).dotarl, false, '55 m to za daleko przy dobrym sygnale');
  assert.equal(czyDotarl(para(60), stacja).dotarl, false, 'i tak samo za daleko przy słabym — 55 m to inne miejsce');
  assert.equal(czyDotarl(para(200), stacja).dotarl, false, 'nawet skrajnie słaby fix nie zalicza z 55 m');
  assert.equal(czyDotarl(para(200), stacja).progM, 25, 'próg raportowany graczowi zostaje 25 m');

  // Blisko stacji zalicza się niezależnie od zgłoszonej dokładności: sam fix
  // bywa dobry mimo pesymistycznego `accuracy` (ocenFix go nie odrzuca).
  const przy = przesunPunkt(WARSZAWA, 90, 15);
  const paraPrzy = [{ lat: przy.lat, lon: przy.lon, accuracy: 200 }, { lat: przy.lat, lon: przy.lon, accuracy: 200 }];
  assert.equal(czyDotarl(paraPrzy, stacja).dotarl, true, '15 m od stacji to dojście');
});

test('formatujWspolrzedne i ogranicz: format do promptu i zaciski', () => {
  assert.equal(formatujWspolrzedne(52.22967123, 21.01223456), '52.22967, 21.01223');
  assert.equal(formatujWspolrzedne(52.22967123, 21.01223456, 3), '52.230, 21.012');
  assert.equal(ogranicz(5, 1, 3), 3);
  assert.equal(ogranicz(-5, 1, 3), 1);
  assert.equal(ogranicz(2, 1, 3), 2);
});

/* ---------------- parsowanie współrzędnych z pól (zadanie właściciela D2) */

test('parsujWspolrzedne: para DMS z Google Maps w jednym polu (przykład właściciela)', () => {
  // Podkowa Leśna, ul. Bukowa 22 — oczekiwania LICZONE z definicji DMS (L24),
  // żadnych "52.12303" z głowy
  const oczLat = 52 + 7 / 60 + 22.9 / 3600;
  const oczLon = 20 + 44 / 60 + 46.1 / 3600;
  const w = parsujWspolrzedne('52°07\'22.9"N 20°44\'46.1"E', '');
  assert.equal(w.ok, true, w.komunikat ?? '');
  assert.ok(Math.abs(w.lat - oczLat) < 1e-9, `lat: ${w.lat} vs ${oczLat}`);
  assert.ok(Math.abs(w.lon - oczLon) < 1e-9, `lon: ${w.lon} vs ${oczLon}`);
  assert.equal(w.zPary, true);
  assert.equal(w.format, 'para-dms');
  // pułapka z diagnozy: złączenie cyfr DMS to INNY punkt — parser nie może
  // "poprawiać" 52.07229 w 52.12303; dziesiętne wchodzą jak są wpisane
  const pułapka = parsujWspolrzedne('52.07229', '20.44461');
  assert.equal(pułapka.ok, true);
  assert.equal(pułapka.lat, 52.07229, 'dziesiętne są czytane dosłownie');
});

test('parsujWspolrzedne: warianty pary DMS — kolejność E-first, separatory, unicode', () => {
  const oczLat = 52 + 7 / 60 + 22.9 / 3600;
  const oczLon = 20 + 44 / 60 + 46.1 / 3600;
  const warianty = [
    '20°44\'46.1"E 52°07\'22.9"N',        // kolejność odwrotna (E pierwsze)
    '52°07\'22.9"N, 20°44\'46.1"E',       // przecinek + spacja
    '52°7′22.9″N 20°44′46.1″E',             // primy unicode, bez zer wiodących
    '52 7 22.9 N 20 44 46.1 E',             // gołe liczby ze spacjami
    '52°07\'22,9"N 20°44\'46,1"E',        // polski przecinek w sekundach
  ];
  for (const tekst of warianty) {
    const w = parsujWspolrzedne(tekst, '');
    assert.equal(w.ok, true, `odrzucony wariant: ${tekst} — ${w.komunikat ?? ''}`);
    assert.ok(Math.abs(w.lat - oczLat) < 1e-9, `lat dla "${tekst}": ${w.lat}`);
    assert.ok(Math.abs(w.lon - oczLon) < 1e-9, `lon dla "${tekst}": ${w.lon}`);
    assert.equal(w.format, 'para-dms');
  }
});

test('parsujWspolrzedne: pary dziesiętne i polski przecinek', () => {
  const p1 = parsujWspolrzedne('52.123028, 20.746139', '');
  assert.equal(p1.ok, true);
  assert.equal(p1.lat, 52.123028);
  assert.equal(p1.lon, 20.746139);
  assert.equal(p1.format, 'para-dziesietna');

  const p2 = parsujWspolrzedne('52.2297 21.0122', '');
  assert.equal(p2.ok, true, 'para po spacji');

  const p3 = parsujWspolrzedne('52,2297 21,0122', '');
  assert.equal(p3.ok, true, 'polski przecinek dziesiętny + spacja jako separator');
  assert.equal(p3.lat, 52.2297);
  assert.equal(p3.lon, 21.0122);

  // SAM przecinek bez spacji NIE jest separatorem pary: '52,123' to jedna
  // liczba po polsku; dwuznaczne '52.123,20.746' jest jawnie odrzucone
  const jedna = parsujWspolrzedne('52,123', '');
  assert.equal(jedna.ok, false);
  assert.equal(jedna.powod, 'brak-lon', '52,123 = 52.123 (lat), brak lon — nie para (52;123)');
  const dwuznaczna = parsujWspolrzedne('52.123,20.746', '');
  assert.equal(dwuznaczna.ok, false);
  assert.equal(dwuznaczna.powod, 'format');
});

test('parsujWspolrzedne: składniki w osobnych polach (dziesiętne i DMS)', () => {
  const dz = parsujWspolrzedne('52.23178', '21.01234');
  assert.equal(dz.ok, true);
  assert.equal(dz.lat, 52.23178);
  assert.equal(dz.lon, 21.01234);
  assert.equal(dz.zPary, false);
  assert.equal(dz.format, 'dziesietne');

  const przecinek = parsujWspolrzedne('52,23178', '21,01234');
  assert.equal(przecinek.ok, true, 'polski przecinek w osobnych polach');
  assert.equal(przecinek.lat, 52.23178);

  const dms = parsujWspolrzedne('52°07\'22.9"N', '20°44\'46.1"E');
  assert.equal(dms.ok, true);
  assert.ok(Math.abs(dms.lat - (52 + 7 / 60 + 22.9 / 3600)) < 1e-9);
  assert.equal(dms.format, 'dms');

  const poludnie = parsujWspolrzedne('33°51\'35.9"S', '151°12\'40.0"E');
  assert.equal(poludnie.ok, true);
  assert.ok(poludnie.lat < 0, 'S daje ujemną szerokość');
  assert.ok(Math.abs(poludnie.lat + (33 + 51 / 60 + 35.9 / 3600)) < 1e-9);

  const zachod = parsujWspolrzedne('40.7128', '74°0\'21.1"W');
  assert.equal(zachod.ok, true);
  assert.ok(zachod.lon < 0, 'W daje ujemną długość');
  assert.ok(Math.abs(zachod.lon + (74 + 0 / 60 + 21.1 / 3600)) < 1e-9);

  const ujemne = parsujWspolrzedne('-52.123', '-20.746');
  assert.equal(ujemne.ok, true, 'minus dziesiętny bez liter');
  assert.equal(ujemne.lat, -52.123);
});

test('parsujWspolrzedne: odmowy są jawne i z komunikatem (nigdy cicho)', () => {
  const puste = parsujWspolrzedne('', '');
  assert.equal(puste.ok, false);
  assert.equal(puste.powod, 'puste');
  assert.equal(puste.komunikat, KOMUNIKATY_WSPOLRZEDNYCH.puste);
  assert.match(puste.komunikat, /^Wpisz obie współrzędne/, 'istniejący test UI łapie ten początek');

  const brakLon = parsujWspolrzedne('52.23178', '');
  assert.equal(brakLon.ok, false);
  assert.equal(brakLon.powod, 'brak-lon');

  const brakLat = parsujWspolrzedne('', '21.01234');
  assert.equal(brakLat.ok, false);
  assert.equal(brakLat.powod, 'brak-lat');

  const minuty = parsujWspolrzedne('52°75\'00"N', '');
  assert.equal(minuty.ok, false);
  assert.equal(minuty.powod, 'minuty', '75 minut to błąd zapisu, nie ciche 53°15\'');

  const sekundy = parsujWspolrzedne('52°07\'75"N 20°44\'46"E', '');
  assert.equal(sekundy.ok, false);
  assert.equal(sekundy.powod, 'minuty');

  const smieci = parsujWspolrzedne('Podkowa Leśna', '');
  assert.equal(smieci.ok, false);
  assert.equal(smieci.powod, 'format');

  const konflikt = parsujWspolrzedne('52°07\'22.9"N 20°44\'46.1"E', '21.0122');
  assert.equal(konflikt.ok, false);
  assert.equal(konflikt.powod, 'konflikt', 'para w pierwszym polu + wypełnione drugie = jawny konflikt');

  const osi = parsujWspolrzedne('20°44\'46.1"E', '');
  assert.equal(osi.ok, false);
  assert.equal(osi.powod, 'os', 'litera E w polu szerokości — pomyłkę pokazujemy, nie zgadujemy');

  const dwieOsi = parsujWspolrzedne('52°07\'22.9"N 51°00\'00"N', '');
  assert.equal(dwieOsi.ok, false);
  assert.equal(dwieOsi.powod, 'os', 'para z dwóch szerokości nie ma osi długości');

  const trzyLiczby = parsujWspolrzedne('52.1 20.7 14.3', '');
  assert.equal(trzyLiczby.ok, false, 'trzy liczby to nie para');
});

test('parsujWspolrzedne: round-trip z formatujWspolrzedne', () => {
  const sformatowane = formatujWspolrzedne(52.2297, 21.0122);
  const zPowrotem = parsujWspolrzedne(sformatowane, '');
  assert.equal(zPowrotem.ok, true);
  assert.equal(zPowrotem.lat, 52.2297);
  assert.equal(zPowrotem.lon, 21.0122);
});

/* ------ ADR 0024: odległość punktu od komórki geohash ------ */

test('odlegloscDoKomorkiM: 0 w środku komórki, dodatnia na zewnątrz, null dla śmieci', () => {
  const p = { lat: 52.1141, lon: 20.6622 };
  const gh = geohash(p.lat, p.lon, 6);
  assert.equal(odlegloscDoKomorkiM(gh, p.lat, p.lon), 0, 'punkt w komórce = 0');

  const r = ramkaGeohash(gh);
  const poza = przesunPunkt({ lat: r.latMax, lon: (r.lonMin + r.lonMax) / 2 }, 0, 500);
  const d = odlegloscDoKomorkiM(gh, poza.lat, poza.lon);
  assert.ok(d > 400 && d < 600, `~500 m od krawędzi (wyszło ${d.toFixed(0)} m)`);

  assert.equal(odlegloscDoKomorkiM('u3q!8', p.lat, p.lon), null, 'śmieciowy geohash = null, nie 0');
  assert.equal(odlegloscDoKomorkiM(gh, 91, 0), null, 'zła szerokość = null');
});

test('ramkaGeohash i sasiednieGeohash są osiągalne z obu modułów (przeniesione do geo.js)', async () => {
  const w = await import('../app/wieloosobowa.js');
  assert.equal(typeof w.ramkaGeohash, 'function', 're-eksport z wieloosobowa.js działa');
  assert.equal(typeof w.sasiednieGeohash, 'function');
  // Nie porównujemy tożsamości funkcji: w node `../app/geo.js` i `./geo.js?v=…`
  // to dwie instancje modułu (przeglądarka widzi jeden URL). Liczy się wynik.
  assert.deepEqual(w.ramkaGeohash('u3q8q'), ramkaGeohash('u3q8q'), 'ramka ta sama z obu ścieżek');
  assert.deepEqual(w.sasiednieGeohash('u3q8q'), sasiednieGeohash('u3q8q'), 'sąsiedzi ci sami');
  assert.equal(sasiednieGeohash('u3q8q').length, 8, 'sąsiedzi dalej się liczą');
});
