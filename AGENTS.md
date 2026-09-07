# AGENTS.md — zasady pracy w repozytorium „Tajemnicza Okolica"

> **To jest plik startowy każdej sesji.** Runner (Arena i każdy inny) wczytuje
> ten plik jako pierwszy, niezależnie od treści wiadomości startowej właściciela.
> Nie odpowiadaj właścicielowi i nie otwieraj ankiety o zadanie, zanim nie
> wykonasz bloku §0.

Projekt: **Tajemnicza Okolica** — terenowa gra quizowa jako statyczna aplikacja
(vanilla HTML+JS+CSS, bez kroku budowania, bez zależności) publikowana
na GitHub Pages. Treść pytań reguluje `docs/PROTOKOL.md` (protokół PYT),
architekturę — ADR-y w `docs/decisions/`.

Wzorcem dobrych praktyk jest projekt AME właściciela (materiał referencyjny
poza repozytorium, nie kod do uruchamiania). Reguły odziedziczone z AME są
oznaczone w `docs/LESSONS.md` jako „dziedziczone".

## 0. Kolejność lektury startowej (obowiązkowa, przed jakąkolwiek pracą)

**Każdy plik lektury obowiązkowej czytasz W CAŁOŚCI — od pierwszej do ostatniej
linii.** „Przejrzałem", „streściłem", „doczytałem najnowsze" NIE jest
przeczytaniem. Jeśli narzędzie zwróci plik pofragmentowany (truncated,
hasMore, stronicowanie) — dobierasz kolejne fragmenty do końca. Kontrola dla
siebie: znasz `wc -l` pliku i wiesz, że dotarłeś do ostatniej linii.

1. **Ten plik** (`AGENTS.md`).
2. **`docs/PROTOKOL.md`** — obowiązujący szablon promptu i schemat paczki
   pytań PYT. To zasada treściowa, nie sugestia.
3. **Wszystkie ADR-y** w `docs/decisions/` — najpierw README rejestru, potem
   **każdy** `NNNN-*.md` w całości. ADR-y ze statusem *Proponowana* są
   kierunkiem, nie zobowiązaniem: nie buduj na nich trwałych rozwiązań, zanim
   właściciel ich nie zaakceptuje (albo nie zaakceptujesz ich sam w trybie §2).
4. **`docs/LESSONS.md`** — cały rejestr lekcji do ostatniej.
5. **`docs/setup/ENVIRONMENT.md`** — stałe ograniczenia sandboxa / gita / sieci.
6. **`docs/ROADMAP.md`** — w którym kamieniu milowym jesteśmy.
7. **Najnowszy `docs/setup/HANDOFF_*.md`** — skrót JEDNEJ sesji: stan na koniec
   i rzeczy otwarte. Nie jest źródłem zasad.

Budżet lektury startowej: pozycje 1–6 mają się mieścić w **40 tys. tokenów**
(`node tools/budzet-lektury.mjs`, gdy już powstanie). Gdy próg zostanie
przekroczony, skrócenie/rozdzielenie dokumentów staje się obowiązkowym zadaniem
sesji, a nie opcją.

Czego NIE czytasz na start: `docs/PROJECT_HISTORY.md` (dziennik sesji),
`docs/plans/*` (plany pojedynczych zadań) i `docs/BACKLOG.md` — to archiwum
i bank pomysłów; sięgasz tam punktowo i grepem, gdy potrzebny jest kontekst
konkretnej decyzji.

## 1. Źródło prawdy

Repozytorium, testy i dokumentacja są źródłem prawdy. Historia czatu, opis
zadania i komentarze mogą być niepełne. Jeżeli są sprzeczne:

1. nie ukrywaj sprzeczności;
2. sprawdź najnowsze ADR-y i najnowszy handoff;
3. poproś właściciela o decyzję, jeśli zmiana jest nieodwracalna lub wpływa
   na zakres;
4. zapisz rozstrzygnięcie w repozytorium (miejsce — tabela w §5).

## 2. Tryb sesji — cztery reguły nadrzędne (ADR 0012)

Obowiązują KAŻDĄ sesję bez wyjątku i są nadrzędne wobec handoffów, startowego
promptu i planów w `docs/plans/`. Żaden inny dokument nie może ich wyłączyć.

1. **Pull Request na starcie.** PR gałęzi sesji istnieje na GitHubie PRZED
   jakimkolwiek kodowaniem (na początku wystarczą porządkowe commity).
2. **Audyt poprzedniego PR przed kodowaniem.** Przegląd zmian poprzedniego
   scalonego PR (plik po pliku, `git diff`): logika, zgodność z ADR i protokołem,
   zieloność testów. Wynik trafia do opisu PR i `docs/PROJECT_HISTORY.md`.
   Klon bywa płytki — najpierw `git fetch origin main --depth=50` (ENVIRONMENT §3).
3. **Inkrementalne commity.** Każdy samodzielnie zielony krok (`npm test`) to
   OSOBNY commit, od razu wypchnięty. Zakazany jest jeden wielki commit z całą
   sesją. **Zakaz osieracania kodu (twardy):** każdy commit ląduje WYŁĄCZNIE na
   gałęzi, która ma (lub natychmiast dostanie) swój otwarty PR do `main`. Przed
   każdym commitem sprawdź `git rev-parse --abbrev-ref HEAD`. Komunikat commita
   pisz do pliku poza repo i commituj przez `git commit -F` (ENVIRONMENT §3).
4. **Tylko przyrostowo, nigdy force push.** Nowe commity na końcu gałęzi;
   przed pushem `git log --oneline -3` + `git status` + `git fetch origin <gałąź>`
   z porównaniem `HEAD..FETCH_HEAD`. Odrzucony push to znak, że sprawdzenia nie
   było — nigdy `--force`. Odzyskanie po resecie: ENVIRONMENT §2.

Ponadto:

- **1 sesja = 1 gałąź = 1 PR.** Pracuj wyłącznie na gałęzi sesji, nie pushuj do
  `main`, nie wykonuj merge — scalenie (preferowane *Squash and merge*) jest
  jawną decyzją właściciela i kończy sesję kodowania.
- **Pytanie do właściciela tylko gdy praca jest zablokowana** decyzją spoza
  kompetencji agenta (architektura, sprzeczność ADR, nowa granica §4, wydatek/
  klucz API, prywatność użytkowników). **Nie pytaj „co robimy?"** — bez zaległości
  i zlecenia bierzesz najwyższy nieukończony kamień z `docs/ROADMAP.md` (pomysły
  spoza roadmapy najpierw do `docs/BACKLOG.md`).
- **Praca istnieje dopiero po `git push`** (dlaczego: ENVIRONMENT §1).
  Commituj i pushuj po każdym zielonym kroku.
- **Obowiązkowy blok na koniec sesji:** instrukcja przekazania w czacie + trwała
  wersja w `docs/setup/HANDOFF_<data>.md` i `docs/PROJECT_HISTORY.md`.

## 3. Zasady treści — protokół PYT (ściąga; wiąże `docs/PROTOKOL.md`)

- **Prompt generuje aplikacja** (`PROTOKOL §2` ↔ `zbudujPrompt()`; parzystość
  pilnuje kontrakt). **Kwerenda twarda** (ADR 0008): pytanie bez `zrodla[]`
  z prawdziwym URL odpada bez wyjątków. **Pytania o okolicę** (treść/
  wyjaśnienie odnosi się do miejsca z `okolica`).
- **Trudność z kategorii wiekowej** (§4): zmiana kategorii = zmiana opisu
  w promptcie. **Schemat wersjonowany** (`PYT/1.0`): zmiana = ADR + podbicie
  + migrator (użytkownik nie traci gry). **Tematy z kanonu** (`TEMATY`):
  nowy temat = kanon + protokół w tym samym commicie.
- **Paczka po walidacji jest ukrywana** (obfuskacja bez klucza, `TO-paczka/2`,
  ADR 0007) — plaintext nigdzie, pole wklejania czyszczone natychmiast.
  **„Ukryte", nie „zaszyfrowane"** (ADR 0007 pkt 5).
- **Język: polski** (inne języki pytań przez parametr `jezyk`, ADR 0011).
  **Współrzędne prawdziwe**, dziesiętne; stacja poza promieniem/niedostępna
  = błąd walidacji.

## 4. Granice nienegocjowalne

- **Aplikacja pozostaje vanilla HTML+JS+CSS bez frameworków, bez bibliotek
  mapowych i bez kroku budowania** (ADR 0001). Zmiana tego paradigmatu =
  wyraźna decyzja właściciela + nowy ADR.
- **Zero zależności npm w `package.json`** — runtime i dev. Narzędzia agenta
  (np. headless Chromium do weryfikacji wizualnej) instaluje się WYŁĄCZNIE poza
  repozytorium (`ENVIRONMENT` §4.1).
- **Zero sekretów w repo.** Wymiana z modelem przez schowek (ADR 0006); nie
  commituj kluczy, tokenów ani danych graczy. Adres mostu Drive jest **publicznym
  punktem końcowym, nie sekretem** — stąd stała `DOMYSLNY_URL_MOSTU` w kodzie
  (ADR 0020). Sekrety mostu (`REVIEW_SECRET`, `OWNER_EMAIL`) WYŁĄCZNIE
  w Script Properties — nigdy w repo.
- **Współrzędne gracza nie opuszczają urządzenia inaczej niż przez zapytania
  do dostawców map/danych wymienionych w `docs/ASSETS.md`** (ADR 0013). Zero
  analityki, zero ciasteczek, zero zewnętrznych skryptów.
- **CI: najpierw spróbuj pusha `.github/workflows/`** (403 `workflows` bywa
  przywiązany do instancji tokena — LESSONS L4); dopiero przy 403 fallback na
  lustro `docs/setup/ci-workflow.yml`. Brak zielonego CI **nie jest blokerem
  sesji ani powodem próśb do właściciela**. Bramą jakości jest `npm test`.
- **Nie przepisuj działającego kodu przed jego uruchomieniem i udokumentowanym
  audytem.** Patchuj chirurgicznie (minimalne fragi, nie całe pliki).
- **Błędy naprawiaj u root cause, nie maskuj.** Zakaz `return`/`try-catch`/
  warunków ukrywających objaw oraz funkcji, która „działa", ale ukrywa dane
  przed użytkownikiem lub testem.
- **Pojedyncze pliki binarne > 2 MB wymagają zgody właściciela.**

## 5. Gdzie zapisać regułę, żeby nie przepadła

Reguły trwałe nie mogą mieszkać w handoffie — handoff opisuje jedną sesję.

| Rodzaj treści | Miejsce | Trwałość |
|---|---|---|
| Wiążąca decyzja o granicach, danych, mapie, dostawcach, deploymencie | ADR (`docs/decisions/`) | trwała, formalna |
| Szablon promptu, schemat paczki, rygory treści pytań | `docs/PROTOKOL.md` | trwała |
| Powtarzalna pułapka, wniosek diagnostyczny, heurystyka | `docs/LESSONS.md` | trwała, nieformalna |
| Zasada obowiązująca każdego agenta / kolejność lektur | ten plik | trwała |
| Stałe ograniczenie środowiska (sandbox, git, sieć) | `docs/setup/ENVIRONMENT.md` | trwała |
| Dostawca danych/kafelków, polityka użycia, atrybucja | `docs/ASSETS.md` | trwała |
| Stan i kolejka jednej sesji | `docs/setup/HANDOFF_*.md` | jednorazowa |
| Roadmapa jednego zadania | `docs/plans/PLAN_*.md` | jednorazowa |
| Pomysł „może kiedyś" | `docs/BACKLOG.md` | trwała, niezobowiązująca |

Jeśli w trakcie sesji trafisz na pułapkę, która zmarnowała czas i może się
powtórzyć — dopisz lekcję do `docs/LESSONS.md` (format: `## LN (data) — tytuł`,
objaw → przyczyna → reguła).

## 6. Nowa decyzja architektoniczna?

Nowy ADR jest potrzebny, gdy zmiana: rusza granice komponentów; wybiera
technologię, dostawcę, persistence/deployment; zmienia model danych/schemat;
wprowadza trwały kompromis; dotyka prywatności. Szablon: rejestr ADR.
Zaakceptowanego ADR nie edytuj pod zmianę znaczenia — utwórz nowy zastępujący
i oznacz stary *Zastąpiona*.

## 7. Oczekiwania wobec zmian

- Pracuj ciągle: nie stawaj po podetapie; koduj do decyzji projektowej
  właściciela albo do braku danych wejściowych.
- Najpierw test odtwarzający błąd/zachowanie, potem implementacja. Testy logiki
  nie wymagają DOM ani sieci — `node --test`.
- **Wszystko, co losowe, jest deterministyczne pod ziarnem.** Ziarno rozgrywki
  (wybór stacji, kolejność odpowiedzi) pochodzi z konfiguracji i jest zapisane
  w paczce, żeby grę dało się odtworzyć i przetestować (ADR 0005).
- Dane i build są deterministyczne: bez `Date.now()` w treści generowanych
  plików, sortowanie jawne.
- Zmianę weryfikuj **na żywo**, nie tylko testem: serwer na `0.0.0.0` + live
  preview; przy UI mobilnym 360 px i palec (drag, pinch, tap).
- Przy zmianie kodu sprawdź, czy zaktualizować: ROADMAP, ARCHITECTURE, WORKFLOW,
  PROTOKOL, ADR, README.
- Po zmianie `app/*.js`/`app/styles.css` **podnieś `?v=`** w `index.html`
  i we wszystkich importach — identyczne wszędzie (pilnuje kontrakt).
