/**
 * app.js — bootstrap: ekrany, stan sesji, spinanie modułów.
 *
 * Zakres: setup → pozycja → stacje (tryb uproszczony) → prompt → wklejenie
 * i walidacja paczki (M0), model rozgrywki i warstwa pozycji jako czyste
 * funkcje (M1) oraz mapa SVG z kafelkami, gestami i warstwami własnymi (M2).
 * Overpass (M4), ekran gry (M6) i publikacja (M8) dochodzą w kolejnych
 * kamieniach — patrz `docs/ROADMAP.md`.
 *
 * Warstwa DOM jest celowo cienka (ARCHITECTURE §podział): logika mieszka
 * w `konfig.js`, `geo.js`, `protokol.js`, `stacje.js`, `pozycja.js` i jest
 * testowana w Node. Geolokalizacja idzie wyłącznie przez osłonę
 * `watchPozycja()` z `pozycja.js` — jeden watcher na rozgrywkę, reguły
 * przyjęcia fixu i komunikaty błędów tam, gdzie da się je przetestować
 * (ADR 0004 pkt 1, 7; ADR 0034 pkt 2 — oceniamy współrzędne, nie `accuracy`).
 */

import { CZASY_GRY, DOMYSLNE, KANON_SETUPU, PODKLADY, TEMATY_SETUP, TRYBY, WIEK_SETUP, kanonicznyTemat, konfiguracjaNowegoSetupu, domyslnaKonfiguracja, domyslnyKodGry, dopelnijKonfiguracjeDoKanou, kanonSprzedBiezacego, liczbaPytan, oczyscKonfiguracje, przeliczenieCzasu, pytaniaNaStacjeDla, walidujSetup, ziarnoRozgrywki } from './konfig.js?v=m12-154';
import { PROMIEN_SUFITU_ZOOMU_M, dopasujZoomDoPromienia, formatujWspolrzedne, geohash, odlegloscM } from './geo.js?v=m12-154';
import {
  normalizujTematyPaczki,
  parsujOdpowiedzModela,
  walidujPaczke,
  zbudujPrompt,
} from './protokol.js?v=m12-154';
// ADR 0050: ukrytego kontenera nie ma — paczka jedzie jawnym JSON-em.
import { ZRODLA_STACJI, dystanseOdcinkowM, stacjeProste, uporzadkujGre, wybierzStacje, zlozKarteUsterekStacji } from './stacje.js?v=m12-154';
import { GRANICE, OPCJE_WATCH, PROFILE_GPS, ZEGAR_MILCZENIA_MS, ZRODLA_FIXA, bladGeolokalizacji, czyMilczy, dodajFix, komunikatMilczenia, ocenFix, fixZPozycji, sekwencjaSymulowana, stanDojscia, trasaProsta, watchPozycja } from './pozycja.js?v=m12-154';
import { PRZERWA_BEZCZYNNOSCI_MS, SPRAWDZANIE_BEZCZYNNOSCI_MS, czyPrzerwaBezczynnosci, czyTrzymacEkran } from './aktywnosc.js?v=m12-154';
import { OPOZNIENIE_OBROTU_MS, czyObrotEkranu, kierunekEkranu } from './orientacja.js?v=m12-154';
import { FAZY, TRYBY_DOJSCIA, graczPytania, ktoOdpowiada, nowaRozgrywka, podglad, podsumowanie, pytaniaStacji, skierujDoStacji, stacjeDoWyboru, startOdcinka, zaliczoneStacjeIds, zapiszOdpowiedz, zakonczOdcinek } from './rozgrywka.js?v=m12-154';
import { KLUCZ_AKTYWNEJ, kluczStanu, oczyscKodGry, serializujStan, walidujStanSurowy, zbierajStan } from './trwalosc.js?v=m12-154';
import {
  KLUCZ_REJESTRU, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY,
  czyWOkolicy, dolozWpisRejestru, dopasujMetaIndeksu, kluczZestawu, nowyRejestr,
  rozmiarBajty, skrotPaczki, walidujIndeksSurowy, walidujRejestrSurowy, walidujZestawLokalnySurowy,
  walidujZestawPublicznySurowy, zbierzMetaZestawu, zbudujPlikZestawu,
  urlPaczkiZRepo, faktyczneTematyPytan,
} from './zestawy.js?v=m12-154';
import { KLUCZ_SYGNALOW, czySygnalyWlaczone, planSygnalu } from './sygnaly.js?v=m12-154';
import {
  KODY_SIECI,
  POLITYKA,
  SCHEMAT_SIECI,
  budujGraf,
  budujZapytanieOverpass,
  czyPrzelaczycInstancje,
  czyWpisPokrywa,
  kolejnoscInstancji,
  kandydaciNaStacje,
  kluczCacheSieci,
  nazwaMiejsca,
  parsujOdpowiedz,
  przycijCacheSieci,
  timeoutInstancji,
  upraszczajDaneDoCache,
  wczytajDaneZCache,
  wybierzWpisSieci,
  zlozWpisSieci,
} from './sieci.js?v=m12-154';
import { KLUCZ_URL_KAFELKOW, utworzMape, ustawSzablonKafelkow } from './mapa.js?v=m12-154';
import { LIMIT_KOLEJKI_ZDARZEN, MAKS_GRACZY, SCHEMAT_GRY, SCHEMAT_KOLEJKI_HOTSEAT, SCHEMAT_WYSLANYCH_HOTSEAT, TRYBY_GRY, czyPinPoprawny, czyTrasaSekret, filtrujLobby, graHotseatDoWysylki, komunikatBleduProfilu, normalizujPseudonim, postepGracza, przeliczWyniki, walidujGraczyLokalnych, walidujGreSurowa, walidujLobbySurowe, walidujKolejkeHotseat, walidujKolejkeZdarzen, walidujWyslaneHotseat, zbudujZdarzenie, zapisKolejkiZdarzen } from './wieloosobowa.js?v=m12-154';
import { interwalPollingu, polecenieMostu, urlGet, urlStanGry, utworzSynchronizacje } from './sync.js?v=m12-154';
import { adresMostu, stanMostu } from './most.js?v=m12-154';
import { LIMIT_RANKINGU, formatujSkutecznosc, mistrzowieZagadek, rankingPunktowy, walidujRankingSurowy } from './ranking.js?v=m12-154';
import {
  KLUCZ_OCEN, KLUCZ_KOLEJKI_OCEN, OCENA_PLUS, OCENA_MINUS, noweOceny, nowyTokenGry,
  walidujOcenyLokalneTekst, ocenPytanie, idGlosujacego, znajdzGlos, walidujKolejkeOcenTekst,
  dodajDoKolejkiOcen, usunZKolejkiOcen, walidujOdpowiedzOceny, walidujStatystykiOcen,
  opisOcenTekst, odmianaRzeczownika,
} from './oceny.js?v=m12-154';

const KLUCZ_KONFIG = 'okolica:konfig';
const KLUCZ_MOTYW = 'okolica:motyw';
/** M11/P4 (ADR 0019): tożsamość i most gry wieloosobowej — osobne klucze, „kasuj dane" czyści wszystko.
 *  Adres mostu NIE jest tu trzymany: żyje w kodzie (`app/most.js`, ADR 0020). */
const KLUCZ_RODZAJU_GRY = 'okolica:rodzaj-gry';
const KLUCZ_SESJI_MULTI = 'okolica:multi:sesja';
/** Zdarzenia gry sieciowej, które nie doszły na most (ADR 0019 aneks 2026-09-13d). */
const KLUCZ_KOLEJKI_MULTI = 'okolica:multi-kolejka';

/**
 * Limit czasu odpowiedzi mostu Drive (ms) — WSPÓLNY dla indeksu paczek, listy
 * gier i stanu gry. Zgłoszenie właściciela 2026-09-12 („problem z łączeniem
 * z Drive po ostatnich zmianach”): panel paczek mówił „Repozytorium
 * niedostępne”, choć paczki na Drive są. Dwie przyczyny po naszej stronie:
 * (1) indeks miał limit 6 s, a zimny start web app Apps Script — zwłaszcza
 * pierwsze żądanie po wdrożeniu — potrafi trwać dłużej, więc żądanie było
 * przerywane, ZANIM most zdążył odpowiedzieć; (2) błąd był połykany
 * (`.catch(() => …)`) i dawał jeden komunikat niezależnie od przyczyny, więc
 * braku sieci nie dało się odróżnić od HTTP 403 (LESSONS L6).
 */
const LIMIT_MOSTU_MS = 15000;

/**
 * Odstęp przed ponowną próbą pobrania indeksu (ms). Jedna powtórka leczy
 * najczęstszą awarię mostu: pierwsze żądanie po wdrożeniu trafia w zimny start.
 * Testy skracają odstęp globalem (wzorzec `__MAKS_KAFELKI_TEST__` z `sw.js`).
 */
const PONOWNA_PROBA_INDEKSU_MS = Number(globalThis.__OKOLICA_PONOWNA_PROBA_MS__) || 800;

/**
 * Bug G (zgłoszenie terenowe 2026-09-12): WebKit potrafi trzymać
 * `watchPosition` w całkowitej ciszy — bez fixa i bez błędu, ignorując opcję
 * `timeout` — a GPS telefonu działa. Watchdog co `KROK_WATCHDOG_GPS_MS`
 * sprawdza znak życia streamu i po `LIMIT_MILCZENIA_GPS_MS` ciszy zakłada
 * świeżego watchera (`ZEGAR_MILCZENIA_MS` w `pozycja.js` to granica domyślna).
 * Gałki globalne istnieją wyłącznie dla testów (wzorzec
 * `__OKOLICA_PONOWNA_PROBA_MS__`).
 */
const KROK_WATCHDOG_GPS_MS = Number(globalThis.__OKOLICA_KROK_GPS_MS__) || 5000;
const LIMIT_MILCZENIA_GPS_MS = Number(globalThis.__OKOLICA_MILCZENIE_GPS_MS__) || ZEGAR_MILCZENIA_MS;

const STAN = {
  konfig: domyslnaKonfiguracja(),
  pozycja: null,
  dokladnoscM: null,
  ostatniFix: null,
  /** Pozycja, przy której OSTATNIO sprawdziliśmy propozycje paczek (uwagi
   *  terenowe #2, 2026-09-11): null = sprawdź przy najbliższym fixie;
   *  potem dopiero dystans ≥ 250 m od tej pozycji zezwala na kolejne żądanie. */
  ostatniaPozycjaZestawow: null,
  ocenaFixa: null,
  /** Nazwa miejsca z Overpass — JEDYNA warstwa od 2026-09-11 (zapasowa
   *  Nominatim usunięta całkowicie decyzją właściciela, ADR 0013 aneks). */
  miejsce: '',
  stacje: [],
  obrot: 0,
  ziarnoOffset: 0,
  prompt: null,
  /** ADR 0032: wariant promptu z ekranu 4 (checkbox „Pytania z fact check") — false = domyślny bez weryfikacji. */
  promptFactcheck: false,
  paczka: null,
  /** ADR 0028: id paczki z repozytorium Drive — tylko takie paczki zbierają oceny. */
  paczkaRepoId: '',
  /** ADR 0028: token tej gry; most liczy z niego „użyta w X grach". */
  tokenGry: '',
  /** ADR 0028: głosy tego telefonu — reguła „już ocenione" działa między sesjami. */
  oceny: noweOceny(),
  /** ADR 0028: pytanie i gracz, przy których stoi panel oceny. */
  ocenianePytanieId: '',
  ocenianyGracz: '',
  /** ADR 0028: tożsamość głosującego spod panelu — ta sama przy renderze i kliku. */
  oceniajacyId: '',
  usterkiPaczki: [],
  /** Ekran, na który wracamy z karty prywatności (jest poza EKRANY). */
  powrotZPrywatnosci: 'setup',
  /** ADR 0039: ostatnia odpowiedź mostu `?akcja=ranking` (RO-ranking/2) albo null. */
  ranking: null,
  /** M6: stan gry `rozgrywka/1` — null do „▶ Zacznij grę". */
  rozgrywka: null,
  // ADR 0050 (właściciel 2026-09-15): paczka jest jawna i zostaje w pamięci na
  // czas gry — nie ma kontenera, nie ma czego ukrywać. Pole `paczka` wyżej
  // niesie przyjętą odpowiedź modelu razem z pieczątką fact-checku.
  // Pauzy gry NIE MA (właściciel 2026-09-13, uwaga B; ADR 0040): aplikacja jest
  // cały czas włączona, a jedyna przerwa jest automatyczna i wznawia ją
  // dowolny klik (ADR 0040 pkt 5). Decyzje liczy czysty moduł `aktywnosc.js`.
  /** Wake Lock (ADR 0040 pkt 4): uchwyt blokady ekranu albo null. */
  wakeLock: null,
  /** Ostatnia akcja gracza (klik albo klawisz) — `performance.now()`. */
  ostatniaAkcjaMs: 0,
  /** Przerwa po 15 min bezczynności: czy trwa, od kiedy i ile jej było łącznie. */
  przerwaBezczynnosci: false,
  przerwaStartMs: 0,
  przerwaSkumulowanaMs: 0,
  /** Watchdog bezczynności (`setInterval`) — żyje całą sesję aplikacji. */
  zegarAktywnosci: null,
  // ADR 0030 aneks 2026-09-13 (uwaga D po wycofaniu blokady): ekran obraca się
  // sam, a po obrocie aplikacja klika za gracza ◎ Centrowanie na mapie.
  /** Ostatni zmierzony kierunek ekranu: 'pion', 'poziom' albo '' (brak pomiaru). */
  kierunekEkranu: '',
  /** Uchwyt opóźnienia, które czeka na uspokojenie wymiarów po `resize`. */
  obrotOpoznienie: null,
  /** M6/R5: kiedy odsłonięto bieżące pytanie (czas odpowiedzi dla modelu). */
  pytaniePokazaneMs: 0,
  /** Snapshot `stan-gry/1` podniesiony przy starcie (ADR 0045: wracamy do gry
   *  bez kliku — banera o znalezionej grze na setupie nie ma, uwaga J). */
  wznowienieKandydat: null,
  /** Ręcznego zakończenia gry NIE uzbraja się klikiem — potwierdzeniem jest
   *  wpisanie TAK w warstwie `#ekran-koniec-gry` (właściciel 2026-09-13, uwaga I;
   *  ADR 0043). Dwustopniowego kasowania ZAPISU gry nie ma: zepsuty albo
   *  zakończony zapis start kasuje sam, bez pytania (uwagi J i K, ADR 0045).
   *  Dwustopniowego kasowania HISTORII gier też już nie ma — lokalnej historii
   *  nie ma wcale (zgłoszenie terenowe O, 2026-09-13; ADR 0010 aneks). */
  graZakonczonaRecznie: false,
  /** M11/P4: 'hotseat' | 'multi' — wybór z setupu, utrwalany w localStorage. */
  rodzajGry: 'hotseat',
  /** M11/P4: sesja gry wieloosobowej `{rola, gra, graczId, pseudonim, urlMostu, sync, ostatniStanMs}` albo null. */
  multi: null,
  /** M12-74 (właściciel 2026-09-11): ścieżka wybrana na setupie — 'zaloz'
   *  albo 'dolacz'. Dołączanie działa TYLKO z listy gier ≤50 m (bez kodów). */
  multiSciezka: 'zaloz',
/** M11/P4: tryb zakładanej gry ('trasa' | 'wyscig') — decyzja właściciela
 * 2026-09-11: Wspólna Trasa (po kolei) i Wyścig na Orientację (dowolnie). */
  multiTryb: 'trasa',
  /** Wspólna Trasa z ptaszkiem „widoczna tylko kolejna stacja” (domyślnie ✓,
   *  właściciel 2026-09-11). Właściwość GRY — jedzie na most jako trasaSekret. */
  multiTrasaSekret: true,
  /** Ścieżka AI dla multi (właściciel, 2026-09-11): po wklejeniu paczki
   * wracamy do panelu „Załóż grę” z gotową paczką, nie do gry hot-seat. */
  multiPoPaczce: false,
  /** Wspólna Trasa = trasa-sekret: przy generowaniu stacji chowamy listę
   * i kropki na mapie — organizator nie poznaje trasy z góry. */
  ukryjStacje: false,
  /** Pełna długość trasy do napisów „stacja X z Y" (zgłoszenie N, 2026-09-13):
   *  powrót do gry sieciowej buduje model z NIEZAMKNIĘTYCH stacji, więc
   *  `rozgrywka.stacje.length` nie jest już długością trasy. Zero = lista gry
   *  jest pełna (hot-seat) i numer stacji to jej indeks. */
  trasaDlugosc: 0,
  /** ADR 0044 (uwaga F): odliczanie startu gry wieloosobowej — jedno na start.
   *  Dwustopniowej rezygnacji z gry NIE MA: przycisk „🏳 Rezygnuję z gry" umarł
   *  razem z panelem multi, a wyjście z gry potwierdza się wpisaniem TAK
   *  w warstwie za ikoną ⚙ START GRY (ADR 0043). */
  odliczanieAktywne: false,
  /** Wejście do gry przez „↩ Wróć do gry" (odświeżenie telefonu) NIE odlicza. */
  wznawiamMulti: false,
  /** Wyjście ORGANIZATORA z lobby zamyka grę WSZYSTKIM — akcja nieodwracalna,
   *  więc też dwustopniowa (audyt PR #13; wzorzec `rezygnujZGryMulti`). */
  multiOpuszczenieUzbrojone: false,
  trybTestowy: false,
  /** Sterowanie watchera z `watchPozycja()`: `{ zamknij, czyAktywny }`. */
  watcher: null,
  /** Bug G: ostatni znak życia GPS (fix albo błąd) — `performance.now()`. */
  gpsOstatniZnakMs: null,
  /** Bug G: ile razy watchdog zakładał świeżego watchera od ostatniego fixa. */
  gpsProba: 0,
  /** Bug G: zegar watchdoga (`setInterval`) — zdejmuje go `zatrzymajGps()`. */
  gpsTimer: null,
  /** Krótki powód ostatniej nieudanej próby mostu (indeks paczek) — pokazywany
   *  w `#most-stan-repo`, żeby „podłączony” nie było obietnicą bez pokrycia:
   *  adres w kodzie to nie to samo co działające połączenie (LESSONS L6). */
  mostOstatniBlad: null,
  /** Mapy z `mapa.js` (M2): `null`, gdy panelu nie ma w `index.html`. */
  mapy: { pozycja: null, stacje: null, gra: null },
  /** Który ekran gry jest pokazany (do powrotu z ekranu prywatności). */
  ekran: 'setup',
  /** Odtwarzana symulacja trasy (tryb testowy): `{fixy, indeks, cel, timer}`. */
  symulacja: null,
  /** Historia fixów (limit z `pozycja.js`) — wspólna dla GPS i symulacji. */
  historiaFixow: [],
  /** Stan sieci drogowej (M4): 'brak' → 'gotowa' po pobraniu albo cache. */
  siec: { stan: 'brak', dane: null, klucz: null, trybGrafu: null, graf: null, kandydaci: null, zCache: false, zrodlo: null },
  /** Wynik `wybierzStacje` (macierz, sprawiedliwość sieciowa) albo null przy pierścieniu. */
  wynikSieci: null,
  /** Odstęp między instancjami Overpass; `?odstep=0` skraca go w testach. */
  odstepOverpassMs: POLITYKA.odstepMs,
  /** Dwustopniowe kasowanie danych: pierwszy klik uzbraja, drugi kasuje. */
  czyszczenieUzbrojone: false,
  /** Czy widok był już centrowany na pierwszym fixie — potem rządzi palec. */
  wycentrowane: false,
};

function $(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Brak elementu #${id} w index.html`);
  return e;
}

const EKRANY = ['setup', 'multi', 'pozycja', 'stacje', 'prompt', 'paczka', 'gra'];
/** Ekrany setupu (kroki 1–5) — EKRANY bez `gra`. Właściciel 2026-09-14, uwaga A
 *  (aneks ADR 0043): na nich ikona ⚙ START GRY działa jak oko na dole ekranu. */
const EKRANY_SETUPU = EKRANY.slice(0, -1);

/**
 * Stan ikon w belce (zgłoszenie właściciela F3, 2026-09-09).
 *
 * Ikona ⚙ START GRY zachowuje się jak 🔔 Sygnały: gdy jej warstwa jest
 * otwarta, ikona jest „wciśnięta” (`aria-pressed="true"`, a CSS daje jej tło
 * akcentu). Powtórny klik w podświetloną ikonę zamyka warstwę. Jedno miejsce
 * liczy stan, bo warstwę otwiera i zamyka kilka ścieżek (przycisk, Escape,
 * „wróć”) — rozsypanie tego po nich gwarantowałoby ikonę świecącą nad
 * zamkniętą warstwą.
 */
/**
 * Czy gra się toczy (ADR 0043): rozgrywka istnieje, nie jest w fazie końcowej
 * i nie została zakończona ręcznie. Jedna reguła dla ikony ⚙ i dla warstwy
 * potwierdzenia — rozjechanie ich skończyłoby się ikoną, która w trakcie gry
 * otwiera setup i nadpisuje `STAN.rozgrywka` (zgłoszenie J, 2026-09-12).
 */
function czyGraToczySie() {
  return Boolean(STAN.rozgrywka) && STAN.rozgrywka.faza !== FAZY.koniec && !STAN.graZakonczonaRecznie;
}

function odswiezStanIkonBelki() {
  const ustaw = (id, wlaczona) => {
    const el = $(id);
    if (el) el.setAttribute('aria-pressed', String(Boolean(wlaczona)));
  };
  // „START GRY” świeci na całej ścieżce przygotowania gry (ekrany 1–5), bo to
  // ta sama warstwa setupu — nie tylko na pierwszym jej kroku, oraz wtedy, gdy
  // otwarta jest warstwa końca gry (uwaga I: ikona jest przełącznikiem).
  const koniecOtwarty = !$('ekran-koniec-gry').hidden;
  ustaw('przycisk-setup', EKRANY.includes(STAN.ekran) || koniecOtwarty);
  // Właściciel 2026-09-13 (uwaga I, ADR 0043): wyszarzenia NIE MA. Zgłoszenie J
  // (2026-09-12) chroniło przed przypadkowym resetem gry — teraz chroni przed
  // nim warstwa potwierdzenia z wpisaniem TAK, więc ikona jest zawsze aktywna:
  // w trakcie gry otwiera zakończenie gry, poza grą działa jak dawniej.
  const setup = $('przycisk-setup');
  if (setup) {
    setup.disabled = false;
    setup.title = czyGraToczySie()
      ? 'START GRY — w trakcie gry otwiera zakończenie aktualnej gry'
      : EKRANY_SETUPU.includes(STAN.ekran)
        ? 'START GRY — chowa i przywraca warstwę setupu (jak oko)'
        : 'START GRY — ustawienia gry';
  }
}

/** Próg odświeżania propozycji paczek (uwagi terenowe #2, 2026-09-11):
 *  poniżej 250 m dryf GPS nie zmienia sensu „okolica", a każde odświeżenie
 *  to żądanie do mostu Drive (limit kwoty Apps Script — ADR 0013). */
const PROG_ODSWIEZENIA_ZESTAWOW_M = 250;

function pokazEkran(nazwa) {
  ukryjStart(); // krok gry chowa okno startowe (poza nim okno nie ma czego przykrywać)
  zamknijInformacje();
  zamknijRankingi({ bezFokusu: true });
  zamknijKoniecGry({ bezFokusu: true });
  // Wejście na ekran pozycji = nowy pobyt na „stronie z paczkami": kontrolna
  // pozycja wraca do null, więc pierwszy fix sprawdzi propozycje od nowa.
  if (nazwa === 'pozycja') STAN.ostatniaPozycjaZestawow = null;
  // Uwaga terenowa A(c) (2026-09-16): krok 5 nie dziedziczy niczego z poprzedniej
  // gry — karta wyniku, komunikaty wklejki i pasek stanu startują czyste.
  if (nazwa === 'paczka') {
    wyczyscEkranPaczki();
    status('');
  }
  $('ekran-prywatnosc').hidden = true;
  // D1 (audyt PR #29, 2026-09-15): podgląd mapy jest trybem BIEŻĄCEGO ekranu, nie stanu
  // strony — każda zmiana ekranu go gasi. Inaczej nowy panel dziedziczy `body.podglad-mapy`,
  // a to w CSS `visibility: hidden; pointer-events: none` (i `inert` z JS): karta otwarta ze
  // stopki i start gry multi u gościa byłyby puste (L65: atrapa DOM kaskady nie liczy).
  STAN.podgladMapy = false;
  STAN.ekran = nazwa;
  // ADR 0030: stan ekranu na <body>. CSS nie ma selektora rodzica, a układ
  // rozgrywki na telefonie (mapa tłem, karty faz NA mapie, bez przewijania
  // strony) musi działać wyłącznie na ekranie gry — nie na setupie, gdzie
  // przewijanie jest normalne i potrzebne.
  document.body.dataset.ekran = nazwa;
  for (const e of EKRANY) {
    $(`ekran-${e}`).hidden = e !== nazwa;
    const krok = document.querySelector(`#kroki li[data-krok="${e}"]`);
    if (krok) {
      krok.classList.toggle('aktywny', e === nazwa);
      krok.classList.toggle('zrobione', EKRANY.indexOf(e) < EKRANY.indexOf(nazwa));
    }
  }
  odswiezMapeEkranu(nazwa);
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli();
  window.scrollTo({ top: 0 });
}

/**
 * Mapa startowa (decyzja właściciela 2026-09-09): sama mapa-tło, nagłówek
 * i stopka — bez formularza. Stan lądowania po starcie (gdy zniknie okno
 * startowe) i po „Wróć na początek". Poza EKRANY jak prywatność:
 * to nie krok przygotowania gry, tylko spód, na którym gra się zaczyna.
 */
function pokazMapeStartowa() {
  zamknijInformacje();
  STAN.podgladMapy = false; // D1: jw. — mapa startowa nie ma warstwy, do której podgląd wraca
  STAN.ekran = 'mapa';
  document.body.dataset.ekran = 'mapa';
  for (const e of EKRANY) {
    $(`ekran-${e}`).hidden = true;
    const krok = document.querySelector(`#kroki li[data-krok="${e}"]`);
    if (krok) {
      krok.classList.remove('aktywny');
      krok.classList.remove('zrobione');
    }
  }
  // C: reset scrolla warstwy startowej — po zakończeniu gry warstwa ma otwierać się od początku
  const startEl = document.getElementById('ekran-start');
  if (startEl) startEl.scrollTop = 0;
  odswiezMapeEkranu('pozycja'); // mapa na spodzie to instancja pozycji
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli();
  window.scrollTo({ top: 0 });
}

/** Okno startowe znika po kliknięciu gdziekolwiek na nie (jw.). */
function ukryjStart() {
  const w = $('ekran-start');
  if (w) {
    // C: po zakończeniu gry i ponownym wejściu w Start layer był przewinięty na dół
    w.scrollTop = 0;
    w.hidden = true;
  }
  document.body.classList.remove('okno-start');
  const mp = document.querySelector('#mapa-pozycja .mapa-przyciski');
  if (mp) mp.hidden = false;
  odswiezWidocznoscPaneli();
}

/**
 * Ekran „dane i prywatność" (ADR 0013 pkt 7) nie jest krokiem gry: chowa
 * wszystkie ekrany z paska kroków i pokazuje siebie, a powrót prowadzi na
 * ekran zapamiętany w `STAN.ekran`.
 */
function pokazPrywatnosc() {
  STAN.prywatnoscZInformacji = !$('ekran-informacje').hidden;
  zamknijInformacje();
  // ADR 0030: ekran prywatności chowa wszystkie ekrany gry, więc znacznik
  // `data-ekran` musi zniknąć razem z nimi — inaczej reguły „bez przewijania”
  // zostałyby na długim dokumencie, którego nie dałoby się przeczytać.
  STAN.powrotZPrywatnosci = EKRANY.includes(STAN.ekran) ? STAN.ekran : 'setup';
  ukryjStart(); // okno startowe nie przykrywa karty prywatności
  STAN.podgladMapy = false; // D1: jw. — `STAN.ekran` zostaje, bo nim wracamy
  document.body.dataset.ekran = 'prywatnosc';
  for (const e of EKRANY) $(`ekran-${e}`).hidden = true;
  $('ekran-prywatnosc').hidden = false;
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli(); // prywatność gasi ikony obu warstw (F3)
  window.scrollTo({ top: 0 });
}

function wrocZPrywatnosci() {
  $('ekran-prywatnosc').hidden = true;
  if (STAN.prywatnoscZInformacji) {
    if (STAN.ekran === 'mapa') pokazMapeStartowa(); else pokazEkran(STAN.ekran);
    przelaczInformacje();
    return;
  }
  if (STAN.ekran === 'mapa') { pokazMapeStartowa(); return; }
  pokazEkran(EKRANY.includes(STAN.ekran) ? STAN.ekran : 'setup');
}

/**
 * Kasuje klucze `okolica:*` z przeglądarki — dwustopniowo, bo na telefonie
 * przypadkowe „OK" w `confirm()` klika się bez czytania. Komunikat idzie do
 * pola z `role="status"`, nie do `alert()` (ADR 0015 pkt 6).
 */
function czyscDaneWitryny() {
  const pole = $('czysc-dane-status');
  if (!STAN.czyszczenieUzbrojone) {
    STAN.czyszczenieUzbrojone = true;
    pole.textContent = 'Kliknij ponownie, żeby usunąć ustawienia gry i motyw z tej przeglądarki.';
    return;
  }
  const usuniete = [];
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const klucz = localStorage.key(i);
    if (klucz && klucz.startsWith('okolica:')) {
      localStorage.removeItem(klucz);
      usuniete.push(klucz);
    }
  }
  STAN.czyszczenieUzbrojone = false;
  pole.textContent = usuniete.length
    ? `Usunięto zapisane dane (${usuniete.length}): ${usuniete.join(
)}.`
    : 'Nie znaleziono zapisanych danych tej gry.';
}

/**
 * „wyczyść pliki tymczasowe aplikacji” (uwaga terenowa 2026-09-16, pkt 2):
 * przycisk TYLKO w trybie testowym (`#ekran-informacje`, obok numeru budowy).
 * Czyści CAŁY `localStorage` tej witryny oraz cache PWA (`caches` ze `sw.js`) —
 * testy właściciela oceniają tę samą aplikację w kółko, a przyklejona
 * sesja/pamięć potrafi udawać błąd. Komunikat idzie do `#status` (widoczny nad
 * stopką), a strona przeładowuje się sama, żeby stan wrócił do czystego: bez
 * reloadu pętla zdarzeń trzymałaby w pamięci to, co właśnie skasowano.
 * Service worker zostaje zarejestrowany — pusty cache odbuduje się przy
 * pierwszym żądaniu, tak samo jak po podbiciu `WERSJA_SW`.
 */
function czyscPlikiTymczasowe() {
  if (!STAN.trybTestowy) return;
  status('Usuwam pliki tymczasowe aplikacji — strona przeładuje się za chwilę.', { czeka: true });
  try {
    const usuniete = [];
    if (typeof localStorage !== 'undefined') {
      // Iterujemy od końca, jak każde sprzątanie localStorage: usunięcie klucza
      // w trakcie pętli nie przesuwa indeksów pozostałych.
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const klucz = localStorage.key(i);
        if (klucz == null) continue;
        localStorage.removeItem(klucz);
        usuniete.push(klucz);
      }
    }
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      void caches.keys().then((klucze) => Promise.all(klucze.map((k) => caches.delete(k)))).catch(() => {});
    }
    status(`Usunięto ${usuniete.length} kluczy pamięci przeglądarki.`);
    window.setTimeout(() => {
      try { window.location.reload(); } catch { /* brak API reloadu — użytkownik odświeży sam */ }
    }, 300);
  } catch (e) {
    status(`Nie udało się wyczyścić plików tymczasowych: ${e?.message ?? e}`);
  }
}

const PANELE = [...EKRANY, 'prywatnosc', 'ranking', 'start', 'informacje', 'koniec-gry'];

/** „START GRY" w nagłówku (F3, uwaga A i aneks ADR 0043 z 2026-09-14):
 *  w trakcie gry — warstwa końca gry; na ekranach setupu (1–5) — chowa i
 *  przywraca warstwę setupu tak jak oko; po zakończeniu gry — mapa startowa;
 *  z mapy startowej — otwiera setup. Przełącznik, nie jednostronne przejście
 *  — gracz klika go odruchowo drugi raz. */
function przelaczSetup() {
  // Właściciel 2026-09-13 (uwaga I, ADR 0043): w trakcie gry ikona jest
  // przełącznikiem warstwy „czy na pewno chcesz zakończyć aktualną grę?".
  if (czyGraToczySie()) { przelaczKoniecGry(); return; }
  zamknijKoniecGry({ bezFokusu: true });
  // Uwaga terenowa A (2026-09-14, aneks ADR 0043): podczas setupu (ekrany 1–5)
  // ⚙ działa DOKŁADNIE jak oko na dole ekranu — chowa warstwę i przywraca ją
  // w tym miejscu setupu, w którym jesteśmy. Stary tor (setup → mapa startowa)
  // zerował pasek kroki, przerywał procedurę, a powrót lądował na pierwszym
  // ekranie setupu. `STAN.ekran` zostaje nietknięty, więc „przywracanie" to
  // ten sam ekran i ten sam scroll.
  if (EKRANY_SETUPU.includes(STAN.ekran)) { przelaczPodgladMapy({ fokus: 'przycisk-setup' }); return; }
  // Po zakończeniu gry (ekran `gra`, faza `koniec`): z powrotem na mapę
  // startową — gra się skończyła, nie ma tu warstwy do przywracania.
  if (STAN.ekran === 'gra') { pokazMapeStartowa(); return; }
  // Mapa startowa (albo spoza kroku): otwiera setup.
  pokazEkran('setup');
}

/* ---------- ADR 0043 (uwagi H1 i I): koniec gry za ikoną ⚙, z wpisaniem TAK */

/**
 * Otwiera warstwę potwierdzenia — zawsze od pustego pola i zablokowanego
 * przycisku. Warstwy NIE świecą równocześnie (wzorzec z `przelaczRankingi`):
 * `body.podglad-mapy`, `body.informacje-otwarte` i `body.ranking-otwarte`
 * ukrywają każdy inny panel centralny, więc otwarcie bez ich zamknięcia
 * pokazałoby pustą kartę nad grą.
 */
function otworzKoniecGry() {
  STAN.podgladMapy = false;
  zamknijInformacje();
  zamknijRankingi({ bezFokusu: true });
  $('koniec-gry-potwierdzenie').value = '';
  $('ekran-koniec-gry').hidden = false;
  document.body.classList.add('koniec-gry-otwarte');
  odswiezKoniecGry();
  $('koniec-gry-potwierdzenie').focus();
}

function zamknijKoniecGry({ bezFokusu = false } = {}) {
  if ($('ekran-koniec-gry').hidden) return;
  $('ekran-koniec-gry').hidden = true;
  $('koniec-gry-potwierdzenie').value = '';
  document.body.classList.remove('koniec-gry-otwarte');
  odswiezWidocznoscPaneli();
  odswiezStanIkonBelki();
  if (!bezFokusu) $('przycisk-setup').focus();
}

function przelaczKoniecGry() {
  if ($('ekran-koniec-gry').hidden) otworzKoniecGry();
  else zamknijKoniecGry();
}

/**
 * Przycisk „■ ZAKOŃCZ AKTUALNĄ GRĘ" jest aktywny DOPIERO po wpisaniu TAK
 * (wielkość liter i odstępy bez znaczenia — właściciel: „non-case-sensitive").
 */
function odswiezKoniecGry() {
  const wpis = String($('koniec-gry-potwierdzenie').value ?? '').trim().toLowerCase();
  $('przycisk-koniec-gry').disabled = wpis !== 'tak';
  odswiezWidocznoscPaneli();
  odswiezStanIkonBelki();
}

/** Potwierdzony koniec gry: ta sama ścieżka, którą dawniej szedł przycisk w panelu. */
function zakonczGreZPotwierdzenia() {
  zamknijKoniecGry({ bezFokusu: true });
  if (STAN.multi) {
    // Gra wieloosobowa: koniec na tym telefonie = WYJŚCIE z gry — także dla
    // ORGANIZATORA (właściciel 2026-09-13, uwaga G; ADR 0019 aneks). Jego telefon
    // służył tylko do wystartowania gry i wybrania pytań; logika i punkty żyją
    // na Drive i na telefonach uczestników, więc pozostali grają dalej.
    rezygnujZGryMulti();
    return;
  }
  zakonczGreRecznie();
}

/**
 * Która z trzech map jest teraz na ekranie: `stacje`, `prompt` i `paczka` dzielą
 * mapę stacji, gra ma swoją, reszta patrzy na mapę pozycji. Reguła żyje w jednym
 * miejscu, bo czytają ją dwie rzeczy: `body[data-mapa]` dla CSS (ADR 0030 pkt 1)
 * i „autokliknięcie" ◎ po obrocie ekranu (aneks 2026-09-13).
 */
function nazwaWidocznejMapy() {
  if (['stacje', 'prompt', 'paczka'].includes(STAN.ekran)) return 'stacje';
  return STAN.ekran === 'gra' ? 'gra' : 'pozycja';
}

function odswiezWidocznoscPaneli() {
  const podglad = STAN.podgladMapy === true;
  document.body.dataset.mapa = nazwaWidocznejMapy();
  const info = !$('ekran-informacje').hidden;
  const ranking = !$('ekran-ranking').hidden;
  const koniecGry = !$('ekran-koniec-gry').hidden;
  const droga = STAN.ekran === 'gra' && !$('gra-panel-odcinek').hidden;
  document.body.classList.toggle('gra-w-drodze', droga);
  document.body.classList.toggle('podglad-mapy', podglad);
  document.body.classList.toggle('informacje-otwarte', info);
  document.body.classList.toggle('koniec-gry-otwarte', koniecGry);
  for (const nazwa of PANELE) {
    const panel = $(`ekran-${nazwa}`);
    panel.inert = podglad
      || (koniecGry && nazwa !== 'koniec-gry')
      || (info && nazwa !== 'informacje')
      || (ranking && nazwa !== 'ranking');
  }
  $('przygaszenie-mapy').hidden = podglad || !PANELE.some(n => !$(`ekran-${n}`).hidden && !(n === 'gra' && droga));
  $('przycisk-podejrzyj-mape').setAttribute('aria-pressed', String(podglad));
  const opis = podglad ? 'Wróć do panelu' : 'Podejrzyj mapę';
  $('przycisk-podejrzyj-mape').setAttribute('aria-label', opis);
  $('przycisk-podejrzyj-mape').title = opis;
  $('przycisk-informacje').setAttribute('aria-expanded', String(info));
  $('przycisk-informacje').setAttribute('aria-pressed', String(info));
  // Jedno miejsce liczy stan obu ikon-warstw (wzorzec F3 właściciela: podświetlona
  // ikona = otwarta warstwa, drugi klik zamyka) — rozsypanie tego po handlerach
  // gwarantowałoby ikonę świecącą nad zamkniętą warstwą.
  $('przycisk-ranking').setAttribute('aria-expanded', String(ranking));
  $('przycisk-ranking').setAttribute('aria-pressed', String(ranking));
}

/** Przełącza podgląd mapy. `fokus` — która ikona dostaje fokus po przełączeniu
 *  (domyślnie oko; ⚙ START GRY przekazuje siebie — na ekranach setupu ikony
 *  dzielą ten sam stan, uwaga A, 2026-09-14). */
function przelaczPodgladMapy({ fokus = 'przycisk-podejrzyj-mape' } = {}) {
  STAN.podgladMapy = !STAN.podgladMapy;
  odswiezWidocznoscPaneli();
  kazdaMapa(m => m.odswiez());
  $(fokus).focus();
}

function zamknijInformacje() {
  $('ekran-informacje').hidden = true;
  document.body.classList.remove('informacje-otwarte');
  $('przycisk-informacje').setAttribute('aria-expanded', 'false');
  $('przycisk-informacje').setAttribute('aria-pressed', 'false');
}

function przelaczInformacje() {
  const otwieramy = $('ekran-informacje').hidden;
  $('ekran-informacje').hidden = !otwieramy;
  STAN.podgladMapy = false;
  zamknijKoniecGry({ bezFokusu: true }); // warstwy nie świecą równocześnie
  if (otwieramy) {
    renderujInformacjeMulti(); // status multi z ostatniego stanu (uwaga terenowa 2026-09-16)
    renderujInformacjeHotseat();
  }
  odswiezWidocznoscPaneli();
  $(otwieramy ? 'przycisk-zamknij-informacje' : 'przycisk-informacje').focus();
}

/* ---------------------------- Ranking (zgłoszenie właściciela 2026-09-12, ADR 0039) */

/**
 * Adres rankingu: ten sam most co reszta (ADR 0020), akcja `ranking`.
 * Pusty łańcuch = ta wersja aplikacji nie ma adresu — wołający mówi to wprost.
 */
function urlRankingu() {
  const url = adresMostu();
  return url ? urlGet(url, 'ranking') : '';
}

function ustawStatusRankingu(tekst) {
  $('ranking-status').textContent = tekst;
}

/** Wypełnia `tbody` tabeli rankingu; buduje WYŁĄCZNIE komórki tekstowe. */
function wypelnijTabeleRankingu(idCiala, wiersze, zbudujKomorki) {
  const cialo = $(idCiala);
  cialo.replaceChildren();
  for (const wiersz of wiersze) {
    const tr = document.createElement('tr');
    for (const wartosc of zbudujKomorki(wiersz)) {
      const td = document.createElement('td');
      td.textContent = String(wartosc);
      tr.appendChild(td);
    }
    cialo.appendChild(tr);
  }
}

/**
 * Rysuje dwie tabele z danych mostu: „Ranking Punktowy Graczy” (suma punktów)
 * i „Mistrzowie Zagadek” (proporcja poprawnych do zadanych, próg 10 pytań).
 * Liczy je `app/ranking.js` — tu zostaje samo wstawienie wierszy i zdanie
 * o stanie danych (pusty ranking musi umieć powiedzieć, DLACZEGO jest pusty).
 */
function renderujRankingi() {
  const ranking = STAN.ranking;
  if (!ranking) return;
  const punktowy = rankingPunktowy(ranking);
  const mistrzowie = mistrzowieZagadek(ranking);
  wypelnijTabeleRankingu('ranking-punkty-wiersze', punktowy.wiersze,
    (w) => [w.pozycja, w.pseudonim, `${w.punkty} pkt`]);
  wypelnijTabeleRankingu('ranking-mistrzowie-wiersze', mistrzowie.wiersze,
    (w) => [w.pozycja, w.pseudonim, formatujSkutecznosc(w)]);
  const czesci = [punktowy.wszystkich
    ? `Graczy z potwierdzonym profilem: ${punktowy.wszystkich} — tabele pokazują po ${LIMIT_RANKINGU} pozycji.`
    : 'Ranking jest pusty — punkty zbiera gracz z potwierdzonym profilem (imię i PIN).'];
  if (punktowy.wszystkich) {
    // Próg mówimy ZAWSZE, nie tylko gdy nikt nie kwalifikuje — gracz musi
    // wiedzieć, dlaczego nie ma go w drugiej tabeli (LESSONS L6: brak danych
    // bez wyjaśnienia wygląda jak zgubiony wynik).
    czesci.push(`Mistrzowie Zagadek liczą się od ${mistrzowie.prog} zadanych pytań`
      + (mistrzowie.kwalifikowani ? '.' : ' — nikt jeszcze nie ma tyle.'));
  }
  ustawStatusRankingu(czesci.join(' '));
}

/** Pobiera ranking z mostu i rysuje tabele; każdą awarię nazywa po polsku (LESSONS L6). */
async function pobierzRankingi() {
  const url = urlRankingu();
  if (!url) {
    ustawStatusRankingu('Ta wersja aplikacji nie ma adresu mostu Drive — rankingu nie ma skąd pobrać (ADR 0020).');
    return;
  }
  ustawStatusRankingu('Pobieram ranking ze wspólnego Drive…');
  try {
    const odpowiedz = walidujRankingSurowy(await pobierzGetTekst(url));
    if (odpowiedz.usterka) {
      ustawStatusRankingu(`Nie udało się odczytać rankingu (${odpowiedz.usterka}) — spróbuj ponownie.`);
      return;
    }
    STAN.ranking = odpowiedz;
    renderujRankingi();
  } catch (e) {
    ustawStatusRankingu(`Nie udało się pobrać rankingu (${e?.powod ?? 'brak odpowiedzi'}) — sprawdź połączenie i spróbuj ponownie.`);
  }
}

function zamknijRankingi({ bezFokusu = false } = {}) {
  if ($('ekran-ranking').hidden) return;
  $('ekran-ranking').hidden = true;
  document.body.classList.remove('ranking-otwarte');
  // Stan ikony liczy `odswiezWidocznoscPaneli` — jedno miejsce dla obu warstw.
  odswiezWidocznoscPaneli();
  if (!bezFokusu) $('przycisk-ranking').focus();
}

/**
 * Ikona pucharu: pierwszy klik otwiera warstwę i pobiera ranking, drugi zamyka
 * (właściciel 2026-09-12: „Ranking jako ikonka pucharu w menu togglowana,
 * otwierany jako layer”).
 */
function przelaczRankingi() {
  if (!$('ekran-ranking').hidden) {
    zamknijRankingi();
    return;
  }
  STAN.podgladMapy = false;
  zamknijInformacje(); // warstwy nie świecą równocześnie
  zamknijKoniecGry({ bezFokusu: true });
  $('ekran-ranking').hidden = false;
  document.body.classList.add('ranking-otwarte');
  odswiezWidocznoscPaneli();
  $('przycisk-zamknij-ranking').focus();
  void pobierzRankingi();
}

/**
 * Komunikat w `#status`. `czeka: true` dokłada klasę `.pulsuje` — sygnał, że
 * aplikacja właśnie coś pobiera z sieci i trzeba poczekać (właściciel
 * 2026-09-13; ADR 0011 aneks). Każdy następny komunikat pulsowanie gasi, więc
 * stan „czekam" nie zostaje na ekranie po zakończonej pracy.
 */
function status(tekst, { czeka = false } = {}) {
  const pole = $('status');
  pole.textContent = tekst;
  pole.classList.toggle('pulsuje', czeka);
}

/**
 * Dopisek roboczy (np. odniesienie do ADR): dokładany do komunikatu tylko
 * w trybie testowym. Poza nim UI mówi po ludzku, bez żargonu projektowego.
 */
function ADR(tekst) {
  return STAN.trybTestowy ? tekst : '';
}

function pokazBledy(idPola, usterki) {
  const pole = $(idPola);
  if (!usterki || usterki.length === 0) {
    pole.hidden = true;
    pole.textContent = '';
    return;
  }
  pole.hidden = false;
  pole.textContent = usterki.map((u) => `${u.kod ? `[${u.kod}] ` : ''}${u.pole ? `${u.pole}: ` : ''}${u.komunikat}`).join(' ');
}

/* ------------------------------------------------------------------ setup */

function renderujTryby() {
  const lista = $('lista-trybow');
  // Węzły zamiast innerHTML (LESSONS L19, BACKLOG B16): atrapa DOM w testach
  // nie parsuje innerHTML, a poza tym nic zewnętrznego nie trafia do znaczników.
  lista.replaceChildren(...Object.entries(TRYBY).map(([klucz, tryb]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'tryb';
    input.value = klucz;
    const mocne = document.createElement('strong');
    mocne.textContent = `${tryb.ikona} ${tryb.etykieta}`;
    const predkosc = document.createElement('span');
    predkosc.textContent = `${String(tryb.predkoscKmh).replace('.', ',')} km/h`;
    etykieta.append(input, mocne, predkosc);
    return etykieta;
  }));
  const zaznaczonyTryb = lista.querySelector(`input[value="${STAN.konfig.tryb}"]`) ?? lista.querySelector('input');
  if (zaznaczonyTryb) {
    zaznaczonyTryb.checked = true;
    STAN.konfig.tryb = zaznaczonyTryb.value;
  }
  lista.addEventListener('change', () => {
    const wybrany = lista.querySelector('input:checked')?.value;
    if (!wybrany || !TRYBY[wybrany]) return;
    STAN.konfig.tryb = wybrany;
    przeliczPromienZCzasu(); // ADR 0025: promień wynika z czasu i prędkości trybu
    aktualizujOpisTrybu();
  });
  aktualizujOpisTrybu();
}

function aktualizujOpisTrybu() {
  const tryb = TRYBY[STAN.konfig.tryb];
  $('opis-trybu').textContent = `${tryb.opis}. Zoom docelowy mapy ≈ ${tryb.zoom}${tryb.wymagaParkingu ? ' · stacje przy parkingu albo obiekcie z dojazdem' : ''}.`;
}

/**
 * Segment czasu gry (uwaga A, 2026-09-15): cztery przyciski z `CZASY_GRY`,
 * radio-wykluczanie robi resztę. Nazwa pola jest jednocześnie `name` grupą
 * radia, więc „poprzedni odpuszcza" jest w markupie, nie w kodzie.
 */
function renderujCzasGry() {
  const etykiety = Object.fromEntries(CZASY_GRY.map((min) => [String(min), { etykieta: `${min} min` }]));
  renderujSegment('lista-czasow', etykiety, String(STAN.konfig.czasGryMin), (klucz) => {
    STAN.konfig.czasGryMin = Number(klucz);
    przeliczPromienZCzasu(); // czas jest wejściem, promień wynikiem (ADR 0025)
  });
}

/** Odświeża wciśnięty przycisk po wartości z konfiguracji (bez budowy i bez nasłuchów). */
function zaznaczCzasGry() {
  const lista = $('lista-czasow');
  if (!lista || !lista.children.length) return; // segment buduje renderujCzasGry()
  for (const wezel of lista.children) {
    for (const input of [...(wezel?.children ?? [])]) {
      if (input?.value !== undefined) input.checked = String(input.value) === String(STAN.konfig.czasGryMin);
    }
  }
}

function renderujSegment(nazwaPola, dane, wybranyKlucz, onChange) {
  const lista = $(nazwaPola);
  lista.replaceChildren(...Object.entries(dane).map(([klucz, pozycja]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nazwaPola;
    input.value = klucz;
    const mocne = document.createElement('strong');
    mocne.textContent = pozycja.etykieta;
    etykieta.append(input, mocne);
    return etykieta;
  }));
  const inputDla = (klucz) => [...lista.children].flatMap((l) => [...(l?.children ?? [])]).find((i) => i?.value === klucz);
  const zaznaczony = inputDla(wybranyKlucz);
  if (zaznaczony) zaznaczony.checked = true;
  lista.addEventListener('change', () => {
    // dzieci kontenera zamiast querySelector('input:checked') — to samo w
    // przeglądarce, a testowa atrapa DOM umie przejść po dzieciach (L19)
    const wybrany = [...lista.children].flatMap((l) => [...(l?.children ?? [])]).find((i) => i?.checked)?.value;
    if (wybrany) onChange(wybrany);
  });
}

function renderujTematy() {
  const lista = $('lista-tematow');
  lista.replaceChildren(...Object.entries(TEMATY_SETUP).map(([klucz, temat]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = klucz;
    input.title = temat.opis;
    const nazwa = document.createElement('span');
    nazwa.textContent = temat.etykieta;
    etykieta.append(input, nazwa);
    return etykieta;
  }));
  // Zaznaczanie przez `children` (nie querySelector po atrybucie) — jak przy
  // odczycie w `tematyZListy`: w przeglądarce to samo, a atrapa testowa też
  // to obsłuży (LESSONS L19), więc stan chipów daje się asertować w testach.
  for (const klucz of STAN.konfig.tematy) {
    for (const etykieta of lista.children) {
      const box = etykieta.children[0];
      if (box && box.value === klucz) box.checked = true;
    }
  }
  const poleWlasne = $('setup-temat-wlasny');
  poleWlasne.value = STAN.konfig.tematWlasny ?? '';
  const odswiezPoleWlasne = () => {
    poleWlasne.hidden = ![...lista.querySelectorAll('input:checked')].some((i) => i.value === 'wlasny');
  };
  odswiezPoleWlasne();
  lista.addEventListener('change', () => {
    STAN.konfig.tematy = tematyZListy(lista);
    odswiezPoleWlasne();
  });
  poleWlasne.addEventListener('input', () => { STAN.konfig.tematWlasny = poleWlasne.value; });
}

/**
 * Tematy zaznaczone na chipach `#lista-tematow` (chip = `label > input+span`).
 * Odczyt przez `children`, nie `querySelectorAll('input:checked')`: atrapa DOM
 * w testach nie ma silnika selektorów po elementach (LESSONS L19), a `children`
 * odwzorowuje — skrót „wszystkie/żadne" da się więc przetestować jak w
 * przeglądarce. W prawdziwym DOM oba odczyty dają to samo.
 */
function tematyZListy(lista) {
  return [...lista.children]
    .map((etykieta) => etykieta.children[0])
    .filter((input) => input && input.checked)
    .map((input) => input.value);
}

/**
 * Skróty „⊞ wszystkie"/„⊟ żadne" przy tematach pytań (właściciel, 2026-09-09).
 * „Dopisz sam" (`wlasny`) skrót nie rusza — to decyzja organizatora, nie
 * temat z kanonu. Stan konfiguracji czyta z DOMu tym samym kodem co handler
 * `change`, więc ręczne i skrócone zaznaczanie dają identyczny wynik.
 */
function ustawWszystkieTematy(zaznacz) {
  const lista = $('lista-tematow');
  for (const etykieta of lista.children) {
    const input = etykieta.children[0];
    if (!input || input.value === 'wlasny') continue;
    input.checked = zaznacz;
  }
  STAN.konfig.tematy = tematyZListy(lista);
  const poleWlasne = $('setup-temat-wlasny');
  poleWlasne.hidden = !STAN.konfig.tematy.includes('wlasny');
}

/* ------- lista graczy = tożsamość (ADR 0026 aneks, decyzja 2026-09-07) ------ */

/**
 * Lista graczy jest JEDYNYM miejscem, w którym wpisuje się ludzi do gry na tym
 * telefonie: imię + PIN, a „Dodaj gracza" potwierdza imię na wspólnym Drive.
 * `liczbaGraczy` i `imiona` są WYNIKIEM długości listy — pola do wpisywania
 * liczby nie ma, bo myliło się z listą imion i z tożsamością.
 */
function renderujListeGraczy() {
  const imiona = Array.isArray(STAN.konfig.imiona) ? STAN.konfig.imiona : [];
  const lista = $('lista-graczy');
  lista.replaceChildren();
  imiona.forEach((imie, i) => {
    const li = document.createElement('li');
    const kto = document.createElement('span');
    const pewny = STAN.graczeZweryfikowani?.[i] !== false;
    kto.textContent = `${i + 1}. ${imie || `Gracz ${i + 1}`}${pewny ? '' : ' — bez potwierdzenia z Drive'}`;
    li.appendChild(kto);
    const usun = document.createElement('button');
    usun.type = 'button';
    usun.className = 'przycisk przycisk-maly';
    usun.textContent = '✕ Usuń';
    usun.setAttribute('aria-label', `Usuń gracza ${imie || i + 1} z listy`);
    usun.addEventListener('click', () => usunGracza(i));
    li.appendChild(usun);
    lista.appendChild(li);
  });
  // Tu, a nie w `dodajGracza`/`usunGracza`, bo `renderujListeGraczy()` jest
  // wołana po KAŻDEJ zmianie listy — także przy starcie (zapamiętani wracają na
  // listę) i przy wznowieniu. Liczba graczy jest długością tej listy (decyzja
  // właściciela 2026-09-07), a plan pytań liczy się z tej liczby (uwaga B,
  // 2026-09-15) — jedno miejsce, więc żaden tor nie zostawia rozjazdu.
  STAN.konfig.liczbaGraczy = Math.max(1, imiona.length);
  synchronizujPytaniaZTrybem();
  renderujPolaTozsamosci(); // multi: pola wpisywania znikają po dodaniu siebie
  // Dołączającemu w multi lista gier ~50 m dopina się do ZNANEGO imienia bez
  // osobnego klikania (funkcja sama odmawia poza ścieżką „Dołączam” i bez
  // potwierdzonego gracza — hot-seat niczego tu nie wywoła).
  void odswiezListeGierNaSetupie();
}

/**
 * Plan pytań na stację liczy `pytaniaNaStacjeDla` (ADR 0027 część A + uwaga
 * terenowa właściciela B, 2026-09-15): w hot-seacie każdy gracz odpowiada raz
 * przy każdej stacji, w multi wszyscy odpowiadają na to samo pytanie. Pola do
 * wpisywania tej liczby nie ma — jest tego świadomym efektem: nie ma czym
 * popsuć równego podziału, więc nie ma też kodu błędu, który go pilnował (K22).
 * Wołane przy każdej zmianie listy graczy, rodzaju gry i przy renderze setupu.
 */
function synchronizujPytaniaZTrybem() {
  const ile = pytaniaNaStacjeDla({
    liczbaGraczy: Math.max(1, STAN.konfig.imiona?.length ?? 1),
    rodzajGry: STAN.rodzajGry,
  });
  if (STAN.konfig.pytaniaNaStacje !== ile) STAN.konfig.pytaniaNaStacje = ile;
}

function usunGracza(indeks) {
  const imiona = [...(STAN.konfig.imiona ?? [])];
  const [usuniete] = imiona.splice(indeks, 1);
  STAN.konfig.imiona = imiona;
  STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? [])].filter((_, i) => i !== indeks);
  renderujListeGraczy(); // liczba graczy i plan pytań liczą się tu (uwaga B)
  przeliczPromienZCzasu(); // pytania wchodzą do wzoru na promień (ADR 0025)
  przywrocGraczy();
  status(usuniete ? `„${usuniete}" usunięte z listy graczy.` : 'Lista graczy bez zmian.');
}

/** Klucz i schemat listy graczy zapamiętanej na tym telefonie (ADR 0026 aneks). */
const KLUCZ_GRACZY = 'okolica:gracze';

function czytajGraczyLokalnych() {
  try {
    return walidujGraczyLokalnych(JSON.parse(localStorage.getItem(KLUCZ_GRACZY) ?? 'null'));
  } catch {
    return null; // śmieci w localStorage nie kładą setupu (LESSONS L10)
  }
}

/** Zapamiętuje gracza potwierdzonego na moście — PIN nie jest zapisywany. */
function zapamietajGracza(pseudonim, { zweryfikowany = true } = {}) {
  const imie = normalizujPseudonim(pseudonim);
  if (!imie) return;
  const zapis = czytajGraczyLokalnych();
  const gracze = (zapis?.gracze ?? []).filter((g) => g.pseudonim.toLowerCase() !== imie.toLowerCase());
  gracze.unshift({ pseudonim: imie, zweryfikowany });
  localStorage.setItem(KLUCZ_GRACZY, JSON.stringify({
    schemat: 'gracze-lokalni/1', gracze: gracze.slice(0, MAKS_GRACZY), kiedy: new Date().toISOString(),
  }));
}

/**
 * Zapamiętani gracze wracają jako przyciski: jedno kliknięcie dodaje ich do gry
 * BEZ pytania o PIN (decyzja właściciela 2026-09-07). Kto nie jest jeszcze
 * potwierdzony na tym telefonie, dostaje kursor w polu PIN.
 *
 * `zListy: true` tylko przy starcie aplikacji — wtedy potwierdzeni gracze sami
 * wskakują na listę. Przy każdej późniejszej zmianie (dodanie, usunięcie)
 * funkcja TYLKO przerysowuje przyciski i znaczniki potwierdzenia: bez tego
 * rozróżnienia usunięty gracz wracałby na listę w tej samej chwili.
 */
function przywrocGraczy({ zListy = false } = {}) {
  const zapamietani = czytajGraczyLokalnych()?.gracze ?? [];
  if (zListy) {
    // Zapamiętana lista wraca do gry BEZ pytania o PIN (decyzja właściciela
    // 2026-09-07) — ale tylko gracze potwierdzeni kiedyś na moście; niepewni
    // zostają jako przyciski i wymagają PIN-u.
    for (const g of zapamietani) {
      if (!g.zweryfikowany) continue;
      const juz = (STAN.konfig.imiona ?? []).some((i) => normalizujPseudonim(i).toLowerCase() === g.pseudonim.toLowerCase());
      if (juz || (STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) continue;
      STAN.konfig.imiona = [...(STAN.konfig.imiona ?? []), g.pseudonim];
      STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? []), true];
    }
  }
  renderujListeGraczy();
  const wGrze = new Set((STAN.konfig.imiona ?? []).map((i) => normalizujPseudonim(i).toLowerCase()));
  const wolni = zapamietani.filter((g) => !wGrze.has(g.pseudonim.toLowerCase()));
  const pasek = $('lista-zapamietanych');
  pasek.replaceChildren();
  for (const g of wolni) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-maly';
    b.textContent = `➕ ${g.pseudonim}`;
    b.setAttribute('aria-label', `Dodaj zapamiętanego gracza ${g.pseudonim}`);
    b.addEventListener('click', () => { void dodajZapamietanegoGracza(g); });
    pasek.appendChild(b);
  }
  // kto z bieżącej listy jest potwierdzony na tym telefonie — bez ponownego PIN-u
  const pewni = new Map(zapamietani.map((g) => [g.pseudonim.toLowerCase(), g.zweryfikowany]));
  STAN.graczeZweryfikowani = (STAN.konfig.imiona ?? []).map((imie) => (
    pewni.get(normalizujPseudonim(imie).toLowerCase()) ?? (STAN.graczeZweryfikowani?.[(STAN.konfig.imiona ?? []).indexOf(imie)] ?? false)
  ));
  if ((STAN.konfig.imiona ?? []).length) {
    $('profil-stan').textContent = 'Gracze z tego telefonu są już na liście — bez PIN-u. Usuń albo dodaj kolejnego.';
  } else if (zapamietani.length) {
    $('profil-stan').textContent = 'Ten telefon pamięta graczy — dodaj ich jednym kliknięciem (bez PIN-u) albo wpisz nowe imię z PIN-em.';
  }
}

function dodajGraczaDoListy(imie, { zweryfikowany }) {
  STAN.konfig.imiona = [...(STAN.konfig.imiona ?? []), imie];
  STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? []), zweryfikowany];
  pokazBledy('bledy-profil', []);
  $('profil-pseudonim').value = '';
  $('profil-pin').value = ''; // PIN nie zostaje w polu (ADR 0013)
  renderujListeGraczy();
  synchronizujPytaniaZTrybem();
  przeliczPromienZCzasu(); // liczba pytań wchodzi do wzoru na promień (ADR 0025)
  przywrocGraczy();
}

/** Zapamiętany i potwierdzony gracz wchodzi jednym kliknięciem, bez PIN-u. */
async function dodajZapamietanegoGracza(zapamietany) {
  if (!zapamietany?.zweryfikowany) {
    $('profil-pseudonim').value = zapamietany?.pseudonim ?? '';
    $('profil-pin').value = '';
    pokazBledy('bledy-profil', [{ komunikat: 'Ten gracz nie był jeszcze potwierdzony na tym telefonie — wpisz jego PIN.' }]);
    $('profil-pin').focus?.();
    return false;
  }
  if (STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1) {
    // Multiplayer: dokładnie jedna osoba na telefon (właściciel 2026-09-11) —
    // ten sam limit co w `dodajGracza`, skrót zapamiętanych go nie omija.
    pokazBledy('bledy-profil', [{ komunikat: 'W multiplayerze gra z tego telefonu tylko jedna osoba — usuń siebie z listy, żeby zmienić gracza.' }]);
    return false;
  }
  if ((STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) {
    pokazBledy('bledy-profil', [{ komunikat: `Maksymalnie ${MAKS_GRACZY} graczy na jednym telefonie.` }]);
    return false;
  }
  dodajGraczaDoListy(zapamietany.pseudonim, { zweryfikowany: true });
  status(`„${zapamietany.pseudonim}" dodany do gry — ten telefon już go potwierdził.`);
  return true;
}

/**
 * „➕ Dodaj gracza": jedno wołanie `profil-ustaw` robi całą robotę — wolne imię
 * zakłada profil z tym PIN-em, zajęte wymaga PIN-u właściciela, a zły PIN to
 * odmowa R20 i gracz NIE trafia na listę. Most, który nie odpowiada, nie
 * blokuje gry (ADR 0016 pkt 5) — gracz wchodzi bez potwierdzenia, a komunikat
 * mówi wprost, że historia nie zostanie zapisana.
 */
async function dodajGracza() {
  const przycisk = $('przycisk-dodaj-gracza');
  if (przycisk.disabled) return false; // jedno kliknięcie = jedno żądanie
  const pseudo = normalizujPseudonim($('profil-pseudonim').value);
  const pin = ($('profil-pin').value ?? '').trim();
  const odmowa = (komunikat, pole = 'profil-pin') => {
    pokazBledy('bledy-profil', [{ komunikat }]);
    $(pole).focus?.();
    return false;
  };
  if (!pseudo) return odmowa('Wpisz imię gracza — trafia do historii gier.', 'profil-pseudonim');
  if (STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1) {
    // Właściciel, 2026-09-11: w grze na wielu urządzeniach wpisujesz na setupie
    // TYLKO siebie (imię+PIN jak w hot-seat) — pozostałych zapraszasz w lobby.
    return odmowa('W grze na wielu urządzeniach gra z tego telefonu tylko JEDNA osoba — Ty. Pozostałych graczy dołączysz w lobby.', 'profil-pseudonim');
  }
  if ((STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) {
    return odmowa(`Maksymalnie ${MAKS_GRACZY} graczy na jednym telefonie.`, 'profil-pseudonim');
  }
  if ((STAN.konfig.imiona ?? []).some((i) => normalizujPseudonim(i).toLowerCase() === pseudo.toLowerCase())) {
    return odmowa(`„${pseudo}" jest już na liście graczy.`, 'profil-pseudonim');
  }
  if (!czyPinPoprawny(pin)) {
    return odmowa('PIN to 4–8 cyfr. Nowe imię dostaje nowy PIN, zajęte wymaga PIN-u właściciela.');
  }

  const url = adresMostu();
  przycisk.disabled = true;
  try {
    if (!url) {
      dodajGraczaDoListy(pseudo, { zweryfikowany: false });
      $('profil-stan').textContent = 'Ta wersja aplikacji nie ma adresu mostu — gracz dodany, ale historia gier nie zostanie zapisana.';
      status(`„${pseudo}" dodany bez potwierdzenia (brak adresu mostu).`);
      return true;
    }
    status(`Sprawdzam imię „${pseudo}" na wspólnym Drive…`);
    let wynik;
    try {
      wynik = await polecenieMostu(url, { akcja: 'profil-ustaw', pseudonim: pseudo, pin });
    } catch (e) {
      if (e?.odmowaMostu) return odmowa(komunikatBleduProfilu(String(e.message ?? '').trim()));
      dodajGraczaDoListy(pseudo, { zweryfikowany: false });
      $('profil-stan').textContent = 'Drive nie odpowiada — gracz dodany bez potwierdzenia. Historia tej gry nie zostanie zapisana; spróbuj przy następnej grze.';
      status('Nie udało się sprawdzić imienia na Drive — gracz dodany lokalnie.');
      return true;
    }
    const imie = wynik.pseudonim || pseudo;
    zapamietajGracza(imie);
    dodajGraczaDoListy(imie, { zweryfikowany: true });
    $('profil-stan').textContent = wynik.nowy
      ? `Nowy profil „${imie}" założony z tym PIN-em. Dodaj kolejnego gracza albo przejdź dalej.`
      : `„${imie}" potwierdzone PIN-em — witaj z powrotem. Dodaj kolejnego gracza albo przejdź dalej.`;
    status(wynik.nowy
      ? `Założono profil „${imie}" — historia gier tego gracza jest na wspólnym Drive.`
      : `To Ty — „${imie}" potwierdzone PIN-em.`);
    return true;
  } finally {
    przycisk.disabled = false;
  }
}

/**
 * BRAMA tożsamości ekranu 1 (ADR 0026): na ekran 2 przechodzi się z co
 * najmniej jednym graczem na liście. Same imiona są już sprawdzone — każde
 * przeszło przez `profil-ustaw` przy dodawaniu (albo przez zapamiętanie na tym
 * telefonie), więc brama tylko pilnuje, żeby lista nie była pusta, i mówi
 * wprost, gdy któryś gracz nie ma potwierdzenia z Drive.
 */
async function bramkaTozsamosci() {
  const imiona = (STAN.konfig.imiona ?? []).map((i) => normalizujPseudonim(i)).filter(Boolean);
  if (!imiona.length) {
    const komunikat = 'Dodaj co najmniej jednego gracza: imię i PIN, potem „➕ Dodaj gracza".';
    pokazBledy('bledy-profil', [{ komunikat }]);
    $('profil-stan').textContent = komunikat;
    $('profil-pseudonim').focus?.();
    return false;
  }
  if (STAN.rodzajGry === 'multi' && imiona.length > 1) {
    const komunikat = 'W grze na wielu urządzeniach na tym telefonie gra tylko JEDNA osoba — Ty. Usuń pozostałych graczy z listy (✕ Usuń), pozostałych zaproś w lobby.';
    pokazBledy('bledy-profil', [{ komunikat }]);
    $('profil-stan').textContent = komunikat;
    return false;
  }
  const bezPotwierdzenia = imiona.filter((_, i) => STAN.graczeZweryfikowani?.[i] === false);
  pokazBledy('bledy-profil', []);
  if (bezPotwierdzenia.length) {
    $('profil-stan').textContent = `Grasz lokalnie: ${bezPotwierdzenia.join(', ')} ${bezPotwierdzenia.length === 1 ? 'nie ma' : 'nie mają'} potwierdzenia z Drive — historia tej gry nie zostanie zapisana.`;
    status('Część graczy bez potwierdzenia z Drive — grasz lokalnie.');
  }
  return true;
}

/* ------ wynik gry hot-seat na wspólnym Drive (ADR 0026 aneks) -------------- */

/** Klucze localStorage kolejki i rejestru wysłanych (schematy w `wieloosobowa.js`). */
const KLUCZ_KOLEJKI_HOTSEAT = 'okolica:hotseat-kolejka';
const KLUCZ_WYSLANYCH_HOTSEAT = 'okolica:hotseat-wyslane';
const MAKS_KOLEJKA_HOTSEAT = 5;
const MAKS_REJESTR_WYSLANYCH = 30;

function czytajKolejkeHotseat() {
  try {
    return walidujKolejkeHotseat(JSON.parse(localStorage.getItem(KLUCZ_KOLEJKI_HOTSEAT) ?? 'null'));
  } catch {
    return []; // śmieci w localStorage nie kładą aplikacji (LESSONS L10)
  }
}

function zapiszKolejkeHotseat(gry) {
  if (!gry.length) {
    localStorage.removeItem(KLUCZ_KOLEJKI_HOTSEAT);
    return;
  }
  localStorage.setItem(KLUCZ_KOLEJKI_HOTSEAT, JSON.stringify({ schemat: SCHEMAT_KOLEJKI_HOTSEAT, gry: gry.slice(-MAKS_KOLEJKA_HOTSEAT) }));
}

function czytajWyslaneHotseat() {
  try {
    return walidujWyslaneHotseat(JSON.parse(localStorage.getItem(KLUCZ_WYSLANYCH_HOTSEAT) ?? 'null'));
  } catch {
    return [];
  }
}

function zaznaczWyslanyHotseat(klucz) {
  const klucze = [...czytajWyslaneHotseat().filter((k) => k !== klucz), klucz];
  localStorage.setItem(KLUCZ_WYSLANYCH_HOTSEAT, JSON.stringify({ schemat: SCHEMAT_WYSLANYCH_HOTSEAT, klucze: klucze.slice(-MAKS_REJESTR_WYSLANYCH) }));
}

/**
 * Odcisk gry: kod (pusty w grze lokalnej) + chwila startu + skład. Zapis gry
 * odświeża się przy każdej tranzycji, a wynik ma trafić na Drive RAZ — bez tego
 * klucza ta sama gra weszłaby do historii tyle razy, ile razy się zapisała.
 */
function kluczGryHotseat(r) {
  return [String(r.kodGry || 'gra'), Number(r.startMs) || 0, (r.gracze ?? []).map((g) => g.imie).join(',')].join('|');
}

/**
 * Czy jest dokąd zapisać wynik: potrzebny choć jeden gracz potwierdzony
 * profilem na Drive. Zapis jest DOMYŚLNY i nie pytamy o niego przy każdej
 * grze (właściciel, 2026-09-07) — co i dokąd trafia, opisuje sekcja „Dane
 * i prywatność".
 */
function czyWysylacWynikHotseat() {
  return (STAN.graczeZweryfikowani ?? []).some(Boolean);
}

/** Polecenie `gra-hotseat` z bieżącej rozgrywki (fakty, nie gotowe punkty). */
function polecenieHotseat() {
  const r = STAN.rozgrywka;
  if (!r) return { ok: false, usterki: ['brak zakończonej gry'] };
  return graHotseatDoWysylki({
    miejsce: STAN.miejsce || 'nieznane miejsce',
    // geohash5 STARTU gry — tak samo jak w konfiguracji gry wieloosobowej
    // (ADR 0019 pkt 3): przybliżenie okolicy, nie punkt gracza.
    geohash5: Number.isFinite(r.start?.lat) ? geohash(r.start.lat, r.start.lon, 5) : '',
    wiek: STAN.konfig.wiek,
    tematy: STAN.konfig.tematy,
    liczbaStacji: r.stacje.length,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    gracze: (r.gracze ?? []).map((g) => ({ id: g.id, pseudonim: g.imie })),
    dziennik: r.dziennik,
    // Ten sam odcisk gry co lokalny rejestr wysłanych — most po nim rozpoznaje
    // powtórkę i nie zakłada drugiego pliku (zgłoszenie właściciela 2026-09-09).
    kluczGry: kluczGryHotseat(r),
  });
}

/**
 * Koniec gry na tym telefonie = wynik na wspólnym Drive (decyzja właściciela
 * 2026-09-07). Punkty liczy most z przesłanych faktów, więc historia hot-seat
 * i gier wieloosobowych jest jedną historią. Awaria sieci niczego nie gubi:
 * polecenie czeka w kolejce i leci przy następnym uruchomieniu (ADR 0016 pkt 5).
 */
/** Komunikat o wysyłce idzie na WŁASNĄ linię wyniku, nie na wspólny `#status`. */
function stanWysylkiWyniku(tekst) {
  const linia = $('wynik-drive');
  if (linia) linia.textContent = tekst;
}

async function wyslijWynikHotseat() {
  if (STAN.multi) return; // gra wieloosobowa ma wyniki na moście z urzędu (ADR 0019)
  if (!czyWysylacWynikHotseat()) {
    stanWysylkiWyniku('Wynik został na telefonie — żaden gracz nie ma potwierdzonego profilu, więc historia tej gry nie zostanie zapisana.');
    return;
  }
  const r = STAN.rozgrywka;
  const klucz = kluczGryHotseat(r);
  if (czytajWyslaneHotseat().includes(klucz)) return; // ta gra już pojechała
  const bud = polecenieHotseat();
  if (!bud.ok) {
    stanWysylkiWyniku(`Wynik został na telefonie: ${bud.usterki.join('; ')}.`);
    return;
  }
  zaznaczWyslanyHotseat(klucz); // raz na grę — niezależnie od wyniku wysyłki
  const url = adresMostu();
  if (!url) {
    stanWysylkiWyniku('Wynik został na telefonie — ta wersja aplikacji nie ma adresu mostu Drive.');
    return;
  }
  stanWysylkiWyniku('Wysyłam wynik na wspólny Drive…');
  try {
    await polecenieMostu(url, bud.polecenie);
    stanWysylkiWyniku('☁ Wynik jest na wspólnym Drive — gra jest w historii.');
  } catch (e) {
    // Kolejka zostaje w obu przypadkach, ale powód musi być prawdziwy: jawna
    // odmowa mostu (np. skrypt w Apps Script bez akcji `gra-hotseat`) to nie
    // awaria sieci — patrz kontrakt `polecenieMostu` w app/sync.js.
    zapiszKolejkeHotseat([...czytajKolejkeHotseat(), bud.polecenie]);
    stanWysylkiWyniku(e?.odmowaMostu
      ? `Wynik został na telefonie — most Drive odmówił: ${String(e.message ?? 'nieznany powód')}. Wynik czeka w kolejce i poleci, gdy most przyjmie akcję gra-hotseat (w Apps Script potrzebna jest aktualna wersja skryptu).`
      : 'Drive nie odpowiedział — wynik czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.');
  }
}

/** Start aplikacji: wyniki z kolejki jadą na Drive (bez nich historia byłaby dziurawa). */
async function oproznijKolejkeHotseat() {
  const url = adresMostu();
  if (!url) return;
  const gry = czytajKolejkeHotseat();
  if (!gry.length) return;
  const zostaly = [];
  let doszlo = 0;
  let odmowa = null;
  for (const polecenie of gry) {
    try {
      await polecenieMostu(url, polecenie);
      doszlo += 1;
    } catch (e) {
      zostaly.push(polecenie); // zostanie na później
      if (e?.odmowaMostu) odmowa = String(e.message ?? 'nieznany powód'); // jawna odmowa, nie awaria sieci
    }
  }
  zapiszKolejkeHotseat(zostaly);
  if (doszlo) status(`Wyniki gier z kolejki (${doszlo}) doszły na wspólny Drive — historia jest pełna.`);
  if (odmowa) {
    status(`Most Drive odmówił przyjęcia ${zostaly.length} wyników z kolejki: ${odmowa}. Zostaną ponowione przy następnym uruchomieniu — w Apps Script potrzebna jest aktualna wersja skryptu mostu.`);
  }
}

/**
 * Nasłuchy pól setupu podpina się RAZ (LESSONS L14): renderujSetup() odpala
 * i przy starcie, i przy wznowieniu gry — bez strażnika każdy input/select
 * dostałby drugi handler (m.in. podwójne przebudowy list i statusy).
 */
let setupNasluchyPodpiete = false;

/**
 * Promień gry jest WYNIKIEM, nie polem (ADR 0025): organizator wpisuje, ile ma
 * czasu, a promień liczy się z czasu, sposobu poruszania i liczby pytań
 * (`przeliczenieCzasu` w konfig.js). Akapit `#setup-promien-info` pokazuje
 * składowe, żeby liczba nie była magią (LESSONS L6).
 */
function przeliczPromienZCzasu() {
  const k = STAN.konfig;
  const r = przeliczenieCzasu({
    czasGryMin: k.czasGryMin, tryb: k.tryb,
    liczbaStacji: k.liczbaStacji, pytaniaNaStacje: k.pytaniaNaStacje,
  });
  k.promienM = r.promienM;
  const info = $('setup-promien-info');
  if (!info) return;
  const minuty = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const odleglosc = (m) => (m >= 1000 ? `${minuty(m / 1000)} km` : `${Math.round(m)} m`);
  info.textContent = Number.isFinite(k.czasGryMin)
    // Krótko: setup ma się mieścić na 360 px bez przewijania (WORKFLOW §4.2).
    ? `Promień gry: ${odleglosc(r.promienM)} (z ${k.czasGryMin} min: ${r.pytania} ${r.pytania === 1 ? 'pytanie' : 'pytań'} ≈ ${minuty(r.czasOdpowiedziMin)} min, droga ≈ ${minuty(r.czasDrogiMin)} min, trasa ≈ ${odleglosc(r.trasaM)}).`
    : 'Wybierz planowany czas gry — promień policzy się z niego sam.';
}

function renderujSetup() {
  const k = STAN.konfig;
  $('setup-stacje').value = k.liczbaStacji;
  synchronizujPytaniaZTrybem(); // plan pytań jest liczony, nie wpisywany (uwaga B)
  zaznaczCzasGry(); // czas stoi na liście graczy nie zależy — ale zależy od zapisu (uwaga A)
  przeliczPromienZCzasu();

  // Wartości pól odświeżamy za każdym razem, nasłuchy — tylko raz (L14).
  if (setupNasluchyPodpiete) return;
  setupNasluchyPodpiete = true;

  const czytajLiczbe = (idPola, pole) => $(idPola).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    STAN.konfig[pole] = Number.isFinite(v) ? v : null;
    przeliczPromienZCzasu(); // czas, stacje i pytania wchodzą do wzoru (ADR 0025)
  });
  renderujCzasGry(); // segment + jego `change` — raz, bo renderujSetup wraca przy wznowieniu (L14)
  czytajLiczbe('setup-stacje', 'liczbaStacji');
  $('przycisk-dodaj-gracza').addEventListener('click', () => { void dodajGracza(); });
}

function czytajSetupZDomu() {
  // imiona i liczba graczy nie mają pól: żyją w liście graczy (`STAN.konfig`)
  return STAN.konfig;
}

/* --------------------------------------------------------------- pozycja */

function pokazPozycje() {
  const p = STAN.pozycja;
  if (!p) {
    $('pozycja-status').textContent = STAN.trybTestowy
      ? 'Tryb testowy: użyj oka i wskaż miejsce na mapie.'
      : 'Czekam na pozycję…';
    $('przycisk-zlokalizuj').hidden = !STAN.trybTestowy;
    $('pozycja-wspolrzedne').textContent = '';
    $('przycisk-dalej-stacje').disabled = true;
    odswiezWarstwy();
    return;
  }
  $('przycisk-zlokalizuj').hidden = true;
  $('pozycja-status').textContent = STAN.trybTestowy ? 'Pozycja ustawiona z mapy / symulacji' : 'Pozycja ustalona';
  $('pozycja-wspolrzedne').textContent = `${formatujWspolrzedne(p.lat, p.lon)} · geohash ${geohash(p.lat, p.lon, 6)}`;
  renderujMiejsce();
  $('przycisk-dalej-stacje').disabled = false;
  // Jawność odrzucenia fixu: komunikat i próg liczy `ocenFix` (ADR 0034 pkt 2 —
  // walidujemy współrzędne, nie szacunek `accuracy`), tu tylko pokazujemy, co powiedział.
  if (STAN.ocenaFixa?.kod) status(STAN.ocenaFixa.komunikat);

  odswiezWarstwy();
  // pierwszy fix ustawia widok; potem mapę prowadzi palec gracza (ADR 0011)
  if (!STAN.wycentrowane) {
    STAN.wycentrowane = true;
    centrujNaPozycji();
  }
  // Karta propozycji paczek żyje na ekranie pozycji (`#zestawy-karta`
  // w `#ekran-pozycja`). `pokazPozycje()` jest wołane przy KAŻDYM fixie, a fixy
  // lecą cały czas — bez tej bramki cała rozgrywka to seria zapytań do
  // mostu o indeks, którego nikt wtedy nie ogląda: bateria, transfer i limit
  // kwoty Apps Script idą w błoto (ADR 0013: żadnych zbędnych żądań).
  // Właściciel 2026-09-11 (uwagi terenowe #2): GPS na miejscu dryfuje o metry,
  // więc oprócz „tylko na ekranie pozycji" dokładamy próg dystansu — sprawdzamy
  // raz po wejściu na ekran (kontrolna pozycja jest wtedy null), a potem dopiero
  // po odejściu ≥ 250 m od pozycji ostatniego sprawdzenia.
  if (STAN.ekran === 'pozycja') {
    const kontrolna = STAN.ostatniaPozycjaZestawow;
    const doscDaleko = !kontrolna
      || !STAN.pozycja
      || odlegloscM(kontrolna, STAN.pozycja) >= PROG_ODSWIEZENIA_ZESTAWOW_M;
    if (doscDaleko) {
      STAN.ostatniaPozycjaZestawow = STAN.pozycja ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon } : null;
      odswiezPropozycjeZestawow();
    }
  }
}

/** Zamyka watcher, jeśli działa (ADR 0004 pkt 1: jeden watcher na rozgrywkę). */
function zatrzymajGps() {
  if (STAN.watcher) {
    STAN.watcher.zamknij();
    STAN.watcher = null;
  }
  if (STAN.gpsTimer) {
    clearInterval(STAN.gpsTimer);
    STAN.gpsTimer = null;
  }
}

/**
 * Włącza śledzenie położenia przez osłonę z `pozycja.js`. Cała logika
 * (opcje watchera, ocena fixu, komunikaty błędów, brak API) jest tam —
 * tu tylko przypisanie stanu i odświeżenie ekranu.
 */
function wlaczGps() {
  zatrzymajGps();
  $('pozycja-status').textContent = 'Szukam satelitów…';
  // Bug G: o „GPS włączony” mówimy tylko na pierwszym starcie. Powrót z tła i
  // watchdog też przechodzą tędy — restarowi watchera w trakcie gry NIE wolno
  // nadpisywać statusu rozgrywki (LESSONS L22).
  if (!STAN.ostatniFix) status('GPS włączony — pierwszy fix potrafi trwać kilkanaście sekund.');
  STAN.watcher = watchPozycja({
    geolocation: navigator.geolocation,
    zegar: () => performance.now(),
    opcje: PROFILE_GPS.dokladny, // zawsze dokładny: oszczędzanie baterii wycofane (uwaga B, ADR 0040)
    onFix: (fix) => {
      STAN.gpsOstatniZnakMs = performance.now(); // bug G: fix to znak życia
      STAN.gpsProba = 0;
      przyjmijFix(fix);
    },
    onBlad: (blad) => {
      STAN.gpsOstatniZnakMs = performance.now(); // bug G: błąd to też znak życia — pipe odpowiada
      pokazBledy('bledy-pozycja', [{ kod: blad.kod, pole: 'geolocation', komunikat: blad.komunikat }]);
      $('pozycja-status').textContent = 'Brak pozycji';
      status('Położenie niedostępne — gra czeka na sygnał. Wyjdź na otwartą przestrzeń, a jeśli stacja jest nieosiągalna, zakończ grę ikoną „⚙ START GRY” i wpisz TAK.' + ADR(' (ADR 0029)'));
    },
  });
  if (STAN.watcher?.czyAktywny() && !STAN.gpsTimer && czyUzbroicWatchdogGps()) {
    STAN.gpsTimer = setInterval(tykniecieGps, KROK_WATCHDOG_GPS_MS);
  }
  if (!STAN.watcher.czyAktywny()) $('pozycja-status').textContent = 'Brak pozycji';
}

/**
 * Czy w tej chwili w ogóle czekamy na fixa watchdogiem: na ekranie pozycji albo
 * w odcinku gry. Poza nimi watcher bywa aktywny (idzie za graczem między
 * ekranami), ale nie ma czegokolwiek, na co miałby czekać w ciszy — zegar jest
 * wtedy zbędny, a w testach nie wolno zostawiać żywych interwałów po instancji
 * (zawiesiłyby pętlę zdarzeń `node --test`).
 */
function czyUzbroicWatchdogGps() {
  if (STAN.trybTestowy || !STAN.watcher?.czyAktywny()) return false;
  if (STAN.ekran === 'pozycja') return true;
  const r = STAN.rozgrywka;
  return Boolean(r) && r.faza === FAZY.odcinek;
}

/**
 * Bug G: tyknięcie watchdoga GPS. Cisza dłuższa niż `LIMIT_MILCZENIA_GPS_MS`
 * bez JAKIEGOKOLWIEK callbacku oznacza martwy nasłuch (WebKit ignoruje wtedy
 * własny `timeout`) — zakładamy świeżego watchera i mówimy graczowi, która
 * to próba. „czyAktywny()” mówi tylko, że NASZ wrapper żyje, nie że WebKit
 * cokolwiek dostarczy — dokładnie ta pułapka kosztowała bez końca wiszący
 * ekran „Gdzie jesteś?”.
 */
function tykniecieGps() {
  if (!czyUzbroicWatchdogGps()) {
    if (STAN.gpsTimer) { clearInterval(STAN.gpsTimer); STAN.gpsTimer = null; }
    return;
  }
  const teraz = performance.now();
  if (!czyMilczy({ ostatniZnakMs: STAN.gpsOstatniZnakMs, terazMs: teraz, limitMs: LIMIT_MILCZENIA_GPS_MS })) return;
  const sekundy = Math.round((teraz - STAN.gpsOstatniZnakMs) / 1000);
  STAN.gpsProba += 1;
  wlaczGps(); // zatrzymuje starego watchera i zegar, zakłada świeże, resetuje licznik ciszy
  $('pozycja-status').textContent = komunikatMilczenia({ sekundy, proba: STAN.gpsProba });
}

/**
 * Uwaga terenowa 2026-09-16 (każdy przycisk): w trybie testowym przycisk
 * „Zlokalizuj mnie” odpala JEDEN jednorazowy sondaż lokalizacji.
 * `getCurrentPosition` ma te same opcje co watcher (ADR 0004 pkt 1), więc
 * nie zmieniamy polityki dokładności. Poprawny fix wchodzi przez zwykły lej
 * `przyjmijFix`, a błąd pokazujemy jawnie kodem P02/P03/P04 i zostawiamy
 * przycisk — w testach bez GPS dalej działa stuknięcie w mapę (D3).
 * Bramka trybu testowego jest tu na TWARDO (nie tylko przez klasę `tylko-test`
 * w CSS): poza trybem testowym przycisk nie istnieje jako ścieżka — żadnego
 * sondażu, żadnego napisu, żadnego ukrywania/pokazywania.
 */
function wyznaczPozycje() {
  if (!STAN.trybTestowy) return;
  const geo = navigator.geolocation;
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    status('Ta przeglądarka nie daje lokalizacji — ustaw pozycję stuknięciem mapy.');
    return;
  }
  $('przycisk-zlokalizuj').hidden = true;
  $('pozycja-status').textContent = 'Szukam satelitów…';
  geo.getCurrentPosition(
    (pozycja) => przyjmijFix(fixZPozycji(pozycja, performance.now(), ZRODLA_FIXA.gps)),
    (blad) => {
      const opis = bladGeolokalizacji(blad);
      pokazBledy('bledy-pozycja', [{ kod: opis.kod, pole: 'geolocation', komunikat: opis.komunikat }]);
      $('przycisk-zlokalizuj').hidden = false;
      $('pozycja-status').textContent = 'Tryb testowy: użyj oka i wskaż miejsce na mapie.';
      status('Nie ustaliłem położenia. W trybie testowym ustaw pozycję stuknięciem mapy.');
    },
    OPCJE_WATCH,
  );
}

/* ------------------------------------------------------------------ mapa */

/**
 * Zakłada mapy na ekranach „pozycja" i „stacje" (M2). Cała geometria, adresy
 * kafelków i gesty są w `mapa.js`; tu tylko wiązanie stanu aplikacji
 * z warstwami. Brak panelu w `index.html` nie wysypuje aplikacji —
 * `utworzMape` zwraca wtedy `null`.
 */
function utworzMapy() {
  const podklad = PODKLADY[STAN.konfig.podklad] ? STAN.konfig.podklad : DOMYSLNE.podklad;
  STAN.mapy.pozycja = utworzMape({ id: 'mapa-pozycja', podklad, zoom: 16 });
  STAN.mapy.stacje = utworzMape({ id: 'mapa-stacje', podklad, zoom: 16 });
  STAN.mapy.gra = utworzMape({ id: 'mapa-gra', podklad, zoom: 16 });
  // Zadanie właściciela D3: w trybie testowym krótkie stuknięcie mapy pozycji
  // ustawia pozycję — najszybsza droga „pinezki tam, gdzie się chce", bez
  // przepisywania współrzędnych. Bramka trybu i ekranu: stuknięcie w mapę
  // gry ani stacji NIE przestawia gracza.
  if (STAN.mapy.pozycja) {
    STAN.mapy.pozycja.ustawNasluchStukniecia((geo) => {
      if (!STAN.trybTestowy) return;
      przyjmijFix(fixZPozycji(geo, performance.now(), ZRODLA_FIXA.symulacja));
      status('Pozycja ustawiona z mapy.');
    });
  }
}

function kazdaMapa(fn) {
  for (const mapa of Object.values(STAN.mapy)) if (mapa) fn(mapa);
}

/**
 * Zoom, przy którym promień gry zajmuje ~40% szerokości panelu (`geo.js`).
 *
 * Sufit przybliżenia (1000 m, decyzja właściciela 2026-09-12) siedzi
 * w `dopasujZoomDoPromienia` — dzięki temu ten sam sufit dostaje KAŻDA ścieżka,
 * która dobiera widok do promienia: stuknięcie mapy w trybie testowym, pierwszy
 * fix GPS i przeliczenie stacji po Overpassie (wszystkie wołają
 * `centrujNaPozycji`).
 */
function zoomDlaPromienia(mapa, lat) {
  const szerokosc = Math.max(mapa.rozmiar().szerokosc, 240);
  const promienM = STAN.konfig.promienM;
  // Puste albo ręcznie zepsute pole promienia nie może wysypać widoku:
  // wracamy do kadru sufitu, nie do najgłębszego zoomu trybu (LESSONS L10 —
  // widełki nie chronią przed NaN, a `TRYBY.piesza.zoom` = 17 to dokładnie ten
  // zoom, na którym kafle OSM bywają puste; brak szerokości geograficznej
  // liczymy dla Polski, bo tylko tam gra ma sens).
  if (!(promienM > 0) || !Number.isFinite(lat)) {
    return dopasujZoomDoPromienia(PROMIEN_SUFITU_ZOOMU_M, szerokosc, Number.isFinite(lat) ? lat : 52);
  }
  return dopasujZoomDoPromienia(promienM, szerokosc, lat);
}

/**
 * Przenosi stan aplikacji na warstwy map: marker pozycji BEZ koła dokładności
 * (ADR 0034 pkt 2 — `accuracy` nie jedzie na mapę), okrąg promienia gry
 * i numerowane pinezki stacji. Wołane po każdym fixie,
 * po przeliczeniu stacji i po zmianie ustawień, które widać na mapie.
 */
function odswiezWarstwy() {
  const p = STAN.pozycja;
  const fix = p ? { lat: p.lat, lon: p.lon } : null;
  kazdaMapa((mapa) => mapa.pokazPozycje(fix));
  if (STAN.mapy.pozycja) STAN.mapy.pozycja.zaznaczStacje([], { promienM: STAN.konfig.promienM });
  if (STAN.mapy.stacje) {
    // trasa-sekret: przy generowaniu paczki dla Wspólnej Trasy mapa stacji
    // nie rysuje kropek — organizator nie może poznać trasy z góry
    STAN.mapy.stacje.zaznaczStacje(STAN.ukryjStacje ? [] : STAN.stacje, { promienM: STAN.konfig.promienM, aktywna: null });
  }
}

/** Wyśrodkowuje mapy na pozycji gracza w zoomie dobranym do promienia gry. */
function centrujNaPozycji() {
  const p = STAN.pozycja;
  if (!p) return;
  kazdaMapa((mapa) => mapa.ustawSrodek({ lat: p.lat, lon: p.lon, zoom: zoomDlaPromienia(mapa, p.lat) }));
}

/** Wymiary okna; zera, gdy okna nie ma (testy czystych modułów). */
function rozmiarOkna() {
  if (typeof window === 'undefined') return { szerokosc: 0, wysokosc: 0 };
  return { szerokosc: window.innerWidth ?? 0, wysokosc: window.innerHeight ?? 0 };
}

/**
 * Zdarzenie rozmiaru albo obrotu (ADR 0030 aneks 2026-09-13): nie działamy od
 * razu — telefon w trakcie animacji obrotu melduje kilka wymiarów pośrednich,
 * a `resize` bywa wcześniejszy niż nowy układ CSS.
 */
function naZmianeRozmiaruOkna() {
  clearTimeout(STAN.obrotOpoznienie);
  STAN.obrotOpoznienie = setTimeout(sprawdzObrotEkranu, OPOZNIENIE_OBROTU_MS);
}

/**
 * Obrót ekranu = „autokliknięcie" ◎ Centrowanie na widocznej mapie: dokładnie
 * ten kod, który uruchamia przycisk (`mapa.js` → `naPrzycisk('centruj')`), więc
 * kadr wraca na gracza w bieżącym przybliżeniu, na panelu o nowych wymiarach.
 * Zmiana rozmiaru BEZ obrotu (klawiatura, pasek przeglądarki, okno na desktopie)
 * widoku nie rusza — mapę prowadzi palec gracza (ADR 0011).
 */
function sprawdzObrotEkranu() {
  STAN.obrotOpoznienie = null;
  const po = kierunekEkranu(rozmiarOkna());
  if (!czyObrotEkranu({ przed: STAN.kierunekEkranu, po })) return;
  STAN.kierunekEkranu = po;
  const mapa = STAN.mapy[nazwaWidocznejMapy()];
  if (!mapa) return;
  mapa.odswiez(); // panel ma już nowe wymiary
  mapa.centrujNaPozycji(); // ◎ bez klikania: widok na gracza
}

/**
 * Panel schowany (`hidden`) ma rozmiar 0, więc nie ma czego rysować —
 * po pokazaniu ekranu widok trzeba przeliczyć od nowa.
 */
function odswiezMapeEkranu(nazwa) {
  const mapa = STAN.mapy[['prompt', 'paczka'].includes(nazwa) ? 'stacje' : nazwa] ?? STAN.mapy.pozycja;
  if (mapa) mapa.odswiez();
}

/**
 * Jedyny lej fixów do stanu: watcher GPS i symulacja trasy karmią aplikację
 * tym samym kodem, więc mapa i próg dojścia zachowują się identycznie
 * z GPS-em i bez niego (kryterium M3: gra bez GPS).
 */
function przyjmijFix(fix) {
  const ocena = ocenFix(fix);
  if (!ocena.akceptowany) {
    pokazBledy('bledy-pozycja', [{ kod: ocena.kod, pole: 'geolocation', komunikat: ocena.komunikat }]);
    return;
  }
  STAN.ostatniFix = fix;
  STAN.ocenaFixa = ocena;
  STAN.pozycja = { lat: fix.lat, lon: fix.lon };
  STAN.dokladnoscM = null; // pole wyłącznie zgodności zapisu, ADR 0034
  STAN.historiaFixow = dodajFix(STAN.historiaFixow, fix);
  pokazBledy('bledy-pozycja', ocena.kod ? [{ kod: ocena.kod, pole: 'geolocation', komunikat: ocena.komunikat }] : []);
  pokazPozycje();
  aktualizujGreNaFix(fix); // M6: ten sam lej co GPS i symulacja — gra widzi fixy identycznie
}

/* --------------------------------------------------- symulacja dojścia */

/** Odtwarzanie: jeden fix co tyle ms (tylko tryb testowy, ADR 0004 pkt 6). */
const SYMULACJA_KROK_MS = 120;
/** Próba dojścia: 250 m na azymucie 45°, 12 s „marszu", fix co 2 s + postój. */
const SYMULACJA = { czasMs: 12000, coMs: 2000, accuracyM: 12 };

/** Symulacja ustępuje grze: poza odcinkiem (dojście, ręczny koniec) nie
 *  odtwarzamy dalej i NIE nadpisujemy statusu gry (M6/R7 — fix „po tranzycji"
 *  czyścił historię i zamazywał „Stacja osiągnięta"). Poza grą (setup) warunek
 *  jest przezroczysty: `STAN.rozgrywka` wtedy nie istnieje. */
function symulacjaPrzestalaBycPotrzebna() {
  const r = STAN.rozgrywka;
  return Boolean(r) && (r.faza !== FAZY.odcinek || STAN.graZakonczonaRecznie);
}

/** Jeden fix symulacji: stan, mapa i zdanie o dystansie do celu. */
function krokSymulacji() {
  const s = STAN.symulacja;
  if (!s) return;
  if (symulacjaPrzestalaBycPotrzebna()) {
    zatrzymajSymulacje();
    return;
  }
  const fix = s.fixy[s.indeks];
  if (!fix) {
    zatrzymajSymulacje();
    status('Symulacja zakończona.');
    return;
  }
  s.indeks += 1;
  przyjmijFix(fix);
  if (symulacjaPrzestalaBycPotrzebna()) {
    zatrzymajSymulacje(); // ten fix domknął dojście — status gry zostaje
    return;
  }
  const stan = stanDojscia(STAN.historiaFixow, s.cel);
  status(stan.dotarl
    ? `Symulacja: cel osiągnięty — debounce dojścia spełniony (fix ${s.indeks}/${s.fixy.length}).`
    : `Symulacja: fix ${s.indeks}/${s.fixy.length}, do celu ${stan.dystansM} m (próg ${stan.progM} m, trafienia ${stan.trafienia}/${stan.wymagane}).`);
  if (s.indeks >= s.fixy.length) zatrzymajSymulacje();
}

function zatrzymajSymulacje() {
  if (!STAN.symulacja) return;
  clearInterval(STAN.symulacja.timer);
  STAN.symulacja = null;
}

/* ---------------------------------------------------------------- stacje */

function ziarno() {
  const data = new Date().toISOString().slice(0, 10);
  return `${ziarnoRozgrywki({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, liczbaStacji: STAN.konfig.liczbaStacji, data })}|${STAN.ziarnoOffset}`;
}

/* --- sieć drogowa (M4): cache, pobieranie z łańcuchem instancji, wybór --- */

/** Klucz cache sieci dla bieżącej pozycji, promienia i trybu (ADR 0010 pkt 1). */
function kluczSieci() {
  return kluczCacheSieci({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, tryb: STAN.konfig.tryb });
}

/**
 * Sieć z pamięci telefonu: najpierw klucz dokładny (`geohash6-R-tryb`),
 * a po pudle — skan tej samej komórki po wpis pokrywający (teren 2026-09-16:
 * inny setup w tej samej okolicy nie woła Overpass od nowa). Wpis dokładny
 * sprzed kotwic (bez `srodek`) działa jak dotąd — ufamy kluczowi.
 */
function odczytajCacheSieci({ klucz, srodek, promienM, tryb, terazMs }) {
  try {
    const surowy = localStorage.getItem(klucz);
    if (surowy) {
      const wpis = JSON.parse(surowy);
      const dane = wczytajDaneZCache(wpis, { terazMs });
      if (dane && (wpis.srodek === undefined || czyWpisPokrywa(wpis, { srodek, promienM }))) return dane;
    }
  } catch {
    /* zepsuty wpis dokładny — próbujemy jeszcze skanu */
  }
  const prefiks = `${klucz.split('-').slice(0, -2).join('-')}-`;
  const przyrostek = `-${tryb}`;
  const kandydaci = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === klucz || !k.startsWith(prefiks) || !k.endsWith(przyrostek)) continue;
      let wpis = null;
      try {
        wpis = JSON.parse(localStorage.getItem(k));
      } catch {
        /* śmieć w cache — pomiń, naprawi go następne pobranie */
      }
      kandydaci.push({ klucz: k, wpis });
    }
  } catch {
    return null; // pamięć niedostępna — gra pobierze sieć
  }
  return wybierzWpisSieci(kandydaci, { srodek, promienM, tryb, terazMs })?.dane ?? null;
}

function zapiszCacheSieci(klucz, dane, terazMs) {
  try {
    localStorage.setItem(klucz, JSON.stringify(zlozWpisSieci({
      dane,
      srodek: STAN.pozycja,
      promienM: STAN.konfig.promienM,
      tryb: STAN.konfig.tryb,
      terazMs,
    })));
    // LRU: ponad 2 MB cache sieci → najstarsze wpisy wypadają (ADR 0010 pkt 1)
    const wpisy = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('okolica:sieci:')) continue;
      const surowy = localStorage.getItem(k) ?? '';
      let zapisanoMs = 0;
      try { zapisanoMs = JSON.parse(surowy)?.zapisanoMs ?? 0; } catch { /* liczy się rozmiar */ }
      wpisy.push({ klucz: k, rozmiarBajtow: surowy.length, zapisanoMs });
    }
    for (const k of przycijCacheSieci(wpisy)) localStorage.removeItem(k);
  } catch {
    status(KODY_SIECI.S04); // brak miejsca — gramy dalej, następna gra pobierze sieć
  }
}

function ustawSiec(dane, { zCache, zrodlo = null, klucz }) {
  STAN.siec = { stan: 'gotowa', dane, klucz, trybGrafu: null, graf: null, kandydaci: null, zCache, zrodlo };
  const miejsce = nazwaMiejsca(dane);
  if (miejsce) {
    STAN.miejsce = miejsce;
    renderujMiejsce();
  }
}

/**
 * Wyświetlenie nazwy miejsca (zawsze pobierana z siecią dróg — ADR 0013 pkt 3;
 * warstwa zapasowa Nominatim usunięta 2026-09-11 decyzją właściciela).
 */
function renderujMiejsce() {
  const pole = $('pozycja-miejsce');
  if (!STAN.miejsce) {
    pole.textContent = 'nazwa miejsca: brak — pobierana z siecią dróg na ekranie stacji';
    return;
  }
  pole.textContent = `miejsce: ${STAN.miejsce}`;
}

/** Graf i kandydaci dla bieżącego trybu — przebudowa tylko przy zmianie trybu. */
function grafDlaTrybu(tryb) {
  const siec = STAN.siec;
  if (siec.stan !== 'gotowa') return false;
  if (siec.trybGrafu === tryb && siec.graf) return true;
  try {
    siec.graf = budujGraf(siec.dane, { tryb });
    siec.kandydaci = kandydaciNaStacje(siec.dane, siec.graf, { tryb }).kandydaci;
    siec.trybGrafu = tryb;
    return true;
  } catch (blad) {
    pokazBledy('bledy-stacje', [{
      kod: blad?.kod ?? 'S09',
      pole: 'siec',
      komunikat: blad?.komunikat ?? KODY_SIECI[blad?.kod] ?? 'Sieć drogowa nie nadaje się dla tego trybu.',
    }]);
    return false;
  }
}

const KLUCZ_SPRAWNEJ_INSTANCJI = 'okolica:overpass-sprawny';

/** Adres instancji, która dowiozła ostatnio — albo null (kolejność domyślna). */
function czytajSprawnaInstancje() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(KLUCZ_SPRAWNEJ_INSTANCJI);
  } catch {
    return null;
  }
}

function zapiszSprawnaInstancje(url) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KLUCZ_SPRAWNEJ_INSTANCJI, url);
  } catch {
    /* brak pamięci — następna gra zacznie od FOSSGIS jak dawniej */
  }
}

/** Limit całej próby (nagłówki i ciało) — per-instancja: główna krótki, backup długi. */
async function pobierzTekstSieci(f, url, zapytanie, limitMs) {
  const kontroler = new AbortController();
  let timer;
  let uplynalCzas = false;
  const limitSec = Math.round(limitMs / 1000);
  try {
    const limit = new Promise((_, odrzuc) => {
      timer = setTimeout(() => {
        uplynalCzas = true;
        kontroler.abort();
        odrzuc(Object.assign(new Error(`Przekroczono czas oczekiwania ${limitSec} s`), { timeout: true }));
      }, limitMs);
    });
    return await Promise.race([limit, (async () => {
      const odpowiedz = await f(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(zapytanie)}`,
        signal: kontroler.signal,
      });
      if (!odpowiedz.ok) throw Object.assign(new Error(`HTTP ${odpowiedz.status}`), { status: odpowiedz.status });
      return await odpowiedz.text();
    })()]);
  } catch (blad) {
    // Nie zależymy od nazwy/tekstu błędu zwróconego przez przeglądarkę.
    if (uplynalCzas || kontroler.signal.aborted) {
      throw Object.assign(new Error(`Przekroczono czas oczekiwania ${limitSec} s`), { timeout: true });
    }
    throw blad;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cache L2: wspólna sieć z Drive (teren 2026-09-16 — telefon nie zawsze
 * pamięta okolicę, a Overpass nie musi wołać dwa razy o to samo). Zwraca dane
 * albo null (brak mostu, brak wpisu, awaria — po cichu, bo L2 jest
 * przyspieszeniem, nie obietnicą; ostateczna jest ścieżka Overpass).
 * Trafienie dokarmia też L1, żeby następna gra nie pytała nawet mostu.
 */
async function sprobujPobracSiecZDysku() {
  const url = adresMostu();
  if (!url) return null;
  const terazMs = Date.now();
  let odpowiedz;
  try {
    odpowiedz = await pobierzGetMulti(urlGet(url, 'siec', {
      lat: STAN.pozycja.lat,
      lon: STAN.pozycja.lon,
      promienM: STAN.konfig.promienM,
      tryb: STAN.konfig.tryb,
    }));
  } catch {
    return null; // most nie odpowiada — gra jedzie do Overpass
  }
  const wpis = odpowiedz?.wpis;
  if (odpowiedz?.ok !== true || !wczytajDaneZCache(wpis, { terazMs })) return null;
  if (wpis.tryb !== STAN.konfig.tryb) return null;
  if (!czyWpisPokrywa(wpis, { srodek: STAN.pozycja, promienM: STAN.konfig.promienM })) return null;
  ustawSiec(wpis.dane, { zCache: true, zrodlo: 'dysk', klucz: kluczSieci() });
  zapiszCacheSieci(kluczSieci(), wpis.dane, terazMs);
  return wpis.dane;
}

/**
 * Świeże pobranie Overpass trafia też na wspólny Drive (cache L2) — w tle,
 * bez czekania gry. Niepowodzenie nie boli: L1 już zapisany, a L2 dojedzie
 * przy następnym świeżym pobraniu.
 */
async function zapiszSiecNaDysk() {
  const url = adresMostu();
  const f = fetchPrzegladarki();
  if (!url || !f || !STAN.siec.dane) return;
  const wpis = zlozWpisSieci({
    dane: STAN.siec.dane,
    srodek: STAN.pozycja,
    promienM: STAN.konfig.promienM,
    tryb: STAN.konfig.tryb,
    terazMs: Date.now(),
  });
  if (JSON.stringify(wpis).length > 6_000_000) return; // most by odmówił — szkoda radia
  try {
    await Promise.race([
      polecenieMostu(url, { akcja: 'siec-zapisz', wpis }, { fetchImpl: f }),
      new Promise((_, odrzuc) => setTimeout(() => odrzuc(new Error('limit wysyłki L2')), LIMIT_MOSTU_MS)),
    ]);
  } catch {
    /* cache L2 jest przyspieszeniem — jego awaria nie jest błędem gry */
  }
}

/** Sekwencyjnie: ostatnia sprawna najpierw, 10 s na próbę; wyniki w Informacjach. */
async function pobierzSiec(terazMs) {
  const f = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (!f) return false;
  const zapytanie = budujZapytanieOverpass({
    srodek: STAN.pozycja, promienM: STAN.konfig.promienM, tryb: STAN.konfig.tryb,
  });
  const lancuch = kolejnoscInstancji(czytajSprawnaInstancje());
  const lista = $('siec-proby');
  lista.textContent = '';
  lista.hidden = false;
  for (let i = 0; i < lancuch.length; i++) {
    const instancja = lancuch[i];
    const limitMs = timeoutInstancji(instancja);
    const limitSek = Math.round(limitMs / 1000);
    const wpis = document.createElement('li');
    const prefiks = `Próba ${i + 1}/${lancuch.length}: ${instancja.nazwa}`;
    wpis.textContent = `${prefiks} — pobieram (limit ${limitSek} s)…`;
    lista.appendChild(wpis);
    status(wpis.textContent);
    try {
      const tekst = await pobierzTekstSieci(f, instancja.url, zapytanie, limitMs);
      const sparsowane = parsujOdpowiedz(JSON.parse(tekst));
      const dane = upraszczajDaneDoCache(sparsowane);
      const miesciSie = tekst.length <= 8_000_000;
      if (miesciSie) zapiszCacheSieci(kluczSieci(), dane, terazMs);
      else status(KODY_SIECI.S04);
      ustawSiec(dane, { zCache: false, klucz: kluczSieci() });
      // PO ustawSiec: wysyłka czyta STAN.siec.dane (w tle, bez czekania gry)
      if (miesciSie) void zapiszSiecNaDysk();
      zapiszSprawnaInstancje(instancja.url);
      wpis.textContent = `${prefiks} — pobrano sieć dróg.`;
      return true;
    } catch (blad) {
      const timeout = blad?.timeout === true || blad?.name === 'AbortError';
      const limitSekBledu = Math.round(limitMs / 1000);
      const opis = timeout ? `przekroczono czas oczekiwania ${limitSekBledu} s`
        : blad?.status ? `HTTP ${blad.status}`
        : blad?.name === 'SyntaxError' ? 'niepoprawna odpowiedź serwera'
        : (blad?.komunikat ?? blad?.message ?? 'błąd połączenia');
      wpis.textContent = `${prefiks} — ${opis}.`;
      const przelacz = i < lancuch.length - 1 && czyPrzelaczycInstancje({
        status: blad?.status ?? null, timeout,
        bladSieci: ['TypeError', 'NetworkError', 'SyntaxError'].includes(blad?.name) || blad?.kod === 'S01',
      });
      if (przelacz) {
        const pauza = [406, 429].includes(blad?.status) || blad?.status >= 500;
        status(`${wpis.textContent} Próbuję kolejną instancję.`);
        if (pauza) await new Promise(r => setTimeout(r, STAN.odstepOverpassMs));
        continue;
      }
      pokazBledy('bledy-stacje', [{
        kod: blad?.kod ?? 'S03', pole: 'siec',
        komunikat: 'Nie udało się pobrać sieci dróg. Szczegóły w ⓘ Informacje. Spróbuj ponownie lub użyj trybu uproszczonego.',
      }]);
      return false;
    }
  }
  return false;
}

/** Wspólny koniec każdej ścieżki: wybór stacji z tego, co jest, i render. */
function przeliczZTegoCoJest() {
  const uzyjSieci = STAN.siec.stan === 'gotowa' && grafDlaTrybu(STAN.konfig.tryb);
  if (uzyjSieci) {
    try {
      const wynik = wybierzStacje({
        graf: STAN.siec.graf,
        kandydaci: STAN.siec.kandydaci,
        srodek: STAN.pozycja,
        konfig: STAN.konfig,
        ziarno: ziarno(),
      });
      STAN.stacje = wynik.stacje;
      STAN.wynikSieci = wynik;
      // Sieć bywa za uboga na zamówioną liczbę stacji (S12): wybrane stacje SĄ
      // wtedy składem gry, więc konfiguracja IDZIE ZA NIMI. Bez tego setup mówił
      // „5", mapa pokazywała 4, a budowa promptu stawała na WE06 (właściciel,
      // 2026-09-07). Paczka i gra wieloosobowa też porównują te dwie liczby.
      const zamowione = STAN.konfig.liczbaStacji;
      if (wynik.stacje.length !== zamowione) {
        STAN.konfig.liczbaStacji = wynik.stacje.length;
        $('setup-stacje').value = String(wynik.stacje.length);
        przeliczPromienZCzasu(); // mniej stacji = dłuższy odcinek na ten sam czas (ADR 0025)
      }
      // m12-119 (audyt D3): jedna funkcja składa kartę w obu gałęziach —
      // niekomplet dokłada bogaty S12 z poradą, ale nie ukrywa S14 bramy
      // wejścia (wcześniej gałąź niekompletu pokazywała wyłącznie S12).
      pokazBledy('bledy-stacje', zlozKarteUsterekStacji(wynik, {
        zamowione,
        komunikatS12: `Sieć drogowa w tej okolicy nie dała ${zamowione} stacji w wymaganych odstępach — jest ich ${wynik.stacje.length} i tyle będzie w grze (setup zmieniony na ${wynik.stacje.length}). Chcesz ${zamowione}? Zwiększ czas gry, żeby powiększyć promień, albo zmień okolicę.`,
      }));
      renderujStacje();
      odswiezWarstwy();
      centrujNaPozycji();
      // Brama wejścia (zgłoszenie właściciela 2026-09-14, „m117"): gdy sieć nie
      // dała układu bez mijania, mówimy o tym wprost (S14) — bez udawania, że
      // trasa jest czysta. Gdy dała, a brama coś odrzuciła, mówimy ile.
      const mijaneWejscia = wynik.wejscie?.mijane?.length ?? 0;
      const odrzuconeWejscia = wynik.wejscie?.odrzucone?.length ?? 0;
      status(mijaneWejscia
        ? 'Trasa od startu do stacji 1 mija inną stację (kod S14) — w tej okolicy sieć dróg nie dała układu bez mijania.'
          + ' Zwiększ czas gry albo zmień okolicę.'
        : (wynik.usterki.length
          ? `Sieć jest za uboga na ${zamowione} stacji — w grze będzie ${wynik.stacje.length} (kod S12). Zwiększ czas gry albo zmień okolicę, jeśli chcesz komplet.`
          : `Stacje z sieci drogowej: ${wynik.stacje.length} punktów osiągalnych w promieniu ${STAN.konfig.promienM} m.`
            + (odrzuconeWejscia
              ? ` Wejście bez mijania: odrzucono ${odrzuconeWejscia} ${odmianaRzeczownika(odrzuconeWejscia, ['pin', 'piny', 'pinów'])},`
                + ` obok ${odrzuconeWejscia === 1 ? 'którego' : 'których'} prowadziła trasa do stacji 1.`
              : '')));
      return;
    } catch (blad) {
      pokazBledy('bledy-stacje', [{
        kod: blad?.kod ?? 'S12',
        pole: 'siec',
        komunikat: blad?.komunikat ?? 'Nie udało się wybrać stacji z sieci drogowej.',
      }]);
    }
  }
  // degradacja (ADR 0005 pkt 8): pierścień z jawnym ostrzeżeniem
  STAN.stacje = stacjeProste({
    srodek: STAN.pozycja,
    liczbaStacji: STAN.konfig.liczbaStacji,
    promienM: STAN.konfig.promienM,
    ziarno: ziarno(),
    offsetObrotu: STAN.obrot,
  });
  STAN.wynikSieci = null;
  renderujStacje();
  odswiezWarstwy();
  centrujNaPozycji();
}

let trwaPobieranieSieci = false;

async function przeliczStacjeZPobraniem(klucz) {
  if (trwaPobieranieSieci) return;
  trwaPobieranieSieci = true;
  $('przycisk-przelicz').disabled = true;
  const ladowanieSieci = $('stacje-ladowanie');
  ladowanieSieci.hidden = false;
  ladowanieSieci.classList.add('pulsuje'); // sygnał czekania (właściciel 2026-09-13)
  try {
    const zDysku = await sprobujPobracSiecZDysku();
    const ok = zDysku !== null || await pobierzSiec(Date.now());
    if (!ok && STAN.siec.stan !== 'gotowa') {
      status('Sieć drogowa niedostępna — stacje w trybie uproszczonym (pierścień): osiągalność niezweryfikowana. Sprawdź połączenie z internetem.');
    }
    przeliczZTegoCoJest();
  } finally {
    trwaPobieranieSieci = false;
    $('przycisk-przelicz').disabled = false;
    $('stacje-ladowanie').hidden = true;
    $('stacje-ladowanie').classList.remove('pulsuje');
  }
}

/**
 * Reset przewijania warstwy stacji (UX właściciela, m12-120): przyciski
 * „Inny układ" i „Pobierz sieć ponownie" stoją pod długą listą, więc po
 * kliknięciu warstwa ma wrócić na górę. Przewija się sama karta
 * `.panel-centralny` (overflow-y: auto), nie strona.
 */
function przewinWarstweStacjiNaGore() {
  const warstwa = document.getElementById('ekran-stacje');
  if (warstwa) warstwa.scrollTop = 0;
}

/**
 * Wejście na ekran stacji i „Inny układ": najpierw cache (druga gra w tej
 * samej okolicy nie woła Overpass wcale), potem — tylko gdy jest `fetch`
 * i sieć jest potrzebna — pobranie asynchroniczne. Bez `fetch` (atrapy,
 * offline) wszystko zostaje SYNCHRONICZNE, więc testy i tryb testowy nie
 * czekają na sieć, która nie istnieje.
 */
function przeliczStacje() {
  $('siec-proby').textContent = '';
  $('siec-proby').hidden = true;
  pokazBledy('bledy-stacje', []); // błędy POPRZEDNIEJ próby gasną; nowa próba pokaże własne
  const klucz = kluczSieci();
  if (STAN.siec.stan !== 'gotowa' || STAN.siec.klucz !== klucz) {
    const zCache = odczytajCacheSieci({
      klucz,
      srodek: STAN.pozycja,
      promienM: STAN.konfig.promienM,
      tryb: STAN.konfig.tryb,
      terazMs: Date.now(),
    });
    if (zCache) {
      ustawSiec(zCache, { zCache: true, zrodlo: 'telefon', klucz });
    } else if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      przeliczStacjeZPobraniem(klucz);
      return;
    }
  }
  przeliczZTegoCoJest();
}

function renderujStacje() {
  const sieciowe = Boolean(STAN.wynikSieci);
  if (STAN.ukryjStacje) {
    // Wspólna Trasa = trasa-sekret (właściciel, 2026-09-11): organizator
    // generujący paczkę nie widzi nazw miejsc ani współrzędnych — tylko
    // status, że stacje powstały (kropki na mapie chowa `odswiezWarstwy`).
    // Komunikat mówi, czy stacje ZLOKALIZOWANO na sieci dróg (właściciel,
    // pierwotny pomysł multi: „wygenerowano i zlokalizowano/nie zlokalizowano
    // X stacji"). Pierścień jest układem zastępczym — jego osiągalność nie
    // jest zweryfikowana, więc organizator ma to wiedzieć ZANIM wyjdzie.
    $('stacje-podsumowanie').textContent = sieciowe
      ? `Wygenerowano i zlokalizowano stacji: ${STAN.stacje.length}. Nazwy i położenie są ukryte — trasa odsłania się w czasie gry, po jednej stacji.`
      : `Wygenerowano stacji: ${STAN.stacje.length}, ale NIE zlokalizowano ich na sieci dróg (układ pierścieniowy, osiągalność niezweryfikowana). Nazwy i położenie są ukryte — trasa odsłania się w czasie gry, po jednej stacji.`;
    $('stacje-tryb').textContent = 'Tryb tajnej trasy: mapa i lista nie pokazują stacji.';
    // „Inny układ" też odsłania stacje (nowy układ = inne punkty do zgadnięcia),
    // a właściciel w tajnej trasie tej opcji nie chce wcale.
    $('przycisk-przelicz').hidden = true;
    $('przycisk-siec-ponow').hidden = STAN.siec.stan === 'gotowa';
    return;
  }
  // Właściciel 2026-09-15 (uwaga 5): spisu stacji NIE MA. Organizator widzi
  // jedno zdanie, a położenie pokazują pinezki na mapie. Nazwy z OSM i
  // współrzędne nie wchodzą tu wcale do DOM — nie ma nośnika wstrzyknięcia
  // (LESSONS L19), bo zdanie jest budowane z liczby stacji.
  // Przy układzie pierścieniowym zdanie NIE mówi „zlokalizowano", bo przy
  // braku sieci dróg byłoby to nieprawdą (LESSONS L6); dlaczego stacje są
  // tylko w pierścieniu, mówi `#stacje-tryb` tuż pod spodem.
  $('stacje-podsumowanie').textContent = sieciowe
    ? `Wygenerowano i zlokalizowano ${STAN.stacje.length} stacji.`
    : `Wygenerowano ${STAN.stacje.length} stacji.`;
  if (sieciowe) {
    const miejsce = STAN.miejsce ? ` · miejsce: ${STAN.miejsce}` : '';
    const cache = !STAN.siec.zCache ? ''
      : STAN.siec.zrodlo === 'dysk' ? ' (ze wspólnego dysku — Overpass nie został wywołany)'
      : ' (z pamięci telefonu — Overpass nie został wywołany)';
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.siec}${cache}${miejsce}.`;
    // Sieć z cache (telefon pamięta okolicę) daje ponowienie — świeże pobranie
    // omija cache; przy danych sprzed chwili przycisk nie ma sensu.
    $('przycisk-siec-ponow').hidden = !STAN.siec.zCache;
  } else {
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.pierscien}. Stacje z sieci dróg, placów i szlaków pojawią się po pobraniu danych Overpass — wymaga połączenia z internetem.` + ADR(' (ADR 0005)');
    $('przycisk-przelicz').hidden = false; // poza tajną trasą „Inny układ" jest dostępny
    $('przycisk-siec-ponow').hidden = STAN.siec.stan === 'gotowa';
  }
}

/* --------------------------------------------------------- M6: ekran gry */

/**
 * Zegar gry: `performance.now()`. Logika rozgrywki nie czyta zegara (ADR 0004
 * pkt 3) — wszystkie `czasMs` pochodzą z tej warstwy. Pauz NIE MA (właściciel
 * 2026-09-13, uwaga B; ADR 0040 pkt 1): zegar tyka także w tle. Jedyna korekta
 * to przerwa po 15 minutach bezczynności (pkt 5) — kwadrans bez żadnego kliku
 * nie jest graniem, więc zdejmujemy ją ze wskazań. Zegar NIE punktuje.
 */
function zegarGry() {
  const teraz = performance.now();
  const wTrakciePrzerwy = STAN.przerwaBezczynnosci && STAN.przerwaStartMs > 0 ? teraz - STAN.przerwaStartMs : 0;
  return teraz - (STAN.przerwaSkumulowanaMs + wTrakciePrzerwy);
}

/**
 * Fix w trakcie gry (M6): dystans na żywo do bieżącej stacji i rozstrzygnięcie
 * dojścia przez `stanDojscia` (próg + dwa kolejne trafienia, ADR 0004 pkt 2).
 * Działa identycznie z GPS-em i z symulacją, bo oba strumienie wchodzą jednym
 * lejem `przyjmijFix`.
 */
function aktualizujGreNaFix(fix) {
  const r = STAN.rozgrywka;
  if (!r || r.faza === FAZY.koniec || STAN.ekran !== 'gra') return;
  if (!STAN.pozycja) return;
  // 2026-09-14 F: Wyścig — wykrywa dotarcie do DOWOLNEJ niezaliczonej stacji, bez wyboru
  const jestWyscig = STAN.multi?.gra?.tryb === TRYBY_GRY.wyscig;
  if (jestWyscig) {
    odswiezPasekDrogi();
    if (r.faza !== FAZY.odcinek) return;
    // 2026-09-14 F fix: w wyścigu biezaca jest w-trakcie, a stacjeDoWyboru zwraca tylko oczekuje
    // — do detekcji dowolnej niezaliczonej bierzemy wszystkie nie-zakonczone
    const nieZaliczoneIds = r.odcinki
      ? r.odcinki.filter(o => o.stan !== 'zakonczony').map(o => o.stacja)
      : stacjeDoWyboru(r);
    for (const sid of nieZaliczoneIds) {
      const st = r.stacje.find(s => Number(s.id) === Number(sid));
      if (!st) continue;
      const d = stanDojscia(STAN.historiaFixow, st);
      if (d.dotarl) {
        if (r.biezacaStacja !== sid) {
          const skier = skierujDoStacji(r, { stacjaId: sid, czasMs: zegarGry() });
          if (skier.usterki.length === 0) {
            STAN.rozgrywka = skier.stan;
            const start = startOdcinka(STAN.rozgrywka, { stacjaId: sid, czasMs: zegarGry() });
            if (start.usterki.length === 0) STAN.rozgrywka = start.stan;
          }
        }
        zakonczOdcinekGry(TRYBY_DOJSCIA.gps, fix);
        return;
      }
    }
    if (nieZaliczoneIds.length) {
      let naj = null; let minD = Infinity;
      for (const sid of nieZaliczoneIds) {
        const st = r.stacje.find(s => Number(s.id) === Number(sid));
        if (!st) continue;
        const d = Math.round(odlegloscM(STAN.pozycja, st));
        if (d < minD) { minD = d; naj = st; }
      }
      if (naj) {
        $('gra-dystans').textContent = `${minD} m`;
        $('gra-dystans-odcinka').textContent = `${minD} m do stacji ${naj.id}`;
      }
    }
    return;
  }
  // tryb trasa / hotseat — dotychczasowa logika (jedna bieżąca stacja)
  const pod = podglad(r);
  if (!pod.stacja) return;
  const dystans = Math.round(odlegloscM(STAN.pozycja, pod.stacja));
  $('gra-dystans').textContent = `${dystans} m`;
  odswiezPasekDrogi();
  if (r.faza !== FAZY.odcinek) return;
  const d = stanDojscia(STAN.historiaFixow, pod.stacja);
  $('gra-dystans-odcinka').textContent = d.dystansM == null ? '— m' : `${Math.round(d.dystansM)} m do stacji ${pod.stacja.id}`;
  if (d.kod) {
    $('gra-komunikat').textContent = d.komunikat;
    status(d.komunikat);
    return;
  }
  if (d.dotarl) zakonczOdcinekGry(TRYBY_DOJSCIA.gps, fix);
}

/**
 * W drodze mapa + pojedynczy pasek i NIC ponadto. Właściciel 2026-09-13 (uwagi
 * E i F, ADR 0036 aneks; potem H1 i I, ADR 0043): Informacje nie dostają ani
 * sterowania, ani węzła zakończenia gry — boks z dystansem i wznawianiem zniknął
 * z systemem pauzy (ADR 0040), a „■ Zakończ grę" wyprowadził się z Informacji
 * do warstwy za ikoną ⚙ START GRY. Panel gry chowamy, żeby pasek był jedynym
 * elementem nad mapą.
 */
/**
 * Numer stacji na trasie (zgłoszenia terenowe N i R, 2026-09-13).
 *
 * Powrót do gry sieciowej buduje rozgrywkę z NIEZAMKNIĘTYCH stacji
 * (`uruchomGreMulti`): gracz, który zamknął stację 1 i idzie do stacji 2,
 * dostawał po odświeżeniu telefonu numer 1 — a numer na trasie ma być stały.
 * Numer niesie więc sama stacja (`numer`, ustawia gra sieciowa), a gdy go nie
 * ma, zostaje zwykły indeks: hot-seat ma listę pełną, więc nic się nie zmienia.
 */
function numerStacjiTrasy(stan, idStacji) {
  const naLiscie = stan.stacje.findIndex((s) => Number(s.id) === Number(idStacji));
  const zTrasy = STAN.stacje.find((s) => Number(s.id) === Number(idStacji));
  const numer = Number(zTrasy?.numer);
  return Number.isFinite(numer) && numer > 0 ? numer : naLiscie + 1;
}

/** Długość trasy do napisów „stacja X z Y": pełna trasa, gdy gra sieciowa ją skróciła. */
function liczbaStacjiTrasy(stan) {
  const pelna = Number(STAN.trasaDlugosc);
  return Number.isFinite(pelna) && pelna > 0 ? pelna : stan.stacje.length;
}

function odswiezPasekDrogi() {
  const r = STAN.rozgrywka;
  if (!r) return;
  const droga = !$('gra-panel-odcinek').hidden;
  $('gra-sterowanie').hidden = droga && !STAN.trybTestowy;
  $('gra-pasek').hidden = !droga;
  const pod = podglad(r);
  const imie = pod.gracz?.imie ?? '—';
  const pasek = $('gra-pasek');
  // 2026-09-14 F: Wyścig — pasek dolny „Jacek. Stacja 3/5” zamiast dystansu
  const jestWyscig = STAN.multi?.gra?.tryb === TRYBY_GRY.wyscig;
  if (jestWyscig) {
    const zaliczone = pod.zaliczoneStacje;
    const total = liczbaStacjiTrasy(r);
    const biezacyNumer = Math.min(total, zaliczone + 1);
    pasek.textContent = `${imie}. Stacja ${biezacyNumer}/${total}`;
    if (STAN.bylPasekDrogi && !droga && !$('gra-panel-pytanie').hidden) zamknijInformacje();
    STAN.bylPasekDrogi = droga;
    odswiezWidocznoscPaneli();
    return;
  }
  const dystans = STAN.pozycja && pod.stacja ? Math.round(odlegloscM(STAN.pozycja, pod.stacja)) : '—';
  const numer = numerStacjiTrasy(r, r.biezacaStacja);
  pasek.replaceChildren(`Kto: ${imie} `);
  const pigulka = document.createElement('span');
  pigulka.className = 'pasek-dystans';
  pigulka.textContent = `(odległość od stacji ${dystans} m)`;
  pasek.append(pigulka, ` · stacja ${numer} z ${liczbaStacjiTrasy(r)}`);
  if (STAN.bylPasekDrogi && !droga && !$('gra-panel-pytanie').hidden) zamknijInformacje();
  STAN.bylPasekDrogi = droga;
  odswiezWidocznoscPaneli();
}

/**
 * Render faz ekranu gry: badge'y zawsze; panele tylko przy `panele: true`.
 * Po odpowiedzi model bywa już w następnej fazie, ale gracz musi NAJPIERW
 * przeczytać ocenę, wyjaśnienie i źródła — przełączanie paneli czeka wtedy
 * na „Następna stacja" (plan M6/R5).
 */
function renderujGre({ panele = true } = {}) {
  const r = STAN.rozgrywka;
  if (!r) return;
  const pod = podglad(r);
  const numer = numerStacjiTrasy(r, r.biezacaStacja);

  $('gra-kolejka').textContent = pod.gracz ? `Kolej: ${pod.gracz.imie}` : 'Kolej: —';
  $('gra-postep').textContent = r.faza === FAZY.koniec
    ? `zaliczone: ${pod.zaliczoneStacje} · pominięte: ${pod.pominietaStacje} · z ${r.stacje.length}`
    : `stacja ${numer} z ${liczbaStacjiTrasy(r)}`;
  if (STAN.pozycja && pod.stacja) {
    $('gra-dystans').textContent = `${Math.round(odlegloscM(STAN.pozycja, pod.stacja))} m`;
  } else {
    $('gra-dystans').textContent = '— m';
  }

  if (panele) {
    const koniec = r.faza === FAZY.koniec || STAN.graZakonczonaRecznie;
    // Właściciel 2026-09-11 (preview, „niechciany layer"): pauza — zwykle
    // AUTOMATYCZNA po zwinięciu karty/okna (visibilitychange) — woła ten
    // render i wstawiała panel oczekiwania ponad oceną odpowiedzi, którą
    // gracz właśnie czyta. Dopóki trwa pokaz oceny (M6/R5), panele się NIE
    // przełączają; domyka je dopiero „Następna stacja" (patrz nastepnaStacja).
    // Wyjątek: RĘCZNE zakończenie gry — wynik „teraz" jest ważniejszy niż
    // dokończenie czytania oceny (naturalny koniec z odpowiedzi czeka
    // z oceną na „🏁 Zobacz wynik", bo to jeszcze część tej samej odpowiedzi).
    const pokazOceny = !STAN.graZakonczonaRecznie
      && !$('gra-panel-pytanie').hidden && !$('gra-wynik-odpowiedzi').hidden;
    if (!pokazOceny) {
      // Właściciel 2026-09-11 (uwagi terenowe #2): w fazie pytania ekran ma być
      // czysty — pytanie, odpowiedzi i wynik. Nagłówek „Gra”, badge'y i przycisk
      // „Zakończ grę” nie jest wtedy potrzebny.
      // Zgłoszenie właściciela 2026-09-12 (D a): na ekranie wyników slot
      // sterowania („Gra”, badge'y kolejki/dystansu, „Zakończ grę”) znika CAŁY —
      // nad wynikami zostawały resztki stanu gry.
      $('gra-slot-sterowanie').hidden = r.faza === FAZY.pytanie || koniec;
      $('gra-panel-oczekuje').hidden = koniec || r.faza !== FAZY.przygotowanie;
      $('gra-panel-odcinek').hidden = koniec || r.faza !== FAZY.odcinek;
      $('gra-panel-pytanie').hidden = koniec || r.faza !== FAZY.pytanie;
      $('gra-panel-koniec').hidden = !koniec;
      if (koniec) pokazWyniki();
    }
  }

  if (panele && r.faza === FAZY.przygotowanie && pod.stacja) {
    $('gra-kto-idzie').textContent = pod.gracz ? `Idzie: ${pod.gracz.imie} → stacja ${numer}` : `Stacja ${numer}`;
    $('gra-cel-stacji').textContent = `${pod.stacja.opis || 'Cel bez opisu'} · ${formatujWspolrzedne(pod.stacja.lat, pod.stacja.lon)} · ${Math.round(pod.dystansM)} m ${pod.dystansSieciowy ? 'drogą' : 'w linii prostej'} od poprzedniego punktu`;
    $('przycisk-start-odcinka').textContent = `▶ Idę do stacji ${numer}`;
  }

  if (panele) {
    // Cudza tura w trakcie czytania wyjaśnienia zmienia sens przycisku „dalej" —
    // musi przestać obiecywać start odcinka.
    const dalej = $('przycisk-nastepna-stacja');
    if (!dalej.hidden && r.faza !== FAZY.koniec) dalej.textContent = etykietaPrzyciskuDalej(r);
    $('przycisk-symulacja-gra').hidden = !(STAN.trybTestowy && r.faza === FAZY.odcinek);
  }

  if (STAN.mapy.gra) {
    // Wspólna Trasa to trasa-sekret (właściciel, 2026-09-11): na mapie widać
    // TYLKO bieżącą stację — kolejne odsłaniają się po zamknięciu poprzedniej.
    // Sekret jest własnością ŻYWEJ gry sieciowej (`czyTrasaSekret`): resztkowy
    // kontekst multi po grze zamkniętej nie chowa już trasy w hot-seacie
    // (zgłoszenie terenowe R, 2026-09-13).
    // 2026-09-14 G: zaliczone stacje inny kolor — oznaczamy na podstawie odcinków
    const graSekret = czyTrasaSekret(STAN.multi);
    // `odcinki` jest tablicą — ids bierzemy z `o.stacja`, nie z indeksu
    // (uwaga G, 2026-09-14: Object.entries dawał 0,1,2… zamiast id stacji).
    const zamkniete = new Set(zaliczoneStacjeIds(r).map(Number));
    let stacjeWidoczne = graSekret
      ? STAN.stacje.filter((s) => Number(s.id) === Number(r.biezacaStacja))
      : STAN.stacje;
    // Dla G: w wyścigu pokazujemy wszystkie, w trasie-sekret też pokazujemy zaliczone + bieżącą
    if (graSekret) {
      const zaliczoneWidoczne = STAN.stacje.filter((s) => zamkniete.has(Number(s.id)));
      // połącz bez duplikatów: zaliczone + bieżąca
      const mapaIds = new Map();
      for (const s of zaliczoneWidoczne) mapaIds.set(Number(s.id), s);
      for (const s of stacjeWidoczne) mapaIds.set(Number(s.id), s);
      stacjeWidoczne = [...mapaIds.values()];
    }
    const stacjeZFlagami = stacjeWidoczne.map((s) => ({
      ...s,
      zaliczona: zamkniete.has(Number(s.id)),
    }));
    // Uwaga D (2026-09-14): w Wyścigu NA Orientację gracz sam wybiera stacje,
    // więc żadna nie jest „bieżącą” — a jednak mapa podświetlała stację nr 1
    // (`biezacaStacja` po starcie = pierwsza z listy). Inny kolor mają TYLKO
    // stacje zamknięte przez TEGO gracza (`pinezka-zaliczona` wyżej). W
    // Wspólnej Trasie kolejność narzuca trasa, więc wyróżnienie bieżącej
    // stacji zostaje.
    const trybWyscigu = STAN.multi?.gra?.tryb === TRYBY_GRY.wyscig;
    STAN.mapy.gra.zaznaczStacje(stacjeZFlagami, { promienM: STAN.konfig.promienM, aktywna: trybWyscigu ? null : r.biezacaStacja });
  }
  odswiezPasekDrogi();
  odswiezWakeLock(); // ADR 0040 pkt 4: ekran nie gaśnie, dopóki gra trwa
  // ADR 0044 (uwaga F): panelu multi nie ma — gra wygląda jak hotseat. Z gry
  // sieciowej w panelu fazy A zostaje JEDNO: wybór stacji w Wyścigu.
  if (STAN.multi) renderujWyborStacji();
  renderujInformacjeMulti(); // panel Informacje żyje z każdym zdarzeniem gry
  renderujInformacjeHotseat(); // blok hot-seat tylko w trakcie gry — znika przy końcu
}

/* ---------------- M9/R3: repozytorium paczek (ADR 0017) ---------------- */

/** Rejestr zestawów z `localStorage` (tolerancyjnie: śmieć = pusta lista). */
function czytajRejestrZestawow() {
  if (typeof localStorage === 'undefined') return nowyRejestr();
  const { rejestr } = walidujRejestrSurowy(localStorage.getItem(KLUCZ_REJESTRU) ?? '');
  return rejestr;
}

/**
 * Jednorazowy porządek rejestru przy starcie (właściciel, 2026-09-11): stare
 * wpisy niosą listę tematów DOPUSZCZALNYCH w setupu, z którego paczka powstała —
 * a to bywa szersze niż faktyczna zawartość (model nie zawsze pisze pytania
 * ze wszystkich tematów). Dopasowanie porównuje tematy wpisu z setupem, więc
 * paczka była odrzucana, choć pytań z „obcych" tematów w niej nie ma. Tu wpisy
 * (i pełne zapisy) przechodzą na FAKTYCZNE tematy pytań z paczki. Idempotentne:
 * drugi start nie zmienia nic, a wpis bez czytelnej paczki zostaje jak był.
 */
function ujedgajnijTematyWpisowLokalnych() {
  if (typeof localStorage === 'undefined') return;
  try {
    const wpisy = czytajRejestrZestawow();
    let zmiana = false;
    for (const wpis of wpisy) {
      const { zestaw } = walidujZestawLokalnySurowy(localStorage.getItem(kluczZestawu(wpis.skrot)) ?? '');
      const faktyczne = faktyczneTematyPytan(zestaw?.paczka?.pytania ?? []);
      if (!faktyczne.length) continue; // brak paczki w pamięci albo puste pytania: nie ruszamy
      const zapisane = [...new Set((wpis.tematy ?? []).map(kanonicznyTemat))];
      if (zapisane.length === faktyczne.length && zapisane.every((t, i) => t === faktyczne[i])) continue;
      wpis.tematy = faktyczne;
      if (zestaw) {
        zestaw.tematy = faktyczne; // pełny wpis też niesie spłaszczoną metę
        localStorage.setItem(kluczZestawu(wpis.skrot), JSON.stringify(zestaw));
      }
      zmiana = true;
    }
    if (zmiana) localStorage.setItem(KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy }));
  } catch {
    // porządek rejestru nie może kłaść startu aplikacji (LESSONS L10)
  }
}

/**
 * Identyfikator paczki na Drive zapamiętany przy odcisku treści paczki.
 *
 * ADR 0028 aneks (właściciel 2026-09-09): każda paczka jest na Drive — ta
 * z repozytorium przychodzi z `id` we wpisie indeksu, ta wygenerowana dostaje
 * `id` w odpowiedzi mostu na wysyłkę. Zapamiętanie go przy skrócie sprawia, że
 * druga gra z pamięci telefonu też pozwala ocenić pytania.
 */
const KLUCZ_ID_PACZEK = 'okolica:paczki-drive';
const MAKS_ID_PACZEK = 24;

function czytajIdPaczek() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const surowy = JSON.parse(localStorage.getItem(KLUCZ_ID_PACZEK) ?? 'null');
    if (!surowy || typeof surowy !== 'object' || typeof surowy.pary !== 'object' || !surowy.pary) return {};
    const czyste = {};
    for (const [skrot, id] of Object.entries(surowy.pary)) {
      if (typeof skrot === 'string' && typeof id === 'string' && id) czyste[skrot] = id;
    }
    return czyste;
  } catch {
    return {}; // śmieci w localStorage nie kładą aplikacji (LESSONS L10)
  }
}

function zapamietajIdPaczkiDlaZestawu(skrot, id) {
  if (typeof localStorage === 'undefined') return;
  if (typeof skrot !== 'string' || !skrot || typeof id !== 'string' || !id) return;
  const pary = czytajIdPaczek();
  delete pary[skrot]; // najświeższy wpis idzie na koniec (proste LRU)
  pary[skrot] = id;
  const klucze = Object.keys(pary).slice(-MAKS_ID_PACZEK);
  const przyciete = {};
  for (const k of klucze) przyciete[k] = pary[k];
  try {
    localStorage.setItem(KLUCZ_ID_PACZEK, JSON.stringify({ schemat: 'paczki-drive/1', pary: przyciete }));
  } catch {
    /* pełna pamięć telefonu nie może zepsuć gry — ocena po prostu nie zadziała */
  }
}

function idPaczkiDlaZestawu(skrot) {
  return typeof skrot === 'string' && skrot ? (czytajIdPaczek()[skrot] ?? '') : '';
}

/**
 * Panel ocen po spóźnionym poznaniu `id` paczki: wysyłka na Drive kończy się
 * PO tym, jak gracz może już patrzeć na pytanie, więc kciuki trzeba odsłonić
 * bez czekania na następny render.
 */
function odswiezPanelOcenPoIdPaczki() {
  if (!STAN.ocenianePytanieId) return;
  renderujPanelOcen({ id: STAN.ocenianePytanieId });
}

/** Meta dopasowania z bieżącej konfiguracji i pozycji (wspólna dla zapisu i eksportu). */
function metaBiezacejOkolicy() {
  return zbierzMetaZestawu({
    lat: STAN.pozycja.lat,
    lon: STAN.pozycja.lon,
    promienM: STAN.konfig.promienM,
    tematy: STAN.konfig.tematy,
    wiek: STAN.konfig.wiek,
    jezyk: STAN.konfig.jezyk,
    miejsce: STAN.miejsce ?? '',
    liczbaStacji: STAN.konfig.liczbaStacji,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematWlasny: STAN.konfig.tematWlasny ?? '',
    factcheck: czyFactcheckPaczki(STAN.paczka),
    // Faktyczne tematy pytań (właściciel 2026-09-11): meta opisuje zawartość
    // paczki, nie listę dopuszczalnych z setupu.
    pytania: pytaniaBiezacejSesji(),
    opisStacjiStartu: STAN.stacje?.[0]?.opis ?? '', // ulica do nazwy pliku (ADR 0048)
  });
}

/**
 * Kopia lokalna po starcie gry (kryterium M9: druga gra bez modelu): stacje
 * i JAWNA paczka jadą do `localStorage` (ADR 0050), rejestr przycina LRU,
 * usunięte klucze znikają JAWNIE (LESSONS L6). Quota nie może zabić gry —
 * tylko komunikat. Kluczem wpisu jest odcisk treści paczki (`skrotPaczki`).
 */
function zapiszZestawLokalnyPoStarcie() {
  if (typeof localStorage === 'undefined' || !STAN.pozycja || !STAN.paczka) return;
  try {
    const meta = metaBiezacejOkolicy();
    const skrot = skrotPaczki(STAN.paczka);
    const wpisPelny = {
      schemat: SCHEMAT_LOKALNY, stacje: STAN.stacje, paczka: STAN.paczka,
      ...meta, kodGry: STAN.konfig.kodGry,
    };
    const { rejestr: nowy, usuniete } = dolozWpisRejestru(
      { wpisy: czytajRejestrZestawow() },
      { skrot, ...meta, kodGry: STAN.konfig.kodGry },
      { bajty: rozmiarBajty(wpisPelny) },
    );
    localStorage.setItem(kluczZestawu(skrot), JSON.stringify(wpisPelny));
    for (const skrot of usuniete) localStorage.removeItem(kluczZestawu(skrot));
    localStorage.setItem(KLUCZ_REJESTRU, JSON.stringify(nowy));
    if (usuniete.length) {
      status(`Pamięć paczek telefonu pełna — najstarsze (${usuniete.length}) usunięte. Ta gra działa normalnie; kolejna w tej okolicy weźmie paczkę z repozytorium albo przygotuje ją model.`);
    }
  } catch (blad) {
    status(`Paczka nie zmieściła się w pamięci telefonu (${blad?.name ?? 'błąd'}) — ta gra działa normalnie, a kolejna w tej okolicy będzie potrzebować paczki z repozytorium albo modelu.`);
  }
}

/**
 * Reguła odczytu flagi weryfikacji (ADR 0032 §4): brak pola w starych
 * zapisach (meta, rejestr, indeks, historia) = paczka zweryfikowana.
 */
function czyWpisFactcheck(wpis) {
  return wpis?.factcheck !== false;
}

/**
 * Znaczek fact-checku (ADR 0032, zgłoszenie terenowe Q 2026-09-13): złote
 * „Fact-checked" zamiast samej litery Q — właściciel: pojedyncza litera nic mu
 * nie mówiła. Styl zostaje ten sam (`.znaczek-factcheck` = złoto + półgruby),
 * więc zmienia się tylko tekst i etykieta dla czytnika ekranu.
 * Niesie informację (nie jest dekoracją) — stąd role="img" z etykietą.
 * Dla wariantu bez weryfikacji go NIE renderujemy (brak znaczka = brak weryfikacji).
 */
function znaczekFactcheck() {
  const s = document.createElement('span');
  s.className = 'znaczek-factcheck';
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'Fact-checked: pytania zweryfikowane w sieci');
  s.title = 'Fact-checked — pytania zweryfikowane w sieci';
  s.textContent = 'Fact-checked';
  return s;
}

/**
 * Wiersz propozycji paczki. Nazwa zaczyna się OD MIEJSCA (zgłoszenie terenowe P,
 * 2026-09-13): przedrostek „🌍 repozytorium:" nie mówił nic — wszystkie paczki
 * na tej karcie są z repozytorium, więc powtarzanie źródła w każdej linii
 * zabierało miejsce nazwie („Podkowa Leśna · …").
 */
function wierszZestawu(opis, akcji, statystyki = '', factcheck = true) {
  const li = document.createElement('li');
  const opisEl = document.createElement('span');
  opisEl.className = 'opis-zestawu';
  opisEl.textContent = opis;
  if (factcheck) opisEl.append(' ', znaczekFactcheck());
  const przycisk = document.createElement('button');
  przycisk.type = 'button';
  przycisk.className = 'przycisk';
  przycisk.textContent = '▶ Graj z tą paczką';
  // Sygnał czekania (właściciel 2026-09-13, dograne 2026-09-14 — uwaga B1):
  // pobranie paczki z Drive trwa kilka sekund, a przy grze sieciowej jeszcze
  // zakładanie gry na moście — przycisk mówi „Ładuję paczkę" i pulsuje przez
  // CAŁY ten czas, nie przyjmuje drugiego kliku (podwójne pobranie i podwójne
  // „użycie" paczki). Gdy wstępne pobieranie zdążyło, zmiana jest krótka —
  // gra albo lobby startuje od razu. Słowo „przycisku" pilnuje test w
  // zestawy-ui; brzmienie dał właściciel (uwagi terenowe 2026-09-14, B1).
  przycisk.addEventListener('click', async (zdarzenie) => {
    przycisk.disabled = true;
    przycisk.textContent = '⏳ Ładuję paczkę…';
    przycisk.classList.add('pulsuje');
    try {
      await akcji(zdarzenie);
    } finally {
      przycisk.disabled = false;
      przycisk.textContent = '▶ Graj z tą paczką';
      przycisk.classList.remove('pulsuje');
    }
  });
  li.append(opisEl);
  if (statystyki) {
    // ADR 0028 pkt 5: zdanie o ocenach graczy — jedno miejsce na język.
    const ocenyEl = document.createElement('p');
    ocenyEl.className = 'podpowiedz';
    ocenyEl.textContent = statystyki;
    li.append(ocenyEl);
  }
  li.append(przycisk);
  return li;
}

/**
 * Stan mostu Drive w UI (ADR 0020): adres jest wpisany w kod aplikacji, więc
 * użytkownik go nie konfiguruje — ale MA widzieć, czy wspólne repozytorium,
 * gry sieciowe są w tej wersji podłączone (LESSONS L6: status jawny).
 * Jeden tekst z `app/most.js` trafia do obu miejsc, żeby nie było dwóch prawd.
 */
function pokazStanMostu() {
  const { tekst, podlaczony } = stanMostu(undefined, { testowy: STAN.trybTestowy });
  // Sam adres w kodzie (ADR 0020) to jeszcze nie działające połączenie:
  // po nieudanej próbie mówimy o tym wprost (zgłoszenie właściciela
  // 2026-09-12 — panel obiecywał „podłączony”, a paczki się nie pokazywały).
  const awaria = podlaczony ? STAN.mostOstatniBlad : null;
  const opis = awaria ? `${tekst} Ostatnia próba nie doszła: ${awaria}.` : tekst;
  // jedyny miejscowy pokaz stanu mostu (karta na ekranie pozycji); linijkę
  // z karty multi na setupie właściciel usunął (uwagi terenowe #3, 2026-09-11)
  for (const id of ['most-stan-repo']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = opis;
    el.classList.toggle('bledy', !podlaczony || Boolean(awaria)); // brak połączenia = widoczne ostrzeżenie, nie szara podpowiedź
  }
}

/** „1 paczka", „2 paczki", „5 paczek" — komunikat ma brzmieć po polsku. */
function opisLiczbyPaczek(ile) {
  if (ile === 1) return 'jest 1 paczka';
  if (ile > 1 && ile < 5) return `są ${ile} paczki`;
  return `jest ${ile} paczek`;
}

/** Licznik pokoleń odświeżeń propozycji — patrz `odswiezPropozycjeZestawow`. */
let POKOLENIE_PROPOZYCJI = 0;

/**
 * Kandydaci bieżącej karty propozycji (lokalne + repo) i stan rozwinięcia.
 * Właściciel 2026-09-11: lista pokazuje trzy najlepsze paczki, reszta po
 * przycisku „Zobacz więcej paczek"; pierwsze są najlepiej ocenione.
 */
let KANDYDACI_ZESTAWOW = [];
let ZESTAWY_ROZWINIETE = false;
const LIMIT_ZESTAWOW_NA_LISCIE = 3;

/** Sort kandydatów: najwięcej ocen pozytywnych pierwsza, przy remisie świeższa data. */
function sortujKandydatowZestawow(a, b) {
  return (b.plus - a.plus) || String(b.data).localeCompare(String(a.data));
}

/** Rysuje listę propozycji od zera: sort, limit i stan przycisku „więcej". */
/**
 * Pamięć paczek pobranych z repozytorium: url → promise tekstu. Właściciel
 * 2026-09-13: klik „▶ Graj z tą paczką" czekał kilka sekund na plik z Drive,
 * a lista i tak stoi na ekranie — więc widoczne paczki schodzą w tle, a klik
 * bierze gotowy tekst albo to samo, już rozpoczęte, pobranie (bez drugiego
 * żądania). Pamięć jest czyszczona przy każdym odświeżeniu propozycji; plik
 * paczki jest niezmienialny, więc trafienie w pamięć nie grozi starymi danymi.
 * Oceny i licznik „użyta w X grach" idą jak dotąd DOPIERO przy prawdziwym
 * kliku (ADR 0028) — wstępne pobranie niczego nie zgłasza mostowi.
 */
const PAMIETNIK_PACZEK = new Map();

function pobierzPaczkeZRepo(url) {
  if (!PAMIETNIK_PACZEK.has(url)) {
    PAMIETNIK_PACZEK.set(url, pobierzGetTekst(url).catch((e) => {
      PAMIETNIK_PACZEK.delete(url); // nieudane pobranie nie zostaje — klik spróbuje jeszcze raz
      throw e;
    }));
  }
  return PAMIETNIK_PACZEK.get(url);
}

/** Wstępne pobranie paczek WIDOCZNYCH na liście (tyle, ile gracz może kliknąć). */
function wstepniePobierzPaczki() {
  if (!fetchPrzegladarki()) return; // bez fetch nie ma czego pobierać
  const posortowane = [...KANDYDACI_ZESTAWOW].sort(sortujKandydatowZestawow);
  const widoczne = ZESTAWY_ROZWINIETE ? posortowane : posortowane.slice(0, LIMIT_ZESTAWOW_NA_LISCIE);
  for (const k of widoczne) {
    if (!k.urlPaczki) continue;
    pobierzPaczkeZRepo(k.urlPaczki).catch(() => {}); // cisza: awarię pokaże klik (ta sama ścieżka)
  }
}

function renderujZestawy() {
  const lista = $('zestawy-lista');
  lista.replaceChildren();
  const posortowane = [...KANDYDACI_ZESTAWOW].sort(sortujKandydatowZestawow);
  const widoczne = ZESTAWY_ROZWINIETE ? posortowane : posortowane.slice(0, LIMIT_ZESTAWOW_NA_LISCIE);
  for (const k of widoczne) lista.append(wierszZestawu(k.opis, k.akcja, k.statystyki, k.factcheck));
  const wiecej = $('przycisk-zestawy-wiecej');
  wiecej.hidden = KANDYDACI_ZESTAWOW.length <= LIMIT_ZESTAWOW_NA_LISCIE;
  wiecej.textContent = ZESTAWY_ROZWINIETE ? 'Zobacz mniej paczek' : 'Zobacz więcej paczek';
  wstepniePobierzPaczki(); // lista stoi na ekranie — paczki schodzą w tle (właściciel 2026-09-13)
}

/**
 * Karta propozycji na ekranie pozycja: wyłącznie dopasowania z repozytorium
 * (asynchronicznie, z timeoutem; I.b — kopii z telefonu nie pokazujemy).
 * Każda awaria repo = „brak propozycji", nigdy blokada gry (ADR 0017 pkt 6).
 */
/** Stan karty propozycji paczek: tekst + sygnał czekania jednym miejscem. */
function statusZestawow(tekst, { czeka = false } = {}) {
  const pole = $('zestawy-status');
  if (!pole) return;
  pole.textContent = tekst;
  pole.classList.toggle('pulsuje', czeka);
}

function odswiezPropozycjeZestawow() {
  const karta = $('zestawy-karta');
  if (!karta) return;
  // Niekompletna konfiguracja (np. wyczyszczony promień, K12) = brak karty:
  // kryteria dopasowania byłyby śmieciem, a odmowa przejścia ma zostać jawna.
  if (!STAN.pozycja || !STAN.konfig?.tematy?.length || !(STAN.konfig.promienM > 0)) {
    karta.hidden = true;
    return;
  }
  karta.hidden = false;
  const kryteria = {
    geohash5: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 5),
    // Pełna pozycja: dopasowanie liczy odległość od komórki paczki z tolerancją
    // (ADR 0024), więc kilka metrów różnicy w starcie nie gubi propozycji.
    lat: STAN.pozycja.lat,
    lon: STAN.pozycja.lon,
    promienM: STAN.konfig.promienM,
    liczbaStacji: STAN.konfig.liczbaStacji,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematy: STAN.konfig.tematy,
    wiek: STAN.konfig.wiek,
  };
  const lista = $('zestawy-lista');
  lista.replaceChildren(); // standardowe czyszczenie (atrapa DOM też je umie)
  // Nowe kryteria (pozycja, setup) = nowa lista: startuje zwinięta.
  ZESTAWY_ROZWINIETE = false;
  // Zgłoszenie I.b (2026-09-12): paczek z telefonu NIE pokazujemy — wszystkie
  // są w repozytorium, a druga lista tylko dublowała wpisy. Rejestr lokalny
  // i jego zapis działają dalej (cichy cache, ADR 0017 pkt 7), ale propozycje
  // pochodzą wyłącznie z repozytorium.
  KANDYDACI_ZESTAWOW = [];
  PAMIETNIK_PACZEK.clear(); // nowe kryteria = nowa lista, więc i nowa pamięć paczek
  renderujZestawy();
  const url = adresMostu(); // ADR 0020: adres z kodu aplikacji (albo nadpisany w pamięci telefonu)
  pokazStanMostu();
  if (!url) {
    statusZestawow('Wspólne repozytorium (Drive) nie jest podłączone w tej wersji aplikacji — nowe pytania przygotuje model.');
    return;
  }
  statusZestawow('Sprawdzam repozytorium paczek dla tej okolicy…', { czeka: true });
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) {
    statusZestawow('Repozytorium niedostępne — gramy zwykłą ścieżką (prompt i model).');
    return;
  }
  // Odświeżenie jest asynchroniczne, a setup woła je przy każdej zmianie
  // (pozycja, liczba graczy, czas). Bez tego licznika dwie nakładające się
  // próby dopisałyby te same paczki drugi raz — lista musi pokazywać jedno
  // pokolenie odpowiedzi, więc starsze ignorujemy (LESSONS L32).
  const pokolenie = ++POKOLENIE_PROPOZYCJI;
  void pobierzIndeksZRepo(url, kryteria, pokolenie);
}

/**
 * Indeks repozytorium: jedno żądanie i JEDNA powtórka. Powtórka leczy zimny
 * start web app po wdrożeniu (najczęstszą przyczynę „Repozytorium
 * niedostępne”). Gdy most odpowiedział NIECZYTELNIE, powtarzanie nic nie
 * zmieni — wtedy od razu mówimy prawdę.
 *
 * Sieć i NASZE czytanie odpowiedzi są rozdzielone (zgłoszenie właściciela
 * 2026-09-12: „most na pewno działa, to musiał być problem ze sprawdzaniem
 * paczek”). Wcześniejszy `.catch(() => …)` obejmował cały łańcuch i każdy
 * wyjątek — także usterkę we własnym kodzie na poprawnej odpowiedzi — meldował
 * jako „most nie odpowiada”. Teraz awaria mostu (z powodem) i błąd aplikacji to
 * dwa różne komunikaty, a powtórka należy się WYŁĄCZNIE pierwszemu.
 */
async function pobierzIndeksZRepo(url, kryteria, pokolenie) {
  const aktualne = () => pokolenie === POKOLENIE_PROPOZYCJI;
  const gdzie = adresDoDiagnostyki(url);
  let powod = 'brak odpowiedzi';
  let szczegol = null;
  for (let proba = 1; proba <= 2; proba += 1) {
    let tekst;
    try {
      tekst = await pobierzGetTekst(url);
    } catch (e) {
      if (!aktualne()) return;
      powod = e?.powod ?? 'brak odpowiedzi';
      szczegol = null;
      if (proba === 1) {
        statusZestawow(`Most Drive nie odpowiedział (${powod}) — próbuję jeszcze raz…`, { czeka: true });
        await new Promise((r) => setTimeout(r, PONOWNA_PROBA_INDEKSU_MS));
        if (!aktualne()) return;
      }
      continue;
    }
    if (!aktualne()) return;
    let usterka;
    try {
      usterka = przyjmijIndeksZRepo(tekst, kryteria, url);
    } catch (e) {
      // Most ODPOWIEDZIAŁ — wysypało się nasze czytanie odpowiedzi. Nie wolno
      // tego zameldować jako awarii mostu ani „leczyć” powtórką żądania.
      STAN.mostOstatniBlad = null;
      pokazStanMostu();
      const opis = String(e?.message ?? e);
      // Bez obiecywania, co gracz widzi: lista mogła się wysypać w połowie.
      statusZestawow(`Repozytorium odpowiedziało, ale lista paczek się nie wczytała `
        + `(błąd aplikacji: ${opis}) — lista może być niepełna, zgłoś ten błąd.`);
      return;
    }
    if (!usterka) {
      STAN.mostOstatniBlad = null;
      pokazStanMostu();
      return;
    }
    // Odpowiedź niezrozumiała: powodu szukamy u siebie i w adresie, nie w sieci.
    powod = `nieczytelna odpowiedź (${usterka.kod})`;
    szczegol = `${usterka.kod} — ${usterka.komunikat}`;
    break;
  }
  if (!aktualne()) return;
  // Pełny powód (z kodem usterki) trafia do stanu mostu; w zdaniu wystarcza kod.
  STAN.mostOstatniBlad = szczegol ?? powod;
  pokazStanMostu();
  statusZestawow(`Repozytorium niedostępne (${powod}${gdzie}) — gramy zwykłą ścieżką (prompt i model).`);
}

/** Adres mostu do komunikatu awarii — rozpoznawalny, ale nie cały URL.
 *  Właściciel może mieć kilka wdrożeń Apps Script o różnych adresach, więc przy
 *  awarii pokazujemy prefiks identyfikatora wdrożenia: po nim widać, czy
 *  aplikacja pyta o TO wdrożenie, które przed chwilą wkleił (ADR 0020: adres
 *  wdrożenia jest publicznym punktem końcowym, nie sekretem). */
function adresDoDiagnostyki(url) {
  try {
    const u = new URL(String(url));
    const id = u.hostname === 'script.google.com' ? u.pathname.match(/\/s\/([^/]+)/)?.[1] : null;
    return id ? `, ${u.host}/s/${id.slice(0, 10)}…/exec` : `, ${u.host}`;
  } catch {
    return '';
  }
}

/**
 * Odpowiedź indeksu → lista propozycji. `null` = przyjęte; obiekt usterki =
 * „most odpowiedział, ale NIE rozumiemy odpowiedzi” (Z01/Z09, a także Z10, gdy
 * nie dało się wczytać ANI JEDNEGO wpisu). Rozróżnienie jest istotą sprawy:
 * poprzednia wersja zwracała `false`, a wołający meldował to jako awarię sieci
 * (LESSONS L6/L51 — komunikat nazywa przyczynę, także gdy przyczyną jesteśmy my).
 */
function przyjmijIndeksZRepo(tekst, kryteria, urlZrodla) {
  const { indeks, usterki } = walidujIndeksSurowy(tekst);
  const nieczytelna = usterki.find((u) => u.kod === 'Z01' || u.kod === 'Z09')
    ?? (indeks.length === 0 ? usterki.find((u) => u.kod === 'Z10') : null);
  if (nieczytelna) return nieczytelna;
  const dopasowane = dopasujMetaIndeksu(indeks, kryteria);
  KANDYDACI_ZESTAWOW.push(...dopasowane.map((meta) => ({
    opis: `${meta.miejsce} · ${meta.data} · ${meta.liczbaStacji} stacji × ${meta.pytaniaNaStacje} pytań · ${meta.tematy.join(', ')} · ${meta.wiek}`, // I.a: bez licencji (format TO-zestaw/1 ją niesie, opis nie)
    akcja: () => grajZZestawemZRepo(meta, urlZrodla),
    // Adres pliku liczony raz — ten sam dla wstępnego pobrania i dla kliku.
    urlPaczki: urlPaczkiZRepo(urlZrodla, meta),
    // Brak pola `oceny` w indeksie = most sprzed ADR 0028 (nowy zwraca je
    // zawsze, nawet jako zera) — mówimy to wprost, bez obwiniania sieci.
    statystyki: meta.oceny === undefined
      ? 'Statystyk ocen jeszcze nie ma: ta wersja mostu Drive ich nie zwraca.'
      : opisOcenTekst(walidujStatystykiOcen(meta.oceny)),
    factcheck: czyWpisFactcheck(meta),
    // Sort listy (właściciel 2026-09-11): najwięcej ocen pozytywnych pierwsza.
    plus: walidujStatystykiOcen(meta.oceny)?.plus ?? 0,
    data: meta.data,
  })));
  renderujZestawy();
  // Komunikat mówi, CO zrobić (ADR 0011 pkt 8): puste repo i repo z paczkami,
  // które nie pasują do setupu, to dwie różne sytuacje — i tylko drugą da się
  // naprawić zmianą ustawień.
  if (dopasowane.length) {
    statusZestawow('Repozytorium ma paczki dla tej okolicy — wybór należy do Ciebie.');
    return null;
  }
  // Paczki z innych okolic w ogóle nie wchodzą do komunikatu (właściciel,
  // 2026-09-07): liczy się tylko to, co powstało ±200 m stąd. Od 2026-09-16
  // komunikat NIE wymienia powodów (teren: ściana tekstu) — jedna linijka
  // (ADR 0046 aneks 2026-09-16; `powodyNiedopasowania` dalej filtruje).
  const bliskie = indeks.filter((m) => czyWOkolicy(m, kryteria));
  statusZestawow(bliskie.length
    ? `W tej okolicy ${opisLiczbyPaczek(bliskie.length)}, ale `
      + (bliskie.length === 1 ? 'nie pasuje ona' : 'żadna z nich nie pasuje')
      + ' do aktualnego setupu. Zmień te ustawienia albo przygotuj nowe pytania modelem.'
    : (indeks.length
      ? 'Repozytorium nie ma paczek dla tej okolicy — nowe pytania przygotuje model.'
      : 'Repozytorium jest puste — nowe pytania przygotuje model.'));
  return null;
}

/** Wspólny start z gotową paczką: stacje i pytania wprost z zestawu (ADR 0050). */
async function przyjmijZestawDoGry({ stacje, paczka, zrodlo, factcheck = true }) {
  if (!paczka?.pytania?.length) {
    status(`Paczka (${zrodlo}) jest uszkodzona: nie ma w niej pytań — wracamy do zwykłej ścieżki.`);
    return false;
  }
  // Uwaga B 2026-09-14 (dogrywka): paczka niesie KOLEJNOŚĆ AUTORA (papierową —
  // sprzed twardego wejścia). Grę stawiamy w kolejności trasy od BIEŻĄCEJ
  // pozycji; pytania przepinają się za nowymi numerami, id i poprawne
  // zostają (ADR 0005 aneks).
  let stacjeGry = stacje.map((s, i) => ({ id: s.id ?? i + 1, lat: s.lat, lon: s.lon, opis: s.opis ?? '' }));
  // Profil źródeł zestawu: pieczątka w paczce, a dla zestawów bez niej —
  // `meta.factcheck` z pliku (brak pola = paczka zweryfikowana).
  let paczkaGry = { ...paczka, factcheck: paczka.factcheck ?? (factcheck !== false) };
  let przestawiono = false;
  if (STAN.pozycja && stacjeGry.length > 1) {
    const lad = uporzadkujGre({ srodek: STAN.pozycja, stacje: stacjeGry, pytania: paczka.pytania ?? [] });
    stacjeGry = lad.stacje;
    if (lad.zmieniono) {
      paczkaGry = { ...paczka, pytania: lad.pytania };
      przestawiono = true;
    }
  }
  STAN.stacje = stacjeGry;
  STAN.paczka = paczkaGry;
  STAN.wynikSieci = null; // dystanse drogowe poprzedniej gry nie dotyczą tych stacji
  STAN.usterkiPaczki = [];
  if (STAN.multiPoPaczce) {
    // Wspólny setup (właściciel, 2026-09-11): w multi po wybraniu paczki z
    // ekranu pozycji też otwiera się lobby, nie gra hot-seat. Zakładanie gry
    // jest OCZEKIWANE (uwaga B1, 2026-09-14): POST „gra-zaloz" na zimnym
    // moście trwa 5–10 s, a przycisk „▶ Graj z tą paczką" pulsuje dopóty,
    // dopóki ta funkcja nie wróci — bez await lobby otwierało się po długiej
    // ciszy z odświeżonym, martwym przyciskiem.
    STAN.multiPoPaczce = false;
    STAN.ukryjStacje = false;
    await zalozGreMulti();
    return true;
  }
  startGry();
  if (STAN.rozgrywka) {
    status(`Gra z gotowej paczki (${zrodlo}): ${STAN.rozgrywka.stacje.length} stacji, bez modelu i bez Overpassa.`
      + (przestawiono ? ' Stacje uporządkowano trasą od Twojej pozycji.' : '') + ADR(' (ADR 0017 pkt 7)'));
  }
  return true;
}

async function grajZZestawemZRepo(wpis, urlIndeksu) {
  // M9b/D4: adres liczy czysta funkcja urlPaczkiZRepo — wpis z `id` (most
  // Drive) jedzie przez `?akcja=paczka&id=…`, wpis z `plik` jak dotąd.
  const url = urlPaczkiZRepo(urlIndeksu, wpis);
  status(`Pobieram paczkę z repozytorium: ${wpis.miejsce}…`, { czeka: true });
  let tekst;
  try {
    // Ten sam limit (15 s) i ten sam słownik błędów co indeks. Bez powtórki:
    // tuż przed tym żądaniem poszedł indeks, więc instancja mostu jest już
    // rozgrzana, a ponowić można jednym kliknięciem (powód zobaczysz w statusie).
    tekst = await pobierzPaczkeZRepo(url); // z pamięci, gdy wstępne pobranie zdążyło
  } catch (e) {
    status(`Nie udało się pobrać paczki z repozytorium (${e?.powod ?? 'brak odpowiedzi'}) — sprawdź połączenie albo graj zwykłą ścieżką.`);
    return;
  }
  const { zestaw, usterki } = walidujZestawPublicznySurowy(tekst);
  if (!zestaw) {
    status(`Paczka z repozytorium jest niekompletna (${usterki[0]?.komunikat ?? 'błąd'}) — gramy zwykłą ścieżką.`);
    return;
  }
  // ADR 0028: oceny graczy dotyczą paczek z repozytorium — zapamiętujemy id
  // pliku Drive i token tej gry, a licznik „użyta w X grach" dostaje ping.
  STAN.paczkaRepoId = typeof wpis.id === 'string' ? wpis.id : '';
  if (!STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
  // Druga gra tą samą paczką idzie już z pamięci telefonu — bez tego wpisu
  // straciłaby prawo do oceny (ADR 0028 aneks 2026-09-09).
  zapamietajIdPaczkiDlaZestawu(skrotPaczki(zestaw.paczka), STAN.paczkaRepoId);
  wyslijUzycieWTle(STAN.paczkaRepoId);
  // `await` załatwia obie ścieżki (uwaga B1): hotseat zwraca bool od razu,
  // multi oczekuje na założenie gry — przycisk paczki pulsuje do lobby.
  return przyjmijZestawDoGry({ stacje: zestaw.stacje, paczka: zestaw.paczka, zrodlo: `repozytorium: ${zestaw.meta.miejsce}`, factcheck: czyWpisFactcheck(zestaw.meta) });
}

/**
 * „▶ Zacznij grę": paczka zostaje w pamięci jako jawny JSON (ADR 0050), a jej
 * pytania wchodzą do gry DOPIERO w chwili dojścia do stacji — nie z ukrycia,
 * a z kolejności rozgrywki (pytanie ma sens dopiero na miejscu).
 */
function startGry() {
  if (!STAN.paczka || STAN.usterkiPaczki.length > 0) return;
  // Hot-seat to INNA gra niż sieciowa (zgłoszenia terenowe R i N, 2026-09-13):
  // kontekst multi odzyskany przy starcie aplikacji (albo zostawiony przez grę,
  // którą host zamknął) włączał w hot-seacie trasę-sekret — mapa pokazywała
  // jedną stację z numerem 1 — a przy następnym otwarciu telefonu sesja multi
  // miała pierwszeństwo przed zapisem hot-seata. Start gry na tym telefonie
  // kończy kontekst sieciowy: synchronizacja staje, sesja i stan idą w kosz.
  zatrzymajSyncMulti();
  usunSesjeMulti();
  STAN.multi = null;
  STAN.trasaDlugosc = 0;
  if (!STAN.stacje.length || !STAN.pozycja) {
    status('Nie da się zacząć gry: potrzebna pozycja i policzone stacje (kroki 2–3).');
    return;
  }
  if (!STAN.konfig.kodGry) {
    // Kod gry nie jest w setupie (Partia 2, pkt 7): identyfikator z imion,
    // miejsca i daty — do plików i kluczy, nie do ochrony pytań.
    STAN.konfig.kodGry = domyslnyKodGry({ imiona: STAN.konfig.imiona, miejsce: STAN.miejsce ?? '' });
  }
  zapiszZestawLokalnyPoStarcie();
  STAN.rozgrywka = nowaRozgrywka({
    konfig: STAN.konfig,
    stacje: STAN.stacje,
    paczka: STAN.paczka,
    srodek: STAN.pozycja,
    czasMs: zegarGry(),
    ziarno: ziarno(),
    // ADR 0014 pkt 1: układ z sieci niesie dystanse drogowe (STAN.wynikSieci
    // istnieje tylko wtedy — pierścień go kasuje).
    dystanseOdcinkowM: dystanseOdcinkowM(STAN.wynikSieci),
  });
  STAN.historiaFixow = [];
  pokazEkran('gra');
  if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  const brakPytan = STAN.rozgrywka.brakPytan ?? [];
  status(`Gra rozpoczęta: ${STAN.rozgrywka.gracze.length} gracz(y), ${STAN.rozgrywka.stacje.length} stacji. Pytania odsłaniają się dopiero na stacjach.`
    + (brakPytan.length
      ? ` Uwaga: paczka nie ma pytań do stacji ${brakPytan.join(', ')} — zamkną się samym dojściem, bez punktów (ADR 0015).`
      : ''));
  renderujGre();
  zapiszGre();
}

function startOdcinkaGry() {
  if (!STAN.rozgrywka) return;
  const wynik = startOdcinka(STAN.rozgrywka, { czasMs: zegarGry() });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length === 0) {
    STAN.historiaFixow = [];
    status('Odcinek rozpoczęty — idźcie. Pytanie otworzy się po dwóch kolejnych pomiarach nie dalej niż 50 m od stacji.' + ADR(' (ADR 0004 pkt 2)'));
    odegrajSygnal('startOdcinka');
    if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  } else {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
  }
  renderujGre();
  zapiszGre();
}

function zakonczOdcinekGry(trybDojscia, fix) {
  if (!STAN.rozgrywka) return;
  const stacjaPrzed = STAN.rozgrywka.biezacaStacja; // M11: model może przejść dalej — zdarzenie dotyczy TEJ stacji
  const wynik = zakonczOdcinek(STAN.rozgrywka, { czasMs: zegarGry(), trybDojscia, fix: fix ?? STAN.ostatniFix });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length > 0) {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
    renderujGre();
    return;
  }
  STAN.historiaFixow = []; // stary bufor trafień nie zamyka następnego odcinka
  odegrajSygnal('dotarcie'); // M10/T4: wibracja + dwa tony w górę
  if (STAN.multi) {
    // M11/P4: dojście jedzie na serwer BEZ współrzędnych (biała lista pól, ADR 0019 pkt 3)
    void wyslijZdarzenieMulti('dojscie', stacjaPrzed, { trybDojscia });
  }
  // ADR 0029: jedynym trybem dojścia, jaki ta funkcja może teraz dostać, jest
  // GPS (albo symulacja, która jest tym samym strumieniem fixów) — gałąź
  // „zgłoszone ręcznie" była martwa razem z usuniętym przyciskiem.
  status('Stacja osiągnięta — próg dojścia zadziałał z GPS. Brawo!');
  renderujGre();
  if (STAN.rozgrywka.faza === FAZY.pytanie) renderujPytanie(); // ADR 0007 pkt 6: pytanie DOPIERO teraz
  zapiszGre();
}

// `przelaczPauzeGry()` WYCOFANE 2026-09-13 (uwaga właściciela B, ADR 0040):
// systemu pauzy i wznawiania nie ma — gra i śledzenie idą cały czas, a po
// powrocie z tła wszystko wznawia się samo, bez klikania czegokolwiek.

/** Symulacja dojścia DO BIEŻĄCEJ STACJI (tryb testowy — kryterium „gra bez GPS"). */
function przelaczSymulacjeDoStacji() {
  if (STAN.symulacja) {
    zatrzymajSymulacje();
    status('Symulacja dojścia zatrzymana.');
    return;
  }
  const r = STAN.rozgrywka;
  if (!r || !STAN.pozycja) return;
  const pod = podglad(r);
  if (!pod.stacja) return;
  const start = { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon };
  const cel = { lat: pod.stacja.lat, lon: pod.stacja.lon };
  const trasa = trasaProsta({ start, cel, czasMs: SYMULACJA.czasMs, accuracyM: SYMULACJA.accuracyM, przystanki: 2 });
  const fixy = sekwencjaSymulowana(trasa, { coMs: SYMULACJA.coMs, postoj: GRANICE.wymaganeTrafnienia });
  STAN.symulacja = { fixy, indeks: 0, cel, timer: setInterval(krokSymulacji, SYMULACJA_KROK_MS) };
  status(`Symulacja dojścia do stacji ${pod.stacja.id}: ${fixy.length} fixów (ostatnie dwa dokładnie w celu).`);
}

/**
 * Faza `pytanie` (M6/R5): pytanie z paczki wchodzi na ekran DOPIERO tutaj
 * (ADR 0007 pkt 6). Model rozgrywki pilnuje, kto odpowiada i które pytania
 * zostały (`ktoOdpowiada`, referencje `{stacja, pytanieId}`); treść bierzemy
 * z odsłoniętej paczki po id.
 */
/* ------------------------------------------------- oceny pytań (ADR 0028) */

/** Pamięć przeglądarki albo null (goły Node w testach logiki). */
function pamiecOcen() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** Głosy tego telefonu z pamięci — uszkodzony wpis nie wywraca rozgrywki. */
function zaladujOcenyLokalne() {
  const pamiec = pamiecOcen();
  if (!pamiec) return;
  const { oceny, usterki } = walidujOcenyLokalneTekst(pamiec.getItem(KLUCZ_OCEN) ?? '');
  STAN.oceny = oceny;
  if (usterki.length) status(usterki[0].komunikat);
}

function zapiszOcenyLokalne() {
  const pamiec = pamiecOcen();
  if (pamiec) pamiec.setItem(KLUCZ_OCEN, JSON.stringify(STAN.oceny));
}

function kolejkaOcen() {
  const pamiec = pamiecOcen();
  return walidujKolejkeOcenTekst(pamiec ? pamiec.getItem(KLUCZ_KOLEJKI_OCEN) ?? '' : '');
}

function zapiszKolejkeOcen(kolejka) {
  const pamiec = pamiecOcen();
  if (pamiec) pamiec.setItem(KLUCZ_KOLEJKI_OCEN, JSON.stringify(kolejka));
}

/**
 * Panel „Oceń pytanie" (ADR 0028 pkt 1). Pokazuje się tylko przy paczce
 * z repozytorium — paczka wygenerowana na tym telefonie nie ma gdzie zbierać
 * głosów, więc panelu nie ma (bez komunikatu o brakującej funkcji).
 */
/**
 * Tożsamość głosującego spod panelu ocen. ADR 0026 aneks: na telefonie jest
 * LISTA graczy, nie jeden profil — głosującego szukamy po imieniu
 * odpowiadającego gracza, bo w hot-seat każdy gracz ocenia osobno (ADR 0028
 * pkt 2) i sam identyfikator telefonu byłby za gruby. Jedno miejsce liczenia
 * dla renderu panelu i dla klika — inaczej „już ocenione" mijałoby się z głosem.
 */
function idGlosujacegoPanelu(imie) {
  const zapamietani = czytajGraczyLokalnych();
  const klucz = normalizujPseudonim(imie).toLowerCase();
  const naLiscie = (zapamietani?.gracze ?? []).find((g) => String(g.pseudonim).toLowerCase() === klucz) ?? null;
  return idGlosujacego({
    pseudonim: naLiscie?.pseudonim ?? '',
    zweryfikowany: naLiscie?.zweryfikowany === true,
    imie: imie ?? '',
    pamiec: pamiecOcen(),
  }).id;
}

function renderujPanelOcen(pytanie, gracz = null) {
  const panel = $('gra-oceny');
  if (!panel) return;
  if (!STAN.paczkaRepoId || !pytanie) {
    panel.hidden = true;
    STAN.ocenianePytanieId = '';
    STAN.ocenianyGracz = '';
    STAN.oceniajacyId = '';
    return;
  }
  panel.hidden = false;
  STAN.ocenianePytanieId = pytanie.id;
  if (gracz) {
    STAN.ocenianyGracz = gracz.imie ?? '';
    STAN.oceniajacyId = idGlosujacegoPanelu(gracz.imie);
  }
  // Odświeżenie po głosie woła bez gracza — tożsamość głosującego zostaje ta,
  // która głosowała, bo `idGlosujacego` z pustym imieniem liczy inne id.
  const glos = znajdzGlos(STAN.oceny, { paczkaId: STAN.paczkaRepoId, pytanieId: pytanie.id, graczId: STAN.oceniajacyId });
  const plus = $('gra-ocena-plus');
  const minus = $('gra-ocena-minus');
  if (plus) {
    plus.setAttribute('aria-pressed', glos?.ocena === OCENA_PLUS ? 'true' : 'false');
    plus.disabled = Boolean(glos);
  }
  if (minus) {
    minus.setAttribute('aria-pressed', glos?.ocena === OCENA_MINUS ? 'true' : 'false');
    minus.disabled = Boolean(glos);
  }
  const etykieta = $('gra-oceny-etykieta');
  if (etykieta) etykieta.textContent = glos ? 'To pytanie masz już ocenione — dzięki.' : 'Oceń pytanie (nie musisz)';
}

/**
 * Klik w kciuk: zapis lokalny + wysyłka w tle (ADR 0028 pkt 3). Interfejs nigdy
 * nie czeka na most — głos jest widoczny od razu, a kolejka pilnuje dostarczenia.
 */
function kliknijOcene(ocena) {
  if (!STAN.paczkaRepoId || !STAN.ocenianePytanieId) return;
  // Tożsamość spod renderu panelu — ten sam głosujący, którego sprawdzało
  // „już ocenione" (głosowanie bez renderu nie istnieje, awaryjnie liczymy).
  const id = STAN.oceniajacyId || idGlosujacegoPanelu(STAN.ocenianyGracz);
  const wynik = ocenPytanie(STAN.oceny, {
    paczkaId: STAN.paczkaRepoId,
    pytanieId: STAN.ocenianePytanieId,
    ocena,
    graczId: id,
    gra: STAN.tokenGry,
  });
  if (wynik.usterki.length) {
    status(wynik.usterki.map((u) => u.komunikat).join(' '));
    renderujPanelOcen({ id: STAN.ocenianePytanieId });
    return;
  }
  STAN.oceny = wynik.oceny;
  zapiszOcenyLokalne();
  renderujPanelOcen({ id: STAN.ocenianePytanieId });
  status(ocena === OCENA_PLUS
    ? 'Dzięki — pytanie ocenione na tak. Głos leci na wspólny Drive w tle.'
    : 'Dzięki — pytanie ocenione na nie. Głos leci na wspólny Drive w tle.');
  void wyslijOceneWTle(wynik.doWysylki);
}

/**
 * Wysyłka głosu w tle. Niepowodzenie (brak sieci, stary most, odmowa) nie jest
 * błędem gracza: głos trafia do kolejki i poleci przy następnym uruchomieniu.
 */
function wyslijOceneWTle(zadanie) {
  if (!zadanie) return Promise.resolve();
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  const url = adresMostu();
  if (!f || !url) {
    zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
    return Promise.resolve();
  }
  return f(url, { method: 'POST', body: JSON.stringify(zadanie) })
    .then((odp) => (odp.ok ? odp.text() : Promise.reject(new Error(`HTTP ${odp.status}`))))
    .then((tekst) => {
      const wynik = walidujOdpowiedzOceny(tekst);
      if (wynik.ok) {
        zapiszKolejkeOcen(usunZKolejkiOcen(kolejkaOcen(), zadanie));
        return;
      }
      zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
      status(`${wynik.usterki[0].komunikat} Ocena czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.`);
    })
    .catch(() => {
      zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
      status('Ocena nie dojechała na wspólny Drive — czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.');
    });
}

/** Głosy z kolejki przy starcie aplikacji (ADR 0028 pkt 3). */
function oproznijKolejkeOcen() {
  for (const zadanie of kolejkaOcen().zadania) void wyslijOceneWTle(zadanie);
}

/** Ping „użyta w X grach" — tło, bez wpływu na start gry (ADR 0028 pkt 6). */
function wyslijUzycieWTle(paczkaId) {
  if (!paczkaId) return;
  const f = fetchPrzegladarki();
  const url = adresMostu();
  if (!f || !url) return;
  void f(url, { method: 'POST', body: JSON.stringify({ akcja: 'uzycie', paczkaId, gra: STAN.tokenGry }) })
    .then(() => undefined)
    .catch(() => undefined); // licznik jest pomocniczy: brak sieci nie jest komunikatem dla gracza
}

function renderujPytanie() {
  const r = STAN.rozgrywka;
  if (!r || r.faza !== FAZY.pytanie) return;
  const paczka = STAN.paczka;
  if (!paczka?.pytania?.length) {
    $('gra-pytanie-tresc').textContent = '';
    $('gra-komunikat').textContent = 'Nie da się odsłonić pytania: w pamięci nie ma paczki. Zakończ grę ikoną „⚙ START GRY” (wpisz TAK), a potem wybierz paczkę z repozytorium albo wklej odpowiedź modelu jeszcze raz.';
    return;
  }
  const idPytan = pytaniaStacji(r, r.biezacaStacja);
  // Pierwsza nieobsłużona para (pytanie, jego autor). Autorem jest KONKRETNY
  // gracz z rotacji (zgłoszenie właściciela 2026-09-12: przy dwóch pytaniach na
  // stacji drugie pytanie dostaje następny gracz, nie ten z kolejki) — dlatego
  // nie ma tu pętli po wszystkich „dozwolonych”.
  let para = null;
  for (const pid of idPytan) {
    const gid = graczPytania(r, r.biezacaStacja, pid);
    if (gid == null) continue;
    const juz = r.odpowiedzi.some((o) => o.stacja === r.biezacaStacja && o.pytanieId === pid && o.gracz === gid);
    if (!juz) { para = { pytanieId: pid, graczId: gid }; break; }
  }
  if (!para) { renderujGre(); return; } // stacja domknięta — model przeszedł dalej
  const pytanie = paczka.pytania.find((q) => q.id === para.pytanieId);
  const gracz = r.gracze.find((g) => g.id === para.graczId);
  if (!pytanie) {
    $('gra-komunikat').textContent = `Paczka nie zawiera pytania ${para.pytanieId} — rozjechała się z rozgrywką. Zakończ grę ikoną „⚙ START GRY” (wpisz TAK) i wybierz paczkę jeszcze raz.`;
    return;
  }
  $('gra-komunikat').textContent = '';
  // Właściciel 2026-09-15 (uwaga A): pasek mówi „Stacja 1 - Jacek”. Licznik
  // pytań wraca tylko wtedy, gdy stacja naprawdę ma ich więcej niż jedno —
  // przy jednym pytaniu „pytanie 1 z 1" było szumem na pół ekranu.
  const numerPytania = idPytan.indexOf(para.pytanieId) + 1;
  $('gra-pytanie-naglowek').textContent = idPytan.length > 1
    ? `Stacja ${r.biezacaStacja} - pytanie ${numerPytania} z ${idPytan.length} - ${gracz?.imie ?? '?'}`
    : `Stacja ${r.biezacaStacja} - ${gracz?.imie ?? '?'}`;
  $('gra-pytanie-tresc').textContent = pytanie.tresc;
  renderujPanelOcen(pytanie, gracz);
  const lista = $('gra-odpowiedzi');
  lista.replaceChildren();
  lista.hidden = false; // poprzednie pytanie schowało przyciski — nowe pokazuje
  // Uwaga z testów (2026-09-13, A): w fazie ODPOWIEDZI pytanie i warianty są na
  // wierzchu (details otwarty); statyczna lista wariantów należy do pokazu wyniku.
  $('gra-pytanie-detale').open = true;
  $('gra-odpowiedzi-lista').hidden = true;
  pytanie.odpowiedzi.forEach((odp, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-odpowiedz';
    b.textContent = `${'ABCD'[i]}. ${odp}`;
    b.addEventListener('click', () => odpowiedzNaPytanie(pytanie, i, para));
    lista.appendChild(b);
  });
  $('gra-wynik-odpowiedzi').hidden = true;
  $('przycisk-nastepna-stacja').hidden = true;
  STAN.pytaniePokazaneMs = performance.now();
}

/** Zapis odpowiedzi + ocena, wyjaśnienie i źródła (ADR 0008: źródła także w grze). */
function odpowiedzNaPytanie(pytanie, wybrana, para) {
  const r = STAN.rozgrywka;
  if (!r || r.faza !== FAZY.pytanie) return;
  const stacjaOdp = r.biezacaStacja; // M11: po ostatnim pytaniu model bywa już przy następnej stacji
  const wynik = zapiszOdpowiedz(r, {
    stacjaId: r.biezacaStacja,
    graczId: para.graczId,
    pytanie,
    wybrana,
    czasMs: zegarGry(),
  });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length > 0) {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
    return;
  }
  // Werdykt bierze się z SILNIKA: `zapiszOdpowiedz` przelicza numer odpowiedzi
  // (1..4) na indeks przycisku (0..3) i jest to JEDYNE takie przeliczenie w kodzie
  // (ADR 0050 pkt 3, aneks 2026-09-15f). UI nie liczy drugi raz — inaczej ocena
  // na ekranie, punkt w dzienniku i zdarzenie wysłane na most mogłyby się rozjechać.
  const wpis = wynik.stan.odpowiedzi.at(-1);
  const dobrze = wpis.poprawna;
  odegrajSygnal(dobrze ? 'poprawna' : 'bledna'); // M10/T4: melodia w górę / w dół
  // Właściciel 2026-09-11 (uwagi terenowe #2): po odpowiedzi przyciski znikają
  // zamiast się podświetlać — ocena i wyjaśnienie mówią wszystko. Jedna
  // odpowiedź na pytanie zostaje wymuszona brakiem przycisków do kliknięcia.
  $('gra-odpowiedzi').hidden = true;
  // Uwaga właściciela z testów (2026-09-13, A; ADR 0036 aneks): pytanie i możliwe
  // odpowiedzi zjeżdżają do zwijanego elementu, a na wierzchu zostają łapki,
  // poprawna odpowiedź i komentarz — na telefonie nie ma scrollowania. Warianty
  // WRACAJĄ jako statyczna lista (właściciel: „te przywróć”), ale bez przycisków.
  const warianty = $('gra-odpowiedzi-lista');
  warianty.replaceChildren(...pytanie.odpowiedzi.map((odp, i) => {
    const li = document.createElement('li');
    li.textContent = `${'ABCD'[i]}. ${odp}`;
    return li;
  }));
  warianty.hidden = false;
  $('gra-pytanie-detale').open = false;
  if (STAN.multi) {
    // M11/P4: wynik odpowiedzi jedzie na serwer — punkty liczy też serwer (spójność ponad zaufaniem)
    void wyslijZdarzenieMulti('odpowiedz', stacjaOdp, {
      poprawna: dobrze,
      punktyRazem: wpis.punktyRazem,
    });
  }
  $('gra-odpowiedz-ocena').textContent = dobrze
    ? `✓ Dobrze! +${wpis.punktyRazem} pkt`
    : `✗ Źle (0 pkt). Poprawna odpowiedź: ${'ABCD'[pytanie.poprawna - 1]}. ${pytanie.odpowiedzi[pytanie.poprawna - 1]}`;
  $('gra-wyjasnienie').textContent = pytanie.wyjasnienie ?? '';
  const zrodla = $('gra-zrodla');
  zrodla.replaceChildren();
  for (const z of pytanie.zrodla ?? []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = z.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${z.tytul ?? z.url}${z.sprawdzono ? ` (sprawdzono ${z.sprawdzono})` : ''}`;
    li.appendChild(a);
    zrodla.appendChild(li);
  }
  $('gra-wynik-odpowiedzi').hidden = false;
  $('przycisk-nastepna-stacja').hidden = false;
  $('przycisk-nastepna-stacja').textContent = etykietaPrzyciskuDalej(wynik.stan);
  // Paczka bez źródeł (rev3) nie ma „źródeł poniżej" — status nie może ich obiecywać.
  const maZrodla = Array.isArray(pytanie.zrodla) && pytanie.zrodla.length > 0;
  status(dobrze
    ? 'Poprawna odpowiedź zapisana.'
    : maZrodla ? 'Odpowiedź zapisana — wyjaśnienie i źródła poniżej.' : 'Odpowiedź zapisana — wyjaśnienie poniżej.');
  renderujGre({ panele: false }); // badge'e tak; panele dopiero po „Następna stacja"
  zapiszGre();
}

/** Napis na przycisku pod wyjaśnieniem — zależny od fazy PO zapisaniu odpowiedzi. */
function etykietaPrzyciskuDalej(stan) {
  if (stan.faza === FAZY.koniec) return '🏁 Zobacz wynik →';
  if (stan.faza === FAZY.pytanie) return 'Następne pytanie →';
  const jestWyscig = STAN.multi?.gra?.tryb === TRYBY_GRY.wyscig;
  if (jestWyscig) return 'Idź dalej ->';
  const pod = podglad(stan);
  const kto = pod.gracz ? `${pod.gracz.imie}, ` : '';
  return `▶ ${kto}stacja ${numerStacjiTrasy(stan, stan.biezacaStacja)} — idę →`;
}

/**
 * Zgłoszenie właściciela 2026-09-09: między odpowiedzią a wyjściem w drogę były
 * DWA kliknięcia — „Następna stacja →", a po nim jeszcze „▶ Idę do stacji X" na
 * panelu oczekiwania. Na telefonie w marszu to jeden klik za dużo, więc przycisk
 * pod wyjaśnieniem od razu startuje odcinek.
 *
 * Od 2026-09-14 F wyścig też wraca na mapę od razu (detekcja dowolnej stacji,
 * bez warstwy wyboru) — drugi klik w „▶ Idę do stacji” umarł wszędzie.
 */
function nastepnaStacja() {
  const r = STAN.rozgrywka;
  if (!r) return;
  $('gra-wynik-odpowiedzi').hidden = true;
  renderujGre();
  const świeży = STAN.rozgrywka;
  if (świeży.faza === FAZY.pytanie) {
    renderujPytanie();
    return;
  }
  if (świeży.faza === FAZY.odcinek) {
    // 2026-09-14 F: wyścig — po zamknięciu stacji wracamy do odcinka, który już trwa
    return;
  }
  if (świeży.faza === FAZY.przygotowanie) startOdcinkaGry();
}

/* ----------------------------------------- M6/R6: trwałość i wznowienie gry */

/**
 * Zapis po KAŻDEJ tranzycji (plan M6, decyzja 5): `beforeunload` jest na
 * telefonach zawodny, więc snapshot ląduje w `localStorage` synchronicznie po
 * każdym ruchu. W środku jawna paczka pytań (ADR 0050 — nie ma czego ukrywać).
 */
function zapiszGre() {
  const r = STAN.rozgrywka;
  if (!r || !STAN.paczka) return;
  // M11/P4: gra wieloosobowa ma trwałość NA SERWERZE (RO-gra/1) — lokalny
  // snapshot wskrzesiłby ją po odświeżeniu jako hot-seat bez kontekstu multi.
  // Powrót do gry idzie przez `okolica:multi:sesja` (baner w karcie multi).
  if (STAN.multi) return;
  try {
    const snapshot = zbierajStan({
      // kodGry bywa undefined do pierwszego „generuj kod" — klucz i tak musi być stringiem
      konfig: { ...STAN.konfig, kodGry: String(STAN.konfig.kodGry ?? '') },
      stacje: STAN.stacje,
      paczka: STAN.paczka,
      rozgrywka: r,
      pozycja: STAN.pozycja
        ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, dokladnoscM: STAN.dokladnoscM, zrodlo: STAN.ostatniFix?.zrodlo ?? null }
        : null,
      ekran: 'gra',
      terazMs: Date.now(),
      zegarMs: zegarGry(),
    });
    localStorage.setItem(kluczStanu(r.kodGry), serializujStan(snapshot));
    // wskaźnik = klucz oczyszczony (pusty kodGry → 'gra'); goły '' byłby falsy
    // i baner wznowienia nigdy by się nie pokazał dla gry bez kodu
    localStorage.setItem(KLUCZ_AKTYWNEJ, oczyscKodGry(r.kodGry));
    // Gra zakończona (naturalnie albo ręcznie) wysyła wynik na wspólny Drive
    // (ADR 0026 aneks) — idempotentnie po odcisku gry, więc powtórki zapisu nie
    // dublują wpisu. LOKALNEJ historii gier na telefonie nie ma (zgłoszenie
    // terenowe O, 2026-09-13; ADR 0010 aneks): karta z listą poprzednich gier
    // na setupie sugerowała drugi sposób powrotu do przerwanej gry, a jedynym jest
    // automatyczne wczytanie zapisu; wyniki między grami żyją na Drive
    // (ranking, ADR 0039).
    if (r.faza === FAZY.koniec || STAN.graZakonczonaRecznie) {
      void wyslijWynikHotseat();
    }
  } catch (blad) {
    status(blad?.kod === 'T07'
      ? 'Zapis gry przekroczył budżet 2 MB (T07) — gramy dalej bez wznowienia po zamknięciu. Zakończ grę ikoną „⚙ START GRY” (wpisz TAK), żeby zobaczyć wynik.'
      : `Zapis gry nie udał się: ${blad?.message ?? blad}. Gramy dalej — ale bez wznowienia po zamknięciu przeglądarki.`);
  }
}

/* `zapiszGreDoHistorii()`, `renderujHistorieGier()`, `kasujHistorieGry()`, karta
   `#karta-historia` z listą `#historia-lista` i przyciskiem dwustopniowego
   kasowania oraz klucz localStorage lokalnej historii z pomocnikami
   w `trwalosc.js` (`skrotGry`, `dodajWpisHistorii`, `nowaHistoria`,
   `walidujHistorieSurowa`, kody H01–H04) USUNIĘTE (zgłoszenie terenowe O,
   2026-09-13; ADR 0010 aneks). Właściciel: jedyną drogą powrotu do przerwanej
   gry jest automatyczne wczytanie zapisu, a lista poprzednich gier na setupie
   obiecywała drugą. Wynik zakończonej gry jedzie na wspólny Drive
   (`wyslijWynikHotseat`, ADR 0026 aneks) i stamtąd bierze go ranking
   (ADR 0039) — telefon nie trzyma własnej kopii. */

/**
 * Start aplikacji (uwagi J i K, ADR 0045): telefon pamięta grę → WRACAMY do niej
 * od razu, bez banera na setupie i bez kliku. Baner `#karta-wznowienie` z
 * przyciskami „▶ Wznów grę" / „🗑 Nowa gra (kasuje zapis)" usunął właściciel
 * (uwaga J): szukanie gry na setupie było dodatkowym krokiem między otwarciem
 * aplikacji a grą, a odświeżenie ekranu i tak miało wracać do ostatniego zapisu.
 *
 * Zapis, którego nie da się podnieść, kasujemy OD RAZU i mówimy dlaczego —
 * inaczej każde kolejne otwarcie aplikacji próbowałoby go podnosić:
 * - zepsuty (`walidujStanSurowy` oddaje kody T**) → status z kodami usterek,
 * - zakończony (faza `koniec`) → wynik jest na wspólnym Drive (ADR 0026 aneks).
 * Gra zakończona RĘCZNIE (⚙ START GRY → TAK) zostaje w zapisie i wraca — tak jak
 * dotąd (właściciel 2026-09-11: ręczne zakończenie nie kasuje zapisu).
 *
 * @returns {boolean} czy aplikacja jest teraz w przywróconej grze
 */
function przywrocGreHotseat() {
  STAN.wznowienieKandydat = null;
  if (typeof localStorage === 'undefined') return false;
  const aktywna = localStorage.getItem(KLUCZ_AKTYWNEJ);
  if (!aktywna) return false;
  const { stan, usterki } = walidujStanSurowy(localStorage.getItem(kluczStanu(aktywna)) ?? '');
  if (!stan) {
    localStorage.removeItem(kluczStanu(aktywna));
    localStorage.removeItem(KLUCZ_AKTYWNEJ);
    status(`Zapamiętany zapis gry był zepsuty (${usterki.map((u) => u.kod).join(', ')}) — skasowaliśmy go. Możesz ustawić nową grę.`);
    return false;
  }
  if (stan.rozgrywka?.faza === FAZY.koniec) {
    localStorage.removeItem(kluczStanu(aktywna));
    localStorage.removeItem(KLUCZ_AKTYWNEJ);
    status('Zapamiętana gra była już zakończona — jej wynik jest w „Poprzednich grach". Możesz ustawić nową.');
    return false;
  }
  STAN.wznowienieKandydat = stan;
  wznowGre();
  return true;
}

/**
 * Powrót do zapamiętanej gry (ADR 0045, uwaga K): rebaza zegara sesji (plan M6,
 * ryzyko 3/4) — `performance.now()`
 * po restarcie przeglądarki startuje od zera, więc wszystkie znaczniki czasu
 * rozgrywki przesuwamy o różnicę między teraz a kotwicą `zegarMs` z zapisu.
 * Rebaza tyczy ZNACZNIKÓW w dzienniku: punkty ich nie czytają (ADR 0023 pkt 1),
 * więc gracz nie ma o czym dostawać komunikatu — patrz status niżej.
 */
function wznowGre() {
  const snapshot = STAN.wznowienieKandydat;
  if (!snapshot) return;
  const r = snapshot.rozgrywka;
  // Gra ZAKOŃCZONA jest wznawiana tylko po to, by jeszcze raz obejrzeć wynik:
  // zegar nie chodzi, więc rebaza byłaby szkodliwa — psuje odcisk gry
  // (kluczGryHotseat liczy się z startMs), a przez to każde odświeżenie
  // i wznowienie zakończonej gry wysyłało wynik DRUGI raz i most zakładał
  // kolejny plik gra-hotseat-*.json (zgłoszenie właściciela 2026-09-11:
  // dziesiątki plików w okolica-gry-zakonczone).
  const przesuniecie = r.faza === FAZY.koniec ? 0 : performance.now() - snapshot.zegarMs;
  r.startMs += przesuniecie;
  for (const o of r.odcinki) {
    if (o.startMs != null) o.startMs += przesuniecie;
    if (o.koniecMs != null) o.koniecMs += przesuniecie;
  }
  for (const zdarzenie of r.dziennik) zdarzenie.czasMs += przesuniecie;
  STAN.konfig = snapshot.konfig;
  STAN.stacje = snapshot.stacje;
  STAN.trasaDlugosc = 0; // zapis hot-seata niesie pełną listę — numer = indeks
  STAN.paczka = snapshot.paczka;
  STAN.rozgrywka = r;
  STAN.usterkiPaczki = [];
  if (snapshot.pozycja) {
    STAN.pozycja = { lat: snapshot.pozycja.lat, lon: snapshot.pozycja.lon };
    STAN.dokladnoscM = snapshot.pozycja.dokladnoscM ?? null;
  }
  STAN.graZakonczonaRecznie = false;
  STAN.historiaFixow = []; // dojście liczymy od nowa — fixy sprzed zamknięcia nie rozstrzygają
  STAN.wycentrowane = false; // pierwszy fix po wznowieniu centruje mapę gry
  STAN.wznowienieKandydat = null;
  renderujSetup(); // konfiguracja z zapisu wraca do pól setupu
  // Skład gry bierze się z zapisu — tu tylko przyciski zapamiętanych (ADR 0026 aneks).
  przywrocGraczy();
  pokazEkran('gra');
  ukryjStart(); // powrót do gry pomija okno startowe (uwaga K, ADR 0045)
  if (!STAN.trybTestowy && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  status(`Wróciliśmy do zapamiętanej gry „${r.kodGry || 'bez kodu'}" — faza: ${r.faza}.`);
  renderujGre();
  if (r.faza === FAZY.pytanie) renderujPytanie();
  // Właściciel 2026-09-11 (uwagi terenowe #2): powrót do gry nie może pokazywać
  // międzystrony „Idzie: … ▶ Idę do stacji …" — w fazie przygotowania od razu
  // droga i pasek na dole ekranu (faza przygotowania czeka tylko na gracza).
  if (r.faza === FAZY.przygotowanie) startOdcinkaGry();
  zapiszGre(); // świeża kotwica zegara
}

/* `kasujZapisGry()` i przycisk „🗑 Nowa gra (kasuje zapis)" USUNIĘTE (uwaga J,
   ADR 0045) — razem z banerem wznowienia zniknęło dwustopniowe kasowanie zapisu.
   Zapis kasuje sam start aplikacji, gdy nie da się go podnieść (zepsuty albo gra
   zakończona), oraz „Wróć na początek" po grze (`wrocNaPoczatek`).
   Dwustopniowego kasowania nie ma już nigdzie: lokalna historia gier zniknęła
   razem z nim (zgłoszenie terenowe O, 2026-09-13; ADR 0010 aneks). */

/**
 * „■ Zakończ grę" — dwustopniowo; pokazuje wynik WCZEŚNIEJ niż model kończy
 * grę, ale NIE niszczy stanu: zapis zostaje i grę można wznowić (pełne
 * podsumowanie z eksportem to M7).
 */
function zakonczGreRecznie() {
  const r = STAN.rozgrywka;
  if (!r) return;
  if (r.faza === FAZY.koniec) {
    // Gra już się skończyła: potwierdzanie końca nic nie zmienia, więc mówimy
    // wprost, gdzie jest wyjście (właściciel, 2026-09-08).
    status('Ta gra już się zakończyła — wynik jest powyżej. Nową grę zaczniesz przyciskiem „Wróć na początek".');
    return;
  }
  // Potwierdzeniem jest wpisanie TAK w warstwie `#ekran-koniec-gry` (uwaga I,
  // ADR 0043) — dawniej był to drugi klik w przycisk „⚠ Kliknij ponownie".
  STAN.graZakonczonaRecznie = true;
  // M11/P4: koniec na tym telefonie = rezygnacja w grze wieloosobowej (reszta gra dalej)
  if (STAN.multi) void wyslijZdarzenieMulti('rezygnacja', null, { powod: 'zakończenie ręczne na telefonie' });
  zatrzymajSymulacje();
  pokazWyniki();
  renderujGre();
  zapiszGre(); // M7/P6: ręczne zakończenie JEST tranzycją — zapis + wpis historii „przerwana"
  status('Gra zakończona wcześniej — wynik poniżej. Zapis został, więc można ją wznowić.');
}

/**
 * „Wróć na początek" (właściciel, 2026-09-08): po zakończeniu gry nie było
 * wyjścia z ekranu gry. Wynik jest już w historii, więc sprzątamy stan bieżącej
 * rozgrywki i wracamy do setupu — ustawienia graczy i setup zostają.
 */
function wrocNaPoczatek() {
  const r = STAN.rozgrywka;
  // Uwaga E (2026-09-14): wyjście z ekranu wyników KONCZY kontekst sieciowy.
  // Rezygnacja zostawia synchronizację żywą celowo (wspólna tabela w trakcie
  // oglądania wyników), ale jeśli nic jej nie zamknie, polling odradza dawną
  // grę w środku wyboru nowej (poważne zgłoszenie właściciela). Gdy gracz
  // opuszcza wyniki, tabeli już nie ogląda — polling nie ma po co żyć.
  const m = STAN.multi;
  if (m) {
    const sesja = { kod: m.gra?.kod, idGry: m.gra?.idGry ?? null, urlMostu: m.urlMostu };
    zatrzymajSyncMulti(); // koniec pollingu i kolizji wysyłek
    STAN.multi = null;
    STAN.trasaDlugosc = 0;
    // Ostatnie wypchnięcie zaległych zdarzeń (np. rezygnacji, która nie
    // wyszła bez zasięgu) — w tle, z pamięci telefonu (ADR 0019 aneks).
    void dostarczZalegleZdarzeniaMulti(sesja);
  }
  zatrzymajSymulacje();
  if (typeof localStorage !== 'undefined') {
    const kod = r ? oczyscKodGry(r.kodGry) : '';
    if (kod) localStorage.removeItem(kluczStanu(kod));
    localStorage.removeItem(KLUCZ_AKTYWNEJ); // baner „wznów grę" nie proponuje skończonej gry
  }
  STAN.rozgrywka = null;
  STAN.graZakonczonaRecznie = false;
  STAN.paczka = null;
  STAN.paczkaRepoId = '';
  STAN.tokenGry = '';
  STAN.ocenianePytanieId = '';
  STAN.ocenianyGracz = '';
  STAN.oceniajacyId = '';
  // Krok 5 to jedyne węzły niosące WYNIK poprzedniej gry (uwaga terenowa A(c),
  // 2026-09-16) — koniec gry gasi je razem z resztą stanu.
  wyczyscEkranPaczki();
  pokazMapeStartowa();
  status('Gotowe do nowej gry — setup i gracze zostali, wynik jest w historii.');
}

/* ------------------------------------------------- podsumowanie gry (M7) */

/**
 * Podsumowanie po grze: karta zwycięzcy i tabela rankingu. Nic więcej —
 * reszta ekranu to jeden przycisk „Wróć na początek” (ADR 0038).
 *
 * Decyzja właściciela 2026-09-12: statystyki gry, szczegóły graczy, tabela
 * stacji, eksporty i linia fact-checku zniknęły razem z kodem, który je
 * wypełniał („masa błędów i niepotrzebnych informacji”).
 */
function pokazWyniki() {
  const r = STAN.rozgrywka;
  if (!r) return;
  odswiezStanIkonBelki(); // koniec gry (naturalny, ręczny, multi) odwiesza ⚙ START GRY (zgłoszenie J)
  // Gra wieloosobowa po zamknięciu: punkty liczy most (ADR 0019), a lokalna
  // rozgrywka zna tylko TEGO gracza — więc bierzemy tabelę z mostu i pokazujemy
  // ją w tym samym MINIMALNYM ekranie (ADR 0038). Dzięki temu koniec gry wygląda
  // jak w hotseat, a gracze widzą wspólną punktację z premią za kolejność
  // (uwaga F i L; ADR 0044).
  const wynik = wynikiMultiKonca() ?? podsumowanie(r);

  // 1. karta zwycięzcy
  const kartaZw = $('gra-wynik-zwyciezca');
  kartaZw.replaceChildren();
  const zwyciezca = wynik.gracze.find((g) => g.id === wynik.zwyciezca) ?? null;
  if (zwyciezca) {
    const imie = document.createElement('p');
    imie.className = 'zwyciezca-imie';
    imie.textContent = `🏆 ${zwyciezca.imie}`;
    const punkty = document.createElement('p');
    punkty.className = 'zwyciezca-punkty';
    punkty.textContent = `${zwyciezca.punkty} pkt`;
    const detale = document.createElement('p');
    detale.className = 'zwyciezca-detale';
    detale.textContent = `poprawne ${zwyciezca.poprawne}/${zwyciezca.poprawne + zwyciezca.bledne}`;
    kartaZw.append(imie, punkty, detale);
  } else {
    const p = document.createElement('p');
    p.textContent = 'Brak zwycięzcy — żadna odpowiedź nie została zapisana.';
    kartaZw.appendChild(p);
  }

  // 2. tabela tej gry — gracz | punkty | poprawne (ADR 0038: trzy kolumny)
  const tbody = $('gra-wyniki-tbody');
  tbody.replaceChildren();
  for (const id of wynik.ranking) {
    const g = wynik.gracze.find((gracz) => gracz.id === id);
    if (!g) continue;
    const wiersz = document.createElement('tr');
    for (const komorka of [`${g.imie}${id === wynik.zwyciezca ? ' 🏆' : ''}`, String(g.punkty), `${g.poprawne}/${g.poprawne + g.bledne}`]) {
      const td = document.createElement('td');
      td.textContent = komorka;
      wiersz.appendChild(td);
    }
    tbody.appendChild(wiersz);
  }
  stanWysylkiWyniku(''); // los wysyłki z poprzedniej gry nie zostaje na ekranie
  // Multi: pod wspólnym wynikiem dorzucamy przebieg uczestników (stacje,
  // poprawne, status). W hot-seacie blok `#gra-wyniki-multi` zostaje ukryty
  // (ekran wyników bez zmian, ADR 0038).
  renderujWynikiMulti();
}

/* ---------------------------------------------------------------- prompt */

function budujPromptEkran() {
  // ADR 0032: checkbox wybiera wariant — domyślnie (pusty) pytania bez
  // weryfikacji (model sam decyduje, czy sprawdzi w sieci); zaznaczony to
  // twarda, wymuszona kwerenda dla każdego faktu.
  const factcheck = $('prompt-factcheck').checked === true;
  STAN.promptFactcheck = factcheck;
  const wynik = zbudujPrompt({
    konfig: STAN.konfig,
    okolica: { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, miejsce: STAN.miejsce ?? '' },
    stacje: STAN.stacje,
    factcheck,
  });
  pokazBledy('bledy-prompt', wynik.usterki);
  STAN.prompt = wynik.prompt;
  $('pole-prompt').value = wynik.prompt ?? '';
  $('prompt-licznik').textContent = wynik.prompt
    ? `${wynik.prompt.length} znaków · ${liczbaPytan(STAN.konfig)} pytań · ${STAN.konfig.liczbaStacji} stacji`
    : 'prompt nie został zbudowany';
  $('prompt-podglad-naglowek').textContent = `Pokaż treść promptu (${factcheck ? 'z fact check' : 'bez fact-check'})`;
  // Teksty zlecenia właściciela (2026-09-09) — słowo w słowo:
  $('prompt-tryb-opis').textContent = factcheck
    ? 'Tryb: pytania z fact check — model sprawdza każdy fakt w sieci ale generowanie pytań trwa dłużej.'
    : 'Tryb: pytania bez fact-check — model AI korzysta z własnej wiedzy, generowanie pytań trwa krócej.';
  $('przycisk-dalej-paczka').disabled = !wynik.prompt;
}

async function kopiujTekst(tekst, przycisk, etykieta, idPolaZapasowego = 'pole-prompt') {
  const przywroc = () => { przycisk.textContent = etykieta; };
  // Jeden klik ma KOPIOWAĆ, nie zaznaczać (ADR 0006 — schowek z degradacją).
  // Zwracamy twardy wynik schowka (boolean) — ekran wyżej decyduje na tej
  // podstawie, czy iść dalej (uwaga terenowa 2026-09-16: „Kopiuj prompt”
  // auto-przechodzi na krok 5).
  const ok = await kopiujDoSchowka(tekst, idPolaZapasowego);
  przycisk.textContent = ok ? '✓ skopiowano' : '⚠ zaznaczone — skopiuj ręcznie';
  window.setTimeout(przywroc, 2500);
  return ok;
}

/**
 * Kopiowanie trzema szczeblami — jeden klik ma KOPIOWAĆ, nie zaznaczać:
 * 1) `navigator.clipboard.writeText` (nowoczesne przeglądarki);
 * 2) `document.execCommand('copy')` na tymczasowym polu — działa tam, gdzie
 *    iframe albo uprawnienia blokują schowek asynchroniczny, i nie zależy
 *    od tego, czy `<details>` z polem jest rozwinięty;
 * 3) ostatnia deska: rozwiń `<details>` i zaznacz tekst w polu ekranowym —
 *    użytkownik dokończy ręcznie. Zwraca true, gdy tekst TRAFIŁ do schowka.
 */
async function kopiujDoSchowka(tekst, idPolaZapasowego) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tekst);
      return true;
    }
  } catch (e) { void e; }
  try {
    if (typeof document.execCommand === 'function') {
      const tymczasowe = document.createElement('textarea');
      tymczasowe.value = tekst;
      tymczasowe.setAttribute('readonly', '');
      tymczasowe.style.position = 'fixed';
      tymczasowe.style.opacity = '0';
      document.body.appendChild(tymczasowe);
      tymczasowe.select();
      const ok = document.execCommand('copy');
      tymczasowe.remove();
      if (ok) return true;
    }
  } catch (e) { void e; }
  try {
    // Schowek nieosiągalny w żaden sposób — zaznacz tekst i każ skopiować
    // ręcznie. Zero komunikatu „nie działa" bez wyjścia.
    const pole = $(idPolaZapasowego);
    if (!pole) return false;
    const zwiniety = typeof pole.closest === 'function' ? pole.closest('details') : null;
    if (zwiniety) zwiniety.open = true; // schowane pole zaznaczyłoby się w próżnię
    pole.focus();
    pole.setSelectionRange(0, pole.value.length);
  } catch (e) { void e; }
  return false;
}

/* ------------------------------------------------------------- walidacja */

function oczekiwane() {
  return {
    liczbaStacji: STAN.konfig.liczbaStacji,
    liczbaPytan: liczbaPytan(STAN.konfig),
    wiek: STAN.konfig.wiek,
    tematy: STAN.konfig.tematy,
    promienM: STAN.konfig.promienM,
    lat: STAN.pozycja?.lat,
    lon: STAN.pozycja?.lon,
    jezyk: STAN.konfig.jezyk,
    stacje: STAN.stacje,
    teraz: new Date(),
    // ADR 0050: o profilu źródeł decyduje APLIKACJA (ptaszek „Pytania z fact
    // check” na ekranie promptu), nie marker w JSON-ie od modelu.
    factcheck: STAN.promptFactcheck === true,
  };
}

/**
 * Czy paczka jest z fact-checkiem (ADR 0032 + ADR 0050)? Odpowiedź zna
 * APLIKACJA: w chwili przyjęcia stempluje w paczce `factcheck` z ptaszka na
 * ekranie promptu, a zestawy z repozytorium niosą to samo w `meta.factcheck`.
 * Brak informacji = paczka zweryfikowana (reguła jak dla starych wpisów).
 */
function czyFactcheckPaczki(paczka) {
  return paczka?.factcheck !== false;
}

/**
 * Walidacja i przyjęcie paczki. `tekstZewnetrzny` podaje treść z pominięciem
 * DOM (droga ze schowka); bez argumentu bierze zawartość pola awaryjnego.
 */
function sprawdzOdpowiedz(tekstZewnetrzny = null) {
  const tekst = typeof tekstZewnetrzny === 'string' ? tekstZewnetrzny : $('pole-odpowiedz').value;
  // Jedna postać paczki (ADR 0050): wklejka to blok JSON od modelu. Parser nie
  // rzuca wyjątków — wklejony tekst bywa śmieciem i UI ma to pokazać komunikatem.
  const { paczka, blad } = parsujOdpowiedzModela(tekst);
  const wynik = $('wynik-walidacji');

  if (!paczka) {
    STAN.usterkiPaczki = [blad];
    STAN.paczka = null;
    pokazOdrzuconaPaczkeAi();
    return;
  }

  // Jedna postać paczki (ADR 0050): nie ma czego dekodować — warianty zapisu
  // i markery protokołu zostały usunięte razem z ukrywaniem paczki.
  const robocza = paczka;
  const usterki = walidujPaczke(robocza, oczekiwane());
  STAN.usterkiPaczki = usterki;
  if (usterki.length) {
    STAN.paczka = null;
    pokazOdrzuconaPaczkeAi();
    return;
  }

  wynik.dataset.stan = 'ok';
  // Pieczątka profilu źródeł: wie o nim aplikacja (ptaszek na ekranie promptu),
  // więc zapisuje je w paczce — model nie ma nic do zgłaszania (ADR 0050).
  STAN.paczka = normalizujTematyPaczki({ ...robocza, factcheck: STAN.promptFactcheck === true });
  // Uwaga B 2026-09-14 (dogrywka): kolejność stacji mogła rozjechać się
  // z trasą — przed wysyłką na Drive i startem stawiamy grę w kolejności
  // trasy od bieżącej pozycji (paczka rodzi się uporządkowana).
  let przestawionoWklejke = false;
  if (STAN.pozycja && STAN.stacje.length > 1) {
    // Metryka porządkowania musi być TA, którą stacje wybrano. Sieć drogowa
    // numeruje trasę DROGĄ (`wybierzStacje` oddaje `dystansSieciowyM` stacji
    // i macierz dijkstr w tej samej kolejności), więc bez nich wklejka psuje
    // dwa razy: stacja 1 inna niż w metryce gracza (twarde wejście złamane)
    // oraz macierz drogowa wisząca na STAREJ kolejności — dystanse odcinków
    // lądują na cudzych odcinkach, a UI przy nich mówi „drogą" (audyt PR #24,
    // defekt D1). Przy pierścieniu `wynikSieci` jest `null` i porządkujemy
    // kreską, jak dotąd. Brak/NaN dystansu sieciowego pojedynczej stacji
    // cofa ją na kreskę — ta sama reguła co w `kolejnoscTrasy` dla macierzy.
    const drogi = STAN.wynikSieci;
    const lad = uporzadkujGre({
      srodek: STAN.pozycja,
      stacje: STAN.stacje,
      pytania: STAN.paczka.pytania ?? [],
      dystansStart: drogi ? STAN.stacje.map((s) => (Number.isFinite(s.dystansSieciowyM)
        ? s.dystansSieciowyM
        : Math.round(odlegloscM(STAN.pozycja, s)))) : null,
      macierz: drogi ? drogi.macierz : null,
    });
    if (lad.zmieniono) {
      STAN.stacje = lad.stacje;
      STAN.paczka = { ...STAN.paczka, pytania: lad.pytania };
      // Macierz i `dystansSieciowyM` stacji wiszą na STAREJ kolejności — po
      // przestawieniu są nie do obrony, więc odpadają razem z nią: odcinki
      // liczą się wtedy kreską i UI mówi prawdę (`w linii prostej`).
      STAN.wynikSieci = null;
      przestawionoWklejke = true;
    }
  }
  const weryfikacja = czyFactcheckPaczki(STAN.paczka) ? 'fact check' : 'bez fact-check';
  $('wynik-naglowek').textContent = `Paczka przyjęta (${weryfikacja})`;
  // Pole wklejenia jest czyszczone natychmiast: plaintext nie zostaje w DOM
  // (ADR 0007 pkt 4). Paczka żyje w pamięci modułu.
  $('pole-odpowiedz').value = '';
  $('wklejka-status').textContent = '';
  wyslijZestawNaDrive();
  // Multi (właściciel, 2026-09-11): po wklejeniu odpowiedzi modelu otwiera
  // się LOBBY — gra zakłada się z paczki tej sesji, bez pośredniego panelu.
  if (STAN.multiPoPaczce) {
    STAN.multiPoPaczce = false;
    STAN.ukryjStacje = false;
    void zalozGreMulti();
    return;
  }
  // Decyzja właściciela 2026-09-07: poprawna paczka = OD RAZU gra. Podgląd,
  // ściąganie i edycja nie są graczowi potrzebne — to zadania właściciela
  // na Drive, dokąd zestaw właśnie poleciał. Guard startGry pilnuje
  // kolejności kroków, gdyby ktoś tu dotarł bez pozycji albo stacji.
  startGry();
  if (przestawionoWklejke && STAN.rozgrywka) {
    status(`Stacje uporządkowano trasą od Twojej pozycji. ${$('status').textContent}`);
  }
}

/**
 * M9b/D2+D3: automatyczna wysyłka zestawu na Drive w chwili przyjęcia
 * (decyzja właściciela 2026-09-07: prywatna aplikacja — wysyłka DOMYŚLNA,
 * bez checkboxa i bez przypominajki; checkbox z 2026-09-06 usunięty).
 * Brak adresu mostu, pozycji albo fetch = zero wysyłki i JAWNY status
 * (LESSONS L6). POST text/plain omija preflight CORS (plan M9b).
 */
function wyslijZestawNaDrive() {
  const url = adresMostu(); // ADR 0020: jeden adres z kodu aplikacji
  if (!url) {
    status('Paczka przyjęta. Nie wysłano na Drive: brak adresu repozytorium w tej wersji aplikacji — paczka zostaje na tym telefonie.' + ADR(' (ADR 0020)'));
    return;
  }
  if (!STAN.pozycja || !STAN.stacje.length || !STAN.paczka) {
    status('Paczka przyjęta. Wysyłka na Drive pominięta: brak pozycji albo stacji w tej sesji.');
    return;
  }
  const plik = zbudujPlikZestawu({
    stacje: STAN.stacje,
    paczka: STAN.paczka,
    meta: metaBiezacejOkolicy(),
  });
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) { status('Paczka przyjęta. Nie wysłano na Drive: to środowisko nie ma fetch.'); return; }
  f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(plik),
  })
    .then((odp) => odp.json().catch(() => ({})))
    .then((wynik) => {
      // ADR 0028 aneks (właściciel 2026-09-09): KAŻDA paczka jest na Drive, więc
      // każdą wolno ocenić. Most oddaje `id` pliku także przy duplikacie —
      // zapamiętujemy je, inaczej łapki nie miałyby czego oceniać.
      if (wynik?.ok && typeof wynik.id === 'string' && wynik.id) {
        STAN.paczkaRepoId = wynik.id;
        if (!STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
        zapamietajIdPaczkiDlaZestawu(skrotPaczki(STAN.paczka), wynik.id);
        odswiezPanelOcenPoIdPaczki();
      }
      // Decyzja właściciela 2026-09-11: koniec sesji przeglądu — paczka jest
      // na Drive od razu, dostępna w zestawach; jakość rozstrzygają łapki.
      if (wynik?.ok && wynik.status === 'zaakceptowana') {
        // Nazwa pliku wprost (właściciel 2026-09-15, ADR 0048): po niej
        // organizator znajduje paczkę na Drive. Most, który nazwy nie zwrócił
        // (stara wersja skryptu), który nazwy nie zwrócił, nie wpycha w UI zdania
        // o „nieznanym" pliku — mówi tylko tyle, ile wie most.
        const nazwaPliku = typeof wynik.nazwa === 'string' && wynik.nazwa ? ` jako „${wynik.nazwa}\"` : '';
        status(`Paczka przyjęta i wysłana na Drive${nazwaPliku}: dostępna od razu w zestawach — jakość rozstrzygną łapki graczy.` + ADR(' (ADR 0017 aneks 2026-09-11)'));
      } else if (wynik?.ok && wynik.status === 'juz-w-odrzuconych') {
        status('Paczka przyjęta; identyczny zestaw został wcześniej odrzucony ręcznie na Drive — nowy plik nie powstał, gra toczy się dalej.');
      } else if (wynik?.ok) {
        status(`Paczka przyjęta; taki zestaw już jest na Drive (${wynik.status}) — duplikat nie powstał.`);
      } else {
        status(`Paczka przyjęta, ale Drive odrzucił wysyłkę: ${wynik?.blad ?? 'nieznany błąd mostu'} — gra toczy się dalej.`);
      }
    })
    .catch(() => status('Paczka przyjęta, ale wysyłka na Drive nie udała się (sieć albo most) — gra toczy się dalej; ta paczka nie trafiła do wspólnego repozytorium.'));
}


/** Komunikat odrzucenia paczki AI (właściciel 2026-09-15): bez listy kodów
 *  E01–E20 i bez poprawki do modelu — organizator ma ponowić generowanie.
 *  Pole wklejenia czyścimy od razu: stara, zła wklejka nie może zostać
 *  pod palcem (ADR 0007 pkt 4 i tak czyści po przyjęciu; tu to samo po odmowie). */
const KOMUNIKAT_BLEDNEJ_PACZKI_AI = 'Wygenerowana paczka pytań AI jest błędna. Ponów generowanie i wklej poprawne dane.';

function pokazOdrzuconaPaczkeAi() {
  const wynik = $('wynik-walidacji');
  wynik.hidden = false;
  wynik.dataset.stan = 'blad';
  $('wynik-naglowek').textContent = KOMUNIKAT_BLEDNEJ_PACZKI_AI;
  $('pole-odpowiedz').value = '';
  $('wklejka-status').textContent = KOMUNIKAT_BLEDNEJ_PACZKI_AI;
  status(KOMUNIKAT_BLEDNEJ_PACZKI_AI);
}

/**
 * Krok 5 startuje ZAWSZE z czystą kartą (uwaga terenowa A(c), 2026-09-16).
 *
 * Właściciel: „Rozegrałem jedną grę, zakończyłem, rozpocząłem kolejną (…)
 * Na dole tej strony wyświetla się jakiś artefakt z poprzedniej gry — komunikat
 * »Paczka przyjęta (bez fact-checku)«, a ja jeszcze nic nie wklejałem.”
 *
 * Karta `#wynik-walidacji`, jej nagłówek i `#wklejka-status` to JEDNE węzły
 * `index.html` obsługujące kolejne gry: odsłonięte przez odrzuconą paczkę
 * (`pokazOdrzuconaPaczkeAi`) zostawały widoczne — z nagłówkiem NADPISANYM
 * komunikatem przyjęcia — także na ekranie następnej gry. Ten sam wzorzec co
 * L77 (`startLobby`): węzeł żyje dłużej niż jedna gra, więc stan czyścimy przy
 * WEJŚCIU na ekran, a nie tylko przy wyjściu z gry.
 */
function wyczyscEkranPaczki() {
  const karta = $('wynik-walidacji');
  karta.hidden = true;
  delete karta.dataset.stan;
  $('wynik-naglowek').textContent = '';
  $('wklejka-status').textContent = '';
  // Pole wklejenia też startuje puste — stara treść nie ma prawa czekać pod palcem.
  $('pole-odpowiedz').value = '';
}



/* ------------------------- sygnały (M10/T4), Service Worker (M10/T2), bateria (M10/T3) */

let kontekstAudio = null;

/** Czy sygnały są włączone? Domyślnie TAK; `okolica:sygnaly`='0' wyłącza. */
function sygnalyWlaczone() {
  return czySygnalyWlaczone(typeof localStorage !== 'undefined' ? localStorage.getItem(KLUCZ_SYGNALOW) : null);
}

/**
 * Nuty z oscylatora Web Audio — zero plików dźwiękowych, zero zależności
 * (ADR 0001). Kontekst tworzony leniwie: pierwszy sygnał zawsze następuje po
 * geście użytkownika, więc polityka autoplay przeglądarek jest spełniona.
 * Każda awaria jest cicha: dźwięk to ozdoba, nie rozgrywka (LESSONS L6).
 */
function odegrajDzwieki(nuty) {
  try {
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof Ctx !== 'function') return;
    kontekstAudio ??= new Ctx();
    if (kontekstAudio.state === 'suspended') kontekstAudio.resume?.();
    let t = kontekstAudio.currentTime;
    for (const nuta of nuty) {
      const osc = kontekstAudio.createOscillator();
      const gain = kontekstAudio.createGain();
      osc.type = 'sine';
      osc.frequency.value = nuta.czHz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + nuta.ms / 1000);
      osc.connect(gain);
      gain.connect(kontekstAudio.destination);
      osc.start(t);
      osc.stop(t + nuta.ms / 1000 + 0.03);
      t += nuta.ms / 1000 + 0.05;
    }
  } catch { /* brak AudioContext albo zablokowany — gramy dalej bez dźwięku */ }
}

/** Wykonuje plan sygnału (wibracja + dźwięk); czysta decyzja w `sygnaly.js`. */
function odegrajSygnal(zdarzenie) {
  const plan = planSygnalu(zdarzenie, { wlaczone: sygnalyWlaczone() });
  if (!plan) return;
  try {
    if (plan.wibracjaMs && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(plan.wibracjaMs);
  } catch { /* brak wibracji (desktop, iOS) jest normalny */ }
  if (plan.dzwiek?.length) odegrajDzwieki(plan.dzwiek);
}

/** „🔔 sygnały": przełącznik + zapis + potwierdzenie (klik = gest, może grać). */
function przelaczSygnaly() {
  const wlaczone = !sygnalyWlaczone();
  if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_SYGNALOW, wlaczone ? '1' : '0');
  $('przycisk-sygnaly').setAttribute('aria-pressed', String(wlaczone));
  status(wlaczone
    ? 'Sygnały włączone: wibracja i dźwięk przy dojściu do stacji, starcie odcinka i ocenie odpowiedzi.'
    : 'Sygnały wyłączone — gra toczy się bez dźwięku i wibracji.');
  if (wlaczone) odegrajSygnal('poprawna');
}

/**
 * M10/T2: rejestracja Service Workera — offline skorupa + kafelki ostatniej
 * okolicy (`sw.js`). Tylko po http(s) (na file: SW nie działa) i tylko gdy
 * przeglądarka go ma; awaria rejestracji jest cicha (offline to dodatek).
 */
function zarejestrujServiceWorker() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('./sw.js');
  } catch { /* brak SW = zwykła gra online */ }
}

// `dostosujProfilGps()` WYCOFANE 2026-09-13 (uwaga właściciela B, ADR 0040):
// jeden profil watchera, zawsze dokładny — oszczędzanie baterii w tej zabawie
// nie ma sensu, a kryterium dojścia liczy się z metrów na całym odcinku.

/* ------------- ADR 0040 pkt 4–5: Wake Lock i przerwa po bezczynności */

/**
 * Wake Lock (uwaga właściciela C, 2026-09-13): podczas gry ekran nie gaśnie
 * sam. Brak API (iOS Safari, część desktopów) jest CICHYM no-opem — GPS działa
 * niezależnie od wygaszania, więc blokada nie może zepsuć rozgrywki (LESSONS L6).
 */
async function przytrzymajEkran() {
  if (STAN.wakeLock) return;
  if (typeof navigator === 'undefined' || typeof navigator.wakeLock?.request !== 'function') return;
  try {
    const blokada = await navigator.wakeLock.request('screen');
    STAN.wakeLock = blokada ?? null;
    // Przeglądarka zwalnia blokadę przy zejściu w tło — musimy o tym wiedzieć,
    // żeby po powrocie żądać jej ponownie zamiast trzymać martwy uchwyt.
    if (typeof blokada?.addEventListener === 'function') {
      blokada.addEventListener('release', () => { if (STAN.wakeLock === blokada) STAN.wakeLock = null; });
    }
  } catch {
    STAN.wakeLock = null; // odmowa albo brak zgody — gramy dalej bez blokady
  }
}

/** Zwalnia blokadę ekranu (koniec gry, albo porządek przed ponownym żądaniem). */
function zwolnijEkran() {
  const blokada = STAN.wakeLock;
  STAN.wakeLock = null;
  if (blokada && typeof blokada.release === 'function') {
    try { void blokada.release(); } catch { /* brak API = brak skutku */ }
  }
}

/** Stan blokady idzie za stanem gry — jedno miejsce (render gry i powrót z tła). */
function odswiezWakeLock() {
  const trzymaj = czyTrzymacEkran({
    rozgrywka: STAN.rozgrywka,
    fazaKoniec: FAZY.koniec,
    zakonczonaRecznie: STAN.graZakonczonaRecznie,
  });
  if (trzymaj) void przytrzymajEkran();
  else zwolnijEkran();
}

/**
 * Każda akcja gracza znaczy tyle samo (ADR 0040 pkt 5): licznik bezczynności
 * od zera, a jeśli przerwa już trwa — natychmiastowy, samoczynny powrót.
 */
function zaznaczAktywnosc() {
  STAN.ostatniaAkcjaMs = performance.now();
  if (STAN.przerwaBezczynnosci) wznowPoBezczynnosci();
}

/** Watchdog bezczynności: jedyna dozwolona przerwa w śledzeniu (15 min bez kliku). */
function sprawdzBezczynnosc() {
  if (STAN.przerwaBezczynnosci) return;
  if (!STAN.watcher?.czyAktywny()) return; // nie ma czego zatrzymywać
  if (!czyPrzerwaBezczynnosci({ ostatniaAkcjaMs: STAN.ostatniaAkcjaMs, terazMs: performance.now() })) return;
  STAN.przerwaBezczynnosci = true;
  STAN.przerwaStartMs = performance.now();
  zatrzymajSymulacje();
  zatrzymajGps();
  status(`Po ${Math.round(PRZERWA_BEZCZYNNOSCI_MS / 60000)} minutach bez żadnego kliku śledzenie odpoczywa — pierwszy dotyk wraca do gry sam.`);
}

/** Powrót po przerwie bezczynnościowej: dowolny klik, bez przycisku i pytania. */
function wznowPoBezczynnosci() {
  STAN.przerwaSkumulowanaMs += performance.now() - STAN.przerwaStartMs;
  STAN.przerwaStartMs = 0;
  STAN.przerwaBezczynnosci = false;
  STAN.historiaFixow = []; // pomiary sprzed przerwy nie rozstrzygają dojścia
  if (!STAN.trybTestowy && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  odswiezWakeLock();
  status('Śledzenie wróciło po dotknięciu ekranu — gramy dalej.');
}

/* ------------------------------------------------------- motyw i zapis */

function przelaczMotyw() {
  const obecny = document.documentElement.dataset.motyw === 'ciemny' ? 'ciemny' : 'jasny';
  const nowy = obecny === 'ciemny' ? 'jasny' : 'ciemny';
  document.documentElement.dataset.motyw = nowy;
  try { localStorage.setItem(KLUCZ_MOTYW, nowy); } catch (e) { void e; }
  $('przycisk-motyw').setAttribute('aria-pressed', String(nowy === 'ciemny'));
}

function zapiszKonfiguracje() {
  try {
    // m12-75: koperta z markerem kanonu — przy ZMIANIE tematów domyślnych
    // stare zapisy dostaną jednorazowe dopełnienie zamiast cichej wczorajszej listy.
    localStorage.setItem(KLUCZ_KONFIG, JSON.stringify({ schemat: 'konfig/1', kanon: KANON_SETUPU, konfig: STAN.konfig }));
  } catch (e) {
    void e; // prywatny tryb przeglądarki — gramy dalej w pamięci (ADR 0010)
  }
}

function wczytajKonfiguracje() {
  try {
    const surowe = localStorage.getItem(KLUCZ_KONFIG);
    if (!surowe) return;
    const { schemat, konfig, kanon } = JSON.parse(surowe);
    if (schemat !== 'konfig/1' || !konfig) return; // migracje: ADR 0010 pkt 6
    // sanitizacja: stary schemat albo ręczna edycja nie może wysypać UI
    STAN.konfig = oczyscKonfiguracje(konfig);
    // m12-75 / m12-84: marker kanonu jest PORÓWNYWANY, nie tylko obecny (audyt PR
    // #13, obserwacja 3). Dopełnienia idą per-wersja: zapis z markerem starszym
    // od KANON_SETUPU dostaje dokładnie te tematy, które doszły do domyślnych PO
    // jego wersji — a zapis bieżący (albo z nowszej wersji aplikacji) nie jest
    // ruszany, bo organizator mógł temat odptaszkować ZAMIERZENIE.
    STAN.konfig = dopelnijKonfiguracjeDoKanou(STAN.konfig, kanon);
    if (kanonSprzedBiezacego(kanon)) zapiszKonfiguracje();
  } catch (e) {
    void e;
  }
}

/* ----------------------------------------------------------- uruchomienie */

function banerStartowy() {
  const baner = $('baner');
  if (location.protocol === 'file:') {
    baner.hidden = false;
    baner.textContent = 'Otwarto z pliku (file://) — moduły ES i fetch nie działają. Uruchom serwer: npm run serwer, potem http://localhost:8000';
  } else if (!window.isSecureContext) {
    baner.hidden = false;
    baner.textContent = 'Brak HTTPS: geolokalizacja i Web Crypto będą zablokowane. Użyj GitHub Pages albo localhost.';
  }
}

/* ================================ M11/P4: gra na wielu urządzeniach (ADR 0019) */

/** Adres mostu gier (ADR 0020): wpisany w kod aplikacji — ten sam web app co repozytorium paczek. */
function urlMostuMulti() {
  return adresMostu();
}

/**
 * `window.fetch`, nie gołe `fetch` (LESSONS L18): Node ≥ 18 ma globalny fetch
 * i testy na atrapie DOM wołałyby prawdziwą sieć. Zwraca funkcję albo null
 * (środowisko bez fetch — wołający degraduje się JAWNIE, nigdy po cichu).
 */
function fetchPrzegladarki() {
  return typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
}

/**
 * Błąd mostu po polsku + KRÓTKI powód dla UI (`blad.powod`).
 *
 * Pełny komunikat idzie do `status()`, a krótki powód w nawiasie do miejsc,
 * gdzie zdanie musi zostać zdaniem („Repozytorium niedostępne (HTTP 403)…”).
 * Rozróżnienie przyczyn jest tu istotą sprawy: zgłoszenie właściciela
 * 2026-09-12 pokazało, że jeden zbiorczy komunikat „niedostępne” potrafi
 * ukryć i brak sieci, i zablokowane wdrożenie, i własną literówkę w schemacie.
 */
function bladMostuPoPolsku(e, { przekroczonyCzas, url, limitMs = LIMIT_MOSTU_MS }) {
  const sekundy = Math.max(1, Math.round(limitMs / 1000));
  if (przekroczonyCzas) {
    return bladZPowodem(
      `most Drive nie odpowiedział w ${sekundy} s — pierwsze żądanie po wdrożeniu bywa wolne, spróbuj za chwilę`,
      `brak odpowiedzi w ${sekundy} s`,
    );
  }
  const tekst = String(e?.message ?? e ?? '');
  if (e?.name === 'AbortError' || /abort/i.test(tekst)) {
    return bladZPowodem('połączenie z mostem Drive zostało przerwane — spróbuj jeszcze raz', 'przerwane połączenie');
  }
  if (/failed to fetch|networkerror|load failed/i.test(tekst)) {
    return bladZPowodem(
      'brak połączenia z mostem Drive — telefon jest offline albo adres repozytorium nie odpowiada',
      'brak połączenia',
    );
  }
  const http = /^HTTP (\d{3})$/.exec(tekst);
  if (http) {
    const kod = Number(http[1]);
    const podpowiedz = kod === 401 || kod === 403
      ? ' — sprawdź, czy wdrożenie web app ma dostęp „Każdy”'
      : '';
    return bladZPowodem(`most Drive odpowiedział HTTP ${kod}${podpowiedz}`, `HTTP ${kod}`);
  }
  return bladZPowodem(`${tekst}${url ? ` (${url})` : ''}`, tekst.slice(0, 80) || 'nieznany błąd');
}

/** Błąd z krótkim powodem dla UI (`powod`), czytanym przez `pobierzIndeksZRepo`. */
function bladZPowodem(wiadomosc, powod) {
  const blad = new Error(wiadomosc);
  blad.powod = powod;
  return blad;
}

/**
 * GET mostu, którego odpowiedź jest JSON-em (lobby, stan gry).
 *
 * Nasz własny limit czasu przerywa żądanie przez `AbortController`, a przeglądarka
 * opisuje to PO ANGIELSKU i od swojej strony: Chrome daje „signal is aborted
 * without reason”, Firefox „The user aborted a request.”. Dla gracza to bełkot,
 * więc rozróżniamy nasze przerwanie od prawdziwej awarii sieci i zawsze oddajemy
 * komunikat po polsku (LESSONS L6: komunikat musi nazywać przyczynę, nie wyjątek).
 */
async function pobierzGetMulti(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw new Error('to środowisko nie ma fetch — nie da się zapytać mostu');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let przekroczonyCzas = false;
  const timer = setTimeout(() => { przekroczonyCzas = true; kontroler?.abort(); }, LIMIT_MOSTU_MS);
  try {
    const odp = await f(url, kontroler ? { signal: kontroler.signal } : undefined);
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    return await odp.json();
  } catch (e) {
    throw bladMostuPoPolsku(e, { przekroczonyCzas, url: null });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET, którego odpowiedź jest tekstem (indeks/paczka z repozytorium — M9b).
 * Ten sam limit i ten sam słownik błędów co `pobierzGetMulti`: panel paczek ma
 * umieć powiedzieć, CO się nie udało (LESSONS L6).
 */
async function pobierzGetTekst(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw bladZPowodem('to środowisko nie ma fetch — nie da się zapytać mostu', 'brak fetch w tej przeglądarce');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let przekroczonyCzas = false;
  const timer = setTimeout(() => { przekroczonyCzas = true; kontroler?.abort(); }, LIMIT_MOSTU_MS);
  try {
    const odp = await f(url, kontroler ? { signal: kontroler.signal } : undefined);
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    return await odp.text();
  } catch (e) {
    throw bladMostuPoPolsku(e, { przekroczonyCzas, url });
  } finally {
    clearTimeout(timer);
  }
}

/** Usterki gotowości (pseudonim, zgoda, most) jako tekst do `pokazBledy`. */
function pokazBledyMulti(komunikaty) {
  pokazBledy('bledy-multi', komunikaty.map((komunikat) => ({ komunikat })));
  if (komunikaty.length) status(komunikaty[0]);
}

/**
 * Walidacja przed KAŻDĄ wysyłką na most. Zgody NIE sprawdzamy (właściciel,
 * 2026-09-07): gra na wielu telefonach z natury działa przez wspólny Drive,
 * a co i dokąd trafia opisuje sekcja „Dane i prywatność". Kto nie chce
 * wysyłać niczego, gra w hot-seat.
 */
function walidujGotowoscMulti() {
  const usterki = [];
  if (!urlMostuMulti()) usterki.push('Brak adresu mostu w tej wersji aplikacji (ADR 0020) — gra na wielu urządzeniach jest wyłączona. Wybierz rodzaj gry „Hot-seat”, żeby grać na jednym telefonie.');
  // Tożsamość multi = imię+PIN z bloku „Kto gra?” jak w hot-seat (właściciel,
  // 2026-09-11, profil na wspólnym Drive) — dokładnie JEDEN gracz na telefon.
  const imiona = (STAN.konfig.imiona ?? []).filter(Boolean);
  if (!imiona.length) usterki.push('Wpisz swoje imię i PIN w bloku „Kto gra?” — to Twoja tożsamość w grze.');
  else if (imiona.length > 1) usterki.push('W grze na wielu urządzeniach gra z tego telefonu tylko jedna osoba — usuń pozostałych graczy z listy (✕ Usuń).');
  return usterki;
}

/** Imię potwierdzonego gracza — tożsamość multi zamiast dawnego pola pseudonimu. */
function pseudonimGraczaMulti() {
  return normalizujPseudonim(STAN.konfig.imiona?.[0] ?? '').trim().slice(0, 24);
}

function wczytajUstawieniaMulti() {
  pokazStanMostu(); // adres mostu jest w kodzie (ADR 0020) — UI pokazuje stan, nie pole do wpisywania
  if (typeof localStorage !== 'undefined' && localStorage.getItem(KLUCZ_RODZAJU_GRY) === 'multi') {
    STAN.rodzajGry = 'multi';
  }
}

/** Segment „Rodzaj gry” na setupie (właściciel, 2026-09-11): toggle obok
 *  siebie jak środek transportu — hot-seat albo gra na wielu urządzeniach. */
const RODZAJE_GRY = {
  hotseat: { etykieta: '👥 Hot-seat — jeden telefon' },
  multi: { etykieta: '📱 Multiplayer — każdy ma telefon' },
};

const OPISY_RODZAJOW = {
  hotseat: 'Jeden telefon podawany dalej — wszyscy gracze są na liście poniżej.',
  multi: 'Każdy gracz ma swój telefon. Możesz być hostem albo dołączyć do istniejącej gry.',
};

function renderujRodzajeGry() {
  renderujSegment('lista-rodzajow', RODZAJE_GRY, STAN.rodzajGry, (wybrany) => {
    STAN.rodzajGry = wybrany === 'multi' ? 'multi' : 'hotseat';
    if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_RODZAJU_GRY, STAN.rodzajGry);
    renderujRodzajGry();
    $('rodzaj-opis').textContent = OPISY_RODZAJOW[STAN.rodzajGry];
    status(STAN.rodzajGry === 'multi'
      ? 'Gra na wielu urządzeniach: potwierdź swoje imię i PIN, wybierz ścieżkę — zakładasz albo dołączasz.'
      : 'Hot-seat: jeden telefon podawany dalej (ADR 0009).');
  });
  $('rodzaj-opis').textContent = OPISY_RODZAJOW[STAN.rodzajGry];
}

/** Segment „Co robisz?” na karcie multi (m12-74): załóż nową / dołącz. */
const SCIEZKI_MULTI = {
  zaloz: { etykieta: '🚀 Zakładam nową grę' },
  dolacz: { etykieta: '🚪 Dołączam do istniejącej' },
};

const OPISY_SCIEZEK = {
  zaloz: 'Jesteś hostem nowej rozgrywki. Zaloguj się, wybierz odpowiednie opcje i przejdź dalej.',
  dolacz: 'Zobaczysz gry, których host jest w zasięgu ~50 m — dołączasz jednym kliknięciem, bez kodu. Możesz opuścić grę w dowolnym momencie.',
};

/**
 * „Ty w tej grze" jedzie POD OPIS ŚCIEŻKI, gdy gramy w multi (właściciel,
 * 2026-09-12) — login jest pierwszym krokiem obu ścieżek, więc nie może
 * siedzieć pod opcjami hosta. Poza multi pole wraca na swoje miejsce w setupie.
 * Przenosimy WĘZEŁ, nie kopię: `id` zostaje ten sam, więc nasłuchy, testy
 * i `renderujPolaTozsamosci` nie wiedzą o przeprowadzce.
 */
function umiescTozsamosc(multi) {
  const pole = $('pole-tozsamosc');
  const slot = $(multi ? 'multi-slot-tozsamosc' : 'slot-tozsamosc-dom');
  if (!pole || !slot || pole.parentNode === slot) return;
  slot.appendChild(pole);
}

/**
 * Lista gier ~50 m: OSOBNY BOKS i DOPIERO po zalogowaniu (właściciel,
 * 2026-09-12). Bez potwierdzonego imienia most i tak odmawia zapytania
 * (`odswiezListeGierNaSetupie`), więc pusty boks tylko zajmował miejsce.
 */
function renderujPanelDolacz() {
  const dolacz = STAN.rodzajGry === 'multi' && STAN.multiSciezka === 'dolacz';
  $('multi-panel-dolacz').hidden = !(dolacz && Boolean(pseudonimGraczaMulti()));
}

function renderujMultiSciezka() {
  renderujSegment('multi-sciezka', SCIEZKI_MULTI, STAN.multiSciezka, (wybrany) => {
    STAN.multiSciezka = wybrany === 'dolacz' ? 'dolacz' : 'zaloz';
    renderujRodzajGry();
    $('multi-sciezka-opis').textContent = OPISY_SCIEZEK[STAN.multiSciezka];
    // „Dołączam do istniejącej” (właściciel, uwagi terenowe #3 2026-09-11):
    // lista gier w okolicy pokazuje się OD RAZU na setupie — GPS startuje
    // sam (jeśli trzeba), status mówi, co się dzieje.
    if (STAN.multiSciezka === 'dolacz') void odswiezListeGierNaSetupie();
  });
  $('multi-sciezka-opis').textContent = OPISY_SCIEZEK[STAN.multiSciezka];
}

/**
 * Lista gier w zasięgu ~50 m na setupie (m12-75): dołączający widzi ją pod
 * blokiem „Kto gra?”, bez przechodzenia na osobny ekran. GPS włącza się sam —
 * bez pozycji lista nie ma czym filtrować (~50 m, geohash8 hosta). Wołana z
 * kilku miejsc (klik segmentu, odśwież, zmiana graczy) — dlatego NA WEJŚCIU
 * odmawia, gdy kontekst nie pasuje (hot-seat ani gość bez znanego imienia nie
 * robią żadnego zapytania do mostu).
 */
async function odswiezListeGierNaSetupie() {
  if (STAN.rodzajGry !== 'multi' || STAN.multiSciezka !== 'dolacz') return;
  const panel = $('multi-panel-dolacz');
  if (panel.hidden) return;
  if (!STAN.pozycja && !STAN.trybTestowy && !STAN.watcher?.czyAktywny()) {
    status('Włączam GPS — lista pokazuje gry w zasięgu ~50 m od Ciebie.');
    wlaczGps();
  }
  // Bez potwierdzonego imienia nie pytamy mostu (zero wysyłek). Komunikatu
  // „zaloguj się" tu nie ma: od 2026-09-12 cały boks jest schowany do czasu
  // zalogowania, więc nie ma go gdzie pokazać (właściciel).
  if (!pseudonimGraczaMulti()) return;
  await odswiezLobby();
}

/**
 * Przełączanie widoczności pól setupu wg rodzaju gry i ścieżki multi
 * (przepisany flow, właściciel 2026-09-11): w multi znika „pytań na stację”
 * (liczba stacji = liczba pytań), a tryb gry i trasa-sekret wybiera
 * zakładający. Dołączający nie ustawia nic poza sobą.
 */
function renderujRodzajGry() {
  const multi = STAN.rodzajGry === 'multi';
  const zaloz = multi && STAN.multiSciezka === 'zaloz';
  const dolacz = multi && STAN.multiSciezka === 'dolacz';
  $('karta-multi').hidden = !multi;
  // Pola „pytań na stację" nie ma w żadnym trybie (uwaga B, 2026-09-15) —
  // zostaje po nim tylko przeliczenie planu: multi daje jedno pytanie na
  // stację, hot-seat po jednym na gracza.
  synchronizujPytaniaZTrybem();
  przeliczPromienZCzasu(); // pytania wchodzą do wzoru na promień (ADR 0025)
  $('pole-multi-tryb').hidden = !zaloz;
  renderujSekretTrasy();
  // Dołączanie (właściciel, uwagi terenowe #3 pkt 4d 2026-09-11): po wybraniu
  // „Dołączam do istniejącej” z setupu zostaje tylko „Ty w tej grze” i lista
  // gier w odległości ≤50 m — wszystkie opcje hosta znikają.
  umiescTozsamosc(multi); // 2026-09-12: login zaraz pod opisem ścieżki
  renderujPanelDolacz();  // 2026-09-12: boks listy dopiero po zalogowaniu
  for (const id of ['pole-tryb', 'pole-czas', 'pole-parametry', 'pole-wiek', 'pole-tematy']) {
    const el = $(id);
    if (el) el.hidden = dolacz;
  }
  const promienInfo = $('setup-promien-info');
  if (promienInfo) promienInfo.hidden = dolacz;
  $('przycisk-dalej-pozycja').hidden = dolacz; // dalej wiodą przyciski „Dołącz” z listy
  $('legend-tozsamosc').textContent = multi ? '👤 Ty w tej grze' : '👤 Kto gra?';
  $('przycisk-dodaj-gracza').textContent = multi ? '✔ Potwierdź — to ja' : '➕ Dodaj gracza';
  renderujPolaTozsamosci(); // pkt 4i: w multi po wpisaniu siebie pola znikają
}

/**
 * Uwagi terenowe #3 (właściciel 2026-09-11, pkt 4i): w multiplayerze ten
 * telefon obsługuje DOKŁADNIE jedną osobę — po dodaniu „Ty w tej grze” pola
 * wpisywania (imię/PIN, przycisk i skróty zapamiętanych) chowają się, żeby
 * nikt nie dodał drugiego gracza; wracają, gdy lista znów jest pusta.
 */
function renderujPolaTozsamosci() {
  const ukryj = STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1;
  const siatka = $('pole-tozsamosc-siatka');
  if (siatka) siatka.hidden = ukryj;
  $('przycisk-dodaj-gracza').hidden = ukryj;
  const zapamietani = $('lista-zapamietanych');
  if (zapamietani) zapamietani.hidden = ukryj;
  renderujPanelDolacz(); // zalogowany dołączający dostaje boks z listą gier
}

/** Ptaszek „widoczna tylko kolejna stacja” — tylko trasa + ścieżka zakładania. */
function renderujSekretTrasy() {
  $('pole-trasa-sekret').hidden = !(STAN.rodzajGry === 'multi' && STAN.multiSciezka === 'zaloz' && STAN.multiTryb === TRYBY_GRY.trasa);
}

/* --- sesja multi w localStorage: powrót do gry po zgaszeniu ekranu/odświeżeniu --- */

function zapiszSesjeMulti() {
  if (typeof localStorage === 'undefined' || !STAN.multi) return;
  const m = STAN.multi;
  try {
    localStorage.setItem(KLUCZ_SESJI_MULTI, JSON.stringify({
      kod: m.gra.kod, idGry: m.gra.idGry ?? null, graczId: m.graczId,
      pseudonim: m.pseudonim, urlMostu: m.urlMostu, rola: m.rola, zapisano: new Date().toISOString(),
    }));
  } catch { /* quota — gra toczy się dalej, tylko bez powrotu po odświeżeniu */ }
}

function czytajSesjeMulti() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(KLUCZ_SESJI_MULTI) ?? 'null');
    return s && typeof s.kod === 'string' && typeof s.graczId === 'string' && typeof s.urlMostu === 'string' && s.urlMostu ? s : null;
  } catch {
    return null;
  }
}

function usunSesjeMulti() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(KLUCZ_SESJI_MULTI);
    // Zaległe zdarzenia gry, której telefon już nie pamięta, nie mają dokąd
    // iść — kolejka idzie w kosz razem z sesją (ADR 0019 aneks 2026-09-13d).
    localStorage.removeItem(KLUCZ_KOLEJKI_MULTI);
  }
}

/* `renderujWznowienieMulti()` i karta `#multi-wznowienie` („↩ Wróć do gry" /
   „🗑 Porzuć zapamiętaną grę") USUNIĘTE (uwagi J i K, ADR 0045): telefon wraca do
   zapamiętanej gry wieloosobowej SAM przy starcie (`przywrocGreMulti`), a sesję
   kasuje wyjście z lobby (`opuscLobby`), zamknięcie gry przez most
   (`onStanGryMulti`) i rezygnacja (`rezygnujZGryMulti`). */

/* --- ekrany i panele --- */

function otworzPanelMulti(panel) {
  // m12-75: ekran multi to już TYLKO lobby — lista „Dołącz” żyje na setupie
  // (właściciel, uwagi terenowe #3 2026-09-11). Zakładanie również na setupie.
  if (panel !== 'lobby') return;
  // Wejście do lobby rozbraja potwierdzenie wyjścia: uzbrojenie z poprzedniego
  // wejścia nie może zostać w przycisku (audyt PR #13 pkt 2).
  STAN.multiOpuszczenieUzbrojone = false;
  $('przycisk-lobby-opusc').textContent = 'Opuść lobby';
  $('multi-panel-lobby').hidden = false;
  pokazBledy('bledy-multi', []);
  pokazEkran('multi');
}

/**
 * Tryby gry wieloosobowej (właściciel, 2026-09-11): Wspólna Trasa i Wyścig
 * na Orientację. Punktacja jest WSPÓLNA (zdanie pod listą, w index.html —
 * bez dublowania), różni się tylko kolejność stacji.
 */
function renderujTrybyMulti() {
  const lista = $('multi-tryby');
  lista.replaceChildren();
  const etykiety = {
    trasa: '🗺️ Wspólna Trasa — ta sama trasa, po kolei',
    wyscig: '🏁 Wyścig na Orientację — dowolna kolejność stacji',
  };
  const opisy = {
    [TRYBY_GRY.trasa]: 'Wszyscy pokonują tą samą trasę, każdy na swoim telefonie i we własnym tempie. Stacje przechodzi się po kolei.',
    [TRYBY_GRY.wyscig]: 'Każdy idzie własną trasą, a kolejność stacji jest dowolna.',
  };
  for (const klucz of [TRYBY_GRY.trasa, TRYBY_GRY.wyscig]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk';
    b.textContent = etykiety[klucz];
    b.setAttribute('aria-pressed', String(STAN.multiTryb === klucz));
    b.addEventListener('click', () => {
      STAN.multiTryb = klucz;
      renderujTrybyMulti();
      renderujSekretTrasy(); // ptaszek tylko przy Wspólnej Trasie
    });
    lista.appendChild(b);
  }
  $('multi-tryb-opis').textContent = opisy[STAN.multiTryb] ?? opisy[TRYBY_GRY.trasa];
  renderujSekretTrasy();
}

/**
 * Pytania paczki bieżącej sesji — do liczenia FAKTYCZNYCH tematów w meta
 * (właściciel, 2026-09-11). Paczka jest jawna i zostaje w pamięci (ADR 0050).
 */
function pytaniaBiezacejSesji() {
  return Array.isArray(STAN.paczka?.pytania) ? STAN.paczka.pytania : [];
}

/** Wariant weryfikacji bieżącej sesji (ADR 0032 + ADR 0050): pieczątka paczki. */
function factcheckBiezacejSesji() {
  return czyFactcheckPaczki(STAN.paczka);
}

/** Meta zestawu z sesji — bez pozycji liczymy od pierwszej stacji (uczciwe: i tak tam idziemy). */
function metaSesjiMulti(stacje) {
  const punkt = STAN.pozycja ?? (stacje.length ? { lat: stacje[0].lat, lon: stacje[0].lon } : null);
  if (!punkt) return null;
  return zbierzMetaZestawu({
    lat: punkt.lat, lon: punkt.lon,
    promienM: STAN.konfig.promienM, tematy: STAN.konfig.tematy, wiek: STAN.konfig.wiek,
    jezyk: STAN.konfig.jezyk, miejsce: STAN.miejsce ?? '',
    liczbaStacji: stacje.length, pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematWlasny: STAN.konfig.tematWlasny ?? '',
    factcheck: factcheckBiezacejSesji(),
    pytania: pytaniaBiezacejSesji(),
    opisStacjiStartu: stacje[0]?.opis ?? '', // ulica do nazwy pliku (ADR 0048)
  });
}

/* --- zakładanie, dołączanie, lobby --- */

/**
 * M11/P5: w trybie testowym (`?odstep=0`) synchronizacja dostaje RĘCZNY
 * harmonogram — zero pollingu w tle, test sam pompuje kroki przez
 * `window.__MULTI_TIMERY__`. W przeglądarce: zwykły `setTimeout`.
 */
function harmonogramMulti() {
  if (STAN.odstepOverpassMs !== 0) return undefined;
  const timery = [];
  if (typeof window !== 'undefined') window.__MULTI_TIMERY__ = timery;
  return {
    ustaw: (fn) => { timery.push(fn); return timery.length - 1; },
    czysc: (id) => { timery[id] = null; },
  };
}

function wejdzDoGryMulti(gra, graczId, rola) {
  zatrzymajSyncMulti();
  STAN.multi = {
    rola, gra, graczId,
    pseudonim: pseudonimGraczaMulti(), // imię+PIN z setupu (właściciel, 2026-09-11)
    urlMostu: urlMostuMulti(),
    ostatniStanMs: Date.now(),
    sync: null,
  };
  STAN.multi.sync = utworzSynchronizacje({
    urlMostu: STAN.multi.urlMostu,
    graczId,
    kod: gra.kod,
    idGry: gra.idGry ?? null,
    onStan: onStanGryMulti,
    onBlad: (komunikat) => { status(`Gra wieloosobowa: ${komunikat}`); renderujPasekSync(); },
    timeout: harmonogramMulti(),
    // Zdarzenia, które nie doszły na most, przeżywają odświeżenie telefonu
    // (ADR 0019 aneks 2026-09-13d): kolejka jest w pamięci, nie tylko w RAM.
    wczytajKolejke: () => kolejkaZdarzenMulti(gra.kod),
    zapiszKolejke: (zdarzenia) => zapiszKolejkeZdarzenMulti(zdarzenia, gra.kod),
    limitKolejki: LIMIT_KOLEJKI_ZDARZEN,
  });
  zapiszSesjeMulti();
  otworzPanelMulti('lobby');
  onStanGryMulti(gra); // lobby widoczne od razu, nie po pierwszym pollingu
  STAN.multi.sync.start();
}

function zatrzymajSyncMulti() {
  STAN.multi?.sync?.stop();
  if (STAN.multi) STAN.multi.sync = null;
}

async function zalozGreMulti() {
  // m12-74 (właściciel, 2026-09-11): grę zakłada się PO wklejeniu odpowiedzi
  // modelu (albo po wybraniu pasującej paczki na ekranie pozycji) — paczka
  // bieżącej sesji jest źródłem pytań i stacji, bez listy źródeł i kodów.
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyMulti(usterki); return; }
  const stacje = STAN.stacje.map((st) => ({ id: st.id, lat: st.lat, lon: st.lon, opis: st.opis ?? '' }));
  const paczka = STAN.paczka;
  const meta = metaSesjiMulti(stacje);
  if (!stacje.length || !paczka?.pytania?.length || !meta) {
    pokazBledyMulti(['Nie ma z czego założyć gry — najpierw wygeneruj stacje i pytania albo wybierz paczkę na ekranie pozycji.']);
    return;
  }
  const sekret = STAN.multiTryb === TRYBY_GRY.trasa && STAN.multiTrasaSekret;
  status('Zakładam grę na mostku Drive…', { czeka: true }); // zimny start web app bywa długi (uwaga B1)
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-zaloz',
      tryb: STAN.multiTryb,
      trasaSekret: sekret, // właściciel 2026-09-11: własność GRY (mapa w grze), nie konfiguracji
      organizator: { pseudonim: pseudonimGraczaMulti() },
      konfiguracja: {
        liczbaStacji: stacje.length,
        pytaniaNaStacje: 1, // liczba stacji = liczba pytań (właściciel, 2026-09-11)
        wiek: meta.wiek,
        tematy: meta.tematy,
        promienM: meta.promienM,
        miejsce: meta.miejsce ?? '',
        geohash5: meta.geohash5,
        geohash8: STAN.pozycja ? geohash(STAN.pozycja.lat, STAN.pozycja.lon, 8) : '', // ~40 m: miara zasięgu 50 m
      },
      zestaw: { stacje, paczka, meta },
    });
    status('Gra założona — gracze w zasięgu ~50 m zobaczą Cię na liście „Dołącz do gry”. Startujesz z lobby, kiedy zechcesz (możesz i solo).');
    wejdzDoGryMulti(wynik.gra, wynik.gra.organizatorId, 'organizator');
  } catch (e) {
    status(`Nie udało się założyć gry: ${e?.message ?? e}`);
    pokazBledyMulti([`Nie udało się założyć gry: ${e?.message ?? e}`]);
  }
}
/** Błędy dołączania lądują tam, gdzie jest gracz: na setupie (lista w karcie
 *  multi) wracają do `bledy-setup`, na ekranie multi do `bledy-multi`. */
function pokazBledyDolacza(usterki) {
  if (!usterki.length) { pokazBledy('bledy-setup', []); pokazBledyMulti([]); return; }
  if (STAN.ekran === 'multi') {
    pokazBledyMulti(usterki);
  } else {
    pokazBledy('bledy-setup', usterki.map((komunikat) => ({ komunikat })));
    status(usterki[0]);
  }
}

async function dolaczDoGryMulti({ idGry = null } = {}) {
  // Właściciel 2026-09-11 (odpowiedź 4A): dołączanie kodem USUNIĘTE —
  // zostaje lista gier w zasięgu ~50 m od hosta, renderowana na setupie.
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyDolacza(usterki); return; }
  if (!idGry) {
    pokazBledyDolacza(['Nie wiem, do której gry dołączyć — wybierz hosta z listy gier w okolicy.']);
    return;
  }
  status('Dołączam do gry z listy…', { czeka: true });
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-dolacz',
      idGry,
      pseudonim: pseudonimGraczaMulti(),
    });
    wejdzDoGryMulti(wynik.gra, wynik.graczId, 'gosc');
    status('Jesteś w grze — czekasz w lobby, aż host wystartuje.');
  } catch (e) {
    status(`Nie udało się dołączyć: ${e?.message ?? e}`);
    pokazBledyDolacza([`Nie udało się dołączyć: ${e?.message ?? e}`]);
  }
}

/** Status lobby w `#multi-lobby-status` — ten sam zwyczaj co `status()`:
 *  `czeka: true` pulsuje w negatywie, każdy kolejny tekst gasi pulsowanie
 *  (uwaga B2, 2026-09-14: czekanie na listę gier ma być widoczne tak samo jak
 *  inne oczekiwania, a komunikat nie wymienia „mostu Drive"). */
function statusLobby(tekst, { czeka = false } = {}) {
  const pole = $('multi-lobby-status');
  if (!pole) return;
  pole.textContent = tekst;
  pole.classList.toggle('pulsuje', czeka);
}

async function odswiezLobby() {
  const url = urlMostuMulti();
  const lista = $('multi-lobby-lista');
  if (!url) {
    statusLobby('Brak adresu mostu w tej wersji aplikacji — lista gier w okolicy jest niedostępna.' + ADR(' (ADR 0020)'));
    return;
  }
  if (!STAN.pozycja) {
    lista.replaceChildren();
    statusLobby('Czekam na Twoją pozycję — lista pokazuje gry w zasięgu ~50 m od hosta.');
    return;
  }
  statusLobby('Pobieram listę gier…', { czeka: true });
  try {
    const odpowiedz = await pobierzGetMulti(urlGet(url, 'gry'));
    const { wpisy, usterki } = walidujLobbySurowe(JSON.stringify(odpowiedz ?? null));
    if (usterki.length && !wpisy.length) throw new Error(usterki[0].komunikat);
    // Dołączenie tylko w lobby — po starcie nowi gracze nie wchodzą
    // (właściciel, 2026-09-11, odpowiedź 2).
    const otwarte = wpisy.filter((w) => w.stan === 'lobby');
    // ~50 m od hosta (właściciel, 2026-09-11): komórka geohash8 (~40 m) +
    // sąsiedzi, pozycja hosta z chwili założenia gry.
    const bliskie = filtrujLobby(otwarte, { geohash8: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 8) });
    lista.replaceChildren();
    for (const wpis of bliskie) {
      const li = document.createElement('li');
      const opis = document.createElement('span');
      // Tylko host, bez dodatkowych informacji (właściciel, 2026-09-11).
      opis.textContent = `Host: ${wpis.organizator ?? '?'}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk przycisk-maly';
      b.textContent = 'Dołącz';
      b.addEventListener('click', () => { void dolaczDoGryMulti({ idGry: wpis.idGry }); });
      li.append(opis, b);
      lista.appendChild(li);
    }
    statusLobby(bliskie.length
      ? `Gry w zasięgu ~50 m: ${bliskie.length}.`
      : 'Brak gier w zasięgu ~50 m — załóż własną albo odśwież za chwilę.');
  } catch (e) {
    statusLobby(`Nie udało się pobrać listy gier: ${e?.message ?? e}`);
  }
}

// m12-75: dawny handler listy gier z ekranu multi przeniósł się na setup —
// `odswiezListeGierNaSetupie` przy segmencie „Dołączam” i przycisku odświeżania.
async function startLobby() {
  const m = STAN.multi;
  if (!m || m.rola !== 'organizator') return;
  const przycisk = $('przycisk-lobby-start');
  // Właściciel (uwaga terenowa 2026-09-16, pkt 3): klik „▶ Start gry” musi OD
  // RAZU coś zrobić na ekranie — zimny start mostu Drive bywa długi, a nieruchomy
  // przycisk wyglądał na zawieszony. Zapamiętujemy etykietę, blokujemy drugie
  // kliknięcie i zamieniamy przycisk w pulsujący napis „Łączę z siecią” na cały
  // czas połączenia. Po sukcesie lobby znika (gra się otwiera), więc przywrócenie
  // etykiety należy się tylko ścieżce błędu.
  przycisk.dataset.etykieta = przycisk.dataset.etykieta ?? '▶ Start gry';
  const zalaczLaczenie = (wlaczone) => {
    przycisk.disabled = wlaczone;
    przycisk.textContent = wlaczone ? 'Łączę z siecią' : przycisk.dataset.etykieta;
    przycisk.classList.toggle('pulsuje', wlaczone);
  };
  status(`Łączę z siecią — startuję grę ${m.gra.kod}…`);
  zalaczLaczenie(true);
  try {
    const wynik = await polecenieMostu(m.urlMostu, {
      akcja: 'gra-start', kod: m.gra.kod, idGry: m.gra.idGry ?? null, organizatorId: m.graczId,
    });
    onStanGryMulti(wynik.gra);
  } catch (e) {
    status(`Nie udało się wystartować gry: ${e?.message ?? e}`);
  } finally {
    // Etykieta i blokada wracają ZAWSZE — także po sukcesie (audyt PR #35,
    // LESSONS L77). Lobby po starcie znika, ale węzeł przycisku żyje dłużej niż
    // jedna gra: stan „w locie” nie może przeciec do NASTĘPNEGO lobby, bo host
    // nie wystartowałby drugiej gry bez odświeżenia strony.
    zalaczLaczenie(false);
  }
}

function opuscLobby() {
  const m = STAN.multi;
  if (!m) { pokazEkran('setup'); return; }
  const organizator = m.rola === 'organizator';
  // Audyt PR #13 pkt 2: wyjście organizatora zamyka grę WSZYSTKIM (most
  // przenosi ją do archiwum — bez organizatora nie ma kto wystartować), więc
  // jest to akcja nieodwracalna i idzie dwustopniowo, jak rezygnacja w grze
  // (`rezygnujZGryMulti`) i kasowanie danych. Gość wychodzi jednym klikiem:
  // przed startem może dołączyć ponownie z listy gier w okolicy.
  if (organizator && !STAN.multiOpuszczenieUzbrojone) {
    STAN.multiOpuszczenieUzbrojone = true;
    $('przycisk-lobby-opusc').textContent = '⚠ Kliknij ponownie, aby zamknąć grę';
    status('Wyjście organizatora ZAMYKA grę dla wszystkich — nikt już nie wystartuje. Kliknij ponownie, aby potwierdzić.');
    return;
  }
  STAN.multiOpuszczenieUzbrojone = false;
  $('przycisk-lobby-opusc').textContent = 'Opuść lobby';
  const url = m.urlMostu ?? urlMostuMulti();
  const cialo = {
    akcja: 'gra-opusc',
    idGry: m.gra?.idGry ?? null,
    kod: m.gra?.kod ?? null,
    graczId: m.graczId,
  };
  status(organizator
    ? 'Wychodzisz z lobby — zamykam grę, bo bez organizatora nie może wystartować.'
    : 'Wychodzisz z lobby. Dopóki gra nie wystartowała, możesz dołączyć ponownie z listy gier w okolicy.');
  zatrzymajSyncMulti();
  usunSesjeMulti();
  STAN.multi = null;
  pokazEkran('setup');
  // Telefon jest wolny od razu — polecenie idzie w tle. Bez niego wychodzący
  // zostawał w `liczbaGraczy` na liście gier: lobby obiecywało grę z graczem,
  // którego już nie było, a odświeżanie listy (10 s) niczego nie prostowało.
  if (!url) return;
  void polecenieMostu(url, cialo).catch((e) => {
    status(`Wyszedłeś z lobby, ale most tego nie przyjął (${e?.message ?? e}) — inni mogą Cię widzieć na liście, dopóki gra nie zniknie.`);
  });
}

/**
 * Powrót do gry po odświeżeniu telefonu: sesja z localStorage + stan z mostu.
 * Od ADR 0045 (uwaga K) wołamy ją SAMI przy starcie aplikacji — karty
 * `#multi-wznowienie` z przyciskiem „↩ Wróć do gry" nie ma (uwaga J).
 */
/**
 * Zaległe zdarzenia gry sieciowej z pamięci telefonu (ADR 0019 aneks
 * 2026-09-13d). Odpowiedź udzielona bez zasięgu czekała dotąd TYLKO w RAM
 * (`app/sync.js`), więc odświeżenie telefonu ją gubiło: most nie poznawał
 * odpowiedzi, a stacja zostawała do przejścia jeszcze raz. Teraz kolejka jest
 * utrwalona i wychodzi PRZED pobraniem stanu gry — inaczej telefon zbudowałby
 * trasę ze stacją, którą most właśnie domknął.
 */
function kolejkaZdarzenMulti(kod) {
  const pamiec = pamiecOcen();
  if (!pamiec || !kod) return [];
  let surowy = null;
  try {
    surowy = JSON.parse(pamiec.getItem(KLUCZ_KOLEJKI_MULTI) ?? 'null');
  } catch {
    surowy = null; // zepsuty wpis = pusta kolejka, nigdy wyjątek
  }
  return walidujKolejkeZdarzen(surowy, { kod });
}

function zapiszKolejkeZdarzenMulti(zdarzenia, kod) {
  const pamiec = pamiecOcen();
  if (!pamiec) return;
  if (!Array.isArray(zdarzenia) || zdarzenia.length === 0) {
    pamiec.removeItem(KLUCZ_KOLEJKI_MULTI); // pusta kolejka nie zajmuje pamięci
    return;
  }
  pamiec.setItem(KLUCZ_KOLEJKI_MULTI, JSON.stringify(zapisKolejkiZdarzen(zdarzenia, {
    kod: kod ?? STAN.multi?.gra?.kod ?? '',
    idGry: STAN.multi?.gra?.idGry ?? null,
  })));
}

/**
 * Wypchnięcie utrwalonych zdarzeń PRZED pobraniem stanu gry. Odmowa mostu
 * (gra skończona albo odpowiedź już u niego jest) kasuje zdarzenie — duplikatu
 * nie będzie, bo most odrzuca drugą odpowiedź tego gracza do tej stacji
 * (`przyjmijZdarzenie`). Awaria sieci zostawia resztę w pamięci: przejmie ją
 * `sync.js` przy pierwszym udanym kroku.
 */
async function dostarczZalegleZdarzeniaMulti(sesja) {
  const zalegle = kolejkaZdarzenMulti(sesja?.kod);
  if (zalegle.length === 0) return;
  status(`Wysyłam zaległe zdarzenia gry (${zalegle.length}) — odpowiedź zapisana bez połączenia z mostem…`, { czeka: true });
  let i = 0;
  for (; i < zalegle.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop — kolejność zdarzeń jest częścią kontraktu
      await polecenieMostu(sesja.urlMostu, { akcja: 'gra-zdarzenie', zdarzenie: zalegle[i] });
    } catch (e) {
      if (e?.odmowaMostu) continue; // most już to zna albo gra nie trwa — nie ponawiamy
      break; // nadal offline: to i wszystkie następne zostają w pamięci telefonu
    }
  }
  const zostale = zalegle.slice(i);
  const dostarczone = zalegle.length - zostale.length;
  zapiszKolejkeZdarzenMulti(zostale, sesja?.kod);
  if (dostarczone > 0) {
    status(zostale.length === 0
      ? `Zaległe zdarzenia gry (${dostarczone}) doszły na most — punkty są policzone.`
      : `Zaległe zdarzenia: ${dostarczone} doszło na most, ${zostale.length} czeka na połączenie.`);
  }
}

async function przywrocGreMulti() {
  const sesja = czytajSesjeMulti();
  if (!sesja) return;
  status(`Wracam do gry ${sesja.kod}…`, { czeka: true });
  await dostarczZalegleZdarzeniaMulti(sesja);
  // `definitywnie` = most odpowiedział i mówi „nie ma takiej gry / nie ma Cię na
  // liście" — wtedy nie ma do czego wracać i sesja idzie w kosz. Awaria sieci to
  // co innego: sesja zostaje, a następne otwarcie aplikacji spróbuje znowu.
  let definitywnie = false;
  try {
    const odpowiedz = await pobierzGetMulti(urlStanGry(sesja.urlMostu, { kod: sesja.kod, idGry: sesja.idGry }));
    if (!odpowiedz?.ok || !odpowiedz.gra) { definitywnie = true; throw new Error(odpowiedz?.blad ?? 'most nie zwrócił stanu gry'); }
    const gra = odpowiedz.gra;
    if (gra.schemat !== SCHEMAT_GRY) { definitywnie = true; throw new Error(`nieznany schemat gry: ${gra.schemat}`); }
    if (!gra.gracze.some((g) => g.id === sesja.graczId)) { definitywnie = true; throw new Error('nie ma Cię już na liście graczy tej gry'); }
    STAN.multi = {
      rola: sesja.rola, gra, graczId: sesja.graczId, pseudonim: sesja.pseudonim,
      urlMostu: sesja.urlMostu, ostatniStanMs: Date.now(), sync: null,
    };
    STAN.multi.sync = utworzSynchronizacje({
      urlMostu: sesja.urlMostu, graczId: sesja.graczId, kod: gra.kod, idGry: gra.idGry ?? null,
      onStan: onStanGryMulti,
      onBlad: (komunikat) => { status(`Gra wieloosobowa: ${komunikat}`); renderujPasekSync(); },
      timeout: harmonogramMulti(),
      // Jak w `wejdzDoGryMulti`: kolejka zdarzeń przeżywa odświeżenie telefonu.
      wczytajKolejke: () => kolejkaZdarzenMulti(gra.kod),
      zapiszKolejke: (zdarzenia) => zapiszKolejkeZdarzenMulti(zdarzenia, gra.kod),
      limitKolejki: LIMIT_KOLEJKI_ZDARZEN,
    });
    if (gra.stan === 'lobby') otworzPanelMulti('lobby');
    STAN.wznawiamMulti = true; // powrót do gry NIE jest startem — bez odliczania (ADR 0044)
    onStanGryMulti(gra); // 'trwa' → lokalna rozgrywka od niezamkniętych stacji
    STAN.multi?.sync?.start();
    ukryjStart(); // powrót do gry pomija okno startowe (uwaga K, ADR 0045)
  } catch (e) {
    const powod = e?.message ?? e;
    if (definitywnie) {
      usunSesjeMulti();
      status(`Nie ma już tamtej gry wieloosobowej (${powod}) — telefon jej nie pamięta. Możesz ustawić nową.`);
      return;
    }
    status(`Nie udało się wrócić do gry: ${powod}. Telefon ją pamięta — spróbuję przy następnym otwarciu albo gdy wróci zasięg.`);
  }
}

/* --- stan gry z serwera → lokalna rozgrywka i ekrany --- */

function onStanGryMulti(gra) {
  const m = STAN.multi;
  if (!m || !gra || gra.schemat !== SCHEMAT_GRY) return;
  // Stan z mostu WALIDUJEMY (kody R**), zanim dotknie renderu i maszynki tur:
  // uszkodzony stan to jawny status i czekanie na poprawny, nie TypeError
  // w pętli pollingu (wcześniej sprawdzaliśmy tylko `schemat`).
  const { gra: czysta, usterki } = walidujGreSurowa(JSON.stringify(gra));
  if (!czysta) {
    const u = usterki[0];
    status(`Most zwrócił uszkodzony stan gry ([${u?.kod ?? 'R?'}] ${u?.komunikat ?? 'nieznany powód'}) — czekam na poprawny, gra toczy się dalej.`);
    return;
  }
  m.gra = czysta;
  m.ostatniStanMs = Date.now();
  // Uwaga E (2026-09-14): gra, z której TEN telefon wyszedł (rezygnacja),
  // nigdy nie odradza się z pollingu — nawet gdy na moście wciąż „trwa”, bo
  // grają inni. To była przyczyna poważnego buga: po „Wróć na początek”
  // najbliższy krok synchronizacji widział „trwa + brak rozgrywki” i wpychał
  // starą grę z odliczaniem w środku wyboru nowej.
  if (gra.stan === 'trwa' && !STAN.rozgrywka && STAN.ekran !== 'gra' && !m.zrezygnowano) {
    uruchomGreMulti(gra, { odliczanie: !STAN.wznawiamMulti });
  }
  STAN.wznawiamMulti = false;
  if (gra.stan === 'zakonczona' || gra.stan === 'archiwum') {
    zatrzymajSyncMulti();
    usunSesjeMulti();
      if (STAN.rozgrywka && STAN.rozgrywka.faza !== FAZY.koniec && !STAN.graZakonczonaRecznie) {
      STAN.graZakonczonaRecznie = true;
      status(gra.stan === 'archiwum'
        ? 'Lobby wygasło (24 h bez startu) — gra trafiła do archiwum.'
        : 'Gra wieloosobowa zakończona — host zamknął grę albo wszyscy aktywni gracze domknęli stacje. Wyniki poniżej.');
    } else {
      status(gra.stan === 'archiwum' ? 'Ta gra wygasła w lobby (24 h bez startu).' : 'Gra zakończona — ostateczne wyniki w tabeli.');
    }
    // Ekran wyniku odświeżamy ZAWSZE po zamknięciu gry w moście, także wtedy, gdy
    // ten telefon domknął swoje stacje wcześniej i pokazywał już własny wynik:
    // dopiero teraz liczby są WSPÓLNE (punkty wszystkich graczy z premią za
    // kolejność — ADR 0044, uwaga F i L). Bez tego gracz zostałby z tabelą,
    // w której jest tylko on.
    pokazWyniki();
    renderujGre();
  }
  if (STAN.ekran === 'multi') renderujLobby();
  renderujWyborStacji();
  renderujPasekSync();
  // Status multi w panelu Informacje żyje z każdym krokiem pollingu (co 30 s
  // w grze): gracz, który ma panel OTWARTY, widzi świeży przebieg pozostałych
  // bez dodatkowego żądania — wystarczy ten, który i tak przychodzi.
  renderujInformacjeMulti();
}

/**
 * Pytanie gracza w grze sieciowej (ADR 0027 część B pkt 2): paczka ma
 * `pytaniaNaStacje = liczbaGraczy` pytań przy każdej stacji, a pytanie `k`
 * należy do gracza `k`. Dzięki temu każde urządzenie zna swoje pytanie BEZ
 * negocjacji z innymi — nie ma wyścigu o pytanie ani blokady przy braku
 * zasięgu, a serwer nie musi rozstrzygać, kto pierwszy.
 *
 * Paczka mniejsza niż liczba graczy nie zostawia nikogo bez pytania: indeks
 * zawija się (`k mod liczba pytań stacji`), więc gracze dzielą pytanie. Gra i
 * tak toczy się na osobnych telefonach, a pusty zestaw pytań zatrzymałby
 * rozgrywkę — więc dzielenie jest tu mniejszym złem niż brak pytania.
 *
 * Reguła dotyczy obu trybów multi: w turach właściciel stacji też odpowiada na
 * jedno pytanie (serwer odrzuca drugą odpowiedź tego samego gracza do stacji).
 */
function pytaniaDlaGracza(paczka, { liczbaGraczy, indeksGracza }) {
  if (!(liczbaGraczy > 1) || !(indeksGracza >= 0)) return paczka;
  const przezStacje = new Map();
  for (const q of paczka.pytania) {
    const lista = przezStacje.get(q.stacja) ?? [];
    lista.push(q);
    przezStacje.set(q.stacja, lista);
  }
  const wybrane = new Set();
  for (const lista of przezStacje.values()) {
    // Paczka z `pytaniaNaStacje = liczbaGraczy` (domyślna po ADR 0027 część A)
    // daje każdemu WŁASNE pytanie. Starsza/mniejsza paczka nie zostawia gracza
    // bez pytania: indeks zawija się, więc gracze dzielą pytanie — w grze
    // sieciowej każdy odpowiada na swoim telefonie, więc to uczciwe, a brak
    // pytania zatrzymałby grę (rozgrywka wymaga niepustej paczki).
    wybrane.add(lista[indeksGracza % lista.length]);
  }
  return { ...paczka, pytania: paczka.pytania.filter((q) => wybrane.has(q)) };
}

/**
 * Lokalny silnik gry wieloosobowej (właściciel, 2026-09-11): w OBU trybach
 * gracz przechodzi wszystkie stacje — w Wspólnej Trasie PO KOLEI (kolejność
 * narzuca trasa, bez listy wyboru), w Wyścigu na Orientację w dowolnej
 * kolejności (ADR 0027 część B).
 *
 * Uwaga terenowa 2026-09-16 (pkt 1, KRYTYCZNA): żywej tabeli wyników w lobby
 * dla widowni NIE MA — po starcie każdy gracz (także host grający solo) widzi
 * wyłącznie to, co w hotseacie: mini-pasek na dole i mapę (kolejna stacja przy
 * trasie-sekret, wszystkie stacje przy trasie jawnej i w wyścigu). Model budujemy
 * z PEŁNEJ trasy, a postęp po powrocie odtwarzamy ze zdarzeń gracza na moście —
 * zamknięte stacje nie wracają jako cele, ale numery i „stacja X z Y" zgadzają
 * się z trasą.
 */
function uruchomGreMulti(gra, { odliczanie = true } = {}) {
  const m = STAN.multi;
  const paczka = gra.zestaw?.paczka;
  if (!paczka?.pytania?.length) {
    status(`Nie da się odsłonić pytań gry ${gra.kod}: paczka bez pytań.`);
    return;
  }
  // `numer` = pozycja na PEŁNEJ trasie (zgłoszenie N): pełna trasa jest modelem;
  // zamknięte stacje nie wracają do marszu, ale numery na mapie zostają te same.
  const wszystkie = (gra.zestaw.stacje ?? []).map((s, i) => ({ id: s.id ?? i + 1, numer: i + 1, lat: s.lat, lon: s.lon, opis: s.opis ?? '' }));
  const N = gra.gracze.length;
  const mojIndeks = gra.gracze.findIndex((g) => g.id === m.graczId);
  const srodek = STAN.pozycja ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon } : { lat: wszystkie[0]?.lat ?? 0, lon: wszystkie[0]?.lon ?? 0 };
  const konfig = oczyscKonfiguracje({ ...STAN.konfig, liczbaGraczy: 1, imiona: [m.pseudonim], kodGry: gra.kod });
  // pytanie tego gracza przy każdej stacji (indeks = pozycja w `gra.gracze`)
  const paczkaGracza = pytaniaDlaGracza(paczka, { liczbaGraczy: N, indeksGracza: mojIndeks });
  m.indeksGracza = mojIndeks;
  STAN.stacje = wszystkie;
  STAN.trasaDlugosc = wszystkie.length; // „stacja X z Y" z pełnej trasy
  STAN.paczka = { ...paczka, factcheck: czyWpisFactcheck(gra.zestaw?.meta) };
  STAN.usterkiPaczki = [];
  STAN.graZakonczonaRecznie = false;
  STAN.rozgrywka = nowaRozgrywka({
    konfig, stacje: wszystkie, paczka: paczkaGracza, srodek,
    gracze: [{ id: 1, imie: m.pseudonim }],
    czasMs: zegarGry(), ziarno: gra.kod,
  });
  STAN.historiaFixow = [];

  // Postęp tego gracza z mostu: zdarzenia `dojscie`/`odpowiedz` odtwarzają stan
  // lokalnej rozgrywki (powrót po odświeżeniu) — ten sam lej pure-funkcji co w terenie.
  if (gra.zdarzenia?.some((z) => z.graczId === m.graczId)) {
    odtworzPostepMulti({ zdarzenia: gra.zdarzenia, paczkaGracza, czasMs: zegarGry() });
  }

  pokazEkran('gra');
  if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  const koniecLokalny = STAN.rozgrywka.faza === FAZY.koniec;

  // Uwaga terenowa 2026-09-16 (pkt 1): gracz, który domknął wszystkie swoje
  // stacje, NIE wraca do lobby ani do żywej tabeli. Gdy most już zamknął grę
  // (np. solo) — wspólny wynik od razu; w pozostałych wypadkach stoi na własnym
  // ekranie wyniku i czeka na wspólną tabelę po domknięciu gry w moście
  // (dokładnie jak gracz, który skończył za innymi). Żadnego LIMBO.
  if (koniecLokalny) {
    if (gra.stan === 'zakonczona' || gra.stan === 'archiwum') {
      m.gra = gra; // `wynikiMultiKonca` czyta STAN.multi.gra — wspólne liczby od razu
      status('Gra wieloosobowa zakończona — wspólne wyniki poniżej.');
    } else {
      status(`Gra ${gra.kod} się toczy — wszystkie Twoje stacje są już zamknięte. Gdy pozostali gracze skończą, zobaczysz wspólną tabelę.`);
    }
    pokazWyniki();
    renderujGre();
    return;
  }

  const zamknietePrzezeMnie = zaliczoneStacjeIds(STAN.rozgrywka).length;
  status(`Gra ${gra.kod} (${gra.tryb === TRYBY_GRY.trasa ? 'Wspólna Trasa' : 'Wyścig na Orientację'}) rozpoczęta: przed Tobą ${STAN.stacje.length - zamknietePrzezeMnie} z ${wszystkie.length} stacji. Pytania odsłaniają się dopiero na stacjach.`
    + (zamknietePrzezeMnie ? ' Zamknięte wcześniej stacje nie wracają — wracasz do gry w połowie drogi.' : ''));
  renderujGre();
  // 2026-09-14 F: Wyścig — bez warstwy wyboru stacji, od razu odcinek i tylko mapa
  if (gra.tryb === TRYBY_GRY.wyscig) {
    const r = STAN.rozgrywka;
    if (r && r.faza === FAZY.przygotowanie) {
      const wynik = startOdcinka(r, { czasMs: zegarGry() });
      if (wynik.usterki.length === 0) {
        STAN.rozgrywka = wynik.stan;
        STAN.historiaFixow = [];
        renderujGre();
      }
    }
  }
  // Uwaga F (ADR 0044): wszyscy — host i goście — dostają sygnał i odliczanie
  // na środku ekranu, a po „START" widzą zwykłą grę jak w hotseat.
  // Gracz bez stacji do przejścia odliczania nie dostaje: nie ma w co ruszać.
  if (odliczanie) void odliczStartGry();
}

/**
 * Odtworzenie postępu jednego gracza z mostu na lokalnym modelu rozgrywki
 * (uwaga terenowa 2026-09-16, pkt 1): zdarzenia `dojscie` i `odpowiedz` idą
 * przez te same pure-funkcje co na żywo, więc stan, fazy i punkty zgadzają się
 * z tym, co most liczy dla tego gracza. `paczkaGracza` to paczka PRZEFILTROWANA
 * do pytań TEGO gracza — odtwarzamy wyłącznie jego własne zdarzenia.
 */
function odtworzPostepMulti({ zdarzenia, paczkaGracza, czasMs }) {
  const poGraczu = (zdarzenia ?? []).filter((z) => z.graczId === STAN.multi?.graczId);
  for (const z of poGraczu) {
    if (z.stacjaId == null) continue;
    if (z.typ === 'dojscie') {
      const skier = skierujDoStacji(STAN.rozgrywka, { stacjaId: Number(z.stacjaId), czasMs });
      if (skier.usterki.length) continue;
      STAN.rozgrywka = skier.stan;
      const start = startOdcinka(STAN.rozgrywka, { stacjaId: Number(z.stacjaId), czasMs });
      if (start.usterki.length) continue;
      STAN.rozgrywka = start.stan;
      const koniec = zakonczOdcinek(STAN.rozgrywka, { stacjaId: Number(z.stacjaId), czasMs });
      if (koniec.usterki.length) continue;
      STAN.rozgrywka = koniec.stan;
    } else if (z.typ === 'odpowiedz') {
      // Usterki odtwarzania są bezpieczne: pomijamy zdarzenie, które nie pasuje
      // do paczki gracza, ale nie stajemy — postęp idzie dalej.
      const pytanie = paczkaGracza.pytania.find((q) => Number(q.stacja) === Number(z.stacjaId));
      if (!pytanie) continue;
      const poprawnyIndeks = Number(pytanie.poprawna) - 1; // numer 1..4 → indeks 0..3
      const wybrana = z.dane?.poprawna === true ? poprawnyIndeks : (poprawnyIndeks + 1) % 4;
      const wynik = zapiszOdpowiedz(STAN.rozgrywka, {
        stacjaId: Number(z.stacjaId), pytanie, wybrana, czasMs,
      });
      if (wynik.usterki.length) continue;
      STAN.rozgrywka = wynik.stan;
    }
  }
}

/* -------- ADR 0044 (uwaga F): odliczanie startu gry wieloosobowej -------- */

/** Kroki odliczania: wielka cyfra na środku, ostatni krok to napis „START". */
const ODLICZANIE_KROKI = Object.freeze([5, 4, 3, 2, 1, 'START']);
/** Krok w terenie: 1 s. W trybie testowym krócej, żeby brama nie czekała minuty. */
const ODLICZANIE_KROK_MS = 1000;
const ODLICZANIE_KROK_TEST_MS = 20;

function odstepOdliczania() {
  return STAN.trybTestowy ? ODLICZANIE_KROK_TEST_MS : ODLICZANIE_KROK_MS;
}

/**
 * Start gry wieloosobowej na TYM telefonie: sygnał (dźwięk i wibracja — ADR 0041,
 * o ile 🔔 nie jest wyłączony) i odliczanie 5-4-3-2-1-START wielką cyfrą na
 * środku, nad PRZEZROCZYSTYM tłem, więc mapa zostaje widoczna (uwaga F). Każdy
 * krok ma własny sygnał. Po „START" warstwa znika i zostaje zwykła gra — bez
 * panelu multi, bez tabeli, bez kanału info, bez paska synchronizacji.
 */
async function odliczStartGry() {
  if (STAN.odliczanieAktywne) return; // jeden start = jedno odliczanie
  STAN.odliczanieAktywne = true;
  const warstwa = $('odliczanie');
  const cyfra = $('odliczanie-cyfra');
  warstwa.hidden = false;
  try {
    for (const krok of ODLICZANIE_KROKI) {
      cyfra.textContent = String(krok);
      odegrajSygnal(krok === 'START' ? 'startGry' : 'odliczanie');
      // 2026-09-14 H: START za duże — clamp osobno, mniejsza czcionka
      cyfra.classList.toggle('odliczanie-start', krok === 'START');
      await new Promise(r => setTimeout(r, odstepOdliczania()));
    }
  } finally {
    warstwa.hidden = true;
    cyfra.textContent = '';
    cyfra.classList.remove('odliczanie-start');
    STAN.odliczanieAktywne = false;
  }
}

/* --- zdarzenia na serwer (panelu multi nie ma — ADR 0044) --- */

function wyslijZdarzenieMulti(typ, stacjaId, dane) {
  const m = STAN.multi;
  if (!m?.sync) return Promise.resolve(null);
  const zdarzenie = zbudujZdarzenie({
    kod: m.gra.kod, idGry: m.gra.idGry ?? null, graczId: m.graczId,
    typ, stacjaId, dane, tUrzadzenia: Date.now(),
  });
  return m.sync.wyslijZdarzenie(zdarzenie).then((wynik) => { renderujPasekSync(); return wynik; });
}

/**
 * Wynik zamkniętej gry wieloosobowej w kształcie, którego używa `pokazWyniki()`
 * (`{gracze, ranking, zwyciezca}`) — z danych mostu, bo lokalna rozgrywka gracza
 * zna tylko jego własne odpowiedzi (ADR 0044, uwaga F: ekran końca gry jest ten
 * sam co w hotseat, ale liczby są wspólne). `null` = gra się jeszcze nie
 * zamknęła albo nie jest sieciowa, więc `pokazWyniki` liczy wynik lokalnie.
 */
function wynikiMultiKonca() {
  const gra = STAN.multi?.gra;
  if (!gra || (gra.stan !== 'zakonczona' && gra.stan !== 'archiwum')) return null;
  const wyniki = przeliczWyniki(gra);
  const gracze = Object.entries(wyniki)
    .sort((a, b) => b[1].punkty - a[1].punkty || b[1].poprawne - a[1].poprawne
      || a[1].pseudonim.localeCompare(b[1].pseudonim, 'pl'))
    .map(([id, w]) => ({
      id,
      imie: `${w.pseudonim}${id === STAN.multi.graczId ? ' (Ty)' : ''}${w.zrezygnowal ? ' — zrezygnował(a)' : ''}`,
      punkty: w.punkty,
      poprawne: w.poprawne,
      bledne: w.bledne,
    }));
  if (!gracze.length) return null;
  return { gracze, ranking: gracze.map((g) => g.id), zwyciezca: gracze[0].id };
}

/* --- status gry wieloosobowej w panelu Informacje i pod wynikiem (uwaga terenowa 2026-09-16) --- */

/**
 * Etykiety statusu uczestnika (odpowiedź właściciela 2026-09-16):
 * - `Aktywny` (nie zamknął wszystkich stacji, nie wyszedł — gra toczy się dalej),
 * - `Opuścił grę` (zdarzenie `rezygnacja` od TEGO gracza),
 * - `Zakończył trasę` (odpowiedział na pytania WSZYSTKICH `N` stacji).
 */
const STATUS_GRACZA_MULTI = Object.freeze({
  opuscil: 'Opuścił grę',
  ukonczyl: 'Zakończył trasę',
  aktywny: 'Aktywny',
});

/**
 * Wiersze przebiegu gry wieloosobowej — identyczne dla panelu Informacje
 * i dla ekranu wyniku. Zwraca `null`, gdy nie ma co pokazać (brak kontekstu
 * multi, brak graczy albo gra nie ma pełnego zestawu pytań). Ta sama tabela
 * idzie do `#informacje-multi-wiersze` i `#gra-wyniki-multi-wiersze`.
 */
function tabelaPrzebieguMulti() {
  const m = STAN.multi;
  const gra = m?.gra;
  if (!gra?.gracze?.length) return null;
  const N = Number(gra.konfiguracja?.liczbaStacji) || 0;
  if (!N) return null;
  return gra.gracze.map((g) => {
    // „uczestnicy w momencie startu gry”: `gra.gracze` już według mostu nie
    // zmienia się po starcie (dołączanie tylko w lobby, wyjście w trakcie gry
    // to rezygnacja-zdarzenie, a nie usunięcie z listy).
    const p = postepGracza(gra, g.id); // `stacjeZamkniete` = liczba zdarzeń `odpowiedz`
    const zamkniete = Math.min(p.stacjeZamkniete, N); // bezpieczny sufit N
    const status = p.zrezygnowal
      ? STATUS_GRACZA_MULTI.opuscil
      : zamkniete >= N
        ? STATUS_GRACZA_MULTI.ukonczyl
        : STATUS_GRACZA_MULTI.aktywny;
    return {
      id: g.id,
      imie: `${g.pseudonim}${g.id === m.graczId ? ' (Ty)' : ''}`,
      stacje: `${zamkniete}/${N}`,
      poprawne: `${p.poprawne}/${p.poprawne + p.bledne}`,
      status,
    };
  });
}

/** Czy ten telefon w ogóle gra w sieci (hot-seat nigdy nie dostaje tej tabeli). */
function jestGraMulti() {
  return Boolean(STAN.multi?.gra && STAN.ekran === 'gra');
}

/** Wypełnia dolny blok ekranu wyniku (`#gra-wyniki-multi`). */
function renderujWynikiMulti() {
  const blok = $('gra-wyniki-multi');
  if (!blok) return; // atrapa DOM nie parsuje HTML-a — węzły spoza szablonu są niewidzialne
  const wiersze = jestGraMulti() ? tabelaPrzebieguMulti() : null;
  blok.hidden = !wiersze;
  if (!wiersze) return;
  const tbody = $('gra-wyniki-multi-wiersze');
  tbody.replaceChildren();
  for (const w of wiersze) {
    const tr = document.createElement('tr');
    tr.className = w.status === STATUS_GRACZA_MULTI.ukonczyl
      ? 'wiersz-ukonczyl'
      : w.status === STATUS_GRACZA_MULTI.opuscil
        ? 'wiersz-opuscil'
        : '';
    for (const tekst of [w.imie, w.stacje, w.poprawne, w.status]) {
      const td = document.createElement('td');
      td.textContent = tekst;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/** Wypełnia blok statusu w panelu Informacje (`#informacje-multi`). */
function renderujInformacjeMulti() {
  const blok = $('informacje-multi');
  if (!blok) return;
  const wiersze = jestGraMulti() ? tabelaPrzebieguMulti() : null;
  blok.hidden = !wiersze;
  if (!wiersze) return;
  const tbody = $('informacje-multi-wiersze');
  tbody.replaceChildren();
  for (const w of wiersze) {
    const tr = document.createElement('tr');
    tr.className = w.status === STATUS_GRACZA_MULTI.ukonczyl
      ? 'wiersz-ukonczyl'
      : w.status === STATUS_GRACZA_MULTI.opuscil
        ? 'wiersz-opuscil'
        : '';
    for (const tekst of [w.imie, w.stacje, w.poprawne, w.status]) {
      const td = document.createElement('td');
      td.textContent = tekst;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  // Podpis pod tabelą — mówi tylko, z jakiego momentu są dane (bez godziny:
  // liczy się rytm pollingu, nie zegar telefonu).
  $('informacje-multi-status').textContent = `Gra ${STAN.multi.gra.kod} (${STAN.multi.gra.stan === 'trwa' ? 'trwa' : 'zakończona'}) — stan z ostatniego odświeżenia, do ~30 s.`;
}

/** Wiersze tabeli hot-seat (Gracz + poprawne/udzielone) — `null`, gdy nic nie pokazywać. */
function tabelaInformacjeHotseat() {
  const r = STAN.rozgrywka;
  if (!r?.gracze?.length) return null;
  return podsumowanie(r).gracze.map((g) => ({
    id: g.id,
    imie: g.imie,
    poprawne: `${g.poprawne}/${g.poprawne + g.bledne}`,
  }));
}

/** Wypełnia blok hot-seat w panelu Informacje (`#informacje-hotseat`). */
function renderujInformacjeHotseat() {
  const blok = $('informacje-hotseat');
  if (!blok) return;
  // Hot-seat pokazuje tabelę TYLKO w trakcie gry i TYLKO w panelu Informacje
  // (zgłoszenie 2026-09-16): po zamknięciu/zakończeniu gry nic nie doklejamy.
  const wiersze = czyGraToczySie() && !STAN.multi ? tabelaInformacjeHotseat() : null;
  blok.hidden = !wiersze;
  if (!wiersze) return;
  const tbody = $('informacje-hotseat-wiersze');
  tbody.replaceChildren();
  for (const w of wiersze) {
    const tr = document.createElement('tr');
    for (const tekst of [w.imie, w.poprawne]) {
      const td = document.createElement('td');
      td.textContent = tekst;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function renderujLobby() {
  const m = STAN.multi;
  if (!m) return;
  const gra = m.gra;
  // Opcje gry BEZ pytań i stacji — tylko ilość (właściciel, 2026-09-11).
  const sekret = gra.tryb === TRYBY_GRY.trasa && gra.trasaSekret !== false;
  $('lobby-tryb').textContent = `${gra.tryb === TRYBY_GRY.trasa ? '🗺️ Wspólna Trasa' : '🏁 Wyścig na Orientację'}${sekret ? ' · tylko kolejna stacja' : ''} · ${gra.konfiguracja?.liczbaStacji ?? '?'} stacji · ${gra.konfiguracja?.miejsce || 'nieznane miejsce'}`;
  const lista = $('lobby-gracze');
  lista.replaceChildren();
  for (const g of gra.gracze ?? []) {
    const li = document.createElement('li');
    // 2026-09-14 E: imiona w lobby powiększa CSS (`#lobby-gracze li`), nie inline
    li.textContent = `${g.pseudonim}${g.id === gra.organizatorId ? ' — organizator' : ''}${g.id === m.graczId ? ' (Ty)' : ''}`;
    lista.appendChild(li);
  }
  const wLobby = gra.stan === 'lobby';
  $('przycisk-lobby-start').hidden = !(wLobby && m.rola === 'organizator');
  $('przycisk-lobby-opusc').hidden = !wLobby;
  // Uwaga terenowa 2026-09-16 (pkt 1, KRYTYCZNA): poza lobby ten ekran już nie
  // żyje — po starcie host i goście przechodzą od razu do `#ekran-gra`
  // (mini-pasek + mapa) i nic ich do lobby nie zawraca. Tabeli żywych wyników
  // nie ma, więc nie ma tu czego rysować po starcie.
  if (wLobby) {
    // 2026-09-14 E: usunięto teksty „Czekasz na graczy tej samej okolicy (maks. 8)” i „Możesz wystartować od razu - także solo”
    $('lobby-status').textContent = m.rola === 'organizator'
      ? 'Po starcie dołączenie nie jest już możliwe.'
      : 'Czekasz, aż organizator wystartuje grę…';
  } else {
    $('lobby-status').textContent = '';
  }
}

/* `renderujPanelMulti()` i `renderujInfoMulti()` USUNIĘTE (właściciel 2026-09-13,
   uwaga F — ADR 0044): po starcie gra wieloosobowa wygląda DOKŁADNIE jak hotseat.
   Umarły z nimi: komunikat trybu i „Zostało Ci N stacji", tabela żywych wyników
   (Gracz/Punkty/Poprawne/Stacje/Premia), kanał info („X wystartował grę",
   dojścia, odpowiedzi, rezygnacje), linia wariantu fact-check w grze, pasek
   „Ostatni stan / następne odświeżenie" oraz przyciski „⏹ Zakończ grę (host)"
   i „🏳 Rezygnuję z gry". Koniec gry i rezygnacja idą przez ikonę ⚙ START GRY
   z wpisaniem TAK (ADR 0043), a ostateczna tabela jest na ekranie wyniku
   (ADR 0038) i w rankingu (ADR 0039).

   Uwaga terenowa 2026-09-16 (pkt 1, KRYTYCZNA): zamknięte tu też „żywe wyniki
   w lobby dla widowni” (tabela + `#lobby-widownia`) —
   po starcie macie wyłącznie grę jak w hotseacie, bez tabeli i bez lobby. */

/* `zakonczGreMulti()` USUNIĘTA (właściciel 2026-09-13, uwaga G — ADR 0019 aneks
   2026-09-13): host NIE kończy gry pozostałym. Aplikacja nie wysyła już akcji
   `gra-zakoncz`; koniec gry na tym telefonie jest zdarzeniem `rezygnacja`
   (`rezygnujZGryMulti`), a grę domyka most, gdy wszyscy aktywni gracze skończyli
   albo wyszli. Akcja `gra-zakoncz` została w moście dla starszych telefonów. */

/**
 * 2026-09-14 F: Wyścig — cały layer wyboru stacji usunięty (index.html #multi-wybor-stacji).
 * Gracz sam decyduje, app wykrywa dotarcie do dowolnej niezaliczonej.
 * Funkcje zostają jako no-op dla kompatybilności testów.
 */
function renderujWyborStacji() {
  // no-op — wybór stacji usunięty
  return;
}

function wybierzStacjeMulti(stacjaId) {
  // no-op — wybór stacji usunięty, detekcja dowolnej w aktualizujGreNaFix
  return;
}

function renderujPasekSync() {
  // 2026-09-14 E: usunięto „Ostatni stan .... UTC - ” (owner) — zostaje kolejka i status odświeżania
  const m = STAN.multi;
  let tekst = '';
  if (m) {
    const nastepny = interwalPollingu({ gra: m.gra, graczId: m.graczId });
    const kolejka = m.sync?.kolejkaLength ?? 0;
    const czesci = [];
    if (nastepny) czesci.push(`następne odświeżenie za ~${Math.round(nastepny / 1000)} s`);
    else czesci.push('odświeżanie zatrzymane');
    if (kolejka) czesci.push(`${kolejka} zdarzeń czeka w kolejce (brak sieci)`);
    tekst = czesci.join(' · ');
  }
  $('multi-sync-pasek').textContent = tekst;
}

/**
 * Wyjście z gry wieloosobowej na TYM telefonie: reszta gra dalej (ADR 0019 pkt 5
 * i aneks 2026-09-13 — uwaga G: dotyczy także ORGANIZATORA, bo jego telefon
 * służył tylko do wystartowania gry i wybrania pytań, a punktację liczy Drive).
 * Przycisku „🏳 Rezygnuję z gry" nie ma (uwaga F, ADR 0044) — potwierdzeniem jest
 * wpisanie TAK w warstwie za ikoną ⚙ START GRY (ADR 0043).
 *
 * Zdarzenie `rezygnacja` jest potrzebne nie tylko innym graczom: most wykreśla
 * rezygnującego z puli premii (ADR 0027 aneks 2026-09-13) i domyka grę, gdy
 * pozostali aktywni gracze już skończyli — bez niego gra wisiałaby otwarta.
 */
function rezygnujZGryMulti() {
  const m = STAN.multi;
  if (!m || !STAN.rozgrywka || STAN.rozgrywka.faza === FAZY.koniec) return;
  const organizator = m.rola === 'organizator';
  void wyslijZdarzenieMulti('rezygnacja', null, {
    powod: organizator ? 'organizator zakończył grę na swoim telefonie' : 'rezygnacja z telefonu',
  });
  STAN.graZakonczonaRecznie = true;
  // Uwaga E (2026-09-14): znak „ten telefon wyszedł z tej gry”. Blokuje
  // odradzanie gry w `onStanGryMulti` i sygnalizuje `wrocNaPoczatek`, że
  // razem z ekranem wyników ma się skończyć synchronizacja.
  m.zrezygnowano = true;
  // Sesja znika razem z wyjściem (uwaga K, ADR 0045): po odświeżeniu telefon nie
  // wraca do gry, z której gracz wyszedł. Widok zostaje — synchronizacja działa
  // dalej w pamięci i pokaże wspólną tabelę, gdy most domknie grę.
  usunSesjeMulti();
  zatrzymajSymulacje();
  pokazWyniki();
  renderujGre();
  status(organizator
    ? 'Gra zakończona na tym telefonie — pozostali gracze grają dalej, a ich punkty liczy wspólny Drive. Twój wynik poniżej; gdy inni skończą, zobaczysz ostateczną tabelę.'
    : 'Zrezygnowałeś — Twój wynik poniżej. Synchronizacja działa dalej: gdy inni skończą, zobaczysz ostateczną tabelę.');
}

/**
 * Tryb testowy wchodzi WYŁĄCZNIE parametrem adresu (decyzja właściciela
 * 2026-09-08 — przycisk w nagłówku usunięty). Przyjmowane formy:
 * `?test=true`, `?test=1`, `?test=tak` oraz historyczne `?tryb=test`, którego
 * używają testy (`test/helpers/dom.js`). Wielkość liter bez znaczenia.
 */
/**
 * Wysokość belki jako zmienna CSS `--wysokosc-belki`.
 *
 * Przyciski +/− mapy-tła muszą siedzieć PONIŻEJ belki: mapa-tło ma
 * `position: fixed; inset: 0`, więc sięga pod samą belkę, a belka ma `z-index: 3`
 * i nieprzezroczyste tło — przy domyślnym `top: 8px` przyciski znikały pod nią
 * (zgłoszenie właściciela 2026-09-08). Stałej liczby w CSS nie chcemy: `.akcje`
 * ma `flex-wrap: wrap`, więc na wąskim ekranie belka rośnie i każda stała
 * w końcu przestaje wystarczać. Mierzymy.
 */
function ustawWysokoscBelki() {
  const belka = document.querySelector('.gora');
  if (!belka) return; // atrapa DOM w testach nie ma `querySelector` po klasie
  const wysokosc = belka.offsetHeight;
  if (!Number.isFinite(wysokosc) || wysokosc <= 0) return;
  document.documentElement.style.setProperty('--wysokosc-belki', `${Math.round(wysokosc)}px`);
}

function czyTrybTestowyWUrl() {
  if (typeof location === 'undefined' || typeof location.search !== 'string') return false;
  const parametr = new URLSearchParams(location.search);
  if (parametr.get('tryb') === 'test') return true;
  return ['true', '1', 'tak'].includes(String(parametr.get('test') ?? '').trim().toLowerCase());
}

/**
 * Operatorskie nadpisanie szablonu kafelków OSM. Polityka kafelków OSM wprost
 * zaleca: „avoid hard-coding the tile URL; allow switching without needing a
 * software update" — serwer kafelków jest wolontariacki, bez SLA, i może zostać
 * wycofany albo zablokowany bez uprzedzenia. Klucz pozwala przełączyć podkład
 * w terenie, bez czekania na wdrożenie.
 *
 * Wartość nieobecna albo błędna = adres wbudowany (`walidujSzablonKafelkow`
 * odrzuca wszystko, co nie jest `https:` z `{z}/{x}/{y}`), więc domyślne
 * zachowanie jest niezmienione. `localStorage` bywa niedostępny (tryb prywatny,
 * zablokowane ciastka) — stąd `try/catch`.
 *
 * @returns {string|null} szablon przyjęty, albo `null` gdy został wbudowany
 */
function wczytajNadpisanieKafelkow() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return ustawSzablonKafelkow(localStorage.getItem(KLUCZ_URL_KAFELKOW));
  } catch {
    return null;
  }
}

function start() {
  wczytajNadpisanieKafelkow();
  wczytajKonfiguracje();
  STAN.konfig = konfiguracjaNowegoSetupu(STAN.konfig);
  // Porządek rejestru paczek (właściciel 2026-09-11): stare wpisy dostają
  // FAKTYCZNE tematy pytań — dopasowanie przestaje odrzucać paczkę za tematy
  // dopuszczalne w starym setupie, których w pytaniach nie ma.
  ujedgajnijTematyWpisowLokalnych();
  banerStartowy();
  // Numer budowy w panelu Informacje: właściciel dwa razy oceniał starą wersję z cache i
  // nie miał jak tego stwierdzić. Bierzemy go z `?v=` w adresie TEGO modułu,
  // więc nie ma drugiej stałej do pamiętania przy podbijaniu cache-bust.
  if ($('stopka-wersja')) {
    $('stopka-wersja').textContent = new URL(import.meta.url).searchParams.get('v') || 'dev';
  }
  ustawWysokoscBelki();

  renderujTryby();
  renderujSegment('lista-wieku', WIEK_SETUP, STAN.konfig.wiek, (wiek) => { STAN.konfig.wiek = wiek; });
  renderujTematy();
  renderujSetup();
  // Lista graczy zaczyna PUSTA: domyślne „Gracz 1" z kanonu nie przeszło przez
  // most, więc nie może udawać tożsamości (ADR 0026 aneks). Zapamiętani gracze
  // wracają jako przyciski — jedno kliknięcie, bez PIN-u.
  STAN.konfig.imiona = [];
  renderujListeGraczy();
  przywrocGraczy({ zListy: true });
  utworzMapy();
  // Wyniki, które nie doszły na Drive w terenie, jadą przy starcie (ADR 0016 pkt 5).
  void oproznijKolejkeHotseat();

  if (czyTrybTestowyWUrl()) {
    // Decyzja właściciela 2026-09-08: tryb testowy NIE MA przycisku w
    // interfejsie — wchodzi się tylko parametrem adresu (`?test=true`).
    // Przełącznik w nagłówku kusił do grania bez GPS, a wyniki i tak szły
    // na Drive (ADR 0029).
    STAN.trybTestowy = true;
    document.body.classList.add('tryb-testowy');
  }
  if (location.search.includes('odstep=0')) {
    // skrót dla testów/przeglądarki: przełączanie instancji Overpass bez
    // pauz limitowych (polityka ASSETS §2 jest domyślnie nietknięta)
    STAN.odstepOverpassMs = 0;
  }

  $('przycisk-ranking').addEventListener('click', przelaczRankingi); // 🏆 warstwa rankingu (ADR 0039)
  $('przycisk-zamknij-ranking').addEventListener('click', przelaczRankingi);
  $('przycisk-informacje').addEventListener('click', przelaczInformacje);
  $('przycisk-zamknij-informacje').addEventListener('click', przelaczInformacje);
  $('przycisk-podejrzyj-mape').addEventListener('click', przelaczPodgladMapy);
  $('przycisk-setup').addEventListener('click', przelaczSetup); // START GRY w nagłówku (F3: przełącznik)
  $('ekran-start').addEventListener('click', ukryjStart); // okno startowe: klik gdziekolwiek zamyka
  // „▶ Zacznij” (właściciel 2026-09-09): jawny przycisk intro otwiera setup,
  // dokładnie jak ⚙ START GRY w belce — samo zamknięcie okna zostawiało gracza
  // na pustej mapie i kazało szukać drugiego przycisku. `stopPropagation`, bo
  // klik bąbelkuje do warstwy, której handler tylko zamyka okno.
  $('przycisk-start-zacznij').addEventListener('click', (z) => {
    z.stopPropagation?.();
    pokazEkran('setup'); // sam woła ukryjStart()
  });
  document.addEventListener('keydown', (z) => {
    if (z.key !== 'Escape') return;
    if (!$('ekran-koniec-gry').hidden) zamknijKoniecGry();
    else if (STAN.podgladMapy) przelaczPodgladMapy();
    else if (!$('ekran-informacje').hidden) przelaczInformacje();
    else if (!$('ekran-ranking').hidden) przelaczRankingi();
    else ukryjStart();
    odswiezWidocznoscPaneli();
  });
  $('przycisk-motyw').addEventListener('click', przelaczMotyw);
  $('przycisk-sygnaly').addEventListener('click', przelaczSygnaly);
  $('przycisk-sygnaly').setAttribute('aria-pressed', String(sygnalyWlaczone()));
  zarejestrujServiceWorker();
  // „🔐 Dane i prywatność" na ekranie setupu nie ma (właściciel, 2026-09-09) —
  // jedyny dostęp to stopka (`przycisk-prywatnosc-stopka` poniżej).
  $('przycisk-tematy-wszystkie').addEventListener('click', () => ustawWszystkieTematy(true));
  $('przycisk-tematy-zadne').addEventListener('click', () => ustawWszystkieTematy(false));
  $('przycisk-prywatnosc-stopka').addEventListener('click', pokazPrywatnosc);
  $('przycisk-wrocz-prywatnosc').addEventListener('click', wrocZPrywatnosci);
  $('przycisk-czysc-dane').addEventListener('click', czyscDaneWitryny);
  // Przycisk „wyczyść pliki tymczasowe aplikacji” żyje TYLKO w trybie testowym
  // (panel Informacje, obok numeru budowy — uwaga terenowa 2026-09-16, pkt 2).
  $('przycisk-czysc-tymczasowe').addEventListener('click', czyscPlikiTymczasowe);

  $('przycisk-dalej-pozycja').addEventListener('click', async () => {
    STAN.multiPoPaczce = false; // to jest zwykła ścieżka hot-seat, nie multi
    STAN.ukryjStacje = false;
    // „Dołączam do istniejącej” nie używa tego przycisku (m12-75): lista gier
    // w okolicy żyje bezpośrednio na setupie, a przycisk jest wtedy Ukryty.
    const usterki = walidujSetup(czytajSetupZDomu());
    pokazBledy('bledy-setup', usterki);
    if (usterki.length) {
      status(`Konfiguracja ma usterek: ${usterki.length}.`);
      return;
    }
    // Tożsamość przed zapisem konfiguracji: imię z profilu jest częścią setupu
    // (wpisuje się w `imiona`), więc najpierw brama, potem zapis (ADR 0026).
    const przyciskDalej = $('przycisk-dalej-pozycja');
    przyciskDalej.disabled = true; // jedno kliknięcie = jedno wołanie mostu
    let przeszedl;
    try {
      przeszedl = await bramkaTozsamosci();
    } finally {
      przyciskDalej.disabled = false;
    }
    if (!przeszedl) {
      status('Bez potwierdzonego imienia nie idziemy dalej — wpisz imię i PIN.');
      return;
    }
    // Multi + „Zakładam nową grę” (właściciel, 2026-09-11): pytań na stację
    // BRAK — liczba stacji = liczba pytań (po 1 na stację), promień liczy
    // się jak w hot-seat. Po wklejeniu paczki otworzy się lobby.
    if (STAN.rodzajGry === 'multi') {
      synchronizujPytaniaZTrybem(); // multi = jedno pytanie na stację (uwaga B)
      przeliczPromienZCzasu(); // promień zależy od liczby pytań (ADR 0025)
      STAN.multiPoPaczce = true;
      STAN.ukryjStacje = STAN.multiTryb === TRYBY_GRY.trasa && STAN.multiTrasaSekret;
    }
    zapiszKonfiguracje();
    pokazEkran('pozycja');
    pokazPozycje();
    // Bug G: ten klik jest gestem użytkownika. Watcher z ładowania strony bywa
    // na iOS „aktywny” i niemy zarazem (WebKit bez callbacków), więc dopóki nie
    // ma żadnego fixa, odświeżamy nasłuch przy każdym wejściu na ekran pozycji.
    if (!STAN.trybTestowy && (!STAN.watcher?.czyAktywny() || !STAN.ostatniFix)) wlaczGps();
    if (STAN.multiPoPaczce) {
      status(STAN.ukryjStacje
        ? 'Potwierdź pozycję, wygeneruj stacje i pytania, wklej odpowiedź modelu — po paczce otworzy się lobby. Trasa jest tajemnicą: widzisz tylko komunikat o liczbie stacji.'
        : 'Potwierdź pozycję, wygeneruj stacje i pytania, wklej odpowiedź modelu — po paczce otworzy się lobby.');
    }
  });


  // Obrót telefonu albo zmiana rozmiaru okna: panele map mają inne wymiary,
  // więc widok trzeba przeliczyć (rozmiar bierzemy z `getBoundingClientRect`).
  window.addEventListener('resize', () => {
    ustawWysokoscBelki(); // belka mogła urosnąć/zmaleć (`.akcje` się zawija)
    kazdaMapa((mapa) => mapa.odswiez());
    naZmianeRozmiaruOkna(); // ADR 0030 aneks: po obrocie ◎ klika się samo
  });
  // iOS potrafi zgłosić obrót osobnym zdarzeniem (i inaczej ustawić kolejność
  // względem nowego układu) — idzie tym samym torem co `resize`.
  window.addEventListener('orientationchange', naZmianeRozmiaruOkna);

  // Właściciel 2026-09-13 (uwaga B, ADR 0040): ŻADNEJ pauzy w tle. Aplikacja ma
  // być cały czas włączona, a po powrocie wszystko wznawia się samo — bez kliku.
  // Przeglądarka i tak zamraża strumień fixów w tle, więc przy powrocie
  // sprawdzamy, czy nasłuch żyje, i jeśli nie — zakładamy świeży (bug G: WebKit
  // trzyma czasem `watchPosition` aktywny, ale niemy). Bez komunikatów o
  // „wstrzymaniu" i „wznowieniu": wycofane kody P07/P09 (ADR 0040 pkt 3).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      zapiszGre(); // uwaga K (ADR 0045): zwinięcie karty zapisuje ostatni stan
      zatrzymajSymulacje(); // symulacja testowa nie odtwarza się w tle
      return;
    }
    // Przeglądarki zwalniają Wake Lock przy `hidden` — po powrocie żądamy go
    // od nowa, jeśli gra trwa (ADR 0040 pkt 4).
    zwolnijEkran();
    odswiezWakeLock();
    if (STAN.trybTestowy) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const czekamyNaFixa = STAN.ekran === 'pozycja'
      || (STAN.rozgrywka && STAN.rozgrywka.faza === FAZY.odcinek);
    if (!czekamyNaFixa) return;
    if (!STAN.watcher?.czyAktywny() || !STAN.ostatniFix) wlaczGps();
  });

  // Uwaga A (ADR 0047, decyzja właściciela 2026-09-14): strona NIE jest
  // szczypalna poza mapą. Safari iOS potrafi wznowić kartę przybliżoną (belka
  // i marginesy ucięte), a potem palce zoomują stronę zamiast mapy — i to
  // powiększenie zostaje. iOS ignoruje `user-scalable=no`, więc jedyna pewna
  // droga to preventDefault na gestach systemowych iOS (`gesturestart` /
  // `gesturechange`) dla celów POZA `.mapa`; nad mapą gest przechodzi bez
  // zmian (mapa ma własne sterowanie i `touch-action: none`). Pozostałe gesty
  // (przewijanie, stuknięcia) nie są dotykane — dostępność czytania dużego
  // UI przenosi się na powiększenie systemowe (ADR 0047 pkt 3).
  const gestStrony = (zdarzenie) => {
    if (zdarzenie.target?.closest?.('.mapa')) return; // nad mapą: jak dotąd
    zdarzenie.preventDefault();
  };
  document.addEventListener('gesturestart', gestStrony, { passive: false });
  document.addEventListener('gesturechange', gestStrony, { passive: false });

  // Uwaga K (ADR 0045): właściciel chce, żeby zamknięcie karty albo odświeżenie
  // zapisywało stan gry. Zapis i tak idzie po KAŻDEJ tranzycji (`zapiszGre`,
  // plan M6 decyzja 5), bo `beforeunload` jest na telefonach zawodny — `pagehide`
  // domyka ostatni ruch (np. odpowiedź wpisaną tuż przed zamknięciem) i jest na
  // iOS jedynym pewnym pożegnaniem. Gra wieloosobowa nie ma lokalnego snapshotu:
  // jej stan żyje na moście, a telefon pamięta sesję (`zapiszSesjeMulti`).
  window.addEventListener('pagehide', () => zapiszGre());

  $('przycisk-wstecz-setup').addEventListener('click', () => {
    STAN.multiPoPaczce = false; // porzucono ścieżkę AI-multi
    STAN.ukryjStacje = false;
    pokazEkran('setup');
  });
  // Uwaga terenowa 2026-09-16 (każdy przycisk): „Zlokalizuj mnie” w trybie
  // testowym — aktywny, jednorazowy sondaż GPS (nie ciągły watcher). Nasłuch
  // nie odbiera niczego poza trybem testowym: bramka w `wyznaczPozycje()`
  // ucina klik u źródła, a klasa `tylko-test` chowa przycisk w DOM (CSS).
  $('przycisk-zlokalizuj').addEventListener('click', wyznaczPozycje);
  $('przycisk-dalej-stacje').addEventListener('click', () => {
    // Na ekran pozycji da się wejść także ikonką setup w nagłówku, która nie
    // waliduje setupu, a `stacjeProste` odmawia przy niedodatnim promieniu
    // albo liczbie stacji. Zamiast wyjątku w nasłuchu — jawna odmowa z kodami
    // z `konfig.js` (LESSONS L10: walidacja nie może zakładać, że ktoś
    // wcześniej posprzątał).
    // Walidujemy stan, nie DOM: na tym ekranie pola setupu są schowane, a
    // imiona i tak trafiają do `STAN.konfig.imiona` z nasłuchów `input`.
    const usterki = walidujSetup(STAN.konfig);
    if (usterki.length) {
      pokazBledy('bledy-pozycja', usterki);
      status(`Stacje nie zostały rozstawione: konfiguracja ma usterek: ${usterki.length}. Wróć do ustawień gry i popraw je.`);
      return;
    }
    pokazEkran('stacje');
    przeliczStacje();
  });

  $('przycisk-wstecz-pozycja').addEventListener('click', () => pokazEkran('pozycja'));
  $('przycisk-siec-ponow').addEventListener('click', () => {
    // Prośba UX właściciela (m12-120): kliknięcie opcji pod długą listą ma
    // wracać widok na górę warstwy — lista jest długa, panel przewija się
    // wewnątrz .panel-centralny (overflow-y: auto).
    przewinWarstweStacjiNaGore();
    pokazBledy('bledy-stacje', []);
    status('Ponownie pobieram sieć drogową…');
    void przeliczStacjeZPobraniem(kluczSieci());
  });
  $('przycisk-przelicz').addEventListener('click', () => {
    przewinWarstweStacjiNaGore(); // UX właściciela m12-120, jw.
    STAN.ziarnoOffset += 1;
    STAN.obrot = (STAN.obrot + 360 / (STAN.konfig.liczbaStacji * 2)) % 360;
    przeliczStacje();
    status('Przeliczono układ stacji (inne ziarno).');
  });
  $('przycisk-dalej-prompt').addEventListener('click', () => {
    // Uwaga terenowa G.a (właściciel, 2026-09-12): każda NOWA generacja
    // startuje z domyślnym = ODPTASZKOWANYM checkboxem (ADR 0032: domyślny
    // jest wariant bez fact-check). Aplikacja nie przeładowuje się sama
    // (PWA), więc stan DOM checkboxa „przeżywał” tło aplikacji i staro
    // zaptaszkowane pole właściciel widział jako „domyślnie zaptaszkowane”.
    // Reset jest TYLKO przy wejściu z ekranu 3: strzałka wstecz (ekran 5 → 4)
    // celowo nie rusza checkboxa — prompt tej samej generacji nie może
    // zmieniać się pod palcem.
    $('prompt-factcheck').checked = false;
    pokazEkran('prompt');
    budujPromptEkran();
  });

  $('przycisk-wstecz-stacje').addEventListener('click', () => pokazEkran('stacje'));
  // Uwaga terenowa 2026-09-16 (każdy przycisk): „Kopiuj prompt” ma kopiować
  // i OD RAZU przejść na ekran „Wklej odpowiedź modelu” (krok 5) — mniej
  // dotknięć w terenie. Tekst nie zaginie: dobywa go schowek, nie wysuwki.
  $('przycisk-kopiuj-prompt').addEventListener('click', async (e) => {
    if (!(STAN.prompt ?? '')) return; // pusty prompt = wygeneruj stacje, więc nic do podania dalej
    const ok = await kopiujTekst(STAN.prompt, e.currentTarget, '⧉ Kopiuj prompt');
    // Auto-przejście TYLKO przy udanym schowku: ręczny fallback („⚠ zaznaczone —
    // skopiuj ręcznie”) zostawia właściciela na ekranie, by sam dokończył kopię.
    if (ok) pokazEkran('paczka');
  });
  $('prompt-factcheck').addEventListener('change', () => budujPromptEkran());
  // Przycisku „Zapisz jako plik" nie ma (właściciel, 2026-09-09): prompt i tak
  // idzie do schowka („Kopiuj prompt"), a plik .txt był dodatkową drogą, której
  // nikt nie używał. Eksportów wyniku też już nie ma (ADR 0038), więc zniknął
  // i helper `pobierzPlik` — nie ma czego pobierać.
  $('przycisk-dalej-paczka').addEventListener('click', () => pokazEkran('paczka'));

  $('przycisk-wstecz-prompt').addEventListener('click', () => pokazEkran('prompt'));
  // Przycisku czytającego schowek NIE MA (uwaga terenowa A(b), 2026-09-16):
  // właściciel zmierzył w terenie, że na iPhonie (Chrome) `readText()` nie
  // oddaje treści — w przeglądarce nie ma na to drogi, a wklejenie PALCEM
  // (nasłuch `paste` niżej) waliduje samo, więc guzik był tylko kosztem.
  // Kasowanie martwej drogi: ADR 0006 (aneks 2026-09-16d), LESSONS L31.

  /**
   * Wklejenie palcem (Ctrl+V albo menu dotykowe) waliduje samo z siebie.
   *
   * Treść bierzemy z `clipboardData`, NIE z pola: `paste` leci PRZED wstawieniem
   * tekstu, więc `pole.value` jest w tej chwili jeszcze puste (albo ma poprzednią
   * zawartość).
   *
   * Domyślną akcję BLOKUJEMY (właściciel 2026-09-15, uwaga 4): przeglądarka
   * wstawia tekst PO powrocie z nasłuchu, czyli już po tym, jak `sprawdzOdpowiedz`
   * oczyściła pole — błąd wklejonej paczki wracał pod palec i poprawioną paczkę
   * trzeba było najpierw ręcznie zaznaczyć i skasować. Wstawienie robimy sami
   * (linia niżej), więc na ekranie nic się nie zmienia: pole pokazuje treść
   * podczas walidacji, a po niej zostaje puste — tak przy przyjęciu, jak i po
   * odmowie (ADR 0006 pkt 3 i ADR 0007 pkt 4).
   */
  $('pole-odpowiedz').addEventListener('paste', (e) => {
    const tekst = e.clipboardData?.getData('text') ?? '';
    if (!tekst.trim()) return; // wklejenie obrazka albo pustki nie udaje paczki
    e.preventDefault();
    $('pole-odpowiedz').value = tekst;
    sprawdzOdpowiedz(tekst);
  });

  // „Zobacz więcej/mniej paczek" (właściciel 2026-09-11): lista startuje
  // zwinięta do trzech najlepszych, przycisk odsłania resztę i zwija z powrotem.
  $('przycisk-zestawy-wiecej').addEventListener('click', () => {
    ZESTAWY_ROZWINIETE = !ZESTAWY_ROZWINIETE;
    renderujZestawy();
  });
  $('przycisk-start-odcinka').addEventListener('click', () => startOdcinkaGry());
  // ADR 0029: ręcznego zgłaszania dojścia NIE MA — ani w index.html, ani tutaj.
  // Dojście zamyka wyłącznie strumień fixów (GPS albo symulacja w trybie
  // testowym, która karmi aplikację tym samym `przyjmijFix`); testy idą tą samą
  // drogą, więc nie ma drugiego, produkcyjnie martwego wejścia do fazy pytania.
  $('przycisk-nowa-gra').addEventListener('click', () => wrocNaPoczatek());
  $('przycisk-symulacja-gra').addEventListener('click', () => przelaczSymulacjeDoStacji());
  $('przycisk-nastepna-stacja').addEventListener('click', () => nastepnaStacja());
  // ADR 0028: oceny pytań — kliknięcie jest jednoklikowe i nie blokuje gry.
  $('gra-ocena-plus').addEventListener('click', () => kliknijOcene(OCENA_PLUS));
  $('gra-ocena-minus').addEventListener('click', () => kliknijOcene(OCENA_MINUS));
  zaladujOcenyLokalne();
  oproznijKolejkeOcen();
  // ADR 0043 (uwagi H1 i I): koniec gry żyje w warstwie za ikoną ⚙ START GRY.
  $('przycisk-zamknij-koniec-gry').addEventListener('click', () => zamknijKoniecGry());
  $('koniec-gry-potwierdzenie').addEventListener('input', () => odswiezKoniecGry());
  $('przycisk-koniec-gry').addEventListener('click', () => zakonczGreZPotwierdzenia());
  // Przycisków „▶ Wznów grę" i „🗑 Nowa gra (kasuje zapis)" NIE MA (uwaga J,
  // ADR 0045): telefon wraca do zapamiętanej gry sam, na końcu `start()`.

  /* M11/P4+m12-74: gra na wielu urządzeniach — segmenty na setupie, lobby,
     kanał info i koniec gry z ręki hosta (bez kodów i bez źródeł paczek). */
  wczytajUstawieniaMulti();
  renderujRodzajeGry();
  renderujMultiSciezka();
  renderujTrybyMulti();
  renderujRodzajGry();
  $('multi-trasa-sekret').addEventListener('change', (e) => {
    STAN.multiTrasaSekret = e.target.checked;
    status(STAN.multiTrasaSekret
      ? 'Trasa-sekret: w grze mapa pokazuje tylko bieżącą stację.'
      : 'Trasa jawna: mapa w grze pokazuje wszystkie stacje.');
  });
  $('przycisk-odswiez-lobby').addEventListener('click', () => { void odswiezListeGierNaSetupie(); });
  $('przycisk-lobby-start').addEventListener('click', () => { void startLobby(); });
  $('przycisk-lobby-opusc').addEventListener('click', opuscLobby);
  // Przycisków „⏹ Zakończ grę (host)" i „🏳 Rezygnuję z gry" NIE MA (uwaga F,
  // ADR 0044): koniec gry i rezygnację obsługuje warstwa za ikoną ⚙ START GRY
  // (`zakonczGreZPotwierdzenia` → `rezygnujZGryMulti()` — uwaga G: host też).
  // Przycisków „↩ Wróć do gry" i „🗑 Porzuć zapamiętaną grę" NIE MA (uwagi J
  // i K, ADR 0045): powrót do zapamiętanej gry wieloosobowej jest automatyczny
  // (na końcu `start()`), a sesję kasuje wyjście z lobby, zamknięcie gry przez
  // most, rezygnacja i jawna odmowa mostu przy powrocie.
  // Start to mapa + okno startowe, nie setup (decyzja właściciela 2026-09-09).
  pokazMapeStartowa();
  const start = $('ekran-start');
  if (start) {
    start.scrollTop = 0;
    start.hidden = false;
  }
  document.body.classList.add('okno-start');

  odswiezWidocznoscPaneli();
  // Brak komunikatu na starcie (właściciel 2026-09-11): dawny status „M0 —
  // fundament. Ustawienia domyślne…” był developerskim tekstem na ekranie gry.
  if (!STAN.trybTestowy && !STAN.watcher?.czyAktywny()) wlaczGps();

  // ADR 0040 pkt 4–5 (uwagi B i C, 2026-09-13): ekran nie gaśnie podczas gry,
  // a JEDYNA przerwa w śledzeniu to kwadrans bez żadnej akcji gracza — wznawia
  // ją dowolny klik, bez przycisku i bez pytania.
  STAN.ostatniaAkcjaMs = performance.now();
  STAN.kierunekEkranu = kierunekEkranu(rozmiarOkna()); // punkt odniesienia obrotu
  document.addEventListener('click', zaznaczAktywnosc, true);
  document.addEventListener('keydown', zaznaczAktywnosc, true);
  STAN.zegarAktywnosci = setInterval(sprawdzBezczynnosc, SPRAWDZANIE_BEZCZYNNOSCI_MS);
  odswiezWakeLock();

  // UWAGI J i K (ADR 0045): telefon pamięta grę → WRACAMY do niej od razu, bez
  // okna startowego i bez banera na setupie. Multi ma pierwszeństwo, bo ta gra
  // żyje na serwerze i inni gracze mogą czekać — jej stan trzeba pobrać z mostu
  // (asynchronicznie). Zapis hotseat jest lokalny, więc wraca synchronicznie;
  // jeśli multi nie dało się podnieść (brak zasięgu, gra wygasła), podnosimy
  // hotseat, żeby telefon nie został na starcie z niedokończoną grą w pamięci.
  if (czytajSesjeMulti()) void przywrocGreMulti().then(() => { if (!STAN.multi) przywrocGreHotseat(); });
  else przywrocGreHotseat();
}

if (typeof document !== 'undefined' && document.getElementById('ekran-setup')) start();
