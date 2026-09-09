# 0033 — Koniec odwracania liter: zostaje kod poprawnej odpowiedzi

- Status: Zaakceptowana (decyzja właściciela 2026-09-09, zgłoszenie B2)
- Data: 2026-09-09
- Dotyczy: PROTOKOL §2, §2.2, §3.4, §7, ADR 0007 (maskowanie paczki),
  ADR 0032 (wariant bez fact-check), `app/protokol.js`, ekran 4 i 5

## Kontekst

Od Partii 2 model dostawał polecenie zapisywania pól tekstowych `tresc`,
`odpowiedzi`, `wyjasnienie`, `uwagi` i `zrodla[].tytul` **odwróconych znakami**
(`PYT/1.0-rev1`, potem `-rev2` i `-rev3`). Celem była bariera przypadkowego
wglądu: gracz, któremu mignie JSON na ekranie organizatora albo w schowku, nie
przeczyta odpowiedzi wprost (ADR 0007 — maskowanie, nie szyfrowanie).

Praktyka to zweryfikowała. Właściciel:

> Niestety odwracanie liter jest za trudne dla modeli AI i przekręcają przez to
> wyrazy. Po głębszym namyśle podjąłem decyzję — zrezygnujmy z tego odwracania.
> Zostawmy TYLKO kodowanie poprawnej odpowiedzi.

Odwracanie napisu znak po znaku to dla modelu językowego zadanie kosztowne
i zawodne — pracuje na tokenach, nie na literach. Szablon próbował to ratować
regułą samokontroli („odczytaj każde odwrócone pole od końca i sprawdź”), ale
błędy i tak przechodziły do paczek, psując treść pytań. Koszt (przekręcone
wyrazy w gotowej grze) przewyższył zysk (utrudnienie zerknięcia w JSON).

## Decyzja

1. **Pola tekstowe zapisywane normalnie.** Reguła 8 obu szablonów mówi wprost:
   „zapisz NORMALNIE, w naturalnej kolejności liter — niczego nie odwracaj ani
   nie szyfruj”. Reguła samokontroli odwrócenia znika razem z nią.
2. **Kod pozycyjny `poprawna` ZOSTAJE** bez zmian: indeks + numer stacji +
   numer pytania + 17. To on realizuje cel z ADR 0007 — zerknięcie w JSON nie
   zdradza, która odpowiedź jest dobra, a model dodaje cztery małe liczby
   bezbłędnie.
3. **Nowe markery: `PYT/1.0-rev4` (z fact-check) i `PYT/1.0-rev5` (bez).**
   Podział na dwa markery utrzymuje profil źródeł z ADR 0032: E09 obowiązuje
   w rev4, nie obowiązuje w rev5. Domyślny pozostaje wariant bez fact-check.
4. **Zgodność wstecz jest obowiązkowa.** Walidator przyjmuje `PYT/1.0`, `-rev1`,
   `-rev2`, `-rev3`, `-rev4`, `-rev5`, a dekoder odwraca tekst **tylko** dla
   rev1/rev2/rev3. Paczki wygenerowane wcześniej leżą na Drive i w pamięci
   telefonów — muszą dać się otworzyć.
5. **Wersje szablonów podbite:** `PYT/1.0.7` (§2) i `PYT/1.0-nofc.2` (§2.2).
   Sam schemat PYT **nie** zmienia wersji: kształt pól jest ten sam, zmienia się
   zapis (ta sama zasada co przy rev1 i rev2 — PROTOKOL §7).

## Odrzucone alternatywy

- **Zostawić odwracanie i wzmocnić samokontrolę** — próbowaliśmy tego w rev2
  (reguła „odczytaj od końca i sprawdź”); błędy przechodziły dalej. Problem jest
  w naturze tokenizacji, nie w sile sformułowania.
- **Inne lekkie maskowanie tekstu (ROT13, base64 pól)** — przenosi ten sam
  problem gdzie indziej: model równie chętnie pomyli się w ROT13, a base64
  całych pól czyni prompt nieczytelnym przy diagnozie i puchnie objętościowo.
- **Maskowanie po stronie aplikacji zamiast modelu** — treść i tak przechodzi
  przez schowek gracza w drodze z czatu, więc maskowanie dopiero w aplikacji
  niczego nie chroni na najbardziej odsłoniętym odcinku.
- **Rezygnacja także z kodu `poprawna`** — właściciel wprost prosił o jego
  zachowanie; to jedyny element maskowania o realnej wartości i zerowym koszcie
  jakościowym.

## Konsekwencje

- Pytania przestają zawierać przekręcone wyrazy — to była realna wada widoczna
  dla graczy.
- Kontener `TO-paczka/2` (ADR 0007) i tak obfuskuje całą paczkę w spoczynku,
  więc odwracanie było drugą warstwą tej samej ochrony; zostaje kod poprawnej.
- Ekran 5 pokazuje wariant przy przyjęciu („Paczka przyjęta (rev5, bez
  fact-check)”), a dla starych paczek nadal „odwrócona, rev2 — odkodowana”.
- Brak migratora: nic nie trzeba przeliczać, bo stare markery są dalej czytane.
