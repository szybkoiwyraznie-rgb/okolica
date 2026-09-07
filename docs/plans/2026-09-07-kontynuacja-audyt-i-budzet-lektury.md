# Plan sesji 2026-09-07 — kontynuacja: audyt PR #2, budżet lektury, porządki

> Zlecenie właściciela: „Kontynuujemy projekt.” (bez doprecyzowania).
> Wszystkie kamienie M0–M12 mają kod zamknięty i czekają na czynności
> właściciela (wdrożenie mostu, adres `/exec` w czacie, kryteria terenowe
> M3–M7/M10, test dwóch telefonów M11/M12). W tej sytuacji sesja — po
> obowiązkowym audycie — bierze pracę wskazaną regułami repo, nie pytanie
> „co robimy?” (AGENTS.md §2).

## S1 — Plan i PR na starcie (ten commit)

- Ten plan (`docs/plans/2026-09-07-kontynuacja-audyt-i-budzet-lektury.md`).
- Push gałęzi `arena/01a07b16-okolica` + `gh pr create` PRZED jakimkolwiek
  kodowaniem (ADR 0012 reguła 1).

## S2 — Audyt PR #2 (obowiązkowy, przed nową pracą)

- PR #2 (`d04a18a`, squash M0–M12: 120 plików, +34 641 linii) — audyt przez
  historię inkrementalną starej gałęzi `origin/arena/01a07282-okolica`
  (~90 commitów z opisami) + wyrywkowe diffy kluczowych modułów.
- Kryteria: logika, zgodność z ADR i PROTOKOŁEM, zieloność testów (brama
  499/499 już potwierdzona na starcie sesji).
- Wynik: do opisu PR i do `docs/PROJECT_HISTORY.md` (ADR 0012 reguła 2).

## S3 — Naprawa usterek z audytu

- Każda usterka = osobny commit, od razu push (ADR 0012 reguła 3).
- Znane już kandydatury (z rozeznania, do potwierdzenia w S2):
  - `AME-main.zip` nie istnieje w repo, a wymieniają go AGENTS.md, README.md
    i `docs/setup/ENVIRONMENT.md` (decyzja usunięcia: ADR 0002).
  - BACKLOG nie odnotowuje realizacji B1/B2/B6/B9/B13 (zrobione w M9–M12).

## S4 — B14: `tools/budzet-lektury.mjs` + pomiar bazowy

- AGENTS.md §0 wymaga, by lektura 1–6 mieściła się w 40 tys. tokenów, mierzona
  narzędziem, „gdy już powstanie”. Narzędzie nie istnieje — sesja je tworzy
  (licznik + raport per plik + exit code przy przekroczeniu + skrypt npm).
- Zgrubny pomiar sesji: 208 005 znaków / 26 747 słów → est. ~50–60 tys.
  tokenów, czyli próg prawie na pewno przekroczony. Pomiar narzędziem to
  rozstrzygnie obiektywnie.

## S5 — Skrócenie/rozdzielenie dokumentów (warunkowe na S4)

- AGENTS.md §0: „Gdy próg zostanie przekroczony, skrócenie/rozdzielenie
  dokumentów staje się obowiązkowym zadaniem sesji, a nie opcją.”
- Strategia do ustalenia po pomiarze; twarde zasady: zero utraty treści
  wiążącej (decyzje, kontrakty, reguły), historia i uzasadnienia — do
  `PROJECT_HISTORY`/archiwum z odsyłaczami, powtórzenia między dokumentami
  (statusy kamieni w README/ROADMAP/HISTORY) — do kondensacji.

## S6 — Porządki dokumentacyjne

- BACKLOG: adnotacje „zrealizowane w M…” przy B1/B2/B6/B9/B13 (B17 już ma).
- `AME-main.zip`: ujednolicenie AGENTS/README/ENVIRONMENT ze stanem faktycznym
  (plik usunięty decyzją właściciela, ADR 0002) — bez zmiany sensu reguł.
- Bez ruszania ADR-ów `Proponowana` (0005/0010/0013/0014/0015/0017): ich akceptacja
  to decyzja właściciela; sesja co najwyżej przygotuje zestawienie do ankiety.

## S7 — Domknięcie sesji

- Handoff `docs/setup/HANDOFF_2026-09-07-kontynuacja.md`, wpis PROJECT_HISTORY,
  ROADMAP (jeśli dotyczy), kumulatywny opis PR, blok przekazania w czacie
  (ENVIRONMENT §8).

## Ryzyka

- S5 to operacja na treści wiążącej: każdy ruch (przeniesienie/skrót) musi
  zostawić odsyłacz „gdzie to teraz mieszka”; kontrakty (`kontrakt.test.js`)
  muszą pozostać zielone.
- Sesja nie scala PR i nie pushuje do `main` (ADR 0012).
- Praca istnieje dopiero po `git push` (ENVIRONMENT §1).
