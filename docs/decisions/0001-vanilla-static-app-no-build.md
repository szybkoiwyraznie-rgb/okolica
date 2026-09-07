# 0001 — Statyczna aplikacja vanilla HTML+JS (ESM) bez kroku budowania i bez zależności

- Status: Zaakceptowana
- Data: 2026-09-05

## Kontekst

Gra działa na telefonie, w przeglądarce, z GitHub Pages, bez konta i bez
instalacji — vanilla HTML+JS bez zależności (brief z 2026-09-05; ten paradygmat
sprawdził się w AME). Framework/bundler/biblioteka mapowa to: krok budowania,
`node_modules`, lockfile, ryzyko zerwania API, większy payload i łatanie
zabezpieczeń.

## Decyzja

1. Aplikacja to **statyczna strona**: `index.html` + moduły ES w `app/` + CSS
   w `app/styles.css` + dane w `data/`. Serwuje ją dowolny serwer statyczny.
2. **Zero zależności npm** — runtime i dev. `package.json` istnieje tylko po
   to, żeby nosić skrypty (`npm test`, `npm run serwer`) i metadane.
3. **Zero kroku budowania aplikacji.** Testy i narzędzia walidacyjne chodzą na
   `node --test` (Node ≥ 20) i czystych skryptach `.mjs` w `tools/`.
4. Logika dzieli się na **czyste funkcje** (geodezja, projekcja, wybór stacji,
   walidacja paczki, ukrywanie paczki, punktacja) — testowalne w Node bez DOM i bez sieci
   — oraz **warstwę DOM** (`app/ui.js`, `app/mapa.js`), która jest cienka.
5. Moduły w `app/` używają wyłącznie API przeglądarki i standardu
   (`globalThis.crypto`, `fetch`, `localStorage`, `navigator.geolocation`,
   `ResizeObserver`, `PointerEvent`). Zakaz `node:*` i `require()` (LESSONS L6).
6. Cache-busting przez `?v=<wersja>` w `index.html` i we wszystkich importach —
   jedna wersja wszędzie, pilnowana testem kontraktowym.

## Konsekwencje

- Koszt: własny renderer mapy, własny routing/wybór stacji, własne komponenty
  UI. To więcej kodu niż „wstaw Leaflet", ale kod jest nasz, mały i testowalny,
  a wzorzec (renderer SVG + kafelki) istnieje już w AME i da się przenieść.
- Zysk: `npm test` działa w każdej sesji bez instalacji; strona ładuje się
  na telefonie bez bundla; brak „rotacji zależności".
- Ograniczenie: `file://` nie działa (moduły + `fetch`) — aplikacja pokazuje
  baner z instrukcją uruchomienia serwera.
- Zmiana tego paradygmatu (np. MapLibre, React, Vite) wymaga **wyrażnej decyzji
  właściciela i nowego ADR** zastępującego ten.

## Powiązania

0002 (hosting), 0003 (mapa bez bibliotek), 0006 (bez backendu), 0007 (Web
Crypto), 0011 (mobile-first), 0012 (brama jakości = `npm test`).
