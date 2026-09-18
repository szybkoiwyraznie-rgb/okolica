# 0053 — Model AI: opcjonalny wybór nad wklejką i pole `model` w `meta` paczki

- Status: Zaakceptowana
- Data: 2026-09-17

## Kontekst

Właściciel (teren, 2026-09-17, uwaga C1): nad polem wklejenia odpowiedzi ma
stanąć rząd czterech małych, okrągłych ikon modeli — Meta.ai, ChatGPT, Gemini,
Claude. Wybór jest **opcjonalny**: domyślnie żaden nie jest zaznaczony,
dotknięcie zaznacza, drugie dotknięcie odznacza, dotknięcie innego przełącza.
Wybrany model ma pojechać z paczką (na Drive) i być widoczny przy propozycji
wyboru paczki. Bez wyboru — nic o modelu nigdzie nie ma.

## Decyzja

1. **Klucze w kodzie**, nie nazwy handlowe: `meta-ai`, `chatgpt`, `gemini`,
   `claude` (`MODELE_AI` w `app/app.js`) — stabilne, ASCII, jedno źródło prawdy
   dla ikony, etykiety i pola w pliku.
2. **Pole `model` w `meta` jest addytywne** (wzorzec `geohash6` z ADR 0024
   i `ulica` z ADR 0048): dokładamy je TYLKO, gdy wybór istnieje (po `trim()`).
   Stare pliki bez pola, most (`czyMetaOk` w `.gs`) i indeks `Object.assign`
   czytają się dalej bez zmian — nic nie jest „puste wypełniane”.
3. **Brak wyboru = brak danych**, nie „nieznany model”: pusta wartość nie
   jedzie do paczki, nie ma znaczka przy propozycji, nigdzie nie ma atrapy
   nazwy ani znaku zapytania (LESSONS L6).
4. **Ikony rysowane inline** (`createElementNS`, ścieżki w `MODELE_AI`): zero
   plików, zero CDN, zero pobierania — ADR 0001 pkt 1. Kształty są symbolami
   tego projektu (uproszczenie), nie znakami towarowymi; kolor bierze
   z tokenów motywu, więc kontrast jest ten sam w obu paletach.
5. **Znaczek przy propozycji paczki** powstaje z `meta.model` wpisu indeksu.
   Wpis bez `model` nie dostaje znaczka — ekran wyboru nie zgaduje modelu.
6. **Cele dotykowe ≥ 44 px** (`var(--cel)`) i `aria-pressed` na przyciskach,
   `role="img"` + `aria-label` na znaczku — ADR 0011 pkt 2 (dostępność).
7. Wybór jest **per paczka**: wejście na krok 5 czyści go (`wyczyscEkranPaczki`),
   a gra sieciowa wiezie go dalej w swojej `meta` (`metaSesjiMulti`) — bez
   nowych pytań i bez zapisu poza plikiem paczki (ADR 0013).

## Konsekwencje

- Repozytorium paczek zyskuje fakt „kto wygenerował pytania” bez zmiany
  schematu `TO-zestaw/2` (pole opcjonalne) — indeks i most działają jak były.
- Ekran wklejki zostaje bez instrukcji (ADR 0006, aneks 2026-09-16d): ikony są
  samotłumaczące, wybór nie blokuje wklejenia i nie wymaga potwierdzenia.
- Piny trzymają obie strony reguły: `test/kontrakt.test.js` (ADR 0053),
  `test/zestawy.test.js` (addytywność pola) i `test/zestawy-ui.test.js`
  (przełączanie, brak znaczka bez wyboru).

## Aneks 2026-09-17 (m12-159, ikony z plików właściciela) jest w archiwum

Ikony modeli to prawdziwe logo (JPG w `assets/ikony-modela/`, pole `plik`
w `MODELE_AI`, zero CDN — ADR 0001 pkt 1), w skorupie SW (`PLIKI_SHELL`);
starsza forma inline SVG jest zablokowana piniem.
`docs/decisions/archive/aneksy-0053-2026-09-17.md` (L62/L66, archiwizacja 2026-09-18).
