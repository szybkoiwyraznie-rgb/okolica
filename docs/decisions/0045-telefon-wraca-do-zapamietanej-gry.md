# 0045 — Telefon wraca do zapamiętanej gry sam (kart wznowienia nie ma)

- Data: 2026-09-13
- Status: Zaakceptowana (decyzje właściciela z testów terenowych — uwagi J i K)
- Powiązania: ADR 0010 (historia gier), ADR 0015 pkt 6 (dwustopniowe kasowanie),
  ADR 0019 (gra wieloosobowa), ADR 0043 (koniec gry za ikoną ⚙ START GRY),
  ADR 0044 (gra wygląda jak hotseat)

## Kontekst

Setup pokazywał dwie karty znalezione w `localStorage`: `#karta-wznowienie`
(„Znaleziono niedokończoną grę …" → „▶ Wznów grę" / „🗑 Nowa gra (kasuje
zapis)") i `#multi-wznowienie` („Telefon pamięta grę wieloosobową …" →
„↩ Wróć do gry" / „🗑 Porzuć zapamiętaną grę"). Właściciel po testach
terenowych 2026-09-13:

- **J**: szukanie rozpoczętych i przerwanych gier w `localStorage` oraz
  pokazywanie ich jako opcji na setupie — usunąć w całości.
- **K**: zamknięcie przeglądarki, zamknięcie karty i odświeżenie zapisują
  bieżący stan gry, a otwarcie (albo odświeżenie) aplikacji wraca wprost do tego
  ostatniego zapisu — nie zaczyna od okna startowego.

## Decyzja

1. **Kart wznowienia nie ma.** Z `index.html` zniknęły `#karta-wznowienie`
   (z `#wznowienie-opis` i obu przyciskami) i `#multi-wznowienie` (z opisem i
   obu przyciskami), z `app/styles.css` klasa `.karta-wznowienie`, z `app.js`
   funkcje `sprawdzZapisGry()`, `kasujZapisGry()` (razem z polem
   `STAN.czyszczenieZapisuUzbrojone`) i `renderujWznowienieMulti()`. W ich
   miejscach zostały nagrobki z wyjaśnieniem (LESSONS L31: usunięcie i przegląd
   nośników w tym samym commitcie).
2. **Powrót jest automatyczny i dzieje się na końcu `start()`**: gra
   wieloosobowa ma pierwszeństwo (`czytajSesjeMulti()` → `przywrocGreMulti()`),
   bo jej stan żyje na moście i inni gracze mogą czekać; inaczej
   `przywrocGreHotseat()` podnosi snapshot `stan-gry/1` synchronicznie. Powrót
   zamyka okno startowe (`ukryjStart()`), więc gracz nie zaczyna od Intro.
3. **Zapis, którego nie da się podnieść, start kasuje sam** i mówi dlaczego:
   zepsuty snapshot (kody `T**` z `walidujStanSurowy()`) oraz gra w fazie
   `koniec` — jej wynik jest w „Poprzednich grach" (ADR 0010), a automatyczne
   otwieranie starego wyniku przy każdym starcie byłoby pułapką. Gra zakończona
   RĘCZNIE (⚙ START GRY → TAK) zostaje w zapisie i wraca, bo właściciel
   2026-09-11 zdecydował, że ręczne zakończenie nie kasuje zapisu i grę można
   dokończyć.
4. **Zapis przy pożegnaniu**: oprócz zapisu po KAŻDEJ tranzycji (plan M6,
   decyzja 5) stan leci do `localStorage` przy `pagehide` i przy zwinięciu karty
   (`visibilitychange` → `hidden`). `beforeunload` jest na telefonach zawodny,
   więc to domknięcie ostatniego ruchu, nie jedyne źródło zapisu.
5. **Sesję gry wieloosobowej kasują cztery drogi** (zamiast przycisku „🗑
   Porzuć zapamiętaną grę"): wyjście z lobby (`opuscLobby`), zamknięcie gry
   przez most (`onStanGryMulti`: `zakonczona` / `archiwum`), rezygnacja
   (`rezygnujZGryMulti` — także koniec gry hosta, ADR 0019 aneks 2026-09-13b)
   oraz JAWNA odmowa mostu przy powrocie (gry nie ma, nieznany schemat, nie ma
   Cię na liście graczy). Awaria sieci sesji NIE kasuje: telefon pamięta grę i
   próbuje znowu przy następnym otwarciu.
6. **Dwustopniowe kasowanie zostaje tylko tam, gdzie strata jest trwała i
   widoczna**: historia gier (`kasujHistorieGry`, ADR 0015 pkt 6).

## Konsekwencje

- Mniej klików w terenie: odświeżenie strony = powrót do gry (cel właściciela),
  a setup nie straszy kartami, które opisują stan sprzed chwili.
- Brak jawnego „porzuć grę" w hotseacie: wyjściem jest ⚙ START GRY → TAK
  (kończy grę na tym telefonie i pokazuje wynik) albo „Wróć na początek" po
  grze (`wrocNaPoczatek()` kasuje snapshot i wskaźnik aktywnej gry).
- Ryzyko: kto ma zapamiętaną starą grę i chce zacząć nową, ląduje w starej.
  Kontratak: podnosi się tylko gra NIEzakończona, a po jej zakończeniu albo
  porzuceniu zapis znika sam; historia gier zostaje na setupie.
- Powrót do gry wieloosobowej wymaga sieci; bez zasięgu status mówi, że telefon
  grę pamięta i spróbuje przy następnym otwarciu (kolejka zdarzeń offline jest
  niezależna — ADR 0019).

## Wdrożenie

m12-110: `app/app.js` (`przywrocGreHotseat()`, `przywrocGreMulti()`,
`wznowGre()`, `rezygnujZGryMulti()`, zapis przy `pagehide` i `visibilitychange`,
koniec `start()`), `index.html`, `app/styles.css`; testy `test/aplikacja.test.js`
(powrót bez kliku, zepsuty zapis, zakończona gra nie wraca),
`test/wieloosobowa-ui.test.js` (odświeżenie telefonu B), `test/kontrakt.test.js`
(piny nieobecności kart i obecności autopowrotu), `test/dryf-dokumentow.test.js`
(martwe frazy po kartach).
