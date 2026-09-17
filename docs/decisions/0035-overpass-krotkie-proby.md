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


## Aneks 2026-09-17 — weryfikacja terenowa z Polski, ostateczny łańcuch (m12-154)

Tego samego dnia właściciel wykonał z telefonu (Polska, LTE) pomiary
rzeczywistego czasu odpowiedzi każdej z czterech skonfigurowanych instancji
oraz kilku dodatkowych, na surowym `fetch` z konsoli przeglądarki. Wyniki:

| Endpoint | Czas odpowiedzi | Wynik |
| --- | --- | --- |
| overpass-api.de (FOSSGIS) | **712 ms** | OK, poprawne dane |
| overpass.kumi.systems | **32,7 s** | OK, poprawne dane |
| overpass.private.coffee | 32,7 s | alias do Kumi (ten sam IP 193.219.97.30) |
| maps.mail.ru (VK Maps) | 567 ms | HTTP 504 — zawsze |
| overpass.osm.ch | 313 ms | 0 elementów w Polsce (tylko CH) |
| overpass.nchc.org.tw (Tajwan) | 477 ms | błąd CORS z przeglądarki |
| overpass.osm.adikso.net | — | błąd TLS (tak samo jak sandbox) |
| overpass-api.fr | — | instancja wyłączona od 2022-01-29 |

Decyzja:
1. Z łańcucha zostają TYLKO dwie instancje: **FOSSGIS jako główna**,
   **Kumi Systems jako ostateczny backup** (private.coffee wyrzucamy jako
   alias-duplikat; VK/Adikso/osm.ch/osm.fr/nchc jako nie działające z Polski).
2. Kolejność: FOSSGIS pierwszy. Wbrew wcześniejszej sugestii Gemini
   (która proponowała Kumi jako główne i wyłączone URL-e bez `/api/`),
   FOSSGIS jest 45× szybszy z Polski — nie ma powodu go ukrywać za
   wolną instancją.
3. Zróżnicowane limity czasu: **12 s na FOSSGIS** (jeśli nie odpowie
   w 12 s — jest przeciążona; przełączamy od razu), **40 s na Kumi**
   (pomiar pokazał 32,7 s przy poprawnych danych, więc potrzebny
   zapas na wyjątkowo obciążone chwile).
4. QL timeout podniesiony z 8 s do **25 s** — większe zapytania
   (R = 10 km × 1,15) potrafią trwać dłużej po stronie serwera,
   zwłaszcza na zapasowej instancji.
5. Mechanizm „zapamiętana sprawna instancja pierwsza" pozostaje
   bez zmian: jeśli ostatnia gra pobrała dane z Kumi, kolejna też
   zacznie od Kumi.
6. Pauza po 429/5xx pozostaje 1 s (nie zmieniamy mechaniki, bo i tak
   są teraz tylko dwie próby, a 1 s to grzeczność, nie kara).

Konsekwencje w kodzie:
- `INSTANCJE_OVERPASS` ma teraz 2 elementy, każdy z własnym polem `timeoutMs`.
- Nowa funkcja `timeoutInstancji(i)` zwraca per-instancję limit, domyślnie
  `POLITYKA.timeoutMs` (teraz 12 s).
- Funkcja pobierania w `app.js` bierze limit z konfiguracji instancji,
  a nie ze stałej; komunikaty w logu prób pokazują właściwy limit sekundy.
- `POLITYKA.timeoutZapytaniaS = 25`.
- Wersja oznaczona `m12-154`, cache-busty podbite, testy i kontrakt
  zaktualizowane, ASSETS §2 przepisane, ADR 0035 z aneksem.

Testy: kolejność 2 instancji, per-instancja timeoutów (12 s vs 40 s),
log prób pokazuje właściwe liczby sekund, ASSETS i kontrakt nie zawierają
już usuniętych endpointów, Kumi zostaje zapamiętany jako sprawny i jest
pierwszy w kolejnej grze (analogicznie jak wcześniej Adikso). Żadnych
nowych dostawców, kluczy ani zmian prywatności.
