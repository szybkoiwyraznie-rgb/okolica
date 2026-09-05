# PROJECT_HISTORY — dziennik sesji

> Zapis tego, co przyniosła sesja (fakty, nie plany). Jeden wpis na sesję,
> najnowszy na dole. Nie jest lekturą startową (`AGENTS.md` §0) — czytasz
> punktowo, grepem. Stan bieżący: `docs/ROADMAP.md` i najnowszy
> `docs/setup/HANDOFF_*.md`.

## 2026-09-05 — sesja M0 (fundament), gałąź `arena/01a07282-okolica`, PR #2

**Zlecenie właściciela:** nowy projekt „Tajemnicza Okolica" — terenowa gra
quizowa na mapie (geolokalizacja, stacje, pytania generowane przez model AI
i wklejane z powrotem, szyfrowanie odpowiedzi, mobilny UI), prowadzony wg
dobrych praktyk projektu AME (wzorzec: `AME-main.zip`).

**Audyt stanu zastanego:** `main` = `3ca4c3d` („Add files via upload"):
jednozdaniowy `README.md` + `AME-main.zip` (308 plików, ~20 MB po rozpakowaniu).
Kodu, testów, CI ani dokumentacji brak — start od zera, regresji do sprawdzenia
brak. Z archiwum wzorca wczytano: `AGENTS.md` (286 linii), `docs/setup/ENVIRONMENT.md`,
`docs/WORKFLOW.md`, `docs/decisions/README.md` (27 ADR-ów), `docs/LESSONS.md`
(24 lekcje), `docs/ARCHITECTURE.md`, `README.md`, `index.html`,
`.github/workflows/ci.yml`, mechanizm kafelków z `app/map.js`
(`PODKLADY_ONLINE`, `rysujPodkladOnline`).

**Co zrobiono:**

- Struktura i konfiguracja: `package.json` (zero zależności, `node --test`),
  `.gitignore` (narzędzia sesji poza repo, eksporty paczek), `README.md`.
- Zasady: `AGENTS.md` (§0 lektura startowa, §1 źródło prawdy, §2 cztery reguły
  sesji, §3 zasady treści PYT, §4 granice, §5 tabela „gdzie zapisać regułę"),
  `docs/setup/ENVIRONMENT.md` (sandbox, git, sieć, headless Chromium, live
  preview), `docs/LESSONS.md` L1–L6.
- Rejestr ADR + ADR 0001–0013 (7 zaakceptowanych, 6 proponowanych).
- `docs/PROTOKOL.md` — protokół PYT v1.0: pętla treści, dosłowny szablon
  promptu, schemat paczki, kategorie wiekowe (7/10/12/15/dorośli), kanon 10
  tematów, 20 kodów usterek walidacji (E01–E20), wersjonowanie.
- Dokumentacja projektu: `ARCHITECTURE`, `ROADMAP` (M0–M10), `BACKLOG` (B1–B15),
  `WORKFLOW`, `ASSETS`, `plans/PLAN_2026-09-05-fundament.md`,
  `setup/ci-workflow.yml`.
- Kwerenda polityk dostawców (`web_search`, 2026-09-05) — **wynik zmienił
  decyzję**: CARTO wymaga klucza API (odpada przy ADR 0001), OpenFreeMap /
  VersaTiles / Maptoolkit są wektorowe (wymagałyby MapLibre). Rewizja ADR 0003
  przed akceptacją, wpis w `ASSETS` §1.1, lekcja L8. Przyjęto: OSM Standard
  jako podkład domyślny (zgodnie z briefem), OpenTopoMap i Esri jako warstwy
  opcjonalne; Overpass (3 instancje z przełączaniem) jako źródło sieci drogowej
  **i** nazwy miejsca — Nominatim domyślnie wyłączony (ASSETS §3, LESSONS).
- Szkielet aplikacji (E5, commit `89a0586`): `tools/synchronizuj-szablon.mjs`
  (szablon promptu: dokument → kod, `--check` w bramie), `app/geo.js`,
  `app/konfig.js`, `app/protokol.js`, `app/stacje.js`, `app/app.js`,
  `index.html`, `app/styles.css` — pięć ekranów M0 (setup → pozycja → stacje →
  prompt → paczka), mobile-first z celami ≥44 px, tryb testowy `?tryb=test`
  z ręcznymi współrzędnymi (ADR 0004 pkt 6), banery dla `file://` i braku
  secure context, `localStorage` (`okolica:konfig`, `okolica:motyw`).
- Testy (E6, commity `8011f0f` i następny): 82 testy w pięciu plikach, na
  wartościach referencyjnych (geohash z Wikipedii, odległość Warszawa–Kraków,
  `metryNaPiksel(0,0)` = 156543,03) i kontrprzykładach (mutanty paczki dla
  każdego kodu E01–E20, fałszywe kotwice „ludzkości"/„wojna").
  `test/kontrakt.test.js` pilnuje zgodności dokument ↔ kod: szablon promptu,
  tabele §4/§5, wersja protokołu w czterech miejscach, cache-busting, brak API
  Node i ścieżek od korzenia, identyfikatory DOM, rejestr ADR, numeracja LESSONS,
  zero zależności.
- Zmiany reguł trwałych w tej sesji: `LESSONS` L7–L9, `PROTOKOL` §3.2 i §6
  (E10 — zarezerwowane TLD; E14 — heurystyka w czterech krokach z nazwami list
  z kodu), ADR 0003 pkt 5 (zoom przeglądowy vs zoom uliczny trybu).
- **Decyzje właściciela (2026-09-05, po przeglądzie M0)** — rozstrzygnięte trzy
  ADR-y proponowane i jedna sprawa porządkowa:
  - **ADR 0003 zaakceptowany**: podkład domyślny = OSM Standard (OpenTopoMap
    i Esri World Imagery zostają warstwami opcjonalnymi).
  - **ADR 0009 zaakceptowany**: „na razie hot-seat" — jedno urządzenie, bez
    synchronizacji; gra na wielu urządzeniach zostaje w `BACKLOG` B1.
  - **ADR 0007 przepisany PRZED akceptacją** (dozwolone dla statusu
    *Proponowana*, `LESSONS` L8) i zaakceptowany: właściciel wybrał „proste
    kodowanie bez klucza — nieczytelne na pierwszy rzut oka przy kopiowaniu,
    a nie zabezpieczone przed odszyfrowaniem". Zamiast PBKDF2 + AES-GCM jest
    `app/kodowanie.js` (XOR ze strumieniem z stałego ziarna → base64url,
    kontener `TO-paczka/2`, suma kontrolna FNV-1a), a `kod gry` zostaje
    identyfikatorem rozgrywki, nie kluczem. Plik ADR zmienił też nazwę
    (`0007-ukrywanie-paczki-obfuskacja-bez-klucza.md`). Prawdziwe szyfrowanie:
    `BACKLOG` B16. W dokumentacji i w UI obowiązuje słowo „ukryte", nie
    „zaszyfrowane" (ADR 0007 pkt 5).
  - **`AME-main.zip` usunięty** z korzenia (`git rm`) — wzorce organizacyjne są
    przeniesione, plik zostaje w historii git.
  - Zmiana kontenera `TO-paczka/1` → `/2` **nie podbiła** wersji protokołu
    (schemat paczki bez zmian, aplikacja nieopublikowana) — reguła zapisana
    w `PROTOKOL` §7.
  - Poprawki terminologiczne w **zaakceptowanych** ADR 0001 i 0006 (odsyłacz
    „krypto" → „ukrywanie paczki"): korekta odsyłaczy, nie zmiana decyzji —
    decyzji w zaakceptowanym ADR nie ruszamy, zastępuje ją nowy ADR
    (`LESSONS` L8).

**Fakty operacyjne do pamiętania:**

- Commit `3e61917` ma komunikat opisujący etap E1, a zawiera też E2 (rejestr
  ADR) — `git add -A` złapał więcej niż komunikat. Historia wypchnięta, więc
  bez poprawiania (zakaz force push); lekcja L7.
- Agent nie zapisuje `.github/workflows/` (403 `workflows`, LESSONS L4) —
  receptura CI leży w `docs/setup/ci-workflow.yml`.
- W trakcie sesji token GitHub na kilkanaście minut stracił ważność
  (`Bad credentials`) — praca szła dalej lokalnie, a po powrocie autoryzacji
  wszystko wyszło jednym pushem (`a6dcb32..1a4d378`) razem z aktualizacją opisu
  PR #2. Wniosek operacyjny: błąd autoryzacji blokuje push i PR, nie blokuje
  commitowania.
- `AME-main.zip` pozostaje nietknięty w korzeniu; jego los (przeniesienie do
  `docs/archive/` albo usunięcie po przeniesieniu wzorców) jest pytaniem do
  właściciela, nie decyzją sesji.

**Do decyzji właściciela:** ADR-y proponowane 0002, 0003, 0005, 0007, 0009,
0010, 0013 (lista w opisie PR #2).

## 2026-09-05 — sesja M1 (model rozgrywki i pozycja), ta sama gałąź, PR #2

**Zlecenie właściciela:** „Kontynuuj w tej sesji zgodnie z roadmapą" — brak
nowej decyzji, więc sesja wzięła najwyższy nieukończony kamień (`docs/ROADMAP.md`
M1) i szła etapami F1–F5 z własnego planu
(`docs/plans/PLAN_2026-09-05-m1-rozgrywka-i-pozycja.md`).

**Co zrobiono:**

- **ADR 0014 (*Proponowana*) — punktacja czasu.** ADR 0009 pkt 5 kazał liczyć
  premię „względem mediany odcinków tej samej stacji dla wszystkich graczy",
  co w modelu hot-seat (jeden gracz idzie do jednej stacji) ma zawsze jedną
  próbkę, czyli premię stale zerową. Reguła zastępcza zachowuje intencję
  (porównywać tempo, nie surowy czas): `tempo = czasS / dystansOdcinkaM`
  z karą za ręczne zgłoszenie w czasie, łańcuch zbiorów próbek (ta sama stacja
  ≥ 2 → wszystkie zakończone odcinki ≥ 2 → premia 0),
  `premia = round(punktyPodstawowe × 0,5 × ogranicz((mediana − tempo)/mediana, ±0,5))`
  → maks. ±25% punktów za odpowiedź; limit odcinka zeruje premię, ale nie
  przerywa gry. Dystans odcinka jest **łańcuchowy** (start gry → stacja 1,
  potem stacja poprzednia → następna).
- **`app/rozgrywka.js` + `test/rozgrywka.test.js`** (36 testów): stan
  `rozgrywka/1` — kolejka cykliczna `gracz = stacja mod N`, odcinki (start na
  jawnej akcji, `czasMs` wstrzykiwany, kara `karaRecznaS`, `poLimitie`),
  odpowiedzi z pełnym śladem punktacji, tryby współpracy `solo`/`zespol`/
  `wszyscy`, wiele pytań na stację, pomijanie stacji, `podsumowanie()`,
  `podglad()`, `wczytajStan()` z odmową `G12` i wskazówką migracji, kody
  `G01`–`G13` jako pełne zdania. Stan jest niezmiennikowy (`structuredClone`)
  i **nie zawiera treści pytań** — kontrakt testowany na prawdziwej paczce
  z `test/fixtures/paczka-ok.json`.
- **`app/pozycja.js` + `test/pozycja.test.js`** (21 testów) i fixture
  `test/fixtures/trasa-odbicie.json`: filtr dokładności (`ocenFix`: `ok` /
  `niedokladny` / `bez-dokladnosci` / `niepoprawny`), historia fixów
  (`dodajFix`, maks. 40, bez mutacji), kryterium dojścia (`stanDojscia` na
  `geo.czyDotarl` + zdanie „ile zostało i dlaczego nie zapala"), komunikaty
  błędów GPS `P01`–`P09` z wyjściem awaryjnym, symulacja trasy dla trybu
  testowego (deterministyczna, zero `Math.random()`, z postojem, bez którego
  debounce by się nie spełnił), cienka osłona `watchPozycja()`.
- **`test/helpers/dom.js`** — wspólna atrapa DOM wyciągnięta z
  `test/aplikacja.test.js` (`zainstalujDom`, `atrapaGeolokalizacji`,
  `stubElementu`, `ukryteWHtml`); każde wywołanie zakłada świeże globale, więc
  test chcący `?tryb=test` importuje `app.js` od nowa bez kolizji nasłuchów.
- **Refactor `app/app.js`:** geolokalizacja wyłącznie przez `pozycja.js`
  (brak `watchPosition`/`clearWatch`/opcji watchera w warstwie DOM — pilnuje
  nowy kontrakt), pauza śledzenia przy `visibilitychange` i wznowienie z
  komunikatami P07/P09, współrzędne ręczne przez `ocenFix` z odmową przy
  pustym polu (`Number('') === 0` dawało pozycję „Null Island").
- **Hartowanie `domyslnaKonfiguracja`:** `liczbaGraczy: "dużo"` w
  `localStorage` wchodziło do formularza jako `NaN` (`Math.max(1, NaN)` = NaN),
  a pusta lista imion blokowałaby `nowaRozgrywka()`. Wartość nienumeryczna =
  brak danych → default z briefu (LESSONS L10).
- **Dwie usterki modelowe znalezione przy testach** (naprawione w M1, opisane
  w ADR 0015, LESSONS L11): stacja bez pytania w paczce zostawiała grę w fazie
  `pytanie` z pustym ekranem i bez akcji wyjścia (dziś: `brakPytan` w stanie,
  ostrzeżenie `BRAK-PYTAN` w dzienniku, dojście zamyka stację bez punktów) oraz
  `pominStacje()` po dojściu kasowała pomiar dojścia i wyrzucała tempo z próbek
  mediany (dziś: odmowa `G13` z komunikatem „odpowiedz, choćby błędnie").
- **Dokumentacja:** ADR 0015 (*Proponowana*) + rejestr, `ARCHITECTURE`
  (opisy modułów, przepływ rozgrywki z prawdziwymi nazwami funkcji — wcześniej
  obiecywał `rozgrywka.nastepnyGracz()`, której nie ma; algorytmy dojścia,
  punktacji i symulacji; schemat stanu; testowanie), `LESSONS` L10–L12,
  `HANDOFF_2026-09-05-m1.md`, cache-busting `?v=m0-2` → `?v=m1-1`.

**Brama na koniec sesji:** `npm run brama` = **177 testów**, 0 fail (było 105)
+ `synchronizuj-szablon --check` zielone. Commity: `56e0dc6` (F1), `8eec03c`
(F2), `3537e59` i `0046216` (F3), `78a1bd0` (hartowanie), `09faf5c` (F4),
`cfa9fdb` (F5 — dokumentacja). Wszystko na `arena/01a07282-okolica`, PR #2.

**Do decyzji właściciela (dochodzą z tej sesji):** ADR 0014 (punktacja czasu —
mediana tempa) i ADR 0015 (niekompletna paczka, pominięcie tylko w drodze,
przedrostki kodów). Pozostałe proponowane: 0002, 0005, 0010, 0013.

## 2026-09-05 — sesja M2 (mapa), ta sama gałąź, PR #2

**Zakres z planu `docs/plans/2026-09-05-m2-mapa.md` (G1–G6):** mapa SVG
z podkładem rastrowym bez klucza API i warstwami własnymi, sterowana palcem.

**Co powstało:**

- `app/mapa.js` — dwie warstwy w jednym module: **czysta** (zoom ↔ skala,
  środek ↔ przesunięcie, `punktNaEkranie`, `zmienSkale` z kotwicą i widełkami
  `maxZoom` podkładu, `urlKafelka`, `planKafelkow`, metry ↔ piksele ↔ jednostki
  świata, `skalaBar`, `planMapy`) i **DOM** (`utworzMape()`: SVG, gesty,
  przyciski, atrybucja, `aria-label`, `zniszcz()`).
- Dwa panele w `index.html` (ekran pozycji i ekran stacji) ze szkieletem
  statycznym: `<svg role="img">`, cztery warstwy `<g>`, trzy przyciski z
  `aria-label`, pola paska skali i atrybucji. Style w `app/styles.css`
  (45 vh, `touch-action: none` tylko na panelu, cele 44 px, atrybucja jako pasek
  chowany wyłącznie gdy pusta, przyciemnienie kafelków w motywie ciemnym).
- Wpięcie w `app/app.js`: `utworzMapy()`, `odswiezWarstwy()`,
  `centrujNaPozycji()` (tylko pierwszy fix), `zmienPodklad()`, odświeżenie
  panelu w `pokazEkran()` i przy `resize`, hartowany `zoomDlaPromienia()`.
- Testy: `test/mapa.test.js` (50), +9 testów wpięcia w `test/aplikacja.test.js`,
  +5 kontraktowych w `test/kontrakt.test.js`; atrapa DOM rozszerzona o
  `createElementNS`, `replaceChildren`, `removeChild`, `getBoundingClientRect`
  z `ustawProstokat()` i naprawdę działający `removeEventListener`.

**Co wyszło przy okazji (usterki, nie plan):**

- **Trzy usterki w nowym module**, wszystkie złapane przez testy przed
  wpięciem: odwrotne przeliczenie metrów na jednostki świata (koło dokładności
  12 m miało promień większy niż cały świat — LESSONS L15), pusta sygnatura
  siatki kafelków kolidująca z wartością po resecie (podkład „brak" i schowany
  panel zostawiały stare kafelki — LESSONS L13) oraz przyciski ± rejestrowane
  dwa razy (klik zmieniało zoom o 2, a `zniszcz()` zdejmowało jeden nasłuch —
  LESSONS L14).
- **Jedna usterka istniejąca od M0**: na ekran pozycji da się wejść przyciskiem
  trybu testowego, który nie waliduje setupu, więc przy wyczyszczonym polu
  promienia przejście „Dalej: stacje" kończyło się **niezłapanym**
  `TypeError: stacjeProste: promienM > 0` — ekran się pokazywał, a lista stacji
  i mapa zostawały puste. Teraz przejście waliduje `STAN.konfig` i odmawia
  jawnie: kody z `konfig.js` (np. `[K12]`) trafiają do `bledy-pozycja`, a pasek
  stanu odsyła do ustawień gry.
- **Korekta przypisania kamieni w dokumentacji** (z początku tej sesji, commit
  `cfa9fdb`): poprzedni handoff przypisywał `app/trwalosc.js` do M5, a w
  `ROADMAP` M5 to pętla pytań — trwałość stanu gry należy do M6 (kryterium:
  wznowienie po zamknięciu przeglądarki). Poprawione w `ARCHITECTURE`, w planie
  M1, w `ROADMAP` (M3 dostał adnotację, co z niego jest już zrobione) i w nowym
  handoffie.

**Brama na koniec sesji:** `npm run brama` = **241 testów**, 0 fail (było 177)
+ `synchronizuj-szablon --check` zielone. Commity: `cfa9fdb` (M1/F5 —
dokumentacja), `03f2a56` (M2/G1 — plan), `59b5573` (M2/G2–G4 — moduł i testy),
`e65f26b` (M2/G5 — wpięcie w UI), plus commit G6 (dokumentacja).

**Zamknięcie kamienia (tego samego dnia):** właściciel obejrzał mapę w live
preview Areny (zrzut: Centrum Warszawy na ekranie „pozycja") i potwierdził
kryterium wizualne — podkład OSM ładuje się i jest czytelny, pasek skali
„100 m", atrybucja na miejscu, przyciski ＋ − ◎ w narożniku; przy odmowie zgody
na geolokalizację ekran pokazał kod `P02` z podpowiedzią (ADR 0004 pkt 7).
`ROADMAP` dostała ✅, a gesty drag/pinch zostają do obserwacji przy pierwszym
teście terenowym (M4/M6). Commity tej sesji są wypchnięte, opis i tytuł PR #2
zaktualizowane przez GraphQL (`updatePullRequest`).

**Stan operacyjny:** w środku sesji uwierzytelnienie GitHub tymczasowo
odmawiało (`Bad credentials`), więc commity od `cfa9fdb` wzwyż czekały lokalnie;
po odświeżeniu tokena przez właściciela wszystko jest wypchnięte na
`arena/01a07282-okolica` (21 commitów razem z M0), a opis i tytuł PR #2
zaktualizowane.
