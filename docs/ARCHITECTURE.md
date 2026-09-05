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
  pozycja.js                — geolokalizacja: watchPosition, filtr dokładności,
                              kryterium dojścia, tryb ręczny i testowy (ADR 0004)
  sieci.js                  — Overpass: budowa zapytania, graf sieci, Dijkstra,
                              kandydaci na stacje, filtry dostępności (czyste + fetch)
  stacje.js                 — wybór stacji: pierścienie, separacja kątowa, pass
                              wyrównujący, ziarno i RNG deterministyczny (czyste)
  protokol.js               — SZABLON_PROMPTU, zbudujPrompt(), walidujPaczke(),
                              TOKENY_MIEJSCA, kody usterek E01–E20 (czyste)
  kodowanie.js              — ukrywanie paczki: XOR ze strumieniem z stałego ziarna
                              + base64url, kontener TO-paczka/2, suma FNV-1a
                              (czyste, synchroniczne, bez WebCrypto — ADR 0007)
  rozgrywka.js              — stan gry: kolejki graczy, odcinki i czasy, odpowiedzi,
                              punktacja, dziennik (czyste, zegar wstrzykiwany)
  trwalosc.js               — localStorage: klucze, budżet rozmiaru, migracje,
                              eksport/import pliku paczki (ATR 0010)
  mapa.js                   — render SVG: kafelki, warstwy własne, pan/zoom/pinch,
                              pinezki stacji, marker pozycji (DOM)
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
ukrywanie paczki, punktacja, migracje stanu. Warstwa DOM (`mapa.js`, `ui.js`) jest cienka:
pobiera stan, woła czyste funkcje, renderuje. Zegar i RNG są **wstrzykiwane**
(`performance.now` / `mulberry32(ziarno)`), nie czytane z globali w środku logiki.

## Przepływ danych

### A. Przygotowanie gry

1. `ui.js` zbiera konfigurację → `konfig.walidujSetup()` (limity, spójność).
2. `pozycja.js` czyta pierwszy fix GPS (albo współrzędne z trybu testowego).
3. `sieci.js` buduje zapytanie Overpass dla `R × 1.15`, pobiera dane (cache
   `okolica:sieci:<geohash6>-<R>`, ADR 0010), buduje graf i liczy Dijkstrę.
4. `stacje.wybierzStacje(graf, kandydaci, konfig, ziarno)` → N stacji +
   macierz odległości sieciowych + miara sprawiedliwości (odchylenie
   standardowe).
5. `protokol.zbudujPrompt(konfig, okolica, stacje)` → tekst do schowka.
6. Organizator ↔ model AI (poza systemem).
7. Wklejona odpowiedź → `protokol.walidujPaczke()` → usterki (z przyciskiem
   „skopiuj poprawkę") albo przyjęcie.
8. `kodowanie.zapakujPaczke(paczka, WERSJA_PROTOKOLU)` → kontener `TO-paczka/2`
   → `trwalosc.zapiszPaczke()`.

### B. Rozgrywka

1. Ekran gry: mapa z podkładem (ADR 0003), stacje, pozycja gracza, badge
   „czyja kolejka" i „ile metrów" (ADR 0009/0011).
2. Akcja użytkownika startuje odcinek → `rozgrywka.startOdcinka()` (czas
   z `performance.now()`).
3. `pozycja.js` strumieniuje fixy → `czyDotarl()` (próg `max(25 m, 1.2×accuracy)`,
   dwa kolejne fixy) → `rozgrywka.zakonczOdcinek()`.
4. `kodowanie.odpakujPaczke(kontener)` → pytanie dla stacji **odsłaniane w chwili
   dojścia**, nie na starcie (ADR 0007 pkt 6).
5. Odpowiedź → punkty → `rozgrywka.nastepnyGracz()` → ekran „kto idzie dalej".
6. Koniec → podsumowanie (czasy, punkty, sprawiedliwość trasy, źródła pytań)
   → eksport wyniku (ADR 0010 pkt 5).

## Kluczowe algorytmy

- **Odległość**: haversine (`odlegloscM`) — dla skali 25 m–10 km błąd modelu
  kulistego jest poniżej progu dojścia; bez Vincenty'ego (koszt, brak zysku).
- **Projekcja**: Web Mercator, `projektuj(lat, lon)` → jednostki świata
  `[0..SZER]`, jak w AME (`app/geo.js`); odwrotność `odwroc(x, y)`.
- **Siatka kafelków**: `z = clamp(round(log2(skala × SZER / 256)), 0, maxZoom)`,
  widoczny prostokąt świata → zakres `tx/ty` → sygnatura jako cache
  (wzorzec 1:1 z AME `rysujPodkladOnline()`).
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

## Stan i trwałość

Jedyny trwały nośnik to `localStorage` (klucze `okolica:*`, ADR 0010 pkt 1)
plus plik `.paczka.json` eksportowany przez użytkownika. Stan rozgrywki jest
**zdarzeniowy**: dziennik `{ stacja, gracz, start, koniec, trybDojscia,
accuracy }` pozwala przeliczyć wynik i odtworzyć przebieg (debugging terenowy).
Każdy zapis ma pole `schemat`; nieznana wersja = migracja albo jawny komunikat,
nigdy ciche odrzucenie.

## Testowanie

- `npm test` (`node --test`) — czyste funkcje na fixture'ach:
  `test/fixtures/overpass-*.json` (centrum miasta / przedmieście / las),
  `trasa-*.json` (sekwencje fixów GPS), `paczka-*.json` (OK i 20 klas usterek).
- Testy kontraktowe: szablon promptu w `docs/PROTOKOL.md` ↔ `SZABLON_PROMPTU`;
  kanon tematów w protokole ↔ `TEMATY`; wersja protokołu ↔ stopka ↔ README;
  wersja cache-bustingu w `index.html` ↔ importy; brak `node:`/`require(` w `app/`;
  brak ścieżek absolutnych (`href="/`, `src="/`) w `index.html` (ADR 0002 pkt 3).
- Warstwa DOM: testy na atrapie (lekki stub w `test/helpers/dom.js`), a
  weryfikacja wizualna — headless Chromium z viewportem 360 × 640
  (ENVIRONMENT §4.1) albo live preview.
- Sieć w testach jest **zabroniona** (LESSONS L3): Overpass i kafelki tylko
  na fixture'ach i w przeglądarce.

## Czego NIE ma w architekturze (świadomie)

- Backendu, bazy danych, kont użytkowników, logowania (ADR 0001/0006).
- Biblioteki mapowej, frameworka UI, bundlera, webfontów (ADR 0001/0011).
- Analityki i ciasteczek (ADR 0013).
- Nawigacji krok-po-kroku: pokazujemy stację i dystans, nie prowadzimy po
  skrętach (odpowiedzialność i bezpieczeństwo użytkownika; BACKLOG B7).
- Synchronizacji wielu urządzeń (ADR 0009 pkt 6; BACKLOG B1).
