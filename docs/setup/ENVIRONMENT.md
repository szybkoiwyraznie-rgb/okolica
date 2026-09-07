# Środowisko sesji agentskiej — ograniczenia i pułapki (dokument trwały)

> **To NIE jest handoff.** Handoff opisuje jedną sesję i traci aktualność; ten
> plik zbiera **stałe właściwości środowiska**, które dotyczą każdej sesji.
> Odziedziczony z projektu AME właściciela i zweryfikowany w sandboxie Areny
> 2026-09-05 (repo `szywkoiwyraznie-rgb/okolica`, node 22, npm 10, python 3.11).

Powiązania: [ADR 0012](../decisions/0012-model-sesji-pr-audyt-inkrementalne-commity.md)
(model sesji), [docs/LESSONS.md](../LESSONS.md).

## 1. Izolacja sesji — co NAPRAWDĘ przetrwa do następnej sesji

Nowa sesja startuje z czystego klona i ma dostęp wyłącznie do:

1. **gałęzi `main` na GitHubie** (stan po scaleniu PR poprzedniej sesji),
2. **tekstu pierwszego promptu**.

**Nie przetrwa NIC innego** — pliki lokalne, `/tmp`, historia czatu, zmienne
środowiskowe, zależności, niewypchnięte commity, serwery. Konsekwencje:
**praca istnieje dopiero po `git push`** (commituj i pushuj po każdym zielonym
kroku); wszystko trwałe zapisuj w repozytorium — blok przekazania w czacie jest
kopią, nie nośnikiem.

## 2. Sandbox potrafi zresetować workspace w trakcie sesji

**Objaw:** lokalny `HEAD` nagle wskazuje `main`, commity sesji „znikają",
`git push` odrzuca (*non-fast-forward*). W `git reflog` widać świeży wpis
`clone: from …`.

**To nie jest utrata pracy — o ile commity były wypchnięte.** Procedura
odzyskania:

```bash
git reflog -10                                  # potwierdź reset
git ls-remote --heads origin                    # praca jest na zdalnej gałęzi?
git fetch origin <gałąź-sesji>
git reset --hard FETCH_HEAD                     # odtwórz historię sesji lokalnie
git push -u origin <gałąź-sesji>                # pierwszy push po odzyskaniu z -u
```

**Gdy zginęły commity NIEwypchnięte** (drzewo robocze ma stan końcowy, obiekty
zniknęły z `.git`): ZANIM wykonasz `reset --hard`, skopiuj repo
`cp -a <repo> /tmp/kopia-drzewa`, zresetuj do `FETCH_HEAD`, skopiuj zawartość
z powrotem (pomiń `.git`); `git status` pokaże różnicę utraconych kroków —
uruchom bramę i odtwórz commity (opisując odtworzenie w komunikacie).
`--force` zakazane: zdalna gałąź jest źródłem prawdy.

Jeśli po resecie zdarzyło Ci się zacommitować na `main`, przenieś commit:
`git branch backup-<opis> <sha>` → `git reset --hard FETCH_HEAD` →
`git cherry-pick <sha>`.

**Profilaktyka:** po commicie `git log --oneline -1` + `git status`; push od razu.

## 3. Git i GitHub

- **`gh` i `git push` działają z tokenem `arena-ai-coding-agent[bot]`.**
  Token potrafi wygasnąć w trakcie sesji (objaw: push prosi o hasło).
  Commity lokalne są bezpieczne — poproś właściciela o reconnect GitHub
  w Arenie i ponów push. **Nigdy nie proś o token w czacie.**
- **CI: najpierw spróbuj pusha `.github/workflows/`** (403 `workflows` bywa
  przywiązany do instancji tokena — LESSONS L4); dopiero przy 403 fallback na
  lustro `docs/setup/ci-workflow.yml`. Stan bramy opisuj w handoffie, nie zlecaj.
- **Komunikaty commitów pisz do pliku poza repozytorium** (np. `/home/user/msg.txt`)
  i commituj przez `git commit -F`. Backticki i `$(...)` w `git commit -m "…"`
  wykonują podstawienie komend bash i zjadają słowa z komunikatu.
- Pracuj wyłącznie na gałęzi sesji; nigdy nie pushuj do `main`; nigdy
  `--force` (ADR 0012).
- **`gh pr edit` bywa odrzucane** błędem GraphQL; obejście:
  `gh api -X PATCH repos/<owner>/<repo>/pulls/<nr> -f title=… -F body=@plik`.
- **Klon sesji bywa płytki (depth=1) i single-branch.** Audyt poprzedniego
  scalonego PR wymaga rodzica: `git fetch origin main --depth=50`, potem
  `git diff <sha>^..<sha>`.
- **`git checkout <plik>` cofa niezacommitowane zmiany w tym pliku** —
  zacommituj pracę przed takimi operacjami.
- Referencyjne archiwum AME właściciela NIE leży w repo (usunięte decyzją
  z 2026-09-05, ADR 0002 pkt 6); kontrakt pilnuje, żeby nie wróciło.

## 4. Sieć i narzędzia

- **Egress HTTPS zablokowany** (LESSONS L3): Overpass, kafelki i Nominatim są
  NIEDOSTĘPNE z sandboxa (działają w przeglądarce użytkownika); logikę stacji
  testujemy na fixture'ach w `test/fixtures/`. Dane z sieci pozyskuj
  `fetch_page`/`web_search`, nie `curl`/`fetch`.
- **`write_file` działa tylko w workspace.** Skrypty pomocnicze poza repo
  twórz przez `bash` + heredok.
- **Polskie znaki:** jak LESSONS L2 (`write_file` dla nowych, `python3`+`pathlib`
  dla istniejących, `git diff` po edycji).
- Testy logiki: `node --test` (moduły czyste testują się tym samym kodem — LESSONS L6).
- Do uruchomienia aplikacji użyj serwera statycznego na `0.0.0.0`
  (`npm run serwer` = `python3 -m http.server 8000 --bind 0.0.0.0`).

### 4.1 Przeglądarka do weryfikacji wizualnej (headless Chromium z npm)

Egress zablokowany (LESSONS L3), więc Chrome instalujesz **z paczki npm**
(`@sparticuz/chromium` niesie Chromium i biblioteki w tarballi):

```bash
mkdir -p /home/user/.narzedzia && cd /home/user/.narzedzia   # poza repozytorium!
npm i puppeteer @sparticuz/chromium pngjs
node -e "const fs=require('fs'),z=require('zlib');\
  fs.writeFileSync('chromium', z.brotliDecompressSync(\
    fs.readFileSync('node_modules/@sparticuz/chromium/bin/chromium.br')));\
  fs.chmodSync('chromium',0o755);\
  fs.writeFileSync('al2023.tar', z.brotliDecompressSync(\
    fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));"
mkdir -p libs && tar -xf al2023.tar -C libs          # biblioteki idą do libs/lib
LD_LIBRARY_PATH=$PWD/libs/lib ./chromium --version
```

Potem `puppeteer.launch({ executablePath: process.env.CHROME_PATH, args:
['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
'--disable-dev-shm-usage', '--use-fake-ui-for-media-stream'] })`. Uwagi:

- **Nie instaluj tego w repozytorium** — `/home/user/.narzedzia` jest poza
  drzewem, więc `package.json` zostaje bez zależności (ADR 0001).
- `node_modules` i `.cache` nie wchodzą do snapshotu workspace; po resecie
  sandboxa przepis trzeba powtórzyć (kilkanaście sekund).
- **Brak GPS w headless/sandboxie**: pozycję wstrzykuj przez
  `page.evaluateOnNewDocument()` albo użyj **trybu testowego aplikacji**
  (`WORKFLOW` §3).
- PNG analizuj programowo (`pngjs`); w razie potrzeby `read_file` (vision).

## 5. Live preview Areny

- Serwer startuj narzędziem `start_process`, **bind na `0.0.0.0`**; porty
  stają się widoczne jako live preview pod `https://{port}-{sandbox}.e2b.app`.
- Kod w przeglądarce **nigdy nie woła `localhost`/`127.0.0.1`** — tylko ścieżki
  względne (aplikacja jest w całości statyczna, więc to naturalne).
- Preview jest w **iframe**: geolokalizacja i schowek mogą wymagać zgody
  przeglądarki właściciela albo w ogóle nie działać (brak
  `allow="geolocation"`). Dlatego aplikacja MA tryb testowy z ręcznymi
  współrzędnymi i z zastępczym wklejaniem tekstu (drag & drop / plik) obok
  `navigator.clipboard`. Nie uznawaj braku GPS w preview za błąd aplikacji
  — sprawdź najpierw w trybie testowym.
- Preview umiera razem z sandboxem; trwałość daje tylko push.

## 6. Czas wykonania (orientacyjnie)

| Operacja | Czas | Uwagi |
|---|---|---|
| `npm run brama` | ~20 s | ~500 testów, zero zależności |
| zapytanie Overpass (w przeglądarce) | 2–20 s | zależy od promienia i obciążenia instancji |
| pełny obrót M-kamienia | 20–60 min | czytanie + kod + testy + commity |

## 7. Checklista startu sesji

1. `git log --oneline -3` + `git status` + `git rev-parse --abbrev-ref HEAD`.
2. Lektura obowiązkowa wg `AGENTS.md` §0 (całe pliki).
3. `npm test` — zieloność przed zmianami.
4. PR gałęzi sesji (ADR 0012) przed kodowaniem.
5. Audyt poprzedniego scalonego PR; wynik do opisu PR i `PROJECT_HISTORY.md`.
6. Brak zlecenia = najwyższy otwarty kamień z `ROADMAP.md`.

## 8. Checklista przed końcem sesji

1. `npm test` zielone; UI sprawdzone na żywo (360 px, palec).
2. Wszystko zacommitowane **i wypchnięte**.
3. Handoff aktualny (`HANDOFF_<data>.md` + `PROJECT_HISTORY.md` + stan CI).
4. Reguły trwałe w ADR / PROTOKOLE / AGENTS / LESSONS / ASSETS, nie w handoffie.
5. Opis PR zaktualizowany (w tym wynik audytu) + blok przekazania w czacie.
