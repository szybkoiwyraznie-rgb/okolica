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

## Aneks 2026-09-13 (m12-102) — w Informacjach zostaje wyłącznie „Zakończ grę” (uwagi B, E, F)

Akapit „Istniejące kontrolki i szczegóły gry (pauza, pominięcie, zakończenie,
symulacja, sterowanie multi, komunikaty) podczas drogi trafiają do panelu
ⓘ Informacje” traci ważność w tej formie: pauzy nie ma (ADR 0040), pominięcia
nie ma (ADR 0015 aneks 2026-09-12), a właściciel po testach terenowych
2026-09-13 zażądał usunięcia całego boksu („186 m do stacj 1 / > Wznów /
Śledzenie położenia jest wstrzymane…. / … gdy wszyscy gotowi”) oraz — dla gry
wieloosobowej — „nic dodatkowego nie doklejamy do panelu Informacje ponad to co
jest w trybie hotseat… W Informacjach zostaje tylko opcja ZAKOŃCZ GRĘ”.

1. **W drodze do Informacji wędruje JEDEN węzeł:** `#przycisk-zakoncz-gre`,
   nadal bez klonowania przycisków i nasłuchów (mechanika z decyzji zostaje).
   Slotem jest `#przycisk-zakoncz-gre-slot` i tam przycisk wraca poza drogą.
2. **Panel gry (`#gra-sterowanie`) jest w drodze schowany** — nad mapą zostaje
   sam pasek (`#gra-pasek`) z zieloną pigułą dystansu (2026-09-11). Panel fazy B
   trzyma duży dystans i symulację dla widoku panelowego oraz trybu testowego.
3. **Boks z dystansem i wznawianiem w Informacjach nie wróci** — pilnuje
   kontrakt ADR 0040 (`test/kontrakt.test.js`) i wpisy w strażniku dryfu.
4. Reguła `#informacje-gra h2` w `styles.css` usunięta razem z przenoszeniem
   nagłówka „Gra” (LESSONS L31: usunięcie i grep w tym samym commitcie).

## Aneksy 2026-09-13 (m12-107) i 2026-09-13b (m12-112) są w archiwum

Oba przesądza żywy ADR 0043: z Informacji zszedł ostatni węzeł gry (przycisk
kończenia), w drodze nad mapą zostaje sam pasek, a `hidden` na panelu gry gaśnie
w trybie testowym, żeby „▶ Symuluj dojście" było osiągalne. Dosłowne brzmienie
aneksów: `docs/decisions/archive/aneksy-0036-2026-09-13-do-13b.md`.
