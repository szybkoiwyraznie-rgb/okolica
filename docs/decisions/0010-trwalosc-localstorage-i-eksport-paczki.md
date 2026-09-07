# 0010 — Trwałość: `localStorage` dla rozgrywki, paczka pytań jako eksportowalny plik, docelowo repozytorium paczek

- Status: Proponowana (kierunek „repozytorium paczek" do potwierdzenia przez właściciela)
- Data: 2026-09-05

## Kontekst

Gra terenowa: telefon się rozładowuje, zasięg znika — stan musi przetrwać.
Właściciel chce docelowo **zbierać pytania dla obszarów** do ponownego użycia
bez wołania modelu (najpierw prywatnie, potem ewentualnie publicznie). Zero
backendu (ADR 0001) wyznacza środki: pamięć przeglądarki, pliki, GitHub.

## Decyzja

1. **`localStorage` jako jedyna pamięć trwała aplikacji**, klucz
   `okolica:<cel>:<id>`:
   - `okolica:konfig` — ostatnia konfiguracja (podpowiedzi w setupie),
   - `okolica:rozgrywka:<id>` — stan bieżącej gry (postęp, czasy, odpowiedzi,
     ziarno, próg dojścia),
   - `okolica:paczka:<id>` — **ciphertext** paczki pytań (ADR 0007),
   - `okolica:sieci:<geohash6>-<R>` — cache danych sieci drogowej (ADR 0005),
   - `okolica:historia` — lista ukończonych gier z wynikami (skrót, nie treść).
   Limit przeglądarki (~5 MB) pilnowany przez budżet rozmiaru: cache sieci ma
   TTL 30 dni i jest usuwany LRU przy przekroczeniu 2 MB.
2. **IndexedDB nie jest potrzebny** na tym etapie; jeśli paczki/cache przekroczą
   możliwości `localStorage`, migracja do IndexedDB wymaga nowego ADR.
3. **Paczka jest eksportowalnym plikiem** `.paczka.json` (kontener z ADR 0007
   pkt 3 + metadane: okolica, geohash, tematy, wiek, liczba stacji, data,
   `skrot`):
   - eksport przez `Blob` + `URL.createObjectURL` + `<a download>` (działa
     na Chrome/Android i Safari/iOS bez backendu),
   - import przez `<input type="file">` — paczka z innej rozgrywki albo od
     innego organizatora wchodzi do gry bez wołania modelu,
   - pliki paczek są w `.gitignore`: **do repo nie trafiają dane rozgrywek**
     (ADR 0013).
4. **Repozytorium paczek — faza docelowa (M9+, osobny ADR przed wdrożeniem)**:
   - *prywatne*: osobne repo właściciela (np. `okolica-paczki`) z układem
     `paczki/<geohash5>/<temat>-<wiek>-<data>.paczka.json` + generowany indeks
     `index.json` (geohash → lista paczek z metadanymi, bez treści),
   - *publiczne*: to samo repo z paczkami, które właściciel uzna za ciekawe,
     po **przeglądzie źródeł** (ADR 0008 pkt 6); aplikacja pobiera indeks i
     proponuje paczkę dla okolicy przed generowaniem nowej,
   - dostęp z aplikacji przez `fetch` do `raw.githubusercontent.com`/Pages —
     CORS działa dla obu, bez klucza,
   - paczka publiczna jest **jawna z założenia**: kontener `TO-paczka/2`
     (ADR 0007) to obfuskacja bez klucza, więc opublikowanie paczki =
     opublikowanie jej treści. Dlatego do paczek współdzielonych nie wolno
     wkładać danych osobowych ani niczego, co nie może być publiczne (ADR 0013),
     a warunkiem publikacji jest przegląd źródeł (ADR 0008 pkt 6).
5. **Wynik gry jest eksportowalny** (podsumowanie jako tekst/obraz do
   udostępnienia) i nie wymaga konta ani serwera.
6. **Migracje są obowiązkowe przy zmianie schematu**: każdy klucz ma pole
   `schemat`, a aplikacja przy starcie migruje albo odrzuca nieznane wersje
   z komunikatem (nigdy cicho — LESSONS L6 z AME: funkcja, która ukrywa dane,
   jest usterką).

## Konsekwencje

- `localStorage` jest per-origin i czyszczony przez przeglądarkę/przy
  czyszczeniu danych → **eksport pliku jest zabezpieczeniem rozgrywki**, a UI
  proponuje go po starcie gry (nie na końcu).
- Tryb prywatny/przeglądarki incognito potrafi zablokować `localStorage` —
  aplikacja wykrywa to przy starcie i gra dalej w pamięci, z ostrzeżeniem.
- Repozytorium paczek tworzy nową powierzchnię: licencja treści (pytania
  z źródłami), moderacja, prywatność (geohash paczki ≈ miejsce zamieszkania
  organizatora!) → dlatego decyzja o publikacji jest **jawną decyzją
  właściciela** i dostanie własny ADR, a nie „przy okazji".
- Testy: `test/trwalosc.test.js` z atrapą `localStorage` (czysta funkcja
  `czytajStan/zapiszStan` z wstrzykiwanym nośnikiem), budżet rozmiaru cache,
  migracje schematu.

## Powiązania

0001 (bez backendu), 0005 (cache sieci), 0006 (pętla treści), 0007 (kontener
i ukrywanie paczki), 0008 (przegląd źródeł), 0013 (prywatność geohashu).
