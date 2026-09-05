# PROJECT_HISTORY — dziennik sesji

> Zapis tego, co przyniosła sesja (fakty, nie plany). Jeden wpis na sesję,
> najnowszy na dole. Nie jest lekturą startową (`AGENTS.md` §0) — czytasz
> punktowo, grepem. Stan bieżący: `docs/ROADMAP.md` i najnowszy
> `docs/setup/HANDOFF_*.md`.

## 2026-09-05 — sesja M0 (fundament), gałąź `arena/01a07282-okolica`, PR #2

**Zlecenie właściciela:** nowy projekt „Tajemnicza Okolica" — terenowa gra
quizowa na mapie (geolokalizacja, stacje, pytania generowane przez model AI
i wklejane z powrotem, szyfrowanie odpowiedzi, mobilny UI), prowadzony wg
dobrych praktyk projektu AME (wzorzec: `AME-main.zip`).

**Audyt stanu zastanego:** `main` = `3ca4c3d` („Add files via upload"):
jednozdaniowy `README.md` + `AME-main.zip` (308 plików, ~20 MB po rozpakowaniu).
Kodu, testów, CI ani dokumentacji brak — start od zera, regresji do sprawdzenia
brak. Z archiwum wzorca wczytano: `AGENTS.md` (286 linii), `docs/setup/ENVIRONMENT.md`,
`docs/WORKFLOW.md`, `docs/decisions/README.md` (27 ADR-ów), `docs/LESSONS.md`
(24 lekcje), `docs/ARCHITECTURE.md`, `README.md`, `index.html`,
`.github/workflows/ci.yml`, mechanizm kafelków z `app/map.js`
(`PODKLADY_ONLINE`, `rysujPodkladOnline`).

**Co zrobiono:**

- Struktura i konfiguracja: `package.json` (zero zależności, `node --test`),
  `.gitignore` (narzędzia sesji poza repo, eksporty paczek), `README.md`.
- Zasady: `AGENTS.md` (§0 lektura startowa, §1 źródło prawdy, §2 cztery reguły
  sesji, §3 zasady treści PYT, §4 granice, §5 tabela „gdzie zapisać regułę"),
  `docs/setup/ENVIRONMENT.md` (sandbox, git, sieć, headless Chromium, live
  preview), `docs/LESSONS.md` L1–L6.
- Rejestr ADR + ADR 0001–0013 (7 zaakceptowanych, 6 proponowanych).
- `docs/PROTOKOL.md` — protokół PYT v1.0: pętla treści, dosłowny szablon
  promptu, schemat paczki, kategorie wiekowe (7/10/12/15/dorośli), kanon 10
  tematów, 20 kodów usterek walidacji (E01–E20), wersjonowanie.
- Dokumentacja projektu: `ARCHITECTURE`, `ROADMAP` (M0–M10), `BACKLOG` (B1–B15),
  `WORKFLOW`, `ASSETS`, `plans/PLAN_2026-09-05-fundament.md`,
  `setup/ci-workflow.yml`.
- Kwerenda polityk dostawców (`web_search`, 2026-09-05) — **wynik zmienił
  decyzję**: CARTO wymaga klucza API (odpada przy ADR 0001), OpenFreeMap /
  VersaTiles / Maptoolkit są wektorowe (wymagałyby MapLibre). Rewizja ADR 0003
  przed akceptacją, wpis w `ASSETS` §1.1, lekcja L8. Przyjęto: OSM Standard
  jako podkład domyślny (zgodnie z briefem), OpenTopoMap i Esri jako warstwy
  opcjonalne; Overpass (3 instancje z przełączaniem) jako źródło sieci drogowej
  **i** nazwy miejsca — Nominatim domyślnie wyłączony (ASSETS §3, LESSONS).
- Szkielet aplikacji (E5) i testy (E6) — patrz wpisy commitów i handoff.

**Fakty operacyjne do pamiętania:**

- Commit `3e61917` ma komunikat opisujący etap E1, a zawiera też E2 (rejestr
  ADR) — `git add -A` złapał więcej niż komunikat. Historia wypchnięta, więc
  bez poprawiania (zakaz force push); lekcja L7.
- Agent nie zapisuje `.github/workflows/` (403 `workflows`, LESSONS L4) —
  receptura CI leży w `docs/setup/ci-workflow.yml`.
- `AME-main.zip` pozostaje nietknięty w korzeniu; jego los (przeniesienie do
  `docs/archive/` albo usunięcie po przeniesieniu wzorców) jest pytaniem do
  właściciela, nie decyzją sesji.

**Do decyzji właściciela:** ADR-y proponowane 0002, 0003, 0005, 0007, 0009,
0010, 0013 (lista w opisie PR #2).
