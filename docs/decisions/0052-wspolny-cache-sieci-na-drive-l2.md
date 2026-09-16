# 0052 — Wspólny cache sieci drogowej na Drive (L2)

- Status: Zaakceptowana (2026-09-16, uwaga terenowa właściciela)
- Data: 2026-09-16

## Kontekst

L1 nie zawsze pamięta okolicę: wyczyszczona pamięć, drugi telefon. Most
już jest (ADR 0016) — dokładamy mu katalog cache.

## Decyzja

1. **Katalog `okolica-sieci-cache` na Drive** (ten sam most, akcje
   `akcja=siec` i `siec-zapisz`). Wpis = kształt L1 (`zlozWpisSieci`).
2. **Kolejność odczytu: L1 → L2 → Overpass.** Trafienie L2 dokarmia L1.
   Most wybiera najświeższy wpis pokrywający (reguła jak L1); telefon
   waliduje odpowiedź własnym kodem.
3. **Zapis: po świeżym pobraniu Overpass, w tle, upsert nazwą**
   (`siec-<geohash6>-<R>-<tryb>-<lat>-<lon>.json`) — katalog nie puchnie.
   Limit wpisu 6 MB; większy nie wchodzi.
4. **Prywatność jak przy paczkach**: wpis niesie środek zapytania i leży na
   wydzielonym Drive; chroni go tylko adres mostu (ADR 0020).
5. **Awaria L2 nie jest błędem gry**: brak mostu, brak wpisu, odmowa —
   gra jedzie do Overpass po cichu. UI mówi tylko o trafieniu (L2).

## Konsekwencje

- Drugi telefon i telefon po czyszczeniu też nie wołają Overpass, jeśli
  ktoś tę okolicę już pobrał. Po scaleniu właściciel wdraża most na nowo;
  katalog zakłada się sam przy pierwszym użyciu.
- Parytet most↔aplikacja pilnuje `test/most-sieci.test.js` (LESSONS L33).

## Cytat decyzji

Właściciel, 2026-09-16: „Może dałoby się te już pobrane zapisywać np. na
Drive dla danego geohasha?”
