# 0031 — Duży setup generuje pytania partiami, a aplikacja sama je scala

- Status: Wycofana (2026-09-08, decyzja właściciela — tego samego dnia, w którym została podjęta)
- Data: 2026-09-08
- Zastąpiona przez: brak (wraca stan z ADR sprzed B21: jedno zlecenie na całą paczkę)

## Kontekst

Pomiar z 2026-09-07 (B21, `test/duza-paczka.test.js`) pokazał, że przy dużych
setupach rośnie **wyjście** modelu — ~210 tokenów na pytanie — a nie prompt
(stały, ~1 356 tokenów) i nie pamięć (kontener 40 pytań = 35,6 kB, 1,8% budżetu
stanu). Z tego pomiaru wyciągnąłem wniosek, że przy 40 pytaniach (~8 350
tokenów) model z limitem wyjścia 4 tys. tokenów urwie JSON w połowie, i zapisałem
to w `app/protokol.js` jako `PROG_ODPOWIEDZI_TOKENY = 4000`.

Na tym założeniu stanęła decyzja o dzieleniu generacji na partie:
`planPartii()` / `scalPartie()`, globalne numery stacji w promptcie części
(szablon `PYT/1.0.7`), walidacja części wobec jej własnego zakresu stacji
(`oczekiwane.stacjeNumery`), kody WE08/WE09/WE10/E21, paski `#prompt-partia`
i `#paczka-partia`, sekcja PROTOKOL §2.2. Wdrożone i zielone w commicie
`0b2ca68`.

## Dlaczego wycofana

**Założenie o limicie wyjścia było moje, nie właściciela — i było błędne.**
Właściciel (2026-09-08): *„Żaden z modeli których używam nie ma nawet
w przybliżeniu takich limitów. Sugerowany Meta.ai ma output token limit 64k
tokens, Google Studio models 64k, ChatGPT5+ 128k output tokens limit."*

Liczba 4 000 nie była pomiarem żadnego modelu, którego właściciel używa — była
moim ostrożnościowym założeniem o „części modeli", zapisanym w komentarzu jako
fakt (*„Modele z limitem wyjścia 4 tys. tokenów urywają taką odpowiedź
w połowie"*).

Konsekwencja jest policzalna. Największy setup, jaki aplikacja w ogóle pozwala
zbudować (`OGRANICZENIA`: 12 stacji × 8 graczy = **96 pytań**), daje odpowiedź
~**20 250 tokenów** / ~80 tys. znaków:

| limit wyjścia modelu | ile razy więcej niż maksymalny setup |
|---|---|
| 32 000 | 1,6× |
| 64 000 | 3,2× |
| 128 000 | 6,3× |

`planPartii({ liczbaStacji: 12, pytaniaNaStacje: 8, progTokeny: 64000 })` zwraca
**1 część**. Czyli przy modelach właściciela dzielenie nie odpaliłoby się nigdy,
przy żadnej konfiguracji dostępnej w aplikacji.

Zostawał więc kod, który nie może się wykonać: dwa elementy UI, sekcja protokołu,
pięć kodów błędów i 16 testów pilnujących ścieżki, którą nikt nie pójdzie.
Właściciel: *„Według mnie to nie ma większego sensu"* — i wybrał usunięcie,
nie podniesienie progu.

## Decyzja

Cały mechanizm partii usunięty przez `git revert 0b2ca68` — `app/protokol.js`,
`app/app.js`, `index.html` i `docs/PROTOKOL.md` wróciły bajt-w-bajt do stanu
z `4e29879`, a szablon do `PYT/1.0.6`. Aplikacja zawsze generuje pytania jednym
zleceniem, tak jak przed B21.

**Co zostaje z B21** (to nie zależało od błędnego założenia i ma wartość samą
w sobie):

- `szacunekOdpowiedzi()` i stałe `BAZA_ODPOWIEDZI_*` / `*_NA_PYTANIE` w
  `app/protokol.js` — pomiar ~830 znaków i ~210 tokenów na pytanie był prawdziwy;
- linia `#prompt-rozmiar` na ekranie pytań: mówi właścicielowi, jak duża będzie
  odpowiedź, zanim zmarnuje generację. Nie blokuje niczego;
- `test/duza-paczka.test.js` — pilnuje, żeby pomiar nie rozjechał się z fiksturem.

`PROG_ODPOWIEDZI_TOKENY = 4000` zostaje w kodzie wyłącznie jako próg tego
**ostrzeżenia**. Nie steruje już żadnym zachowaniem aplikacji.

## Konsekwencje

- Gdyby właściciel kiedyś użył modelu z małym limitem wyjścia, objaw wróci jako
  E01/E02 po wklejeniu uciętego JSON-u — ale `#prompt-rozmiar` powie mu wcześniej,
  jak duża miała być odpowiedź, więc rozpozna przyczynę.
- Jeśli kiedyś dzielenie stanie się potrzebne, ten ADR jest gotowym projektem:
  pakowanie całymi stacjami, globalne numery stacji (bez nich `s<stacja>p<n>`
  zderzają się po scaleniu), walidacja części wobec jej zakresu i odmowa
  scalania przy kolizji `id`. Nie trzeba wymyślać od nowa.
- LESSONS L37 zostaje: bug, który znalazł test UI (`odpakujPaczke` zwraca paczkę
  także dla jawnego JSON-a, a formę rozróżnia dopiero pole `zrodlo`), dotyczy
  kodu, który nadal żyje.

## Aneks (2026-09-11): `#prompt-rozmiar` usunięty z UI

Linijkę szacunku rozmiaru odpowiedzi (`#prompt-rozmiar`) właściciel usunął
podczas testów terenowych jako ozdobnik razem z innymi dev-tekstami (m12-63).
Uwaga z Konsekwencji o rozpoznawaniu przyczyny E01/E02 traci więc swoje
narzędzie w UI — sam pomiar budżetu zostaje w PROTOKOL §2.1 i w testach
`test/duza-paczka.test.js`.

## Aneks (2026-09-12): stałe szacunku też wyleciały z kodu

Aneks 2026-09-11 (wyżej) mówił o UI; w m12-66, tą samą decyzją właściciela,
zniknęły również stałe szacunku z `app/protokol.js` (`szacunekOdpowiedzi()`
i stałe budżetu BAZA/PROG/TOKENY, w tym `PROG_ODPOWIEDZI_TOKENY`). Zostaje sam
pomiar w PROTOKOL §2.1 jako prawidło i asercje `test/duza-paczka.test.js`
(prompt nie rośnie z liczbą pytań, kontener mieści się w budżetach pamięci).
