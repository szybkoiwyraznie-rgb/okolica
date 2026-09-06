# Plan M10 — Dopracowanie terenowe (2026-09-06)

Kontekst: ostatni kodowy kamień roadmapy przed kierunkami M11/M12 (ADR 0018).
Zakres z ROADMAP: Service Worker (offline: kafelki ostatniej okolicy + paczka),
oszczędzanie baterii („budzenie przy zbliżaniu"), tryb nocny, dźwięk/wibracja
przy dojściu, dostępność (WCAG AA audyt), testy terenowe i progi (ADR 0004).
Uwaga stanowa: tryb nocny ISTNIEJE od M7 (`przycisk-motyw`, motyw ciemny
w `styles.css`, zapis `okolica:motyw`) — w M10 tylko weryfikacja w audycie T6.

## Kroki

- [ ] **T1 — plan**: ten plik.
- [ ] **T2 — Service Worker (offline)**: `sw.js` (classic script, zero
      zależności): precache skorupy (index, style, manifest, ikony), runtime
      cache-first dla GET same-origin (moduły) i dla kafelków dowolnego
      dostawcy (wzorzec `/z/x/y.png|jpg|webp`) z limitem i ewikcją
      najstarszych; POST-y i obce API (Overpass, Nominatim, most Drive) BEZ
      cache (świeżość + prywatność, ADR 0005/0013/0016). Rejestracja z
      `app.js` tylko po http(s), awaria cicha (dodatek, nie wymóg). Testy:
      harness `new Function('self','caches','fetch',…)` — install/activate/
      fetch/ewikcja/bez-POST; kontrakt: wersja SW == wersja `?v=` aplikacji.
- [ ] **T3 — bateria („budzenie przy zbliżaniu")**: profile watchera
      `PROFILE_GPS` (dokładny / oszczędny: `enableHighAccuracy:false`,
      `maximumAge:20 s`) + czysta funkcja `profilBaterii()` z histerezą
      (oszczędny >250 m, powrót do dokładnego <150 m); `app.js` restartuje
      watcher przy zmianie profilu w fazie odcinka, ze jawnym statusem
      (LESSONS L6). Bez dystansu (brak fixa) profil nie drga.
- [ ] **T4 — dźwięk i wibracja przy dojściu**: moduł `app/sygnaly.js`
      (czysty): plany sygnałów (dotarcie, start odcinka, odpowiedź dobra/zła)
      jako wzorce wibracji + nuty; odtwarzanie w `app.js` przez Web Audio
      (oscylator — zero plików dźwiękowych, zero zależności) i
      `navigator.vibrate`; przełącznik „🔔 sygnały" w nagłówku (aria-pressed,
      zapis `okolica:sygnaly`, domyślnie WŁĄCZONE); brak API (desktop/Node) =
      cichy no-op, gra nigdy się nie psuje. Sygnały w punktach: dojście
      (GPS i ręczne), start odcinka, ocena odpowiedzi.
- [ ] **T5 — tryb nocny**: ISTNIEJE (M7) — brak nowego kodu; weryfikacja
      w audycie T6 (kontrasty motywu ciemnego).
- [ ] **T6 — audyt WCAG AA**: narzędzie `tools/audyt-kontrastu.mjs` czyta
      tokeny palety ze `styles.css` (jasny + ciemny), liczy kontrasty WCAG
      dla par rola→tło i WYCHODZI BŁĘDEM poniżej 4.5:1 (duży tekst 3:1) —
      wpięte w bramę; poprawki tokenów/`focus-visible` według wyniku; notatka
      audytowa (aria-live, cele dotykowe, kolejność fokusu) w ARCHITECTURE.
- [ ] **T7 — checklisty terenowe**: `WORKFLOW.md` §4 — scenariusz testu M10
      (pełna gra w terenie: offline po zaniku sieci, bateria na długim
      odcinku, sygnały w słońcu/hałasie, motywy, progi dojścia ADR 0004);
      wynik testu właściciela → LESSONS (wzorzec M4/M6).
- [ ] **T8 — dokumentacja i publikacja**: ARCHITECTURE (SW, sygnały, bateria,
      audyt), README (offline), ROADMAP (M10 ✅ po kryteriach), ASSETS (brak
      nowych dostawców — Web Audio lokalne), PROJECT_HISTORY, LESSONS jeśli
      wyjdą pułapki, cache-busting `?v=m10-1` WE WSZYSTKICH plikach +
      `WERSJA_SW`, opis PR #2.

## Kryterium M10

`npm run brama` zielone z nowymi testami (SW harness, bateria, sygnały,
kontrasty) + kontrakt wersji SW; checklisty terenowe gotowe dla właściciela;
aplikacja otwiera się i gra z lokalnej paczki bez sieci (skorupa + kafelki
z cache), a pierwsza sesja online cache'uje okolicę na później.

## Ryzyka

- **Module vs classic SW**: classic script = zero ryzyka wsparcia; logika SW
  testowana harnessem `new Function`, nie na żywym Chrome (pole → T7).
- **Ewikcja cache'y**: przeglądarka może wyczyścić cache'e pod presją dysku —
  offline to best-effort, komunikaty aplikacji muszą pozostać jawne.
- **Web Audio bez gestu**: AudioContext tworzymy leniwie; pierwszy sygnał
  (start odcinka) i tak następuje po kliknięciu — autopolityka przeglądarek
  spełniona.
- **Restart watchera przy zmianie profilu**: chwilowa przerwa w fixach —
  bufor trafień (`STAN.historiaFixow`) zostaje, kryterium dwóch kolejnych
  trafień (ADR 0004 pkt 2) nadal obowiązuje.
