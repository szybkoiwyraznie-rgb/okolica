# PROTOKÓŁ PYT v1.0 — protokół pytań terenowych

> **To jest zasada treściowa, nie sugestia** (AGENTS.md §3). Obowiązuje każdy
> prompt, każdą wklejoną odpowiedź modelu i każdą paczkę pytań zapisaną przez
> aplikację. Zmiana protokołu = nowy ADR + podbicie wersji + migrator paczek
> (ADR 0010 pkt 6).

- Status: **obowiązujący** (wersja wyprowadzana z tego nagłówka; test
  kontraktowy porównuje go ze stopką aplikacji i z `README.md`)
- Data: 2026-09-05
- Powiązania: ADR 0006 (pętla treści), ADR 0007 (ukrywanie paczki),
  ADR 0008 (kwerenda i źródła), `app/protokol.js` (kod), `test/protokol.test.js`

## 1. Pętla treści w pięciu krokach

```
konfiguracja + pozycja gracza + stacje
        ↓ (1) aplikacja buduje prompt z szablonu §2
   tekst promptu → schowek / pole tekstowe
        ↓ (2) organizator wkleja go do modelu AI (Meta AI, ChatGPT, …)
   odpowiedź modelu = blok JSON ze schematem §3
        ↓ (3) organizator wkleja odpowiedź do aplikacji
   walidacja §6 → lista usterek albo przyjęcie
        ↓ (4) ukrycie paczki: obfuskacja bez klucza, kontener TO-paczka/2
            (ADR 0007) → localStorage / eksport pliku
   paczka PYT
        ↓ (5) rozgrywka: pytanie odsłaniane przy dojściu do stacji
```

Krok (2) jest poza systemem: model jest **zewnętrznym silnikiem treści**
(ADR 0006 pkt 7). Aplikacja nigdy nie woła API modelu i nie przechowuje kluczy.

## 2. Szablon promptu (dosłowny)

Szablony są **jednym źródłem prawdy**: blok w §2 i stała
`SZABLON_PROMPTU` w `app/protokol.js` muszą być identyczne znak w znak —
i tak samo blok w §2.2 i `SZABLON_PROMPTU_BEZ_WERYFIKACJI`
(pilnuje `test/kontrakt.test.js` i `npm run check`). Placeholdery `{NAZWA}`
podstawia `zbudujPrompt()`; nic innego nie wolno w szablonach zmieniać ręcznie.

<!-- szablon-promptu:start -->
```tekst
Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.

ZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):
1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu. Nie opieraj się na pamięci modelu.
2. Każde pytanie ma pole "zrodla" z co najmniej jednym prawdziwym, działającym adresem URL, z którego pochodzi fakt, oraz tytułem źródła i datą sprawdzenia. Faktu, którego nie potrafisz potwierdzić źródłem, NIE UŻYWASZ.
3. Nie wymyślaj nazw, dat, liczb, cytatów, autorów ani adresów. Nie zgaduj i nie uogólniaj. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu "uwagi".
4. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny potwierdzony fakt, i podawaj wtedy nazwę miejsca w treści pytania. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.
5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.
6. Odpowiedź zwróć WYŁĄCZNIE jako jeden blok kodu json ze schematem podanym niżej. Bez komentarzy, bez wstępu, bez podsumowania, bez drugiego bloku.
7. Treść pytania nie może zdradzać odpowiedzi (na przykład roku w pytaniu o rok).
8. W polu "protokol" wpisz "PYT/1.0-rev4". Wszystkie pola tekstowe zapisz NORMALNIE, w naturalnej kolejności liter — niczego nie odwracaj ani nie szyfruj. Ukryty jest wyłącznie numer poprawnej odpowiedzi (pole "poprawna", zasada niżej).

OKOLICA GRY:
- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}
- miejsce: {MIEJSCE}
- promień gry: {PROMIEN_M} m
- sposób poruszania się: {TRYB}

STACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji):
{LISTA_STACJI}

GRACZE I TRUDNOŚĆ:
- liczba graczy: {LICZBA_GRACZY}
- kategoria wiekowa: {WIEK}
- wymagania trudności: {OPIS_TRUDNOSCI}
- tematy pytań (wyłącznie z tej listy): {TEMATY}
- liczba pytań łącznie: {LICZBA_PYTAN}
- język pytań: {JEZYK}
- data przygotowania: {DATA}

SCHEMAT ODPOWIEDZI (PYT/1.0-rev4) — dokładnie te pola:
{
  "protokol": "PYT/1.0-rev4",
  "okolica": { "lat": {LAT}, "lon": {LON}, "promienM": {PROMIEN_M}, "miejsce": "{MIEJSCE}" },
  "wiek": "{WIEK}",
  "tematy": [{TEMATY_JSON}],
  "jezyk": "{JEZYK}",
  "utworzono": "{DATA}",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "temat": "historia",
      "tresc": "Treść pytania zakończona znakiem zapytania?",
      "odpowiedzi": ["pierwsza", "druga", "trzecia", "czwarta"],
      "poprawna": 20,
      "wyjasnienie": "Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.",
      "zrodla": [{ "url": "https://przyklad.org/haslo", "tytul": "Tytuł źródła", "sprawdzono": "{DATA_KROTKA}" }]
    }
  ],
  "uwagi": ""
}

WYMAGANIA DODATKOWE:
- "id": "s<numer stacji>p<kolejny numer>", na przykład "s2p1"; identyfikatory unikalne w całej paczce.
- "stacja": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, a rozkład pytań między stacje jest równy albo różni się o jedno.
- "odpowiedzi": dokładnie 4, każda od 1 do 8 słów, bez powtórzeń, bez odpowiedzi w rodzaju „wszystkie powyższe" albo „żadna z powyższych"; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.
- "poprawna": ZAKODOWANY numer poprawnej odpowiedzi: indeks (0–3) + numer stacji + numer pytania z pola "id" + 17 (s2p1 z poprawną trzecią: 2 + 2 + 1 + 17 = 22).
- "temat": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.
- "wyjasnienie": napisane tak, żeby gracz po odpowiedzi dowiedział się czegoś o okolicy; bez powtarzania treści pytania.
- "uwagi": czego nie udało się potwierdzić źródłem, które tematy zostały pominięte i dlaczego; pusty tekst, jeśli wszystko potwierdzone.
```
<!-- szablon-promptu:koniec -->

### 2.1 Placeholdery

| Placeholder | Wartość | Źródło |
| --- | --- | --- |
| `{LAT}`, `{LON}` | środek gry, 5 miejsc po przecinku (~1 m) | geolokalizacja albo tryb testowy (ADR 0004) |
| `{MIEJSCE}` | nazwa miejsca: dzielnica, miasto, region, państwo | obszary administracyjne z tego samego zapytania Overpass (`is_in`); gdy odczyt niedostępny — `brak odczytu (tylko współrzędne)` (ADR 0013 pkt 3, `docs/ASSETS.md` §3) |
| `{PROMIEN_M}` | promień gry w metrach | setup: liczony z planowanego czasu gry, trybu i liczby pytań (ADR 0025) |
| `{TRYB}` | `piesza` / `rower` / `samochodowa` — etykieta polska | setup |
| `{LISTA_STACJI}` | po jednej linii: `- stacja N: LAT, LON — <opis miejsca albo „punkt przy ulicy X"> (ODLEGLOSC m od środka)` | wybór stacji (ADR 0005) |
| `{LICZBA_GRACZY}` | 1–8 | setup |
| `{WIEK}` | klucz kategorii: `7`, `10`, `12`, `15`, `dorosli` | setup |
| `{OPIS_TRUDNOSCI}` | tekst z §4 dla danej kategorii | protokół §4 |
| `{TEMATY}` | lista tematów z opisami, np. `historia (dzieje miejsca, daty, wydarzenia, postaci)` | protokół §5 |
| `{TEMATY_JSON}` | te same klucze jako elementy listy JSON, np. `"historia", "przyroda"` | protokół §5 |
| `{LICZBA_PYTAN}` | liczba pytań = `LICZBA_STACJI × pytaniaNaStacje` | setup |
| `{JEZYK}` | `polski` (domyślnie) albo inny z setupu | setup |
| `{DATA}` | `RRRR-MM-DD GG:MM` czasu lokalnego urządzenia | aplikacja |
| `{DATA_KROTKA}` | `RRRR-MM-DD` | aplikacja |
| `{LICZBA_STACJI}` | liczba stacji | setup |

Daty w promptcie pochodzą z zegara urządzenia i **nie są zapisywane w danych
repozytorium** (determinizm fixture'ów: testy podstawiają stałą datę).

**Budżet rozmiaru (B21, pomiar 2026-09-07).** Prompt **nie rośnie** z liczbą
pytań — 5 422 znaki (~1 356 tokenów) dla 5 pytań i 5 423 znaki dla 40, bo
z szablonu zmienia się tylko cyfra w `{LICZBA_PYTAN}`. Rośnie **odpowiedź**:
realistyczna paczka rev2 (treść ~140 znaków, 4 odpowiedzi, wyjaśnienie ~200
znaków, jedno źródło) to 4 469 znaków / ~1 118 tokenów dla 5 pytań i
33 392 znaków / ~8 348 tokenów dla 40 pytań (5 stacji × 8 graczy) — czyli
~830 znaków i ~210 tokenów na pytanie. Kontener `TO-paczka/2` dla 40 pytań ma
~36 kB (1,8% budżetu stanu, 2,4% rejestru), więc pamięć nie jest ograniczeniem;
ograniczeniem jest limit wyjścia modelu. Szacunek był pokazywany w UI
i usunięty jako ozdobnik (właściciel, testy terenowe 2026-09-11) — pomiar
zostaje tutaj jako prawidło protokołu, a spinają go testy
`test/duza-paczka.test.js`. Górne ograniczenie jest wspólne dla obu wariantów
promptu (paczka bez weryfikacji zwykle wychodzi mniejsza, bo nie niesie źródeł).

### 2.2 Wariant „Pytania (bez fact check)" (domyślny, ADR 0032)

Ten sam kształt odpowiedzi co §2, inny kontrakt z modelem: **nie narzucamy
sposobu zdobycia faktu** — model sam decyduje, czy sięgnie do sieci, czy do
własnej wiedzy — a źródła są opcjonalne. Znacznik odpowiedzi: `PYT/1.0-rev5`.

Decyzja właściciela 2026-09-09: wcześniejsza wersja wprost ZAKAZYWAŁA kwerendy
i nakazywała pamięć treningową. To było wymuszanie bez powodu — jeśli model nie
ma pewnego faktu w pamięci, lepiej żeby go sprawdził, niż zgadywał. Zakaz
zostaje wyłącznie w §2 w drugą stronę (tam kwerenda jest OBOWIĄZKOWA).

<!-- szablon-promptu-bez:start -->
```tekst
Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.

ZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):
1. Podawaj wyłącznie fakty, których jesteś pewien. Sposób ich ustalenia zostawiamy Tobie. Gdy czegoś nie jesteś pewien, uprość pytanie albo pomiń temat i opisz to w polu "uwagi".
2. Pole "zrodla" jest OPCJONALNE: jeśli masz adres potwierdzający fakt, podaj go; jeśli nie — pomiń pole albo zostaw pustą listę. Nigdy nie zmyślaj adresu: niepewny URL jest gorszy niż jego brak.
3. Nie wymyślaj nazw, dat, liczb, cytatów ani autorów. Nie zgaduj. Gdy nie masz pewności co do faktu, wybierz łatwiejszy fakt z tego samego tematu; jeśli w jakimś temacie brakuje pewnych faktów, zrób mniej pytań w tym temacie i opisz brak w polu "uwagi".
4. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny pewny fakt, i podawaj wtedy nazwę miejsca w treści pytania. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.
5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.
6. Odpowiedź zwróć WYŁĄCZNIE jako jeden blok kodu json ze schematem podanym niżej. Bez komentarzy, bez wstępu, bez podsumowania, bez drugiego bloku.
7. Treść pytania nie może zdradzać odpowiedzi (na przykład roku w pytaniu o rok).
8. W polu "protokol" wpisz "PYT/1.0-rev5". Wszystkie pola tekstowe zapisz NORMALNIE, w naturalnej kolejności liter — niczego nie odwracaj ani nie szyfruj. Ukryty jest wyłącznie numer poprawnej odpowiedzi (pole "poprawna", zasada niżej).

OKOLICA GRY:
- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}
- miejsce: {MIEJSCE}
- promień gry: {PROMIEN_M} m
- sposób poruszania się: {TRYB}

STACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji):
{LISTA_STACJI}

GRACZE I TRUDNOŚĆ:
- liczba graczy: {LICZBA_GRACZY}
- kategoria wiekowa: {WIEK}
- wymagania trudności: {OPIS_TRUDNOSCI}
- tematy pytań (wyłącznie z tej listy): {TEMATY}
- liczba pytań łącznie: {LICZBA_PYTAN}
- język pytań: {JEZYK}
- data przygotowania: {DATA}

SCHEMAT ODPOWIEDZI (PYT/1.0-rev5) — dokładnie te pola:
{
  "protokol": "PYT/1.0-rev5",
  "okolica": { "lat": {LAT}, "lon": {LON}, "promienM": {PROMIEN_M}, "miejsce": "{MIEJSCE}" },
  "wiek": "{WIEK}",
  "tematy": [{TEMATY_JSON}],
  "jezyk": "{JEZYK}",
  "utworzono": "{DATA}",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "temat": "historia",
      "tresc": "Treść pytania zakończona znakiem zapytania?",
      "odpowiedzi": ["pierwsza", "druga", "trzecia", "czwarta"],
      "poprawna": 20,
      "wyjasnienie": "Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.",
      "zrodla": [{ "url": "https://przyklad.org/haslo", "tytul": "Tytuł źródła", "sprawdzono": "{DATA_KROTKA}" }]
    }
  ],
  "uwagi": ""
}

WYMAGANIA DODATKOWE:
- "id": "s<numer stacji>p<kolejny numer>", na przykład "s2p1"; identyfikatory unikalne w całej paczce.
- "stacja": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, a rozkład pytań między stacje jest równy albo różni się o jedno.
- "odpowiedzi": dokładnie 4, każda od 1 do 8 słów, bez powtórzeń, bez odpowiedzi w rodzaju „wszystkie powyższe" albo „żadna z powyższych"; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.
- "poprawna": ZAKODOWANY numer poprawnej odpowiedzi: indeks (0–3) + numer stacji + numer pytania z pola "id" + 17 (s2p1 z poprawną trzecią: 2 + 2 + 1 + 17 = 22).
- "temat": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.
- "wyjasnienie": napisane tak, żeby gracz po odpowiedzi dowiedział się czegoś o okolicy; bez powtarzania treści pytania.
- "zrodla": pusta lista ALBO lista źródeł w kształcie jak w schemacie; podawaj tylko adresy, co do których masz pewność (pełny adres https://, prawdziwy i działający), każdy z tytułem i datą sprawdzenia RRRR-MM-DD; adres przykładowy albo zmyślony unieważnia pytanie.
- "uwagi": czego nie udało się ustalić z własnej wiedzy, które tematy zostały pominięte i dlaczego; pusty tekst, jeśli wszystko pewne.
```
<!-- szablon-promptu-bez:koniec -->

## 3. Schemat paczki PYT/1.0

### 3.1 Poziom paczki

| Pole | Typ | Wymagane | Zasady |
| --- | --- | --- | --- |
| `protokol` | tekst | tak | `"PYT/1.0"`, `"-rev1"`, `"-rev2"`, `"-rev3"` (odwrócone, §3.4) albo bieżące `"-rev4"` / `"-rev5"` (bez odwracania) |
| `okolica.lat` | liczba | tak | `-90 ≤ lat ≤ 90` |
| `okolica.lon` | liczba | tak | `-180 ≤ lon ≤ 180` |
| `okolica.promienM` | liczba | tak | `100–50000`, zgodna z konfiguracją gry |
| `okolica.miejsce` | tekst | tak | niepuste; nazwa miejsca z geokodacji albo jawny brak |
| `wiek` | tekst | tak | klucz z §4 |
| `tematy` | lista tekstów | tak | niepusta, podzbiór kanonu §5, bez powtórzeń |
| `jezyk` | tekst | tak | `polski` albo inny z setupu |
| `utworzono` | tekst | tak | `RRRR-MM-DD GG:MM`, nie w przyszłości |
| `pytania` | lista | tak | niepusta; liczba = oczekiwana z setupu |
| `uwagi` | tekst | tak (może być pusty) | czego model nie potwierdził |
| `model` | tekst | nie | dobrowolna etykieta organizatora (ADR 0006 pkt 7) |
| `modyfikacje` | lista | nie | ręczne poprawki organizatora: `{data, opis}` |
| `ziarno` | tekst | nie | ziarno rozgrywki (ADR 0005 pkt 6) — dopisuje aplikacja |

### 3.2 Poziom pytania

| Pole | Typ | Zasady |
| --- | --- | --- |
| `id` | tekst | `^s[0-9]+p[0-9]+$`, unikalne w paczce |
| `stacja` | liczba całkowita | `1..LICZBA_STACJI`; każda stacja ≥ 1 pytanie; rozkład równy ±1 |
| `temat` | tekst | klucz z kanonu §5 |
| `tresc` | tekst | ≥ 20 i ≤ 400 znaków; kończy się `?` |
| `odpowiedzi` | lista 4 tekstów | każdy 1–80 znaków, bez powtórzeń (po normalizacji), bez „wszystkie/żadna z powyższych" |
| `poprawna` | liczba całkowita | jawna i rev1: `0..3`; rev2/rev3/rev4/rev5: indeks + stacja + numer pytania + 17 (kod pozycyjny) |
| `wyjasnienie` | tekst | ≥ 60 znaków; nie powtarza treści pytania w całości |
| `zrodla` | lista | ≥ 1 wpis |
| `zrodla[].url` | tekst | `^https?://` + host z kropką; zakaz domen przykładowych (`example.com`, `przyklad.org`, `localhost`) i zarezerwowanych TLD (`.invalid`, `.test`, `.example`, `.local`) |
| `zrodla[].tytul` | tekst | niepusty |
| `zrodla[].sprawdzono` | tekst | `RRRR-MM-DD`, nie w przyszłości |

### 3.3 Kontener ukrytej paczki (ADR 0007 pkt 2)

```json
{
  "schemat": "TO-paczka/2",
  "protokol": "PYT/1.0",
  "kodowanie": "b64x1",
  "skrot": "FNV-1a 32 z bajtów plaintextu (8 znaków hex)",
  "dane": "base64url (UTF-8 JSON ⊕ strumień maski)"
}
```

| Pole | Zasady |
| --- | --- |
| `schemat` | dokładnie `"TO-paczka/2"`; inna wartość = odmowa odczytu z komunikatem |
| `protokol` | wersja protokołu paczki, którą ukryto (`PYT/1.0`) |
| `kodowanie` | `"b64x1"` — hak migracyjny: przyszłe warianty (np. `aes-gcm`) dochodzą tu, nie w nowym polu |
| `skrot` | suma kontrolna FNV-1a 32 — wykrywa **urwanie przy kopiowaniu**, nie podmianę; to nie jest funkcja kryptograficzna |
| `dane` | base64url bez dopełnienia `=` |

**To nie jest szyfrowanie.** Przekształcenie jest odwracalne bez klucza przez
każdego, kto przeczyta `app/kodowanie.js`; chroni przed przypadkowym wglądem
(zerknięcie na ekran, przewinięcie wklejonego tekstu, paczka znaleziona
w schowku albo w pliku), nie przed zdeterminowanym graczem. Dlatego w paczce nie
wolno trzymać danych osobowych ani niczego, co nie może zostać upublicznione
(ADR 0013). Aplikacja przyjmuje też **jawny JSON** paczki (§3.1) — odpowiedź
modelu jest jawna, ukrywa ją dopiero aplikacja po walidacji.

### 3.4 Paczka odwrócona (`PYT/1.0-rev1`)

Wariant zapisu, nie nowa wersja schematu: model odwraca znakami pola tekstowe
(`tresc`, `odpowiedzi`, `wyjasnienie`, `uwagi`, `zrodla[].tytul`) i wpisuje
`"protokol": "PYT/1.0-rev1"`. Walidator odkodowuje paczkę PRZED walidacją, więc
reguły §3.2 i §6 działają na odczytanej treści. Cel jak w §3.3: ochrona przed
przypadkowym wglądem (ekran organizatora, schowek), nie szyfrowanie. Walidator
przyjmuje oba warianty.

**Wariant `PYT/1.0-rev2`.** Jak rev1, a ponadto: `poprawna` to kod pozycyjny (indeks + stacja + numer pytania + 17, np. s2p1 z poprawną trzecią: 2 + 2 + 1 + 17 = 22 — inny dla każdego pytania, a +17 sprawia, że goły indeks nigdy nie przejdzie za kod), a pola `punkty` nie ma (każde pytanie daje 1 pkt).

**Warianty `PYT/1.0-rev4` i `PYT/1.0-rev5` (bieżące, decyzja właściciela 2026-09-09).**
Odwracanie tekstu **zniesione**: pola tekstowe zapisuje się normalnie. Zostaje
wyłącznie kod pozycyjny `poprawna` (jak w rev2). Powód: modele przekręcały
wyrazy przy odwracaniu, więc bariera przypadkowego wglądu kosztowała jakość
pytań — a to właśnie kod poprawnej odpowiedzi robi całą robotę, dla której
odwracanie powstało (ADR 0007: maskowanie, nie szyfrowanie). Różnica między
nimi to wyłącznie profil źródeł: **rev4** z fact-check (źródła twarde, E09
obowiązuje, szablon §2), **rev5** bez fact-check (źródła opcjonalne, szablon
§2.2, domyślny — ADR 0032).

Walidator przyjmuje **wszystkie** markery: `PYT/1.0`, `-rev1`, `-rev2`, `-rev3`,
`-rev4`, `-rev5`. Odwracanie jest dekodowane tylko dla rev1/rev2/rev3, bo paczki
w tych wariantach leżą już na Drive i muszą dać się otworzyć.


## 4. Kategorie wiekowe i wymagania trudności

Od 2026-09-10 (ADR 0034) setup pokazuje tylko **7, 12, dorośli**.
10 i 15 poniżej pozostają wyłącznie w kanonie odczytu starych paczek.

Klucz kategorii jest wartością pola `wiek`; tekst z kolumny „opis trudności"
trafia do promptu jako `{OPIS_TRUDNOSCI}`. **Obniżenie trudności nie zwalnia
z wymogu źródła** (ADR 0008 pkt 7) — w wariancie z fact-check; wariant bez
weryfikacji źródeł nie wymaga wcale (ADR 0032).

| Klucz | Etykieta | Opis trudności (do promptu) |
| --- | --- | --- |
| `7` | 7 lat | Zdania krótkie, do 15 słów. Słownictwo codzienne, bez terminów specjalistycznych. Jedno pytanie = jeden fakt. Odpowiedzi rzeczowe i nazwy, bez dat i liczb wielocyfrowych. Preferowane pytania o rzeczy, które dziecko może zobaczyć albo zna z spaceru. |
| `10` | 10 lat | Zdania do 20 słów. Pojęcia proste, jedno pojęcie specjalistyczne na pytanie dopuszczalne, jeśli wyjaśnienie je tłumaczy. Jedna data albo jedna liczba w pytaniu dopuszczalna. |
| `12` | 12 lat | Pełne zdania, terminy z objaśnieniem w wyjaśnieniu. Daty, liczby i porównania dopuszczalne. Pytanie może wymagać dwóch kroków rozumowania. |
| `15` | 15 lat | Jak dla dorosłych, ale bez żargonu akademickiego i bez pytań wymagających wiedzy specjalistycznej z poziomu studiów. |
| `dorosli` | dorośli | Bez ograniczeń długości i słownictwa. Dopuszczalne pytania porównawcze, przyczynowo-skutkowe i o szczegóły (daty dzienne, nazwiska, liczby). |

## 5. Kanon tematów

Od 2026-09-10 (ADR 0034) nowy setup pokazuje alfabetycznie: Architektura,
Ciekawostki, Geografia, Historia, Kultura, Legendy, Ludzie, Nauka, Przyroda;
„Dopisz sam” jest na końcu. Sport i Jedzenie pozostają wyłącznie dla zgodności
odczytu paczek, nie w wyborze nowej gry. Tabela opisuje pełny kanon odczytu.

Klucze: małe litery, myślniki, bez spacji. Nowy temat = dopisanie do tej
tabeli, do `TEMATY` w `app/konfig.js` i do opisu w promptcie — w tym samym
commicie (AGENTS.md §3).

| Klucz | Etykieta | Opis do promptu |
| --- | --- | --- |
| `ciekawostki` | Ciekawostki | zaskakujące fakty, nietypowe miejsca i mało znane historie okolicy |
| `historia` | Historia | dzieje miejsca, daty, wydarzenia, dawne nazwy, ślady historii w terenie |
| `przyroda` | Przyroda | drzewa, rośliny, zwierzęta, wody, parki, formy terenu, ochrona przyrody |
| `architektura` | Architektura | budynki, style, autorzy projektów, detale, układ ulic i zabudowy |
| `kultura` | Kultura | instytucje kultury, pomniki sztuki, murale, festiwale, twórcy związani z miejscem |
| `legendy` | Legendy | podania miejskie, legendy, zwyczaje, przesądy, opowieści o miejscu |
| `ludzie` | Ludzie | mieszkańcy, patroni ulic, postaci historyczne związane z okolicą |
| `nauka` | Nauka | wynalazki, zakłady, infrastruktura, badania, obiekty inżynieryjne |
| `sport` | Sport | kluby, obiekty sportowe, trasy, wydarzenia sportowe, miejsca wypoczynku |
| `jedzenie` | Jedzenie | targi, lokale, rzemiosło, dawni i obecni kupcy, produkty lokalne |
| `geografia` | Geografia | rzeki, jeziora, wzgórza, granice administracyjne, nazwy geograficzne, mosty |
| `wlasny` | Dopisz sam | dziedzina wpisana przez organizatora w setupie |

Stare klucze dwuczłonowe (`kultura-i-sztuka` itd., sprzed 2026-09-07) są
przyjmowane jako aliasy i normalizowane do nowych (`ALIASY_TEMATOW`
w `app/konfig.js`) — paczki zapisane przed zmianą działają dalej.

## 6. Reguły walidacji i kody usterek

Walidator `walidujPaczke(paczka, oczekiwane)` zwraca listę usterek
`{ kod, pole, komunikat }`; pusta lista = przyjęcie. Komunikat jest po polsku
i mówi, **co zrobić** (ADR 0011 pkt 8). Kody są stałe — używa ich test, UI
i przycisk „skopiuj poprawkę do modelu" (ADR 0006 pkt 5).

| Kod | Usterka |
| --- | --- |
| `E01` | brak pola `protokol` albo inna wersja niż `PYT/1.0` |
| `E02` | JSON nieparsowalny (w tym wiele bloków, tekst poza blokiem) |
| `E03` | liczba pytań niezgodna z oczekiwaną z setupu |
| `E04` | `stacja` poza zakresem `1..LICZBA_STACJI` |
| `E05` | stacja bez żadnego pytania albo rozkład pytań różny o więcej niż jedno |
| `E06` | `poprawna` poza zakresem albo (warianty z kodem) kod nie do odczytania |
| `E07` | `odpowiedzi` nie ma dokładnie 4 pozycji albo pozycja jest pusta |
| `E08` | powtórzona odpowiedź (po normalizacji: wielkość liter, interpunkcja, białe znaki) |
| `E09` | pytanie bez `zrodla` albo lista pusta (nie dotyczy rev3 i rev5 — źródła opcjonalne) |
| `E10` | `zrodla[].url` nie jest adresem `http(s)` albo jest adresem zabronionym: domena przykładowa (`example.com`, `przyklad.org`, `twojastrona.pl`) albo zarezerwowane TLD (`.invalid`, `.test`, `.localhost`, `.example`, `.local`) |
| `E11` | data (`utworzono`, `sprawdzono`) w przyszłości albo w złym formacie |
| `E12` | `temat` spoza kanonu §5 |
| `E13` | duplikat pytania (znormalizowana `tresc` występuje więcej niż raz) |
| `E14` | wycofany 2026-09-09 (zakotwiczenie miejscowe jest prośbą w prompcie, nie bramką walidatora — patrz niżej) |
| `E15` | pole wymagane puste albo nie tekstem/liczbą zgodnie z §3 |
| `E16` | paczka niespójna z konfiguracją gry: `okolica` (promień, środek > 500 m) albo `wiek`, `tematy`, `jezyk` |
| `E17` | współrzędne poza zakresem (`lat`, `lon`) |
| `E18` | wycofany (rev2: 1 pkt za pytanie, pole `punkty` ignorowane) |
| `E19` | `id` pytania nieunikalne albo niezgodne ze wzorem |
| `E20` | `wyjasnienie` krótsze niż 60 znaków albo dosłownie powtarza `tresc` |

**Zakotwiczenie miejscowe (dawny E14) — wycofane 2026-09-09.** Walidator miał
heurystykę, która odrzucała pytania bez nazwy z `okolica.miejsce` ani z opisu
stacji. Właściciel zgłosił, że to bramka bez sensu: „przy niektórych kategoriach
(szczególnie tych custom) nigdy nie będzie nawiązania do miejsca i będą pytania
z wiedzy ogólnej. To jak najbardziej dopuszczalne i pożądane".

Kod, listy słów (`TOKENY_MIEJSCA`, `SLOWA_POSPOLITE`, `WYRAZY_POSPOLITE_MIEJSCA`,
`SKROTY_Z_KROPKA`) i funkcje pomocnicze (`czyZakotwiczone`, `tokenyWlasne`,
`rdzenTokena`) zostały usunięte z `app/protokol.js`. Zakotwiczenie zostaje
**prośbą w prompcie** (§2 i §2.2, zasada 4): model ma schodzić na najniższy
poziom drabiny, na którym ma pewny fakt, ale pytanie ogólne jest dopuszczalne.
Kod `E14` nie jest przydzielany ponownie — numery kodów raz wydane zostają
zajęte, tak samo jak wycofany `E18`.

## 7. Wersjonowanie i migracje

- Wersja protokołu jest **wyprowadzana** ze statusu tego pliku (pierwsza linia
  nagłówka „Status") i porównywana przez test kontraktowy ze stopką aplikacji
  (`index.html` → `#stopka-protokol`) oraz z `README.md`. Nie wpisuje się jej
  ręcznie w trzech miejscach.
- Zmiana schematu paczki = podbicie wersji (`PYT/1.1`, `PYT/2.0`) + nowy ADR +
  migrator w `app/migracje.js` + test migracji na fixture'ach starej wersji.
  Paczka użytkownika w `localStorage` nie może przestać działać (ADR 0010 pkt 6).
- Zmiana kosmetyczna szablonu promptu (bez zmiany schematu) = podbicie łatki
  (`PYT/1.0.1`) w `SZABLON_WERSJA` i wpis w `docs/PROJECT_HISTORY.md`.
- **Kontener ≠ paczka.** Zmiana kontenera (`TO-paczka/1` → `TO-paczka/2`,
  2026-09-05, ADR 0007) nie podbija wersji PYT, bo schemat paczki (§3.1/§3.2)
  się nie zmienił, a aplikacja nie była opublikowana — nie istnieje paczka
  użytkownika do zmigrowania. Po pierwszej publikacji Pages (M8) każda zmiana
  kontenera wymaga migratora (`app/migracje.js`) i wpisu tutaj.
- **Wariant odwrócony `PYT/1.0-rev1` (Partia 2)** — zapis pól tekstowych
  od końca (§3.4). Nie podbija wersji schematu (kształt pól ten sam, jak
  kontener ≠ paczka); walidator akceptuje oba markery, szablon generuje
  odwrócony.
- **Wariant `PYT/1.0-rev2`** — `poprawna` kodem pozycyjnym, koniec pola
  `punkty` (§3.4). Jak rev1: zapis, nie nowa wersja; walidator przyjmuje
  `PYT/1.0`, `-rev1` i `-rev2`, szablon generuje rev2. Dawne paczki działają
  bez migratora (M8 nieopublikowany, a reguły i tak łagodnieją).
- **Warianty `PYT/1.0-rev4` / `PYT/1.0-rev5` (2026-09-09, zgłoszenie B2)** —
  koniec odwracania liter; zostaje kod pozycyjny `poprawna`. Znów zapis, nie
  nowa wersja schematu: kształt pól bez zmian, walidator przyjmuje wszystkie
  dotychczasowe markery, a odwrócone rev1/rev2/rev3 dekoduje jak dotąd (paczki
  na Drive zostają czytelne). Szablony generują rev4 (§2) i rev5 (§2.2).
  Wersje szablonów: `PYT/1.0.7` i `PYT/1.0-nofc.2`.

## 8. Przykład minimalnej paczki (1 stacja, 1 pytanie)

```json
{
  "protokol": "PYT/1.0",
  "okolica": { "lat": 52.23178, "lon": 21.01234, "promienM": 1000, "miejsce": "Śródmieście, Warszawa" },
  "wiek": "dorosli",
  "tematy": ["historia"],
  "jezyk": "polski",
  "utworzono": "2026-09-05 18:30",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "temat": "historia",
      "tresc": "Przy jakiej ulicy stała pierwsza siedziba Polskiej Agencji Telegraficznej (1918)?",
      "odpowiedzi": ["Bracka", "Mazowiecka", "Zgoda", "Jasna"],
      "poprawna": 2,
      "wyjasnienie": "Pierwsza siedziba PAT mieściła się przy ulicy Zgoda (X 1918).",
      "zrodla": [{ "url": "https://pl.wikipedia.org/wiki/Polska_Agencja_Telegraficzna", "tytul": "Polska Agencja Telegraficzna — Wikipedia", "sprawdzono": "2026-09-05" }]
    }
  ],
  "uwagi": ""
}
```

Przykład jest ilustracją formatu: fakt i adres źródła przed użyciem w paczce
referencyjnej w repo musi zweryfikować agent (`fetch_page`, ADR 0008 pkt 6).

## 9. Aneks M11/M12: schematy gry wieloosobowej (RO-*) i kody R

Schematy mostu Drive (`docs/setup/apps-script-repo-paczek.gs`; ADR 0016, 0018,
0019). Jedno źródło prawdy walidacji po stronie aplikacji: `app/wieloosobowa.js`
— most ma lustro dla Apps Script, a zgodność obu pilnuje `test/kontrakt.test.js`.

Wysyłka do gry wieloosobowej jest **domyślna**: aplikacja nie pyta o zgodę przy
zakładaniu ani dołączaniu do gry (checkbox `#multi-zgoda` usunięty 2026-09-07,
dopisek ADR 0019) — co i dokąd trafia, opisuje sekcja „Dane i prywatność"
w aplikacji. Schematy `RO-*` nigdy nie miały pola `zgoda`.

### 9.1 `RO-gra/1` — stan gry (plik JSON w katalogu gier)

| Pole | Typ / zakres | Uwagi |
|---|---|---|
| `schemat` | `"RO-gra/1"` | stała |
| `kod` | 6 znaków | alfabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (bez 0/O/1/I) |
| `idGry` | string | id pliku Drive; lobby odsyła je graczom |
| `tryb` | `"trasa"` \| `"wyscig"` | wybrany przy założeniu, niezmienny |
| `trasaSekret` | Boolean (opcjonalne) | własność gry (m12-74): mapa pokazuje tylko bieżącą stację; brak pola przy `trasa` = sekret (zgodność wstecz) |
| `stan` | `lobby` \| `trwa` \| `zakonczona` \| `archiwum` | otwarta gra bez startu → `archiwum` po 24 h |
| `utworzono` | ISO 8601 | |
| `organizatorId` | `"g-1"` | założyciel; tylko on startuje i kończy przedwcześnie |
| `gracze` | `[{id: "g-N", pseudonim, dolaczyl}]` | maks. 8, pseudonim ≤24 znaków, unikalny w grze |
| `konfiguracja` | `{liczbaStacji, pytaniaNaStacje, wiek, tematy, promienM, miejsce, geohash5, geohash8}` | geohash5 = przybliżenie okolicy (nigdy punkt gracza); `geohash8` (~40 m, pozycja hosta z chwili założenia) = miara zasięgu ~50 m listy „Dołącz" (m12-74); przy zakładaniu wymagany, przy odczycie opcjonalny (stare gry) |
| `zestaw` | `{stacje, kontener TO-paczka/2, meta TO-zestaw/1}` | mapa gry + ukryte pytania (ADR 0007) |
| `zdarzenia` | `[{kolejnosc, graczId, typ, stacjaId, dane, tSerwera}]` | append-only, `kolejnosc` nadaje most (LockService) |
| `wyniki` | `{graczId: {pseudonim, punkty, poprawne, bledne, czasOdcinkowMs, stacjeZamkniete, zrezygnowal, premia}}` | liczone przez most przy zamknięciu gry; `punkty` zawierają `premia` (ADR 0027 część B) |

Reguły gry: dołączenie tylko w `lobby` — **po starcie nowi gracze nie wchodzą**
(właściciel, 2026-09-11; `listaGier` zwracza wyłącznie `stan: "lobby"`);
start tylko przez organizatora (żeby wystartowała, gra potrzebuje tylko
organizatora — **solo dozwolone**, właściciel 2026-09-11); **host może
zakończyć grę przed czasem** (`gra-zakoncz`, tylko organizator) — u wszystkich
podsumowanie i ranking, a premie za kolejność liczą się też przy takim końcu.
**Wspólna Trasa** (`trasa`) i **Wyścig na Orientację** (`wyscig`): w obu KAŻDY
gracz przechodzi wszystkie stacje (w trasie po kolei, w wyścigu w dowolnej
kolejności), a gra domyka się, gdy wszyscy aktywni (niezrezygnowani) zamkną
swoje stacje. Punktacja wspólna: 1 pkt za dobrą odpowiedź + premia za
kolejność ukończenia (ADR 0027 część B). Polling w grze co 30 s, w lobby
co 10 s (właściciel, 2026-09-11).

**Wyścig (ADR 0027 część B — wolna kolejność)**: każdy gracz idzie do
WSZYSTKICH stacji w **dowolnej kolejności**, na swoim telefonie i bez
uzgadniania z innymi. Pytanie bierze wg własnego indeksu: pytanie `k` przy
danej stacji należy do gracza `k` (`pytaniaNaStacje = liczbaGraczy`), więc nie
ma wyścigu o pytanie ani blokady przy braku zasięgu; paczka mniejsza niż
liczba graczy dzieli pytanie (indeks zawija się). 1 pkt za poprawną odpowiedź,
bez składnika czasowego (ADR 0023 pkt 1). Gra kończy się, gdy każdy
niezrezygnowany gracz odpowiedział na wszystkich stacjach, ALBO gdy organizator
zakończy ją przed czasem.

**Premia za kolejność ukończenia** (aneks właściciela 2026-09-11): STAŁA —
**3 pkt za 1. miejsce, 2 pkt za 2., 1 pkt za 3.**; 4. i dalsi: 0,
niezależnie od liczby graczy. Kolejność bierze się z `kolejnosc` zdarzeń
nadawanej przez most, nie z zegara urządzenia. Rezygnujący i gracze
niedokończeni premii nie dostają — ale ukończenie wszystkich stacji PRZED
przedwczesnym końcem gry (host, `gra-zakoncz`) premię zachowuje.
Premia wchodzi do `punkty` dopiero w podsumowaniu (`stan: zakonczona`) —
częściowy wynik jej nie pokazuje, żeby nie sugerować punktów, których jeszcze
nie ma.

### 9.2 `RO-zdarzenie/1` — zdarzenie gracza

`{ schemat: "RO-zdarzenie/1", kod | idGry, graczId, typ, stacjaId, dane, tUrzadzenia }`

- `typ`: `start` | `dojscie` | `odpowiedz` | `rezygnacja` | `koniec`.
- `tUrzadzenia`: znacznik czasu urządzenia w ms (liczba, opcjonalny —
  most go ignoruje; czas gry stempluje serwer polem `tSerwera`).
- `dane` — BIAŁA lista pól (`POLA_DANYCH_ZDARZENIA`): `trybDojscia`,
  `poprawna`, `punktyRazem`, `powod` (pola czasowe usunięte w Partii 2,
  ADR 0023). Cokolwiek innego nie wychodzi z telefonu, a most
  dodatkowo kasuje pola `lat/lon/szerokosc/dlugosc/latitude/longitude`
  (ADR 0013/0019 pkt 3 — współrzędne gracza NIGDY).
- Most waliduje SPÓJNOŚĆ (nie zaufanie): gra musi trwać, gracz istnieć,
  `dojscie` przed `odpowiedz` na danej stacji, bez duplikatów,
  `stacjaId` w zakresie `1..liczbaStacji`. Odmowa wraca jako `{ok:false, blad}`
  i NIE jest ponawiana przez `app/sync.js` (awaria sieci — przeciwnie: ląduje
  w kolejce offline i wychodzi FIFO po powrocie połączenia).

### 9.3 `RO-lobby/1` i `RO-ranking/1`

- `RO-lobby/1`: `{ schemat, wpisy: [{ idGry, tryb, stan, miejsce, geohash5,
  geohash8, wiek, tematy, liczbaGraczy, utworzono, organizator }] }` — BEZ
  kodów i BEZ zestawów (prywatność otwartych gier); most zwracza WYŁĄCZNIE
  gry w stanie `lobby` (po starcie nie ma dołączania, właściciel 2026-09-11),
  a aplikacja filtruje po **geohash8** pozycji + sąsiadach (~50 m od hosta,
  `filtrujLobby`; fallback geohash5 dla starych mostów) i dołącza przez
  `idGry`. Wpis w UI pokazuje tylko „Host: <organizator>" — bez miejsca,
  trybu i licznika graczy.
- `RO-ranking/1`: `{ schemat, wiersze: [{ pseudonim, punkty, poprawne, bledne,
  czasOdcinkowMs, stacjeZamkniete, data, tryb, miejsce, geohash5, wiek,
  tematy }] }` — surowe wiersze z gier zakończonych (rezygnacja bez wyniku nie
  wchodzi); agregacje (ogólny/wiek/tematy/lokalizacja) liczy telefon:
  `agregujRanking`, `kategorieRankingu` (ADR 0019 pkt 7).
- `RO-profil/1`: `{ schemat, pseudonim, pin, utworzono }` — plik
  `profil-<id>.json` w katalogu `okolica-profile`; PIN jawnym tekstem
  (ADR 0021). Akcje mostu: `profil-ustaw` (utwórz albo potwierdź),
  `profil-sprawdz` (tylko potwierdź); odmowy kodami R19/R20 w polu `blad`.
  Aplikacja woła wyłącznie `profil-ustaw` — jest bramą tożsamości ekranu 1
  (ADR 0026): zakłada profil albo potwierdza PIN jednym żądaniem.

### 9.4 Kody usterek R01–R20 (`KODY_WIELOOSOBOWE` w `app/wieloosobowa.js`)

| Kod | Znaczenie |
|---|---|
| R01 | Stan gry nie jest poprawnym JSON-em. |
| R02 | To nie jest gra schematu `RO-gra/1` (inna wersja aplikacji). |
| R03 | Kod gry niepoprawny (6 znaków z alfabetu bez 0, O, 1, I). |
| R04 | Tryb gry nieznany (oczekiwano `trasa` albo `wyscig`). |
| R05 | Stan gry nieznany (lobby / trwa / zakonczona / archiwum). |
| R06 | Gra nie ma graczy — stan uszkodzony. |
| R07 | Konfiguracja gry niekompletna. |
| R08 | Zestaw gry uszkodzony (stacje / kontener TO-paczka/2 / meta). |
| R09 | Zdarzenia gry uszkodzone (kolejność, gracz, typ, czas serwera). |
| R10 | Zdarzenie nie jest poprawnym JSON-em. |
| R11 | To nie jest zdarzenie schematu `RO-zdarzenie/1`. |
| R12 | Typ zdarzenia nieznany. |
| R13 | Zdarzenie nie wskazuje gry (kod/idGry) albo gracza. |
| R14 | Stacja zdarzenia poza zakresem gry albo zły typ. |
| R15 | Lista lobby nieczytelna albo zły schemat (`RO-lobby/1`). |
| R16 | Część wpisów lobby uszkodzona — odfiltrowane. |
| R17 | Ranking nieczytelny albo zły schemat (`RO-ranking/1`). |
| R18 | Część wierszy rankingu uszkodzona — odfiltrowane. |
| R19 | Nieznany pseudonim (brak pliku profilu). |
| R20 | PIN niepoprawny albo nie pasuje do pseudonimu. |

### 9.5 `gra-hotseat` — wynik gry z jednego telefonu (ADR 0026 aneks)

Gra na jednym telefonie (hot-seat) nie ma lobby, kodu ani zdarzeń na żywo:
telefon wysyła SKOŃCZONĄ grę jednym poleceniem POST, a most zapisuje ją jako
zwykłą grę `RO-gra/1` ze stanem `zakonczona` w katalogu
`okolica-gry-zakonczone`. `GET ?akcja=ranking` czyta ten sam format, więc
rankingi hot-seat i gier na wielu urządzeniach są JEDNYMI rankingami — bez
osobnej ścieżki w aplikacji.

```json
{
  "akcja": "gra-hotseat",
  "tryb": "hotseat",
  "konfiguracja": {
    "miejsce": "Podkowa Leśna", "geohash5": "u3qb8", "wiek": "dorosli",
    "tematy": ["historia"], "liczbaStacji": 3, "pytaniaNaStacje": 3
  },
  "gracze": [{ "id": 1, "pseudonim": "Ala" }, { "id": 2, "pseudonim": "Jan" }],
  "zdarzenia": [
    { "schemat": "RO-zdarzenie/1", "graczId": 1, "typ": "dojscie",
      "stacjaId": 1, "dane": { "trybDojscia": "gps" } },
    { "schemat": "RO-zdarzenie/1", "graczId": 1, "typ": "odpowiedz",
      "stacjaId": 1, "dane": { "poprawna": true, "punktyRazem": 10 } }
  ]
}
```

Reguły są lustrami po obu stronach (`graHotseatDoWysylki` w
`app/wieloosobowa.js` i `bledyGryHotseat` w moście):

- `tryb` musi być `hotseat`; `gracze` 1–8, pseudonimy unikalne, ≤ 24 znaków;
- `zdarzenia` wyłącznie `dojscie` i `odpowiedz`, 1–400 sztuk, `stacjaId`
  w zakresie 1–`liczbaStacji`, `graczId` z listy graczy;
- `konfiguracja` jak w grze wieloosobowej: `geohash5` startu zamiast punktu
  gracza (ADR 0019 pkt 3), a pola `lat`/`lon` most kasuje dodatkowo;
- `zestaw` jest `null` — paczka i pytania NIGDY nie wchodzą na Drive (ADR 0013);
- punkty liczy MOST (`przeliczWyniki`), nie telefon: wynik rankingu nie zależy
  od wersji aplikacji. Premia za kolejność w hot-seat wynosi 0 — gracze idą
  razem, więc „kto skończył pierwszy" byłoby artefaktem kolejności klikania;
- odpowiedź: `{ ok: true, idGry, wyniki }`; odmowa: `{ ok: false, blad }`.

Prywatność i offline: wysyłka jest **domyślna** — nie pytamy o nią przy każdej
grze (decyzja właściciela 2026-09-07); co i dokąd trafia, opisuje sekcja „Dane
i prywatność" w aplikacji. Warunkiem technicznym jest choć jeden gracz
potwierdzony profilem PIN (inaczej nie ma gdzie zapisać punktów — komunikat
pod wynikiem mówi to wprost). Bez sieci
polecenie czeka w `okolica:hotseat-kolejka` (maks. 5 gier) i jedzie przy
następnym uruchomieniu, a odcisk gry w `okolica:hotseat-wyslane` pilnuje, żeby
ta sama gra nie weszła do rankingu dwa razy (ADR 0016 pkt 5).
