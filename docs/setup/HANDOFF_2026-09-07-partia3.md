# HANDOFF 2026-09-07 (partia 3, PR #4) → następny agent

Sesja: siedem punktów właściciela. Sześć wdrożonych, jeden (część B punktu 6)
zaprojektowany. Stan: **zielony** — `npm run brama` = 538/538 + sync szablonu
OK + WCAG AA 0 naruszeń. Cache-bust: **m12-11** (43 miejsca + `WERSJA_SW`).
Budżet lektury: **44 292 / 100 000** tok (rezerwa 55 708).

## Commity tej partii (kolejność = kolejność wdrażania)

| Commit | Punkt | Co |
| --- | --- | --- |
| `9c6dc46` | 7 | `.github/workflows/pages.yml` + lustro `docs/setup/pages-workflow.yml` (kontrakt: bajt w bajt od `name: Pages`), deploy na GitHub Pages |
| `fafa00e` | 5 | Budżet lektury 40 tys. → **100 tys.** tokenów (`LIMIT_TOKENOW`, AGENTS §0, B14, B18 rozstrzygnięty) |
| `6d20517` | 2 | Prompt: „dostają pytania **z wybranych dziedzin**" (PROTOKOL §2 → `SZABLON_PROMPTU`, `PYT/1.0.6`) |
| `22f13d3` | 3 | Dopasowanie okolicy z tolerancją 200 m od komórki geohash (ADR 0024) |
| `13a6b13` | 4 | Czas gry zamiast promienia; promień liczony (ADR 0025) |
| `fe802e3` | 1 | Tożsamość bramą ekranu 1: imię + PIN, jedno wołanie mostu (ADR 0026) |
| `6361928` | 6A | Hot-seat: pytania po równo na gracza (K22) + projekt części B (ADR 0027) |

## Co zostało do zrobienia

1. **PUSH!** Ostatnie commity (`fe802e3`, `6361928`) są tylko lokalne:
   `gh auth status` = „The github.com token in GH_TOKEN is no longer valid".
   Właściciel musi odświeżyć połączenie GitHub w Arena, potem
   `git push origin arena/01a07c4f-okolica` i aktualizacja opisu PR
   (`gh api -X PATCH repos/szybkoiwyraznie-rgb/okolica/pulls/4`).
2. **Punkt 6 część B** — gra sieciowa bez tur: projekt w ADR 0027 pkt 7
   (zakres zmian per moduł), BACKLOG B20. Największy kawałek roboty w projekcie.
3. **BACKLOG B19** — `geohash6` dla starych paczek dopisywany w moście Drive
   (`budujIndeks` ma `zestaw.stacje`); klient już woli `geohash6`. Wymaga
   wklejenia nowej wersji skryptu przez właściciela.
4. **Weryfikacja właściciela w podglądzie (360 px)**: ekran 1 urósł o blok
   „👤 Kim jesteś?" (dwa pola + akapit stanu) i stracił pole promienia. Kryterium
   „pełna konfiguracja bez przewijania na 360 px" (WORKFLOW §4.2) jest do
   ponownego potwierdzenia — agent nie ma przeglądarki, mierzył tylko strukturę.
5. **Deploy Pages**: workflow jest w repo, ale Pages wymaga pusha na `main`
   (albo ręcznego `workflow_dispatch`, gdy go dodamy) — po merge PR #4.

## Pułapki, które kosztowały czas w tej sesji

- `git add index.html app/ sw.js test/ docs/` **nie łapie `README.md`** (korzeń)
  — `git status --short` przed każdym commitem (LESSONS L29).
- W node `../app/geo.js` i `./geo.js?v=…` to **dwie instancje modułu** — testy
  nie mogą porównywać tożsamości funkcji, tylko wyniki.
- Zmiana domyślnego promienia (1000 → 500 m) wywróciła 38 testów: fixture'y
  Overpass i paczek są ułożone pod 1000 m, więc przy 500 m sieć jest słusznie
  „za uboga". Testy sieciowe ustawiają teraz `czasGryMin: 110`, paczkowe `85`.
- `dolozWpisRejestru` **zwraca nowy rejestr**, nie mutuje; `zbierzMetaZestawu`
  bierze płaskie `{lat, lon, …}`, nie `{pozycja, konfig}`.
- Asynchroniczna brama tożsamości: testy klikające „Dalej" muszą czekać
  (`await czekaj(…)`), a test mapy D3 dostał zweryfikowany profil w pamięci,
  żeby nie zależeć od mostu.
- Edytor python: skrypt, który tylko **drukuje** fragment pliku, nic nie zapisuje
  — dwie edycje przepadły w ten sposób i wróciły jako czerwone testy.
