# `data/paczki/` — publiczne repozytorium paczek pytań

Każdy plik `*.zestaw.json` to paczka **TO-zestaw/1** (ADR 0017): meta z licencją
CC BY-SA 4.0 i przeglądem źródeł, jawne stacje (wyłącznie przestrzeń publiczna)
oraz kontener `TO-paczka/2` z pytaniami. `indeks.json` generuje
`npm run indeks-paczek` — niesie same meta, więc aplikacja dopasowuje okolicę
bez pobierania treści (geohash5, promień, tematy, wiek).

## Ścieżka publikacji (właściciel)

1. W aplikacji: przejdź grę albo wklej paczkę → „⬇ Paczka do repozytorium
   (TO-zestaw/1)" — plik wychodzi ze znacznikiem
   `przegladZrodel: „oczekuje przeglądu właściciela…"`.
2. Offline: sprawdź źródła każdego pytania (ADR 0008 pkt 6) i popraw pole
   `meta.przegladZrodel` na datę i podpis przeglądu; sprawdź, że stacje to
   miejsca publiczne, a w paczce nie ma danych osobowych (ADR 0013).
3. Połóż plik w tym katalogu i uruchom `npm run indeks-paczek` — narzędzie
   ODMÓWI zapisu indeksu, dopóki znacznik przeglądu nie zniknie (brama
   publikacji w kodzie, nie w pamięci).
4. Commit i push: Pages serwuje katalog, aplikacja podpowiada paczkę graczom
   w tej okolicy (ekran „Gdzie jesteś?").

Paczki prywatne NIE trafiają tutaj: prywatne repozytorium właściciela to pliki
+ własny hosting wskazany kluczem `okolica:repo-zestawow:url` (ADR 0017 pkt 6/8).
