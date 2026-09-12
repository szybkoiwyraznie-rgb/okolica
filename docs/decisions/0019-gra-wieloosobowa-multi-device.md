# 0019 — Gra wieloosobowa na wielu urządzeniach przez Drive: lobby + kod, wyścig i tury, rankingi

> **Stan na 2026-09-11 (m12-78)**: flow przepisany po raz drugi — segment
> „załóż/dołącz" na SETUPIE, dołączanie tylko z listy ~50 m (bez kodów), paczka
> przed lobby ze WSPÓLNEJ ścieżki, kanał info i koniec gry z ręki hosta.
> **Rankingi usunięte w całości** (aneks 2026-09-11b) — tytuł ADR jest
> historyczny, obowiązujący kształt definiuje **ostatni aneks na końcu**.

- Status: Zaakceptowana
- Data: 2026-09-06

## Kontekst

Decyzje właściciela z 2026-09-06 (po M10, w rozwinięciu ADR 0018):

1. **Parowanie**: lobby z grami w najbliższej okolicy ALBO kod — **obie opcje**.
2. **Model rozgrywki**: **oba tryby** — wyścig równoległy i tury asynchroniczne.
3. **Dane graczy (M12)**: pseudonim + wyniki + pełna historia + rankingi także
   w kategoriach wiekowych, tematycznych i lokalizacyjnych — „o ile to jest
   sensownie do ogarnięcia".

Siły: aplikacja statyczna bez własnego serwera (ADR 0001) — synchronizacja
wyłącznie przez most Apps Script (ADR 0016); prywatność współrzędnych
(ADR 0013); limity Apps Script (quota URL fetch/wykonania); gra dla
właściciela i kilku znajomych, nie dla tłumu (BACKLOG B17).

## Decyzja

1. **Parowanie dwiema drogami do tej samej gry**:
   - **Lobby**: most zwraca listę OTWARTYCH gier z `geohash5` i `miejsce`
     okolicy; aplikacja filtruje po swojej pozycji (geohash5 + sąsiednie
     komórki — ten sam mechanizm co przy zestawach pytań, ADR 0017) i pokazuje
     gry „w najbliższej okolicy" z odległością; dołączenie kliknięciem.
   - **Kod gry**: 6 znaków generowanych po stronie mostu (alfabet bez
     mylących 0/O/1/I), organizator przekazuje go dowolnym kanałem
     (słownie, komunikatorem); dołączenie przez wpisanie kodu.
2. **Tryby rozgrywki** (wybór organizatora przy zakładaniu):
   - `wyscig` — wszyscy idą do tych samych stacji jednocześnie, każdy na
     swoim urządzeniu; wygrywają czas + punkty (model punktacji ADR 0014 per
     gracz);
   - `tury` — kolejka graczy jak w hot-seat (ADR 0009), ale każdy realizuje
     swoją turę na swoim urządzeniu po przejęciu gry (most pilnuje, czyja
     teraz tura).
   Hot-seat na jednym telefonie zostaje jako tryb offline (aneks ADR 0009).
3. **Prywatność (rewizja zakresu ADR 0013)**: współrzędne GPS NIGDY nie
   wychodzą na Drive — pozycja jest liczona lokalnie, a do gry synchronizowane
   są wyłącznie ZDARZENIA: dojście do stacji N (id stacji, czas odcinka, tryb
   dojścia), odpowiedź (poprawna/błędna, punkty, czas), rezygnacja, znaczniki
   czasu. Nowe dane opuszczające urządzenie (pseudonim, wyniki) = jawna zgoda
   przy zakładaniu/dołączaniu do gry (wzorzec zgody z M9b/D3: checkbox, ale tu
   WYMAGANY do gry wieloosobowej — bez niego gra na wielu urządzeniach nie
   istnieje).
4. **Model zaufania**: BRAK antycheatu — gra prywatna dla znajomych
   (właściciel: „tylko ja będę z tego korzystał" + kilku znajomych, B17).
   Punktacja liczona na urządzeniu; most waliduje jedynie spójność: kolejność
   tur (tryb `tury`), numer stacji w zakresie zestawu, monotoniczność czasów,
   pseudonim niepusty. Stan gry na Drive jest źródłem prawdy dla kolejności
   i wyników zbiorczych.
5. **M12 — profil i rankingi**: pseudonim trzymany lokalnie
   (`okolica:pseudonim`, edytowalny), wysyłany ze zdarzeniami; historia gier
   (zakończone `RO-gra/1` na Drive); rankingi liczone przez most z gier
   zakończonych: ogólny + kategorie **wiek** (z konfiguracji gry), **tematy**
   (z konfiguracji) i **lokalizacja** (`geohash5`/`miejsce` — np. „najlepsi
   w Podkowie Leśnej"). To jest sensownie do ogarnięcia przy skali kilku
   graczy: ranking = agregacja po polach meta gry, bez osobnej bazy.
6. **Quota Apps Script**: polling stanów gry z umiarem — lobby ~10 s, wyścig
   ~10–15 s, tury ~30 s (aktywny gracz częściej, czekający rzadziej); zdarzenia
   POST-em natychmiast; awaria mostu = jawny status + kolejka zdarzeń
   offline (flush po powrocie sieci), gra się nie sypie (LESSONS L6).

## Konsekwencje

- Jeden most Apps Script rośnie o akcje gier i rankingów (ADR 0018 pkt 1) —
  wdrożenie właściciela pozostaje ODROCZONE i będzie JEDNO (paczki + gry +
  rankingi), instrukcja w czacie (ADR 0018 pkt 3).
- Nowe schematy w `docs/PROTOKOL.md`: `RO-gra/1` (stan gry na Drive) i
  `RO-zdarzenie/1` (zdarzenie synchronizacji) — aneks po implementacji.
- Gra wieloosobowa wymaga sieci (Drive) — bez mostu aplikacja mówi to wprost
  i odsyła do hot-seat; hot-seat działa offline jak dotąd.
- Ryzyka: stany wyścigu (dwa urządzenia wysyłają zdarzenie jednocześnie) —
  mitygowane numerowaniem zdarzeń po stronie mostu (kolejność przyjęcia);
  quota Drive przy długich grach — mitygowana interwałami pollingu z pkt 6;
  porzucone lobby — gra otwarta wygasa po 24 h (most przenosi do archiwum).

## Powiązania

ADR 0009 (hot-seat — aneks: zostaje jako tryb offline), ADR 0013 (prywatność —
rewizja zakresu: zdarzenia bez współrzędnych), ADR 0014 (punktacja czasu per
gracz), ADR 0016 (backend), ADR 0017 (geohash5 jako kryterium okolicy —
przeniesione na lobby i ranking lokalizacyjny), ADR 0018 (wielozadaniowość,
wdrożenie odroczone), plan `docs/plans/2026-09-06-m11-m12-gra-wieloosobowa-i-rankingi.md`,
ROADMAP M11/M12.

## Aneks (2026-09-06, implementacja P1–P3): doprecyzowanie tur

Punkt 2 mówił, że tury działają „jak kolejka hot-seat (ADR 0009)". Implementacja
doprecyzowała regułę: stacja `i` (1-based) należy NA STAŁE do gracza
`gracze[(i-1) % N]` (N ustalone przy starcie), kolejka **nie przesuwa się**,
a rezygnacja gracza **pomija** jego stacje. Wariant „zawężania listy aktywnych"
został odrzucony: przemapowałby stacje między graczami w trakcie gry, więc
pytania z kontenera (dopasowane po id stacji) rozjechałyby się na telefonach,
które już pobrały stan. Reguła jest zlustrowana identycznie w moście (`.gs`)
i `app/wieloosobowa.js`; zgodność pilnuje `test/kontrakt.test.js`. Pozostałe
punkty decyzji bez zmian.


## Dopisek (2026-09-07): bez pytania o zgodę przy każdej grze

Punkt 3 wymagał checkboxu przy zakładaniu i dołączaniu do gry
(`#multi-zgoda`, `okolica:multi:zgoda`). Właściciel — ta sama decyzja co
w aneksie ADR 0026 dla hot-seat: „Domyślnie zapisujemy na Drive i nie musimy
o to co chwilę pytać w prywatnej aplikacji — info jest w sekcji prywatność" —
wycofał ten warunek i dla gry wieloosobowej: „Tą adnotację i ptaszka z gry
wieloosobowej też usuń i opisz to na stronie prywatności (tam w ogóle daj
wszystkie te informacje)".

- Checkbox i dopisek zniknęły z ekranu multi (został komentarz w HTML).
- Sekcja „Dane i prywatność" dostała punkt „Gra na wielu telefonach": co
  widać u innych (pseudonim w lobby, Twoje dojścia i odpowiedzi), co trafia na
  wspólny Drive (kod gry, pseudonimy, przebieg), i że współrzędne zostają na
  telefonie (pkt 3 powyżej — bez zmian, nadal twarde „NIGDY").
- Bramka wejścia do multi to teraz pseudonim i adres mostu (i tak nie da się
  grać bez pseudonimu); gotowość sprawdzają `test/kontrakt.test.js` (M11) i
  `test/wieloosobowa-ui.test.js`.
- Schematy `RO-*` nigdy nie miały pola `zgoda` — most go nie czytał, więc
  protokół się nie zmienia.

## Aneks (2026-09-11): przepisanie trybów — koniec „tur", paczka przed lobby, solo

Właściciel poległ na pierwszym ekranie gry wieloosobowej i zarządził
przepisanie trybu od zera. Decyzje (konsultacje zakończone tego samego dnia):

1. **Tryb „tury" USUNIĘTY** (UI, `app.js`, `app/wieloosobowa.js`,
   `app/sync.js`, `.gs`, testy). Nie ma pojęcia „właściciela stacji" ani
   kolejki — `biezacyGraczTury` zniknęło z modułu i z mostu, a polling nie
   rozróżnia już „moja/czekam" (oba tryby pytają co 12 s).
2. Dwa tryby zamiast trzech (nazwy robocze wg właściciela):
   - **`trasa` — Wspólna Trasa**: wszyscy mają tę samą trasę, każdy na swoim
     telefonie i we własnym tempie; stacje PO KOLEI (bez listy wyboru),
   - **`wyscig` — Wyścig na Orientację**: dowolna kolejność stacji (lista
     wyboru — bez zmian, ADR 0027 część B).
   Punktacja WSPÓLNA (jedno zdanie w UI, bez dublowania): 1 pkt za dobrą
   odpowiedź + premia za kolejność ukończenia. Oba tryby domykają się tak
   samo: każdy gracz zamyka wszystkie stacje albo rezygnuje.
3. **Trasa-sekret**: w Wspólnej Trasie mapa gry pokazuje TYLKO bieżącą
   stację (kolejne odsłaniają się po drodze), a organizator generujący
   paczkę nie widzi na ekranie stacji ani kropek na mapie, ani nazw miejsc —
   tylko status „wygenerowano N stacji". Prompt dla modelu musi oczywiście
   nieść współrzędne (to jego materiał roboczy).
4. **Paczka PRZED lobby**: pseudonim → „Załóż grę w tej okolicy" → tryb →
   źródło (sesja / telefon / Drive / **✨ Wygeneruj pytania w AI** — pełna
   ścieżka pozycja → stacje → prompt → wklejenie, po której wraca się
   do panelu z paczką w sesji, NIE do gry hot-seat) → „🚀 Zakładam" → lobby
   z gotowymi ustawieniami. Lista źródeł NIGDY nie jest pusta (AI zawsze),
   statusy źródeł są jawne (w tym wynik szukania na Drive).
5. **Start gry możliwy od 1 gracza** (solo) — most nie wymagał tego nigdy
   jawnie, teraz UI mówi to wprost, a testy to pilnują.
6. Z ekranu multi usunięto zdanie „Na serwer jadą wyłącznie pseudonimy…"
   (współrzędne zostają na urządzeniach) — BEZ zmiany zachowania: zasada
   NIGDY (pkt 3) dalej pilnują biała lista pól zdarzenia, kasowanie po
   stronie mostu i SKANER w `test/wieloosobowa-ui.test.js`.

Kontrakt `RO-gra/1` zmienia tylko domenę `tryb` (`trasa`|`wyscig`, R04) —
schemat, zdarzenia i wyniki bez zmian; stare pliki gier z `tryb: "tury"`
są nieczytelne dla nowej wersji (R04, jak każda inna wersja aplikacji).

## Aneks (2026-09-11, m12-74): setup zamiast ekranu multiplayera, lista ~50 m zamiast kodów

Właściciel przeprojektował flow po pierwszych testach terenowych („wykorzystujemy
wspólne layery, tylko zakres opcji się zmienia"). Decyzje (odpowiedzi 1A–4A):

1. **Rodzaj gry i ścieżka multi żyją na SETUPIE**: toggle „Hot-seat / Wielu
   graczy" obok siebie jak środek transportu; w multi dosiada się segment
   „🚀 Zakładam nową grę / 🚪 Dołączam do istniejącej". Ekran
   `#multi-panel-zaloz` (tryb + źródła paczek + „Zakładam") ZNIKA — tryb
   (`trasa`/`wyscig`) i ptaszek „widoczna tylko kolejna stacja" (domyślnie ✓,
   własność GRY `trasaSekret`) wybiera się na setupie.
2. **Multi-załóż zostawia**: środek lokomocji, czas, liczbę stacji, wiek,
   tematy, „moja pozycja". **Pytań na stację BRAK** — liczba stacji = liczba
   pytań (1 na stację, forsowane w `app.js`), promień liczy się jak w hot-seat
   (ADR 0025). **Dokładnie JEDEN gracz na telefon** — host wpisuje imię+PIN
   w zwykłym bloku „Kto gra?" (odpowiedź 1A: wspólny profil Drive, limit 1
   z jawną odmową przy drugim). Język i podkład mapy usunięte z UI WSZĘDZIE
   (ADR 0037).
3. **Dalej to wspólna ścieżka**: pozycja (karta propozycji paczek — pasująca
   paczka prowadzi PROSTO do lobby) → stacje → prompt → wklejenie → **LOBBY**
   (opcje gry bez pytań i stacji — tylko ilość). Osobna funkcja
   `sciezkaAiMulti` i lista źródeł zniknęły: to po prostu zwykły setup.
4. **Dołączanie tylko z listy** (odpowiedź 4A): kod gry i `przycisk-dolacz-kod`
   USUNIĘTE. Lista pokazuje gry, których host był w zasięgu **~50 m** przy
   założeniu — miarą jest `konfiguracja.geohash8` (~40 m, pozycja z chwili
   założenia; komórka + sąsiedzi), a wpis mówi tylko **„Host: Jacek"**.
   **Brak dołączania po starcie** (odpowiedź 2) — `listaGier` zwracza wyłącznie
   `stan: "lobby"`.
5. **Kanał info w grze** (`#multi-info`): dojścia („X jest na stacji n"),
   odpowiedzi („X: dobra/zła odpowiedź (stacja n)"), rezygnacje i koniec gry —
   neutralne płciowo, ostatnie ~8 zdarzeń. **Polling w grze co 30 s**
   (odpowiedź 3A), lobby bez zmian (10 s).
6. **Host kończy grę przyciskiem** (`#przycisk-multi-zakoncz`, tylko
   organizator, tylko `stan: "trwa"`): u wszystkich podsumowanie i ranking;
   premia za kolejność liczy się także przy takim końcu (ukończone przed
   końcem = ważne). Koniec gry nadal także automatycznie: wszyscy aktywni
   (niezrezygnowani) domknęli stacje.
7. Punktacja: 1 pkt za dobrą odpowiedź + **stała premia 3/2/1** za 1./2./3.
   miejsce ukończenia (aneks do ADR 0027, także przy przedwczesnym końcu).

Kontrakt `RO-gra/1`: dochodzi opcjonalne pole `trasaSekret` (Boolean,
top-level; brak pola przy `tryb: "trasa"` = sekret — zgodność wstecz z
m12-73) i `konfiguracja.geohash8` (8 znaków, wymagane przy zakładaniu;
stare pliki bez niego są nadal czytelne — walidator odczytu go nie wymaga).
Wpisy `RO-lobby/1` dokładają `geohash8`. Prywatność bez zmian: biała lista
pól zdarzeń, kasowanie współrzędnych po stronie mostu i SKANER w testach.

---

## Aneks 2026-09-11b (m12-77/m12-78): rankingi usunięte, wyjście z lobby jawne

Decyzja właściciela (2026-09-11): **„tak, usuwamy też rankingi z mostu"**.
Punkt 5 i 7 powyżej zostają (kanał info, punktacja 1 pkt + premia 3/2/1), ale
**rankingi jako funkcja przestają istnieć** — nie są schowane z interfejsu,
nie ma ich po żadnej stronie.

1. **Koniec gry = podsumowanie na telefonie.** Gracz widzi tabelę końcową
   swojej gry (`przeliczWyniki`, premia 3/2/1 bez zmian). Na Drive zostaje
   **historia gier** (`RO-gra/1` ze stanem `zakonczona`) — zapis gry zostaje,
   bo bez niego nie byłoby czego pokazać ani czego policzyć.
2. **Zniknęło**: ekran 🏆 w aplikacji (zakładki ogólny/wiek/tematy/lokalizacja
   i „Moje gry"), `GET ?akcja=ranking` i `rankingi()` w moście, schemat
   `RO-ranking/1`, agregacje `agregujRanking`/`kategorieRankingu`, walidacja
   `walidujRankingSurowy`.
3. **Kody R17 i R18 są wycofane** i ich numery zostają zajęte na stałe —
   inaczej starszy klient w terenie odczytałby nowy błąd pod starym numerem
   jako swój (precedens: E14 i E18 w pakietach). Klucze `okolica:ostatni-gracz`
   i `okolica:pseudonim` przestają istnieć: czytały je wyłącznie „Moje gry".
4. **Wyjście z lobby jest poleceniem, nie tylko zamknięciem ekranu** — nowa
   akcja `gra-opusc` (PROTOKOL §9.5). Wcześniejszy kształt „dołączanie
   i wychodzenie w dowolnym momencie" (aneks 2026-09-11, pkt 4) był zrobiony
   w połowie: dołączanie szło przez most, a wychodzenie zostawiało gracza
   w `gra.gracze`, więc `liczbaGraczy` w `RO-lobby/1` obiecywało kogoś, kogo
   już nie było. Wyjście organizatora zamyka grę (stan `archiwum`) — tylko on
   może wystartować. Po starcie wyjście to nadal zdarzenie `rezygnacja`.
