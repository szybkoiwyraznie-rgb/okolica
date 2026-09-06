# 0017 — Repozytorium paczek: schemat `TO-zestaw/1`, geohash5, licencja i moderacja publikacji

- Status: Proponowana (wymóg ROADMAP M9 „nowy ADR przed wdrożeniem";
  wdrożone w M9, do potwierdzenia przez właściciela przy przeglądzie PR)
- Data: 2026-09-06

## Kontekst

ROADMAP M9 chce, żeby **druga gra w tej samej okolicy nie wołała modelu**,
a ciekawe paczki dało się publikować do ponownego użycia (ADR 0010 pkt 4).
Trzy pytania musiały dostać własną decyzję, zanim powstanie kod (dlatego ten
ADR, a nie „przy okazji"):

1. **Prywatność**: paczka zdradza, gdzie organizator urządza gry — geohash
   paczki ≈ okolica zamieszkania (ADR 0013). Co wolno umieścić w indeksie
   publicznym?
2. **Licencja treści**: pytania niosą fakty ze źródeł (ADR 0008) i cudze
   opracowania; publikacja wymaga jasnej licencji, inaczej repozytorium
   staje się prawnym bagnem.
3. **Moderacja**: kto i jak publikuje? Zero backendu (ADR 0001) wyklucza
   upload z aplikacji; coś musi pilnować przeglądu źródeł (ADR 0008 pkt 6)
   i braku danych osobowych w paczkach publicznych.

Dodatkowo paczka PYT/1.0 ma pytania przy **numerach** stacji, bez współrzędnych
— współrzędne wybiera aplikacja z sieci drogowej. Publiczny plik musi więc
nieść stacje jawnie, inaczej drugie urządzenie nie odtworzy gry.

## Decyzja

1. **Publiczny plik paczki to `TO-zestaw/1`** — osobny schemat opakowujący
   kontener `TO-paczka/2` (bez zmian w ADR 0007):
   `{ "schemat": "TO-zestaw/1", "protokol": "PYT/1.0",
      "meta": { "miejsce", "geohash5", "promienM", "tematy", "wiek", "jezyk",
                "data", "autor", "licencja", "przegladZrodel" },
      "stacje": [{ "lat", "lon", "opis" }],
      "kontener": { …TO-paczka/2… } }`.
   Stacje są jawne (punkty przestrzeni publicznej — zero prywatności), pytania
   zostają w kontenerze: spójność z ADR 0007 i ochrona przed przypadkowym
   wglądem, choć paczka publiczna jest dekodowalna z założenia.
2. **Indeks publiczny (`data/paczki/indeks.json`) czyta tylko `meta`** — bez
   dekodowania kontenera i bez treści pytań. Generuje go
   `tools/generuj-indeks-paczek.mjs` (`npm run indeks-paczek`); kontrakt
   pilnuje syncu indeks↔pliki i obecności pól `licencja`/`przegladZrodel`.
3. **Geohash5 jako granularność indeksu**: bok ~2,4×4,9 km — nie wskazuje
   adresu, a dopasowuje okolicę gracza. Dokładniejsze współrzędne w indeksie
   są zakazane; pełne współrzędne niesie dopiero plik paczki (stacje).
4. **Licencja paczek publicznych: CC BY-SA 4.0** (`meta.licencja`), źródła
   każdego pytania wg ADR 0008, a `meta.przegladZrodel` niesie datę i podpis
   przeglądu właściciela. Paczka bez tych pól nie przejdzie narzędzia
   indeksującego — publikacja jest technicznie wymuszona na przeglądzie.
5. **Moderacja = wyłącznie właściciel**: publikacja to commit do
   `data/paczki/` w tym repozytorium (albo push do własnego repo właściciela).
   Aplikacja **nigdy nie uploaduje** (ADR 0001); eksport „paczka do
   repozytorium (TO-zestaw/1)" daje plik, który właściciel przegląda offline.
6. **Dostęp z aplikacji**: domyślnie ścieżka względna
   `data/paczki/indeks.json` (Pages, ten sam origin — zero CORS i zero
   kluczy); override kluczem `okolica:repo-zestawow:url` (własne Pages/raw
   właściciela, switchability jak endpoint Nominatim, ADR 0013). 404/timeout
   = „brak propozycji" z logiem, nigdy blokada gry.
7. **Kopia lokalna (kryterium M9)**: przy przyjęciu paczki aplikacja zapisuje
   `okolica:zestaw:<skrot>` (`TO-zestaw-lokalny/1`: stacje + kontener + skrót
   konfiguracji + geohash5 + data + kod gry) i rejestr `okolica:zestawy`
   z LRU (budżet 1,5 MB, maks. 8 wpisów — wzorzec cache sieci, ADR 0010 pkt 1).
   Druga gra w okolicy odtwarza stacje i pytania **z pamięci**: zero Overpassa,
   zero modelu, zero sieci.
8. **Prywatne repozytorium właściciela** pozostaje poza aplikacją: pliki
   TO-zestaw/1 + własny hosting wskazany kluczem URL. Aplikacja nie zna
   pojęcia „prywatne repo" i nigdzie się nie autoryzuje.

## Konsekwencje

- Nowa powierzchnia testów: schemat TO-zestaw/1 (kontrakt), LRU zestawów,
  dopasowanie geohash5, fetch z degradacją, ścieżka gry z zestawem (pominięcie
  ekranów stacje/prompt/paczka).
- Indeks jest.commitowany jak binaria ikon (Pages serwuje z drzewa); źródłem
  prawdy jest narzędzie, nie ręka.
- Publika zobaczy w indeksie tylko przybliżoną okolicę i metadane — treść
  pozna dopiero pobierając paczkę (świadomie: paczka publiczna jest jawna).
- Zmiana schematu TO-zestaw → migracja przez pole `schemat` (ADR 0010 pkt 6):
  nieznana wersja = odmowa z komunikatem, nigdy ciche przyjęcie.

## Powiązania

0001 (bez backendu), 0007 (kontener i ukrywanie), 0008 (przegląd źródeł),
0010 (trwałość, LRU, eksport), 0013 (prywatność geohashu, switchability).
