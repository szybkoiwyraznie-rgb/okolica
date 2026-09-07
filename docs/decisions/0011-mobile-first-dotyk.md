# 0011 — Mobile-first: interfejs dotykowy jako podstawowy, dostępność i czytelność w słońcu

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Gra dzieje się **na zewnątrz, na telefonie** (Chrome mobilny; sterowanie
i wklejanie promptów z punktu widzenia dotyku): jedna ręka zajęta, ekran
w słońcu, rękawiczki, pośpiech, mokry ekran. Desktop jest wtórny (organizator
przygotowuje paczkę przy biurku).

## Decyzja

1. **Projekt od 360 × 640 px w górę.** Układ: jeden ekran = jedna decyzja,
   bez przewijania w trakcie gry. Kolumna desktopowa (≥ 900 px) rozszerza
   układ (mapa + panel obok siebie), nic nie jest „tylko na desktopie".
2. **Cele dotykowe ≥ 44 × 44 px** (zalecenie WCAG/Apple; minimum 40 px przy
   przyciskach mapy), odstępy ≥ 8 px, brak akcji wymagających najechania
   (`:hover` tylko jako wzmocnienie, nigdy jako jedyna droga), brak
   dwukliku jako jedynej interakcji, brak gestów kolidujących z przewijaniem
   strony (pinch mapy przez `touch-action: none` na jej kontenerze).
3. **Sterowanie mapą**: drag jednym palcem, pinch dwoma, tap w pinezkę =
   szczegóły, przyciski ekranowe ＋ − ⟲ „namierz mnie" zawsze dostępne w zasięgu
   kciuka (dolna część ekranu dla trybu gry, górna dla setupu).
4. **Wklejanie promptu na telefonie**: duże pole `<textarea>` (min. 6 wierszy),
   przyciski „wklej ze schowka" i „kopiuj" z jawnym potwierdzeniem, a **obok**
   import z pliku i eksport do pliku — bo schowek w przeglądarkach mobilnych
   i w iframe bywa niedostępny (ENVIRONMENT §5). Instrukcja krok po kroku
   z ikonami, nie ścianą tekstu.
5. **Czytelność w słońcu**: kontrast ≥ 4.5:1 dla tekstu i ≥ 3:1 dla elementów
   interakcji (WCAG AA), motyw **jasny jako domyślny w trybie gry** (w słońcu
   ciemny motyw jest nieczytelny), ciemny dostępny przełącznikiem i domyślny
   dla setupu wieczorem; rozmiary pisma: komunikat gry ≥ 20 px, numer stacji
   ≥ 28 px.
6. **Zero zewnętrznych zasobów UI**: bez webfontów (font systemowy:
   `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), bez ikon z CDN —
   ikony jako emoji albo inline SVG. Strona ma jeden request HTML + kilka
   modułów (ADR 0001).
7. **Dostępność**: semantyczne elementy, `aria-label` na przyciskach ikonowych,
   `role="dialog"` + fokus w warstwach, komunikaty stanu przez `aria-live`,
   pełna obsługa klawiaturą (dla desktopu i dla urządzeń wspomagających),
   `viewport-fit=cover` + `env(safe-area-inset-*)` dla iPhone'a z notchem.
8. **Język interfejsu: polski** (treść pytań może być w innym języku przez
   parametr `jezyk`, ADR 0006/§3). Komunikaty błędów mówią, **co zrobić**,
   nie tylko co się stało.
9. **PWA-lite**: `manifest.json` + ikony (żeby „dodaj do ekranu głównego"
   działało) są w zakresie; Service Worker (offline) — w `docs/BACKLOG.md`,
   wymaga osobnego ADR.

## Konsekwencje

- Weryfikacja UI **musi** być robiona w szerokości 360 px (devtools albo
  headless Chromium z `setViewport`, ENVIRONMENT §4.1) — sprawdzenie na
  desktopie nic nie mówi.
- Część rozwiązań (pinch, bezpieczne obszary, zachowanie schowka w Safari) nie
  da się przetestować w sandboxie → testy kontraktowe CSS/DOM + test
  **w terenie** właściciela (`docs/WORKFLOW.md` §4), wyniki w `docs/LESSONS.md`.
- Emoji jako ikony wyglądają różnie na Androidzie/iOS — akceptujemy to
  (zero zależności), ale nie używamy emoji do przekazywania informacji
  krytycznej bez etykiety tekstowej.

## Powiązania

0001 (zero zależności), 0003 (gesty mapy), 0006 (wklejanie promptu),
0009 (czyja kolejka), `docs/WORKFLOW.md` §4 (test terenowy).
