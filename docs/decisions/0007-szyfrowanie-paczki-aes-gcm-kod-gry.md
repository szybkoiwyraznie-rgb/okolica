# 0007 — Paczka pytań szyfrowana AES-GCM (Web Crypto), klucz z `kod gry` przez PBKDF2

- Status: Proponowana (model zagrożeń i wygoda `kod gry` — do potwierdzenia przez właściciela)
- Data: 2026-09-05

## Kontekst

Właściciel: „żeby nie można było podejrzeć pytań i odpowiedzi, które daje nam
model, odpowiedź powinna być zaszyfrowana". Realne zagrożenie w tej grze to
**ciekawski gracz z tym samym telefonem**: `view-source`, inspekcja
`localStorage`, przewinięcie wklejonego tekstu, zerknięcie przez ramię. To nie
jest przeciwnik z laboratorium — ale też nie wolno nam udawać, że szyfrowanie
chroni przed kimś, kto ma urządzenie i chwilę czasu.

Model nie może zaszyfrować odpowiedzi sam: LLM-y nie wykonują AES
deterministycznie i bezbłędnie, więc wymaganie od nich ciphertextu skończyłoby
się paczką, której nie da się odszyfrować. Szyfrowanie musi zrobić aplikacja.

## Decyzja

1. **Szyfruje aplikacja, po walidacji, zanim cokolwiek trafi na dysk.**
   Algorytm: **AES-GCM 256** przez `globalThis.crypto.subtle` (Web Crypto —
   to samo API w przeglądarce i w Node ≥ 20, więc testy idą na tym samym kodzie;
   zakaz `node:crypto` w `app/`, LESSONS L6).
2. **Klucz pochodzi z `kod gry`**: ciąg 4–8 znaków wybrany przez organizatora
   w setupie (domyślnie proponowany losowo, pokazywany raz, do zapamiętania).
   KDF: **PBKDF2-SHA256, 150 000 iteracji, sól 16 B losowa na paczkę**
   (dobrane tak, żeby derivation na telefonie trwało < 1 s). Klucz nigdy nie
   jest zapisywany — liczy się w pamięci przy każdym odszyfrowaniu.
3. **Format kontenera** (`app/krypto.js`, schemat `TO-paczka/1`):
   `{ schemat, protokol, sol, iv, iteracje, dane }` — `sol`/`iv`/`dane`
   base64; `iv` 12 B losowe na każde szyfrowanie; całość jako jeden obiekt
   JSON do `localStorage` i do eksportu plikowego (ADR 0010).
4. **Plaintekst nie istnieje trwale**: pole wklejania jest czyszczone
   natychmiast po przetworzeniu, pytania po odszyfrowaniu trzymają się tylko
   w pamięci modułu rozgrywki, a do `localStorage` wraca wyłącznie ciphertext.
   Pytanie dla bieżącej stacji jest deszyfrowane **w chwili dojścia**, nie na
   starcie gry (mniej okazji do wycieku przez inspekcję pamięci).
5. **Uczciwy model zagrożeń w UI i w dokumentacji**: to **bariera
   antypodglądowa**, nie zabezpieczenie przed zdeterminowanym graczem. Kto ma
   `kod gry` albo dostęp do pamięci działającej aplikacji, ten pytania zobaczy.
   Komunikat na ekranie organizatora mówi to wprost; ADR nie obiecuje więcej.
6. **Integralność i pochodzenie**: skrót SHA-256 plaintextu zapisany obok
   kontenera (`skrot`) pozwala stwierdzić, czy paczka nie została podmieniona
   po zaszyfrowaniu, i rozpoznać duplikaty paczek w przyszłym repozytorium
   (ADR 0010 pkt 4). GCM daje uwierzytelnienie treści — `skrot` jest tylko
   identyfikatorem, nie drugim zabezpieczeniem.
7. **Zapomniany kod = paczka nie do odzyskania** i jest to zamierzone: brak
   tylnych drzwi, brak hasła mistrza, brak możliwości „odzyskania pytań" przez
   agenta. Aplikacja ostrzega przed startem i proponuje eksport pliku paczki.
8. **Zero krypto w kodzie po stronie modelu**: prompt (ADR 0006) wymaga JSON-a
   jawnego. Nie prosimy modelu o base64, XOR ani „zakoduj to" — walidacja
   odpowiedzi byłaby zawodna, a złudzenie bezpieczeństwa szkodliwe.

## Konsekwencje

- Web Crypto wymaga kontekstu bezpiecznego — GitHub Pages (HTTPS) i `localhost`
  spełniają warunek; `file://` nie (i tak nie działa, ADR 0001).
- PBKDF2 150k iteracji na tanim telefonie: ~0,3–1 s — akceptowalne raz na
  odszyfrowanie pytania; mierzymy w M5 i zapisujemy w LESSONS, jeśli boli.
- Testowalność: pełny round-trip (hasło → zaszyfruj → odszyfruj → porównaj),
  odmowa przy złym kodzie, odporność na zmianę `iv`, walidacja schematu
  kontenera — wszystko w `test/krypto.test.js` na Node.
- Ryzyko UX: dodatkowy parametr do zapamiętania. Mitygacja: kod domyślnie
  proponowany i pokazywany na jednym ekranie, opcja „gram bez ukrywania pytań"
  (szyfrowanie wtedy tylko przed przypadkowym wglądem — `kod` pusty = kontener
  z kluczem wyprowadzonym z ziarna rozgrywki, oznaczony w UI jako
  **niechroniony**).

## Powiązania

0001 (Web Crypto, zero zależności), 0006 (pętla treści), 0008 (walidacja przed
szyfrowaniem), 0010 (zapis i eksport), 0013 (treść pytań i współrzędne nie
wychodzą z urządzenia).
