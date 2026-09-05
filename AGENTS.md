# AGENTS.md — zasady pracy w repozytorium „Tajemnicza Okolica"

> **To jest plik startowy każdej sesji.** Runner (Arena i każdy inny) wczytuje
> ten plik jako pierwszy, niezależnie od treści wiadomości startowej właściciela.
> Nie odpowiadaj właścicielowi i nie otwieraj ankiety o zadanie, zanim nie
> wykonasz bloku §0.

Projekt: **Tajemnicza Okolica** — terenowa gra quizowa jako statyczna aplikacja
(vanilla HTML+JS+CSS, bez kroku budowania, bez zależności) publikowana
na GitHub Pages. Treść pytań reguluje `docs/PROTOKOL.md` (protokół PYT),
architekturę — ADR-y w `docs/decisions/`.

Wzorcem dobrych praktyk tego repozytorium jest projekt AME właściciela
(`AME-main.zip` w korzeniu — materiał referencyjny, nie kod do uruchamiania).
Reguły środowiskowe odziedziczone z AME są oznaczone w `docs/LESSONS.md`
jako „dziedziczone".

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
   jakimkolwiek kodowaniem. Może na początku zawierać tylko porządkowe commity,
   ale gałąź musi być na GitHubie.
2. **Audyt poprzedniego PR przed kodowaniem.** Zanim rozpocznie się nowa praca,
   sesja przegląda zmiany poprzedniego scalonego PR (plik po pliku, `git diff`)
   pod kątem logiki, zgodności z ADR i protokołem oraz zieloności testów.
   Wynik audytu trafia do opisu PR i `docs/PROJECT_HISTORY.md`. Audyt to
   sprawdzenie stanu projektu, nie zaraportowanie listy plików. Klon sesji bywa
   płytki — `git fetch origin main --depth=50` przed `git diff <sha>^..<sha>`
   (ENVIRONMENT §3).
3. **Inkrementalne commity.** Każdy samodzielnie zielony krok (`npm test`) to
   OSOBNY commit, od razu wypchnięty. Zakazany jest jeden wielki commit z całą
   sesją. **Zakaz osieracania kodu (twardy):** każdy commit ląduje WYŁĄCZNIE na
   gałęzi, która ma (lub natychmiast dostanie) swój otwarty PR do `main`. Przed
   każdym commitem sprawdź `git rev-parse --abbrev-ref HEAD`. Komunikat commita
   pisz do pliku poza repo i commituj przez `git commit -F` (ENVIRONMENT §3).
4. **Tylko przyrostowo, nigdy force push.** Praca ląduje jako NOWE commity na
   końcu gałęzi. Przed pushem: `git log --oneline -3` + `git status`, potem
   `git fetch origin <gałąź>` i porównanie `HEAD..FETCH_HEAD`. Odrzucony push
   (*non-fast-forward*) znaczy, że tego sprawdzenia nie było — nie sięgaj po
   `--force`. Procedura odzyskiwania po resecie workspace:
   `docs/setup/ENVIRONMENT.md` §2.

Ponadto:

- **1 sesja = 1 gałąź = 1 PR.** Pracuj wyłącznie na gałęzi sesji, nie pushuj do
  `main`, nie wykonuj merge — scalenie (preferowane *Squash and merge*) jest
  jawną decyzją właściciela i kończy sesję kodowania.
- **Pytanie do właściciela tylko gdy praca jest zablokowana** decyzją, której
  agent nie może podjąć sam: zmiana architektury, sprzeczność ADR, nowa granica
  nienegocjowalna (§4), wydatek/klucz API/dostawca wymagający konta, albo
  kwestia prywatności użytkowników. **Nie pytaj „co robimy?"** — gdy po audycie
  brak zaległości i zlecenia właściciela, sesja bierze najwyższy nieukończony
  kamień milowy z `docs/ROADMAP.md` i idzie etapami z jego planu; pomysły spoza
  roadmapy najpierw dopisuje do `docs/BACKLOG.md`.
- **Praca istnieje dopiero po `git push`.** Nowa sesja widzi wyłącznie `main`
  i tekst pierwszego promptu. Commituj i pushuj po każdym zielonym kroku.
- **Obowiązkowy blok na koniec sesji:** wypisz w czacie instrukcję przekazania
  projektu dla następnego agenta, a jej trwałą wersję zapisz w
  `docs/setup/HANDOFF_<data>.md` i `docs/PROJECT_HISTORY.md`.

## 3. Zasady treści — protokół PYT (szczegóły: `docs/PROTOKOL.md`)

- **Prompt jest generowany przez aplikację, nie pisany ręcznie.** Jedynym
  źródłem szablonu jest `docs/PROTOKOL.md` §2 i funkcja `zbudujPrompt()`
  w `app/pytania.js`; test porównuje je ze sobą (kontrakt dokument ↔ kod).
- **Wymóg kwerendy jest twardy.** Prompt MUSI zawierać żądanie wykonania
  kwerendy w internecie dla każdego faktu oraz pola `zrodla[]` z prawdziwym
  adresem URL (ADR 0008). Walidator odrzuca paczkę, w której pytanie nie ma
  źródła — bez wyjątków i bez „dopiszę później".
- **Pytania są o okolicę, nie o świat.** Każde pytanie wiąże się z miejscem:
  dzielnicą, miastem, regionem, obiektem w promieniu gry. Walidator sprawdza,
  czy treść lub wyjaśnienie odnosi się do miejsca z `okolica`.
- **Trudność wynika z kategorii wiekowej** (protokół §4): 7, 10, 12, 15,
  dorośli. Zmiana kategorii = zmiana opisu trudności w promptcie, nie tylko
  etykiety.
- **Schemat paczki jest wersjonowany** (`protokol: "PYT/1.0"`). Zmiana schematu
  = nowy ADR + podbicie wersji + migrator dla paczek zapisanych w
  `localStorage` (użytkownik nie może stracić gry w trakcie).
- **Paczka pytań po walidacji jest ukrywana** (obfuskacja bez klucza, kontener
  `TO-paczka/2`, ADR 0007) i tylko w tej postaci trafia do `localStorage`.
  Plaintekst nie jest zapisywany nigdzie, a pole tekstowe wklejania jest
  czyszczone natychmiast po przetworzeniu. **Piszemy „ukryte", nie
  „zaszyfrowane"** — to bariera przed przypadkowym wglądem, nie zabezpieczenie,
  i ani dokumentacja, ani UI nie mogą obiecywać więcej (ADR 0007 pkt 5).
- **Język aplikacji i treści: polski.** Nazwy własne, cytaty i terminy źródłowe
  mogą pozostać oryginalne. Inne języki pytań — przez parametr `jezyk`
  w konfiguracji (ADR 0011), nie przez zmianę języka interfejsu.
- **Tematy tylko z kanonu** (`app/konfig.js` → `TEMATY`): małe litery,
  myślniki, bez spacji. Nowy temat = dopisanie go do kanonu i do opisu w
  protokole w tym samym commicie.
- **Współrzędne są prawdziwe i w stopniach dziesiętnych**: `lat` ∈ [-90, 90],
  `lon` ∈ [-180, 180]. Stacja poza promieniem gry albo w miejscu
  niedostępnym = błąd walidacji, nie „poprawka wizualna".

## 4. Granice nienegocjowalne

- **Aplikacja pozostaje vanilla HTML+JS+CSS bez frameworków, bez bibliotek
  mapowych i bez kroku budowania** (ADR 0001). Zmiana tego paradigmatu =
  wyraźna decyzja właściciela + nowy ADR.
- **Zero zależności npm w `package.json`** — runtime i dev. Narzędzia agenta
  (np. headless Chromium do weryfikacji wizualnej) instaluje się WYŁĄCZNIE poza
  repozytorium (`ENVIRONMENT` §4.1).
- **Zero backendu i zero sekretów w repo.** Wymiana z modelem AI odbywa się
  przez schowek użytkownika (ADR 0006). Nie commituj kluczy API, tokenów ani
  danych graczy.
- **Współrzędne gracza nie opuszczają urządzenia inaczej niż przez zapytania
  do dostawców map/danych wymienionych w `docs/ASSETS.md`** (ADR 0013). Zero
  analityki, zero ciasteczek, zero zewnętrznych skryptów.
- **Pliki w `.github/workflows/` są poza zasięgiem agenta** (token GitHub App
  dostaje 403 `workflows`). Receptura CI leży w `docs/setup/ci-workflow.yml`;
  brak zielonego CI **nie jest blokerem sesji ani powodem, by prosić
  właściciela o zmianę pliku**. Bramą jakości jest `npm test` w każdej sesji.
- **Nie przepisuj działającego kodu przed jego uruchomieniem i udokumentowanym
  audytem.** Patchuj chirurgicznie (minimalne fragi, nie całe pliki).
- **Błędy naprawiaj u root cause, nie maskuj.** Zakaz dodawania `return`,
  `try-catch` czy warunków-specjalnych ukrywających objaw. Zakaz funkcji, która
  „działa bez zarzutu", ale ukrywa dane przed użytkownikiem lub testem.
- **Pojedyncze pliki binarne > 2 MB wymagają zgody właściciela.** Wyjątkiem jest
  istniejący `AME-main.zip` (materiał referencyjny właściciela).
- Nowe pomysły agentów są mile widziane — zapisuj je w `docs/BACKLOG.md`
  (rozpoznanie do wykorzystania, nie kolejka zadań).

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

Nowy ADR jest potrzebny, gdy zmiana: ustala lub zmienia granice komponentów;
wybiera istotną technologię, dostawcę danych lub sposób persistence/deploymentu;
zmienia model danych albo schemat paczki pytań; wprowadza trwały kompromis
wpływający na wiele funkcji; albo dotyka prywatności użytkownika. Użyj szablonu
z `docs/decisions/README.md`. Nie edytuj historii zaakceptowanego ADR tak, aby
zmienić znaczenie decyzji — utwórz nowy, który go zastępuje, i oznacz stary
statusem *Zastąpiona*.

## 7. Oczekiwania wobec zmian

- Pracuj ciągle: nie zatrzymuj się po podetapie i nie proś o wdrożenie tylko
  dlatego, że skończyła się checklista. Koduj do decyzji projektowej
  właściciela albo do braku niezbędnych danych wejściowych.
- Najpierw test odtwarzający błąd/zachowanie, potem implementacja, gdy ma to
  sens. Testy logiki (geodezja, projekcja, wybór stacji, walidacja paczki,
  ukrywanie paczki) nie wymagają DOM ani sieci — `node --test`.
- **Wszystko, co losowe, jest deterministyczne pod ziarnem.** Ziarno rozgrywki
  (wybór stacji, kolejność odpowiedzi) pochodzi z konfiguracji i jest zapisane
  w paczce, żeby grę dało się odtworzyć i przetestować (ADR 0005).
- Dane i build są deterministyczne: bez `Date.now()` w treści generowanych
  plików, sortowanie jawne.
- Zmiana weryfikowana **na żywo**, nie tylko testem: serwer statyczny na
  `0.0.0.0` + live preview Areny; przy UI mobilnym sprawdź szerokość 360 px
  i obsługę palcem (drag, pinch, tap).
- Przy zmianie kodu sprawdź, czy zaktualizować: `docs/ROADMAP.md`,
  `docs/ARCHITECTURE.md`, `docs/WORKFLOW.md`, `docs/PROTOKOL.md`, ADR,
  `README.md`.
- Po zmianie plików `app/*.js` lub `app/styles.css` **podnieś wersję
  cache-bustingu** w `?v=` w `index.html` i we wszystkich importach modułów —
  musi być identyczna wszędzie (pilnuje tego `test/kontrakt.test.js`).
