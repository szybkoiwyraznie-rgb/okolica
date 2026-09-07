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

Szablon jest **jednym źródłem prawdy**: tekst poniżej i stała
`SZABLON_PROMPTU` w `app/protokol.js` muszą być identyczne znak w znak
(pilnuje `test/protokol.test.js`). Placeholdery `{NAZWA}` podstawia
`zbudujPrompt()`; nic innego nie wolno w szablonie zmieniać ręcznie.

<!-- szablon-promptu:start -->
```tekst
Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania o tę okolicę.

ZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):
1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu. Nie opieraj się na pamięci modelu.
2. Każde pytanie ma pole "zrodla" z co najmniej jednym prawdziwym, działającym adresem URL, z którego pochodzi fakt, oraz tytułem źródła i datą sprawdzenia. Faktu, którego nie potrafisz potwierdzić źródłem, NIE UŻYWASZ.
3. Nie wymyślaj nazw, dat, liczb, cytatów, autorów ani adresów. Nie zgaduj i nie uogólniaj. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu "uwagi".
4. Każde pytanie kotwicz na najwęższym możliwym poziomie drabiny: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Wchodź wyżej TYLKO, gdy na węższym nie ma sensownego potwierdzonego faktu (jeden fakt = najniższy poziom). Od poziomu miejscowości nazwa miejsca MUSI paść w treści pytania; poziom świat tylko z jawnym haczykiem do tej okolicy (postać, wydarzenie albo zjawisko stąd). Czyste pytania ogólne bez kotwicy są zakazane.
5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.
6. Odpowiedź zwróć WYŁĄCZNIE jako jeden blok kodu json ze schematem podanym niżej. Bez komentarzy, bez wstępu, bez podsumowania, bez drugiego bloku.
7. Treść pytania nie może zdradzać odpowiedzi (na przykład roku w pytaniu o rok).
8. Pola "tresc", "odpowiedzi", "wyjasnienie", "uwagi" oraz "tytul" w każdym źródle zapisz ODWRÓCONE ZNAKAMI (czytane od końca — na przykład "Kot" jako "toK"), pole "poprawna" zapisz SŁOWNIE po polsku i ODWRÓĆ (patrz wymagania), a w polu "protokol" wpisz "PYT/1.0-rev2". Schemat niżej pokazuje KSZTAŁT odpowiedzi, ale wartości tych pól odwracasz. Na końcu ODCZYTAJ każde odwrócone pole od końca i sprawdź, czy po odwróceniu z powrotem zdanie jest poprawne — błąd w odwróceniu unieważnia odpowiedź (samokontrola).

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

SCHEMAT ODPOWIEDZI (PYT/1.0-rev2) — dokładnie te pola:
{
  "protokol": "PYT/1.0-rev2",
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
      "poprawna": "awd",
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
- "poprawna": numer poprawnej odpowiedzi SŁOWNIE po polsku i ODWRÓCONY: 1 → "nedej", 2 → "awd", 3 → "yzrt", 4 → "yretzc".
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
| `{PROMIEN_M}` | promień gry w metrach | setup, z domyślnej wartości trybu (ADR 0003/§4.2) |
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

## 3. Schemat paczki PYT/1.0

### 3.1 Poziom paczki

| Pole | Typ | Wymagane | Zasady |
| --- | --- | --- | --- |
| `protokol` | tekst | tak | `"PYT/1.0"` albo `"PYT/1.0-rev1"` (wariant odwrócony, §3.4) |
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
| `poprawna` | liczba albo tekst | jawna i rev1: `0..3`; rev2: odwrócone słowo (`nedej`/`awd`/`yzrt`/`yretzc` = odpowiedź 1–4; liczba też przejdzie) |
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

**Wariant `PYT/1.0-rev2`.** Jak rev1, a ponadto: `poprawna` to numer odpowiedzi słownie i od końca (`1→nedej, 2→awd, 3→yzrt, 4→yretzc` — nie da się ściągnąć zerknięciem), a pola `punkty` nie ma (każde pytanie daje 1 pkt). Walidator przyjmie liczbę w `poprawna` także w rev2, a `punkty` ignoruje wszędzie; szablon z §2 generuje rev2.


## 4. Kategorie wiekowe i wymagania trudności

Klucz kategorii jest wartością pola `wiek`; tekst z kolumny „opis trudności"
trafia do promptu jako `{OPIS_TRUDNOSCI}`. **Obniżenie trudności nie zwalnia
z wymogu źródła** (ADR 0008 pkt 7).

| Klucz | Etykieta | Opis trudności (do promptu) |
| --- | --- | --- |
| `7` | 7 lat | Zdania krótkie, do 15 słów. Słownictwo codzienne, bez terminów specjalistycznych. Jedno pytanie = jeden fakt. Odpowiedzi rzeczowe i nazwy, bez dat i liczb wielocyfrowych. Preferowane pytania o rzeczy, które dziecko może zobaczyć albo zna z spaceru. |
| `10` | 10 lat | Zdania do 20 słów. Pojęcia proste, jedno pojęcie specjalistyczne na pytanie dopuszczalne, jeśli wyjaśnienie je tłumaczy. Jedna data albo jedna liczba w pytaniu dopuszczalna. |
| `12` | 12 lat | Pełne zdania, terminy z objaśnieniem w wyjaśnieniu. Daty, liczby i porównania dopuszczalne. Pytanie może wymagać dwóch kroków rozumowania. |
| `15` | 15 lat | Jak dla dorosłych, ale bez żargonu akademickiego i bez pytań wymagających wiedzy specjalistycznej z poziomu studiów. |
| `dorosli` | dorośli | Bez ograniczeń długości i słownictwa. Dopuszczalne pytania porównawcze, przyczynowo-skutkowe i o szczegóły (daty dzienne, nazwiska, liczby). |

## 5. Kanon tematów

Klucze: małe litery, myślniki, bez spacji. Nowy temat = dopisanie do tej
tabeli, do `TEMATY` w `app/konfig.js` i do opisu w promptcie — w tym samym
commicie (AGENTS.md §3).

| Klucz | Etykieta | Opis do promptu |
| --- | --- | --- |
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
| `E06` | `poprawna` poza zakresem albo (rev2) nieznane słowo |
| `E07` | `odpowiedzi` nie ma dokładnie 4 pozycji albo pozycja jest pusta |
| `E08` | powtórzona odpowiedź (po normalizacji: wielkość liter, interpunkcja, białe znaki) |
| `E09` | pytanie bez `zrodla` albo lista pusta |
| `E10` | `zrodla[].url` nie jest adresem `http(s)` albo jest adresem zabronionym: domena przykładowa (`example.com`, `przyklad.org`, `twojastrona.pl`) albo zarezerwowane TLD (`.invalid`, `.test`, `.localhost`, `.example`, `.local`) |
| `E11` | data (`utworzono`, `sprawdzono`) w przyszłości albo w złym formacie |
| `E12` | `temat` spoza kanonu §5 |
| `E13` | duplikat pytania (znormalizowana `tresc` występuje więcej niż raz) |
| `E14` | brak zakotwiczenia miejscowego: ani `tresc`, ani `wyjasnienie` nie odnosi się do miejsca z `okolica.miejsce` ani do nazwy/opisu stacji |
| `E15` | pole wymagane puste albo nie tekstem/liczbą zgodnie z §3 |
| `E16` | paczka niespójna z konfiguracją gry: `okolica` (promień, środek > 500 m) albo `wiek`, `tematy`, `jezyk` |
| `E17` | współrzędne poza zakresem (`lat`, `lon`) |
| `E18` | wycofany (rev2: 1 pkt za pytanie, pole `punkty` ignorowane) |
| `E19` | `id` pytania nieunikalne albo niezgodne ze wzorem |
| `E20` | `wyjasnienie` krótsze niż 60 znaków albo dosłownie powtarza `tresc` |

**Heurystyka zakotwiczenia (E14)** — cztery kroki, wszystkie w
`app/protokol.js`, wszystkie testowane:

1. **Tokeny własne**: nazwy z `okolica.miejsce` (rozbite po przecinkach i
   spacjach) oraz z `opis`-ów stacji. Odrzucane są: wyrazy krótsze niż 4 znaki,
   liczby, słowa z listy ogólnej (`TOKENY_MIEJSCA`) i wyrazy pospolite nazw
   administracyjnych (`WYRAZY_POSPOLITE_MIEJSCA`: „stare", „miasto", „gmina",
   „polska"…). Nazwy regionów („mazowieckie") zostają — pytanie o Mazowsze jest
   uczciwie zakotwiczone.
2. **Rdzeń tokena** = pierwsze 5 znaków po normalizacji (małe litery, bez
   interpunkcji), więc obejmuje polską odmianę: „Warszawa" → „warsz" trafia w
   „warszawskim". Rdzeń musi pasować do **początku wyrazu** w pytaniu — inaczej
   „kościół" → „kości" łapałoby „ludzkości", a „woj." → „woj" łapałoby „wojna".
   Trafienie w którykolwiek token własny kończy sprawdzenie wynikiem
   „zakotwiczone".
3. Jeśli trafienia nie ma, pytanie może przejść warunkowo: musi zawierać słowo z
   listy lokalnej (`TOKENY_MIEJSCA`: „ulica", „rynek", „kościół", „most",
   „kamienica"…) **oraz** nazwę własną.
4. **Nazwa własna** = wyraz pisany wielką literą, który nie zaczyna zdania (po
   polsku każde zdanie zaczyna się wielką literą), nie jest słowem pospolitym
   (`SLOWA_POSPOLITE`) i nie idzie za kropką innego zdania — z wyjątkiem
   skrótów z listy `SKROTY_Z_KROPKA`, bo „kościół św. Anny" to jedna nazwa, nie
   dwa zdania.

Heurystyka jest celowo nadmiernie wyłapująca: fałszywe odrzucenie (E14) naprawia
się jednym zdaniem o miejscu w treści pytania, a przepuszczenie pytania
ogólnego („kto napisał Pana Tadeusza?") psuje sens gry terenowej. Listy słów są
dane, nie decyzje sesji — ich zmiana idzie przez kod, test i commit.

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
- **Wariant `PYT/1.0-rev2`** — `poprawna` słownie od końca, koniec pola
  `punkty` (§3.4). Jak rev1: zapis, nie nowa wersja; walidator przyjmuje
  `PYT/1.0`, `-rev1` i `-rev2`, szablon generuje rev2. Dawne paczki działają
  bez migratora (M8 nieopublikowany, a reguły i tak łagodnieją).

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

### 9.1 `RO-gra/1` — stan gry (plik JSON w katalogu gier)

| Pole | Typ / zakres | Uwagi |
|---|---|---|
| `schemat` | `"RO-gra/1"` | stała |
| `kod` | 6 znaków | alfabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (bez 0/O/1/I) |
| `idGry` | string | id pliku Drive; lobby odsyła je graczom |
| `tryb` | `"wyscig"` \| `"tury"` | wybrany przy założeniu, niezmienny |
| `stan` | `lobby` \| `trwa` \| `zakonczona` \| `archiwum` | otwarta gra bez startu → `archiwum` po 24 h |
| `utworzono` | ISO 8601 | |
| `organizatorId` | `"g-1"` | założyciel; tylko on startuje i kończy przedwcześnie |
| `gracze` | `[{id: "g-N", pseudonim, dolaczyl}]` | maks. 8, pseudonim ≤24 znaków, unikalny w grze |
| `konfiguracja` | `{liczbaStacji, pytaniaNaStacje, wiek, tematy, promienM, miejsce, geohash5}` | geohash5 = przybliżenie okolicy (nigdy punkt gracza) |
| `zestaw` | `{stacje, kontener TO-paczka/2, meta TO-zestaw/1}` | mapa gry + ukryte pytania (ADR 0007) |
| `zdarzenia` | `[{kolejnosc, graczId, typ, stacjaId, dane, tSerwera}]` | append-only, `kolejnosc` nadaje most (LockService) |
| `wyniki` | `{graczId: {pseudonim, punkty, poprawne, bledne, stacjeZamkniete, zrezygnowal}}` | liczone przez most przy zamknięciu gry |

Reguły gry: dołączenie tylko w `lobby`; start tylko przez organizatora.
**Tury**: stacja `i` (1-based) należy NA STAŁE do gracza `gracze[(i-1) % N]`
— kolejka jest ustalona przy starcie i **nie przesuwa się**; rezygnacja gracza
**pomija** jego stacje (nie zawęża kolejki — zawężenie przemapowałoby stacje
między graczami w trakcie gry i rozjechałoby pytania z kontenera). Wyścig:
wszyscy idą wszystkie stacje jednocześnie; gra kończy się, gdy każdy
niezrezygnowany gracz odpowiedział na wszystkich stacjach.

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
  w turach `biezacyGraczTury(gra) === graczId` (odmowa: „teraz jest tura
  gracza g-N"), `dojscie` przed `odpowiedz` na danej stacji, bez duplikatów,
  `stacjaId` w zakresie `1..liczbaStacji`. Odmowa wraca jako `{ok:false, blad}`
  i NIE jest ponawiana przez `app/sync.js` (awaria sieci — przeciwnie: ląduje
  w kolejce offline i wychodzi FIFO po powrocie połączenia).

### 9.3 `RO-lobby/1` i `RO-ranking/1`

- `RO-lobby/1`: `{ schemat, wpisy: [{ idGry, tryb, stan, miejsce, geohash5,
  wiek, tematy, liczbaGraczy, utworzono, organizator }] }` — BEZ kodów i BEZ
  zestawów (prywatność otwartych gier); aplikacja filtruje po geohash5
  pozycji + 8 sąsiadach (`filtrujLobby`) i dołącza przez `idGry`.
- `RO-ranking/1`: `{ schemat, wiersze: [{ pseudonim, punkty, poprawne, bledne,
  czasOdcinkowMs, stacjeZamkniete, data, tryb, miejsce, geohash5, wiek,
  tematy }] }` — surowe wiersze z gier zakończonych (rezygnacja bez wyniku nie
  wchodzi); agregacje (ogólny/wiek/tematy/lokalizacja) liczy telefon:
  `agregujRanking`, `kategorieRankingu` (ADR 0019 pkt 7).
- `RO-profil/1`: `{ schemat, pseudonim, pin, utworzono }` — plik
  `profil-<id>.json` w katalogu `okolica-profile`; PIN jawnym tekstem
  (ADR 0021). Akcje mostu: `profil-ustaw` (utwórz albo potwierdź),
  `profil-sprawdz` (tylko potwierdź); odmowy kodami R19/R20 w polu `blad`.

### 9.4 Kody usterek R01–R20 (`KODY_WIELOOSOBOWE` w `app/wieloosobowa.js`)

| Kod | Znaczenie |
|---|---|
| R01 | Stan gry nie jest poprawnym JSON-em. |
| R02 | To nie jest gra schematu `RO-gra/1` (inna wersja aplikacji). |
| R03 | Kod gry niepoprawny (6 znaków z alfabetu bez 0, O, 1, I). |
| R04 | Tryb gry nieznany (oczekiwano `wyscig` albo `tury`). |
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
