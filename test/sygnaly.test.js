/**
 * Testy `app/sygnaly.js` (M10/T4) — czyste plany sygnałów. Odtwarzanie
 * (Web Audio, vibrate) jest w warstwie DOM i w terenie (checklista T7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { KLUCZ_SYGNALOW, SYGNALY, czySygnalyWlaczone, planSygnalu } from '../app/sygnaly.js';

test('sygnały: komplet zdarzeń gry ma plan (dotarcie, start odcinka, oceny)', () => {
  for (const zdarzenie of ['dotarcie', 'startOdcinka', 'poprawna', 'bledna']) {
    const plan = planSygnalu(zdarzenie);
    assert.ok(plan, `brak planu dla ${zdarzenie}`);
    assert.ok(Array.isArray(plan.wibracjaMs) && plan.wibracjaMs.length > 0, `${zdarzenie}: wzorzec wibracji`);
    assert.ok(plan.dzwiek.every((n) => n.czHz > 0 && n.ms > 0), `${zdarzenie}: nuty mają częstotliwość i czas`);
  }
  assert.equal(KLUCZ_SYGNALOW, 'okolica:sygnaly');
});

test('sygnały: melodie rozróżnialne kierunkiem — dobrze w górę, źle w dół, dotarcie w górę', () => {
  assert.ok(SYGNALY.poprawna.dzwiek[0].czHz > SYGNALY.bledna.dzwiek[0].czHz, 'dobrze wyżej niż źle');
  assert.ok(SYGNALY.bledna.dzwiek.at(-1).czHz < SYGNALY.bledna.dzwiek[0].czHz, 'źle: melodia opadająca');
  assert.ok(SYGNALY.dotarcie.dzwiek.at(-1).czHz > SYGNALY.dotarcie.dzwiek[0].czHz, 'dotarcie: melodia rosnąca');
});

test('sygnały: wyłączone = null dla każdego zdarzenia; nieznane zdarzenie = null', () => {
  for (const zdarzenie of ['dotarcie', 'poprawna', 'bledna', 'startOdcinka']) {
    assert.equal(planSygnalu(zdarzenie, { wlaczone: false }), null, `${zdarzenie} bez planu po wyłączeniu`);
  }
  assert.equal(planSygnalu('nieznane'), null);
});

test('sygnały: przełącznik domyślnie WŁĄCZONY (brak klucza), wyłącza tylko „0”', () => {
  assert.equal(czySygnalyWlaczone(null), true, 'brak zapisu = włączone (domyślne)');
  assert.equal(czySygnalyWlaczone(undefined), true);
  assert.equal(czySygnalyWlaczone('1'), true);
  assert.equal(czySygnalyWlaczone('0'), false, 'jedynie „0" wyłącza');
  assert.equal(czySygnalyWlaczone('coś-dziwnego'), true, 'śmieci nie wyłączają sygnałów');
});

test('sygnały: plany są zamrożone (kanon, nie konfigurowalny w locie)', () => {
  assert.ok(Object.isFrozen(SYGNALY));
  assert.ok(Object.isFrozen(SYGNALY.dotarcie));
  assert.ok(Object.isFrozen(SYGNALY.dotarcie.dzwiek));
});
