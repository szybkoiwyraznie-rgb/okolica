# 0015 — Niekompletna paczka i pominięcie stacji: gra nie staje w terenie, ale nic nie znika po cichu

- Status: Proponowana (reguły wyszły przy implementacji `app/rozgrywka.js`
  w M1; do potwierdzenia przez właściciela)
- Data: 2026-09-05

## Kontekst

Model rozgrywki (M1) musiał rozstrzygnąć dwa przypadki, których ADR 0009
i ADR 0014 nie opisują, a które w terenie zdarzają się naprawdę:

1. **Paczka nie pokrywa wszystkich stacji.** Prompt idzie do modelu AI poza
   aplikacją (ADR 0006), więc organizator może wrócić z paczką na 3 stacje,
   mając w konfiguracji 5 — albo z paczką, w której jedno pytanie przepadło
   przy kopiowaniu. Walidator paczki (`walidujPaczke`) sprawdza spójność
   wewnętrzną (protokół §3.2: każde pytanie ma stację, rozkład równy ±1), ale
   nie zna liczby stacji bieżącej gry.
2. **Gracz doszedł do stacji i nie może albo nie chce odpowiedzieć.** Pytanie
   bywa zepsute (model zwrócił treść niezwiązaną z miejscem), a w trybie
   hot-seat organizator może chcieć iść dalej.

Pierwsza implementacja miała ciche pułapki: stacja bez pytania zostawała w fazie
`pytanie` bez akcji wyjścia, a pominięcie po dojściu zamieniało odcinek
`zakonczony` na `pominiety` — wyrzucało z dziennika i z mediany pomiar, który
się wydarzył.

## Decyzja

1. **Niekompletna paczka nie blokuje gry.** `nowaRozgrywka()` zapisuje w stanie
   listę `brakPytan` (stacje bez pytania) i dodaje do dziennika zdarzenie
   `ostrzezenie` z kodem `BRAK-PYTAN` oraz zdaniem mówiącym, co zrobić (wgrać
   paczkę z pełnym pokryciem). Gra w terenie to najgorszy moment na odmowę
   uruchomienia — organizator stoi z grupą na ulicy.
2. **Dojście do stacji bez pytania zamyka ją bez punktów.** `zakonczOdcinek()`
   po zapisaniu dojścia sprawdza, czy stacja jest zamknięta, i jeśli tak —
   przechodzi dalej. Odcinek zostaje `zakonczony` (czas, tempo, dokładność są
   zachowane), odpowiedzi nie ma, punktów nie ma. Bez tego gra stanęłaby na
   pustym ekranie pytania.
3. **Pominąć można tylko odcinek w drodze.** Po dojściu `pominStacje()` odmawia
   z kodem `G13` i komunikatem, który mówi, co zrobić zamiast tego: odpowiedzieć
   na pytanie, choćby błędnie (błędna odpowiedź daje 0 punktów i rusza grę
   dalej — ADR 0009 pkt 5). Powód: pominięcie po dojściu kasowałoby pomiar,
   który się wydarzył, i zmieniał wynik gry wstecz.
4. **Odcinek pominięty nie wchodzi do próbek mediany.** `premiaCzasu()` liczy
   próbki wyłącznie z odcinków `zakonczony` (ADR 0014 pkt 2) — pominięcie nie
   jest wynikiem, który da się porównać z dojściem.
5. **Liczniki postępu i wyniki liczą tak samo.** `podglad()` (pasek postępu
   w trakcie gry) i `podsumowanie()` (tabela na końcu) używają tej samej
   definicji: `zaliczoneStacje` = odcinki `zakonczony`, `pominietaStacje` =
   odcinki `pominiety`, `pozostaloStacje` = reszta. Dwie różne definicje tej
   samej liczby w jednym interfejsie to usterka, nie styl.
6. **Kody usterek mają przedrostki dziedzinowe i nie kolidują.** Rozgrywka:
   `G01`–`G13`. Pozycja i GPS: `P01`–`P09`. Konfiguracja: `K01`–`K20`. Paczka
   i prompt: `E01`–`E20`. Każdy komunikat jest pełnym zdaniem z wyjściem
   awaryjnym (ADR 0004 pkt 7) i wchodzi do UI bez przeróbek — warstwa DOM nie
   wymyśla własnych zdań ani własnych kodów.

## Konsekwencje

- Organizator widzi braki paczki **zanim** wyjdzie w teren (ostrzeżenie w
  dzienniku od startu gry), a nie w momencie dojścia do czwartej stacji.
- Wynik gry nie zależy od tego, czy gracz „wymazał" dojście pominięciem:
  dziennik zdarzeń jest spójny z odcinkami, a `wczytajStan()` odtwarza ten sam
  stan (ADR 0010 pkt 6).
- Przypadek „paczka bez pytania" jest głośny, ale miękki: gra się toczy, punktów
  nie ma, ślad zostaje. Alternatywa (twarda odmowa startu) została odrzucona —
  patrz pkt 1.
- Wymaga testów: przejście faz przy niekompletnym pokryciu, odmowa pominięcia
  po dojściu (`G13`), spójność liczników `podglad` ↔ `podsumowanie`, kontrakt
  na kształt komunikatów (pełne zdania, osobne przedrostki) —
  `test/rozgrywka.test.js`, `test/pozycja.test.js`.
- Do rozważenia później (poza M1): przycisk „pomiń pytanie" w UI, który jawnie
  zapisuje odpowiedź błędną z powodem organizatora w dzienniku — dziś tę rolę
  pełni zwykła błędna odpowiedź.

## Powiązania

0004 (kryterium dojścia, komunikaty GPS), 0006 (paczka z zewnątrz),
0007 pkt 6 (stan bez treści pytań), 0009 (model rozgrywki), 0010 (trwałość
i jawna odmowa przy obcym schemacie), 0014 (punktacja czasu).
