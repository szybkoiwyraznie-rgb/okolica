# 0002 — Hosting: GitHub Pages z gałęzi `main` (katalog główny), wszystkie ścieżki względne

- Status: Zaakceptowana (2026-09-06, M8: oba pytania otwarte rozstrzygnięte —
  układ katalogów zbudowany i utrwalony w M0–M7; `AME-main.zip` usunięty
  decyzją właściciela 2026-09-05; publikacja wg `docs/WORKFLOW.md` §5)
- Data: 2026-09-05

## Kontekst

Właściciel wskazał GitHub Pages jako główne miejsce publikacji („albo być może
na jakimś innym adresie"). Repo nazywa się `okolica`, więc adres to
`https://szywkoiwyraznie-rgb.github.io/okolica/` — aplikacja żyje **w podkatalogu
domeny**, nie pod jej korzeniem. AME publikuje się z gałęzi `main` z katalogu
głównego i to działa. Alternatywy: publikacja z `/docs` (Jekyll „docs folder"),
osobna gałąź `gh-pages` z artefaktem, albo inny host (Netlify/Cloudflare Pages).

W korzeniu repo leży `AME-main.zip` (~6,5 MB) — materiał referencyjny
właściciela, który po publikacji Pages byłby publicznie pobieralny.

## Decyzja

1. Publikacja **z gałęzi `main`, katalog główny** (jak w AME). Bez gałęzi
   `gh-pages` i bez artefaktu budowania — build nie istnieje (ADR 0001).
2. **Aplikacja w korzeniu repo**: `index.html`, `app/`, `data/`, `assets/`.
   Dokumentacja projektu w `docs/` (publikowana razem — świadomie, jak w AME).
3. **Wszystkie ścieżki względne**: `app/app.js?v=…`, `data/…`, `assets/…`.
   Zakaz adresów od korzenia (`/app/…`) — złamałyby się pod `/okolica/`.
   Test kontraktowy pilnuje braku `href="/` i `src="/` w `index.html`.
4. `.nojekyll` w korzeniu, żeby GitHub Pages serwowało pliki dosłownie
   (bez przetwarzania Jekyll i bez pomijania katalogów zaczynających się od `_`).
5. Deep-linki stanów gry przez fragment i query (`#setup`, `#gra`,
   `?kod=…`) — bez routera, bez historii przeglądarki jako źródła prawdy.
6. **Los `AME-main.zip`: do decyzji właściciela.** Propozycja sesji: przenieść
   do `docs/archive/AME-wzorzec.zip` (wtedy jest częścią dokumentacji i da się
   go pobrać z Pages) albo usunąć z repo po przeniesieniu wzorców do
   `docs/LESSONS.md` i ADR-ów. Agent nie usuwa ani nie przenosi pliku
   właściciela bez jego zgody.
7. Przenośność: aplikacja nie wie, gdzie jest hostowana — jedyny ślad hosta to
   względne ścieżki, więc zmiana dostawcy (Netlify, własna domena) nie wymaga
   zmian w kodzie.

## Konsekwencje

- Wymaga jednorazowego włączenia Pages przez właściciela (Settings → Pages →
  Branch: `main`, `/ (root)`); agent nie ma do tego uprawnień i nie prosi
  o to w środku sesji — instrukcja leży w `docs/WORKFLOW.md` §5.
- Cała dokumentacja projektu jest publiczna (jak w AME). Nic tajnego nie trafia
  do `docs/` — w szczególności **żadnych paczek pytań z rozgrywek ani
  współrzędnych graczy** (ADR 0013, `.gitignore`).
- Plik binarny > 2 MB w korzeniu jest odstępstwem od reguły z `AGENTS.md` §4 —
  rozstrzygnięcie w pkt 6.
- Brak nagłówków cache dla `index.html` na Pages → cache-busting `?v=` jest
  obowiązkowy (AGENTS §7).

## Powiązania

0001 (zero builda), 0010 (trwałość), 0013 (prywatność publikowanych danych).
