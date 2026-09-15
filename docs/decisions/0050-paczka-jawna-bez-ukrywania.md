# 0050 — Paczka jawna: koniec ukrywania pytań i numer odpowiedzi 1–4

- Status: Zaakceptowana (decyzja właściciela 2026-09-15)
- Data: 2026-09-15
- Dotyczy: PROTOKOL §2, §2.2, §3, §7, ADR 0007 (wycofany), ADR 0032 (aneks), ADR 0033 (wycofany), ADR 0049 (wycofany), `app/protokol.js`, `app/zestawy.js`, `app/trwalosc.js`, `docs/setup/apps-script-repo-paczek.gs`
- Wpływa na: LESSONS L74, L75

## Kontekst

Dwie uwagi właściciela z gry terenowej (2026-09-15), obie o tym samym:
protokół wymuszał na modelu i na aplikacji coś, czego nie wymaga gra.

**Pierwsza — ocena odpowiedzi.** Paczka miała `"poprawna": 3`, właściciel
kliknął trzecią odpowiedź, a aplikacja pokazała „Źle (0 pkt). Poprawna
odpowiedź: D. 1969". Model i człowiek liczą odpowiedzi od 1, aplikacja
czytała `poprawna` jako indeks od 0. Właściciel: „normalnie 1-4, a nie 0...3.
Przeliczanie to zaproszenie do błędu AI".

**Druga — ukrywanie paczek.** Paczka po walidacji była obfuskawana (XOR ze
strumieniem z stałego ziarna + base64url, kontener `TO-paczka/2`, ADR 0007)
i w tej postaci leżała w `localStorage`, w zapisie gry i na Drive. Właściciel:

> To jest gra dla mnie i mojej rodziny, więc żadne zabezpieczenia nie są
> potrzebne. (…) ukrywanie w telefonie jest wręcz szkodliwe.

Kluczowy argument: jedyny moment, w którym tekst pytań jest naprawdę widoczny,
to wklejenie odpowiedzi modelu do aplikacji — a tego żadne kodowanie nie
zasłania, bo treść i tak stoi w oknie czatu. Obfuskacja chroniła więc nie
przed graczem, a przed właścicielem (utrudniała diagnozę), kosztując przy tym
osobny moduł, duplikat dekodera w moście Drive i tożsamość paczki liczoną
z kontenera zamiast z treści.

Właściciel upoważnił do zmiany całego protokołu: „Możesz zmienić spokojnie
cały protokół, bo na dysku nie ma żadnych paczek".

## Decyzja

1. **Koniec ukrywania.** Paczka jedzie jawnym JSON-em przez całą drogę: pamięć
   telefonu, `localStorage`, snapshot gry, plik na Drive. `app/kodowanie.js`
   i kontener `TO-paczka/2` są usunięte (ADR 0007 → archiwum).
2. **Tożsamość paczki bez kontenera.** Klucz wpisu lokalnego i dopasowanie
   pliku na Drive liczy `skrotPaczki()` z `app/zestawy.js` — FNV-1a 32
   z bajtów `JSON.stringify(paczka)`. Odcisk wykrywa podmianę treści; nie jest
   funkcją kryptograficzną i nie jest zapisywany w samej paczce.
3. **`poprawna` to numer `1..4`** (1 = pierwsza odpowiedź na liście), tak jak
   liczy człowiek i model. Aplikacja wykonuje JEDNO przeliczenie na granicy
   UI: `wybrana + 1 === pytanie.poprawna`, gdzie `wybrana` to indeks przycisku
   `0..3`. ADR 0049 (indeks `0..3`) → archiwum.
4. **Jedna postać paczki, bez markera.** Model nie pisze pola `protokol` ani
   nie koduje niczego „na zapas": żadnego odwracania tekstu (ADR 0033 →
   archiwum), żadnego kodu pozycyjnego, żadnych wariantów `revN`. Pole
   `protokol`, jeśli się pojawi, jest ignorowane.
5. **Profil źródeł zna aplikacja, nie paczka.** O tym, czy pytania powstały
   z fact-checkiem, wie ekran promptu (ptaszek) i wie o tym aplikacja: przy
   przyjęciu stempluje `paczka.factcheck`, a zestawy z repozytorium niosą to
   samo w `meta.factcheck`. Walidacja (E09) czyta stempel — brak pola znaczy
   „z fact-checkiem" (ADR 0032 obowiązuje, tylko bez markera w JSON-ie).
6. **Jeden zestaw plików.** Kształt jawny podbijają schematy: `TO-zestaw/2`,
   `TO-zestaw-lokalny/2`, `stan-gry/2`; kody T05/Z04/R08 mówią o braku pytań,
   nie o „uszkodzonym kontenerze".
7. **Bez migratora.** Na dysku właściciela nie ma ANI JEDNEJ paczki w starym
   formacie (gra jest w testach terenowych), więc nie ma czego migrować —
   wyjątek od reguły z PROTOKOL §7 pkt 2, na wyraźną zgodę właściciela.

## Konsekwencje

- Mniej pracy dla modelu (bez markera i bez liczenia kodu) i mniej okazji do
  błędu po stronie aplikacji (bez przeliczania numeru odpowiedzi).
- Właściciel widzi pytania w pliku na Drive i w zapisie gry — może zajrzeć bez
  narzędzi. To celowe.
- Zakaz z ADR 0013 ZOSTAJE: w paczce nie ma danych osobowych ani niczego, co
  nie może zostać upublicznione — plik na Drive jest czytelny dla każdego, kto
  ma do niego dostęp. Współrzędne graczy nadal nie jadą na Drive.
- Most Drive trzeba WGRAC ponownie (nowa wersja `apps-script-repo-paczek.gs`:
  waliduje jawną paczkę i liczy ten sam `skrotPaczki`).
- Zmiana jest nieodwracalna w praktyce: powrót do ukrywania wymagałby nowego
  ADR-u i migratora dla paczek, które już leżą jawnie.
