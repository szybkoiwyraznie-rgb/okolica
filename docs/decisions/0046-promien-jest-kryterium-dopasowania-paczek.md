# 0046 — Promień gry jest kryterium dopasowania paczek: równy promień paczki i setupu

- Status: Zaakceptowana (2026-09-14, uwaga C z testów terenowych właściciela)
- Data: 2026-09-14

## Kontekst

Aneks ADR 0024 z 2026-09-07 („promień nie jest kryterium, a komunikat nazywa
powód”) wyciągnął `promienM` z kryteriów dopasowania z argumentem, że promień
jest wynikiem czasu gry (ADR 0025), nie cechą pytań, a gracz i tak widzi
odległości stacji przed startem. Konsekwencja była tam uczciwie zapisana:
„paczka o promieniu większym niż setup może zostać zaproponowana”.

Terenowe zgłoszenie właściciela (2026-09-14, uwaga C) pokazało cenę tej
zgrubności: przy promieniu gry 1000 m ekran pozycji zaoferował istniejącą
paczkę urodzoną w promieniu 500 m. Jej stacje „nadpisały” ustawienia gry —
gracz wybrał promień, a dostał ciasny obszar paczki, bez żadnego sygnału, że
to dwie różne skale. Trasa gry nie jest sztuką dla siebie: promień mówi, jak
daleko gracz chce się wybrać, a stacje paczki narzucają to siłą.

## Decyzja

1. **`promienM` wraca do kryteriów dopasowania jako RÓWNOŚĆ**: paczka pasuje,
   gdy `meta.promienM` paczki jest równe promieniowi setupu. Bez tolerancji —
   promień to jawnie wybrany zakres gry (funkcja czasu, ADR 0025), a każdy
   jego poziom oznacza inną skalę trasy.
2. **Niepasujące renderują się jak wszystkie inne niepasujące**: taka paczka
   nie wchodzi na listę „▶ Graj z tą paczką”, a komunikat karty nazywa powód
   wprost („promień: paczka „500 m”, setup „1 km””) — ten sam zwyczaj co przy
   wieku, tematach i liczbie pytań (aneks ADR 0024: komunikat nazywa powód —
   ten fragment pozostaje w mocy).
3. **Porównanie działa tylko przy obu liczbach**: brak `promienM` w kryteriach
   (czyste funkcje, starsze wołania) nie dokłada powodu, którego nie da się
   spełnić. W UI promień jest zawsze (karta propozycji znika przy K12).
4. **Pozostałe decyzje aneksu ADR 0024 bez zmian**: tolerancja okolicy ±200 m,
   kotwica szacowana (B19), suma pytań zamiast układu, „komunikat nazywa
   powód”, paczki z innych okolic niewspomniane. Liczba stacji i środek
   transportu dalej NIE są kryteriami.

## Konsekwencje

- Paczka z innego zakresu promienia nigdy nie jest wybieralna — stacje paczki
  nie nadpisują ustawień gry (terenowe zgłoszenie C domknięte).
- Właściciel repozytorium widzi po komunikacie, DLACZEGO paczka nie weszła:
  zmiana czasu gry w setupie (a więc i promienia, ADR 0025) odsłania albo
  chowa paczkę — to celowe, czytelne sprzężenie.
- `powodyNiedopasowania` pozostaje JEDNYM miejscem rozstrzygania dopasowania;
  `dopasujZestawy` przekazuje teraz też `promienM` do kryteriów.
- Stare wołania testowe bez `promienM` w kryteriach zachowują się jak dotąd
  (kryterium milczy) — zmiana nie wymusza aktualizacji nietrafionych miejsc.

## Cytat decyzji

Właściciel, 2026-09-14 (uwagi terenowe, pkt C): „Do gry multiplayer hostuj
wybrałem promień 1000 m, a istniejąca paczka niosła stacje z zakresu 500 m —
nadpisała moje ustawienia. Paczki z innym zakresem promienia muszą renderować
się jako niepasujące (jak inne niepasujące), żeby nie dało się ich wybrać.”
