# 0041 — Każdy sygnał zdarzenia ma wibrację, jeśli urządzenie ją daje

- Status: Zaakceptowana (2026-09-13, uwaga M z testów terenowych właściciela)
- Data: 2026-09-13

## Kontekst

Właściciel (2026-09-13, uwaga M): „Sygnały dźwiękowe powinny, jeśli to możliwe
dawać także sygnał wibracyjny (chyba, że się tego nie da zrobić).”

Sygnały zdarzeń gry istnieją od M10/T4 i już wtedy były dwukanałowe: czysty
moduł `app/sygnaly.js` trzyma PLANY (`wibracjaMs` — wzorzec dla
`navigator.vibrate`, oraz `dzwiek` — nuty dla oscylatora Web Audio), a warstwa
DOM (`app/app.js` → `odegrajSygnal`) wykonuje plan oboma kanałami. Prośba
właściciela była więc w kodzie spełniona, ale nie była zapisana jako decyzja
i nie miała pina po stronie DOM: test modułu pilnował planów, a tego, że
`app.js` rzeczywiście woła `navigator.vibrate`, nie pilnował nikt. Przy kolejnych
sygnałach (odliczanie startu gry wieloosobowej) łatwo byłoby dodać „sam dźwięk”.

## Decyzja

1. **Każdy plan sygnału ma wzorzec wibracji i nuty.** W `SYGNALY` nie ma
   pozycji bez niepustej tablicy `wibracjaMs` i bez niepustej tablicy `dzwiek`
   (pilnuje `test/sygnaly.test.js`). Nowy sygnał wchodzi z oboma kanałami.
2. **Warstwa DOM wykonuje OBA kanały**: `odegrajSygnal()` woła
   `navigator.vibrate(plan.wibracjaMs)` i `odegrajDzwieki(plan.dzwiek)`. Pin
   w `test/kontrakt.test.js` („kontrakt ADR 0041”).
3. **Brak API jest cichym no-opem i nigdy nie przerywa gry** (LESSONS L6):
   iOS Safari nie ma `navigator.vibrate`, desktop zwykle też, a Android potrafi
   odmówić w trybie cichym. Oba kanały siedzą w `try/catch`; rozgrywka nie
   zależy od sygnału, więc „nie da się zrobić” z zastrzeżenia właściciela jest
   obsłużone dokładnie tym: nie wibrujemy i gramy dalej.
4. **Przełącznik „🔔 sygnały” wyłącza oba kanały naraz** (`okolica:sygnaly`,
   domyślnie włączone): `planSygnalu` zwraca wtedy `null`. Osobnego wyłącznika
   wibracji NIE MA i nie będzie — jeden prosty przełącznik.

## Konsekwencje

- Nowe sygnały — na przykład odliczanie startu gry wieloosobowej — wchodzą do
  `SYGNALY` z wzorcem wibracji; bez niego nie przejdą testu modułu.
- Na iOS gracz dostaje tylko dźwięk, a w hałasie ulicy na Androidzie zostaje
  wibracja w kieszeni — to dokładnie sytuacja z checklisty terenowej
  (`docs/WORKFLOW.md` §4.3 pkt 3).
- Koszt: bateria. Wzorzec `[120, 60, 120]` na dojściu do stacji to ułamek
  sekundy silniczka; przy grze bez pauzy (ADR 0040) sygnałów jest niewiele
  (dojście, start odcinka, ocena odpowiedzi, odliczanie startu), więc pomiar
  jest pomijalny wobec włączonego ekranu i dokładnego GPS-u.

## Wdrożenie

Kod istniał przed decyzją (`app/sygnaly.js`, `odegrajSygnal` w `app/app.js`) —
ten ADR domyka piny: `test/sygnaly.test.js` (plany) i nowy test „kontrakt
ADR 0041” w `test/kontrakt.test.js` (wołanie `navigator.vibrate`, oba kanały,
`try/catch`, przełącznik). Bez zmian w `app/` — więc bez podbicia `?v=`.

## Powiązania

ADR 0011 (mobile-first: czytelność i słyszalność w terenie), ADR 0040 (gra zawsze
włączona — sygnały są jedynym kanałem, który nie wymaga patrzenia w ekran),
LESSONS L6, README „Offline, bateria i sygnały (M10)”.
