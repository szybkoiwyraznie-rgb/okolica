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

## Aneks 2026-09-15 (m12-128) jest w archiwum (poza budżetem lektury)

Uwaga A właściciela z testów terenowych (jeden wiersz „Wersja …” zamiast listy
liczb) leży w `docs/decisions/archive/aneksy-0042-2026-09-15.md`, poza budżetem
lektury startowej (AGENTS.md §0; LESSONS L62). Obowiązuje dalej zasada
z tamtego aneksu: w panelu nie ma liczby, której gracz nie umie na nic
przetłumaczyć.

## Aneks 2026-09-16d (B26, przyciski-stopki w stopce Informacji) jest w archiwum

Przyciski-stopki (`.przycisk-stopka`): „Dane i prywatność” i „wyczyść pliki
tymczasowe” w stopce Informacji zostają 24 px (właściciel: „zmień obietnice,
wielkość 24 jest ok”); lista wyjątków od ≥ 44 px żyje w ADR 0011. `docs/decisions/archive/aneksy-0042-2026-09-16d.md`
(L62/L66, archiwizacja 2026-09-18).
