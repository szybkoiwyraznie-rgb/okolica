# Rejestr decyzji architektonicznych (ADR)

ADR zapisują decyzje, których nie powinno się odtwarzać z historii czatu.
Każdy dokument opisuje kontekst, wybór i jego konsekwencje.

## Statusy

- **Proponowana** — kierunek do dyskusji; bez akceptacji nie buduj trwałych rozwiązań.
- **Zaakceptowana** — obowiązuje. **Odrzucona** — rozważona, nieprzyjęta.
- **Zastąpiona** — historyczna (nowszy ADR wskazuje aktualną). **Wycofana** — nieaktualna.

## Decyzje

| ADR | Tytuł | Status |
| --- | --- | --- |
| [0001](0001-vanilla-static-app-no-build.md) | Statyczna aplikacja vanilla HTML+JS (ESM) bez kroku budowania i bez zależności | Zaakceptowana |
| [0002](0002-hosting-github-pages-sciezki-wzgledne.md) | Hosting: GitHub Pages z gałęzi `main` (katalog główny), wszystkie ścieżki względne | Zaakceptowana |
| [0003](0003-mapa-kafelkowa-bez-bibliotek.md) | Mapa: własny renderer SVG + rastrowe kafelki Web Mercator (bez bibliotek mapowych; szablon podmienialny kluczem operatorskim — aneks 2026-09-12) | Zaakceptowana |
| [0004](0004-geolokalizacja-i-kryterium-dojscia.md) | Geolokalizacja `watchPosition` i kryterium dojścia do stacji | Zaakceptowana |
| [0005](0005-stacje-z-sieci-drogowej-overpass.md) | Stacje z sieci drogowej (Overpass): kandydaci, filtry, wybór pod ziarnem | Proponowana |
| [0006](0006-pytania-przez-prompt-i-wklejenie.md) | Pytania: prompt → model AI → wklejenie (bez backendu i kluczy API) | Zaakceptowana |
| [0007](0007-ukrywanie-paczki-obfuskacja-bez-klucza.md) | Ukrywanie paczki pytań: odwracalna obfuskacja bez klucza (nie szyfrowanie) | Zaakceptowana |
| [0008](0008-kwerenda-i-zrodla-w-kazdym-pytaniu.md) | Obowiązkowa kwerenda internetowa i źródło URL przy każdym pytaniu | Zaakceptowana |
| [0009](0009-jeden-telefon-hot-seat.md) | Rozgrywka wieloosobowa: jeden telefon (hot-seat) | Zaakceptowana |
| [0010](0010-trwalosc-localstorage-i-eksport-paczki.md) | Trwałość: `localStorage` + paczka jako plik, docelowo repozytorium | Proponowana |
| [0011](0011-mobile-first-dotyk.md) | Mobile-first: interfejs dotykowy jako podstawowy, dostępność i czytelność w słońcu | Zaakceptowana |
| [0012](0012-model-sesji-pr-audyt-inkrementalne-commity.md) | Model sesji: PR na starcie, audyt poprzedniego PR, inkrementalne commity, bez force push | Zaakceptowana |
| [0013](0013-prywatnosc-wspolrzedne-na-urzadzeniu.md) | Prywatność: współrzędne zostają na urządzeniu, zero analityki | Proponowana |
| [0014](0014-punktacja-czasu-mediana-tempa.md) | Punktacja czasu: premia względem mediany tempa odcinków (doprecyzowanie ADR 0009 pkt 5) | Wycofana |
| [0015](0015-niekompletna-paczka-i-pominiecie-stacji.md) | Niekompletna paczka: ostrzeżenie zamiast blokady; pominięcie tylko w drodze | Proponowana |
| [0016](0016-trwaly-backend-google-drive-apps-script.md) | Trwały backend: Google Drive + Apps Script na wydzielonym koncie (repo paczek, stan gry, droga do multi-device; przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0017](0017-repozytorium-paczek-to-zestaw.md) | Repozytorium paczek: schemat `TO-zestaw/1`, geohash5 w indeksie, CC BY-SA 4.0, moderacja właściciela | Proponowana |
| [0018](0018-drive-backend-wielozadaniowy.md) | Drive jako backend wielozadaniowy (paczki, gry, statystyki; przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0019](0019-gra-wieloosobowa-multi-device.md) | Gra wieloosobowa multi-device: lobby, Wspólna Trasa/Wyścig (rankingi usunięte — aneks 2026-09-11b) | Zaakceptowana |
| [0020](0020-adres-mostu-wpisany-w-kod-aplikacji.md) | Adres mostu Drive w kodzie aplikacji, bez pola w UI (przycisk „Sprawdź połączenie" usunięty — aneks 2026-09-12) | Zaakceptowana |
| [0021](0021-pin-prosty-profilu-pseudonimu.md) | PIN pseudonimu (4-8 cyfr, jawny tekst, RO-profil/1) + przycisk To ja w setupie | Zaakceptowana |
| [0022](0022-odpowiada-gracz-z-kolejki.md) | Odpowiada gracz z kolejki: koniec ustawienia `wspolpraca` | Zaakceptowana |
| [0023](0023-zero-presji-czasowej.md) | Zero presji czasowej: punktacja to dotarcie plus poprawna odpowiedź | Zaakceptowana |
| [0024](0024-tolerancja-dopasowania-okolicy.md) | Dopasowanie okolicy z tolerancją: odległość od komórki geohash, nie „ten sam geohash" | Zaakceptowana |
| [0025](0025-czas-gry-zamiast-promienia.md) | Czas gry zamiast promienia: promień jest wynikiem, nie polem | Zaakceptowana |
| [0026](0026-tozsamosc-brama-ekranu-1.md) | Tożsamość jest bramą ekranu 1: imię + PIN, jedno wołanie mostu | Zaakceptowana |
| [0027](0027-pytania-po-rowno-i-wolna-kolejnosc.md) | Pytania po równo na gracza (wdrożone) i wolna kolejność stacji w grze sieciowej (projekt) | Zaakceptowana |
| [0028](0028-oceny-pytan-graczy.md) | Oceny pytań przez graczy: jeden kciuk, jeden głos na gracza i pytanie, wysyłka w tle | Zaakceptowana |
| [0029](0029-brak-recznego-dojscia.md) | Dojście zalicza tylko GPS: ręczne zgłaszanie usunięte z interfejsu | Zaakceptowana |
| [0030](0030-rozgrywka-pod-orientacje-telefonu.md) | Rozgrywka układa się pod orientację telefonu, a pytanie leży NA mapie | Zaakceptowana |
| [0031](0031-generowanie-pytan-partiami.md) | Duży setup generuje pytania partiami, a aplikacja sama je scala (stałe szacunku usunięte — aneks 2026-09-12) | Wycofana |
| [0032](0032-wariant-bez-fact-check.md) | Wariant „Pytania (bez fact check)" jako domyślny | Zaakceptowana |
| [0033](0033-koniec-odwracania-liter.md) | Koniec odwracania liter: zostaje kod poprawnej odpowiedzi | Zaakceptowana |

| [0034](0034-uproszczenie-terenowe-i-warstwy.md) | Uproszczenie terenowe: setup, warstwy, dojście 50 m | Zaakceptowana |
| [0035](0035-overpass-krotkie-proby.md) | Overpass: próby po 10 s, preferencje i diagnostyka w Informacjach | Zaakceptowana |
| [0036](0036-pasek-podczas-drogi.md) | Pasek podczas drogi, sterowanie w Informacjach, duży panel pytania | Zaakceptowana |
| [0037](0037-jezyk-i-podklad-zaszte-w-kodzie.md) | Język pytań i podkład mapy zaszte w kodzie (polski + OSM), pola usuwane z UI | Zaakceptowana |

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
