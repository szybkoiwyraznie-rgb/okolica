# PLAN 2026-09-05 — M1: model rozgrywki i geolokalizacja (czyste funkcje)

> Roadmapa JEDNEGO zadania (`AGENTS.md` §2, ADR 0012). Odhaczanie etapów
> kolejnymi commitami; na końcu podsumowanie wykonania. Zadanie wynika z kolejki
> w `docs/setup/HANDOFF_2026-09-05.md` §4 i z `docs/ROADMAP.md` M1.

## Cel

Domknąć M1: wszystko, co liczy przebieg gry i dojście do stacji, ma być czystą
funkcją testowalną w Node bez DOM i bez sieci (ARCHITECTURE „Podział: czyste
funkcje vs warstwa DOM"). Bez tego M2 (mapa) i M6 (rozgrywka) budowałyby logikę
w środku handlerów zdarzeń — czyli tam, gdzie nie da się jej przetestować.

## Etapy

- [x] F1 — doprecyzowanie punktacji czasu: ADR 0014 (*Proponowana*) + wpis
      w rejestrze + plan. ADR 0009 pkt 5 mówi o „medianie odcinków tej samej
      stacji dla wszystkich graczy", co w modelu hot-seat (jeden gracz idzie do
      jednej stacji) nie ma próbek — potrzebna reguła zastępcza zanim powstanie
      kod punktacji.
      Kryterium: reguła jest jawna, ma wzór, zaciski i przypadek „za mało próbek".
- [x] F2 — `app/rozgrywka.js`: stan gry (schemat `rozgrywka/1`), kolejka graczy
      (`stacja mod N`, ADR 0009 pkt 2), odcinki (start na jawnej akcji,
      `performance.now` wstrzykiwany jako `czasMs`, ADR 0004 pkt 3), kara za
      ręczne zgłoszenie (ADR 0004 pkt 5), tryby odpowiadania `wspolpraca`
      (ADR 0009 pkt 4), punktacja (ADR 0009 pkt 5 + ADR 0014), dziennik
      zdarzeniowy, `podsumowanie()`, `wczytajStan()` z odmową przy obcym
      schemacie (ADR 0010 pkt 6). **Stan nie zawiera treści pytań** — tylko
      identyfikatory i wyniki (ADR 0007 pkt 6).
      Kryterium: `test/rozgrywka.test.js` przechodzi pełną grę od startu do
      podsumowania na wstrzykniętym zegarze, wynik deterministyczny.
- [x] F3 — `app/pozycja.js`: filtr dokładności, stan dojścia (dwa kolejne fixy,
      próg `max(25 m, 1,2 × accuracy)` — ADR 0004 pkt 2), komunikaty błędów GPS
      (pkt 7), symulacja trasy dla trybu testowego (pkt 6) jako czysta funkcja
      `fixSymulowany(t)`, cienka osłona `watchPosition`.
      Kryterium: `test/pozycja.test.js` — sekwencja fixów z odbiciem sygnału nie
      zapala stacji, symulacja jest deterministyczna i kończy się dojściem.
- [x] F4 — wspólna atrapa DOM w `test/helpers/dom.js` (ARCHITECTURE „Testowanie"
      już ją zapowiada) i przełączenie `test/aplikacja.test.js` na nią; refactor
      `app/app.js` tak, żeby geolokalizacja szła przez `pozycja.js` (M1:
      „wydzielenie `app/pozycja.js` z logiki siedzącej dziś w `app/app.js`").
      Kryterium: bootstrap dalej przechodzi, a `app.js` nie ma własnego
      `watchPosition` poza wywołaniem osłony.
- [x] F5 — dokumentacja po wykonaniu: `ROADMAP` (M1 ✅), `ARCHITECTURE` (jeśli
      stan/algorytmy się doprecyzowały), `HANDOFF`, `PROJECT_HISTORY`, rejestr
      ADR, cache-busting `?v=` po zmianie `app/*.js` (`AGENTS.md` §6).
      Kryterium: `npm run brama` zielone, `git status` czysty, wszystko
      wypchnięte.

## Ryzyka / pułapki

- **Stan gry musi być niezmiennikowy**: funkcje zwracają nowy obiekt
  (`structuredClone`), bo UI trzyma referencje i mutacja w miejscu dałaby
  nieodtwarzalne błędy (ARCHITECTURE „Stan i trwałość": stan jest zdarzeniowy).
- **Zero `Date.now()` / `performance.now()` w logice** (`AGENTS.md`): czas jest
  parametrem (`czasMs`), więc testy nie zależą od zegara maszyny.
- **Zero treści pytań w stanie** (ADR 0007 pkt 6) — tylko `pytanieId`,
  `poprawna`, `punkty`. Stan może trafić do `localStorage`.
- `test/helpers/dom.js` leży w katalogu `test/`, więc `node --test` uruchomi go
  jako plik bez testów — ma być neutralny (zero asercji na poziomie modułu).
- Polskie znaki: nowe pliki `write_file`, poprawki `python3` (LESSONS L2).

## Poza zakresem M1 (świadomie)

Renderer mapy (M2), Overpass i graf dróg (M4), zapis stanu do `localStorage`
i eksport pliku (`app/trwalosc.js` — zapis paczki w M5, stan gry w M6),
ekran gry i pauza/wznowienie (M6),
podsumowanie graficzne i udostępnianie (M7).

## Podsumowanie wykonania

Wszystkie pięć etapów wykonane w jednej sesji (2026-09-05).

| Etap | Co powstało | Commit |
|---|---|---|
| F1 | `docs/decisions/0014-punktacja-czasu-mediana-tempa.md` (*Proponowana*), wiersz w rejestrze, odsyłacz w ADR 0009 pkt 5, ten plan | `56e0dc6` |
| F2 | `app/rozgrywka.js` (schemat `rozgrywka/1`, kody `G01`–`G13`) + `test/rozgrywka.test.js` (36 testów) | `8eec03c` |
| F3 | `app/pozycja.js` (kody `P01`–`P09`, symulacja trasy, osłona `watchPozycja`) + `test/fixtures/trasa-odbicie.json` + `test/pozycja.test.js` (21 testów) | `3537e59`, `0046216` |
| — | hartowanie `domyslnaKonfiguracja` (NaN z `localStorage` → default; LESSONS L10) + testy w `test/konfig.test.js` | `78a1bd0` |
| F4 | `test/helpers/dom.js`, przełączony `test/aplikacja.test.js` (19 testów), refactor `app/app.js` (geolokalizacja przez `pozycja.js`, pauza w tle, ręczne współrzędne), dwa nowe kontrakty | `09faf5c` |
| F5 | ADR 0015 (*Proponowana*) + rejestr, `ARCHITECTURE`, `ROADMAP` (M1 ✅), `LESSONS` L10–L12, `PROJECT_HISTORY`, `HANDOFF_2026-09-05-m1.md`, cache-busting `?v=m1-1` | (commit F5) |

**Brama:** `npm run brama` = 177 testów, 0 fail (na starcie etapu F1: 105)
+ `synchronizuj-szablon --check` zielone. Każdy commit był wypchnięty od razu,
a zieloność snapshotów F3-cd./hartowanie/F4 sprawdzona dodatkowo przez
`git worktree add` + `npm test` poza katalogiem repo.

**Kryteria etapów — spełnione:**
- F2: pełna gra 3 graczy × 5 stacji od startu do podsumowania na wstrzykniętym
  zegarze, wynik deterministyczny (test „determinizm" + `wczytajStan`
  round-trip), premia/potrącenie/zacisk ±25%, „za mało próbek" → premia 0,
  kara ręczna, limit czasu, trzy tryby współpracy, pomijanie stacji, odmowa
  przy obcym schemacie.
- F3: sekwencja fixów z odbiciem sygnału **nie** zapala stacji (fixture z
  oczekiwaniami per fix), symulacja jest deterministyczna i kończy się
  dojściem (postój przy stacji).
- F4: bootstrap przechodzi na wspólnej atrapie, a `app.js` nie ma własnego
  `watchPosition` ani `clearWatch` (pilnuje `test/kontrakt.test.js`).

**Co wyszło poza plan (usterki znalezione przy testach, opisane w ADR 0015
i LESSONS L11):** stacja bez pytania w paczce zostawiała grę w fazie `pytanie`
bez akcji wyjścia; `pominStacje()` po dojściu kasowała pomiar dojścia
i wyrzucała tempo z próbek mediany. Obie naprawione w M1 (ostrzeżenie
`BRAK-PYTAN` + `brakPytan` w stanie; odmowa `G13`).

**Rzeczy otwarte:**
- ADR 0014 i 0015 są *Proponowane* — kod już tak działa, więc decyzja
  właściciela „inaczej" oznacza zmianę `app/rozgrywka.js` i testów.
- Model rozgrywki nie ma jeszcze UI: ekran gry to M6 i tam też należy
  `app/trwalosc.js` dla stanu gry (kryterium M6: wznowienie po zamknięciu
  przeglądarki); M5 w `ROADMAP` to pętla pytań, nie trwałość.
- `dystansOdcinkaM` liczy dystans łańcuchowy po linii prostej (haversine);
  dystans sieciowy wchodzi w M4 bez zmiany sygnatury (ADR 0014 pkt 1).
- Zniekształcenie znane z ADR 0014: tempo premiuje krótkie odcinki — do
  zbadania na prawdziwych grach w M7 (ewentualne mediany w kubełkach dystansu).
