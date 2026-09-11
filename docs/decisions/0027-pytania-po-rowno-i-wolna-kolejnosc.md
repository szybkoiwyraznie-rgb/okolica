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

## Aneks (2026-09-11): tryb „tury" usunięty — kolejność bez kolejki

Część B mówiła o „turach bez listy wyboru" jako trzecim trybie. Właściciel
przepisał tryby (ADR 0019 aneks 2026-09-11): „tury" zniknęły, a ich miejsce
zajęła **Wspólna Trasa** (`trasa`) — też bez listy wyboru, ale bez
przypisywania stacji do graczy: KAŻDY przechodzi WSZYSTKIE stacje PO KOLEI
we własnym tempie. Punktacja i premia za kolejność ukończenia — bez zmian
(premia jest trybo-agnostyczna od początku). Wyścig na Orientację
(dawny `wyscig`) zostaje: dowolna kolejność, lista wyboru, per-gracz pytanie.

## Aneks (2026-09-11, m12-74): stała premia 3/2/1 za kolejność ukończenia

Część B pkt 5 mówiła o premii zależnej od liczby graczy (pierwszy G−1, …,
ostatni 0). Właściciel zastąpił ją **stałą**: **3 pkt za 1. miejsce, 2 pkt
za 2., 1 pkt za 3.** — 4. i dalsi: 0, niezależnie od liczby graczy.
Zasady bez zmian: kolejność z `kolejnosc` zdarzeń mostu (nie z zegara
urządzeń), rezygnujący i niedokończeni bez premii, a **ukończenie wszystkich
stacji PRZED przedwczesnym końcem gry liczy się jak zwykle** — host kończący
grę przyciskiem nie odbija premii tym, którzy zdążyli. Reguła jest w dwóch
miejscach (`app/wieloosobowa.js` i `.gs`) i pilnuje jej `test/most-gra.test.js`
(wykonuje tekst mostu) oraz `test/wieloosobowa.test.js`.
