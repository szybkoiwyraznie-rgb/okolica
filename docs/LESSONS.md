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
z `innerHTML = ''` migrujemy przy okazji (pozostałe: setup, gracze, prompt,
podsumowanie — BACKLOG B16).

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
index.html app/*.js` + `WERSJA_SW` w `sw.js`, a przed `git add` przegląd
`git status`. Nowy moduł dostaje `?v=` od razu. Kontrakt pilnuje całego grafu
`app/*.js` (od audytu 2026-09-07). Przy podejrzeniu rozjazdu:
`grep -rn "?v=" app/ index.html sw.js` ma pokazać jedną wersję.
