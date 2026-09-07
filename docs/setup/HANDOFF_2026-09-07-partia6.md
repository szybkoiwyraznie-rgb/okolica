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
| 5 | Kryteria paczki: miejsce ±200 m, wiek, **ilość pytań w sumie**, tematy nie szersze (liczba stacji i transport wypadają) | `sumaPytanWpisu()` + `powodyNiedopasowania()` w `app/zestawy.js`; paczka z większą liczbą pytań też pasuje; aneks ADR 0024 | (commit 3) |
| 6 | Checkbox zgody ma zniknąć **także** z gry wieloosobowej, a wszystko ma być opisane w prywatności | `#multi-zgoda` i `okolica:multi:zgoda` usunięte; sekcja prywatności dostała „Gra na wielu telefonach" i „Paczki pytań"; dopisek do ADR 0019 | (commit 3) |
| 7 | Błąd: setup 5 stacji, ekran stacji pokazał 4, ekran pytań `[WE06] … (4) nie zgadza się z konfiguracją (5)` | Sieć słusznie dała 4 (S12), ale setup zostawał przy 5 — teraz setup idzie za wyborem, promień liczy się od nowa, a ekran mówi dlaczego i jak zwiększyć promień (§5) | (commit 3) |
| — | Dokumenty + cache-bust (runda 2) | ADR 0019 dopisek, ADR 0024 uzupełnienie, PROTOKOL §9, instrukcja, PROJECT_HISTORY, `?v=m12-16` | (commit 4) |

**Brama na koniec partii:** `npm run brama` = **572 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-16` (43 miejsca
+ `WERSJA_SW`).

## 2. Co wisi

1. **Wklejenie skryptu mostu (z partii 5, bez zmian):**
   `docs/setup/apps-script-repo-paczek.gs`, 963 linie, md5
   `01e1d9bdfa071d2634dc33d87607420f` — akcja `gra-hotseat` + premia hot-seat 0.
   Kroki: `docs/setup/most-drive-instrukcja.md` → „Awaryjnie".
2. **Kryteria dopasowania paczki — ROZSTRZYGNIONE (odpowiedź właściciela,
   ten sam dzień).** Zostają cztery: **okolica ±200 m · wiek · tematy nie
   szersze niż setup · suma pytań co najmniej jak w setupie.**
   - „istotna jest ilość pytań w sumie, a nie ilość pytań na stację" — paczka
     2×10 pasuje do setupu 5×4 (oba = 20 pytań); paczka może mieć **więcej**
     pytań niż setup („Wystarczy, że ma nie mniej").
   - **liczba stacji wypada** z kryteriów („Liczba stacji jest nieistotna o ile
     suma pytań się zgadza"),
   - **tematy zostają** („Z tych dwóch o które pytasz ma zostać tylko tematy
     nie szersze"),
   - **środek transportu wypada** (właściciel wycofał „dodaj").
   Kod: `sumaPytanWpisu()` + `powodyNiedopasowania()` w `app/zestawy.js`,
   aneks ADR 0024; testy `test/zestawy.test.js`, `test/zestawy-ui.test.js`.
   Skryptu mostu to NIE dotyka — dopasowanie liczy się w aplikacji.
3. **Checkbox zgody zniknął też z gry wieloosobowej** (`#multi-zgoda`,
   `okolica:multi:zgoda`) — dopisek do ADR 0019, wszystko opisane w sekcji
   „Dane i prywatność" (nowy punkt „Gra na wielu telefonach"). Schematy `RO-*`
   nigdy nie miały pola `zgoda`, więc most i protokół bez zmian.
4. **Naprawiony błąd „4 stacje zamiast 5 → WE06"** (patrz §5).

## 5. Zgłoszony błąd: 4 stacje zamiast 5 i „prompt nie został zbudowany" [WE06]

**Objaw u właściciela:** gra wieloosobowa, 2 graczy, setup 5 stacji, ekran 3
pokazał 4, ekran pytań: `prompt nie został zbudowany` /
`[WE06] liczbaStacji: Liczba stacji (4) nie zgadza się z konfiguracją (5).`

**Przyczyna (dwie części):**
- `wybierzStacje()` (`app/stacje.js`) **uczciwie** oddaje mniej stacji niż
  zamówione, gdy sieć nie pozwala zachować odstępów: greedy dobiera węzły póki
  znajdzie taki poza `minimalnyOdstepM` i spoza korytarza już wybranych, a jak
  takich braknie — pętla się kończy. Wyrównanie odległości działa tylko przy
  `wybrane.length === liczbaStacji`. To znany kod **S12**.
- Ekran pytań patrzył na **setup, nie na mapę**: `przeliczZTegoCoJest()`
  zostawiał `liczbaStacji = 5`, więc `budujPrompt()` trafiał w niezmiennik
  WE06 (`app/protokol.js`) i nic nie dało się wygenerować.

**Naprawa — to, co wybrano, jest grą:** przy mniejszej liczbie setup dostaje
tyle stacji, ile stanęło na mapie, `#setup-stacje` jest aktualizowane, promień
liczy się z nowej liczby (ADR 0025: ten sam czas gry na mniej stacji = dłuższy
odcinek), a ekran stacji mówi wprost:
„Sieć drogowa w tej okolicy nie dała 5 stacji w wymaganych odstępach — jest
ich 4 i tyle będzie w grze (setup zmieniony na 4). Chcesz 5? Zwiększ czas gry,
żeby powiększyć promień, albo zmień okolicę." (S12)

WE06 zostaje jako strażnik spójności, ale z UI nie powinien być osiągalny.
Test: `test/aplikacja.test.js` → „sieć za uboga na zamówioną liczbę — setup
idzie za wyborem, a prompt się buduje (S12)".

## 6. Jak to sprawdzić

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

## 7. Ryzyka i pułapki

- Paczka o promieniu większym niż setup może być teraz zaproponowana (promień
  nie jest kryterium). Gracz widzi odległości stacji przed startem, a czas gry
  i tak przelicza się na promień (ADR 0025) — ale warto to obejrzeć w terenie.
- `dopasujZestawy` nadal przyjmuje `promienM` w kryteriach (sygnatura bez
  zmian, testy i wywołania nietknięte) — pole jest po prostu ignorowane.
- Wynik gry nie jedzie na Drive, gdy żaden gracz nie ma potwierdzonego profilu
  (np. cały czas bez zasięgu) — `#wynik-drive` mówi to wprost.
