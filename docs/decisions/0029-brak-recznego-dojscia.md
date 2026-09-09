# 0029 — Dojście zalicza tylko GPS: ręczne zgłaszanie usunięte z interfejsu

- Status: Zaakceptowana (2026-09-08, decyzja właściciela)
- Data: 2026-09-08

## Kontekst

W grze był przycisk „✋ Jestem na miejscu (ręczne)" (`przycisk-reczne-dojscie`),
który zamykał odcinek bez żadnego pomiaru — stacja dostawała stan
„zaliczona (ręcznie)". Był pomyślany jako ratunek, gdy GPS nie daje fixa
(ADR 0004 pkt 5), i był widoczny ZAWSZE, nie tylko w trybie testowym.

Właściciel po pierwszej prawdziwej rozgrywce (2026-09-08): „Co to za opcja
«Jestem tutaj», która powoduje «zaliczona (ręcznie)»? To chyba tylko w wersji
testowej jest, mam nadzieję? Ale po co to w ogóle, skoro można w wersji testowej
symulować dojście i zaliczyć faktycznie na mapie? Jak wykorzystałem tą opcję, to
już nie dało się po odpowiedzi na pytania przejść do kolejnej stacji (przycisk
«idź do stacji» nieaktywny, wyszarzony). W ogóle usuń to «jestem tutaj» zarówno
w wersji testowej, jak i — nie daj Boże, że tam jest — nie-testowej."

Dwie wady, które to potwierdzają:

1. **Fałszuje grę.** Próg dojścia (ADR 0004) jest regułą gry; przycisk pozwalał
   ją obejść jednym kliknięciem, a wynik i tak szedł na wspólny Drive i do
   rankingów.
2. **Tryb testowy ma własną drogę.** „▶ Symuluj dojście (tryb testowy)" generuje
   prawdziwy strumień fixów i rozstrzyga dojście tym samym kodem co GPS
   (`stanDojscia`), więc ręczny skrót nie jest potrzebny nawet w testach.

## Decyzja

1. Przycisku **nie ma w `index.html`** — ani w zwykłej grze, ani w trybie
   testowym. Dojście zalicza wyłącznie strumień fixów GPS (albo symulacji,
   która jest tym samym kodem z innymi danymi).
2. Gdy fixa nie ma, aplikacja mówi, co robić: komunikat P03 każe wyjść na
   otwartą przestrzeń i przypomina o pominięciu odcinka (ADR 0015 pkt 2) —
   to jawne, uczciwe wyjście z nieosiągalnej stacji.
3. Model rozgrywki (`zakonczOdcinek`, `TRYBY_DOJSCIA.reczne`) i etykieta
   „zaliczona (ręcznie)" **zostają**: zapisane gry i historia mogą zawierać takie
   odcinki, a stary wynik musi się dać odczytać. Nowa gra nie może ich jednak
   wytworzyć — w interfejsie nie ma czym.
4. **Szew dla testów też został usunięty** (dopisek 2026-09-08, ten sam dzień).
   Przez chwilę podpięcie kliknięcia zostawało w `app.js` warunkowo
   (`if (element)`) jako skrót dla testów atrapy DOM. To było półśrodkiem: martwa
   gałąź w kodzie produkcyjnym i jeden jawny wyjątek w kontrakcie „app.js nie
   woła nieistniejących id". Teraz w `app.js` nie ma ani elementu, ani gałęzi,
   a kontrakt nie ma wyjątków. Testy (14 miejsc: 8 w `test/aplikacja.test.js`,
   6 w `test/wieloosobowa-ui.test.js`) zamykają odcinek przez
   `dojdzSymulacja()` — klik w „▶ Symuluj dojście" i aktywne czekanie, aż panel
   drogi zniknie — czyli dokładnie tą drogą, którą ADR wskazuje jako jedyną.
   Gałąź statusu „Dojście zgłoszone ręcznie" w `zakonczOdcinekGry` była przy tym
   martwa i też wypadła.

## Konsekwencje

- ADR 0004 pkt 5 („ręczne zgłoszenie jako ratunek") przestaje obowiązywać
  w części dotyczącej interfejsu; reszta ADR 0004 (próg dojścia, pauza, wymagane
  trafienia) bez zmian.
- Gracz bez GPS nie zamknie stacji — może poczekać na sygnał albo pominąć
  odcinek. To świadomy koszt: lepszy brak punktu niż punkt z powietrza.
- Zgłoszony przy okazji objaw (po ręcznym dojściu nie dało się przejść do
  kolejnej stacji) znika razem z przyciskiem. Ścieżka GPS ma własny test pełnej
  gry (`M6/R7: PEŁNA GRA z symulacją dojścia`), który przechodzi; przycisk
  „Idę do stacji" jest wyszarzony tylko w pauzie, a „Pomiń odcinek" — z definicji
  tylko w drodze (ADR 0015 pkt 2).
