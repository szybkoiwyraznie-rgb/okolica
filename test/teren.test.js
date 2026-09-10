import test from 'node:test';
import assert from 'node:assert/strict';
import { czyDotarl, przesunPunkt } from '../app/geo.js';
import { ocenFix, stanDojscia } from '../app/pozycja.js';

test('teren: 50 m, dwa kolejne fixy, bez znaczenia accuracy ani ostrzeżeń', () => {
  const stacja = { lat: 0, lon: 0 };
  for (const accuracy of [undefined, null, 0, 12, 850, 1250, NaN]) {
    for (const [metry, dotarl] of [[0, true], [49.999, true], [50, true], [50.001, false], [80, false]]) {
      const fix = { ...przesunPunkt(stacja, 0, metry), accuracy };
      assert.equal(czyDotarl([fix], stacja).dotarl, false);
      assert.equal(czyDotarl([fix, { ...fix }], stacja).dotarl, dotarl, `${metry} m / ${accuracy}`);
      const stan = stanDojscia([fix, { ...fix }], stacja);
      assert.equal(stan.dotarl, dotarl);
      assert.equal(stan.kod, null);
      assert.doesNotMatch(stan.komunikat, /dokładno|trafienia|próg|progu/i);
      assert.equal(ocenFix(fix).komunikat, '');
    }
  }
});

import { readFileSync } from 'node:fs';
const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('teren: bez stopki i zbędnych kontrolek pozycji, informacje i oko', () => {
  const s = html();
  assert.doesNotMatch(s, /<footer\b/);
  for (const id of ['przycisk-gps','przycisk-recznie','przycisk-ustaw-reczne','przycisk-symulacja','setup-lat','setup-lon','pozycja-dokladnosc','gra-prog-dojscia']) {
    assert.ok(!s.includes(`id="${id}"`), id);
  }
  for (const id of ['przycisk-informacje','przycisk-podejrzyj-mape','ekran-informacje']) assert.ok(s.includes(`id="${id}"`));
  assert.match(s, /<details id="prompt-instrukcja"[^>]*>/);
  assert.doesNotMatch(s, /<details id="prompt-instrukcja"[^>]*\bopen\b/);
  for (const url of ['https://meta.ai/', 'https://chatgpt.com/', 'https://gemini.google.com/']) {
    assert.ok(s.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`));
  }
});


test('teren: pomiar poza 50 m zeruje potwierdzenie dojścia', () => {
  const stacja = { lat: 0, lon: 0 };
  const blisko = { ...przesunPunkt(stacja, 0, 49), accuracy: 1250 };
  const daleko = { ...przesunPunkt(stacja, 0, 50.001), accuracy: 1 };
  for (const ocen of [czyDotarl, stanDojscia]) {
    assert.equal(ocen([blisko], stacja).dotarl, false);
    assert.equal(ocen([blisko, daleko], stacja).trafienia, 0);
    assert.equal(ocen([blisko, daleko, blisko], stacja).dotarl, false);
    assert.equal(ocen([blisko, daleko, blisko, { ...blisko }], stacja).dotarl, true);
  }
});


test('Overpass: lista prób wyłącznie w panelu Informacji', () => {
  const s = html();
  const informacje = s.match(/<section id="ekran-informacje"[\s\S]*?<\/section>/)[0];
  const stacje = s.match(/<section id="ekran-stacje"[\s\S]*?<\/section>/)[0];
  assert.ok(informacje.includes('id="siec-proby"'));
  assert.ok(!stacje.includes('id="siec-proby"'));
});
