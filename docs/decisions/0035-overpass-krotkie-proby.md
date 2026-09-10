# 0035 — Overpass: krótkie próby i diagnostyka połączenia

- Status: Zaakceptowana
- Data: 2026-09-10
- Podstawa: właściciel nie widzi próby FOSSGIS, chce 10 s zamiast wydłużania i więcej serwerów, jeśli to możliwe.

## Decyzja pierwotna — punkty 1, 4 i 5 zmienione aneksem poniżej

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


## Aneks 2026-09-10 — korekta właściciela (m12-60, obowiązuje)

Wymuszenie FOSSGIS na początku i diagnostyka na ekranie stacji nie były
intencją właściciela. Przywracamy pierwszeństwo ostatniej sprawnej instancji
z `okolica:overpass-sprawny`; pozostałe zachowują kolejność bazową bez dubli.
Lista prób (serwery, numery, wyniki) trafia wyłącznie do ⓘ Informacje.
Na stacjach zostaje ogólny postęp/błąd z odesłaniem do informacji, bez nazw
serwerów i szczegółów technicznych. Limit 10 s i naprawy timeoutu bez zmian.

Na wyraźne życzenie właściciela dodano czwartą instancję:
`https://overpass.osm.adikso.net/api/interpreter` (do podanego `/api/`
dopisujemy standardowy endpoint `interpreter`). Po sukcesie jest pamiętana
na tych samych zasadach. W razie niepowodzenia nie blokuje pozostałych.
Własna próba HTTPS POST z sandboxa zakończyła się błędem TLS (curl 35,
HTTP 000); odczyt strony przez narzędzie WWW również się nie udał. Nie
potwierdzono dostępności, CORS, polityki ani zakresu danych instancji.
To świadomie dodana próba wskazanego serwera, nie deklaracja jego sprawności.
Dostawca wymieniony w ASSETS oraz sekcji prywatności. Do sprawdzenia z telefonu.

Testy: preferencja VK i Adikso, pełny łańcuch czterech prób, sukces Adikso
z atrapą danych z Polski, umiejscowienie logu wyłącznie w Informacjach,
brak nazw instancji w błędzie na stacjach. Żadnych nowych kluczy ani opłat.
