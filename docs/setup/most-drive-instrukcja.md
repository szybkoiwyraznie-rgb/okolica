# Most Drive dla repozytorium paczek — wdrożenie krok po kroku

Cel: zestawy pytań po grze same trafiają na Twój wydzielony dysk Google Drive,
Ty akceptujesz je jednym kliknięciem z e-maila, a gracze pobierują wyłącznie
zaakceptowane. Aplikacja nie zna żadnych haseł ani kluczy — zna tylko adres
web app, który poniżej skopiujesz.

Czas: ~15 minut, jednorazowo. Potrzebne: wydzielone konto Google (ADR 0016)
i przeglądarka z dostępem do aplikacji (może być telefon).

## 1. Konto i katalogi

1. Zaloguj się w przeglądarce na **wydzielone konto Google** (to samo, które
   ma być mostem do Drive).
2. Katalogi (`okolica-paczki-do-przegladu`, `…-zaakceptowane`, `…-odrzucone`)
   skrypt założy sam przy pierwszym uruchomieniu — nic nie klikaj w Drive.

## 2. Skrypt

1. Wejdź na [script.google.com](https://script.google.com) → **Nowy projekt**.
2. Usuń domyślną zawartość edytora i wklej cały plik
   `docs/setup/apps-script-repo-paczek.gs` z tego repozytorium.
3. Zapisz (💾). Nazwij projekt np. „okolica-most-paczek".
4. **Ustawienia projektu (ikona ⚙ po lewej) → Właściwości skryptu → Dodaj**:
   - `OWNER_EMAIL` = Twój e-mail na tym koncie,
   - `REVIEW_SECRET` = dowolny długi ciąg znaków (np. 20 losowych liter i cyfr;
     to on chroni linki przeglądu — nie pokazuj go nikomu).
5. W edytorze z listy funkcji wybierz `setup` → **Uruchom** → przy pierwszym
   uruchomieniu Google poprosi o zgody dla skryptu (Drive, e-mail) — zaakceptuj
   („Zezwól"). Funkcja założ trzy katalogi na Drive.

## 3. Wdrożenie web app

1. Przycisk **Wdróż → Nowe wdrożenie** → typ: **Aplikacja internetowa**.
2. „Wykonuj jako": **Ja**; „Kto ma dostęp": **Każdy użytkownik** (anonimowo) —
   bez tego gracze nie pobiorą indeksu; dostęp chronią wyłącznie adres URL
   i token przeglądu (świadoma decyzja prostoty, ADR 0016).
3. Skopiuj adres web app (kończy się na `/exec`).

## 4. Podłączenie aplikacji

1. W grze: ekran „Gdzie jesteś?" → karta „📦 Paczki…" → **Źródło
   repozytorium (zaawansowane)** → wklej adres z kroku 3 → „Zapisz źródło
   i odśwież". Status karty potwierdzi połączenie (albo powie wprost, co jest
   nie tak — to też Twój instrument testowy spike’u CORS z planu M9b/D4).
2. Zgoda prywatności: ekran „Dane i prywatność" → sekcja Drive → „Zgadzam się"
   (bez zgody aplikacja niczego nie wyśle — patrz ADR 0013 pkt 7).

## 5. Test końcowy (kryterium M9b)

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

## Awaryjnie

- Zmieniłeś coś w skrypcie → **Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa
  wersja**; adres `/exec` zostaje ten sam.
- Link przeglądu wycieknie? Zmień `REVIEW_SECRET` we właściwościach skryptu
  (stare linki przestaną działać).
- Paczka omyłkowo zaakceptowana: na Drive przeciągnij plik z
  `…-zaakceptowane` do `…-odrzucone` — zniknie z indeksu natychmiast.
