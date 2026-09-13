# 0043 — Grę kończy ikona ⚙ START GRY z wpisaniem TAK (przycisk „Zakończ grę” znika)

- Status: Zaakceptowana (2026-09-13, uwagi H1 i I z testów terenowych właściciela)
- Data: 2026-09-13

## Kontekst

Koniec gry mieszkał w dwóch miejscach i w obu był niewygodny:

1. W panelu gry stał przycisk `#przycisk-zakoncz-gre` („■ Zakończ grę”), który
   w drodze był przenoszony — razem ze swoim węzłem — do panelu ⓘ Informacje
   (ADR 0036 aneks 2026-09-13, uwagi B/E/F). Informacje dostawały więc kawałek
   sterowania grą, którego właściciel tam nie chciał.
2. Zabezpieczeniem przed przypadkowym kliknięciem był drugi klik
   (`STAN.graZakonczonaUzbrojone`, etykieta „⚠ Kliknij ponownie, aby zakończyć”).
   Na telefonie w marszu dwa kliki obok siebie to żadna bariera — a równocześnie
   zgłoszenie J (2026-09-12) kazało zgasić ikonę ⚙ START GRY w trakcie gry, bo
   jej klik otwierał setup i nadpisywał `STAN.rozgrywka` bez ostrzeżenia.
   Wyszła z tego ikona martwa w chwili, gdy gracz najbardziej jej potrzebuje.

Właściciel po testach terenowych 2026-09-13: przycisk „ZAKOŃCZ GRĘ” ma zniknąć
z Informacji i zostanie rozwiązany inaczej (uwaga H1), a tym „inaczej” jest
uwaga I: ikona ⚙ START GRY w nagłówku przestaje być wyszarzona i w trakcie gry
otwiera małą warstwę na środku ekranu z pytaniem „Czy na pewno chcesz zakończyć
aktualną grę?” oraz polem, w które trzeba wpisać TAK; przycisk
„ZAKOŃCZ AKTUALNĄ GRĘ” jest zablokowany, dopóki pole nie zawiera TAK
(wielkość liter bez znaczenia).

## Decyzja

1. **Przycisku `#przycisk-zakoncz-gre` i jego slotu NIE MA** — ani w panelu gry,
   ani w Informacjach. Węzeł `#informacje-gra` też został usunięty, więc
   Informacje nie niosą już ŻADNEGO elementu gry (odwrócenie punktu 1 aneksu
   2026-09-13 do ADR 0036). W drodze nad mapą zostaje sam pasek.
2. **Ikona ⚙ START GRY nigdy nie jest wyszarzona** (`setup.disabled = false`).
   W trakcie gry jej klik otwiera warstwę `#ekran-koniec-gry` i działa jak
   przełącznik (drugi klik zamyka); poza grą zachowanie zostaje dawne: z kroku
   gry wraca na mapę startową, spoza niej otwarta setup (F3). Ochronę przed
   utratą gry, którą dawało wyszarzenie (zgłoszenie J), przejmuje warstwa
   potwierdzenia — przypadek „klik w ikonę podczas marszu” kończy się pytaniem,
   nie resetem `STAN.rozgrywka`.
3. **Warstwa jest mała i na środku** (`#ekran-koniec-gry`, `max-width: 340px`,
   `z-index: 30` — nad Informacjami i rankingiem, które mają 20) i zachowuje się
   jak każdy panel centralny (ADR 0034): krzyżyk, Escape, zamknięcie przy każdym
   kroku gry, `inert` dla reszty paneli, przygaszenie liczone wspólnie. Warstwy
   NIE świecą równocześnie (wzorzec z rankingu): otwarcie potwierdzenia gasi
   podgląd mapy, Informacje i ranking (`body.koniec-gry-otwarte` wygasza resztę
   paneli), a otwarcie Informacji albo rankingu zamyka potwierdzenie — inaczej
   `visibility: hidden` z cudzej klasy pokazałoby pustą kartę nad grą.
4. **Potwierdzeniem jest wpisanie TAK, nie drugi klik.** Stan
   `STAN.graZakonczonaUzbrojone` został usunięty; przycisk
   `#przycisk-koniec-gry` odblokowuje reguła `value.trim().toLowerCase() === 'tak'`
   sprawdzana na każde zdarzenie `input`, a pole jest czyszczone przy każdym
   otwarciu warstwy. Bez `confirm()` (ADR 0015 pkt 6 nadal obowiązuje).
5. **Potwierdzony koniec idzie tą samą ścieżką co dawny przycisk**: hotseat →
   `zakonczGreRecznie()` (wynik wcześniej, zapis zostaje, historia znaczy grę
   jako przerwaną); gra wieloosobowa → organizator woła `zakonczGreMulti()`,
   a pozostali `rezygnujZGryMulti()`, więc reszta gra dalej (ADR 0019 pkt 5,
   doprecyzuje to uwaga G).
6. **W grze wieloosobowej warstwa jest ta sama** — jeden koniec gry na jeden
   telefon, bez drugiego przycisku dla hosta (przycisk hosta z lobby umrze
   z ekranem po starcie gry — uwaga F, ADR 0044).

## Konsekwencje

- Informacje są znowu wyłącznie informacjami: protokół, prywatność, diagnostyka,
  stopka — i jedna czcionka (ADR 0042). Nic z gry tam nie wędruje, więc znika
  też mechanika przenoszenia węzła (`appendChild` między slotem a Informacjami).
- Koniec gry wymaga trzech ruchów (ikona → wpisanie TAK → przycisk), co jest
  celowo wolniejsze niż dawniejsze dwa kliki: właściciel chce decyzji, nie
  przypadkowego zakończenia gry w trakcie marszu.
- Ikona ⚙ ma teraz dwie role i mówi o tym `title`: „START GRY — w trakcie gry
  otwiera zakończenie aktualnej gry” / „START GRY — ustawienia gry”. `aria-pressed`
  zapala się też wtedy, gdy otwarta jest warstwa końca gry.
- Znacznik `STAN.graZakonczonaRecznie` zostaje (historia gier, wynik wczesny),
  a razem z nim reguła `czyGraToczySie()` — jedna dla ikony i dla warstwy, bo
  ich rozjechanie skończyłoby się setupem otwartym nad żywą grą.
- Piny: „kontrakt ADR 0043” w `test/kontrakt.test.js` (kształt warstwy w HTML,
  brak starych id-ów w HTML i w kodzie, reguła TAK, przełącznik ⚙, ścieżka
  multi/hotseat, Escape i `inert`), plus przepięte testy w `test/aplikacja.test.js`
  (pomocnik `zakonczGrePrzezWarstwe` i `wpisz()` w atrapie DOM).

## Wdrożenie

`index.html` (warstwa `#ekran-koniec-gry`, usunięty przycisk, slot i
`#informacje-gra`), `app/app.js` (`czyGraToczySie`, `otworzKoniecGry`,
`zamknijKoniecGry`, `przelaczKoniecGry`, `odswiezKoniecGry`,
`zakonczGreZPotwierdzenia`, nasłuchi, Escape, `PANELE`), `app/styles.css`
(wymiary warstwy i nagrobek usuniętych reguł) — ?v=m12-107; `test/helpers/dom.js`
(pomocnik `wpisz`).

## Powiązania

ADR 0036 (pasek w drodze; aneks 2026-09-13 zawężony tą decyzją do zera węzłów
gry w Informacjach), ADR 0038 (minimalny ekran wyniku — niezmieniony),
ADR 0040 (gra bez pauzy: w drodze zostaje pasek), ADR 0011 (cele dotykowe
i dostępność), ADR 0015 pkt 6 (brak `confirm()`), ADR 0019 (koniec gry w multi),
ADR 0042 (Informacje jedną czcionką), ADR 0034 (wspólny panel centralny).
