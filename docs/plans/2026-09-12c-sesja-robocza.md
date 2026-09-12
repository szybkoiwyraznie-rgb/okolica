# Plan sesji 2026-09-12c — kontynuacja: PR, audyt PR #13, domknięcie zaległości docs (AGENTS §2)

> Zlecenie właściciela: **„Kontynuujemy projekt."** To sesja robocza bez
> dodatkowego zlecenia merytorycznego, więc zgodnie z `AGENTS.md` §2 sesja:
> (1) tworzy PR zanim dotknie kodu, (2) audytuje poprzedni scalony PR,
> (3) bierze najwyższą otwartą zaległość, jaką zastaje — a tą zaległością jest
> **klaster dokumentacyjny z audytu PR #9 (uwagi 2–6)** opisany w handoffie
> 2026-09-12 jako „braki dokumentacyjne". Kamienie z `docs/ROADMAP.md` są
> wszystkie w stanie „kod gotowy, czeka kryterium/właściciela", więc agent
> nie ma tam czego kodować (ROADMAP §Zasady, ENVIRONMENT §7).

## S1 — Blok startowy

- `git rev-parse --abbrev-ref HEAD` = `arena/01a095b5-okolica`, drzewo czyste,
  HEAD `963a86d` = `origin/main` (po merge PR #13).
- Lektura obowiązkowa §0: `AGENTS.md`, `docs/PROTOKOL.md`, rejestr + 37 ADR-ów,
  `docs/LESSONS.md` (L1–L47), `docs/setup/ENVIRONMENT.md`, `docs/ROADMAP.md`,
  najnowszy handoff (`HANDOFF_2026-09-12.md`). Budżet: `npm run budzet`.
- Bramy na starcie: `npm test` **692 pass / 0 fail** (67 s), `npm run check`
  i `npm run audyt` — do potwierdzenia w S2.

## S2 — PR przed kodowaniem (ADR 0012 reguła 1)

Push gałęzi sesji i `gh pr create` — na początku jako PR planowy.

## S3 — Audyt poprzedniego scalonego PR (#13, squash `963a86d`)

Plik po pliku: `git diff 963a86d^..963a86d` (49 plików, +1962/−1333), pod kątem
logiki, zgodności z ADR/PROTOKOŁEM i zieloności bram. Wynik do opisu PR
i `docs/PROJECT_HISTORY.md`.

## S4 — Zaległości audytu PR #9, które PR #13 zostawił otwarte

| # | Zaległość | Stan na `963a86d` |
|---|---|---|
| 2 | `test/duza-paczka.test.js` — nagłówek opisuje „stałe szacunku" usunięte w m12-66 | otwarte |
| 3a | `README.md` M4 — „◎ Tryb uproszczony", „miara sprawiedliwości" | otwarte |
| 3b | `README.md` — wysyłka „do przeglądu właściciela" (moderacja zniesiona m12-72) | otwarte |
| 3c | `README.md` — przycisk „🔌 Sprawdź połączenie" (usunięty m12-66) | otwarte |
| 4 | `docs/WORKFLOW.md` — krok 3 „◎ Tryb uproszczony", krok 5 „do przeglądu" | otwarte |
| 5 | `docs/ARCHITECTURE.md` — „przyciski degradacji (`przycisk-pierścien`…)" | otwarte |
| 6 | ADR 0020 pkt 2 „🔌 zostaje" bez aneksu; wzmianki ADR 0016/0018 | otwarte |
| 1 | ranking „Moje gry" filtrujący po niezapisywanym kluczu | ✅ zamknięte przez m12-77 (rankingi usunięte) |
| 7 | ADR 0037 ↔ martwe `zmienPodklad` | ✅ funkcji nie ma w `app/` (salvage m12-75) |
| 8 | flaga `wymusPierscien` bez UI | ✅ usunięta w m12-81 |
| 6b | ADR 0031 aneks o `#prompt-rozmiar` | ✅ jest (aneks 2026-09-11) |
| 9 | literówka „życią" w ADR 0017 | ✅ poprawiona |

Zasada: to sprzątanie wg wzorca **L31** („funkcja znika z ekranu ⇒ grep po
README, WORKFLOW, ARCHITECTURE, ADR-ach w tym samym commicie"), więc każda
poprawka idzie z dowodem w kodzie (`grep`/kontrakt), nie z pamięci.

## S5 — Praca merytoryczna, jeśli zostanie czas

Kolejność: naprawy realnych usterek znalezionych w S3 (audyt PR #13), potem
`docs/BACKLOG.md` **tylko jeśli właściciel wskaże temat** — wpis w backlogu nie
upoważnia do wzięcia tematu (AGENTS §4, BACKLOG §nagłówek).

## Ryzyka i zasady tej sesji

- Sesja nie scala PR, nie pushuje do `main`, nie robi `--force` (ADR 0012).
- Każdy samodzielnie zielony krok = osobny commit od razu wypchnięty;
  komunikat przez `git commit -F` (ENVIRONMENT §3).
- Praca istnieje dopiero po `git push` (ENVIRONMENT §1).
- Zmiana `app/*.js` lub `app/styles.css` ⇒ podbicie `?v=` WSZĘDZIE naraz
  razem z `WERSJA_SW` (LESSONS L29). Zmiany wyłącznie w `docs/`, `test/`
  i `README.md` **nie wymagają** bumpa wersji — i sesja tego nie robi po to,
  żeby bump wyglądał na pracę.
