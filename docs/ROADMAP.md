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
| M3 — Konfiguracja i geolokalizacja | 🟡 kod gotowy, czeka kryterium | ekran prywatności + symulacja w UI; CZYTAJ: §M3 (360 px) |
| M4 — Stacje z sieci drogowej | 🟡 kod gotowy, czeka kryterium | pipeline Overpass + UI, 3/3 fixture'y ≤ 15%; CZYTAJ: §M4 (teren) |
| M5 — Pętla pytań | 🟡 kod gotowy, czeka kryterium | edycja, podgląd, eksport/import, Nominatim opt-in; CZYTAJ: §M5 (model) |
| M6 — Rozgrywka | 🟡 kod gotowy, czeka kryterium | ekran gry, trwalosc.js, wznowienie; CZYTAJ: §M6 (telefon) |
| M7 — Podsumowanie i udostępnianie | 🟡 kod gotowy, czeka kryterium | ranking, eksporty, historia; CZYTAJ: §M7 (słońce/eksporty) |
| M8 — Publikacja i brama jakości | 🟡 kod gotowy, czeka właściciela | manifest, ikony, CI, ASSETS §6; publikację włącza właściciel (WORKFLOW §5) |
| M9 — Repozytorium paczek | ✅ 2026-09-06 (M9b) | kopia lokalna + most Drive (adres w kodzie) |
| M10 — Dopracowanie terenowe | 🟡 kod gotowy, czeka kryterium | sw.js, PROFILE_GPS, sygnały, WCAG AA 0 naruszeń; CZYTAJ: §M10 (§4.3) |
| M11 — Gra wieloosobowa (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | most `.gs` + UI; CZYTAJ: §M11 |
| M12 — Rankingi (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | pseudonim + ekran 🏆, agregacje na telefonie; CZYTAJ: §M12 |

## Kamienie zamknięte (M0, M1, M2, M9)

Szczegóły wykonania (etapy, commity, liczby testów): `docs/PROJECT_HISTORY.md`
§ „sesja M0/M1/M2" i § „M9" oraz plany w `docs/plans/`. Rewizja M9b (most
Drive zamiast `data/paczki/`): PROJECT_HISTORY § „decyzja właściciela:
współdzielone repozytorium paczek na Google Drive" + ADR 0016/0017/0018.

## M3 — Ekran konfiguracji i geolokalizacja na żywo

Kod gotowy: setup (K01–K21), `watchPosition`, `?tryb=test`, prywatność,
symulacja. **Czeka kryterium** (WORKFLOW §4.2): konfiguracja bez przewijania
na 360 px (albo odstępstwo, albo rzadkie pola w `<details>`).

## M4 — Stacje z sieci drogowej (największe ryzyko)

Kod gotowy: pipeline Overpass, cache, degradacja do pierścienia, pinezki.
**Czeka kryterium terenowe** (§4.2): jedna prawdziwa okolica na telefonie (+gesty M2).

## M5 — Pętla pytań (prompt → model → walidacja → paczka)

Kod gotowy: edycja `modyfikacje[]`, podgląd, eksport/import, Nominatim opt-in.
**Czeka kryterium**: pełna pętla z prawdziwym modelem AI.

## M6 — Rozgrywka

Kod gotowy: ekran gry, lej fixów, dojście GPS/ręczne, pauza, pominięcie,
wznowienie. **Czeka kryterium terenowe** (§4.2): pełna gra na telefonie
(z utratą zasięgu i zamknięciem przeglądarki).

## M7 — Podsumowanie, punkty i udostępnianie

Kod gotowy: karta zwycięzcy, ranking, eksporty (Share → schowek → plik),
historia. **Czekają kryteria** (§4): czytelność w słońcu 360 px; eksporty
Chrome Android i Safari iOS.

## M8 — Publikacja i brama jakości

Kod gotowy: `.nojekyll`, manifest + ikony, CI, ASSETS §6. **Czeka krok
właściciela**: włączenie publikacji (jednorazowo; poza zasięgiem agenta).

## M10 — Dopracowanie terenowe

Kod gotowy: `sw.js`, PROFILE_GPS, sygnały, WCAG AA (0 naruszeń).
**Czeka kryterium terenowe** (§4.3) — wynik do LESSONS.

## M11 — Gra wieloosobowa na wielu urządzeniach przez Drive (decyzje właściciela: ADR 0019)

Kod zamknięty (P1–P7): sekcja gier w moście, sync, pełne UI.
**Czeka**: scalenie `main` (Pages) + test dwóch telefonów (§4.4).

## M12 — Profil, statystyki i rankingi gracza na Drive (decyzje właściciela: ADR 0019)

Kod zamknięty (P6): ekran 🏆 (ogólny + filtry + Moje gry; liczy telefon).
**Czeka**: scalenie `main` + test terenowy (§4.4 pkt 7).

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
