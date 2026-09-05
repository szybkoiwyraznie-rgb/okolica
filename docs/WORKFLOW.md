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

### 4.1 Weryfikacja mapy w live preview (M2 — robi właściciel)

Kafelków i przeglądarki w sandboxie agenta nie ma (ENVIRONMENT §4.1, LESSONS
L3), więc kryterium „podkład widoczny" sprawdza właściciel. Agent uruchamia
serwer (`npm run serwer`, port 8000/8080, `--bind 0.0.0.0`), a preview Areny
jest widoczne jako karta obok rozmowy.

1. Otwórz preview i dodaj `?tryb=test` — tryb testowy odsłania ręczne
   współrzędne, więc nie potrzebujesz GPS.
2. Ustaw współrzędne swojej okolicy (np. `52.2297`, `21.0122`) → „Ustaw tę
   pozycję". Sprawdź: **kafelki się ładują**, niebieski marker stoi w środku,
   jasne koło dokładności ma rozsądny rozmiar, przerywany okrąg to promień gry.
3. Palec (albo mysz): przeciągnij mapę — treść jedzie z palcem, bez białych
   dziur na krawędzi; uszczypnij — zoom rośnie wokół środka palców; kółko myszy
   też działa. Przyciski ＋ − ◎ w prawym górnym rogu mają ≥ 44 px.
4. Pasek skali na dole po lewej pokazuje „50 m"/„200 m" i zmienia się z zoomem.
5. Atrybucja dostawcy jest **zawsze widoczna** na dole panelu. W setupie
   zmień „Podkład mapy" na OpenTopoMap i na Esri World Imagery — kafelki i
   podpis mają się zmienić; przy „Wyłączony (offline)" kafelków nie ma, ale
   marker, okrąg i pinezki zostają.
6. Wejdź na ekran stacji: pięć numerowanych pinezek w pierścieniu, a „Inny
   układ" przestawia je i przerysowuje mapę.
7. Obróć telefon (albo zmień rozmiar okna) — mapa ma się przeliczyć, nie zostać
   ucięta.
8. Wynik (co działa, co nie, zrzut albo opis) → wpis w `docs/PROJECT_HISTORY.md`
   i ewentualna lekcja w `docs/LESSONS.md`; dopiero wtedy kamień M2 jest
   ukończony (`ROADMAP`: „zmiana sprawdzona na żywo").

### 4.2 Weryfikacja M3 na telefonie (robi właściciel)

Kryterium M3 „pełna konfiguracja na telefonie bez przewijania" i zachowanie
symulacji na żywo sprawdza właściciel (agent nie ma przeglądarki, LESSONS L3):

1. **360 px:** otwórz aplikację na telefonie w pionie (albo w DevTools:
   360 × 640). Ekran setupu: oceń, czy cała konfiguracja mieści się **bez
   przewijania**; jeśli nie — ile trzeba przewinąć i które karty są poniżej
   fałdy. Wynik → decyzja: akceptujemy przewijanie (adnotacja w `ROADMAP`)
   albo składamy rzadkie pola w `<details>` (nowe zadanie agenta).
2. **Prywatność:** przycisk „Dane i prywatność" w setupie i w stopce otwiera
   ekran; „Wróć" prowadzi na ekran, z którego przyszliśmy (setup → setup,
   pozycja → pozycja). Przycisk kasowania: pierwszy klik **uzbraja** i mówi,
   co się stanie, drugi kasuje; komunikat w polu pod przyciskiem liczy
   usunięte klucze. Sprawdź w DevTools → Application → Local Storage, że
   zniknęły tylko `okolica:*`.
3. **Symulacja:** `?tryb=test` → ustaw współrzędne → „▶ Symuluj dojście
   (250 m)": badge i marker mapy jadą, pasek stanu odlicza fixy i metry, na
   końcu „cel osiągnięty — debounce dojścia spełniony". Drugi klik zatrzymuje
   strumień; **zejście karty w tło też** (po powrocie nic nie „dogania").
4. **GPS na żywo (przy oknie/na zewnątrz):** pozycja aktualizuje się, badge
   dokładności żyje, odmowa zgody pokazuje `P02` z podpowiedzią, zejście w tło
   pauzuje śledzenie i po powrocie wznawia z komunikatem.
5. Wynik (co działa, co nie, decyzja z pkt 1) → wpis w
   `docs/PROJECT_HISTORY.md` i ewentualna lekcja; dopiero wtedy `ROADMAP`
   dostaje ✅ przy M3.

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
