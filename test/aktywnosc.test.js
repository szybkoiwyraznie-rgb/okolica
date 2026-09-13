/**
 * Testy `app/aktywnosc.js` (ADR 0040 pkt 4–5): Wake Lock na czas gry i próg
 * 15 minut bezczynności. Moduł jest czysty, więc testy są czyste — DOM-ową
 * stronę (wołanie `navigator.wakeLock`, nasłuch klików, watchdog) pilnuje
 * kontrakt ADR 0040 w `test/kontrakt.test.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRZERWA_BEZCZYNNOSCI_MS, SPRAWDZANIE_BEZCZYNNOSCI_MS,
  czyPrzerwaBezczynnosci, czyTrzymacEkran,
} from '../app/aktywnosc.js';

test('aktywność: próg to 15 minut bezczynności, watchdog co 30 s (właściciel 2026-09-13)', () => {
  assert.equal(PRZERWA_BEZCZYNNOSCI_MS, 15 * 60 * 1000, 'dokładnie 15 minut — tyle wolno właścicielowi');
  assert.equal(SPRAWDZANIE_BEZCZYNNOSCI_MS, 30 * 1000);
  assert.ok(SPRAWDZANIE_BEZCZYNNOSCI_MS < PRZERWA_BEZCZYNNOSCI_MS,
    'watchdog musi zdążyć zauważyć bezczynność, nie raz na kwadrans');
  assert.ok(Number.isFinite(PRZERWA_BEZCZYNNOSCI_MS) && Number.isFinite(SPRAWDZANIE_BEZCZYNNOSCI_MS));
});

test('aktywność: czyPrzerwaBezczynnosci — próg ostry, a brak danych NIE pauzuje (LESSONS L10)', () => {
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: PRZERWA_BEZCZYNNOSCI_MS - 1 }), false,
    '14 min 59 s to jeszcze nie przerwa');
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: PRZERWA_BEZCZYNNOSCI_MS }), true,
    'równo 15 min = przerwa');
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 1000, terazMs: 1000 + PRZERWA_BEZCZYNNOSCI_MS + 5 }), true);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 5000, terazMs: 1000 }), false,
    'zegar cofnięty (restart sesji) nie daje przerwy');
  // Brak danych to brak danych: bez znacznika akcji nie wolno uznać bezczynności.
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: null, terazMs: 10 ** 9 }), false);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: NaN, terazMs: 10 ** 9 }), false);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: null }), false);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: undefined }), false);
  assert.equal(czyPrzerwaBezczynnosci({}), false, 'puste wejście nie pauzuje');
  assert.equal(czyPrzerwaBezczynnosci(), false, 'brak argumentów nie pauzuje');
  // Własny próg działa, ale 0 i wartości ujemne są odmową (nie „pauzuj zawsze”).
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: 60_000, progMs: 60_000 }), true);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: 10 ** 9, progMs: 0 }), false);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: 10 ** 9, progMs: -5 }), false);
  assert.equal(czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: 0, terazMs: 10 ** 9, progMs: NaN }), false);
});

test('aktywność: czyTrzymacEkran — Wake Lock na czas gry, bez końca i bez ręcznego zakończenia', () => {
  const fazaKoniec = 'koniec';
  for (const faza of ['przygotowanie', 'odcinek', 'pytanie']) {
    assert.equal(czyTrzymacEkran({ rozgrywka: { faza }, fazaKoniec }), true, `gra w fazie ${faza} trzyma ekran`);
  }
  assert.equal(czyTrzymacEkran({ rozgrywka: { faza: 'koniec' }, fazaKoniec }), false,
    'po końcu gry ekran może gasnąć — gracz patrzy na wynik, nie na mapę');
  assert.equal(czyTrzymacEkran({ rozgrywka: { faza: 'odcinek' }, fazaKoniec, zakonczonaRecznie: true }), false,
    'ręczne zakończenie zwalnia blokadę');
  assert.equal(czyTrzymacEkran({ rozgrywka: null, fazaKoniec }), false, 'bez rozgrywki nie trzymamy ekranu');
  assert.equal(czyTrzymacEkran({ fazaKoniec }), false);
  assert.equal(czyTrzymacEkran({ rozgrywka: { faza: 'odcinek' } }), false,
    'bez nazwy fazy końcowej nie zgadujemy (LESSONS L10)');
  assert.equal(czyTrzymacEkran({ rozgrywka: { faza: 'odcinek' }, fazaKoniec: '' }), false);
  assert.equal(czyTrzymacEkran({ rozgrywka: { faza: 3 }, fazaKoniec }), false, 'faza musi być tekstem');
  assert.equal(czyTrzymacEkran({ rozgrywka: 'odcinek', fazaKoniec }), false, 'rozgrywka musi być obiektem');
});
