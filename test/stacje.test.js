/**
 * Testy wyboru stacji (app/stacje.js). W M0 działa tryb uproszczony
 * (pierścień); od M4 dochodzi sieć drogowa z Overpass — te testy pilnują
 * części wspólnej: determinizmu, miary sprawiedliwości i odstępów.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ZRODLA_STACJI, dystanseOdcinkowM, miaraSprawiedliwosci, najmniejszyOdstepM, stacjeProste, uzupelnijOdleglosci } from '../app/stacje.js';
import { odlegloscM } from '../app/geo.js';

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
  assert.ok(miaraSprawiedliwosci(obrot).udzialOdchylenia < 0.25);
});

test('stacjeProste: odrzuca bezsensowne argumenty', () => {
  assert.throws(() => stacjeProste({ srodek: null, liczbaStacji: 5, promienM: 1000, ziarno: ZIARNO }), TypeError);
  assert.throws(() => stacjeProste({ srodek: WARSZAWA, liczbaStacji: 0, promienM: 1000, ziarno: ZIARNO }), TypeError);
  assert.throws(() => stacjeProste({ srodek: WARSZAWA, liczbaStacji: 5, promienM: 0, ziarno: ZIARNO }), TypeError);
});

test('miaraSprawiedliwosci: odchylenie względem średniej (kryterium M4: ≤ 15%)', () => {
  const stacje = stacjeProste({ srodek: WARSZAWA, liczbaStacji: 8, promienM: 1000, ziarno: ZIARNO });
  const m = miaraSprawiedliwosci(stacje);
  assert.ok(m.sredniaM > 600 && m.sredniaM < 900, `średnia ${m.sredniaM}`);
  assert.ok(m.udzialOdchylenia <= 0.15, `odchylenie ${Math.round(m.udzialOdchylenia * 100)}% — pierścień ma być równy`);
  assert.deepEqual(miaraSprawiedliwosci([]), { sredniaM: 0, odchylenieM: 0, udzialOdchylenia: 0 });
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
