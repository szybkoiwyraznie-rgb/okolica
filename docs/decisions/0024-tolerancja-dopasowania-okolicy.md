# 0024 — Dopasowanie okolicy z tolerancją: odległość od komórki geohash, nie „ten sam geohash"

- Status: Zaakceptowana (2026-09-07, zgłoszenie i decyzja właściciela)
- Data: 2026-09-07

## Kontekst

Właściciel zatwierdził pierwszą paczkę dla Podkowy Leśnej (start ul. Bukowa 22),
a ekran pozycji i tak pokazywał „Repozytorium nie ma paczek dla tej okolicy".
Przyczyna w kodzie: `dopasujZestawy` (`app/zestawy.js`) filtrowała wpisy
warunkiem `w.geohash5 === geohash5` — **identyczny** geohash5 gracza i paczki.

Geohash to siatka, nie odległość. Komórka geohash5 ma ≈3,0 × 4,9 km (≈14,7 km²),
więc dwa punkty **kilka metrów** od siebie — ale po dwóch stronach granicy
komórki — mają różne geohash5 (zmierzone dla tego przypadku: `u3q8q` vs
`u3q8w`). Dokładne porównanie zamieniało zatem „jestem 5 m od startu paczki"
w „nie ma paczek dla tej okolicy". Kryterium M9 (współdzielenie gotowych
pytań) nie działało w miejscu, gdzie miało działać.

## Decyzja

1. **Dopasowanie liczy odległość, nie równość łańcucha**: paczka pasuje, gdy
   odległość gracza od jej komórki geohash ≤ `TOLERANCJA_OKOLICY_M = 200`
   (w środku komórki = 0). Funkcja `odlegloscDoKomorkiM(gh, lat, lon)` w
   `app/geo.js`; dla śmieciowego geohasha albo złych współrzędnych zwraca
   `null` (odmowa jawna, LESSONS L6).
2. **Tolerancja 200 m** — górna granica przedziału 100–200 m podanego przez
   właściciela. To margines na granicy komórki, NIE promień gry: paczka
   1 km w bok (375 m od swojej komórki) już nie pasuje.
3. **Nowe paczki niosą `geohash6`** (≈0,75 × 0,61 km, ≈0,46 km²) obok
   `geohash5` — dokładniejsza kotwica, pole addytywne (`zbierzMetaZestawu`).
   Most Drive przepisuje `meta` w całości (`budujIndeks`:
   `Object.assign({}, meta, …)`), więc indeks niesie je bez zmian w skrypcie.
4. **Stare pliki bez `geohash6`** dopasowują się po komórce geohash5: „gracz
   w tej samej komórce" (= dawna reguła) **plus** 200 m marginesu. To celowo
   zgrubne — paczka zakotwiczona 3 km dalej w tej samej komórce też się
   pokaże. Bez `geohash6` dokładniejszej kotwicy po prostu nie ma, a reguła
   musi naprawić paczki już opublikowane.
5. **Prywatność (uzupełnienie ADR 0013 pkt 6)**: publikacja pozostaje zgrubna
   — w indeksie jest komórka ≈0,46 km², nie punkt. Dokładny środek i tak jest
   publiczny od ADR 0017/0020: `?akcja=paczka&id=…` oddaje każdemu pełne
   współrzędne stacji. Geohash6 w indeksie nie ujawnia więc niczego nowego,
   a jest ~30× dokładniejszy od komórki geohash5 i ~10⁵× zgrubniejszy od
   współrzędnych, które most już serwuje. Współrzędne **gracza** nadal nie
   wychodzą z telefonu (ADR 0019 pkt 3, skaner w testach).

## Konsekwencje

- Ekran pozycji znajduje paczki także przy starcie przesuniętym o metry i przy
  przejściu przez granicę komórki — kryterium M9 działa w terenie.
- Komunikat braku mówi teraz, **dlaczego**: pusty indeks („repozytorium jest
  puste") i indeks z paczkami niedopasowanymi do setupu (lista kryteriów) to
  dwa różne komunikaty; drugi da się naprawić zmianą ustawień (ADR 0011 pkt 8).
- Bez pozycji (`lat`/`lon` niepodane) działa dawna reguła „ten sam geohash5" —
  rejestr lokalny i testy czystych funkcji nie potrzebują GPS.
- `ramkaGeohash` i `sasiednieGeohash` przeniesione z `app/wieloosobowa.js` do
  `app/geo.js` (geodezja, nie gra wieloosobowa); `wieloosobowa.js` re-eksportuje
  obie, więc importerzy nie zmieniają ścieżki.
- **Do zrobienia (BACKLOG B19)**: most Drive mógłby dopisywać `geohash6`
  wpisu legacy z pierwszej stacji pliku (`budujIndeks` ma `zestaw.stacje`),
  co uczyniłoby dopasowanie starych paczek równie dokładnym jak nowych.
  Wymaga wklejenia nowej wersji skryptu przez właściciela; klient jest gotowy
  (już woli `geohash6`).
- Testy: geometria z prawdziwego zgłoszenia (punkty ~1 m od siebie, różne
  geohash5), granica 200 m w obie strony, wpis legacy, reguła bez pozycji.
