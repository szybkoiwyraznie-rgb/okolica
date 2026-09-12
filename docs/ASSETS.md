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

### 1.0 Jak kod zapisuje szablony (kontrakt z `app/mapa.js`)

`SZABLONY_KAFELKOW` w `app/mapa.js` ma dokładnie te URL-e co tabela wyżej, z jedną
różnicą zapisu: rotację poddomen kod wyraża jako `{s}` z listą
`PODDOMENY = ['a', 'b', 'c']`, a wybór poddomeny jest **deterministyczny**
(`(x + y) % 3`) — losowy psułby cache przeglądarki i testy. Test kontraktowy
(`test/kontrakt.test.js`) porównuje szablony po ujednoliceniu zapisu
(`{s}` → `{a,b,c}`), więc zmiana URL-a u dostawcy wymaga zmiany w obu miejscach.
Podkład `brak` ma szablon `null`: zero żądań, zero atrybucji dostawcy.

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
| **Adikso (Polska, wskazany przez właściciela)** | `https://overpass.osm.adikso.net/api/interpreter` | Polityka i zasięg niepotwierdzone; próba HTTPS z sandboxa: błąd TLS. Dodany do prób na wyraźne życzenie właściciela, bez gwarancji dostępności. | zapasowa 3; po sukcesie pierwsza |
| Geofabrik / Tracestrack / FairwayMapper / Overspan | z kluczem w URL | płatne albo wymagane konto | **odrzucone** (ADR 0001) |

Zasady użycia w kodzie:

1. **Jedno zapytanie na grę** (`[out:json][timeout:8]`), nie „na każdy ruch
   mapy". Promień `R × 1.15`, pozycja zaokrąglona do ~5 m (ADR 0013 pkt 3).
2. **Cache `okolica:sieci:<geohash6>-<R>`** z TTL 30 dni (ADR 0010) — druga
   gra w tej samej okolicy nie woła sieci wcale.
3. **Sekwencyjnie, nigdy równolegle**; przy `429`/`406`/`5xx` — krótki
   odstęp 1 s i przełączenie na instancję zapasową, z komunikatem dla
   użytkownika (właściciel, 2026-09-09: 30 s odstępów między serwerami jest
   za dużo — łańcuch i tak zmienia serwery, a limit publiczny nie minie
   w sekundy). Timeout/brak odpowiedzi to MARTWA instancja: przełączenie
   jest OD RAZU, bez pauzy — nie ma kogo szanować pauzą (2026-09-07).
   Adres instancji, która dowiozła, ląduje w `okolica:overpass-sprawny`
   i daje jej **pierwszeństwo przed wszystkimi pozostałymi** (aneks ADR 0035).
   Bez zapisu: FOSSGIS → private.coffee → VK Maps → Adikso. Każda próba ma
   **10 s na nagłówki i ciało**, z limitem wykonania QL 8 s. Timeout
   zawsze przełącza dalej, niezależnie od nazwy błędu przeglądarki.
   HTTP 403/404 również przełącza dalej; HTTP 400 kończy błędne zapytanie.
   Lista prób z numerem, serwerem i wynikiem jest widoczna wyłącznie w panelu ⓘ Informacje.
4. Budżet rozmiaru odpowiedzi: dla `R = 10 km` (tryb samochodowy) dzielimy
   bbox na ćwiartki i pobieramy sekwencyjnie (ADR 0005, konsekwencje).
5. Nazwa miejsca do promptu (`{MIEJSCE}`) pochodzi z **tego samego zapytania**
   (obszary administracyjne `is_in`/`boundary=administrative`), nie z
   Nominatim — patrz §3.

## 3. Odwrotna geokodacja — Nominatim USUNIĘTY (2026-09-11), zostaje Overpass

- **Rozwiązanie przyjęte**: nazwę miejsca (dzielnica, miasto, region, państwo)
  wyciągamy z obszarów administracyjnych zwróconych przez Overpass
  (`is_in(lat,lon)` + `area["boundary"="administrative"]`). Jeden dostawca,
  jedno zapytanie, zero dodatkowej polityki. Stacje dopisują miasto do nazwy
  („ulica, miasto") — ulice o tej samej nazwie powtarzają się między miastami.
- **Warstwa zapasowa z Nominatim jest USUNIĘTA z kodu** (decyzja właściciela,
  uwagi terenowe #3, 2026-09-11): docelowe rozwiązanie z powyższego punktu
  działa bez fallbacku, a opt-in wraz z przełącznikiem zniknął z ekranu
  prywatności i z `app/sieci.js` (`budujUrlGeokodacji`, `miejsceZOdpowiedziNominatim`,
  `DOMYSLNY_ENDPOINT_GEOKODACJI`). Kontrakt `test/kontrakt.test.js` pilnuje,
  żeby endpoint nie wrócił do żadnego modułu.
- Historyczne uzasadnienie opt-inu (dla porządku, już nieobowiązujące):
  [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
  pozwalała warstwę zapasową pod warunkami 1 żądanie/s, atrybucji ODbL,
  cache i gotowości do przełączenia endpointu na żądanie OSMF (ADR 0013).

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

## 6. Audyt dostawców (M8, 2026-09-06)

Przeprowadzony check-listą z §5 przed publikacją na Pages. Zakres: zgodność
kod ↔ ten plik oraz reweryfikacja polityk „na dziś".

**Zgodność kod ↔ dokumentacja:**

- `SZABLONY_KAFELKOW` (`app/mapa.js`) == tabela §1 — egzekwuje kontrakt
  (`test/kontrakt.test.js`, test „szablony URL kafelków…", porównanie po
  ujednoliceniu `{s}` → `{a,b,c}`).
- Klucze `PODKLADY` (`app/konfig.js`) mają wpisy w §1 — egzekwuje kontrakt;
  osobny kontrakt pilnuje, że CARTO nie wróci do kodu (§1.1).
- `INSTANCJE_OVERPASS` (`app/sieci.js`) == tabela §2 co do URL-i (FOSSGIS →
  private.coffee → VK Maps → Adikso); sprawdzenie ręczne (tabela w markdown nie jest
  parsowana w testach — świadomie, §2 niesie też opisy polityk).
- Nominatim: §3 — warstwa zapasowa usunięta 2026-09-11 (kontrakt pilnuje
  nieobecności endpointu w `app/`); archiwalnie: był opt-in z komunikatem w UI
  i cache sesyjnym.
- Atrybucje ZAWSZE widoczne pod mapą: `#mapa-pozycja-atrybucja` i
  `#mapa-stacje-atrybucja` (`index.html`) + test bootstrapa.

**Reweryfikacja polityk (2026-09-06, `web_search`):**

- OSM Tile Usage Policy: bez zmian istotnych dla nas — ważny UA *albo*
  Referer, widoczna atrybucja, cache lokalny ≥7 dni/Expires, zakaz ciężkiego
  użycia. Nasz profil (jeden ekran kafelków naraz, cache przeglądarki)
  mieści się w polityce; brak akcji.

  **Korekta 2026-09-09 (zgłoszenie D1).** Sufit `MAX_KAFELEK` podniesiony z 48
  do 120. Powód: 48 to było mniej, niż potrzebuje JEDEN ekran desktopowy
  (1920×900 przy zoomie 16 = siatka 9×6 z marginesem, czyli 54 kafelki), więc
  limit nie chronił przed hurtowym pobieraniem, tylko wycinał dolny-prawy róg
  mapy. 120 nadal odpowiada jednemu ekranowi z zapasem (QHD w orientacji
  poziomej), a nie pobieraniu obszarów na zapas — profil „lekki” zostaje bez
  zmian. Przycinanie odrzuca teraz kafelki najdalsze od środka, więc nawet po
  przekroczeniu sufitu widoczny obszar jest pełny.
- Overpass: instancja główna (FOSSGIS) bez zmian; **uwaga**: pojedynczy raport
  użytkownika (Reddit, 2026-03) opisuje 403/time-outy na instancjach
  zapasowych (VK Maps, private.coffee), podczas gdy blog GIS (2026-04)
  wymienia private.coffee wśród działających mirrorów — świadectwa
  sprzeczne, prawdopodobnie zależne od profilu ruchu. Nasza odpowiedź jest
  już w kodzie: łańcuch fallbacków + jawna degradacja (komunikat zamiast
  cichego błędu) + fixture i tryb testowy offline; brak akcji, obserwować.
- Nominatim i Esri: noty z 2026-09-05 (odpowiednio: dawny opt-in za zgodą
  polityki — usunięty 2026-09-11, §3; wzorzec AME bez zmian).

**Wniosek:** zero rozjazdów kod ↔ dokumentacja, zero zmian wymagających
akcji; nowy dostawca przechodzi pełną checklistę §5.

## 7. Repozytorium paczek — Google Drive + Apps Script (infrastruktura właściciela, M9b)

- **Dostawca**: wydzielone konto Google właściciela; most = web app Apps
  Script (`docs/setup/apps-script-repo-paczek.gs`, wdrożenie:
  `docs/setup/most-drive-instrukcja.md` — wersja robocza; finalna instrukcja
  dla właściciela w czacie, ADR 0018).
- **Co płynie**: DO Drive — kandydaci na zestawy (TO-zestaw/1: meta + stacje
  + ukryty kontener pytań) wysyłani automatycznie i bez pytania przy przyjęciu
  paczki (decyzja 2026-09-07: checkbox zgody usunięty, ADR 0016 aneks). Z Drive — tylko
  indeks zaakceptowanych (`?akcja=indeks`) i paczki (`?akcja=paczka&id=…`).
- **Klucze i polityka**: BRAK kluczy API w kodzie; adres web app jest zdolnością
  (capability) i od ADR 0020 jest WPISANY W KOD aplikacji (`DOMYSLNY_URL_MOSTU`
  w `app/most.js`) — publiczny jak cała aplikacja na Pages, rotacja = nowe
  wdrożenie web app + nowy commit; sekrety mostu (`REVIEW_SECRET`, `OWNER_EMAIL`)
  żyją wyłącznie w Script Properties konta Google. POST-y `text/plain` (bez
  preflightu CORS); aplikacja tylko czyta — nigdy nie usuwa i nie edytuje na Drive.
- **Prywatność (ADR 0013)**: współrzędne w wysyłanym zestawie to stacje gry
  (przestrzeń publiczna) + geohash5 okolicy, bez śledzenia gracza; moderacja
  właściciela (e-mail z linkiem przeglądu) jest bramą przed udostępnieniem.
- **Licencje**: treści zestawów CC BY-SA 4.0 (ADR 0017); pola `licencja`
  i `przegladZrodel` wymagane w każdym kandydacie.
- **Awaria/rotacja**: `REVIEW_SECRET` w script properties do rotacji; odrzucanie
  ręczne przez przeniesienie pliku w katalogu Drive; brak mostu nie blokuje gry
  (kopia lokalna + zwykła ścieżka prompt→model).
- **Docelowo (ADR 0018)**: to samo konto obsłuży parowanie gier na wielu
  urządzeniach (M11) i profil/statystyki gracza (M12) — ta sekcja będzie rosła.

### 7.1 Gry i historia gier (M11/M12, ADR 0019) — ruch na tym samym moście

- **Katalogi**: `okolica-gry-otwarte` (lobby i trwające) oraz
  `okolica-gry-zakonczone` (zakończone i archiwum); jedna gra = jeden plik
  JSON nazwany kodem gry.
- **Quota**: polling z interwałami zależnymi od fazy (lobby 10 s, wyścig 12 s,
  tury: moja 10 s / czekam 30 s, zakończona 0). Orientacyjnie: wyścig 4 graczy
  ≈ 20 GET/min w szczycie; POST-y tylko przy zdarzeniach — gra 5-stacyjna to
  ≈ 10–12 POST-ów na gracza. Zapisy szereguje `LockService` (20 s), lista
  zdarzeń jest append-only, a aplikacja jest idempotentna wobec powtórek.
- **Licencje**: plik gry niesie kontener pytań `TO-paczka/2` (treści CC BY-SA
  4.0 jak paczki) — dostęp tylko dla graczy tej gry (kod albo `idGry` z lobby;
  lobby NIE pokazuje kodów ani zestawów).
- **Prywatność**: współrzędne graczy nigdy nie trafiają na Drive (biała lista
  pól zdarzenia + kasowanie `lat/lon/...` po stronie mostu); w konfiguracji
  gry jest tylko geohash5 i nazwa miejsca.
