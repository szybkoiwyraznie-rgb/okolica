# Plan sesji 2026-09-12 — start: lektura, PR, audyt PR #12, oczekiwanie na zlecenie

> Zlecenie właściciela: „Kontynuujemy projekt. Przeczytaj obowiązkową lekturę,
> otwórz nowy PR, wypchnij plan i zatrzymaj się, przekażę ci zadanie."
> Sesja wykonuje blok startowy (AGENTS.md §0 i §2 reguły 1–2, ENVIRONMENT §7)
> i ZATRZYMUJE się przed pracą merytoryczną: właściciel zapowiedział jawne
> zadanie, więc sesja nie bierze kamienia z `ROADMAP` samodzielnie.
> Reguła „nie pytaj «co robimy?»" (AGENTS.md §2) dotyczy sytuacji BEZ
> zapowiedzi zlecenia — tutaj zlecenie jest w drodze.

## S1 — Lektura obowiązkowa (§0) — WYKONANA

Wszystkie pliki przeczytane w całości (od pierwszej do ostatniej linii;
fragmenty ucięte przez narzędzie dobrano do końca):

| # | Plik | Linie |
|---|---|---|
| 1 | `AGENTS.md` | 186 |
| 2 | `docs/PROTOKOL.md` | 642 |
| 3 | `docs/decisions/README.md` + **37 ADR-ów** (0001–0037) | 3 286 (bez rejestru) |
| 4 | `docs/LESSONS.md` (L1–L45) | 618 |
| 5 | `docs/setup/ENVIRONMENT.md` | 167 |
| 6 | `docs/ROADMAP.md` | 61 |
| 7 | `docs/setup/HANDOFF_2026-09-10.md` (najnowszy handoff) | 157 |

Budżet lektury (`npm run budzet`): **71 641 tokenów z limitu 100 000** —
rezerwa 28 359, skracanie dokumentów nie jest w tej sesji zadaniem obowiązkowym.

Uwaga porządkowa: poprzednia sesja (PR #12) zamknęła się wpisem audytowym
w `docs/PROJECT_HISTORY.md` i NIE zostawiła handoffu — najnowszy handoff nosi
datę 2026-09-10, a stan z 2026-09-11 (m12-74) opisuje wyłącznie dziennik sesji.
Ten plan pełni rolę skrótu stanu do czasu handoffu bieżącej sesji.

## S2 — Bramy na mainie przed zmianami — WYKONANE

- `npm test`: **692 pass / 0 fail** (~68 s) — exit code 0.
- `npm run check`: oba szablony promptów zgodne z `docs/PROTOKOL.md`
  (§2: 4 209 znaków / 61 linii; §2.2: 4 457 znaków / 62 linii).
- `npm run audyt`: **0 naruszeń WCAG AA** (pary tekstowe obu motywów).
- Cache-busting: `?v=m12-74` w 42 miejscach (`index.html` + `app/*.js`),
  `WERSJA_SW = 'm12-74'` w `sw.js` — spójne, pilnowane kontraktem
  (`test/kontrakt.test.js:747`).

## S3 — Audyt poprzedniego scalonego PR (#12) — WYKONANY

Klon sesji był płytki, więc najpierw `git fetch origin main --depth=50`
(ENVIRONMENT §3), potem `git diff b3430c5^..b3430c5`:
**1 plik, +129 linii** — wyłącznie sekcja „Sesja 2026-09-11l — audyt PR #9"
w `docs/PROJECT_HISTORY.md`. Zero zmian w kodzie, więc ryzyko regresji zerowe.

Weryfikacja merytoryczna wpisu (nie tylko jego przeczytanie):

- Liczby bram w audycie odtworzone na bieżącym mainie: 692/692, 0 naruszeń
  kontrastu, szablony zgodne — **wszystkie trzy potwierdzone** (S2).
- Znalezisko 1 („Moje gry" filtruje po kluczu, którego nic nie zapisuje)
  — **potwierdzone grepem**: `KLUCZ_PSEUDONIMU` (`okolica:pseudonim`) jest
  czytany w `app/app.js:4746` i `:4830`, a nie zapisuje go żadna ścieżka
  w `app/` (tylko atrapa w `test/rankingi-ui.test.js:45`);
  `KLUCZ_OSTATNIEGO_GRACZA` (`okolica:ostatni-gracz`) jest zapisywany
  w `app/app.js:698` i nigdy nie czytany.
- Uwaga 7 (`zmienPodklad` obecna mimo zapisu ADR 0037) — **potwierdzone**:
  `app/app.js:1186`, bez wywołań (martwa).

Werdykt: PR #12 zgodny z procedurą (audyt jako jedyna treść), fakty w nim
podane trzymają się kodu. Usterki, które OPISUJE (1–9), są otwarte i należą
do kolejki roboczej niżej — nie do tej sesji, jeśli właściciel da inne zadanie.

## S4 — Zatrzymanie i oczekiwanie na zlecenie właściciela

Sesja nie rozpoczyna pracy merytorycznej. Stan gotowości: gałąź
`arena/01a09489-okolica` z PR do `main`, bramy zielone, drzewo czyste.

## Kolejka robocza na wypadek zlecenia „kontynuuj samodzielnie"

W kolejności malejącej wartości (pozycje 1–2 to bezpośredni ciąg dalszy
audytu PR #9, reszta wynika z `ROADMAP`/`BACKLOG`):

1. **Fix znalezionej usterki rankingu** (punkt 1 audytu): czytać
   `KLUCZ_OSTATNIEGO_GRACZA` z fallbackiem na `KLUCZ_PSEUDONIMU`,
   przeredagować komunikat pustego stanu na blok „Kto gra?" — najpierw test
   odtwarzający błąd (AGENTS.md §7), potem implementacja.
2. **Jeden commit docs-only** na klaster L31 (punkty 2–9 audytu): PROTOKOL
   §2.1 (B21), README (M4, wysyłka, 🔌), WORKFLOW kroki 3–5, ARCHITECTURE
   (przyciski degradacji), aneksy do ADR 0020/0031, ADR 0037 ↔ `zmienPodklad`,
   literówka w ADR 0017, nagłówek `test/duza-paczka.test.js`,
   `wymusPierscien` bez przełącznika.
3. Kryteria otwartych kamieni (M3–M8, M10–M12) wymagają telefonu właściciela
   i stanu wdrożenia mostu/Pages — agent NIE odhacza ich na podstawie testów
   Node (ROADMAP §Zasady, handoff 2026-09-10).

## Ryzyka i zasady tej sesji

- Sesja nie scala PR, nie pushuje do `main`, nie robi `--force` (ADR 0012).
- Każdy samodzielnie zielony krok = osobny commit, od razu wypchnięty;
  komunikat przez `git commit -F` (plik poza repo, ENVIRONMENT §3).
- Praca istnieje dopiero po `git push` (ENVIRONMENT §1).
- Granice §4 pozostają: vanilla bez zależności, zero sekretów, współrzędne
  gracza na urządzeniu, patchowanie chirurgiczne, błędy u root cause.
- Przy zmianie `app/*.js` / `app/styles.css` — podbicie `?v=` WSZĘDZIE
  naraz razem z `WERSJA_SW` (LESSONS L29).
