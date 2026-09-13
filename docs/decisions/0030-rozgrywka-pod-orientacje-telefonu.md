# 0030 — Rozgrywka układa się pod orientację telefonu, a pytanie leży NA mapie

- Status: Zaakceptowana (2026-09-08, decyzja właściciela)
- Data: 2026-09-08

## Kontekst

Cały ekran gry był jedną kolumną: nagłówek, badge, mapa, komunikat, karta fazy,
pasek przycisków. Mapa miała jedną regułę dla każdego ekranu —
`.mapa { height: 45vh; min-height: 240px; max-height: 460px }` — bez
`aspect-ratio` i bez żadnego zapytania o orientację. W `app/styles.css` były
wtedy trzy zapytania `@media` i wszystkie dotyczyły liczby kolumn siatki.

Skutek na telefonie 360×740 px: mapa wychodziła ~344×333 px, czyli niemal
kwadrat wciśnięty między nagłówek a kartę pytania, a nie pionowy kadr okolicy.
Żeby zobaczyć treść pytania i odpowiedzi, trzeba było przewinąć stronę.

Właściciel (2026-09-08): „na desktopie mam tą mapę gry otwartą w 16:9, na mobile
powinna się otwierać na proporcje ekranu mobile, czyli raczej 9:16 albo coś
takiego. […] Pytania z kolei powinny się pojawiać na warstwie nad mapą, żeby nie
trzeba było przewijać, bo przewijanie na mobile to koszmar. […] na wykrytym
device mobile to w ogóle powinno się dostosowywać do tego czy telefon jest
horizontal czy vertical i jak ktoś zmieni to mapa/pytania/aplikacja dynamicznie
powinna się dostosowywać."

Trzeci człon jest tu najważniejszy: telefon raz jest pionowy, raz poziomy, a
obrót potrafi nastąpić w środku pytania. Rozwiązanie, które ustawia układ raz na
starcie (np. `if (szerokosc < wysokosc)` w JS), rozsypałoby się przy obrocie.

## Decyzja

1. **Układ wybiera CSS zapytaniem o orientację, nie JS zgadywaniem modelu.**
   Dwa zapytania w `app/styles.css`: `(max-width: 900px) and (orientation:
   portrait)` oraz `(orientation: landscape) and (max-height: 620px)`.
   Przeglądarka przelicza zapytania na żywo, więc obrót telefonu przełącza układ
   bez przeładowania i bez nasłuchiwania `orientationchange`.
2. **Mapa gry jest tłem obszaru gry** (`position: absolute; inset: 0`), więc ma
   dokładnie proporcje urządzenia. Renderer i tak mierzy pudło z
   `getBoundingClientRect` (`rozmiarPanelu`) i przelicza widok przy każdym
   `resize` (nasłuch „Obrót telefonu albo zmiana rozmiaru okna"), więc nowa
   proporcja od razu daje poprawną projekcję kafelków, okręgów i pinezek — bez
   ani jednej linijki kodu wykrywającej orientację.
3. **Karty faz leżą NA mapie** (`z-index: 2`, nieprzezroczyste tło) i mają własne
   przewijanie w środku karty. PION: przypięte do dołu. POZIOM: w prawej
   kolumnie (52% szerokości), bo przy ~360 px wysokości karta na dole zakryłaby
   całą mapę.
4. **Strona gry się nie przewija** — `body[data-ekran='gra'] { height: 100dvh;
   overflow: hidden }`. Znacznik `data-ekran` ustawia `pokazEkran()`, bo CSS nie
   ma selektora rodzica, a te reguły muszą działać wyłącznie na ekranie gry
   (na setupie przewijanie jest normalne i potrzebne). `pokazPrywatnosc()`
   znacznik zdejmuje.
5. **Karty schodzą na dół rozpychaczem** (`#ekran-gra::before { content: '';
   flex: 1 1 auto }`), nie `justify-content: flex-end` — przy tym drugim
   przepełniona kolumna flex chowa początek poza zasięg przewijania. Obszar gry
   ma `overflow-y: auto`, więc gdyby treści jednak nie zmieściły się w ekranie
   (multiplayer: tabela wyników + panel fazy), gracz nadal ma jak do nich dojść.
6. **Desktop bez zmian.** Szeroki i wysoki ekran zostaje przy układzie kolumnowym
   z mapą 45vh — tam jest czytelniejszy i nie ma czego wypełniać mapą.

## Konsekwencje

- ADR 0011 (mobile-first) dostaje część wykonawczą: „interfejs dotykowy jako
  podstawowy" przestaje oznaczać „ten sam układ, tylko węższy".
- Pasek kroków 1–6 jest na ekranie gry schowany — opisuje PRZYGOTOWANIE gry,
  a postęp w grze pokazuje badge „stacja X z Y". Stopka zostaje (siedzi w niej
  `#status`, główny kanał komunikatów), ale cienka i bez ozdobników.
- Atrybucja dostawcy jest obowiązkowa przy włączonym podkładzie (ADR 0003 pkt 3),
  a dół mapy zasłania teraz karta — pasek wędruje więc na samą górę, a skala pod
  przyciski +/−/◎.
- W poziomie nagłówek jest ściskany (bez podtytułu, mniejsze przyciski): przy
  ~360 px wysokości nie ma miejsca na 90 px chrome'u.
- Koszt: długi wynik końca gry przewija się wewnątrz karty, a nie na stronie.
  To świadome — mapa nie jest wtedy potrzebna do chodzenia, a zasada „strona się
  nie przewija" jest warta więcej niż pełna tabela od razu.
- Pułapka kaskady, w którą ten układ łatwo wchodzi: wspólna reguła „daj tło,
  żeby tekst był czytelny na mapie" napisana selektorem z id wygrywa z klasową
  i zabiera elementowi jego własne tło. Trafiło to `#gra-dystans` (biały napis
  na prawie białej karcie w jasnym motywie) i `#bledy-gra` (alert przestał być
  czerwony). Tło dostają tylko elementy, które go nie mają; kontrakt ADR 0030
  pinuje to wprost (LESSONS L35), bo audyt kontrastu liczy pary tokenów
  z palety i nie widzi, który selektor wygrał.

## Aneks 2026-09-13 (m12-104) — ekran obraca się sam, a po obrocie ◎ klika się samo (uwaga D)

Właściciel najpierw poprosił o zablokowanie ekranu w pionie z przełącznikiem
poziomu w górnym menu (uwaga D z testów terenowych 2026-09-13), a następnie tę
prośbę **wycofał**: „Ekran powinien się auto-przekręcać jak wcześniej bez żadnej
dodatkowej ikonki toggle w menu. Jedyna zmiana do wersji dotychczasowej to
prośba o 『autokliknięcie』 w opcję Centrowanie na mapie po każdym
『przekręceniu』 ekranu."

1. **Blokady orientacji nie ma i nie będzie.** Żadnego
   `screen.orientation.lock()`, żadnego `orientation` w `manifest.json` i
   żadnego przełącznika w menu. Punkty 1–6 decyzji działają bez zmian: CSS
   przelicza układ na żywo, a mapa jest tłem obszaru gry.
2. **Po obrocie aplikacja klika ◎ za gracza.** `resize` i `orientationchange`
   idą jednym torem: `naZmianeRozmiaruOkna()` czeka `OPOZNIENIE_OBROTU_MS`
   (250 ms), aż wymiary osiądą, potem `sprawdzObrotEkranu()` porównuje kierunek
   (`kierunekEkranu` z czystego `app/orientacja.js`) z poprzednim i TYLKO przy
   zmianie pion ↔ poziom woła na widocznej mapie `odswiez()` oraz
   `centrujNaPozycji()` — dokładnie ten kod, który uruchamia przycisk ◎
   (`mapa.js` → `naPrzycisk('centruj')`), więc przybliżenie zostaje takie, jakie
   ustawił gracz, a kadr wraca na niego.
3. **Zmiana rozmiaru bez obrotu widoku nie rusza.** Klawiatura, chowający się
   pasek przeglądarki i okno na desktopie zmieniają wymiary, ale nie kierunek —
   wtedy działa wyłącznie dotychczasowe `kazdaMapa((mapa) => mapa.odswiez())`.
   Mapę prowadzi palec gracza (ADR 0011), więc aplikacja nie „poprawia" kadru,
   który gracz ustawił celowo.
4. **Jedna reguła widocznej mapy.** `nazwaWidocznejMapy()` (`stacje`/`prompt`/
   `paczka` → mapa stacji, `gra` → mapa gry, reszta → mapa pozycji) karmi i
   `body[data-mapa]` dla CSS (pkt 1), i wybór mapy do wycentrowania. Wcześniej
   ta reguła była wpisana wprost w `odswiezWidocznoscPaneli()`.

Dlaczego debounce i porównanie KIERUNKU, a nie pikseli: telefon podczas
animacji obrotu melduje kilka wymiarów pośrednich (w tym niemal kwadratowe),
iOS potrafi zgłosić obrót zdarzeniem `orientationchange` bez `resize` w tej samej
chwili, a `resize` bywa wcześniejszy niż nowy układ. Czekamy, aż wymiary
osiądą, i reagujemy raz — na zmianę kierunku.

Brak danych to brak danych (LESSONS L10): bez wiarygodnych wymiarów nie ma
kierunku, a bez dwóch różnych kierunków nie ma obrotu, więc nie ma kliknięcia.
Brak `screen.orientation` (iOS Safari) niczego nie psuje — zostaje `resize`.

**Wdrożenie:** `app/orientacja.js` (czysty) i `test/orientacja.test.js`; warstwa
DOM w `app/app.js` (`rozmiarOkna`, `naZmianeRozmiaruOkna`, `sprawdzObrotEkranu`,
`nazwaWidocznejMapy`, nasłuch `orientationchange`); piny obecności i
nieobecności w `test/kontrakt.test.js` („kontrakt ADR 0030 aneks"); krok
weryfikacji terenowej w `docs/WORKFLOW.md` §4.1 pkt 7.
