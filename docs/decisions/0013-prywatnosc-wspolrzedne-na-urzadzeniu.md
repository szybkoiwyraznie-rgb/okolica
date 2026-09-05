# 0013 — Prywatność: współrzędne gracza nie opuszczają urządzenia poza zapytania mapowe, zero analityki

- Status: Proponowana (do potwierdzenia: lista dostawców i zgoda na wysyłanie przybliżonej pozycji)
- Data: 2026-09-05

## Kontekst

Aplikacja bez przerwy zna dokładne położenie użytkownika (ADR 0004) i — w grze
dla dzieci — jest używana w miejscu zamieszkania. Jednocześnie potrzebuje
zewnętrznych danych: kafelków mapy i sieci drogowej. Każde takie zapytanie
 ujawnia dostawcy przybliżoną pozycję. To decyzja właściciela, nie techniczna
drobnostka: dotyczy RODO/GDPR (dane o lokalizacji to dane osobowe), a gra może
być używana przez osoby poniżej 16 lat.

## Decyzja

1. **Zero analityki, zero ciasteczek, zero konta, zero zewnętrznych skryptów.**
   Strona nie wysyła nic poza żądaniami zasobów potrzebnych do działania.
   Brak `localStorage` jako identyfikatora użytkownika (klucze są techniczne,
   ADR 0010 pkt 1).
2. **Lista dostawców jest zamknięta i jawna** (`docs/ASSETS.md`): kafelki
   (CARTO/OSM/OpenTopoMap/Esri — wg ADR 0003), Overpass API (sieć drogowa,
   ADR 0005), Nominatim albo Overpass `isIn` (odwrotna geokodacja nazwy
   miejsca do promptu). Nowy dostawca = wpis w `docs/ASSETS.md` + nowy ADR.
3. **Minimalizacja pozycji w zapytaniach**:
   - kafelki: żądanie ujawnia tylko obszar ekranu i zoom (nie da się mniej);
   - Overpass: środek i promień, **bez identyfikatora użytkownika**, pozycja
     zaokrąglona do ~5 m (5. miejsca po przecinku) i powiększony promień
     (`R × 1.15`), żeby nie dało się z bbox-a odtworzyć dokładnego startu;
   - odwrotna geokodacja: tylko do uzyskania nazwy miejsca („Warszawa,
     Śródmieście") — **wyłączalna** w setupie (wtedy prompt ma same
     współrzędne, ADR 0006 pkt 3).
4. **Dane gracza zostają na urządzeniu**: fixy GPS, dziennik rozgrywki,
   odpowiedzi i wyniki trafiają wyłącznie do `localStorage` (ADR 0010) i do
   eksportowanego pliku, który użytkownik sam wybiera. Aplikacja nie ma
   funkcji „wyślij wynik".
5. **Współrzędne nie trafiają do repozytorium**: `.gitignore` wyklucza paczki
   i eksporty (`*.paczka.json`, `data/paczki-lokalne/`); fixture'y testowe
   (`test/fixtures/`) zawierają wyłącznie dane syntetyczne albo publicznie
   dostępne fragmenty OSM, bez śladów rozgrywek.
6. **Publiczne repozytorium paczek (ADR 0010 pkt 4) jest ryzykiem prywatności**:
   geohash paczki ≈ okolica zamieszkania organizatora, a treść pytań może
   zdradzać trasę spaceru z dzieckiem. Dlatego: publikacja wyłącznie paczek
   **zgrubnych** (geohash-5 ≈ 4,9 × 4,9 km, bez dokładnego środka), decyzja
   o każdej publikacji po stronie właściciela, oraz jawna zgoda organizatora
   w UI eksportu („udostępniasz paczkę publicznie — zawiera przybliżoną
   okolicę").
7. **Informacja dla użytkownika w aplikacji**: ekran „dane i prywatność"
   (jedna strona, prosty język) z listą: co jest pobierane, dokąd idzie
   pozycja, co zostaje na telefonie, jak to skasować. Bez prawniczego żargonu
   i bez „polityki prywatności" na 12 ekranów.
8. **Dzieci**: gra dla kategorii wiekowej 7–12 nie zbiera imion (pole „gracz"
   jest dowolnym tekstem, domyślnie „Gracz 1"), nie wymaga konta i nie ma
   funkcji społecznościowych. Publikacja wyników (ADR 0009 pkt 5) jest
   lokalna — udostępnienie to jawna akcja opiekuna.

## Konsekwencje

- Zależność od zewnętrznych dostawców jest widoczna i policzalna — da się ją
  wyłączyć (podkład offline, cache sieci, geokodacja wyłączona), a gra działa
  dalej w trybie zdegradowanym (ADR 0003 pkt 3, 0005 pkt 8).
- Brak analityki = brak wiedzy o użyciu. Rozwój opiera się na testach
  właściciela i zgłoszeniach, nie na metrykach.
- Jeśli kiedykolwiek pojawi się backend (multiplayer, ADR 0009 pkt 6), ten ADR
  zostaje **zastąpiony** nowym, z pełną analizą danych — nie „zaktualizowany".

## Powiązania

0003 (dostawcy kafelków), 0004 (fixy GPS), 0005 (Overpass), 0006 (geokodacja
w promptcie), 0010 (zapis i eksport), `docs/ASSETS.md`.
