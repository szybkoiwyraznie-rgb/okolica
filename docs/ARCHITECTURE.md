# ARCHITECTURE — budowa aplikacji i danych „Tajemniczej Okolicy"

## Przegląd

Aplikacja to statyczna strona (ADR 0001): `index.html` + moduły ES w `app/` +
dane w `data/` + assety w `assets/`. Działa z dowolnego serwera statycznego
(GitHub Pages, `npm run serwer`). Bez backendu, bez builda aplikacji, bez
zależności npm. Treść pytań pochodzi z zewnątrz (model AI) i wchodzi przez
pętlę protokołu PYT (ADR 0006, `docs/PROTOKOL.md`).

```
index.html                  — powłoka UI: ekrany (setup → prompt → paczka → gra → wynik),
                              stopka z wersją protokołu, baner file://
app/
  app.js                    — bootstrap: router ekranów, stan sesji, spinanie modułów
  konfig.js                 — kanon konfiguracji: TRYBY, PROMIENIE, WIEK, TEMATY,
                              DOMYSLNE, ograniczenia (czyste dane + walidacja setupu)
  geo.js                    — geodezja i projekcja: haversine, bearing, Web Mercator,
                              siatka kafelków, pierścienie, dopasowanie zoomu (czyste)
  pozycja.js                — geolokalizacja: osłona watchPozycja(), filtr
                              dokładności (ocenFix), kryterium dojścia
                              (stanDojscia), komunikaty P01–P09, symulacja trasy
                              dla trybu testowego (ADR 0004, 0015)
  sieci.js                  — Overpass: budowa zapytania, graf sieci, Dijkstra,
                              kandydaci na stacje, filtry dostępności (czyste + fetch)
  stacje.js                 — wybór stacji: pierścienie, separacja kątowa, pass
                              wyrównujący, ziarno i RNG deterministyczny (czyste)
  protokol.js               — SZABLON_PROMPTU, zbudujPrompt(), walidujPaczke(),
                              TOKENY_MIEJSCA, kody usterek E01–E20 (czyste)
  kodowanie.js              — ukrywanie paczki: XOR ze strumieniem z stałego ziarna
                              + base64url, kontener TO-paczka/2, suma FNV-1a
                              (czyste, synchroniczne, bez WebCrypto — ADR 0007)
  rozgrywka.js              — stan gry `rozgrywka/1`: kolejki graczy, odcinki
                              i czasy, odpowiedzi, punktacja (ADR 0014), dziennik,
                              podsumowanie, kody G01–G13 (czyste, zegar wstrzykiwany)
  trwalosc.js               — localStorage: klucze, budżet rozmiaru, migracje,
                              eksport/import pliku paczki (ATR 0010)
  mapa.js                   — mapa: matematyka widoku (zoom ↔ skala, środek ↔
                              przesunięcie), adresy kafelków, plan rysowania
                              i pasek skali (czyste) + warstwa SVG z gestami
                              pan/pinch, przyciskami ±/◎ i atrybucją (DOM)
  ui.js                     — ekrany i komponenty: setup, prompt, walidacja, gra,
                              wynik; komunikaty, aria-live (DOM)
  styles.css                — tokeny palety, motyw jasny/ciemny, cele dotykowe ≥44 px
data/
  przyklady/paczka-*.json   — paczki referencyjne (zweryfikowane źródła, ADR 0008)
  kanon-tematow.json        — (opcjonalnie) kanon tematów, gdy wyjdzie poza kod
assets/
  ikony/*.svg               — ikony inline (zero CDN, ADR 0011 pkt 6)
  manifest.json             — PWA-lite: „dodaj do ekranu głównego"
tools/
  sprawdz-kontrakt.mjs      — brama dodatkowa: kontrakt dokument↔kod, brak node: w app/
  (później) generuj-indeks-paczek.mjs — indeks repozytorium paczek (ADR 0010)
test/                       — node --test; fixture'y w test/fixtures/
docs/                       — protokół, ADR, plany, handoffy (patrz AGENTS.md §0)
```

## Podział: czyste funkcje vs warstwa DOM

Wszystko, co da się policzyć, jest **czystą funkcją** w module bez DOM i bez
`node:*` (LESSONS L6): geodezja, projekcja, siatka kafelków, budowa zapytania
Overpass, graf i Dijkstra, wybór stacji, budowa promptu, walidacja paczki,
ukrywanie paczki, punktacja, migracje stanu, a od M2 także **matematyka widoku
mapy i plan rysowania** (`mapa.js`: zoom ↔ skala, adresy kafelków, pinezki,
okręgi, pasek skali). Warstwa DOM jest cienka: w `mapa.js` to `utworzMape()`
(SVG, gesty, przyciski), a reszta ekranów siedzi w `app.js` (docelowo `ui.js`) —
pobiera stan, woła czyste funkcje, renderuje. Zegar i RNG są **wstrzykiwane**
(`performance.now` / `mulberry32(ziarno)`), nie czytane z globali w środku logiki.

## Przepływ danych

### A. Przygotowanie gry

1. `ui.js` zbiera konfigurację → `konfig.walidujSetup()` (limity, spójność).
2. `pozycja.js` czyta pierwszy fix GPS (albo współrzędne z trybu testowego).
   Pierwszy fix centruje widok mapy (`app.js: centrujNaPozycji`) w zoomie
   dobranym do promienia gry (`geo.dopasujZoomDoPromienia`), a kolejne tylko
   przesuwają marker — potem mapę prowadzi palec gracza. W trybie testowym
   fixy zamiast z GPS płyną z `sekwencjaSymulowana(trasaProsta(...))`
   odtwarzanej przez `setInterval` (przycisk „Symuluj dojście"); oba strumienie
   wchodzą w stan **jednym lejem** `app.js: przyjmijFix()`, więc badge, mapa
   i próg dojścia zachowują się identycznie z sygnałem i bez niego, a pauza
   w tle (`visibilitychange`) zatrzymuje jedno i drugie.
3. `sieci.js` buduje zapytanie Overpass dla `R × 1.15`, pobiera dane (cache
   `okolica:sieci:<geohash6>-<R>`, ADR 0010), buduje graf i liczy Dijkstrę.
4. `stacje.wybierzStacje(graf, kandydaci, konfig, ziarno)` → N stacji +
   macierz odległości sieciowych + miara sprawiedliwości (odchylenie
   standardowe).
   Lista stacji trafia na mapę jako numerowane pinezki
   (`mapa.zaznaczStacje`), a promień gry jako przerywany okrąg.
5. `protokol.zbudujPrompt(konfig, okolica, stacje)` → tekst do schowka.
6. Organizator ↔ model AI (poza systemem).
7. Wklejona odpowiedź → `protokol.walidujPaczke()` → usterki (z przyciskiem
   „skopiuj poprawkę") albo przyjęcie.
8. `kodowanie.zapakujPaczke(paczka, WERSJA_PROTOKOLU)` → kontener `TO-paczka/2`
   → `trwalosc.zapiszPaczke()`.

### B. Rozgrywka

1. Ekran gry: mapa z podkładem (ADR 0003), stacje, pozycja gracza, badge
   „czyja kolejka" i „ile metrów" (ADR 0009/0011).
2. Akcja użytkownika startuje odcinek → `rozgrywka.startOdcinka({ stacjaId,
   czasMs })`; `czasMs` podaje warstwa DOM z `performance.now()`, bo logika nie
   czyta zegara (ADR 0004 pkt 3).
3. `pozycja.watchPozycja()` strumieniuje fixy → `ocenFix()` (filtr dokładności,
   kody P05/P06) → `dodajFix()` (historia, maks. 40 pomiarów) → `stanDojscia()`
   (próg `max(25 m, 1,2 × accuracy)` ograniczony do 100 m + dwa kolejne
   trafienia) → `rozgrywka.zakonczOdcinek({ czasMs, trybDojscia, fix })`: czas,
   kara za ręczne zgłoszenie, dokładność, `poLimitie`.
4. `kodowanie.odpakujPaczke(kontener)` → pytanie dla stacji **odsłaniane w chwili
   dojścia**, nie na starcie (ADR 0007 pkt 6).
5. Odpowiedź → `rozgrywka.zapiszOdpowiedz({ stacjaId, graczId, pytanie,
   wybrana })` → punkty i premia/potrącenie za tempo (ADR 0014) → następna
   kolejka: `graczNaStacji()` / `ktoOdpowiada()` / `podglad()` → ekran „kto idzie
   dalej". Stacja bez pytania w paczce zamyka się samym dojściem, a pominąć da
   się tylko odcinek w drodze (ADR 0015).
6. Koniec → podsumowanie (czasy, punkty, sprawiedliwość trasy, źródła pytań)
   → eksport wyniku (ADR 0010 pkt 5).

## Kluczowe algorytmy

- **Odległość**: haversine (`odlegloscM`) — dla skali 25 m–10 km błąd modelu
  kulistego jest poniżej progu dojścia; bez Vincenty'ego (koszt, brak zysku).
- **Projekcja**: Web Mercator, `projektuj(lat, lon)` → jednostki świata
  `[0..SZER]`, jak w AME (`app/geo.js`); odwrotność `odwroc(x, y)`.
- **Siatka kafelków**: `z = clamp(round(log2(skala × SZER / 256)), 0, maxZoom)`
  (`geo.siatkaKafelkow`), widoczny prostokąt świata → zakres `tx/ty`, a potem
  `mapa.planKafelkow` dokłada margines jednego kafelka (drag nie odsłania
  pustki) i tnie do `MAX_KAFELEK = 48` z flagą `przyciete` — „lekkie użycie"
  z polityki OSM Tile Usage (`ASSETS` §1). Adresy: `urlKafelka` podstawia
  `{z}/{x}/{y}` po nazwach (Esri ma odwrotnie: `{z}/{y}/{x}`), poddomeny
  OpenTopoMap rotują deterministycznie z `(x + y) % 3` (losowa rotacja psułaby
  cache przeglądarki), a podkład `brak` nie daje żadnego żądania.
- **Widok i jednostki**: `ekranPx = jednostkaSwiata × skala + przesunięcie`,
  `zoom = log2(skala × 3600 / 256)`. Warstwy metryczne (kafelki, okręgi) mają
  jeden `transform="translate(x y) scale(skala)"` i dzieci w jednostkach
  świata, więc pan/zoom zmienia **jeden atrybut**, a lista kafelków jest
  przebudowywana tylko przy zmianie sygnatury siatki. Pinezki i marker są
  w pikselach, bo mają stały rozmiar na ekranie; obrys okręgów ma
  `vector-effect="non-scaling-stroke"`. Metry na jednostkę świata to
  `metryNaPiksel(lat, zoom) × skala` (dzielenie dałoby okręgi większe niż świat).
- **Gesty**: Pointer Events z `Map` aktywnych wskaźników — jeden palec = pan
  (przesunięcie o deltę), dwa = pinch (`zmienSkale` z kotwicą w środku palców),
  kółko myszy = zoom z `preventDefault` (`{passive: false}`). Zoom jest
  ograniczany do `maxZoom` podkładu, więc aplikacja nie prosi o nieistniejące
  kafelki. `touch-action: none` tylko na panelu — reszta strony zostaje
  przybliżalna (dostępność, ADR 0011).
- **Pasek skali**: największy „ładny" krok z `KROKI_SKALI_M` (5 m–500 km),
  który mieści się w 80 px; krótszy niż 14 px nie jest rysowany (przy widoku
  całej Ziemi nic by nie mówił).
- **Dostępność**: klasy `highway` per tryb + wykluczenia (`access=private`,
  `foot=no`, poligony `building`, `landuse=railway`) → `czyDostepny(way, tryb)`.
- **Dijkstra** po grafie węzłów OSM z wagą = długość geometryczna krawędzi;
  start snapowany do najbliższego dopuszczalnego węzła.
- **Wybór stacji**: greedy po `|d_sieci − r|` z separacją kątową ≥ `0.7×360/N`
  i sieciową ≥ `0.5×r`, potem pass zamian parami minimalizujący odchylenie
  standardowe `d_sieci` (ADR 0005 pkt 5). Deterministyczny pod ziarnem.
- **Ukrywanie paczki**: obfuskacja bez klucza — UTF-8 JSON ⊕ strumień bajtów
  z stałego ziarna → base64url → kontener `TO-paczka/2` + suma kontrolna FNV-1a
  (ADR 0007). To bariera przed przypadkowym wglądem, **nie szyfrowanie**.
- **Kryterium dojścia**: `progDojsciaM(accuracy) = ogranicz(1,2 × accuracy,
  25 m, 100 m)` (brak dokładności → 100 m, czyli najostrzej) plus dwa kolejne
  fixy w progu — debounce przeciw odbiciom sygnału (`geo.czyDotarl`, opakowane
  przez `pozycja.stanDojscia` zdaniem dla gracza: ile metrów zostało i dlaczego
  stacja się nie zapala). Fix niedokładny dostaje ostrzeżenie, ale nie jest
  odrzucany (ADR 0004 pkt 2 i 4).
- **Punktacja czasu** (ADR 0014): `tempo = czasS / dystansOdcinkaM` [s/m], gdzie
  `czasS` zawiera karę za ręczne zgłoszenie, a dystans jest **łańcuchowy**
  (start gry → stacja 1, potem stacja poprzednia → następna). Mediana próbek
  (najpierw ta sama stacja ≥ 2, inaczej wszystkie zakończone odcinki ≥ 2,
  inaczej premia 0), `premia = round(punktyPodstawowe × 0,5 × ogranicz((mediana
  − tempo)/mediana, ±0,5))` → maks. ±25% punktów za odpowiedź. Przekroczony
  limit odcinka zeruje premię i oznacza `poLimitie`, ale nie przerywa gry.
- **Symulacja trasy** (tryb testowy, ADR 0004 pkt 6): interpolacja po łamanej
  punktów (`punktNaTrasie`) + deterministyczny rozrzut i zmienna dokładność
  z `szum(t)` liczonego z czasu — zero `Math.random()`, więc ta sama trasa daje
  te same fixy w teście i w przeglądarce. `sekwencjaSymulowana` dokłada postój
  przy stacji, bez którego debounce nigdy by się nie spełnił.

## Stan i trwałość

Jedyny trwały nośnik to `localStorage` (klucze `okolica:*`, ADR 0010 pkt 1)
plus plik `.paczka.json` eksportowany przez użytkownika.

Stan rozgrywki (`schemat: 'rozgrywka/1'`, `app/rozgrywka.js`) jest
**zdarzeniowy i niezmiennikowy**: każda funkcja zwraca nowy obiekt
(`structuredClone`), a argument zostaje nietknięty, bo UI trzyma referencje.
Dziennik `{ czasMs, typ, … }` (`start`, `start-odcinka`, `dojscie`, `odpowiedz`,
`pominiecie`, `ostrzezenie`, `koniec`) pozwala przeliczyć wynik i odtworzyć
przebieg — debugging terenowy bez zgadywania. Odcinki niosą pomiar (`czasS`,
`karaS`, `trybDojscia`, `accuracyM`, `odlegloscKoncowaM`, `tempo`, `poLimitie`),
a odpowiedzi pełny ślad punktacji (`punktyPodstawowe`, `premiaCzasu`,
`punktyRazem`, `tempo`, `medianaTempa`, `probek`, `zrodloProbek`) — wynik da się
wyjaśnić graczowi liczba po liczbie (ADR 0011, ADR 0014 pkt 8).

Stan **nie zawiera treści pytań**: z paczki bierze tylko `{ stacja, pytanieId }`,
a z odpowiedzi poprawność i punkty (ADR 0007 pkt 6). Dlatego może leżeć w
`localStorage` i w eksporcie, a pytanie odsłania się dopiero z ukrytej paczki
w chwili dojścia.

Stan sesji (pamięć, `app/app.js`): `STAN.ekran` zapamiętuje, na który ekran
wraca pomocniczy ekran „dane i prywatność" (otwierany z setupu i ze stopki,
nie należy do paska pięciu kroków); `STAN.historiaFixow` to ograniczona
historia wspólna GPS-u i symulacji; `STAN.symulacja` trzyma odtwarzaną trasę
(`{fixy, indeks, cel, timer}`). Kasowanie danych jest **dwustopniowe**
(pierwszy klik uzbraja, drugi wykonuje) i usuwa wyłącznie klucze `okolica:*` —
aplikacja nie wywołuje `confirm()`/`alert()` (ADR 0015 pkt 6), komunikaty idą
do pól z `role="status"`/`role="alert"`.

Każdy zapis ma pole `schemat`; nieznana wersja = migracja albo jawny komunikat
(`wczytajStan()`, kod `G12` ze wskazówką migracji), nigdy ciche odrzucenie.
Zapis do `localStorage`, budżet rozmiaru i eksport pliku dochodzą w
`app/trwalosc.js`: zapis paczki i `modyfikacje[]` w M5, trwałość stanu gry
(wznowienie po zamknięciu przeglądarki) w M6, historia gier w M7.

## Testowanie

- `npm test` (`node --test`) — czyste funkcje na fixture'ach:
  `test/fixtures/paczka-ok.json` (poprawna paczka PYT z zastrzeżeniem, że dane są
  zmyślone), `test/fixtures/trasa-odbicie.json` (sekwencja fixów GPS z odbiciem
  sygnału, z oczekiwanym dystansem przy każdym fixie); od M4 dochodzą
  `overpass-*.json` (centrum miasta / przedmieście / las) i pełny zestaw 20 klas
  usterek paczki.
- Reguły gry testowane są **przejściem, nie pojedynczym wywołaniem**: pełna gra
  3 graczy × 5 stacji od startu do podsumowania na wstrzykniętym zegarze
  (`test/rozgrywka.test.js`), przejścia faz przy paczce bez pełnego pokrycia,
  odmowy z kodami `G01`–`G13`, determinizm i brak mutacji stanu wejściowego.
- Mapa (M2) jest testowana **dwuwarstwowo**: `test/mapa.test.js` sprawdza część
  czystą (round-trip środek ↔ widok, kotwica i widełki zoomu, adresy kafelków
  wszystkich podkładów wraz z kolejnością `{z}/{y}/{x}` Esri i deterministyczną
  poddomeną, limit i margines siatki, spójność metrów między jednostkami świata
  a pikselami, pasek skali, plan dla schowanego panelu) oraz warstwę DOM na
  atrapie (drag, pinch, kółko, przyciski ±/◎, zmiana podkładu, przywrócenie
  warstw po pokazaniu panelu, `zniszcz()` zdejmujące nasłuchy). Wygląd —
  kafelki naprawdę widoczne na ekranie — potwierdza właściciel w live preview,
  bo w sandboxie nie ma ani przeglądarki, ani sieci do kafelków (LESSONS L3).
- Testy kontraktowe: szablon promptu w `docs/PROTOKOL.md` ↔ `SZABLON_PROMPTU`;
  kanon tematów w protokole ↔ `TEMATY`; wersja protokołu ↔ stopka ↔ README;
  wersja cache-bustingu w `index.html` ↔ importy; brak `node:`/`require(` w `app/`;
  brak ścieżek od korzenia w `index.html` (ADR 0002 pkt 3); rejestr ADR ↔ pliki
  na dysku i status w pliku ↔ status w rejestrze; geolokalizacja w `app.js`
  wyłącznie przez `pozycja.js` (brak `watchPosition`, `clearWatch` i opcji
  watchera w warstwie DOM — ADR 0004 pkt 1); od M2 także: kompletność obu szkieletów paneli mapy w `index.html` (svg z `role="img"` i `aria-label`, przyciski z `type="button"`), zakaz domyślnego `display: none` dla atrybucji i obowiązkowe `touch-action: none` na panelu, brak `fetch`/geolokalizacji/`alert`/`node:` w `mapa.js`, a szablony URL kafelków identyczne z `docs/ASSETS.md` §1 (po ujednoliceniu zapisu poddomen `{s}` ↔ `{a,b,c}`).
- Warstwa DOM: testy na atrapie `test/helpers/dom.js` — `zainstalujDom()` zakłada
  świeże globale i zwraca uchwyty (`kliknij`, `wyslijZdarzenieDokumentu`,
  `wyslijZdarzenieOkna`, `ustawHidden`, `ustawGeolokalizacje`, `ustawProstokat`),
  a `atrapaGeolokalizacji()` udaje `watchPosition`/`clearWatch`. Atrapa jest celowo
  głupia (`querySelector` → `null`, `innerHTML` niczego nie parsuje), ale od M2
  umie to, czego potrzebuje SVG: `createElementNS`, `replaceChildren`,
  `removeChild`, `getBoundingClientRect` z ustawialnym rozmiarem (test
  schowanego panelu) i no-op `setPointerCapture`; `removeEventListener` naprawdę
  zdejmuje nasłuch, więc test `zniszcz()` sprawdza zachowanie, a nie atrapę.
  Test chcący inny stan startowy (np. `?tryb=test`) zakłada własną atrapę
  i importuje `app.js` od nowa — egzemplarze nie dzielą wtedy nasłuchów zdarzeń.
  Weryfikacja wizualna: live preview u właściciela; headless Chromium
  360 × 640 (ENVIRONMENT §4.1) dopiero, gdy będzie w środowisku dostępny.
- Sieć w testach jest **zabroniona** (LESSONS L3): Overpass i kafelki tylko
  na fixture'ach i w przeglądarce.

## Czego NIE ma w architekturze (świadomie)

- Backendu, bazy danych, kont użytkowników, logowania (ADR 0001/0006).
- Biblioteki mapowej, frameworka UI, bundlera, webfontów (ADR 0001/0011).
- Analityki i ciasteczek (ADR 0013).
- Nawigacji krok-po-kroku: pokazujemy stację i dystans, nie prowadzimy po
  skrętach (odpowiedzialność i bezpieczeństwo użytkownika; BACKLOG B7).
- Synchronizacji wielu urządzeń (ADR 0009 pkt 6; BACKLOG B1).
