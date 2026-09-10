# 0035 — Overpass: FOSSGIS pierwszy, krótkie próby i jawny przebieg

- Status: Zaakceptowana
- Data: 2026-09-10
- Podstawa: właściciel nie widzi próby FOSSGIS, chce 10 s zamiast wydłużania i więcej serwerów, jeśli to możliwe.

## Decyzja

1. FOSSGIS zawsze pierwszy. Ostatnia sprawna instancja porządkuje wyłącznie
   rezerwy. Nie pomijamy FOSSGIS na podstawie pamięci telefonu.
2. Limit całej próby 10 s (nagłówki i ciało); QL timeout 8 s. Promise.race
   domyka również próbę z niedziałającym abort. AbortController przerywa
   lokalne pobieranie; nie gwarantuje przerwania pracy zdalnego serwera.
   Timer zawsze usuwany w finally. Timeout rozpoznajemy po własnym stanie,
   nie tylko nazwie AbortError; po nim natychmiast kolejna instancja.
3. HTTP 403/404 oraz odpowiedź niebędąca JSON-em pozwalają spróbować rezerwy.
   HTTP 400 nadal kończy błędne zapytanie. Dotychczasowa pauza 1 s po
   406/429/5xx przy zmianie serwera pozostaje (nie ponawiamy tej samej instancji).
4. Panel stacji pokazuje listę: numer próby / liczba instancji, nazwa,
   oczekiwanie i wynik. Lista zostaje po sukcesie lub błędzie, do następnego
   przeliczenia. Oko nadal ukrywa panel bez przerywania pobierania.
5. Bez dodawania niezweryfikowanych adresów. Pozostają trzy instancje.
   Wskazany przez właściciela overpass-api.de to FOSSGIS, już obecny.
   Próba HTTPS POST do overpass.openstreetmap.ru/api/interpreter z sandboxa
   zakończyła się błędem TLS (curl 35, HTTP 000), więc nie dokładamy tej
   instancji jako rzekomo działającej. To nie diagnoza globalnej awarii.
   Alternatywy wymagające kluczy, opłat lub obejmujące inny region nie są
   automatycznie włączane. Brak nowego dostawcy i zmian prywatności.

## Weryfikacja i granice diagnozy

Regresje: FOSSGIS mimo zapamiętanego VK, brak nagłówków, zatrzymane ciało,
niestandardowy błąd abort, trzy próby po 10 s, lista błędów, rezerwa po 403.
Testy używają przyspieszonych timerów i atrap sieci; nie dowodzą bieżącej
sprawności publicznych instancji ani przyczyny porannego/popołudniowego zdarzenia.
