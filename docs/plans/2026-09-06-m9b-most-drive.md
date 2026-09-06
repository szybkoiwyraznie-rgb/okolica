# Plan M9b — Most Drive dla repozytorium paczek (2026-09-06)

Kontekst: decyzje właściciela z 2026-09-06 (po M9): współdzielone repozytorium
zestawów pytań żyje na wydzielonym koncie Google Drive z mostem Apps Script
(ADR 0016 → Zaakceptowana jako kierunek); plikowe repozytorium w repozytorium
kodowym USUNIĘTE decyzją właściciela; kryteria kompatybilności wbite w M9.
Szczegóły przepływu ustalone przez właściciela:

- **Wysyłka**: automatycznie w chwili przyjęcia zestawu w aplikacji
  („✓ Sprawdź i przyjmij" na ekranie wklejania odpowiedzi modelu).
- **Akceptacja**: powiadomienie e-mailem z linkiem do podglądu; akceptacja
  jednym kliknięciem (Apps Script przenosi plik do katalogu zaakceptowanych).
- **Dostęp graczy**: indeks zaakceptowanych zestawów z web app (tylko odczyt).
- **Zgoda (korekta 2026-09-06)**: checkbox na ekranie wklejania, domyślnie
  zaznaczony; odhaczenie = zestaw zostaje tylko na telefonie.

## Kroki

- [x] **D0 — sprzątanie po decyzji**: usunięte `data/paczki/`, narzędzie
      indeksu, kontrakt indeks↔katalog; repozytorium współdzielone tylko pod
      jawnym adresem (klucz `okolica:repo-zestawow:url`); commit fa413c4.
- [x] **D1 — plan + kod mostu**: `docs/setup/apps-script-repo-paczek.gs`
      (doGet: indeks/paczka/strona przeglądu; doPost: przyjęcie kandydata
      + e-mail z linkiem; zatwierdź/odrzuć; dekodowanie kontenera po stronie
      skryptu tym samym algorytmem co `app/kodowanie.js`) + instrukcja
      wdrożenia `docs/setup/most-drive-instrukcja.md`.
- [x] **D2 — integracja w aplikacji (wysyłka)**: `wyslijZestawNaDrive()` po
      udanym „✓ Sprawdź i przyjmij" buduje TO-zestaw/1 (stacje sesji + kontener
      + meta z `przegladZrodel`) i wysyła POST `text/plain;charset=utf-8` na URL
      z `okolica:repo-zestawow:url`; jawne statusy każdej gałęzi: WYSŁANA /
      już na Drive / błąd mostu / brak adresu / brak zgody (LESSONS L6);
      awaria nigdy nie blokuje gry (`.catch`).
- [x] **D3 — zgoda (KOREKTA WŁAŚCICIELA 2026-09-06)**: zamiast sekcji w karcie
      prywatności — checkbox `<input id="zgoda-drive" type="checkbox" checked>`
      NA EKRANIE WKLEJANIA odpowiedzi AI, DOMYŚLNIE ZAZNACZONY („zgadzam się"),
      użytkownik może odhaczyć (opt-out); odhaczenie = zero wysyłki + jawny
      status. Cel dotykowy ≥44 px (ADR 0011); kontrakt pilnuje domyślnego
      zaznaczenia; atrapa DOM rozumie atrybut `checked`. Klucz
      `okolica:zgoda-drive` nie powstał — przy zgodzie na ekranie jest zbędny.
- [ ] **D4 — indeks z Drive w karcie propozycji**: wpis indeksu może nieść
      `id` pliku Drive (pobranie przez `?akcja=paczka&id=…`) albo względną
      ścieżkę (własny hosting właściciela); przycisk „🔌 Sprawdź połączenie"
      w źródłach = instrument spike’u CORS na żywym wdrożeniu.
- [ ] **D5 — testy**: GOTOWE (z D2/D3): wysyłka po przyjęciu (atrapa fetch:
      metoda, text/plain, ciało TO-zestaw/1 ze stacjami sesji), bramka zgody
      (odhaczona = zero POST-ów), brak adresu (zero POST-ów), kontrakt
      checkboxa; brama 420/420 + CI. ZOSTAŁO: indeks z `id` i przycisk
      połączenia — po D4.
- [ ] **D6 — dokumentacja**: ASSETS (Apps Script/Drive jako dostawca: polityka,
      brak klucza, URL jako zdolność), ADR 0016 (uzupełnienie o wynik spike’u
      po wdrożeniu właściciela), README/ARCHITECTURE/ROADMAP/PROJECT_HISTORY,
      opis PR #2.

## Ryzyka

- **CORS/redirect web app**: fetch z przeglądarki do `script.google.com`
  przechodzi przez 302 na googleusercontent — znany wzorzec działa dla
  GET i POST text/plain; D4 daje przycisk testowy, więc spike odbywa się
  na żywym wdrożeniu właściciela, nie w próżni (wynik trafia do ADR 0016).
- **Sekret linku przeglądu**: token w Properties skryptu; link w e-mailu =
  zdolność (kto ma link, ten ogląda); akceptacja bez dodatkowego hasła, bo
  e-mail właściciela jest kanałem zaufanym (świadoma decyzja prostoty).
- **Rozmiar paczki**: POST text/plain bez limitów Apps Script (50 MB/body) —
  paczki mają kilkadziesiąt KB; budżet rejestru lokalnego i tak pilnuje telefonu.

## Kryterium

Gracz A kończy grę z modelem → zestaw sam wychodzi na Drive → właściciel
klika „zaakceptuj" z e-maila → gracz B w tej samej okolicy (kompatybilny
setup) widzi zestaw na karcie i gra bez modelu.
