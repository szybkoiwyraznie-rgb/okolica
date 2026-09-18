# 0061 — Gra realna bez sieci NIE STARTUJE (bramka „Dalej”, pierścień = tryb testowy)

- Status: Zaakceptowana (2026-09-18, właściciel — uwaga terenowa 4: „niech
  aplikacja nie da przejść dalej, kiedy nie ma danych sieci. W trybie testowym
  zostaw pierścień, bo symulacje go potrzebują”)
- Data: 2026-09-18
- Zastępuje (co do trybu realnego): degradacja ADR 0005 pkt 8c (pierścień
  „osiągalność niezweryfikowana” w grze realnej).

## Kontekst

Przed decyzją aplikacja zawsze dawała graczowi jakiś układ stacji: gdy sieć
drogowa nie była dostępna (offline, limit instancji Overpass, blokada), a cache
był pusty, gra schodziła do układu pierścieniowego z komunikatem „osiągalność
niezweryfikowana” (ADR 0005 pkt 8c). Tak samo było przy S09 — sieć przyszła,
ale nie dała ani jednej drogi dla wybranego trybu: pierścień jako układ
zastępczy.

Właściciel: pytania powstają z NAZW miejsc (ulice, obiekty — OpenStreetMap),
które niesie sieć drogowa. Bez sieci dróg nazw nie ma, a bez nazw model nie
napisze zakotwiczonych pytań (zasada 3 protokołu: stacja → ulica → dzielnica).
Pytania o bezimienny układ punktów byłyby grą o nic — właściciel woli jawny stop:
ekran stacji mówi wprost, co jest nie tak, a gracz ma drogę wyjścia (ponowne
pobranie, zmiana okolicy albo trybu).

## Decyzja

1. **Gra realna bez sieci nie startuje.** Gdy `wybierzStacje` nie ma sieci
   (brak danych albo S09), stacji NIE MA: ekran stacji pokazuje jawny stop —
   podsumowanie „Stacji nie rozstawiono: brak danych sieci drogowej w tej
   okolicy”, opis „Pytania powstają z nazw miejsc (…) — bez sieci dróg nazw
   nie ma, więc gra nie startuje” i wskazówki: „↻ Pobierz sieć ponownie”,
   zmiana okolicy lub trybu.
2. **„Dalej” jest zablokowany, gdy stacji nie ma.** Przycisk
   `przycisk-dalej-prompt` dostaje `disabled` w rytmie ze stanem
   (`renderujStacje`), a jego nasłuch dodatkowo waliduje STAN (L10): klik bez
   stacji nie otwiera ekranu promptu, niezależnie od tego, co ktoś zrobił z
   DOM-em.
3. **Pierścień zostaje TYLKO w trybie testowym** (`?tryb=test` / `?test=true`):
   symulacje i atrapy testów potrzebują układu stacji bez sieci. W trybie
   testowym komunikat mówi o trybie uproszczonym (tak jak dotąd), a w UI
   testowym dopisek ADR. W grze realnej cichego układu zastępczego NIE MA.
4. **Tryb tajnej trasy (multi)**: bez sieci = ten sam jawny stop co trasa
   zwykła (organizator nie dostaje „stacji do ukrycia”).
5. **S09 też blokuje.** Sieć przyszła, ale zero dostępnych dróg dla trybu —
   karta błędów pokazuje S09, a gra idzie w ten sam stop (pkt 1), nie w
   pierścień.
6. **„Inny układ” znika w stany bez stacji** (nie ma układu do przeliczania);
   „Pobierz sieć ponownie” zostaje — to droga wyjścia.

## Konsekwencje

- Komunikaty o degradacji (stary status „stacje w trybie uproszczonym
  (pierścień): osiągalność niezweryfikowana” z `przeliczStacjeZPobraniem`)
  istnieją tylko dla trybu testowego; w grze realnej status mówi, że bez nazw
  miejsc pytania nie powstaną.
- ZRÓDŁA stacji (`ZRODLA_STACJI.pierscien` / „osiągalność niezweryfikowana”)
  i `stacjeProste` zostają w kodzie — żyją w trybie testowym (ADR 0005 pkt 8
  aneks 2026-09-18).
- Testy: pełne drogi realne (np. „droga w terenie”) idą teraz przez SIEĆ
  (cache L1 w teście) — bez sieci realna gra nie ma stacji, więc i nie ma
  czego kleić do gry.
- Wersja `?v=` idzie do `m12-162` (cache-bust przy zmianie zachowania).
- Uwaga dla właściciela (PR #44): decyzja o bramce jest nowa — jeśli w terenie
  okaże się, że jawny stop irytuje bardziej niż pierścień, odwracamy tę
  decyzję aneksem (kod jest w jednym miejscu: `przeliczZTegoCoJest` +
  `renderujStacje`).

## Aneks 2026-09-18 (uwaga terenowa 1) — jawny stop BEZ czerwonej karty

Teren: przy nieudanym pobraniu sieci ekran stacji pokazywał pod jawnym stopem
zdublowaną czerwoną kartę „[S03] siec: Nie udało się pobrać sieci dróg (…)
Spróbuj ponownie lub użyj trybu uproszczonego” — powtórzenie komunikatu stopu,
z literówką i obietnicą trybu, którego w grze realnej nie ma. Właściciel:
„Nie wyświetlaj tego czerwonego komunikatu w ogóle. Wystarczy to, co wyżej.”

1. **Stan końcowy jest pełnym komunikatem.** `zablokujStacje` (stop) i
   `pierścieńTrybTestowy` (testowa degradacja) czyszczą `bledy-stacje`.
2. **Karty sieciowe usunięte z ekranu stacji w obu trybach**: S03 z
   `pobierzSiec`, S09/pokrewne z `grafDlaTrybu` i z catcha
   `przeliczZTegoCoJest`. Diagnostyka nie znika — zostaje w ⓘ Informacje
   (lista prób `#siec-proby` + status), zgodnie z ADR 0035 aneks m12-60.
3. **Zostają karty przy ISTNIEJĄCYCH stacjach** (`zlozKarteUsterekStacji`,
   S12/S14) — gra toczy się dalej, więc karta nie dubluje stopu.
4. Pkt 5 decyzji („karta błędów pokazuje S09”) przestaje obowiązywać: S09
   kończy się tym samym stopem co brak sieci, bez karty.
5. WE03 w `protokol.js` nie obiecuje już trybu uproszczonego — wskazuje
   istniejące wyjścia (ponowienie sieci, zmiana okolicy lub trybu).
6. Wersja `?v=` idzie do `m12-165`.
