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

## 4. Test terenowy (obowiązkowy dla M3, M4, M6, M7, M10)

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
2. Ustaw współrzędne swojej okolicy — wpisz dziesiętne (np. `52.2297`,
   `21.0122`), **wklej z Google Maps** (np. `52°07'22.9"N 20°44'46.1"E` albo
   `52.123028, 20.746139` — w pierwsze pole, drugie zostaw puste; stopnie-
   -minuty-sekundy to nie dziesiętne: 52°07'22.9" = 52.12303) albo w trybie
   testowym **stuknij mapę** → „Ustaw tę pozycję". Sprawdź: **kafelki się
   ładują**, niebieski marker stoi w środku,
   jasne koło dokładności ma rozsądny rozmiar, przerywany okrąg to promień gry.
3. Palec (albo mysz): przeciągnij mapę — treść jedzie z palcem, bez białych
   dziur na krawędzi; uszczypnij — zoom rośnie wokół środka palców; kółko myszy
   też działa. W trybie testowym krótkie **stuknięcie** mapy pozycji ustawia
   pozycję (status „z mapy", pola się wypełniają), a przeciągnięcie i pinch —
   NIE. Przyciski ＋ − ◎ w prawym górnym rogu mają ≥ 44 px.
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

### 4.3 Weryfikacja M10 na telefonie (robi właściciel)

Przygotowanie: aplikacja na Pages (HTTPS — bez tego ani Service Worker, ani
geolokalizacja) i PIERWSZA sesja online w okolicy planowanej gry — wtedy SW
zapisuje skorupę i kafelki „na później".

1. **Offline**: po pierwszej sesji włącz tryb samolotowy i otwórz aplikację
   ponownie — skorupa musi się otworzyć, mapa pokazać kafelki ostatniej
   okolicy, a gra z paczki „📱 z tego telefonu" działać bez sieci (zero
   Overpassa, zero modelu). Zanotuj, ile ulic „wystaje" poza zapamiętane
   kafelki przy zboczeniu z trasy.
2. **Bateria**: na odcinku >300 m wypatruj statusu „GPS w trybie oszczędnym…",
   przy stacji (<150 m) „GPS w trybie dokładnym…". Zapisz: czy przejścia nie
   oscylują na granicy (histereza 250/150 m w `app/pozycja.js`), ile % baterii
   zjadła godzina gry, czy dojście łapie się tak samo pewnie jak przed M10.
3. **Sygnały**: w hałasie ulicy — czy „dotarcie" (dwa tony w górę + wibracja)
   jest zauważalne bez patrzenia w ekran; w kieszeni — sama wibracja;
   przełącznik „🔔 sygnały" pamięta wybór po odświeżeniu i zamknięciu karty.
4. **Motywy i słońce**: w pełnym słońcu motyw jasny, po zmroku ciemny —
   czytelność statusu, pytań i pinów; kontrasty tokenów pilnuje brama
   (`npm run audyt`), więc tu tylko subiektywne „czy widać".
5. **Dostępność**: powiększenie 200% bez utraty treści i bez poziomego
   przewijania, kolejność fokusu w ekranie gry (pytanie → odpowiedzi →
   dalej), cele dotykowe ≥44 px w rękawiczce.
6. **Progi dojścia (ADR 0004)**: dokładność GPS przy starcie i przy stacjach,
   czas od wejścia w próg do zapalenia stacji, liczba fałszywych dojść.
7. Wynik → `docs/LESSONS.md` (objaw → przyczyna → reguła) i ewentualna
   korekta `PROG_BATERII_M` / planów sygnałów / progów dojścia.

### 4.4 Weryfikacja M11/M12 na dwóch telefonach (robi właściciel)

Warunek: most wdrożony według instrukcji z czatu (P8, ADR 0018) — ten sam web
app co repozytorium paczek. Drugi telefon: dowolny (Chrome), ta sama albo inna
sieć — gra jest asynchroniczna.

1. **Założenie**: telefon A: Ustawienia → Rodzaj gry „Gra na wielu
   urządzeniach" → pseudonim, zgoda zaznaczona, adres mostu zapisany →
   „🌐 Załóż grę" → tryb (najpierw wyścig), źródło paczki → „🚀 Zakładam".
   Zapisać 6-znakowy kod z lobby.
2. **Dołączenie kodem**: telefon B: pseudonim + adres mostu → „🔗 Dołącz" →
   kod → oba telefony widzą się na liście graczy w lobby (odświeżenie ≤10 s).
3. **Dołączenie z lobby**: druga gra założona na A powinna pojawić się na B
   pod „Dołącz" z miejscem, trybem i odległością — wejście kliknięciem, bez
   przepisywania kodu.
4. **Start i trasa (wyścig)**: A klika „▶ Start gry". Na obu: odcinek → dojście
   → pytanie → odpowiedź. Obserwować: tabela wyników drugiego gracza odświeża
   się (≤12 s); pasek synchronizacji pokazuje „kolejka" po zgubieniu sieci
   (np. między blokami) i zdarzenia wychodzą po powrocie.
5. **Tury**: druga gra w trybie „tury" — gracz nieaktywny widzi „Teraz idzie:
   X (jej/jego telefon)" i nie może wystartować odcinka (odmowa też z serwera,
   gdyby stan był stary); po zamknięciu stacji poprzednika pojawia się „Twoja
   tura!".
6. **Odświeżenie**: w trakcie gry przeładować stronę na B → baner „Telefon
   pamięta grę…" → „↩ Wróć do gry" → zamknięte stacje nie wracają, tury i
   wyniki są aktualne.
7. **Koniec i rankingi**: po ostatniej odpowiedzi oba telefony pokazują
   ostateczną tabelę; w nagłówku „🏆 rankingi" → ogólny / wiek / tematy /
   lokalizacja + „Moje gry" (wpisy z zakończonych gier).
8. **Obserwacje** → `docs/LESSONS.md`: dokładność GPS przy stacjach, opóźnienia
   żywej tabeli, odmowy mostu (jawne w statusie), zużycie baterii przy pollingu.

## 5. Publikacja na GitHub Pages (jednorazowo, właściciel)

Settings → Pages → **Source: Deploy from a branch** → Branch: `main`,
katalog `/ (root)` → Save. Adres: `https://szybkoiwyraznie-rgb.github.io/okolica/`.

Uwagi techniczne (M8, 2026-09-06):

- Repozytorium MA `.nojekyll` — Pages serwuje pliki jak leżą, bez Jekylla
  (aplikacja statyczna nie potrzebuje przetwarzania).
- Wszystkie ścieżki są WZGLĘDNE (ADR 0002), więc podkatalog `/okolica/`
  działa bez żadnej konfiguracji bazy; kontrakt pilnuje zakazu ścieżek
  root-absolute w `index.html`.
- Agent NIE włączy Pages za Ciebie: `gh api …/pages -X POST` daje 403
  („Resource not accessible by integration") — token nie ma uprawnień
  admin do ustawień repo; sprawdzone 2026-09-06, wynik zapisany
  w `PROJECT_HISTORY`. Ta sekcja jest jedyną drogą.
- Włącz PO scaleniu PR #2 (albo wcześniej — do merge strona pokaże tylko
  `README`; po każdym pushu do `main` Pages przebudowuje się sam, ~1–2 min).
- CI na PR-ach już działa: `.github/workflows/ci.yml` (live od 2026-09-06,
  przyspieszone z M8; lustro receptury w `docs/setup/ci-workflow.yml`,
  kontrakt pilnuje syncu — LESSONS L4, aneks).

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
