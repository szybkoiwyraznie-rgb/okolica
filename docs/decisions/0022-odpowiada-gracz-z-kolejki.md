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
