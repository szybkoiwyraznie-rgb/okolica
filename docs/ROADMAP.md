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

## M2 — Mapa

Renderer SVG (Web Mercator, pan/zoom/pinch/przyciski), warstwa kafelków
(OSM Standard / OpenTopoMap / Esri World Imagery — bez kluczy API,
`ASSETS` §1; CARTO odrzucone kwerendą 2026-09-05), marker pozycji z kołem
dokładności, okrąg promienia gry, numerowane pinezki stacji.
Kryterium: mapa działa na 360 px, palec (drag + pinch), podkład widoczny
w live preview, atrybucja zawsze obecna.

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

## M4 — Stacje z sieci drogowej (największe ryzyko)

Overpass: budowa zapytania, graf, Dijkstra, kandydaci, filtry dostępności,
wybór stacji (pierścienie + separacja + pass wyrównujący), cache geohash,
degradacja bez Overpass i ręczne ustawianie stacji.
Kryterium: na trzech fixture'ach (centrum / przedmieście / las) żadna stacja
w budynku ani na terenie prywatnym; odchylenie standardowe dystansów ≤ 15%
średniej; sprawdzone **w terenie** na co najmniej jednej okolicy.

## M5 — Pętla pytań (prompt → model → walidacja → paczka)

Ekran promptu (kopiowanie, import/eksport pliku, instrukcja obrazkowa),
walidacja z kodami E01–E20 i przyciskiem „skopiuj poprawkę do modelu",
ukrywanie paczki (kontener `TO-paczka/2` — gotowe w M0), podgląd „tylko dla organizatora" z ręczną edycją i zapisem
`modyfikacje[]`, odwrotna geokodacja nazwy miejsca (wyłączalna).
Kryterium: pełna pętla przechodzi z prawdziwym modelem (test właściciela),
a odrzucona paczka daje czytelną listę usterek.

## M6 — Rozgrywka

Pętla stacji: ekran „kto idzie" → start odcinka → mapa z dystansem → dojście
(albo tryb ręczny z karą) → pytanie odsłonięte w chwili dojścia →
odpowiedź → wyjaśnienie + źródła → następna stacja. Pauza/wznowienie, koniec
gry, przerwanie i zapis stanu.
Kryterium: gra przechodzalna od setupu do wyniku na telefonie, z utratą
zasięgu w trakcie (cache) i z zamknięciem przeglądarki (wznowienie).

## M7 — Podsumowanie, punkty i udostępnianie

Wyniki per gracz (punkty, czasy, poprawne odpowiedzi), medal/punkty za
sprawiedliwość trasy, eksport wyniku (tekst/obraz), historia gier
(`okolica:historia`).
Kryterium: podsumowanie czytelne w słońcu na 360 px; eksport działa na Chrome
Android i Safari iOS.

## M8 — Publikacja i brama jakości

`.nojekyll`, `assets/manifest.json` + ikony, instrukcja włączenia Pages
(`docs/WORKFLOW.md` §5), lustro CI w `docs/setup/ci-workflow.yml`, testy
kontraktowe wersji i ścieżek względnych, audyt polityk dostawców
(`docs/ASSETS.md`).
Kryterium: aplikacja działa pod `https://<user>.github.io/okolica/` na telefonie.

## M9 — Repozytorium paczek pytań

Eksport/import paczek per okolica, indeks geohash-5, prywatne repo paczek
właściciela, publikacja wybranych paczek po przeglądzie źródeł (ADR 0008 pkt 6,
ADR 0010 pkt 4) — **wymaga nowego ADR przed wdrożeniem** (prywatność geohashu,
licencja treści, moderacja).
Kryterium: druga gra w tej samej okolicy nie woła modelu.

## M10 — Dopracowanie terenowe

Service Worker (offline: kafelki ostatniej okolicy + paczka), strategia
oszczędzania baterii („budzenie przy zbliżaniu"), tryb nocny, dźwięk/wibracja
przy dojściu, dostępność (WCAG AA audyt), testy w terenie i poprawki progów
(ADR 0004) — wyniki w `docs/LESSONS.md`.

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
