# 0047 — Strona nie jest szczypalna poza mapą: blokada gestów iOS nad UI, mapa bez zmian

- Status: Zaakceptowana (2026-09-14, uwaga A z testów terenowych właściciela —
  decyzja: „zablokuj szczypanie strony poza mapą")
- Data: 2026-09-14

## Kontekst

ADR 0011 pkt 2–3 zakładały, że CAŁA aplikacja pozostaje przybliżalna palcami
(dostępność: słabowidzący powiększa sobie UI), a tylko mapa ma własne
sterowanie (`touch-action: none` na jej kontenerze). Terenowe zgłoszenie
(uwaga A, 2026-09-14): aplikacja potrafi wznowić się na iPhonie **przybliżona
jako cała strona** — marginesy i górna belka ucięte — a szczypanie zoomuje
wtedy STRONĘ, nie mapę, i nic tego nie cofa.

Diagnoza: Safari iOS przywraca własne powiększenie karty po odświeżeniu
(to zachowanie przeglądarki, nie aplikacji). Meta `user-scalable=no` i
`maximum-scale=1` iOS 10+ **ignoruje**, więc deklaratywnie tego nie wyłączymy.
Właściciel wybrał blokadę gestów w JS (z dwóch opcji: zostawić jak jest /
blokować poza mapą).

## Decyzja

1. **Gesty szczypnięcia strony są blokowane poza mapą**: nasłuch na
   `gesturestart` i `gesturechange` na dokumencie (gesty systemowe iOS)
   woła `preventDefault`, gdy cel gestu leży POZA `.mapa`. Nad mapą gest
   przechodzi bez zmian — mapa ma własne sterowanie (ADR 0011 pkt 3) i
   `touch-action: none` na kontenerze.
2. **Ten fragment zastępuje ADR 0011**: „cała aplikacja szczypalna" (ADR 0011
   pkt 2 ostatnie zdanie i pkt 4 o dostępności przybliżania UI) przestaje
   obowiązywać dla strony; mapa pozostaje nienaruszona. ADR 0011 w reszcie
   (mobile-first, cele dotykowe, kolumny, wklejanie) pozostaje w mocy.
3. **Dostępność**: powiększanie interfejsu przenosi się na powiększenie
   systemowe (iOS: Ustawienia → Dostępność → Powiększenie), które działa
   niezależnie od strony. Zawartość mapy nadal przybliża się gestem — to
   tam dzieje się gra i tam potrzebne jest przybliżenie.
4. **Mechanizm celowo jeden**: bez meta-typu `maximum-scale` (iOS ignoruje),
   bez CSS `touch-action` na `html` (częściowo honorowane, a dokłada drugi
   mechanizm o innej sile działania). Jeden nasłuch = jedno miejsce prawdy
   (LESSONS L6) i jeden test.

## Konsekwencje

- Powrót ze „ściśniętej" karty jest bezpieczny: strona nie dociągnie się
  palcami; użytkownik naprawia widok odświeżeniem, nie walką z gestami.
- Wspólny mianownik dla map: `.mapa` jest JEDYNĄ strefą gestów wielodotykowych
  w aplikacji — warstwy potwierdzeń i karty nad mapą (odliczanie, koniec gry)
  leżą poza `.mapa`, więc szczypanie „przez" niebieskie tło odliczania jest
  blokowane. To pożądane: odliczanie ma być tylko oglądane (ADR 0044).
- Testy: nasłuch istnieje, blokuje poza mapą, nie dotyka mapy (atrapa DOM,
  `wyslijZdarzenieDokumentu`).

## Aneks 2026-09-15 (strona nie przybliża się na fokusu pola) jest w archiwum

iOS Safari przybliża stronę, gdy fokusowane pole ma `font-size` < 16 px — każde
pole tekstowe z palcem ma ≥ 16 px (bez `maximum-scale`/`user-scalable`);
mechanika w CSS i piniach kontraktu. `docs/decisions/archive/aneksy-0047-2026-09-15.md`
(L62/L66, archiwizacja 2026-09-18).
