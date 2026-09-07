# 0007 — Ukrywanie paczki pytań: odwracalna obfuskacja bez klucza (nie szyfrowanie)

- Status: Zaakceptowana (decyzja właściciela 2026-09-05; zastępuje propozycję
  AES-GCM z kluczem z `kod gry` przez PBKDF2 — ADR poprawiony przed akceptacją,
  zgodnie z `LESSONS` L8)
- Data: 2026-09-05

## Kontekst

Brief właściciela: odpowiedzi ukryte „żeby nie można było podejrzeć pytań
i odpowiedzi" przed dojściem do stacji. Pierwsza wersja ADR proponowała
szyfrowanie (AES-GCM, klucz z `kod gry` przez PBKDF2); właściciel rozstrzygnął:
*„proste kodowanie bez klucza — nieczytelne na pierwszy rzut oka, nie
zabezpieczone przed odszyfrowaniem"*. Cel to bariera **przypadkowego wglądu**
(zerknięcie na ekran, schowek, plik) — nie bariera kryptograficzna.

## Decyzja

1. **Ukrycie = odwracalna obfuskacja bez klucza.** Przekształcenie
   (`app/kodowanie.js`): JSON → UTF-8 → XOR ze strumieniem bajtów z **stałego,
   jawnego ziarna** → base64url → kontener. Funkcje: `zapakujPaczke(paczka,
   wersjaProtokolu)`, `odpakujPaczke(kontener|tekst)`, `blobPaczki()`,
   `skrotFnv1a()`. Bez `WebCrypto`, bez `async`, bez zależności (ADR 0001) i bez
   API Node (LESSONS L6).
2. **Kontener `TO-paczka/2`** (PROTOKOL §3.3):
   `{ schemat, protokol, kodowanie: "b64x1", skrot, dane }`. Nie ma pól `sol`,
   `iv`, `iteracje` — bo nie ma klucza. Pole `kodowanie` jest **hakiem
   migracyjnym**: gdyby kiedyś pojawiła się potrzeba prawdziwej ochrony, dochodzi
   wariant `aes-gcm` (nowy ADR zastępujący ten), a stare paczki rozpoznaje się po
   tym polu.
3. **`skrot` = FNV-1a 32** z bajtów plaintextu. Wykrywa **przypadkowe
   uszkodzenie** przy kopiowaniu (urwane wklejenie, zgubiony znak, zamieniony
   bajt) i niczego więcej. Nie jest kryptograficzną funkcją skrótu i nigdzie nie
   wolno go tak nazywać — to suma kontrolna.
4. **`kod gry` przestaje być kluczem.** Zostaje jako *identyfikator rozgrywki*:
   trafia do eksportu paczki i do przyszłego repozytorium paczek (ADR 0010, M9).
   Etykieta w UI mówi to wprost („Kod gry (identyfikator rozgrywki)"), a
   podpowiedź dodaje, że kod nie chroni pytań.
5. **Jawne nazewnictwo — bez złudzeń bezpieczeństwa.** W UI, w `README`,
   w protokole i w dokumentacji pada „ukryte / obfuskacja", nigdy
   „zaszyfrowane / zabezpieczone". Podpowiedź na ekranie wklejania stwierdza:
   tekst „**nie jest zaszyfrowany**". Agent nie obiecuje w opisie PR ochrony,
   której w kodzie nie ma.
6. **Dyscyplina plaintextu zostaje** (pkt 4 poprzedniej wersji): pole wklejania
   jest czyszczone natychmiast po przetworzeniu; pytania żyją w pamięci modułu
   rozgrywki i są **odsłaniane w chwili dojścia** do stacji, nie na starcie gry;
   do `localStorage` trafia kontener, nie jawna paczka.
7. **Zero kodowania po stronie modelu**: prompt (ADR 0006) wymaga jawnego JSON-a.
   LLM nie wykona deterministycznie XOR-a z base64, a próba wymuszenia tego
   skończyłaby się paczkami nie do odczytania (i złudzeniem, że coś chronią).
8. **Tolerancja wklejenia**: `odpakujPaczke` przyjmuje kontener jako obiekt,
   jako tekst JSON, jako sam blob base64url **oraz** jawny JSON paczki od modelu.
   Organizator wkleja raz odpowiedź modelu, raz otrzymany wcześniej blob — obie
   drogi mają działać, a śmieci mają dawać komunikat, nie wyjątek.

## Konsekwencje

- **Mniej kodu i mniej ryzyka**: brak wymogu secure context do odczytu paczki
  (`WebCrypto` go wymagało), brak 0,3–1 s liczenia PBKDF2 na tanim telefonie,
  brak scenariusza „zapomniałem kodu = straciłem pytania", brak zarządzania
  kluczami.
- **Każdy, kto ma źródło, odczyta paczkę** — jawnie i zamierzenie. Dlatego do
  paczki nie wolno wkładać danych osobowych ani niczego, czego nie można
  upublicznić (ADR 0013): paczka udostępniona w repozytorium (ADR 0010, M9) jest
  faktycznie publiczna, a nie „zaszyfrowana".
- **Testowalność w Node bez krypto**: round-trip (z polskimi znakami i emoji),
  determinizm (ta sama paczka = ten sam blob), nieczytelność (w kontenerze nie
  widać „Grabowice", „historia", „1342"), wykrycie urwania i zamiany bajtu,
  odmowa przy nieznanym `schemat`/`kodowanie`, tolerancja czterech postaci
  wklejenia — `test/kodowanie.test.js`.
- Zmiana kontenera `TO-paczka/1` → `TO-paczka/2` **nie podbija wersji
  protokołu** (`PYT/1.0`): schemat paczki (§3.1/§3.2) się nie zmienił, a
  aplikacja nie była jeszcze opublikowana, więc nie istnieje żadna paczka
  użytkownika wymagająca migratora (PROTOKOL §7).

## Powiązania

0001 (zero zależności), 0006 (pętla treści), 0008 (walidacja przed ukryciem),
0010 (zapis, eksport, repozytorium paczek), 0013 (prywatność — do paczki nie
trafiają dane osobowe), `BACKLOG` B16 (prawdziwe szyfrowanie, gdyby potrzeba
wróciła).
