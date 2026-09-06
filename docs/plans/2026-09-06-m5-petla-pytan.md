# Plan M5 — pętla pytań: podgląd organizatora, edycja, eksport pliku, geokodacja

Data: 2026-09-06 · Kamień: **M5** (ROADMAP) · Poprzednik: M4 (kod gotowy,
kryterium terenowe u właściciela) · Decyzje wiążące: ADR 0006, 0007, 0008,
0010, 0011, 0013; PROTOKOL PYT v1.0 §3.1/§6; ASSETS §3.

## Zakres kamienia (ROADMAP M5)

> Ekran promptu (kopiowanie, import/eksport pliku, instrukcja obrazkowa),
> walidacja z kodami E01–E20 i przyciskiem „skopiuj poprawkę do modelu",
> ukrywanie paczki (kontener `TO-paczka/2` — gotowe w M0), podgląd „tylko
> dla organizatora" z ręczną edycją i zapisem `modyfikacje[]`, odwrotna
> geokodacja nazwy miejsca (wyłączalna).
> Kryterium: pełna pętla przechodzi z prawdziwym modelem (test właściciela),
> a odrzucona paczka daje czytelną listę usterek.

**Już jest (M0 — nie ruszamy, tylko uzupełniamy):** ekran promptu z
kopiowaniem (schowek + pole zapasowe) i pobieraniem promptu do pliku; ekran
„paczka" z wklejaniem (schowek/plik), odczytem czterech postaci (kontener
`TO-paczka/2`, sam blob, jawny JSON, śmieć → komunikat), walidacją E01–E20,
listą usterek, „⧉ Kopiuj poprawkę do modelu" (`poprawkaDlaModelu`),
podsumowaniem przyjętej paczki, „⧉ Ukryj paczkę" (kontener → schowek + pole)
i natychmiastowym czyszczeniem pola wklejenia (ADR 0007 pkt 4).

**Do zrobienia w M5:** podgląd i ręczna edycja pytań z `modyfikacje[]`
(ADR 0006 pkt 8), eksport ukrytej paczki do pliku (ADR 0010 pkt 3),
instrukcja obrazkowa ekranu promptu (ADR 0006 „Konsekwencje", ADR 0011),
odwrotna geokodacja nazwy miejsca — domyślnie WYŁĄCZONA (ADR 0013 pkt 2,
ASSETS §3).

## Kroki

- [x] **J1 — plan kamienia** (ten plik) + commit.
- [x] **J2 — edycja paczki jako czysta funkcja:** `protokol.js`
      `zastosujEdycjePaczki(paczka, edycje, { terazMs })` — `edycje` to lista
      `{ pytanieId, zmiany: { tresc?, odpowiedzi?, poprawna?, wyjasnienie?,
      zrodla? } }` (pytanie identyfikuje kanoniczne `id` z PROTOKOL §3.2, nie
      para stacja+numer);
      funkcja zwraca NOWĄ paczkę (niezmiennikowość jak w `rozgrywka.js`)
      z dopisanym `modyfikacje[] = { data, opis }` per zmiana (PROTOKOL §3.1);
      walidacja samej edycji (pusta treść, indeks poprawnej poza zakresem,
      zduplikowane odpowiedzi → usterki E jak przy walidacji paczki);
      `terazMs` wstrzykiwane (zegar nie z globali). Testy czyste: kształt
      `modyfikacje[]`, odmowy, brak mutacji wejścia, determinizm `data`.
- [x] **J3 — podgląd „tylko dla organizatora" + edycja w UI:** sekcja pytań
      per stacja na ekranie „paczka" (widoczna po przyjęciu; banner
      „TYLKO DLA ORGANIZATORA — gracze nie powinni tego widzieć", ADR 0006
      pkt 8); edycja treści/odpowiedzi/poprawnej/źródeł → „Zapisz poprawkę"
      → `zastosujEdycjePaczki` → **re-walidacja całej paczki**
      (`walidujPaczke`) → odświeżone podsumowanie; usterki blokują „Ukryj
      paczkę". Po ukryciu podgląd się zwija (plaintext nie zostaje na
      ekranie). Testy na atrapie: pełny przepływ edycji, `modyfikacje[]`
      w ukrytym kontenerze (odpakowanie i sprawdzenie), blokada po zepsuciu
      paczki edycją, zwinięcie po ukryciu.
- [x] **J4 — eksport pliku paczki:** „⬇ Zapisz paczkę (plik)" przy „Ukryj
      paczkę" → Blob z `JSON.stringify(zapakujPaczke(...))`, nazwa
      `okolica-<kod gry>.paczka.json` (kod gry z `STAN.konfig.kodGry`,
      oczyszczony do `[a-z0-9-]`); import tą samą drogą już działa
      (`plik-odpowiedz` → `odpakujPaczke` z surowego tekstu). Plik niesie
      WYŁĄCZNIE kontener — nigdy plaintext (ADR 0007 pkt 4). Sprawdzić, że
      `.gitignore` pokrywa `*.paczka.json` (ADR 0010 pkt 3). Testy: nazwa
      pliku, zawartość = kontener, round-trip eksport→import.
- [ ] **J5 — odwrotna geokodacja (opt-in, domyślnie wyłączona):**
      `geokodujOdwrotnie({ lat, lon })` — Nominatim `reverse` zgodnie
      z ASSETS §3: `format=jsonv2`, `accept-language=pl`, `zoom=14`,
      pojedyncze żądanie na grę, tylko gdy `STAN.miejsce` puste (degradacja
      bez Overpass — w M4 nazwa miejsca pochodzi z `{area}`); przełącznik
      „Nazwa miejsca z Nominatim (domyślnie wyłączony)" na ekranie „dane
      i prywatność" + klucz `okolica:geokodacja` ('0'/'1', łapie się na
      dwustopniowe kasowanie `okolica:*`); fetch wyłącznie `window.fetch`
      (LESSONS L18); wynik aktualizuje `pozycja-miejsce` i `{MIEJSCE}`
      promptu. Testy: domyślnie ZERO żądań, po włączeniu — URL i parametry
      dokładnie jak ASSETS §3, błąd/brak sieci = cicho puste miejsce
      (komunikat, nie wyjątek); kontrakt parametrów polityki.
- [ ] **J6 — instrukcja obrazkowa + dokumentacja:** cztery kroki na ekranie
      promptu jako inline SVG (zero CDN/plików zewnętrznych — ADR 0001,
      0011 pkt 6): 1) kopiuj prompt → 2) wklej do modelu AI (z zaznaczeniem
      „model musi szukać w internecie" — ADR 0008) → 3) kopiuj odpowiedź →
      4) wklej z powrotem; cele dotykowe, kolejność DOM = kolejność kroków.
      Dokumentacja: ARCHITECTURE (podgląd/edycja/geokodacja w przepływie A.5–A.8),
      ROADMAP M5 (kod gotowy, pętla z modelem — właściciel), PROJECT_HISTORY,
      README, LESSONS jeśli coś zaskoczy, cache-busting `?v=m5-1`,
      aktualizacja PR #2.

## Decyzje projektowe

1. **Kształt `modyfikacje[]`:** `{ data, opis }` dokładnie jak PROTOKOL §3.1
   — kanon protokołu wygrywa z luźnym „kto/co/kiedy" z ADR 0006 pkt 8:
   w hot-seat (ADR 0009) „kto" jest zawsze jedno (organizator), a „co"
   niesie `opis` (np. „stacja 2, pytanie 1: poprawiono treść"). Bez zmian
   w PROTOKOL i bez podbijania wersji.
2. **Edycja NIE omija walidacji:** każda zapisana poprawka uruchamia
   `walidujPaczke` na całości; usterki blokują ukrycie. Ręczna edycja jest
   zmianą pierwszej klasy z pełną odpowiedzialnością protokołu.
3. **Eksport = ukryty kontener:** plik `.paczka.json` zawiera obiekt
   `TO-paczka/2` (JSON), nie plaintext — spójne z ADR 0007 pkt 4 i gotowe
   do przyszłego repozytorium paczek (ADR 0010 pkt 4, M9).
4. **Geokodacja domyślnie WYŁĄCZONA:** ADR 0013 pkt 2 wprost („Nominatim
   jest domyślnie wyłączony i dopuszczony wyłącznie jako warstwa zapasowa");
   po M4 luka jest wąska (tylko degradacja bez Overpass), więc domyślne
   „wyłączone" niczego użytkownikowi nie odbiera. Żądanie idzie
   z przeglądarki użytkownika (jego urządzenie, jego decyzja) — nie
   z serwera platformy, co mieści się w polityce OSMF (ASSETS §3).
5. **Instrukcja obrazkowa = inline SVG w `index.html`:** zero nowych plików
   graficznych i zero CDN (ADR 0001 pkt 1); kroki są krótkie i czytelne
   na 360 px (ADR 0011), a istniejący układ „jeden krok na ekran" zostaje.

## Ryzyka

- **Podgląd kusi wyciekiem plaintextu** na ekranie — mitygacja: banner,
  zwinięcie podglądu po ukryciu paczki, pole wklejenia czyszczone już w M0.
- **Edycja psuje spójność z konfiguracją** (np. pytanie spoza kanonu
  tematów) — mitygacja: re-walidacja całości po każdej edycji (decyzja 2).
- **Nominatim limit/rate** — pojedyncze żądanie na grę, opt-in, komunikat
  błędu bez retry (ASSETS §3: 1 żąd/s — my wysyłamy jedno).
- **Eksport pliku na iOS/Chrome mobile** — `URL.createObjectURL` + `<a
  download>`; jeśli przeglądarka zablokuje, komunikat wskazuje „Ukryj
  paczkę" + schowek jako drogę zapasową (wzorzec degradacji z M0).

## Kryteria akceptacji (kamień)

- Właściciel (WORKFLOW §4.2): pełna pętla z prawdziwym modelem (prompt →
  odpowiedź → walidacja → edycja → ukrycie → plik → import) i czytelną
  listą usterek przy odrzuconej paczce.
- Agent: J2–J6 zielone bramą (`npm run brama`), każdy krok commit + push,
  PR #2 zaktualizowany po zamknięciu części kodowej.
