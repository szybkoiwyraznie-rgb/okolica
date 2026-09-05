# 0003 — Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych)

- Status: Proponowana (do potwierdzenia: zestaw dostawców kafelków — patrz `docs/ASSETS.md`)
- Data: 2026-09-05 (rewizja tego samego dnia po kwerendzie polityk dostawców)

## Kontekst

Gra dzieje się na poziomie ulicy: gracz musi zobaczyć chodnik, plac, wejście do
parku i własną pozycję. Właściciel wyobraża sobie „mapę świata, którą można
przybliżyć", domyślnie **OpenStreetMap** albo podobną darmową warstwę. AME ma
gotowy, sprawdzony wzorzec: własny renderer SVG w Web Mercator (widok = piksele
kontenera, `ResizeObserver`) z warstwą **kafelków rastrowych** jako podkładem
online (`PODKLADY_ONLINE`: OpenTopoMap, OSM, Esri World Imagery). Biblioteki
(Leaflet, MapLibre, OpenLayers) łamią ADR 0001.

Mapa wektorowa offline (jak w AME) **nie wystarczy**: natural-earth'owy poziom
szczegółowości kończy się na granicach państw i rzekach — nie ma chodników.
Vendoring danych OSM dla „dowolnej okolicy na świecie" jest niemożliwy
(rozmiar + aktualność).

Kwerenda polityk dostawców z 2026-09-05 (`docs/ASSETS.md`) wykluczyła
CARTO (wymaga klucza API, rastery rozważane do wygaszenia) oraz darmowe
serwisy **wektorowe** (OpenFreeMap, VersaTiles, Maptoolkit — bez klucza, ale
wektorowe, więc wymagają MapLibre, czyli zależności). Zostają serwisy
rastrowe bez klucza.

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
3. **Dostawcy: wyłącznie rastrowe serwisy bez klucza API i bez rejestracji**
   (pełna tabela, polityki i atrybucje: `docs/ASSETS.md` §1):
   - domyślnie **OSM Standard** (`tile.openstreetmap.org`, maxZoom 19) — zgodnie
     z oczekiwaniem właściciela („domyślnie OpenStreetMap"); używanie lekkie,
     w granicach Tile Usage Policy: brak pobierania masowego, brak własnego
     cache kafelków poza cache przeglądarki, `Referer` z adresu aplikacji;
   - alternatywy w przełączniku warstw: **OpenTopoMap** (teren i szlaki —
     przydatna w trybie pieszym poza miastem; ryzyko trwałości usługi
     udokumentowane w `ASSETS` §1), **Esri World Imagery** (satelita —
     rozpoznanie obiektu w terenie), docelowo **OSM France** jako podkład
     zapasowy (po sprawdzeniu polityki);
   - przełącznik **„podkład wyłączony"** = gra offline na warstwach własnych
     (degradacja, nie błąd);
   - atrybucja OSM (ODbL) **zawsze widoczna** pod mapą.
4. **Warstwy własne nad podkładem** (nasza treść, nie dostawcy): pozycja gracza
   (marker + koło dokładności z `fix.accuracy`), promień gry (okrąg), stacje
   (numerowane pinezki z kolorem stanu: oczekuje / aktywna / zaliczona), linia
   odcinków, etykiety stacji.
5. **Dwa zoomy, dwie role** (rozróżnienie dopisane 2026-09-05, gdy szkielet
   M0 zderzył te pojęcia w testach):
   - **zoom przeglądowy** — start gry centruje widok na pozycji gracza i mieści
     cały obszar gry w kadrze: `dopasujZoomDoPromienia(promienM, szerokośćPx,
     lat)` (czysta funkcja, testowana). Dla szerokości 360 px daje z≈14 przy
     1 km, z≈12 przy 3 km, z≈10 przy 10 km — widać pierścień stacji, nie
     numery domów;
   - **zoom uliczny trybu** — `TRYBY[].zoom` (pieszy 17, rower 15, samochód 13):
     detal potrzebny przy podejściu do stacji i przy podglądzie „gdzie jestem".
     Używa go widok stacji, nie widok startowy.
6. Kafelki pobiera **przeglądarka użytkownika**, nie serwer i nie sandbox
   (LESSONS L3): brak dostępu do kafelków w testach jest oczekiwany.
7. **Odporność na zniknięcie dostawcy**: tabela dostawców jest konfiguracją
   (nie kodem rozrzuconym po aplikacji), a każda pozycja ma atrybucję i
   `maxZoom`; usunięcie dostawcy z tabeli nie może zepsuć gry — podkład znika,
   warstwy własne zostają.

## Konsekwencje

- Gra wymaga sieci w terenie (kafelki + Overpass). Degradacja: podkład
  wyłączony, warstwy własne i pozycja GPS działają dalej; wcześniej pobrane
  kafelki zostają w cache przeglądarki (Service Worker — `BACKLOG` B9).
- Musimy przestrzegać polityk dostawców (atrybucja, brak masowego pobierania,
  `Referer`): `docs/ASSETS.md` jest częścią bramy jakości przy zmianie
  dostawcy (checklista §5).
- Koszt: ~300–500 linii własnego rendereru zamiast jednej biblioteki.
  Ryzyko mniejsze niż wygląda — wzorzec jest przetestowany w AME, a my
  potrzebujemy jego podzbioru (bez geometrii krajów i bez cięcia na
  antypołudniku).
- Estetyka podkładu OSM Standard na małym ekranie w słońcu jest gorsza niż
  „voyageropodobnych" styli jasnych — dlatego tryb gry ma motyw jasny UI i
  możliwość przełączenia podkładu (ADR 0011 pkt 5). Jeśli właściciel zechce
  ładniejszego styli bez klucza, droga prowadzi przez wektory i zależność
  (MapLibre) → wymaga zastąpienia ADR 0001.

## Powiązania

0001 (bez bibliotek), 0004 (pozycja gracza), 0005 (stacje na sieci drogowej),
0011 (dotyk i czytelność), 0013 (dostawcy widzą tylko obszar ekranu),
`docs/ASSETS.md` §1.
