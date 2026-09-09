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

## Aneks 2026-09-09 — zakres od startu i drabinka kątowa

Właściciel po próbie ułożenia gry w terenie: „na danym terenie nie dało się
wcisnąć więcej niż 4 stacje". Diagnoza na fixture `overpass-przedmiescie`
(R = 1000 m, 104 kandydatów) potwierdziła objaw co do jednego: przy N ≥ 5
algorytm oddawał 4 stacje i usterkę S12. Poluzowanie pojedynczych progów
pokazało winnego — separację kątową (bez niej: komplet).

**Zmiana 1 — dystans od startu to zakres `[0.35 × R, R]`, nie pasmo `r ±20%`.**
Właściciel: „skoro R=1000m to wyobrażam sobie stacje oddalone od 350m do 1000m
od miejsca startu (skoro promień to 1000m to czemu zatrzymujemy się na 840m?)".
Pasmo 0.8r–1.2r odrzucało kandydatów, choć promień gry jawnie na nich pozwalał.
Pasmo zostaje jako **preferencja**: sort nadal ciągnie stacje do `r`, więc układ
pozostaje pierścieniem, ale kandydat 950 m przy R = 1000 m jest dziś legalny.
Dolna granica `0.35 × R` to nie nowa liczba: `0.5 × r = 0.5 × 0.7 × R`, czyli
dokładnie separacja sieciowa — „nie bliżej niż 350 m" znaczy to samo od startu
i między stacjami (spójność, o którą prosił właściciel w pkt 2b).

**Zmiana 2 — drabinka ustępstw kątowych `[0.7, 0.5, 0.35, 0.2, 0]`.**
Właściciel: „w ogóle nie widzę sensu w tej separacji kątowej (…) jeśli
koniecznie chcesz to utrzymać to możesz zrobić jakąś drabinkę priorytetów — od
dzisiejszego kąta stopniowo aż do braku wymaganego kąta".

Zachowujemy kąt jako preferencję, bo pełni realną funkcję: rozkłada stacje
wokół startu, dzięki czemu trasa jest pętlą, a nie marszem tam i z powrotem tą
samą ulicą. Ale przestaje być wetem. Algorytm próbuje kolejnych szczebli i
schodzi niżej **tylko** gdy nie zebrał kompletu N; przy gęstej sieci zostaje na
0.7 (pinowane testem). Każdy szczebel liczy się od zera na tej samej
posortowanej liście kandydatów, więc wynik nie zależy od kolejności prób.

**Co NIE ustępuje nigdy:** separacja sieciowa `0.5 × r` i zakres dystansu od
startu. To one gwarantują, że stacje nie stoją jedna na drugiej — kąt tylko je
rozkłada. Wynik zwraca `separacje: { katMinStopnie, szczebelKatowy, ustapiono,
siecMinM }`, więc UI i diagnoza wiedzą, czy i jak bardzo ustąpiono.

**Efekt na fixture'ach** (N = 8): przedmieście 4 → 8 stacji, centrum 8 → 8
(bez ustępstwa), las 6 → 6 (sieć realnie nie ma więcej miejsc). Usterka S12
nadal istnieje i nadal jest uczciwa — pojawia się dopiero wtedy, gdy sieć
naprawdę nie ma gdzie postawić kolejnej stacji.

## Aneks 2026-09-09 — rozrzut stacji: separacja w obu metrykach, układ zamiast zachłanności

Właściciel: stacje wychodzą skupione — „widzę pinezki obok siebie i całą grę po
jednej stronie startu\". Diagnoza wskazała **dwie niezależne przyczyny**.

**1. Separacja liczona wyłącznie po sieci.** Próg `0.5 × r` sprawdzaliśmy na
odległości drogowej, więc dwa punkty rozdzielone rzeką albo torami spełniały go
przy 103 m w linii prostej (krętość do 3,2×). Gracz widzi mapę, nie graf, więc
próg musi obowiązywać **w obu metrykach naraz**: doszedł `separacjaProstaUdzial
= 0.5` sprawdzany na `odlegloscM`. Efekt na fixture'ach (minimalna para na
mapie): przedmieście N=10 121 → 398 m, centrum N=10 103 → 212 m, las N=6
427 → 833 m. Ceną są 1–2 stacje mniej tam, gdzie sieć jest uboga — uczciwiej niż
dwie pinezki w jednym kwartale.

**2. Zbieranie „pierwszy pasujący\".** Kandydaci szli posortowani po `score`, a
kąt był tylko wetem, więc komplet N wypełniał się z jednego łuku i zostawiał
pustą lukę 119° przy ideale 72°. Zamiast tego `zbierzUkladem` robi **farthest-
point sampling po kącie**: pierwsza stacja wg `score`, każda kolejna maksymalizuje
kąt do już wybranych. Kąt jest **kubełkowany** (`KUBELEK_KATA = 20°`) — bez tego
sampling gonił dziesiąte części stopnia i rozwalał równość promieni pierścienia
(rozrzut 65,6% przy limicie 35%); po kubełkowaniu remisy rozstrzyga `score`,
więc oba kryteria żyją obok siebie (rozrzut 0,6–10,2%).

**Pass wyrównujący musiał się o tym dowiedzieć.** Optymalizował samo odchylenie
dystansów, więc cofał rozrzut wypracowany przy zbieraniu. `kosztUkladu` ma teraz
trzeci składnik — karę za pustą lukę kątową (`WAGA_LUKI_M_NA_STOPIEN = 2`).
Największa luka: centrum N=8 64° → 50°, przedmieście N=5 119° → 91°.

Trzy testy w `test/sieci.test.js` pilnują obu metryk separacji, luki kątowej
(≤ 2,5× ideału) i rozrzutu pierścienia (≤ 35%). Próg w teście liczy się z
**promienia gry**, nie ze stałej konfiguracji — inaczej wyzerowanie stałej
zerowałoby też oczekiwanie i asercja byłaby pozorna (LESSONS).
