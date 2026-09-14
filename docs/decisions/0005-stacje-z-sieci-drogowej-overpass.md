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

## Aneksy 2026-09-09 są w archiwum (poza budżetem lektury)

Trzy aneksy z 2026-09-09 (zakres od startu i drabinka kątowa; separacja w obu
metrykach i układ zamiast zachłanności; pauza limitowa 30 s → 1 s) są
przeniesione do  (L62/L66,
archiwizacja 2026-09-14, m12-119). Daty aneksów: 2026-09-09, 2026-09-09,
2026-09-09.


## Aneks 2026-09-14 (m12-115) — kolejność trasy: Held-Karp, eksport `optymalnaKolejnosc`

Kolejność stacji na pętli liczy `optymalnaKolejnosc` w `app/stacje.js`:
programowanie dynamiczne Held-Karp O(N²·2^N) dla N≤10, zachłanność
najbliższego sąsiada dla N>10. Funkcja jest **eksportowana**, żeby testy
(`test/stacje.test.js`) mogły pinować: N≤1, kolinearne, kąt vs dystans,
macierz niesymetryczną i N=11 (greedy). Macierz odległości to `dMiedzy`
(ASCII, bez ogonka) — identyfikator nie zależy od NFC/NFD.


## Aneks 2026-09-14 (m12-116) — twarde wejście w pętlę na wszystkich ścieżkach

Zgłoszenie terenowe (uwaga B, dogrywka): gra kazała minąć stację nr 2
(~100 m od startu), żeby dojść do stacji nr 1 (~300 m), i wracać tą samą
drogą. Diagnoza: wolne TSP minimalizuje SUMĘ, a nie wejście — sonda
(3000 losowych układów) pokazała, że pierwsza stacja wolnego TSP w 61%
nie jest najbliższa startu; paczka z repozytorium w ogóle niosła
kolejność autora bez porządkowania.

Decyzja: `kolejnoscTrasy` (`app/stacje.js`) — stacja 1 to ZAWSZE najbliższa
startu w metryce porządkowania (drogowa, gdy dostępna, inaczej kreska),
reszta optymalna od niej. Obowiązuje na WSZYSTKICH ścieżkach: pierścień,
sieć, wklejka (przed wysyłką na Drive — paczka rodzi się uporządkowana),
paczka z repozytorium (przy starcie, od bieżącej pozycji). Pytania przepina
`uporzadkujGre`: zmienia się tylko pole `stacja`, `id` i `poprawna`
nietknięte (głosy graczy wiszą na `id`). Przestawienie jest jawne w statusie.

Uczciwość: literalna nierówność właściciela d(S,2) ≥ d(S,1)+d(1,2) wynika
z nierówności trójkąta TYLKO współliniowo — nie da się jej spełnić ogólnie.
Reguła wejścia daje jej intencję (na pierwszym odcinku nie mija się stacji
o niższym numerze), a w układzie współliniowym jak zgłoszony nierówność
zachodzi z równością (test pinuje ten przypadek). Świadomy koszt: trasa
bywa o kilka procent dłuższa od wolnego TSP — gwarancja wejścia jest
ważniejsza niż minimalna suma. Przy okazji: start z paczki kasuje
`STAN.wynikSieci` (dystanse drogowe poprzedniej gry nie dotyczą tych stacji).

## Aneks 2026-09-14 (m12-117) — metryka porządkowania jest jedna

Audyt PR #24 (defekt D1): `sprawdzOdpowiedz` wołał `uporzadkujGre` bez
`dystansStart` i `macierz`, więc wklejka porządkowała KRESKĄ nawet wtedy, gdy
stacje wybrała sieć drogowa. Dwa skutki naraz: stacja 1 inna niż na ekranie
stacji i niż w numeracji promptu (twarde wejście złamane w metryce gracza)
oraz `STAN.wynikSieci` zostawiony w STAREJ kolejności — `dystanseOdcinkowM`
przypisywał macierz przestawionym stacjom, więc odcinki dostawały cudze
dystanse, a UI mówił przy nich „drogą".

Decyzja: metryka porządkowania jest JEDNA na całą grę — ta, którą wybrano
stacje. Wklejka podaje `dystansStart` = `dystansSieciowyM` stacji i `macierz`
= `wynikSieci.macierz`; `wybierzStacje` oddaje obie tablice w tej samej
kolejności, więc kolejność sieciowa jest punktem stałym i w zwykłej grze nic
się nie przestawia. Brak albo NaN dystansu sieciowego jednej stacji cofa ją
na kreskę — ta sama reguła co dla pary nieosiągalnej w `kolejnoscTrasy`.
Gdy kolejność jednak się zmieni (piny po dragach, pierścień), `wynikSieci`
kasuje się razem z nią: „kolejność `STAN.stacje` = kolejność `wynikSieci`"
jest warunkiem czytania macierzy, nie zbiegiem okoliczności. Start z paczki
repozytorium zostaje na kresce — plik zestawu niesie `{lat, lon, opis}` bez
danych drogowych, więc metryki drogowej po prostu nie ma (ADR 0017 pkt 7).

## Aneks 2026-09-14 (m12-118) — brama wejścia: pin mijany na trasie do stacji 1

Drugie zgłoszenie terenowe do uwagi B (gra **m117**, po PR #25): „żeby wejść
na pętlę, muszę minąć stację nr 2, żeby dojść do nr 1, i potem wracam tą samą
drogą. Miało być tak, że od startu do nr 2 idzie się obok nr 1". Właściciel
doprecyzował dane z terenu: pin najbliższy (≈100 m tą samą ulicą) nosi numer 2,
stacja 1 jest ≈300 m dalej tą samą ulicą, mijanie jest fizyczne.

Diagnoza (sondy na `test/fixtures/overpass-centrum`, nie zgadywanie):
numeracja PO METRYCE DROGOWEJ była poprawna — stacja 1 = najmniejszy
`dystansSieciowyM` w 198/198 układów, a przejście trasy obok innego pinu
(≤50 m) nie zdarzało się ani razu. Rozjazd jest w drugą stronę: **22% układów
(44/198) ma stację, która w LINII PROSTEJ wygląda na bliższą niż stacja 1**,
a drogą wypada dalej — bo jej dostęp drogowy biegnie inną siecią (osobno
mapowany chodnik, przejście dopiero za skrzyżowaniem; w zgłoszeniu: pin 100 m
na tej samej ulicy, a `dystansSieciowyM` liczony objazdem). Gracz nie chodzi
po grafie i aplikacja **nie rysuje trasy** — planuje po kresce start→stacja 1,
więc idzie prosto przez pin i mija stację, do której nie idzie.

Decyzja: **brama wejścia** po wyborze układu i policzeniu kolejności.
Sprawdzamy, czy pin innej stacji leży w promieniu `mijanieProgM = 50 m`
(próg dojścia, ADR 0034 — w tym zasięgu gra sama uznałaby dojście) od
KTÓREJKOLWIEK z dwóch tras do stacji 1:

1. **drogi z modelu** — `sciezkaPunkty` stacji 1 (tak idzie Dijkstra),
2. **prostej kreski start→stacja 1** — tak trasę czyta gracz na mapie.

Pin w zasięgu którejkolwiek jest mijany (nogami albo oczami): wypada z puli
kandydatów, a układ jest liczony od nowa, do `mijanieMaxRund = 3` razy.
Twarde wejście po drodze zostaje bez zmian — stacja 1 to nadal najbliższa
DROGĄ; brama tylko odejmuje kandydatów, nie zmienia metryki ani nie
przestawia kolejności. Gdy sieć nie da układu bez mijania (za mało
kandydatów), wynik niesie usterkę **S14**, a UI mówi to wprost — bez
udawania, że trasa jest czysta (wzorzec L6/L51: komunikat nazywa przyczynę).

Zasięg reguły zmierzony na fixture'ach (N = 4, R = 700 i 1000 m, siatka
pozycji): odrzucenie pinu zdarza się w **0/100** układów centrum,
**0/104** przedmieścia i **2/94** lasu — dokładnie tam, gdzie stary układ
miał pin w zasięgu trasy do stacji 1. Reguła jest więc siatką na geometrię
patologiczną, a nie zmianą układów, które były dobre.

Test regresyjny (`test/stacje.test.js`) buduje sieć z ręki, która odtwarza
zgłoszenie: ulica na północ + chodnik 25 m obok, wpięty do ulicy dopiero na
600 m. Przy `mijanieProgM: 0` (zachowanie sprzed naprawy) układ to
„Główna 800" (800 m drogi) + pin na chodniku (845 m drogi, ale 381 m kreską,
25 m od trasy do stacji 1) — czyli dokładnie układ z pola; przy domyślnych
50 m pin wypada i zostaje para {400 m, 800 m} z czystym wejściem.

## Aneks 2026-09-14 (m12-119) — trasowanie piesze i rowerowe wyłącznie po układzie ulic

Trzecie i piąte zgłoszenie terenowe do uwagi B (gra **m118**): najbliższy
fizycznie pin, ok. 100 m od startu przy głównej ulicy, dostawał niemal zawsze
numer 2 (czasem 5), choć gracz idący do stacji 1 mijał go w pierwszej setce
metrów i musiał zawracać. Brama z aneksu m12-118 była w tej sieci bezradna:
kreska start→stacja 1 biegła główną ulicą, a pin wisiał na korytarzu, który
nie był dla bramy tą samą trasą.

**Przyczyna (sondy, nie zgadywanie).** Chodnik wzdłuż głównej ulicy bywa w
OSM mapowany jako OSOBNY sposób (`highway=footway`), wpięty do jezdni tylko
na dalekich skrzyżowaniach. Węzeł na takim chodniku, 100 m fizycznie od
startu, dostawał `dystansSieciowyM` mierzony objazdem: w sieci odtworzonej ze
zgłoszenia — 424 m (w innym układzie 662 m). Najkrótsza trasa grafu do
stacji 1 biegła inną ulicą, więc najbliższy fizycznie punkt wyglądał dla
modelu na daleki i lądował pod numerem 2. To nie był błąd wyboru stacji — to
było kłamstwo samego grafu, a brama mogła tylko leczyć jego skutki.

**Decyzja właściciela (jaśniejsza niż każdy detektor):** „Czy możemy brać
pod uwagę tylko układ ulic, bez korytarzy pieszych?" W małych miejscowościach
nie ma wydzielonych przejść dla pieszych, każdy przechodzi gdzie chce, nie ma
też autostrad do obchodzenia — pieszych liczymy trasowaniem po UKŁADZIE ULIC,
analogicznie jak samochody.

Zmiana w `TRYBY` (`app/konfig.js`, jedyne źródło prawdy o klasach):

- piesza: z listy klas wypadają `footway`, `steps`, `cycleway`;
- rower: wypada `cycleway` (DDR wzdłuż jezdni ma tę samą wadę — wpięcia tylko
  na skrzyżowaniach zawyżają dystanse) i trafia jawnie do `wykluczoneKlasy`
  razem z `footway`;
- zostają `pedestrian` (deptak/ plac to ulica bez aut), `living_street`,
  `residential`, `service` oraz `path` i `track` — te ostatnie bywają JEDYNĄ
  siecią w lesie i parku: na fixture las wyrzucenie samego `path` obniża
  liczbę węzłów 139→88 i kompletność układów 24/44→22/44.

Filtrowanie ma jedno miejsce (`czyDrogaDostepna`), więc działa i dla danych
świeżo pobranych, i dla STAREGO cache (właściciel grał na cache sprzed
zmiany): kwerenda Overpass klas już nawet nie pobiera, a `budujGraf`
odrzuciłby je przy budowie grafu.

Dowody w testach: graf nie tworzy węzłów z równoległych `footway`/`cycleway`
nawet gdy przyjdą w danych; punkt fizycznie 100 m od startu przy głównej
ulicy snapuje się do jezdni z `dystansSieciowyM` ≈ 100 m (przed zmianą
≈1,2 km). Test bramy z aneksu m12-118 przepisany na równoległą ULICĘ —
geometria patologii (boczna ulica wpięta daleko) pozostaje testowalna, bo
chodnik nie jest już trasowalny. Pomiary 384+320+352 układów na trzech
fixture'ach: tam, gdzie rozjazd kreska/droga zostaje, podejrzany pin leży
≥89 m od trasy do stacji 1 (najczęściej 150–500 m) — gracz go nie mija;
to naturalna geometria osiedli w kształcie litery V, nie korytarz wzdłuż
jezdni.

Brama wejścia (aneks m12-118) ZOSTAJE: nie wszystkie rozjazdy biorą się z
chodników — boczna ulica wpięta daleko do głównej daje tę samą fizykę
mijania i brama jest dla niej siatką. Twarde minimum właściciela (stacja 2
musi być dalej od startu ULICAMI niż stacja 1) jest teraz spełnione również
w jego terenie: stacja 1 pozostaje minimum `dystansSieciowyM`, a najbliższy
punkt przy głównej ulicy nie może już dostać zawyżonego dystansu przez
osobno mapowany chodnik. Pełna zasada
d(start,2) ≥ d(start,1) + d(1,2) nie jest i nie była gwarantowana przez
model (w terenie siatkowym wykluczałaby większość układów) — pozostaje
intencją, którą brama realizuje tam, gdzie fizycznie dochodzi do mijania.

Przy okazji ten sam mileston porządkuje komunikaty wokół bramy (audyt
D1–D3): martwy stan wyboru poza `zbudujUklad` usunięty; komunikat
„odrzucono N pin(y)" odmienia się po polsku; karta błędów w gałęzi
niekompletu składa funkcja `zlozKarteUsterekStacji` i nie ukrywa już S14
pod syntetycznym S12.

## Aneks 2026-09-14 (m12-120) — pełny układ ulic dla pieszego i roweru; pytanie „dodać ulice zamiast odejmować korytarze"

Właściciel zapytał, czy zamiast usuwać korytarze (m12-119) nie dodać ulic i
nie zostawić wszystkiego — „gdy jest i ścieżka, i ulica, czy nie wybierze
najkrótszej?". Pomiar na sieci z chodnikiem wzdłuż jezdni, spiętym z nią co
300 m: **nie działa**. Punkt fizycznie 100 m od startu snapuje się do
NAJBLIŻSZEGO węzła, czyli na chodnik (0 m), a nie do jezdni 12 m obok;
krawędzi chodnik↔jezdnia w środku kwartału w grafie nie ma, więc jego
dystans to 512 m objazdem do najbliższego skrzyżowania. Dijkstra wybiera
najkrótszą trasę MIĘDZY WĘZŁAMI, ale nie przenosi punktu z korytarza na
równoległą ulicę — pozostawienie korytarzy zachowuje kłamstwo, a brama
wejścia bywa ślepa, gdy stacja 1 leży na bocznej ulicy. Decyzja z m12-119
zostaje utrzymana pomiarowo.

Pytanie miało jednak drugą, trafną połowę: pieszy NIE MIAŁ klas
tertiary/secondary/primary/unclassified, choć „liczymy jak dla samochodów".
Typowa wieś zabudowana wzdłuż drogi wojewódzkiej bez chodników w OSM nie
miała więc w ogóle korytarza. Od m12-120 klasy te wchodzą do trybu pieszego
i roweru (rower dostaje dodatkowo secondary/primary); jedynymi „ulicami do
obejścia" zostają motorway i trunk (jawna lista `wykluczoneKlasy` także u
pieszego). Pomiar centrum: 188 → 211 węzłów, kompletność układów
95/96 → 96/96; przedmieście i las bez zmiany.

Jednokierunkowe: graf buduje krawędzie zawsze w obie strony
(`sasiedztwo[a]` i `sasiedztwo[b]`), tagu `oneway` nigdzie nie czyta —
pieszy może iść „pod prąd" każdej ulicy (oneway dotyczy pojazdów; dla
samochodu model też nie jest nawigacją zakazów, tylko miernikiem odległości).

Przy okazji UX właściciela: „Inny układ" i „Pobierz sieć ponownie"
resetują przewijanie karty `#ekran-stacje` (`przewinWarstweStacjiNaGore`).
