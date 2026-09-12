# LESSONS — rejestr lekcji

Format: `## LN (pochodzenie) — tytuł`, objaw → przyczyna → reguła; bez nawiasu = ten projekt.
Czytasz CAŁY rejestr na start sesji (`AGENTS.md` §0). Nowe lekcje dopisuj na
końcu — nigdy nie zmieniaj numeracji istniejących. Pełne historie sesji:
`docs/PROJECT_HISTORY.md`.

Lekcje L1–L5 są **dziedziczone z projektu AME** właściciela (zmierzone w tamtym
sandboxie w 2026-08/09); dotyczą tego samego środowiska, a koszt ich ponownego
odkrycia jest realny. Od L6 wzwyż — obserwacje z tego projektu.

## L1 (dziedziczone z AME) — sandbox resetuje workspace w trakcie sesji

**Objaw:** commity „znikają", HEAD wskazuje `main`, push odrzucony.
**Przyczyna:** środowisko odtwarza workspace ze świeżego klona.
**Reguła:** praca istnieje dopiero po `git push`; po resecie postępuj wg
`docs/setup/ENVIRONMENT.md` §2 (fetch gałęzi sesji + `reset --hard FETCH_HEAD`
+ `push -u`).

## L2 (dziedziczone z AME) — edycja plików z polskimi znakami

**Objaw:** mojibake po edycji (`Ä…` zamiast `ą`), obce glify w polskim zdaniu.
**Przyczyna:** narzędzie `edit_file` potrafi uszkodzić UTF-8.
**Reguła:** nowe pliki twórz `write_file`; istniejące z polskim tekstem edytuj
przez `python3` + `pathlib` z `encoding='utf-8'`; po edycji sprawdzaj
`git diff` i grepem `grep -n '[^\\x00-\\x7FĄ-ż]'` podejrzany fragment.

## L3 (dziedziczone z AME) — egress HTTPS zablokowany, npm działa

**Objaw:** `curl https://…` → kod 000/SSL_ERROR.
**Przyczyna:** sandbox przepuszcza tylko wybrane hosty (`api.github.com`, `registry.npmjs.org`).
**Reguła:** danych z sieci nie pobieraj curl/fetch w sandboxie — użyj narzędzi
agenta (`fetch_page`, `web_search`). Overpass, kafelki i Nominatim testuj
**w przeglądarce** (live preview) albo na fixture'ach w `test/fixtures/`, nigdy
w `npm test`.

## L4 (dziedziczone z AME) — agent nie zapisze pliku CI

**Objaw:** push gałęzi z `.github/workflows/ci.yml` → 403 `workflows`.
**Przyczyna:** 403 był przywiązany do *instancji* tokena GitHub App, nie do
trwałych uprawnień — po odświeżeniu tokena (2026-09-06) push przeszedł i CI odpaliło.
**Reguła:** **najpierw spróbuj pusha**, dopiero przy 403 fallback: recepturę CI
trzymaj jako lustro w `docs/setup/ci-workflow.yml` i pilnuj testem, że nie
rozjeżdża się z live (edytuj jedno — edytuj oba). Brak zielonego CI to **znany
fakt**, nie bloker. Przy odwracaniu założeń przeglądaj testy, które stare
założenie betonują.

## L5 (dziedziczone z AME) — `npm test | grep` w łańcuchu maskuje czerwony test

**Objaw:** `npm test | grep -c fail && echo OK` drukuje `OK` przy czerwonych testach.
**Przyczyna:** kod wyjścia potoku to kod `grep`, nie `npm test`.
**Reguła:** w łańcuchu warunkowym uruchamiaj testy BEZ potoku
(`npm test > /tmp/t.log 2>&1 && …`), log oglądaj osobnym poleceniem; albo
najpierw samo `npm test` (patrzysz na exit code).

## L6 (dziedziczone z AME) — API Node w kodzie przeglądarki: pusta warstwa, testy zielone

**Objaw:** moduł w `app/` importuje `node:crypto`; testy zielone, w przeglądarce martwa warstwa.
**Przyczyna:** `node --test` uruchamia kod w Node, gdzie te API istnieją.
**Reguła:** w `app/` wyłącznie API przeglądarki i standardu
(`globalThis.crypto.subtle`, `fetch`, `localStorage`, `navigator.geolocation`);
kontrakt grep`uje `app/**.js` pod kątem `node:` i `require(`.

## L7 — `git add -A` commituje więcej, niż opisuje komunikat

**Objaw:** commit „M0/E1" (`3e61917`) zawierał też cały rejestr ADR (etap E2).
**Przyczyna:** `git add -A` chwyta wszystko w drzewie, niezależnie od komunikatu.
**Reguła:** przed commitem `git status --short` i porównanie plików z zakresem
komunikatu; albo `git add <ścieżki>` jawnie per etap. Rozjazd po pushu:
**nie poprawiaj historii** (zakaz force push, ADR 0012) — opisz w handoffie
i w opisie PR.

## L8 — polityki darmowych dostawców map zmieniają się pod projektem

**Objaw:** CARTO w 2026 wymaga klucza API; „darmowe bez klucza" okazały się
wektorowe (= MapLibre, zakazane ADR 0001).
**Przyczyna:** wybór dostawcy „z pamięci", bez kwerendy; mylenie „darmowe"
z „bez klucza" i „rastrowe" z „wektorowe".
**Reguła:** dostawcę wybierasz **po kwerendzie w dniu decyzji** (`web_search` +
`fetch_page`), wynik z datą trafia do `docs/ASSETS.md` (§5). Sprawdź: klucz,
rastry/wektory, politykę użycia. ADR-y *Proponowane* poprawia się przed
akceptacją — po akceptacji tylko nowy ADR zastępujący.

## L9 — heurystyka tekstowa na podłańcuchach łapie słowa, których nie szukała

**Objaw:** pytanie o II wojnę światową „zakotwiczyło się" w Grabowicach (E14
przepuścił); testy miały tylko przykłady dodatnie.
**Przyczyna:** `includes(rdzen)` szuka podłańcucha: „woj" w „wojna", „kości"
w „ludzkości"; wyraz z dużej litery na początku zdania uchodził za nazwę własną.
**Reguła:** heurystyki na **granicy wyrazu**: rdzeń pasuje do **początku wyrazu**,
tokeny < 4 znaków odpadają, wyrazy pospolite z nazw administracyjnych na własnej
liście (`WYRAZY_POSPOLITE_MIEJSCA`); nazwa własna = wielka litera nie na początku
zdania (wyjątki: `SKROTY_Z_KROPKA`). Każdą regułę testuj **kontrprzykładem
z prawdziwego tekstu**; opis heurystyki w protokole z nazwami list z kodu.
**Dopisek 2026-09-09:** heurystyka E14 została w końcu **usunięta** — nie
dlatego, że była źle napisana, tylko dlatego, że pilnowała reguły, która bywa
fałszywa (pytania ogólne są dopuszczalne, zwłaszcza przy temacie własnym).
Lekcja drugiego rzędu: zanim dopracujesz heurystykę, sprawdź, czy reguła, której
broni, na pewno obowiązuje zawsze. Walidator, który myli się w dobrej wierze,
kosztuje użytkownika całą rundę z modelem.

## L10 — widełki nie chronią przed NaN: `Math.max(1, NaN)` daje NaN

**Objaw:** `liczbaGraczy: "dużo"` z localStorage wchodziła do UI jako NaN;
wychwycił to test bootstrapu na atrapie DOM, nie testy jednostkowe.
**Przyczyna:** `Math.min(Math.max(1, n), 8)` z NaN daje NaN; testy miały
kontrprzykłady liczbowe, ale nie tekstowe — a tekst przychodzi z localStorage.
**Reguła:** clamp dopiero po `Number.isFinite`; wartość nienumeryczna to
**brak danych** → default z kanonu, nie 0/1/NaN. W testach hartowania każda
klasa śmieci ma własny kontrprzykład, a asercja dotyczy **tego, co zostało
wyrenderowane** (commit `78a1bd0`).

## L11 — faza bez akcji wyjścia: testuj przejścia na danych niekompletnych

**Objaw:** paczka 3/5 stacji — gra utknęła w fazie `pytanie` z pustym ekranem,
a `pominStacje()` kasowało pomiar czasu.
**Przyczyna:** przejścia testowane tylko na danych kompletnych; domknięcie
stacji istniało wyłącznie w `zapiszOdpowiedz`.
**Reguła:** model stanów testuj **przejściami na danych brzegowych**; dla każdej
fazy zapisz, która akcja z niej wyprowadza — brak to usterka modelu. Akcja
„pomiń" nie kasuje pomiaru, który się wydarzył (odmowa `G13`; ADR 0010 pkt 6,
ADR 0015 pkt 2–3; commity `8eec03c`, `09faf5c`).

## L12 — łańcuch szukany przepisany z pamięci różni się jedną literą

**Objaw:** splice przerwał się na `AssertionError` (`t.count(stary) == 0`):
`stan.stacji.length` zamiast `stan.stacje.length`.
**Przyczyna:** fragment przepisany z pamięci; przy polskiej odmianie jedna
litera jest niewidoczna przy czytaniu, a decydująca dla `replace`.
**Reguła:** fragment kopiuj z pliku (`sed -n 'X,Yp'`, `grep -n`), nie
przepisuj; przed zamianą asertuj `t.count(stary) == 1`; „ok" drukuj **po**
zapisie. Przy nieudanym porównaniu diagnozuj znak po znaku — „niewidoczny
znak" to zwykle literówka.

## L13 — schowany panel ma rozmiar zerowy, a mapa wraca pusta

**Objaw:** po powrocie na ekran warstwa kafelków pusta (zero `<image>`), choć
widok i zoom się zgadzały.
**Przyczyna:** `getBoundingClientRect()` w sekcji `hidden` zwraca zera;
optymalizacja sygnatury porównała pustą z pustą i nic nie wstawiła.
**Reguła:** komponent mierzony z DOM ma **jawną ścieżkę dla rozmiaru 0**:
`pusty: true`, brak rysowania, **skasowanie pamięci stanu**; aplikacja odświeża
go przy pokazaniu ekranu i przy `resize`. Test: rozmiar 0 → przerysuj →
przywróć → przerysuj → warstwy wróciły (commit `e65f26b`).

## L14 — nasłuch zarejestrowany dwa razy działa dwa razy, a zdejmuje się raz

**Objaw:** „＋" zmieniał zoom o dwa stopnie; po `zniszcz()` gest nadal działał.
**Przyczyna:** podpięcie w pętli własnej **i** w pętli ogólnej; `removeEventListener`
usuwa jedno wystąpienie, drugie przeżywało.
**Reguła:** rejestracja nasłuchów ma **jedno** miejsce; `zniszcz()` przechodzi
tę samą listę. Test: asercja liczby nasłuchów po utworzeniu **i** po zniszczeniu,
potem zdarzenie i sprawdzenie, że stan się nie zmienił (commit `e65f26b`).

## L15 — przy dwóch modelach jednostek test musi przeliczać z powrotem

**Objaw:** koło ±12 m miało promień 152 897 jednostek (świat = 3600); testy „r > 0" zielone.
**Przyczyna:** odwrócone dzielenie przy trzech modelach jednostek (metry ↔ piksele ↔ świat).
**Reguła:** test robi **rundę w obie strony** z niezależnym źródłem + asercja
porządku wielkości względem stałej świata. Funkcje nazywaj z jednostką
(`promienWSwiecie`), przelicznik opisz zdaniem w komentarzu (commit `59b5573`).

## L16 — test nie przejdzie drzwiami, które czytają nieparsowany DOM

**Objaw:** `querySelectorAll('#lista-imion input')` w atrapie puste → K08 odrzucał przejście.
**Przyczyna:** atrapa celowo nie parsuje HTML; ścieżki czytające kolekcję
z wnętrza elementu widzą w teście pustkę.
**Reguła:** (1) test wchodzi inną drogą, albo (2) strażnik czyta
**zweryfikowany stan** (`STAN.konfig`) zamiast DOM. Nie dopisuj parsera HTML
do atrapy dla jednego testu (commit `e65f26b`).

## L17 — kontrakt na zakazany wywołanie grepuje kod, nie prozę

**Objaw:** zakaz `confirm()` oblał na docblocku tłumaczącym zakaz.
**Przyczyna:** test grepował surowy plik, a zakaz dotyczy wywołań, nie słów.
**Reguła:** kontrakt na zakazane API wycina komentarze przed dopasowaniem.
„Nie pisz tych nazw w komentarzach" jest gorsze — komentarz „czemu nie" ma
wartość i będzie powracał (commit `8abb11c`).

## L18 — Node ≥ 18 ma globalny `fetch`: aplikacja w testach dzwoniła w świat

**Objaw:** brama 82 s zamiast 5 s, w logach próby wyjścia na `overpass-api.de`.
**Przyczyna:** `typeof fetch === 'function'` w Node 22 to prawda; atrapa nie
wystawia `window.fetch`, ale gołe `fetch` resolvingowało się na globalne.
**Reguła:** kod przeglądarkowy czyta API sieciowe wyłącznie przez `window.*`,
nigdy gołą nazwę globalną; testy podstawiają atrapę PO imporcie, a kod czyta
ją w chwili wywołania (commit M4/I7).

## L19 — atrapa DOM: `innerHTML = ''` nie kasuje dzieci

**Objaw:** test czytał `children[0]` po re-renderze i widział STARĄ stację.
**Przyczyna:** w atrapie `innerHTML` jest zwykłym polem — `appendChild`
dokładał nowe `li` ZA starymi.
**Reguła:** listy przebudowujemy przez `replaceChildren(...)`; miejsca
z `innerHTML = ''` migrujemy przy okazji. **Zrobione 2026-09-08** (BACKLOG B16):
w `app/app.js` nie zostało ani jedno żywe `innerHTML` — tryby, segmenty, tematy,
selecty, lista stacji i lista usterek budują węzły (`createElement` +
`textContent`), więc atrapa i przeglądarka zachowują się identycznie.

## L20 — nowy helper bez grep-a: `pobierzPlik` zadeklarowany drugi raz

**Objaw:** `Identifier 'pobierzPlik' has already been declared` (splice M5/J4).
**Przyczyna:** helper dodany „z pamięci"; pierwsza deklaracja 140 linii wyżej.
**Reguła:** przed dodaniem helpera: `grep -n "function <nazwa>"` po całym
module — jest, to użyj istniejącej (z jej sygnaturą). Dotyczy też importów
i stałych.

## L21 — test z padającym fetchem bez `odstep=0` czekał 90 sekund na instancje Overpass

**Objaw:** brama 66 s zamiast 8 s; asercje po 150 ms widziały stan sprzed pobrania.
**Przyczyna:** 503 na Overpass → łańcuch przełączania 30 s × 3; warstwa zapasowa
wołana dopiero po jego zakończeniu.
**Reguła:** testy, w których pobranie sieci MA paść, instalują dom
z `search: '?tryb=test&odstep=0'`. Oczekiwania na zaokrągleniach LICZYMY
(`node -e`), nie zgadujemy (`(21.012345).toFixed(5) === '21.01234'`).

## L22 — symulacja dojścia przeżyła tranzycję fazy i nadpisała status gry

**Objaw:** status „Symulacja: fix 9/9…" zamiast „Stacja osiągnięta"; panel
pytania się nie otwierał. Jednostkowo wszystko zielone.
**Przyczyna:** `krokSymulacji` leciał po tranzycji, liczył z pustej historii
i nadpisywał status; interval dostarczył jeszcze fix w fazie pytania.
**Reguła:** każdy generator na `setInterval` sprawdza na każdym kroku — PRZED
i PO zdarzeniu — czy powód jego istnienia trwa, i gaśnie BEZ nadpisywania
statusu. Kamień bez testu „pełna pętla do wyniku" ma nieprzetestowane
spięcie czasowe (M6/R7).

## L23 — oczekiwania asercji pisane z pamięci: tautologia i sparafrazowany komunikat

**Objaw:** tautologia `x.hidden === (false === false ? x.hidden : null)` (nigdy
nie pada); `/można wznowić/` vs „można **ją** wznowić".
**Przyczyna:** teksty oczekiwane z pamięci o kodzie zamiast z kodu (wariant L12).
**Reguła:** przed asercją na komunikat — `grep` DOKŁADNEGO stringa w źródle.
Asercja, której obie strony wyrażają tę samą wartość, jest zakazana: albo
stan PRZED vs oczekiwany literał, albo brak asercji. Tautologia jest gorsza
niż brak testu.

## L24 — regex liczbowy po złączonym textContent przeczytał „142 pkt" z „Gracz 1" + „42 pkt"

**Objaw:** „punkty zwycięzcy: 142" przy maksimum z modelu 60 (test M7/P7).
**Przyczyna:** zrąb skleja tekst potomków bez separatorów (jak przeglądarka):
`Gracz 1` + `42 pkt` = `Gracz 142 pkt`.
**Reguła:** liczby czytaj z KONKRETNEGO elementu (`children[i].textContent`),
nigdy regexem po złączonym textContent przodka; regex tylko zakotwiczony
separatorem wewnątrz JEDNEGO elementu.

## L25 — plikowa atrapa DOM starzeje się, gdy późniejszy test reinstaluje otoczenie

**Objaw:** klik „nie działał" tylko w kontekście całego pliku; izolowany scenariusz zielony.
**Przyczyna:** plik instaluje DOM raz; późniejsze testy podmieniają globale —
klik szedł do starego rejestru, a `$` aplikacji czytał nowy stub.
**Reguła:** test UI dodany PO teście reinstalującym DOM używa WŁASNEJ świeżej
instalacji albo stoi PRZED pierwszą reinstalacją. „Klik nie zadziałał" →
pierwsze podejrzenie to rozjazd rejestrów, nie logika.

## L26 — wrapper timera, który nie zwraca promise'a, oszukuje testy

**Objaw:** `await odpalOstatni()` „wykonał" krok, ale `onStan` nie zdążył się wywołać.
**Przyczyna:** `() => { krok(); }` zwraca `undefined` — `await` nie czekał na nic.
**Reguła:** wrappery funkcji asynchronicznych ZWRACAJĄ promise
(`() => krok()`). Asercja „widząca za mało" po wstrzykniętym timerze →
podejrzenie o niewyczekany promise.

## L27 — dwa „urządzenia" w jednym procesie: globale są współdzielone, tło wchodzi w paradę

**Objaw:** polling urządzenia A lądował w DOM urządzenia B.
**Przyczyna:** `globalThis` jest jedno, a timery odpalają się między
przełączeniami atrap, w środku cudzych `await`.
**Reguła:** (wzorzec: `test/wieloosobowa-ui.test.js`) (1) RĘCZNY harmonogram
w trybie testowym (`?odstep=0` → zero pollingu w tle, test pompuje kroki);
(2) każdy async klik kończy „oddech" PRZED przełączeniem urządzenia;
(3) przełączanie tylko jawnym helperem (`przelaczNa`). Atrapa serwera jako
lustro kontraktu modułu współdzielonego.

## L28 — „nietrwałe" czy „za wąskie"? Konfiguracja w localStorage przeżywa rebuild, ale nie przeżywa nowego telefonu

**Objaw:** właściciel odrzucił ręczne wklejanie adresu mostu w aplikacji.
**Przyczyna:** zastrzeżenie trafne co do ZASIĘGU (każdy telefon znajomego musi
mieć adres), nietrafne co do builda (localStorage przypięty do origin, nie do wersji).
**Reguła:** rozróżniaj TRWAŁOŚĆ (przeżywa build) od ZASIĘGU (jedno urządzenie);
odpowiadaj na to drugie, gdy właściciel mówi „nietrwałe". Stała potrzebna na
każdym urządzeniu w aplikacji bez budowania (ADR 0001) mieszka w KODZIE
W REPOZYTORIUM (ADR 0020) — a publiczność repozytorium staje się częścią modelu
zagrożenia (ADR + procedura rotacji), nie przemilczeniem.

## L29 — cache-bust `?v=` w ESM: query jest częścią identyfikatora modułu, więc podbija się go WSZĘDZIE naraz

**Objaw:** dwa moduły miały starą wersję `?v=` w importach i omal nie weszły do commita.
**Przyczyna:** `./x.js?v=m11-1` i `./x.js?v=m12-1` to DWA różne moduły (dwa
egzemplarze stanu); kontrakt pilnował tylko index.html + app.js.
**Reguła:** podbicie to JEDEN ruch: `sed -i 's/?v=STARA/?v=NOWA/g'
index.html app/*.js` + `WERSJA_SW` w `sw.js`, a `git add index.html app/ sw.js`
— nigdy lista plików z pamięci. Nowy moduł dostaje `?v=` od razu. Kontrakt pilnuje całego grafu
`app/*.js` (od audytu 2026-09-07). Przy podejrzeniu rozjazdu:
`grep -rn "?v=" app/ index.html sw.js` ma pokazać jedną wersję.

## L30 — Overpass: `out` czyta set domyślny, więc drukuj minimum i od razu

**Objaw:** S02 w śródmieściu (w JSON-u same `area`), potem odpowiedź 3–5 minut.
**Przyczyna:** wyniki bez nazwy lądują w secie `_` i każde zdanie go
nadpisuje; a `out geom` dla obszarów drukuje geometrię granic (np. całego
kraju) — megabajty, których parser i tak nie czyta.
**Reguła:** samodzielne zdanie TYLKO z natychmiastowym `out` (wydrukuj, zanim
następne zdanie nadpisze `_`) i drukuj minimum: obszary `out tags`, reszta
w jednej unii `out geom`. Regresja: test kształtu w `test/sieci.test.js`.

## L31 — usunięcie funkcji z UI zostawia jej opis w dokumentach

**Objaw:** README, ASSETS §7 i aneks ADR 0016 opisywały checkbox zgody Drive,
eksport zestawu i przełącznik geokodacji — mechanizmy usunięte z `index.html`
decyzją 2026-09-07; wyłapał to dopiero audyt następnej sesji.
**Przyczyna:** kontrakt pinuje BRAK elementu w `index.html`, ale prozy
README/ASSETS/ADR nie czyta żaden test.
**Reguła:** „funkcja znika z ekranu" = w tym samym commicie grep po README,
ASSETS, ARCHITECTURE, WORKFLOW i ADR-ach (aneks, nie edycja decyzji — L8).

## L32 — asynchroniczne odświeżenie listy bez licznika pokoleń dubluje wpisy

**Objaw:** po dołożeniu listy graczy karta repozytorium pokazywała każdą paczkę
DWA razy (`test/zestawy-ui.test.js`: `2 !== 1`). Setup woła
`odswiezPropozycjeZestawow()` przy każdej zmianie (pozycja, gracze, czas), więc
dwa żądania indeksu nakładały się: oba czyściły listę na starcie, a potem oba
dopisywały swoje dopasowania.
**Przyczyna:** `replaceChildren()` czyści listę synchronicznie, ale dopisanie
wyników jest w `.then()` — starsza odpowiedź nie wie, że jest starsza.
**Reguła:** każde asynchroniczne renderowanie listy ma licznik pokoleń
(`POKOLENIE_PROPOZYCJI`): `const pokolenie = ++LICZNIK` przed żądaniem i
`if (pokolenie !== LICZNIK) return` przed dopisaniem ORAZ w `.catch()`
(komunikat błędu też należy do konkretnego pokolenia).

## L33 — skrypt `.gs` bez testu wykonującego jego ścieżki chowa literówki

**Objaw:** „Graj z tą paczką" → „Paczka z repozytorium jest niekompletna (Plik
publiczny ma inny schemat niż „TO-zestaw/1”)" — a plik na Drive był poprawny.
**Przyczyna:** w `paczkaPrzezId` zadeklarowane było `wZaakceptowanych`, czytane
`wZaakceptowane` → `ReferenceError` przy KAŻDYM pobraniu paczki; `doGet` łapie
wyjątek i odpowiada `{blad:"wZaakceptowane is not defined"}`, a aplikacja widziała
JSON bez `schemat` i mówiła „inny schemat" (Z07). Testy `.gs` wykonywały tylko
wycięte funkcje (`premiaZaKolejnosc`, geohash), więc ścieżka paczki nie była
uruchamiana nigdzie.
**Reguła:** (1) każda ścieżka mostu, od której zależy aplikacja, ma test
WYKONUJĄCY tekst `.gs` na atrapie Drive (atrapa: `test/helpers/most.js`;
ścieżka paczki: przyjęcie → akceptacja → indeks → pobranie → walidacja po stronie
aplikacji) plus przegląd każdej funkcji z asercją „brak `is not defined`";
(2) aplikacja NIE chowa odpowiedzi mostu — `{blad:…}` jest cytowane w komunikacie
(kod Z11), bo „inny schemat" brzmi jak uszkodzony plik i wysyła na poszukiwania
nie tam, gdzie wina; (3) test, który WYCINA funkcję z pliku i robi z niej
`new Function`, przechodzi także wtedy, gdy reszta skryptu nie daje się uruchomić
— tak było z koderem geohash, przeniesionym na atrapę 2026-09-08.
**Ile skryptu naprawdę wykonujemy, mierzy `npm run zasieg-mostu`**: uruchamia
testy z `NODE_V8_COVERAGE`, bierze profil skryptu z `new Function` i przekłada
pokrycie na wiersze pliku (przesunięcie V8 kalibrowane na nazwach funkcji — bez
kalibracji narzędzie rzuca błąd zamiast podawać zmyślone liczby). 2026-09-08:
767/790 wierszy kodu (97,1%); reszta to gałęzie trybu wyścig (`czyKompletna`,
`premiaZaKolejnosc`, `zakonczGre`) i ścieżki błędów walidacji.

## L34 — dane z zewnątrz idą do DOM przez `textContent`, nie `innerHTML`

**Objaw:** `renderujStacje` składało wiersz przez ``li.innerHTML = `… ${opis} …` ``,
a `opis` to nazwa z `tags.name` w Overpass — tekst edytowany przez obcych ludzi.
Obiekt OSM o nazwie `<img src=x onerror=…>` wykonałby skrypt w aplikacji.
**Przyczyna:** ten sam skrót myślowy co w L19 (innerHTML jako wygodny szablon),
ale tu podstawiane dane są zewnętrzne: Overpass, meta paczki z repozytorium,
odpowiedź mostu. Atrapa DOM tego nie pokazuje, bo innerHTML jest w niej inertne.
**Reguła:** wszystko, co przyszło spoza aplikacji, jest **tekstem** —
`createElement` + `textContent`/`append`; `innerHTML` tylko dla statycznych
fragmentów bez podstawiania danych (w `app/app.js` nie zostało ani jedno).
Test: „stacje: nazwa z OSM ze znacznikiem HTML jest tekstem, nie znacznikiem"
(`test/aplikacja.test.js`) — podstawia wrogą nazwę w fixture i sprawdza, że
w wierszu nie powstał element `IMG`.

## L35 — nakładając warstwę w CSS, selektor z id zabiera elementowi jego własne tło

**Objaw:** nowy układ rozgrywki (ADR 0030) kładzie karty i komunikaty NA mapie,
więc każdy element nad mapą dostał wspólne `background: var(--tlo-karta)`.
Dwie reguły trafiły przy tym w elementy, które mają własne tło z klasy:
`#gra-dystans` (`.badge-dystans { background: akcent; color: akcent-tekst }`)
i `#bledy-gra` (`.bledy { background: blad-tlo; color: blad }`). Selektor
`#ekran-gra:not([hidden]) .badge-duzy` ma specyficzność (1,2,0) i wygrywa
z klasowym (0,1,0), więc badge dystansu został **białym napisem na prawie białej
karcie** w jasnym motywie, a alert błędu przestał być czerwony.
**Przyczyna:** „dodaję tło, żeby tekst był czytelny na mapie" zastosowane do
listy selektorów bez sprawdzenia, co każdy z tych elementów już ma. Audyt
kontrastu tego nie łapie — liczy pary tokenów z palety, nie to, który selektor
wygrał w kaskadzie.
**Reguła:** przy wspólnych regułach dla kilku elementów tło dostają tylko te,
które go nie mają; reszcie zostawiamy własne. Gdy warstwa musi być wspólna,
sprawdź kaskadę jawnie — i zostaw test, który ją pinuje: kontrakt ADR 0030
wycina z CSS komentarze i sprawdza, że **żadna** reguła celująca w `#bledy-gra`
ani `.badge-duzy` nie deklaruje `background` (test ma zęby: wstrzyknięcie tła
do `.badge-duzy` go wywala).

## L36 — skrót w teście ukrywa żądania, które ścieżka produkcyjna wykonuje

**Objaw:** test „utrata zasięgu w trakcie gry — zero żądań sieciowych"
przechodził, dopóki odcinek zamykał klik w usunięty potem przycisk ręcznego
dojścia. Gdy ten sam test przeszedł symulacją (strumień fixów, ADR 0029),
w logu `fetch` pojawiło się **osiem** żądań do mostu Drive — po jednym na fix.
**Przyczyna:** `pokazPozycje()` wołało `odswiezPropozycjeZestawow()`
bezwarunkowo, a `pokazPozycje()` jest wołane z `przyjmijFix()`, czyli przy
KAŻDYM fixie. Karta propozycji paczek żyje na ekranie pozycji, więc cała
rozgrywka odświeżała indeks repozytorium, którego nikt wtedy nie ogląda:
bateria, transfer i limit kwoty Apps Script szły w błoto. Ręczny przycisk
zamykał odcinek jednym wywołaniem bez fixów, więc skrót w teście nigdy tego
nie pokazał.
**Reguła:** test, który zastępuje ścieżkę produkcyjną skrótem, testuje skrót.
Usunięcie skrótu jest okazją, żeby sprawdzić, co ścieżka naprawdę robi —
a asercje o braku żądań mają zostać surowe (`assert.deepEqual(wywolania, [])`),
bo filtr „oprócz kafelków" właśnie tu uśpiłby czujność. Naprawa: bramka
`if (STAN.ekran === 'pozycja')` przy wywołaniu, nie w środku funkcji — dwa
pozostałe wywołania to jawne akcje gracza i mają działać zawsze.

## L37 — „nie ma paczki" to nie to samo co „to nie kontener"

**Objaw:** przy generowaniu pytań partiami (B21) testy czystych funkcji —
`planPartii`, `scalPartie`, `walidujPaczke` z zakresem stacji, 14/14 zielone —
nie pokazały, że gałąź scalania jest martwa. W aplikacji pierwsza przyjęta część
od razu startowała grę z 15 pytaniami i ostrzeżeniem „paczka nie ma pytań do
stacji 4".
**Przyczyna:** rozróżnienie „wklejono gotowy kontener" od „wklejono odpowiedź
modelu" zapisałem jako `!zKontenera.paczka`. Tymczasem `odpakujPaczke()`
z tolerancji wklejenia przyjmuje trzy formy — kontener, sam blob i **jawny JSON
paczki** — i dla wszystkich trzech zwraca `paczka`, a formę rozróżnia polem
`zrodlo: 'kontener' | 'json' | null`. Warunek był zawsze fałszywy dokładnie
wtedy, gdy miał być prawdziwy. Testy jednostkowe tego nie widzą, bo nie wołają
`odpakujPaczke` — zobaczył to dopiero test UI, który przeszedł ekrany 4 → 5
i sprawdził, na którym ekranie aplikacja stoi PO kliknięciu „Sprawdź".
**Reguła:** funkcja zwracająca `{ wynik, blad, zrodlo }` mówi w `zrodlo`, SKĄD
wynik pochodzi — i to jest jedyne miejsce, w którym wolno rozróżniać ścieżki.
Nigdy przez „czy wynik jest pusty", bo tolerancja wejścia sprawia, że wynik jest
niepusty dla każdej formy. A ścieżkę UI składającą kilka kroków w jedną całość
trzeba testować przez UI: asercja „na którym ekranie skończyło" łapie martwą
gałąź, której testy jednostkowe nie mają jak zobaczyć.
*Dopisek:* samo dzielenie na partie zostało wycofane tego samego dnia (ADR 0031)
— nie dlatego, że było zepsute, tylko dlatego, że stało na błędnym założeniu
o limicie wyjścia modeli. Lekcja zostaje, bo dotyczy `odpakujPaczke()`, które
nadal żyje, i testowania ścieżek UI w ogóle.

## L38 — ekran spoza listy ekranów jest niewidzialny dla kodu, który ją przegląda

**Objaw:** otwarcie „dane i prywatność" z rankingu zostawiało rankingi widoczne
pod spodem, a „wróć" zrzucało gracza na setup zamiast na rankingi.
**Przyczyna:** `pokazPrywatnosc()` i `wrocZPrywatnosci()` przeglądały stałą
`EKRANY = ['setup','multi','pozycja','stacje','prompt','paczka','gra']`, a
`ekran-ranking` — dodany później, w M12 — nigdy do niej nie trafił. Pętla
`for (const e of EKRANY)` chowała więc siedem ekranów i ósmy zostawał na wierzchu;
`STAN.ekran` przy wejściu na rankingi się nie zmienia, więc „wróć" czytało ekran
sprzed nich. Objaw był podwójny, a przyczyna jedna: lista, która przestała być
kompletna, gdy doszedł nowy ekran.
**Reguła:** jeżeli jakiś stan jest przeglądem listy (`EKRANY`, słownik, rejestr),
nowy element tej listy musi być dodany do niej, a nie obok niej. Albo — lepiej —
przegląd niech pyta DOM o to, co faktycznie jest widoczne, zamiast ufać stałej.
Test, który to łapie, kosztuje dwa kliknięcia: otwórz warstwę, otwórz z niej
drugą, wróć i sprawdź, gdzie jesteś.

## L39 — stan początkowy musi być w HTML, a warstwa nad tłem musi mieć `position`

**Objaw:** dwa zgłoszenia z jednego podglądu. (1) „Odpalenie aplikacji powoduje
pokazanie się przez chwilę starego setupu, który po sekundzie zamienia się w nowy
setup na warstwie." (2) „Drugi ekran w dalszym ciągu jest pod mapą. Wystaje tylko
kawałek napisu i przyciski."
**Przyczyna:** dwie różne dziury w tym samym pomyśle „ekran jako warstwa nad
mapą". Pierwsza: reguły układu wisiały na `body[data-ekran='setup']`, a ten
atrybut ustawia `pokazEkran()` — czyli JS, po wczytaniu modułu. Do tego momentu
selektor nie łapie, setup renderuje się w przepływie jak przed zmianą, a reguła
`body:not([data-ekran='setup'])…` chowa mapę. Potem JS rusza i wszystko
przeskakuje. Druga: reguła panelu ustawiała tło, szerokość i marginesy, ale nie
`position` — element `static` maluje się POD elementem ustalonym z `z-index: 0`,
więc karta pozycji zniknęła pod pełnoekranowym tłem mapy.
**Reguła:** jeśli układ zależy od stanu, stan początkowy musi stać w HTML, a nie
powstawać w JS — inaczej pierwsze klatki są w innym układzie niż reszta i użytkownik
widzi przeskok. A każda warstwa, która ma leżeć NA czymś, musi mieć `position`
i `z-index`: bez `position` właściwość `z-index` w ogóle nie działa, a kolejność
malowania bierze się z przepływu, nie z intencji. Oba błady są niewidoczne dla
testów, które nie renderują — dlatego kontrakt ma pilnować przyczyny (atrybut
w HTML, `position` w bloku reguły), nie efektu.

## L40 — selektor z id nadpisuje tylko te właściwości, które wymieni

**Objaw:** mapa-tło miała `position: fixed; inset: 0; height: 100%`, a mimo to
właściciel widział ją „na pół ekranu" — pas 460 px u góry, przesunięty o 10 px.

**Przyczyna:** reguła bazowa `.mapa` deklaruje `height: 45vh; min-height: 240px;
max-height: 460px; margin: 10px 0`. Reguła `#mapa-pozycja` nadpisała `position`,
`height` i `border` — a `max-height: 460px` i `margin: 10px 0` przyszły z klasy
i dalej obowiązywały, bo wyższa specyficzność działa **na każdą właściwość
osobno**, nie na całą regułę. Dokładnie te resety (`min-height: 0;
max-height: none; margin: 0`) miały w tym samym pliku `#mapa-gra` i
`#mapa-stacje` — wzorzec był znany, tylko nowa reguła go nie powtórzyła.

**Reguła:** rozszerzając element, który ma regułę bazową z `max-height`,
`min-height`, `margin` albo `border`, wypisz w nowej regule JAWNE resety dla
wszystkich właściwości wymiarujących — nie tylko tej, którą zmieniasz. Sprawdź
regułę bazową właściwość po właściwości, a nie „czy nadpisałem to, co chciałem
zmienić". Testy tego nie złapią: kontrakt szuka w CSS podłańcuchów, a
`test/helpers/dom.js` w ogóle nie liczy kaskady.

## L41 — `position: fixed` mierzy od viewportu, nie od widocznego obszaru

**Objaw:** panel ekranu pozycji na desktopie wjeżdżał pod stopkę; dolne
przyciski znikały, a ponieważ strona się nie przewija — były nieosiągalne.

**Przyczyna:** panel miał `position: fixed` z `bottom: 10px` i
`max-height: calc(100dvh - 110px)`. Oba ograniczenia liczone były od viewportu,
tymczasem panel żyje w obszarze między belką a stopką, a stopka ma wyższy
`z-index` i maluje się nad nim. Dodatkowo `bottom` w ogóle nie działało: dla
elementu ustalonego przy `top: auto` przeglądarka bierze pozycję statyczną
i **ignoruje `bottom`**, więc wysokość szła z treści i z `max-height`.

**Reguła:** element, który ma się zmieścić w obszarze między nagłówkiem
a stopką, pozycjonuj `absolute` względem kontenera, który ten obszar zajmuje
(tu `.tresc { position: relative }` jako `flex: 1 1 auto` w kolumnie flex),
a nie `fixed` względem viewportu. Podawaj `top` I `bottom` jawnie — wtedy
wysokość wynika z ograniczeń, a nie z ilości treści, i `overflow-y: auto`
dostaje coś do przewijania.

## L42 — warstwa tła sięga pod to, co ją przykrywa; jej sterowanie musi to omijać

**Objaw:** przyciski +/− mapy chowały się pod belką nagłówka.

**Przyczyna:** mapa-tło ma `position: fixed; inset: 0`, czyli sięga pod samą
belkę. Jej przyciski dziedziczyły uniwersalne `.mapa-przyciski { top: 8px;
right: 8px }` — liczone od kontenera mapy, a więc od viewportu. Belka ma
`z-index: 3` i nieprzezroczyste tło, więc malowała się nad nimi. W wariancie
poziomym ten sam los spotykał je ze strony panelu pozycji (`z-index: 2`,
prawa strona).

**Reguła:** gdy element staje się pełnoekranowym tłem, przejrzyj WSZYSTKIE jego
dzieci pozycjonowane od jego krawędzi — ich punkty odniesienia zmieniły sens.
Sterowanie trzymaj w obszarze, którego nie przykrywa żaden element o wyższym
`z-index`. Odległości od elementów o zmiennej wysokości (belka z
`flex-wrap: wrap`) mierz w JS i wystawiaj jako zmienną CSS, a nie wpisuj stałej.

## L43 — `python3 -m http.server` a „Bad gateway” w podglądzie Areny

**Objaw:** (zgłoszenie właściciela, 2026-09-09) podgląd sandboxa nie otwiera się, Cloudflare
zwraca *Bad gateway* — mimo że `curl http://localhost:8000` z sandboxa daje 200,
proces żyje, port nasłuchuje na `0.0.0.0`, a nawet dwanaście równoległych żądań
przechodzi bez błędu.

**Przyczyna:** `python3 -m http.server` odpowiada w **HTTP/1.0** i zamyka
połączenie po każdej odpowiedzi (`SimpleHTTP/0.6 Python/3.11.2`). Proxy podglądu
utrzymuje pulę połączeń keep-alive; gdy serwer origin rozłącza się pierwszy albo
nie potwierdza keep-alive, proxy raportuje to jako 502, choć aplikacja jest
zdrowa. Diagnoza z wnętrza sandboxa **nie wykryje tego przez sam kod odpowiedzi**
— trzeba spojrzeć na linię statusu (`curl -I` → `HTTP/1.0`), nie na `200`.

**Reguła:** serwerem podglądu jest `node tools/serwer.mjs .` (`npm run serwer`).
HTTP/1.1 domyślnie, `keepAliveTimeout` 65 s — celowo **dłużej** niż typowe 60 s
proxy, żeby to proxy zamykało połączenie jako pierwsze (odwrotnie powstaje wyścig
i sporadyczne 502 przy bezczynności). Dokłada `Cache-Control: no-store` (podgląd
ma pokazywać bieżący plik) oraz typy MIME `.mjs` i `.webmanifest`, bez których
moduły ES i manifest PWA nie ładują się mimo statusu 200.

**Przy diagnozie „podgląd nie działa” sprawdzaj w tej kolejności:** proces żyje →
port na `0.0.0.0` (nie `127.0.0.1`) → **wersja protokołu w odpowiedzi** → typy
MIME zasobów z `index.html` → dopiero potem szukaj winy po stronie aplikacji.

## L44 — cache-first dla opaque = pamięć na zawsze (także awarii)

**Objaw:** (zgłoszenie właściciela, 2026-09-09, ponowne po wcześniejszych
poprawkach) po zakończeniu gry „Wróć na początek” pokazywał pusty ekran —
„za duży zoom, oddalenie pokazuje mapę”. Headless nie odtworzył tego na
bieżącym mainie: każdy szlak zooma clampuje do `maxZoom` podkładu, a kafelki
planuje `siatkaKafelkow` w zakresie 0..maxZoom.

**Przyczyna:** mechanizm, który to tłumaczy (i który był wadliwy w kodzie) —
service worker cache-uje kafelki cache-first, a odpowiedzi z `no-cors`
wracają jako **opaque** — z niewidocznym statusem. Chwilowy 404/5xx serwera
kafelków wyglądał więc tak samo jak dobry obraz i lądował w cache. Cache-first
potem oddawał tę „pustkę” przy KAŻDEJ następnej grze w tej samej okolicy
(cache ma trzymać „ostatnią okolicę” — te same kafelki!) aż do ewikcji albo
zmiany `WERSJA_SW`. Stąd „dalej jest nienaprawione” mimo kolejnych PR-ów:
zepsuty stan żył w telefonie, nie w repo.

**Korekta audytu 2026-09-10:** poprzednia diagnoza była hipotezą, nie
potwierdzoną przyczyną objawu na telefonie. Próba odczytu `blob.type` z opaque
NIE weryfikuje obrazu: przeglądarka zwraca pusty typ i rozmiar 0. Atrapa testowa
z `image/png` ukryła błąd. SW pomija teraz opaque jawnie; cache-uje wyłącznie
sukcesy basic/cors. Nie zmieniamy trybu żądań ani dostawców: podkład no-cors
nie ma gwarancji offline w Cache Storage (cache HTTP działa niezależnie).
Zmiana polityki na cache opaque wymaga osobnej decyzji, nie pozornej walidacji.
**Reguła:** testy API muszą odtwarzać ograniczenia platformy, nie upragniony wynik.

Również `ustalibujWidok` wymagał poprawki: x/y to przesunięcie pikselowe,
a nie środek mapy. Przy zmianie skali przelicza się je wokół środka panelu;
test sprawdza geograficzny round-trip dla obu orientacji i wszystkich podkładów.

**Przy diagnozie „mapa pusta, a zoom-out ją przywraca”:** najpierw sprawdź,
CO WIDZI TELEFON (wersja budowy w stopce), potem cache — a nie tylko kod:
błąd w cache klienta przeżywa poprawki w repo.


## L45 — zmiana kanonu wyboru = zmiana jego domyślnego zaznaczenia (i asercji z datą)

**Objaw:** (weryfikacja na żywo PR #8, 2026-09-10) ADR 0034 usunął Sport
i Jedzenie z nowego setupu i dodał Ciekawostki, ale `DOMYSLNE.tematy` —
lista domyślnego zaznaczenia i fallback pustych tematów — została przy
starym kanonie 10 tematów. Efekt: migracja starego zapisu, z którego po
filtrze nie zostaje żaden temat (np. `tematy: ['sport']`), dostawała
fallback ze usuniętymi tematami; organizator nie widział ich w UI (brak
chipów), a prompt i E16 wymagały pytań ze sportu i jedzenia — każda paczka
zgodna z nowym setupem byłaby odrzucona. Ciekawostki nigdy nie były
domyślnie zaznaczone.

**Przyczyna:** zmiana kanonu dotknęła dwie stałe, a edycja objęła jedną
(`TEMATY_SETUP` nowa, `DOMYSLNE.tematy` stara). Test betonujący starą listę
(`deepEqual(k.tematy, [...stary kanon], 'decyzja z 2026-09-07')`) przeszedł,
bo porównywał funkcję z jej własną stałą — asercja potwierdza każdą listę,
którą funkcja zwraca, i nie widzi niespójności między stałymi w kodzie.

**Reguła:** przy zmianie kanonu wyboru (ADR) przeszukać wszystkie stałe, które
trzymają jego elementy: kanon odczytu, kanon setupu ORAZ domyślne
zaznaczenie/fallback — i każdą asercję z komentarzem-datą decyzji („decyzja
z RRRR-MM-DD"): data w asercji to flaga „przeglądnij mnie przy następnej
zmianie kanonu". Fallback pustych tematów liczony z tej samej stałej co
domyślne zaznaczenie (jedno źródło prawdy), a regresja brzegowa (wszystkie
tematy wypadają w filtrze) ma własny test.

## L46 — wersja domyślnych wyborów też idzie do localStorage: kanon z markerem, nie „implace upgrade"

**Objaw:** właściciel po aktualizacji wciąż widział odptaszkowane „Ciekawostki",
mimo że kanon setupu (ADR 0034) i `DOMYSLNE.tematy` od dawna je zawierały
(uwagi terenowe #3, 2026-09-11). Wycięcie tematów z setupu przeliczyło jego
przełęczony eksponat na starym zapisie — `localStorage` przeżywa rebuildy
w niemal czystej postaci (L28), więc ten efekt zniknął, gdy właściciel
skonfigurował grę przed zmianą kanonu. Nowi gracze mieli inny setup niż
właściciel — nikt tego nie zauważył, bo testy nasiałają świeże fixtures.

**Przyczyna:** odczyt zapisanego setupu (`wczytajKonfiguracje`) przejmował
listę tematów z zapisu bez rozróżnienia „świadomy wybór gracza" od „domyślne
z wersji, która wtedy panowała". Dla pól edytowalnych (R, stacje) to dobre,
a dla LISTY kanonicznych rozjazd jest cichym bugiem: nowe tematy domyślne
nie dochodzą do starych zapisów.

**Reguła:** listy kanoniczne w konfiguracji noszą marker wersji kanonu
(data wejścia zmiany, np. `'2026-09-10'`). Zapis bez markera = zapis sprzed
kanonu → jednorazowe dopełnienie tylko NOWYCH tematów domyślnych (lista
dopełnień w kodzie, nigdy `wlasny`), zapis markera i nie więcej ruszania
wyborów gracza. Test rytuału: stary zapis dopełniany, świeży nietknięty.

## L47 — cache zasobów obcego dostawcy NIE może być wersjonowany wraz z aplikacją

**Objaw:** w podglądzie Areny kafelki `tile.openstreetmap.org` wracały jako
`403 Access Blocked. App is not following the tile usage policy of
OpenStreetMap's volunteer's-run servers: osm.wiki/Blocked`. Na GitHub Pages ten
sam kod działał.

**Przyczyna:** `CACHE_KAFELKI` był nazwany od `WERSJA_SW`
(`okolica-kafelki-m12-80`), a `WERSJA_SW` rośnie przy każdej zmianie `app/*.js`
(L29). Każde wdrożenie tworzyło więc nową nazwę cache, a `activate` usuwało
starą — cały zbiór kafelków lądował w koszu i widok był pobierany od dostawcy
od zera. W jednej sesji potrafi to być kilkanaście bumpów z rzędu, każdy z
pełnym re-pobraniem widoku. Polityka kafelków OSM wymienia to wprost jako
podstawę blokady (*General block* → „**No caching**: downloading the same
tiles repeatedly, due to improper response caching"). Krótko mówiąc: to nie
sandbox „coś robił źle" — nasz SW wytwarzał dokładnie wzorzec ruchu, za który
OSM blokuje, a efemeryczny referer `*.e2b.app` tylko przyspieszył wyrok.

**Reguła:** wersjonowanie cache służy unieważnianiu zasobów **naszej**
aplikacji. Zasoby obcego dostawcy są adresowane treścią (kafel = `z/x/y`) i ich
ważność określa dostawca, nie nasz numer wersji — ich cache musi mieć nazwę
**stałą**. Skorupa wersjonowana, kafelki nie. Test rytuału: dwa kolejne
„wdrożenia" (ten sam magazyn, inny `WERSJA_SW` w kodzie SW) — po `activate`
kafel nadal w cache i zero żądań do dostawcy.

**Szersza zasada:** zanim uznamy błąd obcej usługi za „artefakt środowiska",
sprawdźmy, czy nasz kod nie generuje wzorca, który ta usługa jawnie penalizuje.
Komunikat blokady cytował politykę — polityka była do przeczytania i wymieniała
nasz przypadek co do słowa.

## L48 — zanim akcja wejdzie do UI, ustal KOGO dotknie jej skutek

**Objaw:** audyt PR #13 znalazł przycisk „Opuść lobby", który u organizatora
zamykał grę WSZYSTKIM dołączonym — jednym kliknięciem, bez ostrzeżenia
i bez możliwości cofnięcia (most przenosił grę do archiwum, a bez organizatora
nie ma kto jej wystartować). W tym samym repozytorium rezygnacja z gry, ręczne
zakończenie i kasowanie zapisu/historii mają od dawna rytuał dwustopniowy —
nowa ścieżka multi go ominęła.

**Przyczyna:** przy przepisywaniu multi (m12-73/74) wyjście z lobby powstało
jako „przycisk w panelu" i nikt nie zapytał, kogo dotknie skutek. Sprawdzaliśmy
stan gry w moście (lobby vs trwa), a nie to, że w lobby skutek kliknięcia jest
WSPÓLNY. Dwie perspektywy — „akcja" i „ekran" — wystarczyły, żeby wzorzec
potwierdzenia zniknął.

**Reguła:** każdą nową akcję w UI klasyfikuj dwiema osiami: **odwracalność**
(czy da się wrócić?) i **zasięg** (kogo dotknie: mnie, czy innych?). Nieodwracalna
albo dotykająca innych wymaga potwierdzenia u tego, kto klika (wzorzec:
pierwszy klik uzbraja i mówi, co się stanie, drugi wykonuje — `rezygnujZGryMulti`,
`multiOpuszczenieUzbrojone`). Odwracalna i „moja" — jedno kliknięcie, bo
potwierdzenie jest tam tylko hałasem. Asymetrię testuj asercjami: pierwszy klik
organizatora NIE wysyła `gra-opusc`, drugi wysyła — na kodzie bez potwierdzenia
ten test pada, więc pilnuje wzorca, a nie dekoracji.

## L49 — marker wersji: obecność to nie to samo co wartość

**Objaw:** audyt PR #13 ustalił, że `KANON_SETUPU` (data kanonu domyślnych
tematów setupu) jest zapisywany w `localStorage`, ale odczyt sprawdzał tylko
`if (!kanon)`. Działało wyłącznie dlatego, że dopełnienie dla zapisów sprzed
m12-75 było jednorazowe: przy kolejnej zmianie domyślnych zapis z markerem
NIGDY nie dostałby nowego tematu, a zapis bieżący dostałby go po raz drugi —
także wtedy, gdy organizator odptaszkował go z rozmysłem.

**Przyczyna:** marker traktowaliśmy jak flagę („migrowane / nie"), a nie jak
wersję. Flaga mówi „coś już zrobiono", wersja mówi „co dokładnie". Przy
dopełnieniach przyrostowych (nowy temat domyślny raz na wersję) to dwie różne
informacje.

**Reguła:** każdy marker migracji porównuj WARTOŚCIĄ, nie obecnością. Zmiany
trzymaj w dzienniku `wersja → co ta wersja dodała` i licz dopełnienia od
wersji markera (`tematyDopelnianeOdKanou`), a nie z jednej listy „kiedykolwiek".
Zapis z markera bieżącego albo nowszego nie jest ruszany — wybór użytkownika
jest święty. Test pisz ogólnie, po dzienniku: „wersja, która temat wprowadziła,
nie dostaje go ponownie" — wtedy nowy wpis w dzienniku jest sprawdzony,
zanim trafi do graczy.

## L50 — tożsamość czytaj z pola, nie z pozycji na liście

**Objaw:** `opuscGre` w `.gs` rozpoznawał organizatora po indeksie `0`
w `gracze`. Dziś było to równoważne z `gra.organizatorId`, ale po zmianie
kolejności graczy (albo ręcznej korekcie pliku na Drive) wyjście organizatora
usuwałoby go z listy zamiast zamknąć grę, a wyjście gościa z indeksu 0
zamykałoby grę wszystkim dołączonym.

**Przyczyna:** pole, które DEFINIUJE rolę (`organizatorId`), było zapisywane,
ale reguła czytała jego ówczesną pozycję. Kolejność bywa niezmienna tylko
„u nas" — jeden import gier, jeden porządek sortowania i założenie pęka.

**Reguła:** reguły zależne od roli (organizator, prowadzący, pierwszy gracz) i od
tożsamości czytają pole, które tę rolę definiuje. Pozycja w tablicy to sposób
wyświetlania, nie kontrakt. Test regresyjny zrób w obie strony: przestaw
kolejność w danych i sprawdź, że gość NIE zamyka gry, a organizator zamyka,
choć stoi drugi.

## L51 — limit czasu dobierz do NAJGORSZEGO przypadku, nie do swojego testu

**Objaw:** zgłoszenie terenowe (Podkowa Leśna): „Gdzie jesteś?" mówiło
„Repozytorium niedostępne", choć w okolicy były co najmniej trzy paczki, a most
był świeżo wdrożony. W logice były trzy nakładające się przyczyny: własny limit
6 s na indeks paczek (za krótki dla zimnej instancji web app Apps Script), brak
jakiejkolwiek powtórki pierwszego żądania i jeden zbiorczy `catch`, który każdy
błąd (timeout, brak sieci, HTTP 403, HTML zamiast JSON) opisywał tym samym
zdaniem.

**Przyczyna:** limit dobieraliśmy do tego, jak zachowuje się most w testach
(ciepły, szybki), a nie do najwolniejszego realnego przypadku (pierwsze żądanie
po wdrożeniu, telefon w terenie). Jedno zdanie obsługiwało cztery różne awarie,
więc diagnostyka była zgadywaniem.

**Reguła:** (1) limit czasu bierz z najgorszego spodziewanego przypadku i trzymaj
JEDNĄ stałą na cały most — rozjazd limitów między ścieżkami to ukryta usterka;
(2) pierwsze żądanie po wdrożeniu wolno powtórzyć RAZ (idempotentny GET), ale
odpowiedzi nieczytelnej nie powtarzaj — to nie sieć, to zły adres lub zamknięte
wdrożenie; (3) komunikat niesie POWÓD („brak odpowiedzi w 15 s", „HTTP 403 —
sprawdź dostęp «Każdy»"), a nie wspólne „niedostępne"; (4) żądanie bez limitu
czasu jest błędem — zawieszone połączenie zostawia użytkownika z wiecznym
„Pobieram…".

## L52 — jeden `catch` na cały łańcuch melduje NASZ błąd jako cudzą awarię

**Objaw:** właściciel zgłosił, że w Podkowie Leśnej ekran „Gdzie jesteś?” mówi
„Repozytorium niedostępne”, choć paczki na Drive są — po czym dodał decydujący
fakt: „Sam most na pewno działa, bo przed chwilą rozegrałem grę, wygenerowałem
nowego gracza, paczkę z AI i wszystko ładnie się zapisało. Więc to musiał być
jakiś specyficzny problem ze sprawdzaniem paczek”. Miał rację: obsługa indeksu
miała `.catch(() => …)` obejmujący CAŁY łańcuch — żądanie, parsowanie, walidację,
dopasowanie i render listy. Wyjątek we własnym kodzie na poprawnej odpowiedzi
mostu wyglądał dokładnie tak samo jak brak sieci.

**Przyczyna:** jeden `catch` na wiele odpowiedzialności. Im dłuższy łańcuch
`.then(...)`, tym więcej cudzych win mieści się w jednym zdaniu o winie mostu.
Gdy użytkownik mówi „ta funkcja przecież działa” (most, Drive, konto), to jest
wskazówka diagnostyczna, nie upór: awaria leży wtedy w tej ścieżce, która jest
NASZA — czyli w czytaniu i pokazywaniu odpowiedzi.

**Reguła:** dziel obsługę na warstwy o różnych sprawcach — (1) żądanie sieciowe
(jego wolno powtórzyć, jego awaria ma powód: brak sieci, timeout, HTTP 403),
(2) czytanie i pokazanie odpowiedzi (błąd aplikacji — nie powtarzamy, nie
obwiniamy mostu, mówimy „błąd aplikacji: <konkret>” i prosimy o zgłoszenie).
Do tego: gdy odpowiedź jest niezrozumiała, komunikat niesie KOD usterki
(np. Z09), a pełny opis (z czym dokładnie się nie zgadzamy) idzie do miejsca
diagnostycznego, nie do zdania dla gracza. Test piszesz tak, żeby wymusić
wysypkę WŁASNEGO kodu na poprawnej odpowiedzi i sprawdzić, że komunikat nie
udaje sieci — inaczej reguła zniknie przy pierwszym refaktorze.

## L53 — przepisujesz dużą funkcję? Kotwicz po jej REALNYM tekście, a nieudany skrypt potwierdź grepem

**Objaw:** (Bug D, ekran wyników) skrypt `python3` z dziewięcioma podmianami
przerwał się na czwartej (`AssertionError`): regex na `pokazWyniki` zakładał
strukturę (`// 1b.` + domknięcie `}\n}`), której funkcja nie miała — komentarze
sekcji i kolejność bloków zmieniły się przez pół roku.

**Przyczyna:** kotwica pisana z pamięci („tak ta funkcja wyglądała, gdy ją
czytałem 40 minut temu”) zamiast skopiowania realnego fragmentu. Ratunkiem był
wzorzec skryptu: wszystkie podmiany asertują `count(...) == 1`, a plik zapisuje
się RAZ, na końcu — więc wyjątek zostawia plik źródłowy nietknięty (żadnych
połowicznych zmian).

**Reguła:** (1) przed przepisaniem funkcji wypisz jej ciało `sed -n 'X,Yp'`
i kotwicz po fragmencie z tego wydruku; (2) wieloetapowe edycje rób skryptem
z asercjami i POJEDYNCZYM zapisem na końcu — nieudany przebieg to „plik bez
zmian”; (3) mimo to po nieudanym przebiegu sprawdź to grepem/diffem — „zapis
jest na końcu” to właściwość skryptu, nie założenie sesji; (4) łańcucha
`skrypt && npm test` nie używaj jako dowodu, jeśli skrypt mógł nie zmienić pliku
(test przejdzie na starym kodzie i zamaskuje błąd).

## L54 — dokładasz pytania do paczki? Trzy pułapki walidatora (promień, id, treść)

**Objaw:** (test hot-seat 2 × 2) testowa paczka z drugim pytaniem na stację była
odrzucana przez walidator („Paczka odrzucona — usterek: 7”) bez czytelnego
komunikatu w `#bledy-paczka`.

**Przyczyna:** trzy niezależne reguły PYT łamią się przy dokładaniu pytań:
`E16` — promień paczki musi zgadzać się z konfiguracją, a liczba pytań zmienia
liczony promień (3 stacje × 2 pytania: 85 min → 950 m, ale 90 min → 1000 m);
`E19` — identyfikator pytania musi trafiać we wzór `s<stacja>p<numer>`
(`s1p1b` jest odrzucane); `E15` — treść musi kończyć się pytajnikiem, a treści
nie mogą się powtarzać (drugie pytanie musi mieć inną treść, nie tylko inne id).

**Reguła:** nowe pytanie w fixture projektuj od tych trzech reguł do środka:
najpierw przelicz promień z `czasGryMin`, potem nadaj id ze wzoru, na końcu
napisz inną treść z „?”. A gdy paczka jest odrzucana, czytaj komunikaty
z `#wynik-naglowek` („usterek: N”) i listy `#wynik-usterki` — kontener
`#bledy-paczka` bywa pusty, a SONDA wypisująca sam status nic nie pokaże.

## L55 — pin „element usunięty” blokuje powrót: gdy właściciel zmienia decyzję, pin przepisujesz na NOWĄ formę

**Objaw:** (zgłoszenie F, ranking — 2026-09-12) wróciliśmy do ekranu, który
dzień wcześniej sami usunęliśmy, a brama trzymała trzy asercje wprost przeciwne:
`assert.equal(INDEX.includes('ekran-ranking'), false)`,
`assert.equal(APP.includes('przycisk-ranking'), false)`,
`assert.equal(GS.includes("akcja === 'ranking'"), false)`. Zostawienie ich =
czerwona brama i pokusa „naprawienia” jej przez osłabienie testu; skasowanie
ich = brak ochrony przed powrotem STAREJ formy (zakładki, kategorie, lista
„Moje gry”), która właśnie dlatego została usunięta.

**Przyczyna:** pin na usunięcie jest pinem DECYZJI, nie kodu. Reguła L31
(„usunięty element ma zostać usunięty”) powstała jako obrona przed cichym
powrotem, a nie jako zakaz zmiany zdania przez właściciela — a decyzja
właściciela może się zmienić, i wtedy test pilnuje czegoś, czego już nikt nie
chce.

**Reguła:** gdy zadanie przywraca coś, co wcześniej usunęliśmy, nie kasuj pinu
— przepisz go na nową formę i dopisz zakaz formy starej: (1) w miejscu dawnych
`assert.equal(..., false)` postaw `assert.ok(..., 'nowy element jest')`;
(2) dodaj listę identyfikatorów starej formy z `assert.equal(INDEX.includes(...),
false)`, żeby nikt nie wniósł jej z powrotem „przy okazji”; (3) w ADR napisz,
że poprzednia decyzja jest odwrócona/uzupełniona i który aneks rejestru to
niesie; (4) numer schematu podnieś, gdy zmienia się kształt danych
(`RO-ranking/1` → `RO-ranking/2`), i nie wracaj ze starym numerem do puli nazw.

## L56 (2026-09-12) — API „aktywne” nie znaczy „dostarcza”: watcher bez znaku życia trzeba restartować

**Objaw:** terenowo (iPhone, Chrome, Pages, zgoda udzielona, GPS telefonu
sprawnie lokalizuje w Google Maps) ekran „Gdzie jesteś?” wisi na „Czekam
na pozycję…” w nieskończoność; po wyjściu i wejściu „Szukam satelitów…”;
w Informacjach „GPS uruchomiony” / „wznowiono śledzenie położenia”. Zero
fixa i zero błędu — aplikacja nie ma żadnego sygnału, że coś jest nie tak.

**Przyczyna:** dwie warstwy. (1) WebKit (wszystkie przeglądarki na iOS)
ma udokumentowaną rodzinę usterek, w której `watchPosition` przestaje wołać
OBA callbacki — ani sukces, ani błąd — ignorując opcję `timeout`; ryzyko
rośnie, gdy request poszedł bez gestu użytkownika (GPS startował razem
z ładowaniem strony) albo po powrocie karty z tła. (2) Nasz kod czytał
`watcher.czyAktywny()` jako „GPS działa” — a to zdanie o WŁASNYM wrapperze
(`aktywny` flaga w `pozycja.js`), nie o dostarczaniu pozycji przez platformę.
Cisza bez końca była zatem niewidoczna z obu stron: platforma milczy,
a wrapper „świeci zielonym”.

**Reguła:** (1) status „aktywny” w naszym wrapperze to deklaracja intencji —
o życiu streamu rozstrzyga wyłącznie OSTATNI CALLBACK, dobrego lub złego
typu; dla streamów, na które czeka UI, mierz znak życia i po limicie ciszy
zakładaj świeży zasób (watchdog). (2) Limit ciszy licz od założenia
nasłuchu; brak danych o znaku to milczenie, nie „świeżość” (L10).
(3) Restart nie może nadpisywać statusu gry (L22) — komunikat „GPS
włączony” tylko na pierwszym starcie, restary mówią własnym zdaniem
(P10 z sekundami i numerem próby). (4) Pierwszy request przed jakimkolwiek
gestem użytkownika jest na iOS podejrzany z definicji — gdy UI czeka na
jego efekt, gesto użytkownika (tu: „Dalej”) powinno go odświeżać, dopóki
nie da efektu. (5) Infrastruktura testowa: zegar watchdoga uzbrajaj tylko
gdy na niego czekasz — żywy `setInterval` po instancji atrapy wisi pętlę
zdarzeń `node --test` (objaw: plik testowy „timeout” bez żadnej asercji).

