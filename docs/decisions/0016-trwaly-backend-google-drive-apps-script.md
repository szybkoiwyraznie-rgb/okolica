# 0016 — Trwały backend: Google Drive + Apps Script na wydzielonym koncie

- Status: Zaakceptowana jako kierunek (2026-09-06: właściciel potwierdził, że repozytorium paczek wymaga Google Drive; wdrożenie po spike’u CORS, wpisie w ASSETS i ekranie zgody; pierwotnie: pomysł właściciela z 2026-09-06; kierunek dla M9
  „repozytorium paczek" i ewentualnej rewizji ADR 0009 — gra na kilku
  urządzeniach. Nie budować na tej decyzji trwałych rozwiązań przed
  akceptacją właściciela.)
- Data: 2026-09-06

## Kontekst

Właściciel: projekt **nie będzie dystrybuowany szeroko** — korzysta on sam
i kilku znajomych, więc problem skalowania nie istnieje. W związku z tym
trwała pamięć, dane o grach i użytkownikach oraz zestawy użytych pytań
(repozytorium paczek, ADR 0010 pkt 4 / M9) mogą lądować na **specjalnie
utworzonym koncie Google**, na jego Dysku. Mostem między statyczną
aplikacją (ADR 0001: zero zależności, zero backendu do utrzymania) a Dyskiem
byłby zestaw skryptów **Google Apps Script** wdrożonych jako web appy:
przyjmują JSON przez `doPost`/`doGet`, czytają i zapisują pliki na Dysku,
a aplikacja HTML woła je zwykłym `window.fetch`.

Stan wyjściowy: trwałość to wyłącznie `localStorage` jednego telefonu (ADR 0010),
a model wieloosobowy to hot-seat (ADR 0009) — wspólny stan na Dysku to najtańsza
droga do gry na kilku urządzeniach bez własnej infrastruktury.

## Decyzja (proponowana)

1. **Wydzielone konto Google** — nie osobiste konto właściciela. Izolacja:
   dane gry, limity Dysku i ewentualny wyciek tokenu nie dotykają danych
   osobistych; konto służy wyłącznie tej aplikacji.
2. **Apps Script jako jedyne API** — kilka web appów (np. „katalog paczek",
   „stan gry"), każdy jako cienka funkcja: walidacja żądania → operacja na
   plikach Drive → JSON z powrotem. Kod skryptów jest wersjonowany
   w Apps Script, a ich **kopie kanoniczne leżą w `docs/setup/appsscript/`**
   w repozytorium (jak `ci-workflow.yml`, LESSONS L4) — repo pozostaje
   źródłem prawdy.
3. **Autoryzacja: token współdzielony, nie konta graczy.** Web app
   wdrożony jako „ktokolwiek z linkiem" + własny sekret (token) wysyłany
   w żądaniu. Token konfiguruje organizator raz (ekran prywatności, wzorzec
   klucza `okolica:geokodacja-endpoint` z M5/J5), przechowuje
   `localStorage`. Brak logowania, brak danych osobowych graczy poza
   imionami z konfiguracji — spójne z ADR 0006 (bez kluczy API w kodzie
   aplikacji) i ADR 0013 (minimum danych).
4. **Formaty danych = te, które już mamy:** paczki wyłącznie jako kontener
   `TO-paczka/2` (`.paczka.json` z M5/J4 — na Dysku nie ląduje plaintext,
   ADR 0007/0010 pkt 3); stan gry jako `rozgrywka/1` (`SCHEMAT_ROZGRYWKI`
   z M1) + konfiguracja `konfig/1`; katalog jako plik indeksu JSON.
5. **Local-first:** warstwa zdalna jest **dodatkiem**, nie wymaganiem —
   cała komunikacja przez jeden moduł czystych funkcji (`app/zdalne.js`:
   budowa żądań, parsowanie odpowiedzi, kody błędów Z01–Z…), a brak sieci,
   brak tokena albo niedostępność Apps Script degraduje grę do dzisiejszego
   `localStorage` **jawnie** (wzorzec degradacji z ADR 0005 pkt 8).
6. **Gra na kilku urządzeniach** (rewizja ADR 0009) osobną decyzją: plik
   stanu jako źródło prawdy + polling (co 3–5 s w trakcie odcinka), bez
   web socketów — Apps Script nie daje połączeń trwałych. Nie wcześniej niż
   po M9 i tylko jako nowa wersja ADR 0009.

## Ograniczenia techniczne (do zweryfikowania przed implementacją)

- **CORS:** odpowiedź Apps Script nie niesie nagłówków CORS sterowalnych —
  żądania POST wysyłamy z `Content-Type: text/plain` (bez preflightu),
  JSON w ciele; odpowiedź przeglądarka przeczyta tylko przy wdrożeniu
  „anyone". Alternatywa: GET z parametrami. Spike techniczny (R-spike) przed
  pierwszym kodem.
- **Limity:** czas wykonania web appu (sekundy–minuty), dzienne limity
  wywołań i triggerów — dla kilku osób zapas jest ogromny, ale polling
  stanu gry musi mieć budżet (jak ASSETS §2 dla Overpass).
- **Vendor risk:** Google może zmienić Apps Script/quota — dlatego
  `zdalne.js` jest cienkie i wymienne, a dane mają formaty lokalne
  (eksport/import pliku z J4 działa bez Dysku).

## Konsekwencje

- Nowy zewnętrzny odbiorca danych → przed wdrożeniem: wpis w `docs/ASSETS.md`
  (polityka, dane wysyłane), zgoda użytkownika na ekranie „dane
  i prywatność" (wzorzec Nominatim z M5/J5: domyślnie WYŁĄCZONE) oraz
  akceptacja tego ADR przez właściciela.
- Zero kosztów i zero utrzymania serwera; właściciel kontroluje dane
  (podgląd/eksport/kasowanie na Dysku wydzielonego konta).
- Ścieżka do M9 (repo paczek: współdzielenie zestawów pytań między grami
  i organizatorami) i do gry wielourządzeniowej bez naruszania ADR 0001.
- Testy: `zdalne.js` czyste i testowalne na atrapie `window.fetch`
  (LESSONS L18); skrypty Apps Script poza CI — ich kopie w repo z testem
  kontraktu (dokument ↔ kod).

## Alternatywy

- **Własny serwer/VPS** — koszt i utrzymanie przy kilku użytkownikach
  nieuzasadnione.
- **Firebase/Supabase** — klucze w frontendzie, zewnętrzne SDK albo
  rozbudowany REST, kolejny dostawca tożsamości; więcej zależności niż
  ADR 0001 dopuszcza w duchu (choć technicznie bez bibliotek się da).
- **Repozytorium GitHub jako skład paczek** — zapis wymagałby tokenu write
  w aplikacji (wyciek natychmiastowy); wariant read-only (raw URL) wart
  rozważenia w M9 jako **uzupełnienie** dla publicznych paczek kuratorowanych.
- **Tylko localStorage + pliki (status quo)** — wystarcza jednemu
  organizatorowi, ale nie daje współdzielenia paczek ani gry na kilku
  urządzeniach.

## Decyzja właściciela (2026-09-06, dopisane po M9)

Współdzielone repozytorium zestawów pytań („paczek") żyje na **wydzielonym
koncie Google Drive**, z mostem Apps Script, w przepływie:

1. gra wygenerowana z modelem kończy się zestawem pytań ze źródłami;
2. zestaw **trafia na Drive** (katalog „do przeglądu");
3. właściciel **ocenia** zestaw (źródła, miejsca stacji, brak danych osobowych);
4. po **zaakceptowaniu** zestaw staje się dostępny dla kompatybilnych gier.

Kompatybilność (kryteria właściciela, wdrożone w `app/zestawy.js` 2026-09-06):
ta sama **lokalizacja** (geohash5), ta sama **liczba pytań** i **liczba stacji**,
ten sam **poziom** (wiek), **zakres tematyczny nie szerszy** niż wybrany
w setupie oraz promień paczki ≤ promienia z setupu (stacje bliżej = uczciwie,
dalej = nie). Kryteria obowiązują każde źródło propozycji: pamięć telefonu,
Drive i indeks offline w repo.

## Aneks (2026-09-06): zgoda na wysyłkę — korekta właściciela

Zgoda żyje na ekranie wklejania odpowiedzi AI jako checkbox
`<input id="zgoda-drive" type="checkbox" checked>` — DOMYŚLNIE ZAZNACZONY
(opt-out): właściciel (jedyny użytkownik) chce wysyłki bez dodatkowego kroku,
ale z możliwością odhaczenia, gdy zestaw ma zostać tylko na telefonie.
Wcześniejszy pomysł jednorazowej zgody opt-in w karcie prywatności — odrzucony.
Bez zgody albo bez adresu mostu: zero wysyłek i jawny status (LESSONS L6).

## Aneks (2026-09-07): adres mostu jest w kodzie aplikacji, nie w UI (ADR 0020)

Właściciel zdecydował, że adres web app nie jest konfigurowany przez
użytkownika: trafia do repozytorium jako stała `DOMYSLNY_URL_MOSTU`
w `app/most.js`, a pola „Źródło repozytorium (zaawansowane)" i „Adres mostu
(Apps Script)" znikają z interfejsu. Powód: w grze wieloosobowej (ADR 0019)
każdy telefon uczestnika rozmawia z mostem sam, więc adres musiałby być
wklejony na każdym urządzeniu z osobna. Konsekwencja dla ryzyk tego ADR-u:
adres jest publiczny jak cały kod aplikacji (repo publiczne — wymóg Pages),
więc „zdolność" (capability) może trafić w obce ręce; reakcją jest nowe
wdrożenie web app (nowy adres `/exec`) i nowy commit ze stałą, a nie zmiana
logiki mostu. Próba CORS z pkt. „Ograniczenia techniczne" zostaje
w interfejsie jako przycisk „🔌 Sprawdź połączenie" i jawny stan mostu
(`#most-stan-repo`, `#multi-most-stan`). Reguła „bez zgody albo bez adresu
mostu: zero wysyłek i jawny status" obowiązuje bez zmian — „brak adresu"
oznacza teraz pustą stałą w tej wersji aplikacji.
