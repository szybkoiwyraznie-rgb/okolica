# ASSETS — dostawcy danych i kafelków, polityki użycia, atrybucje

> Dokument trwały. Każdy dostawca, którego aplikacja woła w przeglądarce,
> MUSI tu mieć wpis: adres, politykę, limit, atrybucję i datę sprawdzenia
> polityki. Nowy dostawca = wpis tutaj + nowy ADR (ADR 0013 pkt 2).
> Ostatnia weryfikacja polityk: **2026-09-05** (kwerenda `web_search`).

## 0. Zasady ogólne

- **Tylko dostawcy bez klucza API i bez rejestracji** (ADR 0001: zero
  sekretów w repo, zero konta dla gracza).
- **Wszystkie zapytania idą z przeglądarki użytkownika** — nie z sandboxa
  (LESSONS L3), nie z żadnego serwera pośredniego (brak backendu).
- `Referer` jest ustawiany automatycznie przez przeglądarkę (adres GitHub
  Pages) i to on identyfikuje aplikację wobec polityk OSM/Overpass.
  `User-Agent` w `fetch` z przeglądarki jest nieustawialny (nagłówek
  zabroniony) — dlatego **nie polegamy na UA**, a polityki wymagają
  „User-Agent **albo** Referer".
- **Cache po naszej stronie jest obowiązkiem, nie optymalizacją**: polityki
  OSM i Overpass wprost wymagają ograniczania liczby zapytań.
- Atrybucja OSM (ODbL) jest **zawsze widoczna** pod mapą, nie schowana
  w „o aplikacji".

## 1. Kafelki mapy (podkład rastrowy, ADR 0003)

| Klucz | Dostawca / URL | Klucz API | maxZoom | Atrybucja | Polityka i ryzyka |
| --- | --- | --- | --- | --- | --- |
| `osm` | OSM Standard — `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | nie | 19 | `© OpenStreetMap contributors (ODbL)` | [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): zakaz masowego pobierania i ciężkiego użycia, wymagany poprawny `Referer`/UA, ograniczona liczba hostów, serwery z darowizn. Użycie „lekkie" (kilkanaście kafelków na ekran, kilka gier dziennie) jest w polityce; aplikacja nie pobiera kafelków hurtowo ani nie buduje własnego cache poza cache przeglądarki. |
| `opentopo` | OpenTopoMap — `https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png` | nie | 17 | `© OpenStreetMap contributors · © OpenTopoMap (CC-BY-SA)` | Bez klucza, CC-BY-SA. **Ryzyko trwałości usługi**: serwis rastrowy bywa przeciążony, a jego przyszłość jest dyskutowana publicznie ([issue #382 „Reviving the OpenTopoMap (Raster) tile service?", 2025-11](https://github.com/der-stefan/OpenTopoMap/issues/382)). Dlatego warstwa jest opcjonalna i przełączalna w UI, a jej zniknięcie nie może psuć gry (ADR 0003 pkt 3: „podkład wyłączony"). |
| `esri-satelita` | Esri World Imagery — `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | nie | 19 | `Powered by Esri · © Esri, Maxar, Earthstar Geographics` | Używany tak samo jak w projekcie AME (wzorzec właściciela). Uwaga na kolejność `y`/`x` w URL (odwrotnie niż w schemacie XYZ). Warstwa pomocnicza: rozpoznawanie obiektu w terenie, nie nawigacja. |
| `osm-fr` *(opcja)* | OSM France — `https://{a,b,c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png` | nie | 20 | `© OpenStreetMap contributors · © OSM France` | Kandydat na podkład zapasowy (inny rendering, wyższe zoomy). Wprowadzamy dopiero po sprawdzeniu polityki OSM France — **nie jest jeszcze zatwierdzony**. |

### 1.1 Dostawcy sprawdzeni i ODRZUCENI

- **CARTO basemaps (Voyager/Positron/Dark Matter)** — odrzucone 2026-09-05:
  dostęp do serwisu kafelków wymaga **klucza API** (darmowy próg 5 mln żądań
  miesięcznie, klucz bez konta, ale bez klucza kafelki mają znak wodny
  „API key required"), a same **rastery są rozważane do wygaszenia**
  ([CARTO FAQ — Basemaps](https://docs.carto.com/faqs/carto-basemaps));
  licencja styli wprost ogranicza dostęp do serwisu kafelków
  ([CartoDB/basemap-styles LICENSE](https://github.com/CartoDB/basemap-styles/blob/master/LICENSE.md)).
  Klucz = sekret i konto = złamanie ADR 0001 i ADR 0013 pkt 1.
- **OpenFreeMap** — odrzucone na tym etapie: instancja publiczna jest darmowa,
  bez klucza, bez limitów i bez ciasteczek ([openfreemap.org](https://openfreemap.org/)),
  ale projekt **wprost nie serwuje kafelków rastrowych** — tylko wektorowe
  ([hyperknot/openfreemap — Limitations](https://github.com/hyperknot/openfreemap)).
  Render wektorowych kafelków (MVT/pbf) bez MapLibre GL to osobny, duży projekt.
  Wraca jako opcja, jeśli właściciel kiedykolwiek zaakceptuje zależność
  (`docs/BACKLOG.md` B15).
- **Maptoolkit.org / VersaTiles** — jak wyżej: wektorowe, wymagają MapLibre.
- **Stadia/Stamen, Geoapify, Thunderforest, MapTiler, Jawg** — warstwy darmowe
  wymagają rejestracji i klucza → odrzucone (ADR 0001).
- **Wikimedia maps (`maps.wikimedia.org`)** — serwis przeznaczony dla projektów
  Wikimedia; zewnętrzne użycie ograniczone → odrzucone jako domyślny podkład.

## 2. Sieć drogowa i nazwy miejsc (Overpass API, ADR 0005)

| Instancja | URL | Limity / polityka | Rola w aplikacji |
| --- | --- | --- | --- |
| **główna (FOSSGIS)** | `https://overpass-api.de/api/interpreter` | [Polityka](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances): < 10 000 zapytań/dobę i < 1 GB/dobę przy użyciu jednorazowym; **dla aplikacji/strony limity dzielone przez 100** (≈ 100 zapytań i 10 MB/dobę, liczone jako suma ruchu WSZYSTKICH użytkowników); wymagany `User-Agent` **albo** `Referer` identyfikujący aplikację; brak równoległych zapytań; przy `429`/`406` pauza 30 s; serwis bywa przeciążony — „use alternatives if possible". | domyślna |
| **private.coffee** (dawniej kumi.systems) | `https://overpass.private.coffee/api/interpreter` | bez limitu zapytań (prośba o zgłaszanie dużych projektów z wyprzedzeniem) | zapasowa 1 |
| **VK Maps** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` | bez limitów deklarowanych | zapasowa 2 |
| Geofabrik / Tracestrack / FairwayMapper / Overspan | z kluczem w URL | płatne albo wymagane konto | **odrzucone** (ADR 0001) |

Zasady użycia w kodzie:

1. **Jedno zapytanie na grę** (`[out:json][timeout:25]`), nie „na każdy ruch
   mapy". Promień `R × 1.15`, pozycja zaokrąglona do ~5 m (ADR 0013 pkt 3).
2. **Cache `okolica:sieci:<geohash6>-<R>`** z TTL 30 dni (ADR 0010) — druga
   gra w tej samej okolicy nie woła sieci wcale.
3. **Sekwencyjnie, nigdy równolegle**; przy `429`/`504` — odstęp 30 s i
   przełączenie na instancję zapasową, z komunikatem dla użytkownika.
4. Budżet rozmiaru odpowiedzi: dla `R = 10 km` (tryb samochodowy) dzielimy
   bbox na ćwiartki i pobieramy sekwencyjnie (ADR 0005, konsekwencje).
5. Nazwa miejsca do promptu (`{MIEJSCE}`) pochodzi z **tego samego zapytania**
   (obszary administracyjne `is_in`/`boundary=administrative`), nie z
   Nominatim — patrz §3.

## 3. Odwrotna geokodacja — domyślnie NIE używamy Nominatim

- **Rozwiązanie przyjęte**: nazwę miejsca (dzielnica, miasto, region, państwo)
  wyciągamy z obszarów administracyjnych zwróconych przez Overpass
  (`is_in(lat,lon)` + `area["boundary"="administrative"]`). Jeden dostawca,
  jedno zapytanie, zero dodatkowej polityki.
- **Nominatim publiczny** (`https://nominatim.openstreetmap.org/reverse`) jest
  dopuszczony **wyłącznie jako opcjonalna warstwa zapasowa**, po spełnieniu
  [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/):
  maks. **1 żądanie/s**, poprawny `Referer`/UA identyfikujący aplikację,
  widoczna atrybucja ODbL, obowiązkowy cache, zakaz zapytań systematycznych
  i okresowych, oraz gotowość do **przełączenia usługi na żądanie OSMF bez
  aktualizacji oprogramowania** (konfigurowalny endpoint).
  Polityka zawiera też klauzulę dotyczącą systemów LLM i platform
  niskokodowych — dlatego ten wpis jest jawny i widoczny w dokumentacji,
  a decyzja o użyciu jest świadoma i należy do właściciela (ADR 0013).
- Domyślnie warstwa jest **wyłączona** w setupie (ADR 0013 pkt 3).

## 4. Dane i licencje

- **OpenStreetMap** — dane © OpenStreetMap contributors, licencja **ODbL**
  (uznanie autorstwa + copyleft dla baz danych). Atrybucja w aplikacji pod
  mapą i w `README.md`.
- **OpenTopoMap** — kartografia **CC-BY-SA 4.0** (wymaga dodatkowo uznania
  OpenTopoMap).
- **Esri World Imagery** — warunki Esri; atrybucja jak w §1.
- **Treść pytań** — pochodzi od modelu AI na podstawie źródeł z kwerendy
  (ADR 0008). Każde pytanie niesie `zrodla[]` z adresem i tytułem; to my
  pokazujemy źródło graczowi, więc odpowiedzialność za atrybucję cytowanych
  materiałów zostaje po stronie organizatora paczki. Paczki publikowane
  publicznie (ADR 0010 pkt 4) wymagają decyzji o licencji treści — **osobny
  ADR przed M9**.
- Assety własne (ikony `assets/ikony/*.svg`, manifest) — tworzone w projekcie,
  bez materiałów zewnętrznych; jeśli pojawi się materiał z zewnątrz, dostaje
  wpis tutaj.

## 5. Checklista przy zmianie lub dodaniu dostawcy

1. Sprawdź politykę **dziś** (`web_search` + `fetch_page`) i zapisz datę
   sprawdzenia — polityki się zmieniają: CARTO było przez lata „darmowe bez
   klucza", w 2026 wymaga klucza (LESSONS L8).
2. Wpis w tym pliku: URL, klucz (musi być „nie"), maxZoom/limity, atrybucja,
   ryzyka trwałości.
3. Nowy ADR albo aktualizacja istniejącego (ADR 0003/0005/0013).
4. Atrybucja w UI (pod mapą, zawsze widoczna) + w `README.md`.
5. Test kontraktowy: tabela dostawców w kodzie ↔ ten plik (nazwy i atrybucje).
6. Sprawdzenie degradacji: co się stanie, gdy dostawca zniknie albo zwróci 429.
