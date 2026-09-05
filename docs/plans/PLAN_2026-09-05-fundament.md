# PLAN 2026-09-05 — Fundament projektu (M0)

> Roadmapa JEDNEGO zadania (AGENTS.md §2, ADR 0012). Odhaczanie etapów
> kolejnymi commitami; na końcu podsumowanie wykonania. Wzorzec: plan F0
> projektu AME.

## Cel

Położyć fundament, na którym kolejne sesje budują bez pytań „jak to ma działać":
zasady pracy, decyzje architektoniczne, protokół treści, konfigurację repo,
szkielet aplikacji i bramę jakości w testach.

## Etapy

- [x] E1 — konfiguracja i zasady: `package.json`, `.gitignore`, `README.md`,
      `AGENTS.md`, `docs/setup/ENVIRONMENT.md`, `docs/LESSONS.md` (L1–L6).
      Kryterium: pełny spis lektury startowej istnieje i jest spójny.
- [x] E2 — rejestr ADR (`docs/decisions/README.md`) + ADR 0001–0013.
      Kryterium: każda istotna decyzja z briefu właściciela ma ADR; rzeczy
      sporne mają status *Proponowana* i trafiają na listę pytań.
- [x] E3 — `docs/PROTOKOL.md` (PYT v1.0): pętla treści, szablon promptu,
      schemat paczki, kategorie wiekowe, kanon tematów, kody usterek.
      Kryterium: szablon jest dosłowny i odtwarzalny w kodzie.
- [x] E4 — dokumentacja projektu: `ARCHITECTURE`, `ROADMAP` (M0–M10),
      `BACKLOG` (B1–B15), `WORKFLOW`, `ASSETS` (z kwerendą polityk
      dostawców), `PROJECT_HISTORY`, `setup/ci-workflow.yml`.
      Kryterium: `ASSETS` zawiera datę sprawdzenia polityk i dostawców
      odrzuconych z uzasadnieniem.
- [ ] E5 — narzędzie i szkielet aplikacji:
      `tools/synchronizuj-szablon.mjs` (szablon promptu: dokument ↔ kod,
      `--check`), `app/konfig.js` (TRYBY, WIEK, TEMATY, DOMYSLNE,
      `walidujSetup`), `app/geo.js` (haversine, bearing, Mercator, pierścień,
      geohash, dopasowanie zoomu), `app/protokol.js` (`zbudujPrompt`,
      `walidujPaczke`), `app/app.js` + `index.html` + `app/styles.css`
      (ekran setupu, geolokalizacja, stacje w trybie uproszczonym, prompt,
      wklejenie i walidacja paczki).
      Kryterium: na 360 px da się przejść setup → prompt → wklejenie →
      walidacja; live preview Areny pokazuje aplikację.
- [ ] E6 — testy: `test/geo.test.js`, `test/konfig.test.js`,
      `test/protokol.test.js`, `test/kontrakt.test.js` (szablon dokument↔kod,
      cache-busting, brak `node:` w `app/`, brak ścieżek absolutnych,
      wersja protokołu w trzech miejscach).
      Kryterium: `npm test` i `npm run check` zielone.
- [ ] E7 — handoff: `docs/setup/HANDOFF_2026-09-05.md` + aktualizacja opisu
      PR #2 + blok przekazania w czacie.

## Ryzyka / pułapki

- polskie znaki w `edit_file` (L2) → nowe pliki `write_file`, poprawki
  `python3` + `pathlib` z `encoding='utf-8'`;
- egress zablokowany (L3) → żadnych zapytań Overpass/kafelków w testach;
  wszystko na fixture'ach i w przeglądarce;
- `git add -A` vs zakres komunikatu (L7) → `git status --short` przed commitem;
- polityki dostawców (L8) → `docs/ASSETS.md` z datą sprawdzenia;
- brak GPS w sandboxie → tryb testowy z ręcznymi współrzędnymi od pierwszego
  ekranu (ADR 0004 pkt 6), nie „dopiszemy później";
- szablon promptu w dwóch miejscach (dokument i kod) → narzędzie
  synchronizujące zamiast ręcznego trzymania kopii (E5).

## Poza zakresem M0 (świadomie)

Renderer mapy i kafelki (M2), Overpass i graf dróg (M4), szyfrowanie paczki
(M1/M5), rozgrywka i punktacja (M6/M7), publikacja Pages (M8). M0 ma dać
zasady i szkielet, nie gotową grę.

## Podsumowanie wykonania

(uzupełnić na końcu sesji: zakres, commity, liczba testów, rzeczy otwarte)
