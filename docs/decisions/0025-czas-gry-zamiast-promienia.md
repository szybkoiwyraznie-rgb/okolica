# 0025 — Czas gry zamiast promienia: promień jest wynikiem, nie polem

- Status: Zaakceptowana (2026-09-07, decyzja właściciela)
- Data: 2026-09-07

## Kontekst

Ekran setupu pytał o „Promień gry (m)" (200–50 000 m, domyślnie z trybu:
1/3/10 km). Organizator nie myśli w metrach — myśli „mam godzinę". Metry
wymagały od niego przeliczenia w głowie prędkości marszu, liczby stacji i czasu
na pytania, a błąd w tym przeliczeniu psuł grę: za duży promień = stacje nie do
dojścia w zaplanowanym czasie, za mały = gra kończy się po kwadransie.

Decyzja właściciela (2026-09-07): pole promienia znika, w jego miejsce
**planowany czas gry** (domyślnie 60 min), a promień liczy aplikacja —
z czasu, sposobu poruszania i liczby pytań. Punkt kalibracyjny właściciela:
**60 min, pieszo, 5 pytań → około 500 m**.

## Decyzja

1. **Pole setupu**: `czasGryMin` (10–480 min, krok 5, domyślnie 60) zamiast
   `promienM`. Walidacja `K19` (pierwszy wolny kod).
2. **`promienM` zostaje w konfiguracji, ale jest WYNIKIEM** — liczy je
   `przeliczenieCzasu()` / `promienZCzasuGry()` (`app/konfig.js`). Wszystko,
   co czytało promień (wybór stacji, cache sieci `okolica:sieci:<gh6>-<R>`,
   kryteria dopasowania paczek, `{PROMIEN_M}` w prompcie, E15), działa bez zmian.
3. **Wzór** (`PARAMETRY_CZASU`, wszystkie stałe jawne i testowane):
   - odpowiedzi: `liczbaStacji × pytaniaNaStacje × 90 s`;
   - droga: `(czasGryMin·60 − odpowiedzi) × 0,4` — reszta czasu to czytanie
     tablic, rozmowa, czekanie na grupę, światła i zapas;
   - trasa: `czas drogi × prędkość trybu` (`predkoscKmh`: 4,5 / 15 / 40);
   - promień: `trasa / (1,4·√liczbaStacji)` — trasa przez N punktów w kole
     o promieniu R ≈ 1,26·√N·R (klasyczne przybliżenie TSP), 1,4 dokłada
     ~10% na kręte chodniki;
   - wynik zaokrąglony do 50 m i zaciśnięty do `OGRANICZENIA.promienM`.
   Kalibracja: 60 min pieszo, 5 stacji × 1 pytanie → odpowiedzi 7,5 min,
   droga 21 min = 1575 m, promień 1575/(1,4·√5) ≈ 503 m → **500 m**.
4. **`TRYBY[x].promienM` usunięte** (1/3/10 km): promień nie jest cechą trybu.
   Z trybu do wzoru wchodzi `predkoscKmh`; etykieta trybu pokazuje teraz
   prędkość (4,5 km/h), nie „1 km".
5. **Migracja**: `oczyscKonfiguracje` zawsze przelicza `promienM` z czasu —
   stary zapis bez `czasGryMin` dostaje 60 min, a jego dotychczasowy promień
   przestaje być źródłem prawdy. Konsekwencja jawna: domyślny promień gry
   maleje z 1000 m do **500 m** (to jest kalibracja właściciela).
6. **UI mówi, skąd liczba** (LESSONS L6): akapit `#setup-promien-info` pod
   polami pokazuje promień i składowe („5 pytań ≈ 7,5 min, droga ≈ 21 min,
   trasa ≈ 1,6 km"), a przelicza się na każdą zmianę czasu, trybu, liczby
   stacji i pytań.
7. **K12/K13 zostają** jako straż dla konfiguracji, które ominęły
   `oczyscKonfiguracje` (ręcznie zmieniony localStorage). Z UI są
   nieosiągalne: promień zawsze mieści się w widełkach i dla trybu pieszego
   nie przekracza ~1,4 km nawet przy 480 min.

## Konsekwencje

- Organizator planuje grę w minutach; metry są pochodną i są pokazane z
  uzasadnieniem, więc nie ma magii ani zgadywania.
- Zmiana sposobu poruszania zmienia zasięg (rower 15 km/h → ~3× dalej niż
  pieszo przy tym samym czasie), co wcześniej robił ręczny wybór trybu.
- Promień zależy teraz także od liczby pytań: 5 stacji × 3 pytania przy 60 min
  daje ~350 m zamiast 500 m — więcej pytań znaczy mniej drogi.
- Testy: punkt kalibracyjny, monotoniczność (czas, tryb, pytania, stacje),
  zacisk do widełek i kroku 50 m, K19, migracja starego zapisu, pole w UI
  i komunikat z uzasadnieniem. Testy sieciowe i paczkowe ustawiają czas gry
  (110 min / 85 min) zamiast wpisywać promień — fixture'y Overpass i paczek
  są ułożone pod 1000 m, a przy 500 m sieć jest słusznie „za uboga".
- `{PROMIEN_M}` w prompcie znaczy teraz „promień wyliczony z planowanego
  czasu", nie „promień wpisany przez organizatora" (`docs/PROTOKOL.md` §2.1).
