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

## Aneks (2026-09-07) jest w archiwum (poza budżetem lektury)

Kolejka odpowiadania obowiązuje w hot-seacie; w wyścigu sieciowym kolejki nie
ma, bo każde urządzenie zna swoje pytanie bez negocjacji, a tryb „tury” zniknął
2026-09-11 (ADR 0019). Dosłownie:
`docs/decisions/archive/aneksy-0022-2026-09-07.md` (L62/L66, 2026-09-17g).

## Aneks (2026-09-12): kolejne pytania stacji rotują po liście graczy (m12-87)

Zgłoszenie właściciela: „Mam dwóch graczy, 5 stacji, po 2 pytania na stację.
Pierwsze pytanie dostaje Gracz 1. Drugie pytanie na tej stacji… dostaje znowu
gracz 1. Powinno pytać na zmianę (kolejno następnego gracza, jeśli jest ich
więcej), a nie, że na danej stacji wszystkie pytania dostaje ten sam gracz.”

**Reguła:** pytanie o indeksie `k` na stacji należy do gracza z kolejki
przesuniętego o `k` pozycji w liście graczy rozgrywki (cyklicznie). Pierwsze
pytanie zostaje przy graczu z kolejki — pkt 1 niniejszego ADR obowiązuje bez
zmian — drugie idzie do następnego gracza w liście, trzecie do kolejnego.
`ktoOdpowiada()` zwraca autorów kolejnych pytań bez duplikatów (przy 3 pytaniach
i 2 graczach trzeci pytanie dzieli autora z pierwszym — tak samo jak paczka
uboższa niż liczba graczy w multi). `stacjaZamknieta` czeka na odpowiedź
KAŻDEGO pytania od JEGO autora, a `zapiszOdpowiedz` odrzuca odpowiedź nie-autora
kodem G07 (wcześniej wystarczyło być „w kolejce”).

Przy jednym pytaniu na stację i w grze sieciowej (`tury`, `wyscig`) nic się nie
zmienia: pierwsze pytanie ma autora z kolejki, a w wyścigu stan ma jednego
gracza, więc rotacja degeneruje do niego.
