# ROADMAP — Tajemnicza Okolica

> Plan kamieni milowych; status aktualizowany na końcu każdej sesji.
> Szczegóły bieżącego zadania żyją w `docs/plans/PLAN_*.md`, pomysły poza
> planem w `docs/BACKLOG.md`. Brak zlecenia właściciela = najwyższy otwarty
> kamień milowy (AGENTS.md §2).

## M0 — Fundament (sesja 2026-09-05) — ✅ ZREALIZOWANE

- [x] E1 — konfiguracja repo i zasady: `package.json`, `.gitignore`,
      `README.md`, `AGENTS.md`, `docs/setup/ENVIRONMENT.md`, `docs/LESSONS.md`.
- [x] E2 — rejestr ADR + ADR 0001–0013 (`docs/decisions/`).
- [x] E3 — `docs/PROTOKOL.md` (protokół PYT v1.0: szablon promptu, schemat
      paczki, kategorie wiekowe, kanon tematów, kody usterek E01–E20).
- [x] E4 — dokumentacja projektu: `ARCHITECTURE`, `ROADMAP`, `BACKLOG`,
      `WORKFLOW`, `ASSETS`, `PROJECT_HISTORY`, `plans/PLAN_2026-09-05-fundament.md`,
      `setup/ci-workflow.yml`.
- [x] E5 — szkielet aplikacji: `index.html`, `app/styles.css`, `app/geo.js`,
      `app/konfig.js`, `app/protokol.js`, `app/stacje.js`, `app/app.js`
      + `tools/synchronizuj-szablon.mjs` — pięć ekranów (setup → pozycja →
      stacje → prompt → paczka), tryb testowy `?tryb=test` (commit `89a0586`).
      Kryterium spełnione: live preview pokazuje setup na 360 px, brama zielona.
- [x] E6 — testy: `test/geo.test.js`, `test/konfig.test.js`,
      `test/protokol.test.js`, `test/stacje.test.js`, `test/kontrakt.test.js`
      + `test/fixtures/paczka-ok.json` (commity `8011f0f` i następny).
      82 testy, wartości referencyjne i kontrprzykłady, nie „co wyszło".
- [x] E7 — handoff sesji (`docs/setup/HANDOFF_2026-09-05.md`) + aktualizacja
      `ROADMAP`, `plans/PLAN_2026-09-05-fundament.md`, `PROJECT_HISTORY`,
      `LESSONS` (L7–L9), `PROTOKOL` (§3.2, §6), ADR 0003 (pkt 5).

## M1 — Geodezja i model rozgrywki (czyste funkcje) — ✅ ZREALIZOWANE (sesja 2026-09-05)

Zakres z planu: `app/geo.js` (haversine, bearing, Mercator, pierścienie,
dopasowanie zoomu), `app/pozycja.js` (kryterium dojścia, filtr dokładności),
`app/rozgrywka.js` (kolejki graczy, odcinki, czasy, punktacja),
`app/kodowanie.js` (obfuskacja bez klucza, kontener `TO-paczka/2`),
`app/protokol.js` (`zbudujPrompt`, `walidujPaczke`).
Kryterium: wszystko przetestowane w Node bez DOM i bez sieci; round-trip ukrycia
paczki na Node i w przeglądarce.

**Zrobione przed czasem w M0:** `app/geo.js` (z progami dojścia i regułą dwóch
kolejnych trafień, czyli rdzeń kryterium z `pozycja.js`), `app/protokol.js`
(`zbudujPrompt`, `walidujPaczke`, parser, poprawka dla modelu), `app/konfig.js`,
`app/stacje.js` oraz `app/kodowanie.js` — ukrywanie paczki przez obfuskację bez
klucza (kontener `TO-paczka/2`, suma FNV-1a) zamiast planowanego szyfrowania
kluczem z `kod gry` (wariant odrzucony przez właściciela, wraca jako `BACKLOG`
B16); round-trip ukrycia paczki jest testowany w `test/kodowanie.test.js`.

**Ta sesja** (plan: `docs/plans/PLAN_2026-09-05-m1-rozgrywka-i-pozycja.md`):

- [x] F1 — ADR 0014 (*Proponowana*): punktacja czasu jako premia/potrącenie
      względem **mediany tempa** odcinków (doprecyzowanie ADR 0009 pkt 5, który
      w modelu hot-seat nie miał próbek) + wpis w rejestrze + plan zadania
      (commit `56e0dc6`).
- [x] F2 — `app/rozgrywka.js`: stan `rozgrywka/1`, kolejka cykliczna
      (`gracz = stacja mod N`), odcinki (start na jawnej akcji, kara za ręczne
      zgłoszenie, limit czasu), punktacja z ADR 0014, tryby współpracy
      `solo`/`zespol`/`wszyscy`, dziennik zdarzeń, `podsumowanie()`,
      `wczytajStan()` z odmową przy obcym schemacie; kody `G01`–`G13`;
      `test/rozgrywka.test.js` (commit `8eec03c`).
- [x] F3 — `app/pozycja.js`: filtr dokładności (`ocenFix`), kryterium dojścia
      (`stanDojscia` na `geo.czyDotarl`), komunikaty `P01`–`P09`, symulacja
      trasy dla trybu testowego (`trasaProsta`, `punktNaTrasie`,
      `fixSymulowany`, `sekwencjaSymulowana`), osłona `watchPozycja()`;
      `test/fixtures/trasa-odbicie.json`, `test/pozycja.test.js`
      (commity `3537e59`, `0046216`).
- [x] F4 — `test/helpers/dom.js` (wspólna atrapa DOM: `zainstalujDom`,
      `atrapaGeolokalizacji`) + przełączenie `test/aplikacja.test.js` na nią
      i refactor `app/app.js`: geolokalizacja wyłącznie przez `pozycja.js`,
      pauza śledzenia w tle i wznowienie (ADR 0004 pkt 1), współrzędne ręczne
      przez `ocenFix` z odmową przy pustym polu (commit `09faf5c`);
      przy okazji hartowanie `domyslnaKonfiguracja` — NaN z `localStorage`
      nie wchodzi już do UI (commit `78a1bd0`, LESSONS L10).
- [x] F5 — dokumentacja po wykonaniu: ADR 0015 (*Proponowana*: niekompletna
      paczka, pominięcie tylko w drodze, spójne liczniki, przedrostki kodów),
      `ARCHITECTURE` (moduły, przepływ rozgrywki, algorytmy, stan i testowanie),
      `LESSONS` L10–L12, `PROJECT_HISTORY`, `HANDOFF_2026-09-05-m1.md`,
      cache-busting `?v=m1-1` (ten commit).

Kryterium spełnione: `npm run brama` = **177 testów**, 0 fail — w tym pełna gra
3 graczy × 5 stacji od startu do podsumowania na wstrzykniętym zegarze,
sekwencja fixów z odbiciem sygnału (stacja się nie zapala) i symulacja trasy
kończąca się dojściem. Stan gry nie zawiera treści pytań (kontrakt na
prawdziwej paczce z fixture'a). Do M6 zostaje ekran gry (UI) i zapis stanu do
`localStorage` (`app/trwalosc.js` — kryterium M6 mówi o wznowieniu po
zamknięciu przeglądarki; para `wczytajStan()` ↔ `JSON.stringify(stan)` jest już
przetestowana).

## M2 — Mapa — ✅ ZREALIZOWANE (2026-09-05, potwierdzenie wizualne właściciela)

Renderer SVG (Web Mercator, pan/zoom/pinch/przyciski), warstwa kafelków
(OSM Standard / OpenTopoMap / Esri World Imagery — bez kluczy API,
`ASSETS` §1; CARTO odrzucone kwerendą 2026-09-05), marker pozycji z kołem
dokładności, okrąg promienia gry, numerowane pinezki stacji.
Kryterium: mapa działa na 360 px, palec (drag + pinch), podkład widoczny
w live preview, atrybucja zawsze obecna.

**Ta sesja** (plan: `docs/plans/2026-09-05-m2-mapa.md`):

- [x] G1 — plan kamienia: zakres, dziewięć ustaleń wstępnych, etapy, ryzyka,
      kryteria (commit `03f2a56`).
- [x] G2–G4 — `app/mapa.js`: matematyka widoku (zoom ↔ skala, środek ↔
      przesunięcie, kotwica zoomu, widełki `maxZoom` podkładu), adresy kafelków
      (`{z}/{x}/{y}`, Esri `{z}/{y}/{x}`, deterministyczna poddomena),
      `planKafelkow` (margines 1 kafelka, limit `MAX_KAFELEK = 48` z polityki
      OSM Tile Usage), metry ↔ piksele ↔ jednostki świata, pasek skali,
      `planMapy`; warstwa DOM `utworzMape()` (SVG z `transform` na warstwach
      metrycznych, gesty Pointer Events: drag, pinch, kółko; przyciski ±/◎;
      atrybucja i `aria-label`); `test/mapa.test.js` — 50 testów
      (commit `59b5573`).
- [x] G5 — wpięcie w UI: dwa panele (`ekran-pozycja`, `ekran-stacje`) ze
      szkieletem w `index.html`, style mobilne (`touch-action: none`, cele
      44 px, atrybucja jako pasek), podkład z setupu przechodzi na mapy,
      pierwszy fix centruje widok w zoomie z `dopasujZoomDoPromienia`,
      `pokazEkran`/`resize` odświeżają panel (schowany ma rozmiar 0 — LESSONS
      L13); przy okazji naprawione przejście „Dalej: stacje", które przy
      wyczyszczonym promieniu kończyło się nie złapanym `TypeError`
      z `stacjeProste`, a teraz odmawia jawnie z kodem `[K12]`;
      +9 testów wpięcia i +5 kontraktowych (commit `e65f26b`).
- [x] G6 — dokumentacja: `ARCHITECTURE` (moduł, przepływ, algorytmy widoku
      i gestów, testowanie), `WORKFLOW` §4.1 (procedura weryfikacji mapy
      w live preview), `ASSETS` §1 (zapis poddomen `{s}` w kodzie),
      LESSONS **L13**–**L15**, `PROJECT_HISTORY`, handoff.

**Potwierdzenie wizualne właściciela (2026-09-05, `WORKFLOW` §4.1):** w live
preview Areny podkład OSM Standard ładuje się i jest czytelny, pasek skali
pokazuje „100 m", atrybucja `© OpenStreetMap contributors (ODbL)` jest na
miejscu, przyciski ＋ − ◎ siedzą w narożniku i nie zasłaniają mapy; przy
odmowie zgody na geolokalizację ekran pokazuje kod `P02` z podpowiedzią, jak
zezwolić albo przejść na tryb ręczny — dokładnie tak, jak chce ADR 0004 pkt 7.
Zrzut właściciela (Centrum Warszawy, ekran „pozycja") jest dowodem zamknięcia
kryterium; gesty drag/pinch do obejrzenia przy pierwszej grze w terenie (M4/M6).
Agent nie ma przeglądarki ani sieci do kafelków (LESSONS L3), więc sam tego
kryterium sprawdzić nie mógł.

## M3 — Ekran konfiguracji i geolokalizacja na żywo

Setup (liczba graczy i imiona, tryb ruchu, promień, liczba stacji, tematy,
wiek, język, kod gry, kara za tryb ręczny, współpraca), walidacja, zapis
`okolica:konfig`, `watchPosition` + badge dokładności, tryb testowy
(`?tryb=test`, ręczne współrzędne i symulacja trasy), ekran „dane i prywatność".
Kryterium: pełna konfiguracja na telefonie bez przewijania; pozycja aktualizuje
się na żywo; tryb testowy pozwala rozegrać grę bez GPS.

**Zrobione przed czasem w M0/M1:** ekran setupu z walidacją (K01–K20) i zapisem
`okolica:konfig` (schemat `konfig/1`), `watchPosition` z badge'em dokładności,
tryb testowy `?tryb=test` z ręcznymi współrzędnymi (M0) oraz pauza śledzenia
w tle z wznowieniem, odmowa przy pustych współrzędnych i **symulacja trasy**
jako czysta funkcja `pozycja.sekwencjaSymulowana()` (M1).
**Zostało na M3:** ekran „dane i prywatność" (ADR 0013), podpięcie symulacji
trasy do UI trybu testowego i sprawdzenie kryterium „bez przewijania" na
telefonie (360 px).

**Stan kodu (2026-09-05):** wszystko z listy wyżej jest zaimplementowane —
ekran prywatności z dwustopniowym kasowaniem kluczy `okolica:*` (commit
`8abb11c`), symulacja dojścia w UI trybu testowego karmiąca ten sam lej fixów
co GPS (`5c0264f`), dokumentacja (commit H4). Brama: **249 testów**, 0 fail.
**Kamień w weryfikacji właściciela** (`docs/WORKFLOW.md` §4.2): kryterium
„pełna konfiguracja bez przewijania na 360 px" da się ocenić tylko na żywo;
jeśli przewijanie okaże się nieuniknione, właściciel decyduje — akceptujemy je
jako świadome odstępstwo (adnotacja tutaj) albo składamy rzadkie pola
w `<details>`. ✅ pojawi się dopiero po tym potwierdzeniu.

## M4 — Stacje z sieci drogowej (największe ryzyko)

Overpass: budowa zapytania, graf, Dijkstra, kandydaci, filtry dostępności,
wybór stacji (pierścienie + separacja + pass wyrównujący), cache geohash,
degradacja bez Overpass i ręczne ustawianie stacji.
Kryterium: na trzech fixture'ach (centrum / przedmieście / las) żadna stacja
w budynku ani na terenie prywatnym; odchylenie standardowe dystansów ≤ 15%
średniej; sprawdzone **w terenie** na co najmniej jednej okolicy.

**Kod M4 gotowy (2026-09-05):** pipeline Overpass w `sieci.js` (zapytanie
`R × 1,15`, parser `out geom`, graf z interpolacją co ~50 m, Dijkstra z
kopcem, snapowanie, kandydaci z filtrami dostępności i barier, wybór
pierścień 0,7R ± 20% + separacja kątowa/sieciowa + pass wyrównujący) oraz
warstwa UI: cache `okolica:sieci:<geohash6>-<R>` (TTL 30 dni, LRU 2 MB),
łańcuch trzech instancji z odstępem 30 s (ASSETS §2), jawna degradacja do
pierścienia i ręczne pinezki (ADR 0005 pkt 8). Fixture'y (wspólne wierzchołki
na skrzyżowaniach, jak w OSM): **centrum** R=600/N=5 — udział odchylenia 3,3%;
**przedmieście** R=1000/N=4 — 3,9%; **las** R=1500/N=4 — 0,2% (kryterium
≤ 15%); 100% kandydatów osiągalnych, żadnej stacji w budynku ani na terenie
prywatnym. Brama: 313 testów, 0 fail.
**Zostało na M4:** kryterium terenowe — co najmniej jedna prawdziwa okolica
na telefonie, test właściciela (`WORKFLOW` §4.2); przy okazji pierwsze
patrzenie na gesty drag/pinch z M2.

## M5 — Pętla pytań (prompt → model → walidacja → paczka)

Ekran promptu (kopiowanie, import/eksport pliku, instrukcja obrazkowa),
walidacja z kodami E01–E20 i przyciskiem „skopiuj poprawkę do modelu",
ukrywanie paczki (kontener `TO-paczka/2` — gotowe w M0), podgląd „tylko dla organizatora" z ręczną edycją i zapisem
`modyfikacje[]`, odwrotna geokodacja nazwy miejsca (wyłączalna).
Kryterium: pełna pętla przechodzi z prawdziwym modelem (test właściciela),
a odrzucona paczka daje czytelną listę usterek.

**Kod M5 gotowy (2026-09-06):** `protokol.zastosujEdycjePaczki(paczka, edycje)`
— atomowa edycja pól z `EDYTOWALNE_POLA` z zapisem `modyfikacje[]`
(kształt PROTOKOL §3.1); podgląd „tylko dla organizatora" z kartami pytań
(treść, cztery odpowiedzi, wyjaśnienie, źródła) i pełną re-walidacją po
każdym zapisie — usterki blokują ukrycie paczki; eksport ukrytej paczki do
pliku `okolica-<kod>.paczka.json` (kontener `TO-paczka/2`, nigdy plaintext,
ADR 0010 pkt 3) z importem istniejącą ścieżką „⬆ Z pliku"; instrukcja
obrazkowa promptu jako cztery inline SVG (ADR 0001 pkt 1); zapasowa nazwa
miejsca z Nominatim — opt-in na ekranie prywatności, domyślnie WYŁĄCZONA,
jedno żądanie na sesję, obowiązkowy cache `okolica:miejsce:<geohash6>`
(30 dni), atrybucja ODbL, endpoint przełączalny bez aktualizacji aplikacji
(ASSETS §3, ADR 0013 pkt 2). Przy okazji naprawiony bug bramy
`konfig.geokodacja` (checkbox w setupie był dekoracyjny — ADR 0013 pkt 3).
Brama: 332 testy, 0 fail; cache-busting `?v=m5-1`.
**Zostało na M5:** kryterium właściciela — pełna pętla z prawdziwym modelem
AI (prompt → odpowiedź → walidacja → ukrycie → eksport/import), razem
z zaległymi M3 (360 px) i M4 (prawdziwa okolica).

## M6 — Rozgrywka

Pętla stacji: ekran „kto idzie" → start odcinka → mapa z dystansem → dojście
(albo tryb ręczny z karą) → pytanie odsłonięte w chwili dojścia →
odpowiedź → wyjaśnienie + źródła → następna stacja. Pauza/wznowienie, koniec
gry, przerwanie i zapis stanu.
Kryterium: gra przechodzalna od setupu do wyniku na telefonie, z utratą
zasięgu w trakcie (cache) i z zamknięciem przeglądarki (wznowienie).

**Kod M6 gotowy (2026-09-06):** ekran gry to jeden `ekran-gra` z czterema
panelami faz (kolejka → odcinek z mapą/dystansem/progiem dojścia → pytanie →
wynik), wspólny lej fixów GPS i symulacji (`przyjmijFix`), dojście przez
`stanDojscia` (próg + dwa kolejne trafienia, ADR 0004 pkt 2) albo ręczne
z karą, pauza (także automatyczna po schowaniu karty — `visibilitychange`),
pominięcie stacji w drodze i ręczne zakończenie z wczesnym wynikiem
(dwustopniowe, bez `confirm()`, ADR 0015 pkt 6). Pytanie odsłania się
z kontenera `TO-paczka/2` DOPIERO w tranzycji do fazy pytanie — `STAN.paczka`
jest kasowany przy starcie gry (ADR 0007 pkt 4/6); po odpowiedzi na ekranie
zostają ocena, wyjaśnienie i klikalne źródła. `app/trwalosc.js` (snapshot
`stan-gry/1`, walidacja atomowa `T01`–`T10`, budżet 2 MB, strażnik anty-
plaintext): zapis po KAŻDEJ tranzycji synchronicznie do `localStorage`
(`beforeunload` jest na telefonach zawodny), baner wznowienia na setupie
(`okolica:gra-aktywna` + `okolica:gra:<kod>`), wznowienie z rebazą osi czasu
(`zegarMs`: czas zamknięcia karty nie wlicza się w odcinek, ADR 0004 pkt 3),
dwustopniowe kasowanie zapisu. Testy integracyjne: pełna gra 3 stacje
z dojściem symulacją (ścieżka GPS, zero klików „ręcznie"), zero żądań
sieciowych w trakcie gry (utrata zasięgu), stacja bez pytania zamyka się
samym dojściem (ADR 0015, z zapisu), wznowienie w nowej instancji aplikacji
na tej samej pamięci. Przy okazji złapany prawdziwy wyścig: symulacja dojścia
nie gasła po tranzycji fazy i nadpisywała status gry (LESSONS L22).
Brama: **358 testów**, 0 fail + szablon promptu zgodny; cache-busting
`?v=m6-1`.
**Zostało na M6:** kryterium terenowe właściciela (`WORKFLOW` §4.2) — pełna
gra NA TELEFONIE od setupu do wyniku, z utratą zasięgu w trakcie i z
zamknięciem przeglądarki (wznowienie); razem z zaległymi kryteriami M3
(360 px), M4 (prawdziwa okolica) i M5 (pętla z prawdziwym modelem).

## M7 — Podsumowanie, punkty i udostępnianie

Wyniki per gracz (punkty, czasy, poprawne odpowiedzi), medal/punkty za
sprawiedliwość trasy, eksport wyniku (tekst/obraz), historia gier
(`okolica:historia`).
Kryterium: podsumowanie czytelne w słońcu na 360 px; eksport działa na Chrome
Android i Safari iOS.

**Kod M7 gotowy (2026-09-06):** pełne podsumowanie w `gra-panel-koniec`:
karta zwycięzcy (🏆, punkty, rozbicie „podstawowe + premie"), ranking
(punkty, poprawne/błędne, czas odcinków), karty graczy (odcinki, dystans,
tempo, ręczne dojścia, po limicie), tabela stacji (kto, stan, tryb dojścia
GPS/ręczne, zmierzony czas albo kreska przy pominięciu), statystyki gry
i medal sprawiedliwości trasy — `wynik.sprawiedliwoscTrasy()` (pole
`dystansSieciowyM` gdy którakolwiek stacja ma sieciowe, inaczej proste;
udział odchylenia ≤ 0,15 = „🏅 Uczciwa trasa") — widokowy, NIE wpływa na
punkty (ADR 0014). Na ≤ 360 px tabele składają się w karty. Eksporty:
`app/wynik.js` (czysty, bez DOM) — tekst `wynikTekstowy()` (wiersze stacji
bez `#`, żeby `#1` nie stawało się nagłówkiem w komunikatorach), obraz
`planObrazuWyniku()` → PNG 1080 px (plan komend odwołuje się WYŁĄCZNIE do
ról palety `ROLE_PALETY`; kolory rozwiązane z tokenów CSS w chwili eksportu,
paleta awaryjna przy braku), przyciski Web Share → schowek → plik .txt/.png
(plik zawsze, share chowany, gdy niedostępny). Prywatność: ani treści pytań,
ani współrzędnych w eksportach i w historii (testy-strażnicy). Historia
`okolica:historia` (`historia/1`, wpis `historia-gra/1`, limit 50): jeden
skrót na klucz gry — zastąpienie idempotentne; ręczne zakończenie zapisuje
wpis `przerwana:true`, naturalne dokończenie go zastępuje; karta „Poprzednie
gry" na setupie (najnowsza pierwsza), dwustopniowe kasowanie, zepsuty zapis
jawny kodami `H01`–`H04`. Integracja end-to-end: pełna gra z dojściem GPS
(symulacja ×3 stacje) → podsumowanie z prawdziwą punktacją, eksporty i wpis
historii. Brama: **383 testy**, 0 fail + szablon promptu zgodny;
cache-busting `?v=m7-1`.
**Zostało na M7:** kryteria terenowe właściciela (`WORKFLOW` §4) —
podsumowanie czytelne w słońcu na 360 px; eksport (share/schowek/plik/obraz)
na Chrome Android i Safari iOS; razem z zaległymi kryteriami M3 (360 px),
M4 (prawdziwa okolica), M5 (pętla z prawdziwym modelem) i M6 (pełna gra
na telefonie).

## M8 — Publikacja i brama jakości

`.nojekyll`, `assets/manifest.json` + ikony, instrukcja włączenia Pages
(`docs/WORKFLOW.md` §5), testy kontraktowe wersji i ścieżek względnych, audyt
polityk dostawców (`docs/ASSETS.md`). CI **już działa** — przyspieszone z M8
na prośbę właściciela (2026-09-06): `.github/workflows/ci.yml` z receptury,
lustro w `docs/setup/ci-workflow.yml` pilnowane kontraktem (LESSONS L4, aneks).
Kryterium: aplikacja działa pod `https://<user>.github.io/okolica/` na telefonie.
Zakres zrealizowany 2026-09-06 (brama 400/400, audyt dostawców w `ASSETS.md` §6);
samą publikację włącza jednorazowo właściciel (`WORKFLOW.md` §5) — to ostatni
krok kryterium, poza zasięgiem agenta (403 na ustawieniach repo).

## M9 — Repozytorium paczek pytań — ✅ ZREALIZOWANE (2026-09-06, z rewizją M9b)

Eksport/import paczek per okolica, indeks geohash-5, prywatne repo paczek
właściciela, publikacja wybranych paczek po przeglądzie źródeł (ADR 0008 pkt 6,
ADR 0010 pkt 4) — **wymaga nowego ADR przed wdrożeniem** (prywatność geohashu,
licencja treści, moderacja).
Kryterium: druga gra w tej samej okolicy nie woła modelu.
Zakres zrealizowany 2026-09-06 (ADR 0017, brama 421/421): kopia lokalna po
każdej grze, karta propozycji na ekranie pozycji, publiczne `data/paczki/`
z indeksem i bramą publikacji, pierwsza paczka kuratorowana (Podkowa Leśna,
źródła zweryfikowane) jako KANDYDAT do przeglądu właściciela. Kryterium
pokryte testami przepływu (`test/zestawy-ui.test.js`): start z paczki = zero
modela, zero Overpassa. **Rewizja właściciela (2026-09-06, M9b):** plikowe repozytorium `data/paczki/`
USUNIĘTE z repozytorium kodu — współdzielone paczki żyją na wydzielonym koncie
Google Drive z mostem Apps Script (ADR 0016 → Zaakceptowana, ADR 0017,
ADR 0018). Zrealizowane w M9b (plan `plans/2026-09-06-m9b-most-drive.md`):
kod mostu + instrukcja (D1), automatyczna wysyłka zestawu przy przyjęciu
z checkboxem zgody na ekranie wklejania — domyślnie zaznaczonym (D2/D3),
indeks Drive z `id` + przycisk „🔌 Sprawdź połączenie" (D4), testy (D5,
brama 428/428), dokumentacja (D6). Wdrożenie mostu przez właściciela ODROCZONE
do końca kodowania; instrukcja finalna — w czacie (ADR 0018). Kryterium M9
(„druga gra w tej samej okolicy nie woła modelu") działa już dziś kopią
lokalną, a po wdrożeniu mostu — także paczkami z Drive.

## M10 — Dopracowanie terenowe

Service Worker (offline: kafelki ostatniej okolicy + paczka), strategia
oszczędzania baterii („budzenie przy zbliżaniu"), tryb nocny, dźwięk/wibracja
przy dojściu, dostępność (WCAG AA audyt), testy w terenie i poprawki progów
(ADR 0004) — wyniki w `docs/LESSONS.md`.
Zakres zrealizowany 2026-09-06 (plan `plans/2026-09-06-m10-dopracowanie-terenowe.md`,
brama 450/450): `sw.js` (skorupa + kafelki cache-first z ewikcją, testy
harnessem), profile baterii `PROFILE_GPS` z histerezą 250/150 m
(`profilBaterii`), sygnały dojścia/odcinka/odpowiedzi (`app/sygnaly.js` +
Web Audio + vibrate, przełącznik „🔔"), audyt kontrastu WCAG AA jako brama
(`tools/audyt-kontrastu.mjs`, 0 naruszeń w obu motywach), checklista terenowa
`WORKFLOW.md` §4.3. Tryb nocny ISTNIAŁ od M7 (`przycisk-motyw`) — zweryfikowany
audytem. KRYTERIUM TERENOWE: test właściciela wg §4.3 (offline, bateria,
sygnały w hałasie, progi dojścia) — wynik do LESSONS, korekta progów w razie
potrzeby.

## M11 — Gra wieloosobowa na wielu urządzeniach przez Drive (decyzje właściciela: ADR 0019)

Parowanie DWIEMA drogami: lobby z grami w najbliższej okolicy (geohash5) ORAZ
6-znakowy kod gry do przekazania. Oba tryby rozgrywki: wyścig równoległy i
tury asynchroniczne (hot-seat zostaje jako tryb offline — aneks ADR 0009).
Synchronizacja ZDARZENIAMI bez współrzędnych (ADR 0013/0019); stan gry
`RO-gra/1` na Drive; most waliduje spójność (kolejność tur, stacje, czasy),
bez antycheatu (gra dla znajomych). Plan:
`plans/2026-09-06-m11-m12-gra-wieloosobowa-i-rankingi.md`.

## M12 — Profil, statystyki i rankingi gracza na Drive (decyzje właściciela: ADR 0019)

Pseudonim (lokalnie `okolica:pseudonim`) + wyniki gier + pełna historia na
Drive + rankingi liczone przez most z gier zakończonych: ogólny oraz kategorie
WIEK, TEMATY i LOKALIZACJA (np. „najlepsi w Podkowie Leśnej" — geohash5/miejsce
z meta gry). Prywatność: jawna zgoda przy zakładaniu/dołączaniu do gry
(wymagana dla trybu wieloosobowego). Zależy od M11 (wspólny stan i zdarzenia).

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
