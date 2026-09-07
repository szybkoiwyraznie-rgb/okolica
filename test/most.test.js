/**
 * Testy `app/most.js` — adres mostu Drive (ADR 0020).
 *
 * Sprawdza regułę wyboru adresu: nadpisanie w pamięci urządzenia ma
 * pierwszeństwo przed stałą wdrożeniową wpisaną w kod, a pusta stała
 * (stan przed wdrożeniem właściciela) daje jawny komunikat „niepodłączony"
 * zamiast ciszy (LESSONS L6).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DOMYSLNY_URL_MOSTU, KLUCZ_URL_MOSTU, adresMostu, mostSkonfigurowany, stanMostu } from '../app/most.js';
import { KLUCZ_URL_REPO } from '../app/zestawy.js';

const ADRES = 'https://script.google.com/macros/s/PRZYKLAD/exec';

/** Atrapa pamięci zgodna z `localStorage` (taką wystawia `test/helpers/dom.js`). */
function pamiecZ(wpisy) {
  const mapa = new Map(Object.entries(wpisy));
  return {
    getItem: (klucz) => (mapa.has(klucz) ? mapa.get(klucz) : null),
    setItem: (klucz, wartosc) => mapa.set(klucz, String(wartosc)),
    removeItem: (klucz) => mapa.delete(klucz),
  };
}

test('most: stała wdrożeniowa niesie adres /exec wpisany commitem (ADR 0020 pkt 5)', () => {
  assert.equal(typeof DOMYSLNY_URL_MOSTU, 'string');
  assert.match(
    DOMYSLNY_URL_MOSTU,
    /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/,
    'właściciel wdrożył most i podał adres w czacie — stała nie jest już pusta',
  );
});

test('most: pusta pamięć = adres z kodu, nie błąd (ADR 0020)', () => {
  assert.equal(adresMostu(pamiecZ({})), DOMYSLNY_URL_MOSTU);
  assert.equal(adresMostu(new Map()), DOMYSLNY_URL_MOSTU);
  assert.equal(adresMostu(null), DOMYSLNY_URL_MOSTU, 'bez pamięci zostaje stała z kodu');
  assert.equal(mostSkonfigurowany(pamiecZ({})), true, 'telefon znajomego działa bez wpisywania czegokolwiek');
});

test('most: nadpisanie gry wieloosobowej wygrywa z nadpisaniem repozytorium', () => {
  const pamiec = pamiecZ({
    [KLUCZ_URL_MOSTU]: 'https://przyklad.org/most-multi/exec',
    [KLUCZ_URL_REPO]: 'https://przyklad.org/most-paczki/exec',
  });
  assert.equal(adresMostu(pamiec), 'https://przyklad.org/most-multi/exec');
});

test('most: samo nadpisanie repozytorium paczek też działa (jeden web app, ADR 0018)', () => {
  const pamiec = pamiecZ({ [KLUCZ_URL_REPO]: ADRES });
  assert.equal(adresMostu(pamiec), ADRES);
  assert.equal(mostSkonfigurowany(pamiec), true);
});

test('most: puste i białe wpisy w pamięci nie udają adresu', () => {
  const pamiec = pamiecZ({ [KLUCZ_URL_MOSTU]: '   ', [KLUCZ_URL_REPO]: '' });
  assert.equal(adresMostu(pamiec), DOMYSLNY_URL_MOSTU, 'odpady z pól odrzucamy, zostaje stała');
  const zAdresem = pamiecZ({ [KLUCZ_URL_MOSTU]: `  ${ADRES}  ` });
  assert.equal(adresMostu(zAdresem), ADRES, 'adres jest przycinany z białych znaków');
});

test('most: przyjmuje gołą Map (pamięć z atrapy DOM) i obiekt localStorage-podobny', () => {
  const mapa = new Map([[KLUCZ_URL_REPO, ADRES]]);
  assert.equal(adresMostu(mapa), ADRES, 'współpraca z Map z test/helpers/dom.js');
  assert.equal(adresMostu(pamiecZ({ [KLUCZ_URL_MOSTU]: ADRES })), ADRES);
});

test('most: stan mówi po ludzku i nie odsyła do wpisywania adresu (ADR 0020 pkt 2)', () => {
  const zKodu = stanMostu(pamiecZ({}));
  assert.equal(zKodu.podlaczony, true);
  assert.match(zKodu.tekst, /podłączony/);
  assert.doesNotMatch(zKodu.tekst, /wpisany/, 'poza testem: sam stan, skąd jest adres wie tylko tryb testowy (Partia 3, pkt 1)');
  assert.doesNotMatch(zKodu.tekst, /wklej|wpisz/i, 'pola adresu nie ma w UI — komunikat nie może do niego odsyłać');

  const roboczy = stanMostu(pamiecZ({}), { testowy: true });
  assert.match(roboczy.tekst, /adres jest wpisany w tej wersji aplikacji/, 'tryb testowy zachowuje dopisek o pochodzeniu adresu');
  assert.match(roboczy.tekst, /ADR 0020/, 'dopisek testowy niesie numer decyzji');


  const z = stanMostu(pamiecZ({ [KLUCZ_URL_MOSTU]: ADRES }));
  assert.equal(z.podlaczony, true);
  assert.match(z.tekst, /podłączony/);
  assert.match(z.tekst, /nadpisany/, 'nadpisanie na tym telefonie jest widoczne w stanie');
});

test('most: bez globalnego localStorage moduł nie rzuca (atrapy Node nie mają przeglądarki)', () => {
  assert.equal(typeof globalThis.localStorage, 'undefined', 'test zakłada brak localStorage w Node');
  assert.equal(adresMostu(), DOMYSLNY_URL_MOSTU);
  assert.equal(stanMostu().podlaczony, DOMYSLNY_URL_MOSTU !== '');
});
