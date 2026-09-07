/**
 * Testy kanonu konfiguracji (app/konfig.js): wartości domyślne, walidacja
 * setupu (kody K**), ziarno rozgrywki i deterministyczny RNG.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DOMYSLNE, JEZYKI, OGRANICZENIA, PODKLADY, TEMATY, TRYBY, WIEK, WSPOLPRACA, domyslnaKonfiguracja, liczbaPytan, oczyscKonfiguracje, proponujKodGry, rngZZiarna, walidujSetup, ziarnoRozgrywki } from '../app/konfig.js';

test('TRYBY: trzy tryby z briefu właściciela i promienie 1/3/10 km', () => {
  assert.deepEqual(Object.keys(TRYBY), ['piesza', 'rower', 'samochodowa']);
  assert.equal(TRYBY.piesza.promienM, 1000);
  assert.equal(TRYBY.rower.promienM, 3000);
  assert.equal(TRYBY.samochodowa.promienM, 10000);
  // zoomy szczegółu wg ADR 0003 pkt 5
  assert.equal(TRYBY.piesza.zoom, 17);
  assert.equal(TRYBY.rower.zoom, 15);
  assert.equal(TRYBY.samochodowa.zoom, 13);
  // tryb samochodowy nie stawia stacji na jezdni
  assert.equal(TRYBY.samochodowa.wymagaParkingu, true);
  assert.ok(!TRYBY.samochodowa.klasyDrog.includes('footway'));
  // rowerem nie jedzie się po schodach
  assert.ok(TRYBY.rower.wykluczoneKlasy.includes('steps'));
  for (const tryb of Object.values(TRYBY)) {
    assert.ok(tryb.etykieta && tryb.ikona && tryb.opis, 'tryb musi mieć etykietę, ikonę i opis');
    assert.ok(tryb.klasyDrog.length > 0);
  }
});

test('WIEK: pięć kategorii z briefu, punkty rosną z wiekiem', () => {
  assert.deepEqual(Object.keys(WIEK), ['7', '10', '12', '15', 'dorosli']);
  assert.equal(WIEK[7].punkty, 10);
  assert.equal(WIEK[12].punkty, 15);
  assert.equal(WIEK.dorosli.punkty, 20);
  for (const [klucz, kategoria] of Object.entries(WIEK)) {
    assert.ok(kategoria.opisTrudnosci.length > 40, `${klucz}: opis trudności trafia do promptu i musi być konkretny`);
    assert.ok(kategoria.etykieta);
  }
  // kategoria dziecięca nie może wymagać dat i liczb
  assert.ok(WIEK[7].opisTrudnosci.includes('bez dat'));
});

test('TEMATY: kanon 11 tematów, klucze zgodne z formatem (małe litery, myślniki)', () => {
  assert.equal(Object.keys(TEMATY).length, 11);
  for (const [klucz, temat] of Object.entries(TEMATY)) {
    assert.match(klucz, /^[a-z0-9-]+$/, `klucz tematu "${klucz}"`);
    assert.ok(temat.etykieta && temat.opis, `temat ${klucz} musi mieć etykietę i opis do promptu`);
  }
  for (const oczekiwany of ['historia', 'przyroda', 'architektura', 'kultura', 'legendy', 'ludzie', 'nauka', 'sport', 'jedzenie', 'geografia', 'wlasny']) {
    assert.ok(TEMATY[oczekiwany], `brak tematu ${oczekiwany}`);
  }
});

test('PODKLADY: klucze zgodne z docs/ASSETS.md, brak dostawców z kluczem API', () => {
  assert.deepEqual(Object.keys(PODKLADY), ['osm', 'opentopo', 'esri-satelita', 'brak']);
  for (const [klucz, podklad] of Object.entries(PODKLADY)) {
    if (klucz === 'brak') continue;
    assert.ok(podklad.atrybucja.length > 5, `${klucz}: atrybucja jest wymagana (ODbL / CC-BY-SA)`);
    assert.ok(podklad.maxZoom >= 17);
  }
  // CARTO wymaga klucza API (ASSETS §1.1) — nie może wrócić do kanonu
  assert.ok(!Object.keys(PODKLADY).some((k) => /carto|voyager|positron/i.test(k)));
});

test('domyslnaKonfiguracja: 1 gracz, 5 stacji, dorośli, pieszo, zgodnie z briefem', () => {
  const k = domyslnaKonfiguracja();
  assert.equal(k.tryb, 'piesza');
  assert.equal(k.promienM, 1000);
  assert.equal(k.liczbaGraczy, 1);
  assert.equal(k.liczbaStacji, 5);
  assert.equal(k.pytaniaNaStacje, 1);
  assert.equal(k.wiek, 'dorosli');
  assert.equal(k.jezyk, 'polski');
  assert.equal(k.karaRecznaS, 60);
  assert.deepEqual(k.imiona, ['Gracz 1']);
  assert.equal(k.geokodacja, false, 'geokodacja domyślnie wyłączona (ADR 0013 pkt 3)');
  assert.deepEqual(k.tematy, ['historia', 'przyroda', 'architektura', 'kultura', 'legendy', 'ludzie', 'nauka', 'sport', 'jedzenie', 'geografia'], 'domyślnie wszystkie tematy zaznaczone (decyzja z 2026-09-07)');
  assert.deepEqual(walidujSetup(k), []);

  const cztery = domyslnaKonfiguracja(4);
  assert.equal(cztery.imiona.length, 4);
  assert.equal(cztery.liczbaGraczy, 4);
  assert.ok(domyslnaKonfiguracja(99).liczbaGraczy <= OGRANICZENIA.liczbaGraczy.max);
});

test('domyslnaKonfiguracja: śmieciowa liczba graczy nie przepuszcza NaN (znalezione w M1)', () => {
  // `Math.max(1, NaN)` = NaN: liczba graczy wchodziła do formularza jako „NaN",
  // lista imion była pusta, a `nowaRozgrywka` nie miałaby ani jednego gracza.
  for (const smiec of ['dużo', NaN, 'abc', {}, null, undefined, '']) {
    const k = domyslnaKonfiguracja(smiec);
    assert.ok(Number.isInteger(k.liczbaGraczy), `liczbaGraczy dla ${JSON.stringify(smiec)} = ${k.liczbaGraczy}`);
    assert.ok(k.liczbaGraczy >= OGRANICZENIA.liczbaGraczy.min && k.liczbaGraczy <= OGRANICZENIA.liczbaGraczy.max);
    assert.equal(k.imiona.length, k.liczbaGraczy, `imiona dla ${JSON.stringify(smiec)}`);
    assert.deepEqual(walidujSetup(k), [], `konfiguracja po oczyszczeniu ${JSON.stringify(smiec)} musi być grywalna`);
  }
  assert.equal(domyslnaKonfiguracja(null).liczbaGraczy, DOMYSLNE.liczbaGraczy, 'null to nie „zero graczy", tylko brak danych');
  assert.equal(domyslnaKonfiguracja(2.6).liczbaGraczy, 3, 'ułamek jest zaokrąglany, nie ucinany');
  assert.equal(domyslnaKonfiguracja('3').liczbaGraczy, 3, 'liczba jako tekst z localStorage działa');
});

test('liczbaPytan: stacje × pytania na stację (protokół §3.1)', () => {
  assert.equal(liczbaPytan({ liczbaStacji: 5, pytaniaNaStacje: 1 }), 5);
  assert.equal(liczbaPytan({ liczbaStacji: 5, pytaniaNaStacje: 2 }), 10);
});

test('walidujSetup: przyjmuje poprawną i odrzuca każdą klasę błędu', () => {
  const baza = domyslnaKonfiguracja(2);
  assert.deepEqual(walidujSetup(baza), []);

  const kody = (k) => walidujSetup(k).map((u) => u.kod);

  assert.ok(kody({ ...baza, tryb: 'lotnia' }).includes('K02'));
  assert.ok(kody({ ...baza, wiek: 'seniorzy' }).includes('K03'));
  assert.ok(kody({ ...baza, jezyk: 'klingon' }).includes('K04'));
  assert.ok(kody({ ...baza, podklad: 'google' }).includes('K06'));
  assert.ok(kody({ ...baza, liczbaGraczy: 0 }).includes('K07'));
  assert.ok(kody({ ...baza, liczbaGraczy: 9 }).includes('K07'));
  assert.ok(kody({ ...baza, imiona: ['Ala'] }).includes('K08'));
  assert.ok(kody({ ...baza, imiona: ['Ala', 'Ala'] }).includes('K09'));
  assert.ok(kody({ ...baza, imiona: ['', 'Ala'] }).includes('K08'));
  assert.ok(kody({ ...baza, liczbaStacji: 2 }).includes('K10'));
  assert.ok(kody({ ...baza, liczbaStacji: 13 }).includes('K10'));
  assert.ok(kody({ ...baza, pytaniaNaStacje: 4 }).includes('K11'));
  assert.ok(kody({ ...baza, promienM: 50 }).includes('K12'));
  assert.ok(kody({ ...baza, promienM: 99999 }).includes('K12'));
  assert.ok(kody({ ...baza, tematy: [] }).includes('K14'));
  assert.ok(kody({ ...baza, tematy: ['historia', 'historia'] }).includes('K16'));
  assert.ok(kody({ ...baza, tematy: ['kosmos'] }).includes('K15'));
  assert.ok(kody({ ...baza, karaRecznaS: 9999 }).includes('K17'));
  assert.ok(kody({ ...baza, kodGry: 'AB' }).includes('K18'));
  assert.ok(kody({ ...baza, kodGry: '' }).length === 0, 'pusty kod gry jest dozwolony (gra bez ukrywania pytań)');
  assert.ok(kody({ ...baza, limitCzasuOdcinkaS: -5 }).includes('K19'));
  assert.ok(kody({ ...baza, geokodacja: 'tak' }).includes('K20'));
  assert.ok(kody({ ...baza, tematy: ['historia', 'wlasny'], tematWlasny: '' }).includes('K21'), 'wlasny bez tekstu to K21');
  assert.ok(!kody({ ...baza, tematy: ['historia', 'wlasny'], tematWlasny: 'kinematografia' }).includes('K21'), 'wlasny z tekstem przechodzi');
  assert.ok(kody(null).includes('K01'));
});

test('walidujSetup: pieszo z promieniem 30 km dostaje ostrzeżenie K13', () => {
  const k = { ...domyslnaKonfiguracja(), promienM: 30000 };
  assert.ok(walidujSetup(k).some((u) => u.kod === 'K13'));
  assert.ok(!walidujSetup({ ...k, tryb: 'samochodowa' }).some((u) => u.kod === 'K13'));
});

test('ziarnoRozgrywki: deterministyczne i zaokrągla pozycję do ~5 m', () => {
  const a = ziarnoRozgrywki({ lat: 52.229700, lon: 21.012200, promienM: 1000, liczbaStacji: 5, data: '2026-09-05' });
  const b = ziarnoRozgrywki({ lat: 52.229701, lon: 21.012201, promienM: 1000, liczbaStacji: 5, data: '2026-09-05' });
  const c = ziarnoRozgrywki({ lat: 52.230000, lon: 21.012200, promienM: 1000, liczbaStacji: 5, data: '2026-09-05' });
  assert.equal(a, b, 'drganie GPS poniżej 5 m nie zmienia ziarna');
  assert.notEqual(a, c, 'inne miejsce = inne ziarno');
  assert.match(a, /^okolica:52\.22970:21\.01220:1000:5:2026-09-05$/);
});

test('rngZZiarna: to samo ziarno → ten sam ciąg, wartości w [0,1)', () => {
  const a = rngZZiarna('test');
  const b = rngZZiarna('test');
  const c = rngZZiarna('test2');
  const ciagA = Array.from({ length: 5 }, () => a());
  const ciagB = Array.from({ length: 5 }, () => b());
  const ciagC = Array.from({ length: 5 }, () => c());
  assert.deepEqual(ciagA, ciagB);
  assert.notDeepEqual(ciagA, ciagC);
  for (const v of ciagA) assert.ok(v >= 0 && v < 1);
});

test('proponujKodGry: 6 znaków bez znaków mylonych wzrokowo, deterministyczny pod RNG', () => {
  const kod = proponujKodGry(rngZZiarna('ziarno-kodu'));
  assert.equal(kod.length, 6);
  assert.match(kod, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/);
  assert.equal(proponujKodGry(rngZZiarna('ziarno-kodu')), kod);
  assert.equal(proponujKodGry(rngZZiarna('x'), OGRANICZENIA.dlugoscKoduGry.max).length, 8);
});

test('kanony są zamknięte: współpraca, języki i ograniczenia mają sens', () => {
  assert.deepEqual(Object.keys(WSPOLPRACA), ['solo', 'zespol', 'wszyscy']);
  assert.equal(DOMYSLNE.wspolpraca, 'zespol');
  assert.ok(JEZYKI.polski === 'polski');
  assert.equal(OGRANICZENIA.liczbaGraczy.max, 8);
  assert.equal(OGRANICZENIA.liczbaStacji.min, 3);
  assert.equal(OGRANICZENIA.promienM.max, 50000);
});

test('oczyscKonfiguracje: stany z localStorage nie wysypują UI (LESSONS L9)', () => {
  const d = domyslnaKonfiguracja();
  assert.deepEqual(oczyscKonfiguracje(null), d);
  assert.deepEqual(oczyscKonfiguracje({}), d);
  assert.deepEqual(oczyscKonfiguracje('śmieci'), d);

  // klucz spoza kanonu wraca do wartości domyślnej, nie do `undefined`
  const zle = oczyscKonfiguracje({ tryb: 'konny', wiek: 'nestor', podklad: 'carto', jezyk: 'klingon', wspolpraca: 'telepatia' });
  assert.equal(zle.tryb, d.tryb);
  assert.equal(zle.wiek, d.wiek);
  assert.equal(zle.podklad, d.podklad);
  assert.equal(zle.jezyk, d.jezyk);
  assert.equal(zle.wspolpraca, d.wspolpraca);

  // liczby: zacisk do widełek, NaN odrzucony, tekst liczbowy z inputa przyjęty
  assert.equal(oczyscKonfiguracje({ liczbaStacji: 99 }).liczbaStacji, OGRANICZENIA.liczbaStacji.max);
  assert.equal(oczyscKonfiguracje({ liczbaGraczy: -3 }).liczbaGraczy, 1);
  assert.equal(oczyscKonfiguracje({ promienM: Number.NaN }).promienM, d.promienM);
  assert.equal(oczyscKonfiguracje({ karaRecznaS: '120' }).karaRecznaS, 120);

  // listy: tylko kanon; pusty wynik → domyślne tematy
  assert.deepEqual(oczyscKonfiguracje({ tematy: ['historia', 'kosmos'] }).tematy, ['historia']);
  assert.deepEqual(oczyscKonfiguracje({ tematy: ['nauka-i-technika', 'historia', 'nauka'] }).tematy, ['nauka', 'historia'], 'aliasy mapowane na klucze kanoniczne z deduplikacją');
  assert.equal(oczyscKonfiguracje({ tematWlasny: '  Wędkarstwo  ' }).tematWlasny, 'Wędkarstwo', 'tekst własny przycięty');
  assert.equal(oczyscKonfiguracje({}).tematWlasny, '', 'brak tekstu to pusty łańcuch');
  assert.deepEqual(oczyscKonfiguracje({ tematy: ['kosmos'] }).tematy, d.tematy);
  assert.deepEqual(oczyscKonfiguracje({ liczbaGraczy: 3, imiona: ['Ada', '   '] }).imiona, ['Ada', 'Gracz 2', 'Gracz 3']);
  // tekst zamiast liczby: `Number("dużo")` = NaN, więc pole ma wrócić do domyślnej
  const smieciowaLiczba = oczyscKonfiguracje({ liczbaGraczy: 'dużo', liczbaStacji: 'pięć', pytaniaNaStacje: null });
  assert.equal(smieciowaLiczba.liczbaGraczy, DOMYSLNE.liczbaGraczy);
  assert.equal(smieciowaLiczba.liczbaStacji, DOMYSLNE.liczbaStacji);
  assert.equal(smieciowaLiczba.pytaniaNaStacje, DOMYSLNE.pytaniaNaStacje);
  assert.equal(smieciowaLiczba.imiona.length, smieciowaLiczba.liczbaGraczy);
  assert.deepEqual(walidujSetup(smieciowaLiczba), []);

  // geokodacja domyślnie wyłączona i tylko jako `true` (ADR 0013 pkt 3)
  assert.equal(oczyscKonfiguracje({ geokodacja: 'tak' }).geokodacja, false);
  assert.equal(oczyscKonfiguracje({ geokodacja: true }).geokodacja, true);

  // kod gry przycięty do limitu
  assert.equal(oczyscKonfiguracje({ kodGry: '  ABCDEFGHIJK  ' }).kodGry.length, OGRANICZENIA.dlugoscKoduGry.max);
});
