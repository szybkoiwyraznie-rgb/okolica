/**
 * most.js — adres mostu Drive (Apps Script) i reguła jego wyboru.
 *
 * Decyzja właściciela z 2026-09-07 (ADR 0020): adres web app mostu jest
 * WPISANY NA STAŁE W KODZIE aplikacji jako `DOMYSLNY_URL_MOSTU`, żeby każdy
 * telefon — własny i każdego znajomego — działał bez konfigurowania czegokolwiek.
 * Interfejs nie ma pola do wpisywania adresu: wymiana adresu to nowy commit
 * i nowa wersja aplikacji (właściciel: „te dane muszą być wpisane
 * w repozytorium, żeby były trwałe").
 *
 * Ten sam web app obsługuje trzy zadania (ADR 0018): repozytorium paczek,
 * gry wieloosobowe i rankingi — dlatego adres jest JEDEN i współdzielony.
 *
 * Nadpisanie techniczne (BEZ interfejsu): klucze `localStorage` mają
 * pierwszeństwo przed stałą. Furtka dla testów (atrapa mostu) i dla sytuacji
 * „adres się zmienił, a nowa wersja aplikacji jeszcze nie dojechała".
 *
 * Moduł nie dotyka DOM ani `fetch` — pamięć można wstrzyknąć (wzorzec projektu:
 * czysta funkcja + atrapa, `docs/LESSONS.md`).
 */

import { KLUCZ_URL_REPO } from './zestawy.js?v=m12-38';

/**
 * Adres web app Apps Script (…/exec) wpisany na stałe w tej wersji aplikacji.
 *
 * Wpisany commitem wdrożeniowym 2026-09-07: właściciel wdrożył most i podał
 * adres /exec w czacie (ADR 0020 pkt 5). Pusty łańcuch znaczyłby stan sprzed
 * wdrożenia — aplikacja mówiłaby wprost, że wspólne repozytorium i gry
 * sieciowe są niedostępne, i działała lokalnie (LESSONS L6).
 */
export const DOMYSLNY_URL_MOSTU = 'https://script.google.com/macros/s/AKfycbxlScMHr8bR1DSq7cPPr9914A1ur3J9bBRpHNEKV3YFmCcYr37dAN6jpq2zVWuwECGu/exec';

/** Klucz nadpisania adresu dla gry wieloosobowej (historyczne pole „Adres mostu"). */
export const KLUCZ_URL_MOSTU = 'okolica:multi:url-mostu';

/** Czyta wartość klucza z pamięci: obsługuje `localStorage` i gołą `Map` (testy). */
function wartoscKlucza(pamiec, klucz) {
  if (!pamiec) return '';
  let surowa = null;
  if (typeof pamiec.getItem === 'function') surowa = pamiec.getItem(klucz);
  else if (typeof pamiec.get === 'function') surowa = pamiec.get(klucz);
  return typeof surowa === 'string' ? surowa.trim() : '';
}

/**
 * Adres mostu dla tej sesji.
 *
 * Kolejność: nadpisanie gry wieloosobowej → nadpisanie repozytorium paczek →
 * stała wdrożeniowa `DOMYSLNY_URL_MOSTU`. Zwraca `''`, gdy żadnego adresu nie
 * ma — wołający MUSI to obsłużyć jawnym komunikatem, nie ciszą.
 *
 * @param {{getItem?:Function}|Map} [pamiec] pamięć do odczytu (domyślnie `localStorage`)
 * @returns {string} adres web app albo pusty łańcuch
 */
export function adresMostu(pamiec) {
  const zrodlo = pamiec ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  return wartoscKlucza(zrodlo, KLUCZ_URL_MOSTU)
    || wartoscKlucza(zrodlo, KLUCZ_URL_REPO)
    || DOMYSLNY_URL_MOSTU.trim();
}

/** Czy aplikacja zna jakikolwiek adres mostu (do komunikatów stanu w UI). */
export function mostSkonfigurowany(pamiec) {
  return adresMostu(pamiec) !== '';
}

/**
 * Komunikat stanu mostu po polsku — jeden dla całego UI, żeby karta paczek,
 * karta gry wieloosobowej i rankingi nie wymyślały trzech wersji prawdy.
 * Po ludzku: skąd jest adres, mówi tylko tryb testowy (Partia 3, pkt 1).
 *
 * @param {{getItem?:Function}|Map} [pamiec] pamięć do odczytu
 * @param {object} [opcje] `{ testowy }` — dopiski deweloperskie tylko w teście
 * @returns {{podlaczony:boolean, tekst:string}}
 */
export function stanMostu(pamiec, { testowy = false } = {}) {
  const zrodlo = pamiec ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const adres = adresMostu(zrodlo);
  if (adres) {
    const nadpisany = wartoscKlucza(zrodlo, KLUCZ_URL_MOSTU) || wartoscKlucza(zrodlo, KLUCZ_URL_REPO);
    if (nadpisany) {
      return { podlaczony: true, tekst: 'Most Drive: podłączony (adres nadpisany na tym telefonie).' };
    }
    return {
      podlaczony: true,
      tekst: testowy
        ? 'Most Drive: podłączony — adres jest wpisany w tej wersji aplikacji (ADR 0020).'
        : 'Most Drive: podłączony.',
    };
  }
  return {
    podlaczony: false,
    tekst: testowy
      ? 'Most Drive: niepodłączony — ta wersja aplikacji nie ma jeszcze wpisanego adresu (ADR 0020). Gramy lokalnie: paczki z tego telefonu i gra na jednym urządzeniu.'
      : 'Most Drive: niepodłączony. Gramy lokalnie: paczki z tego telefonu i gra na jednym urządzeniu.',
  };
}
