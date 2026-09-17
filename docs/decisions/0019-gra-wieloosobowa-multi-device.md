# 0019 — Gra wieloosobowa na wielu urządzeniach przez Drive: lobby + kod, wyścig i tury, rankingi

> **Stan na 2026-09-11 (m12-78)**: flow przepisany po raz drugi — segment
> „załóż/dołącz" na SETUPIE, dołączanie tylko z listy ~50 m (bez kodów), paczka
> przed lobby ze WSPÓLNEJ ścieżki, kanał info i koniec gry z ręki hosta.
> **Rankingi usunięte w całości** (aneks 2026-09-11b) — tytuł ADR jest
> historyczny. Wszystkie aneksy (2026-09-06 … 2026-09-13d) są w
> `docs/decisions/archive/`; obowiązujący kształt opisują punkty decyzji wyżej
> i streszczenia w notach niżej, a pełne teksty — pliki archiwum.

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
wychodzi z rejestru, a ślad zostaje). Obowiązujące aneksy są niżej.

## Aneksy 2026-09-12f … 2026-09-13b są w archiwum (poza budżetem lektury)

Powrót rankingu (decyzja przeniesiona do ADR 0039), koniec ekranu po starcie
gry sieciowej (uwaga F) i koniec gry hosta, który nie kończy gry pozostałym
(uwaga G) — `docs/decisions/archive/aneksy-0019-2026-09-12f-do-13b.md`.
Późniejsze aneksy — 2026-09-13c (zgłoszenia terenowe N i R) i 2026-09-13d
(utrwalona kolejka zdarzeń) — też są w archiwum; niżej zostały po nich tylko
noty ze streszczeniem reguł.

## Aneks 2026-09-13c jest w archiwum (poza budżetem lektury)

Sekret tylko w żywej grze i stałe numery stacji po powrocie (m12-113,
zgłoszenia terenowe N i R) — `docs/decisions/archive/aneksy-0019-2026-09-13c.md`,
poza budżetem lektury startowej (AGENTS.md §0; LESSONS L62). Późniejszy aneks
(2026-09-13d) jest niżej.

## Aneks 2026-09-13d (m12-114) jest w archiwum (poza budżetem lektury)

Utrwalona kolejka zdarzeń (reload nie gubi odpowiedzi) — dosłownie:
`docs/decisions/archive/aneksy-0019-2026-09-13d.md` (archiwizacja 2026-09-17b;
AGENTS.md §0, LESSONS L62/L66). Obowiązuje: klucz `okolica:multi-kolejka`
(schemat `zdarzenia-kolejka/1`, limit `LIMIT_KOLEJKI_ZDARZEN` = 50
najstarszych), `utworzSynchronizacje` dostaje uchwyty `wczytajKolejke`,
`zapiszKolejke`, `limitKolejki` (moduł nie zna `localStorage`), utrwalany jest
KAŻDY ruch kolejki, `przywrocGreMulti` wypycha zaległe zdarzenia PRZED
pobraniem stanu gry, odmowa mostu kasuje zdarzenie (bez ponawiania),
a `usunSesjeMulti` czyści kolejkę. Regułę techniczną opisuje LESSONS L67.
