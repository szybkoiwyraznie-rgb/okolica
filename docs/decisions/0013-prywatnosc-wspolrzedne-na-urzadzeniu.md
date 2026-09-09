# 0013 — Prywatność: współrzędne gracza nie opuszczają urządzenia poza zapytania mapowe, zero analityki

- Status: Proponowana (do potwierdzenia: lista dostawców i zgoda na wysyłanie przybliżonej pozycji)
- Data: 2026-09-05

## Kontekst

Aplikacja zna dokładne położenie użytkownika (ADR 0004), także dzieci w miejscu
zamieszkania — a potrzebuje zewnętrznych danych (kafelki, sieć drogowa), więc
każde zapytanie ujawnia dostawcy przybliżoną pozycję. To decyzja właściciela
(RODO: lokalizacja to dane osobowe; gra także dla osób poniżej 16 lat).

## Decyzja

1. **Zero analityki, zero ciasteczek, zero konta, zero zewnętrznych skryptów.**
   Strona nie wysyła nic poza żądaniami zasobów potrzebnych do działania.
   Brak `localStorage` jako identyfikatora użytkownika (klucze są techniczne,
   ADR 0010 pkt 1).
2. **Lista dostawców jest zamknięta i jawna** (`docs/ASSETS.md`): kafelki
   rastrowe (OSM Standard domyślnie, OpenTopoMap i Esri World Imagery jako
   warstwy opcjonalne — ADR 0003) oraz Overpass API (sieć drogowa **i** nazwa
   miejsca z obszarów administracyjnych — ADR 0005). **Nominatim jest domyślnie
   wyłączony** i dopuszczony wyłącznie jako warstwa zapasowa, na warunkach jego
   polityki (`docs/ASSETS.md` §3). Nowy dostawca = wpis w `docs/ASSETS.md`
   + nowy ADR.
3. **Minimalizacja pozycji w zapytaniach**:
   - kafelki: żądanie ujawnia tylko obszar ekranu i zoom (nie da się mniej);
   - Overpass: środek i promień, **bez identyfikatora użytkownika**, pozycja
     zaokrąglona do ~5 m (5. miejsca po przecinku) i powiększony promień
     (`R × 1.15`), żeby nie dało się z bbox-a odtworzyć dokładnego startu;
   - nazwa miejsca: z **tego samego** zapytania Overpass (obszary
     administracyjne), bez dodatkowego dostawcy — pobierana **zawsze**
     (przełącznik w setupie usunięty w Partii 2).
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
   **zgrubnych** (geohash-5 ≈ 3,0 × 4,9 km, bez dokładnego środka; od
   2026-09-07 indeks niesie też geohash-6 ≈ 0,75 × 0,61 km jako kotwicę
   dopasowania — uzasadnienie i granice w ADR 0024 pkt 5), decyzja
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
  ograniczyć (podkład offline, cache sieci, brak zgody na warstwę zapasową),
  a gra działa dalej w trybie zdegradowanym (ADR 0003 pkt 3, 0005 pkt 8).
- Brak analityki = brak wiedzy o użyciu. Rozwój opiera się na testach
  właściciela i zgłoszeniach, nie na metrykach.
- Jeśli kiedykolwiek pojawi się backend (multiplayer, ADR 0009 pkt 6), ten ADR
  zostaje **zastąpiony** nowym, z pełną analizą danych — nie „zaktualizowany".

## Powiązania

0003 (dostawcy kafelków), 0004 (fixy GPS), 0005 (Overpass), 0006 (geokodacja
w promptcie), 0010 (zapis i eksport), `docs/ASSETS.md`.
