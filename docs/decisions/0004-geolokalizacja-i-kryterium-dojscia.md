# 0004 — Geolokalizacja `watchPosition` i kryterium dojścia do stacji

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Aplikacja musi **przez cały czas** znać pozycję gracza i sama rozstrzygnąć
dojście do stacji — bez klikania „jestem" (jedna z najważniejszych cech).
Realia: GPS 5–30 m w terenie, 30–100 m w zabudowie, w budynku bezużyteczny;
`watchPosition` tylko w kontekście bezpiecznym (HTTPS/localhost); zgoda raz
na sesję; ciągły GPS je baterię.

## Decyzja

1. **Jeden watcher na rozgrywkę**: `navigator.geolocation.watchPosition(ok,
   blad, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })`,
   uruchamiany po akceptacji konfiguracji, zamykany przez `clearWatch()` na
   końcu gry i przy przejściu w tło (`visibilitychange` — oszczędność baterii,
   z komunikatem „wznowiono śledzenie").
2. **Kryterium dojścia** (czysta funkcja `czyDotarl(fix, stacja)`):
   `odległość(fix, stacja) ≤ próg`, gdzie
   `próg = ogranicz(max(25 m, 1.2 × fix.accuracy), 25 m, 100 m)`,
   oraz **dwa kolejne fixy** spełniające warunek (debounce przeciw pojedynczym
   odbiciom sygnału). Próg jest zapisany w paczce rozgrywki — zmiana w kodzie
   nie zmienia trwającej gry.
3. **Czas** mierzy `performance.now()` (monotoniczny, odporny na zmianę zegara
   systemowego i strefy); `Date.now()` służy wyłącznie do znaczników
   w paczce/wyniku. Pomiar odcinka startuje **na jawnej akcji użytkownika**
   (`START`, „następna stacja"), nie automatycznie — gracz decyduje, kiedy rusza.
4. **Jawność niedokładności**: badge „±X m" przy pozycji, ostrzeżenie przy
   `accuracy > 100 m`, kreska dokładności rysowana na mapie (ADR 0003 pkt 4).
   Gracz widzi, dlaczego stacja się „nie zapala".
5. **Tryb ręczny jako część gry, nie wyjątek**: przycisk „jestem na miejscu"
   dostępny zawsze; jego użycie zapisuje zdarzenie w dzienniku rozgrywki,
   bez kary (kara czasowa usunięta w Partii 2, ADR 0023). Bez tego gra jest
   niegrywalna w budynku, w metrze i na urządzeniach bez GPS.
6. **Tryb testowy** (`?tryb=test`): ręczne współrzędne + symulacja trasy
   (lista fixów odtwarzana z zadaną częstotliwością). To jedyny sposób
   weryfikacji rozgrywki w sandboxie bez GPS (ENVIRONMENT §4.1, §5) i sposób
   właściciela na testowanie bez wychodzenia z domu.
7. **Brak zgody / niedostępne API** nie jest błędem krytycznym: aplikacja
   wyjaśnia, co zrobić (HTTPS, uprawnienia), i proponuje tryb ręczny albo
   testowy. Zero „białego ekranu".

## Konsekwencje

- Ciągły GPS = realny koszt baterii (godzina gry to kilkanaście procent).
  Mitygacja: `maximumAge`, pauza w tło, komunikat w UI; w przyszłości strategia
  „budzenie przy zbliżaniu się" (BACKLOG B6).
- Próg dojścia jest kompromisem: za mały → gra się zacina w zabudowie,
  za duży → zalicza stację z drugiego końca ulicy. Wartości domyślne są
  hipotezą do zweryfikowania **w terenie** (`docs/WORKFLOW.md` §4) i zapisania
  w `docs/LESSONS.md`.
- Funkcje `czyDotarl`, `odlegloscM`, `czasOdcinka` są czyste i testowalne na
  fixture'ach fixów (`test/fixtures/trasa-*.json`) — bez mockowania
  `navigator.geolocation` w testach.
- Prywatność: fixy zostają w pamięci aplikacji i w dzienniku rozgrywki
  w `localStorage`; nigdzie nie są wysyłane (ADR 0013).

## Powiązania

0003 (marker pozycji), 0005 (stacje muszą być osiągalne), 0009 (kolejność
graczy), 0013 (prywatność).

## Aneks (2026-09-07): kara ręczna stała, bez pola w setupie — ZNIESIONA w Partii 2

Decyzja właściciela (Partia 1): pole „Kara za „jestem na miejscu"" zniknęło
z setupu (myliło), kara działała jako stałe +60 s. Decyzja właściciela
(Partia 2, ADR 0023): kara zniesiona w całości — ręczne dojście bez kary.
