# Most Drive (paczki + gry wieloosobowe + rankingi) — wdrożenie krok po kroku

> Wersja robocza w repozytorium (ADR 0018 pkt 3: finalna instrukcja jest
> wyświetlana właścicielowi w czacie — ten plik jest jej źródłem i kopią
> zapasową dla przyszłych sesji).

Cel: JEDEN web app na Twoim wydzielonym koncie Google obsługuje trzy rzeczy
(ADR 0016/0018/0019): (1) zestawy pytań po grze same trafiają na Drive, Ty
akceptujesz je jednym kliknięciem z e-maila, a gracze pobierają wyłącznie
zaakceptowane; (2) gry wieloosobowe na wielu urządzeniach — lobby, kody,
wyścig i tury, stan gry na Drive; (3) rankingi z zakończonych gier. Aplikacja
nie zna żadnych haseł ani kluczy — zna tylko adres web app, który poniżej
skopiujesz i podasz w czacie: trafi do kodu aplikacji (ADR 0020), więc żadne
urządzenie nie będzie go wpisywać ręcznie.

Czas: ~15 minut, jednorazowo. Potrzebne: wydzielone konto Google (ADR 0016)
i przeglądarka z dostępem do aplikacji (może być telefon).

## 1. Konto i katalogi

1. Zaloguj się w przeglądarce na **wydzielone konto Google** (to samo, które
   ma być mostem do Drive).
2. Katalogi (`okolica-paczki-do-przegladu`, `…-zaakceptowane`, `…-odrzucone`
   oraz `okolica-gry-otwarte`, `okolica-gry-zakonczone`) skrypt założy sam przy
   pierwszym uruchomieniu — nic nie klikaj w Drive.

## 2. Skrypt

1. Wejdź na [script.google.com](https://script.google.com) → **Nowy projekt**.
2. Usuń domyślną zawartość edytora i wklej cały plik
   `docs/setup/apps-script-repo-paczek.gs` z tego repozytorium.
3. Zapisz (💾). Nazwij projekt np. „okolica-most" (paczki + gry).
4. **Ustawienia projektu (ikona ⚙ po lewej) → Właściwości skryptu → Dodaj**:
   - `OWNER_EMAIL` = Twój e-mail na tym koncie,
   - `REVIEW_SECRET` = dowolny długi ciąg znaków (np. 20 losowych liter i cyfr;
     to on chroni linki przeglądu — nie pokazuj go nikomu).
5. W edytorze z listy funkcji wybierz `setup` → **Uruchom** → przy pierwszym
   uruchomieniu Google poprosi o zgody dla skryptu (Drive, e-mail) — zaakceptuj
   („Zezwól"). Funkcja założy pięć katalogów na Drive (trzy na paczki, dwa na gry).

## 3. Wdrożenie web app

1. Przycisk **Wdróż → Nowe wdrożenie** → typ: **Aplikacja internetowa**.
2. „Wykonuj jako": **Ja**; „Kto ma dostęp": **Każdy użytkownik** (anonimowo) —
   bez tego gracze nie pobiorą indeksu; dostęp chronią wyłącznie adres URL
   i token przeglądu (świadoma decyzja prostoty, ADR 0016).
3. Skopiuj adres web app (kończy się na `/exec`).
4. **Wróć do Ustawień projektu (⚙) → Właściwości skryptu → Dodaj**:
   `URL_SERWISU` = ten skopiowany adres (razem z `https://` i `/exec`).
   Skrypt wstawia go do linków przeglądu w mailach — bo `getUrl()` Apps Script
   bywa zawodny (zgłoszenie 2026-09-11: link z maila otwierał stronę Google
   „Nie udało się otworzyć pliku"; po każdej ZMIANIE wdrożenia na nowy adres
   zaktualizuj też tę właściwość).

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

1. Zagraj jedną grę z modelem (albo wklej gotową paczkę) i kliknij
   „✓ Sprawdź i przyjmij" — pasek stanu powie „wysłano na Drive" (albo
   dlaczego nie).
2. Na Drive pojawi się plik w `okolica-paczki-do-przegladu`, a na Twoim
   e-mailu wiadomość z linkiem „Podgląd i akceptacja".
3. Otwórz link (telefon wystarczy): zobaczysz pytania z odpowiedziami,
   wyjaśnieniami i źródłami → sprawdź źródła i miejsca stacji (ADR 0008 pkt 6)
   → **✔ Zaakceptuj**. Gdyby link nie otwierał strony przeglądu, w tym samym
   mailu jest link awaryjny do pliku na Dysku i instrukcja ręcznej akceptacji
   (przeniesienie pliku do folderu `…-zaakceptowane`).
4. Drugi telefon (albo ten sam po czyszczeniu karty propozycji): setup
   kompatybilny (ta sama okolica, liczby stacji i pytań, poziom, tematy nie
   szersze) → karta pokaże paczkę z repozytorium → gra bez modelu.

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
- Link przeglądu wycieknie? Zmień `REVIEW_SECRET` we właściwościach skryptu
  (stare linki przestaną działać).
- **Link z maila pokazuje „Nie udało się otworzyć pliku. Sprawdź adres
  i spróbuj ponownie."?** To strona błędu Google, nie aplikacji — znana
  usterka Apps Script: `getUrl()` zwraca adres `/dev` albo adres starego
  wdrożenia. Naprawa: we **Właściwościach skryptu** ustaw `URL_SERWISU`
  na obecny adres `/exec` (krok 3.4) i przyślij paczkę ponownie — mail
  wyjdzie z dobrym linkiem. Paczkę, która czeka, zaakceptuj ręcznie:
  na Drive przenieś plik z `okolica-paczki-do-przegladu` do
  `okolica-paczki-zaakceptowane` (odrzucona → `…-odrzucone`) — to samo robią
  przyciski przeglądu.
- Aktualizacja do odpornego linku przeglądu (zgłoszenie 2026-09-11):
  wklej nową treść `docs/setup/apps-script-repo-paczek.gs`, we właściwościach
  skryptu dodaj `URL_SERWISU` = obecny adres `/exec` (krok 3.4), potem
  **Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa wersja**. Od tej wersji
  mail niesie też awaryjny link do pliku na Dysku i `setup()` przypomina
  o brakujących właściwościach.
- Paczka omyłkowo zaakceptowana: na Drive przeciągnij plik z
  `…-zaakceptowane` do `…-odrzucone` — zniknie z indeksu natychmiast.
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
