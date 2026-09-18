# 0059 — Cache sieci trybowo niezależne: unium klas + buckety promienia

- Status: Zaakceptowana (2026-09-18, właściciel — uwagi terenowe po testach
  na iPhonie; „tryb w kluczu jest bez sensu, dane różnią się tylko geohashem
  i promieniem”)
- Data: 2026-09-18
- Dotyczy: L1 (`app/sieci.js`, klucz `okolica:sieci:*`) i L2
  (`docs/setup/apps-script-repo-paczek.gs`, akcje `siec`/`siec-zapisz`).

## Kontekst

Właściciel: grając powtórnie w tym samym miejscu, aplikacja wzywała Overpassa
ponownie, bo klucz cache niósł dokładny promień gry i tryb — a dane de facto
nie zależą od nich. Pomiary pokazały: pieszy i rowerowy pobierają dokładnie
te same klasy dróg (m12-120), a samochodowy to ich podzbiór (bez
`path`/`pedestrian`/`track`) — więc istnieje jedno zapytanie wystarczające
dla wszystkich trybów.

## Decyzja

1. **Zapytanie trybowo niezależne** (`budujZapytanieOverpass` bez `tryb`):
   drogi klasami `KLASY_UNIWERSALNE` = unium `klasyDrog` wszystkich trybów
   (liczone z `TRYBY`, nie harokodowane). Filtrowanie per tryb zostaje po
   stronie klienta (`budujGraf`/`kandydaciNaStacje`/`czyDrogaDostepna`,
   ADR 0005 pkt 3 bez zmian).
2. **Buckety promienia** (właściciel): 0–1000, 1001–5000, 5001–10000,
   10001–25000 m. Klucz: `okolica:sieci:<geohash6>-<bucket>` — max 4 wpisy
   na komórkę, w praktyce 1. Promień zapytania = GÓRA BUKETA × 1,15, żeby
   dysk pokrywał całą komórkę (przekątna ~1,3 km przy 52°N) dla każdej gry
   w buncie.
3. **Pokrycie**: `czyWpisPokrywa` z tolerancją kotwicy 1400 m (była 200 m —
   dryf GPS; ADR 0010 aneks 2026-09-16). Tolerancja ≈ przekątnej komórki,
   więc wpis pokrywa KAŻDĄ grę z tej komórki w tym lub węższym buncie —
   powtórka w tej samej okolicy nigdy nie wzywa Overpassa. Wpis niesie
   `promienM` = BUCKET (opisuje dysk pobrania, nie R gry); trybu nie niesie.
4. **Schemat `sieci/2`**; wpisy `sieci/1` (trybowe, klucze z `-<R>-<tryb>`)
   są ignorowane i wygasają przez TTL 30 dni / LRU 2 MB — **bez migratora**
   (wzór ADR 0058; właściciel: „nie trzeba nic migrować — stare wpisy
   pokasuję z dysku”).
5. **L2 idzie w parze**: nazwa pliku `siec-<geohash6>-<bucket>.json`, odczyt
   bez parametru `tryb`, walidacja promienia przez bucket, pokrycie z
   tolerancją 1400 m (ADR 0052 aneks 2026-09-18). Do wdrożenia nowego mostu
   L2 jest nieczynna (stary most nie czyta `sieci/2` i odmawia zapisu) —
   awaria L2 nigdy nie jest błędem gry (ADR 0052 pkt 5).

## Konsekwencje

- Cena: gry samochodowe niosą w cache dodatkowo ścieżki/deptaki (klient je
  filtruje — zero wpływu na grę); bucket 25 km może przekroczyć budżety
  (L1 2 MB / L2 6 MB) → wtedy cache po prostu pominie wpis (jak dziś, `S04`).
- `POLITYKA.tolerancjaKotwicyM = 1400`; piny: `test/sieci.test.js`
  (klucz, bucket, pokrycie, klasy), `test/most-sieci.test.js` (nazwy plików,
  odrzuty, tolerancja), `test/aplikacja.test.js` (kształt wpisu L2).
- Dokumenty: ADR 0010 + ADR 0052 (aneksy 2026-09-18), ARCHITECTURE, ASSETS.
- Bump `?v=` idzie z dalszą partią (aplikacja + prompt razem na iPhona).

## Aneks 2026-09-18 — L1 skanuje wszystkie wpisy; dokarmienie z L2 niesie kotwicę źródła

Właściciel: ściągnięty szeroki wpis (koszyk 25000) powinien obsłużyć grę
o R=1000 także 5 km od kotwicy (inna komórka geohash6) — okrąg gry mieści
się w dysku wpisu, więc Overpass nie ma prawa być wołany.

1. Skan L1 po pudle klucza dokładnego obejmuje WSZYSTKIE klucze
   `okolica:sieci:*`, nie tylko komórkę startu — o pokryciu rozstrzyga
   `czyWpisPokrywa`, identycznie jak w L2. Wpis z sąsiedniej komórki lub
   szerszego koszyka obsługuje grę bez mostu i bez Overpass.
2. Dokarmienie L1 z L2 zapisuje wpis z kotwicą i koszykiem ŹRÓDŁA (nie
   bieżącej gry), więc prawdziwy zasięg danych działa też w L1; wpis
   źródła walidowany (`czyWspolrzedneOk` + kanon koszyków), inaczej
   kotwica = środek gry jak dotąd.
