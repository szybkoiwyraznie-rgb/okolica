# 0038 — Minimalny ekran wyniku: zwycięzca, ranking i powrót

- Status: Zaakceptowana
- Data: 2026-09-12
- Podstawa: zgłoszenie właściciela („W ogóle ta strona Wyniki ma masę błędów
  i niepotrzebnych informacji").

## Kontekst

Ekran „🏁 Koniec gry!” rósł od M7 przez kolejne sesje: pod kartą zwycięzcy
doszły statystyki gry, zwijane „Szczegóły graczy” i „Stacje”, pole
„Tekst wyniku” i pięć przycisków eksportu (udostępnij / kopiuj / .txt / .png /
udostępnij obraz), a nad nimi — bo panel końca mieszka w tym samym slocie co
gra — zostawał górny fragment ekranu gry: nagłówek „Gra”, badge'y kolejki
i dystansu, liczniki oraz przyciski „Pomiń odcinek” / „Zakończ grę”.

Dla gracza kończącego grę w terenie ten ekran miał jedno zadanie: powiedzieć,
kto wygrał, i pozwolić zacząć od nowa. Reszta była treścią dla projektanta
(statystyki, rozbicia na odcinki) albo drogą wyjścia z aplikacji (eksporty),
której nikt nie używał — a każda z tych rzeczy to miejsce, w którym coś mogło
się zepsuć i wymagać uwagi.

## Decyzja

1. **Ekran wyniku to trzy rzeczy**: karta zwycięzcy (imię, punkty,
   poprawne/razem), tabela rankingu (te same kolumny co w panelu multi: gracz,
   punkty, poprawne) i jeden przycisk „🏠 Wróć na początek — nowa gra”.
2. **Faza `koniec` ukrywa CAŁY slot sterowania** (`#gra-slot-sterowanie`) —
   nie tylko w fazie pytania. Nad wynikami nie może zostać żaden element stanu
   gry (nagłówek, badge'y, „Pomiń odcinek”, „Zakończ grę”).
3. **Usunięte z ekranu i z kodu** (HTML, CSS i wszystkie funkcje, które je
   wypełniały): statystyki gry, szczegóły graczy, tabela stacji, eksport tekstu
   (share / schowek / plik `.txt`), eksport obrazu (`.png` / share), pole
   „Tekst wyniku”, linia wariantu fact-checku (oba zdania — dla paczek
   z weryfikacją i bez).
4. **Ranking zostaje, bo czytają go inni**: tabela `#gra-wyniki` jest tym samym
   widokiem co w panelu multi, a wynik gry nadal trafia do historii
   (`okolica:historia`, ADR 0010 pkt 1) i na Drive (ADR 0026 aneks) — dane
   o grze nie giną razem z ekranem.
5. **Moduł `app/wynik.js` zostaje w repozytorium** z własnymi testami
   (`test/wynik.test.js`), choć po tej decyzji nie ma konsumenta w UI. To
   biblioteka czystych funkcji (formatowanie liczb, tekst wyniku, plan obrazu)
   — usunięcie modułu to osobna decyzja, a nie skutek uboczny zmiany ekranu.
6. **Konflikt z ADR 0010 pkt 5 odnotowany**: ten punkt obiecywał „wynik gry
   eksportowalny (podsumowanie jako tekst/obraz do udostępnienia)”, a my
   właśnie zdjęliśmy tę drogę z UI. Decyzja właściciela (2026-09-12) jest
   późniejsza i wiążąca: eksport wyniku **nie jest** częścią aplikacji.
   Przywrócenie eksportu wymaga nowego ADR, nie „przy okazji”.
7. **Kamień M7 „czytelność + eksporty”**: część „eksporty” jest tą decyzją
   zdjęta z zakresu (nie „odłożona na potem”); część „czytelność” obowiązuje
   dalej.

## Konsekwencje

- Ubyło ~250 linii `app.js` i cała martwa gałąź rysowania na canvasie
  (`PALETA_AWARYJNA`, `paletaZCss`, `rysujWynikNaCanvas`, `eksportujWynikObraz`,
  `pobierzPlik`, nazwy plików, `dataWynikuTekst`, `STAN.wynikTekst`) razem
  z pięcioma nasłuchami; `kopiujTekst` został, bo używają go prompt i poprawka.
- Ekran wyników jest teraz domknięty: **dodanie czegokolwiek** (statystyk,
  przycisku, pola) wymaga świadomej decyzji, a testy kontraktu pinują listę
  identyfikatorów, których w `index.html` nie wolno już mieć.
- Testy warstwy aplikacji przepisane na nowy kontrakt: brak eksportów
  (zero canvasów i linków z `download`), minimalny ekran także po ręcznym
  zakończeniu gry, pełna gra end-to-end bez tekstu wyniku.
- Historia gier i wysyłka na Drive zachowują się bez zmian — wynik nadal da się
  odczytać z `localStorage` i z repozytorium, tylko nie z tego ekranu.

## Powiązania

0010 pkt 5 (eksport wyniku — sprzeczny, ta decyzja jest późniejsza),
0022 (kto odpowiada; ranking niesie kolejność graczy), 0026 aneks (linia
wysyłki `#wynik-drive` zostaje), 0032 (linia wariantu w panelu multi zostaje),
0011 (mobile-first: mniej treści na 360 px), LESSONS L23 (czytanie liczb
z elementu, nie z `textContent`).
