# 0026 — Tożsamość jest bramą ekranu 1: imię + PIN, jedno wołanie mostu

- Status: Zaakceptowana (2026-09-07, decyzja właściciela)
- Data: 2026-09-07

## Kontekst

Profil PIN (ADR 0021) był opcjonalnym dodatkiem: przycisk „👤 To ja — pobierz
imię z Drive" odsłaniał formularz, a gracz mógł go zignorować i grać jako
„Gracz 1". Skutek: historia gier i rankingi na wspólnym Drive zostawały puste,
bo nikt nie musiał się przedstawić.

Decyzja właściciela (2026-09-07): imię porównujemy z bazą na Drive; wolne imię
gracz deklaruje razem z PIN-em (od tej chwili ma historię i rankingi), a imię
zajęte wymaga poprawnego PIN-u — **inaczej nie ma przejścia na ekran 2**.
Wymaganie dodatkowe: „UX-friendly, minimalna liczba kliknięć".

## Decyzja

1. **Blok „👤 Kim jesteś?" jest częścią ekranu 1** (zawsze widoczny): pole
   imienia i pole PIN obok siebie, akapit stanu `#profil-stan`, lista błędów.
   Przełącznik `#przycisk-profil`, kontener `#form-profil`, przycisk
   „＋ Zapisz jako nowy" **i przycisk „✓ Sprawdź i wpisz"** zniknęły — osobny
   krok sprawdzania nie jest potrzebny (brama jest w „Dalej"), a setup ma się
   mieścić na 360 px bez przewijania (WORKFLOW §4.2).
2. **Brama działa w przycisku „Dalej"** (`bramkaTozsamosci` w `app/app.js`):
   konfiguracja poprawna → sprawdzenie tożsamości → dopiero potem zapis
   konfiguracji i przejście. Odmowa zostawia gracza na ekranie 1 z komunikatem
   i ustawia kursor w polu, którego dotyczy.
3. **Jedno wołanie mostu**: `akcja: 'profil-ustaw'` robi wszystko, czego trzeba
   — wolne imię zakłada profil (`nowy: true`), zajęte z poprawnym PIN-em
   potwierdza tożsamość (`nowy: false`), zajęte ze złym PIN-em odmawia `R20`.
   `profil-sprawdz` zostaje w moście (kompatybilność), ale UI go nie woła.
4. **Mniej klikania**: imię zweryfikowane wcześniej NA TYM TELEFONIE
   (`okolica:profil`, schemat `profil-lokalny/1`) przechodzi bez PIN-u i bez
   sieci; zmiana imienia w polu wyłącza obejście. PIN nigdy nie jest zapisywany
   lokalnie (ADR 0013: na telefonie zostaje minimum), a po sukcesie jest
   czyszczony z pola.
5. **Awaria mostu nie blokuje gry** (ADR 0016 pkt 5, ADR 0020): gdy Drive nie
   odpowiada, gracz przechodzi dalej, a `#profil-stan` mówi wprost, że gra jest
   lokalna i historia z niej nie zostanie zapisana. Taki profil dostaje
   `zweryfikowany: false`, więc przy następnej grze sprawdzimy go jeszcze raz.
6. **Imię z profilu jest pierwszym graczem**: `wpiszImieZProfilu` wpisuje je
   w `imiona[0]`, więc hot-seat i rankingi mówią o tej samej osobie.

## Konsekwencje

- Bez imienia nie ma gry: rankingi i historia na Drive zapełniają się same,
  a „Gracz 1" zostaje tylko jako awaria (most niedostępny).
- Zajęcie imienia jest chronione PIN-em, ale PIN jest prosty (4–8 cyfr,
  ADR 0021) i leży jawnym tekstem na Drive — to zabezpieczenie przed
  pomyłką i podszywaniem w grze towarzyskiej, nie kryptografia.
- Ekran 1 rośnie o dwa pola i akapit; na 360 px setup nadal ma się mieścić
  bez przewijania (WORKFLOW §4.2) — akapit stanu jest krótki.
- Testy: sześć scenariuszy bramy (zajęte + poprawny PIN, wolne imię, zajęte
  + zły PIN, brak imienia, brak PIN-u, most nie odpowiada, znane z telefonu),
  kontrakt: „Dalej" woła bramę PRZED `pokazEkran('pozycja')`, a UI ma pola
  `#pole-tozsamosc`/`#profil-stan` (i NIE ma osobnego przycisku sprawdzania).
- Most Drive nie wymaga zmian: `ustawProfil` już realizuje punkty 3 i 5.
