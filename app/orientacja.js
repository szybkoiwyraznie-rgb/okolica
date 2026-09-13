/**
 * `orientacja.js` — ADR 0030 aneks 2026-09-13 (uwaga właściciela D, w wersji
 * po wycofaniu blokady): ekran obraca się SAM, dokładnie jak dotąd — żadnego
 * `screen.orientation.lock()` i żadnego przełącznika w menu. Jedyne, co
 * aplikacja dokłada do obrotu, to „autokliknięcie" ◎ Centrowanie na mapie:
 * po obrocie kadr wraca na gracza, bo mapa po zmianie proporcji zostaje tam,
 * gdzie zostawił ją palec (ADR 0011).
 *
 * Moduł CZYSTY: same decyzje, bez DOM i bez `window`. Wymiary okna, nasłuch
 * `resize`/`orientationchange` i klik w mapę siedzą w `app/app.js`.
 *
 * Zasada wejścia (LESSONS L10): brak danych to brak danych — bez wiarygodnych
 * wymiarów nie ma kierunku, a bez dwóch różnych kierunków nie ma obrotu, więc
 * nie ma też kliknięcia. Zwykła zmiana rozmiaru bez obrotu (klawiatura, pasek
 * przeglądarki, okno na desktopie) widoku NIE rusza.
 */

/**
 * Ile ms czekamy po ostatnim zdarzeniu rozmiaru, zanim uznamy obrót: telefon
 * podczas animacji obrotu melduje kilka wymiarów pośrednich, a `resize` bywa
 * wcześniejszy niż nowy układ (CSS z ADR 0030 pkt 1 przelicza się na żywo).
 */
export const OPOZNIENIE_OBROTU_MS = 250;

/**
 * Kierunek ekranu z wymiarów okna.
 *
 * @param {{szerokosc?: number|null, wysokosc?: number|null}} args
 * @returns {'pion'|'poziom'|''} '' = wymiarów nie ma albo są bez sensu
 */
export function kierunekEkranu({ szerokosc = null, wysokosc = null } = {}) {
  if (!Number.isFinite(szerokosc) || !Number.isFinite(wysokosc)) return '';
  if (szerokosc <= 0 || wysokosc <= 0) return '';
  return szerokosc >= wysokosc ? 'poziom' : 'pion';
}

/**
 * Czy między dwoma pomiarami nastąpił obrót (pion ↔ poziom).
 *
 * @param {{przed?: string, po?: string}} args kierunki z `kierunekEkranu`
 * @returns {boolean} true = czas kliknąć ◎ za gracza
 */
export function czyObrotEkranu({ przed = '', po = '' } = {}) {
  if (typeof przed !== 'string' || typeof po !== 'string') return false;
  if (przed === '' || po === '') return false; // pierwszy pomiar to nie obrót
  return przed !== po;
}
