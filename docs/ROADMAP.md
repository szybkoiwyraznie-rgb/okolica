# ROADMAP — Tajemnicza Okolica

> Plan kamieni milowych; status aktualizowany na końcu każdej sesji.
> Szczegóły bieżącego zadania żyją w `docs/plans/PLAN_*.md`, pomysły poza
> planem w `docs/BACKLOG.md`. Brak zlecenia właściciela = najwyższy otwarty
> kamień milowy (AGENTS.md §2).
> Historia wykonania kamieni zamkniętych żyje w `docs/PROJECT_HISTORY.md`
> (dziennik sesji) — tutaj tylko status i to, co jest OTWARTE.

## Status kamieni

| Kamień | Status | Wynik / co otwarte |
|---|---|---|
| M0 — Fundament | ✅ 2026-09-05 | ADR 0001–0013, PROTOKOL PYT v1.0, szkielet 5 ekranów |
| M1 — Geodezja i model rozgrywki | ✅ 2026-09-05 | geo/pozycja/rozgrywka/kodowanie + testy |
| M2 — Mapa | ✅ 2026-09-05 | renderer SVG + 3 podkłady |
| M3 — Konfiguracja i geolokalizacja | 🟡 kod gotowy, czeka kryterium | ekran prywatności + symulacja w UI; kryterium: §Kryteria |
| M4 — Stacje z sieci drogowej | 🟡 kod gotowy, czeka kryterium | pipeline Overpass + UI, 3/3 fixture'y ≤ 15%; kryterium: §Kryteria |
| M5 — Pętla pytań | 🟡 kod gotowy, czeka kryterium | auto-start gry po przyjęciu, cicha wysyłka Drive prosto do repozytorium (bez moderacji, bez Nominatim); kryterium: §Kryteria |
| M6 — Rozgrywka | 🟡 kod gotowy, czeka kryterium | ekran gry, trwalosc.js, wznowienie; kryterium: §Kryteria |
| M7 — Podsumowanie i udostępnianie | 🟡 kod gotowy, czeka kryterium | ranking i historia; eksporty USUNIĘTE 2026-09-12 (ADR 0038); kryterium: §Kryteria |
| M8 — Publikacja i brama jakości | 🟡 kod gotowy, czeka właściciela | manifest, ikony, CI, ASSETS §6; publikację włącza właściciel (WORKFLOW §5) |
| M9 — Repozytorium paczek | ✅ 2026-09-06 (M9b) | kopia lokalna + most Drive (adres w kodzie) |
| M10 — Dopracowanie terenowe | 🟡 kod gotowy, czeka kryterium | sw.js, PROFILE_GPS, sygnały, WCAG AA 0 naruszeń; kryterium: §Kryteria |
| M11 — Gra wieloosobowa (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | most `.gs` + UI; kryterium: §Kryteria |
| M12 — Historia gier (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | wynik gry na wspólnym Drive; rankingi USUNIĘTE 2026-09-11 (aneks ADR 0019), wróciły w nowej formie 2026-09-12 — dwie tabele, sumy liczy most (ADR 0039); kryterium: §Kryteria |

## Kamienie zamknięte (M0, M1, M2, M9)

Szczegóły wykonania: `docs/PROJECT_HISTORY.md` (sesje M0/M1/M2 i M9) oraz
`docs/plans/`; rewizja M9b (most Drive zamiast `data/paczki/`) — ADR 0016–0018.

## Kryteria otwartych kamieni (kod gotowy — czeka właściciel)

Audyt 2026-09-10 (PR #8): poprawiony środek mapy przy ograniczaniu zoomu.
M10: SW nie zapisuje kafelków opaque, więc podkład offline nie jest gwarantowany;
warstwy własne i gra lokalna pozostają dostępne. Szczegóły: handoff 2026-09-10.

Zakres kodu każdego kamienia jest w tabeli wyżej i w `PROJECT_HISTORY`;
tutaj tylko to, co zostało do sprawdzenia:

- **M3** (§4.2): konfiguracja bez przewijania na 360 px — albo odstępstwo,
  albo rzadkie pola w `<details>`.
- **M4** (§4.2): jedna prawdziwa okolica na telefonie (+ gesty mapy z M2).
- **M5**: pełna pętla z prawdziwym modelem AI.
- **M6** (§4.2): pełna gra na telefonie, z utratą zasięgu i zamknięciem
  przeglądarki.
- **M7**: czytelność w słońcu na 360 px (kryterium zawężone 2026-09-12 — eksporty wyniku usunięte z aplikacji, ADR 0038).
- **M8**: włączenie publikacji — jednorazowy krok właściciela (WORKFLOW §5).
- **M10** (§4.3): checklista terenowa; wynik do LESSONS.
- **M11/M12** (§4.4): test dwóch telefonów (9 punktów, w tym „stan mostu").

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
