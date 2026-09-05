# 0003 — Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych)

- Status: Proponowana (do potwierdzenia: domyślny dostawca kafelków)
- Data: 2026-09-05

## Kontekst

Gra dzieje się na poziomie ulicy: gracz musi zobaczyć chodnik, plac, wejście do
parku i własną pozycję. Właściciel wyobraża sobie „mapę świata, którą można
przybliżyć", domyślnie OpenStreetMap albo podobną darmową warstwę. AME ma
gotowy, sprawdzony wzorzec: własny renderer SVG w Web Mercator (widok = piksele
kontenera, `ResizeObserver`) z warstwą **kafelków rastrowych** jako podkładem
online (`PODKLADY_ONLINE`: OpenTopoMap, OSM, Esri World Imagery). Biblioteki
(Leaflet, MapLibre, OpenLayers) łamią ADR 0001.

Mapa wektorowa offline (jak w AME) **nie wystarczy**: natural-earth'owy poziom
szczegółowości kończy się na granicach państw i rzekach — nie ma chodników.
Vendoring danych OSM dla „dowolnej okolicy na świecie" jest niemożliwy
(rozmiar + aktualność).

## Decyzja

1. **Własny renderer SVG**, przeniesiony wzorcem z AME: Web Mercator,
   viewBox = piksele kontenera, pan/zoom przez transformację widoku
   (`drag`, `wheel`, `pinch` dwoma palcami, dwuklik/dwutap, przyciski
   ＋ − ⟲ i „namierz mnie"). Elementy interfejsu na mapie mają stały rozmiar
   ekranowy (kompensacja skali `1/k`), nie skalują się z zoomem.
2. **Podkład = rastrowe kafelki Web Mercator 256 px** rysowane jako elementy
   `<image>` w grupie pod warstwami własnymi; siatka kafelków liczona
   z widocznego prostokąta świata, z sygnaturą `z|x0:y0-x1:y1` jako cache
   (identyczny mechanizm jak `rysujPodkladOnline()` w AME — nie wynajdujemy go
   drugi raz).
3. **Dostawcy bez klucza API i bez rejestracji** (polityki i atrybucje:
   `docs/ASSETS.md`):
   - domyślnie: **CARTO Voyager** (`basemaps.cartocdn.com/rastertiles/voyager`) —
     czytelny na telefonie, darmowy z atrybucją, bez limitu „nie używać
     w aplikacjach", jaki OSM stawia swoim serwerom kafelków;
   - alternatywy wybierane w aplikacji: **OSM Standard**, **OpenTopoMap**
     (teren i szlaki — przydatne w trybie pieszym poza miastem),
     **Esri World Imagery** (satelita — gdy trzeba rozpoznać obiekt w terenie);
   - przełącznik „podkład wyłączony" = gra offline na warstwach własnych.
   Atrybucja dostawcy jest **zawsze widoczna** pod mapą (wymóg licencji ODbL).
4. **Warstwy własne nad podkładem** (nasza treść, nie dostawcy): pozycja gracza
   (marker + koło dokładności z `fix.accuracy`), promień gry (okrąg), stacje
   (numerowane pinezki z kolorem stanu: oczekuje / aktywna / zaliczona), linia
   odcinków, etykiety stacji.
5. **Zoom docelowy dla trybów**: pieszy z≈17, rower z≈15, samochód z≈13 —
   start gry centruje widok na pozycji gracza i dobiera zoom z promienia
   (`dopasujZoomDoPromienia()` — czysta funkcja, testowana).
6. Kafelki pobiera **przeglądarka użytkownika**, nie serwer i nie sandbox
   (LESSONS L3): brak dostępu do kafelków w testach jest oczekiwany.

## Konsekwencje

- Gra wymaga sieci w terenie (kafelki + Overpass). Degradacja: podkład
  wyłączony, warstwy własne i pozycja GPS działają dalej; wcześniej pobrane
  kafelki zostają w cache przeglądarki (M-later: Service Worker, `BACKLOG`).
- Musimy przestrzegać polityk dostawców (atrybucja, brak masowego pobierania,
  `Referer`/UA): `docs/ASSETS.md` jest częścią bramy jakości przy zmianie
  dostawcy.
- Koszt: ~300–500 linii własnego rendereru zamiast jednej biblioteki.
  Ryzyko mniejsze niż wygląda — wzorzec jest przetestowany w AME, a my
  potrzebujemy jego podzbioru (bez geometrii krajów i bez cięcia na
  antypołudniku).
- Wybór CARTO jako domyślnego jest **odwracalny jednym wpisem w tabeli
  dostawców**; dlatego ADR jest proponowany, nie zaakceptowany — właściciel
  może woleć „czysty OSM" z względów ideologicznych.

## Powiązania

0001 (bez bibliotek), 0004 (pozycja gracza), 0005 (stacje na sieci drogowej),
0011 (dotyk), 0013 (dostawcy widzą tylko przybliżoną pozycję zapytania).
