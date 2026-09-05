# Tajemnicza Okolica

Terenowa gra quizowa na interaktywnej mapie. Aplikacja ustala, gdzie stoisz
(geolokalizacja przeglądarki), rozstawia w Twojej okolicy **stacje** — punkty
osiągalne siecią dróg, placów i szlaków — a potem prowadzi graczy od stacji do
stacji, mierząc czas i zadając pytania o **tę konkretną okolicę**.

Pytania nie są wbudowane w aplikację: generuje je model AI (Meta AI, ChatGPT,
dowolny inny) na podstawie promptu, który aplikacja sama układa, a odpowiedź
wkleja się z powrotem. Aplikacja waliduje schemat i **ukrywa** paczkę (obfuskacja
bez klucza, kontener `TO-paczka/2` — nieczytelna przy kopiowaniu, ale **nie
zaszyfrowana**; ADR 0007), żeby gracze nie podejrzeli pytań przed dojściem do
stacji.

- **Zero zależności i zero builda** — vanilla HTML + JS (ESM) + CSS (ADR 0001).
- **Mobile-first** — gra się na telefonie, w Chrome, palcem (ADR 0011).
- **Bez backendu i bez kluczy API** — model AI jest „zewnętrznym silnikiem
  treści", a wymiana odbywa się przez schowek (ADR 0006).

## Status

**M1 — geodezja i model rozgrywki: zrobione.** Działa szkielet aplikacji
(pięć ekranów: setup → pozycja → stacje → prompt → paczka) z walidacją
konfiguracji, promptem PYT v1.0, walidacją paczki i jej ukrywaniem
(`TO-paczka/2`). Jako czyste funkcje z testami istnieją też **model rozgrywki**
(`app/rozgrywka.js`: kolejka graczy, odcinki i czasy, kara za ręczne
zgłoszenie, punktacja względem mediany tempa, dziennik i podsumowanie) oraz
**warstwa pozycji** (`app/pozycja.js`: filtr dokładności, kryterium dojścia
z debounce'em, komunikaty błędów GPS, symulacja trasy dla trybu testowego).

**Ekranu gry jeszcze nie ma**: rozgrywka jest policzona i przetestowana, ale
nieklikalna. Mapa (M2), stacje z sieci dróg i placów (M4), trwały zapis stanu
(M5) i interfejs gry (M6) — patrz `docs/ROADMAP.md`.

## Uruchomienie lokalne

```bash
npm test                       # brama jakości (node --test, zero zależności)
npm run serwer                 # python3 -m http.server 8000 --bind 0.0.0.0
# otwórz http://localhost:8000
```

Bez serwera (`file://`) aplikacja pokaże baner z instrukcją — przeglądarki
blokują `fetch()` i moduły ES dla plików lokalnych. Geolokalizacja wymaga
**kontekstu bezpiecznego**: `https://` (GitHub Pages) albo `localhost`.

## GitHub Pages

Publikacja z gałęzi `main`, katalog główny (ADR 0002). Wszystkie ścieżki
w aplikacji są **względne**, więc działa i pod `https://<user>.github.io/okolica/`,
i z dowolnego podkatalogu.

## Repozytorium

| Ścieżka | Zawartość |
|---|---|
| `AGENTS.md` | **zasady pracy agentów — lektura startowa każdej sesji** |
| `docs/PROTOKOL.md` | protokół PYT v1.0: szablon promptu, schemat JSON, walidacja |
| `docs/decisions/` | rejestr decyzji architektonicznych (ADR 0001–0013) |
| `docs/ARCHITECTURE.md` | budowa aplikacji, przepływ danych, algorytm stacji |
| `docs/ROADMAP.md` | kamienie milowe M0–M10 i status |
| `docs/WORKFLOW.md` | procedura sesji + procedura testowania w terenie |
| `docs/LESSONS.md` | rejestr lekcji (objaw → przyczyna → reguła) |
| `docs/setup/ENVIRONMENT.md` | stałe ograniczenia sandboxa, gita i sieci |
| `docs/setup/HANDOFF_*.md` | stan na koniec JEDNEJ sesji |
| `docs/ASSETS.md` | dostawcy kafelków i danych, polityki, atrybucje |
| `app/`, `index.html` | aplikacja |
| `test/` | `node --test` — czysta logika, bez DOM i bez sieci |
| `AME-main.zip` | wzorzec dobrych praktyk z projektu AME (materiał referencyjny) |

## Prywatność

Współrzędne gracza nie są wysyłane nigdzie poza usługi potrzebne do rysowania
mapy i wyznaczania stacji (kafelki, Overpass API, odwrotna geokodacja) — i to
wprost z przeglądarki użytkownika. Zero analityki, zero ciasteczek, zero konta
(ADR 0013).
