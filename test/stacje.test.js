/**
 * Testy wyboru stacji (app/stacje.js). W M0 działa tryb uproszczony
 * (pierścień); od M4 dochodzi sieć drogowa z Overpass — te testy pilnują
 * części wspólnej: determinizmu, miary sprawiedliwości i odstępów.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ZRODLA_STACJI, dystanseOdcinkowM, kolejnoscTrasy, najmniejszyOdstepM, optymalnaKolejnosc, stacjeProste, uporzadkujGre, uzupelnijOdleglosci } from '../app/stacje.js';
import { odlegloscM, przesunPunkt } from '../app/geo.js';

const WARSZAWA = { lat: 52.2297, lon: 21.0122 };
const ZIARNO = 'okolica:52.22970:21.01220:1000:5:2026-09-05';

test('stacjeProste: liczba, identyfikatory i oznaczenie źródła układu', () => {
  const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  assert.equal(stacje.length, 5);
  assert.deepEqual(stacje.map((s) => s.id), [1, 2, 3, 4, 5]);
  for (const s of stacje) {
    assert.equal(s.zrodlo, 'pierscien');
    assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lon));
    assert.ok(s.odlegloscM > 0 && s.bearing >= 0 && s.bearing < 360);
  }
  assert.ok(ZRODLA_STACJI.pierscien.includes('niezweryfikowana'), 'UI musi mówić wprost, że tryb uproszczony nie gwarantuje osiągalności');
});

test('stacjeProste: stacje leżą w pierścieniu 0,65–0,85 promienia gry', () => {
  for (const promienM of [500, 1000, 3000, 10000]) {
    const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 6, promienM, ziarno: ZIARNO });
    for (const s of stacje) {
      const d = odlegloscM(WARSZAWA, s);
      assert.ok(d >= promienM * 0.65 - 2, `${d} < ${promienM * 0.65}`);
      assert.ok(d <= promienM * 0.85 + 2, `${d} > ${promienM * 0.85}`);
    }
  }
});

test('stacjeProste: rozkład kątowy — żadna para stacji nie leży w tym samym kierunku', () => {
  const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  const katy = stacje.map((s) => s.bearing).sort((a, b) => a - b);
  for (let i = 1; i < katy.length; i++) {
    assert.ok(katy[i] - katy[i - 1] > 360 / 5 / 3, `zbyt mała separacja: ${katy[i - 1]}° i ${katy[i]}°`);
  }
});

test('stacjeProste: determinizm pod ziarnem i zmienność przy innym ziarnie', () => {
  const a = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  const b = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  const c = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: `${ZIARNO}|1` });
  assert.deepEqual(a, b, 'to samo ziarno musi dawać ten sam układ (ADR 0005 pkt 6)');
  assert.notDeepEqual(a, c, 'inne ziarno = inny układ');
});

test('stacjeProste: offsetObrotu obraca układ, nie zmieniając jego jakości', () => {
  const bazowy = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO, offsetObrotu: 0 });
  const obrot = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO, offsetObrotu: 36 });
  assert.notDeepEqual(bazowy, obrot);
  const odl = obrot.map((st) => st.odlegloscM);
  const rozrzut = (Math.max(...odl) - Math.min(...odl)) / (odl.reduce((a, b) => a + b, 0) / odl.length);
  assert.ok(rozrzut < 0.5, `obrót nie rozwala pierścienia (rozrzut ${Math.round(rozrzut * 100)}%)`);
});

test('stacjeProste: odrzuca bezsensowne argumenty', () => {
  assert.throws(() => stacjeProste({ srodek: null, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO }), TypeError);
  assert.throws(() => stacjeProste({ srodek: WARSZAWA, liczbaStacji: 0, promienM: 1000, ziarno: ZIARNO }), TypeError);
  assert.throws(() => stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 0, ziarno: ZIARNO }), TypeError);
});

test('najmniejszyOdstepM i uzupelnijOdleglosci: geometria układu dla UI', () => {
  const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  const odstep = najmniejszyOdstepM(stacje);
  assert.ok(odstep > 300, `stacje zbyt blisko siebie: ${odstep} m`);
  assert.equal(najmniejszyOdstepM([]), 0);

  const reczne = uzupelnijOdleglosci([{ id: 1, lat: 52.235, lon: 21.02 }, { id: 2, lat: 52.22, lon: 21.0 }], WARSZAWA);
  assert.ok(reczne[0].odlegloscM > 0 && reczne[1].odlegloscM > 0);
  assert.ok(reczne[0].bearing >= 0 && reczne[0].bearing < 360);
});

test('dystanseOdcinkowM: start→s1 z pola stacji, reszta z macierzy (ADR 0014 pkt 1)', () => {
  const wynik = {
    stacje: [{ id: 1, dystansSieciowyM: 812 }, { id: 2, dystansSieciowyM: 640 }, { id: 3, dystansSieciowyM: 905 }],
    macierz: [[0, 410, 700], [410, 0, null], [700, null, 0]],
  };
  assert.deepEqual(dystanseOdcinkowM(wynik), [812, 410, null], 'null = para nieosiągalna (fallback do prostej w rozgrywce)');
  assert.equal(dystanseOdcinkowM(null), null, 'brak wyniku sieciowego');
  assert.equal(dystanseOdcinkowM({}), null, 'pusty wynik');
  assert.deepEqual(
    dystanseOdcinkowM({ stacje: [{ id: 1 }], macierz: [[0]] }),
    [null], 'stacja bez pola sieciowego to fallback, nie NaN',
  );
});

/* ------------------------------------------------------------------ trasa (uwaga B) */

test('optymalnaKolejnosc: N≤1 to tożsamość', () => {
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje: [] }), []);
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje: [{ lat: 52.23, lon: 21.01 }] }), [0]);
});

test('optymalnaKolejnosc: na jednej drodze bliższa stacja pierwsza (uwaga B, 2026-09-14)', () => {
  // Trzy punkty na wschód: 100 m, 250 m, 400 m. Sort po kącie (wszystkie ~90°)
  // zostawiłby kolejność wejścia — tu celowo podajemy najdalszą jako pierwszą.
  const stacje = [
    przesunPunkt(WARSZAWA, 90, 400),
    przesunPunkt(WARSZAWA, 90, 100),
    przesunPunkt(WARSZAWA, 90, 250),
  ];
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje }), [1, 2, 0],
    'blisko → środek → daleko; bez wracania obok miniętej stacji');
});

test('optymalnaKolejnosc: bliższa w tym samym kierunku przed dalszą (kąt nie wygrywa)', () => {
  // Klasyczny fail sortu po kącie: dalsza bardziej na północ (10°) niż bliższa (20°).
  const dalsza = przesunPunkt(WARSZAWA, 10, 700);
  const blizsza = przesunPunkt(WARSZAWA, 20, 350);
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje: [dalsza, blizsza] }), [1, 0]);
});

test('optymalnaKolejnosc: determinizm i macierz sieciowa', () => {
  const stacje = [
    przesunPunkt(WARSZAWA, 0, 300),
    przesunPunkt(WARSZAWA, 120, 300),
    przesunPunkt(WARSZAWA, 240, 300),
  ];
  const a = optymalnaKolejnosc({ srodek: WARSZAWA, stacje });
  const b = optymalnaKolejnosc({ srodek: WARSZAWA, stacje });
  assert.deepEqual(a, b, 'to samo wejście = ta sama kolejność');
  assert.equal(a.length, 3);
  assert.deepEqual([...a].sort((x, y) => x - y), [0, 1, 2], 'permutacja wszystkich indeksów');

  // Macierz niesymetryczna: ze startu tanio do 2, z 2 tanio do 0, z 0 tanio do 1.
  const macierz = [
    [0, 10, 999],
    [999, 0, 999],
    [5, 999, 0],
  ];
  const dStart = [999, 999, 1];
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje, dystansStart: dStart, macierz }), [2, 0, 1]);
});

test('optymalnaKolejnosc: N>10 idzie zachłannie, nadal bez wracania na linii', () => {
  const stacje = Array.from({ length: 11 }, (_, i) => przesunPunkt(WARSZAWA, 90, 100 * (11 - i)));
  // indeks 0 = 1100 m, indeks 10 = 100 m
  const kolejnosc = optymalnaKolejnosc({ srodek: WARSZAWA, stacje });
  assert.deepEqual(kolejnosc, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    'greedy NN na linii: od najbliższej do najdalszej');
  assert.deepEqual(optymalnaKolejnosc({ srodek: WARSZAWA, stacje }), kolejnosc, 'determinizm N>10');
});

test('stacjeProste: kolejność to trasa z twardym wejściem, nie sort po kącie', () => {
  const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO });
  assert.deepEqual(stacje.map((s) => s.id), [1, 2, 3, 4, 5], 'id po przestawieniu zostają 1…N');
  const dystanse = stacje.map((s) => odlegloscM(WARSZAWA, s));
  assert.equal(dystanse.indexOf(Math.min(...dystanse)), 0, 'stacja 1 to najbliższa startu (uwaga B, dogrywka)');
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje }), [0, 1, 2, 3, 4], 'stacjeProste oddaje punkt stały reguły wejścia');
});

/* ---- uwaga B 2026-09-14 (dogrywka): twarde wejście w pętlę (ADR 0005 aneks) ---- */

/** Deterministyczny generator (mulberry32) do baterii własności — ziarno stałe. */
function losujZZiarna(ziarno) {
  let z = ziarno | 0;
  return () => {
    z = (z + 0x6D2B79F5) | 0;
    return (((Math.imul(z ^ (z >>> 15), 1 | z) + 0x9E3779B9) | 0) >>> 0) / 2 ** 32;
  };
}

test('kolejnoscTrasy: przypadek właściciela — stacja 1 to ta mijana (100 m), nie daleka (300 m)', () => {
  // Gra terenowa: start → nr 2 ≈ 100 m, start → nr 1 ≈ 300 m, 1 → 2 ≈ 200 m
  // (współliniowo). Wejście w pętlę nie może kazać mijać bliższej stacji.
  const daleka = { ...przesunPunkt(WARSZAWA, 0, 300), id: 1, opis: 'daleka' };
  const bliska = { ...przesunPunkt(WARSZAWA, 0, 100), id: 2, opis: 'bliska' };
  const reszta = [90, 180, 270].map((kat, i) => ({ ...przesunPunkt(WARSZAWA, kat, 500), id: i + 3, opis: '' }));
  const stacje = [daleka, bliska, ...reszta]; // wejście celowo w złej kolejności
  const kolejnosc = kolejnoscTrasy({ srodek: WARSZAWA, stacje });
  assert.equal(kolejnosc[0], 1, 'pierwsza idzie stacja ze 100 m, choć w danych jest druga');
  assert.deepEqual([...kolejnosc].sort((a, b) => a - b), [0, 1, 2, 3, 4], 'reszta to permutacja wszystkich stacji');
  // W tym współliniowym układzie nierówność właściciela zachodzi z równością.
  const s1 = stacje[kolejnosc[0]];
  const s2 = stacje[kolejnosc[1]];
  assert.equal(kolejnosc[1], 0, 'druga idzie stacja z 300 m — wprost za pierwszą');
  const lewa = odlegloscM(WARSZAWA, s2);
  const prawa = odlegloscM(WARSZAWA, s1) + odlegloscM(s1, s2);
  assert.ok(lewa >= prawa - 1e-6, `d(S,2)=${lewa} < d(S,1)+d(1,2)=${prawa}`);
});

test('kolejnoscTrasy: pierwsza jest ZAWSZE najbliższa startu (bateria 500 układów)', () => {
  const losuj = losujZZiarna(20260914);
  for (let proba = 0; proba < 500; proba++) {
    const n = 3 + Math.floor(losuj() * 6); // 3–8 stacji
    const R = 300 + losuj() * 1200;
    const stacje = [];
    for (let i = 0; i < n; i++) {
      stacje.push(przesunPunkt(WARSZAWA, losuj() * 360, R * (0.55 + losuj() * 0.45)));
    }
    const kolejnosc = kolejnoscTrasy({ srodek: WARSZAWA, stacje });
    const dystanse = stacje.map((s) => odlegloscM(WARSZAWA, s));
    const najblizsza = dystanse.indexOf(Math.min(...dystanse));
    assert.equal(kolejnosc[0], najblizsza, `próba ${proba}: pierwsza ${kolejnosc[0]}, najbliższa ${najblizsza}`);
  }
});

test('kolejnoscTrasy: remis co do metra rozstrzyga mniejszy indeks (determinizm)', () => {
  const a = przesunPunkt(WARSZAWA, 90, 200);
  const b = przesunPunkt(WARSZAWA, 270, 200);
  const c = przesunPunkt(WARSZAWA, 0, 500);
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje: [a, b, c] })[0], 0);
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje: [b, a, c] })[0], 0, 'remis: wygrywa pozycja, nie treść');
});

test('kolejnoscTrasy: w metryce drogowej liczy się droga, nie kreska', () => {
  // A blisko w linii prostej (100 m), ale drogą daleko (2 km objazdu);
  // B dalej kreską (500 m), ale drogą blisko (500 m). Gra idzie drogą.
  const a = przesunPunkt(WARSZAWA, 90, 100);
  const b = przesunPunkt(WARSZAWA, 270, 500);
  const c = przesunPunkt(WARSZAWA, 0, 900);
  const kolejnosc = kolejnoscTrasy({
    srodek: WARSZAWA,
    stacje: [a, b, c],
    dystansStart: [2000, 500, 900],
    macierz: [[0, 2400, 1500], [2400, 0, 600], [1500, 600, 0]],
  });
  assert.equal(kolejnosc[0], 1, 'pierwsza idzie stacja bliższa DROGĄ (500 m), choć kreską dalsza');
});

test('kolejnoscTrasy: reszta jest optymalna od stacji 1, całość deterministyczna', () => {
  const stacje = [0, 120, 240].map((kat) => przesunPunkt(WARSZAWA, kat, 300));
  const a = kolejnoscTrasy({ srodek: WARSZAWA, stacje });
  const b = kolejnoscTrasy({ srodek: WARSZAWA, stacje });
  assert.deepEqual(a, b, 'to samo wejście = ta sama kolejność');
  assert.deepEqual([...a].sort((x, y) => x - y), [0, 1, 2]);
  // Punkt stały: uporządkowany układ jest własnym wynikiem.
  const uporzadkowane = a.map((idx) => stacje[idx]);
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje: uporzadkowane }), [0, 1, 2]);
});

test('kolejnoscTrasy: N≤1 i N>10 nie gubią stacji', () => {
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje: [] }), []);
  assert.deepEqual(kolejnoscTrasy({ srodek: WARSZAWA, stacje: [przesunPunkt(WARSZAWA, 0, 100)] }), [0]);
  const duzo = Array.from({ length: 11 }, (_, i) => przesunPunkt(WARSZAWA, 90, 100 * (11 - i)));
  const kolejnosc = kolejnoscTrasy({ srodek: WARSZAWA, stacje: duzo });
  assert.equal(kolejnosc[0], 10, 'najbliższa pierwsza także na ścieżce zachłannej');
  assert.deepEqual([...kolejnosc].sort((x, y) => x - y), duzo.map((_, i) => i));
});

test('uporzadkujGre: stacje dostają numery trasy, pytania idą za nimi, id nietknięte', () => {
  const stacje = [
    { id: 1, ...przesunPunkt(WARSZAWA, 0, 300), opis: 'daleka' },
    { id: 2, ...przesunPunkt(WARSZAWA, 0, 100), opis: 'bliska' },
  ];
  const pytania = [
    { id: 's1p1', stacja: 1, temat: 'historia', tresc: 'Dalekie?', odpowiedzi: ['a', 'b', 'c', 'd'], poprawna: 2 },
    { id: 's2p1', stacja: 2, temat: 'historia', tresc: 'Bliskie?', odpowiedzi: ['a', 'b', 'c', 'd'], poprawna: 0 },
  ];
  const wynik = uporzadkujGre({ srodek: WARSZAWA, stacje, pytania });
  assert.equal(wynik.zmieniono, true);
  assert.deepEqual(wynik.kolejnosc, [1, 0]);
  assert.deepEqual(wynik.stacje.map((s) => s.id), [1, 2], 'numery zawsze 1…N po przestawieniu');
  assert.equal(wynik.stacje[0].opis, 'bliska', 'stacja 1 to fizycznie ta ze 100 m');
  // Pytania: `stacja` za nowym numerem, reszta (w tym id głosów) nietknięta.
  const bliskie = wynik.pytania.find((p) => p.id === 's2p1');
  const dalekie = wynik.pytania.find((p) => p.id === 's1p1');
  assert.equal(bliskie.stacja, 1);
  assert.equal(dalekie.stacja, 2);
  assert.equal(bliskie.tresc, 'Bliskie?');
  assert.equal(bliskie.poprawna, 0, 'indeks poprawnej nie zależy od numeru stacji (paczki w kontenerze są odkodowane)');
  assert.equal(pytania[0].stacja, 1, 'wejście niemutowane — gra dostaje kopię');
});

test('uporzadkujGre: dobry porządek jest punktem stałym, obce pytania zostają', () => {
  const stacje = [
    { id: 1, ...przesunPunkt(WARSZAWA, 0, 100), opis: '' },
    { id: 2, ...przesunPunkt(WARSZAWA, 0, 300), opis: '' },
  ];
  const pytania = [
    { id: 's1p1', stacja: 1, poprawna: 0 },
    { id: 's9p1', stacja: 9, poprawna: 1 },
  ];
  const wynik = uporzadkujGre({ srodek: WARSZAWA, stacje, pytania });
  assert.equal(wynik.zmieniono, false, 'nic do roboty — gra startuje bez komunikatu o porządkowaniu');
  assert.deepEqual(wynik.stacje.map((s) => s.id), [1, 2]);
  assert.equal(wynik.pytania.find((p) => p.id === 's9p1').stacja, 9, 'pytania do nieistniejącej stacji nie niszczymy');
  const drugi = uporzadkujGre({ srodek: WARSZAWA, stacje: wynik.stacje, pytania: wynik.pytania });
  assert.equal(drugi.zmieniono, false, 'idempotentność: drugi przebieg nic nie zmienia');
});

test('uporzadkujGre: mapowanie pytań idzie po starych id, nie po pozycjach', () => {
  const stacje = [
    { id: 2, ...przesunPunkt(WARSZAWA, 0, 100), opis: 'bliska' },
    { id: 1, ...przesunPunkt(WARSZAWA, 0, 300), opis: 'daleka' },
  ];
  const pytania = [
    { id: 's2p1', stacja: 2, poprawna: 0 },
    { id: 's1p1', stacja: 1, poprawna: 1 },
  ];
  const wynik = uporzadkujGre({ srodek: WARSZAWA, stacje, pytania });
  assert.equal(wynik.stacje[0].opis, 'bliska');
  assert.equal(wynik.pytania.find((p) => p.id === 's2p1').stacja, 1);
  assert.equal(wynik.pytania.find((p) => p.id === 's1p1').stacja, 2);
});
