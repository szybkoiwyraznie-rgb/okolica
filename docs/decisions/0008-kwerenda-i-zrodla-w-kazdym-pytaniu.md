# 0008 — Obowiązkowa kwerenda internetowa i źródło URL przy każdym pytaniu

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Właściciel: „w prompcie dla modelu ważne jest, by wymagać od niego kwerendy
internetowej dla wszystkich danych używanych w quizie, żeby nic sam nie
wymyślał i nie konfabulował". Gra uczy o realnej okolicy: zmyślona data
budowy kościoła, nieistniejący pomnik albo wymyślony cytat to nie drobiazg —
to kompromitacja rozgrywki i wprowadzanie graczy (w tym dzieci) w błąd.
AME rozwiązuje ten sam problem regułą „Scryfall dla kart, źródła www dla
wpisów" (ich ADR 0008) — przenosimy mechanizm.

## Decyzja

1. **Prompt zawiera twardy wymóg kwerendy**: model ma wykonać wyszukiwanie
   / przeglądanie sieci **przed** napisaniem każdego faktu i nie używać pamięci
   modelu jako źródła. Treść klauzuli jest stała i wersjonowana w
   `docs/PROTOKOL.md` §2 (nagłówek „ZASADY TWARDE").
2. **Każde pytanie ma `zrodla[]`**: co najmniej jeden wpis
   `{ url, tytul, sprawdzono }`, gdzie `url` jest pełnym adresem `http(s)`,
   `tytul` nie jest pusty, a `sprawdzono` to data `RRRR-MM-DD` nie późniejsza
   niż dziś. Walidator (`walidujPaczke`) odrzuca paczkę bez tego — **bez
   wyjątków i bez trybu „dopiszę później"**.
3. **Zakaz konfabulacji w treści**: prompt wprost zakazuje wymyślania nazw,
   dat, liczb, cytatów, autorów i adresów; nakazuje zmniejszyć liczbę pytań
   w temacie i opisać brak w `uwagi`, jeśli źródeł nie ma. Pytanie „na oko"
   jest gorsze niż brak pytania.
4. **Zakotwiczenie w miejscu**: każde pytanie odnosi się do obiektu, ulicy,
   dzielnicy, wydarzenia albo postaci z okolicy gry. Walidator sprawdza
   heurystyką leksykalną (nazwa miejsca z `okolica.miejsce`, nazwy własne ze
   stacji, słowa-klucze dzielnicy), że treść lub wyjaśnienie zawiera odniesienie
   miejscowe — pytanie czysto ogólne („ile lat miała królowa Wiktoria") jest
   odrzucane jako `brak-zakotwiczenia`.
5. **Źródła są pokazywane graczowi** po odpowiedzi, razem z wyjaśnieniem —
   to część wartości edukacyjnej i mechanizm samokontroli: jeśli gracz widzi
   adres, organizator zauważy, gdy źródło jest zmyślone.
6. **Weryfikacja po stronie agenta, nie tylko modelu**: przy dodawaniu paczek
   referencyjnych/przykładowych do repo (`data/przyklady/`) agent sprawdza
   każdy URL narzędziem `fetch_page`/`web_search` i zapisuje wynik w
   `sprawdzono`. Paczki od graczy w przyszłym publicznym repo przechodzą
   przegląd organizatora (ADR 0010 pkt 4) — bez przeglądu nic nie idzie
   do publikacji.
7. **Trudność ≠ zmyślanie**: dla kategorii wiekowych 7–12 prompt wymaga faktów
   prostych, ale **tak samo udokumentowanych**. Obniżenie trudności nie zwalnia
   z wymogu źródła.

## Konsekwencje

- Część odpowiedzi modeli będzie odrzucana przez walidator (brak źródeł,
  ogólne pytania). Dlatego pętla ma wbudowany krok „skopiuj poprawkę do modelu"
  (ADR 0006 pkt 5) — organizator nie przepisuje uwag ręcznie.
- Wymóg źródeł podnosi liczbę tokenów odpowiedzi i czas generacji; to
  akceptowalne, bo alternatywą są pytania niewiarygodne.
- Model bez dostępu do sieci (np. tryb offline czatu) nie spełni wymogu —
  aplikacja mówi to wprost w instrukcji promptu („użyj modelu z wyszukiwaniem").
- Testy: `test/protokol.test.js` na fixture'ach (paczka OK, bez źródeł, z URL
  nie-`http`, z datą z przyszłości, bez zakotwiczenia, z duplikatami).

## Powiązania

0006 (pętla treści), 0007 (walidacja przed szyfrowaniem), 0010 (repozytorium
paczek i ich przegląd), `docs/PROTOKOL.md` §2–§3.
