/**
 * Testy generatora ikon (tools/generuj-ikony.mjs) — czyste funkcje, bez DOM.
 * Oczekiwania LICZONE z geometrii motywu (L24): próbka (px,py) rastra R ma
 * środek we współrzędnych viewBox ((px+0.5)/R)*32.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KOLORY_ICONY, MOTYW, SVG_ICONY, crc32, narysujIkone, punktWPolygonie,
  przeskalujMotyw, zakodujPng, zestawIkon,
} from '../tools/generuj-ikony.mjs';

const R = 128; // raster testowy
const px = (x) => Math.round((x / 32) * R); // viewBox → indeks piksela (środek próbki ~x)
const kolorPiksela = (raster, x, y) => {
  const o = (y * R + x) * 4;
  return [raster[o], raster[o + 1], raster[o + 2], raster[o + 3]];
};

test('ikony: dysk, igła i pivot lądują tam, gdzie geometria motywu', () => {
  const raster = narysujIkone(R);
  // dysk: viewBox (16,4) — d≈11.9 < 14, poza igłą (y≥10) i pivotem
  assert.deepEqual(kolorPiksela(raster, px(16), px(4)), [...KOLORY_ICONY.zielen, 255], 'dysk jest zielony');
  // igła: (18.5,14) — wewnątrz czworokąta, ~2 jednostki od krawędzi, d≈3.2 od pivota
  assert.deepEqual(kolorPiksela(raster, px(18.5), px(14)), [...KOLORY_ICONY.igla, 255], 'igła jest kremowa');
  // pivot: sam środek — igła go nie zakrywa, bo pivot rysowany ostatni
  assert.deepEqual(kolorPiksela(raster, px(16), px(16)), [...KOLORY_ICONY.zielen, 255], 'pivot przebija igłę');
  // tło: narożnik poza dyskiem (d≈22 > 14)
  assert.deepEqual(kolorPiksela(raster, 1, 1), [...KOLORY_ICONY.tlo, 255], 'tło pełne (nie przezroczyste)');
});

test('ikony: maskable trzyma safe zone — motyw ×0,8 nie sięga krawędzi', () => {
  const zwykla = narysujIkone(R);
  const maskable = narysujIkone(R, { skalaMotywu: 0.8 });
  // viewBox (2.5,16): d≈13.38 — wewnątrz zwykłego dysku (14), POZA maskable (11.2)
  assert.deepEqual(kolorPiksela(zwykla, px(2.5), px(16)), [...KOLORY_ICONY.zielen, 255], 'zwykła: tu jeszcze dysk');
  assert.deepEqual(kolorPiksela(maskable, px(2.5), px(16)), [...KOLORY_ICONY.tlo, 255], 'maskable: tu już tło (safe zone)');
  // środek maskable dalej niesie motyw
  assert.deepEqual(kolorPiksela(maskable, px(16), px(16)), [...KOLORY_ICONY.zielen, 255], 'maskable: pivot w środku');
  // średnica motywu maskable = 70% szerokości (2×14×0,8 / 32) — poniżej 80%
  const srednicaWzgledna = (2 * MOTYW.promienDysku * 0.8) / 32;
  assert.ok(srednicaWzgledna <= 0.8, `motyw maskable mieści się w safe zone: ${srednicaWzgledna}`);
});

test('ikony: punktWPolygonie i przeskalujMotyw liczą poprawnie', () => {
  assert.equal(punktWPolygonie(16, 16.5, MOTYW.igla), true, 'środek igły wewnątrz');
  assert.equal(punktWPolygonie(30, 30, MOTYW.igla), false, 'poza igłą');
  assert.equal(punktWPolygonie(5, 5, MOTYW.igla), false, 'narożnik poza igłą');
  const skala = przeskalujMotyw(0.5);
  assert.deepEqual(skala[0], [19, 13], 'wierzchołek (22,10) → 16+(22-16)*0.5, 16+(10-16)*0.5');
  assert.throws(() => przeskalujMotyw(0), TypeError);
  assert.throws(() => narysujIkone(0), TypeError);
  assert.throws(() => narysujIkone(1.5), TypeError);
});

test('ikony: enkoder PNG — sygnatura, IHDR, determinizm bajtowy', () => {
  const raster = narysujIkone(24);
  assert.equal(raster.length, 24 * 24 * 4, 'RGBA po 4 bajty na piksel');
  const png = zakodujPng(raster, 24, 24);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'sygnatura PNG');
  assert.equal(png.readUInt32BE(16), 24, 'IHDR: szerokość');
  assert.equal(png.readUInt32BE(20), 24, 'IHDR: wysokość');
  assert.equal(png[24], 8, 'IHDR: bit depth 8');
  assert.equal(png[25], 6, 'IHDR: color type RGBA');
  const png2 = zakodujPng(narysujIkone(24), 24, 24);
  assert.equal(Buffer.compare(png, png2), 0, 'dwa przebiegi dają te same bajty (Pages ma źródło prawdy)');
  assert.throws(() => zakodujPng(new Uint8Array(10), 24, 24), TypeError);
});

test('ikony: crc32 ma standardową wartość kontrolną', () => {
  // znany wektor testowy CRC-32 (PNG/zlib): „123456789" → 0xCBF43926
  assert.equal(crc32(Buffer.from('123456789', 'ascii')), 0xcbf43926);
});

test('ikony: zestaw plików jest kontraktem z manifestem', () => {
  const zestaw = zestawIkon();
  assert.deepEqual(zestaw.map((z) => z.nazwa), [
    'ikona.svg', 'ikona-192.png', 'ikona-512.png', 'ikona-maskable-512.png', 'ikona-180.png',
  ]);
  assert.match(SVG_ICONY, /viewBox="0 0 32 32"/, 'SVG ma viewBox favicona');
  assert.match(SVG_ICONY, /#2f6f4f/, 'SVG niesie zieleń dysku');
});
