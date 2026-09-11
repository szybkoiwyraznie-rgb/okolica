# Most Drive (paczki + gry wieloosobowe + rankingi) — wdrożenie krok po kroku

> Wersja robocza w repozytorium (ADR 0018 pkt 3: finalna instrukcja jest
> wyświetlana właścicielowi w czacie — ten plik jest jej źródłem i kopią
> zapasową dla przyszłych sesji).

Cel: JEDEN web app na Twoim wydzielonym koncie Google obsługuje trzy rzeczy
(ADR 0016/0018/0019): (1) zestawy pytań po grze same trafiają na Drive —
OD RAZU do katalogu zaakceptowanych, bez sesji przeglądu i bez maili
(decyzja właściciela 2026-09-11); o jakości paczek rozstrzygają łapki
graczy (ADR 0028), a niechcianą paczkę wyłączasz z obiegu ręcznie,
przeciągając plik do katalogu odrzuconych; (2) gry wieloosobowe na wielu
urządzeniach — lobby, kody,
wyścig i tury, stan gry na Drive; (3) rankingi z zakończonych gier. Aplikacja
nie zna żadnych haseł ani kluczy — zna tylko adres web app, który poniżej
skopiujesz i podasz w czacie: trafi do kodu aplikacji (ADR 0020), więc żadne
urządzenie nie będzie go wpisywać ręcznie.

Czas: ~15 minut, jednorazowo. Potrzebne: wydzielone konto Google (ADR 0016)
i przeglądarka z dostępem do aplikacji (może być telefon).

## 1. Konto i katalogi

1. Zaloguj się w przeglądarce na **wydzielone konto Google** (to samo, które
   ma być mostem do Drive).
2. Katalogi (`okolica-paczki-zaakceptowane`, `okolica-paczki-odrzucone`
   oraz `okolica-gry-otwarte`, `okolica-gry-zakonczone`) skrypt założy sam przy
   pierwszym uruchomieniu — nic nie klikaj w Drive.

## 2. Skrypt

1. Wejdź na [script.google.com](https://script.google.com) → **Nowy projekt**.
2. Usuń domyślną zawartość edytora i wklej cały plik
   `docs/setup/apps-script-repo-paczek.gs` z tego repozytorium.
3. Zapisz (💾). Nazwij projekt np. „okolica-most" (paczki + gry).
4. W edytorze z listy funkcji wybierz `setup` → **Uruchom** → przy pierwszym
   uruchomieniu Google poprosi o zgody dla skryptu (Drive) — zaakceptuj
   („Zezwól"). Funkcja założy cztery katalogi na Drive (dwa na paczki, dwa na
   gry). Od 2026-09-11 skrypt NIE potrzebuje żadnych właściwości (czasy
   przeglądu paczek z mailami minęły).

## 3. Wdrożenie web app

1. Przycisk **Wdróż → Nowe wdrożenie** → typ: **Aplikacja internetowa**.
2. „Wykonuj jako": **Ja**; „Kto ma dostęp": **Każdy użytkownik** (anonimowo) —
   bez tego gracze nie pobiorą indeksu; dostęp chroni wyłącznie adres URL
   (świadoma decyzja prostoty, ADR 0016).
3. Skopiuj adres web app (kończy się na `/exec`).

## 4. Podłączenie aplikacji (ADR 0020: adres żyje w kodzie, nie w interfejsie)

Adres web app wpisuje się w REPOZYTORIUM, nie w aplikacji — dzięki temu każdy
telefon (Twój i każdego znajomego) działa bez konfigurowania czegokolwiek.
Pola wpisywania adresu zostały z interfejsu usunięte decyzją właściciela.

1. **Podaj adres z kroku 3 w czacie** agentowi — trafia do stałej
   `DOMYSLNY_URL_MOSTU` w `app/most.js`, jednym commitem z podbiciem
   cache-bustingu (`?v=` w `index.html` i we wszystkich importach `app/*.js`
   oraz `WERSJA_SW` w `sw.js`; spójności pilnuje `test/kontrakt.test.js`).
2. **Scal do `main`**: GitHub Pages serwuje `main` (ADR 0002), więc adres
   zacznie działać na telefonach dopiero po scaleniu i przebudowaniu strony
   (~1–2 min).
3. **Sprawdź stan w aplikacji**: karta „📦 Paczki dla tej okolicy" i karta gry
   wieloosobowej pokazują „Most Drive: podłączony — adres jest wpisany w tej
   wersji aplikacji". Przycisk „🔌 Sprawdź połączenie" robi jawną próbę CORS na
   żywym wdrożeniu (ADR 0016). Stan „niepodłączony" znaczy, że ta wersja
   aplikacji adresu jeszcze nie ma.
4. **Jeden adres, trzy zadania** (ADR 0018): repozytorium paczek, gry
   wieloosobowe i rankingi. Zgoda na wysyłkę zestawu jest checkboxem na ekranie
   wklejania odpowiedzi modelu, domyślnie zaznaczonym — bez niej aplikacja
   niczego nie wyśle.
5. **Awaryjnie, bez nowej wersji aplikacji**: adres można nadpisać w pamięci
   JEDNEGO telefonu (konsola przeglądarki:
   `localStorage.setItem('okolica:multi:url-mostu', '<adres>')`). Interfejs
   celowo nie ma do tego pola (ADR 0020 pkt 2–3); „Kasuj dane" w ustawieniach
   przywraca adres z kodu.

## 5. Test końcowy paczek (kryterium M9b)

1. Zagraj jedną grę z modelem (albo wklej gotową paczkę) — paczka przyjmuje
   się sama po wklejeniu; pasek stanu powie „WYSŁANA na Drive: dostępna od
   razu w zestawach" (albo dlaczego nie).
2. Na Drive plik pojawi się OD RAZU w `okolica-paczki-zaakceptowane` —
   żadnego maila i żadnego klikania akceptacji (decyzja 2026-09-11).
   Chcesz podejrzeć pytania? Otwórz plik na Drive — pytania, odpowiedzi,
   wyjaśnienia i źródła są w środku (kontrola należy do Ciebie, ale na
   Twoich zasadach i w Twoim czasie).
3. Drugi telefon (albo ten sam po czyszczeniu karty propozycji): setup
   kompatybilny (ta sama okolica, liczby stacji i pytań, poziom, tematy nie
   szersze) → karta pokaże paczkę z repozytorium → gra bez modelu.
4. O jakości paczki rozstrzygają łapki graczy (👍👎 przy pytaniu, ADR 0028) —
   statystyki widzi każdy przy wyborze paczki. Paczka Ci się nie podoba?
   Przeciągnij plik do `okolica-paczki-odrzucone` — zniknie z indeksu
   natychmiast.

## 5b. Test końcowy gier wieloosobowych (kryterium M11/M12)

Pełna checklista terenowa: `docs/WORKFLOW.md` §4.4 (8 punktów, dwa telefony).
Skrót:

1. Telefon A: Ustawienia → rodzaj „wieloosobowa" → pseudonim →
   „🌐 Załóż grę" → tryb, źródło paczki → „🚀 Zakładam" → zapisz kod z lobby.
2. Telefon B: sam pseudonim (adres mostu jest w kodzie aplikacji — ADR 0020) →
   „🔗 Dołącz" → wpisz kod (albo wybierz grę z listy „w okolicy") → oba
   telefony widzą się w lobby.
3. A: „▶ Start gry" → oboje: odcinek → dojście → pytanie → odpowiedź; tabela
   wyników drugiego gracza odświeża się w ~12 s.
4. Po zakończeniu: nagłówek „🏆 rankingi" → ogólny / wiek / tematy /
   lokalizacja + „Moje gry".
5. Na Drive w `okolica-gry-zakonczone` leży plik gry (kod w nazwie) — pełna
   historia zdarzeń BEZ współrzędnych graczy (możesz otworzyć i sprawdzić).

## Awaryjnie

- Zmieniłeś coś w skrypcie → **Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa
  wersja**; adres `/exec` zostaje ten sam.
- Aktualizacja do PIN-profili (Partia 1): wklej nową treść
  `docs/setup/apps-script-repo-paczek.gs`, uruchom raz funkcję `setup`
  (zakłada katalog `okolica-profile`), potem Wdróż → Nowa wersja. Test:
  ekran 1 → wpisz nowe imię i PIN → „Dalej" → w `okolica-profile` na Drive
  leży plik `profil-….json`.
- Aktualizacja do wyniku hot-seat (B22, ADR 0026 aneks): wklej nową treść
  `docs/setup/apps-script-repo-paczek.gs` i Wdróż → Nowa wersja (`setup` nie jest
  potrzebny — katalogi już istnieją). Nowa akcja `gra-hotseat` zapisuje grę
  z jednego telefonu w `okolica-gry-zakonczone`, więc rankingi widzą ją od razu.
  Test: zagraj grę na jednym telefonie z dodanym graczem (imię + PIN) → po
  zakończeniu pod wynikiem pojawi się „☁ Wynik jest na wspólnym Drive" (zapis
  jest domyślny, bez pytania o zgodę), a na Drive przybędzie plik
  `gra-hotseat-….json`; rankingi pokażą punkty tych pseudonimów.
- Aktualizacja do kotwicy geohash6 (B19, ADR 0024 aneks) i premii za kolejność
  (ADR 0027 część B): wklej nową treść skryptu i Wdróż → Nowa wersja (funkcji
  `setup` uruchamiać nie trzeba). Test: otwórz `<adres>/exec?akcja=indeks` —
  każdy wpis ma `geohash6` (6 znaków), a paczki sprzed ADR 0024 także
  `geohash6Szacowany: true`. Bez tego kroku stare paczki dalej dopasowują się
  zgrubnie (geohash5 ≈ 3 × 5 km), a wyniki gier nie zawierają premii
  za kolejność ukończenia (telefon pokazuje ją i tak — liczy ją aplikacja).
- **Aktualizacja do paczek bez akceptacji (decyzja właściciela 2026-09-11)**:
  wklej nową treść `docs/setup/apps-script-repo-paczek.gs` i **Wdróż →
  Zarządzaj wdrożeniami → Edytuj → Nowa wersja** (funkcji `setup` uruchamiać
  nie trzeba). Potem sprzątnij Drive: jeśli w `okolica-paczki-do-przegladu`
  czekają jeszcze jakieś pliki, przenieś je do
  `okolica-paczki-zaakceptowane` (albo do `…-odrzucone`, jeśli nie chciesz
  ich udostępniać) i skasuj pusty katalog `okolica-paczki-do-przegladu` —
  nowy skrypt nigdy go nie założy. Właściwości skryptu `OWNER_EMAIL`,
  `REVIEW_SECRET` i `URL_SERWISU` są zbędne — możesz je usunąć
  (Ustawienia projektu → Właściwości skryptu). Od tej wersji paczki lądują
  w zaakceptowanych od razu, bez maili.
- Paczka do usunięcia z obiegu (jakość, błąd, duplikat okolicy): na Drive
  przeciągnij plik z `…-zaakceptowane` do `…-odrzucone` — zniknie z indeksu
  natychmiast. To Twoja ręczna kontrola jakości zamiast dawnej sesji
  przeglądu.
- **W `okolica-gry-zakonczone` leży mnóstwo plików `gra-hotseat-*`?**
  (zgłoszenie 2026-09-11, drugie) Dwie przyczyny, obie naprawione w m12-67:
  1) testy w repozytorium kończyły grę PRAWDZIWYM żądaniem na ten most —
  CI ma pełny internet, więc każdy run testów dokładał pliki z grami
  testowymi („Gracz 1/2/3", miejsce „nieznane miejsce"); od m12-67 testy
  mają hermetyczną sieć i nie wychodzą na zewnątrz;
  2) odświeżenie strony + „Wznów grę" ZAKOŃCZONEJ gry wysyłało wynik
  drugi raz (każde wznowienie przesuwało znacznik startu gry, więc most
  brał tę samą grę za nową) — od m12-67 wznowienie zakończonej gry nie
  wysyła nic.
  Sprzątanie: na Drive usuń zbędne pliki `gra-hotseat-*.json` — zostaw
  po jednym dla RZECZYWISTYCH rozgrywek (testowe poznasz po graczy
  „Gracz 1, Gracz 2, Gracz 3" i miejscu „nieznane miejsce"). Rankingi
  liczą się z plików przy każdym otwarciu, więc po usunięciu śmieci
  wyniki same się prostują.
- Adres wyciekł albo ktoś nadużywa mostu (fałszywe paczki, śmieciowe gry,
  zużycie limitu): **Wdróż → Nowe wdrożenie** daje NOWY adres `/exec` — podaj
  go w czacie (nowy commit ze stałą `DOMYSLNY_URL_MOSTU`), a stare wdrożenie
  usuń. Uwaga: nowa WERSJA tego samego wdrożenia adresu NIE zmienia.
