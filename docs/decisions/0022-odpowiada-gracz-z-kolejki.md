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

## Aneks (2026-09-07): kolejka zostaje w hot-seacie i w turach, nie w wyścigu

ADR 0027 część B wprowadził grę sieciową bez tur: w trybie `wyscig` każdy gracz
idzie do wszystkich stacji w dowolnej kolejności i odpowiada na pytanie o swoim
indeksie (`pytaniaNaStacje = liczbaGraczy`). **Niniejszy ADR nie jest uchylony**
— reguła „na stacji odpowiada gracz z kolejki" obowiązuje dalej w:

- hot-seacie (jedno urządzenie, wiele osób przy nim) — tam kolejka jest jedynym
  sposobem rozdzielenia pytań między ludzi stojących przy jednym telefonie;
- grze sieciowej w trybie `tury` — tam stacja należy na stałe do jednego gracza.

W wyścigu sieciowym kolejki nie ma, bo nie ma o co się spierać: każde urządzenie
zna swoje pytanie bez negocjacji, a serwer pilnuje tylko spójności (jedna
odpowiedź gracza na stację). Technicznie: `ktoOdpowiada()` zwraca gracza
z kolejki dla stanu hot-seat, a gra sieciowa buduje lokalny stan JEDNEGO gracza
(`liczbaGraczy: 1`), więc kolejka degeneruje do „ja" — bez specjalnego przypadku
w silniku.


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
