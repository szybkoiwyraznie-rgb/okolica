# Rejestr decyzji architektonicznych (ADR)

ADR zapisują decyzje, których nie powinno się odtwarzać z historii czatu.
Każdy dokument opisuje kontekst, wybór i jego konsekwencje.

## Statusy

- **Proponowana** — kierunek do dyskusji; bez akceptacji nie buduj trwałych rozwiązań.
- **Zaakceptowana** — obowiązuje. **Odrzucona** — rozważona, nieprzyjęta.
- **Zastąpiona** — historyczna (nowszy ADR wskazuje aktualną). **Wycofana** — nieaktualna.
- **Archiwum** — ADR w całości wycofany przenosi się do `docs/decisions/archive/`:
  wiersz zostaje w tej tabeli (link z `archive/`), a plik wychodzi z lektury
  startowej (`tools/budzet-lektury.mjs`, AGENTS.md §0, LESSONS L62). Czytasz go
  punktowo, gdy wchodzisz w temat decyzji.

## Decyzje

| ADR | Tytuł | Status |
| --- | --- | --- |
| [0001](0001-vanilla-static-app-no-build.md) | Statyczna aplikacja vanilla HTML+JS (ESM) bez kroku budowania i bez zależności | Zaakceptowana |
| [0002](0002-hosting-github-pages-sciezki-wzgledne.md) | Hosting: GitHub Pages z gałęzi `main` (katalog główny), wszystkie ścieżki względne | Zaakceptowana |
| [0003](0003-mapa-kafelkowa-bez-bibliotek.md) | Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych; szablon podmienialny kluczem operatorskim — aneks 2026-09-12) | Zaakceptowana |
| [0004](0004-geolokalizacja-i-kryterium-dojscia.md) | Geolokalizacja `watchPosition` i kryterium dojścia do stacji | Zaakceptowana |
| [0005](0005-stacje-z-sieci-drogowej-overpass.md) | Stacje z sieci drogowej (Overpass): kandydaci, filtry, wybór pod ziarnem | Proponowana |
| [0006](0006-pytania-przez-prompt-i-wklejenie.md) | Pytania: prompt → model AI → wklejenie (bez backendu i kluczy API; ekran wklejania bez instrukcji i bez przycisku czytającego schowek, karta wyniku czyszczona przy wejściu — aneks 2026-09-16d) | Zaakceptowana |
| [0007](archive/0007-ukrywanie-paczki-obfuskacja-bez-klucza.md) | Ukrywanie paczki pytań: odwracalna obfuskacja bez klucza (nie szyfrowanie) | Wycofana |
| [0008](0008-kwerenda-i-zrodla-w-kazdym-pytaniu.md) | Obowiązkowa kwerenda internetowa i źródło URL przy każdym pytaniu | Zaakceptowana |
| [0009](0009-jeden-telefon-hot-seat.md) | Rozgrywka wieloosobowa: jeden telefon (hot-seat; rotacja pytań — aneks 2026-09-12) | Zaakceptowana |
| [0010](0010-trwalosc-localstorage-i-eksport-paczki.md) | Trwałość: `localStorage` + paczka jako plik, docelowo repozytorium (lokalnej historii gier nie ma — aneks 2026-09-13c) | Proponowana |
| [0011](0011-mobile-first-dotyk.md) | Mobile-first: interfejs dotykowy jako podstawowy, dostępność i czytelność w słońcu (czekanie na sieć jest widoczne — komunikaty pulsują, aneks 2026-09-13d; wyjątki od progu 44 px — aneks 2026-09-16d) | Zaakceptowana |
| [0012](0012-model-sesji-pr-audyt-inkrementalne-commity.md) | Model sesji: PR na starcie, audyt poprzedniego PR, inkrementalne commity, bez force push | Zaakceptowana |
| [0013](0013-prywatnosc-wspolrzedne-na-urzadzeniu.md) | Prywatność: współrzędne zostają na urządzeniu, zero analityki | Proponowana |
| [0014](archive/0014-punktacja-czasu-mediana-tempa.md) | Punktacja czasu: premia względem mediany tempa odcinków (doprecyzowanie ADR 0009 pkt 5) — pkt 1 (dystanse odcinków z sieci) obowiązuje | Wycofana |
| [0015](0015-niekompletna-paczka-i-pominiecie-stacji.md) | Niekompletna paczka: ostrzeżenie zamiast blokady; pominięcie tylko w drodze (przedrostek kodów H wycofany — aneks 2026-09-13) | Proponowana |
| [0016](0016-trwaly-backend-google-drive-apps-script.md) | Trwały backend: Google Drive + Apps Script na wydzielonym koncie (repo paczek, stan gry, droga do multi-device; przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0017](0017-repozytorium-paczek-to-zestaw.md) | Repozytorium paczek: schemat `TO-zestaw/1` z jawnymi stacjami, geohash5 w indeksie, CC BY-SA 4.0 (moderacja wstępna zniesiona — aneks 2026-09-11; nazwa paczki od miejsca, bez kroku ekranu stacji — aneks 2026-09-13; widoczne paczki schodzą w tle — aneks 2026-09-13d) | Proponowana |
| [0018](0018-drive-backend-wielozadaniowy.md) | Drive jako backend wielozadaniowy (paczki, gry, statystyki; przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0019](0019-gra-wieloosobowa-multi-device.md) | Gra wieloosobowa multi-device: lobby, Wspólna Trasa/Wyścig (rankingi usunięte — aneks 2026-09-11b; ranking wrócił w nowej formie — aneks 2026-09-12f; sekret tylko w żywej grze, numery stacji stałe po powrocie — aneks 2026-09-13c; kolejka zdarzeń utrwalona, reload nie gubi odpowiedzi — aneks 2026-09-13d) | Zaakceptowana |
| [0020](0020-adres-mostu-wpisany-w-kod-aplikacji.md) | Adres mostu Drive w kodzie aplikacji, bez pola w UI (przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0021](0021-pin-prosty-profilu-pseudonimu.md) | PIN pseudonimu (4-8 cyfr, jawny tekst, RO-profil/1) + przycisk To ja w setupie | Zaakceptowana |
| [0022](0022-odpowiada-gracz-z-kolejki.md) | Odpowiada gracz z kolejki: koniec ustawienia `wspolpraca` (kolejne pytania rotują — aneks 2026-09-12) | Zaakceptowana |
| [0023](0023-zero-presji-czasowej.md) | Zero presji czasowej: punktacja to dotarcie plus poprawna odpowiedź | Zaakceptowana |
| [0024](0024-tolerancja-dopasowania-okolicy.md) | Dopasowanie okolicy z tolerancją: odległość od komórki geohash, nie „ten sam geohash" | Zaakceptowana |
| [0025](0025-czas-gry-zamiast-promienia.md) | Czas gry zamiast promienia: promień jest wynikiem, nie polem | Zaakceptowana |
| [0026](0026-tozsamosc-brama-ekranu-1.md) | Tożsamość jest bramą ekranu 1: imię + PIN, jedno wołanie mostu | Zaakceptowana |
| [0027](0027-pytania-po-rowno-i-wolna-kolejnosc.md) | Pytania po równo na gracza (wdrożone) i wolna kolejność stacji w grze sieciowej (projekt; premia za kolejność: pula = grający − 1, maks. 3 — aneks 2026-09-13) | Zaakceptowana |
| [0028](0028-oceny-pytan-graczy.md) | Oceny pytań przez graczy: jeden kciuk, jeden głos na gracza i pytanie, wysyłka w tle | Zaakceptowana |
| [0029](0029-brak-recznego-dojscia.md) | Dojście zalicza tylko GPS: ręczne zgłaszanie usunięte z interfejsu | Zaakceptowana |
| [0030](0030-rozgrywka-pod-orientacje-telefonu.md) | Rozgrywka układa się pod orientację telefonu, a pytanie leży NA mapie (obróć ekran — mapa sama centruje się na graczu; blokady orientacji NIE MA — aneks 2026-09-13) | Zaakceptowana |
| [0031](archive/0031-generowanie-pytan-partiami.md) | Duży setup generuje pytania partiami, a aplikacja sama je scala (stałe szacunku usunięte — aneks 2026-09-12) | Wycofana |
| [0032](0032-wariant-bez-fact-check.md) | Wariant „Pytania (bez fact check)" jako domyślny (znaczek weryfikacji mówi „Fact-checked" — aneks 2026-09-13) | Zaakceptowana |
| [0033](archive/0033-koniec-odwracania-liter.md) | Koniec odwracania liter: zostaje kod poprawnej odpowiedzi | Wycofana |

| [0034](0034-uproszczenie-terenowe-i-warstwy.md) | Uproszczenie terenowe: setup, warstwy, dojście 50 m | Zaakceptowana |
| [0035](0035-overpass-krotkie-proby.md) | Overpass: próby po 10 s, preferencje i diagnostyka w Informacjach | Zaakceptowana |
| [0036](0036-pasek-podczas-drogi.md) | Pasek podczas drogi, sterowanie w Informacjach, duży panel pytania | Zaakceptowana |
| [0037](0037-jezyk-i-podklad-zaszte-w-kodzie.md) | Język pytań i podkład mapy zaszte w kodzie (polski + OSM), pola usuwane z UI | Zaakceptowana |
| [0038](0038-minimalny-ekran-wyniku.md) | Minimalny ekran wyniku: zwycięzca, ranking i powrót — statystyki, szczegóły, stacje i eksporty usunięte | Zaakceptowana |
| [0039](0039-ranking-dwie-tabele.md) | Ranking wrócił w nowej formie: dwie tabele (punkty i proporcja), sumy liczy most, tylko gracze z profilem | Zaakceptowana |
| [0040](0040-gra-bez-pauzy-zawsze-wlaczona.md) | Gra bez pauzy: śledzenie zawsze włączone, Wake Lock na czas gry, jedyna przerwa po 15 min bezczynności | Zaakceptowana |
| [0041](0041-sygnaly-dzwiek-i-wibracja.md) | Każdy sygnał zdarzenia ma wibrację, jeśli urządzenie ją daje (brak API = cichy no-op, gra idzie dalej) | Zaakceptowana |
| [0042](0042-informacje-jedna-mala-czcionka.md) | Informacje: cała treść jedną, małą czcionką Courier New (13 px; przyciski-stopki poza progiem 44 px — aneks 2026-09-16d) | Zaakceptowana |
| [0043](0043-koniec-gry-za-ikona-start-gry.md) | Przycisku „Zakończ grę” nie ma: grę kończy ikona ⚙ START GRY i wpisanie TAK w małej warstwie potwierdzenia | Zaakceptowana |
| [0044](0044-odliczanie-po-starcie-gry-wieloosobowej.md) | Start gry wieloosobowej: sygnał i odliczanie 5-4-3-2-1-START nad mapą, potem gra wygląda jak hotseat (panel multi usunięty) | Zaakceptowana |
| [0045](0045-telefon-wraca-do-zapamietanej-gry.md) | Kart wznowienia na setupie nie ma: otwarcie albo odświeżenie aplikacji wraca wprost do zapamiętanej gry (hotseat z zapisu, multi z sesji i mostu) | Zaakceptowana |
| [0046](0046-promien-jest-kryterium-dopasowania-paczek.md) | Promień gry jest kryterium dopasowania paczek (równość paczka↔setup) — odwrócenie fragmentu aneksu ADR 0024 | Zaakceptowana |
| [0047](0047-strona-nie-jest-szczypalna-poza-mapa.md) | Strona nie jest szczypalna poza mapą (blokada gestów iOS poza `.mapa`) — zastępuje fragment ADR 0011 | Zaakceptowana |
| [0048](0048-nazwa-paczki-na-drive-koduje-fakty.md) | Nazwa pliku paczki na Drive koduje fakty z `meta`, nie geohash | Zaakceptowana |
| [0049](archive/0049-poprawna-czysty-indeks.md) | Numer poprawnej odpowiedzi jest czystym indeksem 0–3 (koniec kodu pozycyjnego) | Wycofana |
| [0050](0050-paczka-jawna-bez-ukrywania.md) | Paczka jawna: koniec ukrywania pytań (kontener usunięty) i numer odpowiedzi `1..4` | Zaakceptowana |
| [0051](0051-status-multi-w-informacjach-i-pod-wynikiem.md) | Status multi w Informacjach i pod wynikiem | Zaakceptowana |

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

Tabela „rodzaj treści → miejsce" jest tylko w `AGENTS.md` §5 (bez kopii).
