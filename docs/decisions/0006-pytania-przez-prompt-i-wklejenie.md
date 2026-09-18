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


## Aneks 2026-09-16d (ekran wklejania bez instrukcji i przycisku czytającego schowek) jest w archiwum

Testy terenowe 2026-09-16d (uwaga A): pusta przestrzeń między nagłówkiem a polem
wklejenia (pin kontraktu pilnuje PUSTKI), przycisk `readText()` usunięty (nie
działa na iPhonie — wklejenie palcem waliduje samo), karta wyniku nie dziedziczy
się między grami (`wyczyscEkranPaczki`, LESSONS L31/L77).
`docs/decisions/archive/aneksy-0006-2026-09-16d.md` (L62/L66, archiwizacja 2026-09-18).
## Aneks 2026-09-07 jest w archiwum (poza budżetem lektury)

Poprawna paczka od razu zaczyna grę; podgląd i edycja treści są na Drive
(ADR 0016) — `docs/decisions/archive/aneksy-0006-2026-09-07.md`.
