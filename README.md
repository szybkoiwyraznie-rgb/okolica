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

**M1 — geodezja i model rozgrywki: zrobione.** Działa szkielet aplikacji
(pięć ekranów: setup → pozycja → stacje → prompt → paczka) z walidacją
konfiguracji, promptem PYT v1.0, walidacją paczki i jej ukrywaniem
(`TO-paczka/2`). Jako czyste funkcje z testami istnieją też **model rozgrywki**
(`app/rozgrywka.js`: kolejka graczy, odcinki i czasy, kara za ręczne
zgłoszenie, punktacja względem mediany tempa, dziennik i podsumowanie) oraz
**warstwa pozycji** (`app/pozycja.js`: filtr dokładności, kryterium dojścia
z debounce'em, komunikaty błędów GPS, symulacja trasy dla trybu testowego).

**M2 — mapa: kod i testy gotowe.** Na ekranach „pozycja" i „stacje" jest mapa
SVG z podkładem rastrowym bez klucza API (OSM Standard, OpenTopoMap, Esri World
Imagery albo podkład wyłączony), gestami palca (drag + pinch), przyciskami
＋ − ◎, markerem pozycji z kołem dokładności, przerywanym okręgiem promienia gry,
numerowanymi pinezkami stacji, paskiem skali i zawsze widoczną atrybucją
dostawcy. Kamień zamknięty 2026-09-05: właściciel potwierdził w live preview,
że podkład jest widoczny i czytelny, a atrybucja i przyciski są na miejscu
(`docs/WORKFLOW.md` §4.1).

**M3 — konfiguracja i prywatność: kod i testy gotowe.** Ekran „dane
i prywatność" (cztery karty z ADR 0013: co jest pobierane i od kogo, dokąd
trafia pozycja, co zostaje na telefonie, jak to skasować; paczka opisana jako
**ukryta, nie zaszyfrowana**) otwiera się z setupu i ze stopki, a kasowanie
danych jest dwustopniowe i rusza tylko klucze `okolica:*`. W trybie testowym
przycisk „▶ Symuluj dojście (250 m)" odtwarza trasę dziewięciu fixów — GPS
i symulacja karmią ten sam `przyjmijFix()`, więc badge dokładności, mapa i próg
dojścia z debounce'em działają identycznie bez sygnału, a pauza w tle zatrzymuje
oba strumienie. Kamień czeka na weryfikację właściciela: kryterium „pełna
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
a odpowiedź modelu można wkleić albo wczytać z pliku. Paczka z usterkami
daje czytelną listę kodów E01–E20 i przycisk „skopiuj poprawkę do modelu".
Po przyjęciu organizator dostaje podgląd „tylko dla organizatora" z ręczną
edycją pytań — każda poprawka przechodzi przez pełną re-walidację i zostawia
ślad w `modyfikacje[]` (ADR 0006 pkt 8). Ukrytą paczkę (`TO-paczka/2`) można
zapisać do pliku `.paczka.json` i wczytać z powrotem — plik niesie kontener,
nigdy jawne pytania. Nazwa miejsca do promptu jest bramowana ustawieniem
„pobieranie nazwy miejsca", a zapasowa warstwa Nominatim działa tylko po
wyraźnej zgodzie na ekranie prywatności (domyślnie wyłączona, jedno żądanie
na grę, cache 30 dni, atrybucja ODbL — ADR 0013). Kamień czeka na kryterium
właściciela: pełna pętla z prawdziwym modelem (`docs/WORKFLOW.md` §4.2).

**M6 — rozgrywka: kod i testy gotowe.** Gra jest klikalna od setupu do
wyniku: jeden ekran gry z czterema panelami faz („kto idzie" → odcinek z mapą
i dystansem → pytanie odsłaniane DOPIERO w chwili dojścia → wynik), dojście
z GPS (próg `max(25 m, 1,2 × accuracy)` + dwa kolejne trafienia) albo ręczne
z karą, pauza (również automatyczna po schowaniu karty), pominięcie stacji
w drodze i ręczne zakończenie z wczesnym wynikiem. Pytania żyją w ukrytym
kontenerze (`TO-paczka/2`) — w stanie gry i w zapisie nigdy nie ma ich treści.
Gra zapisuje się do `localStorage` po KAŻDEJ tranzycji (`stan-gry/1`), więc
zamknięcie przeglądarki nie kończy gry: na setupie czeka baner „wznowienie",
a zegar odcinka jest rebazowany tak, że czas zamknięcia karty nie wlicza się
do wyniku (ADR 0004 pkt 3). W trybie testowym (`?tryb=test`) dojście można
rozegrać symulacją trasy — gra bez GPS. Kamień czeka na kryterium terenowe
właściciela: pełna gra na telefonie, z utratą zasięgu w trakcie i z
zamknięciem przeglądarki (`docs/WORKFLOW.md` §4.2).

**M7 — podsumowanie, punkty i udostępnianie: kod i testy gotowe.** Po końcu
gry (naturalnym albo ręcznym) panel wyniku pokazuje pełne podsumowanie:
zwycięzca z 🏆 i rozbiciem punktacji, ranking, szczegóły graczy (odcinki,
tempo), tabela stacji (tryb dojścia: GPS / ręczne / pominięta), statystyki
i medal sprawiedliwości trasy (🏅 widokowe — nie wpływa na punkty, ADR 0014).
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
npm test                       # brama jakości (node --test, zero zależności)
npm run serwer                 # python3 -m http.server 8000 --bind 0.0.0.0
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

## Repozytorium paczek pytań

Gra potrafi obyć się **bez wołania modelu**: każda rozpoczęta gra zostawia
na telefonie kopię swojej paczki (stacje + ukryte pytania), a współdzielone
repozytorium żyje na wydzielonym koncie **Google Drive** z mostem Apps Script
(ADR 0016/0018 — w repozytorium kodu NIE ma plików paczek). Na ekranie
„Gdzie jesteś?" karta „📦 Paczki dla tej okolicy" proponuje dopasowane
paczki według kryteriów właściciela (ta sama okolica, ta sama liczba stacji
i pytań, ten sam poziom, tematy nie szersze niż w setupie, promień paczki nie
większy niż w setupie) — wybór startuje grę bez promptu, bez wklejania, bez
Overpassa i bez modelu. Przyjęcie paczki z AI (ekran wklejania) automatycznie
wysyła ją na Drive do przeglądu właściciela — zgoda jest checkboxem na tym
samym ekranie, domyślnie zaznaczonym, można odhaczyć (opt-out). Właściciel
akceptuje kandydatów linkiem z e-maila; adres mostu wpisuje się w UI
(„Źródło repozytorium"), a przycisk „🔌 Sprawdź połączenie" robi jawną próbę
CORS na żywym wdrożeniu. Eksport „⬇ Paczka do repozytorium (TO-zestaw/1)"
daje plik do ręcznego wniesienia, gdy most jest niedostępny.

## Repozytorium

| Ścieżka | Zawartość |
|---|---|
| `AGENTS.md` | **zasady pracy agentów — lektura startowa każdej sesji** |
| `docs/PROTOKOL.md` | protokół PYT v1.0: szablon promptu, schemat JSON, walidacja |
| `docs/decisions/` | rejestr decyzji architektonicznych (ADR 0001–0013) |
| `docs/ARCHITECTURE.md` | budowa aplikacji, przepływ danych, algorytm stacji |
| `docs/ROADMAP.md` | kamienie milowe M0–M10 i status |
| `docs/WORKFLOW.md` | procedura sesji + procedura testowania w terenie |
| `docs/LESSONS.md` | rejestr lekcji (objaw → przyczyna → reguła) |
| `docs/setup/ENVIRONMENT.md` | stałe ograniczenia sandboxa, gita i sieci |
| `docs/setup/HANDOFF_*.md` | stan na koniec JEDNEJ sesji |
| `docs/ASSETS.md` | dostawcy kafelków i danych, polityki, atrybucje |
| `app/`, `index.html` | aplikacja |
| `test/` | `node --test` — czysta logika, bez DOM i bez sieci |
| `AME-main.zip` | wzorzec dobrych praktyk z projektu AME (materiał referencyjny) |

## Prywatność

Współrzędne gracza nie są wysyłane nigdzie poza usługi potrzebne do rysowania
mapy i wyznaczania stacji (kafelki, Overpass API, odwrotna geokodacja) — i to
wprost z przeglądarki użytkownika. Zero analityki, zero ciasteczek, zero konta
(ADR 0013).
