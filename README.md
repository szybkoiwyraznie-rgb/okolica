# Tajemnicza Okolica

Terenowa gra quizowa na interaktywnej mapie. Aplikacja ustala, gdzie stoisz
(geolokalizacja przeglądarki), rozstawia w Twojej okolicy **stacje** — punkty
osiągalne siecią dróg, placów i szlaków — a potem prowadzi graczy od stacji do
stacji, mierząc czas i zadając pytania o **tę konkretną okolicę**.

Pytania nie są wbudowane w aplikację: generuje je model AI (Meta AI, ChatGPT,
dowolny inny) na podstawie promptu, który aplikacja sama układa, a odpowiedź
wkleja się z powrotem. Aplikacja waliduje schemat i **ukrywa** paczkę (obfuskacja
bez klucza, kontener `TO-paczka/2` — nieczytelna przy kopiowaniu, ale **nie
zaszyfrowana**; ADR 0007), żeby gracze nie podejrzeli pytań przed dojściem do
stacji.

- **Zero zależności i zero builda** — vanilla HTML + JS (ESM) + CSS (ADR 0001).
- **Mobile-first** — gra się na telefonie, w Chrome, palcem (ADR 0011).
- **Bez backendu i bez kluczy API** — model AI jest „zewnętrznym silnikiem
  treści", a wymiana odbywa się przez schowek (ADR 0006).

## Status

**M1 — geodezja i model rozgrywki: zrobione.** Działa szkielet aplikacji:
po starcie widać ekran startowy z intro nad mapą, a przygotowanie gry to pięć
kroków (setup → pozycja → stacje → prompt → paczka) otwieranych przyciskiem
„⚙ START GRY” w belce. Jest walidacja konfiguracji, prompt PYT v1.0 w dwóch
wariantach — bez fact-check (domyślny, ADR 0032) i z fact-check — oraz walidacja
paczki i jej ukrywanie (`TO-paczka/2`). Od 2026-09-09 model nie odwraca już
liter: kodowany jest wyłącznie numer poprawnej odpowiedzi (ADR 0033). Jako czyste funkcje z testami istnieją też **model rozgrywki**
(`app/rozgrywka.js`: kolejka graczy i odpowiadania, odcinki, punktacja
dotarcie-plus-poprawna, dziennik i podsumowanie) oraz
**warstwa pozycji** (`app/pozycja.js`: walidacja współrzędnych, dojście po dwóch kolejnych fixach
w odległości ≤50 m (bez oceny dokładności GPS), komunikaty błędów GPS, symulacja trasy dla trybu testowego).

**M2 — mapa: kod i testy gotowe.** Na ekranach „pozycja" i „stacje" jest mapa
SVG z podkładem rastrowym bez klucza API (OSM Standard, OpenTopoMap, Esri World
Imagery albo podkład wyłączony), gestami palca (drag + pinch), przyciskami
＋ − ◎, markerem pozycji bez koła dokładności, przerywanym okręgiem promienia gry,
numerowanymi pinezkami stacji, paskiem skali i zawsze widoczną atrybucją
dostawcy. Kamień zamknięty 2026-09-05: właściciel potwierdził w live preview,
że podkład jest widoczny i czytelny, a atrybucja i przyciski są na miejscu
(`docs/WORKFLOW.md` §4.1).

**M3 — konfiguracja i prywatność: kod i testy gotowe.** Ekran „dane
i prywatność" (cztery karty z ADR 0013: co jest pobierane i od kogo, dokąd
trafia pozycja, co zostaje na telefonie, jak to skasować; paczka opisana jako
**ukryta, nie zaszyfrowana**) otwiera się z panelu ⓘ Informacje, a kasowanie
danych jest dwustopniowe i rusza tylko klucze `okolica:*`. GPS startuje automatycznie. Nie ma ręcznych pól pozycji ani symulacji 250 m.
W trybie testowym pozycję wskazuje się na mapie; w grze zostaje symulacja
dojścia do stacji. GPS i symulacja używają tej samej reguły ≤50 m.
Setup, lista stacji i pytania są przewijanymi panelami nad przygaszoną mapą.
Podczas drogi zostaje tylko jednowierszowy pasek na dole (gracz, dystans, stacja),
a sterowanie jest w ⓘ Informacje; po dojściu wraca duży panel pytania (ADR 0036).
Oko w prawym dolnym rogu chowa je bez przerywania procesu lub gry.
Wybory nowego setupu: 7, 12, dorośli; tematy alfabetyczne z Ciekawostkami,
bez Sportu i Jedzenia. Stare paczki i zapisy pozostają czytelne (ADR 0034).
Instrukcję promptu rozwija się nagłówkiem; zawiera linki do trzech czatów AI.
Kamień czeka na weryfikację właściciela: kryterium „pełna
konfiguracja bez przewijania na 360 px" (`docs/WORKFLOW.md` §4.2).

**M4 — stacje z sieci drogowej: kod i testy gotowe.** Ekran „stacje" liczy
punkty z prawdziwej sieci dróg, placów i szlaków (Overpass, ADR 0005): jedno
zapytanie na grę dla promienia `R × 1,15`, graf z Dijkstrą, kandydaci co ~50 m
z filtrami dostępności (bez budynków, terenów prywatnych i barier), wybór
w pierścieniu `0,7R ± 20%` z separacją kątową i sieciową oraz pasem
wyrównującym dystanse. Lista pokazuje **dystans drogą**, nie w linii prostej,
a miara sprawiedliwości (udział odchylenia) widnieje pod listą. Sieć jest
zapisywana na telefonie (`okolica:sieci:<geohash6>-<R>`, 30 dni) — druga gra
w tej samej okolicy nie woła Overpass wcale. Gdy sieci nie ma (offline, limit
instancji), degradacja jest jawna: przycisk „◎ Tryb uproszczony" (pierścień)
i „✋ Ustaw stacje ręcznie" (przeciąganie pinezek, dystans tylko w linii
prostej) — aplikacja nigdy nie udaje, że punkty są osiągalne. Kamień czeka na
kryterium terenowe: jedną prawdziwą okolicę na telefonie (`docs/WORKFLOW.md`
§4.2).

**M5 — pętla pytań: kod i testy gotowe.** Ekran promptu ma instrukcję
obrazkową (cztery kroki jako inline SVG, zero plików zewnętrznych),
a wklejenie odpowiedzi modelu automatycznie uruchamia walidację. Paczka z usterkami
daje czytelną listę kodów E01–E20 i przycisk „skopiuj poprawkę do modelu".
Po przyjęciu gra zaczyna się OD RAZU (decyzja 2026-09-07 — podgląd,
ściąganie i edycja zniknęły z ekranu; to zadania właściciela na Drive,
dokąd zestaw leci automatycznie w chwili przyjęcia). Gotowe zestawy można wybrać na ekranie propozycji paczek. Nazwa miejsca do promptu jest pobierana ZAWSZE (ADR 0013 pkt 3 —
przełącznik usunięty w Partii 2), a zapasowa warstwa Nominatim działa tylko po
wyraźnej zgodzie na ekranie prywatności (domyślnie wyłączona, jedno żądanie
na grę, cache 30 dni, atrybucja ODbL — ADR 0013). Jedna poprawka z terenu
(2026-09-11): zapasowa warstwa Nominatim okazała się zbędna — docelowe źródło
(Overpass) jest na stałe i fallback wyleciał z kodu wraz z przełącznikiem.
Kamień czeka na kryterium właściciela: pełna pętla z prawdziwym modelem
(`docs/WORKFLOW.md` §4.2).

**M6 — rozgrywka: kod i testy gotowe.** Gra jest klikalna od setupu do
wyniku: jeden ekran gry z czterema panelami faz („kto idzie" → odcinek z mapą
i dystansem → pytanie odsłaniane DOPIERO w chwili dojścia → wynik), dojście
z GPS (≤50 m, dwa kolejne fixy niezależnie od accuracy; ręczne zaliczanie usunięte
w ADR 0029), pauza (również automatyczna po schowaniu karty), pominięcie stacji
w drodze i ręczne zakończenie z wczesnym wynikiem. Pytania żyją w ukrytym
kontenerze (`TO-paczka/2`) — w stanie gry i w zapisie nigdy nie ma ich treści.
Gra zapisuje się do `localStorage` po KAŻDEJ tranzycji (`stan-gry/1`), więc
zamknięcie przeglądarki nie kończy gry: na setupie czeka baner „wznowienie",
a zegar odcinka jest rebazowany tak, że czas zamknięcia karty nie wlicza się
do wyniku (ADR 0004 pkt 3). W trybie testowym (`?test=true`) dojście można
rozegrać symulacją trasy — gra bez GPS. Kamień czeka na kryterium terenowe
właściciela: pełna gra na telefonie, z utratą zasięgu w trakcie i z
zamknięciem przeglądarki (`docs/WORKFLOW.md` §4.2).

**M7 — podsumowanie, punkty i udostępnianie: kod i testy gotowe.** Po końcu
gry (naturalnym albo ręcznym) panel wyniku pokazuje pełne podsumowanie:
zwycięzca z 🏆, ranking, szczegóły graczy (odcinki, dystans), tabela stacji
(tryb dojścia: GPS / ręczne / pominięta) i statystyki — bez czasów i tempa
(ADR 0023: zero presji czasowej).
Wynik da się udostępnić bez serwera: tekst w formacie przyjaznym komunikatorom
(wiersze stacji bez `#`, żeby `#1` nie stało się nagłówkiem), obraz PNG
1080 px rysowany z czystego planu komend (paleta z tokenów CSS), Web Share →
schowek → plik .txt/.png. W żadnym eksporcie ani w historii nie ma treści
pytań ani współrzędnych — pilnują tego testy-strażnicy. Na setupie dochodzi
karta „Poprzednie gry": do 50 skrótów (`okolica:historia`), najnowsza
pierwsza, ze znacznikiem gier przerwanych ręcznie; dokończenie przerwanej gry
ZASTĘPUJE wpis zamiast dodawać drugi, kasowanie jest dwustopniowe, a zepsuty
zapis odzywa się jawnie kodami `H`. Kamień czeka na kryteria terenowe
właściciela: czytelność w słońcu na 360 px i eksport na Chrome Android oraz
Safari iOS (`docs/WORKFLOW.md` §4.2).

## Uruchomienie lokalne

```bash
npm test                       # same testy (node --test, zero zależności)
npm run brama                  # brama: testy + check szablonu + audyt WCAG (M10)
npm run audyt                  # sam audyt kontrastu WCAG AA (motyw jasny i ciemny)
npm run serwer                 # node tools/serwer.mjs . — podgląd na 0.0.0.0:8000
# otwórz http://localhost:8000
```

Bez serwera (`file://`) aplikacja pokaże baner z instrukcją — przeglądarki
blokują `fetch()` i moduły ES dla plików lokalnych. Geolokalizacja wymaga
**kontekstu bezpiecznego**: `https://` (GitHub Pages) albo `localhost`.

## GitHub Pages

Publikacja z gałęzi `main`, katalog główny (ADR 0002). Wszystkie ścieżki
w aplikacji są **względne**, więc działa i pod `https://<user>.github.io/okolica/`,
i z dowolnego podkatalogu. Włączenie Pages to **jednorazowy krok właściciela**
(Settings → Pages; instrukcja i uwagi techniczne: `docs/WORKFLOW.md` §5 — agent
nie ma uprawnień admin do ustawień repo). Po scaleniu do `main` aplikacja
mieszka pod `https://szybkoiwyraznie-rgb.github.io/okolica/`; każde kolejne
push do `main` przebudowuje stronę automatycznie. Ikony i `manifest.json`
(„dodaj do ekranu głównego") generuje `npm run ikony` — binaria leżą w repo,
bo Pages serwuje z drzewa, a generator odtwarza je bajt w bajt.

## Offline, bateria i sygnały (M10)

- **Offline**: Service Worker (`sw.js`) trzyma na telefonie skorupę aplikacji
  i kafelki ostatniej okolicy (limit 600, ewikcja najstarszych) — po pierwszej
  sesji online gra z lokalnej paczki działa w trybie samolotowym: bez sieci,
  bez Overpassa, bez modelu. POST-y i API (most Drive, Overpass) nigdy nie są
  cache'owane (świeżość i prywatność).
- **Bateria**: „budzenie przy zbliżaniu" — w trasie (powyżej 250 m od stacji)
  GPS pracuje oszczędnie (bez wysokiej dokładności, odświeżanie co ~20 s),
  przy stacji (poniżej 150 m) wraca pełna dokładność; histereza zapobiega
  oscylacji, każda zmiana ma jawny status.
- **Sygnały**: dojście do stacji, start odcinka i ocena odpowiedzi grają
  krótkie melodie (oscylator Web Audio — zero plików dźwiękowych) i wibracje;
  przełącznik „🔔 sygnały" w nagłówku, domyślnie włączone, wybór zapamiętany.
- **Dostępność**: kontrasty obu motywów (jasny/ciemny) pilnuje brama
  `npm run audyt` (WCAG AA: 4.5:1 dla tekstu); checklista terenowa:
  `docs/WORKFLOW.md` §4.3.

## Repozytorium paczek pytań

Gra potrafi obyć się **bez wołania modelu**: każda rozpoczęta gra zostawia
na telefonie kopię swojej paczki (stacje + ukryte pytania), a współdzielone
repozytorium żyje na wydzielonym koncie **Google Drive** z mostem Apps Script
(ADR 0016/0018 — w repozytorium kodu NIE ma plików paczek). Na ekranie
„Gdzie jesteś?" karta „📦 Paczki dla tej okolicy" proponuje dopasowane
paczki według kryteriów właściciela (okolica w zasięgu 200 m od komórki
geohash paczki — kilka metrów różnicy w starcie nie gubi propozycji, ADR 0024;
ta sama liczba stacji i pytań, ten sam poziom, tematy nie szersze niż w setupie,
promień paczki nie większy niż w setupie; tematy wpisu to od 2026-09-11
FAKTYCZNE tematy pytań paczki, nie lista dopuszczalnych z setupu, w którym
paczka powstała — stare wpisy rejestru lokalnego przechodzą migrację przy
starcie, ADR 0017 aneks 2026-09-11). Lista pokazuje trzy najlepsze paczki
(najpierw najlepiej ocenione — największa liczba ocen pozytywnych, ADR 0028;
remisy rozstrzyga świeższa data), resztę po przycisku „Zobacz więcej paczek"
(decyzja właściciela 2026-09-11) — wybór startuje grę bez promptu, bez wklejania, bez
Overpassa i bez modelu. Przyjęcie paczki z AI (ekran wklejania) automatycznie
i bez pytania wysyła ją na Drive do przeglądu właściciela (decyzja
2026-09-07: checkbox zgody usunięty, ADR 0016 aneks). Właściciel
akceptuje kandydatów linkiem z e-maila; adres mostu jest **wpisany w kod
aplikacji** (`DOMYSLNY_URL_MOSTU` w `app/most.js`, ADR 0020) — żadne urządzenie
nie konfiguruje go ręcznie, a przycisk „🔌 Sprawdź połączenie" robi jawną próbę
CORS na żywym wdrożeniu. Eksport „⬇ Paczka do repozytorium (TO-zestaw/1)"
zniknął z ekranu razem z podglądem (decyzja 2026-09-07) — przegląd i wnoszenie
zestawów dzieją się na Drive właściciela.

## Gra wieloosobowa i rankingi (M11/M12)

- **Wiele urządzeń**: każdy gracz ma swój telefon. Rodzaj gry i ścieżka
  (załóż / dołącz) wybiera się na ekranie ustawień; tożsamością jest zwykłe
  imię+PIN (dokładnie jeden gracz na telefon — resztę zapraszasz w lobby).
  Zakładający przechodzi zwykłą ścieżkę (pozycja → stacje i pytania →
  wklejenie odpowiedzi modelu) i po paczce otwiera się lobby; dołączający
  widzi listę gier, których host jest w zasięgu ~50 m (wpis „Host: Jacek",
  bez kodów). Po starcie dołączyć się nie da. Dwa tryby: **Wspólna Trasa**
  (wszyscy tę samą trasę po kolei — trasa jest tajemnicą, na mapie widać
  tylko bieżącą stację) i **Wyścig na Orientację** (dowolna kolejność stacji).
  Punktacja w obu: 1 pkt za dobrą odpowiedź + stała premia 3/2/1 za kolejność
  ukończenia. Start gry możliwy także solo (od 1 gracza), a host może zakończyć
  grę w dowolnym momencie — wszyscy dostają podsumowanie.
- **Wspólny stan**: Google Drive + Apps Script — ten sam most co repozytorium
  paczek (ADR 0016/0018/0019). Na serwer jadą wyłącznie pseudonimy, zdarzenia
  gry i wyniki; **współrzędne graczy nigdy nie opuszczają telefonu** (biała
  lista pól zdarzenia + kasowanie po stronie mostu; okolicę przybliża
  geohash5/geohash8, nigdy punkt). Bez potwierdzonego imienia aplikacja
  odmawia założenia gry i dołączenia.
- **Zero konfiguracji na każdym telefonie**: adres mostu jest wpisany w kod tej
  wersji aplikacji (ADR 0020), więc telefon znajomego działa od razu — interfejs
  pokazuje stan mostu (podłączony / niepodłączony), nie pole do wpisywania.
- **Offline**: zdarzenia z trasy czekają w kolejce i wychodzą automatycznie po
  powrocie sieci (FIFO); po odświeżeniu telefonu gra wraca z zapamiętanej
  sesji — zamknięte stacje nie wracają.
- **🏆 Rankingi**: ogólny + kategorie wiek / tematy / lokalizacja (np.
  „najlepsi w Podkowie Leśnej") oraz historia „Moje gry". Agregacje liczy
  telefon; serwer oddaje surowe wiersze zakończonych gier.

## Repozytorium

| Ścieżka | Zawartość |
|---|---|
| `AGENTS.md` | **zasady pracy agentów — lektura startowa każdej sesji** |
| `docs/PROTOKOL.md` | protokół PYT v1.0: szablon promptu, schemat JSON, walidacja |
| `docs/decisions/` | rejestr decyzji architektonicznych (ADR 0001–0020) |
| `docs/ARCHITECTURE.md` | budowa aplikacji, przepływ danych, algorytm stacji |
| `docs/ROADMAP.md` | kamienie milowe M0–M12 i status |
| `docs/WORKFLOW.md` | procedura sesji + procedura testowania w terenie |
| `docs/LESSONS.md` | rejestr lekcji (objaw → przyczyna → reguła) |
| `docs/setup/ENVIRONMENT.md` | stałe ograniczenia sandboxa, gita i sieci |
| `docs/setup/HANDOFF_*.md` | stan na koniec JEDNEJ sesji |
| `docs/ASSETS.md` | dostawcy kafelków i danych, polityki, atrybucje |
| `app/`, `index.html` | aplikacja |
| `test/` | `node --test` — czysta logika, bez DOM i bez sieci |

## Prywatność

Współrzędne gracza nie są wysyłane nigdzie poza usługi potrzebne do rysowania
mapy i wyznaczania stacji (kafelki, Overpass API; odwrotna geokodacja Nominatim
była warstwą zapasową i 2026-09-11 została usunięta na życzenie właściciela —
zostaje jedno docelowe źródło) — i to wprost z przeglądarki użytkownika.
Zero analityki, zero ciasteczek, zero konta (ADR 0013).

### Ograniczenie podkładu offline (audyt 2026-09-10)

Service Worker zapisuje tylko odpowiedzi z czytelnym statusem sukcesu
(`basic`/`cors`). Kafelki `no-cors` (`opaque`) są przekazywane do wyświetlenia,
ale nie trafiają do Cache Storage: nie da się sprawdzić ich statusu ani ciała.
Cache HTTP przeglądarki działa osobno. Nie gwarantujemy więc podkładu mapowego
po utracie sieci; warstwy własne i lokalna rozgrywka pozostają dostępne.
