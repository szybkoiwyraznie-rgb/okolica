# 0018 — Drive jako backend wielozadaniowy; wdrożenie odroczone, instrukcja w czacie

- Status: Zaakceptowana
- Data: 2026-09-06

## Kontekst

Właściciel zakomunikował (2026-09-06, po M9b/D3): nie wkleił jeszcze nic do
Apps Script na wydzielonym koncie Google Drive, bo konto ma służyć do
RÓŻNYCH rzeczy — nie tylko do repozytorium paczek pytań (ADR 0016, M9b),
ale też do:

1. gry wieloosobowej **bez hot-seat**, na kilku urządzeniach — parowanie
   graczy i gier przez Drive;
2. danych o użytkownikach, ich statystyk i wyników (score) — zapis i odczyt
   przez Drive.

Dodatkowo właściciel zastrzegł sposób przekazania instrukcji wdrożenia:
dopiero gdy CAŁOŚĆ kodu korzystającego z mostu będzie gotowa, instrukcja ma
zostać wyświetlona **w czacie** (treść + okna txt do przeklejenia), a nie jako
plik w repozytorium do szukania.

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

## Aneks (2026-09-07): ostatni krok instrukcji się zmienia (ADR 0020)

Pkt 3 pozostaje w mocy (wdrożenie przez właściciela, instrukcja w czacie),
ale jej ostatni krok NIE polega już na wklejeniu adresu w aplikacji. Od ADR
0020 adres web app jest stałą w kodzie: właściciel po wdrożeniu podaje adres
w czacie, agent wpisuje go do `DOMYSLNY_URL_MOSTU` w `app/most.js` (jeden
commit razem z podbiciem cache-bustingu), a aplikacja działa bez konfiguracji
na każdym urządzeniu — także na telefonach znajomych, co jest warunkiem gry
wieloosobowej z pkt 2. Pola wpisywania adresu zniknęły z interfejsu; zostały
jawny stan mostu i przycisk „🔌 Sprawdź połączenie". Pliki `docs/setup/`
nadal są wersjami roboczymi i źródłem prawdy dla testów/kontraktów, z tym że
`most-drive-instrukcja.md` §4 opisuje przekazanie adresu w czacie zamiast
wklejania w UI.
