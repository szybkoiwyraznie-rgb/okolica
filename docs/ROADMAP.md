# ROADMAP — Tajemnicza Okolica

> Kamienie M0–M12 to **zakres kodu, który jest zrobiony**. Gra jest od wielu
> PR w teście terenowym u właściciela (iPhone). Status aktualizowany na końcu
> sesji. Szczegóły zadania: `docs/plans/PLAN_*.md`; pomysły poza planem:
> `docs/BACKLOG.md`. Historia: `docs/PROJECT_HISTORY.md`.
>
> **Brak zlecenia ≠ bierz M3.** Po audycie poprzedniego PR agent czeka na
> uwagi z terenu (właściciel, 2026-09-14). Nie przypomina o 360 px, o
> „pierwszym wdrożeniu” mostu ani o zamykaniu kamieni checklistą.

## Status kamieni

Wszystkie kamienie zakresu początkowego są **zamknięte jako kod**. Otwarta
jest pętla: test terenowy → uwaga właściciela → naprawa.

| Kamień | Status | Co zostało w kodzie |
|---|---|---|
| M0 — Fundament | ✅ | ADR 0001–0013, PROTOKOL PYT v1.0, szkielet ekranów |
| M1 — Geodezja i model rozgrywki | ✅ | geo/pozycja/rozgrywka/kodowanie + testy |
| M2 — Mapa | ✅ | renderer SVG, gesty, podkład OSM |
| M3 — Konfiguracja i geolokalizacja | ✅ | prywatność, GPS sam, panele nad mapą |
| M4 — Stacje z sieci drogowej | ✅ | Overpass, cache, degradacja do pierścienia |
| M5 — Pętla pytań | ✅ | prompt → wklejenie → auto-start, Drive |
| M6 — Rozgrywka | ✅ | fazy, zapis, autopowrót (ADR 0045) |
| M7 — Podsumowanie | ✅ | minimalny wynik (ADR 0038); ranking ADR 0039 |
| M8 — Publikacja | ✅ | Pages z Actions przy każdym pushu do `main` |
| M9 — Repozytorium paczek | ✅ | most Drive, adres w kodzie (ADR 0020) |
| M10 — Dopracowanie terenowe | ✅ | sw.js, sygnały, WCAG AA, gra bez pauzy (ADR 0040) |
| M11 — Gra wieloosobowa | ✅ | lobby, odliczanie, wyścig/wspólna trasa |
| M12 — Historia i ranking na Drive | ✅ | wynik na Drive; ranking dwie tabele |

## Co jest otwarte (nie kamień)

- **Uwagi z kolejnych testów terenowych** — jedyna kolejka pracy, gdy nie ma
  innego zlecenia. Właściciel gra na iPhonie (1334×750), nie na bramce
  „360 px bez przewijania”.
- **Most Apps Script** wdraża właściciel przy scaleniu PR (kolejne wersje web
  app, nie „pierwsze wdrożenie”). Agent nie trzyma kamienia otwartego, bo
  „trzeba jeszcze wkleić `.gs`”.
- Pomysły poza tym zakresem: `docs/BACKLOG.md`.

## Zasady

- Kamień z tej tabeli **nie wraca na 🟡**, bo agent nie dostał checklisty
  z 2026-09. Nowa duża rzecz = nowy kamień albo wpis w BACKLOG, decyzją
  właściciela.
- `npm test` zielone, dokumentacja żywa, wpis w `PROJECT_HISTORY.md`.
- Zmiana kolejności / nowy kamień = decyzja właściciela albo ADR.
