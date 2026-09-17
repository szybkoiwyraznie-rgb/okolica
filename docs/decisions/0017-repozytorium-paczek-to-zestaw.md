# 0017 — Repozytorium paczek: schemat `TO-zestaw/1`, geohash5, licencja i moderacja publikacji

- Status: Proponowana (wymóg ROADMAP M9 „nowy ADR przed wdrożeniem";
  wdrożone w M9, do potwierdzenia przez właściciela przy przeglądzie PR)
- Data: 2026-09-06

## Kontekst

M9: **druga gra w tej samej okolicy nie woła modelu**, a ciekawe paczki idą do
ponownego użycia (ADR 0010 pkt 4). Trzy pytania wymagały własnej decyzji przed kodem:

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
6. **Dostęp z aplikacji**: docelowo głównym źródłem współdzielonym jest
   **Drive + Apps Script** (ADR 0016, decyzja właściciela 2026-09-06: upload
   zestawu po grze, przegląd i akceptacja właściciela, indeks zaakceptowanych
   dla graczy). Do czasu wdrożenia mostu działa indeks offline: ścieżka
   względna `data/paczki/indeks.json` (Pages, ten sam origin — zero CORS i zero
   kluczy); override kluczem `okolica:repo-zestawow:url` (własne Pages/raw
   właściciela albo URL web app Apps Script, switchability jak endpoint
   Nominatim, ADR 0013). 404/timeout = „brak propozycji" z logiem, nigdy
   blokada gry.
7. **Kopia lokalna (kryterium M9)**: przy przyjęciu paczki aplikacja zapisuje
   `okolica:zestaw:<skrot>` (`TO-zestaw-lokalny/1`: stacje + kontener + skrót
   konfiguracji + geohash5 + data + kod gry) i rejestr `okolica:zestawy`
   z LRU (budżet 1,5 MB, maks. 8 wpisów — wzorzec cache sieci, ADR 0010 pkt 1).
   Druga gra w okolicy odtwarza stacje i pytania **z pamięci**: zero Overpassa,
   zero modelu, zero sieci. Dopasowanie propozycji: okolica (od 2026-09-07
   odległość od komórki geohash paczki ≤ 200 m — ADR 0024; wcześniej „ten sam
   geohash5"), promień
   i wiek, ta sama **liczba stacji i pytań na stację**, **tematy paczki
   zawierają się** w tematach konfiguracji (nie szersze — kryteria właściciela
   z 2026-09-06) oraz promień paczki ≤ promienia z setupu.
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

## Aneksy 2026-09-06 … 2026-09-12 są w archiwum (poza budżetem lektury)

Historia tego ADR do aneksu 2026-09-12 włącznie — realizacja M9b (2026-09-06), tematWlasny (2026-09-07), faktyczne tematy pytań (2026-09-11), indeks dopisuje faktyczne tematy (2026-09-12, m12-92) oraz paczki tylko z repo (2026-09-12, m12-95) — leży w
`docs/decisions/archive/aneksy-0017-2026-09-06-do-12.md`, poza budżetem lektury startowej (AGENTS.md §0; LESSONS L62). Zawiera aneksy z dat: 2026-09-06, 2026-09-07, 2026-09-11, 2026-09-12, 2026-09-12. Aneksy 2026-09-11, 2026-09-13 (P i S) i 2026-09-13d są też w archiwum — patrz wskazówka niżej.

## Aneksy 2026-09-11, 2026-09-13 (P/S) i 2026-09-13d są w archiwum (poza budżetem lektury)

Koniec moderacji wstępnej (paczki od razu w zaakceptowanych; moderacja późna i
ręczna u właściciela), nazwa od miejsca i paczka z repo nie wchodzi na ekran
stacji, wstępne pobieranie paczek w tle — `docs/decisions/archive/aneksy-0017-2026-09-11-do-13d.md`.
