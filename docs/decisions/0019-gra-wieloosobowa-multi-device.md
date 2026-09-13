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

## Aneksy 2026-09-06 … 2026-09-11b są w archiwum (poza budżetem lektury)

Historia tego ADR do aneksu 2026-09-11b włącznie — doprecyzowanie tur
(2026-09-06, implementacja P1–P3), dopisek 2026-09-07 (bez pytania o zgodę przy
każdej grze), przepisanie trybów 2026-09-11 (koniec „tur", paczka przed lobby,
solo), setup zamiast ekranu multiplayera i lista ~50 m zamiast kodów
(2026-09-11, m12-74) oraz rankingi usunięte i jawne wyjście z lobby
(2026-09-11b, m12-77/m12-78) — leży w
`docs/decisions/archive/aneksy-0019-2026-09-06-do-11b.md`, poza budżetem
lektury startowej (AGENTS.md §0; LESSONS L62: gdy próg pęka, treść historyczna
wychodzi z rejestru, a ślad zostaje). Obowiązujące aneksy są niżej: 2026-09-12f,
2026-09-13 (uwaga F), 2026-09-13b (uwaga G) i 2026-09-13c (zgłoszenia N i R).

## Aneks 2026-09-12f: ranking wrócił — ale decyzja żyje w ADR 0039

Zgłoszenie właściciela (2026-09-12: „Mam nowy pomysł na podstronę Ranking”)
odwraca pkt 2 aneksu 2026-09-11b — ranking znowu istnieje. **Kształt tej
decyzji opisuje ADR 0039**, a ten aneks jest kotwicą w historii ADR 0019:
cytują go rejestr (`docs/decisions/README.md`), most
(`docs/setup/apps-script-repo-paczek.gs`) i `test/most-ranking.test.js`, więc
bez niego trzy nośniki wskazywałyby miejsce, którego nie ma (LESSONS L31:
zmiana zasady = przegląd wszystkich nośników w tym samym commitie).

1. **Co wróciło do mostu**: `GET ?akcja=ranking` i `rankingi()` — schemat
   `RO-ranking/2` (PROTOKOL §9.7), dwie tabele po ≤5 pozycji: suma punktów
   oraz proporcja poprawnych do zadanych pytań (liczona od 10 zadanych).
   Źródłem są gry ZAKOŃCZONE na Drive — hot-seat (§9.6) i wieloosobowe (§9.1)
   naraz — a do tabel wchodzą wyłącznie profile potwierdzone na Drive.
2. **Co NIE wróciło** (to jest treść ADR 0039, nie tego aneksu): zakładki
   ogólny/wiek/tematy/lokalizacja, kategorie, lista „Moje gry”, agregacje
   liczone na telefonie, `RO-ranking/1`, eksport rankingu.
3. **Numery R17 i R18 zostają zajęte na stałe** (pkt 3 aneksu 2026-09-11b):
   nowy ranking ma własne kody usterek w PROTOKOL §9.7, a wycofane numery nie
   wracają do obiegu — starszy klient w terenie nie odczyta nowego błędu jako
   swojego.
4. **Ekran**: ranking jest warstwą z belki ikon (`#przycisk-ranking`), nie
   krokiem flow gry wieloosobowej — nie zmienia więc ani lobby, ani tur, ani
   Wspólnej Trasy z pkt 1–7 powyżej. Wymaga NOWEGO deploymentu web app; na
   starym adresie warstwa mówi wprost, że nie udało się pobrać danych, a gra
   toczy się dalej.

## Aneks 2026-09-13 (m12-108, uwaga F): koniec ekranu po starcie — gra wygląda jak hotseat

Punkty **5** (kanał info `#multi-info`) i **6** (host kończy grę przyciskiem
`#przycisk-multi-zakoncz`) aneksu 2026-09-11 tracą ważność razem z całą kartą
`#gra-panel-multi`, która po starcie była doklejana do ekranu gry. Właściciel po
testach terenowych 2026-09-13: po kliknięciu „Rozpocznij grę” wszyscy gracze
dostają sygnał i odliczanie 5-4-3-2-1-START na środku ekranu nad mapą, a potem
aplikacja ma wyglądać DOKŁADNIE tak jak w hotseat — bez tabel, bez czasów
odświeżania, bez informacji, kto wystartował (ADR 0044).

1. **Kanału info w grze NIE MA.** Zdarzenia (`start`, `dojscie`, `odpowiedz`,
   `rezygnacja`, `koniec`) nadal idą na most i nadal są podstawą punktacji —
   gracz widzi ich skutek w tabeli końca gry i w rankingu (ADR 0039), nie
   w strumieniu komunikatów pod paskiem.
2. **Przycisku hosta NIE MA**: koniec gry i rezygnacja idą przez ikonę
   ⚙ START GRY z wpisaniem TAK (ADR 0043) — organizator woła `zakonczGreMulti()`,
   pozostali `rezygnujZGryMulti()`. Premia za kolejność liczy się tak samo przy
   końcu przed czasem (pkt 6 aneksu 2026-09-11 zostaje w mocy co do SKUTKU;
   zmienia się tylko to, czym się kończy grę).
3. **Polling w grze co 30 s zostaje** (pkt 5 aneksu 2026-09-11 co do rytmu):
   zmienił się tylko nośnik informacji — pasek „Ostatni stan / następne
   odświeżenie” żyje wyłącznie w lobby (`#multi-sync-pasek`).
4. **Żywe wyniki w trakcie gry** zniknęły z ekranu gracza; tabela widowni
   w lobby (`#lobby-widownia-wiersze`) zostaje, a ostateczna tabela tej gry jest
   na ekranie wyniku (ADR 0038) z punktami policzonymi przez most.
5. **Wybór stacji w Wyścigu na Orientację** (ADR 0027 część B) zostaje, ale
   mieszka w panelu fazy A obok „▶ Idę do stacji”, nie w karcie multi.

## Aneks 2026-09-13b (m12-109, uwaga G): koniec gry hosta nie kończy gry pozostałym

Punkt **6** aneksu 2026-09-11 (host kończy grę przyciskiem `gra-zakoncz`, u
wszystkich podsumowanie) oraz jego wersja z aneksu 2026-09-13 (host kończy grę
ikoną ⚙ START GRY, `zakonczGreMulti()`) tracą ważność. Właściciel po testach
terenowych 2026-09-13: zakończenie gry przez hosta NIE kończy gry u pozostałych —
gracze grają dalej i mają wszystkie informacje, bo telefon hosta służył tylko do
wystartowania gry, wybrania okolicy i wygenerowania pytań, a logika i punkty żyją
na wspólnym Drive i na telefonach uczestników.

1. **Koniec gry na telefonie = wyjście z gry**, dla KAŻDEJ roli: potwierdzenie
   w warstwie za ikoną ⚙ START GRY (ADR 0043) wysyła zdarzenie `rezygnacja`
   z powodem („organizator zakończył grę na swoim telefonie” / „rezygnacja
   z telefonu”), pokazuje wynik tego gracza i NIE zmienia stanu gry w moście.
   Funkcja `zakonczGreMulti()` została usunięta; aplikacja nie woła akcji
   `gra-zakoncz`.
2. **Pozostali gracze grają dalej** — ich telefony nie dostają żadnego sygnału
   końca, a synchronizacja działa jak dotąd (polling 30 s, kolejka offline).
   Punktacja i domknięcie gry są po stronie mostu.
3. **Most domyka grę także po rezygnacji**: warunek `z.typ !== 'koniec'
   && czyKompletna(gra)` zastąpił `z.typ !== 'rezygnacja' && z.typ !== 'koniec'
   && czyKompletna(gra)`. `czyKompletna()` liczy gracza, który zrezygnował, za
   domkniętego, więc bez tej zmiany gra wisiałaby otwarta, gdy ostatni aktywny
   gracz wychodzi (np. host kończy u siebie, a pozostali już skończyli). Wymaga
   NOWEGO deploymentu web app; na starym adresie gra domknie się dopiero przy
   kolejnym zdarzeniu gracza, który jeszcze gra.
4. **Premia za kolejność** (ADR 0027 aneks 2026-09-13, uwaga L) liczy się bez
   zmian: pula = min(3, dograli − 1), a „dograli” to gracze bez rezygnacji —
   host, który wyszedł, nie liczy się do puli i nie dostaje premii.
5. **Akcja `gra-zakoncz` zostaje w moście** (obsługiwana jak dotąd: tylko
   organizator, tylko `stan: 'trwa'`) dla starszych telefonów z offline'ową
   skorupą z Service Workera i dla ręcznego porządkowania gier na Drive. Nie jest
   już częścią flow gry — PROTOKOL §9.1 mówi to wprost.
6. **Informacje, które zniknęły z ekranu gry** (kanał info i żywa tabela — aneks
   2026-09-13, ADR 0044), są nadal dostępne tam, gdzie właściciel ich chce:
   ostateczna tabela tej gry na ekranie wyniku (punkty z mostu,
   `wynikiMultiKonca`), ranking między grami w warstwie pucharu (ADR 0039) i żywe
   wyniki w lobby dla widowni (`#lobby-widownia-wiersze`).

## Aneks 2026-09-13c (m12-113, zgłoszenia terenowe N i R): sekret tylko w żywej grze, numery stacji stałe po powrocie

**R — trasa-sekret nie przecieka do hot-seata.** Brama była liczona
z resztkowego `STAN.multi`: kontekst gry zamkniętej przez hosta albo odzyskanej
przy starcie z `okolica:multi:sesja` chował trasę także w hot-seacie (widać było
jedną stację, z numerem 1). Teraz decyduje czysta funkcja
`czyTrasaSekret(multi)` w `app/wieloosobowa.js`: gra musi TRWAĆ
(`stan === 'trwa'`), być Wspólną Trasą i nie mieć jawnie wyłączonego sekretu
(brak pola `trasaSekret` = sekret, zgodność wstecz z m12-73). Dodatkowo
`startGry()` (hot-seat) kończy kontekst sieciowy: synchronizacja staje, sesja
i `STAN.multi` idą w kosz — inaczej przy następnym otwarciu telefonu sesja multi
wygrywała z zapisem hot-seata (boot: `czytajSesjeMulti()` ma pierwszeństwo,
ADR 0045), a gracz wracał do innej gry, niż zostawił.

**N — numer stacji jest stały po powrocie.** Powrót do gry sieciowej buduje
rozgrywkę z NIEZAMKNIĘTYCH stacji (aneks 2026-09-11: zamknięte stacje nie
wracają), więc indeks na liście telefonu przestawał być numerem na trasie: gracz
idący do stacji 2 widział po odświeżeniu „stacja 1 z 3" i pin z numerem 1.
Stacje niosą teraz `numer` (pozycja na PEŁNEJ trasie): `planMapy` woli go przed
indeksem, a napisy „stacja X z Y", „Idę do stacji X" i etykieta przycisku
„dalej" biorą go z `numerStacjiTrasy()`; licznik pokazuje pełną trasę
(`STAN.trasaDlugosc`). Zasada „zamknięte stacje nie wracają do przejścia"
zostaje — zmienia się tylko numeracja. W hot-seacie lista jest pełna, więc
`numer` nie występuje i wszystko liczy się jak dotąd; pilnuje tego test
end-to-end z reloadem w trasie (zgłoszenie N: cel zostaje stacją 2, a odpowiedź
i punkty wracają z zapisu — ADR 0045).

**Punktacja per gracz przez reload — sprawdzona liczbami** (dopytanie
właściciela 2026-09-13: „czy punktacja się przenosi? punkty zachowane przy
graczach?"). Hot-seat: punktów nie ma w stanie jako pola — liczy je
`podsumowanie()` z `rozgrywka.odpowiedzi` (wpis niesie `gracz` i `punktyRazem`),
a odpowiedzi jadą w zapisie, więc test trzech graczy pinuje układ `[[1,1],[2,0]]`
przed zamknięciem przeglądarki, ten sam układ po powrocie i tabelę końca gry po
dokończeniu: 1 pkt Gracza 1 (zdobyty PRZED reloadem), 1 pkt Gracza 3 (po
wznowieniu), 0 pkt Gracza 2 z `0/1` — zero zostaje zerem, nie brakiem wpisu.
Gra sieciowa: punkty liczy MOST z dziennika zdarzeń (`przeliczWyniki`),
a lokalnego snapshotu gry multi nie ma wcale (`zapiszGre` wychodzi przy
`STAN.multi`), więc odświeżenie telefonu nie ma czego zgubić — test trasy
z resume pinuje odpowiedź gościa obecną na moście PRZED odświeżeniem
i `punkty − premia` = 4 i 4 na koniec gry.

Znane ograniczenie (stan na m12-113, bez decyzji właściciela): zdarzenie
NIEDOSTARCZONE — brak zasięgu albo odmowa sieci w chwili odpowiedzi — czeka
w kolejce `app/sync.js` tylko w pamięci, więc reload je gubi. Most nie zna wtedy
odpowiedzi, stacja zostaje otwarta i gracz przechodzi ją jeszcze raz; podwójnego
policzenia nie ma, bo most odrzuca drugą odpowiedź tego gracza do tej stacji.
Utrwalenie kolejki (wzór: `oceny-kolejka/1` i kolejka wyniku hotseat) jest
możliwe i bezpieczne właśnie dzięki temu odrzucaniu duplikatów.
