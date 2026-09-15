# LESSONS — archiwum opisów przypadków

Pełne narracje lekcji z `docs/LESSONS.md`: rozwinięty objaw, przyczyna, naprawa
i testy, które jej pilnują. Ten plik jest POZA budżetem lektury startowej
(`AGENTS.md` §0 pkt 4 i `npm run budzet`) — rejestr z regułami czytasz w całości,
a tu zaglądasz punktowo, gdy wchodzisz w temat konkretnej lekcji (`## LN`).

Podział wprowadzony 2026-09-13, gdy rejestr z ADR-ami przekroczył 99 tys. z
dostępnych 100 tys. tokenów lektury startowej (`AGENTS.md` §0: „skrócenie albo
rozdzielenie dokumentów staje się obowiązkowym zadaniem sesji"). Treść lekcji nie
zmieniła się — zmieniło się tylko miejsce: reguła została w rejestrze, opis
przypadku trafił tutaj. Nowe lekcje dopisuj w OBU plikach (skrót w rejestrze,
pełny opis tutaj), w tej samej kolejności numeracji.

---

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

## L57 (2026-09-12) — zmiana formatu danych wymaga inwentaryzacji WSZYSTKICH jego nośników; wspólne pliki przeżywają aplikację jak localStorage

**Objaw:** decyzja z 2026-09-11 (`meta.tematy` = faktyczne tematy pytań,
ADR 0017 aneks) nie zadziałała dla paczek starych — właściciel zgłosił to
2026-09-12: „to miało być już naprawione, ale nie jest”. Zmiana była
w trzech miejscach — meta nowych wysyłek (klient), migracja rejestru
LOKALNEGO przy starcie, reguła dopasowania po stronie klienta — a nie
w czwartym: pliki na Drive niosą stare meta, a indeks mostu przepisuje je
wprost.

**Przyczyna:** przy zmianie sensu pola inwentaryzowałem KOD (skąd reguła
czyta tematy), a nie DANE (gdzie mieszkają stare wartości i kto je pisze).
Dwa utrudnienia: (1) plik na wspólnym Drive przeżywa aplikację tak samo jak
`localStorage` (L28 — trwałość niezależna od rebuilda), więc „nowy kod
poprawi stare dane” było prawdą tylko dla danych lokalnych; (2) aneks ADR
obiecywał, że „właściciel może odświeżyć stare pliki ponowną wysyłką paczki” —
a ta droga była martwa: most przy duplikacie zwraca istniejący plik bez
nadpisania (ADR 0028: paczka to treść niezmienna), więc „odświeżenie
ponowną wysyłką” było zapiskiem, nie mechanizmem.

**Reguła:** przy zmianie formatu/sensu danych wspólnych policz KAŻDE miejsce,
w którym mogą mieszkać stare wartości: `localStorage` (klucze + migracja
przy starcie), pliki współdzielone (Drive/GitHub), indeksy pochodne,
eksporty — i dla każdego: kto pisze nową wartość, kto migruje starą i jakim
MECHANIZMEM (backfill w indeksie, ponowne wdrożenie, kasowanie pliku,
ręczna edycja). Obietnica w ADR („X da się odświeżyć przez Y”) musi być
ścieżką, którą da się uruchomić — najlepiej przetestowaną. Tu zadziałał
backfill w indeksie mostu (wzorzec B19: plik niezmienny, indeks dopisuje
pole) — jedna zmiana w `.gs` naprawiła WSZYSTKIE stare paczki naraz,
bez wchodzenia właścicielowi w Dysk.

## L58 (2026-09-12) — tekst jest nośnikiem stanu: po fali usuwania grep po nośnikach ŻYWYCH i strażnik w teście

**Objaw:** audyt scalonego PR #18 (sesja 2026-09-12K) znalazł siedemnaście
miejsc, w których aplikacja albo dokumenty opisywały rzeczy usunięte kilka fal
wcześniej — i każde z nich przechodziło przez zieloną bramę 734 testów. Ekran
wklejania paczki mówił „leci na Drive do przeglądu właściciela” (moderacja
zniesiona 2026-09-11, ADR 0017 aneks), status pełnej pamięci paczek odsyłał do
„eksportu plikiem”, a awaria wysyłki proponowała „zapisz plik i wnieś ręcznie”
(eksportu nie ma od 2026-09-07, resztę zabrał ADR 0038), karta prywatności raz
wysyłała pytania na Drive, a w sąsiednim punkcie trzymała je na telefonie,
`WORKFLOW` kazał w terenie mierzyć dokładność GPS i klikać przyciski, których
nie ma (GPS, ręczne współrzędne, wczytanie z pliku, symulacja 250 m na ekranie
pozycji), `ARCHITECTURE` opisywała moduł `ui.js`, którego nigdy nie było,
i próg dojścia 25 m przy `progDojsciaM() = 50`, `ASSETS` trzymał sekrety mostu
(`REVIEW_SECRET`, `OWNER_EMAIL`) i bramkę moderacyjną, a rejestr ADR-ów, most
i test cytowały „ADR 0019 aneks 2026-09-12f”, którego w ADR 0019 nie było —
decyzja żyła w ADR 0039. Pięć z tych miejsc to KOMENTARZE w kodzie, które
obiecywały zachowanie celowo nieobecne („marker pozycji z kołem dokładności”,
„pojedynczy fix zapala stację” przy `wymaganeTrafnienia = 2`).

**Przyczyna:** testy czytały ZACHOWANIE (DOM, funkcje, schematy), nie tekst,
więc brama nie miała czego zapalić. Usuwanie szło falami (H, I, J oraz ADR
0034/0037/0038/0039), a L31 każe przy fali przejrzeć nośniki RĘCZNIE — przegląd
ręczny jest tak dobry jak pamięć ostatniej sesji, więc każda fala zostawiała
resztki w miejscu, którego nikt nie czytał (akapit w `index.html`, bullet
w `ASSETS`, nagłówek procedury terenowej). Druga przyczyna jest groźniejsza:
martwa fraza brzmi wiarygodnie. Agent, który czyta „badge dokładności żyje”,
nie ma powodu wątpić, a właściciel w terenie idzie za instrukcją i szuka
przycisku, którego nie ma — koszt to nie tylko myląca dokumentacja, ale
i zmarnowany test terenowy.

**Reguła:** (1) po każdej fali usuwania zrób grep po NOŚNIKACH ŻYWYCH —
`index.html`, `app/*.js` (także komentarze), `sw.js`, `README.md`,
`docs/{WORKFLOW,ARCHITECTURE,ASSETS,ROADMAP,PROTOKOL}.md`,
`docs/decisions/README.md`, `docs/setup/*.gs` — nie tylko po kodzie; historia
(`PROJECT_HISTORY`, `LESSONS`, ADR-y, handoffy) cytuje martwe frazy celowo
i jest poza przeglądem. (2) Każdą znalezioną frazę wpisz do
`test/dryf-dokumentow.test.js` jako `{ fraza, nosniki, powod }`, żeby powrót
funkcji albo opisu zapalił bramę zamiast czekać na następny audyt; strażnik
pilnuje też rzeczy strukturalnych: drzewo modułów w `ARCHITECTURE` ↔ zawartość
`app/`, eksporty modułu ↔ jego opis, brak sekretów w moście. (3) Cytowanie
„ADR NNNN aneks <data>” musi mieć pokrycie w pliku decyzji — strażnik to
sprawdza, więc kotwica nie może zostać sierotą (albo dopisujesz aneks, albo
poprawiasz cytowanie na ADR, w którym decyzja naprawdę żyje). (4) Komentarz
w kodzie jest nośnikiem stanu tak samo jak dokument: jeśli opisuje zachowanie,
którego kod celowo nie ma, to jest bug, nie stylistyka — poprawia się go w tym
samym commitcie co zachowanie.

## L59 (2026-09-12) — wznowienie sesji: porównaj HEAD z origin ZANIM cokolwiek commitujesz

**Objaw:** sesja wznowiona po kondensacji pamięci miała w drzewie całą dotychczasową
pracę (K/1–K/11 plus nowe poprawki zadania L), ale lokalna gałąź
`arena/01a0973d-okolica` stała na bazie `main` (`4eb0985`), a `git status`
pokazywał 27 zmodyfikowanych plików i 2 nieśledzone. Wszystko wyglądało jak
„jeszcze niecommitowane” — podczas gdy te same zmiany były już na origin
i w otwartym PR #19. Commit w tym stanie zduplikowałby całą sesję na wierzchu
bazy; `--force-push` jest zakazany (`AGENTS.md` §2), więc odkręcanie byłoby
drogie i widoczne dla właściciela.

**Przyczyna:** sandbox bywa odtwarzany między turami — pliki wracają ze
snapshotu, a `.git` jest świeżym klonem punktu bazowego. Stan plików ≠ stan
gita, a pamięć sesji mówi „commit d299746 wypchnięty” i ma rację: tylko nie
o tym klonie.

**Reguła:** (1) Na starcie każdej kontynuacji: `git rev-parse --abbrev-ref HEAD`,
`git rev-parse HEAD`, `git log --oneline -3` oraz
`git ls-remote origin refs/heads/<gałąź>` — porównaj SHA i liczbę commitów.
(2) Gdy lokalny HEAD jest w tyle, a drzewo ma treść: `git fetch origin <gałąź>`
i `git reset --mixed FETCH_HEAD` — przesuwa wskaźnik gałęzi i indeks, NIE rusza
plików, więc `git status` pokazuje po chwili tylko realny przyrost tej sesji.
(3) Przed `git add -A` przeczytaj `git diff --stat`: zakres ma się zgadzać
z zadaniem. Dwadzieścia siedem plików przy przeprowadzce jednego wiersza HTML to
sygnał, że problem jest z bazą, nie z zadaniem. (4) Masowe zmiany wersjonowania
weryfikuj treścią: `git diff --unified=0 -- app/*.js | grep -v 'm12-'` ma być
puste, jeśli commit podnosi tylko `?v=`.

## L60 (2026-09-13) — hak `after()` w atrapie rejestruj przy ładowaniu modułu; żywy zegar z aplikacji wiesza `node --test` PO zielonych testach

**Objaw:** brama M/3 (`npm run brama`) nie kończyła się: wszystkie asercje
przechodziły (743 ok, 0 fail), a proces trwał — dwa uruchomienia z rzędu trzeba
było przerwać po 1500 s. W logu ostatnia linia była zwykłym `✔ ranking UI:
Escape zamyka warstwę rankingu`, bez podsumowania `# tests`. `ps -ef | grep node`
pokazał winowajcę wprost: jeden wiszący potomek `node test/ranking-ui.test.js`,
którego 13 testów już dawno przeszło.

**Przyczyna:** M/3 dodał w `app.js` żywy `setInterval` (watchdog bezczynności,
ADR 0040 pkt 5), a atrapa DOM (`test/helpers/dom.js`) sprzątała zegary hakiem
`after(posprzatajInterwaly)` zarejestrowanym WEWNĄTRZ `przechwycZegary()`, czyli
przy PIERWSZYM `zainstalujDom()`. Pliki, które wołają atrapę w środku testu
(`ranking-ui`, `zestawy-ui` — helper `aplikacjaZRankingiem()`), rejestrowały hak
za późno: nie był już hakiem korzenia pliku i się nie wykonał. Interwał
z bootstrapu aplikacji trzymał pętlę zdarzeń, więc proces nie mógł się zakończyć.
`aplikacja.test.js` (atrapa na poziomie modułu) wychodził czysto — dlatego ta
sama wada nie wyszła przy wprowadzaniu mechanizmu w M/2.

**Reguła:** (1) Haki `before`/`after` z `node:test` rejestruj PRZY ŁADOWANIU
modułu pomocniczego, nie w środku funkcji, którą testy wołają — nie kontrolujesz
tego, który test wywoła ją pierwszy. (2) Przechwycony w atrapie zegar dostaje
`unref()`: nawet niesprzątnięty nie może trzymać procesu przy życiu. (3) Gdy
`node --test` wisi PO zielonych testach, szukaj uchwytów, nie asercji:
`ps -ef | grep node` wskazuje plik, który nie zakończył procesu, a
`timeout 60 node --test test/<plik>.test.js` potwierdza diagnozę w minutę.
(4) Każdy nowy `setInterval`/`setTimeout` w kodzie aplikacji to potencjalny
wisielec bramy — po dodaniu go uruchom PLIK, który bootuje aplikację w środku
testu (tu `ranking-ui.test.js`), a nie tylko ten z atrapą na poziomie modułu.
(5) Przerwanie `npm run brama` po czasie nie oznacza czerwonej bramy, ale też
nie zielonej: wynik musi być przeczytany z podsumowania `# pass/# fail` i z
`BRAMA_EXIT`, inaczej commit idzie w świat bez dowodu.

## L61 (2026-09-13) — nowa warstwa dziedziczy `visibility: hidden` z cudzej klasy: otwieraj ją razem z zamknięciem pozostałych

**Objaw:** warstwa potwierdzenia końca gry (`#ekran-koniec-gry`, ADR 0043) po
otwarciu spod ⓘ Informacji albo spod podglądu mapy byłaby NIEWIDOCZNA — karta
zajmuje miejsce w układzie, ma `z-index: 30` i `hidden = false`, a i tak jej nie
widać. Wszystkie 123 testy DOM zielone, brama zielona, audyt WCAG bez naruszeń.

**Przyczyna:** wygaszanie warstw w `styles.css` jest robione klasami na `body`
i selektorami „wszystko poza mną”:

```css
body.informacje-otwarte .panel-centralny:not(#ekran-informacje) { visibility: hidden; }
body.ranking-otwarte   .panel-centralny:not(#ekran-ranking)     { visibility: hidden; }
body.podglad-mapy      .panel-centralny                         { visibility: hidden; }
```

Nowy panel centralny automatycznie wpada w każdą z tych reguł jako „nie-mnie”,
więc otwarcie go bez zamknięcia tamtych warstw (albo bez zdjęcia
`STAN.podgladMapy`) daje panel ukryty cudzą klasą. Atrapa DOM w testach
(`test/helpers/dom.js`) NIE ma silnika CSS: widzi `hidden`, `classList`
i `inert`, ale nie `visibility` — więc takiej wady nie da się złapać testem
zachowania, tylko pinem na regułę i invariantem w kodzie.

**Reguła:** (1) Każda nowa warstwa centralna dostaje WŁASNĄ klasę na `body`
i własną regułę `:not(#moja-warstwa)`, a jej otwieracz ZAMYKA pozostałe warstwy
i gasi podgląd mapy w pierwszych trzech linijkach — wzorzec jest już w kodzie
(`przelaczRankingi`: `STAN.podgladMapy = false; zamknijInformacje();`), więc
„jak ranking” jest odpowiedzią na pytanie „jak otwierać nową warstwę”.
(2) Symetrycznie: każdy ISTNIEJĄCY otwieracz warstw dostaje zamykacz nowej
warstwy, bo przełączniki działają w obie strony — inaczej użytkownik może
otworzyć drugą warstwę POD spodem i widzieć pustą kartę.
(3) Klasę na `body` licz w JEDNYM miejscu (`odswiezWidocznoscPaneli`), a w
otwieraczu tylko `classList.add` jako skrót — podwójne źródło prawdy rozjeżdża
się przy pierwszym zamknięciu z innej ścieżki.
(4) Regułę CSS i kolejność otwierania pinuj w `test/kontrakt.test.js`
(`body.<klasa> .panel-centralny:not(#<id>) { visibility: hidden; }` dosłownie),
bo test zachowania jej nie widzi. (5) Gdy dodajesz warstwę, przejrzyj WSZYSTKIE
selektory z `.panel-centralny` — `grep -n "panel-centralny" app/styles.css`
zajmuje sekundę i pokazuje, czy nowa karta nie jest gdzieś wygaszana.

## L62 (2026-09-13) — budżet lektury: najpierw policz, KTÓRY dokument go zjada

**Objaw:** po fali decyzji właściciela (uwagi F, G, J, K — każdy z nowym ADR-em
albo aneksem) `npm run budzet` pokazał 99 281 / 100 000 tokenów, czyli 719
tokenów rezerwy. Pierwsza próba odzyskania miejsca poszła w `docs/LESSONS.md`
(15 899 tok, największy pojedynczy plik po ADR-ach): rejestr został skrócony
(objaw i przyczyna jednym zdaniem, reguła w całości, długie reguły z początkiem)
i rozdzielony — pełne opisy przypadków trafiły do `docs/LESSONS_ARCHIVE.md`.
Efekt: 97 957 tok, czyli ~1,3 tys. odzyskane, a nie kilka tysięcy.

**Przyczyna:** tabela `npm run budzet` per plik pokazuje, gdzie naprawdę siedzi
koszt: 45 ADR-ów ≈ 64 633 tok (66% budżetu), `docs/LESSONS.md` ≈ 14 575 tok,
`docs/PROTOKOL.md` ≈ 10 759 tok, `AGENTS.md` ≈ 2 726 tok,
`docs/setup/ENVIRONMENT.md` ≈ 2 112 tok, `docs/ROADMAP.md` ≈ 1 067 tok. LESSONS
był więc tylko trzecim zjadaczem, a w dodatku jego wpisy są z natury krótkie
(średnio ~950 znaków), więc skrót objawu/przyczyny daje niewiele — wagę robią
długie reguły, a tych nie wolno ciąć, bo to jedyna część, którą agent stosuje.

**Reguła:** (jak w rejestrze) tnij największego zjadacza, nie najbliżej
stojącego. Mechanika podziału LESSONS, która zadziałała i jest odwracalna:
skrypt rozcina rejestr po `^## L\d+ `, w każdym wpisie szuka trzech etykiet
(`**Objaw:**`, `**Przyczyna:**`, `**Reguła:**` — pin w `test/kontrakt.test.js`
gwarantuje, że są we WSZYSTKICH wpisach), skrót robi na granicy zdania w oknie
znakowym, pełny wpis dokleja do archiwum, a do rejestru dodaje odnośnik
`docs/LESSONS_ARCHIVE.md → ## LN`. Kontrakt podziału pilnuje trzech rzeczy:
archiwum ma DOKŁADNIE te same numery w tej samej kolejności co rejestr, każda
lekcja w rejestrze ma odnośnik do swojego wpisu w archiwum, a
`plikLektury(ROOT)` archiwum NIE zawiera. Dodatkowo `AGENTS.md` §0 musi
wymieniać archiwum w dwóch miejscach: przy pozycji 4 (co czytasz i w jakiej
postaci) i w liście „czego NIE czytasz na start" — inaczej następny agent uzna
plik za porzucony albo, przeciwnie, wciągnie go w budżet.

Kolejny krok, gdy próg pęknie naprawdę: ADR-y. Kandydatów szuka się po statusie
i aneksach (ADR w całości uchylony przez późniejszy, np. przez serię aneksów
właściciela), a przeniesienie do `docs/decisions/archive/` wymaga tylko zmiany
ścieżki w linku rejestru — pin „ADR na dysku ↔ rejestr" czyta
`readdirSync('docs/decisions')` z filtrem `^\d{4}-.*\.md$`, więc podkatalog nie
wchodzi ani w pin, ani w budżet. Tego podziału NIE robimy „przy okazji": wymaga
przeglądu 45 decyzji i zgody właściciela na to, które z nich są historyczne.

## L63 (2026-09-13) — usuwasz przycisk-ujście? Wypisz stany, w których był potrzebny, i każdemu daj drogę automatyczną

**Objaw:** uwaga J właściciela brzmiała „usuń w całości" — setup przestał szukać
gier w `localStorage`, więc z `index.html` zniknęły `#karta-wznowienie`
(„▶ Wznów grę" / „🗑 Nowa gra (kasuje zapis)") i `#multi-wznowienie`
(„↩ Wróć do gry" / „🗑 Porzuć zapamiętaną grę"). Razem z nimi znikały jedyne
ujścia dwóch stanów: zepsutego zapisu hotseat (bez przycisku kasowania telefon
proponowałby go przy każdym starcie) i sesji multi, której most już nie zna
(bez przycisku porzucenia start próbowałby wracać do gry, której nie ma).

**Przyczyna:** przycisk-ujście jest rzadko klikany, więc wygląda na ozdobę flow,
ale w kodzie bywa JEDYNĄ ścieżką wyjścia ze stanu. Usunięcie go bez przeglądu
stanów zostawia pułapkę: aplikacja wchodzi w stan, z którego nie ma wyjścia,
i odtwarza go przy każdym uruchomieniu.

**Naprawa (ADR 0045):** dla każdego stanu, który obsługiwał usunięty przycisk,
droga automatyczna albo inny istniejący przycisk:
- zepsuty snapshot (`walidujStanSurowy` zwraca kody `T**`) → start kasuje oba
  klucze (`okolica:gra:<kod>` i `okolica:gra-aktywna`) i mówi to w statusie
  z kodami usterek;
- gra w fazie `koniec` → start kasuje zapis (wynik jest w historii gier,
  ADR 0010), bo automatyczne otwieranie starego wyniku przy każdym starcie
  byłoby pułapką większą niż brak powrotu;
- gra zakończona RĘCZNIE (⚙ START GRY → TAK) → zapis ZOSTAJE i wraca
  (właściciel 2026-09-11: ręczne zakończenie nie kasuje zapisu, grę można
  dokończyć), a wyjściem jest „Wróć na początek" (`wrocNaPoczatek`);
- sesja multi → kasują ją cztery drogi: `opuscLobby`, `onStanGryMulti` przy
  `stan: zakonczona`/`archiwum`, `rezygnujZGryMulti` (także koniec gry hosta —
  ADR 0019 aneks 2026-09-13b) i jawna odmowa mostu w `przywrocGreMulti`
  (gry nie ma, nieznany schemat, nie ma Cię na liście graczy). Awaria sieci
  sesji NIE kasuje — tunel nie może wyrzucić gracza z gry.

**Testy:** powrót bez kliku jest testowany dwiema ścieżkami, bo boot robi jedno
i drugie: hotseat synchronicznie (asercja od razu po `await import('../app/app.js')`,
bo `start()` kończy się `przywrocGreHotseat()`), a multi asynchronicznie
(`przywrocGreMulti()` czeka na GET mostu — w teście potrzebne `przelaczNa(u)` na
właściwe urządzenie i `await oddech()`, ewentualnie helper `przepompuj`).
Zapis przy pożegnaniu (`pagehide`, `visibilitychange → hidden`) testuje się przez
usunięcie snapshotu z pamięci atrapy i sprawdzenie, że zdarzenie go odtworzyło —
inaczej asercja przechodzi dzięki zapisowi po tranzycji, a nie dzięki nasłuchowi.

## L64 (2026-09-13) — usuwasz przycisk: grepuj TABELE KOMUNIKATÓW w modułach, nie tylko HTML i dokumenty

**Objaw:** audyt scalonego PR #19 (sesja 2026-09-13b) znalazł osiem zdań, które
gracz czyta w stanie awaryjnym i które odsyłają do kontrolek usuniętych kilka fal
wcześniej. Siedem z nich dotyczy fali ADR 0043 (m12-107/110): „…zakończ grę
przyciskiem „■ Zakończ grę”” w `KODY_POZYCJI` **P03**, **P04**, **P08**,
w komunikacie `stanDojscia` o brakujących współrzędnych stacji (**P06**) i w
statusie `onBlad` watchera w `app.js`; do tego „Zakończ grę albo wgraj paczkę
ponownie **z pliku**” (wczytywania plikiem nie ma od 2026-09-07, ADR 0006 aneks 3)
i **R19** „zapisz go przyciskiem „Zapisz nowy”” (bramka tożsamości to imię + PIN
i jedno wołanie `profil-ustaw`, ADR 0026). Brama: 760/760 zielonych.

**Przyczyna:** L58 pkt 1 każe po fali usuwania grepać nośniki żywe i wymienia je
jako pliki (`index.html`, `app/*.js`, `sw.js`, dokumenty, `.gs`) — grep szedł więc
po etykietach i identyfikatorach węzłów, a martwe zdania siedziały w **tabelach
komunikatów** (`KODY_POZYCJI`, `KODY_WIELOOSOBOWE`) i w gałęziach błędów
(`status(...)`, `textContent =`). Tych tekstów nie ma w `index.html`, więc
przegląd HTML ich nie łapie, a strażnik dryfu nie dostał ani jednej frazy z fali
ADR 0043 (miał 30 fraz z fal H/I/J i ADR 0034–0045). Dodatkowo audyt PR #18
(sesja 2026-09-12K) zapisał te komunikaty jako POPRAWNE — „odsyłają do
„■ Zakończ grę” (ADR 0029 aneks m12-94). OK.” — fala, która przycisk usunęła,
nie wróciła do zdań na niego wskazujących (L27).

**Naprawa (m12-111):** wszystkie zdania przestawione na prawdziwą drogę
(⚙ START GRY → wpisz TAK → „■ ZAKOŃCZ AKTUALNĄ GRĘ”), R19 na „wpisz imię i PIN
jeszcze raz”, a zdanie o uszkodzonym kontenerze na repozytorium/wklejenie
odpowiedzi modelu. Lista w aneksie 2026-09-13b do ADR 0043 (L63: lista ujść
należy do ADR-a, nie do handoffu).

**Reguła:**
1. Nośniki TEKSTU to nie tylko węzły DOM. Przy usuwaniu przycisku albo akcji
   przegrepuj: tabele kodów w modułach (`KODY_POZYCJI`, `KODY_WIELOOSOBOWE`,
   `KODY_TRWALOSCI`, kody `G**`/`E**`/`T**`/`R**`), zdania `status(...)`
   i przypisania `textContent` w gałęziach błędów, oraz lustro mostu
   (`docs/setup/*.gs` — most też mówi do gracza kodami).
2. Każdą martwą frazę wpisz w tym samym commitcie do
   `test/dryf-dokumentow.test.js` jako `{ fraza, nosniki, powod }`. Fraza ma być
   DOSŁOWNYM kawałkiem zdania dla gracza („zakończ grę przyciskiem”, „wgraj
   paczkę ponownie z pliku”), nie samą etykietą przycisku: etykietę celowo
   cytują nagrobki w komentarzach i w ADR-ach (L31), więc strażnik na etykiecie
   gasiłby własny kod.
3. Do zakazu dołóż niezmiennik POZYTYWNY: kontrakt, który czyta wiersze KODU
   (helper `wierszeKodu(tekst)` w `test/kontrakt.test.js` wycina komentarze
   blokowe i liniowe) i wymaga, żeby każde zdanie o danej akcji nazywało
   kontrolkę, która istnieje — „zdania o końcu gry zawierają ⚙ START GRY”.
4. Sprawdź zdanie w stanie, w którym gracz je czyta: komunikat awaryjny musi
   podać drogę działającą W TYM stanie. W drodze panel gry jest schowany, więc
   zdanie o dojściu potrzebuje drugiego nośnika (`status()` → `#status`
   z `aria-live` w ⓘ Informacjach, ADR 0042).

**Testy, które pilnują:** `test/dryf-dokumentow.test.js` (trzy nowe frazy fali
ADR 0043 + poprawiony `powod` wpisu o pomijaniu stacji, który sam cytował martwy
przycisk), `test/kontrakt.test.js` („zdania dla gracza o końcu gry nazywają ikonę
⚙ START GRY” + pin drugiego nośnika), `test/pozycja.test.js` (zakaz frazy
i niezmiennik ⚙/TAK dla kodów P i dla `stanDojscia`), `test/wieloosobowa.test.js`
(R19 bez „Zapisz nowy”, z PIN-em).

## L65 (2026-09-13) — `hidden` na przodku gasi potomków: atrapa DOM tego nie widzi, przeglądarka tak

**Objaw:** audyt PR #19 (sesja 2026-09-13b): w stanie „w drodze” przycisk
„▶ Symuluj dojście (tryb testowy)” — jedyna droga domknięcia odcinka bez GPS,
obiecana przez WORKFLOW §3 i §4.3 pkt 3, ARCHITECTURE i ADR 0036 aneks m12-102
pkt 2 — nie był w przeglądarce osiągalny. Pomiar headless Chromium 153
(390×844, ENVIRONMENT §4.1): `#przycisk-symulacja-gra`, `#gra-panel-odcinek`,
`#gra-dystans-odcinka` i `#gra-komunikat` mają `getBoundingClientRect()` **0×0**
i `offsetParent === null`, a `#gra-pasek` (poza panelem) renderuje się normalnie.
Brama: 763 testy zielone, w tym 20 wywołań helpera `dojdzSymulacja()`, który
klika ten przycisk.

**Przyczyna:** `odswiezPasekDrogi()` ustawia `$('gra-sterowanie').hidden = droga`,
a panel fazy B jest POTOMKIEM `#gra-sterowanie`; `styles.css` ma twardą regułę
`[hidden] { display: none !important; }`, więc znika całe poddrzewo. W tej samej
tranzycji `renderujGre` odsłania przycisk (`hidden = !(STAN.trybTestowy && faza
=== odcinek)`) — kod sam sobie przeczy, ale widać to dopiero w przeglądarce:
atrapa DOM (`test/helpers/dom.js`) nie modeluje kaskady, dziedziczenia ani
geometrii, a `kliknij()` woła handler bez pytania o renderowanie (rodzina L13:
„schowany panel ma rozmiar zerowy”).

**Naprawa (m12-112):** `$('gra-sterowanie').hidden = droga && !STAN.trybTestowy;`
— w terenie bez zmian (nad mapą zostaje sam pasek, ADR 0043 pkt 1), a w trybie
testowym panel fazy B robi to, co obiecuje ADR 0036 aneks m12-102 pkt 2. Pomiar
po poprawce: panel 370×124, przycisk symulacji **328×45** (cel ≥ 44 px,
ADR 0011), duży dystans 340×29, komunikat 370×41. Aneks 2026-09-13b do ADR 0036.

**Reguła:**
1. Zmiana widoczności PRZODKA (`hidden`, `display`, `visibility`, `inert`, klasy
   na `body` typu `body.gra-w-drodze`) to zmiana widoczności całego poddrzewa.
   Wypisz potomków, którzy są celami akcji (przyciski, pola, linki), i sprawdź,
   czy któryś nie jest jedyną drogą do funkcji (L63) albo jedynym nośnikiem
   komunikatu (L6).
2. Zielony test w atrapie DOM NIE jest dowodem, że gracz to zobaczy: atrapa nie
   ma kaskady, geometrii ani `offsetParent`. Asercja `hidden === false` mówi
   o atrybucie, nie o renderowaniu.
3. Taką zmianę mierz w prawdziwej przeglądarce (ENVIRONMENT §4.1 — headless
   Chromium z npm): `getBoundingClientRect()`, `offsetParent`,
   `document.elementFromPoint()` dla celu dotykowego. Próba kosztuje kilkanaście
   sekund, a rozstrzyga to, czego atrapa nie widzi; wynik (tabelka wymiarów)
   wpisz do `docs/PROJECT_HISTORY.md` i do ADR-a.
4. Zachowanie zależne od trybu pinuj DWOMA testami: jednym w trybie testowym
   (`?tryb=test`), drugim terenowym (atrapa `navigator.geolocation`,
   `naEkranPozycji(...)` + `wyslijFix`). Jeden test w jednym trybie przypina
   zachowanie, którego w drugim trybie nie ma — tak właśnie asercja „panel
   schowany w drodze” żyła w teście chodzącym w `?tryb=test`.
5. Kafelki i sieć w sandboxie nie działają (L3), ale do pomiaru widoczności nie
   są potrzebne: wystarczy stan DOM ustawiony tymi samymi zdaniami, którymi
   ustawia je aplikacja.

## L66 (2026-09-13) — dokumenty z pinami: kolejność aneks → cytowanie, kotwice ASCII przy zamianach, sprawdzanie cytowań przed przeniesieniem

**Objaw:** sesja 2026-09-13c (fala zgłoszeń terenowych N–S, PR #20), dwa
potknięcia przy pracy na dokumentach — oba bez wpływu na zachowanie aplikacji,
oba wykryte przez bramy, nie przez czytanie:

1. `node --test test/dryf-dokumentow.test.js` → test 5 („cytowane aneksy ADR
   istnieją") czerwony z komunikatem `ADR 0010 nie ma aneksu z tą datą`.
   WORKFLOW.md dostał zdanie z „(ADR 0010 aneks 2026-09-13)" w momencie, gdy
   aneks jeszcze nie istniał — porządek pracy był odwrotny niż porządek, którego
   pilnuje strażnik.
2. Zamiana akapitu w README.md nie trafiła, choć wyszukiwany fragment wyglądał
   identycznie: w `stare` cudzysłów zamykający był U+201D (`”`), a plik miesza
   `„` (U+201E) z prostym `"` (ASCII). Różnica jednego znaku, niewidoczna
   w diffie terminala i w podglądzie.

**Przyczyna:** dokumenty tego repozytorium są nośnikami stanu pilnowanymi
testami (`test/dryf-dokumentow.test.js`): strażnik zbiera cytowania
`ADR NNNN aneks RRRR-MM-DD[x]` ze WSZYSTKICH żywych nośników — `DOKUMENTY`
(README, AGENTS, ROADMAP, WORKFLOW, ARCHITECTURE, ASSETS, PROTOKOL, LESSONS),
`UI` (index.html, sw.js, app/*.js), testy i lustro `.gs` — i wymaga, żeby plik
ADR zawierał dokładnie tę datę. Cytat jest więc obietnicą składaną ZANIM treść
powstanie, jeśli kolejność jest odwrotna. Osobno: polski tekst w plikach
projektu nie ma jednego standardu cudzysłowów (historyczne edycje różnych
narzędzi), więc dopasowanie literalne całych zdań jest kruche — to rodzina L2
(mojibake/UTF-8) w wydaniu „znak poprawny, ale inny".

**Naprawa:** aneksy ADR 0010/0015/0017/0019/0032 dopisane PRZED ponownym
uruchomieniem strażnika (test 5 → zielony, 5/5); zamiany w README.md,
WORKFLOW.md i ARCHITECTURE.md wykonane metodą przęsła: wyszukać unikalny
fragment ASCII początku i końca (`s.index(start)`, `s.index(end)`), podmienić
tekst pomiędzy nimi — pięć przęseł, zero nietrafionych, bez dotykania
cudzysłowów. Weryfikacja: `grep -rn 'Poprzednie gry\|okolica:historia'` po
nośnikach żywych → zero trafień.

**Reguła:**
1. Kolejność fali dokumentowej: (a) aneks w pliku ADR, (b) dopiero potem
   cytowanie go z datą w żywym nośniku. Jeśli treść nie jest jeszcze gotowa,
   cytuj BEZ daty („ADR 0010 aneks") — strażnik szuka wyłącznie wzorca
   `ADR\s*(\d{4})\s*aneks\s*(\d{4}-\d{2}-\d{2}[a-z]?)`, więc cytat bez daty
   niczego nie obiecuje. Format nagłówka aneksu: `## Aneks RRRR-MM-DD[x]
   (mNN-NNN, o czym)`.
2. Zamiany w dokumentach z polskim tekstem kotwicz na fragmentach ASCII:
   `i = s.index(start); j = s.index(end); s = s[:i] + nowe + s[j:]`. Nigdy nie
   buduj `stare` z całych zdań zawierających cudzysłowy, myślniki ani `„…”` —
   a po zamianie sprawdzaj `git diff` i grepem (L2).
3. Przed przeniesieniem treści ADR do archiwum przegrepuj żywe nośniki pod
   kątem cytowań z datą (`grep -rn '0019 aneks 2026-09-11' README.md docs/ app/
   test/ *.gs`) ORAZ asercji testów czytających nagłówki tego pliku
   (`grep -rn '0019-gra-wieloosobowa' test/`) — przenoś tylko sekcje, których
   nikt nie cytuje i których żaden test nie czyta. W tej sesji tak poszły
   aneksy 2026-09-06 … 2026-09-11b (2 268 tok), a zostały cytowane 2026-09-12f,
   2026-09-13, 2026-09-13b.
4. Plik w `docs/decisions/archive/`, który NIE jest wycofanym ADR-em (np.
   pojemnik na przeniesione aneksy), nazwij bez przedrostka `NNNN-`: kontrakt
   „archiwum ADR-ów" wymaga od plików `^\d{4}-` wiersza `- Status: Wycofana`
   i wiersza w rejestrze, a budżet i rejestr skanują tylko wzorzec `^\d{4}-`.
   Nazwa `aneksy-0019-…md` jest poza oboma skanami.
5. Komentarz-nagrobek w kodzie (L31) i wpis w strażniku martwych fraz (L58/L64)
   nie mogą cytować DOSŁOWNYCH napisów usuniętej funkcji, jeśli ten napis jest
   właśnie frazą martwą — nagrobek opisuje rzecz („historia lokalna",
   „poprzednia gra"), a frazę wpisuje się w strażniku raz, w `MARTWE_FRAZY`,
   z listą nośników. Testy nie są nośnikiem fraz martwych (strażnik sprawdza
   `DOKUMENTY` + `UI`), więc kontrakt odwrócony może nazwać usuniętą rzecz.

## L67 (2026-09-13) — utrwalona kolejka zdarzeń: wypchnięcie przed odczytem stanu, ponowienie bezpieczne dzięki mostowi, piny żądań zawężone do celu

Fala: trzecia fala zgłoszeń właściciela 2026-09-13 (m12-114, PR #20, ADR 0019
aneks 2026-09-13d, ADR 0011 aneks 2026-09-13d, ADR 0017 aneks 2026-09-13d).

### Objaw 1 — odpowiedź bez zasięgu ginęła po odświeżeniu telefonu

Właściciel: „napraw w tej sesji" (odrzucone: zostawienie ograniczenia
w dokumentacji i przeniesienie do osobnej fali). Aneks 2026-09-13c ADR 0019
kończył się znanym ograniczeniem: zdarzenie niedostarczone czekało w kolejce
`app/sync.js` TYLKO w pamięci operacyjnej, więc reload je gubił. Most nie
poznawał odpowiedzi, stacja zostawała otwarta i gracz przechodził ją jeszcze
raz — a gra sieciowa nie ma lokalnego snapshotu (`zapiszGre` wychodzi przy
`STAN.multi`), więc nie było drugiej kopii.

### Objaw 2 — powrót do gry budował rozgrywkę ze stacją właśnie domkniętą

Po utrwaleniu kolejki (`okolica:multi-kolejka`, schemat `zdarzenia-kolejka/1`)
`przywrocGreMulti` pobierał stan gry ZANIM zaległe zdarzenia doszły na most:
most zwracał grę ze stacją 1 otwartą, telefon budował z niej rozgrywkę, a chwilę
później te same zdarzenia ją domykały — gracz widział cel, którego już nie ma
(i przechodził stację drugi raz, tym razem z odmową mostu).

### Przyczyna

Stan gry na telefonie jest POCHODNĄ odpowiedzi mostu. Kolejka zdarzeń, która
przeżyła restart aplikacji, jest częścią tego stanu — musi być wypchnięta przed
odczytem, inaczej odczyt jest nieaktualny w chwili narodzin. Wcześniej kolejka
żyła tylko w RAM, więc problem nie mógł się ujawnić: po restarcie nie było czego
wypychać.

### Naprawa

1. `app/wieloosobowa.js`: `walidujKolejkeZdarzen(surowy, { kod })`,
   `zapisKolejkiZdarzen(zdarzenia, { kod, idGry })`,
   `LIMIT_KOLEJKI_ZDARZEN` = 50 (wzór: kolejka wyniku hot-seat i kolejka ocen —
   śmieciowy albo CUDZY zapis daje pustą listę, nigdy wyjątku).
2. `app/sync.js`: trzy wstrzyknięte uchwyty (`wczytajKolejke`, `zapiszKolejke`,
   `limitKolejki`), startowa kolejka z pamięci, `utrwalKolejke()` przy KAŻDYM
   ruchu (push przy awarii sieci, shift po wypchnięciu, shift po odmowie mostu),
   jawna odmowa przy pełnej kolejce. Moduł nadal nic nie wie o `localStorage`.
3. `app/app.js`: `dostarczZalegleZdarzeniaMulti(sesja)` wołane w
   `przywrocGreMulti` PRZED `pobierzGetMulti`; awaria sieci zostawia resztę
   w pamięci (`break` + `slice`), odmowa mostu kasuje zdarzenie (`continue`);
   klucz idzie w kosz razem z sesją (`usunSesjeMulti`).
4. Warunek bezpieczeństwa ponowienia jest po stronie MOSTU: `przyjmijZdarzenie`
   odrzuca drugą odpowiedź tego gracza do tej stacji, więc częściowe
   dostarczenie nie tworzy duplikatu. Zapisane w ADR jako warunek, nie zbieg
   okoliczności — gdyby reguła zniknęła, utrwalona kolejka staje się groźna.

### Objaw 3 — pin „dokładnie jedna powtórka" padł po dodaniu żądań w tle

Test zimnego startu mostu (2026-09-12) liczył `atrap.wywolania.length === 2`.
Wstępne pobieranie paczek (ADR 0017 aneks 2026-09-13d) dokłada żądanie PLIKU
paczki, więc lista miała 3 pozycje — pin mierzył wszystko, co kiedykolwiek
wyszło do sieci, a nie powtórki żądania indeksu.

### Naprawa 3

Pin zawężony do celu: `wywolania.filter((u) => u.includes('indeks.json')).length
=== 2`. Zasada: pin liczący żądania nazywa swój cel (adres albo akcja), a przy
dokładaniu żądań w tle trzeba przegrepać testy pod kątem `wywolania.length` —
to jedyny sposób, żeby znaleźć piny, które mierzyły „nic więcej się nie dzieje".

### Testy (767/767, +9 w tej fali)

- Jednostkowe `app/sync.js`: utrwalanie przy push/shift, start nowej instancji
  z `wczytajKolejke` (FIFO przy pierwszym kroku), limit z jawną odmową.
- Jednostkowe `app/wieloosobowa.js`: round-trip przez JSON, cudzy `kod`, śmieci.
- End-to-end (`test/wieloosobowa-ui.test.js`): odpowiedź bez zasięgu →
  odświeżenie → zdarzenia na moście PRZED stanem gry, pamięć czysta, cel
  „stacja 2 z 3" (nie powtórka stacji 1), punkt na moście; oraz odświeżenie
  WCIĄŻ bez sieci — nic nie wychodzi, nic nie jest kasowane, a po powrocie sieci
  zdarzenia dochodzą raz.

## L68 (2026-09-14) — kamienie M0–M12 nie czekają na 360 px ani na pierwsze wdrożenie mostu

**Objaw:** po audycie PR #22 (sesja 2026-09-14) agent, nie mając nowych uwag z terenu, streszczał właścicielowi, że M3–M12 „czekają na kryteria terenowe / 360 px / nowy deployment web app”. Właściciel: to bzdury sprzed 20 PR-ów. Gra jest w teście na iPhonie (1334×750). Most Apps Script wdrażany przy niemal każdym PR (~wersja 15). Agent nie ma brać M3 z ROADMAP.

**Przyczyna:** status 🟡 i zdania „kamień czeka…” przeżyły fale testów (A–H, N–S, T1–T3). AGENTS §2 kazał bez zlecenia brać najwyższy nieukończony kamień; WORKFLOW §1.6 i §4.2–4.4 brzmiały jak otwarte bramki (360 px bez przewijania, ROADMAP dostaje ✅, NOWY deployment). Strażnik dryfu pinował usunięte przyciski, nie mantrę czekania.

**Naprawa:** ROADMAP — wszystkie M0–M12 ✅, otwarta pętla uwag z terenu. AGENTS §2 — bez zlecenia czekaj. WORKFLOW §4 — pomoc przy teście, nie kamień. README bez zdań „Kamień czeka…”. BACKLOG bez „albo kamień milowy”. Pin w `test/dryf-dokumentow.test.js`.

**Reguła:** jak w rejestrze. CSS/kontrakt nadal mogą pinować overflow na wąskim telefonie — to nie jest bramka ROADMAP.

**Testy:** `test/dryf-dokumentow.test.js` (frazy „Kamień czeka na”, „najwyższy nieukończony kamień”, „najwyższy otwarty kamień milowy”, „pełna konfiguracja bez przewijania na 360”); kontrakt numeracji LESSONS.

## L69 — dwie metryki odległości w jednej grze (2026-09-14, audyt PR #24 → m12-117)

**Objaw (zmierzony, nie zgłoszony):** fixture `overpass-centrum`, pozycja
`52.22570, 21.00770`, 3 stacje × 1 pytanie, 60 min → promień 700 m, klucz
cache `okolica:sieci:u3qcn5-700-piesza`. Sieć wybiera stacje i numeruje je
drogą: 485 / 527 / 524 m (kreską 466 / 273 / 670 m). Wklejka poprawnej paczki
przestawiała grę na `2, 1, 3` — stacją 1 zostawała `52.22700, 21.01110`
(273 m kreską, 527 m drogą) — i pokazywała na niej „485 m drogą od
poprzedniego punktu", czyli dystans CUDZEGO odcinka z etykietą sieciową.
Sonda na tym samym fixture: 4 740 pozycji z rozjazdem metryk (3 253 bez
usterki S12) — nie jest to przypadek brzegowy.

**Przyczyna:** `kolejnoscTrasy`/`uporzadkujGre` mają `dystansStart` i
`macierz` jako OPCJE z domyślną kreską. PR #24 wpiął porządkowanie w dwie
ścieżki; przy wklejce (`sprawdzOdpowiedz`) wywołanie powstało bez metryki,
bo w miejscu wywołania nie było widać, że stacje przyszły z dijkstr. Druga
połowa: przestawienie nie kasowało `STAN.wynikSieci`, a `dystanseOdcinkowM`
czyta macierz POZYCJAMI, więc po zmianie kolejności przypisuje dystanse
innym odcinkom i stempluje je `dystansSieciowy: true`.

**Naprawa:** wklejka podaje `dystansStart` = `dystansSieciowyM` stacji
(z fallbackiem na kreskę przy braku/NaN) i `macierz` = `wynikSieci.macierz`;
przy faktycznym przestawieniu `STAN.wynikSieci = null`. Kolejność sieciowa
jest wtedy punktem stałym — status nie mówi „uporządkowano trasą", a UI
pokazuje własny dystans odcinka.

**Testy:** `test/aplikacja.test.js` — „uwaga B (dogrywka): wklejka nie
przestawia stacji z sieci": cache sieci w pamięci atrapy, wklejka z
`paczka-ok.json` (środek i promień z konfiguracji, E16), asercja na
TOŻSAMOŚĆ stacji 1 (współrzędne z `#lista-stacji` vs `#gra-cel-stacji`),
brak „uporządkowano trasą" w statusie i własny dystans pierwszego odcinka.
`test/kontrakt.test.js` — pin przepisany z jednowierszowego wywołania na
kontrakt metryki (`dystansStart: drogi ? …`, `macierz: drogi ? …`, kasowanie
`wynikSieci` w bloku wklejki) + pin aneksu m12-117.

**Reguła:** patrz rejestr. Ogólniej: gdy funkcja ma metrykę jako parametr
opcjonalny, każde NOWE miejsce wywołania musi odpowiedzieć na pytanie „jaką
metryką powstały te dane?" — a test porównawczy ma pinować tożsamość
elementu, nie tylko jego miarę (485 m było „poprawną" liczbą z cudzego
odcinka).

## L70 (2026-09-14) — metryka poprawna nie wystarcza, gdy gracz planuje po mapie (zgłoszenie „m117" → m12-118)

**Objaw (teren, gra „m117" po PR #25).** Właściciel: „najbliższa stacja jest
jakieś 100 m główną ulicą od startu — najczęściej ląduje tam Stacja 2, czasem
stacja 5, sporadycznie stacja 1. Jak najbliższą jest stacja 2, to zawsze do
stacji 1 muszę przejść obok niej i wrócić". Dane z terenu: start → nr 2 ≈100 m
i drogą, i kreską (ta sama ulica), start → nr 1 ≈300 m drogą (obok nr 2),
≈200 m kreską, z alternatywnym obejściem ≈400 m.

**Dwie naprawy, które nie wystarczyły.** m12-116 wprowadził twarde wejście
(stacja 1 = najbliższa startu w metryce porządkowania) na wszystkich ścieżkach;
m12-117 ujednolicił metrykę porządkowania (wklejka nie przestawia już stacji
z sieci; audyt PR #24, defekt D1). Obie naprawy są poprawne i obie dotyczą
metryki DROGOWEJ — a zgłoszenie wróciło.

**Diagnoza (sondy, nie zgadywanie).** Na `test/fixtures/overpass-centrum`
(N = 4, R = 700, 198 pozycji): stacja 1 = najmniejszy `dystansSieciowyM`
w 198/198 układów, a trasa do stacji 1 nie przechodzi bliżej niż 50 m od
innego pinu w 198/198 (minimum zmierzone: 150 m). Natomiast **44/198 (22%)**
układów ma stację, która w LINII PROSTEJ jest bliżej startu niż stacja 1 —
przykład: stacja 1 = 297 m drogą / 214 m kreską, inna stacja = 315 m drogą /
**150 m kreską**. To jest zgłoszony objaw: pin „obok", ale z numerem wyżej.

**Przyczyna.** Pin, który gracz mija, nie jest „najbliższy" w żadnej
z metryk modelu — jest najbliższy OCZAMI. Jego dostęp drogowy biegnie inną
siecią (osobno mapowany chodnik, przejście dopiero za skrzyżowaniem), więc
`dystansSieciowyM` rośnie, a numeracja — słusznie w swojej metryce — stawia
go za stacją 1. Gracz nie chodzi po grafie, a aplikacja nie rysuje trasy:
planuje po kresce start→stacja 1 i idzie prosto przez pin. Poprzednie naprawy
pilnowały spójności metryk między modułami; nikt nie pilnował, czy TA SAMA
trasa nie mija pinu w geometrii, którą gracz widzi.

**Naprawa (m12-118).** Brama wejścia w `wybierzStacje`: po wyborze układu
i policzeniu kolejności piny w promieniu `mijanieProgM = 50 m` (próg dojścia
z ADR 0034) od DWÓCH tras — `sciezkaPunkty` stacji 1 (droga z modelu) i prostej
kreski start→stacja 1 (czytanie mapy) — wypadają z puli kandydatów, a układ
jest liczony od nowa (`mijanieMaxRund = 3`). Twarde wejście po drodze zostaje;
gdy sieć nie da układu bez mijania, wynik niesie usterkę S14 i UI mówi to
wprost. Pomocnicze funkcje czyste i eksportowane: `odlegloscOdTrasyM`,
`mijaneStacje({ trasy, stacje, progM })`.

**Testy.** `test/stacje.test.js`: (1) jednostkowe `odlegloscOdTrasyM`
i `mijaneStacje` (pin 25 m od trasy, pin poza zasięgiem, `progM: 0` wyłącza,
pozycja 0 nigdy nie jest mijana); (2) regresja na sieci z ręki — ulica na
północ + chodnik 25 m obok wpięty dopiero na 600 m: przy `mijanieProgM: 0`
układ to „Główna 800" (800 m drogi) i pin na chodniku (845 m drogi / 381 m
kreską / 25 m od trasy do stacji 1) — defekt jak z pola; przy domyślnych 50 m
pin wypada, zostaje {400 m, 800 m}, `wejscie.odrzucone = 1`, `rundy = 2`,
usterki puste, stacja 1 nadal najbliższa drogą; (3) własność na trzech
fixture'ach (centrum, przedmieście, las, po 12 pozycji): po bramie żaden pin
nie leży w promieniu 50 m od tras do stacji 1, a stacja 1 pozostaje
najbliższa drogą. Pomiar zasięgu reguły na fixture'ach: 0/100 centrum,
0/104 przedmieście, 2/94 las (w obu przypadkach lasu stary układ miał pin
w zasięgu trasy).

**Reguła (skrót dla rejestru).** Metryka poprawna nie wystarcza, gdy gracz
planuje po mapie: brama wejścia mierzy mijanie w OBU trasach — tej, którą
idzie model, i tej, którą widzi gracz.

## L71 (2026-09-14) — osobno mapowany chodnik wzdłuż jezdni zatruwa dystans sieciowy; lecz graf, nie objaw (zgłoszenie „m118" → m12-119)

**Objaw.** Po bramie z m12-118 (L70) właściciel zgłosił to samo po raz
kolejny: najbliższy fizycznie pin, ok. 100 m od startu przy głównej ulicy,
dostawał niemal zawsze numer 2, czasem 5 — i gracz musiał go minąć w drodze
do stacji 1. Brama 50 m nie łapała go w terenie właściciela, choć na
fixture'ach łapała patologie lasu. Trzech agentów kolejno proponowało
detektory (próg stosunku kreska/droga, mijanie kreską, mijanie drogą);
żaden nie trafił w przyczynę.

**Diagnoza (sondy na sieci odtworzonej ze zgłoszenia, nie zgadywanie).**
Chodnik wzdłuż głównej ulicy był w OSM osobnym wayem `highway=footway`,
ułożonym równolegle do jezdni i wpiętym do niej dopiero na dalekich
skrzyżowaniach (w skonstruowanej sieci — po 700 m). Węzeł na chodniku
100 m fizycznie od startu miał `dystansSieciowyM` = 424 m (w innym układzie
662 m): najkrótsza trasa grafu szła chodnikiem do dalekiego wpięcia,
łącznikiem i jezdnią z powrotem. Każdy detektor na poziomie WYBORU STACJI
mógł tylko ukryć, że graf kłamie o geometrii — brama 50 m z L70 była bezradna,
bo liczyła sąsiedztwo trasy po chodniku, a kreska start→stacja 1 biegła
jezdnią.

**Przyczyna procesowa.** Założenie „pieszy chodzi po chodnikach, ścieżkach
i schodach" było słuszne dla centrum wielkiego miasta, a trujące w małym
mieście: tam OSM mapuje korytarze wzdłuż jezdni jako osobne klasy, wpięcia
są rzadkie, a gracz i tak chodzi po układzie ulic (brak wydzielonych
przejść, brak autostrad do obchodzenia). Próby kolejnych agentów leczyły
objaw, bo nikt nie porównał klasy drogi pinu z klasą drogi trasy.

**Naprawa (m12-119), decyzja właściciela:** „brać pod uwagę tylko układ
ulic, bez korytarzy pieszych". Z klas trasowania pieszego wypadają
`footway`, `steps`, `cycleway`; z rowerowego `cycleway`. Zostają
`pedestrian` (deptak = ulica bez aut), `living_street`, `residential`,
`service` oraz `path` i `track` — one bywają jedyną siecią w lesie
(fixture las: bez `path` 139→88 węzłów, kompletność 24/44→22/44; dlatego
„wyrzucić wszystko poza jezdniami" też było błędem i zostało mierzalnie
odrzucone). Jedno miejsce filtrowania (`czyDrogaDostepna`) czyści zarówno
świeże pobranie, jak i STARY cache, którym grał właściciel; kwerenda
Overpass klas już nie pobiera.

**Testy.** Graf nie tworzy węzłów z równoległych korytarzy nawet gdy
przyjdą w danych (stary cache); punkt fizycznie 100 m od startu przy
głównej ulicy snapuje się do jezdni z dystansem ≈ 100 m (było ≈1,2 km);
test bramy z L70 przepisany na równoległą ULICĘ — geometria patologii
(boczna ulica wpięta daleko) pozostaje testowalna, bo nie zależy od
chodnika. Pomiary 1056 układów na trzech fixture'ach: pozostałe rozjazdy
kreska/droga mają podejrzany pin ≥89 m od trasy do stacji 1 — gracz go nie
mija; to naturalna geometria osiedli, nie korytarz.

**Reguła (skrót dla rejestru).** Gdy metryka sieciowa kłamie o punkcie przy
głównej ulicy, sprawdź KLASĘ DROGI w danych: osobno mapowany korytarz
wzdłuż jezdni, wpięty daleko, zawyża dystans objazdem. Lecz graf w jednym
miejscu filtrowania (działa też na cache), nie dopisuj detektorów do
wyboru. Zanim usuniesz klasę trasowania, zmierz skutek na KAŻDYM terenie
fixture (miasto/przedmieście/las) — klasy „zbędne w mieście" bywają jedyną
siecią w lesie.

## L72 (2026-09-15) — tryb widoku BIEŻĄCEGO ekranu musi gasnąć przy każdej zmianie ekranu

**Objaw (zgłoszenie z audytu PR #29, sesja 2026-09-15a).** Dwa objawy z tego
samego stanu, oba znalezione w kodzie, nie w terenie:

1. Gra wieloosobowa: gość czeka w lobby, klika ⚙ START GRY, żeby zajrzeć na
   mapę (od m12-124 ⚙ na ekranach setupu chowa warstwę DOKŁADNIE jak oko —
   uwaga A właściciela). Organizator startuje grę; most donosi start
   z pollingu; aplikacja woła `pokazEkran('gra')`. Panel gry jest otwarty
   (`hidden === false`), a gracz widzi samą mapę: nic nie da się kliknąć.
   Ponowny klik ⚙ otwiera warstwę końca gry (gra się toczy), więc jedynym
   powrotem jest oko w stopce — a jedno palnięcie za dużo kończy grę.
2. Hot-seat: przy włączonym podglądzie klik „dane i prywatność" w stopce
   otwiera `#ekran-prywatnosc`, którego nie widać (stopka leży POZA
   panelami, więc jest osiągalna).

**Przyczyna.** `STAN.podgladMapy` jest stanem *sposobu wyświetlenia bieżącego
ekranu*, a gasiły go wyłącznie otwieracze warstw (`przelaczInformacje`,
`przelaczRankingi`, `otworzKoniecGry` — wzorzec z L61). Funkcje zmieniające
ekran (`pokazEkran`, `pokazMapeStartowa`, `pokazPrywatnosc`) zostawiały go
włączonego. W CSS `body.podglad-mapy .panel-centralny { visibility: hidden;
pointer-events: none }`, a w JS każdy panel dostaje `inert` — czyli każdy nowy
ekran rodził się już schowany. Z `EKRANY_SETUPU` (m12-124) do tego stanu doszło
drugie, znacznie bardzie dostępne wejście (ikona w belce, świecąca przez cały
setup), i defekt przestał być teoretyczny.

**Naprawa (m12-125, u root cause, bez maskowania).** Stan gaszą WSZYSTKIE
funkcje zmiany ekranu:
`STAN.podgladMapy = false;` w `pokazEkran()`, w `pokazMapeStartowa()` (mapa
startowa nie ma warstwy, do której podgląd wraca) i w `pokazPrywatnosc()`
(tam `STAN.ekran` zostaje nietknięty, bo nim wracamy). Żadnego `try`/`catch`,
żadnego „jeśli ekran to gra" — reguła jest jedna: zmiana ekranu kończy tryb
widoku starego ekranu.

**Testy i pomiar.**
- `test/aplikacja.test.js` — D1: ⚙ w setupie włącza podgląd, klik w stopce
  otwiera kartę prywatności `inert: false`, klasa `podglad-mapy` zgaszona.
- `test/wieloosobowa-ui.test.js` — pełna ścieżka (L36: test nie może iść
  skrótem): lobby gościa + podgląd + start organizatora z pollingu ⇒
  `#ekran-gra` nieinercyjny, oko „Podejrzyj mapę", `gra-postep` = „stacja 1 z 3".
  Zęby sprawdzone stashem fixu: bez naprawy pada na `true !== false`.
- `test/kontrakt.test.js` — pin 3b w kontrakcie ADR 0043: KAŻDA z trzech
  funkcji ma w ciele `STAN.podgladMapy = false;` (wycięty komentarz, ciało
  funkcji wycięte wzorcem do `\n\}`).
- Pomiar w headless Chromium (ENVIRONMENT §4.1, 390×844): PRZED —
  `visibility: hidden`, `inert: true`, `elementFromPoint` nie trafia w kartę;
  PO — `visibility: visible`, `inert: false`, palec trafia. Bez tego pomiaru
  nie mielibyśmy dowodu, bo atrapa DOM nie liczy kaskady (L65).

**Reguła (skrót dla rejestru).** Każdy stan opisujący, jak wyświetlony jest
BIEŻĄCY ekran, musi gasić KAŻDA funkcja zmiany ekranu, a nie tylko klikalny
przełącznik
— o zmianie ekranu decyduje też kod bez palca. Atrapa nie liczy kaskady, więc
pinuj `inert` + klasę na `body`, a widoczność mierz w przeglądarce.
