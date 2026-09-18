# 0060 — Współrzędnych nie ma w prompcie

- Status: Zaakceptowana (2026-09-18, właściciel — uwagi terenowe: „model z
  współrzędnych nic nie robi, mierzyłem — identyfikacja okolicy z dokładnością
  ±20 km; kotwicą są nazwy własne z Overpassa”)
- Data: 2026-09-18
- Wersja protokołu: `PYT/1.4`; szablony `PYT/1.4.0` / `PYT/1.4-nofc.0`.

## Kontekst

Prompt nosił liczbowe współrzędne w dwóch miejscach: linia `środek gry
(szerokość geograficzna, długość geograficzna): {LAT}, {LON}` i każda linia
stacji `- stacja N: LAT, LON — <opis> (X m od środka gry)`. Właściciel:
model z tych liczb nie korzysta — próbował, identyfikacja okolicy wychodzi z
dokładnością ±20 km, a realną kotwicą (zasada 3 §2: stacja → ulica →
dzielnica) są nazwy własne z OpenStreetMap, które aplikacja i tak podaje w
opisach stacji i w `{MIEJSCE}`.

## Decyzja

1. **Prompt traca współrzędne**: znika linia `środek gry: {LAT}, {LON}`;
   linia stacji: `- stacja N: <opis miejsca albo „punkt w terenie
   (bez nazwy)">(X m od środka gry)`. Odległość od środka gry zostaje
   (liczba, która ma sens: jak daleko od startu).
2. **Schemat paczki `okolica` traca `lat/lon`** — model nie zwraca już
   współrzędnych, bo ich nie dostaje. `okolica` = `{ promienM, miejsce }`.
3. **Walidacja**: `E17` wycofana (nie ma czego sprawdzać); `E16` traci
   sprawdzenie „środek paczki > 500 m od środka gry” (zostają: promień,
   tematy, język). `E15` bez `lat/lon`.
4. **Dodawczość**: stare paczki NIESIĄ `okolica.lat/lon` — pola są
   ignorowane, paczki czytane (wzór ADR 0058). Współrzędne stacji zostają
   w DANYCH APLIKACJI (`STAN.stacje` — pinezki, dystans do gracza); trafiają
   do schowka tylko bez modeli.
5. **Konsekwencja operacyjna**: bez nazw miejsc (brak sieci drogowej) model
   nie może napisać zakotwiczonych pytań (zasada 3 zabrania naciąganej
   kotwicy) — bramka „gra bez sieci nie startuje” jest osobnym ADR (0061).

## Konsekwencje

`app/protokol.js`: oba szablony, `opisListyStacji`, `zbudujPrompt` (bez
`LAT`/`LON`, fallback `MIEJSCE` = `brak odczytu nazwy miejsca`), walidacja
(E15/E16/E17), wersje. PROTOKOL: §2/§2.2 (szablony), §2.1 (tabela), §3.1
(pola), §6 (kody), §7 (historia), §8 (przykład). Piny: kontrakt
(szablony↔dokumenty), protokol (kształt linii stacji, walidacja bez E17,
ignorowanie `lat/lon` w starej paczce).
