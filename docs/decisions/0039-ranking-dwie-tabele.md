# 0039 — Ranking wrócił w nowej formie: dwie tabele, suma punktów i proporcja

- Status: Zaakceptowana
- Data: 2026-09-12
- Podstawa: zgłoszenie właściciela („Mam nowy pomysł na podstronę Ranking”)
  i trzy jego decyzje z tego dnia: źródło = wspólny Drive, liczą się tylko
  gracze z potwierdzonym profilem, Mistrzowie Zagadek od 10 zadanych pytań.

## Kontekst

Rankingi zostały 2026-09-11 usunięte w całości — z aplikacji i z mostu (aneks
`0026`/`0019`, PROTOKOL §9.3). Powód nie był techniczny: ekran urósł do
zakładek (ogólny / wiek / tematy / lokalizacja), chipów z kategoriami, listy
„Moje gry”, agregacji po pseudonimach robionej NA TELEFONIE i statusu
„N wyników graczy”. W tym samym czasie wyniki gier zaczęły trafiać na wspólny
Drive (hot-seat: PROTOKOL §9.6, gry wieloosobowe: §9.1) — więc dane, z których
ranking mógłby żyć, były już zbierane; brakowało tylko wąskiego widoku na nie.

Właściciel wraca do rankingu, ale z twardym ograniczeniem zakresu: **dwie
tabele i nic więcej**. To jest dokładne przeciwieństwo tego, co usunęliśmy —
i właśnie dlatego ta decyzja jest zapisana: kolejny pomysł na „jeszcze jedną
zakładkę” ma zderzyć się z tym ADR-em, a nie z pamięcią czatu.

## Decyzja

1. **Ranking to warstwa (layer)**, otwierana ikonką pucharu
   (`#przycisk-ranking`) w belce, zamykana drugim kliknięciem, ✕ albo
   Escape — ten sam wzorzec co ⚙ START GRY i Informacje (zgłoszenie F3).
   Warstwa wygasza pozostałe panele (`body.ranking-otwarte`), tak jak
   Informacje.
2. **Dokładnie dwie tabele i nic więcej**:
   - **Ranking Punktowy Graczy** — gracze wg SUMY zdobytych punktów, wszystkie
     rodzaje gier naraz, maksymalnie 5 pozycji;
   - **Mistrzowie Zagadek** — gracze wg proporcji odpowiedzi POPRAWNYCH do
     ZADANYCH pytań, maksymalnie 5 pozycji.
   Nie wracają: zakładki, kategorie, filtr wieku/tematu/miejsca, lista
   „Moje gry”, eksport rankingu, osobne rankingi hot-seat i multi.
3. **Źródło to wspólny Drive** (ADR 0020) — nowa akcja mostu
   `GET ?akcja=ranking`. Zmiana w `.gs` wymaga wdrożenia nowej wersji
   („Wdróż → Nowa wersja”) — do tego czasu warstwa powie wprost, że nie
   potrafi odczytać odpowiedzi.
4. **Most agreguje, telefon rysuje.** `rankingi()` w skrypcie zbiera liczniki
   z katalogu gier zakończonych i oddaje `RO-ranking/2`:
   `{ schemat, gracze: [{ pseudonim, punkty, poprawne, pytania }] }`.
   Powód jest potrójny: odpowiedź jest mała i niezależna od liczby gier, na
   telefon nie jadą per-gra dane innych osób (daty, miejsca, geohashy — ADR
   0013/0019 pkt 3), a reguła „kto wchodzi do rankingu” żyje w JEDNYM miejscu.
5. **Liczą się tylko gracze z potwierdzonym profilem** (plik
   `profil-<id>.json`, `RO-profil/1`, ADR 0021) — gość dodany bez potwierdzenia
   z Drive gra normalnie, ale do tabel nie wchodzi. Filtr siedzi w moście;
   pseudonim z profilu jest pisownią wyświetlaną („ALA” i „ala” to jeden wiersz
   „Ala”). Świadomy koszt: gracz bez profilu nie zobaczy się w rankingu.
6. **Reguły liczenia** (te same po obu stronach, bo liczy je tylko most):
   - rezygnacja bez ani jednej odpowiedzi nie wchodzi do sum (nie ma wyniku);
   - punkty sumują się z tego, co gra przyznała — łącznie z premią za kolejność
     ukończenia w grach wieloosobowych (ADR 0027 część B; hot-seat premii
     nie ma, więc jego punkty to same odpowiedzi);
   - „zadane pytania” = odpowiedzi poprawne + błędne;
   - próg 10 zadanych pytań w „Mistrzach Zagadek” liczy się z SUMY gier gracza.
7. **Sortowanie ma być przewidywalne**: punkty (albo proporcja) malejąco, przy
   remisie pseudonim rosnąco; w „Mistrzach” przy równej proporcji wyżej idzie
   większa próba (20/20 przed 10/10). Ten sam gracz nie może skakać między
   odświeżeniami warstwy.
8. **Nowy moduł czysty `app/ranking.js`** trzyma reguły: limit 5 pozycji, próg
   10, sortowanie, walidację odpowiedzi, format „18/24 · 75%”. `app.js` tylko
   wstawia wiersze do tabel — tak samo jak przy pozostałych modułach czystych.
9. **Schemat `RO-ranking/1` nie wraca.** To on niósł surowe wiersze gier
   (pseudonim, punkty, data, tryb, miejsce, geohash5, wiek, tematy) i ciągnął
   za sobą całą tamtą rozbudowę. Ranking czyta sumy, nie gry.

## Konsekwencje

- W moście doszła funkcja `rankingi()` i trasa `?akcja=ranking`; **wdrożenie
  `.gs` jest warunkiem działania rankingu** i zostało zgłoszone właścicielowi.
- Profil (ADR 0021) zyskał drugie, poza historią, znaczenie: jest biletem
  wstępu do tabel. Wysyłka wyniku (ADR 0026 aneks) zostaje bez zmian.
- Uszkodzony plik gry albo profilu nie psuje odpowiedzi — wypada po cichu
  (test w `test/most-ranking.test.js` wykonuje tekst `.gs`, LESSONS L33).
- Tam, gdzie kontrakt pinował USUNIĘCIE rankingu (LESSONS L31: „usunięty
  element ma zostać usunięty”), pin został przepisany na NOWĄ formę: test
  „kontrakt ADR 0039” wymaga dwóch tabel i jednocześnie zakazuje powrotu starej
  formy (`ranking-zakladki`, `ranking-kategorie`, `ranking-moje-gry`).
- Ekran wyniku z ADR 0038 nadal pokazuje tabelę BIEŻĄCEJ gry; ranking to
  osobna warstwa i nie miesza się z podsumowaniem.

## Powiązania

0019 (+aneks 2026-09-11b — rankingi usunięte; ten ADR przywraca je w nowej,
wąskiej formie), 0021 (profile i PIN), 0020 (adres mostu w kodzie),
0026 aneks (`gra-hotseat` zapisuje grę tak samo jak multi → jedno źródło dla
obu rodzajów gier), 0013 i 0019 pkt 3 (prywatność: brak per-gra danych na
telefonie), 0027 część B (premia za kolejność wchodzi do sumy punktów),
0038 (minimalny ekran wyniku), LESSONS L31 i L33, M12 (historia gier na Drive).
