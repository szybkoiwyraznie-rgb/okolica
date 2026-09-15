# 0027 — Pytania po równo na gracza (wdrożone) i wolna kolejność stacji w grze sieciowej (projekt)

- Status: Zaakceptowana (2026-09-07, decyzja właściciela; część A i część B wdrożone)
- Data: 2026-09-07

## Kontekst

Właściciel zgłosił dwie rzeczy naraz i zapytał, czy da się je połączyć:

1. **Hot-seat**: pytań ma być co najmniej tyle co stacji, a w tym przypadku
   stacje muszą dzielić się przez liczbę graczy; domyślnie pytań jest
   `stacje × gracze` (każdy gracz odpowiada raz przy każdej stacji), a całość
   musi dzielić się równo między graczy.
2. **Gra sieciowa bez tur**: gospodarz zakłada grę, ustawia setup i generuje
   pytania, pozostali dołączają z własnych telefonów i dostają sygnał startu;
   stacje odwiedza kto chce i w jakiej chce kolejności, każdy odpowiada na
   pytanie swojej stacji (1 pkt za poprawną), a pierwszy gracz, który zaliczy
   wszystkie stacje, dostaje premię `liczba graczy − 1`, drugi `− 2`, …, ostatni 0.
   Podsumowanie, gdy wszyscy skończą albo gospodarz kliknie „Zakończ Grę";
   wynik i ranking widoczne na wszystkich urządzeniach.

Te dwa wymagania są **tym samym modelem pytań**: paczka ma `stacje × gracze`
pytań, więc przy każdej stacji jest dokładnie jedno pytanie dla każdego gracza.
W hot-seacie pytania rozdaje kolejka (`ktoOdpowiada`, ADR 0022), w grze
sieciowej — urządzenie gracza. Stąd wspólna decyzja.

## Decyzja — część A: hot-seat (WDROŻONE)

1. **Równy podział (K22)**: `liczbaStacji × pytaniaNaStacje` musi dzielić się
   przez `liczbaGraczy` bez reszty. Komunikat podaje liczby i trzy wyjścia
   (zmień graczy, stacje albo pytania na stację).
2. **Minimum**: pytań jest co najmniej tyle co stacji — wynika z dotychczasowego
   K11 (`pytaniaNaStacje ≥ 1`), więc osobnego kodu nie ma.
3. **Domyślnie `pytaniaNaStacje = liczbaGraczy`** (`domyslnaKonfiguracja(n)`,
   `oczyscKonfiguracje` gdy źródło nie podaje pytań, oraz UI: zmiana liczby
   graczy przestawia pole pytań). Wtedy `stacje × gracze` dzieli się zawsze.
4. **Widełki pytań na stację: 1–8** (było 1–3) — górna granica to maks. liczba
   graczy, bo każdy może odpowiadać przy każdej stacji.
5. Konsekwencja jawna: dotychczasowe układy „2 graczy × 3 stacje × 1 pytanie"
   są **niepoprawne** (3 pytania nie dzielą się na 2 graczy) — fixture'y testów
   przeszły na 3 graczy.

## Decyzja — część B: gra sieciowa bez tur (WDROŻONE 2026-09-07)

Model docelowy, spójny z częścią A i z istniejącym protokołem RO-*:

1. **Role**: gospodarz zakłada grę (setup + pytania z paczki), stan `lobby` →
   `w-trakcie` jest sygnałem startu dla dołączających (polling już go niesie).
2. **Wolna kolejność**: stacje NIE są przypisane do tury. Gracz na swoim
   telefonie wybiera dowolną niezaliczoną przez siebie stację, a pytanie bierze
   z paczki **wg swojego indeksu gracza** (`pytaniaNaStacje = liczbaGraczy`,
   więc pytanie `k` przy każdej stacji należy do gracza `k`). Dzięki temu nie ma
   wyścigu o pytanie ani blokady przy braku zasięgu — każde urządzenie wie
   swoje bez negocjacji.
3. **Punktacja**: 1 pkt za poprawną odpowiedź (ADR 0023 pkt 1 — bez składnika
   czasowego), liczone ze zdarzeń `odpowiedz` w dzienniku gry.
4. **Koniec gracza**: gracz skończył, gdy ma odpowiedź przy każdej stacji.
   Kolejność kończenia = kolejność ostatnich zdarzeń gracza w dzienniku
   (znacznik mostu), nie zegar urządzenia.
5. **Premia za kolejność**: pierwszy `(G − 1)`, drugi `(G − 2)`, …, ostatni 0 —
   dodawana w podsumowaniu, nie przy każdej odpowiedzi (dzięki temu wynik
   częściowy nie sugeruje premii, której jeszcze nie ma).
6. **Podsumowanie**: gdy wszyscy gracze skończyli ALBO gospodarz kliknie
   „Zakończ Grę" (istniejący dwustopniowy mechanizm zakończenia). Ranking i
   karty graczy rozsyłają się pollingiem jak dotąd.
7. **Co faktycznie zostało zmienione** (rozliczenie projektu):
   - `app/rozgrywka.js`: `skierujDoStacji()` + `stacjeDoWyboru()` (kod G14 dla
     stacji zamkniętej/pominiętej). Bramkowania turą w grze sieciowej NIE było
     co usuwać: lokalny stan gry multi zawsze dotyczy jednego gracza
     (`liczbaGraczy: 1`), więc kolejka degeneruje do „ja" — premia kolejności
     żyje w wynikach mostu, nie w `podsumowanie()`;
   - `app/wieloosobowa.js`: `premiaZaKolejnosc()` + premia w `przeliczWyniki`
     (poza `punkty` do końca gry); `postepGracza` dostał `czasOdcinkowMs`, żeby
     kształt wyników był IDENTYCZNY z mostem;
   - `app/app.js`: `pytaniaDlaGracza()` (pytanie wg indeksu gracza, indeks
     zawija się przy mniejszej paczce), lista stacji do wyboru
     (`#multi-wybor-stacji`), postęp `ile z ilu` i kolumna premii w tabelach;
   - `docs/setup/apps-script-repo-paczek.gs`: premia w `przeliczWyniki` i stan
     `zakonczona` PRZED liczeniem wyników (ta sama reguła „koniec" co w
     aplikacji). Walidacja zdarzeń bez kolejki była już gotowa — serwer
     bramkuje tury tylko przy `tryb === 'tury'`;
   - `docs/PROTOKOL.md` §9: reguły wyścigu i premii, pole `wyniki.premia`
     (schematy RO-* bez zmiany kształtu — doszło jedno pole wyników);
   - ADR 0022 dostał aneks (kolejka zostaje w hot-seacie i w turach).
   - testy: `test/most-gra.test.js` (parity premia/wyniki most ↔ aplikacja),
     premia 3/2/1/0 dla 4 graczy, kolejność z `kolejnosc` mimo kłamiących
     zegarów, koniec przez gospodarza przy nieukończonych, wolna kolejność
     w silniku (G14/G10) i w UI (wybór stacji, pytanie per gracz, malejąca
     lista), tury bez listy wyboru.

## Konsekwencje

- Ta sama paczka (`stacje × gracze` pytań) obsługuje hot-seat i grę sieciową —
  odpowiedź na pytanie właściciela „czy da się to połączyć": tak, i to jest
  warunek połączenia.
- K22 blokuje przejście z ekranu 1, więc źle dobrany setup nie wchodzi do gry;
  domyślne wartości są zawsze poprawne.
- Więcej pytań na stację = dłuższy prompt i dłuższa odpowiedź modelu (8 graczy
  × 5 stacji = 40 pytań) — limit znaków wklejenia i budżet promptu trzeba
  sprawdzić przy wdrożeniu części B (BACKLOG B20).

## Aneksy (2026-09-11): przeniesione poza budżet lektury

Dwa aneksy z 2026-09-11 („tryb tury usunięty — Wspólna Trasa w jego miejsce”
oraz „stała premia 3/2/1 za kolejność ukończenia”) leżą w
`docs/decisions/archive/aneksy-0027-2026-09-11.md`. Reguły, które po nich
zostały, są żywe gdzie indziej: tryby gry opisuje ADR 0019 (aneks 2026-09-11),
a pulę premii — aneks 2026-09-13 poniżej (ten z 2026-09-11 zastąpił).

## Aneks 2026-09-13 (m12-105) — pula premii zależy od grających, którzy dograli (uwaga L)

Właściciel (2026-09-13, uwaga L z testów terenowych): „Punktacja zależy od
ilości grających w momencie zakończenia gry (ci którzy się odłączyli wcześniej
nie liczą się do wyznaczania punktacji). Przy 1 grającym dotarcie daje 0 pkt.
Przy 2 grających dotarcie pierwszego daje 1 pkt, drugi 0 pkt. Przy 3 grających
odpowiednio 2, 1, 0 pkt. Przy 4 grających i więcej odpowiednio 3, 2, 1, 0, 0,
… itd.”

1. **Pula = min(3, grający − 1)**, gdzie „grający” to gracze bez zdarzenia
   `rezygnacja` w momencie zakończenia gry. Pierwszy z tych, którzy zamknęli
   wszystkie stacje, dostaje `pula`, drugi `pula − 1`, i tak dalej aż do zera:
   1 grający → 0 pkt, 2 → 1/0, 3 → 2/1/0, 4 i więcej → 3/2/1/0…
2. **Odłączeni wcześniej nie liczą się ani do puli, ani do miejsc.** Rezygnacja
   zmniejsza pulę: dwóch graczy, z których jeden zrezygnował, gra o 1 pkt,
   nie o 3. To zastępuje aneks z 2026-09-11 (stała 3/2/1 niezależnie od liczby
   graczy) — przy 4 grających i więcej wynik jest ten sam, przy 2 i 3 mniejszy.
3. **Sufit 3 pkt zostaje** (`MAKS_PREMIA_KOLEJNOSCI` w `app/wieloosobowa.js`):
   duże gry nie zmieniają punktacji, a premia nie może przerosnąć punktów
   z odpowiedzi przy krótkiej paczce.
4. Reszta bez zmian: kolejność z `kolejnosc` zdarzeń mostu (nie z zegara
   urządzenia), rezygnujący i niedokończeni bez premii, ukończenie PRZED
   przedwczesnym końcem gry premię zachowuje, premia wchodzi do `punkty`
   dopiero w podsumowaniu, a w hot-seat premii nie ma wcale (ADR 0026 aneks).

Reguła nadal żyje w dwóch miejscach (`app/wieloosobowa.js` i
`docs/setup/apps-script-repo-paczek.gs`), a zgodność pilnuje
`test/most-gra.test.js` (wykonuje tekst mostu i porównuje wyniki z aplikacją)
oraz `test/wieloosobowa.test.js` (pule dla 1/2/3/4/5 grających i rezygnacja
w trakcie). Zdanie o punktacji w UI (`#multi-punktacja`) mówi wprost
o zależności od liczby grających — pin w `test/kontrakt.test.js`.

## Aneks 2026-09-14 (m12-115, uwaga F) — Wyścig bez warstwy wyboru stacji

Pkt 2 części B („gracz wybiera dowolną niezaliczoną stację”) zostaje jako
**reguła silnika**: telefon wykrywa dojście do dowolnej stacji, której ten
gracz jeszcze nie zaliczył. Warstwa `#multi-wybor-stacji` i drugi klik
„▶ Idę do stacji” umarły — po pytaniu przycisk „Idź dalej ->” wraca od razu
na mapę, a kolejny odcinek rusza sam (`nastepnaStacja` / `wznowGre` bez
bramki). Pasek dolny w wyścigu mówi „Jacek. Stacja 3/5” zamiast dystansu.
`renderujWyborStacji()` to no-op. Punktacja, premia i pytanie per indeks
gracza bez zmian.

## Aneks 2026-09-15 (m12-126, uwaga B) — liczby pytań nie wybiera organizator

Właściciel po teście terenowym: „w setupie hot-seat znika pytanie o liczbę pytań
na stację — przy każdej stacji odpowiada każdy gracz, więc pytań jest
`liczba stacji × liczba osób grających`”.

Część A pkt 3 („domyślnie `pytaniaNaStacje = liczbaGraczy`”) przestaje być
domyślną wartością, a staje się **jedyną regułą**: wylicza ją
`pytaniaNaStacjeDla({ liczbaGraczy, rodzajGry })` w `app/konfig.js` (hot-seat =
liczba graczy z listy, multi = 1), a `oczyscKonfiguracje` nadpisuje ją po
dopelnieniu listy graczy. Pole setupu oraz widełki i równy podział (pkt 1, 2 i 4)
znikają razem z kodami K11 i K22 — przy jednozdaniowej regule nie ma układu,
który łamałby podział, więc nie ma czego pilnować. Gra sieciowa bez zmian:
jedno pytanie na stację i wszyscy odpowiadają na to samo (pkt części B zostaje).

- Liczbę mnoży nadal jedno miejsce, `liczbaPytan(konfig)`, więc prompt
  (`{LICZBA_PYTAN}`) i walidator (E03) zmieniły źródło liczby, nie kształt.
- Sufitem jest `OGRANICZENIA.pytaniaNaStacje.max` (8) — tyle samo, co maks.
  liczba graczy (pkt 4), więc ani jeden, ani drugi próg się nie zmienił.
- `WORKFLOW.md` §3 i legenda `{LICZBA_PYTAN}` w `PROTOKOL.md` opisują ekran bez
  pola pytań; powrót pola łapie `test/dryf-dokumentow.test.js` (martwa fraza) i
  pinezka nieobecności w `test/kontrakt.test.js`.
- Fixture'y testów składają paczkę `stacje × graczy` pytań i prowadzą gracza po
  całej stacji (`odpowiedzNaStacje` w `test/aplikacja.test.js`) — przy trzech
  graczach stacja to trzy pytania, więc „jedno kliknięcie i dalej” już nie wystarcza.
