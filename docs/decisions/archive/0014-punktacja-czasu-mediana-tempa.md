# 0014 — Punktacja czasu: premia względem mediany tempa odcinków (WYCOFANA)

- Status: Wycofana (2026-09-07, decyzja właściciela w Partii 2 — zero presji
  czasowej; zastępuje ADR 0023)
- Data: 2026-09-05

## Co tu było i dlaczego zniknęło

Premia/potrącenie za tempo odcinka względem mediany (±25% punktów), kara za
ręczne zgłoszenie, limit czasu odcinka i medal sprawiedliwości trasy. Gra
towarzyska nie mierzy graczy stoperem: punktacja to dotarcie plus poprawna
odpowiedź. Listę usuniętych identyfikatorów i zasady zastępcze niesie ADR 0023;
pełna treść tego pliku — w historii gita (wersja sprzed 2026-09-07).

## Co zostało z dawnej decyzji (pkt 1)

Wycofanie dotyczy wyłącznie **punktacji czasu**. Punkt 1 dawnej treści —
**dystanse odcinków liczone z wyniku sieci drogowej** (macierz `dystanseOdcinkowM`
z ADR 0005, a przy braku sieci pierścień z jawną etykietą „w linii prostej”) —
obowiązuje dalej i cytują go żywe nośniki: `app/stacje.js` (`dystanseOdcinkowM`),
`app/rozgrywka.js` (walidacja pola dystansów), `app/app.js` (opis celu stacji)
i `docs/ARCHITECTURE.md`. Ten akapit istnieje po to, żeby cytat „ADR 0014 pkt 1”
miał pokrycie w pliku, a nie tylko w historii gita (LESSONS L31).

## Powiązania

0023 (zero presji czasowej), 0009 pkt 3–5 (po poprawkach z Partii 2),
0004 pkt 5 (ręczne dojście bez kary), 0015 pkt 2 i 4 (po poprawkach).
