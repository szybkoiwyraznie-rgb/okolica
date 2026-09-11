/**
 * Oceny pytań na moście (ADR 0028), wykonywane na tekście `.gs` (LESSONS L33):
 * głos, reguła jednego głosu na gracza i pytanie, licznik „użyta w X grach",
 * statystyki w indeksie i prywatność pliku ocen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walidujStatystykiOcen } from '../app/oceny.js';
import { walidujIndeksSurowy } from '../app/zestawy.js';
import { uruchomMost, zestawPrzykladowy, idPoNazwie } from './helpers/most.js';

/** Paczka w katalogu zaakceptowanych — głosować można tylko na takie. */
function paczkaWRepo() {
  const stan = uruchomMost();
  const zestaw = zestawPrzykladowy();
  const przyjeta = stan.most.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie: ${przyjeta.blad}`);
  assert.equal(przyjeta.status, 'zaakceptowana', 'decyzja 2026-09-11: paczka od razu w zaakceptowanych');
  const idPaczki = idPoNazwie(stan.pliki, przyjeta.nazwa);
  return { ...stan, idPaczki };
}

function glos(nad) {
  return { akcja: 'ocena', schemat: 'RO-ocena/1', paczkaId: '', pytanieId: 's1p1', ocena: 1, gracz: 'Ania', gra: 'gra-1', ...nad };
}

test('most: głos wchodzi, a duplikat tego samego gracza nie zmienia statystyk', () => {
  const { most, idPaczki } = paczkaWRepo();

  const pierwszy = most.przyjmijOcene(glos({ paczkaId: idPaczki }));
  assert.equal(pierwszy.ok, true, `głos: ${pierwszy.blad}`);
  assert.equal(pierwszy.juzBylo, false, 'pierwszy głos jest nowy');
  assert.deepEqual(pierwszy.podsumowanie, { glosow: 1, plus: 1, minus: 0, uzytaWGrach: 0 });

  // Ten sam gracz, inne pytanie — oczywiście można.
  const innePytanie = most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: 's2p1', ocena: -1 }));
  assert.equal(innePytanie.podsumowanie.glosow, 2, 'dwa różne pytania = dwa głosy');
  assert.equal(innePytanie.podsumowanie.minus, 1, 'kciuk w dół jest policzony');

  // Ten sam gracz, to samo pytanie, INNA gra — drugi głos nie wchodzi
  // (ADR 0028 pkt 2), ale nie jest to błąd: aplikacja pokaże „już ocenione".
  const duplikat = most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: 's1p1', ocena: -1, gra: 'gra-2' }));
  assert.equal(duplikat.ok, true, 'duplikat nie jest odmową — gracz już po prostu zagłosował');
  assert.equal(duplikat.juzBylo, true, 'most mówi wprost, że głos już był');
  assert.equal(duplikat.podsumowanie.glosow, 2, 'statystyki się nie zmieniły');

  // Inny gracz na to samo pytanie — wchodzi (to sedno statystyki).
  const inny = most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: 's1p1', gracz: 'Bartek', ocena: -1 }));
  assert.equal(inny.podsumowanie.glosow, 3, 'inni gracze głosują niezależnie');
  assert.equal(inny.podsumowanie.plus, 1, 'jeden na tak');
});

test('most: śmieci i cudze paczki dostają jawny powód odmowy', () => {
  const { most, idPaczki } = paczkaWRepo();

  assert.match(most.przyjmijOcene({ ...glos({ paczkaId: idPaczki }), schemat: 'coś/innego' }).blad, /RO-ocena\/1/);
  assert.match(most.przyjmijOcene(glos({ paczkaId: idPaczki, ocena: 5 })).blad, /kciukiem w górę/, 'ocena inna niż kciuk');
  assert.match(most.przyjmijOcene(glos({ paczkaId: idPaczki, ocena: 0 })).blad, /kciukiem/, 'zero to nie kciuk');
  assert.match(most.przyjmijOcene(glos({ paczkaId: idPaczki, gracz: '   ' })).blad, /tożsamości/, 'głos bez gracza');
  assert.match(most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: '' })).blad, /identyfikatora pytania/);
  assert.match(most.przyjmijOcene(glos({ paczkaId: 'nie-ma-takiego-pliku' })).blad, /nie ma takiej paczki/, 'głos na nieistniejącą paczkę');

  // Paczka przeniesiona do odrzuconych przestaje zbierać głosy.
  assert.equal(most.przyjmijOcene(glos({ paczkaId: idPaczki })).ok, true, 'na początek głos wchodzi');
  most.przenies(idPaczki, 'okolica-paczki-odrzucone');
  assert.match(most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: 's3p1' })).blad, /nie ma takiej paczki/, 'odrzucona paczka nie zbiera głosów');
});

test('most: plik ocen nie niesie współrzędnych ani PIN-u, a pseudonim jest slugiem', () => {
  const { most, pliki, idPaczki } = paczkaWRepo();
  const wynik = most.przyjmijOcene(glos({
    paczkaId: idPaczki,
    gracz: 'Ania Kowalska',
    // Próba przemytu: aplikacja tych pól nie wysyła, ale most ma ich nie zapisywać.
    lat: 52.2297, lon: 21.0122, pin: '1234',
  }));
  assert.equal(wynik.ok, true, `głos: ${wynik.blad}`);

  const plikOcen = pliki.get(idPoNazwie(pliki, `oceny-${idPaczki}.json`));
  assert.ok(plikOcen, 'plik ocen powstał w katalogu ocen');
  const tresc = plikOcen.tresc;
  for (const zakazane of ['"lat"', '"lon"', '"pin"', '52.2297', '21.0122', '1234']) {
    assert.equal(tresc.includes(zakazane), false, `${zakazane} nie ma prawa zostać na Drive (ADR 0013/0021)`);
  }
  assert.ok(tresc.includes('ania-kowalska'), 'gracz jest zapisany jako slug');
  assert.equal(tresc.includes('Ania Kowalska'), false, 'surowy pseudonim nie leży w pliku ocen');
  assert.match(tresc, /"schemat": "RO-oceny\/1"/, 'plik ma schemat ocen');
});

test('most: licznik „użyta w X grach" liczy gry, nie pobrania', () => {
  const { most, idPaczki } = paczkaWRepo();

  const raz = most.przyjmijUzycie({ akcja: 'uzycie', paczkaId: idPaczki, gra: 'gra-A' });
  assert.equal(raz.ok, true, `uzycie: ${raz.blad}`);
  assert.equal(raz.podsumowanie.uzytaWGrach, 1);

  // Ponowienie tego samego tokena (kolejka aplikacji wysyła głosy i pingi dwa razy).
  const jeszczeRaz = most.przyjmijUzycie({ akcja: 'uzycie', paczkaId: idPaczki, gra: 'gra-A' });
  assert.equal(jeszczeRaz.juzBylo, true, 'ten sam token nie jest liczony drugi raz');
  assert.equal(jeszczeRaz.podsumowanie.uzytaWGrach, 1);

  const innaGra = most.przyjmijUzycie({ akcja: 'uzycie', paczkaId: idPaczki, gra: 'gra-B' });
  assert.equal(innaGra.podsumowanie.uzytaWGrach, 2, 'druga gra wchodzi do licznika');

  assert.match(most.przyjmijUzycie({ akcja: 'uzycie', paczkaId: idPaczki, gra: '' }).blad, /tokena gry/);
});

test('most: indeks niesie statystyki, a aplikacja je rozumie', () => {
  const { most, idPaczki } = paczkaWRepo();
  assert.equal(most.przyjmijUzycie({ akcja: 'uzycie', paczkaId: idPaczki, gra: 'gra-A' }).ok, true);
  most.przyjmijOcene(glos({ paczkaId: idPaczki, gracz: 'Ania' }));
  most.przyjmijOcene(glos({ paczkaId: idPaczki, gracz: 'Bartek', ocena: -1 }));
  most.przyjmijOcene(glos({ paczkaId: idPaczki, pytanieId: 's2p1', gracz: 'Celina' }));

  const indeks = walidujIndeksSurowy(JSON.stringify(most.budujIndeks()));
  assert.deepEqual(indeks.usterki, [], 'indeks bez usterek');
  const wpis = indeks.indeks[0];
  assert.deepEqual(wpis.oceny, { glosow: 3, plus: 2, minus: 1, uzytaWGrach: 1 }, 'statystyki z mostu');

  // Ten sam obiekt musi przejść walidację aplikacji — inaczej ekran 2 pokaże
  // „brak danych" mimo że most je przysłał.
  const poStronieAplikacji = walidujStatystykiOcen(wpis.oceny);
  assert.equal(poStronieAplikacji.procentPlus, 67, 'procenty liczy aplikacja');
  assert.equal(poStronieAplikacji.procentMinus, 33);

  // Paczka bez głosów: zera, nie brak pola.
  const druga = paczkaWRepo();
  const wpisBez = walidujIndeksSurowy(JSON.stringify(druga.most.budujIndeks())).indeks[0];
  assert.deepEqual(wpisBez.oceny, { glosow: 0, plus: 0, minus: 0, uzytaWGrach: 0 }, 'świeża paczka ma zera');
});

test('most: pobranie paczki nie zabiera głosów na telefon gracza', () => {
  const { most, idPaczki } = paczkaWRepo();
  most.przyjmijOcene(glos({ paczkaId: idPaczki, gracz: 'Ania' }));
  const pobrana = most.paczkaPrzezId(idPaczki);
  assert.equal(pobrana.schemat, 'TO-zestaw/1', 'paczka się pobiera');
  assert.equal(pobrana.oceny, undefined, 'głosy nie jadą razem z paczką (ADR 0028 pkt 4)');
  assert.equal(JSON.stringify(pobrana).includes('"gracz"'), false, 'w paczce nie ma pól głosu');
});

/**
 * Decyzja właściciela 2026-09-11: paczki są w zaakceptowanych OD RAZU (bez
 * sesji przeglądu) — więc zbierają łapki od pierwszej sekundy. Ręczne
 * odrzucenie (przeciągnięcie pliku do katalogu odrzuconych) kończy głosowanie.
 */
test('most: paczka przyjęta od razu zbiera oceny; ręczne odrzucenie je zamyka (ADR 0028 aneks, 2026-09-11)', () => {
  const stan = uruchomMost();
  const przyjeta = stan.most.przyjmijKandydata(zestawPrzykladowy());
  assert.equal(przyjeta.ok, true, `przyjęcie: ${przyjeta.blad}`);
  assert.equal(przyjeta.status, 'zaakceptowana', 'bez kolejki przeglądu');
  assert.equal(typeof przyjeta.id, 'string', 'most oddaje id pliku — telefon musi wiedzieć, co ocenia');
  assert.ok(przyjeta.id, 'id nie jest puste');

  const wynik = stan.most.przyjmijOcene(glos({ paczkaId: przyjeta.id }));
  assert.equal(wynik.ok, true, `głos na świeżo przyjętą paczkę: ${wynik.blad}`);
  assert.equal(wynik.podsumowanie.glosow, 1, 'głos liczony od razu');
  const drugi = stan.most.przyjmijOcene(glos({ paczkaId: przyjeta.id, pytanieId: 's2p1' }));
  assert.equal(drugi.podsumowanie.glosow, 2, 'głosy się kumulują');

  // Ręczne odrzucenie na Drive = koniec głosowania (paczka poza repo).
  stan.most.przenies(przyjeta.id, 'okolica-paczki-odrzucone');
  const poOdrzuceniu = stan.most.przyjmijOcene(glos({ paczkaId: przyjeta.id, pytanieId: 's3p1' }));
  assert.equal(poOdrzuceniu.ok, false, 'odrzucona ręcznie paczka nie przyjmuje głosów');
});

test('most: powtórna wysyłka tego samego zestawu oddaje id istniejącej paczki', () => {
  const stan = uruchomMost();
  const zestaw = zestawPrzykladowy();
  const pierwsza = stan.most.przyjmijKandydata(zestaw);
  const druga = stan.most.przyjmijKandydata(zestaw);
  assert.equal(druga.ok, true, 'duplikat nie jest błędem');
  assert.equal(druga.status, 'juz-zaakceptowana');
  assert.equal(druga.id, pierwsza.id, 'ten sam zestaw = ten sam identyfikator do oceniania');
});
