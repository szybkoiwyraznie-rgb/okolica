# 0036 — Wąski pasek podczas drogi, pytanie w dużym panelu

- Status: Zaakceptowana
- Data: 2026-09-10
- Podstawa: polecenie właściciela oraz doprecyzowanie, że pasek dotyczy tylko drogi, a pytania zostają w panelu szerokości 90%.

## Decyzja

Podczas odcinka centralny panel gry zastępuje jednowierszowy pasek przy
samym dole viewportu: „Kto: Imię (125 m) · stacja 1 z 5”. Dystans jest
aktualizowany z pomiarów GPS; brak pozycji oznaczony kreską. Długie nazwy
przewijają się poziomo bez łamania paska na kilka wierszy. Mapa bez przygaszenia.
Pasek uwzględnia safe area. Oko, skala i atrybucja mapy przesunięte nad pasek.

Istniejące kontrolki i szczegóły gry (pauza, pominięcie, zakończenie,
symulacja, sterowanie multi, komunikaty) podczas drogi trafiają do panelu
ⓘ Informacje. Przenosimy te same węzły DOM, nie klonujemy przycisków ani
nasłuchów. Poza drogą wracają do panelu gry; inne ekrany nie pokazują
sterowania rozgrywki w Informacjach. Pauza w drodze zachowuje pasek.

Dojście nadal wymaga dwóch kolejnych pomiarów ≤50 m, niezależnie od accuracy.
Po dojściu pasek znika i pojawia się dotychczasowy duży panel pytania 90%
szerokości (limit desktopowy bez zmian). Jeśli otwarte były Informacje,
zamykamy je, by odsłonić pytanie. Świadomy podgląd mapy okiem nadal działa
bez deaktywacji gry. Przygotowanie i końcowe wyniki zachowują duży panel.

## Weryfikacja

Regresja aplikacji: przygotowanie → odcinek/pasek → Informacje/pauza →
wznowienie → symulacja dojścia → automatyczne pytanie. Kontrola rodzica
przenoszonego sterowania i stanu przygaszenia. Atrapa appendChild respektuje
przenoszenie węzłów tak jak DOM przeglądarki.
Chromium: 360×640, 320×568 i 844×390; pasek 37 px, jedna linia, dół viewportu,
oko powyżej, brak przewijania strony. Pauza i symulacja kliknięte z Informacji,
pytanie wraca do szerokości 90%. Próba z fixture, bez potwierdzenia GPS w terenie.

## Aneks 2026-09-12 (m12-94) — bez pominięcia na liście kontrolek (zadanie H)

Lista „pauza, pominięcie, zakończenie, symulacja, …” w decyzji traci
środkowy element: akcja pomijania wycofana (ADR 0015 aneks 2026-09-12).
Do Informacji w drodze trafiają: pauza, zakończenie, symulacja,
sterowanie multi, komunikaty. Mechanika przenoszenia węzłów bez zmian.

## Aneks 2026-09-13 (m12-101) — pytanie i możliwe odpowiedzi w zwijanym elemencie (uwaga z testów A)

Właściciel po grze w terenie: **„Ekran z pytaniami podczas gry. Gracz odpowiada.
Musimy zaoszczędzić trochę miejsca, żeby nie było scrollowania. Wyświetlając
poprawną odpowiedź i komentarz do niej ukryj treść pytania i możliwe odpowiedzi
(te przywróć, bo jakiś czas temu je usunęliśmy), ale umieść pytanie i możliwe
odpowiedzi w zwijalnym elemencie (analogicznym np. do instrukcji generowania
pytań czy do promptu — domyślnie zwiniętym). Zostaw na wierzchu łapki do
oceniania i oczywiście poprawną odpowiedź z komentarzem.”**

1. **Panel pytania (faza C) ma teraz `<details id="gra-pytanie-detale">`** —
   ten sam wzorzec co ekran promptu (`#prompt-zwiniety`). W środku: treść
   pytania (`#gra-pytanie-tresc`), klikalne warianty (`#gra-odpowiedzi`)
   i statyczna lista wariantów (`#gra-odpowiedzi-lista`).
2. **Faza odpowiedzi: details OTWARTY** (`open` w HTML i w `renderujPytanie()`) —
   gracz musi widzieć pytanie i warianty, na które odpowiada. Statyczna lista
   jest wtedy schowana.
3. **Pokaz wyniku: details ZWINIĘTY** (`odpowiedzNaPytanie()` zdejmuje `open`),
   klikalne warianty znikają (jak od 2026-09-11 — jedna odpowiedź na pytanie,
   bez poprawek), a w ich miejsce WRACA statyczna lista wariantów w środku
   zwiniętego elementu. Na wierzchu zostają: badge nagłówka, summary, łapki
   (ADR 0028), ocena z poprawną odpowiedzią, wyjaśnienie, źródła (ADR 0008)
   i przycisk „dalej” — na 360×640 bez przewijania.
4. **Łapki nie wchodzą do zwijanego elementu** — ocenić pytanie można przed
   odpowiedzią i po niej (ADR 0028 bez zmian), więc panel oceny siedzi w DOM-ie
   ZA `</details>`, a PRZED wynikiem odpowiedzi. Stary pin „panel przed
   odpowiedziami” przepisał się na nową kolejność (LESSONS L55).
5. **Mechanika bez zmian:** pytanie dalej odsłania się DOPIERO przy dojściu
   (ADR 0007 pkt 6), `pytanie.odpowiedzi` dalej są jedynym źródłem wariantów,
   a wynik i wyjaśnienie biorą się z paczki.
