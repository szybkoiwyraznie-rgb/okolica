# Plan kamienia M7 — Podsumowanie, punkty i udostępnianie

- Data: 2026-09-06
- Kamień: **M7** (`docs/ROADMAP.md`) — wyniki per gracz (punkty, czasy,
  poprawne odpowiedzi), medal za sprawiedliwość trasy, eksport wyniku
  (tekst/obraz), historia gier (`okolica:historia`).
- Stan wyjściowy: brama 358/358; gra przechodzalna od setupu do wyniku
  (M6): panel D pokazuje MINIMALNĄ tabelę z `podsumowanie()` (imię + 🏆,
  punkty, poprawne/razem); model `podsumowanie()` (M1) liczy już wszystko,
  czego M7 potrzebuje per gracz (punkty z rozbiciem na podstawowe i premie,
  poprawne/błędne, odcinki, czas odcinków, dystans, średnie tempo, ręczne
  dojścia, `poLimitie`) i per stacja (gracz, stan, czas, dystans, tempo, tryb
  dojścia, poprawne, punkty) plus statystyki gry (`czasGryS`,
  `zaliczoneStacje`, `pominietaStacje`, `stacjeBezPytan`, `zdarzen`);
  `miaraSprawiedliwosci(stacje)` (M4, ADR 0005 pkt 5) istnieje i działa na
  polach listy stacji; `trwalosc.js` (M6) ma wzorce schemat/walidacja/budżet;
  helper `pobierzPlik` (M0) i wzorzec „czysty plan rysowania + cienki
  wykonawca DOM" (mapa, M2) są gotowe do ponownego użycia.
  **Nie ma**: pełnego widoku wyniku, eksportu (tekst/obraz), historii gier.

## Zakres

**Wchodzi:**
- Pełne podsumowanie w istniejącym panelu D (`gra-panel-koniec`): karta
  zwycięzcy, tabela graczy z wszystkimi polami `podsumowanie()`, sekcja per
  stacja, statystyki gry, medal sprawiedliwości trasy (🏅) — czytelne
  w słońcu na 360 px (kryterium kamienia).
- Eksport wyniku TEKSTOWY (ADR 0010 pkt 5): czysta funkcja
  `wynikTekstowy()` + trzy ścieżki dostarczenia: `navigator.share` (telefon),
  schowek (fallback z jawnym statusem), plik `.txt` przez `pobierzPlik`.
- Eksport wyniku OBRAZOWY: czysta funkcja `planObrazuWyniku()` (lista komend
  rysowania, wzorzec z mapy) + wykonawca na `<canvas>` → PNG (`toBlob`) →
  `navigator.share`/`pobierzPlik`. Zero bibliotek (ADR 0001), bez
  `foreignObject`/html2canvas (Safari).
- Historia gier: `okolica:historia` (schemat `historia/1`, ADR 0010 pkt 1 —
  „skrót, nie treść"), funkcje czyste w `trwalosc.js` (wpis, walidacja z
  kodami `H`, limit 50 wpisów), zapis przy końcu gry (naturalnym i ręcznym),
  zwinięta lista na setupie, dwustopniowe kasowanie historii.

**Nie wchodzi (świadomie):** ranking okolic i „zaliczone okolice" na mapie
świata (BACKLOG B11), udostępnianie online/backend Drive+Apps Script
(ADR 0016 — *Proponowana*, B17: nie wcześniej niż M8), wydruk/zestawienia dla
prowadzącego (B12), publikacja Pages i manifest (M8), offline/service worker
(M10), zmiana punktacji (ADR 0014 jest zamknięty w kodzie M1/M6).

## Etapy

- [ ] **P1 — plan (ten plik):** zakres, decyzje, ryzyka; commit + push.
- [x] **P2 — historia w `trwalosc.js` (czyste):** `KLUCZ_HISTORII
      = 'okolica:historia'`, `skrotGry({ rozgrywka, konfig, stacje,
      podsumowanie, miejsce, terazMs })` → wpis `historia-gra/1`,
      `dodajWpisHistorii(historia, wpis)` (niezmiennikowo, limit 50 =
      najstarsze wypadają, idempotencja po `klucz` gry: wpis istniejący jest
      ZASTĄPIONY), `walidujHistorieSurowa` (atomowa, kody `H01`–`H…`),
      testy jednostkowe.
- [x] **P3 — pełne podsumowanie (panel D):** karta zwycięzcy (imię, punkty,
      🏆), tabela graczy (punkty razem + rozbicie podstawowe/premie,
      poprawne/błędne, odcinki, czas, dystans, tempo, ręczne dojścia,
      po limicie), sekcja per stacja (kto, stan — zaliczona/pominięta, czas,
      dystans, tempo, tryb dojścia, punkty), statystyki gry (czas gry,
      zaliczone/pominięte stacje, stacje bez pytań, liczba zdarzeń), medal
      sprawiedliwości (`miaraSprawiedliwosci` z pól stacji: sieciowych gdy są,
      `udzialOdchylenia ≤ 0,15` = „🏅 Uczciwa trasa"); CSS: na ≤ 360 px
      tabela graczy zamienia się w karty, liczby duże i kontrastowe (słońce);
      kontrakt na nowe identyfikatory w teście.
- [x] **P4 — eksport tekstowy:** `wynikTekstowy(podsumowanie, { konfig,
      stacje, miejsce, data })` (czysta; tekst liniowy bez markdown — czytelny
      w SMS/komunikatorze; BEZ treści pytań i BEZ współrzędnych — prywatność
      ADR 0013: nazwa miejsca jeśli jest, inaczej pominięta), przyciski
      w panelu D: „⤴ Udostępnij wynik" (`navigator.share` gdy dostępny),
      „📋 Kopiuj wynik" (clipboard + jawny status), „⬇ Wynik .txt"
      (`pobierzPlik`); testy czyste + integracyjne (stub clipboard/share).
- [x] **P5 — eksport obrazkowy:** `planObrazuWyniku(podsumowanie, { motyw,
      skala })` (czysta; zwraca listę komend `{ typ: 'tlo'|'tekst'|'linia'|
      'prostokat', … }` — wzorzec planu rysowania mapy), wykonawca
      `rysujWynikNaCanvas(plan, canvas)` w `app.js` (cienki: tylko przekazuje
      komendy do kontekstu 2d), PNG przez `toBlob` → „🖼 Obraz .png"
      + dołączenie pliku do `navigator.share` gdy wspiera `files`; szerokość
      1080 px (2× gęstość), kolory z bieżącego motywu; test: wykonawca
      przekazuje WSZYSTKIE komendy planu (atrapa kontekstu 2d zlicza
      wywołania), plan zawiera ranking i nagłówek.
- [x] **P6 — historia w UI:** zapis skrótu przy przejściu w fazę `koniec`
      (naturalnym — po ostatniej stacji) oraz przy ręcznym zakończeniu gry
      (wpis z `przerwana: true`); wznowienie przerwanej gry i naturalny koniec
      ZASTĘPUJE wpis (idempotencja po `klucz`); lista na setupie jako
      zwinięte `<details>` „Poprzednie gry (N)" (data, miejsce, tryb,
      zwycięzca, punkty, czas, znacznik przerwanej), „Kasuj historię"
      dwustopniowo; istniejące „kasowanie danych" czyści `okolica:*`, więc
      historię też (bez zmian); zepsuta historia = jawny komunikat z kodem H
      i oferta kasowania (nigdy ciche odrzucenie — ADR 0010 pkt 6).
- [ ] **P7 — integracja:** pełna gra (ścieżka z R7: symulacja dojścia ×3
      stacje) → panel D z PEŁNYM podsumowaniem (asercje na pola, medal,
      sekcję stacji) → eksport tekstowy (treść zawiera ranking, nie zawiera
      pytań ani współrzędnych) → wpis w `okolica:historia` (skrót, bez
      treści); ręczne zakończenie → wpis `przerwana`, wznowienie → dokończenie
      → wpis zastąpiony pełnym; brama zielona.
- [ ] **P8 — dokumenty i zamknięcie:** README, ROADMAP („kod M7 gotowy"),
      ARCHITECTURE (przepływ C. Podsumowanie/eksport, §Stan i trwałość:
      `okolica:historia`), PROJECT_HISTORY, LESSONS jeśli coś zaskoczy,
      cache-busting `?v=m7-1`, aktualizacja PR #2. Kryterium właściciela
      (§4.2): podsumowanie czytelne w słońcu na 360 px; eksport działa na
      Chrome Android i Safari iOS (share/clipboard/plik/obraz).

## Decyzje projektowe

1. **Panel D rośnie, ekranów nie przybywa** — pełne podsumowanie żyje
   w istniejącym `gra-panel-koniec` (M6, decyzja 1: jeden ekran gry, cztery
   panele faz); zero nowych ekranów w pasku kroków, wynik jest fazą gry.
2. **Medal sprawiedliwości to widok, nie punkty** — ROADMAP mówi
   „medal/punkty za sprawiedliwość trasy"; punktacja graczy jest DOMKNIĘTA
   w ADR 0014 i `zapiszOdpowiedz` (zmiana = przeliczanie zapisanych gier
   i migracja `rozgrywka/1`). Sprawiedliwość trasy jest cechą UKŁADU stacji,
   nie osiągnięciem gracza — dlatego 🏅 „Uczciwa trasa" (udział odchylenia
   ≤ 0,15, kryterium jakości z M4) jako odznaka w podsumowaniu, liczona
   w chwili renderu z pól `STAN.stacje` (`dystansSieciowyM` gdy jest, inaczej
   `odlegloscM`). Interpretacja do potwierdzenia przez właściciela przy
   akceptacji kamienia.
3. **Eksport najpierw tekst, obraz drugi** — tekst jest tani, dostępny
   i działa wszędzie (share/clipboard/plik); obraz to `canvas` rysowany
   z CZYSTEGO planu komend (wzorzec mapy z M2: matematyka/plan testowalne bez
   DOM, wykonawca cienki) — bez `foreignObject` i bez html2canvas
   (zero zależności, ADR 0001; Safari bywa kapryśny przy SVG→canvas).
4. **Prywatność eksportu (ADR 0013)** — wynik tekstowy i obrazkowy NIE niesie
   treści pytań, współrzędnych ani śladu GPS: nazwa miejsca (jeśli była
   pobrana), tryb, data, ranking z liczbami, czasy, stacje jako NUMERY.
   Historia gier tak samo: `geohash6` środka (jak klucz cache sieci — lokalny)
   i nazwa miejsca, bez listy współrzędnych.
5. **Historia = skróty, limit 50, idempotencja po kluczu gry** — ADR 0010
   pkt 1 („skrót, nie treść"); wpis jest zastępowany po `klucz` (kod gry
   oczyszczony jak w M6), więc wznowienie i dokończenie przerwanej gry nie
   duplikuje wpisu; 50 wpisów × ~0,5 kB to ~25 kB — daleko od budżetów, ale
   limit jest jawną stałą (najstarsze wypadają), bo `localStorage` dzielimy
   z paczkami, siecią i zapisami gier.
6. **Ręczne zakończenie też zapisuje skrót (`przerwana: true`)** — gra się
   odbyła, wynik wczesny jest prawdziwy; zapis gry zostaje (M6), więc po
   wznowieniu i naturalnym końcu wpis jest zastępowany pełnym. Historia nie
   kłamie ani nie gubi gier przerwanych.
7. **Kody błędów historii: przedrostek `H`** — konwencja z ADR 0015 pkt 4
   (G/P/K/E/S/T już zajęte); walidacja atomowa jak `walidujStanSurowy`
   (cała historia przechodzi albo jawny komunikat z ofertą kasowania —
   nigdy ciche odrzucenie, ADR 0010 pkt 6).
8. **Web Share z trzema fallbackami** — `navigator.share` (telefon) →
   clipboard (desktop, z jawnym statusem „skopiowano") → plik (zawsze).
   Aplikacja nie udaje, że udostępniła, gdy API nie ma: każdy przycisk jest
   widoczny tylko gdy jego ścieżka istnieje (wzorzec `hidden` z M5/M6),
   a plik jest dostępny zawsze.

## Ryzyka

- **`canvas.toBlob` i motywy** — kolory trzeba czytać z CSS (custom
  properties) albo zduplikować paletę w planie; duplikat rozjedzie się
  z motywem → plan bierze paletę jako parametr z `getComputedStyle`
  w wykonawcy, a czysta funkcja pracuje na nazwach ról kolorów.
- **`navigator.share` z plikami** (`share({ files })`) wspiera Chrome Android,
  ale nie każdy desktop/Safari → udział obrazu deguje do pobrania pliku
  (feature-detect `canShare({ files })`).
- **Skrót gry a zamknięta przeglądarka** — wpis historii powstaje przy
  tranzycji w `koniec`; gdy użytkownik zamknie kartę ZANIM kliknie „Zobacz
  wynik", faza `koniec` jest już w zapisie gry → `wznowGre`/`sprawdzZapisGry`
  musi dopisywać skrót przy wznowieniu gry zakończonej (ten sam kod zapisu
  historii, idempotencja po kluczu chroni przed dublem).
- **Tabela na 360 px** — 10 kolumn × 2+ graczy nie mieści się → breakpoint
  zamienia wiersze w karty (wzorzec z podglądu organizatora M5); kryterium
  „czytelne w słońcu" sprawdza właściciel (duże liczby, kontrast ≥ 4,5:1).
- **Stare zapisy `stan-gry/1` bez zmian** — M7 nie tyka schematu stanu gry
  (medal i historia liczone z istniejących pól), więc zapisy z M6 zostają
  ważne; kontrakt testów T01–T10 bez zmian.

## Kryteria przyjęcia (kod)

- `npm run brama` zielone (testy + szablon), zero nowych zależności.
- Panel D: karta zwycięzcy, pełne pole gracza (punkty/poprawne/czasy/dystans/
  tempo/ręczne/po limicie), sekcja per stacja, statystyki gry, medal
  sprawiedliwości — wszystkie z `podsumowanie()` i `miaraSprawiedliwosci()`,
  bez nowej matematyki w warstwie DOM.
- Eksport: tekstowy (share/clipboard/plik) i obrazkowy (plan czysty + canvas)
  z testami; treść eksportu bez pytań i bez współrzędnych (test-strażnik).
- Historia: `historia/1` z walidacją H, limit 50, idempotencja po kluczu,
  zapis przy końcu naturalnym i ręcznym (`przerwana`), zastąpienie po
  dokończeniu, lista na setupie, dwustopniowe kasowanie, zepsuta historia =
  jawny komunikat.
- Kontrakt identyfikatorów panelu D i listy historii w teście.

## Kryterium właściciela (`WORKFLOW` §4.2)

- Podsumowanie czytelne W SŁOŃCU na 360 px (liczby, kontrast, karty graczy).
- Eksport działa na Chrome Android i Safari iOS: udostępnianie systemowe,
  schowek, plik `.txt`, obraz `.png` (podgląd w galerii/msgs).
- Historia: dwie gry w tej samej okolicy → dwa wpisy na setupie; gra
  przerwana ręcznie → wpis „przerwana", po dokończeniu → wpis pełny (jeden).
- Przy okazji: zaległe kryteria M3 (360 px), M4 (prawdziwa okolica), M5
  (pętla z prawdziwym modelem) i M6 (gra na telefonie z utratą zasięgu
  i zamknięciem przeglądarki).
