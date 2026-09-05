# Plan: M3 — dokończenie ekranu konfiguracji i geolokalizacji na żywo

- **Data:** 2026-09-05
- **Kamień:** M3 (`docs/ROADMAP.md`) — najwyższy nieukończony po zamknięciu M2
- **Status:** w trakcie
- **Baza:** `ebb91f8` (zamknięcie M2), brama 241 testów zielona

## Cel i stan zastany

`ROADMAP` M3 obiecuje: setup (gracze i imiona, tryb ruchu, promień, liczba
stacji, tematy, wiek, język, kod gry, kara, współpraca), walidację, zapis
`okolica:konfig`, `watchPosition` z badge'em dokładności, tryb testowy
(`?tryb=test`, ręczne współrzędne i symulacja trasy) oraz ekran „dane
i prywatność". Kryterium: pełna konfiguracja na telefonie bez przewijania;
pozycja aktualizuje się na żywo; tryb testowy pozwala rozegrać grę bez GPS.

**Zrobione przed czasem (M0/M1, odnotowane w `ROADMAP`):** cały setup
z walidacją K01–K20 i zapisem `okolica:konfig` (schemat `konfig/1`),
`watchPosition` przez osłonę `pozycja.watchPozycja()` z badge'em dokładności
i pauzą w tle, tryb testowy z ręcznymi współrzędnymi (odmowa pustych pól —
P06, żadnego „Null Island"), symulacja trasy jako czysta funkcja
`pozycja.sekwencjaSymulowana()`.

**Zostało na M3 (zakres tego planu):**

1. ekran „dane i prywatność" (ADR 0013 pkt 7) z przyciskiem kasowania danych,
2. podpięcie symulacji trasy do UI trybu testowego (dziś istnieje tylko jako
   czysta funkcja),
3. sprawdzenie na żywo kryterium „pełna konfiguracja na telefonie bez
   przewijania" (360 px) — robi właściciel.

## Ustalenia wstępne

1. **Ekran prywatności to nie krok gry.** Pasek kroków ma pięć pozycji
   (setup → pozycja → stacje → pytania → paczka) i tak zostaje; ekran
   `ekran-prywatnosc` jest pomocniczy: otwierany przyciskiem z setupu i ze
   stopki, a „← wróć" prowadzi na ekran, z którego przyszliśmy
   (`STAN.ekran` zapamiętywany w `pokazEkran`).
2. **Treść ekranu jest statycznym HTML-em** w prostym języku, bez prawniczego
   żargonu (ADR 0013 pkt 7): cztery karty — co jest pobierane i od kogo; co
   zostaje na telefonie; gdzie trafia pozycja; jak skasować. Plus akapit o
   paczce: **ukryta, nie zaszyfrowana** (ADR 0007 — słowo „zaszyfrowana" tylko
   w zaprzeczeniu).
3. **Kasowanie danych przyciskiem, nie `confirm()`:** dwustopniowo (pierwszy
   klik uzbraja i mówi, co się stanie; drugi kasuje klucze `okolica:*`), bo
   na telefonie przypadkowe `confirm()` klika się „OK" bez czytania. Komunikaty
   idą do pola z `role="status"`, nie do `alert()` (ADR 0015 pkt 6).
4. **Symulacja trasy w UI** steruje tym samym potokiem fixów co GPS: jeden
   `przyjmijFix(fix, ocena)` dla watchera i dla symulatora, więc badge
   dokładności, mapa i próg dojścia zachowują się identycznie. Autoodtwarzanie
   na `setInterval` (krok co ~0,4 s) z przyciskiem start/stop; krok symulacji
   jest osobną funkcją, żeby test nie czekał na zegar.
5. **Zero nowych zależności i zero tekstu wymyślanego w JS** (ADR 0001,
   ADR 0015 pkt 6): nowe napisy tylko w `index.html`, w JS wyłącznie dane
   (klucze `localStorage`, liczby).
6. **Cache-busting** `?v=m2-1` → `?v=m3-1` po zmianie modułów `app/`
   (AGENTS §7; spójność pilnuje kontrakt).

## Etapy

- [x] **H1 — plan** (ten plik).
- [x] **H2 — ekran „dane i prywatność":** sekcja w `index.html` (cztery karty
      + przycisk kasowania + pole statusu), przyciski otwierające w setupie
      i w stopce, `pokazPrywatnosc()`/`wrocZPrywatnosci()` i `STAN.ekran`
      w `app.js`, dwustopniowe czyszczenie kluczy `okolica:*`; testy
      w `test/aplikacja.test.js` (otwieranie/powrót, uzbrojenie vs kasowanie)
      i kontrakt na obecność czterech kart oraz zaprzeczenia szyfrowania.
- [ ] **H3 — symulacja trasy w UI:** refactor `onFix` watchera do wspólnego
      `przyjmijFix()`, przycisk „Symuluj dojście" widoczny tylko w trybie
      testowym, `setInterval` z `krokSymulacji()` i stop; test: sekwencja fixów
      aktualizuje badge, mapę i w końcu zgłasza dojście do celu, a stop
      zatrzymuje strumień.
- [ ] **H4 — dokumentacja i zamknięcie:** `ARCHITECTURE` (ekran prywatności,
      driver symulacji), `ROADMAP` M3 (status + adnotacja o kryterium
      „bez przewijania" dla właściciela), `WORKFLOW` (punkt checklisty 360 px),
      `PROJECT_HISTORY`, handoff, `LESSONS` jeśli coś zaskoczy, bump
      `?v=m3-1`, brama.

## Ryzyka i pytania

- **Przewijanie setupu na 360 px:** obecny setup ma cztery karty pól; możliwe,
  że kryterium „bez przewijania" jest nieosiągalne bez zwinięcia sekcji
  (details/summary). Decyzja na H4 po oglądzie właściciela: albo akceptujemy
  przewijanie jako świadome odstępstwo (wpis w `ROADMAP`), albo składamy
  rzadziej używane pola do `<details>`.
- **Symulacja a pauza w tle:** `visibilitychange` zamyka watchera GPS, ale
  symulacja nie jest watcherem — musi się zatrzymać razem z pauzą, inaczej
  fixy „lecą" w tle (bateria, uczciwość pomiaru). Sprawdź w teście.
- **Kasowanie danych a trwająca gra:** przycisk usuwa tylko klucze
  `okolica:*`; stan bieżącej sesji zostaje w pamięci (jak odświeżenie strony
  bez zapisu) — to świadome, opisane na ekranie.

## Kryteria ukończenia

1. `npm run brama` zielone (≥ 241 testów + nowe).
2. Ekran „dane i prywatność" osiągalny z setupu i ze stopki, wraca na
   właściwy ekran, a przycisk kasowania naprawdę usuwa klucze `okolica:*`
   (test na wspólnej pamięci atrapy).
3. Tryb testowy pozwala **rozegrać dojście bez GPS**: symulacja aktualizuje
   badge i mapę tym samym potokiem co GPS i zatrzymuje się przyciskiem.
4. Żaden nowy napis nie powstaje w JS (kontrakt/PR review), brak `confirm()`.
5. Właściciel potwierdza na 360 px, czy setup mieści się bez przewijania
   (albo akceptuje odstępstwo) — wpis w `PROJECT_HISTORY`.
