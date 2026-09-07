# 0014 — Punktacja czasu: premia względem mediany tempa odcinków (WYCOFANA)

- Status: Wycofana (2026-09-07, decyzja właściciela w Partii 2 — zero presji
  czasowej; zastępuje ADR 0023)
- Data: 2026-09-05

## Co tu było

Premia/potrącenie za tempo odcinka względem mediany (±25% punktów), kara
czasowa za ręczne zgłoszenie (`karaRecznaS`), limit czasu odcinka
(`limitCzasuOdcinkaS`, flaga `poLimitie`) oraz medal sprawiedliwości trasy.
Pełna treść w historii gita (plik sprzed 2026-09-07).

## Dlaczego wycofana

Gra towarzyska ma nie mierzyć graczy stoperem: punktacja to dotarcie plus
poprawna odpowiedź (ADR 0023). Usunięto: `PUNKTACJA`, `premiaCzasu()`,
`mediana()`, `karaRecznaS`, `limitCzasuOdcinkaS`, `poLimitie`, tempo, medal
i pola czasowe zdarzeń multi (`czasOdcinkaMs`, `czasOdpowiedziMs`,
`punktyBaza`, `premiaCzasu`). Znaczniki `czasMs` w dzienniku zostają jako
kolejność zdarzeń, nie miara wyniku.

## Powiązania

0023 (zero presji czasowej), 0009 pkt 3–5 (po poprawkach z Partii 2),
0004 pkt 5 (ręczne dojście bez kary), 0015 pkt 2 i 4 (po poprawkach).
