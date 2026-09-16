# 0052 — Wspólny cache sieci drogowej na Drive (L2)

- Status: Zaakceptowana (2026-09-16, uwaga terenowa właściciela)
- Data: 2026-09-16

## Kontekst

L1 (telefon) nie zawsze pamięta okolicę: wyczyszczona pamięć, drugi telefon,
przeglądarka z limitem. Właściciel: „może dałoby się te już pobrane zapisywać
np. na Drive dla danego geohasha?” Most Drive już jest (ADR 0016) i już
trzyma pliki po stronie serwera — dokładamy mu katalog cache.

## Decyzja

1. **Katalog `okolica-sieci-cache` na Drive** (ten sam most, nowe akcje:
   `GET akcja=siec`, `POST siec-zapisz`). Wpis = ten sam kształt co L1
   (`zlozWpisSieci`: schemat `sieci/1`, `zapisanoMs`, `srodek`, `promienM`,
   `tryb`, `dane`).
2. **Kolejność odczytu: L1 → L2 → Overpass.** Trafienie L2 dokarmia L1.
   Most wybiera najświeższy wpis pokrywający (ta sama reguła co L1: dysk
   `R×1.15`, TTL 30 dni, zgodny tryb); telefon i tak waliduje odpowiedź
   własnym kodem (nie ufamy plikowi z dysku).
3. **Zapis: po świeżym pobraniu Overpass, w tle, upsert nazwą**
   (`siec-<geohash6>-<R>-<tryb>-<lat>-<lon>.json`) — powtórka nadpisuje plik,
   więc katalog nie puchnie. Limit wpisu 6 MB; większy nie wchodzi.
4. **Prywatność jak przy paczkach**: wpis niesie środek zapytania (≈ okolica
   organizatora) i leży na wydzielonym Drive właściciela; chroni go tylko
   adres mostu (ADR 0020). Jawne dane OSM + jawny środek — nic ukrytego.
5. **Awaria L2 nie jest błędem gry**: brak mostu, brak wpisu, odmowa —
   gra jedzie do Overpass po cichu. UI mówi tylko o trafieniu
   („ze wspólnego dysku — Overpass nie został wywołany”).

## Konsekwencje

- Drugi telefon i telefon po czyszczeniu też nie wołają Overpass — pod
  warunkiem, że ktoś już tę okolicę pobrał.
- Wdrożenie: po scaleniu właściciel wdraża most na nowo (standardowa
  procedura); katalog zakłada się sam przy pierwszym użyciu.
- Parytet most↔aplikacja (schemat, TTL, mnożnik, tryby, haversine) pilnuje
  `test/most-sieci.test.js` (LESSONS L33).

## Cytat decyzji

Właściciel, 2026-09-16: „Poza naprawieniem czytania tego z localstorage to
może dałoby się te już pobrane zapisywać np. na Drive dla danego geohasha?
Taki lokalny cache?”
