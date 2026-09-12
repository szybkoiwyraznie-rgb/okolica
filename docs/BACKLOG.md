# BACKLOG — bank pomysłów i rozpoznania

> **Rozpoznanie do wykorzystania, nie kolejka zadań** (AGENTS.md §4). Zadania
> przydziela właściciel w czacie albo kamień milowy z `docs/ROADMAP.md`; wpis
> w backlogu nie upoważnia do wzięcia się za temat. Format: `## Bn — tytuł`,
> potem: pomysł → dlaczego → czego wymaga → ryzyka.

## B1 — Gra na wielu telefonach (multi-device)

Wspólna rozgrywka dla graczy rozproszonych po okolicy, każdy na swoim
urządzeniu, z widokiem pozycji innych. Wymaga: rezygnacji z „zero backendu"
albo trybu „wymiana stanów przez paczki/kod rozgrywki" (np. przez QR i plik),
nowego ADR zastępującego ADR 0009 oraz analizy prywatności (współrzędne innych
osób!). Ryzyko: to jest inny produkt — najpierw doprowadzić hot-seat do końca.

## B2 — Repozytorium paczek pytań (kontekst M9)

Indeks geohash-5 → lista paczek z metadanymi; aplikacja proponuje gotową
paczkę dla okolicy zanim zawoła model. Wymaga decyzji o prywatności geohashu
(ADR 0013 pkt 6), licencji treści, moderacji i przeglądu źródeł.

## B3 — Tryb „bez AI": pytania z danych OSM i Wikipedii

Generowanie pytań lokalnie z faktów strukturalnych (nazwa ulicy i jej patron,
data powstania obiektu z `start_date`, rzeka, pomnik + opis z Wikipedii).
Zalety: brak kroku z modelem, offline. Ryzyka: pytania płytkie, licencje
(Wikipedia CC BY-SA wymaga atrybucji), jakościowo inny produkt — raczej tryb
dodatkowy niż zamiennik.

## B4 — Trasy i nawigacja piesza (wskazówki skrętów)

Dziś pokazujemy stację i dystans w linii prostej/sieciowo. Pełna nawigacja
oznacza routing po grafie (mamy go z ADR 0005) i instrukcje „za 100 m w lewo".
Ryzyko: odpowiedzialność za prowadzenie użytkownika w ruchu ulicznym; wymaga
decyzji właściciela i pewnie ostrzeżeń prawnych w UI.

## B5 — Punkty specjalne i mechanika gry (odznaki, serie, bonusy)

Bonusy za serię poprawnych, odznaki za tematy, „stacja-niespodzianka", tryb
kooperacyjny z pytaniem wymagającym dwóch graczy, handicap dla młodszych.
Wymaga: model punktacji z ADR 0009 pkt 5 musi być stabilny (M7).

## B6 — Oszczędzanie baterii: budzenie przy zbliżaniu

Zamiast ciągłego `watchPosition` z `enableHighAccuracy` — rzadkie fixy z
grubą dokładnością i „budzenie" dokładnego śledzenia w promieniu ~200 m od
stacji (albo geofencing natywny, jeśli przeglądarka go udostępni). Mierzyć
wpływ na próg dojścia (ADR 0004) — ryzyko: przeoczone dojście.

## B7 — Warstwa „nie wchodź tu" i bezpieczeństwo

Ostrzeżenia przy stacjach blisko jezdni, torów, wody; tryb nocny z
ograniczeniem gry po zmroku dla kategorii wiekowej 7–12; komunikat „nie
korzystaj z aplikacji w czasie prowadzenia roweru/samochodu".

## B8 — Wersja językowa interfejsu (EN/DE/UA)

Interfejs po polsku (ADR 0011 pkt 8); treść pytań już jest wielojęzyczna przez
parametr `jezyk`. Pełny i18n UI wymaga słowników i nowego ADR — rozważyć, gdy
pojawi się potrzeba udostępnienia gry turystom.

## B9 — PWA: Service Worker i pełny offline

Cache kafelków ostatniej okolicy + paczki + assetów, żeby gra działała bez
zasięgu. Wymaga ADR (strategia cache, aktualizacje wersji, `?v=`), a ryzyko to
„stara wersja aplikacji w cache" — klasyczna pułapka PWA.

## B10 — Eksport trasy do GPX / KML i integracja z zegarkami

Zapis stacji i przebiegu jako GPX (dla Garmin/Strava). Małe, użyteczne,
bez zależności (XML piszemy sami).

## B11 — Ranking i historia okolic (lokalna)

„Zaliczone okolice" na mapie świata (geohash-5 jako kropki), statystyki
tematyczne, liczba gier. Wszystko lokalnie (ADR 0013) — bez konta i bez
serwera.

## B12 — Tryb „edukacyjny" dla szkół i grup

Rozgrywka dla 20+ uczestników z podziałem na drużyny, pytania o tej samej
trudności dla wszystkich, wydruk/zestawienie wyników dla prowadzącego. Wymaga
przemyślenia ADR 0009 (jeden telefon) — pewnie jako osobny tryb „prowadzący".

## B13 — Audyt dostępności WCAG 2.2 AA

Pełny przegląd: kontrast w słońcu, fokus, `aria-live`, obsługa czytników
ekranu, alternatywy dla gestów. Zrobić po M7, gdy UI jest kompletny.

## B14 — Narzędzie `tools/budzet-lektury.mjs` ✅ ZROBIONE (2026-09-07)

Liczy tokeny lektury startowej (`AGENTS.md` §0, próg 100 tys.) i pilnuje, żeby
dokumentacja nie rozrosła się ponad budżet. Zrobione w sesji S1–S7:
`tools/budzet-lektury.mjs` + `test/budzet-lektury.test.js` + `npm run budzet`;
pierwsze użycie ścięło lekturę 49946 → 39667 tok (S5).

## B15 — Podkład wektorowy (OpenFreeMap) za cenę jednej zależności

OpenFreeMap daje darmowe, bezlimitowe kafelki **wektorowe** bez klucza,
rejestracji i ciasteczek — ale render wektorów (MVT/pbf, style, etykiety) bez
MapLibre GL jest projektem na wiele tygodni. Wymaga: zastąpienia ADR 0001
(zależność + krok budowania albo vendoring MapLibre ~800 KB), nowego ADR,
decyzji właściciela o rozmiarze payloadu na telefonie. Zysk: ładniejszy podkład
jasny (styl „positron/liberty") i brak ryzyka polityki OSM Tiles. Rozważyć
dopiero, gdy podkład rastrowy okaże się w terenie nieczytelny (M10).

## B16 — Prawdziwe szyfrowanie paczki kluczem z `kod gry`

Wraca, jeśli pojawi się potrzeba ochrony przed zdeterminowanym graczem albo przed
wyciekiem paczki z przyszłego repozytorium (ADR 0010, M9). Wymaga: nowego ADR
zastępującego ADR 0007, wariantu `kodowanie: "aes-gcm"` w kontenerze
`TO-paczka/2` (hak migracyjny już jest), `WebCrypto` (PBKDF2-SHA256 + AES-GCM,
secure context), migratora dla paczek `b64x1` i decyzji właściciela o utracie
paczki przy zapomnianym kodzie. Nie ruszać, dopóki obfuskacja wystarcza — koszt
to zarządzanie kluczami i realne ryzyko utraty treści.

- **B16 — migracja list z `innerHTML=''` na `replaceChildren` ✅ ZROBIONE (2026-09-08)**
  (LESSONS L19): w `app/app.js` nie zostało żadne żywe `innerHTML` — tryby,
  segmenty (wiek/poziom), tematy, selecty, lista stacji i lista usterek budują
  węzły. Przy okazji wyszła dziura: wiersz stacji wstawiał **nazwę z OSM**
  (`tags.name`) przez `innerHTML`, a komunikaty usterek cytują metadane paczki
  i odpowiedź mostu — wszystko, co zewnętrzne, idzie teraz przez `textContent`
  (LESSONS L34; test z wrogą nazwą w fixture Overpass).

## B17 — Trwały backend: Google Drive + Apps Script (konto wydzielone)

Pomysł właściciela (2026-09-06): skoro projekt jest dla właściciela i kilku
znajomych (zero skalowania), trwała pamięć, dane gier i użytkowników oraz
repozytorium użytych zestawów pytań mogą leżeć na Dysku **specjalnie
utworzonego konta Google**, a mostem do statycznego HTML byłby zestaw web
appów Apps Script (zapis/odczyt plików JSON przez `window.fetch`). Pełny
opis, ograniczenia (CORS/`text/plain`, limity, vendor risk) i alternatywy:
**ADR 0016 (Proponowana)**. Dotyka: M9 (repo paczek — naturalny moment
wdrożenia), ADR 0009 (ewentualna gra na kilku urządzeniach przez wspólny
plik stanu + polling — osobna rewizja ADR), ADR 0010 (trwałość), ekran
prywatności (nowy odbiorca danych = zgoda, wzorzec Nominatim z M5/J5).
Warunek wejścia: akceptacja ADR 0016 przez właściciela + spike techniczny
CORS/Apps Script; nie wcześniej niż po M8 (publikacja daje prawdziwy adres
— potrzebny do wdrożenia web appu).

**Aktualizacja 2026-09-06**: kierunek zaakceptowany (ADR 0016) i ROZSZERZONY
przez właściciela (ADR 0018): to samo konto Drive obsłuży też parowanie gier
wieloosobowych na wielu urządzeniach (M11) oraz profil/statystyki/score
gracza (M12). Repo paczek wdrażane w M9b; wdrożenie mostu przez właściciela
odroczone do końca kodowania, instrukcja finalna — w czacie.

## B18 — Mechanizm wzrostu lektury startowej ✅ ROZSTRZYGNIĘTY (2026-09-07)

Problem strukturalny po S5: każdy nowy ADR i każda lekcja POWIĘKSZAJĄ lekturę
startową (§0), a limit był stały — kondensacja dawała rezerwę ~1–2 sesji, potem
znowu przekroczenie. **Decyzja właściciela (2026-09-07): próg rośnie z 40 tys.
na 100 tys. tokenów** — „40k to za mało na taki duży projekt, nie ma sensu się
aż tak szczypać". Wdrożone: `LIMIT_TOKENOW = 100_000` w
`tools/budzet-lektury.mjs`, `AGENTS.md` §0, testy. Kondensacja dokumentów
przestaje być obowiązkowa przy każdym dopisku, ale zasada „reguła trafia tam,
gdzie jej miejsce" (`AGENTS.md` §5) zostaje; archiwizacja ADR-ów (wariant a)
i podział LESSONS (wariant c) wracają, gdy zbliżymy się do nowego progu.

## B19 — Geohash6 dla starych paczek: dopisanie w moście Drive ✅ ZROBIONE (2026-09-07)

Po ADR 0024 dopasowanie okolicy liczy odległość od komórki geohash paczki
z tolerancją 200 m. Nowe paczki niosą `geohash6` (≈0,75 × 0,61 km), ale pliki
opublikowane wcześniej mają tylko `geohash5` (≈3,0 × 4,9 km) — dla nich reguła
była zgrubna, więc paczka zakotwiczona 3 km dalej też się pokazywała.

**Wdrożone (ADR 0024 aneks, decyzje 6–8):** `budujIndeks` liczy dla wpisu bez
`meta.geohash6` kotwicę ze **środka ciężkości stacji** (nie z pierwszej stacji —
start leży w środku obszaru, pierwsza stacja bywa na skraju) i oznacza wpis
`geohash6Szacowany: true`; klient poszerza wtedy tolerancję o `promienM` paczki,
co daje dowód braku regresji (start w promieniu paczki od środka ciężkości
zawsze się dopasuje) i shrink nadmiarowego dopasowania z ~4 km do ~`promienM`.
Koder geohash w Apps Script (`geohashPunkt`) jest **testowany w tym
repozytorium**: `test/most-indeks.test.js` wykonuje wycięty tekst skryptu
i porównuje z `app/geo.js` na siatce >500 punktów.

**Zostało u właściciela:** wkleić nową wersję `apps-script-repo-paczek.gs`
w Apps Script i wdrożyć — bez tego stare paczki zostają przy dopasowaniu
zgrubnym (działają, tylko szerzej).

## B20 — Gra sieciowa bez tur: wolna kolejność stacji i premia za kolejność ✅ ZROBIONE (2026-09-07)

Wdrożone według ADR 0027 część B (rozliczenie projektu jest w tym ADR-ze,
pkt 7): `skierujDoStacji` + `stacjeDoWyboru` w silniku, `premiaZaKolejnosc`
i premia w `przeliczWyniki` po obu stronach (aplikacja i most), pytanie wg
indeksu gracza, lista stacji do wyboru, postęp `ile z ilu` i kolumna premii,
PROTOKOL §9, aneks ADR 0022, testy (w tym parity most ↔ aplikacja).

**Sprawdzone w B21**: budżet promptu i limit wklejenia dla `stacje × gracze`
pytań (8 graczy × 5 stacji = 40 pytań). Wyszło, że wąskim gardłem jest wyjście
modelu, a nie prompt ani pamięć — patrz B21 (zamknięte: dzielenia nie będzie).

## B21 — Duża paczka: budżet promptu i limit wklejenia ✅ ZAMKNIĘTE (2026-09-08)

**Zmierzone** (`test/duza-paczka.test.js`, PROTOKOL §2 „Budżet rozmiaru"):

| | 5 pytań (1 gracz) | 40 pytań (5 stacji × 8 graczy) |
|---|---|---|
| prompt | 5 422 zn / ~1 356 tok | 5 423 zn / ~1 356 tok (**stały**) |
| odpowiedź modelu | 4 469 zn / ~1 118 tok | 33 392 zn / ~8 348 tok |
| `parsujOdpowiedzModela` + `walidujPaczke` | OK, 0 usterek | OK, 0 usterek |
| kontener `TO-paczka/2` | 4,8 kB (0,2% stanu / 0,3% rejestru) | 35,6 kB (1,8% / 2,4%) |

Wniosek: **prompt i pamięć nie są problemem, jest nim limit wyjścia modelu**
(~210 tokenów na pytanie). Wdrożone: `szacunekOdpowiedzi()` +
`PROG_ODPOWIEDZI_TOKENY = 4000` w `app/protokol.js`, a ekran promptu pokazuje
przewidywany rozmiar odpowiedzi (`#prompt-rozmiar`) i ostrzega powyżej progu,
zanim właściciel zmarnuje generację (ucięty JSON wracał jako E01/E02 bez
wskazania przyczyny).

**Domknięte (2026-09-08, ADR 0031 — wycofana):** dzielenie generacji na partie
zostało najpierw wdrożone (`0b2ca68`), a tego samego dnia usunięte
(`git revert`). Powód: próg `PROG_ODPOWIEDZI_TOKENY = 4000` był moim
założeniem, nie pomiarem modeli właściciela. Właściciel używa modeli z limitem
wyjścia 64k–128k tokenów, a największy setup, jaki aplikacja pozwala zbudować
(12 stacji × 8 graczy = 96 pytań), to ~20 250 tokenów odpowiedzi — 3,2 raza
mniej niż 64k. Dzielenie nie odpaliłoby się przy żadnej dostępnej konfiguracji.

**Z B21 zostaje:** `szacunekOdpowiedzi()` ze stałymi pomiaru (~830 znaków
i ~210 tokenów na pytanie) oraz linia `#prompt-rozmiar` na ekranie pytań —
informuje o rozmiarze odpowiedzi przed generacją i nie blokuje niczego.
`PROG_ODPOWIEDZI_TOKENY` jest już tylko progiem tego ostrzeżenia.

## B22 — Wynik gry hot-seat na wspólnym Drive (per pseudonim) ✅ ZROBIONE (2026-09-07)

Gra na jednym telefonie zostawiała wynik tylko w historii telefonu: punkty
graczy nie wchodziły do rankingów, choć to te same pseudonimy co w grze
wieloosobowej.

**Wdrożone (ADR 0026 aneks, decyzja 3 właściciela):** nowa akcja mostu
`gra-hotseat` (PROTOKOL §9.6) — telefon wysyła skończoną grę jednym poleceniem,
most zapisuje ją jako `RO-gra/1` ze stanem `zakonczona`, więc `GET ranking`
czyta ją bez zmian. Punkty liczy most (`przeliczWyniki`), premia za kolejność
w hot-seat = 0, `zestaw: null` (paczka zostaje na telefonie), `geohash5` startu
zamiast współrzędnych. Wysyłka jest domyślna (bez pytania przy każdej grze —
decyzja 2026-09-07, opis w sekcji prywatność) i wymaga choć jednego gracza
potwierdzonego profilem; bez sieci polecenie czeka w kolejce i jedzie przy
następnym starcie, a odcisk gry pilnuje idempotencji.
Testy: 3 w `test/aplikacja.test.js` (wysyłka, kolejka offline, brak zgody),
3 w `test/most-gra.test.js` na atrapie Drive (zapis + rankingi, kasowanie
współrzędnych i odmowy, parity premii).
