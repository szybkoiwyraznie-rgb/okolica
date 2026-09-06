# Plan: zadania właściciela po M7 — współrzędne z Google Maps, pinezka na mapie, CI

- Data: 2026-09-06
- Gałąź: `arena/01a07282-okolica`
- Status: w realizacji
- Zlecenie: dwie uwagi właściciela po zamknięciu M7 (kod):
  1. testowe współrzędne ręczne powinny przyjmować format z Google Maps
     (np. Podkowa Leśna, ul. Bukowa 22 → `52°07'22.9"N 20°44'46.1"E`),
     a „jeszcze lepiej" — ustawianie pinezki stuknięciem w mapę;
  2. projekt nie ma testu CI na GitHubie, a wszystkie poprzednie projekty
     właściciela miały — „nie trzeba go dodać?".

## Diagnoza uwagi 1 (ważna — prostuje nieporozumienie)

Aplikacja przyjmuje **stopnie dziesiętne WGS84** i to jest model właściwy
(tak działa `navigator.geolocation`, kafelki, haversine). Przykład właściciela
pokazuje inną pułapkę: `52°07'22.9"N` to NIE jest `52.07229` — to
`52 + 7/60 + 22.9/3600 = 52.12303` (analogicznie `20°44'46.1"E = 20.74614`).
Wpisane `52.07229 20.44461` to inny punkt (~20 km na południe), więc
„zlokalizowało mnie w innym miejscu" jest zachowaniem POPRAWNYM dla tego
wejścia. Naprawa nie zmienia modelu — zmienia wejście:

1. **parser formatu Google Maps** (DMS i pary dziesiętne) — wklejenie działa;
2. **jawny status z odczytanymi stopniami dziesiętnymi** — właściciel od razu
   widzi, co aplikacja zrozumiała (52.12303, nie 52.07229);
3. **stuknięcie w mapę ustawia pozycję testową** — najkrótsza droga, bez
   przepisywania współrzędnych w ogóle.

Dodatkowa blokada techniczna dzisiejszego stanu: pola mają `type="number"`,
a przeglądarka do takiego pola NIE WPUŚCI znaków `°'\"NS EW` — wklejenie
formatu Google Maps jest fizycznie niemożliwe. Pole musi być tekstowe.

## Decyzje

1. **Parser jako czysta funkcja `geo.parsujWspolrzedne(surowyLat, surowyLon)`**
   (sąsiad `formatujWspolrzedne` — round-trip w testach). Akceptuje:
   - dziesiętne: `52.12303` i z polskim przecinkiem `52,12303` (w osobnych
     polach lat/lon);
   - DMS-składnik w polu: `52°07'22.9"N`, warianty `52°7′22.9″N`,
     `52 7 22.9 N`, `52.12303°N`; litery `S`/`W` dają znak ujemny;
   - PEŁNĄ PARĘ w pierwszym polu (drugie puste): DMS
     `52°07'22.9"N 20°44'46.1"E` albo dziesiętną `52.123028, 20.746139` /
     `52.123028 20.746139`; para E/W-przed-N/S też (zamiana — Google podaje
     N/S pierwsze, ale kolejność nie może być pułapką);
   - odmawia jawnie: para w pierwszym polu + niepuste drugie (konflikt),
     minuty/sekundy ≥ 60, śmieci, puste pola, para z więcej niż dwóch liczb.
   Wynik: `{ ok: true, lat, lon, zPary, format }` albo
   `{ ok: false, powod, komunikat }` — komunikat po polsku, trafia pod pola
   jako `[P06]` w `role="alert"` (dotychczasowy wzorzec: kod z rejestru,
   tekst dopasowany do pola). Zakres dziesiętnych (-90..90 / -180..180)
   sprawdza jak dziś `ocenFix` (parser nie dubluje, wyjątek: stopnie DMS).
2. **Pola `setup-lat`/`setup-lon` → `type="text"` + `inputmode="decimal"`**
   (klawiatura numeryczna na telefonie zostaje, wklejanie DMS staje się
   możliwe) + `placeholder` z przykładem obu formatów + `<p class="podpowiedz">`
   z przykładem Google Maps. Walidację i tak robi parser — surowszy niż
   przeglądarkowy `number`.
3. **Status po ustawieniu pokazuje odczytane liczby**:
   `Pozycja ustawiona ręcznie (tryb testowy): 52.12303, 20.74614` —
   `formatujWspolrzedne` (round-trip: to, co w statusie, jest w stanie).
4. **Stuknięcie w mapę pozycji (tryb testowy)**: `mapa.js` rozpoznaje tap
   w gestach (jeden palec, ruch < 10 px, bez pinch-a w trakcie) i woła
   `stan.onStukniecie(geo)`; metoda instancji `ustawNasluchStukniecia(fn)`
   (wzorzec `ustawTrybReczny`). `app.js` podpina NASŁUCH TYLKO pod mapę
   pozycji i bramkuje `STAN.trybTestowy && STAN.ekran === 'pozycja'`:
   tap ustawia pozycję TĄ SAMĄ drogą co przycisk (fix ze źródła `reczne`,
   `ocenFix`), wypełnia pola (6 miejsc po przecinku), przesuwa marker
   i daje status `Pozycja testowa ustawiona z mapy: …`. Próg 10 px jest
   do dostrojenia w teście terenowym (ryzyko: tap vs pan w rękawiczce).
5. **CI**: `.github/workflows/ci.yml` = receptura z `docs/setup/ci-workflow.yml`
   (bez nagłówka lustra): `npm test` + `npm run check` + strażnik braków
   zależności/sekretów, node 22, `pull_request` + `push: main` +
   `workflow_dispatch`. Znane ryzyko **L4/ADR 0012**: token Areny dostawał
   403 `workflows` — dzisiejsza próba przez API dała 409 (ochrona gałęzi
   `main`: zmiany tylko przez PR), NIE 403, więc push na naszą gałąź może
   przejść. Jeśli push z plikiem workflow dostanie 403 — plik zostaje
   usunięty z gałęzi (osobny commit, bez force push), a właściciel wkleja
   recepturę przez Web UI (repo → Add file → `.github/workflows/ci.yml`),
   dokładnie jak opisuje nagłówek lustra.
6. **Dokumenty**: `WORKFLOW` §4.1 (wklejanie z Google Maps + tap jako droga
   testowa), nagłówek `docs/setup/ci-workflow.yml` (status: live albo
   „wklej ręcznie" — po próbie pusha), `ARCHITECTURE` (parser w geo.js,
   tap w mapa.js — jedno zdanie w przepływie/drzewie), `PROJECT_HISTORY`,
   `ROADMAP` M8 (adnotacja: CI przyspieszone na prośbę właściciela), PR #2
   (wiersze commitów + krótka sekcja „Zadania właściciela po M7").

## Kroki

- [ ] **D1 — plan (ten plik):** commit + push.
- [x] **D2 — parser (czysty):** `geo.parsujWspolrzedne` + testy jednostkowe
      (przykład właściciela z Podkowy Leśnej, pary DMS i dziesiętne, polski
      przecinek, zamiana E/W-first, konflikty i śmieci; oczekiwania LICZONE
      w teście — L24, żadnego `52.12303` z głowy).
- [x] **D3 — UI:** pola tekstowe + podpowiedź, przycisk przez parser, jawny
      status z dziesiętnymi; `onStukniecie` w `mapa.js` + wiring w `app.js`;
      testy integracyjne (wklejona para DMS ustawia pozycję; tap w mapę
      pozycji w `?tryb=test` ustawia pozycję i wypełnia pola; błąd
      parsowania → `[P06]` w alercie, pozycja bez zmian; pan z ruchem > próg
      NIE ustawia pozycji) + kontrakt (podpowiedź, pola `type="text"`);
      brama zielona.
- [ ] **D4 — CI + dokumenty:** `.github/workflows/ci.yml`, próba pusha
      (403 → fallback właścicielski i adnotacja), dokumenty z pkt 6, brama,
      commit + push, aktualizacja PR #2.

## Ryzyka

- **403 `workflows` przy pushu** (L4) — fallback: właściciel wkleja plik
  przez Web UI; receptura czeka w `docs/setup/ci-workflow.yml` od E4.
- **Tap vs pan w terenie** (rękawiczka, folia) — próg 10 px + wymóg braku
  pinch-a; dostrojenie po teście terenowym właściciela (kryterium D-terenu
  dopisane do zaległej listy §4).
- **`type="text"` bez walidacji przeglądarki** — parser jest surowszy
  i daje komunikat; istniejące testy z dziesiętnymi wartościami przechodzą
  bez zmian (ścieżka `Number` → parser dziesiętny).
- **Wieloznaczność `52,123,20,746`** (przecinek dziesiętny I separator bez
  spacji) — jawna odmowa z komunikatem, nie zgadywanie (ADR 0010 pkt 6:
  nigdy cicho).

## Kryterium akceptacji (właściciel)

1. Wklejenie `52°07'22.9"N 20°44'46.1"E` w pierwsze pole (drugie puste) →
   „Ustaw tę pozycję" → status pokazuje `52.12303, 20.74614`, marker stoi
   w Podkowie Leśnej przy ul. Bukowej.
2. W `?tryb=test` na ekranie pozycji: pinch/pan NIE przestawia pozycji,
   krótkie stuknięcie — tak (marker + pola + status).
3. CI na GitHubie: zielona `brama` przy tym PR (albo adnotacja o 403
   z instrukcją wklejenia — wtedy zielone po wklejeniu przez właściciela).
