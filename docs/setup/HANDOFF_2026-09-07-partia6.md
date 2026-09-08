# HANDOFF 2026-09-07 (partia 6) — cztery uwagi właściciela po partii 5

> Stan na koniec sesji. Dokument jednorazowy (`AGENTS.md` §5): reguły trwałe są
> w ADR-ach, protokole, `LESSONS.md` i `ASSETS.md` — tutaj tylko co zrobione,
> jak to uruchomić, co dalej i co wisi.

## 1. Co ta sesja zrobiła

| # | Uwaga właściciela | Co z tego wyszło | Commit |
|---|---|---|---|
| 1 | Paczki „znajdują się" wiele kilometrów od miejsca wygenerowania | **Dopasowanie było poprawne** — zmierzone: paczka z Podkowy przy pozycji w Łodzi to 97 km od komórki paczki przy tolerancji 200 m, czyli 0 dopasowań. Winny był komunikat, który liczył cały indeks. Teraz paczki spoza okolicy nie są liczone ani wspominane | (commit 1) |
| 2 | Promień nie powinien być kryterium; komunikat ma mówić CO nie pasuje | `promienM` wypadł z kryteriów (aneks ADR 0024); `powodyNiedopasowania()` w `app/zestawy.js` jest jedynym rozstrzygającym miejscem, a karta paczek cytuje powody | (commit 1) |
| 3 | Imię gracza i „Usuń" za małe i sklejone | `#lista-graczy li`: 17 px, `gap: 16px`, `padding: 12px 0`; przycisk 15 px, `nowrap` | (commit 1) |
| 4 | Checkbox zgody na zapis wyniku ma zniknąć | Usunięty; zapis jest domyślny, a sekcja prywatność dostała kartę „Wspólny Drive: historia i rankingi" (dopisek do aneksu ADR 0026) | (commit 1) |
| — | Dokumenty + cache-bust | PROTOKOL §9.5, BACKLOG B22, instrukcja wdrożenia, PROJECT_HISTORY, `?v=m12-15` | (commit 2) |
| 5 | Kryteria paczki: miejsce ±200 m, wiek, **ilość pytań w sumie**, tematy nie szersze (liczba stacji i transport wypadają) | `sumaPytanWpisu()` + `powodyNiedopasowania()` w `app/zestawy.js`; paczka z większą liczbą pytań też pasuje; aneks ADR 0024 | (commit 3) |
| 6 | Checkbox zgody ma zniknąć **także** z gry wieloosobowej, a wszystko ma być opisane w prywatności | `#multi-zgoda` i `okolica:multi:zgoda` usunięte; sekcja prywatności dostała „Gra na wielu telefonach" i „Paczki pytań"; dopisek do ADR 0019 | (commit 3) |
| 7 | Błąd: setup 5 stacji, ekran stacji pokazał 4, ekran pytań `[WE06] … (4) nie zgadza się z konfiguracją (5)` | Sieć słusznie dała 4 (S12), ale setup zostawał przy 5 — teraz setup idzie za wyborem, promień liczy się od nowa, a ekran mówi dlaczego i jak zwiększyć promień (§5) | (commit 3) |
| — | Dokumenty + cache-bust (runda 2) | ADR 0019 dopisek, ADR 0024 uzupełnienie, PROTOKOL §9, instrukcja, PROJECT_HISTORY, `?v=m12-16` | (commit 4) |

**Brama na koniec partii:** `npm run brama` = **610 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-23` (43 miejsca
+ `WERSJA_SW`). Stan z 2026-09-08: doszły oceny pytań w interfejsie (ADR 0028),
ADR 0029 i ADR 0030 — szczegóły w `docs/PROJECT_HISTORY.md`.

## 2. Co wisi

1. **Wklejenie skryptu mostu — sprawdź, którą wersję masz w Apps Script.**
   Partia 6 skryptu NIE ruszała (`git log cfc357a^..HEAD -- docs/setup/apps-script-repo-paczek.gs`
   = puste); ostatnia zmiana to `72fb2a3` z partii 5. Właściciel potwierdził,
   że wersję z geohash wkleił wcześniej, więc do sprawdzenia zostaje to, co po
   niej:

   | commit | linie | md5 (początek) | co dodaje | marker w Apps Script |
   |---|---|---|---|---|
   | `f06ee55` (main) | 721 | `f5dee86d` | — | — |
   | `2b46aca` B19 | 798 | `924671bf` | kotwica geohash6 dla starych paczek | `function geohashPunkt`, `function kotwicaZestawu` |
   | `cc50f14` premia | 842 | `d74367b0` | premia za kolejność (pierwszy G−1, ostatni 0) | `function premiaZaKolejnosc` |
   | `72fb2a3` gra-hotseat | 963 | `01e1d9bd` | akcja `gra-hotseat` (wynik z jednego telefonu) | `case 'gra-hotseat'`, `function przyjmijGreHotseat` |
   | poprawka literówki (§9) | 963 | `7d8cb9f2` | `paczkaPrzezId` przestaje rzucać ReferenceError | `const wZaakceptowane =` w `paczkaPrzezId` |

   Czyli mając wersję geohash (798 linii), brakuje **premii i `gra-hotseat`**
   (+167 linii). Objaw bez `gra-hotseat`: most odpowiada
   `{ok:false, blad:"nieznana akcja albo schemat ciała"}`, a wynik hot-seat
   czeka w kolejce `okolica:hotseat-kolejka` i jest ponawiany przy każdym
   uruchomieniu. Od partii 6 ten komunikat jest jawny (patrz §8).
   Kroki wklejenia: `docs/setup/most-drive-instrukcja.md` → „Awaryjnie".
2. **Kryteria dopasowania paczki — ROZSTRZYGNIONE (odpowiedź właściciela,
   ten sam dzień).** Zostają cztery: **okolica ±200 m · wiek · tematy nie
   szersze niż setup · suma pytań co najmniej jak w setupie.**
   - „istotna jest ilość pytań w sumie, a nie ilość pytań na stację" — paczka
     2×10 pasuje do setupu 5×4 (oba = 20 pytań); paczka może mieć **więcej**
     pytań niż setup („Wystarczy, że ma nie mniej").
   - **liczba stacji wypada** z kryteriów („Liczba stacji jest nieistotna o ile
     suma pytań się zgadza"),
   - **tematy zostają** („Z tych dwóch o które pytasz ma zostać tylko tematy
     nie szersze"),
   - **środek transportu wypada** (właściciel wycofał „dodaj").
   Kod: `sumaPytanWpisu()` + `powodyNiedopasowania()` w `app/zestawy.js`,
   aneks ADR 0024; testy `test/zestawy.test.js`, `test/zestawy-ui.test.js`.
   Skryptu mostu to NIE dotyka — dopasowanie liczy się w aplikacji.
3. **Checkbox zgody zniknął też z gry wieloosobowej** (`#multi-zgoda`,
   `okolica:multi:zgoda`) — dopisek do ADR 0019, wszystko opisane w sekcji
   „Dane i prywatność" (nowy punkt „Gra na wielu telefonach"). Schematy `RO-*`
   nigdy nie miały pola `zgoda`, więc most i protokół bez zmian.
4. **Naprawiony błąd „4 stacje zamiast 5 → WE06"** (patrz §5).

## 5. Zgłoszony błąd: 4 stacje zamiast 5 i „prompt nie został zbudowany" [WE06]

**Objaw u właściciela:** gra wieloosobowa, 2 graczy, setup 5 stacji, ekran 3
pokazał 4, ekran pytań: `prompt nie został zbudowany` /
`[WE06] liczbaStacji: Liczba stacji (4) nie zgadza się z konfiguracją (5).`

**Przyczyna (dwie części):**
- `wybierzStacje()` (`app/stacje.js`) **uczciwie** oddaje mniej stacji niż
  zamówione, gdy sieć nie pozwala zachować odstępów: greedy dobiera węzły póki
  znajdzie taki poza `minimalnyOdstepM` i spoza korytarza już wybranych, a jak
  takich braknie — pętla się kończy. Wyrównanie odległości działa tylko przy
  `wybrane.length === liczbaStacji`. To znany kod **S12**.
- Ekran pytań patrzył na **setup, nie na mapę**: `przeliczZTegoCoJest()`
  zostawiał `liczbaStacji = 5`, więc `budujPrompt()` trafiał w niezmiennik
  WE06 (`app/protokol.js`) i nic nie dało się wygenerować.

**Naprawa — to, co wybrano, jest grą:** przy mniejszej liczbie setup dostaje
tyle stacji, ile stanęło na mapie, `#setup-stacje` jest aktualizowane, promień
liczy się z nowej liczby (ADR 0025: ten sam czas gry na mniej stacji = dłuższy
odcinek), a ekran stacji mówi wprost:
„Sieć drogowa w tej okolicy nie dała 5 stacji w wymaganych odstępach — jest
ich 4 i tyle będzie w grze (setup zmieniony na 4). Chcesz 5? Zwiększ czas gry,
żeby powiększyć promień, albo zmień okolicę." (S12)

WE06 zostaje jako strażnik spójności, ale z UI nie powinien być osiągalny.
Test: `test/aplikacja.test.js` → „sieć za uboga na zamówioną liczbę — setup
idzie za wyborem, a prompt się buduje (S12)".

## 6. Jak to sprawdzić

```bash
npm test          # 571 testów
npm run brama     # testy + sync szablonu + audyt WCAG AA
npm run serwer    # podgląd 0.0.0.0:8000 (360 px)
```

- Ekran 2 z pozycją w innej miejscowości: karta mówi „Repozytorium nie ma
  paczek dla tej okolicy — nowe pytania przygotuje model." (bez „w indeksie: N").
- Ekran 2 z paczką w okolicy o innej liczbie stacji: „W tej okolicy jest 1
  paczka, ale nie pasuje: Podkowa Leśna — liczba stacji: paczka 5, setup 3."
- Ekran 1: lista graczy z dużym imieniem i wyraźnym odstępem do „✕ Usuń";
  pod listą nie ma już checkboxa zgody.

## 7. Ryzyka i pułapki

- Paczka o promieniu większym niż setup może być teraz zaproponowana (promień
  nie jest kryterium). Gracz widzi odległości stacji przed startem, a czas gry
  i tak przelicza się na promień (ADR 0025) — ale warto to obejrzeć w terenie.
- `dopasujZestawy` nadal przyjmuje `promienM` w kryteriach (sygnatura bez
  zmian, testy i wywołania nietknięte) — pole jest po prostu ignorowane.
- Wynik gry nie jedzie na Drive, gdy żaden gracz nie ma potwierdzonego profilu
  (np. cały czas bez zasięgu) — `#wynik-drive` mówi to wprost.

## 8. Dopisek: jawna odmowa mostu nie udaje awarii sieci

`polecenieMostu()` (`app/sync.js`) rzuca Error z `odmowaMostu = true`, gdy most
odpowie `{ok:false, …}` — kontrakt mówi „nie ponawiać". `wyslijWynikHotseat()`
i `oproznijKolejkeHotseat()` łapały każdy błąd tak samo i pisały „Drive nie
odpowiedział", więc przy starszym skrypcie w Apps Script gracz dostawał fałszywą
diagnozę, a kolejka mieliła w nieskończoność bez słowa wyjaśnienia.

Teraz oba miejsca rozróżniają przypadki (kolejka zostaje w obu — po wklejeniu
aktualnego skryptu wyniki same dojdą):
- `#wynik-drive`: „Wynik został na telefonie — most Drive odmówił: <odpowiedź
  mostu>. Wynik czeka w kolejce i poleci, gdy most przyjmie akcję gra-hotseat
  (w Apps Script potrzebna jest aktualna wersja skryptu).";
- `#status` przy starcie: „Most Drive odmówił przyjęcia N wyników z kolejki:
  <odpowiedź>. Zostaną ponowione przy następnym uruchomieniu…".

Test: „hot-seat: jawna odmowa mostu nie udaje awarii sieci — komunikat nazywa
powód" (`test/aplikacja.test.js`) — bez poprawki pada na pierwszej asercji.
Brama: **576 testów, 0 fail**; cache-bust `?v=m12-18` + `WERSJA_SW`.

## 9. Zgłoszony błąd: „Graj z tą paczką" → „Plik publiczny ma inny schemat niż TO-zestaw/1"

**Objaw:** na ekranie 2 pasująca paczka z repozytorium, po kliknięciu stopka mówi
„Paczka z repozytorium jest niekompletna (Plik publiczny ma inny schemat niż
„TO-zestaw/1”.) — gramy zwykłą ścieżką."

**Przyczyna (literówka w skrypcie mostu, nie w paczce):**

```js
const wZaakceptowanych = rodzice.hasNext() && rodzice.next().getName() === FOLDERY.zaakceptowane;
if (!wZaakceptowane) return { blad: 'ta paczka nie jest zaakceptowana' };  // ← czyta inną nazwę
```

`ReferenceError` przy każdym pobraniu paczki; `doGet` łapie wyjątek i odpowiada
`{blad:"wZaakceptowane is not defined"}`, a aplikacja — widząc JSON bez `schemat`
— mówiła „inny schemat" (Z07). Paczka na Drive była w porządku.

**Naprawa:** jedna litera w `.gs` (`const wZaakceptowane =`), czyli **jedna linia
do poprawienia we wklejonym skrypcie**; plik ma teraz 963 linie i md5
`7d8cb9f2c9ce051d89621c0db5725cd2`.

**Dwie rzeczy, żeby to nie wróciło:**
- `test/most-paczka.test.js` — WYKONUJE tekst `.gs` na atrapie Drive i przechodzi
  całą drogę: przyjęcie → akceptacja → indeks → pobranie → walidacja po stronie
  aplikacji (plus przegląd wszystkich akcji z asercją „brak `is not defined`").
  Bez naprawy pada; wcześniej ścieżka paczki nie była wykonywana w żadnym teście.
- Aplikacja nie chowa już odpowiedzi mostu: `{blad:…}` jest cytowane wprost
  (nowy kod **Z11**: „Most Drive nie wydał paczki: <powód>"), więc następna taka
  awaria pokaże prawdziwy powód na ekranie. LESSONS L33.

## 10. B21 zmierzone: budżet promptu i odpowiedzi dla 40 pytań

Właściciel: „jeśli masz jeszcze jakieś zadania w roadmapie, to jest najlepszy
moment, bo nie mam teraz czasu testować" — wzięte zostało jedyne wprost otwarte
zadanie (B21, „zostało do sprawdzenia" po B20), które mierzy się testami bez
terenu i nie dotyka skryptu mostu.

Pomiar (realistyczny fikstur rev2, `test/duza-paczka.test.js`):

| | 5 pytań | 40 pytań (5 stacji × 8 graczy) |
|---|---|---|
| prompt | 5 422 zn / ~1 356 tok | 5 423 zn / ~1 356 tok (stały) |
| odpowiedź | 4 469 zn / ~1 118 tok | 33 392 zn / ~8 348 tok |
| parser + walidacja | OK, 0 usterek | OK, 0 usterek |
| kontener | 4,8 kB | 35,6 kB (1,8% budżetu stanu) |

Wdrożone: `szacunekOdpowiedzi()` i `PROG_ODPOWIEDZI_TOKENY = 4000` w
`app/protokol.js`, linia `#prompt-rozmiar` na ekranie pytań (poza zwiniętym
`<details>`, więc widoczna) z ostrzeżeniem powyżej progu. **Do obejrzenia na
telefonie przy okazji**: czy ta linia nie rozjeżdża układu na 360 px.

Do decyzji właściciela: dzielenie generacji na partie (po jednej stacji) —
opis w `docs/BACKLOG.md` B21.

## 12. Oceny pytań przez graczy (ADR 0028) — stan na 2026-09-08

Zlecenie właściciela: kciuk w górę/dół przy pytaniu, jeden głos na gracza
i pytanie, wysyłka w tle, a na ekranie 2 „użyta w X grach · % na tak · % na nie".

**Zrobione i zielone:**
- ADR 0028 (Zaakceptowana) + rejestr.
- `app/oceny.js` — czysty model: slug głosującego (lustro `idProfilu`, parzystość
  testowana przez wykonanie obu implementacji), `idGlosujacego`, `ocenPytanie`
  (drugi klik = O03 i nic nie leci w sieć), kolejka wysyłki, walidacje i polski
  tekst statystyk.
- Most: katalog `okolica-oceny-paczek`, plik `RO-oceny/1` na paczkę, akcje
  `ocena` i `uzycie`, `podsumowanieOcen` w `budujIndeks`. Testy wykonują `.gs`.

**Czeka (następny krok):** panel z dwiema ikonami w `index.html` +rysowanie w
`renderujPytanie()` (ten sam slot po odpowiedzi), wysyłka w tle z kolejką
`okolica:oceny-kolejka`, ping `uzycie` po pobraniu paczki z repo (id paczki jest
w `grajZZestawemZRepo` jako `wpis.id`), statystyki w `walidujIndeksSurowy`
i na ekranie 2, cache-bust.

**Do wklejenia przez właściciela:** `.gs` urósł do 1093 wierszy
(md5 `620f28c734136654d9a4a01ebfe7853b`) — wdrożenie ISTNIEJĄCYM wdrożeniem
(Wdróż → Zarządzaj wdrożeniami → ołówek → „Nowa wersja" → Wdróż), bo „Nowe
wdrożenie" daje nowy adres i łamie ADR 0020. Instrukcja z pełną treścią pójdzie
w czacie razem z gotową aplikacją, żeby wklejać raz.

