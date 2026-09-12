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

## Aneks (2026-09-07): kara ręczna stała, bez pola w setupie — ZNIESIONA w Partii 2

Decyzja właściciela (Partia 1): pole „Kara za „jestem na miejscu"" zniknęło
z setupu (myliło), kara działała jako stałe +60 s. Decyzja właściciela
(Partia 2, ADR 0023): kara zniesiona w całości — ręczne dojście bez kary.

## Aneks (2026-09-08): tryb testowy wchodzi tylko parametrem adresu

Decyzja właściciela: przycisk „⚙ tryb testowy" zniknął z nagłówka (kusił do
grania bez GPS, a wyniki i tak szły na Drive i do rankingów — ADR 0029).
Kanoniczne wejście to **`?test=true`** (przyjmowane też `?test=1`, `?test=tak`
oraz historyczne `?tryb=test` z pkt 6, którego używają testy). Tryb odsłania
ręczne współrzędne i symulację trasy; GPS nie startuje. Formy wejścia pinuje
test w `test/aplikacja.test.js`.

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

## Aneks 2026-09-12 (m12-91) — watchdog martwego nasłuchu: „aktywny” wrapper ≠ działający strumień

Zgłoszenie terenowe (iPhone, Chrome, Pages, zgoda na lokalizację udzielona,
GPS telefonu sprawny): ekran „Gdzie jesteś?” wisi na „Czekam na pozycję…”
bez końca; po wyjściu i wejściu „Szukam satelitów…”, w Informacjach „GPS
uruchomiony” / „wznowiono śledzenie” — a fixa i błędu brak. WebKit ma
udokumentowaną rodzinę usterek, w której `watchPosition` przestaje wołać
OBA callbacki (ani sukces, ani błąd), ignorując opcję `timeout`; ryzyko
rośnie, gdy pierwszy request poszedł bez gestu użytkownika (nasz `start()`
włącza GPS przy ładowaniu strony) i po powrocie karty z tła.

Pkt 1 (opcje watchera) pozostaje — ale `timeout` nie jest gwarancją
platformy, tylko prośbą. Uzupełnienie:

1. **Znak życia**: każdy callback (fix ALBO błąd) odświeża znacznik czasu;
   cisza liczona jest od założenia nasłuchu. Brak danych o znaku jest
   milczeniem (L10), nie „świeżością”.
2. **Watchdog**: 15 s bez JAKIEGOKOLWIEK callbacku (≈ ¾ z `timeout: 20000`)
   = martwy nasłuch → świeży watcher (`watchPozycja` z tą samą osłoną)
   i komunikat **P10** z sekundami ciszy i numerem próby plus wyjściem
   awaryjnym (iOS: Usługi lokalizacji dla przeglądarki; potem odśwież
   stronę). P05 pozostaje wycofany — P10 to nowy numer.
3. **Gest**: dopóki nie ma żadnego fixa, klik „Dalej” zakłada świeżego
   watchera przy każdym wejściu na ekran pozycji — dawniej chroniło to
   tylko `czyAktywny()`, który mówi o NASZYM wrapperze, nie o WebKit.
4. **Zegar uzbrojony na potrzebę**: watchdog tyka wyłącznie, gdy czekamy
   na fixa (ekran pozycji albo odcinek gry); pauza/wznowienie i
   `zatrzymajGps` zdejmują go razem z watcherem. Restart NIE nadpisuje
   statusu gry (L22), a „GPS włączony” mówi tylko pierwszy start.
5. **Prywatność bez zmian** (ADR 0013): watchdog nie wysyła nic — to
   mechanizm wyłącznie lokalny.

Reguła ogólna trafia do LESSONS L56: status „aktywny” w naszym wrapperze
to deklaracja intencji; o życiu streamu rozstrzyga wyłącznie ostatni
callback.
