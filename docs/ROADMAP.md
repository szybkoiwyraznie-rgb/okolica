# ROADMAP — Tajemnicza Okolica

> Plan kamieni milowych; status aktualizowany na końcu każdej sesji.
> Szczegóły bieżącego zadania żyją w `docs/plans/PLAN_*.md`, pomysły poza
> planem w `docs/BACKLOG.md`. Brak zlecenia właściciela = najwyższy otwarty
> kamień milowy (AGENTS.md §2).

## M0 — Fundament (sesja 2026-09-05) — 🔄 W TRAKCIE

- [x] E1 — konfiguracja repo i zasady: `package.json`, `.gitignore`,
      `README.md`, `AGENTS.md`, `docs/setup/ENVIRONMENT.md`, `docs/LESSONS.md`.
- [x] E2 — rejestr ADR + ADR 0001–0013 (`docs/decisions/`).
- [x] E3 — `docs/PROTOKOL.md` (protokół PYT v1.0: szablon promptu, schemat
      paczki, kategorie wiekowe, kanon tematów, kody usterek E01–E20).
- [x] E4 — dokumentacja projektu: `ARCHITECTURE`, `ROADMAP`, `BACKLOG`,
      `WORKFLOW`, `ASSETS`, `PROJECT_HISTORY`, `plans/PLAN_2026-09-05-fundament.md`,
      `setup/ci-workflow.yml`.
- [ ] E5 — szkielet aplikacji: `index.html`, `app/geo.js`, `app/konfig.js`,
      `app/app.js`, `app/styles.css` — ekran konfiguracji + odczyt pozycji.
      Kryterium: live preview pokazuje setup na 360 px, `npm test` zielone.
- [ ] E6 — testy: `test/geo.test.js`, `test/konfig.test.js`,
      `test/protokol.test.js`, `test/kontrakt.test.js`.
- [ ] E7 — handoff sesji (`docs/setup/HANDOFF_2026-09-05.md`).

## M1 — Geodezja i model rozgrywki (czyste funkcje)

`app/geo.js` (haversine, bearing, Mercator, pierścienie, dopasowanie zoomu),
`app/pozycja.js` (kryterium dojścia, filtr dokładności), `app/rozgrywka.js`
(kolejki graczy, odcinki, czasy, punktacja), `app/krypto.js` (PBKDF2 + AES-GCM,
kontener `TO-paczka/1`), `app/protokol.js` (`zbudujPrompt`, `walidujPaczke`).
Kryterium: wszystko przetestowane w Node bez DOM i bez sieci; round-trip
szyfrowania na Node i w przeglądarce.

## M2 — Mapa

Renderer SVG (Web Mercator, pan/zoom/pinch/przyciski), warstwa kafelków
(CARTO/OSM/OpenTopoMap/Esri, przełącznik + atrybucja), marker pozycji z kołem
dokładności, okrąg promienia gry, numerowane pinezki stacji.
Kryterium: mapa działa na 360 px, palec (drag + pinch), podkład widoczny
w live preview, atrybucja zawsze obecna.

## M3 — Ekran konfiguracji i geolokalizacja na żywo

Setup (liczba graczy i imiona, tryb ruchu, promień, liczba stacji, tematy,
wiek, język, kod gry, kara za tryb ręczny, współpraca), walidacja, zapis
`okolica:konfig`, `watchPosition` + badge dokładności, tryb testowy
(`?tryb=test`, ręczne współrzędne i symulacja trasy), ekran „dane i prywatność".
Kryterium: pełna konfiguracja na telefonie bez przewijania; pozycja aktualizuje
się na żywo; tryb testowy pozwala rozegrać grę bez GPS.

## M4 — Stacje z sieci drogowej (największe ryzyko)

Overpass: budowa zapytania, graf, Dijkstra, kandydaci, filtry dostępności,
wybór stacji (pierścienie + separacja + pass wyrównujący), cache geohash,
degradacja bez Overpass i ręczne ustawianie stacji.
Kryterium: na trzech fixture'ach (centrum / przedmieście / las) żadna stacja
w budynku ani na terenie prywatnym; odchylenie standardowe dystansów ≤ 15%
średniej; sprawdzone **w terenie** na co najmniej jednej okolicy.

## M5 — Pętla pytań (prompt → model → walidacja → paczka)

Ekran promptu (kopiowanie, import/eksport pliku, instrukcja obrazkowa),
walidacja z kodami E01–E20 i przyciskiem „skopiuj poprawkę do modelu",
szyfrowanie paczki, podgląd „tylko dla organizatora" z ręczną edycją i zapisem
`modyfikacje[]`, odwrotna geokodacja nazwy miejsca (wyłączalna).
Kryterium: pełna pętla przechodzi z prawdziwym modelem (test właściciela),
a odrzucona paczka daje czytelną listę usterek.

## M6 — Rozgrywka

Pętla stacji: ekran „kto idzie" → start odcinka → mapa z dystansem → dojście
(albo tryb ręczny z karą) → pytanie z odszyfrowaniem w chwili dojścia →
odpowiedź → wyjaśnienie + źródła → następna stacja. Pauza/wznowienie, koniec
gry, przerwanie i zapis stanu.
Kryterium: gra przechodzalna od setupu do wyniku na telefonie, z utratą
zasięgu w trakcie (cache) i z zamknięciem przeglądarki (wznowienie).

## M7 — Podsumowanie, punkty i udostępnianie

Wyniki per gracz (punkty, czasy, poprawne odpowiedzi), medal/punkty za
sprawiedliwość trasy, eksport wyniku (tekst/obraz), historia gier
(`okolica:historia`).
Kryterium: podsumowanie czytelne w słońcu na 360 px; eksport działa na Chrome
Android i Safari iOS.

## M8 — Publikacja i brama jakości

`.nojekyll`, `assets/manifest.json` + ikony, instrukcja włączenia Pages
(`docs/WORKFLOW.md` §5), lustro CI w `docs/setup/ci-workflow.yml`, testy
kontraktowe wersji i ścieżek względnych, audyt polityk dostawców
(`docs/ASSETS.md`).
Kryterium: aplikacja działa pod `https://<user>.github.io/okolica/` na telefonie.

## M9 — Repozytorium paczek pytań

Eksport/import paczek per okolica, indeks geohash-5, prywatne repo paczek
właściciela, publikacja wybranych paczek po przeglądzie źródeł (ADR 0008 pkt 6,
ADR 0010 pkt 4) — **wymaga nowego ADR przed wdrożeniem** (prywatność geohashu,
licencja treści, moderacja).
Kryterium: druga gra w tej samej okolicy nie woła modelu.

## M10 — Dopracowanie terenowe

Service Worker (offline: kafelki ostatniej okolicy + paczka), strategia
oszczędzania baterii („budzenie przy zbliżaniu"), tryb nocny, dźwięk/wibracja
przy dojściu, dostępność (WCAG AA audyt), testy w terenie i poprawki progów
(ADR 0004) — wyniki w `docs/LESSONS.md`.

## Zasady prowadzenia roadmapy

- Kamień milowy jest **ukończony** dopiero, gdy: `npm test` zielone, zmiana
  sprawdzona na żywo (360 px), dokumentacja zaktualizowana (`ARCHITECTURE`,
  `README`, ADR-y, `ASSETS`), wpis w `PROJECT_HISTORY.md` i handoff.
- Kamienie M4 i M6 mają kryteria **terenowe** — agent przygotowuje instrukcję
  testu (`docs/WORKFLOW.md` §4), a wynik testu właściciela trafia do LESSONS.
- Zmiana kolejności kamieni = decyzja właściciela albo ADR; agent nie przesuwa
  kamieni „bo tak wygodniej".
