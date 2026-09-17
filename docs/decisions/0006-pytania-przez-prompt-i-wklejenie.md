# 0006 — Treść pytań: prompt generowany przez aplikację → model AI → wklejenie odpowiedzi (bez backendu i bez kluczy API)

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Pytania o **tę okolicę** i **zadanej trudności** nie da się wbudować z góry.
Rozwiązanie: aplikacja układa prompt, człowiek wkleja go do modelu AI, a odpowiedź
wkleja z powrotem — zero backendu, kluczy, kosztów i rejestracji (ADR 0001),
dostęp do dowolnego modelu, także z kwerendą internetową (ADR 0008).
Odrzucone: (a) API modelu z przeglądarki — klucz w kliencie albo proxy;
(b) pytania wbudowane per miasto — nie skaluje się; (c) generowanie z OSM —
w OSM nie ma historii, legend ani kultury.

## Decyzja

1. **Pętla treści** jest czterokrokowa i w całości w aplikacji:
   `konfiguracja + pozycja → prompt (tekst) → [człowiek ↔ model] → wklejona
   odpowiedź → walidacja → paczka PYT`.
2. **Prompt buduje aplikacja** (`zbudujPrompt(konfig, okolica, stacje)` — czysta
   funkcja). Jedynym źródłem szablonu jest `docs/PROTOKOL.md` §2; test
   kontraktowy porównuje szablon w dokumencie z kodem, żeby się nie rozeszły
   (LESSONS: wersja standardu rozjeżdża się między nośnikami).
3. **Prompt zawiera kontekst przestrzenny**: współrzędne środka, promień,
   miejsce z odwrotnej geokodacji (dzielnica/miasto/region/państwo, jeśli
   dostępne), oraz **listę stacji z ich współrzędnymi i opisem miejsca** — żeby
   pytania były przypisane do konkretnych punktów, nie do „ogólnie Warszawy".
4. **Wymagany format odpowiedzi modelu**: jeden blok JSON w ogrodzeniu
   ```` ```json ```` zgodnie ze schematem `PYT/1.0` (`docs/PROTOKOL.md` §3).
   Aplikacja akceptuje też surowy JSON bez ogrodzenia i JSON z błędami
   białych znaków — parser jest tolerancyjny, **walidator nie**.
5. **Walidacja przed przyjęciem** (`walidujPaczke()`): schemat, liczba pytań,
   pokrycie stacji, poprawność indeksu odpowiedzi, obecność źródeł z URL,
   brak duplikatów, zgodność tematów z kanonem, spójność z konfiguracją
   (wiek, promień, liczba stacji). Błąd = czytelna lista usterek po polsku
   + przycisk „skopiuj poprawkę do modelu" (gotowy tekst doprecyzowania, który
   organizator wkleja modelowi jako następny prompt).
6. **Wymiana przez schowek z degradacją**: `navigator.clipboard` (copy/paste)
   tam, gdzie dostępny; pole `<textarea>` do wklejenia palcem oraz **import
   z pliku** (`<input type="file">`) jako droga zapasowa — bo schowek w iframe
   preview i w niektórych przeglądarkach mobilnych nie działa (ENVIRONMENT §5).
   **Aneks 2026-09-09:** na ekranie 5 pole zapasowe jest ZWINIĘTE w `<details>`,
   a główną drogą jest przycisk „📋 Prześlij skopiowaną odpowiedź ze schowka",
   który czyta schowek i waliduje bez wypisywania treści do DOM — patrz aneks
   na końcu tego dokumentu.
7. **Model jest „zewnętrznym silnikiem treści", nie częścią systemu**: zero
   telemetrii, zero identyfikacji modelu w stanie gry poza dobrowolnym polem
   `paczka.model` (etykieta organizatora). Aplikacja musi działać identycznie
   dla odpowiedzi z Meta AI, ChatGPT, Gemini, Claude czy modelu lokalnego.
8. **Ręczna edycja paczki jest dozwolona**: organizator może poprawić pytanie
   w podglądzie „tylko dla organizatora" przed ukryciem — każda taka
   zmiana zapisuje `paczka.modyfikacje[]` (kto/co/kiedy), żeby widać było, co
   nie pochodzi od modelu.

## Konsekwencje

- Koszt UX: rozgrywkę poprzedza minuta pracy organizatora (skopiuj → wklej
  do modelu → skopiuj → wklej z powrotem). To świadoma cena za brak backendu;
  UI musi ją minimalizować (duże przyciski, jeden krok na ekran, instrukcja
  obrazkowa — ADR 0011).
- Jakość treści zależy od modelu → walidator i wymóg źródeł (ADR 0008) są
  pierwszą linią obrony; drugą jest podgląd organizatora (pkt 8).
- Brak automatyzacji oznacza, że **testy nie wołają modelu**: do testów
  służą fixture'y odpowiedzi (`test/fixtures/paczka-ok.json`,
  `paczka-bez-zrodel.json`, `paczka-zly-schemat.json`).
- Otwiera drogę do ADR 0010 pkt 4 (repozytorium paczek): raz wygenerowana
  i zweryfikowana paczka dla okolicy może być użyta ponownie bez modelu.

## Powiązania

0001 (bez zależności/backendu), 0007 (ukrywanie paczki), 0008 (kwerenda
i źródła), 0010 (trwałość paczki), 0011 (mobile-first).

## Aneksy 2026-09-09 (obie tury), 2026-09-15 i 2026-09-15d są w archiwum (poza budżetem lektury)

Historia tego ADR — wklejenie jednym przyciskiem (2026-09-09), odwrót pola
(2026-09-09, druga tura), wklejenie jako zatwierdzenie bez importu z pliku
(2026-09-09, trzecia tura), blokada domyślnej akcji `paste` (2026-09-15) oraz
jeden komunikat przy błędnej paczce bez poprawki dla modelu (2026-09-15d) —
leży w `docs/decisions/archive/aneksy-0006-2026-09-09.md`,
`...aneksy-0006-2026-09-15.md` i `...aneksy-0006-2026-09-15d.md`, poza budżetem
lektury startowej (AGENTS.md §0; LESSONS L62). Obowiązujące aneksy są niżej:
2026-09-07 (koniec edycji) i 2026-09-16d (ekran wklejania: bez instrukcji, bez
przycisku czytającego schowek, z kartą wyniku czyszczoną przy wejściu).


## Aneks 2026-09-16d — ekran wklejania bez instrukcji i bez przycisku czytającego schowek

Testy terenowe właściciela (iPhone + Chrome), uwaga A:

1. **Między nagłówkiem a polem wklejenia nie ma ŻADNEGO tekstu.** Akapit
   `.podpowiedz` („Nie pokazuj tego ekranu graczom … wklej poprawne dane.”)
   zniknął z `index.html`: organizator zna tę drogę, a na telefonie instrukcja
   zajmowała pół ekranu. Uczciwość o jawnej paczce (dawny ADR 0007 pkt 5)
   niosą dalej karta „Paczka pytań” na ekranie prywatności i README, a pin
   kontraktu pilnuje teraz PUSTKI między `</h2>` a `<textarea>`.
2. **Przycisk czytający schowek usunięty.** `navigator.clipboard.readText()`
   na iPhonie w Chrome nie oddaje treści (organizator: „w ogóle nie działa.
   Nic nie wkleja”), a w przeglądarce nie ma drugiej drogi CZYTANIA schowka.
   Zostaje wklejenie palcem do pola — ono i tak waliduje samo (aneks
   2026-09-09, trzecia tura), więc guzik był wyłącznie kosztem: zniknął
   z `index.html` i jego nasłuch z `app/app.js`, a identyfikator i etykieta są
   zapinowane w testach (LESSONS L31). Kopiowanie w drugą stronę
   („⧉ Kopiuj prompt”) zostaje bez zmian — `writeText()` działa.

3. **Karta wyniku nie dziedziczy się między grami.** Kartę `#wynik-walidacji`
   odsłania odrzucona paczka (`pokazOdrzuconaPaczkeAi`) i nikt jej potem nie
   chował — w kolejnej grze wisiał na niej komunikat „Paczka przyjęta (bez
   fact-check)” z poprzedniej. Wejście na krok 5 woła `wyczyscEkranPaczki()`
   (karta schowana, nagłówek i `#wklejka-status` puste, pole puste), a
   `wrocNaPoczatek()` czyści to samo na końcu gry; `#status` startuje na tym
   ekranie pusty. Pin kontraktu pilnuje obu wywołań, test — dwóch gier w jednej
   sesji strony z odrzuconą paczką w pierwszej (LESSONS L77/L78).

Nie zmienia się: nasłuch `paste` (walidacja przy wklejeniu), czyszczenie pola
(dawny ADR 0007 pkt 4), jeden komunikat przy złej paczce (aneks 2026-09-15d)
i automatyczny start gry po przyjęciu paczki.

## Aneks 2026-09-07 jest w archiwum (poza budżetem lektury)

Poprawna paczka od razu zaczyna grę; podgląd i edycja treści są na Drive
(ADR 0016) — `docs/decisions/archive/aneksy-0006-2026-09-07.md`.
