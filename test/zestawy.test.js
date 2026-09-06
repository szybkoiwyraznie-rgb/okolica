/**
 * Testy `app/zestawy.js` (M9/R2) — czyste funkcje repozytorium paczek.
 * Bez DOM i bez localStorage: nośnik wstrzykuje warstwa DOM, tu liczy się
 * logika (walidacje surowe, dopasowanie okolicy, LRU z budżetem).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDZET_ZESTAWOW_BAJTY, KLUCZ_REJESTRU, KLUCZ_URL_REPO, DOMYSLNY_URL_INDEKSU,
  MAKS_ZESTAWOW, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY, SCHEMAT_ZESTAWU,
  dolozWpisRejestru, dopasujMetaIndeksu, dopasujZestawy, kluczZestawu,
  nowyRejestr, rozmiarBajty, walidujIndeksSurowy, walidujRejestrSurowy,
  walidujZestawLokalnySurowy, walidujZestawPublicznySurowy,
} from '../app/zestawy.js';

const kontener = () => ({ schemat: 'TO-paczka/2', protokol: 'PYT/1.0', kodowanie: 'b64x1', skrot: 'ab12cd34', dane: 'e30' });
const meta = (nad = {}) => ({ geohash5: 'u33dc', promienM: 1000, tematy: ['historia'], wiek: 'dorosli', ...nad });
const wpis = (skrot, data, nad = {}) => ({ skrot, data, ...meta(nad) });
const lokalny = (nad = {}) => ({
  schemat: SCHEMAT_LOKALNY,
  stacje: [{ id: 1, lat: 52.12, lon: 20.75 }, { id: 2, lat: 52.13, lon: 20.76 }],
  kontener: kontener(),
  ...meta(),
  data: '2026-09-06 10:00',
  kodGry: 'abc',
  ...nad,
});
const publiczny = (nad = {}) => ({
  schemat: SCHEMAT_ZESTAWU,
  protokol: 'PYT/1.0',
  meta: { ...meta(), miejsce: 'Podkowa Leśna', data: '2026-09-06', autor: 'właściciel', licencja: 'CC BY-SA 4.0', przegladZrodel: '2026-09-06 właściciel', ...nad.meta },
  stacje: [{ lat: 52.12, lon: 20.75, opis: 'plac' }],
  kontener: kontener(),
  ...nad,
});

test('zestawy: walidacja wpisu lokalnego odrzuca śmieć z kodami, nie wyjątkami', () => {
  assert.deepEqual(walidujZestawLokalnySurowy(JSON.stringify(lokalny())).usterki, []);
  assert.equal(walidujZestawLokalnySurowy('to nie json').usterki[0].kod, 'Z01');
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify({ schemat: 'inny' })).usterki[0].kod, 'Z02');
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify(lokalny({ stacje: [] }))).usterki[0].kod, 'Z03');
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify(lokalny({ stacje: [{ id: 1, lat: 999, lon: 0 }] }))).usterki[0].kod, 'Z03');
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify(lokalny({ kontener: { schemat: 'TO-paczka/1' } }))).usterki[0].kod, 'Z04');
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify(lokalny({ geohash5: 'u33' }))).usterki[0].kod, 'Z05');
});

test('zestawy: rejestr czyta się tolerancyjnie, niekompletne wpisy wypadają', () => {
  const tekst = JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy: [wpis('a1', '2026-09-06'), { skrot: 'x' }] });
  const { rejestr, usterki } = walidujRejestrSurowy(tekst);
  assert.equal(rejestr.length, 1, 'tylko kompletny wpis zostaje');
  assert.equal(usterki[0].kod, 'Z10');
  assert.equal(walidujRejestrSurowy('{').usterki[0].kod, 'Z01');
  assert.equal(walidujRejestrSurowy(JSON.stringify({ schemat: 'x', wpisy: [] })).usterki[0].kod, 'Z06');
  assert.deepEqual(walidujRejestrSurowy(JSON.stringify(nowyRejestr())).rejestr, []);
});

test('zestawy: LRU wyrzuca najstarsze ponad limit wpisów', () => {
  let rejestr = nowyRejestr();
  const usunieteRazem = [];
  for (let i = 0; i < MAKS_ZESTAWOW + 2; i += 1) {
    const { rejestr: r, usuniete } = dolozWpisRejestru(rejestr, wpis(`s${i}`, `2026-08-${String(i + 1).padStart(2, '0')} 10:00`), { bajty: 1000 });
    usunieteRazem.push(...usuniete);
    rejestr = r;
  }
  assert.equal(rejestr.wpisy.length, MAKS_ZESTAWOW);
  assert.deepEqual(usunieteRazem, ['s0', 's1'], 'wypadają dokładnie najstarsze daty');
  assert.equal(rejestr.wpisy.at(-1).skrot, `s${MAKS_ZESTAWOW + 1}`);
});

test('zestawy: budżet bajtowy przycina rejestr, gigant nie zostaje sam', () => {
  const { rejestr, usuniete } = dolozWpisRejestru(
    { schemat: SCHEMAT_INDEKSU, wpisy: [wpis('stary', '2026-01-01'), wpis('nowy', '2026-09-06')] },
    wpis('gigant', '2026-09-07'),
    { bajty: BUDZET_ZESTAWOW_BAJTY + 10 }, // sam przekracza budżet → wszystko wypada
  );
  assert.deepEqual(rejestr.wpisy, [], 'pojedynczy wpis ponad budżet nie zostaje');
  assert.deepEqual(usuniete, ['stary', 'nowy', 'gigant']);
  const mala = dolozWpisRejestru(nowyRejestr(), wpis('maly', '2026-09-06'), { bajty: 2048 });
  assert.equal(mala.rejestr.wpisy.length, 1);
  assert.deepEqual(mala.usuniete, []);
});

test('zestawy: ponowny zapis tego samego skrotu wymienia wpis, nie duplikuje', () => {
  const bazowy = { schemat: SCHEMAT_INDEKSU, wpisy: [wpis('a1', '2026-01-01')] };
  const { rejestr } = dolozWpisRejestru(bazowy, wpis('a1', '2026-09-06'), { bajty: 10 });
  assert.equal(rejestr.wpisy.length, 1);
  assert.equal(rejestr.wpisy[0].data, '2026-09-06');
});

test('zestawy: dopasowanie okolicy jest ścisłe (geohash5, promień, wiek, tematy)', () => {
  const rejestr = {
    schemat: SCHEMAT_INDEKSU,
    wpisy: [
      wpis('pasuje', '2026-09-06'),
      wpis('inny-geohash', '2026-09-06', { geohash5: 'u33db' }),
      wpis('inny-promien', '2026-09-06', { promienM: 3000 }),
      wpis('inny-wiek', '2026-09-06', { wiek: 'wiek-12' }),
      wpis('inne-tematy', '2026-09-06', { tematy: ['przyroda'] }),
      wpis('tematy-kolejnosc', '2026-09-05', { tematy: ['historia'] }),
    ],
  };
  const trafione = dopasujZestawy(rejestr, { geohash5: 'u33dc', promienM: 1000, tematy: ['historia'], wiek: 'dorosli' });
  assert.deepEqual(trafione.map((w) => w.skrot), ['pasuje', 'tematy-kolejnosc'], 'najnowsze pierwsze');
  assert.throws(() => dopasujZestawy(rejestr, { geohash5: 'u33', promienM: 1, tematy: ['x'], wiek: 'd' }), TypeError);
});

test('zestawy: plik publiczny wymaga licencji i przeglądu źródeł (ADR 0017 pkt 4)', () => {
  assert.deepEqual(walidujZestawPublicznySurowy(JSON.stringify(publiczny())).usterki, []);
  assert.equal(walidujZestawPublicznySurowy(JSON.stringify(publiczny({ schemat: 'TO-zestaw/0' }))).usterki[0].kod, 'Z07');
  const bezLicencji = publiczny(); bezLicencji.meta.licencja = '';
  assert.equal(walidujZestawPublicznySurowy(JSON.stringify(bezLicencji)).usterki[0].kod, 'Z08');
  const bezPrzegladu = publiczny(); delete bezPrzegladu.meta.przegladZrodel;
  assert.equal(walidujZestawPublicznySurowy(JSON.stringify(bezPrzegladu)).usterki[0].kod, 'Z08');
  assert.equal(walidujZestawPublicznySurowy(JSON.stringify(publiczny({ stacje: [] }))).usterki[0].kod, 'Z08');
  assert.equal(walidujZestawPublicznySurowy(JSON.stringify(publiczny({ kontener: null }))).usterki[0].kod, 'Z04');
});

test('zestawy: indeks publiczny niesie tylko meta i toleruje braki', () => {
  const indeks = { schemat: SCHEMAT_INDEKSU, wpisy: [{ ...wpis('p1', '2026-09-06'), licencja: 'CC BY-SA 4.0', plik: 'podkowa.zestaw.json' }, wpis('bez-pliku', '2026-09-06')] };
  const { indeks: odczytany, usterki } = walidujIndeksSurowy(JSON.stringify(indeks));
  assert.deepEqual(odczytany.map((w) => w.skrot), ['p1']);
  assert.equal(usterki[0].kod, 'Z10');
  assert.equal(walidujIndeksSurowy('null').usterki[0].kod, 'Z09');
  const trafione = dopasujMetaIndeksu(odczytany, { geohash5: 'u33dc', promienM: 1000, tematy: ['historia'], wiek: 'dorosli' });
  assert.equal(trafione.length, 1, 'dopasowanie indeksu tymi samymi regułami co lokalne');
});

test('zestawy: klucze i rozmiary są przewidywalne', () => {
  assert.equal(kluczZestawu('AB12 cd34!'), 'okolica:zestaw:ab12cd34');
  assert.equal(kluczZestawu(null), 'okolica:zestaw:brak');
  assert.equal(KLUCZ_REJESTRU, 'okolica:zestawy');
  assert.equal(KLUCZ_URL_REPO, 'okolica:repo-zestawow:url');
  assert.equal(DOMYSLNY_URL_INDEKSU, 'data/paczki/indeks.json', 'domyślny indeks ścieżką względną (Pages)');
  assert.equal(rozmiarBajty({ a: 'ą' }), JSON.stringify({ a: 'ą' }).length + 1, '„ą" to dwa bajty UTF-8');
  assert.throws(() => dolozWpisRejestru(nowyRejestr(), { skrot: 'x' }, { bajty: 1 }), TypeError);
  assert.throws(() => dolozWpisRejestru(nowyRejestr(), wpis('a', 'x'), { bajty: -1 }), TypeError);
});
