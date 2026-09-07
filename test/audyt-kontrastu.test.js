/**
 * Testy `tools/audyt-kontrastu.mjs` (M10/T6) — wartości referencyjne WCAG,
 * a nie „co wyszło": czerń/biel = 21:1, ten sam kolor = 1:1, klasyczny
 * minimalny szary AA (#767676 na bieli ≈ 4.54:1). Plus uruchomienie narzędzia
 * jako bramy (exit 0 na bieżącej palecie).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { audytMotywu, hexNaRgb, kontrast, luminancja, tokenyZBloku } from '../tools/audyt-kontrastu.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('WCAG: wartości referencyjne luminancji i kontrastu', () => {
  assert.equal(luminancja('#ffffff'), 1);
  assert.equal(luminancja('#000000'), 0);
  assert.equal(kontrast('#000', '#fff'), 21, 'czerń/biel = 21:1 (maksimum WCAG)');
  assert.equal(kontrast('#1c2225', '#1c2225'), 1, 'ten sam kolor = 1:1');
  const aa = kontrast('#767676', '#ffffff');
  assert.ok(aa >= 4.5 && aa < 4.6, `#767676 na bieli ≈ 4.54:1, wyszło ${aa.toFixed(3)}`);
  assert.deepEqual(hexNaRgb('#fff'), [255, 255, 255], 'hex 3-znakowy');
  assert.deepEqual(hexNaRgb('#1d2321'), [29, 35, 33], 'hex 6-znakowy');
  assert.throws(() => hexNaRgb('zielony'), /nie-hex/, 'śmieci odrzucone jawnie');
});

test('WCAG: kontrast jest symetryczny (kolejność barw bez znaczenia)', () => {
  assert.equal(kontrast('#2f6f4f', '#ffffff').toFixed(3), kontrast('#ffffff', '#2f6f4f').toFixed(3));
});

test('audyt: tokeny z bloku CSS i werdykty par (w tym brak tokena = jawne ✗)', () => {
  const tokeny = tokenyZBloku('  --tekst: #1d2321;\n  --tlo: #f6f2e9;\n  --promien: 14px;');
  assert.deepEqual(tokeny, { tekst: '#1d2321', tlo: '#f6f2e9' }, 'tylko tokeny-kolory (px odpadają)');
  const wyniki = audytMotywu(tokeny, [
    { tekst: 'tekst', tlo: 'tlo', prog: 4.5, opis: 'ok' },
    { tekst: 'tekst', tlo: 'brak-tokena', prog: 4.5, opis: 'zły' },
  ]);
  assert.equal(wyniki[0].ok, true);
  assert.ok(wyniki[0].ratio > 10);
  assert.equal(wyniki[1].ok, false);
  assert.equal(wyniki[1].brak, true, 'brak tokena jest naruszeniem, nie pominięciem');
});

test('brama: narzędzie na bieżącej palecie kończy się zero (oba motywy nad progami)', () => {
  const wynik = execFileSync(process.execPath, [join(ROOT, 'tools', 'audyt-kontrastu.mjs')], { encoding: 'utf8' });
  assert.match(wynik, /motyw jasny/);
  assert.match(wynik, /motyw ciemny/);
  assert.match(wynik, /0 naruszeń/);
});
