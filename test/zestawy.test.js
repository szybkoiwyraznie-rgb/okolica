/**
 * Testy `app/zestawy.js` (M9/R2) — czyste funkcje repozytorium paczek.
 * Bez DOM i bez localStorage: nośnik wstrzykuje warstwa DOM, tu liczy się
 * logika (walidacje surowe, dopasowanie okolicy, LRU z budżetem).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDZET_ZESTAWOW_BAJTY, KLUCZ_REJESTRU, KLUCZ_URL_REPO, TOLERANCJA_OKOLICY_M,
  MAKS_ZESTAWOW, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY, SCHEMAT_ZESTAWU,
  dolozWpisRejestru, dopasujMetaIndeksu, dopasujZestawy, kluczZestawu,
  nowyRejestr, rozmiarBajty, urlPaczkiZRepo, walidujIndeksSurowy, walidujRejestrSurowy,
  walidujZestawLokalnySurowy, walidujZestawPublicznySurowy,
} from '../app/zestawy.js';

const kontener = () => ({ schemat: 'TO-paczka/2', protokol: 'PYT/1.0', kodowanie: 'b64x1', skrot: 'ab12cd34', dane: 'e30' });
const meta = (nad = {}) => ({ geohash5: 'u33dc', promienM: 1000, tematy: ['historia'], wiek: 'dorosli', liczbaStacji: 5, pytaniaNaStacje: 1, ...nad });
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
  assert.equal(walidujZestawLokalnySurowy(JSON.stringify(lokalny({ liczbaStacji: 2.5 }))).usterki[0].kod, 'Z05');
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

test('zestawy: dopasowanie jest ścisłe (okolica, wiek, stacje, pytania, tematy) — promień NIE jest kryterium', () => {
  const rejestr = {
    schemat: SCHEMAT_INDEKSU,
    wpisy: [
      wpis('pasuje', '2026-09-06'),
      wpis('inny-geohash', '2026-09-06', { geohash5: 'u33db' }),
      wpis('inny-promien', '2026-09-06', { promienM: 3000 }),
      wpis('inny-wiek', '2026-09-06', { wiek: 'wiek-12' }),
      wpis('inne-tematy', '2026-09-06', { tematy: ['kultura'] }),
      wpis('tematy-kolejnosc', '2026-09-05', { tematy: ['historia'] }),
      wpis('podzbior', '2026-09-04', { tematy: ['historia', 'przyroda'] }),
      wpis('nadzbior', '2026-09-03', { tematy: ['historia', 'przyroda', 'architektura'] }),
      wpis('wiecej-stacji', '2026-09-02', { liczbaStacji: 6 }),
      wpis('wiecej-pytan', '2026-09-02', { pytaniaNaStacje: 2 }),
      wpis('wiekszy-promien', '2026-09-02', { promienM: 3000 }),
      wpis('mniejszy-promien', '2026-09-01', { promienM: 500 }),
    ],
  };
  const trafione = dopasujZestawy(rejestr, { geohash5: 'u33dc', promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia', 'przyroda'], wiek: 'dorosli' });
  // Promień nie jest kryterium (właściciel, 2026-09-07 — aneks ADR 0024):
  // nie wpływa na pytania, a trasę i tak wyznaczają stacje paczki.
  assert.deepEqual(
    trafione.map((w) => w.skrot),
    ['pasuje', 'inny-promien', 'tematy-kolejnosc', 'podzbior', 'wiekszy-promien', 'mniejszy-promien'],
    'kryteria: okolica, stacje, pytania, poziom, tematy⊆ — paczki o innym promieniu też pasują',
  );
  assert.throws(() => dopasujZestawy(rejestr, { geohash5: 'u33', promienM: 1, liczbaStacji: 1, pytaniaNaStacje: 1, tematy: ['x'], wiek: 'd' }), TypeError);
  assert.throws(() => dopasujZestawy(rejestr, { geohash5: 'u33dc', promienM: 1, liczbaStacji: 0, pytaniaNaStacje: 1, tematy: ['x'], wiek: 'd' }), TypeError);
});

test('zestawy: wpis z tematem własnym pasuje tylko do tego samego tekstu', () => {
  const rejestr = {
    schemat: SCHEMAT_INDEKSU,
    wpisy: [
      wpis('ten-sam', '2026-09-06', { tematy: ['historia', 'wlasny'], tematWlasny: 'Kinematografia' }),
      wpis('inny-tekst', '2026-09-06', { tematy: ['historia', 'wlasny'], tematWlasny: 'wędkarstwo' }),
      wpis('bez-wlasnego', '2026-09-06', { tematy: ['historia'] }),
    ],
  };
  const kryt = { geohash5: 'u33dc', promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia', 'wlasny'], wiek: 'dorosli' };
  assert.deepEqual(
    dopasujZestawy(rejestr, { ...kryt, tematWlasny: 'kinematografia' }).map((w) => w.skrot),
    ['ten-sam', 'bez-wlasnego'],
    'ten sam tekst (case-insensitive) + wpis bez własnego',
  );
  assert.deepEqual(
    dopasujZestawy(rejestr, kryt).map((w) => w.skrot),
    ['bez-wlasnego'],
    'bez tekstu własnego wpisy z wlasny odpadają',
  );
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
  const trafione = dopasujMetaIndeksu(odczytany, { geohash5: 'u33dc', promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia'], wiek: 'dorosli' });
  assert.equal(trafione.length, 1, 'dopasowanie indeksu tymi samymi regułami co lokalne');
});

test('zestawy: klucze i rozmiary są przewidywalne', () => {
  assert.equal(kluczZestawu('AB12 cd34!'), 'okolica:zestaw:ab12cd34');
  assert.equal(kluczZestawu(null), 'okolica:zestaw:brak');
  assert.equal(KLUCZ_REJESTRU, 'okolica:zestawy');
  assert.equal(KLUCZ_URL_REPO, 'okolica:repo-zestawow:url');
  assert.equal(rozmiarBajty({ a: 'ą' }), JSON.stringify({ a: 'ą' }).length + 1, '„ą" to dwa bajty UTF-8');
  assert.throws(() => dolozWpisRejestru(nowyRejestr(), { skrot: 'x' }, { bajty: 1 }), TypeError);
  assert.throws(() => dolozWpisRejestru(nowyRejestr(), wpis('a', 'x'), { bajty: -1 }), TypeError);
});

/* -------- M9b/D4: indeks Drive (wpisy z `id`) i adres paczki -------- */

test('walidujIndeksSurowy: wpis z `id` (most Drive) przechodzi jak wpis z `plik`', () => {
  const metaWpisu = {
    skrot: 'aabbccdd', miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', promienM: 1000,
    tematy: ['historia'], wiek: 'dorosli', liczbaStacji: 3, pytaniaNaStacje: 1,
    licencja: 'CC BY-SA 4.0', data: '2026-09-06 12:00',
  };
  const { indeks, usterki } = walidujIndeksSurowy(JSON.stringify({
    schemat: SCHEMAT_INDEKSU,
    wpisy: [{ ...metaWpisu, id: 'drive-001' }, { ...metaWpisu, plik: 'stary.zestaw.json' }],
  }));
  assert.equal(indeks.length, 2, 'id i plik są równoprawnymi wskazaniem paczki');
  assert.deepEqual(usterki, []);
});

test('walidujIndeksSurowy: wpis bez `plik` i bez `id` odpada z Z10', () => {
  const { indeks, usterki } = walidujIndeksSurowy(JSON.stringify({
    schemat: SCHEMAT_INDEKSU,
    wpisy: [{ skrot: 'aabbccdd', miejsce: 'X', geohash5: 'u3qb8', promienM: 1000, tematy: ['historia'], wiek: 'dorosli', liczbaStacji: 3, pytaniaNaStacje: 1, licencja: 'CC BY-SA 4.0', data: '2026-09-06 12:00' }],
  }));
  assert.deepEqual(indeks, [], 'wpis bez wskazania paczki jest bezużyteczny');
  assert.equal(usterki[0].kod, 'Z10');
});

test('urlPaczkiZRepo: `id` → baza bez query + akcja=paczka (kontrakt mostu Drive)', () => {
  assert.equal(
    urlPaczkiZRepo('https://script.google.com/macros/s/ABC/exec', { id: 'drive-001' }),
    'https://script.google.com/macros/s/ABC/exec?akcja=paczka&id=drive-001',
  );
  assert.equal(
    urlPaczkiZRepo('https://most/exec?akcja=indeks', { id: 'x y/1' }),
    'https://most/exec?akcja=paczka&id=x%20y%2F1',
    'stary query nie zostaje, a id jest zakodowane',
  );
});

test('urlPaczkiZRepo: `plik` względny skleja się z katalogiem, absolutny przechodzi', () => {
  assert.equal(urlPaczkiZRepo('https://repo.example/paczki/indeks.json', { plik: 'a.zestaw.json' }), 'https://repo.example/paczki/a.zestaw.json');
  assert.equal(urlPaczkiZRepo('https://repo.example/paczki/indeks.json', { plik: 'https://cdn.example/b.json' }), 'https://cdn.example/b.json');
});

/* ------ ADR 0024: okolica z tolerancją, nie „ten sam geohash albo nic" ------ */

import { geohash, przesunPunkt, ramkaGeohash } from '../app/geo.js';

// Scenariusz właściciela z 2026-09-07: zatwierdzona paczka dla Podkowy Leśnej
// nie pojawiała się na ekranie pozycji, bo start był o kilka metrów od pinu
// paczki — po drugiej stronie granicy komórki geohash. Punkty poniżej dzieli
// ~1 m, a ich geohash5 się różni (u3q8q vs u3q8w): dawna reguła gubiła paczkę.
const PODKOWA = { lat: 52.1141, lon: 20.6622 };
const RAMKA6 = ramkaGeohash(geohash(PODKOWA.lat, PODKOWA.lon, 6));
const GRACZ = { lat: RAMKA6.latMax - 1e-5, lon: (RAMKA6.lonMin + RAMKA6.lonMax) / 2 };
const START_PACZKI = { lat: RAMKA6.latMax + 1e-5, lon: GRACZ.lon };
const DALEKO = przesunPunkt(GRACZ, 0, 3000); // ~2,4 km od komórki geohash6 paczki
// Punkt 6 km na północ: już w innej komórce geohash5 (u3q8y), ~4,9 km od gracza.
// 3 km NIE wystarczą — geohash5 ma ≈3,0 × 4,9 km, więc sąsiednia komórka bywa tuż obok.
const DALEKO_GH5 = przesunPunkt(GRACZ, 0, 6000);

assert.notEqual(
  geohash(GRACZ.lat, GRACZ.lon, 5),
  geohash(START_PACZKI.lat, START_PACZKI.lon, 5),
  'test ma sens: punkty ~1 m od siebie mają RÓŻNY geohash5 (granica komórki)',
);

const kryteriaOkolicy = (nad = {}) => ({
  geohash5: geohash(GRACZ.lat, GRACZ.lon, 5),
  lat: GRACZ.lat,
  lon: GRACZ.lon,
  promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia'], wiek: 'dorosli',
  ...nad,
});

const rejestrZOkolica = (anchor, nad = {}) => dolozWpisRejestru(nowyRejestr(), wpis('okoliczna', '2026-09-07 10:00', {
  geohash5: geohash(anchor.lat, anchor.lon, 5),
  geohash6: geohash(anchor.lat, anchor.lon, 6),
  ...nad,
}), { bajty: 4096 }).rejestr;

test('dopasowanie okolicy: paczka kilka metrów dalej (za granicą geohasha) JEST widoczna (ADR 0024)', () => {
  assert.equal(TOLERANCJA_OKOLICY_M, 200, 'tolerancja zgodna z decyzją właściciela (100–200 m)');
  const trafione = dopasujZestawy(rejestrZOkolica(START_PACZKI), kryteriaOkolicy());
  assert.deepEqual(trafione.map((w) => w.skrot), ['okoliczna'], 'kilka metrów różnicy w starcie nie gubi paczki');
});

test('dopasowanie okolicy: paczka ~2,4 km dalej NIE jest widoczna (tolerancja to nie promień gry)', () => {
  assert.deepEqual(dopasujZestawy(rejestrZOkolica(DALEKO), kryteriaOkolicy()), [], 'granica tolerancji działa w obie strony');

  const bokiem = przesunPunkt(GRACZ, 270, 1000); // sąsiednia komórka geohash6, ~375 m od niej
  assert.deepEqual(dopasujZestawy(rejestrZOkolica(bokiem), kryteriaOkolicy()), [], '1 km w bok = już poza tolerancją 200 m');
});

test('dopasowanie okolicy: stare pliki bez geohash6 czytają się zgrubnie (komórka geohash5)', () => {
  // Wpis legacy: tylko geohash5 paczki. Gracz jest w sąsiedniej komórce geohash6,
  // ale w tej samej komórce geohash5 → odległość 0 → widoczna.
  const r = dolozWpisRejestru(nowyRejestr(), wpis('stara', '2026-08-01 10:00', {
    geohash5: geohash(GRACZ.lat, GRACZ.lon, 5),
  }), { bajty: 4096 }).rejestr;
  assert.deepEqual(dopasujZestawy(r, kryteriaOkolicy()).map((w) => w.skrot), ['stara'], 'brak geohash6 nie wyklucza paczki');

  const daleka = dolozWpisRejestru(nowyRejestr(), wpis('stara-daleka', '2026-08-01 10:00', {
    geohash5: geohash(DALEKO_GH5.lat, DALEKO_GH5.lon, 5),
  }), { bajty: 4096 }).rejestr;
  assert.deepEqual(dopasujZestawy(daleka, kryteriaOkolicy()), [], 'inna komórka geohash5 i >200 m od niej = nie pasuje');
});

test('dopasowanie okolicy: wpis legacy z tej samej komórki geohash5 pasuje nawet ~4 km dalej (udokumentowana zgrubność)', () => {
  // Konsekwencja ADR 0024 pkt 4: stary plik bez geohash6 nie ma dokładniejszej
  // kotwicy, więc „w komórce geohash5" = pasuje (to dawna reguła). Dlatego nowe
  // paczki niosą geohash6 — a dopóki ich nie ma, po pobraniu paczki UI mówi,
  // jak daleko są stacje.
  const trzyKm = przesunPunkt(GRACZ, 180, 3000); // 3 km na południe, ta sama komórka geohash5
  assert.equal(geohash(trzyKm.lat, trzyKm.lon, 5), geohash(GRACZ.lat, GRACZ.lon, 5), 'test ma sens: ta sama komórka geohash5');
  const r = dolozWpisRejestru(nowyRejestr(), wpis('stara-tez-okolica', '2026-08-01 10:00', {
    geohash5: geohash(trzyKm.lat, trzyKm.lon, 5),
  }), { bajty: 4096 }).rejestr;
  assert.deepEqual(dopasujZestawy(r, kryteriaOkolicy()).map((w) => w.skrot), ['stara-tez-okolica']);
});

test('dopasowanie okolicy: bez podanej pozycji działa dawna reguła (rejestr lokalny, testy)', () => {
  const bezPozycji = { geohash5: geohash(START_PACZKI.lat, START_PACZKI.lon, 5), promienM: 1000, liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia'], wiek: 'dorosli' };
  assert.deepEqual(dopasujZestawy(rejestrZOkolica(START_PACZKI), bezPozycji).map((w) => w.skrot), ['okoliczna'], 'ten sam geohash5 = pasuje');
  assert.deepEqual(dopasujZestawy(rejestrZOkolica(START_PACZKI), { ...bezPozycji, geohash5: geohash(GRACZ.lat, GRACZ.lon, 5) }), [], 'inny geohash5 = nie pasuje');
});

test('zbierzMetaZestawu niesie geohash6 (kotwica tolerancji dla nowych paczek)', async () => {
  const { zbierzMetaZestawu } = await import('../app/zestawy.js');
  const m = zbierzMetaZestawu({ lat: PODKOWA.lat, lon: PODKOWA.lon, promienM: 1000, tematy: ['historia'], wiek: 'dorosli', liczbaStacji: 5, pytaniaNaStacje: 1, data: '2026-09-07 10:00' });
  assert.equal(m.geohash5, geohash(PODKOWA.lat, PODKOWA.lon, 5));
  assert.equal(m.geohash6, geohash(PODKOWA.lat, PODKOWA.lon, 6));
});

test('zestawy: powodyNiedopasowania mówi wprost, które kryterium nie zagrało', async () => {
  const { powodyNiedopasowania, czyWOkolicy, odlegloscWpisuM } = await import('../app/zestawy.js');
  const { geohash } = await import('../app/geo.js');
  const PODKOWA = { lat: 52.12303, lon: 20.74614 };
  const LODZ = { lat: 51.7592, lon: 19.4560 };
  const wpis = (nad = {}) => ({
    skrot: 'abcd1234', miejsce: 'Podkowa Leśna', geohash5: geohash(PODKOWA.lat, PODKOWA.lon, 5),
    geohash6: geohash(PODKOWA.lat, PODKOWA.lon, 6), promienM: 1000, tematy: ['historia'], wiek: 'dorosli',
    liczbaStacji: 5, pytaniaNaStacje: 1, data: '2026-09-06 19:30', ...nad,
  });
  const kryteria = (p, nad = {}) => ({
    geohash5: geohash(p.lat, p.lon, 5), lat: p.lat, lon: p.lon,
    wiek: 'dorosli', liczbaStacji: 5, pytaniaNaStacje: 1, tematy: ['historia', 'przyroda'], ...nad,
  });

  assert.deepEqual(powodyNiedopasowania(wpis(), kryteria(PODKOWA)), [], 'identyczny setup = zero powodów');
  assert.equal(czyWOkolicy(wpis(), kryteria(PODKOWA)), true, 'ta sama okolica');

  const daleko = powodyNiedopasowania(wpis(), kryteria(LODZ));
  assert.equal(daleko.length, 1, 'z Łodzi nie pasuje tylko okolica');
  assert.match(daleko[0], /inna okolica — paczka powstała 9[0-9](\.[0-9])? km stąd/, 'podaje odległość w km');
  assert.ok(odlegloscWpisuM(wpis(), kryteria(LODZ)) > 90_000, 'ponad 90 km — daleko poza tolerancją 200 m');

  assert.match(powodyNiedopasowania(wpis({ wiek: 'wiek-12' }), kryteria(PODKOWA))[0], /wiek: paczka „wiek-12", setup „dorosli"/);
  assert.match(powodyNiedopasowania(wpis({ pytaniaNaStacje: 2 }), kryteria(PODKOWA))[0], /pytania na stację: paczka 2, setup 1/);
  assert.match(powodyNiedopasowania(wpis({ liczbaStacji: 3 }), kryteria(PODKOWA))[0], /liczba stacji: paczka 3, setup 5/);
  assert.match(powodyNiedopasowania(wpis({ tematy: ['kultura'] }), kryteria(PODKOWA))[0], /tematy spoza setupu: kultura/);
  assert.equal(
    powodyNiedopasowania(wpis({ promienM: 5000 }), kryteria(PODKOWA, { promienM: 500 })).length, 0,
    'promień setupu i paczki nie są kryterium — zero powodów',
  );
  const kilka = powodyNiedopasowania(wpis({ wiek: 'wiek-12', liczbaStacji: 3 }), kryteria(PODKOWA));
  assert.equal(kilka.length, 2, 'kilka niezgodności = kilka powodów, każdy nazwany');
});
