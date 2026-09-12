# 0003 — Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych)

- Status: Zaakceptowana (2026-09-05 — właściciel potwierdził **OSM Standard** jako
  podkład domyślny; pozostali dostawcy i ich polityki: `docs/ASSETS.md`)
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

## Aneks 2026-09-12 (m12-81): szablon kafelków podmienialny bez wdrażania wersji

Decyzja właściciela (2026-09-12): **„Jeśli to nie zepsuje aplikacji to zrób."**

Punkt 3 powyżej (podkład wybierany w kodzie, `osm` wymuszone w
`oczyscKonfiguracje`) **zostaje** — gracz nadal nie wybiera dostawcy, a setup
nadal nie niesie podkładu. Dochodzi natomiast **ścieżka operatorska**, której
polityka kafelków OSM wymaga wprost: *„Avoid hard-coding the tile URL; allow
switching without needing a software update."*

**Dlaczego:** `tile.openstreetmap.org` to serwis wolontariacki, finansowany
z darowizn, bez SLA, blokujący „bez uprzedzenia". Gdyby zniknął albo nas
zablokował, jedyną drogą ratunku byłoby nowe wdrożenie — a gra dzieje się
w terenie, nie przy biurku. Ten sam dzień przyniósł zresztą blokadę 403
w podglądzie (LESSONS L47), więc ryzyko nie jest teoretyczne.

**Rozstrzygnięcie:** klucz `localStorage` **`okolica:kafelki:url`** nadpisuje
szablon podkładu `osm`. Czyta go raz przy starcie `wczytajNadpisanieKafelkow()`
(`app/app.js`), waliduje i przekazuje `walidujSzablonKafelkow()` /
`ustawSzablonKafelkow()` (`app/mapa.js`).

**Granice, które trzymają to z dala od gracza i od awarii:**

1. **Domyślne zachowanie niezmienione.** Brak klucza = adres wbudowany.
2. **Walidacja odrzuca, nie rzuca.** Wymagamy `https:` (polityka OSM zakazuje
   `http://`) i wszystkich trzech podstawień `{z}/{x}/{y}`. Wartość błędna
   zostawia adres wbudowany — pomyłka w kluczu nie da graczzowi pustej mapy.
3. **Tylko `osm`.** `opentopo`, `esri-satelita` i `brak` mają własne adresy
   i własne licencje; nadpisanie nie może ich po cichu przejąć.
4. **`app/mapa.js` zostaje czysty.** Moduł nie zna `localStorage` — kontrakt
   pilnuje braku dostępu do niego, a nie samego słowa w komentarzu.
5. **To nie jest wybór gracza.** Klucza nie ma w UI i nie ma w setupie, więc
   nie wpływa ani na paczkę, ani na dopasowanie, ani na ADR 0037.

**Zgodność z polityką OSM domknięta tym samym aneksem:** w „Informacjach"
pojawiły się link „Zgłoś błąd na mapie" (`openstreetmap.org/fixthemap`) oraz
opublikowany adres kontaktowy — oba wprost zalecane przez politykę, a adres
kontaktowy to jedyna droga, jaką OSM może uprzedzić o blokadzie.

**Testy:** walidacja i setter jednostkowo (`test/mapa.test.js`), okablowanie
end-to-end przez `start()` → warstwę SVG (`test/aplikacja.test.js`, dwa testy:
klucz poprawny i klucz błędny), kontrakt na obecność eksportów, na `https:`
w walidacji i na czystość `mapa.js`.
