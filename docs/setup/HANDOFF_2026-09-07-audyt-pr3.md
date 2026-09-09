# HANDOFF 2026-09-07 (sesja audytowa, PR #4) → następny agent

Gałąź: `arena/01a07c4f-okolica`, PR #4 (otwarty). Punkt wyjścia: `main` = `f06ee55`
(PR #3 scalony). Poprzednie handoffy tej daty opisują sesje M11/M12 i S1–S7.

## Stan: zielony

- Brama `npm run brama`: **518/518** (`node --test`) + `synchronizuj-szablon --check`
  + audyt WCAG AA **0 naruszeń**.
- Budżet lektury `npm run budzet`: **39964/40000** (rezerwa 36 tok — była 12).
- Cache-bust: `?v=m12-6` w 42 miejscach + `WERSJA_SW = 'm12-6'` (jedna wersja).
- Podgląd na żywo: `npm run serwer` (port 8000, `0.0.0.0`); stopka pokazuje
  „protokół PYT/1.0 · szablon PYT/1.0.5".

## Co przyniosła sesja

Zlecenie „kontynuujemy projekt" przy braku zaległości kodowych (M3–M8 i M10–M12
mają status „kod gotowy, czeka kryterium właściciela", a `BACKLOG` z własnego
nagłówka nie upoważnia do wzięcia tematu) → sesja wzięła obowiązkowy audyt
poprzedniego PR (`AGENTS.md` §2 pkt 2) i naprawiła to, co audyt wykazał.

| Commit | Zakres |
|---|---|
| `a9396af` | audyt PR #3 (`git diff d04a18a..f06ee55`, 74 pliki) → wpis w `PROJECT_HISTORY` |
| `69e6343` | `README.md` + `ASSETS.md` §7: koniec opisywania zgody `#zgoda-drive`, eksportu TO-zestaw/1 i przełącznika geokodacji (wszystkie usunięte z UI) |
| `77cf97d` | aneksy ADR 0006 (pkt 8 bez ścieżki w UI) i ADR 0016 (koniec checkboxa zgody) + `LESSONS` L31; płatne kondensacją ADR 0014, sekcji M3–M12 w `ROADMAP` i dopisku w `AGENTS` §0 |
| `57ec33d` | usunięta martwa `zastosujEdycjePaczki()` + `EDYTOWALNE_POLA` (+5 testów tej ścieżki), brak pinuje nowy kontrakt |
| `a251d14` | `SZABLON_WERSJA` dostaje konsumenta (stopka) — **commit wadliwy, patrz niżej** |
| `f1d8040` | dopięcie `?v=m12-6` w 12 pominiętych `app/*.js` (naprawa `a251d14`) |

**Pułapka sesji (L29 złamana i naprawiona w miejscu):** `git add` z jawną listą
plików pominął moduły `app/` podbite tym samym `sed`em, więc `a251d14` miał dwa
znaczniki wersji. Dowód: czysty checkout HEAD (`git worktree add --detach`) +
`node --test test/kontrakt.test.js` → `mapa.js: znacznik m12-5 różny od
index.html (m12-6)`. L29 doprecyzowana: `git add index.html app/ sw.js`, nigdy
lista z pamięci; `git status --short` przed commitem trzeba CZYTAĆ.

**Korekta własnego ustalenia z audytu:** pierwszy odczyt powiedział, że
`zastosujEdycjePaczki()` nie ma testów — miała pięć (grep urwany przez `head`).
Poprawione w `PROJECT_HISTORY` przed usunięciem funkcji.

## Co wisi u właściciela (kolejność ma znaczenie)

1. **Testy terenowe** M3–M7 i M10 (`docs/WORKFLOW.md` §4.2/§4.3) — bez nich
   kamienie nie zamykają się, choć kod jest gotowy.
2. **Test dwóch telefonów** M11/M12 (§4.4, 9 punktów) — most Drive jest
   wdrożony (`DOMYSLNY_URL_MOSTU` wypełniony), więc to jedyny brakujący krok.
3. **Włączenie GitHub Pages** (M8, §5) — jednorazowy krok w Settings; bez tego
   telefony nie zobaczą aplikacji pod `https://…github.io/okolica/`.
4. **B18** — limit 40k tokenów lektury vs rosnący rejestr ADR/LESSONS: rezerwa
   36 tok wystarczy na ~1 dopisek. Opcje (a/b/c) w `docs/BACKLOG.md` B18;
   wymaga decyzji właściciela albo nowego ADR.

## Uwagi dla następnej sesji

- Każdy dopisek do lektury startowej (§0) jest teraz płatny kondensacją
  w tym samym commicie — `node tools/budzet-lektury.mjs` po każdej zmianie.
- Po zmianie `app/*.js`/`styles.css`: podbicie `?v=` JEDNYM `sed`em po
  `index.html app/*.js` + `WERSJA_SW`, a `git add index.html app/ sw.js` (L29).
- Sekcje kamieni w `ROADMAP` są scalone w jedną „Kryteria otwartych kamieni"
  (wskaźniki w tabeli to `§Kryteria`, nie `§Mx`) — nie przywracaj starych kotwic.
- CI: `gh run list` (ostatni run na `main` zielony, `34134119244`).
