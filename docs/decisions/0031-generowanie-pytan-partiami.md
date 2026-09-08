# 0031 — Duży setup generuje pytania partiami, a aplikacja sama je scala

- Status: Zaakceptowana (2026-09-08, decyzja właściciela)
- Data: 2026-09-08

## Kontekst

Pomiar z 2026-09-07 (B21, `test/duza-paczka.test.js`) pokazał, gdzie jest wąskie
gardło dużych setupów:

| | 5 pytań (1 gracz) | 40 pytań (5 stacji × 8 graczy) |
|---|---|---|
| prompt | 5 422 zn / ~1 356 tok | 5 423 zn / ~1 356 tok (**stały**) |
| odpowiedź modelu | 4 469 zn / ~1 118 tok | 33 392 zn / ~8 348 tok |
| kontener `TO-paczka/2` | 4,8 kB | 35,6 kB |

Prompt nie rośnie, pamięć nie jest problemem — rośnie **wyjście** modelu
(~210 tokenów na pytanie). Przy limicie wyjścia 4 tys. tokenów paczka 40 pytań
nie mieści się i model urywa JSON w połowie, co wraca jako E01/E02 bez
wskazania prawdziwej przyczyny. Do tej pory ekran pytań tylko ostrzegał
(`#prompt-rozmiar`).

Właściciel zgodził się na dzielenie generacji na partie. Wariant „po jednej
stacji", rozważany w B21, jest zły z drugiej strony: 40 pytań przy 1 pytaniu na
stację to 40 promptów i 40 wklejeń zamiast trzech.

## Decyzja

**1. Partie liczy się z budżetu tokenów, ale pakuje CAŁYMI stacjami.**
`planPartii()` (`app/protokol.js`) liczy `maksPytan = ⌊(prog − 90) / 210⌋` —
18 pytań przy domyślnym progu 4 000 tokenów — a potem
`stacjiWPartii = max(1, ⌊maksPytan / pytaniaNaStacje⌋)` i wypełnia partie
kolejno. Pytanie należy do dokładnie jednej stacji, więc stacja nigdy nie jest
dzielona między partie. Stacja większa niż budżet idzie sama i dostaje jawne
ostrzeżenie: odpowiedź i tak może zostać urwana.

**2. Numery stacji są GLOBALNE, także w promptcie części.** Szablon (PYT/1.0.7)
mówi wprost: *„numer stacji DOKŁADNIE taki, jaki stoi przy niej w liście STACJE
powyżej — nie numeruj stacji od nowa, nawet jeśli lista nie zaczyna się od 1"*.
To sedno całej decyzji: przy globalnych numerach identyfikatory `s<stacja>p<n>`
są unikalne w całej paczce, więc **scalanie jest zwykłym złączeniem list**.
Ponowna numeracja (stacja 4 jako „1") zderzyłaby `s1p1` z trzech części i po
scaleniu paczka byłaby nie do odratowania — stąd zakaz w szablonie, a nie
przemapowywanie odpowiedzi w aplikacji.

**3. Część waliduje się wobec JEJ zakresu stacji, całość wobec setupu.**
`walidujPaczke` przyjmuje `oczekiwane.stacjeNumery`; bez niego działa po staremu
(1..N). E04 ma dwa komunikaty — „spoza zakresu części" i „spoza setupu" — bo
właściciel musi wiedzieć, czy model wyszedł poza zlecenie, czy poza grę.
E05 (stacja bez pytania) i E06 (rozkład) też idą po zakresie części.

**4. Scalanie nie naprawia, tylko odmawia.** `scalPartie()` bierze nagłówek
z pierwszej części, pytania złącza w kolejności, `uwagi` skleja. Powtórzone `id`
między częściami to **E19** z nazwaniem części, w której identyfikator był
pierwszy raz — z usterkami funkcja zwraca `paczka: null`, bo dwie odpowiedzi na
te same pytania to nie paczka. Pusta lista części to **E21**. Złożona paczka
przechodzi jeszcze raz pełną walidację wobec setupu, zanim wystartuje gra.

**5. Nowe kody.** WE08 (`liczbaStacji` nie jest liczbą całkowitą ≥ 1) i WE09
(`pytaniaNaStacje` j.w.) — wejście planu; WE10 — partia wskazuje stacje, których
nie ma na mapie; E21 — nie ma czego scalać. E18 zostaje wycofany, E19 dostaje
drugie życie przy scalaniu.

**6. UI mówi, która to część, na obu ekranach.** `#prompt-partia` i
`#paczka-partia` pokazują `Część 2 z 3 — stacje 3–4, 8 pytań · zebrane: 1 z 2`.
Po przyjęciu części aplikacja sama wraca na ekran promptu z kolejną; gra startuje
dopiero po złożeniu całości. Mały setup nie udaje podziału — wskaźnik jest
schowany, a nagłówek brzmi „Paczka przyjęta".

## Konsekwencje

- Właściciel dużego setupu wkleja odpowiedź 2–3 razy zamiast raz, ale każda
  część mieści się w limicie wyjścia modelu. Bez tego 40 pytań było
  nieosiągalne w ogóle.
- Stan partii (`STAN.partie`) żyje w pamięci modułu i ginie przy odświeżeniu
  strony — tak samo jak `STAN.paczka` przed startem gry. Zebrane części nie są
  zapisywane do `localStorage`: to surowy plaintext, którego ADR 0007 pkt 4 nie
  pozwala trzymać w DOM ani w zapisie.
- Zmiana liczby stacji albo pytań na stację kasuje zebrane części
  (`planPartiiBiezacej` porównuje sygnaturę) — starych części nie da się
  uczciwie doczepić do nowego planu.
- Szablon urósł o dwie linie (`{LICZBA_STACJI}`, `{ZAKRES}`) i sekcję §2.2;
  `SZABLON_WERSJA` = `PYT/1.0.7`. Testy czytają stałą dynamicznie, więc
  podbicie nic nie psuje; literała `PYT/1.0.6` w `test/helpers/most.js` to
  fikstura schematu, nie wersja szablonu.
