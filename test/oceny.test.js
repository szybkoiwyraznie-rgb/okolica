/**
 * Oceny pytań (ADR 0028): tożsamość głosującego, reguła jednego głosu, kolejka
 * wysyłki i język statystyk.
 *
 * Dodatkowo parzystość z mostem: slug głosującego w aplikacji musi być taki sam
 * jak `idProfilu()` w `.gs`, bo inaczej ten sam człowiek byłby liczony jako dwóch
 * głosujących (a most i tak przepuszcza wartość przez własny slug).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMAT_OCENA,
  SCHEMAT_OCENY_LOKALNE,
  KLUCZ_OCEN,
  KLUCZ_GLOSUJACEGO,
  MAKS_KOLEJKI_OCEN,
  OCENA_PLUS,
  OCENA_MINUS,
  slugGlosujacego,
  nowyIdUrzadzenia,
  idGlosujacego,
  noweOceny,
  walidujOcenyLokalne,
  juzOcenione,
  ocenPytanie,
  budujZadanieOceny,
  walidujKolejkeOcen,
  dodajDoKolejkiOcen,
  walidujOdpowiedzOceny,
  walidujStatystykiOcen,
  liczbaGierTekst,
  liczbaOcenTekst,
  opisOcenTekst,
} from '../app/oceny.js';
import { uruchomMost } from './helpers/most.js';

/** Ustalone ziarno: identyfikator urządzenia ma być w testach przewidywalny. */
function losujZiarno(wartosci) {
  let i = 0;
  return () => wartosci[i++ % wartosci.length];
}

const GLOS = { paczkaId: 'plik-1', pytanieId: 's1p1', ocena: OCENA_PLUS, graczId: 'ania' };

test('oceny: slug głosującego jest taki sam jak idProfilu() w moście', () => {
  const { most } = uruchomMost();
  const przypadki = [
    'Ania', '  ANIA  ', 'Bartek K.', 'gracz_z-żółtą_łódką', 'Miś Uszatek',
    'a'.repeat(60), '!!!', '', 'Gracz 123', 'Zażółć gęślą jaźń',
  ];
  for (const przypadek of przypadki) {
    assert.equal(
      slugGlosujacego(przypadek),
      most.idProfilu(przypadek),
      `rozjazd slugu dla „${przypadek}" — most policzy innego głosującego niż aplikacja`,
    );
  }
  // Idempotentność: most przepuszcza otrzymaną wartość przez własny slug.
  for (const przypadek of przypadki) {
    const raz = slugGlosujacego(przypadek);
    assert.equal(most.idProfilu(raz), raz, `slug „${raz}" musi być stabilny po stronie mostu`);
  }
});

test('oceny: zweryfikowany profil wygrywa, bez profilu głos jest liczony na urządzenie', () => {
  const pamiec = new Map();
  const zProfilem = idGlosujacego({ pseudonim: 'Ania', zweryfikowany: true, pamiec });
  assert.deepEqual(zProfilem, { id: 'ania', zrodlo: 'profil' });

  // Hot-seat bez PIN-u: urządzenie + imię gracza, zapisane raz.
  const pierwszy = idGlosujacego({ pamiec, imie: 'Ania', losuj: losujZiarno([0.5, 0.25, 0.125, 0.0625]) });
  assert.equal(pierwszy.zrodlo, 'urzadzenie');
  assert.match(pierwszy.id, /^urz-[0-9a-f]{8}-ania$/, `tożsamość gracza na urządzeniu: ${pierwszy.id}`);
  assert.match(pamiec.get(KLUCZ_GLOSUJACEGO), /^urz-[0-9a-f]{24}$/, 'identyfikator urządzenia zostaje w pamięci');

  const tenSam = idGlosujacego({ pamiec, imie: 'Ania', losuj: losujZiarno([0.9]) });
  assert.equal(tenSam.id, pierwszy.id, 'ten sam gracz na tym samym telefonie = ten sam głosujący');

  // Drugi gracz na TYM samym telefonie musi móc ocenić to samo pytanie.
  const drugiGracz = idGlosujacego({ pamiec, imie: 'Bartek' });
  assert.notEqual(drugiGracz.id, pierwszy.id, 'każdy gracz hot-seat głosuje osobno');
  assert.equal(drugiGracz.id, 'urz-' + pamiec.get(KLUCZ_GLOSUJACEGO).slice(4, 12) + '-bartek');

  // Niezweryfikowany pseudonim NIE daje tożsamości profilu (inaczej każdy mógłby
  // się podszyć pod czyjeś imię i zdjąć mu głos z pytania).
  const bezWeryfikacji = idGlosujacego({ pseudonim: 'Ania', zweryfikowany: false, imie: 'Ania', pamiec });
  assert.equal(bezWeryfikacji.zrodlo, 'urzadzenie', 'imię bez PIN-u nie jest tożsamością profilu');
});

test('oceny: jeden głos na pytanie — drugi klik nie leci w sieć', () => {
  const pierwszy = ocenPytanie(noweOceny(), { ...GLOS, gra: 'gra-1' });
  assert.deepEqual(pierwszy.usterki, [], 'pierwszy głos jest przyjęty');
  assert.equal(pierwszy.doWysylki.schemat, SCHEMAT_OCENA);
  assert.equal(pierwszy.doWysylki.gra, 'gra-1', 'głos niesie token gry');
  assert.equal(juzOcenione(pierwszy.oceny, { paczkaId: 'plik-1', pytanieId: 's1p1' }), true);

  // Ten sam gracz, to samo pytanie, INNA gra i odwrotny kciuk — dalej jeden głos.
  const drugi = ocenPytanie(pierwszy.oceny, { ...GLOS, ocena: OCENA_MINUS, gra: 'gra-2' });
  assert.equal(drugi.usterki[0].kod, 'O03', 'drugi głos jest odrzucony z kodem O03');
  assert.match(drugi.usterki[0].komunikat, /już przez Ciebie ocenione/, 'komunikat mówi wprost, o co chodzi');
  assert.equal(drugi.doWysylki, null, 'odrzucony głos nie jest wysyłany');
  assert.deepEqual(drugi.oceny, pierwszy.oceny, 'stan się nie zmienia');

  // Inne pytanie tej samej paczki — oczywiście można ocenić.
  const innePytanie = ocenPytanie(pierwszy.oceny, { ...GLOS, pytanieId: 's1p2' });
  assert.deepEqual(innePytanie.usterki, [], 'inne pytanie to inny głos');
  assert.equal(innePytanie.oceny.glosy.length, 2);
});

test('oceny: śmieci na wejściu dostają kod, nie ciszę', () => {
  const zlaOcena = ocenPytanie(noweOceny(), { ...GLOS, ocena: 0 });
  assert.equal(zlaOcena.usterki[0].kod, 'O04', 'ocena inna niż kciuk jest odrzucona');
  assert.equal(zlaOcena.doWysylki, null);

  const bezGracza = ocenPytanie(noweOceny(), { ...GLOS, graczId: '' });
  assert.equal(bezGracza.usterki[0].kod, 'O05', 'głos bez tożsamości nie ma sensu');

  const bezPaczki = ocenPytanie(noweOceny(), { ...GLOS, paczkaId: '' });
  assert.equal(bezPaczki.usterki[0].kod, 'O05', 'głos bez paczki nie ma gdzie trafić');

  assert.equal(walidujOcenyLokalne({ schemat: 'coś/innego', glosy: [] }), null, 'obcy schemat → null');
  assert.equal(walidujOcenyLokalne(null), null);
  const czyszczony = walidujOcenyLokalne({
    schemat: SCHEMAT_OCENY_LOKALNE,
    glosy: [{ paczkaId: 'p', pytanieId: 'q', ocena: 1 }, { paczkaId: '', pytanieId: 'q', ocena: 1 }, { paczkaId: 'p', pytanieId: 'q', ocena: 5 }],
  });
  assert.equal(czyszczony.glosy.length, 1, 'wpis bez paczki i z obcą oceną wypadają');
});

test('oceny: żądanie na most nie niesie współrzędnych ani PIN-u', () => {
  const zadanie = budujZadanieOceny({ paczkaId: 'plik-1', pytanieId: 's1p1', ocena: OCENA_MINUS, gracz: 'ania', gra: 'gra-9', kiedy: '2026-09-08T10:00:00Z' });
  assert.deepEqual(Object.keys(zadanie).sort(), ['akcja', 'gra', 'gracz', 'kiedy', 'ocena', 'paczkaId', 'pytanieId', 'schemat']);
  assert.equal(zadanie.ocena, OCENA_MINUS, 'kciuk w dół jest zapisany jako −1');
  const tekst = JSON.stringify(zadanie);
  for (const zakazane of ['lat', 'lon', 'pin', 'szerokosc', 'dlugosc']) {
    assert.equal(new RegExp(`"${zakazane}"`).test(tekst), false, `pole ${zakazane} nie ma prawa jechać na most (ADR 0013)`);
  }
});

test('oceny: kolejka wysyłki jest ograniczona i bez duplikatów', () => {
  let kolejka = walidujKolejkeOcen(null) ?? { schemat: 'oceny-kolejka/1', zadania: [] };
  const zadanie = budujZadanieOceny({ paczkaId: 'p1', pytanieId: 'q1', ocena: OCENA_PLUS, gracz: 'ania' });
  kolejka = dodajDoKolejkiOcen(kolejka, zadanie);
  kolejka = dodajDoKolejkiOcen(kolejka, zadanie); // ponowienie tego samego głosu
  assert.equal(kolejka.zadania.length, 1, 'ten sam głos nie zajmuje dwóch miejsc w kolejce');

  for (let i = 0; i < MAKS_KOLEJKI_OCEN + 20; i += 1) {
    kolejka = dodajDoKolejkiOcen(kolejka, budujZadanieOceny({ paczkaId: `p${i}`, pytanieId: `q${i}`, ocena: OCENA_PLUS, gracz: 'ania' }));
  }
  assert.equal(kolejka.zadania.length, MAKS_KOLEJKI_OCEN, 'kolejka ma sufit');
  assert.equal(kolejka.zadania.at(-1).paczkaId, `p${MAKS_KOLEJKI_OCEN + 19}`, 'najnowsze głosy zostają');

  assert.equal(walidujKolejkeOcen({ schemat: 'oceny-kolejka/1', zadania: 'nie-tablica' }), null);
  const odrzucone = walidujKolejkeOcen({ schemat: 'oceny-kolejka/1', zadania: [{ schemat: SCHEMAT_OCENA, paczkaId: '', pytanieId: 'q', ocena: 1, gracz: 'a' }] });
  assert.equal(odrzucone.zadania.length, 0, 'głos bez paczki nie jedzie na most');
});

test('oceny: odpowiedź mostu jest czytana jawnie, a odmowa cytowana', () => {
  const ok = walidujOdpowiedzOceny(JSON.stringify({ ok: true, podsumowanie: { glosow: 10, plus: 7, minus: 3, uzytaWGrach: 4 } }));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.podsumowanie, { glosow: 10, plus: 7, minus: 3, uzytaWGrach: 4, procentPlus: 70, procentMinus: 30 });

  const odmowa = walidujOdpowiedzOceny(JSON.stringify({ ok: false, blad: 'to pytanie jest już ocenione przez Ciebie' }));
  assert.equal(odmowa.ok, false);
  assert.equal(odmowa.usterki[0].kod, 'O02');
  assert.match(odmowa.usterki[0].komunikat, /już ocenione przez Ciebie/, 'powód odmowy mostu jest pokazany graczowi');

  assert.equal(walidujOdpowiedzOceny('to nie jest JSON').usterki[0].kod, 'O01');
  assert.equal(walidujOdpowiedzOceny(JSON.stringify({ ok: true })).usterki[0].kod, 'O05', 'ok bez podsumowania to brak danych');
});

test('oceny: statystyki muszą się spinać — plus + minus = glosow', () => {
  assert.equal(walidujStatystykiOcen({ glosow: 10, plus: 7, minus: 4, uzytaWGrach: 2 }), null, 'rozjechane liczby są odrzucone');
  assert.equal(walidujStatystykiOcen({ glosow: 10, plus: -1, minus: 11, uzytaWGrach: 2 }), null, 'ujemne głosy są odrzucone');
  assert.equal(walidujStatystykiOcen(null), null);
  const zero = walidujStatystykiOcen({ glosow: 0, plus: 0, minus: 0, uzytaWGrach: 3 });
  assert.deepEqual(zero, { glosow: 0, plus: 0, minus: 0, uzytaWGrach: 3, procentPlus: 0, procentMinus: 0 });
  const jedna = walidujStatystykiOcen({ glosow: 1, plus: 0, minus: 1, uzytaWGrach: 1 });
  assert.equal(jedna.procentMinus, 100, 'jedna ocena to 100%');
});

test('oceny: język statystyk na ekran 2', () => {
  assert.equal(liczbaGierTekst(1), 'w 1 grze');
  assert.equal(liczbaGierTekst(3), 'w 3 grach');
  assert.equal(liczbaGierTekst(22), 'w 22 grach');

  assert.equal(
    opisOcenTekst(walidujStatystykiOcen({ glosow: 27, plus: 20, minus: 7, uzytaWGrach: 12 })),
    'Użyta w 12 grach, 27 ocen (74% 👍, 26% 👎)',
  );
  assert.equal(
    opisOcenTekst(walidujStatystykiOcen({ glosow: 1, plus: 1, minus: 0, uzytaWGrach: 1 })),
    'Użyta w 1 grze, 1 ocena (100% 👍, 0% 👎)',
  );
  assert.equal(
    opisOcenTekst(walidujStatystykiOcen({ glosow: 0, plus: 0, minus: 0, uzytaWGrach: 0 })),
    'Jeszcze nie użyta w grze, jeszcze bez ocen graczy.',
  );
  assert.equal(opisOcenTekst(null), 'Brak danych o ocenach — repozytorium nie odpowiedziało.');

  // Wzór właściciela z 2026-09-08 dosłownie: „Użyta w 1 grze, 2 oceny (50% 👍, 50% 👎)"
  assert.equal(
    opisOcenTekst(walidujStatystykiOcen({ glosow: 2, plus: 1, minus: 1, uzytaWGrach: 1 })),
    'Użyta w 1 grze, 2 oceny (50% 👍, 50% 👎)',
  );
  // Polska odmiana: nastki 12–14 idą z „ocen", nie z „oceny"
  assert.equal(liczbaOcenTekst(1), 'ocena');
  assert.equal(liczbaOcenTekst(2), 'oceny');
  assert.equal(liczbaOcenTekst(4), 'oceny');
  assert.equal(liczbaOcenTekst(5), 'ocen');
  assert.equal(liczbaOcenTekst(12), 'ocen');
  assert.equal(liczbaOcenTekst(14), 'ocen');
  assert.equal(liczbaOcenTekst(22), 'oceny');
});

test('oceny: głosy przeżywają restart aplikacji (pamięć → stan → pamięć)', () => {
  const pamiec = new Map();
  const pierwszy = ocenPytanie(noweOceny(), GLOS);
  pamiec.set(KLUCZ_OCEN, JSON.stringify(pierwszy.oceny));

  const poRestarcie = walidujOcenyLokalne(JSON.parse(pamiec.get(KLUCZ_OCEN)));
  assert.equal(juzOcenione(poRestarcie, { paczkaId: 'plik-1', pytanieId: 's1p1' }), true, 'po restarcie pytanie jest dalej ocenione');
  const drugiRaz = ocenPytanie(poRestarcie, GLOS);
  assert.equal(drugiRaz.usterki[0].kod, 'O03', 'w innej sesji tego samego pytania nie da się ocenić drugi raz');
});
