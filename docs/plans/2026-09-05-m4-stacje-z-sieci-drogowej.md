# Plan kamienia M4 — stacje z sieci drogowej (Overpass API)

- Data: 2026-09-05
- Kamień: `docs/ROADMAP.md` M4 (największe ryzyko techniczne projektu)
- Podstawa: ADR 0005 (*Proponowana* — część kodową budujemy zgodnie
  z instrukcją właściciela; status zmienia się po teście terenowym), ADR 0010
  pkt 1 (cache `okolica:sieci:<geohash6>-<R>`, TTL 30 dni, LRU przy 2 MB),
  `docs/ASSETS.md` §0/§2 (instancje, polityka, Referer zamiast UA),
  `docs/ARCHITECTURE.md` przepływ A.3–A.4.
- Instrukcja właściciela (2026-09-05): *„Nie mam teraz jak testować, więc koduj
  to co się da kodować. Wrócimy do tych pytań."* → M3 zostaje w weryfikacji
  §4.2 (nie blokuje M4); kryterium terenowe M4 też odkładamy do powrotu
  właściciela.

## Kroki (litera I)

- [x] **I1 — plan** (ten plik).
- [x] **I2 — fixture'y Overpass:** generator `tools/generuj-fixture-overpass.mjs`
      (deterministyczny, mulberry32 z jawnym ziarnem) + trzy fixture'y pod
      kontrolą wersji: `test/fixtures/overpass-centrum.json`,
      `overpass-przedmiescie.json`, `overpass-las.json`; kontrakt formatu
      (Overpass `[out:json]` po `out geom`: way'e z `geometry[]`, POI/bariery
      jako node z `lat`/`lon`, obszary administracyjne jako `area`).
- [x] **I3 — `app/sieci.js` cz. 1:** `INSTANCJE_OVERPASS` + polityka
      przełączania (429/504/timeout/błąd sieci → następna instancja, odstęp
      30 s — jako czyste dane/funkcje), `budujZapytanieOverpass()` (jedno
      zapytanie `around:R×1.15`, klasy dróg z `TRYBY`, budynki, POI,
      ograniczenia, bariery, obszary `is_in` do `{MIEJSCE}`),
      `parsujOdpowiedz()` (normalizacja + kody usterek, tolerancja braków).
- [ ] **I4 — `app/sieci.js` cz. 2:** `budujGraf()` (węzły = wierzchołki OSM
      + punkty interpolowane co ≤ 50 m wzdłuż dostępnych way'ów; waga krawędzi
      = metry; budżet węzłów z krokiem awaryjnym), `dijkstra()` (kopiec
      binarny, czysty JS), `snapujPunkt()` (najbliższy dopuszczalny węzeł).
- [ ] **I5 — `app/sieci.js` cz. 3:** `kandydaciNaStacje()` zależnie od trybu
      (ADR 0005 pkt 3) + filtry wykluczeń: wnętrze poligonu budynku
      (ray-casting z prefiltrem bbox), `access=private|no`, `foot=no`
      (pieszy/rower), `tunnel=yes`, autostrada/expresówka, `landuse=railway`,
      prywatne `service=parking_aisle`.
- [ ] **I6 — `app/stacje.js`:** `wybierzStacje({ graf, kandydaci, srodek,
      konfig, ziarno })` — pierścień docelowy `0.7 R ±20%`, greedy po
      `|d_sieci − r|`, separacja kątowa ≥ `0.7 × 360°/N`, separacja sieciowa
      sąsiednich ≥ `0.5 r`, pass wyrównujący (zamiany parami: minimalizacja
      odchylenia standardowego `d_sieci` + kara za pary < `0.3 r`); wynik:
      N stacji (`zrodlo: 'siec'`, `dystansSieciowyM`, ścieżka), macierz
      odległości, sprawiedliwość sieciowa. `miaraSprawiedliwosci` dostaje
      parametr `{ pole }` (domyślne `odlegloscM` — dotychczasowe testy bez
      zmian). **Kryteria na trzech fixture'ach:** żadna stacja w budynku ani
      na terenie prywatnym; `udzialOdchylenia` dystansów sieciowych ≤ 0.15;
      determinizm pod ziarnem.
- [ ] **I7 — `app/app.js`:** pobieranie z łańcuchem instancji (sekwencyjnie,
      timeout 20 s, komunikaty z kodami), cache `okolica:sieci:<geohash6>-<R>`
      (TTL 30 dni, LRU ≤ 2 MB, współrzędne zaokrąglone do 6 miejsc),
      wpięcie w ekran „stacje": najpierw próba sieci, degradacja do
      `stacjeProste` z **jawnym ostrzeżeniem** (ADR 0005 pkt 8), `{MIEJSCE}`
      z obszaru administracyjnego; testy na atrapie `fetch`.
- [ ] **I8 — ręczne ustawianie stacji** (degradacja pkt 8b): przeciąganie
      pinezek na mapie, `zrodlo: 'reczne'`, dystans tylko w linii prostej
      + ostrzeżenie w UI; start/stop trybu ręcznego, testy na atrapie.
- [ ] **I9 — dokumentacja i zamknięcie części kodowej:** `ARCHITECTURE`
      (sieci.js zgodnie ze stanem faktycznym), `ROADMAP` M4 (kod gotowy,
      teren — właściciel), `PROJECT_HISTORY`, `LESSONS` jeśli coś zaskoczy,
      handoff, aktualizacja PR #2.

## Decyzje projektowe (podczas pisania planu)

1. **Format fixture'ów:** odpowiedź Overpass po `out geom` — way niesie
   `geometry[]` (bez osobnych szkiletów node), więc fixture jest zwarty
   i samowystarczalny. Generator jest w repo (jak `synchronizuj-szablon.mjs`),
   fixture'y wersjonowane — odtwarzalne jednym poleceniem.
2. **Graf z interpolacją:** kandydaci „co ~50 m" (ADR 0005 pkt 3) są węzłami
   grafu (podział długich krawędzi), więc `dijkstra` zwraca od razu dystans
   sieciowy kandydata — bez osobnego snapowania na potrzeby wyboru.
3. **Kopiec binarny** w `dijkstra` — dla R = 10 km graf realny ma dziesiątki
   tysięcy węzłów; skan liniowy O(V²) nie mieści się w budżecie telefonu.
4. **Fetch w przeglądarce nie ustawi `User-Agent`** (ASSETS §0) — automatyczny
   `Referer` z adresu Pages spełnia politykę FOSSGIS („UA **albo** Referer").
   Odstęp 30 s i kolejność instancji liczy warstwa UI, polityka jest czysta.
5. **Budżet odpowiedzi:** jedno zapytanie `[out:json][timeout:25]`; odpowiedź
   > ~8 MB → nie cache'ujemy i ostrzegamy (ćwiartkowanie bbox dla samochodu
   zostaje w BACKLOG — nie implementujemy w ciemno, bez realnych danych).
6. **Cache:** wartość `{ schemat, zapisanoMs, promienM, dane }`; LRU po
   `zapisanoMs` z progiem 2 MB (ADR 0010 pkt 1); `schemat: 'sieci/1'` —
   nieznana wersja = jawny komunikat, nie ciche odrzucenie.
7. **Budynki:** lista poligonów z bbox-em; filtr kandydatów: najpierw bbox,
   potem ray-casting — porządek wielkości szybciej na gęstym centrum.

## Ryzyka

- **Realny Overpass vs fixture:** parser ma tolerować way bez `geometry`
  (refs-y — wtedy tylko wierzchołki), brak tagów, nieznane wartości
  `highway` (traktuj jako niedostępne, nie rzucaj). Na garbage — kod usterki,
  nie `TypeError` z wnętrza pętli.
- **Wydajność na realnych danych** (tryb samochodowy, MB odpowiedzi):
  budżet węzłów grafu z powiększaniem kroku interpolacji; test na fixture'ach
  + pomiar w terenie (właściciel).
- **Regresja M3:** 249 testów to brama — prywatność i symulacja nie mogą się
  zepsuć przy rozbudowie `app.js`.
- **Kryterium terenowe M4** (realna okolica, realny Overpass) — poza zasięgiem
  sandboxa (LESSONS L3); część kodowa zamyka się fixture'ami i atrapą, ✅
  w ROADMAP dopiero po terenie (jak przy M2/M3).

## Kryteria ukończenia (części kodowej)

1. `npm run brama` zielone (≥ 249 testów + nowe).
2. Na **trzech** fixture'ach: żadna stacja w budynku ani przy
   `access=private`/`foot=no`; `udzialOdchylenia` dystansów sieciowych ≤ 0.15.
3. Determinizm: te same (dane, konfiguracja, ziarno) → identyczny układ;
   `Math.random()` nie pojawia się w nowych modułach.
4. Parser i graf rzucają **kodami usterek** na zepsute dane, a braki opcjonalne
   tolerują.
5. UI: ekran „stacje" próbuje sieci → przy braku (offline/limit/błąd)
   degraduje do pierścienia z ostrzeżeniem; trafienie w cache nie woła sieci
   (test na atrapie `fetch`).
