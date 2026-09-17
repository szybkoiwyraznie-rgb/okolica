# 0055 — Dwa poziomy pytań (dziecko/dorosły): własność gracza (hot-seat) i gry (multi)

- Status: Zaakceptowana (2026-09-17d, uwaga B z testów terenowych + decyzja
  o multi, właściciel)
- Data: 2026-09-17

## Kontekst

Uwaga B z testu terenowego: „trudność" była niejednoznaczna — wiek liczbowy
(7/10/12/15) i globalna „kategoria wiekowa" całej paczki nie oddawały mieszanej
grupy (dorośli + dziecko na jednym telefonie), a modele nie trzymały per
stację jednego zestawienia. Właściciel: dokładnie dwa poziomy — **dziecko**
(8–10 lat; łatwe, szkoła podstawowa; **bez dat, cyfr, liczb, nazwisk i trudnych
faktów**) i **dorosły** (mogą być trudne: logika, fakty, daty, nazwiska); wiek
liczbowy i 7/12 znikają. Poziom nie jest globalnym ustawieniem — to własność
**gracza** (przy jego imieniu w setupie), zapamiętana w profilu z
auto-selekcją. Prompt ma WYRAŹNIE, z akcentem, podawać przy KAŻDEJ stacji
zestawienie pytań poziomów (modele to zapominają); pytania idą do właściwych
graczy bez mieszania; dopasowanie paczek bierze zestawienie dzieci/dorośli +
liczbę stacji.

Druga decyzja tego dnia (właściciel, wprost): „w multiplayer trasa i wyścig w
ogóle bym nie różnicował wieku pytań — jest jeden zestaw pytań wynikający z
wyboru hosta i wszyscy je mają takie same. W hotseat zgodnie z wcześniej
opisaną koncepcją.”

## Decyzja

1. **Dokładnie dwa poziomy** nowego setupu: `dzieci` (łatwe, bez
   dat/cyfr/nazwisk/trudnych faktów) i `dorosli` (mogą być trudne). Klucze
   liczbowe (`7`, `10`, `12`, `15`) zostają tylko do CZYTANIA starych paczek i
   konfiguracji; w setupie nie ma pola „wiek”.
2. **Poziom to własność gracza, nie paczki i nie globalnego ustawienia.**
   Hot-seat: `konfig.gracze[].poziom` (domyślnie `dorosli`); profil gracza
   (lokalny + Drive, `profil-ustaw` niesie `poziom`) go pamięta i
   auto-wybiera przy znanym graczu.
3. **Paczka niesie per-poziomowe zestawienie, nie `wiek`:** globalne `wiek`
   znika; każde pytanie ma `poziom` (`dzieci`/`dorosli`; aliasy
   `dziecko`/`child`/`children` normowane); meta niesie `poziomyPytan`
   (`{dzieci, dorosli}` = ile pytań danego poziomu przy KAŻDEJ stacji).
   Protokół **PYT/1.2** (`PYT/1.2.1` / `PYT/1.2-nofc.1`); walidator, gdy setup
   niesie `poziomyPytan`, pilnuje `E21` (pytanie bez `poziomu` albo z poziomem
   spoza kanonu) i `E22` (zestawienie pytań poziomów na stacji nie zgadza się
   z oczekiwanym).
4. **Multi: JEDEN poziom hosta, jedno wspólne pytanie na stację.** Gracze
   dołączają później, więc host wybiera poziom w karcie multi
   (`STAN.multiPoziom`, lokalnie `okolica:multi:poziom`; gość dziedziczy
   wybór hosta). Paczka multi: `pytaniaNaStacje = 1`, wszystkie pytania tego
   poziomu, **wszyscy odpowiadają na te SAME pytania** — pytań „dla kogoś
   innego” nie ma. Poziom należy do GRY, nie do gracza (most nie niesie
   `poziomu` u graczy multi).
5. **Hot-seat: po jednym pytaniu poziomu gracza przy każdej stacji, bez
   mieszania:** k-TE pytanie poziomu X → k-ty gracz poziomu X w kolejności
   listy (zawijanie). Pytanie dziecka nigdy nie idzie do dorosłego i odwrotnie.
6. **Prompt: sekcja `GRACZE — POZIOMY PYTAŃ`** (zamiast „kategorii wiekowej”)
   z ZASADĄ TWARDĄ powtórzoną wprost: przy KAŻDEJ stacji DOKŁADNIE to
   zestawienie (np. 1 dorosły + 2 dzieci → 1× DZIECKO + 2× DOROŚLI), lista
   graczy z poziomami (kolejność listy = kolejność odpowiadania) i wymagania
   poziomów (`opisTrudnosci`). W multi wariant: „gracze dołączą później —
   JEDEN poziom organizatora, wszystkie pytania wyłącznie tego poziomu”.
7. **Dopasowanie paczek:** `poziomyPytan` DOKŁADNIE + liczba stacji (dokładnie)
   + promień + suma pytań (≥) + tematy (⊆). Stare paczki z `wiek` nie pasują
   do nowych setupów i odwrotnie (świadoma rezygnacja z krzyżowego
   dopasowania); slug pliku na Drive `poziomy-dzieci{N}-dorosli{N}`.
8. **Bez migratora** (faza testów terenowych, brak paczek starych schematów na
   dysku właściciela): paczki BEZ `poziomu` są dalej grywalne — gracz bierze
   pierwsze pytanie stacji (dawni gracze i tak dzielili jedno wspólne
   pytanie); `E21`/`E22` włączają się tylko przy `poziomyPytan`.
   `walidujGreSurowa`/`konfiguracjaOk` akceptują `poziomyPytan` LUB `wiek`
   (addytywność zapisów sprzed zmiany).

## Konsekwencje

- Schemat PYT/1.1 → PYT/1.2: `wiek` w meta starych paczek zostaje tylko do
  odczytu; krzyżowego dopasowania nie ma.
- Piny: protokol (PYT/1.2, `E21`/`E22`, aliasy), kontrakt (lustro mostu,
  slug), zestawy(-ui) (dopasowanie per-poziomowe), rozgrywka (przypisanie per
  poziom), aplikacja + wieloosobowa-ui (UI poziomów).
- Most `docs/setup/apps-script-repo-paczek.gs`: `poziomyPytan` w meta, `poziom`
  w profilu, slug per-poziomowy — **wymaga wdrożenia właściciela**.
- Ryzyko, że model mimo ZASADY TWARDEJ złamie zestawienie — bramką jest
  walidator (paczka odrzucona, nie gra).

## Powiązania

0008 (fakt-check i źródła), 0022 (kolejka graczy), 0027 (pytania po równo),
0050 (paczka jawna), 0056 (stała kolejność odpowiadania, ten sam dzień).
