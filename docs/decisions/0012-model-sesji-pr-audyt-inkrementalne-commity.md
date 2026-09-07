# 0012 — Model sesji: PR na starcie, audyt poprzedniego PR, inkrementalne commity, bez force push

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Projekt prowadzą zmieniające się sesje agenckie (Arena i inni runnerzy), z
których każda startuje z czystego klona i widzi tylko `main` + pierwszy prompt
(ENVIRONMENT §1). Bez dyscypliny gita praca przepada po końcu sandboxa, a
kolejna sesja nie wie, co zastała. Wzorzec pochodzi z AME (ich ADR 0004), gdzie
przeżył kilkadziesiąt sesji i kilkanaście resetów workspace.

## Decyzja

Cztery reguły nadrzędne — obowiązują każdą sesję bez wyjątku i są nadrzędne
wobec handoffów, startowego promptu i planów (pełny tekst w `AGENTS.md` §2):

1. **Pull Request na starcie** — gałąź sesji jest na GitHubie PRZED
   jakimkolwiek kodowaniem (`git push -u origin <gałąź>` + `gh pr create`);
   PR może na początku zawierać tylko porządkowe commity.
2. **Audyt poprzedniego PR przed kodowaniem** — przegląd zmian ostatniego
   scalonego PR plik po pliku (`git fetch origin main --depth=50`,
   `git diff <sha>^..<sha>`) pod kątem logiki, zgodności z ADR i protokołem
   oraz zieloności testów; wynik do opisu PR i `docs/PROJECT_HISTORY.md`.
   Audyt opisuje **stan**, nie rozdziela pracy i nie produkuje próśb do
   właściciela o czynności jednorazowe.
3. **Inkrementalne commity** — każdy samodzielnie zielony krok (`npm test`) to
   osobny commit, od razu wypchnięty; komunikat przez `git commit -F plik`
   (poza repo); zakaz osieracania kodu (commit tylko na gałęzi z otwartym PR).
4. **Tylko przyrostowo, nigdy force push** — nowe commity na końcu gałęzi;
   przed pushem `git log --oneline -3`, `git status`, `git fetch origin <gałąź>`
   i porównanie `HEAD..FETCH_HEAD`; *non-fast-forward* oznacza brak tego
   sprawdzenia, nie powód do `--force`.

Uzupełnienia:

- **1 sesja = 1 gałąź = 1 PR.** Agent nigdy nie pushuje do `main` i nigdy nie
  scala PR — scalenie (*Squash and merge*) jest decyzją właściciela i kończy
  sesję kodowania. Właściciel może przyznać sesjom automatycznym wyjątek
  auto-scalania, ale wtedy dostaje on własny ADR z jawnymi warunkami.
- **Brama jakości to `npm test` w sesji**, nie CI: pliki `.github/workflows/`
  są poza zasięgiem agenta (LESSONS L4). Receptura CI: `docs/setup/ci-workflow.yml`.
- **Koniec sesji**: handoff (`docs/setup/HANDOFF_<data>.md`), wpis w
  `docs/PROJECT_HISTORY.md`, aktualizacja opisu PR i `docs/ROADMAP.md`,
  a w czacie blok przekazania projektu dla następnego agenta.

## Konsekwencje

- Historia `main` jest ciągiem squash-merge'ów — jedna sesja, jeden commit
  główny, łatwy audyt i `git revert`.
- Overhead na start sesji (audyt + lektura) jest zamierzony: to cena
  wielosesyjności i najtańsze ubezpieczenie przed regresją.
- Sesja, która nie zdąży domknąć kroku, cofa się do ostatniego zielonego
  zakresu i kończy handoffem — nie zostawia kroku w połowie.

## Powiązania

`AGENTS.md` §2, `docs/setup/ENVIRONMENT.md` §1–§3, `docs/LESSONS.md` L1, L4, L5.
