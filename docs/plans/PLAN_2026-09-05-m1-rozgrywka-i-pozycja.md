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
- [ ] F5 — dokumentacja po wykonaniu: `ROADMAP` (M1 ✅), `ARCHITECTURE` (jeśli
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
i eksport pliku (`app/trwalosc.js`, M5), ekran gry i pauza/wznowienie (M6),
podsumowanie graficzne i udostępnianie (M7).

## Podsumowanie wykonania

(uzupełnić na końcu: zakres, commity, liczba testów, rzeczy otwarte)
