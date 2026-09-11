# 0037 — Język pytań i podkład mapy zaszte w kodzie (polski + OSM)

- Status: Zaakceptowana
- Data: 2026-09-11
- Podstawa: polecenie właściciela („w ogóle to nie jest potrzebne w żadnym trybie").

## Kontekst

Do m12-73 setup miał dwa selecty: język pytań (`setup-jezyk`, kanon `JEZYKI`)
i podkład mapy (`setup-podklad`, kanon `PODKLADY`). W praktyce jedyna grająca
rodzina zawsze wybierała polski i OSM Standard, a pola zajmowały miejsce na
ekranie 360 px (WORKFLOW §4.2) i dokładwały dwa kryteria dopasowania paczek.

## Decyzja

1. **Pól wyboru nie ma w UI żadnego trybu** (hot-seat i multi). Język pytań
   to stała `JEZYK_GRY = 'polski'` w `app/konfig.js`; podkład to `'osm'`
   forsowane w `oczyscKonfiguracje` (raz przy starcie, raz przy każdym
   odczycie z `localStorage` — stare zapisy nie mogą przywrócić pola).
2. Kanon `JEZYKI` zniknął z `konfig.js`; kody walidacji **K04** (język) i
   **K06** (podkład) są usunięte — nie ma czego walidować.
3. Silnik mapy (`app/mapa.js`) zachowuje pełny kanon `PODKLADY` (ESri, brak
   podkładu itd.) — decyzja dotyczy WYBORU w UI, nie zdolności renderowania.
   `zmienPodklad` usunięte z `app.js` jako martwe.
4. Meta paczek i prompt nadal niosą `jezyk: 'polski'` — kontrakt z modelem
   i mostem bez zmian.

## Konsekwencje

- Setup jest krótszy o całą siatkę pól; w multi znikają też „pytań na stację"
  (ADR 0019 aneks m12-74), więc wspólny setup faktycznie różni się tylko
  zakresem opcji.
- Zmiana zdania = zmiana kodu i wersji (`?v=`), nie przełącznik. Świadomie:
  prywatna aplikacja jednej rodziny.
- Stare konfiguracje w `localStorage` z `jezyk`/`podkład` spoza kanonu są
  po cichu prostowane przy odczycie (LESSONS L9).

## Powiązania

- ADR 0003 (mapa kafelkowa), ADR 0022 (kanony zamknięte — teraz zamknięte
  mocniej), ADR 0019 aneks m12-74 (setup multi).
