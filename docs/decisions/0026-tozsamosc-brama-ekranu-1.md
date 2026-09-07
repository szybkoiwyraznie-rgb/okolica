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

## Aneks (2026-09-07): lista graczy JEST tożsamością

Właściciel po partii 4: dwa bloki na ekranie 1 — „Gracze" (liczba) i „👤 Kim
jesteś?" (imię + PIN) — pytały o to samo i nie dało się z nich wyczytać, co
wpisać. Decyzje właściciela z 2026-09-07 (trzy odpowiedzi):

1. **PIN sprawdzany od razu przy „➕ Dodaj gracza"**, a pole „Liczba graczy"
   znika — „tyle ilu się doda, tylu będzie".
2. **Lista graczy jest zapamiętywana na telefonie i nie pyta o PIN ponownie.**
3. **Wynik gry hot-seat jedzie na Drive per gracz** (nowa akcja mostu).

Co się zmieniło względem punktów 1–6 powyżej:

- **Jeden blok „👤 Kto gra?"** zamiast trzech: imię + PIN + „➕ Dodaj gracza",
  poniżej lista dodanych graczy z „✕ Usuń" i przyciski zapamiętanych. Pola
  `#setup-gracze` i `#lista-imion` zniknęły z `index.html`;
  `konfig.liczbaGraczy` jest pochodna (`max(1, imiona.length)`), a
  `pytaniaNaStacje` idzie za liczbą graczy (`min(gracze, 8)`, ADR 0027 część A).
- **Bramą jest długość listy, nie jedno imię**: `bramkaTozsamosci()` przepuszcza
  z co najmniej jednym graczem i mówi wprost, kto nie ma potwierdzenia z Drive.
  Pusta lista to usterka K08 z komunikatem, gdzie dodać gracza.
- **`okolica:profil` → `okolica:gracze`** (schemat `gracze-lokalni/1`:
  `{ pseudonim, zweryfikowany }`, maks. 8). PIN nadal nigdy nie jest zapisywany
  lokalnie. Punkt 4 powyżej działa tak samo, ale dla całej listy: przy starcie
  aplikacji potwierdzeni gracze wracają na listę bez PIN-u i bez sieci,
  niepotwierdzeni czekają jako przyciski i wymagają PIN-u.
- **Usunięcie jest trwałe**: po starcie lista się już sama nie odbudowuje
  (`przywrocGraczy({ zListy: true })` tylko przy uruchomieniu) — inaczej
  usunięty gracz wracał w tej samej chwili, w której został zdjęty.
- **Wynik gry na tym telefonie jedzie na Drive** akcją `gra-hotseat`
  (PROTOKOL §9.5): punkty liczy most, premia 0, zgoda `#hotseat-zgoda`,
  kolejka offline. Punkt 6 („imię z profilu jest pierwszym graczem") jest
  zbędny — lista graczy i tożsamość to teraz jedno.

Konsekwencje aneksu: most wymaga **jednego wklejenia** nowej treści skryptu
(akcja `gra-hotseat` + premia hot-seat = 0) — patrz
`docs/setup/most-drive-instrukcja.md`. Testy: dziesięć scenariuszy listy
(`test/wieloosobowa-ui.test.js`), trzy wysyłki hot-seat
(`test/aplikacja.test.js`), trzy po stronie mostu na atrapie Drive
(`test/most-gra.test.js`), kontrakt pinuje brak `#setup-gracze`.

### Dopisek (2026-09-07, po obejrzeniu partii 5): bez pytania o zgodę przy każdej grze

Checkbox „Zapisz wynik gry na wspólnym Drive" (`#hotseat-zgoda`) zniknął
z ekranu 1. Właściciel: „Domyślnie zapisujemy na Drive i nie musimy o to co
chwilę pytać w prywatnej aplikacji — info jest w sekcji prywatność".

- Zapis wyniku jest **domyślny**; warunkiem technicznym zostaje choć jeden
  gracz potwierdzony profilem (bez profilu nie ma gdzie zapisać punktów —
  wtedy `#wynik-drive` mówi to wprost).
- Sekcja „Dane i prywatność" dostała kartę **„Wspólny Drive: historia
  i rankingi"**: co jedzie (pseudonimy, punkty, poprawne/błędne, miejscowość,
  kategoria wiekowa, geohash5 okolicy), co zostaje (współrzędne, trasa,
  pytania, paczka), oraz że profil z PIN-em leży na Drive (ADR 0021).
