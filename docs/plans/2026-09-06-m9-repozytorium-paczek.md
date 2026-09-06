# Plan M9 — Repozytorium paczek pytań (2026-09-06)

Kontekst: ROADMAP M9; ADR 0010 pkt 4 (faza docelowa repozytorium), ADR 0008 pkt 6
(przegląd źródeł przed publikacją), ADR 0007 (kontener TO-paczka/2), ADR 0013
(prywatność geohashu). Kryterium ROADMAP: **druga gra w tej samej okolicy nie
woła modelu**.

## Stan wyjściowy (rekonesans 2026-09-06)

- Eksport paczki (kontener TO-paczka/2 → plik) i import (wklej/z pliku na
  ekranie „Wklej odpowiedź modelu") **już działają** (M5/M7).
- Paczka PYT/1.0 niesie pytania z numerami stacji (`stacja: 1..N`), **bez
  współrzędnych** — współrzędne wybiera aplikacja (ekran „stacje", Overpass +
  ziarno). Sama paczka PYT nie wystarcza więc do odtworzenia gry na innym
  urządzeniu ani do drugiej gry bez sieci drogowej.
- `geohash(lat, lon, precyzja)` istnieje (`app/geo.js`), używany z 5 i 6.
- Cache sieci ma LRU i budżet (ADR 0010 pkt 1) — wzorzec do powtórzenia dla
  paczek lokalnych.
- Fixtures Overpass są **syntetyczne** — kuratorowana paczka publiczna musi
  mieć prawdziwe, publiczne punkty ze źródłami (R5).

## Decyzje zakresowe

1. **Nowy schemat publiczny `TO-zestaw/1`** (osobny plik, nie zmiana
   TO-paczka/2): `{ schemat, protokol, meta: { miejsce, geohash5, promienM,
   tematy, wiek, jezyk, data, autor, licencja, przegladZrodel }, stacje:
   [{ lat, lon, opis }], kontener: {…TO-paczka/2…} }`. Stacje jawne (punkty
   publiczne, zero prywatności), pytania dalej w kontenerze (spójność z ADR
   0007; „publiczna = dekodowalna" i tak, ale przypadkowy wgląd chroniony).
   Indeks czyta tylko `meta` — bez dekodowania.
2. **Lokalna reużywalność bez pliku**: przy przyjęciu paczki aplikacja zapisuje
   `okolica:zestaw:<skrot>` = `{ schemat: TO-zestaw-lokalny/1, stacje,
   kontener, konfig-skrót, geohash5, data, kodGry }` + rejestr
   `okolica:zestawy` (lista metadanych, LRU jak cache sieci: budżet 1,5 MB,
   maks. 8 wpisów). Druga gra w okolicy: karta propozycji → stacje i pytania
   z pamięci, **zero Overpassa i zero modelu**.
3. **Repozytorium publiczne w tym repo**: `data/paczki/*.zestaw.json` +
   generowany `data/paczki/indeks.json` (tylko meta). Aplikacja fetchuje
   indeks ścieżką względną (Pages, ten sam origin — zero CORS); URL
   konfigurowalny kluczem `okolica:repo-zestawow:url` (właściciel może
   wskazać własne repo/Pages — switchability jak Nominatim, ADR 0013).
4. **geohash5 w indeksie publicznym**: ~5 km bokse — dostatecznie grube, by
   nie wskazywać adresu organizatora, dostatecznie dokładne, by dopasować okolicę
   gracza (publikacja i tak jest jawną decyzją właściciela per paczka, ADR
   0010 pkt 4).
5. **Licencja paczek publicznych: CC BY-SA 4.0** (fakty z źródłami per ADR
   0008; cultura dzielenia jak OSM). Pola `licencja` i `przegladzrodel`
   obowiązkowe w `meta`; kontrakt pilnuje.
6. **Moderacja = właściciel**: publikacja = commit do `data/paczki/` po
   przeglądzie źródeł; indeks regeneruje `npm run indeks-paczek`; kontrakt
   pilnuje syncu indeks↔pliki i schematu TO-zestaw/1. Zero uploadu z
   aplikacji (ADR 0001: brak backendu).
7. Prywatne repo właściciela (`okolica-paczki`) zostaje **poza aplikacją**:
   prywatne = pliki eksportowane ręcznie (TO-zestaw/1) + własny Pages/raw
   wskazany kluczem URL. Aplikacja nigdy nie autoryzuje się nigdzie.

## Kroki

- [x] **R1 — plan + ADR 0017** (repozytorium paczek: schemat TO-zestaw/1,
      geohash5, licencja, moderacja, konfigurowalny URL).
- [x] **R2 — `app/zestawy.js`**: zapis/odczyt lokalny (TO-zestaw-lokalny/1),
      rejestr z LRU i budżetem, dopasowanie po geohash5+promien+tematy/wiek,
      walidacja surowa; testy `test/zestawy.test.js`.
- [x] **R3 — UI propozycji**: karta „Paczki dla tej okolicy" na ekranie
      pozycja (lokalne + repozytorium: status fetcha, lista dopasowań,
      „▶ graj z tą paczką", „nowe pytania (model)"); ścieżka gry z zestawem
      pomija ekrany stacje/prompt/paczka; eksport „⬇ paczka do repozytorium
      (TO-zestaw/1)" obok istniejącego eksportu; pole URL repo (zaawansowane).
- [x] **R4 — `tools/generuj-indeks-paczek.mjs`** + `data/paczki/`: walidacja
      schematu i skrótu kontenera, indeks z meta; `npm run indeks-paczek`;
      kontrakt indeks↔pliki.
- [ ] **R5 — pierwsza paczka kuratorowana**: Podkowa Leśna, 3 stacje w
      przestrzeni publicznej (weryfikacja źródłami), 6 pytań (wiek: dorośli,
      tematy: historia/kultura) ze źródłami sprawdzonymi `web_search`;
      wpis w indeksie; to demonstracja ścieżki publikacji (właściciel
      przegląda przed merge).
- [ ] **R6 — fetch repozytorium w aplikacji** (względny default, override
      kluczem, timeout i cicha degradacja do „brak propozycji" z logiem) +
      testy przepięć fetch + kontrakty (TO-zestaw/1, brak root-absolute,
      licencja/przegląd źródeł w meta).
- [ ] **R7 — domknięcie**: README (sekcja repozytorium), ARCHITECTURE
      (moduł + data/paczki), ROADMAP M9, PROJECT_HISTORY, rejestr ADR,
      opis PR #2; brama i CI zielone.

## Ryzyka

- Rozjazd stacji przy reużycie → uniknięty przez zapis współrzędnych w
  zestawie lokalnym (nie odtwarzamy z ziarna).
- Rozrost localStorage → budżet 1,5 MB + LRU + komunikat przy odrzuceniu
  zapisu (nigdy cicho, LESSONS L6).
- Fetch indeksu na Pages przed merge/publication → 404 = „brak paczek",
  nie błąd; status widoczny tylko organizatorowi.
- Paczka publiczna z danymi osobowymi → kontrakt: meta bez pól innych niż
  schemat; przegląd właściciela przed commit (proces, nie kod).

## Kryterium (ROADMAP)

Druga gra w tej samej okolicy: karta propozycji → pełna rozgrywka bez
promptu, bez wklejania, bez Overpassa i bez modelu.
