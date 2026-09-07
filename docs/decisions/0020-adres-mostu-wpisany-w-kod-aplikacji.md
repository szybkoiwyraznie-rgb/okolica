# 0020 — Adres mostu Drive wpisany w kod aplikacji (bez pola do wpisywania w UI)

- Status: Zaakceptowana
- Data: 2026-09-07

## Kontekst

Po domknięciu M11/M12 (ADR 0019) właściciel dostał w czacie instrukcję
wdrożenia mostu Drive (ADR 0018 pkt 3), w której ostatnim krokiem było
wklejenie adresu web app **w aplikacji** — w dwóch miejscach: „Źródło
repozytorium (zaawansowane)" na karcie paczek i „Adres mostu (Apps Script)"
w karcie gry wieloosobowej. Właściciel zakwestionował ten krok:

> „Przecież te zmiany muszą zostać naniesione w repozytorium, a nie na Pages?
> Co z tego, że ja to wpiszę w aplikację skoro źródło w repozytorium nie będzie
> tych danych? Każdy następny build nie będzie ich miał. Wydaje mi się, że te
> dane muszą być wpisane w repozytorium, żeby były trwałe i dostępne za każdym
> razem gdy utworzę nową wersję aplikacji webowej."

Stan faktyczny (wyjaśniony właścicielowi): adres trzymany w `localStorage`
jest przypięty do **adresu strony**, nie do wersji kodu — nowa wersja
aplikacji go nie kasuje. Obawa „build to wykasuje" była więc nieuzasadniona.
**Ale zastrzeżenie wskazało prawdziwy problem**: adres musiało znać KAŻDE
urządzenie, a w grze wieloosobowej (ADR 0019) każdy telefon uczestnika sam
synchronizuje się z mostem. Znajomy zaproszony do gry musiałby raz ręcznie
wkleić adres, a po wyczyszczeniu danych przeglądarki — wkleić go ponownie.
To bariera wejścia sprzeczna z celem „gra dla właściciela i kilku znajomych"
(ADR 0019, BACKLOG B17).

Siły:

- aplikacja statyczna bez kroku budowania (ADR 0001) — nie ma mechanizmu
  wstrzykiwania konfiguracji w czasie budowania; jedynym „miejscem na stałą"
  jest kod w repozytorium;
- repozytorium jest **publiczne** (wymóg GitHub Pages na darmowym koncie,
  ADR 0002) — cokolwiek trafi do kodu, jest czytelnym dla każdego adresem;
- most nie ma logowania ani klucza API (ADR 0016): adres web app jest
  zdolnością (capability), a nie sekretem — ale zdolnością, którą można
  wykorzystać (wysłać paczkę do przeglądu, założyć grę, dopisać wiersz rankingu);
- zatwierdzanie paczek jest chronione osobno: link z e-maila niesie
  `REVIEW_SECRET` z script properties (ADR 0017 pkt 5), więc znajomość adresu
  nie pozwala niczego zaakceptować;
- prywatność graczy nie zależy od adresu: współrzędne nigdy nie opuszczają
  urządzenia (ADR 0013, ADR 0019 pkt 3), a most nie zbiera danych osobowych
  poza pseudonimem podanym dobrowolnie.

## Decyzja

Właściciel 2026-09-07 (ankieta w czacie) wybrał wariant najprostszy dla
użytkownika i najmniej opcji w interfejsie:

1. **Adres mostu jest stałą w kodzie aplikacji**: `DOMYSLNY_URL_MOSTU`
   w `app/most.js`, wpisaną w repozytorium. Jeden adres obsługuje wszystkie
   trzy zadania mostu (paczki, gry, rankingi — ADR 0018), więc stała jest
   jedna i współdzielona przez `odswiezPropozycjeZestawow()`,
   `sprawdzPolaczenieZRepo()`, `wyslijZestawNaDrive()`, grę wieloosobową
   i rankingi.
2. **Pola do wpisywania adresu znikają z interfejsu**: usunięte
   `#pole-url-repo` z przyciskiem „Zapisz źródło i odśwież" (karta paczek)
   oraz `#multi-url-mostu` z przyciskiem „Zapisz" (karta gry wieloosobowej).
   W ich miejsce jawny stan: `#most-stan-repo` i `#multi-most-stan`
   („podłączony" / „niepodłączony"), bo użytkownik ma widzieć, czy wspólne
   funkcje działają, choć ich nie konfiguruje (LESSONS L6). Przycisk
   „🔌 Sprawdź połączenie" zostaje — to jedyna diagnostyka CORS/redirect
   z ryzyk ADR 0016 dostępna w terenie.
3. **Nadpisanie techniczne zostaje, ale bez interfejsu**: `adresMostu()`
   czyta najpierw klucze `localStorage` (`okolica:multi:url-mostu`,
   `okolica:repo-zestawow:url`), dopiero potem stałą. Furtka służy testom
   (atrapa mostu) i awarii („nowy adres już działa, nowa wersja aplikacji
   jeszcze nie dojechała"). Nie ma w UI żadnego sposobu, by ją ustawić.
4. **Bez dodatkowego klucza dostępu w moście** (decyzja właściciela): klucz
   musiałby siedzieć w publicznym kodzie aplikacji, więc nie chroniłby przed
   nikim, kto ten kod czyta. Zostają istniejące sprawdzenia po stronie mostu:
   kod gry, `organizatorId`, `graczId`, bramka tur, `REVIEW_SECRET` w linku
   przeglądu.
5. **Kolejność wdrożenia**: mechanizm powstał z PUSTĄ stałą (aplikacja mówi
   wtedy wprost, że wspólne funkcje są wyłączone, i działa lokalnie). Prawdziwy
   adres właściciel poda w czacie po wdrożeniu web app; trafia on do
   `DOMYSLNY_URL_MOSTU` jednym commitem razem z podbiciem cache-bustingu.

## Konsekwencje

**Zyski**

- Zero konfiguracji na każdym urządzeniu: telefon znajomego działa od razu
  (warunek gry wieloosobowej bez instruktażu).
- Adres jest wersjonowany razem z kodem: wiadomo, która wersja aplikacji z którym
  mostem rozmawia; koniec z rozjazdem „na moim telefonie działa".
- Mniej interfejsu: dwa pola, dwa przyciski i dwa `<details>` zniknęły
  (mobile-first, ADR 0011).

**Koszty i ryzyka**

- **Adres jest publiczny** — jak cały kod aplikacji na GitHub Pages. Obcy,
  który go pozna, może: wysłać paczki do przeglądu (e-maile do właściciela),
  założyć grę w lobby, dopisać wiersze do rankingów, zużyć limit wykonań
  Apps Script. Nie może: zatwierdzić paczki (`REVIEW_SECRET`), odczytać
  współrzędnych graczy (nie opuszczają telefonu), zobaczyć danych osobowych
  (poza pseudonimami, które sam musiałby znać), zmienić kodu aplikacji.
- **Reakcja na nękanie**: w Apps Script nowe wdrożenie (Deploy → New
  deployment) daje NOWY adres `/exec`; właściciel podaje go w czacie, agent
  wpisuje do `DOMYSLNY_URL_MOSTU` i podbija cache-busting. Stare wdrożenie
  można usunąć. To procedura jawna, nie „łatka w kodzie".
- **Rotacja adresu wymaga wydania wersji** (commit + scalenie do `main`, bo
  Pages serwuje `main` — ADR 0002). Dlatego pkt 3 (nadpisanie w pamięci)
  zostaje jako droga awaryjna dla pojedynczego telefonu.
- Pusta stała (stan obecny, do wdrożenia właściciela) oznacza, że wspólne
  paczki, gry sieciowe i rankingi są wyłączone — aplikacja musi to mówić
  wprost, nie milczeć (testy: `test/most.test.js`, `test/wieloosobowa-ui.test.js`).

**Wymagana spójność dokumentów**

- AGENTS.md §4 („zero backendu i zero sekretów w repo") dostaje dopisek: adres
  mostu nie jest sekretem, jest publicznym punktem końcowym (ADR 0016/0018/0020).
- ADR 0016 i 0018 dostają aneksy: adres podaje się w czacie, a nie wkleja w UI.
- ASSETS §7, README i WORKFLOW §4.4 opisują stan po zmianie.

## Powiązania

- ADR 0001 (vanilla, brak builda — stała w kodzie to jedyna opcja),
- ADR 0002 (Pages z `main`, repo publiczne),
- ADR 0013 / 0019 pkt 3 (prywatność: współrzędne na urządzeniu — niezależna
  od znajomości adresu),
- ADR 0016 (most Drive jako backend; ryzyko CORS i próba „🔌 Sprawdź połączenie"),
- ADR 0017 pkt 5–6 (`REVIEW_SECRET`, tylko odczyt indeksu i paczek),
- ADR 0018 (Drive wielozadaniowy; instrukcja wdrożenia w czacie),
- LESSONS L6 (jawny status), L28 (`localStorage` przeżywa rebuild — problemem
  jest wiele urządzeń), L29 (cache-bust `?v=` podbijamy we WSZYSTKICH modułach).
