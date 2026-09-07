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
skopiujesz.

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

## 4. Podłączenie aplikacji

1. **Repozytorium paczek**: w grze ekran „Gdzie jesteś?" → karta „📦 Paczki…"
   → **Źródło repozytorium (zaawansowane)** → wklej adres z kroku 3 → „Zapisz
   źródło i odśwież" (albo „🔌 Sprawdź połączenie" — jawna próba mostu).
   Zgoda na wysyłkę zestawu jest checkboxem na ekranie wklejania odpowiedzi
   modelu („📤 Wyślij ten zestaw na Drive…"), domyślnie zaznaczonym — bez niej
   aplikacja niczego nie wyśle.
2. **Gra wieloosobowa i rankingi**: Ustawienia gry → Rodzaj gry „Gra na wielu
   urządzeniach" → w karcie multi wklej TEN SAM adres w „Adres mostu
   (Apps Script)" → „Zapisz". Jeden web app obsługuje paczki i gry (ADR 0018).

## 5. Test końcowy paczek (kryterium M9b)

1. Zagraj jedną grę z modelem (albo wklej gotową paczkę) i kliknij
   „✓ Sprawdź i przyjmij" — pasek stanu powie „wysłano na Drive" (albo
   dlaczego nie).
2. Na Drive pojawi się plik w `okolica-paczki-do-przegladu`, a na Twoim
   e-mailu wiadomość z linkiem „Podgląd i akceptacja".
3. Otwórz link (telefon wystarczy): zobaczysz pytania z odpowiedziami,
   wyjaśnieniami i źródłami → sprawdź źródła i miejsca stacji (ADR 0008 pkt 6)
   → **✔ Zaakceptuj**.
4. Drugi telefon (albo ten sam po czyszczeniu karty propozycji): setup
   kompatybilny (ta sama okolica, liczby stacji i pytań, poziom, tematy nie
   szersze) → karta pokaże paczkę z repozytorium → gra bez modelu.

## 5b. Test końcowy gier wieloosobowych (kryterium M11/M12)

Pełna checklista terenowa: `docs/WORKFLOW.md` §4.4 (8 punktów, dwa telefony).
Skrót:

1. Telefon A: Ustawienia → rodzaj „wieloosobowa" → pseudonim, zgoda, adres
   mostu → „🌐 Załóż grę" → tryb, źródło paczki → „🚀 Zakładam" → zapisz kod
   z lobby.
2. Telefon B: pseudonim + adres mostu → „🔗 Dołącz" → wpisz kod (albo wybierz
   grę z listy „w okolicy") → oba telefony widzą się w lobby.
3. A: „▶ Start gry" → oboje: odcinek → dojście → pytanie → odpowiedź; tabela
   wyników drugiego gracza odświeża się w ~12 s.
4. Po zakończeniu: nagłówek „🏆 rankingi" → ogólny / wiek / tematy /
   lokalizacja + „Moje gry".
5. Na Drive w `okolica-gry-zakonczone` leży plik gry (kod w nazwie) — pełna
   historia zdarzeń BEZ współrzędnych graczy (możesz otworzyć i sprawdzić).

## Awaryjnie

- Zmieniłeś coś w skrypcie → **Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa
  wersja**; adres `/exec` zostaje ten sam.
- Link przeglądu wycieknie? Zmień `REVIEW_SECRET` we właściwościach skryptu
  (stare linki przestaną działać).
- Paczka omyłkowo zaakceptowana: na Drive przeciągnij plik z
  `…-zaakceptowane` do `…-odrzucone` — zniknie z indeksu natychmiast.
