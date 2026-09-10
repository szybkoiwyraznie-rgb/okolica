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
