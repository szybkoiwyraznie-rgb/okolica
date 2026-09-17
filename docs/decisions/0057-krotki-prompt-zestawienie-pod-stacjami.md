# 0057 — Krótki prompt: tylko to, co model piszący pytania potrzebuje

- Status: Zaakceptowana (2026-09-17e, właściciel — przegląd wygenerowanych promptów)
- Data: 2026-09-17

## Kontekst

Właściciel sprawdził prompty z `m12-160`: „w prompcie powinno być tylko to,
co jest potrzebne modelowi do napisania pytań”. Odrzucił jako „informacja
dla mnie… dla modelu bezsensowna”: sekcję `GRACZE — POZIOMY PYTAŃ` z
IMIENIAMI GRACZY i mechaniką odpowiedzi, meta-komentarz „bo modele to
zapominają”, `data przygotowania` + `data` w schemacie, `liczba graczy`.
Zrelaksował też poziom DZIECKO („Dziecko 10 lat to nie przedszkolak — umie
liczyć, zna podstawowe daty, fakty, nazwiska”; nowy tekst opisu: §4
PROTOKOL / `konfig.js`).

## Decyzja

1. **Kompozycja pytań pod KAŻDĄ stacją:** po wierszu stacji linia `2
   pytania dla dorosłych, 1 pytanie dla dzieci` (multi: jeden poziom).
   Nagłówek `STACJE` + reguła 4 ZASAD TWARDYCH: DOKŁADNIE tyle, ile podano.
2. **`{GRACZE_BLOK}` → `{POZIOMY_BLOK}`:** tylko wiersze `WYMAGANIA
   POZIOMU` (multi: + linia `POZIOM WSZYSTKICH PYTAŃ W TEJ GRZE (wybór
   organizatora)`). Imiona, kolejność, liczba graczy NIE trafiają do
   promptu.
3. **Bez daty i bez meta-komentarzy** (w tym nagłówek „ZASADA TWARDA” —
   zasady zostają, bez apelu do czytelnika).

## Konsekwencje

`app/protokol.js`: `opisListyStacji` (linia pod stacją), `blokPoziomow`
(zastępuje `blokGraczyPoziomow`), `liniaZestawieniaPytan`; `app/konfig.js`:
opis dzieci. PROTOKOL §2/§2.2/§2.1/§4/§7; szablony `PYT/1.3.1` /
`PYT/1.3-nofc.1`, cache `m12-161`. Piny: protokol, konfig, duza-paczka.
Zmiana TYLKO treści promptu — nie gry, nie paczek (ADR 0055/0056), nie mostu.
