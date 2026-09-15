# 0005 — Stacje z sieci drogowej (Overpass API): kandydaci, filtry dostępności, wybór sprawiedliwy pod ziarnem

- Status: Proponowana (największe ryzyko techniczne projektu — do potwierdzenia po M4)
- Data: 2026-09-05

## Kontekst

Właściciel: punkty docelowe muszą być **osiągalne** (nie na prywatnej działce,
nie w budynku, nie na środku jezdni), a odległości między punktami dla różnych
graczy **podobne — sprawiedliwe**. Nie wiemy z góry, gdzie gracz jest, więc
dane o sieci dróg, placów i szlaków trzeba pobrać dla jego okolicy. Aplikacja
nie ma backendu (ADR 0001/0006), więc dane pobiera przeglądarka użytkownika.

## Decyzja

1. **Źródło danych: Overpass API** — instancja główna
   `overpass-api.de/api/interpreter`, z przełączeniem na
   `overpass.private.coffee`, a potem na `maps.mail.ru` przy `429`/`504`/timeout
   (pauza 30 s między próbami; sekwencyjnie, nigdy równolegle). Limity i
   polityka: `docs/ASSETS.md` §2 — w szczególności **jedno zapytanie na grę**
   i cache z TTL. Jedno zapytanie wokół pozycji startowej w promieniu
   `R × 1.15` zwraca:
   - drogi i szlaki: `way["highway"]` (klasy zależne od trybu — pkt 3),
   - miejsca publiczne: `node|way["amenity"]`, `["tourism"]`, `["historic"]`,
     `["leisure"~"park|playground|garden"]`, `["place"="square"]`,
     `["natural"~"peak|waterfall|tree"]`,
   - budynki: `way["building"]` — jako **poligony wykluczeń**,
   - ograniczenia: `["access"~"private|no"]`, `["foot"="no"]`, bramy i barierki
     `node["barrier"]`,
   - obszary administracyjne (`is_in(lat,lon)` → `area["boundary"="administrative"]`)
     — nazwa miejsca do promptu (`{MIEJSCE}`), żeby nie wołać Nominatim
     (`docs/ASSETS.md` §3).
2. **Model danych**: z odpowiedzi Overpass budujemy w pamięci **graf sieci**
   (węzły po `id`, krawędzie z `way` z atrybutami klasy i dostępności) oraz
   listę kandydatów. Budowa grafu i wyszukiwanie w nim to czyste funkcje
   (`app/sieci.js`) — testowalne w Node na fixture'ach (`test/fixtures/overpass-*.json`),
   bo sandbox nie ma dostępu do Overpass (LESSONS L3).
3. **Kandydaci na stacje, zależnie od trybu**:
   - *pieszy*: wierzchołki i punkty co ~50 m wzdłuż `highway` ∈ {footway, path,
     pedestrian, steps, living_street, residential, service, track, cycleway},
     plus POI z wejściem z takiej drogi, plus place i parki;
   - *rower*: powyższe + `cycleway`, `residential`, `tertiary`,
     `unclassified`; wykluczone `steps`;
   - *samochód*: węzły przy `highway` ∈ {residential, tertiary, secondary,
     primary, unclassified, service} **ale stacją jest parking albo POI
     z dojazdem** (`amenity=parking`, `parking=*`) — nie punkt na jezdni;
   - wspólne wykluczenia: wewnątrz poligonu budynku, `access=private`,
     `foot=no` (dla pieszego/roweru), tunel/autostrada/droga ekspresowa,
     teren kolejowy (`landuse=railway`), prywatne `service=parking_aisle` bez
     dostępu publicznego.
4. **Odległości = sieciowe, nie w linii prostej**: `dijkstra(graf, start)` po
   krawędziach dostępnych dla trybu, start snapowany do najbliższego
   dopuszczalnego węzła. Sprawiedliwość liczy się na dystansie sieciowym —
   w linii prostej 800 m bywa 3 km przez rzekę bez mostu.
5. **Wybór stacji (algorytm `wybierzStacje`)**:
   - pierścień docelowy: `r = R × 0.7` (konfigurowalne), rozrzut ±20% — od
     aneksu 2026-09-09 to **preferencja w sorcie**, a granicą jest zakres
     `[0.35 × R, R]` (patrz aneks na końcu);
   - greedy po kandydatach sortowanych wg `|d_sieci − r|`, z **separacją
     kątową** od startu ≥ `0.7 × 360°/N` i separacją sieciową między sąsiednimi
     stacjami ≥ `0.5 × r`;
   - pass poprawkowy: zamiany parami minimalizujące odchylenie standardowe
     `d_sieci` między stacjami (to jest miara „sprawiedliwości") oraz karzące
     pary stacji bliższe sobie niż `0.3 × r`;
   - wynik: N stacji + macierz odległości + ścieżki sugerowane (do pokazania
     na mapie jako linie, nie jako nawigacja krok-po-kroku).
6. **Determinizm i ziarno**: cały wybór jest funkcją `(dane z Overpass,
   konfiguracja, ziarno)`. Ziarno = `okolica:<lat zaokr. do 5 m>:<lon>:<R>:<N>:<data gry>`
   (+ opcjonalnie kod organizatora). Ta sama okolica i konfiguracja dają ten sam
   układ — powtarzalność rozgrywki i **testowalność algorytmu** na fixture'ach.
   Losowość (gdy potrzebna) z `mulberry32(ziarno)`, nigdy z `Math.random()`.
7. **Cache**: wynik zapytania i wybrane stacje trafiają do `localStorage`
   pod kluczem siatki geohash-6 + R (ADR 0010), z TTL 30 dni — ta sama okolica
   nie woła Overpass drugi raz. Docelowo: publiczne repozytorium paczek
   (ADR 0010 pkt 4).
8. **Degradacja bez Overpass** (offline, limit instancji, blokada):
   a) użyj cache, jeśli jest;
   b) zaproponuj **ręczne ustawienie stacji** przeciąganiem pinezek na mapie
      (aplikacja pokazuje dystans sieciowy tylko w linii prostej i ostrzega);
   c) nigdy nie udawaj, że punkty są osiągalne — komunikat jest częścią UI.

## Konsekwencje

- Zależność od publicznej usługi w trakcie gry (ryzyko: limity, wolne
  odpowiedzi). Mitygacja: cache, więcej instancji w `docs/ASSETS.md` z
  przełączaniem po błędzie, timeout 20 s + degradacja pkt 8.
- Overpass zwraca dla promienia 10 km w gęstym mieście kilka MB — dlatego
  zapytanie jest jedno, z `[out:json][timeout:25]`, i filtrowane po naszej
  stronie; dla samochodu (R = 10 km) trzeba uważać na rozmiar (BACKLOG:
  `bbox` dzielony na ćwiartki).
- Algorytm jest najtrudniejszą częścią projektu — dostaje własny plan
  (`docs/plans/`) i testy na trzech fixture'ach: centrum miasta, przedmieście,
  teren leśny. **Kryterium jakości: żadna wygenerowana stacja nie leży
  w budynku ani na terenie prywatnym w żadnym z fixture'ów.**
- Punktacja i „sprawiedliwość" są mierzalne (odchylenie standardowe dystansów)
  → da się je pokazać w podsumowaniu gry jako uczciwość trasy.

## Powiązania

0001 (czyste funkcje, brak backendu), 0003 (rysunek stacji), 0004 (kryterium
dojścia), 0009 (przypisanie stacji do graczy), 0010 (cache), 0013 (wysyłamy
tylko przybliżoną pozycję do Overpass).

## Aneksy starsze są w archiwum (poza budżetem lektury)

- Trzy aneksy z 2026-09-09 (zakres od startu i drabinka kątowa; separacja w obu
  metrykach i układ zamiast zachłanności; pauza limitowa 30 s → 1 s) są
  przeniesione do `docs/decisions/archive/aneksy-0005-2026-09-09.md`
  (L62/L66, archiwizacja 2026-09-14, m12-119).
- Aneksy 2026-09-14 m12-115 – m12-119 (Held-Karp i `optymalnaKolejnosc`;
  twarde wejście w pętlę; metryka porządkowania jest jedna; brama wejścia —
  pin mijany; trasowanie po układzie ulic, bez korytarzy) są przeniesione do
  `docs/decisions/archive/aneksy-0005-2026-09-14-m12-115-do-119.md`
  (L62/L66, archiwizacja 2026-09-14: m12-121 i m12-122).
## Aneks 2026-09-14 (m12-120) jest w archiwum (poza budżetem lektury)

Pełny układ ulic dla pieszego i roweru (klasy tranzytowe poza motorway/trunk)
— `docs/decisions/archive/aneksy-0005-2026-09-14-m12-120.md`. Reguła obowiązuje
i jest streszczona w LESSONS L71; pomiary i odrzucony wariant leżą w archiwum.

## Aneks 2026-09-15 — ekran stacji bez spisu (uwaga 5)

Właściciel: „Na tej stronie w ogóle nie potrzebuję spisu tych stacji. Najlepiej
dawaj zawsze informację: «Wygenerowano i zlokalizowano X stacji.» Reszta bez
zmian."

Od teraz `#ekran-stacje` pokazuje jedno zdanie w `#stacje-podsumowanie`:

- sieć dróg: `Wygenerowano i zlokalizowano <N> stacji.`
- układ pierścieniowy (degradacja, brak Overpass): `Wygenerowano <N> stacji.`
  — bez słowa „zlokalizowano", bo przy braku sieci dróg byłoby to nieprawdą
  (LESSONS L6); powód stoi w `#stacje-tryb` tuż obok i się nie zmienił.

Tryb tajnej trasy (ADR 0034) zostaje przy swoim zdaniu („…Nazwy i położenie są
ukryte…") — właściciel wyłączył go z tej zmiany. Mapa, pinezki, przyciski
„Inny układ"/„Pobierz sieć ponownie"/„Ustaw stacje ręcznie" i przewijanie panelu
są bez zmian; przeciąganie pinezki w trybie ręcznym widać na mapie, nie w spisie.

