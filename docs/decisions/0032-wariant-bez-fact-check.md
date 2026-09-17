# 0032 — Wariant „Pytania (bez fact check)" jako domyślny

- Status: Zaakceptowana (zlecenie właściciela 2026-09-09)
- Data: 2026-09-09
- Dotyczy: PROTOKOL §2/§3/§6/§7, ADR 0008 (źródła), ADR 0017 (meta zestawu),
  ADR 0024 (pola addytywne), ekran 4, ekran 2, historia gier, ekran wyniku,
  most Apps Script (mail i strona przeglądu)

## Kontekst

Dotąd każda paczka wymagała twardej kwerendy w internecie: model szukał
każdego faktu w sieci, a walidator odrzucał pytania bez źródeł (E09).
To daje najlepsze pytania, ale generacja trwająca minuty i timeouty przy
dużych setupach. Właściciel chce szybszego wariantu domyślnego — z pamięci
treningowej modelu — z jawnym oznaczeniem, które paczki przeszły
weryfikację w sieci (złoty znaczek Q).

## Decyzja

1. **Dwa warianty promptu, jeden przełącznik.** Ekran 4 dostaje checkbox
   „Pytania z fact check" (domyślnie PUSTY) po prawej od „Kopiuj prompt".
   Pusty = wariant bez weryfikacji (szybki, z pamięci modelu, źródła
   opcjonalne). Zaznaczony = dzisiejsze zachowanie (twarda kwerenda,
   wymagane źródła).
2. **Znacznik odpowiedzi: `PYT/1.0-rev3`.** Wariant bez weryfikacji to
   rev2 minus twarde źródła: te same mechaniki (odwrócenie tekstu, kod
   pozycyjny poprawnej, samokontrola), inny profil walidacji. Szablon
   promptu jako drugi blok literalny w protokole
   (`SZABLON_PROMPTU_BEZ_WERYFIKACJI`), syncowany tym samym narzędziem.
3. **Źródła opcjonalne w rev3** (decyzja właściciela): E09 zgaszona dla
   rev3, a E10/E11/E15-tytuł sprawdzają kształt źródeł, GDY model je poda.
   Szablon mówi wprost: podaj adres TYLKO, gdy jesteś pewien, że istnieje
   — zmyślony adres jest gorszy niż brak.
4. **Znaczek Q** (złoty, decorative + `aria-label`) dla paczek
   zweryfikowanych w sieci: listy paczek na ekranie 2, historia gier,
   ekran wyniku, panel gry multi.

## §3 Nośnik wariantu: pole `wariantWejsciowy`

Dekoder normalizuje znacznik do `PYT/1.0` (protokol.js), więc sam znacznik
NIE doniósłby wariantu przez kontener `TO-paczka/2` do gry, mety i historii.
Dlatego dekodery (`odkodujPaczkeRev1/Rev2`, ten drugi uogólniony też na
rev3) stawiają na paczce roboczej pole `wariantWejsciowy` = znacznik
wejściowy. Pole jedzie w środku kontenera, więc round-trip
akceptacja → ukrycie → odpakowanie → gra zachowuje wariant BEZ zmian
w `app/kodowanie.js`.

Reguły pierwszeństwa:

- walidator bramkuje E09 wyrażeniem
  `(paczka.wariantWejsciowy ?? znacznikWejsciowy) !== 'PYT/1.0-rev3'`;
- `czyWariantFactcheck(paczka)` (protokol.js) odpowiada na pytanie „czy ta
  paczka przeszła weryfikację w sieci" tym samym wyrażeniem;
- organizator wkleja własną odpowiedź modelu — ręcznie wpisane
  `wariantWejsciowy` w surowym JSON-ie traktujemy jak resztę wklejki
  (zaufane wejście organizatora, nie atak).

Odrzucone: trzymanie oryginalnego znacznika na paczce roboczej (podwójne
dekodowanie przy re-wklejeniu ukrytego kontenera psułoby tekst; guard
idempotencji cicho zaakceptowałby błąd modelu) oraz wariant przez
`oczekiwane` (nie naprawia round-tripu przez kontener ani blob).

## §4 Trwałość: `factcheck` addytywne, brak pola = zweryfikowana

- `meta.factcheck` (zestaw publiczny, rejestr i wpis lokalny): `false`
  = bez weryfikacji. Stare zapisy bez pola = zweryfikowane (reguła
  `wpis.factcheck !== false`, jak addytywne `geohash6` z ADR 0024).
- Wpis historii (`RO-historia/1` przez `skrotGry`): to samo pole, ta sama
  reguła. Bez podbicia schematu — walidatory sprawdzają tylko pola
  wymagane, obce/addytywne przechodzą.
- Korekta dla modelu (`poprawkaDlaModelu`) dostawała parametr `factcheck`
  (domyślnie `true`); w wariancie bez weryfikacji NIE przypominała
  o kwerendzie ani URL-ach, bo narzuciłaby fact-check na odpowiedź.
  *2026-09-15d:* funkcja i jej przycisk usunięte (ADR 0006 aneks) — regułę
  niesie teraz sam szablon `PYT/1.0-nofc.5` (PROTOKOL §2.2).

## §5 Most Apps Script

- `budujIndeks` kopiuje metę hurtem (`Object.assign`) — `factcheck`
  płynie do indeksu bez zmian w skrypcie; `walidujKandydata` nie wymaga
  źródeł — paczki rev3 przechodzą bez zmian.
- Zmiany tylko jawnościowe: mail przeglądu i strona przeglądu adnotują
  wariant (dla paczki bez weryfikacji owner sprawdza przede wszystkim
  stacje i sens pytań, nie źródła).

## Aneks 2026-09-15e (ADR 0050)

Punkt 2 („Znacznik odpowiedzi: `PYT/1.0-rev3`") jest **zniesiony**: model nie
pisze już żadnego markera. O profilu źródeł wie aplikacja — ptaszek na ekranie
promptu stempluje `paczka.factcheck` przy przyjęciu, a zestawy z repozytorium
niosą to samo w `meta.factcheck`. Reszta decyzji obowiązuje bez zmian
(domyślnie wariant bez weryfikacji, E09 zgaszona dla paczek bez źródeł).

## Konsekwencje

- PROTOKOL: nowa §2.2 (szablon bez weryfikacji — blok literalny),
  §3.2 wiersz `zrodla` (wymagane rev2 / opcjonalne rev3), §3.4 akapit
  rev3, §6 wiersz E09 (bramka), §7 notka (rev3 = wariant zapisu,
  nie nowa wersja schematu).
- Testy: protokół (znacznik, bramka E09, kształt źródeł w rev3,
  round-trip, korekta wariantowa), aplikacja (checkbox, akceptacja,
  meta, znaczki, warunkowe źródła), kontrakt (sync drugiego bloku,
  checkbox, instrukcja), most (mail, strona, indeks).
- Szablon bez weryfikacji wersjonowany niezależnie
  (`SZABLON_WERSJA_BEZ_WERYFIKACJI`, start `PYT/1.0-nofc.1`); stopka
  pokazuje wersję szablonu z fact-check jak dziś, wariant widoczny
  na ekranie promptu i w nagłówku wyniku walidacji.

## Aneks 2026-09-13 (m12-113, zgłoszenie terenowe Q): znaczek mówi „Fact-checked"

Złota litera Q była dla właściciela nieczytelna — ten sam znaczek dostaje tekst
„Fact-checked". Styl zostaje (`.znaczek-factcheck` = `color: var(--zloto)`
+ `font-weight: 700`), więc kontrast pilnowany bramą i oba motywy są nietknięte.
Reguły z §4 bez zmian: znaczek stoi tylko przy paczkach zweryfikowanych, brak
pola `factcheck` w starych zapisach czytamy jak `true`, a przy wariancie bez
weryfikacji znaczka nie ma wcale. `role="img"` zostaje, a etykieta dla czytnika
ekranu i `title` mówią to samo, co widać: „Fact-checked: pytania zweryfikowane
w sieci".

## Aneks 2026-09-09 (rev5) jest w archiwum (poza budżetem lektury)

Wariant bez fact-checku nie wymusza sposobu pracy modelu („sposób ustalenia
faktów zostawiamy Tobie”); zakaz kwerendy żyje tylko w §2, gdzie fact-check jest
obowiązkowy — `docs/decisions/archive/aneksy-0032-2026-09-09.md`.
