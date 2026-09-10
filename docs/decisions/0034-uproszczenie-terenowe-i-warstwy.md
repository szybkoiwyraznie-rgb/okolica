# 0034 — Uproszczenie terenowe: wybory setupu, warstwy i dojście 50 m

- Status: Zaakceptowana (zlecenie właściciela po testach terenowych 2026-09-10)
- Data: 2026-09-10

## Decyzja

1. Nowy setup udostępnia wiek 7, 12, dorośli. Sport i Jedzenie znikają
   z wyboru; dochodzą Ciekawostki. Domyślne tematy są alfabetyczne,
   „Dopisz sam” pozostaje osobną opcją na końcu. Kanon odczytu zachowuje
   stare klucze (10/15/sport/jedzenie) dla paczek, historii i wznowienia.
   Ostatni setup z wiekiem 10 przechodzi na 12, z 15 na dorosłych;
   usunięte tematy nie przechodzą do nowego setupu. Zapis trwającej gry
   nie jest przeliczany. Schemat PYT pozostaje 1.0 (pole tematu z kanonu).
2. Dojście: pojedyncza poprawna pozycja w odległości ≤50 m otwiera pytania.
   `accuracy` z GPS nie bierze udziału w decyzji, komunikatach ani rysowaniu
   koła. Nie ma ostrzeżenia o dokładności, progu dokładności ani debounce
   dwóch fixów. Nieprawidłowe współrzędne nadal są odrzucane.
   Zastępuje kryterium i raportowanie z ADR 0004; ADR 0029 (bez ręcznego
   zaliczania) pozostaje. Stare pola dokładności są tolerowane przy odczycie.
3. Setup i karty odpowiedzi: centralny panel nad przygaszoną mapą,
   szerokość 90% dostępnego ekranu z limitem desktopowym, poniżej nagłówka.
   Treść przewija się wewnątrz panelu. Przycisk oka w prawym dolnym rogu
   przełącza widoczność paneli i przygaszenia, nie fazę ani stan gry.
   Ukryte panele nie przyjmują fokusu; ponowne kliknięcie przywraca widok.
   Zastępuje układ przyklejonych do dołu/boku kart ADR 0030.
4. Stopka znika. Jej treść, wersje, status i dostęp do prywatności trafiają
   do domyślnie schowanej warstwy informacji otwieranej przyciskiem ⓘ
   w nagłówku. Błędy krytyczne nadal mają lokalne komunikaty przy akcji.
5. Ekran pozycji nie ma przycisku GPS, ręcznych pól współrzędnych ani
   symulacji 250 m. GPS startuje automatycznie. W trybie testowym pozostaje
   tap mapy do wskazania pozycji i symulacja dojścia w samej rozgrywce.
6. Instrukcja promptu domyślnie zwinięta, rozwijana nagłówkiem
   „→ Prompt dla modelu AI (instrukcja)”. Linki Meta AI, ChatGPT i Gemini
   otwierają nową kartę bez dostępu do opener. Treść promptów i warianty
   fact-check pozostają bez zmian poza nowym tematem w kanonie.

## Konsekwencje

Testy obejmują nowe wybory i zgodność starych paczek, granicę 50 m przy
każdej accuracy, usunięte kontrolki, przełączniki warstw oraz weryfikację
układu w Chromium mobile w pionie i poziomie. Bez nowych dostawców danych,
frameworków, zależności ani zmian mostu. Próba w przeglądarce nie zastępuje
kolejnego testu terenowego właściciela.
