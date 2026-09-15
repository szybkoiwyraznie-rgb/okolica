# 0048 — Nazwa pliku paczki na Drive koduje fakty, nie geohash

- Status: Zaakceptowana (2026-09-15, decyzja właściciela: „nic nie mówiący ciąg
  liter zastąpię kodowaniem w nazwie miejsca startu, ulicy, daty, liczby pytań,
  wieku, promienia i fact-checku — żebym mógł porządkować pliki na dysku")
- Data: 2026-09-15
- Powiązania: ADR 0017 (`TO-zestaw/1`), 0024 i 0046 (meta), 0028 (`id` pod łapki)

## Decyzja

1. Most nazywa plik z `meta`, nie z geohashu:
   `<miejsce>[_<ulica>]_<data>[_<gggg>]_<N>pyt_wiek-<wiek>_<R>m_<Q|bez>.zestaw.json`
   — pola po `_`, w polu po `-`; diakrytyki i wielkie litery zostają, kropki,
   przecinki i znaki zakazane przez Drive stają się myślnikami.
2. Ulicę niesie addytywne `meta.ulica` (`ulicaZeStacji` w `app/zestawy.js`);
   walidator jej nie wymaga, więc stare paczki czytają się dalej (wzorzec
   `geohash6`, ADR 0024).
3. Unikalność trzyma godzina, nie skrót: ta sama paczka wysłana ponownie daje
   tę samą nazwę (retry idempotentny, `id` wraca), a dwie różne w tej samej
   minucie rozdziela `-2`…`-12` po porównaniu `kontener.skrot` — kolizja nazwy
   nie kasuje pracy organizatora i nie omija odrzucenia. Potwierdzenie w
   aplikacji cytuje nazwę pliku — po niej właściciel szuka paczki na Drive.
4. Strażnicy: `test/most-indeks.test.js` (atrapa Drive), `test/zestawy.test.js`,
   `test/kontrakt.test.js`.

## Aneks 2026-09-15 — sprawdzenie istnienia pliku idzie przez `hasNext()`

Pierwsza wersja (PR #30) szukała pliku po nazwie przez
`katalog.getFilesByName(nazwa).next() || …`. W Apps Script `FileIterator.next()`
na PUSTEJ kolekcji **rzuca wyjątek**, a nie oddaje `null` — więc dla każdej
nowej nazwy, czyli zwykłego przypadku, `przyjmijKandydata` przerywał się
wyjątkiem, `doPost` odpowiadał `{ ok:false, blad }` i paczka nie lądowała na
Drive (zgłoszenie właściciela 2026-09-15). Atrapa Drive w `test/helpers/most.js`
zwracała `undefined` zamiast rzucać, więc brama była zielona przy zepsutym
kontrakcie.

Od teraz: wspólne `pierwszyPlikNazwa(katalog, nazwa)` =
`it.hasNext() ? it.next() : null`, a atrapa iteratora rzuca tak jak prawdziwy
Drive. Reguła: sprawdzenie istnienia pliku NIGDY nie polega na `next()` bez
`hasNext()`. Pełny opis: `docs/LESSONS_ARCHIVE.md` → `## L73`.

