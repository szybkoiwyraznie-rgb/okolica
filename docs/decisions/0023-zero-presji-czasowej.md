# 0023 — Zero presji czasowej: punktacja to dotarcie plus poprawna odpowiedź

- Status: Zaakceptowana (2026-09-07, decyzja właściciela w Partii 2)
- Data: 2026-09-07

## Kontekst

ADR 0014 mierzył graczy stoperem: premia za tempo, kara za ręczne zgłoszenie,
limit odcinka, medal trasy. W grze towarzyskiej (także z dziećmi) to presja,
nie zabawa — a „uczciwość" i tak była umowna (światła, tłum, pogoda).

## Decyzja

1. **Punktacja**: 1 pkt za każdą poprawną odpowiedź (koniec wagi trudności z paczki — protokół rev2), zero składnika
   czasowego. Remisy rozstrzyga kolejność zgłoszeń (sort stabilny).
2. **Koniec kary, limitu, premii, tempa i medalu**: z kodu wypadają
   `PUNKTACJA`, `premiaCzasu()`, `karaRecznaS`, `limitCzasuOdcinkaS`,
   `poLimitie`, tempo, `miaraSprawiedliwosci()` i medal; ze zdarzeń multi —
   pola `czasOdcinkaMs`, `czasOdpowiedziMs`, `punktyBaza`, `premiaCzasu`
   (PROTOKOL §9.2).
3. **Ręczne dojście jest pełnoprawne**: odnotowane w dzienniku, bez kary
   (ADR 0004 pkt 5 po poprawce).
4. **Stacje losowo w promieniu**: układ z sieci albo z pierścienia, bez miary
   „sprawiedliwości" w UI (wybór stacji z ADR 0005 bez zmian).
5. Znaczniki `czasMs` w dzienniku i kotwica `zegarMs` **zostają** — to
   kolejność zdarzeń i wznowienie gry, nie miara wyniku.

## Konsekwencje

- Wynik: punkty i poprawność; historia, tekst i obraz bez czasów.
- Wycofuje ADR 0014; poprawia ADR 0009 pkt 3 i 5, 0004 pkt 5, 0015 pkt 2 i 4.

## Powiązania

0014 (wycofana punktacja czasu), 0009 (model hot-seat), 0004 (dojścia),
0005 (wybór stacji), 0015 (pominięcia), PROTOKOL §9.2 (biała lista pól).
