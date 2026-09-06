# Plan M8: publikacja i brama jakości

- Data: 2026-09-06
- Kamień: M8 (ROADMAP) — `.nojekyll`, `assets/manifest.json` + ikony,
  instrukcja włączenia Pages (`WORKFLOW` §5), testy kontraktowe wersji
  i ścieżek względnych, audyt polityk dostawców (`ASSETS`).
- Gałąź: `arena/01a07282-okolica`
- Status: w realizacji
- Uwaga: CI (`.github/workflows/ci.yml`) zostało PRZYSPIESZONE z M8 na prośbę
  właściciela (2026-09-06, commity `d7b5aed`/`1674806`) — w tym kamieniu
  zostaje tylko audyt, że receptura i lustro są w syncu (kontrakt już pilnuje).

## Kontekst i stan zastany

- Kod aplikacji jest na gałęzi PR #2, `main` zawiera tylko `README.md`
  (po `3ca4c3d`). Kryterium M8 („aplikacja działa pod
  `https://<user>.github.io/okolica/` na telefonie") da się potwierdzić
  DOPIERO po scaleniu PR i włączeniu Pages — to czynność właściciela albo
  (próba) `gh api` po scaleniu. Agent przygotowuje wszystko, co musi leżeć
  w drzewie.
- `index.html` MA już: `theme-color #f6f2e9`, favicon jako inline SVG
  (data-URI) z motywem kompasu — zielone koło `#2f6f4f`, igła `#f6f2e9`
  `(22,10)→(13,14)→(10,23)→(19,19)`, pivot `r=1.8`. Ten motyw zostaje
  ikoną aplikacji (spójność favicon ↔ ikona na pulpicie).
- ADR 0011 pkt 6 (zero zewnętrznych zasobów UI) i pkt 9 (PWA-lite:
  manifest + ikony w zakresie; Service Worker poza — BACKLOG/ADR 0010 pkt 4).
- ADR 0002 (Pages z `main`, katalog główny, ścieżki względne) ma status
  *Proponowana* z adnotacją „do potwierdzenia: układ katalogów i los
  `AME-main.zip`" — obie kwestie rozstrzygnięte (układ zbudowany, zip
  usunięty decyzją właściciela 2026-09-05), a zadanie pierwotne właściciela
  wprost mówiło „hosting na GitHub Pages (primary)".
- `WORKFLOW` §5 istnieje, ale ma literówkę w adresie
  (`szywkoiwyraznie-rgb` zamiast `szybkoiwyraznie-rgb`) i nieaktualną
  notę o CI („agent nie zapisze tego pliku" — zapisał, L4 aneks).

## Decyzje

1. **Ikony generowane narzędziem w repo, nie pliki z zewnątrz** (ADR 0001,
   0011 pkt 6): `tools/generuj-ikony.mjs` (czysty Node: `node:zlib`, bez
   zależności) rysuje motyw kompasu z favicon i zapisuje PNG
   (enkoder IHDR/IDAT/IEND z CRC32, supersampling ×4 → box downscale,
   deterministyczny — te same bajty przy każdym uruchomieniu). Guard
   `czyUruchomiony` (wzorzec z `generuj-fixture-overpass.mjs`) + eksport
   funkcji do testów. Pliki binarne MUSZĄ być w git (Pages serwuje
   z repozytorium); rozmiar ~5–20 KB/szt.
2. **Zestaw ikon** w `assets/ikony/`:
   - `ikona.svg` — motyw kompasu, viewBox 32 (manifest, `sizes: any`);
   - `ikona-192.png`, `ikona-512.png` — manifest Chrome/Android;
   - `ikona-maskable-512.png` — motyw przeskalowany ×0,8 względem środka
     (safe zone 80% maskable), tło pełne `#f6f2e9`;
   - `ikona-180.png` — `apple-touch-icon` (iOS nie czyta ikon z manifestu).
3. **`assets/manifest.json`**: `name`/`short_name` („Tajemnicza Okolica" /
   „Okolica"), `lang: pl`, `start_url: "./"`, `scope: "./"` (WZGLĘDNE —
   ADR 0002: Pages serwuje z podkatalogu `/okolica/`, root-absolute by
   się wysypało), `display: standalone`, `background_color`/`theme_color`
   `#f6f2e9` (token `--tlo` motywu jasnego — spójny z `<meta theme-color>`).
4. **`index.html`**: `<link rel="manifest" href="assets/manifest.json">`
   + `<link rel="apple-touch-icon" href="assets/ikony/ikona-180.png">`
   (ścieżki względne). Cache-busting modułów bez zmian (manifest/ikony nie
   są importami ES).
5. **`.nojekyll`** pusty w korzeniu — Pages bez przetwarzania Jekyll
   (pliki z `_` w nazwie i brak front-matter; standard dla aplikacji
   statycznych).
6. **Kontrakty M8** (rozszerzenie `test/kontrakt.test.js`):
   - manifest: poprawny JSON, `start_url`/`scope` względne, `icons[].src`
     względne i PLIKI ISTNIEJĄ, deklarowane `sizes` PNG zgadzają się
     z IHDR (czytane z bajtów, nie z nazwy), signature PNG;
   - `.nojekyll` istnieje;
   - index.html: link manifestu i apple-touch-icon obecne i względne;
     ZAKAZ ścieżek root-absolute (`href="/…"`, `src="/…"`) — podkatalog
     Pages; `data:` dla favicon dozwolone;
   - istniejący test wersji cache-bust zostaje (wersjo-niezależny).
7. **Testy generatora** (`test/ikony.test.js`, czyste): rasteryzator
   (środek = zieleń `#2f6f4f`, narożnik = tło, igła wewnątrz), wymiary
   rastra, maskable safe-zone (piksel przy krawędzi = tło), enkoder PNG
   (signature, IHDR wymiary, determinizm bajtowy dwóch przebiegów) —
   oczekiwania LICZONE (L24).
8. **Pages enable — próba `gh api`** (`POST /repos/…/pages`, source
   `main`/root). Przy 403 (brak uprawnień admin) — bez eskalacji w środku
   sesji: `WORKFLOW` §5 (poprawiony) jest instrukcją właściciela. Sens
   dopiero po scaleniu PR; włączenie wcześniej jest nieszkodliwe (404 do
   czasu merge).
9. **Audyt polityk dostawców** = przejście checklisty `ASSETS` §5 dla
   wszystkiego, co w kodzie: szablony URL kafelków (`PODKLADY`) vs §1.0,
   instancje Overpass vs §2, endpoint Nominatim i opt-in vs §3, atrybucje
   w UI vs dokument. Wynik: zapis w `ASSETS` (data + zgodności/rozjazdy).
   Bez nowych dostawców — checklista „dodanie dostawcy" nie jest
   uruchamiana.
10. **ADR 0002 → Zaakceptowana**: adnotacja z podstawą (zadanie pierwotne
    „GitHub Pages (primary)", decyzja o usunięciu zipa 2026-09-05, układ
    katalogów zbudowany i potwierdzony pracą M0–M7, instrukcja właściciela
    „kontynuuj zgodnie z roadmapą" 2026-09-06 → M8 = publikacja). Format
    `- Status: (\w+)` (kontrakt parsuje — bez bolda).

## Kroki

- [ ] **PB1 — plan (ten plik):** commit + push.
- [x] **PB2 — ikony i manifest:** `tools/generuj-ikony.mjs` (+ script
      `npm run ikony`), wygenerowane `assets/ikony/*` + `ikona.svg`,
      `assets/manifest.json`, `.nojekyll`, linki w `index.html`,
      `test/ikony.test.js` + kontrakty z decyzji 6; brama zielona;
      commit + push.
- [x] **PB3 — Pages i WORKFLOW §5:** próba `gh api` (wynik jawny w
      handoffie/kommicie — sukces albo 403 = czynność właściciela),
      poprawa §5 (literówka adresu, nota CI live + kontrakt lustra);
      commit + push.
- [ ] **PB4 — audyt ASSETS:** checklista §5 na kod (kafelki, Overpass,
      Nominatim, atrybucje), zapis wyniku z datą; commit + push.
- [ ] **PB5 — dokumenty:** ADR 0002 Zaakceptowana (adnotacja), ROADMAP
      „kod M8 gotowy" + zostało-kryterium-właściciela, ARCHITECTURE
      (drzewo: `assets/`, `tools/generuj-ikony.mjs`), README (akapit
      Pages), PROJECT_HISTORY (sekcja M8), odhaczenie planu; brama;
      commit + push.
- [ ] **PB6 — PR #2:** body M0–M8 (sekcja M8, wiersze commitów, tabela
      stanów: M8 🟡 kod gotowy/kryterium po merge+Pages, brama w intro);
      push.

## Ryzyka

- **403 na `gh api /pages`** (uprawnienia admin) — fallback: §5 dla
  właściciela; nie blokuje niczego w drzewie.
- **PNG w git** — binarne artefakty w repo: konieczne (Pages serwuje
  z drzewa), małe, generowalne zawsze z `tools/` (reprodukowalność zamiast
  „binary blob nieznanego pochodzenia").
- **iOS a manifest** — Safari ignoruje większość pól manifestu;
  `apple-touch-icon` PNG + `theme-color` meta pokrywają podstawę; reszta
  (fullscreen) poza zakresem PWA-lite.
- **Motyw kompasu w małych rozmiarach** — igła i pivot czytelne od 192 px;
  dla 180 (apple-touch) ten sam rysunek ×5,6 — bez ręcznych uproszczeń
  (spójność ponad mikrodostosowanie; jeśli właściciel w terenie uzna ikonę
  za nieczytelną, wracamy do rysunku).
- **Determinizm generatora** — ten sam Node i `zlib` daje te same bajty;
  test determinizmu porównuje dwa przebiegi w jednym procesie (ryzyko
  różnicy między wersjami Node jest akceptowalne — pliki w git są źródłem
  prawdy dla Pages).

## Kryterium akceptacji (właściciel)

Aplikacja działa pod `https://szybkoiwyraznie-rgb.github.io/okolica/` na
telefonie: ekrany się ładują (ścieżki względne), ikona trafia na pulpit
(„dodaj do ekranu głównego" na Chrome Android; na iOS ikona z
`apple-touch-icon`), brak żądań 404 w DevTools sieci. Weryfikacja po
scaleniu PR #2 i włączeniu Pages (§5).
