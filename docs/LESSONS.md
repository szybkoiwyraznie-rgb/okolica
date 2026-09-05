# LESSONS — rejestr lekcji

Format: `## LN (data, pochodzenie) — tytuł`, objaw → przyczyna → reguła.
Czytasz CAŁY rejestr na start sesji (`AGENTS.md` §0). Nowe lekcje dopisuj na
końcu — nigdy nie zmieniaj numeracji istniejących.

Lekcje L1–L5 są **dziedziczone z projektu AME** właściciela (zmierzone w tamtym
sandboxie w 2026-08/09); przeniesiono je tu na starcie, bo dotyczą tego samego
środowiska, a koszt ich ponownego odkrycia jest realny. Lekcje od L6 wzwyż są
obserwacjami z tego projektu.

## L1 (2026-09-05, dziedziczone z AME) — sandbox resetuje workspace w trakcie sesji

**Objaw:** commity sesji „znikają", HEAD wskazuje `main`, push odrzucony.
**Przyczyna:** środowisko odtwarza workspace ze świeżego klona.
**Reguła:** praca istnieje dopiero po `git push`; po resecie postępuj wg
`docs/setup/ENVIRONMENT.md` §2 (fetch gałęzi sesji + `reset --hard FETCH_HEAD`
+ `push -u`).

## L2 (2026-09-05, dziedziczone z AME) — edycja plików z polskimi znakami

**Objaw:** po edycji w pliku pojawia się mojibake (`Ä…` zamiast `ą`) albo obce
glify w środku polskiego zdania.
**Przyczyna:** narzędzie `edit_file` potrafi uszkodzić UTF-8.
**Reguła:** nowe pliki twórz `write_file`; istniejące pliki z polskim tekstem
edytuj przez `python3` + `pathlib` z `encoding='utf-8'`; po edycji sprawdzaj
`git diff` i grepem `grep -n '[^\x00-\x7FĄ-ż]'` na podejrzanym fragmencie.

## L3 (2026-09-05, dziedziczone z AME) — egress HTTPS zablokowany, npm działa

**Objaw:** `curl https://…` do dowolnego hosta → kod 000/SSL_ERROR.
**Przyczyna:** sandbox przepuszcza tylko wybrane hosty (`api.github.com`,
`registry.npmjs.org`).
**Reguła:** danych z sieci nie pobieraj curl/fetch w sandboxie — użyj narzędzi
agenta (`fetch_page`, `web_search`). Overpass, kafelki i Nominatim testuj
**w przeglądarce** (live preview) albo na fixture'ach w `test/fixtures/`, nigdy
w `npm test`.

## L4 (2026-09-05, dziedziczone z AME) — agent nie zapisze pliku CI

**Objaw:** push gałęzi zawierającej `.github/workflows/ci.yml` → 403
`workflows`; `gh api` na tym zasobie też 403.
**Przyczyna:** token GitHub App używany w Arenie nie ma uprawnienia
`workflows`.
**Reguła:** recepturę CI trzymaj jako lustro w `docs/setup/ci-workflow.yml`
i pilnuj testem kontraktowym, że nie rozjeżdża się z tym, co właściciel wklei.
Brak zielonego CI opisuj jako **znany fakt**, nie jako zadanie dla właściciela
i nie jako bloker sesji.

## L5 (2026-09-05, dziedziczone z AME) — `npm test | grep` w łańcuchu maskuje czerwony test

**Objaw:** `npm test | grep -c fail && echo OK` drukuje `OK` przy czerwonych
testach.
**Przyczyna:** kod wyjścia potoku to kod `grep`, nie `npm test`.
**Reguła:** w łańcuchu warunkowym uruchamiaj testy BEZ potoku
(`npm test > /tmp/t.log 2>&1 && …`), a log oglądaj osobnym poleceniem; albo
najpierw samo `npm test` (patrzysz na exit code), dopiero potem reszta.

## L6 (2026-09-05, dziedziczone z AME) — API Node w kodzie przeglądarki: pusta warstwa, testy zielone

**Objaw:** moduł w `app/` importuje `node:crypto` / `node:fs`; testy w Node
przechodzą, a w przeglądarce warstwa jest martwa (biały ekran albo cichy
`undefined`).
**Przyczyna:** `node --test` uruchamia kod w Node, gdzie te API istnieją.
**Reguła:** w `app/` wolno używać wyłącznie API przeglądarki i standardu
(`globalThis.crypto.subtle`, `fetch`, `localStorage`, `navigator.geolocation`).
Test kontraktowy `test/kontrakt.test.js` grep`uje `app/**.js` pod kątem
`node:` i `require(`. Szyfrowanie dlatego jedzie na Web Crypto, nie na
`node:crypto` (ADR 0007).

## L7 (2026-09-05, Tajemnicza Okolica) — `git add -A` commituje więcej, niż opisuje komunikat

**Objaw:** commit „M0/E1: konfiguracja repo i zasady pracy agentów" (`3e61917`)
zawiera też cały rejestr ADR (etap E2) — komunikat nie opisuje zakresu zmiany,
a audyt następnej sesji musi to odkręcać z `git show --stat`.
**Przyczyna:** `git add -A` chwyta wszystko, co leży w drzewie, niezależnie od
tego, jaki etap sesji opisuje komunikat pisany chwilę wcześniej.
**Reguła:** przed każdym commitem `git status --short` i porównanie listy
plików z zakresem w komunikacie; albo `git add <ścieżki>` jawnie per etap.
Jeśli rozjazd już się wypchnął — **nie poprawiaj historii** (zakaz force push,
ADR 0012): opisz fakt w handoffie i w opisie PR.

## L8 (2026-09-05, Tajemnicza Okolica) — polityki darmowych dostawców map zmieniają się pod projektem

**Objaw:** CARTO basemaps (Voyager/Positron), przez lata standard „darmowe
kafelki bez klucza", w 2026 wymaga klucza API, bez klucza dokleja znak wodny
„API key required", a rastery są rozważane do wygaszenia. Darmowe serwisy bez
klucza (OpenFreeMap, VersaTiles, Maptoolkit) okazały się **wektorowe**, czyli
wymagają MapLibre — zależności zakazanej przez ADR 0001.
**Przyczyna:** wybór dostawcy zapisany „z pamięci" albo z przyzwyczajenia, bez
kwerendy stanu na dziś; dodatkowo mylenie „darmowe" z „bez klucza" i „rastrowe"
z „wektorowe".
**Reguła:** dostawcę kafelków/danych wybiera się **po kwerendzie w dniu decyzji**
(`web_search` + `fetch_page`), a wynik z datą sprawdzenia trafia do
`docs/ASSETS.md` (§5 checklista). Przy zmianie dostawcy sprawdź trzy rzeczy:
czy wymaga klucza, czy serwuje rastry czy wektory, i co mówi jego polityka
o użyciu w aplikacjach. ADR-y ze statusem *Proponowana* poprawia się przed
akceptacją — po akceptacji tylko nowy ADR zastępujący.
