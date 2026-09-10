/**
 * Testy kanonu konfiguracji (app/konfig.js): wartości domyślne, walidacja
 * setupu (kody K**), ziarno rozgrywki i deterministyczny RNG.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DOMYSLNE, JEZYKI, OGRANICZENIA, PARAMETRY_CZASU, PODKLADY, TEMATY, TEMATY_SETUP, TRYBY, WIEK, WIEK_SETUP, konfiguracjaNowegoSetupu, domyslnaKonfiguracja, domyslnyKodGry, liczbaPytan, oczyscKonfiguracje, przeliczenieCzasu, promienZCzasuGry, rngZZiarna, walidujSetup, ziarnoRozgrywki } from '../app/konfig.js';

test('TRYBY: trzy tryby z briefu właściciela, prędkości 4,5/15/40 km/h, bez własnego promienia (ADR 0025)', () => {
  assert.deepEqual(Object.keys(TRYBY), ['piesza', 'rower', 'samochodowa']);
  // Promień nie jest już cechą trybu: liczy się z planowanego czasu gry
  // (ADR 0025). Z trybu zostaje prędkość — to ona wchodzi do wzoru.
  assert.equal(TRYBY.piesza.predkoscKmh, 4.5);
  assert.equal(TRYBY.rower.predkoscKmh, 15);
  assert.equal(TRYBY.samochodowa.predkoscKmh, 40);
  for (const tryb of Object.values(TRYBY)) {
    assert.equal(tryb.promienM, undefined, `${tryb.etykieta}: promień trybu usunięty`);
  }
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

test('WIEK: pięć kategorii z briefu, bez wagi punktowej (rev2: 1 pkt za pytanie)', () => {
  assert.deepEqual(Object.keys(WIEK), ['7', '10', '12', '15', 'dorosli']);
  for (const [klucz, kategoria] of Object.entries(WIEK)) {
    assert.ok(kategoria.opisTrudnosci.length > 40, `${klucz}: opis trudności trafia do promptu i musi być konkretny`);
    assert.ok(kategoria.etykieta);
    assert.deepEqual(Object.keys(kategoria).sort(), ['etykieta', 'opisTrudnosci'], `${klucz}: koniec wagi trudności`);
  }
  // kategoria dziecięca nie może wymagać dat i liczb
  assert.ok(WIEK[7].opisTrudnosci.includes('bez dat'));
});

test('TEMATY: kanon odczytu 12 tematów, klucze zgodne z formatem (małe litery, myślniki)', () => {
  assert.equal(Object.keys(TEMATY).length, 12);
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
  assert.equal(k.czasGryMin, 60, 'domyślny planowany czas gry: 60 min (decyzja właściciela 2026-09-07)');
  assert.equal(k.promienM, 500, 'kalibracja właściciela: 60 min pieszo, 5 stacji × 1 pytanie → ~500 m');
  assert.equal(k.liczbaGraczy, 1);
  assert.equal(k.liczbaStacji, 5);
  assert.equal(k.pytaniaNaStacje, 1);
  assert.equal(k.wiek, 'dorosli');
  assert.equal(k.jezyk, 'polski');
  assert.equal(k.karaRecznaS, undefined, 'koniec kary czasowej (Partia 2: zero presji czasowej)');
  assert.equal(k.limitCzasuOdcinkaS, undefined, 'koniec limitu czasu odcinka (Partia 2)');
  assert.deepEqual(k.imiona, ['Gracz 1']);
  assert.equal(k.geokodacja, undefined, 'brak opcji geokodacji — nazwa miejsca zawsze pobierana (ADR 0013 pkt 3 po Partii 2)');
  assert.deepEqual(k.tematy, ['architektura', 'ciekawostki', 'geografia', 'historia', 'kultura', 'legendy', 'ludzie', 'nauka', 'przyroda'], 'domyślnie wszystkie tematy NOWEGO setupu, alfabetycznie (ADR 0034; do 2026-09-10: 10 tematów starego kanonu)');
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
  assert.ok(kody({ ...baza, pytaniaNaStacje: 9 }).includes('K11'), 'widełki pytań sięgają MAKS_GRACZY (ADR 0027)');
  assert.ok(kody({ ...baza, promienM: 50 }).includes('K12'));
  assert.ok(kody({ ...baza, promienM: 99999 }).includes('K12'));
  assert.ok(kody({ ...baza, tematy: [] }).includes('K14'));
  assert.ok(kody({ ...baza, tematy: ['historia', 'historia'] }).includes('K16'));
  assert.ok(kody({ ...baza, tematy: ['kosmos'] }).includes('K15'));
  assert.ok(kody({ ...baza, kodGry: 'AB' }).includes('K18'));
  assert.ok(kody({ ...baza, kodGry: '' }).length === 0, 'pusty kod gry jest dozwolony (gra bez ukrywania pytań)');
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

test('domyslnyKodGry: slug z imion, miejsca i daty z godziną (Partia 2, pkt 7)', () => {
  const kiedy = new Date(2026, 8, 7, 14, 32);
  const kod = domyslnyKodGry({ imiona: ['Ala', 'Łukasz'], miejsce: 'Podkowa Leśna, Polska', teraz: kiedy });
  assert.equal(kod, 'ala-lukasz-podkowa-lesna-0709-1432');
  assert.match(kod, /^[a-z0-9-]+$/, 'bezpieczny do nazw plików i kluczy');
  assert.ok(kod.length <= OGRANICZENIA.dlugoscKoduGry.max);
  assert.equal(
    domyslnyKodGry({ imiona: [], miejsce: '', teraz: kiedy }),
    'gra-teren-0709-1432',
    'sensowne zapasy przy braku danych',
  );
});

test('kanony są zamknięte: języki i ograniczenia mają sens (współpraca usunięta — ADR 0022)', () => {
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
  const zle = oczyscKonfiguracje({ tryb: 'konny', wiek: 'nestor', podklad: 'carto', jezyk: 'klingon' });
  assert.equal(zle.tryb, d.tryb);
  assert.equal(zle.wiek, d.wiek);
  assert.equal(zle.podklad, d.podklad);
  assert.equal(zle.jezyk, d.jezyk);

  // liczby: zacisk do widełek, NaN odrzucony, tekst liczbowy z inputa przyjęty
  assert.equal(oczyscKonfiguracje({ liczbaStacji: 99 }).liczbaStacji, OGRANICZENIA.liczbaStacji.max);
  assert.equal(oczyscKonfiguracje({ liczbaGraczy: -3 }).liczbaGraczy, 1);
  assert.equal(oczyscKonfiguracje({ promienM: Number.NaN }).promienM, d.promienM);

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


  // kod gry przycięty do limitu
  assert.equal(oczyscKonfiguracje({ kodGry: '  ' + 'A'.repeat(50) + '  ' }).kodGry.length, OGRANICZENIA.dlugoscKoduGry.max);
});

/* ------------ ADR 0025: promień liczony z planowanego czasu gry ------------ */

test('promienZCzasuGry: punkt kalibracyjny właściciela (60 min, pieszo, 5 pytań → 500 m)', () => {
  const r = przeliczenieCzasu({ czasGryMin: 60, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 });
  assert.equal(r.promienM, 500, `wyszło ${r.promienM} m`);
  assert.equal(promienZCzasuGry({ czasGryMin: 60, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 }), 500);
  // składowe mają być jawne — UI pokazuje je jako uzasadnienie promienia
  assert.equal(r.pytania, 5);
  assert.equal(r.czasOdpowiedziMin, 7.5, '5 pytań × 90 s');
  assert.ok(r.czasDrogiMin > 0 && r.trasaM > 0, 'reszta czasu idzie na drogę');
});

test('promienZCzasuGry: dłuższy czas i szybszy tryb dają większy promień, więcej pytań mniejszy', () => {
  const baza = { czasGryMin: 60, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 };
  const krotko = promienZCzasuGry({ ...baza, czasGryMin: 30 });
  const dlugo = promienZCzasuGry({ ...baza, czasGryMin: 120 });
  assert.ok(krotko < 500 && 500 < dlugo, `30 min → ${krotko} m, 120 min → ${dlugo} m`);
  assert.ok(promienZCzasuGry({ ...baza, tryb: 'rower' }) > 500, 'rower jest szybszy = dalej');
  assert.ok(promienZCzasuGry({ ...baza, tryb: 'samochodowa' }) > promienZCzasuGry({ ...baza, tryb: 'rower' }));
  assert.ok(promienZCzasuGry({ ...baza, pytaniaNaStacje: 3 }) < 500, 'więcej pytań = mniej czasu na drogę');
  assert.ok(promienZCzasuGry({ ...baza, liczbaStacji: 12 }) < promienZCzasuGry({ ...baza, liczbaStacji: 3 }), 'więcej stacji = gęstsza trasa');
});

test('promienZCzasuGry: wynik zawsze w widełkach OGRANICZENIA.promienM i zaokrąglony do kroku', () => {
  for (const czasGryMin of [1, 10, 45, 60, 180, 480, 5000]) {
    for (const tryb of Object.keys(TRYBY)) {
      const r = promienZCzasuGry({ czasGryMin, tryb, liczbaStacji: 12, pytaniaNaStacje: 3 });
      assert.ok(r >= OGRANICZENIA.promienM.min && r <= OGRANICZENIA.promienM.max, `${czasGryMin} min ${tryb} → ${r} m`);
      assert.equal(r % PARAMETRY_CZASU.krokM, 0, `${r} m nie jest wielokrotnością kroku`);
    }
  }
  // całe pytanie potrafi zjeść cały czas — wtedy zostaje minimum, nie NaN ani 0
  assert.equal(promienZCzasuGry({ czasGryMin: 1, tryb: 'piesza', liczbaStacji: 12, pytaniaNaStacje: 3 }), OGRANICZENIA.promienM.min);
});

test('walidujSetup: K19 dla czasu gry poza widełkami, cisza dla wartości z kanonu', () => {
  const baza = domyslnaKonfiguracja(2);
  const kody = (k) => walidujSetup(k).map((u) => u.kod);
  assert.ok(OGRANICZENIA.czasGryMin.min > 0 && OGRANICZENIA.czasGryMin.max >= 480);
  assert.ok(kody({ ...baza, czasGryMin: 0 }).includes('K19'), 'zero minut to nie plan');
  assert.ok(kody({ ...baza, czasGryMin: 5000 }).includes('K19'), 'ponad maksimum');
  assert.ok(kody({ ...baza, czasGryMin: Number.NaN }).includes('K19'), 'NaN z wyczyszczonego pola');
  assert.ok(!kody({ ...baza, czasGryMin: 90 }).includes('K19'), '90 min jest w widełkach');
  assert.ok(!kody(baza).includes('K19'), 'domyślny setup jest poprawny');
});

test('oczyscKonfiguracje: promień zawsze wynika z czasu, trybu i liczby pytań (ADR 0025)', () => {
  const zCzasem = oczyscKonfiguracje({ czasGryMin: 120, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 });
  assert.equal(zCzasem.czasGryMin, 120);
  assert.equal(zCzasem.promienM, promienZCzasuGry({ czasGryMin: 120, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 }));
  // stary zapis bez czasu gry (sprzed ADR 0025) dostaje domyślne 60 min i promień z nich
  const stary = oczyscKonfiguracje({ promienM: 5000, tryb: 'piesza', liczbaStacji: 5, pytaniaNaStacje: 1 });
  assert.equal(stary.czasGryMin, DOMYSLNE.czasGryMin, 'migracja: brak czasu gry = 60 min');
  assert.equal(stary.promienM, 500, 'stary promień nie jest już źródłem prawdy');
  assert.equal(oczyscKonfiguracje({ czasGryMin: 99999 }).czasGryMin, OGRANICZENIA.czasGryMin.max, 'zacisk do widełek');
  assert.equal(oczyscKonfiguracje({ czasGryMin: 'nie-liczba' }).czasGryMin, DOMYSLNE.czasGryMin, 'śmieci z inputa = domyślne');
});

/* ---- ADR 0027: pytania po równo na gracza (hot-seat) ---- */

test('pytania dzielą się równo między graczy: K22 dla reszty, cisza dla pełnego podziału', () => {
  const kody = (k) => walidujSetup(k).map((u) => u.kod);
  const baza = domyslnaKonfiguracja(2); // 5 stacji × 2 pytania = 10 → 10 % 2 = 0
  assert.equal(baza.pytaniaNaStacje, 2, 'domyślnie każdy gracz odpowiada raz przy każdej stacji');
  assert.ok(!kody(baza).includes('K22'), 'domyślny setup 2 graczy jest poprawny');

  assert.ok(kody({ ...baza, liczbaStacji: 3, pytaniaNaStacje: 1 }).includes('K22'), '3 × 1 = 3 pytania dla 2 graczy — nie dzieli się');
  assert.ok(kody({ ...baza, liczbaStacji: 5, pytaniaNaStacje: 1 }).includes('K22'), '5 pytań dla 2 graczy — nie dzieli się');
  assert.ok(!kody({ ...baza, liczbaStacji: 4, pytaniaNaStacje: 1 }).includes('K22'), '4 × 1 = 4 dla 2 graczy — po 2 pytania');
  assert.ok(!kody({ ...baza, liczbaStacji: 3, pytaniaNaStacje: 2 }).includes('K22'), '3 × 2 = 6 dla 2 graczy — po 3 pytania');
  assert.ok(!kody(domyslnaKonfiguracja(1)).includes('K22'), 'jeden gracz bierze wszystko');
  assert.ok(!kody(domyslnaKonfiguracja(8)).includes('K22'), '8 graczy: 8 pytań na stację (widełki do MAKS_GRACZY)');
});

test('hot-seat: pytań jest co najmniej tyle co stacji, a widełki pytań sięgają MAKS_GRACZY', () => {
  assert.equal(OGRANICZENIA.pytaniaNaStacje.min, 1, 'minimum 1 pytanie na stację = razem tyle co stacji');
  assert.equal(OGRANICZENIA.pytaniaNaStacje.max, OGRANICZENIA.liczbaGraczy.max, 'każdy gracz może odpowiadać przy każdej stacji');
  for (const graczy of [1, 2, 3, 5, 8]) {
    const k = domyslnaKonfiguracja(graczy);
    assert.equal(k.pytaniaNaStacje, graczy, `${graczy} graczy → ${graczy} pytań na stację`);
    assert.equal(liczbaPytan(k) % graczy, 0, 'podział bez reszty');
    assert.ok(liczbaPytan(k) >= k.liczbaStacji, 'pytań nie mniej niż stacji');
  }
});

test('oczyscKonfiguracje: pytania na stację zaciskają się do widełek, ale nie psują podziału domyślnego', () => {
  assert.equal(oczyscKonfiguracje({ pytaniaNaStacje: 99 }).pytaniaNaStacje, OGRANICZENIA.pytaniaNaStacje.max);
  assert.equal(oczyscKonfiguracje({ liczbaGraczy: 4 }).pytaniaNaStacje, 4, 'zmiana liczby graczy ciągnie domyślne pytania');
});


test('ADR 0034: nowe wybory setupu, alfabetyczne tematy i zgodność odczytu', () => {
  assert.deepEqual(Object.keys(WIEK_SETUP), ['7', '12', 'dorosli']);
  assert.deepEqual(Object.keys(TEMATY_SETUP), ['architektura', 'ciekawostki', 'geografia', 'historia', 'kultura', 'legendy', 'ludzie', 'nauka', 'przyroda', 'wlasny']);
  assert.ok(WIEK['10'] && WIEK['15'] && TEMATY.sport && TEMATY.jedzenie);
  const stara = { ...domyslnaKonfiguracja(), wiek: '10', tematy: ['sport', 'historia'] };
  const nowa = konfiguracjaNowegoSetupu(stara);
  assert.equal(nowa.wiek, '12');
  assert.deepEqual(nowa.tematy, ['historia']);
  assert.equal(stara.wiek, '10', 'nie mutuje zapisanej gry');
  assert.equal(konfiguracjaNowegoSetupu({ ...stara, wiek: '15' }).wiek, 'dorosli');
  // ADR 0034 „usunięte tematy nie przechodzą do nowego setupu" — także wtedy,
  // gdy po filtrze NIE zostaje żaden temat: fallback (DOMYSLNE.tematy) musi
  // być nowym kanonem setupu, nie starym z `sport`/`jedzenie` (przypadek
  // brzegowy znaleziony w przeglądzie UI 2026-09-10; LESSONS L11 — dane brzegowe).
  const samSport = konfiguracjaNowegoSetupu({ ...stara, tematy: ['sport'] });
  assert.deepEqual(samSport.tematy, DOMYSLNE.tematy);
  assert.ok(!samSport.tematy.includes('sport') && !samSport.tematy.includes('jedzenie'),
    'fallback pustych tematów nie wraca do usuniętych sportu/jedzenia');
  assert.ok(DOMYSLNE.tematy.includes('ciekawostki'), 'nowy temat ADR 0034 jest w domyślnych');
  assert.ok(!DOMYSLNE.tematy.includes('wlasny'), '„Dopisz sam" nie jest domyślnie zaznaczone');
});
