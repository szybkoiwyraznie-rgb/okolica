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

1. Ekran **Setup** (kolejność jak na ekranie): „Rodzaj gry” — „👥 Hot-seat —
   jeden telefon” albo „📱 Multiplayer — każdy ma telefon” (ADR 0019);
   „Sposób poruszania się” (piesza / rowerowa / samochodowa); **planowany czas
   gry** — promień liczy aplikacja i pokazuje go z uzasadnieniem (ADR 0025);
   liczba stacji i pytań na stację (łączna liczba pytań musi dzielić się równo
   między graczy — K22, ADR 0027); „👤 Kto gra?” — imię + PIN każdego gracza,
   bez co najmniej jednego nie ma przejścia dalej (ADR 0026); kategoria wiekowa
   (7 lat / 12 lat / dorośli) i tematy. **Języka i podkładu mapy się nie
   wybiera** — są zaszyte w kodzie (polski + OSM Standard, ADR 0037).
   W multi tożsamość jedzie NA GÓRĘ, zaraz pod „Co robisz?” („🚀 Zakładam nową
   grę” / „🚪 Dołączam do istniejącej”), bo jeden telefon obsługuje jedną osobę
   (właściciel 2026-09-12); znika pole pytań na stację (jedna stacja = jedno
   pytanie), a na dole pojawia się „Tryb gry” — wyścig albo Wspólna Trasa.
2. Ekran **pozycji**: GPS rusza SAM (ADR 0034 pkt 5) — status idzie
   „Czekam na pozycję…” → „Szukam satelitów…” → „Pozycja ustalona”, a karta
   pokazuje współrzędne i geohash. Przycisku włączania GPS, pól ręcznych
   współrzędnych i badge’a dokładności NIE MA (ADR 0034 pkt 2 i 5); w trybie
   testowym pozycję ustawia krótkie stuknięcie mapy. Karta „📦 Paczki dla tej
   okolicy” proponuje gotowe paczki z repozytorium — wybór startuje grę bez
   modelu (paczek z pamięci tego telefonu UI nie pokazuje — zadanie I,
   2026-09-12).
3. Ekran **stacji**: aplikacja pobiera sieć drogową okolicy (Overpass) i rysuje
   stacje; „🔄 Inny układ” losuje od nowa. Gdy sieć jest za uboga, gra ma tyle
   stacji, ile stanęło na mapie (setup idzie za wyborem — S12). Bez sieci gra
   schodzi do pierścienia z jawnym komunikatem („osiągalność
   niezweryfikowana”), a do ręki zostaje „✋ Ustaw stacje ręcznie”.
4. Ekran **pytań**: „⧉ Kopiuj prompt” → wklej do jednego z czatów AI (Meta AI,
   ChatGPT, Gemini — linki na ekranie) i wklej odpowiedź z powrotem. Kontrakt
   z modelem niesie sam prompt: „Pytania z fact check” (kwerenda internetowa)
   albo domyślny wariant bez fact-checku, w którym model korzysta z własnej
   wiedzy (ADR 0032).
5. Ekran **paczki**: wklej odpowiedź modelu (ręcznie albo „📋 Wklej
   ze schowka”) — sprawdzanie rusza SAMO przy każdej zmianie tekstu, przycisku
   „przyjmij” nie ma, a wczytywania „⬆ Z pliku” nie ma od 2026-09-07 (ADR 0006
   aneks 3). Usterki: lista kodów E01–E20 i gotowa
   „⧉ poprawka do modelu”. Poprawna paczka **od razu zaczyna grę** (i leci na
   Drive prosto do repozytorium okolicy — moderacja wstępna zniesiona
   2026-09-11); pytania są ukrywane (TO-paczka/2), a pole wklejania
   czyszczone.
6. **Gra**: odcinek startuje jawną akcją, dojście zalicza tylko GPS (dwa fixy
   w progu, ADR 0004/0029). Nieosiągalną stację i całą grę kończy ikona
   „⚙ START GRY” w belce: NIE JEST zgaszona (odwrócenie zadania J, 2026-09-12),
   a w trakcie gry otwiera warstwę „Czy na pewno chcesz zakończyć aktualną grę?”
   z polem na TAK i przyciskiem „■ ZAKOŃCZ AKTUALNĄ GRĘ” zablokowanym do czasu
   wpisania TAK (właściciel 2026-09-13, ADR 0043). Akcji pomijania nie ma od
   zadania H, 2026-09-12, a przycisku „■ Zakończ grę” w panelu nie ma od ADR 0043. Pytanie odsłania się
   dopiero przy dojściu; każde da się ocenić kciukiem (ADR 0028). Po odpowiedzi
   pytanie i możliwe odpowiedzi zjeżdżają do zwijanego elementu, a na wierzchu
   zostają łapki, poprawna odpowiedź i komentarz — bez przewijania na telefonie
   (ADR 0036 aneks 2026-09-13). Pauzy NIE MA (właściciel 2026-09-13, ADR 0040):
   gra i śledzenie idą cały czas, po powrocie z tła wszystko wznawia się samo
   bez klikania, a jedyna przerwa to 15 minut bez żadnej akcji — wznawia ją
   dowolny klik. W drodze Informacje nie mieszczą NIC z gry (ADR 0043) — nad
   mapą zostaje sam pasek.
7. **Wynik**: ekran jest MINIMALNY (ADR 0038) — „🏁 Koniec gry!”, karta
   zwycięzcy, tabela tej gry (gracz / punkty / poprawne), osobna linia z losem
   wysyłki na Drive i „🏠 Wróć na początek — nowa gra”. Eksportów (.txt, PNG,
   share, schowek) i statystyk NIE MA. Historia gier leży na setupie
   („Poprzednie gry”), a ranking MIĘDZY grami ma własny ekran z belki ikon
   (ADR 0039). Wynik gry z jednego telefonu jedzie na wspólny Drive do historii
   gier (ADR 0026 aneks), gdy choć jeden gracz ma potwierdzony profil.

## 4. Test terenowy (obowiązkowy dla M3, M4, M6, M7, M10)

Agent nie ma GPS ani terenu (ENVIRONMENT §4.1, §5) — część kryteriów da się
sprawdzić tylko na zewnątrz. Procedura dla właściciela:

1. Tryb testowy w domu (`?test=true`): na ekranie pozycji **stuknij mapę**,
   żeby ustawić swoją okolicę (pól współrzędnych nie ma), a w ekranie gry użyj
   „▶ Symuluj dojście (tryb testowy)” — sprawdź logikę dojścia bez GPS.
2. W terenie: `npm run serwer` nie jest dostępny, więc graj na Pages albo przez
   live preview Areny (HTTPS). Zabierz powerbank.
3. Zmierz i zapisz: czas od wejścia w próg 50 m (`progDojsciaM` w `app/geo.js`)
   do zapalenia stacji, liczbę fałszywych dojść (próg to DWA kolejne pomiary,
   ADR 0034 pkt 2), ile metrów „zapasu” miał próg, zachowanie pinch/zoom
   w rękawiczce, czytelność w słońcu. Dokładności GPS aplikacja nie pokazuje
   i nie mierzy nią dojścia — nie zapisuj jej jako kryterium.
4. Wynik → `docs/LESSONS.md` jako nowa lekcja (objaw → przyczyna → reguła) oraz
   korekta progów — `progDojsciaM` w `app/geo.js` (próg dojścia) i
   `PROG_BATERII_M` w `app/pozycja.js` (histereza 250/150 m) — plus ADR, jeśli
   zmienia to zasadę.

### 4.1 Weryfikacja mapy w live preview (M2 — robi właściciel)

Kafelków i przeglądarki w sandboxie agenta nie ma (ENVIRONMENT §4.1, LESSONS
L3), więc kryterium „podkład widoczny" sprawdza właściciel. Agent uruchamia
serwer (`npm run serwer`, port 8000/8080, `--bind 0.0.0.0`), a preview Areny
jest widoczne jako karta obok rozmowy.

1. Otwórz preview i dodaj `?test=true` — tryb testowy pozwala ustawić pozycję
   stuknięciem mapy, więc nie potrzebujesz GPS (ręcznych pól współrzędnych nie
   ma od ADR 0034 pkt 5).
2. Ustaw pozycję swojej okolicy: **stuknij mapę** na ekranie pozycji — status
   mówi „Pozycja ustawiona z mapy / symulacji”, a karta pokazuje współrzędne
   i geohash (wpisywania dziesiętnych ani wklejania stopni-minut-sekund
   z Google Maps nie ma — ADR 0034 pkt 5). Sprawdź: **kafelki się ładują**,
   niebieski marker stoi w środku, przerywany okrąg to promień gry. Koła
   dokładności NIE MA (ADR 0034 pkt 2: `accuracy` nie jedzie na rysunek).
3. Palec (albo mysz): przeciągnij mapę — treść jedzie z palcem, bez białych
   dziur na krawędzi; uszczypnij — zoom rośnie wokół środka palców; kółko myszy
   też działa. W trybie testowym krótkie **stuknięcie** mapy pozycji ustawia
   pozycję (status „z mapy”, współrzędne i geohash na karcie się wypełniają),
   a przeciągnięcie i pinch —
   NIE. Przyciski ＋ − ◎ w prawym górnym rogu mają ≥ 44 px.
4. Pasek skali na dole po lewej pokazuje „50 m"/„200 m" i zmienia się z zoomem.
5. Atrybucja dostawcy (OpenStreetMap) jest **zawsze widoczna** na dole panelu,
   a pod nią linki „Report a map issue” i kontakt — polityka OSM (ASSETS §2).
   **Przełącznika podkładu w setupie nie ma**: język i podkład są zaszyte
   w kodzie (polski + OSM Standard, ADR 0037). Pozostałe podkłady (OpenTopoMap,
   Esri World Imagery, wyłączony) żyją w `app/mapa.js` i są pokryte testami —
   gracz ich nie wybiera; zostało tylko operatorskie nadpisanie szablonu
   kafelków kluczem `localStorage` (ADR 0003 aneks).
6. Wejdź na ekran stacji: pięć numerowanych pinezek w pierścieniu, a „Inny
   układ" przestawia je i przerysowuje mapę.
7. Obróć telefon (albo zmień rozmiar okna) — mapa ma się przeliczyć, nie zostać
   ucięta, a po obrocie ma **sama wrócić na Twoją pozycję**: aplikacja klika ◎
   za gracza (ADR 0030 aneks 2026-09-13), przybliżenie zostaje Twoje. Zwykła
   zmiana rozmiaru bez obrotu (klawiatura, pasek przeglądarki, okno na
   desktopie) kadru NIE rusza — mapę prowadzi palec. Przełącznika orientacji
   w menu nie ma i być nie musi: ekran obraca się sam.
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
3. **Symulacja:** `?test=true` → stuknij mapę na ekranie pozycji → w ekranie
   gry „▶ Symuluj dojście (tryb testowy)” (`#przycisk-symulacja-gra`): marker
   mapy i pasek dystansu jadą, na końcu stacja się zapala (dwa fixy w progu
   50 m). Drugi klik zatrzymuje strumień; **zejście karty w tło NIE** — od
   2026-09-13 śledzenie idzie cały czas (ADR 0040), a symulacja testowa staje.
4. **GPS na żywo (przy oknie/na zewnątrz):** pozycja aktualizuje się sama
   (karta pokazuje współrzędne i geohash), odmowa zgody pokazuje `P02`
   z podpowiedzią, a zejście w tło NIE zatrzymuje śledzenia i po powrocie
   nasłuch odświeża się sam, bez komunikatu (ADR 0040 pkt 3). Badge’a dokładności
   nie ma i nie ma być (ADR 0034 pkt 2).
5. Wynik (co działa, co nie, decyzja z pkt 1) → wpis w
   `docs/PROJECT_HISTORY.md` i ewentualna lekcja; dopiero wtedy `ROADMAP`
   dostaje ✅ przy M3.

### 4.3 Weryfikacja M10 na telefonie (robi właściciel)

Przygotowanie: aplikacja na Pages (HTTPS — bez tego ani Service Worker, ani
geolokalizacja) i PIERWSZA sesja online w okolicy planowanej gry — wtedy SW
zapisuje skorupę i kafelki „na później".

1. **Offline**: po pierwszej sesji włącz tryb samolotowy i otwórz aplikację
   ponownie — skorupa musi się otworzyć, mapa pokazać kafelki ostatniej
   okolicy, a zaczęta wcześniej gra działać bez sieci (zero
   Overpassa, zero modelu; paczki są tylko z repozytorium — zadanie I,
   2026-09-12). Zanotuj, ile ulic „wystaje" poza zapamiętane
   kafelki przy zboczeniu z trasy.
2. **Bateria i ekran** (ADR 0040): profilów GPS już nie ma — jeden, dokładny,
   przez całą grę; pauzy też nie ma. Zapisz: ile % baterii zjadła godzina gry
   z włączonym ekranem, czy ekran sam nie zgasł w trakcie marszu (Wake Lock,
   pkt 4 — na iOS może nie działać, wtedy notujemy zachowanie systemu), czy po
   schowaniu telefonu i powrocie dystans w pasku odżył BEZ klikania, oraz czy
   przerwa po 15 minutach bezczynności wznawia się pierwszym dotykiem.
3. **Sygnały**: w hałasie ulicy — czy „dotarcie" (dwa tony w górę + wibracja)
   jest zauważalne bez patrzenia w ekran; w kieszeni — sama wibracja;
   przełącznik „🔔 sygnały" pamięta wybór po odświeżeniu i zamknięciu karty.
4. **Motywy i słońce**: w pełnym słońcu motyw jasny, po zmroku ciemny —
   czytelność statusu, pytań i pinów; kontrasty tokenów pilnuje brama
   (`npm run audyt`), więc tu tylko subiektywne „czy widać".
5. **Dostępność**: powiększenie 200% bez utraty treści i bez poziomego
   przewijania, kolejność fokusu w ekranie gry (pytanie → odpowiedzi →
   dalej), cele dotykowe ≥44 px w rękawiczce.
6. **Progi dojścia (ADR 0004 + ADR 0034 pkt 2)**: czas od wejścia w próg 50 m
   do zapalenia stacji i liczba fałszywych dojść — próg to dwa kolejne pomiary,
   `accuracy` w decyzji nie uczestniczy.
7. Wynik → `docs/LESSONS.md` (objaw → przyczyna → reguła) i ewentualna
   korekta `PROG_BATERII_M` / planów sygnałów / progów dojścia.

### 4.4 Weryfikacja M11/M12 na dwóch telefonach (robi właściciel)

Warunek: most wdrożony według instrukcji z czatu (P8, ADR 0018) — ten sam web
app co repozytorium paczek — a jego adres **wpisany w kod aplikacji**
(`DOMYSLNY_URL_MOSTU` w `app/most.js`, ADR 0020) i scalony do `main`, bo Pages
serwuje `main`. Drugi telefon: dowolny (Chrome), ta sama albo inna sieć — gra
jest asynchroniczna i NIE wymaga konfigurowania adresu.

0. **Stan mostu**: na ekranie pozycji karta „📦 Paczki dla tej okolicy”
   pokazuje „Most Drive: podłączony.” (z `?test=true` — dłuższy wariant
   „…adres jest wpisany w tej wersji aplikacji (ADR 0020)”; m12-75: osobny
   badge przy grze wieloosobowej zniknął razem z dev-tekstami).
   Gdy widzisz „niepodłączony”, aplikacja
   jest starsza niż wdrożenie mostu — sprawdź, czy commit z adresem jest
   w `main`.
1. **Założenie (m12-75, kolejność od 2026-09-12)**: telefon A: Ustawienia →
   rodzaj gry „📱 Multiplayer — każdy ma telefon” → „🚀 Zakładam nową grę” →
   OD RAZU blok „👤 Kto gra?” (imię + PIN, dokładnie JEDEN gracz — to Ty;
   w multi tożsamość jest pierwszym krokiem obu ścieżek) → tryb gry + przy
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
3. **Start i trasa (wyścig)**: A klika „▶ Start gry" (może i solo). Na OBU
   telefonach odlicza się 5-4-3-2-1-START — wielka cyfra na środku, tło
   przezroczyste (mapa zostaje widoczna), a każdy krok daje sygnał: dźwięk
   i wibrację, o ile 🔔 nie jest wyciszone (właściciel 2026-09-13, ADR 0044).
   Potem gra wygląda DOKŁADNIE jak hotseat: pasek na dole, panel fazy, mapa —
   karty multi, kanału „Info z gry", tabeli żywych wyników i paska „Ostatni
   stan" w grze NIE MA (pasek został w lobby). Obserwować: po zgubieniu sieci
   status mówi o kolejce, a zdarzenia wychodzą po powrocie; odcinek → dojście →
   pytanie → odpowiedź idą jak w hotseat.
4. **Wspólna Trasa**: druga gra w trybie „Wspólna Trasa" — mapa pokazuje
   TYLKO bieżącą stację (kolejne odsłaniają się po drodze), lista wyboru
   stacji nie istnieje, a obaj gracze idą tę samą trasę po kolei, każde we
   własnym tempie (nikt na nikogo nie czeka — od razu można startować odcinek).
5. **Odświeżenie**: w trakcie gry przeładować stronę na B → baner „Telefon
   pamięta grę…" → „↩ Wróć do gry" → zamknięte stacje nie wracają, postęp
   i wyniki są aktualne, a powrót NIE odlicza startu (to nie jest start,
   ADR 0044).
6. **Koniec z ręki hosta**: A klika ⚙ START GRY → warstwa „Czy na pewno chcesz
   zakończyć aktualną grę?" → wpisuje TAK → „■ ZAKOŃCZ AKTUALNĄ GRĘ" (ADR 0043;
   przycisku „⏹ Zakończ grę (host)" nie ma — ADR 0044) — u obu telefonów
   podsumowanie i ranking końcowy; premie za ukończenie przed końcem liczą się
   także przy takim końcu, a ich pula zależy od liczby grających, którzy nie
   odłączyli się wcześniej (2 grających: 1/0, 3: 2/1/0, 4 i więcej: 3/2/1/0).
7. **Koniec naturalny**: po ostatniej odpowiedzi (wszyscy aktywni domknęli
   stacje) oba telefony pokazują ostateczną tabelę TEJ gry (ADR 0038: zwycięzca,
   punkty, poprawne — bez eksportów i statystyk).
7a. **Ranking między grami (ADR 0039)**: ikona pucharu w belce otwiera ekran
   z DWIEMA tabelami po ≤5 pozycji — „Ranking Punktowy Graczy” (suma punktów
   z gier zakończonych) i „Mistrzowie Zagadek” (odsetek poprawnych, liczony od
   10 zadanych pytań). Warunek: most wdrożony w wersji z `?akcja=ranking`
   (NOWY deployment Apps Script — dopóki właściciel go nie wgra, ekran mówi
   wprost, że nie udało się pobrać rankingu, a gra działa dalej). W tabelach
   są tylko profile potwierdzone na Drive. Wiersz wyjaśnień (ilu graczy ma
   profil, od ilu pytań liczy się druga tabela) jest NA KOŃCU warstwy, pod
   obiema tabelami — uwaga właściciela z testów, 2026-09-12.
7b. **Wyjście z lobby**: B klika „Opuść lobby” przed startem → na A lista
   graczy maleje po odświeżeniu (≤ 10 s), a gdy wychodzi HOST, gra znika
   z listy gier w okolicy (`gra-opusc`).
8. **Obserwacje** → `docs/LESSONS.md`: pewność dojścia przy stacjach, opóźnienia
   żywej tabeli i kanału info, odmowy mostu (jawne w statusie), zużycie
   baterii przy pollingu.

## 5. Publikacja na GitHub Pages (włączona — publikuje workflow)

Adres: `https://szybkoiwyraznie-rgb.github.io/okolica/`.

Od 2026-09-07 źródłem Pages jest **GitHub Actions**, nie gałąź: Settings →
Pages → Source: **GitHub Actions**, a publikację robi
`.github/workflows/pages.yml` (lustro w `docs/setup/pages-workflow.yml`,
pinowane kontraktem). Workflow przy każdym pushu do `main` uruchamia bramę
(`npm test` + `npm run check`), usuwa `.git` z drzewa, pakuje katalog
repozytorium (`path: ./`) i woła `deploy-pages@v4` — przebudowa trwa ~1–2 min.
Publikacja aplikacji to więc scalenie PR, nie klikanie w ustawieniach, i nie
przechodzi kod, który nie jest zielony.

Uwagi techniczne (M8):

- Repozytorium MA `.nojekyll` — z czasów publikacji z gałęzi; przy Source:
  GitHub Actions pliki i tak trafiają do artefaktu jak leżą, bez Jekylla.
- Wszystkie ścieżki są WZGLĘDNE (ADR 0002), więc podkatalog `/okolica/`
  działa bez żadnej konfiguracji bazy; kontrakt pilnuje zakazu ścieżek
  root-absolute w `index.html`.
- Agent NIE zmieni ustawień Pages: `gh api …/pages -X POST` daje 403
  („Resource not accessible by integration”) — token nie ma uprawnień admin
  do ustawień repo; sprawdzone 2026-09-06, wynik zapisany
  w `PROJECT_HISTORY`. Ustawienia klika właściciel, workflow leży w repo.
- CI na PR-ach działa osobno: `.github/workflows/ci.yml` (live od 2026-09-06,
  przyspieszone z M8; lustro receptury w `docs/setup/ci-workflow.yml`,
  kontrakt pilnuje syncu — LESSONS L4, aneks).
## 6. Dodawanie rzeczy powtarzalnych

| Co dodajesz | Gdzie | Co jeszcze trzeba zrobić |
| --- | --- | --- |
| Nowy temat pytań | `app/konfig.js` → `TEMATY` **i `TEMATY_SETUP`** + `docs/PROTOKOL.md` §5 | test kanonu, ten sam commit (LESSONS L45/L49: kanon żyje w kilku stałych naraz) |
| Nowa kategoria wiekowa | `app/konfig.js` → `WIEK` **i `WIEK_SETUP`** + protokół §4 | opis trudności do promptu, test |
| Nowy dostawca kafelków/danych | `app/mapa.js` albo `app/sieci.js` | wpis w `docs/ASSETS.md` (polityka, atrybucja, limity) + ADR |
| Nowa decyzja architektoniczna | `docs/decisions/NNNN-*.md` | aktualizacja rejestru w `docs/decisions/README.md`, ten sam commit |
| Nowa lekcja | `docs/LESSONS.md` | numeracja na końcu, format objaw→przyczyna→reguła |
| Usunięcie funkcji (fala uwag) | kod + `index.html` | grep po nośnikach żywych (`README`, `docs/*`, `.gs`, komentarze w `app/*.js`) i wpis frazy do `test/dryf-dokumentow.test.js` — LESSONS L58 |
| Nowy pomysł | `docs/BACKLOG.md` | nie bierz go do pracy bez zlecenia albo kamienia milowego |
| Paczka referencyjna | `data/przyklady/zestaw-*.json` (dziś: `zestaw-podkowa-lesna.json`) | weryfikacja każdego URL przez `fetch_page` (ADR 0008 pkt 6) |
