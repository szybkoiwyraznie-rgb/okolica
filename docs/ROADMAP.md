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
| M0 — Fundament | ✅ zamknięty 2026-09-05 | repo, ADR 0001–0013, PROTOKOL PYT v1.0, szkielet 5 ekranów, 82 testy |
| M1 — Geodezja i model rozgrywki | ✅ zamknięty 2026-09-05 | geo/pozycja/rozgrywka/kodowanie czyste + testy, 177 w bramie |
| M2 — Mapa | ✅ zamknięty 2026-09-05 | renderer SVG + 3 podkłady, potwierdzenie wizualne właściciela |
| M3 — Konfiguracja i geolokalizacja | 🟡 kod gotowy, czeka kryterium | ekran prywatności + symulacja w UI; CZYTAJ: §M3 (360 px) |
| M4 — Stacje z sieci drogowej | 🟡 kod gotowy, czeka kryterium | pipeline Overpass + UI, 3/3 fixture'y ≤ 15%; CZYTAJ: §M4 (teren) |
| M5 — Pętla pytań | 🟡 kod gotowy, czeka kryterium | edycja, podgląd, eksport/import, Nominatim opt-in; CZYTAJ: §M5 (model) |
| M6 — Rozgrywka | 🟡 kod gotowy, czeka kryterium | ekran gry, trwalosc.js, wznowienie; CZYTAJ: §M6 (telefon) |
| M7 — Podsumowanie i udostępnianie | 🟡 kod gotowy, czeka kryterium | ranking, eksporty, historia; CZYTAJ: §M7 (słońce/eksporty) |
| M8 — Publikacja i brama jakości | 🟡 kod gotowy, czeka właściciela | manifest, ikony, CI, ASSETS §6; publikację włącza właściciel (WORKFLOW §5) |
| M9 — Repozytorium paczek | ✅ zamknięty 2026-09-06 (rewizja M9b) | kopia lokalna + most Drive; most wdrożony 2026-09-07, adres w kodzie |
| M10 — Dopracowanie terenowe | 🟡 kod gotowy, czeka kryterium | sw.js, PROFILE_GPS, sygnały, WCAG AA 0 naruszeń; CZYTAJ: §M10 (§4.3) |
| M11 — Gra wieloosobowa (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | most `.gs` + wieloosobowa.js/sync.js + UI, brama 489/489; CZYTAJ: §M11 |
| M12 — Rankingi (Drive) | 🟡 kod zamknięty, czeka wdrożenie+test | pseudonim + ekran 🏆, agregacje na telefonie; CZYTAJ: §M12 |

## Kamienie zamknięte (M0, M1, M2, M9)

Szczegóły wykonania (etapy, commity, liczby testów): `docs/PROJECT_HISTORY.md`
§ „sesja M0/M1/M2" i § „M9" oraz plany w `docs/plans/`. Rewizja M9b (most
Drive zamiast `data/paczki/`): PROJECT_HISTORY § „decyzja właściciela:
współdzielone repozytorium paczek na Google Drive" + ADR 0016/0017/0018.

## M3 — Ekran konfiguracji i geolokalizacja na żywo

Kod gotowy (2026-09-05, brama 249/249): setup z walidacją K01–K20, zapis
`okolica:konfig`, `watchPosition` z badge'em, tryb `?tryb=test`, ekran
prywatności, symulacja trasy w UI. **Czeka kryterium właściciela**
(WORKFLOW §4.2): pełna konfiguracja bez przewijania na 360 px — jeśli
przewijanie nieuniknione, właściciel wybiera: świadome odstępstwo albo
rzadkie pola w `<details>`.

## M4 — Stacje z sieci drogowej (największe ryzyko)

Kod gotowy (2026-09-05, brama 313/313): pipeline Overpass, UI z cache
i łańcuchem instancji, degradacja do pierścienia, ręczne pinezki.
**Czeka kryterium terenowe** (WORKFLOW §4.2): co najmniej jedna prawdziwa
okolica na telefonie; przy okazji gesty drag/pinch z M2.

## M5 — Pętla pytań (prompt → model → walidacja → paczka)

Kod gotowy (2026-09-06, brama 332/332, `?v=m5-1`): atomowa edycja z
`modyfikacje[]`, podgląd organizatora, eksport/import kontenera, instrukcja
SVG, Nominatim opt-in. **Czeka kryterium właściciela**: pełna pętla
z prawdziwym modelem AI (prompt → odpowiedź → walidacja → ukrycie →
eksport/import).

## M6 — Rozgrywka

Kod gotowy (2026-09-06, brama 358/358, `?v=m6-1`): ekran gry (4 panele faz),
lej fixów, dojście GPS/ręczne z karą, pauza, pominięcie, `app/trwalosc.js`
z banerem wznowienia i rebazą zegara. **Czeka kryterium terenowe**
(WORKFLOW §4.2): pełna gra NA TELEFONIE od setupu do wyniku, z utratą
zasięgu w trakcie i z zamknięciem przeglądarki (wznowienie).

## M7 — Podsumowanie, punkty i udostępnianie

Kod gotowy (2026-09-06, brama 383/383, `?v=m7-1`): karta zwycięzcy, ranking,
karty graczy, tabela stacji, medal sprawiedliwości (widokowy), eksporty
tekst/obraz (Web Share → schowek → plik), historia `okolica:historia`.
**Czekają kryteria** (WORKFLOW §4): czytelność w słońcu na 360 px; eksporty
na Chrome Android i Safari iOS.

## M8 — Publikacja i brama jakości

Kod gotowy (2026-09-06, brama 400/400): `.nojekyll`, manifest + ikony,
instrukcja Pages (WORKFLOW §5), CI z lustrem, ASSETS §6. **Czeka krok
właściciela**: włączenie publikacji (jednorazowo, poza zasięgiem agenta —
403) — to ostatni krok kryterium (`https://<user>.github.io/okolica/`).

## M10 — Dopracowanie terenowe

Kod gotowy (2026-09-06, brama 450/450): `sw.js` (skorupa + kafelki),
PROFILE_GPS z histerezą, sygnały (`sygnaly.js`), audyt WCAG AA jako brama
(0 naruszeń), checklista WORKFLOW §4.3. **Czeka kryterium terenowe**
właściciela wg §4.3 (offline, bateria, sygnały, progi) — wynik do LESSONS.

## M11 — Gra wieloosobowa na wielu urządzeniach przez Drive (decyzje właściciela: ADR 0019)

Kod zamknięty (2026-09-06, P1–P7, brama 489/489): sekcja gier w moście `.gs`,
`app/wieloosobowa.js` + `app/sync.js`, pełne UI (rodzaj gry, zakładanie,
kod/lobby, panel wyścigu/tur, rezygnacja, powrót po odświeżeniu).
**Czeka**: scalenie adresu mostu do `main` (Pages) i test dwóch telefonów
w terenie (WORKFLOW §4.4).

## M12 — Profil, statystyki i rankingi gracza na Drive (decyzje właściciela: ADR 0019)

Kod zamknięty (2026-09-06, P6): pseudonim, wyniki z mostu, ekran 🏆
(ogólny + WIEK/TEMATY/LOKALIZACJA + „Moje gry"; agregacje liczy telefon).
**Czeka**: scalenie adresu mostu do `main` i test terenowy (WORKFLOW §4.4 pkt 7).

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
