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

1. Ekran **Setup**: w bloku „👤 Kto gra?” dodaj graczy (imię + PIN każdego —
   bez co najmniej jednego gracza nie ma przejścia dalej, ADR 0026), wybierz
   tryb ruchu, **planowany czas gry** (promień liczy aplikacja i pokazuje go
   z uzasadnieniem, ADR 0025), liczbę stacji, pytań na stację (łączna liczba
   pytań musi dzielić się równo między graczy — K22, ADR 0027), tematy,
   kategorię wiekową, język i podkład mapy.
2. Ekran **pozycji**: „🛰 Włącz GPS” i poczekaj na fix (badge „±X m”; przy
   > 100 m przejdź w miejsce z lepszym widokiem nieba) albo „✎ Wpisz ręcznie”
   (dziesiętne lub wklejka z Google Maps). Karta „📦 Paczki dla tej okolicy”
   proponuje gotowe paczki z repozytorium — wybór startuje grę bez modelu.
3. Ekran **stacji**: aplikacja pobiera sieć drogową okolicy (Overpass) i rysuje
   stacje; „🔄 Inny układ” losuje od nowa. Gdy sieć jest za uboga, gra ma tyle
   stacji, ile stanęło na mapie (setup idzie za wyborem — S12). Bez sieci:
   „◎ Tryb uproszczony” albo „✋ Ustaw stacje ręcznie”.
4. Ekran **pytań**: „⧉ Kopiuj prompt” → wklej do modelu AI z włączoną kwerendą
   internetową (Meta AI, ChatGPT, Gemini…). Linia pod promptem mówi, jak duża
   będzie odpowiedź, zanim zmarnujesz generację.
5. Ekran **paczki**: wklej odpowiedź modelu („📋 Wklej ze schowka”) albo wczytaj
   „⬆ Z pliku” → „✓ Sprawdź i przyjmij”. Usterki: lista kodów E01–E20 i gotowa
   „⧉ poprawka do modelu”. Poprawna paczka **od razu zaczyna grę** (i leci na
   Drive do przeglądu właściciela); pytania są ukrywane (TO-paczka/2), a pole
   wklejania czyszczone.
6. **Gra**: odcinek startuje jawną akcją, dojście zalicza tylko GPS (dwa fixy
   w progu, ADR 0004/0029); stację nieosiągalną pomiń. Pytanie odsłania się
   dopiero przy dojściu; każde da się ocenić kciukiem (ADR 0028). Pauza (także
   automatyczna w tle) nie wlicza czasu postoju do wyniku.
7. **Wynik**: podsumowanie z tabelą końcową, udostępnianie tekstem lub obrazem
   PNG, historia na setupie; wynik gry z jednego telefonu jedzie na wspólny
   Drive do historii gier (ADR 0026 aneks), gdy choć jeden gracz ma
   potwierdzony profil.

## 4. Test terenowy (obowiązkowy dla M3, M4, M6, M7, M10)

Agent nie ma GPS ani terenu (ENVIRONMENT §4.1, §5) — część kryteriów da się
sprawdzić tylko na zewnątrz. Procedura dla właściciela:

1. Tryb testowy w domu (`?test=true`): ustaw współrzędne swojej okolicy,
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

1. Otwórz preview i dodaj `?test=true` — tryb testowy odsłania ręczne
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
3. **Symulacja:** `?test=true` → ustaw współrzędne → „▶ Symuluj dojście
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
app co repozytorium paczek — a jego adres **wpisany w kod aplikacji**
(`DOMYSLNY_URL_MOSTU` w `app/most.js`, ADR 0020) i scalony do `main`, bo Pages
serwuje `main`. Drugi telefon: dowolny (Chrome), ta sama albo inna sieć — gra
jest asynchroniczna i NIE wymaga konfigurowania adresu.

0. **Stan mostu**: na obu telefonach karta „📦 Paczki dla tej okolicy"
   pokazuje „Most Drive: podłączony — adres jest wpisany w tej wersji
   aplikacji" (m12-75: osobny badge przy grze wieloosobowej zniknął razem
   z dev-tekstami). Gdy widzisz „niepodłączony", aplikacja
   jest starsza niż wdrożenie mostu — sprawdź, czy commit z adresem jest
   w `main`.
1. **Założenie (m12-75)**: telefon A: Ustawienia → rodzaj gry „📱 Multiplayer —
   każdy ma telefon" → „🚀 Zakładam nową grę" → w bloku „Kto gra?"
   wpisz imię i PIN (dokładnie JEDEN gracz — to Ty) → tryb gry + przy
   Wspólnej Trasie ptaszek „widoczna tylko kolejna stacja" (domyślnie ✓) →
   „📍 Dalej: moja pozycja" → potwierdź pozycję → weź pasującą paczkę
   z karty propozycji (albo przejdź dalej i wygeneruj nowe pytania) → po
   wklejeniu odpowiedzi modelu otwiera się **lobby**. Kod gry NIE jest
   potrzebny — gracze sami się znajdą na liście.
2. **Dołączenie z listy (m12-75)**: telefon B (do ~50 m od A): rodzaj gry
   multi → „🚪 Dołączam do istniejącej" — setup chowa wszystkie opcje hosta,
   zostaje blok „Kto gra?" (imię+PIN) i lista gier w okolicy — pokazuje się
   sama od razu (GPS włącza się automatycznie, przycisk ⟳ odświeża). Na liście
   widnieje „Host: <imię A>" (bez dodatkowych informacji) → „Dołącz". Oba
   telefony widzą się na liście graczy w lobby (≤10 s).
   Po starcie dołączenie jest już niemożliwe — lista pokazuje tylko lobby.
3. **Start i trasa (wyścig)**: A klika „▶ Start gry" (może i solo). Na obu:
   odcinek → dojście → pytanie → odpowiedź. Obserwować: tabela wyników
   drugiego gracza i kanał „Info z gry" (dojścia, dobre/złe odpowiedzi,
   rezygnacje) odświeżają się co ~30 s; pasek synchronizacji pokazuje
   „kolejka" po zgubieniu sieci (np. między blokami) i zdarzenia wychodzą
   po powrocie.
4. **Wspólna Trasa**: druga gra w trybie „Wspólna Trasa" — mapa pokazuje
   TYLKO bieżącą stację (kolejne odsłaniają się po drodze), lista wyboru
   stacji nie istnieje, a obaj gracze idą tę samą trasę po kolei, każde we
   własnym tempie (nikt na nikogo nie czeka — od razu można startować odcinek).
5. **Odświeżenie**: w trakcie gry przeładować stronę na B → baner „Telefon
   pamięta grę…" → „↩ Wróć do gry" → zamknięte stacje nie wracają, postęp
   i wyniki są aktualne.
6. **Koniec z ręki hosta**: A klika „⏹ Zakończ grę (host)" — u obu telefonów
   podsumowanie i ranking końcowy; premie 3/2/1 za ukończenie przed końcem
   liczą się także przy takim końcu.
7. **Koniec naturalny**: po ostatniej odpowiedzi (wszyscy aktywni domknęli
   stacje) oba telefony pokazują ostateczną tabelę. Rankingów między grami
   nie ma (właściciel, 2026-09-11) — na Drive zostaje historia gier.
7a. **Wyjście z lobby**: B klika „Opuść lobby" przed startem → na A lista
   graczy maleje po odświeżeniu (≤ 10 s), a gdy wychodzi HOST, gra znika
   z listy gier w okolicy (`gra-opusc`).
8. **Obserwacje** → `docs/LESSONS.md`: dokładność GPS przy stacjach, opóźnienia
   żywej tabeli i kanału info, odmowy mostu (jawne w statusie), zużycie
   baterii przy pollingu.

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
