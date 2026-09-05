# 0009 — Model rozgrywki wieloosobowej: jeden telefon (hot-seat), bez synchronizacji urządzeń

- Status: Zaakceptowana (2026-09-05 — właściciel: „na razie hot-seat"; gra na wielu
  urządzeniach zostaje odłożona w `docs/BACKLOG.md` B1 i wymaga nowego ADR)
- Data: 2026-09-05

## Kontekst

Właściciel opisuje grę dla „jednego lub kilku graczy", w której „do kolejnych
punktów ma dotrzeć jak najszybciej kolejny gracz". Zero backendu (ADR 0001)
oznacza, że synchronizacja wielu urządzeń musiałaby korzystać z usługi trzeciej
(Firebase, Supabase, własny relay przez WebSocket) — to zależności, konta,
koszty i nowy model prywatności. Alternatywa: wszyscy grają na **jednym
telefonie**, podawanym sobie po kolei (hot-seat), a rywalizacja toczy się na
wspólnej trasie.

## Decyzja

1. **Jedno urządzenie = jedna rozgrywka.** Telefon niesie osoba, której wypada
   kolejka (albo „prowadzący", jeśli ustalono inaczej); pozostali idą z nią.
2. **Kolejka graczy jest jawna i cykliczna**: stacje przypisane po kolei
   (`gracz = stacja mod N`), ekran przed startem odcinka mówi **kto idzie**,
   dużym drukiem i kolorem przypisanym do gracza. Zmiana kolejności możliwa
   tylko przed startem gry (potem wymagałaby przeliczenia uczciwości trasy,
   ADR 0005 pkt 5).
3. **Czas liczy się per odcinek i per gracz**: start odcinka na jawnej akcji
   (ADR 0004 pkt 3), stop po spełnieniu kryterium dojścia. Dziennik rozgrywki
   trzyma `{ stacja, gracz, start, koniec, trybDojscia, accuracy }`.
4. **Pytanie zadaje się graczowi z kolejki**; pozostali mogą doradzać albo nie —
   decyduje ustawienie setupu `wspolpraca`: `solo` (tylko gracz z kolejki
   odpowiada), `zespol` (dowolny gracz, punkty na konto gracza z kolejki),
   `wszyscy` (każdy odpowiada osobno na tym samym telefonie, punkty osobno).
5. **Punktacja** (dopracowanie w M7, ramy tutaj): punkty za poprawną odpowiedź
   (waga tematu/trudności) + premia/potrącenie za czas względem **mediany
   odcinków tej samej stacji dla wszystkich graczy** — a nie względem stałego
   limitu, bo długość odcinka zależy od układu trasy. Ręczne zgłoszenie dojścia
   (ADR 0004 pkt 5) dolicza karę konfigurowalną.
6. **Gra na wielu urządzeniach jest odłożona** (`docs/BACKLOG.md` B1) i wymaga:
   nowego ADR, decyzji o usłudze synchronizującej albo o trybie
   „kod rozgrywki + wymiana stanów przez paczki" (bez serwera), oraz osobnego
   rozstrzygnięcia prywatności (ADR 0013). Nie budujemy niczego, co to
   uprzedza — stan gry ma być eksportowalny (ADR 0010), żeby ta ścieżka
   została otwarta.

## Konsekwencje

- Zero kosztów infrastruktury i zero kont — gra jest „wejdź i graj".
- Uczciwość: gracze idą tą samą trasą, ale w innym momencie (światła, tłum) —
  dlatego punktacja od mediany, a nie od limitu (pkt 5).
- Wątek UX: telefon jest jeden, więc interfejs musi w sekundę pokazywać
  „czyja kolejka" i „ile jeszcze metrów" — bez przewijania i bez małego druku
  (ADR 0011).
- Ograniczenie: gra nie działa dla graczy rozproszonych po mieście
  (każdy swoim tempem). To świadoma rezygnacja na rzecz prostoty i prywatności.
- Testy: `test/rozgrywka.test.js` — przydział kolejek, liczenie czasów,
  punktacja (czyste funkcje z wstrzykiwanym zegarem, bez `Date.now()` w środku).

## Powiązania

0004 (czasy i dojścia), 0005 (uczciwość trasy), 0010 (eksport stanu),
0011 (UI „czyja kolejka"), 0013 (prywatność).
