/**
 * Testy bramy publikacji (M9/R4): `zbudujIndeks` bez dotykania dysku.
 * Paczka publiczna musi przejść TO-zestaw/1, licencję, przegląd źródeł
 * i pokrycie stacji pytaniami — inaczej indeks NIE powstaje (ADR 0017 pkt 4/5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { zapakujPaczke } from '../app/kodowanie.js';
import { zbudujPlikZestawu, zbierzMetaZestawu } from '../app/zestawy.js';
import { LICENCJA_PUBLICZNA, ZNAK_OCZEKUJE_PRZEGLADU, zbudujIndeks } from '../tools/generuj-indeks-paczek.mjs';

const POZ = { lat: 52.12303, lon: 20.74614 };
const paczka = (nad = {}) => ({
  protokol: 'PYT/1.0',
  okolica: { lat: POZ.lat, lon: POZ.lon, promienM: 1000, miejsce: 'Podkowa Leśna' },
  wiek: 'dorosli',
  tematy: ['historia'],
  jezyk: 'polski',
  utworzono: '2026-09-06 10:00',
  pytania: [
    { id: 's1p1', stacja: 1, temat: 'historia', tresc: 'A?', odpowiedzi: ['a', 'b', 'c', 'd'], poprawna: 0, wyjasnienie: 'Bo tak.', zrodla: [{ url: 'https://x.org', tytul: 'X', sprawdzono: '2026-09-06' }], punkty: 10 },
    { id: 's2p1', stacja: 2, temat: 'historia', tresc: 'B?', odpowiedzi: ['a', 'b', 'c', 'd'], poprawna: 1, wyjasnienie: 'Bo tak.', zrodla: [{ url: 'https://x.org', tytul: 'X', sprawdzono: '2026-09-06' }], punkty: 10 },
  ],
  uwagi: '',
  ...nad,
});
const stacje = () => [{ lat: 52.1235, lon: 20.7455, opis: 'plac' }, { lat: 52.1245, lon: 20.7475, opis: 'park' }];
const plikPubliczny = (zmianyMeta = {}) => {
  const meta = zbierzMetaZestawu({ lat: POZ.lat, lon: POZ.lon, promienM: 1000, tematy: ['historia'], wiek: 'dorosli', miejsce: 'Podkowa Leśna', data: '2026-09-06 10:00' });
  const plik = zbudujPlikZestawu({ stacje: stacje(), kontener: zapakujPaczke(paczka(), 'PYT/1.0'), meta });
  plik.meta.przegladZrodel = '2026-09-06 właściciel'; // jak po ręcznym przeglądzie
  Object.assign(plik.meta, zmianyMeta);
  return JSON.stringify(plik);
};

test('indeks paczek: poprawna paczka daje wpis z meta i licznikami', () => {
  const { indeks, bledy } = zbudujIndeks([{ nazwa: 'podkowa.zestaw.json', tekst: plikPubliczny() }]);
  assert.deepEqual(bledy, []);
  assert.equal(indeks.schemat, 'TO-indeks/1');
  assert.equal(indeks.wpisy.length, 1);
  const wpis = indeks.wpisy[0];
  assert.equal(wpis.plik, 'podkowa.zestaw.json');
  assert.equal(wpis.geohash5, 'u3qb8');
  assert.equal(wpis.licencja, LICENCJA_PUBLICZNA);
  assert.equal(wpis.stacji, 2);
  assert.equal(wpis.pytan, 2);
  assert.equal(typeof wpis.skrot, 'string');
  assert.ok(!('pytania' in wpis), 'indeks nie niesie treści pytań (ADR 0017 pkt 2)');
});

test('indeks paczek: znacznik „oczekuje przeglądu" dyskwalifikuje plik', () => {
  const tekst = plikPubliczny();
  const surowy = JSON.parse(tekst);
  surowy.meta.przegladZrodel = `${ZNAK_OCZEKUJE_PRZEGLADU} właściciela`;
  const { indeks, bledy } = zbudujIndeks([{ nazwa: 'surowa.zestaw.json', tekst: JSON.stringify(surowy) }]);
  assert.deepEqual(indeks.wpisy, [], 'bez przeglądu nie ma publikacji');
  assert.match(bledy[0].komunikat, /przeglądu źródeł/);
});

test('indeks paczek: inna licencja i dziurawe pokrycie stacji nie przechodzą', () => {
  const { bledy: bLic } = zbudujIndeks([{ nazwa: 'l.zestaw.json', tekst: plikPubliczny({ licencja: 'CC0' }) }]);
  assert.match(bLic[0].komunikat, /CC BY-SA 4.0/);
  const bezPytania = paczka(); bezPytania.pytania = bezPytania.pytania.slice(0, 1); // stacja 2 sieroca
  const meta = zbierzMetaZestawu({ lat: POZ.lat, lon: POZ.lon, promienM: 1000, tematy: ['historia'], wiek: 'dorosli', miejsce: 'Podkowa Leśna' });
  const plik = zbudujPlikZestawu({ stacje: stacje(), kontener: zapakujPaczke(bezPytania, 'PYT/1.0'), meta });
  plik.meta.przegladZrodel = '2026-09-06 właściciel';
  const { bledy } = zbudujIndeks([{ nazwa: 'dziura.zestaw.json', tekst: JSON.stringify(plik) }]);
  assert.match(bledy.at(-1).komunikat, /stacja 2 nie ma żadnego pytania/);
});

test('indeks paczek: śmieć i pusty katalog dają jawny wynik, nie wyjątek', () => {
  const { indeks, bledy } = zbudujIndeks([{ nazwa: 'smiec.zestaw.json', tekst: '{' }]);
  assert.deepEqual(indeks.wpisy, []);
  assert.equal(bledy.length, 1);
  assert.deepEqual(zbudujIndeks([]).indeks.wpisy, [], 'pusty katalog = pusty indeks');
});

test('indeks paczek: wpisy sortują się po miejscu i dacie (przewidywalny diff)', () => {
  const a = JSON.parse(plikPubliczny());
  const b = JSON.parse(plikPubliczny());
  b.meta.miejsce = 'Warszawa';
  const { indeks } = zbudujIndeks([
    { nazwa: 'wawa.zestaw.json', tekst: JSON.stringify(b) },
    { nazwa: 'podkowa.zestaw.json', tekst: JSON.stringify(a) },
  ]);
  assert.deepEqual(indeks.wpisy.map((w) => w.miejsce), ['Podkowa Leśna', 'Warszawa']);
});
