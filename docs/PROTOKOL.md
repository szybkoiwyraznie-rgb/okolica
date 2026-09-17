# PROTOKÓŁ PYT v1.3 — protokół pytań terenowych

> **To jest zasada treściowa, nie sugestia** (AGENTS.md §3). Obowiązuje każdy
> prompt, każdą wklejoną odpowiedź modelu i każdą paczkę pytań zapisaną przez
> aplikację. Zmiana protokołu = nowy ADR + podbicie wersji, a migrator tylko
> wtedy, gdy istnieją paczki do zmigrowania (§7).

- Status: **obowiązujący** (wersja wyprowadzana z tego nagłówka; test
  kontraktowy porównuje ją z `app/protokol.js` i z `README.md`)
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
        ↓ (4) paczka jawnym JSON-em (ADR 0050) → localStorage / plik na Drive
            (żadnego ukrywania: gra dla właściciela i jego rodziny)
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
1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu, i oprzyj ten fakt na wyniku kwerendy.
2. Nazwy, daty, liczby, cytaty i autorów podawaj dokładnie w postaci potwierdzonej kwerendą. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu "uwagi".
3. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny potwierdzony fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.
4. Trudność KAŻDEGO pytania dostosuj ściśle do POZIOMU pytania i do wymagań trudności poziomów podanych niżej; liczba pytań każdego poziomu przy każdej stacji musi się zgadzać z zestawieniem podanym pod stacją.
5. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.
6. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.
OKOLICA GRY:
- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}
- miejsce: {MIEJSCE}
- promień gry: {PROMIEN_M} m
- sposób poruszania się: {TRYB}

STACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji; przy każdej stacji DOKŁADNIE tyle pytań każdego poziomu, ile podano pod stacją):
{LISTA_STACJI}

{POZIOMY_BLOK}
- tematy pytań (wyłącznie z tej listy): {TEMATY}
- liczba pytań łącznie: {LICZBA_PYTAN}
- język pytań: {JEZYK}

SCHEMAT ODPOWIEDZI — dokładnie te pola:
{
  "okolica": { "lat": {LAT}, "lon": {LON}, "promienM": {PROMIEN_M}, "miejsce": "{MIEJSCE}" },
  "tematy": [{TEMATY_JSON}],
  "jezyk": "{JEZYK}",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "poziom": "dzieci",
      "temat": "historia",
      "tresc": "Treść pytania zakończona znakiem zapytania?",
      "odpowiedzi": ["pierwsza", "druga", "trzecia", "czwarta"],
      "poprawna": 2,
      "wyjasnienie": "Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy."
    }
  ],
  "uwagi": ""
}

WYMAGANIA DODATKOWE:
- "id": "s<numer stacji>p<kolejny numer>", na przykład "s2p1"; identyfikatory unikalne w całej paczce.
- "stacja": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.
- "odpowiedzi": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.
- "poprawna": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście "odpowiedzi").
- "temat": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.
- "poziom": dokładnie "dzieci" albo "dorosli" — poziom trudności pytania zgodny z zestawieniem podanym przy stacji. Pytanie bez tego pola unieważnia całą paczkę.
- "wyjasnienie": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.
- "uwagi": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są potwierdzone.
```
<!-- szablon-promptu:koniec -->

### 2.1 Placeholdery

| Placeholder | Wartość | Źródło |
| --- | --- | --- |
| `{LAT}`, `{LON}` | środek gry, 5 miejsc po przecinku (~1 m) | geolokalizacja albo tryb testowy (ADR 0004) |
| `{MIEJSCE}` | nazwa miejsca: dzielnica, miasto, region, państwo | obszary administracyjne z tego samego zapytania Overpass (`is_in`); gdy odczyt niedostępny — `brak odczytu (tylko współrzędne)` (ADR 0013 pkt 3, `docs/ASSETS.md` §3) |
| `{PROMIEN_M}` | promień gry w metrach | setup: liczony z planowanego czasu gry, trybu i liczby pytań (ADR 0025) |
| `{TRYB}` | `piesza` / `rower` / `samochodowa` — etykieta polska | setup |
| `{LISTA_STACJI}` | po jednej linii: `- stacja N: LAT, LON — <opis miejsca albo „punkt przy ulicy X"> (ODLEGLOSC m od środka gry)`, a pod KAŻDĄ stacją linia z zestawieniem pytań poziomów (np. `2 pytania dla dorosłych, 1 pytanie dla dzieci`; w multi `1 pytanie dla dzieci`) (ADR 0057) | wybór stacji (ADR 0005) + poziomy graczy/gra (ADR 0055) |
| `{POZIOMY_BLOK}` | blok złożony przez `zbudujPrompt()` (ADR 0057): wymagania trudności poziomów obecnych w grze (hot-seat: poziomy z listy graczy — bez imion i bez opisu kolejności odpowiadania; multi: dodatkowo linia o poziomie wszystkich pytań — wybór organizatora) | `konfig.gracze` / wybór hosta (multi) + protokół §4 |
| `{TEMATY}` | lista tematów z opisami, np. `historia (dzieje miejsca, daty, wydarzenia, postaci)` | protokół §5 |
| `{TEMATY_JSON}` | te same klucze jako elementy listy JSON, np. `"historia", "przyroda"` | protokół §5 |
| `{LICZBA_PYTAN}` | liczba pytań = `LICZBA_STACJI × pytania na stację`; organizator jej nie wpisuje — pytania na stację liczy `konfig.pytaniaNaStacjeDla` (hot-seat: liczba graczy — po jednym na gracza; multi: 1 — jedno wspólne pytanie na poziom hosta; ADR 0055) | konfiguracja |
| `{JEZYK}` | `polski` (domyślnie) albo inny z setupu | setup |
| `{LICZBA_STACJI}` | liczba stacji | setup |

Daty nie są już w prompcie (PYT/1.3, ADR 0057/0058: „data przygotowania" zbędna,
a `utworzono` model nie jest w stanie wypełnić bez podanej daty).

**Budżet rozmiaru (B21, pomiar 2026-09-07).** Prompt **nie rośnie** z liczbą
pytań — 5 422 znaki (~1 356 tokenów) dla 5 pytań i 5 423 znaki dla 40, bo
z szablonu zmienia się tylko cyfra w `{LICZBA_PYTAN}`. Rośnie **odpowiedź**:
realistyczna paczka rev2 (treść ~140 znaków, 4 odpowiedzi, wyjaśnienie ~200
znaków, jedno źródło) to 4 469 znaków / ~1 118 tokenów dla 5 pytań i
33 392 znaków / ~8 348 tokenów dla 40 pytań (5 stacji × 8 graczy) — czyli
~830 znaków i ~210 tokenów na pytanie. Jawna paczka 40 pytań to ~36 kB (1,8%
budżetu stanu, 2,4% rejestru), więc pamięć nie jest ograniczeniem;
ograniczeniem jest limit wyjścia modelu. Szacunek był pokazywany w UI
i usunięty jako ozdobnik (właściciel, testy terenowe 2026-09-11) — pomiar
zostaje tutaj jako prawidło protokołu, a spinają go testy
`test/duza-paczka.test.js`. Górne ograniczenie jest wspólne dla obu wariantów
promptu (paczka bez weryfikacji zwykle wychodzi mniejsza, bo nie niesie źródeł).

### 2.2 Wariant „Pytania (bez fact check)" (domyślny, ADR 0032)

Ten sam kształt odpowiedzi co §2, inny kontrakt z modelem: **nie narzucamy
sposobu zdobycia faktu** — model sam decyduje, czy sięgnie do sieci, czy do
własnej wiedzy — a źródła są opcjonalne. Model nie wpisuje żadnego markera:
czy paczka jest z fact-checkiem, wie aplikacja z ptaszka w setupie (§3.4).

Decyzja właściciela 2026-09-09: wcześniejsza wersja wprost ZAKAZYWAŁA kwerendy
i nakazywała pamięć treningową. To było wymuszanie bez powodu — jeśli model nie
ma pewnego faktu w pamięci, lepiej żeby go sprawdził, niż zgadywał. Zakaz
zostaje wyłącznie w §2 w drugą stronę (tam kwerenda jest OBOWIĄZKOWA).

<!-- szablon-promptu-bez:start -->
```tekst
Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.

ZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):
1. Podawaj wyłącznie fakty, których jesteś pewien. Sposób ich ustalenia zostawiamy Tobie. Przy braku pewności upraszczaj pytanie, a pominięte tematy opisuj w polu "uwagi".
2. Nazwy, daty, liczby, cytaty i autorów podawaj w postaci, której jesteś pewien; przy braku takiej pewności wybierz łatwiejszy fakt z tego samego tematu. Jeśli w jakimś temacie brakuje pewnych faktów, zrób mniej pytań w tym temacie i opisz brak w polu "uwagi".
3. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny pewny fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.
4. Trudność KAŻDEGO pytania dostosuj ściśle do POZIOMU pytania i do wymagań trudności poziomów podanych niżej; liczba pytań każdego poziomu przy każdej stacji musi się zgadzać z zestawieniem podanym pod stacją.
5. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.
6. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.
OKOLICA GRY:
- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}
- miejsce: {MIEJSCE}
- promień gry: {PROMIEN_M} m
- sposób poruszania się: {TRYB}

STACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji; przy każdej stacji DOKŁADNIE tyle pytań każdego poziomu, ile podano pod stacją):
{LISTA_STACJI}

{POZIOMY_BLOK}
- tematy pytań (wyłącznie z tej listy): {TEMATY}
- liczba pytań łącznie: {LICZBA_PYTAN}
- język pytań: {JEZYK}

SCHEMAT ODPOWIEDZI — dokładnie te pola:
{
  "okolica": { "lat": {LAT}, "lon": {LON}, "promienM": {PROMIEN_M}, "miejsce": "{MIEJSCE}" },
  "tematy": [{TEMATY_JSON}],
  "jezyk": "{JEZYK}",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "poziom": "dzieci",
      "temat": "historia",
      "tresc": "Treść pytania zakończona znakiem zapytania?",
      "odpowiedzi": ["pierwsza", "druga", "trzecia", "czwarta"],
      "poprawna": 2,
      "wyjasnienie": "Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy."
    }
  ],
  "uwagi": ""
}

WYMAGANIA DODATKOWE:
- "id": "s<numer stacji>p<kolejny numer>", na przykład "s2p1"; identyfikatory unikalne w całej paczce.
- "stacja": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.
- "odpowiedzi": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.
- "poprawna": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście "odpowiedzi").
- "temat": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.
- "poziom": dokładnie "dzieci" albo "dorosli" — poziom trudności pytania zgodny z zestawieniem podanym przy stacji. Pytanie bez tego pola unieważnia całą paczkę.
- "wyjasnienie": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.
- "uwagi": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są pewne.
```
<!-- szablon-promptu-bez:koniec -->

## 3. Schemat paczki PYT/1.2

### 3.1 Poziom paczki

| Pole | Typ | Wymagane | Zasady |
| --- | --- | --- | --- |
| `protokol` | tekst | nie | pole historyczne: model go NIE pisze, a aplikacja je IGNORUJE (§3.4). Profil źródeł wynika z ptaszka „fact check” w setupie, nie z markera |
| `okolica.lat` | liczba | tak | `-90 ≤ lat ≤ 90` |
| `okolica.lon` | liczba | tak | `-180 ≤ lon ≤ 180` |
| `okolica.promienM` | liczba | tak | `100–50000`, zgodna z konfiguracją gry |
| `okolica.miejsce` | tekst | tak | niepuste; nazwa miejsca z geokodacji albo jawny brak |
| `wiek` | tekst | nie | usunięte w PYT/1.2 (ADR 0055): trudność jest własnością GRACZA (`gracze[].poziom` w setupie) i pytania (`poziom` w §3.2). Stare paczki z tym polem są czytane, pole jest ignorowane |
| `tematy` | lista tekstów | tak | niepusta, podzbiór kanonu §5, bez powtórzeń |
| `jezyk` | tekst | tak | `polski` albo inny z setupu |
| `utworzono` | tekst | nie | usunięte w PYT/1.3 (ADR 0058): daty nie ma już w prompcie, więc model nie jest w stanie wypełnić pola; aplikacja generuje datę paczki sama (`meta.data` zestawu). Stare paczki z tym polem są czytane, pole jest ignorowane |
| `pytania` | lista | tak | niepusta; liczba = oczekiwana z setupu |
| `uwagi` | tekst | tak (może być pusty) | czego model nie potwierdził |
| `model` | tekst | nie | dobrowolna etykieta organizatora (ADR 0006 pkt 7) |
| `modyfikacje` | lista | nie | ręczne poprawki organizatora: `{data, opis}` |
| `ziarno` | tekst | nie | ziarno rozgrywki (ADR 0005 pkt 6) — dopisuje aplikacja |

### 3.2 Poziom pytania

| Pole | Typ | Zasady |
| --- | --- | --- |
| `id` | tekst | `^s[0-9]+p[0-9]+$`, unikalne w paczce |
| `stacja` | liczba całkowita | `1..LICZBA_STACJI`; każda stacja ≥ 1 pytanie; przy każdej stacji zestawienie pytań poziomów musi się zgadzać z zestawieniem podanym w prompcie pod stacją (patrz §6 `E22`) |
| `poziom` | tekst | `dzieci` albo `dorosli` — poziom trudności (ADR 0055); pytania poziomu idą do graczy tego poziomu, bez mieszania |
| `temat` | tekst | klucz z kanonu §5 |
| `tresc` | tekst | ≥ 20 i ≤ 400 znaków; kończy się `?` |
| `odpowiedzi` | lista 4 tekstów | każdy 1–80 znaków, bez powtórzeń (po normalizacji), bez „wszystkie/żadna z powyższych" |
| `poprawna` | liczba całkowita | `1..4` — **numer** odpowiedzi na liście `odpowiedzi` (1 = pierwsza). Tak liczy człowiek i tak pisze model; żadnego przeliczania po drodze (ADR 0050) |
| `wyjasnienie` | tekst | ≥ 60 znaków; nie powtarza treści pytania w całości |
| `zrodla` | lista | usunięte w PYT/1.3 (ADR 0058): model nie wpisuje źródeł (właściciel: nikt ich nie czyta); w wariancie z fact-check obowiązkowa jest KWERENDA, ale jej wynik nie ląduje w paczce. Stare paczki z tym polem są czytane, pole jest ignorowane |

### 3.3 Zapis paczki — jawny JSON (ADR 0050)

Paczka **nie jest ukrywana**. Leży w `localStorage`, w zapisie gry na czas
przerwy i w pliku na Drive dokładnie w kształcie §3.1/§3.2 — jawny JSON, ten
sam, który model napisał. Ukrywanie paczek (kontener i kodowanie z §3.4)
zniknęło razem z plikiem `app/kodowanie.js` (właściciel 2026-09-15: „to jest
gra dla mnie i mojej rodziny więc żadne zabezpieczenia nie są potrzebne”).

Tożsamość paczki (klucz wpisu lokalnego, dopasowanie pliku na Drive) niesie
odcisk treści `skrotPaczki()` z `app/zestawy.js`: FNV-1a 32 z bajtów
`JSON.stringify(paczka)`, 8 znaków hex. Wykrywa podmianę treści pliku; nie jest
funkcją kryptograficzną i nie jest zapisywany w samej paczce.

Z jawności wynika jedno ograniczenie, które zostaje: w paczce nie wolno trzymać
**danych osobowych** ani niczego, co nie może zostać upublicznione (ADR 0013) —
plik na Drive jest czytelny dla każdego, kto ma do niego dostęp, a teksty pytań
i tak widzi organizator w oknie czatu z modelem, którego żadne kodowanie nie
zasłania.

### 3.4 Historia zapisu paczki (warianty zniesione)

Do 2026-09-15 paczka niosła marker `"protokol": "PYT/1.0-revN"`, a kolejne
warianty zmieniały zapis: `rev1` odwracał znakami pola tekstowe, `rev2`/`rev3`
kodowały numer poprawnej odpowiedzi kodem pozycyjnym (indeks + stacja + numer
pytania + 17), a `rev4`/`rev5` różniły się wyłącznie profilem źródeł.

Wszystko to jest **zniesione**:

- odwracanie tekstu — 2026-09-09 (ADR 0033),
- kod pozycyjny `poprawna` — 2026-09-15 (ADR 0049), a numeracja przeszła na
  `1..4` (ADR 0050),
- markery i profile źródeł w paczce — 2026-09-15e (ADR 0050): „to tylko obciążenie
  dla AI”. O tym, czy pytania były z fact-checkiem, wie aplikacja (ptaszek na
  ekranie promptu) i zapisuje to w `meta.factcheck` zestawu; model nie ma nic do
  zgłaszania.

Paczka ma więc **jedną postać** (§3.1/§3.2), a pole `protokol` — jeśli model je
mimo wszystko dopisze — jest ignorowane. Do tego samego worka historii idzie
kontener `TO-paczka/2` (§3.3): ukrywanie paczek zniknęło 2026-09-15e (ADR 0050).
Starych paczek nie ma (właściciel ich
nie trzyma), więc konwersji nie ma i nie będzie.

## 4. Kategorie wiekowe i wymagania trudności

Od 2026-09-17d (ADR 0055, uwaga B właściciela) setup ma **DWA poziomy
trudności: `dzieci` (8–10 lat) i `dorosli`** — globalnego pola „kategoria
wiekowa” nie ma. Poziom wybiera organizator per gracz, przy jego imieniu
(`konfig.gracze[].poziom`), a zestawienie poziomów graczy wyznacza, ile pytań
danego poziomu powstaje przy każdej stacji (prompt: zestawienie podane POD KAŻDĄ
stacją w `{LISTA_STACJI}`, ADR 0057). Klucze liczbowe (`7`, `10`, `12`, `15`) i `dorosli`
w postaci sprzed 2026-09-17d pozostają wyłącznie w kanonie odczytu starych
paczek (ich pole `wiek` jest ignorowane).

**W grze multi (Wspólna Trasa / Wyścig) poziomów per gracz NIE MA** (decyzja
właściciela 2026-09-17): pytania generuje host, nie znając dołączających
graczy, więc organizator wybiera JEDEN poziom dla całej gry, paczka niesie
jedno wspólne pytanie na stację tego poziomu (`poziomyPytan: {dzieci: 1,
dorosli: 0}` albo `{dzieci: 0, dorosli: 1}`, `pytaniaNaStacje: 1`) i wszyscy
odpowiadają na te same pytania. Poziomy per gracz (`konfig.gracze[].poziom`)
to mechanika wyłącznie hot-seat + profilu gracza (auto-selection).

Teksty z kolumny „opis trudności” poziomów `dzieci`/`dorosli` trafiają do
promptu w bloku `{POZIOMY_BLOK}` (ADR 0057). Wymaganie źródła zniknęło w
PYT/1.3 (ADR 0058): w wariancie z fact-check obowiązkowa jest KWERENDA przed
napisaniem faktu (reguła 1 §2), ale jej wynik nie ląduje w paczce; wariant bez
weryfikacji nie wymusza sprawdzania wcale (ADR 0032).

| Klucz | Etykieta | Opis trudności (do promptu) |
| --- | --- | --- |
| `7` | 7 lat | Zdania krótkie, do 15 słów. Słownictwo codzienne, bez terminów specjalistycznych. Jedno pytanie = jeden fakt. Odpowiedzi rzeczowe i nazwy, bez dat i liczb wielocyfrowych. Preferowane pytania o rzeczy, które dziecko może zobaczyć albo zna z spaceru. |
| `10` | 10 lat | Zdania do 20 słów. Pojęcia proste, jedno pojęcie specjalistyczne na pytanie dopuszczalne, jeśli wyjaśnienie je tłumaczy. Jedna data albo jedna liczba w pytaniu dopuszczalna. |
| `12` | 12 lat | Pełne zdania, terminy z objaśnieniem w wyjaśnieniu. Daty, liczby i porównania dopuszczalne. Pytanie może wymagać dwóch kroków rozumowania. |
| `15` | 15 lat | Jak dla dorosłych, ale bez żargonu akademickiego i bez pytań wymagających wiedzy specjalistycznej z poziomu studiów. |
| `dzieci` | dziecko (8–10 lat) | Łatwe pytania na poziomie szkoły podstawowej (8–10 lat). Krótkie zdania, słownictwo codzienne, jedno pytanie = jeden fakt. BEZ trudnych dat, trudnych nazwisk i trudnych faktów — proste liczby, podstawowe fakty i nazwy są w porządku; najlepiej to, co dziecko może zobaczyć, usłyszeć albo zna z życia i spaceru. |
| `dorosli` | dorośli | Bez ograniczeń długości i słownictwa. Pytania mogą być TRUDNE: na logikę, o fakty, daty (także dzienne), nazwiska i liczby. Dopuszczalne pytania porównawcze i przyczynowo-skutkowe. |

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
i mówi, **co zrobić** (ADR 0011 pkt 8). Kody są stałe — używa ich test
i diagnostyka; UI pokazuje jeden komunikat bez kodów (ADR 0006 pkt 5
i aneks 2026-09-15d: przycisk „skopiuj poprawkę do modelu" usunięty).

| Kod | Usterka |
| --- | --- |
| `E01` | wycofany 2026-09-15e (ADR 0050): paczka nie ma markera protokołu, a pole `protokol` jest ignorowane |
| `E02` | JSON nieparsowalny (w tym wiele bloków, tekst poza blokiem) |
| `E03` | liczba pytań niezgodna z oczekiwaną z setupu |
| `E04` | `stacja` poza zakresem `1..LICZBA_STACJI` |
| `E05` | stacja bez żadnego pytania (rozkładu między stacje nie sprawdzamy od 2026-09-15f: liczba pytań na stację wynika z setupu — hot-seat `stacje × gracze`, multi 1 na stację: jedno wspólne pytanie na poziomie hosta — a sumę pilnuje `E03`) |
| `E06` | `poprawna` nie jest numerem odpowiedzi `1..4` |
| `E07` | `odpowiedzi` nie ma dokładnie 4 pozycji albo pozycja jest pusta |
| `E08` | powtórzona odpowiedź (po normalizacji: wielkość liter, interpunkcja, białe znaki) |
| `E09` | wycofany 2026-09-17e (PYT/1.3, ADR 0058): paczka nie niesie już źródeł — model ich nie wpisuje |
| `E10` | wycofany 2026-09-17e (PYT/1.3, ADR 0058): jak `E09` — adresów źródeł nie walidujemy, pola nie ma |
| `E11` | wycofany 2026-09-17e (PYT/1.3, ADR 0058): `utworzono` nie jest już w paczce, a `sprawdzono` razem z `zrodla` |
| `E12` | `temat` spoza kanonu §5 |
| `E13` | duplikat pytania (znormalizowana `tresc` występuje więcej niż raz) |
| `E14` | wycofany 2026-09-09 (zakotwiczenie miejscowe jest prośbą w prompcie, nie bramką walidatora — patrz niżej) |
| `E15` | pole wymagane puste albo nie tekstem/liczbą zgodnie z §3 |
| `E16` | paczka niespójna z konfiguracją gry: `okolica` (promień, środek > 500 m) albo `tematy`, `jezyk` (`wiek` wycofane w PYT/1.2 — patrz `E22`) |
| `E17` | współrzędne poza zakresem (`lat`, `lon`) |
| `E18` | wycofany (rev2: 1 pkt za pytanie, pole `punkty` ignorowane) |
| `E19` | `id` pytania nieunikalne albo niezgodne ze wzorem |
| `E20` | `wyjasnienie` krótsze niż 60 znaków albo dosłownie powtarza `tresc` |
| `E21` | pytanie bez pola `poziom` albo z poziomem spoza kanonu (`dzieci`, `dorosli`) — tylko gdy oczekiwane niesie `poziomyPytan` (PYT/1.2, ADR 0055) |
| `E22` | przy jakiejś stacji zestawienie pytań poziomów nie zgadza się z oczekiwanym (np. oczekiwano 1× DZIECKO + 2× DOROŚLI, a stacja ma 3× DOROŚLI) — tylko gdy oczekiwane niesie `poziomyPytan` |

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

- Wersja protokołu jest **wyprowadzana** ze statusu tego pliku i porównywana
  przez test kontraktowy z `WERSJA_PROTOKOLU` w `app/protokol.js` oraz z
  `README.md` — nie wpisuje się jej ręcznie w trzech miejscach. Panel gracza
  jej nie pokazuje (właściciel 2026-09-15).
- Zmiana schematu paczki = podbicie wersji (`PYT/1.1`, `PYT/2.0`) + nowy ADR +
  migrator w `app/migracje.js` + test migracji na fixture'ach starej wersji.
  Paczka użytkownika w `localStorage` nie może przestać działać (ADR 0010 pkt 6).
- Zmiana kosmetyczna szablonu (bez zmiany schematu) = podbicie łatki
  (`PYT/1.0.1`) w `SZABLON_WERSJA` + wpis w `docs/PROJECT_HISTORY.md`.
- **Zapis paczki (nie schemat) zmienia się bez podbijania PYT** — tak z
  kontenerem `TO-paczka/1` → `/2` (ADR 0007) i z jego likwidacją (ADR 0050):
  kształt pól §3.1/§3.2 się nie zmienił. Po pierwszej publikacji Pages (M8)
  każda zmiana **schematu** wymaga migratora i wpisu tutaj; zapisów sprzed
  publikacji nie migrujemy (nie ma paczek użytkownika).
- **Wersje szablonów `PYT/1.0.8` / `PYT/1.0-nofc.3` (2026-09-12, uwagi terenowe
  G.b)** — z zasady 8 usunięto zdania o „NORMALNIE / nie odwracaj”.
- **Koniec kodu pozycyjnego `poprawna` (2026-09-15, ADR 0049)** — numer poprawnej
  odpowiedzi przestał być kodem pozycyjnym. Szablony `PYT/1.0.10` / `PYT/1.0-nofc.5`.
- **PYT/1.1: numer odpowiedzi `1..4`, jedna postać paczki (2026-09-15e, ADR 0050)** —
  `poprawna` to **numer** `1..4` (model i człowiek liczą od 1), marker
  `protokol` i warianty zapisu zniknęły; szablony `PYT/1.1.0` / `PYT/1.1-nofc.0`.
  **Bez migratora** (wyjątek od §7 pkt 2 — na dysku właściciela nie ma ANI
  JEDNEJ paczki tego protokołu): zapis gry z poprzedniej wersji odrzucany
  jawnie (kod `T`).
- **Szablony `PYT/1.1.1`/`PYT/1.1.2` (2026-09-15f)** — kosmetyka trzech zdań
  (reguła 4 o kotwicy, reguła 7 „odpowiedź nie zawiera się w pytaniu”,
  pole `stacja` = ta sama liczba pytań na każdej stacji); schemat bez zmian,
  więc wersja protokołu zostaje `PYT/1.1`. Tolerancja rozkładu zniknęła z
  walidatora: `E05` pilnuje tylko stacji bez pytania (ADR 0050, B25).

- **PYT/1.2: poziomy trudności per gracz (2026-09-17d, uwagi B i C właściciela;
  ADR 0055 + ADR 0056)** — schemat: globalne `wiek` paczki znika, każde
  pytanie niesie `poziom` (`dzieci`/`dorosli`) — poziom jest własnością
  gracza (setup: `gracze[].poziom`) i pytania, nie paczki; walidator pilnuje
  per-stacyjnego zestawienia (`E21`/`E22`, tylko gdy setup niesie
  `poziomyPytan`). Multi: HOST wybiera JEDEN poziom dla całej gry, 1 wspólne
  pytanie na stację (`pytaniaNaStacje = 1`). Dopasowanie paczek: per-poziomowe
  zestawienie + liczba stacji. Szablony `PYT/1.2.1` / `PYT/1.2-nofc.1`.
  **Bez migratora** (faza testów terenowych): paczki bez `poziomu` są dalej
  czytane w grze.
- **PYT/1.3: krótki prompt i koniec źródeł w paczce (2026-09-17e, przegląd
  wygenerowanego promptu, właściciel; ADR 0057 + ADR 0058)** — schemat:
  pytanie nie niesie `zrodla`, paczka nie niesie `utworzono` (model ich nie
  wpisuje; datę nadaje aplikacja sama, `meta.data`). Stare paczki są czytane —
  pola ignorowane, walidacja `E09`/`E10`/`E11` wycofana. Rozróżnienie
  wariantów zostaje: fact-check OBOWIĄZKUJE kwerendę przed faktem (reguła 1
  §2), bez fact-check sprawdzanie nie jest wymuszane (reguła 1 §2.2) — wynik
  kwerendy nie ląduje już w paczce. Prompt: bez meta-komentarzy i listy
  graczy, zestawienie pytań POD KAŻDĄ stacją, bez „data przygotowania”,
  poziom `dzieci` zrelaksowany (bez TRUDNYCH dat, nazwisk i faktów).
  Szablony `PYT/1.3.1` / `PYT/1.3-nofc.1`. **Bez migratora** (faza testów
  terenowych).


## 8. Przykład minimalnej paczki (1 stacja, 1 pytanie)

```json
{
  "okolica": { "lat": 52.23178, "lon": 21.01234, "promienM": 1000, "miejsce": "Śródmieście, Warszawa" },
  "tematy": ["historia"],
  "jezyk": "polski",
  "pytania": [
    {
      "id": "s1p1",
      "stacja": 1,
      "poziom": "dorosli",
      "temat": "historia",
      "tresc": "Przy jakiej ulicy stała pierwsza siedziba Polskiej Agencji Telegraficznej (1918)?",
      "odpowiedzi": ["Bracka", "Mazowiecka", "Zgoda", "Jasna"],
      "poprawna": 3,
      "wyjasnienie": "Pierwsza siedziba PAT mieściła się przy ulicy Zgoda (X 1918)."
    }
  ],
  "uwagi": ""
}
```

Przykład jest ilustracją formatu: fakt przed użyciem w paczce referencyjnej
w repo musi zweryfikować agent (`fetch_page`, ADR 0008 pkt 6).

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
| `zestaw` | `{stacje, paczka PYT/1.1, meta TO-zestaw/2}` | mapa gry + pytania jawnym JSON-em (ADR 0050) |
| `zdarzenia` | `[{kolejnosc, graczId, typ, stacjaId, dane, tSerwera}]` | append-only, `kolejnosc` nadaje most (LockService) |
| `wyniki` | `{graczId: {pseudonim, punkty, poprawne, bledne, czasOdcinkowMs, stacjeZamkniete, zrezygnowal, premia}}` | liczone przez most przy zamknięciu gry; `punkty` zawierają `premia` (ADR 0027 część B) |

Reguły gry: dołączenie tylko w `lobby` — **po starcie nowi gracze nie wchodzą**
(właściciel, 2026-09-11; `listaGier` zwracza wyłącznie `stan: "lobby"`);
start tylko przez organizatora (żeby wystartowała, gra potrzebuje tylko
organizatora — **solo dozwolone**, właściciel 2026-09-11); **host NIE kończy gry
pozostałym** (właściciel 2026-09-13, uwaga G): koniec gry na jego telefonie jest
zdarzeniem `rezygnacja` jak u każdego gracza, a aplikacja nie woła akcji
`gra-zakoncz`. Akcja zostaje w moście dla starszych telefonów (offline'owa
skorupa z Service Workera) i dla ręcznego porządkowania gier na Drive.
**Wspólna Trasa** (`trasa`) i **Wyścig na Orientację** (`wyscig`): w obu KAŻDY
gracz przechodzi wszystkie stacje (w trasie po kolei, w wyścigu w dowolnej
kolejności), a gra domyka się, gdy wszyscy aktywni (niezrezygnowani) zamkną
swoje stacje — rezygnacja też jest sprawdzana pod kątem domknięcia, więc gra nie
zostaje otwarta, gdy wychodzi ostatni aktywny gracz (uwaga G). Punktacja wspólna: 1 pkt za dobrą odpowiedź + premia za
kolejność ukończenia (ADR 0027 część B). Polling w grze co 30 s, w lobby
co 10 s (właściciel, 2026-09-11).

**Wyścig (ADR 0027 część B — wolna kolejność)**: każdy gracz idzie do
WSZYSTKICH stacji w **dowolnej kolejności**, na swoim telefonie i bez
uzgadniania z innymi. Pytanie bierze wg własnego indeksu: pytanie `k` przy
danej stacji należy do gracza `k` (`pytaniaNaStacje = liczbaGraczy`), więc nie
ma wyścigu o pytanie ani blokady przy braku zasięgu; paczka mniejsza niż
liczba graczy dzieli pytanie (indeks zawija się). 1 pkt za poprawną odpowiedź,
bez składnika czasowego (ADR 0023 pkt 1). Gra kończy się, gdy każdy
niezrezygnowany gracz odpowiedział na wszystkich stacjach — wyjście gracza
(także organizatora) wykreśla go z tego warunku (uwaga G).

**Premia za kolejność ukończenia** (aneks właściciela 2026-09-13, uwaga L):
pula = **min(3, grający − 1)**, gdzie „grający" to gracze bez rezygnacji
w momencie zakończenia gry — pierwszy z nich dostaje `pula`, drugi `pula − 1`,
itd. aż do zera: **1 grający → 0 pkt, 2 → 1/0, 3 → 2/1/0, 4 i więcej →
3/2/1/0…**. Odłączeni wcześniej nie liczą się ani do puli, ani do miejsc.
(Wcześniej, aneksem z 2026-09-11, premia była stała 3/2/1 niezależnie od liczby
graczy.) Kolejność bierze się z `kolejnosc` zdarzeń
nadawanej przez most, nie z zegara urządzenia. Rezygnujący (także organizator,
który zakończył grę na swoim telefonie — uwaga G) i gracze niedokończeni premii
nie dostają i nie liczą się do puli; ukończenie wszystkich stacji przed
domknięciem gry premię zachowuje.
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

### 9.3 `RO-lobby/1`

- `RO-lobby/1`: `{ schemat, wpisy: [{ idGry, tryb, stan, miejsce, geohash5,
  geohash8, wiek, tematy, liczbaGraczy, utworzono, organizator }] }` — BEZ
  kodów i BEZ zestawów (prywatność otwartych gier); most zwracza WYŁĄCZNIE
  gry w stanie `lobby` (po starcie nie ma dołączania, właściciel 2026-09-11),
  a aplikacja filtruje po **geohash8** pozycji + sąsiadach (~50 m od hosta,
  `filtrujLobby`; fallback geohash5 dla starych mostów) i dołącza przez
  `idGry`. Wpis w UI pokazuje tylko „Host: <organizator>" — bez miejsca,
  trybu i licznika graczy.
- **`RO-ranking/1` wycofany** (właściciel, 2026-09-11): rankingi usunięte
  z aplikacji i z mostu. Gra kończy się PODSUMOWANIEM na telefonie gracza,
  a na Drive zostaje historia gier (`RO-gra/1` ze stanem `zakonczona`).
  Sam NUMER nie wraca do puli: ranking wrócił 2026-09-12 w nowej, wąskiej
  formie jako **`RO-ranking/2`** (sumy per gracz, bez surowych wierszy gier) —
  patrz §9.7 i ADR 0039.
- `RO-profil/1`: `{ schemat, pseudonim, pin, utworzono }` — plik
  `profil-<id>.json` w katalogu `okolica-profile`; PIN jawnym tekstem
  (ADR 0021). Akcje mostu: `profil-ustaw` (utwórz albo potwierdź),
  `profil-sprawdz` (tylko potwierdź); odmowy kodami R19/R20 w polu `blad`.
  Aplikacja woła wyłącznie `profil-ustaw` — jest bramą tożsamości ekranu 1
  (ADR 0026): zakłada profil albo potwierdza PIN jednym żądaniem.

### 9.4 Kody usterek R01–R20 (`KODY_WIELOOSOBOWE` w `app/wieloosobowa.js`)

Numery wycofanych kodów (R17, R18) zostają zajęte NA STAŁE i nie dostaną nowego
znaczenia — inaczej starszy klient w terenie odczytałby cudzy błąd jako swój
(ten sam powód, dla którego E14 i E18 w pakietach są wycofane).

| Kod | Znaczenie |
|---|---|
| R01 | Stan gry nie jest poprawnym JSON-em. |
| R02 | To nie jest gra schematu `RO-gra/1` (inna wersja aplikacji). |
| R03 | Kod gry niepoprawny (6 znaków z alfabetu bez 0, O, 1, I). |
| R04 | Tryb gry nieznany (oczekiwano `trasa` albo `wyscig`). |
| R05 | Stan gry nieznany (lobby / trwa / zakonczona / archiwum). |
| R06 | Gra nie ma graczy — stan uszkodzony. |
| R07 | Konfiguracja gry niekompletna. |
| R08 | Zestaw gry uszkodzony (stacje / jawna paczka pytań / meta). |
| R09 | Zdarzenia gry uszkodzone (kolejność, gracz, typ, czas serwera). |
| R10 | Zdarzenie nie jest poprawnym JSON-em. |
| R11 | To nie jest zdarzenie schematu `RO-zdarzenie/1`. |
| R12 | Typ zdarzenia nieznany. |
| R13 | Zdarzenie nie wskazuje gry (kod/idGry) albo gracza. |
| R14 | Stacja zdarzenia poza zakresem gry albo zły typ. |
| R15 | Lista lobby nieczytelna albo zły schemat (`RO-lobby/1`). |
| R16 | Część wpisów lobby uszkodzona — odfiltrowane. |
| R17 | **wycofany** — ranking nieczytelny (kody R17/R18 odeszły z `RO-ranking/1`). |
| R18 | **wycofany** — wiersze rankingu uszkodzone. |
| R19 | Nieznany pseudonim (brak pliku profilu). |
| R20 | PIN niepoprawny albo nie pasuje do pseudonimu. |

### 9.5 `gra-opusc` — wyjście z lobby (właściciel, 2026-09-11)

„Dołączanie i wychodzenie w dowolnym momencie" działa w obie strony: wyjście
jest POLECENIEM, nie tylko zamknięciem ekranu. Bez niego wychodzący zostawał
w `gra.gracze`, a `RO-lobby/1` liczy `liczbaGraczy: gracze.length` — lobby
obiecywało gracza, którego już nie było, i odświeżanie listy niczego nie
prostowało.

```json
{ "akcja": "gra-opusc", "kod": "ABC123", "idGry": null, "graczId": "g-2" }
```

- działa WYŁĄCZNIE w stanie `lobby`; po starcie odmawia, bo wyjście w trakcie
  gry to zdarzenie `rezygnacja` (gra trwa, punkty się liczą, a usunięcie gracza
  z rozpoczętej gry sfałszowałoby wynik);
- wyjście gościa: `{ ok: true, zamknieta: false, gra }` — gracz znika ze składu;
- wyjście ORGANIZATORA: `{ ok: true, zamknieta: true }` — gra dostaje stan
  `archiwum` i przenosi się do `okolica-gry-zakonczone` (ta sama droga co
  wygasanie lobby po 24 h). Tylko organizator może wystartować, więc gra bez
  niego nie ma ciągu dalszego;
- aplikacja wysyła polecenie w tle: telefon jest wolny od razu, a niepowodzenie
  jest powiedziane graczowi na głos (LESSONS L6).

### 9.6 `gra-hotseat` — wynik gry z jednego telefonu (ADR 0026 aneks)

Gra na jednym telefonie (hot-seat) nie ma lobby, kodu ani zdarzeń na żywo:
telefon wysyła SKOŃCZONĄ grę jednym poleceniem POST, a most zapisuje ją jako
zwykłą grę `RO-gra/1` ze stanem `zakonczona` w katalogu
`okolica-gry-zakonczone` — historia hot-seat i gier na wielu urządzeniach jest
jedna, bez osobnej ścieżki w aplikacji.

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
- punkty liczy MOST (`przeliczWyniki`), nie telefon: wynik nie zależy
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
ta sama gra nie weszła do historii dwa razy (ADR 0016 pkt 5).

### 9.7 `GET ?akcja=ranking` — `RO-ranking/2` (zgłoszenie właściciela 2026-09-12, ADR 0039)

Ranking wrócił w wąskiej formie („dwie tabele i nic więcej”): „Ranking Punktowy
Graczy” (suma punktów, wszystkie rodzaje gier, max 5 pozycji) i „Mistrzowie
Zagadek” (proporcja poprawnych do zadanych, próg 10 zadanych pytań, max 5).
Most **agreguje** liczniki graczy z katalogu gier zakończonych i oddaje gotowe
sumy — telefon nie dostaje wyników per gra, więc daty, miejsca ani geohashy
innych osób nie opuszczają Drive (ADR 0013/0019 pkt 3, ADR 0039 pkt 4).

```json
{
  "schemat": "RO-ranking/2",
  "gracze": [
    { "pseudonim": "Ala", "punkty": 42, "poprawne": 9, "pytania": 10 },
    { "pseudonim": "Bartek", "punkty": 12, "poprawne": 3, "pytania": 3 }
  ]
}
```

Reguły — wszystkie po stronie mostu (`rankingi()` w
`docs/setup/apps-script-repo-paczek.gs`):

- źródło: katalog `okolica-gry-zakonczone` (`RO-gra/1` ze stanem `zakonczona`)
  — jedno źródło dla hot-seat (§9.6) i gier wieloosobowych (§9.1);
- wiersz gracza powstaje TYLKO wtedy, gdy istnieje jego profil (plik
  `profil-<id>.json`, `RO-profil/1`, ADR 0021) — filtr po `idProfilu(pseudonim)`;
  pseudonim w odpowiedzi pochodzi z PROFILU, więc „ALA” i „ala” to jeden wiersz
  „Ala”; gracze bez potwierdzonego profilu nie wchodzą do tabel;
- `punkty` = suma punktów z gier (w grach wieloosobowych z premią za kolejność,
  ADR 0027 część B; hot-seat premii nie ma);
- `pytania` = `poprawne + bledne`; próg 10 zadanych pytań dla „Mistrzów
  Zagadek” liczy aplikacja (`app/ranking.js`), ale z tych samych liczb — most
  nie zna prezentacji;
- rezygnacja bez ani jednej odpowiedzi nie wchodzi do sum (nie ma wyniku), a
  uszkodzony plik gry albo profilu jest pomijany po cichu: jedna zła gra nie
  psuje całego rankingu;
- brak gier ⇒ `{ "schemat": "RO-ranking/2", "gracze": [] }` — to NIE jest błąd;
- kody R17/R18 pozostają wycofane (§9.4): odpowiedź nie niesie wierszy per gra,
  więc częściowej szkody nie ma jak zgłosić, a nieczytelną odpowiedź aplikacja
  nazywa własnym komunikatem („nie udało się odczytać rankingu”).

Ranking wymaga **nowej wersji wdrożenia** skryptu (`Wdróż → Nowa wersja`):
starsze wdrożenie odpowie na `?akcja=ranking` jak na nieznaną akcję, a warstwa
powie wprost, że nie umie odczytać odpowiedzi (LESSONS L6 — bez ciszy udającej
pusty ranking).
