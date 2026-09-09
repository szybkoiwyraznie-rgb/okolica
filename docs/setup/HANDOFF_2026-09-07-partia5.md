# HANDOFF 2026-09-07 (partia 5) — ekran 1: lista graczy = tożsamość + wynik hot-seat na Drive

> Stan na koniec sesji. Dokument jednorazowy (`AGENTS.md` §5): reguły trwałe są
> w ADR-ach, protokole, `LESSONS.md` i `ASSETS.md` — tutaj tylko co zrobione,
> jak to uruchomić, co dalej i co wisi.

## 1. Co ta sesja zrobiła

| Krok | Zakres | Commit |
|---|---|---|
| 8a | Ekran 1: pole „Liczba graczy" i `#lista-imion` zniknęły; jeden blok „👤 Kto gra?" (imię + PIN + „➕ Dodaj gracza" + lista z „✕ Usuń" + przyciski zapamiętanych); `liczbaGraczy` pochodna, `pytaniaNaStacje` idzie za liczbą graczy | (commit 1) |
| 8b | `okolica:profil` → `okolica:gracze` (`gracze-lokalni/1`); auto-powrót potwierdzonych graczy bez PIN-u; trwałe usuwanie (`przywrocGraczy({ zListy })`); K08 mówi, gdzie dodać gracza | (commit 1) |
| 8c | L32: licznik pokoleń `POKOLENIE_PROPOZYCJI` — nakładające się odświeżenia nie dublują paczek z repozytorium | (commit 1) |
| 8d | B22: wynik gry hot-seat na Drive — `graHotseatDoWysylki`/`zdarzeniaHotseatu` w `app/wieloosobowa.js`, akcja `gra-hotseat` w moście, zgoda `#hotseat-zgoda`, kolejka offline, odcisk gry, linia `#wynik-drive` | (commit 2) |
| 8e | Dokumenty: PROTOKOL §9.5, aneks ADR 0026, BACKLOG B22 ✅, LESSONS L32, PROJECT_HISTORY, instrukcja wdrożenia, kontrakt, cache-bust `?v=m12-14` | (ten commit) |

**Trzy decyzje właściciela z ankiety (wiążące, zapisane w aneksie ADR 0026):**
(1) PIN sprawdzany od razu przy „➕ Dodaj gracza", pole „Liczba graczy" znika —
„tyle ilu się doda, tylu będzie"; (2) lista zapamiętana na telefonie, bez
ponownego pytania o PIN; (3) wynik hot-seat na Drive — **zrób teraz**.

**Brama na koniec partii:** `npm run brama` = **567 testów, 0 fail** + sync
szablonu OK + WCAG AA 0 naruszeń. Cache-bust `?v=m12-14` (+ `WERSJA_SW`).

## 2. CO WISI — wklejenie skryptu mostu (bez tego B22 nie działa)

`docs/setup/apps-script-repo-paczek.gs` — **963 linie**, md5
`01e1d9bdfa071d2634dc33d87607420f`. Zmiany: akcja `gra-hotseat`
(`bledyGryHotseat` + `przyjmijGreHotseat` + `nazwaPlikuHotseat`) i premia
hot-seat = 0. Kroki w `docs/setup/most-drive-instrukcja.md` → „Awaryjnie":
wklej treść → Wdróż → Nowa wersja (`setup` nie jest potrzebny, katalogi już
istnieją). Test po wklejeniu: zagraj grę na jednym telefonie z dodanym graczem
i zgodą „Zapisz wynik gry na wspólnym Drive" → pod wynikiem „☁ Wynik jest na
wspólnym Drive", na Drive przybywa `gra-hotseat-….json`, rankingi pokazują
punkty tych pseudonimów.

Do czasu wklejenia: gra działa normalnie, a wysyłka kończy się komunikatem
„Drive nie odpowiedział — wynik czeka w kolejce" i jedzie po wklejeniu przy
następnym uruchomieniu (kolejka mieści 5 gier).

## 3. Jak to uruchomić

```bash
npm test          # 567 testów (node --test, zero zależności)
npm run brama     # testy + sync szablonu + audyt WCAG AA
npm run serwer    # podgląd na 0.0.0.0:8000 (sprawdź na 360 px)
```

Ekran 1 po starcie: jeśli ten telefon pamięta potwierdzonych graczy, są już na
liście (bez klikania) — można od razu „Dalej". Nowy gracz: imię + PIN →
„➕ Dodaj gracza" (jedno wołanie `profil-ustaw`: wolne imię zakłada profil,
zajęte wymaga PIN-u, zły PIN = R20 i gracz nie wchodzi na listę).

## 4. Co dalej (propozycje, decyzja należy do właściciela)

- **B21 (otwarty):** budżet promptu i limit wklejenia dla `stacje × gracze`
  pytań (5 × 8 = 40). Teraz `pytaniaNaStacje` idzie za liczbą graczy
  (`min(gracze, 8)`), więc 8 graczy = 8 pytań na stację — temat jest bliżej
  niż był.
- Rankingi: filtr „tylko moje gry" po pseudonimach z listy graczy (dane już są
  w `okolica:gracze`, UI brak).
- Ekran 1 na 360 px: blok „Kto gra?" przy 8 graczach robi się długi — warto
  sprawdzić w terenie, czy lista nie wymaga przewijania (WORKFLOW §4.2).

## 5. Ryzyka i pułapki, które zostały

- PIN leży jawnym tekstem na Drive (ADR 0021) — to zabezpieczenie przed
  pomyłką w grze towarzyskiej, nie kryptografia.
- `oczyscKonfiguracje` w `app/konfig.js` nadal domyślnie dopełnia `imiona`
  („Gracz N") — bootstrap celowo zeruje listę zaraz po wczytaniu konfiguracji,
  bo domyślne imiona nie przeszły przez most i nie mogą udawać tożsamości.
- Wysyłka hot-seat jest **po** zapisie historii gry; jeśli właściciel odznaczy
  zgodę w trakcie gry, wynik zostaje na telefonie (bez komunikatu o wysyłce).
