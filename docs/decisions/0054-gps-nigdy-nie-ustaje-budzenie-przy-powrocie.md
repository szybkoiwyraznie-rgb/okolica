# 0054 — GPS nie przerywa go nic: świeży watcher przy starcie gry, starcie odcinka i powrocie na kartę

- Status: Zaakceptowana (2026-09-17d, uwaga A z testów terenowych, właściciel)
- Data: 2026-09-17

## Kontekst

Test terenowy (hot-seat, iPhone): po wystartowaniu gry aplikacja nie
odświeżała fixów GPS i stała w punkcie startu mimo przemieszczania się —
pomógł tylko reset przeglądarki. Właściciel: „nic nie powinno przerywać
odczytywania lokalizacji, a po powrocie na kartę przeglądarki np. z uśpienia
powinno obowiązkowo budzić GPS".

Przyczyna: WebKit potrafi trzymać `watchPosition` w całkowitej ciszy — bez
fixa i bez błędu (bug G, ADR 0004 aneks), a `czyAktywny()` i stary fix kłamią,
że nasłuch żyje. Watchdog (zegar 15 s ciszy) jest uzbrajany tylko na ekranie
pozycji i w odcinku; na przejściu między ekranami (stacje, wklejka) zegar się
rozzbraja, a start gry i start odcinka zakładały watchera tylko gdy go „nie ma"
(bramka `!STAN.watcher`) — cichy, ale „aktywny" nasłuch przechodził przez nią,
zegar nikt nie uzbrajał i cisza trwała do końca gry.

## Decyzja

1. Watcher pozycji zamyka tylko przerwa bezczynności (15 min bez klika,
   ADR 0040 — jedyna dozwolona przerwa, wznawia ją samoczynnie pierwszy
   dotyk) i tryb testowy. Żadna inna ścieżka nie woła `zatrzymajGps()`.
2. **Start gry, start odcinka i dołączenie do gry sieciowej zakładają
   świeżego watchera BEZWZGLĘDNY** (bramka `!STAN.watcher` usunięta). Restart
   jest idempotentny (`zatrzymajGps` zamyka starego `clearWatch`) i to jedyne
   pewne wyleczenie cichego nasłuchu (bug G).
3. **Powrót na kartę (`visibilitychange`) budzi GPS obowiązkowo** (poza trybem
   testowym) — bez bramek „czekamy na fixa" i `!STAN.ostatniFix`: cichy
   watcher ze starym fixem jest budzony tak samo jak martwy.
4. Watchdog bez zmian (ekran pozycji + odcinek, 15 s ciszy, komunikat P10),
   ale pkt 2 gwarantuje uzbrojony zegar po przejściach między ekranami:
   restart przy starcie uzbraja go od nowa.

## Konsekwencje

- Scenariusz właściciela (wyjście od startu w trakcie wklejania pytań +
  cisza WebKit) leczy się w chwili startu gry — bez resetu przeglądarki.
- Jeden dodatkowy `watchPosition` na start/odcinek/powrót z tła — tanio
  wobec zawieszonej gry.
- Przerwa bezczynności (ADR 0040) zostaje jedynym przerwaniem śledzenia;
   jeśli właściciel chce jej nie być, to decyzja kolejnej tury.
- Piny: kontrakt (powrót bezwarunkowy, start bez bramki `!STAN.watcher`),
  `test/aplikacja.test.js` (scenariusz: cichy watcher w trakcie wklejki
  budzi się przy starcie gry i powrocie na kartę).

## Powiązania

0004 (watcher, bug G, P10), 0040 (brak pauzy, przerwa bezczynności),
0045 (powrót do gry), LESSONS L22.
