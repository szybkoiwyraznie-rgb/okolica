# 0028 — Oceny pytań przez graczy: jeden kciuk, jeden głos, wysyłka w tle

- Status: Zaakceptowana (2026-09-08, zlecenie właściciela; wdrażana)
- Data: 2026-09-08

## Kontekst

Właściciel (2026-09-08): „Chciałbym, żeby każdy z graczy obsługujących aplikację
(host w hotseat oraz gracze w grze multi) mogli oceniać paczki pytań. Paczka
leżąca na Drive ma informacje o tym, jak była oceniana przez graczy, i później
pokazując się jako możliwa do wybrania podawała statystyki → używa w X grach,
74% oceniło pytania pozytywnie, 21% oceniło pytania negatywnie. Samo głosowanie
powinno być proste i jednoklikowe, a komunikacja z Drive natychmiastowa, ale
w tle (nie blokująca aplikacji). Ocenianie w momencie wyświetlenia każdego
pytania oraz już po odpowiedzi (ten sam «slot» — jeśli ktoś ocenił przed
odpowiedzią albo w innej sesji/grze, to drugi raz tego samego pytania ocenić
nie może — ten sam gracz/id). Obok pytania albo obok odpowiedzi prosty panel
z dwiema ikonkami, które można, ale nie trzeba kliknąć — Oceń pytanie — zielony
kciuk w górę i czerwony kciuk w dół."

Dotąd jakość paczki była niewidoczna: ekran 2 pokazywał dopasowanie do setupu
(ADR 0024), ale nie to, czy pytania się sprawdziły w terenie. Oceny graczy są
jedynym sygnałem jakości, który nie wymaga pracy właściciela.

## Decyzja

1. **Jedno kliknięcie, przy pytaniu.** Panel „Oceń pytanie" z dwiema ikonami
   (kciuk w górę / w dół) stoi przy treści pytania i zostaje w tym samym slocie
   po odsłonięciu odpowiedzi — gracz może ocenić przed albo po. Kliknięcie jest
   opcjonalne; brak kliknięcia nie jest głosem.
2. **Jeden głos na pytanie na gracza**, także między sesjami i grami.
   Tożsamość głosującego: pseudonim zweryfikowanego profilu (ADR 0026) albo —
   gdy profilu nie ma (host hot-seat, gracz bez PIN-u) — identyfikator
   urządzenia `okolica:glosujacy` (losowy, zapisany raz, bez danych osobowych).
   Regułę pilnują **dwie strony**: aplikacja (drugi klik nie leci w sieć i jest
   pokazany jako „już ocenione") oraz most (odrzuca duplikat głosujący +
   `pytanieId`), bo aplikacji nie wolno ufać (wzorzec M11: spójność ponad
   zaufaniem).
3. **Wysyłka w tle, nigdy blokująca.** Kliknięcie zapisuje głos lokalnie
   i uruchamia `fetch` bez czekania; UI od razu pokazuje stan kciuka.
   Niepowodzenie (brak sieci, odmowa mostu) nie jest błędem dla gracza: głos
   czeka w kolejce `okolica:oceny-kolejka` i leci przy najbliższym uruchomieniu
   aplikacji (ten sam wzorzec co kolejka gier hot-seat).
4. **Głosy NIE mieszkają w pliku paczki.** Paczka po akceptacji jest treścią
   niezmienną (przegląd właściciela dotyczy dokładnie tych bajtów), a głosy nie
   mają jechać na każdy telefon razem z paczką. Dlatego most trzyma osobny plik
   `RO-oceny/1` na paczkę w katalogu `okolica-oceny-paczek`.
5. **Statystyki liczy most, tekst liczy aplikacja.** `budujIndeks` dokłada do
   wpisu `oceny: { glosow, plus, minus, uzytaWGrach }`; procenty i polską
   odmianę („użyta w 1 grze / w 3 grach") składa `app/oceny.js`, żeby jedno
   miejsce odpowiadało za język. Przy dwóch ikonach nie ma głosu neutralnego,
   więc `plus + minus = glosow` i procenty sumują się do 100 (74/26, nie 74/21).
6. **„Użyta w X grach"** = liczba różnych tokenów gry, które pobrały paczkę:
   aplikacja dokłada `&gra=<token>` do `akcja=paczka`. Bez parametru `gra` most
   zachowuje się dokładnie jak dziś (starsze wersje aplikacji nie psują indeksu).
7. **Prywatność.** Głos niesie `paczkaId`, `pytanieId`, `ocena` (1 / −1),
   `gracz` (slug pseudonimu albo id urządzenia) i token gry. **Nigdy**
   współrzędnych gracza (ADR 0013), PIN-u (ADR 0021) ani treści pytania.
8. **Brak mostu nie zatrzymuje gry.** Bez mostu (albo przy jego odmowie) oceny
   zostają na telefonie, a ekran 2 pokazuje paczki bez statystyk z jawnym
   dopiskiem, że oceny nie dojechały — bez ciszy (LESSONS L6).

## Odrzucone alternatywy

- **Oceny w pliku paczki** — zmieniałby treść zaakceptowaną przez właściciela
  i wysyłał cudze głosy na każdy telefon.
- **Skala 1–5 / gwiazdki** — więcej kliknięć i więcej namysłu; właściciel chce
  decyzję jednoklikową, a rozkład i tak sprowadza się do „dobre / niedobre".
- **Liczniki bez tożsamości** — bez identyfikatora nie da się obronić przed
  wielokrotnym głosowaniem tej samej osoby, a to jedyna ochrona przed
  zniekształceniem statystyki.
- **Głosowanie po zakończeniu gry (ankieta)** — gracz nie pamięta wtedy, które
  pytanie było słabe; ocena ma być przy pytaniu.

## Konsekwencje

- Nowa akcja mostu (`akcja:'ocena'`) i nowy katalog → **właściciel musi wkleić
  nową wersję `.gs`** i wdrożyć ją istniejącym wdrożeniem (ADR 0020 pkt 5,
  procedura w `docs/setup/HANDOFF_*`). Do tego czasu aplikacja działa bez
  statystyk i trzyma głosy w kolejce.
- Indeks rośnie o ~60 B na paczkę — bez wpływu na budżety (`BUDZET_ZESTAWOW_BAJTY`).
- `RO-oceny/1` jest nowy, więc nie ma migracji; brak pliku ocen = zero głosów.
- Statystyki są jawne dla wszystkich (w indeksie) — to cel: mają pomagać
  w wyborze paczki. Nie pokazujemy, kto jak głosował.
