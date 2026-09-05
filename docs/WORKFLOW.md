# WORKFLOW — procedura sesji i procedura gry

Dwa rozdziały: **praca agenta** (§1–§2, §5–§6) i **praca organizatora gry**
(§3–§4). Powiązania: `AGENTS.md` (zasady), `docs/setup/ENVIRONMENT.md`
(środowisko), `docs/PROTOKOL.md` (treść pytań).

## 1. Start sesji agenta

1. `git rev-parse --abbrev-ref HEAD`, `git log --oneline -3`, `git status`.
2. Lektura obowiązkowa wg `AGENTS.md` §0 — całe pliki, do ostatniej linii.
3. `npm test` — potwierdź zieloność PRZED zmianami (brama sesji).
4. `git push -u origin <gałąź-sesji>` i `gh pr create --base main` — **PR
   istnieje przed kodowaniem** (ADR 0012 pkt 1).
5. Audyt poprzedniego scalonego PR:
   `git fetch origin main --depth=50` → `git diff <sha>^..<sha>` plik po pliku;
   wynik do opisu PR i `docs/PROJECT_HISTORY.md` (stan, nie lista plików).
6. Brak zlecenia właściciela → najwyższy otwarty kamień milowy
   z `docs/ROADMAP.md` i jego plan z `docs/plans/`.

## 2. Pętla pracy i koniec sesji

Każdy krok: **zmiana → `npm test` → weryfikacja na żywo (jeśli UI) → commit
przez `git commit -F` → push**. Testy uruchamiaj bez potoku (LESSONS L5).
Commit tylko na gałęzi z otwartym PR; nigdy `--force`; nigdy push do `main`;
nigdy samodzielne scalenie PR.

Koniec sesji:
1. `npm test` zielone, `git status` czysty, wszystko wypchnięte.
2. `docs/setup/HANDOFF_<data>.md` (stan, decyzje, co dalej, rzeczy otwarte).
3. Wpis w `docs/PROJECT_HISTORY.md`, aktualizacja `docs/ROADMAP.md`.
4. Reguły trwałe → ADR / PROTOKÓŁ / `AGENTS.md` / `LESSONS.md` / `ASSETS.md`
   (tabela w `AGENTS.md` §5), nie do handoffu.
5. Opis PR kumulatywnie + blok przekazania w czacie.

## 3. Przygotowanie gry (organizator, na telefonie)

1. Otwórz aplikację → ekran **Setup**: liczba graczy i imiona, tryb ruchu
   (piesza 1 km / rower 3 km / samochód 10 km — promień edytowalny), liczba
   stacji, tematy, kategoria wiekowa, język, `kod gry` (do ukrycia pytań),
   kara za ręczne zgłoszenie dojścia.
2. **Zgódź się na geolokalizację** i poczekaj na fix z akceptowalną dokładnością
   (badge „±X m"; przy > 100 m przejdź w miejsce z lepszym widokiem nieba).
3. „Ustaw stacje" → aplikacja pobiera sieć drogową okolicy (Overpass) i rysuje
   stacje; możesz je przesunąć ręcznie, jeśli któraś jest źle.
4. „Przygotuj pytania" → aplikacja pokazuje prompt → **kopiuj** → wklej do
   modelu AI z włączoną kwerendą internetową (Meta AI, ChatGPT, Gemini…).
5. Skopiuj odpowiedź modelu (blok JSON) → wróć do aplikacji → wklej →
   „Sprawdź i zaszyfruj". Usterki: lista kodów E01–E20 i gotowa poprawka do
   wklejenia modelowi.
6. Podgląd „tylko dla organizatora" (opcjonalnie): popraw treść ręcznie,
   zapisz zmianę w `modyfikacje[]`.
7. **Eksportuj paczkę** (`.paczka.json`) — zabezpieczenie na wypadek czyszczenia
   danych przeglądarki (ADR 0010 pkt 3).

## 4. Test terenowy (obowiązkowy dla M3, M4, M6, M7)

Agent nie ma GPS ani terenu (ENVIRONMENT §4.1, §5) — część kryteriów da się
sprawdzić tylko na zewnątrz. Procedura dla właściciela:

1. Tryb testowy w domu (`?tryb=test`): ustaw współrzędne swojej okolicy,
   wgraj fixture trasy albo klikaj „symuluj fix" — sprawdź logikę bez GPS.
2. W terenie: `npm run serwer` nie jest dostępny, więc graj na Pages albo przez
   live preview Areny (HTTPS). Zabierz powerbank.
3. Zmierz i zapisz: dokładność GPS przy starcie i przy stacjach, czas od
   podejścia < próg do zapalenia stacji, liczbę fałszywych dojść, ile metrów
   „zapasu" miał próg, zachowanie pinch/zoom w rękawiczce, czytelność w słońcu.
4. Wynik → `docs/LESSONS.md` jako nowa lekcja (objaw → przyczyna → reguła) oraz
   korekta progów w `app/pozycja.js` (ADR 0004) i w ADR, jeśli zmienia to zasadę.

## 5. Publikacja na GitHub Pages (jednorazowo, właściciel)

Settings → Pages → **Source: Deploy from a branch** → Branch: `main`,
katalog `/ (root)` → Save. Adres: `https://szywkoiwyraznie-rgb.github.io/okolica/`.
Agent nie ma uprawnień do ustawień repo i nie prosi o to w środku sesji —
stan publikacji opisuje w handoffie jako fakt. CI: receptura w
`docs/setup/ci-workflow.yml` do wklejenia w `.github/workflows/ci.yml`
(LESSONS L4: agent nie zapisze tego pliku).

## 6. Dodawanie rzeczy powtarzalnych

| Co dodajesz | Gdzie | Co jeszcze trzeba zrobić |
| --- | --- | --- |
| Nowy temat pytań | `app/konfig.js` → `TEMATY` + `docs/PROTOKOL.md` §5 | test kanonu, ten sam commit |
| Nowa kategoria wiekowa | `app/konfig.js` → `WIEK` + protokół §4 | opis trudności do promptu, test |
| Nowy dostawca kafelków/danych | `app/mapa.js` albo `app/sieci.js` | wpis w `docs/ASSETS.md` (polityka, atrybucja, limity) + ADR |
| Nowa decyzja architektoniczna | `docs/decisions/NNNN-*.md` | aktualizacja rejestru w `README.md` ADR-ów, ten sam commit |
| Nowa lekcja | `docs/LESSONS.md` | numeracja na końcu, format objaw→przyczyna→reguła |
| Nowy pomysł | `docs/BACKLOG.md` | nie bierz go do pracy bez zlecenia albo kamienia milowego |
| Paczka referencyjna | `data/przyklady/paczka-*.json` | weryfikacja każdego URL przez `fetch_page` (ADR 0008 pkt 6) |
