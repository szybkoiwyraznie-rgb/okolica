# LESSONS — rejestr lekcji

Format: `## LN (data, pochodzenie) — tytuł`, objaw → przyczyna → reguła.
Czytasz CAŁY rejestr na start sesji (`AGENTS.md` §0). Nowe lekcje dopisuj na
końcu — nigdy nie zmieniaj numeracji istniejących.

Lekcje L1–L5 są **dziedziczone z projektu AME** właściciela (zmierzone w tamtym
sandboxie w 2026-08/09); przeniesiono je tu na starcie, bo dotyczą tego samego
środowiska, a koszt ich ponownego odkrycia jest realny. Lekcje od L6 wzwyż są
obserwacjami z tego projektu.

## L1 (2026-09-05, dziedziczone z AME) — sandbox resetuje workspace w trakcie sesji

**Objaw:** commity sesji „znikają", HEAD wskazuje `main`, push odrzucony.
**Przyczyna:** środowisko odtwarza workspace ze świeżego klona.
**Reguła:** praca istnieje dopiero po `git push`; po resecie postępuj wg
`docs/setup/ENVIRONMENT.md` §2 (fetch gałęzi sesji + `reset --hard FETCH_HEAD`
+ `push -u`).

## L2 (2026-09-05, dziedziczone z AME) — edycja plików z polskimi znakami

**Objaw:** po edycji w pliku pojawia się mojibake (`Ä…` zamiast `ą`) albo obce
glify w środku polskiego zdania.
**Przyczyna:** narzędzie `edit_file` potrafi uszkodzić UTF-8.
**Reguła:** nowe pliki twórz `write_file`; istniejące pliki z polskim tekstem
edytuj przez `python3` + `pathlib` z `encoding='utf-8'`; po edycji sprawdzaj
`git diff` i grepem `grep -n '[^\x00-\x7FĄ-ż]'` na podejrzanym fragmencie.

## L3 (2026-09-05, dziedziczone z AME) — egress HTTPS zablokowany, npm działa

**Objaw:** `curl https://…` do dowolnego hosta → kod 000/SSL_ERROR.
**Przyczyna:** sandbox przepuszcza tylko wybrane hosty (`api.github.com`,
`registry.npmjs.org`).
**Reguła:** danych z sieci nie pobieraj curl/fetch w sandboxie — użyj narzędzi
agenta (`fetch_page`, `web_search`). Overpass, kafelki i Nominatim testuj
**w przeglądarce** (live preview) albo na fixture'ach w `test/fixtures/`, nigdy
w `npm test`.

## L4 (2026-09-05, dziedziczone z AME) — agent nie zapisze pliku CI

**Objaw:** push gałęzi zawierającej `.github/workflows/ci.yml` → 403
`workflows`; `gh api` na tym zasobie też 403.
**Przyczyna:** token GitHub App używany w Arenie nie ma uprawnienia
`workflows`.
**Reguła:** recepturę CI trzymaj jako lustro w `docs/setup/ci-workflow.yml`
i pilnuj testem kontraktowym, że nie rozjeżdża się z tym, co właściciel wklei.
Brak zielonego CI opisuj jako **znany fakt**, nie jako zadanie dla właściciela
i nie jako bloker sesji.

**Aneks (2026-09-06):** po odświeżeniu tokena push `.github/workflows/ci.yml`
PRZESZEDŁ i CI odpaliło się na PR — 403 był przywiązany do *instancji* tokena,
nie do trwałych uprawnień aplikacji. Reguła skorygowana: **najpierw spróbuj
pusha, dopiero przy 403** fallback na lustro i wklejenie przez właściciela.
Lustro zostaje: kontrakt porównuje je z live plikiem co do bajta (edytuj jedno
— edytuj oba). Pierwszy live run i tak był czerwony — stary kontrakt
assertował NIEISTNIENIE `.github/workflows` i wykładał się na własnym
sukcesie; przy odwracaniu założeń przeglądaj testy, które je betonują.

## L5 (2026-09-05, dziedziczone z AME) — `npm test | grep` w łańcuchu maskuje czerwony test

**Objaw:** `npm test | grep -c fail && echo OK` drukuje `OK` przy czerwonych
testach.
**Przyczyna:** kod wyjścia potoku to kod `grep`, nie `npm test`.
**Reguła:** w łańcuchu warunkowym uruchamiaj testy BEZ potoku
(`npm test > /tmp/t.log 2>&1 && …`), a log oglądaj osobnym poleceniem; albo
najpierw samo `npm test` (patrzysz na exit code), dopiero potem reszta.

## L6 (2026-09-05, dziedziczone z AME) — API Node w kodzie przeglądarki: pusta warstwa, testy zielone

**Objaw:** moduł w `app/` importuje `node:crypto` / `node:fs`; testy w Node
przechodzą, a w przeglądarce warstwa jest martwa (biały ekran albo cichy
`undefined`).
**Przyczyna:** `node --test` uruchamia kod w Node, gdzie te API istnieją.
**Reguła:** w `app/` wolno używać wyłącznie API przeglądarki i standardu
(`globalThis.crypto.subtle`, `fetch`, `localStorage`, `navigator.geolocation`).
Test kontraktowy `test/kontrakt.test.js` grep`uje `app/**.js` pod kątem
`node:` i `require(`. Szyfrowanie dlatego jedzie na Web Crypto, nie na
`node:crypto` (ADR 0007).

## L7 (2026-09-05, Tajemnicza Okolica) — `git add -A` commituje więcej, niż opisuje komunikat

**Objaw:** commit „M0/E1: konfiguracja repo i zasady pracy agentów" (`3e61917`)
zawiera też cały rejestr ADR (etap E2) — komunikat nie opisuje zakresu zmiany,
a audyt następnej sesji musi to odkręcać z `git show --stat`.
**Przyczyna:** `git add -A` chwyta wszystko, co leży w drzewie, niezależnie od
tego, jaki etap sesji opisuje komunikat pisany chwilę wcześniej.
**Reguła:** przed każdym commitem `git status --short` i porównanie listy
plików z zakresem w komunikacie; albo `git add <ścieżki>` jawnie per etap.
Jeśli rozjazd już się wypchnął — **nie poprawiaj historii** (zakaz force push,
ADR 0012): opisz fakt w handoffie i w opisie PR.

## L8 (2026-09-05, Tajemnicza Okolica) — polityki darmowych dostawców map zmieniają się pod projektem

**Objaw:** CARTO basemaps (Voyager/Positron), przez lata standard „darmowe
kafelki bez klucza", w 2026 wymaga klucza API, bez klucza dokleja znak wodny
„API key required", a rastery są rozważane do wygaszenia. Darmowe serwisy bez
klucza (OpenFreeMap, VersaTiles, Maptoolkit) okazały się **wektorowe**, czyli
wymagają MapLibre — zależności zakazanej przez ADR 0001.
**Przyczyna:** wybór dostawcy zapisany „z pamięci" albo z przyzwyczajenia, bez
kwerendy stanu na dziś; dodatkowo mylenie „darmowe" z „bez klucza" i „rastrowe"
z „wektorowe".
**Reguła:** dostawcę kafelków/danych wybiera się **po kwerendzie w dniu decyzji**
(`web_search` + `fetch_page`), a wynik z datą sprawdzenia trafia do
`docs/ASSETS.md` (§5 checklista). Przy zmianie dostawcy sprawdź trzy rzeczy:
czy wymaga klucza, czy serwuje rastry czy wektory, i co mówi jego polityka
o użyciu w aplikacjach. ADR-y ze statusem *Proponowana* poprawia się przed
akceptacją — po akceptacji tylko nowy ADR zastępujący.

## L9 (2026-09-05, Tajemnicza Okolica) — heurystyka tekstowa na podłańcuchach łapie słowa, których nie szukała

**Objaw:** walidacja paczki (kod `E14`, „pytanie niezakotwiczone w okolicy")
przepuszczała pytanie „W którym roku wybuchła druga wojna światowa?" dla miejsca
„Grabowice, Stare Miasto, woj. mazowieckie". Testy jednostkowe heurystyki
przechodziły, bo miały tylko przykłady dodatnie.
**Przyczyna:** dopasowanie `tekst.includes(rdzenTokena(token))` szuka
podłańcucha w całym tekście. Rdzeń „woj" (z „woj. mazowieckie") trafiał
w „wojna", rdzeń „kości" (z „kościół") w „ludzkości", a wyraz zaczynający
zdanie wielką literą („Druga") uchodził za nazwę własną. Trzy drobne
niedokładności zniosły regułę całkowicie — i żadna nie była widoczna bez
kontrprzykładu.
**Reguła:** heurystyki językowe pisz na **granicy wyrazu**, nie na
podłańcuchu: rdzeń (pierwsze 5 znaków po normalizacji) musi pasować do
**początku wyrazu** (`slowa.some((s) => s.startsWith(rdzen))`), tokeny krótsze
niż 4 znaki odpadają, a wyrazy pospolite wchodzące w skład nazw
administracyjnych („stare", „miasto", „województwo", „polska") mają własną
listę (`WYRAZY_POSPOLITE_MIEJSCA`). Nazwa własna to wyraz wielką literą, który
nie zaczyna zdania i nie stoi za kropką innego zdania — z wyjątkiem skrótów
(`SKROTY_Z_KROPKA`: „św.", „ul.", „ks."). Każdą taką regułę testuj
**kontrprzykładem z prawdziwego tekstu** („ludzkości", „wojna"), a opis
heurystyki zapisuj w protokole razem z nazwami list z kodu — wtedy
`test/kontrakt.test.js` pilnuje, żeby dokument i kod się nie rozeszły.

## L10 (2026-09-05, Tajemnicza Okolica) — widełki nie chronią przed NaN: `Math.max(1, NaN)` daje NaN

**Objaw:** konfiguracja w `localStorage` z `liczbaGraczy: "dużo"` wchodziła do
formularza jako „NaN": pole `setup-gracze` pokazywało `NaN`, lista imion była
pusta (`Array.from({ length: NaN })`), a `walidujSetup` słusznie odmawiał
(K07, K08). Wychwycił to **test bootstrapu na atrapie DOM**, nie testy
jednostkowe `oczyscKonfiguracje`.
**Przyczyna:** `domyslnaKonfiguracja(n)` liczyła
`Math.min(Math.max(1, n), 8)` — każda arytmetyka z NaN daje NaN, więc
„widełki" przepuszczały NaN dalej zamiast go ciąć. `oczyscKonfiguracje`
pomija pole, którego `Number()` nie jest skończone, więc NaN z wartości
domyślnej zostawał w stanie. Testy hartowania miały kontrprzykłady liczbowe
(`-3`, `99`, `NaN` wprost), ale nie **tekstowej** liczby graczy — a właśnie
tekst przychodzi z `localStorage` po ręcznej edycji albo ze starego schematu.
**Reguła:** clamp dopiero po `Number.isFinite`, a wartość nienumeryczna
(`null`, `undefined`, `''`, tekst, obiekt) to **brak danych** → default z
kanonu, nie 0, nie 1, nie NaN. W testach hartowania każda klasa śmieci ma
własny kontrprzykład, a asercja dotyczy nie tylko „nie rzucił wyjątkiem", ale
**tego, co zostało wyrenderowane** — NaN w UI widać dopiero na warstwie DOM
(commit `78a1bd0`).

## L11 (2026-09-05, Tajemnicza Okolica) — faza bez akcji wyjścia: testuj przejścia na danych niekompletnych

**Objaw:** przy paczce pokrywającej 3 z 5 stacji gra po dojściu do stacji 4
zostawała w fazie `pytanie` z pustym ekranem: nie było pytania do odsłonienia,
a jedyną akcją „dalej" było `pominStacje()`, które zamieniało odcinek
`zakonczony` na `pominiety` — kasowało pomiar czasu i wyrzucało tempo z próbek
mediany (ADR 0014 pkt 2).
**Przyczyna:** reguły faz były testowane na danych kompletnych (paczka = jedno
pytanie na stację). Przejście „dojście → zamknięcie stacji" istniało wyłącznie
w `zapiszOdpowiedz`, więc stacja bez pytania nie miała żadnej akcji domykającej,
a test tego nie pytał, bo taki przypadek nie występował w fixture'ach.
**Reguła:** model stanów testuj **przejściami na danych brzegowych**:
niekompletne pokrycie, pusta lista, ostatni element, ponowienie tej samej
akcji. Dla każdej fazy zapisz w teście, która akcja z niej wyprowadza — brak
takiej akcji to usterka modelu, nie UI. I druga część: akcja „pomiń" nie może
kasować pomiaru, który się wydarzył (odmowa `G13`), bo wtedy wynik przestaje
być odtwarzalny z dziennika (ADR 0010 pkt 6, ADR 0015 pkt 2–3; commity
`8eec03c`, `09faf5c`).

## L12 (2026-09-05, Tajemnicza Okolica) — łańcuch szukany przepisany z pamięci różni się jedną literą

**Objaw:** skrypt `python3` z listą par (fragment stary → nowy) przerwał się na
`AssertionError` przy trzeciej parze, a wydrukowane wcześniej „ok" nie
oznaczało zapisu (plik jest zapisywany na końcu). Gdzie indziej para „pasowała"
wzrokowo, ale `t.count(stary) == 0`: w szukanym fragmencie było
`stan.stacji.length` zamiast `stan.stacje.length`.
**Przyczyna:** fragment do zamiany był przepisany z pamięci albo z innego
miejsca, nie skopiowany z pliku. Przy polskiej odmianie (`stacje`/`stacji`,
`pytanie`/`pytania`, `uruchomisz`/`uruchamsz`) jedna litera różnicy jest
niewidoczna przy czytaniu, a dla `str.replace`/`count` jest decydująca.
**Reguła:** fragment kopiuj z pliku (`sed -n 'X,Yp'`, `grep -n`) i wklejaj, nie
przepisuj; przed zamianą asertuj `t.count(stary) == 1`; „ok" drukuj **po**
zapisie albo zapisuj po każdej parze, żeby komunikat znaczył „zapisane". Gdy
porównanie zawodzi, diagnozuj znak po znaku
(`for k, (a, b) in enumerate(zip(szukany, segment)): if a != b: print(k, ord(a), ord(b))`),
zamiast podejrzewać kodowanie pliku — „niewidoczny znak" to zwykle literówka.

## L13 (2026-09-05, Tajemnicza Okolica) — schowany panel ma rozmiar zerowy, a mapa wraca pusta

**Objaw:** mapa rysowała się poprawnie na starcie, ale po przejściu na inny
ekran i powrocie warstwa kafelków była pusta: zero `<image>`, choć widok i zoom
się zgadzały.
**Przyczyna:** `getBoundingClientRect()` dla elementu w sekcji z `hidden`
(`display: none`) zwraca zera. Plan rysowania liczony dla rozmiaru 0 × 0 daje
pustą listę kafelków, a optymalizacja „nie przebudowuj, jeśli sygnatura siatki
się nie zmieniła" porównywała pustą sygnaturę z pustą — więc po pokazaniu ekranu
moduł uznawał listę za aktualną i nic nie wstawiał.
**Reguła:** komponent mierzony z DOM musi mieć **jawną ścieżkę dla rozmiaru 0**:
zwrócić `pusty: true`, nie rysować nic i **skasować pamięć poprzedniego stanu**
(sygnaturę, cache, ostatnią listę), a warstwa aplikacji ma odświeżyć komponent
w chwili pokazania ekranu (`pokazEkran` → `odswiez()`) i przy `resize` (obrót
telefonu). Test: ustaw rozmiar na 0, przerysuj, przywróć rozmiar, przerysuj —
i asertuj, że warstwy wróciły (`ustawProstokat` w `test/helpers/dom.js`;
commit `e65f26b`).

## L14 (2026-09-05, Tajemnicza Okolica) — nasłuch zarejestrowany dwa razy działa dwa razy, a zdejmuje się raz

**Objaw:** kliknięcie „＋" zmieniało zoom o dwa stopnie zamiast o jeden, a po
`zniszcz()` jeden z nasłuchów zostawał i gest nadal zmieniał widok.
**Przyczyna:** przyciski były podpinane w pętli własnej
(`przycisk.addEventListener(...)`) **i** w pętli ogólnej, która rejestrowała
wszystko z listy `nasluchy` — ten sam handler trafiał na element dwa razy.
Zdejmowanie szło po liście, ale `removeEventListener` usuwa jedno wystąpienie,
więc drugie przeżywało.
**Reguła:** rejestrację nasłuchów ma **jedno** miejsce: albo zbierasz pary
`(element, typ, handler)` do listy i rejestrujesz je w jednej pętli, albo
podpinasz od razu — nigdy obu. Symetrycznie: `zniszcz()`/`zamknij()` przechodzi
dokładnie tę samą listę. Test na atrapie, która naprawdę usuwa nasłuch
(`removeEventListener` w `helpers/dom.js`), łapie to bez przeglądarki: asertuj
liczbę nasłuchów po utworzeniu **i** po zniszczeniu, a potem wyślij zdarzenie
i sprawdź, że stan się nie zmienił (commit `e65f26b`).

## L15 (2026-09-05, Tajemnicza Okolica) — przy dwóch modelach jednostek test musi przeliczać z powrotem

**Objaw:** koło dokładności dla fixu ±12 m miało promień 152 897 jednostek —
czyli więcej niż cały świat (3600 jednostek). Nic nie rzucało wyjątku, liczby
były skończone, a testy przechodziły, dopóki sprawdzały tylko „r > 0".
**Przyczyna:** trzy modele jednostek naraz (metry ↔ piksele ↔ jednostki świata)
i jedno odwrócone dzielenie: `metryNaJednostkeSwiata` dzieliła przez skalę
zamiast mnożyć, bo „jednostka świata = skala pikseli", więc metrów na jednostkę
jest **więcej**, nie mniej.
**Reguła:** gdy moduł żongluje jednostkami, test ma robić **rundę w obie
strony** i porównywać z niezależnym źródłem: `r_swiat × skala === r_piksele`
oraz `r_piksele === metry / metryNaPiksel(lat, zoom)` (z `geo.js`), a do tego
asercja porządku wielkości względem stałej świata (`r < SZEROKOSC_SWIATA`).
„Jest dodatnie i skończone" to za słaby kontrakt — przepuści każdą zamianę
mnożenia na dzielenie. Pomocniczo: nazywaj funkcje tak, żeby jednostka była
w nazwie (`promienWSwiecie`, `promienWpikselach`), a przelicznik zapisuj
jednym zdaniem w komentarzu (commit `59b5573`).

## L16 (2026-09-05, Tajemnicza Okolica) — test nie przejdzie drzwiami, które czytają nieparsowany DOM

**Objaw:** test prywatności klikał „dalej → pozycja" i nic się nie działo —
przejście z setupu czyta imiona przez `document.querySelectorAll('#lista-imion
input')`, a atrapa DOM zwraca z `querySelectorAll` pustą listę, więc walidacja
K08 (dokładnie N imion) słusznie odrzucała przejście.
**Przyczyna:** atrapa (`test/helpers/dom.js`) celowo nie parsuje HTML — elementy
są obiektami po id. Każda ścieżka, która czyta **kolekcję z wnętrza** elementu,
w teście widzi pustkę, choć w przeglądarce działa.
**Reguła:** dwie drzwi do wyboru: (1) test wchodzi na ekran inną drogą, która
nie czyta nieparsowanego DOM (przycisk trybu testowego, przejście bezpośrednie),
albo (2) produkcyjny strażnik przejścia czyta **zweryfikowany stan**
(`STAN.konfig`) zamiast DOM, gdy to możliwe — jak przy poprawce K12 (commit
`e65f26b`). Nie rozszerzaj atrapy o parser HTML tylko dla jednego testu — to
druga przeglądarka w testach, której i tak nie utrzymasz.

## L17 (2026-09-05, Tajemnicza Okolica) — kontrakt na zakazany wywołanie grepuje kod, nie prozę

**Objaw:** kontrakt „warstwa aplikacji nie wywołuje `confirm()`/`alert()`"
oblął, chociaż wywołań nie było — regex trafił w docblock, który **tłumaczył,
dlaczego** aplikacja tych funkcji nie używa („przypadkowe OK w `confirm()`
klika się bez czytania").
**Przyczyna:** test grepował surowy plik, a zakaz dotyczy wywołań, nie słów.
**Reguła:** kontrakt na zakazane API wycina przed dopasowaniem komentarze
(`/* ... */` i `// ...`) — sprawdza kod, nie prozę. Alternatywa „nie pisz nazw
zakazanych funkcji w komentarzach" jest gorsza: komentarz wyjaśniający „czemu
nie" ma wartość i będzie powracał (commit `8abb11c`).
## L18 (2026-09-05, Tajemnicza Okolica) — Node ≥ 18 ma globalny `fetch`: aplikacja w testach dzwoniła w świat

**Objaw:** brama urosła z 5 s do 82 s, trzy testy mapy czerwone — asynchroniczna
ścieżka pobierania sieci nie zdążyła przed synchroniczną asercją, a w logach
były próby wyjścia na `overpass-api.de`.

**Przyczyna:** kod aplikacji sprawdzał `typeof fetch === 'function'`. W Node 22
to PRAWDA (globalny fetch od Node 18), więc test „bez internetu" naprawdę
próbował pobrać Overpass; atrapa DOM (`test/helpers/dom.js`) celowo nie
wystawia `window.fetch`, ale gołe `fetch` resolvingowało się na globalne.

**Reguła:** kod przeglądarkowy czyta API sieciowe wyłącznie przez `window.*`
(`window.fetch`), nigdy gołą nazwę globalną. Testy integracyjne podstawiają
atrapę PO imporcie modułu (`domAtrapa.window.fetch = …`), a kod czyta ją w
chwili wywołania, nie przy starcie (commit M4/I7).

## L19 (2026-09-05, Tajemnicza Okolica) — atrapa DOM: `innerHTML = ''` nie kasuje dzieci

**Objaw:** test trybu ręcznego czytał `lista-stacji.children[0]` po re-renderze
i widział STARĄ stację, choć callback przeciągnięcia na pewno się wykonał
(pin jechał z palcem — `transform` to potwierdzał).

**Przyczyna:** `renderujStacje` czyściło listę przez `lista.innerHTML = ''`.
W przeglądarce to kasuje dzieci; w atrapie (`test/helpers/dom.js`) `innerHTML`
jest zwykłym polem — `appendChild` dokładał nowe `li` ZA starymi, a test czytał
`children[0]` = element z poprzedniego renderu.

**Reguła:** listy przebudowujemy przez `replaceChildren(...elementy)` — jedna
operacja, bez migotania w przeglądarce, wiernie odwzorowana w atrapie.
Miejsca z `innerHTML = ''` migrujemy przy okazji dotykania (pozostałe:
renderujSetup, gracze, prompt, podsumowanie — patrz BACKLOG B16). Gdy test
czyta `children` po re-renderze, a wynik wygląda na „stary", najpierw sprawdź,
czy lista na pewno została wyczyszczona sposobem, który atrapa rozumie.

## L20 (2026-09-06, Tajemnicza Okolica) — nowy helper bez grep-a: `pobierzPlik` zadeklarowany drugi raz

**Objaw:** `node --check app/app.js` — `Identifier 'pobierzPlik' has already
been declared`. Splice M5/J4 dodał funkcję pobierania pliku (Blob + `<a
download>`), chociaż identyczna istniała od M0 (pobieranie promptu).

**Przyczyna:** helper dodany „z pamięci", bez sprawdzenia, czy plik już go
ma. Pierwsza deklaracja była 140 linii wyżej, poza oknem edycji.

**Reguła:** przed dodaniem JAKIEJKOLWIEK nowej funkcji pomocniczej:
`grep -n "function <nazwa>"` po całym module. Jest — użyj istniejącej (i jej
sygnatury: M0-owe `pobierzPlik(nazwa, tresc, typ)` wymagało trzeciego
argumentu). Dotyczy też importów i stałych. Ten sam odruch co przy kotwicach
spliców (L12), tylko na etapie projektowania, nie wklejania.

## L21 (2026-09-06, Tajemnicza Okolica) — test z padającym fetchem bez `odstep=0` czekał 90 sekund na instancje Overpass

**Objaw:** trzy testy warstwy zapasowej (Nominatim) czerwone: „0 żądań"
zamiast jednego, nazwa miejsca pusta; cała brama szła 66 s zamiast 8 s.

**Przyczyna:** atrapa `window.fetch` odpowiadała 503 na Overpass, więc
`pobierzSiec` wchodził w łańcuch przełączania instancji z pauzą
`STAN.odstepOverpassMs` (30 s × 3). Warstwa zapasowa jest wołana DOPIERO po
jego zakończeniu — asercje po `czekaj(150)` widziały stan sprzed pobrania.

**Reguła:** testy integracyjne, w których pobranie sieci MA odnieść porażkę,
instalują dom z `search: '?tryb=test&odstep=0'` (parametr z M4 zeruje pauzy
między instancjami). Bez tego test nie jest „szybki i czerwony", tylko
„wolny i czerwony" — a 90-sekundowe pauzy wyglądają jak zwis, nie jak dane.
Dodatkowo: `assert.equal(params.get('lon'), '21.01235')` padł, bo
`(21.012345).toFixed(5) === '21.01234'` (reprezentacja binarna) — oczekiwania
na zaokrągleniach LICZYMY (`node -e`), nie zgadujemy (wariant L6).

## L22 (2026-09-06, Tajemnicza Okolica) — symulacja dojścia przeżyła tranzycję fazy i nadpisała status gry

**Objaw:** test integracyjny pełnej gry (M6/R7) czerwony na komunikacie dojścia:
zamiast „Stacja osiągnięta — próg dojścia zadziałał z GPS" w statusie stało
„Symulacja: fix 9/9, do celu 3 m (próg 25 m, trafienia 1/2)" — a panel pytania
się nie otwierał. Czysta mechanika (`trasaProsta` → `sekwencjaSymulowana` →
`czyDotarl`) odpalona osobno dochodziła do celu bez problemu.

**Przyczyna:** `krokSymulacji` po `przyjmijFix(fix)` leciał dalej bez względu
na to, co fix zrobił z grą. Fix domykający dojście wyzwalał tranzycję
(`zakonczOdcinekGry` → faza `pytanie`, status „Stacja osiągnięta",
`historiaFixow` wyczyszczona), po czym symulacja liczyła `stanDojscia`
z PUSTEJ historii (stąd „do celu null m, próg 0 m") i nadpisywała status gry;
interval dostarczał jeszcze ostatni fix już w fazie pytania. Jednostkowo
wszystko zielone — model, geo i pozycja są czyste; rozsypało się wyłącznie
spięcie czasowe w warstwie DOM.

**Reguła:** każdy generator zdarzeń na `setInterval` (symulacja, odświeżanie,
polling) musi na każdym kroku — PRZED i PO dostarczeniu zdarzenia — sprawdzać,
czy powód jego istnienia nadal istnieje (faza, pauza, ręczny koniec), i gasnąć
BEZ nadpisywania komunikatów stanu, który obsługuje. A kamień milowy bez testu
integracyjnego „pełna pętla od startu do wyniku" to kamień z nieprzetestowanym
spięciem czasowym: wyścig tranzycja-vs-timer widać tylko gdy całość leci
naprawdę, jeden fix po drugim.

## L23 (2026-09-06, Tajemnicza Okolica) — oczekiwania asercji pisane z pamięci: tautologia i sparafrazowany komunikat

**Objaw:** dwa czerwone/nic-nie-łapiące przypadki w testach M6 pisanych tego
samego dnia co kod: (1) asercja „manualnego końca gry" w postaci
`assert.equal(x.hidden, false === false ? x.hidden : null)` — tautologia,
która nie mogła spaść nigdy i udawała sprawdzenie pierwszego kliku;
(2) `assert.match(status, /można wznowić/)` czerwony, bo aplikacja mówi
„można **ją** wznowić".

**Przyczyna:** teksty oczekiwane powstawały z pamięci o kodzie zamiast z kodu,
a „asekuracja" w (1) sklejała porównanie wartości z nią samą. Pamięć własnego
kodu dryfuje już w trakcie tej samej sesji (wariant L12: kotwice z grep-a,
nie z głowy).

**Reguła:** przed zapisaniem asercji na komunikat — `grep` DOKŁADNEGO stringa
w źródle i kopiowanie go do wzorca (albo testowanie fragmentu, który naprawdę
tam jest). Asercja, której obie strony wyrażają tę samą wartość, jest zakazana:
albo porównuję stan PRZED z oczekiwanym literalem (`true`/`false`), albo nie
piszę asercji wcale. Tautologia jest gorsza niż brak testu — dodaje pewność,
której nie ma.

## L24 (2026-09-06, Tajemnicza Okolica) — regex liczbowy po złączonym textContent przeczytał „142 pkt" z „Gracz 1" + „42 pkt"

**Objaw:** test integracyjny P7 czerwony przy pierwszym przebiegu:
`punkty zwycięzcy w widełkach policzonych: 142` — przy maksimum z modelu 60
(2 odpowiedzi × 20 pkt bazowych ± premia czasowa 0,5 × 0,5 × 20).

**Przyczyna:** asercja czytała
`Number(karta.textContent.match(/(\d+) pkt/)[1])` po textContent CAŁEJ karty
zwycięzcy. Zrąb DOM wiernie skleja tekst potomków BEZ separatorów (zachowanie
przeglądarki): imię `Gracz 1` zrosło się z `42 pkt` elementu-potomka w
`Gracz 142 pkt`, a regex chętnie złapał `142`. Liczba była prawdziwa — tyle
że z granicy elementów.

**Reguła:** asercje liczbowe na tekście czytam z KONKRETNEGO elementu, który
trzyma liczbę (`children[i].textContent`), nigdy regexem po złączonym
textContent przodka; regex tylko zakotwiczony separatorem, który istnieje
wewnątrz JEDNEGO elementu. Wariant L23 (oczekiwania z kodu, nie z pamięci)
i przypomnienie, że wierny zrąb tnie w obie strony: odsłania prawdziwe
zachowanie przeglądarki — także to, które nie wybacza niechlujnego odczytu.
