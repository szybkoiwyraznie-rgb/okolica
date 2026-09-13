/**
 * Testy `app/orientacja.js` (ADR 0030 aneks 2026-09-13): ekran obraca się sam,
 * a aplikacja po obrocie klika za gracza ◎ Centrowanie. Moduł jest czysty, więc
 * testy są czyste — warstwę DOM (nasłuch `resize`/`orientationchange`,
 * `centrujNaPozycji` na widocznej mapie, brak `orientation.lock`) pilnuje
 * kontrakt ADR 0030 w `test/kontrakt.test.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { OPOZNIENIE_OBROTU_MS, czyObrotEkranu, kierunekEkranu } from '../app/orientacja.js';

test('orientacja: opóźnienie jest krótkie — obrót ma być obsłużony, a nie odczuwalny', () => {
  assert.equal(OPOZNIENIE_OBROTU_MS, 250, 'telefon melduje kilka wymiarów pośrednich w trakcie animacji');
  assert.ok(OPOZNIENIE_OBROTU_MS > 0 && OPOZNIENIE_OBROTU_MS <= 1000, 'pół sekundy to maksimum przyzwoitości');
});

test('orientacja: kierunek z wymiarów okna — telefon 360×740 jest pionowy, 740×360 poziomy', () => {
  assert.equal(kierunekEkranu({ szerokosc: 360, wysokosc: 740 }), 'pion');
  assert.equal(kierunekEkranu({ szerokosc: 740, wysokosc: 360 }), 'poziom');
  assert.equal(kierunekEkranu({ szerokosc: 1280, wysokosc: 800 }), 'poziom', 'desktop też ma kierunek');
  assert.equal(kierunekEkranu({ szerokosc: 500, wysokosc: 500 }), 'poziom', 'kwadrat jest rozstrzygnięty zawsze tak samo');
});

test('orientacja: bez wymiarów nie ma kierunku (LESSONS L10)', () => {
  for (const wejscie of [
    {}, { szerokosc: 360 }, { wysokosc: 740 }, { szerokosc: null, wysokosc: null },
    { szerokosc: 0, wysokosc: 740 }, { szerokosc: 360, wysokosc: 0 },
    { szerokosc: -5, wysokosc: 740 }, { szerokosc: NaN, wysokosc: 740 },
    { szerokosc: 360, wysokosc: undefined }, { szerokosc: '360', wysokosc: '740' },
  ]) {
    assert.equal(kierunekEkranu(wejscie), '', `${JSON.stringify(wejscie)} nie daje kierunku`);
  }
  assert.equal(kierunekEkranu(), '', 'brak argumentów nie daje kierunku');
});

test('orientacja: obrót to zmiana kierunku — i tylko ona', () => {
  assert.equal(czyObrotEkranu({ przed: 'pion', po: 'poziom' }), true);
  assert.equal(czyObrotEkranu({ przed: 'poziom', po: 'pion' }), true);
  assert.equal(czyObrotEkranu({ przed: 'pion', po: 'pion' }), false, 'ten sam kierunek = brak obrotu');
  assert.equal(czyObrotEkranu({ przed: 'poziom', po: 'poziom' }), false);
});

test('orientacja: bez dwóch zmierzonych kierunków NIE klikamy za gracza', () => {
  assert.equal(czyObrotEkranu({ przed: '', po: 'pion' }), false, 'pierwszy pomiar (start aplikacji) to nie obrót');
  assert.equal(czyObrotEkranu({ przed: 'pion', po: '' }), false, 'utracony wymiar nie udaje obrotu');
  assert.equal(czyObrotEkranu({ przed: '', po: '' }), false);
  assert.equal(czyObrotEkranu({}), false);
  assert.equal(czyObrotEkranu(), false, 'brak argumentów nie klika');
  assert.equal(czyObrotEkranu({ przed: null, po: 'pion' }), false, 'śmieć w wejściu nie klika');
  assert.equal(czyObrotEkranu({ przed: 'pion', po: 740 }), false);
});
