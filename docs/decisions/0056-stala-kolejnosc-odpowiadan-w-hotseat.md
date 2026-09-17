# 0056 — Hot-seat: stała kolejność odpowiadania (1. → ostatni), bez rotacji startera

- Status: Zaakceptowana (2026-09-17d, uwaga C z testów terenowych, właściciel)
- Data: 2026-09-17

## Kontekst

Test terenowy (hot-seat, 2+ graczy na jednym telefonie): przy stacji
odpowiadano w kolejności ZACZYNAJĄCEJ SIĘ od rotującego startera — stacja 1
od gracza 1, stacja 2 od gracza 2 itd. (ADR 0009 pkt 2: `gracz odcinka =
stacja mod N`; autor drugiego pytania = następny w kolejce). Właściciel:
„kolejność odpowiadania musi być ZAWSZE stała — przy każdej stacji gracze
odpowiadają w kolejności od pierwszego do ostatniego”.

## Decyzja

1. **Starter nie rotuje.** Gracz odcinka (który „prowadzi” stację na ekranie)
   to ZAWSZE pierwszy gracz listy (`odcinki[].gracz = listaGraczy[0].id`) —
   na KAŻDEJ stacji. Zastępuje ADR 0009 pkt 2.
2. **Pytania idą w stałej kolejności graczy (1. → ostatni):** k-TE pytanie
   stacji w paczce → k-ty gracz listy (zawijanie mod N). W paczkach z
   poziomami (ADR 0055) ta sama reguła per poziom: k-TE pytanie poziomu X →
   k-ty gracz poziomu X; paczki bez poziomów idą kolejno 1. → ostatni.
3. **„Bieżące pytanie” na ekranie** to pierwsze W KOLEJNOŚCI GRACZY (listy),
   nie pierwsze w paczce.
4. **Multi bez zmian:** każdy gracz przechodzi wszystkie stacje sam;
   kolejność odpowiadania jest tu bezprzedmiotowa (jedno wspólne pytanie —
   ADR 0055 pkt 4).

## Konsekwencje

- `app/rozgrywka.js`: `nowaRozgrywka` (odcinki), `graczNaStacji`,
  `graczPytania` (ścieżka bez poziomów), `ktoOdpowiada`/
  `kolejnośćPytanStacji`, `podglad`.
- Piny: rozgrywka (przypisanie i kolejność), aplikacja (przyciski po stacji i
  badge kolejki zawsze „Gracz 1”), wieloosobowa-ui (gość dostaje wspólne
  pytanie, nie „swoje”).
- Interfejs bez zmian oprócz tekstów: kolejka zawsze zaczyna się od pierwszego
  gracza listy.

## Powiązania

0009 (pkt 2 zastąpiony), 0022 (odpowiada gracz z kolejki), 0027 (pytania po
równo; wolna kolejność stacji w wyścigu), 0055 (poziomy).
