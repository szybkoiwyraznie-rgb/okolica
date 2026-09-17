# 0058 — Paczka bez źródeł i bez `utworzono`

- Status: Zaakceptowana (2026-09-17e, właściciel — przegląd wygenerowanych promptów)
- Data: 2026-09-17
- Zastępuje ADR 0008 w zakresie wymagania pól w JSON-ie (zasada „przy
  fact-check fakty sprawdzasz online” zostaje — pkt 2).

## Kontekst

Właściciel: „podawanie tych źródeł w pytaniach nie ma sensu — nikt tego nie
czyta, nie używa. Niech model tego w ogóle nie wpisuje”; „model nie
potrzebuje wpisywać utworzono — aplikacja sama nadaje datę zapisu”. Pola
`zrodla`/`utworzono` kosztowały ~1000 znaków promptu i trzy bramki
walidacyjne (E09, E10, E11).

## Decyzja

1. **`zrodla` znika z promptu i z walidacji** — model nie wpisuje źródeł;
   walidator pola nie widzi (E09/E10/E11 wycofane, numery nie wrócą).
2. **Semantyka fact-check (właściciel):** ptaszek zostaje. **Z fact-check:**
   każde pytanie MUSI być sprawdzone online — to WYMAGANIE w prompcie, ale
   model NIE musi tego dowodzić (bez cytowania, bez pola źródła). **Bez
   fact-check:** sprawdzania NIE WYMUSZAMY („Sposób ich ustalenia zostawiamy
   Tobie”; ADR 0032 bez zmian co do ducha).
3. **`utworzono` znika** — datę nadaje aplikacja sama przy zapisie
   (`zestawy.js`: `meta.data`); E11 wycofane.
4. **Dodawczość:** stare paczki NIESIĄ te pola — walidator je ignoruje, UI
   nadal je pokazuje (dane z paczki, bez wymogu); most nie zmieniany.

## Konsekwencje

`app/protokol.js`: walidacja bez E09/E10/E11, schemat bez pól,
`WERSJA_PROTOKOLU = 'PYT/1.3'`, cache `m12-161`. PROTOKOL §2/§2.2/§3/§6/§7.
Piny: protokol (ignorowanie pól, wersja); fixture `paczka-ok.json` BEZ
zmian (dowód dodawczości — `zrodla` w paczce przechodzi).
