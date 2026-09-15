# 0042 — Informacje: cała treść jedną, małą czcionką Courier New

- Status: Zaakceptowana (2026-09-13, uwaga H2 z testów terenowych właściciela)
- Data: 2026-09-13

## Kontekst

Ekran ⓘ Informacje był zlepkiem kilku warstw typograficznych: nagłówek „Informacje”
z `.ekran h2` (22 px), diagnostyka Overpass i próby sieci z własnymi rozmiarami,
stopka ze statusem, protokołem, szablonem i wersją (drobny tekst z separatorami),
linki kontaktu i — w drodze — węzeł sterowania grą przeniesiony z panelu
(ADR 0036 aneks 2026-09-13). Każdy z tych kawałków miał swój rozmiar i krój,
więc ekran wyglądał na posklejany z kilku miejsc.

Właściciel (2026-09-13, uwaga H2): „Całą treść Informacje pokazuj jedną, małą
czcionką Courier New tej samej wielkości.”

## Decyzja

1. **Jeden krój i jeden rozmiar dla całej treści warstwy.** Selektor
   `#ekran-informacje` i jego potomkowie tekstowe (`h2`, `h3`, `p`, `li`, `span`,
   `a`, `strong`, `code`, `.podpowiedz`, `button`) dostają
   `font-family: 'Courier New', Courier, monospace; font-size: 13px;
   line-height: 1.5; font-weight: 400; letter-spacing: 0`. Nagłówek nie jest już
   większy ani grubszy od reszty — wyróżnia go tylko miejsce na górze warstwy.
2. **Courier New z stosu systemowego, bez webfontu** (ADR 0001: zero zależności,
   zero plików do pobrania). Jeśli urządzenie nie ma Courier New, wchodzi
   `Courier`, a potem generyczny `monospace` — ekran i tak zostaje maszynowy.
3. **Cele dotykowe zostają ≥ 44 px** (ADR 0011): zmiana dotyczy wyłącznie
   `font-*` i `letter-spacing`, więc `min-height`/`padding` przycisków i linków
   są nienaruszone. Krzyżyk zamknięcia (`.warstwa-krzyzyk`) jest WYŁĄCZONY
   z zapisu — to ikona-cel, nie treść, a 13 px znak „✕” byłby trudny do
   trafienia wzrokiem.
4. **Kontrasty bez zmian**: kolory dalej biorą się z tokenów motywu
   (`--tekst`, `--tekst-slaby`, `--akcent`), więc `tools/audyt-kontrastu.mjs`
   nie dostaje nowych par do policzenia (mniejsza czcionka nie zmienia pary,
   a próg 4.5:1 dla tekstu jest z zapasem — najniższa para w motywie to 7.7:1).

## Konsekwencje

- Ekran jest teraz czytelny jako „arkusz techniczny”: status, protokół, szablon,
  wersja, diagnostyka sieci i kontakt wyglądają jak jeden wydruk, a nie jak
  trzy sklejone karty.
- Treść gry w Informacjach (o ile jakaś tam jest) też dostaje ten krój — to
  celowe: właściciel chce JEDNEGO wyglądu całej warstwy.
- Pin w `test/kontrakt.test.js` („kontrakt ADR 0042”) pilnuje, że zapis istnieje,
  obejmuje nagłówek i treść oraz wyklucza krzyżyk — bez niego kolejna zmiana
  typografii `.ekran h2` cicho przywróciłaby 22 px nagłówek.

## Wdrożenie

`app/styles.css` — zapis przy regułach `.informacje-tresc` (?v=m12-106); pin
w `test/kontrakt.test.js`. Bez zmian w `index.html` i `app/*.js` poza podbiciem
wersji cache-bustingu.

## Powiązania

ADR 0011 (mobile-first: cele dotykowe i czytelność), ADR 0035 (diagnostyka
Overpass w Informacjach), ADR 0036 (sterowanie w Informacjach — aneks
2026-09-13), ADR 0001 (zero zależności: font systemowy), ADR 0040 (gra bez
pauzy: Informacje w drodze).

## Aneks 2026-09-15 (m12-128, uwaga A właściciela) — jeden wiersz zamiast listy liczb

Po teście terenowym (PR #30): „»protokół PYT/1.0« i »szablon PYT/1.0.x« w Panelu
Informacje uważam za bezużyteczne. Zostaw tylko wersję — i to obok »Dane i
prywatność« oraz »Zgłoś błąd na mapie«, ewentualnie łamanego, jeśli zabraknie
miejsca".

1. Obie liczby zeszły z panelu; `Wersja …` stanęła w jednym wierszu
   (`.informacje-kontakt`) z przyciskiem prywatności, linkiem OSM i adresem.
2. Spójności wersji protokołu pilnują odtąd trzy nośniki i wystarczą trzy:
   `docs/PROTOKOL.md` ↔ `app/protokol.js` ↔ `README.md` (`test/kontrakt.test.js`),
   a łatka szablonu jest cytowana w §7 PROTOKOLU, bo tam powstaje.
3. Zasada ADR 0042 zostaje (drobny tekst, zero sterowania grą) i dostaje drugą
   nogę: w panelu nie ma liczby, której gracz nie umie na nic przetłumaczyć.
