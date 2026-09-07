# 0009 — Model rozgrywki wieloosobowej: jeden telefon (hot-seat), bez synchronizacji urządzeń

- Status: Zaakceptowana (2026-09-05 — właściciel: „na razie hot-seat"; gra na wielu
  urządzeniach zostaje odłożona w `docs/BACKLOG.md` B1 i wymaga nowego ADR)
- Data: 2026-09-05

## Kontekst

Gra dla „jednego lub kilku graczy": „do kolejnych punktów ma dotrzeć jak
najszybciej kolejny gracz". Zero backendu (ADR 0001): synchronizacja wielu
urządzeń wymagałaby usługi trzeciej (zależności, konta, koszty, nowy model
prywatności). Alternatywa: wszyscy grają na **jednym telefonie** (hot-seat),
rywalizacja na wspólnej trasie.

## Decyzja

1. **Jedno urządzenie = jedna rozgrywka.** Telefon niesie osoba, której wypada
   kolejka (albo „prowadzący", jeśli ustalono inaczej); pozostali idą z nią.
2. **Kolejka graczy jest jawna i cykliczna**: stacje przypisane po kolei
   (`gracz = stacja mod N`), ekran przed startem odcinka mówi **kto idzie**,
   dużym drukiem i kolorem przypisanym do gracza. Zmiana kolejności możliwa
   tylko przed startem gry.
3. **Odcinek zaczyna jawna akcja, kończy dojście** (ADR 0004 pkt 3).
   Dziennik rozgrywki trzyma `{ stacja, gracz, start, koniec, trybDojscia,
   accuracy }` jako kolejność zdarzeń — czasy nie wchodzą do punktacji
   (ADR 0023: zero presji czasowej).
4. **Na pytanie odpowiada gracz z kolejki** (ADR 0022 — ustawienie
   `wspolpraca` usunięte z setupu w Partii 2); odpowiedź spoza kolejki jest
   odrzucana kodem G07. Doradzanie na głos to sprawa graczy, nie reguły.
5. **Punktacja** (ADR 0023): punkty za poprawną odpowiedź (waga z paczki),
   zero składnika czasowego; remisy rozstrzyga kolejność zgłoszeń. Ręczne
   zgłoszenie dojścia (ADR 0004 pkt 5) jest pełnoprawne i bez kary.
6. **Gra na wielu urządzeniach jest odłożona** (`docs/BACKLOG.md` B1) i wymaga:
   nowego ADR, decyzji o usłudze synchronizującej albo o trybie
   „kod rozgrywki + wymiana stanów przez paczki" (bez serwera), oraz osobnego
   rozstrzygnięcia prywatności (ADR 0013). Nie budujemy niczego, co to
   uprzedza — stan gry ma być eksportowalny (ADR 0010), żeby ta ścieżka
   została otwarta.

## Konsekwencje

- Zero kosztów infrastruktury i zero kont — gra jest „wejdź i graj".
- Uczciwość: gracze idą tą samą trasą, ale w innym momencie (światła, tłum) —
  dlatego gra w ogóle nie mierzy czasu (pkt 5, ADR 0023).
- Wątek UX: telefon jest jeden, więc interfejs musi w sekundę pokazywać
  „czyja kolejka" i „ile jeszcze metrów" — bez przewijania i bez małego druku
  (ADR 0011).
- Ograniczenie: gra nie działa dla graczy rozproszonych po mieście
  (każdy swoim tempem). To świadoma rezygnacja na rzecz prostoty i prywatności.
- Testy: `test/rozgrywka.test.js` — przydział kolejek, kolejka odpowiadania,
  punktacja (czyste funkcje z wstrzykiwanym zegarem, bez `Date.now()` w środku).

## Powiązania

0004 (dojścia), 0005 (wybór stacji), 0010 (eksport stanu),
0011 (UI „czyja kolejka"), 0013 (prywatność), 0022 (kolejka odpowiada),
0023 (zero presji czasowej).

## Aneks (2026-09-06): multi-device obok hot-seat (ADR 0019, M11)

Hot-seat na jednym telefonie ZOSTAJE jako tryb domyślny i jedyny działający
offline. Decyzją właściciela (ADR 0019) dochodzi gra na wielu urządzeniach
przez most Drive: parowanie lobby+kod, tryby wyścig i tury, synchronizacja
zdarzeniami BEZ współrzędnych. (Partia 2: punktacja czasu z ADR 0014
wycofana w obu trybach — ADR 0023.)
