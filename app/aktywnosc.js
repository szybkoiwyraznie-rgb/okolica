/**
 * `aktywnosc.js` — ADR 0040 pkt 4–5 (uwagi właściciela z testów, 2026-09-13):
 * ekran nie gaśnie podczas gry, a JEDYNA dozwolona przerwa w śledzeniu to
 * 15 minut bez żadnej akcji gracza.
 *
 * Moduł CZYSTY: tylko decyzje (kiedy trzymać blokadę ekranu, kiedy uznać
 * bezczynność), bez DOM i bez `navigator`. Warstwa DOM (`app/app.js`) woła
 * `navigator.wakeLock` i `setInterval`, a brak API musi być cichym no-opem i
 * nigdy nie może zepsuć rozgrywki (LESSONS L6: milczenie tylko dla warstwy,
 * która nie niesie stanu gry — GPS działa niezależnie od wygaszania ekranu).
 *
 * Zasada wejścia (LESSONS L10): brak danych to brak danych, nie wartość
 * domyślna — bez znacznika ostatniej akcji przerwy NIE ma, a bez nazwy fazy
 * końcowej nie trzymamy ekranu.
 */

/** Ile bezczynności (ms) bez ŻADNEGO kliku, zanim śledzenie odpocznie. */
export const PRZERWA_BEZCZYNNOSCI_MS = 15 * 60 * 1000;

/** Co ile ms watchdog w `app.js` sprawdza bezczynność. */
export const SPRAWDZANIE_BEZCZYNNOSCI_MS = 30 * 1000;

/**
 * Czy minął próg bezczynności (ADR 0040 pkt 5).
 *
 * @param {{ostatniaAkcjaMs?: number|null, terazMs?: number|null, progMs?: number}} args
 * @returns {boolean} true = czas dać śledzeniu odpocząć (dowolny klik je wróci)
 */
export function czyPrzerwaBezczynnosci({ ostatniaAkcjaMs = null, terazMs = null, progMs = PRZERWA_BEZCZYNNOSCI_MS } = {}) {
  if (!Number.isFinite(ostatniaAkcjaMs) || !Number.isFinite(terazMs)) return false;
  if (!Number.isFinite(progMs) || progMs <= 0) return false;
  return terazMs - ostatniaAkcjaMs >= progMs;
}

/**
 * Czy trzymać Wake Lock (ADR 0040 pkt 4): dopóki rozgrywka trwa — faza inna niż
 * końcowa i bez ręcznego zakończenia. Poza grą ekran może gasnąć normalnie.
 *
 * @param {{rozgrywka?: {faza?: unknown}|null, fazaKoniec?: string, zakonczonaRecznie?: boolean}} args
 * @returns {boolean}
 */
export function czyTrzymacEkran({ rozgrywka = null, fazaKoniec = '', zakonczonaRecznie = false } = {}) {
  if (zakonczonaRecznie === true) return false;
  if (!rozgrywka || typeof rozgrywka !== 'object') return false;
  if (typeof rozgrywka.faza !== 'string' || typeof fazaKoniec !== 'string' || fazaKoniec === '') return false;
  return rozgrywka.faza !== fazaKoniec;
}
