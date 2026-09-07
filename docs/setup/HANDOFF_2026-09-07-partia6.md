# HANDOFF 2026-09-07 (partia 6) — cztery uwagi właściciela po partii 5

> Stan na koniec sesji. Dokument jednorazowy (`AGENTS.md` §5): reguły trwałe są
> w ADR-ach, protokole, `LESSONS.md` i `ASSETS.md` — tutaj tylko co zrobione,
> jak to uruchomić, co dalej i co wisi.

## 1. Co ta sesja zrobiła

| # | Uwaga właściciela | Co z tego wyszło | Commit |
|---|---|---|---|
| 1 | Paczki „znajdują się" wiele kilometrów od miejsca wygenerowania | **Dopasowanie było poprawne** — zmierzone: paczka z Podkowy przy pozycji w Łodzi to 97 km od komórki paczki przy tolerancji 200 m, czyli 0 dopasowań. Winny był komunikat, który liczył cały indeks. Teraz paczki spoza okolicy nie są liczone ani wspominane | (commit 1) |
| 2 | Promień nie powinien być kryterium; komunikat ma mówić CO nie pasuje | `promienM` wypadł z kryteriów (aneks ADR 0024); `powodyNiedopasowania()` w `app/zestawy.js` jest jedynym rozstrzygającym miejscem, a karta paczek cytuje powody | (commit 1) |
| 3 | Imię gracza i „Usuń" za małe i sklejone | `#lista-graczy li`: 17 px, `gap: 16px`, `padding: 12px 0`; przycisk 15 px, `nowrap` | (commit 1) |
| 4 | Checkbox zgody na zapis wyniku ma zniknąć | Usunięty; zapis jest domyślny, a sekcja prywatność dostała kartę „Wspólny Drive: historia i rankingi" (dopisek do aneksu ADR 0026) | (commit 1) |
| — | Dokumenty + cache-bust | PROTOKOL §9.5, BACKLOG B22, instrukcja wdrożenia, PROJECT_HISTORY, `?v=m12-15` | (commit 2) |

**Brama na koniec partii:** `npm run brama` = **571 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-15` (43 miejsca
+ `WERSJA_SW`).

## 2. Co wisi

1. **Wklejenie skryptu mostu (z partii 5, bez zmian):**
   `docs/setup/apps-script-repo-paczek.gs`, 963 linie, md5
   `01e1d9bdfa071d2634dc33d87607420f` — akcja `gra-hotseat` + premia hot-seat 0.
   Kroki: `docs/setup/most-drive-instrukcja.md` → „Awaryjnie".
2. **Pytanie do właściciela o zestaw kryteriów dopasowania paczki.** Właściciel
   wymienił: miejsce ±200 m, wiek, ilość pytań, środek transportu. W kodzie jest
   teraz: okolica ±200 m, wiek, liczba stacji, pytania na stację, tematy nie
   szersze niż w setupie. Różnice:
   - **liczba stacji i tematy** zostały jako kryteria (właściciel ich nie
     wymienił) — do potwierdzenia, czy zostają;
   - **środek transportu NIE jest sprawdzany**, bo paczka go nie zapisuje:
     nie ma go ani w `TO-zestaw/1` (`zbierzMetaZestawu`), ani w indeksie
     (`budujIndeks`). Dodanie go to zmiana protokołu + kolejne wklejenie
     skryptu (może jechać razem z `gra-hotseat`).

## 3. Jak to sprawdzić

```bash
npm test          # 571 testów
npm run brama     # testy + sync szablonu + audyt WCAG AA
npm run serwer    # podgląd 0.0.0.0:8000 (360 px)
```

- Ekran 2 z pozycją w innej miejscowości: karta mówi „Repozytorium nie ma
  paczek dla tej okolicy — nowe pytania przygotuje model." (bez „w indeksie: N").
- Ekran 2 z paczką w okolicy o innej liczbie stacji: „W tej okolicy jest 1
  paczka, ale nie pasuje: Podkowa Leśna — liczba stacji: paczka 5, setup 3."
- Ekran 1: lista graczy z dużym imieniem i wyraźnym odstępem do „✕ Usuń";
  pod listą nie ma już checkboxa zgody.

## 4. Ryzyka i pułapki

- Paczka o promieniu większym niż setup może być teraz zaproponowana (promień
  nie jest kryterium). Gracz widzi odległości stacji przed startem, a czas gry
  i tak przelicza się na promień (ADR 0025) — ale warto to obejrzeć w terenie.
- `dopasujZestawy` nadal przyjmuje `promienM` w kryteriach (sygnatura bez
  zmian, testy i wywołania nietknięte) — pole jest po prostu ignorowane.
- Wynik gry nie jedzie na Drive, gdy żaden gracz nie ma potwierdzonego profilu
  (np. cały czas bez zasięgu) — `#wynik-drive` mówi to wprost.
