# Plan M11+M12 — Gra wieloosobowa na wielu urządzeniach + rankingi (2026-09-06)

Kontekst: decyzje właściciela z 2026-09-06 zapisane w **ADR 0019**
(Zaakceptowana): parowanie DWIEMA drogami (lobby okolicy + kod gry), OBA tryby
(wyścig i tury), M12 = pseudonim + wyniki + historia + rankingi (ogólny, wiek,
tematy, lokalizacja). Fundament: most Drive z M9b (ADR 0016/0018) — rozbudowa
jednego skryptu, wdrożenie właściciela nadal ODROCZONE (jedna instrukcja w
czacie na końcu, ADR 0018 pkt 3 → krok P8).

## Schematy (robocze; po implementacji — aneks do `docs/PROTOKOL.md`)

`RO-gra/1` — stan gry na Drive (źródło prawdy):

```json
{
  "schemat": "RO-gra/1",
  "kod": "K2H7QM",
  "idGry": "<id pliku Drive>",
  "tryb": "wyscig | tury",
  "stan": "lobby | trwa | zakonczona",
  "utworzono": "2026-09-06T18:00:00.000Z",
  "organizatorId": "g-1",
  "gracze": [{ "id": "g-1", "pseudonim": "Szybki", "dolaczyl": "…" }],
  "konfiguracja": {
    "liczbaStacji": 5, "pytaniaNaStacje": 1, "wiek": "dorosli",
    "tematy": ["historia"], "promienM": 1000,
    "miejsce": "Podkowa Leśna", "geohash5": "u3qb8"
  },
  "zestaw": { "stacje": ["…"], "kontener": "TO-paczka/2", "meta": "meta TO-zestaw/1" },
  "zdarzenia": [{
    "kolejnosc": 1, "graczId": "g-1", "typ": "start | dojscie | odpowiedz | rezygnacja | koniec",
    "stacjaId": 1, "dane": { "…": "…" }, "tSerwera": "…"
  }],
  "wyniki": { "g-1": { "punkty": 42, "czasMs": 3600000, "poprawne": 4, "bledne": 1 } }
}
```

`RO-zdarzenie/1` — POST z urządzenia: `{ schemat, kod|idGry, graczId, typ,
stacjaId?, dane?, tUrzadzenia }`; most nadaje `kolejnosc` i `tSerwera`.
**Zero współrzędnych** w jakimkolwiek polu (ADR 0013/0019 pkt 3 — pilnuje test).

## Kroki

- [x] **P0 — decyzje + plan**: ADR 0019, aneks ADR 0009, ROADMAP M11/M12,
      PROJECT_HISTORY, ten plik.
- [ ] **P1 — most: rozbudowa Apps Script** (`docs/setup/apps-script-repo-paczek.gs`):
      katalogi `okolica-gry-{otwarte,zakonczone}` w `setup()`; akcje:
      `gra-zaloz` (POST: pseudonim, tryb, zestaw z telefonu → RO-gra/1 lobby,
      kod 6 znaków bez 0/O/1/I generowany z puli wolnych, wygasanie 24 h),
      `gra-lista` (GET: otwarte gry BEZ kodów — id, miejsce, geohash5, tryb,
      gracze, wiek utworzenia), `gra-dolacz` (POST: kod LUB idGry + pseudonim),
      `gra-start` (POST organizator: lobby → trwa), `gra-stan` (GET kod|idGry),
      `gra-zdarzenie` (POST: walidacja spójności — tury: odrzucenie zdarzenia
      nie od bieżącego gracza; stacjaId w zakresie; LockService na zapis),
      `gra-zakoncz` (POST: agregacja wyników, przeniesienie do zakończonych),
      `ranking` (GET: ogólny + kategorie wiek/tematy/lokalizacja z gier
      zakończonych — agregacja po `konfiguracja` i `wyniki`).
- [ ] **P2 — moduł czysty `app/wieloosobowa.js`**: walidacje surowe RO-gra/1
      i RO-zdarzenie/1 (kody R01–R1x, odmowa przy obcym schemacie), filtr
      lobby po geohash5 + sąsiednich komórkach (wzorzec ADR 0017), maszynka
      stanów (czyja tura; wyścig: wszyscy równolegle), przeliczanie wyników ze
      zdarzeń per tryb (punktacja ADR 0014 per gracz), kolejka zdarzeń offline,
      wznowienie gry ze stanu (resume). Testy bez DOM i bez sieci.
- [ ] **P3 — warstwa synchronizacji `app/sync.js`**: poller z interwałami
      (lobby 10 s; wyścig 12 s; tury: bieżący gracz 10 s, czekający 30 s),
      POST zdarzeń natychmiast + kolejka offline z flushem po powrocie sieci,
      pauza w tle karty (wzorzec ADR 0004 pkt 1), jawne statusy każdej awarii
      (LESSONS L6).
- [ ] **P4 — UI**: setup: wybór „Hot-seat (1 telefon) | Gra na wielu
      urządzeniach"; zakładanie gry (pseudonim, tryb, ZGODA wymagana — bez niej
      brak wysyłki i jawna odmowa; źródło zestawu: paczka sesji / lokalna /
      Drive); ekran lobby (gracze, start u organizatora); dołączanie (wpisanie
      kodu ALBO lista gier okolicy z odległością); ekran gry: tury — „Idzie:
      Gracz X (jego telefon)", wyścig — żywa tabela wyników wszystkich; pasek
      synchronizacji (ostatni stan, następne odświeżenie).
- [ ] **P5 — testy**: czyste (P2/P3) + UI z atrapą mostu: dwa „urządzenia"
      (dwie instalacje DOM + dwa importy app) grają wyścig i tury end-to-end
      (załóż → dołącz kodem i przez lobby → start → dojścia → odpowiedzi →
      koniec → wyniki po obu stronach); kolejka offline i flush; resume po
      „odświeżeniu"; odrzucenie zdarzenia poza turą; SKANER ciał POST-ów pod
      kątem współrzędnych (zero lat/lon w czymkolwiek, co wychodzi); kontrakt
      (zgoda wymagana, ekrany, kody).
- [ ] **P6 — M12: profil i rankingi**: pseudonim `okolica:pseudonim` (edycja
      w setupie/prywatności), wyniki wysyłane przy zakończeniu, ekran
      „🏆 Rankingi": ogólny + zakładki WIEK / TEMATY / LOKALIZACJA (dane z
      `akcja=ranking`), ekran „Moje gry" (historia zakończonych z udziałem
      gracza). Testy: agregacje (atrapa mostu), kategorie, puste rankingi.
- [ ] **P7 — dokumentacja**: PROTOKOL aneks (RO-gra/1, RO-zdarzenie/1, kody R),
      ARCHITECTURE (moduły, przepływ synchronizacji), README, ASSETS §7
      (rozszerzenie: gry i rankingi), WORKFLOW §4.4 (test terenowy na dwa
      telefony), ROADMAP M11/M12 ✅, PROJECT_HISTORY, LESSONS z pułapek.
- [ ] **P8 — JEDNA instrukcja wdrożenia (ADR 0018 pkt 3)**: gdy P1–P7 świecą
      na zielono — instrukcja w CZACIE (kroki + okna txt do wklejenia):
      scalony skrypt (paczki + gry + rankingi), script properties, `setup()`,
      deploy „anyone anonymous", wklejenie URL do aplikacji, próba „🔌 Sprawdź
      połączenie", test end-to-end paczki i gry na dwa telefony.

## Kryterium akceptacji

Dwa „urządzenia" w teście (i docelowo dwa telefony w terenie, WORKFLOW §4.4):
załóż grę → dołącz kodem ORAZ z lobby → wyścig i tury przechodzą end-to-end →
wyniki i rankingi (ogólny + wiek + tematy + lokalizacja) widoczne po
zakończeniu; współrzędne nie opuszczają urządzenia (skaner POST-ów); bez mostu
gra wieloosobowa odmawia jawnie, a hot-seat działa jak dotąd; brama zielona.

## Ryzyka

- **Quota Apps Script** przy 4+ graczach i długiej grze — interwały P3,
  czekający w turach pollują rzadko; monitoring w WORKFLOW §4.4.
- **Stany wyścigu** (dwa urządzenia naraz) — LockService + numerowanie
  `kolejnosc` po stronie mostu; lista zdarzeń jest append-only, aplikacja
  idempotentna wobec powtórek.
- **Porzucone lobby** — gra otwarta wygasa po 24 h (most przenosi do archiwum).
- **Prywatność lobby** — otwarta gra pokazuje okolicę i pseudonimy: jawna
  zgoda przy zakładaniu (ADR 0019 pkt 3), bez zgody brak gry wieloosobowej.
- **Zestaw pytań na Drive** — kontener już jest ukryty (ADR 0007), więc pytania
  nie są widoczne przed dojściem także u innych graczy; reguła „reveal on
  arrival" obowiązuje na każdym urządzeniu z osobna.
