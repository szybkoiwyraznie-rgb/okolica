# 0008 — Obowiązkowa kwerenda internetowa i źródło URL przy każdym pytaniu

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Prompt musi wymagać od modelu kwerendy internetowej dla każdego faktu — gra
uczy o realnej okolicy, a zmyślona data czy nieistniejący pomnik to kompromitacja
rozgrywki i wprowadzanie graczy (w tym dzieci) w błąd. Mechanizm przeniesiony
z AME („Scryfall dla kart, źródła www dla wpisów").

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
4. **Zakotwiczenie w miejscu** (~~walidowane~~ → **proszone**, aneks
   2026-09-09): pytanie powinno odnosić się do obiektu, ulicy, dzielnicy,
   wydarzenia albo postaci z okolicy gry. Do 2026-09-09 pilnował tego walidator
   (kod `E14`, heurystyka leksykalna) — **już nie**. Zakotwiczenie jest prośbą
   w prompcie; pytanie ogólne przechodzi. Powód w aneksie niżej.
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

0006 (pętla treści), 0007 (walidacja przed ukryciem), 0010 (repozytorium
paczek i ich przegląd), `docs/PROTOKOL.md` §2–§3.


## Aneks 2026-09-09 — pkt 4 przestaje być bramką walidatora

Właściciel, po zobaczeniu dwóch usterek `E14` na własnej paczce: „to bez sensu.
Przy niektórych kategoriach (szczególnie tych custom) nigdy nie będzie
nawiązania do miejsca i będą pytania z wiedzy ogólnej. To jak najbardziej
dopuszczalne i pożądane".

Pierwotne założenie pkt 4 — że gra terenowa bez lokalnych pytań traci sens —
jest prawdziwe dla tematów typu „historia" czy „architektura", ale nie dla
tematu własnego, który organizator wpisuje ręcznie (np. „muzyka lat 90.").
Tam kotwica miejscowa albo nie istnieje, albo model musiałby ją naciągnąć —
a naciągnięty fakt jest gorszy niż uczciwe pytanie ogólne.

Kosztem błędu była cała runda z modelem: organizator stoi w terenie, dostaje
odrzuconą paczkę i musi wrócić do czatu. Przy regule, która bywa błędna z
założenia, ta cena jest nie do przyjęcia — dlatego kod `E14`, heurystyka
`czyZakotwiczone` i jej listy słów zostały usunięte z `app/protokol.js`,
a nie tylko złagodzone. Zakotwiczenie zostaje w zasadzie 4 obu szablonów
promptu: „schodź na najniższy poziom, na którym masz pewny fakt (…) gdy temat
nie ma lokalnego zaczepienia, pytanie z wiedzy ogólnej jest w porządku".

Konsekwencja dla ADR 0008: pkt 4 nie jest już kryterium przyjęcia paczki.
Punkty 1–3 i 5–6 (kwerenda, źródła, pokazywanie źródeł graczowi) zostają bez
zmian w wariancie z fact-checkiem.
