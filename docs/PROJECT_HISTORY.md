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

**M3 w toku (2026-09-05, ta sama sesja):** ekran „dane i prywatność"
z dwustopniowym kasowaniem kluczy `okolica:*` (commit `8abb11c`) i symulacja
dojścia w UI trybu testowego — `sekwencjaSymulowana` odtwarzana `setInterval`,
wspólny z GPS-em lej `przyjmijFix()`, pauza w tle zatrzymuje strumień
(`5c0264f`), plus dokumentacja H4 (ten wpis, `WORKFLOW` §4.2, `ROADMAP`,
`ARCHITECTURE`, `README`, LESSONS L16–L17). Brama: **249 testów**, 0 fail
+ szablon zgodny; cache-busting `?v=m3-1`. Kamień **niezamknięty**: czeka na
weryfikację właściciela — kryterium „pełna konfiguracja bez przewijania na
360 px" i zachowanie symulacji/GPS na żywo (`docs/WORKFLOW.md` §4.2).

**M4 — stacje z sieci drogowej (2026-09-05, ta sama sesja):** kod kamienia
zrealizowany w ośmiu krokach planu `docs/plans/2026-09-05-m4-stacje-z-sieci-drogowej.md`.
I1 — `sieci.js`: instancje Overpass (ASSETS §2), polityka (timeout 20 s,
odstęp 30 s), budowa zapytania `R × 1,15` z siatką współrzędnych ~6 m i
kodami S01–S13 (`1eddbae`). I2 — generator fixture'ów Overpass
(`tools/generuj-fixture-overpass.mjs`: centrum / przedmieście / las) (`0e2182d`).
I3 — parser odpowiedzi `out geom` (`c5f12a5`). I4 — `klasyDrog` per tryb,
w tym `tertiary` poza pieszą (`87bf665`). I5 — `punktWPolygonie`, bariery,
wykluczenia i kandydaci na stacje co ~50 m (`758a845`). I6 — `wybierzStacje`:
pierścień 0,7R ± 20%, greedy po `|d_sieci − r|`, separacja kątowa ≥ 0,7 × 360°/N
i sieciowa ≥ 0,5 r, pass zamian, kody S12/S13; fixture'y przebudowane na
wspólne wierzchołki (LESSONS: geometryczne przecięcia bez wspólnych węzłów =
rozspójnione komponenty) (`7cf3967`). I7 — UI: cache `okolica:sieci:*`
(TTL 30 dni, LRU 2 MB, budżet 8 MB odpowiedzi), pobieranie przez
`window.fetch` z łańcuchem instancji i `AbortController`, synchroniczna
degradacja bez sieci, przycisk „Tryb uproszczony" (`8d72fc0`). I8 — tryb
ręczny: `wspolrzedneZEkranu`, przeciąganie pinezek z celem dotykowym 48 px,
`zrodlo: 'reczne'`, dystans tylko w linii prostej (LESSONS L18–L19,
`8c7808e`). I9 — ten wpis, `ARCHITECTURE`, `ROADMAP` (bez ✅ — kryterium
terenowe należy do właściciela).

Wyniki na fixture'ach (kryterium ≤ 15% udziału odchylenia): centrum 3,3%,
przedmieście 3,9%, las 0,2%; wybór 4–5 stacji w 10–15 ms na atrapie. Brama:
**313 testów**, 0 fail + szablon promptu zgodny; cache-busting `?v=m4-1`.

**Stan operacyjny:** w trakcie I7 uwierzytelnienie GitHub wygasło
(`GH_TOKEN is no longer valid`), a podczas oczekiwania na odświeżenie tokena
sandbox ponownie zrootował `.git` na początek gałęzi — obiekty commitów
`8d72fc0` (I7), `8c7808e` (I8) i `f090c2b` (I9) zginęły lokalnie. Drzewo
robocze zachowało stan końcowy, więc odzyskanie poszło procedurą
`ENVIRONMENT` §2 (kopia drzewa → `reset --hard FETCH_HEAD` = `7cf3967` →
kopia z powrotem → brama 313/313), a I7–I9 wypchnięto jako jeden commit
odtworzeniowy z uczciwym opisem incydentu; przypadek „commity niewypchnięte"
trafił do `ENVIRONMENT` §2. Kamień M4 **niezamknięty**: kod gotowy,
kryterium terenowe czeka na właściciela (`WORKFLOW` §4.2) razem z zaległym
M3 (konfiguracja bez przewijania na 360 px).

## 2026-09-06 — M5: pętla pytań (kod gotowy, J1–J6)

Kamień M5 w sześciu krokach, wszystkie na zielonej bramie i wypchnięte od
razu (procedura po incydentach re-root `.git` z M4):

- **J1** (`f23184f`) — plan kamienia: `docs/plans/2026-09-06-m5-petla-pytan.md`
  z decyzjami projektowymi (kształt `modyfikacje[]` = PROTOKOL §3.1, edycja
  z pełną re-walidacją, eksport = ukryty kontener, geokodacja domyślnie
  WYŁĄCZONA, instrukcja = inline SVG).
- **J2** (`06b3949`) — `protokol.zastosujEdycjePaczki(paczka, edycje)`:
  atomowa edycja pól z `EDYTOWALNE_POLA` (treść, odpowiedzi, poprawna,
  wyjaśnienie, źródła, punkty), ślad w `modyfikacje[]` `{ data, opis }`,
  wynik i tak przechodzi pełne `walidujPaczke`. 313→318 testów.
- **J3** (`76a7c32`) — podgląd „tylko dla organizatora" (ADR 0006 pkt 8):
  karty pytań po przyjęciu paczki, banner, zwijanie przy ukrywaniu i przy
  obu ścieżkach odrzucenia; zapis poprawki diffuje pola, wymienia
  `STAN.paczka` i re-waliduje całość — usterki blokują „Ukryj paczkę".
  Przy okazji spłacony fragment B16 (`renderujUsterki` na
  `replaceChildren`, LESSONS L19). 318→321.
- **J4** (`0935d95`) — eksport ukrytej paczki do pliku
  `okolica-<kodGry>.paczka.json` (kontener `TO-paczka/2`, nigdy plaintext;
  nazwa oczyszczona do `[a-z0-9-]`, ≤ 24 znaki), import bez zmian ścieżką
  „⬆ Z pliku". Przycisk widoczny dokładnie wtedy, gdy „Ukryj paczkę".
  Duplikat helpera `pobierzPlik` złapany przez `node --check` → LESSONS L20.
  321→322.
- **J5** (`5665d70`) — zapasowa nazwa miejsca (Nominatim `reverse`,
  ASSETS §3): opt-in na ekranie prywatności, domyślnie WYŁĄCZONA (ADR 0013
  pkt 2), jedno żądanie na sesję i tylko gdy Overpass nie dał nazwy,
  obowiązkowy cache `okolica:miejsce:<geohash6>` (30 dni), atrybucja ODbL,
  endpoint przełączalny bez aktualizacji aplikacji. Przy okazji wyszedł
  prawdziwy bug: checkbox „pobieranie nazwy miejsca" w setupie był
  dekoracyjny — `konfig.geokodacja` nigdzie nie bramowało UI ani promptu
  (ADR 0013 pkt 3). Naprawione z testami. 324→330 (LESSONS L21: `odstep=0`
  w testach z padającym fetchem).
- **J6** (ten commit) — instrukcja obrazkowa ekranu promptu: cztery kroki
  jako inline SVG (kopiuj → model z wyszukiwaniem → kopiuj odpowiedź →
  wklej z powrotem), siatka 2×2 czytelna na 360 px, cele ≥ 44 px; dokumenty
  (README, ROADMAP, ARCHITECTURE A.4–A.8, ten wpis) i cache-busting
  `?v=m5-1`. Brama: **332 testy**, 0 fail + szablon promptu zgodny.

**Kamień M5 niezamknięty**: kryterium właściciela — pełna pętla
z prawdziwym modelem AI (`WORKFLOW` §4.2) — czeka razem z zaległymi
kryteriami M3 (konfiguracja bez przewijania na 360 px) i M4 (prawdziwa
okolica na telefonie). Właściciel wraca do testów polowych; do tego czasu
agent koduje kamienie wg `ROADMAP` (następny: M6 — trwałość stanu
i interfejs gry).

## 2026-09-06 — M6: rozgrywka (kod gotowy, R1–R8)

Kamień M6 w ośmiu krokach, wszystkie na zielonej bramie i wypchnięte od razu
(procedura po incydentach re-root `.git` z M4):

- **R1** (`fe7548d`) — plan kamienia: `docs/plans/2026-09-06-m6-rozgrywka.md`
  z decyzjami (jeden ekran i cztery panele faz; snapshot bez plaintextu;
  odsłonięcie pytania dopiero w tranzycji; czas z `performance.now()`;
  zapis po każdej tranzycji; dwustopniowe akcje destrukcyjne; minimalny wynik
  w M6, pełne podsumowanie w M7) i rozpiską R2–R8.
- **R2** (`c023f1b`) — `app/trwalosc.js` (czyste): schemat `stan-gry/1`,
  `zbierajStan`/`serializujStan`/`walidujStanSurowy` (atomowa, kody
  `T01`–`T10`), budżet 2 MB (`T07`), klucze `okolica:gra:<kod>`
  + `okolica:gra-aktywna`, strażnik anty-plaintext (odmowa przyjęcia jawnej
  paczki), `test/trwalosc.test.js`.
- **R3** (`ce01958`) — szkielet `ekran-gra` w HTML+CSS: cztery panele faz,
  badge kolejki/dystansu/postępu, mapa gry z atrybucją, pola pytań i tabeli
  wyniku, przyciski faz (w tym dwustopniowe pominięcie i zakończenie),
  krok „6 · gra" w pasku postępu; kontrakt na identyfikatory w teście.
- **R4** (`ea703b7`) — wiring faz `przygotowanie`/`odcinek`: start gry kasuje
  `STAN.paczka` (ADR 0007 pkt 4), zegar gry z odejmowaniem pauz, wspólny lej
  fixów GPS i symulacji (`przyjmijFix` → `aktualizujGreNaFix`), dojście przez
  `stanDojscia` albo ręczne z karą, pauza (także `visibilitychange` = pełna
  pauza, watcher GPS staje), mapa gry ze stacjami i markerem.
- **R5** (`5e75f4e`) — pętla pytania: `odpakujPaczke` wyłącznie w fazie
  `pytanie` (ADR 0007 pkt 6), ocena/punkty/premia z `zapiszOdpowiedz`,
  zablokowane przyciski po pierwszym wyborze, wyjaśnienie i źródła
  (`rel="noopener"`) trzymają panel do „Następna stacja", rotacja hot-seat
  (`ktoOdpowiada`), ostrzeżenie o stacji bez pytań.
- **R6** (`f94a77f`) — trwałość w UI: `zegarMs` w snaphocie (kotwica rebazy),
  `zapiszGre()` po każdej tranzycji, baner `#karta-wznowienie` na setupie
  (faza, stacja n/N, data; zepsuty zapis → kody `T` i ukryte „Wznów"),
  `wznowGre()` z rebazą osi czasu (czas zamknięcia karty poza odcinkiem,
  ADR 0004 pkt 3), dwustopniowe kasowanie zapisu, pominięcie stacji (G11/G13),
  ręczne zakończenie z wczesnym wynikiem (zapis zostaje), `pokazWyniki()`
  z `podsumowanie()` (ranking, 🏆).
- **R7** (`0d706c3`) — integracja: pełna gra 3 stacje z dojściem SYMULACJĄ
  (ścieżka GPS — bez klikania „ręcznie", pytanie z kontenera na każdej stacji,
  wynik z rankingiem, zapis: wszystkie odcinki `zakonczony`/`gps`); zero żądań
  sieciowych w trakcie gry (utrata zasięgu); stacja bez pytania zamyka się
  samym dojściem (ADR 0015 — snapshot zbudowany czystymi modułami, wznowiony
  przez UI, bo walidator paczki taki stan odrzuca kodem E05). Złapany
  prawdziwy wyścig: `krokSymulacji` nie gasł po tranzycji fazy, liczył
  `stanDojscia` z wyczyszczonej historii i nadpisywał status gry (LESSONS L22).
- **R8** (ten commit) — dokumenty: README (status M6), ROADMAP („kod M6
  gotowy"), ARCHITECTURE (B.1–B.6 z realnym UI, `trwalosc.js` w drzewie
  modułów i w §Stan i trwałość), LESSONS L22–L23, ten wpis
  i cache-busting `?v=m6-1`. Brama: **358 testów**, 0 fail + szablon zgodny.

**Kamień M6 niezamknięty**: kryterium terenowe właściciela (`WORKFLOW` §4.2) —
pełna gra NA TELEFONIE od setupu do wyniku, z utratą zasięgu w trakcie i z
zamknięciem przeglądarki (wznowienie z rebazą zegara) — czeka razem
z zaległymi kryteriami M3 (360 px), M4 (prawdziwa okolica) i M5 (pętla
z prawdziwym modelem). Do M7 zostaje pełne podsumowanie (czasy,
sprawiedliwość trasy, eksport wyniku) i historia gier (`okolica:historia`).

## 2026-09-06 — M7: podsumowanie, punkty i udostępnianie (kod gotowy, P1–P8)

Kamień w ośmiu krokach, wszystkie na zielonej bramie i wypchnięte od razu:

- **P1** (`ce852f3`) — plan kamienia: `docs/plans/2026-09-06-m7-podsumowanie.md`
  z decyzjami (podsumowanie rośnie w `gra-panel-koniec`; medal
  sprawiedliwości widokowy 🏅, bez wpływu na punkty; eksporty = czyste moduły
  + cienka warstwa wykonawcza DOM; prywatność: ani treści pytań, ani
  współrzędnych w eksportach i historii; historia `okolica:historia` limit 50,
  zastąpienie idempotentne po kluczu gry; kody `H` jawne; share chowany gdy
  niedostępny, plik zawsze).
- **P2** (`4eaaec1`) — API historii w `app/trwalosc.js` (czyste):
  `KLUCZ_HISTORII`, schemat `historia/1`, wpis `historia-gra/1`, `skrotGry()`,
  `dodajWpisHistorii()` (niezmiennikowo, limit 50, zastąpienie po `klucz`),
  `walidujHistorieSurowa()` (atomowa, kody `H01`–`H04`) + testy jednostkowe.
- **P3** (`8e707b8`) — pełne podsumowanie w panelu D: karta zwycięzcy
  (🏆, punkty, rozbicie podstawowe + premie), ranking, szczegóły graczy
  (odcinki, czas, tempo, ręczne dojścia), tabela stacji (tryb dojścia, czas
  albo kreska), statystyki gry, medal `wynik.sprawiedliwoscTrasy()` (próg
  udziału odchylenia 0,15; pole sieciowe gdy dostępne); na ≤ 360 px tabele
  składają się w karty (czytelność w słońcu); kontrakt identyfikatorów.
- **P4** (`7e8254f`) — `app/wynik.js` (czyste): `wynikTekstowy()` (wiersze
  stacji bez `#` — `#1` na początku linii staje się nagłówkiem w
  komunikatorach), `dataWynikuTekst()`, nazwy plików
  `okolica-<kod>.wynik.txt/.png`; przyciski „⤴ Udostępnij" / „📋 Kopiuj" /
  „⬇ Wynik .txt" (Web Share → schowek → plik) + strażnik prywatności
  w testach.
- **P5** (`0a9e9eb`) — eksport obrazkowy: `planObrazuWyniku()` (PNG 1080 px;
  komendy odwołują się wyłącznie do ról palety `ROLE_PALETY`), cienki
  wykonawca `rysujWynikNaCanvas()`, kolory rozwiązane z tokenów CSS
  (`getComputedStyle`) w chwili eksportu z paletą awaryjną; zrąb DOM testów
  z rozszerzonym stub-em canvas (rekorder komend) i `getComputedStyle`.
- **P6** (`ae824e0`) — historia w UI: hook w `zapiszGre()` — wpis po każdej
  tranzycji prowadzącej do fazy `koniec` albo po ręcznym zakończeniu
  (`zakonczGreRecznie` dostało brakujące `zapiszGre()`; bez niego wpis
  „przerwana" nigdy by nie powstał), karta „Poprzednie gry" na setupie
  (najnowsza pierwsza, znacznik `(przerwana)`, jawne kody `H` przy zepsutym
  zapisie, dwustopniowe kasowanie bez `confirm()`).
- **P7** (`455e532`) — integracja end-to-end: pełna gra z dojściem GPS
  (symulacja ×3 stacje, poprawne odpowiedzi) → podsumowanie z prawdziwą
  punktacją (widełki POLICZONE z modelu: 2 × 20 pkt ± premia), eksporty
  tekstowy i obrazkowy spójne z panelem, pełny wpis historii — ze
  strażnikami prywatności (pytania odsłonięte w grze nie wyciekają do
  eksportów ani historii). Złapany błąd odczytu: regex po złączonym
  textContent karty łapał „142 pkt" z „Gracz 1" + „42 pkt" (LESSONS L24).
- **P8** (ten commit) — dokumenty (README, ROADMAP „kod M7 gotowy",
  ARCHITECTURE: drzewo + przepływ 6 + §Stan i trwałość, LESSONS L24),
  cache-busting `?v=m6-1` → `?v=m7-1`, aktualizacja PR #2. Brama:
  **383 testy**, 0 fail + szablon promptu zgodny.

Zostało na M7 (właściciel, teren): podsumowanie czytelne w słońcu na 360 px;
eksport (share/schowek/plik/obraz) na Chrome Android i Safari iOS.

## 2026-09-06 — Zadania właściciela po M7: współrzędne z Google Maps, tap na mapie, CI

Dwie uwagi właściciela po zamknięciu M7, zrealizowane poza kolejnością
ROADMAP (zlecenie właściciela), plan `docs/plans/2026-09-06-wspolrzedne-dms-i-ci.md`:

- **Diagnoza (ważna):** model dziesiętny aplikacji jest WŁAŚCIWY —
  `52°07'22.9"N` to `52 + 7/60 + 22.9/3600 = 52.12303`, a nie `52.07229`
  (złączenie cyfr DMS to częsty błąd odczytu; dla wejścia 52.07229 aplikacja
  zachowała się poprawnie, lokalizując ~20 km od Podkowy Leśnej). Dodatkowo
  pola `type="number"` fizycznie nie wpuszczały wklejenia `°'"NSEW`.
  Naprawa = wejście, nie model.
- **D1** (`592e16d`) — plan z diagnozą, decyzjami i kryteriami akceptacji.
- **D2** (`e5b1c11`) — `geo.parsujWspolrzedne` (czyste): dziesiętne z kropką
  i polskim przecinkiem, DMS (° ' " ′ ″, N/S/E/W, pary w jednym polu,
  kolejność E-first), odmowy jawne z komunikatami (minuty ≥ 60, konflikt pary,
  oś, śmieci); 6 testów z oczekiwaniami LICZONYMI z definicji DMS (L24).
  Brama po D2: **389** (w komunikacie commita omyłkowo „404" — liczba z głowy
  przed odpaleniem bramy; historia nie jest amendowana, zakaz force push
  ADR 0012 — korekta niniejszym).
- **D3** (`6aec925`) — pola tekstowe + podpowiedź z przykładem Google Maps,
  przycisk przez parser, **stuknięcie mapy pozycji** w trybie testowym
  (`mapa.js`: jeden palec, ruch < 10 px, bez pinch-a, tylko `pointerup`;
  bramka: tryb testowy + ekran pozycji; `ustawNasluchStukniecia`); zrąb DOM:
  `querySelectorAll('#id tag')` — bez tego `czytajSetupZDomu` czytało pustą
  listę imion i każda nawigacja z setupu padała w testach na K08. Brama
  **393/393**; oczekiwania tap-a liczone z widoku po `centrujNaPozycji`
  (zoom z `dopasujZoomDoPromienia`) — co do cyfry jak w aplikacji.
- **D4** (`d7b5aed` + ten commit) — **CI na GitHubie**: live
  `.github/workflows/ci.yml` z receptury w `docs/setup/` — push przeszedł BEZ
  403 (aneks L4: blokada była przywiązana do instancji tokena). Pierwszy run
  czerwony: stary kontrakt assertował NIEISTNIENIE `.github/workflows` —
  odwrócony na „live == lustro co do bajta". Dokumenty: WORKFLOW §4.1
  (wklejanie z Google Maps i tap w procedurze właściciela), L4 aneks,
  ARCHITECTURE (drzewo: parser w geo.js, tap w mapa.js), ROADMAP M8
  (adnotacja o przyspieszeniu CI).

Do potwierdzenia przez właściciela (kryteria z planu): wklejenie
`52°07'22.9"N 20°44'46.1"E` → Podkowa Leśna przy ul. Bukowej; rozróżnienie
tap/pan na żywym telefonie; zielone CI na PR #2.

## 2026-09-06 — M8: publikacja i brama jakości (plan PB1–PB6)

- **PB1** plan `docs/plans/2026-09-06-m8-publikacja.md` (commit 7d6b2a4).
- **PB2** ikony i manifest: `tools/generuj-ikony.mjs` (czysty Node: własny
  enkoder PNG z CRC32, supersampling ×4; motyw kompasu z favicona; dwa
  przebiegi = te same bajty) → `assets/ikony/` (svg, 192, 512, maskable-512,
  apple 180) + `assets/manifest.json` (ścieżki „./", standalone, lang pl) +
  `.nojekyll` + linki w `index.html`; testy generatora (6) i kontrakt M8
  (IHDR vs deklarowane sizes, zakaz ścieżek root-absolute). Brama 400/400.
- **PB3** próba włączenia Pages przez agenta: `gh api …/pages -X POST` → 403
  „Resource not accessible by integration" (token bez uprawnień admin);
  GET → 404. Publikacja zostaje jednorazową czynnością właściciela;
  `WORKFLOW.md` §5 przepisany (literówka adresu, .nojekyll, stan CI).
- **PB4** audyt dostawców check-listą `ASSETS.md` §5 → nowy §6: kod ↔ tabela
  bez rozjazdów (szablony i PODKLADY pilnuje kontrakt, Overpass i Nominatim
  ręcznie), polityki zweryfikowane 2026-09-06 (OSM tiles bez zmian; Overpass —
  sprzeczne świadectwa o zapasowych instancjach, nasz fallback to pokrywa).
- **PB5** ADR 0002 → Zaakceptowana (oba pytania otwarte rozstrzygnięte),
  drzewo w ARCHITECTURE, akapit Pages w README, domknięcie M8 w ROADMAP,
  ten wpis. **PB6** opis PR #2 rozszerzony o M8.
- Do kryterium M8 brakuje wyłącznie włączenia Pages przez właściciela
  (Settings → Pages, `WORKFLOW.md` §5) i sprawdzenia telefonu na żywo.

## 2026-09-06 — M9: repozytorium paczek pytań (plan R1–R7)

- **R1** ADR 0017 (Proponowana, wdrożona): schemat publiczny `TO-zestaw/1`
  (meta z licencją CC BY-SA 4.0 i przeglądem źródeł + jawne stacje + kontener
  TO-paczka/2), indeks z samych meta, geohash5 jako granularność, moderacja
  wyłącznie właściciela, konfigurowalny URL repozytorium, kopia lokalna z LRU.
- **R2** `app/zestawy.js`: czyste walidacje surowe (Z01–Z10), dopasowanie
  (geohash5, promień, wiek, tematy paczki ⊆ tematy konfiguracji), LRU
  1,5 MB / 8 wpisów z jawną listą usuniętych; 9 testów.
- **R3** karta „📦 Paczki dla tej okolicy" na ekranie pozycji: propozycje
  lokalne od razu, repozytorium asynchronicznie (timeout 6 s, awaria = brak
  propozycji, nigdy blokada); start gry z paczki pomija stacje/prompt/wklej;
  kopia lokalna zapisywana po KAŻDYM starcie; eksport TO-zestaw/1; 4 testy
  przepływu, w tym kryterium „druga gra bez modelu i Overpassa".
- **R4** `tools/generuj-indeks-paczek.mjs`: brama publikacji w kodzie
  (schema, licencja, dekodowalność, pokrycie stacji pytaniami, przegląd
  źródeł); kontrakt indeks↔katalog; `data/paczki/README.md` ze ścieżką
  publikacji.
- **R5** pierwsza paczka kuratorowana `podkowa-lesna.zestaw.json`: 3 stacje
  w przestrzeni publicznej (współrzędne z Wikipedii), 6 pytań, 9 źródeł
  sprawdzonych 2026-09-06; jako KANDYDAT (znacznik „oczekuje przeglądu" —
  narzędzie pomija ją z ostrzeżeniem, indeks pozostaje pusty do decyzji
  właściciela). Pułapka geohash5 odnotowana: Podkowa leży na granicy dwóch
  komórek (u3q8x / u3qb8) — paczka proponuje się graczom z komórki u3q8x.
- **R6** testy fetch-repozytorium: propozycja z indeksu, start gry z pliku,
  override URL (switchability); sklejanie URL pliku względem katalogu
  indeksu (stub DOM nie ma document.baseURI).
- **R7** dokumentacja: README (sekcja repozytorium), ARCHITECTURE (drzewo),
  ROADMAP (domknięcie), ten wpis, opis PR #2.
- Stan bramy po M9: **421/421** + szablon zgodny; CI zielone na gałęzi.

## 2026-09-06 — decyzja właściciela: współdzielone repozytorium paczek na Google Drive

Właściciel (po M9): mechanizm współdzielenia zestawów pytań NIE był z nim
ustalony — M9 zbudował wersję plikową w repo jako propozycję (ADR 0017
Proponowana). Ustalenie wiążące: współdzielone repozytorium żyje na
wydzielonym koncie **Google Drive** z mostem Apps Script (ADR 0016 →
Zaakceptowana jako kierunek): zestaw po grze trafia na Drive do katalogu
„do przeglądu”, właściciel ocenia i akceptuje, zaakceptowany jest dostępny
dla kompatybilnych gier. Kompatybilność wg właściciela: lokalizacja, liczba
pytań, liczba stacji, poziom (wiek), tematy nie szersze niż w setupie —
wbite w `app/zestawy.js` tego samego dnia (plus promień paczki ≤ promienia
z setupu). Kopia lokalna na telefonie (druga gra bez modelu) zostaje — to
nie współdzielenie, tylko oszczędność własnych gier. Wdrożenie mostu Drive:
spike CORS, wpis w ASSETS, ekran zgody prywatności — kolejny krok po
akceptacji szczegółów przepływu przez właściciela.

- 2026-09-06 (M9b/D2+D3) — decyzja właściciela o zgodzie na wysyłkę: checkbox na ekranie wklejania odpowiedzi AI, domyślnie ZAZNACZONY („zgadzam się"), użytkownik może odhaczyć (opt-out). Uzasadnienie: „zakładając, że tylko ja będę z tego korzystał, to w sumie nie ma żadnego znaczenia" — bez dodatkowego klikania, ale widoczne. Wdrożone razem z automatyczną wysyłką TO-zestaw/1 (POST text/plain, bez preflightu CORS) i jawnymi statusami każdej gałęzi (LESSONS L6); brama 420/420.

- 2026-09-06 (M9b/D4, ustalenia właściciela) — właściciel: (1) NIC jeszcze nie wklejał do Apps Script — wydzielone konto Drive będzie backendem WIELOZADANIOWYM: repozytorium paczek, gra wieloosobowa na kilku urządzeniach (parowanie graczy/gier przez Drive, koniec wyłączności hot-seat), dane użytkowników, statystyki i score (zaciąganie/zapis); (2) wdrożenie mostu ODROCZONE, aż całość kodu będzie gotowa; (3) finalną instrukcję wdrożenia agent ma wyświetlić W CZACIE (instrukcja + okna txt z treścią do przeklejenia), nie jako plik w repozytorium. Zapisano jako ADR 0018 (Zaakceptowana) + M11/M12 w ROADMAP + aktualizacja B17. Równolegle dowiezione M9b/D4+D5: indeks Drive z `id`, `urlPaczkiZRepo`, przycisk „🔌 Sprawdź połączenie" (instrument próby CORS), bump cache `?v=m9b-1`; brama 428/428.

- 2026-09-06 (M10/T1–T8) — dopracowanie terenowe: Service Worker `sw.js` (offline: skorupa + kafelki ostatniej okolicy, cache-first, limit 600 z ewikcją, POST/API bez cache; testy harnessem `new Function` — install/activate/fetch/ewikcja), bateria „budzenie przy zbliżaniu" (`PROFILE_GPS` dokładny/oszczędny + `profilBaterii` z histerezą 250/150 m, restart watchera ze jawnym statusem), sygnały (`app/sygnaly.js`: dotarcie/start odcinka/ocena — wibracja + nuty Web Audio, przełącznik „🔔 sygnały" domyślnie włączony, `okolica:sygnaly`), audyt WCAG AA jako brama (`tools/audyt-kontrastu.mjs` — 0 naruszeń w obu motywach, referencje: 21:1 czerń/biel, #767676 ≈ 4.54:1), checklista terenowa WORKFLOW §4.3, LESSONS L25 (starzejąca się atrapa DOM), cache-bust `?v=m10-1` (w tym `WERSJA_SW` — kontrakt pilnuje synchronizacji). Tryb nocny istniał od M7 — bez nowego kodu. Brama 450/450. Teren: czekamy na test właściciela (§4.3).

- 2026-09-06 (M11/M12 — decyzje właściciela) — parowanie graczy: OBIE drogi (lobby z grami w najbliższej okolicy ALBO 6-znakowy kod do przekazania); model rozgrywki: OBA tryby (wyścig równoległy + tury asynchroniczne); dane gracza: pseudonim + wyniki + pełna historia + rankingi ogólne i w kategoriach wiekowych, tematycznych i lokalizacyjnych (np. „najlepsi w Podkowie Leśnej"), „o ile sensownie do ogarnięcia" — przy skali kilku graczy agregacja po meta gry jest tania. Zapisano jako ADR 0019 (Zaakceptowana) + aneks ADR 0009 (hot-seat = tryb offline) + ROADMAP M11/M12 + plan `plans/2026-09-06-m11-m12-gra-wieloosobowa-i-rankingi.md`. Zasada prywatności podtrzymana: współrzędne NIGDY nie wychodzą na Drive — synchronizacja zdarzeniami (dojście/odpowiedź/punkty/czas).

- 2026-09-06 (M11/M12, P1–P7) — gra wieloosobowa na wielu urządzeniach + rankingi: sekcja gier w moście Apps Script (`RO-gra/1`: lobby z wygasaniem 24 h, kody z alfabetu bez 0/O/1/I, wyścig i tury ze STAŁYM przypisaniem stacji `gracze[(i-1)%N]` — rezygnacja pomija stacje zamiast przesuwać kolejkę; `RO-zdarzenie/1` z białą listą pól — współrzędne graczy nigdy nie opuszczają telefonu; LockService; `RO-lobby/1` bez kodów i zestawów; `RO-ranking/1` surowe wiersze), moduły czyste `app/wieloosobowa.js` (walidacja R01–R18, sąsiedztwo geohash5, maszynka tur, wyniki, agregacje) i `app/sync.js` (polling 10/12/30 s wg fazy, kolejka offline FIFO, rozróżnienie odmowa↔awaria), UI: rodzaj gry w setupie, zakładanie (źródło: paczka sesji / z telefonu / z Drive), dołączanie kodem i z listy gier okolicy, lobby z dużym kodem, panel wyścigu/tur + żywa tabela wyników, dwustopniowa rezygnacja, powrót po odświeżeniu telefonu (`okolica:multi:sesja`, zamknięte stacje nie wracają), ekran 🏆 Rankingi (ogólny/wiek/tematy/lokalizacja + „Moje gry"). Testy: dwa „urządzenia" (dwie instalacje atrapy DOM + dwa importy app.js) z atrapą mostu — wyścig z odcinkiem offline, tury z bramką kolejki i resume, odmowa bez zgody, R08 poza turą, skaner współrzędnych w POST-ach; rankingi z atrapą (agregacje, kategorie, puste, śmieci). Dokumentacja: PROTOKOL §9 (aneks RO-*), ARCHITECTURE (moduły + przepływ synchronizacji), README, ASSETS §7.1 (quota gier), WORKFLOW §4.4 (test na dwa telefony), ADR 0019 aneks (doprecyzowanie tur), LESSONS L26–L27. Brama 489/489, cache-bust `?v=m11-1`. Czekamy na: wdrożenie mostu przez właściciela (instrukcja w czacie — P8, ADR 0018) i test terenowy.

## 2026-09-07 — adres mostu w kodzie aplikacji (ADR 0020) + odzyskanie i wypchnięcie P6–P8

**GitHub odzyskany.** Token sesji wygasł 2026-09-06 w połowie pracy (trzecie
takie zdarzenie); właściciel odświeżył połączenie. Dodatkowo sandbox odtworzył
`.git` z płytkiego klona: lokalne commity P6–P8 zniknęły z bazy obiektów, choć
drzewo robocze miało całą treść. Odzyskanie zgodnie z `ENVIRONMENT` §2:
`git fetch origin <gałąź>` → `git reset --mixed FETCH_HEAD` (HEAD z powrotem na
`653a2dc` = P5) → `git status` pokazał dokładnie deltę P6–P8 → odtworzenie
commitów z drzewa: `c835676` (P6, kod i testy rankingów) i `12f3236` (P7+P8,
dokumentacja + robocza instrukcja wdrożenia). Granulacja nieco inna niż
pierwotna (4 commity → 2), TREŚĆ identyczna; brama 489/489 przed pushem, CI
zielone na `12f3236`, PR #2 MERGEABLE.

**Pytanie właściciela i decyzja.** Właściciel zakwestionował ostatni krok
instrukcji wdrożenia (wklejenie adresu web app w aplikacji): „te dane muszą być
wpisane w repozytorium, żeby były trwałe i dostępne za każdym razem gdy utworzę
nową wersję aplikacji webowej". Wyjaśnienie: adres w `localStorage` jest
przypięty do origin, nie do wersji kodu, więc build go nie kasuje (LESSONS L28)
— ale zastrzeżenie wskazało realny problem ZASIĘGU: w grze wieloosobowej każdy
telefon uczestnika sam rozmawia z mostem, więc każdy znajomy musiałby adres
wkleić ręcznie. Ankieta w czacie, decyzje właściciela (wiązujące → ADR 0020):
(1) adres wpisany NA STAŁE w kodzie i **pola wpisywania znikają z UI**;
(2) **bez dodatkowego klucza dostępu** w moście (repo publiczne → klucz byłby
jawny; wystarczą `REVIEW_SECRET`, kod gry, `organizatorId`, bramka tur);
(3) mechanizm TERAZ z pustą stałą, prawdziwy adres jednym commitem po wdrożeniu.

**Wdrożenie (plan `plans/2026-09-07-domyslny-adres-mostu.md`, A1–A5):**

- **A1** `app/most.js`: `DOMYSLNY_URL_MOSTU` (pusta do wdrożenia),
  `KLUCZ_URL_MOSTU`, `adresMostu(pamiec?)` (nadpisanie multi → nadpisanie repo
  → stała), `mostSkonfigurowany()`, `stanMostu()`; moduł bez DOM i bez `fetch`,
  pamięć wstrzykiwana (obsługuje `localStorage` i gołą `Map` z harnessu).
  `test/most.test.js`: 8 testów. Commit `4a414b3`; brama 497/497.
- **A2** `app/app.js`: wszystkie odczyty adresu przez `adresMostu()` (propozycje
  paczek, „🔌 Sprawdź połączenie", wysyłka zestawu na Drive, `urlMostuMulti`,
  walidacja gotowości multi, lobby, źródła zestawu, rankingi); usunięte nasłuchy
  pól i przycisków zapisu; nowa `pokazStanMostu()` — jeden tekst stanu do
  `#most-stan-repo` i `#multi-most-stan`, brak mostu dostaje klasę `.bledy`;
  komunikaty bez odsyłania do nieistniejącego pola (przy odmowie gry sieciowej
  podpowiedź „Hot-seat").
- **A3** `index.html`: karta paczek bez `<details>` z polem (zostaje stan
  + przycisk próby), karta multi bez `<details>` z polem (zostaje stan);
  cache-bust `?v=m12-1` w HTML i we WSZYSTKICH modułach `app/*.js` + `WERSJA_SW`
  (LESSONS L29: query jest częścią identyfikatora modułu — podbicie częściowe
  dałoby dwa egzemplarze modułu).
- **A4** testy: kontrakt ADR 0020 (stała w `app/most.js`, import w `app.js`,
  brak czterech id pól/przycisków adresu, jawny stan, zero komunikatów każących
  wpisywać adres, `app.js` nie sięga po klucz wprost); harness dwóch urządzeń
  zasiewa adres w pamięci zamiast w polu; nowy test stanu bez adresu (odmowa
  założenia i dołączenia, zero wysyłek, podpowiedź hot-seat); doprecyzowana
  bramka zgody (POST-y zero, GET-y gier zero; odczyt indeksu paczek jest bez
  zgody — ADR 0017 pkt 6). Commit `52f122c`; brama 499/499.
- **A5** dokumentacja: ADR 0020 (Zaakceptowana) + rejestr, aneksy ADR 0016
  i 0018, dopisek w AGENTS.md §4 (adres mostu to publiczny punkt końcowy, nie
  sekret; sekrety mostu tylko w Script Properties), ARCHITECTURE (drzewo:
  `wieloosobowa.js`, `sync.js`, `most.js` — pierwsze dwa dotąd brakowały;
  przepływ multi + akapit o stałej wdrożeniowej), README (adres w kodzie,
  „zero konfiguracji na każdym telefonie", zakresy ADR/M w tabeli), ASSETS §7
  (zdolność wpisana w kod + rotacja), WORKFLOW §4.4 (punkt 0: stan mostu; kroki
  bez wpisywania adresu; warunek: commit z adresem scalony do `main`),
  `docs/setup/most-drive-instrukcja.md` (§4 = podaj adres w czacie → commit →
  `main`; nadpisanie awaryjne przez konsolę; rotacja adresu przez NOWE
  wdrożenie), ROADMAP (M11/M12: czekamy też na adres w `app/most.js`),
  LESSONS L28–L29, ten wpis, handoff.

**Stan na koniec sesji:** brama **499/499** + szablon spójny + audyt WCAG AA
0 naruszeń; cache-bust `?v=m12-1`. Czekamy na: (1) wdrożenie mostu przez
właściciela i podanie adresu `/exec` w czacie → wpis do `DOMYSLNY_URL_MOSTU`
jednym commitem; (2) scalenie PR #2 do `main` (Pages serwuje `main`) — dopiero
wtedy testy terenowe na telefonach; (3) test dwóch telefonów (WORKFLOW §4.4).

## 2026-09-07 — sesja S1–S7 (kontynuacja), gałąź `arena/01a07b16-okolica`, PR #3

**Zlecenie:** brak zlecenia właściciela; po audycie PR #2 tryb najwyższy
nieukończony kamień → B14 (budżet lektury) + zaległości dokumentacyjne.
Plan: `docs/plans/2026-09-07-kontynuacja-audyt-i-budzet-lektury.md`.

**Audyt PR #2 (S2):** M0–M12 scalone w `d04a18a`; usterki po-audytowe naprawione
w S2/S3: gołe `fetch(` → `fetchPrzegladarki()` (L18, 13 miejsc), strażnik
nasłuchów setupu (L14), `dystanseOdcinkowM` (ADR 0014/1), `kluczCacheSieci`
z trybem, dystans sieciowy vs prosta w UI, komunikat K18 (ADR 0007/4),
`tUrzadzenia` w PROTOKOL §9.2. Brama 511/511.

**S4/S5 (B14 ✅):** `tools/budzet-lektury.mjs` + test + `npm run budzet`;
kondensacja lektury **49946 → 39667 tok** (limit 40k): ROADMAP do tabel,
LESSONS do trójczłonu bez dat, AGENTS/ENVIRONMENT/redakcja, konteksty ADR-ów
do esencji (decyzje nietknięte), rejestr ADR → odsyłacz do AGENTS §5.
PROTOKOL i treść decyzji: nietknięte (kontrakt).

**S6 (porządki):** D19 kontrakt zakazu gołego `fetch(` (54/54); D12 E16
dokumentuje wiek/tematy/jezyk; D18 koniec fałszywych `AME-main.zip` (README,
ENVIRONMENT §3, AGENTS §0/§4, ADR 0002). D8 z planu bez definicji w repo —
nieodtworzone, do wykreślenia albo doprecyzowania. BACKLOG B18: strukturalny
problem wzrostu lektury (rezerwa ~330 tok ≈ 1–2 sesje).

**Stan na koniec sesji:** brama **511/511**, kontrakt 54/54, budżet 39667/40000.
Czekamy na: (1) adres `/exec` mostu w czacie → `DOMYSLNY_URL_MOSTU` + cache-bust;
(2) scalenie PR #2 i #3 do `main`; (3) testy terenowe (WORKFLOW §4.4).

## 2026-09-07 — Partia 1 (Ekran 1) + most `/exec`, gałąź `arena/01a07b16-okolica`

Most Drive wdrożony (`DOMYSLNY_URL_MOSTU`, `?v=m12-2`, ROADMAP M9/M11/M12).
Setup: tagline „gra terenowa gdzie tylko chcesz", 1 gracz domyślnie, kanon
1-członowy `wlasny` (11 kluczy + 7 aliasów), kara poza setupem (stałe 60 s,
aneks 0004), dopiski `(ADR…)` tylko w Trybie Testowym. Szablon promptu
**PYT/1.0.1**: zasada 4 = drabina lokalności (stacja → ulica → dzielnica →
miejscowość → powiat → województwo → kraj → kontynent → świat; świat tylko
z haczykiem do okolicy). PIN-profil: `RO-profil/1` + akcje `profil-ustaw` /
`profil-sprawdz` (ADR 0021), przycisk „To ja" w setupie wpisuje pseudonim.
Brama 519/519, budżet 39838/40000. Most wymaga Nowej wersji (PIN-akcje).

## 2026-09-07 — Overpass fail-fast + Ekran 5: gra od razu (?v=m12-5), gałąź `arena/01a07b16-okolica`

1. **~100 s Overpass = martwe instancje + pauzy 30 s.** Łańcuch czekał pełny
   odstęp także po timeoutcie/braku odpowiedzi, a pauza 30 s należy się
   tylko limitom (tego wymaga polityka FOSSGIS przy 429/406). Od teraz:
   timeout/błąd sieci = przełączenie OD RAZU, bez pauzy; adres instancji,
   która dowiozła, ląduje w `okolica:overpass-sprawny` i następna gra
   próbuje ją pierwszą. Cache Drive dla sieci ODRZUCONY: localStorage
   kryje powtórki na tym telefonie, a po fail-faście pierwsze pobranie
   to sekundy; most Drive to osobny deployment (`.gs`), więc zysk nie
   wart ceny. Nazwa miejsca już dziś leci gratis w tym samym zapytaniu
   (ASSETS §2 pkt 5) — osobne źródło niepotrzebne.
2. **Ekran 5: poprawna paczka od razu zaczyna grę** (decyzja właściciela).
   Z ekranu i kodu zniknęły: podgląd organizatora + edycja (`kartaPytania`,
   `zapiszPoprawke`), „Ukryj paczkę", oba eksporty, ręczny „Zacznij grę"
   i checkbox zgody Drive — wysyłka jest domyślna i cicha (prywatna
   aplikacja). Ścieżka usterek bez zmian: lista kodów + poprawka do
   modelu. Import „⬆ Z pliku" działa jak dawniej.

Brama: 520/520, sync szablonu OK, kontrast AA OK, budżet 39964/40000.

## 2026-09-07 — Kod +17, ponowienie przy cache, ?v=m12-4, gałąź `arena/01a07b16-okolica`

1. **Przesunięcie kodu 10 → 17** (decyzja właściciela): przykład w szablonie
   to 2 + 2 + 1 + 17 = 22. Własność zachowana: goły indeks 0–3 nigdy nie
   przejdzie za kod.
2. **„Pobierz sieć ponownie" widoczne przy danych z cache.** Przycisk istniał,
   ale `renderujStacje` chował go zawsze, gdy sieć była gotowa — więc przy
   danych z pamięci telefonu nie dało się wymusić świeżego pobrania. Teraz:
   cache → przycisk widoczny (klik omija cache i woła Overpass), świeże dane
   → przycisk znika jak dawniej.

Brama: 523/523, sync szablonu OK, kontrast AA OK, budżet 39964/40000.

## 2026-09-07 — rev2: kod pozycyjny poprawnej + bump ?v= (koniec cienia SW), gałąź `arena/01a07b16-okolica`

1. **Niewidoczne zmiany — winny Service Worker.** `sw.js` (w katalogu głównym,
   nie w `app/`) serwuje skorupę cache-first, a `?v=`/WERSJA_SW stały na
   `m12-2` od kilku paczek — przeglądarka nie miała po co pytać serwera.
   (Wcześniejsza diagnoza „sw.js nie istnieje" była błędna — sprawdzono tylko
   `app/`.) Bump `m12-2 → m12-3` w `index.html`, `app/*.js` i `WERSJA_SW`:
   nowy SW instaluje się przy odświeżeniu, stare cache'e kasuje `activate`.
   Nauka na przyszłość: KAŻDA paczka ruszająca kod kończy się bumpem `?v=`
   (LESSONS L29) — inaczej podgląd kłamie.
2. **`poprawna` kodem pozycyjnym zamiast słowem.** Słowa dało się czytać wspak,
   więc rev2 to rachunek: indeks + stacja + numer pytania + 10 (np. s2p1
   z poprawną trzecią: 2 + 2 + 1 + 10 = 15). Inny dla każdego pytania,
   nieczytelny na pierwszy rzut oka, model dodaje cztery małe liczby.
   +10 rozłącza zakresy: goły indeks 0–3 nigdy nie przejdzie za kod (E06
   zamiast cichego złego klucza). Klucz ze środka gry odrzucony: dryf
   współrzędnych (E16 dopuszcza 500 m) mógłby uniemożliwić dekodowanie.
   Słowa rev2 nie zdążyły wyjść do użytkownika (cień SW) — nie ma czego migrować.

Brama: 522/522, sync szablonu OK, kontrast AA OK, budżet 39964/40000.

## 2026-09-07 — Protokół rev2 (1 pkt, poprawna słownie) + miasto w opisach, gałąź `arena/01a07b16-okolica`

1. **Koniec trudności i E18.** Każde pytanie daje 1 pkt; pole `punkty` zniknęło
   ze schematu, walidator je ignoruje (E18 wycofany), punktacja w rozgrywce to
   `poprawna ? 1 : 0`. Wiek dalej steruje tylko językiem pytań
   (`opisTrudnosci` bez zmian). Zdarzenia multi niosą punkty liczone po stronie
   klienta, więc most (Apps Script) nie wymaga zmian — sumuje to, co dostaje.
2. **`poprawna` zakodowana.** W rev2 model podaje numer odpowiedzi słownie
   i od końca (`1→nedej, 2→awd, 3→yzrt, 4→yretzc`) — nie da się ściągnąć
   zerknięciem na wklejony JSON. W aplikacji paczka robocza ma indeks 0–3 jak
   dawniej; walidator toleruje liczbę w rev2 (bez odrzucania), obce słowo to
   E06 z podpowiedzią. Szablon generuje rev2, jawna/rev1/rev2 przyjmowane —
   dawne paczki działają bez migratora (M8 nieopublikowany).
3. **Miasto w miejscu i stacjach.** `{MIEJSCE}` to „dzielnica, miasto"
   (np. „Śródmieście, Warszawa" — format jak warstwa Nominatim), stacje niosą
   „ulica, miasto" i „skrzyżowanie: A / B, miasto". Miasto = najdrobniejszy
   obszar z poziomem 7–8, inaczej 6 (miasto na prawach powiatu).

Brama: 522/522, sync szablonu OK, kontrast AA OK, budżet 39981/40000.

## 2026-09-07 — Kopiuj prompt: jeden klik kopiuje (execCommand), gałąź `arena/01a07b16-okolica`

Przyczyna: `navigator.clipboard.writeText` rzuca w iframe podglądu (uprawnienia),
więc każdy klik lądował w awaryjnym zaznaczaniu — a przy zwiniętym `<details>`
nawet ono szło w próżnię. `kopiujTekst` ma teraz trzy szczeble: schowek
asynchroniczny → `execCommand('copy')` na tymczasowym polu (niezależny od
`<details>`) → ostatnia deska: rozwiń `<details>` i zaznacz do ręcznego Ctrl+C.
„✓ skopiowano" znaczy, że tekst TRAFIŁ do schowka. Regresja: test kliknięcia
przy zablokowanym schowku w `test/aplikacja.test.js`.

Brama: 518/518, sync szablonu OK, kontrast AA OK, budżet 39829/40000.

## 2026-09-07 — Overpass: dieta odpowiedzi + nazwy ulic w stacjach, gałąź `arena/01a07b16-okolica`

1. **3–5 minut czekania — przyczyna i dieta.** `out geom` drukował obszarom
   pełną geometrię granic (m.in. całego kraju) — megabajty, których parser
   i tak nie czyta (bierze tylko tagi). Obszary idą teraz osobnym zdaniem
   z natychmiastowym `out tags`, reszta bez zmian w jednej unii `out geom`
   (ciągle jedno zapytanie na grę). LESSONS L30 doprecyzowana (samodzielne
   zdanie legalne tylko z natychmiastowym `out`), polityka instancji
   i timeoutów bez zmian (przypięte testami do ASSETS §2).
2. **Stacje z nazwami ulic.** Graf niesie przy węźle posortowane `ulice`
   (nazwy way'ów ze schodzących się dróg), kandydaci sieciowi dostają nazwę
   ulicy albo „skrzyżowanie: A / B" — opis płynie do listy na ekranie stacji
   i do `{LISTA_STACJI}` w prompcie AI (a przy okazji do heurystyki E14).
   Bezimienne drogi zostają przy uczciwym fallbacku.

Brama: 517/517, sync szablonu OK, kontrast AA OK, budżet 39829/40000.

## 2026-09-07 — Partia 3 (poprawki właściciela), gałąź `arena/01a07b16-okolica`

1. **Ekran 1, dopiski deweloperskie tylko w teście.** `stanMostu()` dostał
   opcję `{ testowy }`: poza testem pokazuje sam stan („Most Drive:
   podłączony."), a pochodzenie adresu (ADR 0020) mówi tylko w `?tryb=test`.
   Akapity o wpisanym adresie i web appie (karta multi + karta repozytorium)
   dostały klasę `tylko-test`, gaszoną w CSS poza trybem testowym.
2. **Ekran 3, S02 w mieście z drogami — naprawione.** Pierwotna przyczyna:
   `area.obszary[...];` stało jako ODRĘBNE zdanie po unii i nadpisywało set
   domyślny, więc `out geom` zwracało same obszary bez dróg. `is_in` idzie
   teraz PRZED unią, a filtr obszarów jest jej CZŁONKIEM. Regresji pilnują
   dwa asercje kształtu w `test/sieci.test.js` + LESSONS L30 (reguła + test).

Brama: 515/515, sync szablonu OK, kontrast AA OK, budżet 39847/40000.

## 2026-09-07 — Partia 2 (poprawki właściciela), gałąź `arena/01a07b16-okolica`

**T3** (Overpass 400): `area(.obszary)` → `area._` w `is_in` (składnia Overpass
QL: input set kropką); test regresji na 400. **T2**: `{MIEJSCE}` uciekane do
JSON w szablonie (cudzysłów w nazwie nie rwie promptu). **T1+T4**: nakładka
ładowania sieci + jawny retry po 400 z kodem S03 (test 80/80). **Q1**: pole
promptu w `<details>` (setup krótszy). **(7)**: kod gry autogenerowany
(`imiona-miejsce-DDMM-HHMM`, max 40) — koniec pola w setupie; K18 tylko
legacy. **S3**: koniec `wspolpraca` — odpowiada gracz z kolejki (ADR 0022,
G07 „nie Twoja kolej"). **S2**: geokodacja zawsze (koniec `K20` i checkboxa;
Nominatim-zapas za zgodą bez zmian). **S1**: zero presji czasowej (ADR 0023,
ADR 0014 wycofana do nagrobka): koniec premii, kary, limitu, tempa, medalu
i pól czasowych multi (§9.2); ranking sortem stabilnym. **Q2**: wariant
odwrócony `PYT/1.0-rev1` — reguła 8 szablonu (odwracanie + samokontrola),
dekoder w walidatorze, PROTOKOL §3.4/§7 (szablon **PYT/1.0.2**).
Poprawki ADR: 0004 pkt 5 + aneks, 0009 pkt 2–5 + aneks, 0013 pkt 3,
0015 pkt 2/4/6; rejestr + PROJECT_HISTORY. Budżet: nagrobek 0014 finansuje
0022/0023.

## 2026-09-07 — sesja audytowa (gałąź `arena/01a07c4f-okolica`, PR #4)

**Zlecenie właściciela:** „kontynuujemy projekt". Zaległości kodowych brak:
wszystkie otwarte kamienie (M3–M8, M10–M12) mają w `ROADMAP` status „kod
gotowy, czeka kryterium właściciela" (testy terenowe / włączenie Pages — poza
zasięgiem agenta), a `BACKLOG` nie upoważnia do wzięcia tematu (nagłówek pliku).
Sesja zaczęła się więc od obowiązkowego audytu poprzedniego PR (`AGENTS.md` §2
pkt 2) i od naprawy tego, co audyt wykazał.

**Stan zastany:** `main` = `f06ee55` (PR #3 scalony), CI na `main` zielone
(run `34134119244`), brama `npm test` **521/521**, budżet lektury
**39988/40000** (rezerwa 12 tok). Klon sesji był płytki (1 commit) — audyt
wymagał `git fetch origin main --depth=50` (`ENVIRONMENT` §3).

**Audyt PR #3 (`git diff d04a18a..f06ee55`, 74 pliki, +3007/−2765):**

Poprawne i spójne z ADR/protokołem:

- **rev2**: przesunięcie `+17` istnieje jako JEDNA stała
  (`PRZESUNIECIE_KODU_REV2`, `app/protokol.js:365`) użyta w dekodowaniu
  (l. 377) i kodowaniu (l. 385) — brak rozjazdu literałów; nieodczytywalny kod
  staje się znacznikiem `~kod:…` i daje E06 z instrukcją.
- **ADR 0022/0023**: `ktoOdpowiada()` zwraca jednego gracza z kolejki
  (`app/rozgrywka.js:190`), a `wspolpraca`/`WSPOLPRACA`, `miaraSprawiedliwosci`,
  tempo, medal i pola czasowe zniknęły z kodu (grep po `app/`, `index.html`
  i `test/` — zero trafień).
- **LESSONS L29**: cache-bust jednolity — `?v=m12-5` w 42 miejscach, zero
  innej wersji, `WERSJA_SW = 'm12-5'` w `sw.js`.
- **ADR 0020**: `DOMYSLNY_URL_MOSTU` jest wypełniony żywym adresem `/exec`,
  pola wpisywania adresu nie istnieją w `index.html`.
- Fałszywy alarm wyjaśniony (nie usterka): `p.poprawna.slice(5)` w komunikacie
  E06 jest strzeżone `typeof p.poprawna === 'string' && startsWith('~kod:')`,
  więc nie ma `TypeError` na liczbie.

Rozjazdy dokumentacja ↔ kod znalezione w audycie (naprawione w tej sesji):

1. **Zgoda na wysyłkę Drive**: checkbox `#zgoda-drive` został usunięty z ekranu
   wklejania (decyzja właściciela 2026-09-07; `test/kontrakt.test.js:596`
   pinuje jego brak), ale `README.md` i `docs/ASSETS.md` §7 wciąż opisywały go
   jako „domyślnie zaznaczony, można odhaczyć", a ADR 0016 (aneks 2026-09-06)
   podawał jego dosłowny HTML. Dokumenty mówiły więc o mechanizmie, którego
   w kodzie nie ma — w aplikacji prywatnej wysyłka jest domyślna i cicha.
2. **Eksport „⬇ Paczka do repozytorium (TO-zestaw/1)"**: opisany w `README.md`
   jako droga ręcznego wniesienia paczki, ale przycisk `przycisk-eksport-zestawu`
   i cały eksport zniknęły (kontrakt pinuje brak; zero trafień w `index.html`).
3. **Bramka nazwy miejsca**: `README.md` mówił, że pobieranie nazwy miejsca jest
   „bramowane ustawieniem", ale przełącznik `setup-geokodacja` usunięto
   w Partii 2 — nazwa jest pobierana zawsze (ADR 0013 pkt 3 po poprawce);
   została tylko zgoda na warstwę zapasową Nominatim (`geokodacja-zapasowa`).
4. **Podgląd i edycja paczki**: ADR 0006 pkt 8 obiecuje organizatorowi podgląd
   „tylko dla organizatora" i edycję zapisującą `paczka.modyfikacje[]`, a oba
   zniknęły z ekranu decyzją 2026-09-07 (kontrakt pinuje brak
   `podglad-organizatora` i `podglad-pytania`). Funkcja
   `zastosujEdycjePaczki()` została w kodzie bez żadnego wywołania w aplikacji
   (testy jednostkowe miała — korekta pierwszego odczytu, który pominął
   `test/protokol.test.js`): martwy eksport po usuniętej ścieżce UI, przy tym
   sprzed rev2 — walidowała `poprawna` jako `0..3`, a protokół wymaga kodu
   pozycyjnego, więc ponowne włączenie edycji psułoby paczki rev2.
5. **`SZABLON_WERSJA`** (`PYT/1.0.5`) nie ma żadnego konsumenta ani testu
   (`grep` po `app/`, `test/`, `tools/`, `index.html` — tylko deklaracja),
   więc `PROTOKOL` §7 wymaga podbijania łatki w stałej, której nikt nie czyta.

**Fakt operacyjny tej sesji (LESSONS L29 złamana i naprawiona w miejscu):**
commit `a251d14` podbił `?v=m12-6` w `index.html`, `app/app.js` i `sw.js`, ale
`git add` z jawną listą pominął 12 modułów `app/`, które ten sam `sed` podbił
w drzewie roboczym — wypchnięty commit miał więc DWA znaczniki wersji
(dowód: czysty checkout HEAD, `node --test test/kontrakt.test.js` →
`mapa.js: znacznik m12-5 różny od index.html (m12-6)`). Naprawione committem
`f1d8040`; reguła L29 doprecyzowana (`git add index.html app/ sw.js`, nie lista
z pamięci). Wniosek: przegląd `git status --short` PRZED `git commit` trzeba
CZYTAĆ — w tym przypadku pokazał ` M app/*.js` i został przeoczony.

**Co naprawiono (rozjazdy 1–5 z audytu):**

- `README.md` + `ASSETS` §7: usunięte opisy mechanizmów, których nie ma w UI
  (zgoda `#zgoda-drive`, eksport TO-zestaw/1, przełącznik geokodacji). Zgoda
  w grze wieloosobowej (`#multi-zgoda`) istnieje i jest opisana poprawnie.
- Aneksy ADR 0006 (pkt 8 — podgląd i edycja bez ścieżki w interfejsie)
  i ADR 0016 (koniec checkboxa zgody, wysyłka domyślna i cicha). Zaakceptowanych
  ADR nie edytujemy pod zmianę znaczenia (L8), więc aneks, nie korekta decyzji.
- `LESSONS` L31: usunięcie funkcji z UI zostawia jej opis w dokumentach.
- `app/protokol.js`: martwa `zastosujEdycjePaczki()` + `EDYTOWALNE_POLA`
  usunięte (brak wywołania w aplikacji; przy tym walidacja `poprawna` jako
  `0..3` sprzed rev2), razem z pięcioma testami tej ścieżki; brak pinuje
  kontrakt, żeby funkcja nie wróciła po cichu.
- `SZABLON_WERSJA` (PROTOKOL §7) dostała konsumenta: stopka pokazuje
  „protokół PYT/1.0 · szablon PYT/1.0.5", kontrakt pinuje element, render
  i kształt `PYT/1.0.N`. Cache-bust `m12-5 → m12-6`.
- Budżet lektury (B18): aneksy i lekcja opłacone kondensacją nagrobka ADR 0014
  (listę identyfikatorów niesie ADR 0023), sekcji M3–M12 w `ROADMAP`
  (inwentarze kamieni są w tabeli; wskaźniki `§Mx` → jeden `§Kryteria`)
  i sekcji kamieni zamkniętych: **39988 → 39964 tok** przy większej treści.

**Brama na koniec sesji:** 518/518 (521 − 5 testów usuniętej ścieżki edycji
+ 2 nowe kontrakty) + sync szablonu OK + WCAG AA 0 naruszeń. Podgląd na żywo
sprawdzony: stopka serwuje `PYT/1.0.5`, moduły i `sw.js` zwracają 200.

## 2026-09-07 (partia 3) — siedem punktów właściciela: Pages, budżet, prompt, tolerancja okolicy, czas gry, tożsamość, hot-seat

Właściciel zgłosił siedem rzeczy naraz. Sześć wdrożonych, siódma (gra sieciowa
bez tur) zaprojektowana w ADR 0027 część B.

- **Punkt 7 — GitHub Pages**: przy `Source: GitHub Actions` GitHub czeka na
  workflow wołający `actions/deploy-pages`, a takiego nie było. Doszedł
  `.github/workflows/pages.yml` (brama → `upload-pages-artifact@v3` z `path: ./`
  → `deploy-pages@v4`, uprawnienia `pages`/`id-token`) + lustro
  `docs/setup/pages-workflow.yml` pinowane kontraktem (bajt w bajt od
  `name: Pages`). Pułapka: kontrakt wymaga `run: npm test` w jednej linii, więc
  bramę rozbiliśmy na dwa kroki zamiast bloku `run: |`.
- **Punkt 5 — budżet lektury 40 → 100 tys. tokenów**: `LIMIT_TOKENOW`,
  `AGENTS.md` §0, testy i BACKLOG (B14, B18 rozstrzygnięty decyzją właściciela:
  „40k to za mało na taki duży projekt"). Kondensacja przestaje być obowiązkowa
  przy każdym dopisku; zasada „reguła trafia tam, gdzie jej miejsce" zostaje.
- **Punkt 2 — prompt**: „Gracze idą od stacji do stacji … i przy każdej stacji
  dostają pytania **z wybranych dziedzin**" (PROTOKOL §2 → `SZABLON_PROMPTU`,
  łatka `PYT/1.0.6`).
- **Punkt 3 — paczki „nie dla tej okolicy"**: przyczyną był filtr
  `w.geohash5 === geohash5`, a geohash to siatka: punkty ~1 m od siebie po dwóch
  stronach granicy mają różne geohash5 (u3q8q vs u3q8w). Teraz dopasowanie liczy
  **odległość od komórki geohash paczki z tolerancją 200 m**
  (`odlegloscDoKomorkiM` w `geo.js`, ADR 0024), nowe paczki niosą `geohash6`
  (≈0,75 × 0,61 km) jako dokładniejszą kotwicę, a komunikat braku mówi, ile
  paczek jest w indeksie i które kryterium nie zagrało. Prywatność bez zmian:
  dokładne stacje i tak są publiczne przez `?akcja=paczka&id=`.
- **Punkt 4 — czas gry zamiast promienia**: pole promienia zniknęło, jest
  planowany czas gry (60 min domyślnie), a promień liczy `przeliczenieCzasu`
  (90 s na pytanie, 40% reszty na drogę, trasa ≈ 1,4·√N·R) — kalibracja
  właściciela 60 min / pieszo / 5 pytań → **500 m** (ADR 0025). Konsekwencja:
  domyślny promień gry 1000 → 500 m, a `TRYBY[x].promienM` usunięte.
- **Punkt 1 — tożsamość bramą ekranu 1**: imię + PIN obok siebie, jedno wołanie
  `profil-ustaw` (wolne imię zakłada profil, zajęte wymaga PIN-u, zły PIN = R20
  i zostajesz na ekranie 1). Zweryfikowane na tym telefonie imię przechodzi bez
  sieci, a awaria mostu nie blokuje gry — tylko mówi, że historia nie zostanie
  zapisana (ADR 0026). Przełącznik i przycisk „Sprawdź" zniknęły: mniej klikania.
- **Punkt 6A — hot-seat**: pytania muszą dzielić się równo między graczy (K22),
  domyślnie `pytaniaNaStacje = liczbaGraczy`, widełki pytań 1–8 (ADR 0027).
  Układ „2 graczy × 3 stacje × 1 pytanie" jest teraz niepoprawny — fixture'y
  przeszły na 3 graczy.

**Brama na koniec partii:** 538/538 + sync szablonu OK + WCAG AA 0 naruszeń.
Podgląd serwuje `?v=m12-11`. Ostatnie dwa commity czekały na push (token GitHub
w środowisku wygasł) — patrz `docs/setup/HANDOFF_2026-09-07-partia3.md`.

## 2026-09-07 (partia 4) — B19: kotwica geohash6 dla starych paczek i B20: gra sieciowa bez tur

Dwa punkty z listy „zostało" partii 3, oba wdrożone.

- **B19 (ADR 0024 aneks)**: paczki opublikowane przed ADR 0024 mają tylko
  `geohash5` (≈3,0 × 4,9 km), więc reguła „odległość od komórki ≤ 200 m" łapała
  też paczkę 3 km dalej. `budujIndeks` w moście Drive liczy teraz dla takich
  wpisów kotwicę ze **środka ciężkości stacji** (nie z pierwszej stacji — start
  leży w środku obszaru, pierwsza stacja bywa na skraju) i oznacza wpis
  `geohash6Szacowany`; klient poszerza wtedy tolerancję o `promienM` paczki.
  To dowód braku regresji (start leży w promieniu paczki od każdej stacji, więc
  od środka ciężkości tym bardziej) przy shrinku nadmiarowego dopasowania
  z ~4 km do ~`promienM`. Koder geohash w Apps Script jest kopią `app/geo.js`
  i **jest testowany**: `test/most-indeks.test.js` wykonuje wycięty tekst
  skryptu i porównuje na siatce >500 punktów.
- **B20 (ADR 0027 część B)**: gra sieciowa bez tur. Gracz wybiera dowolną
  niezaliczoną stację (`skierujDoStacji`, G14 dla zamkniętej), pytanie bierze
  wg własnego indeksu (`pytaniaNaStacje = liczbaGraczy`, indeks zawija się przy
  mniejszej paczce, żeby nikt nie został bez pytania), 1 pkt za poprawną.
  **Premia za kolejność ukończenia**: pierwszy `G−1`, …, ostatni 0, liczona
  z `kolejnosc` zdarzeń mostu (nie z zegara urządzenia), wchodzi do punktów
  dopiero w podsumowaniu. Reguła jest po obu stronach — w `app/wieloosobowa.js`
  i w moście — a `test/most-gra.test.js` porównuje wyniki obu implementacji na
  pięciu scenariuszach. Serwer NIE wymagał zmian w walidacji: tury bramkował
  tylko przy `tryb === 'tury'`.
- Przy okazji wyszło, że `postepGracza` w aplikacji nie liczył `czasOdcinkowMs`,
  choć most go liczy — kształt wyników telefonu i Drive różnił się polem.
  Ujednolicone; parity pilnuje test.
- Nowy **BACKLOG B21**: budżet promptu i limit wklejenia dla 40 pytań
  (5 stacji × 8 graczy) — po części A domyślny setup generuje ich
  `stacje × gracze`, a protokół był testowany przy 5.

**Brama na koniec partii:** 560/560 + sync szablonu OK + WCAG AA 0 naruszeń.
Podgląd serwuje `?v=m12-13`. Skrypt mostu wymaga wklejenia przez właściciela
(kotwica geohash6 + premia) — patrz `docs/setup/most-drive-instrukcja.md`.

## 2026-09-07 (partia 5) — ekran 1: lista graczy = tożsamość + wynik hot-seat na Drive

**Zlecenie właściciela (punkt 8):** „Gracze" (liczba) i „👤 Kim jesteś?"
(imię + PIN) były nie do zrozumienia — „to trzeba zintegrować": wpisujesz imię
i PIN, klikasz „➕ Dodaj gracza", nowe imię zakłada profil z tym PIN-em, zajęte
wymaga PIN-u właściciela. Lista dodanych graczy zastępuje pole liczby.

**Trzy decyzje właściciela (ankieta w czacie):** (1) PIN sprawdzany od razu
przy dodawaniu, pole „Liczba graczy" **znika** — „tyle ilu się doda, tylu
będzie"; (2) lista jest zapamiętywana na telefonie i **nie pyta o PIN
ponownie**; (3) **zrób teraz**: wynik gry hot-seat idzie na Drive per gracz.

- **Jeden blok „👤 Kto gra?"** (`#pole-tozsamosc`): imię + PIN + „➕ Dodaj
  gracza", lista `#lista-graczy` z „✕ Usuń", przyciski zapamiętanych
  `#lista-zapamietanych`, akapit stanu. Z `index.html` zniknęły `#setup-gracze`
  i `#lista-imion`; `liczbaGraczy` jest pochodna (`max(1, imiona.length)`),
  a `pytaniaNaStacje = min(gracze, 8)` idzie za listą (K22 zostaje spełnione).
- **`okolica:profil` → `okolica:gracze`** (schemat `gracze-lokalni/1`, maks. 8,
  PIN nigdy lokalnie). Przy starcie potwierdzeni gracze wracają na listę sami,
  bez PIN-u i bez sieci; niepotwierdzeni czekają jako przyciski i wymagają PIN-u.
  Usunięcie jest trwałe — `przywrocGraczy({ zListy: true })` tylko przy
  uruchomieniu, bo inaczej usunięty gracz wracał natychmiast.
- **Wynik hot-seat na Drive** (B22): nowa akcja mostu `gra-hotseat`
  (PROTOKOL §9.5) zapisuje grę z jednego telefonu jako `RO-gra/1` ze stanem
  `zakonczona`, więc `GET ranking` czyta ją bez zmian. Punkty liczy most, premia
  hot-seat = 0 (po obu stronach — parity pilnowany testem), `zestaw: null`,
  `geohash5` startu zamiast współrzędnych, pola `lat`/`lon` kasowane także
  w moście. Zgoda `#hotseat-zgoda`, kolejka offline `okolica:hotseat-kolejka`,
  odcisk gry `okolica:hotseat-wyslane` (wynik jednej gry raz).
- Los wysyłki ma **własną linię** `#wynik-drive`, nie wspólny `#status`:
  wysyłka kończy się w nieprzewidywalnej chwili i nadpisywała komunikat
  „Obraz wyniku zapisany jako plik .png" (wyłapał test M7).
- **L32**: asynchroniczne odświeżenie listy bez licznika pokoleń dublowało
  paczki z repozytorium — `POKOLENIE_PROPOZYCJI` przed żądaniem, sprawdzenie
  przed dopisaniem i w `.catch()`.
- Literówka `prycisk.disabled` w `dodajGracza` rzucała `ReferenceError` przy
  każdym kliknięciu „Dodaj gracza" — wyłapał dopiero nowy test bramy.

**Brama na koniec partii:** `npm run brama` = **567 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-14` (+ `WERSJA_SW`).
Skrypt mostu (963 linie, md5 `01e1d9bdfa071d2634dc33d87607420f`) **wymaga
wklejenia** przez właściciela: akcja `gra-hotseat` + premia hot-seat = 0 —
patrz `docs/setup/most-drive-instrukcja.md` (sekcja „Awaryjnie").

## 2026-09-07 (partia 6) — cztery uwagi właściciela po partii 5

**Zlecenie:** (1) paczki „znajdują się" wiele kilometrów od miejsca
wygenerowania; (2) komunikat niedopasowania wymienia cały setup i sprawdza
promień, który nie wpływa na pytania; (3) imię gracza i „Usuń" są za małe
i sklejone; (4) checkbox zgody na zapis wyniku ma zniknąć — zapis jest
domyślny, info należy do sekcji prywatność.

- **(1) Diagnoza: dopasowanie działało poprawnie.** Zmierzone na
  `dopasujMetaIndeksu`: paczka z Podkowy Leśnej przy pozycji w Łodzi = 97 km
  od komórki paczki przy tolerancji 200 m → **0 dopasowań**, paczka nie
  wchodziła na listę. Winny był **komunikat**: liczył cały indeks („w indeksie:
  1") i wyglądało to jak trafienie z drugiego końca kraju. Teraz paczki spoza
  okolicy nie są ani liczone, ani wspominane (`czyWOkolicy` w `app/app.js`).
- **(2) Promień wypadł z kryteriów** (aneks ADR 0024): nie wpływa na pytania,
  a trasę wyznaczają stacje paczki. Nowe `powodyNiedopasowania()` w
  `app/zestawy.js` jest jedynym rozstrzygającym miejscem — `dopasujZestawy`
  filtruje po nim, a karta paczek cytuje powody („liczba stacji: paczka 5,
  setup 3"), bez wymieniania setupu i bez promienia.
- **(3) Lista graczy**: `font-size: 17px`, `gap: 16px`, `padding: 12px 0`,
  przycisk 15 px i `nowrap` — imię i „✕ Usuń" nie są już sklejone.
- **(4) Zgoda usunięta** (dopisek do aneksu ADR 0026): zapis wyniku jest
  domyślny, a sekcja „Dane i prywatność" dostała kartę „Wspólny Drive: historia
  i rankingi" z pełnym opisem, co jedzie i co zostaje. Bez potwierdzonego
  profilu wynik zostaje na telefonie — i `#wynik-drive` mówi to wprost, zamiast
  milczeć.
- Testy: `powodyNiedopasowania` (7 przypadków), paczka 97 km dalej nie jest
  proponowana ani wspominana, komunikat nazywa powód i nie wymienia setupu,
  zapis domyślny bez zgody, brak potwierdzonego profilu = jawny komunikat.
  Kontrakt pinuje brak `#hotseat-zgoda`, obecność karty prywatności i brak
  kryterium promienia.

### Dopisek (ten sam dzień, 2026-09-07): odpowiedź właściciela i naprawa WE06

- **Kryteria paczki ostatecznie:** okolica (±200 m) · wiek · **suma pytań
  co najmniej jak w setupie** · tematy nie szersze. Właściciel: „istotna jest
  ilość pytań w sumie, a nie ilość pytań na stację — jak gra ma mieć w sumie
  20 pytań to musi być paczka która ma 20 pytań, niezależnie od tego czy jest
  5 stacji po 4 pytania czy 2 stacje po 10"; „Liczba stacji jest nieistotna
  o ile suma pytań się zgadza"; paczka z większą liczbą pytań też pasuje.
  **Liczba stacji, pytania na stację i środek transportu wypadły z kryteriów**
  (transport — właściciel wycofał wcześniejsze „dodaj"). Nowa funkcja
  `sumaPytanWpisu()`, poprawione `powodyNiedopasowania()` (powód: „za mało
  pytań: paczka ma 4 (2 stacji × 2), a setup chce 5"), aneks ADR 0024.
- **(5) Zgoda usunięta także z gry wieloosobowej** — `#multi-zgoda` i
  `okolica:multi:zgoda` zniknęły (dopisek do ADR 0019); sekcja prywatności
  dostała punkt „Gra na wielu telefonach" (pseudonim w lobby, dojścia i
  odpowiedzi, kod gry; współrzędne zostają na telefonie) i punkt o paczkach
  pytań. Bramką wejścia do multi jest pseudonim — i tak nie da się grać bez
  niego. Schematy `RO-*` nigdy nie miały pola `zgoda`, więc most bez zmian.
- **(6) Naprawiony zgłoszony błąd** (setup 5 stacji, sieć dała 4, ekran pytań:
  `[WE06] liczbaStacji: Liczba stacji (4) nie zgadza się z konfiguracją (5)`):
  `wybierzStacje()` słusznie oddaje mniej stacji, gdy sieć nie pozwala
  zachować odstępów (S12), ale `przeliczZTegoCoJest()` zostawiał
  `liczbaStacji` przy zamówieniu i `budujPrompt()` trafiał w niezmiennik.
  Teraz **to, co wybrano, jest grą**: setup i pole `#setup-stacje` dostają
  faktyczną liczbę, promień liczy się z niej od nowa (ADR 0025), a ekran
  stacji mówi dlaczego jest ich mniej i jak zwiększyć promień, żeby dostać 5.
  Test: „sieć za uboga na zamówioną liczbę — setup idzie za wyborem, a prompt
  się buduje (S12)" w `test/aplikacja.test.js` (bez naprawy pada).
- **Jawna odmowa mostu nie udaje awarii sieci.** Właściciel zapytał, czy partia 6
  zmieniała skrypt mostu (nie zmieniała — `git log cfc357a^..HEAD --
  docs/setup/apps-script-repo-paczek.gs` = puste; wersję z geohash miał wklejoną
  wcześniej). Przy okazji wyszło: `wyslijWynikHotseat()` i
  `oproznijKolejkeHotseat()` łapały każdy błąd jednakowo i pisały „Drive nie
  odpowiedział", choć `polecenieMostu()` oznacza jawną odmowę flagą
  `odmowaMostu` (kontrakt: „nie ponawiać"). Przy starszym skrypcie w Apps Script
  gracz dostawał fałszywą diagnozę, a kolejka mieliła bez słowa wyjaśnienia.
  Teraz komunikat cytuje odpowiedź mostu („most Drive odmówił: nieznana akcja
  albo schemat ciała") i mówi, że wynik poleci po wklejeniu aktualnej wersji;
  kolejka zostaje w obu przypadkach, żeby wyniki doszły same.
- **Literówka w skrypcie mostu zablokowała pobieranie paczek z repozytorium.**
  Zgłoszone: „Graj z tą paczką" → „Paczka z repozytorium jest niekompletna (Plik
  publiczny ma inny schemat niż „TO-zestaw/1")". W `paczkaPrzezId` zadeklarowane
  było `wZaakceptowanych`, czytane `wZaakceptowane` → ReferenceError przy każdym
  pobraniu, `doGet` odpowiadał `{blad:"… is not defined"}`, a aplikacja mówiła
  „inny schemat". Paczka na Drive była poprawna. Naprawa: jedna litera w `.gs`
  (md5 `7d8cb9f2…`) + nowy `test/most-paczka.test.js`, który WYKONUJE skrypt na
  atrapie Drive (przyjęcie → akceptacja → indeks → pobranie → walidacja w
  aplikacji) i przegląda wszystkie akcje pod kątem `is not defined`; aplikacja
  cytuje teraz `blad` mostu (kod Z11) zamiast zasłaniać go „innym schematem".
  LESSONS L33.
- **B21 zmierzone (bez zlecenia terenowego — właściciel nie miał czasu testować):**
  prompt jest stały (~1 356 tokenów dla 5 i dla 40 pytań), rośnie odpowiedź
  modelu: 4 469 znaków / ~1 118 tokenów dla 5 pytań i 33 392 / ~8 348 dla 40
  (5 stacji × 8 graczy), czyli ~210 tokenów na pytanie; kontener `TO-paczka/2`
  dla 40 pytań to 35,6 kB (1,8% budżetu stanu, 2,4% rejestru). Wąskie gardło to
  limit wyjścia modelu, nie pamięć. Wdrożone: `szacunekOdpowiedzi()` +
  `PROG_ODPOWIEDZI_TOKENY = 4000` (`app/protokol.js`) i widoczna linia
  `#prompt-rozmiar` na ekranie pytań z ostrzeżeniem powyżej progu — ucięty JSON
  wracał wcześniej jako E01/E02 bez wskazania przyczyny. Testy:
  `test/duza-paczka.test.js` (4) + test UI w `test/aplikacja.test.js`; protokół
  §2 „Budżet rozmiaru", BACKLOG B21, HANDOFF §10. Dzielenie generacji na partie
  zostaje jako decyzja właściciela.
- **B16 zrobione: koniec `innerHTML` w `app/app.js` (LESSONS L19) + zamknięta
  dziura na dane zewnętrzne (LESSONS L34).** Tryby, segmenty, tematy, selecty,
  lista stacji i lista usterek budują węzły (`createElement` + `textContent`),
  więc atrapa DOM i przeglądarka zachowują się identycznie. Przy migracji wyszło,
  że wiersz stacji wstawiał przez `innerHTML` **nazwę z OSM** (`tags.name`
  przez `dopiszMiasto`), a komunikaty usterek cytują metadane paczki z Drive
  i odpowiedź mostu — obiekt OSM o nazwie `<img src=x onerror=…>` wykonałby
  skrypt w aplikacji. Wszystko, co zewnętrzne, idzie teraz przez `textContent`.
  Testy: „nazwa z OSM ze znacznikiem HTML jest tekstem, nie znacznikiem"
  (wroga nazwa w fixture Overpass, asercja: brak elementu `IMG` w wierszu)
  + poprawione 3 asercje, które czytały inertne `innerHTML` w atrapie.
- **Most: cały cykl gry wieloosobowej wykonywany w testach (LESSONS L33).**
  Atrapa Drive wyprowadzona do `test/helpers/most.js` (wspólna dla paczek i gier)
  i rozszerzona o ścieżki GET: `stanGry`, `listaGry`, `rankingi`,
  `przeliczWyniki`, `archiwizujPrzeterminowane`. Nowy `test/most-gra-cycle.test.js`:
  założenie → dołączenie → start → dojście/odpowiedź → **kolejka tur pilnowana
  przez most** (cudza stacja odrzucona z nazwaniem gracza) → auto-koniec →
  rankingi; profil gracza (pseudonim + PIN 4–8, R19/R20, cudzy pseudonim nie do
  przejęcia); i asercja prywatności czytająca **plik z Drive**, nie odpowiedź
  mostu: `lat/lon/szerokosc/dlugosc/latitude/longitude` wysłane w `dane` zdarzenia
  nie lądują na dysku (ADR 0013/0019 pkt 3), inne pola zostają.
- **Hot-seat i wygasanie lobby też wykonywane w testach.** `przyjmijGreHotseat`
  przyjmuje grę z jednego telefonu: wyniki liczone po stronie mostu, plik ląduje
  w `gryZakonczone`, `kod: null` (brak lobby), **`zestaw: null` — paczka i pytania
  zostają na telefonie (ADR 0013)**, współrzędne wycięte ze zdarzeń, a gra wchodzi
  do rankingu. Odrzucane: zdarzenie gracza spoza listy, `stacjaId` poza zakresem,
  typ inny niż dojście/odpowiedź, gracz bez pseudonimu. `archiwizujPrzeterminowane`
  przenosi otwartą grę starszą niż `WYGASANIE_LOBBY_MS` (24 h) do archiwum i znika
  ona z `listaGier()`.
- **Zasięg mostu mierzony, nie zgadywany: `npm run zasieg-mostu`.** Narzędzie
  uruchamia testy z `NODE_V8_COVERAGE`, znajduje profil skryptu z `new Function`
  i przekłada pokrycie na wiersze `docs/setup/apps-script-repo-paczek.gs`
  (przesunięcie V8 kalibrowane na nazwach funkcji; bez kalibracji narzędzie rzuca
  błąd zamiast podawać zmyślone liczby). Start pomiaru: 702/790 (88,9%),
  po domknięciu dziur **767/790 (97,1%)**. Zamknięte dziury: koder geohash
  i `kotwicaZestawu` (test wycinał je z pliku i wykonywał kopię — idą przez
  atrapę, razem z `budujIndeks` na paczce bez `meta.geohash6`: kotwica szacowana
  ze środka stacji + znacznik `geohash6Szacowany`), `stronaPrzegladu` + `esc`
  (token z `REVIEW_SECRET` wymagany, cudzy token odmawia, `<img onerror>`
  w opisie stacji i `<script>` w miejscu są pokazane jako tekst) oraz
  `powiadomWlasciciela` (mail z linkiem przeglądu — atrapa ma właściwości skryptu
  i przechwytuje `MailApp`, więc test bierze token z linku jak właściciel).
- **Oceny pytań na moście (ADR 0028, część serwerowa).** Nowy katalog
  `okolica-oceny-paczek` z plikiem `RO-oceny/1` na paczkę (głosy + tokeny gier),
  akcje `ocena` i `uzycie`, `podsumowanieOcen` w `budujIndeks`. Reguły: głosować
  można tylko na paczkę zaakceptowaną, tożsamość liczy most (`idProfilu`), jeden
  głos na (gracz, pytanie) — duplikat wraca `{ok:true, juzBylo:true}` zamiast
  błędu, licznik „użyta w X grach" liczy różne tokeny gry. W pliku ocen nie ma
  współrzędnych ani PIN-u (test dokłada je do żądania na złość i sprawdza zawartość
  pliku), a pobranie paczki nie zabiera głosów na telefon gracza. `.gs`: 963 →
  **1093 wiersze, md5 `620f28c734136654d9a4a01ebfe7853b`** — właściciel musi wkleić
  nową wersję. Zasięg testów mostu: 867/894 wierszy (97,0%).
- **Po pierwszej prawdziwej rozgrywce właściciela (2026-09-08): ADR 0029
  i wyjście z gry.** (1) Przycisk ręcznego zgłaszania dojścia usunięty
  z index.html w obu trybach: fałszował próg dojścia, a wynik i tak szedł na
  Drive i do rankingów; tryb testowy ma symulację, która rozstrzyga dojście tym
  samym kodem co GPS. Model i etykieta stanu rreczne zostają dla starych
  zapisów; komunikat P03 nie odsyła już do przycisku, tylko każe wyjść na
  otwartą przestrzeń i przypomina o pominięciu odcinka. (2) Po zakończeniu gry
  nie było wyjścia z ekranu gry: doszedł przycisk nowej gry (sprząta bieżącą
  rozgrywkę i wskaźnik wznowienia, setup i gracze zostają), a przycisk
  zakończenia na skończonej grze mówi wprost, gdzie jest wyjście, zamiast
  milczeć.
- Testy: **591, 0 fail** (nowe: droga paczki przez most, jawna odmowa mostu,
  budżet dużej paczki, wstrzykiwanie HTML z OSM, cykl gry, hot-seat, prywatność
  zdarzeń, wygasanie lobby, przegląd i powiadomienie właściciela);
  kontrakt pinuje `sumaPytanWpisu`, brak `id="multi-zgoda"` i punkt „Gra na
  wielu telefonach" w prywatności.

**Brama na koniec partii:** `npm run brama` = **572 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-16` (+ `WERSJA_SW`).
Skrypt mostu bez zmian względem partii 5 — **nadal wymaga wklejenia**
(963 linie, md5 `01e1d9bdfa071d2634dc33d87607420f`).

## 2026-09-08 — oceny pytań w interfejsie (ADR 0028) i rozgrywka pod orientację telefonu (ADR 0030), gałąź `arena/01a07c4f-okolica`

- **Oceny pytań w interfejsie (ADR 0028, część gracza).** Panel z dwoma kciukami
  w slocie pytania — ten sam przed odpowiedzią i po niej, więc ocenić można
  w każdej chwili, ale raz: klucz (głosujący, pytanie) jest pilnowany lokalnie
  (`okolica:oceny`) i niezależnie na moście. Głos jedzie w tle i nie blokuje gry,
  a nieudane wysyłki wracają do kolejki `okolica:oceny-kolejka` i próbują
  ponownie przy starcie. Tożsamość głosującego: profil zweryfikowany PIN-em daje
  slug pseudonimu, inaczej `urz-<8 hex id urządzenia>-<slug imienia>` — dzięki
  temu w hot-seat każdy z graczy ma własny głos, a nie jeden na telefon.
  Ekran 2 pokazuje statystyki paczki z indeksu (`Użyta w 12 grach · 74% na tak
  · 26% na nie (27 ocen).`); brak pola `oceny` w indeksie jest komunikowany jako
  stary most, a nie jako awaria repozytorium. Panel jest schowany dla paczek
  wygenerowanych lokalnie, bo nie ma gdzie zbierać głosów.
- **Rozgrywka pod orientację telefonu (ADR 0030).** Właściciel przed pierwszym
  wyjściem w teren: mapa ma mieć proporcje ekranu telefonu („na desktopie mam tą
  mapę gry otwartą w 16:9, na mobile powinna się otwierać na proporcje ekranu
  mobile"), pytania mają leżeć NA mapie („przewijanie na mobile to koszmar"),
  a obrót telefonu ma przełączać układ dynamicznie. Układ wybiera CSS zapytaniem
  o orientację — pion i poziom — a nie JS zgadywaniem modelu: przeglądarka
  przelicza zapytania na żywo, więc obrót działa bez przeładowania i bez
  nasłuchiwania `orientationchange`. Mapa gry jest tłem obszaru gry, więc ma
  dokładnie proporcje urządzenia (renderer i tak mierzy się
  z `getBoundingClientRect` i przelicza widok przy każdym `resize`), a karty faz
  leżą nad nią i przewijają się w środku karty: w pionie przypięte do dołu,
  w poziomie w prawej kolumnie. Strona gry się nie przewija
  (`body[data-ekran='gra']`; znacznik ustawia `pokazEkran`, bo CSS nie ma
  selektora rodzica, a `pokazPrywatnosc` go zdejmuje). Karty schodzą na dół
  rozpychaczem `::before`, nie `justify-content: flex-end` — przy przepełnieniu
  ten drugi chowa początek kolumny poza zasięg przewijania. Pasek kroków 1–6
  schowany w grze (opisuje przygotowanie), stopka cienka, ale z `#status`,
  atrybucja dostawcy przeniesiona na górę mapy (ADR 0003 pkt 3), skala pod
  przyciski +/−/◎. Desktop bez zmian.
- Testy: **610, 0 fail** (nowe: kontrakt ADR 0030 — orientacja w CSS, znacznik
  `data-ekran` na `<body>`, mapa tłem, karty nad mapą z własnym przewijaniem,
  rozpychacz zamiast `flex-end`, atrybucja dostawcy nie znika z dołem mapy).

**Brama na koniec partii:** `npm run brama` = **610 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-24` (+ `WERSJA_SW`).
Skrypt mostu bez zmian względem wpisu powyżej — 1093 linie, md5
`620f28c734136654d9a4a01ebfe7853b`; właściciel deklaruje, że wkleił tę wersję
(niezweryfikowane z sandboxa — `script.google.com` jest stąd nieosiągalny).

## 2026-09-08 — szew ręcznego dojścia usunięty do końca; przy okazji wyszły dwa prawdziwe bugi

- **Ręcznego zgłaszania dojścia nie ma już nigdzie (dopisek do ADR 0029).**
  Zostało podpięcie w `app.js` jako warunek `if (element)` — szew dla testów
  atrapy DOM i jeden jawny wyjątek w kontrakcie „app.js nie woła
  nieistniejących id". Teraz nie ma ani gałęzi, ani wyjątku. Testy (14 miejsc:
  8 w `test/aplikacja.test.js`, 6 w `test/wieloosobowa-ui.test.js` — nie 10,
  jak było w notatkach) zamykają odcinek przez `dojdzSymulacja()`: klik
  w „▶ Symuluj dojście" i aktywne czekanie, aż panel drogi zniknie, z jawnym
  błędem po 5 s zamiast cichego przejścia dalej. Martwa gałąź statusu
  „Dojście zgłoszone ręcznie" w `zakonczOdcinekGry` też wypadła.
- **Siedem komunikatów nadal kazało zgłaszać dojście ręcznie** (LESSONS L31):
  P01, P02, P04, P05, P06, P08 w `app/pozycja.js`, komunikat `stanDojscia`
  o zepsutej stacji oraz status błędu geolokalizacji w `app/app.js`. Wszystkie
  mówią teraz, co gracz MOŻE zrobić: otwarta przestrzeń, dokładniejszy pomiar,
  pominięcie odcinka, tryb testowy dla organizatora. Kontrakt ADR 0029 pilnuje,
  żeby takie sformułowania nie wróciły do `app/pozycja.js`, `app/app.js`
  ani `index.html`.
- **Bug znaleziony dzięki przejściu na ścieżkę produkcyjną (LESSONS L36):**
  `pokazPozycje()` wołało `odswiezPropozycjeZestawow()` bezwarunkowo, a jest
  wołane z `przyjmijFix()` — więc **każdy fix GPS odpytywał most Drive o indeks
  paczek** przez całą rozgrywkę, choć karta propozycji żyje na ekranie pozycji.
  Test „utrata zasięgu — zero żądań sieciowych" tego nie widział, bo ręczny
  przycisk zamykał odcinek bez fixów. Bramka `if (STAN.ekran === 'pozycja')`
  przy wywołaniu (nie w środku funkcji — dwa pozostałe wywołania to jawne akcje
  gracza); asercja w teście zostaje surowa.
- **Wznowienie gry wieloosobowej nie przywraca pozycji** — i słusznie:
  współrzędne z zasady nie opuszczają telefonu (ADR 0013), a watcher GPS
  wznawia `uruchomGreMulti`. W trybie testowym GPS nie ma, więc test po
  wznowieniu wpisuje współrzędne tak jak gracz na ekranie pozycji.
- Testy: **610, 0 fail**; `npm run brama` = 610 + sync szablonu OK + WCAG AA
  0 naruszeń. Cache-bust `?v=m12-25` (43 miejsca + `WERSJA_SW`).

## 2026-09-08 — B21: dzielenie na partie wdrożone, a potem wycofane tego samego dnia (ADR 0031)

Z pomiaru B21 wyciągnąłem wniosek, że przy ~210 tokenach na pytanie model
z limitem wyjścia 4 tys. tokenów urwie odpowiedź na 40 pytań w połowie, i na tym
założeniu zbudowałem generowanie partiami: `planPartii()` / `scalPartie()`,
globalne numery stacji w promptcie części (szablon `PYT/1.0.7`), walidacja części
wobec jej własnego zakresu (`oczekiwane.stacjeNumery`), kody WE08/WE09/WE10/E21,
paski `#prompt-partia` i `#paczka-partia`, PROTOKOL §2.2. Wdrożone i zielone
w `0b2ca68` (627 testów, brama czysta).

W trakcie pracy wyszedł jeden prawdziwy bug, złapany dopiero przez test UI
(**LESSONS L37**): gałąź scalania była martwa, bo „wklejono kontener" od „wklejono
odpowiedź modelu" rozróżniałem przez `!zKontenera.paczka`, a `odpakujPaczke()`
zwraca paczkę także dla jawnego JSON-a — formę rozróżnia dopiero pole
`zrodlo: 'kontener' | 'json' | null`. Pierwsza przyjęta część startowała grę
z 15 pytaniami.

**Właściciel zakwestionował samo założenie** i miał rację: *„Żaden z modeli
których używam nie ma nawet w przybliżeniu takich limitów. […] Meta.ai ma output
token limit 64k tokens, Google Studio models 64k, ChatGPT5+ 128k."* Liczba 4 000
była moim ostrożnościowym założeniem zapisanym w komentarzu jak fakt, nie
pomiarem jego modeli.

Policzone: największy setup, jaki aplikacja pozwala zbudować (`OGRANICZENIA`
12 stacji × 8 graczy = **96 pytań**), to ~**20 250 tokenów** odpowiedzi — 1,6 raza
mniej niż 32k, 3,2 raza mniej niż 64k. `planPartii` przy progu 64 000 zwraca
**1 część**, czyli dzielenie nie odpaliłoby się nigdy. Właściciel wybrał usunięcie
mechanizmu, nie podniesienie progu.

- **Usunięte przez `git revert 0b2ca68`** — `app/protokol.js`, `app/app.js`,
  `index.html` i `docs/PROTOKOL.md` wróciły bajt-w-bajt do stanu z `4e29879`,
  szablon do `PYT/1.0.6`. Aplikacja znowu generuje jednym zleceniem.
- **Zostaje z B21** (nie zależało od błędnego założenia): `szacunekOdpowiedzi()`
  ze stałymi pomiaru i linia `#prompt-rozmiar` na ekranie pytań — informuje
  o rozmiarze odpowiedzi przed generacją, nic nie blokuje.
  `PROG_ODPOWIEDZI_TOKENY` to już tylko próg tego ostrzeżenia.
- **Zostaje LESSONS L37** — dotyczy `odpakujPaczke()`, które nadal żyje.
- ADR 0031 ma status **Wycofana** i zostaje jako gotowy projekt na wypadek,
  gdyby dzielenie kiedyś stało się potrzebne (pakowanie całymi stacjami,
  globalne numery stacji, walidacja części wobec zakresu, odmowa scalania przy
  kolizji `id`).
- Testy: **610, 0 fail** — dokładnie tyle, ile przed B21 (`test/partie.test.js`
  i `test/partie-ui.test.js` usunięte razem z mechanizmem). `npm run brama`
  = 610 + sync szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-27`.

## 2026-09-08 — pięć uwag właściciela po ostatnich zmianach

**(1) „Możesz też grać w trybie ręcznym — karę czasową da się wyłączyć
w ustawieniach"** — tego komunikatu nie ma w kodzie od `4e29879` (P02
w `app/pozycja.js`); właściciel widział go z przestarzałej kopii. Przy okazji
wyszło, że P01/P02/P06/P08 odsyłały do przycisku „⚙", który właśnie zniknął —
wszystkie cztery mówią teraz o `?test=true` (LESSONS L31).

**(2) Zdanie o ocenach** na ekran 2 — wg wzoru właściciela:
było `Użyta w 1 grze · 50% na tak · 50% na nie (2 ocen).`, jest
`Użyta w 1 grze, 2 oceny (50% 👍, 50% 👎)`. Nowa `liczbaOcenTekst()` odmienia
„ocena/oceny/ocen" po polsku, z nastkami 12–14 przy formie „ocen".

**(3) Przelacznik „⚙ tryb testowy" usunięty z nagłówka.** Tryb testowy wchodzi
wyłącznie parametrem adresu: `?test=true`, `?test=1`, `?test=tak` albo
historyczne `?tryb=test` (używają go testy) — helper `czyTrybTestowyWUrl()`.
Kontrakt pilnuje, żeby przycisk nie wrócił.

**(4) Rankingi:** opis skrócony do „Wyniki zakończonych gier wieloosobowych:",
a błędy mostu idą przez `bladMostuPoPolsku()` — nasz własny timeout 8 s
z `AbortController` wracał jako angielskie „signal is aborted without reason"
(Chrome) albo „The user aborted a request." (Firefox).

**(4b) Rankingi są warstwą** (`role="dialog"`, karta z pełnym tłem) z klawiszem
„Zamknij rankingi" i krzyżykiem w prawym górnym rogu. Przy okazji prawdziwy bug
(**LESSONS L38**): `ekran-ranking` nie należał do `EKRANY`, więc prywatność go
nie chowała, a „wróć" czytało `STAN.ekran` — który przy wejściu na rankingi się
nie zmienia — i zawsze zrzucało na setup. Są `STAN.powrotZRankingu`
i `powrotZPrywatnosci`; powrót z prywatności na rankingi nie pyta mostu drugi raz.

Testy: **618, 0 fail**; `npm run brama` = 618 + sync szablonu OK + WCAG AA 0.
Cache-bust `?v=m12-29`.

## 2026-09-08 — mapa stała się trwałym spodem aplikacji (uwaga 5, wersja krokowa)

Właściciel: *„ten cały setup też powinien otwierać się na warstwie nad mapą. Mapa
powinna być centralnym elementem aplikacji zawsze na spodzie. I ikonka setup na
górze strony."* Z trzech wariantów wybrał krokowy: mapa z ekranu pozycji staje
się wspólnym tłem, ekrany stacji i gry zostają przy swoich mapach na później.

- `#mapa-pozycja` wyszedł z `#ekran-pozycja` i jest pierwszym elementem `<main>`
  — `position: fixed; inset: 0; z-index: 0`. Widać go pod setupem i pod ekranem
  pozycji; na pozostałych ekranach chowa go `visibility: hidden`, **nie**
  `display: none`, bo mapa mierzy swój rozmiar przy rysowaniu kafelków, a element
  `display:none` ma zerowy — po powrocie zoom i skala rozsypałyby się.
- `#ekran-setup` jest kartą nad mapą: centrowana, `max-height: 78dvh`,
  przewijanie WEWNĄTRZ karty, nagłówek nad nią (`z-index: 3`).
- W nagłówku doszła ikonka „⚙ setup" (`pokazEkran('setup')` — ta sama akcja co
  istniejący `przycisk-wstecz-setup`).

**Uczciwie o weryfikacji:** atrapa DOM w testach nie liczy pikseli, więc 618
testów tej zmiany NIE sprawdza — przechodzą tak samo przed i po. Pilnuje jej
nowy kontrakt na strukturę (mapa jest pierwszym dzieckiem `<main>`, ekran
pozycji nie ma własnej mapy, reguła `visibility` istnieje, ikonka jest podpięta)
i audyt WCAG. **Układ trzeba obejrzeć na telefonie.**

## 2026-09-08 — ekran stacji: mapa i lista obok siebie, nie jedna nad drugą

Właściciel odrzucił pomysł listy nad mapą i miał rację: *„Ekran stacji nie może
być nad mapą bo te stacje odnoszą się właśnie do mapy. […] chyba muszą być pod,
albo może podzielić ekran na dwie części i w jednej zostawić mapę, a w drugiej
scrollowany obszar na stacje?"*

Wszedł podział, nie „pod": w pionie lista zasłaniałaby pół mapy i tak, a obok
siebie widać pinezkę i jej opis jednocześnie.

- Struktura: `#ekran-stacje` (kolumna: tytuł, tryb, błędy + `.stacje-obszar`),
  a dopiero `.stacje-obszar` dzieli się na `#mapa-stacje` i `#stacje-panel`
  (lista, badge sprawiedliwości, przyciski układu, „← pozycja", „Dalej: pytania").
  Nagłówek sekcji musi zostać NAD obszarem — inaczej w poziomie tytuł stałby się
  jedną z kolumn.
- PION: mapa `flex: 1 1 auto` zajmuje wszystko, co zostanie; panel `max-height:
  42dvh` z przewijaniem w środku. Strona się nie przewija (`100dvh`,
  `overflow: hidden`), tak jak na ekranie gry (ADR 0030).
- POZIOM i szeroki ekran (`min-width: 901px`): mapa z lewej, panel 44% z prawej,
  przewijanie w panelu.
- `.mapa { height: 45vh; max-height: 460px }` jest na tym ekranie nadpisane na
  `height: auto; flex: 1 1 auto` — mapa dostaje tyle, ile naprawdę jest.

**Uczciwie o weryfikacji:** tak samo jak przy mapie-tle — atrapa DOM nie liczy
pikseli, więc 619 testów tej zmiany nie sprawdza. Pilnuje jej nowy kontrakt na
strukturę i na obecność reguł dla obu orientacji oraz audyt WCAG. Proporcje
(42dvh / 44%) trzeba obejrzeć na telefonie.

## 2026-09-08 — podgląd: wyszarzone „Dalej: stacje" i komunikaty odsyłające nie tam, gdzie trzeba

Właściciel odpalił podgląd i na ekranie pozycji zobaczył tylko P02 i wyszarzone
„Dalej: stacje →". Przyczyna nie była w układzie: podgląd działa w ramce bez
`allow="geolocation"`, więc `getCurrentPosition` kończy się odmową (`BLEDY_API[1]`
→ P02), a `pokazPozycje()` (`app/app.js:861-873`) odblokowuje przycisk dopiero,
gdy `STAN.pozycja` istnieje.

Problem w tym, że komunikaty kazały otwierać aplikację z `?test=true`, a to
niepotrzebne: `ustawPozycjeRecznie()` (`app/app.js:961-981`) **nie ma bramki
trybu testowego** — przycisk „✎ Wpisz ręcznie" odsłania pola lat/lon zawsze,
a ustawiona pozycja odblokowuje przejście. Po usunięciu przełącznika trybu
z nagłówka to jedyna widoczna droga, więc komunikaty musiały ją pokazywać.

- P01, P06, P08 wskazują „✎ Wpisz ręcznie" zamiast `?test=true`.
- P02 wskazuje obie drogi i mówi prawdę o ograniczeniu: ręczna pozycja pozwala
  iść dalej, ale **bez strumienia pozycji gra nie rozstrzygnie dojścia** — do
  rozegrania partii bez GPS potrzebna jest symulacja z `?test=true` (ADR 0029).
- Status po ręcznym ustawieniu brzmiał „Pozycja ustawiona ręcznie (tryb
  testowy)." — a trybu testowego tam nie ma (LESSONS L31: komunikat nie może
  twierdzić czegoś, czego kod nie sprawdza).
- Komentarz przy `przycisk-dalej-stacje` odsyłał do usuniętego przełącznika.

Testy: **+2 asercje** na ścieżce, na której utknął właściciel („✎ Wpisz ręcznie"
odsłania pola bez trybu testowego; ręczna pozycja odblokowuje „Dalej: stacje").
**620, 0 fail**; brama = 620 + sync szablonu OK + WCAG AA 0. Cache-bust `?v=m12-32`.

## 2026-09-08 — podgląd: mignięcie starego setupu i ekran pozycji pod mapą

Dwa zgłoszenia właściciela z jednego podglądu, dwie różne dziury w tym samym
pomyśle „ekran jako warstwa nad mapą" (**LESSONS L39**).

**(1) Mignięcie starego setupu.** Reguły układu wisiały na
`body[data-ekran='setup']`, a ten atrybut ustawia `pokazEkran()` — czyli JS, po
wczytaniu modułu. Do tego momentu selektor nie łapie: setup renderuje się
w przepływie jak przed zmianą, a reguła `body:not([data-ekran='setup'])…` chowa
mapę. Po starcie JS wszystko przeskakuje. Naprawa: `<body data-ekran="setup">`
w HTML, czyli stan początkowy taki sam jak docelowy.

**(2) Ekran pozycji pod mapą.** Reguła `body[data-ekran='pozycja']
#ekran-pozycja` ustawiała tło, szerokość i marginesy, ale **nie `position`** —
karta zostawała `static`, a element statyczny maluje się POD elementem ustalonym
z `z-index: 0`, więc znikała pod pełnoekranowym tłem mapy. Naprawa: panel
`position: fixed` w podziale ekranu — w pionie na dole (`max-height: 52dvh`),
w poziomie i na szerokim ekranie z prawej (`width: 44%`, kotwiczony od dołu
z `max-height: calc(100dvh - 110px)`, żeby nie wlazł pod nagłówek). Tło pełne,
nie półprzezroczyste: nad mapą półprzezroczystość robi tekst nieczytelnym.

**Uczciwie o weryfikacji:** atrapa DOM nie renderuje, więc 622 testy nadal nie
sprawdzają układu. Nowe kontrakty pilnują PRZYCZYN, nie efektów: `data-ekran`
w HTML i `position: fixed` w bloku reguły panelu. Proporcje (52dvh / 44%) trzeba
obejrzeć na telefonie i na desktopie.

Testy: **622, 0 fail**; brama = 622 + sync szablonu OK + WCAG AA 0.
Cache-bust `?v=m12-33`.

## 2026-09-08 — stara wersja w podglądzie: service worker przybijał do cache

Właściciel: *„Na razie mam starą wersję - pewnie cache."* Miał rację, a winny był
konkretny: service worker obsługiwał **każdy** GET z własnej domeny cache-first,
w tym `index.html`. Stary `index.html` wyciągał stare `?v=`, a te też siedziały
w cache — więc aktualizacja nie docierała bez ręcznego czyszczenia danych. To
drugie takie zgłoszenie (pierwszym był komunikat P02 zobaczony z `main`).

- `sw.js`: nowa funkcja `zSieciNajpierw()` i rozróżnienie w nasłuchu `fetch` —
  **skorupa** (`req.mode === 'navigate'`, `/`, `/index.html`) idzie z sieci
  z cache jako wyjściem awaryjnym, **reszta** same-origin (moduły z `?v=`,
  ikony) zostaje cache-first, bo ich adres i tak zmienia się przy każdej wersji.
  Kafelki bez zmian. Offline nadal działa: brak sieci → cache.
- Dwa nowe testy w `test/sw.test.js`: skorupa jest pytana z sieci mimo obecności
  w precache, a moduł z `?v=` za drugim razem idzie z cache.

**Stopka nad mapą.** Właściciel: *„Belka powinna zostać, ale mapa powinna się
pokazywać w całym viewporcie (może zostać jeszcze stopka z komunikatami na dole)."*
Reguła `#mapa-pozycja { position: fixed; inset: 0 }` już była poza media query,
więc mapa na desktopie obejmuje cały viewport — ale `<footer class="dol">` jest
rodzeństwem `<main class="tresc">`, które ma `z-index: 1`, a stopka nie miała
własnej pozycji, więc mapa malowała się NAD nią. `.dol` dostało
`position: relative; z-index: 3` — tyle samo co nagłówek.

Testy: **624, 0 fail**; brama = 624 + sync szablonu OK + WCAG AA 0.
Cache-bust `?v=m12-34`.

## 2026-09-08 — mapa „na pół ekranu": reguła z id nie nadpisała max-height

Właściciel po Ctrl+Shift+R: *„mam dalej mapę na pół ekranu, a na drugiej stronie
napisy pod warstwą mapy"*. Tym razem to NIE był cache — błąd był w CSS i dotyczył
też najnowszej budowy.

**Przyczyna.** Reguła bazowa `.mapa` (`app/styles.css:334`) deklaruje
`height: 45vh; min-height: 240px; max-height: 460px; margin: 10px 0`. Reguła
`#mapa-pozycja` nadpisała `position`, `height`, `width` i `border` — ale
`max-height: 460px` i `margin: 10px 0` przyszły z klasy i dalej obowiązywały,
bo wyższa specyficzność działa **na każdą właściwość osobno**, nie na całą
regułę. Mapa była więc `position: fixed` na całą szerokość, lecz ścięta do
**460 px** i przesunięta o 10 px w dół — pas u góry pod nagłówkiem, dokładnie to,
co właściciel opisał. Wzorzec był znany: `#mapa-gra` (linia 747) i `#mapa-stacje`
(1032/1071) mają `min-height: 0; max-height: none; margin: 0`. Tylko reguła
dodana przy zmianie „mapa jako tło" ich nie powtórzyła. → LESSONS **L40**.

**Weryfikacja.** W sandboxie nie da się postawić przeglądarki
(`storage.googleapis.com` i `deb.debian.org` odpowiadają `000`), więc kaskadę
policzył `jsdom` zainstalowany poza repozytorium, na prawdziwych `index.html`
i `app/styles.css`, dla `div#mapa-pozycja.mapa`:

| | przed (`7447943`) | po |
|---|---|---|
| `position` | fixed | fixed |
| `height` | 100% | 100% |
| `max-height` | **460px** | **none** |
| `min-height` | **240px** | **0px** |
| `margin-top` | **10px** | **0px** |
| `#ekran-pozycja` (ekran pozycji) | fixed, z 2 | fixed, z 2 |

**Numer budowy w stopce.** Właściciel dwa razy oceniał starą wersję i nie miał
jak tego stwierdzić. Stopka pokazuje teraz `wersja m12-35`, brane z `?v=` w
adresie własnego modułu (`new URL(import.meta.url).searchParams.get('v')`), więc
nie ma drugiej stałej do pamiętania przy podbijaniu cache-bust.

Dwa nowe kontrakty: reguła `#mapa-pozycja` ma resety `max-height`/`margin`/
`min-height`, a stopka ma znacznik wersji. Testy: **626, 0 fail**; brama = 626 +
sync szablonu OK + WCAG AA 0. Cache-bust `?v=m12-35`.

## 2026-09-08 — panel pozycji wjeżdżał pod stopkę, przyciski były nieosiągalne

Właściciel, już na poprawnej budowie (`stopka m12-35`, mapa na cały viewport):
*„panel wyboru pozycji zajmuje 1/2 ekranu od prawej i 2/3 ekranu od dołu i chowa
się pod stopkę co powoduje, że przyciski są ukryte, a że nie ma przewijania to są
niedostępne […] daj mi przynajmniej przewijanie jak się nie mieści na ekranie"*.

**Przyczyna.** Panel miał `position: fixed`, czyli mierzył od **viewportu**,
a żyje w obszarze między belką a stopką. `max-height: calc(100dvh - 110px)` był
liczony od wysokości okna, choć panel startuje niżej (pod belką), więc i tak
wystawał pod stopkę — a stopka ma `z-index: 3` i maluje się nad nim. Do tego
`bottom: 10px` w ogóle nie działało: dla elementu ustalonego przy `top: auto`
przeglądarka bierze pozycję statyczną i **ignoruje `bottom`**, więc wysokość
szła z treści, a `overflow-y: auto` nie miało czego przewijać. → LESSONS **L41**.

**Poprawka.** `body { display: flex; flex-direction: column }` +
`.tresc { flex: 1 1 auto; position: relative }` oznacza, że `.tresc` zajmuje
dokładnie pas między belką a stopką. Panel jest teraz `position: absolute`
względem `.tresc`, więc jego sufit i podłoga są wyznaczone z góry:

- poziom/szeroki ekran: `top: 10px; right: 10px; bottom: 10px; width: 44%` —
  wysokość wynika z ograniczeń, nie z ilości treści;
- pion: `top: 42dvh; left/right: 10px; bottom: 10px; max-width: 640px` —
  dokowany do dołu, mapa zostaje nad nim;
- w obu wariantach `top` i `bottom` są jawne, więc `overflow-y: auto` dostaje
  coś do przewijania, gdy treść się nie mieści.

Przy okazji drugi przeciek w rodzaju L40: `.ekran { max-width: 720px;
margin: 0 auto }` — reguła panelu nie deklarowała `margin`, więc `margin: 0 auto`
z klasy dalej obowiązywało. Dodane jawne `margin: 0`.

**Weryfikacja.** Kaskada policzona `jsdom` na prawdziwych `index.html` i
`app/styles.css` dla `data-ekran="pozycja"`: `position: absolute`,
`z-index: 2`, `margin-top: 0px`, `overflow-y: auto`. `jsdom` nie wartościuje
media queries, więc gałęzie pion/poziom są przypięte kontraktem na poziomie
źródła (oba warianty muszą mieć jawne `top` i `bottom`), nie kaskadą.

Testy: **627, 0 fail**; brama = 627 + sync szablonu OK + WCAG AA 0.
Cache-bust `?v=m12-36`.

## 2026-09-08 — przyciski +/− mapy chowały się pod belką

Właściciel: *„jeszcze przyciski +- na mapie chowają się pod belkę nagówka"*.

**Przyczyna.** Mapa-tło ma `position: fixed; inset: 0`, więc sięga POD samą
belkę. Jej przyciski brały uniwersalne `.mapa-przyciski { top: 8px; right: 8px }`
— liczone od kontenera mapy, czyli teraz od viewportu. Belka ma `z-index: 3`
i nieprzezroczyste tło, więc malowała się nad nimi. W wariancie poziomym ten sam
los czekał je ze strony panelu pozycji (`z-index: 2`, prawa strona). → **L42**.

**Poprawka.** Dla mapy-tła na ekranach `setup` i `pozycja`:

```css
top: calc(var(--wysokosc-belki, 64px) + 10px);
right: auto;
left: 10px;
```

Poniżej belki i przy lewej krawędzi — z dala od panelu, który stoi przy prawej.
Wysokość belki **mierzy** nowa funkcja `ustawWysokoscBelki()` w `app/app.js`,
wołana w `start()` i w nasłuchu `resize`, bo `.akcje` ma `flex-wrap: wrap` i na
wąskim ekranie belka rośnie — stała liczba w CSS w końcu by się rozsypała.
Funkcja ma straż na `offsetHeight` nienumeryczny albo ≤ 0, więc atrapa DOM
w testach (której `document.querySelector` zwraca `null`) przechodzi bez
wyjątku.

**Weryfikacja.** Kaskada `jsdom` dla `#mapa-pozycja .mapa-przyciski`:
`top: calc(var(--wysokosc-belki, 64px) + 10px)`, `left: 10px`, `right: auto`.
`jsdom` nie rozwija `calc()` ani `var()`, więc liczbę pikseli potwierdza dopiero
przeglądarka. Kontrakt sprawdzony negatywnie: usunięcie `right: auto` wywala
test z komunikatem „przyciski muszą zejść z prawej".

Testy: **628, 0 fail**; brama = 628 + sync szablonu OK + WCAG AA 0.
Cache-bust `?v=m12-37`.

## 2026-09-09 — audyt PR #4 (sesja `arena/01a085c2-okolica`)

**Audyt poprzedniego scalonego PR** (`f06ee55..110a666`, 79 plików, +9187/−942,
AGENTS §2 pkt 2): przegląd plik po pliku — logika, zgodność z ADR i protokołem,
zieloność testów. Stan: **przyjęty bez zastrzeżeń do kodu**; dwa znaleziska
dotyczą wyłącznie dokumentacji i idą do naprawy w tej sesji.

**Co sprawdzono (kod):**

- `app/geo.js` — `ramkaGeohash`/`sasiednieGeohash` przeniesione z `wieloosobowa.js`
  bez zmiany logiki (re-eksport dla importerów); nowe `odlegloscDoKomorkiM`
  zwraca `null` dla śmieci (L6). Zgodne z ADR 0024.
- `app/konfig.js` — czas gry zamiast promienia (ADR 0025): wzór z jawnymi stałymi,
  punkt kalibracyjny 60 min/5 stacji → 500 m w teście; K19/K22, widełki pytań
  1–8 (ADR 0027), migracja starego zapisu przez przeliczenie. `TRYBY[].promienM`
  usunięte w całości — grep nie znajduje sierot.
- `app/protokol.js` — szablon `PYT/1.0.6` (sync z PROTOKOL §2 pilnuje brama),
  B21 `szacunekOdpowiedzi` + `#prompt-rozmiar`, usunięcie martwej
  `zastosujEdycjePaczki` po decyzji o starcie gry od razu (aneks ADR 0006).
- `app/zestawy.js` — `powodyNiedopasowania` jako jedyne źródło prawdy (UI cytuje
  powody), `sumaPytanWpisu`, kotwica geohash6, Z11 cytuje `{blad}` mostu (L33).
- `app/wieloosobowa.js` — premia za kolejność z `kolejnosc` mostu (nie z zegara),
  hot-seat premia 0, `graHotseatDoWysylki` jako lustro `bledyGryHotseat`,
  profile lokalne bez PIN-u w zapisie. Zgodne z ADR 0026 aneks i PROTOKOL §9.5.
- `app/oceny.js` (nowy) — slug lustrem `idProfilu` mostu (parzystość testowana
  wykonaniem obu stron), O03 blokuje drugi głos lokalnie, kolejka offline.
  Zgodne z ADR 0028.
- `app/rozgrywka.js` — G14 + `skierujDoStacji`/`stacjeDoWyboru` (ADR 0027 B);
  silnik nie bramkuje turą gry sieciowej, bo stan multi to 1 gracz (aneks ADR 0022).
- `app/pozycja.js` — komunikaty P01–P06/P08 bez ręcznego dojścia (ADR 0029);
  P02 wskazuje `?test=true`.
- `app/app.js` — brama tożsamości w „Dalej" (lista, nie jedno imię),
  S12: setup idzie za wyborem stacji z jawnym komunikatem, tryb testowy TYLKO
  parametrem adresu (`czyTrybTestowyWUrl`: `?test=true|1|tak`, historyczne
  `?tryb=test`; przycisk usunięty decyzją właściciela), oceny w `renderujPytanie`,
  wysyłka hot-seat z rozróżnieniem odmowy mostu od awarii sieci.
- `index.html` — usunięcia pinowane kontraktem (`przycisk-test`,
  `przycisk-reczne-dojscie`, zgody, `setup-gracze`); nowe: `lista-graczy`,
  `profil-stan`, `gra-oceny`, `prompt-rozmiar`, `wynik-drive`, `stopka-wersja`,
  `data-ekran="setup"` w HTML (L39).
- `app/styles.css` — ADR 0030 (dwa układy pod orientację, strona gry bez
  przewijania), kontrakt pinuje brak `background` na `#bledy-gra`/`.badge-duzy`
  (L35); L40–L42 rozliczone w PROJECT_HISTORY.
- `sw.js` — skorupa network-first (naprawia „stara wersja w podglądzie"),
  reszta cache-first; POST/API bez cache bez zmian.
- `apps-script-repo-paczek.gs` — akcje `gra-hotseat`/`ocena`/`uzycie`, premia
  w `przeliczWyniki`, `geohashPunkt`+`kotwicaZestawu`, literówka
  `wZaakceptowane` naprawiona; zasięg mierzony `npm run zasieg-mostu` (L33).
- `.github/workflows/pages.yml` + lustro `docs/setup/pages-workflow.yml`
  (identyczne po odcięciu nagłówka lustra; kontrakt pilnuje).
- `tools/zasieg-mostu.mjs` + `npm run zasieg-mostu` — pokrycie mostu na wiersze
  pliku z kalibracją przesunięcia V8.

**Zieloność:** `npm test` 628/628 + brama (sync szablonu, WCAG AA 0) — potwierdzone
w tej sesji przed zmianami. `?v=m12-37` spójne (43 miejsca + `WERSJA_SW`).

**Znaleziska (dokumentacja, naprawa w tej sesji):**

- F1: kanoniczne wejście w tryb testowy to `?test=true` (przycisk usunięty),
  a `docs/WORKFLOW.md` §4 i `README.md` nadal podają tylko `?tryb=test`.
  Historyczna forma działa (pinuje ją test), ale dokumenty mają mówić kanon.
- F2 (starsze niż PR #4, z listy L31): `docs/WORKFLOW.md` §3 opisuje usunięte
  mechaniki (promień edytowalny, kod gry do ukrycia, kara za ręczne zgłoszenie,
  „Sprawdź i zaszyfruj", podgląd organizatora) — do przepisania na stan obecny.

## 2026-09-09 — sesja porządkowa: audyt PR #4, tryb testowy w docs, WORKFLOW §3

Zlecenie właściciela: „Kontynuujemy projekt. Jak skończysz część obowiązkową,
to napisz mi, jak wywołuje się teraz tryb testowy.”

**Część obowiązkowa (AGENTS §0 + §2):** lektura startowa w całości, budżet
56 132 / 100 000 tokenów, `npm test` 628 zielone przed zmianami, PR #5 gałęzi
`arena/01a085c2-okolica` przed kodowaniem, audyt PR #4 plik po pliku (wpis
„2026-09-09 — audyt PR #4” powyżej; kod przyjęty, 2 znaleziska dokumentacyjne).

**Praca (3 commity, każdy zielony 628/628 i od razu wypchnięty):**

- F1 (`4ad03da`): kanoniczne `?test=true` w README, WORKFLOW §4 i aneksie
  ADR 0004 — przycisk trybu testowego usunięto z UI 2026-09-08, a dokumenty
  podawały tylko historyczne `?tryb=test` (działa dalej, pinuje je test).
- F2 (`1fae8bd`): WORKFLOW §3 przepisany na stan obecny (L31) — stary opisywał
  promień edytowalny, kod gry do ukrycia, karę za ręczne dojście, „Sprawdź
  i zaszyfruj”, podgląd organizatora i eksport paczki.
- Weryfikacja na żywo (headless Chromium, 360 px): `?test=true/1/TAK`
  i `?tryb=test` włączają tryb (klasa, ręczne współrzędne, symulacja),
  `?test=false/0` i czysty adres nie; `#przycisk-test` nie istnieje.

Kodu i CSS nie ruszano — `?v=m12-37` bez zmian. ROADMAP bez zmian (wszystkie
kamienie kodowo gotowe, kryteria po stronie właściciela). Handoff:
`docs/setup/HANDOFF_2026-09-09.md`.

## 2026-09-09 (sesja następna) — audyt PR #5

Audyt wykonany przed jakimkolwiek kodowaniem (ADR 0012 §2) na
`git diff 110a666..bb3e163`, plik po pliku. **Uwaga metodyczna:** opis PR #5
i handoff mówiły o sesji „porządkowej, bez zmian kodu”, a scalony diff niesie
35 plików i 1452 dodane linie — poza porządkami dokumentacyjnymi (F1, F2)
weszły trzy większe zakresy dołożone później w tej samej gałęzi. Audyt objął
całość diffu, nie tylko to, co opisywał handoff.

**Zakres 1 — wariant „Pytania (bez fact check)” (ADR 0032, commity C1–C3).**
`app/protokol.js`: `WERSJA_PROTOKOLU_REV3`, drugi szablon
(`SZABLON_PROMPTU_BEZ_WERYFIKACJI`, wersjonowany osobno jako
`PYT/1.0-nofc.1`), bramka E09 przez `wariantWejsciowy` stawiane przez dekoder,
E10 z komunikatem wariantowym, `poprawkaDlaModelu({factcheck})`.
Zgodne z ADR 0032 §3 (nośnik wariantu przez pole na paczce roboczej, bo
dekoder normalizuje znacznik) i PROTOKOL §2.2/§3.4/§6. Reguła addytywna
`factcheck !== false` konsekwentnie w `zestawy.js` (`zbierzMetaZestawu`),
`trwalosc.js` (`skrotGry`) i w `czyWpisFactcheck` w `app.js` — jak `geohash6`
z ADR 0024. Znaczek Q ma `role="img"` + `aria-label` (informacja, nie
dekoracja) i pojawia się TYLKO przy wariancie zweryfikowanym, więc brak
znaczka nie jest dwuznaczny. `tools/synchronizuj-szablon.mjs` przepisany na
tablicę `SZABLONY` — dwa bloki, jedno źródło prawdy (PROTOKOL), kontrakt
pilnuje obu.

**Zakres 2 — oceny per gracz, nie per telefon (ADR 0028 pkt 2).**
`kluczGlosu` niesie teraz głosującego, `znajdzGlos` zwraca wpis (panel
potrzebuje `aria-pressed`), a `STAN.oceniajacyId` liczony raz przy renderze
panelu i używany przy kliku — poprawka realnego rozjazdu „już ocenione”
kontra głos. Głos sprzed zmiany (bez pola `gracz`) blokuje każdego; wybór
świadomy i opisany w kodzie: milczące odblokowanie dublowałoby głosy, a most
odrzuciłby duplikat dopiero po fakcie. Walidator lokalny normalizuje wpisy
(`map` na białą listę pól) — obce pola z localStorage nie wchodzą dalej.

**Zakres 3 — ekran startowy i smukła belka (decyzja właściciela 2026-09-09).**
Nowy stan `data-ekran="mapa"` (poza `EKRANY`, jak prywatność i rankingi),
`pokazMapeStartowa()` + `ukryjStart()`, okno `#ekran-start` 80%×80% nad mapą,
nagłówek bez tytułu (ikony + „⚙ START GRY”). Lekcje L38/L39 zastosowane:
stan początkowy stoi w HTML (`<body data-ekran="mapa">`, `#ekran-setup hidden`),
a wejścia poboczne (prywatność, rankingi) jawnie wołają `ukryjStart()` i
obsługują powrót na `mapa`. Warstwa ma `position: fixed` i `z-index: 10`
(L39), przyciski mapy chowają się przy otwartym oknie (L42).

**Wynik audytu: kod przyjęty bez zastrzeżeń.** Kontrola spójności: `?v=m12-40`
w 43 miejscach (jedna wersja wszędzie, L29), `npm test` 656/656 zielone na
`bb3e163` przed jakąkolwiek zmianą tej sesji.

**Znaleziska (dokumentacja — realizacja w tej sesji):**

- G1: trzy zakresy powyżej nie mają wpisu w `docs/PROJECT_HISTORY.md`
  (dziennik kończy się na wersji „sesja porządkowa, bez zmian kodu”),
  a `HANDOFF_2026-09-09.md` §1 wymienia tylko F1/F2 i podaje nieaktualne
  „628 testów” oraz „`?v=m12-37` bez zmian”. Ten wpis zamyka lukę w dzienniku.
- G2: `README.md` §Status nie zna wariantu bez fact-check ani ekranu
  startowego („pięć ekranów: setup → …”), a `docs/ARCHITECTURE.md` §1 opisuje
  powłokę jako „setup → prompt → paczka → gra → wynik”. To dokładnie wzorzec
  z L31 (funkcja wchodzi/znika w UI, proza zostaje) — do poprawienia.

## 2026-09-09 (sesja bieżąca) — dwanaście zgłoszeń właściciela z terenu

Sesja realizacyjna na gałęzi `arena/01a08645-okolica` (PR #6). Właściciel zgłosił
uwagi z trzech środowisk: sandbox (B*), desktop na Pages (D*), realny iPhone (E*),
plus obserwacje z Google Drive (F*) i poprawki warstw (A*). Zgłoszenia E1/E2
były już zrealizowane w PR #5 (ekran startowy, smukła belka), B1 okazało się
szersze niż opis — poniżej stan po tej sesji.

**Zgłoszenie F1 — pliki `gra-hotseat-*` mnożyły się na Drive bez nowych gier.**
Przyczyna złożona z dwóch elementów: `oproznijKolejkeHotseat()` wysyła kolejkę
przy KAŻDYM starcie aplikacji (`app/app.js`), a `przyjmijGreHotseat()` w moście
zakładał nowy plik przy każdym żądaniu (`createFile(nazwaPlikuHotseat())` z nazwą
opartą o `Date.now()`). Jedna gra, której most kiedyś odmówił (starsza wersja
skryptu bez akcji `gra-hotseat`), przy każdym odświeżeniu zostawiała nowy plik.
Naprawa: `graHotseatDoWysylki` wysyła `odcisk` (FNV-1a z klucza gry), most nazywa
nim plik i nadpisuje istniejący. Brak odcisku (stara aplikacja) = zachowanie jak
dotąd. Commit `a41b0b7`.

**Zgłoszenia B1 i F2 — łapki nieaktywne, rankingi puste.** Diagnoza obaliła
pierwotną hipotezę. Kod trzymał się wąskiej litery ADR 0028 („oceny dotyczą
paczek z repozytorium”), a właściciel doprecyzował: *„Nie ma paczek, które nie
istnieją na Drive. Każda powinna móc być oceniona”*. Panel znikał, gdy paczka
była świeżo wygenerowana (leży w katalogu PRZEGLĄDU, a most przyjmował głosy
tylko dla ZAAKCEPTOWANYCH) oraz przy drugiej grze z pamięci telefonu (aplikacja
nie znała `id` pliku Drive). Naprawa po obu stronach: `paczkaJestWRepo` obejmuje
przegląd, `przyjmijKandydata` oddaje `id` także przy duplikacie, aplikacja
zapamiętuje parę skrót→id w `okolica:paczki-drive` (LRU 24). Aneks do ADR 0028.
Przy F2 rozdzielono też komunikaty pustego rankingu: „most nie ma gier” vs
„ta kategoria jest pusta” (L6). Commity `349984c`, `d8628cb`.

**Zgłoszenia A1–A3 — warstwy nad mapą.** Intro rozwinięte do czterech akapitów
z wyśrodkowanym tytułem `clamp(28px, 8vw, 40px)`; poprawiony podtytuł („gra
terenowa tam, gdzie akurat jesteś” — poprzedni miał błąd interpunkcyjny
i mylące znaczenie). Rankingi wchodziły pod belkę, bo `.warstwa` ma `inset: 0`,
a stałe 16 px nie mijało belki ~64 px — odstęp liczy się teraz od zmierzonej
`--wysokosc-belki`. Wszystkie trzy warstwy (rankingi, intro, setup) przyciemniają
mapę tym samym kolorem; setup jako karta dostał kożuch na `::before` `<body>`
z `pointer-events: none`. Commit `4d6984f`.

**Zgłoszenie D1 — brakujące kafelki na desktopie.** Też dwie przyczyny naraz:
`MAX_KAFELEK = 48` było MNIEJ, niż potrzebuje jeden ekran Full HD (1920×900
przy z16 = siatka 9×6 z marginesem = 54 kafelki), a przycinanie działało
row-major z `break`iem, więc ucinało płaski dolny pas i prawy brzeg. Sufit
podniesiony do 120 (nadal jeden ekran z zapasem, nie pobieranie hurtowe),
a przycinanie odrzuca teraz kafelki najdalsze od środka panelu. Nota
w `ASSETS.md` (L31). Commit `084f482`.

**Zgłoszenie F3 — stany ikon w belce.** ⚙ START GRY i 🏆 Rankingi zachowują się
jak 🔔 Sygnały: świecą przy otwartej warstwie, a klik w świecącą ikonę ją
zamyka. Stan liczy jedna funkcja `odswiezStanIkonBelki()` wołana ze wszystkich
przejść — rozsypanie tego po ścieżkach (przycisk, krzyżyk, Escape, „wróć”,
prywatność) dałoby ikonę świecącą nad zamkniętą warstwą. Commit `084f482`.

**Zgłoszenie B3 — pusta strona po „Wróć na początek”.** Zweryfikowane jako już
naprawione w PR #5 (`wrocNaPoczatek` → `pokazMapeStartowa`). Dołożony test
regresji, bo żaden nie pilnował tej ścieżki. Commit `084f482`.

**Zgłoszenie B2 — koniec odwracania liter (ADR 0033).** Właściciel: *„odwracanie
liter jest za trudne dla modeli AI i przekręcają przez to wyrazy (…) zostawmy
TYLKO kodowanie poprawnej odpowiedzi”*. Odwracanie znak po znaku jest dla modelu
zawodne (pracuje na tokenach), a reguła samokontroli z rev2 tego nie ratowała.
Nowe markery `PYT/1.0-rev4` (z fact-check) i `-rev5` (bez) — tekst zapisywany
normalnie, kod pozycyjny `poprawna` zostaje. Zgodność wstecz obowiązkowa:
walidator przyjmuje wszystkie markery, a odwracanie dekoduje tylko dla
rev1/rev2/rev3, bo takie paczki leżą na Drive. Szablony `PYT/1.0.7`
i `PYT/1.0-nofc.2`; schemat PYT bez zmiany wersji (kształt pól ten sam).
Commit `2af0ae7`.

**Brama na koniec:** `npm test` **673/673**, szablony zsynchronizowane,
WCAG AA 0 naruszeń. Cache-bust przeszedł `m12-40 → m12-43` (L29, razem
z `WERSJA_SW`) — trzy podbicia, bo każdy commit ruszał kod albo CSS.

**Ograniczenie weryfikacji tej sesji:** narzędzia podglądu w przeglądarce
(Chromium + puppeteer w `/home/user/.narzedzia/`) nie przetrwały resetu
workspace, a egress jest zablokowany (L3), więc nie dało się ich odtworzyć.
Zmiany wizualne (A1–A3, F3) sprawdzono testami kontraktu na CSS i analizą
kaskady, nie zrzutem ekranu — potwierdzenie wyglądu zostaje po stronie
właściciela. Serwer podglądu (`npm run serwer`, port 8000) był uruchomiony.

## 2026-09-09 (sesja trzecia) — pięć zgłoszeń właściciela z terenu + audyt PR #6

**Zlecenie:** pięć zgłoszeń: (1) setup — ikona select-all/deselect-all przy
„Tematy pytań" + usunięcie przycisku „Dane i prywatność" z ekranu 1; (2)
pauza 30 s między serwerami Overpass za długa; (3) ekran promptu — usunięcie
„Zapisz jako plik", nowe opisy trybu; (4) ponowne: pusta mapa po „Wróć na
początek" („za duży zoom, oddalenie pokazuje mapę"); (5) rankingi — po 8 s
timeout tabela pokazuje „Most Drive nie ma jeszcze ani jednej zakończonej gry"
(błąd = brak danych, nie pusty most).

**Audyt PR #6 (obowiązkowy, AGENTS.md §2):** PR #6 (`4168aa9`, main)
przeszedł bez uwag do logiki — jeden rozjazd dokumentacja↔kod: docblock
`progDojsciaM` w `app/geo.js` obiecywał przycisk „jestem na miejscu" (ADR 0004
pkt 5), którego ADR 0029 usunął 2026-09-08. Naprawiony w tej sesji.

**Co zrobiono:**

- **(1)** `index.html`: pod legendą „Tematy pytań" przyciski ⊞ wszystkie /
  ⊟ żadne; usunięty `#przycisk-prywatnosc` (dostęp ze stopki zostaje).
  `ustawWszystkieTematy` rusza cały kanon poza „Dopisz sam"; stan czytany
  wspólnym `tematyZListy` (children, nie querySelectorAll — LESSONS L19).
  Kontrakt pinuje brak przycisku; test zachowania skrótów.
- **(2)** `POLITYKA.odstepMs: 30_000 → 1_000` — krótka pauza grzecznościowa
  po 429/406/5xx; przełączenie po martwej instancji zostaje od razu.
  Aneks ADR 0005, ASSETS §2 pkt 3 (wiersz FOSSGIS = polityka trzeciej strony,
  nietknięty), ARCHITECTURE, piny testów. `?odstep=0` nietknięte.
- **(3)** usunięty `#przycisk-pobierz-prompt` + handler; `prompt-tryb-opis`
  mówi tekstami zlecenia słowo w słowo (poprzednie mieszały wersję szablonu
  w opisie dla gracza). `pobierzPlik` zostaje (PNG + eksport wyniku).
- **(4)** headless (2 pełne gry + dokładna sekwencja zgłoszenia: tap mapy na
  z19 jako pierwszy fix) — **nie odtwarza** pustej mapy: każdy szlak zooma
  clampuje do maxZoom podkładu, kafelki planowane w zakresie. Naprawiony
  mechanizm, który zgłoszenie tłumaczy: SW cache-first + opaque (status
  niewidoczny) — chwilowy 404/5xx serwera kafelków lądował w cache „kafelkiem"
  i był oddawany przy każdej następnej grze w tej okolicy (LESSONS L44).
  `sw.js` cache-uje opaque tylko gdy ciało dekoduje się jako obraz;
  `mapa.ustalibujWidok` w `rysuj()` wciąga widok w zakres zoomu podkładu
  (drugie dno pod hipotezą „silnik jeszcze przybliżał"). Uwaga do weryfikacji
  terenowej: jeśli pusta mapa wróci, wersja budowy w stopce + pasek skali na
  pustej mapie powiedzą, który to stan.
- **(5)** `STAN.rankingWiersze`: `null` = brak danych (pobieranie nie
  powiodło się / brak mostu / odpowiedź nieczytelna), `[]` = pusty most
  potwierdzony. Tabela i „Moje gry" przy `null` mówią „Wyniki nie zostały
  pobrane — komunikat w pasku stanu" i wprost, że to nie jest potwierdzenie
  braku gier. Porażka odświeżenia nie nadpisuje dobrych danych.

**Brama:** `npm test` 691/691 (bazowo 687), szablony zsynchronizowane
(`npm run check` w bramie), cache-bust `m12-51 → m12-52` (44 miejsca +
`WERSJA_SW`), LESSONS L44.

### Dopełnienie sesji (po otwarciu PR #7)

Audyt własnego PR #7 (protokół: audyt przed mergem) wychwycił trzy
niedokładności: `ustalibujWidok` przepuszczał `skala: Infinity` (dokładnie
stan „pustej mapy" — `ogranicz` i tak go leczy, wczesny return zabrany),
docblock `progDojsciaM` cytował ADR 0015 pkt 2 zamiast pkt 3–4, komentarz
przy „Zapisz jako plik" mówił o nieistniejącym „PNG podglądu stacji".
Dopisany test końcowego scenariusza zgłoszenia 4 na poziomie aplikacji:
pełna gra (symulacja GPS, 3 gracze) → „Wróć na początek" → mapa na spodzie
narysowana z kafelkami w zakresie zoomu podkładu. Brama: 692/692.

## 2026-09-10 — kontynuacja: audyt PR #7

Przeczytano lekturę startową; budżet 65 458/100 000. Bazowe `npm test`:
692/692. Audyt wszystkich 28 plików diffu `4168aa9..4acde1d`:

- F1: `ustalibujWidok` ogranicza skalę bez przeliczenia przesunięcia.
  `x/y` to piksele, nie środek geograficzny. Reprodukcja 360×640,
  52.23/21.01, z25 → z19: środek staje się -90/12684.64.
  Test utrwalał błędne oczekiwanie niezmienionego x/y. Do naprawy.
- F2: `Response.blob()` dla opaque ma pusty typ i rozmiar 0. Atrapa
  `image/png` w `test/sw.test.js` jest nierealistyczna; dobre kafelki
  no-cors nie trafiają do cache. L44 i ARCHITECTURE błędnie opisują
  możliwość sprawdzenia ciała opaque. Polityka cache wymaga rozstrzygnięcia;
  nie potwierdzono przyczyny pustej mapy na telefonie właściciela.
- F3: handoff kończy się na PR #5; README nadal opisuje usunięte wejście
  prywatności z setupu i import odpowiedzi z pliku. Do aktualizacji.
- Pozostałe zmiany: skróty tematów, rozróżnienie braku danych rankingu,
  opisy promptu i pauza Overpass odpowiadają zapisanym zleceniom; wersje
  importów i SW spójne (m12-52). Bez zmian schematu PYT.


### Wynik kontynuacji 2026-09-10

- F1 naprawiony (`ad3fefd`): clamp przez istniejące `zmienSkale`, zaczep
  w środku panelu. Test czerwony przed zmianą, następnie 692/692 zielone.
  Test geograficzny obejmuje wszystkie podkłady, pion i poziom, zoom niski,
  poprawny i za duży. Chromium 360×640: z25 → z19, środek 52.23/21.01
  bez zmiany, brak błędów JS.
- F2: usunięta pozorna inspekcja opaque. Cache tylko sukcesów basic/cors,
  opaque przekazywane bez zapisu; nie zmieniono trybu pobierania kafelków.
  Testy CORS 200/cache/ewikcja czerwone przed naprawą, zielone po niej;
  osobny test błędów CORS i realistycznego opaque. Chromium przy włączonej
  ochronie origin potwierdziło status 0, pusty typ i rozmiar 0 dla no-cors
  zarówno 200 PNG, jak i 404. Brak gwarancji podkładu offline opisany jawnie.
  Przywrócenie cache opaque pozostaje możliwą osobną decyzją, nie zadaniem
  realizowanym ukrytą zmianą polityki. L44 skorygowana, nie potwierdzamy
  historycznej hipotezy przyczyny pustej mapy użytkownika.
- F3: README po usunięciu importu odpowiedzi i wejścia prywatności z setupu;
  aktualny handoff `HANDOFF_2026-09-10.md`. Roadmapa nadal czeka na kryteria
  właściciela; sesja nie zalicza testów terenowych ani dwóch telefonów.
- Brama: 693 testy, synchronizacja obu szablonów, audyt kontrastu 0 naruszeń.
  Wersja końcowa m12-54. PR #8; żadnego scalenia do main.


### Uzupełnienie 2026-09-10 — uwagi z testu terenowego (ADR 0034)

- m12-55 / 9ab77c1: nowy setup 7/12/dorośli, Ciekawostki, brak Sportu/Jedzenia,
  porządek alfabetyczny; zgodność odczytu historycznych paczek i zapisów.
- m12-56 / db2219b: jeden fix ≤50 m otwiera pytania, accuracy bez wpływu
  na decyzję, komunikaty i mapę; granice 50/50.001 m w regresjach.
- m12-57: centralne warstwy setup/stacje/pytania, oko nie zatrzymuje procesów,
  mapy odłączone od ukrywanych paneli, informacje zamiast stopki. Bez pól
  współrzędnych, przycisku GPS i symulacji 250 m. Automatyczny GPS i testowy
  tap mapy zachowane. Zwinięta instrukcja oraz linki Meta/ChatGPT/Gemini.
- Brama 678 testów, zgodne szablony, audyt kontrastu 0 naruszeń. Stare testy
  celowo usuniętych kontrolek zastąpione regresjami nowego zachowania.
- Chromium 360×640, 320×568, 844×390: układ i przewijanie paneli, oko/mapa,
  instrukcja; dojście podczas podglądu i powrót do pytania. Zero błędów JS.
  Próby z fixture/fallbackiem sieci, nie potwierdzenie rzeczywistej gry terenowej.
- Handoff zaktualizowany; PR #8 bez scalenia, kryteria właściciela nadal otwarte.


### Korekta 2026-09-10 — dwa kolejne pomiary ≤50 m (m12-58)

Właściciel przyjął rekomendację potwierdzania dojścia drugim pomiarem i jawnie
potwierdził nierówność ≤50 m. Zmieniono domyślne kryterium geo/pozycja i tekst
startu odcinka, bez przywracania oceny accuracy. Regresje najpierw czerwone:
jeden fix nie wystarcza, dwa wystarczają, pomiar >50 m przerywa serię.
Poprzednie wdrożenie jednego fixa opisane wyżej jest zastąpione aneksem ADR 0034.

Weryfikacja m12-58: pełna brama **679 testów**, zgodne szablony i **0 naruszeń
kontrastu**. Testy rozgrywki i dojścia podczas podglądu mapy przechodzą.
Do potwierdzenia na telefonie pozostaje czas oczekiwania na drugi odczyt GPS.


## Overpass — m12-59 (ADR 0035)

Zgłoszenie: właściciel widział private.coffee/VK, nie FOSSGIS, a na końcu
`signal is aborted without reason`. Nie ustalono historycznej przyczyny.
Wdrożono FOSSGIS zawsze pierwszy (pamięć sukcesu porządkuje tylko rezerwy),
10 s na całą próbę z ciałem, QL timeout 8 s, sprzątanie timera w finally,
rozpoznawanie własnego timeoutu niezależnie od treści/nazwy błędu przeglądarki.
Brak nagłówków lub zatrzymane ciało nie blokują następnej instancji.
403/404 i wadliwy JSON także pozwalają przejść dalej; 400 nadal kończy próby.
Panel stacji pokazuje numer, nazwę i wynik wszystkich wykonanych prób;
postęp nie przykrywa listy, oko nie zatrzymuje pobierania.

Lista pozostaje trzyinstancyjna. Próba wskazanego overpass.openstreetmap.ru
z sandboxa: błąd TLS, HTTP 000; nie włączono niesprawdzonej rezerwy.
Nie potwierdza to globalnej awarii; nie dodano płatnych usług/kluczy.
Pełna brama: **683 testy**, zgodne szablony, **0 naruszeń kontrastu**.
Nowe testy obejmują nagłówki/ciało/nietypowy abort, kolejność i listę prób
oraz sukces rezerwy po HTTP 403. To atrapy, nie test publicznych serwerów
z telefonu. Preview na porcie 8000; odświeżyć do m12-59.
Gałąź `arena/01a08b96-okolica`, PR #8, bez merge. Następny krok właściciela:
sprawdzić na telefonie listę prób i zapisać wyniki, jeśli pobieranie zawiedzie.
