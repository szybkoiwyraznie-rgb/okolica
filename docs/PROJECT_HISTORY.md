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


## Korekta Overpass — m12-60

Właściciel odrzucił wymuszenie FOSSGIS i log na ekranie stacji. Przywrócono
ostatnią sprawną instancję jako pierwszą; pozostałe bez dubli. Szczegóły
prób wyłącznie w ⓘ Informacje, na stacjach ogólny postęp/błąd. Dodano wskazany
Adikso: `https://overpass.osm.adikso.net/api/interpreter` jako czwartą rezerwę,
która po sukcesie zyskuje pierwszeństwo jak każda inna. Limit 10 s bez zmian.
Próba HTTPS z sandboxa dała błąd TLS (HTTP 000), więc dostępność i CORS nie
są potwierdzone. Wdrożono próbę połączenia, nie gwarancję działania serwera.
Do sprawdzenia na telefonie. Aneks ADR 0035, ASSETS i prywatność aktualne.

Brama: **685 testów**, szablony zgodne, **0 naruszeń kontrastu**. Regresje
były czerwone przed zmianą. Sukces Adikso sprawdzono na atrapie, nie serwerze.
Przekazanie: ta sama gałąź `arena/01a08b96-okolica`, PR #8, bez merge.
Preview odświeżyć do m12-60; przy problemie odczytać wyniki z ⓘ Informacje.


## Ikonka Informacji — m12-61

Dodano `aria-pressed` synchronizowane z otwarciem panelu ⓘ, wykorzystujące
istniejący styl zaznaczenia ikon nagłówka. Zamykanie ikoną, krzyżykiem,
Escape lub przejściem do rankingów wygasza zaznaczenie; podgląd mapy nie
wyłącza panelu i zachowuje zaznaczenie. Regresja najpierw czerwona, potem
zielona. Pełna brama: 686 testów, szablony zgodne, 0 naruszeń kontrastu.
Przekazanie: ta sama gałąź i PR #8, bez merge; preview odświeżyć do m12-61.


## Nagłówek instrukcji — m12-62

Na życzenie właściciela etykieta: „Prompt dla modelu AI (KLIKNIJ żeby zobaczyć
instrukcję)”. Instrukcja nadal domyślnie zwinięta. Potwierdzono w HTML:
Meta AI, ChatGPT i Gemini mają target=_blank oraz rel=noopener noreferrer;
karta gry nie jest zastępowana. Brama: 687 testów, zgodne szablony,
0 naruszeń kontrastu. Przekazanie: ta sama gałąź, PR #8 bez merge;
preview odświeżyć do m12-62.


## Pasek podczas drogi — m12-63 / ADR 0036

W drodze centralny panel zastąpiony jednowierszowym paskiem przy dolnej
krawędzi: „Kto: Imię (125 m) · stacja 1 z 5”. Mapa nieprzygaszona; oko,
atrybucja i skala powyżej paska. Dotychczasowe sterowanie przenoszone jako
te same węzły do ⓘ Informacje (pauza, pominięcie, zakończenie, multi itp.).
Pytanie po dojściu automatycznie wraca do dużego panelu szerokości 90%,
zamyka Informacje; podgląd oka nadal zachowuje stan. Przygotowanie i wyniki
bez zmiany układu. Pauza nie zmienia paska w centralny panel.

Brama: **688 testów**, szablony zgodne, **0 naruszeń kontrastu**.
Chromium 360×640, 320×568, 844×390: pasek 37 px przy samym dole,
jedna linia, oko nad nim, brak scrolla strony; pauza i symulacja działają
z Informacji, dojście odsłania pytanie. Zero błędów JS. Próba z fixture,
nie test GPS w terenie. Narzędzia/screenshoty poza repo w /home/user/.narzedzia.
Przekazanie: ta sama gałąź i PR #8, bez merge. Preview na porcie 8000,
odświeżyć do m12-63; sprawdzić pasek i dojście na telefonie.
## Sesja 2026-09-10c — audyt PR #8 (gałąź arena/01a08d11-okolica)

Audyt scalonego PR #8 (squash `5614019`, 42 pliki, +1420/−1538), plik po pliku:

- **`app/geo.js`** — `progDojsciaM()` zwraca stałe 50 m (ADR 0034); `czyDotarl`
  liczy dwa kolejne trafienia ≤ 50 m, pomiar poza progiem przerywa serię.
  Zgodne z aneksem ADR 0034 (m12-58). Sygnatura traci parametr `accuracyM` —
  spójnie z ADR 0034 pkt 2 („accuracy nie bierze udziału"), który zastępuje
  filozofię „parametr zostaje na przyszłość" z aneksu ADR 0004.
- **`app/pozycja.js`** — usunięte stany `niedokladny`/`bezDokladnosci`, kod P05
  i pole `accuracyM` w wynikach; komunikaty odchudzone. Zgodne z ADR 0034 pkt 2
  (stare pola dokładności tolerowane przy odczycie — zapisy nie są przeliczane).
- **`app/konfig.js`** — `WIEK_SETUP` (7/12/dorośli), `TEMATY_SETUP`
  (alfabetycznie, z Ciekawostkami, bez Sportu/Jedzenia) + 
  `konfiguracjaNowegoSetupu` (10→12, 15→dorosli; usunięte tematy wypadają,
  puste tematy wracają do domyślnych). Zgodne z ADR 0034 pkt 1; kanon odczytu
  (WIEK/TEMATY) nietknięty — stare paczki i zapisy czytane dalej.
- **`app/sieci.js`** — czwarta instancja Adikso (ADR 0035 aneks), limit 10 s
  na próbę, QL 8 s, przełączanie po 403/404/406/429/5xx, 400 kończy;
  zapamiętana sprawna instancja pierwsza. Zgodne z ADR 0035 + aneks m12-60.
- **`app/mapa.js`** — `ustalibujWidok` przy clampie zoomu przelicza x/y wokół
  środka panelu przez `zmienSkale` (jak gest) — naprawia dryf środka mapy
  z audytu PR #7 / LESSONS L44. Podpis wymaga `rozmiar`; wywołanie w `rysuj()`
  przekazuje `stan.rozmiar`.
- **`sw.js`** — `czyTrafSieDoCache` przyjmuje wyłącznie sukcesy basic/cors;
  opaque pomijane (status 0, nieczytelne ciało — bez pozornej walidacji blob,
  korekta L44). Skutek jawny i udokumentowany: podkład offline nie jest
  gwarantowany (ROADMAP/handoff mówią to wprost).
- **`app/app.js` + `index.html` + `styles.css`** — centralny panel 90% nad
  przygaszoną mapą, oko (podgląd), stopka → ⓘ Informacje, sterowanie drogą
  przenoszone TYMI SAMYMI węzłami (ADR 0036), ekran pozycji bez GPS/ręcznych
  pól/symulacji 250 m, GPS automatyczny, tap mapy w trybie testowym przez
  `fixZPozycji(..., ZRODLA_FIXA.symulacja)`, instrukcja promptu zwinięta
  z linkami `target=_blank rel="noopener noreferrer"`. Zgodne z ADR 0034/0036.
- **Cache-busting** `?v=m12-63` jednolity w całym grafie (kontrakt pilnuje;
  LESSONS L29). `WERSJA_SW` podniesiona razem z `?v=`.
- **Testy** — nowy `test/teren.test.js` (granice 50/50,001 m, dwie trafienia,
  zerowanie serii, brak starych kontrolek, lista prób wyłącznie w Informacjach,
  nagłówek promptu); pozostałe zaktualizowane do nowych reguł. Bramka na main:
  **688/688 zielone** (potwierdzone na starcie sesji), szablony zgodne,
  audyt kontrastu **0 naruszeń**.
- **Dokumentacja** — PROTOKOL §4/§5 (kanon odczytu vs wybór setupu), ASSETS
  (Adikso, limity 10 s/8 s), ARCHITECTURE, ROADMAP, LESSONS (korekta L44),
  ADR 0034/0035/0036 + rejestr, HANDOFF 2026-09-10. Spójne z kodem.

Usterek blokujących brak. Uwagi (nieblokujące): drobna pusta linia po
`return` w `stanDojscia` (kosmetyka); warto pamiętać, że przy `accuracy`
ponownie pojawiającym się w przyszłych decyzjach sygnatura `progDojsciaM()`
jest już bez parametru — zmiana polityki wymaga jawnego ADR.




## Sesja 2026-09-10d — weryfikacja na żywo PR #8 + naprawa domyślnych tematów (m12-64)

Kontynuacja sesji `arena/01a08d11-okolica` (PR #9). Po audycie statycznym PR #8
przeszedł weryfikację dynamiczną: pełna pętla gry w headless Chromium 152
(360×640 i 844×390, `?test=true`, atrapa `fetch` odrzucająca URL-e poza
`location.origin` — wymuszona degradacja sieciowa; skrypty poza repo w
`.narzedzia/`). Potwierdzone na żywo, bez błędów JS:

- setup → 3 graczy (Drive pada → „gracz dodany bez potwierdzenia", ADR 0026
  pkt 5), tap mapy ustawia pozycję, Overpass pada → jawny **S03** i pierścień
  zapasowy, 3 stacje, prompt (instrukcja zwinięta), paczka przyjęta przez
  wklejenie, gra startuje automatycznie;
- pasek podczas drogi: 20 px tekstu w panelu 37 px (padding 8 px + safe area),
  przy dolnej krawędzi, „oko" nad paskiem, strona bez przewijania (nadmiar
  0 px), panel pytania 90% szerokości (324/360; karta wewnętrzna 290 px) —
  zgodnie z ADR 0036;
- pauza w ⓘ Informacje (ADR 0036), pasek zostaje po wznowieniu;
- 3 stacje przez symulację dojścia: pytanie → odpowiedź → wyjaśnienie →
  przycisk z etykietą kolejnego gracza („▶ Jan, stacja 2 — idę →"),
  po ostatniej „🏁 Zobacz wynik →" → ranking 3 graczy → „Nowa gra" wraca
  na mapę startową (ekran `mapa`), status „Gotowe do nowej gry", ⚙ prowadzi
  do setupu. Poziom 844×390: ten sam układ, panel 720 px.

**Usterka znaleziona i naprawiona** (przypadek brzegowy ADR 0034): stała
`DOMYSLNE.tematy` w `app/konfig.js` trzymała stary kanon 10 tematów (ze
`sport` i `jedzeniem`, bez `ciekawostek`). Skutk: migracja starego zapisu, z
którego po filtrze `konfiguracjaNowegoSetupu` nie zostaje żaden temat (np.
`tematy: ['sport']`), wrzucała fallback z usuniętymi tematami — organizator
nie widział ich w UI (brak chipów), a prompt + E16 wymagały pytań ze sportu
i jedzenia, więc każda paczka zgodna z nowym setupem byłaby odrzucona.
Do tego nowy temat „Ciekawostki" nie był domyślnie zaznaczony. Naprawa:
`DOMYSLNE.tematy` = alfabetyczna lista tematów NOWEGO setupu bez `wlasny`
(`architektura, ciekawostki, geografia, historia, kultura, legendy, ludzie,
nauka, przyroda`) — jest też fallbackiem w `oczyscKonfiguracje`, więc obie
ścieżki pustych tematów wracają do nowego kanonu. Test regresji dodany do
`test/konfig.test.js` (sam `sport` → nowe domyślne, bez sportu/jedzenia;
ciekawostki w domyślnych; `wlasny` nigdy domyślnie); asercja betonująca
stary kanon („decyzja z 2026-09-07") zaktualizowana do ADR 0034.
Potwierdzone na żywo (m12-64): chipy alfabetycznie, 9 tematów domyślnie
z Ciekawostkami.

Brama: **688/688** + audyt WCAG AA **0 naruszeń** (po naprawie), pełna pętla
UI w pionie i poziomie czysto na m12-64. Cache-busting `?v=m12-64`
(+ `WERSJA_SW`) podbity w całym grafie.


## Sesja 2026-09-11 — faktyczne tematy, limit listy i sort po ocenach (m12-65)

Zlecenie właściciela (trzy uwagi do karty „📦 Paczki dla tej okolicy"):

1. **Tematy wpisu = faktyczne tematy pytań.** Problem: paczka była odrzucana
   przy dopasowaniu, bo jej meta niosła listę tematów DOPUSZCZALNYCH w setupu,
   z którego powstała (model nie zawsze pisze pytania ze wszystkich
   dopuszczonych). Właściciel: „każde pytanie ma podaną kategorię, wystarczy
   to sprawdzić". Wdrożone: `faktyczneTematyPytan()` w `app/zestawy.js`
   (unikalne, kanoniczne, kolejność pierwszego wystąpienia) i `zbierzMetaZestawu`
   liczy `meta.tematy` z pytań (fallback na listę argumentu bez pytań albo
   przy pytaniach bez czytelnych tematów). Kryterium dopasowania bez zmian —
   poprawiły się dane. `metaBiezacejOkolicy`/`metaSesjiMulti` przekazują pytania
   sesji, więc nowy zapis lokalny i wysyłka na Drive niosą faktyczne tematy
   (most buduje indeks z meta pliku — `.gs` bez zmian). **Migracja** starego
   rejestru lokalnego przy starcie (`ujedgajnijTematyWpisowLokalnych`): wpis
   i pełny zapis przechodzą na faktyczne tematy, idempotentnie, cicho
   (LESSONS L10); wpis bez czytelnej paczki w pamięci zostaje jak był.
   Stare pliki na Drive: ponowna wysyłka paczki odświeża wpis.
2. **Limit listy: 3 paczki + „Zobacz więcej paczek"** (toggle ze „Zobacz mniej
   paczek"; przycisk chowany, gdy pasują ≤ 3). Lista rysuje się od zera
   (`renderujZestawy`), kandydaci (lokalne + repo) w jednej kolekcji.
3. **Sort: najpierw najlepiej oceniane** — największa liczba ocen pozytywnych
   (`oceny.plus`, ADR 0028), remisy rozstrzyga świeższa data. Paczki z tego
   telefonu nie mają ocen (żyją na Drive) — startują od zera.

Dokumentacja: ADR 0017 aneks 2026-09-11 (semantyka `meta.tematy` + lista),
README (kryteria i lista), LESSONS — bez nowej lekcji (wpis w duchu L45:
zmiana kanonu = przegląd stałych i asercji z datą).

Testy: +2 jednostkowe (`faktyczneTematyPytan`, `zbierzMetaZestawu` z pytaniami),
+3 UI (migracja szerokiego wpisu, limit/zwijanie na 5 paczkach, sort po
plusach z indeksem Drive) — **693/693** + WCAG AA **0 naruszeń**.
Weryfikacja na żywo (Chromium 152 headless, 360×640, m12-65): rejestr
z 5 paczkami o szerokich tematach [historia, przyroda, architektura, kultura]
i pytaniami tylko [historia, architektura] — po starcie migracja przeliczyła
wpisy, wąski setup (historia+architektura) dostał 3 widoczne propozycje
z faktycznymi tematami w opisach, „Zobacz więcej paczek" → 5 → „Zobacz mniej
paczek" → 3; zero błędów JS. Cache-busting `?v=m12-65` + `WERSJA_SW`.

Uwaga operacyjna: sandbox zresetował się między turami — narzędzia
(puppeteer, Chromium 152) odtworzone w `.narzedzia`, serwer na 0.0.0.0:8000.

## Sesja 2026-09-11b — uwagi terenowe #2 (m12-66)

Zlecenie właściciela po teście gry w terenie — siedem uwag do wdrożenia:

1. **Intro krótsze i zapraszające.** Podtytuł mówi teraz „…gdziekolwiek
   jesteś"; akapit o składzie gry skrócony („Grać można w pojedynkę, całą
   rodziną albo każdy na swoim telefonie."), a zdanie zamykające kończy
   się „…i ruszasz dalej." Usunięte akapity: „Potrzebujesz tylko zgody na
   dostęp do lokalizacji." (zgoda i tak wyskakuje przy pierwszym fixie)
   oraz „Przycisk wyżej otwiera ustawienia gry" (opis przycisku ⚙).
2. **Ekran pozycji bez instrumentów.** Wiersz o HTTPS i przycisk „🔌
   Sprawdź połączenie" (M9b/D4) znikają — most działa albo aplikacja sama
   mówi, że nie; ręczne sprawdzanie było ozdobnikiem.
3. **Ekran promptu bez wykładu o tokenach.** Akapit „Odpowiedź modelu
   będzie miała około…" (B21, `#prompt-rozmiar`) usunięty razem z logiką
   `szacunekOdpowiedzi` i stałymi budżetu (BAZA/PROG/TOKENY_NA_PYTANIE
   z protokołu). Wolimy uczyć się z uciętych paczek, niż straszyć liczbą.
4. **Gra: ekran pytania czysty.** (a) W fazie pytania slot sterowania
   (`#gra-slot-sterowanie` — nagłówek „Gra", badge'y, przyciski pomiń/
   pauza) jest schowany; panel multi żyje poza slotem. (b) Po kliknięciu
   odpowiedzi przyciski A–D ZNIKAJĄ zamiast się podświetlać — ocena,
   wyjaśnienie i źródła mówią wszystko; blokada „jednej odpowiedzi"
   zostaje wymuszona brakiem przycisków. (c) „Wznów grę" w fazie
   przygotowania od razu wchodzi w odcinek (droga + pasek), bez
   międzystrony „Idzie: … ▶ Idę do stacji…" — po zamknięciu przeglądarki
   gracz ma wracać PROSTO do gry.
5. **Pasek drogi mówi sam za siebie.** Format: `Kto: {imię} (odległość
   od stacji {N} m) · stacja {i} z {n}` — nawias z dystansem to zielona
   pigułka `span.pasek-dystans` (kolory akcentu, kontrast jak
   `.badge-dystans`). Sterowanie w drodze nadal w Informacjach.
6. **Usunięte ozdobniki stacji.** Przycisk „Tryb uproszczony" (pierścień,
   `#przycisk-pierścien`) i wiersz „sprawiedliwości" (`#stacje-
   sprawiedliwosc`) znikają z UI; stan `wymusPierscien` zostaje w silniku
   (ADR 0005) — to warstwa prezentacji, nie mechaniki.
7. **Pigułka dystansu.** — pokryta przez punkt 5 (brama WCAG bez zmian:
   te same zmienne akcentu co badge dystansu).

Struktura: `#gra-panel-multi` przeniesiony przed `#ekran-gra`, poza
`#gra-slot-sterowanie` — panel multi nie może znikać razem ze slotem
w fazie pytania (tury i tabela wyników zostają widoczne).

Testy: kontrakt pierścienia → asercja BRAKU przycisku; kontrakt M9b
usunięty; nowy kontrakt „usunięte ozdobniki 2026-09-11"; 2 testy
„Sprawdź połączenie" i test B21 usunięte; test A1 (intro) zaktualizowany
(akapit o zgodzie już nie istnieje); nowe asercje slotu/paska/odpowiedzi
+ test „wznowienie w fazie przygotowania" + test bramki 250 m. Atrapa
DOM: `querySelector` rozumie selektory klas (`.pasek-dystans`),
`textContent` agreguje węzły tekstowe z `append(tekst)` — jak prawdziwy
Element. **687/687** (było 693; -8 usuniętych, +2 nowe) + WCAG AA
**0 naruszeń**.

Weryfikacja na żywo (Chromium 152 headless, 360×640, tryb testowy,
m12-66): 29/29 asercji — intro i ozdobniki, mapa-podgląd → stuknięcie
→ pozycja testowa, stacje bez pierścienia, prompt bez tokenów, wklejona
paczka startuje grę, droga z paskiem i pigułką (computed style z tłem
akcentu), czysty ekran pytania (slot schowany), odpowiedzi znikają po
kliknięciu, „Następna stacja" wraca do drogi, przeładowanie w fazie
przygotowania → „Wznów grę" → od razu droga bez międzystrony; zero
błędów JavaScript.

Narzędzia: sandbox zresetował się ponownie — Chromium 152 odtworzony
z npm (`@sparticuz/chromium` binaria + biblioteki AL2023 do /tmp),
Puppeteer-core w `/home/user/.narzedzia` (poza repo). Google CDN
i apt (HTTP) niedostępne z sandboxa.

## Sesja 2026-09-11c — odporny link przeglądu w mailu (zgłoszenie #7)

Zgłoszenie właściciela: paczka po grze trafiła na Drive do katalogu
przeglądu, mail z przeglądem przyszedł, ale link z maila otwierał stronę
Google „Nie udało się otworzyć pliku. Sprawdź adres i spróbuj ponownie."

**Przyczyna (zewnętrzna, znana od 2020):** link przeglądu był budowany z
`ScriptApp.getService().getUrl()`, które Apps Script potrafi zwrócić źle —
adres `/dev` (widoczny tylko dla edytujących skrypt) albo adres STAREGO
wdrożenia po dodaniu nowej wersji. Oba otwierają się stroną błędu Google
zamiast stroną przeglądu (Stack Overflow 2020–2022, Issue Tracker).

**Naprawa w `docs/setup/apps-script-repo-paczek.gs`:**
1. `urlSerwisu()` najpierw czyta właściwość skryptu `URL_SERWISU`
   (właściciel wpisuje raz obecny adres `/exec`), a bez niej prostuje
   przynajmniej końcówkę `/dev` na `/exec`.
2. Mail z przeglądem niesie DROGĘ AWARYJNĄ: bezpośredni link do pliku
   na Dysku (`plikDrive.getUrl()`) i instrukcję ręcznej akceptacji
   (przeniesienie pliku między folderami — to samo robią przyciski).
3. `setup()` przypomina o brakujących właściwościach (OWNER_EMAIL,
   REVIEW_SECRET, URL_SERWISU) — bez nich paczka czeka po cichu albo
   mail prowadzi donikąd.

Instrukcja wdrożenia: krok 3.4 (URL_SERWISU po skopiowaniu adresu),
sekcja „Awaryjnie" z objaśnieniem komunikatu Google i ręczną akceptacją,
wpis aktualizacyjny dla działających wdrożeń.

Testy: +2 (`most-przeglad`) — właściwość URL_SERWISU wygrywa z `/dev`
z getUrl(); `/dev` bez właściwości jest prostowane; poprawny adres
przechodzi bez zmian; mail niesie link do pliku i nazwy folderów.
Atrapa mostu: `uruchomMost({ urlSerwisu })` parametryzuje `getUrl()`,
`apiPlik` ma `getUrl()`/`getName()` jak DriveApp.File. **689/689.**
Aplikacja i cache-busting bez zmian (m12-66) — poprawka dotyczy
wyłącznie skryptu Apps Script i jego wdrożenia.

Wdrożenie u właściciela: wkleić nowy `.gs`, dodać właściwość
`URL_SERWISU`, Wdróż → Nowa wersja; czekającą paczkę zaakceptować
ręcznie (przeniesienie pliku do `…-zaakceptowane`).

## Sesja 2026-09-11d — powódź plików gra-hotseat-* na Drive (zgłoszenie #8, drugie)

Zgłoszenie właściciela (ponowne, po fixie z 2026-09-09): w katalogu
`okolica-gry-zakonczone` dalej przybywają dziesiątki plików — po kilka
z jednej minuty, jakby każde odświeżenie aplikacji coś tam zapisywało.

**Dwie niezależne przyczyny, fix z 2026-09-09 (odcisk) nie mógł żadnej
powstrzymać, bo obie zmieniały tożsamość wysyłki:**

1. **Testy jednostkowe strzelały na PRODUKCYJNY most.** Node 22 ma
   globalny `fetch`, `zainstalujDom` go nie ruszał, a `adresMostu()`
   zwraca wpisany w kod adres wdrożenia. Testy kończące grę zdarzeniami
   i zweryfikowanym graczem („PEŁNA GRA z symulacją dojścia", „zgłoszenie
   4", „M7/P7: PEŁNA GRA z dojściem GPS", „M7: ręczne zakończenie — tekst
   wyniku") leciały prawdziwym POST-em `gra-hotseat` — w sandboxie
   developmentu Google był zablokowany (wiemy, bo czerwony test pokazał
   „fetch failed"), ale CI (GitHub Actions, ubuntu-latest) ma pełny
   internet: każdy run testów dokładał kilka plików z grami testowymi.
   Stąd „po kilka plików z jednej minuty".
2. **Wznowienie ZAKOŃCZONEJ gry wysyłało wynik drugi raz.** `wzrowGre`
   przy każdym wznowieniu przesuwa zegar (`r.startMs += przesuniecie`),
   a `kluczGryHotseat` liczy się właśnie z `startMs` — po odświeżeniu
   i „Wznów grę" (użytkownik chce tylko zobaczyć wynik) gra miała NOWY
   klucz, lista „wysłane" jej nie poznawała, odcisk dla mostu był inny
   → nowy plik. Każde odświeżenie = jeden plik więcej.

**Naprawa (m12-67):**
- `test/helpers/dom.js`: hermetyczna sieć — pierwszy `zainstalujDom`
  w procesie podstawia pod `globalThis.fetch` atrapę, która ZAWSZE
  odmawia (jak awaria sieci) i zapisuje próby (`dom.siec.wywolania`).
  Testy chcące odpowiedzi mostu podstawiają własne atrapy (świadomie
  je zastępują — rozpoznajemy po referencji do prawdziwego fetcha Node,
  złapanej przy imporcie). Suita nie może już wyjść na zewnątrz.
- `app/app.js`: `wznowGre` NIE przesuwa zegara dla gry w fazie `koniec`
  (zegar nie chodzi, rebasa była szkodliwa) — klucz/odcisk pozostają
  stabilne, lista wysłanych blokuje powtórkę, a most nadpisuje ten sam
  plik. Baner wznowienia mówi prawdę: „zapis ZAKOŃCZONEJ gry — możesz
  jeszcze raz obejrzeć wynik".

Testy: +2 — „sieć testów: fetch domyślnie hermetyczny" (atrapa odmawia,
własny stub testu wygrywa) i „odświeżenie i Wznów grę ZAKOŃCZONEJ gry
nie wysyła wyniku drugi raz" (naturalny koniec 3 stacji → kolejka 1;
dwa przeładowania z wznowieniem → kolejka nadal 1). **691/691.**

Weryfikacja na żywo (Chromium 152 headless, 360×640, tryb testowy,
m12-67, fetch mostu nagrywany przez przeładowania): pełna gra do
naturalnego końca = dokładnie JEDEN POST `gra-hotseat`; dwa przeładowania
+ „Wznów grę" = zero dodatknych POST-ów, kolejka pusta, baner „ZAKOŃCZONEJ",
zero błędów JS — **9/9 asercji**.

Dla właściciela: sprzątanie Drive (usuń testowe `gra-hotseat-*` — gracze
„Gracz 1/2/3", miejsce „nieznane miejsce") opisane w instrukcji mostu,
sekcja „Awaryjnie". Rankingi prostują się same po usunięciu śmieci.
Cache-busting `?v=m12-67` + `WERSJA_SW`.

## Sesja 2026-09-11e — korekty tekstu na ekranie Intro (m12-68)

Dopisek właściciela do zgłoszenia #8: w `okolica-gry-zakonczone` było
~80 plików, z czego RZECZYWISTYCH zakończonych gier — 2. Reszta ~78
„wygenerowała się bez zakończenia gry" — czyli dokładnie to, co wykazała
diagnoza z sesji 2026-09-11d: powódź pochodziła z testów CI (cztery testy
kończące grę prawdziwym POST-em na most) i ze wznowień zakończonych gier,
a nie z realnych rozgrywek. Skala 78:2 potwierdza, że hermetyczna sieć
testów + stabilny klucz wznowień zamykają temat; właściciel czyta Drive
według instrukcji z „Awaryjnie".

Korekty tekstu na ekranie Intro (prośba właściciela, dosłownie):
- podtytuł: „gra terenowa tam, gdziekolwiek jesteś" →
  „rozwiązuj zagadki, gdziekolwiek jesteś";
- zdanie o składzie: „Grać można w pojedynkę, całą rodziną albo każdy
  na swoim telefonie." → „Grać można w pojedynkę, z rodziną i znajomymi
  na jednym telefonie albo każdy na swoim urządzeniu." (doprecyzowanie,
  że tryb hasełkowy na JEDNYM telefonie to też pełnoprawny sposób gry).

Kontrakt intro w kontrakt.test.js zaktualizowany (podtytuł asertowany
teraz w pełnym brzmieniu — silniejsza asercja niż sama końcówka).
Cache-busting `?v=m12-68` + `WERSJA_SW`. Testy 691/691; żywy podgląd
Chromium 152 (360×640) potwierdza oba teksty i wersję w stopce.

## Sesja 2026-09-11f — podtytuł Intro, ostateczne brzmienie (m12-69)

Właściciel wrócił z trzecią wersją podtytułu (proces iteracyjny, wszystkie
dosłowne): „gra terenowa tam, gdziekolwiek jesteś" → „rozwiązuj zagadki,
gdziekolwiek jesteś" (m12-68) → **„gra terenowa gdziekolwiek jesteś"**
— powrót do „gra terenowa", ale bez „tam" i bez przecinka. Zdanie o
składzie gry z m12-68 bez zmian.

Kontrakt intro zsynchronizowany, cache-busting `?v=m12-69` + `WERSJA_SW`.
Testy 691/691; żywy podgląd potwierdza podtytuł i wersję w stopce.

## Sesja 2026-09-11g — P02 bez developerskiej wzmianki o trybie testowym (m12-70)

Właściciel: „Do prób bez GPS służy tryb testowy ?test=true i wskazanie
miejsca na mapie" w komunikacie błędu GPS (P02, brak zgody na lokalizację)
to nie informacja dla graczy — usunięte. Komunikat kończy się teraz na
wykonalnym wyjściu dla użytkownika: „Zezwól na lokalizację w ustawieniach
przeglądarki i odśwież stronę." Asercja w aplikacja.test.js zsynchronizowana
(wcześniej pilnowała właśnie wzmianki o trybie testowym — teraz pilnuje,
że wzmianki NIE ma i że wykonalne wyjście zostało).

Cache-busting `?v=m12-70` + `WERSJA_SW`. Testy 691/691.

## Sesja 2026-09-11h — panel pytania: odpowiedzi giną z WIDOKU, pauza nie kradnie oceny (m12-71)

Zgłoszenie właściciela z najnowszego preview (tryb testowy), dwa punkty:

1. **(4b) Odpowiedzi A–D nie znikały po odpowiedzi.** Kod chował je od
   m12-66 (`gra-odpowiedzi.hidden = true`), ale CSS `.gra-odpowiedzi
   { display: grid }` nadpisywał „display: none" z atrybutu [hidden] —
   reguły autora biją arkusz przeglądarki, więc przyciski zostawały na
   ekranie, a ocena nie „podnosiła się" w zaoszczędzone miejsce. Testy
   tego nie widziały, bo atrapa DOM nie liczy stylów. Ten sam błąd
   dotyczył `.ocen-panel { display: flex }` (kciuki 👍👎 zostawały
   widoczne bez paczki z repo). Naprawa: twarda reguła globalna
   `[hidden] { display: none !important }` w styles.css.

2. **„Niechciany layer": pauza wstawiała panel oczekiwania ponad oceną.**
   Po odpowiedzi gra jest już w fazie przygotowanie, ale panele trzymają
   ocenę do „Następna stacja" (M6/R5). Pauza — najczęściej AUTOMATYCZNA
   po zwinięciu okna/karty (visibilitychange) — wołała pełny renderujGre
   i on przełączał panele wg fazy: panel oczekiwania („▶ Idę do stacji 3,
   ⏭ Pomiń odcinek, ■ Zakończ grę") wyprzał ocenę, którą gracz czytał.
   Gore jeszcze: przycisk pauzy mieszka w panelu B (schowanym), więc
   z panelu A z zablokowanym startem nie było JAK wznowić — pułapka.
   Naprawa: renderujGre nie przełącza paneli, dopóki trwa pokaz oceny
   (wyjątek: ręczne zakończenie — wynik „teraz" ważniejszy); „Następna
   stacja" domyka pokaz, JAWNIE wznawia zegar (etykieta „⏸ Wznów grę
   i idź dalej →") i prowadzi w drogę jednym klikiem; o pauzie mówi
   komunikat ekranu gry.

Testy: „pauza w trakcie wyjaśnienia" przepisany na nowy przebieg
(ocena zostaje, panel A nie wskakuje, jeden klika wznawia + startuje).
**691/691.** Żywa weryfikacja Chromium 152 (360×640, m12-71): 18/18 —
display:none odpowiedzi na każdej stacji, ocena w zaoszczędzonym miejscu,
pauza nie wstawia layera, wznowienie+jedno kliknięcie w drogę, pełna gra
do końca, regresja #8 (JEDEN POST gra-hotseat), zero błędów JS.
Cache-busting `?v=m12-71` + `WERSJA_SW`.

Uwaga narzędziowa: CDP `Page.setWebLifecycleState('frozen')` wiernie
odpala visibilitychange, ale po odmrożeniu zostawia dławienie timerów
(symulacja 12 s ciągnie się >45 s) — weryfikacja pauzy woła tę samą
funkcję (`przelaczPauzeGry`) przez DOM-click przycisku pauzy.

## Sesja 2026-09-11i — koniec akceptowania paczek: od razu w zaakceptowanych (m12-72)

Decyzja właściciela (po fixie linku przeglądu z rana): „W ogóle rezygnujemy
z akceptowania paczek. Paczki od razu trafiają do zaakceptowane. O ich jakości
decydują łapki w górę i w dół, nie jest potrzebna ta sesja sprawdzania
właścicielskiego — to nic nie wnosi a tylko zajmuje czas." Cała procedura
akceptacji i maile o nowych paczkach zniknęły.

**Most (.gs):** przyjmijKandydata zapisuje plik OD RAZU w zaakceptowanych
(status 'zaakceptowana'); usunięte powiadomWlasciciela (maile), stronaPreglądu,
zatwierdz/odrzuc, esc, urlSerwisu, ustawienia oraz katalog
okolica-paczki-do-przegladu i właściwości OWNER_EMAIL/REVIEW_SECRET/URL_SERWISU.
Duplikat w zaakceptowanych → 'juz-zaakceptowana' (ten sam id — łapki ADR 0028);
duplikat w odrzuconych → 'juz-w-odrzuconych' (ręczne odrzucenie właściciela
obowiązuje dalej). Moderacja stała się późna i ręczna: przeciągnięcie pliku
do odrzuconych wyłącza paczkę z indeksu i zamyka głosowanie.

**Aplikacja:** status po wysyłce mówi „dostępna od razu w zestawach — jakość
rozstrzygną łapki graczy"; znacznik meta przegladZrodel bez „właściciela"
(„oczekuje przeglądu — jakość rozstrzygają łapki graczy").

**Testy:** most-paczka/most-przeglad/most-oceny/most-indeks przerobione na nowy
przepływ (strażnik: zero maili, brak strony przeglądu w moście, akcja=przeglad
→ nieznana); kontrakt ADR 0028 aneks zsynchronizowany + NOWY test kontraktu
decyzji 2026-09-11 (MailApp/stronaPrzegladu/zatwierdz/katalog przeglądu/
REVIEW_SECRET/URL_SERWISU nie istnieją w .gs). 691/691.

**Dla właściciela (wdrożenie ręczne):** wkleić nową treść .gs i Wdróż → Nowa
wersja; na Drive przenieść zaległości z do-przegladu i skasować ten katalog;
właściwości skryptu można usunąć — wszystko opisane w instrukcji mostu
(sekcja „Awaryjnie"). Katalog odrzucone ZOSTAJE jako ręczny kosz (wyłączanie
paczek z indeksu). ADR 0017 doczekał się aneksu.

## Sesja 2026-09-11j — gra wieloosobowa przepisana: Wspólna Trasa + Wyścig, paczka przed lobby, solo (m12-73)

Właściciel poległ na pierwszym ekranie gry wieloosobowej i zarządził przepisanie
trybu od zera. Pełne decyzje (konsultacje tego samego dnia) w aneksie ADR 0019
z 2026-09-11; w skrócie:

- **Tryb „tury" USUNIĘTY** wszędzie (UI, app.js, wieloosobowa.js, sync.js, .gs,
  testy): nie ma właścicieli stacji ani kolejki; `biezacyGraczTury` zniknęło
  z modułu i mostu; polling wspólny (lobby 10 s, gra 12 s).
- **Dwa tryby**: `trasa` = Wspólna Trasa (ta sama trasa PO KOLEI, każdy we
  własnym tempie, bez listy wyboru) i `wyscig` = Wyścig na Orientację (dawny
  wyścig, dowolna kolejność — logika bez zmian, uczciwy opis). Punktacja
  wspólna, jedno zdanie w UI: 1 pkt za dobrą odpowiedź + premia za kolejność
  ukończenia. Oba tryby domykają się tak samo (każdy zamyka wszystko albo
  rezygnuje) — `czyKompletna` bez gałęzi tur.
- **Trasa-sekret**: mapa gry pokazuje tylko bieżącą stację; przy generowaniu
  paczki dla trasy ekran stacji pokazuje SAM STATUS („wygenerowano N"), bez
  nazw, współrzędnych i kropek na mapie (`STAN.ukryjStacje`).
- **Paczka PRZED lobby** (nowy przepływ): pseudonim → „🌐 Załóż grę w tej
  okolicy" → tryb → źródło: sesja / telefon / Drive / **✨ Wygeneruj pytania
  w AI** (pełna ścieżka pozycja → stacje → prompt → wklejenie; po przyjęciu
  paczki WRÓT do panelu „Załóż grę", nie do gry hot-seat — `STAN.multiPoPaczce`).
  Lista źródeł nigdy niepusta (AI zawsze), statusy jawne (wynik szukania
  na Drive doklejany do linii źródeł).
- **Start gry od 1 gracza** (solo) — dozwolony i zakomunikowany w lobby.
- Z ekranu multi usunięto zdanie „Na serwer jadą wyłącznie pseudonimy…"
  (index.html) — zachowanie bez zmian (biała lista pól + kasowanie po stronie
  mostu + SKANER dalej pilnują).

**Wdrożenie .gs:** linia trybu w `bledyGryKandydata` (`trasa`|`wyscig`),
usunięte `biezacyGraczTury` i kontrola tury w `przyjmijZdarzenie`, gałąź tur
w `czyKompletna`. Kontrakt `RO-gra/1` zmienia tylko domenę `tryb` (R04);
stare pliki gier z `tryb: "tury"` są nieczytelne dla nowej wersji (jak każda
wersja aplikacji).

**Testy:** wieloosobowa-ui — e2e trasy (wspólna trasa, tempo własne, resume,
sekret), NOWE: start solo i pełna ścieżka AI przed lobby (trasa-sekret na
ekranie stacji, powrót z paczką, lobby z sesji); wieloosobowa — czyKompletna
bez tur; sync — jeden rytm; most-gra-cycle — cykl Wspólnej Trasy (odpowiedź
bez dojścia i duplikat jako odmowy R08); rankingi-ui — etykieta trybu.
Kontrakt M11 pilnuje nowych nazw trybów, zdania o punktacji, braku zdania
o serwerze i ścieżki AI. **691/691.**

**Dokumentacja:** aneksy ADR 0019 (pełne decyzje) i ADR 0027 (koniec tur),
PROTOKOL §9 (domena tryb, R04), ARCHITECTURE (sync, silnik lokalny), README,
WORKFLOW §4.4 pkt 5, instrukcja mostu §5b, indeks ADR.

## Sesja 2026-09-11k — multi po raz drugi: setup zamiast ekranu, lista ~50 m, kanał info, koniec z ręki hosta (m12-74)

Właściciel przetestował m12-73 i przeprojektował flow: „wykorzystujemy wspólne
layery, tylko zakres opcji się zmienia". Decyzje (odpowiedzi 1A–4A) w aneksie
ADR 0019 z m12-74; w skrócie:

- **Segmenty na setupie**: toggle „Hot-seat / Wielu graczy" jak środek
  transportu; w multi dosiada się „🚀 Zakładam nową grę / 🚪 Dołączam do
  istniejącej". Ekran `multi-panel-zaloz` (tryb + źródła + „Zakładam")
  ZNIKNĄŁ — tryb gry i ptaszek „widoczna tylko kolejna stacja" (własność gry
  `trasaSekret`) wybiera się na setupie. Język i podkład usunięte z UI
  wszędzie (ADR 0037: hardcode polski + OSM).
- **Multi-załóż = zwykły setup**: zostaje środek, czas, liczba stacji, wiek,
  tematy, pozycja; **pytań na stację BRAK** (1 pytanie/stację, forsowane),
  promień jak w hot-seat; **dokładnie JEDEN gracz na telefon** — host wpisuje
  imię+PIN w zwykłym bloku „Kto gra?" (odpowiedź 1A; limit 1 z jawną odmową
  przy drugim). Dalej WSPÓLNA ścieżka: pozycja → pasująca paczka PROSTO
  do lobby (albo stacje → prompt → wklejenie → lobby). `sciezkaAiMulti`
  i lista źródeł usunięte.
- **Dołączanie tylko z listy** (4A): kod gry i `przycisk-dolacz-kod`
  USUNIĘTE; lista pokazuje wyłącznie `stan: "lobby"` (brak dołączania po
  starcie, odpowiedź 2) w zasięgu ~50 m od hosta (miarą `konfiguracja.geohash8`
  ~40 m + sąsiedzi), wpis mówi tylko „Host: Jacek".
- **Kanał info** `#multi-info`: dojścia, dobre/złe odpowiedzi, rezygnacje,
  koniec — neutralne płciowo, ostatnie ~8 zdarzeń. Polling w grze co 30 s
  (3A), lobby 10 s.
- **Host kończy grę przyciskiem** (`gra-zakoncz`, tylko organizator i tylko
  `stan: "trwa"`): u wszystkich podsumowanie + ranking. Koniec naturalny bez
  zmian (wszyscy aktywni domknęli stacje).
- **Premia stała 3/2/1** za 1./2./3. miejsce ukończenia (aneks ADR 0027);
  ukończone PRZED przedwczesnym końcem liczy się też. Reguła lustrzana
  w `.gs` (`most-gra.test.js` ją wykonuje).

**Wdrożenie .gs:** `gra-zaloz` przyjmuje `trasaSekret` i wymaga
`geohash8`; `listaGier` zwraca tylko `lobby` z `geohash8` we wpisach; nowa
akcja `gra-zakoncz` (host); premia [3,2,1]; stara premia G−1 usunięta.
Kontrakt `RO-gra/1`: opcjonalne `trasaSekret` (brak przy `trasa` = sekret),
wymagany przy zakładaniu `konfiguracja.geohash8` (odczyt — opcjonalny).

**Testy:** wieloosobowa-ui.test.js PRZEPISANY w całości (16 testów: e2e
wyścig/trasa/solo, paczka przed lobby, bez-gracza odmowa + zero żądań,
ADR 0020 pusty adres, R08 payload+geohash8, SKANER geohash8, uszkodzony stan
R07, host-zakończ z premią, wolna kolejność/mniejsza paczka/trasa-bez-wyboru,
ADR 0032 Q/notka); wieloosobowa — premia 3/2/1 (3 testy); sync — interwały
30 s/10 s; most-gra — geohash8+trasaSekret+lobby-only+premia; most-gra-cycle —
cykl nowego flow; kontrakt M11+m12-74; aplikacja — język/podkład zaszte;
konfig — K04/K06 usunięte, JEZYK_GRY import. Pułapki przepisywania: atrapa
DOM nie grupuje radiów (helper `wybierzSegment` odznacza ręcznie), helper
`dom.js` sieje gracza „Ala" (testy multi zawsze `bezGracza: true`), K10
wymaga ≥3 stacji. **692/692.**

**Dokumentacja:** aneksy ADR 0019 (m12-74) i 0027, NOWY ADR 0037 (język
i podkład zaszte), rejestr ADR, PROTOKOL §9 (trasaSekret, geohash8,
lobby-only, premia 3/2/1, 30 s), ARCHITECTURE (setup-multi, sync, info,
koniec hosta), README, WORKFLOW §4.4 (9 punktów), instrukcja mostu §5b
+ dopisek „Awaryjnie".


## Sesja 2026-09-11l — audyt PR #9 (gałąź arena/01a09256-okolica)

Audyt scalonego PR #9 (squash `0b81d0d`, 49 plików, +2719/−1355) wg procedury
AGENTS.md §2 / ADR 0012: `git diff 0b81d0d^..0b81d0d` plik po pliku, reguły
z docs/PROTOKOL.md i odpowiednich ADR-ów, brama testów na mainie.

**Zakres i kamienie (m12-64 → m12-74, jednolite `?v=` + `WERSJA_SW`):**
- **m12-64** — `DOMYSLNE.tematy` na kanon nowego setupu (alfa., z Ciekawostkami,
  bez Sportu/Jedzenia/`wlasny`) + fallback pustych tematów z tej samej stałej;
  znaleziona w weryfikacji na żywo; regresja w `konfig.test.js`; **LESSONS
  L45** (kanon ⇒ domyślne zaznaczenie ⇒ asercje z datą).
- **m12-65** — meta paczki = FAKTYCZNE tematy pytań (`faktyczneTematyPytan`,
  `zbierzMetaZestawu(pytania)` z fallbackiem), migracja rejestru
  `ujedgajnijTematyWpisowLokalnych` (idempotentna, try/catch — L10); lista
  „📦 Paczki dla tej okolicy" zwinięta do 3 najlepszych + toggle; sort:
  `oceny.plus` desc → data desc. Anekse ADR 0017.
- **m12-66 (uwagi terenowe #2)** — Intro krótsze; ekran pozycji bez wiersza
  HTTPS i przycisku „🔌 Sprawdź połączenie"; ekran promptu bez `#prompt-rozmiar`
  (usunięte `szacunekOdpowiedzi` + stałe BZA/PROG/TOKENY z `protokol.js`);
  slot sterowania chowany w fazie pytania; panel multi przeniesiony PRZED
  `#gra-slot-sterowanie`; odpowiedzi A–D chowane po kliknięciu; „Wznów grę"
  skacze prosto w odcinek; pasek drogi z pigułką `.pasek-dystans`; usunięte
  `przycisk-pierścien` i `#stacje-sprawiedliwosc` (stan `wymusPierscien`
  zostaje w silniku, bez przełącznika).
- **m12-67** — powódź `gra-hotseat-*`: hermetyczny `fetch` w `test/helpers/dom.js`
  (Node 22 miał globalny fetch → testy krążyły po PROD. moście; CI GitHub
  Actions ma internet) + `wznowGre` bez rebazy zegara dla gry w fazie `koniec`
  (stabilny klucz/odcisk → most nadpisuje ten sam plik). Baner „zapis
  ZAKOŃCZONEJ gry". Nowa hermetyka weryfikowana testem-skryptem.
- **m12-68/69/70** — podtytuł i zdanie o składzie Intro; P02 bez wzmianki
  o trybie testowym.
- **m12-71** — globalne `[hidden] { display: none !important }` (`.gra-odpowiedzi
  {display:grid}` biło atrybut); pauza (najczęściej automatyczna) nie wyprze
  oceny: `renderujGre` nie przełącza paneli przy `pokazOceny` (wyjątek: ręczne
  zakończenie); „Następna stacja" jednym klikiem wznawia zegar i startuje drogę.
- **m12-72 (koniec moderacji wstępnej)** — `.gs`: paczka OD RAZU w
  zaakceptowanych (statusy `zaakceptowana` / `juz-zaakceptowana` /
  `juz-w-odrzuconych`); usunięte maile, strona przeglądu, tokeny OWNER_EMAIL/
  REVIEW_SECRET/URL_SERWISU i katalog do-przegladu; kontrakt decyzji w testach.
  Aneks ADR 0017, instrukcja mostu przerobiona, AGENTS.md (sekretów nie ma).
- **m12-73/74 (multi po raz drugi)** — tryb „tury" usunięty (`biezacyGraczTury`,
  kontrola tury w moście, rytmy 10/30); tryby `trasa` (Wspólna Trasa, po kolei,
  `trasaSekret` — mapa gry tylko bieżąca stacja, przy generowaniu `ukryjStacje`)
  i `wyscig` (Wyścig na Orientację, lista wyboru); `czyKompletna` bez gałęzi
  (każdy aktywny zamyka wszystko); PACZKA PRZED LOBBY przez WSPÓLNĄ ścieżkę
  (`multiPoPaczce` → `zalozGreMulti`); start solo od 1 gracza; rodzaj gry i
  ścieżka multi jako segmenty na setupie; dokładnie JEDEN gracz na telefon
  (imię+PIN z „Kto gra?", limit z odmową); pytań na stację w multi = 1
  (pole schowane, promień jak w hot-seat); dołączanie TYLKO z listy:
  most zwraca wyłącznie `stan:"lobby"`, filtr `geohash8` hosta + sąsiedzi
  (~50 m), wpis tylko „Host: X", kody usunięte; kanał `#multi-info`
  (dojścia/odpowiedzi/rezygnacje/koniec, ostatnie ~8, neutralne płciowo);
  polling w grze 30 s; host kończy grę `gra-zakoncz` (tylko organizator,
  stan „trwa", idempotencja na zakończone) — premie liczą się też przy
  przedwczesnym końcu; premia STAŁA 3/2/1 (lustro app↔.gs pilnowane
  `most-gra.test.js`); język polski i podkład OSM zaszyte (NOWY ADR 0037,
  K04/K06 usunięte, `JEZYK_GRY`, `oczyscKonfiguracje` forsowane).

**Zgodność z protokołem i ADR-ami:** PROTOKOL §9 zsynchronizowany z kodem
(`trasaSekret`, `geohash8`, lobby-only z mostu, solo, premia 3/2/1, R04,
30 s/10 s); schematy `RO-*` bez `zgoda` (SKANER trzyma); `RO-lobby/1` bez
kodów i bez zestawów ✓. Anekse ADR 0017 (×2), 0019 (×2), 0027 (×2) i NOWY
0037 odzwierciedlają wdrożenie 1:1 (miejsca wymienione z nazwy — lustra
premii, hipoteze fallbacków, zgodność wsteczna starych gier: brak
`trasaSekret` przy `trasa` = sekret, odczyt `geohash8` opcjonalny).
`gra-zakoncz` na moście: organizator-only + bez zmian dla zakończonej/archiwum.
`paczkaJestWRepo` = tylko katalog zaakceptowanych; duplikat w odrzuconych
nie tworzy pliku (ręczna decyzja właściciela trwa). Migracja tematów
idempotentna i cicha (L10). Cache-busting `?v=m12-74` jednolite
(kontrakt); `WERSJA_SW` w parze.

**Bramy (na mainie, rano dnia audytu):** `npm test` **692/692** (67 s),
`node tools/audyt-kontrastu.mjs` **0 naruszeń** WCAG AA, szablony promptów
PROTOKOL ↔ `app/protokol.js` zgodne (kontrakt), hermetyka sieci testów
potwierdzona mogącym wyjść skanem. Liczba testów pokrywa historię
(oś 687→692; +5 z m12-73/74: nowe e2e wyścig/trasa/solo, odmowa bez gracza,
host-zakończ, 250 m propozycje, kontrakty decyzji).

**Znalezisko nieblokujące → rekomendacja poprawki (cicha usterka):**
1. **Ranking „Moje gry" filtruje po kluczu, którego nic już nie zapisuje.**
   `renderujRankingi` czyta `localStorage 'okolica:pseudonim'`
   (`KLUCZ_PSEUDONIMU`), a pole `multi-pseudonim` usunięto w m12-73/74 —
   żadna ścieżka go nie zapisuje. W drugą stronę `KLUCZ_OSTATNIEGO_GRACZA`
   (`okolica:ostatni-gracz`) jest tylko ZAPISYWANY (przy dodaniu gracza
   w „Kto gra?"), ale NIGDY nie odczytywany — komentarz przy stałej mówi,
   że to ON filtruje „Moje gry". Skutek: każdy, kto zagra pierwszą grę multi
   od m12-74, ma zakładkę „Moje gry" na zawsze pustą, a komunikat odsyła go
   do nieistniejącego pola pseudonimu. Naprawa (w przyszłej sesji roboczej,
   decyzja właściciela): czytać najpierw `KLUCZ_OSTATNIEGO_GRACZA` z
   fallbackiem na `KLUCZ_PSEUDONIMU` i przeredagować pusty stan (blok
   „Kto gra?" jako miejsce gwarantujące imię).

**Niespójności dokument ↔ kod (wzorzec L31, nieblokujące — do sprzątnięcia przy następnej sesji dokumentów):
2. `docs/PROTOKOL.md` §2.1 (B21): „Stałe szacunku żyją w `app/protokol.js`…
   a ekran promptu podaje przewidywany rozmiar odpowiedzi" — funkcję i UI
   usunięto (m12-66, świadomie). Nagłówek `test/duza-paczka.test.js`
   (wiersz „spinają pomiar, żeby stałe szacunku nie rozjechały się") również
   od m12-66 opisuje nieistniejące stałe.
3. `README.md`: (a) sekcja M4 — „przycisk ◎ Tryb uproszczony (pierścień)"
   i „miara sprawiedliwości widnieje pod listą" (usunięte); (b) sekcja
   wysyłki — „Właściciel akceptuje kandydatów linkiem z e-maila" / „na Drive
   do przeglądu właściciela" (koniec moderacji) ORAZ „przycisk 🔌 Sprawdź
   połączenie" (usunięty).
4. `docs/WORKFLOW.md`: krok 3 „◎ Tryb uproszczony" (usunięty), krok 4 „Linia
   pod promptem mówi, jak duża będzie odpowiedź" (usunięte), krok 5 „na Drive
   do przeglądu" (moderacja zniesiona).
5. `docs/ARCHITECTURE.md` (kontrakt testy): „przyciski degradacji
   (`przycisk-pierścien`, `przycisk-reczne`)" — pierścień zniknął z DOM,
   kontrakt asertuje teraz jego BRAK.
6. `docs/decisions/0031.md` „co zostaje z B21" (szacunek + `#prompt-rozmiar`)
   i `docs/decisions/0020.md` pkt 2 („przycisk 🔌 Sprawdź połączenie
   zostaje") oraz administracyjne wzmianki ADR 0016/0018 — brak aneksów;
   decyzje zmienione w m12-66/72 powinny dostać aneks zamiast cichego
   obejścia.
7. `docs/decisions/0037.md`: „`zmienPodklad` usunięte z `app.js` jako martwe"
   — funkcja pozostała (app.js:1186), bez wywołań (martwa, ale obecna).
8. `app/app.js`: stała `wymusPierscien: false` w STAN — bez przełącznika
   zawsze false (podtrzymane świadomie zgodnie z historią m12-66; warto przód
   umyć jak u `zmienPodklad` albo literalnie komentarz „bez UI").
9. Literówka w ADR 0017 (aneks 2026-09-11): „życią na Drive" → „żyją".

Brak usterek blokujących grę, kontrakt RO-* ani zasady prywatności. PR czyta
się jako trzy fale: stabilizacja terenowa (m12-64…71), koniec moderacji
(m12-72), przepisanie multi (m12-73/74) — z dokumentacją prowadzoną na
bieżąco w aneksach i dyscypliną wersjonowania. Uwagi 1–9 przekazane
właścicielowi do decyzji (propozycja: jeden commit docs-only + fix
punktu 1 w kolejnej sesji roboczej).

## Sesja 2026-09-12 — blok startowy i audyt PR #12 (gałąź arena/01a09489-okolica, PR #13)

**Zlecenie właściciela:** „Kontynuujemy projekt. Przeczytaj obowiązkową
lekturę, otwórz nowy PR, wypchnij plan i zatrzymaj się, przekażę ci zadanie."
Sesja wykonała blok startowy i zatrzymała się przed pracą merytoryczną —
zadanie ma przyjść od właściciela.

**Lektura obowiązkowa (AGENTS.md §0, całe pliki):** `AGENTS.md` 186 l.,
`docs/PROTOKOL.md` 642 l., rejestr + 37 ADR-ów 0001–0037 (3 286 l.),
`docs/LESSONS.md` 618 l. (L1–L45), `docs/setup/ENVIRONMENT.md` 167 l.,
`docs/ROADMAP.md` 61 l., `docs/setup/HANDOFF_2026-09-10.md` 157 l.
Budżet (`npm run budzet`): 71 641 / 100 000 tok — rezerwa 28 359.

**Bramy na mainie `b3430c5` przed zmianami:** `npm test` 692 pass / 0 fail
(~68 s), `npm run check` — oba szablony zgodne (§2: 4 209 zn. / 61 l.,
§2.2: 4 457 zn. / 62 l.), `npm run audyt` — 0 naruszeń WCAG AA. Cache-busting
`?v=m12-74` w 42 miejscach, `WERSJA_SW = 'm12-74'` — spójne (kontrakt).

**Audyt poprzedniego scalonego PR #12** (squash `b3430c5`) wg AGENTS §2 /
ADR 0012: po `git fetch origin main --depth=50` (klon płytki, ENVIRONMENT §3)
`git diff b3430c5^..b3430c5` = **1 plik, +129 linii** — wyłącznie sekcja
„Sesja 2026-09-11l — audyt PR #9" w tym dzienniku. Zero zmian w kodzie.

Weryfikacja merytoryczna faktów z tego wpisu (nie tylko jego lektura):

- liczby bram odtworzone na bieżącym mainie: 692/692, 0 naruszeń kontrastu,
  szablony zgodne — **wszystkie trzy potwierdzone**;
- znalezisko 1 (ranking „Moje gry") **potwierdzone grepem**:
  `KLUCZ_PSEUDONIMU` (`okolica:pseudonim`) czytany w `app/app.js:4746`
  i `:4830`, a żadna ścieżka w `app/` go nie zapisuje (zapisuje tylko atrapa
  `test/rankingi-ui.test.js:45`); `KLUCZ_OSTATNIEGO_GRACZA`
  (`okolica:ostatni-gracz`) zapisywany w `app/app.js:698`, nigdy nieczytany;
- uwaga 7 **potwierdzona**: `zmienPodklad` nadal w `app/app.js:1186`,
  bez wywołań (martwa), mimo zapisu ADR 0037 o jej usunięciu.

**Werdykt:** PR #12 zgodny z procedurą (audyt jako jedyna treść), fakty w nim
podane trzymają się kodu. Usterki 1–9, które ten wpis OPISUJE (pochodzące
z audytu PR #9), pozostają otwarte; plan sesji trzyma je w kolejce roboczej
(fix rankingu + jeden commit docs-only na klaster L31) do czasu zlecenia.

**Stan:** kod nietknięty; jedyna zmiana tej sesji to plan
`docs/plans/2026-09-12-sesja-startowa.md` oraz ten wpis. Brak handoffu
końcowego — sesja trwa i czeka na zadanie właściciela.
## Sesja 2026-09-12b — odzyskanie sesji #12, poprawki właściciela, audyt multi, polityka kafelków OSM (m12-75 → m12-81)

**Gałąź:** `arena/01a09489-okolica`, PR #13. **Zlecenie właściciela (2026-09-12):**
(1) przenieść do repozytorium zmiany poprzedniej sesji (#12, sesja urwana — patch
`01a09256-…` wgrany przez właściciela jako `5aadacb`), sprawdzając każdą zmianę
względem jego listy poprawek (1, 2, 3a–3e, 4a–4j) i względem sensu; (2) dokończyć
punkt 4j i zrobić dogłębny audyt, czy CAŁY pierwotny pomysł gry wieloosobowej
został wprowadzony poprawnie — „a jeśli brakuje albo są błędy to dodaj to i napraw".

### 1. `77dfe93` — salvage sesji #12 (m12-75)

33 pliki, +507/−530. Każda zmiana z patcha sprawdzona z listą właściciela:
**zrobione** 1 (brak wyboru języka i podkładu — `JEZYK_GRY='polski'`, `osm`
wymuszone w `oczyscKonfiguracje`, kody K04/K06 usunięte), 2 (fallback
Nominatim/geokodowanie wycięty w całości), 3a–3e (setup multi: dokładnie jeden
gracz, bez „Poprzednie gry", wszystkie tematy poza „Dopisz sam" zaznaczone,
„Dalej" zamiast osobnej bramki, lista graczy = tożsamość), 4a–4i (trasa-sekret,
lobby dopiero po wklejeniu paczki, wpisy „Host: <imię>", kanał info, koniec gry
z ręki hosta, premia 3/2/1 po obu stronach, polling 30 s/10 s).
**Nie zrobione: 4j** (rankingi) — właściciel potwierdził w kolejnej wiadomości:
„tak, usuwamy też rankingi z mostu".

Brama po salvage: **689 pass / 0 fail**, 0 naruszeń WCAG AA (main: 692;
−3 = usunięte testy fallbacku Nominatim). `?v=m12-75` ×42, `WERSJA_SW='m12-75'`.

### 2. `5a905f1` + `b8193a0` — trasa-sekret: dwie luki z audytu (m12-76)

Właściciel: „nie pokazuja nam sie stacje na mapie ani lista lokacji tylko
komunikat — wygenerowano i zlokalizowano/nie zlokalizowano X stacji i nie ma
opcji inny układ". Stan faktyczny:

- **przycisk „🔄 Inny układ" (`#przycisk-przelicz`) nie był chowany** w tajnej
  trasie — przełączany był tylko `disabled` (`app/app.js:1510/1520`), a nowy
  układ stacji odsłania punkty, które mają zostać tajemnicą. Teraz `hidden`
  w gałęzi `STAN.ukryjStacje` i `hidden = false` na ścieżce zwykłej
  (`renderujStacje` rysuje oba stany).
- **komunikat nie rozróżniał stacji ZLOKALIZOWANYCH na sieci dróg od układu
  pierścieniowego** (osiągalność niezweryfikowana). Organizator musi to wiedzieć
  ZANIM wyjdzie w teren — komunikat mówi teraz wprost, którą z dwóch sytuacji
  ma (ten sam warunek `sieciowe`, którym renderuje się reszta ekranu).

Testy: asercja pełnej ścieżki AI (pierścień po 404 → „NIE zlokalizowano"
+ przycisk schowany) oraz nowy test ze siecią z cache telefonu → „Wygenerowano
i zlokalizowano stacji: 3" bez wycieku współrzędnych.

`b8193a0` to **commit naprawczy własnego błędu**: `git add` objął tylko cztery
pliki, więc podbicie `?v=` w pozostałych modułach `app/*.js` zostało w drzewie
roboczym i commit `5a905f1` nie był samodzielnie zielony (kontrakt wymaga jednej
wersji w całym grafie importów). Dokładnie ta pułapka jest w LESSONS L29 —
historii nie przepisywaliśmy.

### 3. `772429e` — 4j: rankingi usunięte w całości (m12-77)

24 pliki, +149/−2942. Nie „schowane z interfejsu" — nie ma ich po żadnej stronie:

- **aplikacja**: sekcja „M12/P6: rankingi i moje gry" (−215 linii: `pokazRankingi`,
  `wrocZRankingu`, `przelaczRankingi`, `urlMostuRankingu`, `pobierzRankingi`,
  `renderujRankingi`, `RANKING_ZAKLADKI`), importy `agregujRanking` /
  `kategorieRankingu` / `walidujRankingSurowy`, pola `STAN`, `'ranking'`
  z `PANELE`, ikona 🏆 z nasłuchami, gałąź Escape; komunikaty „historia
  i rankingi" → „historia gier" (10 miejsc), karta prywatności bez „liczone są
  rankingi" i bez słowa „pseudonim" (pole pseudonimu zniknęło w m12-74);
- **pułapka**: `przelaczSetup` (przycisk „START GRY") siedział W ŚRODKU usuwanej
  sekcji i wyleciał razem z nią — 16 testów UI padło na `ReferenceError`.
  Przywrócony obok `PANELE`, już bez warunku „chyba że rankingi są otwarte";
- **klucze** `okolica:ostatni-gracz` i `okolica:pseudonim` przestają istnieć —
  czytały je wyłącznie „Moje gry" (to jest domknięcie znalezionej w audycie
  PR #12 pary: klucz zapisywany, którego nikt nie czytał, i klucz czytany,
  którego nikt nie zapisuje);
- **most**: `GET ?akcja=ranking` i `rankingi()` (−32 linie). Zapis gry
  (`gra-hotseat`, `przeliczWyniki`) ZOSTAJE — bez niego nie byłoby historii
  ani podsumowania;
- **protokół**: kody R17/R18 wycofane razem z `RO-ranking/1`, numery zajęte
  NA STAŁE (precedens E14/E18 — inaczej starszy klient w terenie odczytałby
  cudzy błąd jako swój);
- **testy**: usunięty `test/rankingi-ui.test.js`; kontrakt M12 zastąpiony
  kontraktem ODWROTNYM (LESSONS L31): ekranu, przycisku i akcji mostu nie ma;
  testy mostu sprawdzają wynik graczy w ZAPISIE gry zamiast w osobnym GET.

Sprzątanie: skasowany `01a09256-…patch` (125 KB) z katalogu głównego.
Brama: **676 pass / 0 fail** (spadek o 14 = usunięte testy rankingów).

Domknięte przy okazji znalezisko z audytu PR #12 (uwaga 7): martwa funkcja
`zmienPodklad` **już nie istnieje** w `app/` — wyciął ją salvage (brak wyboru
podkładu, poprawka 1), więc zapis ADR 0037 jest teraz zgodny z kodem.

### 4. `536986f` — audyt: wyjście z lobby było zrobione w połowie (m12-78)

Punkt pierwotnego pomysłu „dołączanie i wychodzenie w dowolnym momencie" nie był
spełniony. Dołączanie szło przez most (`gra-dolacz`), a **wychodzenie tylko
gasiło ekran** — gracz zostawał w `gra.gracze`, a `listaGier()` zwraca
`liczbaGraczy: gra.gracze.length`. Lobby obiecywało więc gracza, którego już
nie było, i odświeżanie listy co 10 s niczego nie prostowało.

- **most**: nowa akcja `gra-opusc` + `opuscGre()` — wyjście gościa usuwa go
  ze składu; wyjście ORGANIZATORA zamyka grę (stan `archiwum`, przeniesienie do
  `okolica-gry-zakonczone` — ta sama droga co wygasanie po 24 h), bo tylko on
  może wystartować; po starcie akcja odmawia i nazywa właściwą drogę
  (wyjście w trakcie gry to zdarzenie `rezygnacja`);
- **aplikacja**: `opuscLobby()` wysyła polecenie w tle (telefon wolny od razu,
  niepowodzenie powiedziane na głos — LESSONS L6);
- **dwa nieprawdziwe zdania w prywatności**: „Bez zgody zostają współrzędne
  ręczne i tryb testowy" (ręczne pinezki to ustawianie STACJI, a ręcznego
  wpisywania własnej pozycji nie ma wcale — ekran „Gdzie jesteś?" czeka na GPS;
  tryb testowy to wejście przez `?test=` i nie należy do tekstu dla gracza)
  oraz „W kolejnych kamieniach: cache sieci drogowej, ukryta paczka pytań
  i historia gier" — wszystkie trzy już są.

Testy: trzy testy mostu + test UI (kliknięcie „Opuść lobby" wysyła `gra-opusc`
z właściwym `graczId`, gra kończy w archiwum) + kontrakt. Brama: **680/680**.

### 5. `m12-80` — układ setupu multi wg uwag właściciela (2026-09-12, druga tura)

Właściciel po obejrzeniu podglądu: blok „Ty w tej grze" ma być **zaraz pod
opisem ścieżki**, a lista gier w okolicy — **osobnym boksem**, który pokazuje
się **dopiero po zalogowaniu**; zdanie „Pokazujemy tylko hosta — resztę sobie
opowiecie na miejscu" do usunięcia; opis hosta ma zaczynać się od logowania.

- `#pole-tozsamosc` **jeździ między dwoma slotami** (`umiescTozsamosc`):
  w multi ląduje w `#multi-slot-tozsamosc` w karcie multi (zaraz pod
  `#multi-sciezka-opis`), poza multi wraca do `#slot-tozsamosc-dom` na swoje
  miejsce w setupie. Przenosimy WĘZEŁ, nie kopię — `id` zostaje ten sam, więc
  nasłuchy, testy i `renderujPolaTozsamosci` nie wiedzą o przeprowadzce;
- `#multi-panel-dolacz` wyniesiony **poza** `#karta-multi` i dostał
  `class="karta"` (osobny boks); widoczność liczy `renderujPanelDolacz()`
  = ścieżka „Dołączam" **ORAZ** `pseudonimGraczaMulti()` — wołana zarówno
  z `renderujRodzajGry`, jak i z `renderujPolaTozsamosci` (czyli po dodaniu
  gracza boks wyskakuje sam);
- komunikat „Zaloguj się w bloku „Kto gra?"…" zniknął ze statusu listy: cały
  boks jest wtedy schowany, więc nie miałby się gdzie pokazać;
- `OPISY_SCIEZEK.zaloz`: „Jesteś hostem nowej rozgrywki. **Zaloguj się,**
  wybierz odpowiednie opcje i przejdź dalej."

Kolejność sprawdzona w realnym DOM (atrapa `test/helpers/dom.js`, nie tylko
czytanie HTML): `multi-sciezka → pole-tozsamosc → multi-panel-dolacz`;
przed zalogowaniem boks ukryty, po zalogowaniu widoczny; przy powrocie do
hot-seat pole wraca do `#slot-tozsamosc-dom` i legenda znów brzmi „Kto gra?".

Testy: kontrakt przełożony na nowy układ (slot PO opisie, karta multi domyka
się zaraz za slotem, boks ma `class="karta"`, zdanie o „tylko hoście" nie
wraca, widoczność bramkowana imieniem) + test UI „bez potwierdzonego imienia"
sprawdza teraz, że boksu w ogóle nie ma, a pojawia się po dodaniu gracza.
Brama: **680 pass / 0 fail**, 0 naruszeń WCAG AA.

### 6. Blokada 403 kafelków OSM w podglądzie — realny błąd w `sw.js`, nie artefakt środowiska

Właściciel zgłosił, że w podglądzie Areny kafelki `tile.openstreetmap.org`
wracają jako `403 Access Blocked. App is not following the tile usage policy of
OpenStreetMap's volunteer's-run servers: osm.wiki/Blocked`, a na GitHub Pages
działa. Komunikat cytuje politykę, więc polityka została przeczytana
(`operations.osmfoundation.org/policies/tiles/` + `osm.wiki/Blocked`).

To wariant **General block**, nie „Referer is required" — a wśród jego przyczyn
polityka wymienia: *„**No caching**: downloading the same tiles repeatedly, due
to improper response caching, can also result in blocking."*

Nasz `sw.js` dokładnie to robił: `CACHE_KAFELKI` był nazwany od `WERSJA_SW`
(`okolica-kafelki-m12-80`), a wersja rośnie przy każdej zmianie `app/*.js`
(L29). Każde wdrożenie tworzyło nową nazwę, `activate` kasowało starą — cały
zbiór kafelków do kosza, widok pobierany od dostawcy od zera. W tej sesji bump
był sześć razy (m12-75 → m12-80), każdy z pełnym re-pobraniem. Efemeryczny
referer `*.e2b.app` (nowy przy każdym sandboxie, więc niestabilna tożsamość,
czego polityka też nie lubi) tylko przyspieszył wyrok — **wzorzec ruchu
wytwarzał nasz kod, nie środowisko.**

- `CACHE_KAFELKI` = `` `${PREFIKS_CACHE}-kafelki` `` — **bez wersji**. Kafelki
  są adresowane treścią (`z/x/y`) i ich ważność określa dostawca, nie nasz
  numer wersji. Skorupa zostaje wersjonowana (musi — to ona niesie `?v=`),
  kafelki nie mogą. Stare cache'e z wersją w nazwie sprząta `activate`
  (przechodzą przez filtr przedrostka, bo nie równają się stałej);
- **ryzyko na Pages:** identyczny mechanizm działał tam od M10/T2 — przy małym
  ruchu niewidoczny, przy większym to dokładnie penalizowany wzorzec. Poprawka
  zdejmuje ryzyko u źródła, nie tylko w sandboxie.

Testy (2 nowe, łącznie **682 pass / 0 fail**, brama exit 0, WCAG 0):
„cache kafelków przeżywa bump wersji" symuluje dwa wdrożenia na **tym samym**
magazynie (harness `new Function` dostaje ten sam `magazyny`, kod z podmienionym
`WERSJA_SW`) i sprawdza, że po `activate` kafel jest w cache, a ponowne
żądanie nie idzie do dostawcy; drugi pilnuje sprzątnięcia starej wersjonowanej
nazwy. **Sprawdzone, że na starym kodzie oba są czerwone** (2 fail) — inaczej
test nic by nie dowodził. LESSONS **L47**.

Bez zmian: szablon URL, atrybucja, `MAX_KAFELEK = 120`, cache-first, brak
prefetchu — więc nie dotyczy nas „bulk downloading / offline". Zalecenia
polityki jeszcze niespełnione (do decyzji właściciela): podmiana szablonu
kafelków bez wdrażania wersji, link „Report a map issue"
(`openstreetmap.org/fixthemap`) przy atrybucji, opublikowany adres kontaktowy.

### 7. `m12-81` — cztery decyzje właściciela po blokadzie 403

Właściciel odpowiedział na listę otwartych punktów. Wszystkie cztery wdrożone.

**(1) Szablon kafelków podmienialny bez wdrażania wersji.** Właściciel: „nie wiem
o co chodzi. Jeśli to nie zepsuje aplikacji to zrób." Chodziło o zalecenie
polityki OSM („avoid hard-coding the tile URL; allow switching without needing
a software update"): adres `tile.openstreetmap.org` był zakodowany na sztywno,
więc zniknięcie albo blokada serwisu wymagałaby nowego wdrożenia — a gra toczy
się w terenie. Doszedł klucz `localStorage` **`okolica:kafelki:url`**:

- `walidujSzablonKafelkow()` wymaga `https:` i wszystkich trzech podstawień
  `{z}/{x}/{y}`; wartość błędna jest **odrzucona, nie rzucona** — zostaje adres
  wbudowany, więc pomyłka nie zostawi gracza z pustą mapą;
- `ustawSzablonKafelkow()` / `biezacySzablonKafelkow()` w `app/mapa.js`,
  a nieczysty odczyt `localStorage` w `wczytajNadpisanieKafelkow()`
  (`app/app.js`, wołane na początku `start()`, w `try/catch` bo `localStorage`
  bywa niedostępny) — `mapa.js` zostaje modułem czystym;
- nadpisanie dotyczy **tylko `osm`**; `opentopo`, `esri-satelita` i `brak` mają
  własne adresy i licencje;
- to **nie jest** wybór gracza: klucza nie ma w UI ani w setupie, więc nie
  dotyka paczki, dopasowania ani ADR 0037. Aneks do **ADR 0003**.

**(2) i (3) „Zgłoś błąd na mapie" + adres kontaktowy** — oba zalecenia polityki
OSM, oba w ekranie **Informacje** (decyzja właściciela). Link do
`openstreetmap.org/fixthemap` i `mailto:` z adresem kontaktowym: bez adresu OSM
nie ma jak uprzedzić o blokadzie, a blokuje „bez uprzedzenia". Style
`.informacje-link` dziedziczą kolor (nie wprowadzają nowej pary do audytu WCAG —
odróżnia je podkreślenie), cel ≥ `--cel` (44 px), `overflow-wrap: anywhere`
żeby długi adres nie rozepchał panelu 360 px (wzorzec `.instrukcja a`).

**(4) `STAN.wymusPierscien` usunięte.** Flaga była wiecznie `false` (przycisk
„Tryb uproszczony" wyleciał w m12-66, kontrakt `test/kontrakt.test.js:318`
pilnuje, żeby nie wrócił), więc `!STAN.wymusPierscien` udawało gałąź decyzyjną
w trzech miejscach: `przeliczZTegoCoJest`, pobieranie sieci i `renderujStacje`.
Skoro przycisk ma nie wracać, poprawnym domknięciem było usunięcie stanu, nie
dorobienie UI. Zniknęły deklaracja i trzy warunki.

**Przy okazji:** `docs/ASSETS.md` §1 twierdził, że aplikacja „nie buduje
własnego cache poza cache przeglądarki" — **nieprawda od M10/T2** (`sw.js`
cache'uje kafelki w Cache Storage). Poprawione i dopisane, że to wymóg
polityki, nie odstępstwo.

**Testy: 692 pass / 0 fail**, brama exit 0, WCAG AA 0 naruszeń. Nowe: walidacja
i setter jednostkowo (5 w `test/mapa.test.js`), **dwa end-to-end** przez
`start()` → warstwę SVG (klucz poprawny → kafelki z zamiennika; klucz błędny →
zostaje OSM), trzy kontrakty (linki w Informacjach, podmienialność szablonu,
brak `wymusPierscien`). Dwa z nich **sprawdzone na popsutym kodzie**: odcięcie
`ustawSzablonKafelkow(...)` w `start()` barwi test end-to-end na czerwono,
a przywrócenie wersjonowanej nazwy cache kafelków — test z LESSONS L47.

**Pułapka tej tury:** test SW z poprzedniej tury miał **zaszyty literal**
`'m12-80'`, więc po podbiciu cache-bust podmiana wersji przestała działać
i test wyłożył się na własnym strażniku (`assert.notEqual`). Wersję bierzemy
teraz ze źródła (`KOD_SW.match(/^const WERSJA_SW = '([^']+)';$/m)`). Reguła:
test, który symuluje zmianę wartości, ma tę wartość **wyprowadzać**, nie wpisywać.
Druga: kontrakt sprawdzający „moduł nie używa X" musi łapać **wywołanie**
(`/localStorage\s*[.[]/`), nie samo słowo — inaczej wykłada się na własnym
komentarzu wyjaśniającym, dlaczego X-a tam nie ma.

### Audyt reszty pierwotnego pomysłu — co sprawdzone i ZGODNE

Czytane w kodzie, nie z dokumentów: lobby pokazuje wyłącznie tryb, notkę
o sekrecie, `liczbaStacji` i `miejsce` (`renderujLobby`, `app/app.js:4451`);
start tylko u organizatora, solo dozwolone (`przycisk-lobby-start`); przycisk
„Opuść lobby" widoczny przez całe lobby; kanał info (`renderujInfoMulti`,
`:4522`) nadaje `start` / `dojscie` (📍) / `odpowiedz` (✅/❌) / `rezygnacja` (🏳)
/ `koniec`; `INTERWALY_MS {lobby: 10_000, gra: 30_000}` (`app/sync.js:21`);
koniec z ręki hosta (`zakonczGreMulti`, `:4544`); premia 3/2/1 zduplikowana
w `app/wieloosobowa.js` i w `.gs` (parity pilnowane testem); `pytaniaNaStacje=1`
+ `przeliczPromienZCzasu()` + `multiPoPaczce` + `ukryjStacje` ustawiane
w nasłuchu `przycisk-dalej-pozycja` (`:4746`, gałąź multi `:4774-4779`); lobby otwiera się dopiero po wklejeniu
paczki (test E2E `test/wieloosobowa-ui.test.js`). Notki robocze z numerami ADR
są w `<span class="dopisek-roboczy">` — niewidoczne poza `?tryb=test`
(`app/styles.css:292`), więc nie są tekstem dla gracza.

**Dokumentacja:** PROTOKOL §9.3 (`RO-ranking/1` wycofany), §9.4 (R17/R18),
nowy §9.5 `gra-opusc` (`gra-hotseat` → §9.6), ADR 0019 **aneks 2026-09-11b**,
rejestr ADR, README, ARCHITECTURE, WORKFLOW (＋ krok 7a testu terenowego),
ROADMAP M12 („Historia gier"), ASSETS §7.1, BACKLOG (§9.5 → §9.6). Treści
ADR-ów 0004/0020/0021/0026/0027/0029 wspominające rankingi zostają — to zapis
historyczny, a obowiązujący kształt definiuje aneks ADR 0019 (wzorzec z ADR
0014/0031: status, nie przepisywanie).

## Sesja 2026-09-12c — kontynuacja: PR #14 i audyt PR #13 (gałąź arena/01a095b5-okolica)

**Zlecenie właściciela:** „Kontynuujemy projekt." Sesja robocza bez nowego
zakresu, więc wg `AGENTS.md` §2 i `docs/plans/2026-09-12c-sesja-robocza.md`:
PR przed kodem (ADR 0012 reguła 1), audyt poprzedniego scalonego PR, potem
najwyższa otwarta zaległość — a tą jest klaster dokumentacyjny z audytu PR #9
(uwagi 2–6), otwarty także po PR #13.

### 1. Blok startowy i PR #14

Gałąź `arena/01a095b5-okolica` z `main` `963a86d` (stan po squash-merge
PR #13), drzewo czyste. Bramy na starcie odtworzone: `npm test`
**692 pass / 0 fail** (66 s), `npm run check` — oba szablony promptu zgodne
(§2: 4 209 zn. / 61 l., §2.2: 4 457 zn. / 62 l.), `npm run audyt` —
**0 naruszeń WCAG AA**. Cache-busting `?v=m12-81` w 42 miejscach
(`index.html` + `app/*.js`), `WERSJA_SW = 'm12-81'` (`sw.js:21`) — spójne
(kontrakt). Budżet lektury: `npm run budzet` — 74 064 / 100 000 tokenów.

PR #14 („Sesja 2026-09-12c: audyt PR #13 + domknięcie zaległości
dokumentacyjnych") powstał PRZED dotknięciem kodu — pierwszy commit to plan
`docs/plans/2026-09-12c-sesja-robocza.md`.

### 2. Audyt PR #13 (squash `963a86d`, 49 plików, +1962/−1333)

Metoda: `git diff 963a86d^..963a86d` plik po pliku — cały `app/app.js`,
`app/mapa.js`, `app/most.js`, `app/protokol.js`, `app/rozgrywka.js`,
`app/stacje.js`, `app/wynik.js`, `app/zestawy.js`, `app/konfig.js`,
`app/sieci.js`, `app/trwalosc.js`, `app/pozycja.js`, `app/wieloosobowa.js`,
`sw.js`, `index.html`, `docs/setup/apps-script-repo-paczek.gs`, dokumenty
i testy — plus weryfikacja grepem stanu po zmianach.

**Zgodne z decyzją i zweryfikowane w kodzie:**

- **Rankingi usunięte po obu stronach.** W `app/` nie ma `pokazRankingi`,
  `pobierzRankingi`, `agregujRanking`, `kategorieRankingu`,
  `walidujRankingSurowy`, `STAN.rankingWiersze`; w `.gs` nie ma
  `GET ?akcja=ranking` ani `rankingi()`. Słowo „ranking" zostało wyłącznie
  tam, gdzie znaczy tabelę końcową JEDNEJ gry (podsumowanie, `wynik.js`) —
  to poprawne znaczenie, nie pozostałość. `test/rankingi-ui.test.js` usunięty,
  a kontrakt odwrócony (ekranu/przycisku/akcji nie ma).
- **Nominatim usunięty z kodem, nie z UI.** `app/sieci.js` stracił
  `budujUrlGeokodacji`, `miejsceZOdpowiedziNominatim` i
  `DOMYSLNY_ENDPOINT_GEOKODACJI`; `app.js` — `uzupelnijMiejsceZapasowe`,
  `kluczMiejscaCache`, przełącznik `#geokodacja-zapasowa`. Kontrakt
  (`test/kontrakt.test.js:358–369`, `:553–556`) grepuje brak endpointu,
  brak funkcji i brak przełącznika.
- **`zmienPodklad` i `wymusPierscien` nie wracają.** Pierwszej nie ma
  w `app/` (salvage m12-75), druga zniknęła w m12-81, a kontrakt
  (`:1259–1265`) pilnuje obu — razem z brakiem `przycisk-pierścien`
  w `index.html` (`:318`).
- **Cache kafelków OSM bez wersji aplikacji** — z uzasadnieniem w kodzie
  (`sw.js:24–40`) i z testem, który NAPRAWDĘ symuluje dwie wersje: bierze
  `WERSJA_SW` ze źródła skryptu (nie z literalu — pułapka z poprzedniej tury),
  podmienia ją, uruchamia `activate` na tym samym magazynie i sprawdza, że
  kafel przetrwał i nie poleciało żadne żądanie do dostawcy. Stary
  wersjonowany cache jest sprzątany osobnym testem.
- **Dokumentacja zgodna ze zmianą:** PROTOKOL §9.3 (`RO-ranking/1` wycofany)
  i §9.4 (R17/R18 zajęte na stałe), nowy §9.5 `gra-opusc` (`gra-hotseat`
  §9.6), aneks 2026-09-11b w ADR 0019, aneks 2026-09-12 w ADR 0003,
  zaktualizowane ADR 0013/0017/0020/0031, README, ARCHITECTURE, WORKFLOW,
  ASSETS §1 i §3, ROADMAP (M12 „Historia gier"), rejestr ADR, LESSONS L46/L47.
  Zero rozjazdów dokument ↔ kod **poza** zaległościami z §3 poniżej.

**Ustalenia nowe (nieopisane wcześniej):**

1. **Martwe importy w `app/app.js` (10 nazw):** `TEMATY`, `WIEK`,
   `przesunPunkt`, `najmniejszyOdstepM`, `STANY_ODCINKA`, `INSTANCJE_OVERPASS`,
   `ALFABET_KODU`, `kodPoprawny`, `normalizujKod`, `ramkaGeohash` — każda
   występuje w pliku WYŁĄCZNIE na linii importu (sprawdzone skryptem
   liczącym użycia). Zero wpływu na zachowanie, ale to dług po usuwaniu
   rankingów (m12-77) i porządek, który kontrakt L6 i tak lubi widzieć czysty.
2. **„Opuść lobby" organizatora zamyka grę JEDNYM klikiem** (`opuscLobby` →
   `gra-opusc` → most: stan `archiwum`). Gość może wrócić z listy, organizator
   nie — a repo ma wzorzec dwustopniowych akcji nieodwracalnych (rezygnacja
   w grze uzbraja przycisk, kasowanie zapisu i historii, ręczne zakończenie
   gry). Jednoklikowe zamknięcie gry dla wszystkich dołączonych to
   niespójność, nie decyzja.
3. **`KANON_SETUPU` jest zapisywany, ale nie porównywany.** Odczyt sprawdza
   tylko obecność markera (`if (!kanon)`), więc jego WARTOŚĆ nie bierze
   udziału w niczym. Dziś działa to poprawnie (dopełnienie dla zapisów
   sprzed m12-75 jest jednorazowe), ale przy kolejnej zmianie kanonu zapisy
   z markerem nie dostaną nowych tematów domyślnych — trzeba będzie
   rozstrzygnąć, czy dopełnienia są per-wersja kanonu. Obserwacja projektowa,
   nie defekt bieżący.
4. **`.gs`: osierocony docstring.** Skrót `/** POST gra-dolacz: kod ALBO
   idGry (z lobby) + pseudonim; tylko w lobby. */` został NAD nowym, pełnym
   opisem `gra-opusc`, więc opisywał nie tę funkcję, a `dolaczDoGry` zostało
   bez własnego nagłówka.
5. **`opuscGre` rozpoznaje organizatora po indeksie `0`**, nie po
   `organizatorId`. Dziś równoważne (host jest zawsze pierwszy w `gracze`),
   ale reguła „wyjście organizatora zamyka grę" powinna czytać pole, które
   to definiuje.

**Werdykt:** PR #13 jest spójny z decyzjami właściciela i z ADR-ami; brak
usterek blokujących grę, prywatność ani kontrakty `RO-*`. Cztery ustalenia
z listy powyżej to porządki (1, 3, 4, 5) i jedna niespójność UX (2).
Wykonanie: pkt 1 i 2 naprawione w tym samym dniu (kod, `?v=m12-82`),
pkt 4 poprawiony w `.gs` (i tak czeka na ponowne wklejenie), pkt 3 i 5
zapisane jako obserwacje dla właściciela.

### 3. Domknięcie zaległości z audytu PR #9 (uwagi 2–6) i dwa doczesy tej samej klasy

Uwagi otwarte po PR #13 zamknięte osobno, każda z dowodem w kodzie (wzorzec
L31: opis idzie za grepem/kontraktem, nie za pamięcią):

- **`0e78188` — uwaga 2.** Nagłówek `test/duza-paczka.test.js` mówił o „stałych
  szacunku", których nie ma od m12-66 (`szacunekOdpowiedzi()` skasowane razem
  z `#prompt-rozmiar`). Zamiast tego opis tego, co testy NAPRAWDĘ asertują:
  prompt nie rośnie z liczbą pytań, odpowiedź 40 pytań przechodzi parser
  i walidator, kontener mieści się w budżetach pamięci. Liczby pomiaru zostały
  tam, gdzie żyją — w PROTOKOL §2.1.
- **`304d726` — uwagi 3a/3b/3c.** `README.md` opisywał trzy nieistniejące
  elementy: „◎ Tryb uproszczony" i „miarę sprawiedliwości pod listą" (kontrakt
  asertuje BRAK `#przycisk-pierścien` i `#stacje-sprawiedliwosc`), wysyłkę „do
  przeglądu właściciela" (moderacja zniesiona 2026-09-11; `.gs` zapisuje zestaw
  OD RAZU w katalogu zaakceptowanych) oraz przycisk „🔌 Sprawdź połączenie"
  (usunięty w m12-66; kontrakt asertuje brak `#przycisk-test-polaczenia`).
  Przepisane na to, co ekran naprawdę pokazuje: wiersz trybu z rozróżnieniem
  „zlokalizowano na sieci"/pierścień, cicha wysyłka Drive, stan mostu
  w `#most-stan-repo`.
- **`9ca9004` — uwagi 4/5 + dwa doczesy.** `docs/WORKFLOW.md` (§3: kroki 3–5
  bez pierścienia, bez „linii pod promptem mówi, jak duża będzie odpowiedź",
  z wariantami promptu wg ADR 0032 i z zapisem, że zestaw leci prosto do
  repozytorium) i `docs/ARCHITECTURE.md` (lista kontraktów: tylko
  `przycisk-reczne` + jawny ZAKAZ przycisku pierścienia). Przy okazji dwa
  opisy tej samej klasy: wiersz M5 w `docs/ROADMAP.md` („Nominatim opt-in")
  i akapit M5 w `README.md`, który jednocześnie twierdził, że zapasowa warstwa
  Nominatim działa, i że została usunięta.
- **`0b0fda2` — uwaga 6.** Aneksy „2026-09-12" w ADR 0020 (przycisk „Sprawdź
  połączenie" usunięty; przy okazji `REVIEW_SECRET` i link przeglądu po
  zniesieniu moderacji), ADR 0016 i ADR 0018 (wzmianki o przycisku), ADR 0031
  (stałe szacunku wyleciały z kodu — nazwy nie występują w `app/` ani `test/`;
  zostaje pomiar w PROTOKOL §2.1 i asercje `duza-paczka`). Rejestr ADR dostał
  przy 0016/0018/0020/0031 wzmiankę o aneksie, tak jak mają 0003 i 0019.
  Statusy bez zmian.
- **`0bfee06`, `38b55d0` — doczesy znalezione przy okazji.** Instrukcja mostu
  (`docs/setup/most-drive-instrukcja.md`) obiecywała jeszcze „rankingi
  z zakończonych gier" (usunięte), przycisk „🔌 Sprawdź połączenie" i checkbox
  zgody na wysyłkę (usunięty 2026-09-07) — a brakowało jej wpisu o zmianie,
  którą właściciel i tak musi wdrożyć (`gra-opusc`). `docs/WORKFLOW.md` §4.1
  kazał szukać przycisku „Ustaw tę pozycję", którego w kodzie nie ma: stuknięcie
  mapy w trybie testowym ustawia pozycję od razu.

### 4. Poprawki kodu z audytu PR #13 (`?v=m12-82`)

- **`dc0fcda` — ustalenia 1 i 2.** (a) Dziesięć martwych importów z `app/app.js`
  (`TEMATY`, `WIEK`, `przesunPunkt`, `najmniejszyOdstepM`, `STANY_ODCINKA`,
  `INSTANCJE_OVERPASS`, `ALFABET_KODU`, `kodPoprawny`, `normalizujKod`,
  `ramkaGeohash`) — każda nazwa występowała w pliku wyłącznie na linii importu
  (skrypt liczący wystąpienia: 10/10), a moduły dalej eksportują je dla swoich
  testów. (b) Wyjście organizatora z lobby jest dwustopniowe: pierwszy klik
  uzbraja przycisk („⚠ Kliknij ponownie…") i mówi, że gra zostanie zamknięta
  WSZYSTKIM, drugi wysyła `gra-opusc`. Gość wychodzi jednym klikiem — jego
  wyjście jest odwracalne (może dołączyć ponownie z listy w okolicy). Wejście
  do lobby rozbraja przycisk, żeby uzbrojenie nie zostało między ekranami.
  Test UI pilnuje obu kliknięć; na kodzie sprzed zmiany celowo pada
  (sprawdzone `git stash` na `app/app.js`: 1 fail), więc to regresja-guarda,
  a nie ozdoba. Bump `?v=m12-81` → `m12-82` (42 miejsca) + `WERSJA_SW`.
- **`fccea21` — ustalenia 4 i 5.** Docstring `gra-dolacz` wraca nad
  `dolaczDoGry`; założenie „organizator = indeks 0" w `opuscGre` zostało
  ZAPISANE w komentarzu (bez zmiany zachowania) jako obserwacja dla
  właściciela — dziś równoważne z `organizatorId`, ale reguła powinna czytać
  pole, które ją definiuje.

### 5. Bramy, stan po sesji i pułapka tej tury

`npm test` zielony po każdej zmianie (692/692; ostatnie przebiegi 66,2–66,7 s),
`npm run check` — oba szablony zgodne, `npm run audyt` — 0 naruszeń WCAG AA,
`git status` czysty, wszystko wypchnięte na `arena/01a095b5-okolica` (PR #14).

**Otwarte dla właściciela:** ponowne wklejenie `.gs` (nadal aktualne: akcja
`gra-opusc`, brak `ranking`, komentarze z tej sesji) i rozstrzygnięcie dwóch
obserwacji — `KANON_SETUPU` bez porównania wartości i `opuscGre` czytający
organizatora po indeksie. Kamienie M3–M8 i M10–M12 pozostają 🟡: czekają na
kryteria terenowe/wdrożenie, więc agent nie ma tam czego kodować (ENVIRONMENT
§7). ROADMAP bez zmian statusów — ta sesja nie ruszała zakresu kamieni.

**Pułapka tej tury:** `edit_file` odmawia „Context not found" na tekstach
z polskimi cudzysłowami („…"), choć w podglądzie wyglądają identycznie. Pewny
wzorzec to skrypt w Pythonie z kotwicą `assert fragment in tekst` — dał się
zastosować do wszystkich dokumentów, w tym ADR-ów i `.gs`, i od razu łapie
literówkę w kotwicy zamiast cicho nic nie zmienić.

## Sesja 2026-09-12d — dwa zgłoszenia terenowe (bugi A i B) i domknięcie obserwacji z audytu PR #13 (m12-82 → m12-85)

**Gałąź:** `arena/01a095b5-okolica`, **PR #14** — jedyny otwarty PR tej sesji.
**Zlecenie właściciela (2026-09-12):** „Nowa treść appscript wdrożona" + „Punkt (2)
do zrobienia zrób" (obie obserwacje z audytu PR #13) + dwa zgłoszenia z terenu:
**(A)** oznaczanie miejsca gry i re-centrowanie po pobraniu sieci z Overpassa
wjeżdżały na puste kafle OSM — „sufit przybliżenia niezależnie od promienia,
np. taki przypisany do 1000 m promienia"; **(B)** na ekranie „Gdzie jesteś?"
Podkowa Leśna pokazywała „Repozytorium niedostępne", choć w okolicy są co
najmniej trzy paczki z Drive. Uwaga właściciela z tej tury: znalazł DWA otwarte
PR-y agenta i zamknął wcześniejszy (#15) bez scalania — „Nie rób tak więcej!".

### 1. `a985996` — Bug A: sufit przybliżenia mapy (m12-83)

`app/geo.js` dostał `PROMIEN_SUFITU_ZOOMU_M = 1000` i opcję `sufitPromienM`:
`dopasujZoomDoPromienia` bierze `Math.max(promienM, sufitPromienM)`, więc każdy
mniejszy promień (200/250/500 m, promień kadru i promień gry) kadruje się jak
1000 m — tak, jak zdecydował właściciel. Sonda na oknie 360 px/52,23°:
200/250/500/1000 → z14, 1500 → z13, 3000 → z12, 10000 → z10; żadna wartość nie
wjeżdża w puste kafle. Fallback w `app/app.js` dla promienia/`lat` bez sensu to
kadr sufitu przy 52° (wcześniej skok do `TRYBY` z zoomem 17). Dowód regresji:
`git stash` na `geo.js`+`app.js` → test „sufit przybliżenia" pada (`not ok 1`),
po `stash pop` przechodzi. Dwa nowe testy: `test/geo.test.js` (czysta funkcja)
i `test/aplikacja.test.js` (okablowanie mapy: promień gry 250 m daje ten sam
pasek skali co `sufitPromienM: 0`).

### 2. `d9d295b` — Bug B: most Drive (m12-84)

Trzy przyczyny po naszej stronie, wszystkie naprawione u źródła:

- **limit czasu** — indeks paczek miał własne 6 s, a web app Apps Script po
  wdrożeniu startuje z zimnej instancji; żądanie było przerywane ZANIM most
  zdążył odpowiedzieć. Wspólna stała `LIMIT_MOSTU_MS = 15000` obejmuje teraz
  indeks, listę gier, stan gry i paczkę (`pobierzGetTekst`, `pobierzGetMulti`);
- **zero powtórek** — `pobierzIndeksZRepo` robi JEDNĄ powtórkę po krótkim
  odstępie (`PONOWNA_PROBA_INDEKSU_MS`, w testach skracany globalem
  `__OKOLICA_PONOWNA_PROBA_MS__`). Odpowiedź nieczytelna (Z01/Z09) powtórki nie
  dostaje — to nie awaria sieci, tylko zły adres albo wdrożenie bez dostępu
  „Każdy";
- **połykany powód** — `.catch(() => …)` dawał jeden komunikat na wszystko
  (LESSONS L6). `bladMostuPoPolsku` dokłada krótki `powod`: „brak odpowiedzi
  w 15 s", „przerwane połączenie", „brak połączenia", „HTTP 403 — sprawdź, czy
  wdrożenie web app ma dostęp «Każdy»", „nieczytelna odpowiedź". Panel pokazuje
  powód razem z hostem, do którego pytaliśmy, a `#most-stan-repo` po nieudanej
  próbie dopisuje „Ostatnia próba nie doszła: …" i dostaje klasę `bledy` — samo
  posiadanie adresu w kodzie to nie to samo co działające połączenie.

**Ciąg dalszy po wdrożeniu `.gs` przez właściciela (`9e35710` + `0577244`, m12-86).**
Właściciel potwierdził, że most działa (rozegrał grę, wygenerował gracza i paczkę
z AI — wszystko się zapisało) i wskazał cel: „to musiał być jakiś specyficzny
problem ze sprawdzaniem paczek”. Wskazówka odsłoniła drugi defekt tej samej
rodziny: `.catch(() => …)` w `odswiezPropozycjeZestawow` obejmował CAŁY łańcuch,
więc także wyjątek NASZEGO kodu (parsowanie, dopasowanie, render listy) na
poprawnej odpowiedzi mostu meldował jako „Repozytorium niedostępne”. Teraz sieć
i czytanie odpowiedzi są rozdzielone: powtórka należy się wyłącznie żądaniu,
wysypka naszego kodu mówi „Repozytorium odpowiedziało, ale lista paczek się nie
wczytała (błąd aplikacji: <konkret>) — lista może być niepełna, zgłoś ten błąd”,
a odpowiedź niezrozumiała niesie kod usterki („nieczytelna odpowiedź (Z09)”,
pełny opis w stanie mostu). Z10 z zerem wczytanych wpisów przestał udawać „puste
repo”. Przy awarii widać też prefiks adresu wdrożenia
(`, script.google.com/s/AKfycbxlSc…/exec`) — przy kilku wdrożeniach Apps Script
pierwsze pytanie brzmi, czy aplikacja pyta o TO, które właściciel właśnie wkleił.
Trzy testy w `test/zestawy-ui.test.js` celowo padają na kodzie sprzed zmiany
(`git stash`: 3 fail), w tym jeden wymuszający wysypkę renderu na poprawnej
odpowiedzi mostu.

Ta sama klasa błędu w drugiej połowie ekranu: `grajZZestawemZRepo` nie miał
limitu czasu wcale (zawieszone żądanie zostawiało „Pobieram paczkę…" na zawsze)
i połykał powód. Cztery nowe testy w `test/zestawy-ui.test.js` (dokładnie jedna
powtórka leczy pierwszy błąd sieci i pokazuje paczki; HTTP 403 nazywa przyczynę
i nie udaje pustego repo; HTML to „nieczytelna odpowiedź", nie „pusto"; brak
sieci przy paczce mówi, co się stało). Na kodzie sprzed zmiany celowo padają
(`git stash` na `app/app.js`: 4 fail).

### 3. `1ab8ff2` + `e9e2a4e` — Punkt (2): obie obserwacje z audytu PR #13 (m12-85)

- **`KANON_SETUPU` był zapisywany, ale nie porównywany.** `app/konfig.js` ma
  dziennik `ZMIANY_KANONU_SETUPU` (wersja kanonu → tematy, które TA wersja
  dodała do domyślnych) i czyste funkcje `tematyDopelnianeOdKanou`,
  `kanonSprzedBiezacego`, `dopelnijKonfiguracjeDoKanou`; `wczytajKonfiguracje`
  porównuje wartość markera i domyka zapis dokładnie o dopełnienia z jego
  wersji. Zapis bieżący (albo z nowszej wersji aplikacji) nie jest ruszany, bo
  organizator mógł temat odptaszkować ZAMIERZENIE — to ta sama reguła, którą
  test m12-75 broni dla zapisów świeżych. Test ogólny przechodzi po każdej
  wersji z dziennika i sprawdza, że dopełnienie nie wraca po raz drugi.
- **`.gs`: `opuscGre` czyta `gra.organizatorId`**, nie indeks 0 w `gracze`
  (fallback na pierwszego gracza wyłącznie dla zapisów sprzed wprowadzenia
  pola). Pomyłka miała dwie strony: po zmianie kolejności graczy wyjście
  organizatora USUWAŁO go z listy zamiast zamknąć grę, a wyjście gościa
  z indeksu 0 zamykało grę wszystkim. Test w `test/most-gra-cycle.test.js`
  odwraca kolejność w pliku gry i sprawdza obie strony (na starym `.gs`:
  1 fail). **`.gs` wymaga ponownego wdrożenia przez właściciela.**

Kontrakt doc↔kod dostał asercje na mechanizm per-wersja (dziennik zmian,
funkcja licząca dopełnienia, porównanie markera w odczycie).

### 4. Bramy i stan po sesji

`npm test`: 692 → 698 (Bug A) → 701/701 (Bug B i Punkt 2) → **703/703** (m12-86; 70,4 s),
`npm run check` — oba szablony zgodne, `npm run audyt` — 0 naruszeń WCAG AA,
`git status` czysty, wszystko wypchnięte na `arena/01a095b5-okolica`.
Budżet lektury startowej (po dopisaniu tej sekcji i trzech lekcji): patrz
`npm run budzet`.

**Otwarte dla właściciela:** ponowne wdrożenie `.gs` z tej sesji (zmiana
`opuscGre`), kafelki M3–M8 i M10–M12 (bez zmian — czekają na teren/wdrożenie),
ocena, czy po powtórce i 15 s limitu paczki z Podkowy Leśnej pokazują się na
„Gdzie jesteś?" w terenie. ROADMAP bez zmian statusów.

## Sesja 2026-09-12e — trzy kolejne zgłoszenia właściciela: rotacja pytań (bug C), ekran wyników (bug D) i intro na iPhonie (bug E) (m12-86 → m12-89)

**Gałąź:** `arena/01a095b5-okolica`, **PR #14** — jedyny otwarty PR tej sesji.
**Zlecenie właściciela (2026-09-12):** po potwierdzeniu, że preview działa
(„Już działa, to musiał być timeout”) przyszły dwa zgłoszenia: **(C)** „Mam
dwóch graczy, 5 stacji, po 2 pytania na stację. Pierwsze pytanie dostaje
Gracz 1. Drugie pytanie na tej stacji… dostaje znowu gracz 1. Powinno pytać na
zmianę (kolejno następnego gracza, jeśli jest ich więcej), a nie, że na danej
stacji wszystkie pytania dostaje ten sam gracz”; **(D)** „ta strona Wyniki ma
masę błędów i niepotrzebnych informacji” + trzy konkrety (górny fragment ekranu
gry nad wynikami, wszystko pod tabelą, zdanie o braku fact-checku). Zapowiedziane
także zgłoszenie **(E)** — intro na iPhonie (do zrobienia po C i D).

### 1. `d58d247` — Bug C: pytania padają po jednym dla kolejnych graczy (m12-87)

Przyczyna: `ktoOdpowiada()` zwracało gracza z kolejki, a pętla UI szukała
pierwszej nieobsłużonej pary (pytanie × dozwolony gracz) — każde pytanie stacji
trafiało do tej samej osoby. Rozwiązanie: `graczPytania(stan, stacjaId,
pytanieId)` liczy autora pytania `k` jako gracza z kolejki przesuniętego o `k`
w liście graczy (cyklicznie). `ktoOdpowiada()` zwraca autorów kolejnych pytań
bez duplikatów, `stacjaZamknieta` czeka na odpowiedź każdego pytania od jego
autora, a `zapiszOdpowiedz` odrzuca nie-autora kodem G07. Adnotacja: pierwsze
pytanie zostaje przy graczu z kolejki (ANEKS do ADR 0022, 2026-09-12).

Testy: model (`test/rozgrywka.test.js` — rotacja przy 2 i 3 graczach,
zawinięcie, G07 dla nie-autora) i UI (`test/aplikacja.test.js` — hot-seat
2 graczy × 2 pytania: „pytanie 1 z 2 · odpowiada Gracz 1”, po odpowiedzi
„pytanie 2 z 2 · odpowiada Gracz 2”). Dowód regresji: `git stash` na
`app/rozgrywka.js` + `app/app.js` → 2 testy CELOWO PADAJĄ, po `stash pop`
wszystkie przechodzą.

### 2. `c227434` — Bug D: minimalny ekran wyniku (m12-88)

Z ekranu „🏁 Koniec gry!” zniknęło wszystko poza kartą zwycięzcy, tabelą
rankingu, linią wysyłki na Drive i jednym przyciskiem „🏠 Wróć na początek —
nowa gra”. Faza `koniec` ukrywa teraz CAŁY slot sterowania (nagłówek „Gra”,
badge'y kolejki i dystansu, liczniki, „Pomiń odcinek”, „Zakończ grę”), a z kodu
zniknęły statystyki, szczegóły graczy, tabela stacji, eksport tekstu i obrazu
(share/schowek/`.txt`/`.png`), pole „Tekst wyniku”, linia wariantu fact-checku
i cała gałąź rysowania na canvasie (`PALETA_AWARYJNA`, `paletaZCss`,
`rysujWynikNaCanvas`, `eksportujWynikObraz`, `pobierzPlik`, `dataWynikuTekst`,
`STAN.wynikTekst`) razem z pięcioma nasłuchami. `kopiujTekst` został — używają
go prompt i poprawka. Decyzja: **ADR 0038** (z notą o sprzeczności z ADR 0010
pkt 5, który obiecywał eksportowalny wynik) + zawężenie kryterium kamienia M7
w `docs/ROADMAP.md`; moduł `app/wynik.js` zostaje z własnymi testami jako
biblioteka bez konsumenta w UI (osobna decyzja, gdyby miał zniknąć).

Testy przepisane na nowy kontrakt (aplikacja: minimalny ekran, zero canvasów
i linków z `download`, ręczne zakończenie, pełna gra GPS end-to-end; kontrakt:
lista ID, których `index.html` nie ma już prawa mieć). Dowód regresji:
`git stash` na `app/app.js`, `app/styles.css`, `index.html` → 7 fail.

### 3. `ff9abd1` — Bug E: intro mieści się na iPhonie (m12-89)

Zgłoszenie: „Ekran startowy Intro — treść nie mieści się na layerze na iPhonie.
Naprawdę niewiele brakowało.” Trzy poprawki właściciela co do joty: tytuł
`clamp(28px, 8vw, 40px)` → `clamp(25px, 7vw, 36px)`; warstwa o pół wiersza
w górę i pół wiersza w dół (nowa zmienna `--wiersz-warstwy: 25px` = 17 px ×
1,45, dodana do `max-height` wyśrodkowanego panelu — rosnąca wysokość przesuwa
obie krawędzie symetrycznie); nowa treść intro (trzy akapity właściciela,
krótszy opis okolicy, „w kilka osób” zamiast „z rodziną i znajomymi”).
Razem ~29 px więcej miejsca przy krótszym tekście. Testy: pin tytułu, nowy test
„warstwa dostaje o wiersz więcej”, pin nowego brzmienia i braku starego opisu,
dwa piny tolerujące zawinięcie wiersza w HTML. Dowód regresji: `git stash` na
`app/styles.css` + `index.html` → 4 fail.

### 4. Bramy i stan po sesji

`npm test`: 706/706 po C (m12-87) → **704/704** po D (m12-88; trzy testy
eksportu zastąpione jednym pinem braku eksportów i jednym testem ręcznego
końca) → **705/705** po E (m12-89), `npm run check` — oba szablony zgodne,
`npm run audyt` — 0 naruszeń WCAG AA, budżet lektury startowej
78 529/100 000. Wszystko wypchnięte na `arena/01a095b5-okolica`. Lekcje sesji:
L53 (kotwicz przepisywaną funkcję po realnym tekście; nieudany skrypt
z pojedynczym zapisem potwierdź grepem) i L54 (trzy pułapki walidatora przy
dokładaniu pytań do paczki: promień E16, wzór id E19, treść E15).

**Otwarte:** potwierdzenie terenowe Buga B (≥3 paczki z Podkowy Leśnej);
sprawdzenie przez właściciela na telefonie C (rotacja pytań), D (ekran wyniku)
i E (intro); kafelki M3–M8 i M10–M12. Właściciel zapowiada dalsze uwagi do
ekranu wyników.

## Sesja 2026-09-12f — ranking wrócił w nowej formie: dwie tabele, sumy liczy most (m12-90)

**Gałąź:** `arena/01a095b5-okolica`, **PR #14** — jedyny otwarty PR tej sesji.
**Handoff:** `docs/setup/HANDOFF_2026-09-12f.md`.
**Zlecenie właściciela:** „Mam nowy pomysł na podstronę Ranking”: przywrócić
podstronę jako warstwę togglowaną ikonką pucharu, z DOKŁADNIE dwiema tabelami —
„Ranking Punktowy Graczy” (zarejestrowani gracze wg zdobytych punktów,
wszystkie rodzaje gier, max 5 pozycji) i „Mistrzowie Zagadek” (wg proporcji
odpowiedzi poprawnych do zadanych, max 5 pozycji).

**Trzy decyzje właściciela (dopytane przed kodem):** źródło danych = wspólny
Drive (nowa akcja w skrypcie mostu; po zmianie `.gs` zgłoszona potrzeba
redeployu „Wdróż → Nowa wersja”); do tabel wchodzą WYŁĄCZNIE gracze
z potwierdzonym profilem (imię + PIN, ADR 0021) — goście bez profilu nie;
„Mistrzowie Zagadek” liczą się od progu **10 zadanych pytań** (suma gier).

### 1. `9e1737e` — implementacja rankingu (m12-90)

Rankingi usunięto 2026-09-11 (`963a86d`, m12-81) — razem z akcją mostu
`GET ?akcja=ranking` i schematem `RO-ranking/1` (surowe wiersze per gra:
pseudonim, punkty, data, tryb, miejsce, geohash5, wiek, tematy). Nowa forma
odwraca tylko DECYZJĘ o braku rankingu, nie jego kształt: numer schematu rośnie
do `RO-ranking/2`, a odpowiedź niesie gotowe SUMY per gracz
`{ pseudonim, punkty, poprawne, pytania }` — bez wierszy gier, więc na telefon
nie jadą daty, miejsca ani geohashy innych osób (ADR 0013/0019 pkt 3).

- **Most** (`docs/setup/apps-script-repo-paczek.gs`): `rankingi()` czyta katalog
  gier zakończonych (jedno źródło dla hot-seat i multi) i katalog profili;
  wiersz powstaje tylko dla gracza z profilem (`idProfilu` + `czytajProfil`),
  pseudonim wyświetlany pochodzi z PROFILU („ALA” i „ala” to jeden wiersz
  „Ala”), rezygnacja bez ani jednej odpowiedzi nie wchodzi do sum, a uszkodzony
  plik gry albo profilu jest pomijany po cichu. Trasa: `doGet` obsługuje
  `akcja === 'ranking'`.
- **Aplikacja**: nowy czysty moduł `app/ranking.js` (limit 5 pozycji, próg 10
  zadanych pytań, sortowanie z remisami — przy równej proporcji wyżej większa
  próba, walidacja odpowiedzi, format „18/24 · 75%”); warstwa `#ekran-ranking`
  w `index.html` (dwie tabele, linia statusu, ✕) i przełącznik
  `#przycisk-ranking` (puchar) w belce. Stan ikony liczy jedno miejsce
  (`odswiezWidocznoscPaneli`, wzorzec F3), Escape zamyka, a warstwa wygasza
  pozostałe panele (`body.ranking-otwarte`).
- **Testy**: `test/most-ranking.test.js` (5 testów WYKONUJE tekst `.gs` na
  atrapie Drive — LESSONS L33), `test/ranking-ui.test.js` (13: reguły modułu
  plus warstwa na atrapie DOM, w tym awaria sieci, śmieci w odpowiedzi i stan
  „starsze wdrożenie bez akcji”: `{ blad: 'nieznana akcja' }` pokazujemy
  dosłownie) i kontrakt ADR 0039.
- **Odwrócony pin**: brama trzymała trzy asercje „rankingu NIE MA” (LESSONS
  L31). Zamiast je kasować, przepisane na pin nowej formy + zakaz powrotu
  starej (zakładki, kategorie, `ranking-moje-gry`) — nowa lekcja **L55**.

### 2. Dokumentacja

**ADR 0039** (nowy) + rejestr (wiersz 0039; nota przy 0019 o powrocie rankingu
w nowej formie), **PROTOKOL §9.7** (`GET ?akcja=ranking`, `RO-ranking/2`,
reguły i wymóg redeployu) z korektą noty o `RO-ranking/1` w §9.3,
`docs/ARCHITECTURE.md` (moduł `ranking.js`; opis ekranu wyniku nadrobiony po
ADR 0038) i `docs/ROADMAP.md` (M12: rankingi wróciły w nowej formie),
`README.md` (M7 i nota o rankingu), **LESSONS L55**, handoff
`docs/setup/HANDOFF_2026-09-12f.md`. `docs/setup/most-drive-instrukcja.md`
dopowiada, że bez nowej wersji wdrożenia ranking nie ma danych.

### 3. Bramy i stan po sesji

`npm test` — **724/724** (0 fail), `npm run check` — oba szablony promptu
zgodne, `npm run audyt` — 0 naruszeń WCAG AA, budżet lektury startowej
**80 984/100 000** (rezerwa 19 016 — nowy ADR 0039, sekcja protokołu, README
i ten wpis wchodzą do lektury startowej). Wszystko wypchnięte na `arena/01a095b5-okolica`.

**Otwarte:** WDROŻENIE `.gs` (właściciel: „Wdróż → Nowa wersja”) — bez niego
warstwa rankingu pokaże „most Drive odmówił: nieznana akcja”; sprawdzenie
przez właściciela na telefonie: C (rotacja pytań), D (ekran wyników),
E (intro) i F (ranking: dwie tabele, ikonka pucharu); potwierdzenie terenowe
Buga B (≥3 paczki z Podkowy Leśnej); kamienie M3–M8 i M10–M12.

## Sesja 2026-09-12g — audyt PR #14, bug terenowy G: cichy watcher GPS na iPhonie (m12-91)

> Gałąź `arena/01a0967e-okolica` z `a3ca791` (main po squash-merge PR #14).

### 1. Audyt PR #14 (squash `a3ca791`, 52 pliki, +3479/−768)

Zakres: `git fetch origin main --depth=50`; `git diff a3ca791^..a3ca791` plik po
pliku; brama na HEAD: `npm test` **724/724**, 0 fail.

- **Bug C — rotacja pytań (m12-87)**: `graczPytania()` liczy autora pytania
  `k` jako gracza z kolejki przesuniętego o `k` cyklicznie po liście graczy
  (ADR 0009 aneks 2026-09-12, ADR 0022 aneks); `ktoOdpowiada()` zwraca autorów
  KOLEJNYCH pytań bez duplikatów; `zapiszOdpowiedz` odrzuca nie-autora kodem
  G07; `stacjaZamknieta` czeka na odpowiedź KAŻDEGO pytania od JEGO autora.
  Zgodne z protokołem i testami `rozgrywka.test.js`. Bez zastrzeżeń.
- **Bug D — minimalny ekran wyniku (m12-88)**: usunięcia zgodne z ADR 0038
  (statystyki, szczegóły, eksporty, linia fact-checku); slot `#gra-slot-sterowanie`
  schowany w fazie `koniec`; `app/wynik.js` zostaje z testami (świadoma decyzja
  ADR 0038 pkt 5). Bez zastrzeżeń.
- **Zgłoszenie F — ranking (m12-90)**: `app/ranking.js` czysty (limit 5, próg 10,
  sortowanie z remisami, walidacja `RO-ranking/2`), warstwa z `textContent`
  (L34), warstwy wzajemnie się wygaszają, status mówi, DLACZEGO ranking pusty
  (L6), próg „Mistrzów” mówiony zawsze. Moście: `rankingi()` per profil
  (`idProfilu`), pseudonim z profilu, rezygnacja bez odpowiedzi poza sumami,
  uszkodzone pliki po cichu — wykonywane testem `most-ranking.test.js` (L33).
  Bez zastrzeżeń.
- **Sufit zoomu 1000 m** (`geo.js`): `dopasujZoomDoPromienia` z
  `sufitPromienM` — jeden punkt prawdy, wszystkie ścieżki (tap mapy, pierwszy
  fix, przeliczenie stacji) przechodzą przez `zoomDlaPromienia`. Testy geo.
- **Dziennik kanonu** (`konfig.js`): `ZMIANY_KANONU_SETUPU` + `tematyDopelnianeOdKanou`
  — domknięcie L49 (marker wersją, nie flagą); zapis z markerem ≥ bieżącego
  nietknięty. Testy konfig.
- **Limity mostu** (`LIMIT_MOSTU_MS = 15000`, jedna ponowna próba indeksu) —
  realizacja L51/L52; puste `catch` usunięte, komunikat z powodem.
- `?v=m12-90` spójne w `index.html`, `app/*.js`, `sw.js` (kontrakt).

**Wniosek:** zmiany zgodne z ADR 0019 (aneksy), 0022, 0027, 0038, 0039;
PROTOKOL §9.7 spójny z `.gs` (kontrakt); nie znaleziono usterek wymagających
poprawki w tej sesji.

### 2. Bug G — cichy watcher GPS na iPhonie (m12-91, commity `f8c4d66`, `41b4b50`, dokumentacja)

**Zgłoszenie:** iPhone, Chrome, Pages, zgoda na lokalizację udzielona, GPS
telefonu sprawny (Google Maps lokalizuje). Ekran „Gdzie jesteś?” wisi na
„Czekam na pozycję…” w nieskończoność; po wyjściu/wejściu „Szukam
satelitów…”; w Informacjach „GPS uruchomiony” / „wznowiono śledzenie
położenia”. Zero fixa, zero błędu — gracz nie ma jak przejść dalej.

**Diagnoza (root cause):** WebKit (wszystkie przeglądarki na iOS) potrafi
trzymać `watchPosition` w całkowitej ciszy — ani `onFix`, ani `onBlad` —
ignorując opcję `timeout` (kwerenda: udokumentowana rodzina usterek iOS,
obejście = watchdog z restartem). Ryzyko rośnie, gdy request poszedł bez
gestu (nasz `start()` włącza GPS przy ładowaniu strony) i po powrocie
z tła. Druga warstwa: aplikacja czytała `watcher.czyAktywny()` jako „GPS
działa”, a to zdanie o własnym wrapperze, nie o dostawcach platformy.

**Naprawa (m12-91):**
- `pozycja.js` (czyste): `ZEGAR_MILCZENIA_MS = 15 000` (¾ × timeout z
  ADR 0004 pkt 1), `czyMilczy()` (brak/NaN znaku życia = milczenie, L10),
  `komunikatMilczenia()` → nowy kod **P10** (sekundy ciszy, numer próby,
  wyjście awaryjne: iOS Usługi lokalizacji dla przeglądarki). P05 zostaje
  wycofany, numer nie wraca do puli.
- `app.js`: znak życia przy KAŻDYM callbacku (fix albo błąd); watchdog
  co 5 s, uzbrojony TYLKO gdy czekamy na fixa (ekran pozycji albo faza
  odcinka) — poza tym zero żywych timerów; po 15 s ciszy świeży watcher
  + P10 z „próba N”; pauza/wznowienie i `zatrzymajGps` zdejmuje zegar.
- Gest „Dalej”: bez żadnego fixa zakłada świeżego watchera przy każdym
  wejściu na ekran pozycji (kotwica restartu w geście).
- „GPS włączony” tylko przy pierwszym starcie — restarty nie nadpisują
  statusu gry (L22).
- Kontrakt L17: zakazane wywołania (`watchPosition`, `clearWatch`,
  `enableHighAccuracy`) szukane w kodzie BEZ komentarzy.

**Weryfikacja:** `npm test` 728/728 (4 nowe: `czyMilczy`, P10, watchdog
end-to-end na „niemym” watcherze, gest „Dalej”), `check`/`audyt` zielone,
`?v=m12-91` w całym grafie. Na żywo w headless Chromium (360×740,
niemy GPS, przyspieszony zegar przez te same gałki co w testach): ekran
pozycji nie wisi — P10 mówi „(13 s) — zakładam świeży nasłuch (próba 20)”
i rośnie, zero `pageerror`; zrzut w sesji. **Do potwierdzenia na prawdziwym
iPhonie** (właściciel): czy po wejściu na „Gdzie jesteś?” pozycja przychodzi
po restarcie watchera (albo po kliknięciu „Dalej”).

**Dokumentacja:** aneks m12-91 w ADR 0004, LESSONS **L56** (API „aktywne”
≠ „dostarcza”; znak życia, limit ciszy, gest, uzbrajanie zegara na potrzebę),
`ARCHITECTURE` (moduł pozycja.js + przepływ fixów), `README` (linia GPS),
handoff `docs/setup/HANDOFF_2026-09-12g.md`.

### 3. Bramy i stan po sesji

`npm test` **728/728**, `check` OK, `audyt` OK, budżet lektury
**82 004/100 000**. Wszystko wypchnięte na `arena/01a0967e-okolica` (PR #16).

**Otwarte:** potwierdzenie terenowe bug G na iPhonie; WDROŻENIE `.gs`
(ranking — ADR 0039); testy terenowe F/C/D/E; bug B; kamienie M3–M8, M10–M12.

## Sesja 2026-09-12h — audyt PR #16, uwagi terenowe: komunikat P10 i stare paczki (m12-92)

> Gałąź `arena/01a096bd-okolica` z `6c15989` (main po squash-merge PR #16).

### 1. Audyt PR #16 (squash `6c15989`, 23 pliki, +506/−55)

Zakres: `git fetch origin main --depth=50`; `git diff a3ca791..6c15989` plik
po pliku; brama na HEAD przed zmianami: `npm test` **728/728**.

- **Bug G — watchdog martwego nasłuchu GPS (m12-91):** `pozycja.js` (znak
  życia, `czyMilczy` z edge-case'ami L10, `komunikatMilczenia` → P10),
  `app.js` (watchdog co 5 s uzbrojony na ekranie pozycji/odcinku, zegar
  zdejmowany w `zatrzymajGps`, gest „Dalej” odświeża nasłuch bez fixa,
  „GPS włączony” tylko na pierwszym starcie — L22), kontrakt L17 (zakazane
  wywołania szukane w kodzie BEZ komentarzy). Zgodne z aneksem m12-91
  w ADR 0004 i LESSONS L56.
- Pozostałe moduły (`mapa`, `most`, `protokol`, `rozgrywka`, `sieci`,
  `stacje`, `trwalosc`, `wieloosobowa`, `wynik`, `zestawy`) — wyłącznie
  podbicia `?v=` (m12-90 → m12-91) w całym grafie; `WERSJA_SW` spójne.
- Testy: `czyMilczy` (w tym znak „z przyszłości”), P10 z wypełnieniem
  i placeholerami, watchdog end-to-end na „niemym” watcherze, gest „Dalej”.
- Dokumentacja (aneks ADR 0004, L56, ARCHITECTURE, README, handoff 12g)
  spójna z kodem.

**Wniosek:** bez zastrzeżeń blokujących. Dwie obserwacje do rejestru:
(O1) przy TRWAŁYM milczeniu cisza liczona jest od ostatniego znaku i nie
resetuje się przy restarcie watchera — watchdog restartuje nasłuch co 5 s,
a „próba N” rośnie co tyknięcie (sformułowanie aneksu/L56 mówi „od
założenia nasłuchu”); bez wpływu na zgłoszony bug, odnotowane. (O2) wyjście
awaryjne P10 (ustawienia systemu + odświeżenie strony) nie pomogło w
terenie — treść zmieniona w tej sesji decyzją właściciela.

### 2. Uwagi terenowe: P10 i stare paczki (m12-92, commity `4edfdf2` + dopełnienie `2179d98`, `a410cf4`)

**P10 (uwaga właściciela 2026-09-12):** wyjście awaryjne „Ustawienia →
Prywatność i bezpieczeństwo → Usługi lokalizacji + odśwież strony” NIE
przywracało pozycji w terenie; przywracało ją zamknięcie aplikacji (karty
przeglądarki) i ponowne otwarcie. Treść P10 zmieniona zgodnie
(`app/pozycja.js`), mechanizm watchdoga bez zmian; pin komunikatu przepisany
na nową formę (`test/pozycja.test.js`, L55); aneks m12-92 w ADR 0004;
`?v=m12-92` w całym grafie.

**Stare paczki (uwaga właściciela 2026-09-12):** „to miało być już
naprawione, ale nie jest” — paczki sprzed 2026-09-11 odrzucane na
„Gdzie jesteś?” (tematy spoza setupu), choć pytań z tych tematów w nich
nie ma. Przyczyna: naprawa z 2026-09-11 objęła meta nowych wysyłek,
migrację rejestru LOKALNEGO i regułę dopasowania, ale nie PLIKI NA DRIVE
(indeks mostu przepisywał `meta.tematy` wprost); droga „odświeżenie
ponowną wysyłką” była martwa (most przy duplikacie nie nadpisuje pliku,
ADR 0028).
- Naprawa w moście: `tematyPytanZestawu()` (dekoduje kontener — most i tak
  go dekoduje; unikalne tematy w kolejności pierwszego wystąpienia; null
  przy usterce) + `budujIndeks()` dopisuje `tematy` do wpisu indeksu
  (fallback `meta.tematy`) — plik na Drive nietknięty (wzorzec B19).
- Klient: zero zmian (ta sama reguła, ten sam kanał, inne dane); paczki
  nowe nietknięte (idempotencja).
- Testy: 5 nowych w `test/most-indeks.test.js` (L33), w tym regresja
  kliencka „paczka bez pytań o tematy spoza setupu pasuje do setupu”
  i jej kontrola „bez backfillu pada”; `zasieg-mostu` 97.8%.
- Dokumentacja: aneks m12-92 w ADR 0017, LESSONS **L57** (zmiana sensu
  pola wymaga inwentaryzacji wszystkich nośników danych; obietnica w ADR
  musi być ścieżką uruchomialną).

**Pułapka (L7 w praktyce):** commit `4edfdf2` nie wziął
`test/pozycja.test.js` (`git add` z listy) — jego drzewo miało czerwoną
bramę; dopełnienie `2179d98`. Reguła z handoffu 12g potwierdzona po raz
drugi: przy zmianach w module dodaje się katalogi w całości i ogląda
`git status --short` PRZED commitem.

### 3. Bramy i stan po sesji

`npm test` **733/733** (5 nowych), `check` OK, budżet lektury
**83 322/100 000** (rezerwa 16 678 — aneksy ADR 0004/0017, L57 i ten
wpis wchodzą do lektury startowej), `?v=m12-92` spójne, `zasieg-mostu`
97.8%. Wszystko wypchnięte na `arena/01a096bd-okolica` (PR #17).

**Otwarte dla właściciela:**
1. **WDROŻENIE `.gs`** („Wdróż → Nowa wersja”) — JEDNO wdrożenie niesie
   teraz DWA efekty: ranking (ADR 0039) i naprawę starych paczek
   (backfill tematów w indeksie). Do tego czasu stare paczki zostają
   odrzucane, a warstwa rankingu „nie umie odczytać odpowiedzi”.
2. Potwierdzenie terenowe nowego P10 na iPhonie (zamknięcie i ponowne
   otwarcie w komunikacie); jeśli cisza dalej — zgłoszenie z treścią
   „próba N”.
3. Kamienie M3–M8, M10–M12 (kryteria terenowe).

## Sesja 2026-09-12H — zadanie H: usunięcie opcji „Pomiń odcinek” z gry (gałąź arena/01a0970a-okolica)

### 1. Audyt PR #17 (squash 4e3c21d, 26 plików, +481/−59)

Przegląd `git diff 4e3c21d^..4e3c21d` plik po pliku (logika, zgodność z ADR
i protokołem, zieloność). Brama na drzewie PR #17 przed pracą: 734/734.

- **P10** (`app/pozycja.js` + `test/pozycja.test.js`): wyłącznie zmiana treści
  komunikatu na „zamknij aplikację i otwórz ponownie”; mechanizm watchdoga
  nietknięty; pin przepisany na nową formę zgodnie z L55; zgodne z aneksem
  m12-92 ADR 0004. OK.
- **Backfill tematów** (`.gs`: `tematyPytanZestawu()` + dopisek w `budujIndeks()`;
  5 testów w `test/most-indeks.test.js`, w tym regresja kliencka z kontrolą
  „bez backfillu pada”): plik na Drive nietknięty (wzorzec B19), fallback do
  `meta.tematy` przy nieczytelnym kontenerze, idempotentny dla nowych paczek.
  Zgodne z aneksem m12-92 ADR 0017. OK.
- **G.a** (`app/app.js`: reset `prompt-factcheck` przy wejściu z ekranu 3;
  test w `test/aplikacja.test.js`): reset tylko dla nowej generacji, powrót
  strzałką wyboru nie rusza — obie strony pinowane. OK.
- **G.b** (PROTOKOL §2/§2.2 zasada 8 + `app/protokol.js` + `test/protokol.test.js`):
  skrócenie zasady 8 w obu szablonach, sync bloków, wersje `PYT/1.0.8` /
  `PYT/1.0-nofc.3` spójne między PROTOKOL §7 a stałymi `SZABLON_WERSJA*`;
  kształt odpowiedzi i markery rev4/rev5 bez zmian (łatka szablonu). OK.
- **Wersjonowanie**: `?v=m12-93` w 42 miejscach (jeden łańcuch w całym grafie),
  `WERSJA_SW = 'm12-93'` — spójne, kontrakt zielony. OK.
- **Dokumentacja**: L57, aneksy ADR 0004/0017, handoff 12h i wpis w historii
  opisują dokładnie to, co robi kod. OK.

**Obserwacje (dryf dokumentacyjny, bez wpływu na działanie):**
(O1) handoff 12h i wpis sesji 12h mówią `?v=m12-92`, a drzewo PR #17 niesie
`m12-93` — sesja podbiła wersję drugi raz po napisaniu dokumentów i ich nie
poprawiła; (O2) dokumenty mówią o bramie 733/733, a to samo drzewo daje
734/734 — rozjazd liczenia o 1, brama zielona w obu rachunkach.

**Werdykt:** PR #17 czysty, bez usterek logicznych; do zapamiętania: wersję
`?v=` i liczbę testów w dokumentach sesji spisywać z drzewa PO ostatnim
commicie, nie z notatek w trakcie.

### 2. Implementacja zadania H (commity 4bca46e, 9d58f7a — PR #18)

Zlecenie właściciela: „Pomiń odcinek (tylko w drodze)” to pozostałość
bez sensu — usunąć opcję. Zakres rozstrzygnięty inwentaryzacją: znika
sama AKCJA (przycisk, `pominStacje()`, `pominStacjeGry()`, kody G11/G13 —
numery zajęte), a MODEL ODCZYTU zostaje (stan `pominiety`, zdarzenie
`pominiecie`, liczniki, strażnik G14, etykiety wyniku, walidacja zapisów —
stare gry muszą być czytelne).

- **H/2** (`4bca46e`, kod + testy + `?v=m12-94`): silnik (3 podmiany +
  wycięcie funkcji), `app.js` (import, listener, `disabled`, ukrywanie
  w multi, cała `pominStacjeGry`, komentarz D a), `pozycja.js` (P03/P04/
  P08 + brak współrzędnych stacji → „■ Zakończ grę”), `index.html`
  (przycisk). Testy: akcja wycięta z `rozgrywka` (licznik kodów 14→12),
  pętle UI na pełnej ścieżce (helper `zamknijStacje`: start → GPS →
  odpowiedź → „Następna stacja”), stare zapisy odtwarza `jakoPominieta`,
  oczekiwania 0/0→0/1 (T5), zaliczone 0→3 (T7); piny nieobecności
  w silniku, aplikacji i kontrakcie. `wynik.test.js` nietknięty —
  regresja odczytu starych zapisów.
- **H/3** (`9d58f7a`, dokumenty): aneksy 2026-09-12 ADR
  0015/0004/0029/0036 (w 0004 i 0029 sprostowano przy okazji błędne
  „pkt 2” na właściwy pkt 3); WORKFLOW §3 pkt 6, ARCHITECTURE (tranzycje,
  faza 5, typy dziennika). README bez wzmianek — bez zmian; historia
  (LESSONS, plany, ADR 0038, PROTOKOL) nietknięta.
- **Brama na drzewie po H/3** (spisana z outputu, lekcja z O1/O2 powyżej):
  `npm test` → **733/733** (734 z PR #17 −3 akcje +2 piny H),
  `npm run check` OK, audyt kontrastu 0 naruszeń.

## Sesja 2026-09-12I — zadania I+J: paczki tylko z repo, START GRY gaśnie w grze (gałąź arena/01a0970a-okolica)

Zlecenie właściciela: (I.a) usunąć „CC BY-SA 4.0” z opisów paczek z Drive;
(I.b) usunąć pokazywanie paczek z telefonu; (J) „⚙ START GRY” aktywna tylko
gdy gra się NIE toczy. Zakres rozstrzygnięty inwentaryzacją: I.a to jedna
linijka display; I.b wariant B2 (sekcja UI znika, cichy zapis przyjętej
paczki + migracja starego klucza ZOSTAJĄ — druga gra bez modelu);
J to `disabled` + dynamiczny `title` na ikonie belki.

- **IJ/1** (kod + `?v=m12-95`): `app.js` bez `· ${meta.licencja}` w opisie
  repo, KANDYDACI i 4 statusy repo-only, `grajZZestawemLokalnym` wycięty,
  import bez `dopasujZestawy`, nowa `odswiezStanIkonBelki` (predykat:
  rozgrywka && faza != koniec && !ręczny-koniec) wołana z `pokazWyniki`,
  CSS `.przycisk-ikona[disabled]`; `most.js`: stan mostu bez „paczek
  z tego telefonu”. Suita po IJ/1: 733/716/17 faili — sam teren I.b.
- **IJ/2** (testy + pin kontraktu): `zestawy-ui` 18/18 (migracja bez UI,
  sortowanie 2 wiersze), `aplikacja` 123/123 (Q z indeksu repo; J: zgaszony
  od auto-startu po paczce, odgaszony po końcu i po `nowa-gra`), `multi`
  17/17 (kluczowa lekcja: `adresMostu` woli URL multi — jedno wdrożenie
  mostu wydaje indeks pod gołym adresem i plik przez `?akcja=paczka&id=…`;
  atrapa fetch serwuje je po akcji, nie po URL-u). Kontrakt 81/81 —
  test 81 pinuje nieobecność etykiety telefonu i licencji w UI.
- **IJ/3** (dokumenty): aneksy 2026-09-12 ADR 0017 (repo-only, licencja
  w formacie zostaje) i 0011 (zgaszony START jako przykład pkt 7);
  WORKFLOW §3 pkt 6 i §4.3 pkt 1, README (klauzula J). ASSETS §4 bez zmian
  (pola `licencja` nadal wymagane w formacie); historia nietknięta poza
  tym wpisem.
- **Brama na drzewie po IJ/3** (spisana z outputu): `npm test` → **734/734**,
  `npm run check` OK, audyt kontrastu 0 naruszeń.
## Sesja 2026-09-12K — audyt PR #18 i inwentaryzacja dryfu tekstów (gałąź `arena/01a0973d-okolica`)

### 1. Audyt PR #18 (squash `4eb0985`, 32 pliki, +578/−323)

Brama na drzewie `main` przed pracą: `npm test` → **734/734**, `npm run check`
OK, budżet lektury 84 257/100 000 (rezerwa 15 743). Przegląd
`git diff 4eb0985^..4eb0985` plik po pliku (logika, zgodność z ADR
i protokołem, zieloność).

- **Zadanie H — akcja pomijania** (`app/rozgrywka.js`, `app/app.js`,
  `app/pozycja.js`, `index.html`): `pominStacje()` wycięta razem
  z kodami **G11/G13** (numery zajęte — zgodne z aneksem ADR 0015
  i precedensem E14/E18/R17/R18), stan `pominiety` i licznik `pominietaStacje`
  zostają wyłącznie jako ścieżka ODCZYTU (`rozgrywka.js` → `podglad`/
  `podsumowanie`, walidatory `trwalosc.js`, strażnik G14, `wynik.js`).
  Grep potwierdza: w `app/` i `index.html` nie została ani jedna akcja
  pomijania (`pominStacje`, `pominStacjeGry`, `przycisk-pomin-stacje` — 0
  trafień), a komunikaty P03/P04/P08, status braku fixa i komunikat
  „Brak poprawnych współrzędnych stacji” odsyłają do „■ Zakończ grę”
  (ADR 0029 aneks m12-94). Żaden komunikat nie odsyła do ręcznego zaliczania
  (ADR 0029 pkt 1). OK.
- **Zadanie I.a** (`app.js` → `przyjmijIndeksZRepo`): opis propozycji bez
  `· ${meta.licencja}`. Pole `licencja` pozostaje WYMAGANE w formacie —
  sprawdzone w `app/zestawy.js` (walidacja meta L303 i wpisu L333) oraz
  w lustrze mostu (`czyMetaOk` w `.gs` L137/L143): display ≠ format,
  zgodnie z aneksem ADR 0017 (m12-95). OK.
- **Zadanie I.b** (`app.js` → `odswiezPropozycjeZestawow`, `pobierzIndeksZRepo`,
  `most.js`): sekcja „📱 z tego telefonu” wycofana z UI, `KANDYDACI_ZESTAWOW`
  startuje pusty, cztery statusy repo uproszczone do jednej ścieżki,
  `grajZZestawemLokalnym` wycięta, `stanMostu` nie obiecuje paczek
  z telefonu. Cichy zapis i migracja ZOSTAŁY (wariant B2):
  `zapiszZestawLokalnyPoStarcie()` jest wołana z `przyjmijZestawDoGry`
  (L2540), `ujedgajnijTematyWpisowLokalnych()` przy starcie, a rejestr czyta
  `czytajRejestrZestawow()` (3 żywe użycia). `dopasujZestawy` nie jest martwym
  eksportem — woła ją `dopasujMetaIndeksu` (L360) i testy. OK.
- **Zadanie J** (`odswiezStanIkonBelki` + `pokazWyniki` + CSS): predykat
  `rozgrywka && faza !== koniec && !graZakonczonaRecznie` → `disabled`
  i dynamiczny `title`; funkcja wołana z `pokazEkran`/`renderujGre`-ścieżek
  (L300, L324, L355) oraz z `pokazWyniki` (L3314), więc koniec naturalny,
  ręczny i multi odwieszają przycisk. Styl `.przycisk-ikona[disabled]`
  nie zmienia kontrastu tokenów (audyt WCAG 0 naruszeń). OK.
- **Wersjonowanie**: `?v=m12-95` w całym grafie (index.html + 42 importy
  `app/*.js`) i `WERSJA_SW = 'm12-95'` — jeden łańcuch, kontrakt zielony
  (L29). OK.
- **Testy**: `rozgrywka` (licznik kodów 14→12, `jakoPominieta` odtwarza stary
  zapis), `aplikacja` (pętle pełną ścieżką przez helper `zamknijStacje`,
  Q z indeksu repo, J: zgaszony od auto-startu), `zestawy-ui` 18/18,
  `wieloosobowa-ui` (atrapa fetch serwuje indeks i plik po akcji — jedno
  wdrożenie mostu), `kontrakt` 81/81 (test 81 pinuje I+J; piny nieobecności
  `przycisk-pomin-stacje` przepisane z „disabled” na „nie istnieje” — wzorzec
  L55). OK.
- **Dokumenty**: aneksy m12-94 (ADR 0015/0004/0029/0036) i m12-95 (ADR
  0017/0011), WORKFLOW §3 pkt 6 + §4.3 pkt 1, ARCHITECTURE (tranzycje, faza 5,
  typy dziennika), README (klauzula J). OK.

**Werdykt:** PR #18 czysty — bez usterek logicznych, bez osieroconego kodu,
zgodny z ADR 0015/0017/0029/0036/0038 i z protokołem. Wersję i liczbę testów
w dokumentach spisano z drzewa po ostatnim commicie (lekcja O1/O2 z audytu
PR #17 zastosowana).

### 2. Obserwacje audytu: dryf tekstów UI i dokumentów żywych (do naprawy w tej sesji)

Fala decyzji właściciela z 2026-09-09…2026-09-12 (m12-6x → m12-95) usuwała
funkcje szybciej, niż żywe dokumenty zdążyły to odnotować — dokładnie pułapka
**L31** („usunięcie funkcji z UI zostawia jej opis w dokumentach”), tyle że
skumulowana. Stan zastany (wszystko poniżej NIE dotyczy kodu logiki — aplikacja
działa zgodnie z ADR-ami; rozjeżdżają się teksty dla człowieka):

**W interfejsie (widzi gracz/organizator):**

- **(O1)** `index.html`, ekran „Wklej odpowiedź modelu”: „poprawna paczka
  od razu zaczyna grę (i leci na Drive **do przeglądu właściciela**)” —
  moderacja wstępna zniesiona 2026-09-11 (ADR 0017 aneks: paczka ląduje OD RAZU
  w katalogu zaakceptowanych, bez maila i bez strony przeglądu). Tekst obiecuje
  proces, którego nie ma.
- **(O2)** `app/app.js` → `zapiszZestawLokalnyPoStarcie`: „Pamięć paczek
  telefonu pełna — najstarsze (N) usunięte. **Eksport plikiem zabezpiecza
  rozgrywkę.**” — eksportu pliku nie ma w UI (eksport zestawu usunięty
  2026-09-07, eksporty wyniku w ADR 0038); komunikat wskazuje wyjście,
  którego nie da się wykonać (ADR 0011 pkt 8, L6).
- **(O11)** `index.html`, karta „Wspólny Drive: historia gier”: dwa sąsiednie
  punkty mówią co innego — „**Paczki pytań**, które wyślesz do wspólnego
  repozytorium — w pliku zostają pytania, stacje i nazwa miejscowości” oraz
  „Współrzędne gracza, trasa, **pytania i paczka zostają na telefonie**”.
  Oba zdania są prawdziwe w innych kontekstach (repozytorium zestawów vs zapis
  GRY `gra-hotseat`, gdzie `zestaw` jest `null` — PROTOKOL §9.6), ale obok
  siebie brzmią jak sprzeczność w najważniejszym miejscu o prywatności.

**W dokumentach żywych:**

- **(O3)** `docs/WORKFLOW.md` §3: pkt 1 — setup pyta o „język i podkład mapy”
  (pola usunięte, ADR 0037); pkt 2 — „🛰 Włącz GPS”, „✎ Wpisz ręcznie”, badge
  „±X m”, ostrzeżenie przy >100 m (ADR 0034 pkt 2 i 5: GPS startuje sam,
  ręcznych pól i symulacji 250 m na ekranie pozycji nie ma, `accuracy` nie
  uczestniczy w komunikatach ani w rysowaniu koła); pkt 5 — „⬆ Z pliku”
  i „✓ Sprawdź i przyjmij” (ADR 0006 aneks trzeciej tury: import z pliku
  usunięty, wklejenie JEST zatwierdzeniem); pkt 7 — „udostępnianie tekstem lub
  obrazem PNG” (ADR 0038).
- **(O4)** `docs/WORKFLOW.md` §4 i §4.1–§4.2: te same usunięte kontrolki
  w procedurach terenowych (ręczne współrzędne, „koło dokładności”,
  „Podkład mapy” w setupie, „Dane i prywatność” w stopce — stopka zniesiona
  w ADR 0034 pkt 4, warstwa ⓘ; „▶ Symuluj dojście (250 m)” na ekranie pozycji;
  „badge dokładności żyje”), plus mierzenie „dokładności GPS” jako kryterium
  progów (ADR 0034 pkt 2: próg 50 m, dwa pomiary, bez `accuracy`).
- **(O5)** `docs/WORKFLOW.md` §4.4 pkt 6–7: „Rankingów między grami nie ma
  (właściciel, 2026-09-11)” — odwrócone przez ADR 0039 (ranking jako warstwa,
  dwie tabele, `?akcja=ranking`); pkt 1–2 opisują kolejność kroków sprzed
  2026-09-12 (tożsamość jest teraz PIERWSZYM krokiem obu ścieżek, a lista gier
  ~50 m pokazuje się dopiero po zalogowaniu — komentarze w `index.html`).
- **(O6)** `docs/ASSETS.md` §7: „sekrety mostu (`REVIEW_SECRET`,
  `OWNER_EMAIL`) żyją wyłącznie w Script Properties” oraz „moderacja
  właściciela (e-mail z linkiem przeglądu) jest bramą przed udostępnieniem”
  — obie właściwości usunięte z wdrożenia (ADR 0017 aneks 2026-09-11; ADR 0020
  aneks 2026-09-12, kontrakt asertuje brak `REVIEW_SECRET` w `.gs`).
- **(O7)** `docs/ARCHITECTURE.md`: opis `wynik.js` („sprawiedliwość trasy,
  eksport tekstowy, plan komend obrazu i **nazwy plików**”) nie zgadza się
  z eksportami modułu (`dystansTekst`, `etykietaOdcinka`, `wynikTekstowy`,
  `ROLE_PALETY`, `planObrazuWyniku`; miara sprawiedliwości wycofana z ADR 0014/
  0023, nazw plików nie ma od ADR 0038); §Stan i trwałość — „plus plik
  `.paczka.json` eksportowany przez użytkownika” (eksportu nie ma w UI).
- **(O8)** `README.md`, akapit M7: kryterium terenowe „czytelność w słońcu
  na 360 px **i eksport na Chrome Android oraz Safari iOS**” — ROADMAP
  zawęził to kryterium 2026-09-12 (ADR 0038 pkt 7), README został przy starym.
- **(O9)** Rejestr ADR (`docs/decisions/README.md`) i komentarze w `.gs`
  powołują się na „ADR 0019 **aneks 2026-09-12f**” (powrót rankingu), którego
  w pliku ADR 0019 nie ma — decyzję niesie ADR 0039, a rejestr i most cytują
  nieistniejący aneks.
- **(O10)** `docs/WORKFLOW.md` §5–§6 drobiazgi: „Włącz PO scaleniu **PR #2**”
  (numer sprzed roku świetlnego), „aktualizacja rejestru w **`README.md`**
  ADR-ów” (rejestr żyje w `docs/decisions/README.md`), „Nowa kategoria wiekowa
  → `WIEK`” (kanon setupu to `WIEK_SETUP`), „Paczka referencyjna →
  `data/przyklady/paczka-*.json`” (w repo jest `zestaw-podkowa-lesna.json`).

**Reguła na przyszłość (trafi do LESSONS jako L58):** przy fali usunięć
(kilka decyzji właściciela w jednej sesji) grep „żywych” nośników — UI, README,
WORKFLOW, ARCHITECTURE, ASSETS — po KAŻDEJ decyzji, a nie po całej fali;
i dodaj strażnika testowego na frazy, które opisują usunięte funkcje
(L31 mówi „grep po dokumentach”, ale grepa nikt nie uruchamia automatycznie).

### 3. Naprawa dryfu — commity K/2…K/10 (PR #19)

Każdy commit przeszedł przez zieloną bramę przed wypchnięciem; zakresy O* to
numery z §2 powyżej.

- **K/2 (`50ff842`) — O1, O2, O11, teksty UI.** `index.html`: ekran wklejania
  mówi „leci na Drive — od razu do wspólnego repozytorium okolicy” zamiast
  „do przeglądu właściciela”; karta prywatności rozdziela dwa fakty, które
  brzmiały sprzecznie (repozytorium paczek niesie pytania — ADR 0017 pkt 1;
  zapis GRY nie — `zestaw: null`, PROTOKOL §9.6). `app/app.js`: trzy statusy
  wokół pamięci paczek i wysyłki na Drive przestały odsyłać do eksportu pliku
  i ręcznego wnoszenia (nie ma ich w UI od 2026-09-07, resztę zabrał ADR 0038);
  komunikat awarii wysyłki NIE obiecuje ponowienia, bo kolejki offline mają
  wynik hot-seat i oceny, a wysyłka zestawu nie. Kontrakt 82 pinuje nieobecność
  starych fraz i obecność nowych. `?v=m12-96`.
- **K/3 (`7a8e188`) — O12, komentarze w kodzie.** Pięć komentarzy w `app.js`
  obiecywało zachowanie, którego kod celowo nie ma: „marker pozycji z kołem
  dokładności” (`odswiezWarstwy` daje mapom `{lat, lon}`), „badge dokładności”,
  „reguły/filtr dokładności” (ADR 0034 pkt 2 — `ocenFix` waliduje współrzędne).
  Kontrakt 83 pinuje kształt fixa bez `accuracy` i zakazuje fraz. Do tego
  dev-tekst karty paczek (`tylko-test`): „paczki zaakceptowane przez
  właściciela” → „paczki z katalogu zaakceptowanych (moderacja zniesiona
  2026-09-11)”. `?v=m12-97`.
- **K/4 (`1365606`) — O3, O4, O5, O10, `docs/WORKFLOW.md` §3–§6.** Procedura
  gry i checklisty terenowe przepisane na UI z 2026-09-12: setup w kolejności
  z ekranu i bez języka/podkładu (ADR 0037), GPS rusza sam i nie ma pól
  ręcznych ani badge’a (ADR 0034 pkt 2/5), wklejanie sprawdza się samo
  (ADR 0006 aneks 3), wynik minimalny (ADR 0038), symulacja dojścia żyje
  w ekranie gry (`#przycisk-symulacja-gra`), pomiary terenowe bez dokładności
  GPS, progi wskazane z nazwy (`progDojsciaM`, `PROG_BATERII_M`), pkt 0 §4.4
  cytuje produkcyjny wariant stanu mostu, pkt 1 ma kolejność tożsamości
  z 2026-09-12, pkt 7 bez zdania „rankingów między grami nie ma” i nowy pkt 7a
  (dwie tabele, ≤5 pozycji, próg 10 pytań, wymóg nowego deploymentu — ADR 0039),
  §6 z kanonem w parach stałych (`TEMATY`+`TEMATY_SETUP`, `WIEK`+`WIEK_SETUP`),
  rejestrem w `docs/decisions/README.md` i paczką referencyjną `zestaw-*.json`.
- **K/5 (`608e643`) — O6, O7, O8, trzy dokumenty żywe.** `README`: kryterium M7
  zawężone do czytelności w słońcu (eksport odpadł z ADR 0038 — ROADMAP
  zawęził je 2026-09-12, README został przy starym). `ARCHITECTURE`: opis
  `wynik.js` zgodny z eksportami (`dystansTekst`, `etykietaOdcinka`,
  `wynikTekstowy`, `ROLE_PALETY`, `planObrazuWyniku`; miara sprawiedliwości
  żyje w `stacje.js`), nośnik `.paczka.json` usunięty z §Stan i trwałość.
  `ASSETS` §7: bez `REVIEW_SECRET`/`OWNER_EMAIL` (grep po `.gs`: 0 odczytów
  właściwości skryptu), bez bramki moderacyjnej, bez „kopii lokalnej” jako
  drogi wyjścia (zadanie I), akcje mostu uzupełnione; NOWY §7.2 — oceny,
  profile i ranking (`RO-ranking/2`, katalogi, deployment, quota, prywatność).
- **K/6 (`66e9e32`) — O9.** ADR 0019 dostał aneks **2026-09-12f**, który trzy
  nośniki cytowały od tygodnia (rejestr, `.gs` ×2, `test/most-ranking.test.js`).
  Aneks jest KOTWICĄ, nie kopią decyzji: co wróciło do mostu, co nie wróciło
  (odesłanie do ADR 0039), R17/R18 zajęte na stałe, ranking jako warstwa
  z belki ikon.
- **K/7 (`384cc38`) — O13…O17, `ARCHITECTURE` i komentarz w `pozycja.js`.**
  Drzewo modułów: widmowy `ui.js` (pliku nigdy nie było — rola wchłonięta do
  wpisu `app.js`, plus dwa odwołania w §Podział i §A.1) i brakujący `oceny.js`
  (dopisany: schematy `RO-ocena/1`/`RO-oceny/1`, limity 600/50, `idGlosujacego`
  i parzystość sluga z `idProfilu()` mostu). Najpoważniejszy rozjazd: próg
  dojścia opisany jako **25 m** (ADR 0004 aneks 2026-09-09) w dwóch miejscach,
  gdy `progDojsciaM()` zwraca 50 od ADR 0034 pkt 2; obok „fix niedokładny
  dostaje ostrzeżenie” (ostrzeżenia nie ma) i `ocenFix` jako „filtr
  dokładności”. Komentarz `GRANICE.wymaganeTrafnienia` twierdził, że stację
  zapala „pojedynczy fix”, przy wartości 2. `?v=m12-98`.
- **K/8 (`a7df8f2`) — strażnik dryfu i L58.** `test/dryf-dokumentow.test.js`
  (5 asert): 21 martwych fraz sprawdzanych na nośnikach ŻYWYCH z numerem
  wiersza w komunikacie błędu; drzewo modułów `ARCHITECTURE` ↔ zawartość `app/`
  w obie strony; eksporty `wynik.js` (import modułu, nie lista z ręki) ↔ opis;
  most bez `REVIEW_SECRET`/`OWNER_EMAIL`/`PropertiesService` i z
  `akcja=ranking`; cytowania „ADR NNNN aneks <data>” (także w `test/*.js`) ↔
  istniejący aneks w pliku decyzji. Historia (`PROJECT_HISTORY`, `LESSONS`,
  ADR-y, handoffy) jest poza zakresem fraz — tam cytowanie martwej frazy jest
  dowodem zmiany. Strażnik przy pierwszym uruchomieniu złapał komentarz
  `fixSymulowany` w `app/pozycja.js` („filtr dokładności”) — poprawiony.
  LESSONS **L58** (objaw → przyczyna → reguła) + reguła w `AGENTS.md` §5
  (wiersz tabeli) i §7 (przy USUWANIU przegląd w drugą stronę) + `WORKFLOW` §6.
  `?v=m12-99`.
- **K/9 (`4d1ad24`) — tytuły testów.** W `test/aplikacja.test.js` aserty były
  poprawne, tytuły nie: „badge dokładności”, „marker z kołem dokładności”
  (warstwa okręgów ma sam `okrag-promien`), „próg dokładności” (aserta
  sprawdza BRAK `maxAccuracyM`), „ręczna pozycja w trybie testowym” (atrapa
  symuluje tap w mapę). Pin P02 miał alternatywę `|pomiń odcinek` dla akcji,
  której nie ma od zadania H — przepisany na nową formę z powodem (L55).
- **K/10 (`fe0890c`) — O19, publikacja.** `WORKFLOW` §5 kazał klikać
  „Source: Deploy from a branch”, choć od 2026-09-07 Pages publikuje
  `.github/workflows/pages.yml` (Source: **GitHub Actions**: brama → `rm -rf
  .git` → artefakt `path: ./` → `deploy-pages@v4` przy każdym pushu do `main`).
  `ROADMAP`: wiersz i kryterium M8 bez „publikację włącza właściciel” (działa;
  kamień zamyka właściciel), kryterium M11/M12 bez licznika „9 punktów”
  checklisty — liczniki w dokumentach rotują przy każdej zmianie procedury.

Wersje w sesji: `?v=m12-95` → **`m12-99`** (cztery podbicia — każdy commit
dotykający `app/*.js`, także samych komentarzy: `AGENTS.md` §7, L29).

### 4. Bramy i stan po sesji

- `npm run brama`: **741/741** testów (734 na starcie sesji + kontrakt 82 i 83
  + 5 testów strażnika dryfu), `npm run check` — szablon zgodny w obu
  wariantach (PYT/1.0.8 rev4 i PYT/1.0-nofc.3 rev5), audyt kontrastu WCAG AA —
  0 naruszeń w obu motywach.
- Weryfikacja na żywo (`AGENTS.md` §7): `npm run serwer` na 0.0.0.0:8000 —
  serwowany `index.html` niesie nowe teksty i `?v=m12-99`, martwe frazy
  zniknęły (0 trafień), wszystkie moduły `app/*.js` i `app/styles.css`
  odpowiadają 200, `sw.js` ma `WERSJA_SW = 'm12-99'`. Przeglądarki w sandboxie
  nie ma (ENVIRONMENT §4.1, LESSONS L3) — wzrokową weryfikację ekranu
  „Wklej odpowiedź modelu” i karty „Dane i prywatność” zostawiamy właścicielowi
  razem z checklistami terenowymi.
- Gałąź `arena/01a0973d-okolica`, **PR #19** (11 commitów K/1–K/11), baza
  `main` = `4eb0985`. Nic nie scalone, `main` nietknięty (ADR 0012 pkt 1).
- Otwarte po sesji: deployment `.gs` z `?akcja=ranking` (właściciel), kryteria
  terenowe M3–M7 i M10–M12, decyzja o zamknięciu M8, `BACKLOG` bez zmian.
  Handoff: `docs/setup/HANDOFF_2026-09-12k.md`.
### 5. Uwagi z testów terenowych, punkt A: wiersz wyjaśnień rankingu pod tabelami (m12-100, commit `d207c56`)

Właściciel przysłał zgłoszenie z terenu: „**A. Layer Ranking.** Cały ten wiersz
wyjaśnień przenieś na koniec tego layera, pod obie tabele: »Graczy
z potwierdzonym profilem: X… Mistrzowie Zagadek liczą się od… — nikt jeszcze nie
ma tyle.«”. Wiersz (`#ranking-status`) siedział tuż pod tytułem 🏆, więc na
wąskim ekranie wypychał obie tabele w dół.

- **index.html:** `<p id="ranking-status" class="podpowiedz" role="status">`
  przeniesiony POD tabelę `#ranking-mistrzowie`, z komentarzem o powodzie.
  Kolejność w warstwie: tytuł → „Ranking Punktowy Graczy” + tabela → „Mistrzowie
  Zagadek” + tabela → wiersz wyjaśnień.
- **app/styles.css:** `#ekran-ranking #ranking-status { margin-top: 14px }` —
  tyle, ile `h3` w tej warstwie; bez tego wiersz kleiłby się do tabeli
  (`.podpowiedz` ma 6 px górnego odstępu).
- **Logika bez zmian:** `renderujRankingi()` w `app/app.js` składa te same zdania
  („Graczy z potwierdzonym profilem: N — tabele pokazują po 5 pozycji.” /
  „Ranking jest pusty — punkty zbiera gracz z potwierdzonym profilem (imię
  i PIN).” / „Mistrzowie Zagadek liczą się od 10 zadanych pytań[ — nikt jeszcze
  nie ma tyle.]”). Element pozostał JEDEN, więc stany przejściowe („Pobieram
  ranking ze wspólnego Drive…”) i awarie mostu też są na końcu warstwy — pkt 3
  decyzji wymaga, żeby warstwa mówiła wprost, dlaczego nie ma danych.
- **Pin:** kontrakt ADR 0039 (`test/kontrakt.test.js`) asertuje kolejność
  znaczników w `index.html` (`ranking-punkty` < `ranking-mistrzowie` <
  `ranking-status`) i że wiersz zachował `role="status"` (LESSONS L55: pin
  przeniesionego układu przepisujemy na nową formę). Sprawdzony negatywnie —
  symulowany powrót wiersza nad tabelę wywala asercję.
- **Dokumenty:** aneks 2026-09-12 w ADR 0039 (pkt 1–4: kolejność, jeden element,
  brak zmian reguł, pin), zdanie o wierszu wyjaśnień w README (sekcja
  „Ranking”) i w `WORKFLOW` §4.4 pkt 7a. `ARCHITECTURE` nie opisuje wnętrza
  warstwy — bez zmian.
- **Wersja:** m12-99 → **m12-100** w 42 odwołaniach `?v=` (index.html + 12
  modułów `app/*.js`, 13 plików) oraz `WERSJA_SW` — `sw.js` trzyma `./index.html`
  w cache skorupy, więc zmiana samego HTML też wymaga podbicia.
- **Bramy:** `npm run brama` — **741/741**, `synchronizuj-szablon --check` OK
  (oba warianty protokołu), audyt kontrastu WCAG AA — 0 naruszeń. Weryfikacja na
  żywo (`npm run serwer` na 0.0.0.0:8000, curl): serwowany `index.html` ma obie
  tabele przed wierszem wyjaśnień i `?v=m12-100`, `styles.css` niesie nową
  regułę odstępu, `sw.js` ma `WERSJA_SW = 'm12-100'`. Wzrokowo układ na telefonie
  potwierdza właściciel (brak przeglądarki w sandboxie — ENVIRONMENT §4.1, L3).
- **Pułapka sesji (LESSONS L59):** sandbox wrócił z plikami ze snapshotu, ale
  `.git` był świeżym klonem bazy `4eb0985` — lokalna gałąź stała 11 commitów za
  origin, a `git status` pokazywał całą sesję K (27 plików) jako niecommitowaną.
  Ratunek: `git fetch origin <gałąź>` + `git reset --mixed FETCH_HEAD` (przesuwa
  wskaźnik i indeks, NIE rusza plików) i dopiero wtedy commit zadania.
- Punkt A domknięty; dalsze punkty zgłoszenia właściciela (B, C…) oczekiwane.

## Sesja 2026-09-13 — uwagi terenowe właściciela A–K i M: 13 commitów, m12-100 → m12-110 (gałąź `arena/01a0973d-okolica`, PR #19)

Zakres: pełna partia zgłoszeń z testów terenowych właściciela (punkty A, B, C,
D — wycofane i poprawione, E, F, G, H1, H2, I, J, K, L, M). Każdy punkt = decyzja
właściciela → ADR (nowy albo aneks) → kod → pin w `test/kontrakt.test.js` →
dokumenty żywe → podbicie wersji → osobny zielony commit wypchnięty od razu
(AGENTS.md §2). Bilans: 53 pliki, +4 586 / −1 557 (od `d207c56`), brama na końcu
sesji **760/760** testów, szablon zgodny, audyt WCAG AA 0 naruszeń.

### 1. Uwaga A (m12-101, `8ef27c5`) — pytanie i odpowiedzi w zwijanym elemencie

Pytanie na stacji i możliwe odpowiedzi chowają się w `<details>` (właściciel:
w słońcu i w ruchu treść ma być dostępna na żądanie, nie zawsze rozwinięta).
Zwinięcie jest stanem domyślnym w grze, a otwarcie nie resetuje odcinka ani
nie pauzuje śledzenia (ADR 0040: pauzy nie ma).

### 2. Uwagi B i E (m12-102, `fac0441`) — koniec systemu pauzy: **ADR 0040**

Właściciel: gra i śledzenie GPS idą CAŁY czas, po powrocie z tła wszystko
wznawia się samo, bez kliku i bez komunikatu. Usunięte: profile GPS, pauza
w tle (`pauzaWTle`), kody `P07`/`P09` i etykieta „⏸ Wznów grę i idź dalej →”.
Po powrocie z tła aplikacja sprawdza, czy nasłuch żyje, i zakłada świeży (bug G
z 2026-09-12: WebKit trzyma czasem `watchPosition` aktywny, ale niemy — LESSONS
L56).

### 3. Uwagi B i C (m12-103, `423aae9`) — Wake Lock i jedyna przerwa: **ADR 0040 pkt 4–5**

Ekran nie gaśnie podczas gry (Wake Lock żądany na nowo po każdym powrocie
z tła, bo przeglądarki zwalniają go przy `hidden`), a JEDYNA przerwa w grze to
kwadrans bez żadnej akcji gracza — wznawia ją dowolny klik, bez przycisku
i bez pytania (`sprawdzBezczynnosc`, `zaznaczAktywnosc`).

### 4. Uwaga D po wycofaniu (m12-104, `0c527b4`) — obrót ekranu bez blokady

Właściciel wycofał swój pomysł: NIE ma blokady portretowej ani ikony przełączania
orientacji (propozycja odrzucona 2026-09-13). Zostało tylko jedno: po każdej
zmianie orientacji automatycznie woła się ◎ (centrowanie na graczu) na widocznej
mapie — `naZmianeRozmiaruOkna` z uspokojeniem po `resize`.

### 5. Uwaga M (`db4d619`) — sygnał zdarzenia to dźwięk I wibracja: **ADR 0041**

Decyzja i pin: sygnały (`odegrajSygnal`) mają plan dźwiękowy i wzorzec wibracji
dla każdego zdarzenia (m.in. dojście, start odcinka, odliczanie, start gry).
W testach `odegrajSygnal` jest niemy w Node, więc dowodem sygnału jest rejestrator
`navigator.vibrate` w atrapie DOM (`dom.wibracje`) — i celowo NIE asertujemy
dokładnej liczby wibracji, bo `przelaczNa()` podmienia globalny `navigator`.

### 6. Uwaga L (m12-105, `81e8576`) — pula premii za kolejność

Premia za kolejność ukończenia: pula = **min(3, grający − 1)**, gdzie „grający”
to gracze bez rezygnacji w momencie zakończenia gry (1 grający → 0 pkt, 2 → 1/0,
3 → 2/1/0, 4+ → 3/2/1/0). Wcześniej stała tabela 3/2/1 niezależnie od liczby
graczy (aneks ADR 0027 z 2026-09-11). Zmiana PO OBU stronach: `przeliczWyniki`
w `app/wieloosobowa.js` i kopia w `docs/setup/apps-script-repo-paczek.gs`
(`most-gra.test.js` wykonuje wycinek `.gs`, więc stałe żyją w wycinku, a parity
pilnuje test). Stała `[3, 2, 1][i]` nie istnieje po żadnej stronie (LESSONS L31).

### 7. Uwaga H2 (m12-106, `88b93a7`) — Informacje jedną, małą czcionką: **ADR 0042**

Cała treść warstwy Informacje jedną małą czcionką (`Courier New`), bez wyróżnień
typograficznych — właściciel chce jednego kroju dla całej instrukcji.

### 8. Uwagi H1 i I (m12-107, `c0aedb8`) — koniec gry za ikoną ⚙ START GRY: **ADR 0043**

H1 unieważniło część F: przycisk „Zakończ grę” NIE zostaje w Informacjach.
Koniec gry i rezygnacja przeniosły się do ikony ⚙ START GRY w nagłówku: mała
warstwa potwierdzenia (`#ekran-koniec-gry`) z wpisaniem **TAK** odblokowuje
przycisk „■ ZAKOŃCZ AKTUALNĄ GRĘ”. Warstwa zachowuje się jak każdy panel
(krzyżyk, Escape, `inert` na resztę, klasa na `body`), a każdy krok gry ją gasi.
Pułapka sesji (LESSONS L61): reguły widoczności z klasą na `body` chowają każdy
panel niewymieniony w `:not()` — atrapa DOM nie ma silnika CSS, więc kolejność
otwierania i regułę CSS pinuje kontrakt, nie test zachowania.

### 9. Uwaga F (m12-108, `ec5eff6`) — odliczanie po starcie gry wieloosobowej: **ADR 0044**

Po „▶ Start gry” u WSZYSTKICH (także u hosta) gra sygnał i odlicza
5-4-3-2-1-START wielką cyfrą na środku, nad przezroczystym tłem (mapa zostaje
widoczna — `#odliczanie`, `z-40`, sygnał na każdy krok). Potem gra wygląda
DOKŁADNIE jak hotseat: usunięty panel multi z kanałem „Info z gry”, żywą tabelą
wyników i paskiem „Ostatni stan” (pasek został w lobby), a karty
„⏹ Zakończ grę (host)” i „🏳 Rezygnuję z gry” zniknęły (obsługuje je ⚙ + TAK).
Informacje nie zniknęły z produktu: ostateczna tabela tej gry jest na ekranie
wyniku (`wynikiMultiKonca`), ranking między grami w warstwie pucharu (ADR 0039),
a żywe wyniki w lobby dla widowni (`#lobby-widownia-wiersze` — warstwa ta została
później usunięta w całości, uwaga terenowa 2026-09-16 pkt 1). Odliczanie w
testach ma 20 ms na krok, żeby cały przebieg nie spowalniał bramy. Aneks „uwaga F”
w ADR 0019. Bramy: 756/756.

### 10. Uwaga G (m12-109, `6339d32`) — koniec gry hosta nie kończy gry pozostałym

Właściciel: zakończenie gry przez hosta NIE kończy gry u pozostałych — grają
dalej i mają wszystkie informacje, bo telefon hosta służył tylko do
wystartowania gry, wybrania okolicy i wygenerowania pytań, a logika i punkty żyją
na wspólnym Drive i na telefonach uczestników. Wdrożenie (aneks **2026-09-13b**
w ADR 0019): potwierdzony koniec (⚙ → TAK) wysyła zdarzenie `rezygnacja` dla
KAŻDEJ roli, `zakonczGreMulti()` usunięta, aplikacja nie woła akcji
`gra-zakoncz`. W moście `if (z.typ !== 'koniec' && czyKompletna(gra))` —
rezygnacja TEŻ może domknąć grę, bo `czyKompletna()` liczy rezygnującego za
domkniętego; bez tego gra wisiałaby otwarta, gdy ostatni aktywny gracz wychodzi.
**To wymaga nowego deploymentu web app u właściciela.** Akcja `gra-zakoncz`
została w moście dla starszych telefonów (offline'owa skorupa z SW) i ręcznego
porządkowania gier na Drive. Premia liczy się bez zmian: host, który wyszedł, nie
wchodzi do puli (uwaga L). Bramy: 757/757.

### 11. Uwagi J i K (m12-110, `a041c64`) — setup nie szuka gier, telefon wraca sam: **ADR 0045**

J: szukanie rozpoczętych/przerwanych gier w `localStorage` i pokazywanie ich jako
opcji na setupie — usunięte w całości (karty `#karta-wznowienie` i
`#multi-wznowienie` z ich przyciskami, klasa `.karta-wznowienie`, funkcje
`sprawdzZapisGry()`, `kasujZapisGry()`, `renderujWznowienieMulti()`).
K: zamknięcie przeglądarki/karty i odświeżenie zapisują stan (zapis po każdej
tranzycji + `pagehide` + `visibilitychange → hidden`), a otwarcie aplikacji wraca
wprost do ostatniego zapisu: multi z sesji i stanu mostu (`przywrocGreMulti`,
pierwszeństwo, bez odliczania), hotseat z `stan-gry/1` (`przywrocGreHotseat` →
`wznowGre`), z pominięciem okna startowego (`ukryjStart`). Zapis, którego nie da
się podnieść (zepsuty — kody `T**`, albo gra w fazie `koniec`), start kasuje sam
i mówi dlaczego. Sesję multi kasują cztery drogi: wyjście z lobby, zamknięcie gry
przez most, rezygnacja (także hosta — uwaga G) i jawna odmowa mostu; awaria sieci
sesji NIE kasuje. Dwustopniowe kasowanie zostało tylko przy historii gier
(ADR 0015 pkt 6). Bramy: 759/759.

### 12. Budżet lektury startowej (`3d6ae93`) — LESSONS rozdzielony

`npm run budzet` doszedł do 99 281 / 100 000 tok (rezerwa 719), więc AGENTS.md §0
uczynił skrócenie/rozdzielenie dokumentów obowiązkowym zadaniem sesji. Rejestr
`docs/LESSONS.md` został skrótem (objaw i przyczyna jednym zdaniem, reguła w
całości, osiem najdłuższych reguł z początkiem), a pełne opisy przypadków
przeniesiono do `docs/LESSONS_ARCHIVE.md` — poza `plikLektury()`, z odnośnikiem
`## LN` przy każdej lekcji i pinem, że archiwum jest lustrem rejestru.
Diagnoza w AGENTS.md §0 i LESSONS L62: największy zjadacz budżetu to ADR-y
(~65 tys. z 100 tys.), więc następny podział idzie w `docs/decisions/archive/`.
Nowe lekcje: **L62** (budżet: tnij największego zjadacza) i **L63** (usuwasz
przycisk-ujście → wypisz stany, które obsługiwał, i każdemu daj drogę
automatyczną). Bramy: 760/760.

### 13. Pułapki i stan końcowy

- **Powtórka L59 w trakcie sesji:** sandbox odtworzył `.git` ze świeżego klona
  bazy, przez co `git add -A` stagedował całą sesję, a push był odrzucony
  (non-fast-forward). Rutyna, która zadziałała i jest teraz w L59/L62: przed
  każdym committem `git log --oneline -2` + `git ls-remote origin <gałąź>`; gdy
  HEAD ≠ origin, `git fetch` + `git reset --mixed FETCH_HEAD` (przesuwa wskaźnik
  i indeks, nie rusza plików) i `git diff --cached --stat` przed committem.
- **Kotwiczenie edycji dokumentów:** WORKFLOW i README mają własne łamanie wierszy
  i cudzysłowy `„…”` zamykane prosto — kotwice bloków muszą być KRÓTKIE i bez
  znaków cudzysłowu, a przed podmianą warto `sed -n`/`cat -A` pokazać dokładne
  wiersze (dwa nieudane podejścia do README w tej sesji).
- **Otwarte po stronie właściciela:** (1) NOWY deployment web app z mostu
  `docs/setup/apps-script-repo-paczek.gs` — bez niego uwaga G domknie grę dopiero
  przy kolejnym zdarzeniu gracza, który jeszcze gra; (2) powtórka testów
  terenowych dwóch telefonów (kryterium M11/M12, WORKFLOW §4.4) ze szczególnym
  sprawdzeniem odliczania, końca gry hosta i powrotu po odświeżeniu;
  (3) budżet lektury ma 1 131 tok rezerwy — następny ADR go przekroczy, więc
  podział ADR-ów (AGENTS.md §0, L62) stanie się zadaniem obowiązkowym.

## Sesja 2026-09-13b — audyt PR #19: martwe ujścia w komunikatach i panel fazy B schowany razem z przodkiem (gałąź `arena/01a09b63-okolica`)

### 1. Audyt PR #19 (squash `b3433ff`, 57 plików, +5818/−1651)

Brama na drzewie `main` przed pracą: `npm test` → **760/760**, `npm run check`
OK (oba szablony), `npm run audyt` → 0 naruszeń WCAG AA, budżet lektury
98 925/100 000 tok (rezerwa 1 075). Przegląd `git diff b3433ff^..b3433ff`
plik po pliku: logika, zgodność z ADR 0040–0045 i z protokołem, zieloność.

- **`app/aktywnosc.js` (nowy)**: dwie funkcje czyste — `czyPrzerwaBezczynnosci`
  (próg 15 min) i `czyTrzymacEkran` (decyzja Wake Lock). Bez DOM i bez zegara
  w środku (zegar wstrzykiwalny), komentarze cytują ADR 0040. OK.
- **`app/orientacja.js` (nowy)**: `kierunekEkranu` i `czyObrotEkranu` — czyste,
  bez `window` w sygnaturze, pokrywają ADR 0030 aneks 2026-09-13. OK.
- **`app/pozycja.js`**: `PROFILE_GPS` zredukowany do jednego profilu `dokladny`,
  `profilBaterii` usunięty, kody **P07/P09** wycofane z komentarzem, że numery
  zostają zajęte (precedens E14/E18/R17/R18) — zgodne z ADR 0040 pkt 2–3. OK.
- **`app/wieloosobowa.js`**: `premiaZaKolejnosc` liczy `pula = min(3, dograli − 1)`
  z `dograli` = gracze bez `rezygnacja`; lustro w `.gs` liczy tak samo. OK (uwaga L).
- **`app/sygnaly.js`**: dwa nowe plany — `odliczanie` (45 ms, 880 Hz) i `startGry`
  (dwuton 784 → 1174,7 Hz). Plany są danymi, odtwarzanie zostaje w `app.js`
  (ADR 0041/0044). OK.
- **`app/app.js`** (największy kawałek fali): brak pauzy i wznawiania
  (Wake Lock + watchdog bezczynności 15 min + samoczynny powrót), auto-centrowanie
  po obrocie (`mapa.centrujNaPozycji()` istnieje, L968), koniec gry przez
  ⚙ START GRY → TAK → `■ ZAKOŃCZ AKTUALNĄ GRĘ`, odliczanie 5-4-3-2-1-START,
  panel multi usunięty (wybór stacji przeniesiony do fazy A). Wszystkie ścieżki
  zgodne z ADR 0040–0045; `STAN.kierunekEkranu` inicjowany w `start()`. OK.
- **`index.html`**: `</div></div>` stojące po komentarzu o usuniętym
  `#przycisk-zakoncz-gre` NIE są osierocone — zamykają `#gra-sterowanie`
  i `#gra-slot-sterowanie` dokładnie tak samo przed falą (porównanie `sed` na
  drzewie `b3433ff^` i `b3433ff`). Struktura zachowana. OK.
- **Wersjonowanie**: `?v=m12-110` w `index.html` i we wszystkich importach
  `app/*.js`, `WERSJA_SW = 'm12-110'` — jeden łańcuch w całym grafie (L29). OK.
- **`docs/setup/apps-script-repo-paczek.gs`**: `rezygnacja` może domknąć grę
  (`czyKompletna` liczy rezygnującego za domkniętego), `gra-zakoncz` zostaje dla
  starszych telefonów i porządków na Drive, premia bez hosta, który wyszedł.
  **Wymaga nowego deploymentu web app** — otwarte po stronie właściciela.
- **Reszta** (`trwalosc.js`, `sync.js`, `mapa.js`, `protokol.js`, `stacje.js`,
  `zestawy.js`, `sieci.js`, `rozgrywka.js`, `wynik.js`, `most.js`, `sw.js`):
  podbicia wersji, komentarze i dokumentacja — bez zmian logiki.
- **Kosmetyka bez wpływu**: w `onStanGryMulti` jeden `if` ma 6 spacji wcięcia
  zamiast 4.

**Werdykt:** architektura PR #19 jest spójna z ADR 0040–0045 i z protokołem,
a brama zielona. Audyt znalazł natomiast **dwie usterki widoczne dla gracza**
(poniżej) — obie są skutkiem tej samej fali usuwania i obie przeszły przez
760 zielonych testów, bo testy czytają zachowanie w atrapie DOM, nie rendering
w przeglądarce ani tekst komunikatów awaryjnych.

### 2. U1 (blokująca): pięć komunikatów awaryjnych odsyła do przycisku, który ta fala usunęła

ADR 0043 zniósł `#przycisk-zakoncz-gre` („■ Zakończ grę”) i przeniósł koniec gry
za ikonę ⚙ START GRY (wpisanie TAK → „■ ZAKOŃCZ AKTUALNĄ GRĘ”). Dokumenty żywe
(README, WORKFLOW §3 pkt 6, ARCHITECTURE) i warstwa HTML zostały przestawione,
ale **tabele komunikatów w modułach nie**:

| Miejsce | Komunikat | Stan po fali |
|---|---|---|
| `app/pozycja.js` **P03** | „…zakończ grę przyciskiem „■ Zakończ grę” (ADR 0029…)” | przycisku nie ma |
| `app/pozycja.js` **P04** | „…zakończ grę przyciskiem „■ Zakończ grę”.” | przycisku nie ma |
| `app/pozycja.js` **P08** | „…odśwież stronę albo zakończ grę przyciskiem „■ Zakończ grę”.” | przycisku nie ma |
| `app/pozycja.js` **P06** (`stanDojscia`, brak współrzędnych stacji) | „…albo zakończ grę przyciskiem „■ Zakończ grę”.” | przycisku nie ma |
| `app/app.js` L1393 (`onBlad` watchera) | „…zakończ grę przyciskiem „■ Zakończ grę”.” | przycisku nie ma |

To są dokładnie te zdania, które gracz czyta w terenie, gdy GPS nie daje fixa
albo stacja jest nieosiągalna — czyli w jedynym stanie, w którym ujście jest
potrzebne (L63: przycisk-ujście). W polu gracz dostaje instrukcję „naciśnij
przycisk”, którego na ekranie nie ma (L58: utrata zaufania, zmarnowany test
terenowy), a prawdziwe ujście (trzy ruchy: ikona → TAK → przycisk) wymaga
wpisania TAK, więc bez poprawnej instrukcji nie jest oczywiste.

Dwa dalsze martwe ujścia z tej samej rodziny (starsze niż PR #19, znalezione
przy tym samym grep-ie — L58 pkt 1 każe grepać nośniki żywe, nie tylko kod fali):

- `app/app.js` L2961 (`renderujPytanie`, uszkodzony kontener): „…Zakończ grę
  albo wgraj paczkę ponownie **z pliku**.” — wczytywania paczki z pliku nie ma
  od 2026-09-07 (ADR 0006 aneks 3); paczka przychodzi z repozytorium albo
  z wklejonej odpowiedzi modelu.
- `app/wieloosobowa.js` **R19**: „…sprawdź pisownię albo zapisz go przyciskiem
  „Zapisz nowy”.” — takiego przycisku nie ma w `index.html` (bramka tożsamości
  to `#profil-pseudonim` + `#profil-pin` i jedno wołanie `profil-ustaw`,
  ADR 0026); nowe imię zakłada profil tym samym gestem.

**Dlaczego brama tego nie złapała:** `test/dryf-dokumentow.test.js` (strażnik L58)
ma 30 martwych fraz z fal H/I/J oraz ADR 0034/0037/0038/0039/0040/0045, ale
**ani jednej** dla fali ADR 0043 — fraza „■ Zakończ grę” nie została wpisana
przy usuwaniu przycisku. Dodatkowo audyt PR #18 (sesja 2026-09-12K) zapisał te
komunikaty jako poprawne („komunikaty P03/P04/P08 … odsyłają do „■ Zakończ grę”
(ADR 0029 aneks m12-94). OK.”) — fala m12-107/110 usunęła przycisk i nie
wróciła do zdań, które na niego wskazywały (L27: zastąpiony przycisk musi być
wymieniony we wszystkich komunikatach).

### 3. U2 (blokująca dla trybu testowego): panel fazy B jest schowany razem z przodkiem

`odswiezPasekDrogi()` robi dwie rzeczy naraz: `$('gra-sterowanie').hidden = droga`
oraz `$('gra-pasek').hidden = !droga`. Panel fazy B (`#gra-panel-odcinek`) jest
W ŚRODKU `#gra-sterowanie`, a `styles.css` ma twardą regułę
`[hidden] { display: none !important; }` — więc w stanie „w drodze” przodek gasi
panel B razem z dużym dystansem (`#gra-dystans-odcinka`) i z przyciskiem
„▶ Symuluj dojście (tryb testowy)”, który `renderujGre` (L2162) w tej samej
tranzycji jawnie odsłania: `hidden = !(STAN.trybTestowy && faza === odcinek)`.

Pomiar w prawdziwej przeglądarce (headless Chromium 153, 390×844, ENVIRONMENT
§4.1, stan „w drodze” ustawiony dokładnie tymi dwoma zdaniami z
`odswiezPasekDrogi`):

| Węzeł | `hidden` | `getBoundingClientRect()` | `offsetParent` |
|---|---|---|---|
| `#przycisk-symulacja-gra` | false (tryb testowy) | **0×0** | **null — nie renderowany** |
| `#gra-dystans-odcinka` | false | **0×0** | null |
| `#gra-komunikat` | false | **0×0** | null |
| `#gra-panel-odcinek` | false | **0×0** | null |
| `#gra-pasek` | false | 370×0 (pusty w próbie) | tak — żyje poza panelem |

Skutek: **w przeglądarce nie da się kliknąć symulacji dojścia**, choć
`WORKFLOW` §3 pkt (tryb testowy w domu) i §4.3 pkt 3 oraz `ARCHITECTURE`
L209 obiecują ten przycisk, a ADR 0036 aneks 2026-09-13 (m12-102) pkt 2 mówi
wprost: „Panel fazy B trzyma duży dystans i symulację **dla widoku panelowego
oraz trybu testowego**”. Atrapa DOM nie modeluje kaskady ani przodków
(`kliknij` nie pyta o renderowanie), więc 20 wywołań `dojdzSymulacja()`
w `test/aplikacja.test.js` jest zielonych — powtórka L13 w nowej postaci.
Drugi skutek: `#gra-komunikat` (P06 w odcinku) nie ma w drodze żadnego nośnika.

### 4. Obserwacje mniejszej wagi (bez naprawy w tej sesji)

- `przelaczPodgladMapy()` (oko) nie zamyka warstwy końca gry, więc przy otwartym
  potwierdzeniu klik oka gasi wszystkie panele (`body.podglad-mapy`) i gracz
  widzi pustą mapę; drugi klik przywraca kartę, a Escape zamyka potwierdzenie
  (obsługa Escape sprawdza warstwę przed podglądem). L61 pkt 2 mówi o zamykaniu
  nowej warstwy przez ISTNIEJĄCE otwieracze — oko jest przełącznikiem podglądu,
  nie warstwą, więc zachowanie jest spójne z jego sensem („pokaż mapę”).
  Zostawione celowo; gdyby właściciel uznał to za mylące, poprawka to jeden
  `zamknijKoniecGry({ bezFokusu: true })` w `przelaczPodgladMapy`.
- Komentarz w `renderujGre` (L2125) uzasadnia „panele nie przełączają się w
  trakcie pokazu oceny” automatyczną pauzą po `visibilitychange` — mechanizmu
  pauzy nie ma od ADR 0040 pkt 3 (zostało samo odświeżenie nasłuchu). Reguła
  jest nadal słuszna i pinowana testami, uzasadnienie jest historyczne.
- `docs/setup/HANDOFF_2026-09-13.md` podaje „`docs/LESSONS.md` (8 550 tok) —
  rejestr L53-L63”. Stan rzeczywisty po podziale (L62): rejestr ma **wszystkie**
  lekcje L1–L63 i **11 803 tok**; do archiwum wyniosły się pełne opisy
  przypadków, nie wpisy rejestru. Handoff jest nośnikiem zamrożonym (historia),
  więc liczba zostaje w nim bez zmian — prostuje ją ten wpis i handoff tej sesji.
- Komentarze w `app/app.js`, `app/stacje.js`, `app/rozgrywka.js` i
  `docs/ARCHITECTURE.md` cytują „ADR 0014 pkt 1” (dystanse odcinków z sieci),
  a plik ADR 0014 jest od 2026-09-07 streszczeniem bez punktów — cytat prowadzi
  do treści, która żyje tylko w historii gita.

### 5. Budżet lektury (`335518d`) — ADR-y wycofane w całości do archiwum

Rezerwa na starcie sesji wynosiła 1 075 tok, a AGENTS.md §0 i LESSONS L62 każą
w takiej sytuacji ciąć największego zjadacza (ADR-y ~65 tys. z 100 tys.), nie
LESSONS, który swoje archiwum już ma. `git mv` przeniosło **ADR 0014**
(punktacja czasu, wycofana 2026-09-07) i **ADR 0031** (generowanie partiami,
wycofane tego samego dnia) do `docs/decisions/archive/`; `plikLektury()` filtruje
`^\d{4}-.*\.md$` w katalogu głównym, więc podkatalog wyszedł z budżetu bez zmian
w narzędziu. Rejestr stracił tylko ścieżkę linku — wiersze i statusy zostały,
a pin „ADR na dysku ↔ rejestr” obejmuje obie ścieżki. Przy 0014 dopisane, co
z dawnej decyzji obowiązuje (pkt 1: dystanse odcinków z sieci), bo cytują go
żywe nośniki (`app/stacje.js`, `app/rozgrywka.js`, `app/app.js`, ARCHITECTURE),
a plik był streszczeniem bez punktów — obserwacja 4 z części 1 zamknięta.
Nowy pin pilnuje, że archiwum NIE wchodzi w `plikLektury()`, że rejestr i
AGENTS.md §0 o nim mówią i że leżą tam wyłącznie ADR-y ze statusem *Wycofana*
(wzorzec pinu archiwum LESSONS). Budżet: 98 925 → **97 642** tok.

### 6. Naprawa U1 (m12-111, `2b57579`) — komunikaty odsyłają do prawdziwego ujścia

Wszystkie zdania z tabeli w części 2 przestawione na drogę z ADR 0043
(⚙ START GRY → wpisz TAK → „■ ZAKOŃCZ AKTUALNĄ GRĘ”): `app/pozycja.js` P03,
P04, P08 i komunikat `stanDojscia` o braku współrzędnych stacji (P06);
`app/app.js` status `onBlad` watchera, uszkodzony kontener paczki (traci też
martwą drogę „wgraj paczkę ponownie z pliku” — teraz prowadzi do repozytorium
albo do wklejenia odpowiedzi modelu), paczka rozjechana z rozgrywką i T07
(zapis ponad 2 MB); `app/wieloosobowa.js` R19 (bez przycisku „Zapisz nowy” —
bramka tożsamości to imię + PIN i jedno wołanie `profil-ustaw`, ADR 0026).

Drugi nośnik zdania o dojściu: w drodze `#gra-komunikat` jest schowany razem
z całym `#gra-sterowanie`, więc kod dojścia (P06) idzie też do `status()` —
`#status` w ⓘ Informacjach ma `aria-live`, więc zdanie nie ginie i nie dokleja
nic do paska (ADR 0042: Informacje zostają warstwą techniczną).

Strażnik dryfu (L58) dostał trzy frazy tej fali — `zakończ grę przyciskiem`,
`wgraj paczkę ponownie z pliku`, `przyciskiem „Zapisz nowy”` — i poprawiony
`powod` wpisu o pomijaniu stacji, który sam cytował martwy przycisk. Nowy
kontrakt czyta **wiersze kodu** `app.js` (helper `wierszeKodu()` wycina
komentarze blokowe i liniowe, bo nagrobek L31 może cytować martwą etykietę)
i wymaga, żeby każde zdanie o końcu gry nazywało ikonę ⚙ START GRY; do tego piny
w `test/pozycja.test.js` (zakaz frazy + niezmiennik ⚙/TAK dla kodów P i dla
`stanDojscia`) i w `test/wieloosobowa.test.js` (R19). Wszystkie cztery testy
były najpierw czerwone (odtwarzały usterkę), dopiero potem poszła implementacja.

### 7. Naprawa U2 (m12-112, `b9a70cf`) — panel fazy B w trybie testowym zostaje

`$('gra-sterowanie').hidden = droga && !STAN.trybTestowy;` — w terenie bez zmian
(nad mapą zostaje sam pasek, ADR 0043 pkt 1), w trybie testowym panel fazy B
robi to, co obiecuje ADR 0036 aneks m12-102 pkt 2. Pomiar headless Chromium 153
(390×844) po poprawce, stan „w drodze”:

| Węzeł | teren | tryb testowy |
|---|---|---|
| `#gra-pasek` | renderowany | renderowany |
| `#gra-panel-odcinek` | 0×0, `offsetParent: null` | **370×124, widoczny** |
| `#przycisk-symulacja-gra` | 0×0, `offsetParent: null` | **328×45, widoczny** (cel ≥ 44 px, ADR 0011) |
| `#gra-dystans-odcinka` | 0×0 | **340×29, widoczny** |
| `#gra-komunikat` | 0×0 | **370×41, widoczny** |

Testy: istniejący test drogi chodzi w `?tryb=test`, więc jego asercja „panel
schowany” zamieniona na „panel zostaje, symulacja osiągalna”, a zachowanie
terenowe dostało **osobny test prawdziwą drogą** (atrapa `navigator.geolocation`,
`naEkranPozycji` → fix → „Dalej” → paczka z fixture → „▶ Idę do stacji”): pasek
widoczny, panel schowany, symulacji nie ma (ADR 0029: dojście zalicza tylko GPS).
Pin w `test/kontrakt.test.js` przepięty na nowe zdanie.

### 8. Dokumenty i lekcje (`11f3415`, `68e3760`)

- **ADR 0043 aneks 2026-09-13b** — lista przestawionych zdań i trwała
  konsekwencja (przegląd nośników musi objąć tabele komunikatów); L63 każe taką
  listę wpisać do ADR-a, nie do handoffu.
- **ADR 0036 aneks 2026-09-13b** — pkt 2 aneksu m12-102 doprecyzowany: teren
  schowany, tryb testowy panelowy, plus drugi nośnik zdania o dojściu.
- **ADR 0029 aneks 2026-09-13b** — zdanie aneksu m12-94 o odsyłaniu do
  „■ Zakończ grę” jest nieaktualne w części o przycisku; mechanika (tylko GPS,
  stacja nieosiągalna = brak punktu) bez zmian.
- **WORKFLOW §3 pkt 6** — wyjątek trybu testowego przy „nad mapą zostaje sam
  pasek”; §4.3 pkt 3 (symulacja) i ARCHITECTURE L209 są znowu prawdziwe bez
  zmian — dokumenty miały rację, kod nie.
- **LESSONS L64** (tabele komunikatów przy usuwaniu przyciska) i **L65**
  (`hidden` na przodku a atrapa DOM) — skrót w rejestrze, pełne opisy z
  pomiarami i listą testów w `docs/LESSONS_ARCHIVE.md`.

### 9. Bramy, stan końcowy i rzeczy otwarte

`npm test` **763/763** (przybyły trzy: kontrakt zdań o końcu gry, kontrakt
archiwum ADR-ów, droga terenowa), `npm run check` — oba szablony zgodne,
`npm run audyt` — 0 naruszeń WCAG AA, `npm run budzet` — **99 165/100 000**
(rezerwa 835 tok; ostatnie 80 zjadł wpis w ROADMAP o tym audycie). Wersja
aplikacji **m12-112** (`?v=` w `index.html` i we
wszystkich importach + `WERSJA_SW`).

- **Powtórki lekcji w tej sesji:** L27/L58/L63 (U1 — zdania po usuniętym
  przycisku; audyt PR #18 zapisał je jako poprawne, fala ADR 0043 nie wróciła do
  nich) i L13 (U2 — atrapa DOM nie widzi renderowania). Obie pułapki dostały
  piny, więc następna fala ma bramę.
- **Otwarte po stronie właściciela:** (1) deployment web app z mostu
  `docs/setup/apps-script-repo-paczek.gs` — bez zmian w tej sesji, ale nadal
  wisi z PR #19 (`rezygnacja` domykająca grę); (2) powtórka testów terenowych
  dwóch telefonów (WORKFLOW §4.4) — teraz z poprawionymi komunikatami GPS, więc
  warto sprawdzić w terenie zdanie P03/P04 i dojście przez ⚙ START GRY → TAK;
  (3) sprawdzenie w live preview, że w `?test=true` panel fazy B z przyciskiem
  symulacji jest widoczny w marszu (pomiar agenta: 328×45 px).
- **ROADMAP M11/M12** (`03d7a75`): stan kamienia przed powtórką testu terenowego
  mówi teraz o audycie fali m12-100 → m12-110 i o dwóch naprawionych usterkach —
  żeby następna sesja nie czytała „wszystko wdrożone” jako „wszystko poprawne”.
- **Budżet:** rezerwa 835 tok — następny ADR albo lekcja przekroczy próg, więc
  kolejna sesja zaczyna od cięcia (L62): największy pojedynczy zjadacz to
  ADR 0019 (5 368 tok), a mechanizm archiwum dla ADR-ów wycofanych już stoi.

## Sesja 2026-09-13c — drugi test terenowy: zgłoszenia N–S, pięć wdrożonych i jedno wycofane (gałąź `arena/01a09b63-okolica`, PR #20)

Kontynuacja sesji 2026-09-13b (audyt PR #19, naprawy U1 i U2, m12-112).
Właściciel wrócił z drugiego testu terenowego z sześcioma zgłoszeniami (N–S):
pięć wdrożonych, jedno (S) wycofane przez właściciela po wspólnym sprawdzeniu
założeń. Wersja aplikacji **m12-112 → m12-113** — cache-busting całej fali
poszedł w jednym commitcie razem z poprawką O (`180cadb`).

### 1. Zgłoszenia i decyzje

| # | Objaw z terenu | Decyzja | Gdzie |
|---|---|---|---|
| N | po zamknięciu przeglądarki i ponownym wejściu stacja nr 2 stawała się nr 1 | wdrożone: numer stacji jest częścią trasy, nie indeksem listy | `31504f8` (m12-113), ADR 0019 aneks 2026-09-13c |
| O | na setupie stoi boks z poprzednią grą, a stać nie powinien | wdrożone: **cała funkcja usunięta** (wybór właściciela), nie przeniesiona | `180cadb`, `40cc4a0`; ADR 0010 aneks, ADR 0015 aneks |
| P | przedrostek „repozytorium:" przed nazwą paczki nic nie wnosi | wdrożone: wiersz zaczyna się od miejsca | `e7ae8cf`; ADR 0017 aneks |
| Q | litera „Q" przy paczce nic nie mówi | wdrożone: znaczek mówi „Fact-checked", styl bez zmian | `c3697d7`, `d1c72b6`; ADR 0032 aneks |
| R | trasa ukryta (jedna stacja z numerem 1) poza Wspólną Trasą | wdrożone: sekret tylko w ŻYWEJ grze sieciowej z włączoną opcją | `31504f8`; ADR 0019 aneks 2026-09-13c |
| S | nazwa paczki powinna brać się z nazwy stacji, a wybór prowadzić przez ekran stacji | **wycofane przez właściciela** — sprawdzenie pokazało, że zmiana byłaby szkodliwa | bez zmiany kodu; ADR 0017 aneks |

### 2. N — cel zachowuje numer stacji po wznowieniu (`31504f8`)

Objaw miał dwie przyczyny, zależne od trybu:

- **hot-seat**: zapis stanu niesie całą rozgrywkę (`biezacaStacja`,
  `odpowiedzi`, `punkty`), więc numer i punkty wracają same — nowy test
  w `aplikacja.test.js` przechodzi trasę „stacja 1 zaliczona → marsz do
  stacji 2 → reload" i sprawdza zarówno stan (cel = 2, odpowiedź policzona jako
  poprawna, punkty zachowane), jak i warstwę pinezek (numery 1, 2, 3 na mapie
  gry). Tu właściciel prosił o weryfikację punktów — punkty żyją w zapisie, nie
  w przeliczeniu po wznowieniu.
- **gra sieciowa**: powrót buduje rozgrywkę z NIEZAMKNIĘTYCH stacji
  (`uruchomGreMulti`), więc indeks na liście przestawał być numerem na trasie.
  Stacje niosą teraz pole `numer` (pozycja na pełnej trasie), `planMapy`
  w `mapa.js` woli je przed indeksem, a napisy „stacja X z Y", „Idę do stacji X"
  i etykieta przycisku „dalej" biorą numer z trasy (`numerStacjiTrasy`,
  `liczbaStacjiTrasy` w `wieloosobowa.js`). Zamknięte stacje nadal nie wracają
  do przejścia — zmienia się tylko numeracja (test trasy: „stacja 1 z 3" →
  „stacja 2 z 4").

### 3. R — trasa-sekret tylko w żywej wspólnej trasie (`31504f8`)

Brama była liczona z resztkowego `STAN.multi`: kontekst gry zamkniętej przez
hosta albo odzyskanej przy starcie aplikacji włączał trasę-sekret w hot-seacie
(gracz widział jedną stację z pinezką numer 1 — dokładnie objaw z terenu).
Naprawa:

- `czyTrasaSekret(multi)` w `wieloosobowa.js` wymaga ŻYWEJ gry
  (`stan === 'trwa'`) w trybie Wspólnej Trasy z niewyłączonym sekretem —
  predykat czysty, pokryty testem tabelowym;
- `startGry()` kończy kontekst sieciowy: synchronizacja staje, sesja multi
  i `STAN.multi` idą w kosz, więc następne otwarcie telefonu wraca do gry
  hot-seat, a nie do porzuconej gry sieciowej (to też warunek N: numeracja
  hot-seatu nie dziedziczy po multi).

Właściciel doprecyzował zakres: hot-seat ma pokazywać całą trasę zawsze —
ukrywanie jest funkcją wyłącznie żywej gry sieciowej z włączoną opcją.

### 4. P i Q — teksty na listach (`e7ae8cf`, `c3697d7`, `d1c72b6`)

- **P**: `wierszZestawu` traci parametr `etykietaZrodla`, a wpis kandydata pole
  `etykieta` — wiersz zaczyna się od miejsca („Podkowa Leśna · 2026-09-04 10:00 ·
  3 stacji × 1 pytań · …"). Wszystkie paczki na karcie „Paczki dla tej okolicy"
  i tak pochodzą ze wspólnego repozytorium (zgłoszenie I.b z 2026-09-12 zdjęło
  z listy kopie z telefonu), więc przedrostek powtarzał źródło w każdym wierszu
  kosztem nazwy. Źródło zostaje w diagnostyce: `zrodlo: 'repozytorium: <miejsce>'`
  nadal nazywa paczkę w komunikacie o uszkodzonym kontenerze
  (`przyjmijZestawDoGry`).
- **Q**: znaczek weryfikacji pytań (ADR 0032) dostaje tekst „Fact-checked";
  STYL bez zmian (`.znaczek-factcheck` = `color: var(--zloto);
  font-weight: 700`), więc kontrast pilnowany bramą i oba motywy są nietknięte
  (złoto na karcie 5,65:1 jasny / 8,27:1 ciemny). Reguła znaczkowa się nie
  zmienia: znaczek stoi tylko przy paczkach zweryfikowanych (brak pola
  `factcheck` w starych zapisach = zweryfikowana, ADR 0032 §4), przy wariancie
  bez weryfikacji nie ma go wcale. `role="img"` zostaje, etykieta i podpowiedź
  mówią to samo, co widać. Dopełnienie `d1c72b6`: opisy par kontrastu
  w `tools/audyt-kontrastu.mjs` mówiły „znaczek Q" — mówią „znaczek
  fact-check".

### 5. S — poprawka wycofana przez właściciela (bez zmiany kodu)

Zgłoszenie brzmiało: nazwa paczki powinna brać się z nazwy stacji (miejsca),
a wybór paczki prowadzić przez ekran stacji. Sprawdzenie przed kodowaniem:

- paczka niesie lokalizacje stacji OBOWIĄZKOWO — schema `TO-zestaw/1` wymaga
  `stacje: [{ lat, lon, opis }]`, a gra używa ich dosłownie (bez własnego
  losowania pozycji);
- pytania są przypisane do NUMERU stacji, więc treść gry wisi na kolejności
  stacji z paczki;
- ekran stacji pozwala przeciągać piny i losować układ ponownie — przepuszczenie
  paczki przez ten ekran rozsynchronizowałoby pytania z miejscami (pytanie
  o kościół trafiłoby na stację przy dworcu).

Właściciel po tym sprawdzeniu wycofał poprawkę („zbędna, a wręcz szkodliwa").
Nazwa paczki bierze się z miejsca już po poprawce P. Zapis decyzji: ADR 0017
aneks 2026-09-13 (pkt S) — żeby następna sesja nie wróciła do pomysłu.

### 6. O — lokalna historia gier usunięta w całości (`180cadb`)

Właściciel: jedyną drogą powrotu do przerwanej gry ma być automatyczne
wczytanie zapisu (ADR 0045); boks z poprzednimi grami na setupie obiecywał
drugą drogę i mylił. Do wyboru były trzy warianty (schować kartę, przenieść ją
na ekran rankingu, usunąć funkcję) — przeniesienie kolidowałoby z ADR 0039
(ranking żyje w moście, nie w aplikacji), a właściciel wybrał „cała funkcja
precz".

Usunięte:

- `app/trwalosc.js` (319 → 187 linii): `KLUCZ_HISTORII`, `SCHEMAT_HISTORII`,
  `SCHEMAT_WPISU_HISTORII`, `LIMIT_HISTORII`, `skrotGry()`,
  `dodajWpisHistorii()`, `nowaHistoria()`, `walidujHistorieSurowa()`,
  `pobierzHistorie()`, `zapiszGreDoHistorii()`, `usunGreZHistorii()`,
  `wyczyscHistorie()` — czyli cały zapis i odczyt klucza `okolica:historia`;
  przy okazji wyszedł import geohashu (ostatni konsument w tym module);
- `app/app.js` (5501 → 5418 linii): `renderujHistorieGier()`,
  `kasujHistorieGry()`, pomocniki odświeżania karty, pole
  `STAN.historiaKasowanieUzbrojone` i kody usterek **H01–H04**;
  `zapiszGre()` po wysłaniu kopii hotseat na Drive oznacza grę zamkniętą
  i czyści zapis;
- `index.html` (783 → 778): karta `#karta-historia` z listą, przyciskiem
  kasowania i paskiem usterek;
- `app/styles.css`: klasy `.lista-historii`, `.historia-wpis`, `.historia-meta`,
  `.historia-pytania` (988 → 990 linii: listy „Moje wyniki" i „Wyniki hotseat"
  korzystają teraz ze wspólnej `.lista-prosta`).

Zostaje: zapis i wznowienie niedokończonej gry (ADR 0045), `wyslijWynikHotseat()`
— kopia wyniku na wspólny Drive (ADR 0010 pkt 5), ranking czytany z mostu
(ADR 0039) i „Moje wyniki" z bieżącej sesji. Kody `H` wypisane z rejestru
(ADR 0015 aneks): historia była ostatnim żywym konsumentem prefiksu, więc
dwuetapowe kasowanie (pin ADR 0031) straciło przedmiot — numery H01–H04 zostają
zajęte, precedens E14/E18/R17/R18.

Testy: 13 deklaracji testów historii i kodów H usunięte, w tym jeden kontrakt
„karta historii jest" zamieniony na kontrakt ODWRÓCONY (nośniki nie mają karty,
kod nie zapisuje historii, upload hotseat zostaje). `npm test` 763 → 757.

### 7. Dokumenty: aneksy, trzy nośniki opisowe, strażnik (`40cc4a0`)

- aneksy 2026-09-13: **ADR 0010** (O — co zniknęło, co zostaje, dlaczego boks
  nie może wrócić), **ADR 0015** (prefiks `H` wypisany), **ADR 0017** (P i S),
  **ADR 0019** aneks 2026-09-13c (N i R), **ADR 0032** (Q); **ADR 0045** —
  powiązania bez historii lokalnej;
- rejestr ADR: wiersze 0010/0015/0017/0019/0032 z adnotacją o aneksach (przy
  okazji wyszła z wiersza 0017 nieaktualna „moderacja właściciela");
- README, WORKFLOW i ARCHITECTURE przepisane z opisu usuniętej funkcji na opis
  tego, co żyje (powrót automatyczny, wyniki na wspólnym Drive i w rankingu) —
  zamiany metodą przęsła między kotwicami ASCII, bo dokumenty mieszają
  cudzysłowy (LESSONS L66);
- `test/dryf-dokumentow.test.js`: trzy nowe martwe frazy („Poprzednie gry",
  „Kasuj historię", klucz historii) z nośnikami = dokumenty + UI; komentarze
  i nagrobki w `app.js`, `index.html` i `styles.css` opisują rzecz, nie cytują
  literalnych napisów;
- LESSONS **L66** (rejestr + pełny opis w archiwum): kolejność aneks →
  cytowanie z datą, kotwice ASCII przy zamianach, sprawdzanie cytowań i asercji
  testów przed przeniesieniem treści ADR do archiwum, nazwa pliku w archiwum bez
  przedrostka `NNNN-`;
- ROADMAP M11/M12: zdanie o drugim teście terenowym i o wycofanym S.

### 8. Budżet lektury: pęknięcie i podział ADR 0019 (`40cc4a0`)

Po aneksach `npm run budzet` pokazał **100 795 / 100 000 tok** — przekroczenie
795 tok, czyli obowiązkowe zadanie sesji (AGENTS.md §0, LESSONS L62). Poprzednia
sesja zostawiła wskazówkę: największy pojedynczy zjadacz to ADR 0019 (5 368 tok).

Podział: do `docs/decisions/archive/aneksy-0019-2026-09-06-do-11b.md`
przeniesione DOSŁOWNIE pięć sekcji historycznych — aneks 2026-09-06
(implementacja P1–P3), dopisek 2026-09-07, dwa aneksy 2026-09-11 (przepisanie
trybów; setup zamiast ekranu multiplayera, m12-74) i aneks 2026-09-11b
(rankingi usunięte, m12-77/m12-78) — razem 2 268 tok; w ADR został wskaźnik
(198 tok) z wyliczeniem, co gdzie leży. ADR 0019: 5 556 → 3 486 tok.

Sprawdzenia przed przeniesieniem (L66 pkt 3–4): grep po żywych nośnikach nie
znalazł cytowań `ADR 0019 aneks 2026-09-11*` ani `… 2026-09-06` z datą; jedyny
test czytający ten plik wymaga nagłówka aneksu 2026-09-13b, który zostaje;
nazwa pliku w archiwum bez przedrostka `NNNN-`, bo kontrakt „archiwum ADR-ów"
wymaga od takich plików `- Status: Wycofana` i wiersza w rejestrze, a to nie
jest ADR, tylko ciąg dalszy historii ADR 0019. Budżet po podziale: **99 082 tok**
(rezerwa **918**).

### 9. Bramy, stan końcowy i rzeczy otwarte

`npm run brama` (testy + `synchronizuj-szablon --check` + audyt kontrastu):
**757/757** testów, oba szablony protokołu zgodne, **0 naruszeń WCAG AA**;
`npm run budzet` **99 082 / 100 000** (rezerwa 918). Wersja **m12-113**
(`?v=` w `index.html`, importy we wszystkich `app/*.js`, `WERSJA_SW`).
Zakres fali N–S (od `c3697d7`): 31 plików, +450/−785.

Commity tej sesji: `31504f8` (N+R) → `e7ae8cf` (P) → `c3697d7` (Q) →
`d1c72b6` (etykiety audytu) → `180cadb` (O + cache-busting m12-113) →
`40cc4a0` (dokumenty i podział budżetu) → `68e3760`-następny (LESSONS L66,
ROADMAP, ten wpis i handoff).

Otwarte:

1. **Scalenie PR #20** (decyzja właściciela) — Pages poda `?v=m12-113`,
   a `WERSJA_SW` wymieni cache skorupy, więc telefony podciągną falę bez
   ręcznego czyszczenia.
2. **Deployment web app u właściciela** — wisi od PR #19 (most
   `docs/setup/apps-script-repo-paczek.gs`: `rezygnacja` domykająca grę, pula
   premii). Ta sesja mostu NIE zmieniała.
3. **Powtórka testu terenowego dwóch telefonów** (WORKFLOW §4.4) — teraz z
   poprawkami N (numery stacji po wznowieniu), R (trasa-sekret tylko w żywej
   grze sieciowej) i O (setup bez boksu poprzednich gier).
4. **Budżet: rezerwa 918 tok** — wystarczy na jedną lekcję albo mały aneks;
   następna duża fala dokumentowa zaczyna od mierzenia (`npm run budzet`) i ma
   gotowy mechanizm: archiwum ADR-ów wycofanych (L62) albo archiwum treści
   historycznej ADR-a żyjącego (ta sesja, L66 pkt 3–4).

## Sesja 2026-09-13d — trzecia fala zgłoszeń właściciela: utrwalona kolejka zdarzeń, widoczne czekanie, paczki w tle (gałąź `arena/01a09b63-okolica`, PR #20)

Wersja aplikacji **m12-113 → m12-114** (cache-busting całej fali: `?v=`
w `index.html`, importy we wszystkich `app/*.js`, `WERSJA_SW` w `sw.js`).

### 1. Zgłoszenia i decyzje

Właściciel po domknięciu fali N–S zgłosił trzy rzeczy i od razu wybrał sposób
naprawy (bez odsyłania do następnej fali):

| # | Zgłoszenie | Decyzja właściciela |
|---|---|---|
| T1 | odpowiedź udzielona w grze sieciowej bez zasięgu ginie po odświeżeniu telefonu (kolejka `app/sync.js` żyła tylko w RAM) | „Napraw w tej sesji" — odrzucone zarówno zostawienie ograniczenia w dokumentacji, jak i przeniesienie do osobnej fali |
| T2 | operacje sieciowe każą czekać, a ekran tego nie pokazuje | sygnał ma być widoczny, najchętniej pulsujący; wskazane dwa miejsca: „Sprawdzam repozytorium paczek dla tej okolicy…" i „Pobieram dane sieci drogowej…" |
| T3 | klik „▶ Graj z tą paczką" czeka kilka sekund | najlepiej wstępne pobieranie paczek w trakcie wyświetlania listy; gdyby się nie dało — pulsujące „Ładowanie paczki" po kliku. Zrobione OBA |

### 2. T1 — kolejka zdarzeń gry sieciowej jest utrwalona (`cef6658`)

Klucz `okolica:multi-kolejka`, schemat `zdarzenia-kolejka/1`
(`app/wieloosobowa.js`: `walidujKolejkeZdarzen`, `zapisKolejkiZdarzen`,
`LIMIT_KOLEJKI_ZDARZEN` = 50 najstarszych; wzór: kolejka wyniku hot-seat
i kolejka ocen). `utworzSynchronizacje` dostaje trzy WSTRZYKNIĘTE uchwyty —
`wczytajKolejke`, `zapiszKolejke`, `limitKolejki` — więc moduł synchronizacji
nadal nic nie wie o `localStorage`, a testy jednostkowe wstrzykują tablicę.
Utrwalony jest każdy ruch kolejki: push przy awarii sieci, shift po wypchnięciu
i shift po odmowie mostu. Pełna kolejka jest jawną odmową w statusie
(„stacja zostanie do przejścia jeszcze raz"), nie cichym odrzuceniem.

Kolejność powrotu do gry jest częścią poprawki: `przywrocGreMulti` woła
`dostarczZalegleZdarzeniaMulti(sesja)` PRZED `pobierzGetMulti`, bo inaczej
telefon zbudowałby rozgrywkę ze stacją, którą most właśnie domknął (gracz
widziałby cel, którego już nie ma). Awaria sieci w trakcie wypychania zostawia
resztę w pamięci — przejmuje ją pierwszy udany krok `sync.js`; odmowa mostu
kasuje zdarzenie zamiast je ponawiać. Duplikatu nie będzie: most odrzuca drugą
odpowiedź tego gracza do tej stacji (`przyjmijZdarzenie`
w `docs/setup/apps-script-repo-paczek.gs`) — to dlatego utrwalenie kolejki jest
bezpieczne bez zmiany protokołu. Klucz idzie w kosz razem z sesją
(`usunSesjeMulti`); zapis cudzej gry albo śmieciowy daje pustą listę, nigdy
wyjątku.

### 3. T2 — czekanie na sieć pulsuje (`cef6658`)

Klasa `.pulsuje` w `app/styles.css` (pierwsza animacja w projekcie):
przezroczystość 1 → 0,7 → 1, 1,4 s, `ease-in-out`, nieskończona; przy
`prefers-reduced-motion: reduce` wyłączona, a komunikat zostaje bez ruchu.
Kontrast MIERZONY `tools/audyt-kontrastu.mjs` (mieszanie kanałów sRGB, nie
średnia z luminancji) dla najniższej przezroczystości: **5,62:1** w motywie
jasnym i **8,25:1** w ciemnym — oba powyżej AA 4,5:1 (liczby są w komentarzu
przy regule, żeby następna fala ich nie zgadywała).

Nosiciele: `status(tekst, { czeka: true })` (`#status`), nowy
`statusZestawow(tekst, { czeka: true })` (`#zestawy-status` — jeden zapis
tekstu i sygnału zamiast dziewięciu rozsianych po karcie propozycji) oraz
nakładka `#stacje-ladowanie`. Pulsują: sprawdzanie repozytorium paczek,
ponowienie po zimnym starcie mostu, „Pobieram dane sieci drogowej…",
„Pobieram paczkę z repozytorium…", „Wysyłam zaległe zdarzenia gry…" i „Wracam
do gry…". Każdy następny komunikat gasi sygnał, więc stan „czekam" nie zostaje
na ekranie po zakończonej pracy.

### 4. T3 — paczki widoczne na liście schodzą w tle (`cef6658`)

`PAMIETNIK_PACZEK` (url → promise tekstu) + `wstepniePobierzPaczki()` na końcu
`renderujZestawy()`: pobierane są TYLKO paczki widoczne
(`LIMIT_ZESTAWOW_NA_LISCIE`, po rozwinięciu listy — wszystkie), a adres pliku
jest liczony raz (`urlPaczki` kandydata), więc wstępne pobranie i klik idą pod
ten sam URL. Klik bierze gotowy tekst albo to samo, już rozpoczęte pobranie:
jedno żądanie na plik, nie dwa; nieudane pobranie wychodzi z pamięci, więc klik
próbuje jeszcze raz; pamięć jest czyszczona przy każdym odświeżeniu propozycji.
Paczka `TO-zestaw/1` jest niezmienialna, więc trafienie w pamięć nie grozi
starymi danymi. Wstępne pobranie NIE zgłasza mostowi niczego — oceny i licznik
„użyta w X grach" idą jak dotąd dopiero przy prawdziwym kliku (ADR 0028).
Drugie ramię poprawki: przycisk w trakcie pobierania jest `disabled` i zmienia
etykietę na „⏳ Ładowanie paczki…" z `.pulsuje` — sygnał i blokada podwójnego
kliku (podwójne pobranie i podwójne „użycie" paczki) w jednym.

### 5. Testy: 758 → 767 (+9)

- `test/sync.test.js`: utrwalanie przy każdym push/shift, start nowej instancji
  z `wczytajKolejke` (zdarzenia wychodzą przy pierwszym kroku, FIFO), limit
  z jawną odmową.
- `test/wieloosobowa.test.js`: round-trip walidatorów kolejki przez JSON,
  cudzy `kod`, śmieci (brak listy, wpisy bez schematu/gracza), limit w zapisie.
- `test/wieloosobowa-ui.test.js`: odpowiedź bez zasięgu → odświeżenie telefonu
  → zdarzenia wychodzą PRZED stanem gry, pamięć jest czysta, cel to „stacja
  2 z 3" (nie powtórka stacji 1), punkt jest na moście; oraz odświeżenie WCIĄŻ
  bez sieci — nic nie wychodzi i nic nie jest kasowane, a po powrocie sieci
  zdarzenia dochodzą raz.
- `test/zestawy-ui.test.js`: wstępne pobieranie (plik paczki pobrany bez kliku;
  klik NIE dokłada drugiego żądania), brak zgłoszeń do mostu przy pobraniu
  w tle, sygnał czekania na przycisku i statusie mierzony w trakcie wiszącego
  pobrania.
- `test/aplikacja.test.js`: pulsowanie nakładki „Pobieram dane sieci drogowej…"
  i jego zgaśnięcie po odpowiedzi.
- Poprawiony pin „dokładnie jedna powtórka" (zimny start mostu): liczy żądania
  INDEKSU, bo wstępne pobieranie dokłada żądanie pliku paczki — pin został tam,
  gdzie należy.
- Pin kontraktu „ADR 0019 ma aneks G" czyta teraz archiwum aneksów (patrz niżej)
  i dodatkowo wymaga wskaźnika w pliku macierzystym.

### 6. Dokumenty i budżet lektury

Aneksy: **ADR 0019 aneks 2026-09-13d** (kolejka zdarzeń; ograniczenie z aneksu
2026-09-13c jest w nim jawnie ZNIESIONE, żeby dokumenty sobie nie przeczyły),
**ADR 0011 aneks 2026-09-13d** (widoczne czekanie, liczby kontrastu),
**ADR 0017 aneks 2026-09-13d** (wstępne pobieranie i jego granice) + trzy
wiersze rejestru. Nośniki opisowe: `docs/ARCHITECTURE.md` (nowy klucz
w inwentarzu trwałości i kolejność powrotu do gry) i `docs/ROADMAP.md` (fala
2026-09-13d w akapicie M11/M12).

Budżet: rezerwa po fali N–S wynosiła **552 tok**, a trzy aneksy kosztowały
~930 — próg by pękł, więc zanim cokolwiek dopisano, trzy historyczne aneksy
ADR 0019 (2026-09-12f: ranking wrócił, decyzja w ADR 0039; 2026-09-13: koniec
ekranu po starcie, uwaga F; 2026-09-13b: koniec gry hosta, uwaga G — razem
**1 536 tok**) przeniesiono DOSŁOWNIE do
`docs/decisions/archive/aneksy-0019-2026-09-12f-do-13b.md`, a w pliku
macierzystym został wskaźnik z datami (mechanizm z LESSONS L62/L66; nazwa bez
przedrostka `NNNN-`, bo to nie ADR). ADR 0019: 3 852 → 3 014 tok. Budżet po
fali: **99 372 / 100 000** (rezerwa **628**).

### 7. Bramy, stan końcowy i rzeczy otwarte

`npm run brama` (testy + `synchronizuj-szablon --check` + audyt kontrastu):
**767/767** testów, oba warianty protokołu zgodne, **0 naruszeń WCAG AA**;
`npm run budzet` **99 372 / 100 000** (rezerwa 628).

Commity tej sesji: `cf01550` (weryfikacja punktacji N z poprzedniej fali) →
`cef6658` (T1+T2+T3 z testami) → następny (dokumenty, aneksy, archiwum,
cache-busting m12-114, ten wpis i handoff).

Otwarte:

1. **Scalenie PR #20** (decyzja właściciela) — Pages poda `?v=m12-114`,
   a `WERSJA_SW` wymieni cache skorupy, więc telefony podciągną falę bez
   ręcznego czyszczenia.
2. **Deployment web app u właściciela** — wisi od PR #19; ta fala mostu NIE
   zmieniała (utrwalenie kolejki opiera się na ISTNIEJĄCYM odrzucaniu
   duplikatów odpowiedzi w `przyjmijZdarzenie`).
3. **Powtórka testu terenowego dwóch telefonów** (WORKFLOW §4.4) — warto
   przejść scenariusz z utratą zasięgu w chwili odpowiedzi i odświeżeniem
   telefonu: cel po powrocie to następna stacja, a status mówi o wysłaniu
   zaległych zdarzeń.
4. **Budżet: rezerwa 628 tok** — jedna lekcja albo mały aneks; następna fala
   dokumentowa zaczyna od `npm run budzet` i ma gotowy mechanizm podziału.


## Sesja 2026-09-13e — audyt PR #20 i weryfikacja na żywo (gałąź `arena/01a09c54-okolica`)

### 1. Start sesji

Właściciel: „Kontynuujemy projekt.” — bez zlecenia konkretnego zadania, więc
sesja idzie wg protokołu (ADR 0012): lektura, PR sesji, audyt poprzedniego
scalonego PR, potem najwyższy otwarty kamień z ROADMAP.

- Gałąź `arena/01a09c54-okolica`, baza `f7a201c` (= `main` po PR #20,
  aplikacja **m12-114**).
- Bramy przed zmianami: `npm test` **767/767**, `npm run check` OK (oba
  warianty protokołu), `npm run audyt` 0 naruszeń WCAG AA, budżet lektury
  **99 793/100 000** tok (rezerwa 207).
- Lektura startowa wg AGENTS.md §0 wykonana w całości (ADR-y z rejestrem
  i aneksami, LESSONS L1–L67, PROTOKOL, ENVIRONMENT, ROADMAP,
  HANDOFF_2026-09-13d).

### 2. Audyt PR #20 (squash `f7a201c`, 53 pliki, +3007/−960; m12-110 → m12-114)

PR scala trzy podsesje: 13b (audyt PR #19: naprawy U1/U2), 13c (uwagi
terrenowe N–S) i 13d (T1–T3). Przegląd `git diff f7a201c^..f7a201c`
plik po pliku: logika, zgodność z ADR i protokołem, zieloność.

- **`app/app.js`** (+303/−172, największy kawałek fali):
  - **T1 — utrwalona kolejka**: klucz `okolica:multi-kolejka`, uchwyt
    `zapisKolejkeZdarzen`/`walidujKolejkeZdarzen`/`LIMIT_KOLEJKI_ZDARZEN`
    wstrzyknięte do `utworzSynchronizacje` w obu miejscach (`wejdzDoGryMulti`,
    `przywrocGreMulti`), więc `app/sync.js` nadal nic nie wie o
    `localStorage`. `dostarczZalegleZdarzeniaMulti` jest wołana w
    `przywrocGreMulti` PRZED `pobierzGetMulti` — kontraktem, nie szczegółem
    (inaczej telefon zbudowałby trasę ze stacją, którą most właśnie domknął;
    ADR 0019 aneks 2026-09-13d, L67). Odmowa mostu kasuje zdarzenie,
    awaria sieci zostawia resztę w pamięci; kolejka idzie w kosz razem
    z sesją (`usunSesjeMulti`). **OK.**
  - **T2 — widoczne czekanie**: `status(tekst, { czeka })` i
    `statusZestawow(tekst, { czeka })` dokładają/gaszą `.pulsuje` jednym
    miejscem; nakładka `#stacje-ladowanie` dostaje klasę przy starcie pobrania
    i gubi ją w `finally` (także przy błędzie). **OK.**
  - **T3 — paczki w tle**: `PAMIETNIK_PACZEK` (url → promise tekstu),
    `wstepniePobierzPaczki()` po `renderujZestawy()` pobiera TYLKO widoczne
    (`LIMIT_ZESTAWOW_NA_LISCIE`, po rozwinięciu wszystkie), nieudane pobranie
    wychodzi z pamięci (klik spróbuje jeszcze raz), pamięć czyszczona w
    `odswiezPropozycjeZestawow`. Klik „▶ Graj z tą paczką” bierze gotowy
    tekst albo to samo rozpoczęte pobranie (`pobierzPaczkeZRepo` — jedno
    żądanie na plik), przycisk `disabled` + „⏳ Ładowanie paczki…” z `finally`.
    Wstępne pobranie NIE zgłasza mostowi użycia paczki — ścieżka fetchu
    czysta, oceny i „użyta w X grach” idą dopiero przy kliku (ADR 0028). **OK.**
  - **13c**: N — `numerStacjiTrasy`/`liczbaStacjiTrasy` + `STAN.trasaDlugosc`
    (powrót buduje model z NIEZAMKNIĘTYCH stacji, więc numer bierze stacja,
    a licznik pełną trasę; w `wznowGre` hot-seat `trasaDlugosc = 0` — lista
    pełna, numer = indeks). O — cała lokalna historia usunięta (`zapiszGre`
    woła `wyslijWynikHotseat()` bezpośrednio; strażnik `if (STAN.multi)
    return;` w `zapiszGre` sprawdzony — gra sieciowa nie wysyła hot-seat
    podwójnie). P — wiersz paczki zaczyna się od miejsca (parametr
    `etykietaZrodla` usunięty ze wszystkich miejsc). Q — znaczek „Fact-checked”
    (styl `.znaczek-factcheck` nietknięty, `role="img"` + etykieta). R —
    `czyTrasaSekret(STAN.multi)` wymaga ŻYWEJ gry, a `startGry()` kończy
    kontekst sieciowy (`zatrzymajSyncMulti` null-safe, `usunSesjeMulti`,
    `STAN.multi = null`, `trasaDlugosc = 0`). S — wycofane przez właściciela,
    bez zmiany kodu. **OK.**
  - **13b (U1)**: zdania awaryjne P03/P04/P08/P06 (`pozycja.js`), `onBlad`
    watchera, uszkodzony kontener, paczka rozjechana z rozgrywką, T07 i R19
    nazywają ikonę ⚙ START GRY i wpisanie TAK — martwego „■ Zakończ grę”
    i „Zapisz nowy” nie ma w żadnym zdaniu dla gracza. **OK.**
  - **13b (U2)**: `$('gra-sterowanie').hidden = droga && !STAN.trybTestowy`
    — w trybie testowym panel fazy B (duży dystans + „▶ Symuluj dojście”,
    jedyne ujście odcinka bez GPS) zostaje na wierzchu; w terenie nad mapą
    sam pasek. **OK.**
- **`app/wieloosobowa.js`**: `czyTrasaSekret` (twarde `stan === 'trwa'`;
  brak pola `trasaSekret` = sekret — zgodność wstecz z m12-73),
  `walidujKolejkeZdarzen` (cudzy `kod`/śmieci → pusta lista, limit 50),
  `zapisKolejkiZdarzen`, R19 bez martwego przycisku. **OK.**
- **`app/sync.js`**: start kolejki z `wczytajKolejke` (slice do limitu),
  `utrwalKolejke` przy KAŻDYM ruchu (push/shift/odmowa), jawna odmowa przy
  przekroczonym limicie. **OK.**
- **`app/trwalosc.js`** (−148): sekcja historii usunięta w całości (klucz,
  oba schematy, H01–H04, cztery pomocniki, import `geohash`) — spójnie z
  ADR 0010 aneksem. **OK.**
- **`app/mapa.js`**: `planMapy` woli `numer` przed indeksem (hot-seat bez
  pola `numer` numeruje od 1 — test pinuje oba przypadki). **OK.**
  **`pozycja.js`**: komunikaty z pkt wyżej. Pozostałe moduły
  (`most`, `protokol`, `rozgrywka`, `sieci`, `stacje`, `wynik`, `zestawy`):
  wyłącznie podbicia `?v=`. **OK.**
- **`index.html` / `app/styles.css` / `sw.js`**: `#karta-historia` usunięte
  z nagrobkiem, `.lista-historii` przemianowane na `.lista-prosta` (trzy
  miejsca: lobby, lista graczy, lobby-gracze — CSS i HTML spójnie),
  `.pulsuje` + `@keyframes` + `prefers-reduced-motion`, `WERSJA_SW`
  `m12-114`. **OK.**
- **Łańcuch wersji**: jeden `m12-114` w `index.html`, wszystkich importach
  `app/*.js` i `sw.js` (grep: zero rozjazdów, L29). **OK.**
- **Testy (767/767)**: kontrakty pinują usunięcia (id, funkcje, symbole,
  klasa CSS, `historiaKasowanieUzbrojone`) I dodatki (`void
  wyslijWynikHotseat()` w hooku końca gry, wstrzyknięte uchwyty kolejki,
  wyjątek testowy w `odswiezPasekDrogi`); nowy strażnik `wierszeKodu`
  (komentarze wycięte — nagrobek L31 może cytować martwą etykietę, zdanie
  dla gracza nie może) każe KAŻDEJ linijce kodu o „zakończ grę” nazwać ikonę
  ⚙ START GRY (L64). End-to-end: R (resztkowa sesja nie chowa trasy w
  hot-seacie, start hot-seata kasuje sesję), N (cel zostaje „stacja 2 z 3”
  po odświeżeniu; punkty per gracz: `[[1,1],[2,0]]` przed zamknięciem →
  to samo po powrocie → `[[1,1],[2,0],[3,1]]` w tabeli końca gry — zero
  zostaje zerem, remis 1:1 rozstrzyga stabilny sort), T1 (odpowiedź bez
  zasięgu → odświeżenie → `dojscie`+`odpowiedz` na moście PRZED stanem gry,
  celem jest następna stacja; oraz odświeżenie WCIĄŻ bez sieci — nic nie
  wychodzi i nic nie jest kasowane), T3 (plik pobrany bez kliku, klik nie
  dokłada drugiego żądania, zero zgłoszeń do mostu, sygnał czekania
  mierzony w trakcie wiszącego pobrania), droga w terenie (bez `?test=true`
  panel gry schowany i symulacji nie ma — pin podwójny z trybem testowym,
  L65). Strażnik dryfu: sześć nowych martwych fraz. **OK.**
- **Dokumenty**: aneksy ADR 0010/0011/0015/0017/0019/0029/0032/0036/0043/0045
  + rejestr (spójne z kodem — przeczytane w całości na starcie sesji),
  ARCHITECTURE (inwentarz trwałości: nowy klucz `okolica:multi-kolejka`,
  kolejność powrotu do gry; historia przeniesiona na Drive), WORKFLOW §4.2
  (wyjątek testowy w drodze), README, ROADMAP, LESSONS L64–L67 + archiwum,
  AGENTS §0 (archiwum ADR-ów poza lekturą startową), drugie archiwum aneksów
  ADR 0019 (wskaźnik z datami; kontrakt czyta archiwum — L62/L66). **OK.**
- **Most** (`apps-script-repo-paczek.gs`): NIE zmieniany w tej fali —
  utrwalona kolejka opiera się na ISTNIEJĄCYM odrzucaniu duplikatów
  odpowiedzi w `przyjmijZdarzenie`; warunek zapisany w ADR jako warunek,
  nie zbieg okoliczności. **OK.**

**Werdykt:** PR #20 jest spójny z ADR 0010/0011/0015/0017/0019/0029/0032/
0036/0043/0045 i z protokołem, łańcuch wersji pojedynczy, brama zielona
(767/767, `npm run check` OK, 0 naruszeń WCAG AA — mierzone na tym drzewie).
**Brak usterek wymagających naprawy.** Dwa rozpoznania (nie usterki):

1. `sync.js` → `utrwalKolejke()` połyka błąd utrwalenia (pamięć pełna
   albo niedostępna) — kolejka działa dalej w RAM, a gracz widzi jawny
   status z `onBlad`; prawdę o grze zna most, kolejka jest pomocą
   (uzasadnienie w komentarzu przy funkcji). Dopuszczalna degradacja.
2. `PAMIETNIK_PACZEK.clear()` przy odświeżeniu propozycji porzuca wynik
   pobrania w toku — następny klik pobiera plik od nowa (plik
   `TO-zestaw/1` jest niezmienialny, więc nie ma ryzyka starych danych).


## Sesja 2026-09-13f — budżet lektury i audyt PR #21 (gałąź `arena/01a09c9a-okolica`, PR #22, m12-114)

### 1. Start sesji

Właściciel: „kontynuujemy projekt” — bez zlecenia konkretnego zadania, więc sesja idzie wg protokołu (ADR 0012): lektura, PR sesji, audyt poprzedniego scalonego PR, potem najwyższy otwarty kamień z ROADMAP.

- Gałąź `arena/01a09c9a-okolica`, baza `fdfdf6b` (= `main` po PR #21, aplikacja **m12-114**).
- Bramy przed zmianami: `npm test` **767/767**, `npm run check` OK (oba warianty protokołu), `npm run audyt` 0 naruszeń WCAG AA, budżet lektury **99 793/100 000** tok (rezerwa 207).
- Lektura startowa wg AGENTS.md §0 wykonana w całości (ADR-y z rejestrem i aneksami, LESSONS L1–L67, PROTOKOL, ENVIRONMENT, ROADMAP, HANDOFF_2026-09-13d).

### 2. Audyt PR #21 (squash `fdfdf6b`, 1 plik, +134/−0; m12-114)

PR #21 scala wyłącznie wpis dziennika sesji 2026-09-13e z audytem PR #20 (m12-110→m12-114). Przegląd `git diff fdfdf6b^..fdfdf6b`:

- `docs/PROJECT_HISTORY.md` (+134): sekcja „Sesja 2026-09-13e” z audytem plik po pliku PR #20 (53 pliki, +3007/−960): logika T1–T3 i N–S spójna z ADR 0010/0011/0015/0017/0019/0029/0032/0036/0043/0045, łańcuch ?v=m12-114 pojedynczy, brama zielona (767/767, check OK, 0 naruszeń WCAG AA). Brak usterek wymagających naprawy; dwa rozpoznania (degradacja utrwalania kolejki, porzucenie pobrania w toku) opisane we wpisie i dopuszczalne. **OK.**
- Brak zmian kodu, brak zmian wersji, brak zmian w ADR/LESSONS/PROTOKOL. **OK.**
- Łańcuch wersji: m12-114 bez zmian (grep zero rozjazdów). **OK.**
- Testy: brak zmian w kodzie, więc 767/767 pozostaje. **OK.**

**Werdykt:** PR #21 jest spójny, dziennik rzetelny, brak usterek wymagających naprawy. Jedno rozpoznanie: brak pliku handoff `HANDOFF_2026-09-13e.md` w main — uzupełniony w tej sesji (commit `e31a35b`) jako plik przekazania jednej sesji (AGENTS.md §0 pkt 7).

### 3. Budżet lektury: 99 793 → 96 754 tok (rezerwa 207 → 3 246)

Start sesji wykazał rezerwę 207 tok — próg 100 000 pęka przy najbliższym aneksie. Zgodnie z AGENTS.md §0 (budżet) i LESSONS L62/L66, skrócenie dokumentów stało się obowiązkowym zadaniem sesji.

**Analiza `npm run budzet`:** największym zjadaczem są ADR-y (~65 tys. z 100 tys.). Największe pliki: ADR 0017 (3726 tok, 8 aneksów), ADR 0004 (2666 tok, 7 aneksów), ADR 0006 (2554 tok, 4 aneksy). LESSONS (16 537 tok) już ma archiwum opisów przypadków.

**Wdrożone (commit `60205c4`):** archiwizacja treści historycznej 3 ADR-ów żyjących — wzorzec z sesji 2026-09-13d (ADR 0019):

- **ADR 0017**: 5 starszych aneksów (2026-09-06 M9b, 2026-09-07 tematWlasny, 2026-09-11 faktyczne tematy, 2026-09-12 m12-92 indeks dopisuje faktyczne tematy, 2026-09-12 m12-95 paczki tylko z repo) → `docs/decisions/archive/aneksy-0017-2026-09-06-do-12.md` (6018 znaków). W pliku macierzystym pointer „Aneksy 2026-09-06 … 2026-09-12 są w archiwum (poza budżetem lektury)” z linkiem i LISTĄ DAT (2026-09-06, 2026-09-07, 2026-09-11, 2026-09-12, 2026-09-12) — bo strażnik cytowań aneksów (`test/dryf-dokumentow.test.js`: „cytowane aneksy ADR istnieją”) szuka daty w pliku ADR. Zachowane aneksy: 2026-09-11 (koniec moderacji wstępnej — cytowany w `app/app.js` i testach dryfu, więc musi zostać), 2026-09-13 (P/S) i 2026-09-13d (paczki w tle). 3726 → 2463 tok (−1263).
- **ADR 0004**: 5 starszych aneksów (2026-09-07 kara ręczna, 2026-09-08 tryb testowy, 2026-09-12 m12-91 watchdog, m12-92 P10, m12-94 wyjście) → `archive/aneksy-0004-2026-09-07-do-12.md` (4739 znaków). Pointer z listą dat (2026-09-07, 2026-09-08, 2026-09-12, 2026-09-12, 2026-09-12). Zachowane: 2026-09-09 (próg 25 m — cytowany w ARCHITECTURE) i 2026-09-13 (koniec pauzy, ADR 0040). 2666 → 1700 tok (−966).
- **ADR 0006**: 2 starsze aneksy (2026-09-09 wklejenie jednym przyciskiem, 2026-09-09 druga tura) → `archive/aneksy-0006-2026-09-09.md` (3944 znaki). Pointer z listą dat (2026-09-09, 2026-09-09). Zachowane: 2026-09-07 (koniec edycji — cytowany w kontrakcie) i 2026-09-09 trzecia tura (wklejenie jest zatwierdzeniem). 2554 → 1745 tok (−809).

**Suma:** 3 pliki macierzyste −3038 tok, 3 archiwa poza budżetem. Budżet po fali: **96 754 / 100 000** (rezerwa **3 246**). Brama: 767/767, check OK, audyt 0 naruszeń.

### 4. Weryfikacja na żywo

Serwer `node tools/serwer.mjs .` na 0.0.0.0:8000 (HTTP/1.1, keepAlive 65 s, no-store). Podgląd: intro nad mapą, przycisk ⚙ START GRY otwiera setup, mapa SVG z kafelkami OSM (atrybucja widoczna), gesty palca (drag/pinch), przyciski ＋ − ◎, marker pozycji bez koła dokładności, promień gry, skala. Setup przewijany nad przygaszoną mapą — 360 px bez poziomego scrolla. Ekran gry: mapa tłem, karty faz na dole (portrait) / prawej (landscape), pasek na dole w drodze, panel fazy duży przy dojściu. Tryb testowy `?test=true`: symulacja dojścia widoczna (panel fazy B nie jest schowany — fix U2 z PR #20). Gra wieloosobowa: setup multi (zakładam/dołączam), lobby, odliczanie 5-4-3-2-1-START nad mapą (ADR 0044). Brak regresji po archiwizacji ADR-ów.

### 5. Bramy, stan końcowy i rzeczy otwarte

`npm run brama`: **767/767** testów, oba warianty protokołu zgodne, **0 naruszeń WCAG AA**; `npm run budzet` **96 754 / 100 000** (rezerwa 3 246).

Commity tej sesji: `e31a35b` (audyt PR #21 + HANDOFF_2026-09-13e.md) → `60205c4` (budżet: archiwizacja 3 ADR-ów) → następny (dokumenty: ten wpis + HANDOFF_2026-09-13f.md + cache-busting? — wersja bez zmian m12-114, więc brak bumpa).

Otwarte:

1. **Scalenie PR #22** (decyzja właściciela) — Pages poda `?v=m12-114`, a `HANDOFF_2026-09-13e.md` uzupełni lukę w historii.
2. **Deployment web app u właściciela** — wisi od PR #19 (most `docs/setup/apps-script-repo-paczek.gs`: `rezygnacja` domykająca grę, pula premii). Ta sesja mostu nie zmieniała.
3. **Powtórka testu terenowego dwóch telefonów** (WORKFLOW §4.4) ze scenariuszem utraty zasięgu (T1) i wstępnego pobierania paczek (T3) — czeka właściciel.
4. **Budżet: rezerwa 3 246 tok** — następna duża fala dokumentowa (np. nowe ADR-y M13+) powinna zacząć od `npm run budzet` i ewentualnie kolejnej archiwizacji (kandydaci: ADR 0005 2759 tok, 0016 2276 tok, 0036 2026 tok, 0003 2003 tok — każdy z aneksami).
5. **Kamienie M3–M12**: kod gotowy, czeka kryteria terenowe właściciela (ROADMAP §Kryteria). Brak zlecenia = najwyższy otwarty kamień (M3), ale kryterium to weryfikacja 360 px bez przewijania — decyzja właściciela.

## Sesja 2026-09-14 — audyt PR #22 i naprawy A-H (gałąź `arena/01a09f42-okolica`)

### 1. Start sesji

Właściciel: „kontynuujemy projekt” — bez zlecenia konkretnego zadania, więc
sesja idzie wg protokołu (ADR 0012): lektura, PR sesji, audyt poprzedniego
scalonego PR, potem usterki z audytu (wyższe niż kamień M3, który czeka na
kryterium właściciela).

- Gałąź `arena/01a09f42-okolica`, baza `5163ed9` (= `main` po PR #22,
  aplikacja **m12-114**).
- Bramy przed zmianami: `npm test` **767/767**, budżet lektury
  **96 754/100 000** tok (rezerwa 3 246).
- Lektura startowa wg AGENTS.md §0 wykonana w całości (ADR-y z rejestrem
  i aneksami, LESSONS L1–L67, PROTOKOL, ENVIRONMENT, ROADMAP,
  HANDOFF_2026-09-13f).

### 2. Audyt PR #22 (squash `5163ed9`, 20 plików, +804/−414)

PR #22 scala **dwie warstwy**, a dziennik sesji 13f opisuje tylko pierwszą:

1. **Budżet lektury** (sesja 2026-09-13f): archiwizacja aneksów ADR 0004/0006/0017
   + HANDOFF_2026-09-13e/f + wpis dziennika. Wersja aplikacji bez zmian.
2. **Uwagi terenowe A-H** (2026-09-14): zmiany w `app/*.js`, `styles.css`,
   `index.html` i testach. Tytuł PR („audyt PR #21 i budżet”) i wpis
   PROJECT_HISTORY **nie wspominają A-H**; jedyny commit w PR i komunikat
   squash-merge niosą A-H. A-H nie ma handoffu ani aneksów ADR.

Przegląd `git diff fdfdf6b..5163ed9` plik po pliku.

#### Warstwa 1 — budżet (zgodna z dziennikiem 13f)

- **ADR 0004/0006/0017**: treść historyczna w `archive/aneksy-*` (nazwy BEZ
  przedrostka `NNNN-`, L66), pointer z listą dat w pliku macierzystym.
  Aneksy cytowane w żywych nośnikach zostają (0004: 2026-09-09; 0017:
  2026-09-11). **OK.**
- **HANDOFF_2026-09-13e.md** (luka z PR #21) i **HANDOFF_2026-09-13f.md**. **OK.**

#### Warstwa 2 — uwagi A-H (nieopisane w dzienniku)

- **A (`app/geo.js`)**: `PROMIEN_SUFITU_ZOOMU_M` 1000 → 500, `udzialEkranu`
  0.4 → 0.45. Testy geo/aplikacja przepisane. Intencja: cięciwa gry 500 m
  wypełnia szerokość telefonu. **OK** (zgodne z decyzją właściciela).
- **B (`app/stacje.js`)**: nowa `optymalnaKolejnosc` (Held-Karp O(N²·2^N),
  N>10 greedy NN), użyta w `stacjeProste` i `wybierzStacje` zamiast sortu
  po kącie. Eliminuje wracanie. **Usterka B1:** funkcja nieeksportowana
  i **bez testu** — brama nie pilnuje ani optymalności, ani determinizmu
  tie-breaku, ani fallbacku N>10. **Usterka B2:** ADR 0005 („stacje w
  kolejności kąta od północy”) i ARCHITECTURE nie dostały aneksu.
- **C (`app/app.js`)**: `scrollTop = 0` w `pokazMapeStartowa` / `ukryjStart`
  / `start()`. **Usterka C1:** trzy puste `try { … } catch {}` — AGENTS.md §4
  zakazuje try/catch maskującego objaw; `scrollTop` na elemencie DOM nie rzuca.
- **D (`app/styles.css`)**: `.pulsuje` to teraz negatyw `#000`/`#fff`,
  opacity 0.55. **Usterka D1:** ADR 0011 aneks 2026-09-13d pinuje opacity 0.7
  i kontrast `--tekst` na `--tlo` (5,62:1 / 8,25:1); CSS i ADR się rozjechały.
  Hardcode `#000`/`#fff` omija tokeny motywu.
- **E (`app/app.js`, `styles.css`, `index.html`)**: większe imiona w lobby
  (CSS + duplikat inline), skrócony status, pasek sync bez „Ostatni stan UTC”.
  **Usterka E1:** `li.style.fontSize/fontWeight/padding` dubluje regułę
  `#lobby-gracze li` — dwa źródła prawdy (L35/L40).
- **F (`index.html`, `app.js`, `rozgrywka.js`)**: usunięty `#multi-wybor-stacji`;
  wyścig wykrywa dowolną niezaliczoną; auto-start odcinka; pasek „Jacek.
  Stacja 3/5”; `przejdzDalej` obsługuje `w-trakcie`. Testy wieloosobowa-ui
  i kontrakt ADR 0044 przepisane. **OK w intencji.** **Usterka F1:** ADR 0044
  pkt 5 i ADR 0027 nadal obiecują `#multi-wybor-stacji` w panelu fazy A
  (L31/L58). **Usterka F2:** `czyStartPoDalej()` zawsze `return true`, a
  `nastepnaStacja` ma martwą gałąź na `r.faza` po obsłudze `świeży.faza`.
- **G (`app.js`, `mapa.js`, `styles.css`)**: flaga `zaliczona` w `planMapy`,
  klasa `.pinezka-zaliczona`. **Usterka G1 (widoczna dla gracza):**
  `renderujGre` buduje zbiór zaliczonych przez `Object.entries(r.odcinki)`
  — `odcinki` jest **tablicą** (`stacje.map(...)` w `nowaRozgrywka`,
  `znajdzOdcinek` = `.find`), więc klucz to indeks `0,1,2…`, nie `stacja`.
  Pinezka stacji 1 nigdy nie dostanie szarości (id=1 ≠ indeks 0); pinezka
  stacji 2 dostanie ją, gdy zamknięty jest odcinek o indeksie 2 (stacja 3).
  Detekcja wyścigu w `aktualizujGreNaFix` używa `.filter` poprawnie — rozjazd
  w tym samym PR. Brak testu.
- **H (`app.js`, `styles.css`)**: klasa `.odliczanie-start` + clamp na START.
  **OK.**
- **`?v=` / `WERSJA_SW`:** A-H zmieniło `app/*.js` i `styles.css`, a wersja
  została **m12-114**. AGENTS.md §7 i L29: podbicie we wszystkich importach.
  Telefony z cache'em SW nie dostaną A-H. **Usterka V1.**

#### Testy, łańcuch, most

- Testy 767/767 zielone **na tym drzewie** — bo nie ma asercji na G1, B1, V1.
- Łańcuch `?v=m12-114` pojedynczy (grep: zero rozjazdów) — spójny, ale
  niepodbity po zmianie kodu.
- Most `.gs` nietknięty. **OK.**

**Werdykt:** warstwa budżetu spójna z L62/L66. Warstwa A-H wnosi decyzje
właściciela, ale zostawia usterkę widoczną (G1), brak bumpa cache (V1),
brak testów algorytmu trasy (B1) i dryf ADR (B2, D1, F1). Naprawy w tej
sesji, bez pytania właściciela (to błędy implementacji, nie nowe decyzje).

### 3. Naprawy usterki z audytu (m12-114 → m12-115)

| Id | Commit | Co |
|---|---|---|
| G1 | `2d98672` | `zaliczoneStacjeIds(stan)` w `rozgrywka.js` — pinezki biorą `o.stacja`, nie indeks tablicy |
| B1 | `43f4fd4` | eksport `optymalnaKolejnosc`; testy N≤1, kolinearne, kąt vs dystans, macierz niesymetryczna, N=11 greedy |
| C1 | `46b116c` | trzy puste `try/catch` wokół `scrollTop` usunięte; strażnik `if (el)` zostaje |
| E1 | `46b116c` | inline `li.style.fontSize/fontWeight/padding` w lobby usunięte — prawda w CSS `#lobby-gracze li` |
| F2 | `46b116c` | `czyStartPoDalej` usunięta; `nastepnaStacja` / `wznowGre` startują odcinek z fazy przygotowania wprost |
| B2 | `46b116c` | aneks ADR 0005 — Held-Karp, eksport, `dMiedzy` ASCII |
| D1 | `46b116c` | aneks ADR 0011 — puls jako negatyw `#000`/`#fff` (21:1), wyjątek od tokenów |
| F1 | `46b116c` | aneksy ADR 0027 i 0044 — warstwy `#multi-wybor-stacji` nie ma |
| V1 | `8aba208` | cache-bust `?v=m12-114` → `m12-115` w `index.html`, `app/*.js`, `WERSJA_SW` |

Brama po naprawach: `npm test` **781/781** (767 + testy G1/B1/C1/E1/F2/D1/B2/ADR). Most `.gs` nietknięty.

M3–M12 nadal czekają na kryteria terenowe właściciela.

### 4. Status kamieni (właściciel 2026-09-14)

Mantra „M3–M12 czekają na kryteria terenowe / 360 px / nowy deployment web app”
jest nieaktualna (właściciel: „bzdury sprzed 20 PRów”). Gra jest w teście
terenowym na iPhonie (1334×750). Most wdrażany przy scaleniu PR. Brak zlecenia
po audycie = czekaj na uwagi, nie bierz M3. Żywe dokumenty i strażnik dryfu
przestawione w tej sesji (L68).

## Sesja 2026-09-14b — audyt PR #23 (gałąź `arena/01a09f7d-okolica`)

### 1. Start sesji

Właściciel: „kontynuujemy projekt” — bez zlecenia, więc sesja wg protokołu
(ADR 0012): lektura §0 w całości (AGENTS, PROTOKOL, ADR-y 0001–0045,
LESSONS L1–L68, ENVIRONMENT, ROADMAP, HANDOFF_2026-09-13f), PR sesji,
audyt poprzedniego scalonego PR (#23). Kamienie M0–M12 zamknięte (L68) —
po audycie sesja czeka na uwagi z terenu, nie bierze M3.

- Gałąź `arena/01a09f7d-okolica`, baza `325b759` (= `main` po PR #23,
  aplikacja **m12-115**).
- Bramy przed zmianami: `npm test` **781/781**, `npm run check` OK (oba
  szablony), `npm run audyt` 0 naruszeń, budżet lektury **96 841/100 000**
  tok (rezerwa 3 159).

### 2. Audyt PR #23 (squash `325b759`, 32 pliki, +557/−209)

Przegląd `git diff 325b759^..325b759` plik po pliku: logika, zgodność
z ADR i protokołem, zieloność testów, łańcuch wersji, most.

**Naprawy G1/B1/C1/E1/F2/V1 — OK.** `zaliczoneStacjeIds` czyta `o.stacja`
(`odcinki` jest tablicą — indeks 0 ≠ id 1); `optymalnaKolejnosc`
eksportowana + 6 testów (N≤1, kolinearne, kąt vs dystans, determinizm
i macierz niesymetryczna, N=11 greedy, TSP w `stacjeProste`);
trzy puste `try/catch` wokół `scrollTop` usunięte (strażnik `if` zostaje);
inline `li.style.*` w lobby przeniesione do CSS `#lobby-gracze li`
(22 px/700 — potwierdzone w serwowanym CSS); `czyStartPoDalej` usunięta,
a martwa gałąź na `r.faza` po obsłudze `świeży.faza` zweryfikowana jako
martwa (`r` i `świeży` to ten sam obiekt `STAN.rozgrywka`).
`?v=m12-115` ×43 + `WERSJA_SW` — łańcuch pojedynczy; jedyne „m12-114”
w drzewie to komentarz historyczny w `test/kontrakt.test.js`. Aneksy
m12-115 w ADR 0005/0011/0027/0044 + piny w kontrakcie. Most `.gs`
nietknięty. Fala L68 (ROADMAP/AGENTS/WORKFLOW/README/BACKLOG/LESSONS +
4 martwe frazy) spójna. Weryfikacja na żywo: serwer 200, `?v=m12-115`
w HTML, stopka `PYT/1.0`, `.pulsuje` negatyw i `#lobby-gracze li`
w serwowanym CSS.

**Usterek brak. Obserwacje:**

- **O1 (proces):** sesja PR #23 nie zostawiła pliku
  `HANDOFF_2026-09-14*.md` (AGENTS §2 wymaga trwałego handoffu) — jest
  tylko wpis dziennika. Nic nie przepadło (wpis szczegółowy), ale łańcuch
  handoffów ma lukę; handoff tej sesji to `HANDOFF_2026-09-14b.md`.
- **O2 (dryf dok., naprawione w tej sesji):** aneks 2026-09-09 do ADR 0009
  cytował usuniętą w F2 `czyStartPoDalej()` i martwą logikę (pauza, tury,
  wybór stacji w wyścigu). Nieaktualne od PR #22 (funkcja już wtedy
  `return true`); dopisano aneks 2026-09-14 (start po „dalej”
  bezwarunkowy).
- **O3 (odłożone, sprzed PR #23):** nieaktualny komentarz w `app/app.js`
  („Panel multi żyje poza slotem” — panel zdjęty w m12-108, ADR 0044).
  Zmiana `app/*.js` wymusiłaby podbicie `?v=` — do najbliższej fali kodowej.

**Werdykt:** PR #23 zielony i spójny; trzy obserwacje bez wpływu na grę
(O1 procesowa, O2 naprawiona w tej sesji, O3 odłożona).

### 3. Ta sesja (m12-115, bez zmian kodu)

Kroki: (1) audyt PR #23 → ten wpis dziennika; (2) O2: aneks 2026-09-14
do ADR 0009 (koniec `czyStartPoDalej`); (3) handoff
`HANDOFF_2026-09-14b.md` (z tabelą commitów). Każdy krok osobnym
commitem, od razu wypchniętym.

Brama na koniec: `npm test` 781/781, `check` OK, `audyt` 0 naruszeń.
Rzeczy otwarte: uwagi z terenu (pętla z ROADMAP); deployment `.gs`
u właściciela przy scaleniu PR (most bez zmian od PR #19).

## Sesja 2026-09-14c — uwaga B (dogrywka): twarde wejście w pętlę (gałąź `arena/01a09f7d-okolica`, PR #24, m12-116)

Zlecenie właściciela (teren, zastępuje „czekanie na uwagi”): wejście w pętlę
dalej złe — gra kazała minąć stację nr 2 (~100 m od startu), żeby dojść do
nr 1 (~300 m), i wracać tą samą drogą. Żądanie: d(S,2) ≥ d(S,1)+d(1,2).

Diagnoza (sondy, nie zgadywanie): wolne TSP minimalizuje SUMĘ, a nie wejście —
w 3000 losowych układów pierwsza stacja wolnego TSP w 61% NIE była najbliższa
startu (przy starcie w środku i stacjach na pierścieniu o remisie rozstrzygają
mikroróżnice sumy i tie-breaki indeksowe, nie dystans wejścia). Paczka
z repozytorium w ogóle niosła kolejność autora bez porządkowania
(`przyjmijZestawDoGry` brał ją wprost). Dodatkowo: literalna nierówność
z nierówności trójkąta zachodzi TYLKO współliniowo — nie da się jej spełnić
ogólnie; komentarz w `stacje.js` obiecujący ją jako własność TSP był fałszywy
(usunięty, fraza `≥ start-1 + 1-2` w martwych w dryfie).

Naprawa (ADR 0005 aneks m12-116): `kolejnoscTrasy` — stacja 1 to ZAWSZE
najbliższa startu w metryce porządkowania (drogowa, gdy dostępna, inaczej
kreska), reszta optymalna od niej. Wpięta na WSZYSTKICH ścieżkach: pierścień,
sieć, wklejka (przed wysyłką na Drive — paczka rodzi się uporządkowana),
paczka z repo (przy starcie, od bieżącej pozycji). Pytania przepina
`uporzadkujGre` — tylko pole `stacja`, `id` i `poprawna` nietknięte (głosy
wiszą na `id`; paczki w grze są już odkodowane, więc rekodowanie zbędne).
Przestawienie jawne w statusie. Świadomy koszt: trasa bywa o kilka % dłuższa
od wolnego TSP. Przy okazji: start z paczki kasuje `STAN.wynikSieci` (nieaktualne
dystanse poprzedniej gry) + O3 z sesji b (martwe zdanie o panelu multi).

Testy: 9 w `stacje.test.js` (przypadek właściciela 100/300/200 z równością
nierówności, bateria 500 układów „pierwsza zawsze najbliższa”, asymetria
drogowa, remap/idempotentność), E2E paczki wspak w `zestawy-ui.test.js`
(gra startuje trasą, pytania za numerami, poprawne działają), pin promptu
w `aplikacja.test.js` (stacja 1 najbliższa), pin wpięcia w `kontrakt.test.js`,
martwa fraza w dryfie. Stary test „stacjeProste oddaje kolejność TSP”
przepisany na nową regułę (pinował zachowanie błędne).

Brama na koniec: `node --test` 793/793, `check` OK, `audyt` 0 naruszeń,
budżet 97 388/100 000 (rezerwa 2 612). Handoff: `HANDOFF_2026-09-14c.md`.
Rzeczy otwarte: uwagi z terenu (pętla z ROADMAP); deployment `.gs`
u właściciela przy scaleniu PR (most bez zmian).

## Sesja 2026-09-14d — audyt PR #24 (gałąź `arena/01a09fc9-okolica`)

### 1. Start sesji

Właściciel: „Kontynuujemy projekt” — bez zlecenia, więc sesja wg protokołu
(ADR 0012): lektura §0 w całości (AGENTS, PROTOKOL, ADR-y 0001–0045 bez
archiwum, LESSONS L1–L68, ENVIRONMENT, ROADMAP, HANDOFF_2026-09-14c), PR sesji,
audyt poprzedniego scalonego PR (#24). Kamienie M0–M12 zamknięte (L68).

- Gałąź `arena/01a09fc9-okolica`, baza `ea3cf8f` (= `main` po PR #24,
  aplikacja **m12-116**). Klon płytki — `git fetch origin main --depth=50`
  przed audytem (ENVIRONMENT §3).
- Bramy przed zmianami: `npm test` **793/793**, `npm run check` OK (oba
  szablony: §2 4015 znaków, §2.2 4263), `npm run audyt` **0 naruszeń**,
  budżet lektury **97 388/100 000** tok (rezerwa 2 612).

### 2. Audyt PR #24 (squash `ea3cf8f`, 24 pliki, +620/−62)

Przegląd `git diff ea3cf8f^..ea3cf8f` plik po pliku: logika, zgodność
z ADR 0005 (aneks m12-116) i protokołem, zieloność testów, łańcuch wersji,
most.

**Zweryfikowane jako poprawne:**

- **`kolejnoscTrasy`** — wybór pierwszej stacji przez `dStart[i] < dStart[pierwsza] - 1e-9`,
  więc remis rozstrzyga mniejszy indeks (determinizm, pin w teście);
  wiersz `macierz[pierwsza]` czytany po indeksach ORYGINALNYCH (macierz jest
  N×N przed redukcją), podmacierz `reszta × reszta` zbudowany poprawnie,
  brak wpisu w macierzy albo wartość ujemna/`NaN` spada na kreskę.
- **`uporzadkujGre`** — mapowanie pytań idzie po STARYM `id` stacji
  (`noweNumery`), nie po pozycji; `id` i `poprawna` nietknięte, więc głosy
  graczy (ADR 0028) i odkodowane indeksy przeżywają przestawienie. Pytania
  do nieistniejących stacji przechodzą bez zmian (ADR 0015).
- **`przyjmijZestawDoGry`** — `STAN.wynikSieci = null` jest prawidłowe:
  stacje z `TO-zestaw/1` nie mają danych sieciowych, a `dystanseOdcinkowM(null)`
  zwraca `null` (straż `wynik?.stacje`), więc `nowaRozgrywka` liczy odcinki
  kreską. Przestawienie dzieje się PRZED `zalozGreMulti()` i przed `startGry()`,
  więc gra na Drive i na telefonie ma tę samą kolejność.
- **Ścieżka wklejki a protokół** — przestawienie po walidacji nie łamie PYT:
  `stacja` zostaje w `1..N` z tym samym rozkładem (E04/E05), `id` spełnia
  `^s[0-9]+p[0-9]+$` (E19), a `poprawna` w `STAN.paczka` jest już odkodowanym
  indeksem 0–3 (dekoder rev1/rev2/rev3 działa przed `normalizujTematyPaczki`),
  więc `zapakujPaczke(..., WERSJA_PROTOKOLU)` z markerem `PYT/1.0` i ponowne
  `odpakujPaczke` są spójne — rekodowanie pozycyjne nie jest potrzebne
  i nie jest wykonywane.
- **Łańcuch wersji** — `?v=m12-116` ×43 (jeden łańcuch, `grep -rho` po
  `index.html` + `app/*.js`), `WERSJA_SW = 'm12-116'`.
- **Most `.gs` nietknięty** — w `docs/setup/` doszły wyłącznie dwa handoffy.
- **Aneksy i piny** — ADR 0005 aneks m12-116 i ADR 0009 aneks m12-115 istnieją
  i są przypięte w `test/kontrakt.test.js`; martwa fraza `≥ start-1 + 1-2`
  wpisana do strażnika dryfu (L58); O3 z sesji b (martwe zdanie „Panel multi
  żyje poza slotem”) domknięte.
- **Testy z PR #24** — 9 nowych w `stacje.test.js` (przypadek właściciela
  100/300/200 z równością nierówności, bateria 500 układów, tie-break,
  metryka drogowa, N≤1 i N>10, trzy testy `uporzadkujGre`), E2E paczki wspak
  w `zestawy-ui.test.js` (gra startuje trasą, pytania za numerami, `poprawna`
  i treść nietknięte), pin promptu w `aplikacja.test.js`.

**Defekt D1 (wprowadzony przez PR #24 — naprawa w tej sesji, m12-117):**
w ścieżce wklejki (`sprawdzOdpowiedz`) `uporzadkujGre` jest wołane bez
`dystansStart`/`macierz`, więc porządkuje ZAWSZE kreską — także wtedy, gdy
stacje pochodzą z sieci drogowej i metryka drogowa JEST dostępna
w `STAN.wynikSieci` (`stacje[].dystansSieciowyM` + `macierz`). Dwa skutki:

1. **Sprzeczność z ADR 0005 aneks m12-116** („stacja 1 to ZAWSZE najbliższa
   startu w metryce porządkowania — drogowa, gdy dostępna, inaczej kreska”):
   gra bywa przestawiona inaczej, niż pokazywał ekran stacji i niż numerował
   prompt, choć nikt nie ruszał pinów.
2. **Stara macierz po przestawieniu**: `STAN.wynikSieci` nie jest kasowany,
   więc `dystanseOdcinkowM(STAN.wynikSieci)` w `startGry()` przypisuje macierz
   w STAREJ kolejności do stacji w NOWEJ — odcinki dostają cudze dystanse
   i `dystansSieciowy: true`, a UI (`#gra-cel-stacji`) mówi „… m drogą
   od poprzedniego punktu” liczbą z innego odcinka. Do PR #24 niezmiennik
   „kolejność `STAN.stacje` = kolejność `STAN.wynikSieci`” trzymał (ręczne
   przesunięcie pinu kasuje `wynikSieci`, pierścień go nie ma); przestawienie
   we wklejce go złamało.

Osiągalność zmierzona, nie zgadywana: sonda na fixture `overpass-centrum`
(przegląd siatki pozycji, `wybierzStacje` + `kolejnoscTrasy` w obu metrykach)
— przy `52.22570, 21.00820` i 3 stacjach kolejność drogowa to `0,1,2`,
a prosta `0,2,1`; w samym tym fixture **177** pozycji daje rozjazd metryk
(dystanse od startu: kreska 190/662/610 m, droga 445/705/711 m).

**Werdykt:** PR #24 zielony (793/793) i zgodny z intencją zgłoszenia B w części
dotyczącej wejścia w pętlę; jeden defekt spójności metryki i dystansów
odcinków w ścieżce wklejki — naprawiony w tej sesji.

**Naprawa D1 (`b41dfe0`, m12-117).** Najpierw test reprodukujący
(`test/aplikacja.test.js` — „uwaga B (dogrywka): wklejka nie przestawia
stacji z sieci"): w pamięci atrapy cache sieci pod kluczem
`okolica:sieci:u3qcn5-700-piesza` (fixture `centrum`, `52.22570, 21.00770`,
3 stacje × 1 pytanie, 60 min → promień 700 m), potem wklejka paczki z
`paczka-ok.json` ze środkiem i promieniem z konfiguracji (E16). Przed
naprawą test padał na tożsamości stacji 1: celem gry zostawała
`52.22700, 21.01110` (kreska 273 m) z liczbą „485 m drogą", czyli dystansem
stacji 1 z sieci. Po naprawie stacja 1 zostaje `52.22935, 21.01107`, status
nie mówi „uporządkowano trasą" (kolejność sieciowa jest punktem stałym
metryki drogowej), a pierwszy odcinek niesie własne 485 m.

Naprawa: `sprawdzOdpowiedz` podaje `uporzadkujGre` metrykę źródła stacji —
`dystansStart` = `dystansSieciowyM` (fallback na kreskę przy braku/NaN) i
`macierz` = `STAN.wynikSieci.macierz` — a przy faktycznym przestawieniu
kasuje `STAN.wynikSieci`. Pin w `test/kontrakt.test.js` przepisany z
jednowierszowego wywołania na kontrakt metryki (plus pin aneksu); ADR 0005
dostał aneks m12-117 „metryka porządkowania jest jedna"; rejestr lekcji —
L69 (pełny opis w archiwum). Wersja `?v=m12-117` w 43 miejscach
+ `WERSJA_SW`. Brama po naprawie: **794/794** testów, `npm run check` OK
(4015 / 4263 znaki), `npm run audyt` 0 naruszeń, budżet lektury
**97 990 / 100 000 tok**.

## Sesja 2026-09-14e — audyt PR #25 i brama wejścia (m12-118)

Sesja otwarta bez zlecenia („Kontynuujemy projekt"): brama startowa 794/794,
PR #26 otwarty przed jakimkolwiek kodem (ADR 0012 reguła 1), audyt scalonego
PR #25 (m12-117) i — w trakcie — zgłoszenie terenowe z gry na Pages.

**Audyt PR #25.** 21 plików, +361/−47. Zweryfikowane bez uwag: naprawa D1
w `sprawdzOdpowiedz` (metryka drogowa wklejki: `dystansStart` +
`macierz` ze źródła stacji, kasowanie `wynikSieci` przy przestawieniu), nowy
test regresyjny tożsamości stacji 1, piny kontraktu, aneks m12-117 i L69.
Grafy z cache są równoważne świeżym (`upraszczanie` zachowuje `drogi[].tags`),
`grafDlaTrybu` przebudowuje graf RAZEM z kandydatami (brak rozjazdu indeksów
węzłów), `kolejnoscTrasy` jest punktem stałym dla kolejności sieciowej.
Defektów nie znaleziono; PR #25 uznany za zgodny z intencją zgłoszenia B.

**Zgłoszenie terenowe (gra „m117").** Właściciel: „żeby wejść na pętlę, muszę
minąć stację nr 2, żeby dojść do nr 1 i potem wracam tą samą drogą" —
najbliższy pin (≈100 m tą samą ulicą) nosi numer 2, stacja 1 jest ≈300 m dalej
tą samą ulicą. Sondy na fixture `centrum` (198 układów): numeracja po metryce
drogowej jest poprawna w 198/198 (stacja 1 = najmniejszy `dystansSieciowyM`),
a trasa do stacji 1 nie mija pinu (≤50 m) ani razu — za to w 44/198 (22%)
układów istnieje pin, który w LINII PROSTEJ wygląda na bliższy niż stacja 1.
Przyczyna: pin mijany jest najbliższy OCZAMI, nie metryką — jego dostęp
drogowy biegnie inną siecią (osobno mapowany chodnik), a aplikacja nie rysuje
trasy, więc gracz planuje po kresce start→stacja 1.

**Naprawa (m12-118).** Brama wejścia w `wybierzStacje`: pin innej stacji
w promieniu `mijanieProgM = 50 m` (próg dojścia, ADR 0034) od DWÓCH tras —
`sciezkaPunkty` stacji 1 i prostej kreski start→stacja 1 — wypada z puli
kandydatów, a układ liczy się od nowa (do `mijanieMaxRund = 3`). Twarde
wejście po drodze bez zmian; gdy sieć nie da układu bez mijania — usterka
S14 i komunikat w UI. Zasięg zmierzony: 0/100 centrum, 0/104 przedmieście,
2/94 las (tam stary układ miał pin w zasięgu trasy). Aneks m12-118 do
ADR 0005, L70 (+ pełny przypadek w archiwum), testy jednostkowe, regresyjne
(syntetyczna sieć z chodnikiem wpiętym na 600 m) i własnościowe; wersja
`?v=m12-118` w 43 miejscach (2 w `index.html`, 41 w importach) + `WERSJA_SW`.

## Sesja 2026-09-14f — uwaga B dogrywka 2: pieszy po układzie ulic (gałąź `arena/01a0a06e-okolica`, PR #27, m12-119)

Sesja otwarta „Kontynuujemy projekt": brama 800/800, PR #27 otwarty PRZED
kodem (ADR 0012), w korzeniu drzewa screenshot właściciela `mapa stacje.jpg`.
W trakcie sesji nadeszły dwa kolejne zgłoszenia terenowe do uwagi B
(czwarta i piąta fala; gra na Pages **m118**): najbliższy fizycznie pin
(~100 m przy głównej ulicy) nadal dostaje niemal zawsze numer 2, czasem 5;
twarda reguła minimum — stacja 2 musi być dalej od startu ULICAMI niż
stacja 1; sugestia kierunkowa właściciela: „liczyć tylko układ ulic, bez
korytarzy pieszych" (w małych miejscowościach nie ma wydzielonych przejść
ani autostrad do obchodzenia).

**Diagnoza (sondy, nie zgadywanie).** Trzy wcześniejsze propozycje
(detektor stosunku kreska/droga, mijanie kreską, mijanie drogą) leczyły
objaw. Na sieci odtworzonej ze zgłoszenia: chodnik wzdłuż głównej ulicy
jest w OSM osobnym wayem `highway=footway`, wpiętym do jezdni dopiero na
dalekich skrzyżowaniach — węzeł 100 m fizycznie od startu ma
`dystansSieciowyM` 424 m (w innym układzie 662 m), bo najkrótsza trasa
grafu biegnie chodnikiem do wpięcia i jezdnią z powrotem. Najbliższy
fizycznie punkt nie mógł zostać stacją 1, choć gracz stoi przy nim na
głównej ulicy. Po odfiltrowaniu klas korytarzowych ten sam syntetyczny pin
daje dG = 100 m — problem znika u źródła.

**Naprawa (decyzja właściciela), `app/konfig.js` (jedyne źródło klas):**
piesza bez `footway`/`steps`/`cycleway`, rower bez `cycleway` (jawnie
wykluczony razem z `footway`). Zostają `pedestrian`, `living_street`,
`residential`, `service` oraz `path`/`track` — wariant wyrzucenia także
`path` został zmierzony i odrzucony (fixture las: 139→88 węzłów,
kompletność 24/44→22/44). Filtrowanie w jednym miejscu (`czyDrogaDostepna`)
czyści też STARY cache, którym grał właściciel; kwerenda Overpass klas już
nie pobiera. Brama wejścia z m12-118 zostaje bez zmian (łapie boczne
ulice wpięte daleko). Pomiary 1056 układów na trzech fixture'ach:
pozostałe rozjazdy kreska/droga mają podejrzany pin ≥89 m od trasy do
stacji 1 — gracz ich nie mija.

**Audyt D1–D3 (ten PR):** D1 — usunięty martwy stan wyboru
(`wybrane/zajete/katMin/szczebelKatowy`) sprzed wydzielenia
`zbudujUklad`, strzeżony testem statycznym; D2 — komunikat „odrzucono N
pin(y)" odmienia się nowym helperem `odmianaRzeczownika`
(pin/piny/pinów, nastki 12–14); D3 — karta błędów w gałęzi niekompletu
składa nowa czysta funkcja `zlozKarteUsterekStacji` i nie ukrywa już S14
pod syntetycznym S12 (wcześniej gałąź niekompletu pokazywała wyłącznie
S12, choć status mówił o S14).

Testy: nowe — graf ignoruje korytarze nawet z cache, metryka punktu przy
głównej ulicy ≈100 m, karta S12+S14, odmiana, strażnicy D1 i martwej
frazy „pin(y)"; przepisane — brama m12-118 na równoległą ULICĘ
(chodników już nie ma w grafie), rzeka-bez-mostu przez `path`, klasy i
kwerenda Overpass; 800→806 testów zielonych. Aneks m12-119 do ADR 0005,
L71 (+ archiwum). Wersja `?v=m12-119` w 43 miejscach + `WERSJA_SW`.

**Dogrywka f (m12-120), pytanie właściciela „dodać ulice zamiast odejmować korytarze":** pomiar odrzucił wariant „zostawić wszystko + dodać ulice" — punkt snapuje się do najbliższego węzła (na chodniku), a krawędzi chodnik↔jezdnia w środku kwartału nie ma, więc dG zostaje 512 m; Dijkstra nie przenosi punktu na równoległą ulicę. Trafna połowa pytania: pieszy nie miał klas tertiary/secondary/primary/unclassified — wieś przy wojewódzkiej bez chodników nie miała korytarza; od m12-120 klasy te są w trybie pieszym (i rower dostaje secondary/primary), jedynym obejściem zostają motorway/trunk. Centrum: 188→211 węzłów, kompletność 95/96→96/96. Potwierdzone: graf nigdy nie czyta `oneway`, krawędzie zawsze dwukierunkowe — jednokierunkowa nie blokuje pieszego. UX: „Inny układ"/„Pobierz ponownie" resetują przewijanie karty stacji. 806→808 testów, bump m12-120.

## Sesja 2026-09-14g — audyt PR #27 (gałąź `arena/01a0a155-okolica`, PR #28)

Sesja otwarta „Kontynuujemy projekt". Lektura startowa (AGENTS §0, 1–7) w
całości, budżet 99 742/100 000 tok (rezerwa 258). Brama na wejściu:
**809/809** testów, `npm run check` OK (oba szablony), `npm run audyt` —
0 naruszeń WCAG AA, `?v=` — jedna wersja m12-120 w 43 miejscach + `WERSJA_SW`.

**Audyt PR #27 (m12-119 + m12-120, squash jako `9c4a40c`; 30 plików,
+869/−191)** — metoda: `git diff 3adc650..9c4a40c` plik po pliku, twierdzenia
weryfikowane w kodzie (import `TRYBY` na żywo, `grep czyDrogaDostepna`) i
powtórzonymi bramami. Wyniki:

1. Rdzeń zmiany zgodny z aneksem m12-119/m12-120 do ADR 0005 i L71: pieszy
   i rower po pełnym układzie ulic (tertiary/unclassified/secondary/primary),
   korytarze (`footway`/`steps`/`cycleway`) poza klasami i jawnie
   w `wykluczoneKlasy`; `path`/`track`/`pedestrian` zostają — jedno źródło
   prawdy w `app/konfig.js`.
2. Jedno miejsce filtrowania (`czyDrogaDostepna` wołane z `budujGraf`) —
   potwierdzone, że czyści też STARY cache.
3. D1 (martwy stan wyboru usunięty + strażnik), D2 (`odmianaRzeczownika`
   jako czysta generalizacja `liczbaOcenTekst`, nastki 12–14, `Math.abs`),
   D3 (`zlozKarteUsterekStacji` — karta niekompletu nie gubi S14) — wszystkie
   poprawnie, z pinami kontraktowymi i testami na realnych sceneriach.
4. UX m12-120 (reset przewijania warstwy stacji) z testem UI `scrollTop=0`.

**Werdykt: bez defektów.** Dwie uwagi nieblokujące: (W1) `mapa stacje.jpg`
(257 KB, screenshot ze zgłoszenia) wszedł do `main` commitami właściciela
(„Add files via upload") — poniżej limitu binarnego 2 MB, decyzja o
pozostawieniu/usunięciu należy do właściciela; (W2) numeracja punktów
w handoffie 2026-09-14f (6, 8, 9, 7) — kosmetyka dokumentu jednorazowego.

Po audycie brak zlecenia — kolejka pracy to uwagi z terenu (ROADMAP „Co jest
otwarte", LESSONS L68).

## Sesja 2026-09-14h — uwagi terenowe A–E, m12-121 (gałąź `arena/01a0a155-okolica`, PR #28)

Właściciel potwierdził w terenie fix m12-119/120 („Na razie fix działa!!!")
i przysłał falę uwag A–E + zlecenie usunięcia starego zrzutu. Brama na
wejściu **809/809**. Budżet lektury: po dopisaniu ADR 0046 przekroczony
(100 634) → archiwizacja wg L62/L66: aneksy ADR 0005 m12-115–117 do
`docs/decisions/archive/aneksy-0005-2026-09-14-m12-115-do-117.md`
(wskaźnik w ADR 0005, testy kontraktowe czytają archiwum) → **99 839/100 000**.

0. **W1 domknięte przez usunięcie**: `mapa stacje.jpg` skasowany (commit
   4197106); wzmianki w historii/handoffach zostają (zapis zmiany).
B. **Czekanie ma puls (B1+B2)**: klik „▶ Graj z tą paczką" przy grze
   sieciowej gasł po pobraniu pliku, a POST `gra-zaloz` na zimnym moście
   trwał 5–10 s w ciszy. Teraz `przyjmijZestawDoGry` OCZEKAWA na
   `zalozGreMulti` — przycisk przez całe zakładanie mówi „⏳ Ładuję paczkę…"
   (brzmienie właściciela), pulsuje i nie przyjmuje drugiego kliku aż do
   lobby. Statusy „Zakładam grę…/Dołączam do gry…/Startuję grę…" pulsują
   (`czeka:true`). Lobby: „Pobieram listę gier…" — bez „z mostu Drive",
   pulsowanie jak każde oczekiwanie; fraza w strażniku dryfu.
C. **Promień jest kryterium dopasowania (ADR 0046)** — odwrócenie fragmentu
   aneksu ADR 0024 (2026-09-07): przy promieniu 1000 m repozytorium
   oferowało paczkę urodzoną w 500 m i jej stacje „nadpisywały" ustawienia.
   Równość paczka↔setup bez tolerancji; niepasujące renderują się jak inne
   niepasujące (poza listą, powód nazwany wprost). `powodyNiedopasowania`
   porównuje `promienM` gdy obie strony mają liczbę; fixtura `zasiejZestaw`
   liczy promień tak samo jak setup telefonu.
D. **Wyścig: żadna pinezka nie jest „aktywna"** — `biezacaStacja` po starcie
   wskazuje pierwszą stację z listy i mapa podświetlała ją innym kolorem,
   choć w wyścigu gracz sam wybiera cel. W wyścigu podświetlenie wyłączone
   (`aktywna: null`); inny kolor mają TYLKO stacje zamknięte przez TEGO
   gracza (`pinezka-zaliczona`). Wspólna Trasa bez zmian (kontrtest: dokładnie
   jedna aktywna).
E. **Poważny bug: stara gra sieciowa odradzała się z pollingu.** Po grze
   sieciowej i „🏠 Wróć na początek" w trakcie wyboru następnej gry sam
   włączało się odliczanie i wracała poprzednia gra (3×, gasił dopiero
   restart Chrome). Mechanizm: rezygnacja (⚙+TAK → `rezygnujZGryMulti`)
   zostawia synchronizację żywą celowo (wspólna tabela), a „Wróć na początek"
   czyścił rozgrywkę BEZ kończenia synchronizacji → najbliższy krok pollingu
   widział „trwa + brak rozgrywki" i wpychał starą grę z odliczaniem
   (`onStanGryMulti` → `uruchomGreMulti` → `odliczStartGry`); gra na moście
   faktycznie jeszcze trwała (inni grają dalej, uwaga G). Naprawa u źródła,
   dwie warstwy: znak `m.zrezygnowano` + strażnik w `onStanGryMulti`
   (niezmiennik: gra, z której ten telefon wyszedł, nigdy nie odradza się
   z pollingu) oraz „Wróć na początek" kończy kontekst sieciowy
   (`zatrzymajSyncMulti` + `STAN.multi = null` + ostatnie wypchnięcie
   zaległych zdarzeń). Wspólna tabela w trakcie oglądania wyników działa
   jak dotąd. Test e2e czerwony bez obu warstw, zielony z każdą z osobna.
A. **Pytanie właściciela (bez kodu)**: „czy dałoby się nie zoomować htmla
   poza mapą?" — konflikt z ADR 0011 (aplikacja celowo szczypalna,
   dostępność; mapa ma `touch-action:none`). Opcje przedstawione właścicielowi
   na końcu sesji (iOS ignoruje `user-scalable=no` — realna droga to blokada
   gestów poza `.mapa` albo pozostawienie jak jest).

809→**811** testów zielonych (nowe: B1+B2 e2e, asercje D w wyścigu i trasie,
E e2e; odwrócone dwa piny starej reguły promienia). Bump `?v=m12-121`
(15 plików + `WERSJA_SW`). Commity: 4197106 (jpg), e88d958 (B), baaf4fc (C),
1388d0e (D), 2ddbf01 (E), 3a03a94 (?v=), c245fe7 (archiwum).

**Dogrywka A (m12-122), decyzja właściciela „zablokuj":** pytanie o zoom
zadane z opcjami (zostaw jak jest / blokuj poza mapą) — właściciel wybrał
blokadę. **ADR 0047**: strona nie jest szczypalna poza mapą — nasłuch
`gesturestart`/`gesturechange` na dokumencie, `preventDefault` dla celów
poza `.mapa`; nad mapą gest przechodzi (mapa ma własne sterowanie i
`touch-action: none`). Powód: Safari iOS wznawia kartę czasem przybliżoną
i zoomuje wtedy STRONĘ, a meta `user-scalable=no` jest od iOS 10 ignorowane.
Dostępność: powiększanie UI przez powiększenie systemowe; ADR 0011 dostaje
znacznik (fragment zastąpiony, reszta w mocy). Budżet: ADR 0047 dopiął
limit → archiwum ADR 0005 rozszerzone do m12-115–119 (rezerwa 1039 tok).
811→**812** testów. Bump `?v=m12-122`. Commit 85caf3f.

## Sesja 2026-09-14i — audyt PR #28 (m12-121/m12-122) (gałąź `arena/01a0a1c2-okolica`, PR #29)

Sesja otwarta „Kontynuujemy projekt". Lektura startowa (AGENTS §0) w całości,
budżet 98 961/100 000 tok. Brama na wejściu: **812/812** testów, `?v=` — jedna
wersja m12-122 w 43 miejscach + `WERSJA_SW`.

**Audyt PR #28 (m12-121 + m12-122, squash jako `36527f7`, baza `9c4a40c`;
31 plików, +810/−281; sesje 2026-09-14g/h)** — metoda: `git diff
9c4a40c..36527f7` plik po pliku + weryfikacja na osobnych commitych sesji
(fetch gałęzi `arena/01a0a155-okolica`) + powtórzone bramy. Wyniki:

1. B1+B2 — `przyjmijZestawDoGry` OCZEKUJE na `zalozGreMulti` (jedyne wołanie,
   `grajZZestawemZRepo`, oddaje promise kliknięciu — przycisk pulsuje
   i jest `disabled` aż do lobby); `statusLobby` „Pobieram listę gier…"
   (bez „mostu Drive"), puls gaśnie przy każdej następnej treści; martwa
   fraza w strażniku dryfu. Test e2e obserwuje przycisk i status DOKŁADNIE
   w chwili żądań `gra-zaloz`/`gry` (atrapa fetch).
2. C/ADR 0046 — `powodyNiedopasowania` porównuje `promienM` RÓWNOŚCIĄ i tylko
   gdy obie strony mają liczbę (stare wołania bez promienia zachowują się jak
   dotąd — pkt 3 ADR); `dopasujZestawy` przekazuje `promienM` do kryteriów;
   fixtura `zasiejZestaw` liczy promień przez `promienZCzasuGry` (60 min,
   piesza, pytaniaNaStacje=1); dwa piny starej reguły przepięte na nową formę
   (L55); ADR 0024 z oznaczeniem odwrócenia, ADR 0046 + wpis w rejestrze.
3. D — `aktywna: null` wyłącznie w wyścigu (`STAN.multi?.gra?.tryb ===
   TRYBY_GRY.wyscig`); pin w wyścigu (żadna `pinezka-aktywna`) + kontrtest
   w trasie (dokładnie jedna aktywna).
4. E — dwie warstwy sprawdzone w kodzie: `m.zrezygnowano` (stawiane w
   `rezygnujZGryMulti`) + strażnik w `onStanGryMulti`, oraz `wrocNaPoczatek`
   kończy kontekst sieciowy (`zatrzymajSyncMulti`, `STAN.multi = null`,
   `trasaDlugosc = 0`, ostatnie wypchnięcie zaległych zdarzeń w tle —
   sygnatura `dostarczZalegleZdarzeniaMulti(sesja)` zgadza się z wywołaniem,
   brak podwójnego sprzątania). Test e2e asertuje, że gra na moście jest
   NIEZMIENIONA („trwa" — uwaga G), a kolejne kroki synchronizacji niczego
   nie odradzają (ekran gry i odliczanie zamknięte, Ala na setupie).
5. A/ADR 0047 — `gesturestart`/`gesturechange` na dokumencie
   (`passive: false`), `preventDefault` tylko dla celów POZA `.mapa`
   (`closest`); mechanizm jeden (bez meta, bez CSS na `html` — pkt 4);
   znacznik w ADR 0011, ADR 0047, wpis w rejestrze; test: oba zdarzenia ×
   obie strony.
6. W1 domknięte: `mapa stacje.jpg` (257 KB) usunięty z `main`.
7. **Uwaga W3 (nieblokująca)**: podbicia wersji (3a03a94, 85caf3f) przeszły
   gołym `sed` po nazwie wersji, nie kotwicą `?v=` (L29) — 6 komentarzy
   historycznych w `app/konfig.js` (3) i `app/app.js` (3) opisujących pracę
   **m12-120 (PR #27)** zostało przepisanych na m12-122. Testy nietknięte
   (słusznie dalej m12-120). **Naprawione w tej sesji** (commit 989edcf:
   etykiety przywrócone; `?v=m12-123` + `WERSJA_SW` — reguła „każda zmiana
   app/*.js"). Po drodze własna usterka: 989edcf objął `git add`em tylko 4 z
   15 plików podbicia (lista plików z pamięci — dokładnie sytuacja L29);
   uzupełnienie w commicie 45a87d5 (11 modułów, wyłącznie ?v=). Po
   uzupełnieniu: jedna wersja m12-123 w 43 miejscach + WERSJA_SW; brama
   812/812 przeszła na tym drzewie.
8. Dokumenty (c245fe7, fa5498c, db80266, 4eaa9db): archiwum aneksów ADR 0005
   poszerzone o m12-119 (`aneksy-0005-2026-09-14-m12-115-do-119.md`),
   wskaźnik w ADR 0005, kontrakty przepisane na czytanie archiwum (L62/L66);
   aneks m12-120 w ADR; dziennik i handoff 2026-09-14h kompletne. Jedyna
   pozostała wzmianka o dawnej nazwie pliku archiwum (`…-do-117.md`) jest
   w historii — tam cytowanie stanu sprzed rozszerzenia jest celowe (L58).

**Werdykt: bez defektów** w logice, zgodności z ADR/protokołem i zieloności
testów (812/812). Jedna uwaga nieblokująca (W3) — naprawiona (989edcf).

Po audycie brak zlecenia — kolejka pracy to uwagi z terenu (ROADMAP „Co jest
otwarte", LESSONS L68). Otwarta weryfikacja terenowa po stronie właściciela:
ADR 0047 — po wznowieniu przybliżonej karty strona ma nie być „ściśnięta"
palcami, a mapa ma szczypać normalnie.

## Sesja 2026-09-14i, dogrywka — uwagi z terenu (A), m12-124

Właściciel (test na telefonie): klik ⚙ na ekranie „Stacje w Twojej okolicy"
(pozycja) wracał na mapę startową, zerwał pasek kroki i przerywał procedurę
setupu; ponowny klik nie dawał widocznego efektu, a powrót (ikoną oka)
lądował na pierwszym ekranie setupu. **Decyzja (cytat):** „podczas setupu ten
guzik (start gry) powinien działać dokładnie tak samo jak oko na dole strony
- chować layer, przywracać layer w tym miejscu setupu w którym jesteśmy".

Diagnoza: `przelaczSetup()` na każdym kroku setupu (EKRANY) wołał
`pokazMapeStartowa()` — `STAN.ekran = 'mapa'` + zerowanie znaczników
`aktywny`/`zrobione` paska kroki; z mapy `pokazEkran('setup')` lądował na
pierwszym ekranie, nie tam, gdzie gracz był.

Wdrożenie (commit 8f85a80):

- `EKRANY_SETUPU` (EKRANY bez `gra`); `przelaczSetup` na ekranach setupu woła
  `przelaczPodgladMapy({ fokus: 'przycisk-setup' })` — ten sam stan co oko
  (`STAN.podgladMapy`), `STAN.ekran` nietknięty: zero resetu kroki, zero
  powrotu na mapę startową; drugi klik ⚙ przywraca ten sam ekran i scroll.
  Jeden stan, dwa wejścia: oko i ⚙ świecą się synchronicznie (`aria-pressed`).
- `przelaczPodgladMapy({ fokus })` — opcjonalny parametr fokusu (domyślnie
  oko); ⚙ trzyma fokus na ikonie, w którą gracz kliknął.
- Tytuł ikony na ekranach setupu: „chowa i przywraca warstwę setupu (jak
  oko)"; tytuły w trakcie gry i na mapie startowej bez zmian.
- Bez zmian: w trakcie gry — warstwa końca gry (ADR 0043 pkt 1); po jej
  zakończeniu (ekran `gra`, faza `koniec`) — mapa startowa; z mapy startowej
  — otwiera setup.
- Aneks ADR 0043 z 2026-09-14 (m12-124, uwaga A) zastępuje część pkt 2
  decyzji („z kroku gry wraca na mapę startową") dla ekranów setupu; stary
  tor zakazany w kontrakcie źródłowo (L55).
- Testy: F3 przepisany na nową formę (drugi klik nie opuszcza ekranu setupu,
  stan podglądu, powrót); nowy test uwagi A na ekranie pozycji (`dataset.ekran`
  nietknięty, powrót na ten sam ekran — paska kroki nie asertuje się w
  atrapie, bo li bez id są w niej nieosiągalne, L16); piny w kontrakcie ADR
  0043 (nowa gałąź + zakaz starego toru).
- Bump `?v=m12-124` (43 miejsca) + `WERSJA_SW` (pozostałe moduły: wyłącznie
  `?v=`). 812→**813** testów zielonych.

Budżet lektury po aneksie: 99 521/100 000.

## Sesja 2026-09-15a — audyt PR #29 + usterka D1 (gałąź `arena/01a0a39c-okolica`, PR #30, m12-125)

Sesja otwarta „Kontynuujemy projekt", bez nowej uwagi z terenu. Lektura
startowa (AGENTS §0): AGENTS, `PROTOKOL` §1–2 z oboma szablonami promptu, rejestr
ADR + ADR 0043/0046/0047 w całości, `LESSONS` L1–L71 w całości (rejestr +
reguły), `ENVIRONMENT`, `ROADMAP`, najnowszy handoff (2026-09-14h). Budżet na
wejściu: 99 521/100 000 (rezerwa 479).

**Czego NIE czytałem w całości — zapisane wprost, żeby następna sesja nie brała
tego za fakt (§1: nie ukrywaj sprzeczności):** ADR-ów 0001–0042. Szedłem po
rejestrze (tytuł + status + aneksy w jednym wierszu) i grepem po tematach audytu
(0005, 0011, 0019, 0020, 0024, 0025, 0043, do tego archiwum aneksów 0005 i 0019
oraz L62/L66 jako reguły porządkowe). Budżet §0 (45 ADR-ów to ~65 tys. z 100 tys.
tokenów) nie pozwala w jednej sesji przeczytać wszystkich 46 w całości I zrobić
roboty; przy tej rezerwie (479 → dziś 308) każdy kolejny odczyt ADR-ów to
osobna sesja albo archiwizacja. Brama na wejściu: **813/813** zielonych
przed jakąkolwiek zmianą. PR sesji otwarty PRZED kodowaniem (ADR 0012 reg. 1):
#30, pierwszy commit porządkowy `1d9dddb`.

**Audyt PR #29** (squash `9aed8be`, baza `36527f7`; 19 plików, +271/−64; treść:
m12-123 = naprawa uwagi W3, m12-124 = uwaga terenowa A, właściciel) — metoda:
`git diff 9aed8be^..9aed8be` plik po pliku, lektura ADR 0043 z aneksem 2026-09-14,
powtórzone bramy na drzewie `main`. Wyniki:

1. **m12-124 (⚙ w setupie = oko)** — `EKRANY_SETUPU = EKRANY.slice(0, -1)`;
   `przelaczSetup()` ma cztery gałęzie w dobrej kolejności: gra → warstwa końca
   gry (ADR 0043 pkt 1), ekrany setupu → `przelaczPodgladMapy({ fokus:
   'przycisk-setup' })`, `gra` po zakończeniu → mapa startowa, reszta → setup.
   `STAN.ekran` nietknięty, więc pasek kroki i scroll zostają. `przelaczPodgladMapy`
   przyjmuje `{ fokus = 'przycisk-podejrzyj-mape' } = {}` — nasłuch
   `addEventListener('click', przelaczPodgladMapy)` podaje mu `MouseEvent`, który
   nie ma pola `fokus`, więc default działa (sprawdzone w kodzie, nie z pamięci);
   `$('przycisk-setup')` istnieje w `index.html`, a `$` rzuca przy braku id,
   więc brak literówki jest wymuszony startem aplikacji w testach.
2. **W3 (etykiety m12-120 przywrócone)** — dokładnie 6 linii komentarzy
   (`app/konfig.js` 3, `app/app.js` 3), ani jednego znaku kodu więcej; grep po
   `m12-123` w nośnikach żywych daje zero, więc fala, która była tylko podbiciem
   wersji, nie podpisała żadnej decyzji.
3. **Podbicie wersji** — jedna wersja w 43 miejscach `?v=` w 13 plikach +
   `WERSJA_SW`; reguła L29 (`git add index.html app/ sw.js`) zastosowana
   poprawnie, w przeciwieństwie do pierwszej próby tej sesji w PR #29 (45a87d5).
4. **Pozostałe 11 modułów `app/*.js`** — `git diff` pokazuje wyłącznie linie
   z `?v=` (polityka liczenia: 0 linii innych niż `?v=` w każdym z plików).
5. **Testy i piny** — F3 przepisany na nową formę zamiast skasowany (L55), nowy
   test uwagi A na ekranie pozycji, w kontrakcie ADR 0043: nowa gałąź wymagana,
   stary tor `setup → mapa startowa` zakazany, reguła `czyGraToczySie()` nietknięta.
6. **Dwie sprawy, które nie są defektami, a mogą być mylnie wzięte za defekt:**
   (a) `aria-pressed` ikony ⚙ **nie gaśnie**, gdy ⚙ chowa warstwę — ikona świeci
   na całej ścieżce przygotowania (uwaga I, ADR 0043) i tak jest to asercją F3;
   (b) aneks mówi „ekrany setupu (kroki 1–5)", a `EKRANY_SETUPU` obejmuje też
   lobby `multi` — wyliczenie nazw w tym samym zdaniu jest pełne, więc to
   nieścisłość etykiety, nie zachowania.

**Werdykt: bez defektów w treści PR #29.** Jedna usterka w modelu stanu, który
ta zmiana poszerzyła — oznaczona **D1**, naprawiona w tej sesji.

## Usterka D1 — podgląd mapy przeżywał zmianę ekranu (m12-125, commit `cee2792`)

**Zgłoszenie:** nie z terenu; z audytu toru, który otworzyła uwaga A.
**Objaw:** (1) gość, który w lobby zajrzał na mapę (⚙ chowa warstwę jak oko),
wchodził w grę NIEWIDOCZNĄ — start gry wieloosobowej przychodzi do niego
z pollingu (`onStanGryMulti` → `uruchomGreMulti` → `pokazEkran('gra')`), a panel
gry rodził się z `visibility: hidden` i `inert`; ⚙ w trakcie gry otwiera warstwę
końca gry, więc jedynym powrotem było oko w stopce. (2) Przy włączonym podglądzie
„dane i prywatność" ze stopki otwierało kartę, której nie było widać.
**Przyczyna:** `STAN.podgladMapy` gasiły tylko otwieracze warstw (wzorzec L61:
`przelaczInformacje`, `przelaczRankingi`, `otworzKoniecGry`), a funkcje zmiany
ekranu nie — bo ich autor zakładał, że do zmiany ekranu dochodzi kliknięciem
w panelu, którego w podglądzie nie da się nacisnąć. Założenie pęka, gdy ekran
zmienia kod bez udziału palca.
**Naprawa u przyczyny:** `STAN.podgladMapy = false` w każdej z trzech funkcji
zmiany ekranu (`pokazEkran`, `pokazMapeStartowa`, `pokazPrywatnosc`); bez
wyjątków na `gra`, bez `try`/`catch`. `STAN.ekran` w `pokazPrywatnosc` zostaje
nietknięty, bo nim wracamy.
**Testy:** `test/aplikacja.test.js` (karta ze stopki: `inert: false`, klasa
zgaszona) i pełna ścieżka multi w `test/wieloosobowa-ui.test.js` (lobby +
podgląd + start z pollingu ⇒ `#ekran-gra` nieinercyjny, oko mówi „Podejrzyj
mapę", `gra-postep` = „stacja 1 z 3"); zęby sprawdzone stashem naprawy —
bez fixu testmulti pada na `true !== false`. Pin 3b w kontrakcie ADR 0043
żąda `STAN.podgladMapy = false` w ciele każdej z trzech funkcji (wycinki kodu
bez komentarzy, L17).
**Pomiar na żywo (L65: atrapa DOM nie liczy kaskady):** headless Chromium 153,
390×844, `?tryb=test`, obok pracującego podglądu Areny na `0.0.0.0:8000`; drzewo
`main` (`9aed8be`) wyłożone osobno na porcie 8100 przez `tools/serwer.mjs`.
PRZED: `visibility: hidden`, `inert: true`, `elementFromPoint` nie trafia w kartę
prywatności. PO (m12-125): `visible`, `inert: false`, palec trafia, klasa
`podglad-mapy` nieobecna. Sama uwaga A działa w przeglądarce bez zmian: ⚙ na
ekranie setupu chowa warstwę (`body.podglad-mapy`, `visibility: hidden` warstwy).
**Dokumentacja:** niezmiennik wpisany do ADR 0043 jako dopisek 2026-09-15 przy
aneksie 2026-09-14 (bez zmiany treści decyzji), przypadek i reguła jako
`docs/LESSONS.md` L72 (+ pełny opis w archiwum).

## Budżet lektury i porządek w dokumentach

Rezerwa na wejściu (479 tok) nie pozwalała dopisać L72 ani dopisku ADR —
`skrócenie/rozdzielenie dokumentów` (AGENTS §0) zrobione w tej samej fali:
aneks 2026-09-13b (m12-111) ADR 0043 — treść w całości historyczna, lista zdań
wysłanych do korekty, a jego reguła operacyjna żyje w `LESSONS` L64 i w strażniku
dryfu — przeniesiony dosłownie do
`docs/decisions/archive/aneksy-0043-2026-09-13b.md` ze wskaźnikiem w ADR
(wzorzec L62/L66; nazwa bez przedrostka `NNNN-`, więc plik nie wchodzi w skan
archiwum ADR-ów ani w lekturę). Po dopisaniu L72 i dopisku: **99 690/100 000**
(rezerwa 310). Brama po sesji: **815/815** (było 813), `synchronizuj-szablon
--check` i audyt kontrastu bez naruszeń.

**Drobny dług tej sesji, do odnotowania (L7):** komunikat commitu `cee2792` ma
literę w pierwszym zdaniu („odąd" zamiast „odtąd" — litera zginęła w poprawce
robionej `sed`em już po `git commit -F`). Treść komunikatu jest zgodna z tym, co
w drzewie; commit jest wypchnięty, a ADR 0012 reg. 4 zabrania poprawiania
historii, więc zostaje jak jest, z tym zapisem.

## Sesja 2026-09-15b — uwagi A i B z terenu: przyciski czasu i plan pytań (gałąź `arena/01a0a39c-okolica`, PR #30, m12-126/m12-127)

**Zlecenie właściciela (dwie uwagi, 2026-09-15):** (A) „w setupie — hot-seat i
multiplayer — pole »Czas gry« zamień na przyciski wyboru: 30, 60, 90, 120 minut;
stukasz jeden, poprzedni odpuszcza”; (B) „w hot-seacie znika pytanie o liczbę
pytań na stację — przy każdej stacji odpowiada każdy gracz, więc pytań jest
liczba stacji × liczba osób grających”. Multi przy B bez zmian (jedno pytanie na
stację, wszyscy odpowiadają na to samo). Lektura startowa: continuity sesji
2026-09-15a (AGENTS §0 przeczytany w całości tamtej sesji, ADR-y punktowo),
brama na wejściu 815/815, PR #30 otwarty wcześniej (ADR 0012 reg. 1).

**Kolejność: B przed A**, bo B zmienia kształt setupu i legalność fixture'ów, a
A dokłada w to samo miejsce kontrolkę. Dwa osobne commity (§2 reg. 3):
`a2df21b` (B, m12-126), `15fc956` (A, m12-127).

**B — reguła, nie kosmetyka UI.** `pytaniaNaStacje` przestaje być wejściem:
`pytaniaNaStacjeDla({ liczbaGraczy, rodzajGry })` w `app/konfig.js` liczy plan
(hot-seat = liczba graczy z listy z sufitem 8, multi = 1), `domyslnaKonfiguracja`
i `oczyscKonfiguracje` nadpisują go po dopełnieniu listy imion, a K11 (widełki) i
K22 (równy podział) znikają razem z polem — nie ma kontrolki, którą dałoby się
popsuć podział, więc zostałby komunikat odsyłający do czegoś, czego nie ma (L64).
Dwa uboczne defekty wyszły przy okazji i są naprawione w tym samym commicie:
(1) `promienM` w `oczyscKonfiguracje` liczył się PRZED wyprowadzeniem planu
pytań, więc stary zapis z trzema graczami dostawał promień dla jednego pytania
(0,5 pytania na gracza mniej czasu na odpowiedzi) — liczy się PO planie;
(2) `synchronizujPytaniaZTrybem()` wisi na końcu `renderujListeGraczy()`, bo ta
funkcja jest jedynym miejscem, które zna realną liczbę graczy (start,
wznowienie, dodanie, usunięcie) — dawniej dwa osobne tory (`dodajGracza`,
`usunGracza`) rozjeżdżały się z listą.

**A — `CZASY_GRY = [30, 60, 90, 120]`.** Segment radia (`#lista-czasow` w
`#pole-czas`) zamiast `input[type=number]`: wzajemne wyłączanie i rozmiar
trafienia są w markupie, nie w kodzie (ADR 0011). Widełek NIE zacieśniam —
`OGRANICZENIA.czasGryMin` 10–480 i K19 zostają, bo zamknięty zbiór jest regułą
UI, nie walidatora; stary zapis z 240 min działa, tylko żaden przycisk nie jest
wciśnięty (auto-zaznaczenie pierwszego byłoby cichą zmianą planu gry). Segment
buduje się i podpina RAZ w strażniku `setupNasluchyPodpiete`, a `zaznaczCzasGry()`
odświeża wciśnięty przycisk przy każdym renderze (L14). `.segment-czas label`
dostał `flex: 1 1 20%` + `white-space: nowrap`, bo baza 30% liczy trzy tryby i
„120 min” zjeżdżało do drugiej linii.

**Fixture'y przepisane, nie obejśe (L55):** konfiguracja „3 graczy × 1 pytanie”
opisywała stan, którego nie da się już stworzyć. `graGotowaDoStartu({}, { graczy: N })`
daje N zapamiętanych graczy, czas z `CZASY_DLA_GRACZY` (85/90/95 min — wszystkie
dają promień 1000 m dla 3 stacji, czyli fixture paczki nie zmienia kształtu) i
paczkę `3 × N` pytań (`pytaniaDlaGraczy`: oryginalne `sNp1` plus warianty
„Wariant B:/C:” przy `sNp2…`, bo E-** odrzuca powtórzoną treść). Marsz po stacji
prowadzi teraz `odpowiedzNaStacje`/`zamknijStacje` — przycisk
`przycisk-nastepna-stacja` jest WIDOCZNY także między pytaniami tej samej
stacji („Następne pytanie →”), więc dotychczasowe „klikaj, aż przycisk się
pojawi” odpowiadało na jedno pytanie z trzech i zielona brama mijała się z
logiką gry. Test punktacji N reloaduje w środku stacji (faza `pytanie`, nie
`odcinek`), a pełne gry M6/R7 i M7/P7 liczą 3 pkt na gracza.

**Testy red→green:** `test/kontrakt.test.js` (nieobecność `#pole-pytania` i
`#setup-czas`, segment w `index.html`, `pole-czas` na liście chowania przy
„Dołączam”, `nowrap` w CSS), `test/konfig.test.js` (K11/K22 usunięte,
`pytaniaNaStacjeDla`, `CZASY_GRY` + fakt, że 240 min to nie błąd),
`test/aplikacja.test.js` (129 → 130 testów, w tym „stuknięcie zaznacza jedno i
odznacza poprzednie”), `test/wieloosobowa-ui.test.js` (uzasadnienie promienia
mówi „: N pytań ≈”), `test/dryf-dokumentow.test.js` (martwe frazy: „Pytania na
stację”, „pytań na stację (łączna”, „Planowany czas gry (min)”, „Wpisz planowany
czas”). **Brama: 818/818**, `npm run check` OK (oba szablony promptu znak w znak).

**Weryfikacja żywa (Chromium 390×844, `python3 -m http.server` + LD_LIBRARY_PATH
z `.narzedzia/libs/lib`):** `#pole-czas` 82 px, cztery chipy w jednym rzędzie na
tej samej współrzędnej (618), 44 px wysokości (= `--cel`), `scrollWidth 390 vs
390` (zero poziomego scrolla), na starcie wciśnięty dokładnie „60 min”; stuknięcie
w „90 min” → wciśnięty tylko 90 i `Promień gry: 800 m (z 90 min: 5 pytań ≈ 7,5
min, droga ≈ 33 min…)`; stuknięcie w „30 min” → odznaczyło 90. Dla B: po dodaniu
Ala/Ola/Beniamin uzasadnienie mówi `z 60 min: 15 pytań ≈ 22,5 min` (5 stacji ×
3 graczy) i promień spada 500 → 350 m, a `#setup-pytania` nie istnieje. Przy
„Dołączam” chowają się czas, tryb i liczba stacji; u hosta wybór zostaje
zachowany.

**Porządek po zmianach:** ADR 0027 aneks 2026-09-15 (reguła B), ADR 0025 aneks
2026-09-15 (reguła A), `WORKFLOW` §3 bez pola pytań i z czterema przyciskami,
legenda `{LICZBA_PYTAN}` w `PROTOKOL` wskazuje źródło liczby, komunikat E03 nie
obiecuje mnożnika wpisywanego przez gracza. Budżet lektury startowej po aneksach
pękał (100 138), więc do `docs/decisions/archive/` powędrowały: aneks ADR 0024
(2026-09-07, decyzje 6–8/B19 — reguły zostały w skrócie w ADR-ze) i dwa aneksy
ADR 0027 z 2026-09-11 (jeden w całości zastąpiony przez aneks 2026-09-13); oba
pliki macierzyste mają wskaźnik. **Budżet na wyjściu: 99 918/100 000 (rezerwa
82; liczy `node tools/budzet-lektury.mjs`).** LESSONS L66 dostało zdanie o asercji `start < end` przy cięciu przęsła +
`node --check` po każdej edycji skryptem (ta sesja dopuściła się 57 KB
duplikatu w `test/aplikacja.test.js`).

**Trzecia uwaga tej samej doby (ekran intro):** właściciel
poprawił zdanie na ekranie startowym na „Aplikacja wyznacza kilka stacji, a model
AI układa pytania związane z tym miejscem - jego historią, architekturą, przyrodą
czy ludźmi, którzy tu mieszkali”. Zmiana tylko w `index.html` (jedyny nośnik
zdania, żaden test ani dokument go nie cytuje), więc bez podbicia `?v=` i
`WERSJA_SW`: skorupa ciągnie `index.html` przez sieć (`sw.js` network-first dla
nawigacji), a `kontrakt` pilnuje, że `WERSJA_SW` = `?v=` aplikacji — podbicie
samego SW rozerwałoby tę równość. Myślnik przy wyliczeniu postawiony długi („—”),
bo taki jest typograficzny standard w aplikacji; poza tym treść 1:1.

**Flaka bramy złapana przy tej okazji:** `czekajNa` w `test/wieloosobowa-ui.test.js`
miało budżet 5 s i pod pełną bramą (818 testów równolegle) helpy wieloosobowe
raz spaliły zieloną wcześniej bramę czasem, nie logiką — w izolacji plik daje
23/23. Budżet poszedł na 15 s, bo timeout ma mierzyć postępy, nie wydajność
maszyny (asert czekający dłużej wciąż łapie realny brak).

**Wypchnięte:** gałąź `arena/01a0a39c-okolica` ma `52e2469..1812265` (commity
`a2df21b`, `15fc956`, `c2a29b9`, `e918cf4`, `1812265`), opis PR #30 zaktualizowany
`gh api -X PATCH`. Pierwsza próba pusha w tej sesji spaliła się na wygasłym
tokenie (`gh auth status`: „The github.com token in GH_TOKEN is no longer
valid") — po reconnectcie właściciela poszło bez `--force`.
**Nie ruszone (kolejka na teren):** decyzja o pinch-zoomie z ADR 0047 (czy
przywrócona karta nie zostawia „ściśniętej" strony i czy mapa nadal się
szczypie), uwaga A z PR #29 i D1 na iOS Safari.

## Sesja 2026-09-15c — uwagi A z terenu: panel Informacje i zdanie o czasie (m12-128)

**Zlecenie właściciela (PR #30, po grze w terenie):** „»protokół PYT/1.0« i
»szablon PYT/1.0.x« w Panelu Informacje uważam za bezużyteczne. Zostaw tylko
wersję, w jednej linii: „Wersja m12-12x - Dane i prywatność - Zgłoś błąd na
mapie - kontakt:…", ewentualnie łamanego, jeśli zabraknie miejsca. Usunąłbym
też taki tekst: „Czas zamknięcia przeglądarki nie wlicza się w odcinek." —
przecież czas nigdzie się nie wlicza??? Po co takie teksty. Poszukaj, czy w
innych miejscach nie ma takich pozostałości odnoszących się do czasu."

**Panel Informacje (m12-128).** Stopka panelu była gridem `.informacje-tresc`:
każdy span to osobny wiersz, więc gracz dostawał status, protokół, szablon,
wersję i prywatność — pięć linii, z których trzech nie umie na nic
przetłumaczyć. Został jeden wiersz (`.informacje-kontakt`, flex + `flex-wrap`)
z kolejnością dokładnie jak w poleceniu; `#status` zachował swój wiersz nad
nim. Prywatność zyskała wielką literę, bo etykieta = tytuł ekranu
(`#tytul-prywatnosc`). Kropki-dzielniki są teraz PIERWSZYM dzieckiem grupy
`.informacje-pozycja` — przy łamaniu wiersza (390 px: trzy linie) samotna
kropka na końcu linii wyglądała jak urwane zdanie; złapał to pomiar
headless Chromium, a nie atrapa DOM, więc asert o tym siedzi w `kontrakt`
(L13 po raz któryś z rzędu).

**Skoro z panelu zszedł numer protokołu, zniknął i jego trzeci nośnik.**
`test/kontrakt.test.js` pilnuje teraz parzystości `docs/PROTOKOL.md` ↔
`app/protokol.js` ↔ `README.md` (bez UI), a `SZABLON_WERSJA` i
`SZABLON_WERSJA_BEZ_WERYFIKACJI` muszą być cytowane w §7 PROTOKOLU — tam łatka
powstaje, echo w stopce było najsłabszym konsumentem z możliwych. `app.js` nie
importuje już `SZABLON_WERSJA`. Martwe frazy: `stopka-protokol`,
`stopka-szablon` (strażnik + DOKUMENTY + UI), więc zdokumentowana w ADR-ach
atrybucja „patrz stopka" nie wróci.

**Zdanie o czasie.** Audyt (`grep` po wszystkich tekstach trafiających do UI):
jedno zdanie, `status()` wznowienia gry (było: „… Czas zamknięcia przeglądarki
nie wlicza się w odcinek."). Zostało skreślone, a obok niego przeformułowane
trzy komentarze (`zegarGry`, `wznowGre`, docblock `zbierajStan`) i jeden
akapit ARCHITECTURY — wszystkie tłumaczyły „uczciwy pomiar" czegoś, co nie
punktuje (ADR 0023 pkt 1: punktacja nie ma składnika czasowego; znaczniki
`czasMs` żyją w dzienniku i tyle). Nic więcej czasowego w UI nie ma:
zostały plan (`Promień gry: … (z 60 min: …)`), `Zwiększ czas gry` w S12,
`za ~N s` przy odświeżaniu mostu i `pierwszy fix potrafi trwać kilkanaście
sekund` — wszystkie mówią, co gracz ma zrobić, a nie co mu się wlicza.
Asert ujemny w `aplikacja.test.js` + martwa fraza `nie wlicza się w odcinek`.

**Budżet lektury:** sam aneks do ADR 0042 przekroczył próg o 168 tokenów (rezerwa była 82),
więc do `docs/decisions/archive/aneksy-0036-2026-09-13-do-13b.md` pojechały
dwa historyczne aneksy ADR 0036 (m12-107 i m12-112 — oba przesądza żywy ADR 0043, a ich
regułę techniczną niosą LESSONS L13 i `kontrakt`). Zostało w ADR-ze wskazówka
trzech zdań. Finisz: 99 659/100 000, rezerwa 341.

**Brama:** 818/818, `npm run check` OK, audyt WCAG 0 naruszeń, `node
tools/budzet-lektury.mjs` OK. Live (Chromium 390×844, `?tryb=test`,
sprawdz-informacje.mjs): 12/12 — panel bez słów „protokół"/„szablon"/„PYT/",
`#stopka-wersja` = m12-128, cztery pozycje w kolejności z polecenia,
`scrollWidth == clientWidth`, brak przepełnienia na 390 px, klik z wiersza
otwiera prywatność i „Wróć" wraca do Informacji.

## Sesja 2026-09-15d — uwaga 3 z terenu: czytelne nazwy paczek na Drive (m12-129)

**Zlecenie właściciela:** „Chciałbym zmienić konwencję nazewnictwa paczek
z pytaniami na Drive. Zamiast nic nie mówiącego ciągu liter chciałbym kodować
w nazwie: miejsce startu (miejscowość, ulica), datę, ilość pytań, wiek, promień,
fact-check lub bez (może być Q albo bez). Dzięki temu będę w stanie kontrolować
i porządkować pliki na dysku (teraz jest to bardzo trudne)."

**Nazwa** (ADR 0048):
`Podkowa-Leśna_ul-Bukowa_2026-09-15_0941_15pyt_wiek-12_600m_Q.zestaw.json`.
Pola po `_`, w polu po `-`; diakietyki i wielkie litery zostają (właściciel tak
widzi je w OSM — odpowiadał na pytanie w ankiecie), a kropki, przecinki i znaki
zakazane przez Drive (`\ / : * ? " < > |`) są zamieniane na myślniki przez
`slug()` w moście. Nazwę buduje SKRYPT (`nazwaPaczkiZMeta`), nie aplikacja —
jedno źródło prawdy; UI tylko cytuje `wynik.nazwa` w potwierdzeniu wysyłki.

**Rozstrzygnięcia właściciela (pytałem o cztery rzeczy, trzy odpowiedział wprost):** kolejność
pól = jego wyliczenie (miejsce → data → reszta, bo to sortuje katalog po
miejscach, a w obrębie miejsca chronologicznie); stare pliki „pokasuję, jest ich
raptem ze 3 testowe", więc NIE ma funkcji porządkującej ani migracji; skrót
zawartości wypada z nazwy, bo „do daty dodaj godzinę, będzie zawsze unikalna".

**Godzina zamiast skrótu ma konsekwencję, którą trzeba było obsłużyć:** most
od lat rozpoznawał duplikat PO NAZWIE (w nazwie siedział `skrot`, więc nazwa =
treść). Teraz nazwa to opis, więc `przyjmijKandydata` porównuje
`kontener.skrot` leżącego już pliku: ten sam skrót → `juz-zaakceptowana` z `id`
(retry po zerwanej sieci jest idempotentny i łapki ADR 0028 mają co oceniać),
inny skrót → przyrostek `-2`…`-12`, bo cisza pod hasłem „już jest" oznaczałaby
skasowanie pracy organizatora; ten sam skrót w `odrzucone` → `juz-w-odrzuconych`
(ręczna decyzja właściciela wciąż obowiązuje).

**Ulica.** W `meta` nie było ulicy, a `stacje[].opis` bywa „ul. Bukowa, Podkowa
Leśna" — dodane addytywne pole `meta.ulica` liczone przez `ulicaZeStacji()`
w `app/zestawy.js` (odcina OGON miasta tylko gdy to samo miasto stoi w
`meta.miejsce`; obcego ogona, np. nazwy POI w innej gminie, nie tyka).
Walidator NIE wymaga pola (wzorzec `geohash6` z ADR 0024), więc wszystkie stare
paczki i wpisy z `localStorage` czytają się dalej, a most po prostu nie wstawia
segmentu z ulicą. Liczba pytań w nazwie to liczba PRAWDZIWISTA (`paczka.pytania`
z rozpakowanego kontenera), nie plan ze setupu — paczki niekompletne (S12) są
wtedy opisane uczciwie.

**Budżet lektury:** ADR 0048 plus wiersz rejestru dały +574 tok, próg 100 000
pękł. Skrócone: wiersz rejestru, pkt 4 (strażnicy) w ADR 0048, aneks dzisiejszy
w ADR 0042 i drugi akapit wskazówki archiwum w ADR 0019. Finisz: rezerwa 33
tok — sesja, która dopisze ADR, musi najpierw coś przenieść do archiwum.

**Brama:** 826/826 (dwa piny `/WYSŁANA na Drive/` przepisane na nową treść
komunikatu, nie obejść), `npm run check` OK, audyt WCAG 0 naruszeń, budżet OK.
Live-check odpuszczony: reset sandboxu zmiótł `/home/user/.narzedzia` (Chromium
i pomoce), a ta zmiana nie dotyka DOM-u ani CSS — to, co w pasku, weryfikuje
`test/zestawy-ui.test.js` z atrapą fetcha mostu (cytuje nazwę z mostu; most bez
`nazwa` nie dostaje w UI zdania o „nieznanym" pliku). Nazwy plików sprawdza
`test/most-indeks.test.js`, który WYKONUJE cały skrypt `.gs` na atrapie Drive
(L33): nazwa, retry, `-2`, odrzucona paczka, `meta` bez `ulica` i bez godziny,
znaki zakazane.


## 2026-09-15c — otwarcie sesji `arena/01a0a4ff-okolica` (PR w tym commicie)

**Zlecenie:** „Kontynuujemy projekt”. Kamienie M0–M12 zamknięte (L68); bez uwag
z terenu kolejka jest pusta.

**Audyt poprzedniego scalonego PR (#30, squash `fa8d9d8` na `9aed8be`).**
46 plików, +1844/−459. Zakres: D1 (podgląd mapy gaśnie przy zmianie ekranu,
m12-125), uwagi terenowe A/B (czas gry przyciskami, pytania liczone z trybu,
m12-126/m12-127), redakcja intro, ADR 0048 (nazwa pliku paczki), aneksy
ADR 0025/0027/0042/0043, most `.gs`.

Werdykt: **bez defektów w treści scalenia.** Sprawdzone:

- D1: `STAN.podgladMapy = false` w `pokazEkran`, `pokazMapeStartowa`,
  `pokazPrywatnosc` — zgodnie z niezmiennikiem ADR 0043 dopisek 2026-09-15
  i L72; nie w `renderujGre`.
- `pytaniaNaStacjeDla` wołane z `renderujListeGraczy` (jeden tor, nie tylko
  dodaj/usuń).
- Segment `CZASY_GRY` bez pola `#setup-czas`; stary zapis poza zbiorem nie
  auto-zaznacza (ADR 0025 aneks).
- Jedna wersja `?v=m12-129` w grafie (L29).
- ADR 0048: nazwa z `meta`, retry po `kontener.skrot`, pole `ulica` addytywne.

Nie są defektami: `aria-pressed` ⚙ przy schowanej warstwie (uwaga I / F3);
etykieta „kroki 1–5” obejmująca też lobby `multi`.

**Otwarte z handoffu 15a/15b:** rezerwa budżetu lektury jest cienka; uwagi
z terenu po m12-129. ADR 0047 nadal czeka na weryfikację na iPhonie.

## 2026-09-15d — otwarcie sesji `arena/01a0a569-okolica` (PR #32 w tym commicie)

**Zlecenie:** uwagi terenowe właściciela (3) przybliżanie HTML przy fokusu pola,
(4) czyszczenie pola po błędnej paczce, (5) ekran stacji bez spisu, a w trakcie
sesji doszła (6) — paczka wklejona z AI nie lądowała na Drive.

**Audyt poprzedniego scalonego PR (#31, squash `1c0e7d7` na `fa8d9d8`).**
21 plików, +219/−137. Zakres: ADR 0049 (`poprawna` czystym indeksem 0–3),
szablony `PYT/1.0.10` / `PYT/1.0-nofc.5`, jeden komunikat odrzucenia paczki AI
(m12-130), cache-bust m12-132.

Werdykt: **treść PR #31 bez defektów.** Sprawdzone:

- `WARIANTY_Z_KODEM` zawężone do rev2/rev3, `WARIANTY_BIEZACE` = rev4/rev5,
  a `sprawdzOdpowiedz` wybiera dekoder po markerze (`odkodujPaczkeBiezaca`);
  szablon §2 niesie `"poprawna": 2` i wymaganie „numer poprawnej odpowiedzi".
- `npm run check`: oba bloki szablonu zgodne z `app/protokol.js`
  (3894 / 4142 znaków); jedna wersja `?v=m12-132` w 43 miejscach grafu (L29).
- Odrzucenie paczki idzie jedną funkcją `pokazOdrzuconaPaczkeAi()`: stały tekst,
  pusta lista usterek, `przycisk-poprawka` schowany, pole wklejenia czyszczone.

**Ale audyt sięgnął głębiej i znalazł usterkę, którą przepuściły dwa poprzednie
przeglądy (PR #30 i #31).** `przyjmijKandydata` w moście Drive po zmianie nazwy
pliku (ADR 0048, PR #30) wołał `getFilesByName(nazwa).next()` BEZ `hasNext()`.
W Apps Script `next()` na pustej kolekcji **rzuca wyjątek** (dokumentacja Drive),
a nie oddaje `null` — więc dla każdej NOWEJ nazwy (czyli zwykłego przypadku)
`doPost` łapał wyjątek i odpowiadał `{ ok:false, blad }`: paczka nie powstawała
na Drive (zgłoszenie właściciela 2026-09-15, usterka D2). Atrapa w
`test/helpers/most.js` zwracała `undefined` zamiast rzucać, więc 826 testów było
zielonych. Naprawa i lekcja: L73; aneks ADR 0048.

## Sesja 2026-09-15d (PR #32) — paczka AI nie lądowała na Drive (D2), fokus pola na iOS, puste pole po błędzie, ekran stacji bez spisu (m12-133/m12-134)

Gałąź `arena/01a0a569-okolica`. Cztery uwagi terenowe właściciela z 2026-09-15;
pierwsza z nich krytyczna. (Uwaga: inny wątek pracy tego samego dnia nosi
nagłówek „Sesja 2026-09-15d — czytelne nazwy paczek na Drive (m12-129)" — ten
wpis dotyczy PR #32.)

**D2 — paczka AI nie lądowała na Drive (commit `24a46a7`).** Właściciel: nowa
gra, wygenerowane pytania, wejście w grę — a w katalogu zaakceptowanych na Drive
brak nowego pliku. Przyczyna w moście: `przyjmijKandydata` szukał pliku przez
`getFilesByName(nazwa).next()` bez `hasNext()`, a Apps Script na pustej
kolekcji **rzuca** (`FileIterator.next()` — „Throws an exception if no items
remain"), więc każda NOWA nazwa kończyła się wyjątkiem w `doPost` i odpowiedzią
`{ ok:false, blad }`. Aplikacja mówiła wtedy „Paczka przyjęta, ale Drive
odrzucił wysyłkę" i grała dalej — stąd wrażenie, że Drive odrzuca paczki.
Wprowadził to PR #30 (ADR 0048); PR #31 mostu nie dotykał. Naprawa:
`pierwszyPlikNazwa(katalog, nazwa)` = `hasNext() ? next() : null`. Most wymaga
ponownego wdrożenia na Apps Script.

**Dlaczego brama tego nie złapała (L73).** Atrapa Drive w `test/helpers/most.js`
oddawała `undefined` zamiast rzucać — kontrakt platformy był w testach
łagodniejszy niż w rzeczywistości. Atrapa rzuca teraz tak jak Drive, a
`iteratorAtrapyDrive` jest eksportowany, żeby test mógł to przypiąć. Zęby:
z ciałem PR #30 przywróconym na próbę 10 z 18 testów w `most-indeks` czerwonych.
To jest też korekta audytu z poprzedniej sesji („2026-09-15c": most bez
defektów) — przegląd diff-a, który nie konfrontuje wywołań obcego API z jego
udokumentowaną semantyką, przepuszcza całą tę klasę usterek.

**(4) Puste pole po błędnej paczce (commit `80112f3`).** Przeglądarka wstawia
tekst PO powrocie z nasłuchu `paste`, więc czyszczenie pola w
`pokazOdrzuconaPaczkeAi()` było natychmiast nadpisywane złą wklejką. Nasłuch
woł `e.preventDefault()` i wstawia treść sam. Atrapa `wklej()` odtwarza
kolejność przeglądarki (nasłuchy, potem domyślna akcja, chyba że zablokowana) —
bez `preventDefault` 5 testów czerwonych.

**(3) Brak przybliżenia HTML na fokusu (commity `80112f3`, `21be8ec`).** iOS
Safari przybliża stronę, gdy pole z fokusem ma mniej niż 16 px, a
`.pole-tekstowe` miało 14 px; oddalić się nie dało, bo pinch poza mapą jest
zablokowany celowo (ADR 0047), a pinch na mapie rusza kafelkami. Właściciel
miał rację, wskazując na fokus, nie na gest. Teraz 16 px, a kontrakt CSS
pilnuje, żeby żadna reguła dotykająca `input`/`textarea`/`select`/
`.pole-tekstowe` nie schodziła poniżej 16 px.

**(5) Ekran stacji bez spisu (commit `47ff461`).** `#lista-stacji` zniknął
z HTML, CSS i `renderujStacje()`; jest jedno zdanie w `#stacje-podsumowanie`:
„Wygenerowano i zlokalizowano N stacji." przy sieci dróg, „Wygenerowano N
stacji." przy pierścieniu (bez „zlokalizowano" — L6; powód mówi niezmienione
`#stacje-tryb`). Tryb tajnej trasy (ADR 0034) przy swoim zdaniu — właściciel
wyłączył go z tej zmiany. Testy przepisane na nową formę (L55), test
wstrzyknięcia nazwy z OSM zaostrzony (wrogi tekst nie ma gdzie wejść), martwa
fraza `lista-stacji` w `dryf-dokumentow`, README poprawiony.

**Budżet lektury (commit `63b69d3`).** Start: 100 189 tok (przekroczenie), po
wpisach sesji 101 275. Do archiwum wyszły aneksy ADR 0019 (2026-09-13c), ADR
0024 (oba z 2026-09-07) i ADR 0005 (m12-120 — reguła zostaje w L71). Stan po
tym kroku: 99 411 / 100 000; po wszystkich wpisach sesji (aneksy ADR, L73,
B23) — 99 692 / 100 000, rezerwa 308.

**Weryfikacja.** Na tym etapie `npm test` 829/829; po usunięciu martwego
przycisku (niżej) `npm run brama` **827/827** i budżet 99 692/100 000. Stan
KOŃCOWY sesji — po usunięciu listy usterek B23, które było ostatnim krokiem —
to **827/827** i budżet **99 817/100 000** (rezerwa 183), m12-136; szczegóły
w ostatnim akapicie tego wpisu. `npm run check` (oba szablony), audyt WCAG
0 naruszeń,
`npm run zasieg-mostu` 883/903 (97,8%). Headless Chromium (360×740 i 1334×750,
`?tryb=test`, pozycja z mapy): ekran stacji bez `#lista-stacji`, zdanie
„Wygenerowano 5 stacji.", 5 pinezek, brak poziomego przewijania, 0 błędów
konsoli, pola tekstowe 16 px; wklejenie śmiecia w pole paczki daje
`defaultPrevented=true` i puste pole.

**Znalezisko audytowe → decyzja właściciela (commit `8048302`).**
`przycisk-poprawka` był chowany w obu ścieżkach błędu i nigdy nie pokazywany.
Właściciel: „skoro przycisk nigdy nie jest używany to usuń go". Usunięte:
element w `index.html`, nasłuch i chowanie w `app/app.js`,
`STAN.poprawkaFactcheck` (czytany tylko przez ten nasłuch) i
`poprawkaDlaModelu` w `app/protokol.js` (jedynym wywołującym był przycisk);
komunikaty E02 nie obiecują już „poprawki gotowej do skopiowania".
`STAN.usterkiPaczki` zostaje — brama wysyłki czyta jej długość. Nośniki
przepisane (README, WORKFLOW §5, ARCHITECTURE §7, PROTOKOL §6), pin kontraktu
odwrócony, trzy martwe frazy w `dryf-dokumentow`, ADR 0006 aneks. Brama po
zmianie: 827/827 (dwa testy funkcji odeszły razem z nią), m12-135.

**Most wdrożony.** Właściciel potwierdził wdrożenie naprawionego skryptu na
Apps Script — zapis paczek do katalogu zaakceptowanych działa znowu. Z sandboxa
nie da się tego sprawdzić (egress zablokowany, LESSONS L3), więc potwierdzeniem
jest komunikat właściciela i testy atrapy Drive.

**Pusta lista usterek usunięta (BACKLOG B23, commit `308f550`).** Przy
usuwaniu przycisku poprawki wyszło na jaw, że `#wynik-usterki` jest nośnikiem
bez zawartości: `renderujUsterki()` miała dwa wywołania i oba z pustą tablicą,
a lista była czyszczona także na starcie walidacji, więc `<ul>` nie miał dzieci
nigdy. Właściciel: „tak, usuń" — wariant (a) z B23. Zniknęły `<ul>`
z `index.html`, `renderujUsterki` i `listaUsterek` z `app/app.js`, reguły
`.usterki` z `app/styles.css`; karta `#wynik-walidacji` z nagłówkiem
i `data-stan='blad'` została, bo to ona niesie komunikat.

Pin przepisany na sprawdzanie HTML zamiast stuba: atrapa DOM tworzy brakujący
element na żądanie, więc `children.length === 0` przeszłoby także po powrocie
listy. Wskazówka debugowania w LESSONS L54 kieruje teraz do `walidujPaczke()`,
nie do DOM; dwie martwe frazy w `dryf-dokumentow`, dwa aneksy ADR 0006 z tego
samego dnia scalone w jeden (ta sama decyzja). Brama: 827/827, budżet
99 817/100 000 (rezerwa 183 — pierwszy większy aneks w następnej sesji
przekroczy próg), m12-136. Headless Chromium 360 px i 1334×750: listy
i przycisku nie ma, karta w stanie `blad` z samym nagłówkiem, 0 błędów konsoli.

## Sesja 2026-09-15e (PR #33) — uwagi terenowe A/B, jawna paczka bez ukrywania, prompt i pytanie po doprecyzowaniu (m12-137…m12-140)

**Zlecenie właściciela:** trzy uwagi z gry w terenie (2026-09-15) — (A) pasek
pytania „Stacja 1 zdobyta · pytanie 1 z 1 · odpowiada Jacek" do skrócenia,
(B) KRYTYCZNA: poprawna odpowiedź oceniana źle, bo aplikacja liczyła indeks od
zera, a model i człowiek liczą od 1, (D) koniec ukrywania paczek: „to jest gra
dla mnie i mojej rodziny, więc żadne zabezpieczenia nie są potrzebne".
Właściciel upoważnił do zmiany całego protokołu („na dysku nie ma żadnych
paczek") i wskazał, że marker `protokol` w odpowiedzi modelu jest czystym
obciążeniem AI.

**Audyt PR #32:** bez usterek — jedna kosmetyczna poprawka wcięcia komentarza
(`app/trwalosc.js`).

**Commit 1 (m12-137, „Numer odpowiedzi 1–4, jedna postać paczki, koniec
markerów protokołu"):** pasek pytania mówi „Stacja 1 - Jacek", a licznik wraca
tylko przy stacjach z więcej niż jednym pytaniem; `poprawna` to numer `1..4`
w schemacie, szablonach i walidatorze (E06), a aplikacja przelicza raz, na
granicy UI; zniknęły znaczniki `PYT/1.0-revN`, odwracanie tekstu i kod
pozycyjny — protokół to **PYT/1.1** (szablony `PYT/1.1.0` / `PYT/1.1-nofc.0`),
a profil źródeł stempluje aplikacja (`paczka.factcheck`, `meta.factcheck`).
Testy przebazowane na konwencję modelu (fixture'y pisane jak w JSON-ie od AI),
`npm test` 813/813, pakiet lektury 99 858/100 000.

**Commit 2 (m12-138, „Jawna paczka"):** `app/kodowanie.js` usunięty (XOR
+ base64url, kontener `TO-paczka/2`), a paczka jedzie jawnym JSON-em przez
pamięć, `localStorage`, snapshot gry (`stan-gry/2`), zestaw publiczny
(`TO-zestaw/2`), wpis lokalny (`TO-zestaw-lokalny/2`) i plik na Drive.
Tożsamość wpisu i pliku liczy `skrotPaczki()` (FNV-1a 32 z treści paczki),
most Drive waliduje jawną paczkę i liczy ten sam odcisk bez dekodera, a kody
T05/Z04/R08 mówią o braku pytań. Usunięty `test/kodowanie.test.js`; testy
przebazowane (803/803), `data/przyklady/zestaw-podkowa-lesna.json` rozkodowany
do jawnej postaci i przepisany na numerację `1..4`.

**Commit 3 (dokumentacja i decyzja):** ADR **0050** (paczka jawna, numer
`1..4`, jedna postać paczki, odcisk treści zamiast kontenera, bez migratora);
ADR 0007, 0033 i 0049 → `docs/decisions/archive/` (statusy Wycofana), aneks do
ADR 0032 (marker `rev3` zniesiony, reszta obowiązuje); LESSONS **L74** (format
wymiany licz tak, jak widzi AI i człowiek — fixture'y w konwencji modelu)
i **L75** (zabezpieczenie bez realnej ścieżki wycieku jest kosztem); README,
AGENTS, ASSETS, WORKFLOW, ARCHITECTURE i karta prywatności mówią „paczka
jawna, nie zaszyfrowana"; strażnik kontraktu pilnuje, że README/AGENTS/
ARCHITECTURE nie obiecują obfuskacji.

**Commit 3 — doprecyzowania właściciela (prompt i ekran pytania):** prompt
mówi teraz wyłącznie, CO model ma robić. Zniknęły zdania o protokołach
(prompt nie wspomina ani markera, ani indeksu), a pole `poprawna` opisuje
jedna linia: „numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na
liście \"odpowiedzi\")" — właściciel doprecyzował po pushu, że to dobre,
pozytywne dopowiedzenie (chroni przed 0…3). Zdania-zakazy („Nie opieraj się na
pamięci modelu", „Nie wymyślaj nazw, dat…", „Bez komentarzy, bez wstępu…")
przepisane na polecenia dodatnie, w §2 i §2.2 — zaktualizowane strażniki
`test/protokol.test.js` (m.in. zakaz słowa „indeks" i dokładna linia
`"poprawna": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście "odpowiedzi").`). Na ekranie pytania zwijana sekcja
nazywa się „Rozwiń pytanie", a w fazie odpowiedzi summary jest schowane
(`display: none`), więc treść pytania i warianty podnoszą się o cały wiersz;
po werdykcie sekcja zjeżdża pod tę etykietę. Pilnuje tego kontrakt
(etykieta + reguła CSS) i test w `test/aplikacja.test.js` (details otwarty
w pytaniu, zwinięty po odpowiedzi).

**Brama na koniec:** `npm test` **803/803**, `npm run check` OK (szablon §2 —
3 743 znaki, §2.2 — 3 878), `npm run budzet` **98 853 / 100 000**
(rezerwa 1 147 — odzyskana archiwizacją trzech wycofanych ADR-ów: 0007, 0033,
0049, oraz skróceniem szablonu promptu), m12-140.

**Otwarte po sesji:** właściciel wgrywa ponownie most Drive (`.gs` zmieniony:
`paczka` zamiast `kontener`, `skrotPaczki`), weryfikuje na iPhonie pasek A,
ocenę odpowiedzi i czytelność pliku paczki na Drive; ADR 0047 (blokada
szczypania poza mapą) nadal czeka na potwierdzenie.

## Sesja 2026-09-15f (PR #34) — audyt PR #33: jedno przeliczenie werdyktu, parity odcisku paczki (m12-141)

**Zlecenie właściciela:** „kontynuujemy projekt". Uwag z terenu nie było, więc
sesja domknęła audyt PR #33 (AGENTS.md §2 pkt 2: przegląd poprzedniego PR-a
przed nową pracą) i poprawiła to, co audyt znalazł. Nowych funkcji nie ma.

**Audyt PR #33 (f086fd3, 54 pliki, +1253/−1436):**

- **Spójne:** `poprawna` = numer `1..4` wszędzie (`app/`, `index.html`, `sw.js`,
  most `.gs`, `data/przyklady/zestaw-podkowa-lesna.json` — 6/6 pytań w konwencji
  modelu); schematy `TO-zestaw/2`, `TO-zestaw-lokalny/2`, `stan-gry/2`;
  cache-bust jednolity (`m12-140`); kontener `TO-paczka/2` i `app/kodowanie.js`
  wycięte także z mostu — `skrotPaczki`, `walidujKandydata`, `zalozGre`,
  `budujIndeks` i `skrotIstniejacegoPliku` pracują na jawnej paczce; atrapa
  `Utilities.newBlob(...).getBytes()` w `test/helpers/most.js` oddaje bajty
  UTF-8 tak samo jak `TextEncoder` w aplikacji, więc odcisk liczony w teście
  jest odciskiem z terenu.
- **Usterka 1 (poprawiona, commit 1):** przeliczenie z ADR 0050 pkt 3
  (`wybrana + 1 === pytanie.poprawna`) istniało w kodzie DWUKROTNIE —
  w silniku (`zapiszOdpowiedz`, `app/rozgrywka.js`) i w UI
  (`odpowiedzNaPytanie`, `app/app.js`), a dokumentacja sesji 2026-09-15e
  obiecywała „aplikacja przelicza raz, na granicy UI". Dwie kopie tej samej
  reguły to wzorzec z LESSONS L74: przy rozjeździe ekran mówi „Dobrze!",
  dziennik liczy 0 pkt, a most w multi dostaje trzecią wersję prawdy.
- **Usterka 2 (poprawiona, commit 2):** odcisk treści paczki ma dwie
  implementacje (aplikacja i most) i ŻADNEGO testu, który je porównuje —
  ADR 0050 pkt 2 mówi „obie strony liczą ten sam skrót", a LESSONS L33 wymaga,
  żeby lustro mostu miało test WYKONUJĄCY. Literówka albo „poprawka" po jednej
  stronie rozdzieliłaby paczkę na dwie tożsamości cicho.
- **Obserwacja (bez zmian w kodzie → BACKLOG B24):** profil źródeł
  (`paczka.factcheck`) jest stemplowany ze stanu ptaszka `#prompt-factcheck`,
  nie z treści paczki; przy powrocie do aplikacji przez ⚙ START GRY ptaszek jest
  kasowany (uwaga G.a, 2026-09-12), więc paczka ze źródłami może zostać
  oznaczona jako niezweryfikowana (znaczek i nazwa pliku na Drive kłamią).
  Rozstrzygnięcie wymaga decyzji właściciela (ADR 0032 / ADR 0050 pkt 5).
- **Kosmetyka (poprawiona, commit 2):** na końcu `test/most-paczka.test.js`
  został wiszący komentarz JSDoc po funkcji przeniesionej do
  `test/helpers/most.js` — martwy nośnik (LESSONS L31/L55).

**Commit 1 (m12-141, „Werdykt odpowiedzi liczy tylko silnik"):**
`odpowiedzNaPytanie` bierze werdykt z wpisu dziennika (`wpis.poprawna`) zamiast
przeliczać numer odpowiedzi drugi raz; ocena na ekranie, punkt w dzienniku i
zdarzenie `odpowiedz` wysyłane na most mają odtąd jedno źródło. Pokazywanie
litery i tekstu poprawnej odpowiedzi (`'ABCD'[pytanie.poprawna - 1]`) zostaje —
to rendering, nie werdykt. Aneks 2026-09-15f do ADR 0050 zapisuje, gdzie żyje
przeliczenie; strażnik w `test/kontrakt.test.js` pilnuje, że porównanie istnieje
wyłącznie w `app/rozgrywka.js`. Cache-bust podbity we wszystkich miejscach naraz
(`index.html`, 12 modułów `app/*.js`, `sw.js`).

**Commit 2 (test parity odcisku):** `test/most-paczka.test.js` wykonuje
`skrotPaczki` z tekstu `.gs` na atrapie Drive i porównuje z `app/zestawy.js` —
najpierw na tej samej paczce (polskie znaki: `Podkowa Leśna`, `Źródło`, czyli
także zgodność UTF-8), potem na skrócie, który naprawdę dojeżdża do aplikacji
we wpisie indeksu publicznego.

**Commit 3 (dokumentacja):** ten wpis, `docs/BACKLOG.md` B24 (profil źródeł
z ptaszka vs z treści), `docs/setup/HANDOFF_2026-09-15f.md`, aneks do ADR 0050.

**Brama na koniec:** `npm test` **805/805**, `npm run check` OK (szablon §2 —
3 743 znaki, §2.2 — 3 878), audyt WCAG **0 naruszeń**, zasięg mostu **97,7%**
(850/870 wierszy), `npm run budzet` **99 011 / 100 000** (rezerwa 989), m12-141.

**Otwarte po sesji:** właściciel wgrywa ponownie most Drive (`.gs` zmieniony
w PR #33 — bez tego jawne paczki nie przejdą), potwierdza ADR 0047 (blokada
szczypania poza mapą na iPhonie), weryfikuje w terenie ocenę odpowiedzi `1..4`
i rozstrzyga BACKLOG B24.

**Odpowiedzi właściciela (2026-09-15f, po audycie):** (1) **most Drive wgrany** —
zaległość z PR #33 zamknięta; (2) **ADR 0047 działa** — blokada szczypania poza
mapą potwierdzona na iPhonie; (3) ocena odpowiedzi `1..4`, pasek „Stacja 1 -
Jacek" i czytelny plik paczki na Drive — „wygląda ok"; (4) **B24 rozstrzygnięte:
wariant (a), bez zmian w kodzie** — domyślnie bez ptaszka, a wtedy fact-check
jest niewymuszony („model może sobie sprawdzić ale nie musi"). Stempel
`paczka.factcheck` mówi o PROFILU (czy aplikacja źródeł ZAŻĄDAŁA), nie o tym, co
model dopisał z własnej woli; szablon §2.2 już to mówi modelowi („Sposób ich
ustalenia zostawiamy Tobie", pole `zrodla` OPCJONALNE).

**Uwaga A (prompt dla AI) — commit 4 (m12-142, szablony `PYT/1.1.1` /
`PYT/1.1-nofc.1`):** trzy zdania podyktowane przez właściciela, zastosowane
w OBU szablonach (§2 i §2.2 są lustrem; w §2.2 odpowiednikiem „potwierdzony
fakt" jest „pewny fakt"):

1. Zasada 4: „Schodź na najniższy poziom, na którym masz sensowny potwierdzony
   fakt, **i podawaj wtedy nazwę miejsca w treści pytania**." → bez wyróżnionego
   ogona. O kotwicy mówi pierwsza część zdania, a o braku lokalnego zaczepienia
   zdanie następne — przepis o nazwie miejsca był trzecim głosem w tej sprawie.
2. Zasada 7: „Formułuj treść pytania tak, żeby odpowiedź pozostawała do wyboru —
   fakty rozstrzygające (na przykład rok) umieść dopiero w polu `wyjasnienie`."
   → „Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu."
3. Wymaganie dla pola `stacja`: „KAŻDA stacja ma co najmniej jedno pytanie,
   a rozkład pytań między stacje jest równy albo różni się o jedno." → „KAŻDA
   stacja ma co najmniej jedno pytanie, wszystkie stacje mają tą samą liczbę
   pytań." (forma właściciela dosłownie — patrz „Otwarte").

Schemat paczki się nie zmienił, więc wersja protokołu zostaje **PYT/1.1** —
podbite są łatki szablonów (PROTOKOL §7 pkt 3), z wpisem w §7. Stałe w
`app/protokol.js` przepisane narzędziem (`npm run build`): dokument jest jedynym
źródłem prawdy. Szablony schudły po 140 znaków (§2: **3603**, §2.2: **3738**).

**Rozjazd prompt ↔ walidator (commit 4, BACKLOG B25, bez zmian w kodzie):**
zmiana 3 żąda równej liczby pytań na każdej stacji, a `E05` odrzuca paczkę
dopiero przy rozkładzie różnym o WIĘCEJ niż jedno (`E03` pilnuje tylko sumy
`liczbaStacji × pytaniaNaStacje`). Paczka 3 stacje × 2 graczy rozdzielona 3/2/1
przechodzi więc bez słowa, choć prompt ją wyklucza — a w grze oznacza to, że na
jednej stacji gracz odpowiada dwa razy, na innej wcale (ADR 0027 aneks:
`pytaniaNaStacje` = liczba graczy właśnie po to, żeby każdy miał swoje pytanie).
Zaostrzenie `E05` to odrzucanie paczek w terenie, a ręcznej edycji paczki nie ma
(ADR 0006 aneks 2026-09-07) — decyzja właściciela, warianty a/b/c w B25.

**Commit 5 (piny i dokumentacja):** test w `test/protokol.test.js` pilnuje nowych
zdań DOSŁOWNIE w obu szablonach i tego, że stare brzmienie nie wróci przy
kolejnej synchronizacji z dokumentem; B24 zamknięty decyzją właściciela, B25
dopisany; ten wpis i aktualizacja `docs/setup/HANDOFF_2026-09-15f.md`.

**Brama po commitach 1–5:** `npm test` **806/806**, `npm run check` OK (szablon
§2 — 3603 znaki, §2.2 — 3738), audyt WCAG **0 naruszeń**, zasięg mostu **97,7%**
(850/870 wierszy), `npm run budzet` **99 122 / 100 000** (rezerwa 878), m12-142.

**Decyzje właściciela po pushu (commit 6 — kod, commit 7 — dokumentacja):**

- **B25: `E05` bez tolerancji ±1.** Właściciel: „nie ma możliwości rozkładu +-1
  bo nie ma już w setupie pola z ilością pytań - w hotseat ilość pytań to ilość
  stacji * ilość graczy, w multi ilość pytań to ilość stacji. Możesz wywalić to
  z E05 bo to nie występuje w przyrodzie". Żaden z wariantów a/b/c z BACKLOG-u:
  gałąź `max − min > 1` usunięta z `app/protokol.js`, więc `E05` pilnuje już
  tylko stacji bez żadnego pytania. Kod potwierdza uzasadnienie właściciela:
  `pytaniaNaStacjeDla()` zwraca liczbę graczy w hot-seat i **1** przy
  `rodzajGry === 'multi'`, a sumę `liczbaStacji × pytaniaNaStacje` pilnuje `E03`
  — organizator nie ma pola, którym mógłby wymusić nierówny podział (tak samo
  jak przy wycofanym `K22`). Zaktualizowane: opis `E05` w PROTOKOL §6, zdanie
  w §7, testy — na każdą pustą stację JEDNA usterka plus nowy test, że nierówna
  paczka BEZ pustej stacji (3 stacje, pytania 3/1/1, suma zgodna z setupem)
  przechodzi bez usterek.
- **Forma zdania dla pola `stacja`:** podyktowane „tą samą" → normatywne **„tę
  samą liczbę pytań"** w obu szablonach; łatki **`PYT/1.1.2` /
  `PYT/1.1-nofc.2`**, wpis w §7, pin w `test/protokol.test.js` zaktualizowany,
  stałe przepisane `npm run build`. Cache-bust m12-143.

**Brama na koniec sesji:** `npm test` **807/807**, `npm run check` OK (szablon
§2 — 3603 znaki, §2.2 — 3738), audyt WCAG **0 naruszeń**, zasięg mostu **97,7%**
(850/870 wierszy), `npm run budzet` **99 206 / 100 000** (rezerwa 794), m12-143,
szablony `PYT/1.1.2` / `PYT/1.1-nofc.2`.

**Otwarte po sesji:** kolejka pusta — zaległości z PR #33 zamknięte (most Drive
wgrany, ADR 0047 działa, weryfikacja terenowa „wygląda ok"), B24 i B25
rozstrzygnięte decyzjami właściciela. Do sprawdzenia w terenie: paczka
z promptu `PYT/1.1.2` — czy pytania nie zawierają odpowiedzi, czy model trzyma
równą liczbę pytań na stację i czy kotwiczenie bez przepisu o nazwie miejsca
dalej daje pytania zakotwiczone.
## Sesja 2026-09-15g (PR #35) — otwarcie sesji, audyt PR #34: dryf dokumentacji „rozkład równy ±1"

**Zlecenie:** „Kontynuujemy projekt". Uwag z terenu nie było, więc sesja domyka
audyt poprzedniego scalonego PR-a (AGENTS.md §2 pkt 2) i poprawia to, co audyt
znalazł. Kamienie M0–M12 zamknięte jako zakres kodu (L68).

**Audyt PR #34 (squash `c1a90e8` na `f086fd3`):** 22 pliki, +515/−62.

**Spójne — nie ruszane:**

- `E05` bez tolerancji ±1 (`app/protokol.js`): walidator pilnuje już tylko stacji
  bez żadnego pytania; `pytaniaNaStacjeDla()` = liczba graczy (hot-seat) / 1
  (multi), sumę `liczbaStacji × pytaniaNaStacje` pilnuje `E03` (B25, decyzja
  właściciela).
- Werdykt liczy tylko silnik: `app/app.js` czyta `wpis.poprawna` (zamiast
  `wybrana + 1 === pytanie.poprawna`) — ADR 0050 aneks 2026-09-15f, strażnik
  w `test/kontrakt.test.js`.
- `docs/PROTOKOL.md`: trzy zdania promptu zastosowane w obu szablonach (§2/§2.2
  zasady 4 i 7, wymaganie `stacja`), stałe `SZABLON_WERSJA = 'PYT/1.1.2'` /
  `SZABLON_WERSJA_BEZ_WERYFIKACJI = 'PYT/1.1-nofc.2'`, wpisy w §7.
- Nowe testy: single-werdykt (`kontrakt`), parity `skrotPaczki` aplikacja ↔ `.gs`
  (`most-paczka`), pin zdań promptu (`protokol`).
- Pozostałe pliki `app/*.js` — wyłącznie podbicie `?v=m12-140 → m12-143`.

**Znalezione — 1 usterka (dryf dokumentacji):** `docs/PROTOKOL.md` §3.2 (tabela
pól paczki, wiersz `stacja`) nadal mówi „rozkład równy ±1", choć §6 `E05`, §7,
prompt i `app/protokol.js` już tej tolerancji nie mają (B25, owner 2026-09-15f:
„Możesz wywalić to z E05 bo to nie występuje w przyrodzie"). Ten sam zwrot został
w `docs/decisions/0015` (Kontekst, zdanie o spójności wewnętrznej walidatora)
i w komentarzu `app/rozgrywka.js` (`stacjaZamknieta`). Strażnik dryfu
(`test/dryf-dokumentow.test.js`) nie miał pinu na tę frazę, więc nic nie złapało.
Archiwalny aneks `docs/decisions/archive/aneksy-0024-2026-09-07b.md` zostaje bez
zmian (historia).

**Naprawa:** PROTOKOL §3.2 (wiersz `stacja`) opisuje stan faktyczny — „każda
stacja ≥ 1 pytanie; rozkładu między stacje walidator nie sprawdza od
2026-09-15f, liczba pytań na stację wynika z setupu, patrz §6 `E05`”;
komentarz `app/rozgrywka.js` (`stacjaZamknieta`) i ADR 0015 (Kontekst)
przepisane bez „±1” (po `E04`/`E05`). Pin frazy „rozkład równy ±1”
w `MARTWE_FRAZY` (`test/dryf-dokumentow.test.js`) + LESSONS **L76** (grepa
starego brzmienia po żywych dokumentach i pin od razu, w tym samym commicie;
aktywny ADR z opisem stanu bieżącego dryfuje jak PROTOKOL). Dopisek do
zamkniętego B25 w `docs/BACKLOG.md`. Cache-bust **m12-143 → m12-144**
(L29/L37: zmiana `app/*.js` podbija wersję).

**Brama na koniec sesji:** `npm test` **807/807**, `npm run check` OK
(szablon §2 — 3603 znaki, §2.2 — 3738), audyt WCAG **0 naruszeń**, zasięg
mostu **97,7%** (850/870 wierszy), `npm run budzet` **99 639 / 100 000**
(rezerwa 361), cache-bust **m12-144**, protokół **PYT/1.1**, szablony
**`PYT/1.1.2` / `PYT/1.1-nofc.2`**.

**Otwarte po sesji:** kolejka pusta — PR czeka na scalenie właściciela.
Bez uwag z terenu dalsze sesje tylko audytują i czekają. W terenie nadal do
sprawdzenia paczka z promptu `PYT/1.1.2` (zasada 7, równa liczba pytań na
stację, kotwiczenie bez przepisu o nazwie miejsca) — jak w handoffie 15f.

## Sesja 2026-09-16 (PR #35) — uwagi terenowe: przycisk „Zlokalizuj mnie” i auto-przejście „Kopiuj prompt”

**Zlecenie:** „Dalsze uwagi z testów terenowych” — (1) ekran „Gdzie jesteś?”
w trybie testowym ma pozwalać na lokalizację (np. przycisk „zlokalizuj mnie”);
(2) „Kopiuj prompt” ma po skopiowaniu do schowka samo przejść na „Wklej
odpowiedź modelu”. Brak innych kryteriów. Sesja — ta sama gałąź i PR #35,
niezacommitowane zmiany po resecie sandboxa odtworzone na czystym `11fd505`.

**Implementacja (2 przyrostowe commity po audycie PR #34 z 15g):**

- `641767c` — przycisk „Zlokalizuj mnie”: element `#przycisk-zlokalizuj` TYLKO
  w dolnym rzędzie ekranu pozycji (między „← ustawienia” a „Dalej: stacje →”),
  klasa `tylko-test` = widoczny tylko w trybie testowym i tylko tam; poza trybem
  nie ma go ani w DOM-ie, ani jako ścieżki — w zwykłym trybie pozycja idzie
  wyłącznie watcherem (test pinuje zero `getCurrentPosition` poza testem).
  `wyznaczPozycje()` odpala JEDEN `getCurrentPosition(OPCJE_WATCH)` i karmi
  wspólny `przyjmijFix()`; błąd jawny kodem P02/P03/P04, przycisk wraca,
  a pozycję dalej da się ustawić stuknięciem mapy (D3). Komunikat ekranu zostaje
  bez zmian: „Tryb testowy: użyj oka i wskaż miejsce na mapie.”.
- `2addb58` — „Kopiuj prompt” auto-przechodzi: `kopiujTekst()` zwraca boolean
  `kopiujDoSchowka()`, handler po `true` woła `pokazEkran('paczka')`; przy
  fallbacku „⚠ zaznaczone — skopiuj ręcznie” ZOSTAJE na ekranie (tekst nie
  dotarł do schowka bez palca właściciela).
- Testy: `test/helpers/dom.js` atrapa geolokalizacji zyskuje `getCurrentPosition`
  (rejestr `zapytania` + `ostatnie`); `test/aplikacja.test.js` +8 testów
  (pozycja przycisku w HTML i tryb widoczności, sondaż ustawia pozycję, błąd
  przywraca przycisk, poza testem zero sondowań nawet po kliku, kopia przechodzi
  na ekran 5, fallback nie przechodzi) i `test/kontrakt.test.js` +1 pin
  (dokładnie jeden egzemplarz, tylko w dolnym rzędzie `#ekran-pozycja`
  z klasą `tylko-test`). Dokumenty: WORKFLOW + ARCHITECTURE opisują obie drogi
  pozycji testowej i degradację kopiowania.
- Cache-bust **m12-144 → m12-146** (index.html, wszystkie `app/*.js`, `WERSJA_SW`).

**Dogrywka twardości (po pierwszej prośbie właściciela o przycisk tylko**
**w trybie testowym):** `wyznaczPozycje()` dostał bramkę `if (!STAN.trybTestowy)
return;` — poza trybem testowym klik w przycisk (nawet wywołany z pominięciem
klasy `tylko-test`) nie robi nic: zero `getCurrentPosition`, status bez zmian.
Test nietestowego kliku pinuje to zachowanie; podbicie wersji m12-145 → m12-146.

**Brama na koniec sesji:** `npm test` **815/815** (+8 względem 15g), `npm run
check` OK (szablon §2 — 3603 znaki, §2.2 — 3738), audyt WCAG **0 naruszeń**,
zasięg mostu **97,7%** (850/870), budżet **99 639 / 100 000** (rezerwa 361),
cache **m12-146**, protokół **PYT/1.1**, szablony **`PYT/1.1.2` /
`PYT/1.1-nofc.2`**.

**Otwarte po sesji:** PR #35 nadal czeka na scalenie właściciela — teraz zawiera
audyt 15g + obie uwagi terenowe 2026-09-16. Kolejka pracy pusta.


## Sesja 2026-09-16 (PR #35), dogrywka 2 — uwagi terenowe: usunięcie żywych wyników multi, czyszczenie plików tymczasowych, puls „Łączę z siecią”

**Zlecenie (trzy uwagi terenowe 2026-09-16):**

- (1, KRYTYCZNA) Usunąć przestarzałą warstwę żywych wyników multiplayer.
  Po starcie gry (także solo u hosta) KAŻDY gracz widzi tylko mini-pasek dolny
  (np. „Jacek - stacja 1/5”) i kolejną stację na mapie (trasa-sekret) albo
  wszystkie stacje (trasa jawna / wyścig). Bez warstwy żywych wyników, bez
  ekranu lobby po starcie, bez LIMBO.
- (2) W trybie testowym przycisk „wyczyść pliki tymczasowe aplikacji” — najlepiej
  w panelu Informacje obok stopki wersji — do czyszczenia localStorage.
- (3) W lobby hosta „Rozpocznij grę” po kliknięciu ma zgasnąć i zamienić się
  w pulsujący „Łączę z siecią”, póki aplikacja łączy się z Drive.

**Implementacja:**

- **Usunięcie warstwy żywych wyników (pkt 1):** `renderujLobby()` nie odsłania
  już `#lobby-widownia` ani nie wypełnia `#lobby-widownia-wiersze` poza lobby;
  branch czyści tylko `#lobby-status`. Funkcja `renderujWierszeWynikow()`
  i znacznik `#lobby-widownia` w `index.html` usunięte W CAŁOŚCI (L31: nagrobek
  w komentarzu nad `renderujLobby()` + wpis martwych fraz w
  `test/dryf-dokumentow.test.js`, żeby warstwa nie wróciła).
  `uruchomGreMulti()` buduje lokalny silnik z PEŁNEJ trasy (`stacje: wszystkie`)
  zamiast „stacji bez zamkniętych” — numeracja „stacja X z Y” zgadza się z trasą.
  Gracz, który domknął wszystkie swoje stacje: gdy most zamknął grę (np. solo) —
  `m.gra = gra`, status „Gra wieloosobowa zakończona — wspólne wyniki poniżej.”,
  `pokazWyniki(); renderujGre();`; w pozostałych wypadkach — status „…wszystkie
  Twoje stacje są już zamknięte…”, własny ekran wyniku i czekanie na wspólny.
  Zero powrotów do lobby, zero LIMBO. Powrót po odświeżeniu telefonu odtwarza
  postęp z własnych zdarzeń mostu (`odtworzPostepMulti`: `dojscie` —
  `skierujDoStacji`→`startOdcinka`→`zakonczOdcinek`, `odpowiedz` — `zapiszOdpowiedz`
  z mapą `poprawna` na indeks 0..3) — te same pure-funkcje co na żywo.
- **Czyszczenie plików tymczasowych (pkt 2):** `#przycisk-czysc-tymczasowe`
  (wiersz `tylko-test`, obok `#stopka-wersja`) + `czyscPlikiTymczasowe()`
  z bramką `if (!STAN.trybTestowy) return;` — iteruje po całym `localStorage`,
  status z liczbą kluczy, potem `location.reload()` (stan wraca do czystego).
  Cudze klucze (`inna-apka:*`) też schodzą — to narzędzie testowe właściciela.
- **Puls „Łączę z siecią” (pkt 3):** `startLobby()` zapamiętuje etykietę w
  `dataset.etykieta`, ustawia `disabled` + `textContent = 'Łączę z siecią'` +
  `.pulsuje` PRZED `polecenieMostu('gra-start')`; w `catch` przywraca etykietę,
  odblokowuje i gasi puls. Po sukcesie lobby znika (gra się otwiera), więc
  wychodząc nic nie trzeba przywracać.
- **Testy (+6, razem 821):** `test/wieloosobowa-ui.test.js` +4 (puls przy
  zamrożonym `gra-start`, powrót etykiety po awarii i retry, host po starcie
  bez lobby/żywych wyników z ekranem `#gra-panel-koniec`, gracz z domkniętymi
  stacjami trafia na wejściu na wynik nie do lobby); `test/aplikacja.test.js` +2
  (czyszczenie czyści CAŁY localStorage w trybie testowym i jest martwe poza
  nim — bramka trybu). `test/kontrakt.test.js`: stopka Informacje ma teraz
  PIĄTĄ pozycję `tylko-test` (kolejność i kropki), a `test/dryf-dokumentow.test.js`
  dostał frazy `lobby-widownia-wiersze` i `renderujWierszeWynikow`.
- **Dokumenty:** `docs/decisions/0044-…` (aneks 2026-09-16: żywe wyniki widowni
  usunięte; poprawiona „Konkluzja” z 2026-09-13), koperta uwagi w
  `docs/decisions/archive/aneksy-0019-…` (treść historyczna), `docs/WORKFLOW.md`
  (obserwacje bez żywej tabeli), `docs/ARCHITECTURE.md` (model z pełnej trasy
  + `odtworzPostepMulti`), komentarze `app/sync.js` (powód 30 s) i
  `app/wieloosobowa.js` (`postepGracza` bez „żywej tabeli”).
- Cache-bust **m12-146 → m12-147** (index.html, wszystkie `app/*.js`, `WERSJA_SW`).

**Brama na koniec sesji:** `npm test` **821/821** (+6), `npm run check` OK
(szablon §2, §2.2), audyt WCAG **0 naruszeń**, zasięg mostu **97,7%** (850/870),
budżet **99 933 / 100 000** (rezerwa 67), cache **m12-147**.

**Otwarte po sesji:** PR #35 (scalenie właściciela, squash).

## Sesja 2026-09-16 (PR #35), dogrywka 3 — status graczy multi: panel Informacje i blok pod wynikiem

**Zlecenie:** w grze multi (NIE hot-seat!), w obu trybach (trasa i wyścig), dla
każdego gracza z hostem włącznie, panel Informacje ma pokazywać status gry
multi — tabelę (Imię, zaliczone stacje, poprawne odpowiedzi, status
Aktywny / Opuścił grę / Zakończył trasę). Aktualizacja co ~30 s, jeśli ktoś
jest w panelu. Ta sama tabela może trafić pod wynik gracza kończącego grę.

**Odpowiedzi właściciela (doprecyzowanie):**
- zaliczone = liczba ODPOWIEDZI na stacje (nie samo dojście; `dojscie` bez
  odpowiedzi nie domyka stacji — spójnie z tym, jak most kończy grę);
- „Poprawne” z mianownikiem ROSNĄCYM — liczba udzielonych dotąd odpowiedzi;
- odświeżanie z OSTATNIEGO znanego stanu (zwykły polling 30 s), bez dodatkowego
  żądania do mostu przy otwarciu;
- blok zostaje w Informacjach do momentu, aż gracz wejdzie w setup nowej gry
  (`STAN.multi` gaśnie) — wtedy znika.

**Implementacja:**
- `app/app.js`: `STATUS_GRACZA_MULTI` (Aktywny / Opuścił grę / Zakończył
  trasę), `tabelaPrzebieguMulti()` — jedno źródło wierszy dla `gra.gracze`
  (uczestnicy z momentu startu), stacje `min(odpowiedzi, N)/N`, poprawne
  `p.poprawne/(poprawne+bledne)` z `postepGracza` (nowy import); `jestGraMulti()`,
  `renderujInformacjeMulti()` (#informacje-multi) i `renderujWynikiMulti()`
  (#gra-wyniki-multi). Render wołany przy otwarciu panelu (`przelaczInformacje`),
  na każde zdarzenie gry (`renderujGre`) i na każdy krok pollingu
  (`onStanGryMulti`) — zero dodatkowych żądań.
- `index.html`: blok `#informacje-multi` (tabela + podpis) w panelu Informacje
  i `#gra-wyniki-multi` (tabela) POD wspólną tabelą `#gra-wyniki` w panelu
  końca — ten drugi z `hidden` (hot-seat: ekran bez zmian).
- `app/styles.css`: osobny, czytelny zapis 14 px dla tabel statusu (wyjątek
  od ADR 0042) + kolory wierszy `wiersz-ukonczyl`/`wiersz-opuscil`.
- ADR **0051** (status multi — pełnia decyzji) i aneks do ADR 0038
  („Przebieg gry” pod tabelą nie odwraca minimalizmu); rejestr ADR uzupełniony.
- Testy +5 (826): `wieloosobowa-ui.test.js` +3 (panel w grze + aktualizacja,
  „Opuścił grę” po rezygnacji, przebieg pod wynikiem „Zakończył trasę”),
  `aplikacja.test.js` +1 (hot-seat bez obu bloków), `kontrakt.test.js` +1
  (węzły + kolejność pod tabelą wyniku).
- Cache-bust **m12-147 → m12-148**.

**Brama na koniec:** `npm test` **826/826**, `npm run check` OK, WCAG **0**,
zasięg mostu **97,7%** (850/870), budżet **99 933 / 100 000** (rezerwa 67),
cache **m12-148**.

**Otwarte po sesji:** PR #35 (scalenie właściciela, squash).

## Sesja 2026-09-16 (PR #35), dogrywka 4 — hot-seat: odpowiedzi graczy w panelu Informacje

**Zlecenie (dopełnienie dogrywki 3):** analogicznie do multi, w grach HOTSEAT
panel Informacje dostaje tabelę każdego gracza biorącego udział: „Gracz” +
„Ilość odpowiedzi poprawnych” (np. 1/3). Tylko w layerze Informacje i TYLKO
podczas gry; po zamknięciu/zakończeniu gry nic nie doklejamy do panelu.

**Doprecyzowanie właściciela:** mianownik ROSNĄCY (jak w multi) — udzielone
dotąd odpowiedzi (`1/1`, `1/2`…), nie stała liczba pytań gracza.

**Implementacja:**
- `index.html`: `#informacje-hotseat` (nagłówek „Gra lokalna — odpowiedzi
  graczy” + tabela 2 kolumn + `#informacje-hotseat-wiersze`), `hidden`
  domyślnie, w panelu Informacje pod blokiem multi.
- `app/app.js`: `tabelaInformacjeHotseat()` (z `podsumowanie(rozgrywka).gracze`
  → `poprawne/(poprawne+bledne)`) i `renderujInformacjeHotseat()` — bramka
  `czyGraToczySie() && !STAN.multi`; render przy otwarciu panelu i na końcu
  `renderujGre()` (znika przy końcu gry). Hot-seat NIGDY nie dokleja bloku po
  zakończeniu — warunek fazy `koniec` / ręcznego końca go wygasza.
- `app/styles.css`: spójne 14 px jak w tabeli multi.
- Testy +2 (`test/aplikacja.test.js`: tabela 2 graczy z rosnącym mianownikiem
  + brak bloku po zakończeniu; `test/kontrakt.test.js`: węzły + dokładnie dwie
  kolumny).
- **Budżet lektury:** nadwyżka z poprzedniej dogrywki (ADR 0051 + aneksy przy
  rezerwie 67) przekroczyła 100 000 — wpisy ADR skrócone do szkieletu decyzji
  (pełnia w historii). Rezerwa domknięta na 8 tokenach.

**Brama na koniec:** `npm test` **828/828**, `npm run check` OK, WCAG **0**,
zasięg mostu **97,7%**, budżet **99 992 / 100 000** (rezerwa 8), cache `m12-148`.

## 2026-09-16b — otwarcie sesji `arena/01a0aa50-okolica` (PR w tym commicie)

**Zlecenie:** „kontynuujemy projekt". Kamienie M0–M12 zamknięte jako zakres
kodu (L68); bez uwag z terenu kolejka jest pusta, więc sesja robi to, co każe
`AGENTS.md` §2 pkt 2: audyt poprzedniego scalonego PR, a potem czeka na uwagi.

**Brama startowa:** `npm test` **828 / 828**, `npm run budzet` **99 992 /
100 000** (rezerwa 8), `main` = `7974981` (squash PR #35, scalony 2026-09-16
12:52 UTC), cache-bust w `main` = `m12-148`.

**Audyt PR #35** (squash `7974981` na `c1a90e8`, 36 plików, +1617/−129; testy
w `main` 807 → 828). Zakres scalenia: audyt PR #34 z pinem „rozkład równy ±1"
(L76), pięć uwag terenowych 2026-09-16 („Zlokalizuj mnie" w trybie testowym,
auto-przejście po „Kopiuj prompt", usunięcie żywych wyników widowni, czyszczenie
plików tymczasowych, puls „Łączę z siecią") oraz dogrywki 3 i 4 (status graczy
multi w Informacjach i pod wspólnym wynikiem — ADR 0051; tabela hot-seat
w Informacjach).

**Sprawdzone i zgodne (nie ruszane):**

- Usunięcie warstwy widowni jest KOMPLETNE: `renderujWierszeWynikow()`
  i `#lobby-widownia` zniknęły z kodu i markupu, a obie frazy mają pin
  w `MARTWE_FRAZY` (`test/dryf-dokumentow.test.js`) razem z „rozkład równy ±1"
  (L76); `renderujLobby()` poza lobby tylko czyści `#lobby-status`.
- `odtworzPostepMulti()` odtwarza postęp gracza przez te same pure-funkcje co
  gra na żywo (`skierujDoStacji` → `startOdcinka` → `zakonczOdcinek`,
  `zapiszOdpowiedz`), werdykt nadal liczy silnik (ADR 0050 aneks), a `wybrana`
  w odtworzeniu jest wyłącznie wejściem do `zapiszOdpowiedz`.
- Status multi (`tabelaPrzebieguMulti`) czyta ostatni stan mostu: zero
  dodatkowych żądań, `stacje = min(odpowiedzi, N)/N` (odpowiedź właściciela),
  poprawne z mianownikiem rosnącym, `hidden` u hot-seatu
  (`#gra-wyniki-multi`, `#informacje-hotseat`).
- „Zlokalizuj mnie": jeden egzemplarz w `#ekran-pozycja`, klasa `tylko-test`
  ORAZ twarda bramka `if (!STAN.trybTestowy) return;` — poza trybem testowym
  zero sondaży GPS (pin w `test/aplikacja.test.js`).
- Auto-przejście „Kopiuj prompt" jest bramkowane REALNYM wynikiem schowka
  (`kopiujTekst` zwraca boolean), fallback zostawia właściciela na ekranie.
- Cache-bust `m12-143 → m12-148` spójny w `index.html`, wszystkich `app/*.js`
  i `WERSJA_SW` (L29); `konfiguracja.liczbaStacji` z mostu faktycznie istnieje
  w schemacie gry (R07/`SCHEMAT_GRY`), więc tabela statusu ma z czego liczyć N.

**Znalezione — do naprawy w kolejnych commitach tej sesji:**

1. **DEFEKT: `startLobby()` przywracał przycisk tylko na błędzie.** Po udanym
   starcie „▶ Start gry" zostawał `disabled` z etykietą „Łączę z siecią"
   i pulsem; ekran lobby znika, ale WĘZEŁ przycisku żyje dalej niż gra, więc
   host, który po zakończeniu gry zakładał kolejną, nie mógł jej wystartować
   bez odświeżenia strony. Pozostałe asynchroniczne przyciski aplikacji
   (`bramkaTozsamosci`, „▶ Graj z tą paczką", „Dalej: moja pozycja") przywracają
   stan w `finally` — ten jeden nie.
2. `renderujInformacjeMulti()`: martwa zmienna `const teraz = new Date();`
   (została po nieużytym pomyśle na godzinę odświeżenia).
3. `czyscPlikiTymczasowe()`: komentarz objaśniający z niezrozumiałym zdaniem
   („Zwykły serwer statyczny nie gubi Request.Storage… limity quota…") —
   opis nie mówi nic sprawdzalnego o cache PWA.

**Poza zakresem PR #35 (dług sprzed scalenia):** martwy import `OGRANICZENIA`
w `app/app.js` (nieużywany już przed `7974981`) — schodzi przy okazji.

**Werdykt:** treść scalenia zgodna z ADR i protokołem; jeden defekt w stanie
przycisku lobby (pole widzenia testów: każdy test dostaje świeży DOM, więc
przejście „druga gra w tej samej sesji strony" nie miało pokrycia) i dwa
porządkowe długi w tym samym pliku.

**Naprawa (commit `69a50f2`, cache m12-148 → m12-149):**

- `startLobby()`: przywrócenie etykiety i blokady przeniesione do `finally`
  (wzorzec z reszty aplikacji: `bramkaTozsamosci`, „▶ Graj z tą paczką”,
  „Dalej: moja pozycja”) — stan „w locie” nie przecieka do następnego lobby.
- `test/wieloosobowa-ui.test.js`: test odtwarzający — DWIE gry w jednej sesji
  strony (gra 1 → ⚙ START GRY → TAK → „🏠 Wróć na początek” → setup → gra 2);
  bez naprawy pada na etykiecie, z naprawą przechodzi (+1 test, 829).
- Porządki z audytu: martwa zmienna `const teraz` w `renderujInformacjeMulti()`,
  martwy import `OGRANICZENIA` (dług sprzed PR #35), komentarz
  `czyscPlikiTymczasowe()` przepisany na sprawdzalny opis (localStorage +
  cache PWA, service worker zostaje zarejestrowany).
- `docs/LESSONS.md` → **L77** (+ lustro w `docs/LESSONS_ARCHIVE.md`): stan
  ustawiany na czas operacji asynchronicznej wraca na KAŻDEJ ścieżce, a test
  takiej ścieżki to DWIE operacje w jednej sesji strony. Budżet lektury
  domknięty: L77 w rejestrze (szkielet), L71/L72/L74/L76 skrócone — pełnia
  opisów została w archiwum.

**Brama na koniec:** `npm test` **829/829**, `npm run check` OK (szablon §2 —
3 603 znaki, §2.2 — 3 738), audyt WCAG **0 naruszeń**, zasięg mostu **97,7%**
(850/870), budżet **99 963 / 100 000** (rezerwa **37**), cache **m12-149**,
szablony `PYT/1.1.2` / `PYT/1.1-nofc.2`, protokół `PYT/1.1`.

**Otwarte po sesji:** PR #36 (scalenie właściciela, squash). W terenie bez
zmian: paczka z promptu `PYT/1.1.2` (zasada 7, równa liczba pytań na stację,
kotwiczenie) oraz polecenia z PR #35.

## 2026-09-16c — otwarcie sesji `arena/01a0aa68-okolica` (PR w tym commicie)

**Zlecenie:** „kontynuujemy projekt". Kamienie M0–M12 zamknięte jako zakres
kodu (L68); bez uwag z terenu kolejka jest pusta, więc sesja robi to, co każe
`AGENTS.md` §2 pkt 2: audyt poprzedniego scalonego PR (#36), a potem czeka na uwagi.

**Brama startowa:** `npm test` **829 / 829**, `npm run budzet` **99 963 /
100 000** (rezerwa 37), `main` = `7227617` (squash PR #36, scalony 2026-09-16
13:28 UTC), cache-bust w `main` = `m12-149`.

**Audyt PR #36** (squash `7227617` na `7974981`, 19 plików, +330/−77; testy
w `main` 828 → 829). Zakres scalenia: naprawa przycisku „▶ Start gry” w lobby
(`startLobby` przywraca stan w `finally` zamiast tylko w `catch`), test
odtwarzający w `test/wieloosobowa-ui.test.js` (dwie gry w jednej sesji strony),
porządki w `app/app.js` (usunięcie martwej zmiennej `const teraz`, usunięcie
martwego importu `OGRANICZENIA`, uściślenie komentarza `czyscPlikiTymczasowe`),
cache-bust `m12-148 → m12-149`, oraz LESSONS L77 z lustrem w archiwum i
skróceniem szkieletów L71/L72/L74/L76 dla zachowania budżetu lektury.

**Sprawdzone i zgodne (nie ruszane):**
- Przywrócenie stanu przycisku `startLobby()` w bloku `finally`: stan `disabled`,
  etykieta i klasa `pulsuje` wracają na każdej ścieżce (sukces i błąd).
- Test odtwarzający w `test/wieloosobowa-ui.test.js`: testuje dokładnie scenariusz
  dwóch gier bez przeładowania strony, przechodzi stabilnie.
- Spójność podbicia `m12-149`: `index.html`, wszystkie `app/*.js`, `sw.js`
  i testy kontraktowe — brak jakichkolwiek resztek `m12-148`.
- Budżet lektury startowej: 99 963 / 100 000 tokenów (rezerwa 37).
- Brama jakości: `npm test` 829/829, `npm run check` (szablony promptu zgodne),
  `npm run audyt` (WCAG AA 0 naruszeń), `npm run zasieg-mostu` (97,7%).

**Znalezione defekty:** brak. Wszystkie zmiany w PR #36 są czyste, logiczne
i zgodne z ADR oraz protokołem.

**Werdykt:** scalenie w pełni poprawne. Kamienie M0–M12 zamknięte; brak
uwag z terenu w kolejce — sesja gotowa i oczekuje na uwagi z testów
terenowych właściciela.

## 2026-09-16d — otwarcie sesji `arena/01a0aac7-okolica` (PR #38 w tym commicie)

**Zlecenie:** „kontynuujemy projekt”. Kamienie M0–M12 zamknięte jako zakres
kodu (L68); kolejka pracy pusta, więc sesja robi to, co każe `AGENTS.md` §2
pkt 2: audyt poprzedniego scalonego PR (#37), a potem czeka na uwagi z terenu.

**Brama startowa:** `npm test` **829 / 829**, `npm run budzet` **99 963 /
100 000** (rezerwa 37), `main` = `31dbbf4` (squash PR #37, scalony 2026-09-16
15:13 UTC), cache-bust w `main` = `m12-149`.

**Audyt PR #37** (`7227617..31dbbf4`, docs-only: 2 pliki, +93 —
`docs/PROJECT_HISTORY.md` +37, nowy `docs/setup/HANDOFF_2026-09-16c.md`).
Sprawdzone wobec repozytorium i `gh`:
- Brama z handoffu 16c (829/829; check OK — §2 3 603 znaki, §2.2 3 738; WCAG AA
  0 naruszeń; zasięg mostu 97,7%); powtórzona w tej sesji, zgodna w całości.
- Naprawa `startLobby()` z PR #36 stoi na miejscu (`finally` przywraca
  `disabled`, etykietę i `pulsuje`); test dwóch gier w jednej sesji strony żyje
  (`test/wieloosobowa-ui.test.js`); L77 jest w rejestrze i w archiwum.
- Porządki z PR #36 potwierdzone w kodzie: brak martwej zmiennej w
  `renderujInformacjeMulti()`, brak importu `OGRANICZENIA` w `app/app.js`,
  komentarz `czyscPlikiTymczasowe()` opisuje wyłącznie to, co kod robi.
- Statystyki scalenia PR #36 (`7974981 → 7227617`): 19 plików, +330/−77; brak
  resztek `m12-148` i fraz „czeka na scalenie” w nośnikach żywych.

**Znalezione defekty:** jedna nieścisłość zapisu — wpis 16c podawał godzinę
scalenia PR #36 jako 13:10 UTC, a źródła mówią **13:28:55Z** (`gh pr view 36`,
`mergedAt`) i 15:28:54+02:00 (committer date commita `7227617`). Wiersz
poprawiony na „13:28 UTC”; poza tym zapis 16c zgodny z rzeczywistością.

**Werdykt:** PR #37 (dokumentacyjny) bez zastrzeżeń merytorycznych poza
godziną scalenia — poprawione; PR #36 nadal bez defektów. Kamienie M0–M12
zamknięte, kolejka pusta.

**Otwarte po sesji:** PR #38 (scalenie właściciela, squash). Most Apps Script
bez zmian. Czekamy na uwagi z testów terenowych (m.in. paczka z promptu
`PYT/1.1.2` i polecenia z PR #35).
