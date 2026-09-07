# Rejestr decyzji architektonicznych (ADR)

ADR zapisują decyzje, których nie powinno się odtwarzać z historii czatu.
Każdy dokument opisuje kontekst, wybór i jego konsekwencje.

## Statusy

- **Proponowana** — kierunek do dyskusji, nie zobowiązanie; trwałych rozwiązań
  bez akceptacji nie buduj (akceptacja = zmiana statusu + wpis w historii).
- **Zaakceptowana** — obowiązuje w projekcie.
- **Odrzucona** — rozważona, ale nieprzyjęta.
- **Zastąpiona** — historyczna; nowszy ADR wskazuje aktualną decyzję.
- **Wycofana** — nie ma już zastosowania.

## Decyzje

| ADR | Tytuł | Status |
| --- | --- | --- |
| [0001](0001-vanilla-static-app-no-build.md) | Statyczna aplikacja vanilla HTML+JS (ESM) bez kroku budowania i bez zależności | Zaakceptowana |
| [0002](0002-hosting-github-pages-sciezki-wzgledne.md) | Hosting: GitHub Pages z gałęzi `main` (katalog główny), wszystkie ścieżki względne | Zaakceptowana |
| [0003](0003-mapa-kafelkowa-bez-bibliotek.md) | Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych) | Zaakceptowana |
| [0004](0004-geolokalizacja-i-kryterium-dojscia.md) | Geolokalizacja `watchPosition` i kryterium dojścia do stacji | Zaakceptowana |
| [0005](0005-stacje-z-sieci-drogowej-overpass.md) | Stacje z sieci drogowej (Overpass API): kandydaci, filtry dostępności, wybór sprawiedliwy pod ziarnem | Proponowana |
| [0006](0006-pytania-przez-prompt-i-wklejenie.md) | Treść pytań: prompt generowany przez aplikację → model AI → wklejenie odpowiedzi (bez backendu i bez kluczy API) | Zaakceptowana |
| [0007](0007-ukrywanie-paczki-obfuskacja-bez-klucza.md) | Ukrywanie paczki pytań: odwracalna obfuskacja bez klucza (nie szyfrowanie) | Zaakceptowana |
| [0008](0008-kwerenda-i-zrodla-w-kazdym-pytaniu.md) | Obowiązkowa kwerenda internetowa i źródło URL przy każdym pytaniu | Zaakceptowana |
| [0009](0009-jeden-telefon-hot-seat.md) | Model rozgrywki wieloosobowej: jeden telefon (hot-seat), bez synchronizacji urządzeń | Zaakceptowana |
| [0010](0010-trwalosc-localstorage-i-eksport-paczki.md) | Trwałość: `localStorage` dla rozgrywki, paczka pytań jako eksportowalny plik, docelowo repozytorium paczek | Proponowana |
| [0011](0011-mobile-first-dotyk.md) | Mobile-first: interfejs dotykowy jako podstawowy, dostępność i czytelność w słońcu | Zaakceptowana |
| [0012](0012-model-sesji-pr-audyt-inkrementalne-commity.md) | Model sesji: PR na starcie, audyt poprzedniego PR, inkrementalne commity, bez force push | Zaakceptowana |
| [0013](0013-prywatnosc-wspolrzedne-na-urzadzeniu.md) | Prywatność: współrzędne gracza nie opuszczają urządzenia poza zapytania mapowe, zero analityki | Proponowana |
| [0014](0014-punktacja-czasu-mediana-tempa.md) | Punktacja czasu: premia względem mediany tempa odcinków (doprecyzowanie ADR 0009 pkt 5) | Proponowana |
| [0015](0015-niekompletna-paczka-i-pominiecie-stacji.md) | Niekompletna paczka i pominięcie stacji: ostrzeżenie zamiast blokady, pominięcie tylko w drodze, spójne liczniki i przedrostki kodów | Proponowana |
| [0016](0016-trwaly-backend-google-drive-apps-script.md) | Trwały backend: Google Drive + Apps Script na wydzielonym koncie (repo paczek, stan gry, droga do multi-device) | Zaakceptowana |
| [0017](0017-repozytorium-paczek-to-zestaw.md) | Repozytorium paczek: schemat `TO-zestaw/1`, geohash5 w indeksie, CC BY-SA 4.0, moderacja właściciela | Proponowana |
| [0018](0018-drive-backend-wielozadaniowy.md) | Drive jako backend wielozadaniowy (paczki, parowanie gier, statystyki); wdrożenie odroczone, instrukcja w czacie | Zaakceptowana |
| [0019](0019-gra-wieloosobowa-multi-device.md) | Gra wieloosobowa na wielu urządzeniach: lobby + kod gry, wyścig i tury, zdarzenia bez współrzędnych, rankingi (ogólne/wiek/tematy/lokalizacja) | Zaakceptowana |
| [0020](0020-adres-mostu-wpisany-w-kod-aplikacji.md) | Adres mostu Drive wpisany w kod aplikacji (`DOMYSLNY_URL_MOSTU`), bez pola do wpisywania w UI; nadpisanie techniczne w `localStorage` | Zaakceptowana |

## Szablon ADR

```markdown
# NNNN — <tytuł>

- Status: <Proponowana | Zaakceptowana | Odrzucona | Zastąpiona | Wycofana>
- Data: <RRRR-MM-DD>
- Kontekst: <siły, problem, ograniczenia>
- Decyzja: <co przyjmujemy>
- Konsekwencje: <co z tego wynika, w tym koszty i ryzyka>
- Powiązania: <numery innych ADR-ów>
```

Numeracja: kolejna wolna liczba czterocyfrowa. Rejestr aktualizuj w tej tabeli
w tym samym commicie, w którym dodajesz ADR. Nazwy plików: ASCII, małe litery,
myślniki (bez polskich znaków) — linki nie mogą się rozsypywać w narzędziach.

## Gdzie zapisać regułę

Kanoniczną tabelę „rodzaj treści → miejsce" trzyma `AGENTS.md` §5 (jedno
miejsce, bez kopii): wiążąca decyzja → ADR tutaj; szablon/schemat/rygory →
PROTOKÓŁ; pułapka diagnostyczna → LESSONS; reszta wg tabeli. Reguły trwałe
nigdy w handoffie (jedna sesja, traci aktualność).
