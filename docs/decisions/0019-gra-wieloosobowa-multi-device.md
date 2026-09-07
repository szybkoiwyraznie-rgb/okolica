# 0019 — Gra wieloosobowa na wielu urządzeniach przez Drive: lobby + kod, wyścig i tury, rankingi

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
