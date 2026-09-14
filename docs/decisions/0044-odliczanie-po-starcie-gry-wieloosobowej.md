# 0044 — Start gry wieloosobowej: sygnał i odliczanie 5-4-3-2-1-START, potem gra jak w hotseat

- Status: Zaakceptowana (2026-09-13, uwaga F z testów terenowych właściciela)
- Data: 2026-09-13

## Kontekst

Klik hosta „▶ Start gry” w lobby otwierał na każdym telefonie ekran gry
z hotseat, a na nim — doklejoną kartę `#gra-panel-multi`: komunikat trybu
(„Wspólna Trasa — stacje po kolei… Zostało Ci 5 stacji. Wyniki na żywo poniżej.”),
tabelę Gracz / Punkty / Poprawne / Stacje / Premia, kanał „Info z gry”
(„▶ Jacek wystartował grę”, „📍 X jest na stacji 2”, „✅ X: dobra odpowiedź”),
pasek „Ostatni stan: 18:04:11 UTC · następne odświeżenie za ~27 s”, przycisk
hosta „⏹ Zakończ grę (host)” i wspólny „🏳 Rezygnuję z gry”. Właściciel nazwał
to „potworkiem”: w marszu zasłaniał mapę, mieszał grę z diagnostyką mostu, a jego
przyciski dublowały to, co i tak musiało być dostępne zawsze (ADR 0043 przeniósł
koniec gry za ikonę ⚙ START GRY).

Decyzja właściciela (2026-09-13, uwaga F): po kliknięciu „Rozpocznij grę”
WSZYSCY gracze — także host — dostają sygnał dźwiękowy (o ile nie jest wyciszony)
i odliczanie na środku ekranu nad mapą: wielka cyfra, tło przezroczyste,
5-4-3-2-1-START, każdy krok z sygnałem. Potem aplikacja ma wyglądać DOKŁADNIE
tak jak w trybie hotseat: od razu mini-pasek na dole, nic dodatkowego
w Informacjach, bez tabel, bez czasów odświeżania, bez informacji, kto
wystartował grę.

## Decyzja

1. **Odliczanie na każdym telefonie** (`odliczStartGry()`): kroki
   `5, 4, 3, 2, 1, START`, po 1 s każdy (`ODLICZANIE_KROK_MS`; w trybie testowym
   20 ms, żeby brama jakości nie czekała minuty). Warstwa `#odliczanie` to
   `position: fixed; inset: 0; z-index: 40`, `background: transparent`,
   `pointer-events: none` — NIE jest `.panel-centralny` (tamten ma tło, ramkę
   i cień), więc mapa i gra pod nią zostają widoczne. Cyfra:
   `clamp(96px, 42vw, 220px)`, `tabular-nums` (nie skacze), czytelność w słońcu
   daje obrys cieniem, nie tło (ADR 0011). `role="status"` + `aria-live="assertive"`
   + `aria-atomic="true"`: czytnik ekranu mówi każdy krok.
2. **Każdy krok ma sygnał**: pięć tyknięć `odegrajSygnal('odliczanie')` i na
   koniec `odegrajSygnal('startGry')` — nowe plany w `app/sygnaly.js`
   (wibracja + nuty z oscylatora). Wyłącznik 🔔 działa jak przy każdym innym
   sygnale (ADR 0041): `planSygnalu(..., { wlaczone })` zwraca `null`, więc
   wyciszony telefon odlicza bez dźwięku i bez wibracji.
3. **Odliczają wszyscy tą samą drogą**: host od swojego kliku (`startLobby` →
   stan gry → `uruchomGreMulti`), goście od stanu `trwa` z pollingu — w obu
   przypadkach jest to wejście do gry, więc jeden kod. **Powrót do gry po
   odświeżeniu telefonu NIE odlicza** (`STAN.wznawiamMulti`): to nie jest start,
   a gracz wraca w środek marszu.
4. **Karty `#gra-panel-multi` NIE MA** — razem z nią umarły: `#gra-multi-tura`,
   `#multi-factcheck`, `#gra-multi-tabela`/`#gra-multi-wiersze`,
   `#multi-info`/`#multi-info-lista`, `#gra-multi-sync`,
   `#przycisk-multi-zakoncz`, `#przycisk-multi-rezygnuj` oraz funkcje
   `renderujPanelMulti()` i `renderujInfoMulti()`. Po starcie gracz widzi to, co
   w hotseat: pasek na dole w marszu, panel fazy A/B/C, mapę.
5. **Wybór stacji w Wyścigu na Orientację PRZEPROWADZIŁ SIĘ do panelu fazy A**
   (`#multi-wybor-stacji` między `#gra-cel-stacji` a „▶ Idę do stacji”): to
   mechanika gry (ADR 0027 część B), nie dekoracja, więc zostaje — ale tam, gdzie
   hotseat ma swój przycisk odcinka. We Wspólnej Trasie blok jest ukryty, bo
   kolejność narzuca trasa.
6. **Pasek synchronizacji został tylko w lobby** (`#multi-sync-pasek`): w grze
   „Ostatni stan … · następne odświeżenie za ~N s” nie informuje o niczym, co
   gracz może zrobić. Kolejka offline jest nadal jawna w statusie gracza.
7. **Koniec gry pokazuje WSPÓLNE liczby na ekranie hotseat**
   (`wynikiMultiKonca()`): gdy most zamknie grę, `pokazWyniki()` bierze punktację
   z `przeliczWyniki(gra)` — wszyscy gracze, punkty z premią za kolejność
   (ADR 0027 aneks 2026-09-13) — i rysuje ją w tym samym MINIMALNYM ekranie
   wyniku (ADR 0038: zwycięzca + trzy kolumny). Odświeżamy go ZAWSZE po
   zamknięciu gry w moście, także u gracza, który swoje stacje domknął wcześniej
   i widział już własny wynik: dopiero wtedy liczby są wspólne.
8. **Koniec gry i rezygnacja idą przez ikonę ⚙ START GRY** (ADR 0043):
   organizator → `zakonczGreMulti()`, pozostali → `rezygnujZGryMulti()`
   (dwustopniowe uzbrajanie rezygnacji umarło razem z przyciskiem —
   potwierdzeniem jest wpisane TAK). *Zmienione tego samego dnia przez ADR 0019
   aneks 2026-09-13b (uwaga G): także organizator wychodzi z gry zdarzeniem
   `rezygnacja`, a `zakonczGreMulti()` została usunięta — telefon hosta nie
   kończy gry pozostałym.*

## Konsekwencje

- Start gry jest WSPÓLNYM momentem: wszyscy słyszą i widzą to samo odliczanie,
  więc nikt nie rusza w marsz „bo u mnie już się zaczęło” — a host nie musi
  krzyczeć przez telefon.
- Gra sieciowa przestała wyglądać inaczej niż hotseat: te same panele, ten sam
  pasek, ten sam ekran wyniku. Diagnostyka mostu (polling, kolejka) zeszła do
  lobby i do statusu.
- Utrata kanału info jest celowa: zdarzenia i tak są w moście, a gracz widzi ich
  skutek w punktacji na końcu gry i w rankingu między grami (ADR 0039).
- Żywe wyniki w trakcie gry zniknęły z ekranu gracza; zostały w lobby
  (`#lobby-widownia-wiersze`) dla widowni i dla telefonu, który nie ma już
  swoich stacji.
- Piny: „kontrakt ADR 0044” w `test/kontrakt.test.js` (kształt i z-index warstwy,
  kroki i sygnały, brak odliczania przy wznowieniu, przeprowadzka wyboru stacji,
  pasek sync tylko w lobby, wspólna tabela na końcu) oraz brak usuniętych id-ów
  w HTML i w kodzie; test „uwaga F: po starcie gry sygnał i odliczanie…”
  w `test/wieloosobowa-ui.test.js` przechodzi start na dwóch telefonach.
- Uwaga G (koniec gry hosta nie kończy gry u pozostałych) jest następnym krokiem:
  pkt 8 mówi dziś o ścieżce przez ⚙, a nie o tym, co host wysyła na most.

## Wdrożenie

`index.html` (warstwa `#odliczanie`, usunięta karta `#gra-panel-multi`, wybór
stacji w panelu fazy A), `app/styles.css` (warstwa odliczania), `app/sygnaly.js`
(plany `odliczanie` i `startGry`), `app/app.js` (`odliczStartGry`,
`wynikiMultiKonca`, `uruchomGreMulti(gra, { odliczanie })`, `STAN.wznawiamMulti`,
`renderujWyborStacji()` bez parametrów, `renderujPasekSync()` tylko lobby,
`rezygnujZGryMulti()` bez uzbrajania, usunięte `renderujPanelMulti`/
`renderujInfoMulti`) — ?v=m12-108; atrapa DOM dostała rejestrator
`navigator.vibrate` (`dom.wibracje`).

## Powiązania

ADR 0019 (gra wieloosobowa; aneks 2026-09-13 uchyla pkt 5 i 6 aneksu
2026-09-11), ADR 0027 (tryby i premia za kolejność; aneks 2026-09-13),
ADR 0041 (sygnał = dźwięk i wibracja), ADR 0043 (koniec gry za ikoną ⚙ START GRY),
ADR 0038 (minimalny ekran wyniku), ADR 0039 (ranking między grami),
ADR 0011 (mobile-first: czytelność i cele dotykowe), ADR 0034 (panel centralny —
warstwa odliczania celowo nim NIE jest).

## Aneks 2026-09-14 (m12-115, uwaga F) — wybór stacji usunięty, nie przeprowadzony

Pkt 5 („Wybór stacji w Wyścigu na Orientację PRZEPROWADZIŁ SIĘ do panelu fazy A”,
`#multi-wybor-stacji`) jest nieaktualny. Warstwy wyboru nie ma; wyścig wykrywa
dotarcie do dowolnej niezaliczonej stacji (ADR 0027 aneks 2026-09-14). Reszta
tego ADR — odliczanie 5-4-3-2-1-START, brak karty `#gra-panel-multi`, pasek
sync tylko w lobby, wspólny wynik na ekranie hotseat — bez zmian.

