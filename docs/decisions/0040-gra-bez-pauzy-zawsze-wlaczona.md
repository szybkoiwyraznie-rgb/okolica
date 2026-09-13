# 0040 — Gra bez pauzy: aplikacja zawsze włączona, Wake Lock, przerwa po 15 min bezczynności

- Status: Zaakceptowana
- Data: 2026-09-13
- Podstawa: uwagi właściciela z testów terenowych, punkty B i C: „Chciałbym
  zrezygnować z całego systemu pauzy i wznawiania. To nie jest do niczego
  potrzebne. Jeśli to możliwe aktywna aplikacja powinna być cały czas »włączona«,
  śledzenie włączone, fixy gps robione. Jeśli aplikacja przejdzie w tryb
  uśpienia sama (nieaktywna zakładka, tryb zablokowanego telefonu itp.), to po
  powrocie do aplikacji wszystko powinno się automatycznie wznawiać bez
  konieczności klikania gdziekolwiek. Oszczędzanie baterii przy tego typu
  zabawach nie ma sensu. Jedyne zabezpiecznie, które możesz zrobić to
  automatycznie pauzowanie jeśli ktoś przez 15 minut nie wykona żadnej akcji
  (kliku) — w takim wypadku jednak wznów automatycznie po ponownej aktywności
  w aplikacji jakimkolwiek kliknięciem.” Oraz C: „Podczas gry ekran nie powinien
  sam przechodzić w tryb wygaszenia (być może tego nie robi).”

## Decyzja

1. **Systemu pauzy i wznawiania NIE MA.** Przycisk „⏸ Pauza”/„▶ Wznów”,
   komunikat pod nim, stan `graPauza`/`graPauzaStartMs`/`pauzaSkumulowanaMs`,
   pauza w tle (`pauzaWTle`) i etykieta „⏸ Wznów grę i idź dalej →” są
   wycofane. Zegar gry to `performance.now()` bez korekt — czas płynie także
   wtedy, gdy karta jest w tle. ADR 0004 pkt 3 bez zmian (logika nie czyta
   zegara, `czasMs` podaje warstwa DOM); rebaza znaczników przy wznowieniu
   zapisu zostaje, bo to inny mechanizm (restart przeglądarki, nie pauza).
2. **Śledzenie jest włączone cały czas, jednym dokładnym profilem.** Profil
   oszczędny (M10/T3 „budzenie przy zbliżaniu”, histereza 250/150 m,
   `profilBaterii`, `PROG_BATERII_M`) wycofany: kryterium dojścia liczy się
   z metrów na całym odcinku, a właściciel odrzucił oszczędzanie baterii jako
   cel tej aplikacji. Opcje watchera zostają dokładnie te z ADR 0004 pkt 1.
3. **Powrót z tła wznawia wszystko SAM — bez kliku i bez komunikatu.** Na
   `visibilitychange` na „widoczne” aplikacja sprawdza, czy czeka na fixa (ekran
   pozycji albo odcinek gry) i czy nasłuch żyje (`watcher.czyAktywny()` plus
   `STAN.ostatniFix`); jeśli nie — zakłada świeży (bug G: WebKit bywa „aktywny
   i niemy”). Kody **P07** (o wstrzymaniu śledzenia w tle) i **P09** (o
   wznowieniu śledzenia) są WYCOFANE — numery nie wracają do puli (jak P05,
   E14/E18, R17/R18, G11/G13). W tle zatrzymuje się tylko symulacja trybu
   testowego: jej fixy nie rozstrzygają dojścia w prawdziwej grze.
4. **Wake Lock: ekran nie gaśnie podczas gry.** `navigator.wakeLock.request('screen')`
   jest trzymany, dopóki rozgrywka trwa (faza inna niż `koniec` i bez ręcznego
   zakończenia), zwalniany po końcu gry, a po powrocie z tła żądany ponownie
   (przeglądarki zwalniają blokadę przy `hidden`). Brak API (iOS Safari, część
   desktopów) jest CICHYM no-opem i nie może zepsuć rozgrywki — GPS działa
   niezależnie od tego, czy ekran gaśnie (LESSONS L6: milczenie dopuszczalne dla
   warstwy, która nie niesie stanu gry).
5. **Jedyne zabezpieczenie: przerwa po 15 minutach bezczynności.** Gdy przez
   `PRZERWA_BEZCZYNNOSCI_MS` (15 min) nie było ŻADNEGO kliku, aplikacja
   zatrzymuje watcher i zamraża zegar gry; DOWOLNY klik wznawia jedno i drugie
   automatycznie — bez przycisku i bez pytania. Stan sprawdza `setInterval` co
   `SPRAWDZANIE_BEZCZYNNOSCI_MS` (30 s), a decyzja jest czystą funkcją
   `czyPrzerwaBezczynnosci({ ostatniaAkcjaMs, terazMs, progMs })` w
   `app/aktywnosc.js`; brak danych o ostatniej akcji NIE pauzuje (LESSONS L10:
   brak danych to brak danych).
6. **Konsekwencja w UI (uwagi E i F):** z Informacji znika boks z dystansem,
   przyciskiem wznawiania i komunikatem o wstrzymanym śledzeniu. W drodze
   wędruje tam WYŁĄCZNIE węzeł „■ Zakończ grę” (bez klonowania przycisków ani
   nasłuchów), a panel gry jest schowany, żeby nad mapą został sam pasek
   (ADR 0036 aneks 2026-09-13).

## Wdrożenie

- pkt 1–3 i 6: **m12-102** (commit M/2, 2026-09-13).
- pkt 4–5: **m12-103** (commit M/3, ta sama sesja) — moduł `app/aktywnosc.js`,
  Wake Lock i watchdog bezczynności w `app.js`.

## Konsekwencje

- **Bateria:** godzina gry z włączonym ekranem i dokładnym GPS-em zużyje
  wyraźnie więcej niż przed tą decyzją. To świadomy koszt właściciela; jedynym
  ogranicznikiem jest pkt 5 (15 min bezczynności) i systemowe wygaszenie, gdy
  Wake Lock nie jest dostępny.
- **Czas gry:** postoje wliczają się teraz w znaczniki czasu odcinków (dawniej
  pauza je zatrzymywała). Punktacja od czasu nie zależy (ADR 0023: brak kary za
  tempo), więc dotyczy to tylko dziennika rozgrywki.
- **Testy:** piny pauzy przepisane na nową formę (LESSONS L55), a martwe frazy
  („⏸ Pauza”, „Zegar gry zatrzymany”, „GPS w trybie oszczędnym”, „bateria
  odpoczywa”, komunikaty P07/P09) wpisane do strażnika dryfu
  (`test/dryf-dokumentow.test.js`, L58). Kontrakt ADR 0040 asertuje nieobecność
  funkcji i stanu pauzy w `app.js`/`pozycja.js` oraz obecność slotu
  `#przycisk-zakoncz-gre-slot`.

## Powiązania

ADR 0004 (watcher, kryterium dojścia, zegar — aneks 2026-09-13), ADR 0036
(pasek w drodze, sterowanie w Informacjach — aneks 2026-09-13), ADR 0023 (czas
bez kary za tempo), ADR 0029 (dojście tylko z GPS), ADR 0034 (`accuracy` bez
oceny), LESSONS L6, L10, L31, L55, L58.
