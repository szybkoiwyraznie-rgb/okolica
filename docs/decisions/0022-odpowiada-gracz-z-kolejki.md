# 0022 — Odpowiada gracz z kolejki: koniec ustawienia `wspolpraca`

- Status: Zaakceptowana (2026-09-07, decyzja właściciela w Partii 2)
- Data: 2026-09-07

## Kontekst

ADR 0009 pkt 4 dawał trzy tryby odpowiadania (`solo` / `zespol` / `wszyscy`)
przełączane w setupie. W praktyce wybór komplikował ekran i reguły punktacji,
a gra towarzyska i tak toczy się kolejką: kto doszedł, ten odpowiada.

## Decyzja

1. Na pytanie stacji odpowiada **zawsze gracz z kolejki** (`ktoOdpowiada()`
   zwraca jednego gracza). Ustawienie `wspolpraca` znika z setupu i z kodu.
2. Odpowiedź spoza kolejki jest odrzucana kodem **G07** („nie Twoja kolej").
3. Doradzanie na głos pozostaje sprawą graczy, nie reguły — aplikacja go
   nie modeluje.

## Konsekwencje

- Setup krótszy o jedno pole; `test/rozgrywka.test.js` pinuje kolejkę-only.
- Zastępuje ADR 0009 pkt 4 (poprawiony w Partii 2).

## Powiązania

0009 (model hot-seat), 0015 (kody G; G07 po poprawce).
