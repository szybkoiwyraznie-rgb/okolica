# 0018 — Drive jako backend wielozadaniowy; wdrożenie odroczone, instrukcja w czacie

- Status: Zaakceptowana
- Data: 2026-09-06

## Kontekst

Właściciel (2026-09-06, po M9b/D3): wydzielone konto Drive ma służyć do
RÓŻNYCH rzeczy — repozytorium paczek (ADR 0016, M9b), gra wieloosobowa bez
hot-seat (parowanie przez Drive) oraz dane użytkowników (statystyki, wyniki).
Instrukcja wdrożenia ma przyjść dopiero gdy CAŁOŚĆ kodu będzie gotowa —
**w czacie** (treść + bloki do przeklejenia), nie jako plik do szukania.

## Decyzja

1. **Jedno wydzielone konto Drive = backend wielozadaniowy aplikacji.** Most
   Apps Script rozbudowuje się o kolejne akcje/web appy (paczki → stan gry →
   profil/statystyki), zamiast tworzyć osobne byty na każdą funkcję. Kontrakty
   pozostają w stylu wypracowanym w M9b: jawne schematy JSON (`TO-*`, a dla
   rozgrywki przyszłe `RO-*`), komunikacja gołym `fetch` bez kluczy, adres URL
   jako zdolność (capability), `text/plain` dla POST-ów (bez preflightu CORS).
2. **Parowanie gier wielourządzeniowych oraz profil/statystyki/score gracza to
   kierunki kolejnych kamieni milowych** (M11 i M12 w `ROADMAP`). ADR 0009
   (hot-seat) dostanie rewizję przy projekcie M11; każda nowa kategoria danych
   wychodzących z urządzenia = jawna zgoda i status (ADR 0013, LESSONS L6).
3. **Wdrożenie mostu przez właściciela jest ODROCZONE** do momentu zakończenia
   kodu, który z niego korzysta. Finalna instrukcja wdrożenia zostanie podana
   w czacie (kroki + gotowe bloki do wklejenia). Pliki `docs/setup/`
   (`apps-script-repo-paczek.gs`, `most-drive-instrukcja.md`) pozostają jako
   wersje robocze i źródło prawdy dla testów/kontraktów.

## Konsekwencje

- Kod mostu projektujemy od razu z myślą o wielu zastosowaniach (katalogi,
  nazewnictwo akcji, miejsce na kolejne schematy) — bez przepisywania w M11.
- Testy nadal działają bez żywego Drive (atrapy `fetch`) — brak wdrożenia nie
  blokuje CI ani bramy; żywa próba CORS wydarzy się przez przycisk
  „🔌 Sprawdź połączenie" (M9b/D4) dopiero po wdrożeniu właściciela.
- Właściciel nie jest pod presją terminu: najpierw dostaje kompletny kod,
  potem jedną spójną instrukcję w czacie.
- Ryzyko: rozrost jednego skryptu Apps Script (limity wykonania, czytelność) —
  mitygacja: akcje jako cienkie dyspozytory + czyste funkcje, tak jak w
  `apps-script-repo-paczek.gs`.

## Powiązania

ADR 0016 (backend Drive — niniejszy ADR rozszerza go o wielozadaniowość),
ADR 0009 (hot-seat — rewizja przy M11), ADR 0013 (prywatność — zgody przy
nowych danych), ADR 0017 (zestawy), plan `2026-09-06-m9b-most-drive.md`,
BACKLOG B17, ROADMAP M11/M12.

## Aneksy 2026-09-07 (ADR 0020) i 2026-09-12 (m12-66) są w archiwum (poza budżetem lektury)

Instrukcja wdrożenia idzie czatem, a adres mostu jest stałą w kodzie (ADR 0020)
— pól wpisywania adresu nie ma; przycisk „🔌 Sprawdź połączenie” usunięty
2026-09-12 (stan mostu jest jawnym tekstem).
`docs/decisions/archive/aneksy-0018-2026-09-07-do-12.md` (L62/L66, archiwizacja 2026-09-18).
## Aneks (2026-09-12): przycisk „🔌 Sprawdź połączenie" usunięty (m12-66)

Dwie wzmianki — w Konsekwencjach („żywa próba CORS wydarzy się przez przycisk")
i w aneksie 2026-09-07 („zostały jawny stan mostu i przycisk") — opisują stan
do m12-66. Przycisk zniknął z ekranu pozycji (uwagi terenowe #2 właściciela:
ręczne sprawdzanie było ozdobnikiem), zostaje sam jawny stan mostu
(`#most-stan-repo`); drugi badge, `#multi-most-stan`, usunął aneks 2026-09-11
do ADR 0020. Decyzja o wielozadaniowym backendzie obowiązuje bez zmian,
a kontrakt `test/kontrakt.test.js` asertuje brak `#przycisk-test-polaczenia`.
