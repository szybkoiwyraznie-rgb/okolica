# Plan — Domyślny adres mostu Drive w kodzie aplikacji (2026-09-07)

Kontekst: po domknięciu M11/M12 właściciel zapytał, dlaczego adres mostu
Apps Script wpisuje się w aplikacji, skoro „każdy następny build nie będzie
miał tych danych". Wyjaśnienie: adres jest trzymany w `localStorage`
przeglądarki, przypiętym do ADRESU STRONY, więc nowa wersja aplikacji go nie
kasuje. Prawdziwy problem jest inny i właściciel go trafnie wyczuł:

- **każde urządzenie** musi znać adres, a w grze wieloosobowej każdy telefon
  uczestnika sam synchronizuje się z mostem — znajomy musiałby raz ręcznie
  wkleić adres, co jest barierą wejścia;
- ręczne wpisywanie znika po wyczyszczeniu danych przeglądarki.

**Decyzje właściciela (2026-09-07, wiążące → ADR 0020):**

1. Adres mostu jest **wpisany na stałe w kodzie aplikacji** jako wartość
   domyślna (`DOMYSLNY_URL_MOSTU` w `app/most.js`).
2. **Pola do wpisywania adresu znikają z interfejsu** (karta paczek i karta
   gry wieloosobowej) — wymiana adresu = nowy commit i nowa wersja aplikacji.
3. **Bez dodatkowego klucza dostępu** w moście: repozytorium jest publiczne
   (wymóg GitHub Pages), więc klucz i tak byłby jawny; wystarczą istniejące
   sprawdzenia po stronie mostu (kod gry, `organizatorId`, `graczId`,
   `REVIEW_SECRET` w linku przeglądu).
4. **Kolejność**: mechanizm powstaje TERAZ z pustą stałą; prawdziwy adres
   wstawiamy jednym commitem, gdy właściciel wdroży web app i poda adres
   w czacie.

Nadpisanie techniczne zostaje, ale BEZ interfejsu: klucze `localStorage`
(`okolica:multi:url-mostu`, `okolica:repo-zestawow:url`) mają pierwszeństwo
przed stałą. To furtka dla testów (atrapa mostu) i dla sytuacji „adres się
zmienił, a nowa wersja jeszcze nie dojechała".

## Kroki

- [x] **A1 — moduł `app/most.js`**: stała `DOMYSLNY_URL_MOSTU` (pusta do
      wdrożenia), klucz `KLUCZ_URL_MOSTU` przeniesiony z `app.js`, funkcja
      `adresMostu(pamiec?)` (nadpisanie multi → nadpisanie repo → stała) i
      `mostSkonfigurowany(pamiec?)`; moduł nie dotyka DOM ani `fetch`
      (wzorzec: czysta funkcja + wstrzyknięta pamięć). Testy `test/most.test.js`.
- [ ] **A2 — `app/app.js` przez jeden adres**: wszystkie odczyty adresu
      (propozycje paczek, „🔌 Sprawdź połączenie", wysyłka zestawu na Drive,
      gra wieloosobowa, rankingi, wznowienie sesji multi) idą przez
      `adresMostu()`; usunięte nasłuchy pól i przycisków zapisu adresu;
      komunikaty UI bez obietnicy „wpisz adres" — zamiast tego jawny stan
      (podłączony / nie skonfigurowany w tej wersji).
- [ ] **A3 — `index.html` bez pól adresu**: w karcie paczek zostaje status
      `#most-stan-repo` i przycisk „🔌 Sprawdź połączenie"; w karcie gry
      wieloosobowej status `#multi-most-stan` zamiast `<details>` z polem;
      cache-bust `?v=m12-1` wszędzie + `WERSJA_SW = 'm12-1'` (AGENTS §7).
- [ ] **A4 — testy**: nowy `test/most.test.js` (kolejność resolution, pusta
      stała, nadpisanie), zaktualizowane `test/kontrakt.test.js` (brak pól
      adresu, stała w kodzie, spójność cache-bust), `test/zestawy-ui.test.js`
      i `test/wieloosobowa-ui.test.js` (adres z pamięci, nie z pola);
      brama zielona (testy + szablon + audyt WCAG AA).
- [ ] **A5 — dokumentacja**: ADR 0020 (Zaakceptowana), aneksy ADR 0016 i
      0018, dopisek w AGENTS.md §4 (adres mostu to nie sekret),
      ARCHITECTURE, README, WORKFLOW (§4.4 test bez konfiguracji),
      `docs/setup/most-drive-instrukcja.md` §4 (adres podajesz w czacie →
      trafia do kodu), PROJECT_HISTORY, LESSONS L28.

## Ryzyka

- **Adres jest publiczny** (repo publiczne): obcy może wysłać paczki do
  przeglądu (e-maile do właściciela), założyć grę w lobby, dopisać wiersze
  rankingów, zużyć limit Drive. NIE może: zatwierdzić paczki (`REVIEW_SECRET`),
  zobaczyć danych osobowych (nie są zbierane), odczytać współrzędnych graczy
  (nie opuszczają telefonu), zmienić kodu. Reakcja na nękanie: nowe
  wdrożenie web app = nowy adres → nowy commit ze stałą.
- **Rotacja adresu wymaga wydania wersji** — dlatego nadpisanie w
  `localStorage` zostaje jako furtka awaryjna (bez UI).
- **Pusta stała do czasu wdrożenia**: aplikacja musi wtedy mówić wprost, że
  most nie jest jeszcze wpisany w tej wersji, i działać dalej w trybie
  lokalnym (LESSONS L6: status jawny, degradacja bez blokady).
