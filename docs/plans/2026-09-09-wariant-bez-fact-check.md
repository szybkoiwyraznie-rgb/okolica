# Wariant „Pytania (bez fact check)" jako domyślny — plan

Data: 2026-09-09. Zadanie zlecone przez właściciela (rozmowa 2026-09-09).
ADR: 0032. Milestone: M5 (rozszerzenie zakresu — wariant promptu PYT).

## Cel

Ekran 4 dostaje checkbox „Pytania z fact check" (domyślnie pusty) po prawej
od „Kopiuj prompt". Odznaczony = nowy domyślny wariant: model bierze fakty
z pamięci treningowej (szybko, bez timeoutów, większe ryzyko halucynacji),
źródła opcjonalne. Zaznaczony = dzisiejsze zachowanie (twarda kwerenda
w sieci + wymagane źródła). Paczki zweryfikowane w sieci noszą złoty
znaczek Q: na listach paczek (ekran 2), w historii gier i na ekranie wyniku.

## Decyzje właściciela (wiążące)

1. `zrodla` w wariancie bez fact-check OPCJONALNE — model może je podać
   z pamięci; walidator sprawdza wtedy tylko kształt (E10/E11/E15-tytuł),
   nie obecność (E09 zgaszona).
2. Znaczek Q na listach paczek ORAZ w historii gier i na ekranie wyniku
   (szerszy zakres; dotyka schematu historii — addytywnie).

## Projekt (skrót; pełnia w ADR 0032)

- Znacznik odpowiedzi modelu: `PYT/1.0-rev3` (= rev2 minus twarde źródła:
  te same mechaniki odwrócenia i kodu pozycyjnego, inny profil walidacji).
- Szablon promptu bez weryfikacji jako DRUGI blok literalny w protokole
  (`SZABLON_PROMPTU_BEZ_WERYFIKACJI`, `SZABLON_WERSJA_BEZ_WERYFIKACJI`),
  syncowany tym samym narzędziem (`tools/synchronizuj-szablon.mjs`
  uogólnione do listy par bloków).
- Nośnik wariantu w dół strumienia: pole `wariantWejsciowy` stawiane przez
  dekodery (dekoder normalizuje znacznik do `PYT/1.0`, więc sam znacznik
  nie doniósłby wariantu przez kontener; patrz ADR 0032 §3).
- Walidator bramkuje E09: `(wariantWejsciowy ?? znacznik) !== rev3`.
- `poprawkaDlaModelu` wariantowo-świadoma (parametr `factcheck`,
  domyślnie `true` — stara sygnatura działa).
- Meta zestawu / wpis rejestru / wpis historii: addytywne `factcheck`
  (`false` = bez weryfikacji; BRAK pola w starych zapisach = zweryfikowana,
  reguła `!== false`).
- Apps Script: indeks i walidacja kandydata przechodzą bez zmian
  (kopiowanie hurtem, brak wymogu źródeł); mail przeglądu i strona
  przeglądu dostają adnotację o wariancie.

## Commity (każdy: testy + weryfikacja, `?v=` bump na commit dotykający `app/*.js`)

1. `protokół: rev3 + szablon bez weryfikacji + bramka E09` — PROTOKOL §2.2,
   sync tool, `app/protokol.js`, `test/protokol.test.js` (+ bump).
2. `ekran 4: checkbox + prompt wariantowy + meta` — `index.html`,
   `app/app.js` (budowa promptu, akceptacja, meta), testy aplikacji (+ bump).
3. `znaczek Q + warunkowe źródła` — listy, historia, wynik, panel multi,
   status odpowiedzi, CSS, testy (+ bump).
4. `most: adnotacje wariantu + docs` — `.gs` (mail, strona przeglądu),
   testy mostu, ARCHITECTURE/WORKFLOW/README/ADR 0017 aneks (bez bumpa —
   brak zmian w `app/`).
5. Handoff + PROJECT_HISTORY + opis PR #5.

## Kryteria akceptacji

- [ ] Checkbox na ekranie 4, domyślnie pusty, po prawej od „Kopiuj prompt";
      przełączenie przebudowuje prompt (rev2 ↔ rev3) i opis trybu.
- [ ] Odpowiedź rev3 bez źródeł przyjmowana; z błędnymi źródłami → E10;
      odpowiedź rev2 bez źródeł → E09 jak dziś.
- [ ] Korekta dla modelu nie żąda kwerendy w wariancie bez weryfikacji.
- [ ] Q na listach paczek / w historii / na wyniku tylko dla zweryfikowanych;
      stare zapisy (bez pola) traktowane jako zweryfikowane.
- [ ] Ekran pytania i wynik bez wiszących nagłówków źródeł dla paczek
      bez źródeł; status odpowiedzi nie wspomina źródeł, gdy ich nie ma.
- [ ] Kontrakt zielony (w tym sync obu bloków szablonu), `npm run check`
      i `npm test` zielone, live-check ekranu 4 + gry na rev3.
- [ ] Mail przeglądu i strona przeglądu adnotują wariant; indeks niesie
      `factcheck` do ekranu 2.

## Ryzyka

- Dryf między blokiem literalnym a stałą JS → pilnuje `npm run check`
  (rozszerzony na drugi blok) + test kontraktu.
- Podwójne dekodowanie przy round-tripie kontenera → test
  akceptacja → ukrycie → odpakowanie → walidacja dla rev3.
- Rozjechanie znacznika z polem `wariantWejsciowy` w ręcznie sklejanych
  JSON-ach → reguła pierwszeństwa w ADR 0032 §3, test.
