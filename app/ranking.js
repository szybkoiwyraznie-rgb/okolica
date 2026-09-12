/**
 * ranking.js — reguły rankingu (zgłoszenie właściciela 2026-09-12, ADR 0039).
 *
 * Ranking pokazuje DOKŁADNIE dwie tabele i nic więcej:
 *   1. „Ranking Punktowy Graczy” — gracze wg SUMY zdobytych punktów, wszystkie
 *      rodzaje gier naraz (hot-seat i wieloosobowe lądują w tym samym katalogu
 *      gier zakończonych, więc jedno źródło pokrywa oba),
 *   2. „Mistrzowie Zagadek” — gracze wg proporcji odpowiedzi POPRAWNYCH do
 *      ZADANYCH pytań, z progiem `MINIMUM_PYTAN_ODPOWIEDZI` (decyzja
 *      właściciela: mała próba nie robi mistrza).
 *
 * Surowych wyników gier moduł NIE widzi: most oddaje gotowe sumy per gracz
 * (`RO-ranking/2`, `GET ?akcja=ranking` — patrz `rankingi()` w skrypcie mostu).
 * Dzięki temu na telefon nie jadą daty, miejsca ani geohashy innych osób
 * (ADR 0013/0019 pkt 3), a reguła „kto wchodzi do rankingu” (tylko gracze
 * z potwierdzonym profilem) żyje w JEDNYM miejscu — w moście.
 *
 * Moduł jest CZYSTY (bez DOM i bez sieci): sortowanie, próg i limity pilnuje
 * test jednostkowy, a nie tylko klikanie na telefonie.
 */

/** Schemat odpowiedzi mostu na `?akcja=ranking` (ADR 0039). */
export const SCHEMAT_RANKINGU = 'RO-ranking/2';

/** Ile pozycji pokazuje każda tabela — „max 5 pozycji” (zgłoszenie właściciela). */
export const LIMIT_RANKINGU = 5;

/**
 * Próg „Mistrzów Zagadek”: od ilu ZADANYCH pytań (suma gier) liczymy proporcję.
 * Decyzja właściciela 2026-09-12: 10. Kto ma mniej, nie jest jeszcze mistrzem —
 * jedna odpowiedź na jedną odpowiedź to nie „100%”.
 */
export const MINIMUM_PYTAN_ODPOWIEDZI = 10;

/** Liczba zadanych pytań dla wiersza mostu (odpowiedzi poprawne + błędne). */
export function pytaniaGracza(wiersz) {
  const pytania = Number(wiersz?.pytania);
  if (Number.isFinite(pytania) && pytania >= 0) return pytania;
  return (Number(wiersz?.poprawne) || 0) + (Number(wiersz?.bledne) || 0);
}

/** Liczba zdobytych punktów (brak/śmieci = 0). */
export function punktyGracza(wiersz) {
  const punkty = Number(wiersz?.punkty);
  return Number.isFinite(punkty) && punkty > 0 ? punkty : 0;
}

/** Pseudonim bezpieczny dla UI: przycięty, nigdy pusty („gracz bez pseudonimu”). */
function pseudonimGracza(wiersz) {
  const pseudonim = typeof wiersz?.pseudonim === 'string' ? wiersz.pseudonim.trim() : '';
  return pseudonim || 'gracz bez pseudonimu';
}

/**
 * Walidacja surowego tekstu z mostu: `{ gracze, usterka }`.
 *
 * `usterka` = `null` znaczy „ranking jest pełny”; `gracze: []` + tekst usterki
 * to brak danych, o którym UI musi powiedzieć wprost (LESSONS L6 — cisza
 * w miejscu awarii wygląda jak „nikt nie grał” i zniechęca do grania).
 */
export function walidujRankingSurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch (e) {
    return { gracze: [], usterka: 'odpowiedź nie jest czytelnym JSON-em (Z09/Z10)' };
  }
  if (!surowy || typeof surowy !== 'object') {
    return { gracze: [], usterka: `nieznany schemat odpowiedzi (oczekuję ${SCHEMAT_RANKINGU})` };
  }
  if (typeof surowy.blad === 'string' && surowy.blad) {
    // Most odmawia po polsku (`{ blad: 'nieznana akcja' }` — wdrożenie sprzed
    // akcji `ranking`, ADR 0039). To najczęstszy stan teraz, więc jego powód
    // musi dojść do gracza dosłownie — bez tego nowa warstwa mówiłaby
    // „nieznany schemat”, co brzmi jak nasz błąd, a nim nie jest.
    return { gracze: [], usterka: `most Drive odmówił: ${surowy.blad}` };
  }
  if (surowy.schemat !== SCHEMAT_RANKINGU) {
    return { gracze: [], usterka: `nieznany schemat odpowiedzi (oczekuję ${SCHEMAT_RANKINGU})` };
  }
  if (!Array.isArray(surowy.gracze)) {
    return { gracze: [], usterka: 'odpowiedź bez listy graczy' };
  }
  return { gracze: surowy.gracze, usterka: null };
}

/**
 * Ranking punktowy: wszyscy gracze z profilem, którzy mają jakikolwiek wynik.
 * Kolejność: suma punktów malejąco, przy remisie pseudonim rosnąco — remis
 * musi mieć jedną, przewidywalną kolejność (ten sam gracz nie skacze między
 * odświeżeniami).
 *
 * @returns {{wiersze:Array<{pseudonim:string,punkty:number,poprawne:number,pytania:number,pozycja:number}>, wszystkich:number}}
 */
export function rankingPunktowy(ranking, { limit = LIMIT_RANKINGU } = {}) {
  const gracze = Array.isArray(ranking?.gracze) ? ranking.gracze : [];
  const wiersze = gracze
    .map((w) => ({
      pseudonim: pseudonimGracza(w),
      punkty: punktyGracza(w),
      poprawne: Number(w?.poprawne) || 0,
      pytania: pytaniaGracza(w),
    }))
    .sort((a, b) => (b.punkty - a.punkty) || a.pseudonim.localeCompare(b.pseudonim, 'pl'));
  return {
    wiersze: wiersze.slice(0, limit).map((w, i) => ({ ...w, pozycja: i + 1 })),
    wszystkich: wiersze.length,
  };
}

/**
 * Mistrzowie Zagadek: proporcja odpowiedzi poprawnych do zadanych pytań.
 *
 * Próg `prog` (domyślnie `MINIMUM_PYTAN_ODPOWIEDZI`) jest liczony od SUMY
 * zadanych pytań ze wszystkich gier gracza — mniej odpowiedzi to zbyt mała
 * próba, żeby mówić o mistrzu.
 *
 * Kolejność: proporcja malejąco, a przy równej proporcji WIĘCEJ zadanych
 * pytań wyżej (10/10 przed 5/5 — większa próba to mocniejszy wynik), dalej
 * pseudonim rosnąco dla przewidywalności.
 *
 * @returns {{wiersze:Array<{pseudonim:string,poprawne:number,pytania:number,proporcja:number,procent:number,pozycja:number}>, kwalifikowani:number, prog:number}}
 */
export function mistrzowieZagadek(ranking, { limit = LIMIT_RANKINGU, prog = MINIMUM_PYTAN_ODPOWIEDZI } = {}) {
  const gracze = Array.isArray(ranking?.gracze) ? ranking.gracze : [];
  const kwalifikowani = gracze
    .map((w) => ({
      pseudonim: pseudonimGracza(w),
      poprawne: Number(w?.poprawne) || 0,
      pytania: pytaniaGracza(w),
    }))
    .filter((w) => w.pytania >= prog)
    .map((w) => {
      const proporcja = w.pytania > 0 ? w.poprawne / w.pytania : 0;
      return { ...w, proporcja, procent: Math.round(proporcja * 100) };
    })
    .sort((a, b) => (b.proporcja - a.proporcja) || (b.pytania - a.pytania) || a.pseudonim.localeCompare(b.pseudonim, 'pl'));
  return {
    wiersze: kwalifikowani.slice(0, limit).map((w, i) => ({ ...w, pozycja: i + 1 })),
    kwalifikowani: kwalifikowani.length,
    prog,
  };
}

/** „18/24 · 75%” — jedna postać zapisu dla tabeli i dla testów. */
export function formatujSkutecznosc({ poprawne, pytania, procent }) {
  return `${poprawne}/${pytania} · ${procent}%`;
}
