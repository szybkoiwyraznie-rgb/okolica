# Plan kamienia M6 — Rozgrywka: ekran gry i trwałość stanu

- Data: 2026-09-06
- Kamień: **M6** (`docs/ROADMAP.md`) — pętla stacji na ekranie telefonu
  + `app/trwalosc.js` (zapis i wznowienie po zamknięciu przeglądarki).
- Stan wyjściowy: brama 332/332; model rozgrywki kompletny i przetestowany
  (`app/rozgrywka.js`, M1: fazy, odcinki, punktacja z medianą tempa ADR 0014,
  kody G01–G13, `podglad`, `podsumowanie`); pozycja na żywo jednym lejem
  `przyjmijFix` (M3, `stanDojscia` z progiem i debounce); mapa z pinezkami
  stacji i trasą (M2/M4); paczka ukrywana do kontenera `TO-paczka/2` (M0/M5).
  **Nie ma**: `app/trwalosc.js` (ARCHITECTURE A.8 już na niego wskazuje),
  ekranu gry (`EKRANY` = 5 ekranów przygotowania), przycisku startu gry.

## Zakres

**Wchodzi:**
- `app/trwalosc.js` — czyste funkcje snapshotu stanu gry: schemat
  `stan-gry/1`, walidacja z kodami `T01–T…`, klucze `okolica:gra:<kodGry>`
  + wskaźnik `okolica:gra-aktywna`, budżet rozmiaru.
- `ekran-gra` (szósty ekran, fazy ADR: przygotowanie → odcinek → pytanie →
  koniec jako PANELE jednego ekranu): badge „czyja kolejka" i „ile metrów"
  (ADR 0009/0011), start odcinka, dojście GPS (próg z `stanDojscia`, dwa
  trafienia) albo zgłoszenie ręczne z karą (ADR 0004 pkt 5), pytanie
  **odsłaniane w chwili dojścia** (ADR 0007 pkt 6), odpowiedzi (4 przyciski,
  cele ≥ 44 px), wyjaśnienie + źródła po odpowiedzi, pauza/wznowienie,
  pominięcie odcinka w drodze (ADR 0015), stacja bez pytania zamykana samym
  dojściem (ADR 0015), koniec gry i minimalny wynik z `podsumowanie()`
  (pełne podsumowanie = M7).
- Zapis stanu po KAŻDEJ tranzycji + wznowienie: przy starcie aplikacji baner
  „Znaleziono niedokończoną grę" (Wznów / Nowa gra kasuje zapis).
- Start gry z ekranu paczki („▶ Zacznij grę") — od tej chwili w pamięci
  aplikacji żyje wyłącznie kontener `TO-paczka/2`, nie plaintext.

**Nie wchodzi (świadomie):** pełne podsumowanie i eksport wyniku (M7),
publikacja/manifest/CI (M8), backend Drive+Apps Script (ADR 0016 —
Proponowana, B17: nie wcześniej niż po M8), gra na kilku urządzeniach
(ADR 0009 obowiązuje: hot-seat), pytania z wielu paczek naraz.

## Etapy

- [ ] **R1 — plan (ten plik):** zakres, decyzje, ryzyka; commit + push.
- [x] **R2 — `app/trwalosc.js` (czyste):** `SCHEMAT_STANU='stan-gry/1'`,
      `zbierajStan({konfig, stacje, kontenerPaczki, rozgrywka, pozycja, fazaEkranu, czasMs})`
      → snapshot; `walidujStanSurowy(tekst)` → `{stan, usterki}` (kody T:
      schemat, wersja protokołu, kształty konfig/stacje/rozgrywka, budżet
      2 MB, wiek wpisu); `kluczStanu(kodGry)`, `KLUCZ_AKTYWNEJ`;
      **strażnik plaintextu**: JSON snapshotu nie może zawierać treści pytań
      (test na fixture `paczka-ok` — snapshot przed i po round-tripie).
      Rozpoznanie: czy `stan.odpowiedzi` niesie treść pytania (jeśli tak —
      strip przy serializacji, bo `rozgrywka/1` sam w sobie paczki nie zna:
      `pytania` = referencje `{stacja, pytanieId}`). Testy czyste.
- [x] **R3 — szkielet `ekran-gra` (HTML+CSS):** cztery panele faz, badge
      kolejki i dystansu (duże, czytelne w słońcu — ADR 0011), karta pytania
      z 4 odpowiedziami i sekcją wyjaśnienie/źródła, mapa gry (kontener pod
      `utworzMape`), przyciski: start odcinka, ręczne zgłoszenie (z ostrzeżeniem
      o karze), pauza/wznów, pomiń, następna stacja, zakończ grę; `EKRANY`
      + pasek kroków; kontrakt na cele dotykowe i strukturę.
- [x] **R4 — wiring faz przygotowanie/odcinek w `app.js`:** „▶ Zacznij grę"
      (zapakuj → `nowaRozgrywka` z `czasMs` z `performance.now()` warstwy DOM,
      ADR 0004 pkt 3), render badge'y z `podglad()` (pole `pytanie` NIE jest
      renderowane przed fazą `pytanie`!), start odcinka, dystans na żywo
      z `przyjmijFix` (rozszerzenie leja: gdy faza `odcinek` — `stanDojscia`
      względem bieżącej stacji), dojście GPS → `zakonczOdcinek({trybDojscia:'gps', fix})`,
      ręczne → `zakonczOdcinek({trybDojscia:'reczne'})` + jawny komunikat kary,
      pauza/wznowienie (`komunikatPauzy/wznowienia`), mapa: pinezki stacji
      + marker gracza + bieżąca stacja wyróżniona.
- [x] **R5 — pętla pytania:** po `zakonczOdcinek` → `odpakujPaczke(kontener)`
      (dopiero teraz; wcześniej w pamięci tylko kontener) → pytania stacji
      (`pytaniaStacji`, obsługa >1 pytania i wielu odpowiadających —
      `ktoOdpowiada`, G06/G07) → karta pytania → `zapiszOdpowiedz` →
      wyjaśnienie + źródła (linki `rel=noopener`) → zamknięcie stacji →
      „Następna stacja" albo `czyKoniec`; stacja bez pytania: warning ADR 0015
      + zamknięcie dojściem; `pominStacje` tylko w drodze (G11/G13 do UI).
- [ ] **R6 — trwałość w UI:** zapis po każdej tranzycji (`zbierajStan` →
      `localStorage`), `okolica:gra-aktywna`; baner wznowienia na setup:
      Wznów (odczyt → walidacja T → powrót do właściwej fazy + re-watch
      pozycji) / Nowa gra (dwustopniowo kasuje zapis — bez `confirm()`,
      ADR 0015 pkt 6); koniec gry → panel wyniku z `podsumowanie()`
      (punkty graczy, czasy, zaliczone/pominięte) + adnotacja „pełne
      podsumowanie w M7"; czyszczenie danych (ekran prywatności) kasuje
      zapis gry — istniejąca iteracja `okolica:*` już to robi (test).
- [ ] **R7 — testy integracyjne pętli:** pełna gra na atrapie z `?tryb=test`
      (symulacja dojścia `sekwencjaSymulowana` → pytanie → odpowiedź →
      następna → koniec → wynik); wznowienie po „zamknięciu przeglądarki"
      (nowy import app.js, ta sama pamięć); utrata zasięgu w trakcie (gra
      nie woła sieci — stacje i paczka z cache/pamięci); ręczne zgłoszenie
      z karą; pauza/wznowienie; ADR 0015 (stacja bez pytania); strażnik
      plaintextu w zapisanym snaphocie (przez `pamiec` atrapy).
- [ ] **R8 — dokumenty i zamknięcie:** README, ROADMAP („kod M6 gotowy"),
      ARCHITECTURE (B.1–B.6 z realnym UI, A.8 `trwalosc` istnieje),
      PROJECT_HISTORY, LESSONS jeśli coś zaskoczy, cache-busting `?v=m6-1`,
      aktualizacja PR #2. Kryterium właściciela (§4.2): gra przechodzalna
      od setupu do wyniku NA TELEFONIE, z utratą zasięgu w trakcie i z
      zamknięciem przeglądarki (wznowienie).

## Decyzje projektowe

1. **Jeden ekran, cztery panele faz** — `ekran-gra` przełącza panele wg
   `stan.faza` + `stan.odcinka`; zero żonglowania ekranami w terenie
   (ADR 0011: jeden główny przycisk na fazę, reszta wtórna).
2. **Snapshot bez plaintextu:** `stan-gry/1` niesie `kontenerPaczki`
   (`TO-paczka/2`) i stan `rozgrywka/1` (referencje pytań), NIGDY treści
   pytań — spójne z ADR 0007 pkt 4 i eksportem J4; test-strażnik w R2 i R7.
3. **Odsłonięcie pytania w chwili dojścia:** `odpakujPaczke` wołane dopiero
   w tranzycji do fazy `pytanie` (ADR 0007 pkt 6); `podglad().pytanie`
   istnieje w modelu, ale warstwa DOM NIE renderuje go przed tą fazą.
4. **Czas z warstwy DOM:** wszystkie `czasMs` z `performance.now()`
   (ADR 0004 pkt 3) — logika pozostaje czysta i testowalna; pauza zatrzymuje
   strumień fixów (M3 `visibilitychange`) i odkłada `wznowienieMs`.
5. **Zapis po każdej tranzycji, nie „na wyjściu":** `beforeunload` jest
   na telefonach zawodny — snapshot ląduje w `localStorage` synchronicznie po
   każdym ruchu (start/koniec odcinka, odpowiedź, pominięcie, pauza, koniec).
6. **Wznowienie jest jawne i destruktywne tylko za potwierdzeniem:** baner
   na setup („Wznów" / „Nowa gra kasuje zapis" — drugi klik potwierdza,
   bez `confirm()`); walidacja T przy odczycie — zepsuty zapis = komunikat
   i oferta usunięcia, nigdy cichy start od zera.
7. **Minimalny wynik w M6:** tabela punktów z `podsumowanie()` + liczniki;
   eksport/medale/historia = M7 (bez duplikowania roboty).

## Ryzyka

- **Atrapa DOM vs pętla gry** (timery `performance.now`, `watchPosition`,
  sekwencja symulacji) — M3 przecierał szlak (`przyjmijFix` lej), ale faza
  `odcinek` dokłada async dojścia; mitygacja: testy R7 na `?tryb=test`
  z `sekwencjaSymulowana`, bez prawdziwych zdarzeń GPS.
- **Rozmiar snapshotu** (dziennik + odpowiedzi rosną) — budżet 2 MB i kod T
  przy przekroczeniu; dziennik jest krótki (zdarzenia, nie fixy — fixy GPS
  zostają w `dodajFix` pamięci pozycji, do snapshotu idzie OSTATNI fix).
- **Re-watch pozycji po wznowieniu** — podwójny watcher = podwójne fixy;
  mitygacja: `wylaczWatch` przed ponownym `watchPozycja` (istniejący wzorzec
  pauzy z M3).
- **Wyścig „dojście podczas pauzy"** — `stanDojscia` z bufora po wznowieniu
  mógłby natychmiast zamknąć odcinek; mitygacja: bufor trafień kasowany
  przy pauzie i przy wznowieniu (test w R7).

## Kryteria przyjęcia (kod)

- Brama zielona (cel: +30–40 testów), zero plaintextu pytań w `localStorage`
  (strażnik), pełna pętla na atrapie od „Zacznij grę" do wyniku, wznowienie
  po nowym starcie aplikacji z tą samą pamięcią, wszystkie kody G01–G13
  osiągalne z UI jako komunikaty (nie wyjątki).

## Kryterium właściciela (`WORKFLOW` §4.2)

Gra przechodzalna od setupu do wyniku na telefonie: dojścia GPS z progiem,
pytanie odsłaniane NA stacji, odpowiedź z wyjaśnieniem i źródłami, wynik;
utrata zasięgu w trakcie nie przerywa gry (stacje z cache, zero nowych
żądań); zamknięcie przeglądarki i wznowienie wraca do właściwej fazy.
