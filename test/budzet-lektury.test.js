/**
 * Testy narzędzia budżetu lektury (B14): estymator, lista plików, raport.
 * Samego progu NIE testujemy na zielono (przekroczenie to fakt do naprawy
 * w S5, nie regresja) — testujemy mechanikę narzędzia.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { LIMIT_TOKENOW, ZNAKOW_NA_TOKEN, liczTokeny, mierzPlik, plikiLektury, raport } from '../tools/budzet-lektury.mjs';

test('estymator: ceil(znaki/4), deterministyczny, pusty tekst to 0', () => {
  assert.equal(ZNAKOW_NA_TOKEN, 4);
  assert.equal(liczTokeny(''), 0);
  assert.equal(liczTokeny('a'.repeat(100)), 25);
  assert.equal(liczTokeny('a'.repeat(101)), 26);
  assert.equal(liczTokeny('zażółć'.repeat(50)), liczTokeny('zażółć'.repeat(50)), 'determinizm na polskich znakach');
});

test('limit: 40 000 tokenów z AGENTS.md §0', () => {
  assert.equal(LIMIT_TOKENOW, 40_000);
});

test('lista lektury: pozycje 1–6 w kolejności §0 (ADR-y po README rejestru)', () => {
  const pliki = plikiLektury();
  assert.equal(pliki[0], 'AGENTS.md');
  assert.equal(pliki[1], 'docs/PROTOKOL.md');
  assert.equal(pliki[2], 'docs/decisions/README.md');
  const idxLekcje = pliki.indexOf('docs/LESSONS.md');
  const idxSrodowisko = pliki.indexOf('docs/setup/ENVIRONMENT.md');
  const idxMapa = pliki.indexOf('docs/ROADMAP.md');
  assert.ok(idxLekcje > 3 && idxSrodowisko === idxLekcje + 1 && idxMapa === idxSrodowisko + 1, 'LESSONS → ENVIRONMENT → ROADMAP na końcu');
  const adry = pliki.slice(3, idxLekcje);
  assert.ok(adry.length >= 20, `co najmniej 20 ADR-ów (jest ${adry.length})`);
  assert.deepEqual([...adry].sort(), adry, 'ADR-y alfabetycznie (kolejność rejestru)');
});

test('raport: suma zgadza się z wierszami, każdy plik zmierzony', () => {
  const { wiersze, suma, limit, przekroczony } = raport();
  assert.equal(limit, LIMIT_TOKENOW);
  assert.equal(suma, wiersze.reduce((s, w) => s + w.tokeny, 0));
  assert.equal(przekroczony, suma > limit);
  for (const w of wiersze) {
    assert.ok(w.linie > 5 && w.znaki > 100 && w.tokeny > 0, `${w.plik}: niepusty pomiar`);
  }
});

test('mierzPlik: AGENTS.md istnieje i liczy się w budżecie', () => {
  const w = mierzPlik('AGENTS.md');
  assert.equal(w.plik, 'AGENTS.md');
  assert.ok(w.tokeny > 1000, 'AGENTS.md to największe pojedyncze źródło zasad');
});
