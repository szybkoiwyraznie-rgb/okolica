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
środowiskowe, zainstalowane zależności, niewypchnięte commity, uruchomione
serwery. Konsekwencje:

- **Praca istnieje dopiero po `git push`.** Commituj i pushuj po każdym
  samodzielnie zielonym kroku.
- Wszystko, co ma przetrwać, zapisz w repozytorium (kod, testy, ADR, lekcje,
  handoff). Blok przekazania w czacie jest kopią wiedzy z repo, nie nośnikiem.

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

**Gdy zginęły commity NIEwypchnięte** (obiekty znikają z `.git`, ale drzewo
robocze ma stan końcowy — przypadek z 2026-09-06: M4/I7–I9 czekały lokalnie na
odświeżenie tokena): ZANIM wykonasz `reset --hard`, skopiuj całe repo
`cp -a <repo> /tmp/kopia-drzewa`, potem zresetuj do `FETCH_HEAD` i skopiuj
zawartość kopii z powrotem (pomiń `.git`). `git status` względem zdalnego HEAD
powinien pokazać dokładnie różnicę utraconych kroków — uruchom bramę i odtwórz
commity (uczciwie opisując odtworzenie w komunikacie). `git push --force`
pozostaje zakazane: zdalna gałąź jest źródłem prawdy.

Jeśli po resecie zdarzyło Ci się zacommitować na `main`, przenieś commit:
`git branch backup-<opis> <sha>` → `git reset --hard FETCH_HEAD` →
`git cherry-pick <sha>`.

**Profilaktyka:** po każdym commicie `git log --oneline -1` + `git status`;
pushuj od razu; przed długimi operacjami upewnij się, że praca jest wypchnięta.

## 3. Git i GitHub

- **`gh` i `git push` działają z tokenem `arena-ai-coding-agent[bot]`.**
  Token potrafi wygasnąć w trakcie sesji (objaw: push prosi o hasło).
  Commity lokalne są bezpieczne — poproś właściciela o reconnect GitHub
  w Arenie i ponów push. **Nigdy nie proś o token w czacie.**
- **Agent nie zapisuje plików w `.github/workflows/`** — push i `gh api`
  zwracają 403 `workflows` (brak uprawnienia w tokenie GitHub App). Receptura
  CI leży w `docs/setup/ci-workflow.yml` (lustro do wklejenia przez
  właściciela). Stan bramy (`gh run list`) sprawdzamy po to, żeby go **opisać**
  w handoffie, nie żeby komuś coś zlecać.
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
- Ten repozytorium ma w korzeniu plik binarny właściciela (`AME-main.zip`,
  ~6,5 MB). Nie usuwaj go, nie nadpisuj i nie „porządkuj" bez decyzji
  właściciela; czytanie przez `unzip -p`/`unzip -l` bez rozpakowywania.

## 4. Sieć i narzędzia

- **Swobodny egress HTTPS z sandboxa jest zablokowany** (curl do losowych
  hostów → kod 000). Działa: `api.github.com`, rejestr npm. Konsekwencja dla
  tego projektu: **Overpass API, kafelki i Nominatim są NIEDOSTĘPNE z sandboxa**
  — działają za to w przeglądarce użytkownika (aplikacja jest klientem, nie
  backendem). Testy nie mogą więc wołać sieci: logikę stacji testujemy na
  fixture'ach TopoJSON/GeoJSON w `test/fixtures/`.
- Dane z sieci potrzebne agentowi (polityki dostawców, dokumentacja Overpass
  QL, przykłady) pozyskuj narzędziami agenta (`fetch_page`, `web_search`),
  a nie `curl`/`fetch` w sandboxie.
- **`write_file` działa tylko w workspace.** Skrypty pomocnicze poza repo
  twórz przez `bash` + heredok.
- **Polskie znaki:** narzędzie `edit_file` potrafi je uszkodzić (mojibake
  `Ä…` zamiast `ą`) oraz wplatać obce glify. Nowe pliki twórz `write_file`;
  istniejące pliki z polskim tekstem edytuj przez `python3` + `pathlib`
  z `encoding='utf-8'`. Po każdej edycji `git diff` pod kątem mojibake.
- Testy logiki uruchomisz bez przeglądarki: `node --test`. Node 22 ma te same
  API co przeglądarka (`TextEncoder`/`TextDecoder`, `atob`/`btoa`,
  `globalThis.crypto`), więc moduły czyste — w tym `app/kodowanie.js` (ADR 0007)
  — testują się w Node **tym samym kodem**, bez API Node (LESSONS L6).
- Do uruchomienia aplikacji użyj serwera statycznego na `0.0.0.0`
  (`npm run serwer` = `python3 -m http.server 8000 --bind 0.0.0.0`).

### 4.1 Przeglądarka do weryfikacji wizualnej (headless Chromium z npm)

Swobodny egress jest zablokowany, więc `npx puppeteer browsers install chrome`
kończy się błędem (Chrome pobiera się z hostów Google, nie z rejestru npm).
Binarkę da się zdobyć **z paczki npm** — `@sparticuz/chromium` niesie
w tarballi skompresowany Chromium i potrzebne biblioteki:

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
- **Geolokalizacji w headless Chromium nie da się odczytać z urządzenia** —
  wstrzykuj pozycję przez `page.evaluateOnNewDocument()` (nadpisanie
  `navigator.geolocation`) albo użyj **trybu testowego aplikacji** (ręczne
  współrzędne, `docs/WORKFLOW.md` §3). To samo dotyczy sandboxa Areny:
  urządzenie agenta nie ma GPS.
- Zrzutów PNG agent nie musi „oglądać" — analizuj piksele programowo (`pngjs`),
  a w razie potrzeby przeczytaj obraz narzędziem `read_file` (agent ma vision).

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
| `npm test` | < 5 s | node --test, zero zależności |
| start serwera statycznego | < 2 s | `npm run serwer` |
| zapytanie Overpass (w przeglądarce) | 2–20 s | zależy od promienia i obciążenia instancji |
| pełny obrót M-kamienia | 20–60 min | czytanie + kod + testy + commity |

## 7. Checklista startu sesji

1. `git log --oneline -3`, `git status`, `git rev-parse --abbrev-ref HEAD` —
   gdzie jestem, czy czysto, czy na gałęzi sesji.
2. Lektura obowiązkowa wg `AGENTS.md` §0 (całe pliki).
3. `npm test` — potwierdź zieloność przed zmianami (to jest TWOJA brama).
4. Otwórz PR gałęzi sesji (ADR 0012), zanim zaczniesz kodowanie.
5. Audyt poprzedniego scalonego PR przed nową pracą; wynik do opisu PR
   i `docs/PROJECT_HISTORY.md`.
6. Brak zlecenia właściciela po audycie = najwyższy otwarty kamień milowy
   z `docs/ROADMAP.md` (nie pytanie „co robimy?").

## 8. Checklista przed końcem sesji

1. `npm test` zielone; przy zmianach UI — sprawdzone na żywo (360 px, palec).
2. Wszystko zacommitowane **i wypchnięte** (`git status` czysty).
3. Najnowszy `docs/setup/HANDOFF_<data>.md` opisuje aktualny stan.
4. Reguły trwałe trafiły do ADR / PROTOKOŁU / `AGENTS.md` / `docs/LESSONS.md`
   / `docs/ASSETS.md`, a nie tylko do handoffu.
5. Opis PR zaktualizowany kumulatywnie (w tym wynik audytu).
6. W czacie wypisany blok przekazania projektu dla następnego agenta.
