# 0051 — Status graczy multi w panelu Informacje i pod wspólnym wynikiem

- Status: Zaakceptowana (2026-09-16, uwaga terenowa właściciela)
- Data: 2026-09-16

## Kontekst

Po usunięciu żywych wyników widowni (ADR 0044 aneks 2026-09-16) gracz multi
przeglądał grę jak hot-seat i nie miał żadnego miejsca, w którym zobaczyłby,
co robią INNI gracze w trakcie gry. Właściciel chce taki podgląd z powrotem —
ale w pokojowy sposób, którego nie da się pomylić z dawnym panelem żywych
wyników:

> W grze multiplayer (ale nie hotseat!), w każdym trybie (trasa i wyścig),
> dla każdego gracza z hostem włącznie, panel Informacje ma pokazywać status
> gry — tabelę (Imię, zaliczone stacje, poprawne odpowiedzi, status:
> Aktywny / Opuścił grę / Zakończył trasę). Odświeżanie co ~30 s, jeśli ktoś
> jest w panelu. Ta sama tabela może trafić pod wynik gracza, który kończy grę.

## Decyzja

1. **Jedno źródło wierszy — `tabelaPrzebieguMulti()`.** Liczy wiersze dla
   `gra.gracze` (lista uczestników z MOMENTU STARTU — most nie zmienia jej po
   starcie; wyjście w trakcie gry to zdarzenie `rezygnacja`, nie usunięcie).
   Pojedynczy wiersz: `imię`, `zaliczone/N`, `poprawne/udzielone`, `status`.
2. **Zliczanie (odpowiedź właściciela 2026-09-16):**
   - `zaliczone` = liczba zdarzeń `odpowiedz` gracza (ten sam próg, którym
     most domyka grę — stację zamyka dopiero odpowiedź, nie samo dojście);
     licznik z sufitem `N` (bezpieczeństwo przy rozjazdach logów);
   - `poprawne/udzielone` = `postepGracza` (`p.poprawne` / `poprawne + bledne`),
     mianownik rośnie z postępem;
   - `status`: `Opuścił grę` (zdarzenie `rezygnacja`) → `Zakończył trasę`
     (`zaliczone ≥ N`) → inaczej `Aktywny`.
3. **Dwa renderery na jednych danych:** `renderujInformacjeMulti()` (blok
   `#informacje-multi` w panelu Informacje) i `renderujWynikiMulti()` (blok
   `#gra-wyniki-multi` POD wspólną tabelą `#gra-wyniki` ekranu wyniku). Oba
   pokazują się wyłącznie, gdy `STAN.multi?.gra` i ekran `gra` (hot-seat nigdy).
4. **Odświeżanie z ostatniego znanego stanu.** Panel niczego NIE wysyła:
   `renderujInformacjeMulti()` wołają `przelaczInformacje` (przy OTWARCIU),
   `renderujGre` (każde zdarzenie gry) i `onStanGryMulti` (każdy krok pollingu
   — w grze co 30 s). Otwarty panel żyje więc z tym samym pollingiem, który
   i tak się toczy — zero dodatkowych żądań do kwoty Apps Script.
5. **Żywotność** (odpowiedź właściciela): blok informacyjny znika, kiedy
   `STAN.multi` gaśnie — to zbiór punktów wyjścia, które już istnieją
   (`startGry` hot-seata, `wrocNaPoczatek`, `opuscLobby`). Nie dokładamy
   osobnego licznika ani osobnego sprzątania.

## Konsekwencje

- Panel Informacje znowu niesie TROCHE stanu gry — ale to podgląd
  wszystkich, nie sterowanie (ADR 0043 zostaje: koniec gry = ⚙ + TAK,
  żadnych przycisków gry w Informacjach). Węzeł `#informacje-gra` nie wraca.
- Ekran wyniku multi zyskuje „Przebieg gry” pod wspólną tabelą; hot-seat ma
  te same węzły w markupie z `hidden`, więc jego ekran wyniku nie zmienia
  się wizualnie (ADR 0038 — punkt 3 celowo dopuszcza zakładkę doprecyzowaną
  tutaj: podgląd pod tabelą NIE przywraca usuniętych statystyk/szczegółów).
- Kolumna „Poprawne” liczy odpowiedzi UDZIELONE, nie pytania całej trasy —
  mianownik rośnie, co wprost odróżnia ją od kolumny „Zaliczone stacje”.
- Tabela informacyjna styka się z ADR 0042 (jedna mała czcionka): status
  graczy to treść do szybkiego rzutu oka, więc blok `#informacje-multi`
  dostał własny, nieco większy zapis (14 px) — wyjątek, nie odwrócenie reguły.

## Wdrożenie

`index.html` (`#informacje-multi`, `#gra-wyniki-multi` + tbody), `app/app.js`
(`STATUS_GRACZA_MULTI`, `tabelaPrzebieguMulti`, `jestGraMulti`,
`renderujInformacjeMulti`, `renderujWynikiMulti`, import `postepGracza`),
`app/styles.css` (style bloków i wierszy statusu). Piny: `test/kontrakt.test.js`
(węzły + kolejność pod tabelą wyniku), `test/wieloosobowa-ui.test.js` (+3
scenariusze: panel w grze i jego aktualizacja, „Opuścił grę”, przebieg pod
wynikiem), `test/aplikacja.test.js` (+1: hot-seat bez obu bloków).

## Powiązania

ADR 0044 i jego aneks 2026-09-16 (usunięcie żywych wyników), ADR 0038
(minimalny ekran wyniku — aneks poniżej), ADR 0042 (typografia Informacji —
wyjątek dla tabeli statusu), ADR 0043 (Informacje bez sterowania grą),
ADR 0019 (stan gry i zdarzenia na moście — tu jedyne źródło tabeli).

## Aneks 2026-09-16 (numery na ekranie) — „liczone”

Umawiamy się, że kolumny „Stacje” i „Poprawne” są LICZONE z dziennika zdarzeń
gry (`postepGracza` / zliczanie `odpowiedz`), więc każdy telefon dostaje
identyczne liczby bez żadnych nowych pól protokołu mostu.
