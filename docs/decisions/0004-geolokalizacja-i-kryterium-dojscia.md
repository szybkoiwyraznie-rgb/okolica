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
   `odległość(fix, stacja) ≤ próg`, gdzie `próg = 25 m` **na stałe**
   (aneks 2026-09-09 na końcu dokumentu; do tej daty
   `ogranicz(max(25 m, 1.2 × fix.accuracy), 25 m, 100 m)`),
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

## Aneksy 2026-09-07 … 2026-09-12 są w archiwum (poza budżetem lektury)

Historia tego ADR do aneksu 2026-09-12 włącznie — kara ręczna (2026-09-07), tryb testowy (2026-09-08), watchdog martwego nasłuchu (2026-09-12, m12-91), wyjście awaryjne P10 (2026-09-12, m12-92) oraz wyjście z nieosiągalnej stacji (2026-09-12, m12-94) — leży w
`docs/decisions/archive/aneksy-0004-2026-09-07-do-12.md`, poza budżetem lektury startowej (AGENTS.md §0; LESSONS L62). Zawiera aneksy z dat: 2026-09-07, 2026-09-08, 2026-09-12, 2026-09-12, 2026-09-12. Obowiązujące aneksy są niżej: 2026-09-09 (próg 25 m) i 2026-09-13 (koniec pauzy, ADR 0040).


## Aneks 2026-09-09 — próg dojścia to stałe 25 m

Właściciel po rozgrywce w terenie: „Próg zaliczenia stacji jest za duży.
Większy próg zaliczenia niż 25m nie ma sensu. Nie rozumiem do końca tej
zależności od dokładności — wg mnie nie powinniśmy zezwalać na zaliczenie ze
100m. To zupełnie inne miejsce."

**Co było źle w pierwotnej regule.** Skalowanie progu dokładnością fixu miało
chronić gracza przed słabym sygnałem, ale robiło to kosztem sensu gry: przy
`accuracy = 100 m` stacja zaliczała się ze 100 m, czyli z innej ulicy albo
innego skrzyżowania. Gra terenowa polega na dojściu **w konkretne miejsce** —
próg, który rośnie właśnie wtedy, gdy pomiar jest najmniej wiarygodny, znosi tę
zasadę dokładnie wtedy, gdy jest najbardziej potrzebna. Do tego działo się to
cicho: gracz nie wiedział, że zaliczono mu stację z odległości, z której jej
nie widać.

**Decyzja.** `progDojsciaM()` zwraca 25 m niezależnie od `accuracy`. Parametr
zostaje w sygnaturze (wywołania go przekazują, a przyszła polityka — np. inny
próg dla trybu rowerowego — ma gdzie usiąść), ale dziś jest ignorowany.

**Co z graczem przy słabym sygnale.** Nic mu nie zabieramy, bo poluzowany próg
nigdy nie był pomocą — był cichym fałszowaniem wyniku. Zamiast tego badge
„±X m" i ostrzeżenie P05 mówią wprost, że GPS nie rozstrzygnie dojścia,
a wyjściem jest pominięcie odcinka (ADR 0015 pkt 2). Ręczne zaliczenie NIE
wraca — usunięte w ADR 0029 i ten aneks tego nie zmienia; żaden komunikat nie
może do niego odsyłać.

**Konsekwencja dla pkt 4 powyżej:** próg ostrzeżenia (`accuracy > 100 m`)
zostaje jako granica „pomiar bezużyteczny", ale nie ma już związku z progiem
dojścia — to dwie niezależne liczby.



## Aneks 2026-09-13 (m12-102) — koniec pauzy w tle i profilu oszczędnego (uwaga B, ADR 0040)

Pkt 1 traci końcówkę o zamykaniu watchera przy przejściu w tło („…zamykany
przez `clearWatch()` na końcu gry i przy przejściu w tło — oszczędność baterii,
z komunikatem o wznowieniu śledzenia”). Od 2026-09-13 watcher NIE jest zamykany
w tle: aplikacja jest włączona cały czas, a po powrocie sama zakłada świeży
nasłuch, jeśli przeglądarka go zabiła albo uciszyła (bug G) — bez komunikatu, bo
kody P07 i P09 są wycofane i ich numery nie wracają do puli. Opcje watchera
zostają dokładnie te z pkt 1 (`enableHighAccuracy: true, maximumAge: 2000,
timeout: 20000`) i są teraz JEDYNYM profilem — profil oszczędny z M10/T3
(histereza 250/150 m) wycofany, bo kryterium dojścia liczy się z metrów na
całym odcinku. Pkt 2 i 3 bez zmian: próg dojścia, dwa kolejne trafienia,
`accuracy` bez oceny (ADR 0034), a `czasMs` podaje warstwa DOM — teraz bez
korekt na pauzy, bo pauz nie ma. Jedyna przerwa w śledzeniu jest automatyczna
(15 minut bez żadnego kliku) i wznawia ją dowolny klik (ADR 0040 pkt 5).

