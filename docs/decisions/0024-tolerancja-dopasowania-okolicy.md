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
- **BACKLOG B19 — zrealizowany** tego samego dnia (aneks poniżej): most Drive
  dopisuje `geohash6` wpisom legacy, a klient poszerza tolerancję dla kotwicy
  szacowanej.
- Testy: geometria z prawdziwego zgłoszenia (punkty ~1 m od siebie, różne
  geohash5), granica 200 m w obie strony, wpis legacy, reguła bez pozycji.

## Aneks (2026-09-07): kotwica szacowana dla starych paczek (B19)

**Kontekst.** Pliki opublikowane przed tym ADR-em mają tylko `geohash5`
(≈3,0 × 4,9 km), więc reguła „odległość od komórki ≤ 200 m" łapała też paczkę
zakotwiczoną 3 km dalej — nadmiarowe dopasowanie.

**Decyzja 6 — kotwica szacowana ze środka ciężkości stacji.** `budujIndeks`
w moście Drive czyta cały plik paczki, więc dla wpisu bez `meta.geohash6`
liczy geohash6 ze **średniej współrzędnych stacji** i oznacza wpis
`geohash6Szacowany: true`. Nie z pierwszej stacji (jak szkicował BACKLOG):
start gry leży w środku obszaru stacji, a pierwsza stacja bywa na jego skraju.

**Decyzja 7 — tolerancja szacowanej kotwicy to `200 m + promienM` paczki.**
Pozycja startowa starej paczki jest nieznana, ale każda jej stacja leży
w promieniu `meta.promienM` od niej — więc start oddalony od środka ciężkości
o cały promień nadal się dopasuje. To dowód braku regresji: gracz, który
wcześniej widział paczkę, widzi ją nadal, a nadmiarowe dopasowanie maleje
z ~4 km do ~`promienM` (domyślnie 500 m). Kotwica dokładna (`meta.geohash6`)
zostaje przy 200 m — poszerzenie dotyczy wyłącznie wpisów ze znacznikiem.

**Decyzja 8 — koder geohash w Apps Script jest testowany w tym repozytorium.**
`geohashPunkt()` w `.gs` to kopia `geohash()` z `app/geo.js` (Apps Script nie
importuje modułów ESM). `test/most-indeks.test.js` wycina ten fragment tekstu
skryptu, wykonuje go i porównuje z `app/geo.js` na siatce >500 punktów — kopia
nie rozjedzie się po cichu. BACKLOG zapowiadał „bez testów"; test okazał się
tańszy niż ryzyko.

**Konsekwencje.** Zmiana wymaga **wklejenia nowej wersji skryptu** przez
właściciela (Apps Script → wklej → wdróż); do tego czasu stare paczki zachowują
zgrubne dopasowanie, a nowe działają dokładnie. Indeks rośnie o dwa pola na
wpis (addytywne — stary klient je ignoruje).
