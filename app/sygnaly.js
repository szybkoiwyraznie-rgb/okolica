/**
 * `sygnaly.js` — M10/T4: sygnały zdarzeń gry (wibracja + dźwięk).
 *
 * Moduł CZYSTY: plany sygnałów i decyzja „czy grać" bez DOM. Warstwa DOM
 * (`app/app.js`) odtwarza plan przez Web Audio (oscylator — zero plików
 * dźwiękowych, zero zależności, ADR 0001) i `navigator.vibrate`.
 * Wyłącznik: `okolica:sygnaly` w localStorage ('0'/'1'), DOMYŚLNIE WŁĄCZONE
 * (przełącznik „🔔 sygnały" w nagłówku, aria-pressed).
 *
 * Zasada: sygnały są DODATKIEM — brak API (desktop, Node, cichy tryb) musi
 * być cichym no-opem i nigdy nie może zepsuć rozgrywki (LESSONS L6:
 * milczenie dopuszczalne tylko dla warstwy czysto ozdobnej).
 */

export const KLUCZ_SYGNALOW = 'okolica:sygnaly';

/**
 * Plany sygnałów: `wibracjaMs` = wzorzec `navigator.vibrate`,
 * `dzwiek` = nuty (częstotliwość Hz, czas ms) grane kolejno sinusoidą.
 * Dobór częstotliwości: słyszalne w hałasie ulicznym (880–1175 Hz na
 * „dotarcie"), rozróżnialne kierunkiem melodii (dobrze = w górę, źle = w dół).
 */
export const SYGNALY = Object.freeze({
  /** Stacja osiągnięta (GPS albo zgłoszenie ręczne): dwa tony w górę. */
  dotarcie: Object.freeze({
    wibracjaMs: Object.freeze([120, 60, 120]),
    dzwiek: Object.freeze([
      Object.freeze({ czHz: 880, ms: 140 }),
      Object.freeze({ czHz: 1174.7, ms: 240 }),
    ]),
  }),
  /** Odcinek rozpoczęty: jeden krótki ton — „zegar ruszył". */
  startOdcinka: Object.freeze({
    wibracjaMs: Object.freeze([60]),
    dzwiek: Object.freeze([Object.freeze({ czHz: 659.3, ms: 100 })]),
  }),
  /** Odpowiedź poprawna: wysoki krótki ton. */
  poprawna: Object.freeze({
    wibracjaMs: Object.freeze([80]),
    dzwiek: Object.freeze([Object.freeze({ czHz: 1046.5, ms: 120 })]),
  }),
  /** Odpowiedź błędna: dwa tony w dół — bez kary, tylko informacja. */
  bledna: Object.freeze({
    wibracjaMs: Object.freeze([200, 90, 200]),
    dzwiek: Object.freeze([
      Object.freeze({ czHz: 392, ms: 180 }),
      Object.freeze({ czHz: 311.1, ms: 260 }),
    ]),
  }),
});

/** Plan sygnału dla zdarzenia albo `null` (wyłączone / nieznane zdarzenie). */
export function planSygnalu(zdarzenie, { wlaczone = true } = {}) {
  if (!wlaczone) return null;
  return SYGNALY[zdarzenie] ?? null;
}

/**
 * Odczyt przełącznika: brak klucza = WŁĄCZONE (domyślne), '0' = wyłączone.
 * Czysta funkcja — warstwa DOM podaje surową wartość z pamięci.
 */
export function czySygnalyWlaczone(wartoscZPamieci) {
  if (wartoscZPamieci === null || wartoscZPamieci === undefined) return true;
  return String(wartoscZPamieci) !== '0';
}
