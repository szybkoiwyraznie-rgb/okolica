# 0011 — Mobile-first: interfejs dotykowy jako podstawowy, dostępność i czytelność w słońcu

- Status: Zaakceptowana
- Data: 2026-09-05

> **Uwaga (2026-09-14, ADR 0047):** fragment „cała aplikacja pozostaje
> przybliżalna palcami” został ZASTĄPIONY — strona nie jest szczypalna poza
> mapą (blokada `gesturestart`/`gesturechange` poza `.mapa`). Mapa i jej
> sterowanie bez zmian; reszta ADR (mobile-first, cele dotykowe, układ,
> wklejanie) w mocy.

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

## Aneks 2026-09-13d (m12-114, zgłoszenie właściciela): czekanie na sieć jest widoczne — komunikaty pulsują

Właściciel 2026-09-13: operacje sieciowe, które każą czekać, muszą być WIDAĆ —
inaczej ekran wygląda na zepsuty, a gracz klika drugi raz. Sygnałem jest klasa
`.pulsuje`: spokojna animacja przezroczystości 1 → 0,7 → 1 (1,4 s,
`ease-in-out`, nieskończona), dokładana do komunikatu na czas czekania
i gaszona razem z nim. Niosą ją `status(tekst, { czeka: true })` (`#status`),
nowy `statusZestawow(tekst, { czeka: true })` (`#zestawy-status`, jeden zapis
tekstu i sygnału zamiast dziewięciu) oraz nakładka `#stacje-ladowanie`.
Pulsują: „Sprawdzam repozytorium paczek dla tej okolicy…", ponowienie po
zimnym starcie mostu, „Pobieram dane sieci drogowej…", „Pobieram paczkę
z repozytorium…" i „Wysyłam zaległe zdarzenia gry…".

Dostępność (pkt 3 tego ADR): animacja jest DODATKIEM do zdania, nie jego
zamiennikiem — tekst zostaje czytelny w każdej klatce, a najniższa
przezroczystość 0,7 trzyma kontrast mierzony `tools/audyt-kontrastu.mjs`
(`--tekst` na `--tlo`): 5,62:1 w motywie jasnym i 8,25:1 w ciemnym, oba
powyżej AA 4,5:1. Przy `prefers-reduced-motion: reduce` animacja jest
wyłączona, a komunikat zostaje na ekranie bez ruchu. Przycisk paczki
w trakcie pobierania jest dodatkowo `disabled` i zmienia etykietę na
„⏳ Ładowanie paczki…" — sygnał i blokada drugiego kliku (podwójne pobranie
i podwójne „użycie" paczki) w jednym; dotyk ma 44 px jak dotąd.

## Aneksy 2026-09-12 (m12-95) i 2026-09-14 (m12-115) są w archiwum (poza budżetem lektury)

„START GRY” zgaszony w trakcie gry i negatywowe `.pulsuje` (czarny boks,
kontrast 21:1) opisują `docs/decisions/archive/aneksy-0011-2026-09-12.md`
i `...-2026-09-14.md`; poza budżetem lektury startowej (AGENTS.md §0; L62).
Obowiązują: przycisk zgaszony, gdy gra toczy się na tym urządzeniu, a przy
`prefers-reduced-motion` ruch gaśnie, tekst zostaje.


## Aneks 2026-09-16d (B26) — jawna lista wyjątków od pkt 2 (cele dotykowe)

Pomiar live w stopce ⓘ Informacje: przyciski `.przycisk-stopka` („Dane
i prywatność”, „wyczyść pliki tymczasowe aplikacji”) mają 24 px. Właściciel
(2026-09-16): „**zmień obietnice, wielkość 24 jest ok**” — stąd jawny wyjątek
zamiast zmiany CSS. Wyjątki od pkt 2 (uzasadnienia: ADR 0042 → aneks
2026-09-16d): przyciski mapy (minimum 40 px, jak w pkt 2), `.warstwa-krzyzyk`
oraz `.przycisk-stopka` w stopce Informacji. Wszystkie pozostałe cele
dotykowe — ≥ 44 px; pin kontraktu trzyma obie strony decyzji.
