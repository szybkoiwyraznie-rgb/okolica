# 0014 — Punktacja czasu: premia względem mediany **tempa** odcinków, nie mediany czasów tej samej stacji

- Status: Proponowana (doprecyzowanie ADR 0009 pkt 5, który punktację zostawił
  „do dopracowania w M7"; do potwierdzenia przez właściciela)
- Data: 2026-09-05

## Kontekst

ADR 0009 pkt 5 daje ramy punktacji: punkty za poprawną odpowiedź (waga
trudności) **plus premia albo potrącenie za czas**, liczone „względem mediany
odcinków tej samej stacji dla wszystkich graczy — a nie względem stałego limitu,
bo długość odcinka zależy od układu trasy".

W hot-seat **do jednej stacji idzie jeden gracz** (`gracz = stacja mod N`), więc
mediana „odcinków tej samej stacji" ma jedną próbkę, a premia byłaby zawsze
zerowa. Intencja ADR 0009 zostaje: **porównywać tempo, nie surowy czas**.

Potrzebna więc reguła, która (a) zachowuje intencję, (b) działa przy jednej
próbce na stację, (c) nie karze gracza za to, że trafił mu się dłuższy odcinek,
(d) jest policzalna w trakcie gry, a nie dopiero na końcu.

## Decyzja

1. **Miarą jest tempo odcinka**: `tempo = czasS / odlegloscM` [s/m], gdzie
   `czasS` to czas od jawnej akcji startu do spełnienia kryterium dojścia
   (ADR 0004 pkt 3) **powiększony o karę za ręczne zgłoszenie** (`karaRecznaS`,
   ADR 0004 pkt 5), a `odlegloscM` to **dystans odcinka**: od punktu startu gry
   do stacji 1, a dla każdej kolejnej stacji — od poprzedniej stacji. Liczy go
   `dystansOdcinkaM()` przez `odlegloscM()` (haversine; od M4 — dystans sieciowy
   z ADR 0005, sygnatura bez zmian). Gracz idzie więc trasą łańcuchową, nie
   gwiaździstą: porównywanie tempa odcinka „start → stacja 4" z odcinkiem
   „stacja 3 → stacja 4" byłoby bez sensu.
2. **Zbiór próbek do mediany** (w kolejności, pierwsza spełniona wygrywa):
   1. odcinki **tej samej stacji** — jeśli są co najmniej 2 (przyszłe warianty
      gry: wielu graczy do jednej stacji, powtórki, tryb drużynowy),
   2. wszystkie **zakończone odcinki bieżącej gry** — jeśli są co najmniej 2,
   3. w przeciwnym razie premii nie ma (`premiaCzasu = 0`) — pierwszy odcinek
      gry jest zawsze bez premii i bez potrącenia, bo nie ma punktu odniesienia.
3. **Wzór premii**:
   ```
   wzgledne = (medianaTempa - tempo) / medianaTempa      // >0 = szybciej niż mediana
   wzgledne = ogranicz(wzgledne, -0.5, +0.5)             // zacisk: max ±50% odchylenia
   premia   = zaokrąglij(punktyPodstawowe × 0.5 × wzgledne)
   ```
   czyli premia i potrącenie mieszczą się w **±25% punktów za odpowiedź**
   (`UDZIAL_PREMII_CZASU = 0.5`, `ZACISK_WZGLEDNY = 0.5`). Stałe są w
   `PUNKTACJA` w `app/rozgrywka.js` i są testowane — zmiana to zmiana kodu i
   testu, nie decyzja sesji.
4. **Premia zależy od poprawnej odpowiedzi**: `punktyPodstawowe = 0` przy
   błędnej odpowiedzi, więc i premia wynosi 0. Szybkie dojście i zła odpowiedź
   nie dają punktów — gra jest terenowa **i** merytoryczna (ADR 0008).
5. **Limit czasu odcinka** (`limitCzasuOdcinkaS`, 0 = wyłączony): przekroczenie
   nie przerywa gry (gracz jest w terenie, nie wolno mu „wygasić" trasy), ale
   **zeruje premię** i oznacza odcinek `poLimitie: true` w dzienniku oraz
   komunikatem w UI. Kara jest więc miękka i jawna.
6. **Kara za ręczne zgłoszenie jest czasowa, nie punktowa** (ADR 0004 pkt 5):
   dolicza się do `czasS` przed liczeniem tempa. Nie ma drugiego potrącenia
   w punktach — podwójne karanie tej samej decyzji byłoby nieczytelne.
7. **Mediana, nie średnia**: odporna na jeden bardzo wolny albo bardzo szybki
   odcinek (rozdzwoniony telefon, rozmowa po drodze). Przy parzystej liczbie
   próbek — średnia z dwóch środkowych.
8. **Punktacja jest częścią stanu gry i dziennika**: każda odpowiedź zapisuje
   `{ punktyPodstawowe, premiaCzasu, punktyRazem, tempo, medianaTempa, probek }`
   — wynik da się przeliczyć i wyjaśnić graczowi liczba po liczbie (ADR 0011:
   czytelność; ADR 0010: stan eksportowalny).

## Konsekwencje

- Reguła działa od pierwszego zakończonego odcinka (dla trzeciego gracza
  porównanie istnieje już przy drugiej stacji), więc rywalizacja jest widoczna
  w trakcie gry, nie tylko w podsumowaniu.
- Gracz, któremu trafił się długi odcinek, nie jest karany: liczy się tempo.
  Koszt: tempo premiuje krótkie odcinki (na 100 m łatwiej o wysokie tempo niż
  na 900 m) — znane zniekształcenie, do zbadania w M7 na prawdziwych grach
  (ewentualna korekta: osobne mediany w kubełkach dystansu).
- Kara za ręczne zgłoszenie staje się realna (pogarsza tempo), ale nie
  wyklucza z gry — zgodne z ADR 0004 pkt 5 („tryb ręczny jako część gry, nie
  wyjątek").
- Wymaga testów na wstrzykniętym zegarze: pełna gra 3 graczy × 5 stacji,
  sprawdzenie premii, potrącenia, zacisku, przypadku „za mało próbek",
  limitu czasu i kary ręcznej (`test/rozgrywka.test.js`).
- Gdy powstanie gra na wielu urządzeniach (BACKLOG B1), próbek „tej samej
  stacji" będzie więcej i reguła 2.1 zacznie działać bez zmian w kodzie.

## Powiązania

0004 (kryterium dojścia, kara za tryb ręczny, `performance.now`), 0005
(dystans sieciowy zamiast haversine od M4), 0008 (pytanie i odpowiedź są treścią
gry), 0009 (ramy punktacji i model hot-seat — ten ADR doprecyzowuje pkt 5),
0010 (dziennik i stan eksportowalny), 0011 (czytelność wyniku na telefonie).
