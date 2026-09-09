# HANDOFF 2026-09-07 (partia 4, PR #4) → następny agent

Sesja: punkty 3 i 4 z listy „zostało" partii 3 — **B19** (kotwica geohash6 dla
starych paczek) i **B20 / ADR 0027 część B** (gra sieciowa bez tur). Oba
wdrożone i wypchnięte. Stan: **zielony** — `npm run brama` = 560/560 + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust **m12-13**. Budżet lektury
~45 tys. / 100 tys. tokenów.

## Commity partii

| Commit | Co |
| --- | --- |
| `2b46aca` | B19: `geohashPunkt` + `kotwicaZestawu` w moście, tolerancja `200 m + promienM` dla kotwicy szacowanej (ADR 0024 aneks, decyzje 6–8) |
| `cc50f14` | Premia za kolejność ukończenia: `premiaZaKolejnosc` po obu stronach, `postepGracza` z `czasOdcinkowMs` (kształt wyników identyczny) |
| (ostatni) | Część B: `skierujDoStacji`/`stacjeDoWyboru`, pytanie wg indeksu gracza, lista stacji w UI, postęp i kolumna premii, PROTOKOL §9, aneks ADR 0022, BACKLOG B21 |

## Co zostało

1. **B21** — budżet promptu i limit wklejenia dla `stacje × gracze` pytań
   (5 × 8 = 40). Niezmierzone; dziś domyślny setup generuje 5 pytań.
2. **Wklejenie skryptu mostu przez właściciela** — bez tego stare paczki
   dopasowują się zgrubnie, a `gra.wyniki` na Drive nie mają premii
   (aplikacja liczy ją sama, więc telefon pokazuje poprawnie).
3. **Weryfikacja na 360 px** — panel gry multi urósł o listę stacji
   (`#multi-wybor-stacji`, klasa `chipy`) i kolumnę premii w dwóch tabelach.
   Kryterium WORKFLOW §4.2 do potwierdzenia w przeglądarce.
4. **Deploy Pages** po merge do `main` (workflow jest w repo).

## Pułapki z tej partii

- **Kolizja nazw**: `wybierzStacje` istnieje w `app/stacje.js` (wybór POI na
  stacje). Nowa funkcja rozgrywki nazywa się `skierujDoStacji`. Zamiana tekstu
  `wybierzStacje(` w `app.js` trafiła w wywołanie z `stacje.js` i wywróciła 7
  testów generowania stacji — przy zmianie nazwy czytaj `git diff`, nie licznik.
- **Filtrowanie pytań per gracz nie może zostawić pustej paczki**:
  `nowaRozgrywka` wymaga `pytania.length > 0`, więc przy paczce mniejszej niż
  liczba graczy indeks musi się zawijać (`k mod liczba pytań`), inaczej gość
  nie wchodzi do gry (objaw: `ekran-gra` zostaje schowany, bez błędu).
- **Kopia funkcji między aplikacją a Apps Script jest testowalna**: wycięcie
  fragmentu `.gs` i wykonanie go przez `new Function` daje parity-test
  (`test/most-indeks.test.js`, `test/most-gra.test.js`). BACKLOG B19 zakładał
  „bez testów" — test był tańszy niż ryzyko cichego rozjazdu.
- Marker końca fragmentu w `.gs` trzeba sprawdzić (`indexOf` zwraca −1, a
  `slice(start, -1)` daje pusty łańcuch i test „przechodzi" na pustym ciele).
